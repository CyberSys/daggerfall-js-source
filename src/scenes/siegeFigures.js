// @ts-check
// SEAT2b part two (2026-10-01, Mac: "I want to finish the inprogress"): A BATTLE'S RELAY-RUN FIGURES AND ITS WORKS, STOOD
// IN THE TOWN (bible/11-Multiplayer/Seats-Arc.md 6.2, 7.5, 7.7; SEAT2b part two's contract, items 2, 4 and 5). Every
// figure the battle's room names (net/siegeLink.js's fold of the relay's `n` - the Barracks' guards, a revolt's rebels
// and its Rebel Captain) stood as a Daggerfall mobile where the relay says it stands, and the battle's works drawn where
// they stand:
//
//   - THE LOOKS - DECIDED (Ledger A, online's own: Daggerfall's towns hold no siege): a guard is DFU's City Watch
//     (MOBILE_TYPES.Knight_CityWatch, 146), a rebel alternately a Rogue (136, an odd number) and a Thief (138, an even),
//     the Rebel Captain a Warrior (144) - each its own animated eight-way sprite through characters/mobileUnit.js
//     MobileUnit (DFU's orientation tables and clip rates), as world/bandSprites.js stands a band's monster. The least new
//     law: a figure is the relay's, so nothing here decides, rolls, strikes or dies - it is drawn.
//   - THE MOTION: a walker (`act` 1) carried from its row's (x, z) toward (tx, tz) at its kind's walk (net/fortLaw.js
//     SIEGE_FIGURES speedMps) since its row was heard, at most FIGURE_LEAD_MS of it, stopping its reach short (fortLaw's
//     reachM - the relay's own stop); a striker (`act` 2) swinging at its kind's cadence (swingMs), facing (tx, tz); a
//     blow taken flinches it (its vitality fell since the last frame); a felled one (`down`) lies as its mobile's corpse
//     (EnemyBasics' corpseTexture - EnemyDeath's own flat) until its row rises; the drawn place eased toward each row
//     (FIGURE_EASE_MS), a rise far off snapped (FIGURE_SNAP_M). On the town's own ground (the host's `groundAt` - the
//     relay holds no height); over ground this client has not built, a figure is neither drawn nor struck.
//   - THE WORKS: the Gatehouse drawn as its vitality over the Throne's point (net/siegeLink.js siegeWorksPoints) - a bar,
//     broken once BREACHED; the standing Ram as an engine RAM_OFFSET_M before it on the line to the attackers' camp,
//     facing the gate (the DFU side record's own flip, MOVE_ANIMS), its own bar over it. Both are the port's own art,
//     painted at runtime into a texture (`vitalityBarArt`, `ramArt` - nothing of ARENA2), as scenes/seatBanners.js's
//     cloth is the town's own drawing.
//
// SPECTATORS SEE THEM TOO: the session (net/siegeSession.js) draws for every side. Each frame refills one kept list of
// batches (`batches`, read once by the exterior's billboard pass - a frame the session did not draw hands back none, so
// nothing stands frozen) and one of bodies (`targets`, `works` - the melee arm's, the arrows' and the cast engine's,
// scenes/world.js; the session decides which of them this fighter may strike).
//
// EVERY ALLOCATION HAS AN OWNER: a figure's billboard batch is made once its art has loaded and destroyed when its row
// leaves the relay's frame; the works' batches and their runtime textures (the bar's steps, the Ram's picture) are made on
// need; `clear()` frees every one - the session calls it whenever this player is out of the battle's room (a door, the
// battle left, its window closed, another entered). The mobiles' sprites are the game's shared art, uploaded through the
// host's door and kept (as scenes/gateCourt.js keeps its boss's).
//
// Not a DFU member. Ledger A (EVERY PALACE A SEAT's row).
import { MobileUnit, MOVE_ANIMS, mobileOrientation } from '../characters/mobileUnit.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { MOBILE_TYPES } from '../characters/mobileTypes.js';
import { mobileBillboardSize, billboardSize } from '../world/rmbFlats.js';
import { toColor32 } from '../formats/color32Order.js';   // the upload's order: row 0 the picture's bottom
import { quadHalfDiagonal } from '../render/bounds.js';   // a batch's cull sphere, the renderer's own measure
import { SIEGE_FIGURES } from '../net/fortLaw.js';
import { SIEGE_UNITS_PER_M } from '../net/siegeRef.js';
import { isSiegeFigure, siegeFigureKind } from '../net/wire.js';
import { SIEGE_WORK_BODY_M } from '../combat/siegeCombat.js';

