import { act, cleanup, render } from "@testing-library/react";
import { Engine, type NodeRef } from "@virtuoso.dev/reactive-engine-core";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
} from "lexical";
import { useState } from "react";
import { afterEach, expect, test } from "vite-plus/test";

import {
  createEmptyMessageComposerValue,
  lexicalEditor$,
  MessageComposer,
  useEngineRef,
  type EngineRef,
  type MessageComposerProps,
  type MessageComposerValue,
} from "../src/index.ts";
import { agent$, agentSettingsPlugin, selectModel$ } from "../src/plugins/agent-settings/index.ts";
import {
  cancelSlashCommand$,
  contextChips$,
  removeContextChip$,
  slashCommandGroups$,
  slashCommandHighlight$,
  slashCommandMenu$,
  slashCommandPath$,
  slashCommandResults$,
  slashCommandsPlugin,
  type MessageComposerSlashCommandItem,
  type MessageComposerSlashCommandProvider,
} from "../src/plugins/slash-commands/index.tsx";

afterEach(cleanup);

function setup(props: MessageComposerProps = {}) {
  const captured: { engineRef: EngineRef | null } = { engineRef: null };
  const Host = () => {
    const engineRef = useEngineRef();
    captured.engineRef = engineRef;
    return <MessageComposer engineRef={engineRef} {...props} />;
  };
  const utils = render(<Host />);
  const engine = captured.engineRef?.current;
  if (!engine) {
    throw new Error("engine not mounted");
  }
  const editor = engine.getValue(lexicalEditor$);
  if (!editor) {
    throw new Error("lexical editor not mounted");
  }
  return { ...utils, engine, editor };
}

function typeText(editor: LexicalEditor, text: string) {
  act(() => {
    editor.update(
      () => {
        $getRoot().selectEnd();
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          selection.insertText(text);
        }
      },
      { discrete: true }
    );
  });
}

async function publish<T>(engine: Engine, node: NodeRef<T>, value: T) {
  await act(async () => {
    engine.pub(node, value);
    await Promise.resolve();
  });
}

async function flushSlashCommands() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

const models = [
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

function createProvider(): MessageComposerSlashCommandProvider {
  const promptItems: MessageComposerSlashCommandItem[] = [
    {
      id: "prompt:bug",
      value: "bug",
      label: "Bug report",
      replacement: "Bug report\n\nExpected:\nActual:\n",
      chip: { id: "prompt:bug", type: "prompt", label: "Bug report", data: { templateId: "bug-report" } },
    },
  ];
  const fileItems: MessageComposerSlashCommandItem[] = [
    {
      id: "file:composer",
      value: "composer",
      label: "message-composer.tsx",
      chip: {
        id: "file:message-composer",
        type: "file",
        label: "message-composer.tsx",
        data: { path: "registry/components/message-composer/message-composer.tsx" },
      },
    },
  ];
  const toolItems: MessageComposerSlashCommandItem[] = [
    {
      id: "tool:web",
      value: "web",
      label: "Web search",
      chip: { id: "tool:web", type: "tool", label: "Web search", data: { toolId: "web-search" } },
    },
  ];
  const topItems: MessageComposerSlashCommandItem[] = [
    {
      id: "model",
      value: "model",
      label: "Model",
      description: "Choose a model",
      group: "settings",
      children: ({ query }) => ({
        title: "Model",
        items: filterItems(
          models.map((model) => ({
            id: `model:${model.id}`,
            value: model.id,
            label: model.label,
            execute: ({ engine }) => engine.pub(selectModel$, model.id),
          })),
          query
        ),
      }),
    },
    {
      id: "prompt",
      value: "prompt",
      label: "Prompt",
      description: "Use a prompt template",
      group: "prompts",
      children: ({ query }) => ({ title: "Prompts", items: filterItems(promptItems, query) }),
    },
    {
      id: "file",
      value: "file",
      label: "File",
      description: "Add a file reference",
      group: "context",
      children: ({ query }) => ({ title: "Files", items: filterItems(fileItems, query) }),
    },
    {
      id: "tool",
      value: "tool",
      label: "Tool",
      description: "Toggle tool context",
      group: "tools",
      children: ({ query }) => ({ title: "Tools", items: filterItems(toolItems, query) }),
    },
  ];

  return {
    search: ({ query }) => ({
      title: "Commands",
      groups: [
        { id: "settings", label: "Settings" },
        { id: "prompts", label: "Prompts" },
        { id: "context", label: "Context" },
        { id: "tools", label: "Tools" },
      ],
      items: filterItems(topItems, query.trimStart().split(/\s+/)[0] ?? ""),
    }),
  };
}

function plugins() {
  return [
    agentSettingsPlugin({ models, defaultModelId: "fable-5" }),
    slashCommandsPlugin({ providers: [createProvider()] }),
  ];
}

function valueWithMarkdown(markdown: string): MessageComposerValue {
  return { ...createEmptyMessageComposerValue(), markdown };
}

test("typing slash opens grouped command results and filters the top level", async () => {
  const { engine, editor } = setup({ plugins: plugins() });

  typeText(editor, "/");
  await flushSlashCommands();

  expect(engine.getValue(slashCommandMenu$)).toMatchObject({ query: "" });
  expect(engine.getValue(slashCommandGroups$).map((group) => group.label)).toEqual([
    "Settings",
    "Prompts",
    "Context",
    "Tools",
  ]);
  expect(engine.getValue(slashCommandResults$).map((item) => item.label)).toEqual(["Model", "Prompt", "File", "Tool"]);

  typeText(editor, "mo");
  await flushSlashCommands();
  expect(engine.getValue(slashCommandResults$).map((item) => item.label)).toEqual(["Model"]);
});

test("selecting a grouped command drills into its secondary picker", async () => {
  const { engine, editor } = setup({ plugins: plugins() });

  typeText(editor, "/mo");
  await flushSlashCommands();

  act(() => {
    editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent("keydown", { key: "Enter" }));
  });
  await flushSlashCommands();

  expect(engine.getValue(slashCommandPath$).map((item) => item.label)).toEqual(["Model"]);
  expect(engine.getValue(slashCommandResults$).map((item) => item.label)).toEqual([
    "Fable 5",
    "Opus 4.8",
    "Sonnet 4.6",
  ]);
});

