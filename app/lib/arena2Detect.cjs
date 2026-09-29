// DA9 (2026-09-29, Mac: "How can we drastically improve the install
// experience? ... I really want to make it AAA grade"): THE SHELL LOOKS
// BEFORE IT ASKS, AND KNOWS A WHOLE FOLDER FROM A PART OF ONE.
//
// TWO FAULTS, ONE FILE.
//
// 1. The first run was a bare native folder dialog - before any window,
//    any name, any word about what ARENA2 is - over a folder most
//    players have to dig for: on Steam it sits four levels down, in
//    steamapps/common/<the game>/DF/DAGGER/ARENA2, on whichever library
//    drive Steam put it. The player's machine usually already knows
//    where it is. So the launcher (DA8) LOOKS first, in the places a
//    copy of Daggerfall is actually installed:
//      - Daggerfall Unity's own settings.ini, whose [Daggerfall]
//        MyDaggerfallPath is the folder its setup already validated -
//        the player who came here from DFU has done this once;
//      - every Steam library (libraryfolders.vdf) holding app 1812390,
//        at the installdir its appmanifest names;
//      - GOG's installs (GOG Galaxy's registry on Windows, the default
//        game folders elsewhere);
//      - a folder named for Daggerfall in the obvious places a
//        DaggerfallGameFiles.zip gets unpacked (Downloads, Desktop,
//        Documents, Games).
//    It offers what it finds; it never picks silently.
//
// 2. The shell's own test for "this is ARENA2" was ONE file, ART_PAL.COL,
//    while the game's has been seven since A2-WHOLE (Discord 2026-09-22:
//    "boot failed: ARCH3D.BSA: 404"). The website stopped storing a
//    partial folder that day; the app kept accepting one. A DOS
//    install's small ARENA2 (the BSAs left on the CD) passed the shell,
//    was saved to config.json, served the palette, and died on the first
//    model - and the shell never asked again, because the path it had
//    was "valid". Every folder is held to REQUIRED_ARENA2 now, the same
//    list the game boots against (pinned equal to
//    src/scenes/dataSource.js by test/da9_arena2detect.test.js).
//
// Read-only, bounded (a capped walk, a capped depth), and it never
// throws: a detector that can crash the first launch is worse than none.
// Plain Node, no Electron - `node --test` drives it over temp trees.
//
// AUDIT INSTALL (lane 4, 2026-09-29): it runs OFF the main process now
// (arena2DetectWorker.cjs, under a deadline - a sleeping network drive or
// a hung reg.exe froze the launcher's first paint), and it looks where
// the files really are: a DaggerfallGameFiles.zip unpacked with "Extract
// Here" leaves a bare arena2/ in Downloads; Windows' Known Folder Move and
// a localized XDG Downloads are the shell's to name (looseDirs, from
// app.getPath); a symlinked or junctioned folder is followed (once - the
// walk keeps the real paths it has opened); GOG's registry is asked for
// Daggerfall's own product key, whatever the folder was called; and on
// macOS the privacy-guarded folders (Downloads, Desktop, Documents - each
// a system prompt) are read only when nothing else was found.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

/** A2-WHOLE: the files every boot reads before a player sees a frame. */
const REQUIRED_ARENA2 = Object.freeze([
  'ARCH3D.BSA', 'BLOCKS.BSA', 'MAPS.BSA', 'MONSTER.BSA', 'WOODS.WLD', 'TEXT.RSC', 'ART_PAL.COL',
]);

/** The Elder Scrolls II: Daggerfall on Steam (the landing page's own link). */
const STEAM_APP_ID = '1812390';

/** Daggerfall on GOG (its Galaxy registry key: HKLM\...\GOG.com\Games\<id>). */
const GOG_PRODUCT_ID = '1435829353';

/** How deep under an install folder ARENA2 may sit (Steam's is
 *  DF/DAGGER/ARENA2 - three), and how many folders one search may open. */
const SEARCH_DEPTH = 4;
const SEARCH_DIRS_MAX = 400;

