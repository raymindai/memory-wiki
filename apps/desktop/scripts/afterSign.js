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
    execSync(
      `codesign --force --sign "${IDENTITY}" ` +
      `--entitlements "${QL_ENTITLEMENTS}" ` +
      `--timestamp --options runtime ` +
      `"${appex}"`,
      { stdio: "inherit" }
    );
    console.log(`[afterSign] re-signed QL .appex with app-sandbox entitlement: ${appex}`);

    // Verify the new entitlements stuck — fail loud if not.
    const ents = execSync(`codesign -d --entitlements - "${appex}" 2>&1`).toString();
    if (!ents.includes("com.apple.security.app-sandbox")) {
      throw new Error("Re-sign succeeded but app-sandbox entitlement still missing from .appex");
    }
    console.log(`[afterSign] verified app-sandbox entitlement is present`);
  } catch (err) {
    console.error(`[afterSign] FATAL: QL re-sign failed`);
    console.error(`  ${err.message}`);
    console.error(`  Without app-sandbox the QuickLook extension will be silently rejected by pkd on every install.`);
    throw err;
  }
};
