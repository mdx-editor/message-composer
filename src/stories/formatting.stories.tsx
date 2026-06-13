import { useState } from "react";

import { FormattingToolbar } from "../../registry/components/formatting/formatting-toolbar.tsx";
import { MessageComposer as RegistryMessageComposer } from "../../registry/components/message-composer/message-composer.tsx";
import { MessageComposer, useCellValue, usePublisher, type MessageComposerValue } from "../index.ts";
import {
  formattingPlugin,
  formattingState$,
  formatText$,
  toggleBlock$,
  toggleLink$,
} from "../plugins/formatting/index.tsx";

import "./tailwind.css";

export default {
  title: "Formatting",
};

const layoutStyle = { display: "grid", gap: 8, maxWidth: 520 } as const;
const editorStyle = {
  border: "1px solid #d4d4d8",
  borderRadius: 6,
  padding: 8,
  minHeight: 80,
  outline: "none",
  "--message-composer-placeholder-left": "8px",
  "--message-composer-placeholder-top": "8px",
} as const;
const inspectorStyle = { background: "#f4f4f5", padding: 8, whiteSpace: "pre-wrap" } as const;

// Custom UI over the exact same plugin contracts: no registry component, no
// Tailwind requirement — read formattingState$, publish the command streams.
// preventDefault on mousedown keeps the editor selection. Also demonstrates
// toggleLink$, which the first-party toolbar defers to stage 8 (ADR 0012).
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

const plugins = [formattingPlugin()];

export const Toolbar = () => {
  const [lastChange, setLastChange] = useState<MessageComposerValue | null>(null);
  const [lastSubmit, setLastSubmit] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <RegistryMessageComposer
        plugins={plugins}
        slots={{ toolbar: FormattingToolbar }}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message..." }}
        onValueChange={setLastChange}
        onSubmit={setLastSubmit}
      />
      <pre data-testid="last-change" style={inspectorStyle}>
        {JSON.stringify(lastChange)}
      </pre>
      <pre data-testid="last-submit" style={inspectorStyle}>
        {JSON.stringify(lastSubmit)}
      </pre>
    </div>
  );
};

export const CustomUI = () => {
  const [lastChange, setLastChange] = useState<MessageComposerValue | null>(null);
  const [lastSubmit, setLastSubmit] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <MessageComposer
        plugins={plugins}
        slots={{ toolbar: UnstyledToolbar }}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message...", style: editorStyle }}
        onValueChange={setLastChange}
        onSubmit={setLastSubmit}
      />
      <pre data-testid="last-change" style={inspectorStyle}>
        {JSON.stringify(lastChange)}
      </pre>
      <pre data-testid="last-submit" style={inspectorStyle}>
        {JSON.stringify(lastSubmit)}
      </pre>
    </div>
  );
};

export const MarkdownShortcuts = () => {
  const [lastChange, setLastChange] = useState<MessageComposerValue | null>(null);
  const [lastSubmit, setLastSubmit] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <MessageComposer
        plugins={plugins}
        slots={{ toolbar: UnstyledToolbar }}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message...", style: editorStyle }}
        onValueChange={setLastChange}
        onSubmit={setLastSubmit}
      />
      <pre data-testid="last-change" style={inspectorStyle}>
        {JSON.stringify(lastChange)}
      </pre>
      <pre data-testid="last-submit" style={inspectorStyle}>
        {JSON.stringify(lastSubmit)}
      </pre>
    </div>
  );
};
