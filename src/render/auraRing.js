// @ts-check
// WB9g (2026-09-30, Mac: "a new addition (the aura), an animated burning ground aura that circles the ground where your
// character stands. These items should be expensive and sought after"): DAGON'S FIRE, DRAWN - the Sigil Broker's aura,
// burning on the ground about the feet of whoever wears it: a ring of fire that chases itself round, tongues of flame
// licking up out of it, embers circling in it and a glow in the stone inside it. Design: bible/11-Multiplayer/
// World-Bosses.md section 14 (WB9g); the aura's law (who wears one, signed into the token) is net/insignia.js.
//
// TWO DRAWS A WEARER, one pass:
//   - THE GROUND: one quad flat under the feet, the ring, its fire, its embers and the glow inside it answered per pixel
//     from the polar distance and angle about the wearer (a ring band broken by value-noise fire that flows round it,
//     bright crests chasing about it, ten embers orbiting in it, a soft ember-glow within).
//   - THE FLAMES: a low cylinder of flame at the ring - tongues rising out of noise that scrolls up and round, white-hot
//     at the root, orange, red and gone at the top; both faces, so the far side burns behind the wearer too.
//
// The duel wall's law (render/duelWall.js): fixed geometry (a quad, a strip of the cylinder's steps) placed by uniforms;
// added onto the frame (ONE, ONE); tested against the depth the world wrote and never writing it; the ground lifted and
// offset off the stone it lies on; fogged to the frame's fog; every rate whole over the wrapped clock (AURA_CLOCK_PERIOD).
// The travel view draws none (the hosts draw it in the walking views alone). Pure where it can be: `auraWearers` (who is
// drawn, nearest first, at most AURA_DRAW_MAX) and `auraClock` are the pins' doors.
//
// AEGIS (2026-10-03, the owner: "For the account named Sureme ... a title, glyph and new custom aura for this user.
// Title: Aegis of Oblivion. Theme: Purple"; Sureme, sending two Path of Exile ground marks: "i want one that is a full
// circle", "but with some stuff like this one"): THE OBLIVION WARD, the second aura, drawn by the SAME pass - one program,
// the aura picked per wearer by `uAura` (AURA_LOOK: its kind, its ring's radius, its wall's height), so a frame with both
// auras in it is still one program bound once. Not fire but script, in the Aegis of Oblivion's violets:
//   - THE GROUND: the ward's ring WHOLE (the first reference) - one line of light, lilac-white at its heart and violet
//     round it, breathing, two scribes of brighter light running round it; a bezel of fine ticks outside it turning
//     the other way; within it a ring of WARD_RUNES runes in the second reference's script - each a baseline along the
//     ring with a bead or a serif at each end, beads on the line, a comb or a chevron outward, a cross inward
//     (WARD_SCRIPT says which) - turning slowly against the ring and lit one after another as if being written;
//     WARD_SIGILS claws hung inward from the ring at the diagonals (the first reference's four marks); the abyss's
//     violet mist turning within; drawn round from behind the wearer as it kindles.
//   - THE WALL: a veil of light no higher than the shins, in streaks that climb, and WARD_MOTES motes rising off the
//     ring at their own places and paces - so it stands up off the ground seen from the side, as the fire's flames do.
//   - THE SYMBOLS (the owner, after: "Can you add like symbols that float and dissipate"): WARD_GLYPHS cards, each a rune
//     of the script stood on end, lifting off the ring and floating up to the chest - swaying, drifting outward, turning
//     a little, always facing the eye round the vertical - while they blur, break into dust and fade; then each lifts
//     again somewhere else round the ring, another rune. A third draw, the ward's alone.
// Every rate whole over the clock, as the fire's (wardRatesWhole); every pattern round the ring a whole number of
// itself, so no seam behind the wearer.
//
// PRIMARCH (2026-10-04, GA00250, relayed by the owner: "can the aura be a golden light around the character? like i've
// seen some rare mobs with it" - the elite foes' glow, systems/hitFlash.js ELITE_GLOW_GLSL: a warmth, an edge of light
// round the silhouette and embers rising off it): THE GOLDEN RADIANCE, the third aura, the same pass's third look. Not a
// mark on the ground but LIGHT ABOUT THE BODY:
//   - THE WALL: a column of golden light the body's own width (RADIANCE_R) standing past the crown (RADIANCE_H), lit as
//     a glowing shell is - faint where it crosses the body (the eye looks straight through it) and brightest at its two
//     edges, where the eye looks along it, so it reads as light ROUND the wearer, a halo up the silhouette, and never as
//     a gold wash over them; shafts in it climbing, fading toward the top, breathing; RADIANCE_MOTES golden motes rising
//     the column's height at their own places and paces, the elite's embers. From inside it (the wearer's own first
//     person) the column is not drawn - only its motes, dimmer - so the wearer's own view is never veiled in gold.
//   - THE GROUND: the light the column throws - a pool, brightest at the feet; a white-gold ring at the column's foot;
//     RADIANCE_RAYS rays out across the pool, turning slowly.
// It kindles UP: the ground lights as the fire's does, and the column rises from the feet to past the crown. Every rate
// whole over the clock (radianceRatesWhole). No third draw.
//
// Not a DFU member. Ledger A (WB).
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';

/** The ring's radius about the feet (m), the ground quad's half-width, the flames' height, and the ground's lift. */
export const AURA_RING_R = 0.85;
export const AURA_GROUND_R = 1.35;
export const AURA_FLAME_H = 0.62;
export const AURA_LIFT_M = 0.05;
/** The cylinder's steps round (its strip's resolution). */
export const AURA_STEPS = 48;
/** The most auras one frame draws, and the farthest one is drawn from the eye (m) - past it a ring is a few pixels. */
export const AURA_DRAW_MAX = 16;
export const AURA_RANGE_M = 90;
/** The clock every rate is whole over (s): the ring's turn (AURA_TURN_HZ), the fire's flow and the flames' rise. */
export const AURA_CLOCK_PERIOD = 120;
export const AURA_TURN_HZ = 1 / 8;
/** The seconds a wearer's aura takes to kindle when it first stands (or when they first put it on). */
export const AURA_KINDLE_S = 0.8;

/** AEGIS: THE OBLIVION WARD'S MEASURES - the ring's radius (wider than the fire's, as the first reference's circle stands
 *  clear of the feet), the rune ring's within it, the wall's height (a veil to the shins), and how many of each round. */
export const WARD_RING_R = 0.95;
export const WARD_RUNE_R = 0.78;
export const WARD_WALL_H = 0.42;
export const WARD_RUNES = 12;
export const WARD_SIGILS = 4;
export const WARD_TICKS = 48;
export const WARD_MOTES = 14;
/** AEGIS: THE FLOATING SYMBOLS - how many are aloft at once, the seconds a flight lasts (symbol k's is
 *  WARD_GLYPH_LIFE[k mod 3], each dividing AURA_CLOCK_PERIOD so the flights wrap whole with the clock), how high a flight
 *  climbs over the ring (m), and a card's width and height (m) before it grows as it fades. */
export const WARD_GLYPHS = 9;
export const WARD_GLYPH_LIFE = Object.freeze([3, 4, 5]);
export const WARD_GLYPH_RISE = 1.3;
export const WARD_GLYPH_W = 0.16;
export const WARD_GLYPH_H = 0.26;
/** The ward's rates (Hz), each a whole number of cycles over AURA_CLOCK_PERIOD: the runes' turn against the ring (a
 *  turn in 40 s), the bezel's the other way (60 s), the two scribes' run round the ring, the ring's breath, the
 *  writing's pass round the runes, and the slowest mote's rise (the others two and three times it). */
export const WARD_HZ = Object.freeze({ runes: 1 / 40, bezel: 1 / 60, scribe: 1 / 8, pulse: 1 / 4, write: 1 / 6, mote: 1 / 4 });
/** Its flows in lattice cells a second (the mist's turn round the ring, the veil's climb) - whole over the clock too. */
export const WARD_FLOW = Object.freeze({ mist: 0.5, veil: 0.75 });
/** Every ward rate whole over the clock. Pure. */
export const wardRatesWhole = () => [...Object.values(WARD_HZ), ...Object.values(WARD_FLOW)]
  .every((r) => Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6));
/** THE WARD'S SCRIPT: rune k's ornaments as bits on its baseline - 1 a bead ends it on the left (else a serif), 2 on the
 *  right, 4 a bead on the line's left half, 8 on its right, 16 a comb outward (else a chevron), 32 a cross inward. The
 *  second reference's marks, twelve runes no two alike, so the ring reads as writing and not as a pattern. */
export const WARD_SCRIPT = Object.freeze([25, 38, 51, 12, 19, 40, 61, 18, 33, 15, 52, 10]);
/** Its light: the ward's violet (the Aegis of Oblivion's own - ui/playerBadge.js OBLIVION_VIOLET), the lilac-white at a
 *  line's heart (OBLIVION_LILAC), and the abyss's violet in the mist (OBLIVION_ABYSS). RGB 0..1. */
export const WARD_RGB = Object.freeze({ violet: Object.freeze([0.698, 0.302, 1]), heart: Object.freeze([0.925, 0.863, 1]), abyss: Object.freeze([0.302, 0.102, 0.58]) });
/** PRIMARCH: THE GOLDEN RADIANCE'S MEASURES - the column's radius about the body (clear of the shoulders, inside the
 *  fire's ring) and its height (past the crown: the walking body is 1.8 m, player/motor.js CAPSULE_HEIGHT), the pool's
 *  reach on the ground (inside the ground quad), the rays round it, the motes up it, and the shafts' lattice cells round
 *  the column. */
