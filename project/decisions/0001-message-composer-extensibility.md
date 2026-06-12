# Message Composer Extensibility

Status: accepted
Date: 2026-06-12

## Context

The composer value is expected to grow beyond plain markdown. It should be able to represent attachments, mentions, agent-related settings, audio recordings, and feature-specific data. Optional features should be able to add both behavior and UI without forcing application code to rebuild core composer behavior from scratch.

One early example is an optional model/effort picker. When enabled, the user can select model-related agent settings from the UI, and those selections become part of the submitted value payload.

## Decision

The public value model should represent the full message draft payload, not only markdown.

```ts
export interface MessageComposerValue<
  TAgent extends object = MessageComposerAgentValue,
  TExtensions extends object = {},
> {
  markdown: string;
  attachments: MessageComposerAttachment[];
  mentions: MessageComposerMention[];
  audioClips: MessageComposerAudioClip[];
  agent?: TAgent;
  extensions?: TExtensions;
}
```

Agent settings that are common to AI composer use cases, such as `modelId` and `effort`, should be first-class optional value fields under `agent`. Rich metadata about available models belongs in feature configuration, not in the submitted value.

`MessageComposerProps` should not extend native `TextareaHTMLAttributes` directly. Native textarea `value`, `defaultValue`, and `onChange` conflict with the composer draft value API. Native passthrough props should live under a scoped property such as `textareaProps`.

```ts
export interface MessageComposerProps<TValue extends MessageComposerValue = MessageComposerValue> {
  value?: TValue;
  defaultValue?: TValue;
  onValueChange?: (value: TValue) => void;
  onSubmit?: (value: TValue) => void;
  features?: MessageComposerFeature[];
  slots?: MessageComposerSlots;
  textareaProps?: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "defaultValue" | "onChange">;
}
```

Extensibility should be split across:

- value extensions for data that must be submitted or externally controlled
- feature modules for optional behavior and internal state wiring
- slots/components for optional UI surface replacement or insertion
- exported reactive nodes for advanced external control

## Reactive Engine Direction

The composer should follow the reactive-engine component/library pattern:

- define the core node graph at module scope
- create one engine per composer instance through `EngineProvider`
- expose state cells and action streams as the advanced control API
- let optional features attach wiring to core nodes
- keep components projection-oriented: they read cells and publish actions
- keep feature state lazy, so unused features do not impose behavior or runtime cost

A model/effort picker should be implemented as a first feature proving this model. It should render into a named slot, publish agent-setting changes through feature actions, and update the shared `MessageComposerValue` through core graph wiring.

## Consequences

The placeholder textarea should evolve toward a controlled draft-value API before more UI is added. This avoids baking in a markdown-only contract that will become difficult to change once attachments, mentions, audio, and agent controls are introduced.
