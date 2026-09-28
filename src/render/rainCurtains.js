// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV4 - THE CURTAINS, SEEN FROM ABOVE (bible/06-Systems/Travel-View.md).
//
// Mac (2026-09-27): "Every detail like weather patterns, should be 1:1
// in this mode." VC7c hangs a veil under every cell whose weather falls
// (render/volumetricClouds.js CURTAIN_*), and draws it into the SKY MAP
// - for rays that look up, composited only on far-plane pixels. From a
// camera 450 m up the ground fills the picture, so a storm three leagues
// off was a dark patch in the deck and nothing under it: the rain it was
// dropping stood nowhere in the view.
//
// This is the same veil, stood in the WORLD for the travel view: a
// cylinder of CURTAIN_SHARE of the cell's radius, from under the ground
// (the depth the world wrote cuts its foot where the hills stand) up
// into the cell's base (CURTAIN_INTO), its optical depth CURTAIN_EXT a
// metre at a full fall - the CHORD a ray of sight takes through the
// solid cylinder at that fragment (2 R cos of the angle to the face's
// normal: a back face's chord is none), so a curtain reads dense through
// its middle and thin at its rim, as a column of rain does - streaked by
// CURTAIN_STREAKS streaks around its axis sliding down with the fall,
// and fading as the eye comes over it (the falling rain takes over: the
// player's own precipitation, VC7c's `near` law). The fog thins it as it
// thins the ground, measured from the traveller (uFocus - the view's
// whole point, render/fogGlsl.js). Rain grey-blue, snow paler
// (CURTAIN_FALL's kind); the frame's own light greys it at night.
//
// NOTHING IS INVENTED: the cells are the weather map's (WEATHER3c
// skyCells through world.js fieldCellsHere, the ones the clouds draw), at
// the shared minute - two players in the view see the same storm in the
// same place. A sandstorm is a wall on the ground already; fog and cloud
// do not fall.
//
// A FOREIGN PASS on the world host alone (the renderer's markForeignPass
// follows it), drawn only while the travel view is up.
// ═══════════════════════════════════════════════════════════════════
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';
import { ringVertices } from './duelWall.js';
import { CURTAIN_SHARE, CURTAIN_EXT, CURTAIN_STREAKS, CURTAIN_INTO } from './volumetricClouds.js';

/** Quads around a curtain. */
export const CURTAIN_SEGMENTS = 48;
/** The most curtains a frame draws - the nearest to the traveller. */
export const CURTAINS_MAX = 8;
/** How far past the view's reach a curtain may stand and still be drawn (m) - the far plane is 6 km off the eye. */
export const CURTAIN_REACH_M = 7000;
/** How far under the traveller's ground a curtain's foot reaches (m) - the world's depth cuts it wherever the land is. */
export const CURTAIN_BELOW_M = 300;
/** AUDIT TV D3: how far under the LOWEST ground about the curtain its foot reaches (m) - a storm over a valley deeper
 *  than CURTAIN_BELOW_M under the traveller hung its foot in the air over the valley floor. */
export const CURTAIN_FOOT_MARGIN_M = 40;
/** ...and where that ground is asked: the centre and this many points around the veil's rim. */
export const CURTAIN_FOOT_SAMPLES = 8;
/** AUDIT DEEP R-5: the most a veil thins for the traveller standing inside it (the eye still outside) - their own storm
 *  stays a storm from the air: the falling rain around them is 1.6 cm streaks, under a pixel from 150 m up. */
export const CURTAIN_OWN_ALPHA = 0.35;
/** Rain's and snow's colour, display-encoded (the lit lane's frame image is 8-bit and display encoded - airPass.js). */
export const CURTAIN_RAIN_COLOR = Object.freeze([0.5, 0.54, 0.6]);
export const CURTAIN_SNOW_COLOR = Object.freeze([0.84, 0.86, 0.9]);
/** The streaks' fall, cycles a second up the curtain's height (a whole number over the clock's period, so it never
 *  stutters as a float's seconds grow - duelWall.js's law). */
export const CURTAIN_CLOCK_PERIOD = 120;
export const CURTAIN_FALL_HZ = 0.25;
export const curtainClock = (s) => ((s % CURTAIN_CLOCK_PERIOD) + CURTAIN_CLOCK_PERIOD) % CURTAIN_CLOCK_PERIOD;

/**
 * THE CURTAINS TO DRAW, nearest the traveller first: the cells that fall (VC7c's own `fall`, grown with its system),
 * whose veil stands within CURTAIN_REACH_M of the focus, at most CURTAINS_MAX, each a cylinder in the scene -
 * `centre` (x, foot y, z), `radius`, `height` (foot to a little into the base), `depth` (the extinction a metre),
 * `kind` (0 rain, 1 snow) and `alpha` (the fade as the eye - or the traveller - comes over it). A storm cell's clip keeps
 * its veil inside the disc it paints within. Pure.
 * @param {Array<any>} cells - world.js fieldCellsHere's, in the host's metres (volumetricClouds.js cellOfField)
 * @param {{ focus: number[], eye: number[], ground?: number, groundAt?: (x:number, z:number) => number, reach?: number }} at
 *   - the traveller's head, the view's eye, the traveller's ground (y) the deck's heights are measured from, the land's
 *   height anywhere (the host's: the built grid, the far ring past it) for the foot, and how far the frame's fog lets
 *   anything be seen (AUDIT DEEP R-6: a veil past it is wholly fogged - a slot and a fill for nothing)
 */
