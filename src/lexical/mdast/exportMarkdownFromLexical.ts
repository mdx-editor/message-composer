// Ported from ../editor (MDXEditor) exportMarkdownFromLexical.ts. The JSX
// import-statement machinery, frontmatter handling, and HTML/JSX post-passes
// are stripped; the visitor walk, join mechanism, and the wrapping-whitespace
// fix stay close to the source for future reconciliation.
import {
  $isElementNode,
  type ElementNode as LexicalElementNode,
  type LexicalNode,
  type RootNode as LexicalRootNode,
} from "lexical";
import type * as Mdast from "mdast";
import { toMarkdown, type Options as MdastToMarkdownOptions } from "mdast-util-to-markdown";

export type ToMarkdownOptions = MdastToMarkdownOptions;
export type ToMarkdownExtension = NonNullable<MdastToMarkdownOptions["extensions"]>[number];

export interface LexicalExportVisitor<LN extends LexicalNode, UN extends Mdast.Nodes> {
  /**
   * Return true if the given node is of the type that this visitor can process.
   * Node type guard functions ($isParagraphNode etc.) are safe to use here.
   */
  testLexicalNode?(lexicalNode: LexicalNode): lexicalNode is LN;
  visitLexicalNode?(params: {
    lexicalNode: LN;
    mdastParent: Mdast.Parent;
    actions: {
      /** Iterate over the immediate children of a lexical node with the given mdast node as a parent. */
      visitChildren(node: LN, mdastParent: Mdast.Parent): void;
      /**
       * Create a new mdast node with the given type and props, append it, and
       * iterate the current lexical node's children with it as the parent
       * (unless hasChildren is false).
       */
      addAndStepInto(type: string, props?: Record<string, unknown>, hasChildren?: boolean): void;
      /** Append a new mdast node to a parent node. */
      appendToParent<T extends Mdast.Parent>(
        parentNode: T,
        node: T["children"][number]
      ): T["children"][number] | Mdast.Root;
      /** Visit the specified lexical node. */
      visit(node: LexicalNode, parent: Mdast.Parent): void;
      /** Go to the next visitor in the chain that matches the node. */
      nextVisitor(): void;
    };
  }): void;

  /**
   * Return true if the current node should be joined with the previous node.
   * Necessary because lexical stores formatting as text attributes while mdast
   * nests formatting nodes.
   */
  shouldJoin?(prevNode: Mdast.RootContent, currentNode: UN): boolean;

  /** Join the current node with the previous node when shouldJoin returned true. */
  join?<T extends Mdast.RootContent>(prevNode: T, currentNode: T): T;

  /** Default 0; the higher the number, the earlier the visitor is consulted. */
  priority?: number;
}

export type LexicalVisitor = LexicalExportVisitor<LexicalNode, Mdast.RootContent>;

export interface ExportLexicalTreeOptions {
  root: LexicalRootNode;
  visitors: LexicalVisitor[];
}

function isParent(node: unknown): node is Mdast.Parent {
  return (node as { children?: unknown[] }).children instanceof Array;
}