/** The wire's figure kinds in order (net/wire.js siegeFigureKind: 0 a guard, 1 a rebel, 2 the Captain) - fortLaw.js
 *  SIEGE_FIGURES' rows by name. */
export const SIEGE_FIGURE_KINDS = Object.freeze(['guard', 'rebel', 'captain']);
/** A figure as the cast engine names it, by its kind. */
export const SIEGE_FIGURE_NAMES = Object.freeze(['a town guard', 'a rebel', 'the Rebel Captain']);
export const siegeFigureName = (id) => (isSiegeFigure(id) ? SIEGE_FIGURE_NAMES[siegeFigureKind(id)] : null);   // a work's id reads a letter too: never a figure's name
/** DECIDED (Ledger A, online's own): THE MOBILE A FIGURE WEARS - a guard the City Watch, a rebel a Rogue (odd) or a Thief
 *  (even), the Captain a Warrior; null for an id that is no figure's (net/wire.js siegeFigureKind reads the letter alone -
 *  `~gate` would read as a guard). */
export function figureMobile(id) {
  if (!isSiegeFigure(id)) return null;
  const k = siegeFigureKind(id);
  if (k === 0) return MOBILE_TYPES.Knight_CityWatch;
  if (k === 2) return MOBILE_TYPES.Warrior;
  if (k === 1) return Number(String(id).slice(2)) % 2 === 1 ? MOBILE_TYPES.Rogue : MOBILE_TYPES.Thief;
  return null;
}

/** How far past its last row a walker is carried at most, ms - two of a quick relay beat; past it, it waits for the next. */
export const FIGURE_LEAD_MS = 1000;
/** How fast the drawn place follows the figure's (the ease's time constant, ms), and past how far (m) it snaps. */
export const FIGURE_EASE_MS = 120;
export const FIGURE_SNAP_M = 6;

/** WHERE A FIGURE STANDS at `now`, in the room's units: a walker carried from its row's (x, z) toward (tx, tz) at its
 *  kind's walk since the row was heard (`heardAt`) - at most FIGURE_LEAD_MS of it, and never within its reach of where it
 *  walks; any other at its row's (x, z). */
export function figurePlace(f, heardAt, now) {
  if (f.down || f.act !== 1) return [f.x, f.z];
  const k = SIEGE_FIGURES[SIEGE_FIGURE_KINDS[f.kind]];
  const dx = f.tx - f.x, dz = f.tz - f.z, d = Math.hypot(dx, dz);
  if (!k || !(d > 0)) return [f.x, f.z];
  const walked = Math.min(d - k.reachM * SIEGE_UNITS_PER_M, (k.speedMps * SIEGE_UNITS_PER_M * Math.max(0, Math.min(FIGURE_LEAD_MS, now - heardAt))) / 1000);
  return walked > 0 ? [f.x + (dx / d) * walked, f.z + (dz / d) * walked] : [f.x, f.z];
}
/** ITS FACING (the motor's yaw - forward (sin, cos)): toward where it walks or strikes, while it stands; else as it was. */
export function figureFacing(f, was = 0) {
  const dx = f.tx - f.x, dz = f.tz - f.z;
  return !f.down && Math.hypot(dx, dz) > 1e-6 ? Math.atan2(dx, dz) : was;
}

// ─── THE WORKS' ART - the port's own, painted at runtime ─────────────

