import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { MessageComposer, useCellValue } from "../../src/index.ts";
import { currentLink$, formattingPlugin } from "../../src/plugins/formatting/index.tsx";
import { mentionAnchorRect$, mentionsPlugin } from "../../src/plugins/mentions/index.ts";

// Anchor rectangles are viewport coordinates. When the page moves under an open menu or link
// popover without an editor update (a scroll, a window resize, or on a phone the visual viewport
// following the on-screen keyboard), the published rectangle must follow the anchor.

let root: Root | undefined;
let container: HTMLElement | undefined;

afterEach(() => {
  root?.unmount();
  container?.remove();
  window.scrollTo(0, 0);
});

function render(node: ReactNode) {
  container = document.createElement("div");
  // Room to scroll the page, so the editor can move without an editor update.
  container.style.paddingBottom = "200vh";
  document.body.append(container);
  root = createRoot(container);
  root.render(<StrictMode>{node}</StrictMode>);
  return page.elementLocator(container);
}

function MentionAnchorTop() {
  const rect = useCellValue(mentionAnchorRect$);
  return <output data-testid="anchor-top">{rect ? String(Math.round(rect.top)) : ""}</output>;
}

function LinkAnchorTop() {
  const link = useCellValue(currentLink$);
  return <output data-testid="anchor-top">{link?.anchorRect ? String(Math.round(link.anchorRect.top)) : ""}</output>;
}

const mentionPlugins = [
  mentionsPlugin({
    providers: [{ trigger: "@", search: async () => [{ id: "u1", label: "Ada Lovelace" }] }],
    menu: MentionAnchorTop,
  }),
];

const linkPlugins = [formattingPlugin()];

function anchorTop(screen: ReturnType<typeof render>) {
  return screen.getByTestId("anchor-top").element().textContent ?? "";
}

test("the mention anchor follows the trigger when the page scrolls", async () => {
  const screen = render(<MessageComposer plugins={mentionPlugins} editorProps={{ "aria-label": "Message" }} />);
  await screen.getByRole("textbox").click();
  await userEvent.keyboard("hi @a");

  await expect.poll(() => anchorTop(screen)).not.toBe("");
  const before = Number(anchorTop(screen));
  window.scrollBy(0, 120);
  await expect.poll(() => Number(anchorTop(screen))).toBe(before - 120);
});

test("the link anchor follows the link when the page scrolls", async () => {
  const screen = render(
    <MessageComposer
      plugins={linkPlugins}
      slots={{ footer: LinkAnchorTop }}
      editorProps={{ "aria-label": "Message" }}
    />
  );
  await screen.getByRole("textbox").click();
  await userEvent.keyboard("see https://example.com");
  await userEvent.keyboard("{ArrowLeft}");

  await expect.poll(() => anchorTop(screen)).not.toBe("");
  const before = Number(anchorTop(screen));
  window.scrollBy(0, 120);
  await expect.poll(() => Number(anchorTop(screen))).toBe(before - 120);
});
