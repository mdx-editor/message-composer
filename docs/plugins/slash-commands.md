# Slash Commands And Context Chips

Import:

```ts
import { slashCommandsPlugin } from "@mdxeditor/message-composer/plugins/slash-commands";
```

Slash commands are headless. Providers return grouped command items and optional child result sets.

```tsx
<MessageComposer
  plugins={[
    slashCommandsPlugin({
      providers: [
        {
          search: () => ({
            groups: [{ id: "context", label: "Context" }],
            items: [
              {
                id: "file",
                label: "File",
                group: "context",
                chip: { id: "file:readme", type: "file", label: "README.md" },
              },
            ],
          }),
        },
      ],
    }),
  ]}
/>
```

Context chips live in `value.extensions.contextChips`. They do not serialize into markdown.

First-party UI:

```sh
npx shadcn@latest add mdx-editor/message-composer/slash-command-shelf
```

The first-party shelf is a full-width command menu above the composer plus a removable chip row.
