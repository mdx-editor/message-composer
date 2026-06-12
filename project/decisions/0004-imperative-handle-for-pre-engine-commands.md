# Imperative Handle For Pre-Engine Commands

Status: accepted
Date: 2026-06-12

## Context

ADR 0003 requires an exported reset command so uncontrolled hosts can clear the draft, and stage 1 validation requires submit/reset tests — but the reactive-engine control surface (engine nodes, remote hooks, `engineRef`) only arrives in stage 2. Stage 1 needs a public command surface that does not preempt the engine API.

## Decision

`MessageComposer` is implemented with `forwardRef`, so the imperative handle works with both React 18 and React 19. The ref exposes a minimal `MessageComposerHandle`:

```ts
export interface MessageComposerHandle {
  focus(): void;
  reset(): void;
  submit(): void;
}
```

`reset()` clears the draft to `createEmptyMessageComposerValue()` — not back to `defaultValue` — because the dominant host use case is clearing after send. In controlled mode it only emits the cleared value through `onValueChange`; the host decides whether to adopt it, consistent with strict-controlled semantics.

The handle is intentionally limited to component-level commands that make sense regardless of the engine. When stage 2 lands, the handle methods become thin wrappers over engine command nodes; `engineRef` remains the advanced control surface.

## Consequences

Hosts get a stable, simple command API without learning the engine. The handle must not grow feature-specific methods — feature commands belong to feature nodes and slots, otherwise the handle becomes a parallel API that competes with the engine contract.
