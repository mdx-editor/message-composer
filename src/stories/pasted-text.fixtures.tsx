import { useState } from "react";

import { FormattingToolbar } from "../../registry/components/formatting/formatting-toolbar.tsx";
import { MessageComposer } from "../../registry/components/message-composer/message-composer.tsx";
import { PastedTextList } from "../../registry/components/pasted-text/pasted-text-list.tsx";
import {
  createEmptyMessageComposerValue,
  draftValue$,
  submit$,
  useCellValue,
  usePublisher,
  type MessageComposerValue,
} from "../index.ts";
import { formattingPlugin } from "../plugins/formatting/index.tsx";
import { getPastedTexts, pastedTextPlugin } from "../plugins/pasted-text/index.ts";

import "./tailwind.css";

export const exampleMarkdown = [
  "# Release review",
  "",
  "Please review the following changes before release.",
  "",
  "## Checklist",
  "",
  "- [x] Preserve original clipboard text",
  "- [ ] Review error handling",
  "- [ ] Confirm keyboard access",
  "",
  "## Results",
  "",
  "| Check | Result |",
  "| --- | --- |",
  "| Build | Passed |",
  "| Browser tests | Passed |",
  "",
  "```ts",
  "const report = { ready: true };",
  "console.log(report);",
  "```",
  "",
  "See [the release notes][notes].",
  "",
  "[notes]: https://example.com/releases",
  "",
  "---",
  "",
  "Keep tables, references, and whitespace exactly as pasted.",
].join("\n");

function Footer() {
  const submit = usePublisher(submit$);
  const draft = useCellValue(draftValue$);
  return (
    <>
      <PastedTextList />
      <div className="flex items-center justify-between gap-3 border-t border-input px-3 py-2">
        <span className="text-xs text-muted-foreground">Enter to send · Shift + Enter for a new line</span>
        <button
          type="button"
          disabled={!draft.markdown.trim() && getPastedTexts(draft).length === 0}
          onClick={() => submit()}
          className="shrink-0 whitespace-nowrap rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
        >
          Send message
        </button>
      </div>
    </>
  );
}
const plugins = [formattingPlugin(), pastedTextPlugin()];
const slots = { toolbar: FormattingToolbar, footer: Footer };

export function PastedTextScenario({
  populated = false,
  controlled = false,
}: {
  populated?: boolean;
  controlled?: boolean;
}) {
  const [value, setValue] = useState<MessageComposerValue>(() => ({
    ...createEmptyMessageComposerValue(),
    markdown: populated ? "Review this release checklist and flag anything we missed." : "",
    extensions: populated ? { pastedTexts: [{ id: "release-notes", text: exampleMarkdown }] } : {},
  }));
  const [submitted, setSubmitted] = useState<MessageComposerValue | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-8 px-4 py-10 text-foreground sm:px-8">
      <div className="space-y-3">
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Message composer</p>
        <h1 className="text-3xl font-semibold tracking-tight">Keep the context. Skip the clutter.</h1>
        <p className="max-w-xl text-base leading-7 text-muted-foreground">
          Paste notes, Markdown, or a long log. Large pastes become a compact pill you can open, copy, or edit.
        </p>
      </div>
      <section className="grid gap-3" aria-label="Compose a message">
        <MessageComposer
          plugins={plugins}
          slots={slots}
          {...(controlled ? { value } : { defaultValue: value })}
          onValueChange={setValue}
          onSubmit={setSubmitted}
          editorProps={{ "aria-label": "Message", placeholder: "Ask a question or paste some context…" }}
        />
        <p className="text-xs leading-5 text-muted-foreground">
          Pastes of 20 lines or 2,000 characters become pills. Short text and code-block pastes stay in the editor.
        </p>
      </section>
      <section
        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/25 p-5"
        aria-label="Try a sample"
      >
        <div>
          <h2 className="text-sm font-semibold">Try a Markdown document</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tables, a checklist, code, and reference links.</p>
        </div>
        <button
          type="button"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          onClick={() => {
            void navigator.clipboard.writeText(exampleMarkdown).then(
              () => setCopyStatus("Copied. Paste it into the message."),
              () => setCopyStatus("Copy the sample from the expanded pill.")
            );
          }}
        >
          Copy sample
        </button>
        <output className="w-full text-sm text-muted-foreground">{copyStatus}</output>
      </section>
      {submitted ? (
        <section className="grid gap-3 rounded-xl border border-border p-5" aria-label="Submitted message">
          <h2 className="text-sm font-semibold">Submitted message</h2>
          <p className="whitespace-pre-wrap">{submitted.markdown || "Text attachment only"}</p>
          {getPastedTexts(submitted).map((item, index) => (
            <details key={item.id} className="rounded-md border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">Pasted text {index + 1}</summary>
              <pre className="mt-3 overflow-auto text-xs leading-6 whitespace-pre">{item.text}</pre>
            </details>
          ))}
        </section>
      ) : null}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Draft value</summary>
        <pre data-testid="draft" className="mt-2 overflow-auto whitespace-pre-wrap">
          {JSON.stringify(value)}
        </pre>
      </details>
      <pre data-testid="submitted" hidden>
        {JSON.stringify(submitted)}
      </pre>
    </main>
  );
}
