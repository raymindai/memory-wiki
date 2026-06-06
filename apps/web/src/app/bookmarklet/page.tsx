import type { Metadata } from "next";
import BookmarkletPure from "./BookmarkletPure";

export const metadata: Metadata = {
  title: "memory.wiki bookmarklet — capture any AI conversation",
  description:
    "Drag this to your bookmarks bar. One click on chatgpt.com, claude.ai, or gemini.google.com saves the current conversation to your memory.wiki hub.",
};

export default function BookmarkletPage() {
  return <BookmarkletPure />;
}
