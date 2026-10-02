// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF-SCENES (2026-10-01, Mac: "all minigames should be overhauled to
// be more detailed and use the enhanced plus UI look"; "the minigame
// then plays inside that same framed panel"): THE ACT IN THE WORLD'S
// FACE - the panel an act plays in, under the crosshair where the loot
// plaque stood (ui/worldPlaque.js plaqueAnchor), in the plaque's own
// frame: the node named, its profession under it, the act's SCENE, the
// count, the hint. Every scene is the act's own numbers drawn - the
// rules, the timings and what the service is told are the acts'
// (systems/herbAct.js, mineAct.js, chopAct.js, traceAct.js, fishAct.js),
// never this file's:
//
//   mine   - the rock's face, its five points, the one glinting, the
//            crosshair on it; a crack opens with every fifth of the work,
//            sparks where a blow lands (gold on the glint);
//   chop   - the trunk and its notch, the band a Clean Cut stands in, the
//            ring closing on it (a still bar under reduced motion); the
//            notch deepens, chips fly, the trunk creaks at half;
//   hand / steady - the plant and the hand's hold round it; a bruise
//            browns the leaves;
//   basket - the leaf litter, the glint and the time it has left, the
//            three finds in the basket;
//   trace  - the pelt, the dotted line, the points passed lit and the
//            line drawn behind the knife; Gentle acts a hold's bar;
//   fish   - the water: the throw it will make while it winds, the net in
//            flight, the floats bobbing, dipping at the tug, the haul's
//            tension band and the net filling.
//
// Built ONCE an act (a new act, or a trace turning gentle, builds anew)
// and moved every frame - a scene rebuilt sixty times a second is the
// old meter's cost and its flicker. Every cue a shape AND a sound
// (systems/profSounds.js): the scene's own changes say which.
// ═══════════════════════════════════════════════════════════════════
import { BASKET_SPOTS } from '../systems/herbAct.js';
import { MINE_POINTS } from '../systems/mineAct.js';
import { FLY_S } from '../systems/fishAct.js';
import { MINE_ACT, CHOP_ACT, TRACE_ACT, FISH_ACT, throwM } from '../net/professionLaw.js';

const NS = 'http://www.w3.org/2000/svg';
const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
const pc = (v) => `${Math.round(clamp01(v) * 1000) / 10}%`;

/** The profession an act is worked under - the panel's line under the node's name. */
export const ACT_WORDS = Object.freeze({
  mine: 'Mining', chop: 'Logging', hand: 'Herbalism', steady: 'Herbalism', basket: 'Herbalism', trace: 'Hunting', fish: 'Fishing',
});

/** How long a burst (a blow's sparks, a chop's chips, a find's sparkle) stands, ms. */
export const BURST_MS = 420;

function kit(doc) {
  const div = (cls, parent = null) => { const n = doc.createElement('div'); n.className = cls; parent?.append(n); return n; };
  /** An SVG element - its class by attribute (an SVG element's className is not a string). */
  const svg = (tag, attrs = {}, parent = null) => {
    const n = typeof doc.createElementNS === 'function' ? doc.createElementNS(NS, tag) : doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    parent?.append(n);
    return n;
  };
  return { div, svg };
}
/** An SVG element's class, set whole. */
const setSvgClass = (n, c) => { if (n.getAttribute?.('class') !== c) n.setAttribute('class', c); };
/** A node's class, set whole only when it changes (a write a frame is a style recalculation a frame). */
const setClass = (n, c) => { if (n.className !== c) n.className = c; };
const show = (n, on) => { const d = on ? '' : 'none'; if (n.style.display !== d) n.style.display = d; };

/** The pips of a count: `on` of `n` lit (the strikes, the chops). */
function pips(k, parent, n) {
  const row = k.div('prof-pips', parent);
  const each = Array.from({ length: Math.max(1, n) }, () => k.div('prof-pip', row));
  return (on) => each.forEach((p, i) => setClass(p, i < on ? 'prof-pip on' : 'prof-pip'));
}
/** A burst at a place on a face: restarted by alternating its animation's name, never by a rebuild. */
function burst(k, parent, base) {
  const n = k.div(`${base}`, parent);
  let flip = false, until = 0;
  return {
    fire(x, y, tone = '') {
      flip = !flip;
      n.style.left = `${x}%`; n.style.top = `${y}%`;
      setClass(n, `${base} on ${flip ? 'a' : 'b'}${tone ? ` ${tone}` : ''}`);
      until = Date.now() + BURST_MS;
    },
    frame() { if (until && Date.now() > until) { until = 0; setClass(n, base); } },
  };
}

