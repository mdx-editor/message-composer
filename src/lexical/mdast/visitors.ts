// Visitors for the composer's MVP markdown subset, ported from the
// corresponding ../editor (MDXEditor) plugin visitors. Deviations: code blocks
// target Lexical's CodeNode instead of MDXEditor's editor-backed custom node;
// checklists are out of the subset (task-list markers import as bullets); a
// low-priority fallback visitor degrades unsupported constructs to plain text
// instead of throwing.
import { $createCodeNode, $isCodeNode, type CodeNode } from "@lexical/code";
import { $createLinkNode, $isAutoLinkNode, $isLinkNode, type LinkNode } from "@lexical/link";
import {
  $createListItemNode,
  $createListNode,
  $isListItemNode,
  $isListNode,
  type ListItemNode,
  type ListNode,
} from "@lexical/list";
import { $createQuoteNode, $isQuoteNode, type QuoteNode } from "@lexical/rich-text";
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $isDecoratorNode,
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isRootNode,
  $isTextNode,
  type ElementNode,
  type LineBreakNode,
  type ParagraphNode,
  type RootNode,
  type TextNode,
} from "lexical";
import type * as Mdast from "mdast";

import type { LexicalExportVisitor, LexicalVisitor } from "./exportMarkdownFromLexical.ts";
import { IS_BOLD, IS_CODE, IS_ITALIC, IS_STRIKETHROUGH } from "./FormatConstants.ts";
import type { MdastImportVisitor } from "./importMarkdownToLexical.ts";

const MdastRootVisitor: MdastImportVisitor<Mdast.Root> = {
  testNode: "root",
  visitNode({ actions, mdastNode, lexicalParent }) {
    actions.visitChildren(mdastNode, lexicalParent);
  },
};

const MdastParagraphVisitor: MdastImportVisitor<Mdast.Paragraph> = {
  testNode: "paragraph",
  visitNode({ mdastNode, mdastParent, lexicalParent, actions }) {
    // markdown inserts paragraphs in lists; lexical does not.
    if (lexicalParent.getType() === "listitem") {
      const mdastNodeIndex = mdastParent?.children.indexOf(mdastNode) ?? -1;
      const previousMdastSibling = mdastNodeIndex > 0 ? mdastParent?.children.at(mdastNodeIndex - 1) : undefined;
      if (previousMdastSibling?.type === "paragraph") {
        (lexicalParent as ElementNode).append($createLineBreakNode(), $createLineBreakNode());
      }
      actions.visitChildren(mdastNode, lexicalParent);
    } else {
      actions.addAndStepInto($createParagraphNode());
    }
  },
};

const MdastTextVisitor: MdastImportVisitor<Mdast.Text> = {
  testNode: "text",
  visitNode({ mdastNode, actions }) {
    const node = $createTextNode(mdastNode.value);
    node.setFormat(actions.getParentFormatting());
    actions.addAndStepInto(node);
  },
};

const MdastBreakVisitor: MdastImportVisitor<Mdast.Break> = {
  testNode: "break",
  visitNode({ lexicalParent }) {
    (lexicalParent as ElementNode).append($createLineBreakNode());
  },
};

const MdEmphasisVisitor: MdastImportVisitor<Mdast.Emphasis> = {
  testNode: "emphasis",
  visitNode({ mdastNode, actions, lexicalParent }) {
    actions.addFormatting(IS_ITALIC);
    actions.visitChildren(mdastNode, lexicalParent);
  },
};

const MdStrongVisitor: MdastImportVisitor<Mdast.Strong> = {
  testNode: "strong",
  visitNode({ mdastNode, actions, lexicalParent }) {
    actions.addFormatting(IS_BOLD);
    actions.visitChildren(mdastNode, lexicalParent);
  },
};

const MdStrikeThroughVisitor: MdastImportVisitor<Mdast.Delete> = {
  testNode: "delete",
  visitNode({ mdastNode, actions, lexicalParent }) {
    actions.addFormatting(IS_STRIKETHROUGH);
    actions.visitChildren(mdastNode, lexicalParent);
  },
};

