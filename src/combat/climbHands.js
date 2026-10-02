// @ts-check
// CLIMB-HANDS (2026-10-02, Mac: "Here are two textures for the first person view (not morrowind)" - the raised fist
// "needs to be mirrored, thumbs inside so we can utilize 2 arms ... for hanging on a ledge, climbing, etc"; the reaching
// arm "for when you're climbing and look around for a place to jump to" - "whenever you look away from the wall your
// climbing or ledge you are hanging from", "mirrored", and "Definitely animate the arms for when you are climbing, or
// shifting left to right climbing/on a ledge"). THE CLASSIC LANE'S HANDS ON THE WALL. Design: bible/03-World/Parkour-Arc.md
// (CLIMB-HANDS).
//
// CLIMB4 lowered the classic sprite out of the screen for the climb (WeaponManager's climbing return) and left the screen
// empty; CLIMB6 gave the Morrowind arms a pose on the stone. This is the sprite lane's: Mac's two paintings,
// public/art/climb-grip.png (a fist, the back of the hand to the eye, its thumb on the painting's right - a left hand: drawn
// as it is on the left and mirrored on the right, so both thumbs are inside) and public/art/climb-reach.png (a right arm reaching out to the right - mirrored when the
// look is to the left).
//
// THE LAW (`ClimbHands`, pure: no renderer, no clock but the `dt` it is handed) reads the climb's snapshot
// (player/climbPose.js climbRigInput) and the view, and answers each sprite's rect on DFU's 320x200 design surface:
//   - THE HOLD: both fists up, the arms running off the bottom of the screen; a hang sways a little on the arms.
//   - THE SHIMMY: the hand the body goes toward lifts and reaches that way, then the other closes up after it - a grip
//     every PARKOUR_HAND_SPAN along the lip, the parkour law's own span (the ear's and the camera's).
//   - THE FREE CLIMB: hand over hand, a reach every FEEL.REACH climbed (up, down or across), the hands taking turns.
//   - THE MOVES: a catch, a reach and a leap's end slam the hands up onto the hold; a mantle and a vault press down and
//     let go as the body crests; a lower brings them up over the edge; a corner carries them round with the wall; a wall
//     run reaches high.
//   - THE GRIP FAILING: the hands tremble, harder the lower the grip.
//   - LOOKING AWAY: turned off the wall's face, both fists drop out of the view and the reaching arm alone comes up from
//     the other side of the screen, open toward the way the eye looks (Mac, 2026-10-02: "For look right/left dont use the hand
//     aiming straight up. Only use the angled arm").
// Every sprite's arm runs off the bottom edge with BOTTOM_SLACK to spare, so no lift shows its cut sleeve.
//
// The enhanced climb only (the motor's hold, a move in flight): DFU's own climb keeps WeaponManager's empty screen.

import { FEEL } from '../player/climbFeel.js';
import { PARKOUR_GRIP_LOW, PARKOUR_HAND_SPAN } from '../player/parkour.js';
import { decodePng } from '../systems/textureReplacement.js';
import { toScreenOrder } from '../formats/color32Order.js';
import { APP_ROOT } from '../systems/appRoot.js';

/** DFU's design surface (FPSWeapon's 320x200). */
export const NATIVE_W = 320;
export const NATIVE_H = 200;
const DEG = Math.PI / 180;

/** The two paintings, their own pixels (the drawn boxes keep these aspects). */
export const GRIP_ART = Object.freeze({ file: 'art/climb-grip.png', w: 105, h: 152 });
export const REACH_ART = Object.freeze({ file: 'art/climb-reach.png', w: 183, h: 114 });

