// DA5: the desktop shell, launched for real. Headless proof that the
// downloadable app actually is the game with files under it:
//
//   1. Electron boots app/main.cjs, the dagger:// protocol serves the
//      BUILT dist/ (so `npm run build` first), and the game's entry
//      document arrives with its scripts;
//   2. the preload bridge is standing: window.daggerShell.storage
//      speaks the five words from the page;
//   3. a save written FROM THE PAGE lands on disk in DFU's layout
//      (Saves/SAVE9/SaveData.txt + SaveInfo.txt + Screenshot.jpg,
//      with the screenshot a real JPEG), reads back byte-identical,
//      and enumerates. (This drives the BRIDGE; the DA1 seam's wrap
//      of it is pinned node-side in test/filestorage.test.js - the
//      built bundle's own use of the seam is not separately proved
//      here, said out loud so nobody reads this probe as covering
//      it.)
//
// Needs a display (xvfb-run -a on a headless box) and the shell's
// deps (`cd app && npm install`). No ARENA2 required: the probe never
// leaves the boot overlay, and the storage laws it proves do not care.
//
// DA8: the first window is the LAUNCHER now (dagger://launcher). With
// the probe's two opt-outs it has nothing to ask and hands over to the
// game at once; the scenarios after the storage laws drive it for real -
// the first run with nothing found, a Steam library found and its
// ARENA2 served to the game, "What's new" shown once, and an update's
// in-game notice crossing the bridge. Each runs its own shell over its
// own temp userData and HOME, so the player's real machine is never read.
//
//   npm run build && xvfb-run -a node tools/appShellProbe.mjs

import { _electron } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'app', 'package.json'));
const electronPath = require('electron');   // app/node_modules - the shell's own binary
// the version the shell reports: app/package.json's - which is also a packaged binary's, since the
// release stamps that same file before electron-builder reads it
const APP_VERSION = JSON.parse(fs.readFileSync(path.join(root, 'app', 'package.json'), 'utf8')).version;

/** Poll until `pred` holds or `ms` pass. */
async function waitFor(pred, ms = 10000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await pred()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}
/** DA8: the game's window, once the launcher has handed over (polled: a window's
 *  first event can come before it has navigated anywhere). */
