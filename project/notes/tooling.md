# Tooling Notes

## Vite+

Use Vite+ as the primary command surface.

- `vp install` installs dependencies.
- `vp install <package>` adds a dependency.
- `vp install --dev <package>` adds a dev dependency.
- `vp check` runs formatting, linting, and type checks.
- `vp test` runs tests.
- `vp pack` builds the package.

`pnpm` remains the underlying package manager and owns `pnpm-lock.yaml`. Use `pnpm` directly only when `vp` does not cover a package-manager-specific task.

## pnpm

The repo is pinned to `pnpm@11.6.0`.

pnpm 11's supply-chain policy rejected a same-day `@typescript/native-preview` build, so the package is pinned to `7.0.0-dev.20260509.2`.

## Local Preview

Ladle is the preferred local interactive preview tool for now.

Storybook is a strong alternative if the story environment needs to become public documentation or addon-heavy component docs. Histoire is not the preferred React choice at this stage.

## Release Workflow

No release workflow has been chosen yet. `bumpp` was removed from the scaffold; release tooling should be selected later.
