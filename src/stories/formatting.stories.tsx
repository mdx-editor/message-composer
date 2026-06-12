import { useState } from "react";

import {
  formattingFeature,
  formattingState$,
  formatText$,
  toggleBlock$,
  toggleLink$,
} from "../features/formatting/index.tsx";
import { MessageComposer, useCellValue, usePublisher, type MessageComposerValue } from "../index.ts";

export default {
  title: "Formatting",
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

// Minimal unstyled toolbar, allowed until the first-party registry toolbar
// exists. It proves the formatting contracts: read formattingState$, publish
// command streams. preventDefault on mousedown keeps the editor selection.
const UnstyledToolbar = () => {
  const state = useCellValue(formattingState$);
  const format = usePublisher(formatText$);
  const block = usePublisher(toggleBlock$);
  const link = usePublisher(toggleLink$);

  return (
    <div role="toolbar" aria-label="Formatting" tabIndex={-1} onMouseDown={(event) => event.preventDefault()}>
      <button type="button" aria-pressed={state.bold} onClick={() => format("bold")}>
        Bold
      </button>
      <button type="button" aria-pressed={state.italic} onClick={() => format("italic")}>
        Italic
      </button>
      <button type="button" aria-pressed={state.strikethrough} onClick={() => format("strikethrough")}>
        Strikethrough
      </button>
      <button type="button" aria-pressed={state.code} onClick={() => format("code")}>
        Inline code
      </button>
      <button type="button" aria-pressed={state.blockType === "quote"} onClick={() => block("quote")}>
        Quote
      </button>
      <button type="button" aria-pressed={state.blockType === "code"} onClick={() => block("code")}>
        Code block
      </button>
      <button type="button" aria-pressed={state.blockType === "ul"} onClick={() => block("ul")}>
        Bullet list
      </button>
      <button type="button" aria-pressed={state.blockType === "ol"} onClick={() => block("ol")}>
        Numbered list
      </button>
      <button
        type="button"
        aria-pressed={state.link}
        onClick={() => (state.link ? link(null) : link("https://example.com"))}
      >
        Link
      </button>
    </div>
  );
};

const features = [formattingFeature()];

export const Toolbar = () => {
  const [lastChange, setLastChange] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <MessageComposer
        features={features}
        slots={{ toolbar: UnstyledToolbar }}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message...", style: editorStyle }}
        onValueChange={setLastChange}
      />
      <pre data-testid="last-change" style={inspectorStyle}>
        {JSON.stringify(lastChange)}
      </pre>
    </div>
  );
};
