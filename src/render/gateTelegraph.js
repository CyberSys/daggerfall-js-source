// @ts-check
// WB4 (2026-09-25, Mac: "an oversized enemy with telegraphed attacks (like wind ups, etc)"): THE TELEGRAPH - every
// attack's shape drawn on the court's floor where it will land. Design: bible/11-Multiplayer/World-Bosses.md section 5
// ("On the ground: every shape is drawn where it will land - a dim outline at once, filling toward the edge as the
// wind-up runs, bright at the landing").
//
// ONE QUAD over the floor's disc, a hair above it, and the shape is the FRAGMENT'S question: its point in the court's
// frame against the attack the uniforms describe - the same law net/gateStrike.js inAttack answers for a struck
// player's feet (a cone about his facing that always holds his body, a disc about him or under each target, the lane
// his charge runs, the ring of the nova, the whole floor), so the ground shows exactly what lands. `telegraphField` is
// the shader's own reading in JS - the pins hold it to inAttack point for point, and the shader's text to it.
//
// The duel wall's law (render/duelWall.js): fixed geometry and uniforms, ADDED onto the frame (ONE, ONE) so it only
// brightens the floor, no depth written, tested against the depth the court wrote (a body standing on it hides it),
// fogged as the ground is, and every rate a whole number of cycles over the wrapped clock. A polygon offset keeps it
// off the floor it lies on.
//
// Not a DFU member. Ledger A (WB).
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';
import { duelClock } from './duelWall.js';
import { ATTACK_BY_ID, BOSS_R, COURT_CENTRE, COURT_R, COURTS, BASE_PROFILE, windupOf, nearestCourt, isDagons } from '../net/gateBrain.js';
import { telegraphAt } from '../net/gateStrike.js';
import { attackColor } from '../world/gateBoss.js';

/** The shapes, as the shader's `uKind` says them. WBX5: the Spokes of Dagon's lanes; WBX4: his mark. */
export const TELEGRAPH_KIND = Object.freeze({ cone: 0, disc: 1, discs: 2, lane: 3, ring: 4, all: 5, spokes: 6, mark: 7 });
/** The most lanes one spokes lays (the shader's loop bound). */
export const TELEGRAPH_SPOKES_MAX = 8;
/** WBX4 (2026-09-26, Swololo on Discord: "its hard to see where boss is and where he is facing, maybe he should have a
 *  circle under him"): HIS MARK on the floor, always - a ring about his feet a little wider than his body, and a chevron
 *  before it pointing where he faces: its ring's radius, the chevron's length and its half-width at the ring. */
export const BOSS_MARK_R = BOSS_R + 0.35;
export const BOSS_MARK_CHEVRON_LEN = 1.6;
export const BOSS_MARK_CHEVRON_HALF_W = 0.85;
/** The most discs one attack lays (Hellfire's two volleys of five in phase three - net/gateBrain.js). */
export const TELEGRAPH_POINTS_MAX = 10;
/** How far over the floor it lies, metres, and how far past its edge the quad reaches. */
export const TELEGRAPH_LIFT = 0.05;
export const TELEGRAPH_MARGIN = 0.5;
/** It comes up over this long at the word, and its landing's flash dies over this long after its span. */
export const TELEGRAPH_FADE_IN_MS = 150;
export const TELEGRAPH_FLASH_MS = 350;
/** The fill's pulse, beats a second (a whole number of cycles over duelWall.js DUEL_CLOCK_PERIOD). */
export const TELEGRAPH_PULSE_HZ = 2;
/**
 * WB9e (2026-09-30, Mac: "further improve his telegraphs"): EACH SHAPE WEARS ITS ELEMENT - the fill's grain by what
 * lands (`uStyle`): his weight's cracks (the blade, the slam, the charge, the leaps), fire's flicker, frost's facets,
 * the storm's crackle, venom's bubbles, and Dagon's own for the Wrath and the Reckoning.
 */
