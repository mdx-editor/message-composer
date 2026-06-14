import { PublicDemo as PublicMobileDemo } from "./mobile.stories.tsx";
import { PublicDemo as PublicSlashCommandDemo } from "./slash-commands.stories.tsx";

import "./tailwind.css";

export default {
  title: "Overview",
};

const pageStyle = {
  display: "grid",
  gap: 16,
  maxWidth: 1120,
  margin: "0 auto",
} as const;

const heroStyle = {
  display: "grid",
  gap: 12,
  border: "1px solid #e4e4e7",
  borderRadius: 8,
  background: "#ffffff",
  padding: 20,
} as const;

const eyebrowStyle = {
  margin: 0,
  color: "#71717a",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 0,
  textTransform: "uppercase",
} as const;

const h1Style = {
  maxWidth: 780,
  margin: 0,
  color: "#18181b",
  fontSize: 28,
  fontWeight: 760,
  lineHeight: 1.15,
} as const;

const copyStyle = {
  maxWidth: 760,
  margin: 0,
  color: "#52525b",
  fontSize: 14,
  lineHeight: 1.6,
} as const;

const linkRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
} as const;

const linkStyle = {
  border: "1px solid #d4d4d8",
  borderRadius: 6,
  background: "#ffffff",
  padding: "7px 10px",
  color: "#18181b",
  fontSize: 13,
  textDecoration: "none",
} as const;

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
  gap: 16,
  alignItems: "start",
} as const;

const panelStyle = {
  display: "grid",
  gap: 12,
  minWidth: 0,
  border: "1px solid #e4e4e7",
  borderRadius: 8,
  background: "#ffffff",
  padding: 14,
} as const;

const panelHeaderStyle = {
  display: "grid",
  gap: 3,
} as const;

const h2Style = {
  margin: 0,
  color: "#18181b",
  fontSize: 16,
  fontWeight: 700,
  lineHeight: 1.25,
} as const;

const panelCopyStyle = {
  margin: 0,
  color: "#71717a",
  fontSize: 13,
  lineHeight: 1.45,
} as const;

const mobileStageStyle = {
  display: "grid",
  justifyItems: "center",
  overflow: "auto",
} as const;

export const StartHere = () => (
  <div data-testid="overview-start-here" style={pageStyle}>
    <section style={heroStyle}>
      <p style={eyebrowStyle}>Public demo gallery</p>
      <h1 style={h1Style}>A composable React message input for chat and agent workflows.</h1>
      <p style={copyStyle}>
        These are raw interactive fixtures for the current package surface: markdown editing, slash commands, context
        chips, mentions, attachments, model settings, and mobile composer affordances.
      </p>
      <nav aria-label="Demo shortcuts" style={linkRowStyle}>
        <a href="?story=slash-commands--public-demo" style={linkStyle}>
          Slash commands
        </a>
        <a href="?story=mobile--public-demo" style={linkStyle}>
          Mobile dock
        </a>
        <a href="?story=formatting--markdown-shortcuts" style={linkStyle}>
          Markdown shortcuts
        </a>
        <a href="?story=attachments--registry-ui" style={linkStyle}>
          Attachments
        </a>
      </nav>
    </section>

    <section style={gridStyle}>
      <article style={panelStyle}>
        <div style={panelHeaderStyle}>
          <h2 style={h2Style}>Desktop command shelf</h2>
          <p style={panelCopyStyle}>Type "/" in the composer, then try "/model", "/prompt", "/file", or "/tool".</p>
        </div>
        <PublicSlashCommandDemo />
      </article>

      <article style={panelStyle}>
        <div style={panelHeaderStyle}>
          <h2 style={h2Style}>Mobile dock</h2>
          <p style={panelCopyStyle}>Use the dock buttons to open slash commands, mentions, attachments, and actions.</p>
        </div>
        <div style={mobileStageStyle}>
          <PublicMobileDemo />
        </div>
      </article>
    </section>
  </div>
);