const DAGGERFALL_DIR_RE = /daggerfall/i;
/** A macOS bundle is an app, never an install folder - "Daggerfall Online.app" is this one. */
const BUNDLE_RE = /\.app$/i;

/** name UPPERCASE -> on-disk name, or null when the folder is unreadable. */
function listUpper(dir, fsImpl = fs) {
  try {
    const m = new Map();
    for (const f of fsImpl.readdirSync(dir)) m.set(f.toUpperCase(), f);
    return m;
  } catch { return null; }
}

/** `name` inside `dir`, whatever its case on disk, or null. */
function findCaseInsensitive(dir, name, fsImpl = fs) {
  const onDisk = listUpper(dir, fsImpl)?.get(String(name).toUpperCase());
  return onDisk ? path.join(dir, onDisk) : null;
}

/** EVERY `name` inside `dir` in any case - on Linux ARENA2 and arena2 can
 *  stand side by side, and the whole one may be either (lane 4 #9). */
function allCaseInsensitive(dir, name, fsImpl = fs) {
  try {
    const want = String(name).toUpperCase();
    return fsImpl.readdirSync(dir).filter((f) => f.toUpperCase() === want).map((f) => path.join(dir, f));
  } catch { return []; }
}

/** The required files `dir` lacks (by any case), or null when it cannot be read. */
function missingArena2(dir, fsImpl = fs) {
  const names = listUpper(dir, fsImpl);
  if (!names) return null;
  return REQUIRED_ARENA2.filter((n) => !names.has(n));
}

/**
 * THE ONE TEST. The ARENA2 folder at or directly inside `dir` - the
 * folder itself, or an arena2/ child of any case (a pick of the install
 * folder is the honest mistake and costs nothing) - when it is WHOLE;
 * otherwise null.
 */
function resolveArena2(dir, fsImpl = fs) {
  if (!dir || typeof dir !== 'string') return null;
  if (missingArena2(dir, fsImpl)?.length === 0) return dir;
  for (const nested of allCaseInsensitive(dir, 'arena2', fsImpl)) {
    if (missingArena2(nested, fsImpl)?.length === 0) return nested;
  }
  return null;
}

/**
 * Why a picked folder is not ARENA2, for the words the picker says: the
 * files missing from the nearer of the folder and its arena2/ child that
 * holds ANY of them (a partial ARENA2 names what it lacks), or null when
 * neither holds a Daggerfall file at all (a wrong folder, not a partial one).
 */
function diagnoseArena2(dir, fsImpl = fs) {
  for (const d of [dir, findCaseInsensitive(dir, 'arena2', fsImpl)]) {
    if (!d) continue;
    const missing = missingArena2(d, fsImpl);
    if (missing && missing.length < REQUIRED_ARENA2.length) return missing;
  }
  return null;
}

const realOf = (p, fsImpl) => { try { return fsImpl.realpathSync(p); } catch { return null; } };
const isDir = (p, fsImpl) => { try { return fsImpl.statSync(p).isDirectory(); } catch { return false; } };
/** The folders directly inside `dir`: real ones, and links (a symlink, a
 *  Windows junction - libuv types every reparse point as a link) that lead
 *  to one. Never a macOS app bundle. */
