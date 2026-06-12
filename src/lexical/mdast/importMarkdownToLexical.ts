// Ported from ../editor (MDXEditor) importMarkdownToLexical.ts. The MDXEditor
// descriptor concepts (JSX components, directives, code-block editors) and the
// ESM import metadata are stripped; visitor and action shapes stay close to the
// source so the two implementations can be reconciled into a shared package.
import type { ElementNode, LexicalNode } from "lexical";
import type * as Mdast from "mdast";
import {
  fromMarkdown,
  type Extension as FromMarkdownExtension,
  type Options as FromMarkdownOptions,
} from "mdast-util-from-markdown";
import { toMarkdown } from "mdast-util-to-markdown";

import type { FORMAT } from "./FormatConstants.ts";

export type MdastExtension = FromMarkdownExtension | FromMarkdownExtension[];

export interface MdastImportVisitor<UN extends Mdast.Nodes> {
  /**
   * Determines whether this visitor handles the given node. A string is
   * compared against the node's type.
   */
  testNode: ((mdastNode: Mdast.Nodes) => boolean) | string;
  visitNode(params: {
    mdastNode: UN;
    mdastParent: Mdast.Parent | null;
    lexicalParent: LexicalNode;
    actions: {
      /** Iterate the children of the node with the lexical node as the parent. */
      visitChildren(node: Mdast.Parent, lexicalParent: LexicalNode): void;
      /**
       * Add the given node to the lexical tree, and iterate the current mdast
       * node's children with the newly created lexical node as a parent.
       */
      addAndStepInto(lexicalNode: LexicalNode): void;
      /**
       * Adds formatting as a context for the current node and its children.
       * mdast treats formatting as nodes, while lexical stores it as a bitmask
       * attribute of text nodes.
       */
      addFormatting(format: FORMAT, node?: Mdast.Parent | null): void;
      removeFormatting(format: FORMAT, node?: Mdast.Parent | null): void;
      getParentFormatting(): number;
      /** Go to the next visitor in the chain that matches the node. */
      nextVisitor(): void;
    };
  }): void;
  /** Default 0; the higher the number, the earlier the visitor is consulted. */
  priority?: number;
}

function isParent(node: unknown): node is Mdast.Parent {
  return (node as { children?: unknown[] }).children instanceof Array;
}

export interface ImportPoint {
  append(node: LexicalNode): void;
  getType(): string;
}

export interface MdastTreeImportOptions {
  root: ImportPoint;
  visitors: MdastImportVisitor<Mdast.RootContent>[];
  mdastRoot: Mdast.Root;
}

export interface MarkdownParseOptions extends Omit<MdastTreeImportOptions, "mdastRoot"> {
  markdown: string;
  syntaxExtensions: NonNullable<FromMarkdownOptions["extensions"]>;
  mdastExtensions: MdastExtension[];
}

export type SyntaxExtension = MarkdownParseOptions["syntaxExtensions"][number];

export class MarkdownParseError extends Error {
  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "MarkdownParseError";
    this.cause = cause;
  }
}

export class UnrecognizedMarkdownConstructError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnrecognizedMarkdownConstructError";
  }
}

export function importMarkdownToLexical({
  root,
  markdown,
  visitors,
  syntaxExtensions,
  mdastExtensions,
}: MarkdownParseOptions): void {
  let mdastRoot: Mdast.Root;
  try {
    mdastRoot = fromMarkdown(markdown, {
      extensions: syntaxExtensions,
      mdastExtensions,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new MarkdownParseError(`Error parsing markdown: ${error.message}`, error);
    } else {
      throw new MarkdownParseError(`Error parsing markdown: ${String(error)}`, error);
    }
  }

  if (mdastRoot.children.length === 0) {
    mdastRoot.children.push({ type: "paragraph", children: [] });
  }

  // Leave a trailing empty paragraph so the user can type after a trailing
  // non-paragraph block; export trims it away again.
  if (mdastRoot.children.at(-1)?.type !== "paragraph") {
    mdastRoot.children.push({ type: "paragraph", children: [] });
  }

  importMdastTreeToLexical({ root, mdastRoot, visitors });
}

export function importMdastTreeToLexical({ root, mdastRoot, visitors }: MdastTreeImportOptions): void {
  const formattingMap = new WeakMap<Mdast.Parent, number>();

  const sortedVisitors = [...visitors].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  function visitChildren(mdastNode: Mdast.Parent, lexicalParent: LexicalNode) {
    if (!isParent(mdastNode)) {
      throw new Error("Attempting to visit children of a non-parent");
    }
    for (const child of mdastNode.children) {
      visit(child, lexicalParent, mdastNode);
    }
  }

  function visit(
    mdastNode: Mdast.RootContent | Mdast.Root,
    lexicalParent: LexicalNode,
    mdastParent: Mdast.Parent | null,
    skipVisitors: Set<number> | null = null
  ) {
    const visitor = sortedVisitors.find((candidate, index) => {
      if (skipVisitors?.has(index)) {
        return false;
      }
      if (typeof candidate.testNode === "string") {
        return candidate.testNode === mdastNode.type;
      }
      return candidate.testNode(mdastNode);
    });
    if (!visitor) {
      let serialized: string;
      try {
        serialized = toMarkdown(mdastNode as Mdast.Nodes);
      } catch {
        serialized = JSON.stringify({ type: mdastNode.type });
      }
      throw new UnrecognizedMarkdownConstructError(`Unsupported markdown syntax: ${serialized}`);
    }

    visitor.visitNode({
      // the root node glitches the generic the same way it does in the source
      mdastNode: mdastNode as never,
      lexicalParent,
      mdastParent,
      actions: {
        visitChildren,
        nextVisitor() {
          visit(
            mdastNode,
            lexicalParent,
            mdastParent,
            (skipVisitors ?? new Set()).add(sortedVisitors.indexOf(visitor))
          );
        },
        addAndStepInto(lexicalNode) {
          (lexicalParent as ElementNode).append(lexicalNode);
          if (isParent(mdastNode)) {
            visitChildren(mdastNode, lexicalNode);
          }
        },
        addFormatting(format, node) {
          const target = node ?? (isParent(mdastNode) ? mdastNode : null);
          if (target) {
            formattingMap.set(target, format | (mdastParent ? (formattingMap.get(mdastParent) ?? 0) : 0));
          }
        },
        removeFormatting(format, node) {
          const target = node ?? (isParent(mdastNode) ? mdastNode : null);
          if (target) {
            formattingMap.set(target, format ^ (mdastParent ? (formattingMap.get(mdastParent) ?? 0) : 0));
          }
        },
        getParentFormatting() {
          return mdastParent ? (formattingMap.get(mdastParent) ?? 0) : 0;
        },
      },
    });
  }

  visit(mdastRoot, root as unknown as LexicalNode, null);
}
