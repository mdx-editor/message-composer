# Optional Features And Registry UI

Status: accepted
Date: 2026-06-12

## Context

The composer will grow feature UI such as a formatting toolbar, mention autocomplete, file attachment controls, slash-command menus, dialogs, and model/effort pickers. These features need polished first-party UI, but the public OSS component should not force consumers to adopt Tailwind, shadcn/ui, Base UI, or any specific design system.

The shadcn GitHub registry can use a public GitHub repository as the registry source. A root `registry.json` declares installable items, and users can install those items through the `shadcn` CLI. Registry items can include feature kits, component files, utilities, styles, templates, docs, and registry dependencies.

Reference: https://ui.shadcn.com/docs/registry/github

## Decision

Every non-core composer capability should be modeled as an optional feature.

Examples include:

- formatting toolbar
- model and effort picker
- mention autocomplete and mention token rendering
- attachment picker, preview, retry, and remove controls
- slash-command menu
- link editor
- audio recording controls

The package core should own feature semantics, state wiring, value integration, accessibility contracts, and commands. It should not require a particular visual implementation.

First-party UI for these features should be implemented as shadcn/Base UI components and distributed through the shadcn GitHub registry. Registry components are one supported presentation layer over the core APIs, not the only way to use the composer.

The core npm package must not import or require first-party registry UI components. Consumers who want the default polished UI can install registry items. Consumers who do not want Tailwind, shadcn/ui, or Base UI can build their own UI against the same feature contracts, slots, and reactive control API.

Registry items should be split so features can be installed independently where possible. Shared utilities or styling primitives can be separate registry items and referenced with registry dependencies.

## Consequences

Feature implementation should start from behavior contracts and state shape, then add the first-party registry UI around those contracts.

Public APIs must avoid assuming that a feature has a bundled React component. Slots and reactive controls need to be stable enough for custom UI.

Examples and development stories can use the first-party shadcn/Base UI components, but tests for core behavior should not depend on them.

Release planning will need a registry layout, root `registry.json`, validation command, and documented installation paths for each first-party feature UI item.
