import { $createCodeNode, $isCodeNode } from "@lexical/code";
import {
  $createLinkNode,
  $isAutoLinkNode,
  $isLinkNode,
  $toggleLink,
  AutoLinkNode,
  createLinkMatcherWithRegExp,
  TOGGLE_LINK_COMMAND,
  type LinkMatcher,
  type LinkNode,
} from "@lexical/link";
import {
  $isListItemNode,
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { AutoLinkPlugin } from "@lexical/react/LexicalAutoLinkPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { $createQuoteNode, $isQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { Cell, e, Stream, type Engine } from "@virtuoso.dev/reactive-engine-core";
import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getSelection,
  $isParagraphNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  COLLABORATION_TAG,
  FORMAT_TEXT_COMMAND,
  HISTORIC_TAG,
  INSERT_PARAGRAPH_COMMAND,
  KEY_ENTER_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type RangeSelection,
} from "lexical";
import { useEffect } from "react";

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

export interface MessageComposerLinkAnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface MessageComposerCurrentLink {
  /** Opaque Lexical node key for the link being edited. */
  linkKey: string;
  url: string;
  text: string;
  anchorRect: MessageComposerLinkAnchorRect | null;
  auto: boolean;
}

export interface MessageComposerLinkEdit {
  url: string;
  text?: string;
}

export interface MessageComposerAutoLinkOptions {
  /** Fully replaces the built-in URL/domain matchers. */
  matchers?: readonly LinkMatcher[];
  /** Enables Slack-like `google.com` linking. Defaults to true. */
  bareDomains?: boolean;
  /** Bare-domain suffixes accepted by the built-in domain matcher. */
  bareDomainTlds?: readonly string[];
  /** Filename extensions that should not be treated as domains unless explicitly allowed as TLDs. */
  fileExtensions?: readonly string[];
}

export interface MessageComposerFormattingConfig {
  /** Set to false to disable auto-linking, or pass options to tune the built-in matchers. */
  autoLink?: boolean | MessageComposerAutoLinkOptions;
}

const INITIAL_FORMATTING_STATE: MessageComposerFormattingState = {
  bold: false,
  italic: false,
  strikethrough: false,
  code: false,
  blockType: "paragraph",
  link: false,
};

const MENTION_URL_SCHEME = "mention:";
const EXPLICIT_URL_MATCHER = createLinkMatcherWithRegExp(/(?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?]/i, (text) =>
  text.toLowerCase().startsWith("www.") ? `https://${text}` : text
);

const DEFAULT_BARE_DOMAIN_TLDS = [
  "app",
  "ai",
  "biz",
  "co",
  "com",
  "dev",
  "edu",
  "gov",
  "io",
  "me",
  "net",
  "org",
  "so",
  "us",
  "uk",
];

const DEFAULT_FILE_EXTENSIONS = [
  "c",
  "css",
  "csv",
  "doc",
  "docx",
  "go",
  "gz",
  "html",
  "jpeg",
  "jpg",
  "js",
  "json",
  "jsx",
  "log",
  "md",
  "pdf",
  "png",
  "py",
  "rb",
  "rs",
  "sh",
  "svg",
  "tar",
  "ts",
  "tsx",
  "txt",
  "yaml",
  "yml",
  "zip",
];

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

function rectsEqual(a: MessageComposerLinkAnchorRect | null, b: MessageComposerLinkAnchorRect | null) {
  if (a === null || b === null) {
    return a === b;
  }
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.right === b.right &&
    a.bottom === b.bottom &&
    a.width === b.width &&
    a.height === b.height
  );
}

function currentLinksEqual(a: MessageComposerCurrentLink | null, b: MessageComposerCurrentLink | null) {
  if (a === null || b === null) {
    return a === b;
  }
  return (
    a.linkKey === b.linkKey &&
    a.url === b.url &&
    a.text === b.text &&
    a.auto === b.auto &&
    rectsEqual(a.anchorRect, b.anchorRect)
  );
}

/** Link under the current selection/caret; mention-scheme links are intentionally ignored. */
export const currentLink$ = Cell<MessageComposerCurrentLink | null>(
  null,
  (previous, next) => previous !== undefined && currentLinksEqual(previous, next)
);

const capturedLinkSelection$ = Cell<RangeSelection | null>(null);

/** Toggles an inline text format on the current selection. */
// Commands are events, not state: distinct must be off so repeating the same
// command (toggle on, toggle off) is not swallowed by reference equality.
export const formatText$ = Stream<MessageComposerTextFormat>(false);

