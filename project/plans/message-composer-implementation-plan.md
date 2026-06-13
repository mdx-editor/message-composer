# Message Composer Implementation Plan

Status: active — stages 1–9 and 5A implemented (2026-06-13)

## Goal

Build the message composer as a React component whose core owns editing semantics, value shape, plugin behavior, and integration points, while first-party polished UI is delivered as optional shadcn/Base UI registry components.

The core package should be useful without Tailwind, shadcn/ui, or Base UI. The registry UI should be a supported layer over stable core APIs, not a required dependency of the composer.

This document is suitable as the working context for a long-running `/goal`. It defines the objective, sequence, architecture constraints, validation gates, and open questions. Future goal-driven work should update this plan when implementation reality changes instead of treating it as throwaway planning text.

## Goal Run Scope

The first `/goal` run (completed 2026-06-12) covered development sequence stages 1–3: core value model, reactive-engine core, and the Lexical editor surface. The second run (completed 2026-06-12) covered stages 4–5: plugin/slot plumbing, formatting behavior, and the agent-settings plugin with the first shadcn/Base UI registry component. The third run (completed 2026-06-12) covered stage 5A: the mdast visitor pipeline ported from the editor repository, replacing the transformer-based conversion. The fourth run (completed 2026-06-12) covered stage 6: the mentions plugin with link-form serialization through the visitor registries (ADR 0008), the first plugin-contributed Lexical node, and the derived-sidecar patcher mechanics (ADR 0009). On 2026-06-12 the behavior-module concept was renamed from "features" to "plugins" across the API, subpaths, and this plan (ADR 0010); ADRs 0001–0009 predate the rename and use the old term. The fifth run (completed 2026-06-12) covered stage 7 only: the attachments plugin — ingestion through picker/drop/paste, the host upload contract with provided-not-required cancellation (ADR 0011), lifecycle state routed through `editorChange$` — plus the attachments registry UI. Bundling stage 8 was considered and rejected so the upload-contract decision got a dedicated run. The sixth run (completed 2026-06-12) closed the stage 4 leftover: the first-party formatting toolbar registry component (Base UI Toolbar + Toggle composition, ADR 0012), replacing the unstyled story toolbar in the first-party story while keeping it as the custom-UI story, with browser tests for focus preservation, arrow-key navigation, and the custom-UI contracts. ADR 0012 also resolves the toolbar open question: toolbar UI is registry-only, and the first-party toolbar shipped without a link control until stage 8 delivered the link editing surface. The seventh run (completed 2026-06-13) covered stage 8: typed/pasted URL auto-linking, richer current-link state, edit/remove commands, mention-link exclusion, a Base UI popover link editor in the first-party formatting toolbar, and links stories/browser tests. The eighth run (completed 2026-06-13) covered stage 8A: markdown shortcut hardening with a transformer-scope audit, browser coverage for inline code, quote/list regressions, immediate bare triple-backtick code-block conversion, Shift+Enter inside code blocks, and plain-Enter submit after code-block conversion. The ninth run (completed 2026-06-13) covered stage 9: headless slash commands, grouped and nested command results, sidecar `extensions.contextChips` semantics (ADR 0013), a Codex-style full-width registry command shelf, registry chip list, and stories/browser tests for `/model`, `/prompt`, `/file`, and `/tool` flows. The next run can start at stage 10 (audio capture).

## Architectural Principles

- Use Lexical for the editable surface, document model, editor commands, custom nodes, selection, history, markdown import/export, and rich text paste normalization.
- Use `@virtuoso.dev/reactive-engine-core` and `@virtuoso.dev/reactive-engine-react` for cross-component state, commands, plugin wiring, and advanced external control. The unscoped `reactive-engine` package on npm is unrelated third-party code — never install it.
- Read the `reactive-engine` skill (`.agents/skills/reactive-engine/`) before writing engine code. It documents node types, engine lifecycle, React integration, and the library-building pattern this composer follows.
- Define reactive-engine nodes at module scope and create one engine per composer instance through `EngineProvider`.
- Keep React components projection-oriented: read cells, publish streams, and delegate behavior to Lexical commands or engine wiring.
- Model plugins as optional behavior modules first. UI for those plugins is a separate layer.
- Implement first-party UI as shadcn/Base UI registry items that consume the same plugin contracts, slots, and exported reactive nodes available to custom UI.
- Keep the core npm package free from first-party registry UI imports.

