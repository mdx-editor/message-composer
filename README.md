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
