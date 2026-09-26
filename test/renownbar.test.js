// RENOWN-BAR (2026-09-26, Mac: "with the new renown xp bar, I want to remove the xp amount on the lefthand side and
// integrate it into the bar itself, then center the bar properly"; then, having seen the numbers in a taller bar:
// "Actually lets just keep the other bar and remove the xp. Just have it visible in the player profile"): THE HUD'S
// RENOWN ROW IS THE BOX AND THE THIN BAR, AND THE BAR IS ON THE MIDDLE. RENOWN4 drew box, bar, numbers - the numbers a
// readout beside the bar, so the bar's middle stood 42px left of the vitals' (57px at the widest numbers,
// tools/renownBarProbe.mjs). Now there are no numbers on the HUD - they are the profile menu's (ui/enhancedAccount.js,
// its Renown row: "Mara Venn - Renown 10, 490 / 2,150 XP to Renown 11", renown1.test.js drives it) - the bar is
// RENOWN4's own 8px, and the row is a grid of three columns - the box, the bar and an empty column the box's width -
// so the bar's middle is the row's, and the row is as wide as the vitals' and centred under them. The probe measures it
// in Chromium (centre off 0.0px at a desktop, a laptop and a phone both ways up); these hold the markup and the sheet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renownXpFor, RENOWN_MAX, renownProgressText } from '../src/net/renown.js';
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
const words = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(words).join('')}`;

test('RENOWN-BAR the HUD, executed: the row is the box and the bar and nothing else; the bar holds its fill and its ghost and no words, at a level part-way and at the cap; the box follows the level (mutants: words back on the HUD)', async () => {
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
    assert.deepEqual(row.children.map(classes), [['hud-renownbox'], ['hud-track', 'hud-renowntrack']], 'the box and the bar: nothing beside them');
    const track = row.children[1];
    assert.deepEqual(track.children.map(classes), [['hud-fill'], ['hud-renownghost']], 'the fill and the ghost: no words in the bar');
    assert.equal(words(track), '', 'no XP on the HUD');
    assert.equal(row.children[0].textContent, '10');
    s = { level: 50, xp: renownXpFor(RENOWN_MAX) };
    drawEnhancedHud(entity, 0, 0, { weapon: null, weaponSheathed: true });
    assert.equal(words(track), '', 'nor at the cap');
    assert.equal(find(track, 'hud-fill').style.width, '100.0%', 'the cap a full bar');
    assert.equal(row.children[0].textContent, '50');
  } finally {
    destroyEnhancedHud();
    clearQuickslots();
    setHudRenown(null);
    globalThis.document = prev;
  }
});

test('RENOWN-BAR the sheet: the row lit is a grid of three columns with the outer two equal, so the bar\'s middle is the row\'s; the box fits its column; the bar RENOWN4\'s thin 8px; no rule for words in either sheet (mutants: the mirror column dropped; the row a flex again; the columns narrower than the box; the bar thick again)', () => {
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
  assert.match(rule(CSS, '.hud-renown'), /gap: 8px; height: 22px;/, 'RENOWN4b\'s 22px row, which the lifts count, and its gap');
  assert.equal(rule(CSS, '.hud-renown .hud-renowntrack'), '.hud-renown .hud-renowntrack { width: auto; height: 8px; }', 'RENOWN4\'s thin bar, kept');
  assert.equal(rule(CSS, '.hud-renown.nobar .hud-renowntrack'), '.hud-renown.nobar .hud-renowntrack { display: none; }', 'no total yet: the box alone');
  assert.doesNotMatch(CSS, /hud-renownnum/, 'no words to dress');
  assert.doesNotMatch(PLUS_CSS, /hud-renownnum/);
  assert.match(PLUS_CSS, /\.hud-renown \.hud-fill \{ background: linear-gradient\(180deg, #fff0b8 0 1px, #f2c46b 1px 3px, #d9a441 3px 6px, #a87a2a 6px\); \}/, 'Plus\'s gold, banded for the 8px bar');
});

test('RENOWN-BAR the numbers are the profile menu\'s: its Renown row says how far into the level the character is - "1,453 / 3,460 XP to Renown 13" - and the highest at the cap (mutants: the profile\'s row loses its numbers)', () => {
  assert.equal(renownProgressText(renownXpFor(12) + 1453), '1,453 / 3,460 XP to Renown 13');
  assert.equal(renownProgressText(renownXpFor(RENOWN_MAX)), 'the highest there is');
  const A = src('src/ui/enhancedAccount.js');
  assert.match(A, /row\('Renown', `\$\{typeof t\.name === 'string' && t\.name \? t\.name : 'A character'\} - Renown \$\{t\.level\}, \$\{renownProgressText\(t\.xp\)\}`\);/, 'each character\'s row: its name, its Renown and the numbers');
});
