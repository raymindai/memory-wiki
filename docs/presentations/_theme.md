---
marp: true
theme: default
paginate: true
backgroundColor: '#0a0a0a'
color: '#f4f4f5'
style: |
  /* memory.wiki brand — warm zinc + orange, no purple. */
  section {
    font-family: 'Inter', 'Pretendard', system-ui, -apple-system, sans-serif;
    padding: 64px 72px;
    letter-spacing: -0.01em;
  }
  section.lead {
    justify-content: center;
    text-align: left;
  }
  section.lead h1 {
    font-size: 64px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.05;
    margin-bottom: 24px;
  }
  section.lead h2 {
    font-size: 22px;
    font-weight: 500;
    color: #a1a1aa;
    margin-top: 0;
    border: none;
  }
  h1 {
    color: #fb923c;
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin-bottom: 24px;
  }
  h2 {
    color: #fafafa;
    font-size: 30px;
    font-weight: 700;
    letter-spacing: -0.015em;
    margin-top: 0;
    margin-bottom: 18px;
  }
  h3 {
    color: #fb923c;
    font-size: 16px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 28px;
    margin-bottom: 10px;
  }
  p, li {
    font-size: 22px;
    line-height: 1.5;
    color: #e4e4e7;
  }
  strong { color: #fafafa; font-weight: 700; }
  em { color: #fb923c; font-style: normal; }
  code {
    background: #18181b;
    color: #fdba74;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.85em;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
  }
  pre {
    background: #18181b;
    border: 1px solid #27272a;
    border-radius: 8px;
    padding: 20px;
    font-size: 17px;
    line-height: 1.4;
  }
  pre code {
    background: none;
    color: #fdba74;
    padding: 0;
  }
  blockquote {
    border-left: 3px solid #fb923c;
    padding-left: 20px;
    color: #d4d4d8;
    font-style: italic;
    margin: 18px 0;
  }
  table {
    border-collapse: collapse;
    font-size: 19px;
    width: 100%;
  }
  th, td {
    padding: 10px 16px;
    text-align: left;
    border-bottom: 1px solid #27272a;
  }
  th { color: #fb923c; font-weight: 600; }
  hr { border: none; border-top: 1px solid #27272a; margin: 28px 0; }
  ul { padding-left: 24px; }
  li { margin-bottom: 8px; }
  section::after {
    color: #52525b;
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
  }
  .footnote {
    position: absolute;
    bottom: 32px;
    left: 72px;
    font-size: 13px;
    color: #71717a;
    font-family: 'JetBrains Mono', monospace;
  }
  .accent { color: #fb923c; }
  .muted { color: #a1a1aa; }
  .faint { color: #71717a; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
  .pill {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgba(251, 146, 60, 0.12);
    color: #fb923c;
    font-size: 13px;
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
---

<!--
Shared theme for all four memory.wiki decks. Each deck imports this header
by copying these front-matter directives at the top of its file.
Marp doesn't have a real include, so the style block is duplicated.
Update once here, then propagate to the four decks.
-->
