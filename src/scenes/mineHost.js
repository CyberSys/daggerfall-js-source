// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF2 (2026-09-28, Mac: "Go") - MINING AND QUARRYING IN THE STREAMING
// WORLD, a kind in the gathering host (scenes/gatherHost.js; bible/
// 06-Systems/Professions-Arc.md 5.2, 6, 23; FORAGE0 14):
//
//   WHERE A NODE STANDS (PROF0 6's "nearest suitable anchor", decided in
//   23). World of Daggerfall is forced on for the online lane, so every
//   client of a room stands the same rock pieces (the pixel's `rocks`,
//   the Rocks and Mountains layouts' own boxes - scenes/world.js). A VEIN
//   stands at the foot of the piece nearest its law point, on the side
//   facing it; with no piece left, on the terrain's stone tile (tile 3)
//   nearest its point within VEIN_STONE_REACH tiles where nature could
//   stand; else where nature stands at its point; else nowhere. A BOULDER
//   is a piece itself - Quarrying works a rock field's boulders (5.2) -
//   so a pixel with fewer pieces stands fewer. A piece holds one node.
//   THE PICTURE. The material's own item flat (TEXTURE.254: the metal's
//   own, a new ore Lodestone's), a small cluster at the foot; a boulder's
//   loose stone Lodestone's lump - no new art (law 6).
//   THE ACT. Foraging's Pick-Axe checks first (FORAGE0 14.3); the machine
//   is systems/mineAct.js; the hand draws DFU's Warhammer (template 126),
//   its StrikeDown frames on each swing.
// ═══════════════════════════════════════════════════════════════════
import { veins, boulders, nodeKey, VEIN_TABLES, dungeonVeins, dveinKey } from '../net/nodeLaw.js';
import { tierOpen, TIER_RANKS, PROF_RANK_MAX, pickAxeBand, minedMaterial } from '../net/professionLaw.js';
import { natureStandsAt, groundAt } from '../world/terrainNature.js';
import { WORLD_MAP_TILE_DIM } from '../world/terrainTiles.js';
import { TERRAIN_SIZE } from '../world/terrainSampler.js';
import { createMineAct } from '../systems/mineAct.js';
import { FT } from '../systems/foragingLaw.js';
import { foragingActRefusal, foragingToolIn } from '../systems/foragingInstall.js';
import { materialLabel } from '../systems/profItems.js';
import { templateByIndex } from '../systems/itemTemplates.js';
import { liveStat } from '../systems/statMods.js';
import { getPref } from '../systems/uiPrefs.js';

/** The item flats' archive; a picture a new ore has none of its own borrows Lodestone's (PROF0 4.8). */
export const ORE_FLAT_ARCHIVE = 254;
export const LODESTONE_RECORD = 66;
/** A vein is this many of its metal's flats at this times the item's own size, spread this far (m) at the foot. */
export const VEIN_FLATS = 3;
export const VEIN_SCALE = 2.2;
export const VEIN_SPREAD = 0.45;
/** A boulder's loose stone at its foot: this many Lodestone lumps at this size. */
export const STONE_FLATS = 3;
export const STONE_SCALE = 1.8;
/** How far off a piece's box a node's flats stand (m), and how far a vein looks for a stone tile (tiles). */
export const ROCK_OFFSET = 0.4;
export const VEIN_STONE_REACH = 24;
/** A Prospector's compass marks the veins stood within this many metres (PROF0 3.3). */
export const PROSPECT_M = 200;
/** NODE-MARKS: a node's glow about its foot (m) - a vein's ore, a boulder's loose stone under its rock, a dungeon
 *  vein's on its wall - and a Prospector's veins, marked out to PROSPECT_M. */
export const MINE_MARKS = Object.freeze({
  vein: Object.freeze({ w: 1.6, h: 1.3 }), boulder: Object.freeze({ w: 2.1, h: 1.5 }), dvein: Object.freeze({ w: 1.4, h: 1.2 }),
});
const PROSPECTOR_MARKS = Object.freeze({ vein: Object.freeze({ ...MINE_MARKS.vein, reach: PROSPECT_M }), dvein: Object.freeze({ ...MINE_MARKS.dvein, reach: PROSPECT_M }) });
/** The Pick-Axe in the hand (FORAGE0 14.2): DFU's own Warhammer. */
export const PICK_HAND = Object.freeze({ group: 'Weapons', templateIndex: 126, material: 0 });
/** DFU's StrikeDown frames a swing plays (fpsWeapon.js clamps to the art's own count). */
const STRIKE_FRAMES = 5;