/** The layout and the motion, in design pixels, seconds and degrees. */
export const HANDS = Object.freeze({
  GRIP_H: 150,             // a fist's drawn height
  GRIP_APART: 52,          // each fist's centre from the screen's middle
  BOTTOM_SLACK: 34,        // the sleeve under the screen's bottom edge at rest: no lift may exceed it
  REACH_W: 190,            // the reaching arm's drawn width, anchored at its own side of the screen (Mac: "it needs to sit on the
                           // left/right side of the screen respectively"; then "they need to be the originasl size" - 150 shrank it)
  REACH_X_IN: 4,           // the reaching arm's box in from its edge
  REACH_SLACK: 16,         // the reaching arm's sleeve under the bottom edge
  // coming onto the wall and off it (the classic sprite's CLIMB_LOWER_TAU, the other way round)
  ON_TAU: 0.07,
  OFF_TAU: 0.12,
  // hanging
  SWAY_Y: 2.2,
  SWAY_X: 1.2,
  // the shimmy: a hand's lift and its reach along the lip
  SHIMMY_LIFT: 16,
  SHIMMY_REACH: 22,
  // the free climb: a hand's lift, and its lean the way the climb goes across
  CLIMB_LIFT: 30,
  CLIMB_ACROSS: 14,
  // the moves
  CATCH_IN: 0.4,           // the share of a catch over which the hands come up onto the hold
  CATCH_DIP: 9,            // the weight landing on the arms
  PRESS_DOWN: 150,         // a mantle's hands pressed down off the screen as the body crests
  PRESS_APART: 30,
  CORNER_SHIFT: 46,
  WALLRUN_LIFT: 34,
  // the grip failing
  TREMBLE: 2.4,
  TREMBLE_HZ: 11,
  // looking away from the wall
  LOOK_FROM_DEG: 40,       // turned this far off the wall's face, the reach begins...
  LOOK_FULL_DEG: 75,       // ...and is whole here
  SEARCH_X: 5,             // the reaching arm feeling for a hold
  SEARCH_Y: 4,
  SEARCH_HZ: 0.6,
  // looking straight down off the wall
  DOWN_FROM_DEG: 50,
  DOWN_FULL_DEG: 80,
});

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const s = clamp01(x); return s * s * (3 - 2 * s); };
const bump = (x) => Math.sin(Math.PI * clamp01(x));
/** An angle into (-PI, PI]. */
export const wrapAngle = (a) => { const t = (a + Math.PI) % (2 * Math.PI); return (t < 0 ? t + 2 * Math.PI : t) - Math.PI; };

/** The heading that faces into a wall whose face points out along `normal` (the view's yaw convention: forward is
 *  [sin yaw, 0, cos yaw]). */
export const wallYawOf = (normal) => Math.atan2(-normal[0], -normal[2]);

/** Which climbs the sprite lane draws hands for: the motor's hold (a hang or the free climb) or a move in flight. DFU's
 *  own climb (`classic`) and a leap's free flight draw none. */
export function climbHandsWanted(c) {
  if (!c || c.classic) return false;
  return !!c.move || c.mode === 'hang' || c.mode === 'climb';
}

/** How far the view is turned off the wall's face (radians, + to the right), or 0 with no wall. */
export function lookOffWall(c, viewYaw) {
  if (!c?.normal || !Number.isFinite(viewYaw)) return 0;
  return wrapAngle(viewYaw - wallYawOf(c.normal));
}

/**
 * The law. `update(dt, climb, view)` with the frame's climb snapshot (or null) and the view ({ yaw, pitch }); `out`
 * then holds the frame's sprites: `grips` (each { side, x, y, w, h, flip }) and `reach` (the same, or null), in design
 * pixels, and `present` (0..1, the hands on the screen at all).
 */
export class ClimbHands {
  constructor() {
    this.present = 0;
    this.t = 0;
    this.prev = null;
    this.shimmyPhase = 0;
    this.shimmySide = 1;
    this.climbPhase = 0;
    this.climbSide = 0;
    this.climbUp = 1;
    this.look = 0;      // the eased reach, signed by side
    this.out = { present: 0, grips: [], reach: null };
  }

