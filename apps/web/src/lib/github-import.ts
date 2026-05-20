// GitHub URL → list of .md files to ingest.
//
// Accepts the URL forms developers actually paste:
//
//   https://github.com/<o>/<r>                          → repo home, all .md
//   https://github.com/<o>/<r>/tree/<branch>            → tree, all .md
//   https://github.com/<o>/<r>/tree/<branch>/<dir>      → subdir, all .md
//   https://github.com/<o>/<r>/blob/<branch>/<path>.md  → single .md file
//   https://raw.githubusercontent.com/<o>/<r>/<branch>/<path>.md → single (raw)
//
// Public repos only for v1 — uses unauthenticated GitHub API
// (60 req / hour from a single Vercel egress IP, fine for the
// current ingest scale). Private repos require a PAT, deferred.
//
// The shape this module emits is "imported files ready to insert":
// each entry has the raw markdown, a derived title, a stable file
// path, and the source URL. Caller turns each into a documents row.

const RAW_HOST = "raw.githubusercontent.com";
const API_HOST = "api.github.com";

export interface GithubLocation {
  owner: string;
  repo: string;
  branch: string | null;       // null = use repo's default branch
  path: string | null;         // null = root
  mode: "file" | "tree";
}

export interface ImportedFile {
  path: string;                // e.g. docs/guide.md
  title: string;               // first H1 or filename
  markdown: string;            // raw contents
  sourceUrl: string;           // canonical github.com URL for this file
  rawUrl: string;              // raw.githubusercontent.com URL
}

export class GithubImportError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

/** Parse a GitHub URL into the parts the importer needs. */
export function parseGithubUrl(input: string): GithubLocation | null {
  let url: URL;
  try { url = new URL(input.trim()); } catch { return null; }

  // raw.githubusercontent.com/<o>/<r>/<branch>/<path>
  if (url.hostname === RAW_HOST) {
    const parts = url.pathname.replace(/^\/+/, "").split("/");
    if (parts.length < 4) return null;
    const [owner, repo, branch, ...rest] = parts;
    const path = rest.join("/");
    return { owner, repo, branch, path, mode: "file" };
  }

  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;

  const parts = url.pathname.replace(/^\/+/, "").replace(/\/+$/, "").split("/");
  if (parts.length < 2) return null;
  const [owner, repo, kind, branch, ...rest] = parts;

  // /<o>/<r>
  if (parts.length === 2) {
    return { owner, repo, branch: null, path: null, mode: "tree" };
  }

  // /<o>/<r>/blob/<branch>/<path>
  if (kind === "blob" && branch && rest.length > 0) {
    return { owner, repo, branch, path: rest.join("/"), mode: "file" };
  }

  // /<o>/<r>/tree/<branch>[/<dir>]
  if (kind === "tree" && branch) {
    return { owner, repo, branch, path: rest.length > 0 ? rest.join("/") : null, mode: "tree" };
  }

  return null;
}

interface GithubRepoMeta { default_branch: string }
interface GithubTreeEntry { path: string; type: "blob" | "tree" | "commit"; size?: number }
interface GithubTreeResponse { tree: GithubTreeEntry[]; truncated?: boolean }

const COMMON_HEADERS: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "Memory.Wiki",
};

async function ghJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: COMMON_HEADERS });
  if (!res.ok) {
    throw new GithubImportError(
      res.status === 404
        ? "Repo not found or not public. Private repos aren't supported yet."
        : res.status === 403
          ? "GitHub API rate limit hit. Try again in a few minutes."
          : `GitHub API ${res.status}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

async function ghText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "Memory.Wiki" } });
  if (!res.ok) throw new GithubImportError(`Failed to fetch raw file (${res.status})`, res.status);
  return await res.text();
}

async function resolveBranch(owner: string, repo: string, branch: string | null): Promise<string> {
  if (branch) return branch;
  const meta = await ghJson<GithubRepoMeta>(`https://${API_HOST}/repos/${owner}/${repo}`);
  return meta.default_branch;
}

function deriveTitle(path: string, body: string): string {
  const h1 = body.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const name = path.split("/").pop() || "Untitled";
  return name.replace(/\.md$/i, "");
}

const MAX_FILES_PER_IMPORT = 80;
const MAX_FILE_BYTES = 200_000;

export async function importFromGithub(loc: GithubLocation): Promise<ImportedFile[]> {
  const branch = await resolveBranch(loc.owner, loc.repo, loc.branch);

  if (loc.mode === "file") {
    if (!loc.path) throw new GithubImportError("File path missing in URL", 400);
    if (!/\.md$/i.test(loc.path)) throw new GithubImportError("Only .md files are supported", 400);
    const rawUrl = `https://${RAW_HOST}/${loc.owner}/${loc.repo}/${branch}/${loc.path}`;
    const markdown = await ghText(rawUrl);
    const title = deriveTitle(loc.path, markdown);
    const sourceUrl = `https://github.com/${loc.owner}/${loc.repo}/blob/${branch}/${loc.path}`;
    return [{ path: loc.path, title, markdown, sourceUrl, rawUrl }];
  }

  // Tree mode — list every .md under the prefix.
  const treeUrl = `https://${API_HOST}/repos/${loc.owner}/${loc.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const tree = await ghJson<GithubTreeResponse>(treeUrl);
  const prefix = loc.path ? loc.path.replace(/\/+$/, "") + "/" : "";
  const candidates = (tree.tree || []).filter((e) => {
    if (e.type !== "blob") return false;
    if (!/\.md$/i.test(e.path)) return false;
    if (prefix && !e.path.startsWith(prefix)) return false;
    if ((e.size ?? 0) > MAX_FILE_BYTES) return false;
    return true;
  });

  if (candidates.length === 0) {
    throw new GithubImportError("No .md files found under that path", 404);
  }
  if (candidates.length > MAX_FILES_PER_IMPORT) {
    throw new GithubImportError(
      `Too many files (${candidates.length}). Narrow the path or import a subdirectory.`,
      400,
    );
  }

  const out: ImportedFile[] = [];
  // Fetch in series — keeps us well under GitHub's per-IP limits.
  for (const entry of candidates) {
    try {
      const rawUrl = `https://${RAW_HOST}/${loc.owner}/${loc.repo}/${branch}/${entry.path}`;
      const markdown = await ghText(rawUrl);
      const title = deriveTitle(entry.path, markdown);
      const sourceUrl = `https://github.com/${loc.owner}/${loc.repo}/blob/${branch}/${entry.path}`;
      out.push({ path: entry.path, title, markdown, sourceUrl, rawUrl });
    } catch (err) {
      // Skip individual file failures — partial imports are fine.
      console.warn(`github-import: skipped ${entry.path}:`, err instanceof Error ? err.message : err);
    }
  }
  return out;
}
