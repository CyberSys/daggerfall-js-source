// @ts-check
// AUDIT NAV1 (2026-09-29, the helm - Mac: "This task is to be extremely detailed, authentic and easy to use") - THE
// SHIPWRIGHT'S WINDOW: a port's yard, at the helm lying to his quay (scenes/navalHost.js yardHere). The helm audit's
// first finding was that none stood - a hurt boat stayed hurt, a wreck a wreck. Black Flag's harbour master, in
// Daggerfall's words and the stone-and-brass kit: what she wants, what each costs, and the presses that pay for it.
//
// ONE LIST, the order a captain pays in (systems/naval/navalYard.js YARD_ORDER): her HULL, her CANVAS, HANDS to her
// guns (a crewed ship's) and FIRE BARRELS (a ship with a stern that rolls them) - each row what she has of it, what is
// wanting and at what a piece, and its press: all of it, or as much as the purse pays for, or greyed with why. MAKE HER
// WHOLE pays for the four in that order - or, short, makes good what the purse will pay. The last press's word stands
// under the title. The house's shape is the plunder window's (ui/navalPlunderWindow.js - its sheet, its door, its way
// out): `mountNavalYardWindow(host, deps)` answers `{ repaint, unmount }`, and the back key and the scrim leave.
//
// deps = { model, onExit(reason) } - `model` the host's (navalHost.js yardModel): { name, ship() -> { hull, maxHull,
// sail, maxSail, crew, maxCrew, barrels, wrecked, barrelsAboard? }, offer() -> navalYard.js yardOffer's, buy(id) ->
// { ok, id, n, cost, whole, short? }, buyAll() -> { ok, cost, bought, whole }, prices, hasBarrels? }.
import { closeOnOutsideTap } from './enhancedOverlays.js';
import { overlayAction } from './input.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { injectNavalKit } from './navalHud.js';
import { injectNavalWindowStyle } from './navalPlunderWindow.js';

export const NAVAL_YARD_STYLE_ID = 'dagger-naval-yard-style';
/** The yard's own rules beside the naval windows' sheet: a row's three columns. */
export const NAVAL_YARD_CSS = `
.dfnaval-yardrow { display: grid; grid-template-columns: minmax(96px, 1fr) minmax(0, 1.4fr) auto; align-items: center; gap: 10px; white-space: normal; }
.dfnaval-yardrow b { font-weight: normal; letter-spacing: 0.08em; text-transform: uppercase; color: #efe8d6; }
.dfnaval-yardrow span { font-size: 12px; color: #b9ab93; }
.dfnaval-yardrow .dfnaval-btn { min-width: 0; font-size: 13px; padding: 4px 10px; }
@media (max-width: 560px) { .dfnaval-yardrow { grid-template-columns: 1fr; gap: 4px; } }
`;

const WORDS = Object.freeze({
  hull: { label: 'Hull', verb: 'Mend', done: 'Her hull mended', unit: (n) => `${n} ${n === 1 ? 'point' : 'points'}` },
  sail: { label: 'Canvas', verb: 'Mend', done: 'Her canvas mended', unit: (n) => `${n} ${n === 1 ? 'yard' : 'yards'}` },
  crew: { label: 'Hands', verb: 'Hire', done: 'Hands hired', unit: (n) => `${n} ${n === 1 ? 'man' : 'men'}` },
  barrels: { label: 'Fire barrels', verb: 'Buy', done: 'Fire barrels stowed', unit: (n) => `${n} ${n === 1 ? 'barrel' : 'barrels'}` },
  // SEA-REPAIR, SHIP-CREW: her provisions - carpenter's stores for her repairs at sea, and a round of grog for her crew
  stores: { label: 'Carpenter\'s stores', verb: 'Buy', done: 'Stores stowed in her hold', unit: (n) => `${n} ${n === 1 ? 'store' : 'stores'}` },
  grog: { label: 'Grog', verb: 'Stand a round', done: 'A round for the crew', unit: () => 'the crew\'s spirits lifted' },
});
/** SHIP-CREW: her crew's spirits in a word (shipCrew.js SPIRITS). */
const spiritsWord = (m) => (m >= 85 ? 'roaring' : m >= 65 ? 'high' : m >= 45 ? 'steady' : m >= 25 ? 'low' : 'grim');
const gold = (n) => `${Math.round(n).toLocaleString('en-US')} gold`;

