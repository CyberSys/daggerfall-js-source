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

const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, net, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

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
  const w = BrowserWindow.getAllWindows()[0];
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
const { findCaseInsensitive, resolveArena2, diagnoseArena2, detectArena2 } = require('./lib/arena2Detect.cjs');

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
 *  when it holds no Daggerfall file at all), { canceled } otherwise. The
 *  launcher words the answer itself; the File menu's door says it in a
 *  message box (pickArena2). */
async function chooseArena2Folder(win) {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Choose your ARENA2 folder',
    message: "Daggerfall's game data is freeware but can't be bundled. Choose your ARENA2 folder (or the install folder that contains it).",
    properties: ['openDirectory'],
  });
  if (canceled || !filePaths.length) return { canceled: true };
  const dir = resolveArena2(filePaths[0]);
  return dir ? { dir } : { missing: diagnoseArena2(filePaths[0]) };
}

async function pickArena2(win) {
  const r = await chooseArena2Folder(win);
  if (r.canceled) return null;
  if (!r.dir) {
    await dialog.showMessageBox(win, {
      type: 'warning',
      message: 'That folder is not a whole ARENA2',
      detail: r.missing
        ? `It has no ${r.missing.join(', ')}. Choose the ARENA2 folder inside your Daggerfall install - on Steam and GOG it is under DF/DAGGER/ARENA2.`
        : 'It holds no Daggerfall files. Choose the ARENA2 folder inside your Daggerfall install - on Steam and GOG it is under DF/DAGGER/ARENA2.',
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
// copy's own file (REL5), never a page of eleven. The one other request
// the shell makes of its own is the same API's recent-release list, and
// only when there IS an update - the patch notes of every version
// between this one and it, for "What's new" (electron-updater's own
// fullChangelog cannot read app-v tags: it takes versions as semver).
const RELEASES_LATEST_API = 'https://api.github.com/repos/Lattymoy/daggerfall-js-source/releases/latest';
const RELEASES_LIST_API = 'https://api.github.com/repos/Lattymoy/daggerfall-js-source/releases?per_page=20';
const RELEASES_PAGE = 'https://github.com/Lattymoy/daggerfall-js-source/releases/latest';
const { isNewerRelease } = require('./lib/updateCheck.cjs');
const { updateTransport } = require('./lib/autoUpdate.cjs');
const { latestDownloadUrl, manualDownloadFile } = require('./lib/downloads.cjs');
const {
  CHECK_TIMEOUT_MS, RECHECK_MS, INSTALL_NOTICE_MS, INSTALL_GIVEUP_MS,
  initialState, reduce, nextStep, viewOf, notesBetween, whatsNewFor,
} = require('./lib/launcherState.cjs');

/** Which transport THIS copy updates by - lib/autoUpdate.cjs's table
 *  over the live facts: packaged or not, the platform, and the portable
 *  launcher's own mark on its process. */
function currentUpdateTransport() {
  return updateTransport({ packaged: app.isPackaged, platform: process.platform, portable: !!process.env.PORTABLE_EXECUTABLE_DIR });
}

/** DA6's two gates, for both transports and every check but the one the
 *  player asks for from the menu. */
const updateChecksEnabled = () => loadConfig().updateCheck !== false && !process.env.DAGGER_NO_UPDATE_CHECK;

/** An update this copy has DOWNLOADED and will install at quit (the
 *  updater transport), and a newer release this copy can only be told of
 *  (the notice transport). Each puts its door in the File menu. */
let updateReady = null;    // { version, told }
let manualUpdate = null;   // { version, download }

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
 *  anywhere but under the launcher's "Updating" is the game's to hear. */
function onUpdaterEvent(kind, info) {
  if (kind === 'error') { launcherDispatch({ type: 'check-failed' }); return; }
  if (kind === 'none') { launcherDispatch({ type: 'check-none' }); return; }
  if (kind === 'progress') {
    launcherDispatch({ type: 'progress', percent: info?.percent, transferred: info?.transferred, total: info?.total });
    return;
  }
  const version = typeof info?.version === 'string' ? info.version : null;
  if (kind === 'available') {
    launcherDispatch({ type: 'check-available', version });
    requestNotes(version);
    return;
  }
  if (kind === 'downloaded') {
    updateReady = { version, told: false };
    rememberWhatsNew(version);
    const installingNow = launcher?.state.update.status === 'downloading';
    launcherDispatch({ type: 'downloaded', version });
    if (!installingNow) { updateReady.told = tellGame({ version, manual: false }); buildMenu(); }
  }
}

/** The notes of every release between this copy and `version`, for
 *  "What's new" - handed to the launcher, and kept with the update so the
 *  launch that runs it can show them. An empty list when GitHub does not
 *  answer: the update is no less an update. */
let pendingNotes = { version: null, notes: [] };
async function requestNotes(version) {
  if (!version) return;
  pendingNotes = { version, notes: [] };
  const notes = await fetchReleaseNotes(app.getVersion(), version);
  if (pendingNotes.version !== version) return;
  pendingNotes.notes = notes;
  launcherDispatch({ type: 'notes', version, notes });
  if (updateReady?.version === version) rememberWhatsNew(version);
}
/** config.json's whatsNew: shown once, by the launch that runs `version`. */
function rememberWhatsNew(version) {
  if (!version) return;
  saveConfig({ ...loadConfig(), whatsNew: { version, notes: pendingNotes.version === version ? pendingNotes.notes : [] } });
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

/** Set once the player has chosen to restart into an update: the game's
 *  unload guard is answered by that choice, not asked again (createWindow's
 *  will-prevent-unload). */
let leaveForUpdate = false;

/** File > Restart to Update: the update installs now, and the app reopens
 *  on it. Asked first - the game is running, and progress since the last
 *  save is the player's to keep. */
async function restartToUpdate() {
  const { response } = await dialog.showMessageBox({
    type: 'question',
    message: `Restart to install v${updateReady?.version}?`,
    detail: 'Daggerfall Online closes, installs the update and reopens by itself. Save your game first - progress since your last save is lost.',
    buttons: ['Restart', 'Not now'],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) {
    leaveForUpdate = true;
    autoUpdater().quitAndInstall(true, true);
  }
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

/** The recent releases' notes between two versions (lib/launcherState.cjs
 *  notesBetween), or [] on any failure. */
async function fetchReleaseNotes(fromVersion, toVersion) {
  try {
    const res = await net.fetch(RELEASES_LIST_API, {
      headers: { 'User-Agent': 'daggerfall-js-app', Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    return notesBetween(await res.json(), fromVersion, toVersion);
  } catch { return []; }
}

/** The notice transport's check: a newer release is remembered (the menu's
 *  Download door) and answered; null when GitHub did not. */
async function noticeCheck() {
  const latest = await fetchLatestRelease();
  if (!latest) return null;
  if (!isNewerRelease(app.getVersion(), latest.tag)) return { newer: false };
  const version = latest.tag.replace(/^app-v/, '');
  const fresh = manualUpdate?.version !== version;
  manualUpdate = { version, download: latest.download };
  if (fresh) buildMenu();
  return { newer: true, fresh, version, download: latest.download };
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

/** While the game runs, ask again every RECHECK_MS - inside the same two
 *  gates. The updater downloads what it finds (onUpdaterEvent tells the
 *  game when it lands); the notice tells the game of a version it has
 *  not told before. */
let recheckTimer = null;
function startRechecks() {
  if (recheckTimer || !updateChecksEnabled()) return;
  recheckTimer = setInterval(async () => {
    if (!updateChecksEnabled()) return;
    if (currentUpdateTransport() === 'updater') {
      if (!updateReady) autoUpdater().checkForUpdates().catch(() => {});
      return;
    }
    const r = await noticeCheck();
    if (r?.newer && r.fresh) tellGame({ version: r.version, manual: true });
  }, RECHECK_MS);
  recheckTimer.unref?.();
}

// ---- the window ---------------------------------------------------

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
  return wc.executeJavaScript(`(async () => {
    await new Promise((res) => {
      const req = indexedDB.open('project-dagger');
      req.onsuccess = () => {
        const db = req.result;
        const names = ['arena2', 'derived'].filter((n) => db.objectStoreNames.contains(n));
        if (!names.length) { db.close(); res(); return; }
        const tx = db.transaction(names, 'readwrite');
        for (const n of names) tx.objectStore(n).clear();
        const done = () => { db.close(); res(); };
        tx.oncomplete = done; tx.onerror = done; tx.onabort = done;
      };
      req.onerror = () => res();
      req.onblocked = () => res();
    });
  })()`, true).catch(() => { /* page gone mid-clear; the reload's boot re-checks */ });
}

// A re-point made with NO window open (macOS keeps the menu alive
// after the last window closes) still needs the ingest wipe - it is
// deferred to the next window's boot.
let pendingIngestClear = false;

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
        {
          label: 'Open Saves Folder',
          click: () => {
            const dir = path.join(app.getPath('userData'), 'Saves');
            fs.mkdirSync(dir, { recursive: true });
            shell.openPath(dir);
          },
        },
        {
          label: 'Locate ARENA2 Folder...',
          click: async () => {
            const target = liveWindow();
            const dir = await pickArena2(target);
            if (!dir) return;
            setArena2(dir);
            saveConfig({ ...loadConfig(), arena2Path: dir });
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
          label: 'Check for Updates on Launch',
          type: 'checkbox',
          checked: loadConfig().updateCheck !== false,
          click: (item) => saveConfig({ ...loadConfig(), updateCheck: item.checked }),
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
        { role: 'reload' },
        process.platform === 'darwin'
          ? { role: 'togglefullscreen' }
          : { role: 'togglefullscreen', accelerator: 'Alt+Enter' },
        { role: 'toggleDevTools' },
      ],
    },
  ];
  if (process.platform === 'darwin') template.unshift({ role: 'appMenu' });
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
  win.webContents.on('will-prevent-unload', (e) => {
    if (leaveForUpdate) { e.preventDefault(); return; }
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question',
      buttons: ['Leave', 'Stay'],
      defaultId: 1,
      cancelId: 1,
      message: 'Leave the game?',
      detail: 'Progress since your last save will be lost.',
    });
    if (choice === 0) e.preventDefault();
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
    await clearStoredArena2(win.webContents);
    if (!win.isDestroyed()) win.reload();
  }
  return win;
}

// ---- the launcher (DA8) -------------------------------------------
// The shell's FIRST window (app/launcher/, drawn from
// lib/launcherState.cjs): it checks for an update and installs it before
// play where this copy can, finds the player's Daggerfall files on first
// run (DA9), shows what changed after an update, and hands over to the
// game's window at its first paint. With nothing to decide it is a
// moment's splash. It is SANDBOXED and its bridge has two words
// (launcherPreload.cjs); every link it can open is named here.
const LAUNCHER_LINKS = Object.freeze({
  steam: 'https://store.steampowered.com/app/1812390/',
  gog: 'https://www.gog.com/game/the_elder_scrolls_chapter_ii_daggerfall',
  site: 'https://daggerfalljs.dev/',
  discord: 'https://discord.gg/daggerfallonline',
});

/** The open launcher: its window and state - or null once it has handed over (or was closed). */
let launcher = null;

function openLauncherWindow() {
  const win = new BrowserWindow({
    width: 900,
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
  if (process.platform !== 'darwin') win.removeMenu();
  win.once('ready-to-show', () => { if (!win.isDestroyed()) win.show(); });
  win.on('closed', () => { if (launcher?.win === win) launcher = null; });
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

function advanceLauncher() {
  if (!launcher) return;
  const step = nextStep(launcher.state);
  if (step === 'detect') launcherDispatch({ type: 'found', found: detectArena2() });
  else if (step === 'install') installFromLauncher();
  else if (step === 'launch') launchGame();
}

/** The update is down: "Installing" long enough to read that the app will
 *  reopen by itself, then the installer runs silent and restarts it. */
function installFromLauncher() {
  if (launcher.installing) return;
  launcher.installing = true;
  setTimeout(() => autoUpdater().quitAndInstall(true, true), INSTALL_NOTICE_MS);
  // an installer that never took over would leave "Installing" up for ever: play on, and it installs at quit
  setTimeout(() => launcherDispatch({ type: 'install-failed' }), INSTALL_NOTICE_MS + INSTALL_GIVEUP_MS).unref?.();
}

/** The folder the player chose (or the found one they took) becomes the
 *  one the shell reads. A RE-point wipes any stored in-page ingest at the
 *  game's boot, as the File menu's Locate does (Audit DA F-DA2). */
function useArena2(dir) {
  const before = loadConfig().arena2Path;
  setArena2(dir);
  saveConfig({ ...loadConfig(), arena2Path: dir });
  if (before && before !== dir) pendingIngestClear = true;
  launcherDispatch({ type: 'picked', dir });
}

/** The handover: the game's window is built hidden, and at its first paint
 *  it shows and the launcher closes - in that order, so the app is never
 *  without a window (window-all-closed would quit it). */
function launchGame() {
  launcherDispatch({ type: 'launching' });
  const lw = launcher?.win;
  createWindow({
    onShown: () => {
      if (lw && !lw.isDestroyed()) lw.close();
      launcher = null;
      startRechecks();
    },
  });
}

/** The launch check, inside DA6's two gates: the updater transport
 *  downloads what it finds (onUpdaterEvent carries it here); the notice
 *  transport asks the API. Silence past CHECK_TIMEOUT_MS lets the
 *  player in - the reducer ignores an answer that comes later. */
function startLaunchCheck() {
  setTimeout(() => launcherDispatch({ type: 'check-timeout' }), CHECK_TIMEOUT_MS).unref?.();
  if (currentUpdateTransport() === 'updater') {
    autoUpdater().checkForUpdates().catch(() => launcherDispatch({ type: 'check-failed' }));
    return;
  }
  noticeCheck().then((r) => {
    if (!r) launcherDispatch({ type: 'check-failed' });
    else if (!r.newer) launcherDispatch({ type: 'check-none' });
    else {
      launcherDispatch({ type: 'check-available', version: r.version, download: r.download });
      requestNotes(r.version);
    }
  });
}

function runLauncher() {
  const cfg = loadConfig();
  setArena2(resolveArena2(cfg.arena2Path));
  // "What's new" is shown by the launch that runs the version it was saved for, kept until that version
  // installs, and dropped once a newer one runs
  const wn = whatsNewFor(cfg.whatsNew, app.getVersion());
  if (cfg.whatsNew && !wn.keep) {
    const { whatsNew: _shown, ...rest } = cfg;
    saveConfig(rest);
  }
  launcher = {
    win: openLauncherWindow(),
    installing: false,
    state: initialState({
      current: app.getVersion(),
      transport: currentUpdateTransport(),
      checkEnabled: updateChecksEnabled(),
      arena2Ready: !!arena2Dir,
      // the headless probe's: a first-run question with nobody at the screen is a hang
      skipArena2: !!process.env.DAGGER_SKIP_ARENA2_PROMPT,
      whatsNew: wn.show,
    }),
  };
  if (launcher.state.update.status === 'checking') startLaunchCheck();
  advanceLauncher();
}

// The launcher's two words. Only ITS window is heard, and only these
// actions; a link is a name from LAUNCHER_LINKS, never a URL from the page.
ipcMain.on('launcher:ready', (e) => { if (launcher && e.sender === launcher.win.webContents) renderLauncher(); });
ipcMain.on('launcher:act', async (e, msg) => {
  if (!launcher || e.sender !== launcher.win.webContents) return;
  const { action, arg } = msg ?? {};
  const st = launcher.state;
  switch (action) {
    case 'play-now': launcherDispatch({ type: 'play-now' }); break;
    case 'dismiss': launcherDispatch({ type: 'dismiss-notice' }); break;
    case 'play': launcherDispatch({ type: 'whats-new-seen' }); break;
    case 'download': if (st.update.download) shell.openExternal(st.update.download); break;
    case 'skip-setup': launcherDispatch({ type: 'skip-setup' }); break;
    case 'use-found': {
      const f = st.setup.found[Number(arg)];
      const dir = f ? resolveArena2(f.dir) : null;   // judged again: a drive can go away while the window sits open
      if (dir) useArena2(dir);
      else launcherDispatch({ type: 'picked-bad', missing: f ? diagnoseArena2(f.dir) : null });
      break;
    }
    case 'choose-folder': {
      const r = await chooseArena2Folder(launcher.win);
      if (!launcher || r.canceled) break;
      if (r.dir) useArena2(r.dir);
      else launcherDispatch({ type: 'picked-bad', missing: r.missing });
      break;
    }
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
    if (url.startsWith('dagger://')) return { action: 'allow' };
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (e, url) => {
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

  // DA8: the launcher is the first window - the update check (inside DA6's
  // two gates), the first run's files (DA9: found, else chosen; the game's
  // own in-page picker stays the fallback, never a dead end), "What's new",
  // then the game. It used to be a native folder dialog before any window,
  // and a check that installed on quit and told no one.
  runLauncher();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
