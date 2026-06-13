import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { CustomUI, RegistryUI } from "../../src/stories/slash-commands.stories.tsx";

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

test("typing slash opens the full-width grouped command shelf", async () => {
  const screen = renderStory(<RegistryUI />);
  const textbox = screen.getByRole("textbox");

  await textbox.click();
  await userEvent.keyboard("/");

  await expect.element(screen.getByText("Commands")).toBeVisible();
  await expect.element(screen.getByText("Settings")).toBeVisible();
  await expect.element(screen.getByText("Prompts")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Model" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "File" })).toBeVisible();

  const shelf = container?.querySelector<HTMLElement>('[aria-label="Slash commands"]');
  const contextPanel = container?.querySelector<HTMLElement>('[data-testid="conversation-context"]');
  const composerWrapper = shelf?.closest(".message-composer")?.parentElement;
  if (!shelf || !contextPanel || !(composerWrapper instanceof HTMLElement)) {
    throw new Error("Expected the registry command shelf to render inside the composer wrapper");
  }

  const shelfRect = shelf.getBoundingClientRect();
  const contextRect = contextPanel.getBoundingClientRect();
  const wrapperRect = composerWrapper.getBoundingClientRect();
  const leftInset = shelfRect.left - wrapperRect.left;
  const rightInset = wrapperRect.right - shelfRect.right;

  expect(shelfRect.bottom).toBeLessThan(wrapperRect.top);
  expect(shelfRect.top).toBeLessThan(contextRect.bottom);
  expect(shelfRect.bottom).toBeGreaterThan(contextRect.top);
  expect(leftInset).toBeGreaterThanOrEqual(7);
  expect(rightInset).toBeGreaterThanOrEqual(7);
  expect(Math.abs(leftInset - rightInset)).toBeLessThan(1);
});

test("typing /model drills into model choices and selection updates agent state", async () => {
  const screen = renderStory(<RegistryUI />);
  const textbox = screen.getByRole("textbox");

  await textbox.click();
  await userEvent.keyboard("/model");
  await expect.element(screen.getByRole("button", { name: "Opus 4.8" })).toBeVisible();

  await userEvent.keyboard("{ArrowDown}{Enter}");

  await expect.element(screen.getByRole("button", { name: "Opus 4.8" })).not.toBeInTheDocument();
  await expect.element(textbox).toHaveTextContent("");
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"modelId":"opus-4-8"');
});

test("prompt commands can insert starter text and add a prompt chip", async () => {
  const screen = renderStory(<RegistryUI />);
  const textbox = screen.getByRole("textbox");

  await textbox.click();
  await userEvent.keyboard("/prompt bug");
  await screen.getByRole("button", { name: "Bug report" }).click();

  await expect.element(textbox).toHaveTextContent("Bug report");
  await expect.element(screen.getByText("prompt: Bug report")).toBeVisible();
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"templateId":"bug-report"');
});

test("file commands add removable sidecar chips without changing markdown", async () => {
  const screen = renderStory(<RegistryUI />);
  const textbox = screen.getByRole("textbox");

  await textbox.click();
  await userEvent.keyboard("Keep this /file composer");
  await screen.getByRole("button", { name: "message-composer.tsx" }).click();

  await expect.element(textbox).toHaveTextContent("Keep this");
  await expect.element(screen.getByText("file: message-composer.tsx")).toBeVisible();
  await expect.element(screen.getByTestId("last-change")).toHaveTextContent('"markdown":"Keep this"');
  await expect
    .element(screen.getByTestId("last-change"))
    .toHaveTextContent('"path":"registry/components/message-composer/message-composer.tsx"');

  await screen.getByRole("button", { name: "Remove message-composer.tsx" }).click();
  await expect.element(screen.getByText("file: message-composer.tsx")).not.toBeInTheDocument();
});

test("escape dismisses the command shelf", async () => {
  const screen = renderStory(<RegistryUI />);
  const textbox = screen.getByRole("textbox");

  await textbox.click();
  await userEvent.keyboard("/");
  await expect.element(screen.getByRole("button", { name: "Model" })).toBeVisible();

  await userEvent.keyboard("{Escape}");
  await expect.element(screen.getByRole("button", { name: "Model" })).not.toBeInTheDocument();
});

test("custom UI drives the same slash command and chip contracts", async () => {
  const screen = renderStory(<CustomUI />);
  const textbox = screen.getByRole("textbox");

  await textbox.click();
  await userEvent.keyboard("/tool web");
  await screen.getByRole("button", { name: "Web search" }).click();
  await expect.element(screen.getByTestId("custom-chip-list")).toHaveTextContent("Web search");

  await userEvent.keyboard("{Enter}");
  await expect.element(screen.getByTestId("submitted")).toHaveTextContent('"toolId":"web-search"');
});