const TILE_M = TERRAIN_SIZE / WORLD_MAP_TILE_DIM;
/** The point of a box's footprint nearest (x, z) - on its edge, pushed ROCK_OFFSET out along the way from its centre.
 *  @param {number[]} box [x0, y0, z0, x1, y1, z1] */
export function rockFoot(box, x, z) {
  const cx = (box[0] + box[3]) / 2, cz = (box[2] + box[5]) / 2;
  let qx = Math.max(box[0], Math.min(box[3], x)), qz = Math.max(box[2], Math.min(box[5], z));
  if (qx > box[0] && qx < box[3] && qz > box[2] && qz < box[5]) {
    // the point is inside the footprint: the nearest edge
    const d = [qx - box[0], box[3] - qx, qz - box[2], box[5] - qz];
    const m = d.indexOf(Math.min(...d));
    if (m === 0) qx = box[0]; else if (m === 1) qx = box[3]; else if (m === 2) qz = box[2]; else qz = box[5];
  }
  let dx = qx - cx, dz = qz - cz;
  const l = Math.hypot(dx, dz) || 1;
  dx /= l; dz /= l;
  return [qx + dx * ROCK_OFFSET, qz + dz * ROCK_OFFSET];
}
/** The distance from (x, z) to a box's footprint (0 inside). */
const toBox = (box, x, z) => Math.hypot(Math.max(box[0] - x, 0, x - box[3]), Math.max(box[2] - z, 0, z - box[5]));
/** AUDIT 29 C11: whether (x, z) stands inside a rock piece's footprint (the field's boxes overlap - a foot off one piece
 *  can land inside the next). */
const insideRocks = (rocks, x, z) => rocks.some((b) => x > b[0] && x < b[3] && z > b[2] && z < b[5]);
/** The stone tile nearest (tx, ty) within `reach` tiles where nature could stand, or null. */
function nearestStone(samples, tilemap, locationRect, tx, ty, reach) {
  let best = null, bestD = Infinity;
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const d = dx * dx + dy * dy;
      if (d >= bestD || d > reach * reach) continue;
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= WORLD_MAP_TILE_DIM || y >= WORLD_MAP_TILE_DIM) continue;
      if ((tilemap[y * WORLD_MAP_TILE_DIM + x] & 0x3f) !== 3) continue;
      const at = natureStandsAt(samples, tilemap, locationRect, x, y);
      if (at) { best = at; bestD = d; }
    }
  }
  return best;
}

/**
 * A PIXEL'S VEINS AND BOULDERS AS THE CLIENT STANDS THEM (PROF0 23): the law's nodes of the day, each at its anchor -
 * `{ key, what: 'vein'|'boulder', slot, tier, material, signature?, local, rock?, lift }`, `local` pixel-local metres.
 * @param {{ px: number, py: number, day: number, climate: number, region?: number|null, confirmed?: boolean,
 *   samples: Float32Array, tilemap: Uint8Array, locationRect?: any, rocks?: number[][] }} p
 */
