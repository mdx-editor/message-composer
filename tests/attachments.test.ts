import { Engine } from "@virtuoso.dev/reactive-engine-core";
import { expect, test, vi } from "vite-plus/test";

import { controlled$, disabled$, draftValue$, submit$, submitHandler$, valueChange$ } from "../src/core/nodes.ts";
import { createEmptyMessageComposerValue, type MessageComposerValue } from "../src/core/value.ts";
import {
  addAttachmentFiles$,
  attachmentRejections$,
  attachments$,
  attachmentsPlugin,
  dismissAttachmentRejections$,
  removeAttachment$,
  retryAttachmentUpload$,
  type MessageComposerAttachment,
  type MessageComposerAttachmentsConfig,
  type MessageComposerAttachmentUploadHandler,
} from "../src/plugins/attachments/index.ts";

async function settlePromises() {
  await Promise.resolve();
  await Promise.resolve();
}

interface UploadCall {
  file: File;
  attachment: MessageComposerAttachment;
  signal: AbortSignal;
  onProgress: (progress: number) => void;
  resolve: (result: { url: string }) => void;
  reject: (error: unknown) => void;
}

function deferredUpload() {
  const calls: UploadCall[] = [];
  const upload: MessageComposerAttachmentUploadHandler = (file, context) =>
    new Promise((resolve, reject) => {
      calls.push({ file, ...context, resolve, reject });
    });
  return { upload, calls };
}

function makeFile(name: string, size = 16, type = "text/plain"): File {
  return new File([new Uint8Array(size)], name, { type });
}

function setup(config?: Partial<MessageComposerAttachmentsConfig>, engine = new Engine()) {
  const { upload, calls } = deferredUpload();
  const plugin = attachmentsPlugin({ upload, ...config });
  const cleanup = plugin.init?.({ engine }) as () => void;
  return { engine, calls, plugin, cleanup };
}

test("ingestion creates an uploading record and starts the upload", () => {
  const { engine, calls } = setup();
  const changes: MessageComposerValue[] = [];
  engine.sub(valueChange$, (value) => changes.push(value));

  const file = makeFile("notes.txt", 32);
  engine.pub(addAttachmentFiles$, [file]);

  const attachments = engine.getValue(attachments$);
  expect(attachments).toHaveLength(1);
  expect(attachments[0]).toMatchObject({
    name: "notes.txt",
    mimeType: "text/plain",
    size: 32,
    status: "uploading",
    file,
  });
  expect(attachments[0].id).toBeTruthy();
  expect(changes).toHaveLength(1);

  expect(calls).toHaveLength(1);
  expect(calls[0].file).toBe(file);
  expect(calls[0].attachment.id).toBe(attachments[0].id);
  expect(calls[0].signal.aborted).toBe(false);
});

test("ingestion appends to existing attachments and generates unique ids", () => {
  const { engine } = setup();

  engine.pub(addAttachmentFiles$, [makeFile("a.txt")]);
  engine.pub(addAttachmentFiles$, [makeFile("b.txt"), makeFile("c.txt")]);

  const attachments = engine.getValue(attachments$);
  expect(attachments.map((attachment) => attachment.name)).toEqual(["a.txt", "b.txt", "c.txt"]);
  expect(new Set(attachments.map((attachment) => attachment.id)).size).toBe(3);
});

test("progress reports update the attachment and clamp to 0-1", () => {
  const { engine, calls } = setup();
  engine.pub(addAttachmentFiles$, [makeFile("a.txt")]);

  calls[0].onProgress(0.5);
  expect(engine.getValue(attachments$)[0].progress).toBe(0.5);

  calls[0].onProgress(1.5);
  expect(engine.getValue(attachments$)[0].progress).toBe(1);

  calls[0].onProgress(-1);
  expect(engine.getValue(attachments$)[0].progress).toBe(0);
});

test("upload resolution marks the attachment success with the url", async () => {
  const { engine, calls } = setup();
  engine.pub(addAttachmentFiles$, [makeFile("a.txt")]);

  calls[0].onProgress(0.5);
  calls[0].resolve({ url: "https://files.example/a.txt" });
  await settlePromises();

  const [attachment] = engine.getValue(attachments$);
  expect(attachment.status).toBe("success");
  expect(attachment.url).toBe("https://files.example/a.txt");
  expect(attachment.progress).toBeUndefined();
});

test("upload rejection marks the attachment error with the message", async () => {
  const { engine, calls } = setup();
  engine.pub(addAttachmentFiles$, [makeFile("a.txt")]);

  calls[0].reject(new Error("network down"));
  await settlePromises();

  const [attachment] = engine.getValue(attachments$);
  expect(attachment.status).toBe("error");
  expect(attachment.error).toBe("network down");
});

