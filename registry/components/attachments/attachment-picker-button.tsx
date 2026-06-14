import { disabled$, useCellValue, usePublisher } from "@mdxeditor/message-composer";
import { openAttachmentPicker$ } from "@mdxeditor/message-composer/plugins/attachments";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

function PaperclipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13.2 7.3l-5 5a3.2 3.2 0 01-4.5-4.5l5.6-5.6a2.1 2.1 0 013 3l-5.6 5.6a1.05 1.05 0 01-1.5-1.5l5-5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AttachmentPickerButton({ className, children }: { className?: string; children?: ReactNode }) {
  const disabled = useCellValue(disabled$);
  const openPicker = usePublisher(openAttachmentPicker$);

  return (
    <button
      type="button"
      aria-label="Add attachments"
      disabled={disabled}
      onClick={() => openPicker()}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none select-none",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      {children ?? <PaperclipIcon />}
    </button>
  );
}