export const RADIANCE_R = 0.6;
export const RADIANCE_H = 2.2;
export const RADIANCE_POOL_R = 1.15;
export const RADIANCE_RAYS = 12;
export const RADIANCE_MOTES = 18;
export const RADIANCE_ROUND = 24;
/** Its rates (Hz), each a whole number of cycles over AURA_CLOCK_PERIOD: the light's breath, the rays' turn (a turn in
 *  30 s), and the slowest mote's climb (the others two and three times it); and the shafts' climb in lattice cells a
 *  second. */
export const RADIANCE_HZ = Object.freeze({ pulse: 1 / 4, rays: 1 / 30, mote: 1 / 6 });
export const RADIANCE_FLOW = Object.freeze({ shafts: 0.5 });
/** Every radiance rate whole over the clock. Pure. */
export const radianceRatesWhole = () => [...Object.values(RADIANCE_HZ), ...Object.values(RADIANCE_FLOW)]
  .every((r) => Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6));
/** Its light: the gold the column glows in (the elite foe's warmth, a step paler - systems/hitFlash.js ELITE_GOLD
 *  #ffad29), and the white-gold at the ring's heart and in the motes - the Primarch's own light gold (ui/playerBadge.js
 *  PRIMARCH_GOLD, the menu's #d8cfae). RGB 0..1. */
export const RADIANCE_RGB = Object.freeze({ gold: Object.freeze([1, 0.741, 0.278]), heart: Object.freeze([0.847, 0.812, 0.682]) });
/** SHADOW-CLOAK: THE HOLO SHADOW CLOAK'S MEASURES (m above the feet, the walking body 1.8 m - player/motor.js
 *  CAPSULE_HEIGHT): the hood's peak, the shoulders the cloak hangs from, the neck it draws in to; its radius about the
 *  body at the hem, the shoulders, the neck and round the hood; how far its back hangs behind the body and the hood's peak
 *  falls back behind the head. The mesh's steps round and up. */
export const CLOAK_H = 1.97;
export const CLOAK_SHOULDER_Y = 1.46;
export const CLOAK_NECK_Y = 1.6;
export const CLOAK_HEM_R = 0.48;
export const CLOAK_SHOULDER_R = 0.34;
export const CLOAK_NECK_R = 0.2;
export const CLOAK_HOOD_R = 0.21;
export const CLOAK_BACK_M = 0.1;
export const CLOAK_HOOD_BACK_M = 0.1;
/** How much narrower front to back than across it is: at the shoulders (a body is broader than it is deep) and at the
 *  hem, where the cloth has fallen round. And the folds' depth (m) at the hem. */
export const CLOAK_SQUASH = Object.freeze({ shoulder: 0.3, hem: 0.05 });
export const CLOAK_FOLD_M = 0.014;
export const CLOAK_ROUND = 48;
export const CLOAK_ROWS = 40;
/** Its parting at the front, half its width in turns: at the hem, at the shoulders, the throat, and the hood's face. */
export const CLOAK_OPEN = Object.freeze({ hem: 0.115, shoulder: 0.07, throat: 0.045, face: 0.165 });
/** Its pattern counts round the body (each a whole number, so the cloak closes on itself): the folds, the lattice's
 *  cells, the rain's columns; and on the ground the emitter's dashes, the bezel's ticks and the brackets. */
export const CLOAK_FOLDS = 14;
export const CLOAK_HEX_ROUND = 28;
export const CLOAK_RAIN = 40;
export const CLOAK_DASHES = 24;
export const CLOAK_TICKS = 60;
export const CLOAK_BRACKETS = 3;
/** On the ground: the shadow's pool, the emitter ring just outside the hem, the bezel and the brackets. */
export const CLOAK_POOL_R = 0.95;
export const CLOAK_EMITTER_R = CLOAK_HEM_R + 0.06;
export const CLOAK_BEZEL_R = 0.86;
export const CLOAK_BRACKET_R = 1.0;
/** The Shadow Fang's mark on its back: its middle's height (m) and its ring's radius. */
export const CLOAK_SIGIL_Y = 1.14;
export const CLOAK_SIGIL_R = 0.14;
/** THE WISPS, its third draw: shadow peeling off its back and shoulders and rising as it burns away - how many at once,
 *  the seconds a wisp lasts (wisp k's is CLOAK_WISP_LIFE[k mod 3], each dividing AURA_CLOCK_PERIOD), how high one climbs
 *  (m), and its card (m). */
export const CLOAK_WISPS = 10;
export const CLOAK_WISP_LIFE = Object.freeze([4, 5, 6]);
export const CLOAK_WISP_RISE = 0.9;
export const CLOAK_WISP_W = 0.18;
export const CLOAK_WISP_H = 0.34;
/** Its rates (Hz), each a whole number of cycles over AURA_CLOCK_PERIOD: the scan climbing the cloak, the sweep round the
 *  ground, the emitter's dashes, the bezel's ticks the other way, the brackets, the hem's billow and the ripple running
 *  down it, the rain's slowest fall (the others two and three times it), the light's breath; and the moments a flicker
 *  or a glitch may fall in (a hash of each moment says whether one does). */
export const CLOAK_HZ = Object.freeze({ scan: 1 / 3, sweep: 1 / 4, dashes: 1 / 20, ticks: 1 / 30, brackets: 1 / 15, billow: 1 / 5, ripple: 1 / 2, rain: 1 / 4, pulse: 1 / 4, flicker: 8, glitch: 2, shred: 4 });
/** Its flows in lattice cells a second (the shadow's smoke up the cloth, the ground's mist turning and drawn in). */
export const CLOAK_FLOW = Object.freeze({ smoke: 0.5, mist: 0.25, swirl: 0.1 });
/** Every cloak rate whole over the clock. Pure. */
export const cloakRatesWhole = () => [...Object.values(CLOAK_HZ), ...Object.values(CLOAK_FLOW)]
  .every((r) => Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6));
/** Its light: the Shadow Fang's crimson (ui/playerBadge.js TITLE_GRADIENT.shadowfang's end, #d3193c), its hot heart, and
 *  the shadow's own black (the gradient's start, #0d0709) - the cloth is shadow, the light is red. RGB 0..1. */
export const CLOAK_RGB = Object.freeze({ crimson: Object.freeze([0.827, 0.098, 0.235]), hot: Object.freeze([1, 0.55, 0.6]), shadow: Object.freeze([0.051, 0.027, 0.035]) });

/** AEGIS: HOW EACH AURA IS DRAWN - its kind in the shader (`uAura`), its ring's radius, its wall's height and how many
 *  symbols float off it (the third draw - none for the fire). A pin walks AURAS and requires one each. SHADOW-CLOAK: and,
 *  for the cloak alone, the mesh its wall is (`mesh` - the shaped cloth, not the strip) and that it SHADES: it darkens
 *  what is behind it as well as lighting it, drawn premultiplied (ONE, ONE_MINUS_SRC_ALPHA) where the others add. */
export const AURA_LOOK = Object.freeze({
  dagonfire: Object.freeze({ kind: 0, ringR: AURA_RING_R, flameH: AURA_FLAME_H, glyphs: 0 }),
  oblivionward: Object.freeze({ kind: 1, ringR: WARD_RING_R, flameH: WARD_WALL_H, glyphs: WARD_GLYPHS }),   // and its floating symbols
  radiance: Object.freeze({ kind: 2, ringR: RADIANCE_R, flameH: RADIANCE_H, glyphs: 0 }),   // PRIMARCH: the column about the body
  shadowcloak: Object.freeze({ kind: 3, ringR: CLOAK_HEM_R, flameH: CLOAK_H, glyphs: CLOAK_WISPS, mesh: 'cloak', shade: true }),   // SHADOW-CLOAK: the cloak on the body, and its wisps
});
/** The look a wearer's aura is drawn with - Dagon's Fire for one that names none (the fire was the only aura before). */
export const auraLookOf = (aura) => (typeof aura === 'string' && Object.hasOwn(AURA_LOOK, aura) ? AURA_LOOK[aura] : AURA_LOOK.dagonfire);

/** The clock, wrapped: whole cycles of every rate over its period, so no stutter at the wrap. Pure. */
export const auraClock = (seconds) => ((seconds % AURA_CLOCK_PERIOD) + AURA_CLOCK_PERIOD) % AURA_CLOCK_PERIOD;

/**
 * WHO IS DRAWN THIS FRAME: of `wearers` (`[{ id, at: [x, y, z] their feet in the scene, aura }]`), those wearing an
 * aura within AURA_RANGE_M of `eye`, nearest first, at most AURA_DRAW_MAX - written into `out` (one list, refilled: AUDIT
 * WB D10's law) and answered. Pure.
 * @param {Array<{ id?: any, at: number[], aura: string|null, _d2?: number }>} wearers @param {number[]} eye @param {any[]} out
 */
