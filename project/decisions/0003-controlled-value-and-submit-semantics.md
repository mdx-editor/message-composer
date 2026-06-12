# Controlled Value And Submit Semantics

Status: accepted
Date: 2026-06-12

## Context

`MessageComposerProps` exposes `value`, `defaultValue`, `onValueChange`, and `onSubmit`. Editor-backed components often weaken the controlled contract ("loose-controlled": the prop seeds state and external changes apply, but internal edits persist without a host echo) to avoid reconciliation hazards with selection, IME composition, and history.

The composer needs a definitive contract before stage 1 hardens the public API, because every later feature (mentions, attachments, agent settings, audio) serializes into the same draft value and inherits these semantics.

## Decision

When `value` is provided, the composer is strict-controlled, matching React's native input contract:

- Rendered editor state always derives from `value`.
- Edits surface through `onValueChange` but do not commit locally. A host that does not echo the value back sees the input revert.
- The reconciler must no-op when the incoming `value` equals the last emitted value, so the echo round-trip preserves selection, IME composition, and undo history.

`defaultValue` selects uncontrolled mode with internal draft state. Switching between controlled and uncontrolled during a component lifetime is unsupported and should warn, like React inputs.

Submit never clears the draft:

- `onSubmit` receives the current value and only emits it.
- Hosts clear explicitly: controlled hosts by setting an empty `value`, uncontrolled hosts through the exported reset command.
- If `onSubmit` returns a promise, the submitting lifecycle state tracks it; rejection sets error state and leaves the draft untouched.

## Consequences

The Lexical bridge carries the main implementation burden: echo reconciliation must be cheap (value equality check before any editor update) and must not destroy selection or composition state on the matching round-trip.

Controlled-mode tests must cover a non-echoing host (input reverts), an echoing host (input persists, selection survives), and a transforming host (echoed value differs from emitted value and wins).

The common chat pattern (clear after send) is host code by design. Registry UI and stories should demonstrate it rather than the core implying it.
