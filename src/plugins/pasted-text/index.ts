import { $isCodeNode } from "@lexical/code";
import { Cell, Stream } from "@virtuoso.dev/reactive-engine-core";
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  PASTE_COMMAND,
  type LexicalEditor,
} from "lexical";
import { toMarkdown } from "mdast-util-to-markdown";

import { disabled$, draftValue$, editorChange$ } from "../../core/nodes.ts";
import type { MessageComposerPlugin } from "../../core/plugin.ts";
import type { MessageComposerValue } from "../../core/value.ts";
import { toMarkdownExtensions$, toMarkdownOptions$ } from "../../lexical/mdast/registry.ts";
import { lexicalEditor$ } from "../../lexical/nodes.ts";

export interface MessageComposerPastedText {
  id: string;
  /** Original clipboard text, without Markdown parsing or whitespace normalization. */
  text: string;
}

export interface MessageComposerPastedTextConfig {
  /** Collapse when either threshold is reached. Defaults to 2000 characters or 20 lines. */
  minCharacters?: number;
  minLines?: number;
}

export const pastedTexts$ = Cell<MessageComposerPastedText[]>([]);
/** Adds an explicit text item, regardless of the automatic paste thresholds. */
export const addPastedText$ = Stream<string>(false);
export const updatePastedText$ = Stream<MessageComposerPastedText>(false);
export const removePastedText$ = Stream<string>(false);
/** Moves a text item to the end of the message as editable plain text. */
export const expandPastedText$ = Stream<string>(false);

/** Read these records at submission; they are separate from value.markdown. */
export function getPastedTexts(value: Pick<MessageComposerValue, "extensions">): MessageComposerPastedText[] {
  const records: unknown = value.extensions?.pastedTexts;
  if (!Array.isArray(records)) {
    return [];
  }
  return records.filter(
    (record): record is MessageComposerPastedText =>
      record !== null && typeof record === "object" && typeof record.id === "string" && typeof record.text === "string"
  );
}

export function pastedTextLineCount(text: string): number {
  return text.split(/\r\n|\r|\n/).length;
}

export function pastedTextPlugin(config: MessageComposerPastedTextConfig = {}): MessageComposerPlugin {
  const minCharacters = config.minCharacters ?? 2000;
  const minLines = config.minLines ?? 20;
  for (const threshold of [minCharacters, minLines]) {
    if (!Number.isInteger(threshold) || threshold < 1) {
      throw new Error("Pasted text thresholds must be positive integers.");
    }
  }
  return {
    id: "pasted-text",
    init: ({ engine }) => {
      const sync = (value: MessageComposerValue) => engine.pub(pastedTexts$, getPastedTexts(value));
      sync(engine.getValue(draftValue$));
      const commit = (transform: (records: MessageComposerPastedText[]) => MessageComposerPastedText[]) => {
        if (engine.getValue(disabled$)) {
          return;
        }
        const draft = engine.getValue(draftValue$);
        engine.pub(editorChange$, {
          ...draft,
          extensions: { ...draft.extensions, pastedTexts: transform(getPastedTexts(draft)) },
        });
      };
      const unsubDraft = engine.sub(draftValue$, sync);
      const unsubAdd = engine.sub(addPastedText$, (text) => {
        if (text.length > 0) {
          commit((records) => [...records, { id: crypto.randomUUID(), text }]);
        }
      });
      const unsubUpdate = engine.sub(updatePastedText$, (record) => {
        commit((records) =>
          records.map((current) => (current.id === record.id ? { ...current, text: record.text } : current))
        );
      });
      const unsubRemove = engine.sub(removePastedText$, (id) => {
        commit((records) => records.filter((record) => record.id !== id));
      });
      const unsubExpand = engine.sub(expandPastedText$, (id) => {
        if (engine.getValue(disabled$)) {
          return;
        }
        const draft = engine.getValue(draftValue$);
        const records = getPastedTexts(draft);
        const item = records.find((record) => record.id === id);
        if (!item) {
          return;
        }
        // Escape Markdown syntax so unsupported constructs become editable text
        // instead of losing content when the editor imports the new value.
        const content = toMarkdown(
          {
            type: "root",
            children: [{ type: "paragraph", children: [{ type: "text", value: item.text }] }],
          },
          { ...engine.getValue(toMarkdownOptions$), extensions: engine.getValue(toMarkdownExtensions$) }
        ).replace(/\n$/, "");
        engine.pub(editorChange$, {
          ...draft,
          markdown: content ? [draft.markdown, content].filter(Boolean).join("\n\n") : draft.markdown,
          extensions: { ...draft.extensions, pastedTexts: records.filter((record) => record.id !== id) },
        });
      });
      let cleanupEditor: (() => void) | undefined;
      const attach = (editor: LexicalEditor | null) => {
        cleanupEditor?.();
        cleanupEditor = editor?.registerCommand(
          PASTE_COMMAND,
          (event) => {
            if (
              engine.getValue(disabled$) ||
              !(event instanceof ClipboardEvent) ||
              !event.clipboardData ||
              event.clipboardData.files.length > 0
            ) {
              return false;
            }
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) {
              return false;
            }
            // Code remains editable in place, including mixed selections touching a code block.
            if (
              selection
                .getNodes()
                .some(
                  (node) =>
                    $isCodeNode(node) ||
                    ($isTextNode(node) && node.hasFormat("code")) ||
                    node.getParents().some($isCodeNode)
                )
            ) {
              return false;
            }
            const text = event.clipboardData.getData("text/plain");
            if (text.length < minCharacters && pastedTextLineCount(text) < minLines) {
              return false;
            }
            if (text.length === 0) {
              return false;
            }
            event.preventDefault();
            // This is a sidecar attachment; selected prose and the insertion point stay intact.
            engine.pub(addPastedText$, text);
            return true;
          },
          COMMAND_PRIORITY_HIGH
        );
      };
      attach(engine.getValue(lexicalEditor$));
      const unsubEditor = engine.sub(lexicalEditor$, attach);
      return () => {
        unsubDraft();
        unsubAdd();
        unsubUpdate();
        unsubRemove();
        unsubExpand();
        unsubEditor();
        cleanupEditor?.();
      };
    },
  };
}
