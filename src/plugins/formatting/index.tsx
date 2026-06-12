import { $createCodeNode, $isCodeNode } from "@lexical/code";
import { $isLinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { $createQuoteNode, $isQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { Cell, e, Stream, type Engine } from "@virtuoso.dev/reactive-engine-core";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
} from "lexical";

import type { MessageComposerPlugin } from "../../core/plugin.ts";
import { MARKDOWN_TRANSFORMERS } from "../../lexical/markdown.ts";
import { lexicalEditor$ } from "../../lexical/nodes.ts";

export type MessageComposerTextFormat = "bold" | "italic" | "strikethrough" | "code";
export type MessageComposerBlockType = "paragraph" | "code" | "quote" | "ul" | "ol";

export interface MessageComposerFormattingState {
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  code: boolean;
  blockType: MessageComposerBlockType;
  link: boolean;
}

const INITIAL_FORMATTING_STATE: MessageComposerFormattingState = {
  bold: false,
  italic: false,
  strikethrough: false,
  code: false,
  blockType: "paragraph",
  link: false,
};

/** Current selection formatting; drives active/pressed state in any toolbar. */
export const formattingState$ = Cell<MessageComposerFormattingState>(
  INITIAL_FORMATTING_STATE,
  (previous, next) =>
    previous !== undefined &&
    previous.bold === next.bold &&
    previous.italic === next.italic &&
    previous.strikethrough === next.strikethrough &&
    previous.code === next.code &&
    previous.blockType === next.blockType &&
    previous.link === next.link
);

/** Toggles an inline text format on the current selection. */
// Commands are events, not state: distinct must be off so repeating the same
// command (toggle on, toggle off) is not swallowed by reference equality.
export const formatText$ = Stream<MessageComposerTextFormat>(false);

/** Toggles a block type on the current selection; toggling the active type returns to paragraph. */
export const toggleBlock$ = Stream<Exclude<MessageComposerBlockType, "paragraph">>(false);

/** Wraps the selection in a link (payload is the URL) or removes it (null). */
export const toggleLink$ = Stream<string | null>(false);

function $readBlockType(): MessageComposerBlockType {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return "paragraph";
  }
  const element = selection.anchor.getNode().getTopLevelElement();
  if (element === null) {
    return "paragraph";
  }
  if ($isCodeNode(element)) {
    return "code";
  }
  if ($isQuoteNode(element)) {
    return "quote";
  }
  if ($isListNode(element)) {
    return element.getListType() === "number" ? "ol" : "ul";
  }
  return "paragraph";
}

function $readFormattingState(): MessageComposerFormattingState {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return INITIAL_FORMATTING_STATE;
  }
  const anchorNode = selection.anchor.getNode();
  const parent = anchorNode.getParent();
  return {
    bold: selection.hasFormat("bold"),
    italic: selection.hasFormat("italic"),
    strikethrough: selection.hasFormat("strikethrough"),
    code: selection.hasFormat("code"),
    blockType: $readBlockType(),
    link: $isLinkNode(parent) || $isLinkNode(anchorNode),
  };
}

e.sub(formatText$, (format, engine) => {
  engine.getValue(lexicalEditor$)?.dispatchCommand(FORMAT_TEXT_COMMAND, format);
});

e.sub(toggleLink$, (url, engine) => {
  engine.getValue(lexicalEditor$)?.dispatchCommand(TOGGLE_LINK_COMMAND, url);
});

e.sub(toggleBlock$, (blockType, engine) => {
  const editor = engine.getValue(lexicalEditor$);
  if (!editor) {
    return;
  }
  const current = editor.getEditorState().read($readBlockType);
  if (blockType === "ul" || blockType === "ol") {
    if (current === blockType) {
      editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
    } else {
      editor.dispatchCommand(
        blockType === "ul" ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND,
        undefined
      );
    }
    return;
  }
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) {
      return;
    }
    $setBlocksType(selection, () => {
      if (current === blockType) {
        return $createParagraphNode();
      }
      return blockType === "code" ? $createCodeNode() : $createQuoteNode();
    });
  });
});

function FormattingPlugins() {
  return (
    <>
      <ListPlugin />
      <LinkPlugin />
      <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
    </>
  );
}

function trackFormattingState(engine: Engine) {
  let cleanupEditor: (() => void) | null = null;
  const unsubEditorCell = engine.sub(lexicalEditor$, (editor: LexicalEditor | null) => {
    cleanupEditor?.();
    cleanupEditor = null;
    if (!editor) {
      engine.pub(formattingState$, INITIAL_FORMATTING_STATE);
      return;
    }
    const publishState = () => {
      engine.pub(formattingState$, editor.getEditorState().read($readFormattingState));
    };
    publishState();
    cleanupEditor = editor.registerUpdateListener(publishState);
  });
  return () => {
    cleanupEditor?.();
    unsubEditorCell();
  };
}

export function formattingPlugin(): MessageComposerPlugin {
  return {
    id: "formatting",
    init: ({ engine }) => trackFormattingState(engine),
    lexicalPlugins: [FormattingPlugins],
  };
}
