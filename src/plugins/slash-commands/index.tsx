import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { Cell, e, Stream, Trigger, type Engine } from "@virtuoso.dev/reactive-engine-core";
import { useEngine } from "@virtuoso.dev/reactive-engine-react";
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  BLUR_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  HISTORY_PUSH_TAG,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_DOWN_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  type LexicalEditor,
} from "lexical";
import { useEffect, type ComponentType } from "react";

import { draftValue$, editorChange$ } from "../../core/nodes.ts";
import type { MessageComposerPlugin } from "../../core/plugin.ts";
import type { MessageComposerValue } from "../../core/value.ts";
import { editorValuePatchers$, lexicalEditor$, type EditorValuePatcher } from "../../lexical/nodes.ts";

export const CONTEXT_CHIPS_EXTENSION_KEY = "contextChips";

export interface MessageComposerContextChip {
  id: string;
  type: string;
  label: string;
  description?: string;
  data?: unknown;
}

export interface MessageComposerSlashCommandGroup {
  id: string;
  label: string;
}

export interface MessageComposerSlashCommandItem {
  id: string;
  label: string;
  description?: string;
  group?: string;
  /** Text used when matching typed paths such as `/model`. Defaults to `id`. */
  value?: string;
  keywords?: readonly string[];
  data?: unknown;
  /** Text that replaces the slash run when this command executes. Defaults to an empty replacement. */
  replacement?: string;
  chip?:
    | MessageComposerContextChip
    | ((context: MessageComposerSlashCommandExecutionContext) => MessageComposerContextChip);
  children?:
    | MessageComposerSlashCommandSearchResult
    | readonly MessageComposerSlashCommandItem[]
    | MessageComposerSlashCommandChildrenProvider;
  execute?: (context: MessageComposerSlashCommandExecutionContext) => void | Promise<void>;
}

export interface MessageComposerSlashCommandSearchResult {
  title?: string;
  placeholder?: string;
  groups?: readonly MessageComposerSlashCommandGroup[];
  items: readonly MessageComposerSlashCommandItem[];
}

export interface MessageComposerSlashCommandRequest {
  query: string;
  path: readonly MessageComposerSlashCommandItem[];
}

export type MessageComposerSlashCommandChildrenProvider = (
  request: MessageComposerSlashCommandRequest,
  signal: AbortSignal
) =>
  | MessageComposerSlashCommandSearchResult
  | readonly MessageComposerSlashCommandItem[]
  | Promise<MessageComposerSlashCommandSearchResult | readonly MessageComposerSlashCommandItem[]>;

export interface MessageComposerSlashCommandProvider {
  search: MessageComposerSlashCommandChildrenProvider;
}

export interface MessageComposerSlashCommandExecutionContext {
  engine: Engine;
  editor: LexicalEditor;
  item: MessageComposerSlashCommandItem;
  query: string;
  path: readonly MessageComposerSlashCommandItem[];
  draft: MessageComposerValue;
  addChip: (chip: MessageComposerContextChip) => void;
  removeTrigger: () => void;
  replaceTrigger: (text: string) => void;
  close: () => void;
}

export interface MessageComposerSlashCommandsConfig {
  providers: readonly MessageComposerSlashCommandProvider[];
  /** Optional UI slot pieces. Registry components can be passed here without coupling core to registry imports. */
  shelf?: ComponentType;
  chips?: ComponentType;
}

export interface MessageComposerSlashCommandMenuState {
  query: string;
  nodeKey: string;
  triggerOffset: number;
  endOffset: number;
}

function menuStatesEqual(
  a: MessageComposerSlashCommandMenuState | null,
  b: MessageComposerSlashCommandMenuState | null
) {
  if (a === null || b === null) {
    return a === b;
  }
  return (
    a.query === b.query && a.nodeKey === b.nodeKey && a.triggerOffset === b.triggerOffset && a.endOffset === b.endOffset
  );
}

