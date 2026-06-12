import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { CustomUI, ModelEffortPicker } from "../../src/stories/agent-settings.stories.tsx";

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

test("the picker opens and selects a model with the pointer", async () => {
  const screen = renderStory(<ModelEffortPicker />);
  const modelTrigger = screen.getByRole("combobox", { name: "Model" });

  await expect.element(modelTrigger).toHaveTextContent("Fable 5");

  await modelTrigger.click();
  const option = page.getByRole("option", { name: "Opus 4.8" });
  await expect.element(option).toBeVisible();
  await option.click();

  await expect.element(modelTrigger).toHaveTextContent("Opus 4.8");
});

test("keyboard navigation selects an effort and returns focus to the trigger", async () => {
  const screen = renderStory(<ModelEffortPicker />);
  const effortTrigger = screen.getByRole("combobox", { name: "Effort" });

  await expect.element(effortTrigger).toHaveTextContent("medium");

  await effortTrigger.click();
  await expect.element(page.getByRole("option", { name: "high" })).toBeVisible();

  await userEvent.keyboard("{ArrowDown}");
  await userEvent.keyboard("{Enter}");

  await expect.element(effortTrigger).toHaveTextContent("high");
  await expect.element(effortTrigger).toHaveFocus();
});

test("the submitted payload carries the picked model and effort", async () => {
  const screen = renderStory(<ModelEffortPicker />);

  const modelTrigger = screen.getByRole("combobox", { name: "Model" });
  await modelTrigger.click();
  await page.getByRole("option", { name: "Sonnet 4.6" }).click();

  const textbox = screen.getByRole("textbox");
  await userEvent.type(textbox, "ship it");
  await userEvent.keyboard("{Enter}");

  const submitted = screen.getByTestId("submitted");
  await expect.element(submitted).toHaveTextContent('"markdown":"ship it"');
  await expect.element(submitted).toHaveTextContent('"agent":{"modelId":"sonnet-4-6","effort":"medium"}');
});

test("custom UI drives the same feature without the registry component", async () => {
  const screen = renderStory(<CustomUI />);

  const opusButton = screen.getByRole("button", { name: "Opus 4.8" });
  await opusButton.click();
  await expect.element(opusButton).toHaveAttribute("aria-pressed", "true");

  await screen.getByRole("button", { name: "high" }).click();

  const textbox = screen.getByRole("textbox");
  await userEvent.type(textbox, "custom");
  await userEvent.keyboard("{Enter}");

  await expect
    .element(screen.getByTestId("submitted"))
    .toHaveTextContent('"agent":{"modelId":"opus-4-8","effort":"high"}');
});
