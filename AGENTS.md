# Project Instructions

- Use `vp` as the primary command surface in this repository whenever possible.
- Use `pnpm` only when a task is not covered by `vp` or when direct package-manager behavior is required. `pnpm` remains the underlying package manager and lockfile owner.
- Store internal project memory under `project/`, not `docs/`. Future `docs/` content is reserved for user-facing documentation.
- Store exploratory notes in `project/notes/`, implementation plans in `project/plans/`, and durable decisions in `project/decisions/`.
- PRP workflow local override: create and look for PRPs and implementation plans in `project/plans/`, not in a top-level `plans/` directory.
- When creating pull requests, do not prefix PR titles with `[codex]`.
- Unless asked to, always open pull requests as ready to review, not draft.
