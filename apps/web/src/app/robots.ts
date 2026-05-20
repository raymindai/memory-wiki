import type { MetadataRoute } from "next";

// memory.wiki's pitch is "deploy any URL to any AI." That requires AI fetchers and
// crawlers to actually be able to read public docs. Default-allow for `*`
// covers that, but several major LLM crawlers ignore generic `*` rules and
// only honor an explicit entry for their UA — so each one is listed below
// with allow-everything-except-private-routes. /raw/ is highlighted as the
// preferred fetch path (clean markdown + frontmatter).
export default function robots(): MetadataRoute.Robots {
  // AI crawlers and search bots that read content for LLM context. Listed
  // explicitly because some implementations (notably GPTBot, ClaudeBot)
  // only obey directives that name them by UA.
  const AI_USER_AGENTS = [
    // OpenAI
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    // Anthropic
    "ClaudeBot",
    "Claude-Web",
    "anthropic-ai",
    // Google
    "Google-Extended",
    "GoogleOther",
    // Perplexity
    "PerplexityBot",
    // Apple
    "Applebot-Extended",
    // Bing / DuckDuckGo (already covered by general indexers but explicit is fine)
    "Bingbot",
    "DuckDuckBot",
    // Other LLM tooling
    "cohere-ai",
    "MistralAI",
    "Meta-ExternalAgent",
    "YouBot",
    "Bytespider",
  ];

  const sharedDisallow = ["/embed/", "/auth/", "/settings/", "/admin/", "/api/og/", "/api/notifications/"];

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/raw/"],
        disallow: sharedDisallow,
      },
      ...AI_USER_AGENTS.map(ua => ({
        userAgent: ua,
        allow: ["/", "/raw/"],
        disallow: sharedDisallow,
      })),
    ],
    sitemap: "https://memory.wiki/sitemap.xml",
    host: "https://memory.wiki",
  };
}