const MdastInlineCodeVisitor: MdastImportVisitor<Mdast.InlineCode> = {
  testNode: "inlineCode",
  visitNode({ mdastNode, actions }) {
    actions.addAndStepInto($createTextNode(mdastNode.value).setFormat(actions.getParentFormatting() | IS_CODE));
  },
};

const MdastListVisitor: MdastImportVisitor<Mdast.List> = {
  testNode: "list",
  visitNode({ mdastNode, lexicalParent, actions }) {
    const lexicalNode = $createListNode(mdastNode.ordered ? "number" : "bullet");

    if ($isListItemNode(lexicalParent)) {
      const dedicatedParent = $createListItemNode();
      dedicatedParent.append(lexicalNode);
      lexicalParent.insertAfter(dedicatedParent);
    } else {
      (lexicalParent as ElementNode).append(lexicalNode);
    }

    actions.visitChildren(mdastNode, lexicalNode);
  },
};

const MdastListItemVisitor: MdastImportVisitor<Mdast.ListItem> = {
  testNode: "listItem",
  visitNode({ actions }) {
    actions.addAndStepInto($createListItemNode());
  },
};

const MdastBlockQuoteVisitor: MdastImportVisitor<Mdast.Blockquote> = {
  testNode: "blockquote",
  visitNode({ actions }) {
    actions.addAndStepInto($createQuoteNode());
  },
};

const MdastCodeVisitor: MdastImportVisitor<Mdast.Code> = {
  testNode: "code",
  visitNode({ mdastNode, lexicalParent }) {
    const codeNode = $createCodeNode(mdastNode.lang ?? undefined);
    const lines = mdastNode.value.split("\n");
    for (const [index, line] of lines.entries()) {
      if (index > 0) {
        codeNode.append($createLineBreakNode());
      }
      if (line.length > 0) {
        codeNode.append($createTextNode(line));
      }
    }
    (lexicalParent as ElementNode).append(codeNode);
  },
};

const MdastLinkVisitor: MdastImportVisitor<Mdast.Link> = {
  testNode: "link",
  visitNode({ mdastNode, actions }) {
    actions.addAndStepInto($createLinkNode(mdastNode.url, { title: mdastNode.title }));
  },
};

/**
 * Degrades unsupported constructs to readable plain text instead of failing
 * the whole import: block-level parents become paragraphs of their text
 * content, literals become text nodes.
 */
const MdastFallbackVisitor: MdastImportVisitor<Mdast.RootContent> = {
  priority: -100,
  testNode: () => true,
  visitNode({ mdastNode, lexicalParent, actions }) {
    if ("value" in mdastNode && typeof mdastNode.value === "string") {
      const target = lexicalParent.getType() === "root" ? $createParagraphNode() : null;
      const text = $createTextNode(mdastNode.value).setFormat(actions.getParentFormatting());
      if (target) {
        target.append(text);
        (lexicalParent as ElementNode).append(target);
      } else {
        (lexicalParent as ElementNode).append(text);
      }
      return;
    }
    if ("children" in mdastNode) {
      if (lexicalParent.getType() === "root") {
        actions.addAndStepInto($createParagraphNode());
      } else {
        actions.visitChildren(mdastNode, lexicalParent);
      }
    }
  },
};

export const coreImportVisitors: MdastImportVisitor<Mdast.RootContent>[] = [
  MdastRootVisitor as unknown as MdastImportVisitor<Mdast.RootContent>,
  MdastParagraphVisitor as MdastImportVisitor<Mdast.RootContent>,
  MdastTextVisitor as MdastImportVisitor<Mdast.RootContent>,
  MdastBreakVisitor as MdastImportVisitor<Mdast.RootContent>,
  MdEmphasisVisitor as MdastImportVisitor<Mdast.RootContent>,
  MdStrongVisitor as MdastImportVisitor<Mdast.RootContent>,
  MdStrikeThroughVisitor as MdastImportVisitor<Mdast.RootContent>,
  MdastInlineCodeVisitor as MdastImportVisitor<Mdast.RootContent>,
  MdastListVisitor as MdastImportVisitor<Mdast.RootContent>,
  MdastListItemVisitor as MdastImportVisitor<Mdast.RootContent>,
  MdastBlockQuoteVisitor as MdastImportVisitor<Mdast.RootContent>,
  MdastCodeVisitor as MdastImportVisitor<Mdast.RootContent>,
  MdastLinkVisitor as MdastImportVisitor<Mdast.RootContent>,
  MdastFallbackVisitor,
];

