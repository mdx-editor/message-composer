import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { HeadlessCore } from "../../src/stories/headless-core.stories.tsx";

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

test("headless core story works without the registry shell", async () => {
  const screen = renderStory(<HeadlessCore />);
  const textbox = screen.getByRole("textbox", { name: "Headless message" });

  await userEvent.type(textbox, "bare composer");
  await expect.element(screen.getByTestId("headless-last-change")).toHaveTextContent('"markdown":"bare composer"');

  await screen.getByRole("button", { name: "Submit" }).click();
  await expect.element(screen.getByTestId("headless-submitted")).toHaveTextContent('"markdown":"bare composer"');

  await screen.getByRole("button", { name: "Reset" }).click();
  await expect.element(textbox).toHaveTextContent(/^$/);
});
