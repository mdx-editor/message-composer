import { useRef, useState } from "react";

import { MessageComposer, type MessageComposerHandle, type MessageComposerValue } from "../index.ts";

export default {
  title: "Core/Headless",
};

const layoutStyle = { display: "grid", gap: 8, maxWidth: 520 } as const;
const editorStyle = {
  border: "1px solid #d4d4d8",
  borderRadius: 6,
  minHeight: 80,
  outline: "none",
  padding: 8,
  "--message-composer-placeholder-left": "8px",
  "--message-composer-placeholder-top": "8px",
} as const;
const inspectorStyle = { background: "#f4f4f5", padding: 8, whiteSpace: "pre-wrap" } as const;

export const HeadlessCore = () => {
  const [lastChange, setLastChange] = useState<MessageComposerValue | null>(null);
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);
  const handleRef = useRef<MessageComposerHandle>(null);

  return (
    <div style={layoutStyle}>
      <MessageComposer
        ref={handleRef}
        editorProps={{ "aria-label": "Headless message", placeholder: "Write a message...", style: editorStyle }}
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
      <pre data-testid="headless-last-change" style={inspectorStyle}>
        {JSON.stringify(lastChange)}
      </pre>
      <pre data-testid="headless-submitted" style={inspectorStyle}>
        {JSON.stringify(submitted)}
      </pre>
    </div>
  );
};