## Target Layers

1. **Core value and engine layer**
   - Types for `MessageComposerValue`, attachments, mentions, audio clips, agent settings, and extensions.
   - Engine nodes for draft value, lifecycle state, submit/reset commands, validation, and plugin registration.
   - Public controlled/uncontrolled value API.

2. **Lexical adapter layer**
   - Lexical composer setup, editor instance lifecycle, markdown import/export, history, selection, and IME correctness.
   - Bridge between Lexical editor state and the reactive draft value.
   - Custom Lexical nodes for mentions and other inline structured content.

3. **Optional plugin behavior layer**
   - Plugin modules attach lazy reactive-engine wiring and Lexical plugins/commands.
   - Plugins expose state cells, command streams, config types, and slot contracts.
   - No plugin behavior should require the first-party UI implementation.

4. **Core React projection layer**
   - Minimal composer shell, editable area, slot rendering, and provider setup.
   - No dependency on shadcn/ui, Tailwind, or Base UI.
   - Enough structural markup and ARIA contracts for custom UI to compose around it.

5. **First-party registry UI layer**
   - shadcn/Base UI components for toolbar, pickers, menus, dialogs, mention list, attachment preview, link editor, and model/effort picker.
   - Distributed through the shadcn GitHub registry.
   - Installable plugin-by-plugin where practical.

## Public API Direction

The component should move away from textarea-native props and toward a draft-value API:

```ts
export interface MessageComposerProps<TValue extends MessageComposerValue = MessageComposerValue> {
  value?: TValue;
  defaultValue?: TValue;
  onValueChange?: (value: TValue) => void;
  onSubmit?: (value: TValue) => void | Promise<void>;
  plugins?: MessageComposerPlugin[];
  slots?: MessageComposerSlots;
  engineId?: string;
  engineRef?: React.Ref<MessageComposerEngineRef>;
  editorProps?: MessageComposerEditorProps;
}
```

Plugin modules should be plain values/functions:

```ts
export interface MessageComposerPlugin {
  id: string;
  init?: (context: MessageComposerPluginContext) => void | (() => void);
  lexicalPlugins?: MessageComposerLexicalPlugin[];
  slots?: Partial<MessageComposerSlots>;
}
```

The exact shape can change during implementation, but the direction should remain: plugin behavior and state are independent from any specific UI library.

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

Behavior implemented in the second goal run; the first-party toolbar registry component followed on 2026-06-12 ([ADR 0012](../decisions/0012-formatting-toolbar-registry-component.md)), without a link control until stage 8 ships the link editing surface.

- Implement formatting commands for bold, italic, strikethrough, inline code, code blocks, lists, blockquotes, and links.
- Expose formatting state cells through `@mdxeditor/message-composer/plugins/formatting` so any toolbar can show active/disabled state without importing other optional plugins.
- Add markdown shortcuts where Lexical support is appropriate.
- Keep toolbar UI out of the core plugin behavior.

Validation:

- Engine/Lexical tests for command effects and markdown serialization.
- Keyboard shortcut tests for common formatting commands.
- Structured Ladle stories using first-party shadcn/Base UI toolbar components once available.
- Vitest Browser Mode tests for toolbar clicks, active formatting state, keyboard shortcuts, and markdown serialization.

### 5. Prove Optional Plugin Architecture With Model/Effort Picker

- Decided 2026-06-12: the public plugin id is `agent-settings` (source directory and registry item follow it); the model/effort picker is its first UI surface.
- Implement an agent settings plugin because it does not depend on complex Lexical nodes.
- Add `agent.modelId` and `agent.effort` value integration.
- Expose option config, selected state, and selection commands through `@mdxeditor/message-composer/plugins/agent-settings`.
- Build the first shadcn/Base UI registry component for the picker.
- Use this plugin to validate registry packaging, slot integration, and custom UI replacement.

Validation:

- Core tests for agent value updates without UI.
- Registry UI story showing the first-party picker.
- Custom UI story showing the same plugin controlled without registry UI.
- Vitest Browser Mode tests for opening the picker, keyboard navigation, selection, focus return, and submitted value payload.

### 5A. Replace Transformer Conversion With The mdast Visitor Pipeline

