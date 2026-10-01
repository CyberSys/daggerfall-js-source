// @ts-check
// LOOT9 (2026-10-01, the Loot arc - bible/06-Systems/Loot-Arc.md section 11; Mac: "Do you wanna turn this into an arc
// and do all of the above?" - "spend it at the Mages Guild to reroll one affix"): THE REFORGE'S WINDOW.
//
// Two pages over the player's own pack: REFORGE - every piece the Reforge takes (a Magic or Rare piece, an Exalted
// Legendary), a row each in its tier's frame; a row pressed shows the piece whole beside the list, and each line the
// Reforge may roll again carries its own press with the price on it (or why not, in a word or two: "Need 2 more
// shards", "Not identified") - and SALVAGE - every laddered piece that will break, what it breaks into, and a press
// that asks before it breaks it ("Break it" / "Keep"). The purse (the Welkynd Shards a press may spend, the gold) and
// the last word of a press stand in the header.
//
// THE BROKER'S SHAPE (ui/brokerWindow.js): a lazy chunk the door (ui/reforgeDoor.js) mounts in its own host -
// `mountReforgeWindow(host, deps)` answers `{ repaint, unmount }` - its rows the Broker's own classes, so both skins
// dress it as they dress his (the classic skin lays the Broker's own sheet, `brokerSkinCss`). Everything the window does
// to the world is handed in: the pack, the payer, the reforge and the salvage (systems/reforge.js, which the host
// calls) - this file draws and asks, and never touches a pack.
import { rarityAttr, affixLine, reforgeableLines, RARITIES, tierLabel } from '../systems/lootRarity.js';
import { itemIsIdentified } from '../systems/tradeModes.js';
import { reforgePrice, reforgeRefusal, salvageShards, salvageRefusal, shardsHeld, shardsText } from '../systems/reforge.js';
import { inventoryItemImage } from '../systems/itemTemplates.js';
import { requestFittedIcon, fittedImg } from './textureCanvas.js';
import { SLOT_BOX, screenDpr } from './iconFit.js';
import { closeOnOutsideTap } from './enhancedOverlays.js';
import { overlayAction } from './input.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { brokerSkinCss } from './brokerWindow.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/** The window's words. */
export const REFORGE_TITLE = 'The Reforge';
export const REFORGE_SUB = 'Welkynd Shards and gold roll one line again · a piece salvaged breaks into shards';
export const REFORGE_PAGES = Object.freeze({ reforge: 'Reforge', salvage: 'Salvage' });
/** The purse: the shards a press may spend, and the gold. */
export const reforgePurseText = (shards, gold) => `${shardsText(shards)} · ${Math.max(0, gold | 0)} gold`;
/** A price, said: "4 Welkynd Shards and 400 gold". */
export const reforgePriceText = (p) => (p ? `${shardsText(p.shards)} and ${p.gold} gold` : '');
/** The whole reason a press is refused (its title), by the law's word. */
export const REFORGE_REFUSALS = Object.freeze({
  off: 'Loot rarity is off', not: 'Nothing the Reforge can roll', unknown: 'Not yet identified - the guild identifies it first',
  worn: 'Take it off first', line: 'Only the line it was reforged on', shards: 'Not enough Welkynd Shards', gold: 'Not enough gold',
  gone: 'No longer in your pack', aetheric: 'An Aetheric piece is the Broker\'s to dismantle', artifact: 'An artifact will not break',
  quest: 'A quest\'s item will not break', bound: 'Bound - it will not break', locked: 'Locked - unlock it first',
});
/** A line's press word - "Reforge", or why not in a word or two that fits the button. */
export function reforgeLabel(why, price, have) {
  if (!why) return 'Reforge';
  if (why === 'shards') return `Need ${price.shards - have.shards} more shards`;
  if (why === 'gold') return `Need ${price.gold - have.gold} more gold`;
  if (why === 'unknown') return 'Not identified';
  if (why === 'worn') return 'Worn';
  return 'Cannot';
}
/** The last word of a press. */
export const REFORGED = (name, line) => `Reforged: ${name} - ${line}.`;
export const SALVAGED = (name, n) => `Salvaged: ${name}, for ${shardsText(n)}.`;
export const BREAK_ASK = (name, n) => `Break ${name} for ${shardsText(n)}? It is gone for good.`;

/** An item's classic picture fitted to the row's box, or null while it loads (`onReady` repaints when it lands). */
function classicPicture(item, wearer, onReady) {
  const img = item ? inventoryItemImage(item, wearer ?? undefined) : null;
  return img?.archive ? requestFittedIcon(img.archive, img.record, { box: SLOT_BOX.broker, dpr: screenDpr(), dye: img.dye, dyeTarget: img.dyeTarget, onReady }) : null;
}

