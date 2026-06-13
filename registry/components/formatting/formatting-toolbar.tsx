import { Popover } from "@base-ui-components/react/popover";
import { Toggle } from "@base-ui-components/react/toggle";
import { Toolbar } from "@base-ui-components/react/toolbar";
import { lexicalEditor$, useCellValue, usePublisher } from "@mdxeditor/message-composer";
import {
  beginLinkEdit$,
  currentLink$,
  editLink$,
  formattingState$,
  formatText$,
  removeLink$,
  toggleBlock$,
  type MessageComposerBlockType,
  type MessageComposerTextFormat,
} from "@mdxeditor/message-composer/plugins/formatting";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { cn } from "../../lib/utils.ts";

function BoldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5 8h3.5a2.5 2.5 0 000-5H5v10h4.25a2.5 2.5 0 000-5H5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.5 3h6M3.5 13h6M10.5 3l-5 10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StrikethroughIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11.2 4.3C10.7 3.5 9.6 3 8.2 3 6.3 3 5.1 3.9 5.1 5.2c0 .5.2 1 .5 1.3M5 11.6c.5.9 1.6 1.4 3 1.4 2 0 3.2-.9 3.2-2.3 0-.5-.1-.9-.4-1.2M3 8h10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 5L3 8l3 3M10 5l3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6.7 4.7l.7-.7a3 3 0 014.2 4.2l-.9.9a3 3 0 01-4.2 0M9.3 11.3l-.7.7a3 3 0 01-4.2-4.2l.9-.9a3 3 0 014.2 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CodeBlockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.8" y="2.8" width="12.4" height="10.4" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6.2 6.2L4.4 8l1.8 1.8M9.8 6.2L11.6 8l-1.8 1.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function QuoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M7 4.5C4.8 5.1 3.5 6.7 3.5 9v2.5H7V8H5.2c.1-1.4.9-2.3 2.3-2.7zM13 4.5c-2.2.6-3.5 2.2-3.5 4.5v2.5H13V8h-1.8c.1-1.4.9-2.3 2.3-2.7z" />
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.5 4h7M6.5 8h7M6.5 12h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="3.2" cy="4" r="1" fill="currentColor" />
      <circle cx="3.2" cy="8" r="1" fill="currentColor" />
      <circle cx="3.2" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function NumberedListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M7 4.5h6.5M7 8h6.5M7 11.5h6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path
        d="M2.5 3.4l1-.6v3.4M2.4 9.3c0-.7.6-1.1 1.2-1.1.7 0 1.1.5 1.1 1 0 1-2.3 1.6-2.3 2.7h2.4"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const toggleClassName = cn(
  "flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none select-none",
  "hover:bg-accent hover:text-accent-foreground",
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  "data-[pressed]:bg-accent data-[pressed]:text-accent-foreground",
  "disabled:pointer-events-none disabled:opacity-50"
);

function FormatToggle({
  label,
  pressed,
  onToggle,
  children,
}: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <Toolbar.Button
      render={
        <Toggle aria-label={label} pressed={pressed} onPressedChange={onToggle} className={toggleClassName}>
          {children}
        </Toggle>
      }
    />
  );
}

const TEXT_FORMATS: { format: MessageComposerTextFormat; label: string; icon: ReactNode }[] = [
  { format: "bold", label: "Bold", icon: <BoldIcon /> },
  { format: "italic", label: "Italic", icon: <ItalicIcon /> },
  { format: "strikethrough", label: "Strikethrough", icon: <StrikethroughIcon /> },
  { format: "code", label: "Inline code", icon: <CodeIcon /> },
];

const BLOCK_TYPES: { blockType: Exclude<MessageComposerBlockType, "paragraph">; label: string; icon: ReactNode }[] = [
  { blockType: "quote", label: "Quote", icon: <QuoteIcon /> },
  { blockType: "code", label: "Code block", icon: <CodeBlockIcon /> },
  { blockType: "ul", label: "Bullet list", icon: <BulletListIcon /> },
  { blockType: "ol", label: "Numbered list", icon: <NumberedListIcon /> },
];

