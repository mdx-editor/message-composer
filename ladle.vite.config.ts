import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      {
        find: "@mdxeditor/message-composer/plugins/agent-settings",
        replacement: fileURLToPath(new URL("src/plugins/agent-settings/index.ts", import.meta.url)),
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
        find: "@mdxeditor/message-composer",
        replacement: fileURLToPath(new URL("src/index.ts", import.meta.url)),
      },
    ],
  },
});
