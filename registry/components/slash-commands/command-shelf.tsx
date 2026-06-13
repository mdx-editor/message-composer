import { useCellValue, useCellValues, usePublisher } from "@mdxeditor/message-composer";
import {
  contextChips$,
  removeContextChip$,
  selectSlashCommand$,
  slashCommandError$,
  slashCommandGroups$,
  slashCommandHighlight$,
  slashCommandLoading$,
  slashCommandMenu$,
  slashCommandPath$,
  slashCommandPlaceholder$,
  slashCommandResults$,
  slashCommandTitle$,
  type MessageComposerSlashCommandItem,
} from "@mdxeditor/message-composer/plugins/slash-commands";

import { cn } from "../../lib/utils.ts";

function groupedItems(
  items: readonly MessageComposerSlashCommandItem[],
  groups: readonly { id: string; label: string }[]
) {
  const groupIds = new Set(groups.map((group) => group.id));
  const sections = groups.map((group) => ({
    id: group.id,
    label: group.label,
    items: items.filter((item) => item.group === group.id),
  }));
  const ungrouped = items.filter((item) => item.group === undefined || !groupIds.has(item.group));
  return ungrouped.length > 0 ? [...sections, { id: "__ungrouped", label: "", items: ungrouped }] : sections;
}

export function SlashCommandShelf({ className }: { className?: string }) {
  const [menu, path, title, placeholder, groups, results, loading, error, highlight] = useCellValues(
    slashCommandMenu$,
    slashCommandPath$,
    slashCommandTitle$,
    slashCommandPlaceholder$,
    slashCommandGroups$,
    slashCommandResults$,
    slashCommandLoading$,
    slashCommandError$,
    slashCommandHighlight$
  );
  const select = usePublisher(selectSlashCommand$);
  const setHighlight = usePublisher(slashCommandHighlight$);

  if (!menu) {
    return null;
  }

  const sections = groupedItems(results, groups);
  const heading = title ?? (path.length > 0 ? path.map((item) => item.label).join(" / ") : "Commands");

  return (
    <div
      aria-label="Slash commands"
      className={cn(
        "absolute right-2 bottom-full left-2 z-50 mb-2 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
        className
      )}
    >
      <div className="border-b px-3 py-2">
        <div className="text-xs font-medium text-muted-foreground">{heading}</div>
        {placeholder ? <div className="mt-0.5 text-xs text-muted-foreground/80">{placeholder}</div> : null}
      </div>
      <div className="max-h-72 overflow-y-auto p-1">
        {loading && results.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">Loading commands…</div>
        ) : null}
        {error === null ? null : <div className="px-2 py-1.5 text-sm text-destructive">Command failed</div>}
        {!loading && error === null && results.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No commands</div>
        ) : null}
        {sections.map((section) =>
          section.items.length === 0 ? null : (
            <div key={section.id} className="py-1">
              {section.label ? (
                <div className="px-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {section.label}
                </div>
              ) : null}
              {section.items.map((item) => {
                const index = results.indexOf(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.label}
                    data-highlighted={index === highlight || undefined}
                    className={cn(
                      "flex min-h-10 w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-left outline-none select-none",
                      index === highlight && "bg-accent text-accent-foreground"
                    )}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onMouseEnter={() => {
                      // Pointer hover should mirror keyboard highlight.
                      // Publishing the cell directly keeps the editor focused.
                      setHighlight(index);
                    }}
                    onClick={() => {
                      select(item);
                    }}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-sm border bg-muted font-mono text-xs">
                      {(item.value ?? item.id).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.label}</span>
                      {item.description ? (
                        <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

export function ContextChipList({ className }: { className?: string }) {
  const chips = useCellValue(contextChips$);
  const remove = usePublisher(removeContextChip$);

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5 px-2 pt-2", className)} aria-label="Context chips">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted px-2 py-1 text-xs text-foreground"
        >
          <span className="truncate">
            {chip.type}: {chip.label}
          </span>
          <button
            type="button"
            aria-label={`Remove ${chip.label}`}
            className="rounded-sm px-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              remove(chip.id);
            }}
          >
            x
          </button>
        </span>
      ))}
    </div>
  );
}

export function SlashCommandHeader() {
  return (
    <>
      <SlashCommandShelf />
      <ContextChipList />
    </>
  );
}
