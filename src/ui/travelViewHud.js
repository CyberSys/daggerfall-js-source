// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV1 - THE TRAVEL VIEW'S READOUT (bible/06-Systems/Travel-View.md).
//
// What stands over the raised camera: the traveller's own mark (a ring
// at the feet and a chevron for the heading - from 450 m a body is a
// dozen pixels, and the mark is how the eye finds it), a compass that
// turns with the orbit, the bar at the foot of the screen (the view's
// name, where the traveller is, the hints, and the one button back), and
// the marks the later slices hang here: TV2's destination and route
// line, TV3's travellers.
//
// THE HUD'S KIND OF THING, NOT A WINDOW - ui/enhancedTravelControl.js's
// law, for its reason: nothing here registers with the overlay stack,
// because anything in that slot pauses the game and the view's whole
// point is a world that goes on under it. The root takes no pointer
// events; the button opts back in, as the travel panel's controls do.
// UPDATED, NOT REBUILT: every node is made once, and a frame writes only
// what changed.
//
// It stands at the foot of the screen, not the top: the Travel Options
// panel owns the top while a journey runs, and both are up together.
//
// TV2: THE PLACES AND THE WAY. The known places in the view wear a plate
// (a mark with `pick`, the one kind of mark that takes the pointer - a
// click on it is a journey there by the roads, the same as a click on the
// town itself), the journey's end wears the destination mark, and the
// route it walks is a line under them: an SVG path through the route's
// projected points, broken where a point falls behind the eye. The bar
// carries the trip in words under the place line.
// ═══════════════════════════════════════════════════════════════════
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';

export const TRAVEL_VIEW_HUD_ID = 'travel-view';
/** The name on the screen (the code's is TRAVEL VIEW: "overworld" is the streaming world's own word in the tree). */
export const TRAVEL_VIEW_TITLE = 'Overworld';
/** The SVG namespace the route line is drawn in. */
const SVG_NS = 'http://www.w3.org/2000/svg';
/** The hints under the name - what each hand does. */
export const TRAVEL_VIEW_HINTS = Object.freeze({
  mouse: 'Click to travel · Drag to turn · Wheel to zoom · WASD to walk · Esc to return',
  touch: 'Tap to travel · Drag to turn · Pinch to zoom',
});

/**
 * The compass needle's turn, degrees clockwise on the screen, for a camera heading `yaw`: north is +z, yaw 0, so a
 * camera facing north shows north straight up and one facing east (yaw +90 degrees) shows it to the left.
 */
export const compassDegrees = (yaw) => -(yaw * 180) / Math.PI;

/**
 * The traveller's chevron, degrees clockwise on the screen: the heading's projected direction from the feet.
 * `feetPx` and `aheadPx` are the projected feet and a point a few metres ahead of them; null when either is off
 * screen (the chevron keeps its last turn).
 */
