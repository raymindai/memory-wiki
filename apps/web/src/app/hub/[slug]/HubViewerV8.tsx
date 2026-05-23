import Link from "next/link";
import {
  Layers, Globe, ArrowRight, Clock, Sparkles,
} from "lucide-react";
import HubCopyUrlButton from "./HubCopyUrlButton";
import "../../v8-preview/frontier/frontier.css";

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
    <div className="v8-frontier" data-frontier-theme="dark">
      <div className="aurora aurora-1" aria-hidden />
      <div className="aurora aurora-2" aria-hidden />
      <div className="grain" aria-hidden />

      <main className="vhub">
        {atLabel && (
          <div className="vhub-time-banner">
            <Clock size={13} strokeWidth={1.75} />
            <span>
              Hub as of <strong>{atLabel}</strong> — {docs.length} {docs.length === 1 ? "doc" : "docs"} and{" "}
              {bundles.length} {bundles.length === 1 ? "bundle" : "bundles"} that existed by then.
            </span>
            <Link href={`/hub/${slug}`} className="vhub-time-back">
              Back to now <ArrowRight size={11} strokeWidth={1.75} />
            </Link>
          </div>
        )}

        {/* Identity card — centered */}
        <div className="vhub-card">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="vhub-avatar"
            />
          ) : (
            <div className="avatar xl vhub-avatar">{initial}</div>
          )}
          <h1 className="vhub-name">{author}&apos;s hub</h1>
          {profile.hub_description ? (
            <p className="vhub-bio">{profile.hub_description}</p>
          ) : (
            <p className="vhub-bio vhub-bio-empty">
              Memory.Wiki hub at memory.wiki/hub/{slug}
            </p>
          )}

          <form action={`/hub/${slug}/search`} method="get" className="vhub-search">
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
              <span className="vhub-stat-label mono">{docs.length === 1 ? "document" : "documents"}</span>
            </div>
            <div className="vhub-stat">
              <span className="vhub-stat-num">{bundles.length}</span>
              <span className="vhub-stat-label mono">{bundles.length === 1 ? "bundle" : "bundles"}</span>
            </div>
            {recent.length > 0 && (
              <div className="vhub-stat">
                <span className="vhub-stat-num vhub-stat-accent">{recent.length}</span>
                <span className="vhub-stat-label mono">this week</span>
              </div>
            )}
            {indexTokens && (
              <div className="vhub-stat">
                <span className="vhub-stat-num">≈ {fmtTok(indexTokens)}</span>
                <span className="vhub-stat-label mono">tokens</span>
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

          <div className="vhub-deploy-url-row">
            <code className="vhub-deploy-url mono">{hubUrl}</code>
            <HubCopyUrlButton url={hubUrl} />
            <Link
              href={`/hub/${slug}.md`}
              target="_blank"
              className="vhub-deploy-raw"
            >
              View raw .md
            </Link>
          </div>

          <div className="vhub-deploy-manifest mono">
            <span className="vhub-deploy-manifest-label">Wiki</span>
            <Link href={`/hub/${slug}/index.md`} target="_blank" className="vhub-deploy-link">index.md</Link>
            <Link href={`/hub/${slug}/SCHEMA.md`} target="_blank" className="vhub-deploy-link">SCHEMA.md</Link>
            <Link href={`/hub/${slug}/log.md`} target="_blank" className="vhub-deploy-link">log.md</Link>
            <span className="vhub-deploy-manifest-sep">/</span>
            <span className="vhub-deploy-manifest-label">For AI</span>
            <Link href={`/hub/${slug}/llms.txt`} target="_blank" className="vhub-deploy-link">llms.txt</Link>
            <Link href={`/hub/${slug}/llms-full.txt`} target="_blank" className="vhub-deploy-link">llms-full.txt</Link>
          </div>
        </div>

        {/* Bundles — all of them, uniform grid */}
        {bundles.length > 0 && (
          <section className="vhub-section">
            <header className="vhub-section-head">
              <div className="vhub-section-titles">
                <div className="vhub-section-eyebrow mono">BUNDLES</div>
                <h2 className="vhub-section-title">
                  {bundles.length === 1 ? "1 bundle" : `${bundles.length} bundles`}
                </h2>
              </div>
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
                <div className="vhub-section-eyebrow mono">RECENT</div>
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
                <div className="vhub-section-eyebrow mono">ARCHIVE</div>
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
