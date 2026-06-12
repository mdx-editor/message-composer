import { act, cleanup, render } from "@testing-library/react";
import {
  $getRoot,
  $getSelection,
  $isRangeSelection,
  HISTORY_PUSH_TAG,
  KEY_ENTER_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  type LexicalEditor,
} from "lexical";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";

import {
  createEmptyMessageComposerValue,
  lexicalEditor$,
  MessageComposer,
  reset$,
  submit$,
  useEngineRef,
  type EngineRef,
  type MessageComposerProps,
  type MessageComposerValue,
} from "../src/index.ts";

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

// Programmatic edits classify as OTHER and merge into the current history entry;
// the explicit push tag makes each helper call undoable like real user typing.
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
      { discrete: true, tag: HISTORY_PUSH_TAG }
    );
  });
}

function pressEnter(editor: LexicalEditor, init: KeyboardEventInit = {}) {
  act(() => {
    editor.dispatchCommand(KEY_ENTER_COMMAND, new KeyboardEvent("keydown", { key: "Enter", ...init }));
  });
}

async function flushLexical() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function flushRevertTimer() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}

function getEditorElement(container: HTMLElement) {
  const element = container.querySelector("[contenteditable]");
  if (!element) {
    throw new Error("editor element not rendered");
  }
  return element as HTMLElement;
}

test("uncontrolled: editing emits onValueChange and renders the content", () => {
  const changes: MessageComposerValue[] = [];
  const { container, editor } = setup({ onValueChange: (value) => changes.push(value) });

  typeText(editor, "hello");

  expect(getEditorElement(container).textContent).toBe("hello");
  expect(changes.at(-1)).toEqual({ ...createEmptyMessageComposerValue(), markdown: "hello" });
});

test("uncontrolled: defaultValue seeds the editor, importing markdown structure", () => {
  const { container } = setup({
    defaultValue: { ...createEmptyMessageComposerValue(), markdown: "plain **bold** text" },
  });
  const element = getEditorElement(container);

  expect(element.textContent).toBe("plain bold text");
  expect(element.querySelector("strong")?.textContent).toBe("bold");
});

