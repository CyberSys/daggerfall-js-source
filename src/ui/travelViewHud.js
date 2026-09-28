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
/** TV3: how far in from the screen's edge a mark held at the edge stands (px). */
export const TV_EDGE_MARGIN = 28;
/** AUDIT DEEP T1-12: the mouse's hint, naming the keys the player really has - the movement keys and the way down
 *  (KB1: the registry's Escape action, wherever it is bound) - the defaults' words when the host names none. */
export function travelViewMouseHint({ move = 'WASD', out = 'Esc' } = {}) {
  return `Click to travel · Drag to turn · Wheel to zoom · ${move} to walk · ${out} to return`;
}
/** The hints under the name - what each hand does. */
export const TRAVEL_VIEW_HINTS = Object.freeze({
  mouse: travelViewMouseHint(),
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

/**
 * TV3: A MARK OUTSIDE THE PICTURE, HELD AT ITS EDGE: where on a `w` x `h` screen (inset by `margin`) the mark of a
 * point projected at `p` stands, and the way its arrow points (degrees clockwise from up). A point behind the eye
 * projects through the mirror of itself, so its direction from the middle is turned round first. Null for a point
 * that is on the picture - it is drawn where it stands. EDGE-FURNITURE: `top` and `foot` are the clear room at the top and
 * the foot (the HUD's compass and the travel panel above, the view's bar and the hotbar below - measured by the
 * readout); a point under them is held at their edge, as one off the screen is.
 * @param {{x:number, y:number, front:boolean}} p
 */
export function edgeHold(p, w, h, margin = TV_EDGE_MARGIN, top = margin, foot = margin) {
  if (!p) return null;
  if (p.front && p.x >= margin && p.x <= w - margin && p.y >= top && p.y <= h - foot) return null;
  const cx = w / 2, cy = h / 2;
  let dx = p.x - cx, dy = p.y - cy;
  if (!p.front) { dx = -dx; dy = -dy; }
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) dy = 1;   // straight behind: below, where the ground behind would be
  const sx = (cx - margin) / Math.max(1e-6, Math.abs(dx)), sy = (dy < 0 ? cy - top : cy - foot) / Math.max(1e-6, Math.abs(dy));
  const k = Math.min(sx, sy);
  return { x: cx + dx * k, y: cy + dy * k, angle: (Math.atan2(dx, -dy) * 180) / Math.PI };
}

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
  // PERF-TV: every mark is drawn on ONE canvas (drawMarks) - pointer-free: a click on a plate is found by position
  const canvas = el('canvas', 'tview-canvas');
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
  // AUDIT DEEP2 E15: the places the canvas draws, in words - visually hidden, said when the set changes (never per frame)
  const said = el('ul', 'tview-said');
  said.setAttribute?.('aria-label', 'Places in view');
  const back = el('button', 'tview-back', 'Return');
  back.type = 'button';
  back.onclick = (e) => { e.preventDefault(); hooks.onReturn?.(); };
  bar.append(compass, text, back);
  // AUDIT TV B8: a press on the readout (Return, a plate) is the readout's - the host's window mousedown counts any
  // press as Mouse0 (the swing, the activation), so it stops here
  // PERF-TV: a label drawn before the plates' web font arrived would stay in the fallback face - the label images are
  // drawn again once the fonts are in
  doc.fonts?.addEventListener?.('loadingdone', () => { sprites.clear(); canvasSig = []; });
  const own = (e) => e.stopPropagation?.();
  r.addEventListener?.('mousedown', own);
  r.addEventListener?.('mouseup', own);
  if (route) r.append(route);
  r.append(canvas, you, bar, said);
  doc.body.append(r);
  return { root: r, parts: { you, ring, chev, canvas, bar, compass, needle, where, trip, hint, back, route, casing, line, said } };
}

/**
 * Show the readout (made once, then kept). `hooks.onReturn` is the button. (A plate's click is found by position -
 * travelViewHudPickAt - since PERF-TV draws the marks.)
 */