export const TELEGRAPH_STYLE = Object.freeze({ weight: 0, fire: 1, frost: 2, shock: 3, poison: 4, dagon: 5 });
/** WB9e: the shockwave a landing throws out past its edge - its speed (metres a second) and how long it runs. */
export const TELEGRAPH_WAVE_MPS = 22;
export const TELEGRAPH_WAVE_MS = 450;
/** WB9e: the last stretch of a wind-up that burns at a landing's own brightness - "now". */
export const TELEGRAPH_NOW_MS = 350;
/** An attack's grain under a profile: Dagon's own, else its element's (his weight's when it carries none). */
export const telegraphStyle = (A, P = BASE_PROFILE) => (isDagons(A) ? TELEGRAPH_STYLE.dagon : TELEGRAPH_STYLE[P.atk[A.key].el ?? 'weight'] ?? TELEGRAPH_STYLE.weight);

const DEG = Math.PI / 180;

/**
 * What the pass draws for an attack at `now` - the uniforms, as plain numbers - or null when there is nothing (no
 * attack, or its landing's flash is over). `t` is the wind-up's share (the fill's reach), `flash` 1 from the landing
 * on, `alpha` its fade in and out. WB8b: under the fight's profile `P` - the reach the attack has under his marks, his
 * body his own size, the colour his aspect gives it - so the ground still shows exactly what lands.
 * @param {{a: number, at: number, x: number, z: number, yw: number, tg: number[][]}|null} atk @param {number} phase @param {number} now
 * @param {ReturnType<typeof import('../net/gateBrain.js').fightProfile>} [P]
 */
export function telegraphShape(atk, phase, now, P = BASE_PROFILE) {
  /** @type {any} an attack of any shape - the fields its shape does not have read as none */
  const A = atk ? ATTACK_BY_ID[atk.a] : null;
  const tel = A ? telegraphAt(atk, phase, now) : null;
  if (!A || !tel) return null;
  const span = Math.max(A.active, 1);
  if (tel.since >= span + TELEGRAPH_FLASH_MS) return null;
  const start = atk.at - windupOf(A, phase);
  const fadeIn = Math.max(0, Math.min(1, (now - start) / TELEGRAPH_FADE_IN_MS));
  const fadeOut = tel.since > span ? 1 - (tel.since - span) / TELEGRAPH_FLASH_MS : 1;
  const kind = A.shape === 'disc' ? (A.aim === 'self' ? TELEGRAPH_KIND.disc : TELEGRAPH_KIND.discs) : TELEGRAPH_KIND[A.shape];
  const end = atk.tg?.[0] ?? [atk.x, atk.z];
  // WBX5: a 'point' disc is one mark (the leap's landing, the meteor's fall); the spokes' lanes are `len` long
  const marks = A.aim === 'players' ? (atk.tg ?? []).slice(0, TELEGRAPH_POINTS_MAX) : A.aim === 'point' ? (atk.tg ?? []).slice(0, 1) : [];
  // WB9b: the court it is drawn over - where it lands (the bound's landing is the next court's heart), else where he stood
  const at = A.aim === 'point' && marks.length ? marks[0] : [atk.x, atk.z];
  return {
    kind, origin: [atk.x, atk.z], yaw: atk.yw, r: A.shape === 'spokes' ? A.len : P.atk[A.key].r ?? 0, halfArc: ((A.arc ?? 0) / 2) * DEG, body: P.bossR,
    end: [end[0], end[1]], halfW: A.shape === 'lane' ? Math.max((A.width ?? 0) / 2, P.bossR) : (A.width ?? 0) / 2, r0: A.r0 ?? 0, r1: A.r1 ?? 0,   // AUDIT WBX F7: the charge strikes as wide as his body (net/gateStrike.js chargeStrikes), and shows so
    points: marks.map((p) => [p[0], p[1]]), n: A.shape === 'spokes' ? Math.min(TELEGRAPH_SPOKES_MAX, A.n) : 0,
    t: tel.t, flash: tel.since >= 0 ? 1 : 0, alpha: fadeIn * Math.max(0, fadeOut), color: attackColor(A, P),
    // WB9b: over which court (all three for the whole arena's - the Wrath's and the Reckoning's); WB9e: its grain, its own
    // clock (seconds since the word, the wind-up's length) and how long since it landed (the shockwave's)
    court: A.shape === 'all' ? -1 : nearestCourt(at[0], at[1]), style: telegraphStyle(A, P),
    since: Math.max(0, (now - start) / 1000), span: Math.max(0.001, windupOf(A, phase) / 1000), after: tel.since >= 0 ? tel.since / 1000 : -1,
  };
}

