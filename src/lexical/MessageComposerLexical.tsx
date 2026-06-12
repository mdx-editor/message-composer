import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { QuoteNode } from "@lexical/rich-text";
import { useCellValues, useEngine, usePublisher } from "@virtuoso.dev/reactive-engine-react";
import { COMMAND_PRIORITY_HIGH, HISTORIC_TAG, KEY_ENTER_COMMAND } from "lexical";
import { useEffect, useImperativeHandle, useState, type HTMLAttributes, type Ref } from "react";

import {
  controlled$,
  disabled$,
  draftValue$,
  editorPatch$,
  markdown$,
  reset$,
  submit$,
  submitError$,
  submitting$,
} from "../core/nodes.ts";
import { resolveSlots, type MessageComposerPlugin, type MessageComposerSlots } from "../core/plugin.ts";
import type { MessageComposerValue } from "../core/value.ts";
import { $exportMarkdown, $importMarkdown, markdownConversionOptionsFromEngine } from "./markdown.ts";
import { editorValuePatchers$, lexicalEditor$, type EditorValuePatcher } from "./nodes.ts";

export interface MessageComposerEditorProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "dangerouslySetInnerHTML" | "placeholder" | "aria-placeholder"
> {
  /** Placeholder text shown while the editor is empty; also sets `aria-placeholder`. */
  placeholder?: string;
}

export interface MessageComposerHandle {
  focus(): void;
  /**
   * Clears the draft to an empty value. In controlled mode the cleared value is
   * only emitted through `onValueChange`; the host decides whether to adopt it.
   */
  reset(): void;
  submit(): void;
}

const ENGINE_SYNC_TAG = "message-composer-engine-sync";

/** Must run inside an editor state read so patchers can use `$` functions. */
function runValuePatchers(
  patchers: EditorValuePatcher[],
  base: Partial<MessageComposerValue>
): Partial<MessageComposerValue> {
  let patch = base;
  for (const patcher of patchers) {
    patch = { ...patch, ...patcher() };
  }
  return patch;
}

export function MessageComposerLexical({
  editorProps,
  handleRef,
  plugins = [],
  slots,
}: {
  editorProps?: MessageComposerEditorProps;
  handleRef?: Ref<MessageComposerHandle>;
  plugins?: readonly MessageComposerPlugin[];
  slots?: Partial<MessageComposerSlots>;
}) {
  const engine = useEngine();
  const [initialConfig] = useState(() => ({
    namespace: "message-composer",
    nodes: [
      CodeNode,
      CodeHighlightNode,
      ListNode,
      ListItemNode,
      QuoteNode,
      LinkNode,
      ...plugins.flatMap((plugin) => plugin.lexicalNodes ?? []),
    ],
    onError: (error: Error) => {
      throw error;
    },
    editable: !engine.getValue(disabled$),
    editorState: () => {
      $importMarkdown(engine.getValue(markdown$), markdownConversionOptionsFromEngine(engine));
    },
  }));
  const [pluginComponents] = useState(() => plugins.flatMap((plugin) => plugin.lexicalPlugins ?? []));
  const resolvedSlots = resolveSlots(plugins, slots);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <EditorSurface editorProps={editorProps} handleRef={handleRef} slots={resolvedSlots} />
      <HistoryPlugin />
      <EngineBridgePlugin />
      <SubmitShortcutPlugin />
      {pluginComponents.map((Plugin, index) => (
        <Plugin key={index} />
      ))}
    </LexicalComposer>
  );
}

