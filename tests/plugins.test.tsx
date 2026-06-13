import { CHECK_LIST, CODE, HEADING, INLINE_CODE } from "@lexical/markdown";
import { act, cleanup, render } from "@testing-library/react";
import { Engine, type NodeRef } from "@virtuoso.dev/reactive-engine-core";
import {
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $selectAll,
  type LexicalEditor,
} from "lexical";
import { afterEach, expect, test } from "vite-plus/test";

import { controlled$, submitHandler$ } from "../src/core/nodes.ts";
import {
  createEmptyMessageComposerValue,
  draftValue$,
  lexicalEditor$,
  MessageComposer,
  submit$,
  useEngineRef,
  valueChange$,
  type EngineRef,
  type MessageComposerProps,
  type MessageComposerValue,
} from "../src/index.ts";
import { MARKDOWN_TRANSFORMERS } from "../src/lexical/markdown.ts";
import {
  agentSettingsPlugin,
  effortOptions$,
  modelOptions$,
  selectEffort$,
  selectModel$,
} from "../src/plugins/agent-settings/index.ts";
import {
  currentLink$,
  editLink$,
  formattingPlugin,
  formattingState$,
  formatText$,
  removeLink$,
  toggleBlock$,
  toggleLink$,
} from "../src/plugins/formatting/index.tsx";

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

// Command dispatches commit through Lexical's microtask-batched update path,
// so emissions land after the synchronous act() returns.
async function publish<T>(engine: Engine, node: NodeRef<T>, value: T) {
  await act(async () => {
    engine.pub(node, value);
    await Promise.resolve();
  });
}

function selectAll(editor: LexicalEditor) {
  act(() => {
    editor.update(
      () => {
        $selectAll();
      },
      { discrete: true }
    );
  });
}

function selectFirstInlineText(editor: LexicalEditor) {
  act(() => {
    editor.update(
      () => {
        const paragraph = $getRoot().getFirstChild();
        if (!$isElementNode(paragraph)) {
          return;
        }
        const first = paragraph.getFirstChild();
        const text = $isElementNode(first) ? first.getFirstChild() : first;
        if ($isTextNode(text)) {
          text.select(0, 0);
        }
      },
      { discrete: true }
    );
  });
}

test("formatText toggles inline formats and serializes to markdown", async () => {
  const changes: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: [formattingPlugin()],
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "hello");
  selectAll(editor);

  await publish(engine, formatText$, "bold");
  expect(changes.at(-1)?.markdown).toBe("**hello**");
  expect(engine.getValue(formattingState$).bold).toBe(true);

  await publish(engine, formatText$, "italic");
  expect(changes.at(-1)?.markdown).toBe("***hello***");
  expect(engine.getValue(formattingState$).italic).toBe(true);

  await publish(engine, formatText$, "bold");
  await publish(engine, formatText$, "italic");
  expect(changes.at(-1)?.markdown).toBe("hello");
  expect(engine.getValue(formattingState$).bold).toBe(false);
});

test("strikethrough and inline code serialize to markdown", async () => {
  const changes: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: [formattingPlugin()],
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "text");
  selectAll(editor);

  await publish(engine, formatText$, "strikethrough");
  expect(changes.at(-1)?.markdown).toBe("~~text~~");

  await publish(engine, formatText$, "strikethrough");
  await publish(engine, formatText$, "code");
  expect(changes.at(-1)?.markdown).toBe("`text`");
});

test("toggleBlock switches between paragraph, quote, code, and lists", async () => {
  const changes: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: [formattingPlugin()],
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "hello");
  selectAll(editor);

  await publish(engine, toggleBlock$, "quote");
  expect(changes.at(-1)?.markdown).toBe("> hello");
  expect(engine.getValue(formattingState$).blockType).toBe("quote");

  await publish(engine, toggleBlock$, "quote");
  expect(changes.at(-1)?.markdown).toBe("hello");
  expect(engine.getValue(formattingState$).blockType).toBe("paragraph");

  await publish(engine, toggleBlock$, "ul");
  expect(changes.at(-1)?.markdown).toBe("* hello");
  expect(engine.getValue(formattingState$).blockType).toBe("ul");

  await publish(engine, toggleBlock$, "ol");
  expect(changes.at(-1)?.markdown).toBe("1. hello");
  expect(engine.getValue(formattingState$).blockType).toBe("ol");

  await publish(engine, toggleBlock$, "ol");
  expect(changes.at(-1)?.markdown).toBe("hello");

  await publish(engine, toggleBlock$, "code");
  expect(changes.at(-1)?.markdown).toBe("```\nhello\n```");
  expect(engine.getValue(formattingState$).blockType).toBe("code");
});

