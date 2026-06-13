import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    include: ["@base-ui-components/react/popover", "@lexical/react/LexicalAutoLinkPlugin"],
  },
  resolve: {
    alias: [
      // Registry components import the published package name; during
      // development and tests it resolves to the local source.
      {
        find: "@mdxeditor/message-composer/plugins/agent-settings",
        replacement: fileURLToPath(new URL("src/plugins/agent-settings/index.ts", import.meta.url)),
      },
      {
        find: "@mdxeditor/message-composer/plugins/attachments",
        replacement: fileURLToPath(new URL("src/plugins/attachments/index.ts", import.meta.url)),
      },
      {
        find: "@mdxeditor/message-composer/plugins/formatting",
        replacement: fileURLToPath(new URL("src/plugins/formatting/index.tsx", import.meta.url)),
      },
      {
        find: "@mdxeditor/message-composer/plugins/mentions",
        replacement: fileURLToPath(new URL("src/plugins/mentions/index.ts", import.meta.url)),
      },
      {
        find: "@mdxeditor/message-composer/plugins/slash-commands",
        replacement: fileURLToPath(new URL("src/plugins/slash-commands/index.tsx", import.meta.url)),
      },
      {
        find: "@mdxeditor/message-composer",
        replacement: fileURLToPath(new URL("src/index.ts", import.meta.url)),
      },
    ],
  },
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.mjs",
    },
    rolldownOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "@virtuoso.dev/reactive-engine-core",
        "@virtuoso.dev/reactive-engine-react",
      ],
    },
  },
  fmt: {
    arrowParens: "always",
    bracketSameLine: false,
    bracketSpacing: true,
    embeddedLanguageFormatting: "auto",
    endOfLine: "lf",
    ignorePatterns: ["dist/**", "node_modules/**", "coverage/**", ".pnpm-store/**", ".vite-hooks/**"],
    insertFinalNewline: true,
    jsxSingleQuote: false,
    objectWrap: "preserve",
    printWidth: 120,
    proseWrap: "preserve",
    quoteProps: "as-needed",
    semi: true,
    singleAttributePerLine: false,
    singleQuote: false,
    sortImports: true,
    sortPackageJson: true,
    tabWidth: 2,
    trailingComma: "es5",
    useTabs: false,
  },
  lint: {
    env: {
      browser: true,
      es2026: true,
      node: true,
    },
    ignorePatterns: ["dist/**", "node_modules/**", "coverage/**", ".pnpm-store/**", ".vite-hooks/**"],
    options: {
      denyWarnings: true,
      maxWarnings: 0,
      reportUnusedDisableDirectives: "error",
      respectEslintDisableDirectives: true,
      typeAware: true,
      typeCheck: true,
    },
    plugins: ["eslint", "typescript", "react", "import", "jsx-a11y", "unicorn", "promise", "node", "vitest"],
    rules: {
      curly: "error",
      eqeqeq: "error",
      "import/no-cycle": "error",
      "import/no-duplicates": "error",
      "import/no-self-import": "error",
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-has-content": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "no-console": ["error", { allow: ["error", "warn"] }],
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-empty": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-var": "error",
      "prefer-const": "error",
      "promise/no-multiple-resolved": "error",
      "promise/valid-params": "error",
      "react/jsx-no-comment-textnodes": "error",
      "react/jsx-no-useless-fragment": "error",
      "react/no-find-dom-node": "error",
      "react/self-closing-comp": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-floating-promises": "error",
      "typescript/no-misused-promises": "error",
      "typescript/no-var-requires": "error",
      "unicorn/no-abusive-eslint-disable": "error",
      "unicorn/no-array-for-each": "error",
      "unicorn/no-array-reduce": "error",
      "unicorn/no-useless-undefined": ["error", { checkArguments: false }],
      "unicorn/prefer-add-event-listener": "error",
      "unicorn/prefer-array-find": "error",
      "unicorn/prefer-array-some": "error",
      "unicorn/prefer-includes": "error",
      "unicorn/prefer-string-replace-all": "error",
      "unicorn/prefer-string-slice": "error",
      "unicorn/prefer-string-starts-ends-with": "error",
      "vitest/no-disabled-tests": "error",
      "vitest/no-focused-tests": "error",
      "vitest/valid-expect": "error",
    },
    settings: {
      react: {
        version: "19",
      },
    },
  },
  pack: {
    entry: {
      index: "src/index.ts",
      "plugins/agent-settings": "src/plugins/agent-settings/index.ts",
      "plugins/attachments": "src/plugins/attachments/index.ts",
      "plugins/formatting": "src/plugins/formatting/index.tsx",
      "plugins/mentions": "src/plugins/mentions/index.ts",
      "plugins/slash-commands": "src/plugins/slash-commands/index.tsx",
    },
    dts: {
      tsgo: true,
    },
    exports: true,
  },
  staged: {
    "*": "vp check --fix",
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "happy-dom",
          include: ["tests/**/*.test.{ts,tsx}"],
          exclude: ["tests/browser/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["tests/browser/**/*.test.{ts,tsx}"],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
