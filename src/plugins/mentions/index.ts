import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Cell, e, Stream, Trigger, type Engine } from "@virtuoso.dev/reactive-engine-core";
import { useEngine } from "@virtuoso.dev/reactive-engine-react";
import {
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  BLUR_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  HISTORY_PUSH_TAG,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  type ElementNode,
  type LexicalEditor,
  type LexicalNode,
} from "lexical";
import type * as Mdast from "mdast";
import { useEffect, type ComponentType } from "react";

import { mentions$ } from "../../core/nodes.ts";
import type { MessageComposerPlugin } from "../../core/plugin.ts";
import type { MessageComposerMention } from "../../core/value.ts";
import type { LexicalExportVisitor, LexicalVisitor } from "../../lexical/mdast/exportMarkdownFromLexical.ts";
import type { MdastImportVisitor } from "../../lexical/mdast/importMarkdownToLexical.ts";
import { exportVisitors$, importVisitors$ } from "../../lexical/mdast/registry.ts";
import { editorValuePatchers$, lexicalEditor$, type EditorValuePatcher } from "../../lexical/nodes.ts";
import {
  $createMentionNode,
  $isMentionNode,
  MentionNode,
  mentionTokenComponent$,
  type MessageComposerMentionTokenProps,
} from "./MentionNode.tsx";

export { mentions$ };
export {
  $createMentionNode,
  $isMentionNode,
  MentionNode,
  type MessageComposerMentionTokenProps,
  type SerializedMentionNode,
} from "./MentionNode.tsx";

export interface MessageComposerMentionOption {
  id: string;
  label: string;
  data?: unknown;
}

export interface MessageComposerMentionProvider {
  /** Single character that opens the menu at a word start, e.g. "@". */
  trigger: string;
  search: (query: string, signal: AbortSignal) => Promise<MessageComposerMentionOption[]>;
}

export interface MessageComposerMentionsConfig {
  providers: MessageComposerMentionProvider[];
  /** Popup UI mounted with the editor; reads the mention cells and publishes the commands. */
  menu?: ComponentType;
  /** Renderer for mention tokens inside the editor; defaults to an unstyled span. */
  token?: ComponentType<MessageComposerMentionTokenProps>;
}

export interface MessageComposerMentionMenuState {
  trigger: string;
  query: string;
  /** Lexical key of the text node holding the trigger + query run. */
  nodeKey: string;
  triggerOffset: number;
  endOffset: number;
}

export interface MessageComposerMentionAnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

function menuStatesEqual(a: MessageComposerMentionMenuState | null, b: MessageComposerMentionMenuState | null) {
  if (a === null || b === null) {
    return a === b;
  }
  return (
    a.trigger === b.trigger &&
    a.query === b.query &&
    a.nodeKey === b.nodeKey &&
    a.triggerOffset === b.triggerOffset &&
    a.endOffset === b.endOffset
  );
}

function rectsEqual(a: MessageComposerMentionAnchorRect | null, b: MessageComposerMentionAnchorRect | null) {
  if (a === null || b === null) {
    return a === b;
  }
  return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
}

/** The active trigger/query run under the caret; null while no menu should show. */
export const mentionMenu$ = Cell<MessageComposerMentionMenuState | null>(
  null,
  (previous, next) => previous !== undefined && menuStatesEqual(previous, next)
);

/** Viewport rectangle of the trigger + query text, for anchoring the popup. */
export const mentionAnchorRect$ = Cell<MessageComposerMentionAnchorRect | null>(
  null,
  (previous, next) => previous !== undefined && rectsEqual(previous, next)
);

export const mentionResults$ = Cell<MessageComposerMentionOption[]>([]);
export const mentionLoading$ = Cell(false);
export const mentionError$ = Cell<unknown>(null);

/** Highlighted result index; publishable directly (e.g. on pointer hover). */
export const mentionHighlight$ = Cell(0);

// Commands are events, not state: distinct stays off so repeats are delivered.
/** Moves the highlight up (-1) or down (1), wrapping around the results. */
export const moveMentionHighlight$ = Stream<1 | -1>(false);

/** Replaces the trigger + query text with a mention node for the given option. */
export const insertMention$ = Stream<MessageComposerMentionOption>(false);

/** Inserts the currently highlighted result. */
export const confirmMention$ = Trigger();

/** Dismisses the menu until the current trigger run is left or removed. */
export const cancelMention$ = Trigger();