/** WBX4: HIS MARK as the pass draws it - where he stands (the court's frame), his facing, in `color` (the ward's gold while
 *  it stands, his ember otherwise), about a body of `body` metres (WB8b: his profile's - Colossal's is larger). Pure. */
export function markShape(at, yaw, color, body = BOSS_R) {
  return {
    kind: TELEGRAPH_KIND.mark, origin: [at[0], at[1]], yaw, r: body + (BOSS_MARK_R - BOSS_R), halfArc: 0, body, end: [at[0], at[1]],
    halfW: BOSS_MARK_CHEVRON_HALF_W, r0: 0, r1: BOSS_MARK_CHEVRON_LEN, points: [], n: 0, t: 1, flash: 0, alpha: 1, color,
    court: 0, style: TELEGRAPH_STYLE.weight, since: 0, span: 1, after: -1,   // WB9b: the court's driver sets `court` where he stands
  };
}

/** WBX5: THE BURNING GROUND as the pass draws it - live pools (net/gateStrike.js landingPools) gathered by radius, each
 *  group one filled `discs` shape in `color`, coming up at its landing and dying down over its last second. Pure. */
export function poolShapes(pools, now, color, style = TELEGRAPH_STYLE.fire) {
  const byR = new Map();
  for (const p of pools ?? []) {
    if (!(now >= p.from && now < p.until)) continue;
    const court = nearestCourt(p.x, p.z), key = `${court}:${p.r}`;   // WB9b: each court's pools on its own quad
    const g = byR.get(key) ?? { r: p.r, court, pts: [], alpha: 0, from: p.from };
    if (g.pts.length < TELEGRAPH_POINTS_MAX) g.pts.push([p.x, p.z]);
    g.alpha = Math.max(g.alpha, Math.min(1, (now - p.from) / TELEGRAPH_FADE_IN_MS, (p.until - now) / 1000));
    g.from = Math.min(g.from, p.from);
    byR.set(key, g);
  }
  return [...byR.values()].map((g) => ({
    kind: TELEGRAPH_KIND.discs, origin: [0, 0], yaw: 0, r: g.r, halfArc: 0, body: BOSS_R, end: [0, 0], halfW: 0, r0: 0, r1: 0,
    points: g.pts, n: 0, t: 1, flash: 0, alpha: g.alpha, color,
    court: g.court, style, since: Math.max(0, (now - g.from) / 1000), span: 1, after: -1, pool: true,   // WB9d: burning ground - its own seething, never a wind-up's
  }));
}

const wrap = (a) => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI));
function segDist(px, pz, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
  const h = l2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / l2)) : 0;
  return [Math.hypot(px - (ax + vx * h), pz - (az + vz * h)), h];
}

/**
 * THE SHADER'S OWN READING, in JS: for a point of the court (its frame), whether it lies inside the shape, how far it
 * is from the shape's edge (metres - the outline's measure; near enough off a cone's side), and the fill's coordinate
 * (0 where the fill starts, 1 at its far edge: out from him for a cone or disc, down the lane for the charge, out from
 * the ring's inner edge for the nova, out from the centre for the whole floor).
 * @param {NonNullable<ReturnType<typeof telegraphShape>>} sh @param {number} px @param {number} pz
 */
