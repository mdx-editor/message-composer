# Functional Requirements

## Core Composition

- Users can enter and edit multi-line message text.
- The composer outputs markdown.
- The composer supports configurable submit behavior, including `Enter` to submit and `Shift+Enter` for newline.
- The composer supports disabled, focused, empty, composing, uploading, submitting, and error states.
- The editor auto-resizes up to a maximum height, then scrolls internally.
- Cursor position, selection, undo/redo, and IME composition behavior must remain correct.

## Markdown And Formatting

- Users can type markdown directly.
- The composer supports markdown shortcuts where appropriate.
- The initial MVP markdown subset should include bold, italic, strikethrough, inline code, fenced code blocks, unordered lists, ordered lists, blockquotes, and links.
- Pasted rich text should be converted into markdown-compatible editor state where possible.
- The public content contract should be markdown, not HTML.

## Links

- Typed and pasted URLs can be detected automatically.
- URL text can transform into inline links.
- Users can edit or remove links.
- Links serialize predictably as markdown.

## Mentions

- Mentions are triggered by configurable characters, starting with `@`.
- Mention search opens as the user types and supports async providers.
- Selected mentions render as inline tokens/nodes.
- Mentions support keyboard navigation, pointer selection, deletion as a unit, and copy/paste.
- The public API should expose selected mention metadata.
- Serialization likely needs markdown plus sidecar metadata, because markdown alone does not model mentions reliably.

## Files And Attachments

- Users can attach files through a file picker.
- Users can drag and drop files into the composer.
- Users can paste files and images from the clipboard.
- Attachments expose upload, success, error, retry, and remove states.
- Host applications provide upload handling, accepted MIME types, size limits, and validation.
- Message submission includes markdown plus attachment metadata.
- Attachments should remain structured metadata by default instead of being forced into markdown.

## Audio Capture

- The composer can support recording or attaching audio clips.
- Audio clips expose recording, processing, upload, success, error, retry, and remove states where applicable.
- Message submission includes markdown plus audio clip metadata.
- Audio clips should remain structured metadata by default instead of being forced into markdown.

## Paste Support

- Plain text paste inserts text.
- Markdown paste preserves markdown structure where possible.
- Rich HTML paste converts into supported editor nodes.
- URL paste can auto-link.
- File and image paste creates attachments.
- Unsupported rich content degrades to readable plain text.

## AI And Agent UI

- The composer can support slash commands.
- The composer can support context chips, file references, prompts, or selected entities.
- The composer can expose stop/cancel behavior for running agent responses.
- The composer can support optional model and effort controls for agent-oriented use cases.
- Model and effort selections should be represented in the submitted value when the feature is enabled.
- Model, tool, or context controls should be possible around the composer without becoming hard-coded product UI.

## Accessibility

- The editor, menus, toolbar controls, attachment controls, and dialogs must be keyboard accessible.
- Screen-reader labels are required for non-text controls and interactive menus.
- Focus management must be explicit for popovers, dialogs, menus, and file dialogs.
- IME and mobile keyboard behavior must be preserved.

## Extensibility

- The component should support controlled and uncontrolled usage.
- Host applications can customize mention sources, attachment handling, toolbar buttons, placeholder text, validation, and submit rules.
- Styling should be themeable without requiring Tailwind, shadcn/ui, or another specific design system.
- Formatting toolbar, model picker, mentions UI, attachment UI, slash-command UI, and similar capabilities should be optional features.
- First-party feature UI should be available as shadcn/Base UI registry components.
- Consumers must be able to build custom feature UI without Tailwind, shadcn/ui, or Base UI by using the same core contracts and state APIs.
