# Message Composer Docs

`@mdxeditor/message-composer` is a React message composer for chat and AI-agent interfaces. It stores user-authored prose as markdown and keeps app-owned context such as attachments, mentions, agent settings, and slash-command chips in structured sidecar fields.

## Install

```sh
pnpm add @mdxeditor/message-composer
```

The package expects React and React DOM from the host app.

```tsx
import { MessageComposer } from "@mdxeditor/message-composer";

export function ChatInput() {
  return (
    <MessageComposer
      editorProps={{ placeholder: "Message..." }}
      onSubmit={(value) => {
        console.log(value.markdown);
      }}
    />
  );
}
```

## Demos

Interactive Ladle demos are published at:

- https://mdx-editor.github.io/message-composer/

## Docs

- [Getting started](./getting-started.md)
- [Concepts](./concepts.md)
- [Value and submit semantics](./value-and-submit-semantics.md)
- [Plugins](./plugins/README.md)
- [First-party registry UI](./registry-ui.md)
- [Testing and stories](./testing-and-stories.md)

## Agent Skills

This repository includes installable agent skills under [`../skills`](../skills):

```sh
npx skills add mdx-editor/message-composer
```