/** The runtime art's archives - string keys, never an ARENA2 archive's number. */
export const SIEGE_ART = Object.freeze({ bar: 'siege-bar', ram: 'siege-ram' });
/** A vitality is drawn in BAR_STEPS + 1 pictures (empty to whole) and a broken one, so no beat's change makes a texture past
 *  them; any vitality left shows a step. */
export const BAR_STEPS = 32;
export const BAR_BROKEN = 'broken';
export const barStep = (share) => Math.max(0, Math.min(BAR_STEPS, Math.ceil(Math.max(0, Math.min(1, Number(share) || 0)) * BAR_STEPS)));
/** The pictures' sizes in the town, metres, and how high over their point they stand: the Gatehouse's bar over the
 *  Throne's point, the Ram and its bar. */
export const SIEGE_WORK_DRAW = Object.freeze({
  gateBar: Object.freeze({ w: 3.2, h: 0.4, rise: 4.5 }),
  ram: Object.freeze({ w: 4.2, h: 2.6 }),
  ramBar: Object.freeze({ w: 2.4, h: 0.3, rise: 3 }),
});
const BAR_W = 64, BAR_H = 8, RAM_W = 64, RAM_H = 40;
const C = Object.freeze({
  frame: [220, 190, 120], fill: [176, 28, 22], fillHi: [226, 74, 52], empty: [24, 18, 14], brokenIn: [58, 50, 44],
  roof: [92, 60, 34], seam: [66, 42, 24], post: [104, 70, 40], chain: [70, 70, 76], log: [150, 106, 62], iron: [118, 118, 126],
  beam: [122, 82, 46], wheel: [72, 46, 26], wheelIn: [112, 76, 42], hub: [44, 32, 22],
});
/** A top-down raster `w` x `h`, and its brush (out-of-bounds strokes dropped). */
function raster(w, h) {
  const data = new Uint8Array(w * h * 4);
  const put = (x, y, c) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const o = (y * w + x) * 4; data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255; };
  return { data, put };
}
/** THE VITALITY BAR'S PICTURE: a brass frame, `step` of BAR_STEPS in red (its top rows lit), the rest dark; `broken` (a
 *  Gatehouse breached) its frame split by a crack the world shows through, nothing in it. */
export function vitalityBarArt(step, broken = false) {
  const { data, put } = raster(BAR_W, BAR_H);
  const fill = broken ? 0 : Math.round(((BAR_W - 2) * Math.max(0, Math.min(BAR_STEPS, step))) / BAR_STEPS);
  for (let y = 0; y < BAR_H; y++) {
    for (let x = 0; x < BAR_W; x++) {
      if (broken && Math.abs(x - (BAR_W / 2 + (y % 2 ? 1 : -1))) <= 1) continue;   // the crack: left clear
      const edge = x === 0 || y === 0 || x === BAR_W - 1 || y === BAR_H - 1;
      put(x, y, edge ? C.frame : x - 1 < fill ? (y <= 2 ? C.fillHi : C.fill) : broken ? C.brokenIn : C.empty);
    }
  }
  return toColor32({ width: BAR_W, height: BAR_H, data });
}
/** THE RAM'S PICTURE: a gabled, planked roof on two posts over a slung log with an iron head (to the left - the way a DFU
 *  side record faces), a base beam, two wheels. */
export function ramArt() {
  const { data, put } = raster(RAM_W, RAM_H);
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, c); };
  const disc = (cx, cy, r, c) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) put(x, y, c); };
  for (let y = 2; y <= 12; y++) { const half = Math.round(((y - 2) / 10) * 29) + 2; for (let x = 32 - half; x <= 31 + half; x++) put(x, y, y % 3 ? C.roof : C.seam); }
  rect(10, 13, 12, 26, C.post); rect(51, 13, 53, 26, C.post);
  rect(20, 13, 20, 16, C.chain); rect(43, 13, 43, 16, C.chain);
  rect(7, 17, 60, 20, C.log); rect(0, 15, 6, 22, C.iron);
  rect(5, 25, 58, 28, C.beam);
  for (const cx of [16, 47]) { disc(cx, 33, 6, C.wheel); disc(cx, 33, 4, C.wheelIn); disc(cx, 33, 1, C.hub); }
  return toColor32({ width: RAM_W, height: RAM_H, data });
}

