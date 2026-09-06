import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { exampleMarkdown } from "../../src/stories/pasted-text.fixtures.tsx";
import { Controlled, Playground, WithPastedText } from "../../src/stories/pasted-text.stories.tsx";

let root: Root | undefined;
let container: HTMLElement | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  root?.unmount();
  container?.remove();
});
function renderStory(Story = Playground) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  root.render(
    <StrictMode>
      <Story />
    </StrictMode>
  );
  return page.elementLocator(container);
}
function paste(target: Element, text: string, html?: string) {
  const data = new DataTransfer();
  data.setData("text/plain", text);
  if (html) {
    data.setData("text/html", html);
  }
  target.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }));
}

test("large Markdown pastes collapse without parsing and submit their exact source", async () => {
  const screen = renderStory();
  const textbox = screen.getByRole("textbox", { name: "Message" });
  await userEvent.type(textbox, "Review this");
  paste(textbox.element(), exampleMarkdown, "<h1>Discarded rich HTML</h1>");
  await expect.element(screen.getByRole("button", { name: "Expand pasted text 1" })).toBeVisible();
  await expect.element(textbox).toHaveTextContent("Review this");
  expect(textbox.element().textContent).toBe("Review this");
  await screen.getByRole("button", { name: "Expand pasted text 1" }).click();
  const preview = page.getByLabelText("Pasted text content");
  await expect.element(preview).toBeVisible();
  expect(preview.element().textContent).toBe(exampleMarkdown);
  await userEvent.keyboard("{Escape}");
  await screen.getByRole("button", { name: "Send message" }).click();
  const submitted = JSON.parse(screen.getByTestId("submitted").element().textContent ?? "null");
  expect(submitted.extensions.pastedTexts[0].text).toBe(exampleMarkdown);
  expect(submitted.markdown).toBe("Review this");
});

test("short pastes stay at the caret and large pastes in code remain in the block", async () => {
  const screen = renderStory();
  const textbox = screen.getByRole("textbox", { name: "Message" });
  await textbox.click();
  paste(textbox.element(), "small snippet");
  await expect.element(textbox).toHaveTextContent("small snippet");
  await expect.element(screen.getByRole("button", { name: "Expand pasted text 1" })).not.toBeInTheDocument();
  await screen.getByRole("button", { name: "Code block", exact: true }).click();
  paste(textbox.element(), "\n" + exampleMarkdown);
  await expect.element(textbox).toHaveTextContent("Release review");
  expect(textbox.element().querySelector("code")?.textContent).toContain("# Release review");
  await expect.element(screen.getByRole("button", { name: "Expand pasted text 1" })).not.toBeInTheDocument();
});

test("controlled pills support editing, cancellation, removal, and focus return", async () => {
  const screen = renderStory(Controlled);
  const trigger = screen.getByRole("button", { name: "Expand pasted text 1" });
  await trigger.click();
  await page.getByRole("button", { name: "Edit text", exact: true }).click();
  await page.getByRole("textbox", { name: "Edit pasted text" }).fill("Edited **raw** text\n\tindent");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect.element(page.getByLabelText("Pasted text content")).toHaveTextContent("Edited **raw** text");
  await page.getByRole("button", { name: "Edit text", exact: true }).click();
  await page.getByRole("textbox", { name: "Edit pasted text" }).fill("discard this");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect.element(page.getByLabelText("Pasted text content")).toHaveTextContent("Edited **raw** text");
  await userEvent.keyboard("{Escape}");
  expect(document.activeElement).toBe(trigger.element());
  await screen.getByRole("button", { name: "Remove pasted text 1" }).click();
  await expect.element(trigger).not.toBeInTheDocument();
});

