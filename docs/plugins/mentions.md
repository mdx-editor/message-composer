# Mentions Plugin

Import:

```ts
import { mentionsPlugin } from "@mdxeditor/message-composer/plugins/mentions";
```

Use:

```tsx
<MessageComposer
  plugins={[
    mentionsPlugin({
      providers: [
        {
          trigger: "@",
          search: async (query, signal) => searchUsers(query, signal),
        },
      ],
    }),
  ]}
/>
```

Mentions serialize in markdown as links with a `mention:` URL, for example:

```md
[@Ada](mention:u1)
```

The `mentions` sidecar is derived from the document. Do not treat it as an independent source of truth.

Headless exports include menu, result, highlight, loading, error, and insertion state/commands such as `mentionMenu$`, `mentionResults$`, `insertMention$`, and `cancelMention$`.

First-party UI:

```sh
npx shadcn@latest add mdx-editor/message-composer/mentions-ui
```
