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

Use `vp run dev:stories` to start the local story preview.

Storybook is a strong alternative if the story environment needs to become public documentation or addon-heavy component docs. Histoire is not the preferred React choice at this stage.

## Release Workflow

Releases use `semantic-release` from `.github/workflows/release.yml`.

- Merge or squash commits to `main` with Conventional Commit titles.
- `fix:` creates patch releases, `feat:` creates minor releases, and `feat!:` or a `BREAKING CHANGE:` footer creates major releases.
- The workflow runs `vp check`, `vp test`, and `vp pack` before publishing.
- Npm publishing uses trusted publishing/OIDC and package provenance.

The npm package settings trust GitHub Actions for repository `mdx-editor/message-composer` and workflow filename `release.yml`. Do not configure an `NPM_TOKEN` repository secret; publishing should use trusted publishing only.

The initial `1.0.0` npm package was bootstrapped manually from the existing `v1.0.0` git tag on 2026-06-15 because npm rejected first package creation through both trusted publishing and granular-token bootstrap flows. The package now exists as public npm package `@mdxeditor/message-composer`, with `latest` pointing at `1.0.0`.

`@semantic-release/npm` is configured with `npmPublish: false` so it still writes the computed package version but does not run its `npm whoami` auth verifier. The actual publish command runs through `@semantic-release/exec`, using npm trusted publishing/OIDC.

If a release creates a git tag but fails before npm publish, delete the failed tag before rerunning semantic-release. Otherwise semantic-release will treat that version as already released.
