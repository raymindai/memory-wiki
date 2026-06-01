/*
 * memory.wiki — offscreen document.
 *
 * Service workers can't touch the clipboard. The offscreen API lets us spin
 * up a hidden DOM context just long enough to call navigator.clipboard.
 * Listens for { target: "offscreen", action: "copy", text } messages.
 */

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (!request || request.target !== "offscreen") return;
  if (request.action === "copy") {
    (async () => {
      try {
        await navigator.clipboard.writeText(request.text || "");
        sendResponse({ ok: true });
      } catch (err) {
        // Fallback: textarea + execCommand (still works in offscreen docs).
        try {
          const ta = document.createElement("textarea");
          ta.value = request.text || "";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          sendResponse({ ok: true });
        } catch (err2) {
          sendResponse({ ok: false, error: err2.message });
        }
      }
    })();
    return true;
  }
});
