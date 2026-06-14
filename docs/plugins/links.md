# Links

Link behavior currently lives in the formatting plugin.

Enable it with:

```tsx
import { formattingPlugin } from "@mdxeditor/message-composer/plugins/formatting";

<MessageComposer plugins={[formattingPlugin()]} />;
```

The plugin supports:

- Typed URL auto-linking.
- Pasted URL auto-linking.
- Optional bare-domain matching.
- Link creation from selected text.
- Link editing and removal through headless commands.
- Mention-link exclusion for `mention:` URLs.

First-party link editing UI is part of the formatting toolbar:

```sh
npx shadcn@latest add mdx-editor/message-composer/formatting-toolbar
```