/** Toggles a block type on the current selection; toggling the active type returns to paragraph. */
export const toggleBlock$ = Stream<Exclude<MessageComposerBlockType, "paragraph">>(false);

/** Wraps the selection in a link (payload is the URL) or removes it (null). */
export const toggleLink$ = Stream<string | null>(false);

/** Captures the current editor selection before a link editor steals focus. */
export const beginLinkEdit$ = Stream<void>(false);

/** Applies a URL/text edit to the current link, or creates a link from the captured selection. */
export const editLink$ = Stream<MessageComposerLinkEdit>(false);

/** Removes the current link while preserving its visible text. */
export const removeLink$ = Stream<void>(false);

function normalizeAutoLinkOptionList(values: readonly string[]): Set<string> {
  return new Set(values.map((value) => value.toLowerCase().replace(/^\./, "")));
}

function createBareDomainMatcher({
  bareDomainTlds = DEFAULT_BARE_DOMAIN_TLDS,
  fileExtensions = DEFAULT_FILE_EXTENSIONS,
}: Pick<MessageComposerAutoLinkOptions, "bareDomainTlds" | "fileExtensions"> = {}): LinkMatcher {
  const tlds = normalizeAutoLinkOptionList(bareDomainTlds);
  const extensions = normalizeAutoLinkOptionList(fileExtensions);
  return (text) => {
    const match = /(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}(?:\/[^\s<>()]*)?/i.exec(text);
    if (!match) {
      return null;
    }
    const matchedText = match[0].replace(/[.,;:!?]+$/, "");
    if (matchedText.length === 0) {
      return null;
    }
    const domain = matchedText.split("/")[0];
    const suffix = domain.slice(domain.lastIndexOf(".") + 1).toLowerCase();
    if (extensions.has(suffix) && !tlds.has(suffix)) {
      return null;
    }
    if (!tlds.has(suffix)) {
      return null;
    }
    return {
      index: match.index,
      length: matchedText.length,
      text: matchedText,
      url: `https://${matchedText}`,
    };
  };
}

function autoLinkMatchersFromConfig(config: MessageComposerFormattingConfig | undefined): LinkMatcher[] {
  const autoLink = config?.autoLink;
  if (autoLink === false) {
    return [];
  }
  if (typeof autoLink === "object" && autoLink.matchers) {
    return [...autoLink.matchers];
  }
  const options = typeof autoLink === "object" ? autoLink : {};
  return options.bareDomains === false
    ? [EXPLICIT_URL_MATCHER]
    : [EXPLICIT_URL_MATCHER, createBareDomainMatcher(options)];
}

function isEditableLinkNode(node: LexicalNode | null | undefined): node is LinkNode {
  if (!$isLinkNode(node)) {
    return false;
  }
  if (node.getURL().startsWith(MENTION_URL_SCHEME)) {
    return false;
  }
  return !$isAutoLinkNode(node) || !node.getIsUnlinked();
}

function $findEditableLinkNode(start: LexicalNode | null | undefined): LinkNode | null {
  let node = start;
  while (node) {
    if (isEditableLinkNode(node)) {
      return node;
    }
    node = node.getParent();
  }
  return null;
}

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
  return {
    bold: selection.hasFormat("bold"),
    italic: selection.hasFormat("italic"),
    strikethrough: selection.hasFormat("strikethrough"),
    code: selection.hasFormat("code"),
    blockType: $readBlockType(),
    link: $findEditableLinkNode(anchorNode) !== null,
  };
}

function $readCurrentLink(): Omit<MessageComposerCurrentLink, "anchorRect"> | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return null;
  }
  const anchorLink = $findEditableLinkNode(selection.anchor.getNode());
  if (!anchorLink) {
    return null;
  }
  const focusLink = $findEditableLinkNode(selection.focus.getNode());
  if (focusLink && !focusLink.is(anchorLink)) {
    return null;
  }
  return {
    linkKey: anchorLink.getKey(),
    url: anchorLink.getURL(),
    text: anchorLink.getTextContent(),
    auto: $isAutoLinkNode(anchorLink),
  };
}

