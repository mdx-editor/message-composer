# Component Philosophy

The package should follow a closed-semantics, open-presentation model.

## Package-Owned Behavior

- Lexical setup, schema, nodes, plugins, and update lifecycle.
- Markdown import and export.
- Submit behavior and payload shape.
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

1. Usable default component.
2. Feature configuration for mentions, attachments, links, formatting, and submission.
3. Named slots/components for presentation replacement.
4. Reactive control API for external UI.
5. Advanced Lexical escape hatch for custom nodes/plugins.
