// electron-builder afterSign hook.
//
// Runs AFTER electron-builder's deep-sign pass. The reason this hook
// exists at all: electron-builder's deep-sign re-signs every nested
// .app and .appex with the HOST's hardened-runtime entitlements,
// which do NOT include `com.apple.security.app-sandbox`. macOS
// QuickLook extensions are REQUIRED to be sandboxed — without that
// entitlement, pkd silently rejects the extension on every machine
// with:
//
//   pkd: rejecting; Ignoring mis-configured plugin at [...]: plug-ins must be sandboxed
//
// The user-visible symptom is "Active badge says on, Space-in-Finder
// does nothing". Took several debug rounds to find. Don't remove
// this hook without a replacement plan — every DMG install would
// regress to broken QuickLook.
//
// Fix: after electron-builder is done, re-sign just the QL .appex
// with our original Xcode entitlements file (which has app-sandbox)
// so pluginkit accepts it. Hardened runtime stays on (notarization
// requires it); sandbox is additive.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const QL_APPEX_REL = path.join(
  "Contents", "Resources",
  "memory.wiki QuickLook.app",
  "Contents", "PlugIns",
  "MemoryWikiQLExtension.appex"
);

const QL_ENTITLEMENTS = path.resolve(
  __dirname, "..", "..",
  "quicklook",
  "MemoryWikiQuickLook",
  "QuickLookExtension",
  "MemoryWikiQLExtension.entitlements"
);

// Same identity electron-builder used to sign the host. Falls back
// to the env var electron-builder consumes if it's set.
const IDENTITY = process.env.CSC_NAME
  || "Developer ID Application: Hyunsang Cho (W7NL89YGSD)";

module.exports = async function afterSign(context) {
  const platform = context.electronPlatformName;
  // MAS embed path is handled in afterPack with a different identity;
  // this hook only matters for the DMG path where the QL bundle
  // sits at Contents/Resources/.
  if (platform !== "darwin") return;

  const appOutDir = context.appOutDir;
  const productName = context.packager.appInfo.productFilename;
  const hostApp = path.join(appOutDir, `${productName}.app`);
  const appex = path.join(hostApp, QL_APPEX_REL);

  if (!fs.existsSync(appex)) {
    console.warn(`[afterSign] QL .appex not at expected path: ${appex} — skipping sandbox re-sign`);
    return;
  }
  if (!fs.existsSync(QL_ENTITLEMENTS)) {
    console.warn(`[afterSign] entitlements file missing: ${QL_ENTITLEMENTS} — skipping sandbox re-sign`);
    return;
  }

  try {
    // Step 1: re-sign the .appex with the QL entitlements (which
    // includes app-sandbox). This INVALIDATES the host app's
    // signature because the host's signature embeds a hash of every
    // nested code object — including this .appex.
    execSync(
      `codesign --force --sign "${IDENTITY}" ` +
      `--entitlements "${QL_ENTITLEMENTS}" ` +
      `--timestamp --options runtime ` +
      `"${appex}"`,
      { stdio: "inherit" }
    );
    console.log(`[afterSign] re-signed QL .appex with app-sandbox entitlement: ${appex}`);

    // Step 2: also re-sign the QL HOST bundle (memory.wiki QuickLook.app)
    // because it ALSO embeds the .appex hash. Use the QL host's own
    // entitlements (host doesn't need sandbox itself).
    const qlHost = path.join(hostApp, "Contents", "Resources", "memory.wiki QuickLook.app");
    const qlHostEnt = path.resolve(__dirname, "..", "..", "quicklook", "MemoryWikiQuickLook", "HostApp", "MemoryWikiQuickLook.entitlements");
    if (fs.existsSync(qlHostEnt)) {
      execSync(
        `codesign --force --sign "${IDENTITY}" ` +
        `--entitlements "${qlHostEnt}" ` +
        `--timestamp --options runtime ` +
        `"${qlHost}"`,
        { stdio: "inherit" }
      );
      console.log(`[afterSign] re-signed QL host bundle: ${qlHost}`);
    } else {
      // Fallback: sign without entitlements file — still re-establishes
      // the bundle signature against the new .appex hash.
      execSync(
        `codesign --force --sign "${IDENTITY}" --timestamp --options runtime "${qlHost}"`,
        { stdio: "inherit" }
      );
      console.log(`[afterSign] re-signed QL host bundle (no entitlements file): ${qlHost}`);
    }

    // Step 3: re-sign the OUTER memory.wiki.app host with electron-
    // builder's mac entitlements (hardened runtime + JIT + dyld env).
    // SHALLOW sign (no --deep) — we just want to refresh the outer
    // bundle's hash chain to include our updated nested signatures.
    // --deep would recursively overwrite our QL re-signs and undo the
    // whole point of this hook.
    const hostEnt = path.resolve(__dirname, "..", "build", "entitlements.mac.plist");
    if (fs.existsSync(hostEnt)) {
      execSync(
        `codesign --force --sign "${IDENTITY}" ` +
        `--entitlements "${hostEnt}" ` +
        `--timestamp --options runtime ` +
        `"${hostApp}"`,
        { stdio: "inherit" }
      );
      console.log(`[afterSign] re-signed outer host app: ${hostApp}`);
    } else {
      throw new Error(`Host entitlements file missing: ${hostEnt}`);
    }

    // Step 4: verify. The .appex must STILL have app-sandbox AND the
    // outer host must verify cleanly with --deep --strict (which
    // walks every nested signature).
    const ents = execSync(`codesign -d --entitlements - "${appex}" 2>&1`).toString();
    if (!ents.includes("com.apple.security.app-sandbox")) {
      throw new Error("Re-sign succeeded but app-sandbox entitlement still missing from .appex");
    }
    execSync(`codesign --verify --deep --strict "${hostApp}"`, { stdio: "inherit" });
    console.log(`[afterSign] verified: .appex has app-sandbox; outer host passes --deep --strict`);
  } catch (err) {
    console.error(`[afterSign] FATAL: QL re-sign chain failed`);
    console.error(`  ${err.message}`);
    console.error(`  Without this fix the DMG either ships a broken QL extension (no sandbox = pkd rejects it) or fails notarization (sign chain invalidated).`);
    throw err;
  }
};
