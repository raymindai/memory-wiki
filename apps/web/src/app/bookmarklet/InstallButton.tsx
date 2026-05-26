"use client";

import { useEffect, useRef } from "react";

interface Props {
  href: string;
}

/**
 * The drag-to-bookmarks button. We intercept clicks (which would otherwise
 * execute the bookmarklet on the install page itself, where it has nothing
 * to capture) and tell the user to drag instead.
 *
 * React 19 blocks `javascript:` URLs in `href` props as a security default,
 * so we set the attribute directly on the underlying DOM node post-mount.
 * The drag-to-bookmarks-bar gesture still picks it up.
 */
export default function InstallButton({ href }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.setAttribute("href", href);
  }, [href]);

  return (
    <a
      ref={ref}
      draggable
      // The dragged-to-bookmarks title is taken from the anchor's
      // accessible name. Setting a `title` attribute makes it
      // explicit so the saved bookmark reads "Memory.Wiki — Save
      // this chat" even on browsers that don't carry the page
      // favicon to `javascript:` URLs (Firefox in particular).
      title="Memory.Wiki — Save this chat"
      onClick={(e) => {
        e.preventDefault();
        // eslint-disable-next-line no-alert
        alert("Drag this button up to your bookmarks bar instead of clicking it. Then click the bookmark while you're on a chat page.");
      }}
      className="pure-bookmarklet-button"
    >
      <img
        src="/brand/mwblob_morph.svg"
        alt="Memory.Wiki"
        className="pure-bookmarklet-button-mark"
      />
      <span>Save to Memory.Wiki</span>
    </a>
  );
}
