// RENOWN-BAR (2026-09-26, Mac: "with the new renown xp bar, I want to remove the xp amount on the lefthand side and
// integrate it into the bar itself, then center the bar properly"; asked, the amount is the one beside the bar -
// "1,453 / 3,460 XP" - and the level's box stays): THE NUMBERS IN THE BAR, THE BAR ON THE MIDDLE. RENOWN4 drew the row
// box, bar, numbers - the numbers a readout beside the bar, so the bar's middle stood 42px left of the vitals' (57px
// at the widest numbers, tools/renownBarProbe.mjs). Now the numbers are the track's own, centred over the fill the
// vitals' way (PX30c), the bar 16px so they fit, and the row is a grid of three columns - the box, the bar and an
// empty column the box's width - so the bar's middle is the row's, and the row is as wide as the vitals' and centred
// under them. The probe measures it in Chromium over the real faces (centre off 0.0px at a desktop, a laptop and a
// phone both ways up; the widest numbers 144px in a 213px bar on a 390px phone); these hold the markup and the sheet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renownXpFor, RENOWN_MAX } from '../src/net/renown.js';
import { setHudRenown } from '../src/ui/hudRenown.js';
import { PLUS_CSS } from '../src/ui/enhancedPlusStyle.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const CSS = src('src/ui/enhancedStyle.js');
const rule = (sheet, sel) => {
  const at = sheet.indexOf(`\n${sel} {`);
  assert.ok(at >= 0, `${sel} has a rule`);
  return sheet.slice(at + 1, sheet.indexOf('}', at) + 1);
};

const mkEl = () => ({
  className: '', textContent: '', id: '', rel: '', href: '', src: '', alt: '', children: [], dataset: {},
  style: { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; } },
  classList: {
    _s: new Set(),
    add(...c) { c.forEach((x) => this._s.add(x)); }, remove(...c) { c.forEach((x) => this._s.delete(x)); },
    toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); }, contains(c) { return this._s.has(c); },
  },
  attrs: {},
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'class') this.className = String(v); },
  getAttribute(k) { return this.attrs[k]; },
  removeAttribute(a) { delete this.attrs[a]; this[a] = ''; }, remove() {},
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; },
  replaceChildren(...c) { this.children = c; }, addEventListener(type, fn) { (this._on ??= {})[type] = fn; },
});
const find = (node, cls) => {
  if (String(node.className ?? '').split(/\s+/).includes(cls)) return node;
  for (const c of node.children ?? []) { const got = find(c, cls); if (got) return got; }
  return null;
};
const classes = (n) => String(n.className ?? '').split(/\s+/);

test('RENOWN-BAR the HUD, executed: the row is the box and the bar, nothing beside them - the numbers are the bar\'s own, after its fill and its ghost, and they follow the Renown (mutants: the numbers beside the bar again)', async () => {
  const prev = globalThis.document;
  globalThis.document = {
    createElement: mkEl, createElementNS: (ns) => Object.assign(mkEl(), { ns }),
    getElementById: () => null, head: mkEl(), body: mkEl(),
  };
  const { drawEnhancedHud, destroyEnhancedHud } = await import('../src/ui/enhancedHud.js');
  const { clearQuickslots } = await import('../src/systems/quickslots.js');
  clearQuickslots();
  const entity = { health: 40, maxHealth: 80, magicka: 0, maxMagicka: 10, fatigue: 100, items: [], equip: { slots: {} }, lightSource: null };
  try {
    let s = { level: 10, xp: 6000, pending: 1000 };
    setHudRenown(() => s);
    drawEnhancedHud(entity, 0, 0, { weapon: null, weaponSheathed: true });
    const root = document.body.children.find((n) => n.className === 'hud');
    const row = find(root, 'hud-renown');
    assert.deepEqual(row.children.map(classes), [['hud-renownbox'], ['hud-track', 'hud-renowntrack']], 'the box and the bar: no readout beside them');
    const track = row.children[1];
    assert.deepEqual(track.children.map(classes), [['hud-fill'], ['hud-renownghost'], ['hud-renownnum']], 'the numbers in the bar, drawn after its fill and ghost');
    assert.equal(track.children[2].textContent, '490 / 2,150 XP');
    s = { level: 50, xp: renownXpFor(RENOWN_MAX) };
    drawEnhancedHud(entity, 0, 0, { weapon: null, weaponSheathed: true });
    assert.equal(track.children[2].textContent, 'Highest', 'the cap\'s word, in the bar too');
    assert.equal(row.children[0].textContent, '50');
  } finally {
    destroyEnhancedHud();
    clearQuickslots();
    setHudRenown(null);
    globalThis.document = prev;
  }
});

