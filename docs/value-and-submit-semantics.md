# Value And Submit Semantics

## Value Shape

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

`createEmptyMessageComposerValue()` returns:

```ts
{
  markdown: "",
  attachments: [],
  mentions: [],
  audioClips: []
}
```

## Controlled Mode

Passing `value` makes the composer strict-controlled. Edits are emitted through `onValueChange`, and the host must echo the next value back for the edit to persist.

```tsx
<MessageComposer value={value} onValueChange={setValue} />
```

Do not switch between controlled and uncontrolled mode during a component lifetime.

## Uncontrolled Mode

Pass `defaultValue` or no value to let the composer own its draft.

```tsx
<MessageComposer defaultValue={{ ...createEmptyMessageComposerValue(), markdown: "Hello" }} />
```

## Submit

`onSubmit` receives the current draft value. Submit does not clear the draft.

If `onSubmit` returns a promise, the composer tracks submitting/error lifecycle state and leaves the draft intact on rejection.

## Sidecar Preservation

Hosts that control the value should preserve sidecar fields unless intentionally editing them:

```ts
setValue((current) => ({
  ...current,
  markdown: nextMarkdown,
}));
```

Avoid replacing `extensions` with a new object that drops plugin-owned keys such as `contextChips`.