/** The classic skin wears the Broker's own sheet (its rows are his classes). */
const REFORGE_SKIN_STYLE_ID = 'broker-skin-style';
function injectSkinStyle(doc = document) {
  if (isEnhancedPlus() || doc.getElementById?.(REFORGE_SKIN_STYLE_ID) || [...(doc.head?.children ?? [])].some((c) => c.id === REFORGE_SKIN_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = REFORGE_SKIN_STYLE_ID;
  st.textContent = brokerSkinCss();
  (doc.head ?? doc.body).append(st);
}

/**
 * Mount the window in the door's host.
 * @param {HTMLElement} host
 * @param {{
 *   items: () => any[], payer: () => any, gold: () => number,
 *   reforge: (item: any, line: number) => { ok: boolean, reason?: string|null, line?: any },
 *   salvage: (item: any) => { ok: boolean, reason?: string|null, shards?: number },
 *   picture?: ((item: any) => any) | null, wearer?: any, nameOf?: (item: any) => string, onExit?: (() => void) | null,
 *   page?: 'reforge'|'salvage',
 * }} deps
 * @returns {{ repaint: () => void, unmount: () => void }}
 */
export function mountReforgeWindow(host, deps) {
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectSkinStyle();
  const nameOf = deps.nameOf ?? ((it) => String(it?.name ?? ''));
  const exit = () => deps.onExit?.();
  let page = deps.page === 'salvage' ? 'salvage' : 'reforge';
  let picked = null;
  let asking = null;
  /** The last press's word, and whether it was done (a refusal is read in the refusal's colour). */
  let note = null;
  const shell = el('div', 'broker-shell reforge-shell');
  shell.id = 'reforge';
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', REFORGE_TITLE);
  const win = el('div', 'broker-win');
  shell.append(win);
  const head = el('header', 'broker-head');
  const title = el('div', 'broker-title');
  const sub = el('p', 'broker-sub', REFORGE_SUB);
  const noteLine = el('p', 'broker-note');
  noteLine.setAttribute('aria-live', 'polite');
  title.append(el('h2', null, REFORGE_TITLE), sub, noteLine);
  const purse = el('span', 'broker-purse');
  const close = el('button', 'act broker-close', 'Close');
  close.setAttribute('type', 'button');
  close.onclick = (e) => { e.stopPropagation(); exit(); };
  head.append(title, purse, close);
  const tabs = el('nav', 'reforge-tabs');
  tabs.setAttribute('role', 'tablist');
  const tabOf = {};
  for (const [id, word] of Object.entries(REFORGE_PAGES)) {
    const t = el('button', 'act reforge-tab', word);
    t.setAttribute('type', 'button');
    t.setAttribute('role', 'tab');
    t.dataset.page = id;
    t.onclick = (e) => { e.stopPropagation(); page = /** @type {any} */ (id); picked = null; asking = null; render(); };
    tabOf[id] = t;
    tabs.append(t);
  }
  const body = el('div', 'broker-body');
  const list = el('ul', 'broker-offers');
  list.setAttribute('role', 'list');
  body.append(list);
  win.append(head, tabs, body);
  let card = null;
  let alive = true;
  const pressable = (row, pick) => {
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.onclick = pick;
    row.onkeydown = (e) => { if (e.target === row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault?.(); pick(); } };
  };
  const frameOf = (item, picture) => {
    const r = rarityAttr(item);
    const frame = el('span', 'broker-frame');
    if (r) frame.dataset.rarity = r;
    const tile = el('span', 'tile');
    const pic = picture?.(item) ?? null;
    if (pic && typeof pic === 'object') tile.append(fittedImg(pic));
    else if (pic) { const img = el('img'); img.setAttribute('src', pic); img.setAttribute('alt', ''); tile.append(img); } else tile.textContent = nameOf(item).split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    frame.append(tile);
    return frame;
  };
  const say = (ok, text) => { note = { ok, text }; };
  const render = () => {
    if (!alive) return;
    const items = deps.items() ?? [];
    const payer = deps.payer();
    const have = { shards: shardsHeld(items), gold: deps.gold() };
    const picture = deps.picture !== undefined ? deps.picture : (it) => classicPicture(it, deps.wearer, () => render());
    purse.textContent = reforgePurseText(have.shards, have.gold);
    noteLine.textContent = note ? note.text : '';
    noteLine.className = `broker-note${note?.ok ? ' ok' : ''}`;
    if (!note) noteLine.setAttribute('hidden', ''); else noteLine.removeAttribute?.('hidden');
    for (const [id, t] of Object.entries(tabOf)) t.setAttribute('aria-selected', id === page ? 'true' : 'false');
    for (const c of [...list.children]) c.remove();
    card?.remove();
    card = null;
    const rows = page === 'reforge'
      ? items.filter((it) => reforgePrice(it) && reforgeableLines(it).length)
      : items.filter((it) => salvageShards(it) > 0 && !['aetheric', 'artifact', 'quest', 'off'].includes(salvageRefusal(it) ?? ''));
    if (!rows.includes(picked)) picked = page === 'reforge' ? rows[0] ?? null : null;
    if (!rows.length) {
      const empty = el('li', 'broker-insignia-head reforge-empty', page === 'reforge' ? 'Nothing in your pack the Reforge takes - a Magic or Rare piece, or an Exalted Legendary.' : 'Nothing in your pack that will break - a Magic piece or better the ladder graded.');
      empty.setAttribute('role', 'presentation');
      list.append(empty);
    }
    for (const it of rows) {
      const r = rarityAttr(it);
      const row = el('li', `broker-offer${it === picked ? ' on' : ''}`);
      row.setAttribute('aria-pressed', it === picked ? 'true' : 'false');
      if (r) row.dataset.rarity = r;
      const text = el('div', 'broker-offer-body');
      text.append(el('span', 'broker-name', nameOf(it)), el('span', 'broker-set', tierLabel(it) || RARITIES[r ?? 'common']?.label || ''));
      if (page === 'reforge') {
        row.append(frameOf(it, picture), text, el('span', 'broker-price', reforgePriceText(reforgePrice(it))));
        pressable(row, () => { picked = it; render(); });
      } else {
        const n = salvageShards(it);
        const why = salvageRefusal(it);
        const btn = el('button', 'act broker-buy', why ? (why === 'worn' ? 'Worn' : why === 'locked' ? 'Locked' : 'Cannot') : asking === it ? 'Break it' : 'Salvage');
        btn.setAttribute('type', 'button');
        btn.setAttribute('aria-label', why ? `${nameOf(it)}: ${REFORGE_REFUSALS[why] ?? ''}` : asking === it ? BREAK_ASK(nameOf(it), n) : `Salvage ${nameOf(it)} for ${shardsText(n)}`);
        if (why) { btn.setAttribute('disabled', ''); btn.setAttribute('title', REFORGE_REFUSALS[why] ?? ''); }
        btn.onclick = (e) => {
          e.stopPropagation();
          if (why) return;
          if (asking !== it) { asking = it; say(false, BREAK_ASK(nameOf(it), n)); render(); return; }
          asking = null;
          const done = deps.salvage(it);
          if (done?.ok) say(true, SALVAGED(nameOf(it), done.shards ?? n)); else say(false, REFORGE_REFUSALS[done?.reason ?? ''] ?? 'It will not break.');
          render();
        };
        row.append(frameOf(it, picture), text, el('span', 'broker-price', shardsText(n)), btn);
        if (asking === it) {
          const keep = el('button', 'act broker-buy reforge-keep', 'Keep');
          keep.setAttribute('type', 'button');
          keep.onclick = (e) => { e.stopPropagation(); asking = null; note = null; render(); };
          row.append(keep);
        }
      }
      list.append(row);
    }
    if (page !== 'reforge' || !picked) return;
    // THE PIECE, WHOLE: its tier's lines, and on each line the Reforge may roll its own press
    const it = picked;
    card = el('div', 'card broker-card reforge-card');
    const r = rarityAttr(it);
    if (r) card.dataset.rarity = r;
    card.append(el('h3', null, nameOf(it)));
    const may = reforgeableLines(it);
    const price = reforgePrice(it);
    const ul = el('ul', 'rarity');
    ul.append(el('li', null, tierLabel(it)));
    if (!itemIsIdentified(it)) {   // its lines are not known yet - the guild's Identify first, and the card says nothing of them
      ul.append(el('li', null, 'Unidentified'));
      card.append(ul, el('p', 'boundline', REFORGE_REFUSALS.unknown));
      body.append(card);
      return;
    }
    (it.affixes ?? []).forEach((_, i) => {
      const li = el('li', 'reforge-line', affixLine(it, i));
      li.dataset.line = String(i);
      if (may.includes(i)) {
        const why = reforgeRefusal(it, i, payer);
        const btn = el('button', 'act broker-buy reforge-press', reforgeLabel(why, price, have));
        btn.setAttribute('type', 'button');
        btn.setAttribute('aria-label', why ? `${affixLine(it, i)}: ${REFORGE_REFUSALS[why] ?? ''}` : `Reforge ${affixLine(it, i)} for ${reforgePriceText(price)}`);
        if (why) { btn.setAttribute('disabled', ''); btn.setAttribute('title', REFORGE_REFUSALS[why] ?? ''); }
        btn.onclick = (e) => {
          e.stopPropagation();
          if (why) return;
          const done = deps.reforge(it, i);
          if (done?.ok) say(true, REFORGED(nameOf(it), affixLine(it, i))); else say(false, REFORGE_REFUSALS[done?.reason ?? ''] ?? 'The Reforge will not take that.');
          render();
        };
        li.append(btn);
      }
      ul.append(li);
    });
    card.append(ul);
    if (Number.isInteger(it.reforged)) card.append(el('p', 'boundline', 'Reforged once - only that line may be rolled again.'));
    else if (price) card.append(el('p', 'boundline', `A reforge costs ${reforgePriceText(price)}. Once a line is reforged, only it may be again.`));
    body.append(card);
  };
  render();
  host.append(shell);
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (overlayAction(e) === 'back') { e.preventDefault(); e.stopPropagation(); exit(); }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  const offOutside = closeOnOutsideTap(shell, '.broker-win', exit);
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
