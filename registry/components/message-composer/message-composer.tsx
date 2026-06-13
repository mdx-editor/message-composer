import {
  MessageComposer as CoreMessageComposer,
  type MessageComposerHandle,
  type MessageComposerProps as CoreMessageComposerProps,
  type MessageComposerValue,
} from "@mdxeditor/message-composer";
import { forwardRef, type ReactElement, type Ref, type RefAttributes } from "react";

import { cn } from "../../lib/utils.ts";

export interface MessageComposerProps<
  TValue extends MessageComposerValue = MessageComposerValue,
> extends CoreMessageComposerProps<TValue> {
  className?: string;
  editorClassName?: string;
}

function MessageComposerImpl<TValue extends MessageComposerValue = MessageComposerValue>(
  { className, editorClassName, editorProps, ...props }: MessageComposerProps<TValue>,
  ref: Ref<MessageComposerHandle>
) {
  const { className: editorPropsClassName, ...restEditorProps } = editorProps ?? {};

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-input bg-background text-foreground shadow-xs",
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        "[--message-composer-placeholder-left:0.75rem]",
        "[--message-composer-placeholder-opacity:1]",
        "[--message-composer-placeholder-top:0.5rem]",
        "[&_.message-composer-placeholder]:text-muted-foreground",
        className
      )}
    >
      <CoreMessageComposer
        {...props}
        ref={ref}
        editorProps={{
          ...restEditorProps,
          className: cn(
            "min-h-24 max-h-52 w-full overflow-y-auto px-3 py-2 text-sm leading-6 outline-none",
            // Tailwind preflight strips list markers and indentation; restore
            // them for the list nodes Lexical renders inside the editor.
            "[&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_ul_ul]:list-[circle]",
            "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50",
            editorPropsClassName,
            editorClassName
          ),
        }}
      />
    </div>
  );
}

const MessageComposerForwardRef = forwardRef(MessageComposerImpl);
MessageComposerForwardRef.displayName = "MessageComposer";

export const MessageComposer = MessageComposerForwardRef as <
  TValue extends MessageComposerValue = MessageComposerValue,
>(
  props: MessageComposerProps<TValue> & RefAttributes<MessageComposerHandle>
) => ReactElement | null;

export type { MessageComposerHandle, MessageComposerValue };