const NONE = Object.freeze([]);
const ready = (v) => !!v && typeof v.then !== 'function';

/**
 * THE DRAWING. `renderer` (createBillboardBatch, destroyBillboardBatch, uploadTexture, releaseTexture, textures),
 * `getTexture(archive)` and `uploadRecordFrame(archive, record, frame)` the host's art doors, `toScene(x, z)` a room point
 * (natives) as the scene's `[x, z]` (the floating origin's), `groundAt(x, z)` the scene's ground there (not finite where
 * it is not built), `eye()` the view's, `rolls` the clip variants' roll (MobileUnit's, cosmetic).
 * @param {{ renderer?: any, getTexture?: ((archive: number) => any)|null, uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null,
 *   toScene?: (x: number, z: number) => (number[]|null), groundAt?: (x: number, z: number) => number, eye?: () => (ArrayLike<number>|null), rolls?: () => number }} [deps]
 */
export function createSiegeFigures({ renderer = null, getTexture = null, uploadRecordFrame = null, toScene = (x, z) => [x, z], groundAt = () => 0, eye = () => null, rolls = Math.random } = {}) {
  /** archive -> its texture, null (none, or it failed) or the promise loading it - a mobile's sprite or a corpse's */
  const sprites = new Map();
  /** figure id -> its drawn state */
  const units = new Map();
  /** the runtime textures uploaded, by key -> [archive, record] */
  const art = new Map();
  /** the works' batches */
  const works = { gate: null, ram: null, ramBar: null };
  const drawn = [], bodies = [], workBodies = [];
  const gateBody = { id: '~gate', feet: [0, 0, 0], height: SIEGE_WORK_BODY_M.gate };
  const ramBody = { id: '~ram', feet: [0, 0, 0], height: SIEGE_WORK_BODY_M.ram };
  /** @type {{ w: number, h: number }} the Ram's size, its width's sign its facing */
  const ramSize = { w: SIEGE_WORK_DRAW.ram.w, h: SIEGE_WORK_DRAW.ram.h };
  let fresh = false, lastAt = null, stamp = 0;

  function sprite(archive) {
    if (sprites.has(archive)) return sprites.get(archive);
    if (!getTexture || !archive) { sprites.set(archive, null); return null; }
    const p = Promise.resolve().then(() => getTexture(archive)).then((t) => { sprites.set(archive, t ?? null); }, () => { sprites.set(archive, null); });
    sprites.set(archive, p);
    return p;
  }
  /** One batch stood (made on first need) and pushed into the frame's list - false when the renderer made none. */
  function stand(holder, key, archive, record, size, x, y, z) {
    let b = holder[key];
    if (!b) {
      b = renderer?.createBillboardBatch?.(archive, record, size, [[0, 0, 0]]) ?? null;
      if (!b) return false;
      b.origin = [0, 0, 0];
      holder[key] = b;
    }
    b.archive = archive; b.record = record; b.size = size;
    if (b.bounds) b.bounds[3] = quadHalfDiagonal(size);   // the cull sphere follows the picture (a corpse, a sprite's frame, a bar)
    b.origin[0] = x; b.origin[1] = y; b.origin[2] = z;
    drawn.push(b);
    return true;
  }
  const unstand = (holder, key) => { const b = holder[key]; holder[key] = null; if (b) renderer?.destroyBillboardBatch?.(b); };   // the slot emptied before its batch is let go
  function drop(id) { const r = units.get(id); if (r) unstand(r, 'batch'); units.delete(id); }
  /** A runtime picture uploaded once until the next clear. */
  function paint(archive, record, draw) {
    const key = `${archive}_${record}`;
    if (art.has(key) || !renderer?.uploadTexture) return;
    renderer.uploadTexture(archive, record, draw());
    art.set(key, [archive, record]);
  }
  /** A room point on this client's ground, the scene's `[x, y, z]` - or null over ground not built. */
  function onGround(p) {
    const sc = toScene(p[0], p[1]);
    const y = sc ? groundAt(sc[0], sc[1]) : NaN;
    return sc && Number.isFinite(y) ? [sc[0], y, sc[1]] : null;
  }

  function figure(f, figuresAt, now, dt, at) {
    const mobile = figureMobile(f.id);
    const basics = mobile == null ? null : ENEMY_BASICS[mobile];
    const tex = sprite(basics?.maleTexture);
    if (!ready(tex)) return;   // its art still loading, or none: not drawn yet
    let r = units.get(f.id);
    if (!r) {
      r = { unit: new MobileUnit(mobile, basics, (rec) => tex.getFrameCount?.(rec) ?? 1, rolls, 'male'), tex, archive: basics.maleTexture, batch: null, shown: null, yaw: 0,
        swingAt: -Infinity, hp: f.hp, stamp: 0, size: { w: 0, h: 0 }, corpse: null, body: { id: f.id, feet: [0, 0, 0], height: 0 } };
      units.set(f.id, r);
    }
    r.stamp = stamp;
    const want = figurePlace(f, figuresAt, now);
    if (!r.shown || f.down || Math.hypot(want[0] - r.shown[0], want[1] - r.shown[1]) > FIGURE_SNAP_M * SIEGE_UNITS_PER_M) r.shown = [want[0], want[1]];
    else { const k = 1 - Math.exp(-dt / FIGURE_EASE_MS); r.shown[0] += (want[0] - r.shown[0]) * k; r.shown[1] += (want[1] - r.shown[1]) * k; }
    const hurt = f.hp < r.hp;
    r.hp = f.hp;
    const feet = onGround(r.shown);
    if (!feet) { unstand(r, 'batch'); return; }   // over ground not built: neither drawn nor struck
    r.yaw = figureFacing(f, r.yaw);
    if (f.down) {   // its corpse, EnemyDeath's flat, down until its row rises
      const c = basics.corpseTexture, ct = c ? sprite(c.archive) : null;
      if (!ready(ct)) { unstand(r, 'batch'); return; }
      const rkey = `${c.record}#0`;
      if (!renderer?.textures?.has?.(`${c.archive}_${rkey}`)) uploadRecordFrame?.(c.archive, c.record, 0);
      r.corpse ??= billboardSize(ct, c.record);
      stand(r, 'batch', c.archive, rkey, r.corpse, feet[0], feet[1], feet[2]);
      return;
    }
    const k = SIEGE_FIGURES[SIEGE_FIGURE_KINDS[f.kind]];
    const striking = f.act === 2 && now - r.swingAt >= (k?.swingMs ?? 1500);
    if (striking) r.swingAt = now;
    const out = r.unit.update(dt / 1000, { moving: f.act === 1, striking, hurting: hurt }, r.yaw, feet, at && at.length === 3 ? at : feet);
    const rkey = `${out.record}#${out.frame}`;
    if (!renderer?.textures?.has?.(`${r.archive}_${rkey}`)) uploadRecordFrame?.(r.archive, out.record, out.frame);
    const sz = mobileBillboardSize(r.tex, out.record);   // a shared, cached object: read, never written
    r.size.w = out.flip ? -sz.w : sz.w; r.size.h = sz.h;
    if (!stand(r, 'batch', r.archive, rkey, r.size, feet[0], feet[1], feet[2])) return;
    r.body.feet[0] = feet[0]; r.body.feet[1] = feet[1]; r.body.feet[2] = feet[2];
    r.body.height = sz.h;
    bodies.push(r.body);
  }

  function worksFrame(w, points, at) {
    const D = SIEGE_WORK_DRAW;
    const gp = w?.g && points?.gate ? onGround(points.gate) : null;
    if (gp) {
      const broken = w.br === 1;
      const rec = broken ? BAR_BROKEN : barStep(w.g[1] > 0 ? w.g[0] / w.g[1] : 0);
      paint(SIEGE_ART.bar, rec, () => vitalityBarArt(broken ? 0 : Number(rec), broken));
      stand(works, 'gate', SIEGE_ART.bar, rec, D.gateBar, gp[0], gp[1] + D.gateBar.rise, gp[2]);
      if (w.g[0] > 0) { gateBody.feet[0] = gp[0]; gateBody.feet[1] = gp[1]; gateBody.feet[2] = gp[2]; workBodies.push(gateBody); }   // breached at nought: no body
    } else unstand(works, 'gate');
    const rp = w?.r && points?.ram ? onGround(points.ram) : null;
    if (rp) {
      paint(SIEGE_ART.ram, 0, ramArt);
      // facing the gate it strikes: DFU's side record's own flip (the picture faces left, as record 2 does)
      const o = mobileOrientation(Math.atan2(points.gate[0] - points.ram[0], points.gate[1] - points.ram[1]), rp, at && at.length === 3 ? at : rp);
      ramSize.w = MOVE_ANIMS[o].flip ? -D.ram.w : D.ram.w;
      stand(works, 'ram', SIEGE_ART.ram, 0, ramSize, rp[0], rp[1], rp[2]);
      const rec = barStep(w.r[1] > 0 ? w.r[0] / w.r[1] : 0);
      paint(SIEGE_ART.bar, rec, () => vitalityBarArt(rec));
      stand(works, 'ramBar', SIEGE_ART.bar, rec, D.ramBar, rp[0], rp[1] + D.ramBar.rise, rp[2]);
      if (w.r[0] > 0) { ramBody.feet[0] = rp[0]; ramBody.feet[1] = rp[1]; ramBody.feet[2] = rp[2]; workBodies.push(ramBody); }
    } else { unstand(works, 'ram'); unstand(works, 'ramBar'); }
  }

  return {
    /** ONE FRAME of the battle in the town: `state` the session's (net/siegeLink.js SiegeState), `points` where its works
     *  stand (siegeLink.js siegeWorksPoints, or null), `now` the relay's clock (the clock the rows were heard on). */
    frame(state, { points = null, now = 0 } = {}) {
      const dt = lastAt == null ? 0 : Math.max(0, Math.min(250, now - lastAt));
      lastAt = now;
      stamp++;
      drawn.length = 0; bodies.length = 0; workBodies.length = 0;
      const at = eye?.() ?? null;
      for (const f of state?.figures ?? NONE) figure(f, state.figuresAt, now, dt, at);
      for (const [id, r] of [...units]) if (r.stamp !== stamp) drop(id);   // a row the relay no longer names
      worksFrame(state?.works ?? null, points, at);
      fresh = true;
    },
    /** This frame's batches, for the exterior's billboard pass - once a frame; none when no frame was drawn since. */
    batches() { const out = fresh ? drawn : NONE; fresh = false; return out; },
    /** This frame's standing figures as bodies (`{ id, feet, height }`, the scene's frame) - kept, refilled; read only. */
    targets: () => bodies,
    /** This frame's standing works as bodies: the Gatehouse unbreached, a Ram whole. */
    works: () => workBodies,
    /** Every batch destroyed and every runtime texture released - out of the battle's room, the battle left. */
    clear() {
      for (const id of [...units.keys()]) drop(id);
      unstand(works, 'gate'); unstand(works, 'ram'); unstand(works, 'ramBar');
      for (const [archive, record] of art.values()) renderer?.releaseTexture?.(archive, record);
      art.clear();
      drawn.length = 0; bodies.length = 0; workBodies.length = 0;
      fresh = false; lastAt = null;
    },
    /** What it holds, for the pins. */
    get size() { return units.size; },
    get painted() { return [...art.keys()]; },
  };
}
