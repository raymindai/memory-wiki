"use client";

/**
 * /plugins — six plugin surfaces rendered with the Pure design system.
 * Wider layout than the essay pages (1080px) to fit feature grids per
 * plugin. Reuses the existing getPluginsTexts(locale) data — no new
 * content file needed.
 */

import Link from "next/link";
import "./plugins.css";
import {
  PureButton,
  PureCodeBlock,
  ProviderIcon,
  type ProviderBrand,
} from "@/components/pure";
import PureDocsShell, { memoryWikiNavGroups } from "@/components/PureDocsShell";
import { getPluginsTexts } from "@/lib/i18n/plugins";

type TerminalLine = {
  type: "prompt" | "output" | "comment" | "success";
  label?: string;
  text: string;
  url?: string;
};

function PluginTerminal({ title, lines }: { title: string; lines: TerminalLine[] }) {
  return (
    <div className="pure-plugins-terminal">
      <div className="pure-plugins-terminal-head">
        <span className="pure-plugins-terminal-dots" aria-hidden>
          <span /><span /><span />
        </span>
        <span className="pure-plugins-terminal-title mono">{title}</span>
      </div>
      <pre className="pure-plugins-terminal-body">
        {lines.map((l, i) => (
          <div key={i} className={`pure-plugins-terminal-line is-${l.type}`}>
            {l.label && <span className="pure-plugins-terminal-label">{l.label}</span>}
            <span>{l.text}</span>
            {l.url && (
              <a href={l.url} className="pure-plugins-terminal-url">{l.url}</a>
            )}
          </div>
        ))}
      </pre>
    </div>
  );
}

