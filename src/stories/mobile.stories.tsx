import { $getSelection, $isRangeSelection, type LexicalEditor } from "lexical";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";

import { ModelEffortPicker } from "../../registry/components/agent-settings/model-effort-picker.tsx";
import { AttachmentList } from "../../registry/components/attachments/attachment-list.tsx";
import { AttachmentPickerButton } from "../../registry/components/attachments/attachment-picker-button.tsx";
import { FormattingToolbar } from "../../registry/components/formatting/formatting-toolbar.tsx";
import { MentionMenu } from "../../registry/components/mentions/mention-menu.tsx";
import { MentionToken } from "../../registry/components/mentions/mention-token.tsx";
import { MessageComposer as RegistryMessageComposer } from "../../registry/components/message-composer/message-composer.tsx";
import { ContextChipList, SlashCommandShelf } from "../../registry/components/slash-commands/command-shelf.tsx";
import {
  lexicalEditor$,
  submit$,
  useCellValue,
  usePublisher,
  type MessageComposerAttachment,
  type MessageComposerValue,
} from "../index.ts";
import { agentSettingsPlugin, selectModel$ } from "../plugins/agent-settings/index.ts";
import { attachmentsPlugin, type MessageComposerAttachmentUploadHandler } from "../plugins/attachments/index.ts";
import { formattingPlugin } from "../plugins/formatting/index.tsx";
import { mentionsPlugin, type MessageComposerMentionOption } from "../plugins/mentions/index.ts";
import {
  slashCommandsPlugin,
  type MessageComposerContextChip,
  type MessageComposerSlashCommandItem,
  type MessageComposerSlashCommandProvider,
} from "../plugins/slash-commands/index.tsx";

import "./tailwind.css";

export default {
  title: "Mobile",
};

const modelOptions = [
  { id: "fable-5", label: "Fable 5" },
  { id: "opus-4-8", label: "Opus 4.8" },
  { id: "sonnet-4-6", label: "Sonnet 4.6" },
];

const people: MessageComposerMentionOption[] = [
  { id: "u1", label: "Ada Lovelace" },
  { id: "u2", label: "Alan Turing" },
  { id: "u3", label: "Grace Hopper" },
  { id: "u4", label: "Katherine Johnson" },
];

const phoneStageStyle = {
  minHeight: 820,
  background: "#f4f4f5",
  padding: 16,
} as const;

const phoneFrameStyle = {
  display: "flex",
  flexDirection: "column",
  width: 390,
  height: 760,
  overflow: "hidden",
  border: "1px solid #d4d4d8",
  borderRadius: 28,
  background: "#ffffff",
  boxShadow: "0 20px 50px rgba(15, 23, 42, 0.16)",
} as const;

const phoneHeaderStyle = {
  borderBottom: "1px solid #e4e4e7",
  padding: "14px 16px 10px",
} as const;

const titleStyle = { margin: 0, color: "#18181b", fontSize: 14, fontWeight: 700 } as const;
const metaStyle = { margin: "2px 0 0", color: "#71717a", fontSize: 12 } as const;

const threadStyle = {
  display: "grid",
  alignContent: "end",
  gap: 10,
  minHeight: 0,
  flex: 1,
  overflow: "hidden",
  padding: "14px 12px",
  background: "#fafafa",
} as const;

const messageStyle = {
  maxWidth: 286,
  border: "1px solid #e4e4e7",
  borderRadius: 14,
  background: "#ffffff",
  padding: "9px 11px",
  color: "#27272a",
  fontSize: 13,
  lineHeight: 1.45,
} as const;

const replyMessageStyle = {
  ...messageStyle,
  justifySelf: "end",
  borderColor: "#dbeafe",
  background: "#eff6ff",
} as const;

const dockStyle = {
  borderTop: "1px solid #e4e4e7",
  background: "#ffffff",
  padding: "8px 8px 14px",
} as const;

const inspectorStyle = {
  margin: "8px 0 0",
  maxHeight: 90,
  overflow: "hidden",
  background: "#f4f4f5",
  padding: 8,
  color: "#27272a",
  fontSize: 11,
  whiteSpace: "pre-wrap",
} as const;

function searchPeople(query: string, signal: AbortSignal): Promise<MessageComposerMentionOption[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(people.filter((person) => person.label.toLowerCase().includes(query.toLowerCase())));
    }, 80);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("search aborted"));
    });
  });
}

function createStoryUpload(): MessageComposerAttachmentUploadHandler {
  return (file, { signal, onProgress }) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        onProgress(1);
        resolve({ url: `https://files.example/${encodeURIComponent(file.name)}` });
      }, 80);
      signal.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new Error("upload aborted"));
      });
    });
}

