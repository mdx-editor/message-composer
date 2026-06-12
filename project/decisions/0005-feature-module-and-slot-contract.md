# Feature Module And Slot Contract

Status: accepted
Date: 2026-06-12

## Context

Stages 4–5 introduced the first two optional features (formatting, agent-settings) and the first registry UI component, which forced the feature/slot plumbing sketched in the plan to become concrete public API.

## Decision

`MessageComposerFeature` is `{ id, init?, lexicalPlugins?, slots? }`:

- `init({ engine })` runs once at engine creation, inside `EngineProvider`'s `initFn`, after the core cells are seeded; a returned cleanup is registered with `engine.onDispose`.
- `lexicalPlugins` are React components mounted inside the Lexical composer context.
- `slots` provide default UI for named slots.

The `features` prop is construction-time configuration: the array is captured on the first render, like Lexical's initial config. Feature inits wire the engine once; allowing the array to change mid-life would leave behavior half-applied. UI that must change between renders belongs in the live `slots` prop.

The slot set is `header`, `toolbar`, `footer`, rendered inside both the engine and Lexical contexts (above/below the editable area). Resolution: later features override earlier ones, host `slots` override features, and a host key explicitly set to `undefined` removes a feature-provided slot — that is how custom UI replaces first-party UI without forking the feature.

Command streams (`formatText$`, `toggleBlock$`, `toggleLink$`, `selectModel$`, `selectEffort$`) are declared with `distinct: false`. Commands are events, not state: the default reference-equality distinct would swallow consecutive identical commands (toggle on / toggle off).

## Consequences

Hosts compose features as plain values: `features={[formattingFeature(), agentSettingsFeature(config)]}`. Feature state cells and command streams are exported through feature subpaths, so optional behavior is not folded into the package root:

- `@mdxeditor/message-composer/features/formatting`
- `@mdxeditor/message-composer/features/agent-settings`

Custom UI needs only `useCellValue`/`usePublisher` from the root package and feature nodes from the relevant subpath, matching the same contract the registry UI uses.

Dynamic feature toggling requires remounting the composer (key change). If a real use case for runtime feature toggling appears, it needs an explicit enable/disable cell per feature rather than array identity diffing.
