// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV1 - THE TRAVEL VIEW'S CAMERA, AS LAW (bible/06-Systems/Travel-View.md).
//
// Mac (2026-09-27): "a sort of zoom out to an overworld style that
// utilizes travel options. Not a large scale zoomout, but something that
// fits ... Every detail like weather patterns, should be 1:1 in this
// mode." His call on the height: BELOW THE CLOUDS.
//
// THIS IS A RENDER EYE, NOT A PLAYER. `cam.pos` stays on the traveller's
// head, because the streaming grid, its vertical re-centre, the weather
// sample, the rain box, the grass and the wind all follow `cam.pos` - a
// camera that moved it would drag the whole world behind it (the dev
// fly-cam does exactly that). This file answers only where the picture
// is taken FROM and which way it looks, over a focus the host hands it
// (the traveller's feet), and it is pure: no GL, no DOM, no host - so
// every number a player sees from up here is a number a pin can hold.
//
// THE FRAME OF REFERENCE is the port's own (world/mat4.js's law): yaw 0
// looks down +z and turns clockwise seen from above, so the forward of a
// yaw is (sin, ., cos) and the screen's right is (cos, 0, -sin); pitch
// is positive UP. The travel camera's `tilt` is the angle BELOW the
// horizon it looks down at, so its pitch is -tilt.
// ═══════════════════════════════════════════════════════════════════

/** The band, in metres above the traveller's feet. 150-450 is Mac's "below the clouds"; the default sits where a
 *  town fills a third of the screen and the road ahead runs to the top. */
export const TV_HEIGHT_MIN = 150;
export const TV_HEIGHT_MAX = 450;
export const TV_HEIGHT_DEFAULT = 260;
/** The tilt band (radians below the horizon). Past 75 degrees the view is a plan and every standing flat is a
 *  sliver; under 30 the horizon takes the top of the screen and the grid's edge shows. */
export const TV_TILT_MIN = (30 * Math.PI) / 180;
export const TV_TILT_MAX = (75 * Math.PI) / 180;
export const TV_TILT_DEFAULT = (52 * Math.PI) / 180;
/** Under a cloud deck the camera stays this far below its base - the clouds are ALWAYS overhead, so the sky dome,
 *  the cloud march and the fog all stay the ground's own (Mac's call 1). */
export const TV_CLOUD_MARGIN = 60;
/** ...but never under this: fog (base 150) and a sandstorm (a wall on the ground, base 0) would otherwise put the
 *  camera in the traveller's hair. Inside a lid weather the view is what the weather is - close. */
export const TV_HEIGHT_FLOOR = 40;
/** The eye keeps this clear of the ground under it and of a ridge between it and the traveller. */
export const TV_GROUND_CLEAR = 25;
/** The rise out of the head and the fall back into it, seconds. */
export const TV_RISE_S = 1.2;
export const TV_FALL_S = 0.8;
/** A wheel notch scales the height by this (out) or its inverse (in). */
export const TV_ZOOM_STEP = 1.18;
/** Orbit and tilt per dragged pixel, radians. */
export const TV_ORBIT_PER_PX = 0.005;
export const TV_TILT_PER_PX = 0.004;
/** Exponential easing rates, 1/s: the height toward its target, the focus toward the feet. */
export const TV_HEIGHT_RATE = 6;
export const TV_FOCUS_RATE = 10;
/** A focus this far from the feet in one frame is a jump (a teleport, a load) - taken whole, never eased across. */
export const TV_FOCUS_SNAP = 60;
/** The standing flats lean back toward a raised eye by this share of its tilt (0 upright, 1 facing it whole): a
 *  tree seen from 52 degrees up keeps its silhouette instead of foreshortening to a stub, and still stands on its
 *  own foot. The pass that draws them is the only reader; their shadows stay upright. */
export const TV_BILLBOARD_LEAN = 0.5;
/** The traveller turns toward the camera's heading at most this fast while a movement key is held (rad/s). */
export const TV_TURN_RATE = 6;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
/** The shortest signed turn from `a` to `b`, in (-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  else if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}
/** Exponential easing's share for one step of `dt` at `rate`. */
export const easeShare = (dt, rate) => 1 - Math.exp(-Math.max(0, dt) * rate);
/** Smoothstep on [0,1] - the rise and the fall. */
export const smooth01 = (t) => { const x = clamp(t, 0, 1); return x * x * (3 - 2 * x); };

