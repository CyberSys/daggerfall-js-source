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
// ═══════════════════════════════════════════════════════════════════
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';

export const TRAVEL_VIEW_HUD_ID = 'travel-view';
/** The name on the screen (the code's is TRAVEL VIEW: "overworld" is the streaming world's own word in the tree). */
export const TRAVEL_VIEW_TITLE = 'Overworld';
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
  const hint = el('div', 'tview-hint');
  text.append(title, where, hint);
  const back = el('button', 'tview-back', 'Return');
  back.type = 'button';
  back.onclick = (e) => { e.preventDefault(); hooks.onReturn?.(); };
  bar.append(compass, text, back);
  r.append(marks, you, bar);
  doc.body.append(r);
  return { root: r, parts: { you, ring, chev, marks, bar, compass, needle, where, hint, back } };
}

/**
 * Show the readout (made once, then kept). `hooks.onReturn` is the button.
 */
export function showTravelViewHud(hooks = {}, doc = globalThis.document) {
  if (!doc) return false;
  if (!root || !root.isConnected) {
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
}

/**
 * One frame's readout.
 * @param {{ feet: {x:number,y:number,front:boolean}|null, heading: number|null, yaw: number, where: string,
 *   touch?: boolean, fade?: number, marks?: Array<{key:string, x:number, y:number, front:boolean, label?:string, kind?:string}> }} f
 *   `feet` the projected feet, `heading` the chevron's degrees (null keeps the last), `yaw` the camera's heading,
 *   `fade` 0..1 how far risen (the readout comes in with the camera and goes with it)
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
      n.className = `tview-mark ${m.kind ?? ''}`;
      const dot = doc.createElement('div'); dot.className = 'tview-dot';
      const lab = doc.createElement('div'); lab.className = 'tview-label';
      n.append(dot, lab);
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
    marks: [...markNodes.keys()],
  };
}
