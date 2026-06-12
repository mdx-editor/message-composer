export interface MessageComposerValue {
  markdown: string;
}

export function createEmptyMessageComposerValue(): MessageComposerValue {
  return {
    markdown: "",
  };
}
