import { useState } from "react";

import { ModelEffortPicker as RegistryModelEffortPicker } from "../../registry/components/agent-settings/model-effort-picker.tsx";
import { MessageComposer as RegistryMessageComposer } from "../../registry/components/message-composer/message-composer.tsx";
import {
  MessageComposer as CoreMessageComposer,
  useCellValues,
  usePublisher,
  type MessageComposerValue,
} from "../index.ts";
import {
  agent$,
  agentSettingsPlugin,
  effortOptions$,
  modelOptions$,
  selectEffort$,
  selectModel$,
} from "../plugins/agent-settings/index.ts";

import "./tailwind.css";

export default {
  title: "AgentSettings",
};

const layoutStyle = { display: "grid", gap: 8, maxWidth: 520 } as const;
const editorStyle = {
  border: "1px solid #d4d4d8",
  borderRadius: 6,
  padding: 8,
  minHeight: 80,
  maxHeight: 200,
  overflowY: "auto",
  outline: "none",
  "--message-composer-placeholder-left": "8px",
  "--message-composer-placeholder-top": "8px",
} as const;
const inspectorStyle = { background: "#f4f4f5", padding: 8, whiteSpace: "pre-wrap" } as const;

const plugins = [
  agentSettingsPlugin({
    models: [
      { id: "fable-5", label: "Fable 5" },
      { id: "opus-4-8", label: "Opus 4.8" },
      { id: "sonnet-4-6", label: "Sonnet 4.6" },
    ],
    efforts: ["low", "medium", "high"],
    defaultModelId: "fable-5",
    defaultEffort: "medium",
  }),
];

export const ModelEffortPicker = () => {
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <RegistryMessageComposer
        plugins={plugins}
        slots={{ footer: RegistryModelEffortPicker }}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message..." }}
        onSubmit={setSubmitted}
      />
      <pre data-testid="submitted" style={inspectorStyle}>
        {JSON.stringify(submitted)}
      </pre>
    </div>
  );
};

// Custom UI over the exact same plugin contracts: no registry component, no
// Tailwind requirement — option cells in, selection streams out.
const CustomAgentControls = () => {
  const [agent, models, efforts] = useCellValues(agent$, modelOptions$, effortOptions$);
  const publishModel = usePublisher(selectModel$);
  const publishEffort = usePublisher(selectEffort$);

  return (
    <div data-testid="custom-agent-controls">
      <fieldset aria-label="Model">
        {models.map((model) => (
          <button
            key={model.id}
            type="button"
            aria-pressed={agent?.modelId === model.id}
            onClick={() => publishModel(model.id)}
          >
            {model.label}
          </button>
        ))}
      </fieldset>
      <fieldset aria-label="Effort">
        {efforts.map((effort) => (
          <button
            key={effort}
            type="button"
            aria-pressed={agent?.effort === effort}
            onClick={() => publishEffort(effort)}
          >
            {effort}
          </button>
        ))}
      </fieldset>
    </div>
  );
};

export const CustomUI = () => {
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <CoreMessageComposer
        plugins={plugins}
        slots={{ footer: CustomAgentControls }}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message...", style: editorStyle }}
        onSubmit={setSubmitted}
      />
      <pre data-testid="submitted" style={inspectorStyle}>
        {JSON.stringify(submitted)}
      </pre>
    </div>
  );
};