export function showTravelViewHud(hooks = {}, doc = globalThis.document) {
  if (!doc) return false;
  if (!root || !root.isConnected) {
    const b = build(doc, hooks);
    root = b.root; parts = b.parts; last = {};
    resetMarks();   // PERF-TV: a new canvas holds nothing
  }
  parts.back.onclick = (e) => { e.preventDefault(); hooks.onReturn?.(); };
  furniture.at = -Infinity;   // EDGE-FURNITURE: what stands at the edges now (a journey's panel may have come or gone)
  root.style.display = '';
  listenPointer(doc.defaultView, true);
  return true;
}

/** Hide it (kept for the next open - the view is entered and left often). */
export function hideTravelViewHud() {
  if (root) root.style.display = 'none';
  listenPointer(parts?.canvas?.ownerDocument?.defaultView, false);
  hits = []; setHover(null);
}

/** Take it down for good (a host teardown). */
export function disposeTravelViewHud() {
  listenPointer(parts?.canvas?.ownerDocument?.defaultView, false);
  setHover(null);
  root?.remove();
  root = null; parts = null; last = null;
  resetMarks();
  sprites.clear();
}

function resetMarks() { hits = []; drawnKeys = []; canvasDrew = false; canvasSig = []; furniture.at = -Infinity; }
/** PERF-TV: the pointer's place over the page, followed while the readout stands (a plate under it is lit, and the
 *  cursor says it takes a click) - passive, never a handler that could stop the view's own. */
const onPointerMoveHud = (e) => { pointer = { x: e.clientX, y: e.clientY }; };
/** AUDIT DEEP2 E10: a finger lifted leaves no hover behind (a drag ended over a plate lit it until the next touch). */
const onPointerUpHud = (e) => { if (e.pointerType === 'touch') pointer = null; };
let pointerWin = null;
function listenPointer(win, on) {
  if (on && win && pointerWin !== win && typeof win.addEventListener === 'function') {
    pointerWin?.removeEventListener?.('pointermove', onPointerMoveHud);
    pointerWin?.removeEventListener?.('pointerup', onPointerUpHud);
    win.addEventListener('pointermove', onPointerMoveHud, { passive: true });
    win.addEventListener('pointerup', onPointerUpHud, { passive: true });
    pointerWin = win;
  } else if (!on && pointerWin) {
    pointerWin.removeEventListener?.('pointermove', onPointerMoveHud);
    pointerWin.removeEventListener?.('pointerup', onPointerUpHud);
    pointerWin = null;
    pointer = null;
  }
}

/**
 * One frame's readout.
 * @param {{ feet: {x:number,y:number,front:boolean}|null, heading: number|null, yaw: number, where: string, keys?: {move?:string, out?:string}|null,
 *   touch?: boolean, fade?: number, trip?: string, route?: Array<{x:number,y:number,front:boolean}|null>,
 *   marks?: Array<{key:string, x:number, y:number, front:boolean, label?:string, sub?:string, kind?:string, pick?:boolean, edge?:boolean}> }} f
 *   `feet` the projected feet, `heading` the chevron's degrees (null keeps the last), `yaw` the camera's heading,
 *   `fade` 0..1 how far risen (the readout comes in with the camera and goes with it); TV2: `trip` the journey's line,
 *   `route` its projected points, and a mark with `pick` takes a click (`hooks.onMark`)
 */
