# Formatting Toolbar Registry Component And Toolbar UI Placement

Status: accepted
Date: 2026-06-12

## Context

Stage 4 shipped formatting behavior (`formattingState$`, `formatText$`, `toggleBlock$`, `toggleLink$`) but left the first-party toolbar for "once the registry component exists"; the formatting stories used a minimal unstyled toolbar in the meantime. The plan also carried an open question: should the core package include a minimal unstyled toolbar example, or does all toolbar UI live in registry items?

## Decision

**Toolbar UI is registry-only.** The core package ships no toolbar component, styled or unstyled. The structural contract a toolbar needs is already public — the formatting cells/commands and the `toolbar` slot — and an unstyled example would become a second first-party UI surface to maintain and version. The unstyled toolbar survives as the custom-UI story fixture, which the story requirements demand anyway as proof that the contracts suffice without registry components.

**Composition.** `FormattingToolbar` composes current `@base-ui/react` `Toolbar.Root`/`Toolbar.Button` (roving tabindex, arrow-key navigation) with `Toggle` rendered through the `render` prop, so every control gets `aria-pressed` and `data-pressed` for free while staying a single toolbar tab stop. Buttons are icon-only with stable `aria-label`s. `visibleControls` selects a compact subset while retaining canonical keyboard order.

**Selection preservation.** The toolbar root prevents `mousedown` default, so clicking a control never moves focus out of the editor and format commands apply to the live selection — the same pattern the unstyled story toolbar established. Keyboard access is unaffected: focus can still enter the toolbar by Tab, and Lexical restores the editor selection when focus returns.

**Link editing.** The toolbar includes the Base UI popover link editor delivered in stage 8. The link control participates in the same focus-preservation and `visibleControls` contracts as other controls.

## Consequences

Hosts that want a different toolbar write their own component against the same cells and commands; nothing in the registry component is privileged.

Registry installation uses one Base UI generation. No registry source or manifest depends on the deprecated `@base-ui-components/react` package.

The registry component asserts its contract through the existing formatting browser tests plus new ones for focus preservation and arrow-key navigation.
