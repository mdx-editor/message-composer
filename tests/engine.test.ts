import { Engine } from "@virtuoso.dev/reactive-engine-core";
import { expect, test, vi } from "vite-plus/test";

import {
  controlled$,
  disabled$,
  draftValue$,
  markdown$,
  reset$,
  setMarkdown$,
  submit$,
  submitError$,
  submitHandler$,
  submitting$,
  valueChange$,
} from "../src/core/nodes.ts";
import { createEmptyMessageComposerValue, type MessageComposerValue } from "../src/core/value.ts";

async function settlePromises() {
  await Promise.resolve();
  await Promise.resolve();
}

test("initial state", () => {
  const engine = new Engine();

  expect(engine.getValue(draftValue$)).toEqual(createEmptyMessageComposerValue());
  expect(engine.getValue(markdown$)).toBe("");
  expect(engine.getValue(submitting$)).toBe(false);
  expect(engine.getValue(submitError$)).toBeNull();
  expect(engine.getValue(disabled$)).toBe(false);
});

test("uncontrolled: setMarkdown commits to the draft and emits valueChange", () => {
  const engine = new Engine();
  const changes: MessageComposerValue[] = [];
  engine.sub(valueChange$, (value) => changes.push(value));

  engine.pub(setMarkdown$, "hello");

  expect(engine.getValue(draftValue$).markdown).toBe("hello");
  expect(engine.getValue(markdown$)).toBe("hello");
  expect(changes).toHaveLength(1);
  expect(changes[0]).toEqual({ ...createEmptyMessageComposerValue(), markdown: "hello" });
});

test("setMarkdown preserves structured metadata in the draft", () => {
  const seeded: MessageComposerValue = {
    ...createEmptyMessageComposerValue(),
    mentions: [{ id: "u1", trigger: "@", label: "Ada" }],
  };
  const engine = new Engine({ [draftValue$]: seeded });

  engine.pub(setMarkdown$, "hi @Ada");

  expect(engine.getValue(draftValue$)).toEqual({ ...seeded, markdown: "hi @Ada" });
});

test("controlled: editor changes emit valueChange but do not commit to the draft", () => {
  const seeded = { ...createEmptyMessageComposerValue(), markdown: "fixed" };
  const engine = new Engine({ [controlled$]: true, [draftValue$]: seeded });
  const changes: MessageComposerValue[] = [];
  engine.sub(valueChange$, (value) => changes.push(value));

  engine.pub(setMarkdown$, "typed");

  expect(changes.at(-1)?.markdown).toBe("typed");
  expect(engine.getValue(draftValue$)).toBe(seeded);
});

test("controlled prop seeding and updates flow through the draft cell", () => {
  const engine = new Engine({ [controlled$]: true });
  const first = { ...createEmptyMessageComposerValue(), markdown: "first" };
  const second = { ...createEmptyMessageComposerValue(), markdown: "second" };

  engine.pub(draftValue$, first);
  expect(engine.getValue(markdown$)).toBe("first");

  engine.pub(draftValue$, second);
  expect(engine.getValue(markdown$)).toBe("second");
});

test("submit invokes the handler with the full submitted value shape and never clears the draft", () => {
  const engine = new Engine();
  const received: MessageComposerValue[] = [];
  engine.pub(submitHandler$, (value) => {
    received.push(value);
  });

  engine.pub(setMarkdown$, "to submit");
  engine.pub(submit$);

  expect(received).toHaveLength(1);
  expect(received[0]).toEqual({
    markdown: "to submit",
    attachments: [],
    mentions: [],
    audioClips: [],
  });
  expect(engine.getValue(draftValue$).markdown).toBe("to submit");
});

test("async submit: submitting while pending, error state on rejection, draft untouched", async () => {
  const engine = new Engine();
  let rejectSubmit!: (error: unknown) => void;
  engine.pub(submitHandler$, () => {
    return new Promise<void>((_, reject) => {
      rejectSubmit = reject;
    });
  });

  engine.pub(setMarkdown$, "draft");
  engine.pub(submit$);
  expect(engine.getValue(submitting$)).toBe(true);

  const error = new Error("failed");
  rejectSubmit(error);
  await settlePromises();

  expect(engine.getValue(submitting$)).toBe(false);
  expect(engine.getValue(submitError$)).toBe(error);
  expect(engine.getValue(draftValue$).markdown).toBe("draft");
});