  update(dt, c, view = {}) {
    dt = Math.max(0, Math.min(0.1, Number.isFinite(dt) ? dt : 0));
    this.t += dt;
    const want = climbHandsWanted(c);
    const tau = want ? HANDS.ON_TAU : HANDS.OFF_TAU;
    this.present += ((want ? 1 : 0) - this.present) * (1 - Math.exp(-dt / tau));
    if (Math.abs(this.present - (want ? 1 : 0)) < 0.005) this.present = want ? 1 : 0;
    const out = this.out;
    out.present = this.present;
    out.grips = [];
    out.reach = null;
    if (!want) { this.prev = null; this.look = 0; if (this.present <= 0) return out; }

    // the frame's own travel on the wall (a teleport is none)
    let dx = 0, dy = 0, dz = 0;
    const p = c?.track ?? c?.feet ?? null;
    if (want && p) {
      if (this.prev) { dx = p[0] - this.prev[0]; dy = p[1] - this.prev[1]; dz = p[2] - this.prev[2]; }
      this.prev = [p[0], p[1], p[2]];
      if (Math.hypot(dx, dy, dz) > 1) dx = dy = dz = 0;
    }
    const n = c?.normal ?? null;
    const along = n ? dx * -n[2] + dz * n[0] : 0;   // + to the climber's right along the wall

    // each hand's offset from its rest: x (+ right), y (+ down), in design pixels
    const off = { L: { x: 0, y: 0 }, R: { x: 0, y: 0 } };
    const m = want ? c.move : null;
    if (m) this._move(m, off);
    else if (want && c.mode === 'hang') this._hang(dt, along, off);
    else if (want) this._climb(along, dy, dx, dz, off);

    // the grip failing
    const grip = Number.isFinite(c?.grip) ? c.grip : 1;
    if (want && grip < PARKOUR_GRIP_LOW) {
      const k = HANDS.TREMBLE * (1 - grip / PARKOUR_GRIP_LOW);
      const w = 2 * Math.PI * HANDS.TREMBLE_HZ * this.t;
      off.L.x += k * Math.sin(w); off.L.y += k * Math.sin(w * 1.31 + 1);
      off.R.x += k * Math.sin(w * 1.17 + 2); off.R.y += k * Math.sin(w * 0.93 + 3);
    }

    // looking away from the wall: eased, signed by side (a move in flight keeps the hold's)
    const turn = want ? lookOffWall(c, view.yaw) : 0;
    const lookT = want && !m ? Math.sign(turn) * smooth((Math.abs(turn) / DEG - HANDS.LOOK_FROM_DEG) / (HANDS.LOOK_FULL_DEG - HANDS.LOOK_FROM_DEG)) : 0;
    this.look += (lookT - this.look) * (1 - Math.exp(-dt / 0.09));
    if (Math.abs(this.look - lookT) < 0.002) this.look = lookT;
    const a = Math.abs(this.look), side = this.look >= 0 ? 'R' : 'L';

    // looking straight down off the wall: the hands are over the head, out of the view
    const pitch = Number.isFinite(view.pitch) ? view.pitch : 0;
    const down = smooth((-pitch / DEG - HANDS.DOWN_FROM_DEG) / (HANDS.DOWN_FULL_DEG - HANDS.DOWN_FROM_DEG));

    const gh = HANDS.GRIP_H, gw = gh * GRIP_ART.w / GRIP_ART.h;
    const enter = (1 - smooth(this.present)) * (gh + HANDS.BOTTOM_SLACK);
    const gone = Math.max(down, 0) * (gh + HANDS.BOTTOM_SLACK);
    for (const s of ['L', 'R']) {
      const lat = s === 'R' ? 1 : -1;
      let x = NATIVE_W / 2 + lat * HANDS.GRIP_APART - gw / 2 + off[s].x;
      let y = NATIVE_H - gh + HANDS.BOTTOM_SLACK + off[s].y + enter + gone;
      y += smooth(a) * (gh + HANDS.BOTTOM_SLACK);   // looked away: the fists drop out, the angled arm alone
      // never lifted past the sleeve's slack
      y = Math.max(y, NATIVE_H - gh);
      if (y >= NATIVE_H) continue;
      out.grips.push({ side: s, x, y, w: gw, h: gh, flip: s === 'R' });   // the painting is the left hand: the right is its mirror
    }
    if (a > 0.001) {
      const rw = HANDS.REACH_W, rh = rw * REACH_ART.h / REACH_ART.w;
      const w = 2 * Math.PI * HANDS.SEARCH_HZ * this.t;
      const sx = HANDS.SEARCH_X * Math.sin(w), sy = HANDS.SEARCH_Y * Math.sin(w * 1.6 + 0.7);
      // looked right, the arm sits in the LEFT half as painted, reaching across to the right; looked left, its mirror in
      // the right half (Mac, 2026-10-02: "look left and right are on the wrong side of the screen")
      const xl = HANDS.REACH_X_IN + sx;
      const x = side === 'R' ? xl : NATIVE_W - xl - rw;
      const y = Math.max(NATIVE_H - rh, NATIVE_H - rh + HANDS.REACH_SLACK + sy + (1 - smooth(a)) * (rh + HANDS.REACH_SLACK) + enter + gone);
      if (y < NATIVE_H) out.reach = { side, x, y, w: rw, h: rh, flip: side === 'L' };
    }
    return out;
  }

