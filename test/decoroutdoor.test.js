// DECOR-OUTDOOR (FIELD BUGS 2026-10-05, the owner: "There seems to be a lot of missing decor items with house
// decoration"; asked which, the outdoor pieces for a yard among them). A yard's decorator offered the rooms' furniture
// alone: none of what Daggerfall stands in its streets - a fence, a well, a fountain, a cart, a lamp - and none of its
// trees and plants. Now each town block's street joins the catalogue, and the climates' nature sets whole; both stand in
// a yard alone, a yard's nature its own climate's, drawn as the town's own is - in the town's climate, its season,
// Seasons of the Iliac Bay's picture where it stands, the street's animals moving - and stood again when its pixel is
// built again. Pinned through the real collector, catalogue, scan, decorator and yard host.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectDecor, decorCatalogue, decorRoomEntries, addDecorNature, isStreetPiece, DECOR_NATURE_BASES, DECOR_NATURE_RECORDS,
  DECOR_KINDS,
} from '../src/systems/decorCatalogue.js';
import { createDecorScan, decorScanDeps } from '../src/systems/decorScan.js';
import { createHomeYards } from '../src/scenes/homeYards.js';
import { yardNatureFlat, isNaturePiece } from '../src/scenes/yardNature.js';
import { TREE_RECORDS } from '../src/world/terrainNature.js';
import { applyClimate, SEASON } from '../src/world/climateSwaps.js';
import { getWorldClimateSettings } from '../src/formats/mapsFile.js';
import { billboardSize } from '../src/world/rmbFlats.js';
import { floraSwayOf } from '../src/systems/windDrive.js';
import { BLOCK_TYPES } from '../src/formats/blocksFile.js';
import { LADDER_MODEL_ID } from '../src/player/enterExit.js';
import { rmb, fakeBlocks, fakeDoc, fakeWin, settle, TOWN, rows, all } from './decorFakes.mjs';

/** A parsed RMB block with a STREET: its own models (`misc`, ids), its own flats (`miscFlats`, [a, r, factionID?]) and
 *  one building whose outside stands `outside` flats - beside one room (rmb's own). */
function street({ misc = [], miscFlats = [], outside = [], room = rmb() } = {}) {
  const b = room.rmbBlock;
  return {
    rmbBlock: {
      ...b,
      misc3dObjectRecords: misc.map((id) => ({ modelIdNum: id })),
      miscFlatObjectRecords: miscFlats.map(([a, r, factionID = 0]) => ({ textureArchive: a, textureRecord: r, factionID })),
      subRecords: [{ ...b.subRecords[0], exterior: { blockFlatObjectRecords: outside.map(([a, r]) => ({ textureArchive: a, textureRecord: r })) } }],
    },
  };
}
const STREET = street({
  misc: [41208, 41220, 62324, 41600, 446, 447, 41739, LADDER_MODEL_ID, 41120],
  miscFlats: [[210, 16], [201, 3], [182, 21, 3], [199, 10], [504, 12], [212, 1]],
  outside: [[210, 16], [501, 4], [212, 1]],
  room: rmb([41120], [[210, 3]]),
});

test('DECOR-OUTDOOR the street: a town block\'s own models (never the mill, the gates, the town\'s board or the ladder) and its flats and its buildings\' outside flats (never a marker or nature) - a street\'s person a person; a piece a room stands too is the room\'s (mutants: DECOROUTDOOR-street-unread, DECOROUTDOOR-street-flats-unread, DECOROUTDOOR-outside-flats-unread, DECOROUTDOOR-exclusions-lost, DECOROUTDOOR-street-nature-taken)', () => {
  assert.deepEqual([41208, 41220, 62324, 41120].map(isStreetPiece), [true, true, true, true]);
  assert.deepEqual([41600, 446, 447, 41739, LADDER_MODEL_ID, 0, null].map(isStreetPiece), Array(7).fill(false), 'the mill, the gates, the board (the hall\'s), the ladder');
  const c = collectDecor([STREET]);
  assert.deepEqual([...c.keys()].sort(), ['f182.21', 'f201.3', 'f210.16', 'f210.3', 'f212.1', 'm41120', 'm41208', 'm41220', 'm62324']);
  assert.deepEqual(['m41208', 'm41220', 'm62324', 'f210.16', 'f201.3', 'f212.1'].map((k) => c.get(k).from), Array(6).fill('street'));
  assert.deepEqual([c.get('f210.16').count, c.get('f212.1').count], [2, 2], 'the block\'s own and a building\'s outside, both counted');
  assert.equal(c.get('f182.21').person, true);
  assert.deepEqual([c.get('m41120').from, c.get('m41120').count, c.get('f210.3').from], ['room', 2, 'room'], 'the room\'s chair is the room\'s, its street copy counted');
});

