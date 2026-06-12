import type { Engine } from "@virtuoso.dev/reactive-engine-core";
import type { ComponentType } from "react";

export interface MessageComposerFeatureContext {
  engine: Engine;
}

export interface MessageComposerSlots {
  header?: ComponentType;
  toolbar?: ComponentType;
  footer?: ComponentType;
}

export interface MessageComposerFeature {
  id: string;
  /** One-time setup at engine creation; a returned cleanup runs on engine disposal. */
  init?: (context: MessageComposerFeatureContext) => void | (() => void);
  /** React components mounted inside the Lexical composer context. */
  lexicalPlugins?: ComponentType[];
  /** Default UI for named slots; host `slots` override these per key. */
  slots?: Partial<MessageComposerSlots>;
}

/**
 * Later features win between themselves; host slots win over features. A host
 * key explicitly set to undefined removes the feature-provided slot, which is
 * how custom UI replaces first-party UI without forking the feature.
 */
export function resolveSlots(
  features: readonly MessageComposerFeature[],
  hostSlots: Partial<MessageComposerSlots> | undefined
): MessageComposerSlots {
  const merged: MessageComposerSlots = {};
  for (const feature of features) {
    Object.assign(merged, feature.slots);
  }
  return { ...merged, ...hostSlots };
}