  /** The hang: a sway on the arms, or the shimmy's hand-over-hand along the lip. */
  _hang(dt, along, off) {
    if (Math.abs(along) > 1e-5) {
      this.shimmyPhase += Math.abs(along) / PARKOUR_HAND_SPAN;
      this.shimmySide = Math.sign(along);
    }
    const moving = Math.abs(along) > 1e-5;
    // stopped mid-reach, the hand finishes onto the nearer grip (a half cycle's end) and stays there
    if (!moving) {
      const to = Math.round(this.shimmyPhase * 2) / 2;
      this.shimmyPhase += (to - this.shimmyPhase) * (1 - Math.exp(-dt / 0.08));
      if (Math.abs(to - this.shimmyPhase) < 1e-3) this.shimmyPhase = to;
    }
    {
      // the leading hand on the cycle's first half, the trailing on its second - each lifts and reaches the way
      const u = this.shimmyPhase % 1;
      const lead = this.shimmySide > 0 ? 'R' : 'L', trail = lead === 'R' ? 'L' : 'R';
      const k1 = bump(u * 2), k2 = bump(u * 2 - 1);
      off[lead].x += this.shimmySide * HANDS.SHIMMY_REACH * k1; off[lead].y -= HANDS.SHIMMY_LIFT * k1;
      off[trail].x += this.shimmySide * HANDS.SHIMMY_REACH * k2; off[trail].y -= HANDS.SHIMMY_LIFT * k2;
    }
    const w = 2 * Math.PI * FEEL.SWAY_HZ * this.t;
    off.L.y += HANDS.SWAY_Y * Math.sin(w * 1.37); off.R.y += HANDS.SWAY_Y * Math.sin(w * 1.37 + Math.PI * 0.8);
    off.L.x += HANDS.SWAY_X * Math.sin(w); off.R.x += HANDS.SWAY_X * Math.sin(w);
  }

  /** The free climb: hand over hand, a reach every FEEL.REACH climbed, the hands taking turns. */
  _climb(along, dy, dx, dz, off) {
    const travel = Math.hypot(dx, dy, dz);
    if (travel > 1e-5) {
      this.climbPhase += travel / FEEL.REACH;
      if (Math.abs(dy) > 1e-6) this.climbUp = Math.sign(dy);
      this.climbSide = travel > 0 ? along / travel : 0;
    }
    const s = Math.sin(Math.PI * this.climbPhase);   // the right hand on +, the left on -
    const kR = Math.max(0, s), kL = Math.max(0, -s);
    // up: the reaching hand lifts; down: it lowers to the next hold
    off.R.y -= this.climbUp * HANDS.CLIMB_LIFT * kR; off.L.y -= this.climbUp * HANDS.CLIMB_LIFT * kL;
    off.R.x += this.climbSide * HANDS.CLIMB_ACROSS * kR; off.L.x += this.climbSide * HANDS.CLIMB_ACROSS * kL;
  }

