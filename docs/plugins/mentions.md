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

Results can include options that are visible but cannot be picked, for example a user who cannot see the conversation. Set `disabled: true` and explain why in `description`:

```ts
search: async (query) => [
  { id: "u1", label: "Ada" },
  { id: "u2", label: "Alan", disabled: true, description: "Not a member of this channel" },
],
```

The menu starts on the first enabled result. Arrow keys, Ctrl-N, and Ctrl-P skip disabled results. Enter, Tab, `confirmMention$`, and `insertMention$` never insert a disabled option. The first-party menu renders a disabled option with `aria-disabled` and its description.

Headless exports include menu, result, highlight, loading, error, and insertion state/commands such as `mentionMenu$`, `mentionResults$`, `insertMention$`, and `cancelMention$`.

First-party UI:

```sh
npx shadcn@latest add mdx-editor/message-composer/mentions-ui
```