export function curtainsOf(cells, { focus, eye, ground = null, groundAt = null, reach = CURTAIN_REACH_M }) {
  const far = Math.min(CURTAIN_REACH_M, Number.isFinite(reach) && reach > 0 ? reach : CURTAIN_REACH_M);
  const g = ground ?? focus?.[1] ?? 0;
  const out = [];
  for (const c of cells ?? []) {
    if (!c || !(c.fall > 0) || !Number.isFinite(c.x) || !Number.isFinite(c.z) || !(c.r > 0)) continue;
    const off = c.clip ? Math.hypot(c.x - c.clip[0], c.z - c.clip[1]) : 0;
    if (c.clip && off > c.clip[2]) continue;
    // AUDIT DEEP R-6: and the veil stays INSIDE that disc - a centre near its edge spilled the veil past the storm
    const radius = Math.min(c.r * CURTAIN_SHARE, c.clip ? c.clip[2] - off : Infinity);
    if (!(radius > 1)) continue;
    const d = Math.hypot(c.x - focus[0], c.z - focus[2]);
    if (d - radius > far) continue;
    const base = (c.base ?? 600) + ((c.top ?? c.base ?? 600) - (c.base ?? 600)) * CURTAIN_INTO;
    // AUDIT DEEP R-4: the LOWEST LAND's rule wherever the host knows the land - the traveller's own (CURTAIN_BELOW_M under
    // their ground) only where it knows none. Kept under both, a storm off a coast hung 300 m of veil down through the
    // sea, whose surface writes no depth to cut it.
    const lo = lowestGround(groundAt, c.x, c.z, radius);
    const foot = Number.isFinite(lo) ? lo - CURTAIN_FOOT_MARGIN_M : g - CURTAIN_BELOW_M;
    // VC7c's `near`: as the eye comes over the veil it thins to nothing - the rain the player stands in is theirs.
    // AUDIT TV D2: and as the TRAVELLER does - a traveller inside the veil with the eye still outside it was seen
    // through the whole cylinder's chord, the storm's full depth drawn in front of the very ground they stand on
    // AUDIT DEEP R-5: ...but only down to CURTAIN_OWN_ALPHA - the traveller's own storm stays a storm from the air
    const ramp = (dist) => Math.min(1, Math.max(0, (dist - radius * 0.85) / (radius * 0.3)));
    const alpha = ramp(Math.hypot(c.x - eye[0], c.z - eye[2])) * Math.max(CURTAIN_OWN_ALPHA, ramp(d));
    if (alpha <= 0.001) continue;
    out.push({ centre: [c.x, foot, c.z], radius, height: g + base - foot, depth: CURTAIN_EXT * c.fall, kind: c.fallKind ? 1 : 0, alpha, d });
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, CURTAINS_MAX);
}

/** AUDIT TV D3: the lowest land under a veil - its centre, CURTAIN_FOOT_SAMPLES points on its rim and as many half way in
 *  (AUDIT DEEP R-4: the foot now stands on these alone, so a valley inside the veil is looked for too) - Infinity with no
 *  host, or none of it known: the traveller's own rule stands. */
export function lowestGround(groundAt, x, z, radius) {
  if (typeof groundAt !== 'function') return Infinity;
  let lo = Infinity;
  const at = (px, pz) => { const h = groundAt(px, pz); if (Number.isFinite(h) && h < lo) lo = h; };
  at(x, z);
  for (let i = 0; i < CURTAIN_FOOT_SAMPLES; i++) {
    const a = (i / CURTAIN_FOOT_SAMPLES) * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a);
    at(x + ca * radius, z + sa * radius);
    at(x + ca * radius * 0.5, z + sa * radius * 0.5);
  }
  return lo;
}

