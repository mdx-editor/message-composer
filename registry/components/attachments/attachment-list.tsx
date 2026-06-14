import { disabled$, useCellValue, useCellValues, usePublisher } from "@mdxeditor/message-composer";
import {
  attachmentRejections$,
  attachments$,
  dismissAttachmentRejections$,
  removeAttachment$,
  retryAttachmentUpload$,
  type MessageComposerAttachment,
} from "@mdxeditor/message-composer/plugins/attachments";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3.5 3.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M12 7a5 5 0 11-1.5-3.5M12 1v3h-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString("en-US", { maximumFractionDigits: 1 })} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) {
    return "file";
  }
  return name.slice(dot + 1, dot + 5);
}

function AttachmentThumb({ attachment }: { attachment: MessageComposerAttachment }) {
  const isImage = attachment.mimeType.startsWith("image/");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment.file || !isImage) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(attachment.file);
    setObjectUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [attachment.file, isImage]);

  const src = objectUrl ?? (isImage ? attachment.url : undefined);
  if (src) {
    return <img src={src} alt="" className="size-full object-cover" />;
  }
  return (
    <span className="flex size-full items-center justify-center bg-muted/50 text-[10px] font-medium uppercase text-muted-foreground">
      {extensionOf(attachment.name)}
    </span>
  );
}

function OverlayButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "absolute flex items-center justify-center rounded-full border border-input bg-background/90 shadow-xs",
        "text-muted-foreground outline-none backdrop-blur-sm",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className
      )}
    >
      {children}
    </button>
  );
}

function AttachmentItem({ attachment }: { attachment: MessageComposerAttachment }) {
  const disabled = useCellValue(disabled$);
  const remove = usePublisher(removeAttachment$);
  const retry = usePublisher(retryAttachmentUpload$);
  const percent = attachment.progress === undefined ? null : Math.round(attachment.progress * 100);
  const uploading = attachment.status === "uploading" || attachment.status === "pending";

  return (
    <li
      data-status={attachment.status}
      title={`${attachment.name} (${formatSize(attachment.size)})`}
      className={cn(
        "relative flex size-20 flex-col overflow-hidden rounded-lg border border-input bg-background shadow-xs",
        attachment.status === "error" && "border-destructive/50"
      )}
    >
      <div className={cn("relative min-h-0 flex-1", uploading && "opacity-60")}>
        <AttachmentThumb attachment={attachment} />
        {uploading ? (
          <progress
            aria-label={`Uploading ${attachment.name}`}
            max={100}
            value={percent ?? undefined}
            className={cn(
              "absolute inset-x-1.5 bottom-1 block h-1 appearance-none overflow-hidden rounded-full",
              "[&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary",
              "[&::-webkit-progress-value]:transition-[width] [&::-moz-progress-bar]:bg-primary"
            )}
          />
        ) : null}
        {!disabled && attachment.status === "error" && attachment.file ? (
          <OverlayButton
            label={`Retry ${attachment.name}`}
            onClick={() => retry(attachment.id)}
            className="left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2"
          >
            <RetryIcon />
          </OverlayButton>
        ) : null}
      </div>
      <div className="border-t border-input bg-background px-1 py-0.5">
        <div className="truncate text-[10px] leading-3.5">{attachment.name}</div>
        {attachment.status === "error" ? (
          <div className="truncate text-[10px] leading-3.5 text-destructive">{attachment.error ?? "Upload failed"}</div>
        ) : null}
      </div>
      {disabled ? null : (
        <OverlayButton
          label={`Remove ${attachment.name}`}
          onClick={() => remove(attachment.id)}
          className="right-0.5 top-0.5 size-5"
        >
          <CloseIcon />
        </OverlayButton>
      )}
    </li>
  );
}

export function AttachmentList({ className }: { className?: string }) {
  const [attachments, rejections] = useCellValues(attachments$, attachmentRejections$);
  const dismissRejections = usePublisher(dismissAttachmentRejections$);

  if (attachments.length === 0 && rejections.length === 0) {
    return null;
  }

  return (
    <div className={cn("grid gap-1.5 p-2", className)}>
      {attachments.length > 0 ? (
        <ul aria-label="Attachments" className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <AttachmentItem key={attachment.id} attachment={attachment} />
          ))}
        </ul>
      ) : null}
      {rejections.length > 0 ? (
        <div
          role="alert"
          className={cn(
            "flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2",
            "text-xs text-destructive"
          )}
        >
          <ul className="min-w-0 flex-1">
            {rejections.map((rejection, index) => (
              <li key={index} className="truncate">
                {rejection.message}
              </li>
            ))}
          </ul>
          <button
            type="button"
            aria-label="Dismiss attachment errors"
            onClick={() => dismissRejections()}
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded text-destructive outline-none",
              "hover:bg-destructive/15",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            )}
          >
            <CloseIcon />
          </button>
        </div>
      ) : null}
    </div>
  );
}
