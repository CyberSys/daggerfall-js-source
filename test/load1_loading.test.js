// LOAD1 (2026-10-05, Mac: "add loading screens where needed for the game in an enhanced UI type fashion, maybe make it
// where people can also use screenshots for the loading screen and a way to access them in the menu").
//
// Three pieces, each held here against the shape that ships:
//   THE GALLERY (systems/shotGallery.js) - the PrintScreen key's shots kept in this browser, the turn the loading
//     screens draw from, a full gallery that refuses rather than drops;
//   THE LOADING SCREEN (ui/loadingScreen.js) - holds, not a switch: the delay a short load never passes, the stand a
//     shown screen keeps, the ceiling that never traps, the frame's one question, the boot's steps;
//   THE DOORS - the key hands its PNG to the gallery, the world host's boot and frame raise the screen, and the menu's
//     Screenshots pane is on every rail and both dispatch tables.
import './chargenDom.mjs';   // the minimal DOM - for its globals
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fitWithin, pickLoadingShot, sortShots, shotCaption, keepShot, listShots, deleteShot, setShotLoading, shotCount,
  loadingShot, setGalleryBackend, setShotEncoder, memoryGalleryBackend, onGalleryChange, GALLERY_MAX, FULL_EDGE, THUMB_W,
} from '../src/systems/shotGallery.js';
import { takeScreenshot, keptLine, printScreen, setScreenshotCanvas, setShotPlace, SHOT_DOWNLOAD_PREF } from '../src/ui/screenshot.js';
import {
  beginLoading, syncLoading, withLoading, loadingShown, loadingHeld, removeLoadingScreen, setLoadingPlace, setLoadingLine,
  bootLine, loadingMode, tipAt, LOADING_TIPS, LOADING_ID, APPEAR_MS, MIN_SHOWN_MS, LOADING_FADE_MS, HOLD_MAX_MS, LOADING_Z,
} from '../src/ui/loadingScreen.js';
import { drawShotsPane, releaseShotsPane, shotKeyName } from '../src/ui/shotsPane.js';
import { setPref, getPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { FEATURES, checkFeature } from '../src/systems/features.js';
import { SYSTEM_PANES } from '../src/ui/enhancedMenu.js';
import { holdFrame, claimFrame } from '../src/scenes/shared.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const enc = async () => ({ blob: new Blob(['full']), thumb: new Blob(['thumb']), w: 1920, h: 1080 });
const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const screen = () => document.body.children.find((c) => c.id === LOADING_ID) ?? null;
const textOf = (root, cls) => root?.querySelector(`.${cls}`)?.textContent ?? null;

test('LOAD1 gallery: the kept copy fits FULL_EDGE and the thumb THUMB_W, never up; the turn is a uniform pick of the shots still in it (mutants: upscaled; a shot taken out still drawn; the last shot never picked)', () => {
  assert.deepEqual(fitWithin(3840, 2160, FULL_EDGE), { w: 1920, h: 1080 });
  assert.deepEqual(fitWithin(1080, 2340, FULL_EDGE), { w: 886, h: 1920 }, 'a phone held upright: the long edge is the height');
  assert.deepEqual(fitWithin(1280, 720, FULL_EDGE), { w: 1280, h: 720 }, 'never scaled up');
  assert.deepEqual(fitWithin(1280, 720, THUMB_W), { w: 320, h: 180 });
  assert.deepEqual(fitWithin(0, 0, THUMB_W), { w: 1, h: 1 }, 'a lost canvas still gives a whole pixel');
  const list = [{ id: 1, loading: true }, { id: 2, loading: false }, { id: 3 }];
  assert.equal(pickLoadingShot(list, () => 0).id, 1);
  assert.equal(pickLoadingShot(list, () => 0.999).id, 3, 'the last in the turn is reachable, and the shot taken out is skipped');
  assert.equal(pickLoadingShot(list, () => 0.5).id, 3);
  assert.equal(pickLoadingShot([{ id: 2, loading: false }]), null, 'nothing in the turn: the night sky');
  assert.equal(pickLoadingShot([]), null);
  assert.deepEqual(sortShots([{ id: 1, at: 5 }, { id: 2, at: 9 }, { id: 3, at: 9 }]).map((s) => s.id), [3, 2, 1], 'newest first, the later id first on a tie');
  assert.equal(shotCaption({ place: 'Daggerfall', at: new Date(2026, 9, 5, 12).getTime() }), 'Daggerfall · 5 Oct 2026');
  assert.equal(shotCaption({ place: '', at: new Date(2026, 0, 1).getTime() }), '1 Jan 2026', 'a picture brought in has no place, only its day');
});

test('LOAD1 gallery: a shot is kept with its place and in the turn; the switch takes it out; a full gallery REFUSES and keeps every shot (mutants: no cap; the oldest dropped; the switch ignored)', async () => {
  setGalleryBackend(memoryGalleryBackend());
  let heard = 0;
  const off = onGalleryChange(() => { heard++; });
  try {
    const a = await keepShot(new Blob(['png']), { place: 'Wayrest', at: 100, encode: enc });
    const b = await keepShot(new Blob(['png']), { place: 'Sentinel', at: 200, encode: enc });
    assert.ok(Number.isInteger(a) && Number.isInteger(b) && a !== b);
    const shots = await listShots();
    assert.deepEqual(shots.map((s) => [s.place, s.loading, s.w, s.h]), [['Sentinel', true, 1920, 1080], ['Wayrest', true, 1920, 1080]]);
    assert.ok(shots[0].thumb instanceof Blob && shots[0].blob instanceof Blob, 'the record carries both pictures');
    assert.equal(await setShotLoading(a, false), true);
    assert.equal((await loadingShot(() => 0.99)).id, b, 'the one taken out is never drawn');
    assert.equal(await setShotLoading(b, false), true);
    assert.equal(await loadingShot(), null);
    assert.equal(await deleteShot(a), true);
    assert.deepEqual((await listShots()).map((s) => s.id), [b]);
    assert.ok(heard >= 5, `every change is told (${heard})`);
    for (let i = await shotCount(); i < GALLERY_MAX; i++) await keepShot(new Blob(['x']), { at: i, encode: enc });
    assert.equal(await shotCount(), GALLERY_MAX);
    assert.equal(await keepShot(new Blob(['x']), { encode: enc }), 'full');
    assert.equal(await shotCount(), GALLERY_MAX, 'nothing was dropped to make room');
    assert.ok((await listShots()).some((s) => s.id === b), 'the oldest shot is still there');
    // a failure is null, never a throw: a shot that cannot be kept is still a downloaded shot
    setGalleryBackend(memoryGalleryBackend());
    assert.equal(await keepShot(new Blob(['x']), { encode: async () => { throw new Error('no 2d'); } }), null);
  } finally { off(); setGalleryBackend(null); }
});

test('LOAD1 the key: the PNG goes to the gallery AND the download, the download on its own switch, and the HUD hears the gallery\'s answer (mutants: keep never called; the download unswitchable; the full gallery silent)', async () => {
  const prevURL = globalThis.URL;
  globalThis.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
  try {
    const clicks = [];
    const doc = { createElement: () => ({ click() { clicks.push(this.download); }, remove() {} }), body: { appendChild() {} } };
    const png = { png: true };
    const kept = [];
    const said = [];
    const name = await takeScreenshot({ toBlob: (cb) => cb(png) }, { raf: null, doc, later() {}, keep: async (b) => { kept.push(b); return 7; }, said: (l) => said.push(l) });
    await flush();
    assert.match(name, /^daggerfall-\d{8}-\d{6}\.png$/);
    assert.equal(clicks.length, 1);
    assert.deepEqual(kept, [png], 'the very PNG the download saved');
    assert.deepEqual(said, ['Screenshot kept - see Screenshots in the menu.']);
    clicks.length = 0; said.length = 0;
    const none = await takeScreenshot({ toBlob: (cb) => cb(png) }, { raf: null, doc, later() {}, download: false, keep: async () => 'full', said: (l) => said.push(l) });
    await flush();
    assert.equal(none, null);
    assert.equal(clicks.length, 0, 'the download switched off saves no file');
    assert.deepEqual(said, ['The gallery is full - delete some under Screenshots.']);
    assert.equal(keptLine('full', true), 'Screenshot saved. The gallery is full - delete some under Screenshots.');
    assert.equal(keptLine(null, true), 'Screenshot saved.');
    assert.equal(keptLine(null, false), 'The screenshot could not be kept.');
  } finally { globalThis.URL = prevURL; }
  // printScreen: the place where the key was pressed, and the player's switch
  const calls = [];
  setScreenshotCanvas({}, { shoot: (c, o) => calls.push(o) });
  setShotPlace(() => 'Daggerfall');
  assert.equal(PREF_DEFAULTS[SHOT_DOWNLOAD_PREF], true, 'the download is on until the player says otherwise - KB1 as it shipped');
  try {
    assert.equal(printScreen(), true);
    assert.equal(calls[0].download, true);
    setPref(SHOT_DOWNLOAD_PREF, false);
    printScreen();
    assert.equal(calls[1].download, false);
    // the keep goes through the gallery's door with the place read AT THE PRESS, not when the gallery answers
    setGalleryBackend(memoryGalleryBackend());
    setShotEncoder(enc);
    setShotPlace(() => 'Wayrest');
    const id = await calls[1].keep(new Blob(['png']));
    assert.ok(Number.isInteger(id), `kept: ${id}`);
    assert.deepEqual((await listShots()).map((r) => r.place), ['Daggerfall']);
  } finally {
    setPref(SHOT_DOWNLOAD_PREF, true);
    setScreenshotCanvas(null);
    setShotPlace(null);
    setGalleryBackend(null);
    setShotEncoder(null);
  }
  const src = read('src/ui/screenshot.js');
  assert.match(src, /const place = placeNow\(\);[^\n]*\n\s*_shoot\(_canvas, \{ keep: \(blob\) => keepInGallery\(blob, place\), download: getPref\(SHOT_DOWNLOAD_PREF\) !== false, said: sayOnHud \}\);/,
    'the place is read at the press, the keep goes to the gallery and the download asks the switch');
  assert.doesNotMatch(src, /^import[^\n]*shotGallery/m, 'the gallery is a door, never a static import - this file is on the entry\'s graph (BOOT2)');
});

test('LOAD1 the screen: a hold shorter than its delay shows nothing; a shown screen stands MIN_SHOWN_MS and fades; nested holds keep it up; the place and the step paint (mutants: no delay; no stand; the first end takes it down)', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  try {
    removeLoadingScreen();
    const quick = beginLoading({ place: 'Daggerfall', line: 'Entering' });
    mock.timers.tick(APPEAR_MS - 1);
    assert.equal(screen(), null, 'inside the delay: nothing drawn');
    quick.end();
    mock.timers.tick(APPEAR_MS * 4);
    assert.equal(screen(), null, 'a door that cost a frame never flashed a screen');
    assert.equal(loadingHeld(), false);

    const a = beginLoading({ place: 'Daggerfall', line: 'Entering' });
    mock.timers.tick(APPEAR_MS);
    const s = screen();
    assert.ok(s, 'past the delay the screen stands');
    assert.equal(textOf(s, 'ld-place'), 'Daggerfall');
    assert.equal(textOf(s, 'ld-line'), 'Entering');
    assert.equal(s.attrs.role, 'status');
    const b = beginLoading({ delay: 0 });
    a.end();
    mock.timers.tick(MIN_SHOWN_MS * 2);
    assert.equal(screen(), s, 'a second hold keeps the same screen up');
    setLoadingPlace('Wayrest');
    setLoadingLine('Travelling');
    assert.equal(textOf(s, 'ld-place'), 'Wayrest');
    assert.equal(textOf(s, 'ld-line'), 'Travelling');
    b.end();
    b.end();   // idempotent from any door
    assert.equal(loadingHeld(), false);
    setLoadingPlace('Elsewhere');
    setLoadingLine('Something else');
    assert.deepEqual([textOf(s, 'ld-place'), textOf(s, 'ld-line')], ['Wayrest', 'Travelling'], 'a word with no hold open never paints the screen standing out its last moment');
    assert.equal(loadingShown(), true, 'still standing through its fade');
    mock.timers.tick(0);   // the stand already served: the fade begins
    assert.equal(loadingShown(), false, 'the slot is empty before the screen is told (THE SLOT IS EMPTIED...)');
    assert.ok(screen(), '...and the screen fades out in place');
    mock.timers.tick(LOADING_FADE_MS);
    assert.equal(screen(), null, 'gone once the fade ran');
    setLoadingPlace('Stale');
    const c = beginLoading({ delay: 0 });
    assert.equal(textOf(screen(), 'ld-place'), '', 'a word set between loads never stands on the next one');
    c.end();
    mock.timers.tick(MIN_SHOWN_MS);
    mock.timers.tick(LOADING_FADE_MS);
    assert.equal(screen(), null);

    // the stand: a load that ends a moment after its screen appears does not blink
    const d = beginLoading({ delay: 0 });
    mock.timers.tick(10);
    d.end();
    mock.timers.tick(MIN_SHOWN_MS - 20);
    assert.equal(loadingShown(), true, 'it stands its MIN_SHOWN_MS');
    mock.timers.tick(10);
    assert.equal(loadingShown(), false, 'and not a moment more');
    mock.timers.tick(LOADING_FADE_MS);
    assert.equal(screen(), null);
  } finally { removeLoadingScreen(); mock.timers.reset(); }
});

