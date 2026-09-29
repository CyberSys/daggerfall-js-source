// DA3: THE DESKTOP SHELL - the downloadable build's main process.
//
// The game itself is untouched: this window loads the SAME dist/ the
// website deploys, over a custom dagger:// protocol. What the shell
// adds is exactly what a browser cannot give:
//
//   - ARENA2 FROM DISK. The player points at their ARENA2 folder ONCE
//     (native dialog, path kept in config.json) and every
//     `fetch('./arena2/NAME')` the game makes is answered straight
//     off that folder - no 155MB IndexedDB ingest, no diet, full sky
//     sets, and a re-pointable path when the install moves. The
//     serving rules are the vite dev middleware's, kept faithfully:
//     flat names only, CASE-INSENSITIVE lookup (real installs mix
//     INVE00I0.img beside INVE04I0.IMG), and the BOOKS/ fallback for
//     BOK*.TXT. If no folder is configured the requests 404 and the
//     game's own in-page picker takes over - the browser path is the
//     fallback, never a dead end.
//
//   - SAVES AS FILES. The preload bridges app/lib/fileStorage.cjs
//     into the page as daggerShell.storage; the DA1 seam
//     (src/systems/appStorage.js) prefers it over localStorage, so
//     saves land in <userData>/Saves/SAVE<n>/ as SaveData.txt +
//     SaveInfo.txt + Screenshot.jpg - DFU's own layout - and
//     settings/keybinds land beside them under Prefs/.
//
// The menu carries the two doors this makes possible: "Open Saves
// Folder" and "Locate ARENA2 Folder...".
//
// Dev loop: `npm run build` at the repo root, then `npm start` here.
// Point DAGGER_DEV_URL at a running vite dev server to skip the build
// (saves still go to files; arena2 comes from the dev middleware).

'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Worker } = require('node:worker_threads');

// DAGGER_USER_DATA points saves/config somewhere else - the probe's
// door (tools/appShellProbe.mjs writes into a temp dir it can read
// back), and a portable install's (point it beside the executable).
//
// BR1 (2026-09-13): and FAILING THAT, the storage root is PINNED to the
// folder the shipped versions wrote. Electron derives userData from
// app.getName(), which prefers package.json's `productName` - so
// renaming the product (BR1, and again BR4) would have moved
// <appData>/Daggerfall JavaScript out from under every existing install
// on its next launch: saves, Prefs, and config.json with the ARENA2 path
// in it, all silently unreachable, the first-run folder prompt back. A
// rebrand is a name, not a migration. The folder keeps the name it was
// created with, whatever the product is called on the outside.
if (process.env.DAGGER_USER_DATA) app.setPath('userData', process.env.DAGGER_USER_DATA);
else app.setPath('userData', path.join(app.getPath('appData'), 'Daggerfall JavaScript'));

// ONE instance per userData. Two shells over the same Saves folder
// hold two independent storage indexes that go mutually stale (the
// tmp names are pid-scoped so nothing corrupts, but each window shows
// the other's saves late at best). The lock is per-userData, so a
// probe running against its own temp dir never collides with the
// player's real app. A second launch focuses the first instead.
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) app.quit();
app.on('second-instance', () => {
  // the window the player can SEE (or minimized - macOS counts that as not visible): the launcher, else
  // the game - never a game window still being built hidden behind the launcher (DA8's handover), which
  // focus() would show half-loaded
  const live = BrowserWindow.getAllWindows().filter((x) => !x.isDestroyed());
  const w = live.find((x) => x.isVisible()) ?? live.find((x) => x.isMinimized()) ?? null;
  if (w) { if (w.isMinimized()) w.restore(); w.focus(); }
});

const DIST = app.isPackaged
  ? path.join(process.resourcesPath, 'dist')
  : path.join(__dirname, '..', 'dist');
const CONFIG_FILE = () => path.join(app.getPath('userData'), 'config.json');

// ---- config.json: { arena2Path } ----------------------------------
function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE(), 'utf8')) ?? {}; }
  catch { return {}; }
}
function saveConfig(cfg) {
  try {
    fs.mkdirSync(path.dirname(CONFIG_FILE()), { recursive: true });
    fs.writeFileSync(CONFIG_FILE(), JSON.stringify(cfg, null, 2));
  } catch (err) { console.warn('[shell] config write failed:', err.message); }
}

// ---- the ARENA2 folder --------------------------------------------
// DA9: a folder is ARENA2 when it is WHOLE - the seven files the game's
// boot reads (A2-WHOLE's REQUIRED_ARENA2, held equal to dataSource.js's
// by test). The test used to be ART_PAL.COL alone, so a DOS install's
// small ARENA2 passed here, was saved, served the palette and died on
// the first model - and was never asked about again. A pick of the
// PARENT folder (the install root with an arena2/ inside it) is still
// auto-descended - the honest mistake costs nothing.
const { findCaseInsensitive, resolveArena2, diagnoseArena2, missingArena2, searchArena2 } = require('./lib/arena2Detect.cjs');

let arena2Dir = null;        // the validated folder, or null
let arena2Names = null;      // UPPERCASE name -> on-disk name (the mixed-case law)
function setArena2(dir) {
  arena2Dir = dir;
  arena2Names = null;
}
/** Drop the name cache; the next request re-reads the folder. Hung
 *  off every page load (did-start-loading below) so View > Reload
 *  picks up files added to the folder - and off nothing hotter,
 *  because one readdir per page load is free and one per request is
 *  not. */
function invalidateArena2Names() { arena2Names = null; }
function arena2File(name) {
  if (!arena2Dir) return null;
  if (!arena2Names) {
    // Built into a LOCAL map and assigned only on success: a
    // transient readdir failure (network drive asleep, USB pulled)
    // used to cache an EMPTY map, and mixed-case installs - the
    // normal kind - then 404'd forever after the drive came back.
    try {
      const m = new Map();
      for (const f of fs.readdirSync(arena2Dir)) m.set(f.toUpperCase(), f);
      arena2Names = m;
    } catch { return null; /* unreadable right now; retry next request */ }
  }
  const onDisk = arena2Names.get(name.toUpperCase());
  let p = onDisk ? path.join(arena2Dir, onDisk) : path.join(arena2Dir, name);
  // B1: books live in ARENA2/BOOKS/ - the dev middleware's fallback.
  if (!fs.existsSync(p) && /^BOK\d+\.TXT$/i.test(name)) {
    const books = findCaseInsensitive(arena2Dir, 'BOOKS');
    if (books) p = findCaseInsensitive(books, name) ?? path.join(books, name);
  }
  // isFile, not exists: a SUBDIRECTORY whose name is asked for (the
  // BOOKS folder itself, say) must 404 - net.fetch of a file://
  // directory rejects the whole response instead.
  try { return fs.statSync(p).isFile() ? p : null; } catch { return null; }
}

/** The native folder dialog, judged: { dir } for a whole ARENA2,
 *  { missing } for a folder that is not one (the files it lacks, or null
 *  when it holds no Daggerfall file at all), { unreadable } for one that
 *  cannot be read, { canceled } otherwise. The launcher words the answer
 *  itself; the File menu's door says it in a message box (pickArena2).
 *  AUDIT INSTALL L4-4: a whole ARENA2 further down is found, not refused -
 *  Steam's "Browse local files" opens the game folder, three levels above
 *  it, and "It holds no Daggerfall files" was the answer to picking it. */
