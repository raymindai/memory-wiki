"use client";

import { useMemo, useState } from "react";
import hljs from "highlight.js";
import "../styles/components/pure-code-block.css";

/**
 * PureCodeBlock — fenced code block with highlight.js syntax
 * highlighting + copy button + language label.
 *
 * Pass `code` as a plain string. If `lang` is a recognized hljs
 * language, tokens are highlighted; otherwise the raw text is shown
 * verbatim. The github-dark theme is already imported globally in
 * globals.css, so no extra CSS is needed for token colors.
 */
export function PureCodeBlock({
  code,
  lang,
}: {
  code: string;
  /** highlight.js language identifier (e.g. "ts", "json", "bash").
   *  Anything not recognized renders as plain text but is still
   *  shown as the language label. */
  lang?: string;
}) {
  const [copied, setCopied] = useState(false);

  const highlighted = useMemo(() => {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch {
        return null;
      }
    }
    return null;
  }, [code, lang]);

  const copy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard blocked — silent
    }
  };

  return (
    <div className="pure-code-block">
      {lang && <span className="pure-code-block-lang mono">{lang}</span>}
      <button
        type="button"
        onClick={copy}
        className="pure-code-block-copy mono"
        aria-label={copied ? "Copied" : "Copy code"}
        title={copied ? "Copied" : "Copy"}
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="pure-code-block-pre">
        {highlighted !== null ? (
          <code
            className={`hljs${lang ? ` language-${lang}` : ""}`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <code className={lang ? `language-${lang}` : undefined}>{code}</code>
        )}
      </pre>
    </div>
  );
}
