# Testing

Use this reference when adding behavior or changing UI.

## Commands

```sh
vp check
vp test
vp run build:stories
vp run build:registry
```

## Engine Tests

Add pure engine tests for plugins that add reactive-engine nodes, streams, reducers, initialization, async lifecycle, or submitted value behavior.

Cover:

- Initial state.
- Plugin initialization.
- Commands and reducers.
- Controlled prop seeding where relevant.
- Multiple engine instance independence.
- Cleanup for async providers, uploads, timers, or subscriptions.
- Submitted `MessageComposerValue` shape.

## Browser Tests

Use Vitest Browser Mode for DOM workflows involving:

- Selection and focus.
- Keyboard navigation.
- Paste and drag/drop.
- Popovers, dialogs, or menus.
- File picker interactions.
- Toolbar and command shelf behavior.

Prefer Ladle stories as browser-test fixtures.

## Stories

Stories should be reusable scenario fixtures. Each plugin should show:

- Default first-party registry UI.
- Custom UI over the same behavior.
- Loading, empty, error, disabled, and edge states where relevant.
- Submitted value inspection.
