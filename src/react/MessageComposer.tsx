import { EngineProvider, type EngineRef } from "@virtuoso.dev/reactive-engine-react";
import { forwardRef, useRef, useState, type ReactElement, type Ref, type RefAttributes } from "react";

import {
  controlled$,
  disabled$,
  draftValue$,
  submitHandler$,
  valueChange$,
  type MessageComposerSubmitHandler,
} from "../core/nodes.ts";
import type { MessageComposerPlugin, MessageComposerSlots } from "../core/plugin.ts";
import { createEmptyMessageComposerValue, type MessageComposerValue } from "../core/value.ts";
import {
  MessageComposerLexical,
  type MessageComposerEditorProps,
  type MessageComposerHandle,
} from "../lexical/MessageComposerLexical.tsx";

export type { MessageComposerEditorProps, MessageComposerHandle };

export interface MessageComposerProps<TValue extends MessageComposerValue = MessageComposerValue> {
  value?: TValue;
  defaultValue?: TValue;
  onValueChange?: (value: TValue) => void;
  onSubmit?: (value: TValue) => void | Promise<void>;
  disabled?: boolean;
  editorProps?: MessageComposerEditorProps;
  /**
   * Optional behavior modules, fixed for the component lifetime: the array is
   * captured on first render, like Lexical's initial config. Use `slots` for
   * UI that needs to change between renders.
   */
  plugins?: MessageComposerPlugin[];
  slots?: Partial<MessageComposerSlots>;
  engineId?: string;
  engineRef?: EngineRef;
}

const noop = () => {};

function MessageComposerImpl<TValue extends MessageComposerValue = MessageComposerValue>(
  {
    value,
    defaultValue,
    onValueChange,
    onSubmit,
    disabled = false,
    editorProps,
    plugins,
    slots,
    engineId,
    engineRef,
  }: MessageComposerProps<TValue>,
  ref: Ref<MessageComposerHandle>
) {
  const isControlled = value !== undefined;
  const [stablePlugins] = useState(() => plugins ?? []);

  const initialModeRef = useRef(isControlled);
  if (initialModeRef.current !== isControlled) {
    initialModeRef.current = isControlled;
    console.warn(
      "MessageComposer: switching between controlled and uncontrolled mode is unsupported. " +
        "Use either `value` or `defaultValue` for the lifetime of the component."
    );
  }

  return (
    <EngineProvider
      // initWith identity doubles as the engine identity in EngineProvider's mount
      // effect; an inline object would dispose/recreate the engine on every render.
      // Seeding through initFn's pubIn avoids that, matching the data-table pattern.
      initFn={(engine) => {
        engine.pubIn({
          [controlled$]: isControlled,
          [disabled$]: disabled,
          [draftValue$]: value ?? defaultValue ?? createEmptyMessageComposerValue(),
          [submitHandler$]: (onSubmit as MessageComposerSubmitHandler | undefined) ?? null,
        });
        for (const plugin of stablePlugins) {
          const cleanup = plugin.init?.({ engine });
          if (cleanup) {
            engine.onDispose(cleanup);
          }
        }
      }}
      updateFn={(engine) => {
        engine.pubIn({
          [controlled$]: isControlled,
          [disabled$]: disabled,
          [submitHandler$]: (onSubmit as MessageComposerSubmitHandler | undefined) ?? null,
          ...(isControlled ? { [draftValue$]: value } : {}),
        });
        engine.singletonSub(
          valueChange$,
          onValueChange ? (next: MessageComposerValue) => onValueChange(next as TValue) : noop
        );
      }}
      updateDeps={[isControlled, disabled, value, onValueChange, onSubmit]}
      engineId={engineId}
      engineRef={engineRef}
    >
      <MessageComposerLexical editorProps={editorProps} handleRef={ref} plugins={stablePlugins} slots={slots} />
    </EngineProvider>
  );
}

const MessageComposerForwardRef = forwardRef(MessageComposerImpl);
MessageComposerForwardRef.displayName = "MessageComposer";

export const MessageComposer = MessageComposerForwardRef as <
  TValue extends MessageComposerValue = MessageComposerValue,
>(
  props: MessageComposerProps<TValue> & RefAttributes<MessageComposerHandle>
) => ReactElement | null;
