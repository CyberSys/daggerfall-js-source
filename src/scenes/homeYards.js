// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-YARD (2026-09-30) — PIECES OUTSIDE A HOME, ON ITS OWN LOT.
//
// Asked: "allowing for prop placement on the outside within the limits of
// their house". An online home's owner decorates its YARD as they decorate
// its rooms: the same decorator (scenes/decorTool.js - the catalogue, the
// free camera, the price by size), opened standing on the lot, its pieces
// kept on the account service beside the room's (a yard's own flag and cap -
// net/decorLaw.js decorYardPieceOf) and stood for everyone walking the town.
//
// THE FRAME a yard is laid out in is its building's own place in its town
// (world/rmbLayout.js `recordAt` - the subrecord's origin, the same on every
// client), in the world's axes as a room's pieces are: a piece's `pos` is
// from there. THE LOT is the building's footprint (the box round its own
// models) and YARD_MARGIN round it, never inside the house and never on
// another building's footprint: the client measures it (the service has no
// town to measure in) and the decorator refuses a piece off it, its edges
// marked while a piece is placed. The service's own bound is the lot's widest
// (DECOR_YARD_POS_MAX).
//
// THE TOWN'S YARDS are read with the town (one answer for every home in it -
// server-account/src/decor.js yardsOf), believed a minute as the homes are
// (systems/onlineHomes.js), and each yard stood in its pixel as a room's
// pieces stand in its room (scenes/decorRoom.js, one pool a yard): its own
// collider buckets on the world's collider, drawn in the world's passes, and
// stood again where it stands when the world recentres (the pool places in
// scene space). A yard of a pixel streamed out is taken down with it.
//
// HOME-LOOK rides the same decorator: "Exterior", the painter of the house's
// outside, is a tab of the yard's panel (ui/decorPanel.js), its look tried on
// the house as it is chosen and written when it is painted.
//
// Online alone - a yard is an online home's. Not a DFU member. Ledger A.
// ═══════════════════════════════════════════════════════════════════

import { createDecorRoom } from './decorRoom.js';
import { createDecorTool } from './decorTool.js';
import { decorYardPieceOf, DECOR_YARD_CAP } from '../net/decorLaw.js';
import { homeLookRecords } from '../world/homeLook.js';   // HOME-LOOK (AUDIT): the styles a roof's or a door's family holds

/** AUDIT: how far from the eye a yard's pieces are drawn, metres (its flats stand in the billboard pass's own cull). */
export const YARD_DRAW_M = 300;
/** How far past the house's footprint its lot runs, metres. */
export const YARD_MARGIN = 6;
/** How far outside its lot the owner may still stand and open the yard's decorator. */
export const YARD_NEAR = 2;
/** How high the lot's marked edge stands. */
export const YARD_MARK_HIGH = 1;
/** A town's yards, believed this long; an unanswered ask waits this long before the next. */
export const YARD_TOWN_TTL_MS = 60_000;
export const YARD_RETRY_MS = 10_000;
/** How often the yards are brought in line with the town, seconds. */
export const YARD_SYNC_S = 0.5;
/** What the decorator says of a piece off the lot, in the house, or on another building's ground. */
export const YARD_OFF_LOT = 'Outside your lot - keep it within the marked edge.';
export const YARD_IN_HOUSE = 'That is inside your house - place it in the yard around it.';
export const YARD_ON_OTHER = "That is another building's ground.";
export const YARD_FULL = `Your yard already holds ${DECOR_YARD_CAP} pieces.`;   // the bar's words (ui/decorPanel.js decorWhyNot, `yard`)

/**
 * A LOT from a building's frame: `origin` its own place and `box` the box round its models ([minX, minY, minZ, maxX,
 * maxY, maxZ]), both in one frame - answered relative to the origin: `house` its footprint [x0, z0, x1, z1] and `lot`
 * that footprint grown by `margin` [x0, z0, x1, z1], and `y` the ground's height (the box's foot).
 */
