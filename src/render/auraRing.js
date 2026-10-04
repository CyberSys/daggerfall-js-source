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
// SHADOW-CLOAK (2026-10-04, Mac, for SirMcMobdon: "A holo shadow cloak with red accents. Extremely detailed"; then "less
// digital, adjust hood since it's at a weird orientation, not as tall, more cape like, change the floating elements to
// be more emblem like", "For the emblems have it use that user's glyph", "when the user transforms into a werewolf have
// this rip apart with fragments floating around"): THE HOLO SHADOW CLOAK, the fourth look - a CAPE ON THE BODY in the
// Shadow Fang's black and crimson, its hood up:
//   - THE WALL is its own mesh (auraCloakGrid), shaped in the vertex half round the wearer's facing (`uYaw`): hung from
//     the shoulders, clasped at the throat, open below it, flaring and trailing longest down the back, the hood round
//     the head. It SHADES - drawn premultiplied (AURA_LOOK `shade`) so it darkens what is behind it - and its two sides
//     are two draws (`uSide`) culled by the bent mesh's own winding, its lining before its outside. A dense shadow
//     outside, a red lining, a mantle, embroidery down its opening, a hem fraying into smoke.
//   - THE EMBLEM is the wearer's own glyph: the badge's path (ui/playerBadge.js GLYPH_PATH.shadowfang) cut into edges
//     (glyphEdges) and filled in the shader - on its back, as its clasp, and on the THIRD DRAW's cards rising off it.
//   - THE GROUND: a pool of shadow under it.
//   - TORN when its wearer turns beast (`uTorn`, auraBeastStep): it splits and goes, and the third draw's cards past
//     the emblems are its shreds, floating round the beast.
//   - IT MOVES WITH THE BODY (Mac: "Tie the cape to animations"): the pose off the body's posed bones as it was drawn
//     (auraCapePose: `uCapeS` the shoulders, `uCapeH` the head, `uKneeL`/`uKneeR` the knees - fpArm.thirdBones mine,
//     peerBodies.bonesOf a peer's), and a swing off how the wearer moves (auraMotionStep, a damped spring: `uSwing`).
// Every rate whole over the clock (cloakRatesWhole). The pass draws its wearers farthest first (AUDIT).
//
// Not a DFU member. Ledger A (WB).
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';
import { GLYPH_PATH, GLYPH_DETAIL } from '../ui/playerBadge.js';   // SHADOW-CLOAK: the wearer's own glyph, its emblem

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
/** SHADOW-CLOAK: THE SHADOW CLOAK'S MEASURES (m above the feet; the walking body is 1.8 m, its eye at 1.7 - player/motor.js
 *  CAPSULE_HEIGHT, EYE_HEIGHT). A CAPE hung from the shoulders and clasped at the throat, its hood up: the hood's peak
 *  a hand over the crown, the hood's middle at the eye, the neck the cape draws in to over the shoulders, the clasp, and
 *  the shoulders it hangs from. */
export const CLOAK_H = 1.88;
export const CLOAK_HOOD_Y = 1.68;
export const CLOAK_NECK_Y = 1.53;
export const CLOAK_CLASP_Y = 1.43;
export const CLOAK_SHOULDER_Y = 1.42;
/** Its radius about the body: across the shoulders, at the hem, round the neck and round the hood; how much further out
 *  than its sides its back hangs at the hem; how far behind the body's middle the hood sits (the face forward of the
 *  head's middle), and how much further back its peak falls. */
export const CLOAK_SHOULDER_R = 0.27;
export const CLOAK_HEM_R = 0.4;
export const CLOAK_NECK_R = 0.15;
export const CLOAK_HOOD_R = 0.165;
export const CLOAK_BACK_M = 0.14;
export const CLOAK_HOOD_BACK_M = 0.035;
export const CLOAK_PEAK_BACK_M = 0.05;
/** The hem's height down the back (a cape trails longest there) and at its front edges. */
export const CLOAK_HEM_Y = Object.freeze({ back: 0.1, edge: 0.26 });
/** How much narrower front to back than across it is: at the shoulders (a body is broader than it is deep) and at the
 *  hem, where the cloth has fallen round; and round the hood, narrower across than deep (as a head is). The folds' depth
 *  (m) at the hem. The mesh's steps round and up. */
export const CLOAK_SQUASH = Object.freeze({ shoulder: 0.32, hem: 0.1, hood: 0.1 });
export const CLOAK_FOLD_M = 0.022;
export const CLOAK_ROUND = 48;
export const CLOAK_ROWS = 48;
/** Its opening at the front, half its width in turns: at the hem and at the chest - closing from there to the clasp,
 *  where its edges meet - and the hood's face at its widest; the face's middle (m up) and half its height. */
export const CLOAK_OPEN = Object.freeze({ hem: 0.2, chest: 0.13, face: 0.12 });
export const CLOAK_FACE = Object.freeze({ y: 1.665, h: 0.135 });
/** Its pattern counts round the body (each a whole number, so the cape closes on itself): the folds and the mantle's
 *  scallops. The mantle over the shoulders: its edge's height. */
export const CLOAK_FOLDS = 14;
export const CLOAK_SCALLOPS = 16;
export const CLOAK_MANTLE_Y = 1.2;
/** The embroidery along its edges and hem, a band of wolf's teeth: the band's width in from the edge and a tooth's
 *  length along it (m). */
export const CLOAK_TRIM = Object.freeze({ band: 0.034, tooth: 0.045 });
/** On the ground: the shadow's pool. */
export const CLOAK_POOL_R = 0.85;
/** THE EMBLEM: the wearer's own glyph - SirMcMobdon's, the Shadow Fang's wolf's head (ui/playerBadge.js GLYPH_PATH
 *  and its eye, GLYPH_DETAIL), the very path the badge draws - on a disc of shadow ringed in crimson. On the cape's back
 *  (its middle's height and its disc's radius, m) and at the clasp (its disc's). */
export const CLOAK_GLYPH = GLYPH_PATH.shadowfang;
export const CLOAK_GLYPH_EYE = GLYPH_DETAIL.shadowfang.path;
export const CLOAK_SIGIL_Y = 0.98;
export const CLOAK_SIGIL_R = 0.15;
export const CLOAK_CLASP_R = 0.04;
/** THE EMBLEMS, its third draw: the emblem rising off its back, turning a little as it climbs, drawn in out of smoke and
 *  falling back to smoke - how many at once, the seconds one lasts (emblem k's is CLOAK_EMBLEM_LIFE[k mod 3], each
 *  dividing AURA_CLOCK_PERIOD), how high one climbs (m) and its card, square (m). */
export const CLOAK_EMBLEMS = 5;
export const CLOAK_EMBLEM_LIFE = Object.freeze([5, 6, 8]);
export const CLOAK_EMBLEM_RISE = 0.75;
export const CLOAK_EMBLEM_M = 0.22;
/** THE BEAST FORM: the wearer turned lycanthrope tears the cloak apart - the seconds the tear takes - and its shreds
 *  float round the beast, drawn with the emblems' cards: how many, a shred's card (m), the radii and heights they float
 *  at (m), and their rates (Hz, each whole over the clock - a shred goes round at one to three times `orbit`, either
 *  way, and turns in its own plane at one or two times `spin`). */
export const CLOAK_RIP_S = 1.2;
export const CLOAK_SHREDS = 14;
export const CLOAK_SHRED_M = 0.17;
export const CLOAK_SHRED_AT = Object.freeze({ r: Object.freeze([0.7, 1.15]), y: Object.freeze([0.3, 2.1]) });
export const CLOAK_SHRED_HZ = Object.freeze({ orbit: 1 / 60, spin: 1 / 10, tumble: 1 / 6, bob: 1 / 5 });
/** Its rates (Hz), each a whole number of cycles over AURA_CLOCK_PERIOD: the cape's billow and the wave running down
 *  it, and the breath of its light. */
export const CLOAK_HZ = Object.freeze({ billow: 1 / 5, wave: 1 / 3, pulse: 1 / 4 });
/** Its flows in lattice cells a second: the smoke stirring in the cloth and falling off its hem, the ground's mist drawn
 *  in and turning. */
export const CLOAK_FLOW = Object.freeze({ smoke: 0.25, hem: 0.5, mist: 0.25, swirl: 0.1 });
/** Every cloak rate whole over the clock. Pure. */
export const cloakRatesWhole = () => [...Object.values(CLOAK_HZ), ...Object.values(CLOAK_FLOW), ...Object.values(CLOAK_SHRED_HZ)]
  .every((r) => Number.isInteger(Math.round(r * AURA_CLOCK_PERIOD * 1e6) / 1e6));
