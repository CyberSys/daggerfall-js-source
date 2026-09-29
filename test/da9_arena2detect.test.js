// DA9 (2026-09-29, Mac: "How can we drastically improve the install
// experience? ... I really want to make it AAA grade"): THE SHELL LOOKS
// BEFORE IT ASKS (app/lib/arena2Detect.cjs), AND HOLDS EVERY FOLDER TO
// THE GAME'S OWN SEVEN FILES.
//
// The shell's ARENA2 test was ART_PAL.COL alone while the game's has been
// seven files since A2-WHOLE - so a partial folder the website refuses
// was accepted by the app, saved, and died on the first model with the
// shell never asking again. The detector reads the places a copy of
// Daggerfall is actually installed (Daggerfall Unity's settings, every
// Steam library, GOG, an unpacked DaggerfallGameFiles.zip) and offers
// only WHOLE folders. Driven here over real temp trees, one per source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { REQUIRED_ARENA2 as GAME_REQUIRED } from '../src/scenes/dataSource.js';

const require = createRequire(import.meta.url);
const {
  REQUIRED_ARENA2, STEAM_APP_ID, SEARCH_DIRS_MAX, resolveArena2, diagnoseArena2, missingArena2, searchArena2,
  vdfValues, dfuDaggerfallPath, detectArena2,
} = require('../app/lib/arena2Detect.cjs');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'da9-'));
/** A folder holding `names` (default: a whole ARENA2), in the case given. */
const arena2At = (dir, names = REQUIRED_ARENA2) => {
  fs.mkdirSync(dir, { recursive: true });
  for (const n of names) fs.writeFileSync(path.join(dir, n), 'x');
  return dir;
};
const write = (p, text) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
const noReg = () => [];

