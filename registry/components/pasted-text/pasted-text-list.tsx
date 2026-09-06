import { Dialog } from "@base-ui/react/dialog";
import { disabled$, useCellValue, usePublisher } from "@mdxeditor/message-composer";
import {
  expandPastedText$,
  pastedTexts$,
  pastedTextLineCount,
  removePastedText$,
  updatePastedText$,
  type MessageComposerPastedText,
} from "@mdxeditor/message-composer/plugins/pasted-text";
import { useState } from "react";

import { cn } from "@/lib/utils";

const actionClass =
  "rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50";

function PastedTextItem({ item, index }: { item: MessageComposerPastedText; index: number }) {
  const disabled = useCellValue(disabled$);
  const update = usePublisher(updatePastedText$);
  const remove = usePublisher(removePastedText$);
  const expand = usePublisher(expandPastedText$);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const [copyStatus, setCopyStatus] = useState("");
  const label = `Pasted text ${index + 1}`;
  const close = () => {
    setOpen(false);
    setEditing(false);
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setEditing(false);
        setText(item.text);
        setCopyStatus("");
      }}
    >
      <span className="inline-flex max-w-full items-center rounded-lg border border-input bg-muted/40">
        <Dialog.Trigger
          aria-label={`Expand ${label.toLowerCase()}`}
          className="flex min-w-0 items-center gap-2 rounded-l-lg px-3 py-2 text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span aria-hidden="true" className="font-mono text-muted-foreground">
            ≡
          </span>
          <span className="font-medium">Pasted text</span>
          <span className="text-xs text-muted-foreground">{pastedTextLineCount(item.text)} lines</span>
        </Dialog.Trigger>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Insert ${label.toLowerCase()} into message`}
          onClick={() => expand(item.id)}
          className="rounded px-2 py-1 text-xs font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          Insert
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Remove ${label.toLowerCase()}`}
          onClick={() => remove(item.id)}
          className="mr-1 rounded px-2 py-1 text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          ×
        </button>
      </span>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/35" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 flex max-h-[85dvh] w-[min(48rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border border-border bg-background p-5 text-foreground shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold">{label}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {pastedTextLineCount(item.text)} lines · {item.text.length.toLocaleString()} characters
              </Dialog.Description>
            </div>
            <Dialog.Close aria-label="Close pasted text" className={actionClass}>
              Close
            </Dialog.Close>
          </div>
          {editing ? (
            <textarea
              aria-label="Edit pasted text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={disabled}
              spellCheck={false}
              className="min-h-48 flex-1 resize-y rounded-md border border-input bg-muted/30 p-4 font-mono text-sm leading-6 outline-ring"
            />
          ) : (
            <pre
              aria-label="Pasted text content"
              className="min-h-24 overflow-auto rounded-md border border-border bg-muted/30 p-4 font-mono text-sm leading-6 whitespace-pre"
            >
              {item.text}
            </pre>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <output className="mr-auto text-sm text-muted-foreground">{copyStatus}</output>
            {editing ? (
              <>
                <button type="button" className={actionClass} onClick={() => setEditing(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className={cn(actionClass, "bg-foreground text-background hover:opacity-90")}
                  onClick={() => {
                    update({ id: item.id, text });
                    setEditing(false);
                  }}
                >
                  Save changes
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={actionClass}
                  onClick={() => {
                    void navigator.clipboard.writeText(item.text).then(
                      () => setCopyStatus("Copied"),
                      () => setCopyStatus("Could not copy. Select the text and copy it manually.")
                    );
                  }}
                >
                  Copy text
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className={actionClass}
                  onClick={() => {
                    setText(item.text);
                    setEditing(true);
                  }}
                >
                  Edit text
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className={actionClass}
                  onClick={() => {
                    close();
                    expand(item.id);
                  }}
                >
                  Insert into message
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  className={actionClass}
                  onClick={() => {
                    close();
                    remove(item.id);
                  }}
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function PastedTextList({ className }: { className?: string }) {
  const items = useCellValue(pastedTexts$);
  if (items.length === 0) {
    return null;
  }
  return (
    <div aria-label="Pasted texts" className={cn("flex flex-wrap gap-2 p-3", className)}>
      {items.map((item, index) => (
        <PastedTextItem key={item.id} item={item} index={index} />
      ))}
    </div>
  );
}
