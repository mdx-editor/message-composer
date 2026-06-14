# First-Party Registry UI

The core package is headless. First-party UI is distributed as shadcn/Base UI registry items that install source files into the host app.

Install the full current kit:

```sh
npx shadcn@latest add mdx-editor/message-composer/message-composer-kit
```

Install individual items:

| UI item             | Command                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| Composer shell      | `npx shadcn@latest add mdx-editor/message-composer/message-composer`    |
| Formatting toolbar  | `npx shadcn@latest add mdx-editor/message-composer/formatting-toolbar`  |
| Model/effort picker | `npx shadcn@latest add mdx-editor/message-composer/model-effort-picker` |
| Attachments UI      | `npx shadcn@latest add mdx-editor/message-composer/attachments-ui`      |
| Mentions UI         | `npx shadcn@latest add mdx-editor/message-composer/mentions-ui`         |
| Slash command shelf | `npx shadcn@latest add mdx-editor/message-composer/slash-command-shelf` |

The Pages deployment also publishes generated item JSON under:

```text
https://mdx-editor.github.io/message-composer/r/<item>.json
```

Use those URLs as direct JSON fallback installs when needed.

## Local Validation

```sh
vp run build:registry
```

The registry source is [`../registry.json`](../registry.json). Registry component source lives under [`../registry`](../registry).

Related decisions:

- [ADR 0002: Optional Plugins And Registry UI](../project/decisions/0002-optional-features-and-registry-ui.md)
- [ADR 0014: Registry Distribution Through Pages JSON](../project/decisions/0014-registry-distribution-through-pages-json.md)
- [ADR 0015: Public Repository Registry Install Paths](../project/decisions/0015-public-repository-registry-install-paths.md)

Stage 11 in the [implementation plan](../project/plans/message-composer-implementation-plan.md) tracks the registry distribution work.