Port the bidirectional markdown system from `../editor` (MDXEditor): mdast parse/serialize with per-node-type import and export visitors. Code duplication from the editor repository is accepted; keep the visitor interface shapes close to the source so the two can be reconciled into a shared package later.

- Port the visitor cores (`importMarkdownToLexical`, `exportMarkdownFromLexical`), stripping or parameterizing MDXEditor-specific descriptor concepts (JSX, directives, code-block editors).
- Model the registries as module-scope cells with appender streams (`importVisitors$`, `exportVisitors$`, `syntaxExtensions$`, `mdastExtensions$`, `toMarkdownExtensions$`). Decided 2026-06-12: these stay internal — no new package exports; the extension surface goes public no earlier than stage 6, superseding the old transformer-exposure question.
- Core registers visitors for the full MVP subset (root, paragraph, text formats, linebreak, lists, blockquote, fenced code, link) so import/export works with no plugins enabled. GFM strikethrough comes from the micromark/mdast extension pair.
- Decided 2026-06-12: serialization adopts the editor repository's `toMarkdown` defaults. Emitted markdown strings change dialect; existing exact-string test assertions update accordingly, and the change is recorded as a decision doc since it alters the public value contract.
- `$importMarkdown`/`$exportMarkdown` keep their signatures; the engine bridge, sync tags, echo logic, and revert mechanism stay untouched.
- Markdown typing shortcuts continue to use the `@lexical/markdown` transformer subset (the same coexistence the editor repository uses).
- New unified-ecosystem runtime dependencies are regular dependencies, externalized in the library build.
- No MDX, JSX, directive, frontmatter, or table support; the extension axes exist so later stages can register them.

Validation:

- Round-trip unit tests for every construct in the MVP subset: import→export stability and export→import fidelity, including nested cases (formatted text inside list items, multi-paragraph quotes).
- Engine-level tests proving a registered visitor/extension reaches the conversion (the plugin extension path works).
- All existing unit and browser suites pass, with exact-string assertions migrated to the adopted dialect.
- Ladle story presenting a markdown round-trip scenario fixture (markdown in, editor, emitted markdown out) for manual inspection.
- `vp check`, `vp test`, and `vp pack` pass; the dist externals include the new dependencies.

### 6. Add Mentions

Implemented 2026-06-12; mechanics recorded in [ADR 0009](../decisions/0009-mention-node-and-derived-sidecar-mechanics.md).

- Add mention config with trigger characters, async search providers, result metadata, and insertion behavior. Decided 2026-06-12: `mentionsPlugin({ providers, menu, token })` — providers pair a single-character trigger with an abortable async search; menu and token are optional components, so the package stays headless without registry UI.
- Add Lexical mention node rendering and deletion-as-unit behavior. Decided 2026-06-12: `MentionNode` is an inline DecoratorNode (React-rendered token via the `mentionTokenComponent$` cell, atomic deletion by construction); the plugin contract gained `lexicalNodes` so plugins register node classes with the editor.
- Add reactive state for active query, loading/error states, highlighted item, and selection commands.
- Serialize mentions per [ADR 0008](../decisions/0008-mention-link-serialization.md): link-form markdown `[@Ada](mention:u1)` with identity in the `mention:` scheme URL; the `mentions` sidecar is derived from the document in occurrence order, never authoritative. The mentions plugin registers a high-priority link visitor through the visitor registries (ADR 0006). Decided 2026-06-12: sidecar derivation goes through the `editorValuePatchers$` axis — patchers run inside the same editor state read as the markdown export and fold into one `editorPatch$` emission, keeping derived fields atomic with the markdown; engine-applied markdown re-derives silently into the uncontrolled draft.
- Build registry UI for autocomplete list and mention token rendering.

Validation:

- Tests for trigger/query lifecycle, async provider cancellation, insertion, deletion, copy/paste, and serialization.
- Keyboard navigation and pointer selection tests.
- Custom UI story and first-party registry UI story.
- Vitest Browser Mode tests for typing a trigger, async results, keyboard selection, pointer selection, deletion-as-unit, and submitted metadata.

### 7. Add Attachments

Implemented 2026-06-12; the configuration shape, ingestion semantics, and host upload contract are recorded in [ADR 0011](../decisions/0011-attachment-ingestion-and-upload-contract.md).

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

