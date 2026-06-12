import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { createHeadlessEditor } from "@lexical/headless";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { QuoteNode } from "@lexical/rich-text";
import { act, cleanup, render } from "@testing-library/react";
import { $createParagraphNode, $createTextNode, $isParagraphNode, type ElementNode, type ParagraphNode } from "lexical";
import type * as Mdast from "mdast";
import { afterEach, describe, expect, test } from "vite-plus/test";

import {
  lexicalEditor$,
  MessageComposer,
  setMarkdown$,
  useEngineRef,
  type EngineRef,
  type MessageComposerFeature,
} from "../src/index.ts";
import { $exportMarkdown, $importMarkdown } from "../src/lexical/markdown.ts";
import type { LexicalExportVisitor, ToMarkdownExtension } from "../src/lexical/mdast/exportMarkdownFromLexical.ts";
import type { MdastImportVisitor } from "../src/lexical/mdast/importMarkdownToLexical.ts";
import { exportVisitors$, importVisitors$, toMarkdownExtensions$ } from "../src/lexical/mdast/registry.ts";

afterEach(cleanup);

const EDITOR_NODES = [CodeNode, CodeHighlightNode, ListNode, ListItemNode, QuoteNode, LinkNode];

function roundTrip(markdown: string): string {
  const editor = createHeadlessEditor({
    namespace: "round-trip",
    nodes: EDITOR_NODES,
    onError: (error: Error) => {
      throw error;
    },
  });
  editor.update(
    () => {
      $importMarkdown(markdown);
    },
    { discrete: true }
  );
  return editor.read(() => $exportMarkdown());
}

describe("round-trip stability for the MVP subset", () => {
  const cases: [string, string][] = [
    ["plain text", "hello world"],
    ["bold", "**hello**"],
    ["italic", "*hello*"],
    ["bold italic", "***hello***"],
    ["strikethrough", "~~gone~~"],
    ["inline code", "`code()`"],
    ["mixed inline formats", "plain **bold** and *italic* with `code` and ~~struck~~ text"],
    ["soft line break", "line one\nline two"],
    ["multiple paragraphs", "first paragraph\n\nsecond paragraph"],
    ["unordered list", "* one\n* two\n* three"],
    ["ordered list", "1. first\n2. second"],
    ["nested list", "* parent\n  * child one\n  * child two"],
    ["blockquote", "> quoted text"],
    ["multi-paragraph blockquote", "> first\n>\n> second"],
    ["fenced code block", "```\nconst x = 1;\n```"],
    ["fenced code block with language", "```ts\nconst x: number = 1;\n```"],
    ["multi-line code block", "```\nline one\n\nline three\n```"],
    ["link", "[docs](https://example.com)"],
    ["link with title", '[docs](https://example.com "Example")'],
    ["formatted text inside list items", "* **bold item**\n* plain with *italic* tail"],
    ["quote containing a list", "> intro\n>\n> * one\n> * two"],
    ["empty document", ""],
  ];

  for (const [name, markdown] of cases) {
    test(`${name}: import → export is identity`, () => {
      expect(roundTrip(markdown)).toBe(markdown);
    });
  }

  test("export is a fixed point: exporting an imported export changes nothing", () => {
    const source = "para **with bold**\n\n* item *one*\n* item `two`\n\n> quote\n\n```js\ncode();\n```";
    const once = roundTrip(source);
    expect(roundTrip(once)).toBe(once);
  });
});

describe("dialect normalization and degradation", () => {
  test("dash bullets normalize to the adopted dialect", () => {
    expect(roundTrip("- one\n- two")).toBe("* one\n* two");
  });

  test("underscore emphasis normalizes to star markers", () => {
    expect(roundTrip("__bold__ and _italic_")).toBe("**bold** and *italic*");
  });

  test("unsupported constructs degrade to readable text instead of throwing", () => {
    expect(roundTrip("# heading text")).toBe("heading text");
    expect(roundTrip("para\n\n---\n\npara two")).toBe("para\n\npara two");
  });
});

test("a feature-registered import visitor reaches the conversion", async () => {
  const ThematicBreakVisitor: MdastImportVisitor<Mdast.RootContent> = {
    priority: 10,
    testNode: "thematicBreak",
    visitNode({ lexicalParent }) {
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode("[horizontal rule]"));
      (lexicalParent as ElementNode).append(paragraph);
    },
  };

  const extensionFeature: MessageComposerFeature = {
    id: "test-extension",
    init: ({ engine }) => {
      engine.pub(importVisitors$, [ThematicBreakVisitor, ...engine.getValue(importVisitors$)]);
    },
  };

  const captured: { engineRef: EngineRef | null } = { engineRef: null };
  const Host = () => {
    const engineRef = useEngineRef();
    captured.engineRef = engineRef;
    return <MessageComposer engineRef={engineRef} features={[extensionFeature]} />;
  };
  const { container } = render(<Host />);
  const engine = captured.engineRef?.current;
  if (!engine) {
    throw new Error("engine not mounted");
  }
  expect(engine.getValue(lexicalEditor$)).not.toBeNull();

  await act(async () => {
    engine.pub(setMarkdown$, "above\n\n---\n\nbelow");
    await Promise.resolve();
  });

  expect(container.querySelector("[contenteditable]")?.textContent).toContain("[horizontal rule]");
});

