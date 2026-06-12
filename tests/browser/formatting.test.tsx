import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { Toolbar } from "../../src/stories/formatting.stories.tsx";

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

test("toolbar click applies bold, reflects active state, and serializes to markdown", async () => {
  const screen = renderStory(<Toolbar />);
  const textbox = screen.getByRole("textbox");
  const boldButton = screen.getByRole("button", { name: "Bold" });

  await userEvent.type(textbox, "hello");
  await userEvent.keyboard("{Home}{Shift>}{End}{/Shift}");

  await boldButton.click();
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"**hello**"');
  await expect.element(boldButton).toHaveAttribute("aria-pressed", "true");

  await boldButton.click();
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"hello"');
  await expect.element(boldButton).toHaveAttribute("aria-pressed", "false");
});

test("keyboard shortcuts toggle bold and italic", async () => {
  const screen = renderStory(<Toolbar />);
  const textbox = screen.getByRole("textbox");
  // Pressing the non-native modifier is not a no-op: Ctrl+b on macOS is a Cocoa
  // caret-movement binding that collapses the selection. Use the platform's own.
  const mod = navigator.platform.startsWith("Mac") ? "Meta" : "Control";

  await userEvent.type(textbox, "shortcut");
  await userEvent.keyboard("{Home}{Shift>}{End}{/Shift}");

  await userEvent.keyboard(`{${mod}>}b{/${mod}}`);
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"**shortcut**"');
  await expect.element(screen.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "true");

  await userEvent.keyboard(`{${mod}>}i{/${mod}}`);
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"***shortcut***"');
});

test("block toggles switch between quote, list, and paragraph", async () => {
  const screen = renderStory(<Toolbar />);
  const textbox = screen.getByRole("textbox");
  const quoteButton = screen.getByRole("button", { name: "Quote" });

  await userEvent.type(textbox, "blocky");

  await quoteButton.click();
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"> blocky"');
  await expect.element(quoteButton).toHaveAttribute("aria-pressed", "true");

  await quoteButton.click();
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"blocky"');

  const bulletButton = screen.getByRole("button", { name: "Bullet list" });
  await bulletButton.click();
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"* blocky"');
  await expect.element(bulletButton).toHaveAttribute("aria-pressed", "true");
});

test("typing markdown shortcuts converts syntax while typing", async () => {
  const screen = renderStory(<Toolbar />);
  const textbox = screen.getByRole("textbox");

  await userEvent.type(textbox, "**bold**");
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"**bold**"');

  // The conversion intentionally leaves the caret outside the bold format so
  // continued typing stays plain.
  await userEvent.keyboard(" plain");
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"**bold** plain"');
});

test("list markdown shortcut converts a leading dash", async () => {
  const screen = renderStory(<Toolbar />);
  const textbox = screen.getByRole("textbox");

  await userEvent.type(textbox, "- item");

  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"* item"');
  await expect.element(screen.getByRole("button", { name: "Bullet list" })).toHaveAttribute("aria-pressed", "true");
});
