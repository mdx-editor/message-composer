# Mention Link Serialization

Status: accepted
Date: 2026-06-12
Supersedes: [ADR 0007](0007-mention-markdown-representation.md)

## Context

ADR 0007 chose plain-text mention serialization with an authoritative sidecar, optimizing the markdown for prompt and human consumption. Reviewing the trade-off with the mdast pipeline in place, the positional fragility of a text-matched sidecar (edits, copy/paste, partial deletions, host-side transforms) was judged worse than carrying identity in the markdown itself. The decision flips: identity lives in the string.

## Decision

Mentions serialize as link-form CommonMark with a `mention:` scheme URL:

```
ping [@Ada](mention:u1) about the release
```

- The link text is the visible form (`trigger + label`); the URL is `mention:` plus the host-provided entity id, URI-encoded where necessary. The id is opaque to the composer.
- Import: a high-priority mdast link visitor (registered by the mentions feature ahead of the core link visitor) matches the `mention:` scheme and produces mention nodes; non-matching links fall through to the core visitor.
- Export: the mention Lexical node maps to an mdast `link` node.
- `MessageComposerValue.mentions` is **derived** from the document on every change — never authoritative, so it cannot drift from the markdown. It lists occurrences in document order.
- Round-trip safety comes for free: any markdown viewer renders the mention as a readable link, and reimporting the exported string reconstructs the mention nodes exactly.

## Consequences

Hosts that feed the markdown to language models and want plain text must transform the link form (a trivial regex or mdast pass); the composer may later export a helper for this. That is the accepted cost of making identity survive every copy/paste, edit, and serialization boundary structurally rather than positionally.

Hosts read `value.mentions` for convenient access to ids and metadata, but the markdown alone is self-sufficient.

The mentions feature registers its serialization through the visitor registries (ADR 0006), making it the first real consumer of the extension axes.
