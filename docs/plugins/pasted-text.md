# Pasted text

Use `pastedTextPlugin()` to keep large pasted documents out of the editable message. It preserves the original clipboard text in `value.extensions.pastedTexts`. The optional registry UI shows a pill for each document, with an exact-text preview, copy, edit, and remove controls.

```tsx
import { MessageComposer } from "@mdxeditor/message-composer";
import { getPastedTexts, pastedTextPlugin } from "@mdxeditor/message-composer/plugins/pasted-text";
import { PastedTextList } from "@/components/message-composer/pasted-text-list";

const plugins = [pastedTextPlugin({ minCharacters: 2000, minLines: 20 })];
const slots = { footer: PastedTextList };

export function Composer() {
  return (
    <MessageComposer
      plugins={plugins}
      slots={slots}
      onSubmit={(value) => {
        const texts = getPastedTexts(value);
        // Send both value.markdown and texts to your application.
        console.log({ markdown: value.markdown, pastedTexts: texts });
      }}
    />
  );
}
```

If you already have a footer, render `PastedTextList` inside it alongside your send controls. It can also go in the header. Install the UI with:

```sh
pnpm dlx shadcn@latest add mdx-editor/message-composer/pasted-text-ui
```

## Paste behavior

A paste becomes a text item when it reaches either threshold: 2,000 JavaScript string characters or 20 lines by default. Both options must be positive integers. Shorter pastes retain the editor's normal paste behavior. Pasting into inline code or a code block also retains the editor's normal behavior. Clipboard files remain available to the attachments plugin.

Large pastes use `text/plain`, even when the clipboard also contains HTML. The plugin does not parse Markdown, detect a programming language, trim text, normalize line endings, upload files, or load linked resources. Text items sit alongside the message, in paste order. Adding one leaves the current text selection and caret unchanged.

## Value and commands

Each item is `{ id: string, text: string }`. Read `pastedTexts$` inside a composer or call `getPastedTexts(value)` at submit time. Publish `addPastedText$` with a string to add an item explicitly, regardless of thresholds; publish `updatePastedText$` with `{ id, text }` to edit it, or `removePastedText$` with its id to remove it. Empty strings are ignored on add; an existing item can be edited to empty text.

Changes follow the standard controlled/uncontrolled contract. A controlled host must echo the entire value, including `extensions.pastedTexts`, and preserve other extensions. Reset clears text items; submit leaves them in the draft. As with attachment and context-chip changes, text-item changes are outside Lexical's prose undo history. Use the explicit remove control to undo adding an item.

The Markdown field does **not** contain the pasted text. Hosts must deliver these records separately or explicitly combine them with the message when constructing agent input. If a host disables its send button for empty Markdown, it must also check for pasted text items so an attachment-only message can be sent. Storage, transport, content limits, and agent delivery remain host responsibilities.

The preview renders source text, including Markdown markers. Editing uses a plain-text textarea; browsers normalize line endings in edited textarea values. An unedited item and the copy action preserve the original string.

Try **Pasted text → Playground**, **With pasted text**, and **Controlled** in Ladle.

## Insert a pill into the message

Choose **Insert** on a pill, or **Insert into message** in its preview, to move that item to the end of the editable message. Existing prose and other pills stay in place. Markdown source becomes literal editable text so headings, image references, and other unsupported constructs cannot disappear during conversion. The item is removed from `extensions.pastedTexts` in the same value change. Controlled hosts must echo that complete value. The command is also available as `expandPastedText$`, with the item id as its payload.