function EditorSurface({
  editorProps,
  handleRef,
  slots,
}: {
  editorProps?: MessageComposerEditorProps;
  handleRef?: Ref<MessageComposerHandle>;
  slots?: MessageComposerSlots;
}) {
  const [editor] = useLexicalComposerContext();
  const [disabled, submitting, submitError] = useCellValues(disabled$, submitting$, submitError$);
  const publishReset = usePublisher(reset$);
  const publishSubmit = usePublisher(submit$);

  useEffect(() => {
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  useImperativeHandle(handleRef, () => ({
    focus: () => {
      editor.focus();
    },
    reset: () => {
      publishReset();
    },
    submit: () => {
      publishSubmit();
    },
  }));

  const { placeholder, style, ...rest } = editorProps ?? {};
  const { header: Header, toolbar: Toolbar, footer: Footer } = slots ?? {};

  const stateAttributes = {
    "data-submitting": submitting || undefined,
    "data-submit-error": submitError === null ? undefined : true,
    "data-disabled": disabled || undefined,
  };

  return (
    <div className="message-composer">
      {Header ? <Header /> : null}
      {Toolbar ? <Toolbar /> : null}
      <div className="message-composer-editor" style={{ position: "relative" }}>
        <RichTextPlugin
          contentEditable={
            placeholder === undefined ? (
              <ContentEditable {...rest} {...stateAttributes} style={style} placeholder={null} />
            ) : (
              <ContentEditable
                {...rest}
                {...stateAttributes}
                style={style}
                aria-placeholder={placeholder}
                placeholder={
                  <div
                    className="message-composer-placeholder"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      pointerEvents: "none",
                      userSelect: "none",
                      opacity: 0.5,
                    }}
                  >
                    {placeholder}
                  </div>
                }
              />
            )
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
      </div>
      {Footer ? <Footer /> : null}
    </div>
  );
}

function EngineBridgePlugin() {
  const [editor] = useLexicalComposerContext();
  const engine = useEngine();

  useEffect(() => {
    let lastEditorMarkdown = engine.getValue(markdown$);
    let revertTimer: ReturnType<typeof setTimeout> | null = null;

    const cancelRevert = () => {
      if (revertTimer !== null) {
        clearTimeout(revertTimer);
        revertTimer = null;
      }
    };

    // Engine-applied markdown skips the update listener (ENGINE_SYNC_TAG), so
    // derived fields in the uncontrolled draft the composer owns would go stale.
    // Controlled drafts mirror the host value verbatim (ADR 0003); the host's
    // fields stand until the next user edit derives them again.
    const syncDerivedDraftFields = () => {
      if (engine.getValue(controlled$)) {
        return;
      }
      const patchers = engine.getValue(editorValuePatchers$);
      if (patchers.length === 0) {
        return;
      }
      const patch = editor.getEditorState().read(() => runValuePatchers(patchers, {}));
      const draft = engine.getValue(draftValue$);
      const keys = Object.keys(patch) as (keyof MessageComposerValue)[];
      if (keys.some((key) => draft[key] !== patch[key])) {
        engine.pub(draftValue$, { ...draft, ...patch });
      }
    };

    // Discrete commits keep the editor DOM synchronously consistent with the
    // engine state, so echo/revert decisions never observe a half-applied import.
    const applyMarkdown = (markdown: string) => {
      editor.update(
        () => {
          $importMarkdown(markdown, markdownConversionOptionsFromEngine(engine));
        },
        { tag: ENGINE_SYNC_TAG, discrete: true }
      );
      syncDerivedDraftFields();
    };

    // Strict-controlled hosts that do not echo the emitted value never produce a
    // markdown$ emission, so there is no reactive signal to revert the editor.
    // A zero-delay timer runs after React flushed the (potential) echo: if the
    // engine still disagrees with the editor, the editor reverts (ADR 0003).
    const armRevert = () => {
      cancelRevert();
      revertTimer = setTimeout(() => {
        revertTimer = null;
        if (editor.isComposing()) {
          armRevert();
          return;
        }
        const expected = engine.getValue(markdown$);
        if (expected !== lastEditorMarkdown) {
          lastEditorMarkdown = expected;
          applyMarkdown(expected);
        }
      }, 0);
    };

    engine.pub(lexicalEditor$, editor);
    // The initial import (defaultValue markdown) ran before this effect, outside
    // the update listener; derive once so the mounted draft starts consistent.
    syncDerivedDraftFields();

    const unsubEngine = engine.sub(markdown$, (markdown) => {
      cancelRevert();
      if (markdown === lastEditorMarkdown) {
        return;
      }
      lastEditorMarkdown = markdown;
      applyMarkdown(markdown);
    });

    const unsubEditor = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves, tags }) => {
      if (tags.has(ENGINE_SYNC_TAG)) {
        return;
      }
      // Undo/redo restores a full editor state with empty dirty sets, so the
      // selection-only shortcut must not swallow historic updates.
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0 && !tags.has(HISTORIC_TAG)) {
        return;
      }
      const markdown = editorState.read(() => $exportMarkdown(markdownConversionOptionsFromEngine(engine)));
      if (markdown === lastEditorMarkdown) {
        return;
      }
      lastEditorMarkdown = markdown;
      const patchers = engine.getValue(editorValuePatchers$);
      const patch =
        patchers.length > 0 ? editorState.read(() => runValuePatchers(patchers, { markdown })) : { markdown };
      engine.pub(editorPatch$, patch);
      if (engine.getValue(controlled$)) {
        armRevert();
      }
    });

    return () => {
      cancelRevert();
      unsubEngine();
      unsubEditor();
      if (!engine.isDisposed) {
        engine.pub(lexicalEditor$, null);
      }
    };
  }, [editor, engine]);

  return null;
}

function SubmitShortcutPlugin() {
  const [editor] = useLexicalComposerContext();
  const publishSubmit = usePublisher(submit$);

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        if (event !== null && !event.shiftKey && !event.isComposing && !editor.isComposing()) {
          event.preventDefault();
          publishSubmit();
          return true;
        }
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor, publishSubmit]);

  return null;
}
