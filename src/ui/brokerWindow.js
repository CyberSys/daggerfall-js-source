// @ts-check
// SET7 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md section 7; Mac: "Sigil stones become a currency to
// trade for daily reset sigil items at a new NPC vendor that stands outside the oblivion gate"): THE BROKER'S WINDOW.
//
// The day's six offers (systems/sigilBroker.js brokerStock), each a row: the piece's picture in its tier's frame with its
// set's rune (the pack's own markItemFrame), its name in its tier's colour, its set and tier, its price in Sigil Stones,
// and a Buy that says why it cannot when it cannot ("Bought", "Need 3 more" - the whole reason in its title). A row pressed shows the
// piece whole beside the list - its tier's lines, its sigil's block and its set's (the pack card's own blocks), so a
// player reads what a Dagon cuirass would do for their build before paying for it. The purse (how many stones, and how
// many of them are locked out of it) and the time to the turn of the day stand in the header, and the last word of a
// sale - bought, or why not - under them. ONLINE ONLY, and so the enhanced skin's alone (the online lane IS the enhanced
// lane, systems/onlineLane.js).
//
// THE HOUSE'S SHAPE, as the tavern's (ui/enhancedTavern.js): a lazy chunk the door (ui/brokerDoor.js) mounts in its own
// host - `mountBrokerWindow(host, deps)` answers `{ repaint, unmount }` - the back key (overlayAction's 'back': Escape,
// or a pad's) and a tap on the scrim leave through the door's own close (`deps.onExit`), never around it. Everything the
// window needs from the world is handed in: the stock and the day, the purse and the record, the sale (the host takes
// the stones, gives the piece and marks it - in that order), and the wearer whose sets the set block reads - so this
// file draws and asks, and never touches a pack.
import { rarityLines, rarityAttr, RARITIES } from '../systems/lootRarity.js';
import { brokerOfferState, BROKER_REFUSALS, offerSetName, brokerTurnsIn } from '../systems/sigilBroker.js';
import { inventoryItemImage } from '../systems/itemTemplates.js';
import { sigilCard } from './sigilCard.js';
import { setCard, markSetFrame } from './setCard.js';
import { requestIcon } from './textureCanvas.js';
import { closeOnOutsideTap } from './enhancedOverlays.js';
import { overlayAction } from './input.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
/** "5h 12m", "38m" - the time to the turn of the day. */
export function brokerTurnText(ms) {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m}m`;
}
/** "1 Sigil Stone", "3 Sigil Stones". */
export const stonesText = (n) => `${n} Sigil Stone${n === 1 ? '' : 's'}`;
/** The purse's words: the stones a sale may take, and the locked ones it may not ("3 Sigil Stones · 1 locked"). */
export const purseText = (have, locked = 0) => (locked > 0 ? `${stonesText(have)} · ${locked} locked` : stonesText(have));
/** The last word of a press: the piece bought, or why not (the law's refusals and the host's own). */
export const BROKER_SOLD = (name, price) => `You buy the ${name} for ${stonesText(price)}.`;
/** How often the window re-reads the world while it stands: the turn's clock, and a stone won or dropped meanwhile. */
export const BROKER_REPAINT_MS = 30_000;
/** The Buy's own word - "Buy", or why not in a word or two that fits the button ("Need 3 more", "Bought"); the whole
 *  reason (the law's BROKER_REFUSALS) rides its title. A sentence on the button starved the name beside it to "Ruh...". */
export function buyLabel(s) {
  if (s.ok) return 'Buy';
  if (s.reason === 'stones') return `Need ${s.price - s.have} more`;
  if (s.reason === 'bought') return 'Bought';
  return 'Gone';
}

/** An item's classic picture, or null while it loads (`onReady` repaints when it lands) - the pack's own door. */
function classicPicture(item, onReady) {
  const img = item ? inventoryItemImage(item) : null;
  return img?.archive ? requestIcon(img.archive, img.record, { scale: 2, dye: img.dye, onReady }) : null;
}

/**
 * Mount the window in the door's host.
 * @param {HTMLElement} host
 * @param {{
 *   stock: () => any[], day: () => number, now: () => number, items: () => any[], bought: () => string[],
 *   buy: (offer: any) => { ok: boolean, reason?: string|null, text?: string|null },
 *   locked?: (() => number) | null, picture?: ((item: any) => string|null) | null,
 *   wearer?: any, nameOf?: (item: any) => string, onExit?: (() => void) | null,
 * }} deps
 * @returns {{ repaint: () => void, unmount: () => void }}
 */
export function mountBrokerWindow(host, deps) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  const nameOf = deps.nameOf ?? ((it) => String(it?.name ?? ''));
  const exit = () => deps.onExit?.();
  let pickedSlot = 0;
  /** The last press's word, and whether it was a sale (a refusal is read in the refusal's colour). */
  let note = null;
  const shell = el('div', 'broker-shell');
  shell.id = 'sigil-broker';
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', 'The Sigil Broker');
  const win = el('div', 'broker-win');
  shell.append(win);
  let alive = true;
  const render = () => {
    if (!alive) return;
    const offers = deps.stock();
    const state = { items: deps.items(), bought: deps.bought(), day: deps.day() };
    const picture = deps.picture !== undefined ? deps.picture : (it) => classicPicture(it, render);
    for (const c of [...win.children]) c.remove();
    // the header: who, what they take, the purse, the turn of the day, the last word
    const head = el('header', 'broker-head');
    const title = el('div', 'broker-title');
    title.append(el('h2', null, 'The Sigil Broker'), el('p', 'broker-sub', `Sigil Stones buy the day's stock · it turns in ${brokerTurnText(brokerTurnsIn(deps.now()))}`));
    if (note) title.append(el('p', `broker-note${note.ok ? ' ok' : ''}`, note.text));
    const purse = el('span', 'broker-purse', purseText(brokerOfferState(null, state).have, deps.locked?.() ?? 0));
    const close = el('button', 'act broker-close', 'Close');
    close.setAttribute('type', 'button');
    close.onclick = (e) => { e.stopPropagation(); exit(); };
    head.append(title, purse, close);
    win.append(head);
    const body = el('div', 'broker-body');
    const list = el('ul', 'broker-offers');
    list.setAttribute('role', 'list');
    for (const o of offers) {
      const s = brokerOfferState(o, state);
      const row = el('li', `broker-offer${o.slot === pickedSlot ? ' on' : ''}${s.ok ? '' : ` no-${s.reason}`}`);
      row.dataset.slot = String(o.slot);
      const r = rarityAttr(o.item);
      if (r) row.dataset.rarity = r;
      const tile = el('span', 'tile');
      const pic = picture?.(o.item) ?? null;
      if (pic) { const img = el('img'); img.setAttribute('src', pic); img.setAttribute('alt', ''); tile.append(img); } else tile.textContent = nameOf(o.item).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      const frame = el('span', 'broker-frame');
      if (r) frame.dataset.rarity = r;
      markSetFrame(frame, o.item);
      frame.dataset.sigil = '';
      frame.append(tile);
      const text = el('div', 'broker-offer-body');
      text.append(el('span', 'broker-name', nameOf(o.item)), el('span', 'broker-set', `${offerSetName(o)} · ${RARITIES[r ?? 'common']?.label ?? ''}`));
      const price = el('span', 'broker-price', stonesText(o.price));
      const buy = el('button', 'act broker-buy', buyLabel(s));
      buy.setAttribute('type', 'button');
      if (!s.ok) { buy.setAttribute('disabled', ''); buy.setAttribute('title', BROKER_REFUSALS[s.reason] ?? ''); }
      buy.onclick = (e) => {
        e.stopPropagation();
        const done = deps.buy(o);
        note = done?.ok ? { ok: true, text: BROKER_SOLD(nameOf(o.item), o.price) } : { ok: false, text: done?.text ?? BROKER_REFUSALS[done?.reason] ?? 'The Broker will not sell that.' };
        pickedSlot = o.slot;
        render();
      };
      row.append(frame, text, price, buy);
      row.onclick = () => { pickedSlot = o.slot; render(); };
      list.append(row);
    }
    body.append(list);
    // the piece, whole: its tier's lines, its sigil, its set
    const o = offers.find((x) => x.slot === pickedSlot) ?? offers[0];
    if (o) {
      const card = el('div', 'card broker-card');
      const r = rarityAttr(o.item);
      if (r) card.dataset.rarity = r;
      card.append(el('h3', null, nameOf(o.item)));
      const lines = rarityLines(o.item, { sigil: false, set: false });
      if (lines.length) { const ul = el('ul', 'rarity'); for (const l of lines) ul.append(el('li', null, l)); card.append(ul); }
      const sb = sigilCard(o.item);
      if (sb) card.append(sb);
      const set = setCard(o.item, deps.wearer ?? null, nameOf);
      if (set) card.append(set);
      body.append(card);
    }
    win.append(body);
  };
  render();
  host.append(shell);
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (overlayAction(e) === 'back') { e.preventDefault(); e.stopPropagation(); exit(); }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  const offOutside = closeOnOutsideTap(shell, '.broker-win', exit);
  const tick = setInterval(render, BROKER_REPAINT_MS);
  /** @type {any} */ (tick)?.unref?.();   // a page never waits on it (node's timers would hold a process open)
  return {
    repaint: render,
    unmount() {
      if (!alive) return;
      alive = false;
      clearInterval(tick);
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      offOutside();
      shell.remove();
    },
  };
}
