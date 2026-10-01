// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "actual UI integration for life skills") -
// THE PROFESSIONS IN THE WORLD'S FACE (bible/06-Systems/
// Professions-Arc.md 8, 21, 22), each in the Enhanced Plus stone and
// brass (ui/enhancedPlusStyle.js PROF_CSS), scaled by the HUD's scale:
//
//   the PROMPT  - bottom centre above the hotbar: "[E] Pick Red Rose -
//                 Herbalism 34", or what the node needs;
//   the METER   - centred under the crosshair while an act plays: the
//                 kneel's and the steady hand's bar (the hold turns red
//                 when the herb bruises), the Basket's leaves with the
//                 glint to tap; PROF7 the knife's dotted line over the
//                 carcass, the points drawn past lit; a still bar under reduced motion (the
//                 system's own - the port has no setting of its own);
//   the TOASTS  - on the right, four at most, three seconds each:
//                 "+3 Red Roses to your Stores", "+45 Herbalism XP",
//                 "Herbalism 34 -> 35";
//   the CHIP    - under the compass: "Herbalism 34 / 60 today";
//   the BANNER  - a rank's name at 25, 50, 75 and 100.
//
// The toasts' law is pure (`createToastQueue`); the rest is the DOM the
// host's frame feeds. One owner: the host builds it online and disposes
// it with the page.
// ═══════════════════════════════════════════════════════════════════
import { BASKET_SPOTS } from '../systems/herbAct.js';
import { MINE_POINTS } from '../systems/mineAct.js';   // PROF2: the vein's face
import { MINE_ACT, CHOP_ACT, TRACE_ACT, throwM } from '../net/professionLaw.js';
import { PROF_CSS } from './enhancedPlusStyle.js';

/** The toasts: four at most, three seconds each (PROF0 8). */
export const PROF_TOASTS_MAX = 4;
export const PROF_TOAST_S = 3;
/** The rank's banner stands this long. */
export const PROF_BANNER_S = 4;

/** THE TOASTS' LAW: `push` a line (the oldest goes past four), `tick` ages them, `lines` what stands. GATHER-SAID: a line
 *  pushed `keep` (a harvest's goods) is passed over while an unkept one is older - an answer's XP, its rank's rise and a
 *  specialisation's hint went past four and took the goods' line with them, so a harvest looked as if it gave nothing. */
export function createToastQueue({ max = PROF_TOASTS_MAX, ttl = PROF_TOAST_S } = {}) {
  let seq = 0;
  /** @type {{ id: number, text: string, left: number, keep: boolean }[]} */
  let rows = [];
  return {
    /** @param {any} text  @param {{ keep?: boolean }|null} [o] */
    push(text, o = null) {
      const t = String(text ?? '').trim();
      if (!t) return;
      rows.push({ id: ++seq, text: t, left: ttl, keep: o?.keep === true });
      while (rows.length > max) {
        const i = rows.findIndex((r) => !r.keep);
        rows.splice(i < 0 ? 0 : i, 1);
      }
    },
    tick(dt) {
      const step = Math.max(0, Number(dt) || 0);
      for (const r of rows) r.left -= step;
      rows = rows.filter((r) => r.left > 0);
    },
    get lines() { return rows.slice(); },
    clear() { rows = []; },
  };
}

const STYLE_ID = 'prof-hud-style';

/**
 * @param {{ doc?: Document }} [o]
 */