function computeLinkAnchorRect(editor: LexicalEditor, linkKey: string): MessageComposerLinkAnchorRect | null {
  const element = editor.getElementByKey(linkKey);
  if (!element) {
    return null;
  }
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function normalizeLinkUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.toLowerCase().startsWith("www.")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function $replaceWithManualLink(linkNode: LinkNode, url: string): LinkNode {
  const replacement = $createLinkNode(url, {
    rel: linkNode.getRel(),
    target: linkNode.getTarget(),
    title: linkNode.getTitle(),
  });
  for (const child of linkNode.getChildren()) {
    replacement.append(child);
  }
  linkNode.replace(replacement);
  return replacement;
}

function $setLinkText(linkNode: LinkNode, text: string): boolean {
  if (text === linkNode.getTextContent()) {
    return false;
  }
  const children = linkNode.getChildren();
  if (children.length === 1 && $isTextNode(children[0])) {
    children[0].setTextContent(text);
    children[0].select(text.length, text.length);
    return true;
  }
  const textNode = $createTextNode(text);
  for (const child of children) {
    child.remove();
  }
  linkNode.append(textNode);
  textNode.select(text.length, text.length);
  return true;
}

function $editLinkNode(linkNode: LinkNode, edit: MessageComposerLinkEdit) {
  const url = normalizeLinkUrl(edit.url);
  if (url.length === 0) {
    return;
  }
  const target = $isAutoLinkNode(linkNode) ? $replaceWithManualLink(linkNode, url) : linkNode;
  target.setURL(url);
  let selectedNewText = false;
  if (edit.text !== undefined) {
    selectedNewText = $setLinkText(target, edit.text.trim() || url);
  }
  if (!selectedNewText) {
    target.selectEnd();
  }
}

function $unlinkNode(linkNode: LinkNode) {
  if ($isAutoLinkNode(linkNode)) {
    linkNode.setIsUnlinked(true);
    linkNode.markDirty();
    return;
  }
  for (const child of linkNode.getChildren()) {
    linkNode.insertBefore(child);
  }
  linkNode.remove();
}

e.sub(formatText$, (format, engine) => {
  engine.getValue(lexicalEditor$)?.dispatchCommand(FORMAT_TEXT_COMMAND, format);
});

e.sub(toggleLink$, (url, engine) => {
  engine.getValue(lexicalEditor$)?.dispatchCommand(TOGGLE_LINK_COMMAND, url);
});

e.sub(beginLinkEdit$, (_, engine) => {
  const editor = engine.getValue(lexicalEditor$);
  if (!editor) {
    return;
  }
  const selection = editor.getEditorState().read(() => {
    const currentSelection = $getSelection();
    return $isRangeSelection(currentSelection) ? currentSelection.clone() : null;
  });
  engine.pub(capturedLinkSelection$, selection);
});

e.sub(editLink$, (edit, engine) => {
  const editor = engine.getValue(lexicalEditor$);
  if (!editor) {
    return;
  }
  const currentLink = engine.getValue(currentLink$);
  const capturedSelection = engine.getValue(capturedLinkSelection$);
  editor.update(
    () => {
      if (currentLink) {
        const linkNode = $getNodeByKey(currentLink.linkKey);
        if (isEditableLinkNode(linkNode)) {
          $editLinkNode(linkNode, edit);
        }
        return;
      }
      const url = normalizeLinkUrl(edit.url);
      if (url.length === 0) {
        return;
      }
      if (capturedSelection) {
        $setSelection(capturedSelection.clone());
      }
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        return;
      }
      if (selection.isCollapsed()) {
        const text = edit.text?.trim() || url;
        const linkNode = $createLinkNode(url);
        linkNode.append($createTextNode(text));
        selection.insertNodes([linkNode]);
        linkNode.selectEnd();
        return;
      }
      $toggleLink(url);
    },
    { discrete: true }
  );
  engine.pub(capturedLinkSelection$, null);
});

e.sub(removeLink$, (_, engine) => {
  const editor = engine.getValue(lexicalEditor$);
  const currentLink = engine.getValue(currentLink$);
  if (!editor || !currentLink) {
    return;
  }
  editor.update(
    () => {
      const linkNode = $getNodeByKey(currentLink.linkKey);
      if (isEditableLinkNode(linkNode)) {
        $unlinkNode(linkNode);
      }
    },
    { discrete: true }
  );
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

/**
 * Plain Enter submits the composer, so it can never reach Lexical's
 * new-list-item handling; Shift+Enter steps in for it inside lists.
 * insertParagraph on a ListItemNode creates the next item, and on an empty
 * trailing item exits the list — Lexical's regular Enter semantics.
 */
function ListShiftEnterPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand<KeyboardEvent | null>(
      KEY_ENTER_COMMAND,
      (event) => {
        if (event === null || !event.shiftKey || event.isComposing || editor.isComposing()) {
          return false;
        }
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return false;
        }
        const anchorNode = selection.anchor.getNode();
        if (!$isListItemNode(anchorNode) && !anchorNode.getParents().some((parent) => $isListItemNode(parent))) {
          return false;
        }
        event.preventDefault();
        // Dispatching (rather than selection.insertParagraph()) routes through
        // ListPlugin's handler, which exits the list from an empty item.
        editor.dispatchCommand(INSERT_PARAGRAPH_COMMAND, undefined);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor]);

  return null;
}