export function standMineNodes({ px, py, day, climate, region = null, confirmed = false, samples, tilemap, locationRect = null, rocks = [] }) {
  const out = [];
  const free = [...(rocks ?? [])];
  const claim = (x, z) => {
    if (!free.length) return null;
    let bi = 0, bd = Infinity;
    free.forEach((b, i) => { const d = toBox(b, x, z); if (d < bd) { bd = d; bi = i; } });
    return free.splice(bi, 1)[0];
  };
  if (VEIN_TABLES[climate]) {
    for (const v of veins({ x: px, y: py, day, climate, region, confirmed })) {
      const x = v.u * TERRAIN_SIZE, z = v.v * TERRAIN_SIZE;
      const rock = claim(x, z);
      let local = null;
      if (rock) {
        const [fx, fz] = rockFoot(rock, x, z);
        if (!insideRocks(rocks ?? [], fx, fz)) local = [fx, groundAt(samples, fx, fz), fz];
      }
      if (!local) {
        const tx = Math.min(WORLD_MAP_TILE_DIM - 1, Math.floor(v.u * WORLD_MAP_TILE_DIM));
        const ty = Math.min(WORLD_MAP_TILE_DIM - 1, Math.floor(v.v * WORLD_MAP_TILE_DIM));
        const at = nearestStone(samples, tilemap, locationRect, tx, ty, VEIN_STONE_REACH) ?? natureStandsAt(samples, tilemap, locationRect, tx, ty);
        if (at) local = [at.x, at.y, at.z];
      }
      if (!local) continue;
      out.push({ key: nodeKey({ kind: 'vein', x: px, y: py, day, slot: v.slot }), what: 'vein', slot: v.slot, tier: v.tier, material: v.material, signature: v.signature, local, rock: rock ?? null, lift: 0.5 });
    }
  }
  for (const b of boulders({ x: px, y: py, day, climate })) {
    const rock = claim(b.u * TERRAIN_SIZE, b.v * TERRAIN_SIZE);
    if (!rock) continue;   // a boulder is a rock field's piece: none left, none stands
    const [fx, fz] = rockFoot(rock, b.u * TERRAIN_SIZE, b.v * TERRAIN_SIZE);
    if (insideRocks(rocks ?? [], fx, fz)) continue;   // AUDIT 29 C11: its foot inside a neighbour - none stands
    const g = groundAt(samples, fx, fz);
    out.push({ key: nodeKey({ kind: 'boulder', x: px, y: py, day, slot: b.slot }), what: 'boulder', slot: b.slot, tier: b.tier, material: b.material, local: [fx, g, fz], rock, lift: Math.min(1.2, Math.max(0.4, (rock[4] - g) / 2)) });
  }
  return out;
}
/** A dungeon vein's checks: Foraging's inside, settlement, daylight and sea are the surface's (PROF0 5.1, 23) - the foe
 *  and the load are asked. */
export const DUNGEON_SKIP = Object.freeze(['inside', 'town', 'daylight', 'sea']);
/**
 * A DUNGEON'S VEINS AS THE CLIENT STANDS THEM (PROF0 23): the law's veins of the day, each on the wall its ray finds
 * (`wall(marker, bearing)` - the dungeon's own, scenes/dungeonContext.js veinWall: world metres or null) -
 * `{ key, what: 'dvein', slot, tier, material, local, lift }`, `local` the dungeon's own space.
 * @param {{ dungeon: number, day: number, climate: number, confirmed?: boolean,
 *   wall: (marker: number, bearing: number) => (number[]|null) }} p
 */
export function standDungeonVeins({ dungeon, day, climate, confirmed = false, wall }) {
  const out = [];
  for (const v of dungeonVeins({ dungeon, day, climate, confirmed })) {
    const at = wall(v.marker, v.bearing);
    if (!at) continue;
    out.push({ key: dveinKey({ dungeon, day, slot: v.slot }), what: 'dvein', slot: v.slot, tier: v.tier, material: v.material, local: at, lift: 0.4, reach: 2.5 });
  }
  return out;
}
/** A node's flats: a cluster round its foot, turned by its slot. */
export function mineFlats(node) {
  const [x, y, z] = node.local;
  const n = node.what === 'boulder' ? STONE_FLATS : VEIN_FLATS;
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = node.slot * 1.7 + (i * 2 * Math.PI) / n;
    const r = i === 0 ? 0 : node.what === 'dvein' ? VEIN_SPREAD / 2 : VEIN_SPREAD;   // on a wall the ore sits close
    out.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]);
  }
  return out;
}
/** The picture a node's flats draw: its metal's own item flat, or Lodestone's for a new ore and for loose stone. */
export function mineRecord(node) {
  if (node.what === 'boulder') return LODESTONE_RECORD;
  const m = minedMaterial(node.material);
  const t = m?.group ? templateByIndex(m.templateIndex) : null;
  return Number.isInteger(t?.worldTextureRecord) ? t.worldTextureRecord : LODESTONE_RECORD;
}

/**
 * WHAT E DOES AT A VEIN OR A BOULDER, and the prompt that says it: `{ harvest, verb, rest, ready }` - `ready` false with
 * `rest` naming what is missing (worked today, being counted, the day's cap, the rank, the Pick-Axe, the Stores' room);
 * a rank short carries the rank it needs (`needsRank` - VEIN-NEED says the player's own beside it).
 * @param {{ node: any, taken: boolean, counting: boolean, rank: number, pick: boolean, storesFull: (key: string) => boolean,
 *   today: number, cap: number }} o
 */
