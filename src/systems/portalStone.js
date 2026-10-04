// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PORTAL1 (2026-10-04, the owner: "So with the removal of fast travel, I want to implement a new item available at all
// shops, this should cost weykar shards (from dismantling gear with rarity). These should always be readily available.
// When using this item, it opens a portal allowing you to traverse to anywhere on the map. This is a one use item that
// stays open for a short time, allowing multiple players to traverse"): THE PORTAL STONE.
//
//   - THE STONE (systems/gateSpoils.js, template 572 beside the Welkynd Shard's 571): bound, stacking with its own kind.
//   - THE COUNTER: every shop's keeper (shopStock.js isShop - the nine kinds) sells one for PORTAL_STONE_SHARDS Welkynd
//     Shards, from a row on the keeper's own popup (ui/merchantServiceWindow.js, ui/merchantRepairWindow.js, and the
//     Enhanced Plus panel) - never from a shelf: a shelf is the gold trade's, and nothing here is gold. ALWAYS IN STOCK:
//     nothing is kept, so every sale mints a fresh stone.
//   - THE USE: the pack's Use (or a hotbar press) hands the stone to the host's `openPortal` door - the open world's
//     alone (scenes/world.js; a building, a dungeon and the standalone street say PORTAL_TEXT.notHere). The travel map
//     opens in teleport mode; a place picked there spends ONE stone and tears a portal open PORTAL_AHEAD in front of the
//     player, for PORTAL_OPEN_MS (scenes/portalGates.js). A map closed without a pick spends nothing.
//   - THE PORTAL: anyone who WALKS INTO it - the opener, and online every player near it - arrives at the place the way
//     the Mages Guild's teleport arrives (world.js teleportTo: free, at once). A portal that opens on top of someone
//     takes nobody: only a step from outside to inside is an entry (portalStepIn).
//   - ONLINE: the opener's foes frame carries it (`pg`, portalWire) on every full frame while it stands - the camps'
//     and the duel ring's road, so the relay reads none of it and needs no new version. A peer keeps its own copy until
//     the time the record said was left, so the portal outlives its opener stepping through it. Its destination is
//     named off the receiver's own map; a pixel with no location refuses the record.
//
// Not a DFU member - Ledger A.
// ═══════════════════════════════════════════════════════════════════
import { PORTAL_STONE, PORTAL_STONE_TEMPLATE, portalStones, isPortalStone } from './gateSpoils.js';
import { shardsHeld, spendShards, shardsText } from './reforge.js';
import { addItem } from './inventory.js';
import { registerItemUseHandler } from './itemTemplates.js';
import { POSE_BOUND, POSE_Y_BOUND } from '../net/wire.js';
import { MAX_MAP_PIXEL_X, MAX_MAP_PIXEL_Y } from '../formats/mapsTables.js';

export { PORTAL_STONE, PORTAL_STONE_TEMPLATE, isPortalStone };

/** What a stone costs at the counter, in Welkynd Shards (a Magic piece salvages into 1, a Rare 3, a Legendary 8). */
export const PORTAL_STONE_SHARDS = 5;
/** How long a portal stands, from the tear to the seal (ms). */
export const PORTAL_OPEN_MS = 30000;
/** How far in front of its opener a portal opens (metres) - out of reach, so the opener walks in like anyone. */
export const PORTAL_AHEAD = 2;
/** Inside a portal: this near its centre across the ground, and this near its foot in height (metres). */
export const PORTAL_REACH = 0.9;
export const PORTAL_REACH_Y = 2;
/** The portal's id on the wire: a short token. */
const ID_RE = /^[A-Za-z0-9_-]{1,24}$/;

export const PORTAL_TEXT = Object.freeze({
  row: `Portal Stone (${PORTAL_STONE_SHARDS} shards)`,
  ask: (held) => `Buy a ${PORTAL_STONE.name} for ${shardsText(PORTAL_STONE_SHARDS)}? You carry ${held}.`,
  bought: `You buy a ${PORTAL_STONE.name}.`,
  shards: (held) => `A ${PORTAL_STONE.name} costs ${shardsText(PORTAL_STONE_SHARDS)}. You carry ${held}.`,
  notHere: 'A portal can only be opened under the open sky.',
  busy: 'You cannot open a portal right now.',
  enemies: 'You cannot open a portal with enemies nearby.',
  standing: 'Your portal is still open.',
  noMap: 'You cannot see the map to choose a destination.',
  gone: `The ${PORTAL_STONE.name} is no longer in your pack.`,
  opened: (name) => `A portal to ${name} tears open. Step through before it closes.`,
});

/** The stone's card lines (systems/itemInfo.js builds the name and the weight around them). */
export const portalStoneLines = () => [
  'Opens a portal to any place on the map.',
  `It stands ${Math.round(PORTAL_OPEN_MS / 1000)} seconds, for anyone to step through.`,
];

// ---- the counter ---------------------------------------------------
/** Why a stone may not be bought, or null: 'shards' (fewer than the price, unlocked), 'heavy' (the host's carry gate -
 *  `canCarry(item, rest)`, the pack as the shards leave it - says no).
 *  @param {any[]} items @param {{ canCarry?: (item: any, rest: any[]) => boolean }} [at] */
