import Link from "next/link";
import {
  Layers, Globe, ArrowRight, Clock, Sparkles, ArrowUpRight, ExternalLink, Copy,
} from "lucide-react";
import HubCopyUrlButton from "./HubCopyUrlButton";
import ViewerHeader from "@/components/ViewerHeader";
import "../../v8-preview/frontier/frontier.css";

// IMPORTANT: the v8-frontier shell (aurora overlays, grain texture,
// forced data-frontier-theme="dark") used to wrap this whole viewer
// and made the hub face look like a totally different product from
// the doc / bundle viewers, which use plain ViewerHeader + var(--canvas).
// We've stripped the frontier shell and switched to the standard
// chrome so all three public viewers share one visual family.
// The .vhub-* class names stay (frontier.css already styled them
// chromelessly after the earlier polish pass) but the page no longer
// forces a theme — the user's data-theme on <html> wins.

type HubDoc = {
  id: string;
  title: string | null;
  markdown: string;
  updated_at: string;
  created_at: string;
};

type HubBundle = {
  id: string;
  title: string | null;
  description: string | null;
  updated_at: string;
  created_at: string;
};

type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  hub_slug: string;
  hub_description: string | null;
};

type Props = {
  slug: string;
  profile: Profile;
  docs: HubDoc[];
  bundles: HubBundle[];
  recent: HubDoc[];
  olderDocs: HubDoc[];
  hubUrl: string;
  atLabel: string | null;
  anchor: number;
};

