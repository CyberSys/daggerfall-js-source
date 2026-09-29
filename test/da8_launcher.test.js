// DA8 (2026-09-29, Mac: "How can we drastically improve the install
// experience? Is there anyway to send a notification that a new update is
// available and just overall improve the experience? A launcher? I really
// want to make it AAA grade").
//
// THE LAUNCHER IS THE SHELL'S FIRST WINDOW, not a second program: a
// Windows update between two releases is ~4.5 MB (the blockmap delta), so
// a separate launcher would make nothing smaller - it would only add a
// thing to install, sign and update. The window checks for an update and
// installs it BEFORE play where this copy can (a client a protocol behind
// the relay is what install-on-quit left a player with, several times a
// day), finds the player's Daggerfall files (DA9), shows what changed, and
// hands over to the game at its first paint. An update that lands later is
// told in the game and offered from the File menu.
//
// The state and every screen are pure (app/lib/launcherState.cjs) and
// driven here; the page and the shell's wiring are pinned by source; the
// real window is driven by tools/appShellProbe.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { updateReadyText, listenForShellUpdates } from '../src/systems/shellUpdates.js';

const require = createRequire(import.meta.url);
const L = require('../app/lib/launcherState.cjs');
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const run = (state, ...events) => events.reduce(L.reduce, state);
const fresh = (over = {}) => L.initialState({ current: '0.1.4613', transport: 'updater', checkEnabled: true, arena2Ready: true, skipArena2: false, ...over });

test('DA8: the updater transport installs BEFORE play - check, download (shown), install, and the app reopens', () => {
  let s = fresh();
  assert.equal(s.update.status, 'checking');
  assert.equal(L.nextStep(s), 'wait', 'nothing starts while the check is out');
  s = run(s, { type: 'check-available', version: '0.1.4684', total: 4.6e6 });
  assert.equal(s.update.status, 'downloading');
  assert.equal(L.nextStep(s), 'wait');
  s = run(s, { type: 'progress', percent: 62.4, transferred: 2.9e6, total: 4.6e6 });
  let v = L.viewOf(s);
  assert.equal(v.title, 'Updating to v0.1.4684');
  assert.deepEqual(v.progress, { percent: 62.4, label: '2.9 of 4.6 MB' });
  assert.deepEqual(v.actions.map((a) => a.id), ['play-now'], 'the one way out: play now, update at quit');
  assert.ok(!v.actions[0].primary, 'and it is NOT the default - Enter does not skip the update');
  s = run(s, { type: 'downloaded', version: '0.1.4684' });
  assert.equal(s.update.status, 'installing');
  assert.equal(L.nextStep(s), 'install');
  v = L.viewOf(s);
  assert.equal(v.stage, 'installing');
  assert.match(v.detail, /close and reopen by itself/, 'the player is told the app comes back on its own');
  assert.deepEqual(v.actions, [], 'nothing to press - it is happening');
  // an installer that never took over does not strand the player on "Installing"
  s = run(s, { type: 'install-failed' });
  assert.equal(s.update.status, 'background');
  assert.equal(L.nextStep(s), 'launch', 'play on - it installs at quit (DA7)');
});

test('DA8: silence is not a reason to wait - an error, a timeout, "Play now", or no check at all lets the player in', () => {
  assert.equal(run(fresh(), { type: 'check-failed' }).update.status, 'offline');
  assert.equal(L.nextStep(run(fresh(), { type: 'check-timeout' })), 'launch');
  assert.equal(L.nextStep(run(fresh(), { type: 'check-none' })), 'launch');
  const late = run(fresh(), { type: 'check-timeout' }, { type: 'check-available', version: '0.1.4684' });
  assert.equal(late.update.status, 'offline', 'an answer after the timeout is the running game\'s to hear, not the launcher\'s');
  const midDownload = run(fresh(), { type: 'check-available', version: '0.1.4684' }, { type: 'check-timeout' });
  assert.equal(midDownload.update.status, 'downloading', 'a timeout never cuts off a download the player can see');
  const skipped = run(fresh(), { type: 'check-available', version: '0.1.4684' }, { type: 'play-now' }, { type: 'downloaded', version: '0.1.4684' });
  assert.equal(skipped.update.status, 'background', 'after "Play now" a finished download does not install from under the player');
  assert.equal(L.nextStep(skipped), 'launch');
  const off = fresh({ checkEnabled: false });
  assert.equal(off.update.status, 'skipped', 'the File-menu checkbox and the probe env (DA6\'s gates)');
  assert.equal(L.nextStep(off), 'launch');
  assert.ok(L.CHECK_TIMEOUT_MS >= 5000 && L.CHECK_TIMEOUT_MS <= 10000, `a slow check is waited on, a dead one is not (${L.CHECK_TIMEOUT_MS} ms)`);
  assert.equal(L.RECHECK_MS, 60 * 60 * 1000, 'a running copy asks again within the hour');
});

