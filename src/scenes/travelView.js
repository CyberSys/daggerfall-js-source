// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV1 - THE TRAVEL VIEW, THE HOST'S HALF (bible/06-Systems/Travel-View.md).
//
// Mac (2026-09-27): "When opening the map, there should be a toggle to go
// to the overworld style map." The held map's foot row carries the door
// (ui/heldMap.js, "Overworld"); the Controls page carries an unbound
// action for a player who wants a key from play (TravelView).
//
// ONE HOST. The view is the streaming exterior's alone (scenes/world.js):
// THE FOUR HOSTS RULE names all four - world.js WIRED; exterior.js, the
// dev scene's fixed city, NOT WIRED on purpose (no streaming grid under a
// camera 450 m up, and no Travel Options journey to watch); worldModes.js
// (interiors) and dungeonContext.js have no sky - a door closes the view
// before either host draws a frame (`allowed()` reads the host's mode).
//
// WHAT THIS FILE OWNS: the view's four states, the input it captures
// while up, the camera it hands the frame, and every way out. What it
// does NOT own: the camera's numbers (player/travelCamera.js, pure), the
// readout (ui/travelViewHud.js), the body (player/mwView.js holds it in
// third person), the cursor (player/pointerLock.js) - each reached
// through the deps the host hands in, so the pins drive this whole
// machine against a fake host.
//
// THE STATES: off -> rising (TV_RISE_S, from the head's own eye) -> up
// -> falling (TV_FALL_S, back to the head, which keeps moving under it)
// -> off. A window opening, the host leaving the open air, the traveller
// dying: the view CUTS to off at once - a window is drawn over the
// head's frame, and a fall behind it would only be a fall nobody sees.
//
// THE INPUT, WHILE UP, IS THE VIEW'S (the wizard's law, U50: "A MODAL
// OVERLAY OWNS ITS INPUT"): a canvas press, drag, wheel and context menu
// are taken in the CAPTURE phase on the window and stopped, so the
// host's own ladders - the swing on the right button, Mouse0's
// activation, the relock on a press, the Morrowind zoom on the wheel -
// never see them. The DOM around the canvas (the readout's button, the
// travel panel, the chat) keeps its own clicks. The keyboard is the
// host's, bar five things: the pause action (out), and the look keys TurnLeft /
// TurnRight / LookUp / LookDown, which turn and tilt the view instead of
// the traveller. Movement is CAMERA-RELATIVE: while a movement key is
// held and no journey drives, the traveller turns toward the view's
// heading, so W walks up the screen.
//
// THE HEARTBEAT (the world plaque's own law, AUDIT-WH2 L3-F2: a DOM
// overlay stays painted, and a capture listener stays on the window,
// unless something tells it otherwise). Every frame the host draws re-arms
// it; when the frames stop coming for TV_HEARTBEAT_MS the view comes down
// on its own. A loop another boot or an unwind killed (`alive()` false) is
// taken down QUIETLY - the listeners and the readout, never the cursor,
// which is the successor's; a loop that threw, or a video that holds the
// frame, drops the view the ordinary way and hands the input back; a
// hidden tab (the browser stops the frames, nothing broke) keeps it. So
// the host's one unwind line (P0's `frameAlive` guard) stays the plaque's.
// ═══════════════════════════════════════════════════════════════════
import {
  TV_RISE_S, TV_FALL_S, TV_ZOOM_STEP, ceilingFor, initialCamera, stepCamera, zoomTarget, orbitBy, turnCamera, blendView,
  anglesOf, rightOf, leanedUp, turnHeading, forwardOf,
} from '../player/travelCamera.js';

/** A press that moves further than this (px) before it lifts is a drag (the orbit), not a click (a pick). */
export const TV_CLICK_SLOP = 6;
/** Keyboard orbit, radians per second; keyboard tilt, radians per second. */
export const TV_KEY_ORBIT_RATE = 1.6;
export const TV_KEY_TILT_RATE = 0.9;
/** The look keys the view takes for itself while up. */
export const TV_LOOK_ACTIONS = Object.freeze(['TurnLeft', 'TurnRight', 'LookUp', 'LookDown']);
/** How long the view waits for a frame before it takes itself down (ms) - a stalled or killed loop. */
export const TV_HEARTBEAT_MS = 600;
/** The movement actions whose press turns the traveller toward the view's heading. */
export const TV_MOVE_ACTIONS = Object.freeze(['MoveForwards', 'MoveBackwards', 'MoveLeft', 'MoveRight']);

