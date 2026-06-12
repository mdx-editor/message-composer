# Project Instructions

- Use `vp` as the primary command surface in this repository whenever possible.
- Use `pnpm` only when a task is not covered by `vp` or when direct package-manager behavior is required. `pnpm` remains the underlying package manager and lockfile owner.
- Store internal project memory under `project/`, not `docs/`. Future `docs/` content is reserved for user-facing documentation.
- Store exploratory notes in `project/notes/`, implementation plans in `project/plans/`, and durable decisions in `project/decisions/`.
- PRP workflow local override: create and look for PRPs and implementation plans in `project/plans/`, not in a top-level `plans/` directory.
- Implement composer features as optional core behavior first, with shadcn/Base UI as a separate first-party registry UI layer.
- Add engine tests for feature state, streams, reducers, initialization, and submitted value behavior.
- Use Vitest Browser Mode for browser tests of user-facing workflows that depend on selection, focus, keyboard navigation, paste, drag/drop, popovers, dialogs, or browser events.
- Keep Ladle stories structured as reusable scenario fixtures, and use first-party shadcn/Base UI components for main interactive stories once those components exist.
- When creating pull requests, do not prefix PR titles with `[codex]`.
- Unless asked to, always open pull requests as ready to review, not draft.
