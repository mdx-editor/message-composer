import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import {
  CustomUI,
  DisabledWithHostValue,
  AuthenticatedPreview,
  RegistryUI,
  SubmissionPaths,
  ValidationLimits,
} from "../../src/stories/attachments.stories.tsx";

let root: Root | undefined;
let container: HTMLElement | undefined;

afterEach(() => {
  root?.unmount();
  container?.remove();
  vi.restoreAllMocks();
});

function renderStory(node: ReactNode) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  root.render(<StrictMode>{node}</StrictMode>);
  return page.elementLocator(container);
}

/** Waits for the editor to mount; element() and querySelector have no retry. */
async function renderEditableStory(node: ReactNode) {
  const screen = renderStory(node);
  await expect.element(screen.getByRole("textbox")).toBeVisible();
  return screen;
}

function makeFile(name: string, size = 64, type = "text/plain"): File {
  return new File([new Uint8Array(size)], name, { type });
}

function pickerInput(): HTMLInputElement {
  const input = container?.querySelector<HTMLInputElement>("input[data-message-composer-attachment-input]");
  if (!input) {
    throw new Error("attachment picker input not mounted");
  }
  return input;
}

function fileTransfer(...files: File[]): DataTransfer {
  const transfer = new DataTransfer();
  for (const file of files) {
    transfer.items.add(file);
  }
  return transfer;
}

test("picking a file uploads it with visible progress and submits its metadata", async () => {
  const screen = await renderEditableStory(<RegistryUI />);
  const textbox = screen.getByRole("textbox");

  await userEvent.upload(pickerInput(), makeFile("notes.txt"));

  await expect.element(screen.getByRole("progressbar", { name: "Uploading notes.txt" })).toBeVisible();
  await expect.element(screen.getByRole("listitem")).toHaveAttribute("data-status", "success");

  await textbox.click();
  await userEvent.keyboard("see attached{Enter}");

  const submitted = screen.getByTestId("submitted");
  await expect.element(submitted).toHaveTextContent('"markdown":"see attached"');
  await expect.element(submitted).toHaveTextContent('"name":"notes.txt"');
  await expect.element(submitted).toHaveTextContent('"status":"success"');
  await expect.element(submitted).toHaveTextContent('"url":"https://files.example/notes.txt"');
});

test("the picker button clicks the hidden file input", async () => {
  const screen = await renderEditableStory(<RegistryUI />);

  let clicked = false;
  pickerInput().addEventListener("click", (event) => {
    clicked = true;
    // Suppresses the native file chooser, which cannot be automated.
    event.preventDefault();
  });

  await screen.getByRole("button", { name: "Add attachments" }).click();

  expect(clicked).toBe(true);
});

test("dropping files on the editor ingests them", async () => {
  const screen = await renderEditableStory(<RegistryUI />);
  const textbox = screen.getByRole("textbox");
  const target = textbox.element();

  const transfer = fileTransfer(makeFile("dropped.txt"));
  target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
  target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));

  await expect.element(screen.getByText("dropped.txt")).toBeVisible();
  await expect.element(screen.getByRole("listitem")).toHaveAttribute("data-status", "success");
});

test("pasting files into the editor ingests them instead of inserting text", async () => {
  const screen = await renderEditableStory(<RegistryUI />);
  const textbox = screen.getByRole("textbox");

  await textbox.click();
  textbox.element().dispatchEvent(
    new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: fileTransfer(makeFile("pasted.png", 64, "image/png")),
    })
  );

  await expect.element(screen.getByText("pasted.png")).toBeVisible();
  await expect.element(textbox).toHaveTextContent("");
});

test("a failing upload shows the error and retry succeeds", async () => {
  const screen = await renderEditableStory(<RegistryUI />);

  await userEvent.upload(pickerInput(), makeFile("must-fail.txt"));

  await expect.element(screen.getByRole("listitem")).toHaveAttribute("data-status", "error");
  await expect.element(screen.getByText("Simulated upload failure")).toBeVisible();

  await screen.getByRole("button", { name: "Retry must-fail.txt" }).click();

  await expect.element(screen.getByRole("listitem")).toHaveAttribute("data-status", "success");
});

test("removing an attachment excludes it from the submitted value", async () => {
  const screen = await renderEditableStory(<RegistryUI />);
  const textbox = screen.getByRole("textbox");

  await userEvent.upload(pickerInput(), makeFile("keep.txt"));
  await userEvent.upload(pickerInput(), makeFile("drop.txt"));
  await expect.element(screen.getByText("drop.txt")).toBeVisible();
  await expect
    .poll(() =>
      [...(container?.querySelectorAll<HTMLElement>("[data-status]") ?? [])].every(
        (item) => item.dataset.status === "success"
      )
    )
    .toBe(true);

  await screen.getByRole("button", { name: "Remove drop.txt" }).click();
  await expect.element(screen.getByText("drop.txt")).not.toBeInTheDocument();

  await textbox.click();
  await userEvent.keyboard("{Enter}");

  const submitted = screen.getByTestId("submitted");
  await expect.element(submitted).toHaveTextContent('"name":"keep.txt"');
  await expect.element(submitted).not.toHaveTextContent('"name":"drop.txt"');
});

