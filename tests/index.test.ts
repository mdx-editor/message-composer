import { expect, test } from "vite-plus/test";

import {
  createEmptyMessageComposerValue,
  type MessageComposerAgentValue,
  type MessageComposerAttachment,
  type MessageComposerValue,
} from "../src/index.ts";
import { attachmentsPlugin, type MessageComposerAttachmentUploadHandler } from "../src/plugins/attachments/index.ts";

test("creates an empty message composer value", () => {
  expect(createEmptyMessageComposerValue()).toEqual({
    markdown: "",
    attachments: [],
    mentions: [],
    audioClips: [],
  });
});

test("attachment host data is typed through values and upload handlers without affecting defaults", () => {
  interface HostAttachmentData {
    attachmentId: string;
  }

  const attachment: MessageComposerAttachment<HostAttachmentData> = {
    id: "a1",
    name: "spec.pdf",
    mimeType: "application/pdf",
    size: 42,
    status: "success",
    url: "https://files.example/spec.pdf",
    data: { attachmentId: "host-1" },
  };
  const value: MessageComposerValue<MessageComposerAgentValue, Record<string, unknown>, HostAttachmentData> = {
    ...createEmptyMessageComposerValue(),
    attachments: [attachment],
  };
  const upload: MessageComposerAttachmentUploadHandler<HostAttachmentData> = async () => ({
    url: "https://files.example/spec.pdf",
    data: { attachmentId: "host-2" },
  });

  expect(value.attachments[0].data?.attachmentId).toBe("host-1");
  expect(attachmentsPlugin({ upload }).id).toBe("attachments");
  expect(
    attachmentsPlugin({
      upload: async () => ({ url: "https://files.example/backwards-compatible" }),
    }).id
  ).toBe("attachments");
});
