# Message Composer

The message composer is a React component for user input in human/chat interfaces.

## Inspirations

- ChatGPT (desktop)
- Claude
- Codex
- Slack
- Discord

## Goal

- The component should be usable for both traditional chats and AI agent UI.
- Output should be markdown

## Features

## Documentation

Public docs live in [`docs/`](./docs/):

- [Getting started](./docs/getting-started.md)
- [Concepts](./docs/concepts.md)
- [Value and submit semantics](./docs/value-and-submit-semantics.md)
- [Plugins](./docs/plugins/README.md)
- [First-party registry UI](./docs/registry-ui.md)

## Development

This package uses Vite+ as the project-local toolchain.

- `vp install` installs dependencies.
- `vp check` runs formatting, linting, and type checks.
- `vp test` runs tests.
- `vp pack` builds the package for publishing.
- `vp pack --watch` builds the package in watch mode.
- `vp run dev:stories` starts the Ladle story preview.
- `vp run build:stories` builds the Ladle story preview.

`pnpm` remains the underlying package manager and lockfile owner. Use it directly only when `vp` does not cover the task.

## Demos

The interactive Ladle demos are deployed from `main` to GitHub Pages:

- https://mdx-editor.github.io/message-composer/

The Pages workflow builds the static demo gallery with `vp run build:stories` and publishes the generated `build/`
directory.

## First-Party Registry UI

The core package stays headless. The optional shadcn/Base UI components are built from this repository and published as shadcn registry JSON with the demo site.

Install the full current UI kit:

```sh
npx shadcn@latest add mdx-editor/message-composer/message-composer-kit
```

Install individual pieces:

| UI item             | Install command                                                         |
| ------------------- | ----------------------------------------------------------------------- |
| Composer shell      | `npx shadcn@latest add mdx-editor/message-composer/message-composer`    |
| Formatting toolbar  | `npx shadcn@latest add mdx-editor/message-composer/formatting-toolbar`  |
| Model/effort picker | `npx shadcn@latest add mdx-editor/message-composer/model-effort-picker` |
| Attachments UI      | `npx shadcn@latest add mdx-editor/message-composer/attachments-ui`      |
| Mentions UI         | `npx shadcn@latest add mdx-editor/message-composer/mentions-ui`         |
| Slash command shelf | `npx shadcn@latest add mdx-editor/message-composer/slash-command-shelf` |

The Pages deployment also publishes direct JSON fallback URLs under `https://mdx-editor.github.io/message-composer/r/`.

Local registry validation:

```sh
vp run build:registry
```

## Agent Skills

Install the repository skills with skills.sh:

```sh
npx skills add mdx-editor/message-composer
```

Included skills:

- `message-composer-integrator`
- `message-composer-maintainer`