test("validation rejections are announced and dismissable", async () => {
  const screen = await renderEditableStory(<ValidationLimits />);

  await userEvent.upload(pickerInput(), makeFile("huge.png", 20 * 1024, "image/png"));
  await expect.element(screen.getByRole("alert")).toHaveTextContent('"huge.png" exceeds the 10 KB limit.');

  await userEvent.upload(pickerInput(), makeFile("notes.txt", 64, "text/plain"));
  await expect.element(screen.getByRole("alert")).toHaveTextContent('"notes.txt" is not an accepted file type.');

  await screen.getByRole("button", { name: "Dismiss attachment errors" }).click();
  await expect.element(screen.getByRole("alert")).not.toBeInTheDocument();

  await userEvent.upload(pickerInput(), makeFile("photo.png", 1024, "image/png"));
  await expect.element(screen.getByRole("listitem")).toHaveAttribute("data-status", "success");
});

test("aggregate validation applies to picker ingestion", async () => {
  const screen = await renderEditableStory(<ValidationLimits />);

  await userEvent.upload(pickerInput(), makeFile("first.png", 8 * 1024, "image/png"));
  await userEvent.upload(pickerInput(), makeFile("second.png", 8 * 1024, "image/png"));

  await expect
    .element(screen.getByRole("alert"))
    .toHaveTextContent('Adding "second.png" would exceed the 15 KB draft limit.');
});

test("aggregate validation applies to dropped files", async () => {
  const screen = await renderEditableStory(<ValidationLimits />);
  const textbox = screen.getByRole("textbox");
  await userEvent.upload(pickerInput(), makeFile("first.png", 8 * 1024, "image/png"));

  const transfer = fileTransfer(makeFile("dropped.png", 8 * 1024, "image/png"));
  textbox.element().dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));

  await expect
    .element(screen.getByRole("alert"))
    .toHaveTextContent('Adding "dropped.png" would exceed the 15 KB draft limit.');
});

test("aggregate validation applies to pasted files", async () => {
  const screen = await renderEditableStory(<ValidationLimits />);
  const textbox = screen.getByRole("textbox");
  await userEvent.upload(pickerInput(), makeFile("first.png", 8 * 1024, "image/png"));

  textbox.element().dispatchEvent(
    new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: fileTransfer(makeFile("pasted.png", 8 * 1024, "image/png")),
    })
  );

  await expect
    .element(screen.getByRole("alert"))
    .toHaveTextContent('Adding "pasted.png" would exceed the 15 KB draft limit.');
});

test("pending attachments block keyboard, imperative, and published submission", async () => {
  const screen = await renderEditableStory(<SubmissionPaths />);
  const textbox = screen.getByRole("textbox");
  const submitted = screen.getByTestId("submitted");

  await expect.element(textbox).toHaveAttribute("data-submit-blocked", "true");
  await textbox.click();
  await userEvent.keyboard("{Enter}");
  await screen.getByRole("button", { name: "Imperative submit" }).click();
  await screen.getByRole("button", { name: "Published submit" }).click();
  await expect.element(submitted).toHaveTextContent("null");

  await screen.getByRole("button", { name: "Remove pending.txt" }).click();
  await expect.element(textbox).not.toHaveAttribute("data-submit-blocked");
  await screen.getByRole("button", { name: "Published submit" }).click();
  await expect.element(submitted).toHaveTextContent('"attachments":[]');
});

test("authenticated blob previews are revoked when their attachment is removed", async () => {
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  const screen = await renderEditableStory(<AuthenticatedPreview />);

  await expect.poll(() => container?.querySelector("img")?.src.startsWith("blob:")).toBe(true);
  await screen.getByRole("button", { name: "Remove private.png" }).click();

  expect(revoke).toHaveBeenCalledTimes(1);
});

test("custom UI drives the same contracts through its own input", async () => {
  const screen = await renderEditableStory(<CustomUI />);
  const textbox = screen.getByRole("textbox");

  const customInput = screen.getByLabelText("Add files");
  await userEvent.upload(customInput, makeFile("custom.txt"));

  // The item text mutates while uploading, so poll the live DOM instead of a
  // text-derived locator snapshot.
  await expect
    .poll(() => container?.querySelector("[data-testid=custom-attachment-controls] li")?.getAttribute("data-status"))
    .toBe("success");

  await textbox.click();
  await userEvent.keyboard("from custom ui{Enter}");
  const submitted = screen.getByTestId("submitted");
  await expect.element(submitted).toHaveTextContent('"name":"custom.txt"');

  await screen.getByRole("button", { name: "Remove custom.txt" }).click();
  await expect.element(screen.getByTestId("custom-attachment-controls")).not.toHaveTextContent("custom.txt");
});

test("disabled composer renders host-authored attachments without remove or picker affordances", async () => {
  const screen = renderStory(<DisabledWithHostValue />);

  await expect.element(screen.getByText("composer-spec.pdf")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Add attachments" })).toBeDisabled();
  expect(container?.querySelector("[aria-label='Remove composer-spec.pdf']")).toBeNull();
});