/** The window's standing words for a model - pure, the pins' reading. */
export function yardText(model) {
  const o = model.offer();
  const sh = model.ship();
  const have = {
    hull: `${Math.floor(sh.hull)} of ${sh.maxHull}`, sail: `${Math.floor(sh.sail)} of ${sh.maxSail}`,
    crew: `${sh.crew} of ${sh.maxCrew}`, barrels: `${sh.barrels} aboard`,
  };
  const shown = (r) => (r.id === 'sail' ? sh.maxSail > 0 : r.id === 'crew' ? sh.maxCrew > 0 : r.id === 'barrels' ? model.hasBarrels !== false : true);
  const rows = o.rows.filter(shown).map((r) => {
    const w = WORDS[r.id];
    return {
      id: r.id, label: w.label,
      state: r.missing === 0 ? `${have[r.id]} - whole` : `${have[r.id]} - ${r.missing} wanting at ${gold(r.price)}`,
      press: r.missing === 0 ? 'Whole' : r.afford === 0 ? `${w.verb} - ${gold(r.price)} each`
        : r.afford === r.missing ? `${w.verb} all - ${gold(r.cost)}` : `${w.verb} ${r.afford} - ${gold(r.cost)}`,
      can: r.missing > 0 && r.afford > 0,
    };
  });
  const bill = rows.reduce((sum, r) => sum + (o.rows.find((x) => x.id === r.id)?.whole ?? 0), 0);
  let purse = o.gold, paid = 0;
  for (const r of o.rows) { if (!shown(r)) continue; const n = Math.min(r.missing, Math.floor(purse / r.price)); paid += n * r.price; purse -= n * r.price; }
  // SEA-REPAIR, SHIP-CREW: her provisions, apart from her needs - never part of making her whole
  const po = model.provisions?.() ?? null;
  const provisions = (po?.rows ?? []).map((r) => {
    const w = WORDS[r.id];
    const state = r.id === 'stores'
      ? (r.missing === 0 ? `${r.have} in her hold - her stores are full` : `${r.have} in her hold - ${r.missing} more at ${gold(r.price)} each`)
      : (r.missing === 0 ? 'Her crew\'s spirits are as high as they go' : `Her crew's spirits are ${spiritsWord(r.have)} - a round is ${gold(r.price)}`);
    return {
      id: r.id, label: w.label, state,
      press: r.missing === 0 ? (r.id === 'stores' ? 'Full' : 'No need') : r.afford === 0 ? `${w.verb} - ${gold(r.price)}${r.id === 'stores' ? ' each' : ''}`
        : r.id === 'grog' ? `${w.verb} - ${gold(r.cost)}` : r.afford === r.missing ? `${w.verb} ${r.afford} - ${gold(r.cost)}` : `${w.verb} ${r.afford} - ${gold(r.cost)}`,
      can: r.missing > 0 && r.afford > 0,
    };
  });
  return {
    provisions,
    title: 'The shipwright',
    sub: `${model.name} - your purse: ${gold(o.gold)}`,
    lede: bill === 0 ? 'She is sound from keel to masthead - there is nothing to mend.'
      : sh.wrecked ? `She came in a wreck. He can make her whole again for ${gold(bill)}.` : `He will make her whole for ${gold(bill)}.`,
    rows,
    whole: bill === 0 ? null : paid >= bill ? `Make her whole - ${gold(bill)}` : paid > 0 ? `Make good what your purse pays - ${gold(paid)}` : `Make her whole - ${gold(bill)}`,
    canWhole: paid > 0,
  };
}

