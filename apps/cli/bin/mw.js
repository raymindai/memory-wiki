#!/usr/bin/env node

/* =========================================================
   Memory.Wiki CLI — Publish Markdown from anywhere

   Usage:
     Memory.Wiki publish <file>          Publish a .md file → get URL
     Memory.Wiki publish                 Publish from stdin
     Memory.Wiki update <id> <file>      Update an existing document
     Memory.Wiki pull <id>               Download a document
     Memory.Wiki pull <id> -o <file>     Download and save to file
     Memory.Wiki delete <id>             Delete a document
     Memory.Wiki list                    List your documents
     Memory.Wiki open <id>               Open document in browser
     Memory.Wiki render <file>           Render markdown to HTML
     Memory.Wiki login                   Authenticate with Memory.Wiki
     Memory.Wiki logout                  Clear stored credentials
     Memory.Wiki whoami                  Show current user

   Pipe support:
     echo "# Hello" | Memory.Wiki publish
     cat README.md | Memory.Wiki publish
     tmux capture-pane -p | Memory.Wiki publish
     pbpaste | Memory.Wiki publish
   ========================================================= */

const fs = require("fs");
const path = require("path");
const os = require("os");

const BASE_URL = process.env.MDFY_URL || "https://memory.wiki";
const CONFIG_DIR = path.join(os.homedir(), ".memory.wiki");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const TOKENS_FILE = path.join(CONFIG_DIR, "tokens.json");

// ─── Config ───

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); }
  catch { return {}; }
}

function saveConfig(data) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

function loadTokens() {
  try { return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf8")); }
  catch { return {}; }
}

function saveTokens(data) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(data, null, 2));
}

// ─── API ───

async function api(method, path, body) {
  const config = loadConfig();
  const headers = { "Content-Type": "application/json" };
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;
  if (config.userId) headers["x-user-id"] = config.userId;
  if (config.email) headers["x-user-email"] = config.email;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let err;
    try { err = await res.json(); } catch { err = { error: `HTTP ${res.status}` }; }
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  if (res.headers.get("content-type")?.includes("json")) {
    return res.json();
  }
  return null;
}

// ─── Read stdin ───

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) { resolve(null); return; }
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => { resolve(data); });
  });
}

// ─── Commands ───

