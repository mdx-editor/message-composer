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
      maxTotalFileSize: 25 * 1024 * 1024,
      upload: async (file, { signal, onProgress }) => {
        const result = await uploadFile(file, { signal, onProgress });
        return { url: result.url, data: { attachmentId: result.id } };
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
  data?: unknown;
  progress?: number;
  error?: string;
}
```

Validation rejections live in plugin state, not in the submitted value.

`validate(file, context)` receives an immutable snapshot of the draft, the files accepted earlier
in the current ingestion batch, and their aggregate byte count. Browser MIME and size checks are
advisory. The upload service must perform authoritative validation.

Attachments in `pending`, `uploading`, or `error` state block every submit path. Read
`submitBlockers$` from the core package when custom UI needs to explain the block.

Subscribe to `attachmentRemoved$` when explicit removal should trigger best-effort host cleanup.
The event includes the full attachment snapshot. Reset, controlled host replacement, and composer
disposal abort active transfers but do not emit deletion intent. Durable orphan cleanup remains a
host responsibility because the browser can close without running lifecycle callbacks.

The first-party `AttachmentList` accepts `renderPreview` for complete preview replacement or
`resolvePreview(attachment, { signal })` for authenticated image URLs and blobs. It aborts stale
resolution and revokes generated object URLs. Without either option, local files and public image
URLs keep their default previews.

When a clipboard payload contains files and text or HTML, the plugin ingests the files and suppresses
the other clipboard content. Configure a host-specific ingestion surface if mixed paste must retain
both.

First-party UI:

```sh
npx shadcn@latest add mdx-editor/message-composer/attachments-ui
```