const MENTION_URL_SCHEME = "mention:";

function escapeForCharacterClass(char: string): string {
  return char.replaceAll(/[.*+?^${}()|[\]\\-]/g, String.raw`\$&`);
}

function buildTriggerPattern(triggers: string[]): RegExp {
  const characterClass = triggers.map(escapeForCharacterClass).join("");
  // The trigger must start a word (start of text or after whitespace/paren) and
  // the query runs to the caret without whitespace.
  return new RegExp(`(?:^|[\\s(])([${characterClass}])([^\\s]*)$`);
}

function $readTriggerMatch(pattern: RegExp): MessageComposerMentionMenuState | null {
  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }
  const anchor = selection.anchor;
  if (anchor.type !== "text") {
    return null;
  }
  const node = anchor.getNode();
  if (!$isTextNode(node) || node.hasFormat("code")) {
    return null;
  }
  const parentType = node.getParent()?.getType();
  if (parentType === "code" || parentType === "link") {
    return null;
  }
  const text = node.getTextContent().slice(0, anchor.offset);
  const match = pattern.exec(text);
  if (!match) {
    return null;
  }
  const query = match[2];
  return {
    trigger: match[1],
    query,
    nodeKey: node.getKey(),
    triggerOffset: text.length - query.length - 1,
    endOffset: anchor.offset,
  };
}

function computeAnchorRect(
  editor: LexicalEditor,
  state: MessageComposerMentionMenuState
): MessageComposerMentionAnchorRect | null {
  const element = editor.getElementByKey(state.nodeKey);
  const textNode = element?.firstChild;
  if (!textNode || textNode.nodeType !== 3) {
    return null;
  }
  try {
    const length = textNode.textContent?.length ?? 0;
    const range = document.createRange();
    range.setStart(textNode, Math.min(state.triggerOffset, length));
    range.setEnd(textNode, Math.min(state.endOffset, length));
    const rect = range.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  } catch {
    return null;
  }
}

function trackMentionTrigger(engine: Engine, providers: MessageComposerMentionProvider[]): () => void {
  if (providers.length === 0) {
    return () => {};
  }
  const pattern = buildTriggerPattern(providers.map((provider) => provider.trigger));
  let dismissed: { nodeKey: string; triggerOffset: number } | null = null;
  let cleanupEditor: (() => void) | null = null;

  const close = () => {
    engine.pubIn({ [mentionMenu$]: null, [mentionAnchorRect$]: null });
  };

  const unsubCancel = engine.sub(cancelMention$, () => {
    const state = engine.getValue(mentionMenu$);
    if (state) {
      dismissed = { nodeKey: state.nodeKey, triggerOffset: state.triggerOffset };
    }
    close();
  });

  const unsubEditorCell = engine.sub(lexicalEditor$, (editor: LexicalEditor | null) => {
    cleanupEditor?.();
    cleanupEditor = null;
    if (!editor) {
      close();
      return;
    }
    const detect = () => {
      const state = editor.getEditorState().read(() => $readTriggerMatch(pattern));
      if (!state) {
        dismissed = null;
        close();
        return;
      }
      if (dismissed && dismissed.nodeKey === state.nodeKey && dismissed.triggerOffset === state.triggerOffset) {
        close();
        return;
      }
      dismissed = null;
      engine.pubIn({ [mentionMenu$]: state, [mentionAnchorRect$]: computeAnchorRect(editor, state) });
    };
    detect();
    const unsubUpdate = editor.registerUpdateListener(detect);
    const unsubBlur = editor.registerCommand(
      BLUR_COMMAND,
      () => {
        close();
        return false;
      },
      COMMAND_PRIORITY_CRITICAL
    );
    cleanupEditor = () => {
      unsubUpdate();
      unsubBlur();
    };
  });

  return () => {
    cleanupEditor?.();
    unsubEditorCell();
    unsubCancel();
  };
}