test("a synchronously throwing upload handler marks the attachment error", () => {
  const engine = new Engine();
  const plugin = attachmentsPlugin({
    upload: () => {
      throw new Error("sync boom");
    },
  });
  plugin.init?.({ engine });

  engine.pub(addAttachmentFiles$, [makeFile("a.txt")]);

  const [attachment] = engine.getValue(attachments$);
  expect(attachment.status).toBe("error");
  expect(attachment.error).toBe("sync boom");
});

test("late progress reports after settlement are ignored", async () => {
  const { engine, calls } = setup();
  engine.pub(addAttachmentFiles$, [makeFile("a.txt")]);

  calls[0].resolve({ url: "https://files.example/a.txt" });
  await settlePromises();
  calls[0].onProgress(0.25);

  const [attachment] = engine.getValue(attachments$);
  expect(attachment.status).toBe("success");
  expect(attachment.progress).toBeUndefined();
});

test("retry re-runs the upload for an errored attachment with a local file", async () => {
  const { engine, calls } = setup();
  engine.pub(addAttachmentFiles$, [makeFile("a.txt")]);
  calls[0].reject(new Error("nope"));
  await settlePromises();

  const id = engine.getValue(attachments$)[0].id;
  engine.pub(retryAttachmentUpload$, id);

  expect(engine.getValue(attachments$)[0]).toMatchObject({ status: "uploading", error: undefined });
  expect(calls).toHaveLength(2);

  calls[1].resolve({ url: "https://files.example/a.txt" });
  await settlePromises();
  expect(engine.getValue(attachments$)[0]).toMatchObject({ status: "success", url: "https://files.example/a.txt" });
});

test("retry is a no-op for uploading attachments, unknown ids, and host-authored records without a file", () => {
  const { engine, calls } = setup();
  engine.pub(addAttachmentFiles$, [makeFile("a.txt")]);

  engine.pub(retryAttachmentUpload$, engine.getValue(attachments$)[0].id);
  engine.pub(retryAttachmentUpload$, "missing");
  expect(calls).toHaveLength(1);

  const hostAuthored: MessageComposerAttachment = {
    id: "host-1",
    name: "spec.pdf",
    mimeType: "application/pdf",
    size: 100,
    status: "error",
    error: "failed elsewhere",
  };
  const draft = engine.getValue(draftValue$);
  engine.pub(draftValue$, { ...draft, attachments: [...draft.attachments, hostAuthored] });
  engine.pub(retryAttachmentUpload$, "host-1");
  expect(calls).toHaveLength(1);
});

test("remove aborts the in-flight upload and a late settlement does not resurrect the record", async () => {
  const { engine, calls } = setup();
  engine.pub(addAttachmentFiles$, [makeFile("a.txt"), makeFile("b.txt")]);

  const removedId = engine.getValue(attachments$)[0].id;
  engine.pub(removeAttachment$, removedId);

  expect(calls[0].signal.aborted).toBe(true);
  expect(calls[1].signal.aborted).toBe(false);
  expect(engine.getValue(attachments$).map((attachment) => attachment.name)).toEqual(["b.txt"]);

  calls[0].resolve({ url: "https://files.example/a.txt" });
  await settlePromises();
  expect(engine.getValue(attachments$).map((attachment) => attachment.name)).toEqual(["b.txt"]);
});

test("validation rejects by size, accept, count, and custom rule with codes", () => {
  const { engine, calls } = setup({
    accept: "image/*,.pdf",
    maxFileSize: 1024,
    maxCount: 2,
    validate: (file) => (file.name.includes("virus") ? "Failed the malware scan." : null),
  });

  engine.pub(addAttachmentFiles$, [
    makeFile("photo.png", 100, "image/png"),
    makeFile("huge.png", 4096, "image/png"),
    makeFile("notes.txt", 100, "text/plain"),
    makeFile("virus.pdf", 100, "application/pdf"),
    makeFile("doc.pdf", 100, "application/pdf"),
    makeFile("extra.png", 100, "image/png"),
  ]);

  expect(engine.getValue(attachments$).map((attachment) => attachment.name)).toEqual(["photo.png", "doc.pdf"]);
  expect(calls).toHaveLength(2);
  expect(engine.getValue(attachmentRejections$).map((rejection) => [rejection.file.name, rejection.code])).toEqual([
    ["huge.png", "file-too-large"],
    ["notes.txt", "type-not-accepted"],
    ["virus.pdf", "custom"],
    ["extra.png", "too-many-files"],
  ]);
});

