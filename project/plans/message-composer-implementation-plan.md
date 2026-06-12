# Message Composer Implementation Plan

Status: active — stages 1–3 implemented (2026-06-12)

## Goal

Build the message composer as a React component whose core owns editing semantics, value shape, feature behavior, and integration points, while first-party polished UI is delivered as optional shadcn/Base UI registry components.

The core package should be useful without Tailwind, shadcn/ui, or Base UI. The registry UI should be a supported layer over stable core APIs, not a required dependency of the composer.

This document is suitable as the working context for a long-running `/goal`. It defines the objective, sequence, architecture constraints, validation gates, and open questions. Future goal-driven work should update this plan when implementation reality changes instead of treating it as throwaway planning text.

## Goal Run Scope

The first `/goal` run (completed 2026-06-12) covered development sequence stages 1–3: core value model, reactive-engine core, and the Lexical editor surface. The second run covers stages 4–5 — formatting behavior and the agent-settings feature with its registry UI — and is complete when stage 5 validation passes. Later stages require new goal runs.

## Architectural Principles

- Use Lexical for the editable surface, document model, editor commands, custom nodes, selection, history, markdown import/export, and rich text paste normalization.
- Use `@virtuoso.dev/reactive-engine-core` and `@virtuoso.dev/reactive-engine-react` for cross-component state, commands, feature wiring, and advanced external control. The unscoped `reactive-engine` package on npm is unrelated third-party code — never install it.
- Read the `reactive-engine` skill (`.agents/skills/reactive-engine/`) before writing engine code. It documents node types, engine lifecycle, React integration, and the library-building pattern this composer follows.
- Define reactive-engine nodes at module scope and create one engine per composer instance through `EngineProvider`.
- Keep React components projection-oriented: read cells, publish streams, and delegate behavior to Lexical commands or engine wiring.
- Model features as optional behavior modules first. UI for those features is a separate layer.
- Implement first-party UI as shadcn/Base UI registry items that consume the same feature contracts, slots, and exported reactive nodes available to custom UI.
- Keep the core npm package free from first-party registry UI imports.

## Target Layers

1. **Core value and engine layer**
   - Types for `MessageComposerValue`, attachments, mentions, audio clips, agent settings, and extensions.
   - Engine nodes for draft value, lifecycle state, submit/reset commands, validation, and feature registration.
   - Public controlled/uncontrolled value API.

2. **Lexical adapter layer**
   - Lexical composer setup, editor instance lifecycle, markdown import/export, history, selection, and IME correctness.
   - Bridge between Lexical editor state and the reactive draft value.
   - Custom Lexical nodes for mentions and other inline structured content.

3. **Optional feature behavior layer**
   - Feature modules attach lazy reactive-engine wiring and Lexical plugins/commands.
   - Features expose state cells, command streams, config types, and slot contracts.
   - No feature behavior should require the first-party UI implementation.

4. **Core React projection layer**
   - Minimal composer shell, editable area, slot rendering, and provider setup.
   - No dependency on shadcn/ui, Tailwind, or Base UI.
   - Enough structural markup and ARIA contracts for custom UI to compose around it.

5. **First-party registry UI layer**
   - shadcn/Base UI components for toolbar, pickers, menus, dialogs, mention list, attachment preview, link editor, and model/effort picker.
   - Distributed through the shadcn GitHub registry.
   - Installable feature-by-feature where practical.

## Public API Direction

The component should move away from textarea-native props and toward a draft-value API:

```ts
export interface MessageComposerProps<TValue extends MessageComposerValue = MessageComposerValue> {
  value?: TValue;
  defaultValue?: TValue;
  onValueChange?: (value: TValue) => void;
  onSubmit?: (value: TValue) => void | Promise<void>;
  features?: MessageComposerFeature[];
  slots?: MessageComposerSlots;
  engineId?: string;
  engineRef?: React.Ref<MessageComposerEngineRef>;
  editorProps?: MessageComposerEditorProps;
}
```

