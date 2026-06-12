import { useRef, useState } from "react";

import {
  createEmptyMessageComposerValue,
  markdown$,
  MessageComposer,
  setMarkdown$,
  submit$,
  useEngineRef,
  useRemoteCellValue,
  useRemotePublisher,
  type MessageComposerHandle,
  type MessageComposerValue,
} from "../index.ts";

export default {
  title: "Core",
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
} as const;
const inspectorStyle = { background: "#f4f4f5", padding: 8, whiteSpace: "pre-wrap" } as const;

export const Uncontrolled = () => {
  const [lastChange, setLastChange] = useState<MessageComposerValue | null>(null);
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);
  const handleRef = useRef<MessageComposerHandle>(null);

  return (
    <div style={layoutStyle}>
      <MessageComposer
        ref={handleRef}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message...", style: editorStyle }}
        onValueChange={setLastChange}
        onSubmit={setSubmitted}
      />
      <div>
        <button type="button" onClick={() => handleRef.current?.reset()}>
          Reset
        </button>
        <button type="button" onClick={() => handleRef.current?.submit()}>
          Submit
        </button>
      </div>
      <pre data-testid="last-change" style={inspectorStyle}>
        {JSON.stringify(lastChange)}
      </pre>
      <pre data-testid="submitted" style={inspectorStyle}>
        {JSON.stringify(submitted)}
      </pre>
    </div>
  );
};

export const Controlled = () => {
  const [value, setValue] = useState<MessageComposerValue>(createEmptyMessageComposerValue);
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <MessageComposer
        value={value}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message...", style: editorStyle }}
        onValueChange={setValue}
        onSubmit={setSubmitted}
      />
      <div>
        <button type="button" onClick={() => setValue({ ...value, markdown: "Hello from the host" })}>
          Set draft
        </button>
        <button type="button" onClick={() => setValue(createEmptyMessageComposerValue())}>
          Clear
        </button>
      </div>
      <pre data-testid="value" style={inspectorStyle}>
        {JSON.stringify(value)}
      </pre>
      <pre data-testid="submitted" style={inspectorStyle}>
        {JSON.stringify(submitted)}
      </pre>
    </div>
  );
};

export const ExternalControls = () => {
  const engineRef = useEngineRef();
  const markdown = useRemoteCellValue(markdown$, engineRef);
  const publishMarkdown = useRemotePublisher(setMarkdown$, engineRef);
  const publishSubmit = useRemotePublisher(submit$, engineRef);
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <MessageComposer
        engineRef={engineRef}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message...", style: editorStyle }}
        onSubmit={setSubmitted}
      />
      <div>
        <button type="button" onClick={() => publishMarkdown?.("Inserted from external control")}>
          Insert template
        </button>
        <button type="button" onClick={() => publishSubmit?.()}>
          Submit externally
        </button>
      </div>
      <pre data-testid="markdown-mirror" style={inspectorStyle}>
        {markdown ?? ""}
      </pre>
      <pre data-testid="submitted" style={inspectorStyle}>
        {JSON.stringify(submitted)}
      </pre>
    </div>
  );
};

export const AsyncSubmit = () => {
  const [failNext, setFailNext] = useState(false);
  const [outcome, setOutcome] = useState("idle");

  const handleSubmit = (value: MessageComposerValue) =>
    new Promise<void>((resolve, reject) => {
      setOutcome("submitting");
      setTimeout(() => {
        if (failNext) {
          setOutcome("rejected");
          reject(new Error("Simulated submit failure"));
        } else {
          setOutcome(`submitted: ${value.markdown}`);
          resolve();
        }
      }, 800);
    });

  return (
    <div style={layoutStyle}>
      <MessageComposer
        editorProps={{ "aria-label": "Message", placeholder: "Write a message...", style: editorStyle }}
        onSubmit={handleSubmit}
      />
      <label>
        <input
          type="checkbox"
          aria-label="Fail next submit"
          checked={failNext}
          onChange={(event) => setFailNext(event.target.checked)}
        />
        Fail next submit
      </label>
      <pre data-testid="outcome" style={inspectorStyle}>
        {outcome}
      </pre>
    </div>
  );
};
