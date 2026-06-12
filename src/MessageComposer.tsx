import type { TextareaHTMLAttributes } from "react";

export type MessageComposerProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function MessageComposer(props: MessageComposerProps) {
  return <textarea {...props} />;
}
