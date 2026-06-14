# Agent Settings Plugin

Import:

```ts
import { agentSettingsPlugin } from "@mdxeditor/message-composer/plugins/agent-settings";
```

Use:

```tsx
<MessageComposer
  plugins={[
    agentSettingsPlugin({
      models: [
        { id: "gpt-5.5", label: "GPT-5.5" },
        { id: "gpt-5.1", label: "GPT-5.1" },
      ],
      efforts: ["low", "medium", "high"],
      defaultModelId: "gpt-5.5",
      defaultEffort: "medium",
    }),
  ]}
/>
```

The submitted value stores ids, not display metadata:

```json
{
  "agent": {
    "modelId": "gpt-5.5",
    "effort": "medium"
  }
}
```

Headless exports include `agent$`, `modelOptions$`, `effortOptions$`, `selectModel$`, and `selectEffort$`.

First-party UI:

```sh
npx shadcn@latest add mdx-editor/message-composer/model-effort-picker
```
