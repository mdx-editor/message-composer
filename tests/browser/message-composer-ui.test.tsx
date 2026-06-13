import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { MessageComposer } from "../../registry/components/message-composer/message-composer.tsx";
import { createEmptyMessageComposerValue } from "../../src/index.ts";

import "../../src/stories/tailwind.css";

let root: Root | undefined;
let container: HTMLElement | undefined;

afterEach(() => {
  root?.unmount();
  container?.remove();
});

function renderStory(node: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  root.render(<StrictMode>{node}</StrictMode>);
  return page.elementLocator(container);
}

test("registry composer aligns the placeholder with the editable padding", async () => {
  const screen = renderStory(<MessageComposer editorProps={{ "aria-label": "Message", placeholder: "Write..." }} />);
  const textbox = screen.getByRole("textbox");

  await expect.element(textbox).toBeVisible();

  const editable = container?.querySelector('[contenteditable="true"]');
  const placeholder = container?.querySelector(".message-composer-placeholder");

  expect(editable).toBeInstanceOf(HTMLElement);
  expect(placeholder).toBeInstanceOf(HTMLElement);
  expect(Number.parseFloat(getComputedStyle(editable as HTMLElement).paddingLeft)).toBe(12);
  expect(Number.parseFloat(getComputedStyle(editable as HTMLElement).paddingTop)).toBe(8);
  expect(Number.parseFloat(getComputedStyle(placeholder as HTMLElement).left)).toBe(12);
  expect(Number.parseFloat(getComputedStyle(placeholder as HTMLElement).top)).toBe(8);
  expect(getComputedStyle(placeholder as HTMLElement).opacity).toBe("1");
});

test("registry composer gives inline and block code visible surfaces", async () => {
  const screen = renderStory(
    <MessageComposer
      defaultValue={{
        ...createEmptyMessageComposerValue(),
        markdown: "Before `code` after\n\n```\n```",
      }}
      editorProps={{ "aria-label": "Message" }}
    />
  );
  const textbox = screen.getByRole("textbox");

  await expect.element(textbox).toBeVisible();

  const inlineCode = textbox.element().querySelector("code:not(pre code)");
  const codeBlock = textbox.element().querySelector(':scope > code[spellcheck="false"]');

  expect(inlineCode).toBeInstanceOf(HTMLElement);
  expect(codeBlock).toBeInstanceOf(HTMLElement);

  const inlineCodeStyle = getComputedStyle(inlineCode as HTMLElement);
  const codeBlockStyle = getComputedStyle(codeBlock as HTMLElement);

  expect(inlineCodeStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(Number.parseFloat(inlineCodeStyle.borderRadius)).toBeGreaterThan(0);
  expect(Number.parseFloat(inlineCodeStyle.paddingLeft)).toBeGreaterThan(0);
  expect(codeBlockStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(Number.parseFloat(codeBlockStyle.borderRadius)).toBeGreaterThan(0);
  expect(Number.parseFloat(codeBlockStyle.paddingLeft)).toBeGreaterThan(0);
  expect(Number.parseFloat(codeBlockStyle.minHeight)).toBeGreaterThan(0);
});