const LexicalRootVisitor: LexicalExportVisitor<RootNode, Mdast.Root> = {
  testLexicalNode: $isRootNode,
  visitLexicalNode: ({ actions }) => {
    actions.addAndStepInto("root");
  },
};

const LexicalParagraphVisitor: LexicalExportVisitor<ParagraphNode, Mdast.Paragraph> = {
  testLexicalNode: $isParagraphNode,
  visitLexicalNode: ({ actions }) => {
    actions.addAndStepInto("paragraph");
  },
};

const LexicalLinebreakVisitor: LexicalExportVisitor<LineBreakNode, Mdast.Text> = {
  testLexicalNode: $isLineBreakNode,
  visitLexicalNode: ({ mdastParent, actions }) => {
    actions.appendToParent(mdastParent, { type: "text", value: "\n" });
  },
};

function isMdastText(mdastNode: Mdast.Nodes): mdastNode is Mdast.Text {
  return mdastNode.type === "text";
}

const LexicalTextVisitor: LexicalExportVisitor<TextNode, Mdast.Text> = {
  shouldJoin: (prevNode, currentNode) => {
    return ["text", "emphasis", "strong", "delete"].includes(prevNode.type) && prevNode.type === currentNode.type;
  },

  join<T extends Mdast.RootContent>(prevNode: T, currentNode: T) {
    if (isMdastText(prevNode) && isMdastText(currentNode)) {
      return {
        type: "text",
        value: prevNode.value + currentNode.value,
      } as unknown as T;
    }
    return {
      ...prevNode,
      children: [
        ...(prevNode as unknown as Mdast.Parent).children,
        ...(currentNode as unknown as Mdast.Parent).children,
      ],
    };
  },

  testLexicalNode: $isTextNode,
  visitLexicalNode: ({ lexicalNode, mdastParent, actions }) => {
    const previousSibling = lexicalNode.getPreviousSibling();
    const prevFormat = $isTextNode(previousSibling) ? previousSibling.getFormat() : 0;
    const format = lexicalNode.getFormat();
    const textContent = lexicalNode.getTextContent();

    let localParentNode = mdastParent;

    // Continue format runs started by the previous sibling so adjacent
    // identically-formatted nodes share one wrapper (joined later)...
    if (prevFormat & format & IS_ITALIC) {
      localParentNode = actions.appendToParent(localParentNode, {
        type: "emphasis",
        children: [],
      }) as Mdast.Parent;
    }
    if (prevFormat & format & IS_BOLD) {
      localParentNode = actions.appendToParent(localParentNode, {
        type: "strong",
        children: [],
      }) as Mdast.Parent;
    }
    if (prevFormat & format & IS_STRIKETHROUGH) {
      localParentNode = actions.appendToParent(localParentNode, {
        type: "delete",
        children: [],
      }) as Mdast.Parent;
    }

    // ...then open wrappers for formats this node introduces.
    if (format & IS_ITALIC && !(prevFormat & IS_ITALIC)) {
      localParentNode = actions.appendToParent(localParentNode, {
        type: "emphasis",
        children: [],
      }) as Mdast.Parent;
    }
    if (format & IS_BOLD && !(prevFormat & IS_BOLD)) {
      localParentNode = actions.appendToParent(localParentNode, {
        type: "strong",
        children: [],
      }) as Mdast.Parent;
    }
    if (format & IS_STRIKETHROUGH && !(prevFormat & IS_STRIKETHROUGH)) {
      localParentNode = actions.appendToParent(localParentNode, {
        type: "delete",
        children: [],
      }) as Mdast.Parent;
    }

    if (format & IS_CODE) {
      actions.appendToParent(localParentNode, {
        type: "inlineCode",
        value: textContent,
      });
      return;
    }

    actions.appendToParent(localParentNode, {
      type: "text",
      value: textContent,
    });
  },
};