test('DA8: the notice transport offers its own file and the choice - Download, or play this version', () => {
  let s = fresh({ transport: 'notice' });
  s = run(s, { type: 'check-available', version: '0.1.4684', download: 'https://github.com/Lattymoy/daggerfall-js-source/releases/latest/download/DaggerfallOnline-mac-arm64.dmg' });
  assert.equal(s.update.status, 'notice');
  assert.equal(L.nextStep(s), 'wait', 'the player decides');
  const v = L.viewOf(s);
  assert.equal(v.title, 'Version 0.1.4684 is out');
  assert.match(v.detail, /^You have v0\.1\.4613\./);
  assert.deepEqual(v.actions.map((a) => [a.id, !!a.primary]), [['download', true], ['dismiss', false]]);
  assert.equal(s.update.download.endsWith('/DaggerfallOnline-mac-arm64.dmg'), true, 'REL5: the file, not a page of eleven');
  s = run(s, { type: 'dismiss-notice' });
  assert.equal(L.nextStep(s), 'launch');
  // notes arrive on their own request, and only for the version they are for
  const n = [{ version: '0.1.4684', text: '# Patch Notes: X' }];
  assert.deepEqual(run(fresh({ transport: 'notice' }), { type: 'check-available', version: '0.1.4684' }, { type: 'notes', version: '0.1.4600', notes: n }).update.notes, []);
  assert.deepEqual(run(fresh({ transport: 'notice' }), { type: 'check-available', version: '0.1.4684' }, { type: 'notes', version: '0.1.4684', notes: n }).update.notes, n);
});

test('DA8/DA9: the first run - detection runs after the update, and a folder is OFFERED, never taken silently', () => {
  let s = fresh({ arena2Ready: false });
  assert.equal(L.nextStep(s), 'wait', 'the update comes first - a folder asked for and then a restart is a worse first minute');
  s = run(s, { type: 'check-none' });
  assert.equal(L.nextStep(s), 'detect');
  assert.equal(L.viewOf(s).title, 'Looking for your Daggerfall files');
  const found = [{ dir: '/steam/DF/DAGGER/ARENA2', source: 'steam' }, { dir: '/home/me/.config/DFU/ARENA2', source: 'dfu' }];
  const withFound = run(s, { type: 'found', found });
  assert.equal(withFound.setup.status, 'found');
  assert.equal(L.nextStep(withFound), 'wait', 'the player chooses');
  const v = L.viewOf(withFound);
  assert.equal(v.title, 'Found Daggerfall on this computer');
  assert.deepEqual(v.found, [{ index: 0, dir: '/steam/DF/DAGGER/ARENA2', from: 'Steam' }, { index: 1, dir: '/home/me/.config/DFU/ARENA2', from: 'from Daggerfall Unity' }]);
  assert.deepEqual(v.actions.map((a) => a.id), ['choose-folder', 'skip-setup']);
  assert.equal(L.viewOf(run(s, { type: 'found', found: found.slice(0, 1) })).title, 'Found your Daggerfall files');
  // nothing found: where to get it, and the website's own picker - never a dead end
  const none = run(s, { type: 'found', found: [] });
  assert.equal(none.setup.status, 'none');
  const nv = L.viewOf(none);
  assert.equal(nv.title, 'Where is Daggerfall?');
  assert.deepEqual(nv.actions.map((a) => [a.id, a.arg ?? null, !!a.primary]),
    [['choose-folder', null, true], ['open', 'steam', false], ['open', 'gog', false], ['skip-setup', null, false]]);
  // a partial folder says which files it lacks - A2-WHOLE's words
  const bad = run(none, { type: 'picked-bad', missing: ['ARCH3D.BSA', 'MAPS.BSA'] });
  assert.equal(L.viewOf(bad).title, 'That folder is not a whole ARENA2');
  assert.match(L.viewOf(bad).detail, /^It has no ARCH3D\.BSA, MAPS\.BSA\. .*DF\/DAGGER\/ARENA2/);
  assert.match(L.viewOf(run(none, { type: 'picked-bad', missing: null })).detail, /^It holds no Daggerfall files\./);
  assert.equal(L.nextStep(run(bad, { type: 'picked', dir: '/x/ARENA2' })), 'launch');
  assert.equal(L.nextStep(run(none, { type: 'skip-setup' })), 'launch', 'the in-page picker takes over, as on the website');
  // the probe's skip, and a whole folder already configured, ask nothing
  assert.equal(fresh({ arena2Ready: false, skipArena2: true }).setup.status, 'ready');
  assert.equal(run(fresh(), { type: 'found', found }).setup.status, 'ready', 'detection never runs over a configured folder');
});

