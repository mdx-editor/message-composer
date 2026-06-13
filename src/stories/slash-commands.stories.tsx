import { useState } from "react";

import { MessageComposer as RegistryMessageComposer } from "../../registry/components/message-composer/message-composer.tsx";
import { SlashCommandHeader } from "../../registry/components/slash-commands/command-shelf.tsx";
import { MessageComposer, useCellValues, usePublisher, type MessageComposerValue } from "../index.ts";
import { agentSettingsPlugin, selectModel$ } from "../plugins/agent-settings/index.ts";
import {
  contextChips$,
  removeContextChip$,
  selectSlashCommand$,
  slashCommandGroups$,
  slashCommandHighlight$,
  slashCommandMenu$,
  slashCommandResults$,
  slashCommandsPlugin,
  type MessageComposerSlashCommandItem,
  type MessageComposerSlashCommandProvider,
} from "../plugins/slash-commands/index.tsx";

import "./tailwind.css";

export default {
  title: "SlashCommands",
};

const layoutStyle = { display: "grid", gap: 8, maxWidth: 640, paddingTop: 360 } as const;
const storyLayoutStyle = { display: "grid", gap: 8, maxWidth: 640, paddingTop: 24 } as const;
const contextPanelStyle = {
  display: "grid",
  alignContent: "start",
  gap: 12,
  height: 360,
  overflow: "hidden",
  border: "1px solid #e4e4e7",
  borderRadius: 6,
  background: "#fafafa",
  padding: 16,
} as const;
const threadHeaderStyle = { display: "grid", gap: 2, borderBottom: "1px solid #e4e4e7", paddingBottom: 12 } as const;
const threadTitleStyle = { margin: 0, color: "#18181b", fontSize: 14, fontWeight: 600 } as const;
const threadMetaStyle = { margin: 0, color: "#71717a", fontSize: 12 } as const;
const messageStackStyle = { display: "grid", gap: 10 } as const;
const messageRowStyle = { display: "grid", gap: 3 } as const;
const authorStyle = { color: "#71717a", fontSize: 11, fontWeight: 600, textTransform: "uppercase" } as const;
const messageBubbleStyle = {
  maxWidth: 480,
  border: "1px solid #e4e4e7",
  borderRadius: 6,
  background: "#ffffff",
  padding: "8px 10px",
  color: "#27272a",
  fontSize: 13,
  lineHeight: 1.45,
} as const;
const messageBubbleMutedStyle = { ...messageBubbleStyle, background: "#f4f4f5" } as const;
const editorStyle = {
  border: "1px solid #d4d4d8",
  borderRadius: 6,
  padding: 8,
  minHeight: 80,
  outline: "none",
  "--message-composer-placeholder-left": "8px",
  "--message-composer-placeholder-top": "8px",
} as const;
const inspectorStyle = { background: "#f4f4f5", padding: 8, whiteSpace: "pre-wrap" } as const;