test("markdown export reflects rich content edits", () => {
  const changes: MessageComposerValue[] = [];
  const { editor } = setup({
    defaultValue: { ...createEmptyMessageComposerValue(), markdown: "**bold**" },
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, " tail");

  expect(changes.at(-1)?.markdown).toBe("**bold** tail");
});

test("controlled: editor reverts when the host does not echo the value back", async () => {
  const changes: MessageComposerValue[] = [];
  const { container, editor } = setup({
    value: { ...createEmptyMessageComposerValue(), markdown: "fixed" },
    onValueChange: (value) => changes.push(value),
  });

  typeText(editor, " plus typing");
  expect(changes.at(-1)?.markdown).toBe("fixed plus typing");

  await flushRevertTimer();

  expect(getEditorElement(container).textContent).toBe("fixed");
});

test("controlled: edits persist when the host echoes the value back", async () => {
  const captured: { engineRef: EngineRef | null } = { engineRef: null };
  const EchoHost = () => {
    const engineRef = useEngineRef();
    captured.engineRef = engineRef;
    const [value, setValue] = useState(createEmptyMessageComposerValue());
    return <MessageComposer engineRef={engineRef} value={value} onValueChange={setValue} />;
  };
  const { container } = render(<EchoHost />);
  const editor = captured.engineRef?.current?.getValue(lexicalEditor$);
  if (!editor) {
    throw new Error("editor not mounted");
  }

  typeText(editor, "persists");
  await flushRevertTimer();

  expect(getEditorElement(container).textContent).toBe("persists");
});

test("controlled: external value updates are applied to the editor", async () => {
  const first = { ...createEmptyMessageComposerValue(), markdown: "first" };
  const second = { ...createEmptyMessageComposerValue(), markdown: "second" };
  const { container, rerender } = render(<MessageComposer value={first} />);

  await act(async () => {
    rerender(<MessageComposer value={second} />);
  });

  expect(getEditorElement(container).textContent).toBe("second");
});

test("undo and redo travel through the value contract", async () => {
  const changes: MessageComposerValue[] = [];
  const { editor } = setup({ onValueChange: (value) => changes.push(value) });

  // History tracks the pre-edit state only once a commit has been observed;
  // in the browser this happens when the user clicks into the editor. Replicate
  // that with a selection-only update so the first edit becomes undoable.
  act(() => {
    editor.update(
      () => {
        $getRoot().selectEnd();
      },
      { discrete: true }
    );
  });

  typeText(editor, "hello");
  expect(changes.at(-1)?.markdown).toBe("hello");

  act(() => {
    editor.dispatchCommand(UNDO_COMMAND, undefined);
  });
  await flushLexical();
  expect(changes.at(-1)?.markdown).toBe("");

  act(() => {
    editor.dispatchCommand(REDO_COMMAND, undefined);
  });
  await flushLexical();
  expect(changes.at(-1)?.markdown).toBe("hello");
});

test("enter submits the current draft and never clears it", () => {
  const submitted: MessageComposerValue[] = [];
  const { container, editor } = setup({
    onSubmit: (value) => {
      submitted.push(value);
    },
  });

  typeText(editor, "hello");
  pressEnter(editor);

  expect(submitted).toHaveLength(1);
  expect(submitted[0]).toEqual({ ...createEmptyMessageComposerValue(), markdown: "hello" });
  expect(getEditorElement(container).textContent).toBe("hello");
});

test("shift+enter and composing enter do not submit", () => {
  const onSubmit = vi.fn<() => void>();
  const { editor } = setup({ onSubmit });

  pressEnter(editor, { shiftKey: true });
  pressEnter(editor, { isComposing: true });

  expect(onSubmit).not.toHaveBeenCalled();
});

test("async onSubmit drives submitting state; rejection sets error state and keeps the draft", async () => {
  let rejectSubmit!: (error: unknown) => void;
  const onSubmit = () =>
    new Promise<void>((_, reject) => {
      rejectSubmit = reject;
    });
  const { container, editor } = setup({ onSubmit });
  const element = getEditorElement(container);

  typeText(editor, "draft");
  pressEnter(editor);

  expect(element.getAttribute("data-submitting")).toBe("true");

  await act(async () => {
    rejectSubmit(new Error("submit failed"));
    await Promise.resolve();
  });

  expect(element.getAttribute("data-submitting")).toBeNull();
  expect(element.getAttribute("data-submit-error")).toBe("true");
  expect(element.textContent).toBe("draft");
});

test("disabled: editor becomes non-editable and submit commands are blocked", () => {
  const onSubmit = vi.fn<() => void>();
  const { container, engine } = setup({ disabled: true, onSubmit });
  const element = getEditorElement(container);

  expect(element.getAttribute("contenteditable")).toBe("false");
  expect(element.getAttribute("data-disabled")).toBe("true");

  act(() => {
    engine.pub(submit$);
  });
  expect(onSubmit).not.toHaveBeenCalled();
});

test("reset clears the uncontrolled draft, the editor content, and emits the cleared value", () => {
  const changes: MessageComposerValue[] = [];
  const { container, editor, engine } = setup({ onValueChange: (value) => changes.push(value) });

  typeText(editor, "typed");
  expect(getEditorElement(container).textContent).toBe("typed");

  act(() => {
    engine.pub(reset$);
  });

  expect(getEditorElement(container).textContent).toBe("");
  expect(changes.at(-1)).toEqual(createEmptyMessageComposerValue());
});

test("multiple composer instances keep independent editors", () => {
  const capturedRefs: EngineRef[] = [];
  const Host = () => {
    const firstRef = useEngineRef();
    const secondRef = useEngineRef();
    capturedRefs[0] = firstRef;
    capturedRefs[1] = secondRef;
    return (
      <div>
        <MessageComposer engineRef={firstRef} editorProps={{ "aria-label": "first" }} />
        <MessageComposer engineRef={secondRef} editorProps={{ "aria-label": "second" }} />
      </div>
    );
  };
  const { getByLabelText } = render(<Host />);
  const firstEditor = capturedRefs[0].current?.getValue(lexicalEditor$);
  if (!firstEditor) {
    throw new Error("first editor not mounted");
  }

  typeText(firstEditor, "only in first");

  expect(getByLabelText("first").textContent).toBe("only in first");
  expect(getByLabelText("second").textContent).toBe("");
});
