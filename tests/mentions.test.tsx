import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { act, cleanup, render } from "@testing-library/react";
import { Engine, type NodeRef } from "@virtuoso.dev/reactive-engine-core";
import {
  $getRoot,
  $getSelection,
  $insertNodes,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  BLUR_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
} from "lexical";
import { afterEach, expect, test } from "vite-plus/test";

import {
  createEmptyMessageComposerValue,
  lexicalEditor$,
  MessageComposer,
  mentions$,
  useEngineRef,
  type EngineRef,
  type MessageComposerProps,
  type MessageComposerValue,
} from "../src/index.ts";
import {
  cancelMention$,
  confirmMention$,
  insertMention$,
  mentionError$,
  mentionHighlight$,
  mentionLoading$,
  mentionMenu$,
  mentionResults$,
  mentionsPlugin,
  moveMentionHighlight$,
  type MessageComposerMentionOption,
  type MessageComposerMentionProvider,
} from "../src/plugins/mentions/index.ts";

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

interface SearchCall {
  query: string;
  signal: AbortSignal;
  resolve: (results: MessageComposerMentionOption[]) => void;
  reject: (error: unknown) => void;
}

function deferredProvider(trigger = "@") {
  const calls: SearchCall[] = [];
  const provider: MessageComposerMentionProvider = {
    trigger,
    search: (query, signal) =>
      new Promise((resolve, reject) => {
        calls.push({ query, signal, resolve, reject });
      }),
  };
  return { provider, calls };
}

async function resolveSearch(call: SearchCall, results: MessageComposerMentionOption[]) {
  await act(async () => {
    call.resolve(results);
    await Promise.resolve();
  });
}

const ADA: MessageComposerMentionOption = { id: "u1", label: "Ada" };
const ALAN: MessageComposerMentionOption = { id: "u2", label: "Alan" };

function valueWithMarkdown(markdown: string): MessageComposerValue {
  return { ...createEmptyMessageComposerValue(), markdown };
}

test("typing a trigger at a word start opens and updates the query", () => {
  const { provider, calls } = deferredProvider();
  const { engine, editor } = setup({ plugins: [mentionsPlugin({ providers: [provider] })] });

  typeText(editor, "hello ");
  expect(engine.getValue(mentionMenu$)).toBeNull();

  typeText(editor, "@");
  expect(engine.getValue(mentionMenu$)).toMatchObject({ trigger: "@", query: "" });
  expect(engine.getValue(mentionLoading$)).toBe(true);

  typeText(editor, "a");
  typeText(editor, "d");
  expect(engine.getValue(mentionMenu$)).toMatchObject({ trigger: "@", query: "ad" });
  expect(calls.map((call) => call.query)).toEqual(["", "a", "ad"]);

  typeText(editor, " ");
  expect(engine.getValue(mentionMenu$)).toBeNull();
  expect(engine.getValue(mentionLoading$)).toBe(false);
});

test("a trigger inside a word does not open the menu", () => {
  const { provider } = deferredProvider();
  const { engine, editor } = setup({ plugins: [mentionsPlugin({ providers: [provider] })] });

  typeText(editor, "email@host");
  expect(engine.getValue(mentionMenu$)).toBeNull();
});

test("a new query aborts the in-flight search", async () => {
  const { provider, calls } = deferredProvider();
  const { engine, editor } = setup({ plugins: [mentionsPlugin({ providers: [provider] })] });

  typeText(editor, "@");
  typeText(editor, "a");
  expect(calls).toHaveLength(2);
  expect(calls[0].signal.aborted).toBe(true);
  expect(calls[1].signal.aborted).toBe(false);

  await resolveSearch(calls[1], [ADA]);
  expect(engine.getValue(mentionResults$)).toEqual([ADA]);
  expect(engine.getValue(mentionLoading$)).toBe(false);

  // A late resolution of the aborted call must not clobber the results.
  await resolveSearch(calls[0], [ALAN]);
  expect(engine.getValue(mentionResults$)).toEqual([ADA]);
});

test("closing the menu aborts the in-flight search", () => {
  const { provider, calls } = deferredProvider();
  const { engine, editor } = setup({ plugins: [mentionsPlugin({ providers: [provider] })] });

  typeText(editor, "@a");
  typeText(editor, " ");
  expect(engine.getValue(mentionMenu$)).toBeNull();
  expect(calls.at(-1)?.signal.aborted).toBe(true);
});

