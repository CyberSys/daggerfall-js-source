// TOWN-MARKS (2026-09-29, Mac: "For the notice boards in town. Can we physically mark them on the town map, and also mark
// owned player housing"; bible/10-UI/UI-Arc.md TOWN-MARKS): THE TOWN MAP'S NOTICE BOARDS AND PLAYER HOUSING. The data
// (ui/townMapMarks.js: which boards, which houses, what each is called), the ink (ui/inkTown.js paintBoardMark,
// paintHomeMark - under the names, lifted above their place), the sheet (ui/townSheet.js: into sheet space by the
// plates' and the party's own seams, answered under the pointer, a repaint when the homes answer), and the wiring
// (ui/townMapDoor.js, scenes/world.js toggleExteriorAutomap).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  readTownBoards, readTownHomes, townBoardRows, townHomeRows, boardMarkLabel, TOWN_BOARD_LABEL, TOWN_HOUSE_LABEL, TOWN_MARK_REACH,
} from '../src/ui/townMapMarks.js';
import { createTownSheet } from '../src/ui/townSheet.js';
import { TOWN_PEN, TOWN_MARK_LIFT, sheetY, WORLD_PER_PX, paintBoardMark, paintHomeMark } from '../src/ui/inkTown.js';
import { toPaper, PEN } from '../src/ui/inkMap.js';
import { nameplateAnchor } from '../src/ui/nameplateLayout.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A canvas that records every call with the pens it was made in. */
function recordingCtx() {
  const calls = [];
  const state = {};
  return new Proxy({}, {
    get: (_, k) => {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: String(t).length * 6 });
      if (k in state) return state[k];
      return (...args) => { calls.push({ fn: k, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle }); };
    },
    set: (_, k, v) => { state[k] = v; return true; },
  });
}
const near = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
/** Where the stems stand: each stem's place - paintMarkStem's halo pass, one straight line up from it and stroked. */
const stemsAt = (ctx) => ctx.calls.filter((c, i) => c.fn === 'moveTo' && c.strokeStyle === TOWN_PEN.halo && ctx.calls[i - 1]?.fn === 'beginPath'
  && ctx.calls[i + 1]?.fn === 'lineTo' && ctx.calls[i + 1].args[0] === c.args[0] && ctx.calls[i + 1].args[1] < c.args[1]
  && ctx.calls[i + 2]?.fn === 'stroke').map((c) => c.args);

const VIEW = { ox: 0, oy: 0, scale: 3 };
const ENV = { view: VIEW, paperW: 2000, paperH: 2000, dpr: 1, pulse: 0 };
const house = (buildingKey, blockX, blockY, x, z, extra = {}) => ({ buildingKey, blockX, blockY, position: [x, 0, z], buildingType: 17, isResidence: true, name: '', ...extra });

test('TOWN-MARKS the reading: a board with no place and a home with no building are dropped; a board with no name is a Notice Board (mutants: the reads keep a bad row)', () => {
  assert.deepEqual(readTownBoards(null), []);
  assert.deepEqual(readTownBoards(() => 'nope'), []);
  assert.deepEqual(readTownBoards(() => { throw new Error('x'); }), []);
  assert.deepEqual(readTownBoards(() => [{ feet: [1, 2, 3], label: 'Notice Board: 2 new' }, { feet: [NaN, 0, 0] }, { label: 'x' }, { feet: [4, 5, 6] }]), [
    { feet: [1, 2, 3], label: 'Notice Board: 2 new' },
    { feet: [4, 5, 6], label: TOWN_BOARD_LABEL },
  ]);
  assert.deepEqual(readTownHomes(() => [{ buildingKey: 7, own: true, label: 'Your home' }, { buildingKey: 0, label: 'x' }, { buildingKey: 1.5, label: 'x' },
    { buildingKey: 9, label: 3 }, { buildingKey: 8, own: 'yes', label: "Mac's home" }]), [
    { buildingKey: 7, own: true, label: 'Your home' },
    { buildingKey: 8, own: false, label: "Mac's home" },
  ]);
  assert.equal(boardMarkLabel(0), 'Notice Board');
  assert.equal(boardMarkLabel(3), 'Notice Board: 3 new', 'the town\'s unread count, as the board floats it (boardLaw unseenText)');
});

