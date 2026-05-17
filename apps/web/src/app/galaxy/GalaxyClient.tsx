"use client";

// /galaxy client wrapper.
// Resolves the signed-in user via useAuth, builds auth headers, then
// hands them to HubGalaxy. HubGalaxy itself renders an auth-wall when
// the API returns 401, so the unauthenticated path stays single-source.

import dynamic from "next/dynamic";
import { useAuth } from "@/lib/useAuth";
import { buildAuthHeaders } from "@/lib/auth-fetch";

// HubGalaxy depends on xyflow + elkjs — heavy client modules. Keep
// them out of the SSR pass so the route stays snappy on cold load.
const HubGalaxy = dynamic(() => import("@/components/HubGalaxy"), {
  ssr: false,
  loading: () => null,
});

export default function GalaxyClient() {
  const { user, accessToken, loading } = useAuth();
  if (loading) return null;
  const headers = buildAuthHeaders({
    accessToken,
    userId: user?.id,
    userEmail: user?.email,
  });
  return <HubGalaxy authHeaders={headers} userEmail={user?.email ?? null} />;
}
