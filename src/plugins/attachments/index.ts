import { Cell, e, Stream, Trigger } from "@virtuoso.dev/reactive-engine-core";
import { COMMAND_PRIORITY_HIGH, DRAGOVER_COMMAND, DROP_COMMAND, PASTE_COMMAND, type LexicalEditor } from "lexical";

import {
  attachments$,
  clearSubmitBlocker$,
  disabled$,
  draftValue$,
  editorChange$,
  reset$,
  setSubmitBlocker$,
} from "../../core/nodes.ts";
import type { MessageComposerPlugin } from "../../core/plugin.ts";
import type {
  MessageComposerAgentValue,
  MessageComposerAttachment,
  MessageComposerAudioClip,
  MessageComposerMention,
  MessageComposerValue,
} from "../../core/value.ts";
import { lexicalEditor$ } from "../../lexical/nodes.ts";

export { attachments$ };
export type { MessageComposerAttachment, MessageComposerAttachmentStatus } from "../../core/value.ts";

export interface MessageComposerAttachmentUploadContext<TData = unknown> {
  /** Snapshot of the attachment record at upload start. */
  attachment: MessageComposerAttachment<TData>;
  /** Aborted when the attachment is removed or the composer disposes (ADR 0011). */
  signal: AbortSignal;
  /** Reports upload progress as a 0-1 fraction. */
  onProgress: (progress: number) => void;
}

export interface MessageComposerAttachmentUploadResult<TData = unknown> {
  url: string;
  data?: TData;
}

export type MessageComposerAttachmentUploadHandler<TData = unknown> = (
  file: File,
  context: MessageComposerAttachmentUploadContext<TData>
) => Promise<MessageComposerAttachmentUploadResult<TData>>;

export type MessageComposerAttachmentRejectionCode =
  | "file-too-large"
  | "total-file-size-exceeded"
  | "type-not-accepted"
  | "too-many-files"
  | "custom";

export interface MessageComposerAttachmentRejection {
  file: File;
  code: MessageComposerAttachmentRejectionCode;
  message: string;
}

export type MessageComposerAttachmentValidationDraft<TData = unknown> = Omit<
  Readonly<MessageComposerValue<MessageComposerAgentValue, Record<string, unknown>, TData>>,
  "attachments" | "mentions" | "audioClips"
> & {
  readonly attachments: readonly Readonly<MessageComposerAttachment<TData>>[];
  readonly mentions: readonly Readonly<MessageComposerMention>[];
  readonly audioClips: readonly Readonly<MessageComposerAudioClip>[];
};

export interface MessageComposerAttachmentValidationContext<TData = unknown> {
  /** Immutable snapshot of the draft before this ingestion batch. */
  readonly draft: MessageComposerAttachmentValidationDraft<TData>;
  /** Files accepted earlier in the current batch. */
  readonly acceptedFiles: readonly File[];
  /** Existing draft bytes plus files accepted earlier in the current batch. */
  readonly totalFileSize: number;
}

export interface MessageComposerAttachmentRemoval<TData = unknown> {
  attachment: MessageComposerAttachment<TData>;
  reason: "explicit-removal";
}

export interface MessageComposerAttachmentsConfig<TData = unknown> {
  upload: MessageComposerAttachmentUploadHandler<TData>;
  /** File-input accept string; also validates dropped and pasted files. */
  accept?: string;
  /** Per-file size limit in bytes. */
  maxFileSize?: number;
  /** Aggregate size limit for existing and newly accepted draft attachments. */
  maxTotalFileSize?: number;
  /** Maximum number of attachments in the draft. */
  maxCount?: number;
  /** Whether the picker allows selecting multiple files. Defaults to true. */
  multiple?: boolean;
  /** Returns an error message to reject the file; falsy accepts it. */
  validate?: (file: File, context: MessageComposerAttachmentValidationContext<TData>) => string | null | undefined;
}

/** Validated ingestion entry; the picker, drop, and paste handlers all feed it. */
export const addAttachmentFiles$ = Stream<File[]>(false);

/** Removes the attachment from the draft and aborts its in-flight upload. */
export const removeAttachment$ = Stream<string>(false);

/** Accepted explicit removals, including the complete pre-removal snapshot. */
export const attachmentRemoved$ = Stream<MessageComposerAttachmentRemoval>(false);

/** Re-runs the upload for an `error` attachment that still has its local file. */
export const retryAttachmentUpload$ = Stream<string>(false);

/** Opens the plugin-managed hidden file input next to the editor. */
export const openAttachmentPicker$ = Trigger();