  /** A move in flight, by its kind and its clock. */
  _move(m, off) {
    const t = clamp01(m.t ?? 0);
    const both = (x, y) => { off.L.x -= x; off.R.x += x; off.L.y += y; off.R.y += y; };
    switch (m.kind) {
      case 'catch': case 'reach': case 'leap': {
        // up onto the hold over the move's first part, then the weight lands on the arms
        const inT = m.kind === 'leap' ? 0.7 : HANDS.CATCH_IN;
        const rise = 1 - smooth(t / inT);
        both(0, rise * (HANDS.GRIP_H * 0.6) + HANDS.CATCH_DIP * bump((t - inT) / (1 - inT)));
        break;
      }
      case 'mantle': case 'vault': {
        const split = m.kind === 'vault' ? 0.15 : clamp01(m.split ?? 0.5);
        const over = t <= split ? 0 : (t - split) / Math.max(1e-6, 1 - split);
        both(HANDS.PRESS_APART * smooth(over), -HANDS.CATCH_DIP * bump(t / Math.max(0.05, split)) + HANDS.PRESS_DOWN * smooth((over - 0.2) / 0.8));
        break;
      }
      case 'lower':
        both(0, (1 - smooth((t - 0.45) / 0.55)) * HANDS.GRIP_H * 0.8);
        break;
      case 'corner': {
        const turn = Math.sign(m.turn || 0);
        off.L.x += turn * HANDS.CORNER_SHIFT * bump(t); off.R.x += turn * HANDS.CORNER_SHIFT * bump(t);
        break;
      }
      case 'wallrun':
        off.L.y -= HANDS.WALLRUN_LIFT * bump(t * 2); off.R.y -= HANDS.WALLRUN_LIFT * bump(t * 2 - 1);
        break;
      default: break;
    }
  }
}

/** The paintings' address beside the page (APP_ROOT: the site root, not /play/ - AUDIT-THUNDERLOCK F7). */
export const climbArtUrl = (file) => new URL(file, APP_ROOT ?? globalThis.document?.baseURI ?? 'https://invalid.invalid/').href;

/**
 * The draw: the law plus the two textures, loaded once on first need (a promise in flight draws nothing). `fetchBytes`
 * is the door a test comes through; by default the paintings are fetched from the build beside the page.
 */
export function createClimbHands({ renderer, fetchBytes = null, decode = decodePng } = {}) {
  const law = new ClimbHands();
  /** @type {Map<string, any>} */
  const tex = new Map();
  const load = (art) => {
    if (tex.has(art.file) || !renderer) return tex.get(art.file) ?? null;
    tex.set(art.file, null);
    (async () => {
      const bytes = fetchBytes ? await fetchBytes(art.file) : await (async () => {
        const r = await fetch(climbArtUrl(art.file));
        if (!r.ok) throw new Error(`${art.file}: ${r.status}`);
        return new Uint8Array(await r.arrayBuffer());
      })();
      const img = await decode(bytes);
      if (img?.width) tex.set(art.file, renderer.uploadTexture('img', `climbhands:${art.file}`, toScreenOrder(img)));   // a PNG's rows are top-first: a screen quad wants them so (HT3)
    })().catch((e) => console.warn('[climb hands] texture load failed', art.file, e));
    return null;
  };
  return {
    law,
    update(dt, climb, view) { return law.update(dt, climb, view); },
    /** Whether the hands are on the screen this frame (the weapon's lowered sprite yields to them). */
    showing() { return law.out.present > 0 && (law.out.grips.length > 0 || !!law.out.reach); },
    draw(canvas, { tint = null } = {}) {
      const out = law.out;
      if (!canvas || !renderer || out.present <= 0) return false;
      const sx = canvas.width / NATIVE_W, sy = canvas.height / NATIVE_H;
      const quad = (t, b) => renderer.drawScreenQuad(t, { x: b.x * sx, y: b.y * sy, w: b.w * sx, h: b.h * sy },
        b.flip ? { u0: 1, v0: 0, u1: 0, v1: 1 } : undefined, tint ?? undefined);
      let drew = false;
      if (out.reach) { const t = load(REACH_ART); if (t) { quad(t, out.reach); drew = true; } }
      if (out.grips.length) { const t = load(GRIP_ART); if (t) { for (const g of out.grips) quad(t, g); drew = true; } }
      return drew;
    },
  };
}