export function createProfHud({ doc = globalThis.document } = {}) {
  if (!doc?.body) return null;
  if (!doc.getElementById(STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = STYLE_ID;
    st.textContent = PROF_CSS;
    (doc.head ?? doc.body).append(st);
  }
  const mk = (cls) => { const n = doc.createElement('div'); n.className = cls; return n; };
  const prompt = mk('prof-prompt');
  const meter = mk('prof-meter');
  meter.hidden = true;
  const toasts = mk('prof-toasts');
  const chip = mk('prof-chip');
  const banner = mk('prof-banner');
  doc.body.append(prompt, meter, toasts, banner);
  const queue = createToastQueue();
  let bannerLeft = 0;
  let lastPrompt = null, lastChip = null, drawnToasts = '';
  /** AUDIT 29 C10: the system's reduced motion, asked once a second at most - never twice a frame through an act */
  let _reduced = false, _reducedAt = -Infinity;
  const reduced = () => {
    const t = Date.now();
    if (t - _reducedAt > 1000) { _reducedAt = t; try { _reduced = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches; } catch { _reduced = false; } }
    return _reduced;
  };

  /** The chip rides the compass's column when the enhanced HUD stands, else stands on its own under the top edge. */
  function seatChip() {
    const top = doc.querySelector?.('.hud .hud-top');
    if (top && chip.parentNode !== top) top.append(chip);
    else if (!top && chip.parentNode !== doc.body) { doc.body.append(chip); chip.style.cssText = 'position:fixed;left:50%;top:52px;transform:translateX(-50%);z-index:12'; }
  }

  return {
    /** The prompt: `{ key, verb, rest }` ("[E]", "Pick Red Rose", "Herbalism 34"), or null to clear it. */
    setPrompt(p) {
      const text = p ? `${p.key ?? ''}|${p.verb ?? ''}|${p.rest ?? ''}|${p.alt ?? ''}` : '';
      if (text === lastPrompt) return;
      lastPrompt = text;
      prompt.replaceChildren();
      if (!p) return;
      const k = doc.createElement('kbd');
      k.textContent = `[${p.key}]`;
      prompt.append(k, doc.createTextNode(` ${p.verb}`));
      if (p.rest) { const d = doc.createElement('span'); d.className = 'dim'; d.textContent = ` - ${p.rest}`; prompt.append(d); }
      if (p.alt) { const d = doc.createElement('span'); d.className = 'dim prof-alt'; d.textContent = `   ${p.alt}`; prompt.append(d); }   // AUDIT 32 P9: its own line on a phone
    },
    /** The meter for an act (systems/herbAct.js), or null to take it down. `label` the act's words. */
    setMeter(act, label = '') {
      if (!act) { meter.hidden = true; meter.replaceChildren(); return; }
      meter.hidden = false;
      const st = act.state;
      meter.classList.toggle('bruised', !!st.bruised);
      meter.classList.toggle('struck-glint', st.kind === 'mine' && st.last === 'glint' && act.swing > 0);
      meter.classList.toggle('clean-cut', st.kind === 'chop' && st.last === 'clean' && act.swing > 0);
      meter.replaceChildren();
      if (st.kind === 'chop') {
        // PROF4: THE RING - the trunk's notch, the band a Clean Cut stands in, and the ring shrinking onto it (a still
        // bar under reduced motion: the ring's marker sliding along it, the band marked); the chops below
        const span = CHOP_ACT.ringFrom - CHOP_ACT.ringTo;
        const pct = (r) => `${Math.round(((r - CHOP_ACT.ringTo) / span) * 1000) / 10}%`;
        if (reduced()) {
          const bar = mk('prof-ringbar');
          const band = mk('prof-ringband');
          band.style.left = pct(1 - st.band); band.style.width = `${Math.round(((2 * st.band) / span) * 1000) / 10}%`;
          const mark = mk('prof-ringmark');
          mark.style.left = pct(act.ring);
          bar.append(band, mark);
          meter.append(bar);
        } else {
          const box = mk(`prof-ring${act.inBand ? ' in-band' : ''}`);
          const r1 = ((1 - st.band) / CHOP_ACT.ringFrom) * 100, r2 = ((1 + st.band) / CHOP_ACT.ringFrom) * 100;
          if (st.band > 0) box.style.backgroundImage = `radial-gradient(circle closest-side, transparent ${r1}%, rgba(243,207,134,0.45) ${r1}%, rgba(243,207,134,0.45) ${r2}%, transparent ${r2}%)`;
          const notch = mk('prof-notch');
          notch.style.width = `${Math.round((1 / CHOP_ACT.ringFrom) * 1000) / 10}%`;
          const ring = mk('prof-ringline');
          ring.style.width = `${Math.round((Math.max(0, act.ring) / CHOP_ACT.ringFrom) * 1000) / 10}%`;
          box.append(notch, ring);
          meter.append(box);
        }
        const pips = mk('prof-finds');
        pips.textContent = `${'o '.repeat(Math.min(st.points, st.need))}${'. '.repeat(Math.max(0, st.need - st.points))}`.trim();
        const hint = mk('prof-hint');
        hint.textContent = st.creaked ? 'it creaks - keep chopping' : st.gentle ? (label || 'click to chop') : (label || 'click as the ring meets the notch');   // ACT-CLICK: the press named - either button, a tap, Attack
        meter.append(pips, hint);
        return;
      }
      if (st.kind === 'mine') {
        // PROF2: THE GLINT - the node's face as a box (MINE_ACT's spread), its five points, the one glinting, and where
        // the crosshair is on it; the strikes below (a strike on the glint counts two)
        const face = mk('prof-face');
        /** @param {readonly number[]} p [yaw, pitch] degrees */
        const at = (p) => [50 + (p[0] / (2 * MINE_ACT.spreadYawDeg)) * 100, 50 - (p[1] / (2 * MINE_ACT.spreadPitchDeg)) * 100];
        MINE_POINTS.forEach((p, i) => {
          const n = mk(i === st.glint ? 'prof-glint' : 'prof-point');
          const [x, y] = at(p);
          n.style.left = `${x}%`; n.style.top = `${y}%`;
          if (i === st.glint && reduced()) n.style.animation = 'none';
          face.append(n);
        });
        if (st.aim) {
          const a = mk('prof-aim');
          const [x, y] = at([Math.max(-MINE_ACT.spreadYawDeg, Math.min(MINE_ACT.spreadYawDeg, st.aim.yaw)), Math.max(-MINE_ACT.spreadPitchDeg, Math.min(MINE_ACT.spreadPitchDeg, st.aim.pitch))]);
          a.style.left = `${x}%`; a.style.top = `${y}%`;
          face.append(a);
        }
        const pips = mk('prof-finds');
        pips.textContent = `${'o '.repeat(Math.min(st.points, st.need))}${'. '.repeat(Math.max(0, st.need - st.points))}`.trim();
        const hint = mk('prof-hint');
        hint.textContent = st.gentle ? (label || 'click to strike') : (label || 'click to strike the glint');   // ACT-CLICK: the press named (it said 'strike the glint', and only the right button struck)
        meter.append(face, pips, hint);
        return;
      }
      if (st.kind === 'trace') {
        // PROF7: THE TRACE - the carcass's face as a box (the line's span, a margin round it), the dotted line, the points
        // the knife has passed lit, and where the crosshair is on it; a hold's bar for Gentle acts
        // (`label` the key held - E, the use key's own binding)
        const key = label || 'the use key';
        if (st.gentle) {
          const bar = mk('prof-bar');
          const fill = doc.createElement('i');
          fill.style.width = `${Math.round(act.progress * 100)}%`;
          bar.append(fill);
          const hint = mk('prof-hint');
          hint.textContent = `hold ${key}`;
          meter.append(bar, hint);
          return;
        }
        const face = mk('prof-face');
        const w = TRACE_ACT.spanYawDeg + 2 * TRACE_ACT.startDeg, h = 2 * (TRACE_ACT.spanPitchDeg + TRACE_ACT.startDeg);
        // AUDIT 32 P11: a degree the same across as up (the face was 8.4px a degree across and 5.8 up, so a stray up read a
        // third smaller than it was), the line the points are scored against drawn through them, and the first marked
        face.classList.add('prof-traceface');
        face.style.height = 'auto';
        face.style.aspectRatio = `${w} / ${h}`;
        /** @param {readonly number[]} p [yaw, pitch] degrees */
        const at = (p) => [50 + (p[0] / w) * 100, 50 - (p[1] / h) * 100];
        if (typeof doc.createElementNS === 'function') {
          const NS = 'http://www.w3.org/2000/svg';
          const svg = doc.createElementNS(NS, 'svg');
          svg.setAttribute('class', 'prof-line');
          svg.setAttribute('viewBox', '0 0 100 100');
          svg.setAttribute('preserveAspectRatio', 'none');
          const line = doc.createElementNS(NS, 'polyline');
          line.setAttribute('points', st.points.map((p) => at(p).map((v) => v.toFixed(2)).join(',')).join(' '));
          svg.append(line);
          face.append(svg);
        }
        st.points.forEach((p, i) => {
          const passed = st.tracing && i <= st.reached;
          const n = mk(passed ? 'prof-glint' : i === 0 ? 'prof-point first' : 'prof-point');
          const [x, y] = at(p);
          n.style.left = `${x}%`; n.style.top = `${y}%`;
          if (passed && reduced()) n.style.animation = 'none';
          face.append(n);
        });
        if (st.aim) {
          const a = mk('prof-aim');
          const [x, y] = at([Math.max(-w / 2, Math.min(w / 2, st.aim.yaw)), Math.max(-h / 2, Math.min(h / 2, st.aim.pitch))]);
          a.style.left = `${x}%`; a.style.top = `${y}%`;
          face.append(a);
        }
        const hint = mk('prof-hint');
        // AUDIT 32 P10: a slip said - the trace let go before the last point starts again, and the meter said only its start
        hint.textContent = st.tracing ? 'draw the knife along the line' : st.slips > 0 ? `let go - hold ${key} on the first point again` : `hold ${key} on the first point`;
        meter.append(face, hint);
        return;
      }
      if (st.kind === 'basket') {
        const leaves = mk('prof-leaves');
        if (st.spot >= 0) {
          const g = mk('prof-glint');
          const [x, y] = BASKET_SPOTS[st.spot];
          g.style.left = `${x * 100}%`; g.style.top = `${y * 100}%`;
          if (reduced()) g.style.animation = 'none';
          leaves.append(g);
        }
        const finds = mk('prof-finds');
        finds.textContent = st.hits.map((h) => (h ? '*' : '.')).join(' ') + ` ${Math.min(st.find + 1, 3)} of 3`;
        meter.append(leaves, finds);
        const hint = mk('prof-hint');
        hint.textContent = label || 'tap the glint';
        meter.append(hint);
        return;
      }
      if (st.kind === 'fish') {
        // PROF8: THE NET - the wind's bar and the throw it makes; the wait; the tug, flashed; the haul: the bar with the
        // tension band and the net's weight on it, the meter's fill under it and the slip said (a still bar either way -
        // nothing here moves but by the act's own numbers)
        const key = label || 'E';
        const pc = (v) => `${Math.round(Math.max(0, Math.min(1, v)) * 1000) / 10}%`;
        meter.classList.toggle('fish-tug', st.phase === 'tug');
        const hint = mk('prof-hint');
        if (st.phase === 'haul') {
          const haul = mk('prof-haulbar');
          const band = mk('prof-haulband');
          band.style.left = pc(st.bandAt); band.style.width = pc(st.bandW);
          const weight = mk('prof-haulweight');
          weight.style.left = pc(st.weight);
          haul.append(band, weight);
          const bar = mk('prof-bar');
          const fill = doc.createElement('i');
          fill.style.width = pc(st.fill);
          bar.append(fill);
          hint.textContent = `hold ${key} to raise the band, let go to lower it - keep the weight inside${st.slip > 0 ? ` (slipping, ${Math.round(st.slip * 100)}%)` : ''}`;
          meter.append(haul, bar, hint);
          return;
        }
        const bar = mk('prof-bar');
        const fill = doc.createElement('i');
        fill.style.width = pc(act.progress);
        bar.append(fill);
        hint.textContent = st.phase === 'wind' ? `hold ${key} to wind the net, let go to throw it (${Math.round(throwM(st.windS))} m)`
          : st.phase === 'fly' ? 'the net flies...'
            : st.phase === 'wait' ? `waiting for a bite${st.school !== null ? ' - over a school' : ''}...`
              : `a tug! press ${key} now`;
        meter.append(bar, hint);
        return;
      }
      const bar = mk('prof-bar');
      const fill = doc.createElement('i');
      fill.style.width = `${Math.round(act.progress * 100)}%`;
      bar.append(fill);
      const hint = mk('prof-hint');
      hint.textContent = st.kind === 'steady'
        ? (st.bruised ? 'bruised - hold on to keep what is left' : `hold still (${Math.round(st.window * 10) / 10} degrees)`)
        : (label || 'kneeling...');
      meter.append(bar, hint);
    },
    /** A line on the right; `keep` (GATHER-SAID) outlasts the unkept past four. */
    toast(text, o) { queue.push(text, o); },
    /** The rank's banner. */
    banner(text) { banner.textContent = String(text ?? ''); bannerLeft = text ? PROF_BANNER_S : 0; },
    /** The chip under the compass, or null to take it away. */
    setChip(text) {
      const t = text ?? '';
      if (t === lastChip && chip.isConnected) return;   // AUDIT 29 C10: seated when it changes or has fallen out - not a query every frame
      seatChip();
      if (t === lastChip) return;
      lastChip = t;
      chip.textContent = t;
    },
    /** Every frame: the toasts and the banner age. */
    frame(dt) {
      queue.tick(dt);
      const lines = queue.lines;
      const key = lines.map((l) => l.id).join(',');
      if (key !== drawnToasts) {
        drawnToasts = key;
        toasts.replaceChildren(...lines.map((l) => { const n = mk('prof-toast'); n.textContent = l.text; return n; }));
      }
      const nodes = toasts.children;
      for (let i = 0; i < lines.length; i++) nodes[i]?.classList?.toggle('fade', lines[i].left < 0.4);
      if (bannerLeft > 0) { bannerLeft -= Math.max(0, Number(dt) || 0); if (bannerLeft <= 0) banner.textContent = ''; }
    },
    /** The HUD's lines, for the pins. */
    get toastLines() { return queue.lines.map((l) => l.text); },
    dispose() { prompt.remove(); meter.remove(); toasts.remove(); chip.remove(); banner.remove(); queue.clear(); },
  };
}