Feature modules should be plain values/functions:

```ts
export interface MessageComposerFeature {
  id: string;
  init?: (context: MessageComposerFeatureContext) => void | (() => void);
  lexicalPlugins?: MessageComposerLexicalPlugin[];
  slots?: Partial<MessageComposerSlots>;
}
```

The exact shape can change during implementation, but the direction should remain: feature behavior and state are independent from any specific UI library.

### Value Semantics

Decided in [ADR 0003](../decisions/0003-controlled-value-and-submit-semantics.md):

- `value` makes the composer strict-controlled: rendered editor state always derives from `value`, and edits surface through `onValueChange` without committing locally. The host must echo the value back for input to persist, matching React's native input contract.
- The Lexical reconciler must no-op when the incoming `value` matches the last emitted value, so the echo round-trip preserves selection, IME composition, and history.
- `defaultValue` selects uncontrolled mode with internal draft state. Switching modes during a component lifetime is unsupported and should warn, like React inputs.
- Submit never clears the draft. Hosts clear explicitly through the controlled `value` or the exported reset command.
- If `onSubmit` returns a promise, the submitting lifecycle state tracks it; rejection sets error state and leaves the draft untouched.

## Development Sequence

### 1. Replace Placeholder API With Core Value Model

- Define `MessageComposerValue` and related structured metadata types.
- Implement strict-controlled and uncontrolled value behavior around the placeholder editor per ADR 0003.
- Add `onValueChange`, `onSubmit`, disabled/submitting/error state, and scoped editor props. Submit never clears the draft; promise-returning `onSubmit` drives submitting/error state.
- Keep the UI simple while hardening the public value contract.
- Set up Vitest Browser Mode infrastructure as part of this stage.

Validation:

- Unit tests for controlled/uncontrolled value updates, including a non-echoing host (input reverts) and an echoing host (input persists).
- Unit tests for submit/reset behavior.
- Ladle story showing controlled and uncontrolled placeholder usage.
- Vitest Browser Mode smoke test against the Ladle story.

### 2. Add Reactive-Engine Core

- Add `@virtuoso.dev/reactive-engine-core` and `@virtuoso.dev/reactive-engine-react` (not the unscoped npm `reactive-engine`).
- Define core module-scope nodes for draft value, markdown, attachments, mentions, audio clips, agent state, lifecycle state, and submit/reset streams.
- Wrap `MessageComposer` in one engine instance per component.
- Bridge props into cells with `initFn`/`updateFn`.
- Bridge callback props with singleton subscriptions.
- Export selected nodes and remote-control hooks for advanced usage.

Validation:

- Engine-level tests without React for value reducers and submit flow.
- React tests proving multiple composer instances do not share state.
- Story demonstrating an external control reading/publishing through engine APIs.
- Browser test proving the external control and editor stay synchronized through user interaction.

### 3. Integrate Lexical As The Editor Surface

- Replace the placeholder textarea with a minimal Lexical editor.
- Implement markdown import/export for the initial markdown subset.
- Preserve controlled/uncontrolled value behavior, implementing the strict-controlled echo reconciliation (no-op when the incoming value equals the last emitted value) without breaking selection, IME, or history.
- Add history, focus handling, placeholder behavior, auto-resize, and composition safety.
- Establish the Lexical-to-engine bridge carefully to avoid feedback loops.

Validation:

- Tests for markdown value sync, undo/redo, and controlled prop updates.
- Manual Ladle scenarios for multiline input, IME composition, focus, and submit shortcuts.
- Regression test for multiple independent editor instances.
- Vitest Browser Mode tests for typing, selection, keyboard shortcuts, paste, focus restoration, and submit/newline behavior.

### 4. Build Formatting Behavior Before Formatting UI

