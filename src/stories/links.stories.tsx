import { useEffect, useState } from "react";

import { FormattingToolbar } from "../../registry/components/formatting/formatting-toolbar.tsx";
import { MessageComposer as RegistryMessageComposer } from "../../registry/components/message-composer/message-composer.tsx";
import {
  MessageComposer as CoreMessageComposer,
  useCellValue,
  usePublisher,
  type MessageComposerValue,
} from "../index.ts";
import {
  beginLinkEdit$,
  currentLink$,
  editLink$,
  formattingPlugin,
  removeLink$,
} from "../plugins/formatting/index.tsx";

import "./tailwind.css";

export default {
  title: "Links",
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

const plugins = [formattingPlugin()];

export const AutoLinkAndEditor = () => {
  const [lastChange, setLastChange] = useState<MessageComposerValue | null>(null);
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <RegistryMessageComposer
        plugins={plugins}
        slots={{ toolbar: FormattingToolbar }}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message..." }}
        onValueChange={setLastChange}
        onSubmit={setSubmitted}
      />
      <pre data-testid="last-change" style={inspectorStyle}>
        {JSON.stringify(lastChange)}
      </pre>
      <pre data-testid="submitted" style={inspectorStyle}>
        {JSON.stringify(submitted)}
      </pre>
    </div>
  );
};

const CustomLinkControls = () => {
  const currentLink = useCellValue(currentLink$);
  const beginLinkEdit = usePublisher(beginLinkEdit$);
  const editLink = usePublisher(editLink$);
  const removeLink = usePublisher(removeLink$);
  const [url, setUrl] = useState("https://example.com");

  useEffect(() => {
    if (currentLink) {
      setUrl(currentLink.url);
    }
  }, [currentLink]);

  return (
    <div
      role="toolbar"
      aria-label="Links"
      tabIndex={-1}
      onMouseDown={(event) => {
        if (!(event.target instanceof HTMLInputElement)) {
          event.preventDefault();
        }
      }}
    >
      <input aria-label="Link URL" value={url} onChange={(event) => setUrl(event.target.value)} />
      <button
        type="button"
        aria-pressed={currentLink !== null}
        onClick={() => {
          beginLinkEdit();
          editLink({ url });
        }}
      >
        Apply link
      </button>
      <button type="button" disabled={currentLink === null} onClick={() => removeLink()}>
        Remove link
      </button>
    </div>
  );
};

export const CustomUI = () => {
  const [lastChange, setLastChange] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <CoreMessageComposer
        plugins={plugins}
        slots={{ toolbar: CustomLinkControls }}
        editorProps={{ "aria-label": "Message", placeholder: "Write a message...", style: editorStyle }}
        onValueChange={setLastChange}
      />
      <pre data-testid="last-change" style={inspectorStyle}>
        {JSON.stringify(lastChange)}
      </pre>
    </div>
  );
};