test('TOWN-MARKS the boards: every board of the town\'s but its bounty boards, at the middle and foot of its box, in the location\'s frame (mutants: a bounty board marked; the origin not taken off; the box\'s corner, not its middle)', () => {
  const p = {
    locOrigin: [100, 5, 200],
    boards: [{ box: [110, 5, 210, 112, 9, 214] }, { box: [150, 6, 260, 154, 10, 262] }, { box: [300, 5, 300, 302, 9, 302] }],
  };
  assert.deepEqual(townBoardRows(p, new Set([1]), 2), [
    { feet: [11, 0, 12], label: 'Notice Board: 2 new' },
    { feet: [201, 0, 101], label: 'Notice Board: 2 new' },
  ]);
  assert.deepEqual(townBoardRows(p, new Set(), 0).map((r) => r.feet), [[11, 0, 12], [52, 1, 61], [201, 0, 101]]);
  assert.deepEqual(townBoardRows({ boards: p.boards }, new Set()), [], 'no origin, no frame');
  assert.deepEqual(townBoardRows({ locOrigin: [0, 0, 0] }, new Set()), []);
  assert.deepEqual(townBoardRows({ locOrigin: [0, 0, 0], boards: [{ box: [1, 2] }, {}] }, new Set()), []);
});

test('TOWN-MARKS the housing: an online home, the player\'s and every other player\'s, named as its door names it; the bank\'s house only in its own town (mutants: another town\'s house of the same key marked; the home read as the player\'s; offline homes asked)', () => {
  const buildings = [house(10, 0, 0, 10, 10), house(11, 0, 0, 40, 40), house(12, 1, 0, 20, 20), house(13, 1, 1, 5, 5)];
  const registry = new Map([[10, { owner: 'Mac', own: true }], [11, { owner: 'Gryphoth', own: false }]]);
  const homeAt = (mapId, key) => (mapId === 4000000000 ? registry.get(key) ?? null : null);
  const houses = [];
  houses[3] = { regionIndex: 3, location: 'Daggerfall', mapId: -294967296, buildingKey: 12 };   // the same map id, stored signed
  assert.deepEqual(townHomeRows({ buildings, mapId: 4000000000, regionIndex: 3, houses, homeAt }), [
    { buildingKey: 10, own: true, label: 'Your home' },
    { buildingKey: 11, own: false, label: "Gryphoth's home" },
    { buildingKey: 12, own: true, label: TOWN_HOUSE_LABEL },
  ]);
  // another town of the region: its building 12 is somebody else's - a key is a location's own numbering
  assert.deepEqual(townHomeRows({ buildings, mapId: 77, regionIndex: 3, houses, homeAt }), []);
  // offline: no registry - the bank's house alone
  assert.deepEqual(townHomeRows({ buildings, mapId: 4000000000, regionIndex: 3, houses }), [{ buildingKey: 12, own: true, label: TOWN_HOUSE_LABEL }]);
  // a home stands on the bank's house: the home answers, once
  const both = new Map([[12, { owner: 'Mac', own: true }]]);
  assert.deepEqual(townHomeRows({ buildings, mapId: 4000000000, regionIndex: 3, houses, homeAt: (m, k) => both.get(k) ?? null }), [{ buildingKey: 12, own: true, label: 'Your home' }]);
  // a home of my account played by another of my characters is not mine to call mine
  assert.deepEqual(townHomeRows({ buildings, mapId: 4000000000, regionIndex: 0, homeAt: (m, k) => (k === 13 ? { owner: 'Mac', mine: true, own: false } : null) }),
    [{ buildingKey: 13, own: false, label: "Mac's home" }]);
  assert.deepEqual(townHomeRows({ buildings, mapId: undefined, regionIndex: 3, houses }), [], 'off a location');
  assert.deepEqual(townHomeRows({ buildings, mapId: 4000000000, regionIndex: 4, houses }), [], 'no house in this region');
});

