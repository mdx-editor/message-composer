# Registry Distribution Through Pages JSON

Status: superseded by ADR 0015 for public install documentation
Date: 2026-06-14

## Context

Stage 11 formalizes first-party shadcn/Base UI registry distribution. The official shadcn GitHub registry flow supports installing items from `owner/repo/item`, but that requires the GitHub repository to be public. The current `mdx-editor/message-composer` repository is private, while the demo site is already deployed to GitHub Pages.

Open points: whether to document GitHub-address installs immediately, how registry item dependencies should point at each other, and how to validate registry payloads before the repository is public.

## Decision

**Registry source stays in the repository root.** The root `registry.json` is the source catalog for all first-party UI registry items.

**Install commands use Pages-hosted item JSON.** The Pages workflow runs `vp run build:registry`, which emits shadcn item JSON under `build/r`. README install commands point at `https://mdx-editor.github.io/message-composer/r/<item>.json`, not `mdx-editor/message-composer/<item>`, so users are not blocked by repository visibility.

**Internal registry dependencies use Pages URLs.** Registry items that depend on shared utilities or preset dependencies reference the generated Pages JSON URLs. This keeps recursive dependency resolution working from the public registry host.

**GitHub-address installs can be added later.** If the repository becomes public, `owner/repo/item` installs can be documented as an alternate path after a smoke test confirms shadcn can resolve the repository anonymously.

## Consequences

The registry is immediately compatible with a private source repository as long as GitHub Pages publishes `build/r`.

Fresh local smoke tests need a local mirror of the generated JSON with dependency URLs rewritten to local file paths, or they must wait until the Pages deployment has published the current registry payload.

The public npm package scope remains `@mdxeditor/message-composer`; only GitHub/repository URLs use `mdx-editor`.
