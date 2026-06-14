# Docs And Skills Distribution PRP

Status: implemented locally — public install smoke tests pending (2026-06-14)

## Goal

Ship a small but useful public documentation set under `docs/` for GitHub UI consumption, and add installable agent skills under `skills/` so people can use `skills.sh` to teach Codex-like agents how to integrate and extend `@mdxeditor/message-composer`.

This is a release-readiness track. It should make the current v1.0 surface easier to understand without pulling deferred v1.1 work, such as audio capture or emoji picker, into scope.

## Context

- Internal project memory stays under `project/`. Public user-facing documentation belongs under `docs/`.
- The GitHub org is `mdx-editor`; the npm package scope remains `@mdxeditor/message-composer`.
- Assume the source repository is public before this docs/skills PRP ships. shadcn GitHub-address installs such as `mdx-editor/message-composer/message-composer-kit` and skills.sh repository installs should be documented and smoke-tested as first-class public install paths.
- Registry distribution is implemented as stage 11. The root `registry.json` is the source catalog, and `vp run build:registry` emits shadcn item JSON to `build/r`. The Pages workflow publishes those files at `https://mdx-editor.github.io/message-composer/r/<item>.json`; docs can mention those URLs as the generated JSON artifacts, but GitHub-address installs should be the primary user-facing shadcn commands once the repository is public.
- `skills.sh` discovers skills from repository `skills/<skill-name>/SKILL.md` files. A root `skills.sh.json` can improve repository presentation and grouping on skills.sh, but CLI installation should rely on the normal skills directory layout.
- Skill folders should stay lean: `SKILL.md` plus optional `references/`, `scripts/`, `assets/`, and `agents/openai.yaml` when useful. Do not add README-style auxiliary docs inside skill folders.

## Scope

### Public Docs

Create a minimal docs tree that works well in GitHub's file browser:

```text
docs/
  README.md
  getting-started.md
  concepts.md
  value-and-submit-semantics.md
  plugins/
    README.md
    formatting.md
    agent-settings.md
    mentions.md
    attachments.md
    links.md
    slash-commands.md
  registry-ui.md
  testing-and-stories.md
```

Initial docs should prioritize copy-pasteable usage, stable semantics, and links to live demos. They do not need website navigation, custom styling, or generated API references.

### Installable Skills

Add two skills under `skills/`:

```text
skills/
  message-composer-integrator/
    SKILL.md
    agents/openai.yaml
    references/
      plugin-recipes.md
      value-shape.md
      registry-ui.md
  message-composer-maintainer/
    SKILL.md
    agents/openai.yaml
    references/
      architecture.md
      testing.md
      release-checklist.md
skills.sh.json
```

`message-composer-integrator` is for agents working in downstream apps. It should cover installation, rendering the composer, controlled/uncontrolled value handling, plugin selection, context chips, attachments, mentions, and first-party registry UI once available.

`message-composer-maintainer` is for agents modifying this repository. It should cover the local PRP workflow, `vp` command surface, reactive-engine conventions, plugin subpath exports, Lexical/mdast boundaries, Ladle story requirements, and browser-test expectations.

## Non-goals

- Do not create a dedicated documentation website.
- Do not add MDX, VitePress, Docusaurus, or static-site tooling.
- Do not publish the npm package as part of this PRP.
- Do not implement new registry UI components beyond documenting and validating the current stage 11 registry surface.
- Do not implement audio capture, emoji picker, large-text paste conversion, or new composer behavior.
- Do not change the npm package scope unless explicitly requested.

## Proposed Content

### `docs/README.md`

- What the package is.
- Current maturity and demo links.
- Install command.
- Small uncontrolled composer example.
- Links to the main concept docs and plugin docs.

### `docs/getting-started.md`

- Install package and peer dependencies.
- Import `MessageComposer`.
- Add one plugin at a time.
- Handle `onSubmit`.
- Link to Ladle demos.

### `docs/concepts.md`

- Core package versus optional plugin behavior versus first-party registry UI.
- Markdown as authored prose.
- Sidecars for attachments, mentions, agent settings, and context chips.
- Controlled versus uncontrolled usage at a high level.

### `docs/value-and-submit-semantics.md`

- `MessageComposerValue` shape.
- Strict-controlled echo behavior.
- Submit does not clear the draft.
- Promise-returning `onSubmit` lifecycle.
- Sidecar metadata preservation expectations.

### Plugin Docs

Each plugin doc should include:

- Purpose.
- Import path.
- Minimal setup.
- Value shape impact.
- Headless API surface.
- Registry UI status.
- One story/demo link.
- Known constraints or deferred behavior.

### `docs/registry-ui.md`

- Explain the shadcn/Base UI layer.
- Document that registry components are optional and live outside the npm package core.
- Document GitHub-address shadcn install commands as the primary public path, including the full kit and individual items:
  - `message-composer-kit`
  - `message-composer`
  - `formatting-toolbar`
  - `model-effort-picker`
  - `attachments-ui`
  - `mentions-ui`
  - `slash-command-shelf`
- Mention the Pages-hosted `https://mdx-editor.github.io/message-composer/r/<item>.json` URLs as generated registry artifacts and fallback direct JSON installs.
- Link to ADR 0002, ADR 0014, ADR 0015, root `registry.json`, and the main implementation plan stage 11.

### `docs/testing-and-stories.md`

- Explain Ladle as the demo and test fixture surface.
- Explain when Vitest Browser Mode is expected.
- Link to the deployed demo gallery.
- Mention `vp check`, `vp test`, and `vp run build:stories`.

## Skill Design

### `message-composer-integrator`

Trigger description:

> Use when integrating `@mdxeditor/message-composer` into a React chat or AI-agent app, choosing plugins, wiring controlled/uncontrolled values, handling attachments, mentions, slash commands, context chips, agent settings, or installing first-party registry UI.

Body contents:

- Start by identifying whether the host wants headless behavior, first-party UI, or custom UI.
- Prefer the smallest plugin set required by the app.
- Preserve `value.extensions` when controlling the composer.
- Keep markdown as user-authored prose; structured context belongs in sidecars.
- Load reference files only for the plugin or value area being implemented.

References:

- `plugin-recipes.md`: one-page recipes for formatting, agent settings, mentions, attachments, links, slash commands, and context chips.
- `value-shape.md`: canonical value examples and controlled-mode gotchas.
- `registry-ui.md`: GitHub-address shadcn install commands, Pages-hosted JSON fallback URLs, item split, dependency expectations, and public-repository assumptions.

### `message-composer-maintainer`

Trigger description:

> Use when changing this repository's `@mdxeditor/message-composer` implementation, adding or modifying plugins, registry components, docs, Ladle stories, reactive-engine nodes, Lexical behavior, markdown visitors, browser tests, or release infrastructure.

Body contents:

- Read `AGENTS.md`, the active implementation plan, and relevant ADRs before changing architecture.
- Use `vp` first.
- Keep plugin behavior under `src/plugins/*` and first-party UI under `registry/*`.
- Add engine tests for plugin state and browser tests for focus/selection/UI workflows.
- Do not move public docs into `project/`.

References:

- `architecture.md`: package layers, plugin boundaries, mdast/Lexical split, and subpath exports.
- `testing.md`: engine/browser/story validation expectations.
- `release-checklist.md`: docs, demos, GitHub-address registry smoke tests, Pages-hosted registry JSON, skills.sh install checks, package metadata, and CI checks.

## Proposed Repository Metadata

Add `skills.sh.json` at the repository root with minimal presentation metadata and categories for the two skills. Keep it factual and avoid duplicating the skill bodies.

Include a short README section:

````md
## Agent Skills

This repository includes installable skills for agents that need to integrate or maintain the composer.

Install them with skills.sh:

```sh
npx skills add mdx-editor/message-composer
```
````

If skills.sh supports per-skill install syntax for repository subdirectories, document that only after confirming the exact command.

## Implementation Steps

1. Audit current public API, package exports, registry components, stories, and ADRs so docs describe the current implementation rather than the intended future state.
2. Create the `docs/` tree with a concise landing page, getting-started guide, concept docs, plugin docs, registry UI install page, and testing/stories page.
3. Link the README to `docs/README.md`, the deployed Ladle demos, the GitHub-address shadcn registry install commands, the Pages JSON fallback URLs, and the skills install instructions.
4. Initialize `skills/message-composer-integrator` and `skills/message-composer-maintainer` using the Skill Creator workflow; include `agents/openai.yaml` for discoverable UI metadata.
5. Write the skill bodies and references with progressive disclosure: keep `SKILL.md` short and move examples/details into `references/`.
6. Add `skills.sh.json` with repository-level presentation metadata.
7. Validate docs links, skill frontmatter, package metadata, registry metadata, and the existing TypeScript/test surface.
8. After the repository is public, smoke-test `npx skills add mdx-editor/message-composer` from a clean temporary directory.
9. Smoke-test shadcn GitHub-address installs for the full kit and at least one individual item after the repository is public. README and registry docs already prefer `mdx-editor/message-composer/<item>` commands per ADR 0015 while preserving Pages JSON URLs as direct fallback installs. If public smoke tests expose an issue with the GitHub-address internal dependency graph, update `registry.json` and ADR 0015 accordingly.

## Validation

Required:

- `vp check`
- `vp test`
- `vp run build:stories`
- `vp run build:registry`
- Skill validation with the Skill Creator `quick_validate.py` script for every `skills/*/SKILL.md`
- `rg -n "mdxeditor\\.github\\.io|github\\.com[:/]mdxeditor" docs skills README.md package.json .ladle registry.json skills.sh.json` should return no results. The package name `@mdxeditor/message-composer` is allowed; GitHub URLs should use `mdx-editor`.

Recommended:

- Link check for relative docs links.
- Install smoke test with the skills.sh CLI from a clean temporary directory.
- A short browser pass over the deployed or local Ladle gallery to make sure docs links point to existing stories.
- Registry install smoke with `npx shadcn@latest add mdx-editor/message-composer/message-composer-kit` after the repository is public.
- Registry install smoke against the Pages-hosted JSON URLs after Pages publishes the current `build/r` output.

## Risks And Mitigations

- Docs can drift from the generated registry item names or URLs. Mitigate by deriving docs from `registry.json`, README install commands, and stage 11/ADR 0015 instead of hand-writing unverified registry paths.
- Skills can become too large and expensive to load. Mitigate by keeping `SKILL.md` procedural and moving plugin recipes/value examples into references.
- The npm scope and GitHub org are easy to confuse. Mitigate with a validation grep and a docs note: npm package is `@mdxeditor/message-composer`; GitHub org is `mdx-editor`.
- Downstream users may assume context chips are markdown. Mitigate by repeating that chips are sidecar metadata in docs, skill references, and examples.
- GitHub-address shadcn installs may behave differently than direct Pages JSON installs. Mitigate by smoke-testing both after the repository is public and updating `registry.json`/ADR 0015 if the canonical dependency form should change.

## Open Questions

- Should the first public run include both skills, or should `message-composer-maintainer` wait until the API is more stable?
- Should docs include a complete generated API reference, or is hand-written API documentation enough for the first release?
- Should skills.sh installation examples name the whole repo only, or also document per-skill installation if supported by the CLI after verification?
- Do we want a docs link checker in CI now, or wait until a larger docs surface exists?