test("toggleLink wraps and unwraps the selection", async () => {
  const changes: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: [formattingPlugin()],
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "docs");
  selectAll(editor);

  await publish(engine, toggleLink$, "https://example.com");
  expect(changes.at(-1)?.markdown).toBe("[docs](https://example.com)");

  selectAll(editor);
  expect(engine.getValue(formattingState$).link).toBe(true);

  await publish(engine, toggleLink$, null);
  expect(changes.at(-1)?.markdown).toBe("docs");
});

test("auto-link detects typed URLs and serializes to markdown", () => {
  const changes: MessageComposerValue[] = [];
  const { editor } = setup({
    plugins: [formattingPlugin()],
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "https://example.com ");

  expect(changes.at(-1)?.markdown).toBe("<https://example.com>");
});

test("auto-link detects bare domains but leaves common file extensions alone", () => {
  const changes: MessageComposerValue[] = [];
  const { editor } = setup({
    plugins: [formattingPlugin()],
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "google.com notes.md crate.rs ");

  expect(changes.at(-1)?.markdown).toBe("[google.com](https://google.com) notes.md crate.rs");
});

test("bare-domain auto-linking can be disabled", () => {
  const changes: MessageComposerValue[] = [];
  const { editor } = setup({
    plugins: [formattingPlugin({ autoLink: { bareDomains: false } })],
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "google.com https://example.com ");

  expect(changes.at(-1)?.markdown).toBe("google.com <https://example.com>");
});

test("currentLink exposes editable link state and edit/remove commands update markdown", async () => {
  const changes: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: [formattingPlugin()],
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "docs");
  selectAll(editor);
  await publish(engine, toggleLink$, "https://example.com");
  selectAll(editor);

  expect(engine.getValue(currentLink$)).toMatchObject({
    url: "https://example.com",
    text: "docs",
    auto: false,
  });

  await publish(engine, editLink$, { url: "https://openai.com", text: "OpenAI" });
  expect(changes.at(-1)?.markdown).toBe("[OpenAI](https://openai.com)");
  expect(engine.getValue(currentLink$)).toMatchObject({
    url: "https://openai.com",
    text: "OpenAI",
  });

  await publish(engine, removeLink$, undefined);
  expect(changes.at(-1)?.markdown).toBe("OpenAI");
  expect(engine.getValue(currentLink$)).toBeNull();
});

test("mention-scheme links do not appear as editable links", () => {
  const { engine, editor } = setup({
    plugins: [formattingPlugin()],
    defaultValue: { ...createEmptyMessageComposerValue(), markdown: "[x](mention:u1)" },
  });

  selectFirstInlineText(editor);

  expect(engine.getValue(formattingState$).link).toBe(false);
  expect(engine.getValue(currentLink$)).toBeNull();
});

test("markdown text-format shortcuts convert typed syntax", async () => {
  const { container, editor } = setup({ plugins: [formattingPlugin()] });

  // The shortcut listener only fires when the anchor advances like real typing,
  // one character per update.
  for (const char of "**bold**") {
    typeText(editor, char);
  }
  await act(async () => {
    await Promise.resolve();
  });

  expect(container.querySelector("strong")?.textContent).toBe("bold");
});

test("markdown typing transformer set matches the composer formatting scope", () => {
  expect(MARKDOWN_TRANSFORMERS).toContain(INLINE_CODE);
  expect(MARKDOWN_TRANSFORMERS).toContain(CODE);
  expect(MARKDOWN_TRANSFORMERS).not.toContain(HEADING);
  expect(MARKDOWN_TRANSFORMERS).not.toContain(CHECK_LIST);
});

test("formatting state resets when the selection has no formats", () => {
  const { engine, editor } = setup({ plugins: [formattingPlugin()] });

  typeText(editor, "plain");
  selectAll(editor);

  const state = engine.getValue(formattingState$);
  expect(state).toEqual({
    bold: false,
    italic: false,
    strikethrough: false,
    code: false,
    blockType: "paragraph",
    link: false,
  });
});

test("agent-settings: plugin init seeds options and defaults into the uncontrolled draft", () => {
  const engine = new Engine();
  const changes: MessageComposerValue[] = [];
  engine.sub(valueChange$, (value) => changes.push(value));

  const plugin = agentSettingsPlugin({
    models: [
      { id: "fable-5", label: "Fable 5" },
      { id: "opus-4-8", label: "Opus 4.8" },
    ],
    efforts: ["low", "medium", "high"],
    defaultModelId: "fable-5",
    defaultEffort: "medium",
  });
  plugin.init?.({ engine });

  expect(engine.getValue(modelOptions$)).toHaveLength(2);
  expect(engine.getValue(effortOptions$)).toEqual(["low", "medium", "high"]);
  expect(engine.getValue(draftValue$).agent).toEqual({ modelId: "fable-5", effort: "medium" });
  expect(changes).toHaveLength(0);
});

test("agent-settings: defaults do not override an already seeded agent value", () => {
  const engine = new Engine({
    [draftValue$]: {
      ...createEmptyMessageComposerValue(),
      agent: { modelId: "opus-4-8" },
    },
  });

  agentSettingsPlugin({
    models: [{ id: "fable-5", label: "Fable 5" }],
    defaultModelId: "fable-5",
    defaultEffort: "high",
  }).init?.({ engine });

  expect(engine.getValue(draftValue$).agent).toEqual({ modelId: "opus-4-8", effort: "high" });
});

test("agent-settings: controlled mode never seeds defaults", () => {
  const engine = new Engine({ [controlled$]: true });

  agentSettingsPlugin({
    models: [{ id: "fable-5", label: "Fable 5" }],
    defaultModelId: "fable-5",
  }).init?.({ engine });

  expect(engine.getValue(draftValue$).agent).toBeUndefined();
});

test("agent-settings: selection commands update the draft and emit valueChange when uncontrolled", () => {
  const engine = new Engine();
  const changes: MessageComposerValue[] = [];
  engine.sub(valueChange$, (value) => changes.push(value));

  engine.pub(selectModel$, "fable-5");
  expect(engine.getValue(draftValue$).agent?.modelId).toBe("fable-5");
  expect(changes.at(-1)?.agent?.modelId).toBe("fable-5");

  engine.pub(selectEffort$, "high");
  expect(engine.getValue(draftValue$).agent).toEqual({ modelId: "fable-5", effort: "high" });
  expect(changes.at(-1)?.agent).toEqual({ modelId: "fable-5", effort: "high" });
});

test("agent-settings: controlled mode emits selections without committing them", () => {
  const seeded = { ...createEmptyMessageComposerValue(), agent: { modelId: "opus-4-8" } };
  const engine = new Engine({ [controlled$]: true, [draftValue$]: seeded });
  const changes: MessageComposerValue[] = [];
  engine.sub(valueChange$, (value) => changes.push(value));

  engine.pub(selectModel$, "fable-5");

  expect(changes.at(-1)?.agent?.modelId).toBe("fable-5");
  expect(engine.getValue(draftValue$)).toBe(seeded);
});

test("agent-settings: the submitted value carries the agent selection", () => {
  const engine = new Engine();
  const submitted: MessageComposerValue[] = [];
  engine.pub(submitHandler$, (value) => {
    submitted.push(value);
  });

  engine.pub(selectModel$, "fable-5");
  engine.pub(selectEffort$, "low");
  engine.pub(submit$, undefined);

  expect(submitted).toHaveLength(1);
  expect(submitted[0].agent).toEqual({ modelId: "fable-5", effort: "low" });
});