test("a failed search surfaces the error state", async () => {
  const { provider, calls } = deferredProvider();
  const { engine, editor } = setup({ plugins: [mentionsPlugin({ providers: [provider] })] });

  typeText(editor, "@a");
  const failure = new Error("search down");
  await act(async () => {
    calls.at(-1)?.reject(failure);
    await Promise.resolve();
  });

  expect(engine.getValue(mentionError$)).toBe(failure);
  expect(engine.getValue(mentionLoading$)).toBe(false);
  expect(engine.getValue(mentionResults$)).toEqual([]);
});

test("insertMention replaces the trigger run and serializes per ADR 0008", async () => {
  const { provider, calls } = deferredProvider();
  const changes: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: [mentionsPlugin({ providers: [provider] })],
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "ping @ad");
  await resolveSearch(calls.at(-1)!, [ADA]);
  await publish(engine, insertMention$, ADA);

  expect(changes.at(-1)?.markdown).toContain("ping [@Ada](mention:u1)");
  expect(changes.at(-1)?.mentions).toEqual([{ id: "u1", trigger: "@", label: "Ada" }]);
  expect(engine.getValue(mentionMenu$)).toBeNull();

  typeText(editor, "now");
  expect(changes.at(-1)?.markdown).toBe("ping [@Ada](mention:u1) now");
  expect(changes.at(-1)?.mentions).toEqual([{ id: "u1", trigger: "@", label: "Ada" }]);
});

test("keyboard confirmation inserts the highlighted result", async () => {
  const { provider, calls } = deferredProvider();
  const changes: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: [mentionsPlugin({ providers: [provider] })],
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "@a");
  await resolveSearch(calls.at(-1)!, [ADA, ALAN]);

  await publish(engine, moveMentionHighlight$, 1);
  expect(engine.getValue(mentionHighlight$)).toBe(1);

  await publish(engine, confirmMention$, undefined);
  expect(changes.at(-1)?.markdown).toContain("[@Alan](mention:u2)");
  expect(changes.at(-1)?.mentions).toEqual([{ id: "u2", trigger: "@", label: "Alan" }]);
});

test("the highlight wraps around the result list", async () => {
  const { provider, calls } = deferredProvider();
  const { engine, editor } = setup({ plugins: [mentionsPlugin({ providers: [provider] })] });

  typeText(editor, "@a");
  await resolveSearch(calls.at(-1)!, [ADA, ALAN]);

  await publish(engine, moveMentionHighlight$, -1);
  expect(engine.getValue(mentionHighlight$)).toBe(1);
  await publish(engine, moveMentionHighlight$, 1);
  expect(engine.getValue(mentionHighlight$)).toBe(0);
});

test("enter with an open menu inserts instead of submitting", async () => {
  const { provider, calls } = deferredProvider();
  const submitted: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: [mentionsPlugin({ providers: [provider] })],
    onSubmit: (value) => {
      submitted.push(value);
    },
  });

  typeText(editor, "@a");
  await resolveSearch(calls.at(-1)!, [ADA]);

  await act(async () => {
    editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent("keydown", { key: "Enter" }));
    await Promise.resolve();
  });

  expect(submitted).toHaveLength(0);
  expect(engine.getValue(mentions$)).toEqual([{ id: "u1", trigger: "@", label: "Ada" }]);

  await act(async () => {
    editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent("keydown", { key: "Enter" }));
    await Promise.resolve();
  });
  expect(submitted).toHaveLength(1);
  expect(submitted[0].mentions).toEqual([{ id: "u1", trigger: "@", label: "Ada" }]);
});

test("arrow keys are consumed only while the menu has results", async () => {
  const { provider, calls } = deferredProvider();
  const { editor } = setup({ plugins: [mentionsPlugin({ providers: [provider] })] });

  let handled = false;
  act(() => {
    handled = editor.dispatchCommand(KEY_ARROW_DOWN_COMMAND, new KeyboardEvent("keydown", { key: "ArrowDown" }));
  });
  expect(handled).toBe(false);

  typeText(editor, "@a");
  await resolveSearch(calls.at(-1)!, [ADA, ALAN]);
  act(() => {
    handled = editor.dispatchCommand(KEY_ARROW_DOWN_COMMAND, new KeyboardEvent("keydown", { key: "ArrowDown" }));
  });
  expect(handled).toBe(true);
});

test("cancel dismisses the menu until the trigger run changes position", async () => {
  const { provider, calls } = deferredProvider();
  const { engine, editor } = setup({ plugins: [mentionsPlugin({ providers: [provider] })] });

  typeText(editor, "@a");
  await resolveSearch(calls.at(-1)!, [ADA]);
  await publish(engine, cancelMention$, undefined);
  expect(engine.getValue(mentionMenu$)).toBeNull();

  // Same trigger run: stays dismissed while typing continues.
  typeText(editor, "b");
  expect(engine.getValue(mentionMenu$)).toBeNull();

  // A new trigger at a different position opens again.
  typeText(editor, " @c");
  expect(engine.getValue(mentionMenu$)).toMatchObject({ trigger: "@", query: "c" });
});