test('DECOR-OUTDOOR the nature: every climate\'s set (its summer archive) and every record Daggerfall stands of it, 1 to 31, joined whole - a tree of its set named "Tree", any other a "Plant", each numbered among its own set; a key a room holds stays the room\'s (mutants: DECOROUTDOOR-nature-unnumbered-by-set, DECOROUTDOOR-tree-unnamed)', () => {
  assert.deepEqual(DECOR_NATURE_BASES, [500, 501, 502, 503, 504, 506, 508, 510], 'the climates\' own sets, never a winter twin');
  assert.equal(DECOR_NATURE_RECORDS, 31);
  assert.deepEqual(DECOR_KINDS.nature, 'Trees and plants');
  const c = addDecorNature(collectDecor([rmb([], [[504, 3]])]));
  assert.equal(c.get('f504.3').from, 'room', 'a room\'s own piece of a nature archive stays the room\'s');
  const cat = decorCatalogue(c);
  const nature = cat.filter((e) => e.kind === 'nature');
  assert.equal(nature.length, DECOR_NATURE_BASES.length * DECOR_NATURE_RECORDS - 1);
  assert.ok(nature.every((e) => e.outside && DECOR_NATURE_BASES.includes(e.nature) && e.flat[0] === e.nature && e.flat[1] >= 1 && e.flat[1] <= 31));
  for (const base of DECOR_NATURE_BASES) {
    const own = nature.filter((e) => e.nature === base);
    const trees = own.filter((e) => e.name.startsWith('Tree')).map((e) => e.flat[1]).sort((a, b) => a - b);
    assert.deepEqual(trees, [...TREE_RECORDS[base]].sort((a, b) => a - b), `${base}: its set's own trees`);
    const names = own.filter((e) => e.name.startsWith('Tree')).sort((a, b) => a.flat[1] - b.flat[1]).map((e) => e.name);
    assert.deepEqual(names, trees.map((_, i) => `Tree ${i + 1}`), `${base}: numbered among its own set`);
  }
});

test('DECOR-OUTDOOR the offer: no room indoors offers the street or the nature; a yard offers the street, and the nature of its own climate alone - none where it knows no climate (mutants: DECOROUTDOOR-outside-indoors, DECOROUTDOOR-any-climate)', () => {
  const cat = decorCatalogue(addDecorNature(collectDecor([STREET])));
  const keys = (r) => decorRoomEntries(cat, r, true).map((e) => e.key);
  for (const r of [{ kind: 'house' }, { kind: 'ship' }, { kind: 'home' }, { kind: 'home', hall: true }]) {
    const k = keys(r);
    assert.ok(!k.includes('m41208') && !k.includes('f504.12') && k.includes('m41120'), JSON.stringify(r));
  }
  const yard = keys({ kind: 'home', yard: true, natureBase: 506 });
  assert.ok(['m41208', 'm41220', 'm62324', 'f210.16', 'f201.3', 'm41120'].every((k) => yard.includes(k)), 'the street, and the rooms\' as ever');
  assert.ok(yard.includes('f506.12') && !yard.includes('f504.12') && !yard.includes('f510.12'), 'its own climate\'s trees');
  assert.equal(yard.filter((k) => /^f5\d\d\./.test(k)).length, DECOR_NATURE_RECORDS);
  assert.ok(!keys({ kind: 'home', yard: true }).some((k) => /^f5\d\d\./.test(k)), 'no climate known, no nature');
});

test('DECOR-OUTDOOR the scan, through the hosts\' one constructor: the streets read and the nature joined, each priced by its own picture (mutant: DECOROUTDOOR-scan-natureless)', async () => {
  const blocks = fakeBlocks([{ type: BLOCK_TYPES.Rmb, block: STREET }]);
  const arch = { getRecordIndex: (id) => id, getMesh: () => ({ radius: 40 }) };
  const getTexture = async () => ({ recordCount: 32, getSize: () => ({ width: 32, height: 64 }), getScale: () => ({ width: 0, height: 0 }) });
  const scan = createDecorScan(decorScanDeps({ blocks, arch, getTexture }));
  for (let i = 0; i < 40 && scan.phase() !== 'done'; i++) { scan.step(); await settle(); }
  const e = scan.entries();
  for (const k of ['m41208', 'f201.3', 'f504.12', 'f510.31']) {
    const x = e.find((y) => y.key === k);
    assert.ok(x && scan.radiusOf(x) > 0, `${k}: in, and priced`);
  }
});

