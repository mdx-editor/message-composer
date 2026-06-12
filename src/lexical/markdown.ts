import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
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

/**
 * The initial MVP markdown subset: bold, italic, strikethrough, inline code,
 * fenced code blocks, lists, blockquotes, and links. Headings, checklists, and
 * highlights are intentionally excluded from the composer contract.
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

// Newlines are preserved in both directions so that a host echoing the emitted
// markdown back (ADR 0003) round-trips to the identical string.
export function $importMarkdown(markdown: string): void {
  $convertFromMarkdownString(markdown, MARKDOWN_TRANSFORMERS, undefined, true);
}

export function $exportMarkdown(): string {
  return $convertToMarkdownString(MARKDOWN_TRANSFORMERS, undefined, true);
}