export function telegraphField(sh, px, pz) {
  const rx = px - sh.origin[0], rz = pz - sh.origin[1], d = Math.hypot(rx, rz);
  switch (sh.kind) {
    case TELEGRAPH_KIND.cone: {
      const ang = Math.abs(wrap(Math.atan2(rx, rz) - sh.yaw));
      const inside = d <= sh.r && (d <= sh.body || ang <= sh.halfArc);
      const arcEdge = ang <= sh.halfArc ? Math.abs(d - sh.r) : Infinity, sideEdge = d > sh.body && d <= sh.r ? Math.abs(ang - sh.halfArc) * d : Infinity;
      return { inside, edge: Math.min(arcEdge, sideEdge), s: d / sh.r };
    }
    case TELEGRAPH_KIND.disc: return { inside: d <= sh.r, edge: Math.abs(d - sh.r), s: d / sh.r };
    case TELEGRAPH_KIND.discs: {
      let m = Infinity;
      for (const p of sh.points) m = Math.min(m, Math.hypot(px - p[0], pz - p[1]));
      return { inside: m <= sh.r, edge: Math.abs(m - sh.r), s: m / sh.r };
    }
    case TELEGRAPH_KIND.lane: {
      const [ld, h] = segDist(px, pz, sh.origin[0], sh.origin[1], sh.end[0], sh.end[1]);
      return { inside: ld <= sh.halfW, edge: Math.abs(ld - sh.halfW), s: h };
    }
    case TELEGRAPH_KIND.ring: return { inside: d >= sh.r0 && d <= sh.r1, edge: Math.min(Math.abs(d - sh.r0), Math.abs(d - sh.r1)), s: (d - sh.r0) / (sh.r1 - sh.r0) };
    case TELEGRAPH_KIND.all: { const cc = COURTS[nearestCourt(px, pz)], c = Math.hypot(px - cc[0], pz - cc[1]); return { inside: true, edge: Math.abs(COURT_R - c), s: c / COURT_R }; }   // WB9b: about the court the point stands in
    case TELEGRAPH_KIND.spokes: {
      let best = Infinity, bh = 0;
      for (let i = 0; i < sh.n; i++) {
        const a = sh.yaw + (i * 2 * Math.PI) / sh.n, dx = Math.sin(a), dz = Math.cos(a);
        const h = Math.max(0, Math.min(sh.r, rx * dx + rz * dz)), ld = Math.hypot(rx - dx * h, rz - dz * h);
        if (ld < best) { best = ld; bh = h / sh.r; }
      }
      return { inside: best <= sh.halfW, edge: Math.abs(best - sh.halfW), s: bh };
    }
    case TELEGRAPH_KIND.mark: {
      const fx = Math.sin(sh.yaw), fz = Math.cos(sh.yaw), along = rx * fx + rz * fz, side = rx * fz - rz * fx;
      const k = (along - sh.r) / sh.r1;
      const chevron = k >= 0 && k <= 1 && Math.abs(side) <= sh.halfW * (1 - k);
      return { inside: chevron || d <= sh.r, edge: Math.abs(d - sh.r), s: chevron ? k : 0, chevron };
    }
    default: return { inside: false, edge: Infinity, s: 0 };
  }
}