// ─── THE YARD ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const DESERT = getWorldClimateSettings(224).climateType;
const WOODS = getWorldClimateSettings(231).climateType;
/** An archive the town's climate swaps (applyClimate's own answer) - found, never assumed. */
const SWAPPED = [...Array(500).keys()].find((a) => applyClimate(a, 0, DESERT, SEASON.Summer) !== a && applyClimate(a, 0, DESERT, SEASON.Summer) !== applyClimate(a, 0, WOODS, SEASON.Summer));
const yardPiece = (over = {}) => ({ id: 'p1', model: null, flat: [504, 12], pos: [8, 0, 2], rot: [0, 0, 0], scale: 2, light: null, storage: false, paid: 120, ...over });

/** The real yard host over a town pixel built in `season`, its town of `climate`, a home (300) holding `pieces` - `own`
 *  the player's, who stands on its lot - with the panel's picture door `iconUrl`. */
function yardWorld({ pieces, season = SEASON.Summer, climate = WOODS, seasonal = null, own = false, iconUrl = async () => null } = {}) {
  const made = [];
  const uploads = [];
  const animated = [];
  const doc = fakeDoc();
  const pixel = (s) => ({
    px: 0, py: 0, homeTown: 7, homeRegion: 17, season: s, townClimate: climate,
    homeFrames: new Map([[300, { at: [10, 0, 10], box: [6, 0, 7, 14, 6, 13] }]]),
    texRemap: new Map(), forest: { base: 504, archive: s === SEASON.Winter ? 505 : 504 },
    flatAnims: { add: (b, a, n) => animated.push([b, a, n]), remove() {} },
  });
  const built = new Map([['0,0', pixel(season)]]);
  const sizes = { 504: [40, 120], 505: [44, 130], 201: [30, 20] };
  const yards = createHomeYards({
    api: { yards: async () => ({ ok: true, data: { yards: [{ buildingKey: 300, pieces }] } }) },
    homes: { homeAt: (m, k) => (k === 300 ? { owner: 'Tomas', own, look: null } : null) },
    built: () => built, translation: () => [0, 0, 0], feet: () => (own ? [18, 0, 10] : [100, 0, 100]), outside: () => true, eye: () => (own ? [18, 1.6, 10] : [100, 1.6, 100]),
    collider: () => ({ addMesh() {}, removeBucket() {} }),
    meshes: { getGpuMesh: async (id) => ({ id, subMeshes: [{ textureArchive: SWAPPED, textureRecord: 0 }] }), cpuModels: new Map() },
    renderer: {
      createBillboardBatch: (a, r, size, centers) => { const b = { a, r, size, centers }; made.push(b); return b; },
      destroyBillboardBatch: (b) => { b.gone = true; }, uploadTexture: (a, k) => uploads.push(`${a}_${k}`),
    },
    getTexture: async (a) => ({ recordCount: 32, getSize: () => { const [w, h] = sizes[a] ?? [16, 32]; return { width: w, height: h }; }, getScale: () => ({ width: 0, height: 0 }), getFrameCount: (r) => (a === 201 ? 4 : 1) }),
    uploadRecord() {}, uploadRecordFrame() {}, iconUrl,
    seasonal: () => seasonal,
    scanDeps: () => ({ blocks: fakeBlocks([{ type: TOWN, block: rmb([41000]) }]), isTownBlock: (x) => x === TOWN, nature: true, modelRadius: () => 0.8, flatRadius: async () => 0.2 }),
    character: () => 'r0123456789abcdef0123', realm: () => null, wallet: () => ({ gold: 5000, pay() {}, credit() {} }), regionOf: () => 17,
    doc, win: fakeWin(), canvas: null, touch: false, actionOf: () => null, locked: () => true, cursorOff() {}, stick: () => null,
    say() {}, refusal: (w) => w, openSlot() {}, now: () => 0,
  });
  const cam = own ? { pos: [18, 1.6, 10], yaw: Math.PI, pitch: -0.6 } : { pos: [100, 1.6, 100], yaw: 0, pitch: 0 };
  const run = async (n = 3, overlayUp = false) => { for (let i = 0; i < n; i++) { yards.frame({ dt: 1, cam, overlayUp }); await settle(); await settle(); } };
  return { yards, built, made, uploads, animated, pixel, run, doc };
}
const live = (made) => made.filter((b) => !b.gone);
const sized = (w, h, k = 1) => { const s = billboardSize({ getSize: () => ({ width: w, height: h }), getScale: () => ({ width: 0, height: 0 }) }, 0); return { w: s.w * k, h: s.h * k }; };

