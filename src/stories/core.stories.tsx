import { useRef, useState } from "react";

import { MessageComposer as RegistryMessageComposer } from "../../registry/components/message-composer/message-composer.tsx";
import {
  createEmptyMessageComposerValue,
  markdown$,
  setMarkdown$,
  submit$,
  useEngineRef,
  useRemoteCellValue,
  useRemotePublisher,
  type MessageComposerHandle,
  type MessageComposerValue,
} from "../index.ts";

import "./tailwind.css";

export default {
  title: "Core",
};

const layoutStyle = { display: "grid", gap: 8, maxWidth: 520 } as const;
const inspectorStyle = { background: "#f4f4f5", padding: 8, whiteSpace: "pre-wrap" } as const;

export const Uncontrolled = () => {
  const [lastChange, setLastChange] = useState<MessageComposerValue | null>(null);
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);
  const handleRef = useRef<MessageComposerHandle>(null);

  return (
    <div style={layoutStyle}>
      <RegistryMessageComposer
        ref={handleRef}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message..." }}
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
      <RegistryMessageComposer
        value={value}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message..." }}
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
      <RegistryMessageComposer
        engineRef={engineRef}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message..." }}
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
      <RegistryMessageComposer
        editorProps={{ "aria-label": "Message", placeholder: "Write a message..." }}
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

const SAMPLE_MARKDOWN = `plain **bold** *italic* ~~struck~~ \`code\`

* list item
* another **bold** item

1. ordered item

> a quote

\`\`\`js
code();
\`\`\`

[a link](https://example.com)`;

export const MarkdownRoundTrip = () => {
  const engineRef = useEngineRef();
  const publishMarkdown = useRemotePublisher(setMarkdown$, engineRef);
  const emitted = useRemoteCellValue(markdown$, engineRef);
  const [source, setSource] = useState(SAMPLE_MARKDOWN);

  return (
    <div style={layoutStyle}>
      <textarea
        aria-label="Markdown source"
        rows={10}
        style={inspectorStyle}
        value={source}
        onChange={(event) => setSource(event.target.value)}
      />
      <div>
        <button type="button" onClick={() => publishMarkdown?.(source)}>
          Load into composer
        </button>
      </div>
      <RegistryMessageComposer
        engineRef={engineRef}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message..." }}
      />
      <pre data-testid="emitted-markdown" style={inspectorStyle}>
        {emitted ?? ""}
      </pre>
    </div>
  );
};
