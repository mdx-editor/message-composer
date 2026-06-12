export {
  MessageComposer,
  type MessageComposerEditorProps,
  type MessageComposerHandle,
  type MessageComposerProps,
} from "./react/MessageComposer.tsx";

export {
  createEmptyMessageComposerValue,
  type MessageComposerAgentValue,
  type MessageComposerAttachment,
  type MessageComposerAttachmentStatus,
  type MessageComposerAudioClip,
  type MessageComposerAudioClipStatus,
  type MessageComposerMention,
  type MessageComposerValue,
} from "./core/value.ts";

export {
  agent$,
  attachments$,
  audioClips$,
  disabled$,
  draftValue$,
  editorChange$,
  markdown$,
  mentions$,
  reset$,
  setMarkdown$,
  submit$,
  submitError$,
  submitting$,
  valueChange$,
  type MessageComposerSubmitHandler,
} from "./core/nodes.ts";

export { lexicalEditor$ } from "./lexical/nodes.ts";

export type { MessageComposerFeature, MessageComposerFeatureContext, MessageComposerSlots } from "./core/feature.ts";

export {
  useCell,
  useCellValue,
  useCellValues,
  useEngineRef,
  usePublisher,
  useRemoteCell,
  useRemoteCellValue,
  useRemoteCellValues,
  useRemotePublisher,
  type EngineRef,
} from "@virtuoso.dev/reactive-engine-react";