function itemsEqual(a: readonly MessageComposerSlashCommandItem[], b: readonly MessageComposerSlashCommandItem[]) {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function groupsEqual(a: readonly MessageComposerSlashCommandGroup[], b: readonly MessageComposerSlashCommandGroup[]) {
  return a.length === b.length && a.every((group, index) => group === b[index]);
}

/** The active slash trigger/query run under the caret; null while the shelf is closed. */
export const slashCommandMenu$ = Cell<MessageComposerSlashCommandMenuState | null>(
  null,
  (previous, next) => previous !== undefined && menuStatesEqual(previous, next)
);

export const slashCommandPath$ = Cell<MessageComposerSlashCommandItem[]>([], (previous, next) => {
  return previous !== undefined && itemsEqual(previous, next);
});

export const slashCommandTitle$ = Cell<string | null>(null);
export const slashCommandPlaceholder$ = Cell<string | null>(null);
export const slashCommandGroups$ = Cell<MessageComposerSlashCommandGroup[]>([], (previous, next) => {
  return previous !== undefined && groupsEqual(previous, next);
});
export const slashCommandResults$ = Cell<MessageComposerSlashCommandItem[]>([], (previous, next) => {
  return previous !== undefined && itemsEqual(previous, next);
});
export const slashCommandLoading$ = Cell(false);
export const slashCommandError$ = Cell<unknown>(null);
export const slashCommandHighlight$ = Cell(0);

export const contextChips$ = Cell<MessageComposerContextChip[]>([], (previous, next) => {
  return (
    previous !== undefined && previous.length === next.length && previous.every((chip, index) => chip === next[index])
  );
});

export const moveSlashCommandHighlight$ = Stream<1 | -1>(false);
export const selectSlashCommand$ = Stream<MessageComposerSlashCommandItem>(false);
export const confirmSlashCommand$ = Trigger();
export const cancelSlashCommand$ = Trigger();

export const addContextChip$ = Stream<MessageComposerContextChip>(false);
export const removeContextChip$ = Stream<string>(false);
export const setContextChips$ = Stream<MessageComposerContextChip[]>(false);

function contextChipsFromValue(value: MessageComposerValue): MessageComposerContextChip[] {
  const chips = value.extensions?.[CONTEXT_CHIPS_EXTENSION_KEY];
  return Array.isArray(chips) ? (chips as MessageComposerContextChip[]) : [];
}

function withContextChips(value: MessageComposerValue, chips: MessageComposerContextChip[]): MessageComposerValue {
  return {
    ...value,
    extensions: {
      ...value.extensions,
      [CONTEXT_CHIPS_EXTENSION_KEY]: chips,
    },
  };
}

function publishContextChips(engine: Engine, chips: MessageComposerContextChip[]) {
  engine.pubIn({
    [contextChips$]: chips,
    [editorChange$]: withContextChips(engine.getValue(draftValue$), chips),
  });
}

e.sub(addContextChip$, (chip, engine) => {
  const current = engine.getValue(contextChips$);
  const next = current.some((entry) => entry.id === chip.id)
    ? current.map((entry) => (entry.id === chip.id ? chip : entry))
    : [...current, chip];
  publishContextChips(engine, next);
});

e.sub(removeContextChip$, (id, engine) => {
  publishContextChips(
    engine,
    engine.getValue(contextChips$).filter((chip) => chip.id !== id)
  );
});

e.sub(setContextChips$, (chips, engine) => {
  publishContextChips(engine, [...chips]);
});

e.sub(moveSlashCommandHighlight$, (delta, engine) => {
  const count = engine.getValue(slashCommandResults$).length;
  if (count === 0) {
    return;
  }
  engine.pub(slashCommandHighlight$, (engine.getValue(slashCommandHighlight$) + delta + count) % count);
});

e.sub(confirmSlashCommand$, (_, engine) => {
  const item = engine.getValue(slashCommandResults$)[engine.getValue(slashCommandHighlight$)];
  if (item) {
    engine.pub(selectSlashCommand$, item);
  }
});

const TRIGGER = "/";

function findLastSlashTrigger(text: string) {
  for (let index = text.length - 1; index >= 0; index -= 1) {
    if (text[index] !== TRIGGER) {
      continue;
    }
    if (index === 0 || /\s|\(/.test(text[index - 1])) {
      return index;
    }
  }
  return -1;
}

function $readSlashCommandMatch(): MessageComposerSlashCommandMenuState | null {
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
  const triggerOffset = findLastSlashTrigger(text);
  if (triggerOffset === -1) {
    return null;
  }
  return {
    query: text.slice(triggerOffset + 1),
    nodeKey: node.getKey(),
    triggerOffset,
    endOffset: anchor.offset,
  };
}

function $replaceSlashCommandRun(state: MessageComposerSlashCommandMenuState, replacement: string) {
  const node = $getNodeByKey(state.nodeKey);
  if (!$isTextNode(node)) {
    return false;
  }
  const size = node.getTextContentSize();
  const text = node.getTextContent();
  const start =
    replacement.length === 0 && state.triggerOffset > 0 && /\s/.test(text[state.triggerOffset - 1])
      ? state.triggerOffset - 1
      : state.triggerOffset;
  const end = Math.min(state.endOffset, size);
  const splitOffsets: number[] = [];
  if (start > 0) {
    splitOffsets.push(start);
  }
  if (end < size) {
    splitOffsets.push(end);
  }
  const pieces = splitOffsets.length > 0 ? node.splitText(...splitOffsets) : [node];
  const target = start > 0 ? pieces[1] : pieces[0];
  if (!$isTextNode(target)) {
    return false;
  }
  target.setTextContent(replacement);
  target.select(replacement.length, replacement.length);
  return true;
}

function itemPathToken(item: MessageComposerSlashCommandItem): string {
  return (item.value ?? item.id).trim();
}

function itemMatchesQuery(item: MessageComposerSlashCommandItem, query: string) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return true;
  }
  const tokens = [item.id, item.value, item.label, ...(item.keywords ?? [])]
    .filter((token): token is string => typeof token === "string")
    .map((token) => token.toLowerCase());
  return tokens.some((token) => token.includes(normalized));
}

