# Mention Markdown Representation

Status: superseded by [ADR 0008](0008-mention-link-serialization.md) (2026-06-12)
Date: 2026-06-12

## Context

Stage 6 adds mentions. Mentions have two audiences: humans and language models need readable markdown text, while host applications need stable entity identity and metadata. Markdown alone cannot represent mentions reliably without inventing a non-standard syntax, and that would make the submitted text less useful outside this component.

## Decision

Mention nodes serialize into `MessageComposerValue.markdown` as their visible plain-text form: `trigger + label`, for example `@Ada Lovelace`. The markdown output must not use custom links, MDX, HTML comments, or hidden tokens to preserve mention identity.

`MessageComposerValue.mentions` is the authoritative sidecar for identity and metadata. It represents mention occurrences in document order, not just distinct entities. Repeated mentions of the same entity may therefore appear multiple times. Stage 6 should update the `MessageComposerMention` type documentation to make the occurrence semantics explicit.

When importing a full `MessageComposerValue`, the mentions feature may rehydrate lexical mention nodes by matching sidecar entries against the visible mention text in document order. If sidecar entries no longer match the markdown, the implementation should degrade to plain text rather than inventing stale structured mentions.

## Consequences

The submitted markdown remains copyable, searchable, and useful for model prompts without post-processing.

Hosts that need IDs, permissions, or entity payloads must read `value.mentions`; they must not parse markdown to recover identity.

The mdast visitor extension added for mentions should export a mention node as text for markdown, while updating the sidecar through the feature's engine wiring. The visitor registration mechanism remains the serialization extension point, but the public markdown dialect stays ordinary markdown.
