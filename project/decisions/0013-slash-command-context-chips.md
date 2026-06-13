# Slash Command Context Chips

Status: accepted
Date: 2026-06-13

## Context

Stage 9 adds slash commands and context chips. The composer already has three different context carriers: markdown for user-authored prose, mention nodes whose identity survives as `mention:` links in markdown (ADR 0008), and attachments as structured sidecar records. Context chips are different from mentions: they can represent prompts, tools, file references, external entities, or app-owned objects that should affect the submitted payload without becoming editable prose.

Open points: whether chips should serialize into markdown, where the chip data lives in `MessageComposerValue`, how slash command execution should mutate chips, and whether the command menu is a caret popup or an opinionated first-party surface.

## Decision

**Chips are sidecar metadata.** The canonical representation is `value.extensions.contextChips`, exposed through the slash-commands plugin as `contextChips$`. Markdown remains exactly the user's prose, plus any explicit text a command inserts. A chip is `{ id, type, label, description?, data? }`; `data` is host-owned opaque metadata.

**Chip edits are draft edits.** `addContextChip$`, `removeContextChip$`, and `setContextChips$` route through `editorChange$`, so they follow the same controlled/uncontrolled contract as typing, agent settings, and attachments. Adding a chip with an existing id replaces it.

**Slash commands execute through provider-owned items.** Providers return grouped command items and optional child result sets. Selecting a child-bearing item drills into a secondary picker; selecting an executable item removes the slash run, applies any replacement text/chip, and calls the item's `execute` handler with the current engine/editor context. This keeps product-specific commands out of core while giving hosts enough control to update other plugin state such as `selectModel$`.

**The first-party command menu is registry UI.** The core plugin is headless. The registry component presents a Codex-style full-width command shelf above the composer plus a removable chip row. Hosts can replace that with a caret menu, command palette, or custom chip renderer through the same exported cells/streams.

## Consequences

Markdown export stays portable and readable; hosts that want model-ready prose can render chips into a preamble at submit time.

Because `extensions.contextChips` is the canonical chip store, hosts must preserve it when controlling `MessageComposerValue.extensions`. Rewriting chip ids has the same identity implications as rewriting attachment ids.

Nested slash command flows can cover `/model`, `/prompt bug`, `/file composer`, and `/tool web` without hard-coding those products into the composer package.