export function minePlan({ node, taken, counting, rank, pick, storesFull, today, cap }) {
  const harvest = node.what === 'boulder' ? 'stone' : 'ore';
  const name = node.what === 'boulder' ? 'the stone' : materialLabel(node.material);
  const verb = node.what === 'boulder' ? 'Quarry the stone' : `Mine ${name}`;
  const rankWord = `Mining ${rank}`;
  if (taken) return { harvest, verb: `${node.what === 'boulder' ? 'The stone' : name} - worked today`, rest: '', ready: false };
  if (counting) return { harvest, verb, rest: 'being counted', ready: false };
  if (today >= cap) return { harvest, verb, rest: `${rankWord} - ${today} of ${cap} today`, ready: false, full: true };
  if (!tierOpen(rank, node.tier)) return { harvest, verb, rest: `needs Mining ${TIER_RANKS[node.tier - 1]}`, ready: false, needsRank: TIER_RANKS[node.tier - 1] };
  if (!pick) return { harvest, verb, rest: 'needs a Pick-Axe', ready: false };
  if (storesFull(node.material)) return { harvest, verb, rest: `Stores full - ${materialLabel(node.material)}`, ready: false };
  return { harvest, verb, rest: rankWord, ready: true };
}

/** The hand's StrikeDown frame for a swing's phase (1 just struck, 0 none) - Idle between swings. */
export const pickHandFrame = (swing) => (swing > 0 ? { state: 'StrikeDown', frame: Math.min(STRIKE_FRAMES - 1, Math.floor((1 - swing) * STRIKE_FRAMES)) } : { state: 'Idle', frame: 0 });

/**
 * MINING'S KIND in the gathering host (scenes/gatherHost.js): the veins and boulders, their pictures, the plan, the act.
 * @param {{ book: any }} deps
 * @returns {import('./gatherHost.js').GatherKind}
 */
export function mineKind({ book }) {
  const harvestOf = (n) => (n.what === 'boulder' ? 'stone' : 'ore');
  const gone = (n) => book.taken(n.key, harvestOf(n));
  return {
    id: 'mine',
    professions: Object.freeze(['mining']),
    nodesOf({ px, py, day, info, confirmed, entry }) {
      return standMineNodes({
        px, py, day, climate: info.climate, region: info.region, confirmed,
        samples: entry.samples, tilemap: entry.tilemap, locationRect: entry.locationRect ?? entry.wodSite ?? null, rocks: entry.rocks ?? [],   // AUDIT 29 C8
      });
    },
    dungeonNodesOf({ dungeon, day, info, confirmed, wall }) {
      return standDungeonVeins({ dungeon, day, climate: info.climate, confirmed, wall });
    },
    flatsOf: (n) => [{ archive: ORE_FLAT_ARCHIVE, record: mineRecord(n), scale: n.what === 'boulder' ? STONE_SCALE : VEIN_SCALE, centers: mineFlats(n) }],
    gone,
    /** NODE-MARKS: every vein and boulder standing; a Prospector's veins from PROSPECT_M off (PROF0 3.3) */
    mark(n, { specs }) {
      if (gone(n)) return null;
      return (specs('mining')[50] === 'prospector' && PROSPECTOR_MARKS[n.what]) || MINE_MARKS[n.what] || MINE_MARKS.vein;
    },
    tools: Object.freeze([FT.PickAxe]),   // TOOL-USE: the Pick-Axe's Use at a vein or a boulder is E there
    plan(n, { entity, rank }) {
      const plan = minePlan({
        node: n, taken: book.taken(n.key, harvestOf(n)), counting: book.counting(n.key, harvestOf(n)), rank: rank('mining'),
        pick: !!foragingToolIn(entity, FT.PickAxe), storesFull: (key) => book.held(key) >= (book.state.caps?.stores ?? 5000),
        today: book.state.today?.mining ?? 0, cap: book.state.caps?.harvests ?? 60,
      });
      return { ...plan, profession: 'mining' };
    },
    start(n, plan, { entity, rank }) {
      const refusal = foragingActRefusal(FT.PickAxe, n.what === 'dvein' ? DUNGEON_SKIP : null);
      if (refusal) return { refused: refusal };
      return {
        act: createMineAct({
          tier: n.tier, band: pickAxeBand({ intelligence: liveStat(entity, 'intelligence'), agility: liveStat(entity, 'agility') }),
          master: rank('mining') >= PROF_RANK_MAX, gentle: getPref('gentleActs') === true,
        }),
        harvest: plan.harvest, tool: foragingToolIn(entity, FT.PickAxe), profession: 'mining', label: '',
        hand: (a) => (a.tool ? { ...PICK_HAND, ...pickHandFrame(a.act.swing) } : null),
      };
    },
    cleanNote: () => ' (every strike on the glint)',
    title: () => 'Miner',
  };
}
