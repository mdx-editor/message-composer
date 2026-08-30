import { addNodeInit, Cell, DerivedCell, e, Stream, Trigger } from "@virtuoso.dev/reactive-engine-core";

import {
  createEmptyMessageComposerValue,
  type MessageComposerAgentValue,
  type MessageComposerAttachment,
  type MessageComposerAudioClip,
  type MessageComposerMention,
  type MessageComposerValue,
} from "./value.ts";

export type MessageComposerSubmitHandler = (value: MessageComposerValue) => void | Promise<void>;

export interface MessageComposerSubmitBlocker {
  /** Stable owner-defined identity used to update or clear this blocker. */
  id: string;
  /** Accessible explanation suitable for custom submit UI. */
  message: string;
}

/** Canonical draft value. In controlled mode it mirrors the host `value` prop. */
export const draftValue$ = Cell<MessageComposerValue>(createEmptyMessageComposerValue());

/**
 * Strict-controlled mode gate (ADR 0003). When true, editor changes only emit
 * through `valueChange$`; the draft updates exclusively from the host `value` prop.
 */
export const controlled$ = Cell(false);

export const disabled$ = Cell(false);
export const submitting$ = Cell(false);
export const submitError$ = Cell<unknown>(null);

/** Adds or replaces one submit blocker by its stable id. */
export const setSubmitBlocker$ = Stream<MessageComposerSubmitBlocker>(false);

/** Clears one submit blocker by id. */
export const clearSubmitBlocker$ = Stream<string>(false);

const submitBlockerRegistry$ = Cell<ReadonlyMap<string, MessageComposerSubmitBlocker>>(new Map());

/** Active blockers in deterministic insertion order. */
export const submitBlockers$ = DerivedCell<readonly MessageComposerSubmitBlocker[]>(
  [],
  e.pipe(
    submitBlockerRegistry$,
    e.map((registry) => [...registry.values()])
  )
);

export const markdown$ = DerivedCell(
  "",
  e.pipe(
    draftValue$,
    e.map((value) => value.markdown)
  )
);

export const attachments$ = DerivedCell<MessageComposerAttachment[]>(
  [],
  e.pipe(
    draftValue$,
    e.map((value) => value.attachments)
  )
);

export const mentions$ = DerivedCell<MessageComposerMention[]>(
  [],
  e.pipe(
    draftValue$,
    e.map((value) => value.mentions)
  )
);

export const audioClips$ = DerivedCell<MessageComposerAudioClip[]>(
  [],
  e.pipe(
    draftValue$,
    e.map((value) => value.audioClips)
  )
);

export const agent$ = DerivedCell<MessageComposerAgentValue | undefined>(
  undefined,
  e.pipe(
    draftValue$,
    e.map((value) => value.agent)
  )
);

/** Draft edits originating from the editor surface or external controls. */
export const editorChange$ = Stream<MessageComposerValue>();

/** Replaces the markdown of the current draft, preserving structured metadata. */
export const setMarkdown$ = Stream<string>();

/**
 * Partial draft updates from the editor bridge: the exported markdown plus any
 * plugin-derived fields (e.g. the mentions sidecar), applied in one emission
 * so the value never carries markdown and metadata from different documents.
 */
export const editorPatch$ = Stream<Partial<MessageComposerValue>>();

export const submit$ = Trigger();
export const reset$ = Trigger();

/** Every value that should reach the host's `onValueChange`. */
export const valueChange$ = Stream<MessageComposerValue>();

/** Host-provided submit handler, bridged from the `onSubmit` prop. */
export const submitHandler$ = Cell<MessageComposerSubmitHandler | null>(null);

// Derived projections activate lazily and would miss emissions that happen before
// their first read. Registering them with the draft cell keeps the exported
// projections consistent for late readers (remote hooks, tests, external controls).
addNodeInit((engine) => {
  engine.register(markdown$);
  engine.register(attachments$);
  engine.register(mentions$);
  engine.register(audioClips$);
  engine.register(agent$);
}, draftValue$);

// Blocker actions can fire before any UI reads the derived state. Eagerly
// registering the projection prevents it from missing those early emissions.
addNodeInit((engine) => {
  engine.register(submitBlockers$);
}, submitBlockerRegistry$);

e.sub(setSubmitBlocker$, (blocker, engine) => {
  const registry = engine.getValue(submitBlockerRegistry$);
  const current = registry.get(blocker.id);
  if (current?.message === blocker.message) {
    return;
  }
  const next = new Map(registry);
  next.set(blocker.id, blocker);
  engine.pub(submitBlockerRegistry$, next);
});

e.sub(clearSubmitBlocker$, (id, engine) => {
  const registry = engine.getValue(submitBlockerRegistry$);
  if (!registry.has(id)) {
    return;
  }
  const next = new Map(registry);
  next.delete(id);
  engine.pub(submitBlockerRegistry$, next);
});

e.link(editorChange$, valueChange$);

e.link(
  e.pipe(
    editorChange$,
    e.withLatestFrom(controlled$),
    e.filter(([, controlled]) => !controlled),
    e.map(([value]) => value)
  ),
  draftValue$
);

e.link(
  e.pipe(
    setMarkdown$,
    e.map((markdown): Partial<MessageComposerValue> => ({ markdown }))
  ),
  editorPatch$
);

e.link(
  e.pipe(
    editorPatch$,
    e.withLatestFrom(draftValue$),
    e.map(([patch, draft]) => ({ ...draft, ...patch }))
  ),
  editorChange$
);

e.sub(reset$, (_, engine) => {
  const empty = createEmptyMessageComposerValue();
  engine.pubIn(
    engine.getValue(controlled$)
      ? { [submitError$]: null, [valueChange$]: empty }
      : { [submitError$]: null, [valueChange$]: empty, [draftValue$]: empty }
  );
});

e.sub(submit$, (_, engine) => {
  if (engine.getValue(disabled$) || engine.getValue(submitting$) || engine.getValue(submitBlockers$).length > 0) {
    return;
  }
  engine.pub(submitError$, null);
  const handler = engine.getValue(submitHandler$);
  if (!handler) {
    return;
  }
  let result: void | Promise<void>;
  try {
    result = handler(engine.getValue(draftValue$));
  } catch (error) {
    engine.pub(submitError$, error);
    return;
  }
  if (result instanceof Promise) {
    engine.pub(submitting$, true);
    void result.then(
      () => {
        if (!engine.isDisposed) {
          engine.pub(submitting$, false);
        }
      },
      (error: unknown) => {
        if (!engine.isDisposed) {
          engine.pubIn({ [submitting$]: false, [submitError$]: error });
        }
      }
    );
  }
});
