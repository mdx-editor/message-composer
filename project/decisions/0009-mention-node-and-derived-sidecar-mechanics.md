# Mention Node And Derived Sidecar Mechanics

Status: accepted
Date: 2026-06-12

## Context

Stage 6 implements mentions per [ADR 0008](0008-mention-link-serialization.md). Three mechanics were left open: how the mention renders inside Lexical, how the derived `mentions` sidecar stays atomic with the markdown it is computed from, and what shape the plugin configuration takes.

## Decision

**Mention node.** `MentionNode` is an inline `DecoratorNode`, not a token-mode `TextNode`. Decorators are atomic by construction (backspace removes the whole node) and render through React portals declared inside the composer tree, which sits inside `EngineProvider` — so the token UI reads the `mentionTokenComponent$` cell and is replaced through plugin config (`token`) without forking the node. The node carries `{ id, trigger, label, data }`; `data` is host metadata that survives JSON and DOM copy/paste (via `data-lexical-mention-*` attributes) but not the markdown string, where only the id travels. Insertion appends a trailing space: it is the natural caret home after an inline decorator, and a second backspace removes the token as a unit.

**Derived sidecar.** A new extension axis, `editorValuePatchers$`, holds plugin-registered functions that run inside the same editor state read as the markdown export. The bridge folds their partial results into one `editorPatch$` emission, so a value never carries markdown and metadata from different documents. The mentions plugin registers a patcher that collects mention nodes in document order, caching the array so it stays reference-stable across unrelated edits. For engine-applied markdown (initial `defaultValue` import, `setMarkdown$`, controlled echo corrections), which skips the update listener, the bridge re-derives patcher fields **silently** — publishing into the uncontrolled draft without emitting `valueChange` — because the composer owns that draft and setting a value must not fire a change event. Controlled drafts mirror the host value verbatim (ADR 0003); the host's fields stand until the next user edit derives them again.

**Plugin configuration.** `mentionsPlugin({ providers, menu, token })` takes an array of providers, each a single-character trigger plus an abortable async search (`(query, signal) => Promise<options>`). Queries route to the provider whose trigger opened the menu, so `@`-people and `#`-channels coexist. A new search aborts the in-flight one through `AbortSignal`; late resolutions of aborted calls are discarded. The popup is a plugin-config component (not a slot): it mounts with the editor and positions itself from `mentionAnchorRect$`, keeping the package headless when no menu is configured.

**Interaction details.** Trigger detection requires a word start (text start or after whitespace/paren), and is suppressed inside inline-code, code blocks, and links. Escape dismisses the current trigger run until it is left or removed; blur closes without dismissing. Menu keys (arrows, Enter, Tab, Escape) register at `COMMAND_PRIORITY_CRITICAL` so an open menu with results wins over the Enter-to-submit shortcut, which stays at `COMMAND_PRIORITY_HIGH`.

## Consequences

Plugins can now contribute Lexical node classes (`lexicalNodes` on the plugin contract) and document-derived value fields (the patcher axis) — attachments and later stages reuse both without core changes.

The sidecar can disagree with the markdown only in values the host itself authored (controlled values, unedited `defaultValue` passed straight to submit); per ADR 0008 the markdown alone is self-sufficient there.

A mention label is rendered by React but serialized from node state, so custom token components can decorate freely (avatars, colors) without affecting the markdown.
