// @ts-check
// TACT4 - A FOE'S TELEGRAPH ON THE GROUND (bible/12-Enhanced-AI/Tactics-Arc.md): the world boss's floor telegraph
// (render/gateTelegraph.js) at a foe's scale - one flat quad at the foe's feet, the shape the fragment's question
// against ai/foeBlows.js inBlow (the pins hold `blowField` to it point for point, and the shader's text to it): a dim
// outline at once, filling outward as the wind-up runs, a bright flash at the landing. Added onto the frame (ONE, ONE)
// so it only brightens what it lies on, depth-tested and never depth-written, lifted and offset off the ground.
import { buildProgram } from './glProgram.js';
import { FOG_FACTOR_GLSL } from './labGrass.js';   // AUDIT TACT D9: the renderer's one fog block
import { BLOW } from '../ai/blowShapes.js';   // the leaf - the brain stays off the renderer's boot graph

/** The shapes as the shader's `uKind` says them. */
export const BLOW_KIND = Object.freeze({ lunge: 0, sweep: 1, slam: 2 });
/** The quad's half-extent about the foe's feet - every shape fits (a lunge's lane is the longest). */
export const BLOW_QUAD_HALF = Math.max(BLOW.lunge.len, BLOW.sweep.r, BLOW.slam.ahead + BLOW.slam.r) + 0.3;
export const BLOW_LIFT = 0.06;
const OUTLINE = 0.12;   // metres of rim

/**
 * The shader's own reading in JS: at (across, along) in the blow's frame, the shape's field - `inside` (the point is
 * in the shape, inBlow's law), `edge` (0..1 how far out toward the rim: the fill's reach), and `rim` (within the
 * outline of the rim).
 */
export function blowField(kind, across, along) {
  if (kind === 'lunge') {
    const P = BLOW.lunge;
    const inside = along >= -0.3 && along <= P.len && Math.abs(across) <= P.halfW;
    const edge = Math.max(0, (along + 0.3) / (P.len + 0.3));
    const rim = inside && (P.len - along < OUTLINE || along + 0.3 < OUTLINE || P.halfW - Math.abs(across) < OUTLINE);
    return { inside, edge, rim };
  }
  if (kind === 'sweep') {
    const P = BLOW.sweep, d = Math.hypot(across, along);
    const ang = d < 1e-9 ? 0 : Math.acos(Math.max(-1, Math.min(1, along / d)));
    const inside = d <= P.r && (d < 0.5 || ang <= P.halfArc);
    const rim = inside && (P.r - d < OUTLINE || (d >= 0.5 && (P.halfArc - ang) * d < OUTLINE));
    return { inside, edge: d / P.r, rim };
  }
  const P = BLOW.slam, d = Math.hypot(across, along - P.ahead);
  const inside = d <= P.r;
  return { inside, edge: d / P.r, rim: inside && P.r - d < OUTLINE };
}

const VS = `#version 300 es
layout(location = 0) in vec2 aCorner;
uniform mat4 uVP;
uniform vec3 uOrigin;
uniform float uYaw;
uniform float uHalf;
uniform float uLift;
uniform vec2 uSlope;   // AUDIT TACT D8: the ground's rise per metre (across, along) - the quad lies on the slope it marks
out vec2 vLocal;   // (across, along) in the blow's frame
out vec3 vWorld;   // AUDIT TACT D9: where the fog measures from
void main() {
  vec2 f = vec2(sin(uYaw), cos(uYaw));
  vec2 w = vec2(-f.y, f.x);   // across, as inBlow reads it: (-fz, fx)
  vLocal = aCorner * uHalf;
  vec2 xz = uOrigin.xz + w * vLocal.x + f * vLocal.y;
  vWorld = vec3(xz.x, uOrigin.y + uLift + dot(uSlope, vLocal), xz.y);
  gl_Position = uVP * vec4(vWorld, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vLocal;
uniform int uKind;
uniform float uT;
uniform float uFlash;
uniform vec3 uColor;
uniform vec4 uP;   // lunge: len, halfW / sweep: r, halfArc / slam: r, ahead
in vec3 vWorld;
uniform int uFogMode;
uniform float uFogDensity;
uniform vec2 uFogRange;
uniform vec3 uCamPos;
out vec4 oColor;
${FOG_FACTOR_GLSL}
const float OUTLINE = ${OUTLINE.toFixed(3)};
void main() {
  float across = vLocal.x, along = vLocal.y;
  bool inside = false, rim = false;
  float edge = 0.0;
  if (uKind == 0) {
    inside = along >= -0.3 && along <= uP.x && abs(across) <= uP.y;
    edge = max(0.0, (along + 0.3) / (uP.x + 0.3));
    rim = inside && (uP.x - along < OUTLINE || along + 0.3 < OUTLINE || uP.y - abs(across) < OUTLINE);
  } else if (uKind == 1) {
    float d = length(vec2(across, along));
    float ang = d < 1e-9 ? 0.0 : acos(clamp(along / d, -1.0, 1.0));
    inside = d <= uP.x && (d < 0.5 || ang <= uP.y);
    edge = d / uP.x;
    rim = inside && (uP.x - d < OUTLINE || (d >= 0.5 && (uP.y - ang) * d < OUTLINE));
  } else {
    float d = length(vec2(across, along - uP.y));
    inside = d <= uP.x;
    edge = d / uP.x;
    rim = inside && uP.x - d < OUTLINE;
  }
  if (!inside) discard;
  float a = rim ? 0.55 : 0.08;
  if (edge <= uT) a = max(a, 0.32);
  a = max(a, uFlash * 0.9);
  a *= fogFactorAt(vWorld);   // AUDIT TACT D9: fogged as the ground it lies on - never a glow through the murk
  oColor = vec4(uColor * a, a);
}`;