function filterItems(items: readonly MessageComposerSlashCommandItem[], query: string) {
  return items.filter((item) => itemMatchesQuery(item, query));
}

function isCommandItemArray(
  value: MessageComposerSlashCommandSearchResult | readonly MessageComposerSlashCommandItem[]
): value is readonly MessageComposerSlashCommandItem[] {
  return Array.isArray(value);
}

function normalizeSearchResult(
  value: MessageComposerSlashCommandSearchResult | readonly MessageComposerSlashCommandItem[],
  query: string
): MessageComposerSlashCommandSearchResult {
  if (isCommandItemArray(value)) {
    return { items: filterItems(value, query) };
  }
  return value;
}

function queryForPath(query: string, path: readonly MessageComposerSlashCommandItem[]) {
  let remaining = query.trimStart();
  for (const item of path) {
    const token = itemPathToken(item);
    if (token.length === 0 || !remaining.toLowerCase().startsWith(token.toLowerCase())) {
      return "";
    }
    remaining = remaining.slice(token.length).trimStart();
  }
  return remaining;
}

function commandCanDrill(item: MessageComposerSlashCommandItem) {
  return item.children !== undefined;
}

async function resolveChildren(
  item: MessageComposerSlashCommandItem,
  request: MessageComposerSlashCommandRequest,
  signal: AbortSignal
) {
  const children = item.children;
  if (!children) {
    return { items: [] };
  }
  if (typeof children === "function") {
    return normalizeSearchResult(await children(request, signal), request.query);
  }
  return normalizeSearchResult(children, request.query);
}

async function resolveTopLevel(
  providers: readonly MessageComposerSlashCommandProvider[],
  request: MessageComposerSlashCommandRequest,
  signal: AbortSignal
) {
  const results = await Promise.all(providers.map((provider) => Promise.resolve(provider.search(request, signal))));
  const normalized = results.map((result) => normalizeSearchResult(result, request.query));
  return {
    groups: normalized.flatMap((result) => result.groups ?? []),
    items: normalized.flatMap((result) => result.items),
    placeholder: normalized.find((result) => result.placeholder !== undefined)?.placeholder,
    title: normalized.find((result) => result.title !== undefined)?.title,
  };
}

function autoDrillItem(
  query: string,
  items: readonly MessageComposerSlashCommandItem[]
): MessageComposerSlashCommandItem | null {
  const normalized = query.trimStart().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }
  return (
    items.find((item) => {
      if (!commandCanDrill(item)) {
        return false;
      }
      const token = itemPathToken(item).toLowerCase();
      return normalized === token || normalized.startsWith(`${token} `);
    }) ?? null
  );
}

function clearSlashCommandState(engine: Engine) {
  engine.pubIn({
    [slashCommandMenu$]: null,
    [slashCommandPath$]: [],
    [slashCommandTitle$]: null,
    [slashCommandPlaceholder$]: null,
    [slashCommandGroups$]: [],
    [slashCommandResults$]: [],
    [slashCommandLoading$]: false,
    [slashCommandError$]: null,
    [slashCommandHighlight$]: 0,
  });
}

