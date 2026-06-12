# Component Philosophy

The package should follow a closed-semantics, open-presentation model.

Core behavior should be React-based and UI-system agnostic. First-party feature UI can be built as shadcn/Base UI components and distributed through the shadcn GitHub registry, but the core package must not require Tailwind, shadcn/ui, or those registry components.

## Package-Owned Behavior

- Lexical setup, schema, nodes, plugins, and update lifecycle.
- Markdown import and export.
- Submit behavior and payload shape.
- Optional feature contracts and state wiring for features such as formatting, mentions, attachments, slash commands, and model/effort controls.
- Mention detection, query lifecycle, keyboard navigation, insertion, deletion, and serialization.
- File paste, drag/drop, picker normalization, validation, attachment state, retry, and remove lifecycle.
- Link transformation and editing behavior.
- Focus, selection preservation, IME correctness, and accessibility contracts.
- Command and state APIs for external UI.

## Application-Owned Presentation

- Visual treatment of menus, chips, buttons, dialogs, and previews.
- Providers for mention search, upload, slash commands, and link validation.
- Which optional features are enabled.
- Toolbar composition and surrounding product controls.
- Whether to use the first-party shadcn/Base UI registry components or fully custom UI.

## API Principle

Avoid APIs that make consumers implement a feature from scratch. Prefer APIs where the component owns the behavior and consumers customize data and rendering.

Example shape:

```tsx
<MessageComposer
  mentions={{
    trigger: "@",
    search: async (query) => users,
  }}
  components={{
    MentionItem,
    MentionMenu,
    MentionToken,
  }}
/>
```

## Layers

1. UI-agnostic core component and value model.
2. Optional feature modules for mentions, attachments, links, formatting, model/effort controls, and submission behavior.
3. Named slots/components for presentation replacement.
4. First-party shadcn/Base UI components distributed through the shadcn GitHub registry.
5. Reactive control API for external UI.
6. Advanced Lexical escape hatch for custom nodes/plugins.
