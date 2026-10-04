// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SUNBABY1 — THE SUN BABY: A SKY OF FLOWERS OVER DAGGERFALL, FOR A LIVE EVENT.
//
// The ask (2026-10-04): "develop a command like /event dread that turns the sky into pretty flowers, clears weather
// and shows the sun as a big laughing baby ... Like teletubbies".
//
// EVENT1's door, a second word on it. A dev stages it (`/event sunbaby`, the relay's `stage` frame - net/wire.js
// LIVE_EVENTS), every player online sees it, and it ends when a dev ends it (`/event off`). This file is what it LOOKS
// like; the relay carries only the word.
//
// ONE PASS OVER EVERY SKY. The dread is a grade, because it keeps the sky's own light. This event replaces the sky:
// a bright nursery blue full of drifting flowers, and a big baby-faced sun that giggles. So it is ONE fullscreen pass
// (render/sunbabySkyRenderer.js), drawn over whichever sky the lane has (the classic panorama, the port's dome or
// Dynamic Skies) and over the volumetric clouds, at the far plane, by the event's weight - the land is drawn over it as
// over any sky. The shader carries no colour of its own: SUNBABY_GLSL is generated from the tables below, so the JS and
// the GLSL cannot drift.
//
// THE WEATHER CLEARS. While the event is up the land wears SUNBABY_WEATHER ('sunny'): no rain, no snow, no storm and
// its thunder, no overcast haze - the host's shown weather, never the sim's. The sim's word is the world's (rolled,
// shared on the weather map, saved), so it goes on underneath and comes back the frame the event ends.
//
// IT IS ALWAYS A BRIGHT DAY UNDER IT. The flower sky is a day sky at any hour, so the land's ambient is lifted toward
// noon's by the weight (sunbabyLight) and its haze is the flower sky's horizon (sunbabyHaze) - the land sits under the
// sky it sees.
//
// THE SUN RISES. A player who watches it begin sees the sun baby rise out of the east over SUNBABY_FADE_S as the
// flowers bloom in, and set the same way when it ends; a player who joins mid-event has it whole at once.
//
// ONLINE ALONE, as the dread: offline there is no hub link, nothing sets the weight, and every path is untouched.
// ═══════════════════════════════════════════════════════════════════

/** The live event this file draws (net/wire.js LIVE_EVENTS). */
export const SUNBABY_EVENT = 'sunbaby';
/** Real seconds the sun takes to rise on a player watching the event begin, and to set as it ends. */
export const SUNBABY_FADE_S = 8;
/** The weather the land wears while the event is up - the clear day (world/weather.js WEATHER_TYPES). */
export const SUNBABY_WEATHER = 'sunny';

// ── The sky's colours (display space, 0..1) ────────────────────────
/** The nursery-blue dome: overhead, and at the horizon. */
export const SUNBABY_ZENITH = Object.freeze([0.18, 0.52, 0.93]);
export const SUNBABY_HORIZON = Object.freeze([0.70, 0.88, 1.0]);
/** The flowers' petals - pink, butter yellow, white, lilac, poppy red, sky blue. */
export const SUNBABY_PETALS = Object.freeze([
  Object.freeze([1.0, 0.56, 0.74]),
  Object.freeze([1.0, 0.90, 0.36]),
  Object.freeze([1.0, 0.98, 0.95]),
  Object.freeze([0.78, 0.60, 1.0]),
  Object.freeze([1.0, 0.36, 0.34]),
  Object.freeze([0.55, 0.80, 1.0]),
]);
/** A flower's heart. */
export const SUNBABY_HEART = Object.freeze([1.0, 0.72, 0.16]);
/** How many grid cells of the two flower layers hold a flower. */
export const SUNBABY_DENSITY = Object.freeze([0.72, 0.6]);

// ── The sun baby ───────────────────────────────────────────────────
/** The face's angular radius, radians (~11 degrees - the rays reach ~1.8 times it): a BIG sun. */
export const SUNBABY_SUN_RADIUS = 0.19;
/** The sun's elevation once risen, and where it waits below the horizon before it rises, degrees. */
export const SUNBABY_SUN_ELEV_DEG = 30;
export const SUNBABY_SUN_SET_DEG = -24;
/** The sun's bearing, radians from +x (map east, where the port's own sun rises) toward +z. */
export const SUNBABY_SUN_BEARING = 0.4;
/** The face: skin, its rim of gold, the rays' gold, the blush, the laughing mouth and its tongue, the eyes' brown. */
export const SUNBABY_SKIN = Object.freeze([1.0, 0.84, 0.70]);
export const SUNBABY_RIM = Object.freeze([1.0, 0.80, 0.18]);
export const SUNBABY_RAY = Object.freeze([1.0, 0.86, 0.30]);
export const SUNBABY_BLUSH = Object.freeze([1.0, 0.52, 0.58]);
export const SUNBABY_MOUTH = Object.freeze([0.55, 0.12, 0.14]);
export const SUNBABY_TONGUE = Object.freeze([1.0, 0.45, 0.52]);
export const SUNBABY_EYE = Object.freeze([0.30, 0.16, 0.10]);

