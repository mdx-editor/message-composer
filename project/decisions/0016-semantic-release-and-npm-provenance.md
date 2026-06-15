# Use Semantic Release With Npm Provenance

## Status

Accepted.

## Context

The repository publishes a single public npm package, `@mdxeditor/message-composer`, and already uses Vite+ as the primary local command surface for checks, tests, and package builds.

## Decision

Use `semantic-release` from GitHub Actions on `main` to determine package versions from Conventional Commit messages, create git tags and GitHub releases, and publish to npm.

The first release starts at `1.0.0`. Vite+ remains responsible for verification and packaging through `vp check`, `vp test`, and `vp pack`.

Npm publishing uses trusted publishing/OIDC through the release workflow, with package provenance enabled in `package.json`.

`@semantic-release/npm` writes the computed package version but does not perform the final publish. The final `npm publish` command runs through `@semantic-release/exec` so publishing can use npm trusted publishing/OIDC without being blocked by `@semantic-release/npm`'s `npm whoami` auth verifier.

## Consequences

Release-affecting PR merge or squash titles must use Conventional Commit types such as `fix:`, `feat:`, and `feat!:`. Non-release changes can use non-release types such as `docs:`, `test:`, `refactor:`, `chore:`, or `ci:`.

GitHub Releases are the generated changelog. The repository does not commit release changelog/version bumps back to `main`.

The initial `1.0.0` package was manually published locally on 2026-06-15 from the `v1.0.0` git tag, without provenance, because npm rejected first package creation through the automated trusted-publishing flow and through granular-token bootstrap attempts.

Future npm publishes run from GitHub Actions with provenance through the npm trusted publisher configured for repository `mdx-editor/message-composer` and workflow filename `release.yml`. The release workflow does not support an `NPM_TOKEN` fallback, so publishing verifies the trusted-publishing path directly.
