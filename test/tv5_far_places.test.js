// TV5 (2026-09-28, bible/06-Systems/Travel-View.md, Mac choosing between the horizon's town shapes and these: "Edge
// markers") and PERF-TV (Mac: "I also want to ensure performance is golden").
//
// TV5: the discovered settlements past the streamed grid, the nearest within reach, held at the view's edge with their
// distance - a click a journey there by the roads (systems/travelFarPlaces.js, scenes/world.js). PERF-TV: the readout's
// marks are DRAWN on one canvas (ui/travelViewHud.js), a click on a plate found by where it landed, the screen's size
// read once a frame, and a picture that did not change never drawn again; the world host keeps the marks' scene
// points, the route's far legs and the cap's count between the ground's changes. The browser's own measure is
// tools/travelViewPerf.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TV_FAR_RANGE, TV_FAR_MAX, TV_FAR_TYPES, PIXEL_KM, farDistanceText, settlementPixels, farPlaces,
} from '../src/systems/travelFarPlaces.js';
import { LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { curtainsOf, CURTAINS_MAX, CURTAIN_FOOT_SAMPLES, CURTAIN_MEMO_M } from '../src/render/rainCurtains.js';
import { cellOf } from '../src/render/volumetricClouds.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── TV5: THE FAR PLACES ─────────────────────────────────────────────────────────────────────────────────────────────

test('TV5 law: the settlements are DFU\'s town trio - a city, a town, a village; a pixel is 0.8192 km; distances in tenths under ten kilometres, whole ones past', () => {
  assert.deepEqual([...TV_FAR_TYPES].sort(), [LOCATION_TYPES.TownCity, LOCATION_TYPES.TownHamlet, LOCATION_TYPES.TownVillage].sort());
  assert.equal(PIXEL_KM, 0.8192);
  assert.deepEqual([TV_FAR_RANGE, TV_FAR_MAX], [24, 10]);
  assert.equal(farDistanceText(6.44), '6.4 km');
  assert.equal(farDistanceText(9.96), '10.0 km');
  assert.equal(farDistanceText(12.6), '13 km');
  assert.equal(farDistanceText(-1), '');
  assert.equal(farDistanceText(NaN), '');
  const index = new Map([
    ['10,20', { name: 'Ripwych', mapTableData: { locationType: LOCATION_TYPES.TownHamlet } }],
    ['11,20', { name: 'Old Keep', mapTableData: { locationType: LOCATION_TYPES.DungeonKeep } }],
    ['12,20', { name: 'Chapel', mapTableData: { locationType: LOCATION_TYPES.ReligionTemple } }],
    ['13,20', { name: 'Daggerfall', mapTableData: { locationType: LOCATION_TYPES.TownCity } }],
    ['14,20', { name: '', mapTableData: { locationType: LOCATION_TYPES.TownVillage } }],
  ]);
  assert.deepEqual(settlementPixels(index).map((s) => [s.x, s.y, s.loc.name]), [[10, 20, 'Ripwych'], [13, 20, 'Daggerfall']], 'a dungeon, a temple and a nameless row are not destinations the edge speaks for');
});

test('TV5 law: the far places start where the grid ends and stop at the range, discovered only, the nearest first and at most TV_FAR_MAX', () => {
  const at = { x: 500, y: 250 };
  const settlements = [];
  for (let d = 1; d <= 30; d++) settlements.push({ x: 500 + d, y: 250 }, { x: 500, y: 250 - d });
  const discovered = (x, y) => (y === 250 && x % 2 === 1 ? null : { mapId: x * 1000 + y, name: `P${x},${y}` });   // every other place east unfound
  const list = farPlaces({ at, near: 3, settlements, summaryOf: discovered });
  assert.equal(list.length, TV_FAR_MAX);
  assert.ok(list.every((f) => Math.max(Math.abs(f.x - at.x), Math.abs(f.y - at.y)) > 3), 'the grid\'s own places wear plates on the land');
  assert.ok(list.every((f) => f.summary), 'discovered only - DFU\'s own law');
  assert.ok(list.every((f, i) => i === 0 || list[i - 1].d <= f.d), 'nearest first');
  assert.equal(list[0].d, 4, 'the first past the grid');
  assert.match(list[0].key, /^far:\d+$/);
  const all = farPlaces({ at, near: 3, settlements, summaryOf: discovered, max: 100 });
  assert.ok(all.every((f) => Math.max(Math.abs(f.x - at.x), Math.abs(f.y - at.y)) <= TV_FAR_RANGE), `none past ${TV_FAR_RANGE} pixels`);
  assert.ok(!all.some((f) => f.y === 250 && f.x % 2 === 1), 'an undiscovered place is never marked');
});

test('TV5 host wiring: the far places are rebuilt on a pixel (or a reach) change from the world\'s settlements gathered once; each a pickable plate held at the edge, its distance under its name; a click on one is the same journey as a place\'s; a load forgets them', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /let tvFar = \{ at: null, near: -1, list: \[\] \};/);
  assert.ok(w.indexOf('let tvFar = { at: null, near: -1, list: [] };') < w.indexOf('tvFar = { at: null, near: -1, list: [] };   // TV5: nor the far places'), 'BOOT-TDZ: declared above the load that clears it');
  assert.match(w, /if \(tvFar\.at && tvFar\.at\.x === at\.x && tvFar\.at\.y === at\.y && tvFar\.near === near\) return tvFar\.list;/);
  assert.match(w, /farPlaces\(\{ at, near, settlements: \(_tvSettlements \?\?= settlementPixels\(locationIndex\)\), summaryOf: tvPlaceSummary \}\)/);
  assert.match(w, /marks\.push\(\{ key: f\.key, at: tvSceneKept\(f, f\.x, f\.z, TV_PLACE_LIFT\), label: f\.summary\.name, sub: farDistanceText\(km\), kind: 'far', pick: true, edge: true \}\);/);
  assert.match(w, /const farEnd = endKey \? `far:\$\{tvTrip\.plan\.summary\.mapId\}` : null;/, 'the journey\'s own end is the flag\'s, not a plate at the edge');
  assert.match(w, /for \(const f of travelViewFarPlaces\(\)\) \{\n\s*if \(f\.key === farEnd\) continue;/);
  assert.match(w, /const plate = tvPlates\.list\.find\(\(p\) => p\.key === key\) \?\? tvFar\.list\.find\(\(p\) => p\.key === key\);/);
  assert.match(w, /tvFar = \{ at: null, near: -1, list: \[\] \};   \/\/ TV5: nor the far places\n\s*travelView\?\.exit\('load', true\);/);
});