function syncContextChips(engine: Engine) {
  engine.pub(contextChips$, contextChipsFromValue(engine.getValue(draftValue$)));
}

function createContextChipsPatcher(engine: Engine): EditorValuePatcher {
  return () => {
    const chips = engine.getValue(contextChips$);
    const draft = engine.getValue(draftValue$);
    if (chips.length === 0 && draft.extensions?.[CONTEXT_CHIPS_EXTENSION_KEY] === undefined) {
      return {};
    }
    return { extensions: { ...draft.extensions, [CONTEXT_CHIPS_EXTENSION_KEY]: chips } };
  };
}

function trackSlashCommandTrigger(engine: Engine): () => void {
  let dismissed: { nodeKey: string; triggerOffset: number } | null = null;
  let cleanupEditor: (() => void) | null = null;

  const close = () => {
    clearSlashCommandState(engine);
  };

  const unsubCancel = engine.sub(cancelSlashCommand$, () => {
    const state = engine.getValue(slashCommandMenu$);
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
      const state = editor.getEditorState().read($readSlashCommandMatch);
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
      engine.pub(slashCommandMenu$, state);
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

function runSlashCommandSearchLifecycle(
  engine: Engine,
  providers: readonly MessageComposerSlashCommandProvider[]
): () => void {
  let controller: AbortController | null = null;

  const run = () => {
    controller?.abort();
    controller = null;
    const state = engine.getValue(slashCommandMenu$);
    if (!state) {
      clearSlashCommandState(engine);
      return;
    }
    const path = engine.getValue(slashCommandPath$);
    const query = queryForPath(state.query, path);
    const current = new AbortController();
    controller = current;
    engine.pubIn({ [slashCommandLoading$]: true, [slashCommandError$]: null });
    const request = { query, path };
    const promise =
      path.length === 0
        ? resolveTopLevel(providers, request, current.signal)
        : resolveChildren(path[path.length - 1], request, current.signal);
    void promise.then(
      (result) => {
        if (current.signal.aborted || engine.isDisposed) {
          return;
        }
        controller = null;
        if (path.length === 0) {
          const drill = autoDrillItem(state.query, result.items);
          if (drill) {
            engine.pub(slashCommandPath$, [drill]);
            return;
          }
        }
        engine.pubIn({
          [slashCommandTitle$]: result.title ?? path.at(-1)?.label ?? null,
          [slashCommandPlaceholder$]: result.placeholder ?? null,
          [slashCommandGroups$]: [...(result.groups ?? [])],
          [slashCommandResults$]: [...result.items],
          [slashCommandLoading$]: false,
          [slashCommandHighlight$]: 0,
        });
      },
      (error: unknown) => {
        if (current.signal.aborted || engine.isDisposed) {
          return;
        }
        controller = null;
        engine.pubIn({
          [slashCommandGroups$]: [],
          [slashCommandResults$]: [],
          [slashCommandLoading$]: false,
          [slashCommandError$]: error,
          [slashCommandHighlight$]: 0,
        });
      }
    );
  };

  const unsubMenu = engine.sub(slashCommandMenu$, run);
  const unsubPath = engine.sub(slashCommandPath$, run);

  return () => {
    controller?.abort();
    unsubMenu();
    unsubPath();
  };
}

function executeSlashCommandItem(engine: Engine, item: MessageComposerSlashCommandItem) {
  const editor = engine.getValue(lexicalEditor$);
  const state = engine.getValue(slashCommandMenu$);
  if (!editor || !state) {
    return;
  }
  const path = engine.getValue(slashCommandPath$);
  const query = queryForPath(state.query, path);
  const replaceTrigger = (text: string) => {
    editor.update(
      () => {
        $replaceSlashCommandRun(state, text);
      },
      { discrete: true, tag: HISTORY_PUSH_TAG }
    );
  };
  const context: MessageComposerSlashCommandExecutionContext = {
    engine,
    editor,
    item,
    query,
    path,
    draft: engine.getValue(draftValue$),
    addChip: (chip) => engine.pub(addContextChip$, chip),
    removeTrigger: () => replaceTrigger(""),
    replaceTrigger,
    close: () => clearSlashCommandState(engine),
  };

  const chip = typeof item.chip === "function" ? item.chip(context) : item.chip;
  if (chip) {
    engine.pub(addContextChip$, chip);
  }
  replaceTrigger(item.replacement ?? "");
  try {
    const result = item.execute?.(context);
    if (result instanceof Promise) {
      void result.catch((error: unknown) => {
        if (!engine.isDisposed) {
          engine.pub(slashCommandError$, error);
        }
      });
    }
  } catch (error) {
    engine.pub(slashCommandError$, error);
  }
  clearSlashCommandState(engine);
}

function openSlashCommandChildren(engine: Engine, item: MessageComposerSlashCommandItem) {
  const editor = engine.getValue(lexicalEditor$);
  const state = engine.getValue(slashCommandMenu$);
  if (!editor || !state) {
    return;
  }
  const path = [...engine.getValue(slashCommandPath$), item];
  const replacement = `/${path.map(itemPathToken).join(" ")} `;
  editor.update(
    () => {
      $replaceSlashCommandRun(state, replacement);
    },
    { discrete: true, tag: HISTORY_PUSH_TAG }
  );
  engine.pub(slashCommandPath$, path);
}

e.sub(selectSlashCommand$, (item, engine) => {
  if (commandCanDrill(item)) {
    openSlashCommandChildren(engine, item);
    return;
  }
  executeSlashCommandItem(engine, item);
});

function SlashCommandKeyboardPlugin() {
  const [editor] = useLexicalComposerContext();
  const engine = useEngine();

  useEffect(() => {
    const menuHasResults = () =>
      engine.getValue(slashCommandMenu$) !== null && engine.getValue(slashCommandResults$).length > 0;
    const menuIsOpen = () => engine.getValue(slashCommandMenu$) !== null;
    const unsubs = [
      editor.registerCommand<KeyboardEvent>(
        KEY_ARROW_DOWN_COMMAND,
        (event) => {
          if (!menuHasResults()) {
            return false;
          }
          event.preventDefault();
          engine.pub(moveSlashCommandHighlight$, 1);
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
          engine.pub(moveSlashCommandHighlight$, -1);
          return true;
        },
        COMMAND_PRIORITY_CRITICAL
      ),
      editor.registerCommand<KeyboardEvent>(
        KEY_DOWN_COMMAND,
        (event) => {
          if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
            return false;
          }
          const key = event.key.toLowerCase();
          if ((key !== "n" && key !== "p") || !menuHasResults()) {
            return false;
          }
          event.preventDefault();
          engine.pub(moveSlashCommandHighlight$, key === "n" ? 1 : -1);
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
          engine.pub(confirmSlashCommand$, undefined);
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
          engine.pub(confirmSlashCommand$, undefined);
          return true;
        },
        COMMAND_PRIORITY_CRITICAL
      ),
      editor.registerCommand<KeyboardEvent>(
        KEY_ESCAPE_COMMAND,
        (event) => {
          if (!menuIsOpen()) {
            return false;
          }
          event.preventDefault();
          engine.pub(cancelSlashCommand$, undefined);
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

function createHeader(Shelf: ComponentType | undefined, Chips: ComponentType | undefined): ComponentType {
  function SlashCommandsHeader() {
    return (
      <>
        {Shelf ? <Shelf /> : null}
        {Chips ? <Chips /> : null}
      </>
    );
  }
  return SlashCommandsHeader;
}

export function slashCommandsPlugin(config: MessageComposerSlashCommandsConfig): MessageComposerPlugin {
  return {
    id: "slash-commands",
    lexicalPlugins: [SlashCommandKeyboardPlugin],
    slots: config.shelf || config.chips ? { header: createHeader(config.shelf, config.chips) } : undefined,
    init: ({ engine }) => {
      engine.pubIn({
        [contextChips$]: contextChipsFromValue(engine.getValue(draftValue$)),
        [editorValuePatchers$]: [...engine.getValue(editorValuePatchers$), createContextChipsPatcher(engine)],
      });
      const cleanups = [
        trackSlashCommandTrigger(engine),
        runSlashCommandSearchLifecycle(engine, config.providers),
        engine.sub(draftValue$, () => syncContextChips(engine)),
      ];
      return () => {
        for (const cleanup of cleanups) {
          cleanup();
        }
      };
    },
  };
}
