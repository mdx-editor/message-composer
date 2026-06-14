import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { StartHere } from "../../src/stories/overview.stories.tsx";

let root: Root | undefined;
let container: HTMLElement | undefined;

afterEach(() => {
  root?.unmount();
  container?.remove();
});

function renderStory() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  root.render(
    <StrictMode>
      <StartHere />
    </StrictMode>
  );
  return page.elementLocator(container);
}

test("overview story presents the public desktop and mobile demos", async () => {
  const screen = renderStory();

  await expect.element(screen.getByTestId("overview-start-here")).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Desktop command shelf" })).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Mobile dock" })).toBeVisible();
  await expect.element(screen.getByTestId("mobile-phone-frame")).toBeVisible();
});