const HEAD = `#version 300 es
precision highp float;
`;
export const TELEGRAPH_VS = HEAD + `layout(location = 0) in vec2 aCourt;   // the quad's corner, about the court it lies over
uniform mat4 uVP;
uniform vec3 uCentre;    // the first court's centre in the scene - the court frame's origin
uniform vec2 uCourt;     // WB9b: the court it lies over, in the court frame
uniform float uLift;
out vec2 vCourt;
out vec3 vWorld;
void main() {
  vCourt = uCourt + aCourt;
  vWorld = uCentre + vec3(vCourt.x, uLift, vCourt.y);
  gl_Position = uVP * vec4(vWorld, 1.0);
}`;
export const TELEGRAPH_FS = HEAD + `in vec2 vCourt;
in vec3 vWorld;
uniform int uKind;       // 0 cone, 1 disc, 2 discs, 3 lane, 4 ring, 5 all (TELEGRAPH_KIND)
uniform vec2 uOrigin;    // where he stood
uniform float uYaw;      // his facing, atan2(dx, dz)
uniform float uR;
uniform float uHalfArc;
uniform float uBody;     // his body's radius - a cone always holds it
uniform vec2 uEnd;       // the lane's end
uniform float uHalfW;
uniform float uR0;
uniform float uR1;
uniform vec2 uPts[${TELEGRAPH_POINTS_MAX}];
uniform int uCount;
uniform float uT;        // the wind-up's share: the fill's reach
uniform float uFlash;    // the landing
uniform float uAlpha;
uniform vec3 uColor;
uniform float uTime;     // duelClock's seconds
uniform vec2 uCourt;     // WB9b: the court it lies over
uniform float uFloorR;
uniform int uStyle;      // WB9e: 0 his weight, 1 fire, 2 frost, 3 shock, 4 venom, 5 Dagon's (TELEGRAPH_STYLE)
uniform float uSince;    // WB9e: seconds since the word - the urgency's own clock (never the wrapped one)
uniform float uSpan;     // WB9e: the wind-up, seconds
uniform float uAfter;    // WB9e: seconds since the landing (the shockwave's), < 0 before it
uniform int uPool;       // WB9d: burning ground - seething, no wind-up
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
const float PI = 3.141592653589793;
float wrapAngle(float a) { return a - 2.0 * PI * floor((a + PI) / (2.0 * PI)); }
// WB9e: the grain's noise - a hashed value lattice, smooth between
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}
// the grain of what lands, 0..1 over the fill (its own clock, uSince: the clock the shapes do not wrap on)
float grain(vec2 p, float t) {
  if (uStyle == 1) return vnoise(p * 0.7 + vec2(0.0, -t * 1.6)) * 0.6 + vnoise(p * 1.9 + vec2(t * 0.7, -t * 2.3)) * 0.4;   // fire: flicker rising
  if (uStyle == 2) { vec2 q = p * 0.9; float a = abs(fract(q.x + 0.5 * q.y) - 0.5) + abs(fract(q.y * 1.15) - 0.5); return 1.0 - smoothstep(0.0, 0.18, abs(a - 0.5)); }   // frost: facets
  if (uStyle == 3) { float n = vnoise(p * 1.3 + vec2(floor(t * 12.0) * 3.1)); return 1.0 - smoothstep(0.0, 0.07, abs(n - 0.5)); }   // storm: crackle, jumping twelve times a second
  if (uStyle == 4) { vec2 cell = floor(p * 0.8), f = fract(p * 0.8) - 0.5; float r = 0.18 + 0.2 * hash2(cell); float ph = fract(t * (0.4 + hash2(cell + 7.0)) + hash2(cell + 3.0)); return (1.0 - smoothstep(r * ph - 0.04, r * ph, length(f))) * (1.0 - ph); }   // venom: bubbles swelling and bursting
  if (uStyle == 5) { vec2 d = p - uOrigin; float a = atan(d.x, d.y), r = length(d); return vnoise(vec2(a * 3.0 + r * 0.25 - t * 0.9, r * 0.35 - t * 0.5)); }   // Dagon's: a slow vortex
  return 1.0 - smoothstep(0.0, 0.05, abs(vnoise(p * 0.55) - 0.5));   // his weight: the floor's cracks, still
}
void main() {
  float c = length(vCourt - uCourt);
  if (c > uFloorR) discard;
  vec2 rel = vCourt - uOrigin;
  float d = length(rel);
  bool inside = false;
  float edge = 1e3;
  float s = 0.0;
  float course = 0.0;   // WB9e: where along its rim a point stands, 0..1 - the fuse's course
  if (uKind == 0) {
    float ang = abs(wrapAngle(atan(rel.x, rel.y) - uYaw));
    inside = d <= uR && (d <= uBody || ang <= uHalfArc);
    edge = min(ang <= uHalfArc ? abs(d - uR) : 1e3, d > uBody && d <= uR ? abs(ang - uHalfArc) * d : 1e3);   // the arc's own stretch, the sides' own length
    s = d / uR;
    course = 1.0 - clamp(s, 0.0, 1.0);
  } else if (uKind == 1) {
    inside = d <= uR; edge = abs(d - uR); s = d / uR;
    course = (atan(rel.x, rel.y) + PI) / (2.0 * PI);
  } else if (uKind == 2) {
    float m = 1e3; vec2 near = uOrigin;
    for (int i = 0; i < ${TELEGRAPH_POINTS_MAX}; i++) { if (i >= uCount) break; m = min(m, length(vCourt - uPts[i])); if (m == length(vCourt - uPts[i])) near = uPts[i]; }
    inside = m <= uR; edge = abs(m - uR); s = m / uR;
    vec2 q = vCourt - near; course = (atan(q.x, q.y) + PI) / (2.0 * PI);
  } else if (uKind == 3) {
    vec2 v = uEnd - uOrigin;
    float l2 = dot(v, v);
    float h = l2 > 0.0 ? clamp(dot(rel, v) / l2, 0.0, 1.0) : 0.0;
    float ld = length(vCourt - (uOrigin + v * h));
    inside = ld <= uHalfW; edge = abs(ld - uHalfW); s = h;
    course = 1.0 - h;
  } else if (uKind == 4) {
    inside = d >= uR0 && d <= uR1; edge = min(abs(d - uR0), abs(d - uR1)); s = (d - uR0) / (uR1 - uR0);
    course = (atan(rel.x, rel.y) + PI) / (2.0 * PI);
  } else if (uKind == 6) {
    // WBX5: the spokes - the nearest of uCount lanes from him, the first along his facing, uR long
    float best = 1e3, bh = 0.0;
    for (int i = 0; i < ${TELEGRAPH_SPOKES_MAX}; i++) {
      if (i >= uCount) break;
      float a = uYaw + float(i) * 6.283185307179586 / float(uCount);
      vec2 dir = vec2(sin(a), cos(a));
      float h = clamp(dot(rel, dir), 0.0, uR);
      float ld = length(rel - dir * h);
      if (ld < best) { best = ld; bh = h / uR; }
    }
    inside = best <= uHalfW; edge = abs(best - uHalfW); s = bh;
    course = 1.0 - bh;
  } else if (uKind == 7) {
    // WBX4: his mark - a ring about his feet (uR), a faint floor inside it, and a chevron before it where he faces
    // (uR1 long, uHalfW wide at the ring), steady: it is where he is, not what he does
    vec2 fdir = vec2(sin(uYaw), cos(uYaw));
    float along = dot(rel, fdir), side = rel.x * fdir.y - rel.y * fdir.x;
    float k = (along - uR) / uR1;
    float chev = (k >= 0.0 && k <= 1.0 && abs(side) <= uHalfW * (1.0 - k)) ? 1.0 : 0.0;
    float ring = 1.0 - smoothstep(0.04, 0.2, abs(d - uR));
    float floorIn = d <= uR ? 1.0 : 0.0;
    float mark = 0.95 * ring + 0.9 * chev * (0.7 + 0.3 * (1.0 - k)) + 0.07 * floorIn;
    if (mark < 0.001) discard;
    o = vec4(uColor * mark * uAlpha * fogFactorAt(vWorld), 1.0);
    return;
  } else {
    inside = true; edge = abs(uFloorR - c); s = c / uFloorR;
    vec2 q = vCourt - uCourt; course = (atan(q.x, q.y) + PI) / (2.0 * PI);
  }
  float fin = inside ? 1.0 : 0.0;
  // WB9e: THE EDGE READS FROM ANYWHERE - a hard line at least two pixels wide however far off (its width in screen space),
  // a soft glow just outside it
  float px = max(fwidth(edge), 1e-4);
  float rim = 1.0 - smoothstep(max(0.06, 1.2 * px), max(0.35, 4.0 * px), edge);
  float halo = (1.0 - fin) * (1.0 - smoothstep(0.0, 1.4, edge)) * 0.3;
  // WB9e: THE SHOCKWAVE - a landing throws a ring out past its edge (outside the shape, fading as it runs)
  float wave = 0.0;
  if (uAfter >= 0.0 && uPool == 0 && uKind != 5) { float rw = uAfter * ${TELEGRAPH_WAVE_MPS}.0; wave = (1.0 - fin) * exp(-pow((edge - rw) * 1.4, 2.0)) * clamp(1.0 - uAfter / ${(TELEGRAPH_WAVE_MS / 1000).toFixed(3)}, 0.0, 1.0); }
  if (fin + rim + halo + wave < 0.001) discard;
  vec3 col = uColor;
  if (uPool == 1) {
    // WB9d: BURNING GROUND - it seethes (its grain always moving, a slow throb), its edge hard: a place to keep out of
    float gp = grain(vCourt, uSince);
    float throb = 0.75 + 0.25 * sin(uSince * 6.283185307179586 * 1.5);
    float lightP = fin * (0.28 + 0.42 * gp) * throb + 0.75 * rim + halo;
    o = vec4(col * lightP * uAlpha * fogFactorAt(vWorld), 1.0);
    return;
  }
  float filled = fin * step(s, uT);
  float front = fin * exp(-pow((s - uT) * 18.0, 2.0)) * (1.0 - step(0.999, uT));
  float pulse = 0.8 + 0.2 * sin(uTime * 6.283185307179586 * ${TELEGRAPH_PULSE_HZ}.0);
  // WB9e: URGENCY - the fill throbs faster as the landing nears (its own clock: 1.5 beats a second at the word, 6.5 at the
  // landing), the grain of what lands runs through it, and the last ${TELEGRAPH_NOW_MS} ms burn at a landing's brightness
  float hz = 1.5 + 5.0 * uT * uT;
  float urgent = 0.5 + 0.5 * cos(6.283185307179586 * hz * uSince);
  float g = grain(vCourt, uSince);
  float now = step(uSpan - uSince, ${(TELEGRAPH_NOW_MS / 1000).toFixed(3)}) * (1.0 - uFlash);
  // WB9e: THE FUSE - the rim burns down as the wind-up runs: lit ahead of what is left of it, a spark where it burns
  float left = 1.0 - uT;
  float fuseLit = step(course, left);
  float spark = exp(-pow((course - left) * 40.0, 2.0)) * (1.0 - uFlash);
  float rimLit = rim * (0.35 + 0.65 * fuseLit) + rim * spark * 1.4;
  float light = 0.55 * rimLit + halo + 0.07 * fin + 0.22 * filled * pulse + 0.7 * front + fin * (0.08 + 0.1 * uT) * g + fin * 0.12 * uT * urgent + 0.8 * fin * now;
  light = mix(light, 1.1 * fin + 0.6 * rim, uFlash);
  light += wave * 1.1;
  o = vec4(col * light * uAlpha * fogFactorAt(vWorld), 1.0);
}`;

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

