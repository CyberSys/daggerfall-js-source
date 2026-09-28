// @ts-check
// GATE-CLEAR (2026-09-28, Mac: "the gate can spawn inside the rock geometry from world of daggerfall"; the field, on
// Discord: "gate under the rock didnt go away stayed there") - World of Daggerfall's pieces keep off the Oblivion Gate.
//
// The gate's site is the clock's and the map files' (net/gateLaw.js rolls it; systems/gateSite.js keeps it off every
// location's neighbourhood and every spawned dungeon), and World of Daggerfall stands a site on 114,087 of the pixels left
// - rock fields ~500 m across, mountains ~1.9 km, every model with its own collider (bible 03-World/World-Of-Daggerfall.md).
// Nothing kept the two apart, so a day's gate could rise inside a boulder: its fire out of reach of the press and the step
// (the rock's collider takes the ray and the body first), nobody fought, and the gate stood its whole schedule, sealed
// hours and all, in a rock field. Over the shipped lists 3.5% of the spots a gate may take on a pixel the mod names stand
// within GATE_CLEAR_M of a piece's own position - a floor: a boulder's mesh reaches further than its centre.
//
// THE GATE DOES NOT MOVE. Its spot is a function of the day and the map files alone, so every client rolls the same one
// (GATE-SEEN); the mod's sites land with region packs fetched at their own pace. So the ROCK yields, ROADS-CLEAR's shape
// (world/roadClearance.js): a camp, fort, shrine, ruin, cave or nature spot whose objects reach the clearing is refused
// whole at its pick (a `continue`, so a later instance may take the pixel), and any other piece whose own mesh box
// reaches it is not stood - no mesh, no collider. The gate is online's alone and online the mod is the room's, forced on
// (systems/onlineLane.js), so every client that sees a gate stands the same rock and refuses the same pieces.
//
// Everything here is in METRES, PIXEL-LOCAL to the pixel the caller names: x east, z north, (0, 0) its south-west corner
// - the frame world/streamingWorld.js pixelTranslation, the WoD placements and the gate's spot share (north is the row
// ABOVE: py - 1). Pure; a leaf apart from the two constants' homes.
//
// Not a DFU member: a port departure from World of Daggerfall 1:1, recorded on its page. Ledger A (WB).
import { PIXEL_M } from '../net/gateLaw.js';
import { wodPiecewise, WOD_SITE_OBJECT_RADIUS_M } from './roadClearance.js';

/** The clearing about the gate's foot, metres: its plinth and horns (world/gateModel.js PLINTH_R 8.2, the horns' roots
 *  to 8.8), the way home's landing (world/gateArena.js GATE_LANDING_M 10), the Sigil Broker's post (~12.4 m off -
 *  scenes/sigilBrokerPool.js BROKER_SPOT), and the room to walk round them all: three plinths' radii. */
export const GATE_CLEAR_M = 24;
/** A flat's base is a point; it stands this much further off (a bush, a lamp - ROADS-CLEAR's 2 m). */
export const WOD_FLAT_GATE_CLEAR_M = 2;

/**
 * The clearing a gate site keeps (systems/gateSite.js findGateSite's answer): its pixel and its spot in it - null for no
 * site. `key` names it: a built pixel remembers the key it was built against.
 * @param {{day:number, px:number, py:number, spot:number[]}|null} site
 */
export function gateClearFor(site) {
  if (!site || !Number.isSafeInteger(site.px) || !Number.isSafeInteger(site.py) || !Array.isArray(site.spot)) return null;
  const [x, z] = site.spot;
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return Object.freeze({ key: `${site.day}:${site.px},${site.py}`, day: site.day, px: site.px, py: site.py, x, z });
}

/** The gate's foot in pixel (px, py)'s own frame: its pixel's corner from this one's (east by x, north by the rows
 *  above), plus its spot. */
export const gatePointIn = (clear, px, py) => [(clear.px - px) * PIXEL_M + clear.x, (py - clear.py) * PIXEL_M + clear.z];

/**
 * Does the box [x0,x1] x [z0,z1] - pixel-local to (px, py), metres, free to reach past its edges - come within the
 * clearing, and `margin` more? The box's nearest point to the gate's foot, measured on the ground.
 * @param {{px:number, py:number, x:number, z:number}|null} clear null answers false (no gate to keep off)
 */
export function boxNearGate(clear, px, py, x0, z0, x1, z1, margin = 0) {
  if (!clear) return false;
  const [gx, gz] = gatePointIn(clear, px, py);
  const dx = Math.max(x0 - gx, 0, gx - x1), dz = Math.max(z0 - gz, 0, gz - z1);
  const r = GATE_CLEAR_M + margin;
  return dx * dx + dz * dz <= r * r;
}

/** A point with a margin, pixel-local: boxNearGate over it. */
export const pointNearGate = (clear, px, py, x, z, margin = 0) => boxNearGate(clear, px, py, x, z, x, z, margin);

