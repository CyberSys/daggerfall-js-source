// @ts-check
// PORTAL1 - THE PORTALS A HOST STANDS. The law is systems/portalStone.js; this is the ground, the vortex and the step.
//
//  - THE FRAME: every portal is kept in the WORLD frame (`native` - the wire's and the camps' [x, y, z]) and put into
//    the scene's each frame (`toScene`), so the floating origin's recenter moves nothing here and a portal far behind
//    a teleport is still where it was.
//  - THE LOOK: COMPANION-PORTAL's vortex (scenes/portalFx.js), this pool's own set, FIXED where it opened and HELD for
//    the portal's whole time (`holdMs`), so it tears open, stands, and seals as its time runs out.
//  - THE STEP: `tick(feet)` asks every portal whether the feet stepped in this frame (portalStepIn: outside, then
//    inside) and hands the first to `onEnter` - the host's arrival. A portal that opens on top of someone takes nobody.
//  - ONLINE: `wireRecord` is my own portal while I stand near it (PORTAL_SAY_REACH - once I have stepped through, the
//    room I arrive in is told nothing of a portal far behind me); `applyOwner` lands a peer's, which is KEPT until its
//    own time runs out - the owner stepping through it, or walking off, does not close it for the rest.

import { createPortalSet, PORTAL_MS } from './portalFx.js';
import { PORTAL_OPEN_MS, portalWire, validPortalRecord, portalStepIn } from '../systems/portalStone.js';

/** How near my own portal I must stand for my frame to say it (metres, the world frame's). */
export const PORTAL_SAY_REACH = 256;

/**
 * deps = { renderer, audio, now() ms, toScene(native) -> scene [x, y, z], toWire(scene) -> native [x, y, z],
 *          destOf(x, y) -> { pixel: { x, y }, name } for a map pixel with a location (null: none - the record refused),
 *          onEnter(gate) - the host's arrival }
 * @param {{ renderer?: any, audio?: any, now?: () => number, toScene?: (p: number[]) => number[], toWire?: (p: number[]) => number[],
 *           destOf?: (x: number, y: number) => ({ pixel: { x: number, y: number }, name: string } | null), onEnter?: (gate: any) => void }} [deps]
 */
export function createPortalGates({
  renderer = null, audio = null, now = () => performance.now(),
  toScene = (p) => p, toWire = (p) => p, destOf = () => null, onEnter = () => {},
} = {}) {
  const fx = createPortalSet({ renderer, audio, now });
  /** @type {{ id: string, owner: string | null, native: number[], dest: { pixel: { x: number, y: number }, name: string }, until: number, fx: any, was: boolean | null }[]} */
  const gates = [];
  let _seq = 0;
  const holdFor = (ms) => Math.max(0, ms - PORTAL_MS.open - PORTAL_MS.close);

  function stand(g) { g.fx = fx.open(toScene(g.native), { holdMs: holdFor(g.until - now()), fixed: true }); }
  function drop(g) {
    if (g.fx) fx.remove(g.fx);
    g.fx = null;
    const i = gates.indexOf(g);
    if (i >= 0) gates.splice(i, 1);
  }

  /** MINE: a portal opened at `pos` (the scene's) to `dest` - one of mine at a time. */
  function open(pos, dest) {
    for (const g of gates.filter((x) => x.owner === null)) drop(g);
    const g = { id: `${Math.floor(now()).toString(36)}${(_seq++).toString(36)}`, owner: null, native: toWire(pos), dest, until: now() + PORTAL_OPEN_MS, fx: null, was: null };
    gates.push(g);
    stand(g);
    return g;
  }
  /** My portal still standing, or null. */
  const mine = () => gates.find((g) => g.owner === null && now() < g.until) ?? null;

  /** A peer's word: its portal (one an owner), refused whole by validPortalRecord or a destination with no place. The
   *  same portal said again keeps its look; another replaces it. Answers whether it stands. */
  function applyOwner(owner, raw) {
    if (owner == null) return false;
    const r = validPortalRecord(raw);
    const dest = r ? destOf(r.d[0], r.d[1]) : null;
    if (!r || !dest) return false;
    const old = gates.find((g) => g.owner === owner);
    if (old && old.id === r.i) { old.until = now() + r.r; return true; }
    if (old) drop(old);
    const g = { id: r.i, owner, native: r.p, dest, until: now() + r.r, fx: null, was: null };
    gates.push(g);
    stand(g);
    return true;
  }

  /** One frame: the portals run out, the vortex stands in this frame, and the feet (the scene's, or null - not on foot)
   *  step in. `canEnter` false (the host busy) lets nobody through. Answers the portal entered, or null. */
  function tick(feet, { canEnter = true } = {}) {
    const t = now();
    for (let i = gates.length - 1; i >= 0; i--) {
      const g = gates[i];
      if (t >= g.until) { drop(g); continue; }
      if (g.fx) { const at = toScene(g.native); g.fx.feet[0] = at[0]; g.fx.feet[1] = at[1] - 0.05; g.fx.feet[2] = at[2]; }
    }
    fx.tick(null);
    let entered = null;
    for (const g of gates) {
      if (!feet) { g.was = null; continue; }
      const step = portalStepIn(g.was, feet, toScene(g.native));
      g.was = step.inside;
      if (!entered && step.entered && canEnter && t < g.until - PORTAL_MS.close) entered = g;
    }
    if (entered) onEnter(entered);
    return entered;
  }

  /** My portal for my foes frame, while I stand within PORTAL_SAY_REACH of it (`near` my feet, the world frame's), or null. */
  function wireRecord(near) {
    const g = mine();
    if (!g || !near || Math.hypot(near[0] - g.native[0], near[2] - g.native[2]) > PORTAL_SAY_REACH) return null;
    return portalWire(g, now());
  }

  return {
    open, mine, applyOwner, tick, wireRecord,
    /** The vortexes, drawn with the street's flats. */
    batches: () => fx.batches(),
    /** Every portal, for the tests and the hover. */
    get gates() { return gates; },
    /** A teardown: every portal and its batch gone. */
    clear() { fx.clear(); for (const g of gates) g.fx = null; gates.length = 0; },
  };
}