export function portalStoneRefusal(items, { canCarry = () => true } = {}) {
  if (shardsHeld(items) < PORTAL_STONE_SHARDS) return 'shards';
  if (!canCarry(portalStones(1), packAfterShards(items))) return 'heavy';
  return null;
}
/** The pack as PORTAL_STONE_SHARDS shards leave it (spendShards' own order), for the carry gate - nothing taken. */
function packAfterShards(items) {
  const rest = (Array.isArray(items) ? items : []).map((it) => ({ ...it }));
  spendShards(rest, PORTAL_STONE_SHARDS);
  return rest;
}
/** THE SALE: the shards out of the pack (`items`, the list itself), a fresh stone in (onto the pack's unlocked stack) -
 *  all of it or none of it. Answers `{ ok: true, item }` or `{ ok: false, reason }` (portalStoneRefusal's).
 *  @param {any[]} items @param {{ canCarry?: (item: any, rest: any[]) => boolean }} [at] */
export function buyPortalStone(items, { canCarry = () => true } = {}) {
  if (!Array.isArray(items)) return { ok: false, reason: 'shards' };
  const why = portalStoneRefusal(items, { canCarry });
  if (why) return { ok: false, reason: why };
  spendShards(items, PORTAL_STONE_SHARDS);
  const item = portalStones(1);
  addItem(items, item);
  return { ok: true, item };
}

// ---- the use -------------------------------------------------------
/** One stone off its stack, or the record off the list. Answers whether one was there to spend. */
export function spendPortalStone(item, list) {
  if (!isPortalStone(item) || !Array.isArray(list) || !list.includes(item)) return false;
  if ((item.stackCount ?? 1) > 1) item.stackCount -= 1;
  else list.splice(list.indexOf(item), 1);
  return true;
}
/** The pack's Use: the stone handed to the host's door (useItem.js's registered arm; the readers route 'openPortal'). */
registerItemUseHandler(PORTAL_STONE_TEMPLATE, (item) => ({ kind: 'openPortal', item }));

// ---- the portal ----------------------------------------------------
/** Where a portal opens: PORTAL_AHEAD along the opener's facing (the camera's forward, [sin yaw, cos yaw] - world.js
 *  playerForward; survival/camp.js campSpot's own), on the ground a downward `probe(origin, dir, max)` finds there (a
 *  metre over the feet, two under), else at the feet's height. */
export function portalSpot(feet, yaw, probe = null) {
  const x = feet[0] + Math.sin(yaw) * PORTAL_AHEAD, z = feet[2] + Math.cos(yaw) * PORTAL_AHEAD;
  const top = feet[1] + 1;
  const d = probe ? probe([x, top, z], [0, -1, 0], 3) : null;
  return [x, Number.isFinite(d) && d <= 3 ? top - d : feet[1], z];
}
/** Whether feet stand inside a portal at `at` (both in one frame). */
export function insidePortal(feet, at) {
  if (!feet || !at) return false;
  return Math.hypot(feet[0] - at[0], feet[2] - at[2]) <= PORTAL_REACH && Math.abs(feet[1] - at[1]) <= PORTAL_REACH_Y;
}
/** THE STEP IN: an entry is a step from outside to inside - `was` the last frame's answer (null: never asked, so a
 *  portal that opens on top of someone takes nobody). Answers `{ inside, entered }`. */
export function portalStepIn(was, feet, at) {
  const inside = insidePortal(feet, at);
  return { inside, entered: inside && was === false };
}

// ---- the wire ------------------------------------------------------
const q2 = (v) => Math.round(v * 100) / 100;
/** A portal as its opener says it (`gate.native`, the world frame's [x, y, z] - the camps' frame on the wire): i its id,
 *  p where it stands, d the destination's map pixel [x, y], r the ms it has left. The destination's NAME is never said -
 *  each receiver reads it off its own map. */
export const portalWire = (gate, nowMs = 0) => {
  const p = gate.native;
  return { i: gate.id, p: [q2(p[0]), q2(p[1]), q2(p[2])], d: [gate.dest.pixel.x, gate.dest.pixel.y], r: Math.max(0, Math.round(gate.until - nowMs)) };
};
/** The record projected, or null: a field outside its law refuses the record WHOLE (wire.js's rule). */
export function validPortalRecord(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return null;
  if (typeof r.i !== 'string' || !ID_RE.test(r.i)) return null;
  if (!Array.isArray(r.p) || r.p.length !== 3 || !r.p.every(Number.isFinite)) return null;
  if (Math.abs(r.p[0]) > POSE_BOUND || Math.abs(r.p[2]) > POSE_BOUND || Math.abs(r.p[1]) > POSE_Y_BOUND) return null;
  if (!Array.isArray(r.d) || r.d.length !== 2 || !r.d.every(Number.isInteger)) return null;
  if (r.d[0] < 0 || r.d[0] >= MAX_MAP_PIXEL_X || r.d[1] < 0 || r.d[1] >= MAX_MAP_PIXEL_Y) return null;
  if (!Number.isFinite(r.r) || r.r <= 0 || r.r > PORTAL_OPEN_MS) return null;
  return { i: r.i, p: [r.p[0], r.p[1], r.p[2]], d: [r.d[0], r.d[1]], r: r.r };
}