Implemented 2026-06-13. Stage 4 had already mounted `LinkPlugin`, exposed `toggleLink$`, and tracked boolean link-active state; stage 5A had already shipped core link markdown serialization. Stage 8 added typed/pasted URL detection with `AutoLinkNode`, a richer `currentLink$` state cell (URL, text, anchor rect), `beginLinkEdit$`/`editLink$`/`removeLink$` commands, mention-scheme link exclusion, and the Base UI popover editor in the first-party formatting toolbar.

- Add typed and pasted URL detection.
- Add link transform behavior and markdown serialization.
- Expose link edit/remove commands and current-link state.
- Build registry UI for link popover/dialog using Base UI primitives.

Validation:

- Tests for typed URL, pasted URL, edit/remove, and markdown output.
- Keyboard and focus tests for the link editor UI.
- Vitest Browser Mode tests for URL typing, URL paste, editing through the popover/dialog, removing a link, and focus restoration.

### 8A. Harden Markdown Typing Shortcuts

Implemented 2026-06-13. The audit against `../editor` confirmed the composer should keep markdown shortcuts separate from value import/export and scope them to enabled composer capabilities. The current `MARKDOWN_TRANSFORMERS` intentionally includes the formatting MVP subset (code block, quote, unordered/ordered lists, bold/italic/strikethrough, inline code, link) and intentionally excludes headings, checklists, thematic breaks, MDX, and tables.

Decided 2026-06-13: fenced code blocks stay in the formatting plugin for now because the composer only exposes the stock Lexical `CodeNode` shortcut/toggle and serialization. Bare triple backticks activate an unlabeled code block immediately after the third backtick; typed opening-fence language is not a shortcut path because future language selection belongs in toolbar/code-block controls. Split into a separate `code-blocks` plugin only if later work adds language editing, code-specific controls, or nested-editor behavior. Lexical's markdown shortcut listener does not apply paired backticks to an existing text selection; selected inline-code formatting remains covered by the formatting command/toolbar instead of adding composer-specific shortcut behavior.

