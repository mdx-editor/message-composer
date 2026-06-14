import type { GlobalProvider } from "@ladle/react";

const shellStyle = {
  minHeight: "100vh",
  background: "#fafafa",
  color: "#18181b",
} as const;

const headerStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  borderBottom: "1px solid #e4e4e7",
  background: "#ffffff",
  padding: "12px 16px",
} as const;

const titleStackStyle = { display: "grid", gap: 2 } as const;
const titleStyle = { margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.2 } as const;
const subtitleStyle = { margin: 0, color: "#71717a", fontSize: 12, lineHeight: 1.4 } as const;

const navStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: 8,
  fontSize: 12,
} as const;

const linkStyle = {
  border: "1px solid #d4d4d8",
  borderRadius: 6,
  background: "#ffffff",
  padding: "5px 8px",
  color: "#18181b",
  textDecoration: "none",
} as const;

const installStyle = {
  border: "1px solid #e4e4e7",
  borderRadius: 6,
  background: "#f4f4f5",
  padding: "5px 8px",
  color: "#3f3f46",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 11,
} as const;

const mainStyle = {
  padding: 16,
} as const;

export const Provider: GlobalProvider = ({ children }) => (
  <div style={shellStyle}>
    <header style={headerStyle}>
      <div style={titleStackStyle}>
        <p style={titleStyle}>Message Composer</p>
        <p style={subtitleStyle}>Interactive fixtures for chat and agent input workflows.</p>
      </div>
      <nav aria-label="Demo links" style={navStyle}>
        <code style={installStyle}>@mdxeditor/message-composer</code>
        <a style={linkStyle} href="https://github.com/mdx-editor/message-composer">
          GitHub
        </a>
      </nav>
    </header>
    <main style={mainStyle}>{children}</main>
  </div>
);
