# Use Semantic Release With Npm Provenance

## Status

Accepted.

## Context

The repository publishes a single public npm package, `@mdxeditor/message-composer`, and already uses Vite+ as the primary local command surface for checks, tests, and package builds.

## Decision

Use `semantic-release` from GitHub Actions on `main` to determine package versions from Conventional Commit messages, create git tags and GitHub releases, and publish to npm.

The first automated release starts at `1.0.0`. Vite+ remains responsible for verification and packaging through `vp check`, `vp test`, and `vp pack`.

Npm publishing uses trusted publishing/OIDC through the release workflow, with package provenance enabled in `package.json`.

## Consequences

Release-affecting PR merge or squash titles must use Conventional Commit types such as `fix:`, `feat:`, and `feat!:`. Non-release changes can use non-release types such as `docs:`, `test:`, `refactor:`, `chore:`, or `ci:`.

GitHub Releases are the generated changelog. The repository does not commit release changelog/version bumps back to `main`.

The npm package must have a trusted publisher configured for GitHub Actions before tokenless OIDC publishing can succeed. Because npm trusted publisher settings are configured on an npm package, the first `1.0.0` publish may need a temporary granular `NPM_TOKEN` secret if npm does not allow the trusted publisher to be configured before the package exists. Revoke that token once trusted publishing is configured.