async function gameWindow(app) {
  const isGame = (w) => w.url().startsWith('dagger://game/');
  await waitFor(() => app.windows().some(isGame), 20000);
  const game = app.windows().find(isGame);
  if (!game) throw new Error(`no game window (windows: ${app.windows().map((w) => w.url()).join(', ')})`);
  return game;
}

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'dagger-shell-probe-'));
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'ok' : 'NOT OK'} - ${label}`);
  if (!ok) failures++;
};

let app = null;
try {
  // DAGGER_SHELL_EXE points the probe at a PACKAGED binary (the
  // release/linux-unpacked build) instead of dev electron over app/ -
  // same checks, so the installer's payload is held to the same laws.
  const exe = process.env.DAGGER_SHELL_EXE;
  app = await _electron.launch({
    executablePath: exe ?? electronPath,
    args: exe ? ['--no-sandbox'] : ['--no-sandbox', path.join(root, 'app')],
    env: {
      ...process.env,
      DAGGER_USER_DATA: userData,
      DAGGER_SKIP_ARENA2_PROMPT: '1',
      DAGGER_NO_UPDATE_CHECK: '1',   // the probe proves the shell, not GitHub's uptime
    },
  });
  // DA8: the launcher first - with both opt-outs it has nothing to ask and hands over at once, often
  // before this probe attaches, so "the launcher is the first window" is held where it waits (below)
  const page = await gameWindow(app);
  await page.waitForLoadState('domcontentloaded');

  check(page.url() === 'dagger://game/play/index.html', `the game document over dagger:// (got ${page.url()})`);
  await waitFor(() => app.windows().length === 1);
  check(app.windows().length === 1, 'the launcher closed once the game showed');
  check(await page.evaluate(() => !!document.querySelector('script')), 'the built entry script arrived');

  const bridge = await page.evaluate(() => ({
    has: !!window.daggerShell,
    words: window.daggerShell ? Object.keys(window.daggerShell.storage).sort() : [],
    savesPath: window.daggerShell?.savesPath ?? null,
  }));
  check(bridge.has, 'daggerShell bridge exposed');
  check(bridge.words.join(',') === 'getItem,key,length,removeItem,setItem', `the five words (got ${bridge.words})`);
  check(bridge.savesPath === path.join(userData, 'Saves'), 'savesPath points at the Saves folder itself');

  // The protocol's web-host manners: a directory serves its
  // index.html (the landing page links Play as ./play/), and
  // malformed percent-encoding answers as a failed REQUEST, never a
  // dead renderer.
  const manners = await page.evaluate(async () => {
    const dir = await fetch('dagger://game/play/');
    let badOk = false;
    try { const r = await fetch('dagger://game/play/%E0'); badOk = !r.ok; } catch { badOk = true; }
    return { dirOk: dir.ok, badOk, alive: true };
  });
  check(manners.dirOk, 'a directory request serves its index.html');
  check(manners.badOk && manners.alive, 'malformed percent-encoding refuses without killing the page');

  // A save from the page, DFU-shaped on disk. A tiny real JPEG (SOI +
  // EOI) rides as the screenshot.
  const shot = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
  const roundTrip = await page.evaluate((shotUrl) => {
    const s = window.daggerShell.storage;
    s.setItem('dagger.save.9', '{"v":1,"name":"Probe"}');
    s.setItem('dagger.saveinfo.9', '{"saveName":"ProbeSave","characterName":"Probe"}');
    s.setItem('dagger.saveshot.9', shotUrl);
    s.setItem('dagger.settings.v1', '{"Video":{"Fullscreen":"True"}}');
    const keys = [];
    for (let i = 0; i < s.length(); i++) keys.push(s.key(i));
    return { back: s.getItem('dagger.save.9'), shotBack: s.getItem('dagger.saveshot.9'), keys };
  }, shot);
  check(roundTrip.back === '{"v":1,"name":"Probe"}', 'SaveData round-trips byte-identical through the bridge');
  check(roundTrip.shotBack === shot, 'the screenshot data URL round-trips');
  check(roundTrip.keys.includes('dagger.saveinfo.9') && roundTrip.keys.includes('dagger.settings.v1'),
    `enumeration sees the writes (got ${roundTrip.keys})`);

  const slotDir = path.join(userData, 'Saves', 'SAVE9');
  check(fs.readFileSync(path.join(slotDir, 'SaveData.txt'), 'utf8') === '{"v":1,"name":"Probe"}',
    'Saves/SAVE9/SaveData.txt holds the exact bytes');
  check(fs.existsSync(path.join(slotDir, 'SaveInfo.txt')), 'SaveInfo.txt beside it');
  const jpg = fs.readFileSync(path.join(slotDir, 'Screenshot.jpg'));
  check(jpg[0] === 0xff && jpg[1] === 0xd8, 'Screenshot.jpg is a real JPEG on disk');
  check(fs.existsSync(path.join(userData, 'Prefs', 'dagger.settings.v1')), 'settings landed under Prefs/');

  // The DA1 seam from inside the game's own modules: the entry chunk
  // already booted; ask the page-side wrap directly.
  const seam = await page.evaluate(() => {
    const s = window.daggerShell.storage;
    s.removeItem('dagger.save.9'); s.removeItem('dagger.saveinfo.9'); s.removeItem('dagger.saveshot.9');
    return s.getItem('dagger.save.9');
  });
  check(seam === null, 'removeItem answers null afterwards, localStorage-style');
  check(!fs.existsSync(slotDir), 'the emptied SAVE9 folder went with its last file');

  // DA8: an update that lands while the game runs is told to the page. It is SENT first and listened
  // for after, so this also holds the preload to keeping it for a page that subscribes late (a boot).
  await app.evaluate(({ BrowserWindow }) => {
    for (const w of BrowserWindow.getAllWindows()) w.webContents.send('dagger:update-ready', { version: '9.9.9', manual: false });
  });
  const told = await page.evaluate(() => new Promise((resolve) => {
    window.daggerShell.onUpdateReady((info) => resolve(info));
    setTimeout(() => resolve(null), 3000);
  }));
  check(told?.version === '9.9.9' && told.manual === false, `the game hears the shell's update (got ${JSON.stringify(told)})`);
} finally {
  // app may never have launched - the temp userData must not outlive
  // the probe either way.
  try { await app?.close(); } catch { /* already down */ }
  fs.rmSync(userData, { recursive: true, force: true });
}