export function updateTravelViewHud(f) {
  if (!parts) return;
  // PERF-TV (AUDIT DEEP2 F11): the screen's size read ONCE a frame, before this frame's writes - and the furniture with it
  const win = parts.canvas?.ownerDocument?.defaultView;
  const vw = win?.innerWidth ?? 0, vh = win?.innerHeight ?? 0, dpr = win?.devicePixelRatio || 1;   // read ONCE, before any write
  measureFurniture(parts.canvas?.ownerDocument, vw, vh);
  const fade = f.fade == null ? 1 : Math.max(0, Math.min(1, f.fade));
  style(root, 'op', 'opacity', fade.toFixed(3));
  if (f.feet?.front) {
    style(parts.you, 'you-d', 'display', '');
    style(parts.you, 'you-t', 'transform', `translate(${Math.round(f.feet.x)}px, ${Math.round(f.feet.y)}px)`);
  } else style(parts.you, 'you-d', 'display', 'none');
  if (f.heading != null) style(parts.chev, 'chev', 'transform', `rotate(${f.heading.toFixed(1)}deg)`);
  style(parts.needle, 'needle', 'transform', `rotate(${compassDegrees(f.yaw).toFixed(1)}deg)`);
  const words = `${last.where}|${last.hint}|${last.trip}`;
  put(parts.where, 'where', f.where ?? '');
  put(parts.hint, 'hint', f.touch ? TRAVEL_VIEW_HINTS.touch : travelViewMouseHint(f.keys ?? {}));
  put(parts.trip, 'trip', f.trip ?? '');
  style(parts.trip, 'trip-d', 'display', f.trip ? '' : 'none');
  if (`${last.where}|${last.hint}|${last.trip}` !== words) furniture.at = -Infinity;   // the bar's words changed: its height may have (a line wrapped, a journey's line came) - measured again next frame
  if (parts.line) {
    const d = routePath(f.route ?? []);
    if (last.route !== d) {
      last.route = d;
      parts.line.setAttribute('d', d);
      parts.casing.setAttribute('d', d);
    }
  }
  drawMarks(f.marks ?? [], vw, vh, dpr);
}

/**
 * PERF-TV (bible/06-Systems/Travel-View.md): THE MARKS ARE DRAWN, NOT BUILT. Every mark - a traveller, a place's
 * plate, a far place (TV5), the journey's end - is painted on ONE canvas under the bar, a shape and a cached label
 * image each; a click on one that takes it (`pick`) is found here (travelViewHudPickAt) and the pointer's hover is
 * followed here. As DOM nodes each moving mark cost a style recalculation every frame - 20 plates and 64 travellers
 * 5.8 ms in the browser probe before, the screen's size read after each held mark's writes forcing a layout apiece -
 * and a picture that did not change is not drawn again.
 */
export const TRAVEL_VIEW_MARK_COLORS = Object.freeze({
  traveller: '#4e7f72', party: '#6fb86a', bone: '#e9e4d9', brass: '#c08a3e',   // enhancedStyle.js --verdigris, --bone, --brass; PARTY_MARK_CSS
  plate: 'rgba(14,16,19,0.72)', plateEdge: 'rgba(192,138,62,0.35)',
});
/** The plates' face - the stylesheet's --display, as the DOM plates had it. */
export const TRAVEL_VIEW_PLATE_FONT = "'Cormorant', Georgia, serif";
/** AUDIT DEEP2 E11: the other labels' face - the stylesheet's --data, as the DOM labels had it (a bare sans-serif was
 *  the canvas's own default, not the enhanced face). */
