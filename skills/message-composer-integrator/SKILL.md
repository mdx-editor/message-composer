---
name: message-composer-integrator
description: Use when integrating @mdxeditor/message-composer into a React chat or AI-agent app, choosing plugins, wiring controlled or uncontrolled values, handling attachments, mentions, slash commands, context chips, agent settings, or installing first-party shadcn/Base UI registry components.
---

# Message Composer Integrator

Use this skill to add `@mdxeditor/message-composer` to downstream React applications.

## Workflow

1. Identify the target integration shape:
   - Headless core only.
   - Core plus custom UI over plugin state.
   - Core plus first-party shadcn/Base UI registry components.
2. Choose the smallest plugin set required by the product.
3. Wire value ownership deliberately:
   - Use uncontrolled mode for simple drafts.
   - Use controlled mode only when the host can echo every edit back through `value`.
4. Preserve structured sidecars when transforming values.
5. Add UI last, after behavior and value semantics are clear.

## Core Setup

Install the package:

```sh
pnpm add @mdxeditor/message-composer
```

Render the composer:

```tsx
import { MessageComposer } from "@mdxeditor/message-composer";

export function ChatComposer() {
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

## References

Read only the reference needed for the task:

- `references/value-shape.md`: controlled/uncontrolled values, sidecars, submit behavior.
- `references/plugin-recipes.md`: plugin setup recipes for formatting, agent settings, mentions, attachments, slash commands, and context chips.
- `references/registry-ui.md`: first-party shadcn/Base UI install commands and item split.

## Integration Rules

- Treat `value.markdown` as user-authored prose.
- Treat attachments, mentions, agent settings, and context chips as structured sidecars.
- Preserve `value.extensions` in controlled mode unless intentionally clearing plugin-owned extension data.
- Do not assume first-party registry UI is required; every plugin should remain usable with custom UI.
- Keep host-specific model ids, file ids, prompt ids, and tool metadata app-owned.