export function auraWearers(wearers, eye, out) {
  out.length = 0;
  if (!Array.isArray(wearers) || !eye) return out;
  const r2 = AURA_RANGE_M * AURA_RANGE_M;
  for (const w of wearers) {
    if (!w || !w.aura || !Array.isArray(w.at)) continue;
    const dx = w.at[0] - eye[0], dy = w.at[1] - eye[1], dz = w.at[2] - eye[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (!(d2 <= r2)) continue;
    w._d2 = d2;
    out.push(w);
  }
  out.sort((a, b) => a._d2 - b._d2);
  if (out.length > AURA_DRAW_MAX) out.length = AURA_DRAW_MAX;
  return out;
}

const HEAD = `#version 300 es
precision highp float;
precision highp int;
`;
/** THE FIRE'S NOISE, PERIODIC: value noise on a lattice that wraps at `per` (both whole), so a flow scrolled by the clock
 *  meets itself at the clock's wrap and the angle's noise meets itself where the ring closes - no pop every
 *  AURA_CLOCK_PERIOD, no seam behind the wearer. Each octave doubles the lattice and its period together. */
const NOISE_GLSL = `
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoiseP(vec2 p, vec2 per) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 i0 = mod(i, per), i1 = mod(i + 1.0, per);
  return mix(mix(h21(i0), h21(vec2(i1.x, i0.y)), u.x), mix(h21(vec2(i0.x, i1.y)), h21(i1), u.x), u.y);
}
float fbmP(vec2 p, vec2 per) { float s = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { s += a * vnoiseP(p, per); p *= 2.0; per *= 2.0; a *= 0.5; } return s; }
// Dagon's fire, by heat (0 cold .. 1 white): the coal's crimson, the fire's orange, the ember's gold, white at the heart
vec3 fireRamp(float v) {
  vec3 c = mix(vec3(0.30, 0.015, 0.01), vec3(0.95, 0.20, 0.03), smoothstep(0.10, 0.45, v));
  c = mix(c, vec3(1.0, 0.62, 0.12), smoothstep(0.45, 0.75, v));
  return mix(c, vec3(1.0, 0.95, 0.78), smoothstep(0.82, 1.0, v));
}
`;
/** The fire's rates, each a whole number of lattice cells over AURA_CLOCK_PERIOD (the ground's flow outward, the
 *  flames' rise and their flicker's), and the lattice's cells round the ring (the ground's, the flames' two). */
export const AURA_FLOW = Object.freeze({ ground: 1.75, rise: 2.4, flicker: 4.8 });
export const AURA_ROUND = Object.freeze({ ground: 18, flames: 26, flicker: 60 });
/** The wrap is whole for every flow: its cells over the clock's period are a whole number. Pure. */
export const auraFlowsWhole = () => Object.values(AURA_FLOW).every((r) => Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6));
const v3 = (c) => `vec3(${c.map((x) => x.toFixed(3)).join(', ')})`;
/** A rate (Hz) as GLSL writes it EXACTLY - a division by a whole period where it has one, else its own decimal - never a
 *  rounded one, which drifts off whole by its rounding times the clock and steps the picture at the wrap. */
const hzGlsl = (hz) => { const per = Math.round(1 / hz); return Math.abs(per * hz - 1) < 1e-12 ? `/ ${per.toFixed(1)}` : `* ${hz}`; };
/** AEGIS: A FLOATING SYMBOL'S FLIGHT - symbol k at the clock `t`: where it is about the feet (xyz, m) and its age (w,
 *  0 lifting off the ring .. 1 gone). Each flight lasts its life and the next begins where it ends; which flight it is
 *  wraps with the clock (the lives divide its period), so the wrap is whole. Each flight lifts off a new place round the
 *  ring, sways as it climbs, drifts outward, and slows toward its top. */
const WARD_FLIGHT_GLSL = `
float wardFlightOf(float k, float t) {
  float life = ${WARD_GLYPH_LIFE[0].toFixed(1)} + mod(k, 3.0);
  return mod(floor(t / life + fract(k * 0.618034)), ${AURA_CLOCK_PERIOD.toFixed(1)} / life);
}
vec4 wardFlight(float k, float t) {
  float life = ${WARD_GLYPH_LIFE[0].toFixed(1)} + mod(k, 3.0);
  float age = fract(t / life + fract(k * 0.618034));
  float h = fract(sin((k * 17.0 + wardFlightOf(k, t)) * 12.9898 + 4.1) * 43758.5453);
  float a = h * 6.283185307179586 + 0.35 * sin(age * 3.0 + k);
  float r = uRingR * (0.9 + 0.3 * age);
  float y = uLift + 0.06 + (1.0 - (1.0 - age) * (1.0 - age)) * ${WARD_GLYPH_RISE.toFixed(2)};
  return vec4(cos(a) * r, y, sin(a) * r, age);
}
`;
/** AEGIS: THE OBLIVION WARD'S SCRIPT AND LIGHT - its strokes as distances (m), lit as one inked line is: a lilac-white
 *  heart, a violet body and a soft violet glow round it. */