test('DA8: "What\'s new" - shown by the launch that runs the update, once; kept until it installs; dropped once superseded', () => {
  const notes = [{ version: '0.1.4684', text: '# Patch Notes: X' }];
  assert.deepEqual(L.whatsNewFor({ version: '0.1.4684', notes }, '0.1.4684'), { show: { version: '0.1.4684', notes }, keep: false });
  assert.deepEqual(L.whatsNewFor({ version: '0.1.4684', notes }, '0.1.4649'), { show: null, keep: true }, 'downloaded, not yet installed');
  assert.deepEqual(L.whatsNewFor({ version: '0.1.4684', notes }, '0.1.4700'), { show: null, keep: false }, 'superseded');
  assert.deepEqual(L.whatsNewFor(undefined, '0.1.4684'), { show: null, keep: false });
  let s = fresh({ checkEnabled: false, whatsNew: { version: '0.1.4684', notes } });
  assert.equal(L.nextStep(s), 'wait');
  let v = L.viewOf(s);
  assert.equal(v.title, 'Updated to v0.1.4684');
  assert.equal(v.notesTitle, "What's new");
  assert.deepEqual(v.notes, notes);
  assert.deepEqual(v.actions.map((a) => [a.id, !!a.primary]), [['play', true]]);
  s = run(s, { type: 'whats-new-seen' });
  assert.equal(L.nextStep(s), 'launch');
  // while the post-update check runs, the notes are already up
  v = L.viewOf(fresh({ whatsNew: { version: '0.1.4684', notes } }));
  assert.equal(v.stage, 'checking');
  assert.deepEqual(v.notes, notes);
});

