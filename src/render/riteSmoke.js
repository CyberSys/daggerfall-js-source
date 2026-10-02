// @ts-check
// WB12d (2026-10-01, Mac: "faithful and a Summoner"): THE RITE'S SMOKE - a pillar of smoke over the faithful's circle,
// from the omen until the breach opens, seen across the omen's ring: a dark plume rising from the braziers' glow,
// widening and leaning as it climbs, billowing upward. Design: bible/11-Multiplayer/World-Bosses.md section 19 D.
//
// The gate's beacon's law (render/gatePass.js): fixed geometry (its column), every placement a uniform, the clock
// handed wrapped and every rate whole cycles over it - the smoke's noise TILES along the column, and climbs a whole
// number of tiles over SMOKE_CLOCK_PERIOD, so the wrap never shows. Blended PREMULTIPLIED (ONE, ONE_MINUS_SRC_ALPHA):
// its alpha is how much sky it hides. Never thinner than a few pixels: far off it widens with its distance, and the
// fog never takes it below SMOKE_FOG_FLOOR, so a circle a few kilometres off is a dark line on the horizon.
//
// Not a DFU member. Ledger A (WB).
import { FOG_FACTOR_GLSL } from './labGrass.js';
import { buildProgram } from './glProgram.js';

/** The clock the smoke is drawn on, seconds, wrapped. */
export const SMOKE_CLOCK_PERIOD = 120;
export const smokeClock = (seconds) => ((seconds % SMOKE_CLOCK_PERIOD) + SMOKE_CLOCK_PERIOD) % SMOKE_CLOCK_PERIOD;
/** The plume: how tall, its radius at the fire and at its top, and how far it leans by its top (metres east, north). */
export const SMOKE_HEIGHT_M = 340;
export const SMOKE_FOOT_R = 3;
export const SMOKE_TOP_R = 70;
export const SMOKE_LEAN = Object.freeze([60, 24]);
/** The column's rings round and up (a plume's swell needs its rows - a beacon's two make a cone). */
export const SMOKE_SEGMENTS = 24;
export const SMOKE_ROWS = 40;
/** Its noise's tiles round the column and up it, and how many tiles it climbs over the clock's period (whole). */
export const SMOKE_TILES_AROUND = 4;
export const SMOKE_TILES_UP = 10;
export const SMOKE_CLIMB_TILES = 20;
/** How dark, how thick, the ember's glow at its foot, the least of it the fog may leave, its widening a metre away. */
export const SMOKE_COLOR = Object.freeze([0.11, 0.1, 0.095]);
export const SMOKE_EMBER = Object.freeze([0.85, 0.28, 0.08]);
export const SMOKE_ALPHA = 0.95;
export const SMOKE_FOG_FLOOR = 0.35;
export const SMOKE_WIDEN = 0.007;
/** The most pillars a frame draws (its host stands one circle at a time - AUDIT WB12d D21: no day's pillar beside another's). */
export const SMOKE_MAX = 2;
/** AUDIT WB12d (G14): THE ONE THRESHOLD - a pillar this faint or fainter is not drawn, and its host says it is not
 *  smoking (scenes/riteHost.js): a pass asked to draw always draws, so the host's foreign-pass mark always follows. */
export const SMOKE_FADE_MIN = 0.001;

const HEAD = `#version 300 es
precision highp float;
`;
const FOG_UNIFORMS = `uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
`;
const f1 = (v) => Number(v).toFixed(4);
const v3 = (a) => `vec3(${a.map(f1).join(', ')})`;

export const SMOKE_VS = HEAD + `layout(location = 0) in vec2 aUV;   // x around 0..1, y up 0..1
uniform mat4 uVP;
uniform vec3 uOrigin;   // the circle's heart, on its ground
uniform vec3 uEye;
out vec2 vUV;
out vec3 vWorld;
out vec3 vAxis;
void main() {
  float a = aUV.x * 6.283185307179586;
  float h = aUV.y;
  // a plume: narrow at the fire, swelling as it climbs, billowed in three slow bulges
  float r = mix(${f1(SMOKE_FOOT_R)}, ${f1(SMOKE_TOP_R)}, pow(h, 0.6)) * (0.88 + 0.12 * sin(h * 18.0 + aUV.x * 6.283185307179586));
  float rad = max(r, length(uEye.xz - uOrigin.xz) * ${f1(SMOKE_WIDEN)});
  vec3 axis = uOrigin + vec3(${f1(SMOKE_LEAN[0])} * h * h, h * ${f1(SMOKE_HEIGHT_M)}, ${f1(SMOKE_LEAN[1])} * h * h);
  vec3 p = axis + vec3(cos(a) * rad, 0.0, sin(a) * rad);
  vUV = aUV;
  vWorld = p;
  vAxis = axis;
  gl_Position = uVP * vec4(p, 1.0);
}`;