test('LOAD1 the screen: NEVER TRAPS - a hold whose load threw past its end lets go at its ceiling, and withLoading ends however the load ends (mutants: no ceiling; no finally)', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const warn = mock.method(console, 'warn', () => {});
  try {
    removeLoadingScreen();
    beginLoading({ delay: 0, why: 'a test load' });
    assert.ok(screen());
    mock.timers.tick(HOLD_MAX_MS - 1);
    assert.equal(loadingHeld(), true, 'held up to its ceiling');
    mock.timers.tick(1);
    assert.equal(loadingHeld(), false, 'the ceiling ended the hold');
    mock.timers.tick(0);
    mock.timers.tick(LOADING_FADE_MS);
    assert.equal(screen(), null, 'and the screen went with it');
    assert.match(String(warn.mock.calls[0]?.arguments[0]), /a test load held the loading screen past/);
  } finally { warn.mock.restore(); removeLoadingScreen(); mock.timers.reset(); }
  await assert.rejects(withLoading({ delay: 0 }, async () => { throw new Error('the build threw'); }), /the build threw/);
  assert.equal(loadingHeld(), false, 'the throw ended its hold');
  assert.equal(await withLoading({ delay: 0 }, async (h) => { assert.equal(h.open, true); return 5; }), 5);
  assert.equal(loadingHeld(), false);
  removeLoadingScreen();
});

