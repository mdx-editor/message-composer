# Value Shape

Use this reference when wiring controlled/uncontrolled values, submit handlers, or structured metadata.

## Shape

```ts
interface MessageComposerValue<
  TAgent extends object = MessageComposerAgentValue,
  TExtensions extends object = Record<string, unknown>,
> {
  markdown: string;
  attachments: MessageComposerAttachment[];
  mentions: MessageComposerMention[];
  audioClips: MessageComposerAudioClip[];
  agent?: TAgent;
  extensions?: TExtensions;
}
```

Use `createEmptyMessageComposerValue()` to create a blank value.

## Markdown

`markdown` is the user's authored prose. Do not inject app-only context into markdown unless the product explicitly wants the user to see and edit it.

## Sidecars

Structured context lives outside markdown:

- `attachments`: uploaded or uploading file metadata.
- `mentions`: derived mention metadata.
- `audioClips`: reserved for the deferred audio plugin.
- `agent`: model and effort ids from the agent-settings plugin.
- `extensions.contextChips`: slash-command chips for prompts, files, tools, and host-owned objects.

## Controlled Mode

Passing `value` makes the composer strict-controlled. The host must echo edits back through `value` for them to persist.

When editing a controlled value, preserve unrelated fields:

```ts
setValue((current) => ({
  ...current,
  markdown: nextMarkdown,
}));
```

Avoid replacing `extensions` with a new object that drops plugin-owned keys.

## Submit

`onSubmit` receives the full value and does not clear the draft. If the handler returns a promise, the composer tracks submitting/error state and leaves the draft intact on rejection.
