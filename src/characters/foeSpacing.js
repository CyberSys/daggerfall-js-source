// FOE-SPACING (2026-09-26, SquidKamer on the Discord: "no collision on monsters"; Mac, asked: "Yes, add it").
//
// DFU's foes are CharacterControllers: one that walks into another is stopped by it, so a pack spreads round whatever
// it hunts. The port's foes are not in the collider - nothing stops one at another - so a pack converged on one spot and
// stood there in one heap, every one of them swinging. Once a frame each pool pushes apart every two of its bodies
// whose capsules overlap: softly (each takes half the overlap, at most FOE_SPACING_SPEED a second), through the
// collider (no wall is crossed), and never off an edge (a walker the push would leave with no ground under its centre
// stays where it was - the drop the motor's own fall check refuses, EnemyMotor's FallCheck, characters/enemyMotor.js
// _fallCheck). A departure: DFU's controllers block, the port's pools push.
import { worldAabb } from '../player/activate.js';   // AUDIT TACT C6: an action door's box
import { CAPSULE_HEIGHT, CAPSULE_RADIUS } from '../player/motor.js';
import { FALL_CHECK_DROP } from './enemyMotor.js';

/** How fast a body is pushed out of another, metres a second. */
export const FOE_SPACING_SPEED = 3;
/** Two capsules' centres closer than this overlap. */
export const FOE_SPACING_GAP = 2 * CAPSULE_RADIUS;

/** The default skip: the dead, and a puppet (another client poses it - its owner keeps it apart). */
export const spacingSkips = (f) => !!f?.dead || !!f?.puppet || !f?.ai?.feet;

let _push = new Float64Array(64);
let _live = new Uint8Array(32);
const _was = [0, 0, 0], _from = [0, 0, 0], DOWN = [0, -1, 0];

/** Ground under a walker's centre within the motor's fall reach - the ray the fall check casts ahead, cast where the
 *  body now stands; the collider's analytic floor (terrain) counts, as it does there. */
function supported(collider, ai, feet) {
  const h = ai.height ?? CAPSULE_HEIGHT;
  _from[0] = feet[0]; _from[1] = feet[1] + (ai.centreOffset ?? h / 2); _from[2] = feet[2];
  const reach = h * 0.5 + FALL_CHECK_DROP;
  if (Number.isFinite(collider.raycast?.(_from, DOWN, reach) ?? Infinity)) return true;
  return _from[1] - (collider.heightAt?.(feet[0], feet[2]) ?? -Infinity) <= reach;
}

/** Push a pool's overlapping bodies apart; answers how many moved.
 *  @param foes     the pool's records ({ ai: { feet, height, flies, swims, levitating }, dead, puppet })
 *  @param collider the pool's collider (the bodies' own)
 *  @param dt       the frame the pool hands its foes (0 under a held frame: nothing moves)
 *  @param skip     (f, i) => true for a body that neither pushes nor is pushed */
export function spaceFoes(foes, collider, dt, skip = spacingSkips) {
  const n = foes?.length ?? 0;
  if (n < 2 || !(dt > 0) || !collider?.move) return 0;
  if (_push.length < n * 2) _push = new Float64Array(n * 2);
  if (_live.length < n) _live = new Uint8Array(n);
  let live = 0;
  for (let i = 0; i < n; i++) { _live[i] = skip(foes[i], i) ? 0 : 1; live += _live[i]; }
  if (live < 2) return 0;
  _push.fill(0, 0, n * 2);
  let touched = false;
  for (let i = 0; i < n; i++) {
    if (!_live[i]) continue;
    const a = foes[i].ai.feet, ha = foes[i].ai.height ?? CAPSULE_HEIGHT;
    for (let j = i + 1; j < n; j++) {
      if (!_live[j]) continue;
      const b = foes[j].ai.feet, hb = foes[j].ai.height ?? CAPSULE_HEIGHT;
      if (!(a[1] < b[1] + hb && b[1] < a[1] + ha)) continue;   // one above the other: no contact
      const dx = b[0] - a[0], dz = b[2] - a[2];
      const d2 = dx * dx + dz * dz;
      if (d2 >= FOE_SPACING_GAP * FOE_SPACING_GAP) continue;
      const d = Math.sqrt(d2);
      let ux, uz;
      if (d > 1e-4) { ux = dx / d; uz = dz / d; }
      else { const ang = i * 2.399963229728653 + j; ux = Math.cos(ang); uz = Math.sin(ang); }   // standing in one spot: split them a fixed way
      const share = (FOE_SPACING_GAP - d) / 2;
      _push[i * 2] -= ux * share; _push[i * 2 + 1] -= uz * share;
      _push[j * 2] += ux * share; _push[j * 2 + 1] += uz * share;
      touched = true;
    }
  }
  if (!touched) return 0;
  const cap = FOE_SPACING_SPEED * dt;
  let moved = 0;
  for (let i = 0; i < n; i++) {
    let px = _push[i * 2], pz = _push[i * 2 + 1];
    const len = Math.hypot(px, pz);
    if (!(len > 1e-6)) continue;
    if (len > cap) { px *= cap / len; pz *= cap / len; }
    const ai = foes[i].ai, feet = ai.feet;
    const airborne = !!(ai.flies || ai.swims || ai.levitating);
    _was[0] = feet[0]; _was[1] = feet[1]; _was[2] = feet[2];
    const r = collider.move(feet, px, 0, pz, ai.height ?? CAPSULE_HEIGHT, !airborne);
    if (!airborne && ((r && !r.grounded) || !supported(collider, ai, feet))) { feet[0] = _was[0]; feet[1] = _was[1]; feet[2] = _was[2]; continue; }   // never off an edge
    moved++;
  }
  return moved;
}