test("maxCount counts existing draft attachments across batches", () => {
  const { engine } = setup({ maxCount: 2 });

  engine.pub(addAttachmentFiles$, [makeFile("a.txt")]);
  engine.pub(addAttachmentFiles$, [makeFile("b.txt"), makeFile("c.txt")]);

  expect(engine.getValue(attachments$).map((attachment) => attachment.name)).toEqual(["a.txt", "b.txt"]);
  expect(engine.getValue(attachmentRejections$).map((rejection) => rejection.code)).toEqual(["too-many-files"]);
});

test("a later valid ingestion clears stale rejections, and dismiss clears them explicitly", () => {
  const { engine } = setup({ maxFileSize: 1024 });

  engine.pub(addAttachmentFiles$, [makeFile("huge.bin", 4096)]);
  expect(engine.getValue(attachmentRejections$)).toHaveLength(1);

  engine.pub(addAttachmentFiles$, [makeFile("ok.txt", 100)]);
  expect(engine.getValue(attachmentRejections$)).toHaveLength(0);

  engine.pub(addAttachmentFiles$, [makeFile("huge2.bin", 4096)]);
  expect(engine.getValue(attachmentRejections$)).toHaveLength(1);
  engine.pub(dismissAttachmentRejections$);
  expect(engine.getValue(attachmentRejections$)).toHaveLength(0);
});

test("controlled: ingestion emits valueChange without committing, transitions drop without an echo", async () => {
  const seeded = createEmptyMessageComposerValue();
  const engine = new Engine({ [controlled$]: true, [draftValue$]: seeded });
  const { calls } = setup({}, engine);
  const changes: MessageComposerValue[] = [];
  engine.sub(valueChange$, (value) => changes.push(value));

  engine.pub(addAttachmentFiles$, [makeFile("a.txt")]);

  expect(changes).toHaveLength(1);
  expect(changes[0].attachments).toHaveLength(1);
  expect(engine.getValue(draftValue$)).toBe(seeded);

  calls[0].resolve({ url: "https://files.example/a.txt" });
  await settlePromises();
  expect(changes).toHaveLength(1);
});

test("controlled: an echoing host receives upload transitions against the echoed value", async () => {
  const engine = new Engine({ [controlled$]: true });
  const { calls } = setup({}, engine);
  const changes: MessageComposerValue[] = [];
  engine.sub(valueChange$, (value) => {
    changes.push(value);
    engine.pub(draftValue$, value);
  });

  engine.pub(addAttachmentFiles$, [makeFile("a.txt")]);
  calls[0].resolve({ url: "https://files.example/a.txt" });
  await settlePromises();

  expect(changes).toHaveLength(2);
  expect(changes.at(-1)?.attachments[0]).toMatchObject({ status: "success", url: "https://files.example/a.txt" });
});

test("ingestion and retry are ignored while disabled", () => {
  const engine = new Engine({ [disabled$]: true });
  const { calls } = setup({}, engine);

  engine.pub(addAttachmentFiles$, [makeFile("a.txt")]);
  expect(engine.getValue(attachments$)).toHaveLength(0);
  expect(calls).toHaveLength(0);
});

test("two engines with the same plugin config stay independent", () => {
  const plugin = attachmentsPlugin({ upload: deferredUpload().upload });
  const first = new Engine();
  const second = new Engine();
  plugin.init?.({ engine: first });
  plugin.init?.({ engine: second });

  first.pub(addAttachmentFiles$, [makeFile("first.txt")]);

  expect(first.getValue(attachments$)).toHaveLength(1);
  expect(second.getValue(attachments$)).toHaveLength(0);
});

test("cleanup aborts in-flight uploads and a late settlement does not publish", async () => {
  const { engine, calls, cleanup } = setup();
  engine.pub(addAttachmentFiles$, [makeFile("a.txt")]);
  expect(calls[0].signal.aborted).toBe(false);

  cleanup();
  expect(calls[0].signal.aborted).toBe(true);

  calls[0].resolve({ url: "https://files.example/a.txt" });
  await settlePromises();
  expect(engine.getValue(attachments$)[0].status).toBe("uploading");
});

test("submitted value carries the attachments", async () => {
  const { engine, calls } = setup();
  const received = vi.fn<(value: MessageComposerValue) => void>();
  engine.pub(submitHandler$, received);

  engine.pub(addAttachmentFiles$, [makeFile("a.txt", 32)]);
  calls[0].resolve({ url: "https://files.example/a.txt" });
  await settlePromises();

  engine.pub(submit$);

  expect(received).toHaveBeenCalledTimes(1);
  const value = received.mock.calls[0][0];
  expect(value.attachments).toHaveLength(1);
  expect(value.attachments[0]).toMatchObject({
    name: "a.txt",
    mimeType: "text/plain",
    size: 32,
    status: "success",
    url: "https://files.example/a.txt",
  });
});
