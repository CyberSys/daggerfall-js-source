// @ts-check
// HARBOUR-BOOK (2026-10-04, from the field: the port towns' new docks "missing" for some players) - THE HARBOURS FOUND
// NEAR THE PLAYER, ONE BOOK FOR THE QUAYS AND THE SEA. SHIP-LIFE's harbours (shipLife.js findHarbour) were the naval
// host's own Map, sounded in its frame alone - and that frame runs only while Naval Combat and Come Sail Away do, so a
// player with either off stood no quay in any port. A port's quays are its town's, not the sea fight's: the harbours are
// kept here, the world host sounds them every exterior frame whatever runs on the water, and the quays
// (scenes/quayPool.js) and the naval host (its moored ships, its docking, its errands) read the same book.
//
// ITS LIFE (navalHost.js harbourFrame's, moved whole): the port town within a pixel of the player (`harbourNear` - its
// key, its name, its footprint in the scene now and whether every pixel the sounding reads is built) is sounded once
// that ground is built (AUDIT HOLDINGS O1: a pixel not built reads as land); a port that gave no harbour is sounded again
// HARBOUR_RETRY_S later (AUDIT SHIP-LIFE B7); the berths move with the floating origin (`offsetAll`), and the book is
// emptied at a transition, a jump and a load (`clear`) - found again where the world is next. A naval host made without
// a book (its tests) keeps one of its own and steps it in its frame, as before.
//
// Not a DFU member. Ledger A (QUAYS).
import { findHarbour, offsetHarbour } from './shipLife.js';

/** AUDIT SHIP-LIFE B7: a port whose shore gave no harbour is sounded again after this (s) - the terrain streams in
 *  nearest-first, and a harbour sounded on arrival met unbuilt water. */
export const HARBOUR_RETRY_S = 10;

/**
 * @param {{
 *   harbourNear: () => ({ key: string, name?: string|null, rect: { minX: number, maxX: number, minZ: number, maxZ: number },
 *     ready?: () => boolean } | null),
 *   isWater: (x: number, z: number, hull: number) => boolean,
 * }} deps
 */
export function createHarbourBook(deps) {
  /** key -> { key, name, harbour (findHarbour's, or null: a port with no shore to berth at), at (when it was sounded) } */
  const book = new Map();

  /** Sound the port near the player: once its ground is built, and again HARBOUR_RETRY_S after a sounding that found
   *  no harbour. `clock` in seconds. */
  function step(clock) {
    const near = deps.harbourNear() ?? null;
    if (!near) return;
    const sound = () => findHarbour({ rect: near.rect, isWater: (x, z, h) => deps.isWater(x, z, h) });
    const h = book.get(near.key);
    if (!h) { if (near.ready?.() !== false) book.set(near.key, { key: near.key, name: near.name ?? null, harbour: sound(), at: clock }); }
    else if (!h.harbour && clock - h.at >= HARBOUR_RETRY_S && near.ready?.() !== false) { h.harbour = sound(); h.at = clock; }
  }
  /** The world moved (the floating origin): every harbour's berths, approaches and mouth with it, in place. */
  function offsetAll(o) { for (const h of book.values()) offsetHarbour(h.harbour, o); }
  /** A transition, a jump, a load: every harbour forgotten, to be sounded again where the world is next. */
  function clear() { book.clear(); }
  /** The harbours with berths, for the quays - `[{ key, name, harbour }]`. */
  function list() {
    const out = [];
    for (const h of book.values()) if (h.harbour?.berths?.length) out.push({ key: h.key, name: h.name ?? null, harbour: h.harbour });
    return out;
  }
  return { step, offsetAll, clear, list, get: (key) => book.get(key), values: () => book.values() };
}
