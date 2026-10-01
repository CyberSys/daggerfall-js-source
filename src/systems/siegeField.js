// @ts-check
// SEAT2a part four (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): A SEAT
// TOWN'S BATTLEFIELD, derived from its own layout (bible/11-Multiplayer/Seats-Arc.md 6.2) - the banners' points, the
// Throne's and the two camps', which a fighter's game sends the account service for its pass (the service settles the
// battle's field on an attacker's and a defender's agreeing - server-account/src/seatSiege.js).
//
//   - THE THRONE: the palace's door - its building's first door record (scenes/hallBanners.js's measure), a pace out;
//   - THE DEFENDERS' CAMP: before the palace door - DECIDED here: 12 m out, past the Throne's 8 m, so a side's rising
//     never stands on it;
//   - THE GATE: inside the attackers' city gate - DECIDED here: the city gate farthest from the palace (6.2: the
//     attackers' camp is "outside the city gate farthest from the palace"), 6 m in towards the town's middle; THE
//     ATTACKERS' CAMP 14 m outside it. A town with no walls: 40 m and 60 m out from its middle, away from the palace;
//   - THE MARKET: the rumour board nearest the town's middle (a town with none: the middle itself);
//   - THE TEMPLE: the Temple building's door, else the largest guild hall's (6.2), else the town's middle;
//   - A CROWN'S PALACE SQUARE (the fourth banner): DECIDED here: 20 m before the palace door, until CROWN1 measures the
//     castle's entrance in the city.
//
// THE SAME ON EVERY MACHINE: every input is the town's own records (MAPS.BSA, the RMB blocks), and the world point is
// pure arithmetic off the pixel and the local metres - never the floating origin - rounded to whole natives (the wire's
// frame: natives on x and z). Two clients that agree on the town agree on the field to the unit.
//
// Pure. Not a DFU member. Ledger A (EVERY PALACE A SEAT's row).
import { PIXEL_UNITS } from '../net/wire.js';
import { SIEGE_UNITS_PER_M } from '../net/siegeRef.js';

/** The building keys of a laid-out town's records of one type (world/buildingNames.js BUILDING_TYPES) - its blocks' own
 *  building data, the key every building of the pixel carries (scenes/seatBanners.js palaceKeysOf's walk). Pure. */
export function buildingKeysOfType(blocks, makeKey, type) {
  const out = [];
  for (const b of blocks ?? []) {
    const list = b?.dfBlock?.rmbBlock?.fldHeader?.buildingDataList ?? [];
    const count = Math.min(list.length, b?.dfBlock?.rmbBlock?.subRecords?.length ?? list.length);
    for (let i = 0; i < count; i++) if (list[i]?.buildingType === type) out.push(makeKey(b.x ?? 0, b.y ?? 0, i));
  }
  return out;
}

export const SIEGE_FIELD = Object.freeze({ thronePaceM: 1.5, defendCampM: 12, gateInM: 6, attackCampM: 14, openGateM: 40, openCampM: 60, squareM: 20, templePaceM: 2 });

/** A door's middle and its face (square to the door's span, away from the building's middle) - or null. */
export function doorFace(frame) {
  const d = frame?.door, box = frame?.box;
  if (!d || !Array.isArray(d.a) || !Array.isArray(d.b) || !Array.isArray(box) || box.length < 6) return null;
  const rx = d.b[0] - d.a[0], rz = d.b[2] - d.a[2];
  const w = Math.hypot(rx, rz);
  if (!(w >= 0.3)) return null;
  const cx = (d.a[0] + d.b[0]) / 2, cz = (d.a[2] + d.b[2]) / 2;
  let ox = -rz / w, oz = rx / w;
  const mx = (box[0] + box[3]) / 2, mz = (box[2] + box[5]) / 2;
  if ((cx - mx) * ox + (cz - mz) * oz < 0) { ox = -ox; oz = -oz; }
  return { at: [cx, cz], out: [ox, oz] };
}
const boxMid = (box) => [(box[0] + box[3]) / 2, (box[2] + box[5]) / 2];
const unit = (x, z) => { const l = Math.hypot(x, z); return l > 1e-9 ? [x / l, z / l] : [1, 0]; };
const step = (p, d, m) => [p[0] + d[0] * m, p[1] + d[1] * m];

