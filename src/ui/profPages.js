// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "actual UI integration for life skills") -
// THE PROFESSIONS AND STORES PAGES of the character sheet: two pages on
// the pause window's Stats rail (ui/enhancedMenu.js), beside Character,
// Attributes and Skills - the sheet's own bones (bible/06-Systems/
// Professions-Arc.md 8, 21, 22). Online only, and only while the
// professions are this account's: the host registers its book here
// (`setProfessionsPages`), and a page with nothing behind it is never
// drawn (PX14's drawn door).
//
//   THE PROFESSIONS PAGE - the thirteen in two groups, Gathering and
//   Crafting, each a row with its rank, its rank's name and a thin bar;
//   the chosen one below: the XP to the next rank, today's harvests, the
//   specialisation cards at 50 and 100 (choose one - a change of mind
//   costs 1,000 Marks and a week, and is pressed twice), the unlocks by
//   rank, and the crafter's limit.
//   THE STORES PAGE - the materials with their counts, own and bought;
//   the families to filter by, a search, the sort; a material's action:
//   Withdraw to pack, a quantity. (Delivering to a writ is the Notice
//   Board's Work tab; listing comes with the market, PROF5.)
//
// The pages draw with the menu's own kit (its `el`, divider and meter,
// handed in), so they are the sheet's pages and not a second window.
// ═══════════════════════════════════════════════════════════════════
import {
  PROFESSIONS, SPECIALISATIONS, SPEC_RANKS, RESPEC, xpForRank, rankName, PROF_RANK_MAX, TIER_RANKS, CRAFTS_ABOVE_JOURNEYMAN,
  JOURNEYMAN_RANK, MATERIAL_FAMILIES, HARVESTS_PER_DAY, WITHDRAW_MAX, professionName,
} from '../net/professionLaw.js';
import { material } from '../net/nodeLaw.js';
import { accountRefusalText } from '../net/accountClient.js';
import { getPref, setPref } from '../systems/uiPrefs.js';

/**
 * @typedef {object} ProfPagesProvider
 * @property {any} book                                   net/profBook.js - the character's professions
 * @property {(key: string) => string} name               a material's name (systems/profItems.js materialLabel)
 * @property {(key: string, qty: number) => Promise<{ ok: boolean, text: string }>} withdraw   out of the Stores, into the pack
 */
let _provider = /** @type {ProfPagesProvider|null} */ (null);
/** The host's book, or null to take the pages down (offline, a closed switch, the host gone). */
export function setProfessionsPages(p) { _provider = p ?? null; }
/** Whether the pages stand: a book, and the professions this account's. */
export const profPagesShown = () => !!_provider && _provider.book?.state?.open === true;
/** The rail's rows the pages add. */
export const PROF_PAGE_SECTIONS = Object.freeze([Object.freeze(['professions', 'Professions']), Object.freeze(['stores', 'Stores'])]);

/** What the Professions page has chosen, and a change of specialisation pressed once (the second press buys it). */
let _sel = 'herbalism';
let _armed = null;
/** The Professions page's last refusal, said under the cards. */
let _profWord = null;
/** The Stores page's filter, search, sort, the material chosen and the quantity to withdraw. */
const _stores = { family: null, query: '', sort: 'tier', picked: null, qty: 1, word: null, busy: false };
/** A fresh visit starts plain (the menu calls it with its own reset). */
export function resetProfPages() { _armed = null; _profWord = null; _stores.word = null; _stores.picked = null; _stores.qty = 1; }

/** What the Professions page says a harvest earns for each profession PROF1 gathers, by tier. */
const UNLOCKS = Object.freeze({
  herbalism: Object.freeze([['Common herbs, and the Basket\'s food', 1], ['Uncommon herbs', 2], ['Rare herbs', 3]]),
});
const PRACTISED = Object.freeze(['herbalism']);

/** The line a track's XP makes: "11,900 / 12,250 XP" to the next rank, or the Master's total. */
export function xpLine(track) {
  if (track.rank >= PROF_RANK_MAX) return `${track.xp.toLocaleString('en-US')} XP - Master`;
  return `${track.xp.toLocaleString('en-US')} / ${xpForRank(track.rank + 1).toLocaleString('en-US')} XP`;
}
/** How many crafts stand above Journeyman (PROF0 3.2's limit). */
export const craftsAboveJourneyman = (tracks) => PROFESSIONS.filter((p) => p.kind === 'crafting' && (tracks.get(p.id)?.rank ?? 0) > JOURNEYMAN_RANK).length;

/**
 * THE PROFESSIONS PAGE.
 * @param {HTMLElement} detail @param {() => void} rerender
 * @param {{ el: Function, divider: (w: string) => HTMLElement, meter: (now: number, max: number, tone: string) => HTMLElement }} kit
 */