test('DECOR-OUTDOOR the yard\'s tree: drawn as its town draws its nature - the season\'s archive of its set (winter\'s twin in winter), at its own scale on its own base, leaning with the wind, mirrored when turned half round - and stood again in the new season when its pixel is built again (mutants: DECOROUTDOOR-tree-seasonless, DECOROUTDOOR-tree-unscaled, DECOROUTDOOR-tree-still, DECOROUTDOOR-rebuild-unheard)', async () => {
  assert.equal(isNaturePiece(yardPiece()), true);
  assert.equal(isNaturePiece(yardPiece({ flat: [210, 3] })), false);
  assert.deepEqual([yardNatureFlat([504, 12], SEASON.Summer), yardNatureFlat([504, 12], SEASON.Winter), yardNatureFlat([503, 4], SEASON.Winter)], [[504, 12], [505, 12], [503, 4]]);
  const w = yardWorld({ pieces: [yardPiece(), yardPiece({ id: 'p2', pos: [-8, 0, 2], rot: [180, 0, 0], scale: 1 })] });
  await w.run();
  let [a, b] = live(w.made);
  assert.deepEqual([a.a, a.r, a.size, a.centers], [504, 12, sized(40, 120, 2), [[18, 0, 12]]], 'summer: its set\'s own archive, twice its size, on its base');
  assert.equal(a.sway, floraSwayOf(504, 504, sized(40, 120, 2).h), 'it leans as the town\'s flora leans');
  assert.ok(b.size.w < 0 && b.size.h > 0, 'turned half round: mirrored');
  // the season turns: the town's pixel is built again, and the yard stands again in it
  w.built.set('0,0', w.pixel(SEASON.Winter));
  await w.run(1);
  [a, b] = live(w.made);
  assert.deepEqual([a.a, a.r, a.size], [505, 12, sized(44, 130, 2)], 'winter: the woodland\'s snowy twin');
  assert.equal(w.made.filter((x) => x.gone).length, 2, 'the summer pictures let go');
});

test('DECOR-OUTDOOR the yard\'s tree under Seasons of the Iliac Bay: the mod\'s picture of the season\'s record, uploaded under the install\'s own key without mips, at the picture\'s size and the piece\'s scale (mutant: DECOROUTDOOR-tree-classic-under-sib)', async () => {
  const image = { width: 8, height: 8 };
  const seasonal = { installedSeason: 2, lookup: (a, r) => (a === 504 && r === 12 ? { texture: { image }, size: { w: 3, h: 9 } } : null) };
  const w = yardWorld({ pieces: [yardPiece()], seasonal });
  await w.run();
  const [a] = live(w.made);
  assert.deepEqual([a.a, a.r, a.size], [504, '12#season2', { w: 6, h: 18 }]);
  assert.deepEqual(w.uploads, ['504_12#season2']);
});

test('DECOR-OUTDOOR the yard\'s street pieces: a model stands in its TOWN\'S climate - its swaps written into the pixel\'s own table before it stands; a street\'s animal moves with the town\'s animator (mutants: DECOROUTDOOR-model-climateless, DECOROUTDOOR-street-still)', async () => {
  assert.ok(Number.isInteger(SWAPPED), 'an archive the climates swap');
  const w = yardWorld({ pieces: [yardPiece({ model: 41208, flat: null }), yardPiece({ id: 'p2', flat: [201, 3], scale: 1 })], climate: DESERT });
  await w.run();
  const p = w.built.get('0,0');
  assert.equal(p.texRemap.get(`${SWAPPED}_0`), `${applyClimate(SWAPPED, 0, DESERT, SEASON.Summer)}_0`, 'the fence in the desert\'s own wood');
  const animal = live(w.made).find((x) => x.a === 201);
  assert.ok(w.animated.some(([batch, arch, n]) => batch === animal && arch === 201 && n === 4), 'the cow moves');
});

test('DECOR-OUTDOOR the decorator in a yard: its own climate\'s trees offered, their pictures in the list and the ghost the season\'s - a winter woodland tree its snowy twin, as it will stand (mutant: DECOROUTDOOR-tool-flatas-unread)', async () => {
  const asked = [];
  const w = yardWorld({ pieces: [], season: SEASON.Winter, own: true, iconUrl: async (a, r) => { asked.push(`${a}.${r}`); return `url:${a}.${r}`; } });
  await w.run(2);
  const tool = w.yards.tool();
  assert.equal(tool.openPanel(), true);
  await w.run(12, true);
  const panel = w.doc.body.children.find((c) => c.className === 'dfdecor');
  const row = rows(panel).find((r) => r.dataset.key === 'f504.12');
  assert.ok(row, 'its climate\'s tree, offered');
  assert.equal(rows(panel).some((r) => r.dataset.key === 'f510.12'), false, 'never another climate\'s');
  assert.ok(asked.includes('505.12') && !asked.includes('504.12'), 'its picture in the list is the season\'s');
  row.fire('click');
  all(panel, 'dfdecor-btn').find((b) => b.textContent === 'Place').fire('click');
  for (let i = 0; i < 6 && !tool.ghost(); i++) await w.run(1);
  const [ghost] = tool.batches();
  assert.deepEqual([ghost?.a, ghost?.r], [505, 12], 'the ghost: the tree as it will stand, in winter');
});
