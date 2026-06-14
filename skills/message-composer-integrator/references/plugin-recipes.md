# Plugin Recipes

Use these recipes when choosing or wiring composer plugins.

## Formatting

```tsx
import { formattingPlugin } from "@mdxeditor/message-composer/plugins/formatting";

<MessageComposer plugins={[formattingPlugin()]} />;
```

Adds text formatting, block formatting, markdown shortcuts, auto-linking, and link editing commands. Headless exports include `formattingState$`, `formatText$`, `toggleBlock$`, `currentLink$`, `editLink$`, and `removeLink$`.

## Agent Settings

```tsx
import { agentSettingsPlugin } from "@mdxeditor/message-composer/plugins/agent-settings";

<MessageComposer
  plugins={[
    agentSettingsPlugin({
      models: [{ id: "gpt-5.5", label: "GPT-5.5" }],
      efforts: ["low", "medium", "high"],
      defaultModelId: "gpt-5.5",
    }),
  ]}
/>;
```

Stores ids under `value.agent`. Rich option metadata stays in plugin config.

## Mentions

```tsx
import { mentionsPlugin } from "@mdxeditor/message-composer/plugins/mentions";

<MessageComposer
  plugins={[
    mentionsPlugin({
      providers: [{ trigger: "@", search: searchUsers }],
    }),
  ]}
/>;
```

Mention nodes serialize as `[@Ada](mention:u1)`. The `mentions` sidecar is derived from the document.

## Attachments

```tsx
import { attachmentsPlugin } from "@mdxeditor/message-composer/plugins/attachments";

<MessageComposer
  plugins={[
    attachmentsPlugin({
      accept: "image/*,.pdf",
      upload: async (file, { signal, onProgress }) => {
        return { url: await uploadFile(file, { signal, onProgress }) };
      },
    }),
  ]}
/>;
```

Picker, drop, and paste ingestion all route through the same validation/upload lifecycle. Upload handling is host-owned.

## Slash Commands And Context Chips

```tsx
import { slashCommandsPlugin } from "@mdxeditor/message-composer/plugins/slash-commands";

<MessageComposer
  plugins={[
    slashCommandsPlugin({
      providers: [{ search: searchCommands }],
    }),
  ]}
/>;
```

Context chips live in `value.extensions.contextChips`; they do not serialize into markdown. Commands may replace the slash run, add a chip, execute host logic, or drill into child result sets.

## Links

Link behavior is part of `formattingPlugin()`. Use the formatting toolbar registry item for first-party link UI.