test('DA9: the shell\'s list IS the game\'s - one law for a whole ARENA2, on both sides of the bridge', () => {
  assert.deepEqual([...REQUIRED_ARENA2], [...GAME_REQUIRED], 'app/lib/arena2Detect.cjs and src/scenes/dataSource.js must name the same seven files');
  assert.equal(STEAM_APP_ID, '1812390');
  assert.match(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8'), /store\.steampowered\.com\/app\/1812390\//, 'the id the landing page links');
});

test('DA9: a folder is ARENA2 only when WHOLE - itself or its arena2/ child, any case; a partial one names what it lacks', () => {
  const root = tmp();
  try {
    const whole = arena2At(path.join(root, 'whole'));
    assert.equal(resolveArena2(whole), whole);
    // the install folder picked instead: descended, and the child's case is the disk's
    const install = path.join(root, 'install');
    const child = arena2At(path.join(install, 'Arena2'), REQUIRED_ARENA2.map((n) => n.toLowerCase()));
    assert.equal(resolveArena2(install), child, 'the parent is the honest mistake - it costs nothing');
    // A2-WHOLE's own case: a DOS install's small ARENA2 - the palettes, no BSAs
    const dos = arena2At(path.join(root, 'dos', 'ARENA2'), ['ART_PAL.COL', 'TEXT.RSC']);
    assert.equal(resolveArena2(dos), null, 'the old one-file test accepted this, and the boot died on ARCH3D.BSA');
    assert.equal(resolveArena2(path.dirname(dos)), null);
    assert.deepEqual(diagnoseArena2(path.dirname(dos)), ['ARCH3D.BSA', 'BLOCKS.BSA', 'MAPS.BSA', 'MONSTER.BSA', 'WOODS.WLD'],
      'the picker can say WHICH files are missing');
    assert.equal(diagnoseArena2(root), null, 'a folder with no Daggerfall file at all is a wrong folder, not a partial one');
    assert.equal(missingArena2(path.join(root, 'nope')), null, 'unreadable is not "missing everything"');
    assert.equal(resolveArena2(''), null);
    assert.equal(resolveArena2(undefined), null);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('DA9: Daggerfall Unity\'s settings.ini - [Daggerfall] MyDaggerfallPath, absolute paths only', () => {
  assert.equal(dfuDaggerfallPath('[Video]\nMyDaggerfallPath = C:\\nope\n[Daggerfall]\r\nMyDaggerfallPath = D:\\Games\\DF\\DAGGER\r\n'), 'D:\\Games\\DF\\DAGGER',
    'the key in its own section, not a namesake elsewhere');
  assert.equal(dfuDaggerfallPath('[Daggerfall]\nMyDaggerfallPath =\n'), null, 'unset');
  assert.equal(dfuDaggerfallPath(null), null);
  const home = tmp();
  try {
    const game = arena2At(path.join(home, 'dfdata', 'DAGGER', 'ARENA2'));
    write(path.join(home, '.config', 'unity3d', 'Daggerfall Workshop', 'Daggerfall Unity', 'settings.ini'),
      `[Daggerfall]\nMyDaggerfallPath = ${path.join(home, 'dfdata', 'DAGGER')}\n`);
    // a distribution's suffixed file, holding a PORTABLE (relative) path - unknowable, so skipped
    write(path.join(home, '.config', 'unity3d', 'Daggerfall Workshop', 'Daggerfall Unity', 'settings-dist.ini'),
      '[Daggerfall]\nMyDaggerfallPath = ..\\DF\\DAGGER\n');
    assert.deepEqual(detectArena2({ platform: 'linux', home, env: {}, regQuery: noReg }), [{ dir: fs.realpathSync(game), source: 'dfu' }]);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('DA9: Steam - every library in libraryfolders.vdf, at the installdir app 1812390\'s manifest names, ARENA2 found under it', () => {
  assert.deepEqual(vdfValues('"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"C:\\\\Program Files (x86)\\\\Steam"\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"D:\\\\SteamLibrary"\n\t}\n}', 'path'),
    ['C:\\Program Files (x86)\\Steam', 'D:\\SteamLibrary'], 'Valve escapes its backslashes');
  const home = tmp();
  try {
    const root = path.join(home, '.local', 'share', 'Steam');
    const lib2 = path.join(home, 'drive2', 'SteamLibrary');
    write(path.join(root, 'steamapps', 'libraryfolders.vdf'),
      `"libraryfolders"\n{\n\t"0"\n\t{\n\t\t"path"\t\t"${root}"\n\t}\n\t"1"\n\t{\n\t\t"path"\t\t"${lib2}"\n\t}\n}\n`);
    const manifest = '"AppState"\n{\n\t"appid"\t\t"1812390"\n\t"installdir"\t\t"The Elder Scrolls II Daggerfall"\n}\n';
    // the main library holds one copy - and ~/.steam/steam is a LINK to it, so it is reachable twice
    write(path.join(root, 'steamapps', `appmanifest_${STEAM_APP_ID}.acf`), manifest);
    const inRoot = arena2At(path.join(root, 'steamapps', 'common', 'The Elder Scrolls II Daggerfall', 'DF', 'DAGGER', 'ARENA2'));
    fs.mkdirSync(path.join(home, '.steam'), { recursive: true });
    fs.symlinkSync(root, path.join(home, '.steam', 'steam'));
    // a second library, on another drive, holds another - only libraryfolders.vdf knows it is there
    write(path.join(lib2, 'steamapps', `appmanifest_${STEAM_APP_ID}.acf`), manifest);
    const inLib2 = arena2At(path.join(lib2, 'steamapps', 'common', 'The Elder Scrolls II Daggerfall', 'DF', 'DAGGER', 'ARENA2'));
    assert.deepEqual(detectArena2({ platform: 'linux', home, env: {}, regQuery: noReg }), [
      { dir: fs.realpathSync(inRoot), source: 'steam' },
      { dir: fs.realpathSync(inLib2), source: 'steam' },
    ], 'one install reached down two paths is offered once, by its real path');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('DA9: Windows - Steam where the registry says it is, GOG where Galaxy says, each held to the whole set', () => {
  const home = tmp();
  try {
    const steam = path.join(home, 'D', 'Steam');   // not under Program Files: only the registry knows
    write(path.join(steam, 'steamapps', `appmanifest_${STEAM_APP_ID}.acf`), '"AppState" { "installdir" "The Elder Scrolls II Daggerfall" }');
    const viaSteam = arena2At(path.join(steam, 'steamapps', 'common', 'The Elder Scrolls II Daggerfall', 'DF', 'DAGGER', 'ARENA2'));
    const gog = path.join(home, 'GOG', 'Daggerfall');
    const viaGog = arena2At(path.join(gog, 'DAGGER', 'ARENA2'));
    const partialGog = path.join(home, 'GOG', 'Daggerfall Demo');
    arena2At(path.join(partialGog, 'ARENA2'), ['ART_PAL.COL']);
    // a game Galaxy lists that is NOT Daggerfall is never walked - whatever it holds
    arena2At(path.join(home, 'GOG', 'Witcher', 'data', 'ARENA2'));
    const asked = [];
    const regQuery = (key, value, opts) => {
      asked.push(`${key}|${value}|${!!opts?.recursive}`);
      if (/Valve\\Steam$/.test(key)) return [steam];
      if (/GOG\.com\\Games$/.test(key)) return [path.join(home, 'GOG', 'Witcher'), gog, partialGog];
      return [];
    };
    const env = { USERPROFILE: home, 'ProgramFiles(x86)': path.join(home, 'pf86'), ProgramFiles: path.join(home, 'pf'), SystemDrive: path.join(home, 'C') };
    assert.deepEqual(detectArena2({ platform: 'win32', home, env, regQuery }), [
      { dir: fs.realpathSync(viaSteam), source: 'steam' },
      { dir: fs.realpathSync(viaGog), source: 'gog' },
    ], 'the partial GOG folder is not offered, and a game not named for Daggerfall is never searched');
    assert.ok(asked.includes('HKCU\\Software\\Valve\\Steam|SteamPath|false'));
    assert.ok(asked.includes('HKLM\\SOFTWARE\\WOW6432Node\\GOG.com\\Games|path|true'));
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('DA9: the shell takes its ARENA2 law from the detector - one test for a whole folder, no second spelling in main.cjs', () => {
  const main = fs.readFileSync(new URL('../app/main.cjs', import.meta.url), 'utf8');
  assert.match(main, /const \{ findCaseInsensitive, resolveArena2, diagnoseArena2, detectArena2 \} = require\('\.\/lib\/arena2Detect\.cjs'\);/);
  assert.doesNotMatch(main, /function (resolveArena2|findCaseInsensitive)\(/, 'the one-file test is gone, not shadowed');
  assert.doesNotMatch(main, /'ART_PAL\.COL'/, 'no file stands in for the whole set');
  assert.match(main, /setArena2\(resolveArena2\(cfg\.arena2Path\)\);/, 'a saved folder is held to the law on every launch - a partial one is asked about again');
});

test('DA9: a DaggerfallGameFiles.zip unpacked into Downloads is found; nothing found is an empty list, never a throw', () => {
  const home = tmp();
  try {
    assert.deepEqual(detectArena2({ platform: 'darwin', home, env: {}, regQuery: noReg }), [], 'a machine without Daggerfall');
    const unpacked = arena2At(path.join(home, 'Downloads', 'DaggerfallGameFiles', 'DAGGER', 'arena2'));
    arena2At(path.join(home, 'Downloads', 'Some Other Game', 'ARENA2'));   // not named for Daggerfall: never walked
    assert.deepEqual(detectArena2({ platform: 'darwin', home, env: {}, regQuery: noReg }), [{ dir: fs.realpathSync(unpacked), source: 'folder' }]);
    // a filesystem that throws on everything is no find, not a crash
    const broken = new Proxy({}, { get: () => () => { throw new Error('EIO'); } });
    assert.deepEqual(detectArena2({ platform: 'linux', home, env: {}, fs: broken, regQuery: noReg }), []);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('DA9: the walk is bounded - a vast folder costs at most SEARCH_DIRS_MAX opens, and ARENA2 deeper than the depth is not found', () => {
  const root = tmp();
  try {
    let opens = 0;
    const counting = { ...fs, readdirSync: (...a) => { opens++; return fs.readdirSync(...a); } };
    for (let i = 0; i < 30; i++) for (let j = 0; j < 30; j++) fs.mkdirSync(path.join(root, 'vast', `d${i}`, `e${j}`), { recursive: true });
    assert.equal(searchArena2(path.join(root, 'vast'), counting), null);
    // an opened folder is read at most three times: its own names, its arena2/ probe, its children
    assert.ok(opens <= SEARCH_DIRS_MAX * 3, `bounded (${opens} reads)`);
    // the reach is SEARCH_DEPTH folders down, plus the arena2/ child of the last one opened
    const deep = arena2At(path.join(root, 'deep', 'a', 'b', 'c', 'd', 'e', 'ARENA2'));
    assert.equal(searchArena2(path.join(root, 'deep')), null, 'six levels down is past the reach');
    assert.equal(searchArena2(path.join(root, 'deep', 'a')), deep, 'five is within it - a Steam install\'s DF/DAGGER/ARENA2 is three');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