function matchesQuery(item: MessageComposerSlashCommandItem, query: string) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return true;
  }
  return [item.id, item.value, item.label, item.description, ...(item.keywords ?? [])]
    .filter((token): token is string => typeof token === "string")
    .some((token) => token.toLowerCase().includes(normalized));
}

function filterItems(items: readonly MessageComposerSlashCommandItem[], query: string) {
  return items.filter((item) => matchesQuery(item, query));
}

function createSlashCommandProvider(): MessageComposerSlashCommandProvider {
  const promptItems: MessageComposerSlashCommandItem[] = [
    {
      id: "prompt-release",
      value: "release",
      label: "Release note",
      description: "Attach the release note prompt",
      chip: { id: "prompt:release", type: "prompt", label: "Release note", data: { templateId: "release-note" } },
    },
    {
      id: "prompt-summary",
      value: "summary",
      label: "Thread summary",
      description: "Ask for a compact summary",
      replacement: "Summarize the thread and list the next action.",
    },
  ];

  const fileItems: MessageComposerSlashCommandItem[] = [
    {
      id: "file:trace",
      value: "trace",
      label: "onboarding-trace.txt",
      description: "Attach the latest trace",
      chip: {
        id: "file:onboarding-trace",
        type: "file",
        label: "onboarding-trace.txt",
        data: { path: "logs/onboarding-trace.txt" },
      },
    },
    {
      id: "file:release",
      value: "release",
      label: "release-checklist.md",
      description: "Attach the release checklist",
      chip: {
        id: "file:release-checklist",
        type: "file",
        label: "release-checklist.md",
        data: { path: "docs/release-checklist.md" },
      },
    },
  ];

  const toolItems: MessageComposerSlashCommandItem[] = [
    {
      id: "tool:web",
      value: "web",
      label: "Web search",
      description: "Use web context",
      chip: { id: "tool:web", type: "tool", label: "Web search", data: { toolId: "web-search" } },
    },
    {
      id: "tool:repo",
      value: "repo",
      label: "Repository context",
      description: "Use repository context",
      chip: { id: "tool:repo", type: "tool", label: "Repository context", data: { toolId: "repo-context" } },
    },
  ];

  const topLevelItems: MessageComposerSlashCommandItem[] = [
    {
      id: "model",
      value: "model",
      label: "Model",
      description: "Choose the model for this message",
      group: "settings",
      children: ({ query }) => ({
        title: "Model",
        placeholder: "Choose a model",
        items: filterItems(
          modelOptions.map((model) => ({
            id: `model:${model.id}`,
            value: model.id,
            label: model.label,
            description: "Use this model",
            execute: ({ engine }) => {
              engine.pub(selectModel$, model.id);
            },
          })),
          query
        ),
      }),
    },
    {
      id: "prompt",
      value: "prompt",
      label: "Prompt",
      description: "Attach a prompt template",
      group: "prompts",
      children: ({ query }) => ({ title: "Prompts", items: filterItems(promptItems, query) }),
    },
    {
      id: "file",
      value: "file",
      label: "File",
      description: "Attach a file reference",
      group: "context",
      children: ({ query }) => ({ title: "Files", items: filterItems(fileItems, query) }),
    },
    {
      id: "tool",
      value: "tool",
      label: "Tool",
      description: "Toggle a tool",
      group: "tools",
      children: ({ query }) => ({ title: "Tools", items: filterItems(toolItems, query) }),
    },
  ];

  return {
    search: ({ query }) => {
      const firstToken = query.trimStart().split(/\s+/)[0] ?? "";
      return {
        title: "Commands",
        placeholder: "Type a command or keep typing to filter",
        groups: [
          { id: "settings", label: "Settings" },
          { id: "prompts", label: "Prompts" },
          { id: "context", label: "Context" },
          { id: "tools", label: "Tools" },
        ],
        items: filterItems(topLevelItems, firstToken),
      };
    },
  };
}

const mobilePlugins = [
  agentSettingsPlugin({
    models: modelOptions,
    defaultModelId: "fable-5",
    efforts: ["Low", "Medium", "High"],
    defaultEffort: "Medium",
  }),
  formattingPlugin(),
  mentionsPlugin({
    providers: [{ trigger: "@", search: searchPeople }],
    menu: MentionMenu,
    token: MentionToken,
  }),
  attachmentsPlugin({ upload: createStoryUpload() }),
  slashCommandsPlugin({ providers: [createSlashCommandProvider()] }),
];