function childDirs(dir, fsImpl) {
  let entries;
  try { entries = fsImpl.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter((e) => !BUNDLE_RE.test(e.name) && (e.isDirectory() || (e.isSymbolicLink() && isDir(path.join(dir, e.name), fsImpl))))
    .map((e) => path.join(dir, e.name));
}

/** A bounded breadth-first walk under `root` for a whole ARENA2 - each real
 *  folder opened once, so a link back up the tree is not a loop. */
function searchArena2(root, fsImpl = fs, depth = SEARCH_DEPTH) {
  const queue = [[root, 0]];
  const opened = new Set();
  while (queue.length && opened.size < SEARCH_DIRS_MAX) {
    const [dir, d] = queue.shift();
    const real = realOf(dir, fsImpl) ?? dir;
    if (opened.has(real)) continue;
    opened.add(real);
    const found = resolveArena2(dir, fsImpl);
    if (found) return found;
    if (d >= depth) continue;
    for (const child of childDirs(dir, fsImpl)) queue.push([child, d + 1]);
  }
  return null;
}

/** Valve's KeyValues text: every value of `key`, unescaped. Enough for
 *  libraryfolders.vdf's "path" and an appmanifest's "installdir". */
function vdfValues(text, key) {
  const re = new RegExp(`"${key}"\\s+"((?:[^"\\\\]|\\\\.)*)"`, 'gi');
  return [...String(text ?? '').matchAll(re)].map((m) => m[1].replace(/\\(.)/g, '$1'));
}

/** Daggerfall Unity's [Daggerfall] MyDaggerfallPath from a settings.ini's text. */
function dfuDaggerfallPath(text) {
  let section = '';
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.trim();
    const sec = /^\[(.+)\]$/.exec(line);
    if (sec) { section = sec[1].trim(); continue; }
    const kv = /^MyDaggerfallPath\s*=\s*(.*)$/i.exec(line);
    if (kv && section.toLowerCase() === 'daggerfall') return kv[1].trim() || null;
  }
  return null;
}

const readText = (p, fsImpl) => { try { return fsImpl.readFileSync(p, 'utf8'); } catch { return null; } };
const childDirsMatching = (dir, re, fsImpl) => childDirs(dir, fsImpl).filter((d) => re.test(path.basename(d)));

/**
 * The REG_SZ values named `value` in a .reg export's text (Windows Registry
 * Editor 5.00: `[key]` sections, `"name"="value"` lines, backslash-escaped),
 * under `key` itself - or, `recursive`, under it and every key below it.
 */
function regFileValues(text, key, value, { recursive = false } = {}) {
  const full = (k) => k.toUpperCase()
    .replace(/^HKLM\\/, 'HKEY_LOCAL_MACHINE\\').replace(/^HKCU\\/, 'HKEY_CURRENT_USER\\');
  const want = full(key);
  const out = [];
  let inKey = false;
  for (const raw of String(text ?? '').split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, '').trim();
    const sec = /^\[(.+)\]$/.exec(line);
    if (sec) {
      const k = full(sec[1]);
      inKey = k === want || (recursive && k.startsWith(`${want}\\`));
      continue;
    }
    if (!inKey) continue;
    const kv = /^"((?:[^"\\]|\\.)*)"="((?:[^"\\]|\\.)*)"$/.exec(line);
    if (kv && kv[1].replace(/\\(.)/g, '$1').toLowerCase() === value.toLowerCase()) out.push(kv[2].replace(/\\(.)/g, '$1'));
  }
  return out;
}

/** reg.exe by its own path: a bare `reg` is looked for in the CURRENT
 *  folder first (libuv's search_path), and a copy launched from Downloads
 *  would run whatever `reg.exe` sat there (lanes 1 and 4). */
const regExe = (env) => path.join(env.SystemRoot || env.windir || 'C:\\Windows', 'System32', 'reg.exe');

/** The REG_SZ values under a key, on Windows. Through `reg export`, whose
 *  file is UTF-16: `reg query` writes a pipe in the console's OEM code page,
 *  so a path with a letter outside it (a Cyrillic user folder, say) came
 *  back garbled and was never found. */
function defaultRegQuery(key, value, { recursive = false } = {}) {
  const tmp = path.join(os.tmpdir(), `dagger-reg-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.reg`);
  try {
    execFileSync(regExe(process.env), ['export', key, tmp, '/y'], { timeout: 3000, windowsHide: true, stdio: 'ignore' });
    return regFileValues(fs.readFileSync(tmp).toString('utf16le'), key, value, { recursive });
  } catch { return []; } finally {
    try { fs.unlinkSync(tmp); } catch { /* never written */ }
  }
}

/** Where Daggerfall Unity keeps settings.ini: Unity's persistentDataPath
 *  for company "Daggerfall Workshop", product "Daggerfall Unity" - and, on
 *  macOS, the bundle-id folder older Unity versions used. */
function dfuSettingsDirs({ platform, home, env }) {
  const tail = path.join('Daggerfall Workshop', 'Daggerfall Unity');
  if (platform === 'win32') return [path.join(env.USERPROFILE || home, 'AppData', 'LocalLow', tail)];
  if (platform === 'darwin') {
    const support = path.join(home, 'Library', 'Application Support');
    return [path.join(support, tail), path.join(support, 'unity.Daggerfall Workshop.Daggerfall Unity')];
  }
  return [path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'unity3d', tail)];
}