// ---- DA8/DA9: the launcher, driven ------------------------------------
const WHOLE = ['ARCH3D.BSA', 'BLOCKS.BSA', 'MAPS.BSA', 'MONSTER.BSA', 'WOODS.WLD', 'TEXT.RSC', 'ART_PAL.COL'];
/** A shell over its own temp userData and HOME - the player's machine is never read. */
async function scenario(name, { setup = () => {}, env = {} } = {}, body) {
  const dirs = { userData: fs.mkdtempSync(path.join(os.tmpdir(), 'dagger-la-ud-')), home: fs.mkdtempSync(path.join(os.tmpdir(), 'dagger-la-home-')) };
  let shell = null;
  try {
    setup(dirs);
    const exe = process.env.DAGGER_SHELL_EXE;
    shell = await _electron.launch({
      executablePath: exe ?? electronPath,
      args: exe ? ['--no-sandbox'] : ['--no-sandbox', path.join(root, 'app')],
      env: { ...process.env, HOME: dirs.home, USERPROFILE: dirs.home, XDG_CONFIG_HOME: '', XDG_DATA_HOME: '', DAGGER_USER_DATA: dirs.userData, DAGGER_NO_UPDATE_CHECK: '1', ...env },
    });
    const launcherPage = await shell.firstWindow();
    // a launcher with nothing to ask hands over at once, and may be closing already - its bodies go to the game
    await launcherPage.waitForLoadState('domcontentloaded').catch(() => {});
    await body(shell, launcherPage, dirs);
  } catch (err) {
    check(false, `${name}: ${err?.message ?? err}`);
  } finally {
    try { await shell?.close(); } catch { /* already down */ }
    fs.rmSync(dirs.userData, { recursive: true, force: true });
    fs.rmSync(dirs.home, { recursive: true, force: true });
  }
}
const titleOf = async (p) => (await p.textContent('#title'))?.trim();
const waitTitle = async (p, want) => { await waitFor(async () => (await titleOf(p)) === want); return titleOf(p); };
const configOf = (dirs) => { try { return JSON.parse(fs.readFileSync(path.join(dirs.userData, 'config.json'), 'utf8')); } catch { return {}; } };

await scenario('first run, nothing found', {}, async (shell, lp) => {
  check(lp.url() === 'dagger://launcher/index.html', `the launcher is the first window (got ${lp.url()})`);
  check(await waitTitle(lp, 'Where is Daggerfall?') === 'Where is Daggerfall?', 'a first run with no Daggerfall asks where it is - in the launcher, not a bare dialog');
  const bridge = await lp.evaluate(() => ({ words: Object.keys(window.daggerLauncher ?? {}).sort().join(','), shell: typeof window.daggerShell }));
  check(bridge.words === 'act,onView' && bridge.shell === 'undefined', `the launcher's bridge is two words and no storage (got ${bridge.words}; daggerShell ${bridge.shell})`);
  const actions = await lp.$$eval('#actions button', (b) => b.map((x) => x.textContent));
  check(actions.includes('Get it on Steam') && actions.includes('Get it on GOG'), `and says where to get it (got ${actions.join(' / ')})`);
  await lp.click('text=Choose in the game instead');
  const game = await gameWindow(shell);
  check(game.url() === 'dagger://game/play/index.html', 'choosing in the game hands over to the game - the website\'s picker, never a dead end');
});

await scenario('a Steam library found', {
  setup: ({ home }) => {
    const lib = path.join(home, '.local', 'share', 'Steam');
    fs.mkdirSync(path.join(lib, 'steamapps'), { recursive: true });
    fs.writeFileSync(path.join(lib, 'steamapps', 'appmanifest_1812390.acf'), '"AppState" { "installdir" "The Elder Scrolls II Daggerfall" }');
    const a2 = path.join(lib, 'steamapps', 'common', 'The Elder Scrolls II Daggerfall', 'DF', 'DAGGER', 'ARENA2');
    fs.mkdirSync(a2, { recursive: true });
    for (const n of WHOLE) fs.writeFileSync(path.join(a2, n), n === 'ART_PAL.COL' ? 'palette-bytes' : 'x');
  },
}, async (shell, lp, dirs) => {
  check(await waitTitle(lp, 'Found your Daggerfall files') === 'Found your Daggerfall files', 'a Steam install is FOUND on first run');
  const found = await lp.$$eval('.found .from', (e) => e.map((x) => x.textContent));
  check(found.length === 1 && found[0] === 'Steam', `offered once, as Steam's (got ${found.join(', ')})`);
  await lp.click('text=Use these files');
  const game = await gameWindow(shell);
  const a2 = fs.realpathSync(path.join(dirs.home, '.local', 'share', 'Steam', 'steamapps', 'common', 'The Elder Scrolls II Daggerfall', 'DF', 'DAGGER', 'ARENA2'));
  check(configOf(dirs).arena2Path === a2, 'the found folder is the one config.json keeps');
  const served = await game.evaluate(async () => { const r = await fetch('./arena2/ART_PAL.COL'); return r.ok ? r.text() : `HTTP ${r.status}`; });
  check(served === 'palette-bytes', `and the game reads ARENA2 straight from it (got ${served})`);
});

