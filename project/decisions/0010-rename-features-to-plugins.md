# Rename Features To Plugins

Status: accepted
Date: 2026-06-12

## Context

The composer's optional behavior modules were called "features": the `features` prop, the `MessageComposerFeature` contract, `*Feature()` factories, and `@mdxeditor/message-composer/features/<name>` subpaths. "Feature" reads as a product capability rather than a code artifact, and the ecosystem the composer lives in (Lexical, MDXEditor) already calls this concept a plugin.

## Decision

The concept is renamed to "plugins" everywhere, as a clean break with no compatibility aliases — the package is unpublished (0.0.0):

- `MessageComposerFeature` → `MessageComposerPlugin`, `MessageComposerFeatureContext` → `MessageComposerPluginContext`.
- The `features` prop → `plugins`; `resolveSlots` and the Lexical shell follow.
- Factories: `formattingFeature` → `formattingPlugin`, `agentSettingsFeature` → `agentSettingsPlugin`, `mentionsFeature` → `mentionsPlugin`.
- Subpath exports: `@mdxeditor/message-composer/plugins/<plugin>`; source moves from `src/features/` to `src/plugins/`, and `src/core/feature.ts` to `src/core/plugin.ts`.
- The vite, Ladle, and tsconfig alias/paths entries and the `vp pack` entries follow the new subpaths.

The contract fields are unchanged: `id`, `init`, `lexicalPlugins`, `lexicalNodes`, `slots`. A composer plugin may therefore contribute Lexical plugins through its `lexicalPlugins` field; the two uses of the word operate at different layers and the nesting reads naturally.

## Consequences

ADRs 0001–0009 predate the rename and use "feature" for the same concept; they remain historical records and are not rewritten. The implementation plan and AGENTS.md are living documents and were updated.

Hosts written against the old names must rename the prop, type, factory imports, and subpaths; there is no deprecation period.
