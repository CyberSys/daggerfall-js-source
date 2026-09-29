// REL5 (2026-09-29, Mac: "How can we drastically improve the install
// experience?"): THE DOWNLOADS HAVE NAMES THAT DO NOT MOVE.
//
// Every release used to carry its build number in each file's name
// (DaggerfallOnline-0.1.4684-win-x64-setup.exe), so no link could point
// at "the Windows installer" - only at a release PAGE, where a player
// met eleven files: four installers, three updater manifests, two
// blockmaps and GitHub's two source archives. The landing page runs no
// script (U60), so it could not look the right file up either. With the
// number out of the name, GitHub answers
// releases/latest/download/<name> with the newest copy of that file, for
// ever, and the site links each platform's installer directly.
//
// The number is not lost: it is the release's TAG (app-v0.1.N), the
// version stamped inside every file, and the `version:` line of the
// latest*.yml manifests electron-updater reads. The updater never keyed
// on a file name - it reads the name out of the manifest - and its
// differential download finds the previous release's blockmap by
// swapping the version inside the URL, which the tag segment still
// carries (electron-updater Provider.getBlockMapFiles). A copy that has
// updated before keeps that blockmap in its cache and does not ask.
//
// THESE ARE A CONTRACT, checked at both ends: app/package.json's
// artifactName templates must produce exactly these names
// (test/rel4_release.test.js), and the release workflow's publish job
// refuses a set that lacks any of them (scripts/desktopRelease.mjs
// check) - so a naming change in electron-builder fails the release
// before a single dead link goes live.
'use strict';

const RELEASES_URL = 'https://github.com/Lattymoy/daggerfall-js-source/releases';

/** The four files a player downloads, one per way to run the app. */
const DOWNLOAD_FILES = Object.freeze({
  winSetup: 'DaggerfallOnline-win-x64-setup.exe',
  winPortable: 'DaggerfallOnline-win-x64-portable.exe',
  mac: 'DaggerfallOnline-mac-arm64.dmg',
  linux: 'DaggerfallOnline-linux-x86_64.AppImage',
});

/** The URL that always serves the newest release's copy of `file`. */
const latestDownloadUrl = (file) => `${RELEASES_URL}/latest/download/${file}`;

/** The file a copy on the NOTICE transport (lib/autoUpdate.cjs) downloads
 *  to update by hand: the dmg on macOS, the portable exe for the portable,
 *  and null where there is no one file to name (an unpackaged run). The
 *  installed Windows and Linux copies update themselves and never ask. */
function manualDownloadFile({ platform, portable, packaged }) {
  if (!packaged) return null;
  if (platform === 'darwin') return DOWNLOAD_FILES.mac;
  if (platform === 'win32') return portable ? DOWNLOAD_FILES.winPortable : DOWNLOAD_FILES.winSetup;
  if (platform === 'linux') return DOWNLOAD_FILES.linux;
  return null;
}

module.exports = { RELEASES_URL, DOWNLOAD_FILES, latestDownloadUrl, manualDownloadFile };