/** The view's own lines - the refusals the door says, and the readout's place line. */
export const TRAVEL_VIEW_TEXT = Object.freeze({
  enhancedOnly: 'The overworld is part of the enhanced interface.',
  indoors: 'You can only survey the land from the open air.',
  underwater: 'You cannot survey the land from under the water.',
  enemies: 'You cannot survey the land with enemies nearby.',
  // TV2: what a click says when it cannot be a journey, and the trip's own words
  noJourneys: 'Turn on Travel Options to travel from the overworld.',
  water: 'You cannot walk out onto the water.',
  far: 'That lies beyond what you can see from here.',
  noWay: 'There is no way there by land.',
  spot: 'The marked spot',
  byRoad: (name) => `To ${name}, by the road`,
  acrossCountry: (name) => `To ${name}, across country`,
  toSpot: 'To the marked spot',
  held: (n, of) => `Held to ×${n} of ×${of} while the land loads`,
  inPlace: (place, region) => (region ? `${place}, ${region}` : place),
  nearPlace: (place, region) => (region ? `Near ${place}, ${region}` : `Near ${place}`),
  wilderness: (region) => (region ? `The wilds of ${region}` : 'The wilds'),
});

/** TV2: the trip's line - a place by the roads when half its way or more is road or track, across country otherwise;
 *  a spot is a spot. */
export function travelTripLine({ name = '', share = 0, spot = false } = {}) {
  if (spot) return TRAVEL_VIEW_TEXT.toSpot;
  return share >= 0.5 ? TRAVEL_VIEW_TEXT.byRoad(name) : TRAVEL_VIEW_TEXT.acrossCountry(name);
}

/** The readout's place line: inside a location's rect its name; on its pixel outside the rect "Near" it; else the
 *  region's wilds. */
export function travelViewLine({ place = null, near = null, region = '' } = {}) {
  if (place) return TRAVEL_VIEW_TEXT.inPlace(place, region);
  if (near) return TRAVEL_VIEW_TEXT.nearPlace(near, region);
  return TRAVEL_VIEW_TEXT.wilderness(region);
}

/**
 * @param {object} deps
 * @param {any} deps.canvas - the world canvas (the only target whose presses the view takes)
 * @param {() => number[]} deps.feet - the traveller's feet, the scene's frame
 * @param {() => {eye:number[], fwd:number[]}} deps.headView - the eye and look the frame draws without the view
 * @param {() => number} deps.yaw - the traveller's heading
 * @param {(y:number) => void} deps.setYaw
 * @param {(x:number, z:number) => number} [deps.heightAt] - the terrain; -Infinity where unbuilt
 * @param {() => number|null} [deps.cloudBase] - the deck's base over the traveller, metres (null: no deck)
 * @param {() => {ok:boolean, why?:string}} deps.allowed - the open air, a live traveller, the enhanced lane
 * @param {() => boolean} deps.windowUp - a window stands (the host's pause)
 * @param {() => boolean} [deps.danger] - enemies near (DFU's AreEnemiesNearby): the view will not rise, and falls
 * @param {(e:any) => string[]} deps.actionsOf - a key event's registry actions (KB1)
 * @param {() => boolean} [deps.movementHeld] - a movement action is held (the host's own Set)
 * @param {() => boolean} [deps.autopilot] - a Travel Options journey drives the traveller
 * @param {(on:boolean) => boolean} [deps.holdBody] - player/mwView.js mwViewHoldThird
 * @param {(free:boolean) => void} [deps.freeCursor] - the cursor out (up) and the look back (off)
 * @param {() => string} [deps.where] - the readout's line: the place and the region
 * @param {(p:number[]) => {x:number,y:number,front:boolean}} [deps.project] - a world point to the screen, this frame
 * @param {(x:number, y:number, e:any) => void} [deps.onPick] - TV2: a click on the ground (viewport pixels)
 * @param {(key:string) => void} [deps.onMark] - TV2: a click on a mark that takes one (a place's plate)
 * @param {() => Array<{key:string, at:number[], label?:string, kind?:string, pick?:boolean, edge?:boolean}>} [deps.marks] - TV2/TV3: the
 *   keyed marks the readout draws, at WORLD points (projected here, through the frame's own matrices)
 * @param {() => number[][]} [deps.route] - TV2: the journey's way, world points from the feet on
 * @param {() => string} [deps.trip] - TV2: the journey in words
 * @param {{show:Function, hide:Function, update:Function}} [deps.hud] - ui/travelViewHud.js
 * @param {(t:string) => void} [deps.say]
 * @param {boolean} [deps.touch]
 * @param {any} [deps.win] - the event target listeners go on (the window)
 * @param {() => boolean} [deps.alive] - the host's loop still owns the frame (P0's frameAlive)
 * @param {(fn:Function, ms:number) => any} [deps.schedule] - the heartbeat's timer (setTimeout)
 * @param {(h:any) => void} [deps.cancel] - and its cancel (clearTimeout)
 */