/** Every Steam install root this machine might have. */
function steamRoots({ platform, home, env }, regQuery) {
  if (platform === 'win32') {
    const reg = regQuery('HKCU\\Software\\Valve\\Steam', 'SteamPath').map((p) => path.normalize(p));
    return [...reg, ...[env['ProgramFiles(x86)'], env.ProgramFiles].filter(Boolean).map((p) => path.join(p, 'Steam'))];
  }
  if (platform === 'darwin') return [path.join(home, 'Library', 'Application Support', 'Steam')];
  return [
    path.join(home, '.steam', 'steam'),
    path.join(env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'Steam'),
    path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam'),
    path.join(home, 'snap', 'steam', 'common', '.local', 'share', 'Steam'),
  ];
}

/** Where GOG puts games, to look for a Daggerfall folder in. GOG sells
 *  Daggerfall for Windows only: a Mac has no GOG copy to find (and its
 *  /Applications holds "Daggerfall Online.app", this app - lane 4 #10). */
function gogRoots({ platform, home, env }) {
  if (platform === 'win32') {
    const pf = [env['ProgramFiles(x86)'], env.ProgramFiles].filter(Boolean);
    return [
      path.join(env.SystemDrive ? `${env.SystemDrive}\\` : 'C:\\', 'GOG Games'),
      ...pf.map((p) => path.join(p, 'GOG Galaxy', 'Games')),
      ...pf.map((p) => path.join(p, 'GOG.com')),
    ];
  }
  if (platform === 'darwin') return [];
  return [path.join(home, 'GOG Games'), path.join(home, 'Games', 'Heroic'), path.join(home, 'Games', 'gog')];
}

/** The obvious places a DaggerfallGameFiles.zip gets unpacked: the folders
 *  the shell names (app.getPath - Windows' Known Folder Move, a localized
 *  XDG Downloads), then the home's own. On macOS Downloads, Desktop and
 *  Documents are privacy-guarded - each a system prompt - so they are
 *  `guarded` and read only when nothing else was found. */
function looseRoots({ platform, home, env }, looseDirs = []) {
  const own = ['Downloads', 'Desktop', 'Documents'].map((d) => path.join(home, d));
  const named = [...looseDirs.filter((d) => typeof d === 'string' && path.isAbsolute(d)), ...own];
  const roots = [...new Set(named)].map((dir) => ({ dir, guarded: platform === 'darwin' }));
  roots.push({ dir: path.join(home, 'Games'), guarded: false });
  if (platform === 'win32') roots.push({ dir: path.join(env.SystemDrive ? `${env.SystemDrive}\\` : 'C:\\', 'Games'), guarded: false });
  return roots;
}

/**
 * Every whole ARENA2 this machine appears to have, best source first:
 * [{ dir, source: 'dfu' | 'steam' | 'gog' | 'folder' }], each folder once.
 * Never throws; an unreadable place is simply not a find. `onFound` hears
 * each find as it is made - the worker streams them, so a search the shell
 * stops at its deadline still offers what it had.
 *
 * @param {{ platform?: string, home?: string, env?: object, fs?: object, looseDirs?: string[],
 *           regQuery?: (key: string, value: string, opts?: object) => string[],
 *           onFound?: (f: { dir: string, source: string }) => void }} [opts]
 */