const WARD_GLSL = `
const vec3 WARD_VIOLET = ${v3(WARD_RGB.violet)};
const vec3 WARD_HEART = ${v3(WARD_RGB.heart)};
const vec3 WARD_ABYSS = ${v3(WARD_RGB.abyss)};
const int WARD_SCRIPT[${WARD_RUNES}] = int[${WARD_RUNES}](${WARD_SCRIPT.join(', ')});
float segD(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
vec3 inked(float d, float w) {
  float heart = 1.0 - smoothstep(w * 0.35, w * 0.7, d);
  float body = 1.0 - smoothstep(w * 0.5, w * 1.15, d);
  float glow = exp(-d * d / (w * w * 9.0));
  return WARD_HEART * heart * 0.9 + WARD_VIOLET * (body * 0.95 + glow * 0.55);
}
// a rune of the script about q (m: along the ring, out from it): its baseline, its two ends, its beads, outward a comb or
// a chevron, inward a cross - by its bits
float runeD(vec2 q, int bits) {
  const float L = 0.13, B = 0.016;
  vec2 le = vec2(-L, 0.0), re = vec2(L, 0.0);
  float d = segD(q, le, re);
  d = min(d, (bits & 1) != 0 ? abs(length(q - le + vec2(B, 0.0)) - B) : segD(q, le - vec2(0.0, 0.03), le + vec2(0.0, 0.03)));
  d = min(d, (bits & 2) != 0 ? abs(length(q - re - vec2(B, 0.0)) - B) : segD(q, re - vec2(0.0, 0.03), re + vec2(0.0, 0.03)));
  if ((bits & 4) != 0) d = min(d, abs(length(q - vec2(-0.06, 0.0)) - 0.015));
  if ((bits & 8) != 0) d = min(d, abs(length(q - vec2(0.06, 0.0)) - 0.015));
  if ((bits & 16) != 0) { for (int i = -1; i <= 1; i++) d = min(d, segD(q, vec2(float(i) * 0.028, 0.012), vec2(float(i) * 0.028, 0.05))); }
  else d = min(d, min(segD(q, vec2(-0.026, 0.014), vec2(0.0, 0.046)), segD(q, vec2(0.0, 0.046), vec2(0.026, 0.014))));
  if ((bits & 32) != 0) d = min(d, min(segD(q, vec2(-0.02, -0.012), vec2(0.02, -0.048)), segD(q, vec2(0.02, -0.012), vec2(-0.02, -0.048))));
  return d;
}
// a claw hung inward from the ring (s: along it, in from it): a stem, and a crescent whose horns curve back to the ring -
// 0.088 m deep at most, clear of the runes' outward strokes (WARD_RUNE_R + 0.05) as they turn beneath it
float sigilD(vec2 s) {
  vec2 c = s - vec2(0.0, 0.05);
  float horns = c.y > 0.0 ? abs(length(c) - 0.038) : length(vec2(abs(c.x) - 0.038, c.y));
  return min(segD(s, vec2(0.0), vec2(0.0, 0.05)), horns);
}
// how much of the ward is drawn yet: round from behind the wearer (the angle's -x) as it kindles, whole once it has
float wardDrawn(float share) { return clamp((uKindle * 1.1 - share) / 0.1, 0.0, 1.0); }
vec3 wardGround(vec2 p) {
  float r = length(p), a = atan(p.y, p.x);
  if (r > uGroundR) discard;
  float R = uRingR;
  float breath = 0.85 + 0.15 * sin(uTime * TAU ${hzGlsl(WARD_HZ.pulse)});
  // THE RING, whole: one line of light, two scribes of brighter light running round it, a halo in the stone about it
  float dr = abs(r - R);
  float scribe = pow(max(0.0, cos(2.0 * a - uTime * TAU ${hzGlsl(2 * WARD_HZ.scribe)})), 24.0);
  vec3 col = inked(dr, 0.016) * (breath + 0.8 * scribe) + WARD_VIOLET * exp(-dr * dr / 0.012) * 0.14;
  // THE BEZEL: ${WARD_TICKS} fine ticks outside it, a longer one every fourth, turning the other way
  float tu = (a + uTime * TAU ${hzGlsl(WARD_HZ.bezel)}) / TAU * ${WARD_TICKS.toFixed(1)};
  float ti = floor(tu + 0.5);
  float rOut = R + 0.07 + (mod(ti, 4.0) < 0.5 ? 0.035 : 0.0);
  float dTick = length(vec2(abs(tu - ti) * TAU / ${WARD_TICKS.toFixed(1)} * r, max(0.0, max(R + 0.035 - r, r - rOut))));
  col += inked(dTick, 0.009) * 0.35;
  // THE RUNES: the script round a ring within it, turning against it, each lit in turn as the writing passes
  float cu = (a - uTime * TAU ${hzGlsl(WARD_HZ.runes)}) / TAU * ${WARD_RUNES.toFixed(1)};
  float k = mod(floor(cu), ${WARD_RUNES.toFixed(1)});
  vec2 q = vec2((fract(cu) - 0.5) * TAU / ${WARD_RUNES.toFixed(1)} * r, r - ${WARD_RUNE_R.toFixed(3)});
  float written = 0.45 + 0.55 * pow(0.5 + 0.5 * cos(uTime * TAU ${hzGlsl(WARD_HZ.write)} - k / ${WARD_RUNES.toFixed(1)} * TAU), 3.0);
  col += inked(runeD(q, WARD_SCRIPT[int(k)]), 0.011) * written;
  // THE CLAWS at the diagonals, hung from the ring
  float su = a / TAU * ${WARD_SIGILS.toFixed(1)};   // a claw at each cell's middle: the diagonals
  col += inked(sigilD(vec2((fract(su) - 0.5) * TAU / ${WARD_SIGILS.toFixed(1)} * r, R - r)), 0.012) * (0.6 + 0.4 * breath);
  // THE ABYSS within: the void's violet mist turning inside the runes, gone under the feet (where the angle's lattice
  // pinches to a point and would draw it as spokes)
  float u = fract(a / TAU);
  float mist = fbmP(vec2(u * 10.0 - uTime * ${WARD_FLOW.mist.toFixed(3)}, r * 3.0), vec2(10.0, 64.0));
  col += WARD_ABYSS * mist * 0.55 * smoothstep(0.08, 0.38, r) * (1.0 - smoothstep(${(WARD_RUNE_R - 0.15).toFixed(3)}, ${(WARD_RUNE_R + 0.02).toFixed(3)}, r));
  return col * wardDrawn(fract(a / TAU + 0.5)) * (1.0 - smoothstep(uGroundR - 0.2, uGroundR, r));
}
// A FLOATING SYMBOL (uv the card's 0..1, s its age, its rune's place in the script, its number): the script's rune stood
// on end, its strokes blurring as it climbs and eaten by its dust from the edges of the noise in, faded in as it lifts off
// and out as it goes
vec3 wardSymbol(vec2 uv, vec3 s) {
  float age = s.x;
  vec2 q = (uv - 0.5) * vec2(${WARD_GLYPH_W.toFixed(2)}, ${WARD_GLYPH_H.toFixed(2)});
  float d = runeD(vec2(q.y, q.x) / 0.75, WARD_SCRIPT[int(s.y + 0.5)]) * 0.75;
  float n = vnoiseP(uv * vec2(7.0, 11.0) + s.z * 3.7, vec2(64.0));
  float whole = smoothstep(age * 1.25 - 0.3, age * 1.25 - 0.1, n);
  float fade = smoothstep(0.0, 0.1, age) * (1.0 - age * age);
  float edge = smoothstep(0.0, 0.12, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  return inked(d, 0.009 + 0.012 * age) * whole * fade * edge;
}
vec3 wardWall(vec2 q) {
  float u = q.x, v = q.y;
  // THE VEIL: streaks of light standing up off the ring and climbing, gone by the shins
  float n = vnoiseP(vec2(u * 72.0, v * 1.6 - uTime * ${WARD_FLOW.veil.toFixed(3)}), vec2(72.0, ${(WARD_FLOW.veil * AURA_CLOCK_PERIOD).toFixed(1)}));
  vec3 col = WARD_VIOLET * (n * n * n * pow(1.0 - v, 2.2) * 0.55 + exp(-v * 7.0) * 0.18);
  // THE MOTES, rising off the ring each at its own place and pace, dimming as they rise
  float circ = TAU * uRingR;
  for (int m = 0; m < ${WARD_MOTES}; m++) {
    float fm = float(m);
    float h1 = fract(sin(fm * 78.233 + 1.7) * 43758.5453), h2 = fract(sin(fm * 39.425 + 3.1) * 24634.6345);
    float mv = fract(uTime ${hzGlsl(WARD_HZ.mote)} * (1.0 + mod(fm, 3.0)) + h2);
    vec2 dm = vec2((fract(u - h1 + 0.5) - 0.5) * circ, (v - mv) * uFlameH);
    col += (WARD_HEART + WARD_VIOLET) * 0.6 * exp(-dot(dm, dm) / 0.0003) * (1.0 - mv);
  }
  return col * wardDrawn(fract(u + 0.5));
}
`;
/** PRIMARCH: THE GOLDEN RADIANCE'S LIGHT - the column about the body (its wall) and the light it throws on the ground. */
const RADIANCE_GLSL = `
const vec3 RAD_GOLD = ${v3(RADIANCE_RGB.gold)};
const vec3 RAD_HEART = ${v3(RADIANCE_RGB.heart)};
float radianceBreath() { return 0.85 + 0.15 * sin(uTime * TAU ${hzGlsl(RADIANCE_HZ.pulse)}); }
vec3 radianceGround(vec2 p) {
  float r = length(p), a = atan(p.y, p.x);
  if (r > uGroundR) discard;
  float R = uRingR, breath = radianceBreath();
  // THE POOL: the light the column throws, brightest at the feet and gone before the quad's edge
  vec3 col = RAD_GOLD * exp(-r * r / 0.30) * 0.42 * breath;
  // THE RING at the column's foot: a white-gold line in a golden glow
  float dr = r - R;
  col += RAD_GOLD * exp(-dr * dr / 0.0016) * 0.55 * breath + RAD_HEART * exp(-dr * dr / 0.00018) * 0.7;
  // THE RAYS out from the ring across the pool, turning slowly - a whole number round, so no seam behind the wearer
  float ray = pow(0.5 + 0.5 * cos(${RADIANCE_RAYS.toFixed(1)} * (a - uTime * TAU ${hzGlsl(RADIANCE_HZ.rays)})), 8.0);
  col += RAD_GOLD * ray * 0.3 * breath * smoothstep(R * 0.9, R + 0.08, r) * (1.0 - smoothstep(R + 0.15, ${RADIANCE_POOL_R.toFixed(3)}, r));
  return col * (1.0 - smoothstep(uGroundR - 0.2, uGroundR, r));
}
vec3 radianceWall(vec2 q) {
  float u = q.x, v = q.y;
  // A GLOWING SHELL: faint where the eye looks through it (across the body), brightest where it looks along it (the
  // silhouette's two edges) - the horizontal facing of the column's surface to the eye
  float an = u * TAU;
  vec2 e = uCamPos.xz - vWorld.xz;
  float facing = dot(e, e) > 1e-8 ? abs(dot(vec2(cos(an), sin(an)), normalize(e))) : 1.0;
  float rim = 0.14 + 0.86 * pow(1.0 - facing, 2.0);
  // the shafts climbing it, and the column fading toward its top
  float shaft = vnoiseP(vec2(u * ${RADIANCE_ROUND.toFixed(1)}, v * 2.5 - uTime * ${RADIANCE_FLOW.shafts.toFixed(3)}), vec2(${RADIANCE_ROUND.toFixed(1)}, ${(RADIANCE_FLOW.shafts * AURA_CLOCK_PERIOD).toFixed(1)}));
  float rise = (1.0 - smoothstep(0.4, 1.0, v)) * (0.7 + 0.3 * (1.0 - v));   // whole to the chest, gone past the crown
  // never from inside it: the wearer's own first person sees no gold veil, only the motes, dimmer
  float outside = smoothstep(uRingR + 0.1, uRingR + 0.6, length(uCamPos.xz - uAt.xz));
  vec3 col = RAD_GOLD * rim * rise * (0.35 + 0.65 * shaft * shaft) * 0.75 * radianceBreath() * outside;
  // THE MOTES, rising the column's height each at its own place and pace, kindling off the ground and dimming as they go
  float circ = TAU * uRingR, sparks = 0.0;
  for (int m = 0; m < ${RADIANCE_MOTES}; m++) {
    float fm = float(m);
    float h1 = fract(sin(fm * 63.71 + 2.3) * 43758.5453), h2 = fract(sin(fm * 27.13 + 5.9) * 24634.6345);
    float mv = fract(uTime ${hzGlsl(RADIANCE_HZ.mote)} * (1.0 + mod(fm, 3.0)) + h2);
    vec2 dm = vec2((fract(u - h1 + 0.5) - 0.5) * circ, (v - mv) * uFlameH);
    sparks += exp(-dot(dm, dm) / 0.0005) * (1.0 - mv) * smoothstep(0.0, 0.08, mv);
  }
  col += (RAD_HEART + RAD_GOLD) * 0.55 * sparks * mix(0.35, 1.0, outside);
  // kindled UP: the light rising from the feet
  return col * clamp((uKindle * 1.25 - v) / 0.15, 0.0, 1.0);
}
`;
/** SHADOW-CLOAK: THE CLOAK'S SHAPE, both halves' - its frame off the wearer's facing, its radius about the body at a
 *  height, its parting at the front, and the moments a band of it glitches. `u` turns round from the front's middle (0)
 *  by the wearer's right, so the mesh's seam (u 0 = 1) lies inside the parting, where nothing is drawn. */