export function exportLexicalTreeToMdast({ root, visitors }: ExportLexicalTreeOptions): Mdast.Root {
  let unistRoot: Mdast.Root | null = null;

  const sortedVisitors = [...visitors].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  function appendToParent<C extends Mdast.RootContent>(parentNode: Mdast.Parent, node: C): C | Mdast.Root {
    if (unistRoot === null) {
      unistRoot = node as unknown as Mdast.Root;
      return unistRoot;
    }

    if (!isParent(parentNode)) {
      throw new Error("Attempting to append children to a non-parent");
    }

    const siblings = parentNode.children;
    const prevSibling = siblings.at(-1);

    if (prevSibling) {
      const joinVisitor = sortedVisitors.find((visitor) => visitor.shouldJoin?.(prevSibling, node));
      if (joinVisitor) {
        const joinedNode = joinVisitor.join!(prevSibling, node) as C;
        siblings.splice(siblings.length - 1, 1, joinedNode);
        return joinedNode;
      }
    }

    siblings.push(node);
    return node;
  }

  function visitChildren(lexicalNode: LexicalElementNode, parentNode: Mdast.Parent) {
    for (const lexicalChild of lexicalNode.getChildren()) {
      visit(lexicalChild, parentNode);
    }
  }

  function visit(lexicalNode: LexicalNode, mdastParent: Mdast.Parent | null, usedVisitors: Set<number> | null = null) {
    const visitor = sortedVisitors.find((candidate, index) => {
      if (usedVisitors?.has(index)) {
        return false;
      }
      return candidate.testLexicalNode?.(lexicalNode);
    });
    if (!visitor) {
      throw new Error(`no lexical visitor found for ${lexicalNode.getType()}`, {
        cause: lexicalNode,
      });
    }
    visitor.visitLexicalNode?.({
      lexicalNode,
      mdastParent: mdastParent!,
      actions: {
        addAndStepInto(type: string, props = {}, hasChildren = true) {
          const newNode = {
            type,
            ...props,
            ...(hasChildren ? { children: [] } : {}),
          };
          appendToParent(mdastParent!, newNode as unknown as Mdast.RootContent);
          if ($isElementNode(lexicalNode) && hasChildren) {
            visitChildren(lexicalNode, newNode as Mdast.Parent);
          }
        },
        appendToParent,
        visitChildren: visitChildren as (node: LexicalNode, mdastParent: Mdast.Parent) => void,
        visit,
        nextVisitor() {
          visit(lexicalNode, mdastParent, (usedVisitors ?? new Set()).add(sortedVisitors.indexOf(visitor)));
        },
      },
    });
  }

  visit(root, null);

  if (unistRoot === null) {
    throw new Error("traversal ended with no root element");
  }

  fixWrappingWhitespace(unistRoot, []);

  return unistRoot;
}

const TRAILING_WHITESPACE_REGEXP = /\s+$/;
const LEADING_WHITESPACE_REGEXP = /^\s+/;

// Emphasis markers cannot wrap whitespace in markdown ("** bold**" is not
// valid), so whitespace at the edges of strong/emphasis nodes moves out to the
// surrounding text.
function fixWrappingWhitespace(node: Mdast.Parent | Mdast.RootContent, parentChain: Mdast.Parent[]) {
  if (node.type === "strong" || node.type === "emphasis") {
    const lastChild = node.children.at(-1);
    if (lastChild?.type === "text") {
      const trailingWhitespace = TRAILING_WHITESPACE_REGEXP.exec(lastChild.value);
      if (trailingWhitespace) {
        lastChild.value = lastChild.value.replace(TRAILING_WHITESPACE_REGEXP, "");
        const parent = parentChain.at(-1);
        if (parent) {
          parent.children.splice(parent.children.indexOf(node as unknown as Mdast.RootContent) + 1, 0, {
            type: "text",
            value: trailingWhitespace[0],
          });
          fixWrappingWhitespace(parent, parentChain.slice(0, -1));
        }
      }
    }
    const firstChild = node.children.at(0);
    if (firstChild?.type === "text") {
      const leadingWhitespace = LEADING_WHITESPACE_REGEXP.exec(firstChild.value);
      if (leadingWhitespace) {
        firstChild.value = firstChild.value.replace(LEADING_WHITESPACE_REGEXP, "");
        const parent = parentChain.at(-1);
        if (parent) {
          parent.children.splice(parent.children.indexOf(node as unknown as Mdast.RootContent), 0, {
            type: "text",
            value: leadingWhitespace[0],
          });
          fixWrappingWhitespace(parent, parentChain.slice(0, -1));
        }
      }
    }
  }
  if ("children" in node && node.children.length > 0) {
    const nodeAsParent = node as Mdast.Parent;
    for (const child of nodeAsParent.children) {
      fixWrappingWhitespace(child, [...parentChain, nodeAsParent]);
    }
  }
}

export interface ExportMarkdownFromLexicalOptions extends ExportLexicalTreeOptions {
  toMarkdownExtensions: ToMarkdownExtension[];
  toMarkdownOptions: ToMarkdownOptions;
}

/**
 * Unlike the source implementation, the result is trimmed: the composer's
 * draft value contract has no trailing newline, and the empty document must
 * export as the empty string for echo equality.
 */
export function exportMarkdownFromLexical({
  root,
  toMarkdownOptions,
  toMarkdownExtensions,
  visitors,
}: ExportMarkdownFromLexicalOptions): string {
  return toMarkdown(exportLexicalTreeToMdast({ root, visitors }), {
    extensions: toMarkdownExtensions,
    ...toMarkdownOptions,
  }).trimEnd();
}