- Audit the current `MARKDOWN_TRANSFORMERS` against MDXEditor's shortcut set and the composer's intended scope. Keep headings, thematic breaks, checklists, MDX, and table-specific behavior out unless a later composer capability explicitly adds them.
- Verify inline code shortcuts: typing paired backticks around text, applying backticks to selected text if Lexical supports it, caret placement after conversion, and markdown serialization as inline code.
- Verify fenced code block shortcuts separately from inline code: typing <code>```</code> should immediately create an unlabeled code block that serializes as fenced markdown and keeps Shift+Enter/plain Enter semantics coherent with composer submit behavior.
- Decide whether fenced code blocks remain part of the formatting plugin or become their own optional `code-blocks` plugin if language editing, code-specific toolbar controls, or nested editor behavior becomes necessary.
- Document any divergence from MDXEditor, especially the absence of headings/checklists/thematic breaks and the fact that shortcuts remain typing-time behavior while the mdast visitor pipeline owns value import/export.

Validation:

- Browser tests cover inline-code backtick shortcuts, immediate bare triple-backtick code block creation, markdown output, Shift+Enter inside code blocks, and plain-Enter submit after code-block conversion.
- Regression tests cover list and quote shortcuts, focus retention after conversion, and continued typing outside converted inline formats.
- A `MarkdownShortcuts` Ladle story fixture was added under the formatting stories using custom UI over the same formatting plugin contracts.

### 9. Add Slash Commands And Context Chips

Implemented 2026-06-13. Stage 9 added the optional `slash-commands` plugin subpath with a headless slash trigger/query lifecycle, grouped provider results, nested secondary pickers, keyboard navigation, execution/cancellation commands, and sidecar context chips stored under `value.extensions.contextChips` (ADR 0013). The first-party registry UI ships a Codex-style full-width command shelf above the composer plus a removable chip list; hosts can replace both with custom UI over the exported cells/streams.

- Add command trigger/query lifecycle similar to mentions, but with action execution.
- Support command groups in the provider/result model and first-party registry UI so commands can be organized by purpose (for example: model, tools, prompts, context, files).
- Support nested command selection flows where choosing or narrowing to a command can replace the full-width menu contents with a secondary picker instead of immediately executing.
- Add structured context chip support for selected prompts, entities, file references, or tools.
- Keep command providers and chip rendering application-owned.
- Build registry UI for a Codex-style full-width command shelf above the composer, plus the chip list.

Example flows:

- `/model` opens the full-width command shelf directly into model choices; selecting one updates the existing agent settings state and closes the shelf.
- `/prompt bug` filters to prompt-template commands; selecting one can insert starter markdown and add a prompt context chip.
- `/file composer` enters a file-reference picker; selecting a file adds a context chip with the host-owned file id/path/range metadata.
- `/tool web` toggles or adds a tool chip, leaving markdown unchanged while submitting structured tool context.

Validation:

- Tests for command grouping, filtering, keyboard navigation, nested selection, execution, and cancellation.
- Stories for command provider customization, command groups, nested pickers, and chip rendering.
- Vitest Browser Mode tests for opening the full-width command shelf, navigating grouped commands, drilling into a secondary picker such as `/model`, selecting commands, dismissing the shelf, and updating context chips.

### 10. Add Audio Capture

- Add audio clip metadata and state transitions.
- Add recording hooks only after the draft value and attachment lifecycle are stable.
- Keep capture/upload implementation host-configurable.
- Build registry UI for record, stop, processing, retry, playback preview, and remove.

Validation:

- Tests for state transitions independent of browser media APIs.
- Browser-only manual stories for actual recording flows.
- Vitest Browser Mode tests should cover UI state transitions with mocked media APIs before relying on real device input.

### 10a. Treat Large Pasted Text As An Attachment (lower priority)

Deferred; schedule opportunistically after the higher-numbered stages or when a host needs it. Added 2026-06-12: people throw large texts into prompt boxes, and inlining them wrecks the draft; chat UIs conventionally convert them to a text attachment instead.

- When pasted plain text exceeds a configurable threshold, synthesize a text file and route it through the normal ingestion pipeline (validation, upload contract, lifecycle per ADR 0011) instead of inserting it into the document.
- Opt-in via the attachments plugin config (e.g. `textPasteThreshold`); off by default so the core paste behavior stays unchanged.
- Add an expand-to-inline command for text-derived attachments that still hold their local file: removes the attachment and inserts the text into the editor. Registry UI gets the affordance on the attachment tile.
- Extend the existing `PASTE_COMMAND` interception: files keep precedence, then the text-length branch; decide how pastes inside code blocks behave (likely stay inline).
- Decide the synthesized file naming/mime convention and whether hosts can intercept the conversion.

Validation:

- Engine tests for threshold gating, synthesized file ingestion, and expand-to-inline restoring the text.
- Browser tests for pasting large text (converted), small text (inlined), and the expand affordance.
- Story demonstrating the conversion and expansion flow.

### 11. Formalize Registry Distribution

- Add root `registry.json`.
- Split installable registry items by plugin where practical.
- Add shared registry utilities/styles only when duplication justifies them.
- Document install paths for each first-party UI plugin.
- Add validation for registry files to CI once release setup exists.

Validation:

- Local registry build/validation command.
- Fresh-app smoke test installing at least the composer shell, formatting toolbar, model picker, mentions UI, and attachments UI.
- Vitest Browser Mode smoke test against installed registry components in a clean fixture app.

## Suggested Implementation Order

1. Value model and reactive-engine core.
2. Lexical plain markdown editor.
3. Formatting behavior.
4. Model/effort picker plugin and registry UI.
5. Mentions behavior and registry UI.
6. Attachments behavior and registry UI.
7. Link editing and auto-linking.
8. Markdown typing shortcut hardening.
9. Slash commands and context chips.
10. Audio capture.
11. Large-text paste-to-attachment (lower priority; possible any time after attachments, stage 7A).

The model/effort picker should come before mentions and attachments because it proves plugin registration, submitted value integration, slots, and registry UI without requiring custom Lexical nodes or file lifecycle complexity.

## Package And Source Layout Direction

```text
src/
  core/
    value.ts
    engine.ts
    nodes.ts
    plugin.ts
  lexical/
    MessageComposerLexical.tsx
    markdown.ts
    plugins/
    nodes/
  react/
    MessageComposer.tsx
    slots.tsx
    hooks.ts
  plugins/
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
  plugins/