export const TRAVEL_VIEW_LABEL_FONT = "'Barlow Semi Condensed', system-ui, sans-serif";
const SPRITES_MAX = 512;
const sprites = new Map();
let hits = [];          // this frame's pickable marks, drawn last on top: { key, x0, y0, x1, y1 }
let drawnKeys = [];
let canvasDrew = false;
let canvasSig = [];     // last frame's picture, as drawn
let hoverKey = null;
let pointer = null;     // { x, y } the pointer over the page, while the readout is shown
/** A mark's look, by its kind's first word. */
const lookOf = (m) => {
  const k = (m.kind ?? '').split(' ')[0];
  return k === 'place' || k === 'far' || k === 'dest' || k === 'target' || k === 'party' ? k : 'traveller';
};
/** A label's image, made once (its shadow or its plate baked in) and kept by what it shows. */
function labelSprite(doc, text, look, size, journey, hover, dpr) {
  const key = `${look}|${size}|${journey ? 1 : 0}|${hover ? 1 : 0}|${dpr}|${text}`;
  let sp = sprites.get(key);
  if (sp) { sprites.delete(key); sprites.set(key, sp); return sp; }   // AUDIT DEEP2 E12: the newest at the back - the oldest goes first
  if (sprites.size >= SPRITES_MAX) sprites.delete(sprites.keys().next().value);   // one at a time: a clear() redrew every label in one frame
  const c = doc.createElement('canvas');
  const x = c.getContext?.('2d');
  if (!x) return null;
  const plate = look === 'place' || look === 'far';
  const font = plate ? `${size}px ${TRAVEL_VIEW_PLATE_FONT}` : `${size}px ${TRAVEL_VIEW_LABEL_FONT}`;   // `sub`: a plate's second line (TV5's distance)
  x.font = font;
  const tw = x.measureText(text).width;
  const aw = journey ? x.measureText(' →').width : 0;
  const padX = plate ? 7 : 4, padY = plate ? 3 : 3;
  const w = Math.ceil(tw + aw + padX * 2), h = Math.ceil(size + padY * 2 + 2);
  c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
  x.scale(dpr, dpr);
  x.font = font; x.textBaseline = 'top';
  const C = TRAVEL_VIEW_MARK_COLORS;
  if (plate) {
    x.fillStyle = C.plate; x.fillRect(0.5, 0.5, w - 1, h - 1);
    x.strokeStyle = hover ? C.brass : C.plateEdge; x.lineWidth = 1; x.strokeRect(0.5, 0.5, w - 1, h - 1);
    x.fillStyle = hover || look === 'far' ? C.brass : C.bone;
  } else {
    x.shadowColor = '#000'; x.shadowBlur = 3; x.shadowOffsetY = 1;
    x.fillStyle = look === 'dest' ? C.brass : look === 'sub' ? 'rgba(233,228,217,0.8)' : C.bone;
  }
  x.fillText(text, padX, padY + 1);
  if (journey) { x.fillStyle = C.brass; x.fillText(' →', padX + tw, padY + 1); }
  sp = { c, w, h };
  sprites.set(key, sp);
  return sp;
}
function drawMarks(marks, vw, vh, dpr) {
  const cv = parts.canvas;
  drawnKeys = marks.map((m) => m.key);
  if (!cv || (!marks.length && !canvasDrew)) { hits = []; return; }
  const g = cv.getContext?.('2d');
  if (!g) return;
  const bw = Math.round(vw * dpr), bh = Math.round(vh * dpr);
  // where each mark stands this frame, and what is under the pointer (the plates on top, the last drawn first)
  const placed = [];
  const nextHits = [];
  for (const m of marks) {
    if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;   // AUDIT DEEP2 E: one NaN poisoned its whole edge's run
    const held = m.edge ? edgeHold(m, vw, vh, TV_EDGE_MARGIN, furniture.top, furniture.foot) : null;
    if (!m.front && !held) continue;
    const at = held ?? m;
    const q = { m, held, x: Math.round(at.x), y: Math.round(at.y), look: lookOf(m), side: -1 };
    if (held) q.side = heldSide(q, vw);
    placed.push(q);
  }
  spreadHeld(placed, vw, vh);
  let hover = null;
  for (let i = placed.length - 1; i >= 0 && pointer; i--) {
    const q = placed[i];
    if (!q.m.pick) continue;
    const b = markBox(q, vw);
    if (pointer.x >= b.x0 && pointer.x <= b.x1 && pointer.y >= b.y0 && pointer.y <= b.y1) { hover = q.m.key; break; }
  }
  setHover(hover);
  // the picture this frame would draw: unchanged (a camera at rest), the canvas already shows it
  const sig = [bw, bh, hover ?? ''];
  for (const q of placed) sig.push(q.m.key, q.x, q.y, q.held ? Math.round(q.held.angle) : 999, q.m.label ?? '', q.m.sub ?? '', q.m.kind ?? '');
  for (const q of placed) if (q.m.pick) nextHits.push({ key: q.m.key, ...markBox(q, vw) });
  hits = nextHits;
  sayPlaces(placed);
  if (sig.length === canvasSig.length && sig.every((v, i) => v === canvasSig[i])) return;
  canvasSig = sig;
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, vw, vh);
  canvasDrew = false;
  const C = TRAVEL_VIEW_MARK_COLORS;
  const doc = cv.ownerDocument;
  for (const q of placed) {
    const { m, held, x, y, look } = q;
    const color = look === 'party' ? C.party : look === 'traveller' ? C.traveller : C.brass;
    g.fillStyle = color; g.strokeStyle = '#000'; g.lineWidth = 1;
    if (held) {   // the arrow, turned the way it lies (0 up, clockwise)
      g.save(); g.translate(x, y); g.rotate((held.angle * Math.PI) / 180);
      // AUDIT DEEP2 E5: a NOTCHED head - a near-equilateral triangle read the same turned a third either way
      g.beginPath(); g.moveTo(0, -10); g.lineTo(7, 7); g.lineTo(0, 2); g.lineTo(-7, 7); g.closePath(); g.fill(); g.stroke();
      g.restore();
    } else if (look === 'target') {
      g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.lineWidth = 2; g.strokeStyle = C.brass; g.stroke();
    } else {
      const r = look === 'dest' ? 7 : look === 'place' || look === 'far' ? 4 : 5;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    if (!m.label) continue;
    const plate = look === 'place' || look === 'far';
    const sp = labelSprite(doc, m.label, look, held && !plate ? 11 : plate ? 13 : 12, /\bjourney\b/.test(m.kind ?? ''), m.key === hover, dpr);
    if (!sp) continue;
    const sb = m.sub ? labelSprite(doc, m.sub, 'sub', 11, false, false, dpr) : null;   // TV5: a far place's distance, under its plate
    // held at the foot, the label stands ABOVE its arrow - under it is the bar (EDGE-FURNITURE)
    // in the picture, a plate with a second line stands higher by it - the distance never across its own dot (AUDIT DEEP2 E9)
    const ly = q.side === 3 ? y - 10 - sp.h - (sb ? sb.h : 0) : plate && !held ? y - 24 - sp.h / 2 - (sb ? sb.h : 0) : y + (held ? 10 : 7);
    g.drawImage(sp.c, inScreen(x - sp.w / 2, sp.w, vw), ly, sp.w, sp.h);   // a long name held at a side edge stays on the screen
    if (sb) {
      g.drawImage(sb.c, inScreen(x - sb.w / 2, sb.w, vw), ly + sp.h, sb.w, sb.h);
    }
    canvasDrew = true;
  }
  canvasDrew = canvasDrew || placed.length > 0;
}
/** A mark's box width (its label's, by its length). */
const markWidth = (m) => Math.max(24, 9 * (m.label?.length ?? 0) + 16);
/** The room between two marks held along one edge. */
const HELD_GAP = 4;
/** EDGE-FURNITURE: what stands at the screen's edges while the view is up - the game HUD's compass, its vitals and
 *  hotbar and its quick-slot block (the HUD stays under the view), a journey's travel panel and its junction disc, a
 *  phone's touch buttons. The view's own bar is measured apart (it is MOVED clear of what stands under it). */
