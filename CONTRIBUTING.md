# Contributing

## Tooling

This project uses Vite+ as the primary development command surface. Prefer `vp` commands for everyday work:

- `vp install` installs dependencies.
- `vp install <package>` adds a dependency.
- `vp install --dev <package>` adds a dev dependency.
- `vp check` runs formatting, linting, and type checks.
- `vp test` runs tests.
- `vp pack` builds the package for publishing.
- `vp pack --watch` builds the package in watch mode.
- `vp run dev:stories` starts the Ladle story preview.
- `vp run build:stories` builds the Ladle story preview.

`pnpm` is still the underlying package manager and owns `pnpm-lock.yaml`. Use `pnpm` directly only when `vp` does not cover the task or when debugging package-manager behavior.

## Pull Requests

- Do not prefix pull request titles with `[codex]`.
- Unless asked otherwise, open pull requests as ready to review, not draft.