test('RENOWN-BAR the sheet: the row a grid of three columns with the outer two equal, so the bar\'s middle is the row\'s; the box fits its column; the bar 16px, its frame inside the row\'s 22, the numbers centred in it, over the fill and on one line (mutants: the mirror column dropped; the row a flex again; the columns narrower than the box; the bar thin again; the numbers under the fill; the numbers wrapping)', () => {
  const on = rule(CSS, '.hud-renown.on');
  assert.equal(on, '.hud-renown.on { display: grid; grid-template-columns: 36px minmax(0, 1fr) 36px; }');
  const cols = /grid-template-columns: ([^;]+);/.exec(on)[1].match(/[\w-]+\([^)]*\)|\S+/g);   // a function's inner space is not a column's
  assert.equal(cols.length, 3, 'three columns: the box, the bar, the mirror');
  assert.equal(cols[0], cols[2], 'the outer two equal - the bar on the row\'s middle');
  assert.equal(cols[1], 'minmax(0, 1fr)', 'the bar takes what is left');
  // the box's own width, off its own rule: 1.6em of its font, its padding and its frame a side - never wider than
  // its column, or it would push the bar off the middle
  const box = rule(CSS, '.hud-renownbox');
  const font = Number(/font-size: (\d+)px/.exec(box)[1]), minEm = Number(/min-width: ([\d.]+)em/.exec(box)[1]);
  const pad = Number(/padding: \d+px (\d+)px/.exec(box)[1]), frame = Number(/border: (\d+)px solid/.exec(box)[1]);
  assert.ok(font * minEm + 2 * pad + 2 * frame <= parseFloat(cols[0]), `the box (${font * minEm + 2 * pad + 2 * frame}px) fits its ${cols[0]} column`);
  const row = rule(CSS, '.hud-renown');
  assert.match(row, /gap: 8px; height: 22px;/, 'RENOWN4b\'s 22px row, which the lifts count, and its gap');
  const bar = rule(CSS, '.hud-renown .hud-renowntrack');
  assert.equal(bar, '.hud-renown .hud-renowntrack { width: auto; height: 16px; display: flex; align-items: center; justify-content: center; }');
  const trackFrame = Number(/border: (\d+)px solid/.exec(rule(CSS, '.hud-track'))[1]);
  assert.ok(16 + 2 * trackFrame <= 22, 'the bar and its frame inside the row\'s 22px - the lifts need not move');
  const num = rule(CSS, '.hud-renownnum');
  assert.match(num, /^\.hud-renownnum \{ position: relative; z-index: 1; font-size: 11px; line-height: 1;/, 'over the fill and the ghost, and no taller than the bar');
  assert.match(num, /white-space: nowrap;/, 'one line, never two in a 16px bar');
  assert.ok(Number(/font-size: (\d+)px/.exec(num)[1]) <= 16, 'the numbers\' line (line-height 1) inside the bar');
});

test('RENOWN-BAR the numbers fit: the widest the track can say ("105,089 / 105,090 XP", level 41) fits the bar at a 320px phone - the row as wide as Plus\'s vitals, less the two outer columns and the two gaps; the probe measured Pixelify Five at 7.2px a figure (144px for those 20) (mutants: the columns widened past it)', () => {
  const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let widest = '';
  for (let L = 1; L < RENOWN_MAX; L++) {
    const need = renownXpFor(L + 1) - renownXpFor(L);
    const t = `${grouped(need - 1)} / ${grouped(need)} XP`;
    if (t.length > widest.length) widest = t;
  }
  assert.equal(widest, '105,089 / 105,090 XP');
  const plusRow = /\n\.hud-renown \{ width: calc\(3 \* min\((\d+)px, (\d+)vw\) \+ (\d+)px\); \}/.exec(PLUS_CSS);
  assert.ok(plusRow, 'Plus\'s row width');
  const [, capPx, vw, extra] = plusRow.map(Number);
  const on = rule(CSS, '.hud-renown.on');
  const side = parseFloat(/grid-template-columns: (\d+)px/.exec(on)[1]);
  const gap = Number(/gap: (\d+)px/.exec(rule(CSS, '.hud-renown'))[1]);
  for (const width of [320, 390, 1024, 1440]) {
    const rowW = 3 * Math.min(capPx, (vw / 100) * width) + extra;
    const barW = rowW - 2 * side - 2 * gap;
    assert.ok(widest.length * 7.2 <= barW, `at ${width}px the bar is ${barW.toFixed(1)}px, the widest numbers ${widest.length * 7.2}px`);
  }
});

test('RENOWN-BAR Plus\'s bar: the gold banded for 16px - the 8px bar\'s bands doubled, every band inside the bar - its lit top the vitals\' 2px, and the ghost\'s lit line the same (mutants: the bands left at 8px)', () => {
  assert.match(PLUS_CSS, /\.hud-renown \.hud-fill \{ background: linear-gradient\(180deg, #fff0b8 0 2px, #f2c46b 2px 6px, #d9a441 6px 12px, #a87a2a 12px\); \}/);
  const stops = [...PLUS_CSS.match(/\.hud-renown \.hud-fill \{ background: linear-gradient\(180deg, ([^)]*)\)/)[1].matchAll(/(\d+)px/g)].map((m) => Number(m[1]));
  assert.ok(stops.every((px) => px < 16), 'every band starts inside the 16px bar');
  assert.match(PLUS_CSS, /\.hud-renown \.hud-renowntrack \{[^}]*background: linear-gradient\(180deg, rgba\(0,0,0,0\.6\) 0 2px, transparent 2px\), #171208;/);
  assert.match(PLUS_CSS, /\.hud-renownghost \{ background: linear-gradient\(180deg, rgba\(255,240,184,0\.5\) 0 2px, rgba\(242,196,107,0\.3\) 2px\); \}/);
  assert.match(PLUS_CSS, /\.hud-renownnum \{ color: #efe8d6; text-shadow: 1px 1px 0 #050608, 2px 2px 0 rgba\(0,0,0,0\.7\); \}/, 'the vitals\' shadow keeps the numbers read over the gold and the dark alike');
});
