"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import MemoryWikiLogo from "@/components/MemoryWikiLogo";
import type { ReferencedBy as ReferencedByData } from "@/lib/queryBacklinks";

function BundleLoading({ title }: { title: string | null }) {
  return (
    <div
      className="flex flex-col items-center justify-center h-screen gap-6"
      style={{ background: "var(--background)" }}
    >
      <MemoryWikiLogo size={30} />
      {title && (
        <h1 className="text-sm font-medium px-4 text-center" style={{ color: "var(--text-secondary)" }}>
          {title}
        </h1>
      )}
      <span className="text-xs tracking-wide" style={{ color: "var(--text-faint)" }}>
        Loading bundle...
      </span>
      <div
        className="w-32 h-0.5 rounded-full overflow-hidden"
        style={{ background: "var(--border-dim)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            background: "var(--accent)",
            animation: "bundleloadbar 1.2s ease-in-out infinite",
          }}
        />
      </div>
      <style>{`
        @keyframes bundleloadbar {
          0% { width: 0%; margin-left: 0%; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      `}</style>
    </div>
  );
}

interface ClientViewerProps {
  id: string;
  title: string | null;
  description?: string | null;
  isProtected?: boolean;
  isDraft?: boolean;
  documentCount: number;
  showBadge?: boolean;
  layout?: string;
  referencedBy?: ReferencedByData;
}

const BundleViewer = dynamic<ClientViewerProps>(() => import("./BundleViewer"), {
  ssr: false,
  // The chunk for BundleViewer pulls in @xyflow/react + elkjs which is non-trivial.
  // Without this loading shell, the route renders a blank page until JS arrives.
  loading: () => <BundleLoading title={null} />,
});

export default function ClientViewer(props: ClientViewerProps) {
  // Remove the SSR fallback article (rendered in page.tsx for crawlers)
  // once we're on the client and BundleViewer is mounting.
  useEffect(() => {
    const ssr = document.getElementById("memory-wiki-ssr-body");
    if (ssr) ssr.remove();
  }, []);

  return <BundleViewer {...props} />;
}
