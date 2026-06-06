import type { Metadata } from "next";
import ApiDocsPure from "./ApiDocsPure";

export const metadata: Metadata = {
  title: "REST API Reference — memory.wiki",
  description:
    "Complete REST API reference for memory.wiki. Create, read, update, and delete Markdown documents via HTTP. Includes code examples in curl, JavaScript, and Python.",
  alternates: {
    canonical: "https://memory.wiki/docs/api",
    languages: { ko: "https://memory.wiki/ko/docs/api" },
  },
  openGraph: {
    title: "REST API Reference — memory.wiki",
    description: "Full REST API reference. Endpoints, parameters, examples.",
    url: "https://memory.wiki/docs/api",
    images: [{ url: "/api/og?title=REST%20API", width: 1200, height: 630 }],
  },
};

export default function ApiDocsPage() {
  return <ApiDocsPure locale="en" />;
}
