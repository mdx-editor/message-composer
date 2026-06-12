import type { Engine } from "@virtuoso.dev/reactive-engine-core";
import type { Klass, LexicalNode } from "lexical";
import type { ComponentType } from "react";

export interface MessageComposerPluginContext {
  engine: Engine;
}

export interface MessageComposerSlots {
  header?: ComponentType;
  toolbar?: ComponentType;
  footer?: ComponentType;
}

export interface MessageComposerPlugin {
  id: string;
  /** One-time setup at engine creation; a returned cleanup runs on engine disposal. */
  init?: (context: MessageComposerPluginContext) => void | (() => void);
  /** React components mounted inside the Lexical composer context. */
  lexicalPlugins?: ComponentType[];
  /** Custom node classes registered with the editor at creation time. */
  lexicalNodes?: Klass<LexicalNode>[];
  /** Default UI for named slots; host `slots` override these per key. */
  slots?: Partial<MessageComposerSlots>;
}

/**
 * Later plugins win between themselves; host slots win over plugins. A host
 * key explicitly set to undefined removes the plugin-provided slot, which is
 * how custom UI replaces first-party UI without forking the plugin.
 */
export function resolveSlots(
  plugins: readonly MessageComposerPlugin[],
  hostSlots: Partial<MessageComposerSlots> | undefined
): MessageComposerSlots {
  const merged: MessageComposerSlots = {};
  for (const plugin of plugins) {
    Object.assign(merged, plugin.slots);
  }
  return { ...merged, ...hostSlots };
}
