import { useCellValues, usePublisher } from "@mdxeditor/message-composer";
import {
  insertMention$,
  mentionAnchorRect$,
  mentionError$,
  mentionHighlight$,
  mentionLoading$,
  mentionMenu$,
  mentionResults$,
} from "@mdxeditor/message-composer/plugins/mentions";

import { cn } from "@/lib/utils";

export function MentionMenu({ className }: { className?: string }) {
  const [menu, rect, results, loading, error, highlight] = useCellValues(
    mentionMenu$,
    mentionAnchorRect$,
    mentionResults$,
    mentionLoading$,
    mentionError$,
    mentionHighlight$
  );
  const highlightOption = usePublisher(mentionHighlight$);
  const insert = usePublisher(insertMention$);

  if (!menu || !rect) {
    return null;
  }

  // Buttons instead of listbox/option roles: keyboard interaction stays in the
  // editor (the keyboard plugin drives the highlight), so options are never
  // focused, and mousedown is prevented to keep the editor selection intact.
  return (
    <div
      aria-label="Mention suggestions"
      style={{ position: "fixed", left: rect.left, top: rect.bottom + 4 }}
      className={cn(
        "z-50 max-h-64 min-w-48 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        className
      )}
    >
      {loading && results.length === 0 ? (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">Searching…</div>
      ) : null}
      {error === null ? null : <div className="px-2 py-1.5 text-sm text-destructive">Search failed</div>}
      {!loading && error === null && results.length === 0 ? (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">No matches</div>
      ) : null}
      {results.map((option, index) => (
        <button
          key={option.id}
          type="button"
          data-highlighted={index === highlight || undefined}
          className={cn(
            "flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none",
            index === highlight && "bg-accent text-accent-foreground"
          )}
          onMouseEnter={() => {
            highlightOption(index);
          }}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => {
            insert(option);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