test('LOAD1 the frame\'s question: a move raises one hold, its place and step asked every frame; the still frame ends it; a ceiling\'s let-go is not raised again for the same stuck move (mutants: a hold per frame; never ended; re-raised)', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const warn = mock.method(console, 'warn', () => {});
  try {
    removeLoadingScreen();
    let place = '';
    const ask = { place: () => place, line: () => 'Travelling', delay: 0 };
    syncLoading(true, ask);
    syncLoading(true, ask);
    assert.ok(screen());
    assert.equal(textOf(screen(), 'ld-place'), '', 'the destination is not known yet');
    place = 'Sentinel';
    syncLoading(true, ask);
    assert.equal(textOf(screen(), 'ld-place'), 'Sentinel', 'the teleport began: its place is said');
    syncLoading(false, ask);
    assert.equal(loadingHeld(), false, 'one hold, ended by the first still frame');
    mock.timers.tick(MIN_SHOWN_MS);
    mock.timers.tick(LOADING_FADE_MS);
    assert.equal(screen(), null);
    syncLoading(true, ask);
    mock.timers.tick(HOLD_MAX_MS);
    mock.timers.tick(0);
    mock.timers.tick(LOADING_FADE_MS);
    assert.equal(screen(), null, 'the stuck move\'s screen let go at the ceiling');
    syncLoading(true, ask);
    mock.timers.tick(MIN_SHOWN_MS);
    assert.equal(screen(), null, '...and is not raised again while the same move stays stuck');
    syncLoading(false, ask);
    syncLoading(true, ask);
    assert.ok(screen(), 'the next move raises its own');
  } finally { warn.mock.restore(); removeLoadingScreen(); mock.timers.reset(); }
});

