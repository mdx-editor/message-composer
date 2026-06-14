const base = process.env.LADLE_BASE ?? (process.env.GITHUB_PAGES === "true" ? "/message-composer/" : "/");

/** @type {import('@ladle/react').UserConfig} */
export default {
  base,
  defaultStory: "overview--start-here",
  expandStoryTree: true,
  outDir: "build",
  storyOrder: (stories) => [
    "overview--*",
    "core--*",
    "formatting--*",
    "links--*",
    "mentions--*",
    "attachments--*",
    "slash-commands--*",
    "mobile--*",
    "agent-settings--*",
    ...stories,
  ],
  addons: {
    source: {
      enabled: false,
    },
    theme: {
      enabled: true,
      defaultState: "light",
    },
    width: {
      enabled: true,
      options: {
        phone: 390,
        tablet: 768,
        desktop: 1024,
      },
      defaultState: 0,
    },
  },
};
