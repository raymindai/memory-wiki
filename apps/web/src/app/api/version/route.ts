import { NextResponse } from "next/server";

// Returns the build identifier of the CURRENTLY-SERVING deployment.
//
// The client bundle bakes its own build id at build time
// (NEXT_PUBLIC_BUILD_ID, wired in next.config.ts). A long-open tab keeps
// running whatever bundle it loaded; meanwhile new pushes roll the prod
// deployment forward. VersionWatcher polls this route and compares the
// runtime id here against its baked id — a mismatch means "you are running
// stale client code, reload." This is the structural fix for the
// stale-bundle phantom-conflict class of bug (see memory
// conflict_baseline_invariant): server fixes go live on push but
// client-side fixes live in the bundle, so an un-reloaded tab silently
// runs old logic.
//
// Must never be cached: the SW already skips /api/* (network-only) and we
// also send no-store so the browser HTTP cache can't pin an old answer.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  const sha =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.NEXT_PUBLIC_BUILD_ID ||
    "dev";
  return NextResponse.json(
    { sha },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
      },
    },
  );
}
