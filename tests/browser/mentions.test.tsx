import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { CustomUI, RegistryUI } from "../../src/stories/mentions.stories.tsx";

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

test("typing a trigger opens the menu with async results", async () => {
  const screen = renderStory(<RegistryUI />);
  const textbox = screen.getByRole("textbox");

  await textbox.click();
  await userEvent.keyboard("ping @ada");

  await expect.element(page.getByRole("button", { name: "Ada Lovelace" })).toBeVisible();
});

test("keyboard navigation selects a mention and enter does not submit", async () => {
  const screen = renderStory(<RegistryUI />);
  const textbox = screen.getByRole("textbox");

  await textbox.click();
  await userEvent.keyboard("@a");
  await expect.element(page.getByRole("button", { name: "Alan Turing" })).toBeVisible();

  await userEvent.keyboard("{ArrowDown}");
  await userEvent.keyboard("{Enter}");

  await expect.element(textbox).toHaveTextContent("@Alan Turing");
  await expect.element(page.getByRole("button", { name: "Alan Turing" })).not.toBeInTheDocument();
  await expect.element(screen.getByTestId("submitted")).toHaveTextContent("null");

  await userEvent.keyboard("hi{Enter}");

  const submitted = screen.getByTestId("submitted");
  await expect.element(submitted).toHaveTextContent('"markdown":"[@Alan Turing](mention:u2) hi"');
  await expect.element(submitted).toHaveTextContent('"mentions":[{"id":"u2","trigger":"@","label":"Alan Turing"}]');
});

test("pointer selection inserts the clicked mention", async () => {
  const screen = renderStory(<RegistryUI />);
  const textbox = screen.getByRole("textbox");

  await textbox.click();
  await userEvent.keyboard("@gr");

  await page.getByRole("button", { name: "Grace Hopper" }).click();

  await expect.element(textbox).toHaveTextContent("@Grace Hopper");
  await expect.element(page.getByRole("button", { name: "Grace Hopper" })).not.toBeInTheDocument();
});

test("backspace deletes the mention as a unit", async () => {
  const screen = renderStory(<RegistryUI />);
  const textbox = screen.getByRole("textbox");

  await textbox.click();
  await userEvent.keyboard("@ada");
  await page.getByRole("button", { name: "Ada Lovelace" }).click();
  await expect.element(textbox).toHaveTextContent("@Ada Lovelace");

  await userEvent.keyboard("{Backspace}{Backspace}");

  await expect.element(textbox).not.toHaveTextContent("@Ada Lovelace");
  await expect.element(textbox).not.toHaveTextContent("Lovelace");
});

test("escape dismisses the menu until a new trigger run", async () => {
  const screen = renderStory(<RegistryUI />);
  const textbox = screen.getByRole("textbox");

  await textbox.click();
  await userEvent.keyboard("@ada");
  await expect.element(page.getByRole("button", { name: "Ada Lovelace" })).toBeVisible();

  await userEvent.keyboard("{Escape}");
  await expect.element(page.getByRole("button", { name: "Ada Lovelace" })).not.toBeInTheDocument();

  // The dismissed trigger run stays closed while typing continues...
  await userEvent.keyboard("x");
  await expect.element(page.getByRole("button", { name: "Ada Lovelace" })).not.toBeInTheDocument();

  // ...but a fresh trigger opens again.
  await userEvent.keyboard(" @gra");
  await expect.element(page.getByRole("button", { name: "Grace Hopper" })).toBeVisible();
});

test("custom UI rehydrates mention markdown and drives the same contracts", async () => {
  const screen = renderStory(<CustomUI />);
  const textbox = screen.getByRole("textbox");

  // The defaultValue mention markdown renders through the custom token.
  await expect.element(screen.getByTestId("custom-mention-token")).toHaveTextContent("@Ada Lovelace");

  await textbox.click();
  await userEvent.keyboard(" see @alan");
  await page.getByRole("button", { name: "Alan Turing" }).click();
  await expect.element(screen.getByTestId("custom-mention-menu")).not.toBeInTheDocument();

  await userEvent.keyboard("{Enter}");

  const submitted = screen.getByTestId("submitted");
  await expect.element(submitted).toHaveTextContent('"mentions":[{"id":"u1","trigger":"@","label":"Ada Lovelace"}');
  await expect.element(submitted).toHaveTextContent('{"id":"u2","trigger":"@","label":"Alan Turing"}]');
});