export function chevronDegrees(feetPx, aheadPx) {
  if (!feetPx?.front || !aheadPx?.front) return null;
  const dx = aheadPx.x - feetPx.x, dy = aheadPx.y - feetPx.y;
  if (Math.hypot(dx, dy) < 1e-3) return null;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

let root = null;
let parts = null;
let last = null;
let hooksNow = {};

/**
 * TV2: THE ROUTE LINE's path data through projected points: a move to the first point in front of the eye, a line to
 * each after it, and a new move after any point behind the eye (a line across it would be drawn through the camera).
 * @param {Array<{x:number, y:number, front:boolean}|null>} points
 */
export function routePath(points) {
  let d = '';
  let pen = false;
  for (const p of points ?? []) {
    if (!p?.front || !Number.isFinite(p.x) || !Number.isFinite(p.y)) { pen = false; continue; }
    d += `${pen ? 'L' : 'M'}${Math.round(p.x)} ${Math.round(p.y)} `;
    pen = true;
  }
  return d.trim();
}

function put(node, key, value) {
  if (!node || last[key] === value) return;
  last[key] = value;
  node.textContent = value;
}
function style(node, key, prop, value) {
  if (!node || last[key] === value) return;
  last[key] = value;
  node.style[prop] = value;
}

function build(doc, hooks) {
  injectEnhancedStyle(doc);
  injectEnhancedFonts(doc);
  const r = doc.createElement('div');
  r.id = TRAVEL_VIEW_HUD_ID;
  r.className = 'tview';
  const el = (tag, cls, text = '') => { const n = doc.createElement(tag); n.className = cls; if (text) n.textContent = text; return n; };
  const you = el('div', 'tview-you');
  const ring = el('div', 'tview-ring');
  const chev = el('div', 'tview-chev');
  you.append(ring, chev);
  const marks = el('div', 'tview-marks');
  const bar = el('div', 'tview-bar');
  const compass = el('div', 'tview-compass');
  const needle = el('div', 'tview-needle', 'N');
  compass.append(needle);
  const text = el('div', 'tview-text');
  const title = el('div', 'tview-title', TRAVEL_VIEW_TITLE);
  const where = el('div', 'tview-where');
  const trip = el('div', 'tview-trip');   // TV2: the journey in words
  const hint = el('div', 'tview-hint');
  text.append(title, where, trip, hint);
  // TV2: the route line, under the marks - a casing and the line over it, one path's data for both
  let route = null, casing = null, line = null;
  if (typeof doc.createElementNS === 'function') {
    route = doc.createElementNS(SVG_NS, 'svg');
    route.setAttribute('class', 'tview-route');
    casing = doc.createElementNS(SVG_NS, 'path'); casing.setAttribute('class', 'tview-route-casing');
    line = doc.createElementNS(SVG_NS, 'path'); line.setAttribute('class', 'tview-route-line');
    route.append(casing, line);
  }
  const back = el('button', 'tview-back', 'Return');
  back.type = 'button';
  back.onclick = (e) => { e.preventDefault(); hooks.onReturn?.(); };
  bar.append(compass, text, back);
  if (route) r.append(route);
  r.append(marks, you, bar);
  doc.body.append(r);
  return { root: r, parts: { you, ring, chev, marks, bar, compass, needle, where, trip, hint, back, route, casing, line } };
}

/**
 * Show the readout (made once, then kept). `hooks.onReturn` is the button; `hooks.onMark(key)` a plate's click (TV2).
 */
export function showTravelViewHud(hooks = {}, doc = globalThis.document) {
  if (!doc) return false;
  hooksNow = hooks;
  if (!root || !root.isConnected) {
    for (const n of markNodes.values()) n.remove();
    markNodes.clear();
    const b = build(doc, hooks);
    root = b.root; parts = b.parts; last = {};
  }
  parts.back.onclick = (e) => { e.preventDefault(); hooks.onReturn?.(); };
  root.style.display = '';
  return true;
}

/** Hide it (kept for the next open - the view is entered and left often). */
export function hideTravelViewHud() {
  if (root) root.style.display = 'none';
}

/** Take it down for good (a host teardown). */
export function disposeTravelViewHud() {
  root?.remove();
  root = null; parts = null; last = null;
  markNodes.clear();
  hooksNow = {};
}

/**
 * One frame's readout.
 * @param {{ feet: {x:number,y:number,front:boolean}|null, heading: number|null, yaw: number, where: string,
 *   touch?: boolean, fade?: number, trip?: string, route?: Array<{x:number,y:number,front:boolean}|null>,
 *   marks?: Array<{key:string, x:number, y:number, front:boolean, label?:string, kind?:string, pick?:boolean}> }} f
 *   `feet` the projected feet, `heading` the chevron's degrees (null keeps the last), `yaw` the camera's heading,
 *   `fade` 0..1 how far risen (the readout comes in with the camera and goes with it); TV2: `trip` the journey's line,
 *   `route` its projected points, and a mark with `pick` takes a click (`hooks.onMark`)
 */
export function updateTravelViewHud(f) {
  if (!parts) return;
  const fade = f.fade == null ? 1 : Math.max(0, Math.min(1, f.fade));
  style(root, 'op', 'opacity', fade.toFixed(3));
  if (f.feet?.front) {
    style(parts.you, 'you-d', 'display', '');
    style(parts.you, 'you-t', 'transform', `translate(${Math.round(f.feet.x)}px, ${Math.round(f.feet.y)}px)`);
  } else style(parts.you, 'you-d', 'display', 'none');
  if (f.heading != null) style(parts.chev, 'chev', 'transform', `rotate(${f.heading.toFixed(1)}deg)`);
  style(parts.needle, 'needle', 'transform', `rotate(${compassDegrees(f.yaw).toFixed(1)}deg)`);
  put(parts.where, 'where', f.where ?? '');
  put(parts.hint, 'hint', f.touch ? TRAVEL_VIEW_HINTS.touch : TRAVEL_VIEW_HINTS.mouse);
  put(parts.trip, 'trip', f.trip ?? '');
  style(parts.trip, 'trip-d', 'display', f.trip ? '' : 'none');
  if (parts.line) {
    const d = routePath(f.route ?? []);
    if (last.route !== d) {
      last.route = d;
      parts.line.setAttribute('d', d);
      parts.casing.setAttribute('d', d);
    }
  }
  syncMarks(f.marks ?? []);
}

/** The keyed marks (TV2's destination, TV3's travellers): made on first sight, moved after, dropped when gone. */
const markNodes = new Map();
function syncMarks(marks) {
  const seen = new Set();
  for (const m of marks) {
    seen.add(m.key);
    let n = markNodes.get(m.key);
    if (!n) {
      const doc = parts.marks.ownerDocument;
      n = doc.createElement('div');
      n.className = `tview-mark ${m.kind ?? ''}${m.pick ? ' pick' : ''}`;
      const dot = doc.createElement('div'); dot.className = 'tview-dot';
      const lab = doc.createElement('div'); lab.className = 'tview-label';
      n.append(dot, lab);
      if (m.pick) {
        const key = m.key;
        n.onclick = (e) => { e.preventDefault?.(); e.stopPropagation?.(); hooksNow.onMark?.(key); };
      }
      parts.marks.append(n);
      markNodes.set(m.key, n);
    }
    n.style.display = m.front ? '' : 'none';
    if (m.front) n.style.transform = `translate(${Math.round(m.x)}px, ${Math.round(m.y)}px)`;
    const lab = n.lastChild;
    if (lab && lab.textContent !== (m.label ?? '')) lab.textContent = m.label ?? '';
  }
  for (const [k, n] of markNodes) if (!seen.has(k)) { n.remove(); markNodes.delete(k); }
}

/** The pins' read: what the readout shows right now. */
export function travelViewHudState() {
  if (!parts) return null;
  return {
    shown: root.style.display !== 'none',
    where: parts.where.textContent,
    hint: parts.hint.textContent,
    trip: parts.trip.textContent,
    route: last.route ?? '',
    marks: [...markNodes.keys()],
  };
}
