import { Cell } from "@virtuoso.dev/reactive-engine-core";
import type { LexicalEditor } from "lexical";

/**
 * Advanced escape hatch: the live Lexical editor instance of this composer engine.
 * Null until the editor surface mounts. Lives in the lexical layer so the core
 * node graph stays free of Lexical imports.
 */
export const lexicalEditor$ = Cell<LexicalEditor | null>(null);