test('LOAD1 the switch: the Features row is the one declaration - Your screenshots by default, Night sky, Off; the classic skin and the probes\' ?shot draw none; the boot\'s steps read as words (mutants: the row unsound; classic drawn; ?shot drawn)', () => {
  const row = FEATURES.find((f) => f.id === 'loading-screen');
  assert.ok(row);
  assert.deepEqual(checkFeature(row), []);
  assert.deepEqual([row.group, row.kinds, row.control.store, row.control.key, row.control.initial, row.control.online], ['interface', ['enhanced'], 'prefs', 'loadingScreen', 'shots', 'player']);
  assert.deepEqual(row.control.tiers.map(([v]) => v), ['shots', 'art', 'off']);
  assert.equal(PREF_DEFAULTS.loadingScreen, 'shots', 'RF4: the shelf takes its default from the row');
  assert.equal(loadingMode(''), 'shots');
  assert.equal(loadingMode('?skin=classic'), 'off', 'the classic UI keeps Daggerfall\'s loads');
  assert.equal(loadingMode('?shot'), 'off');
  assert.equal(loadingMode('?noloading'), 'off');
  setPref('loadingScreen', 'art');
  try {
    assert.equal(loadingMode(''), 'art');
    setPref('loadingScreen', 'off');
    assert.equal(loadingMode(''), 'off');
    const h = beginLoading({ delay: 0 });
    assert.equal(h.open, false, 'off: a hold is born closed');
    assert.equal(screen(), null);
  } finally { setPref('loadingScreen', 'shots'); removeLoadingScreen(); }
  assert.equal(getPref('loadingScreen'), 'shots');
  assert.equal(bootLine('loading data'), 'Reading the game data');
  assert.equal(bootLine('building player pixel 207,213'), 'Raising the land');
  assert.equal(bootLine('streaming world - Daggerfall'), 'Raising the land');
  assert.equal(bootLine('loading the saved game'), 'Loading the saved game');
  assert.equal(bootLine(''), 'Loading');
  assert.equal(LOADING_Z, 19, 'over the death screen (18), under the crash banner (20)');
  assert.ok(LOADING_TIPS.length >= 2 && tipAt(0) !== tipAt(60_000), 'a minute later, another tip');
  for (const t of LOADING_TIPS) assert.doesNotMatch(t, /\b(F\d+|Enter|Escape|Space|key [A-Z])\b/, `a tip names no key - keys are rebound: ${t}`);
});