const HEAD = `#version 300 es
precision highp float;
`;
export const CURTAIN_VS = HEAD + `layout(location = 0) in vec2 aUV;   // x: around 0..1, y: up 0..1
uniform mat4 uVP;
uniform vec3 uCentre;
uniform float uRadius;
uniform float uHeight;
out vec2 vUV;
out vec3 vWorld;
out vec2 vNormal;
void main() {
  float a = aUV.x * 6.283185307179586;
  vec2 n = vec2(cos(a), sin(a));
  vec3 p = uCentre + vec3(n.x * uRadius, aUV.y * uHeight, n.y * uRadius);
  vUV = aUV;
  vWorld = p;
  vNormal = n;
  gl_Position = uVP * vec4(p, 1.0);
}`;
export const CURTAIN_FS = HEAD + `in vec2 vUV;
in vec3 vWorld;
in vec2 vNormal;
uniform vec3 uEye;       // the view's own eye - the chord is the line of sight's
uniform float uRadius;
uniform float uHeight;
uniform float uDepth;    // extinction a metre (CURTAIN_EXT x the cell's fall)
uniform float uAlpha;
uniform float uTime;     // curtainClock's seconds
uniform vec3 uColor;
uniform float uLight;    // the frame's light on it, 0..1
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}
float hash(float x) { return fract(sin(x * 127.1) * 43758.5453); }
void main() {
  // THE CHORD: the line of sight through the solid cylinder from this front-face point - 2 R cos(angle to the
  // face's normal), taken on the ground plane (the veil is vertical)
  vec2 toEye = uEye.xz - vWorld.xz;
  float len = length(toEye);
  float c = len > 1e-3 ? max(0.0, dot(vNormal, toEye / len)) : 0.0;
  float chord = 2.0 * uRadius * c;
  // the streaks around its axis, sliding down with the fall, and their fibres
  float k = floor(vUV.x * ${CURTAIN_STREAKS}.0);
  float streak = 0.6 + 0.8 * hash(k);
  float fibre = 0.85 + 0.3 * hash(floor(vUV.x * ${CURTAIN_STREAKS * 3}.0) + 17.0);
  float slide = 0.9 + 0.1 * sin(6.283185307179586 * (vUV.y * 6.0 + uTime * ${CURTAIN_FALL_HZ.toFixed(2)}));
  float tau = uDepth * chord * streak * fibre * slide;
  // the top thins into the base it falls from; the foot is the ground's to cut
  float top = 1.0 - smoothstep(0.92, 1.0, vUV.y);
  float a = (1.0 - exp(-tau)) * top * uAlpha * fogFactorAt(vWorld);
  o = vec4(uColor * uLight * a, a);   // premultiplied
}`;

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_WATER_FOG = new Float32Array(20);
const NO_FOCUS = new Float32Array(4);

export class RainCurtainsRenderer {
  constructor(gl) {
    this.gl = gl;
    const prog = buildProgram(gl, CURTAIN_VS, CURTAIN_FS);
    this.program = prog;
    this.u = {};
    for (const n of ['uVP', 'uCentre', 'uRadius', 'uHeight', 'uEye', 'uDepth', 'uAlpha', 'uTime', 'uColor', 'uLight', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uDwFog', 'uFocus']) this.u[n] = gl.getUniformLocation(prog, n);
    const verts = ringVertices(CURTAIN_SEGMENTS);
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
    this.drawn = 0;
  }

  /**
   * Draw the curtains (curtainsOf's list) from `eye` - the frame's own - with `light` the frame's light on them and
   * `fog` the frame's fog as the renderer set it ({ mode, density, range, camPos, focus, dw }), `fade` the view's rise
   * (AUDIT TV D1: the curtains come in with the view as OPACITY - scaling the light instead drew them near black over
   * the ground while the camera rose). Nothing to draw, nothing touched. Returns how many it drew.
   */
  draw(curtains, proj, view, eye, seconds, { light = 1, fog = null, fade = 1 } = {}) {
    this.drawn = 0;
    const k = Math.max(0, Math.min(1, fade));
    const list = k > 0.001 ? (curtains ?? []).filter((c) => c && c.alpha > 0.001 && c.radius > 0 && c.height > 0).slice(0, CURTAINS_MAX) : [];
    if (!list.length) return 0;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform3f(U.uEye, eye[0], eye[1], eye[2]);
    gl.uniform1f(U.uTime, curtainClock(seconds));
    gl.uniform1f(U.uLight, Math.max(0, Math.min(1, light)));
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye);
    if (U.uFocus) gl.uniform4fv(U.uFocus, fog?.focus ?? NO_FOCUS);   // TV1's focus: the fog is the traveller's
    if (U.uDwFog) gl.uniform4fv(U.uDwFog, fog?.dw ?? NO_WATER_FOG);
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);   // both faces reach the shader: a back face's chord is zero, so it adds nothing (no winding to trust under the mirrored lens)
    for (const c of list) {
      gl.uniform3f(U.uCentre, c.centre[0], c.centre[1], c.centre[2]);
      gl.uniform1f(U.uRadius, c.radius);
      gl.uniform1f(U.uHeight, c.height);
      gl.uniform1f(U.uDepth, c.depth);
      gl.uniform1f(U.uAlpha, Math.min(1, c.alpha) * k);
      gl.uniform3fv(U.uColor, c.kind ? CURTAIN_SNOW_COLOR : CURTAIN_RAIN_COLOR);
      gl.drawArrays(gl.TRIANGLES, 0, this.count);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    return this.drawn;
  }
}
