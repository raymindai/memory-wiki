// Share.js — JavaScript preprocessor for the iOS Share Extension.
//
// When a Share Extension declares this file via the Info.plist
// key `NSExtensionJavaScriptPreprocessingFile`, Safari (and any
// WKWebView host) injects it into the page being shared. The
// `run()` function returns a dictionary that iOS hands to the
// extension as `NSExtensionJavaScriptPreprocessingResultsKey` on
// the item provider — that's how we get the page TITLE + URL +
// user selection + an article-body snippet, none of which iOS
// surfaces by default.

var MemoryWikiPreprocessor = function() {};

MemoryWikiPreprocessor.prototype = {
    run: function(args) {
        try {
            var sel = window.getSelection ? window.getSelection().toString() : "";

            // Heuristic article body — same vocabulary the web's
            // /raw markdown route uses on the server side: prefer
            // <article>, then <main>, then the largest contiguous
            // <p> stack. Truncated so the IPC payload stays small.
            var bodyText = "";
            var article = document.querySelector("article")
                || document.querySelector("main")
                || document.body;
            if (article) {
                bodyText = article.innerText || "";
            }
            // Cap to keep the IPC payload + the downstream POST
            // small. 4KB markdown was causing /api/docs to time out
            // on slower networks (the server runs embedding on
            // create). 2KB is plenty for a useful snippet — the
            // full page is one tap away via the Source URL anyway.
            if (bodyText.length > 2000) {
                bodyText = bodyText.slice(0, 2000) + "\n\n… (continued at source URL)";
            }

            args.completionFunction({
                title: document.title || "",
                url: window.location.href,
                selection: sel,
                bodyText: bodyText,
                // Open Graph data when present — cleaner than the
                // raw page title for many sites.
                ogTitle: this.metaContent("og:title"),
                ogDescription: this.metaContent("og:description"),
                ogImage: this.metaContent("og:image"),
                siteName: this.metaContent("og:site_name")
            });
        } catch (e) {
            args.completionFunction({
                title: document.title || "",
                url: window.location.href,
                error: String(e)
            });
        }
    },
    metaContent: function(name) {
        var el = document.querySelector('meta[property="' + name + '"]')
            || document.querySelector('meta[name="' + name + '"]');
        return el ? el.getAttribute("content") : "";
    }
};

var ExtensionPreprocessingJS = new MemoryWikiPreprocessor();