export function yardLot(origin, box, margin = YARD_MARGIN) {
  if (!Array.isArray(origin) || !Array.isArray(box) || box.length < 6) return null;
  const house = [box[0] - origin[0], box[2] - origin[2], box[3] - origin[0], box[5] - origin[2]];
  if (!(house[2] > house[0]) || !(house[3] > house[1])) return null;
  return { house, lot: [house[0] - margin, house[1] - margin, house[2] + margin, house[3] + margin], y: box[1] - origin[1] };
}
const inRect = (x, z, r, pad = 0) => x >= r[0] - pad && x <= r[2] + pad && z >= r[1] - pad && z <= r[3] + pad;
/**
 * WHY A PIECE CANNOT STAND at `pos` (from the frame's origin), or null: off the lot, inside the house's footprint (a
 * piece on its roof too), or on another building's (`others`, their footprints in the same frame [x0, z0, x1, z1]).
 * AUDIT: `foot` - the ground it covers, offsets [dx, dz] from `pos` (decorTool.js footprintOf) - is asked too: all of
 * it on the lot, none of it in the house or on another building's ground (its middle alone let a long piece straddle a
 * wall).
 */
export function yardWhyNot(pos, lot, others = [], foot = []) {
  if (!lot || !Array.isArray(pos)) return YARD_OFF_LOT;
  const [x, , z] = pos;
  const points = [[x, z], ...(foot ?? []).map(([dx, dz]) => [x + dx, z + dz])];
  if (!points.every(([px, pz]) => inRect(px, pz, lot.lot))) return YARD_OFF_LOT;
  if (points.some(([px, pz]) => inRect(px, pz, lot.house, -0.05))) return YARD_IN_HOUSE;
  if ((others ?? []).some((r) => points.some(([px, pz]) => inRect(px, pz, r, -0.05)))) return YARD_ON_OTHER;
  return null;
}
/** Whether a world point stands on the lot (or within `near` of it) - `origin` the frame's, in the world. */
export const yardHolds = (lot, origin, p, near = 0) => !!lot && Array.isArray(p) && inRect(p[0] - origin[0], p[2] - origin[2], lot.lot, near);
/**
 * THE LOT'S MARKED EDGE: its four sides as upright bands (the decal pass's quads - combat/bloodDecals.js writeDecalQuad's
 * shape), standing on the ground, in the world (`origin` the frame's).
 */
export function yardLotQuads(lot, origin, high = YARD_MARK_HIGH) {
  if (!lot) return [];
  const [x0, z0, x1, z1] = lot.lot;
  const y = origin[1] + lot.y + high / 2;
  const side = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az);
    return { pos: [origin[0] + (ax + bx) / 2, y, origin[2] + (az + bz) / 2], size: high, stretch: len / high, right: [(bx - ax) / len, 0, (bz - az) / len], up: [0, 1, 0] };
  };
  return [side(x0, z0, x1, z0), side(x1, z0, x1, z1), side(x1, z1, x0, z1), side(x0, z1, x0, z0)];
}

/**
 * THE TOWN'S YARDS, AND THE OWNER'S DECORATOR OUTSIDE. `deps` (the world host's - scenes/world.js):
 *   api          - net/accountClient.js accountDecor: yards(mapId), place (with `yard`), move, remove
 *   homes        - systems/onlineHomes.js: homeAt(mapId, key) - whose a home is, and whether it is the character's own
 *   built()      - the world's built pixels (each `{ px, py, homeTown, homeFrames }` - homeFrames: key -> { at, box },
 *                  pixel-local)
 *   translation(px, py) - a pixel's place in the scene now
 *   feet()       - where the player stands (scene); outside() - whether the player walks the street (no building,
 *                  no dungeon, no saddle)
 *   collider()   - the world's collider (addMesh, removeBucket, surfaceHit)
 *   meshes, renderer, getTexture, uploadRecord, uploadRecordFrame, iconUrl - the pipeline's, as a room's pool takes them
 *   character(), realm(), wallet(region) - who writes, their record's act, the purse and the home's region's account
 *   doc, win, canvas, touch, actionOf(e), locked(), cursorOff(), stick(), say(line), refusal(word), openSlot(o), now()
 *   look         - HOME-LOOK: `{ preview(mapId, key, look|undefined), season() }` - the painter's preview on the house
 */
