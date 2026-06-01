// electron-builder afterPack hook: copy the QuickLook .appex into
// the host app's Contents/PlugIns/ so macOS LaunchServices auto-
// discovers it on launch. This is the model Mac App Store requires
// (no runtime copy out of the sandbox into ~/Applications) and it
// also simplifies the DMG path — one source of truth.
//
// The .appex itself was built separately by Xcode (see
// apps/quicklook/MemoryWikiQuickLook). We just embed + re-sign here.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const APPEX_SRC = path.resolve(
  __dirname,
  "..",
  "..",
  "quicklook",
  "MemoryWikiQuickLook",
  "build",
  "memory.wiki QuickLook.app",
  "Contents",
  "PlugIns",
  "MemoryWikiQLExtension.appex"
);

module.exports = async function afterPack(context) {
  // Mac only.
  if (context.electronPlatformName !== "darwin") return;

  const appOutDir = context.appOutDir;
  const productName = context.packager.appInfo.productFilename; // "memory.wiki"
  const hostApp = path.join(appOutDir, `${productName}.app`);
  const pluginsDir = path.join(hostApp, "Contents", "PlugIns");
  const appexDest = path.join(pluginsDir, "MemoryWikiQLExtension.appex");

  if (!fs.existsSync(APPEX_SRC)) {
    console.warn(`[afterPack] QL .appex not found at ${APPEX_SRC} — skipping embed. Rebuild via:`);
    console.warn(`  cd apps/quicklook/MemoryWikiQuickLook && xcodebuild -scheme MemoryWikiQLExtension -configuration Release -derivedDataPath build`);
    return;
  }

  fs.mkdirSync(pluginsDir, { recursive: true });

  // Wipe any prior copy so we never end up with two .appex variants.
  if (fs.existsSync(appexDest)) {
    execSync(`rm -rf "${appexDest}"`);
  }
  execSync(`cp -R "${APPEX_SRC}" "${appexDest}"`);
  console.log(`[afterPack] Embedded QL extension at ${appexDest}`);

  // Re-sign the .appex with the same identity the host will be
  // signed with. electron-builder signs the host after afterPack
  // runs but only walks its own known plugin layout — for .appex
  // we need to do it ourselves. Identity comes from the build
  // target (mas uses 3rd Party Mac Developer; dmg/Developer ID).
  const target = (context.targets || []).map((t) => t.name).join(",");
  let identity = process.env.CSC_NAME || null;
  let entitlements = path.resolve(__dirname, "..", "build", "entitlements.mac.inherit.plist");
  if (target.includes("mas")) {
    // MAS expects 3rd Party Mac Developer Application identity. If the
    // identity isn't set via env, we leave it to electron-builder to
    // discover; the keychain has one trusted "Apple Development" or
    // "3rd Party Mac Developer Application" entry for the team.
    identity = identity || "3rd Party Mac Developer Application";
    entitlements = path.resolve(__dirname, "..", "build", "entitlements.mas.inherit.plist");
  } else {
    identity = identity || "Developer ID Application: Hyunsang Cho (W7NL89YGSD)";
  }

  // Re-sign the .appex's nested executables first (deep sign), then
  // the .appex bundle itself. --force lets us replace the Xcode
  // signature; --options runtime + --timestamp is required for
  // notarization on the DMG track and harmless on MAS.
  try {
    execSync(
      `codesign --force --deep --timestamp --options runtime ` +
      `--entitlements "${entitlements}" ` +
      `--sign "${identity}" "${appexDest}"`,
      { stdio: "inherit" }
    );
    console.log(`[afterPack] Re-signed .appex with identity: ${identity}`);
  } catch (err) {
    console.error(`[afterPack] Failed to sign .appex: ${err.message}`);
    throw err;
  }
};