async function chooseArena2Folder(win) {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Choose your ARENA2 folder',
    message: "Daggerfall's game data is freeware but can't be bundled. Choose your ARENA2 folder (or the install folder that contains it).",
    properties: ['openDirectory'],
  });
  if (canceled || !filePaths.length) return { canceled: true };
  const pick = filePaths[0];
  const dir = resolveArena2(pick) ?? searchArena2(pick);
  if (dir) return { dir };
  return missingArena2(pick) === null ? { unreadable: true, missing: null } : { missing: diagnoseArena2(pick) };
}

/** The folder the shell reads from now on, kept - and a folder chosen ends
 *  the in-page choice (config.json arena2InGame), from any door. */
function keepArena2Path(dir) {
  const { arena2InGame: _picker, ...cfg } = loadConfig();
  saveConfig({ ...cfg, arena2Path: dir });
}

async function pickArena2(win) {
  const r = await chooseArena2Folder(win);
  if (r.canceled) return null;
  if (!r.dir) {
    await dialog.showMessageBox(win, {
      type: 'warning',
      message: 'That folder is not a whole ARENA2',
      detail: notArena2Detail(r.missing, r),
    });
    return null;
  }
  return r.dir;
}

// ---- the dagger:// protocol ---------------------------------------
// Standard + fetch-capable so the game's relative fetches, ESM
// imports and workers behave exactly as they do over https.
protocol.registerSchemesAsPrivileged([{
  scheme: 'dagger',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
}]);

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.wasm': 'application/wasm',
};
const fileResponse = (p, mime) => net.fetch(pathToFileURL(p).toString(), { bypassCustomProtocolHandlers: true })
  .then((res) => new Response(res.body, { headers: { 'Content-Type': mime ?? MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream' } }));

// DA8: the launcher's own origin, dagger://launcher - its page, script,
// stylesheet and fonts, out of the shell's own files (inside app.asar
// when packaged, which Electron's fs reads and a file:// fetch may not).
// A different ORIGIN from the game's dagger://game, so the two share no
// storage, and the same traversal law.
const LAUNCHER_DIR = path.join(__dirname, 'launcher');
const LAUNCHER_URL = 'dagger://launcher/index.html';
async function serveLauncherFile(parts) {
  const p = path.normalize(path.join(LAUNCHER_DIR, parts.length ? parts.join('/') : 'index.html'));
  if (!p.startsWith(LAUNCHER_DIR + path.sep)) return new Response('forbidden', { status: 403 });
  try {
    const body = await fs.promises.readFile(p);
    return new Response(body, { headers: { 'Content-Type': MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream' } });
  } catch { return new Response('not found', { status: 404 }); }
}

function handleDagger(req) {
  let url, parts;
  try {
    url = new URL(req.url);
    parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  } catch {
    // Malformed percent-encoding: decodeURIComponent throws, and an
    // uncaught throw here dies as a net error in the page instead of
    // a status a caller can reason about.
    return new Response('bad request', { status: 400 });
  }
  if (url.host === 'launcher') return serveLauncherFile(parts);
  // /arena2/NAME and /play/arena2/NAME - the game fetches relative to
  // its document, the probes fetch absolute. EXACTLY the two doors
  // the dev middleware mounts, and no more: a looser "any path ending
  // arena2/NAME" match would silently hijack a future dist/ directory
  // that happens to carry the name.
  const a2Name = (parts.length === 2 && parts[0] === 'arena2') ? parts[1]
    : (parts.length === 3 && parts[0] === 'play' && parts[1] === 'arena2') ? parts[2]
    : null;
  if (a2Name !== null) {
    if (!/^[A-Za-z0-9._-]+$/.test(a2Name)) return new Response('bad name', { status: 400 });
    const p = arena2File(a2Name);
    return p ? fileResponse(p, 'application/octet-stream') : new Response('not found', { status: 404 });
  }
  // Everything else is the built site, traversal-proofed into dist/.
  const rel = parts.length ? parts.join('/') : 'play/index.html';
  let p = path.normalize(path.join(DIST, rel));
  if (!p.startsWith(DIST + path.sep)) return new Response('forbidden', { status: 403 });
  try {
    // A directory serves its index.html, the way every web host the
    // site deploys to does - the landing page links Play as ./play/.
    if (fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (fs.statSync(p).isFile()) return fileResponse(p);
  } catch { /* absent - fall through to 404 */ }
  return new Response('not found', { status: 404 });
}

// ---- updating: the auto-updater (DA7) over the notice (DA6) --------
// DA6 was a NOTICE on purpose - one read-only GET to the GitHub
// releases API, the pure compare in lib/updateCheck.cjs, and a dialog
// whose Download button opens the release page in the player's
// browser - because unsigned builds cannot auto-update on macOS and
// nothing here was to apply code silently. REL3 then made every merge
// a release, and a player was being asked to download and install
// several times a day. DA7 (Mac: "players dont have to manually
// install each release" - "Do it"): where the installer CAN replace
// itself, it does. electron-updater reads the release's latest.yml,
// downloads the new installer in the background and installs it when
// the app quits; the player does nothing. Which copies can is
// lib/autoUpdate.cjs's one table (NSIS on Windows, AppImage on Linux);
// macOS, the portable exe and an unpackaged run keep the notice.
//
// The two gates are unchanged and gate BOTH transports: the File menu
// checkbox (persisted in config.json as updateCheck, default on) and
// DAGGER_NO_UPDATE_CHECK for the probes. A launch check fails
// SILENTLY on either transport - a launch that nags about the network
// is worse than none. The manual menu item is the loud path: it
// reports downloading, up-to-date and unreachable alike, because the
// player asked.
//
// DA8 (2026-09-29, Mac: "Is there anyway to send a notification that a
// new update is available ... A launcher?"): THE LAUNCH CHECK IS THE
// LAUNCHER'S, AND THE PLAYER IS TOLD. Installing on quit meant a player
// launched into the build before the last one nearly every time - online,
// a protocol behind the relay - and was never told anything. Now the
// launcher window (below) asks first and, on the updater transport,
// installs BEFORE play: the download shown, the install silent, the app
// reopening itself. An update that lands later - after "Play now", or
// from the hourly re-check while playing - is told in the game (the HUD
// line, app/preload.cjs onUpdateReady) and offered as File > Restart to
// Update; on the notice transport the offer is a direct download of this
// copy's own file (REL5), never a page of eleven.
//
// DA10: THE NEWS. The one other request the shell makes of its own is the
// same API's recent-release list: the launcher's news panel, the patch
// notes of the latest releases (electron-updater's own fullChangelog
// cannot read app-v tags: it takes versions as semver). It is the update
// check's own request - asked beside it at launch, under its two gates -
// and its answer is kept in news.json, so the panel is never empty while
// the next one is asked for, or when GitHub does not answer.
const RELEASES_LATEST_API = 'https://api.github.com/repos/Lattymoy/daggerfall-js-source/releases/latest';
const RELEASES_LIST_API = 'https://api.github.com/repos/Lattymoy/daggerfall-js-source/releases?per_page=20';
const RELEASES_PAGE = 'https://github.com/Lattymoy/daggerfall-js-source/releases/latest';
const { isNewerRelease } = require('./lib/updateCheck.cjs');
const { updateTransport } = require('./lib/autoUpdate.cjs');
const { UNLOAD_ASK, leaves, restartAsk, reinstallAsk, installFailedAsk, goesAhead } = require('./lib/shellDialogs.cjs');
const { latestDownloadUrl, manualDownloadFile } = require('./lib/downloads.cjs');
const {
  CHECK_TIMEOUT_MS, RECHECK_MS, INSTALL_NOTICE_MS, INSTALL_GIVEUP_MS, DOWNLOAD_STALL_MS, DETECT_DEADLINE_MS,
  initialState, reduce, nextStep, viewOf, newsFrom, cachedNews, notArena2Detail, installAttemptFor,
} = require('./lib/launcherState.cjs');

/** Which transport THIS copy updates by - lib/autoUpdate.cjs's table
 *  over the live facts: packaged or not, the platform, and the portable
 *  launcher's own mark on its process. */
function currentUpdateTransport() {
  return updateTransport({
    packaged: app.isPackaged,
    platform: process.platform,
    portable: !!process.env.PORTABLE_EXECUTABLE_DIR,
    // L3-4: a build cut without a release has no app-update.yml, and must never replace itself with the public one
    configured: !app.isPackaged || fs.existsSync(path.join(process.resourcesPath, 'app-update.yml')),
  });
}

/** DA6's two gates, for both transports and every check but the one the
 *  player asks for from the menu. */
const updateChecksEnabled = () => loadConfig().updateCheck !== false && !process.env.DAGGER_NO_UPDATE_CHECK;

/** An update this copy has DOWNLOADED and will install at quit (the
 *  updater transport), and a newer release this copy can only be told of
 *  (the notice transport). Each puts its door in the File menu. */
let updateReady = null;    // { version, told }
let manualUpdate = null;   // { version, download, told }

/** electron-updater, configured once and lazily - a copy on the notice
 *  transport never loads it. Downloads on its own, installs on quit,
 *  never a prerelease or a downgrade, no log file of its own. Its events
 *  go to whoever is listening (onUpdaterEvent): the launcher while it is
 *  open, the game after; an error is silence either way (the manual
 *  check reports its own). */
let _autoUpdater = null;
function autoUpdater() {
  if (_autoUpdater) return _autoUpdater;
  const { autoUpdater: au } = require('electron-updater');
  au.autoDownload = true;
  au.autoInstallOnAppQuit = true;
  au.allowPrerelease = false;
  au.allowDowngrade = false;
  au.logger = null;
  au.on('error', () => onUpdaterEvent('error'));
  au.on('update-not-available', () => onUpdaterEvent('none'));
  au.on('update-available', (info) => onUpdaterEvent('available', info));
  au.on('download-progress', (p) => onUpdaterEvent('progress', p));
  au.on('update-downloaded', (info) => onUpdaterEvent('downloaded', info));
  _autoUpdater = au;
  return au;
}

/** The updater's news, routed. The launcher's reducer takes what applies
 *  to where it stands and ignores the rest; a download that finishes
 *  anywhere but under the launcher's "Updating" is the game's to hear.
 *
 *  AUDIT INSTALL L2-1: an error is routed by WHERE it lands. It used to be
 *  "check-failed" whatever happened, which the reducer takes only while
 *  checking - so a download that broke off (the connection, a checksum, a
 *  full disk) left the launcher on "Downloading" with Play held for ever.
 *  An install that failed on the spot (an AppImage where the player cannot
 *  write) is the install's to answer (installFailed). */
function onUpdaterEvent(kind, info) {
  if (kind === 'error') {
    stopStallWatch();
    if (installStarted && !leaveForUpdate) { installFailed(); return; }
    launcherDispatch({ type: launcher?.state.update.status === 'downloading' ? 'download-failed' : 'check-failed' });
    return;
  }
  if (kind === 'none') { launcherDispatch({ type: 'check-none' }); return; }
  if (kind === 'progress') {
    if (stallTimer) watchDownload();
    launcherDispatch({ type: 'progress', percent: info?.percent, transferred: info?.transferred, total: info?.total });
    return;
  }
  const version = typeof info?.version === 'string' ? info.version : null;
  if (kind === 'available') {
    launcherDispatch({ type: 'check-available', version });
    if (launcher?.state.update.status === 'downloading') watchDownload();
    return;
  }
  if (kind === 'downloaded') {
    stopStallWatch();
    // L2-8: the same download reported again (a manual check finds it in the cache) is not news twice
    const again = updateReady?.version === version;
    if (!again) updateReady = { version, told: false };
    const installingNow = launcher?.state.update.status === 'downloading';
    launcherDispatch({ type: 'downloaded', version });
    if (!installingNow && !again) { updateReady.told = tellGame({ version, manual: false }); buildMenu(); }
  }
}

/** L2-1: a download that goes DOWNLOAD_STALL_MS without a byte is cancelled
 *  and called failed - electron-updater's own timeout never arms under
 *  Electron's net module. Armed when the launcher shows a download, again at
 *  every byte, and let go when it ends however it ends. */
let stallTimer = null;
let downloadCancel = null;   // the running download's CancellationToken (checkForUpdates' result)
function watchDownload() {
  clearTimeout(stallTimer);
  stallTimer = setTimeout(() => {
    stallTimer = null;
    downloadCancel?.cancel();
    launcherDispatch({ type: 'download-failed' });
  }, DOWNLOAD_STALL_MS);
  stallTimer.unref?.();
}
function stopStallWatch() { clearTimeout(stallTimer); stallTimer = null; }

/** Ask electron-updater, keeping what its answer carries: the download's
 *  cancel (the stall watch's), and its promise answered here - a download
 *  that fails is reported by the 'error' event, never as an unhandled
 *  rejection. Resolves to the check's result, or null when it declined to
 *  check at all (an AppImage run outside its AppImage, say). */
function askUpdater() {
  return autoUpdater().checkForUpdates().then((r) => {
    if (r?.cancellationToken) downloadCancel = r.cancellationToken;
    r?.downloadPromise?.catch(() => {});
    return r ?? null;
  });
}

/** DA10: news.json - the last release list the launcher heard, as its
 *  news panel shows it (lib/launcherState.cjs newsFrom). */
const NEWS_FILE = () => path.join(app.getPath('userData'), 'news.json');
function loadNews() {
  try { return cachedNews(JSON.parse(fs.readFileSync(NEWS_FILE(), 'utf8'))); } catch { return []; }
}
function saveNews(items) {
  try {
    fs.mkdirSync(path.dirname(NEWS_FILE()), { recursive: true });
    fs.writeFileSync(NEWS_FILE(), JSON.stringify({ items }, null, 2));
  } catch { /* the next launch asks again */ }
}

/** The recent releases' patch notes, for the launcher's news panel: kept,
 *  and handed to the launcher; the cached list stays up when GitHub does
 *  not answer. */
async function fetchNews() {
  try {
    const res = await net.fetch(RELEASES_LIST_API, {
      headers: { 'User-Agent': 'daggerfall-js-app', Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const items = newsFrom(await res.json());
    saveNews(items);
    launcherDispatch({ type: 'news', items });
  } catch { launcherDispatch({ type: 'news-failed' }); }
}

/** An update, told to the game: a HUD line (app/preload.cjs keeps it for a
 *  page that is still booting). False when there is no game window yet -
 *  the window's first load tells it then (createWindow). */
let gameWindow = null;
function tellGame(payload) {
  if (!gameWindow || gameWindow.isDestroyed()) return false;
  gameWindow.webContents.send('dagger:update-ready', payload);
  return true;
}

/** Set once the installer has really taken over - electron-updater says so
 *  on Electron's autoUpdater just before it quits the app, and only after
 *  install() succeeded: the game's unload guard is answered by the player's
 *  choice to restart, not asked again (createWindow's will-prevent-unload).
 *  AUDIT INSTALL L2-4: it was set when the player CHOSE to restart, so an
 *  install that failed on the spot left it set for the rest of the session,
 *  and every close and reload after it left without asking. */
let leaveForUpdate = false;
require('electron').autoUpdater.on('before-quit-for-update', () => { leaveForUpdate = true; });

/** AUDIT INSTALL L2-2/L2-3: THE ONE DOOR TO THE INSTALLER. electron-updater
 *  treats a second quitAndInstall as "ignored" and then CLEARS its own
 *  installed-already flag, so its quit handler installed a second time - on
 *  Linux over the AppImage the first install had just put in place, which
 *  it deleted. Once is all it gets. And the version is written down first
 *  (config.json installAttempt): a launch that finds itself still older
 *  than it knows the installer did not take, and does not try it before
 *  play again (launcherState installAttemptFor) - a failing installer used
 *  to close the app on every launch. */
let installStarted = false;
function installNow(version) {
  if (installStarted) return;
  installStarted = true;
  if (version) saveConfig({ ...loadConfig(), installAttempt: { version } });
  autoUpdater().quitAndInstall(true, true);
}

/** The installer did not take over (electron-updater's install() failed and
 *  said so - an error while installStarted, before before-quit-for-update):
 *  the launcher offers it to run by hand; in the game, the player who chose
 *  Restart is told, rather than nothing happening. */
function installFailed() {
  installStarted = false;
  if (launcher) { launcherDispatch({ type: 'install-failed' }); return; }
  const parent = gameWindow && !gameWindow.isDestroyed() ? gameWindow : null;
  const opts = installFailedAsk();
  (parent ? dialog.showMessageBox(parent, opts) : dialog.showMessageBox(opts))
    .then(({ response }) => { if (goesAhead(response)) shell.openExternal(ownDownloadUrl()); });
}

/** This copy's own installer, the newest, by the name that never moves
 *  (REL5) - or the release page where there is no one file to name. */
function ownDownloadUrl() {
  const file = manualDownloadFile({ platform: process.platform, portable: !!process.env.PORTABLE_EXECUTABLE_DIR, packaged: app.isPackaged });
  return file ? latestDownloadUrl(file) : RELEASES_PAGE;
}

/** File > Restart to Update: the update installs now, and the app reopens
 *  on it. Asked first - the game is running, and progress since the last
 *  save is the player's to keep. L2-2: asked ONCE at a time, over the game
 *  (a parentless box could open twice, behind a fullscreen game). */
let restartAsking = false;
async function restartToUpdate() {
  if (restartAsking || installStarted) return;
  restartAsking = true;
  try {
    const parent = gameWindow && !gameWindow.isDestroyed() ? gameWindow : null;
    const opts = restartAsk(updateReady?.version);
    const { response } = await (parent ? dialog.showMessageBox(parent, opts) : dialog.showMessageBox(opts));
    if (goesAhead(response)) installNow(updateReady?.version);
  } finally { restartAsking = false; }
}

/** The manual check on the updater transport: starts the download if a
 *  newer release exists and says so out loud - DA6's three dialogs, the
 *  first reworded because the player has nothing to click. */
async function checkForUpdatesViaUpdater() {
  let result;
  try { result = await autoUpdater().checkForUpdates(); } catch {
    dialog.showMessageBox({
      type: 'warning',
      message: 'Could not check for updates',
      detail: `GitHub was unreachable. The releases page is ${RELEASES_PAGE}.`,
    });
    return;
  }
  const v = result?.updateInfo?.version;
  result?.downloadPromise?.catch(() => {});
  // L2-8: a download already done is ready, not "downloading"
  if (v && updateReady?.version === v) {
    dialog.showMessageBox({
      type: 'info',
      message: `Version ${v} is ready`,
      detail: 'It installs when you quit, or now from File > Restart to Update - your saves, settings and ARENA2 path all stay where they are.',
    });
    return;
  }
  if (v && isNewerRelease(app.getVersion(), `app-v${v}`)) {
    dialog.showMessageBox({
      type: 'info',
      message: `Version ${v} is downloading`,
      detail: `You have v${app.getVersion()}. It installs itself the next time you quit - your saves, settings and ARENA2 path all stay where they are.`,
    });
    return;
  }
  dialog.showMessageBox({
    type: 'info',
    message: `You're up to date`,
    detail: `Daggerfall Online v${app.getVersion()} is the latest release.`,
  });
}

/** { tag, url, download } of the latest release, or null on any failure.
 *  `download` is this copy's own installer by the name that never moves
 *  (REL5) - the dmg, the portable exe - or the release page where there
 *  is no one file to name. */
async function fetchLatestRelease() {
  try {
    const res = await net.fetch(RELEASES_LATEST_API, {
      headers: { 'User-Agent': 'daggerfall-js-app', Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const tag = typeof json?.tag_name === 'string' ? json.tag_name : null;
    const url = typeof json?.html_url === 'string' && /^https:\/\/github\.com\//.test(json.html_url)
      ? json.html_url : RELEASES_PAGE;
    const file = manualDownloadFile({ platform: process.platform, portable: !!process.env.PORTABLE_EXECUTABLE_DIR, packaged: app.isPackaged });
    return tag ? { tag, url, download: file ? latestDownloadUrl(file) : url } : null;
  } catch { return null; }
}

/** The notice transport's check: a newer release is remembered (the menu's
 *  Download door) and answered; null when GitHub did not. */
async function noticeCheck() {
  const latest = await fetchLatestRelease();
  if (!latest) return null;
  if (!isNewerRelease(app.getVersion(), latest.tag)) return { newer: false };
  const version = latest.tag.replace(/^app-v/, '');
  const fresh = manualUpdate?.version !== version;
  if (fresh) manualUpdate = { version, download: latest.download, told: false };
  else manualUpdate.download = latest.download;
  if (fresh) buildMenu();
  return { newer: true, fresh, version, download: latest.download };
}

/** AUDIT INSTALL L2-6: a notice is told ONCE, by whoever can: the launcher
 *  (when it took it - not after Play, not after it closed), else the game,
 *  now or at its first load (createWindow). An answer that came after the
 *  launcher let the player in used to be told to no one, and every re-check
 *  after it saw nothing new. */
function tellNotice(r) {
  if (!r?.newer || !manualUpdate || manualUpdate.version !== r.version || manualUpdate.told) return;
  const u = launcher?.state.update;
  if (launcher && !launcher.state.launch && u?.status === 'notice' && u.version === r.version) { manualUpdate.told = true; return; }
  manualUpdate.told = tellGame({ version: r.version, manual: true });
}

/** The loud check, from the File menu on the notice transport: DA6's
 *  three answers, and Download fetches this copy's own file. */
async function checkForUpdates() {
  const latest = await fetchLatestRelease();
  if (!latest) {
    dialog.showMessageBox({
      type: 'warning',
      message: 'Could not check for updates',
      detail: `GitHub was unreachable. The releases page is ${RELEASES_PAGE}.`,
    });
    return;
  }
  if (!isNewerRelease(app.getVersion(), latest.tag)) {
    dialog.showMessageBox({
      type: 'info',
      message: `You're up to date`,
      detail: `Daggerfall Online v${app.getVersion()} is the latest release.`,
    });
    return;
  }
  const { response } = await dialog.showMessageBox({
    type: 'info',
    message: `${latest.tag.replace(/^app-v/, 'Version ')} is out`,
    detail: `You have v${app.getVersion()}. Updating is a download and an install-over - your saves, settings and ARENA2 path all stay where they are.`,
    buttons: ['Download', 'Later'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) shell.openExternal(latest.download);
}

/** While the app runs, ask again every RECHECK_MS - inside the same two
 *  gates, and from the launcher's first moment (DA10: a launcher left open
 *  for an evening still updates before Play). The updater downloads what
 *  it finds (onUpdaterEvent carries it to the launcher, or tells the game
 *  when it lands); the notice tells the launcher, or the game, of a
 *  version it has not told before. */
let recheckTimer = null;
function startRechecks() {
  if (recheckTimer || !updateChecksEnabled()) return;
  recheckTimer = setInterval(async () => {
    if (!updateChecksEnabled()) return;
    if (currentUpdateTransport() === 'updater') {
      if (!updateReady && !installStarted) askUpdater().catch(() => {});
      return;
    }
    const r = await noticeCheck();
    if (!r?.newer || !r.fresh) return;
    if (launcher) launcherDispatch({ type: 'check-available', version: r.version, download: r.download });
    tellNotice(r);
  }, RECHECK_MS);
  recheckTimer.unref?.();
}

// ---- the window ---------------------------------------------------

/** UNLOAD-ASK: when the player last started to leave a page (closing its
 *  window, or View > Reload) - the unload guard's question is theirs for
 *  LEAVE_ASK_MS after, and a page's own navigation is not theirs at all. */
const LEAVE_ASK_MS = 2000;
const leavingAt = new WeakMap();
const markLeaving = (wc) => leavingAt.set(wc, Date.now());
function isLeaving(wc) {
  const at = leavingAt.get(wc);
  leavingAt.delete(wc);
  return at !== undefined && Date.now() - at <= LEAVE_ASK_MS;
}

/** Wipe the page's STORED ARENA2 ingest so a re-pointed folder
 *  actually answers. Without this, a player who ever ran the in-page
 *  picker (cancelled the first-run dialog once, say) had a complete
 *  IndexedDB manifest - and getBytes asks memory -> IndexedDB ->
 *  network, so "Locate ARENA2 Folder" changed the path and NOTHING
 *  VISIBLE: every dieted file kept coming from the stale ingest.
 *
 *  This mirrors dataSource.clearStoredData's law exactly - the
 *  ARENA2 store and the DERIVED artifacts, never the player's own
 *  packs (music, textures, Morrowind survive a re-point). The three
 *  names are pinned against dataSource.js by the parity test so
 *  they cannot drift apart silently. */
function clearStoredArena2(wc) {
  // DA10: it answers whether the stores HELD anything, so a boot with nothing stored is not reloaded for nothing
  return wc.executeJavaScript(`(async () => new Promise((res) => {
    const req = indexedDB.open('project-dagger');
    req.onsuccess = () => {
      const db = req.result;
      const names = ['arena2', 'derived'].filter((n) => db.objectStoreNames.contains(n));
      if (!names.length) { db.close(); res(false); return; }
      const tx = db.transaction(names, 'readwrite');
      let held = 0;
      for (const n of names) {
        const store = tx.objectStore(n);
        const count = store.count();
        count.onsuccess = () => { held += count.result; };
        store.clear();
      }
      tx.oncomplete = () => { db.close(); res(held > 0); };
      // a clear that failed may have left the ingest standing: reload, and the boot reads what is there
      tx.onerror = () => { db.close(); res(true); };
      tx.onabort = () => { db.close(); res(true); };
    };
    req.onerror = () => res(false);
    req.onblocked = () => res(false);
  }))()`, true).catch(() => false /* page gone mid-clear; the next boot re-checks */);
}

// A re-point made with NO game window open (macOS keeps the menu alive
// after the last window closes; the launcher chooses before the game
// exists) still needs the ingest wipe - it is deferred to the next game
// window's boot.
let pendingIngestClear = false;

/** File > Open Saves Folder, and the launcher's Saves door (DA10). */
function openSavesFolder() {
  const dir = path.join(app.getPath('userData'), 'Saves');
  fs.mkdirSync(dir, { recursive: true });
  shell.openPath(dir);
}

/** DA10: the update check's switch. The launcher's toggle and the File
 *  menu's checkbox are one setting (config.json updateCheck); turned on
 *  while the launcher is open, it checks now rather than next launch. */
function setCheckOnLaunch(on) {
  saveConfig({ ...loadConfig(), updateCheck: !!on });
  buildMenu();
  if (!launcher) return;
  launcherDispatch({ type: 'check-on-launch', on: !!on });
  if (on && updateChecksEnabled() && launcher?.state.update.status === 'skipped') {
    launcherDispatch({ type: 'check-start' });
    startLaunchCheck();
    fetchNews();
    startRechecks();
  }
}

/** The menu resolves its window AT CLICK TIME. It used to close over
 *  the window it was built with - and on macOS the app menu outlives
 *  every window, so File > Locate ARENA2 after Cmd-W called dialog
 *  and reload on a DESTROYED BrowserWindow and threw instead of
 *  working. */
function buildMenu() {
  const liveWindow = () => {
    const w = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
    return w && !w.isDestroyed() ? w : null;
  };
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Open Saves Folder', click: () => openSavesFolder() },
        {
          label: 'Locate ARENA2 Folder...',
          click: async () => {
            // DA10: with the launcher open (the macOS menu bar is the app's), its own door - its Game files row says the answer
            if (launcher) { launcherChooseFolder(); return; }
            const target = liveWindow();
            const dir = await pickArena2(target);
            if (!dir) return;
            setArena2(dir);
            keepArena2Path(dir);
            if (target) {
              await clearStoredArena2(target.webContents);
              if (!target.isDestroyed()) target.reload();
            } else {
              pendingIngestClear = true;   // macOS zero-window state: the next window clears at boot
            }
          },
        },
        { type: 'separator' },
        // DA8: the update the game was told of, one click away - installed now (the app reopens on
        // it), or downloaded as this copy's own file where it cannot install itself
        ...(updateReady ? [{ label: `Restart to Update (v${updateReady.version})`, click: () => restartToUpdate() }] : []),
        ...(manualUpdate ? [{ label: `Download v${manualUpdate.version}...`, click: () => shell.openExternal(manualUpdate.download) }] : []),
        {
          label: 'Check for Updates...',
          click: () => (currentUpdateTransport() === 'updater' ? checkForUpdatesViaUpdater() : checkForUpdates()),   // DA7: the loud path on either transport
        },
        {
          // DA10: it gates the launch check, the news and the hourly re-check alike - 'on Launch' said a third of it
          label: 'Check for Updates Automatically',
          type: 'checkbox',
          checked: loadConfig().updateCheck !== false,
          click: (item) => setCheckOnLaunch(item.checked),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    // DEATHLOOP1 sibling, F11 (Janome, 2026-09-22: "in the exe version,
    // F11 is the hotkey for full screen. this is an issue, because F11
    // is also the quickload hotkey, so instead of making the game full
    // screen it just loaded my save").
    //
    // F9 QuickSave and F11 QuickLoad are DFU's own SetupDefaults
    // (systems/inputActions.js), so the GAME's binding is the correct
    // one and the shell is what has to give way. Electron's
    // `togglefullscreen` role carries F11 on Windows and Linux by
    // default, which puts a menu accelerator on a key the game already
    // spends - the page happens to win, so the menu item silently does
    // nothing and the player gets a quickload they did not ask for.
    //
    // The accelerator moves to Alt+Enter, the other long-standing
    // fullscreen convention on Windows and one no DFU binding uses.
    // macOS keeps the role's own Ctrl+Cmd+F, which collides with
    // nothing. Naming it here also makes it DISCOVERABLE, which was
    // the other half of the report: the menu row now prints the key.
    {
      label: 'View',
      submenu: [
        // UNLOAD-ASK: a reload the player asks for is a leave, and is asked about (markLeaving)
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: (_item, w) => {
            const target = w && !w.isDestroyed() ? w : liveWindow();
            if (!target) return;
            markLeaving(target.webContents);
            target.webContents.reload();
          },
        },
        process.platform === 'darwin'
          ? { role: 'togglefullscreen' }
          : { role: 'togglefullscreen', accelerator: 'Alt+Enter' },
        { role: 'toggleDevTools' },
      ],
    },
  ];
  if (process.platform === 'darwin') template.unshift({ role: 'appMenu' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  // DA10: on Windows and Linux that sets the menu on EVERY window (Electron's setApplicationMenu) - the
  // launcher's too, which grew a File/View bar at the handover and whenever a notice rebuilt the menu
  // (measured on Electron 42: the bar shown, the window 27px taller). It stays the launcher's own face.
  if (process.platform !== 'darwin' && launcher && !launcher.win.isDestroyed()) launcher.win.removeMenu();
}

/** The game's window. `onShown` is the launcher's handover (DA8): the
 *  window is built hidden and shown at its FIRST PAINT, so there is never
 *  a blank window between the launcher and the game - and a first paint
 *  that never comes still shows it, after GAME_REVEAL_MS. */
const GAME_REVEAL_MS = 8000;
async function createWindow({ onShown = null } = {}) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#111111',
    title: 'Daggerfall Online',
    show: !onShown,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // sandbox off is the recorded tradeoff for the preload doing
      // its own synchronous file IO; the navigation fences below are
      // what keep the bridge from ever facing remote content.
      sandbox: false,
    },
  });
  gameWindow = win;
  if (onShown) {
    let shown = false;
    const reveal = () => {
      if (shown || win.isDestroyed()) return;
      shown = true;
      win.show();
      onShown();
    };
    win.once('ready-to-show', reveal);
    setTimeout(reveal, GAME_REVEAL_MS).unref?.();
  }
  buildMenu();
  win.webContents.on('did-start-loading', invalidateArena2Names);
  // DA8: an update that finished downloading before this window existed ("Play now" at 95%) is told at its first load
  win.webContents.once('did-finish-load', () => {
    if (updateReady && !updateReady.told) updateReady.told = tellGame({ version: updateReady.version, manual: false });
    else if (manualUpdate && !manualUpdate.told) manualUpdate.told = tellGame({ version: manualUpdate.version, manual: true });
  });
  // UNLOAD-ASK (DA8, found building Restart to Update): the game's unload guard
  // (src/systems/unloadGuard.js, MAC-L3) cancels an unload while progress is at risk,
  // and a BROWSER answers that with its own "Leave site?" box. Electron draws none: it
  // just cancels the close - proven on Electron 42 (a guard-shaped beforeunload, a real
  // click, then close(): `will-prevent-unload` fires and the window stays). So once a
  // player was in the world the window's X, Alt+F4 and File > Quit did NOTHING, and an
  // update could never install on quit. The shell asks the browser's question itself
  // (Stay is the default - Enter must not throw an evening away), and lets its own
  // Restart to Update through: that dialog already said to save first.
  // AUDIT INSTALL L1-3: it asks when the PLAYER is leaving - the window closing (its X,
  // Alt+F4, a quit: Electron's `close` comes before the page's beforeunload) or View >
  // Reload - and keeps the page, as Electron always did, on a navigation the page starts
  // by itself: the game releases its own guard before its own navigations, and a page
  // that did not could raise box after box, each freezing the main process.
  win.on('close', () => markLeaving(win.webContents));
  win.webContents.on('will-prevent-unload', (e) => {
    if (leaveForUpdate) { e.preventDefault(); return; }
    if (!isLeaving(win.webContents)) return;
    const choice = dialog.showMessageBoxSync(win, { ...UNLOAD_ASK, buttons: [...UNLOAD_ASK.buttons] });
    if (leaves(choice)) e.preventDefault();
  });

  const devUrl = process.env.DAGGER_DEV_URL;
  if (devUrl) { await win.loadURL(devUrl); return win; }

  if (!fs.existsSync(path.join(DIST, 'play', 'index.html'))) {
    dialog.showErrorBox('No build found',
      `The game build is missing (${DIST}).\nRun \`npm run build\` at the repository root first.`);
    app.quit();
    return win;
  }
  await win.loadURL('dagger://game/play/index.html');
  if (pendingIngestClear && !win.isDestroyed()) {
    pendingIngestClear = false;
    if (await clearStoredArena2(win.webContents) && !win.isDestroyed()) win.reload();
  }
  return win;
}

// ---- the launcher (DA8, DA10) -------------------------------------
// The shell's FIRST window (app/launcher/, drawn from
// lib/launcherState.cjs). DA8 made it a splash: it checked for an update
// and installed it before play where this copy can, found the player's
// Daggerfall files on first run (DA9), and handed over by itself. DA10
// made it the game's front door: it stays on every launch until the
// player presses Play - the patch notes as its news, the update in its
// status bar, the player's own doors (game files, saves, the update
// check, a reinstall) beside them - and hands over to the game's window
// at its first paint. It is SANDBOXED and its bridge has two words
// (launcherPreload.cjs); every action it can ask for is named in the
// switch below, and every link it can open is named here.
const LAUNCHER_LINKS = Object.freeze({
  steam: 'https://store.steampowered.com/app/1812390/',
  gog: 'https://www.gog.com/game/the_elder_scrolls_chapter_ii_daggerfall',
  site: 'https://daggerfalljs.dev/',
  discord: 'https://discord.gg/daggerfallonline',
  // the landing page's own link for the game files a Mac player can get (L5-3)
  zip: 'https://forums.dfworkshop.net/viewtopic.php?t=2360',
});

/** The open launcher: its window, its state, and how many of its dialogs
 *  are up - or null once it has handed over (or was closed). */
let launcher = null;

/** AUDIT INSTALL L1-2: the launcher's page navigates NOWHERE and opens
 *  NOTHING - not an https link (the app-wide fence would hand it to the
 *  browser), not a dagger://game page (which would run with the launcher's
 *  bridge still on it) - and is granted no permission (the clipboard, say).
 *  Every door it has is an action the shell names (the IPC below). */
const launcherContents = new WeakSet();
const LAUNCHER_ORIGIN = 'dagger://launcher/';
/** Heard only from the launcher's window, and only from its own page. */
const fromLauncher = (e) => !!launcher && e.sender === launcher.win.webContents && !!e.senderFrame?.url?.startsWith(LAUNCHER_ORIGIN);

function openLauncherWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 600,
    useContentSize: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    backgroundColor: '#0a0c11',
    title: 'Daggerfall Online',
    webPreferences: {
      preload: path.join(__dirname, 'launcherPreload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  launcherContents.add(win.webContents);
  if (process.platform !== 'darwin') win.removeMenu();
  win.once('ready-to-show', () => { if (!win.isDestroyed()) win.show(); });
  win.on('closed', () => {
    if (launcher?.win !== win) return;
    const handingOver = launcher.state.launch === 'started';
    launcher = null;
    stopStallWatch();
    // AUDIT INSTALL L2-10: closed by the PLAYER while the game was still being built behind it (the handover's own
    // close comes after the game shows): they meant to leave, and the hidden window would have kept the app alive
    if (handingOver && gameWindow && !gameWindow.isDestroyed() && !gameWindow.isVisible()) gameWindow.destroy();
  });
  win.loadURL(LAUNCHER_URL);
  return win;
}

function renderLauncher() {
  const w = launcher?.win;
  if (w && !w.isDestroyed()) w.webContents.send('launcher:view', viewOf(launcher.state));
}

/** One event into the launcher; the state moves, the window redraws, and
 *  whatever comes next happens. A no-op once the launcher has handed over -
 *  from then on the game is who hears (onUpdaterEvent). */
function launcherDispatch(ev) {
  if (!launcher) return;
  launcher.state = reduce(launcher.state, ev);
  renderLauncher();
  advanceLauncher();
}

/** What comes next, done - an install held while one of the launcher's own
 *  dialogs is up, so a folder being chosen is not cut off by the restart. */
function advanceLauncher() {
  if (!launcher) return;
  const step = nextStep(launcher.state);
  if (step === 'detect') {
    if (launcher.detecting) return;
    launcher.detecting = true;
    const l = launcher;
    detectInBackground().then((found) => { if (launcher === l) launcherDispatch({ type: 'found', found }); });
  } else if (step === 'install') { if (!launcher.dialogs) installFromLauncher(); } else if (step === 'launch') launchGame();
}

/** DA9's search, in a worker thread under DETECT_DEADLINE_MS (AUDIT INSTALL
 *  L4-1: it blocked the main process - the launcher's own first paint - for
 *  as long as a sleeping drive or a hung reg.exe took). Finds stream in, so
 *  a search stopped at the deadline still offers what it had. The loose
 *  folders are the shell's to name: app.getPath follows Windows' Known
 *  Folder Move and a localized XDG Downloads. Never rejects. */
function detectInBackground() {
  return new Promise((resolve) => {
    const found = [];
    let worker = null;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      worker?.terminate().catch(() => {});
      resolve(found);
    };
    const deadline = setTimeout(finish, DETECT_DEADLINE_MS);
    try {
      const looseDirs = ['downloads', 'desktop', 'documents'].map((n) => { try { return app.getPath(n); } catch { return null; } }).filter(Boolean);
      worker = new Worker(path.join(__dirname, 'lib', 'arena2DetectWorker.cjs'), { workerData: { looseDirs } });
      worker.on('message', (m) => {
        if (m?.found) found.push(m.found);
        if (m?.done) finish();
      });
      worker.on('error', finish);
      worker.on('exit', finish);
    } catch { finish(); }
  });
}

/** A dialog over the launcher, counted while it is up (advanceLauncher). */
async function launcherDialog(show) {
  const l = launcher;
  if (l) l.dialogs++;
  try { return await show(); } finally {
    if (l) l.dialogs--;
    advanceLauncher();
  }
}

/** The update is down: "Installing" long enough to read that the app will
 *  reopen by itself, then the installer runs silent and restarts it - into
 *  the launcher, on the new version. */
function installFromLauncher() {
  if (launcher.installing) return;
  launcher.installing = true;
  const l = launcher, version = launcher.state.update.version;
  setTimeout(() => {
    if (l !== launcher) return;
    // a dialog the player opened during the notice holds it too - its close runs advanceLauncher, and this again
    if (l.dialogs) { l.installing = false; return; }
    installNow(version);
    // an installer that never took over would leave "Installing" up for ever: Play is freed, the installer offered
    setTimeout(() => launcherDispatch({ type: 'install-failed' }), INSTALL_GIVEUP_MS).unref?.();
  }, INSTALL_NOTICE_MS);
}

/** The folder the player chose (or the found one they took) becomes the
 *  one the shell reads. Whatever the game stored before - an in-page
 *  ingest (the game's own picker, here or in a build before the launcher),
 *  or artifacts derived from another folder - would shadow it (Audit DA
 *  F-DA2), so the game's next boot clears it: EVERY pick, not only a
 *  re-point, because a player who used the in-page picker has no folder
 *  to re-point from. The boot reloads only when there was something. */
function useArena2(dir) {
  setArena2(dir);
  keepArena2Path(dir);
  pendingIngestClear = true;
  launcherDispatch({ type: 'picked', dir });
}

/** The first run's "Choose the ARENA2 folder", and the Game files door at
 *  any time: the native dialog, judged. A folder that is not ARENA2 is
 *  said on the first run's card, or - from the door, where the game's
 *  folder stays as it was - in a message box. */
async function launcherChooseFolder() {
  if (!launcher || launcher.state.launch) return;
  const onCard = viewOf(launcher.state).panel === 'setup';
  const r = await launcherDialog(() => chooseArena2Folder(launcher.win));
  if (!launcher || r.canceled) return;
  if (r.dir) { useArena2(r.dir); return; }
  if (onCard) { launcherDispatch({ type: 'picked-bad', missing: r.missing, unreadable: !!r.unreadable }); return; }
  await launcherDialog(() => dialog.showMessageBox(launcher.win, {
    type: 'warning',
    message: 'That folder is not a whole ARENA2',
    detail: notArena2Detail(r.missing, r),
  }));
}

/** DA10: Reinstall - this copy's own installer, the newest, by the name
 *  that never moves (REL5), downloaded in the player's browser to install
 *  over this copy. Asked first: the player hears that their saves are safe
 *  before they run anything. */
async function reinstallFromLauncher() {
  if (!launcher) return;
  const { response } = await launcherDialog(() => dialog.showMessageBox(launcher.win, reinstallAsk()));
  if (goesAhead(response)) shell.openExternal(ownDownloadUrl());
}

/** The handover: the game's window is built hidden, and at its first paint
 *  it shows and the launcher closes - in that order, so the app is never
 *  without a window (window-all-closed would quit it). The version is
 *  kept as the one last played: the next launch marks what came since. */
function launchGame() {
  launcherDispatch({ type: 'launching' });
  saveConfig({ ...loadConfig(), lastPlayed: app.getVersion() });
  const lw = launcher?.win;
  createWindow({
    onShown: () => {
      if (lw && !lw.isDestroyed()) lw.close();
      launcher = null;
    },
  });
}

/** Why the folder config.json keeps is not a whole ARENA2 any more: it
 *  cannot be read (a drive unplugged, a share not mounted), or what it lacks. */
function savedArena2Fault(dir) {
  return missingArena2(dir) === null ? { unreadable: true, missing: null } : { unreadable: false, missing: diagnoseArena2(dir) };
}

/** The launch check, inside DA6's two gates: the updater transport
 *  downloads what it finds (onUpdaterEvent carries it here); the notice
 *  transport asks the API. Silence past CHECK_TIMEOUT_MS frees Play - and
 *  an answer that comes later still lands (launcherState MAY_FIND). */
function startLaunchCheck() {
  setTimeout(() => launcherDispatch({ type: 'check-timeout' }), CHECK_TIMEOUT_MS).unref?.();
  if (currentUpdateTransport() === 'updater') {
    // null is electron-updater declining to check at all (an AppImage run outside its AppImage, say): no event
    // will come, so it is said now rather than after the timeout
    askUpdater()
      .then((r) => { if (!r) launcherDispatch({ type: 'check-failed' }); })
      .catch(() => launcherDispatch({ type: 'check-failed' }));
    return;
  }
  noticeCheck().then((r) => {
    if (!r) launcherDispatch({ type: 'check-failed' });
    else if (!r.newer) launcherDispatch({ type: 'check-none' });
    else {
      launcherDispatch({ type: 'check-available', version: r.version, download: r.download });
      tellNotice(r);
    }
  });
}

function runLauncher() {
  const cfg = loadConfig();
  setArena2(resolveArena2(cfg.arena2Path));
  // L4-5: a folder the player chose before that no longer answers is NAMED - not the first run's "Where is Daggerfall?"
  const saved = typeof cfg.arena2Path === 'string' && !arena2Dir ? { dir: cfg.arena2Path, ...savedArena2Fault(cfg.arena2Path) } : null;
  const checkEnabled = updateChecksEnabled();
  // an install the last launch handed over: still older than it, the installer did not take (L2-3)
  const attempt = installAttemptFor(cfg.installAttempt, app.getVersion());
  if (cfg.installAttempt && !attempt.keep) {
    const { installAttempt: _done, ...rest } = cfg;
    saveConfig(rest);
  }
  launcher = {
    win: openLauncherWindow(),
    installing: false,
    dialogs: 0,
    state: initialState({
      current: app.getVersion(),
      transport: currentUpdateTransport(),
      platform: process.platform,
      checkEnabled,
      checkOnLaunch: cfg.updateCheck !== false,
      arena2Dir,
      // the player chose the game's own picker once (kept), or the headless probe skips the question
      inGamePicker: cfg.arena2InGame === true || !!process.env.DAGGER_SKIP_ARENA2_PROMPT,
      savedArena2: saved,
      news: loadNews(),
      lastPlayed: cfg.lastPlayed,
      // a config.json written before DA10 has no lastPlayed: the build it runs now is new to that player
      returning: !cfg.lastPlayed && Object.keys(cfg).length > 0,
      installFailedFor: attempt.failed,
    }),
  };
  buildMenu();
  if (checkEnabled) {
    startLaunchCheck();
    fetchNews();
    startRechecks();
  }
  advanceLauncher();
}

// The launcher's two words. Only ITS window is heard, and only these
// actions; a link is a name from LAUNCHER_LINKS, never a URL from the page.
ipcMain.on('launcher:ready', (e) => { if (fromLauncher(e)) renderLauncher(); });
ipcMain.on('launcher:act', async (e, msg) => {
  if (!fromLauncher(e)) return;
  const { action, arg } = msg ?? {};
  const st = launcher.state;
  switch (action) {
    case 'play': launcherDispatch({ type: 'play' }); break;
    case 'play-now': stopStallWatch(); launcherDispatch({ type: 'play-now' }); break;
    case 'download': if (st.update.download) shell.openExternal(st.update.download); break;
    case 'skip-setup':
      // the game's own picker, chosen once: kept, so the next launch does not ask again
      if (reduce(st, { type: 'skip-setup' }).setup.status !== st.setup.status) saveConfig({ ...loadConfig(), arena2InGame: true });
      launcherDispatch({ type: 'skip-setup' });
      break;
    case 'use-found': {
      const f = Number.isInteger(arg) ? st.setup.found[arg] : null;
      const dir = f ? resolveArena2(f.dir) : null;   // judged again: a drive can go away while the window sits open
      if (dir) useArena2(dir);
      else launcherDispatch({ type: 'picked-bad', missing: f ? diagnoseArena2(f.dir) : null });
      break;
    }
    case 'choose-folder': await launcherChooseFolder(); break;
    case 'retry-saved': {
      // the saved folder, asked again - its drive plugged back in, its share mounted
      const savedDir = loadConfig().arena2Path;
      const dir = typeof savedDir === 'string' ? resolveArena2(savedDir) : null;
      if (dir) useArena2(dir);
      else if (typeof savedDir === 'string') launcherDispatch({ type: 'saved-bad', ...savedArena2Fault(savedDir) });
      break;
    }
    case 'open-saves': openSavesFolder(); break;
    case 'set-update-check': setCheckOnLaunch(arg === true); break;
    case 'reinstall': await reinstallFromLauncher(); break;
    case 'open': if (Object.hasOwn(LAUNCHER_LINKS, arg)) shell.openExternal(LAUNCHER_LINKS[arg]); break;
    default: break;
  }
});

// THE NAVIGATION FENCES. The window carries a preload whose bridge
// reads and writes the player's save files, so the one rule is: that
// bridge never faces content we did not ship. Window-opens to
// dagger:// are the game's own tool pages (mw-viewer, mw-inspect;
// children do not inherit the preload); anything http(s) - the
// credits' GitHub links - belongs in the system browser; everything
// else is refused. Same law for in-place navigation, with the dev
// server's own origin allowed when DAGGER_DEV_URL is driving.
app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (launcherContents.has(contents)) return { action: 'deny' };
    if (url.startsWith('dagger://')) return { action: 'allow' };
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (e, url) => {
    if (launcherContents.has(contents)) { e.preventDefault(); return; }
    if (url.startsWith('dagger://')) return;
    const devUrl = process.env.DAGGER_DEV_URL;
    try { if (devUrl && new URL(url).origin === new URL(devUrl).origin) return; } catch { /* not a parseable target */ }
    e.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });
});

// The preload asks for its storage root synchronously at page boot -
// storage must exist before the first module reads a setting.
ipcMain.on('dagger:user-data-path', (e) => { e.returnValue = app.getPath('userData'); });
// ESC-LOCK (2026-09-27, Mac: "when you hit esc to leave a menu, your cursor remains on the screen"): Escape is no user
// activation, and after the player ends a pointer lock the next one needs one - so a menu closed on Escape could not
// take the look back. The page asks (preload relockPointer) and its own fixed hook runs here as a user gesture.
ipcMain.on('dagger:relock', (e) => { e.sender.executeJavaScript('globalThis.__daggerRelock?.()', true).catch(() => {}); });

app.whenReady().then(() => {
  if (!isSingleInstance) return;   // quitting; do not raise a window on the way out
  protocol.handle('dagger', handleDagger);
  // L1-2: the launcher is granted nothing it asks for; every other page keeps Electron's default (granted)
  session.defaultSession.setPermissionRequestHandler((wc, _permission, callback) => callback(!launcherContents.has(wc)));

  // DA8: the launcher is the first window - the update check (inside DA6's
  // two gates), the first run's files (DA9: found, else chosen; the game's
  // own in-page picker stays the fallback, never a dead end), then the
  // game. It used to be a native folder dialog before any window, and a
  // check that installed on quit and told no one. DA10: and it waits for
  // Play, with the patch notes and the player's options.
  runLauncher();
  // DA10: a dock click with no window open (macOS keeps the app alive) opens the launcher, as a launch does
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) runLauncher(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