const CLOAK_SHAPE_GLSL = `
const float CLOAK_TAU = 6.283185307179586;
float cloakHash(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
// the wearer's facing: forward is (sin, cos) in x and z (player/motor.js), the right a quarter turn from it
vec2 cloakFwd() { return vec2(sin(uYaw), cos(uYaw)); }
vec2 cloakBearing(float u) { float th = u * CLOAK_TAU; return cloakFwd() * cos(th) + vec2(cos(uYaw), -sin(uYaw)) * sin(th); }
// 0 at the front's middle, 1 down the back
float cloakBackOf(float u) { return 0.5 - 0.5 * cos(u * CLOAK_TAU); }
// the folds round the cloth: -1 in a crease .. 1 on a ridge, uneven so they read as cloth and not as fluting
float cloakFoldOf(float u) { return cos(u * CLOAK_TAU * ${CLOAK_FOLDS.toFixed(1)} + 0.8 * sin(u * CLOAK_TAU * 3.0)); }
// the radius about the body at y (m up) on bearing u: from broad shoulders - narrower front to back than across, as a
// body is - straight down and flaring at the hem, hanging further out behind; up from the shoulders onto the hood's
// base round the neck; the hood swelling round the head and closing to its peak
float cloakRadius(float u, float y) {
  float c2 = pow(cos(u * CLOAK_TAU), 2.0);
  float shoulder = ${CLOAK_SHOULDER_R.toFixed(3)} * (1.0 - ${CLOAK_SQUASH.shoulder.toFixed(3)} * c2);
  if (y < ${CLOAK_SHOULDER_Y.toFixed(3)}) {
    float s = 1.0 - y / ${CLOAK_SHOULDER_Y.toFixed(3)};
    float squash = mix(${CLOAK_SQUASH.shoulder.toFixed(3)}, ${CLOAK_SQUASH.hem.toFixed(3)}, smoothstep(0.0, 0.8, s));
    return mix(${CLOAK_SHOULDER_R.toFixed(3)}, ${CLOAK_HEM_R.toFixed(3)}, pow(s, 1.6)) * (1.0 - squash * c2) + ${CLOAK_BACK_M.toFixed(3)} * cloakBackOf(u) * s;
  }
  if (y < ${CLOAK_NECK_Y.toFixed(3)}) return mix(shoulder, ${CLOAK_NECK_R.toFixed(3)}, smoothstep(${CLOAK_SHOULDER_Y.toFixed(3)}, ${CLOAK_NECK_Y.toFixed(3)}, y));
  float s = clamp((y - ${CLOAK_NECK_Y.toFixed(3)}) / ${(CLOAK_H - CLOAK_NECK_Y).toFixed(3)}, 0.0, 1.0);
  float swell = mix(${CLOAK_NECK_R.toFixed(3)}, ${CLOAK_HOOD_R.toFixed(3)}, smoothstep(0.0, 0.3, s)) * (1.0 + 0.08 * c2);
  return swell * sqrt(max(0.0, 1.0 - pow(max(0.0, s - 0.4) / 0.6, 2.0)));
}
// how far the hood's axis has fallen back behind the head at y (m): its peak hangs back
float cloakHoodBack(float y) { return ${CLOAK_HOOD_BACK_M.toFixed(3)} * smoothstep(${(CLOAK_NECK_Y + 0.05).toFixed(3)}, ${CLOAK_H.toFixed(3)}, y); }
// the parting at the front, half its width in turns: hanging open below the collar and wider toward the hem, a narrow
// throat over the shoulders, the hood's face open
float cloakOpenHalf(float y) {
  float body = mix(${CLOAK_OPEN.hem.toFixed(3)}, ${CLOAK_OPEN.shoulder.toFixed(3)}, smoothstep(0.0, ${CLOAK_SHOULDER_Y.toFixed(3)}, y));
  float collar = smoothstep(${(CLOAK_SHOULDER_Y - 0.05).toFixed(3)}, ${(CLOAK_SHOULDER_Y + 0.04).toFixed(3)}, y);
  float face = ${CLOAK_OPEN.face.toFixed(3)} * smoothstep(${(CLOAK_NECK_Y - 0.02).toFixed(3)}, ${(CLOAK_NECK_Y + 0.1).toFixed(3)}, y) * (1.0 - smoothstep(${(CLOAK_H - 0.2).toFixed(3)}, ${(CLOAK_H - 0.04).toFixed(3)}, y));
  return max(mix(body, ${CLOAK_OPEN.throat.toFixed(3)}, collar), face);
}
// THE GLITCH: now and then (a hash of each half second) bands of the cloak slip sideways, as a projection skips - the
// slip in metres along the cloth at y (0 when none)
float cloakGlitch(float y, float t) {
  float slot = mod(floor(t * ${CLOAK_HZ.glitch.toFixed(1)}), ${(CLOAK_HZ.glitch * AURA_CLOCK_PERIOD).toFixed(1)});
  float band = floor(y * 9.0);
  float on = step(0.86, cloakHash(vec2(slot, 4.2))) * step(0.55, cloakHash(vec2(slot * 0.73 + band, 9.1)));
  return on * (cloakHash(vec2(band, slot + 2.0)) - 0.5) * 0.07;
}
`;
/** SHADOW-CLOAK: THE CLOAK'S LIGHT AND SHADOW - the fragment half's. Each answers premultiplied: the light it adds (rgb)
 *  and how much of what is behind it the shadow covers (a). */
