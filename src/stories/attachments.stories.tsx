import { useState } from "react";

import { AttachmentList } from "../../registry/components/attachments/attachment-list.tsx";
import { AttachmentPickerButton } from "../../registry/components/attachments/attachment-picker-button.tsx";
import { MessageComposer as RegistryMessageComposer } from "../../registry/components/message-composer/message-composer.tsx";
import {
  MessageComposer as CoreMessageComposer,
  useCellValues,
  usePublisher,
  type MessageComposerValue,
} from "../index.ts";
import {
  addAttachmentFiles$,
  attachmentRejections$,
  attachments$,
  attachmentsPlugin,
  openAttachmentPicker$,
  removeAttachment$,
  retryAttachmentUpload$,
  type MessageComposerAttachmentUploadHandler,
} from "../plugins/attachments/index.ts";

import "./tailwind.css";

export default {
  title: "Attachments",
};

const layoutStyle = { display: "grid", gap: 8, maxWidth: 520 } as const;
const editorStyle = {
  border: "1px solid #d4d4d8",
  borderRadius: 6,
  padding: 8,
  minHeight: 80,
  maxHeight: 200,
  overflowY: "auto",
  outline: "none",
  "--message-composer-placeholder-left": "8px",
  "--message-composer-placeholder-top": "8px",
} as const;
const inspectorStyle = { background: "#f4f4f5", padding: 8, whiteSpace: "pre-wrap" } as const;

/**
 * Deterministic fake upload for stories and browser tests: progress ticks to
 * completion in ~200ms, file names containing "fail" reject on their first
 * attempt and succeed on retry, and aborts cancel the timer.
 */
function createStoryUpload(): MessageComposerAttachmentUploadHandler {
  const failedOnce = new Set<string>();
  return (file, { attachment, signal, onProgress }) =>
    new Promise((resolve, reject) => {
      const shouldFail = file.name.includes("fail") && !failedOnce.has(attachment.id);
      let step = 0;
      const timer = setInterval(() => {
        step += 1;
        if (step < 5) {
          onProgress(step / 5);
          return;
        }
        clearInterval(timer);
        if (shouldFail) {
          failedOnce.add(attachment.id);
          reject(new Error("Simulated upload failure"));
        } else {
          resolve({ url: `https://files.example/${encodeURIComponent(file.name)}` });
        }
      }, 40);
      signal.addEventListener("abort", () => {
        clearInterval(timer);
        reject(new Error("upload aborted"));
      });
    });
}

const RegistryAttachmentsHeader = () => <AttachmentList className="border-b border-input" />;

const RegistryAttachmentsFooter = () => (
  <div className="flex items-center border-t border-input px-1.5 py-1">
    <AttachmentPickerButton />
  </div>
);

const registrySlots = { header: RegistryAttachmentsHeader, footer: RegistryAttachmentsFooter };

const registryPlugins = [attachmentsPlugin({ upload: createStoryUpload() })];

export const RegistryUI = () => {
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <RegistryMessageComposer
        plugins={registryPlugins}
        slots={registrySlots}
        editorProps={{ "aria-label": "Message", placeholder: "Drop, paste, or pick files..." }}
        onSubmit={setSubmitted}
      />
      <pre data-testid="submitted" style={inspectorStyle}>
        {JSON.stringify(submitted)}
      </pre>
    </div>
  );
};

const validationPlugins = [
  attachmentsPlugin({
    upload: createStoryUpload(),
    accept: "image/*,.pdf",
    maxFileSize: 10 * 1024,
    maxCount: 2,
  }),
];

export const ValidationLimits = () => {
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <p style={{ margin: 0, fontSize: 13 }}>Accepts images and PDFs up to 10 KB, at most 2 attachments.</p>
      <RegistryMessageComposer
        plugins={validationPlugins}
        slots={registrySlots}
        editorProps={{ "aria-label": "Message", placeholder: "Try an oversized or non-image file..." }}
        onSubmit={setSubmitted}
      />
      <pre data-testid="submitted" style={inspectorStyle}>
        {JSON.stringify(submitted)}
      </pre>
    </div>
  );
};

// Custom UI over the exact same plugin contracts: no registry component, no
// Tailwind requirement — attachment cells in, ingestion/remove/retry commands out.
const CustomAttachmentControls = () => {
  const [attachments, rejections] = useCellValues(attachments$, attachmentRejections$);
  const addFiles = usePublisher(addAttachmentFiles$);
  const openPicker = usePublisher(openAttachmentPicker$);
  const remove = usePublisher(removeAttachment$);
  const retry = usePublisher(retryAttachmentUpload$);

  return (
    <div data-testid="custom-attachment-controls" style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="story-button" type="button" onClick={() => openPicker()}>
          Attach files
        </button>
        <input
          aria-label="Add files"
          type="file"
          multiple
          onChange={(event) => {
            const files = event.target.files ? [...event.target.files] : [];
            event.target.value = "";
            if (files.length > 0) {
              addFiles(files);
            }
          }}
        />
      </div>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {attachments.map((attachment) => (
          <li key={attachment.id} data-status={attachment.status}>
            {attachment.name} — {attachment.status}
            {attachment.progress === undefined ? "" : ` ${Math.round(attachment.progress * 100)}%`}
            {attachment.status === "error" ? ` (${attachment.error ?? "failed"})` : ""}
            {attachment.status === "error" && attachment.file ? (
              <button className="story-button" type="button" onClick={() => retry(attachment.id)}>
                Retry {attachment.name}
              </button>
            ) : null}
            <button className="story-button" type="button" onClick={() => remove(attachment.id)}>
              Remove {attachment.name}
            </button>
          </li>
        ))}
      </ul>
      {rejections.length > 0 ? (
        <div role="alert">{rejections.map((rejection) => rejection.message).join(" ")}</div>
      ) : null}
    </div>
  );
};

const customPlugins = [attachmentsPlugin({ upload: createStoryUpload() })];

export const CustomUI = () => {
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <CoreMessageComposer
        plugins={customPlugins}
        slots={{ footer: CustomAttachmentControls }}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message...", style: editorStyle }}
        onSubmit={setSubmitted}
      />
      <pre data-testid="submitted" style={inspectorStyle}>
        {JSON.stringify(submitted)}
      </pre>
    </div>
  );
};

// Host-authored attachments (no local file) render and submit; nothing is
// retryable or removable while the composer is disabled.
const hostAuthoredValue: MessageComposerValue = {
  markdown: "Review the attached spec.",
  attachments: [
    {
      id: "a1",
      name: "composer-spec.pdf",
      mimeType: "application/pdf",
      size: 48 * 1024,
      status: "success",
      url: "https://files.example/composer-spec.pdf",
    },
  ],
  mentions: [],
  audioClips: [],
};

const disabledPlugins = [attachmentsPlugin({ upload: createStoryUpload() })];

export const DisabledWithHostValue = () => (
  <div style={layoutStyle}>
    <RegistryMessageComposer
      disabled
      plugins={disabledPlugins}
      defaultValue={hostAuthoredValue}
      slots={registrySlots}
      editorProps={{ "aria-label": "Message" }}
    />
  </div>
);