function fmtRelative(iso: string, anchor: number): string {
  const ms = anchor - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days <= 6) return `${days}d ago`;
  if (days <= 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export default function HubViewerV8({
  slug,
  profile,
  docs,
  bundles,
  recent,
  olderDocs,
  hubUrl,
  atLabel,
  anchor,
}: Props) {
  const author = profile.display_name || slug;
  const initial = (author || "?").trim().charAt(0).toUpperCase() || "?";

  const totalWords = docs.reduce(
    (sum, d) => sum + (d.markdown || "").trim().split(/\s+/).filter(Boolean).length,
    0,
  );
  const indexTokens = totalWords > 0
    ? Math.round(totalWords * 1.3 + docs.length * 8)
    : null;
  const fmtTok = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

  const recentForList = recent.slice(0, 8);

  return (
    <div
      className="v8-frontier flex flex-col"
      style={{ background: "var(--canvas)", color: "var(--text-primary)" }}
    >
      {/* ViewerHeader lives in page.tsx (the wrapper) — don't render
          another one here, that was causing the doubled header bar. */}

      <main className="vhub">
        {atLabel && (
          <div className="vhub-time-banner">
            <Clock size={13} strokeWidth={1.75} />
            <span>
              Hub as of <strong>{atLabel}</strong>, with {docs.length} {docs.length === 1 ? "doc" : "docs"} and{" "}
              {bundles.length} {bundles.length === 1 ? "bundle" : "bundles"} that existed by then.
            </span>
            <Link href={`/@${slug}`} className="vhub-time-back">
              Back to now <ArrowRight size={11} strokeWidth={1.75} />
            </Link>
          </div>
        )}

        {/* Identity card — centered. Avatar carries a Globe corner
            overlay (public-only hub) so the share state reads at a
            glance — mirrors the Layers + Globe pattern in BundleOverview. */}
        <div className="vhub-card">
          <div className="vhub-avatar-wrap">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="vhub-avatar"
              />
            ) : (
              <div className="avatar xl vhub-avatar">{initial}</div>
            )}
            <span aria-hidden className="vhub-avatar-overlay" title="Public hub">
              <Globe size={14} strokeWidth={1.75} />
            </span>
          </div>
          <span className="vhub-access-pill mono">Public</span>
          <h1 className="vhub-name">{author}&apos;s hub</h1>
          {profile.hub_description ? (
            <p className="vhub-bio">{profile.hub_description}</p>
          ) : (
            <p className="vhub-bio vhub-bio-empty">
              Memory.Wiki hub at memory.wiki/@{slug}
            </p>
          )}

          <form action={`/@${slug}/search`} method="get" className="vhub-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="vhub-search-icon">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              name="q"
              placeholder={`Search ${author}'s hub`}
              maxLength={500}
              className="vhub-search-input"
            />
          </form>

          <div className="vhub-stats">
            <div className="vhub-stat">
              <span className="vhub-stat-num">{docs.length}</span>
              <span className="vhub-stat-label mono">{docs.length === 1 ? "Document" : "Documents"}</span>
            </div>
            <div className="vhub-stat">
              <span className="vhub-stat-num">{bundles.length}</span>
              <span className="vhub-stat-label mono">{bundles.length === 1 ? "Bundle" : "Bundles"}</span>
            </div>
            {recent.length > 0 && (
              <div className="vhub-stat">
                <span className="vhub-stat-num vhub-stat-accent">{recent.length}</span>
                <span className="vhub-stat-label mono">This Week</span>
              </div>
            )}
            {indexTokens && (
              <div className="vhub-stat">
                <span className="vhub-stat-num">≈{fmtTok(indexTokens)}</span>
                <span className="vhub-stat-label mono">Tokens</span>
              </div>
            )}
          </div>
        </div>

        {/* Deploy to AI panel */}
        <div className="vhub-deploy">
          <div className="vhub-deploy-head">
            <Sparkles size={16} strokeWidth={1.75} className="vhub-deploy-icon" />
            <div className="vhub-deploy-text">
              <div className="vhub-deploy-title">Deploy this hub to any AI</div>
              <p className="vhub-deploy-body">
                Paste the URL into <strong>Claude</strong>, <strong>ChatGPT</strong>, or{" "}
                <strong>Cursor</strong>. The AI fetches a structured index and follows
                the inline links to read individual docs and bundles as needed.
              </p>
            </div>
          </div>

          {/* URL + Copy as a single bordered card. URL on the left,
              Copy on the right split by a hairline divider. The Copy
              half flips to lime on success, mirroring the hero pattern
              in BundleOverview. */}
          <div className="vhub-deploy-urlcard">
            <code className="vhub-deploy-url mono">{hubUrl}</code>
            <HubCopyUrlButton url={hubUrl} />
          </div>

          {/* Demoted utility links — Raw .md is supporting nav, not a
              CTA. Right-aligned muted text-link with leading icon. */}
          <div className="vhub-deploy-utilrow">
            <Link
              href={`/raw/hub/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="vhub-deploy-util"
            >
              <ExternalLink size={11} strokeWidth={1.75} />
              Raw
            </Link>
            <Link
              href="/docs/integrate"
              target="_blank"
              rel="noopener noreferrer"
              className="vhub-deploy-util"
            >
              Full guide
              <ArrowUpRight size={11} strokeWidth={1.75} />
            </Link>
          </div>

          <div className="vhub-deploy-manifest mono">
            <span className="vhub-deploy-manifest-label">Wiki</span>
            <Link href={`/@${slug}/index.md`} target="_blank" className="vhub-deploy-link">index.md</Link>
            <Link href={`/@${slug}/SCHEMA.md`} target="_blank" className="vhub-deploy-link">SCHEMA.md</Link>
            <Link href={`/@${slug}/log.md`} target="_blank" className="vhub-deploy-link">log.md</Link>
            <span className="vhub-deploy-manifest-sep">/</span>
            <span className="vhub-deploy-manifest-label">For AI</span>
            <Link href={`/@${slug}/llms.txt`} target="_blank" className="vhub-deploy-link">llms.txt</Link>
            <Link href={`/@${slug}/llms-full.txt`} target="_blank" className="vhub-deploy-link">llms-full.txt</Link>
          </div>
        </div>

        {/* Bundles — all of them, uniform grid */}
        {bundles.length > 0 && (
          <section className="vhub-section">
            <header className="vhub-section-head">
              <div className="vhub-section-titles">
                <h2 className="vhub-section-title">Bundles</h2>
              </div>
              <span className="vhub-section-meta mono">
                {bundles.length} {bundles.length === 1 ? "item" : "items"}
              </span>
            </header>
            <div className="vhub-bundle-grid">
              {bundles.map((b) => (
                <Link key={b.id} href={`/b/${b.id}`} className="vhub-bundle-card">
                  <div className="vhub-bundle-head">
                    <Layers size={13} strokeWidth={1.75} className="vhub-bundle-icon" />
                    <div className="vhub-bundle-title">{b.title || "Untitled Bundle"}</div>
                  </div>
                  {b.description ? (
                    <p className="vhub-bundle-desc">{b.description}</p>
                  ) : (
                    <p className="vhub-bundle-desc vhub-bundle-desc-empty">No description</p>
                  )}
                  <div className="vhub-bundle-meta mono">
                    Updated {fmtRelative(b.updated_at, anchor)}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recent docs (last 7 days) */}
        {recentForList.length > 0 && (
          <section className="vhub-section">
            <header className="vhub-section-head">
              <div className="vhub-section-titles">
                <h2 className="vhub-section-title">Latest documents</h2>
              </div>
              <span className="vhub-section-meta mono">last 7 days</span>
            </header>
            <div className="vhub-doc-list">
              {recentForList.map((d) => (
                <Link key={d.id} href={`/d/${d.id}`} className="vhub-doc-row">
                  <Globe size={13} strokeWidth={1.75} className="vhub-doc-icon vhub-doc-icon-public" />
                  <span className="vhub-doc-title">{d.title || "Untitled"}</span>
                  <span className="vhub-doc-meta mono">memory.wiki/{d.id}</span>
                  <span className="vhub-doc-time mono">{fmtRelative(d.updated_at, anchor)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Older docs / Archive */}
        {olderDocs.length > 0 && (
          <section className="vhub-section">
            <header className="vhub-section-head">
              <div className="vhub-section-titles">
                <h2 className="vhub-section-title">
                  {recent.length > 0 ? "Older documents" : "Documents"}
                </h2>
              </div>
              <span className="vhub-section-meta mono">
                {olderDocs.length} {olderDocs.length === 1 ? "doc" : "docs"}
              </span>
            </header>
            <div className="vhub-doc-list">
              {olderDocs.slice(0, 30).map((d) => (
                <Link key={d.id} href={`/d/${d.id}`} className="vhub-doc-row">
                  <Globe size={12} strokeWidth={1.75} className="vhub-doc-icon vhub-doc-icon-public" />
                  <span className="vhub-doc-title vhub-doc-title-muted">{d.title || "Untitled"}</span>
                  <span className="vhub-doc-meta mono">memory.wiki/{d.id}</span>
                  <span className="vhub-doc-time mono">
                    {new Date(d.updated_at).toISOString().slice(0, 10)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {docs.length === 0 && bundles.length === 0 && (
          <div className="vhub-empty">
            {atLabel
              ? `No public docs or bundles existed in this hub on ${atLabel}.`
              : "This hub doesn't have any public documents yet."}
          </div>
        )}
      </main>
    </div>
  );
}