function runSearchLifecycle(engine: Engine, providers: MessageComposerMentionProvider[]): () => void {
  let controller: AbortController | null = null;

  const unsub = engine.sub(mentionMenu$, (state: MessageComposerMentionMenuState | null) => {
    controller?.abort();
    controller = null;
    if (!state) {
      engine.pubIn({
        [mentionResults$]: [],
        [mentionLoading$]: false,
        [mentionError$]: null,
        [mentionHighlight$]: 0,
      });
      return;
    }
    const provider = providers.find((candidate) => candidate.trigger === state.trigger);
    if (!provider) {
      return;
    }
    const current = new AbortController();
    controller = current;
    engine.pubIn({ [mentionLoading$]: true, [mentionError$]: null });
    void provider.search(state.query, current.signal).then(
      (results) => {
        if (current.signal.aborted || engine.isDisposed) {
          return;
        }
        controller = null;
        engine.pubIn({ [mentionResults$]: results, [mentionLoading$]: false, [mentionHighlight$]: 0 });
      },
      (error: unknown) => {
        if (current.signal.aborted || engine.isDisposed) {
          return;
        }
        controller = null;
        engine.pubIn({ [mentionResults$]: [], [mentionLoading$]: false, [mentionError$]: error });
      }
    );
  });

  return () => {
    controller?.abort();
    unsub();
  };
}

e.sub(moveMentionHighlight$, (delta, engine) => {
  const count = engine.getValue(mentionResults$).length;
  if (count === 0) {
    return;
  }
  engine.pub(mentionHighlight$, (engine.getValue(mentionHighlight$) + delta + count) % count);
});

e.sub(confirmMention$, (_, engine) => {
  const option = engine.getValue(mentionResults$)[engine.getValue(mentionHighlight$)];
  if (option) {
    engine.pub(insertMention$, option);
  }
});

e.sub(insertMention$, (option, engine) => {
  const editor = engine.getValue(lexicalEditor$);
  const state = engine.getValue(mentionMenu$);
  if (!editor || !state) {
    return;
  }
  editor.update(
    () => {
      const node = $getNodeByKey(state.nodeKey);
      if (!$isTextNode(node)) {
        return;
      }
      const size = node.getTextContentSize();
      const end = Math.min(state.endOffset, size);
      const splitOffsets: number[] = [];
      if (state.triggerOffset > 0) {
        splitOffsets.push(state.triggerOffset);
      }
      if (end < size) {
        splitOffsets.push(end);
      }
      const pieces = splitOffsets.length > 0 ? node.splitText(...splitOffsets) : [node];
      const target = state.triggerOffset > 0 ? pieces[1] : pieces[0];
      if (!target) {
        return;
      }
      const mention = $createMentionNode({
        id: option.id,
        trigger: state.trigger,
        label: option.label,
        data: option.data,
      });
      target.replace(mention);
      // The trailing space is the caret home after an inline decorator; typing
      // continues naturally and a second backspace removes the token as a unit.
      const space = $createTextNode(" ");
      mention.insertAfter(space);
      space.select(1, 1);
    },
    { discrete: true, tag: HISTORY_PUSH_TAG }
  );
  engine.pubIn({ [mentionMenu$]: null, [mentionAnchorRect$]: null });
});

function MentionKeyboardPlugin() {
  const [editor] = useLexicalComposerContext();
  const engine = useEngine();

  useEffect(() => {
    const menuHasResults = () => engine.getValue(mentionMenu$) !== null && engine.getValue(mentionResults$).length > 0;
    const unsubs = [
      editor.registerCommand<KeyboardEvent>(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          if (!menuHasResults()) {
            return false;
          }
          event.preventDefault();
          engine.pub(moveMentionHighlight$, 1);
          return true;
        },
        COMMAND_PRIORITY_CRITICAL
      ),
      editor.registerCommand<KeyboardEvent>(
        KEY_ARROW_UP_COMMAND,
        (event) => {
          if (!menuHasResults()) {
            return false;
          }
          event.preventDefault();
          engine.pub(moveMentionHighlight$, -1);
          return true;
        },
        COMMAND_PRIORITY_CRITICAL
      ),
      editor.registerCommand<KeyboardEvent | null>(
        KEY_ENTER_COMMAND,
        (event) => {
          if (!menuHasResults()) {
            return false;
          }
          event?.preventDefault();
          engine.pub(confirmMention$, undefined);
          return true;
        },
        COMMAND_PRIORITY_CRITICAL
      ),
      editor.registerCommand<KeyboardEvent>(
        KEY_TAB_COMMAND,
        (event) => {
          if (!menuHasResults()) {
            return false;
          }
          event.preventDefault();
          engine.pub(confirmMention$, undefined);
          return true;
        },
        COMMAND_PRIORITY_CRITICAL
      ),
      editor.registerCommand<KeyboardEvent>(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (engine.getValue(mentionMenu$) === null) {
            return false;
          }
          event.preventDefault();
          engine.pub(cancelMention$, undefined);
          return true;
        },
        COMMAND_PRIORITY_CRITICAL
      ),
    ];
    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [editor, engine]);

  return null;
}