const modelOptions = [
  { id: "fable-5", label: "Fable 5" },
  { id: "opus-4-8", label: "Opus 4.8" },
  { id: "sonnet-4-6", label: "Sonnet 4.6" },
];

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
      id: "prompt-bug",
      value: "bug",
      label: "Bug report",
      description: "Insert a compact bug report outline",
      replacement: "Bug report\n\nExpected:\nActual:\nNotes:\n",
      chip: { id: "prompt:bug", type: "prompt", label: "Bug report", data: { templateId: "bug-report" } },
    },
    {
      id: "prompt-review",
      value: "review",
      label: "Review checklist",
      description: "Attach review instructions",
      chip: { id: "prompt:review", type: "prompt", label: "Review checklist", data: { templateId: "review" } },
    },
  ];

  const fileItems: MessageComposerSlashCommandItem[] = [
    {
      id: "file:composer",
      value: "composer",
      label: "message-composer.tsx",
      description: "Reference the registry composer wrapper",
      chip: {
        id: "file:message-composer",
        type: "file",
        label: "message-composer.tsx",
        data: { path: "registry/components/message-composer/message-composer.tsx" },
      },
    },
    {
      id: "file:formatting",
      value: "formatting",
      label: "formatting/index.tsx",
      description: "Reference formatting plugin behavior",
      chip: {
        id: "file:formatting",
        type: "file",
        label: "formatting/index.tsx",
        data: { path: "src/plugins/formatting/index.tsx" },
      },
    },
  ];

  const toolItems: MessageComposerSlashCommandItem[] = [
    {
      id: "tool:web",
      value: "web",
      label: "Web search",
      description: "Enable web context for this message",
      chip: { id: "tool:web", type: "tool", label: "Web search", data: { toolId: "web-search", enabled: true } },
    },
    {
      id: "tool:repo",
      value: "repo",
      label: "Repository context",
      description: "Use the current repository as context",
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
      description: "Insert or attach a prompt template",
      group: "prompts",
      children: ({ query }) => ({ title: "Prompts", items: filterItems(promptItems, query) }),
    },
    {
      id: "file",
      value: "file",
      label: "File",
      description: "Attach a structured file reference",
      group: "context",
      children: ({ query }) => ({ title: "Files", items: filterItems(fileItems, query) }),
    },
    {
      id: "tool",
      value: "tool",
      label: "Tool",
      description: "Toggle a tool context chip",
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

const plugins = [
  agentSettingsPlugin({
    models: modelOptions,
    defaultModelId: "fable-5",
  }),
  slashCommandsPlugin({
    providers: [createSlashCommandProvider()],
    shelf: SlashCommandHeader,
  }),
];

function Inspectors({
  lastChange,
  submitted,
}: {
  lastChange: MessageComposerValue | null;
  submitted: MessageComposerValue | null;
}) {
  return (
    <>
      <pre data-testid="last-change" style={inspectorStyle}>
        {JSON.stringify(lastChange)}
      </pre>
      <pre data-testid="submitted" style={inspectorStyle}>
        {JSON.stringify(submitted)}
      </pre>
    </>
  );
}

function ConversationContext() {
  return (
    <section aria-label="Conversation context" data-testid="conversation-context" style={contextPanelStyle}>
      <div style={threadHeaderStyle}>
        <p style={threadTitleStyle}>Release review</p>
        <p style={threadMetaStyle}>Message composer integration notes</p>
      </div>
      <div style={messageStackStyle}>
        <div style={messageRowStyle}>
          <span style={authorStyle}>Maya</span>
          <div style={messageBubbleStyle}>
            I reviewed the onboarding trace. The missing file reference still looks like the likely source of the
            regression.
          </div>
        </div>
        <div style={messageRowStyle}>
          <span style={authorStyle}>Niko</span>
          <div style={messageBubbleMutedStyle}>
            Please draft the release note with the latest repro, expected behavior, and the model setting we used during
            verification.
          </div>
        </div>
        <div style={messageRowStyle}>
          <span style={authorStyle}>Maya</span>
          <div style={messageBubbleStyle}>
            I also dropped the relevant screenshot into the issue. The follow-up should link the file and keep the
            response concise.
          </div>
        </div>
      </div>
    </section>
  );
}

export const RegistryUI = () => {
  const [lastChange, setLastChange] = useState<MessageComposerValue | null>(null);
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);

  return (
    <div style={storyLayoutStyle}>
      <ConversationContext />
      <RegistryMessageComposer
        plugins={plugins}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message..." }}
        onValueChange={setLastChange}
        onSubmit={setSubmitted}
      />
      <Inspectors lastChange={lastChange} submitted={submitted} />
    </div>
  );
};

const CustomCommandShelf = () => {
  const [menu, groups, results, highlight] = useCellValues(
    slashCommandMenu$,
    slashCommandGroups$,
    slashCommandResults$,
    slashCommandHighlight$
  );
  const select = usePublisher(selectSlashCommand$);
  if (!menu) {
    return null;
  }
  return (
    <div data-testid="custom-command-shelf">
      {groups.map((group) => (
        <strong key={group.id}>{group.label}</strong>
      ))}
      {results.map((item, index) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={index === highlight}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => select(item)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

const CustomChipList = () => {
  const chips = useCellValues(contextChips$)[0];
  const remove = usePublisher(removeContextChip$);
  return (
    <div data-testid="custom-chip-list">
      {chips.map((chip) => (
        <button key={chip.id} type="button" onClick={() => remove(chip.id)}>
          {chip.label}
        </button>
      ))}
    </div>
  );
};

const customPlugins = [
  agentSettingsPlugin({
    models: modelOptions,
    defaultModelId: "fable-5",
  }),
  slashCommandsPlugin({
    providers: [createSlashCommandProvider()],
    shelf: CustomCommandShelf,
    chips: CustomChipList,
  }),
];

export const CustomUI = () => {
  const [lastChange, setLastChange] = useState<MessageComposerValue | null>(null);
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <MessageComposer
        plugins={customPlugins}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message...", style: editorStyle }}
        onValueChange={setLastChange}
        onSubmit={setSubmitted}
      />
      <Inspectors lastChange={lastChange} submitted={submitted} />
    </div>
  );
};