test('LOAD1 the screen stands on a shot from the turn, with its caption; with none in it, on the night sky and a tip (mutants: the shot never asked; the caption lost)', async () => {
  setGalleryBackend(memoryGalleryBackend());
  try {
    removeLoadingScreen();
    let h = beginLoading({ delay: 0, place: 'Daggerfall' });
    await flush();
    assert.ok(screen().querySelector('.ld-tip'), 'an empty gallery: the tip in the corner');
    assert.ok(screen().querySelector('.px-ground'), 'and the menu\'s night ground under it');
    h.end();
    removeLoadingScreen();
    await keepShot(new Blob(['png']), { place: 'Privateer’s Hold', at: new Date(2026, 9, 4, 9).getTime(), encode: enc });
    h = beginLoading({ delay: 0, place: 'Daggerfall' });
    await flush();
    const s = screen();
    assert.equal(textOf(s, 'ld-cap'), 'Privateer’s Hold · 4 Oct 2026');
    assert.match(String(s.querySelector('.ld-shot').src), /^blob:/, 'the shot is the picture');
    h.end();
  } finally { removeLoadingScreen(); setGalleryBackend(null); }
});

test('LOAD1 the hosts: the boot raises the screen at once and its title steps are its line, ended at status(null); the world frame asks AUDIT 68 S22\'s one question and a door\'s build; a claimed loop lets go; a film takes the screen aside (mutants: the frame sync gone; the boot hold never ended; the claimed loop keeps the screen)', () => {
  const w = read('src/scenes/world.js');
  const boot = w.slice(w.indexOf('export async function bootWorld('));
  const head = boot.slice(0, boot.indexOf('const realmNew = '));
  assert.match(head, /const bootLoading = beginLoading\(\{ delay: 0, [^}]*why: 'the boot' \}\);/, 'before the realm\'s join - the first await');
  assert.match(head, /status = \(msg\) => \{ if \(msg == null\) bootLoading\.end\(\); else bootLoading\.line\(bootLine\(msg\)\); titleStatus\(msg\); \};/);
  assert.ok(boot.indexOf('status(null);   // FB0930-TITLE') > 0, 'the boot\'s end is the hold\'s end');
  const frame = boot.slice(boot.indexOf('  function frame(now) {'));
  assert.match(read('src/scenes/shared.js'), /export function claimFrame\(\) \{ syncLoading\(false\); return \+\+_frameGeneration; \}/, 'a claimed loop lets its hold go - no frame of it will end it');
  assert.match(frame, /const _moving = worldMoveBusy\(\) \|\| !!modes\?\.transitioning;\n\s*syncLoading\(_moving, \{ place: loadingPlaceNow, line: loadingLineNow \}\);\n\s*if \(!_moving\) _loadingDest = null;/);
  const at = frame.indexOf('syncLoading(_moving');
  assert.ok(at > frame.indexOf('if (frameHeld())') && at > frame.indexOf('else lookFilter.tick(dt, cam);'), 'below the film\'s wait and the look\'s tick, whose heads AUDIT 39 #160 and AUDIT 28 W7 keep');
  assert.ok(at < frame.indexOf('capturePendingScreenshot(canvas);   // SS1: a save armed from a modal mode'), '...and above the indoor mode\'s return, so every drawn frame asks');
  const sh = read('src/scenes/shared.js');
  assert.match(sh, /_frameHold\+\+;\n\s*stepAsideLoading\(true\);/, 'a film\'s hold takes the screen aside...');
  assert.match(sh, /_frameHold = Math\.max\(0, _frameHold - 1\); if \(!_frameHold\) stepAsideLoading\(false\);/, '...and the last release brings it back');
  assert.match(w, /function worldMoveBusy\(\) \{[\s\S]{0,400}return _seasonStraightening \|\| _traveling \|\| _teleporting \|\| _recalling \|\| _respawning \|\| _loading \|\| !!ohAbyss\?\.entering;/, 'the one question still asks every mover');
  const core = w.slice(w.indexOf('  async function _teleportToPixel('));
  assert.match(core.slice(0, core.indexOf('    const first = queue.shift();') + 40), /_loadingDest = \{ x: px, y: py \}; setLoadingPlace\(placeAtPixel\(px, py\)\);[^\n]*\n\s*const first = queue\.shift\(\);/, 'the core names its destination before its first await');
  assert.equal((core.slice(0, core.indexOf('    const first = queue.shift();')).match(/\bawait\b/g) ?? []).length, 0, 'no await stands above it');
  assert.match(w, /setShotPlace\(placeHere\);/);
});

