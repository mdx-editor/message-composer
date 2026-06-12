import type { MessageComposerMentionTokenProps } from "@mdxeditor/message-composer/plugins/mentions";

import { cn } from "../../lib/utils.ts";

export function MentionToken({ trigger, label, className }: MessageComposerMentionTokenProps & { className?: string }) {
  return (
    <span className={cn("rounded bg-accent px-1 py-0.5 text-sm font-medium text-accent-foreground", className)}>
      {trigger}
      {label}
    </span>
  );
}