/** Files rejected by the last ingestion; never part of the value (ADR 0011). */
export const attachmentRejections$ = Cell<MessageComposerAttachmentRejection[]>([]);

export const dismissAttachmentRejections$ = Trigger();

const appendAttachments$ = Stream<MessageComposerAttachment[]>(false);
const patchAttachment$ = Stream<{ id: string; patch: Partial<MessageComposerAttachment> }>(false);

// Attachment changes are draft edits (ADR 0011): routing through editorChange$
// commits them when uncontrolled and emits them for the host to echo when
// controlled, matching agent-settings selections and typing.
e.link(
  e.pipe(
    appendAttachments$,
    e.withLatestFrom(draftValue$),
    e.map(([records, draft]) => ({ ...draft, attachments: [...draft.attachments, ...records] }))
  ),
  editorChange$
);

// Async upload events patch by id against the draft current at that moment; a
// missing id (removed, or never echoed by a strict-controlled host) drops the
// transition instead of resurrecting the attachment.
e.link(
  e.pipe(
    patchAttachment$,
    e.withLatestFrom(draftValue$),
    e.map(([{ id, patch }, draft]): MessageComposerValue | null => {
      const index = draft.attachments.findIndex((attachment) => attachment.id === id);
      if (index === -1) {
        return null;
      }
      const attachments = [...draft.attachments];
      attachments[index] = { ...attachments[index], ...patch };
      return { ...draft, attachments };
    }),
    e.filter((value): value is MessageComposerValue => value !== null)
  ),
  editorChange$
);

e.sub(dismissAttachmentRejections$, (_, engine) => {
  engine.pub(attachmentRejections$, []);
});

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString("en-US", { maximumFractionDigits: 1 })} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function acceptMatchers(accept: string): ((file: File) => boolean)[] {
  return accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token.length > 0)
    .map((token) => {
      if (token.startsWith(".")) {
        return (file: File) => file.name.toLowerCase().endsWith(token);
      }
      if (token.endsWith("/*")) {
        const prefix = token.slice(0, -1);
        return (file: File) => file.type.toLowerCase().startsWith(prefix);
      }
      return (file: File) => file.type.toLowerCase() === token;
    });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createAttachmentRecord<TData>(file: File): MessageComposerAttachment<TData> {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mimeType: file.type,
    size: file.size,
    status: "uploading",
    file,
  };
}

function dataTransferCarriesFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes("Files") ?? false;
}

function immutableDraftSnapshot<TData>(draft: MessageComposerValue): MessageComposerAttachmentValidationDraft<TData> {
  return Object.freeze({
    ...draft,
    attachments: Object.freeze(
      draft.attachments.map((attachment) => Object.freeze({ ...attachment }))
    ) as readonly Readonly<MessageComposerAttachment<TData>>[],
    mentions: Object.freeze(draft.mentions.map((mention) => Object.freeze({ ...mention }))),
    audioClips: Object.freeze(draft.audioClips.map((clip) => Object.freeze({ ...clip }))),
    ...(draft.extensions === undefined ? {} : { extensions: Object.freeze({ ...draft.extensions }) }),
    ...(draft.agent === undefined ? {} : { agent: Object.freeze({ ...draft.agent }) }),
  });
}

const ATTACHMENT_SUBMIT_BLOCKER_ID = "attachments:not-ready";