const g1 = (x) => x.toFixed(1), g3 = (x) => x.toFixed(3);
const CLOAK_FS_GLSL = `
const vec3 CLOAK_CRIMSON = ${v3(CLOAK_RGB.crimson)};
const vec3 CLOAK_HOT = ${v3(CLOAK_RGB.hot)};
const vec3 CLOAK_SHADOW = ${v3(CLOAK_RGB.shadow)};
float cloakBreath() { return 0.85 + 0.15 * sin(uTime * CLOAK_TAU ${hzGlsl(CLOAK_HZ.pulse)}); }
// a hexagonal lattice: how far p (in cells) is from its cell's nearest edge - 0 on an edge, 0.5 at a cell's middle
float cloakHex(vec2 p) {
  vec2 a = mod(p, vec2(1.0, 1.7320508)) - vec2(0.5, 0.8660254);
  vec2 b = mod(p - vec2(0.5, 0.8660254), vec2(1.0, 1.7320508)) - vec2(0.5, 0.8660254);
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 ag = abs(g);
  return 0.5 - max(dot(ag, vec2(0.5, 0.8660254)), ag.x);
}
// THE RAIN: columns of the projection's script falling down the cloth - a bright head and its trail of characters,
// some columns at a time, each at one of three paces
float cloakRain(float u, float y, float t) {
  float cu = u * ${g1(CLOAK_RAIN)};
  float col = floor(cu);
  float hc = cloakHash(vec2(col, 1.3));
  if (hc < 0.45) return 0.0;
  float pace = 1.0 + floor(cloakHash(vec2(col, 7.7)) * 3.0);
  float tail = y / ${g3(CLOAK_H)} - (1.0 - fract(t ${hzGlsl(CLOAK_HZ.rain)} * pace + hc));
  if (tail < 0.0) return 0.0;
  float lane = 1.0 - smoothstep(0.06, 0.16, abs(fract(cu) - 0.5));
  float row = y * 34.0;
  float glyph = step(0.38, cloakHash(vec2(col, floor(row)))) * (1.0 - smoothstep(0.32, 0.42, abs(fract(row) - 0.5)));
  return lane * glyph * (exp(-tail * 7.0) + 2.0 * exp(-tail * 180.0));
}
// a stroke from a to b, its half-width wa at a and wb at b: the distance from p to its edge (m)
float cloakTaper(vec2 p, vec2 a, vec2 b, float wa, float wb) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - mix(wa, wb, h); }
// THE SHADOW FANG'S MARK on the cloak's back (p in m about its middle, x across, y up): the wolf's two fangs curving to
// their points, its slanted eyes over them, and a ring broken at its top and its foot
float cloakSigil(vec2 p) {
  vec2 q = vec2(abs(p.x), p.y);
  float fang = min(min(cloakTaper(q, vec2(0.05, 0.05), vec2(0.056, 0.0), 0.017, 0.015), cloakTaper(q, vec2(0.056, 0.0), vec2(0.046, -0.05), 0.015, 0.009)), cloakTaper(q, vec2(0.046, -0.05), vec2(0.022, -0.095), 0.009, 0.0));
  float eye = cloakTaper(q, vec2(0.028, 0.085), vec2(0.082, 0.108), 0.007, 0.004);
  float ring = max(abs(length(p) - ${g3(CLOAK_SIGIL_R)}) - 0.006, 0.045 - q.x);
  return min(min(fang, eye), ring);
}
vec4 cloakWall(vec2 q) {
  float u = q.x, v = q.y, y = v * uFlameH, t = uTime;
  // KINDLED UP, built as a projection is: nothing over the line the build has reached, a hot line along it
  float build = uKindle * 1.15 - 0.075;
  if (v > build + 0.004) discard;
  float r = max(cloakRadius(u, y), 0.04);
  // THE PARTING at the front: metres into the cloth from its edge
  float edgeM = (min(u, 1.0 - u) - cloakOpenHalf(y)) * CLOAK_TAU * r;
  if (edgeM < 0.0) discard;
  // THE HEM, torn - and coming apart over its last hand's breadth in blocks, each moment its own, as a projection does
  float hemM = y - (0.03 + 0.05 * vnoiseP(vec2(u * 30.0, 0.5), vec2(30.0, 8.0)) + 0.09 * pow(vnoiseP(vec2(u * 11.0, 2.5), vec2(11.0, 8.0)), 3.0));
  if (hemM < 0.0) discard;
  float shred = mod(floor(t * ${g1(CLOAK_HZ.shred)}), ${g1(CLOAK_HZ.shred * AURA_CLOCK_PERIOD)});
  if (cloakHash(floor(vec2(u * 120.0, y * 42.0)) + vec2(0.0, shred * 0.37)) < (1.0 - smoothstep(0.0, 0.14, hemM)) * 0.75) discard;
  float breath = cloakBreath();
  // a glitching band's patterns slip with the cloth
  float g = cloakGlitch(y, t);
  float ug = u + g / (CLOAK_TAU * r);
  // THE SHADOW: denser where the eye looks along the cloth (its edges against the world) than through it, smoke
  // climbing it, scanlines through it, its folds
  vec3 e = uCamPos - vWorld;
  vec2 ex = dot(e.xz, e.xz) > 1e-8 ? normalize(e.xz) : cloakBearing(u);
  float toward = dot(cloakBearing(u), ex);
  float rim = pow(1.0 - abs(toward), 2.0);
  // the cloth's inside (its far side, seen through the near or through the parting) lit less, so the near side reads
  float outer = toward > 0.0 ? 1.0 : 0.45;
  float smoke = fbmP(vec2(ug * 14.0, y * 2.4 - t * ${g3(CLOAK_FLOW.smoke)}), vec2(14.0, ${g1(CLOAK_FLOW.smoke * AURA_CLOCK_PERIOD)}));
  float scan = 0.5 + 0.5 * cos(y * 340.0);
  float fold = cloakFoldOf(ug) * smoothstep(0.0, 0.6, 1.0 - y / ${g3(CLOAK_SHOULDER_Y)});
  // the interference a projection carries: broad bands drifting down it
  float drift = 0.5 + 0.5 * sin(y * 16.0 + t * CLOAK_TAU ${hzGlsl(CLOAK_HZ.ripple)});
  float shade = (0.6 + 0.28 * rim + 0.24 * smoke) * (0.82 + 0.18 * scan) * (0.82 + 0.18 * fold) * (0.92 + 0.08 * drift);
  vec3 col = CLOAK_SHADOW * shade * 0.5;
  col += CLOAK_CRIMSON * (rim * rim * 0.6 + 0.04 * pow(scan, 10.0) * (0.4 + rim) + 0.09 * pow(max(fold, 0.0), 3.0) * (0.3 + rim) * (0.5 + smoke) + 0.025 * drift) * breath;
  // THE SCAN climbing the cloak every few seconds, the lattice lit in its wake and flaring here and there
  float sd = v - (fract(t ${hzGlsl(CLOAK_HZ.scan)}) * 1.3 - 0.15);
  float swept = sd < 0.0 ? exp(sd * 9.0) : 0.0;
  col += (CLOAK_HOT * 0.4 + CLOAK_CRIMSON * 0.45) * (exp(-sd * sd / 0.00003) + 0.35 * exp(-pow(sd + 0.03, 2.0) / 0.00001)) * (0.4 + 0.6 * rim + 0.3 * smoke);
  float hx = cloakHex(vec2(ug * ${g1(CLOAK_HEX_ROUND)}, y / 0.075));
  float flare = smoothstep(0.66, 0.82, vnoiseP(vec2(ug * 10.0, y * 3.0 + mod(floor(t * ${g1(CLOAK_HZ.glitch)}), ${g1(CLOAK_HZ.glitch * AURA_CLOCK_PERIOD)}) * 1.7), vec2(10.0, 4096.0)));
  col += CLOAK_CRIMSON * exp(-hx * hx / 0.0012) * (0.03 + 0.8 * swept + 0.4 * flare) * 0.5;
  // THE RAIN of its script
  col += mix(CLOAK_CRIMSON, CLOAK_HOT, 0.3) * cloakRain(ug, y, t) * 0.55;
  // THE TRIMS: a hot line along the parting and a dashed one inside it; the circuit across the shoulders with its
  // nodes; the torn hem lit along its tear
  float trim = exp(-pow(edgeM - 0.012, 2.0) / 0.00002) + 0.5 * exp(-pow(edgeM - 0.042, 2.0) / 0.00001) * step(0.5, fract(y * 12.0));
  float hem = exp(-pow(hemM - 0.016, 2.0) / 0.00003);
  float yy = y - ${g3(CLOAK_SHOULDER_Y - 0.03)};
  float yoke = exp(-yy * yy / 0.00002) + 0.5 * exp(-pow(yy + 0.035, 2.0) / 0.00001);
  float nx = (fract(ug * 12.0 + 0.5) - 0.5) / 12.0 * CLOAK_TAU * r;
  float node = exp(-(nx * nx + yy * yy) / 0.00012);
  col += (CLOAK_HOT * 0.55 + CLOAK_CRIMSON) * (trim * 1.1 + hem * 0.9 + yoke * 0.6 + node * 0.8) * breath;
  // THE MARK on its back, burning through the shadow
  float sig = cloakSigil(vec2((u - 0.5) * CLOAK_TAU * r + g, y - ${g3(CLOAK_SIGIL_Y)}));
  col += (CLOAK_HOT * (1.0 - smoothstep(0.0, 0.004, sig)) * 0.9 + CLOAK_CRIMSON * exp(-max(sig, 0.0) * 60.0) * 0.6) * breath;
  // the build's front, while it builds
  col = col * outer + (CLOAK_HOT + CLOAK_CRIMSON) * exp(-pow((v - build) * 90.0, 2.0)) * 1.5;
  shade *= mix(0.85, 1.0, outer);
  // FLICKER: now and then the whole projection stutters - thinner, brighter
  float flick = cloakHash(vec2(mod(floor(t * ${g1(CLOAK_HZ.flicker)}), ${g1(CLOAK_HZ.flicker * AURA_CLOCK_PERIOD)}), 2.9)) > 0.965 ? 0.5 : 1.0;
  // never from inside it: the wearer's own first person sees no shadow over the view
  float outside = smoothstep(0.55, 1.0, length(uCamPos.xz - uAt.xz));
  return vec4(col * outside * (2.0 - flick), clamp(shade, 0.0, 0.92) * flick * outside);
}
vec4 cloakGround(vec2 p) {
  float r = length(p), a = atan(p.y, p.x);
  if (r > uGroundR) discard;
  float u = fract(a / CLOAK_TAU), t = uTime, breath = cloakBreath();
  // THE SHADOW it pools under it, smoke turning in it and drawn in toward the feet
  float mist = fbmP(vec2(u * 12.0 + t * ${g3(CLOAK_FLOW.swirl)}, r * 3.0 + t * ${g3(CLOAK_FLOW.mist)}), vec2(12.0, ${g1(CLOAK_FLOW.mist * AURA_CLOCK_PERIOD)}));
  float pool = 1.0 - smoothstep(0.3, ${g3(CLOAK_POOL_R)}, r);
  float shade = pool * (0.48 + 0.32 * mist);
  vec3 col = CLOAK_CRIMSON * pool * pool * 0.06 * breath;
  // THE EMITTER just outside the hem: dashes turning round it, a hairline inside it
  float dr = r - ${g3(CLOAK_EMITTER_R)};
  float du = fract((u + t ${hzGlsl(CLOAK_HZ.dashes)}) * ${g1(CLOAK_DASHES)});
  float dash = smoothstep(0.08, 0.16, du) * (1.0 - smoothstep(0.84, 0.92, du));
  col += (CLOAK_HOT * 0.5 + CLOAK_CRIMSON) * exp(-dr * dr / 0.00008) * dash * breath + CLOAK_CRIMSON * exp(-dr * dr / 0.0015) * 0.12;
  float dh = r - ${g3(CLOAK_EMITTER_R - 0.045)};
  col += CLOAK_CRIMSON * exp(-dh * dh / 0.00002) * 0.35;
  // THE BEZEL: a fine circle, its ticks turning the other way, a longer one every fifth
  float tu = (u - t ${hzGlsl(CLOAK_HZ.ticks)}) * ${g1(CLOAK_TICKS)};
  float ti = floor(tu + 0.5);
  float tl = mod(ti, 5.0) < 0.5 ? 0.05 : 0.025;
  float dTick = length(vec2(abs(tu - ti) / ${g1(CLOAK_TICKS)} * CLOAK_TAU * r, max(0.0, max(${g3(CLOAK_BEZEL_R)} - r, r - ${g3(CLOAK_BEZEL_R)} - tl))));
  float dz = r - ${g3(CLOAK_BEZEL_R)};
  col += CLOAK_CRIMSON * (exp(-dTick * dTick / 0.000012) * 0.45 + exp(-dz * dz / 0.000008) * 0.3);
  // THE BRACKETS: arcs turning about it all, their ends turned in
  float bu = fract((u + t ${hzGlsl(CLOAK_HZ.brackets)}) * ${g1(CLOAK_BRACKETS)});
  float arc = smoothstep(0.3, 0.32, bu) * (1.0 - smoothstep(0.68, 0.7, bu));
  float db = r - ${g3(CLOAK_BRACKET_R)};
  float capD = min(abs(bu - 0.31), abs(bu - 0.69)) / ${g1(CLOAK_BRACKETS)} * CLOAK_TAU * r;
  float cap = exp(-capD * capD / 0.00002) * step(r, ${g3(CLOAK_BRACKET_R)}) * step(${g3(CLOAK_BRACKET_R - 0.05)}, r);
  col += CLOAK_CRIMSON * (exp(-db * db / 0.00003) * arc + cap) * 0.55 * breath;
  // THE SWEEP: a wedge of light turning inside the bezel, the lattice lit in its wake
  float su = fract(t ${hzGlsl(CLOAK_HZ.sweep)} - u);
  float within = (1.0 - smoothstep(${g3(CLOAK_BEZEL_R - 0.06)}, ${g3(CLOAK_BEZEL_R)}, r)) * smoothstep(0.1, 0.25, r);
  float wake = exp(-su * 7.0) * within;
  float lead = min(su, 1.0 - su) * CLOAK_TAU * r;
  float hx = cloakHex(p / 0.085);
  float clear = smoothstep(${g3(CLOAK_HEM_R)}, ${g3(CLOAK_HEM_R + 0.08)}, r);   // none of it under the cloak, where the shadow pools
  col += CLOAK_CRIMSON * (wake * 0.12 + exp(-hx * hx / 0.002) * wake * 0.55 * clear + exp(-lead * lead / 0.0002) * within * 0.5) * breath;
  // KINDLED out from the feet; the quad's edge soft
  float vis = (1.0 - smoothstep(uKindle * 1.4 - 0.1, uKindle * 1.4, r)) * (1.0 - smoothstep(uGroundR - 0.2, uGroundR, r));
  return vec4(col * vis, clamp(shade, 0.0, 0.9) * vis);
}
// A WISP (uv its card's 0..1, s its age and its number): a puff of the cloak's shadow burning away at its edges as it
// rises - smoke inside, a crimson line where it burns, gone as it ends
vec4 cloakWisp(vec2 uv, vec3 s) {
  float age = s.x;
  // A TONGUE OF SHADOW: broad at its root and drawn to a point as it rises, its edges eaten by noise from the tip down,
  // more of it gone the older it is; a broken crimson line where it burns
  float x = (uv.x - 0.5 - 0.16 * uv.y * sin(uv.y * 5.0 + s.z * 2.3 + age * 4.0)) / mix(0.42, 0.08, uv.y);   // curling as it rises
  float n = fbmP(uv * vec2(3.0, 5.0) + vec2(s.z * 3.1, -age * 2.4), vec2(64.0));
  float body = (1.0 - x * x) * smoothstep(0.0, 0.25, uv.y) + (n - 0.5) * 0.9 - age * 0.5 - uv.y * 0.35;
  float smoke = smoothstep(0.0, 0.45, body);
  float burn = exp(-body * body / 0.006) * (0.55 + 0.45 * vnoiseP(uv * vec2(9.0, 14.0) + s.z, vec2(64.0)));
  float ember = exp(-body * body / 0.0006);
  float fade = smoothstep(0.0, 0.15, age) * (1.0 - age) * smoothstep(0.8, 1.0, uKindle);
  float edge = smoothstep(0.0, 0.08, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  return vec4((CLOAK_CRIMSON * 1.3 * burn + CLOAK_HOT * 0.6 * ember + CLOAK_SHADOW * smoke * 0.3) * fade * edge, smoke * fade * 0.32 * edge);
}
`;
/** SHADOW-CLOAK: where the cloak's mesh stands, and its wisps' flights - the vertex half's alone. */
const CLOAK_VS_GLSL = `
// the hem's billow and a ripple running down the cloth - most at the hem and down the back, none at the shoulders
float cloakBillow(float u, float y, float t) {
  float s = clamp(1.0 - y / ${CLOAK_SHOULDER_Y.toFixed(3)}, 0.0, 1.0);
  float th = u * CLOAK_TAU;
  float w = 0.024 * sin(3.0 * th + t * CLOAK_TAU ${hzGlsl(CLOAK_HZ.billow)}) + 0.012 * sin(5.0 * th - t * CLOAK_TAU ${hzGlsl(CLOAK_HZ.ripple)} + y * 6.0);
  return w * pow(s, 1.5) * (0.35 + 0.65 * cloakBackOf(u));
}
vec3 cloakPoint(vec2 q, float t) {
  float u = q.x, y = q.y * uFlameH;
  float folds = ${CLOAK_FOLD_M.toFixed(3)} * cloakFoldOf(u) * smoothstep(0.05, 0.85, 1.0 - y / ${CLOAK_SHOULDER_Y.toFixed(3)});
  vec2 d = cloakBearing(u) * (cloakRadius(u, y) + folds + cloakBillow(u, y, t)) - cloakFwd() * cloakHoodBack(y);
  d += cloakBearing(u + 0.25) * cloakGlitch(y, t);
  return uAt + vec3(d.x, uLift + y, d.y);
}
// a wisp k at the clock t: where it is about the feet (xyz, m) and its age (w, 0 peeling off .. 1 gone); each lasts its
// life and the next peels off somewhere else on the back half, from the hip to the shoulders, rising, drifting back
float cloakWispOf(float k, float t) {
  float life = ${CLOAK_WISP_LIFE[0].toFixed(1)} + mod(k, 3.0);
  float n = floor(t / life + fract(k * 0.618034));
  return mod(n, ${AURA_CLOCK_PERIOD.toFixed(1)} / life);   // which wisp this is wraps with the clock (the lives divide its period)
}
vec4 cloakWispFlight(float k, float t) {
  float life = ${CLOAK_WISP_LIFE[0].toFixed(1)} + mod(k, 3.0);
  float age = fract(t / life + fract(k * 0.618034));
  float n = cloakWispOf(k, t);
  float u = 0.5 + (cloakHash(vec2(k * 17.0 + n, 4.1)) - 0.5) * 0.7;
  float y0 = 0.35 + cloakHash(vec2(k * 5.0 + n, 8.3)) * 1.1;
  float y = y0 + (1.0 - (1.0 - age) * (1.0 - age)) * ${CLOAK_WISP_RISE.toFixed(2)};
  vec2 d = cloakBearing(u) * (cloakRadius(u, y0) + 0.03 + 0.14 * age) - cloakFwd() * 0.1 * age;
  return vec4(d.x, uLift + y, d.y, age);
}
`;
export const AURA_VS = HEAD + `layout(location = 0) in vec2 aP;   // the ground: a corner -1..1; the flames: x the step round 0..1, y up 0..1; a symbol: x its number * 2 + the corner's u, y its v
uniform mat4 uVP;
uniform int uKind;      // 0 the ground, 1 the flames, 2 the ward's floating symbols (AEGIS)
uniform int uAura;      // SHADOW-CLOAK: the cloak's wall is its own mesh, and its third draw its wisps
uniform vec3 uAt;       // the feet
uniform float uGroundR, uRingR, uFlameH, uLift;
uniform float uTime;    // AEGIS: a symbol's flight
uniform float uYaw;     // SHADOW-CLOAK: the wearer's facing
uniform vec3 uCamPos;   // AEGIS: the eye a symbol faces
out vec2 vP;            // the ground: metres about the feet; the flames: (the angle's share, the height's); a symbol: its card's uv
out vec3 vWorld;
out vec3 vS;            // AEGIS: a symbol's age, its rune's place in the script and its number
${WARD_FLIGHT_GLSL}${CLOAK_SHAPE_GLSL}${CLOAK_VS_GLSL}
void main() {
  vec3 w;
  vS = vec3(0.0);
  if (uKind == 0) {
    vP = aP * uGroundR;
    w = uAt + vec3(vP.x, uLift, vP.y);
  } else if (uKind == 1 && uAura == 3) {
    // SHADOW-CLOAK: the cloak's cloth, (u round from the front, v up) on its own mesh
    vP = aP;
    w = cloakPoint(aP, uTime);
  } else if (uKind == 1) {
    float a = aP.x * 6.283185307179586;
    vP = aP;
    w = uAt + vec3(cos(a) * uRingR, uLift + aP.y * uFlameH, sin(a) * uRingR);
  } else if (uAura == 3) {
    // SHADOW-CLOAK: A WISP - its card at its flight's place, upright, turned round the vertical to the eye, growing as
    // it burns away
    float k = floor(aP.x * 0.5);
    vP = vec2(aP.x - k * 2.0, aP.y);
    vec4 f = cloakWispFlight(k, uTime);
    vec3 c = uAt + f.xyz;
    vec2 toEye = uCamPos.xz - c.xz;
    toEye = dot(toEye, toEye) > 1e-8 ? normalize(toEye) : vec2(0.0, 1.0);
    vec2 o = (vP - 0.5) * vec2(${CLOAK_WISP_W.toFixed(2)}, ${CLOAK_WISP_H.toFixed(2)}) * (1.0 + 0.8 * f.w);
    w = c + vec3(toEye.y, 0.0, -toEye.x) * o.x + vec3(0.0, o.y, 0.0);
    vS = vec3(f.w, 0.0, k);
  } else {
    // AEGIS: A FLOATING SYMBOL - its card at its flight's place, upright and turned round the vertical to face the eye,
    // tilting a little as it climbs and growing as it fades
    float k = floor(aP.x * 0.5);
    vP = vec2(aP.x - k * 2.0, aP.y);
    vec4 f = wardFlight(k, uTime);
    vec3 c = uAt + f.xyz;
    vec2 d = uCamPos.xz - c.xz;
    d = dot(d, d) > 1e-8 ? normalize(d) : vec2(0.0, 1.0);
    float tilt = 0.22 * sin(f.w * 5.0 + k * 1.7);
    vec2 o = (vP - 0.5) * vec2(${WARD_GLYPH_W.toFixed(2)}, ${WARD_GLYPH_H.toFixed(2)}) * (1.0 + 0.35 * f.w);
    o = vec2(o.x * cos(tilt) - o.y * sin(tilt), o.x * sin(tilt) + o.y * cos(tilt));
    w = c + vec3(d.y, 0.0, -d.x) * o.x + vec3(0.0, o.y, 0.0);
    vS = vec3(f.w, mod(k * 5.0 + wardFlightOf(k, uTime), ${WARD_RUNES.toFixed(1)}), k);
  }
  vWorld = w;
  gl_Position = uVP * vec4(w, 1.0);
}`;
export const AURA_FS = HEAD + `in vec2 vP;
in vec3 vWorld;
in vec3 vS;             // AEGIS: a floating symbol's age, rune and number
uniform int uKind;
uniform int uAura;      // AEGIS: 0 Dagon's Fire, 1 the Oblivion Ward, 2 the Golden Radiance (AURA_LOOK - PRIMARCH), 3 the Holo Shadow Cloak (SHADOW-CLOAK)
uniform vec3 uAt;       // PRIMARCH: the feet - the axis the radiance's column stands on
uniform float uYaw;     // SHADOW-CLOAK: the wearer's facing - the cloak's parting is at their front
uniform float uTime, uSeed, uKindle, uRingR, uGroundR, uFlameH;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}${NOISE_GLSL}
const float TAU = 6.283185307179586;
${WARD_GLSL}${RADIANCE_GLSL}${CLOAK_SHAPE_GLSL}${CLOAK_FS_GLSL}
void main() {
  if (uAura == 3) {   // SHADOW-CLOAK: premultiplied - the light it adds, and how much the shadow covers; both fogged
    vec4 c = uKind == 0 ? cloakGround(vP) : uKind == 1 ? cloakWall(vP) : cloakWisp(vP, vS);
    float f = fogFactorAt(vWorld) * uKindle;
    o = vec4(c.rgb * f, c.a * f);
    return;
  }
  if (uAura == 2) { vec3 rad = uKind == 0 ? radianceGround(vP) : radianceWall(vP); o = vec4(rad * uKindle * fogFactorAt(vWorld), 1.0); return; }   // PRIMARCH
  if (uAura == 1) { vec3 ward = uKind == 0 ? wardGround(vP) : uKind == 1 ? wardWall(vP) : wardSymbol(vP, vS); o = vec4(ward * uKindle * fogFactorAt(vWorld), 1.0); return; }   // AEGIS
  // every rate a whole number of cycles over the clock, in turns a second times TAU - never a rounded radian rate, which
  // drifts off whole by its rounding times the period and steps the picture at the wrap
  float turn = uTime * TAU * ${AURA_TURN_HZ.toFixed(3)};   // the ring's own turn
  vec3 col;
  if (uKind == 0) {
    float r = length(vP), a = atan(vP.y, vP.x);
    if (r > uGroundR) discard;
    float u = fract((a + turn) / TAU);            // the angle, carried round with the turn
    // the fire in the band: noise flowing round the ring and outward, broken into tongues
    float flow = fbmP(vec2(u * ${AURA_ROUND.ground.toFixed(1)} + floor(uSeed * 7.0), r * 3.2 - uTime * ${AURA_FLOW.ground.toFixed(3)}), vec2(${AURA_ROUND.ground.toFixed(1)}, ${(AURA_FLOW.ground * AURA_CLOCK_PERIOD).toFixed(1)}));
    float band = 1.0 - smoothstep(0.0, 0.26, abs(r - uRingR - (flow - 0.5) * 0.16));   // edges in order: GLSL leaves smoothstep's reversed edges undefined
    float crest = 0.55 + 0.45 * sin(u * TAU * 7.0 - uTime * TAU * 1.5);   // bright crests chasing about it
    float heat = band * (0.35 + 0.65 * flow) * (0.7 + 0.3 * crest);
    // the embers: ten sparks circling in the band, each at a whole multiple of the turn and its own wander
    float ember = 0.0;
    for (int k = 0; k < 10; k++) {
      float fk = float(k), s = fract(sin(fk * 91.7 + uSeed * 13.1) * 43758.5);
      float ea = fk / 10.0 * TAU + turn * (1.0 + floor(s * 3.0)) + s * TAU;
      float er = uRingR + 0.12 * sin(uTime * TAU * 0.25 * (1.0 + fk * 0.5) + fk);
      vec2 ep = vec2(cos(ea), sin(ea)) * er;
      float d = length(vP - ep);
      ember += exp(-d * d * 900.0) * (0.6 + 0.4 * sin(uTime * TAU * 1.5 + fk * 3.0));
    }
    // the glow in the stone within, and the ring's edge soft
    float inner = 0.22 * (1.0 - smoothstep(0.0, uRingR, r)) * (0.8 + 0.2 * sin(uTime * TAU / 3.0 + uSeed));
    float edge = 1.0 - smoothstep(uGroundR - 0.35, uGroundR, r);
    col = fireRamp(clamp(heat * 1.05, 0.0, 1.0)) * heat * 0.95 + vec3(1.0, 0.72, 0.30) * ember * 1.2 + vec3(0.55, 0.08, 0.02) * inner;
    col *= edge;
  } else {
    float u = fract(vP.x + turn / TAU), v = vP.y;
    // TONGUES: noise stretched up the wall and scrolled up and round, swaying; a flame stands where the noise clears a
    // threshold rising with the height, so the tongues thin and part toward their tips, a hot heart where it clears most
    float sway = 0.012 * sin(v * 9.0 + uTime * TAU * 1.5 + u * TAU * 5.0);
    float n = fbmP(vec2((u + sway) * ${AURA_ROUND.flames.toFixed(1)} + floor(uSeed * 5.0), v * 1.3 - uTime * ${AURA_FLOW.rise.toFixed(3)}), vec2(${AURA_ROUND.flames.toFixed(1)}, ${(AURA_FLOW.rise * AURA_CLOCK_PERIOD).toFixed(1)}));
    float n2 = vnoiseP(vec2(u * ${AURA_ROUND.flicker.toFixed(1)}, v * 3.0 - uTime * ${AURA_FLOW.flicker.toFixed(3)}), vec2(${AURA_ROUND.flicker.toFixed(1)}, ${(AURA_FLOW.flicker * AURA_CLOCK_PERIOD).toFixed(1)}));
    float f = n * 0.8 + n2 * 0.25;
    float th = 0.28 + v * 0.62;
    float body = smoothstep(th - 0.06, th + 0.10, f);
    float core = smoothstep(th + 0.06, th + 0.25, f);
    float fade = pow(1.0 - v, 1.3);
    col = (fireRamp(0.3 + 0.45 * core) * body * 0.8 + vec3(1.0, 0.8, 0.45) * core * 0.3) * fade;
  }
  o = vec4(col * uKindle * fogFactorAt(vWorld), 1.0);
}`;