/** Its colours: the Shadow Fang's crimson (ui/playerBadge.js TITLE_GRADIENT.shadowfang's end, #d3193c), an ember's red
 *  for where it burns brightest, the shadow's own black (the gradient's start, #0d0709) and the lining's deep red - the
 *  cloth is shadow, lined and edged in red. RGB 0..1. */
export const CLOAK_RGB = Object.freeze({ crimson: Object.freeze([0.827, 0.098, 0.235]), ember: Object.freeze([1, 0.36, 0.28]), shadow: Object.freeze([0.051, 0.027, 0.035]), lining: Object.freeze([0.32, 0.02, 0.06]) });

/** SHADOW-CLOAK: how near the wearer's own axis an eye stands inside the cloak (m): its cloth answers nothing there (the
 *  wearer's own first person) and is not drawn. */
export const CLOAK_INSIDE_M = 0.55;

/** AEGIS: HOW EACH AURA IS DRAWN - its kind in the shader (`uAura`), its ring's radius, its wall's height and how many
 *  symbols float off it (the third draw - none for the fire). A pin walks AURAS and requires one each. SHADOW-CLOAK: and,
 *  for the cloak alone, the mesh its wall is (`mesh` - the shaped cloth, not the strip) and that it SHADES: it darkens
 *  what is behind it as well as lighting it, drawn premultiplied (ONE, ONE_MINUS_SRC_ALPHA) where the others add. */