function detectArena2(opts = {}) {
  const platform = opts.platform ?? process.platform;
  const home = opts.home ?? os.homedir();
  const env = opts.env ?? process.env;
  const fsImpl = opts.fs ?? fs;
  const regQuery = opts.regQuery ?? (platform === 'win32' ? defaultRegQuery : () => []);
  const ctx = { platform, home, env };
  const found = [];
  const seen = new Set();
  // The REAL path: on Linux ~/.steam/steam is usually a link to ~/.local/share/Steam, and one install
  // reached down both must be offered once. Windows and macOS folders are case-insensitive.
  const real = (d) => { try { return fsImpl.realpathSync(d); } catch { return path.resolve(d); } };
  const key = (d) => (platform === 'linux' ? real(d) : real(d).toLowerCase());
  const add = (dir, source) => {
    if (!dir || seen.has(key(dir))) return;
    seen.add(key(dir));
    const f = { dir: real(dir), source };
    found.push(f);
    try { opts.onFound?.(f); } catch { /* a listener's fault is not the search's */ }
  };
  try {
    // 1. Daggerfall Unity already asked this player once.
    for (const d of dfuSettingsDirs(ctx)) {
      let names = [];
      try { names = fsImpl.readdirSync(d).filter((f) => /^settings(-.+)?\.ini$/i.test(f)); } catch { /* no DFU here */ }
      for (const f of names) {
        const p = dfuDaggerfallPath(readText(path.join(d, f), fsImpl));
        // A portable DFU stores its path relative to its own exe, which is nowhere we know.
        if (p && path.isAbsolute(p)) add(resolveArena2(p, fsImpl), 'dfu');
      }
    }
    // 2. Steam: every library, at the folder the app's manifest names.
    const libraries = [];
    for (const root of steamRoots(ctx, regQuery)) {
      const vdf = readText(path.join(root, 'steamapps', 'libraryfolders.vdf'), fsImpl)
        ?? readText(path.join(root, 'config', 'libraryfolders.vdf'), fsImpl);
      for (const lib of [root, ...vdfValues(vdf, 'path')]) if (!libraries.includes(lib)) libraries.push(lib);
    }
    for (const lib of libraries) {
      const common = path.join(lib, 'steamapps', 'common');
      const manifest = readText(path.join(lib, 'steamapps', `appmanifest_${STEAM_APP_ID}.acf`), fsImpl);
      const dirs = vdfValues(manifest, 'installdir').map((d) => path.join(common, d));
      for (const d of dirs.length ? dirs : childDirsMatching(common, DAGGERFALL_DIR_RE, fsImpl)) {
        if (isDir(d, fsImpl)) add(searchArena2(d, fsImpl), 'steam');
      }
    }
    // 3. GOG: Galaxy's registry names the folder - Daggerfall's own product key first, whatever the player
    //    called the folder (lane 4 #7), then any game whose folder is named for it; otherwise its default homes.
    const gogDirs = platform === 'win32'
      ? [
        ...regQuery(`HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games\\${GOG_PRODUCT_ID}`, 'path'),
        ...regQuery('HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games', 'path', { recursive: true }).filter((p) => DAGGERFALL_DIR_RE.test(p)),
      ]
      : [];
    for (const root of gogRoots(ctx)) gogDirs.push(...childDirsMatching(root, DAGGERFALL_DIR_RE, fsImpl));
    for (const d of gogDirs) add(searchArena2(d, fsImpl), 'gog');
    // 4. A DaggerfallGameFiles.zip unpacked somewhere obvious: into a folder named for it (Windows' "Extract
    //    All"), or straight into the root - "Extract Here" leaves a bare arena2/ beside everything else.
    const roots = looseRoots(ctx, opts.looseDirs);
    for (const { dir, guarded } of roots) {
      if (guarded && found.length) continue;
      add(resolveArena2(dir, fsImpl), 'folder');
      for (const d of childDirsMatching(dir, DAGGERFALL_DIR_RE, fsImpl)) add(searchArena2(d, fsImpl), 'folder');
    }
  } catch { /* whatever was found before the fault stands */ }
  return found;
}

module.exports = {
  REQUIRED_ARENA2, STEAM_APP_ID, GOG_PRODUCT_ID, SEARCH_DEPTH, SEARCH_DIRS_MAX,
  findCaseInsensitive, allCaseInsensitive, missingArena2, resolveArena2, diagnoseArena2, searchArena2,
  vdfValues, dfuDaggerfallPath, regFileValues, detectArena2,
};
