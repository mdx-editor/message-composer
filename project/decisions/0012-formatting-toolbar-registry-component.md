# Formatting Toolbar Registry Component And Toolbar UI Placement

Status: accepted
Date: 2026-06-12

## Context

Stage 4 shipped formatting behavior (`formattingState$`, `formatText$`, `toggleBlock$`, `toggleLink$`) but left the first-party toolbar for "once the registry component exists"; the formatting stories used a minimal unstyled toolbar in the meantime. The plan also carried an open question: should the core package include a minimal unstyled toolbar example, or does all toolbar UI live in registry items?

## Decision

**Toolbar UI is registry-only.** The core package ships no toolbar component, styled or unstyled. The structural contract a toolbar needs is already public — the formatting cells/commands and the `toolbar` slot — and an unstyled example would become a second first-party UI surface to maintain and version. The unstyled toolbar survives as the custom-UI story fixture, which the story requirements demand anyway as proof that the contracts suffice without registry components.

**Composition.** `FormattingToolbar` composes Base UI `Toolbar.Root`/`Toolbar.Button` (roving tabindex, arrow-key navigation) with Base UI `Toggle` rendered through the `render` prop, so every control gets `aria-pressed` and `data-pressed` for free while staying a single toolbar tab stop. Buttons are icon-only with `aria-label`s matching the names the existing browser tests already use, which transfers the stage 4 test suite from the unstyled story toolbar to the registry component unchanged.

**Selection preservation.** The toolbar root prevents `mousedown` default, so clicking a control never moves focus out of the editor and format commands apply to the live selection — the same pattern the unstyled story toolbar established. Keyboard access is unaffected: focus can still enter the toolbar by Tab, and Lexical restores the editor selection when focus returns.

**No Link control yet.** A link toggle needs URL input; that editing surface (popover/dialog over Base UI) is stage 8's deliverable. Shipping a `window.prompt` placeholder would bake in an interaction stage 8 immediately replaces. The first-party toolbar omits links until then; `toggleLink$` remains public and the custom-UI story demonstrates it.

## Consequences

Hosts that want a different toolbar write their own component against the same cells and commands; nothing in the registry component is privileged.

Stage 8 extends the registry toolbar (or ships a companion component) with the link editor; the separator-grouped layout leaves room for it.

The registry component asserts its contract through the existing formatting browser tests plus new ones for focus preservation and arrow-key navigation.
