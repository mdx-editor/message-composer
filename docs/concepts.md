# Concepts

## Layers

The composer has three separate layers:

- Core package: editing surface, value semantics, plugin contracts, engine state, and markdown import/export.
- Optional plugin behavior: formatting, agent settings, mentions, attachments, links, slash commands, and context chips.
- First-party registry UI: shadcn/Base UI components installed into the host app through the shadcn registry.

The core npm package does not import registry UI, Tailwind, shadcn/ui, or Base UI.

## Markdown And Sidecars

`value.markdown` is the user's authored prose.

Structured app context lives outside markdown:

- `attachments`: file metadata and upload state.
- `mentions`: mention metadata derived from mention nodes.
- `agent`: model and effort selections.
- `extensions.contextChips`: slash-command chips such as prompts, tools, files, or app-owned objects.

This keeps markdown readable and portable while preserving richer data for submit handlers.

## Plugins

Plugins are optional behavior modules:

```tsx
<MessageComposer plugins={[formattingPlugin(), mentionsPlugin({ providers })]} />
```

Plugin configuration is captured for the component lifetime. Use `slots` for UI that needs to change between renders.

## Slots

Plugins and hosts can provide named slots:

- `header`
- `toolbar`
- `footer`

Plugin slots provide defaults. Host `slots` override plugin slots by key.

## Registry UI

Registry UI is source code copied into the host application by shadcn. It consumes the same plugin cells, streams, and slots that custom UI can use. Hosts can install the full kit or individual surfaces.
