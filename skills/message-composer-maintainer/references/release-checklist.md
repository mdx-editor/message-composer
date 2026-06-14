# Release Checklist

Use this reference before shipping repository-level changes.

## Package

- `package.json` has correct `homepage`, `repository`, and `bugs` URLs using GitHub org `mdx-editor`.
- Npm package scope remains `@mdxeditor/message-composer` unless explicitly changed.
- `vp pack` passes before npm publishing.

## Demos

- `vp run build:stories` passes.
- GitHub Pages workflow publishes the Ladle build.
- Demo links in README and docs point at `https://mdx-editor.github.io/message-composer/`.

## Registry

- `registry.json` includes every first-party UI item.
- `vp run build:registry` passes.
- The Pages workflow publishes `build/r`.
- Smoke-test `npx shadcn@latest add mdx-editor/message-composer/message-composer-kit` after the repository is public.
- Smoke-test a direct JSON fallback install from `https://mdx-editor.github.io/message-composer/r/message-composer-kit.json`.

## Skills

- `skills/*/SKILL.md` frontmatter is valid.
- `agents/openai.yaml` default prompts mention `$skill-name`.
- `python3 /Users/petyo/.codex/skills/.system/skill-creator/scripts/quick_validate.py <skill-dir>` passes for each skill.
- Smoke-test `npx skills add mdx-editor/message-composer` after the repository is public.

## Docs

- Public docs belong in `docs/`.
- Internal plans/notes/decisions stay under `project/`.
- Run the GitHub org typo grep:

```sh
rg -n "mdxeditor\\.github\\.io|github\\.com[:/]mdxeditor" docs skills README.md package.json .ladle registry.json skills.sh.json
```
