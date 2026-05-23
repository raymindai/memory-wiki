"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import type { ReferencedBy as ReferencedByData } from "@/lib/queryBacklinks";

const DocumentViewer = dynamic(() => import("./DocumentViewer"), { ssr: false });

export default function ClientViewer(props: {
  id: string;
  markdown: string;
  title: string | null;
  isProtected?: boolean;
  isExpired?: boolean;
  isRestricted?: boolean;
  showBadge?: boolean;
  editMode?: string;
  referencedBy?: ReferencedByData;
}) {
  // Strip the SSR fallback article once we're on the client. The page
  // emits a server-rendered <article id="memory-wiki-ssr-body"> for
  // crawlers (ChatGPT/Claude/Google all skip JS), and DocumentViewer
  // takes over for the interactive view.
  useEffect(() => {
    const ssr = document.getElementById("memory-wiki-ssr-body");
    if (ssr) ssr.remove();
  }, []);

  return <DocumentViewer {...props} />;
}
