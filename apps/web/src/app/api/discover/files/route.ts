import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cache per repo for 1 hour
const fileCache = new Map<string, { files: string[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const repo = req.nextUrl.searchParams.get("repo");
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return NextResponse.json({ error: "Invalid repo" }, { status: 400 });
  }

  // Check cache
  const cached = fileCache.get(repo);
  if (cached && cached.timestamp > Date.now() - CACHE_TTL) {
    return NextResponse.json({ files: cached.files });
  }

  try {
    // Use GitHub Trees API to get all files recursively
    const res = await fetch(
      `https://api.github.com/repos/${repo}/git/trees/HEAD?recursive=1`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "mw-cc-discover",
          ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch repo tree" }, { status: 502 });
    }

    const data = await res.json();
    const mdFiles = (data.tree || [])
      .filter((f: { type: string; path: string }) =>
        f.type === "blob" && /\.(md|markdown|mdx)$/i.test(f.path)
      )
      .map((f: { path: string }) => f.path)
      .sort((a: string, b: string) => {
        // README first, then root level, then by path
        if (a === "README.md") return -1;
        if (b === "README.md") return 1;
        const aDepth = a.split("/").length;
        const bDepth = b.split("/").length;
        if (aDepth !== bDepth) return aDepth - bDepth;
        return a.localeCompare(b);
      })
      .slice(0, 50); // max 50 files

    fileCache.set(repo, { files: mdFiles, timestamp: Date.now() });
    return NextResponse.json({ files: mdFiles });
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 502 });
  }
}