test('LOAD1 a film and a claimed loop: a video\'s frame hold takes the standing screen aside and the last release brings it back; a loop claimed by another lets the frame\'s hold go (mutants: the film hidden under the screen; aside for ever; the claimed loop\'s screen kept)', () => {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  try {
    removeLoadingScreen();
    syncLoading(true, { delay: 0 });
    const s = screen();
    const cls = new Set(String(s.className).split(/\s+/));
    Object.defineProperty(s, 'classList', { value: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) } });
    const a = holdFrame();
    const b = holdFrame();
    assert.ok(cls.has('aside'), 'the film owns the canvas: the screen steps aside');
    a();
    assert.ok(cls.has('aside'), 'still aside while any hold stands');
    b();
    b();   // a release is once, however many paths call it
    assert.ok(!cls.has('aside'), 'the last release brings it back');
    assert.equal(loadingHeld(), true, 'its hold untouched throughout');
    claimFrame();
    assert.equal(loadingHeld(), false, 'a claimed loop lets the frame\'s hold go');
  } finally { removeLoadingScreen(); mock.timers.reset(); }
});

test('LOAD1 the menu: Screenshots is on every rail, the System page and both dispatch tables; the door\'s foot carries it beside About; the unmount lets its pictures go (mutants: a rail without it; a dead dispatch; no release)', () => {
  const menu = read('src/ui/enhancedMenu.js');
  for (const rail of ['SECTIONS_BOOT', 'SECTIONS_CLASSIC', 'SECTIONS_PAUSE']) {
    const list = new RegExp(`const ${rail} = \\[([^\\]]*)\\]`).exec(menu)[1];
    assert.match(list, /'Screenshots', 'About'/, `${rail} carries it, before About`);
  }
  assert.ok(SYSTEM_PANES.some(([id, label]) => id === 'screenshots' && label === 'Screenshots'));
  assert.equal((menu.match(/screenshots: drawShotsPane,/g) ?? []).length, 2, 'both dispatch tables');
  assert.match(menu, /if \(label === 'About' \|\| label === 'Screenshots'\) continue;/, 'the door\'s list leaves it to the foot');
  assert.match(menu, /const shots = el\('button', 'px-about px-shots', 'Screenshots'\);\n\s*shots\.onclick = \(\) => go\('screenshots'\);/);
  assert.match(menu, /stopTimers\(\);   \/\/ TIMERS1\n\s*releaseShotsPane\(\);/);
});