async function cmdPublish(args) {
  let markdown;
  const file = args[0];

  if (file && file !== "-") {
    if (!fs.existsSync(file)) { console.error(`Error: File not found: ${file}`); process.exit(1); }
    markdown = fs.readFileSync(file, "utf8");
  } else {
    markdown = await readStdin();
    if (!markdown) {
      console.error("Usage: Memory.Wiki publish <file>");
      console.error("       echo '# Hello' | Memory.Wiki publish");
      process.exit(1);
    }
  }

  const title = extractTitle(markdown) || (file ? path.basename(file, ".md") : "Untitled");

  try {
    const result = await api("POST", "/api/docs", {
      markdown,
      title,
      isDraft: false,
      source: "cli",
    });

    const url = `${BASE_URL}/${result.id}`;
    console.log(url);

    // Save token for future updates
    const tokens = loadTokens();
    tokens[result.id] = result.editToken;
    saveTokens(tokens);

    // Copy to clipboard (macOS)
    if (process.platform === "darwin") {
      try {
        require("child_process").execSync(`echo -n "${url}" | pbcopy`);
        console.error("  URL copied to clipboard");
      } catch {}
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function cmdUpdate(args) {
  const id = args[0];
  const file = args[1];
  if (!id) { console.error("Usage: Memory.Wiki update <id> <file>"); process.exit(1); }

  let markdown;
  if (file) {
    markdown = fs.readFileSync(file, "utf8");
  } else {
    markdown = await readStdin();
    if (!markdown) { console.error("Usage: Memory.Wiki update <id> <file>"); process.exit(1); }
  }

  const tokens = loadTokens();
  const editToken = tokens[id];
  if (!editToken) { console.error(`Error: No edit token for ${id}. Publish first.`); process.exit(1); }

  try {
    await api("PATCH", `/api/docs/${id}`, {
      markdown,
      editToken,
      title: extractTitle(markdown),
    });
    console.log(`Updated: ${BASE_URL}/${id}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function cmdPull(args) {
  const id = args[0];
  if (!id) { console.error("Usage: Memory.Wiki pull <id> [-o file]"); process.exit(1); }

  try {
    const doc = await api("GET", `/api/docs/${id}`);
    const markdown = doc.markdown || doc.content || "";

    const outIdx = args.indexOf("-o");
    if (outIdx !== -1 && args[outIdx + 1]) {
      fs.writeFileSync(args[outIdx + 1], markdown);
      console.error(`Saved to ${args[outIdx + 1]}`);
    } else {
      process.stdout.write(markdown);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function cmdDelete(args) {
  const id = args[0];
  if (!id) { console.error("Usage: Memory.Wiki delete <id>"); process.exit(1); }

  const tokens = loadTokens();
  const editToken = tokens[id];

  try {
    await api("PATCH", `/api/docs/${id}`, {
      action: "soft-delete",
      editToken,
    });
    console.log(`Deleted: ${id}`);
    if (tokens[id]) { delete tokens[id]; saveTokens(tokens); }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function cmdList() {
  const config = loadConfig();
  if (!config.userId) { console.error("Not logged in. Run: Memory.Wiki login"); process.exit(1); }

  try {
    const data = await api("GET", "/api/user/documents");
    const docs = data.documents || [];
    if (docs.length === 0) { console.log("No documents."); return; }

    const maxTitle = Math.max(...docs.map(d => (d.title || "Untitled").length), 5);
    docs.forEach((d) => {
      const title = (d.title || "Untitled").padEnd(Math.min(maxTitle, 40));
      const date = new Date(d.updated_at).toLocaleDateString();
      const draft = d.is_draft ? " [draft]" : "";
      console.log(`  ${d.id}  ${title}  ${date}${draft}`);
    });
    console.log(`\n${docs.length} document(s)`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function cmdOpen(args) {
  const id = args[0];
  if (!id) { console.error("Usage: Memory.Wiki open <id>"); process.exit(1); }
  const url = `${BASE_URL}/${id}`;
  if (process.platform === "darwin") {
    require("child_process").exec(`open "${url}"`);
  } else if (process.platform === "linux") {
    require("child_process").exec(`xdg-open "${url}"`);
  } else {
    require("child_process").exec(`start "${url}"`);
  }
  console.log(url);
}

async function cmdLogin() {
  console.log("Opening Memory.Wiki in your browser...");
  console.log("After signing in, click 'Copy token' and paste it below.");
  console.log("");

  if (process.platform === "darwin") {
    require("child_process").exec(`open "${BASE_URL}/auth/cli"`);
  } else if (process.platform === "linux") {
    require("child_process").exec(`xdg-open "${BASE_URL}/auth/cli"`).on("error", () => {
      console.log(`Open this URL in your browser:\n  ${BASE_URL}/auth/cli`);
    });
  } else {
    console.log(`Open this URL in your browser:\n  ${BASE_URL}/auth/cli`);
  }

  // Simple token input
  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });

  rl.question("Paste your token: ", (token) => {
    rl.close();
    if (!token || !token.trim()) { console.error("No token provided."); process.exit(1); }

    // Decode JWT to get user info
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
      const userId = payload.sub || payload.userId || payload.user_id;
      const email = payload.email;
      saveConfig({ token: token.trim(), userId, email });
      console.log(`Logged in as ${email || userId}`);
    } catch {
      saveConfig({ token: token.trim() });
      console.log("Token saved.");
    }
  });
}

function cmdLogout() {
  if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE);
  console.log("Logged out.");
}

function cmdWhoami() {
  const config = loadConfig();
  if (config.email) {
    console.log(config.email);
  } else if (config.userId) {
    console.log(config.userId);
  } else {
    console.log("Not logged in. Run: Memory.Wiki login");
  }
}

function cmdHelp() {
  console.log(`Memory.Wiki — Publish Markdown from anywhere

Usage:
  Memory.Wiki publish <file>          Publish a .md file and get a URL
  Memory.Wiki publish                 Publish from stdin (pipe support)
  Memory.Wiki search <query>           Search your documents
  Memory.Wiki read <id>               Read a document in terminal
  Memory.Wiki capture "<text>"        Capture inline text and publish
  Memory.Wiki capture [source]        Capture from tmux / clipboard / last / file
  Memory.Wiki update <id> <file>      Update an existing document
  Memory.Wiki pull <id>               Download a document to stdout
  Memory.Wiki pull <id> -o <file>     Download and save to file
  Memory.Wiki delete <id>             Delete a document
  Memory.Wiki list                    List your documents
  Memory.Wiki open <id>               Open document in browser
  Memory.Wiki login                   Authenticate with Memory.Wiki
  Memory.Wiki logout                  Clear stored credentials
  Memory.Wiki whoami                  Show current user

Examples:
  echo "# Hello World" | Memory.Wiki publish
  cat README.md | Memory.Wiki publish
  tmux capture-pane -p | Memory.Wiki publish
  pbpaste | Memory.Wiki publish
  Memory.Wiki publish ./notes/meeting.md
  Memory.Wiki pull abc123 -o meeting.md

Environment:
  MDFY_URL    Base URL (default: https://memory.wiki)

Config:  ~/.memory.wiki/config.json
Tokens:  ~/.memory.wiki/tokens.json
`);
}

// ─── Read ───

async function cmdRead(args) {
  let id = args[0];
  if (!id) { console.error("Usage: Memory.Wiki read <id>"); process.exit(1); }

  // Accept full URL or just ID
  id = id.replace(/^https?:\/\/memory.wiki\.(cc|app)\/\?doc=/, "").replace(/^https?:\/\/memory.wiki\.(cc|app)\/d\//, "").replace(/^https?:\/\/memory.wiki\.(cc|app)\//, "").replace(/^Memory.Wiki\.(cc|app)\/\?doc=/, "").replace(/^Memory.Wiki\.(cc|app)\/d\//, "").replace(/^Memory.Wiki\.(cc|app)\//, "");

  try {
    const doc = await api("GET", `/api/docs/${id}`);
    const markdown = doc.markdown || doc.content || "";
    const title = doc.title || id;

    // Render for terminal with basic formatting
    const rendered = renderTerminal(markdown, title);
    process.stdout.write(rendered);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

function renderTerminal(markdown, title) {
  const BOLD = "\x1b[1m";
  const DIM = "\x1b[2m";
  const ITALIC = "\x1b[3m";
  const UNDERLINE = "\x1b[4m";
  const ORANGE = "\x1b[38;5;208m";
  const GREEN = "\x1b[38;5;114m";
  const BLUE = "\x1b[38;5;111m";
  const GRAY = "\x1b[38;5;243m";
  const RESET = "\x1b[0m";

  let output = "";
  output += `${GRAY}${"─".repeat(60)}${RESET}\n`;
  output += `${ORANGE}${BOLD}${title}${RESET}\n`;
  output += `${GRAY}${"─".repeat(60)}${RESET}\n\n`;

  const lines = markdown.split("\n");
  for (const line of lines) {
    // Headings
    if (/^######\s/.test(line)) { output += `${DIM}${line.replace(/^######\s+/, "      ")}${RESET}\n`; }
    else if (/^#####\s/.test(line)) { output += `${DIM}${line.replace(/^#####\s+/, "     ")}${RESET}\n`; }
    else if (/^####\s/.test(line)) { output += `${BOLD}${line.replace(/^####\s+/, "    ")}${RESET}\n`; }
    else if (/^###\s/.test(line)) { output += `${BOLD}${line.replace(/^###\s+/, "   ")}${RESET}\n`; }
    else if (/^##\s/.test(line)) { output += `\n${BOLD}${BLUE}${line.replace(/^##\s+/, "")}${RESET}\n${"─".repeat(40)}\n`; }
    else if (/^#\s/.test(line)) { output += `${BOLD}${ORANGE}${line.replace(/^#\s+/, "")}${RESET}\n${"═".repeat(40)}\n`; }
    // Code blocks
    else if (/^```/.test(line)) { output += `${GRAY}${line}${RESET}\n`; }
    // Blockquotes
    else if (/^>\s/.test(line)) { output += `${GREEN}│ ${line.replace(/^>\s*/, "")}${RESET}\n`; }
    // Lists
    else if (/^[-*]\s/.test(line)) { output += `  ${ORANGE}•${RESET} ${line.replace(/^[-*]\s+/, "")}\n`; }
    else if (/^\d+\.\s/.test(line)) { output += `  ${line}\n`; }
    // Horizontal rule
    else if (/^---/.test(line)) { output += `${GRAY}${"─".repeat(40)}${RESET}\n`; }
    // Bold/italic inline
    else {
      let formatted = line;
      formatted = formatted.replace(/\*\*([^*]+)\*\*/g, `${BOLD}$1${RESET}`);
      formatted = formatted.replace(/\*([^*]+)\*/g, `${ITALIC}$1${RESET}`);
      formatted = formatted.replace(/`([^`]+)`/g, `${ORANGE}$1${RESET}`);
      output += formatted + "\n";
    }
  }

  output += `\n${GRAY}${"─".repeat(60)}${RESET}\n`;
  return output;
}

// ─── Capture ───

async function cmdCapture(args) {
  const target = args[0]; // "tmux", "clipboard", "last", or nothing (auto-detect)

  let raw;

  if (target === "tmux" || (!target && process.env.TMUX)) {
    // Capture tmux pane
    try {
      raw = require("child_process").execSync("tmux capture-pane -p -S -3000", { encoding: "utf8" });
    } catch {
      console.error("Error: Not in a tmux session or tmux not available.");
      process.exit(1);
    }
  } else if (target === "clipboard" || target === "cb") {
    // Capture clipboard
    if (process.platform === "darwin") {
      try { raw = require("child_process").execSync("pbpaste", { encoding: "utf8" }); }
      catch { console.error("Error: Could not read clipboard."); process.exit(1); }
    } else {
      try { raw = require("child_process").execSync("xclip -selection clipboard -o", { encoding: "utf8" }); }
      catch { console.error("Error: xclip not available."); process.exit(1); }
    }
  } else if (target === "last") {
    // Read stdin for piped last command
    raw = await readStdin();
    if (!raw) { console.error("Usage: some-command 2>&1 | Memory.Wiki capture last"); process.exit(1); }
  } else if (!target) {
    // Auto: try stdin, then clipboard
    raw = await readStdin();
    if (!raw && process.platform === "darwin") {
      try { raw = require("child_process").execSync("pbpaste", { encoding: "utf8" }); }
      catch {}
    }
    if (!raw) { console.error("Usage: Memory.Wiki capture [tmux|clipboard|last]"); process.exit(1); }
  } else {
    // Treat as file if it exists, otherwise treat as inline markdown
    // text (gbrain-style `mw capture "the thought I want to remember"`).
    if (fs.existsSync(target)) {
      raw = fs.readFileSync(target, "utf8");
    } else {
      // Inline text mode — join remaining args so multi-word captures
      // work without escaping: `mw capture key insight from dinner`.
      raw = args.join(" ");
    }
  }

  // Strip ANSI escape codes
  const clean = stripAnsi(raw);

  // Detect and format AI conversation
  const formatted = formatCapture(clean);

  // Publish
  const title = extractTitle(formatted) || "Terminal Capture";
  try {
    const result = await api("POST", "/api/docs", {
      markdown: formatted,
      title,
      isDraft: false,
      source: "cli-capture",
    });

    const url = `${BASE_URL}/${result.id}`;
    console.log(url);

    const tokens = loadTokens();
    tokens[result.id] = result.editToken;
    saveTokens(tokens);

    if (process.platform === "darwin") {
      try { require("child_process").execSync(`echo -n "${url}" | pbcopy`); console.error("  URL copied to clipboard"); } catch {}
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

function stripAnsi(str) {
  // Remove ANSI escape sequences (colors, cursor movement, etc.)
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "")
    .replace(/\x1B\][^\x07]*\x07/g, "")  // OSC sequences
    .replace(/\x1B[()][AB012]/g, "")      // Character set
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function formatCapture(text) {
  // Check if it's an AI conversation
  if (isAiConversation(text)) {
    return formatAiConversation(text);
  }

  // Check if it looks like a CLI session
  if (isCliSession(text)) {
    return formatCliSession(text);
  }

  // Plain text — wrap in code block if it looks like output
  if (text.includes("$") || text.includes("❯") || text.includes(">>>")) {
    return "# Terminal Output\n\n```\n" + text.trim() + "\n```\n";
  }

  return text;
}

function isAiConversation(text) {
  const patterns = [
    /^(User|Human|You|Question)\s*[:：]/im,
    /^(Assistant|AI|ChatGPT|Claude|Gemini)\s*[:：]/im,
    /^(❯|>|\$)\s*(claude|chatgpt|gemini|ollama)/im,
    /╭─|╰─|━━━/m,  // Claude Code box drawing
  ];
  let matches = 0;
  for (const p of patterns) { if (p.test(text)) matches++; }
  return matches >= 1;
}

function formatAiConversation(text) {
  const lines = text.split("\n");
  let md = "# AI Conversation\n\n";
  let currentRole = null;
  let currentContent = [];

  for (const line of lines) {
    // Detect role changes
    const userMatch = line.match(/^(?:❯|>|\$)?\s*(User|Human|You|Question)\s*[:：]\s*(.*)/i);
    const aiMatch = line.match(/^(Assistant|AI|ChatGPT|Claude|Gemini|GPT)\s*[:：]\s*(.*)/i);

    if (userMatch) {
      if (currentRole) { md += flushRole(currentRole, currentContent); }
      currentRole = "user";
      currentContent = userMatch[2] ? [userMatch[2]] : [];
    } else if (aiMatch) {
      if (currentRole) { md += flushRole(currentRole, currentContent); }
      currentRole = "assistant";
      currentContent = aiMatch[2] ? [aiMatch[2]] : [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentRole) { md += flushRole(currentRole, currentContent); }

  // If no roles detected, just return cleaned text
  if (!md.includes("> **")) {
    return "# Terminal Capture\n\n" + text;
  }

  return md;
}

function flushRole(role, content) {
  const text = content.join("\n").trim();
  if (!text) return "";
  if (role === "user") {
    return "> **You:** " + text.split("\n").join("\n> ") + "\n\n";
  }
  return text + "\n\n---\n\n";
}

function isCliSession(text) {
  const promptPattern = /^[\$❯>]\s+/m;
  return promptPattern.test(text);
}

function formatCliSession(text) {
  return "# Terminal Session\n\n```bash\n" + text.trim() + "\n```\n";
}

// ─── Search ───

async function cmdSearch(args) {
  const query = args.join(" ").trim();
  if (!query) { console.error("Usage: Memory.Wiki search <query>"); process.exit(1); }

  const config = loadConfig();
  if (!config.userId && !config.token) { console.error("Not logged in. Run: Memory.Wiki login"); process.exit(1); }

  try {
    const data = await api("GET", `/api/search?q=${encodeURIComponent(query)}`);
    const results = data.results || [];
    if (results.length === 0) { console.log("No results found."); return; }

    const BOLD = "\x1b[1m";
    const DIM = "\x1b[2m";
    const ORANGE = "\x1b[38;5;208m";
    const GRAY = "\x1b[38;5;243m";
    const RESET = "\x1b[0m";

    console.log(`${BOLD}${results.length} result(s) for "${query}"${RESET}\n`);
    results.forEach((r, i) => {
      const draft = r.isDraft ? ` ${DIM}[draft]${RESET}` : "";
      const date = new Date(r.updatedAt).toLocaleDateString();
      console.log(`${ORANGE}${i + 1}.${RESET} ${BOLD}${r.title}${RESET}${draft}`);
      console.log(`   ${GRAY}${r.id}  ${date}${RESET}`);
      if (r.snippet) console.log(`   ${r.snippet.slice(0, 100)}`);
      console.log();
    });
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

// ─── Helpers ───

function extractTitle(md) {
  const match = (md || "").match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// ─── Main ───

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  switch (cmd) {
    case "publish": case "pub": case "p":
      await cmdPublish(args.slice(1));
      break;
    case "update": case "up":
      await cmdUpdate(args.slice(1));
      break;
    case "pull": case "get":
      await cmdPull(args.slice(1));
      break;
    case "delete": case "del": case "rm":
      await cmdDelete(args.slice(1));
      break;
    case "list": case "ls":
      await cmdList();
      break;
    case "open":
      await cmdOpen(args.slice(1));
      break;
    case "search": case "s": case "find":
      await cmdSearch(args.slice(1));
      break;
    case "read": case "view": case "cat":
      await cmdRead(args.slice(1));
      break;
    case "capture": case "cap": case "c":
      await cmdCapture(args.slice(1));
      break;
    case "login":
      await cmdLogin();
      break;
    case "logout":
      cmdLogout();
      break;
    case "whoami":
      cmdWhoami();
      break;
    case "help": case "--help": case "-h":
      cmdHelp();
      break;
    case "version": case "--version": case "-v":
      console.log(require("../package.json").version);
      break;
    default:
      if (!cmd) {
        // No command — check stdin
        const stdin = await readStdin();
        if (stdin) {
          // Pipe mode: publish stdin
          process.argv.push("publish");
          await cmdPublish([]);
        } else {
          cmdHelp();
        }
      } else {
        console.error(`Unknown command: ${cmd}`);
        console.error("Run 'Memory.Wiki help' for usage.");
        process.exit(1);
      }
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