function LinkControl() {
  const triggerId = useId();
  const currentLink = useCellValue(currentLink$);
  const editor = useCellValue(lexicalEditor$);
  const beginLinkEdit = usePublisher(beginLinkEdit$);
  const editLink = usePublisher(editLink$);
  const removeLink = usePublisher(removeLink$);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");

  const virtualAnchor = useMemo(() => {
    const rect = currentLink?.anchorRect;
    if (!rect) {
      return null;
    }
    return {
      getBoundingClientRect: () => ({
        ...rect,
        x: rect.left,
        y: rect.top,
        toJSON: () => rect,
      }),
    };
  }, [currentLink?.anchorRect]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setUrl(currentLink?.url ?? "");
    setText(currentLink?.text ?? "");
    queueMicrotask(() => inputRef.current?.focus());
  }, [currentLink?.linkKey, currentLink?.text, currentLink?.url, open]);

  const restoreFocus = () => {
    queueMicrotask(() => editor?.focus());
  };

  return (
    <Popover.Root
      open={open}
      triggerId={triggerId}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          beginLinkEdit();
        }
        setOpen(nextOpen);
      }}
    >
      <Toolbar.Button
        render={
          <Popover.Trigger
            id={triggerId}
            aria-label="Link"
            className={toggleClassName}
            data-pressed={currentLink || open ? "" : undefined}
          >
            <LinkIcon />
          </Popover.Trigger>
        }
      />
      <Popover.Portal>
        <Popover.Positioner anchor={virtualAnchor} side="top" align="center" sideOffset={8} collisionPadding={8}>
          <Popover.Popup
            initialFocus={inputRef}
            finalFocus={false}
            className={cn(
              "z-50 grid w-72 gap-2 rounded-md border border-border bg-popover p-3 text-sm text-popover-foreground shadow-md",
              "outline-none"
            )}
          >
            <form
              aria-label={currentLink ? "Edit link" : "Create link"}
              className="grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                editLink({ url, text: currentLink ? text : undefined });
                setOpen(false);
                restoreFocus();
              }}
            >
              <label className="grid gap-1 text-xs font-medium">
                URL
                <input
                  ref={inputRef}
                  aria-label="Link URL"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  className={cn(
                    "h-8 rounded-md border border-input bg-background px-2 text-sm outline-none",
                    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  )}
                />
              </label>
              {currentLink ? (
                <label className="grid gap-1 text-xs font-medium">
                  Text
                  <input
                    aria-label="Link text"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    className={cn(
                      "h-8 rounded-md border border-input bg-background px-2 text-sm outline-none",
                      "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    )}
                  />
                </label>
              ) : null}
              <div className="flex items-center justify-end gap-2 pt-1">
                {currentLink ? (
                  <button
                    type="button"
                    className="h-8 rounded-md px-2 text-sm text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      removeLink();
                      setOpen(false);
                      restoreFocus();
                    }}
                  >
                    Remove link
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={url.trim().length === 0}
                  className={cn(
                    "h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground",
                    "hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                  )}
                >
                  Apply link
                </button>
              </div>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function FormattingToolbar({ className }: { className?: string }) {
  const state = useCellValue(formattingState$);
  const format = usePublisher(formatText$);
  const block = usePublisher(toggleBlock$);

  return (
    <Toolbar.Root
      aria-label="Formatting"
      // Keeps focus (and the live selection) in the editor while clicking
      // controls; keyboard focus via Tab and arrow keys is unaffected.
      onMouseDown={(event) => event.preventDefault()}
      className={cn("flex items-center gap-0.5 border-b border-input px-1.5 py-1", className)}
    >
      {TEXT_FORMATS.map(({ format: textFormat, label, icon }) => (
        <FormatToggle key={textFormat} label={label} pressed={state[textFormat]} onToggle={() => format(textFormat)}>
          {icon}
        </FormatToggle>
      ))}
      <LinkControl />
      <Toolbar.Separator className="mx-1 h-5 w-px bg-border" />
      {BLOCK_TYPES.map(({ blockType, label, icon }) => (
        <FormatToggle
          key={blockType}
          label={label}
          pressed={state.blockType === blockType}
          onToggle={() => block(blockType)}
        >
          {icon}
        </FormatToggle>
      ))}
    </Toolbar.Root>
  );
}