export function drawProfessionsPage(detail, rerender, kit) {
  const p = _provider;
  if (!p) return;
  const { el, divider, meter } = kit;
  const book = p.book;
  if (book.stale?.()) book.refresh().then(rerender, () => {});
  const cols = el('div', 'prof-cols');
  const list = el('div', 'prof-list');
  for (const group of ['gathering', 'crafting']) {
    list.append(divider(group === 'gathering' ? 'Gathering' : 'Crafting'));
    for (const prof of PROFESSIONS.filter((x) => x.kind === group)) {
      const t = book.track(prof.id);
      const row = el('button', `prof-row${prof.id === _sel ? ' on' : ''}`);
      row.type = 'button';
      row.append(el('span', 'prof-name', prof.name), el('span', 'prof-rank', `${rankName(t.rank)} ${t.rank}`));
      const floor = xpForRank(t.rank), next = xpForRank(Math.min(PROF_RANK_MAX, t.rank + 1));
      row.append(meter(t.rank >= PROF_RANK_MAX ? 1 : t.xp - floor, t.rank >= PROF_RANK_MAX ? 1 : next - floor, ''));
      row.onclick = () => { _sel = prof.id; _armed = null; rerender(); };
      list.append(row);
    }
  }
  const pane = el('div', 'prof-pane');
  const t = book.track(_sel);
  const title = el('div', 'prof-title');
  title.append(el('h3', null, professionName(_sel)), el('span', 'prof-rankline', t.rank >= PROF_RANK_MAX ? 'Master 100' : `${rankName(t.rank)}  ${t.rank} -> ${t.rank + 1}`));
  pane.append(title, el('p', 'prof-xp', xpLine(t)));
  const practised = PRACTISED.includes(_sel);
  if (!practised) pane.append(el('p', 'px-note', 'This craft is not practised in the Bay yet.'));
  if (PROFESSIONS.find((x) => x.id === _sel)?.kind === 'gathering' && practised) {
    pane.append(el('p', 'prof-today', `Today: ${book.state.today?.[_sel] ?? 0} of ${book.state.caps?.harvests ?? HARVESTS_PER_DAY} harvests`));
  }
  // THE SPECIALISATIONS: two cards a rank, the chosen one lit; a change of mind pressed twice
  for (const r of SPEC_RANKS) {
    pane.append(divider(`At ${r}`));
    const cards = el('div', 'prof-specs');
    const chosen = t.specs?.[r] ?? null;
    for (const s of SPECIALISATIONS[_sel][r]) {
      const card = el('button', `prof-spec${chosen === s.id ? ' on' : ''}${t.respec?.to === s.id && t.respec?.rank === r ? ' coming' : ''}`);
      card.type = 'button';
      card.append(el('b', null, s.name), el('span', null, s.text));
      const locked = t.rank < r || !practised;
      card.disabled = locked || chosen === s.id || !!t.respec;
      const armedHere = _armed === `${r}|${s.id}`;
      if (!locked && chosen && chosen !== s.id && !t.respec) card.append(el('i', 'prof-cost', armedHere ? `Press again: ${RESPEC.marks.toLocaleString('en-US')} Marks, in effect in ${RESPEC.days} days` : `Change: ${RESPEC.marks.toLocaleString('en-US')} Marks`));
      if (t.respec?.to === s.id && t.respec?.rank === r) card.append(el('i', 'prof-cost', `In effect from ${new Date(t.respec.at * 1000).toUTCString().slice(0, 16)}`));
      card.onclick = async () => {
        if (chosen && !armedHere) { _armed = `${r}|${s.id}`; rerender(); return; }
        _armed = null;
        const res = await book.choose(_sel, r, s.id);
        _profWord = res?.ok ? null : accountRefusalText(res?.error);
        rerender();
      };
      cards.append(card);
    }
    if (t.rank < r) cards.append(el('p', 'px-note', `Chosen at ${r}.`));
    pane.append(cards);
  }
  if (_profWord) pane.append(el('p', 'prof-word', _profWord));
  if (UNLOCKS[_sel]) {
    pane.append(divider('Unlocks'));
    for (const [what, tier] of UNLOCKS[_sel]) {
      const r = el('div', `px-stat${t.rank >= TIER_RANKS[tier - 1] ? '' : ' prof-locked'}`);
      r.append(el('span', 'k', what), el('span', 'v', `rank ${TIER_RANKS[tier - 1]}`));
      pane.append(r);
    }
  }
  pane.append(el('p', 'prof-limit', `Crafts above Journeyman: ${craftsAboveJourneyman(book.state.tracks)} of ${CRAFTS_ABOVE_JOURNEYMAN}`));
  // GENTLE ACTS (PROF0 5.1): the accessibility choice, beside the acts it changes
  const gentle = el('label', 'prof-gentle');
  const box = el('input');
  box.type = 'checkbox';
  box.checked = getPref('gentleActs') === true;
  box.onchange = () => { setPref('gentleActs', !!box.checked); rerender(); };
  gentle.append(box, document.createTextNode(' Gentle acts - every act completes plainly: no bruise, and no clean bonus'));
  pane.append(gentle);
  cols.append(list, pane);
  detail.append(cols);
}

