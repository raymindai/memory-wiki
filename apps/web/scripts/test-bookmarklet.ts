/**
 * Regression suite for the public bookmarklet (`public/bookmarklet.js`).
 *
 * Runs the bookmarklet against synthetic DOM fixtures for each supported
 * provider (ChatGPT, Claude, Gemini), captures the fetch payload it would
 * have sent to /api/docs, and asserts the markdown is correct.
 *
 * Run with: pnpm test:bookmarklet
 */

import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseHTML } from "linkedom";

let pass = 0;
let fail = 0;

function assert(cond: unknown, label: string) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}`);
  }
}

interface CaptureResult {
  url: string;
  body: { markdown: string; title: string; source: string; isDraft: boolean };
}

async function runBookmarklet(html: string, hostname: string): Promise<CaptureResult | null> {
  const here = dirname(fileURLToPath(import.meta.url));
  const code = await fs.readFile(resolve(here, "../public/bookmarklet.js"), "utf8");

  const { document, window } = parseHTML(html);
  // linkedom doesn't ship requestAnimationFrame; the bookmarklet schedules
  // its work through it, so polyfill to immediate.
  (window as unknown as { requestAnimationFrame: (cb: () => void) => void }).requestAnimationFrame = (cb) => cb();
  (window as unknown as { setTimeout: typeof setTimeout }).setTimeout = ((cb: () => void) => {
    cb();
    return 0;
  }) as unknown as typeof setTimeout;

  // Capture fetch
  let captured: CaptureResult | null = null;
  const fakeFetch = async (url: string, init?: RequestInit) => {
    captured = {
      url,
      body: JSON.parse((init?.body as string) || "{}"),
    };
    // Pretend the server saved it
    return new Response(JSON.stringify({ id: "TESTID01" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  // Provide a mock location (linkedom's default location is about:blank).
  Object.defineProperty(window, "location", {
    value: { hostname, href: `https://${hostname}/c/test` },
    writable: true,
  });
  // window.open is a no-op
  (window as unknown as { open: () => void }).open = () => {};

  // Run the bookmarklet inside a function scope where `window` and friends
  // are visible.
  const runner = new Function(
    "window",
    "document",
    "fetch",
    "requestAnimationFrame",
    "setTimeout",
    "location",
    code
  );
  runner(
    window,
    document,
    fakeFetch,
    (window as unknown as { requestAnimationFrame: (cb: () => void) => void }).requestAnimationFrame,
    (window as unknown as { setTimeout: typeof setTimeout }).setTimeout,
    (window as unknown as { location: Location }).location
  );

  // The fetch is async; wait a tick.
  await new Promise((r) => setTimeout(r, 10));
  return captured;
}

