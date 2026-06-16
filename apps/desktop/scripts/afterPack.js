// electron-builder afterPack hook for shipping the QuickLook extension.
//
// Split by target because the two channels have incompatible constraints:
//
//   DMG (Developer ID, unnotarized today):
//     Drop the WHOLE standalone "memory.wiki QuickLook.app" into the host's
//     Contents/Resources/. main.js installQuickLook() then copies it to
//     ~/Applications/ on first launch (v2.4.x model). macOS picks the
//     embedded .appex up via LaunchServices because the standalone host
//     is its proper parent (wiki.memory.quicklook → wiki.memory.quicklook.qlextension).
//     We do NOT embed the .appex inside the host's own Contents/PlugIns/
//     because the parent ids don't match (host = wiki.memory.desktop) and
//     pluginkit silently refuses to register a mismatched child without
//     notarization to vouch for it.
//
//   MAS (Apple Distribution, provisioning profile + App Store review):
//     Embed .appex inside Contents/PlugIns/ — required by Apple. The bundle
//     id must be a child of the host (<hostId>.qlextension, e.g.
//     wiki.memory.mac.qlextension). We re-sign in-place with Apple
//     Distribution + the MAS entitlements. App Store review is the implicit
//     "notarization" that lets the embedded extension load on user machines.
//
// The host bundle id differs per channel (DMG = wiki.memory.desktop, MAS =
// wiki.memory.mac, set via -c.appId in the build:* scripts). The QL child
// id is DERIVED from the actual host id below — never hardcode it, or a
// channel switch silently ships a mismatched (rejected) extension.
//
// The .appex / standalone host is pre-built by Xcode (apps/quicklook/MemoryWikiQuickLook).

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const QL_BUILT_HOST = path.resolve(
  __dirname,
  "..",
  "..",
  "quicklook",
  "MemoryWikiQuickLook",
  "build",
  "derived",
  "Build",
  "Products",
  "Release",
  "MemoryWikiQuickLook.app"
);

const QL_LEGACY_HOST = path.resolve(
  __dirname,
  "..",
  "..",
  "quicklook",
  "MemoryWikiQuickLook",
  "build",
  "memory.wiki QuickLook.app"
);

module.exports = async function afterPack(context) {
  const platform = context.electronPlatformName;
  if (platform !== "darwin" && platform !== "mas") return;

  const appOutDir = context.appOutDir;
  const productName = context.packager.appInfo.productFilename;
  const hostApp = path.join(appOutDir, `${productName}.app`);

  const qlHostSrc = fs.existsSync(QL_BUILT_HOST) ? QL_BUILT_HOST : QL_LEGACY_HOST;
  if (!fs.existsSync(qlHostSrc)) {
    console.warn(`[afterPack] QL host not found. Build it via:`);
    console.warn(`  cd apps/quicklook/MemoryWikiQuickLook && xcodebuild -scheme MemoryWikiQuickLook -configuration Release -derivedDataPath build/derived`);
    return;
  }

  const target = (context.targets || []).map((t) => t.name).join(",");

  // Whatever appId this build actually used (DMG ⇒ wiki.memory.desktop,
  // MAS ⇒ wiki.memory.mac via -c.appId). The QL child id is derived from
  // it so neither channel needs a manual edit in this file.
  const hostId = context.packager.appInfo.id;

  if (target.includes("mas") || platform === "mas") {
    embedForMas({ hostApp, qlHostSrc, hostId });
  } else {
    sidecarForDmg({ hostApp, qlHostSrc });
  }
};

function sidecarForDmg({ hostApp, qlHostSrc }) {
  const resourcesDir = path.join(hostApp, "Contents", "Resources");
  const qlDest = path.join(resourcesDir, "memory.wiki QuickLook.app");

  fs.mkdirSync(resourcesDir, { recursive: true });
  if (fs.existsSync(qlDest)) execSync(`rm -rf "${qlDest}"`);
  execSync(`cp -R "${qlHostSrc}" "${qlDest}"`);
  console.log(`[afterPack] DMG: bundled QL host at ${qlDest}`);
}

function embedForMas({ hostApp, qlHostSrc, hostId }) {
  const pluginsDir = path.join(hostApp, "Contents", "PlugIns");
  const appexSrc = path.join(qlHostSrc, "Contents", "PlugIns", "MemoryWikiQLExtension.appex");
  const appexDest = path.join(pluginsDir, "MemoryWikiQLExtension.appex");

  if (!fs.existsSync(appexSrc)) {
    console.warn(`[afterPack] MAS: .appex not found at ${appexSrc}`);
    return;
  }

  fs.mkdirSync(pluginsDir, { recursive: true });
  if (fs.existsSync(appexDest)) execSync(`rm -rf "${appexDest}"`);
  execSync(`cp -R "${appexSrc}" "${appexDest}"`);

  // Rewrite bundle id to be a child of the MAS host id, then re-sign +
  // sync CFBundleVersion with host so App Store validation passes. Derived
  // from the actual host appId (never hardcoded) so a DMG/MAS appId switch
  // can't ship a mismatched extension.
  const masChildId = `${hostId}.qlextension`;
  const hostPlistPath = path.join(hostApp, "Contents", "Info.plist");
  const hostShortVer = execSync(`/usr/bin/plutil -extract CFBundleShortVersionString raw "${hostPlistPath}"`).toString().trim();
  const buildVersion = `${hostShortVer.split(".").slice(0, 2).join(".")}.${Math.floor(Date.now() / 1000)}`;

  const appexPlist = path.join(appexDest, "Contents", "Info.plist");
  execSync(`/usr/bin/plutil -replace CFBundleIdentifier -string "${masChildId}" "${appexPlist}"`);
  execSync(`/usr/bin/plutil -replace CFBundleVersion -string "${buildVersion}" "${appexPlist}"`);
  execSync(`/usr/bin/plutil -replace CFBundleShortVersionString -string "${hostShortVer}" "${appexPlist}"`);
  execSync(`/usr/bin/plutil -replace CFBundleVersion -string "${buildVersion}" "${hostPlistPath}"`);

  const identity = process.env.CSC_NAME || "Apple Distribution: Hyunsang Cho (W7NL89YGSD)";
  const entitlements = path.resolve(__dirname, "..", "build", "entitlements.mas.inherit.plist");
  execSync(
    `codesign --force --deep --timestamp --options runtime ` +
    `--entitlements "${entitlements}" ` +
    `--sign "${identity}" "${appexDest}"`,
    { stdio: "inherit" }
  );
  console.log(`[afterPack] MAS: embedded + signed .appex at ${appexDest} (id ${masChildId}, ver ${buildVersion})`);
}