test("async submit: resolution clears submitting without error", async () => {
  const engine = new Engine();
  let resolveSubmit!: () => void;
  engine.pub(submitHandler$, () => {
    return new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
  });

  engine.pub(submit$);
  expect(engine.getValue(submitting$)).toBe(true);

  resolveSubmit();
  await settlePromises();

  expect(engine.getValue(submitting$)).toBe(false);
  expect(engine.getValue(submitError$)).toBeNull();
});

test("a new submit attempt clears the previous error", async () => {
  const engine = new Engine();
  engine.pub(submitHandler$, () => Promise.reject(new Error("nope")));

  engine.pub(submit$);
  await settlePromises();
  expect(engine.getValue(submitError$)).toBeInstanceOf(Error);

  engine.pub(submitHandler$, () => {});
  engine.pub(submit$);
  expect(engine.getValue(submitError$)).toBeNull();
});

test("a synchronously throwing handler sets the error state", () => {
  const engine = new Engine();
  const error = new Error("sync boom");
  engine.pub(submitHandler$, () => {
    throw error;
  });

  engine.pub(submit$);

  expect(engine.getValue(submitError$)).toBe(error);
  expect(engine.getValue(submitting$)).toBe(false);
});

test("submit is ignored while pending and when disabled", () => {
  const engine = new Engine();
  const handler = vi.fn<() => Promise<void>>(() => new Promise<void>(() => {}));
  engine.pub(submitHandler$, handler);

  engine.pub(submit$);
  engine.pub(submit$);
  expect(handler).toHaveBeenCalledTimes(1);

  const other = new Engine({ [disabled$]: true });
  const otherHandler = vi.fn<() => void>();
  other.pub(submitHandler$, otherHandler);
  other.pub(submit$);
  expect(otherHandler).not.toHaveBeenCalled();
});

test("uncontrolled reset: clears the draft, emits valueChange, clears error", () => {
  const engine = new Engine();
  const changes: MessageComposerValue[] = [];
  engine.sub(valueChange$, (value) => changes.push(value));
  engine.pub(setMarkdown$, "typed");
  engine.pub(submitError$, new Error("stale"));

  engine.pub(reset$);

  expect(engine.getValue(draftValue$)).toEqual(createEmptyMessageComposerValue());
  expect(engine.getValue(submitError$)).toBeNull();
  expect(changes.at(-1)).toEqual(createEmptyMessageComposerValue());
});

test("controlled reset: only emits the cleared value, draft stays host-owned", () => {
  const seeded = { ...createEmptyMessageComposerValue(), markdown: "fixed" };
  const engine = new Engine({ [controlled$]: true, [draftValue$]: seeded });
  const changes: MessageComposerValue[] = [];
  engine.sub(valueChange$, (value) => changes.push(value));

  engine.pub(reset$);

  expect(engine.getValue(draftValue$)).toBe(seeded);
  expect(changes.at(-1)).toEqual(createEmptyMessageComposerValue());
});

test("callback bridging: singletonSub replaces the previous subscription", () => {
  const engine = new Engine();
  const first = vi.fn<(value: MessageComposerValue) => void>();
  const second = vi.fn<(value: MessageComposerValue) => void>();

  engine.singletonSub(valueChange$, first);
  engine.singletonSub(valueChange$, second);
  engine.pub(setMarkdown$, "x");

  expect(first).not.toHaveBeenCalled();
  expect(second).toHaveBeenCalledTimes(1);
});

test("two engines using the same node graph stay independent", () => {
  const first = new Engine();
  const second = new Engine();

  first.pub(setMarkdown$, "first engine");
  second.pub(setMarkdown$, "second engine");

  expect(first.getValue(markdown$)).toBe("first engine");
  expect(second.getValue(markdown$)).toBe("second engine");
});

test("a submit promise settling after dispose does not publish into the disposed engine", async () => {
  const engine = new Engine();
  let resolveSubmit!: () => void;
  engine.pub(submitHandler$, () => {
    return new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
  });

  engine.pub(submit$);
  expect(engine.getValue(submitting$)).toBe(true);

  engine.dispose();
  resolveSubmit();
  await settlePromises();

  expect(engine.isDisposed).toBe(true);
});
