# Formatting Plugin

Import:

```ts
import { formattingPlugin } from "@mdxeditor/message-composer/plugins/formatting";
```

Use:

```tsx
<MessageComposer plugins={[formattingPlugin()]} />
```

The plugin adds:

- Bold, italic, strikethrough, and inline code.
- Quote, fenced code block, unordered list, and ordered list blocks.
- Markdown typing shortcuts for the supported subset.
- Typed and pasted URL auto-linking.
- Link edit/remove commands and current-link state.

Headless exports include `formattingState$`, `formatText$`, `toggleBlock$`, `toggleLink$`, `beginLinkEdit$`, `editLink$`, `removeLink$`, and `currentLink$`.

First-party UI:

```sh
npx shadcn@latest add mdx-editor/message-composer/formatting-toolbar
```

Fallback direct JSON:

```sh
npx shadcn@latest add https://mdx-editor.github.io/message-composer/r/formatting-toolbar.json
```