/**
 * The ceiling over the traveller: the cloud deck's base less the margin, clamped into the band's reach. `cloudBase`
 * is the weather's own (render/volumetricClouds.js VC_PROFILE[word].base); null or non-finite reads as no deck.
 */
export function ceilingFor(cloudBase) {
  if (cloudBase == null || !Number.isFinite(cloudBase)) return TV_HEIGHT_MAX;
  return clamp(cloudBase - TV_CLOUD_MARGIN, TV_HEIGHT_FLOOR, TV_HEIGHT_MAX);
}

/** The band a height may take under a ceiling: [min(MIN, ceiling), ceiling]. */
export function heightBand(ceiling) {
  const hi = clamp(ceiling, TV_HEIGHT_FLOOR, TV_HEIGHT_MAX);
  return [Math.min(TV_HEIGHT_MIN, hi), hi];
}

/** A look direction for a yaw and a pitch (pitch positive up). */
export function forwardOf(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
}
/** The screen's right for a yaw (mat4's mirrored law). */
export const rightOf = (yaw) => [Math.cos(yaw), 0, -Math.sin(yaw)];

/**
 * THE EYE. The camera stands `height` over the focus and back from it along its own heading, so that looking
 * down at `tilt` its line of sight passes through the focus: back by height / tan(tilt).
 * @param {number[]} focus - [x, y, z], the traveller's feet (eased)
 * @returns {{ eye: number[], fwd: number[], back: number }}
 */
export function eyeFor(focus, yaw, tilt, height) {
  const back = height / Math.tan(tilt);
  return {
    eye: [focus[0] - Math.sin(yaw) * back, focus[1] + height, focus[2] - Math.cos(yaw) * back],
    fwd: forwardOf(yaw, -tilt),
    back,
  };
}

/**
 * THE GROUND UNDER THE EYE. `heightAt(x, z)` is the host's terrain (-Infinity where no pixel is built yet - an
 * unbuilt pixel is no obstacle, it has no ground to hit). The eye and the midpoint of the line down to the focus
 * each keep TV_GROUND_CLEAR over theirs; the height grows until both do (a ridge between the camera and the
 * traveller would otherwise hide the traveller behind it). Two passes, because a taller eye stands further back
 * and over other ground.
 * @returns {number} the height the eye must take - never less than the one asked for
 */
export function clearHeight(focus, yaw, tilt, height, heightAt) {
  if (typeof heightAt !== 'function') return height;
  let h = height;
  for (let pass = 0; pass < 2; pass++) {
    const { eye } = eyeFor(focus, yaw, tilt, h);
    const need = (x, z, y, share) => {
      const g = heightAt(x, z);
      if (!Number.isFinite(g)) return 0;
      // a point `share` of the way from focus to eye stands at focus.y + share * h; lifting h lifts it by share
      return share > 0 ? (g + TV_GROUND_CLEAR - y) / share : 0;
    };
    const mid = [(eye[0] + focus[0]) / 2, (eye[1] + focus[1]) / 2, (eye[2] + focus[2]) / 2];
    const lift = Math.max(0, need(eye[0], eye[2], eye[1], 1), need(mid[0], mid[2], mid[1], 0.5));
    if (!(lift > 0)) break;
    h += lift;
  }
  return h;
}

/**
 * The billboards' UP while the raised eye draws them: the vertical leaned back along the camera's heading by
 * TV_BILLBOARD_LEAN of its tilt - so a flat turns its face up toward the camera and stays standing on its foot.
 */
export function leanedUp(yaw, tilt, lean = TV_BILLBOARD_LEAN) {
  const a = clamp(tilt, 0, Math.PI / 2) * lean;
  const s = Math.sin(a);
  return [Math.sin(yaw) * s, Math.cos(a), Math.cos(yaw) * s];
}

/**
 * The traveller's own heading while a movement key is held in the view: the keys are CAMERA-RELATIVE (forward walks
 * up the screen), so the body turns toward the camera's heading, at most TV_TURN_RATE a second.
 */
