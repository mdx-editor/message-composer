# Plugins

Optional plugins add behavior and public state without forcing a visual implementation.

Available plugin subpaths:

- [`@mdxeditor/message-composer/plugins/formatting`](./formatting.md)
- [`@mdxeditor/message-composer/plugins/agent-settings`](./agent-settings.md)
- [`@mdxeditor/message-composer/plugins/mentions`](./mentions.md)
- [`@mdxeditor/message-composer/plugins/attachments`](./attachments.md)
- [`@mdxeditor/message-composer/plugins/slash-commands`](./slash-commands.md)

Link editing and auto-linking currently live in the formatting plugin. Audio capture and emoji picker are deferred to v1.1.

Each plugin can be used with custom UI, first-party registry UI, or no UI where behavior is enough.