test("multiple text-only pastes can be sent, and a single long line also collapses", async () => {
  const screen = renderStory();
  const textbox = screen.getByRole("textbox", { name: "Message" });
  await textbox.click();
  paste(textbox.element(), "x".repeat(2000));
  await expect.element(screen.getByRole("button", { name: "Expand pasted text 1" })).toBeVisible();
  paste(textbox.element(), "line\r\n".repeat(20));
  await expect.element(screen.getByRole("button", { name: "Expand pasted text 2" })).toBeVisible();
  await screen.getByRole("button", { name: "Send message" }).click();
  const submitted = JSON.parse(screen.getByTestId("submitted").element().textContent ?? "null");
  expect(submitted.markdown).toBe("");
  expect(submitted.extensions.pastedTexts.map((item: { text: string }) => item.text)).toEqual([
    "x".repeat(2000),
    "line\r\n".repeat(20),
  ]);
});

test("copy uses the exact source text", async () => {
  const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
  const screen = renderStory(WithPastedText);
  await screen.getByRole("button", { name: "Expand pasted text 1" }).click();
  await page.getByRole("button", { name: "Copy text", exact: true }).click();
  await expect.element(page.getByRole("status").filter({ hasText: "Copied" })).toBeVisible();
  expect(copy).toHaveBeenCalledWith(exampleMarkdown);
});

test("clipboard failure leaves a readable preview and reports the failure", async () => {
  vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("clipboard denied"));
  const screen = renderStory(WithPastedText);
  await screen.getByRole("button", { name: "Expand pasted text 1" }).click();
  await page.getByRole("button", { name: "Copy text", exact: true }).click();
  await expect.element(page.getByRole("status").filter({ hasText: "Could not copy" })).toBeVisible();
  expect(page.getByLabelText("Pasted text content").element().textContent).toBe(exampleMarkdown);
});

for (const [name, Story] of [
  ["uncontrolled", WithPastedText],
  ["controlled", Controlled],
] as const) {
  test(`${name}: insert replaces the pill with editable source and preserves existing prose`, async () => {
    const screen = renderStory(Story);
    await screen.getByRole("button", { name: "Insert pasted text 1 into message" }).click();
    const textbox = screen.getByRole("textbox", { name: "Message" });
    await expect.element(textbox).toHaveTextContent("# Release review");
    await expect.element(screen.getByRole("button", { name: "Expand pasted text 1" })).not.toBeInTheDocument();
    expect(textbox.element().textContent).toContain("Review this release checklist");
    expect(textbox.element().textContent).toContain("[notes]: https://example.com/releases");
    expect(textbox.element().textContent).toContain("| Build | Passed |");
    await textbox.click();
    await userEvent.keyboard("{Control>}{End}{/Control}");
    await userEvent.keyboard(" extra");
    await screen.getByRole("button", { name: "Send message" }).click();
    const submitted = JSON.parse(screen.getByTestId("submitted").element().textContent ?? "null");
    expect(submitted.extensions.pastedTexts).toEqual([]);
    expect(submitted.markdown).toContain("extra");
    expect(submitted.markdown).toContain("example.com/releases");
  });
}
test("preview action inserts the text and closes the dialog", async () => {
  const screen = renderStory(WithPastedText);
  await screen.getByRole("button", { name: "Expand pasted text 1" }).click();
  await page.getByRole("button", { name: "Insert into message", exact: true }).click();
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  await expect.element(screen.getByRole("textbox", { name: "Message" })).toHaveTextContent("# Release review");
});

test("insert preserves Markdown markers as literal editable content", async () => {
  const screen = renderStory();
  const textbox = screen.getByRole("textbox", { name: "Message" });
  await textbox.click();
  const source = "~~gone~~ **bold** `code` ![image](https://example.com/image.png)\n" + "text\n".repeat(20);
  paste(textbox.element(), source);
  await screen.getByRole("button", { name: "Insert pasted text 1 into message" }).click();
  await expect.element(textbox).toHaveTextContent("~~gone~~ **bold** `code` ![image](https://example.com/image.png)");
  expect(textbox.element().querySelector("s, strong, code, img")).toBeNull();
});