test('DA8: the notes a player reads are the patch notes of every version between theirs and the new one - never the list of pull requests', () => {
  const body = '# Patch Notes: The Sea\n\n- Boats.\n\n## What\'s Changed\n* A PR by @someone in https://x\n\n**Full Changelog**: https://y';
  assert.equal(L.playerNotes(body), '# Patch Notes: The Sea\n\n- Boats.');
  assert.equal(L.playerNotes('Fixes and improvements.\n\n**Full Changelog**: https://y'), 'Fixes and improvements.');
  assert.equal(L.playerNotes(null), '');
  const releases = [
    { tag_name: 'app-v0.1.4700', body: '# Patch Notes: Too new' },
    { tag_name: 'app-v0.1.4684', body: 'Fixes and improvements.\n\n## What\'s Changed\n* x' },
    { tag_name: 'app-v0.1.4649', body: 'Fixes and improvements.' },
    { tag_name: 'app-v0.1.4644', body: '# Patch Notes: Overworld\n- Walk.\n\n## What\'s Changed\n* y' },
    { tag_name: 'app-v0.1.4640', body: '# Patch Notes: Draft', draft: true },
    { tag_name: 'app-v0.1.4630', body: '# Patch Notes: Pre', prerelease: true },
    { tag_name: 'site-v9', body: '# not a release of the app' },
    { tag_name: 'app-v0.1.4613', body: '# Patch Notes: Already had it' },
  ];
  assert.deepEqual(L.notesBetween(releases, '0.1.4613', '0.1.4684'), [{ version: '0.1.4644', text: '# Patch Notes: Overworld\n- Walk.' }],
    'the versions in (mine, new], published, with something to say');
  assert.deepEqual(L.notesBetween(releases.slice(1, 3), '0.1.4613', '0.1.4684'), [{ version: '0.1.4684', text: 'Fixes and improvements.' }],
    'when none says anything, one line stands for them all');
  const many = Array.from({ length: 12 }, (_, i) => ({ tag_name: `app-v0.1.${5000 + i}`, body: `# Patch Notes: ${i}` }));
  const capped = L.notesBetween(many, '0.1.4999', '0.1.5011');
  assert.equal(capped.length, L.NOTES_MAX);
  assert.equal(capped[0].version, '0.1.5011', 'newest first');
  assert.deepEqual(L.notesBetween('not a list', '0.1.1', '0.1.2'), []);
  assert.deepEqual(L.notesBetween(releases, 'garbage', '0.1.4684'), []);
});

test('DA8: the page - its own files only, no inline code, every word as text, the brand\'s own colours and faces', () => {
  const html = rd('app/launcher/index.html');
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.equal(csp, "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self' data:", 'nothing remote, nothing inline');
  assert.doesNotMatch(html, /<script>|<style>|\son\w+=|https?:\/\//i, 'no inline script or style, no handler attribute, no remote URL');
  const js = rd('app/launcher/launcher.js');
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/, 'patch notes come from GitHub: they reach the page as TEXT');
  assert.match(js, /bridge\.act\('use-found', f\.index\)/, 'a found folder is chosen by its index - the shell holds the path');
  assert.doesNotMatch(js, /\.focus\(\{ preventScroll: true \}\)[\s\S]{0,40}\?\? document\.querySelector\('\.plaque'\)|querySelector\('\.plaque'\)\?\.focus/, 'only a primary answer takes Enter');
  const css = rd('app/launcher/launcher.css');
  const skin = rd('src/ui/enhancedStyle.js');
  const norm = (c) => c.toLowerCase().replace(/\s+/g, '');
  const colours = (text) => new Set([...text.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)].map((m) => norm(m[0])));
  const foreign = [...colours(css.replace(/url\(data:[^)]*\)/g, ''))].filter((c) => !colours(skin).has(c));
  assert.deepEqual(foreign, [], 'every colour on the launcher is one the Enhanced skin already uses (U63\'s law, the landing page\'s)');
  // the digit five is the brand's everywhere: the same 520-byte Silkscreen glyph the landing page carries
  const five = (text) => text.match(/font-family: 'Pixelify Five'; unicode-range: U\+0035;[^}]*url\((data:font\/woff2;base64,[A-Za-z0-9+/=]+)\)/)?.[1];
  assert.ok(five(css) && five(css) === five(rd('index.html')), 'the launcher\'s five IS the landing page\'s');
  // the two faces ship on disk, byte for byte what the README records
  const readme = rd('app/launcher/fonts/README.md');
  for (const f of ['Jacquard12-latin.woff2', 'PixelifySans-latin.woff2']) {
    const bytes = readFileSync(new URL(`../app/launcher/fonts/${f}`, import.meta.url));
    const sha = createHash('sha256').update(bytes).digest('hex');
    assert.match(readme, new RegExp(`\\| \`${f.replace('.', '\\.')}\` \\|[^\\n]*\\| \`${sha}\` \\|`), `${f}: its README row names its sha256`);
    assert.match(css, new RegExp(`url\\(fonts/${f.replace('.', '\\.')}\\)`), `${f}: and the stylesheet loads it`);
  }
  for (const lic of ['OFL-Jacquard12.txt', 'OFL-PixelifySans.txt']) {
    assert.match(rd(`app/launcher/fonts/${lic}`), /SIL Open Font License, Version 1\.1/, `${lic}: the licence rides with the face`);
  }
});

