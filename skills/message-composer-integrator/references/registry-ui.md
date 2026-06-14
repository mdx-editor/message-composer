# Registry UI

Use this reference when installing or wiring first-party UI.

The core package is headless. Registry UI is shadcn/Base UI source copied into the host application.

## Install Full Kit

```sh
npx shadcn@latest add mdx-editor/message-composer/message-composer-kit
```

## Install Individual Items

```sh
npx shadcn@latest add mdx-editor/message-composer/message-composer
npx shadcn@latest add mdx-editor/message-composer/formatting-toolbar
npx shadcn@latest add mdx-editor/message-composer/model-effort-picker
npx shadcn@latest add mdx-editor/message-composer/attachments-ui
npx shadcn@latest add mdx-editor/message-composer/mentions-ui
npx shadcn@latest add mdx-editor/message-composer/slash-command-shelf
```

## Direct JSON Fallback

Generated registry JSON is also published with the demo site:

```text
https://mdx-editor.github.io/message-composer/r/<item>.json
```

## Wiring Pattern

Install behavior plugins from npm package subpaths, then pass registry UI components through plugin config or slots as appropriate. Registry components are optional; custom UI can read the same cells and publish the same streams.
