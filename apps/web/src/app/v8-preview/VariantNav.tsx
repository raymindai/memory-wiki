"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const VARIANTS = [
  { slug: "/v8-preview", label: "A / Warm Serif", swatch: "#fb923c" },
  { slug: "/v8-preview/light", label: "B / Light Paper", swatch: "#faf6ee" },
  { slug: "/v8-preview/mono", label: "C / Dark Edge", swatch: "#84cc16" },
  { slug: "/v8-preview/glass", label: "D / Liquid Glass", swatch: "#9ec5ff" },
  { slug: "/v8-preview/editorial", label: "E / Editorial", swatch: "#cc785c" },
  { slug: "/v8-preview/lovable", label: "F / Lovable", swatch: "#f7f4ed" },
  { slug: "/v8-preview/wise", label: "G / Wise", swatch: "#9fe870" },
  { slug: "/v8-preview/miro", label: "H / Miro", swatch: "#ffe600" },
  { slug: "/v8-preview/clay", label: "I / Clay", swatch: "#ff4d8b" },
  { slug: "/v8-preview/clay-mono", label: "I.2 / Clay Mono", swatch: "#b8a4ed" },
  { slug: "/v8-preview/clay-stack", label: "I.3 / Clay Stack", swatch: "#1a3a3a" },
  { slug: "/v8-preview/modern", label: "J / Modern", swatch: "#ea580c" },
  { slug: "/v8-preview/frontier", label: "K / Frontier", swatch: "#ff7a3d" },
];

export function VariantNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = VARIANTS.find((v) => v.slug === pathname);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 60,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: 12,
      }}
    >
      {open ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            background: "rgba(20, 18, 16, 0.92)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(14px) saturate(150%)",
            WebkitBackdropFilter: "blur(14px) saturate(150%)",
            borderRadius: 12,
            padding: 6,
            maxHeight: "60vh",
            overflowY: "auto",
            minWidth: 200,
            boxShadow: "0 12px 32px rgba(0, 0, 0, 0.3)",
          }}
        >
          <button
            onClick={() => setOpen(false)}
            style={{
              background: "transparent",
              border: 0,
              color: "rgba(255, 255, 255, 0.5)",
              fontSize: 11,
              padding: "6px 12px",
              textAlign: "left",
              cursor: "pointer",
              borderRadius: 8,
            }}
          >
            close
          </button>
          {VARIANTS.map((v) => {
            const active = pathname === v.slug;
            return (
              <Link
                key={v.slug}
                href={v.slug}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  color: active ? "#1a1714" : "#d4cfc4",
                  background: active ? "#faf5ed" : "transparent",
                  textDecoration: "none",
                  fontWeight: active ? 600 : 500,
                  transition: "all 120ms ease",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: v.swatch,
                    border: "1px solid rgba(255, 255, 255, 0.2)",
                    flexShrink: 0,
                  }}
                />
                {v.label}
              </Link>
            );
          })}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Pick design variant"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(20, 18, 16, 0.88)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(14px) saturate(150%)",
            WebkitBackdropFilter: "blur(14px) saturate(150%)",
            borderRadius: 9999,
            padding: "8px 14px 8px 10px",
            color: "#faf5ed",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            boxShadow: "0 4px 16px rgba(0, 0, 0, 0.18)",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: current?.swatch ?? "#fb923c",
              border: "1px solid rgba(255, 255, 255, 0.2)",
            }}
          />
          {current?.label ?? "Variants"}
          <span style={{ opacity: 0.6, marginLeft: 4, fontSize: 10 }}>open</span>
        </button>
      )}
    </div>
  );
}