// ---- TACT3 (bible/12-Enhanced-AI/Tactics-Arc.md, Mac: "We need to reduce enemy clumping and also have enemies aware of
// each other"; "guards blocking doors"; the classic lane too, his call) - THE CROWD AND THE DOOR -----------------------

/** TACT3: push apart bodies of DIFFERENT pools - a watchman and a bandit, the watch called indoors and the building's
 *  own foes - which each pool's own spaceFoes never sees as a pair. The same push, the same collider law, the same
 *  edge rule; pairs within one pool are left to that pool. Answers how many moved.
 *  @param pools    arrays of the pools' records, all on `collider`
 *  @param skip     (f) => true for a body that neither pushes nor is pushed */
export function spaceAcross(pools, collider, dt, skip = spacingSkips) {
  if (!(dt > 0) || !collider?.move || !pools || pools.length < 2) return 0;
  const bodies = [], group = [];
  pools.forEach((pool, g) => { for (const f of pool ?? []) if (!skip(f)) { bodies.push(f); group.push(g); } });
  const n = bodies.length;
  if (n < 2) return 0;
  const push = new Float64Array(n * 2);
  let touched = false;
  for (let i = 0; i < n; i++) {
    const a = bodies[i].ai.feet, ha = bodies[i].ai.height ?? CAPSULE_HEIGHT;
    for (let j = i + 1; j < n; j++) {
      if (group[i] === group[j]) continue;   // the pool's own spaceFoes has the pair
      const b = bodies[j].ai.feet, hb = bodies[j].ai.height ?? CAPSULE_HEIGHT;
      if (!(a[1] < b[1] + hb && b[1] < a[1] + ha)) continue;
      const dx = b[0] - a[0], dz = b[2] - a[2], d2 = dx * dx + dz * dz;
      if (d2 >= FOE_SPACING_GAP * FOE_SPACING_GAP) continue;
      const d = Math.sqrt(d2);
      let ux, uz;
      if (d > 1e-4) { ux = dx / d; uz = dz / d; } else { const ang = i * 2.399963229728653 + j; ux = Math.cos(ang); uz = Math.sin(ang); }
      const share = 0.5 * (FOE_SPACING_GAP - d);   // half each, as spaceFoes
      push[i * 2] -= ux * share; push[i * 2 + 1] -= uz * share;
      push[j * 2] += ux * share; push[j * 2 + 1] += uz * share;
      touched = true;
    }
  }
  if (!touched) return 0;
  let moved = 0;
  for (let i = 0; i < n; i++) if (nudge(bodies[i].ai, push[i * 2], push[i * 2 + 1], FOE_SPACING_SPEED * dt, collider)) moved++;
  return moved;
}

/** One body moved by (px, pz), capped at `cap` metres, through the collider and never off an edge. */
function nudge(ai, px, pz, cap, collider) {
  const len = Math.hypot(px, pz);
  if (!(len > 1e-6)) return false;
  if (len > cap) { px *= cap / len; pz *= cap / len; }
  const feet = ai.feet, airborne = !!(ai.flies || ai.swims || ai.levitating);
  _was[0] = feet[0]; _was[1] = feet[1]; _was[2] = feet[2];
  const r = collider.move(feet, px, 0, pz, ai.height ?? CAPSULE_HEIGHT, !airborne);
  if (!airborne && ((r && !r.grounded) || !supported(collider, ai, feet))) { feet[0] = _was[0]; feet[1] = _was[1]; feet[2] = _was[2]; return false; }
  return true;
}

/** TACT3: a doorway's threshold - this far either side of the door's plane, and this far along it from its centre. */
export const DOORWAY_DEPTH = 1.4;
export const DOORWAY_HALF_WIDTH = 1.2;
/** ...how fast a foe with no business in it is eased out, metres a second (well under a walk: one passing through
 *  passes through). */
export const DOORWAY_CLEAR_SPEED = 1.6;