- Implement formatting commands for bold, italic, strikethrough, inline code, code blocks, lists, blockquotes, and links.
- Expose formatting state cells so any toolbar can show active/disabled state.
- Add markdown shortcuts where Lexical support is appropriate.
- Keep toolbar UI out of the core feature behavior.

Validation:

- Engine/Lexical tests for command effects and markdown serialization.
- Keyboard shortcut tests for common formatting commands.
- Structured Ladle stories using first-party shadcn/Base UI toolbar components once available.
- Vitest Browser Mode tests for toolbar clicks, active formatting state, keyboard shortcuts, and markdown serialization.

### 5. Prove Optional Feature Architecture With Model/Effort Picker

- Decided 2026-06-12: the public feature id is `agent-settings` (source directory and registry item follow it); the model/effort picker is its first UI surface.
- Implement an agent settings feature because it does not depend on complex Lexical nodes.
- Add `agent.modelId` and `agent.effort` value integration.
- Expose option config, selected state, and selection commands through feature nodes.
- Build the first shadcn/Base UI registry component for the picker.
- Use this feature to validate registry packaging, slot integration, and custom UI replacement.

Validation:

- Core tests for agent value updates without UI.
- Registry UI story showing the first-party picker.
- Custom UI story showing the same feature controlled without registry UI.
- Vitest Browser Mode tests for opening the picker, keyboard navigation, selection, focus return, and submitted value payload.

### 6. Add Mentions

- Add mention config with trigger characters, async search providers, result metadata, and insertion behavior.
- Add Lexical mention node rendering and deletion-as-unit behavior.
- Add reactive state for active query, loading/error states, highlighted item, and selection commands.
- Serialize mentions as structured metadata in `MessageComposerValue`; keep markdown output predictable.
- Build registry UI for autocomplete list and mention token rendering.

Validation:

- Tests for trigger/query lifecycle, async provider cancellation, insertion, deletion, copy/paste, and serialization.
- Keyboard navigation and pointer selection tests.
- Custom UI story and first-party registry UI story.
- Vitest Browser Mode tests for typing a trigger, async results, keyboard selection, pointer selection, deletion-as-unit, and submitted metadata.

### 7. Add Attachments

- Add file picker, drag/drop, and paste normalization.
- Add attachment validation, upload lifecycle, retry, remove, and error state.
- Keep upload handling supplied by host applications.
- Represent attachments as structured metadata in the draft value.
- Build registry UI for picker button, preview list, progress/error states, retry, and remove.

Validation:

- Tests for picker/drop/paste ingestion and validation.
- Tests for upload success/error/retry/remove state transitions.
- Stories for image paste, upload error, retry, and custom preview rendering.
- Vitest Browser Mode tests for picker, drag/drop, paste, progress states, validation errors, retry, remove, and submitted metadata.

### 8. Add Link Editing And Auto-Linking

- Add typed and pasted URL detection.
- Add link transform behavior and markdown serialization.
- Expose link edit/remove commands and current-link state.
- Build registry UI for link popover/dialog using Base UI primitives.

Validation:

- Tests for typed URL, pasted URL, edit/remove, and markdown output.
- Keyboard and focus tests for the link editor UI.
- Vitest Browser Mode tests for URL typing, URL paste, editing through the popover/dialog, removing a link, and focus restoration.

### 9. Add Slash Commands And Context Chips

- Add command trigger/query lifecycle similar to mentions, but with action execution.
- Add structured context chip support for selected prompts, entities, file references, or tools.
- Keep command providers and chip rendering application-owned.
- Build registry UI for command menu and chip list.

Validation:

- Tests for command filtering, keyboard navigation, execution, and cancellation.
- Stories for command provider customization and chip rendering.
- Vitest Browser Mode tests for opening the command menu, selecting commands, dismissing the menu, and updating context chips.

### 10. Add Audio Capture

- Add audio clip metadata and state transitions.
- Add recording hooks only after the draft value and attachment lifecycle are stable.
- Keep capture/upload implementation host-configurable.
- Build registry UI for record, stop, processing, retry, playback preview, and remove.

