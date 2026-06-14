# Architecture

Use this reference when changing package structure, public API, plugin boundaries, or registry distribution.

## Layers

1. Core value and engine layer: `src/core`.
2. Lexical adapter layer: `src/lexical`.
3. Optional plugin behavior layer: `src/plugins/*`.
4. Core React projection layer: `src/react`.
5. First-party registry UI layer: `registry/*`.

## Public API

The root package exports the composer, value types, core nodes, remote hooks, and the Lexical editor escape hatch. Optional behavior is exported through package subpaths such as:

- `@mdxeditor/message-composer/plugins/formatting`
- `@mdxeditor/message-composer/plugins/agent-settings`
- `@mdxeditor/message-composer/plugins/mentions`
- `@mdxeditor/message-composer/plugins/attachments`
- `@mdxeditor/message-composer/plugins/slash-commands`

Do not add optional plugin behavior to the root export.

## Registry UI

Registry UI lives under `registry/` and is declared in root `registry.json`. Local development aliases map published imports back to source. Registry components should import the local utility as `@/lib/utils`, matching normal shadcn consumer output.

Primary public shadcn installs should use GitHub-address items after the repo is public. Pages-hosted JSON remains available under `https://mdx-editor.github.io/message-composer/r/<item>.json`.

## Decisions

Before changing public contracts, read relevant ADRs in `project/decisions`. Add a new ADR when a change locks in serialization, value shape, plugin contract, upload lifecycle, registry distribution, or user-visible behavior.