const QUAD = new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]);
const NO_FOG_RANGE = new Float32Array([0, 1]);
const NO_FOG_RANGE3 = new Float32Array([0, 0, 0]);
const NO_FOCUS = new Float32Array([0, 0, 0, 0]);

export class FoeTelegraphPass {
  constructor(gl) {
    this.gl = gl;
    this.program = buildProgram(gl, VS, FS, 'foeTelegraph');
    this.u = {};
    for (const n of ['uVP', 'uOrigin', 'uYaw', 'uHalf', 'uLift', 'uKind', 'uT', 'uFlash', 'uColor', 'uP', 'uSlope', 'uFogMode', 'uFogDensity', 'uFogRange', 'uCamPos', 'uFocus']) this.u[n] = gl.getUniformLocation(this.program, n);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.bindVertexArray(null);
    this._vp = new Float32Array(16);
    /** how many shapes the last draw put down (stats, tests) */
    this.drawn = 0;
  }

  /** Draw each { blow, phase } (ai/foeBlows.js drawableBlows) under the camera `proj` x `view`, in the frame's `fog`
   *  ({ mode, density, range, camPos }; none draws unfogged). */
  draw(list, proj, view, fog = null) {
    this.drawn = 0;
    if (!list?.length || !proj || !view) return 0;
    const gl = this.gl, U = this.u;
    mul(this._vp, proj, view);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(U.uVP, false, this._vp);
    gl.uniform1f(U.uHalf, BLOW_QUAD_HALF);
    gl.uniform1f(U.uLift, BLOW_LIFT);
    gl.uniform1i(U.uFogMode, fog ? fog.mode : 0);
    gl.uniform1f(U.uFogDensity, fog?.density ?? 0);
    gl.uniform2fv(U.uFogRange, fog?.range ?? NO_FOG_RANGE);
    gl.uniform3fv(U.uCamPos, fog?.camPos ?? NO_FOG_RANGE3);
    if (U.uFocus) gl.uniform4fv(U.uFocus, fog?.focus ?? NO_FOCUS);   // AUDIT DEEP R-1's law: under the travel view the fog is the traveller's
    gl.bindVertexArray(this.vao);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
    for (const { blow: b, phase } of list) {
      gl.uniform3f(U.uOrigin, b.origin[0], b.origin[1], b.origin[2]);
      gl.uniform1f(U.uYaw, b.yaw);
      gl.uniform2f(U.uSlope, b.slope?.[0] ?? 0, b.slope?.[1] ?? 0);
      gl.uniform1i(U.uKind, BLOW_KIND[b.kind] ?? 0);
      const P = BLOW[b.kind];
      if (b.kind === 'lunge') gl.uniform4f(U.uP, P.len, P.halfW, 0, 0);
      else if (b.kind === 'sweep') gl.uniform4f(U.uP, P.r, P.halfArc, 0, 0);
      else gl.uniform4f(U.uP, P.r, P.ahead, 0, 0);
      gl.uniform1f(U.uT, phase.t);
      gl.uniform1f(U.uFlash, phase.flash);
      const c = b.color ?? [1, 0.42, 0.12];
      gl.uniform3f(U.uColor, c[0], c[1], c[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.drawn++;
    }
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(0, 0);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    return this.drawn;
  }
}

function mul(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}