const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOCUS = new Float32Array(4);   // AUDIT DEEP R-1: no travel view - w 0, the fog measures from the camera
function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return out;
}

/** The flames' strip: AURA_STEPS quads round, two triangles each, as (step, up) pairs. Pure. */
export function auraFlameStrip() {
  const out = [];
  for (let i = 0; i < AURA_STEPS; i++) {
    const a = i / AURA_STEPS, b = (i + 1) / AURA_STEPS;
    out.push(a, 0, b, 0, b, 1, a, 0, b, 1, a, 1);
  }
  return new Float32Array(out);
}

/** AEGIS: the floating symbols' cards - `n` quads, two triangles each, as (number * 2 + the corner's u, its v). Pure. */
export function auraGlyphCards(n) {
  const out = [];
  for (let k = 0; k < n; k++) for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) out.push(k * 2 + u, v);
  return new Float32Array(out);
}

/** SHADOW-CLOAK: the cloak's mesh - CLOAK_ROUND steps round by CLOAK_ROWS up, two triangles a cell, as (u round from the
 *  front, v up) pairs. Pure. */
export function auraCloakGrid() {
  const out = [];
  for (let j = 0; j < CLOAK_ROWS; j++) {
    const v0 = j / CLOAK_ROWS, v1 = (j + 1) / CLOAK_ROWS;
    for (let i = 0; i < CLOAK_ROUND; i++) {
      const u0 = i / CLOAK_ROUND, u1 = (i + 1) / CLOAK_ROUND;
      out.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
    }
  }
  return new Float32Array(out);
}
/** The cards the third draw has to hand: the most any look floats (the ward's symbols, the cloak's wisps). */
export const AURA_CARDS = Math.max(...Object.values(AURA_LOOK).map((l) => l.glyphs));