export function turnToward(yaw, target, dt) {
  const d = angleDelta(yaw, target);
  const step = TV_TURN_RATE * Math.max(0, dt);
  return Math.abs(d) <= step ? target : yaw + Math.sign(d) * step;
}

/** A fresh camera over a traveller facing `yaw`: behind them, at the default height and tilt. */
export function initialCamera(focus, yaw) {
  return {
    focus: [focus[0], focus[1], focus[2]],
    yaw,
    tilt: TV_TILT_DEFAULT,
    height: TV_HEIGHT_DEFAULT,
    heightTarget: TV_HEIGHT_DEFAULT,
  };
}

/** A wheel's notches (positive = in, the wheel rolled UP) into the height target, inside the band. */
export function zoomTarget(target, notches, ceiling) {
  const [lo, hi] = heightBand(ceiling);
  return clamp(target * Math.pow(TV_ZOOM_STEP, -notches), lo, hi);
}

/** Turn the camera by radians: the heading by `dYaw`, the tilt by `dTilt` (positive steeper), the tilt clamped. */
export function turnCamera(c, dYaw, dTilt) {
  return { ...c, yaw: c.yaw + dYaw, tilt: clamp(c.tilt + dTilt, TV_TILT_MIN, TV_TILT_MAX) };
}

/** A drag of (dx, dy) pixels: the orbit turns with dx, the tilt steepens as the pointer goes down. */
export const orbitBy = (c, dx, dy) => turnCamera(c, dx * TV_ORBIT_PER_PX, dy * TV_TILT_PER_PX);

/**
 * ONE FRAME of the camera: the focus eased onto the feet (a jump taken whole), the target clamped under the
 * ceiling, the height eased toward it and lifted clear of the ground. Returns the new state and the frame's eye.
 * @param {{focus:number[], yaw:number, tilt:number, height:number, heightTarget:number}} c
 * @param {{ feet:number[], dt:number, ceiling:number, heightAt?:(x:number,z:number)=>number }} env
 */
export function stepCamera(c, { feet, dt, ceiling, heightAt = null }) {
  const dx = feet[0] - c.focus[0], dy = feet[1] - c.focus[1], dz = feet[2] - c.focus[2];
  const jump = Math.hypot(dx, dy, dz) > TV_FOCUS_SNAP;
  const k = jump ? 1 : easeShare(dt, TV_FOCUS_RATE);
  const focus = [c.focus[0] + dx * k, c.focus[1] + dy * k, c.focus[2] + dz * k];
  const [lo, hi] = heightBand(ceiling);
  const heightTarget = clamp(c.heightTarget, lo, hi);
  let height = jump ? heightTarget : c.height + (heightTarget - c.height) * easeShare(dt, TV_HEIGHT_RATE);
  height = clamp(height, lo, hi);
  const shown = clearHeight(focus, c.yaw, c.tilt, height, heightAt);
  const next = { focus, yaw: c.yaw, tilt: c.tilt, height, heightTarget };
  const { eye, fwd } = eyeFor(focus, c.yaw, c.tilt, shown);
  return { camera: next, eye, fwd, shownHeight: shown };
}

/**
 * THE RISE AND THE FALL: the frame's eye and look between the head's (`from`) and the travel camera's (`to`) at
 * blend `t` (0 the head, 1 the sky), smoothstepped. The look is the normalised lerp - both ends are unit vectors
 * and never opposite (the head looks ahead, the sky looks down and ahead), so it never passes through zero.
 */
export function blendView(from, to, t) {
  const s = smooth01(t);
  const eye = [0, 1, 2].map((i) => from.eye[i] + (to.eye[i] - from.eye[i]) * s);
  const f = [0, 1, 2].map((i) => from.fwd[i] + (to.fwd[i] - from.fwd[i]) * s);
  const n = Math.hypot(f[0], f[1], f[2]) || 1;
  return { eye, fwd: [f[0] / n, f[1] / n, f[2] / n] };
}

/** The yaw and pitch of a look direction - the sky dome and the audio listener take angles, not a vector. */
export function anglesOf(fwd) {
  return { yaw: Math.atan2(fwd[0], fwd[2]), pitch: Math.asin(clamp(fwd[1], -1, 1)) };
}