export function createTravelView(deps) {
  const win = deps.win ?? globalThis;
  let state = 'off';           // 'off' | 'rising' | 'up' | 'falling'
  let t = 0;                   // the blend: 0 the head, 1 the sky
  let camera = null;           // player/travelCamera.js's state
  let shown = null;            // the frame's { eye, fwd } once blended
  let heldBody = false;
  let listening = false;
  let press = null;            // { id, x, y, moved, button }
  const pointers = new Map();  // pointerId -> {x, y} (pinch)
  let pinch = null;            // { d } the last two-finger distance
  const lookHeld = new Set();  // the TV_LOOK_ACTIONS held
  let lastHeading = null;
  let beat = null;             // the heartbeat's timer
  const schedule = deps.schedule ?? ((fn, ms) => (typeof setTimeout === 'function' ? setTimeout(fn, ms) : null));
  const cancel = deps.cancel ?? ((h) => { if (h != null && typeof clearTimeout === 'function') clearTimeout(h); });
  /** The host's loop is gone (a later boot, an unwind): down quietly, and the event goes on to whoever owns it now. */
  const gone = () => { if (state === 'off' || !deps.alive || deps.alive()) return false; finish(true); return true; };

  const isCanvasEvent = (e) => {
    const c = deps.canvas;
    const tg = e?.target;
    return !!c && (tg === c || (typeof c.contains === 'function' && tg && c.contains(tg)));
  };
  const swallow = (e) => { e.preventDefault?.(); e.stopImmediatePropagation?.(); e.stopPropagation?.(); };

  function onPointerDown(e) {
    if (state === 'off' || gone() || !isCanvasEvent(e)) return;
    swallow(e);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) }; press = null; return; }
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, button: e.button ?? 0 };
  }
  function onPointerMove(e) {
    if (state === 'off') return;
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.d > 0 && d > 0) zoom(Math.log(d / pinch.d) / Math.log(TV_ZOOM_STEP));   // fingers apart: in
      pinch.d = d;
      return;
    }
    if (!press || press.id !== e.pointerId || !camera) return;
    const dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (!press.moved && Math.hypot(dx, dy) > TV_CLICK_SLOP) press.moved = true;
    if (press.moved) camera = orbitBy(camera, e.clientX - prev.x, e.clientY - prev.y);
  }
  function onPointerUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (state === 'off') { press = null; return; }
    swallow(e);
    const p = press;
    press = null;
    if (p && p.id === e.pointerId && !p.moved && p.button === 0 && state === 'up') deps.onPick?.(e.clientX, e.clientY, e);
  }
  function onMouse(e) {   // the host's window mousedown/mouseup (the swing, Mouse0) - the canvas's are the view's
    if (state === 'off' || gone() || !isCanvasEvent(e)) return;
    swallow(e);
  }
  function onWheel(e) {
    if (state === 'off' || gone() || !isCanvasEvent(e)) return;
    swallow(e);
    zoom(e.deltaY < 0 ? 1 : e.deltaY > 0 ? -1 : 0);
  }
  function onContext(e) { if (state !== 'off' && !gone() && isCanvasEvent(e)) swallow(e); }
  function onKey(e, down) {
    if (state === 'off' || gone()) return;
    const acts = deps.actionsOf?.(e) ?? [];
    // the pause key is the way down (KB1: the registry's Escape action, wherever the player bound it) - never the pause
    if (acts.includes('Escape')) { if (down) exit('escape'); swallow(e); return; }
    const look = acts.filter((a) => TV_LOOK_ACTIONS.includes(a));
    if (!look.length) return;
    for (const a of look) { if (down) lookHeld.add(a); else lookHeld.delete(a); }
    swallow(e);
  }
  const onKeyDown = (e) => onKey(e, true);
  const onKeyUp = (e) => onKey(e, false);

  function listen(on) {
    if (on === listening || typeof win?.addEventListener !== 'function') return;
    const m = on ? 'addEventListener' : 'removeEventListener';
    win[m]('pointerdown', onPointerDown, true);
    win[m]('pointermove', onPointerMove, true);
    win[m]('pointerup', onPointerUp, true);
    win[m]('pointercancel', onPointerUp, true);
    win[m]('mousedown', onMouse, true);
    win[m]('mouseup', onMouse, true);
    win[m]('wheel', onWheel, { capture: true, passive: false });
    win[m]('contextmenu', onContext, true);
    win[m]('keydown', onKeyDown, true);
    win[m]('keyup', onKeyUp, true);
    listening = on;
  }

  function zoom(notches) {
    if (!camera || !notches) return;
    camera = { ...camera, heightTarget: zoomTarget(camera.heightTarget, notches, ceilingFor(deps.cloudBase?.() ?? null)) };
  }

  function enter() {
    if (state === 'up' || state === 'rising') return true;
    const ok = deps.allowed();
    if (!ok?.ok) { if (ok?.why) deps.say?.(ok.why); return false; }
    if (deps.danger?.()) { deps.say?.(TRAVEL_VIEW_TEXT.enemies); return false; }
    if (state === 'off') camera = initialCamera(deps.feet(), deps.yaw());
    state = 'rising';
    heldBody = !!deps.holdBody?.(true);
    deps.freeCursor?.(true);
    listen(true);
    deps.hud?.show({ onReturn: () => exit('button'), onMark: (key) => { if (state === 'up') deps.onMark?.(key); } });
    rearm();
    return true;
  }

  /** Re-armed by every frame the host draws; fires only when they stop. */
  function rearm() {
    cancel(beat);
    beat = schedule(stalled, TV_HEARTBEAT_MS);
  }
  function stalled() {
    beat = null;
    if (state === 'off') return;
    if (gone()) return;
    if (win?.document?.hidden) { rearm(); return; }   // a hidden tab: the browser stopped the frames, nothing broke
    finish();
  }

  /** Out: `cut` drops straight to off (a window, a door, a death); otherwise the camera falls back to the head. */
  function exit(why = 'escape', cut = false) {
    if (state === 'off') return false;
    if (cut) { finish(); return true; }
    state = 'falling';
    return true;
  }

  /** Down to off. `quiet`: the host is gone - the cursor is its successor's, so it is not handed back. */
  function finish(quiet = false) {
    cancel(beat);
    beat = null;
    state = 'off';
    t = 0;
    shown = null;
    press = null; pinch = null; pointers.clear(); lookHeld.clear();
    listen(false);
    deps.hud?.hide();
    if (heldBody) deps.holdBody?.(false);
    heldBody = false;
    if (!quiet) deps.freeCursor?.(false);
  }

  /** Before the motor reads the heading: camera-relative movement, and the look keys' orbit. */
  function steer(dt) {
    if (state === 'off' || !camera) return;
    const yawDir = (lookHeld.has('TurnRight') ? 1 : 0) - (lookHeld.has('TurnLeft') ? 1 : 0);
    const tiltDir = (lookHeld.has('LookDown') ? 1 : 0) - (lookHeld.has('LookUp') ? 1 : 0);
    if (yawDir || tiltDir) camera = turnCamera(camera, yawDir * TV_KEY_ORBIT_RATE * dt, tiltDir * TV_KEY_TILT_RATE * dt);
    if (!deps.autopilot?.() && deps.movementHeld?.()) deps.setYaw(turnHeading(deps.yaw(), camera.yaw, dt));
  }

  /**
   * THE FRAME'S CAMERA, after the host's own eye is known. Null while off; else the eye and look to draw from, the
   * angles for the sky and the listener, the billboards' right and (leaned) up, the focus the fog and the shadows
   * measure from, and the blend.
   */
  function frame(dt, headArg = null) {
    if (state === 'off') return null;
    rearm();
    const ok = deps.allowed();
    if (!ok?.ok || deps.windowUp()) { finish(); return null; }
    // the view is for the road, not the fight: a foe near brings the camera down to the traveller's own eyes
    if ((state === 'up' || state === 'rising') && deps.danger?.()) exit('danger');
    const head = headArg ?? deps.headView();
    const ceiling = ceilingFor(deps.cloudBase?.() ?? null);
    const r = stepCamera(camera, { feet: deps.feet(), dt, ceiling, heightAt: deps.heightAt ?? null });
    camera = r.camera;
    if (state === 'rising') { t = Math.min(1, t + dt / TV_RISE_S); if (t >= 1) state = 'up'; }
    else if (state === 'falling') { t = Math.max(0, t - dt / TV_FALL_S); if (t <= 0) { finish(); return null; } }
    else t = 1;
    shown = blendView(head, { eye: r.eye, fwd: r.fwd }, t);
    const ang = anglesOf(shown.fwd);
    const tilt = Math.max(0, -ang.pitch);
    return {
      eye: shown.eye, fwd: shown.fwd, yaw: ang.yaw, pitch: ang.pitch,
      right: rightOf(ang.yaw), up: leanedUp(ang.yaw, tilt * Math.min(1, t)),
      focus: [camera.focus[0], camera.focus[1], camera.focus[2]],
      blend: t, fullyUp: state === 'up', state,
    };
  }

  /** The readout, after the frame's matrices exist (the host's projection). */
  function drawHud() {
    if (state === 'off' || !deps.hud) return;
    const feet = deps.feet();
    const f = deps.project ? deps.project(feet) : null;
    const ahead = forwardOf(deps.yaw(), 0);
    const a = deps.project ? deps.project([feet[0] + ahead[0] * 4, feet[1], feet[2] + ahead[2] * 4]) : null;
    const h = f && a && f.front && a.front ? (Math.atan2(a.x - f.x, -(a.y - f.y)) * 180) / Math.PI : null;
    if (h != null) lastHeading = h;
    const proj = (p) => (deps.project && p ? deps.project(p) : null);
    const marks = [];
    for (const m of deps.marks?.() ?? []) {
      const at = proj(m.at);
      marks.push({ key: m.key, x: at?.x ?? 0, y: at?.y ?? 0, front: !!at?.front, label: m.label, kind: m.kind, pick: !!m.pick, edge: !!m.edge });
    }
    deps.hud.update({
      feet: f, heading: lastHeading, yaw: camera?.yaw ?? 0, where: deps.where?.() ?? '',
      touch: !!deps.touch, fade: t, marks,
      route: (deps.route?.() ?? []).map(proj), trip: deps.trip?.() ?? '',
    });
  }

  return {
    enter, exit, steer, frame, drawHud,
    /** The host's teardown: out at once, listeners and all. */
    dispose() { if (state !== 'off') finish(); },
    get active() { return state !== 'off'; },
    get state() { return state; },
    get camera() { return camera; },
    get blend() { return t; },
    /** TV2's ray and TV3's marks read the frame's own eye. */
    get eye() { return shown?.eye ?? null; },
  };
}