export function createHomeYards(deps) {
  const now = () => deps.now?.() ?? Date.now();
  /** @type {Map<number, {at: number, byKey: Map<number, any[]>}>} */
  const towns = new Map();
  const asking = new Map();
  const failed = new Map();
  /** @type {Map<string, {pool: any, px: number, py: number, mapId: number, bk: number, t: number[], sig: string, lot: any, frame: any}>} */
  const yards = new Map();
  let syncIn = 0;
  /** @type {any} the owner's own yard the decorator stands in, or null */
  let cur = null;

  function ensure(mapId) {
    const had = towns.get(mapId);
    if (had && now() - had.at < YARD_TOWN_TTL_MS) return;
    if (asking.has(mapId) || now() - (failed.get(mapId) ?? -Infinity) < YARD_RETRY_MS) return;
    const p = Promise.resolve().then(() => deps.api?.yards?.(mapId)).then((r) => {
      const list = r?.ok ? r.data?.yards : null;
      if (!Array.isArray(list)) { failed.set(mapId, now()); return; }
      const byKey = new Map();
      for (const y of list) {
        if (!Number.isSafeInteger(y?.buildingKey) || !Array.isArray(y.pieces)) continue;
        byKey.set(y.buildingKey, y.pieces.map(decorYardPieceOf).filter(Boolean));
      }
      towns.set(mapId, { at: now(), byKey });
      failed.delete(mapId);
    }, () => { failed.set(mapId, now()); }).finally(() => { asking.delete(mapId); });
    asking.set(mapId, p);
  }

  /** The world point a yard's frame stands at, now. */
  const originOf = (y) => {
    const t = deps.translation(y.px, y.py);
    const f = y.frame;
    return [t[0] + f.at[0], t[1] + f.at[1], t[2] + f.at[2]];
  };
  function makeYard(key, p, bk, frame) {
    const y = { key, px: p.px, py: p.py, mapId: p.homeTown, bk, frame, t: [...deps.translation(p.px, p.py)], sig: '', lot: yardLot(frame.at, frame.box), pool: null };
    y.pool = createDecorRoom({
      meshes: deps.meshes, renderer: deps.renderer, getTexture: deps.getTexture, uploadRecord: deps.uploadRecord, uploadRecordFrame: deps.uploadRecordFrame,
      collider: () => deps.collider?.() ?? null, origin: () => originOf(y),
    });
    yards.set(key, y);
    return y;
  }

  /** THE YARDS BROUGHT IN LINE with the town: each home's pieces stood in its pixel (again where the town's answer
   *  changed, or the world recentred), a pixel gone taken down with its yards. */
  function sync() {
    const live = new Set();
    for (const [pk, p] of deps.built?.() ?? []) {
      if (!p?.homeTown || !p.homeFrames) continue;
      ensure(p.homeTown);
      const town = towns.get(p.homeTown);
      for (const [bk, frame] of p.homeFrames) {
        const home = deps.homes?.homeAt?.(p.homeTown, bk) ?? null;
        const pieces = town?.byKey.get(bk) ?? null;
        if (!home || (!pieces?.length && !home.own)) continue;   // a yard stands for a home with pieces, or for its owner
        const key = `${pk}:${bk}`;
        live.add(key);
        const y = yards.get(key) ?? makeYard(key, p, bk, frame);
        const t = deps.translation(p.px, p.py);
        const moved = t[0] !== y.t[0] || t[1] !== y.t[1] || t[2] !== y.t[2];
        const sig = pieces ? JSON.stringify(pieces) : '';
        if (moved || (sig !== y.sig && !(cur?.yard === y && busyWriting()))) {
          y.t = [...t];
          y.sig = sig;
          y.pool.set(pieces ?? y.pool.list());
        }
      }
    }
    for (const [key, y] of yards) if (!live.has(key)) { y.pool.destroyAll(); yards.delete(key); }
  }
  const busyWriting = () => !!tool.flying() || !!tool.panelOpen();
  /** A yard's pixel's climate swaps (its texRemap), or none. */
  const remapOf = (y) => deps.built?.()?.get?.(`${y.px},${y.py}`)?.texRemap ?? null;

  /** THE OWNER'S YARD the player stands on (or near), in this frame - or null. */
  function ownYardHere() {
    const feet = deps.feet?.();
    if (!feet || !deps.outside?.()) return null;
    for (const y of yards.values()) {
      if (!deps.homes?.homeAt?.(y.mapId, y.bk)?.own) continue;
      const o = originOf(y);
      if (yardHolds(y.lot, o, feet, YARD_NEAR)) {
        const others = [];
        const p = deps.built?.()?.get?.(`${y.px},${y.py}`);
        for (const [bk, f] of p?.homeFrames ?? []) {
          if (bk === y.bk) continue;
          others.push([f.box[0] - y.frame.at[0], f.box[2] - y.frame.at[2], f.box[3] - y.frame.at[0], f.box[5] - y.frame.at[2]]);
        }
        return { yard: y, others };
      }
    }
    return null;
  }

  // THE DECORATOR OUTSIDE: the room's own tool over the yard the owner stands on - its pool the yard's, its writes the
  // yard's (`yard` on the service), a piece refused off the lot, the lot's edge marked while a piece is placed
  const pool = {
    put: (p) => { cur?.yard.pool.put(p); keep(); },
    remove: (id) => { cur?.yard.pool.remove(id); keep(); },
    list: () => cur?.yard.pool.list() ?? [],
    size: () => cur?.yard.pool.size() ?? 0,
    holdsAny: () => false, ownOf: () => null, keepOwn() {}, takeOwn: () => null, ownIds: () => [],
  };
  /** A write the owner made stands in the town's answer too, so the next read of it does not stand the old yard. */
  function keep() {
    const y = cur?.yard;
    if (!y) return;
    const town = towns.get(y.mapId);
    const list = y.pool.list();
    if (town) town.byKey.set(y.bk, list);
    y.sig = JSON.stringify(list);
  }
  const homeDecor = deps.api ? {
    place: (a) => deps.api.place({ ...a, yard: true }),
    move: (a) => deps.api.move(a),
    remove: (a) => deps.api.remove(a),
    hidden: async () => ({ ok: false, error: 'bad-decor' }),
  } : null;
  const collider = {
    raycastHit: (o, d, m, f = null) => deps.collider?.()?.surfaceHit?.(o, d, m, f) ?? deps.collider?.()?.raycastHit?.(o, d, m, f) ?? null,
  };
  const tool = createDecorTool({
    doc: deps.doc ?? null, win: deps.win ?? null, canvas: deps.canvas ?? null, touch: !!deps.touch, renderer: deps.renderer, pool, names: new Map(),
    room: () => (cur ? { kind: 'home', yard: true, where: 'Your yard', mapId: cur.yard.mapId, buildingKey: cur.yard.bk } : null),
    scanDeps: () => deps.scanDeps(),
    base: () => null,
    getGpuMesh: (id) => deps.meshes.getGpuMesh(id), cpuModels: deps.meshes.cpuModels, getTexture: deps.getTexture, uploadRecord: deps.uploadRecord, iconUrl: deps.iconUrl,
    collider: () => collider, origin: () => (cur ? originOf(cur.yard) : [0, 0, 0]), eye: () => deps.eye?.() ?? [0, 0, 0],
    stick: () => deps.stick?.() ?? null, actionOf: (e) => deps.actionOf?.(e) ?? null,
    locked: () => !!deps.locked?.(), cursorOff: () => deps.cursorOff?.(),
    wallet: () => deps.wallet(cur ? deps.regionOf?.(cur.yard) ?? 0 : 0), homeDecor, character: () => deps.character?.() ?? null,
    realm: () => deps.realm?.() ?? null,
    pack: () => [], identity: () => null, furnishings: () => [], packHas: () => false, packTake: () => null, packGive() {},
    visit: () => (cur ? `${cur.yard.mapId}:${cur.yard.bk}` : null),
    openSlot: (o) => deps.openSlot?.(o), closeSlot: () => {},
    say: (l) => deps.say?.(l), refusal: (w) => deps.refusal?.(w) ?? null, now,
    // HOME-YARD: the lot - a piece off it refused, its edge marked
    placeOk: (piece, foot) => (cur ? yardWhyNot(piece.pos, cur.yard.lot, cur.others, foot) : YARD_OFF_LOT),
    lot: () => (cur ? yardLotQuads(cur.yard.lot, originOf(cur.yard)) : []),
    yardCap: DECOR_YARD_CAP,
    // HOME-LOOK: the house's outside, painted from the yard's panel
    look: () => (cur && deps.look ? lookDoor(cur.yard) : null),
  });

  /** HOME-LOOK (AUDIT): how many styles a roof's or a door's family holds in a climate (in the season's archive) - asked
   *  once each, null until it answers (or when it cannot: the painter offers its styles all the same). */
  const lookCounts = new Map();
  function lookRecordsOf(part, climate) {
    const season = deps.look?.season?.() ?? 0;
    const k = `${part}:${climate}:${season}`;
    if (!lookCounts.has(k)) {
      lookCounts.set(k, null);
      homeLookRecords(part, climate, season, deps.getTexture).then((n) => lookCounts.set(k, n > 0 ? n : null), () => lookCounts.delete(k));
    }
    return lookCounts.get(k) ?? null;
  }
  /** HOME-LOOK: THE PAINTER'S DOOR for the owner's house - its look as the town knows it, a look tried on it (the owner's
   *  own screen), and a look written. */
  function lookDoor(y) {
    const home = deps.homes?.homeAt?.(y.mapId, y.bk) ?? null;
    return {
      current: home?.look ?? null,
      season: deps.look.season?.() ?? 0,
      records: (part, climate) => lookRecordsOf(part, climate),
      preview: (look) => deps.look.preview(y.mapId, y.bk, look),
      commit: async (look) => {
        const r = await deps.homes.setLook(y.mapId, y.bk, look);
        deps.look.preview(y.mapId, y.bk, undefined);
        return r;
      },
    };
  }

  /**
   * THE HOST'S FRAME outdoors: the yards brought in line every YARD_SYNC_S, the owner's yard found under their feet, and
   * the decorator's own frame over it.
   * @param {{ dt: number, cam: any, overlayUp: boolean }} f
   */
  function frame({ dt, cam, overlayUp }) {
    syncIn -= dt > 0 ? dt : 0;
    // AUDIT: the world recentred - every yard stood again this frame, never half a second in the old place
    if (syncIn > 0) for (const y of yards.values()) { const t = deps.translation(y.px, y.py); if (t[0] !== y.t[0] || t[1] !== y.t[1] || t[2] !== y.t[2]) { syncIn = 0; break; } }
    if (syncIn <= 0) { syncIn = YARD_SYNC_S; sync(); }
    if (!tool.flying() && !tool.panelOpen()) cur = ownYardHere();   // the yard is held while the decorator is up
    else if (cur && yards.get(cur.yard.key) !== cur.yard) {
      // AUDIT: its pixel was built again under the open decorator (a painted home leaving the merge, a season) - the
      // decorator follows the yard stood again in its place, never writing into the one taken down
      const again = yards.get(cur.yard.key) ?? null;
      if (again) cur = { ...cur, yard: again }; else { tool.close(); cur = null; }
    }
    tool.frame({ dt, cam, overlayUp, interior: !!cur });
  }

  return {
    frame,
    /** The yards' models and the piece being placed, in the world's mesh pass. */
    /** AUDIT: with their pixel's climate swaps, as the town's own copies of the same models are drawn - and only the
     *  yards within YARD_DRAW_M of the eye (a town of full yards is thousands of pieces). */
    draw(r = deps.renderer) {
      let n = 0;
      const eye = deps.eye?.() ?? null;
      for (const y of yards.values()) {
        const o = originOf(y);
        if (eye && y !== cur?.yard && Math.hypot(o[0] - eye[0], o[2] - eye[2]) > YARD_DRAW_M) continue;
        n += y.pool.draw(r, remapOf(y));
      }
      tool.draw(r, cur ? remapOf(cur.yard) : null);
      return n;
    },
    /** The yards' flats and the flat being placed, for the world's billboard pass. */
    batches: () => [...[...yards.values()].flatMap((y) => y.pool.batches()), ...tool.batches()],
    /** The lot's edge while a piece is placed, on the world's decal pass. */
    drawDecals: (r = deps.renderer) => tool.drawMounts(r),
    drawPreview: () => tool.drawPreview(null),
    cameraOverride: (c) => tool.cameraOverride(c),
    flying: () => tool.flying(),
    panelOpen: () => tool.panelOpen(),
    /** The yards standing (the pins' window). */
    yards: () => [...yards.values()],
    here: () => cur,
    tool: () => tool,
    destroy() { for (const y of yards.values()) y.pool.destroyAll(); yards.clear(); tool.destroy(); },
  };
}