const FURNITURE = '.hud-top, .hud-bottom, .hud-quick, .travelpanel-bar, .travelpanel-junction, .dftouch-btn';
/** A held arrow's room off the furniture (px) - its own half height (10) and a little air. */
const FURNITURE_GAP = 12;
/** How often the furniture is measured (ms) - a layout read, so twice a second and never per mark. */
const FURNITURE_EVERY_MS = 500;
/** AUDIT DEEP2 E6: the least of the screen left clear between an axis's two furniture bands - under it both shrink, in
 *  proportion (a per-band cap of 30% put the marks ahead inside a phone's travel panel). */
const FURNITURE_MIN_CLEAR = 0.25;
/** How far in from a side a side's marks reach with their labels (px) - a piece within it stands in that side's way. */
const SIDE_REACH = 120;
/** AUDIT DEEP2 E1/E2: the view's bar's own foot (px, the style sheet's `bottom`) and its air over what it clears. */
const BAR_FOOT = 18, BAR_AIR = 8;
const furniture = { top: TV_EDGE_MARGIN, foot: TV_EDGE_MARGIN, lTop: TV_EDGE_MARGIN, lFoot: TV_EDGE_MARGIN, rTop: TV_EDGE_MARGIN,
  rFoot: TV_EDGE_MARGIN, topLo: TV_EDGE_MARGIN, topHi: 0, footLo: TV_EDGE_MARGIN, footHi: 0, bar: BAR_FOOT, at: -Infinity, vw: 0, vh: 0 };