test('LOAD1 the pane: it fills when the gallery answers - each shot\'s caption, its switch, Save, and a Delete that asks once; an empty gallery says how to take one (mutants: the switch writes nothing; Delete deletes on the first press)', async () => {
  setGalleryBackend(memoryGalleryBackend());
  try {
    const body = document.createElement('div');
    document.body.append(body);
    drawShotsPane(body);
    await flush();
    assert.ok(body.querySelector('.empty'), 'nothing kept: the empty card');
    assert.match(body.textContent, /Press F8 anywhere in the world/, 'naming the player\'s own key');
    assert.equal(shotKeyName(), 'F8');
    const id = await keepShot(new Blob(['png']), { place: 'Daggerfall', at: new Date(2026, 9, 5).getTime(), encode: enc });
    await flush();
    const tiles = body.querySelectorAll('.shot-tile');
    assert.equal(tiles.length, 1, 'the change refilled the pane');
    assert.equal(textOf(tiles[0], 'shot-cap'), 'Daggerfall · 5 Oct 2026');
    const turn = tiles[0].querySelector('.shot-turn');
    assert.equal(turn.textContent, 'On loading screens');
    turn.click();
    await flush();
    assert.equal((await listShots())[0].loading, false, 'the switch wrote the gallery');
    assert.equal(body.querySelector('.shot-turn').textContent, 'Not on loading screens');
    const del = () => body.querySelector('.shot-tile').querySelectorAll('.act').find((b) => /^Delete/.test(b.textContent));
    del().click();
    await flush();
    assert.equal(await shotCount(), 1, 'the first press only asks');
    assert.equal(del().textContent, 'Delete it?');
    del().click();
    await flush();
    assert.equal(await shotCount(), 0);
    assert.equal((await listShots()).some((s) => s.id === id), false);
    body.remove();
  } finally { releaseShotsPane(); setGalleryBackend(null); }
});

test('LOAD1 the doctrine: the gallery touches no network and no repository path - a render of game data stays in the player\'s own browser (mutants: a fetch; an upload)', () => {
  const g = read('src/systems/shotGallery.js');
  assert.doesNotMatch(g, /\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//, 'nothing leaves the browser');
  assert.match(g, /indexedDB/);
  const pane = read('src/ui/shotsPane.js');
  assert.doesNotMatch(pane, /\bfetch\(|XMLHttpRequest|sendBeacon/);
});