async function main() {
  // ─── ChatGPT fixture ───
  console.log("\n[1] ChatGPT page extraction");
  {
    const html = `
<!DOCTYPE html>
<html>
<head><title>Sorting algorithms - ChatGPT</title></head>
<body>
<div data-message-author-role="user">
  <div class="whitespace-pre-wrap">What's the fastest sorting algorithm in practice?</div>
</div>
<div data-message-author-role="assistant">
  <div class="markdown">
    <p>For most practical workloads, <strong>Timsort</strong> wins. It's the default in Python and Java for a reason.</p>
    <pre><code class="language-python">sorted_list = sorted(my_list)</code></pre>
    <ul><li>Stable</li><li>O(n log n) worst case</li></ul>
  </div>
</div>
<div data-message-author-role="user">
  <div class="whitespace-pre-wrap">Why not just always use quicksort?</div>
</div>
</body>
</html>`;
    const result = await runBookmarklet(html, "chatgpt.com");
    assert(result !== null, "fetch was called");
    assert(result?.url.endsWith("/api/docs"), "POSTed to /api/docs");
    assert(result?.body.source === "bookmarklet-chatgpt", "source tag is bookmarklet-chatgpt");
    assert(result?.body.title === "Sorting algorithms", `title cleaned (got "${result?.body.title}")`);
    const md = result?.body.markdown || "";
    assert(md.includes("# Sorting algorithms"), "title heading present");
    assert(md.includes("## You"), "user heading rendered");
    assert(md.includes("## ChatGPT"), "assistant heading rendered");
    assert(md.includes("What's the fastest sorting algorithm in practice?"), "first user msg present");
    assert(md.includes("Timsort"), "assistant text present");
    assert(md.includes("**Timsort**"), "bold preserved");
    assert(md.includes("```python"), "code block with language preserved");
    assert(md.includes("Why not just always use quicksort?"), "second user msg present");
    // Both user turns should appear before "ChatGPT" header occurs only once
    const userCount = (md.match(/## You/g) || []).length;
    const aiCount = (md.match(/## ChatGPT/g) || []).length;
    assert(userCount === 2 && aiCount === 1, `2 user + 1 assistant (got ${userCount}+${aiCount})`);
  }

  // ─── Claude fixture ───
  console.log("\n[2] Claude page extraction");
  {
    const html = `
<!DOCTYPE html>
<html>
<head><title>Pricing strategy - Claude</title></head>
<body>
<div data-testid="user-message"><p>How should I price my SaaS?</p></div>
<div class="font-claude-response">
  <p>Tiered freemium tends to work, with <em>three</em> tiers:</p>
  <ol><li>Free</li><li>Pro</li><li>Team</li></ol>
</div>
</body>
</html>`;
    const result = await runBookmarklet(html, "claude.ai");
    assert(result !== null, "fetch was called");
    assert(result?.body.source === "bookmarklet-claude", "source tag is bookmarklet-claude");
    const md = result?.body.markdown || "";
    assert(md.includes("## You"), "user heading present");
    assert(md.includes("## Claude"), "Claude heading present");
    assert(md.includes("How should I price my SaaS?"), "user msg present");
    assert(md.includes("Tiered freemium"), "assistant msg present");
    assert(md.includes("*three*"), "italic preserved");
    assert(md.includes("1. Free"), "ordered list rendered");
  }

  // ─── Gemini fixture ───
  console.log("\n[3] Gemini page extraction");
  {
    const html = `
<!DOCTYPE html>
<html>
<head><title>Quantum computing - Gemini</title></head>
<body>
<user-query><p>Explain Shor's algorithm in two sentences.</p></user-query>
<model-response>
  <p>Shor's algorithm factors integers in polynomial time on a quantum computer using the quantum Fourier transform.</p>
  <p>It threatens RSA because RSA's security depends on factoring being hard.</p>
</model-response>
</body>
</html>`;
    const result = await runBookmarklet(html, "gemini.google.com");
    assert(result !== null, "fetch was called");
    assert(result?.body.source === "bookmarklet-gemini", "source tag is bookmarklet-gemini");
    const md = result?.body.markdown || "";
    assert(md.includes("## You"), "user heading present");
    assert(md.includes("## Gemini"), "Gemini heading present");
    assert(md.includes("Shor's algorithm"), "user msg present");
    assert(md.includes("polynomial time"), "assistant msg present");
  }

  // ─── Empty page ───
  console.log("\n[4] Empty page does not POST");
  {
    const html = `<!DOCTYPE html><html><head><title>ChatGPT</title></head><body></body></html>`;
    const result = await runBookmarklet(html, "chatgpt.com");
    assert(result === null, "no fetch when no messages");
  }

  // ─── Unsupported host ───
  console.log("\n[5] Unsupported host does not POST");
  {
    const html = `<!DOCTYPE html><html><head><title>Random</title></head><body><p>Hello</p></body></html>`;
    const result = await runBookmarklet(html, "example.com");
    assert(result === null, "no fetch on non-AI host");
  }

  // ─── Re-entrancy guard ───
  console.log("\n[6] Re-entrancy guard prevents duplicate runs");
  {
    const html = `<!DOCTYPE html><html><head><title>Test - ChatGPT</title></head><body>
<div data-message-author-role="user"><div class="whitespace-pre-wrap">First</div></div>
<div data-message-author-role="assistant"><div class="markdown"><p>Reply</p></div></div>
</body></html>`;
    // Seed window.__mwBookmarkletActive before running
    const here = dirname(fileURLToPath(import.meta.url));
    const code = await fs.readFile(resolve(here, "../public/bookmarklet.js"), "utf8");
    const { document, window } = parseHTML(html);
    (window as unknown as { __mwBookmarkletActive: boolean }).__mwBookmarkletActive = true;
    let called = false;
    const runner = new Function("window", "document", "fetch", "requestAnimationFrame", "setTimeout", "location", code);
    runner(
      window,
      document,
      async () => { called = true; return new Response("{}"); },
      (cb: () => void) => cb(),
      ((cb: () => void) => { cb(); return 0; }) as unknown as typeof setTimeout,
      { hostname: "chatgpt.com", href: "https://chatgpt.com/c/test" }
    );
    await new Promise((r) => setTimeout(r, 10));
    assert(called === false, "guard prevented second invocation");
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