function mdastTextContent(node: Mdast.Nodes): string {
  if ("value" in node && typeof node.value === "string") {
    return node.value;
  }
  if ("children" in node) {
    return node.children.map((child) => mdastTextContent(child)).join("");
  }
  return "";
}

/**
 * Registered ahead of the core link visitor (ADR 0008): `mention:` scheme links
 * become mention nodes; links without a readable trigger + label fall through.
 */
const MdastMentionVisitor: MdastImportVisitor<Mdast.Link> = {
  priority: 1,
  testNode: (node) => node.type === "link" && node.url.startsWith(MENTION_URL_SCHEME),
  visitNode({ mdastNode, lexicalParent, actions }) {
    const text = mdastTextContent(mdastNode);
    if (text.length < 2) {
      actions.nextVisitor();
      return;
    }
    let id = mdastNode.url.slice(MENTION_URL_SCHEME.length);
    try {
      id = decodeURIComponent(id);
    } catch {
      // a malformed escape sequence means the id was never encoded; keep it raw
    }
    (lexicalParent as ElementNode).append($createMentionNode({ id, trigger: text.slice(0, 1), label: text.slice(1) }));
  },
};

const LexicalMentionVisitor: LexicalExportVisitor<MentionNode, Mdast.Link> = {
  testLexicalNode: $isMentionNode,
  visitLexicalNode({ lexicalNode, mdastParent, actions }) {
    actions.appendToParent(mdastParent, {
      type: "link",
      url: MENTION_URL_SCHEME + encodeURIComponent(lexicalNode.getMentionId()),
      title: null,
      children: [{ type: "text", value: lexicalNode.getTextContent() }],
    });
  },
};

function $collectMentions(target: MessageComposerMention[], node: LexicalNode): void {
  if ($isMentionNode(node)) {
    const mention: MessageComposerMention = {
      id: node.getMentionId(),
      trigger: node.getTrigger(),
      label: node.getLabel(),
    };
    const data = node.getData();
    if (data !== undefined) {
      mention.data = data;
    }
    target.push(mention);
    return;
  }
  if ($isElementNode(node)) {
    for (const child of node.getChildren()) {
      $collectMentions(target, child);
    }
  }
}

function mentionsEqual(a: MessageComposerMention, b: MessageComposerMention): boolean {
  return a.id === b.id && a.trigger === b.trigger && a.label === b.label && a.data === b.data;
}

// The sidecar is derived in document order on every change (ADR 0008); the
// cached array keeps the value reference-stable across unrelated edits.
function createMentionsPatcher(): EditorValuePatcher {
  let last: MessageComposerMention[] = [];
  return () => {
    const collected: MessageComposerMention[] = [];
    $collectMentions(collected, $getRoot());
    if (collected.length !== last.length || collected.some((mention, i) => !mentionsEqual(mention, last[i]))) {
      last = collected;
    }
    return { mentions: last };
  };
}

export function mentionsPlugin(config: MessageComposerMentionsConfig): MessageComposerPlugin {
  for (const provider of config.providers) {
    if (provider.trigger.length !== 1) {
      throw new Error(`Mention triggers must be single characters, got "${provider.trigger}"`);
    }
  }
  const plugins: ComponentType[] = [MentionKeyboardPlugin];
  if (config.menu) {
    plugins.push(config.menu);
  }
  return {
    id: "mentions",
    lexicalNodes: [MentionNode],
    lexicalPlugins: plugins,
    init: ({ engine }) => {
      engine.pubIn({
        [mentionTokenComponent$]: config.token ?? null,
        [importVisitors$]: [
          ...engine.getValue(importVisitors$),
          MdastMentionVisitor as MdastImportVisitor<Mdast.RootContent>,
        ],
        [exportVisitors$]: [...engine.getValue(exportVisitors$), LexicalMentionVisitor as LexicalVisitor],
        [editorValuePatchers$]: [...engine.getValue(editorValuePatchers$), createMentionsPatcher()],
      });
      const cleanups = [trackMentionTrigger(engine, config.providers), runSearchLifecycle(engine, config.providers)];
      return () => {
        for (const cleanup of cleanups) {
          cleanup();
        }
      };
    },
  };
}
