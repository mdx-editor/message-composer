# Public Repository Registry Install Paths

Status: accepted
Date: 2026-06-14

## Context

ADR 0014 chose Pages-hosted shadcn JSON URLs because the source repository was private. The release plan now assumes `mdx-editor/message-composer` will be public before docs, skills, and registry install instructions ship.

shadcn supports public GitHub repositories as registries via `owner/repo/item` addresses. Its registry-item docs also require same-repository registry dependencies to use the full GitHub item address instead of bare item names.

## Decision

**Use GitHub-address shadcn installs as the primary public path.** README and docs should prefer commands such as:

```sh
npx shadcn@latest add mdx-editor/message-composer/message-composer-kit
```

**Use GitHub item addresses for internal registry dependencies.** Root `registry.json` should reference sibling items as `mdx-editor/message-composer/<item>`.

**Keep Pages-hosted JSON as a fallback artifact.** The Pages workflow still runs `vp run build:registry`, and direct JSON URLs under `https://mdx-editor.github.io/message-composer/r/<item>.json` remain valid fallback installs after deployment.

**Smoke-test after public visibility changes.** Because GitHub-address installs cannot be fully validated while the repository is private, run a fresh shadcn install smoke after making the repository public.

## Consequences

The public docs and skills can teach the canonical shadcn GitHub registry flow.

ADR 0014 remains useful historical context for the private-repo phase, but ADR 0015 owns public install documentation and registry dependency addresses.