/** What a press did, in a line. */
export function yardNote(result) {
  if (!result) return null;
  if (Array.isArray(result.bought)) {
    if (!result.ok) return { text: 'Your purse will not pay for a thing here.', warn: true };
    return result.whole ? { text: `She is made whole for ${gold(result.cost)}.`, warn: false } : { text: `The yard made good what your purse paid: ${gold(result.cost)}.`, warn: false };
  }
  const w = WORDS[result.id];
  if (!w) return null;
  if (!result.ok) return result.short ? { text: `Not enough gold - ${gold(result.short)} a piece.`, warn: true } : null;
  return { text: `${w.done}: ${w.unit(result.n)} for ${gold(result.cost)}.`, warn: false };
}

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
/** @param {string} text @param {string} cls @param {() => void} onPress */
const button = (text, cls, onPress) => {
  const b = /** @type {HTMLButtonElement} */ (el('button', cls, text));
  b.setAttribute('type', 'button');
  b.onclick = (e) => { e.stopPropagation(); if (!b.disabled) onPress(); };
  return b;
};
function injectYardStyle(doc = document) {
  if (doc.getElementById?.(NAVAL_YARD_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = NAVAL_YARD_STYLE_ID;
  st.textContent = NAVAL_YARD_CSS;
  (doc.head ?? doc.body).append(st);
}
const able = (b, on) => { if (on) b.removeAttribute('disabled'); else b.setAttribute('disabled', ''); };

/**
 * Mount the window in the door's host.
 * @param {HTMLElement} host
 * @param {{ model: any, onExit?: ((reason?: string) => void) | null }} deps
 * @returns {{ repaint: () => void, unmount: () => void }}
 */
export function mountNavalYardWindow(host, deps) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectNavalWindowStyle();
  injectYardStyle();
  injectNavalKit(document);
  const m = deps.model;
  const exit = (reason = 'close') => deps.onExit?.(reason);
  let note = null;
  const shell = el('div', 'dfnaval-shell');
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', 'The shipwright');
  const win = el('div', 'dfnaval-win');
  shell.append(win);
  const head = el('header', 'dfnaval-winhead');
  const title = el('div', 'dfnaval-wintitle');
  const h2 = el('h2');
  const sub = el('p', 'dfnaval-winsub');
  const noteLine = el('p', 'dfnaval-note');
  noteLine.setAttribute('aria-live', 'polite');
  title.append(h2, sub, noteLine);
  const close = button('Leave', 'dfnaval-btn dfnaval-close', () => exit('close'));
  close.style.minWidth = '0';
  head.append(title, close);
  const body = el('div', 'dfnaval-winbody');
  const lede = el('p', 'dfnaval-lede');
  const sec = el('section', 'dfnaval-sec');
  const secHead = el('h3', 'dfnaval-sechead');
  secHead.append(el('span', null, 'Her needs'), el('span', 'dfnaval-count', 'as much as your purse pays'));
  const list = el('ul', 'dfnaval-holdlist');
  const acts = el('div', 'dfnaval-acts');
  const whole = button('', 'dfnaval-btn dfnaval-take dfnaval-whole', () => { note = yardNote(m.buyAll?.()); render(); });
  acts.append(whole);
  sec.append(secHead, list, acts);
  // SEA-REPAIR, SHIP-CREW: her provisions - the stores her crew repairs her with at sea, and a round for them
  const pSec = el('section', 'dfnaval-sec');
  const pHead = el('h3', 'dfnaval-sechead');
  pHead.append(el('span', null, 'Provisions'), el('span', 'dfnaval-count', 'for the voyage'));
  const pList = el('ul', 'dfnaval-holdlist');
  pSec.append(pHead, pList);
  body.append(lede, sec, pSec);
  win.append(head, body);

  let alive = true;
  const render = () => {
    if (!alive) return;
    const t = yardText(m);
    h2.textContent = t.title;
    sub.textContent = t.sub;
    lede.textContent = t.lede;
    noteLine.textContent = note ? note.text : '';
    noteLine.className = `dfnaval-note${note?.warn ? ' warn' : ''}`;
    if (note) noteLine.removeAttribute('hidden'); else noteLine.setAttribute('hidden', '');
    for (const c of [...list.children]) c.remove();
    for (const r of t.rows) {
      const li = el('li', 'dfnaval-item dfnaval-yardrow');
      li.setAttribute('data-row', r.id);
      const press = button(r.press, 'dfnaval-btn dfnaval-yardbuy', () => { note = yardNote(m.buy?.(r.id)); render(); });
      able(press, r.can);
      li.append(el('b', null, r.label), el('span', null, r.state), press);
      list.append(li);
    }
    for (const c of [...pList.children]) c.remove();
    for (const r of t.provisions) {
      const li = el('li', 'dfnaval-item dfnaval-yardrow');
      li.setAttribute('data-row', r.id);
      const press = button(r.press, 'dfnaval-btn dfnaval-yardbuy', () => { note = yardNote(m.buyProvision?.(r.id)); render(); });
      able(press, r.can);
      li.append(el('b', null, r.label), el('span', null, r.state), press);
      pList.append(li);
    }
    pSec.style.display = t.provisions.length ? '' : 'none';
    whole.style.display = t.whole ? '' : 'none';
    whole.textContent = t.whole ?? '';
    able(whole, t.canWhole);
  };
  render();
  host.append(shell);
  (whole.style.display !== 'none' && !whole.disabled ? whole : close).focus?.({ preventScroll: true });
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (overlayAction(e) === 'back') { e.preventDefault(); e.stopPropagation(); exit('close'); }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  const offOutside = closeOnOutsideTap(shell, '.dfnaval-win', () => exit('close'));
  return {
    repaint: () => render(),
    unmount() {
      if (!alive) return;
      alive = false;
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      offOutside();
      shell.remove();
    },
  };
}
