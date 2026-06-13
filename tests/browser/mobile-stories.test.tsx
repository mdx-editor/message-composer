import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { ActionSheet, BottomDock, CrowdedContext } from "../../src/stories/mobile.stories.tsx";

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

test("mobile bottom dock keeps the composer in a phone-sized frame", async () => {
  const screen = renderStory(<BottomDock />);

  await expect.element(screen.getByTestId("mobile-phone-frame")).toBeVisible();
  await expect.element(screen.getByRole("textbox")).toBeVisible();

  const frame = screen.getByTestId("mobile-phone-frame").element();
  expect(frame.getBoundingClientRect().width).toBeLessThanOrEqual(392);
});

test("mobile slash button invokes the real slash command shelf", async () => {
  const screen = renderStory(<BottomDock />);

  await screen.getByRole("button", { name: "Open slash commands" }).click();

  await expect.element(screen.getByText("Commands")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Model" })).toBeVisible();
});

test("mobile mention button invokes the real mention suggestions", async () => {
  const screen = renderStory(<BottomDock />);

  await screen.getByRole("button", { name: "Mention teammate" }).click();

  await expect.element(page.getByRole("button", { name: "Ada Lovelace" })).toBeVisible();
});

test("mobile action sheet shortcuts can drill into nested command choices", async () => {
  const screen = renderStory(<ActionSheet />);

  const sheet = screen.getByRole("dialog", { name: "Mobile actions" });
  await expect.element(sheet).toBeVisible();

  const composerWrapper = sheet.element().closest(".message-composer")?.parentElement;
  if (!(composerWrapper instanceof HTMLElement)) {
    throw new Error("Expected the mobile action sheet to render inside the composer wrapper");
  }
  const sheetRect = sheet.element().getBoundingClientRect();
  const wrapperRect = composerWrapper.getBoundingClientRect();
  expect(sheetRect.bottom).toBeLessThan(wrapperRect.top);
  expect(sheetRect.width).toBeGreaterThan(wrapperRect.width - 24);
  expect(wrapperRect.height).toBeLessThan(180);

  await screen.getByRole("button", { name: "Model /model" }).click();

  await expect.element(screen.getByRole("button", { name: "Fable 5" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Opus 4.8" })).toBeVisible();
});

test("crowded mobile story exposes chips and attachments in the composer dock", async () => {
  const screen = renderStory(<CrowdedContext />);

  await expect.element(screen.getByText("prompt: Release note")).toBeVisible();
  await expect.element(screen.getByText("file: onboarding-trace.txt")).toBeVisible();
  await expect.element(screen.getByText("mobile-regression.png")).toBeVisible();
  await expect.element(screen.getByRole("toolbar", { name: "Formatting" })).toBeVisible();
});
