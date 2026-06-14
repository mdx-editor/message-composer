# Attachments Plugin

Import:

```ts
import { attachmentsPlugin } from "@mdxeditor/message-composer/plugins/attachments";
```

Use:

```tsx
<MessageComposer
  plugins={[
    attachmentsPlugin({
      accept: "image/*,.pdf",
      maxFileSize: 10 * 1024 * 1024,
      upload: async (file, { signal, onProgress }) => {
        const url = await uploadFile(file, { signal, onProgress });
        return { url };
      },
    }),
  ]}
/>
```

The plugin normalizes picker, drop, and paste ingestion. Upload handling is host-owned.

Submitted attachments include metadata and lifecycle state:

```ts
{
  id: string;
  name: string;
  mimeType: string;
  size: number;
  status: "pending" | "uploading" | "success" | "error";
  url?: string;
  progress?: number;
  error?: string;
}
```

Validation rejections live in plugin state, not in the submitted value.

First-party UI:

```sh
npx shadcn@latest add mdx-editor/message-composer/attachments-ui
```
