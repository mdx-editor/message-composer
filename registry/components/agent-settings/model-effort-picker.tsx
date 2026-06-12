import { Select } from "@base-ui-components/react/select";
import { useCellValues, usePublisher } from "@mdxeditor/message-composer";
import {
  agent$,
  effortOptions$,
  modelOptions$,
  selectEffort$,
  selectModel$,
} from "@mdxeditor/message-composer/features/agent-settings";

import { cn } from "../../lib/utils.ts";

interface PickerItem {
  label: string;
  value: string;
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PickerSelect({
  label,
  value,
  items,
  onChange,
}: {
  label: string;
  value: string | null;
  items: PickerItem[];
  onChange: (value: string) => void;
}) {
  return (
    <Select.Root
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null) {
          onChange(next);
        }
      }}
    >
      <Select.Trigger
        aria-label={label}
        className={cn(
          "flex h-8 w-fit min-w-28 items-center justify-between gap-2 rounded-md border border-input bg-background",
          "px-3 text-sm whitespace-nowrap text-foreground shadow-xs outline-none select-none",
          "hover:bg-accent/50 data-[popup-open]:bg-accent/50",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        )}
      >
        <Select.Value />
        <Select.Icon className="flex size-4 items-center justify-center text-muted-foreground">
          <ChevronDownIcon />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4} className="z-50 outline-none">
          <Select.Popup
            className={cn(
              "max-h-[var(--available-height)] min-w-[var(--anchor-width)] overflow-x-hidden overflow-y-auto",
              "rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none"
            )}
          >
            {items.map((item) => (
              <Select.Item
                key={item.value}
                value={item.value}
                className={cn(
                  "relative flex w-full cursor-default items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none select-none",
                  "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                )}
              >
                <Select.ItemText>{item.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-2 flex size-3.5 items-center justify-center">
                  <CheckIcon />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

export function ModelEffortPicker({ className }: { className?: string }) {
  const [agent, modelOptions, effortOptions] = useCellValues(agent$, modelOptions$, effortOptions$);
  const publishModel = usePublisher(selectModel$);
  const publishEffort = usePublisher(selectEffort$);

  return (
    <div className={cn("flex items-center gap-2 py-1.5", className)}>
      <PickerSelect
        label="Model"
        value={agent?.modelId ?? null}
        items={modelOptions.map((model) => ({ label: model.label, value: model.id }))}
        onChange={publishModel}
      />
      {effortOptions.length > 0 ? (
        <PickerSelect
          label="Effort"
          value={agent?.effort ?? null}
          items={effortOptions.map((effort) => ({ label: effort, value: effort }))}
          onChange={publishEffort}
        />
      ) : null}
    </div>
  );
}