// ── PERF-TV: THE READOUT, DRAWN ─────────────────────────────────────────────────────────────────────────────────────

/** A document just real enough for the readout: elements, a canvas whose 2D context records what it is told, and a
 *  window whose size is COUNTED when read (a read after a write is a forced layout in a browser). */
function fakeDoc() {
  const calls = [];
  const ctx = new Proxy({ calls }, {
    get: (t, k) => (k in t ? t[k] : k === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : (...a) => { calls.push(k); }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const reads = { n: 0 };
  const win = { devicePixelRatio: 1, addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(win, 'innerWidth', { get() { reads.n++; return 1280; } });
  Object.defineProperty(win, 'innerHeight', { get() { reads.n++; return 720; } });
  const doc = { defaultView: win, fonts: null };
  const mk = (tag) => {
    const n = {
      tagName: tag.toUpperCase(), className: '', textContent: '', id: '', children: [], style: { setProperty() {} }, ownerDocument: doc,
      attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      append(...c) { this.children.push(...c); }, remove() {}, addEventListener() {}, isConnected: true,
      width: 0, height: 0,
    };
    if (tag === 'canvas') n.getContext = () => ctx;
    return n;
  };
  Object.assign(doc, {
    createElement: mk, createElementNS: (_, tag) => mk(tag), getElementById: () => null,
    head: mk('head'), body: mk('body'),
  });
  return { doc, win, calls, reads };
}

test('PERF-TV readout: every mark on the one canvas; the screen read ONCE a frame however many marks are held at its edge; a picture that did not change is not drawn again; a moved one is', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { doc, calls, reads } = fakeDoc();
  hud.showTravelViewHud({}, doc);
  try {
    const marks = [];
    for (let i = 0; i < 40; i++) marks.push({ key: `trav:${i}`, x: 3000 + i, y: 100, front: false, label: `Rider ${i}`, kind: 'traveller', edge: true });   // all held at the edge
    marks.push({ key: 'place:1', x: 600, y: 300, front: true, label: 'Ripwych', kind: 'place', pick: true });
    const frame = { feet: { x: 640, y: 360, front: true }, heading: 0, yaw: 0, where: 'w', marks };
    reads.n = 0;
    hud.updateTravelViewHud(frame);
    assert.ok(reads.n <= 4, `the screen read once for the marks, not once a mark (${reads.n} reads for 41 marks)`);
    const drew = calls.filter((c) => c === 'drawImage').length;
    assert.ok(drew >= 41, `every label drawn (${drew})`);
    assert.deepEqual(hud.travelViewHudState().marks.length, 41);
    calls.length = 0;
    hud.updateTravelViewHud(frame);
    assert.equal(calls.filter((c) => c === 'clearRect' || c === 'drawImage').length, 0, 'at rest: the canvas already shows it');
    hud.updateTravelViewHud({ ...frame, marks: marks.map((m, i) => (i === 40 ? { ...m, x: m.x + 3 } : m)) });
    assert.ok(calls.includes('clearRect') && calls.includes('drawImage'), 'a plate moved: drawn again');
  } finally { hud.disposeTravelViewHud(); }
});

test('PERF-TV readout: a click on a drawn plate is found where it landed (the one on top); beside it, and on a mark that takes none, nothing; hidden, nothing', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { doc } = fakeDoc();
  hud.showTravelViewHud({}, doc);
  try {
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [
      { key: 'place:1', x: 600, y: 300, front: true, label: 'Ripwych', kind: 'place', pick: true },
      { key: 'trav:a', x: 900, y: 300, front: true, label: 'Rider', kind: 'traveller' },
      { key: 'far:9', x: 5000, y: 300, front: true, label: 'Daggerfall', sub: '12 km', kind: 'far', pick: true, edge: true },
    ] });
    const hits = hud.travelViewHudState().hits;
    assert.deepEqual(hits.map((h) => h.key), ['place:1', 'far:9'], 'the pickable ones, and only they');
    assert.equal(hud.travelViewHudPickAt(600, 290), 'place:1', 'on the plate over the town');
    assert.equal(hud.travelViewHudPickAt(600, 340), null, 'well below it: the ground');
    assert.equal(hud.travelViewHudPickAt(900, 305), null, 'a traveller takes no click');
    const far = hits.find((h) => h.key === 'far:9');
    assert.ok(far.x1 <= 1280 && far.x0 > 1000, `the far place held at the right edge, its plate kept on the screen (${far.x0}..${far.x1})`);
    assert.equal(hud.travelViewHudPickAt((far.x0 + far.x1) / 2, (far.y0 + far.y1) / 2), 'far:9');
    hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks: [
      { key: 'place:1', x: 600, y: 300, front: true, label: 'Ripwych', kind: 'place', pick: true },
      { key: 'place:2', x: 610, y: 302, front: true, label: 'Ripwych Hollow', kind: 'place', pick: true },
    ] });
    assert.equal(hud.travelViewHudPickAt(605, 290), 'place:2', 'two plates overlapping: the one drawn on top takes it');
    hud.hideTravelViewHud();
    assert.equal(hud.travelViewHudPickAt(600, 290), null, 'hidden: nothing takes a click');
  } finally { hud.disposeTravelViewHud(); }
});