test('TOWN-MARKS the sheet: a home stands on its building\'s place (the plates\' anchor, +Z up) and a board on its foot (the party\'s two steps); both under the names, above the place, the player\'s own in the player\'s ink (mutants: a mark mirrored; the wrong building; drawn over the names; the own fill lost)', () => {
  const buildings = [house(1, 0, 0, 30, 30), house(2, 1, 0, 60, 10, { name: 'Oakhouse', isResidence: false, buildingType: 15 })];
  const s = createTownSheet({
    gridW: 2, gridH: 2, blocks: [], buildings: () => buildings, discovered: () => [{ buildingKey: 2, displayName: 'Oakhouse' }],
    boards: () => [{ feet: [16, 0, 48], label: 'Notice Board' }],
    homes: () => [{ buildingKey: 1, own: true, label: 'Your home' }, { buildingKey: 2, own: false, label: "Gryphoth's home" }, { buildingKey: 99, label: 'gone' }],
  });
  const h = s.field.h;
  const [ax, ay] = nameplateAnchor(0, 0, [30, 0, 30]);
  const [bx, by] = nameplateAnchor(1, 0, [60, 0, 10]);
  assert.deepEqual(s.homes(), [{ x: ax, y: sheetY(h, ay), own: true, label: 'Your home' }, { x: bx, y: sheetY(h, by), own: false, label: "Gryphoth's home" }],
    'at the plates\' own anchors; a home whose building is not in this town is not drawn');
  assert.deepEqual(s.boards(), [{ x: 16 / WORLD_PER_PX, y: sheetY(h, 48 / WORLD_PER_PX), label: 'Notice Board' }]);
  const ctx = recordingCtx();
  s.paintOverlay(ctx, ENV);
  const want = [...s.homes(), ...s.boards()].map((m) => toPaper(VIEW, m.x, m.y));
  const got = stemsAt(ctx);
  assert.equal(got.length, 3);
  want.forEach((w, i) => assert.ok(near(got[i], w), `mark ${i} stands on its place: ${got[i]} vs ${w}`));
  const fills = ctx.calls.filter((c) => c.fn === 'fill').map((c) => c.fillStyle);
  assert.equal(fills.filter((f) => f === TOWN_PEN.home).length, 1, 'ONE house filled in the player\'s ink - the player\'s own');
  assert.equal(TOWN_PEN.home, PEN.player);
  const firstName = ctx.calls.findIndex((c) => c.fn === 'fillText');
  const lastMark = ctx.calls.findLastIndex((c) => c.fn === 'moveTo' && near(c.args, want[2]));
  assert.ok(firstName > 0 && lastMark >= 0 && lastMark < firstName, 'the marks go down before the names - a name is never under a glyph');
  // a sheet with no marks is the sheet it was
  const plain = createTownSheet({ gridW: 1, gridH: 1, blocks: [], buildings: () => buildings, discovered: () => [] });
  assert.deepEqual([plain.homes(), plain.boards()], [[], []]);
});

test('TOWN-MARKS the glyphs: lifted TOWN_MARK_LIFT above the place on a stem down to it - a name lettered at the place (20 px at most) clears the foot (mutants: the lift lost; the stem cut)', () => {
  assert.ok(TOWN_MARK_LIFT - 4.5 >= 20 / 2 + 2, 'the glyph\'s foot clears the tallest name centred on the place');
  for (const paint of [(c) => paintBoardMark(c, 100, 200), (c) => paintHomeMark(c, 100, 200, false), (c) => paintHomeMark(c, 100, 200, true)]) {
    const ctx = recordingCtx();
    paint(ctx);
    const moves = ctx.calls.filter((c) => c.fn === 'moveTo' || c.fn === 'lineTo').map((c) => c.args);
    assert.deepEqual(moves[0], [100, 200], 'the stem starts on the place');
    const top = Math.min(...moves.map((m) => m[1]));
    assert.ok(top <= 200 - TOWN_MARK_LIFT - 4 && top >= 200 - TOWN_MARK_LIFT - 7, `the glyph stands above the place: ${top}`);
    assert.ok(ctx.calls.some((c) => c.fn === 'arc' && c.args[0] === 100 && c.args[1] === 200), 'a dot on the place itself');
  }
});

