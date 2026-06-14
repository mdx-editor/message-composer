# Getting Started

Install the package:

```sh
pnpm add @mdxeditor/message-composer
```

Render the core composer:

```tsx
import { MessageComposer } from "@mdxeditor/message-composer";

export function Composer() {
  return (
    <MessageComposer
      editorProps={{ placeholder: "Message..." }}
      onSubmit={(value) => {
        console.log(value);
      }}
    />
  );
}
```

The root component is intentionally minimal. Add behavior with optional plugins:

```tsx
import { MessageComposer } from "@mdxeditor/message-composer";
import { formattingPlugin } from "@mdxeditor/message-composer/plugins/formatting";

export function Composer() {
  return <MessageComposer plugins={[formattingPlugin()]} />;
}
```

Add first-party shadcn/Base UI through the registry when you want the supported visual layer:

```sh
npx shadcn@latest add mdx-editor/message-composer/message-composer-kit
```

The registry components install into your app. They are not imported by the core package.

## Submit

`onSubmit` receives the full `MessageComposerValue`:

```tsx
<MessageComposer
  onSubmit={async (value) => {
    await sendMessage({
      markdown: value.markdown,
      attachments: value.attachments,
      mentions: value.mentions,
      agent: value.agent,
      contextChips: value.extensions?.contextChips,
    });
  }}
/>
```

Submit does not clear the draft. Clear by updating controlled `value` or by using the exported reset command through the engine APIs.

## Controlled Usage

Controlled mode follows React input semantics: the host must echo edits back through `value`.

```tsx
import { createEmptyMessageComposerValue, MessageComposer } from "@mdxeditor/message-composer";
import { useState } from "react";

export function ControlledComposer() {
  const [value, setValue] = useState(createEmptyMessageComposerValue);

  return <MessageComposer value={value} onValueChange={setValue} onSubmit={sendValue} />;
}
```

When controlling the value, preserve fields you do not own directly. For example, keep `extensions.contextChips` unless you intentionally clear slash-command chips.