test('DA8: the shell - a sandboxed window on its own origin, two words of bridge, a fixed set of links, and a handover that never leaves the app windowless', () => {
  const main = rd('app/main.cjs');
  const preload = rd('app/launcherPreload.cjs');
  assert.deepEqual([...preload.matchAll(/^ {2}(\w+): /gm)].map((m) => m[1]), ['onView', 'act'], 'the launcher\'s bridge: hear the view, say which button');
  assert.doesNotMatch(preload, /require\('(node:)?(fs|path|child_process)'\)|fileStorage/, 'no file, no storage, no process');
  const win = main.slice(main.indexOf('function openLauncherWindow()'), main.indexOf('function renderLauncher()'));
  assert.match(win, /preload: path\.join\(__dirname, 'launcherPreload\.cjs'\),\s*contextIsolation: true,\s*nodeIntegration: false,\s*sandbox: true,/, 'sandboxed, isolated');
  assert.match(win, /win\.loadURL\(LAUNCHER_URL\)/);
  assert.match(main, /const LAUNCHER_URL = 'dagger:\/\/launcher\/index\.html';/, 'its own origin - no storage shared with dagger://game');
  const serve = main.slice(main.indexOf('async function serveLauncherFile'), main.indexOf('function handleDagger'));
  assert.match(serve, /if \(!p\.startsWith\(LAUNCHER_DIR \+ path\.sep\)\) return new Response\('forbidden', \{ status: 403 \}\);/, 'the same traversal law as dist/');
  assert.match(main, /if \(url\.host === 'launcher'\) return serveLauncherFile\(parts\);/);
  // the IPC hears ONLY the launcher's window, and a link is a NAME
  assert.match(main, /ipcMain\.on\('launcher:act', async \(e, msg\) => \{\s*if \(!launcher \|\| e\.sender !== launcher\.win\.webContents\) return;/);
  assert.match(main, /case 'open': if \(Object\.hasOwn\(LAUNCHER_LINKS, arg\)\) shell\.openExternal\(LAUNCHER_LINKS\[arg\]\); break;/);
  assert.match(main, /steam: 'https:\/\/store\.steampowered\.com\/app\/1812390\/',/);
  assert.match(main, /case 'download': if \(st\.update\.download\) shell\.openExternal\(st\.update\.download\); break;/, 'the download URL is the shell\'s own, never the page\'s');
  // REL5: and it is THIS copy's own file by the name that never moves - the dmg, the portable exe
  const latest = main.slice(main.indexOf('async function fetchLatestRelease()'), main.indexOf('/** The recent releases'));
  assert.match(latest, /const file = manualDownloadFile\(\{ platform: process\.platform, portable: !!process\.env\.PORTABLE_EXECUTABLE_DIR, packaged: app\.isPackaged \}\);/);
  assert.match(latest, /download: file \? latestDownloadUrl\(file\) : url/, 'the release page only where there is no one file to name');
  // the handover: the game shows at its first paint, THEN the launcher closes (window-all-closed would quit)
  const hand = main.slice(main.indexOf('function launchGame()'), main.indexOf('function startLaunchCheck()'));
  assert.match(hand, /createWindow\(\{\s*onShown: \(\) => \{\s*if \(lw && !lw\.isDestroyed\(\)\) lw\.close\(\);/);
  assert.equal((hand.match(/\.close\(\)/g) ?? []).length, 1, 'and nothing else closes it - a launcher shut before the game shows quits the app');
  assert.match(main, /win\.once\('ready-to-show', reveal\);\s*setTimeout\(reveal, GAME_REVEAL_MS\)/, 'a first paint that never comes still shows the game');
  // the install: silent, reopening - and never stuck on "Installing"
  const inst = main.slice(main.indexOf('function installFromLauncher()'), main.indexOf('function useArena2('));
  assert.match(inst, /autoUpdater\(\)\.quitAndInstall\(true, true\)/, 'silent (the NSIS finish page would wait for a click) and run after');
  assert.match(inst, /launcherDispatch\(\{ type: 'install-failed' \}\)/);
  // what changed is saved with the download, for the launch that runs it
  const routed = main.slice(main.indexOf('function onUpdaterEvent('), main.indexOf('/** The notes of every release'));
  assert.match(routed, /updateReady = \{ version, told: false \};\s*rememberWhatsNew\(version\);/);
  assert.match(routed, /if \(!installingNow\) \{ updateReady\.told = tellGame\(\{ version, manual: false \}\); buildMenu\(\); \}/, 'an update the launcher is not installing is the game\'s to hear');
  assert.match(main, /label: `Restart to Update \(v\$\{updateReady\.version\}\)`/, 'and it waits in the File menu');
  assert.match(main, /message: `Restart to install v\$\{updateReady\?\.version\}\?`/, 'asked first - the game is running');
  // the installed app wears the brand's own mark (TI2's home-screen icon) - taskbar, Start menu, dock, installer,
  // AppImage - where it wore Electron's atom (electron-builder: "default Electron icon is used")
  const build = JSON.parse(rd('app/package.json')).build;
  assert.equal(build.icon, '../public/icons/icon-512.png');
  const icon = readFileSync(new URL('../public/icons/icon-512.png', import.meta.url));
  assert.deepEqual([icon.readUInt32BE(16), icon.readUInt32BE(20)], [512, 512], 'at least 512px - what a macOS icon is converted from');
  // packaged: electron-builder ships the launcher's files, or the first window is a 404
  const files = build.files;
  for (const f of ['launcherPreload.cjs', 'launcher/**']) assert.ok(files.includes(f), `${f} is packed`);
  assert.ok(existsSync(new URL('../app/launcher/index.html', import.meta.url)));
  // the first run is the launcher's now: no bare native dialog before any window
  const ready = main.slice(main.indexOf('app.whenReady()'));
  assert.doesNotMatch(ready, /pickArena2\(null\)/);
  assert.match(ready, /runLauncher\(\);/);
});

test('DA8: in the game - the update is a HUD line saying what the player can do; a browser tab hears nothing', () => {
  assert.equal(updateReadyText({ version: '0.1.4684', manual: false }),
    'Daggerfall Online 0.1.4684 is ready. It installs when you quit, or now from File > Restart to Update - save first.');
  assert.equal(updateReadyText({ version: '0.1.4684', manual: true }),
    'Daggerfall Online 0.1.4684 is out. Download it from the File menu when you are ready - your saves stay where they are.');
  assert.match(updateReadyText({ version: '<img src=x>' }), /^A new version of Daggerfall Online is ready\./, 'only a version\'s own shape is spoken');
  assert.equal(listenForShellUpdates(undefined, () => {}), false, 'a browser tab has no shell');
  assert.equal(listenForShellUpdates({}, () => {}), false, 'a shell too old to have the word');
  const said = [];
  let fire = null;
  assert.equal(listenForShellUpdates({ onUpdateReady: (cb) => { fire = cb; } }, (t) => said.push(t)), true);
  fire({ version: '0.1.4700', manual: false });
  assert.deepEqual(said, [updateReadyText({ version: '0.1.4700', manual: false })]);
  // wired at boot, through notify's host-less door, only where a shell is
  const boot = rd('src/main.js');
  assert.match(boot, /if \(typeof globalThis\.daggerShell\?\.onUpdateReady === 'function'\) \{\s*Promise\.all\(\[import\('\.\/systems\/shellUpdates\.js'\), import\('\.\/systems\/notify\.js'\)\]\)\s*\.then\(\(\[updates, notify\]\) => updates\.listenForShellUpdates\(globalThis\.daggerShell, \(text\) => notify\.hudTextWhenShown\(text, 12\)\)\)/);
  assert.doesNotMatch(boot, /^import .*shellUpdates/m, 'off the entry\'s static graph (BOOT2)');
  // the preload keeps the news for a page that subscribes late (a boot, the game window's first load)
  const preload = rd('app/preload.cjs');
  assert.match(preload, /ipcRenderer\.on\('dagger:update-ready', \(_e, info\) => \{\s*updateHeard = info;/);
  assert.match(preload, /onUpdateReady: \(cb\) => \{\s*updateListeners\.push\(cb\);\s*if \(updateHeard\) cb\(updateHeard\);/);
});