function insertEditorText(editor: LexicalEditor | null, text: string) {
  if (!editor) {
    return;
  }
  editor.focus(() => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        selection.insertText(text);
      }
    });
  });
}

function AutoInsert({ text }: { text: string }) {
  const editor = useCellValue(lexicalEditor$);
  const inserted = useRef(false);

  useEffect(() => {
    if (!editor || inserted.current) {
      return;
    }
    inserted.current = true;
    queueMicrotask(() => {
      insertEditorText(editor, text);
    });
  }, [editor, text]);

  return null;
}

function IconButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      data-pressed={pressed || undefined}
      className="flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-medium text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[pressed=true]:bg-accent"
    >
      {children}
    </button>
  );
}

function SendIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 8.4l10.6-5.1-2.7 9.9-2.3-3.5-3.9 2.2zM8.1 9.7l2.2-2.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SmileIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M5.8 9.1c.5.9 1.2 1.4 2.2 1.4s1.7-.5 2.2-1.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M6.2 6.3h.1M9.7 6.3h.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SheetButton({ label, detail, onClick }: { label: string; detail: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="grid gap-0.5 rounded-md px-2.5 py-2 text-left outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </button>
  );
}

function MobileActionSheet({ onInsert, onClose }: { onInsert: (text: string) => void; onClose: () => void }) {
  const [view, setView] = useState<"actions" | "emoji">("actions");
  const emoji = ["🙂", "👍", "🙌", "🔥", "✅", "👀", "💡", "🚀"];

  return (
    <dialog
      open
      aria-label="Mobile actions"
      className="mobile-action-sheet absolute bottom-full left-2 top-auto z-50 mb-2 max-h-72 max-w-none overflow-y-auto rounded-md border bg-popover p-2 text-popover-foreground shadow-md"
    >
      {view === "actions" ? (
        <div className="grid grid-cols-2 gap-1">
          <SheetButton label="Model" detail="/model" onClick={() => onInsert("/model")} />
          <SheetButton label="Prompt" detail="/prompt" onClick={() => onInsert("/prompt ")} />
          <SheetButton label="File" detail="/file" onClick={() => onInsert("/file ")} />
          <SheetButton label="Mention" detail="@" onClick={() => onInsert("@")} />
          <SheetButton label="Tools" detail="/tool" onClick={() => onInsert("/tool ")} />
          <SheetButton label="Emoji" detail="Picker" onClick={() => setView("emoji")} />
        </div>
      ) : (
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setView("actions")}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              Back
            </button>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onClose}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              Close
            </button>
          </div>
          <div className="grid grid-cols-8 gap-1" aria-label="Emoji choices">
            {emoji.map((item) => (
              <button
                key={item}
                type="button"
                aria-label={`Insert ${item}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onInsert(item)}
                className="flex size-9 items-center justify-center rounded-md text-lg outline-none hover:bg-accent focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
    </dialog>
  );
}

function MobileFooter({ initialSheetOpen = false }: { initialSheetOpen?: boolean }) {
  const editor = useCellValue(lexicalEditor$);
  const submit = usePublisher(submit$);
  const [sheetOpen, setSheetOpen] = useState(initialSheetOpen);

  const insertAndClose = (text: string) => {
    setSheetOpen(false);
    insertEditorText(editor, text);
  };

  return (
    <div className="border-t border-input">
      {sheetOpen ? <MobileActionSheet onInsert={insertAndClose} onClose={() => setSheetOpen(false)} /> : null}
      <div className="flex items-center gap-0.5 px-1.5 py-1">
        <IconButton label="Open mobile actions" pressed={sheetOpen} onClick={() => setSheetOpen((open) => !open)}>
          +
        </IconButton>
        <AttachmentPickerButton />
        <IconButton label="Open slash commands" onClick={() => insertAndClose("/")}>
          /
        </IconButton>
        <IconButton label="Mention teammate" onClick={() => insertAndClose("@")}>
          @
        </IconButton>
        <IconButton label="Open emoji picker" onClick={() => setSheetOpen(true)}>
          <SmileIcon />
        </IconButton>
        <div className="min-w-0 flex-1" />
        <IconButton label="Send message" onClick={() => submit()}>
          <SendIcon />
        </IconButton>
      </div>
    </div>
  );
}

function MobileFooterClosed() {
  return <MobileFooter />;
}

function MobileFooterOpen() {
  return <MobileFooter initialSheetOpen />;
}

function MobileFormattingToolbar() {
  return <FormattingToolbar className="overflow-x-auto" />;
}

function MobileComposerHeader() {
  return (
    <>
      <SlashCommandShelf />
      <ContextChipList className="flex-nowrap overflow-x-auto pb-1" />
      <AttachmentList className="border-b border-input" />
    </>
  );
}

function MobileModelFooter() {
  return (
    <div className="grid border-t border-input px-2 pb-1">
      <ModelEffortPicker className="overflow-x-auto" />
      <MobileFooter />
    </div>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div style={phoneStageStyle}>
      <div style={phoneFrameStyle} data-testid="mobile-phone-frame">
        <div style={phoneHeaderStyle}>
          <p style={titleStyle}>Launch review</p>
          <p style={metaStyle}>Mobile composer scenario</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function MessageThread({ compact = false }: { compact?: boolean }) {
  return (
    <div style={threadStyle} aria-label="Message thread">
      <div style={messageStyle}>The release note needs the repro, expected behavior, and the model setting.</div>
      <div style={replyMessageStyle}>I have the trace and screenshot ready. I will attach them before sending.</div>
      {!compact ? (
        <>
          <div style={messageStyle}>Please keep the reply concise and link the exact file reference.</div>
          <div style={replyMessageStyle}>I will use the prompt template and repository context.</div>
        </>
      ) : null}
    </div>
  );
}

function MobileComposer({
  defaultValue,
  footer,
  withToolbar = false,
  autoInsert,
  showInspector = true,
}: {
  defaultValue?: MessageComposerValue;
  footer?: ComponentType;
  withToolbar?: boolean;
  autoInsert?: string;
  showInspector?: boolean;
}) {
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);
  const Footer = footer ?? MobileFooterClosed;
  const Header = autoInsert
    ? function MobileComposerAutoHeader() {
        return (
          <>
            <AutoInsert text={autoInsert} />
            <MobileComposerHeader />
          </>
        );
      }
    : MobileComposerHeader;

  return (
    <div style={dockStyle}>
      <RegistryMessageComposer
        className="mx-0"
        editorClassName="min-h-14 max-h-32 text-base leading-6"
        plugins={mobilePlugins}
        slots={{
          header: Header,
          toolbar: withToolbar ? MobileFormattingToolbar : undefined,
          footer: Footer,
        }}
        defaultValue={defaultValue}
        editorProps={{ "aria-label": "Message", placeholder: "Message..." }}
        onSubmit={setSubmitted}
      />
      {showInspector ? (
        <pre data-testid="mobile-submitted" style={inspectorStyle}>
          {JSON.stringify(submitted)}
        </pre>
      ) : null}
    </div>
  );
}

export const BottomDock = () => (
  <PhoneFrame>
    <MessageThread />
    <MobileComposer />
  </PhoneFrame>
);

export const ActionSheet = () => (
  <PhoneFrame>
    <MessageThread compact />
    <MobileComposer footer={MobileFooterOpen} />
  </PhoneFrame>
);

export const SlashCommandsOpen = () => (
  <PhoneFrame>
    <MessageThread compact />
    <MobileComposer autoInsert="/" />
  </PhoneFrame>
);

export const MentionSuggestionsOpen = () => (
  <PhoneFrame>
    <MessageThread compact />
    <MobileComposer autoInsert="@a" />
  </PhoneFrame>
);

const crowdedChips: MessageComposerContextChip[] = [
  { id: "prompt:release", type: "prompt", label: "Release note" },
  { id: "file:onboarding-trace", type: "file", label: "onboarding-trace.txt" },
  { id: "tool:repo", type: "tool", label: "Repository context" },
];

const crowdedAttachments: MessageComposerAttachment[] = [
  {
    id: "att-trace",
    name: "onboarding-trace.txt",
    mimeType: "text/plain",
    size: 48210,
    status: "success",
    url: "https://files.example/onboarding-trace.txt",
  },
  {
    id: "att-shot",
    name: "mobile-regression.png",
    mimeType: "image/png",
    size: 124000,
    status: "uploading",
    progress: 0.72,
  },
];

const crowdedValue: MessageComposerValue = {
  markdown: "Draft the release note with the repro and expected behavior.",
  attachments: crowdedAttachments,
  mentions: [],
  audioClips: [],
  agent: { modelId: "fable-5", effort: "Medium" },
  extensions: { contextChips: crowdedChips },
};

export const CrowdedContext = () => (
  <PhoneFrame>
    <MessageThread compact />
    <MobileComposer defaultValue={crowdedValue} footer={MobileModelFooter} withToolbar />
  </PhoneFrame>
);

export const PublicDemo = () => (
  <PhoneFrame>
    <MessageThread compact />
    <MobileComposer defaultValue={crowdedValue} footer={MobileModelFooter} showInspector={false} withToolbar />
  </PhoneFrame>
);
