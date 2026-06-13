import {
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  CODE,
  INLINE_CODE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  LINK,
  ORDERED_LIST,
  QUOTE,
  STRIKETHROUGH,
  UNORDERED_LIST,
  type Transformer,
} from "@lexical/markdown";
import type { Engine } from "@virtuoso.dev/reactive-engine-core";
import { $getRoot } from "lexical";
import type * as Mdast from "mdast";

import {
  exportMarkdownFromLexical,
  type LexicalVisitor,
  type ToMarkdownExtension,
  type ToMarkdownOptions,
} from "./mdast/exportMarkdownFromLexical.ts";
import {
  importMarkdownToLexical,
  type MdastExtension,
  type MdastImportVisitor,
  type SyntaxExtension,
} from "./mdast/importMarkdownToLexical.ts";
import {
  defaultMdastExtensions,
  defaultSyntaxExtensions,
  defaultToMarkdownExtensions,
  defaultToMarkdownOptions,
  exportVisitors$,
  importVisitors$,
  mdastExtensions$,
  syntaxExtensions$,
  toMarkdownExtensions$,
  toMarkdownOptions$,
} from "./mdast/registry.ts";
import { coreExportVisitors, coreImportVisitors } from "./mdast/visitors.ts";

/**
 * Markdown typing shortcuts still run on Lexical's transformer subset; the
 * value conversion itself goes through the mdast visitor pipeline. Keep this
 * aligned to formatting-plugin capabilities: no headings, checklists,
 * thematic breaks, MDX, or tables until those capabilities exist. The
 * immediate bare-triple-backtick shortcut is implemented by the formatting
 * plugin because Lexical's markdown shortcut plugin waits for a trigger
 * character after block syntax.
 */
export const MARKDOWN_TRANSFORMERS: Transformer[] = [
  CODE,
  QUOTE,
  UNORDERED_LIST,
  ORDERED_LIST,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  STRIKETHROUGH,
  INLINE_CODE,
  LINK,
];

export interface MarkdownConversionOptions {
  importVisitors: MdastImportVisitor<Mdast.RootContent>[];
  exportVisitors: LexicalVisitor[];
  syntaxExtensions: SyntaxExtension[];
  mdastExtensions: MdastExtension[];
  toMarkdownExtensions: ToMarkdownExtension[];
  toMarkdownOptions: ToMarkdownOptions;
}

const DEFAULT_CONVERSION_OPTIONS: MarkdownConversionOptions = {
  importVisitors: coreImportVisitors,
  exportVisitors: coreExportVisitors,
  syntaxExtensions: defaultSyntaxExtensions,
  mdastExtensions: defaultMdastExtensions,
  toMarkdownExtensions: defaultToMarkdownExtensions,
  toMarkdownOptions: defaultToMarkdownOptions,
};

/** Reads the conversion configuration of a composer engine, registry cells included. */
export function markdownConversionOptionsFromEngine(engine: Engine): MarkdownConversionOptions {
  return {
    importVisitors: engine.getValue(importVisitors$),
    exportVisitors: engine.getValue(exportVisitors$),
    syntaxExtensions: engine.getValue(syntaxExtensions$),
    mdastExtensions: engine.getValue(mdastExtensions$),
    toMarkdownExtensions: engine.getValue(toMarkdownExtensions$),
    toMarkdownOptions: engine.getValue(toMarkdownOptions$),
  };
}

/** Replaces the editor content with the given markdown. Must run inside editor.update. */
export function $importMarkdown(
  markdown: string,
  options: MarkdownConversionOptions = DEFAULT_CONVERSION_OPTIONS
): void {
  const root = $getRoot();
  root.clear();
  importMarkdownToLexical({
    root,
    markdown,
    visitors: options.importVisitors,
    syntaxExtensions: options.syntaxExtensions,
    mdastExtensions: options.mdastExtensions,
  });
}

/** Serializes the editor content to markdown. Must run inside editor.read/update. */
export function $exportMarkdown(options: MarkdownConversionOptions = DEFAULT_CONVERSION_OPTIONS): string {
  return exportMarkdownFromLexical({
    root: $getRoot(),
    visitors: options.exportVisitors,
    toMarkdownExtensions: options.toMarkdownExtensions,
    toMarkdownOptions: options.toMarkdownOptions,
  });
}
