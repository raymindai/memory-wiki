"use client";

import { type ReactNode } from "react";
import "../styles/components/pure-cta-band.css";
import { PureButton } from "./PureButton";

/**
 * PureCTABand — final-fold CTA section with headline + lede + button.
 * Optional brand blob backdrop (light/dark variants swap on theme).
 */
export function PureCTABand({
  eyebrow = "Ready",
  heading,
  lede,
  button,
  withBlob = true,
}: {
  eyebrow?: string;
  heading: ReactNode;
  lede?: ReactNode;
  button: { label: string; href: string };
  withBlob?: boolean;
}) {
  return (
    <section className="pure-section">
      <div className="pure-cta-band">
        {withBlob && (
          <>
            <img
              src="/brand/mwblob_morph.svg"
              alt=""
              aria-hidden
              className="pure-cta-band-blob pure-cta-band-blob-dark"
            />
            <img
              src="/brand/mwblob_morph_dark.svg"
              alt=""
              aria-hidden
              className="pure-cta-band-blob pure-cta-band-blob-light"
            />
          </>
        )}
        <div className="pure-cta-band-inner">
          <span className="pure-cta-band-eyebrow mono">
            <span className="pure-cta-band-eyedot" />
            {eyebrow}
          </span>
          <h2 className="pure-cta-band-heading">{heading}</h2>
          {lede && <p className="pure-cta-band-lede">{lede}</p>}
          <PureButton href={button.href} size="lg">{button.label}</PureButton>
        </div>
      </div>
    </section>
  );
}