test("blur closes the menu without dismissing the trigger run", () => {
  const { provider } = deferredProvider();
  const { engine, editor } = setup({ plugins: [mentionsPlugin({ providers: [provider] })] });

  typeText(editor, "@a");
  expect(engine.getValue(mentionMenu$)).not.toBeNull();

  act(() => {
    editor.dispatchCommand(BLUR_COMMAND, new FocusEvent("blur"));
  });
  expect(engine.getValue(mentionMenu$)).toBeNull();

  typeText(editor, "b");
  expect(engine.getValue(mentionMenu$)).toMatchObject({ query: "ab" });
});

test("deletion removes the mention as a unit", async () => {
  const { provider, calls } = deferredProvider();
  const changes: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: [mentionsPlugin({ providers: [provider] })],
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "@ad");
  await resolveSearch(calls.at(-1)!, [ADA]);
  await publish(engine, insertMention$, ADA);

  const deleteBackward = () => {
    act(() => {
      editor.update(
        () => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.deleteCharacter(true);
          }
        },
        { discrete: true }
      );
    });
  };

  // happy-dom lacks the native selection.modify used for mid-text character
  // deletion, so the trailing space is removed through a range selection; the
  // decorator-adjacent backspace below is the deletion-as-unit path under test.
  act(() => {
    editor.update(
      () => {
        const paragraph = $getRoot().getFirstChild();
        if ($isElementNode(paragraph)) {
          const last = paragraph.getLastChild();
          if ($isTextNode(last)) {
            last.select(0, 1);
          }
        }
      },
      { discrete: true }
    );
  });
  deleteBackward();
  expect(changes.at(-1)?.markdown).toBe("[@Ada](mention:u1)");

  deleteBackward();
  expect(changes.at(-1)?.markdown).toBe("");
  expect(changes.at(-1)?.mentions).toEqual([]);
});

test("a defaultValue with mention markdown derives the sidecar silently at mount", () => {
  const { provider } = deferredProvider();
  const changes: MessageComposerValue[] = [];
  const { engine } = setup({
    plugins: [mentionsPlugin({ providers: [provider] })],
    defaultValue: valueWithMarkdown("ping [@Ada](mention:u1) now"),
    onValueChange: (value) => changes.push(value),
  });

  expect(changes).toHaveLength(0);
  expect(engine.getValue(mentions$)).toEqual([{ id: "u1", trigger: "@", label: "Ada" }]);
});

test("imported mention markdown round-trips through the editor", () => {
  const { provider } = deferredProvider();
  const changes: MessageComposerValue[] = [];
  const { editor } = setup({
    plugins: [mentionsPlugin({ providers: [provider] })],
    defaultValue: valueWithMarkdown("ping [@Ada](mention:u1) now"),
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "!");
  expect(changes.at(-1)?.markdown).toBe("ping [@Ada](mention:u1) now!");
  expect(changes.at(-1)?.mentions).toEqual([{ id: "u1", trigger: "@", label: "Ada" }]);
});

test("mention ids survive URI-encoding through the markdown", async () => {
  const { provider, calls } = deferredProvider();
  const changes: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: [mentionsPlugin({ providers: [provider] })],
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "@a");
  await resolveSearch(calls.at(-1)!, []);
  await publish(engine, insertMention$, { id: "team lead/42", label: "Ada" });

  expect(changes.at(-1)?.markdown).toContain("(mention:team%20lead%2F42)");
  expect(changes.at(-1)?.mentions).toEqual([{ id: "team lead/42", trigger: "@", label: "Ada" }]);

  const reimported = setup({
    plugins: [mentionsPlugin({ providers: [provider] })],
    defaultValue: valueWithMarkdown(changes.at(-1)!.markdown),
  });
  expect(reimported.engine.getValue(mentions$)).toEqual([{ id: "team lead/42", trigger: "@", label: "Ada" }]);
});

test("regular links and short mention links fall through to the core link visitor", () => {
  const { provider } = deferredProvider();
  const changes: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: [mentionsPlugin({ providers: [provider] })],
    defaultValue: valueWithMarkdown("[docs](https://example.com) and [x](mention:u1)"),
    onValueChange: (value) => changes.push(value),
  });

  expect(engine.getValue(mentions$)).toEqual([]);
  typeText(editor, "!");
  expect(changes.at(-1)?.markdown).toBe("[docs](https://example.com) and [x](mention:u1)!");
  expect(changes.at(-1)?.mentions).toEqual([]);
});

