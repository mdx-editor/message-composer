# mdast Markdown Pipeline And Serialization Dialect

Status: accepted
Date: 2026-06-12

## Context

The composer's markdown conversion ran on `@lexical/markdown` transformers, which get painful for custom inline nodes — exactly what mentions (stage 6) need. The editor repository (`../editor`, MDXEditor) has a mature bidirectional system: mdast parse/serialize with per-node-type import and export visitors. Duplicating that code into this repository was accepted; reconciliation into a shared package can happen later.

## Decision

Markdown import/export runs through visitor cores ported from MDXEditor (`src/lexical/mdast/`), with MDXEditor's descriptor concepts (JSX, directives, code-block editors) stripped. Visitor and action interface shapes stay close to the source to ease reconciliation.

The serialized dialect adopts the editor repository's defaults (`mdast-util-to-markdown` with `listItemIndent: "one"`). User-visible changes to emitted values:

- Bullet lists serialize with `*` markers (previously `-`).
- Escaping follows `mdast-util-to-markdown` rules, which are more aggressive than the transformer serializer's.
- Markdown the editor did not produce normalizes on import (dash bullets become `*`, underscore emphasis becomes star markers, blank-line runs collapse per markdown semantics).

Deliberate deviations from the MDXEditor source:

- The export result is trimmed: the draft value contract has no trailing newline, and the empty document must export as `""` for echo equality (ADR 0003).
- A low-priority fallback import visitor degrades unsupported constructs (headings, thematic breaks, tables, raw HTML) to readable plain text instead of throwing, per the paste functional requirement. MDXEditor surfaces a parse error UI instead.
- Checklist items import as plain bullets; checklists are outside the MVP subset.
- Code blocks target Lexical's `CodeNode`, not MDXEditor's editor-backed custom node.

The registries (`importVisitors$`, `exportVisitors$`, `syntaxExtensions$`, `mdastExtensions$`, `toMarkdownExtensions$`, `toMarkdownOptions$`) are module-scope cells seeded with the core sets, read per conversion call — features can extend them in `init`. They are internal: not exported from the package index until a real consumer (mentions) proves the shape.

Markdown typing shortcuts continue to run on the `@lexical/markdown` transformer subset, the same coexistence MDXEditor uses.

## Consequences

Round-trip stability is guaranteed only for dialect-canonical markdown: export∘import is the identity on the canonical form, and export is a fixed point (verified by tests). Externally supplied markdown may normalize once on import, which surfaces to controlled hosts as an `onValueChange` with the normalized string.

The unified-ecosystem packages are runtime dependencies, externalized from the library build (~18 kB added to the package's own bundle for the pipeline code; micromark/mdast utils are host-installed).

Mentions and later features extend serialization by registering visitors and extensions through their feature `init` — no transformer surgery required.
