// Container app onboarding — message bridge to native ViewController.
// All "open external URL" actions tunnel through the native side so
// they land in Safari proper, not inside this WKWebView.

function show(platform, enabled, useSettingsInsteadOfPreferences) {
    document.body.classList.add(`platform-${platform}`);

    if (useSettingsInsteadOfPreferences) {
        const on  = document.querySelector('.platform-mac .state-on');
        const off = document.querySelector('.platform-mac .state-off');
        const unk = document.querySelector('.platform-mac .state-unknown');
        const btn = document.querySelector('.platform-mac.open-preferences') || document.querySelector('button.open-preferences');
        if (on)  on.textContent  = "memory.wiki Clipper is on. Toggle from the Extensions section of Safari Settings.";
        if (off) off.textContent = "memory.wiki Clipper is off. Turn it on from the Extensions section of Safari Settings.";
        if (unk) unk.textContent = "Turn on memory.wiki Clipper from the Extensions section of Safari Settings.";
        if (btn) btn.textContent = "Quit and Open Safari Settings…";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
}

function post(payload) {
    try {
        window.webkit.messageHandlers.controller.postMessage(payload);
    } catch (e) { /* native bridge missing — noop */ }
}

function openPreferences() { post({ type: "open-preferences" }); }
function openSettings()    { post({ type: "open-settings" }); }
function openURL(url)      { post({ type: "open-url", url: url }); }

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("button.open-preferences").forEach((b) => {
        b.addEventListener("click", openPreferences);
    });
    const iosBtn = document.getElementById("ios-open-settings");
    if (iosBtn) iosBtn.addEventListener("click", openSettings);
    const signIn = document.getElementById("open-signin");
    if (signIn) signIn.addEventListener("click", () => openURL("https://memory.wiki/auth/safari"));
    document.querySelectorAll("a[id^='open-']").forEach((a) => {
        a.addEventListener("click", (e) => {
            e.preventDefault();
            const href = a.getAttribute("href");
            if (href) openURL(href);
        });
    });
});