export const SMOKE_FS = HEAD + `in vec2 vUV;
in vec3 vWorld;
in vec3 vAxis;
uniform float uTime;
uniform float uFade;
${FOG_UNIFORMS}out vec4 o;
${FOG_FACTOR_GLSL}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// value noise on a lattice that TILES: per's cells round and up, so the column's seam and the clock's wrap are seamless
float tnoise(vec2 q, vec2 per) {
  vec2 i = floor(q), f = fract(q);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(mod(i, per)), b = hash(mod(i + vec2(1.0, 0.0), per));
  float c = hash(mod(i + vec2(0.0, 1.0), per)), d = hash(mod(i + vec2(1.0, 1.0), per));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
void main() {
  float h = vUV.y;
  float climb = uTime * ${f1(SMOKE_CLIMB_TILES / SMOKE_CLOCK_PERIOD)};
  vec2 per = vec2(${f1(SMOKE_TILES_AROUND)}, ${f1(SMOKE_TILES_UP)});
  vec2 q = vec2(vUV.x * per.x, h * per.y - climb);
  float n = 0.55 * tnoise(q, per) + 0.3 * tnoise(q * 2.0, per * 2.0) + 0.15 * tnoise(q * 4.0, per * 4.0);
  // thick where the eye looks through the plume's heart, thin at its edge
  float core = smoothstep(0.0, 0.55, abs(dot(normalize(vWorld - vAxis), normalize(uCamPos - vWorld))));
  float body = smoothstep(0.0, 0.02, h) * (1.0 - smoothstep(0.5, 1.0, h));
  float a = clamp(smoothstep(0.2, 0.75, n) * core * body * ${f1(SMOKE_ALPHA)}, 0.0, 1.0);
  vec3 col = mix(${v3(SMOKE_COLOR)}, ${v3(SMOKE_EMBER)}, pow(1.0 - h, 18.0) * 0.9);
  float fog = max(fogFactorAt(vWorld), ${f1(SMOKE_FOG_FLOOR)});
  a *= fog * uFade;
  o = vec4(col * a, a);
}`;

/** The plume's column, (around, up) pairs, two triangles a cell. Pure. */
export function smokeVertices(segments = SMOKE_SEGMENTS, rows = SMOKE_ROWS) {
  const out = new Float32Array(segments * rows * 12);
  let o = 0;
  for (let j = 0; j < rows; j++) {
    const v0 = j / rows, v1 = (j + 1) / rows;
    for (let i = 0; i < segments; i++) {
      const a = i / segments, b = (i + 1) / segments;
      for (const [u, v] of [[a, v0], [b, v0], [b, v1], [a, v0], [b, v1], [a, v1]]) { out[o++] = u; out[o++] = v; }
    }
  }
  return out;
}

function mat4Multiply(out, a, b) {
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}
const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOCUS = new Float32Array(4);
const ORIGIN = new Float32Array([0, 0, 0]);

/** The rite's pillars of smoke, one foreign pass. */
export class RiteSmokeRenderer {
  /** @param {WebGL2RenderingContext} gl */
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, SMOKE_VS, SMOKE_FS, 'rite smoke');
    this.u = {};
    for (const n of ['uVP', 'uOrigin', 'uEye', 'uTime', 'uFade', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus']) this.u[n] = gl.getUniformLocation(this.program, n);
    const verts = smokeVertices();
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this.count = verts.length / 2;
    this._vp = new Float32Array(16);
    this.drawn = 0;
  }

  /**
   * Draw the pillars: `smokes` [{ origin: [x, y, z] the circle's heart on its ground, fade 0..1 }] (at most SMOKE_MAX,
   * the faded skipped), `eye` the view's own eye, `seconds` any clock (wrapped here), `fog` the frame's fog.
   */
  draw(smokes, proj, view, eye, seconds, fog = null) {
    this.drawn = 0;
    const list = (Array.isArray(smokes) ? smokes : []).filter((s) => s && Array.isArray(s.origin) && s.origin.length === 3 && s.origin.every(Number.isFinite) && s.fade > SMOKE_FADE_MIN).slice(0, SMOKE_MAX);
    if (!list.length) return;
    const gl = this.gl, U = this.u;
    mat4Multiply(this._vp, proj, view);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform1f(U.uTime, smokeClock(seconds));
    gl.uniform3fv(U.uEye, eye ?? fog?.camPos ?? ORIGIN);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? eye ?? ORIGIN);
    if (U.uFocus) gl.uniform4fv(U.uFocus, fog?.focus ?? NO_FOCUS);   // AUDIT DEEP R-1: under the travel view the fog is the traveller's (fogGlsl.js FOCUS_GLSL)
    gl.bindVertexArray(this.vao);
    for (const s of list) {
      gl.uniform3f(U.uOrigin, s.origin[0], s.origin[1], s.origin[2]);
      gl.uniform1f(U.uFade, Math.min(1, s.fade));
      gl.drawArrays(gl.TRIANGLES, 0, this.count);
      this.drawn++;
    }
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