/** Two bands along one axis `n` long, kept to leave FURNITURE_MIN_CLEAR of it between them. */
function clearBands(a, b, n) {
  const room = n * (1 - FURNITURE_MIN_CLEAR);
  if (a + b <= room) return [a, b];
  const k = room / (a + b);
  return [a * k, b * k];
}
/**
 * EDGE-FURNITURE (2026-09-28, Mac: "Fix this bug"; AUDIT DEEP2 E1/E2/E4/E6/E7): WHAT STANDS AT THE EDGES, MEASURED - a
 * layout read, so at most every FURNITURE_EVERY_MS, when the screen changes size and when the view opens; never per
 * frame, never per mark. A piece whose middle is in the screen's middle third is a BAND across its edge (the compass,
 * the vitals, the travel panel): the marks held at that edge stand clear of it. One in a side third is a CORNER piece
 * (the quick-slot block, a phone's buttons, the junction disc): the marks along that edge stop short of it. Any piece
 * within SIDE_REACH of a side stands in that side's way. And the view's own bar is LIFTED clear of whatever stands
 * under it - it sat on the HUD's vitals at every screen size (same layer, drawn after them), and on a phone the touch
 * buttons stood over its Return.
 */
function measureFurniture(doc, vw, vh) {
  const now = globalThis.performance?.now?.() ?? Date.now();
  if (now - furniture.at < FURNITURE_EVERY_MS && furniture.vw === vw && furniture.vh === vh) return;
  const G = FURNITURE_GAP, M = TV_EDGE_MARGIN;
  const f = { top: M, foot: M, lTop: M, lFoot: M, rTop: M, rFoot: M, topLo: M, topHi: vw - M, footLo: M, footHi: vw - M };
  const rects = [];
  for (const e of doc?.querySelectorAll?.(FURNITURE) ?? []) {
    const r = e?.getBoundingClientRect?.();
    if (r && r.width > 0 && r.height > 0) rects.push(r);
  }
  // the bar first: lifted over every piece under it that shares its span, then a piece like the rest
  const bar = parts?.bar, br = bar?.getBoundingClientRect?.(), back = parts?.back?.getBoundingClientRect?.();
  let barFoot = BAR_FOOT;
  if (br && br.width > 0 && br.height > 0) {
    // what it lifts over: a band under it (the vitals, the buttons mid-foot) and anything under its Return - never a
    // corner block that only its far end reaches (on a narrow phone that lifted it over the quick slots to mid-screen)
    const band = (r) => { const mid = (r.left + r.right) / 2; return mid > vw * 0.3 && mid < vw * 0.7; };
    const underBack = (r) => back && back.width > 0 && r.right > back.left && r.left < back.right;
    for (const r of rects) if (r.top >= vh / 2 && r.right > br.left && r.left < br.right && (band(r) || underBack(r))) barFoot = Math.max(barFoot, vh - r.top + BAR_AIR);
    barFoot = Math.min(barFoot, Math.max(BAR_FOOT, vh * (1 - FURNITURE_MIN_CLEAR) - br.height));   // never off the screen's top half
    const top = vh - barFoot - br.height;
    rects.push({ left: br.left, right: br.right, top, bottom: top + br.height, width: br.width, height: br.height });
    if (furniture.bar !== barFoot) { furniture.bar = barFoot; if (bar.style) bar.style.bottom = `${Math.round(barFoot)}px`; }
  }
  for (const r of rects) {
    const upper = r.bottom <= vh / 2, lower = r.top >= vh / 2;
    if (!upper && !lower) continue;   // across the middle: no edge's
    const mid = (r.left + r.right) / 2;
    const band = mid > vw * 0.3 && mid < vw * 0.7;
    if (upper) {
      if (band) f.top = Math.max(f.top, r.bottom + G);
      else if (mid <= vw * 0.3) f.topLo = Math.max(f.topLo, r.right + G);
      else f.topHi = Math.min(f.topHi, r.left - G);
      if (r.left < SIDE_REACH) f.lTop = Math.max(f.lTop, r.bottom + G);
      if (r.right > vw - SIDE_REACH) f.rTop = Math.max(f.rTop, r.bottom + G);
    } else {
      if (band) f.foot = Math.max(f.foot, vh - r.top + G);
      else if (mid <= vw * 0.3) f.footLo = Math.max(f.footLo, r.right + G);
      else f.footHi = Math.min(f.footHi, r.left - G);
      if (r.left < SIDE_REACH) f.lFoot = Math.max(f.lFoot, vh - r.top + G);
      if (r.right > vw - SIDE_REACH) f.rFoot = Math.max(f.rFoot, vh - r.top + G);
    }
  }
  [f.top, f.foot] = clearBands(f.top, f.foot, vh);
  [f.lTop, f.lFoot] = clearBands(f.lTop, f.lFoot, vh);
  [f.rTop, f.rFoot] = clearBands(f.rTop, f.rFoot, vh);
  { const [a, b] = clearBands(f.topLo, vw - f.topHi, vw); f.topLo = a; f.topHi = vw - b; }
  { const [a, b] = clearBands(f.footLo, vw - f.footHi, vw); f.footLo = a; f.footHi = vw - b; }
  Object.assign(furniture, f, { at: now, vw, vh });
}
/** Which edge a held mark stands on: 0 left, 1 right, 2 the top, 3 the foot. AUDIT DEEP2 E4: one on the top or the foot
 *  whose box would reach past a side's line stands ON that side, in its corner - two runs, one an edge, never saw each
 *  other across a corner, so a town just round it lay over a town just before it. */