const LexicalListVisitor: LexicalExportVisitor<ListNode, Mdast.List> = {
  testLexicalNode: $isListNode,
  visitLexicalNode: ({ lexicalNode, actions }) => {
    actions.addAndStepInto("list", {
      ordered: lexicalNode.getListType() === "number",
      spread: false,
    });
  },
};

const LexicalListItemVisitor: LexicalExportVisitor<ListItemNode, Mdast.ListItem> = {
  testLexicalNode: $isListItemNode,
  visitLexicalNode: ({ lexicalNode, mdastParent, actions }) => {
    const children = lexicalNode.getChildren();
    const firstChild = children[0];

    if (children.length === 1 && $isListNode(firstChild)) {
      // a list item containing only a nested list belongs to the previous item
      const prevListItemNode = mdastParent.children.at(-1) as Mdast.ListItem | undefined;
      if (!prevListItemNode) {
        actions.visitChildren(firstChild as unknown as ListItemNode, mdastParent);
      } else {
        actions.visitChildren(lexicalNode, prevListItemNode);
      }
    } else {
      const listItem = actions.appendToParent(mdastParent, {
        type: "listItem" as const,
        spread: false,
        children: [],
      }) as Mdast.ListItem;
      // inline children get nested in a paragraph for mdast compatibility
      let surroundingParagraph: Mdast.Paragraph | null = null;
      for (const child of children) {
        if (
          $isTextNode(child) ||
          $isLineBreakNode(child) ||
          (child.isInline() && ($isElementNode(child) || $isDecoratorNode(child)))
        ) {
          surroundingParagraph ??= actions.appendToParent(listItem, {
            type: "paragraph" as const,
            children: [],
          }) as Mdast.Paragraph;
          actions.visit(child, surroundingParagraph);
        } else {
          surroundingParagraph = null;
          actions.visit(child, listItem);
        }
      }
    }
  },
};

const LexicalQuoteVisitor: LexicalExportVisitor<QuoteNode, Mdast.Blockquote> = {
  testLexicalNode: $isQuoteNode,
  visitLexicalNode: ({ actions }) => {
    actions.addAndStepInto("blockquote");
  },
};

const LexicalCodeVisitor: LexicalExportVisitor<CodeNode, Mdast.Code> = {
  testLexicalNode: $isCodeNode,
  visitLexicalNode: ({ lexicalNode, actions }) => {
    actions.addAndStepInto(
      "code",
      {
        lang: lexicalNode.getLanguage() ?? null,
        value: lexicalNode.getTextContent(),
      },
      false
    );
  },
};

const LexicalLinkVisitor: LexicalExportVisitor<LinkNode, Mdast.Link> = {
  testLexicalNode: $isLinkNode,
  visitLexicalNode: ({ lexicalNode, mdastParent, actions }) => {
    if ($isAutoLinkNode(lexicalNode) && lexicalNode.getIsUnlinked()) {
      actions.visitChildren(lexicalNode, mdastParent);
      return;
    }
    actions.addAndStepInto("link", { url: lexicalNode.getURL(), title: lexicalNode.getTitle() });
  },
};

export const coreExportVisitors: LexicalVisitor[] = [
  LexicalRootVisitor as unknown as LexicalVisitor,
  LexicalParagraphVisitor as LexicalVisitor,
  LexicalTextVisitor as LexicalVisitor,
  LexicalLinebreakVisitor as LexicalVisitor,
  LexicalListVisitor as LexicalVisitor,
  LexicalListItemVisitor as LexicalVisitor,
  LexicalQuoteVisitor as LexicalVisitor,
  LexicalCodeVisitor as LexicalVisitor,
  LexicalLinkVisitor as LexicalVisitor,
];
