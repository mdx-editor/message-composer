import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { MessageComposer } from "../../registry/components/message-composer/message-composer.tsx";

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
