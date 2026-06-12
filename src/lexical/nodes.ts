import { Cell } from "@virtuoso.dev/reactive-engine-core";
import type { LexicalEditor } from "lexical";

import type { MessageComposerValue } from "../core/value.ts";

/**
 * Advanced escape hatch: the live Lexical editor instance of this composer engine.
 * Null until the editor surface mounts. Lives in the lexical layer so the core
 * node graph stays free of Lexical imports.
 */
export const lexicalEditor$ = Cell<LexicalEditor | null>(null);

/**
 * Derives a value field from the editor document; runs inside an editor state
 * read, so `$`-prefixed Lexical functions are available. Patchers should return
 * reference-stable results when the derived field is unchanged.
 */
export type EditorValuePatcher = () => Partial<MessageComposerValue>;

/**
 * Plugin-registered derivations the bridge folds into every editor-originated
 * value emission, keeping derived fields (e.g. the mentions sidecar) atomic
 * with the markdown they were computed from.
 */
export const editorValuePatchers$ = Cell<EditorValuePatcher[]>([]);