/** The quad over the floor's disc, two triangles facing up, in the court's frame. Pure. */
export function telegraphQuad(half = COURT_R + TELEGRAPH_MARGIN) {
  return new Float32Array([-half, -half, -half, half, half, half, -half, -half, half, half, half, -half]);
}

const NO_FOG_RANGE = new Float32Array([0, 1]);

export class GateTelegraphRenderer {
  constructor(gl) {
    this.gl = gl;
    const prog = buildProgram(gl, TELEGRAPH_VS, TELEGRAPH_FS);
    this.program = prog;
    this.u = {};
    for (const n of ['uVP', 'uCentre', 'uCourt', 'uLift', 'uKind', 'uOrigin', 'uYaw', 'uR', 'uHalfArc', 'uBody', 'uEnd', 'uHalfW', 'uR0', 'uR1', 'uPts', 'uCount',
      'uT', 'uFlash', 'uAlpha', 'uColor', 'uTime', 'uFloorR', 'uStyle', 'uSince', 'uSpan', 'uAfter', 'uPool', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos']) this.u[n] = gl.getUniformLocation(prog, n);
    const verts = telegraphQuad();
    this.count = verts.length / 2;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this.vao = vao;
    this._vp = new Float32Array(16);
    this._pts = new Float32Array(TELEGRAPH_POINTS_MAX * 2);
    /** whether the last draw put a shape down, for the stats and the tests */
    this.drawn = 0;
  }

  /**
   * Draw one attack's shape (`telegraphShape`'s answer; null draws nothing and touches nothing) over the court it names
   * (WB9b: `shape.court`; -1 - the whole arena's - over each court in turn), the first court's centre standing at
   * `centre` in the scene, `seconds` any clock (wrapped here), `fog` the frame's fog as the renderer set it ({ mode,
   * density, range, color, camPos }; none draws unfogged).
   */
  draw(shape, proj, view, eye, seconds, fog = null, centre = COURT_CENTRE) {
    this.drawn = 0;
    if (!shape || !(shape.alpha > 0.001)) return;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform3f(U.uCentre, centre[0], centre[1], centre[2]);
    gl.uniform1i(U.uStyle, shape.style ?? 0);   // WB9e
    gl.uniform1f(U.uSince, shape.since ?? 0);
    gl.uniform1f(U.uSpan, shape.span ?? 1);
    gl.uniform1f(U.uAfter, shape.after ?? -1);
    gl.uniform1i(U.uPool, shape.pool ? 1 : 0);   // WB9d
    gl.uniform1f(U.uLift, TELEGRAPH_LIFT);
    gl.uniform1i(U.uKind, shape.kind);
    gl.uniform2f(U.uOrigin, shape.origin[0], shape.origin[1]);
    gl.uniform1f(U.uYaw, shape.yaw);
    gl.uniform1f(U.uR, shape.r);
    gl.uniform1f(U.uHalfArc, shape.halfArc);
    gl.uniform1f(U.uBody, shape.body);
    gl.uniform2f(U.uEnd, shape.end[0], shape.end[1]);
    gl.uniform1f(U.uHalfW, shape.halfW);
    gl.uniform1f(U.uR0, shape.r0);
    gl.uniform1f(U.uR1, shape.r1);
    this._pts.fill(0);
    shape.points.forEach((p, i) => { this._pts[i * 2] = p[0]; this._pts[i * 2 + 1] = p[1]; });
    gl.uniform2fv(U.uPts, this._pts);
    gl.uniform1i(U.uCount, shape.kind === TELEGRAPH_KIND.spokes ? (shape.n ?? 0) : shape.points.length);   // WBX5: the spokes' count rides the points' slot
    gl.uniform1f(U.uT, shape.t);
    gl.uniform1f(U.uFlash, shape.flash);
    gl.uniform1f(U.uAlpha, Math.min(1, shape.alpha));
    gl.uniform3fv(U.uColor, shape.color);
    gl.uniform1f(U.uTime, duelClock(seconds));
    gl.uniform1f(U.uFloorR, COURT_R);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye ?? centre);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
    // WB9b: over its court - or, the whole arena's, over each of them
    const one = Number.isInteger(shape.court) && shape.court >= 0, k0 = one ? (COURTS[shape.court] ? shape.court : 0) : 0, k1 = one ? k0 + 1 : COURTS.length;
    for (let k = k0; k < k1; k++) {
      gl.uniform2f(U.uCourt, COURTS[k][0], COURTS[k][1]);
      gl.drawArrays(gl.TRIANGLES, 0, this.count);
    }
    this.drawn = k1 - k0;
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(0, 0);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
