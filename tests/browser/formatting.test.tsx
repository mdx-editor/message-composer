import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { CustomUI, Toolbar } from "../../src/stories/formatting.stories.tsx";

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

test("lists render with visible markers despite the Tailwind preflight reset", async () => {
  const screen = renderStory(<Toolbar />);
  const textbox = screen.getByRole("textbox");

  await userEvent.type(textbox, "- item");
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"* item"');

  const list = textbox.element().querySelector("ul");
  expect(list).toBeTruthy();
  const listStyle = getComputedStyle(list as HTMLUListElement);
  expect(listStyle.listStyleType).toBe("disc");
  expect(parseFloat(listStyle.paddingLeft)).toBeGreaterThan(0);

  // Enter submits in the composer, so switch the list type through the toolbar
  // instead of starting a fresh block.
  await screen.getByRole("button", { name: "Numbered list" }).click();
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"1. item"');
  const ordered = textbox.element().querySelector("ol");
  expect(ordered).toBeTruthy();
  expect(getComputedStyle(ordered as HTMLOListElement).listStyleType).toBe("decimal");
});

test("shift+enter creates the next list item and exits the list on an empty one", async () => {
  const screen = renderStory(<Toolbar />);
  const textbox = screen.getByRole("textbox");

  await userEvent.type(textbox, "- first");
  await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
  await userEvent.keyboard("second");
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"* first\\n* second"');

  // Shift+Enter on the resulting empty item leaves the list.
  await userEvent.keyboard("{Shift>}{Enter}{/Shift}{Shift>}{Enter}{/Shift}");
  await userEvent.keyboard("outside");
  await expect
    .element(screen.getByTestId("last-change"))
    .toHaveTextContent('"markdown":"* first\\n* second\\n\\noutside"');
  await expect.element(screen.getByRole("button", { name: "Bullet list" })).toHaveAttribute("aria-pressed", "false");
});

test("toolbar clicks keep focus and selection in the editor", async () => {
  const screen = renderStory(<Toolbar />);
  const textbox = screen.getByRole("textbox");

  await userEvent.type(textbox, "focus");
  await screen.getByRole("button", { name: "Quote" }).click();
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"> focus"');

  // mousedown is prevented on the toolbar, so the editor never lost focus and
  // typing continues without clicking back in.
  expect(document.activeElement).toBe(textbox.element());
  await userEvent.keyboard(" kept");
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"> focus kept"');
});

test("the toolbar navigates between controls with arrow keys", async () => {
  const screen = renderStory(<Toolbar />);
  const boldButton = screen.getByRole("button", { name: "Bold" });
  await expect.element(boldButton).toBeVisible();

  (boldButton.element() as HTMLElement).focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Italic");
  await userEvent.keyboard("{ArrowRight}");
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Strikethrough");
  await userEvent.keyboard("{ArrowLeft}");
  expect(document.activeElement?.getAttribute("aria-label")).toBe("Italic");
});

test("custom unstyled toolbar drives the same contracts, including links", async () => {
  const screen = renderStory(<CustomUI />);
  const textbox = screen.getByRole("textbox");

  await userEvent.type(textbox, "custom");
  await userEvent.keyboard("{Home}{Shift>}{End}{/Shift}");
  await screen.getByRole("button", { name: "Bold" }).click();
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"**custom**"');
  await expect.element(screen.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "true");

  await screen.getByRole("button", { name: "Link" }).click();
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent("https://example.com");
});
