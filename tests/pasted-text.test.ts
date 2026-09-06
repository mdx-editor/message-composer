import { Engine } from "@virtuoso.dev/reactive-engine-core";
import { expect, test, vi } from "vite-plus/test";

import {
  controlled$,
  disabled$,
  draftValue$,
  reset$,
  submit$,
  submitHandler$,
  valueChange$,
} from "../src/core/nodes.ts";
import { createEmptyMessageComposerValue, type MessageComposerValue } from "../src/core/value.ts";
import {
  addPastedText$,
  expandPastedText$,
  getPastedTexts,
  pastedTextLineCount,
  pastedTextPlugin,
  pastedTexts$,
  removePastedText$,
  updatePastedText$,
} from "../src/plugins/pasted-text/index.ts";

function setup() {
  const engine = new Engine();
  const cleanup = pastedTextPlugin().init?.({ engine });
  return { engine, cleanup };
}

test("preserves exact text and unrelated sidecars through edit, submit, and reset", () => {
  const { engine } = setup();
  engine.pub(draftValue$, {
    ...createEmptyMessageComposerValue(),
    markdown: "Review this",
    extensions: { contextChips: [{ id: "keep" }] },
  });
  const source = "# Header\r\n\ttext  \r\n![image](image.png)\r\n";
  engine.pub(addPastedText$, source);
  const [item] = engine.getValue(pastedTexts$);
  expect(item.text).toBe(source);
  engine.pub(updatePastedText$, { ...item, text: source + "more" });
  const submitted = vi.fn<(value: MessageComposerValue) => void>();
  engine.pub(submitHandler$, submitted);
  engine.pub(submit$);
  expect(getPastedTexts(submitted.mock.calls[0][0])[0].text).toBe(source + "more");
  expect(engine.getValue(draftValue$).extensions?.contextChips).toEqual([{ id: "keep" }]);
  engine.pub(reset$);
  expect(engine.getValue(pastedTexts$)).toEqual([]);
});

test("controlled changes wait for the host echo and do not erase extension fields", () => {
  const { engine } = setup();
  engine.pub(controlled$, true);
  const values: MessageComposerValue[] = [];
  engine.sub(valueChange$, (value) => values.push(value));
  engine.pub(addPastedText$, "source");
  expect(engine.getValue(pastedTexts$)).toEqual([]);
  engine.pub(draftValue$, values[0]);
  const [item] = engine.getValue(pastedTexts$);
  expect(item.text).toBe("source");
  engine.pub(removePastedText$, item.id);
  expect(engine.getValue(pastedTexts$)).toHaveLength(1);
  engine.pub(draftValue$, values[1]);
  expect(engine.getValue(pastedTexts$)).toEqual([]);
});

test("disabled commands cannot change text and engines remain isolated", () => {
  const { engine, cleanup } = setup();
  const second = setup().engine;
  engine.pub(addPastedText$, "keep");
  const [item] = engine.getValue(pastedTexts$);
  engine.pub(disabled$, true);
  engine.pub(addPastedText$, "extra");
  engine.pub(updatePastedText$, { ...item, text: "changed" });
  engine.pub(removePastedText$, item.id);
  expect(engine.getValue(pastedTexts$)).toEqual([item]);
  expect(second.getValue(pastedTexts$)).toEqual([]);
  if (typeof cleanup === "function") {
    cleanup();
  }
  engine.pub(disabled$, false);
  engine.pub(addPastedText$, "after disposal");
  expect(engine.getValue(pastedTexts$)).toEqual([item]);
});

test("thresholds are validated and line counts handle all clipboard newline styles", () => {
  expect(pastedTextLineCount("a\r\nb\rc\nd")).toBe(4);
  expect(() => pastedTextPlugin({ minLines: 0 })).toThrow("positive integers");
  expect(() => pastedTextPlugin({ minCharacters: NaN })).toThrow("positive integers");
});

test("expansion atomically replaces one pill with escaped text and respects host control", () => {
  const { engine } = setup();
  engine.pub(draftValue$, {
    ...createEmptyMessageComposerValue(),
    markdown: "Existing **prose**",
    extensions: { keep: true },
  });
  engine.pub(addPastedText$, "# Heading\n![image](https://example.com/image.png)");
  engine.pub(addPastedText$, "other");
  const [item, other] = engine.getValue(pastedTexts$);
  engine.pub(controlled$, true);
  const changes: MessageComposerValue[] = [];
  engine.sub(valueChange$, (value) => changes.push(value));
  engine.pub(expandPastedText$, item.id);
  expect(changes).toHaveLength(1);
  expect(changes[0].markdown).toContain("Existing **prose**\n\n");
  expect(changes[0].markdown).toContain("image.png");
  expect(changes[0].extensions?.keep).toBe(true);
  expect(getPastedTexts(changes[0])).toEqual([other]);
  expect(engine.getValue(pastedTexts$)).toEqual([item, other]);
  engine.pub(draftValue$, changes[0]);
  expect(engine.getValue(pastedTexts$)).toEqual([other]);
  engine.pub(disabled$, true);
  engine.pub(expandPastedText$, other.id);
  expect(changes).toHaveLength(1);
});
