import NotFoundPure from "./NotFoundPure";

/**
 * Global 404 — used when no more specific not-found.tsx (e.g.
 * /d/[id]/not-found, /b/[id]/not-found, /hub/[slug]/not-found)
 * matches the route. Rendered with the Pure design system so the
 * brand feel stays consistent across every miss.
 */
export default function GlobalNotFound() {
  return <NotFoundPure />;
}