await scenario('a partial folder is not ARENA2', {
  setup: ({ userData, home }) => {
    const dos = path.join(home, 'DOSGAMES', 'DAGGER', 'ARENA2');
    fs.mkdirSync(dos, { recursive: true });
    for (const n of ['ART_PAL.COL', 'TEXT.RSC']) fs.writeFileSync(path.join(dos, n), 'x');   // the CD kept the BSAs
    fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ arena2Path: path.dirname(dos) }));
  },
}, async (shell, lp) => {
  check(await waitTitle(lp, 'Where is Daggerfall?') === 'Where is Daggerfall?',
    'DA9: a saved folder missing the BSAs is not served as ARENA2 - the launcher asks again instead of a boot that dies on ARCH3D.BSA');
});

await scenario('the unload guard asks instead of trapping the player', { env: { DAGGER_SKIP_ARENA2_PROMPT: '1' } }, async (shell) => {
  // UNLOAD-ASK: the game's guard (systems/unloadGuard.js) cancels an unload while progress is at risk. A browser
  // asks "Leave site?"; Electron just cancels - so the shell asks. The guard is armed here in its own shape
  // (this probe never spawns a player), the page is given a real click (the activation a player in the world
  // has), and the shell's dialog is answered both ways.
  const game = await gameWindow(shell);
  await game.waitForLoadState('domcontentloaded');
  game.on('dialog', (d) => { d.dismiss().catch(() => {}); });   // CDP surfaces the beforeunload too; the SHELL's answer is under test
  await game.evaluate(() => addEventListener('beforeunload', (e) => { e.preventDefault(); e.returnValue = ''; return ''; }));
  await game.mouse.click(200, 200);
  const closeAnswering = (answer) => shell.evaluate(async ({ BrowserWindow, dialog }, a) => {
    const keep = BrowserWindow.getAllWindows().find((x) => x.__probeKeep) ?? Object.assign(new BrowserWindow({ show: false }), { __probeKeep: true });
    dialog.showMessageBoxSync = () => a;
    const w = BrowserWindow.getAllWindows().find((x) => x !== keep && x.webContents.getURL().startsWith('dagger://game/'));
    w.close();
    await new Promise((r) => setTimeout(r, 1500));
    return { open: !w.isDestroyed() };
  }, answer);
  check((await closeAnswering(1)).open === true, 'UNLOAD-ASK: "Stay" keeps a game whose progress is at risk open');
  check((await closeAnswering(0)).open === false, 'UNLOAD-ASK: "Leave" closes it - the window\'s X, Alt+F4 and Quit work once a player is in the world');
});

await scenario('what\'s new, once', {
  setup: ({ userData }) => fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({
    whatsNew: { version: APP_VERSION, notes: [{ version: APP_VERSION, text: '# Patch Notes: The Probe\n\n## Fixes\n- **Probe:** a line.' }] },
  })),
  env: { DAGGER_SKIP_ARENA2_PROMPT: '1' },
}, async (shell, lp, dirs) => {
  check(await waitTitle(lp, `Updated to v${APP_VERSION}`) === `Updated to v${APP_VERSION}`, 'the launch that runs an update shows what changed');
  const notes = await lp.$$eval('#notes h4, #notes li', (e) => e.map((x) => x.textContent));
  check(notes.includes('The Probe') && notes.includes('Probe: a line.'), `the patch notes, as text (got ${notes.join(' | ')})`);
  check(!('whatsNew' in configOf(dirs)), 'and only once - config.json lets it go');
  await lp.click('text=Play');
  const game = await gameWindow(shell);
  check(game.url() === 'dagger://game/play/index.html', 'Play hands over to the game');
});

console.log(failures ? `\n${failures} FAILURE(S)` : '\nall shell probes green');
process.exit(failures ? 1 : 0);
