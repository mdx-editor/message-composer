import { expect, test } from "vite-plus/test";

import { createEmptyMessageComposerValue } from "../src/index.ts";

test("creates an empty message composer value", () => {
  expect(createEmptyMessageComposerValue()).toEqual({
    markdown: "",
  });
});