/**
 * Is a World of Daggerfall site (a pick: its prefab and its rect in terrain tiles) clear of the gate? The whole-site kinds
 * alone - a rock field or a mountain answers piece by piece, with its meshes, at placement (roadClearance.js
 * wodPiecewise). Each object at the placement's own position (tile * 6.4 m + its offset), grown by the site margin -
 * roadClearance.js wodSiteClear's question, asked of the gate.
 */
export function wodSiteOffGate(clear, px, py, prefabName, prefab, rect, tileMetres = 6.4) {
  if (!clear || wodPiecewise(prefabName)) return true;
  for (const o of prefab?.obj ?? []) {
    if (pointNearGate(clear, px, py, rect.x * tileMetres + o.pos.x, rect.y * tileMetres + o.pos.z, WOD_SITE_OBJECT_RADIUS_M)) return false;
  }
  return true;
}

/**
 * The pick's gate test for one pixel's build, beside the road's (`&&` after it, so a site it sees has passed the road):
 * a site that reaches the clearing is refused and the ledger says the gate cost the pixel something (`refused`); a whole
 * site it lets stand leaves its objects in the ledger's `reach`, so the sweep can ask them of the next gate.
 * @param {ReturnType<typeof gateClearFor>} clear
 * @param {number} px @param {number} py
 * @param {{refused:boolean, reach:number[]}} ledger
 */
export function gateSiteTest(clear, px, py, ledger, tileMetres = 6.4) {
  return (prefabName, prefab, rect) => {
    if (!wodSiteOffGate(clear, px, py, prefabName, prefab, rect, tileMetres)) { ledger.refused = true; return false; }
    if (!wodPiecewise(prefabName)) {
      for (const o of prefab?.obj ?? []) {
        const x = rect.x * tileMetres + o.pos.x, z = rect.y * tileMetres + o.pos.z;
        ledger.reach.push(x, z, x, z, WOD_SITE_OBJECT_RADIUS_M);
      }
    }
    return true;
  };
}

/** The reach's stride: each stood thing as [x0, z0, x1, z1, margin], metres, pixel-local. */
export const GATE_REACH_STRIDE = 5;

/**
 * The sweep's question of a built pixel: does anything it stands - its reach, a stride per piece: a model's mesh box,
 * a flat's base with its margin, a whole site's object with the site's - come within `clear`? Exactly the questions the
 * pick and the placement ask, so a pixel is built again when, and only when, a build now would stand it otherwise.
 * @param {ArrayLike<number>|null} reach
 */
export function reachNearGate(reach, clear, px, py) {
  if (!clear || !reach?.length) return false;
  for (let i = 0; i + GATE_REACH_STRIDE <= reach.length; i += GATE_REACH_STRIDE) {
    if (boxNearGate(clear, px, py, reach[i], reach[i + 1], reach[i + 2], reach[i + 3], reach[i + 4])) return true;
  }
  return false;
}

/**
 * THE SWEEP (the streamer's, scenes/world.js sweepGateClear - the late WoD sweep's shape): which built pixels are built
 * again when the clearing turns. The gate the clock is about turns at the last one's collapse (net/gateLaw.js gateAt),
 * and every pixel built against another clearing is asked once: built again if the old clearing cost it a site or a
 * piece (`gateRefused` - the rock comes back), or if anything it stands reaches the new one (the rock goes); else marked
 * current, untouched. A pixel still building at the turn read the clearing at its pick, so it is asked as it publishes
 * (`published`) if the sweep has moved on since. Pure: the host owns the tearing down and the queue.
 */
export function createGateClearSweep() {
  let swept = null;   // the clearing's key the built pixels were last asked against
  const due = new Set();
  return {
    /** A pixel `k` published, built against `key` - asked again if the sweep has moved on since its build began. */
    published(k, key) { if ((key ?? null) !== swept) due.add(k); },
    /**
     * One sweep, between builds. `clear` the clearing now (gateClearFor's, or null); `built` the built pixels by key
     * ({px, py, gateClearKey, gateRefused, wodReach}). Answers the pixels to build again; the others asked are marked
     * current.
     * @param {ReturnType<typeof gateClearFor>} clear
     * @param {Map<string, any>} built
     */
    step(clear, built) {
      const key = clear?.key ?? null;
      if (key !== swept) { swept = key; for (const k of built.keys()) due.add(k); }
      const again = [];
      for (const k of due) {
        const p = built.get(k);
        due.delete(k);
        if (!p) continue;   // torn down since: it is built fresh, on the clearing its build reads
        if ((p.gateClearKey ?? null) === key) continue;
        if (p.gateRefused || reachNearGate(p.wodReach, clear, p.px, p.py)) again.push(p);
        else p.gateClearKey = key;   // the old clearing cost it nothing, and nothing it stands reaches the new one
      }
      return again;
    },
    /** For the tests: the key last swept to, and how many pixels wait to be asked. */
    state: () => ({ swept, due: due.size }),
  };
}