test("a feature-registered export visitor reaches the conversion", () => {
  const ParagraphExportVisitor: LexicalExportVisitor<ParagraphNode, Mdast.Paragraph> = {
    priority: 10,
    testLexicalNode: $isParagraphNode,
    visitLexicalNode({ actions, lexicalNode, mdastParent }) {
      actions.appendToParent(mdastParent, {
        type: "paragraph",
        children: [{ type: "text", value: `exported: ${lexicalNode.getTextContent()}` }],
      });
    },
  };

  const extensionFeature: MessageComposerFeature = {
    id: "test-export-extension",
    init: ({ engine }) => {
      engine.pub(exportVisitors$, [
        ParagraphExportVisitor as LexicalExportVisitor<never, never>,
        ...engine.getValue(exportVisitors$),
      ]);
    },
  };

  const captured: { engineRef: EngineRef | null } = { engineRef: null };
  const Host = () => {
    const engineRef = useEngineRef();
    captured.engineRef = engineRef;
    return (
      <MessageComposer
        engineRef={engineRef}
        features={[extensionFeature]}
        defaultValue={{ markdown: "hello", attachments: [], mentions: [], audioClips: [] }}
      />
    );
  };
  render(<Host />);
  const engine = captured.engineRef?.current;
  const editor = engine?.getValue(lexicalEditor$);
  if (!engine || !editor) {
    throw new Error("composer not mounted");
  }

  expect(editor.getEditorState().read(() => $exportMarkdown())).toBe("hello");
  expect(
    editor.getEditorState().read(() =>
      $exportMarkdown({
        importVisitors: engine.getValue(importVisitors$),
        exportVisitors: engine.getValue(exportVisitors$),
        syntaxExtensions: [],
        mdastExtensions: [],
        toMarkdownExtensions: engine.getValue(toMarkdownExtensions$),
        toMarkdownOptions: {},
      })
    )
  ).toBe("exported: hello");
});

test("feature-registered export visitors can pair with toMarkdown extensions", () => {
  interface TestInlineNode extends Mdast.Literal {
    type: "testInline";
    value: string;
  }

  const TestInlineExportVisitor: LexicalExportVisitor<ParagraphNode, Mdast.Paragraph> = {
    priority: 10,
    testLexicalNode: $isParagraphNode,
    visitLexicalNode({ actions, lexicalNode, mdastParent }) {
      actions.appendToParent(mdastParent, {
        type: "paragraph",
        children: [{ type: "testInline", value: lexicalNode.getTextContent() } as unknown as Mdast.PhrasingContent],
      });
    },
  };

  const TestInlineToMarkdownExtension: ToMarkdownExtension = {
    handlers: {
      testInline(node: TestInlineNode) {
        return `[[${node.value}]]`;
      },
    } as never,
  };

  const extensionFeature: MessageComposerFeature = {
    id: "test-to-markdown-extension",
    init: ({ engine }) => {
      engine.pub(exportVisitors$, [
        TestInlineExportVisitor as LexicalExportVisitor<never, never>,
        ...engine.getValue(exportVisitors$),
      ]);
      engine.pub(toMarkdownExtensions$, [TestInlineToMarkdownExtension, ...engine.getValue(toMarkdownExtensions$)]);
    },
  };

  const captured: { engineRef: EngineRef | null } = { engineRef: null };
  const Host = () => {
    const engineRef = useEngineRef();
    captured.engineRef = engineRef;
    return (
      <MessageComposer
        engineRef={engineRef}
        features={[extensionFeature]}
        defaultValue={{ markdown: "custom", attachments: [], mentions: [], audioClips: [] }}
      />
    );
  };
  render(<Host />);
  const engine = captured.engineRef?.current;
  const editor = engine?.getValue(lexicalEditor$);
  if (!engine || !editor) {
    throw new Error("composer not mounted");
  }

  expect(
    editor.getEditorState().read(() =>
      $exportMarkdown({
        importVisitors: engine.getValue(importVisitors$),
        exportVisitors: engine.getValue(exportVisitors$),
        syntaxExtensions: [],
        mdastExtensions: [],
        toMarkdownExtensions: engine.getValue(toMarkdownExtensions$),
        toMarkdownOptions: {},
      })
    )
  ).toBe("[[custom]]");
});