function heldSide(q, vw) {
  const m = TV_EDGE_MARGIN, h = q.held;
  if (h.x <= m + 0.5) return 0;
  if (h.x >= vw - m - 0.5) return 1;
  const half = markWidth(q.m) / 2 + 4;
  if (q.x - half < m) { q.x = m; return 0; }
  if (q.x + half > vw - m) { q.x = Math.round(vw - m); return 1; }
  return h.y <= furniture.top + 0.5 ? 2 : 3;
}
/**
 * EDGE-DECLUTTER (2026-09-28, Mac: "Just #1"): THE MARKS HELD AT ONE EDGE, SPREAD so none lies over another. Two towns
 * (or a town and a rider) in much the same direction were held at the same spot, one plate hiding the other and its
 * click. Each edge's marks keep their order along it and slide apart - down a side (by their boxes' heights), along
 * the top or the foot (by their widths) - just enough, each run of them centred on where its marks would stand; each
 * arrow still points its own way. An edge too crowded to part them spaces them evenly along it instead. Every run's
 * BOXES stay inside its edge's clear stretch (EDGE-FURNITURE), the ends' included (AUDIT DEEP2 E8).
 */
function spreadHeld(placed, vw, vh) {
  const sides = [[], [], [], []];   // left, right, top, foot
  for (const q of placed) {
    if (!q.held) continue;
    const side = q.side;
    if (side < 2) {
      const b = markBox(q, vw);
      sides[side].push({ q, pos: q.y, a: q.y - b.y0, b: b.y1 - q.y });
    } else {
      const half = markWidth(q.m) / 2 + 4;
      sides[side].push({ q, pos: q.x, a: half, b: half });
    }
  }
  const F = furniture;
  const bounds = [[F.lTop, vh - F.lFoot], [F.rTop, vh - F.rFoot], [F.topLo, F.topHi], [F.footLo, F.footHi]];
  for (let s = 0; s < 4; s++) {
    const items = sides[s];
    if (!items.length) continue;
    items.sort((u, v) => u.pos - v.pos || (u.q.m.key < v.q.m.key ? -1 : u.q.m.key > v.q.m.key ? 1 : 0));
    const [lo, hi] = bounds[s];
    const fit = (r) => Math.min(Math.max(r.at, lo + items[r.i0].a), hi - r.span - items[r.i1].b);
    // runs of touching marks, each run centred on where its marks would stand (its first mark at `at`, the rest `off`
    // below it); a run that meets the one before it joins it, and the joined run is centred again
    const runs = [];
    for (let i = 0; i < items.length; i++) {
      items[i].off = 0;
      let r = { i0: i, i1: i, sum: items[i].pos, n: 1, span: 0, at: items[i].pos };
      r.at = fit(r);   // AUDIT DEEP2 E3: a lone mark kept inside its stretch BEFORE it is weighed against the run above it
      for (let p = runs[runs.length - 1]; p; p = runs[runs.length - 1]) {
        const shift = p.span + items[p.i1].b + HELD_GAP + items[r.i0].a;
        if (p.at + shift <= r.at) break;
        for (let k = r.i0; k <= r.i1; k++) items[k].off += shift;
        p.sum += r.sum - shift * r.n; p.n += r.n; p.i1 = r.i1; p.span = shift + r.span;
        p.at = p.sum / p.n; p.at = fit(p);
        runs.pop(); r = p;
      }
      runs.push(r);
    }
    for (const r of runs) {
      const a = lo + items[r.i0].a, z = hi - items[r.i1].b;
      const even = r.span > z - a;   // more than the edge holds: spaced evenly along it
      const at = even ? a : fit(r);
      for (let k = r.i0; k <= r.i1; k++) {
        const pos = even ? a + ((z - a) * (k - r.i0)) / Math.max(1, r.i1 - r.i0) : at + items[k].off;
        if (s < 2) items[k].q.y = Math.round(pos); else items[k].q.x = Math.round(pos);
      }
    }
  }
}
/** A label's left edge, kept inside a screen `vw` wide (4 px in). */
const inScreen = (x0, w, vw) => (vw > w + 8 ? Math.min(Math.max(4, x0), vw - 4 - w) : x0);
/** A pickable mark's box on the screen - its plate (or its label) and its dot, with a finger's slack, kept inside the
 *  screen as its label is. */
