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
export const AURA_VS = HEAD + `layout(location = 0) in vec2 aP;   // the ground: a corner -1..1; the flames: x the step round 0..1, y up 0..1
uniform mat4 uVP;
uniform int uKind;      // 0 the ground, 1 the flames
uniform vec3 uAt;       // the feet
uniform float uGroundR, uRingR, uFlameH, uLift;
out vec2 vP;            // the ground: metres about the feet; the flames: (the angle's share, the height's)
out vec3 vWorld;
void main() {
  vec3 w;
  if (uKind == 0) {
    vP = aP * uGroundR;
    w = uAt + vec3(vP.x, uLift, vP.y);
  } else {
    float a = aP.x * 6.283185307179586;
    vP = aP;
    w = uAt + vec3(cos(a) * uRingR, uLift + aP.y * uFlameH, sin(a) * uRingR);
  }
  vWorld = w;
  gl_Position = uVP * vec4(w, 1.0);
}`;
export const AURA_FS = HEAD + `in vec2 vP;
in vec3 vWorld;
uniform int uKind;
uniform float uTime, uSeed, uKindle, uRingR, uGroundR;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 o;
${FOG_FACTOR_GLSL}${NOISE_GLSL}
const float TAU = 6.283185307179586;
void main() {
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

export class AuraRingRenderer {
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, AURA_VS, AURA_FS, 'aura ring');
    this.u = {};
    for (const n of ['uVP', 'uKind', 'uAt', 'uGroundR', 'uRingR', 'uFlameH', 'uLift', 'uTime', 'uSeed', 'uKindle', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus']) this.u[n] = gl.getUniformLocation(this.program, n);
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
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    /** how many auras the last draw burned, for the stats and the tests */
    this.drawn = 0;
  }

  /**
   * Draw the frame's auras - `list` `[{ at: [x, y, z] the wearer's feet in the scene, seed?, kindle? 0..1 }]` (already
   * picked: auraWearers) - with the frame's camera, its clock (`seconds`) and its fog as the renderer set it
   * ({ mode, density, range, camPos, focus }). Nothing to draw, nothing touched.
   */
  draw(list, proj, view, eye, seconds, fog = null) {
    this.drawn = 0;
    if (!Array.isArray(list) || !list.length) return;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform1f(U.uTime, auraClock(seconds));
    gl.uniform1f(U.uGroundR, AURA_GROUND_R); gl.uniform1f(U.uRingR, AURA_RING_R); gl.uniform1f(U.uFlameH, AURA_FLAME_H); gl.uniform1f(U.uLift, AURA_LIFT_M);
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
      gl.uniform1i(U.uKind, 0);
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.uniform1i(U.uKind, 1);
      gl.bindVertexArray(this.flameVao);
      gl.drawArrays(gl.TRIANGLES, 0, AURA_STEPS * 6);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