test("the mentions sidecar lists occurrences in document order", () => {
  const { provider } = deferredProvider();
  const { engine } = setup({
    plugins: [mentionsPlugin({ providers: [provider] })],
    defaultValue: valueWithMarkdown("[@Ada](mention:u1) met [@Alan](mention:u2) and [@Ada](mention:u1)"),
  });

  expect(engine.getValue(mentions$)).toEqual([
    { id: "u1", trigger: "@", label: "Ada" },
    { id: "u2", trigger: "@", label: "Alan" },
    { id: "u1", trigger: "@", label: "Ada" },
  ]);
});

test("the sidecar stays reference-stable across unrelated edits", () => {
  const { provider } = deferredProvider();
  const { engine, editor } = setup({
    plugins: [mentionsPlugin({ providers: [provider] })],
    defaultValue: valueWithMarkdown("ping [@Ada](mention:u1) now"),
  });

  const before = engine.getValue(mentions$);
  typeText(editor, " indeed");
  expect(engine.getValue(mentions$)).toBe(before);
});

test("mention nodes survive an editor state JSON round-trip (internal copy/paste)", async () => {
  const { provider, calls } = deferredProvider();
  const changes: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: [mentionsPlugin({ providers: [provider] })],
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "@a");
  await resolveSearch(calls.at(-1)!, []);
  await publish(engine, insertMention$, { id: "u1", label: "Ada", data: { role: "admin" } });
  expect(changes.at(-1)?.mentions).toEqual([{ id: "u1", trigger: "@", label: "Ada", data: { role: "admin" } }]);

  const serialized = JSON.stringify(editor.getEditorState().toJSON());
  await act(async () => {
    editor.setEditorState(editor.parseEditorState(serialized));
    await Promise.resolve();
  });
  typeText(editor, "!");

  expect(changes.at(-1)?.mentions).toEqual([{ id: "u1", trigger: "@", label: "Ada", data: { role: "admin" } }]);
  expect(changes.at(-1)?.markdown).toContain("[@Ada](mention:u1)");
});

test("mention nodes survive an HTML round-trip (external copy/paste)", async () => {
  const { provider } = deferredProvider();
  const changes: MessageComposerValue[] = [];
  const { editor } = setup({
    plugins: [mentionsPlugin({ providers: [provider] })],
    defaultValue: valueWithMarkdown("ping [@Ada](mention:u1) now"),
    onValueChange: (value) => changes.push(value),
  });

  let html = "";
  act(() => {
    editor.read(() => {
      html = $generateHtmlFromNodes(editor);
    });
  });
  expect(html).toContain('data-lexical-mention-id="u1"');

  await act(async () => {
    editor.update(
      () => {
        const dom = new DOMParser().parseFromString(html, "text/html");
        const nodes = $generateNodesFromDOM(editor, dom);
        const root = $getRoot();
        root.clear();
        root.selectEnd();
        $insertNodes(nodes);
      },
      { discrete: true }
    );
    await Promise.resolve();
  });

  // A faithful reimport reproduces the identical markdown, so no change fires
  // until the next edit; the edit proves the mention node survived the DOM trip.
  typeText(editor, "!");
  expect(changes.at(-1)?.markdown).toBe("ping [@Ada](mention:u1) now!");
  expect(changes.at(-1)?.mentions).toEqual([{ id: "u1", trigger: "@", label: "Ada" }]);
});

test("multiple providers route queries by trigger", async () => {
  const people = deferredProvider("@");
  const channels = deferredProvider("#");
  const changes: MessageComposerValue[] = [];
  const { engine, editor } = setup({
    plugins: [mentionsPlugin({ providers: [people.provider, channels.provider] })],
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, "#ge");
  expect(engine.getValue(mentionMenu$)).toMatchObject({ trigger: "#", query: "ge" });
  expect(channels.calls.at(-1)?.query).toBe("ge");
  expect(people.calls).toHaveLength(0);

  await resolveSearch(channels.calls.at(-1)!, [{ id: "c1", label: "general" }]);
  await publish(engine, insertMention$, { id: "c1", label: "general" });
  expect(changes.at(-1)?.markdown).toContain("[#general](mention:c1)");
  expect(changes.at(-1)?.mentions).toEqual([{ id: "c1", trigger: "#", label: "general" }]);
});

test("the plugin rejects multi-character triggers", () => {
  expect(() => mentionsPlugin({ providers: [{ trigger: "@@", search: () => Promise.resolve([]) }] })).toThrowError(
    /single characters/
  );
});