function markBox(q, vw) {
  const plate = q.look === 'place' || q.look === 'far';
  const w = markWidth(q.m), h = plate ? 24 : 20;
  const x0 = inScreen(q.x - w / 2, w, vw);
  if (q.side === 3) return { x0: x0 - 4, x1: x0 + w + 4, y0: q.y - 14 - h - (q.m.sub ? 16 : 0), y1: q.y + 10 };   // its label above it
  if (plate && !q.held) return { x0: x0 - 4, x1: x0 + w + 4, y0: q.y - 36 - (q.m.sub ? 16 : 0), y1: q.y + 8 };   // over its dot (E9)
  return { x0: x0 - 4, x1: x0 + w + 4, y0: Math.min(q.y - 10, q.y - h), y1: q.y + 28 + (q.m.sub ? 16 : 0) };
}
/** AUDIT DEEP2 E15: the pickable places' names (and distances), written to the hidden list when the set changes. */
function sayPlaces(placed) {
  const list = parts?.said;
  if (!list) return;
  let text = '';
  for (const q of placed) if (q.m.pick && q.m.label) text += `${q.m.label}${q.m.sub ? `, ${q.m.sub}` : ''}\n`;
  if (last.said === text) return;
  last.said = text;
  const doc = list.ownerDocument;
  list.textContent = '';
  for (const line of text.split('\n')) if (line) { const li = doc.createElement('li'); li.textContent = line; list.append(li); }
}
function setHover(key) {
  if (key === hoverKey) return;
  hoverKey = key;
  const body = parts?.canvas?.ownerDocument?.body;
  if (body?.style) body.style.cursor = key ? 'pointer' : '';
}
/** PERF-TV: THE CLICK ON A MARK - the key of the pickable mark drawn at (x, y) this frame, the one on top; null for none
 *  (the click is the ground's - scenes/travelView.js asks here before it picks). */
export function travelViewHudPickAt(x, y) {
  for (let i = hits.length - 1; i >= 0; i--) {
    const b = hits[i];
    if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return b.key;
  }
  return null;
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
    marks: [...drawnKeys],   // PERF-TV: the marks the canvas was handed this frame
    hits: hits.map((h) => ({ ...h })),   // and the boxes that take a click
    said: last.said ?? '',   // AUDIT DEEP2 E15: the places in words
  };
}