// ── The land under it ──────────────────────────────────────────────
/** The ambient light the land is lifted toward at full weight - noon's (worldClock EXTERIOR_NOON_AMBIENT), warmed. */
export const SUNBABY_AMBIENT = Object.freeze([0.95, 0.92, 0.84]);

const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * The event's weight on this client, 0..1 - EVENT1's createDread, for this word. `set(ev, {live})` takes the hub's word
 * (net/online.js onEvent: `{kind, at}` or null); `tick(dtSeconds)` walks the weight toward it and answers it. A change
 * the player watched (`live`) walks over SUNBABY_FADE_S; one they did not (a welcome) is whole. `on` is the word itself
 * - what the weather follows, at once, while the sky fades.
 */
export function createSunbaby() {
  let target = 0, weight = 0;
  return {
    set(ev, { live = false } = {}) {
      target = ev?.kind === SUNBABY_EVENT ? 1 : 0;
      if (!live) weight = target;
    },
    tick(dt) {
      const step = Math.max(0, dt || 0) / SUNBABY_FADE_S;
      weight = weight < target ? Math.min(target, weight + step) : Math.max(target, weight - step);
      return weight;
    },
    get weight() { return weight; },
    get on() { return target === 1; },
  };
}

/** Where the sun baby stands at weight `w`: a unit direction ([x, y, z], y up), risen to SUNBABY_SUN_ELEV_DEG at 1 and
 *  waiting at SUNBABY_SUN_SET_DEG at 0, eased so it slows as it climbs. Pure. */
export function sunbabySunDir(w) {
  const k = clamp01(w), e = 1 - (1 - k) ** 3;
  const elev = (SUNBABY_SUN_SET_DEG + (SUNBABY_SUN_ELEV_DEG - SUNBABY_SUN_SET_DEG) * e) * Math.PI / 180;
  const c = Math.cos(elev);
  return [c * Math.cos(SUNBABY_SUN_BEARING), Math.sin(elev), c * Math.sin(SUNBABY_SUN_BEARING)];
}

/** The land's haze under the event: the fog colour `rgb` toward the flower sky's horizon by `w`. A new array. Pure. */
export const sunbabyHaze = (rgb, w) => mix3(rgb, SUNBABY_HORIZON, clamp01(w));

/** The land's ambient under the event: `rgb` lifted toward SUNBABY_AMBIENT by `w` (never darkened - a brighter
 *  ambient is kept). A fresh Float32Array, as the renderer takes a light. Pure. */
export function sunbabyLight(rgb, w) {
  const k = clamp01(w);
  return new Float32Array([0, 1, 2].map((i) => rgb[i] + Math.max(0, SUNBABY_AMBIENT[i] - rgb[i]) * k));
}

/** The sky the water mirrors under the event ({zenith, horizon}), toward the flower sky's own by `w`. Pure. */
export const sunbabyWaterSky = (ws, w) => (clamp01(w) > 0 && ws
  ? { zenith: mix3(ws.zenith, SUNBABY_ZENITH, clamp01(w)), horizon: mix3(ws.horizon, SUNBABY_HORIZON, clamp01(w)) }
  : ws);

// ── The GLSL ──────────────────────────────────────────────────────
const f = (v) => v.toFixed(4);
const v3 = (c) => `vec3(${c.map(f).join(', ')})`;

/** The flower sky and the sun baby in GLSL, generated from the tables above:
 *  `vec3 sunbabySky(vec3 dir, vec3 sunDir, float t)` - the sky's colour along the unit ray `dir` at `t` seconds, the
 *  sun baby at `sunDir`. Derivatives are taken before any branch (the AA reads them), so it is safe anywhere in main. */
