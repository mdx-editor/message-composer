export { MessageComposer, type MessageComposerProps } from "./MessageComposer.tsx";

export interface MessageComposerValue {
  markdown: string;
}

export function createEmptyMessageComposerValue(): MessageComposerValue {
  return {
    markdown: "",
  };
}
