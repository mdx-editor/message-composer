import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { AutoLinkAndEditor } from "../../src/stories/links.stories.tsx";

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
  return page.elementLocator(document.body);
}

async function renderEditableStory(node: ReactNode) {
  const screen = renderStory(node);
  await expect.element(screen.getByRole("textbox", { name: "Message" })).toBeVisible();
  return screen;
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(input, value);
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function textTransfer(text: string): DataTransfer {
  const transfer = new DataTransfer();
  transfer.setData("text/plain", text);
  return transfer;
}

test("typing a URL auto-links it and serializes markdown", async () => {
  const screen = await renderEditableStory(<AutoLinkAndEditor />);
  const textbox = screen.getByRole("textbox", { name: "Message" });

  await userEvent.type(textbox, "https://typed.example ");

  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"<https://typed.example>"');
});

test("typing a bare domain auto-links it with an https URL", async () => {
  const screen = await renderEditableStory(<AutoLinkAndEditor />);
  const textbox = screen.getByRole("textbox", { name: "Message" });

  await userEvent.type(textbox, "google.com ");

  await expect
    .element(screen.getByTestId("last-change"))
    .toHaveTextContent('"markdown":"[google.com](https://google.com)"');
});

test("pasting a URL auto-links it and serializes markdown", async () => {
  const screen = await renderEditableStory(<AutoLinkAndEditor />);
  const textbox = screen.getByRole("textbox", { name: "Message" });

  await textbox.click();
  textbox.element().dispatchEvent(
    new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: textTransfer("https://pasted.example "),
    })
  );

  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"<https://pasted.example>"');
});

test("the link popover creates, edits, removes, and restores editor focus", async () => {
  const screen = await renderEditableStory(<AutoLinkAndEditor />);
  const textbox = screen.getByRole("textbox", { name: "Message" });
  const linkButton = screen.getByRole("button", { name: "Link" });

  await userEvent.type(textbox, "docs");
  await userEvent.keyboard("{Home}{Shift>}{End}{/Shift}");
  await linkButton.click();

  await userEvent.type(screen.getByRole("textbox", { name: "Link URL" }), "https://example.com");
  await screen.getByRole("button", { name: "Apply link" }).click();

  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"[docs](https://example.com)"');
  await expect.element(textbox).toHaveFocus();

  await userEvent.keyboard("{Home}{Shift>}{End}{/Shift}");
  await linkButton.click();
  setNativeInputValue(
    screen.getByRole("textbox", { name: "Link URL" }).element() as HTMLInputElement,
    "https://openai.com"
  );
  setNativeInputValue(screen.getByRole("textbox", { name: "Link text" }).element() as HTMLInputElement, "OpenAI");
  await screen.getByRole("button", { name: "Apply link" }).click();

  await expect
    .element(screen.getByTestId("last-change"))
    .toHaveTextContent('"markdown":"[OpenAI](https://openai.com)"');
  await expect.element(textbox).toHaveFocus();

  await userEvent.keyboard("{Home}{Shift>}{End}{/Shift}");
  await linkButton.click();
  await screen.getByRole("button", { name: "Remove link" }).click();

  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"OpenAI"');
  await expect.element(textbox).toHaveFocus();
});