/** The Stores' materials as the page lists them: filtered by family and search, sorted by tier, name or count. */
export function storesRows(stores, { family = null, query = '', sort = 'tier' } = {}, nameOf = (k) => k) {
  const q = String(query ?? '').trim().toLowerCase();
  const rows = [...stores.values()].map((s) => {
    const m = material(s.material);
    return { ...s, name: nameOf(s.material), family: m?.family ?? null, tier: m?.tier ?? 0, value: m?.value ?? 0, total: s.own + s.bought };
  }).filter((r) => r.total > 0 && (!family || r.family === family) && (!q || r.name.toLowerCase().includes(q)));
  const byName = (a, b) => a.name.localeCompare(b.name);
  rows.sort(sort === 'name' ? byName : sort === 'count' ? (a, b) => (b.total - a.total) || byName(a, b) : (a, b) => (a.tier - b.tier) || byName(a, b));
  return rows;
}

/**
 * THE STORES PAGE.
 * @param {HTMLElement} detail @param {() => void} rerender
 * @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
export function drawStoresPage(detail, rerender, kit) {
  const p = _provider;
  if (!p) return;
  const { el, divider } = kit;
  const book = p.book;
  if (book.stale?.()) book.refresh().then(rerender, () => {});
  const head = el('div', 'prof-storehead');
  const search = el('input', 'prof-search');
  search.type = 'search'; search.placeholder = 'Search'; search.value = _stores.query;
  search.oninput = () => {
    _stores.query = search.value;
    rerender();
    // the page is drawn anew: the search keeps the caret where the typing left it
    setTimeout(() => {
      const s = /** @type {HTMLInputElement|null} */ (detail.ownerDocument?.querySelector?.('.prof-search') ?? null);
      s?.focus?.(); s?.setSelectionRange?.(s.value.length, s.value.length);
    }, 0);
  };
  const sort = el('select', 'prof-sort');
  for (const [v, w] of [['tier', 'Sort by tier'], ['name', 'Sort by name'], ['count', 'Sort by count']]) { const o = el('option', null, w); o.value = v; if (v === _stores.sort) o.selected = true; sort.append(o); }
  sort.onchange = () => { _stores.sort = sort.value; rerender(); };
  head.append(search, sort);
  const fams = el('div', 'prof-families');
  for (const [id, word] of [[null, 'All'], ...MATERIAL_FAMILIES]) {
    const b = el('button', `prof-family${_stores.family === id ? ' on' : ''}`, word);
    b.type = 'button';
    b.onclick = () => { _stores.family = id; rerender(); };
    fams.append(b);
  }
  detail.append(divider('The Stores'), head, fams);
  const rows = storesRows(book.state.stores, _stores, p.name);
  const grid = el('div', 'prof-grid');
  if (!rows.length) grid.append(el('p', 'px-note', book.state.stores.size ? 'Nothing in the Stores matches.' : 'Your Stores are empty. What you gather online is kept here.'));
  for (const r of rows) {
    const card = el('button', `prof-mat${_stores.picked === r.material ? ' on' : ''}`);
    card.type = 'button';
    card.append(el('b', null, r.name), el('span', 'prof-count', r.total.toLocaleString('en-US')), el('span', 'prof-split', r.bought ? `${r.own} own · ${r.bought} bought` : 'own'));
    card.onclick = () => { _stores.picked = r.material; _stores.qty = Math.min(_stores.qty, r.total) || 1; _stores.word = null; rerender(); };
    grid.append(card);
  }
  detail.append(grid);
  const pick = rows.find((r) => r.material === _stores.picked);
  if (pick) {
    const bar = el('div', 'prof-matbar');
    bar.append(el('span', 'prof-matline', `${pick.name} x${pick.total} - tier ${pick.tier} - ${pick.value} Mark${pick.value === 1 ? '' : 's'} each`));
    const qty = el('input', 'prof-qty');
    qty.type = 'number'; qty.min = '1'; qty.max = String(Math.min(WITHDRAW_MAX, pick.total)); qty.value = String(Math.min(_stores.qty, pick.total, WITHDRAW_MAX));
    qty.oninput = () => { _stores.qty = Math.max(1, Math.min(WITHDRAW_MAX, pick.total, Math.floor(Number(qty.value) || 1))); };
    const go = el('button', 'act primary', _stores.busy ? 'Sending...' : 'Withdraw to pack');
    go.type = 'button';
    go.disabled = _stores.busy;
    go.onclick = async () => {
      if (_stores.busy) return;
      _stores.busy = true; rerender();
      const res = await p.withdraw(pick.material, Math.max(1, Math.min(_stores.qty, pick.total, WITHDRAW_MAX)));
      _stores.busy = false;
      _stores.word = res?.text ?? null;
      rerender();
    };
    bar.append(qty, go);
    detail.append(bar);
    detail.append(el('p', 'px-note', 'Withdrawn, a material is an item in your pack and never goes back into the Stores. Writs are delivered at a Notice Board\'s Work tab.'));
  }
  if (_stores.word) detail.append(el('p', 'prof-word', _stores.word));
}