Validation:

- Tests for state transitions independent of browser media APIs.
- Browser-only manual stories for actual recording flows.
- Vitest Browser Mode tests should cover UI state transitions with mocked media APIs before relying on real device input.

### 11. Formalize Registry Distribution

- Add root `registry.json`.
- Split installable registry items by feature where practical.
- Add shared registry utilities/styles only when duplication justifies them.
- Document install paths for each first-party UI feature.
- Add validation for registry files to CI once release setup exists.

Validation:

- Local registry build/validation command.
- Fresh-app smoke test installing at least the composer shell, formatting toolbar, model picker, mentions UI, and attachments UI.
- Vitest Browser Mode smoke test against installed registry components in a clean fixture app.

## Suggested Feature Order

1. Value model and reactive-engine core.
2. Lexical plain markdown editor.
3. Formatting behavior.
4. Model/effort picker feature and registry UI.
5. Mentions behavior and registry UI.
6. Attachments behavior and registry UI.
7. Link editing and auto-linking.
8. Slash commands and context chips.
9. Audio capture.

The model/effort picker should come before mentions and attachments because it proves feature registration, submitted value integration, slots, and registry UI without requiring custom Lexical nodes or file lifecycle complexity.

## Package And Source Layout Direction

```text
src/
  core/
    value.ts
    engine.ts
    nodes.ts
    feature.ts
  lexical/
    MessageComposerLexical.tsx
    markdown.ts
    plugins/
    nodes/
  react/
    MessageComposer.tsx
    slots.tsx
    hooks.ts
  features/
    formatting/
    agent-settings/
    mentions/
    attachments/
    links/
    slash-commands/
    audio/
  index.ts
registry/
  registry.json
  components/
  features/
```

This layout is provisional. The important rule is that `src/features/*` contains reusable behavior and contracts, while `registry/*` contains first-party installable UI.

## Validation Strategy

- `vp check` remains the formatting/lint/type gate.
- `vp test` covers engine reducers, feature wiring, Lexical serialization, and React integration that does not need a real browser.
- Engine tests are required for every feature that adds reactive-engine nodes, streams, reducers, or feature initialization.
- Vitest Browser Mode is the default browser-test infrastructure for user-facing workflows that depend on DOM selection, focus, keyboard navigation, clipboard, drag/drop, popovers, dialogs, or real browser event behavior.
- Do not assume Playwright as the default browser-test runner. Add a different browser runner only when Vitest Browser Mode cannot cover a specific workflow.
- Ladle stories cover interactive scenarios and act as the browser-test fixture surface.
- Core tests should not depend on shadcn/Base UI registry components.
- Registry UI should have stories that prove both default UI and custom UI can coexist over the same core feature behavior.
- First-party interactive stories should use the shadcn/Base UI components once those components exist.

## Engine Test Requirements

Every feature with engine state should include pure engine tests that instantiate an `Engine`, activate the relevant nodes, publish commands, and assert resulting cells or emitted streams.

Engine tests should cover:

- initial state and feature initialization
- controlled prop seeding and prop updates where relevant
- command streams and reducer behavior
- callback bridging through singleton subscriptions
- independence between two engine instances
- cleanup/disposal for async providers, upload handlers, timers, or external subscriptions
- submitted `MessageComposerValue` shape

Engine tests should not render React or mount Lexical unless the behavior being tested actually requires those layers.

## Browser Test Requirements

Browser tests should use Vitest Browser Mode by default. They should run against Ladle stories instead of bespoke hidden fixtures where practical. This keeps manual preview, visual debugging, and automated workflows aligned.

Browser tests should cover:

