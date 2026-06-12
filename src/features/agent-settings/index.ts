import { Cell, e, Stream } from "@virtuoso.dev/reactive-engine-core";

import type { MessageComposerFeature } from "../../core/feature.ts";
import { agent$, controlled$, draftValue$, editorChange$ } from "../../core/nodes.ts";
import type { MessageComposerAgentValue, MessageComposerValue } from "../../core/value.ts";

export { agent$ };

export interface MessageComposerModelOption {
  id: string;
  label: string;
}

export interface MessageComposerAgentSettingsConfig {
  models: MessageComposerModelOption[];
  efforts?: string[];
  defaultModelId?: string;
  defaultEffort?: string;
}

/** Rich option metadata stays in feature config; only ids travel in the value (ADR 0001). */
export const modelOptions$ = Cell<MessageComposerModelOption[]>([]);
export const effortOptions$ = Cell<string[]>([]);

export const selectModel$ = Stream<string>(false);
export const selectEffort$ = Stream<string>(false);

function updateAgent(draft: MessageComposerValue, patch: Partial<MessageComposerAgentValue>): MessageComposerValue {
  return { ...draft, agent: { ...draft.agent, ...patch } };
}

// Selections are draft edits: routing through editorChange$ gives them the same
// strict-controlled behavior as typing — committed when uncontrolled, emitted
// for the host to echo when controlled.
e.link(
  e.pipe(
    selectModel$,
    e.withLatestFrom(draftValue$),
    e.map(([modelId, draft]) => updateAgent(draft, { modelId }))
  ),
  editorChange$
);

e.link(
  e.pipe(
    selectEffort$,
    e.withLatestFrom(draftValue$),
    e.map(([effort, draft]) => updateAgent(draft, { effort }))
  ),
  editorChange$
);

export function agentSettingsFeature(config: MessageComposerAgentSettingsConfig): MessageComposerFeature {
  return {
    id: "agent-settings",
    init: ({ engine }) => {
      engine.pubIn({
        [modelOptions$]: config.models,
        [effortOptions$]: config.efforts ?? [],
      });
      const defaults: Partial<MessageComposerAgentValue> = {};
      if (config.defaultModelId !== undefined) {
        defaults.modelId = config.defaultModelId;
      }
      if (config.defaultEffort !== undefined) {
        defaults.effort = config.defaultEffort;
      }
      // Defaults seed the uncontrolled draft like defaultValue does: silently and
      // only where the draft does not already carry a value. Controlled hosts own
      // the agent value entirely.
      if (Object.keys(defaults).length > 0 && !engine.getValue(controlled$)) {
        const draft = engine.getValue(draftValue$);
        engine.pub(draftValue$, { ...draft, agent: { ...defaults, ...draft.agent } });
      }
    },
  };
}
