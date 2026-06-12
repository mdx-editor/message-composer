// Internal registries for the markdown pipeline. These cells are deliberately
// not exported from the package index (decided 2026-06-12); plugins extend
// them through their init context, and the surface goes public no earlier than
// the mentions stage.
import { Cell } from "@virtuoso.dev/reactive-engine-core";
import type * as Mdast from "mdast";
import { gfmStrikethroughFromMarkdown, gfmStrikethroughToMarkdown } from "mdast-util-gfm-strikethrough";
import { gfmStrikethrough } from "micromark-extension-gfm-strikethrough";

import type { LexicalVisitor, ToMarkdownExtension, ToMarkdownOptions } from "./exportMarkdownFromLexical.ts";
import type { MdastExtension, MdastImportVisitor, SyntaxExtension } from "./importMarkdownToLexical.ts";
import { coreExportVisitors, coreImportVisitors } from "./visitors.ts";

export const defaultSyntaxExtensions: SyntaxExtension[] = [gfmStrikethrough()];
export const defaultMdastExtensions: MdastExtension[] = [gfmStrikethroughFromMarkdown()];
export const defaultToMarkdownExtensions: ToMarkdownExtension[] = [gfmStrikethroughToMarkdown()];

// ../editor's DEFAULT_MARKDOWN_OPTIONS — the adopted serialization dialect.
export const defaultToMarkdownOptions: ToMarkdownOptions = { listItemIndent: "one" };

export const importVisitors$ = Cell<MdastImportVisitor<Mdast.RootContent>[]>(coreImportVisitors);
export const exportVisitors$ = Cell<LexicalVisitor[]>(coreExportVisitors);
export const syntaxExtensions$ = Cell<SyntaxExtension[]>(defaultSyntaxExtensions);
export const mdastExtensions$ = Cell<MdastExtension[]>(defaultMdastExtensions);
export const toMarkdownExtensions$ = Cell<ToMarkdownExtension[]>(defaultToMarkdownExtensions);
export const toMarkdownOptions$ = Cell<ToMarkdownOptions>(defaultToMarkdownOptions);
