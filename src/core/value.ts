export interface MessageComposerAgentValue {
  modelId?: string;
  effort?: string;
}

export type MessageComposerAttachmentStatus = "pending" | "uploading" | "success" | "error";

export interface MessageComposerAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  status: MessageComposerAttachmentStatus;
  /** Populated by the host upload handler on success. */
  url?: string;
  /** Upload progress as a 0-1 fraction, when the host reports it. */
  progress?: number;
  error?: string;
  /** The original picked/dropped/pasted file, while still available locally. */
  file?: File;
}

export interface MessageComposerMention {
  id: string;
  trigger: string;
  label: string;
  data?: unknown;
}

export type MessageComposerAudioClipStatus = "recording" | "processing" | "uploading" | "success" | "error";

export interface MessageComposerAudioClip {
  id: string;
  status: MessageComposerAudioClipStatus;
  durationMs?: number;
  url?: string;
  error?: string;
}

export interface MessageComposerValue<
  TAgent extends object = MessageComposerAgentValue,
  TExtensions extends object = Record<string, unknown>,
> {
  markdown: string;
  attachments: MessageComposerAttachment[];
  mentions: MessageComposerMention[];
  audioClips: MessageComposerAudioClip[];
  agent?: TAgent;
  extensions?: TExtensions;
}

export function createEmptyMessageComposerValue(): MessageComposerValue {
  return {
    markdown: "",
    attachments: [],
    mentions: [],
    audioClips: [],
  };
}