export const SUNBABY_GLSL = `
const float SB_PI = 3.14159265;
float sbHash(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec2 sbHash2(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
vec3 sbPetal(float h) {
${SUNBABY_PETALS.map((c, i) => `  ${i < SUNBABY_PETALS.length - 1 ? `if (h < ${f((i + 1) / SUNBABY_PETALS.length)}) ` : ''}return ${v3(c)};`).join('\n')}
}
// One layer of flowers on the cell grid of p; px is p's footprint on screen (cells a pixel). rgb, coverage.
vec4 sbFlowers(vec2 p, float px, float layer, float density, float t) {
  vec2 cell = floor(p);
  vec2 q = fract(p) - 0.5;
  float h = sbHash(cell + layer * 17.13);
  if (h > density) return vec4(0.0);
  q -= (sbHash2(cell + layer * 31.7) - 0.5) * 0.2;
  float size = 0.27 + 0.13 * sbHash(cell * 1.71 + layer * 5.3);
  float n = h < density * 0.5 ? 5.0 : 6.0;
  float rot = sbHash(cell + 7.7 + layer) * 6.2832 + t * (sbHash(cell + 3.1) - 0.5) * 0.5;
  float r = length(q) / size, aa = px / size + 1e-4;
  float a = atan(q.y, q.x) + rot;
  float petal = 0.5 + 0.5 * cos(n * a);
  float edge = 0.42 + 0.58 * sqrt(petal);
  float cover = 1.0 - smoothstep(edge - aa, edge + aa, r);
  vec3 pc = sbPetal(fract(h * 7.31 + layer * 0.37));
  vec3 col = mix(pc * 0.78, mix(pc, vec3(1.0), 0.3), smoothstep(0.15, 0.95, r / edge));
  col *= 0.86 + 0.14 * smoothstep(0.02, 0.25, petal);
  float heart = 1.0 - smoothstep(0.27 - aa, 0.27 + aa, r);
  vec3 hc = ${v3(SUNBABY_HEART)} * (0.88 + 0.12 * cos(r * 30.0));
  col = mix(col, hc, heart);
  return vec4(col, cover);
}
float sbFill(float d, float px) { return 1.0 - smoothstep(-px, px, d); }
// The distance to an upper (up > 0) or lower (up < 0) half-ring of radius rr about c, round-capped, th thick.
float sbArc(vec2 p, vec2 c, float rr, float th, float up) {
  vec2 d = p - c;
  if (d.y * up >= 0.0) return abs(length(d) - rr) - th;
  return min(length(d - vec2(rr, 0.0)), length(d + vec2(rr, 0.0))) - th;
}
// The sun baby over col, the face's uv in face radii (1 the rim), px a pixel in the same units.
vec3 sbBaby(vec3 col, vec2 uv, float px, float t) {
  // the giggle: bursts of quick laughs, the head bobbing and tilting with them
  float burst = smoothstep(-0.3, 0.5, sin(t * 0.9));
  float giggle = (0.5 + 0.5 * sin(t * 11.0)) * burst;
  float tilt = 0.09 * sin(t * 1.3);
  uv -= vec2(0.025 * sin(t * 1.7), 0.03 * sin(t * 2.3) + 0.025 * giggle);
  uv = mat2(cos(tilt), sin(tilt), -sin(tilt), cos(tilt)) * uv;
  float r = length(uv);
  // the halo and the rays, turning slowly, stretching as it laughs
  col += ${v3(SUNBABY_RAY)} * 0.55 * exp(-max(r - 1.0, 0.0) * 2.2) * (0.85 + 0.15 * burst);
  float a = atan(uv.y, uv.x) + t * 0.12;
  float ray = pow(0.5 + 0.5 * cos(16.0 * a), 2.5);
  float reach = 1.18 + (0.58 + 0.08 * giggle) * ray;
  col = mix(col, mix(${v3(SUNBABY_RAY)}, ${v3(SUNBABY_RIM)}, clamp((r - 1.0) / 0.7, 0.0, 1.0)), sbFill(r - reach, px * 1.5));
  // the rim, then the face
  col = mix(col, ${v3(SUNBABY_RIM)} * (1.0 - 0.15 * smoothstep(0.9, 1.06, r)), sbFill(r - 1.06, px));
  vec3 skin = ${v3(SUNBABY_SKIN)} * (1.0 - 0.10 * pow(r / 0.9, 4.0)) + 0.06 * smoothstep(0.5, 0.0, length(uv - vec2(-0.25, 0.35)));
  col = mix(col, skin, sbFill(r - 0.9, px));
  // the blush, squeezed up by the laugh
  for (int s = -1; s <= 1; s += 2) {
    vec2 c = vec2(float(s) * 0.52, -0.1 + 0.04 * giggle);
    col = mix(col, ${v3(SUNBABY_BLUSH)}, 0.55 * (1.0 - smoothstep(0.06, 0.18, length(uv - c))));
  }
  // the eyes: shut tight with laughing (^ ^), and the brows raised over them
  for (int s = -1; s <= 1; s += 2) {
    vec2 e = vec2(float(s) * 0.33, 0.14);
    vec2 pe = vec2(uv.x, e.y + (uv.y - e.y) / (1.0 - 0.3 * giggle));
    col = mix(col, ${v3(SUNBABY_EYE)}, sbFill(sbArc(pe, e, 0.14, 0.04, 1.0), px));
    col = mix(col, ${v3(SUNBABY_EYE)} * 1.5, 0.8 * sbFill(sbArc(uv, e + vec2(0.0, 0.17 + 0.03 * giggle), 0.13, 0.022, 1.0), px));
  }
  // the button nose
  col = mix(col, ${v3(SUNBABY_SKIN)} * 0.86, sbFill(length((uv - vec2(0.0, -0.03)) / vec2(1.0, 0.8)) - 0.065, px));
  col = mix(col, vec3(1.0), 0.5 * sbFill(length(uv - vec2(-0.02, -0.01)) - 0.02, px));
  // the laughing mouth: a wide D, opening with every giggle, its tongue at the bottom
  float mh = 0.2 + 0.13 * giggle;
  vec2 m = (uv - vec2(0.0, -0.24)) / vec2(0.32, mh);
  float mouth = max((length(m) - 1.0) * min(0.32, mh), uv.y - (-0.24 + 0.25 * uv.x * uv.x));
  float mf = sbFill(mouth, px);
  vec3 inner = ${v3(SUNBABY_MOUTH)};
  inner = mix(inner, ${v3(SUNBABY_TONGUE)}, sbFill(length((uv - vec2(0.0, -0.24 - mh * 0.95)) / vec2(1.3, 1.0)) - 0.16, px));
  col = mix(col, ${v3(SUNBABY_EYE)}, sbFill(mouth - 0.025, px));
  col = mix(col, inner, mf);
  // the one curl of hair on top
  col = mix(col, ${v3(SUNBABY_EYE)} * 1.3, sbFill(max(sbArc(uv, vec2(0.05, 0.74), 0.09, 0.03, -1.0), -(uv.x - 0.05)), px));
  col = mix(col, ${v3(SUNBABY_EYE)} * 1.3, sbFill(sbArc(uv, vec2(0.05, 0.74 + 0.045), 0.045, 0.03, 1.0), px));
  return col;
}
vec3 sunbabySky(vec3 dir, vec3 sunDir, float t) {
  // the dome: nursery blue over a pale horizon, a little deeper below it where the land will cover it
  float e = clamp(dir.y, 0.0, 1.0);
  vec3 col = mix(${v3(SUNBABY_HORIZON)}, ${v3(SUNBABY_ZENITH)}, pow(e, 0.6));
  col = mix(col, ${v3(SUNBABY_HORIZON)} * 0.9, clamp(-dir.y * 3.0, 0.0, 1.0));
  // the flowers, on a ceiling over the land (big overhead, small toward the horizon), drifting; px from the
  // continuous ceiling coordinate, before any branch
  vec2 p = dir.xz * min(1.0 / (max(dir.y, 0.0) + 0.25), 4.0) * 7.0 + vec2(t * 0.045, t * 0.02);
  float px = length(fwidth(p));
  vec2 p2 = p * 0.8 + vec2(0.5, 0.37);
  float px2 = px * 0.8;
  float up = smoothstep(0.015, 0.14, dir.y);
  vec4 l1 = sbFlowers(p2, px2, 1.0, ${f(SUNBABY_DENSITY[1])}, t);
  col = mix(col, l1.rgb, l1.a * up);
  vec4 l0 = sbFlowers(p, px, 0.0, ${f(SUNBABY_DENSITY[0])}, t);
  col = mix(col, l0.rgb, l0.a * up);
  // the sun baby: the face's plane square to the eye, its up the world's
  vec3 ex = normalize(cross(vec3(0.0, 1.0, 0.0), sunDir));
  vec3 ey = cross(sunDir, ex);
  vec2 uv = vec2(dot(dir, ex), dot(dir, ey)) / ${f(SUNBABY_SUN_RADIUS)};
  float upx = length(fwidth(uv));
  if (dot(dir, sunDir) > cos(${f(SUNBABY_SUN_RADIUS)} * 4.0)) col = sbBaby(col, uv, upx, t);
  return col;
}
`;