test('TOWN-MARKS the pointer: over a glyph the town map names it - the board with its town\'s unread count, a home as its door does; the bare ground under it is still the street (mutants: asked at the place, not the glyph; the reach lost)', () => {
  const s = createTownSheet({
    gridW: 1, gridH: 1, blocks: [], buildings: () => [house(1, 0, 0, 30, 30)], discovered: () => [], title: 'Daggerfall',
    boards: () => [{ feet: [16, 0, 48], label: 'Notice Board: 3 new' }],
    homes: () => [{ buildingKey: 1, own: false, label: "Gryphoth's home" }],
  });
  s.paintOverlay(recordingCtx(), ENV);
  const [bx, by] = toPaper(VIEW, s.boards()[0].x, s.boards()[0].y);
  assert.equal(s.hoverLabel(bx, by - TOWN_MARK_LIFT).label, 'Notice Board: 3 new');
  assert.equal(s.hoverLabel(bx + TOWN_MARK_REACH - 1, by - TOWN_MARK_LIFT).label, 'Notice Board: 3 new', 'within reach');
  assert.equal(s.hoverLabel(bx + TOWN_MARK_REACH + 1, by - TOWN_MARK_LIFT).label, 'Daggerfall', 'past it');
  const [hx, hy] = toPaper(VIEW, s.homes()[0].x, s.homes()[0].y);
  assert.equal(s.hoverLabel(hx, hy - TOWN_MARK_LIFT).label, "Gryphoth's home");
});

test('TOWN-MARKS the repaint: the homes answer after the map is open - the plan breathes until it has painted the version it has, and then rests (mutants: never repainted; breathing for ever)', () => {
  let version = 0;
  const s = createTownSheet({ gridW: 1, gridH: 1, blocks: [], buildings: () => [], discovered: () => [], homes: () => [], homesVersion: () => version });
  assert.equal(s.breathes(), true, 'not yet painted');
  s.paintOverlay(recordingCtx(), ENV);
  assert.equal(s.breathes(), false, 'painted what it has: at rest');
  version = 1;   // the service answers
  assert.equal(s.breathes(), true, 'the answer is painted on the next beat');
  s.paintOverlay(recordingCtx(), ENV);
  assert.equal(s.breathes(), false);
  const offline = createTownSheet({ gridW: 1, gridH: 1, blocks: [], buildings: () => [], discovered: () => [] });
  assert.equal(offline.breathes(), false, 'no registry: the plan it always was');
});

test('TOWN-MARKS the wiring: the door hands the marks to the enhanced town map; the host marks the open Notice Board\'s boards and the town\'s housing, and asks for the town\'s homes as the map opens (mutants: a key dropped at the door; the board marked while closed; the homes never asked)', () => {
  const door = src('src/ui/townMapDoor.js');
  assert.match(door, /boards: deps\.townBoards \?\? null,/);
  assert.match(door, /homes: deps\.townHomes \?\? null,/);
  assert.match(door, /homesVersion: deps\.townHomesVersion \?\? null,/);
  const w = src('src/scenes/world.js');
  assert.match(w, /townBoards: \(\) => townBoardMarks\(b\),/);
  assert.match(w, /townHomes: \(\) => townHomeRows\(\{\n\s*buildings: summaries, mapId: dfLoc\.mapTableData\?\.mapId, regionIndex: dfLoc\.regionIndex, houses: playerEntity\.houses \?\? null,\n\s*homeAt: onlineHomes \? \(mapId, buildingKey\) => onlineHomes\.homeAt\(mapId, buildingKey\) : null,\n\s*\}\),/);
  assert.match(w, /townHomesVersion: \(\) => onlineHomes\?\.version\(\) \?\? 0,\n\s*\}\)\);\n\s*onlineHomes\?\.ensure\(dfLoc\.mapTableData\?\.mapId\);/);
  const marks = w.slice(w.indexOf('const townBoardMarks = (p) => {'));
  assert.match(marks, /^const townBoardMarks = \(p\) => \{\n\s*if \(!noticeBook \|\| noticeBook\.open !== true \|\| !p\?\.boards\?\.length \|\| !p\.location\) return \[\];\n\s*const bountyAt = boardSplitOf\(p\);\n\s*const town = noticeTownOf\(p\.px, p\.py, bountyAt\.size > 0\);\n\s*return town \? townBoardRows\(p, bountyAt, noticeBook\.unseen\(town\.mapId\)\) : \[\];/);
  // the classic exterior automap is DFU's own window: it draws DFU's marks alone
  assert.doesNotMatch(src('src/ui/exteriorAutomapWindow.js'), /townBoards|townHomes|paintBoardMark|paintHomeMark/);
});
