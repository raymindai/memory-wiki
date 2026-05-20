// W12b — cross-reference extraction across public mdfy URLs.
//
// Given a corpus of public document markdown, find every internal
// mdfy reference and roll them up by target. A "reference" here is any
// link whose href resolves to /<docId>, /d/<docId>, /b/<bundleId>, or
// /hub/<slug> on memory.wiki (or staging.memory.wiki). Plain URLs without
// markdown link syntax also count, so links pasted into a captured
// chat transcript are caught too.
//
// Usage: feed in `docs: { id, user_id, markdown }[]` plus a known set
// of doc / bundle / hub-slug ids. The extractor only counts targets
// that exist in the corpus — random external strings can't game the
// citation count.

const HOST_PATTERN = "(?:https?://(?:www\\.)?(?:staging\\.)?mdfy\\.app)?";
const DOC_RE = new RegExp(`${HOST_PATTERN}/(?:d/)?([A-Za-z0-9]{6,16})\\b`, "g");
const BUNDLE_RE = new RegExp(`${HOST_PATTERN}/b/([A-Za-z0-9]{6,16})\\b`, "g");
const HUB_RE = new RegExp(`${HOST_PATTERN}/hub/([a-z0-9_-]{3,32})\\b`, "g");

export interface CrossRefSource {
  id: string;
  user_id: string;
  markdown: string;
}

export interface CrossRefTotals {
  docCitations: Map<string, Set<string>>;
  bundleCitations: Map<string, Set<string>>;
  hubCitations: Map<string, Set<string>>;
}

export function extractCrossRefs(
  sources: CrossRefSource[],
  knownDocIds: Set<string>,
  knownBundleIds: Set<string>,
  knownHubSlugs: Set<string>,
): CrossRefTotals {
  const docCitations = new Map<string, Set<string>>();
  const bundleCitations = new Map<string, Set<string>>();
  const hubCitations = new Map<string, Set<string>>();

  const bump = (
    map: Map<string, Set<string>>,
    target: string,
    sourceDocId: string,
  ) => {
    let set = map.get(target);
    if (!set) {
      set = new Set();
      map.set(target, set);
    }
    set.add(sourceDocId);
  };

  for (const src of sources) {
    if (!src.markdown) continue;

    // Collect all matches per source so we can resolve the BUNDLE_RE
    // before the more permissive DOC_RE (a /b/<id> URL would otherwise
    // also match /<id>).
    const seenDocs = new Set<string>();
    const seenBundles = new Set<string>();
    const seenHubs = new Set<string>();

    BUNDLE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = BUNDLE_RE.exec(src.markdown)) !== null) {
      if (knownBundleIds.has(m[1])) seenBundles.add(m[1]);
    }
    HUB_RE.lastIndex = 0;
    while ((m = HUB_RE.exec(src.markdown)) !== null) {
      if (knownHubSlugs.has(m[1])) seenHubs.add(m[1]);
    }

    // Strip already-matched bundle URLs before scanning for docs so
    // /b/abc doesn't double-count against doc id "abc". Cheaper than
    // tracking match ranges.
    let docScan = src.markdown;
    if (seenBundles.size > 0) {
      docScan = docScan.replace(BUNDLE_RE, "");
    }
    DOC_RE.lastIndex = 0;
    while ((m = DOC_RE.exec(docScan)) !== null) {
      // Don't count a doc citing itself.
      if (m[1] === src.id) continue;
      if (knownDocIds.has(m[1])) seenDocs.add(m[1]);
    }

    for (const t of seenDocs) bump(docCitations, t, src.id);
    for (const t of seenBundles) bump(bundleCitations, t, src.id);
    for (const t of seenHubs) bump(hubCitations, t, src.id);
  }

  return { docCitations, bundleCitations, hubCitations };
}

export interface RankedCitation {
  targetId: string;
  citationCount: number;
  citingDocIds: string[];
}

export function rankCitations(
  map: Map<string, Set<string>>,
  limit: number,
): RankedCitation[] {
  return Array.from(map.entries())
    .map(([targetId, citingSet]) => ({
      targetId,
      citationCount: citingSet.size,
      citingDocIds: Array.from(citingSet),
    }))
    .sort((a, b) => b.citationCount - a.citationCount)
    .slice(0, limit);
}
