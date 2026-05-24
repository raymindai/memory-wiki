// Pure-function tests for the GitHub URL parser plus a live smoke
// test against a known-public repo. The smoke test does NOT touch
// Supabase — it only proves importFromGithub can fetch real files.

import { parseGithubUrl, importFromGithub, type GithubLocation } from "../src/lib/github-import";

let pass = 0; let fail = 0;
const expect = (label: string, cond: boolean, detail?: string) => {
  if (cond) { console.log("PASS —", label); pass++; }
  else      { console.log("FAIL —", label, detail || ""); fail++; }
};

const eq = (a: GithubLocation | null, b: Partial<GithubLocation>): boolean => {
  if (!a) return false;
  return Object.entries(b).every(([k, v]) => (a as unknown as Record<string, unknown>)[k] === v);
};

// ── URL parser ─────────────────────────────────────────────────────
expect("repo home → tree mode, null branch + path",
  eq(parseGithubUrl("https://github.com/owner/repo"), { owner: "owner", repo: "repo", branch: null, path: null, mode: "tree" }));

expect("repo home with trailing slash",
  eq(parseGithubUrl("https://github.com/owner/repo/"), { owner: "owner", repo: "repo", branch: null, path: null, mode: "tree" }));

expect("/tree/<branch>",
  eq(parseGithubUrl("https://github.com/owner/repo/tree/main"), { owner: "owner", repo: "repo", branch: "main", path: null, mode: "tree" }));

expect("/tree/<branch>/<dir>",
  eq(parseGithubUrl("https://github.com/owner/repo/tree/main/docs"), { owner: "owner", repo: "repo", branch: "main", path: "docs", mode: "tree" }));

expect("/blob/<branch>/<file>",
  eq(parseGithubUrl("https://github.com/owner/repo/blob/main/README.md"), { owner: "owner", repo: "repo", branch: "main", path: "README.md", mode: "file" }));

expect("/blob/<branch>/<dir>/<file>",
  eq(parseGithubUrl("https://github.com/owner/repo/blob/main/docs/guide.md"), { owner: "owner", repo: "repo", branch: "main", path: "docs/guide.md", mode: "file" }));

expect("raw.githubusercontent.com URL",
  eq(parseGithubUrl("https://raw.githubusercontent.com/owner/repo/main/docs/guide.md"), { owner: "owner", repo: "repo", branch: "main", path: "docs/guide.md", mode: "file" }));

expect("rejects non-github host",        parseGithubUrl("https://gitlab.com/owner/repo") === null);
expect("rejects non-URL string",         parseGithubUrl("not a url") === null);
expect("rejects bare org",               parseGithubUrl("https://github.com/owner") === null);
expect("rejects empty input",            parseGithubUrl("") === null);

// ── Live smoke against a tiny public repo ──────────────────────────
const SMOKE_URL = process.env.MDFY_GH_TEST_URL || "https://github.com/raymindai/memory-wiki/blob/main/README.md";

(async () => {
  console.log("\n[live] importFromGithub(", SMOKE_URL, ")");
  const loc = parseGithubUrl(SMOKE_URL);
  if (!loc) {
    expect("smoke URL parses",            false, "couldn't parse — set MDFY_GH_TEST_URL to a public file URL");
  } else {
    try {
      const files = await importFromGithub(loc);
      expect("at least one file imported", files.length >= 1, `got ${files.length}`);
      const first = files[0];
      expect("file has markdown body",     !!first?.markdown && first.markdown.length > 10);
      expect("file has title",             !!first?.title && first.title.length > 0);
      expect("title doesn't end in .md",   !first.title.toLowerCase().endsWith(".md"));
      expect("sourceUrl points to github.com", first.sourceUrl.startsWith("https://github.com/"));
    } catch (err) {
      expect("smoke import succeeds", false, err instanceof Error ? err.message : String(err));
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})();