```

This layout is provisional. The important rule is that `src/plugins/*` contains reusable behavior and contracts, while `registry/*` contains first-party installable UI.

## Validation Strategy

- `vp check` remains the formatting/lint/type gate.
- `vp test` covers engine reducers, plugin wiring, Lexical serialization, and React integration that does not need a real browser.
- Engine tests are required for every plugin that adds reactive-engine nodes, streams, reducers, or plugin initialization.
- Vitest Browser Mode is the default browser-test infrastructure for user-facing workflows that depend on DOM selection, focus, keyboard navigation, clipboard, drag/drop, popovers, dialogs, or real browser event behavior.
- Do not assume Playwright as the default browser-test runner. Add a different browser runner only when Vitest Browser Mode cannot cover a specific workflow.
- Ladle stories cover interactive scenarios and act as the browser-test fixture surface.
- Core tests should not depend on shadcn/Base UI registry components.
- Registry UI should have stories that prove both default UI and custom UI can coexist over the same core plugin behavior.
- First-party interactive stories should use the shadcn/Base UI components once those components exist.

## Engine Test Requirements

Every plugin with engine state should include pure engine tests that instantiate an `Engine`, activate the relevant nodes, publish commands, and assert resulting cells or emitted streams.

Engine tests should cover:

- initial state and plugin initialization
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

Stories should be structured as scenario fixtures, not ad hoc demos. Each implemented plugin should add stories that make states and transitions easy to inspect manually and reuse in browser tests.

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

Each plugin should include stories for:

- default first-party shadcn/Base UI
- custom UI over the same core plugin contracts
- loading, empty, error, disabled, and edge states where applicable
- submitted value inspection

Use first-party shadcn/Base UI components for the main interactive stories once the relevant registry component exists. Minimal unstyled stories are allowed only while the registry component for that plugin has not been built yet, or when the story is specifically proving custom UI.

## Implementation Notes From Stages 1–3

API deltas relative to the sketches above:

- `engineRef` takes the `EngineRef` type from `@virtuoso.dev/reactive-engine-react` (created with `useEngineRef()`), not a `React.Ref`. Remote hooks and `EngineRef` are re-exported from the package index.
- A minimal `MessageComposerHandle` (`focus`/`reset`/`submit`) is exposed through the `ref` prop (ADR 0004). Plugin commands must not grow onto this handle.
- `editorProps` targets the Lexical `ContentEditable` div (`HTMLAttributes<HTMLDivElement>` plus a string `placeholder`), not a textarea.
- The Lexical editor instance is exported as the `lexicalEditor$` cell (lexical layer, not core) as the advanced escape hatch.
- Enter-to-submit is handled inside Lexical via `KEY_ENTER_COMMAND` at high priority; `editorProps.onKeyDown` cannot preempt it. Configurable submit behavior remains future work.

Engine integration constraints discovered during implementation (encoded in code comments, repeated here for future goal runs):

- `EngineProvider`'s mount effect treats the `initWith` object identity as the engine identity; an inline object literal disposes/recreates the engine every render. Seed via `pubIn` in `initFn` instead (data-table pattern).
- `DerivedCell` projections activate lazily and miss emissions that precede their first read. The core graph registers all draft projections via `addNodeInit` on `draftValue$` so exported cells are consistent for late readers.
- Strict-controlled reverts for non-echoing hosts cannot be purely reactive (no emission happens); the Lexical bridge arms a zero-delay revert timer after each controlled edit, cancelled by the echo emission, deferred while IME composition is active.
- Engine-originated Lexical imports use discrete, tagged updates: `discrete` keeps the editor synchronously consistent with engine state; the tag breaks the editor→engine→editor feedback loop. Undo/redo restores arrive with empty dirty sets and the `historic` tag — update listeners must not treat them as selection-only changes.

## Implementation Notes From Stages 4–5

- The plugin/slot contract is recorded in ADR 0005: `plugins` is construction-time configuration, slots are `header`/`toolbar`/`footer`, host slots override plugin slots, and command streams are declared non-distinct because commands are events.
- The markdown transformer subset (`MARKDOWN_TRANSFORMERS`) stays internal; the open question about exposing it for user extension is deferred until a concrete extension need appears.
- Lexical's markdown shortcut listener only fires when the anchor advances like real typing (one character per update), and a converted text-format shortcut intentionally leaves the caret outside the format. Tests must type character-by-character and not expect active formatting state after conversion.
- MDXEditor's markdown-shortcut reference supports inline code via `` ` `` and code blocks via <code>```$lang </code>, but only when the corresponding editor capabilities are active. The composer should preserve that separation: shortcuts are typing-time UX, while mdast visitors remain authoritative for import/export.
- Optional plugin behavior APIs are package subpaths, not root exports: `@mdxeditor/message-composer/plugins/formatting` and `@mdxeditor/message-composer/plugins/agent-settings`. The root package exports the composer, core value/nodes, slots, remote hooks, and the Lexical editor escape hatch.
- Registry layout: `registry/components/<plugin>/<item>.tsx` plus `registry/lib/utils.ts` (`cn`). Registry files import the published package name and plugin subpaths, resolved locally through vite aliases and tsconfig `paths` entries; without the `paths` entries TypeScript resolves self-references to stale `dist` types. Imports inside registry files currently carry `.ts(x)` extensions (nodenext); verify the shadcn CLI rewrites them at stage 11.
- Tailwind v4 is dev-only (stories and registry development) via `@tailwindcss/vite` in both vite configs and an `@source "../../registry"` directive; the npm package remains Tailwind-free.
- Browser-test gotcha: pressing the non-native modifier is not a no-op on macOS — Ctrl+letter combos are Cocoa caret-movement bindings that collapse the selection. Pick the modifier from `navigator.platform`.
- Shift+Enter inside a list item creates the next item — and exits the list from an empty item — by dispatching `INSERT_PARAGRAPH_COMMAND` (which routes through ListPlugin's empty-item handling; `selection.insertParagraph()` does not). Plain Enter is reserved by submit and never reaches Lexical's list semantics; outside lists Shift+Enter remains a line break.
- Toolbar UI pattern (ADR 0012): registry toolbars compose Base UI `Toolbar.Root`/`Toolbar.Button` with `Toggle` through the `render` prop (one tab stop, arrow-key navigation, automatic `aria-pressed`/`data-pressed`), and prevent `mousedown` default on the root so clicks never steal editor focus or selection. Icon-only controls carry `aria-label`s that double as the browser-test contract.
- Browser-test gotcha: the first browser-mode run after adding imports from a new dependency subpath can time out wholesale while Vite optimizes the new chunks and reloads the page; rerun before debugging.

## Implementation Notes From Stage 7

- Attachment state changes are draft edits routed through `editorChange$` (ADR 0011), like agent-settings selections: committed when uncontrolled, emitted for the host to echo when controlled. Async upload transitions (progress, settlement) patch by id against the live draft and drop silently when the id is gone — removal and non-echoing controlled hosts need no special-casing.
- `attachmentsPlugin` contributes no Lexical nodes and no React plugin components. Drop/paste command registration (`DROP_COMMAND`/`PASTE_COMMAND`/`DRAGOVER_COMMAND` at `COMMAND_PRIORITY_HIGH`) and the picker input attach through a `lexicalEditor$` subscription in `init`, so the entire plugin is engine-testable without React or Lexical.
- The picker is a plugin-managed hidden `<input type="file" data-message-composer-attachment-input>` inserted after the editor root element; `openAttachmentPicker$` clicks it. Browser tests feed it with `userEvent.upload`, and verify the button path by `preventDefault`-ing the input's `click` event, since the native file chooser cannot be automated.
- Validation rejections live in the `attachmentRejections$` cell (replaced per ingestion, cleared by valid adds or `dismissAttachmentRejections$`); they never enter the value.
- Browser-test gotchas: React 19 commits asynchronously, so await a retrying locator before touching `locator.element()` or `querySelector`; `page.elementLocator` derives text-based selectors that break when an element's text mutates mid-upload — poll live DOM attributes instead.

## Decision Protocol

When a goal run hits an item from Open Questions or a new ambiguity:

1. Choose the most conservative option that keeps public contracts reversible.
2. Record it as a numbered decision doc in `project/decisions/`.
3. Flag the decision in the run summary for review.
4. If every option permanently locks in a public API shape or serialization format, prefer deferring the capability over guessing.

## Open Questions

- When and how the mdast visitor registration axes become public extension API. Stage 6 consumed them internally (the mentions plugin registers its visitors and a value patcher through the registry cells), which validated the shape without exporting it; opening the axes to third-party plugins remains undecided.
- How registry items should be grouped: per plugin, per surface, or bundled presets.
