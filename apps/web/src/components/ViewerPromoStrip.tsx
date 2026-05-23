"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import "../app/v8-preview/frontier/frontier.css";

// Sits between the viewer content and the footer. Frontier-styled section
// break: warm radial backdrop, eyebrow, big title, lede, primary CTA,
// quiet secondary link beneath. Owners see a single one-liner.

interface ViewerPromoStripProps {
  isOwner?: boolean;
}

export default function ViewerPromoStrip({ isOwner = false }: ViewerPromoStripProps) {
  if (isOwner) {
    return (
      <section className="v8-frontier promo-owner" data-frontier-theme="dark">
        <div className="promo-owner-inner">
          <span className="mono">
            Open your workspace to capture more, build bundles, and share your hub.
          </span>
          <Link href="/" className="promo-owner-link mono">
            Go to Memory.Wiki <ArrowRight size={12} strokeWidth={1.75} />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="v8-frontier promo" data-frontier-theme="dark">
      <div className="promo-inner">
        <div className="promo-eyebrow mono">PERSONAL KNOWLEDGE HUB FOR THE AI ERA</div>
        <h2 className="promo-title">Make your own.</h2>
        <p className="promo-lede">
          Capture from any AI tool. Bundles roll up by topic. Paste your hub
          URL into Claude, ChatGPT, or Cursor — they read it as your full
          personal context.
        </p>

        <div className="promo-cta-row">
          <Link href="/" className="promo-cta">
            <Sparkles size={14} strokeWidth={1.75} />
            <span>Start your hub</span>
            <ArrowRight size={14} strokeWidth={2} className="promo-cta-arrow" />
          </Link>
          <Link href="/install" className="promo-cta-secondary mono">
            Install /memory.wiki
          </Link>
        </div>

        <Link href="/how-memorywiki-works" className="promo-footnote mono">
          How Memory.Wiki works
          <ArrowRight size={10} strokeWidth={1.75} />
        </Link>
      </div>
    </section>
  );
}