test("typing an exact slash path opens directly into the nested model picker", async () => {
  const { engine, editor } = setup({ plugins: plugins() });

  typeText(editor, "/model");
  await flushSlashCommands();

  expect(engine.getValue(slashCommandPath$).map((item) => item.label)).toEqual(["Model"]);
  expect(engine.getValue(slashCommandResults$).map((item) => item.label)).toEqual([
    "Fable 5",
    "Opus 4.8",
    "Sonnet 4.6",
  ]);

  act(() => {
    editor.dispatchCommand(KEY_ARROW_DOWN_COMMAND, new KeyboardEvent("keydown", { key: "ArrowDown" }));
  });
  expect(engine.getValue(slashCommandHighlight$)).toBe(1);

  act(() => {
    editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent("keydown", { key: "Enter" }));
  });
  await flushSlashCommands();

  expect(engine.getValue(agent$)?.modelId).toBe("opus-4-8");
  expect(engine.getValue(slashCommandMenu$)).toBeNull();
});

test("command execution can insert markdown and add a prompt chip", async () => {
  const changes: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: plugins(),
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "/prompt bug");
  await flushSlashCommands();
  expect(engine.getValue(slashCommandResults$).map((item) => item.label)).toEqual(["Bug report"]);

  act(() => {
    editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent("keydown", { key: "Enter" }));
  });
  await flushSlashCommands();

  expect(changes.at(-1)?.markdown).toBe("Bug report\n\nExpected:\nActual:");
  expect(engine.getValue(contextChips$)).toEqual([
    { id: "prompt:bug", type: "prompt", label: "Bug report", data: { templateId: "bug-report" } },
  ]);
});

test("controlled hosts receive command text replacement and chips together after echo", async () => {
  const changes: MessageComposerValue[] = [];
  const captured: { engineRef: EngineRef | null } = { engineRef: null };
  const Host = () => {
    const engineRef = useEngineRef();
    const [value, setValue] = useState<MessageComposerValue>(valueWithMarkdown(""));
    captured.engineRef = engineRef;
    return (
      <MessageComposer
        engineRef={engineRef}
        value={value}
        plugins={plugins()}
        onValueChange={(next) => {
          changes.push(next);
          setValue(next);
        }}
      />
    );
  };
  render(<Host />);
  const engine = captured.engineRef?.current;
  if (!engine) {
    throw new Error("engine not mounted");
  }
  const editor = engine.getValue(lexicalEditor$);
  if (!editor) {
    throw new Error("lexical editor not mounted");
  }

  typeText(editor, "/prompt bug");
  await flushSlashCommands();
  act(() => {
    editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent("keydown", { key: "Enter" }));
  });
  await flushSlashCommands();

  expect(changes.at(-1)?.markdown).toBe("Bug report\n\nExpected:\nActual:");
  expect(changes.at(-1)?.extensions?.contextChips).toEqual([
    { id: "prompt:bug", type: "prompt", label: "Bug report", data: { templateId: "bug-report" } },
  ]);
});

test("file and tool commands add sidecar chips without changing markdown", async () => {
  const changes: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: plugins(),
    defaultValue: valueWithMarkdown("Keep this"),
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, " /file composer");
  await flushSlashCommands();
  act(() => {
    editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent("keydown", { key: "Enter" }));
  });
  await flushSlashCommands();

  expect(changes.at(-1)?.markdown).toBe("Keep this");
  expect(engine.getValue(contextChips$)).toEqual([
    {
      id: "file:message-composer",
      type: "file",
      label: "message-composer.tsx",
      data: { path: "registry/components/message-composer/message-composer.tsx" },
    },
  ]);

  typeText(editor, " /tool web");
  await flushSlashCommands();
  act(() => {
    editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent("keydown", { key: "Enter" }));
  });
  await flushSlashCommands();

  expect(changes.at(-1)?.markdown).toBe("Keep this");
  expect(engine.getValue(contextChips$).map((chip) => chip.id)).toEqual(["file:message-composer", "tool:web"]);

  await publish(engine, removeContextChip$, "file:message-composer");
  expect(engine.getValue(contextChips$).map((chip) => chip.id)).toEqual(["tool:web"]);
});

test("cancellation dismisses the current trigger run until a new slash starts", async () => {
  const { engine, editor } = setup({ plugins: plugins() });

  typeText(editor, "/tool");
  await flushSlashCommands();
  expect(engine.getValue(slashCommandMenu$)).not.toBeNull();

  await publish(engine, cancelSlashCommand$, undefined);
  expect(engine.getValue(slashCommandMenu$)).toBeNull();

  typeText(editor, " web");
  await flushSlashCommands();
  expect(engine.getValue(slashCommandMenu$)).toBeNull();

  typeText(editor, " /file");
  await flushSlashCommands();
  expect(engine.getValue(slashCommandMenu$)).not.toBeNull();
});