function $isBareCodeFenceShortcut() {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed() || selection.anchor.type !== "text") {
    return false;
  }
  const anchorNode = selection.anchor.getNode();
  if (!$isTextNode(anchorNode) || selection.anchor.offset !== 3 || anchorNode.getTextContent() !== "```") {
    return false;
  }
  const paragraph = anchorNode.getParent();
  if (
    !$isParagraphNode(paragraph) ||
    anchorNode.getTopLevelElement() !== paragraph ||
    paragraph.getChildrenSize() !== 1 ||
    paragraph.getFirstChild() !== anchorNode
  ) {
    return false;
  }
  return true;
}

function $replaceBareCodeFenceWithCodeBlock() {
  if (!$isBareCodeFenceShortcut()) {
    return false;
  }
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) {
    return false;
  }
  const paragraph = selection.anchor.getNode().getTopLevelElement();
  if (!$isParagraphNode(paragraph)) {
    return false;
  }
  const codeNode = $createCodeNode();
  paragraph.replace(codeNode);
  codeNode.select(0, 0);
  return true;
}

function ImmediateCodeBlockShortcutPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState, prevEditorState, dirtyLeaves, tags }) => {
      if (tags.has(COLLABORATION_TAG) || tags.has(HISTORIC_TAG) || editor.isComposing()) {
        return;
      }
      const shouldConvert = editorState.read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed() || selection.anchor.type !== "text") {
          return false;
        }
        const previousSelection = prevEditorState.read($getSelection);
        if (
          !$isRangeSelection(previousSelection) ||
          !previousSelection.isCollapsed() ||
          previousSelection.anchor.key !== selection.anchor.key ||
          previousSelection.anchor.offset !== 2 ||
          !dirtyLeaves.has(selection.anchor.key)
        ) {
          return false;
        }
        return $isBareCodeFenceShortcut();
      });
      if (shouldConvert) {
        editor.update(() => {
          $replaceBareCodeFenceWithCodeBlock();
        });
      }
    });
  }, [editor]);

  return null;
}

function createFormattingPlugins(matchers: LinkMatcher[]) {
  function FormattingPlugins() {
    const autoLink = matchers.length > 0 ? <AutoLinkPlugin matchers={matchers} /> : null;
    return (
      <>
        <ListPlugin />
        <LinkPlugin />
        {autoLink}
        <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
        <ImmediateCodeBlockShortcutPlugin />
        <ListShiftEnterPlugin />
      </>
    );
  }
  return FormattingPlugins;
}

function FormattingPlugins() {
  return (
    <>
      <ListPlugin />
      <LinkPlugin />
      <MarkdownShortcutPlugin transformers={MARKDOWN_TRANSFORMERS} />
      <ImmediateCodeBlockShortcutPlugin />
      <ListShiftEnterPlugin />
    </>
  );
}

function trackFormattingState(engine: Engine) {
  let cleanupEditor: (() => void) | null = null;
  const unsubEditorCell = engine.sub(lexicalEditor$, (editor: LexicalEditor | null) => {
    cleanupEditor?.();
    cleanupEditor = null;
    if (!editor) {
      engine.pubIn({ [formattingState$]: INITIAL_FORMATTING_STATE, [currentLink$]: null });
      return;
    }
    const publishState = () => {
      const editorState = editor.getEditorState();
      const formattingState = editorState.read($readFormattingState);
      const currentLink = editorState.read($readCurrentLink);
      engine.pubIn({
        [formattingState$]: formattingState,
        [currentLink$]: currentLink
          ? { ...currentLink, anchorRect: computeLinkAnchorRect(editor, currentLink.linkKey) }
          : null,
      });
    };
    publishState();
    cleanupEditor = editor.registerUpdateListener(publishState);
  });
  return () => {
    cleanupEditor?.();
    unsubEditorCell();
  };
}

export function formattingPlugin(config?: MessageComposerFormattingConfig): MessageComposerPlugin {
  const autoLinkMatchers = autoLinkMatchersFromConfig(config);
  return {
    id: "formatting",
    init: ({ engine }) => trackFormattingState(engine),
    lexicalNodes: [AutoLinkNode],
    lexicalPlugins: [autoLinkMatchers.length > 0 ? createFormattingPlugins(autoLinkMatchers) : FormattingPlugins],
  };
}
