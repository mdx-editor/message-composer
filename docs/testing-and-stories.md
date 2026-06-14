# Testing And Stories

This repository uses Ladle stories as both manual demos and browser-test fixtures.

Run stories locally:

```sh
vp run dev:stories
```

Build stories:

```sh
vp run build:stories
```

The deployed gallery is available at:

- https://mdx-editor.github.io/message-composer/

## Validation Commands

```sh
vp check
vp test
vp run build:stories
vp run build:registry
```

Use Vitest Browser Mode for workflows that depend on focus, selection, keyboard navigation, paste, drag/drop, popovers, dialogs, or real browser events.

Core behavior tests should not depend on registry UI. Registry UI should have stories that prove default UI and custom UI can coexist over the same plugin behavior.