export class AuraRingRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, AURA_VS, AURA_FS, 'aura ring');
    this.u = {};
    for (const n of ['uVP', 'uKind', 'uAura', 'uAt', 'uGroundR', 'uRingR', 'uFlameH', 'uLift', 'uTime', 'uSeed', 'uKindle', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus', 'uYaw']) this.u[n] = gl.getUniformLocation(this.program, n);
    this.quadVao = gl.createVertexArray();
    gl.bindVertexArray(this.quadVao);
    this.quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.flameVao = gl.createVertexArray();
    gl.bindVertexArray(this.flameVao);
    this.flameBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.flameBuf);
    gl.bufferData(gl.ARRAY_BUFFER, auraFlameStrip(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.glyphVao = gl.createVertexArray();   // AEGIS: the ward's floating symbols
    gl.bindVertexArray(this.glyphVao);
    this.glyphBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.glyphBuf);
    gl.bufferData(gl.ARRAY_BUFFER, auraGlyphCards(AURA_CARDS), gl.STATIC_DRAW);   // SHADOW-CLOAK: as many as the most any look floats
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    this.cloakVao = gl.createVertexArray();   // SHADOW-CLOAK: the cloak's cloth
    gl.bindVertexArray(this.cloakVao);
    this.cloakBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.cloakBuf);
    gl.bufferData(gl.ARRAY_BUFFER, auraCloakGrid(), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    /** how many auras the last draw burned, for the stats and the tests */
    this.drawn = 0;
  }

  /**
   * Draw the frame's auras - `list` `[{ at: [x, y, z] the wearer's feet in the scene, aura?, seed?, kindle? 0..1, yaw? }]`
   * (already picked: auraWearers) - with the frame's camera, its clock (`seconds`) and its fog as the renderer set it
   * ({ mode, density, range, camPos, focus }). Each in its own aura's look (AURA_LOOK - AEGIS); SHADOW-CLOAK: `yaw` the
   * wearer's facing (forward (sin, cos) in x, z - 0 when not given), which the cloak's parting faces. Nothing to draw,
   * nothing touched.
   */
  draw(list, proj, view, eye, seconds, fog = null) {
    this.drawn = 0;
    if (!Array.isArray(list) || !list.length) return;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform1f(U.uTime, auraClock(seconds));
    gl.uniform1f(U.uGroundR, AURA_GROUND_R); gl.uniform1f(U.uLift, AURA_LIFT_M);   // AEGIS: the ring's radius and the wall's height per wearer, below
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye);
    if (U.uFocus) gl.uniform4fv(U.uFocus, fog?.focus ?? NO_FOCUS);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -4);   // the ground's fire over the stone it lies on
    for (const w of list) {
      if (!w || !Array.isArray(w.at)) continue;
      gl.uniform3f(U.uAt, w.at[0], w.at[1], w.at[2]);
      gl.uniform1f(U.uSeed, Number.isFinite(w.seed) ? w.seed : 0);
      gl.uniform1f(U.uKindle, Math.max(0, Math.min(1, Number.isFinite(w.kindle) ? w.kindle : 1)));
      const look = auraLookOf(w.aura);   // AEGIS: the fire or the ward, at its own radius and height
      gl.uniform1i(U.uAura, look.kind);
      gl.uniform1f(U.uRingR, look.ringR); gl.uniform1f(U.uFlameH, look.flameH);
      gl.uniform1f(U.uYaw, Number.isFinite(w.yaw) ? w.yaw : 0);   // SHADOW-CLOAK: the facing its parting is at
      // SHADOW-CLOAK: a look that SHADES is drawn premultiplied - its light added, what is behind it covered by its alpha
      // - and every other look as it always was, its light added whole
      if (look.shade) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1i(U.uKind, 0);
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.uniform1i(U.uKind, 1);
      if (look.mesh === 'cloak') {   // SHADOW-CLOAK: the cloak's cloth, not the strip
        gl.bindVertexArray(this.cloakVao);
        gl.drawArrays(gl.TRIANGLES, 0, CLOAK_ROUND * CLOAK_ROWS * 6);
      } else {
        gl.bindVertexArray(this.flameVao);
        gl.drawArrays(gl.TRIANGLES, 0, AURA_STEPS * 6);
      }
      if (look.glyphs) {   // AEGIS: the ward's floating symbols, a third draw
        gl.uniform1i(U.uKind, 2);
        gl.bindVertexArray(this.glyphVao);
        gl.drawArrays(gl.TRIANGLES, 0, look.glyphs * 6);
      }
      if (look.shade) gl.blendFunc(gl.ONE, gl.ONE);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