function PluginFeatures({ groups }: { groups: { title: string; items: string[] }[] }) {
  return (
    <div className="pure-plugins-features">
      {groups.map((g) => (
        <div key={g.title} className="pure-plugins-feature">
          <div className="pure-plugins-feature-title">{g.title}</div>
          <ul>
            {g.items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function PluginsPure({ locale = "en" }: { locale?: "en" | "ko" }) {
  const t = getPluginsTexts(locale);
  const isKo = locale === "ko";

  return (
    <PureDocsShell
      locale={locale}
      currentPath={isKo ? "/ko/plugins" : "/plugins"}
      navGroups={memoryWikiNavGroups(locale)}
      toc={[
        { id: "chrome",    label: isKo ? "Chrome 확장"      : "Chrome extension" },
        { id: "safari",    label: isKo ? "Safari 확장"      : "Safari extension" },
        { id: "mcp",       label: isKo ? "MCP 서버"         : "MCP server" },
        { id: "vscode",    label: isKo ? "VS Code 확장"     : "VS Code extension" },
        { id: "desktop",   label: isKo ? "Mac 데스크톱"     : "Mac desktop" },
        { id: "ios",       label: isKo ? "iOS 앱"           : "iOS app" },
        { id: "android",   label: isKo ? "Android 앱"       : "Android app" },
        { id: "cli",       label: "CLI" },
        { id: "quicklook", label: "QuickLook" },
      ]}
    >
          <div className="pure-plugins-page">
            {/* Hero */}
            <section className="pure-plugins-hero">
              <div className="pure-plugins-eyebrow mono">{t.hero.label}</div>
              <h1 className="pure-plugins-h1">
                {t.hero.h1_prefix}{t.hero.h1_accent}{t.hero.h1_suffix}
              </h1>
              <p className="pure-plugins-lede">{t.hero.sub}</p>
            </section>

            {/* Use cases */}
            <section className="pure-plugins-section">
              <div className="pure-plugins-section-eyebrow mono">{t.useCases.heading}</div>
              <div className="pure-plugins-use-grid">
                {t.useCases.items.map((uc, i) => (
                  <article key={i} className="pure-plugins-use-card">
                    <div className="pure-plugins-use-num mono">{String(i + 1).padStart(2, "0")}</div>
                    <h3 className="pure-plugins-use-title">{uc.scenario}</h3>
                    <p className="pure-plugins-use-steps mono">{uc.steps}</p>
                    <p className="pure-plugins-use-why">{uc.why}</p>
                  </article>
                ))}
              </div>
            </section>

            {/* Short URL */}
            <section className="pure-plugins-section">
              <div className="pure-plugins-shorturl">
                <div>
                  <h2 className="pure-plugins-sub-h2">{t.shortUrl.heading}</h2>
                  <p className="pure-plugins-body">{t.shortUrl.desc}</p>
                  <p className="pure-plugins-note">{t.shortUrl.note}</p>
                </div>
                <div className="pure-plugins-shorturl-example">
                  <div className="pure-plugins-shorturl-label mono">{t.shortUrl.exampleLabel}</div>
                  {t.shortUrl.lines.map((line, i) => (
                    <div key={i} className="pure-plugins-shorturl-line mono">
                      <span className={line.speaker === "AI:" ? "is-ai" : "is-you"}>{line.speaker}</span>{" "}
                      <span>{line.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Chrome */}
            <PluginBlock id="chrome" num="01" brand="chrome" t={t.chrome}>
              <PluginFeatures groups={t.chrome.features} />
              <PluginInstall heading={t.chrome.installHeading} steps={t.chrome.installSteps} />
              <PluginDownload
                primary={{
                  label: "Download v2.2.2 · 50 KB",
                  href: "/downloads/memory-wiki-chrome.zip",
                }}
                secondary={{ label: t.chrome.guideLabel, href: locale === "ko" ? "/ko/docs" : "/docs" }}
              />
            </PluginBlock>

            {/* Safari */}
            <PluginBlock id="safari" num="02" brand="safari" t={t.safari}>
              <PluginFeatures groups={t.safari.features} />
              <PluginInstall heading={t.safari.installHeading} steps={t.safari.installSteps} />
              <PluginDownload
                primary={{ label: t.safari.downloadLabel, href: "https://apps.apple.com" }}
                secondary={{ label: t.safari.guideLabel, href: locale === "ko" ? "/ko/docs" : "/docs" }}
              />
            </PluginBlock>

            {/* MCP */}
            <PluginBlock id="mcp" num="03" brand="mcp" t={t.mcp}>
              <PluginTerminal title={t.mcp.terminal.title} lines={t.mcp.terminal.lines as TerminalLine[]} />
              <PluginFeatures groups={t.mcp.features} />
              <h3 className="pure-plugins-install-heading">{t.mcp.installHeading}</h3>
              <div className="pure-plugins-mcp-option">
                <div className="pure-plugins-mcp-option-label mono">{t.mcp.optionA.label}</div>
                <p className="pure-plugins-body">{t.mcp.optionA.desc}</p>
                <PureCodeBlock code="https://memory.wiki/api/mcp" lang="http" />
              </div>
              <div className="pure-plugins-mcp-option">
                <div className="pure-plugins-mcp-option-label mono">{t.mcp.optionB.label}</div>
                <p className="pure-plugins-body">
                  {t.mcp.optionB.desc_prefix} <code>{t.mcp.optionB.desc_file}</code> {t.mcp.optionB.desc_suffix}
                </p>
                <PureCodeBlock
                  lang="json"
                  code={`{
  "mcpServers": {
    "memory-wiki": {
      "command": "npx",
      "args": ["-y", "memory-wiki-mcp"]
    }
  }
}`}
                />
              </div>
              <PluginDownload
                primary={{ label: t.mcp.footerLinks.setupGuideLabel, href: locale === "ko" ? "/ko/docs/mcp" : "/docs/mcp" }}
                secondary={{ label: `${t.mcp.footerLinks.npmLabel} · v1.5.1`, href: "https://www.npmjs.com/package/memory-wiki-mcp" }}
              />
            </PluginBlock>

            {/* VS Code */}
            <PluginBlock id="vscode" num="04" brand="vscode" t={t.vscode}>
              <PluginFeatures groups={t.vscode.features} />
              <PluginInstall heading={t.vscode.installHeading} steps={t.vscode.installSteps} />
              <PluginDownload
                primary={{ label: "Install v1.4.26 from Marketplace", href: "https://marketplace.visualstudio.com/items?itemName=raymindai.memory-wiki-vscode" }}
                secondary={{ label: t.vscode.guideLabel, href: locale === "ko" ? "/ko/docs" : "/docs" }}
              />
            </PluginBlock>

            {/* Desktop */}
            <PluginBlock id="desktop" num="05" brand="mac" t={t.desktop}>
              <PluginFeatures groups={t.desktop.features} />
              <PluginInstall heading={t.desktop.installHeading} steps={t.desktop.installSteps} />
              <PluginDownload
                primary={{ label: "Download v2.3.6 (Apple Silicon)", href: "https://github.com/raymindai/memory-wiki/releases/latest" }}
                secondary={{ label: t.desktop.guideLabel, href: locale === "ko" ? "/ko/docs" : "/docs" }}
              />
            </PluginBlock>

            {/* iOS */}
            <PluginBlock id="ios" num="06" brand="ios" t={t.ios}>
              <PluginFeatures groups={t.ios.features} />
              <PluginInstall heading={t.ios.installHeading} steps={t.ios.installSteps} />
              <PluginDownload
                primary={{ label: t.ios.downloadLabel, href: "https://apps.apple.com" }}
                secondary={{ label: t.ios.guideLabel, href: locale === "ko" ? "/ko/docs" : "/docs" }}
              />
            </PluginBlock>

            {/* Android */}
            <PluginBlock id="android" num="07" brand="android" t={t.android}>
              <PluginFeatures groups={t.android.features} />
              <PluginInstall heading={t.android.installHeading} steps={t.android.installSteps} />
              <PluginDownload
                primary={{ label: t.android.downloadLabel, href: "https://play.google.com/store" }}
                secondary={{ label: t.android.guideLabel, href: locale === "ko" ? "/ko/docs" : "/docs" }}
              />
            </PluginBlock>

            {/* CLI */}
            <PluginBlock id="cli" num="08" brand="cli" t={t.cli}>
              <PureCodeBlock code={t.cli.installCmd} lang="bash" />
              <div className="pure-plugins-cli-examples">
                {t.cli.examples.map((ex, i) => (
                  <div key={i} className="pure-plugins-cli-example">
                    <div className="pure-plugins-cli-example-desc mono">{ex.desc}</div>
                    <PureCodeBlock code={ex.cmd} lang="bash" />
                  </div>
                ))}
              </div>
              <PluginDownload
                primary={{ label: t.cli.guideLabel, href: locale === "ko" ? "/ko/docs/cli" : "/docs/cli" }}
                secondary={{ label: `${t.cli.npmLabel}, v1.4.3`, href: "https://www.npmjs.com/package/memory-wiki-cli" }}
              />
            </PluginBlock>

            {/* QuickLook */}
            <PluginBlock id="quicklook" num="09" brand="finder" t={t.quicklook}>
              <PluginFeatures groups={t.quicklook.features} />
              <PluginInstall heading={t.quicklook.installHeading} steps={t.quicklook.installSteps} />
              <PluginDownload
                primary={{ label: t.quicklook.downloadLabel, href: "/downloads/memory-wiki-desktop.dmg" }}
                secondary={{ label: t.quicklook.guideLabel, href: locale === "ko" ? "/ko/docs" : "/docs" }}
              />
            </PluginBlock>

            {/* Roadmap */}
            <section className="pure-plugins-section">
              <div className="pure-plugins-section-eyebrow mono">{t.roadmap.heading}</div>
              <div className="pure-plugins-roadmap">
                {t.roadmap.items.map((it, i) => (
                  <div key={i} className="pure-plugins-roadmap-item">
                    <div className="pure-plugins-roadmap-name">{it.name}</div>
                    <div className="pure-plugins-roadmap-desc">{it.desc}</div>
                    <div className="pure-plugins-roadmap-status mono">{it.status}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* CTA */}
            <section className="pure-plugins-cta">
              <p className="pure-plugins-cta-line">{t.cta.text}</p>
              <div className="pure-plugins-cta-actions">
                <PureButton href="https://github.com/raymindai/memory-wiki">{t.cta.githubLabel}</PureButton>
                <Link href="/" className="btn-ghost btn-lg">{t.cta.editorLabel}</Link>
              </div>
            </section>
          </div>
    </PureDocsShell>
  );
}

/* ───────── Helpers ───────── */

interface PluginHeader {
  title: string;
  subtitle: string;
  desc: string;
}

function PluginBlock({
  id, num, brand, t, children,
}: {
  id: string;
  num: string;
  brand: ProviderBrand;
  t: PluginHeader;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="pure-plugins-block">
      {/* Row 1 — number + subtitle on one line */}
      <div className="pure-plugins-block-meta">
        <span className="pure-plugins-block-num mono">{num}</span>
        <span className="pure-plugins-block-subtitle mono">{t.subtitle}</span>
      </div>
      {/* Row 2 — brand icon + title */}
      <div className="pure-plugins-block-head">
        <span className="pure-plugins-block-icon" aria-hidden>
          <ProviderIcon brand={brand} />
        </span>
        <h2 className="pure-plugins-block-title">{t.title}</h2>
      </div>
      <p className="pure-plugins-block-desc">{t.desc}</p>
      {children}
    </section>
  );
}

function PluginInstall({ heading, steps }: { heading: string; steps: string[] }) {
  return (
    <div className="pure-plugins-install">
      <h3 className="pure-plugins-install-heading">{heading}</h3>
      <ol>
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}

function PluginDownload({
  primary, secondary,
}: {
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <div className="pure-plugins-download">
      <Link href={primary.href} className="pure-plugins-download-primary">{primary.label}</Link>
      {secondary && (
        <Link href={secondary.href} className="pure-plugins-download-secondary">{secondary.label}</Link>
      )}
    </div>
  );
}
