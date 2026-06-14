---
name: message-composer-maintainer
description: Use when modifying the @mdxeditor/message-composer repository, including plugins, registry components, docs, Ladle stories, reactive-engine nodes, Lexical behavior, markdown visitors, browser tests, skills, release infrastructure, or public package metadata.
---

# Message Composer Maintainer

Use this skill for repository maintenance and implementation work inside `mdx-editor/message-composer`.

## Start Here

1. Read `AGENTS.md`.
2. Read `project/plans/message-composer-implementation-plan.md`.
3. Read any ADR that owns the behavior being changed.
4. Use `vp` as the primary command surface.

## Repository Boundaries

- Keep internal project memory under `project/`.
- Keep public docs under `docs/`.
- Keep behavior plugins under `src/plugins/*`.
- Keep first-party registry UI under `registry/*`.
- Keep optional plugin behavior out of the package root; export it through package subpaths such as `@mdxeditor/message-composer/plugins/formatting`.
- Keep registry UI out of the core npm package imports.

## Architecture Rules

- Use reactive-engine nodes at module scope for shared plugin state and commands.
- Use one engine per composer instance through `EngineProvider`.
- Keep React components projection-oriented: read cells, publish streams, and delegate semantics to engine or Lexical behavior.
- Use Lexical for document model, selection, history, commands, custom nodes, paste normalization, and markdown typing shortcuts.
- Use the mdast visitor pipeline for value import/export; do not conflate typing shortcuts with serialization.

## References

Read only the reference needed for the task:

- `references/architecture.md`: package layers, plugin boundaries, registry distribution, and API ownership.
- `references/testing.md`: expected unit, engine, browser, and story coverage.
- `references/release-checklist.md`: release-readiness checks for docs, demos, registry, skills, and package metadata.

## Validation

Use the narrowest meaningful validation during development, then run the full gate before handoff:

```sh
vp check
vp test
vp run build:stories
vp run build:registry
```

For skills, also run:

```sh
python3 /Users/petyo/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/message-composer-integrator
python3 /Users/petyo/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/message-composer-maintainer
```