export function attachmentsPlugin<TData = unknown>(
  config: MessageComposerAttachmentsConfig<TData>
): MessageComposerPlugin {
  const multiple = config.multiple ?? true;
  const matchers = config.accept === undefined ? null : acceptMatchers(config.accept);

  return {
    id: "attachments",
    init: ({ engine }) => {
      const controllers = new Map<string, AbortController>();
      let pickerInput: HTMLInputElement | null = null;
      let cleanupEditor: (() => void) | null = null;

      const updateSubmitBlocker = (draft: MessageComposerValue) => {
        const blocked = draft.attachments.some(
          (attachment) =>
            attachment.status === "pending" || attachment.status === "uploading" || attachment.status === "error"
        );
        if (blocked) {
          engine.pub(setSubmitBlocker$, {
            id: ATTACHMENT_SUBMIT_BLOCKER_ID,
            message: "Resolve or remove attachments before submitting.",
          });
        } else {
          engine.pub(clearSubmitBlocker$, ATTACHMENT_SUBMIT_BLOCKER_ID);
        }
      };

      const abortUpload = (id: string) => {
        const controller = controllers.get(id);
        if (controller) {
          controllers.delete(id);
          controller.abort();
        }
      };

      const abortAllUploads = () => {
        for (const id of controllers.keys()) {
          abortUpload(id);
        }
      };

      const startUpload = (record: MessageComposerAttachment<TData>, file: File) => {
        const controller = new AbortController();
        controllers.set(record.id, controller);
        // Settlements of aborted (removed) or disposed uploads are discarded, so
        // correctness never depends on the host honoring the signal (ADR 0011).
        const finish = (patch: Partial<MessageComposerAttachment>) => {
          if (controller.signal.aborted || engine.isDisposed) {
            return;
          }
          controllers.delete(record.id);
          engine.pub(patchAttachment$, { id: record.id, patch });
        };
        const onProgress = (progress: number) => {
          if (controller.signal.aborted || engine.isDisposed) {
            return;
          }
          const current = engine.getValue(draftValue$).attachments.find((entry) => entry.id === record.id);
          if (current?.status !== "uploading") {
            return;
          }
          engine.pub(patchAttachment$, {
            id: record.id,
            patch: { progress: Math.min(1, Math.max(0, progress)) },
          });
        };
        let result: Promise<MessageComposerAttachmentUploadResult<TData>>;
        try {
          result = config.upload(file, { attachment: record, signal: controller.signal, onProgress });
        } catch (error) {
          finish({ status: "error", error: errorMessage(error), progress: undefined });
          return;
        }
        void result.then(
          ({ url, data }) => {
            finish({ status: "success", url, data, progress: undefined, error: undefined });
          },
          (error: unknown) => {
            finish({ status: "error", error: errorMessage(error), progress: undefined });
          }
        );
      };

      const validateFile = (
        file: File,
        currentCount: number,
        totalFileSize: number,
        acceptedFiles: readonly File[],
        draft: MessageComposerAttachmentValidationDraft<TData>
      ): MessageComposerAttachmentRejection | null => {
        if (config.maxCount !== undefined && currentCount >= config.maxCount) {
          return {
            file,
            code: "too-many-files",
            message: `No more than ${config.maxCount} ${config.maxCount === 1 ? "attachment is" : "attachments are"} allowed.`,
          };
        }
        if (matchers && !matchers.some((matches) => matches(file))) {
          return { file, code: "type-not-accepted", message: `"${file.name}" is not an accepted file type.` };
        }
        if (config.maxFileSize !== undefined && file.size > config.maxFileSize) {
          return {
            file,
            code: "file-too-large",
            message: `"${file.name}" exceeds the ${formatSize(config.maxFileSize)} limit.`,
          };
        }
        if (config.maxTotalFileSize !== undefined && totalFileSize + file.size > config.maxTotalFileSize) {
          return {
            file,
            code: "total-file-size-exceeded",
            message: `Adding "${file.name}" would exceed the ${formatSize(config.maxTotalFileSize)} draft limit.`,
          };
        }
        const custom = config.validate?.(
          file,
          Object.freeze({
            draft,
            acceptedFiles: Object.freeze([...acceptedFiles]),
            totalFileSize,
          })
        );
        if (custom) {
          return { file, code: "custom", message: custom };
        }
        return null;
      };

      const unsubAdd = engine.sub(addAttachmentFiles$, (files) => {
        if (engine.getValue(disabled$) || files.length === 0) {
          return;
        }
        const rejections: MessageComposerAttachmentRejection[] = [];
        const accepted: { record: MessageComposerAttachment<TData>; file: File }[] = [];
        const currentDraft = engine.getValue(draftValue$);
        const validationDraft = immutableDraftSnapshot<TData>(currentDraft);
        const acceptedFiles: File[] = [];
        let count = currentDraft.attachments.length;
        let totalFileSize = currentDraft.attachments.reduce((total, attachment) => total + attachment.size, 0);
        for (const file of files) {
          const rejection = validateFile(file, count, totalFileSize, acceptedFiles, validationDraft);
          if (rejection) {
            rejections.push(rejection);
            continue;
          }
          accepted.push({ record: createAttachmentRecord(file), file });
          acceptedFiles.push(file);
          count += 1;
          totalFileSize += file.size;
        }
        // Each ingestion replaces the rejection batch, so a later valid add clears
        // stale errors without a separate dismissal.
        if (rejections.length > 0 || engine.getValue(attachmentRejections$).length > 0) {
          engine.pub(attachmentRejections$, rejections);
        }
        if (accepted.length > 0) {
          engine.pub(
            appendAttachments$,
            accepted.map((entry) => entry.record)
          );
          for (const entry of accepted) {
            startUpload(entry.record, entry.file);
          }
        }
      });

      const unsubRetry = engine.sub(retryAttachmentUpload$, (id) => {
        if (engine.getValue(disabled$)) {
          return;
        }
        const attachment = engine.getValue(draftValue$).attachments.find((entry) => entry.id === id);
        if (!attachment?.file || attachment.status !== "error" || controllers.has(id)) {
          return;
        }
        const record: MessageComposerAttachment<TData> = {
          ...(attachment as MessageComposerAttachment<TData>),
          status: "uploading",
          error: undefined,
          progress: undefined,
        };
        engine.pub(patchAttachment$, { id, patch: { status: "uploading", error: undefined, progress: undefined } });
        startUpload(record, attachment.file);
      });

      const unsubRemove = engine.sub(removeAttachment$, (id) => {
        const draft = engine.getValue(draftValue$);
        const attachment = draft.attachments.find((entry) => entry.id === id);
        if (!attachment) {
          return;
        }
        abortUpload(id);
        engine.pub(editorChange$, {
          ...draft,
          attachments: draft.attachments.filter((entry) => entry.id !== id),
        });
        engine.pub(attachmentRemoved$, {
          attachment: attachment as MessageComposerAttachment<TData>,
          reason: "explicit-removal",
        });
      });

      updateSubmitBlocker(engine.getValue(draftValue$));
      const unsubDraft = engine.sub(draftValue$, (draft) => {
        updateSubmitBlocker(draft);
        for (const [id, controller] of controllers) {
          const attachment = draft.attachments.find((entry) => entry.id === id);
          if (!attachment || attachment.status !== "uploading") {
            controllers.delete(id);
            controller.abort();
          }
        }
      });

      const unsubReset = engine.sub(reset$, () => {
        abortAllUploads();
      });

      const unsubPicker = engine.sub(openAttachmentPicker$, () => {
        if (!engine.getValue(disabled$)) {
          pickerInput?.click();
        }
      });

      const attachToEditor = (editor: LexicalEditor): (() => void) => {
        const rootElement = editor.getRootElement();
        if (rootElement) {
          const input = rootElement.ownerDocument.createElement("input");
          input.type = "file";
          input.multiple = multiple;
          if (config.accept !== undefined) {
            input.accept = config.accept;
          }
          input.style.display = "none";
          input.tabIndex = -1;
          input.dataset.messageComposerAttachmentInput = "";
          input.addEventListener("change", () => {
            const files = input.files ? [...input.files] : [];
            // Clearing lets the same file be picked again later.
            input.value = "";
            if (files.length > 0) {
              engine.pub(addAttachmentFiles$, files);
            }
          });
          rootElement.insertAdjacentElement("afterend", input);
          pickerInput = input;
        }

        const unsubs = [
          editor.registerCommand<DragEvent>(
            DRAGOVER_COMMAND,
            (event) => {
              // dragover must be prevented for the drop event to fire; the file
              // list itself is only readable on drop.
              if (engine.getValue(disabled$) || !dataTransferCarriesFiles(event)) {
                return false;
              }
              event.preventDefault();
              return true;
            },
            COMMAND_PRIORITY_HIGH
          ),
          editor.registerCommand<DragEvent>(
            DROP_COMMAND,
            (event) => {
              const files = event.dataTransfer?.files;
              if (engine.getValue(disabled$) || !files || files.length === 0) {
                return false;
              }
              event.preventDefault();
              engine.pub(addAttachmentFiles$, [...files]);
              return true;
            },
            COMMAND_PRIORITY_HIGH
          ),
          editor.registerCommand(
            PASTE_COMMAND,
            (event) => {
              const files = event instanceof ClipboardEvent ? event.clipboardData?.files : null;
              if (engine.getValue(disabled$) || !files || files.length === 0) {
                return false;
              }
              event.preventDefault();
              engine.pub(addAttachmentFiles$, [...files]);
              return true;
            },
            COMMAND_PRIORITY_HIGH
          ),
        ];

        return () => {
          for (const unsub of unsubs) {
            unsub();
          }
          pickerInput?.remove();
          pickerInput = null;
        };
      };

      const unsubEditor = engine.sub(lexicalEditor$, (editor: LexicalEditor | null) => {
        cleanupEditor?.();
        cleanupEditor = null;
        if (editor) {
          cleanupEditor = attachToEditor(editor);
        }
      });

      return () => {
        unsubAdd();
        unsubRetry();
        unsubRemove();
        unsubDraft();
        unsubReset();
        unsubPicker();
        unsubEditor();
        cleanupEditor?.();
        abortAllUploads();
        if (!engine.isDisposed) {
          engine.pub(clearSubmitBlocker$, ATTACHMENT_SUBMIT_BLOCKER_ID);
        }
      };
    },
  };
}