- keyboard navigation and shortcuts
- focus management and focus restoration after popovers, dialogs, menus, and file pickers
- pointer interactions for toolbar buttons, pickers, menus, mention results, attachment controls, and dialogs
- paste flows for plain text, markdown, URLs, rich HTML, files, and images
- drag/drop flows for attachments
- submitted payload inspection through test-visible story state
- accessibility-critical attributes and screen-reader labels where practical

When browser APIs are hard to automate, prefer stories with deterministic mocks before adding manual-only coverage.

## Ladle Story Requirements

Stories should be structured as scenario fixtures, not ad hoc demos. Each implemented feature should add stories that make states and transitions easy to inspect manually and reuse in browser tests.

Recommended story grouping:

```text
Core/Uncontrolled
Core/Controlled
Core/ExternalControls
Formatting/Toolbar
AgentSettings/ModelEffortPicker
Mentions/Autocomplete
Attachments/UploadLifecycle
Links/AutoLinkAndEditor
SlashCommands/Menu
Audio/RecordingLifecycle
```

Each feature should include stories for:

- default first-party shadcn/Base UI
- custom UI over the same core feature contracts
- loading, empty, error, disabled, and edge states where applicable
- submitted value inspection

Use first-party shadcn/Base UI components for the main interactive stories once the relevant registry component exists. Minimal unstyled stories are allowed only while the registry component for that feature has not been built yet, or when the story is specifically proving custom UI.

## Implementation Notes From Stages 1–3

API deltas relative to the sketches above:

- `engineRef` takes the `EngineRef` type from `@virtuoso.dev/reactive-engine-react` (created with `useEngineRef()`), not a `React.Ref`. Remote hooks and `EngineRef` are re-exported from the package index.
- A minimal `MessageComposerHandle` (`focus`/`reset`/`submit`) is exposed through the `ref` prop (ADR 0004). Feature commands must not grow onto this handle.
- `editorProps` targets the Lexical `ContentEditable` div (`HTMLAttributes<HTMLDivElement>` plus a string `placeholder`), not a textarea.
- The Lexical editor instance is exported as the `lexicalEditor$` cell (lexical layer, not core) as the advanced escape hatch.
- Enter-to-submit is handled inside Lexical via `KEY_ENTER_COMMAND` at high priority; `editorProps.onKeyDown` cannot preempt it. Configurable submit behavior remains future feature work.

Engine integration constraints discovered during implementation (encoded in code comments, repeated here for future goal runs):

- `EngineProvider`'s mount effect treats the `initWith` object identity as the engine identity; an inline object literal disposes/recreates the engine every render. Seed via `pubIn` in `initFn` instead (data-table pattern).
- `DerivedCell` projections activate lazily and miss emissions that precede their first read. The core graph registers all draft projections via `addNodeInit` on `draftValue$` so exported cells are consistent for late readers.
- Strict-controlled reverts for non-echoing hosts cannot be purely reactive (no emission happens); the Lexical bridge arms a zero-delay revert timer after each controlled edit, cancelled by the echo emission, deferred while IME composition is active.
- Engine-originated Lexical imports use discrete, tagged updates: `discrete` keeps the editor synchronously consistent with engine state; the tag breaks the editor→engine→editor feedback loop. Undo/redo restores arrive with empty dirty sets and the `historic` tag — update listeners must not treat them as selection-only changes.

## Decision Protocol

When a goal run hits an item from Open Questions or a new ambiguity:

1. Choose the most conservative option that keeps public contracts reversible.
2. Record it as a numbered decision doc in `project/decisions/`.
3. Flag the decision in the run summary for review.
4. If every option permanently locks in a public API shape or serialization format, prefer deferring the capability over guessing.

## Open Questions

- Exact markdown representation for mentions when displayed outside this component.
- Whether the core package should include a minimal unstyled toolbar example, or keep all toolbar UI in registry items.
- How much of Lexical's markdown transformer set should be exposed for user extension.
- Whether attachment upload cancellation should be required in the host upload contract.
- How registry items should be grouped: per feature, per surface, or bundled presets.
