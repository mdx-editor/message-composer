import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { Controlled, ExternalControls, Uncontrolled } from "../../src/stories/core.stories.tsx";

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

test("uncontrolled story: typing and submitting flow through the value inspectors", async () => {
  const screen = renderStory(<Uncontrolled />);
  const textbox = screen.getByRole("textbox");

  await userEvent.type(textbox, "hello world");
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"hello world"');

  await userEvent.keyboard("{Enter}");
  await expect.element(screen.getByTestId("submitted")).toHaveTextContent('"markdown":"hello world"');
  await expect.element(textbox).toHaveTextContent("hello world");
});

test("shift+enter inserts a newline instead of submitting", async () => {
  const screen = renderStory(<Uncontrolled />);
  const textbox = screen.getByRole("textbox");

  await userEvent.type(textbox, "line one");
  await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
  await userEvent.keyboard("line two");

  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"line one\\nline two"');
  await expect.element(screen.getByTestId("submitted")).toHaveTextContent(/^null$/);
});

test("keyboard selection can replace existing content", async () => {
  const screen = renderStory(<Uncontrolled />);
  const textbox = screen.getByRole("textbox");

  await userEvent.type(textbox, "replace me");
  await userEvent.keyboard("{Home}{Shift>}{End}{/Shift}");
  await userEvent.keyboard("done");

  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"done"');
  await expect.element(textbox).toHaveTextContent(/^done$/);
});

test("undo keyboard shortcut restores the previous draft", async () => {
  const screen = renderStory(<Uncontrolled />);
  const textbox = screen.getByRole("textbox");

  await userEvent.type(textbox, "typo");
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"typo"');

  await userEvent.keyboard("{Meta>}z{/Meta}");
  await userEvent.keyboard("{Control>}z{/Control}");

  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":""');
});

test("pasting plain text inserts it at the caret", async () => {
  const screen = renderStory(<Uncontrolled />);
  const textbox = screen.getByRole("textbox");

  await userEvent.type(textbox, "snippet");
  await userEvent.keyboard("{Home}{Shift>}{End}{/Shift}");
  await userEvent.copy();
  await userEvent.keyboard("{End} and ");
  await userEvent.paste();

  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"snippet and snippet"');
});

test("uncontrolled story: reset clears the draft", async () => {
  const screen = renderStory(<Uncontrolled />);
  const textbox = screen.getByRole("textbox");

  await userEvent.type(textbox, "draft text");
  await screen.getByRole("button", { name: "Reset" }).click();

  await expect.element(textbox).toHaveTextContent(/^$/);
});

test("external controls stay synchronized with the editor through user interaction", async () => {
  const screen = renderStory(<ExternalControls />);
  const textbox = screen.getByRole("textbox");

  await userEvent.type(textbox, "typed in editor");
  await expect.element(screen.getByTestId("markdown-mirror")).toHaveTextContent("typed in editor");

  await screen.getByRole("button", { name: "Insert template" }).click();
  await expect.element(textbox).toHaveTextContent("Inserted from external control");
  await expect.element(screen.getByTestId("markdown-mirror")).toHaveTextContent("Inserted from external control");

  await screen.getByRole("button", { name: "Submit externally" }).click();
  await expect
    .element(screen.getByTestId("submitted"))
    .toHaveTextContent('"markdown":"Inserted from external control"');
});

test("focus returns to a usable editor after external controls", async () => {
  const screen = renderStory(<ExternalControls />);
  const textbox = screen.getByRole("textbox");

  await screen.getByRole("button", { name: "Insert template" }).click();
  await expect.element(textbox).toHaveTextContent("Inserted from external control");

  await textbox.click();
  await userEvent.keyboard("{End} plus typing");

  await expect
    .element(screen.getByTestId("markdown-mirror"))
    .toHaveTextContent("Inserted from external control plus typing");
});

test("controlled story: host buttons drive the editor and typing persists through the echo", async () => {
  const screen = renderStory(<Controlled />);
  const textbox = screen.getByRole("textbox");

  await screen.getByRole("button", { name: "Set draft" }).click();
  await expect.element(textbox).toHaveTextContent("Hello from the host");

  await textbox.click();
  await userEvent.keyboard("{End} plus typing");
  await expect.element(textbox).toHaveTextContent("Hello from the host plus typing");
  await expect.element(screen.getByTestId("value")).toHaveTextContent('"markdown":"Hello from the host plus typing"');

  await screen.getByRole("button", { name: "Clear" }).click();
  await expect.element(textbox).toHaveTextContent(/^$/);
});