/**
 * TACT3: NO FOE STANDS IN A DOORWAY. A foe whose feet are in a door's threshold and whose way does not lie through it
 * (its motor's destination on its own side of the door, or none) is eased out along the door's normal to the edge of
 * the threshold on the side it stands - so a watch called to a door, a pack that chased someone to it, or a crowd a
 * griefer led there never holds it shut. A foe walking through (its destination across the door) is left to walk; one
 * fighting someone on the sill fights from the threshold's edge, which is within its reach (AUDIT TACT C2).
 * `doors` are { pos: [x,y,z] (the door's centre), normal: [x,y,z] } in the foes' frame. Answers how many moved.
 */
export function clearDoorways(foes, doors, collider, dt, skip = spacingSkips) {
  if (!(dt > 0) || !collider?.move || !foes?.length || !doors?.length) return 0;
  let moved = 0;
  for (const f of foes) {
    if (skip(f)) continue;
    const ai = f.ai, feet = ai.feet;
    for (const d of doors) {
      const p = d.pos, n = d.normal;
      const nl = Math.hypot(n[0], n[2]);
      if (!(nl > 1e-6)) continue;
      const nx = n[0] / nl, nz = n[2] / nl;
      const rx = feet[0] - p[0], rz = feet[2] - p[2], dy = feet[1] - p[1];
      if (dy < -2.5 || dy > 1) continue;   // another storey
      const along = rx * nx + rz * nz, across = -rx * nz + rz * nx;
      if (Math.abs(along) >= DOORWAY_DEPTH || Math.abs(across) >= DOORWAY_HALF_WIDTH) continue;
      const dest = ai.destination;
      const side = along >= 0 ? 1 : -1;
      if (dest) {
        const da = (dest[0] - p[0]) * nx + (dest[2] - p[2]) * nz;
        if (Math.sign(da) !== side && Math.abs(da) > 0.3) break;   // on its way through
        // AUDIT TACT C1/C2: NO EXEMPTION FOR A FOE WHOSE QUARRY STANDS IN THE DOORWAY. It kept a griefer's watch on the
        // sill for good (a stale destination after the quarry left kept it there forever, and other players' clicks
        // stopped on it). It need not stand there to fight: the threshold's edge is within its reach of anyone on the
        // sill (DOORWAY_DEPTH under DFU's 2.25 m).
      }
      const need = side * DOORWAY_DEPTH - along;   // to the threshold's edge on its own side
      if (nudge(ai, nx * need, nz * need, DOORWAY_CLEAR_SPEED * dt, collider)) moved++;
      break;
    }
  }
  return moved;
}

/** TACT3: a pool of doors ({ matrix, centre, normal } - a street's static doors, a building's own; `doorOf` maps an
 *  entry to one) as threshold spots within `range` of `near` (the player's feet), for clearDoorways. */
export function doorSpotsNear(doors, near, range = 40, doorOf = (e) => e) {
  const out = [];
  for (const entry of doors ?? []) {
    const door = doorOf(entry);
    const m = door?.matrix, c = door?.centre, nn = door?.normal;
    if (!m || !c || !nn) continue;
    const x = m[0] * c.x + m[4] * c.y + m[8] * c.z + m[12], y = m[1] * c.x + m[5] * c.y + m[9] * c.z + m[13], z = m[2] * c.x + m[6] * c.y + m[10] * c.z + m[14];
    if (near && Math.hypot(x - near[0], z - near[2]) > range) continue;
    const nx = m[0] * nn.x + m[4] * nn.y + m[8] * nn.z, nz = m[2] * nn.x + m[6] * nn.y + m[10] * nn.z;
    out.push({ pos: [x, y, z], normal: [nx, 0, nz] });
  }
  return out;
}

/** AUDIT TACT C6/C7: the ACTION doors' doorways (an interior's inner swing doors, a dungeon's doors) as threshold spots -
 *  each door's CLOSED pose (its base matrix), its box's centre, the normal across its thin axis. `objects` an
 *  ActionSystem's (kind 'door'); within `range` of `near`. */
const _doorBoxes = new WeakMap();
export function actionDoorSpots(objects, near, range = 30) {
  const out = [];
  if (!objects) return out;
  for (const o of objects.values()) {
    if (o?.kind !== 'door' || !o.cpu?.positions || !o.base) continue;
    let box = _doorBoxes.get(o);   // the closed pose never moves: its box once, not a vertex walk a frame
    if (!box || box.base !== o.base) { box = worldAabb(o.cpu.positions, o.base); box.base = o.base; _doorBoxes.set(o, box); }
    const cx = (box.min[0] + box.max[0]) / 2, cy = (box.min[1] + box.max[1]) / 2, cz = (box.min[2] + box.max[2]) / 2;
    if (near && Math.hypot(cx - near[0], cz - near[2]) > range) continue;
    const ex = box.max[0] - box.min[0], ez = box.max[2] - box.min[2];
    out.push({ pos: [cx, cy, cz], normal: ex < ez ? [1, 0, 0] : [0, 0, 1] });   // a door is thin across its doorway
  }
  return out;
}