// ─── THE SCENES ──────────────────────────────────────────────────────

/** The rock's face: degrees of the crosshair onto it as MINE_ACT spreads them. */
function mineScene(k, scene, status) {
  const face = k.div('prof-face prof-rockface', scene);
  face.style.aspectRatio = `${2 * MINE_ACT.spreadYawDeg} / ${2 * MINE_ACT.spreadPitchDeg}`;
  const art = k.svg('svg', { class: 'prof-art', viewBox: '0 0 140 80', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, face);
  k.svg('polygon', { class: 'rock-base', points: '0,80 0,16 16,5 46,0 92,4 122,0 140,10 140,80' }, art);
  k.svg('polygon', { class: 'rock-lit', points: '16,5 46,0 66,20 40,32 8,26' }, art);
  k.svg('polygon', { class: 'rock-mid', points: '66,20 92,4 122,0 116,28 86,38' }, art);
  k.svg('polygon', { class: 'rock-lo', points: '0,50 40,32 86,38 116,28 140,42 140,80 0,80' }, art);
  k.svg('polyline', { class: 'rock-seam', points: '0,40 30,46 62,41 98,50 140,45' }, art);
  k.svg('polyline', { class: 'rock-seam', points: '0,64 40,59 76,66 112,61 140,67' }, art);
  for (const [x, y] of [[22, 15], [50, 29], [74, 11], [100, 35], [119, 19], [28, 57], [90, 60], [60, 71], [110, 55], [12, 38]]) {
    k.svg('polygon', { class: 'rock-ore', points: `${x},${y - 2.2} ${x + 2.6},${y} ${x},${y + 2.2} ${x - 2.6},${y}` }, art);
  }
  // a crack for each fifth of the work, out from the face's heart where the blows fall
  const cracks = ['70,40 64,31 67,22 60,13', '70,40 82,45 91,43 101,52', '70,40 58,48 49,46 41,57', '70,40 77,30 89,26 95,15', '70,40 71,52 64,61 67,73']
    .map((p) => k.svg('polyline', { class: 'rock-crack', points: p }, art));
  const at = (p) => [50 + (p[0] / (2 * MINE_ACT.spreadYawDeg)) * 100, 50 - (p[1] / (2 * MINE_ACT.spreadPitchDeg)) * 100];
  const points = MINE_POINTS.map((p) => { const n = k.div('prof-point', face); const [x, y] = at(p); n.style.left = `${x}%`; n.style.top = `${y}%`; return n; });
  const aim = k.div('prof-aim', face);
  const sparks = burst(k, face, 'prof-burst prof-sparks');
  const lit = pips(k, status, 1);
  let seen = 0, need = 0, setPips = lit;
  return {
    face,
    update(act, st, ctx) {
      if (st.need !== need) { need = st.need; status.replaceChildren(); setPips = pips(k, status, need); }
      points.forEach((n, i) => setClass(n, i === st.glint ? `prof-glint${ctx.reduced ? ' still' : ''}` : 'prof-point'));
      const a = st.aim ? at([Math.max(-MINE_ACT.spreadYawDeg, Math.min(MINE_ACT.spreadYawDeg, st.aim.yaw)), Math.max(-MINE_ACT.spreadPitchDeg, Math.min(MINE_ACT.spreadPitchDeg, st.aim.pitch))]) : null;
      show(aim, !!a);
      if (a) { aim.style.left = `${a[0]}%`; aim.style.top = `${a[1]}%`; }
      const open = Math.round(clamp01(st.points / Math.max(1, st.need)) * cracks.length);
      cracks.forEach((c, i) => setSvgClass(c, i < open ? 'rock-crack on' : 'rock-crack'));
      setPips(Math.min(st.points, st.need));
      if (st.strikes > seen) { seen = st.strikes; sparks.fire(a ? a[0] : 50, a ? a[1] : 50, st.last === 'glint' ? 'gold' : ''); }
      sparks.frame();
    },
    hint: (st, label) => (st.gentle ? (label || 'click to strike') : (label || 'click to strike the glint')),   // ACT-CLICK: the press named
  };
}

/** The trunk, its notch and the ring closing on it - the ring's radius in the notch's radii (chopAct ringAt). */
function chopScene(k, scene, status, act) {
  const face = k.div('prof-face prof-trunkface', scene);
  face.style.aspectRatio = '5 / 3';
  const art = k.svg('svg', { class: 'prof-art', viewBox: '0 0 100 60', 'aria-hidden': 'true' }, face);
  k.svg('rect', { class: 'wood-shade', x: 0, y: 0, width: 100, height: 60 }, art);
  const trunk = k.svg('g', { class: 'wood-trunk' }, art);
  k.svg('rect', { class: 'wood-bark', x: 26, y: -2, width: 48, height: 64 }, trunk);
  for (const x of [31, 38, 47, 55, 63, 70]) k.svg('polyline', { class: 'wood-groove', points: `${x},0 ${x - 1.5},14 ${x + 1},28 ${x - 1},44 ${x + 1.5},60` }, trunk);
  // the notch: an axe's cut across the trunk - its lower face the pale wood, its upper face in shadow
  const notch = k.svg('path', { class: 'wood-notch', d: '' }, trunk);
  const notchShade = k.svg('path', { class: 'wood-notch-shade', d: '' }, trunk);
  const R = 30 / CHOP_ACT.ringFrom * 0.94;   // the notch's radius: the ring's widest just inside the face
  const band = k.svg('circle', { class: 'ring-band', cx: 50, cy: 30, r: R, 'stroke-width': 0 }, art);
  const bandIn = k.svg('circle', { class: 'ring-band-edge', cx: 50, cy: 30, r: R }, art);
  const bandOut = k.svg('circle', { class: 'ring-band-edge', cx: 50, cy: 30, r: R }, art);
  k.svg('circle', { class: 'ring-notch', cx: 50, cy: 30, r: R }, art);
  const ring = k.svg('circle', { class: 'ring-line', cx: 50, cy: 30, r: R * CHOP_ACT.ringFrom }, art);
  const chips = burst(k, face, 'prof-burst prof-chips');
  // the still form (reduced motion): the ring's marker along a bar, the band marked
  const bar = k.div('prof-ringbar', scene);
  const bandBar = k.div('prof-ringband', bar);
  const mark = k.div('prof-ringmark', bar);
  const span = CHOP_ACT.ringFrom - CHOP_ACT.ringTo;
  const along = (r) => clamp01((r - CHOP_ACT.ringTo) / span);
  let setPips = pips(k, status, act.state.need), seen = 0;
  return {
    face,
    update(a, st, ctx) {
      show(face, !ctx.reduced); show(bar, !!ctx.reduced);
      const r = Math.max(0, a.ring);
      if (ctx.reduced) {
        bandBar.style.left = pc(along(1 - st.band)); bandBar.style.width = pc((2 * st.band) / span);
        mark.style.left = pc(along(r));
      } else {
        band.setAttribute('stroke-width', String(Math.max(0, 2 * st.band * R)));
        bandIn.setAttribute('r', String(Math.max(0, (1 - st.band) * R)));
        bandOut.setAttribute('r', String((1 + st.band) * R));
        ring.setAttribute('r', String(Math.round(r * R * 100) / 100));
        setSvgClass(ring, a.inBand ? 'ring-line in-band' : 'ring-line');
      }
      // the notch deepens with the work: a wedge into the trunk's face, wider at every chop
      const d = 4 + 18 * clamp01(st.points / Math.max(1, st.need));
      const w = d * 1.1, hgt = d * 0.42;
      notch.setAttribute('d', `M${50 - w} 30 Q50 ${30 - hgt} ${50 + w} 30 Q50 ${30 + hgt} ${50 - w} 30 Z`);
      notchShade.setAttribute('d', `M${50 - w} 30 Q50 ${30 - hgt} ${50 + w} 30 Q50 ${30 - hgt * 0.15} ${50 - w} 30 Z`);
      setSvgClass(trunk, st.creaked ? 'wood-trunk creaked' : 'wood-trunk');
      setPips(Math.min(st.points, st.need));
      if (st.chops > seen) { seen = st.chops; chips.fire(50, 50, st.last === 'clean' ? 'gold' : ''); }
      chips.frame();
    },
    hint: (st, label) => (st.creaked ? 'it creaks - keep chopping' : st.gentle ? (label || 'click to chop') : (label || 'click as the ring meets the notch')),
  };
}

/** The plant and the hand's hold round it - the kneel's, or the steady hand's (a bruise browns it). */
function plantScene(k, scene, status) {
  const face = k.div('prof-face prof-plantface', scene);
  face.style.aspectRatio = '5 / 3';
  const art = k.svg('svg', { class: 'prof-art', viewBox: '0 0 100 60', 'aria-hidden': 'true' }, face);
  k.svg('rect', { class: 'herb-ground', x: 0, y: 44, width: 100, height: 16 }, art);
  k.svg('ellipse', { class: 'herb-mound', cx: 50, cy: 46, rx: 22, ry: 5 }, art);
  const plant = k.svg('g', { class: 'herb-plant' }, art);
  k.svg('path', { class: 'herb-stem', d: 'M50 46 C49 38 52 30 50 18' }, plant);
  for (const [cx, cy, rot] of [[43, 38, -35], [57, 36, 35], [44, 29, -25], [56, 27, 28], [47, 21, -15]]) {
    k.svg('ellipse', { class: 'herb-leaf', cx, cy, rx: 6.5, ry: 2.6, transform: `rotate(${rot} ${cx} ${cy})` }, plant);
  }
  for (const [cx, cy] of [[50, 15], [47.2, 16.6], [52.8, 16.6], [48.3, 13], [51.7, 13]]) k.svg('circle', { class: 'herb-bloom', cx, cy, r: 2.2 }, plant);
  k.svg('circle', { class: 'herb-heart', cx: 50, cy: 15, r: 1.3 }, plant);
  // the hold: a ring filling round the plant
  k.svg('circle', { class: 'hold-track', cx: 50, cy: 28, r: 21 }, art);
  const hold = k.svg('circle', { class: 'hold-fill', cx: 50, cy: 28, r: 21, pathLength: 100, 'stroke-dasharray': '0 100', transform: 'rotate(-90 50 28)' }, art);
  const bar = k.div('prof-bar', status);
  const fill = k.div('', bar);
  return {
    face,
    update(a, st) {
      const p = clamp01(a.progress);
      hold.setAttribute('stroke-dasharray', `${Math.round(p * 1000) / 10} 100`);
      fill.style.width = `${Math.round(p * 100)}%`;
      setSvgClass(plant, st.bruised ? 'herb-plant bruised' : 'herb-plant');
    },
    // STEADY-SAID (AUDIT 2026-10-01 part four): the key the steady hand holds, where it holds one
    hint: (st, label) => (st.kind === 'steady'
      ? (st.bruised ? `bruised - ${label ? `keep ${label} held` : 'hold on'} to keep what is left` : `${label ? `hold ${label} and ` : ''}keep still (${Math.round(st.window * 10) / 10} degrees)`)
      : (label || 'kneeling...')),
  };
}

/** The leaf litter, the glint at its spot and the time it has left; the three finds in the basket. */
function basketScene(k, scene, status) {
  const face = k.div('prof-leaves prof-litterface', scene);
  face.style.aspectRatio = '5 / 3';
  const art = k.svg('svg', { class: 'prof-art', viewBox: '0 0 100 60', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, face);
  k.svg('rect', { class: 'litter-ground', x: 0, y: 0, width: 100, height: 60 }, art);
  const leaves = [[12, 10, 20], [30, 6, -40], [52, 14, 70], [74, 8, -10], [90, 18, 35], [8, 34, -60], [24, 44, 15], [42, 36, -25],
    [60, 46, 50], [80, 38, -70], [94, 50, 10], [36, 24, 95], [68, 26, -35], [18, 54, 40], [50, 54, -15], [86, 30, 65]];
  leaves.forEach(([x, y, rot], i) => {
    k.svg('path', { class: `litter-leaf t${i % 3}`, d: `M${x - 6} ${y} Q${x} ${y - 4.5} ${x + 6} ${y} Q${x} ${y + 4.5} ${x - 6} ${y} Z`, transform: `rotate(${rot} ${x} ${y})` }, art);
  });
  for (const p of ['6,28 22,25', '58,4 70,9', '72,56 88,52']) k.svg('polyline', { class: 'litter-twig', points: p }, art);
  const glint = k.div('prof-glint', face);
  const clock = k.svg('svg', { class: 'prof-glintclock', viewBox: '0 0 20 20', 'aria-hidden': 'true' }, glint);
  const left = k.svg('circle', { class: 'clock-left', cx: 10, cy: 10, r: 8.5, pathLength: 100, 'stroke-dasharray': '100 100', transform: 'rotate(-90 10 10)' }, clock);
  const sparkle = burst(k, face, 'prof-burst prof-sparkle');
  const basket = k.div('prof-basket', status);
  const slots = [0, 1, 2].map(() => k.div('prof-slot', basket));
  let seen = 0, lastSpot = 0;   // the spot the last glint stood at - a find's sparkle is there
  return {
    face,
    update(a, st, ctx) {
      show(glint, st.spot >= 0);
      if (st.spot >= 0) {
        lastSpot = st.spot;
        const [x, y] = BASKET_SPOTS[st.spot];
        glint.style.left = `${x * 100}%`; glint.style.top = `${y * 100}%`;
        setClass(glint, `prof-glint${ctx.reduced ? ' still' : ''}`);
        left.setAttribute('stroke-dasharray', `${Math.round((1 - clamp01(st.showing / Math.max(0.01, st.glint))) * 1000) / 10} 100`);
      }
      slots.forEach((s, i) => setClass(s, i < st.hits.length ? (st.hits[i] ? 'prof-slot found' : 'prof-slot missed') : i === st.hits.length ? 'prof-slot next' : 'prof-slot'));
      if (st.hits.length > seen) {
        seen = st.hits.length;
        if (st.hits[seen - 1]) { const [x, y] = BASKET_SPOTS[lastSpot]; sparkle.fire(x * 100, y * 100, 'gold'); }
      }
      sparkle.frame();
    },
    hint: (st, label) => label || 'tap the glint',
  };
}

/** The pelt, the dotted line through its points, the points passed lit and the line drawn behind the knife. */
function traceScene(k, scene, status, act) {
  const st0 = act.state;
  const w = TRACE_ACT.spanYawDeg + 2 * TRACE_ACT.startDeg, h = 2 * (TRACE_ACT.spanPitchDeg + TRACE_ACT.startDeg);
  // AUDIT 32 P11: a degree the same across as up, the line the points are scored against drawn through them, the first marked
  const face = k.div('prof-face prof-traceface', scene);
  face.style.height = 'auto';
  face.style.aspectRatio = `${w} / ${h}`;
  const at = (p) => [50 + (p[0] / w) * 100, 50 - (p[1] / h) * 100];
  const art = k.svg('svg', { class: 'prof-line', viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, face);
  const xy = (p) => at(p).map((v) => v.toFixed(2)).join(',');
  // the pelt laid out: its body, four legs and the head's stub, the fur's grain across it
  k.svg('path', { class: 'pelt', d: 'M14 50 C12 30 26 18 50 20 C74 18 88 30 86 50 C88 70 74 82 50 80 C26 82 12 70 14 50 Z M18 32 L6 18 L14 16 L26 26 Z M82 32 L94 18 L86 16 L74 26 Z M18 68 L6 82 L14 84 L26 74 Z M82 68 L94 82 L86 84 L74 74 Z M86 44 L97 46 L97 54 L86 56 Z' }, art);
  for (let i = 0; i < 9; i++) { const x = 22 + i * 7; k.svg('path', { class: 'pelt-fur', d: `M${x} 26 q2 6 0 12 M${x + 2} 62 q2 6 0 12` }, art); }
  k.svg('polyline', { class: 'trace-guide', points: st0.points.map(xy).join(' ') }, art);   // the scored line: the face's first polyline
  const drawn = k.svg('polyline', { class: 'trace-drawn', points: '' }, art);
  const pts = st0.points.map((p, i) => { const n = k.div(i === 0 ? 'prof-point first' : 'prof-point', face); const [x, y] = at(p); n.style.left = `${x}%`; n.style.top = `${y}%`; return n; });
  const aim = k.div('prof-aim prof-knife', face);
  const nick = burst(k, face, 'prof-burst prof-nick');
  const slips = k.div('prof-slips', status);
  let seenSlips = 0;
  return {
    face,
    update(a, st, ctx) {
      pts.forEach((n, i) => setClass(n, st.tracing && i <= st.reached ? `prof-glint${ctx.reduced ? ' still' : ''}` : i === 0 ? 'prof-point first' : 'prof-point'));
      drawn.setAttribute('points', st.tracing ? (st.path ?? []).slice(-160).map(xy).join(' ') : '');
      const p = st.aim ? at([Math.max(-w / 2, Math.min(w / 2, st.aim.yaw)), Math.max(-h / 2, Math.min(h / 2, st.aim.pitch))]) : null;
      show(aim, !!p);
      if (p) { aim.style.left = `${p[0]}%`; aim.style.top = `${p[1]}%`; }
      if (st.slips > seenSlips) { seenSlips = st.slips; nick.fire(p ? p[0] : 50, p ? p[1] : 50); }
      nick.frame();
      slips.textContent = st.slips > 0 ? `slips ${st.slips}` : '';
    },
    // AUDIT 32 P10 / TOUCH-HOLD: a slip said; a Use's hold names no key
    hint: (s, label, byUse) => {
      const key = label || 'the use key';
      return s.tracing ? 'draw the knife along the line' : byUse ? 'aim the knife at the first point' : s.slips > 0 ? `let go - hold ${key} on the first point again` : `hold ${key} on the first point`;
    },
  };
}

/** A hold's bar - Gentle acts' trace. */
function holdScene(k, scene, status) {
  const face = k.div('prof-face prof-holdface', scene);
  face.style.aspectRatio = '5 / 2';
  const art = k.svg('svg', { class: 'prof-art', viewBox: '0 0 100 40', 'aria-hidden': 'true' }, face);
  k.svg('path', { class: 'pelt', d: 'M14 20 C14 8 30 6 50 8 C70 6 86 8 86 20 C86 32 70 34 50 32 C30 34 14 32 14 20 Z' }, art);
  const bar = k.div('prof-bar', status);
  const fill = k.div('', bar);
  return {
    face,
    update(a) { fill.style.width = `${Math.round(clamp01(a.progress) * 100)}%`; },
    hint: (s, label, byUse) => (byUse ? 'skinning...' : `hold ${label || 'the use key'}`),
  };
}

/** The water: the throw it will make, the net in flight, the floats, the tug and the haul. */
function fishScene(k, scene, status) {
  const face = k.div('prof-face prof-waterface', scene);
  face.style.aspectRatio = '2 / 1';
  const art = k.svg('svg', { class: 'prof-art', viewBox: '0 0 100 50', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, face);
  k.svg('rect', { class: 'water-sky', x: 0, y: 0, width: 100, height: 16 }, art);
  k.svg('rect', { class: 'water-deep', x: 0, y: 16, width: 100, height: 34 }, art);
  k.svg('polygon', { class: 'water-far', points: '30,16 44,13.5 58,14.5 74,12.5 88,14 100,13 100,16' }, art);
  const waves = k.svg('g', { class: 'water-waves' }, art);
  for (const y of [20, 28, 37, 45]) k.svg('path', { class: 'water-wave', d: `M-20 ${y} q5 -2 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0` }, waves);
  const school = k.svg('g', { class: 'water-school' }, art);
  for (const [x, y] of [[-4, 6], [3, 9], [-1, 13], [6, 4], [9, 11]]) k.svg('path', { class: 'water-fish', d: `M${x - 2} ${y} q2 -1.4 4 0 l1.5 -1 v2 l-1.5 -1 q-2 1.4 -4 0 Z` }, school);
  // the bank the net is thrown from, the water lapping it
  k.svg('polygon', { class: 'water-bank', points: '0,12 6,12.5 10,15 13,22 15,34 16,50 0,50' }, art);
  k.svg('polyline', { class: 'water-bank-grass', points: '0,12 3,11 6,12.5 8,13.4' }, art);
  const arc = k.svg('path', { class: 'water-arc', d: '' }, art);
  const net = k.svg('g', { class: 'water-net' }, art);
  k.svg('circle', { class: 'net-mesh', cx: 0, cy: 0, r: 3 }, net);
  k.svg('path', { class: 'net-lines', d: 'M-3 0 H3 M0 -3 V3 M-2.1 -2.1 L2.1 2.1 M-2.1 2.1 L2.1 -2.1' }, net);
  const floats = k.svg('g', { class: 'water-floats' }, art);
  k.svg('path', { class: 'float-line', d: 'M-6 0 Q0 1.5 6 0' }, floats);
  for (const x of [-6, 0, 6]) { const f = k.svg('g', { class: 'float', transform: `translate(${x} 0)` }, floats); k.svg('circle', { class: 'float-body', cx: 0, cy: 0, r: 1.6 }, f); k.svg('rect', { class: 'float-tip', x: -0.5, y: -3.2, width: 1, height: 1.8 }, f); }
  const rings = k.svg('g', { class: 'water-rings' }, art);
  for (const r of [3, 6, 9]) k.svg('ellipse', { class: 'splash-ring', cx: 0, cy: 0, rx: r, ry: r * 0.35 }, rings);
  // the status: the throw's gauge while it winds, the haul's band on its bar, the net's fill
  const throwBar = k.div('prof-throwbar', status);
  const throwMark = k.div('prof-throwmark', throwBar);
  for (const m of [3, 6, 9, 12]) { const t = k.div('prof-throwtick', throwBar); t.style.left = pc((m - FISH_ACT.throwMinM) / (FISH_ACT.throwMaxM - FISH_ACT.throwMinM)); }
  const haul = k.div('prof-haulbar', status);
  const band = k.div('prof-haulband', haul);
  const weight = k.div('prof-haulweight', haul);
  const bar = k.div('prof-bar', status);
  const fill = k.div('', bar);
  const xOf = (m) => 14 + 78 * clamp01((m - FISH_ACT.throwMinM) / (FISH_ACT.throwMaxM - FISH_ACT.throwMinM));
  return {
    face,
    update(a, st) {
      const phase = st.phase;
      const m = phase === 'wind' ? throwM(st.windS) : st.throwM;
      const x = xOf(m), y = 22;
      setSvgClass(art, `prof-art phase-${phase}`);
      show(throwBar, phase === 'wind');
      throwMark.style.left = pc((m - FISH_ACT.throwMinM) / (FISH_ACT.throwMaxM - FISH_ACT.throwMinM));
      // the net's way, wound and in flight: an arc from the bank to where it lands
      arc.setAttribute('d', phase === 'wind' || phase === 'fly' ? `M7 11 Q${(7 + x) / 2} ${-8 - m} ${x} ${y}` : '');
      const fly = phase === 'fly' ? clamp01(st.t / FLY_S) : 0;
      const nx = 7 + (x - 7) * fly, ny = (1 - fly) * (1 - fly) * 11 + 2 * (1 - fly) * fly * (-8 - m) + fly * fly * y;
      net.setAttribute('transform', `translate(${nx.toFixed(2)} ${ny.toFixed(2)})`);
      setSvgClass(net, phase === 'fly' ? 'water-net on' : 'water-net');
      const afloat = phase === 'wait' || phase === 'tug' || phase === 'haul';
      floats.setAttribute('transform', `translate(${x.toFixed(2)} ${y})`);
      setSvgClass(floats, afloat ? `water-floats on${phase === 'tug' ? ' dip' : ''}` : 'water-floats');
      rings.setAttribute('transform', `translate(${x.toFixed(2)} ${y + 1})`);
      setSvgClass(rings, phase === 'tug' ? 'water-rings on' : 'water-rings');
      school.setAttribute('transform', `translate(${x.toFixed(2)} ${y + 8})`);
      setSvgClass(school, afloat && st.school !== null ? 'water-school on' : 'water-school');
      show(haul, phase === 'haul');
      band.style.left = pc(st.bandAt); band.style.width = pc(st.bandW);
      weight.style.left = pc(st.weight);
      fill.style.width = pc(phase === 'haul' ? st.fill : a.progress);
    },
    hint: (st, label) => {
      const key = label || 'E';
      if (st.phase === 'haul') return `hold ${key} to raise the band, let go to lower it - keep the weight inside${st.slip > 0 ? ` (slipping, ${Math.round(st.slip * 100)}%)` : ''}`;
      return st.phase === 'wind' ? `hold ${key} to wind the net, let go to throw it (${Math.round(throwM(st.windS))} m)`
        : st.phase === 'fly' ? 'the net flies...'
          : st.phase === 'wait' ? `waiting for a bite${st.school !== null ? ' - over a school' : ''}...`
            : `a tug! press ${key} now`;
    },
  };
}

// ─── THE PANEL ───────────────────────────────────────────────────────

/** Which scene an act wears - a trace's Gentle acts wear the hold's. */
export const sceneOf = (act) => {
  const st = act?.state;
  if (!st) return null;
  if (st.kind === 'trace' && st.gentle) return 'hold';
  if (st.kind === 'hand' || st.kind === 'steady') return 'plant';
  return st.kind;
};
const SCENES = { mine: mineScene, chop: chopScene, plant: plantScene, basket: basketScene, trace: traceScene, hold: holdScene, fish: fishScene };

/**
 * THE CUES an act's frame says, read off its state against the last frame's (`prev`, mutated to this one): a blow on
 * the glint rings, a plain one strikes; a Clean Cut rings, a plain chop strikes; a find ticks, a miss slips; a bruise
 * slips; a point passed ticks, a slip slips; the net thrown swings, lands with a splash, the tug splashes, the haul's
 * start ticks. Names for systems/profSounds.js. Pure.
 * @param {any} prev @param {any} st @returns {string[]}
 */
export function actCues(prev, st) {
  const out = [];
  if (!st) return out;
  if (st.kind === 'mine' && st.strikes > (prev.strikes ?? 0)) out.push(st.last === 'glint' ? 'glint' : 'strike');
  if (st.kind === 'chop' && st.chops > (prev.chops ?? 0)) out.push(st.last === 'clean' ? 'glint' : 'strike');
  if (st.kind === 'basket' && st.hits.length > (prev.hits ?? 0)) out.push(st.hits[st.hits.length - 1] ? 'tick' : 'slip');
  if (st.kind === 'steady' && st.bruised && !prev.bruised) out.push('slip');
  if (st.kind === 'trace' && !st.gentle) {
    if (st.tracing && st.reached > (prev.reached ?? 0)) out.push('tick');
    if (st.slips > (prev.slips ?? 0)) out.push('slip');
  }
  if (st.kind === 'fish' && prev.phase && st.phase !== prev.phase) {
    const cue = { fly: 'swing', wait: 'splash', tug: 'tug', haul: 'tick' }[st.phase];
    if (cue) out.push(cue);
  }
  prev.strikes = st.strikes; prev.chops = st.chops; prev.hits = st.hits?.length; prev.bruised = st.bruised;
  prev.reached = st.tracing ? st.reached : 0; prev.slips = st.slips; prev.phase = st.phase;
  return out;
}

/**
 * Build an act's panel into `root` (emptied first): the head (the node's name, its profession), the scene, the status
 * and the hint. Answers `update(act, { label, byUse, reduced })` for every frame of it - the scene moved, the hint said.
 * @param {Document} doc @param {HTMLElement} root @param {any} act @param {{ title?: string }} [o]
 */
export function buildActPanel(doc, root, act, { title = '' } = {}) {
  const k = kit(doc);
  root.replaceChildren();
  const st = act.state;
  const word = ACT_WORDS[st.kind] ?? '';
  const head = k.div('prof-acthead', root);
  const t = k.div('prof-acttitle', head);
  t.textContent = title || word;
  if (title && word) { const s = k.div('prof-actsub', head); s.textContent = word; }
  const scene = k.div('prof-scene', root);
  const status = k.div('prof-status', root);
  const hint = k.div('prof-hint', root);
  const which = sceneOf(act);
  const s = SCENES[which](k, scene, status, act);
  return {
    which,
    update(a, { label = '', byUse = false, reduced = false } = {}) {
      s.update(a, a.state, { reduced });
      const h = s.hint(a.state, label, byUse);
      if (hint.textContent !== h) hint.textContent = h;
    },
  };
}