export const AURA_LOOK = Object.freeze({
  dagonfire: Object.freeze({ kind: 0, ringR: AURA_RING_R, flameH: AURA_FLAME_H, glyphs: 0 }),
  oblivionward: Object.freeze({ kind: 1, ringR: WARD_RING_R, flameH: WARD_WALL_H, glyphs: WARD_GLYPHS }),   // and its floating symbols
  radiance: Object.freeze({ kind: 2, ringR: RADIANCE_R, flameH: RADIANCE_H, glyphs: 0 }),   // PRIMARCH: the column about the body
  shadowcloak: Object.freeze({ kind: 3, ringR: CLOAK_HEM_R, flameH: CLOAK_H, glyphs: CLOAK_EMBLEMS, shreds: CLOAK_SHREDS, mesh: 'cloak', shade: true }),   // SHADOW-CLOAK: the cape on the body, its emblems, and its shreds when it tears
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
/** SHADOW-CLOAK: A GLYPH'S OUTLINE AS STRAIGHT EDGES - an SVG path of absolute M, L, Q and Z (ui/playerBadge.js
 *  GLYPH_PATH's shapes), each quadratic cut into `steps` chords and each figure closed, as [ax, ay, bx, by] in the
 *  glyph's own 16-unit box, y down; no edge of no length; any other command refused. Pure. */
export function glyphEdges(path, steps = 4) {
  const tok = String(path).match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  const out = [];
  let i = 0, cmd = null, at = null, start = null;
  const num = () => { const v = Number(tok[i++]); if (!Number.isFinite(v)) throw new Error(`glyphEdges: a number wanted in ${path}`); return v; };
  const r3 = (x) => Math.round(x * 1000) / 1000;   // as the shader takes it (toFixed(3)) - an edge that rounds to nothing is none
  const edge = (b) => { if (!at) throw new Error(`glyphEdges: a figure must begin with M in ${path}`); if (r3(at[0]) !== r3(b[0]) || r3(at[1]) !== r3(b[1])) out.push([at[0], at[1], b[0], b[1]]); at = b; };
  while (i < tok.length) {
    if (/[A-Za-z]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') { if (start) edge(start); at = [num(), num()]; start = at; cmd = 'L'; }   // pairs after a move are lines
    else if (cmd === 'L') edge([num(), num()]);
    else if (cmd === 'Q') {
      if (!at) throw new Error(`glyphEdges: a figure must begin with M in ${path}`);
      const a = at, c = [num(), num()], b = [num(), num()];
      for (let k = 1; k <= steps; k++) { const t = k / steps, r = 1 - t; edge([r * r * a[0] + 2 * r * t * c[0] + t * t * b[0], r * r * a[1] + 2 * r * t * c[1] + t * t * b[1]]); }
    } else if (cmd === 'Z') { if (start) edge(start); cmd = null; }
    else throw new Error(`glyphEdges: '${cmd}' is not drawn here`);
  }
  if (start) edge(start);   // an open figure closed, to be filled
  return out;
}
const CLOAK_GLYPH_EDGES = glyphEdges(CLOAK_GLYPH), CLOAK_EYE_EDGES = glyphEdges(CLOAK_GLYPH_EYE);
const glyphEdgesGlsl = (name, edges) => `const vec4 ${name}[${edges.length}] = vec4[${edges.length}](${edges.map((e) => `vec4(${e.map((x) => x.toFixed(3)).join(', ')})`).join(', ')});`;
/** SHADOW-CLOAK: THE CLOAK'S SHAPE, both halves' - its frame off the wearer's facing, its radius about the body at a
 *  height, how far behind the body's middle it stands there, and its opening at the front. `u` turns round from the
 *  front's middle (0) by the wearer's right, so the mesh's seam (u 0 = 1) lies inside the opening below the clasp and in
 *  the hood's face, and the collar between them closes whole over it. */
const g1 = (x) => x.toFixed(1), g3 = (x) => x.toFixed(3);
const CLOAK_SHAPE_GLSL = `
const float CLOAK_TAU = 6.283185307179586;
// x squared - never pow(x, 2.0), which GLSL leaves undefined for a negative x (AUDIT: a driver's exp2/log2 answers NaN)
float cloakSq(float x) { return x * x; }
float cloakHash(vec2 p) { p = fract(p * vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x * p.y); }
// the wearer's facing: forward is (sin, cos) in x and z (player/motor.js), the right a quarter turn from it
vec2 cloakFwd() { return vec2(sin(uYaw), cos(uYaw)); }
vec2 cloakBearing(float u) { float th = u * CLOAK_TAU; return cloakFwd() * cos(th) + vec2(cos(uYaw), -sin(uYaw)) * sin(th); }
// 0 at the front's middle, 1 down the back
float cloakBackOf(float u) { return 0.5 - 0.5 * cos(u * CLOAK_TAU); }
// where in its folds the cloth is round the body - uneven, so they read as cloth and not as fluting - and the fold
// itself: -1 in a crease .. 1 on a ridge
float cloakFoldPhase(float u) { return u * CLOAK_TAU * ${g1(CLOAK_FOLDS)} + 0.8 * sin(u * CLOAK_TAU * 3.0); }
float cloakFoldOf(float u) { return cos(cloakFoldPhase(u)); }
// how much the cape hangs free at y: none over the shoulders, all of it toward the hem - the folds' depth and the billow
float cloakDrapeOf(float y) { return smoothstep(0.05, 0.9, 1.0 - y / ${g3(CLOAK_SHOULDER_Y)}); }
// the radius about its axis at y (m up) on bearing u: the cape from the shoulders - narrower front to back than across,
// as a body is - falling and flaring to the hem, its back hanging further out; over the shoulders in to the neck; the
// hood round the head, narrower across than deep, closing over the crown
float cloakRadius(float u, float y) {
  float c2 = cloakSq(cos(u * CLOAK_TAU));
  if (y < ${g3(CLOAK_SHOULDER_Y)}) {
    float s = 1.0 - y / ${g3(CLOAK_SHOULDER_Y)};
    float squash = mix(${g3(CLOAK_SQUASH.shoulder)}, ${g3(CLOAK_SQUASH.hem)}, smoothstep(0.0, 0.8, s));
    return mix(${g3(CLOAK_SHOULDER_R)}, ${g3(CLOAK_HEM_R)}, pow(s, 1.3)) * (1.0 - squash * c2) + ${g3(CLOAK_BACK_M)} * cloakBackOf(u) * pow(s, 1.2);
  }
  float across = 1.0 - ${g3(CLOAK_SQUASH.hood)} * (1.0 - c2);
  if (y < ${g3(CLOAK_NECK_Y)}) return mix(${g3(CLOAK_SHOULDER_R)} * (1.0 - ${g3(CLOAK_SQUASH.shoulder)} * c2), ${g3(CLOAK_NECK_R)} * across, smoothstep(${g3(CLOAK_SHOULDER_Y)}, ${g3(CLOAK_NECK_Y)}, y));
  if (y < ${g3(CLOAK_HOOD_Y)}) return mix(${g3(CLOAK_NECK_R)}, ${g3(CLOAK_HOOD_R)}, smoothstep(${g3(CLOAK_NECK_Y)}, ${g3(CLOAK_HOOD_Y)}, y)) * across;
  float s = (y - ${g3(CLOAK_HOOD_Y)}) / ${g3(CLOAK_H - CLOAK_HOOD_Y)};
  return ${g3(CLOAK_HOOD_R)} * across * sqrt(max(0.0, 1.0 - s * s));
}
// how far behind the body's middle its axis stands at y (m): the cape's on the body; the hood's behind the face, its
// peak fallen back a little further
float cloakAxisBack(float y) { return ${g3(CLOAK_HOOD_BACK_M)} * smoothstep(${g3(CLOAK_SHOULDER_Y)}, ${g3(CLOAK_NECK_Y)}, y) + ${g3(CLOAK_PEAK_BACK_M)} * smoothstep(${g3(CLOAK_HOOD_Y)}, ${g3(CLOAK_H)}, y); }
// the opening at the front, half its width in turns: wide at the hem, narrowing up the chest and closed at the clasp
// where its edges meet; the collar whole round the throat; the hood's face open
float cloakOpenHalf(float y) {
  float body = mix(${g3(CLOAK_OPEN.hem)}, ${g3(CLOAK_OPEN.chest)}, smoothstep(0.0, ${g3(CLOAK_CLASP_Y - 0.2)}, y)) * (1.0 - smoothstep(${g3(CLOAK_CLASP_Y - 0.2)}, ${g3(CLOAK_CLASP_Y)}, y));
  float fy = (y - ${g3(CLOAK_FACE.y)}) / ${g3(CLOAK_FACE.h)};
  return max(body, ${g3(CLOAK_OPEN.face)} * sqrt(max(0.0, 1.0 - fy * fy)));
}
// a body-frame offset (x the wearer's right, y their forward, m) in the world's x and z
vec2 cloakWorldXZ(vec2 b) { return vec2(cos(uYaw), -sin(uYaw)) * b.x + cloakFwd() * b.y; }
// how far down its hang a height is: 0 at the shoulders and over them, 1 at the feet
float cloakHangOf(float y) { return clamp(1.0 - y / ${g3(CLOAK_SHOULDER_Y)}, 0.0, 1.0); }
// THE SWING's lag on a turn at y (\`uSwing\` w, rad): the turns its bearing has fallen behind, the more the lower
float cloakTwistAt(float y) { return uSwing.w / CLOAK_TAU * pow(cloakHangOf(y), 1.2); }
// THE TEAR: how far the cloak has torn apart (0 whole .. 1 gone) - \`uTorn\` the seconds since its wearer turned beast,
// negative while they have not
float cloakRipOf() { return uTorn < 0.0 ? 0.0 : clamp(uTorn / ${g3(CLOAK_RIP_S)}, 0.0, 1.0); }
`;
/** SHADOW-CLOAK: THE CLOAK'S CLOTH, ITS GROUND AND ITS EMBLEMS - the fragment half's. Each answers premultiplied: the
 *  light it adds (rgb) and how much of what is behind it the shadow covers (a). */
const CLOAK_FS_GLSL = `
const vec3 CLOAK_CRIMSON = ${v3(CLOAK_RGB.crimson)};
const vec3 CLOAK_EMBER = ${v3(CLOAK_RGB.ember)};
const vec3 CLOAK_SHADOW = ${v3(CLOAK_RGB.shadow)};
const vec3 CLOAK_LINING = ${v3(CLOAK_RGB.lining)};
float cloakBreath() { return 0.85 + 0.15 * sin(uTime * CLOAK_TAU ${hzGlsl(CLOAK_HZ.pulse)}); }
// THE WEARER'S GLYPH (ui/playerBadge.js GLYPH_PATH.shadowfang, SirMcMobdon's wolf's head, and its eye - GLYPH_DETAIL),
// cut into straight edges (glyphEdges) in its own 16-unit box, y down as its path is: the distance to its outline,
// negative inside (even-odd - the badge fills nonzero, the same for a path that never crosses itself, which a pin checks)
${glyphEdgesGlsl('CLOAK_GLYPH_EDGES', CLOAK_GLYPH_EDGES)}
${glyphEdgesGlsl('CLOAK_EYE_EDGES', CLOAK_EYE_EDGES)}
float cloakSeg2(vec2 p, vec4 e) { vec2 ab = e.zw - e.xy, w = p - e.xy; vec2 q = w - ab * clamp(dot(w, ab) / dot(ab, ab), 0.0, 1.0); return dot(q, q); }
float cloakCross(vec2 p, vec4 e) { float c = step(e.y, p.y) - step(e.w, p.y); return c != 0.0 && p.x < e.x + (p.y - e.y) * (e.z - e.x) / (e.w - e.y) ? 1.0 : 0.0; }
float cloakGlyphD(vec2 p) {
  float d = 1e9, n = 0.0;
  for (int i = 0; i < ${CLOAK_GLYPH_EDGES.length}; i++) { d = min(d, cloakSeg2(p, CLOAK_GLYPH_EDGES[i])); n += cloakCross(p, CLOAK_GLYPH_EDGES[i]); }
  return (mod(n, 2.0) > 0.5 ? -1.0 : 1.0) * sqrt(d);
}
float cloakEyeD(vec2 p) {
  float d = 1e9, n = 0.0;
  for (int i = 0; i < ${CLOAK_EYE_EDGES.length}; i++) { d = min(d, cloakSeg2(p, CLOAK_EYE_EDGES[i])); n += cloakCross(p, CLOAK_EYE_EDGES[i]); }
  return (mod(n, 2.0) > 0.5 ? -1.0 : 1.0) * sqrt(d);
}
// THE EMBLEM at p in its own measure (its disc's edge at 1.4, x across to the eye's right, y up; w a pixel's width in
// it): the wearer's glyph filled in crimson deepening down to the mane, its outline lit, its eye an ember; a ring about
// it and a fine ring outside that, on a disc of shadow - the light it gives (rgb) and its disc (a)
vec4 cloakEmblemAt(vec2 p, float w) {
  float l = length(p);
  if (l > 1.45) return vec4(0.0);   // past its disc, no glyph to measure
  vec2 g = vec2(8.0 + p.x * 7.0, 8.0 - p.y * 7.0);   // into the glyph's box: seven of its units to one
  float gd = cloakGlyphD(g) / 7.0;
  float fill = 1.0 - smoothstep(-w, 0.0, gd);
  float ring = 1.0 - smoothstep(0.0, w, abs(l - 1.2) - 0.035);
  float fine = 1.0 - smoothstep(0.0, w, abs(l - 1.33) - 0.014);
  vec3 col = CLOAK_CRIMSON * (fill * mix(0.2, 0.62, smoothstep(-0.9, 0.9, p.y)) + 0.5 * exp(-gd * gd / (w * w * 2.0)) + 0.1 * exp(-max(gd, 0.0) * 14.0) + ring * 0.62 + fine * 0.32);
  col = mix(col, CLOAK_EMBER, (1.0 - smoothstep(-w, 0.0, cloakEyeD(g) / 7.0)) * 0.9);
  return vec4(col * cloakBreath(), 1.0 - smoothstep(1.37, 1.42, l));
}
// THE EMBROIDERY m metres in from an edge, \`along\` it: a line at the edge, a band of wolf's teeth inside it, a fine line
// at the band's inner side
float cloakTrim(float m, float along) {
  if (m < 0.0 || m > ${g3(CLOAK_TRIM.band + 0.012)}) return 0.0;
  float tooth = abs(fract(along / ${g3(CLOAK_TRIM.tooth)}) - 0.5) * 2.0;
  float line = 0.009 + tooth * ${g3(CLOAK_TRIM.band - 0.018)};
  return exp(-cloakSq(m - 0.004) / 0.00001) + 0.7 * exp(-cloakSq(m - line) / 0.00001) + 0.45 * exp(-cloakSq(m - ${g3(CLOAK_TRIM.band)}) / 0.000006);
}
vec4 cloakWall(vec2 q) {
  float u = q.x, v = q.y, y = v * uFlameH, t = uTime;
  // KINDLED: drawn in out of smoke from the hem up - nothing past the line the kindling has reached, embers along it
  float grown = uKindle * 1.25 - 0.1 - v - (vnoiseP(vec2(u * 16.0, y * 5.0), vec2(16.0, 64.0)) - 0.5) * 0.2;
  if (grown < 0.0) discard;
  float r = max(cloakRadius(u, y), 0.04), circ = CLOAK_TAU * r;
  float su = u > 0.5 ? u - 1.0 : u;   // signed round from the front: the wearer's right positive
  // THE CLASP at the throat, where the opening's edges meet - whole over them (seen from the front: its x the eye's right)
  vec2 cp = vec2(-su * circ, y - ${g3(CLOAK_CLASP_Y - 0.012)}) * ${g3(1.4 / CLOAK_CLASP_R)};
  float brooch = 1.0 - smoothstep(1.37, 1.42, length(cp));
  // THE OPENING at the front: metres into the cloth from its edge
  float edgeM = (abs(su) - cloakOpenHalf(y)) * circ;
  if (edgeM < 0.0 && brooch <= 0.0) discard;
  // TORN, when its wearer turns beast: seams opening across it, its pieces gone one after another, embers along every
  // tear - the cells of a warped grid round and up it, twelve round so it closes on itself
  float rip = cloakRipOf(), torn = 0.0;
  if (rip > 0.0) {
    vec2 c = vec2(u * 12.0, y * 6.0) + (vec2(vnoiseP(vec2(u * 24.0, y * 9.0), vec2(24.0, 64.0)), vnoiseP(vec2(u * 24.0 + 7.0, y * 9.0), vec2(24.0, 64.0))) - 0.5) * 0.7;
    vec2 f = fract(c);
    float seam = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)) - rip * 0.3;
    if (seam < 0.0 || cloakHash(vec2(mod(floor(c.x), 12.0), floor(c.y)) + 0.5) < rip * 1.3 - 0.2) discard;
    torn = exp(-seam * seam / 0.0015);
  }
  // the cloth's facing - round the body, bent by its folds, and tilted by its lean in and out as it rises (the hood's
  // top, the shoulders) - against the eye, for its light. ITS TWO SIDES ARE TWO DRAWS (\`uSide\`): its lining (0, the
  // faces turned from the eye, culled to them) laid first and its outside (1) over it, so one row's far cloth never lies
  // over the next row's near - the side the BENT mesh's own winding says (AUDIT: the rest pose's normal misnamed up to a
  // quarter of it posed), so this facing only lights it
  float drape = cloakDrapeOf(y);
  float phase = cloakFoldPhase(u), fold = cos(phase) * drape;
  vec2 bn = cloakBearing(u + 0.02 * sin(phase) * drape + cloakTwistAt(y));
  float lean = (cloakRadius(u, y + 0.01) - cloakRadius(u, y - 0.01)) * 50.0 - (cloakAxisBack(y + 0.01) - cloakAxisBack(y - 0.01)) * 50.0 * dot(cloakFwd(), bn);
  vec3 e = uCamPos - vWorld;
  float toward = dot(normalize(vec3(bn.x, -lean, bn.y)), dot(e, e) > 1e-8 ? normalize(e) : vec3(bn.x, 0.0, bn.y));
  // never from inside it: the wearer's own first person sees no shadow over the view
  float outside = smoothstep(${g3(CLOAK_INSIDE_M)}, 1.0, length(uCamPos.xz - uAt.xz));
  float breath = cloakBreath();
  // THE HEM, longest down the back and ragged, its last hand's breadth coming apart into smoke that falls from it
  float hemM = y - mix(${g3(CLOAK_HEM_Y.edge)}, ${g3(CLOAK_HEM_Y.back)}, cloakBackOf(u)) - 0.035 * vnoiseP(vec2(u * 24.0, 0.5), vec2(24.0, 8.0)) - 0.05 * pow(vnoiseP(vec2(u * 9.0, 2.5), vec2(9.0, 8.0)), 3.0);
  float smoke = fbmP(vec2(u * 16.0, y * 3.0 + t * ${g3(CLOAK_FLOW.hem)}), vec2(16.0, ${g1(CLOAK_FLOW.hem * AURA_CLOCK_PERIOD)}));
  float fray = 1.0 - smoothstep(0.0, 0.1, hemM);
  float tear = smoke - fray * 0.8;
  if (edgeM >= 0.0 && (tear < 0.0 || hemM < 0.0)) {
    // what has come apart: smoke trailing off the hem, a hand below it at most, a crimson glow in it
    float trail = smoothstep(0.25, 0.65, smoke) * (1.0 - smoothstep(0.0, 0.12, -hemM)) * 0.55;
    if (trail <= 0.002) discard;
    return vec4(CLOAK_CRIMSON * trail * 0.05 * breath * outside, trail * outside);
  }
  float rim = pow(max(0.0, 1.0 - abs(toward)), 3.0);
  float stir = fbmP(vec2(u * 10.0, y * 2.0 - t * ${g3(CLOAK_FLOW.smoke)}), vec2(10.0, ${g1(CLOAK_FLOW.smoke * AURA_CLOCK_PERIOD)}));
  vec3 col;
  float shade;
  float lit = abs(toward);
  if (uSide == 1) {
    // ITS OUTSIDE: shadow, dense and dark and stirring, the folds' ridges catching a crimson sheen, a crimson rim
    // where it turns away
    shade = 0.86 + 0.08 * rim - 0.1 * stir;
    col = CLOAK_SHADOW * (0.5 + 0.5 * lit) * (0.8 + 0.2 * fold) + CLOAK_CRIMSON * (0.25 * rim + 0.06 * pow(max(fold, 0.0), 3.0) * lit) * breath;
    // THE MANTLE over the shoulders: its scalloped edge stitched in crimson, its shadow on the cape under it
    float me = y - ${g3(CLOAK_MANTLE_Y)} + 0.03 * sin(3.14159265 * fract(u * ${g1(CLOAK_SCALLOPS)}));
    shade += 0.06 * step(0.0, me);
    col *= 1.0 - 0.6 * exp(-cloakSq(me + 0.012) / 0.0001);
    col += CLOAK_CRIMSON * exp(-cloakSq(me - 0.005) / 0.00001) * 0.4 * breath;
    // THE EMBLEM on its back, on a disc of deeper shadow and burning through it (seen from behind: its x the eye's right)
    vec2 sp = vec2((0.5 - u) * circ, y - ${g3(CLOAK_SIGIL_Y)}) * ${g3(1.4 / CLOAK_SIGIL_R)};
    if (length(sp) < 1.45) {
      vec4 em = cloakEmblemAt(sp, 0.04);
      col = col * (1.0 - 0.5 * em.a) + em.rgb * (0.6 + 0.4 * lit);
      shade += 0.08 * em.a;
    }
  } else {
    // ITS LINING, seen through the opening and inside the hood: a deep red, brightest where it faces the eye
    shade = 0.86;
    col = CLOAK_LINING * (0.35 + 0.45 * lit + 0.2 * fold) + CLOAK_CRIMSON * 0.1 * rim * breath;
  }
  // THE EMBROIDERY down its front edges and round the hood's face, where it is open (the hem has none: its last hand's
  // breadth is fraying into smoke, smouldering where it tears - AUDIT: a band there was never seen)
  float trim = cloakTrim(edgeM, y) * step(0.001, cloakOpenHalf(y));
  col += CLOAK_CRIMSON * trim * 0.75 * breath * (uSide == 1 ? 1.0 : 0.6);
  // the hem's tear smouldering where it comes apart
  col += mix(CLOAK_CRIMSON, CLOAK_EMBER, 0.3) * exp(-tear * tear / 0.0008) * fray * 0.4 * breath;
  // THE CLASP: a brooch of the emblem over the meeting edges
  if (brooch > 0.0) {
    vec3 b = CLOAK_SHADOW * 0.5 + cloakEmblemAt(cp, 0.12).rgb * 1.3;
    col = edgeM < 0.0 ? b * brooch : mix(col, b, brooch);
    shade = edgeM < 0.0 ? 0.9 * brooch : mix(shade, 0.9, brooch);
  }
  // the tear's embers
  col += mix(CLOAK_CRIMSON, CLOAK_EMBER, 0.4) * torn * 0.9;
  // kindling, embers along the line it has reached
  col += (CLOAK_EMBER * 0.5 + CLOAK_CRIMSON) * exp(-grown * grown / 0.0006) * (1.0 - smoothstep(0.9, 1.0, uKindle));
  return vec4(col * outside, clamp(shade, 0.0, 0.94) * outside);
}
vec4 cloakGround(vec2 p) {
  float r = length(p);
  if (r > ${g3(CLOAK_POOL_R)}) discard;   // nothing of it past its pool (AUDIT: the quad's outer ring paid for nothing)
  float a = r > 1e-6 ? atan(p.y, p.x) : 0.0;
  float u = fract(a / CLOAK_TAU), t = uTime;
  // THE SHADOW it pools under it, mist turning in it and drawn in toward the feet
  float mist = fbmP(vec2(u * 12.0 + t * ${g3(CLOAK_FLOW.swirl)}, r * 3.0 + t * ${g3(CLOAK_FLOW.mist)}), vec2(12.0, ${g1(CLOAK_FLOW.mist * AURA_CLOCK_PERIOD)}));
  float pool = 1.0 - smoothstep(0.25, ${g3(CLOAK_POOL_R)}, r);
  float shade = pool * (0.5 + 0.35 * mist);
  // a dull crimson in the mist under the hem - the light of its embers on the ground
  float under = exp(-cloakSq(r - ${g3(CLOAK_HEM_R * 0.95)}) / 0.02) * smoothstep(0.5, 0.8, mist) * pool;
  vec3 col = CLOAK_CRIMSON * (pool * pool * 0.05 + under * 0.14) * cloakBreath();
  // KINDLED out from the feet; the quad's edge soft
  float vis = (1.0 - smoothstep(uKindle * 1.4 - 0.1, uKindle * 1.4, r)) * (1.0 - smoothstep(uGroundR - 0.2, uGroundR, r));
  return vec4(col * vis, clamp(shade, 0.0, 0.9) * vis);
}
// AN EMBLEM (uv its card's 0..1, s its age and its number): the wearer's emblem on its disc of shadow, drawn in out of
// smoke as it rises off the back and falling back to smoke at its end, embers where it forms and where it breaks; none
// while the cloak is still forming, and fading as it tears
vec4 cloakEmblem(vec2 uv, vec3 s) {
  vec2 p = (uv - 0.5) * 3.0;   // its measure: the disc's edge at 1.4, the card's at 1.5
  float gate = (1.0 - smoothstep(1.4, 1.5, max(abs(p.x), abs(p.y)))) * smoothstep(0.8, 1.0, uKindle) * (1.0 - cloakRipOf());
  if (gate <= 0.0) return vec4(0.0);   // a card that shows nothing works nothing out
  float life = clamp(min(s.x / 0.2, (1.0 - s.x) / 0.35), 0.0, 1.0);
  float held = life * 1.1 - 0.05 - vnoiseP(p * 2.2 + vec2(s.z * 7.1, s.z * 3.7), vec2(64.0));
  if (held < 0.0) return vec4(0.0);
  float form = smoothstep(0.0, 0.03, held);
  vec4 em = cloakEmblemAt(p, 0.05);
  float ember = exp(-held * held / 0.002) * (1.0 - smoothstep(0.85, 1.0, life)) * em.a;
  return vec4((em.rgb * form * 0.85 + mix(CLOAK_CRIMSON, CLOAK_EMBER, 0.4) * ember * 0.6) * gate, em.a * 0.82 * form * gate);
}
// A SHRED (uv its card's 0..1, s its number): a scrap torn off the cloak - shadow with a ragged edge smouldering crimson,
// some with a strip of the hem's wolf's teeth along them; dimmer from inside their ring (the beast's own eye)
vec4 cloakShred(vec2 uv, vec3 s) {
  vec2 p = (uv - 0.5) * 2.0;
  float h = cloakHash(vec2(s.z, 6.1));
  float shape = 0.74 - max(abs(p.x) * (0.75 + 0.5 * h), abs(p.y)) - (vnoiseP(p * 2.2 + s.z * 5.3, vec2(64.0)) - 0.5) * 0.55 - (vnoiseP(p * 6.0 + s.z * 3.1, vec2(64.0)) - 0.5) * 0.18;
  if (shape < -0.04) return vec4(0.0);
  float inside = smoothstep(-0.02, 0.02, shape);
  float burn = exp(-shape * shape / 0.002);
  float teeth = step(0.5, cloakHash(vec2(s.z, 3.3))) * exp(-cloakSq(p.y + 0.42 - abs(fract(p.x * 2.5) - 0.5) * 0.36) / 0.002) * inside;
  float gate = mix(0.35, 1.0, smoothstep(0.55, 1.0, length(uCamPos.xz - uAt.xz)));
  vec3 col = CLOAK_SHADOW * 0.4 * inside + (mix(CLOAK_CRIMSON, CLOAK_EMBER, 0.35) * burn * 0.7 + CLOAK_CRIMSON * teeth * 0.6) * cloakBreath();
  return vec4(col * gate, inside * 0.85 * gate);
}
`;
/** SHADOW-CLOAK: where the cloak's mesh stands, and its emblems' flights - the vertex half's alone. */
const CLOAK_VS_GLSL = `
// the cape's billow and a wave running down it - most at the hem and down the back, none at the shoulders
float cloakBillow(float u, float y, float t) {
  float th = u * CLOAK_TAU;
  float w = 0.035 * sin(2.0 * th + y * 2.0 + t * CLOAK_TAU ${hzGlsl(CLOAK_HZ.billow)}) + 0.016 * sin(5.0 * th + y * 6.0 + t * CLOAK_TAU ${hzGlsl(CLOAK_HZ.wave)});
  return w * pow(cloakDrapeOf(y), 1.5) * (0.3 + 0.7 * cloakBackOf(u));
}
// A KNEE (k, the body's frame: x right, y up, z forward, m about the feet) pressing the cloth out where a stride carries
// it past - at bearing u, radius r and height y: how far the cloth is pushed out round it
float cloakKneePush(vec3 k, float u, float r, float y) {
  float kr = length(k.xz);
  if (kr < 1e-4) return 0.0;
  return min(0.2, max(0.0, kr + 0.07 - r)) * smoothstep(0.75, 0.97, dot(vec2(sin(u * CLOAK_TAU), cos(u * CLOAK_TAU)), k.xz / kr)) * exp(-cloakSq(y - k.y) / 0.04);   // never more than a hand's tent
}
vec3 cloakPoint(vec2 q, float t) {
  float u = q.x, y = q.y * uFlameH, rip = cloakRipOf(), h = cloakHangOf(y);
  float ut = u + cloakTwistAt(y);   // lagging a turn
  // THE BODY'S POSE: hung from its shoulders where they are (\`uCapeS\`, the body's frame) - scaled between the feet and
  // them, so a crouch or a shorter or taller body carries it, and gathering out as it is pressed down; the collar
  // with the shoulders, and the hood with the head (\`uCapeH\`), turned as the head turns
  float ky = uCapeS.y / ${g3(CLOAK_SHOULDER_Y)};
  float r = cloakRadius(u, y) * mix(uCapeS.w, 1.0, smoothstep(${g3(CLOAK_SHOULDER_Y)}, ${g3(CLOAK_NECK_Y)}, y)) + ${g3(CLOAK_FOLD_M)} * cloakFoldOf(u) * cloakDrapeOf(y) + cloakBillow(u, y, t) + rip * (0.15 + 0.35 * cloakBackOf(u)) + max(0.0, 1.0 - ky) * h * 0.3;   // as broad as the body's shoulders; bursting out as it tears; gathering as it is pressed down
  vec2 d = cloakBearing(ut) * r - cloakFwd() * cloakAxisBack(y);
  float py;
  if (y < ${g3(CLOAK_SHOULDER_Y)}) {
    d += cloakWorldXZ(uCapeS.xz) * (1.0 - 0.5 * h);
    py = y * ky;
  } else {
    float wh = smoothstep(${g3(CLOAK_SHOULDER_Y)}, ${g3(CLOAK_HOOD_Y)}, y), a = uCapeH.w * wh;
    d = vec2(d.x * cos(a) + d.y * sin(a), -d.x * sin(a) + d.y * cos(a));
    vec3 off = mix(vec3(uCapeS.x, uCapeS.y - ${g3(CLOAK_SHOULDER_Y)}, uCapeS.z), vec3(uCapeH.x, uCapeH.y - ${g3(CLOAK_HOOD_Y)}, uCapeH.z), wh);
    d += cloakWorldXZ(off.xz);
    py = y + off.y;
  }
  // THE SWING (\`uSwing\`, auraMotionStep): trailing its wearer's motion, the more the lower, rising as a pendulum does;
  // lifting and filling as they fall
  float hang = ${g3(CLOAK_SHOULDER_Y)} * ky * h;
  vec2 trail = uSwing.xy * pow(h, 1.6) * min(ky, 1.0);   // a crouched hang swings shorter
  float tl = length(trail);
  if (tl > 0.7 * hang) trail *= 0.7 * hang / tl;   // never so far the pendulum folds the hem over itself (AUDIT)
  d += cloakWorldXZ(trail) + cloakBearing(ut) * uSwing.z * h * 0.6;
  py += hang - sqrt(max(hang * hang - dot(trail, trail), 0.0)) + max(uSwing.z, 0.0) * h * h;   // a rise never drops it below the feet
  // never through the legs: below the shoulders the cloth keeps a hand off the body's axis (AUDIT - a strafe's trail)
  float keep = y < ${g3(CLOAK_SHOULDER_Y)} ? mix(0.15, 0.22, h) : 0.0, dl = length(d);
  if (dl < keep) d *= keep / max(dl, 1e-4);
  // the knees, where a stride carries one past the cloth
  d += cloakBearing(ut) * (cloakKneePush(uKneeL, ut, r, py) + cloakKneePush(uKneeR, ut, r, py));
  return uAt + vec3(d.x, py + rip * 0.2 * q.y, d.y);
}
// emblem k's life (s): CLOAK_EMBLEM_LIFE[k mod 3]
float cloakEmblemLife(float k) { float m = mod(k, 3.0); return m < 0.5 ? ${g1(CLOAK_EMBLEM_LIFE[0])} : m < 1.5 ? ${g1(CLOAK_EMBLEM_LIFE[1])} : ${g1(CLOAK_EMBLEM_LIFE[2])}; }
// which of emblem k's flights the clock t is in - wrapping with the clock (the lives divide its period)
float cloakEmblemOf(float k, float t) { float life = cloakEmblemLife(k); return mod(floor(t / life + fract(k * 0.618034)), ${g1(AURA_CLOCK_PERIOD)} / life); }
// emblem k at the clock t: where it is about the feet (xyz, m) and its age (w, 0 rising off the back .. 1 gone); each
// flight rises off the back somewhere else between the shoulder blades and the shoulders, drifting out behind
vec4 cloakEmblemFlight(float k, float t) {
  float life = cloakEmblemLife(k);
  float age = fract(t / life + fract(k * 0.618034));
  float n = cloakEmblemOf(k, t);
  float u = 0.5 + (cloakHash(vec2(k * 17.0 + n, 4.1)) - 0.5) * 0.45;
  float y0 = 1.05 + cloakHash(vec2(k * 5.0 + n, 8.3)) * 0.35;
  vec2 d = cloakBearing(u) * (cloakRadius(u, y0) + 0.08 + 0.3 * age) + cloakWorldXZ(uCapeS.xz);   // off the back where the pose has it
  return vec4(d.x, y0 * uCapeS.y / ${g3(CLOAK_SHOULDER_Y)} + (1.0 - (1.0 - age) * (1.0 - age)) * ${g3(CLOAK_EMBLEM_RISE)}, d.y, age);
}
// shred j, \`since\` seconds after the cloak tore: where it is about the feet (xyz, m) - torn off the cape at its own place
// and flung out, then floating round the beast at its own height and pace, either way round, bobbing - and its turn in
// its own plane (w, radians). Every rate whole over the clock, which \`since\` wraps with past the tear (auraBeastStep)
vec4 cloakShredFlight(float j, float since) {
  float u0 = 0.12 + cloakHash(vec2(j, 2.7)) * 0.76;
  float y0 = 0.35 + cloakHash(vec2(j, 5.3)) * 1.0;
  float burst = 1.0 - pow(1.0 - clamp(since / ${g3(CLOAK_RIP_S)}, 0.0, 1.0), 3.0);
  float pace = (1.0 + floor(cloakHash(vec2(j, 9.1)) * 3.0)) * (mod(j, 2.0) < 0.5 ? 1.0 : -1.0);
  float r = mix(cloakRadius(u0, y0), ${g3(CLOAK_SHRED_AT.r[0])} + cloakHash(vec2(j, 7.7)) * ${g3(CLOAK_SHRED_AT.r[1] - CLOAK_SHRED_AT.r[0])}, burst);
  float y = mix(y0, ${g3(CLOAK_SHRED_AT.y[0])} + cloakHash(vec2(j, 1.3)) * ${g3(CLOAK_SHRED_AT.y[1] - CLOAK_SHRED_AT.y[0])}, burst) + 0.07 * burst * sin(since * CLOAK_TAU ${hzGlsl(CLOAK_SHRED_HZ.bob)} + j * 1.7);
  vec2 d = cloakBearing(u0 + since * pace ${hzGlsl(CLOAK_SHRED_HZ.orbit)}) * r;
  return vec4(d.x, y, d.y, since * CLOAK_TAU * (1.0 + floor(cloakHash(vec2(j, 4.4)) * 2.0)) ${hzGlsl(CLOAK_SHRED_HZ.spin)} + j);
}
`;
export const AURA_VS = HEAD + `layout(location = 0) in vec2 aP;   // the ground: a corner -1..1; the flames: x the step round 0..1, y up 0..1; a symbol: x its number * 2 + the corner's u, y its v
uniform mat4 uVP;
uniform int uKind;      // 0 the ground, 1 the flames, 2 the ward's floating symbols (AEGIS)
uniform int uAura;      // SHADOW-CLOAK: the cloak's wall is its own mesh, and its third draw its emblems
uniform vec3 uAt;       // the feet
uniform float uGroundR, uRingR, uFlameH, uLift;
uniform float uTime;    // AEGIS: a symbol's flight
uniform float uYaw;     // SHADOW-CLOAK: the wearer's facing
uniform float uTorn;    // SHADOW-CLOAK: the seconds since the wearer turned beast (negative while not) - the tear, the shreds
uniform vec4 uSwing;    // SHADOW-CLOAK: the swing (auraMotionStep) - its trail along the body's right and forward (m), its lift (m), its lag on a turn (rad)
uniform vec4 uCapeS;    // SHADOW-CLOAK: the shoulders' middle in the body's frame (x right, y up, z forward, m about the feet) - the pose it hangs from - and (w) its scale across them
uniform vec4 uCapeH;    // SHADOW-CLOAK: the head's middle in the same frame, and (w) its turn from the body's (rad)
uniform vec3 uKneeL, uKneeR;   // SHADOW-CLOAK: the knees, in the same frame
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
    // SHADOW-CLOAK: AN EMBLEM - its card at its flight's place, upright, turned round the vertical to the eye and
    // turning a little either way of it as it climbs, as a medal hung on a thread does; past the emblems, A SHRED of the
    // torn cloak - turning in its own plane and tumbling
    float k = floor(aP.x * 0.5);
    vP = vec2(aP.x - k * 2.0, aP.y);
    vec4 f;
    vec2 o;
    if (k < ${g1(CLOAK_EMBLEMS)}) {
      f = cloakEmblemFlight(k, uTime);
      o = (vP - 0.5) * ${g3(CLOAK_EMBLEM_M)} * (0.85 + 0.3 * f.w);
      o.x *= cos(0.55 * sin(f.w * CLOAK_TAU + k * 1.3));
      vS = vec3(f.w, 0.0, k);
    } else {
      float j = k - ${g1(CLOAK_EMBLEMS)}, since = max(uTorn, 0.0);
      f = cloakShredFlight(j, since);
      o = (vP - 0.5) * ${g3(CLOAK_SHRED_M)};
      o = vec2(o.x * cos(f.w) - o.y * sin(f.w), o.x * sin(f.w) + o.y * cos(f.w));
      o.x *= cos(since * CLOAK_TAU ${hzGlsl(CLOAK_SHRED_HZ.tumble)} + j);
      vS = vec3(0.0, 1.0, j);
    }
    vec3 c = uAt + f.xyz;
    vec2 toEye = uCamPos.xz - c.xz;
    toEye = dot(toEye, toEye) > 1e-8 ? normalize(toEye) : vec2(0.0, 1.0);
    // the card's x the eye's own right as the frame shows it (world/mat4.js HANDEDNESS: world +x on screen right), so
    // the glyph faces the way the badge's does
    w = c + vec3(-toEye.y, 0.0, toEye.x) * o.x + vec3(0.0, o.y, 0.0);
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
uniform float uYaw;     // SHADOW-CLOAK: the wearer's facing - the cloak's opening is at their front
uniform int uSide;      // SHADOW-CLOAK: which side of the cloth this draw lays - 0 the far, 1 the near
uniform float uTorn;    // SHADOW-CLOAK: the seconds since the wearer turned beast (negative while not)
uniform vec4 uSwing;    // SHADOW-CLOAK: the swing - its lag on a turn (w) turns the cloth's facing too
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
    vec4 c = uKind == 0 ? cloakGround(vP) : uKind == 1 ? cloakWall(vP) : vS.y > 0.5 ? cloakShred(vP, vS) : cloakEmblem(vP, vS);
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
/** The cards the third draw has to hand: the most any look floats (the ward's symbols, the cloak's emblems and shreds). */
export const AURA_CARDS = Math.max(...Object.values(AURA_LOOK).map((l) => l.glyphs + ('shreds' in l ? l.shreds : 0)));

/** SHADOW-CLOAK: THE BODY'S POSE AT REST - what the cape's measures are drawn about, in the body's frame (x right, y
 *  up, z forward, m about the feet): the shoulders' middle (w its scale across them - 1 at rest), the head's middle (w
 *  its turn from the body's, rad), and no knee to press it (at the feet's own axis, nowhere). A wearer with no posed
 *  body hangs it from this. */
export const CLOAK_REST_POSE = Object.freeze({ shoulders: Float32Array.of(0, CLOAK_SHOULDER_Y, 0, 1), head: Float32Array.of(0, CLOAK_HOOD_Y, 0, 0), kneeL: new Float32Array(3), kneeR: new Float32Array(3) });
/** SHADOW-CLOAK: THE BONES IT HANGS FROM - the retail third-person skeleton's (base_anim.nif and its kin, lowercase as
 *  the skeleton's byName keeps them): the shoulder joints, the neck and the head, the knees. */
export const CLOAK_BONES = Object.freeze(['bip01 l upperarm', 'bip01 r upperarm', 'bip01 neck', 'bip01 head', 'bip01 l calf', 'bip01 r calf']);
/** The rest shoulders' half-width its measures assume (m) - a broader or narrower body scales the cloth across, within
 *  CLOAK_ACROSS - and how far past the head's own joint (the top of the neck) its middle is, along the neck (m). */
export const CLOAK_SHOULDER_HALF = 0.2;
export const CLOAK_ACROSS = Object.freeze([0.8, 1.25]);
export const CLOAK_HEAD_ABOVE = 0.09;

/** SHADOW-CLOAK: THE POSE FROM THE BONES - `bones` the body's (fpArm.thirdBones: each [right, up, forward] m about its
 *  feet, or null) - the shoulders' middle and the scale across them, the head's middle and the knees, written into
 *  `out` (or a new pose); null when the shoulders or the head are missing (another skeleton - the wolf's), so the cape
 *  hangs at rest. Pure but for `out`. */
export function auraCapePose(bones, out = null) {
  const L = bones?.['bip01 l upperarm'], R = bones?.['bip01 r upperarm'], N = bones?.['bip01 neck'], H = bones?.['bip01 head'];
  if (!L || !R || !H) return null;
  const o = out ?? { shoulders: new Float32Array(4), head: new Float32Array(4), kneeL: new Float32Array(3), kneeR: new Float32Array(3) };
  const half = Math.hypot(L[0] - R[0], L[1] - R[1], L[2] - R[2]) / 2;
  o.shoulders.set([(L[0] + R[0]) / 2, (L[1] + R[1]) / 2, (L[2] + R[2]) / 2, Math.max(CLOAK_ACROSS[0], Math.min(CLOAK_ACROSS[1], half / CLOAK_SHOULDER_HALF))]);
  const up = N ? [H[0] - N[0], H[1] - N[1], H[2] - N[2]] : [0, 1, 0], ul = Math.hypot(...up) || 1;
  o.head.set([H[0] + (up[0] / ul) * CLOAK_HEAD_ABOVE, H[1] + (up[1] / ul) * CLOAK_HEAD_ABOVE, H[2] + (up[2] / ul) * CLOAK_HEAD_ABOVE, 0]);
  o.kneeL.set(bones['bip01 l calf'] ?? [0, 0, 0]);
  o.kneeR.set(bones['bip01 r calf'] ?? [0, 0, 0]);
  return o;
}

/** SHADOW-CLOAK: THE POSE A WEARER'S CAPE HANGS FROM THIS FRAME, set on `w` (`w.cape`): `posed` the body's own - { feet,
 *  yaw, bones } (mwView mwViewBodyBones beside my body's feet and yaw; peerBodies bonesOf) - the cape placed where that
 *  body is drawn (its feet and yaw, which the gather's may lag) and hung from its bones when they stand; else from the
 *  rest pose pressed down to `crouch` (the body's height over its standing height, 1 standing). Returns `w`. Pure but
 *  for `w`. */
export function auraCapeStep(w, posed, crouch = 1) {
  if (posed?.feet && Number.isFinite(posed.yaw)) { w.at[0] = posed.feet[0]; w.at[1] = posed.feet[1]; w.at[2] = posed.feet[2]; w.yaw = posed.yaw; }   // where the body is drawn
  const o = posed?.bones ? auraCapePose(posed.bones, w.cape && w.cape !== CLOAK_REST_POSE ? w.cape : null) : null;
  if (o) { w.cape = o; return w; }
  const k = Number.isFinite(crouch) ? Math.max(0.4, Math.min(1, crouch)) : 1;
  if (k >= 1) { w.cape = CLOAK_REST_POSE; return w; }
  const c = w.cape && w.cape !== CLOAK_REST_POSE ? w.cape : { shoulders: new Float32Array(4), head: new Float32Array(4), kneeL: new Float32Array(3), kneeR: new Float32Array(3) };
  c.shoulders.set([0, CLOAK_SHOULDER_Y * k, 0, 1]); c.head.set([0, CLOAK_HOOD_Y * k, 0, 0]); c.kneeL.fill(0); c.kneeR.fill(0);
  w.cape = c;
  return w;
}

/** SHADOW-CLOAK: THE CAPE'S SWING - how its hem answers its wearer's motion: the seconds of their speed it trails
 *  behind them (m per m/s, a walk's 4 m/s a hand and a half, a run's more) and the most it trails; the metres it lifts
 *  per m/s of falling and the most; the radians it lags per rad/s of turning and the most; and the spring it swings on
 *  (Hz, and its damping - under one, so it swings past and settles when they stop); the speeds smoothed over (s). A
 *  jump of more than CLOAK_SWING.snap metres in a frame (a door, a teleport, the floating origin moving the world) is
 *  no motion: nothing is read off it and the swing it had carries on. */
export const CLOAK_SWING = Object.freeze({ trail: 0.05, trailMax: 0.42, lift: 0.04, liftMax: 0.25, twist: 0.12, twistMax: 0.6, hz: 1.2, damp: 0.45, smooth: 0.1, snap: 3 });

/** SHADOW-CLOAK: THE CAPE'S SWING, a wearer's step each frame - from their feet (`w.at`) and facing (`w.yaw`) at the
 *  clock `t` (s), whoever's body it is (a rig or a sprite, mine or a peer's): their velocity and turning, smoothed, set
 *  where the hem would hang - behind them by their speed, lifted by their fall, lagging their turn - and a damped
 *  spring carries it there. Writes `w.swing` { x, z (m, along the body's right and forward), lift (m), twist (rad) }
 *  and the state it keeps (`w.motion`); returns `w`. Pure but for `w`. */
const clampTo = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export function auraMotionStep(w, t) {
  const S = CLOAK_SWING;
  const m = w.motion ?? (w.motion = { t: null, at: [0, 0, 0], yaw: 0, v: [0, 0, 0], yr: 0, p: [0, 0, 0, 0], q: [0, 0, 0, 0], goal: [0, 0, 0, 0] });
  const yaw = Number.isFinite(w.yaw) ? w.yaw : 0, at = w.at;
  const dt = m.t === null ? 0 : t - m.t;
  const jump = Math.hypot(at[0] - m.at[0], at[1] - m.at[1], at[2] - m.at[2]);
  if (m.t === null) { m.v.fill(0); m.yr = 0; m.p.fill(0); m.q.fill(0); }   // first seen: hanging still
  else if (!(dt > 0) || dt > 0.5 || !(jump <= S.snap)) { m.v.fill(0); m.yr = 0; }   // a stalled frame, a teleport, the floating origin moving the world: no motion read off it - the swing it had carries on
  else {
    const a = 1 - Math.exp(-dt / S.smooth);
    for (let i = 0; i < 3; i++) m.v[i] += ((at[i] - m.at[i]) / dt - m.v[i]) * a;
    let dy = yaw - m.yaw;
    dy -= Math.round(dy / (2 * Math.PI)) * 2 * Math.PI;
    m.yr += (dy / dt - m.yr) * a;
    const fwd = m.v[0] * Math.sin(yaw) + m.v[2] * Math.cos(yaw), right = m.v[0] * Math.cos(yaw) - m.v[2] * Math.sin(yaw);
    const g = m.goal;
    g[0] = clampTo(-right * S.trail, -S.trailMax, S.trailMax); g[1] = clampTo(-fwd * S.trail, -S.trailMax, S.trailMax);
    g[2] = clampTo(-m.v[1] * S.lift, -0.05, S.liftMax); g[3] = clampTo(-m.yr * S.twist, -S.twistMax, S.twistMax);
    const k = (2 * Math.PI * S.hz) ** 2, c = 2 * S.damp * 2 * Math.PI * S.hz;
    for (let n = Math.ceil(dt / (1 / 60)), h = dt / n; n > 0; n--) for (let i = 0; i < 4; i++) { m.q[i] += (k * (g[i] - m.p[i]) - c * m.q[i]) * h; m.p[i] += m.q[i] * h; }
  }
  m.t = t; m.at[0] = at[0]; m.at[1] = at[1]; m.at[2] = at[2]; m.yaw = yaw;
  const sw = w.swing ?? (w.swing = { x: 0, z: 0, lift: 0, twist: 0 });
  sw.x = m.p[0]; sw.z = m.p[1]; sw.lift = m.p[2]; sw.twist = m.p[3];
  return w;
}

/** SHADOW-CLOAK: THE BEAST FORM, a wearer's step each frame - `beast` whether they stand turned lycanthrope, `t` the
 *  clock (s). Turned, the cloak tears: `w.torn` the seconds since the turn, wrapped whole past the tear by the clock's
 *  period (the shreds' rates are whole over it, so their flights meet themselves); -1 while they are not. A wearer
 *  first seen already turned is already torn; turned back, its cloak kindles again from nothing (`w.since`). Writes `w`
 *  and returns it. */
export function auraBeastStep(w, beast, t) {
  if (w.beastAt === undefined) w.beastAt = beast ? t - CLOAK_RIP_S : null;
  if (beast) {
    if (w.beastAt === null) w.beastAt = t;
    const s = Math.max(0, t - w.beastAt);
    w.torn = s <= CLOAK_RIP_S ? s : CLOAK_RIP_S + ((s - CLOAK_RIP_S) % AURA_CLOCK_PERIOD);
  } else {
    if (w.beastAt !== null) { w.beastAt = null; w.since = t; }
    w.torn = -1;
  }
  return w;
}

export class AuraRingRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, AURA_VS, AURA_FS, 'aura ring');
    this.u = {};
    for (const n of ['uVP', 'uKind', 'uAura', 'uAt', 'uGroundR', 'uRingR', 'uFlameH', 'uLift', 'uTime', 'uSeed', 'uKindle', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus', 'uYaw', 'uSide', 'uTorn', 'uSwing', 'uCapeS', 'uCapeH', 'uKneeL', 'uKneeR']) this.u[n] = gl.getUniformLocation(this.program, n);
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
    const camAt = fog?.camPos ?? eye;
    try {
      // SHADOW-CLOAK (AUDIT): FARTHEST FIRST - the list comes nearest first (auraWearers), and a cloak's shadow is laid
      // OVER what is behind it, so the nearer wearer's is laid last; the added looks are the same in any order
      for (let i = list.length - 1; i >= 0; i--) {
        const w = list[i];
        if (!w || !Array.isArray(w.at)) continue;
        gl.uniform3f(U.uAt, w.at[0], w.at[1], w.at[2]);
        gl.uniform1f(U.uSeed, Number.isFinite(w.seed) ? w.seed : 0);
        gl.uniform1f(U.uKindle, Math.max(0, Math.min(1, Number.isFinite(w.kindle) ? w.kindle : 1)));
        const look = auraLookOf(w.aura);   // AEGIS: the fire or the ward, at its own radius and height
        gl.uniform1i(U.uAura, look.kind);
        gl.uniform1f(U.uRingR, look.ringR); gl.uniform1f(U.uFlameH, look.flameH);
        gl.uniform1f(U.uYaw, Number.isFinite(w.yaw) ? w.yaw : 0);   // SHADOW-CLOAK: the facing its opening is at
        const torn = Number.isFinite(w.torn) ? w.torn : -1;
        gl.uniform1f(U.uTorn, torn);   // SHADOW-CLOAK: turned beast, the cloak torn (auraBeastStep)
        const sw = w.swing, pose = w.cape ?? CLOAK_REST_POSE;   // SHADOW-CLOAK: its swing (auraMotionStep) and the body's pose it hangs from (auraCapePose)
        gl.uniform4f(U.uSwing, sw?.x || 0, sw?.z || 0, sw?.lift || 0, sw?.twist || 0);
        gl.uniform4fv(U.uCapeS, pose.shoulders); gl.uniform4fv(U.uCapeH, pose.head);
        gl.uniform3fv(U.uKneeL, pose.kneeL); gl.uniform3fv(U.uKneeR, pose.kneeR);
        // SHADOW-CLOAK: a look that SHADES is drawn premultiplied - its light added, what is behind it covered by its
        // alpha - and every other look as it always was, its light added whole
        if (look.shade) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform1i(U.uKind, 0);
        gl.bindVertexArray(this.quadVao);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        if (look.mesh === 'cloak') this._drawCloak(w, look, torn, camAt);   // SHADOW-CLOAK: the cloak's cloth, not the strip
        else {
          gl.uniform1i(U.uKind, 1);
          gl.bindVertexArray(this.flameVao);
          gl.drawArrays(gl.TRIANGLES, 0, AURA_STEPS * 6);
          if (look.glyphs) {   // AEGIS: the ward's floating symbols, a third draw
            gl.uniform1i(U.uKind, 2);
            gl.bindVertexArray(this.glyphVao);
            gl.drawArrays(gl.TRIANGLES, 0, look.glyphs * 6);
          }
        }
        if (look.shade) gl.blendFunc(gl.ONE, gl.ONE);
        this.drawn++;
      }
    } finally {   // SHADOW-CLOAK (AUDIT): the frame's state handed back whatever a wearer did mid-pass
      gl.bindVertexArray(null);
      gl.cullFace(gl.BACK);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.enable(gl.CULL_FACE);
      gl.depthMask(true);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.disable(gl.BLEND);
    }
  }

  /** SHADOW-CLOAK: THE CLOAK'S CLOTH AND ITS CARDS, after its ground - `eye` the frame's camera. The cloth's two sides are
   *  two draws of its mesh, its lining (`uSide` 0, the faces turned from the eye - front faces culled) and then its
   *  outside (1, back faces culled), so the bent mesh's own winding names each side (the frame's front face is the
   *  game's: world/mat4.js HANDEDNESS mirrors the projection and the renderer winds CW). None of it while torn through,
   *  folded on a rider, or round the wearer's own eye (CLOAK_INSIDE_M - its fragments answer nothing there). Its cards
   *  - the emblems and, torn, the shreds (the shreds alone once through) - before the cloth when the eye is in front of
   *  the wearer (the emblems rise behind them), after it otherwise. */
  _drawCloak(w, look, torn, eye) {
    const gl = this.gl, U = this.u;
    const folded = w.mounted === true;
    const dx = eye[0] - w.at[0], dz = eye[2] - w.at[2], yaw = Number.isFinite(w.yaw) ? w.yaw : 0;
    const cards = () => {
      if (folded) return;
      gl.uniform1i(U.uKind, 2);
      gl.bindVertexArray(this.glyphVao);
      if (torn >= CLOAK_RIP_S) gl.drawArrays(gl.TRIANGLES, look.glyphs * 6, look.shreds * 6);
      else gl.drawArrays(gl.TRIANGLES, 0, (look.glyphs + (torn >= 0 ? look.shreds : 0)) * 6);
    };
    const front = dx * Math.sin(yaw) + dz * Math.cos(yaw) > 0;
    if (front) cards();
    if (torn < CLOAK_RIP_S && !folded && dx * dx + dz * dz >= CLOAK_INSIDE_M * CLOAK_INSIDE_M) {
      gl.uniform1i(U.uKind, 1);
      gl.bindVertexArray(this.cloakVao);
      gl.enable(gl.CULL_FACE);
      for (const side of [0, 1]) { gl.uniform1i(U.uSide, side); gl.cullFace(side === 0 ? gl.FRONT : gl.BACK); gl.drawArrays(gl.TRIANGLES, 0, CLOAK_ROUND * CLOAK_ROWS * 6); }   // its lining, then its outside over it
      gl.disable(gl.CULL_FACE);
      gl.cullFace(gl.BACK);
    }
    if (!front) cards();
  }
}
