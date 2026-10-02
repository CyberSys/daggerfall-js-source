// @ts-check
// GALLEON (2026-10-01, Mac: "ensuring cannon fire shoots from the cannon holes properly"): THE GUN DECK AT WORK - a
// ship's gunport shutters and the guns behind them, as a broadside is laid and fired.
//
// The new galleon (world/galleonModel.js) carries a gun behind each of her ten ports (`Gun<Side><i>`, its frame's +x
// outboard) and a shutter over each (`Gunport<Side><i>`, an Animator on the mod's Door Controller - Opened swings it up
// on its hinge). This is what moves them, for every ship of hers in play - mine, the sea's, another player's:
//
//   LAID: a battery laid (my look at the guns, a captain's run-out - navalAI.js, the tell the helm sees) opens that
//     side's shutters and runs its guns out, their muzzles through the ports; and it stays laid HOLD_S after the last
//     word of it, so a ripple's last gun is not run in under the smoke.
//   FIRED: each gun as its ball leaves (navalShots.js's 'muzzle', its index in the battery - HULL_BUILDS' order, the
//     ports' own) kicks back RECOIL m and is hauled out again over HAUL_S - and a side fired is a side laid.
//   AT REST: the guns run in to load and the shutters close.
//
// It reads nothing but node names and moves nothing but those nodes (the gun's local position along its own +x; the
// shutter's Opened), so a hull without them is left alone. Pure but for those nodes: the clock is the caller's.
// Not a DFU member. Ledger A (GALLEON).
import { GUN } from '../../world/galleonModel.js';

/** The ship's two broadsides, as the nodes spell them. */
export const GUN_DECK_SIDES = Object.freeze({ starboard: 'Starboard', port: 'Port' });
/** A battery stays laid this long (s) after its last word - a lay, a run-out, a gun fired. */
export const HOLD_S = 2.5;
/** Where a gun stands along its own +x (m, from her centreline): run in to load, run out to fire (world/galleonModel.js
 *  GUN's - its muzzle a hair outside her planking). */
export const RUN_IN_X = GUN.runInX;
export const RUN_OUT_X = GUN.runOutX;
/** How fast a gun is run out and in (m/s) - out in about a second, as the run-out's tell (navalAI.js RUN_OUT_S 1.3). */
export const RUN_SPEED = 0.95;
/** A fired gun's kick back (m), how long the kick takes (s), and how long the crew take to haul it out again (s). */
export const RECOIL = 0.95;
export const KICK_S = 0.12;
export const HAUL_S = 2.2;

/** A gun's offset inboard of where it stands, `t` s after it fired: the kick back, then hauled out. */
export function recoilAt(t) {
  if (!(t >= 0)) return 0;
  if (t < KICK_S) return RECOIL * (t / KICK_S);
  const u = Math.min(1, (t - KICK_S) / HAUL_S);
  return RECOIL * (1 - u * u * (3 - 2 * u));
}

/**
 * The gun deck for every ship it is shown: `lay(boat, side, now)`, `fired(boat, side, index, now)`, `step(boats, now)`.
 * Each boat's nodes are found once (by name, under its tree) and kept while its tree is the same.
 */
export function createGalleonGunDeck() {
  /** boat -> { sides: { starboard: rig, port: rig } } (rig: { guns: node[], lids: node[], laidUntil, firedAt: number[] }) */
  const rigs = new WeakMap();
  let lastNow = 0;
  function rigOf(boat) {
    if (!boat?.GameObject) return null;
    let r = rigs.get(boat);
    if (r && r.root === boat.GameObject) return r.sides ? r : null;
    const found = { starboard: { guns: [], lids: [], laidUntil: -Infinity, firedAt: [], x: [] }, port: { guns: [], lids: [], laidUntil: -Infinity, firedAt: [], x: [] } };
    for (const n of boat.GameObject.walk()) {
      const m = /^(Gun|Gunport)(Starboard|Port)(\d+)$/.exec(n.name);
      if (!m) continue;
      const side = m[2] === 'Starboard' ? found.starboard : found.port;
      (m[1] === 'Gun' ? side.guns : side.lids)[Number(m[3])] = n;
    }
    const any = found.starboard.guns.length || found.port.guns.length || found.starboard.lids.length || found.port.lids.length;
    r = { root: boat.GameObject, sides: any ? found : null };
    if (any) for (const s of Object.values(found)) { s.firedAt = s.guns.map(() => -Infinity); s.x = s.guns.map((g) => Math.abs(g?.localPosition?.[0] ?? RUN_IN_X)); }
    rigs.set(boat, r);
    return any ? r : null;
  }
  return {
    /** A side laid (or run out) now: its shutters open and its guns run out until HOLD_S past `now`. */
    lay(boat, side, now) {
      const s = rigOf(boat)?.sides?.[side];
      if (s) s.laidUntil = Math.max(s.laidUntil, now + HOLD_S);
    },
    /** A gun of a side fired now (its index in the battery): it kicks back, and the side is laid. */
    fired(boat, side, index, now) {
      const s = rigOf(boat)?.sides?.[side];
      if (!s) return;
      s.laidUntil = Math.max(s.laidUntil, now + HOLD_S);
      if (index >= 0 && index < s.firedAt.length) s.firedAt[index] = now;
    },
    /** Every boat's shutters and guns as `now` stands them. */
    step(boats, now) {
      const dt = Math.max(0, Math.min(0.25, now - lastNow));
      lastNow = now;
      for (const boat of boats) {
        const r = rigOf(boat);
        if (!r) continue;
        for (const [side, s] of Object.entries(r.sides)) {
          const laid = now < s.laidUntil;
          for (const lid of s.lids) {
            const a = lid?.getComponent?.('Animator')?.animator;
            if (a && a.GetBool('Opened') !== laid) a.SetBool('Opened', laid);
          }
          s.guns.forEach((g, i) => {
            if (!g) return;
            const want = laid ? RUN_OUT_X : RUN_IN_X;
            const x = s.x[i];
            s.x[i] = x < want ? Math.min(want, x + RUN_SPEED * dt) : Math.max(want, x - RUN_SPEED * dt);
            const sign = side === 'starboard' ? 1 : -1;
            const at = sign * (s.x[i] - recoilAt(now - s.firedAt[i]));
            if (g.localPosition[0] !== at) g.localPosition = [at, g.localPosition[1], g.localPosition[2]];
          });
        }
      }
    },
    /** A probe's reading: a boat's sides as they stand ({ laid, guns: [x...], open: [bool...] }), or null. */
    read(boat, now = lastNow) {
      const r = rigOf(boat);
      if (!r) return null;
      const out = {};
      for (const [side, s] of Object.entries(r.sides)) out[side] = { laid: now < s.laidUntil, guns: s.guns.map((g) => (g ? Math.abs(g.localPosition[0]) : null)), open: s.lids.map((l) => !!l?.getComponent?.('Animator')?.animator?.GetBool('Opened')) };
      return out;
    },
  };
}
