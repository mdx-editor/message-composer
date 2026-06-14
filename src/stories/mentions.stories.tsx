import { useState } from "react";

import { MentionMenu } from "../../registry/components/mentions/mention-menu.tsx";
import { MentionToken } from "../../registry/components/mentions/mention-token.tsx";
import { MessageComposer as RegistryMessageComposer } from "../../registry/components/message-composer/message-composer.tsx";
import {
  MessageComposer as CoreMessageComposer,
  useCellValues,
  usePublisher,
  type MessageComposerValue,
} from "../index.ts";
import {
  insertMention$,
  mentionAnchorRect$,
  mentionHighlight$,
  mentionLoading$,
  mentionMenu$,
  mentionResults$,
  mentionsPlugin,
  type MessageComposerMentionOption,
  type MessageComposerMentionTokenProps,
} from "../plugins/mentions/index.ts";

import "./tailwind.css";

export default {
  title: "Mentions",
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

const PEOPLE: MessageComposerMentionOption[] = [
  { id: "u1", label: "Ada Lovelace" },
  { id: "u2", label: "Alan Turing" },
  { id: "u3", label: "Grace Hopper" },
  { id: "u4", label: "Katherine Johnson" },
];

function searchPeople(query: string, signal: AbortSignal): Promise<MessageComposerMentionOption[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve(PEOPLE.filter((person) => person.label.toLowerCase().includes(query.toLowerCase())));
    }, 120);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("search aborted"));
    });
  });
}

const registryPlugins = [
  mentionsPlugin({
    providers: [{ trigger: "@", search: searchPeople }],
    menu: MentionMenu,
    token: MentionToken,
  }),
];

export const RegistryUI = () => {
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <RegistryMessageComposer
        plugins={registryPlugins}
        editorProps={{ "aria-label": "Message", placeholder: "Type @ to mention someone..." }}
        onSubmit={setSubmitted}
      />
      <pre data-testid="submitted" style={inspectorStyle}>
        {JSON.stringify(submitted)}
      </pre>
    </div>
  );
};

// Custom UI over the exact same plugin contracts: no registry component, no
// Tailwind requirement — mention cells in, insertion command out.
const CustomMentionMenu = () => {
  const [menu, rect, results, loading, highlight] = useCellValues(
    mentionMenu$,
    mentionAnchorRect$,
    mentionResults$,
    mentionLoading$,
    mentionHighlight$
  );
  const insert = usePublisher(insertMention$);

  if (!menu || !rect) {
    return null;
  }

  return (
    <ul
      data-testid="custom-mention-menu"
      style={{
        position: "fixed",
        left: rect.left,
        top: rect.bottom + 4,
        margin: 0,
        padding: 4,
        listStyle: "none",
        background: "#ffffff",
        border: "1px solid #d4d4d8",
        borderRadius: 6,
      }}
    >
      {loading && results.length === 0 ? <li>Searching…</li> : null}
      {results.map((option, index) => (
        <li key={option.id}>
          <button
            className="story-button"
            type="button"
            aria-pressed={index === highlight}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insert(option)}
          >
            {option.label}
          </button>
        </li>
      ))}
    </ul>
  );
};

const CustomMentionToken = ({ trigger, label }: MessageComposerMentionTokenProps) => (
  <span data-testid="custom-mention-token" style={{ background: "#fef3c7", borderRadius: 4, padding: "0 2px" }}>
    {trigger}
    {label}
  </span>
);

const customPlugins = [
  mentionsPlugin({
    providers: [{ trigger: "@", search: searchPeople }],
    menu: CustomMentionMenu,
    token: CustomMentionToken,
  }),
];

const rehydratedValue: MessageComposerValue = {
  markdown: "ping [@Ada Lovelace](mention:u1) about the release",
  attachments: [],
  mentions: [],
  audioClips: [],
};

export const CustomUI = () => {
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);

  return (
    <div style={layoutStyle}>
      <CoreMessageComposer
        plugins={customPlugins}
        defaultValue={rehydratedValue}
        editorProps={{ "aria-label": "Message", placeholder: "Type @ to mention someone...", style: editorStyle }}
        onSubmit={setSubmitted}
      />
      <pre data-testid="submitted" style={inspectorStyle}>
        {JSON.stringify(submitted)}
      </pre>
    </div>
  );
};
