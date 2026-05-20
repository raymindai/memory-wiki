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
      onClick={(e) => {
        e.preventDefault();
        // eslint-disable-next-line no-alert
        alert("Drag this button up to your bookmarks bar instead of clicking it. Then click the bookmark while you're on a chat page.");
      }}
      className="px-6 py-3 rounded-lg text-base font-medium select-none"
      style={{ background: "var(--accent)", color: "#000", cursor: "grab" }}
    >
      📎 Save to Memory.Wiki
    </a>
  );
}