test('PERF-TV by source: the view asks the readout before it picks; the host keeps scene points, the route\'s far legs and the cap\'s count between the ground\'s changes', () => {
  const v = rd('src/scenes/travelView.js');
  assert.match(v, /const key = deps\.hud\?\.pickAt\?\.\(e\.clientX, e\.clientY\) \?\? null;\n\s*if \(key\) deps\.onMark\?\.\(key\); else deps\.onPick\?\.\(e\.clientX, e\.clientY, e\);/);
  const w = rd('src/scenes/world.js');
  assert.match(w, /hud: \{ show: showTravelViewHud, hide: hideTravelViewHud, update: updateTravelViewHud, pickAt: travelViewHudPickAt \},/);
  assert.match(w, /if \(k\[0\] !== built\.size \|\| k\[1\] !== state\.mapOrigin\.x \|\| k\[2\] !== state\.mapOrigin\.y \|\| k\[3\] !== c\[0\] \|\| k\[4\] !== c\[1\] \|\| k\[5\] !== c\[2\] \|\| t - k\[6\] > 500\) \{/, 'the ground moves on a build, a drop, a re-anchor - and every half second besides');
  assert.match(w, /if \(holder\._tvGen !== gen \|\| holder\._tvNx !== nx \|\| holder\._tvNz !== nz\) \{/);
  for (const re of [/at: tvSceneKept\(p, p\.x, p\.z, TV_PLACE_LIFT\)/, /at: tvSceneKept\(tvTrip\.end, tvTrip\.end\.x, tvTrip\.end\.z,/, /at: tvSceneKept\(t, w\.x, w\.z, 2\)/]) assert.match(w, re);
  const h = rd('src/ui/travelViewHud.js');
  assert.match(h, /const vw = win\?\.innerWidth \?\? 0, vh = win\?\.innerHeight \?\? 0, dpr = win\?\.devicePixelRatio \|\| 1;   \/\/ read ONCE, before any write/);
  assert.match(h, /if \(sig\.length === canvasSig\.length && sig\.every\(\(v, i\) => v === canvasSig\[i\]\)\) return;/);
  assert.match(h, /doc\.fonts\?\.addEventListener\?\.\('loadingdone', \(\) => \{ sprites\.clear\(\); canvasSig = \[\]; \}\);/, 'a label drawn before the plates\' face arrived is drawn again');
});

test('PERF-TV curtains: the lowest land asked only under the veils kept (CURTAINS_MAX of many), and a host\'s memo keeps it while a veil drifts within CURTAIN_MEMO_M - the same veils, not one sample more', () => {
  let asked = 0;
  const groundAt = (x, z) => { asked += 1; return 100 - Math.abs(Math.sin(x * 0.001 + z * 0.002)) * 40; };
  const cells = Array.from({ length: 24 }, (_, i) => cellOf('rain', CURTAIN_MEMO_M * (25 + i * 5), CURTAIN_MEMO_M * (19 + (i % 5) * 6), 600));   // on the memo's own steps
  const at = { focus: [0, 101.7, 0], eye: [0, 400, -300], ground: 100, groundAt };
  const bare = curtainsOf(cells, at);
  assert.equal(bare.length, CURTAINS_MAX, 'more cells than slots');
  const each = 1 + 2 * CURTAIN_FOOT_SAMPLES;
  assert.equal(asked, CURTAINS_MAX * each, 'a veil not kept asks the land nothing');
  const memo = new Map();
  asked = 0;
  assert.deepEqual(curtainsOf(cells, { ...at, memo }), bare, 'the memo changes no veil');
  assert.equal(asked, CURTAINS_MAX * each);
  asked = 0;
  const drift = CURTAIN_MEMO_M * 0.2;
  const moved = cells.map((c) => ({ ...c, x: c.x + drift }));
  const again = curtainsOf(moved, { ...at, memo });
  assert.equal(asked, 0, 'drifted within the memo\'s step, the land is not asked again');
  assert.equal(again.length, CURTAINS_MAX);
  asked = 0;
  curtainsOf(cells.map((c) => ({ ...c, x: c.x + CURTAIN_MEMO_M * 3 })), { ...at, memo });
  assert.equal(asked, CURTAINS_MAX * each, 'drifted a veil\'s step and more, asked afresh');
});

test('EDGE-DECLUTTER: marks held at one edge in much the same direction slide apart - down a side, along the top - in their own order, each still taking its own click; a rider parts a town\'s plate too; an edge too crowded spaces them evenly on the screen', async () => {
  const hud = await import('../src/ui/travelViewHud.js');
  const { doc } = fakeDoc();   // 1280 x 720
  hud.showTravelViewHud({}, doc);
  const far = (key, x, y, extra = {}) => ({ key, x, y, front: true, label: key, sub: '12 km', kind: 'far', pick: true, edge: true, ...extra });
  const frame = (marks) => { hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks }); return hud.travelViewHudState().hits; };
  const apart = (a, b, lo, hi) => a[hi] <= b[lo] || b[hi] <= a[lo];
  try {
    // two towns off the right edge, ten pixels apart in the projection - held a pixel apart; listed lower first
    let hits = frame([far('far:low', 5000, 310), far('far:high', 5000, 300)]);
    let [hi, lo] = ['far:high', 'far:low'].map((k) => hits.find((h) => h.key === k));
    assert.ok(apart(hi, lo, 'y0', 'y1'), `their boxes part (${hi.y0}..${hi.y1} / ${lo.y0}..${lo.y1})`);
    assert.ok(hi.y0 < lo.y0, 'the one higher in the world stays the higher');
    assert.ok(hi.y0 + 24 < 352 && lo.y0 + 24 > 353, `the pair centred on where they would stand (352, 353): ${hi.y0 + 24}, ${lo.y0 + 24}`);
    assert.ok(hi.x1 <= 1280 && lo.x1 <= 1280, 'both on the screen');
    assert.equal(hud.travelViewHudPickAt((lo.x0 + lo.x1) / 2, (lo.y0 + lo.y1) / 2), 'far:low');
    assert.equal(hud.travelViewHudPickAt((hi.x0 + hi.x1) / 2, (hi.y0 + hi.y1) / 2), 'far:high');
    // along the top: they part sideways, not down
    hits = frame([far('far:b', 620, -5000), far('far:a', 600, -5000)]);
    const [a, b] = ['far:a', 'far:b'].map((k) => hits.find((h) => h.key === k));
    assert.ok(apart(a, b, 'x0', 'x1'), `side by side (${a.x0}..${a.x1} / ${b.x0}..${b.x1})`);
    assert.ok(a.x0 < b.x0, 'in their own order');
    assert.equal(a.y0, b.y0, 'both on the top edge');
    // a rider (no click of its own) held where a town is: the town's plate is moved off the rider's label
    const alone = frame([far('far:t', 5000, 310)])[0];
    hits = frame([{ key: 'trav:r', x: 5000, y: 300, front: true, label: 'Rider', kind: 'traveller', edge: true }, far('far:t', 5000, 310)]);
    const t = hits.find((h) => h.key === 'far:t');
    assert.ok(t.y0 >= alone.y0 + 20, `the town moved down off the rider's label (${alone.y0} alone, ${t.y0} beside it)`);
    // twenty in one direction: more than the side holds - spaced evenly down it, in order, none off the screen
    hits = frame(Array.from({ length: 20 }, (_, i) => far(`far:${String(i).padStart(2, '0')}`, 5000, 300 + i * 0.1)));
    const mids = hits.map((h) => (h.y0 + h.y1) / 2);
    assert.equal(hits.length, 20);
    for (let i = 1; i < 20; i++) assert.ok(mids[i] > mids[i - 1], `in order down the edge (${mids[i - 1]} < ${mids[i]})`);
    assert.ok(hits[0].y0 >= 0 && hits[19].y0 < 720, `on the screen (${hits[0].y0} .. ${hits[19].y0})`);
  } finally { hud.disposeTravelViewHud(); }
});