/**
 * THE FIELD in the pixel's own metres: `{ banners, throne, camps: { attack, defend } }` (each `[x, z]`), or null for a
 * town whose palace has no door. `frames` the pixel's building frames (scenes/world.js `homeFrames` - `{ door, box }`),
 * `palaceKeys`, `templeKeys`, `hallKeys` their buildings' keys, `gates` and `boards` `{ box }`, `bounty` the boards
 * BOUNTY1 took, `centre` the town's middle `[x, z]`, `tier` the seat's.
 */
export function siegeFieldOf({ frames = null, palaceKeys = [], templeKeys = [], hallKeys = [], gates = [], boards = [], bounty = new Set(), centre = [0, 0], tier = 'palace' } = {}) {
  const face = palaceKeys.map((k) => doorFace(frames?.get?.(k))).find(Boolean);
  if (!face) return null;
  const throne = step(face.at, face.out, SIEGE_FIELD.thronePaceM);
  const defend = step(face.at, face.out, SIEGE_FIELD.defendCampM);
  // the attackers' gate: the farthest from the palace; inside it the Gate, outside it their camp
  let gate = null, far = -1;
  for (const g of gates) {
    if (!Array.isArray(g?.box) || g.box.length < 6) continue;
    const m = boxMid(g.box), d = Math.hypot(m[0] - throne[0], m[1] - throne[1]);
    if (d > far) { far = d; gate = m; }
  }
  let gateBanner, attack;
  if (gate) {
    const inward = unit(centre[0] - gate[0], centre[1] - gate[1]);
    gateBanner = step(gate, inward, SIEGE_FIELD.gateInM);
    attack = step(gate, inward, -SIEGE_FIELD.attackCampM);
  } else {
    const away = unit(centre[0] - throne[0], centre[1] - throne[1]);
    gateBanner = step(centre, away, SIEGE_FIELD.openGateM);
    attack = step(centre, away, SIEGE_FIELD.openCampM);
  }
  // the Market: the rumour board nearest the middle
  let market = centre, near = Infinity;
  boards.forEach((b, i) => {
    if (bounty.has(i) || !Array.isArray(b?.box) || b.box.length < 6) return;
    const m = boxMid(b.box), d = Math.hypot(m[0] - centre[0], m[1] - centre[1]);
    if (d < near) { near = d; market = m; }
  });
  // the Temple: its door, else the largest guild hall's, else the middle
  let temple = null;
  for (const k of templeKeys) { const f = doorFace(frames?.get?.(k)); if (f) { temple = step(f.at, f.out, SIEGE_FIELD.templePaceM); break; } }
  if (!temple) {
    let big = -1;
    for (const k of hallKeys) {
      const fr = frames?.get?.(k), f = doorFace(fr);
      if (!f) continue;
      const area = (fr.box[3] - fr.box[0]) * (fr.box[5] - fr.box[2]);
      if (area > big) { big = area; temple = step(f.at, f.out, SIEGE_FIELD.templePaceM); }
    }
  }
  const banners = [gateBanner, market, temple ?? centre];
  if (tier === 'crown') banners.push(step(face.at, face.out, SIEGE_FIELD.squareM));
  return { banners, throne, camps: { attack, defend } };
}

/** A pixel-local point `[x, z]` (metres) as the wire's world point - whole natives, the floating origin never read
 *  (streamingWorld.js worldCoords over pixelTranslation: x px x 32768 + x x 40, z (499 - py) x 32768 + z x 40). */
export const siegeWorldPoint = (px, py, p) => [Math.round(px * PIXEL_UNITS + p[0] * SIEGE_UNITS_PER_M), Math.round((499 - py) * PIXEL_UNITS + p[1] * SIEGE_UNITS_PER_M)];
/** The field as a pass carries it (`sf`): the banners, the Throne, the attackers' camp, the defenders' - world points. */
export const siegeFieldWire = (px, py, f) => (f ? [...f.banners, f.throne, f.camps.attack, f.camps.defend].map((p) => siegeWorldPoint(px, py, p)) : null);
/** CROWN1 part two: A ROYAL TOURNEY'S RING (Seats-Arc 7.6: "at the castle's entrance square") - the crown's Palace square,
 *  its field's fourth banner (SIEGE_FIELD.squareM before the palace door), as a pass carries it: one world point. Null for a
 *  field with no square (a palace's). */
export const royalRingWire = (px, py, f) => (f && f.banners.length >= 4 ? [siegeWorldPoint(px, py, f.banners[3])] : null);
