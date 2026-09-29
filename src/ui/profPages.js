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
//   Board's Work tab; listing comes with the market, PROF5.) PROF2: THE
//   FORGE under it - the smelts, while the player stands at a forge (a
//   Weaponsmith's or an Armorer's, its fee a smelt; a home's forge).
//   PROF3: THE ANVIL beside it. PROF4: the Forge burns logs to Charcoal,
//   and THE WORKBENCH - the saws and Carpentry's recipes, with the plane
//   - while the player stands at one (a Furniture Store's, its fee a
//   craft or a saw; a home's workbench).
//
// The pages draw with the menu's own kit (its `el`, divider and meter,
// handed in), so they are the sheet's pages and not a second window.
// ═══════════════════════════════════════════════════════════════════
import {
  PROFESSIONS, SPECIALISATIONS, SPEC_RANKS, RESPEC, xpForRank, rankName, PROF_RANK_MAX, TIER_RANKS, CRAFTS_ABOVE_JOURNEYMAN,
  JOURNEYMAN_RANK, MATERIAL_FAMILIES, HARVESTS_PER_DAY, WITHDRAW_MAX, professionName, SMELT_RECIPES, SMELT_MAX, FORGE_FEE,
  withdrawable, stockOf, STOCK_MAX, BURN_RECIPES, SAW_RECIPES, WORKBENCH_FEE, WOODS, workPer,
} from '../net/professionLaw.js';
import {
  RECIPES, recipeOpen, qualityOdds, QUALITY_NAMES, HEAT_ACT, takesQuality, recipeInputs, takesHeartwood, PLANE_ACT,
} from '../net/recipeLaw.js';
import { isTextEntryTarget, isDomControlTarget } from './input.js';   // AUDIT 30 A9: a field's keys and a button's are their own
import { createHeatAct } from '../systems/heatAct.js';
import { createPlaneAct } from '../systems/planeAct.js';
import { material } from '../net/nodeLaw.js';
import { accountRefusalText } from '../net/accountClient.js';
import { getPref, setPref } from '../systems/uiPrefs.js';
import { isEnhanced } from '../systems/uiSkin.js';

/**
 * @typedef {object} ProfPagesProvider
 * @property {any} book                                   net/profBook.js - the character's professions
 * @property {(key: string) => string} name               a material's name (systems/profItems.js materialLabel)
 * @property {(key: string, qty: number) => Promise<{ ok: boolean, text: string }>} withdraw   out of the Stores, into the pack
 * @property {() => ({ kind: 'shop'|'home', fee: number }|null)} [forge]   PROF2: the forge the player stands at, or null
 * @property {(recipe: string, count: number) => Promise<{ ok: boolean, text: string }>} [smelt]   PROF2: a smelt, its fee paid
 * @property {() => Promise<any>} [settle]   AUDIT 29 C4: the kept withdrawals asked again (the Stores page opened)
 * @property {(recipe: string, opts: { clean: boolean, heartwood?: boolean }) => Promise<{ ok: boolean, text: string }>} [craft]
 *   PROF3: a craft at the anvil (PROF4: or the workbench, by the recipe's profession), its pieces made and its fee paid
 * @property {(material: string, qty: number) => Promise<{ ok: boolean, text: string }>} [stock]   PROF3: the smith's stock
 *   (PROF4: and the furnisher's)
 * @property {() => number} [heatBand]   PROF3: the heat's attribute band (recipeLaw heatBand)
 * @property {() => ({ kind: 'shop'|'home', fee: number }|null)} [workbench]   PROF4: the workbench the player stands at
 * @property {() => number} [planeBand]   PROF4: the plane's attribute band (recipeLaw planeBand)
 * @property {() => number} [purse]   AUDIT 30 U13: the gold the player carries - a station's fee the purse cannot meet is
 *   not offered (the heat was struck, and then the smith refused)
 */
let _provider = /** @type {ProfPagesProvider|null} */ (null);
/** The host's book, or null to take the pages down (offline, a closed switch, the host gone). */
export function setProfessionsPages(p) { _provider = p ?? null; }
/** What a locked specialisation's card says it waits for (professionLaw.js `later`). */
const LATER_WORDS = Object.freeze({ PROF2b: 'Comes with the Motherlodes', SEAT2: 'Comes with the sieges' });
/** Whether the pages stand: a book, and the professions this account's. */
export const profPagesShown = () => !!_provider && _provider.book?.state?.open === true;
/** AUDIT 29 B2: whether a Forge works here - the professions the account's (the pages shown) and the Enhanced pause
 *  menu, the one the Stores page is on (the classic skin's pause has no pages - FLAGGED). A home's Forge station is
 *  offered, and sold, only while it does: its 50,000 gold bought a piece that did nothing offline, for an account the
 *  switch had not opened to, and on the classic skin. */
export const forgeOffered = () => profPagesShown() && isEnhanced();
/** What a Forge station says when it cannot be worked here. */
export const FORGE_COLD_LINE = 'The forge is cold. Smelting is done online, from your Stores, on the Enhanced pause menu\'s Stores page.';
/** PROF4 (bible/06-Systems/Professions-Arc.md 25): the home stations the Stores page works - the forge and the workbench -
 *  offered, sold and worked only where it is (forgeOffered's gate, AUDIT 29 B2). */
export const PROF_STATIONS = Object.freeze(['forge', 'workbench']);
export const WORKBENCH_COLD_LINE = 'The workbench is bare. Carpentry is done online, from your Stores, on the Enhanced pause menu\'s Stores page.';
export const stationColdLine = (station) => (station === 'workbench' ? WORKBENCH_COLD_LINE : FORGE_COLD_LINE);
/** The rail's rows the pages add. */
export const PROF_PAGE_SECTIONS = Object.freeze([Object.freeze(['professions', 'Professions']), Object.freeze(['stores', 'Stores'])]);

/** What the Professions page has chosen, and a change of specialisation pressed once (the second press buys it). */
let _sel = 'herbalism';
let _armed = null;
/** The Professions page's last refusal, said under the cards. */
let _profWord = null;
/** The Stores page's filter, search, sort, the material chosen and the quantity to withdraw. */
const _stores = { family: null, query: '', sort: 'tier', picked: null, qty: 1, word: null, busy: false, settledAt: -Infinity };
/** PROF2: the forge's counts by recipe, a smelt in flight, and its last word. */
const _forge = { counts: /** @type {Record<string, number>} */ ({}), busy: false, word: /** @type {string|null} */ (null) };
/** PROF3: the anvil's family and metal shown, the recipe chosen, the heat being struck, a craft in flight and its word. */
const _anvil = {
  family: 'weapons', metal: 'ingot:iron', picked: /** @type {string|null} */ (null), act: /** @type {any} */ (null),
  busy: false, word: /** @type {string|null} */ (null), els: /** @type {any} */ (null), off: /** @type {(() => void)|null} */ (null),
  strike: /** @type {(() => void)|null} */ (null), heartwood: false,
  /** AUDIT 30 A3: the recipe the heat under way makes, and its Heartwood - what the page shows may not be */
  actRecipe: /** @type {string|null} */ (null), actWood: false,
};
/** PROF4: the workbench's family and wood shown, the recipe chosen, the plane being drawn, a craft in flight, its word,
 *  the saws' counts and whether a Heartwood stands in for a plank. */
const _bench = {
  family: 'staves', wood: 'plank:pine', picked: /** @type {string|null} */ (null), act: /** @type {any} */ (null),
  busy: false, word: /** @type {string|null} */ (null), counts: /** @type {Record<string, number>} */ ({}), heartwood: false,
  actRecipe: /** @type {string|null} */ (null), actWood: false,   // AUDIT 30 A3: the plane's own recipe
};
/** AUDIT 30 U20: the one row a smelt, burn or saw is under way on - its button alone says so. */
let _workingOn = /** @type {string|null} */ (null);
/** AUDIT 30 U13: a station's fee the purse cannot meet - its words, or null. */
function purseShort(station, who, per) {
  const p = _provider;
  if (!station || station.kind !== 'shop' || !(station.fee > 0) || typeof p?.purse !== 'function') return null;
  const have = p.purse();
  return have < station.fee ? `The ${who} asks ${station.fee} gold ${per}; you carry ${have}.` : null;
}
/** What a Stores material of the smith's stock says in place of a withdrawal. */
export const STOCK_STAYS_LINE = 'It stays at the bench: the anvil and the workbench spend it, and it comes to the pack once its own craft is practised.';   // PROF4: Cured Leather and Linen, the counters' goods with no pack form yet
/** A fresh visit starts plain (the menu calls it with its own reset). */
export function resetProfPages() {
  _armed = null; _profWord = null; _stores.word = null; _stores.picked = null; _stores.qty = 1; _forge.word = null; _forge.counts = {};
  endHeat(); _anvil.word = null; _anvil.picked = null; _anvil.heartwood = false;
  _bench.act?.cancel(); _bench.act = null; _bench.actRecipe = null; _bench.word = null; _bench.picked = null; _bench.counts = {}; _bench.heartwood = false;   // PROF4
}

/** What the Professions page says a harvest earns for each profession PROF1 gathers, by tier. */
const UNLOCKS = Object.freeze({
  herbalism: Object.freeze([['Common herbs, and the Basket\'s food', 1], ['Uncommon herbs', 2], ['Rare herbs', 3]]),
  // PROF2: the metals by their tiers (PROF0 4.1), the stone and the dungeons' deep veins
  mining: Object.freeze([['Iron, Tin, Copper, Lead, Sulphur; quarrying', 1], ['Lodestone, Mercury', 2], ['Silver; the dungeons\' deep veins', 3],
    ['Gold, Moonstone, Dwarven Scrap', 4], ['Platinum, Mithril', 5], ['Adamantium, Ebony, Orichalcum', 6]]),
  // PROF4: the woods by their tiers (PROF0 4.2); Smithing's metals and Carpentry's woods by theirs
  logging: Object.freeze([['Pine', 1], ['Oak', 2], ['Cherry', 3], ['Teak', 4], ['Mahogany', 5], ['Ironwood, Ghostwood', 6]]),
  smithing: Object.freeze([['Iron; the Wood-Axe, Pick-Axe and Sickle', 1], ['Steel; the chain; the Spade', 2],   // AUDIT 30 U19: the Spade is rank 10's ['Silver', 3], ['Elven, Dwarven', 4], ['Mithril', 5],
    ['Adamantium, Ebony, Orcish; Warforged', 6], ['Daedric', 7]]),
  carpentry: Object.freeze([['Pine: staves, bows, arrows, the Basket, a plain single bed', 1], ['Oak: tables, chairs, a plain double bed', 2],
    ['Cherry: a fancy single bed', 3], ['Teak: a fancy double bed', 4], ['Mahogany', 5], ['Ironwood, Ghostwood: staves and bows', 6]]),
});
/** PROF4 (FOUND): Smithing was practised from PROF3 and the page never said so - its cards stood locked. */
const PRACTISED = Object.freeze(['herbalism', 'mining', 'logging', 'smithing', 'carpentry']);
/** A craft practised in part - what raises it now (none since PROF4: Smithing's is whole). */
const PARTLY = Object.freeze({});

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
/** AUDIT 29 C1: a stale state read again - the page drawn again only once a NEW read has answered. The book hands a
 *  read inside its backoff the last answer at once, and redrawing on that drew, found it stale and asked again: a
 *  loop of draws that starved the tab. */
function readStale(book, rerender) {
  if (!book.stale?.()) return;
  const before = book.state.readAt;
  book.refresh().then(() => { if (book.state.readAt !== before) rerender(); }, () => {});
}
export function drawProfessionsPage(detail, rerender, kit) {
  const p = _provider;
  if (!p) return;
  const { el, divider, meter } = kit;
  const book = p.book;
  readStale(book, rerender);
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
  if (!practised) pane.append(el('p', 'px-note', PARTLY[_sel] ?? 'This profession is not practised in the Bay yet.'));
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
      const locked = t.rank < r || !practised || !!s.later;   // AUDIT 29 A17: a choice whose slice is to come is named, never chosen
      card.disabled = locked || chosen === s.id || !!t.respec;
      if (s.later) card.append(el('i', 'prof-cost', LATER_WORDS[s.later] ?? 'Comes with a later work'));
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
  gentle.append(box, document.createTextNode(' Gentle acts - every act completes plainly: no bruise, no glint to find, and no clean bonus'));
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
  readStale(book, rerender);
  // AUDIT 29 C4: a withdrawal kept (its answer lost) is asked again when the Stores are opened - not only at the next read
  // PROF5 (FOUND): a kept craft settles too - `pendingCrafts` had no reader, so a craft whose answer was lost waited for an
  // unrelated withdrawal
  if ((book.pendingWithdrawals || book.pendingCrafts) && p.settle && Date.now() - _stores.settledAt > 30_000) { _stores.settledAt = Date.now(); p.settle().then(rerender, () => {}); }
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
    go.disabled = _stores.busy || !withdrawable(pick.material);   // PROF3: the smith's stock stays at the bench
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
    detail.append(el('p', 'px-note', withdrawable(pick.material)
      ? 'Withdrawn, a material is an item in your pack and never goes back into the Stores. Writs are delivered at a Notice Board\'s Work tab.'
      : STOCK_STAYS_LINE));
  }
  if (_stores.word) detail.append(el('p', 'prof-word', _stores.word));
  drawForge(detail, rerender, kit);
  drawAnvil(detail, rerender, kit);   // PROF3
  drawWorkbench(detail, rerender, kit);   // PROF4
}

/** What the Stores make of a recipe now: the most it can smelt (every input's units over its need), to SMELT_MAX. */
export function smeltable(r, held) {
  let n = SMELT_MAX;
  for (const inp of r.inputs) n = Math.min(n, Math.floor(held(inp.key) / inp.n));
  return Math.max(0, n);
}

/**
 * A forge's or a workbench's rows of no-act work (PROF2's smelts; PROF4's burns and saws): each recipe's inputs as the
 * Stores hold them, how many it can make, a count and its button - its yield a unit said where it is more than one.
 */
function workRows(detail, rerender, el, recipes, state, verb, busyVerb, go, short = null) {
  const p = /** @type {ProfPagesProvider} */ (_provider);
  const book = p.book;
  const held = (k) => book.held(k);
  const specs100 = Object.fromEntries(PROFESSIONS.map((x) => [x.id, book.track(x.id)?.specs?.[100] ?? null]));
  for (const r of recipes) {
    const most = smeltable(r, held);
    const row = el('div', `prof-smelt${most ? '' : ' prof-locked'}`);
    const per = workPer(r, specs100);
    const ins = r.inputs.map((inp) => `${inp.n} ${p.name(inp.key)} (${held(inp.key)})`).join(' + ');
    row.append(el('b', null, `${p.name(r.out)}${per > 1 ? ` x${per}` : ''}`), el('span', 'prof-split', ins));
    const qty = el('input', 'prof-qty');
    qty.type = 'number'; qty.min = '1'; qty.max = String(Math.max(1, most));
    qty.value = String(Math.max(1, Math.min(state.counts[r.id] ?? 1, Math.max(1, most))));
    qty.oninput = () => { state.counts[r.id] = Math.max(1, Math.min(SMELT_MAX, Math.floor(Number(qty.value) || 1))); };
    const b = el('button', 'act', state.busy && _workingOn === r.id ? busyVerb : verb);
    b.type = 'button';
    b.disabled = state.busy || most < 1 || !!short;
    b.onclick = async () => {
      if (state.busy) return;
      state.busy = true; _workingOn = r.id; rerender();
      const res = await go(r.id, Math.max(1, Math.min(state.counts[r.id] ?? 1, smeltable(r, held))));
      state.busy = false; _workingOn = null;
      state.word = res?.text ?? null;
      rerender();
    };
    row.append(qty, b);
    detail.append(row);
  }
}

/**
 * PROF2: THE FORGE (bible/06-Systems/Professions-Arc.md 4.1, 23) - under the Stores, the smelts: each recipe's inputs
 * as the Stores hold them, how many it can make, a count and Smelt; PROF4: and the logs burnt to Charcoal. Only at a
 * forge: a Weaponsmith's or an Armorer's, whose use fee is paid a smelt, or the player's own home forge.
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
function drawForge(detail, rerender, { el, divider }) {
  const p = _provider;
  if (!p?.forge || !p.smelt) return;
  const book = p.book;
  const forge = p.forge();
  detail.append(divider('The Forge'));
  if (!forge) {
    detail.append(el('p', 'px-note', `Smelting is done at a forge: a Weaponsmith's or an Armorer's (${FORGE_FEE} gold a smelt), or your own home's forge.`));
    return;
  }
  detail.append(el('p', 'px-note', forge.kind === 'shop' ? `The smith's forge - ${forge.fee} gold a smelt.` : 'Your forge.'));
  const short = purseShort(forge, 'smith', 'a smelt');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  workRows(detail, rerender, el, SMELT_RECIPES, _forge, 'Smelt', 'Smelting...', (id, n) => p.smelt(id, n), short);
  // PROF4: the logs a forge burns - those the Stores hold (a log a Charcoal; a Charcoal Burner's two)
  const burns = BURN_RECIPES.filter((r) => book.held(r.inputs[0].key) > 0);
  if (burns.length) workRows(detail, rerender, el, burns, _forge, 'Burn', 'Burning...', (id, n) => p.smelt(id, n), short);
  if (r0Charcoal(book)) detail.append(el('p', 'px-note', 'Steel wants Charcoal: a log burns to it here (Logging\'s), and the smith sells it.'));
  if (_forge.word) detail.append(el('p', 'prof-word', _forge.word));
}
/** Whether the Steel line needs its word: no Charcoal held. */
const r0Charcoal = (book) => book.held('wood:charcoal') < 1;

// ─── PROF3: THE ANVIL (bible/06-Systems/Professions-Arc.md 9, 24) ─────

/** The anvil's families, in its row's order, and the metals a family is made in. */
export const ANVIL_FAMILIES = Object.freeze([['weapons', 'Weapons'], ['armour', 'Armour'], ['tools', 'Tools'], ['kits', 'Repair Kits']]);
const METAL_ROW = Object.freeze([
  ['ingot:iron', 'Iron'], ['ingot:steel', 'Steel'], ['ingot:silver', 'Silver'], ['ingot:moonstone', 'Elven'], ['ingot:dwarven', 'Dwarven'],
  ['ingot:mithril', 'Mithril'], ['ingot:adamantium', 'Adamantium'], ['ingot:ebony', 'Ebony'], ['ingot:orichalcum', 'Orcish'],
  ['ingot:daedric', 'Daedric'], ['ingot:warforged', 'Warforged'],
]);
/** The recipes the anvil lists for a family at a metal (the tools are Iron's alone; the chain is Steel's). */
export const anvilRecipes = (family, metal) => RECIPES.filter((r) => r.profession === 'smithing' && r.family === family && (family === 'tools' || r.metal === metal));
/** PROF4: what a craft spends as this character would spend it - a Joiner's half the planks, a Heartwood for one. */
const spendsOf = (r, book, heartwood) => recipeInputs(r, { heartwood: heartwood && takesHeartwood(r), joiner: book.track(r.profession)?.specs?.[50] === 'joiner' });
/** Whether the Stores make a recipe now - its inputs, or (PROF4) what it would spend (`inputs`). */
export const craftable = (r, held, inputs = r.inputs) => inputs.every((inp) => held(inp.key) >= inp.n);

/** The heat let go: its loop and its keys. */
function endHeat() {
  _anvil.off?.();
  _anvil.off = null;
  _anvil.strike = null;
  _anvil.act = null;
  _anvil.els = null;
  _anvil.actRecipe = null; _anvil.actWood = false;
}
/** The heat's frame: the glow ticked, its bar drawn, the act ended when the page is gone; the craft asked on the third
 *  strike. */
function heatLoop(rerender, finish) {
  const raf = globalThis.requestAnimationFrame?.bind(globalThis) ?? ((fn) => setTimeout(() => fn(Date.now()), 16));
  const caf = globalThis.cancelAnimationFrame?.bind(globalThis) ?? clearTimeout;
  let last = null, id = 0, live = true, inStep = false;
  const reduced = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const clock = () => globalThis.performance?.now?.() ?? Date.now();
  // the next frame - never inside this one (a frame source that answers at once, as a test's does, is a timer's then)
  const next = () => { id = raf(() => { if (inStep) setTimeout(step, 16); else step(); }); };
  const step = () => {
    if (!live || !_anvil.act) return;
    inStep = true;
    try {
      const els = _anvil.els;
      if (!els?.bar || els.bar.isConnected === false) { _anvil.act.cancel(); endHeat(); return; }   // the page shut under the act: nothing spent
      const t = clock();
      const dt = last == null ? 0 : Math.min(0.1, (t - last) / 1000);
      last = t;
      _anvil.act.tick(dt);
      const g = _anvil.act.glow;
      els.marker.style.left = `${(g * 100).toFixed(1)}%`;
      if (!reduced) els.bar.style.setProperty?.('--heat', g.toFixed(3));
      els.bar.classList.toggle('prof-inband', _anvil.act.inBand);
      next();
    } finally { inStep = false; }
  };
  const strike = () => {
    const a = _anvil.act;
    if (!a) return;
    const hit = a.strike();
    if (hit == null) return;
    _anvil.els?.marks?.[a.state.strikes.length - 1]?.classList.add(hit ? 'hit' : 'miss');
    if (a.state.done) { const clean = a.report().clean; endHeat(); finish(clean); }
  };
  const key = (e) => {
    if (isTextEntryTarget(e.target) || isDomControlTarget(e.target)) return;   // AUDIT 30 A9: a field's Space, a button's Enter
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter') { e.preventDefault?.(); e.stopPropagation?.(); strike(); }
  };
  globalThis.document?.addEventListener?.('keydown', key, true);
  // AUDIT 31: the first frame once the page that drew the heat is in the document - a frame source that answers at once
  // (a test's) ran it inside the draw, and a bar not yet attached read as "the page shut under the act"
  Promise.resolve().then(() => { if (live) next(); });
  _anvil.off = () => { live = false; caf(id); globalThis.document?.removeEventListener?.('keydown', key, true); };
  return strike;
}

/**
 * PROF3: THE ANVIL - beside the forge (section 24: the anvil stands wherever the forge does), named and not pictured: the
 * families and the metals, each recipe with its inputs as the Stores hold them, the rank it asks and the odds the smith's
 * margin rolls on; the smith's stock where a fitting is short (a smith's forge alone); Craft (the heat) and Quick craft.
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
function drawAnvil(detail, rerender, { el, divider }) {
  const p = _provider;
  if (!p?.forge || !p.craft) return;
  const book = p.book;
  const forge = p.forge();
  detail.append(divider('The Anvil'));
  if (!forge) {
    endHeat();
    detail.append(el('p', 'px-note', `Smithing is done at an anvil, beside a forge: a Weaponsmith's or an Armorer's (${FORGE_FEE} gold a craft), or your own home's forge.`));
    return;
  }
  const rank = book.track('smithing')?.rank ?? 0;
  const specs = book.track('smithing')?.specs ?? {};
  detail.append(el('p', 'px-note', `${forge.kind === 'shop' ? `The smith's anvil - ${forge.fee} gold a craft.` : 'Your anvil.'} Smithing ${rank} (${rankName(rank)}).`));
  const short = purseShort(forge, 'smith', 'a craft');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  // AUDIT 30 A2: Gentle acts switched on under a heat lets it cool - nothing is spent, and the craft is a plain one
  if (_anvil.act && getPref('gentleActs') === true) { _anvil.act.cancel(); endHeat(); _anvil.word = 'You let the ingot cool; nothing is spent.'; }
  // AUDIT 30 A3: nothing else is picked while the heat is struck - the heat makes the recipe it began on
  const striking = !!_anvil.act;
  const held = (k) => book.held(k);
  const fams = el('div', 'prof-families');
  for (const [id, word] of ANVIL_FAMILIES) {
    const b = el('button', `prof-family${_anvil.family === id ? ' on' : ''}`, word);
    b.type = 'button';
    b.disabled = striking;
    b.onclick = () => { _anvil.family = id; _anvil.picked = null; rerender(); };
    fams.append(b);
  }
  detail.append(fams);
  if (_anvil.family !== 'tools') {
    const metals = el('div', 'prof-families prof-metals');
    for (const [id, word] of METAL_ROW) {
      if (_anvil.family === 'kits' && id === 'ingot:warforged') continue;
      const b = el('button', `prof-family${_anvil.metal === id ? ' on' : ''}`, word);
      b.type = 'button';
      b.disabled = striking;
      b.onclick = () => { _anvil.metal = id; _anvil.picked = null; rerender(); };
      metals.append(b);
    }
    detail.append(metals);
  }
  const list = anvilRecipes(_anvil.family, _anvil.metal);
  for (const r of list) {
    const open = recipeOpen(r, rank);
    const can = open && craftable(r, held, spendsOf(r, book, false));
    const row = el('button', `prof-recipe${_anvil.picked === r.id ? ' on' : ''}${can ? '' : ' prof-locked'}`);
    row.type = 'button';
    row.disabled = striking;
    row.append(el('b', null, r.name), el('span', 'prof-split', open ? (can ? 'can make now' : 'wants its inputs') : `rank ${r.rank}`));
    row.onclick = () => { _anvil.picked = r.id; rerender(); };
    detail.append(row);
  }
  const r = list.find((x) => x.id === _anvil.picked);
  if (r) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, `${r.name} - rank ${r.rank}`));
    const spends = spendsOf(r, book, _anvil.heartwood);
    for (const inp of spends) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, `${p.name(inp.key)} ${Math.min(have, inp.n)} / ${inp.n} (${have} stored)`));
      const sale = stockOf(inp.key);
      if (sale && have < inp.n && forge.kind === 'shop' && p.stock) {
        const need = inp.n - have;
        const buy = el('button', 'act', `Buy ${need} from the smith - ${sale.marks * need} Marks`);
        buy.type = 'button';
        buy.disabled = _anvil.busy;
        buy.onclick = async () => {
          if (_anvil.busy) return;
          _anvil.busy = true; rerender();
          const res = await p.stock(inp.key, Math.min(STOCK_MAX, need));
          _anvil.busy = false; _anvil.word = res?.text ?? null; rerender();
        };
        line.append(buy);
      }
      box.append(line);
    }
    if (takesQuality(r) && recipeOpen(r, rank)) {
      const odds = qualityOdds(rank - r.rank, { masterwright: specs[100] === 'masterwright' });
      box.append(el('p', 'px-note', `Your rank ${rank}, margin ${rank - r.rank}: ${odds.map((o, q) => (o ? `${QUALITY_NAMES[q]} ${o}` : null)).filter(Boolean).join(' | ')}. A clean heat is a step better.`));
    } else if (!takesQuality(r)) box.append(el('p', 'px-note', 'A Repair Kit mends a quarter of a piece\'s condition, once - a weapon or armour of its metal.'));
    heartwoodToggle(box, el, r, book, _anvil, rerender, striking);   // PROF4: a Heartwood for a plank - the axes, hammers, shields, the Spade
    const gentle = getPref('gentleActs') === true;
    const ready = recipeOpen(r, rank) && craftable(r, held, spends) && !_anvil.busy && !_anvil.act && !short;
    // AUDIT 30 A3: a craft bound to its recipe and its Heartwood when the heat began, never to the page's pick at its end
    const craftOf = (id, wood) => async (clean) => {
      _anvil.busy = true; rerender();
      const res = await p.craft(id, { clean: clean && getPref('gentleActs') !== true, heartwood: wood });
      _anvil.busy = false; _anvil.word = res?.text ?? null; rerender();
    };
    const finish = craftOf(r.id, _anvil.heartwood && takesHeartwood(r));
    if (_anvil.act) {
      // THE HEAT: the glow's bar, its band, the strikes so far
      const panel = el('div', 'prof-heat');
      const bar = el('div', 'prof-heatbar');
      const band = el('div', 'prof-heatband');
      band.style.left = `${(_anvil.act.state.lo * 100).toFixed(1)}%`;
      band.style.width = `${((_anvil.act.state.hi - _anvil.act.state.lo) * 100).toFixed(1)}%`;
      const marker = el('div', 'prof-heatmark');
      bar.append(band, marker);
      const marks = el('div', 'prof-strikes');
      const dots = [];
      for (let i = 0; i < HEAT_ACT.strikes; i++) { const d = el('span', `prof-strike${i < _anvil.act.state.strikes.length ? (_anvil.act.state.strikes[i] ? ' hit' : ' miss') : ''}`, 'o'); dots.push(d); marks.append(d); }
      const hit = el('button', 'act primary', 'Strike');
      hit.type = 'button';
      const cancel = el('button', 'act', 'Let it cool');
      cancel.type = 'button';
      cancel.onclick = () => { _anvil.act?.cancel(); endHeat(); _anvil.word = 'You let the ingot cool; nothing is spent.'; rerender(); };
      panel.append(el('span', 'prof-heatword', 'The heat - strike while the glow is in the band (Space)'), bar, marks, hit, cancel);
      box.append(panel);
      _anvil.els = { bar, marker, marks: dots };
      if (!_anvil.off) _anvil.strike = heatLoop(rerender, craftOf(_anvil.actRecipe ?? r.id, _anvil.actRecipe ? _anvil.actWood : _anvil.heartwood && takesHeartwood(r)));
      hit.onclick = () => _anvil.strike?.();
    } else {
      const go = el('button', 'act primary', _anvil.busy ? 'At the anvil...' : 'Craft');
      go.type = 'button';
      go.disabled = !ready;
      go.onclick = () => {
        if (gentle) { void finish(false); return; }   // Gentle acts: a plain craft, no heat
        _anvil.act = createHeatAct({ band: p.heatBand?.() ?? 1 });
        _anvil.actRecipe = r.id; _anvil.actWood = _anvil.heartwood && takesHeartwood(r);
        rerender();
      };
      const quick = el('button', 'act', 'Quick craft');
      quick.type = 'button';
      quick.disabled = !ready;
      quick.onclick = () => { void finish(false); };
      box.append(go, quick);
    }
    detail.append(box);
  }
  if (_anvil.word) detail.append(el('p', 'prof-word', _anvil.word));
}

// ─── PROF4: THE WORKBENCH (bible/06-Systems/Professions-Arc.md 4.2, 9.3, 9.4, 25) ─────

/** A Heartwood for one of a recipe's planks (PROF0 25) - a quality step, one with a Warforged ingot; offered where the
 *  recipe asks a plank and takes a quality, and the Stores hold one. */
function heartwoodToggle(box, el, r, book, state, rerender, locked = false) {
  if (!takesHeartwood(r)) { state.heartwood = false; return; }
  const have = book.held('wood:heartwood');
  if (have < 1) { state.heartwood = false; return; }
  const lab = el('label', 'prof-gentle');
  const cb = el('input');
  cb.type = 'checkbox';
  cb.checked = state.heartwood === true;
  cb.disabled = locked;   // AUDIT 30 A3: the act under way keeps the wood it began with
  cb.onchange = () => { state.heartwood = !!cb.checked; rerender(); };
  lab.append(cb, globalThis.document.createTextNode(` Use a Heartwood for a plank - a step better (${have} stored)`));
  box.append(lab);
}
/** The workbench's families, in its row's order: staves and bows by wood, the arrows, the furniture by wood, the Basket,
 *  the Ram Kit. */
export const BENCH_FAMILIES = Object.freeze([['staves', 'Staves'], ['bows', 'Bows'], ['arrows', 'Arrows'], ['furniture', 'Furniture'], ['tools', 'Tools'], ['siege', 'Siege']]);
/** The woods a family is shown by - every wood for the staves and bows, DFU's furniture's four and the beds' for the
 *  furniture; none for the rest. */
const WOODS_OF = Object.freeze({ staves: WOODS.map((w) => `plank:${w.id}`), bows: WOODS.map((w) => `plank:${w.id}`), furniture: ['plank:pine', 'plank:oak', 'plank:cherry', 'plank:mahogany', 'plank:teak'] });
/** The recipes the workbench lists for a family at a wood. */
export const benchRecipes = (family, wood) => RECIPES.filter((r) => r.profession === 'carpentry' && r.family === family && (!WOODS_OF[family] || r.wood === wood));
/** What the plane's board says of its act, for the page and the pins. */
export const planeWord = (rep) => (rep ? (rep.clean ? 'A clean pass - true to the grain.' : rep.seconds < PLANE_ACT.minS ? 'Too quick - a plane is drawn, not flicked.' : rep.seconds > PLANE_ACT.maxS ? 'Too slow - the stroke wandered.' : 'The plane strayed from the grain.') : '');

/**
 * THE PLANE'S BOARD: the grain drawn across it, the player's stroke over it as they draw, the pointer's press, draw and
 * release fed to the act; the craft asked when the pass reaches the foot.
 */
function planeBoard(el, act, finish, rerender) {
  const NS = 'http://www.w3.org/2000/svg';
  const doc = globalThis.document;
  const board = el('div', 'prof-board');
  const svg = doc.createElementNS?.(NS, 'svg');
  const pts = [];
  const trail = svg ? doc.createElementNS(NS, 'polyline') : null;
  if (svg) {
    svg.setAttribute('viewBox', '0 0 100 40');
    svg.setAttribute('preserveAspectRatio', 'none');
    const grain = doc.createElementNS(NS, 'polyline');
    const g = [];
    for (let i = 0; i <= 40; i++) { const x = i / 40; g.push(`${(x * 100).toFixed(1)},${(20 - act.grain(x) * 20).toFixed(2)}`); }
    grain.setAttribute('points', g.join(' '));
    grain.setAttribute('class', 'prof-grain');
    trail.setAttribute('class', 'prof-trail');
    const head = doc.createElementNS(NS, 'rect');
    head.setAttribute('x', '0'); head.setAttribute('y', '0'); head.setAttribute('width', String(PLANE_ACT.headX * 100)); head.setAttribute('height', '40');
    head.setAttribute('class', 'prof-boardhead');
    svg.append(head, grain, trail);
    board.append(svg);
  }
  const at = (e) => {
    const r = board.getBoundingClientRect?.() ?? { left: 0, top: 0, width: 1, height: 1 };
    const x = Math.max(0, Math.min(1, (e.clientX - r.left) / (r.width || 1)));
    const y = -(((e.clientY - r.top) / (r.height || 1)) * 2 - 1);
    return [x, y];
  };
  const now = () => (globalThis.performance?.now?.() ?? Date.now()) / 1000;
  const done = () => { const rep = act.report(); finish(rep?.clean === true, rep); };
  // AUDIT 30 A2: a board drawn anew lost whatever drag the old one had - no release ever reached it
  if (act.state.planing) act.release();
  board.onpointerdown = (e) => {
    const [x, y] = at(e);
    if (!act.press(x, y, now())) return;
    board.setPointerCapture?.(e.pointerId);
    pts.length = 0; pts.push(`${(x * 100).toFixed(1)},${(20 - y * 20).toFixed(2)}`);
    trail?.setAttribute('points', pts.join(' '));
  };
  board.onpointermove = (e) => {
    if (!act.state.planing) return;
    // AUDIT 30 A2: the plane moves while it is held - a pointer passing over with nothing pressed lets go of the pass
    if (!((e.buttons ?? 1) & 1)) { act.release(); rerender(); return; }
    if (board.isConnected === false) { act.cancel(); return; }
    const [x, y] = at(e);
    act.move(x, y, now());
    pts.push(`${(x * 100).toFixed(1)},${(20 - y * 20).toFixed(2)}`);
    trail?.setAttribute('points', pts.join(' '));
    if (act.state.done) done();
  };
  board.onpointerup = () => { if (act.state.planing) { act.release(); rerender(); } };
  board.onpointercancel = board.onpointerup;
  return board;
}

/**
 * PROF4: THE WORKBENCH - the sawing (a log to planks), and Carpentry's recipes by family and wood, each with its inputs
 * as the Stores hold them (a Joiner's half the planks; a Heartwood for one), the rank it asks and the odds; the
 * furnisher's Linen where a bed wants it (a Furniture Store's alone); Craft (the plane) and Quick craft. Only at a
 * workbench: a Furniture Store's, its fee a craft or a saw, or the player's own home's.
 * @param {HTMLElement} detail @param {() => void} rerender @param {{ el: Function, divider: (w: string) => HTMLElement }} kit
 */
function drawWorkbench(detail, rerender, { el, divider }) {
  const p = _provider;
  if (!p?.workbench || !p.craft || !p.smelt) return;
  const book = p.book;
  const bench = p.workbench();
  detail.append(divider('The Workbench'));
  if (!bench) {
    _bench.act?.cancel(); _bench.act = null; _bench.actRecipe = null;
    detail.append(el('p', 'px-note', `Carpentry is done at a workbench: a Furniture Store's (${WORKBENCH_FEE} gold a craft or a saw), or your own home's.`));
    return;
  }
  const rank = book.track('carpentry')?.rank ?? 0;
  detail.append(el('p', 'px-note', `${bench.kind === 'shop' ? `The furnisher's workbench - ${bench.fee} gold a craft or a saw.` : 'Your workbench.'} Carpentry ${rank} (${rankName(rank)}).`));
  const short = purseShort(bench, 'furnisher', 'a craft or a saw');
  if (short) detail.append(el('p', 'px-note prof-short', short));
  // AUDIT 30 A2: Gentle acts switched on under a pass sets the plane down - nothing spent, the craft a plain one
  if (_bench.act && getPref('gentleActs') === true) { _bench.act.cancel(); _bench.act = null; _bench.actRecipe = null; _bench.word = 'You set the plane down; nothing is spent.'; }
  const planing = !!_bench.act;   // AUDIT 30 A3: nothing else picked while the plane is drawn
  // THE SAW: the logs the Stores hold, to planks (a Timberwright's three)
  const saws = SAW_RECIPES.filter((r) => book.held(r.inputs[0].key) > 0);
  if (saws.length) workRows(detail, rerender, el, saws, _bench, 'Saw', 'Sawing...', (id, n) => p.smelt(id, n), short);
  else detail.append(el('p', 'px-note', 'A log saws to two planks here. Logs come from the woods (Logging).'));
  const held = (k) => book.held(k);
  const fams = el('div', 'prof-families');
  for (const [id, word] of BENCH_FAMILIES) {
    const b = el('button', `prof-family${_bench.family === id ? ' on' : ''}`, word);
    b.type = 'button';
    b.disabled = planing;
    b.onclick = () => { _bench.family = id; _bench.picked = null; if (WOODS_OF[id] && !WOODS_OF[id].includes(_bench.wood)) _bench.wood = WOODS_OF[id][0]; rerender(); };
    fams.append(b);
  }
  detail.append(fams);
  if (WOODS_OF[_bench.family]) {
    const woods = el('div', 'prof-families prof-metals');
    for (const id of WOODS_OF[_bench.family]) {
      const b = el('button', `prof-family${_bench.wood === id ? ' on' : ''}`, p.name(id).replace(/ Plank$/, ''));
      b.type = 'button';
      b.disabled = planing;
      b.onclick = () => { _bench.wood = id; _bench.picked = null; rerender(); };
      woods.append(b);
    }
    detail.append(woods);
  }
  const list = benchRecipes(_bench.family, _bench.wood);
  if (!list.length) detail.append(el('p', 'px-note', 'Nothing of that wood.'));
  for (const r of list) {
    const open = recipeOpen(r, rank);
    const can = open && craftable(r, held, spendsOf(r, book, false));
    const row = el('button', `prof-recipe${_bench.picked === r.id ? ' on' : ''}${can ? '' : ' prof-locked'}`);
    row.type = 'button';
    row.disabled = planing;
    row.append(el('b', null, r.name), el('span', 'prof-split', r.later ? LATER_WORDS.SEAT2 : open ? (can ? 'can make now' : 'wants its inputs') : `rank ${r.rank}`));
    row.onclick = () => { _bench.picked = r.id; rerender(); };
    detail.append(row);
  }
  const r = list.find((x) => x.id === _bench.picked);
  if (r) {
    const box = el('div', 'prof-craft');
    box.append(el('b', null, `${r.name} - rank ${r.rank}`));
    const spends = spendsOf(r, book, _bench.heartwood);
    for (const inp of spends) {
      const have = held(inp.key);
      const line = el('div', `prof-input${have >= inp.n ? '' : ' prof-short'}`);
      line.append(el('span', null, `${p.name(inp.key)} ${Math.min(have, inp.n)} / ${inp.n} (${have} stored)`));
      const sale = stockOf(inp.key);
      if (sale?.counter === 'furnisher' && have < inp.n && bench.kind === 'shop' && p.stock) {
        const need = inp.n - have;
        const buy = el('button', 'act', `Buy ${need} from the furnisher - ${sale.marks * need} Marks`);
        buy.type = 'button';
        buy.disabled = _bench.busy;
        buy.onclick = async () => {
          if (_bench.busy) return;
          _bench.busy = true; rerender();
          const res = await p.stock(inp.key, Math.min(STOCK_MAX, need));
          _bench.busy = false; _bench.word = res?.text ?? null; rerender();
        };
        line.append(buy);
      }
      box.append(line);
    }
    if (r.later) box.append(el('p', 'px-note', 'The Ram Kit is made when the sieges come - its Bear Hides with Hunting.'));
    else if (r.kind === 'arrows') box.append(el('p', 'px-note', `Twenty arrows, one quiver - an arrow takes no quality.`));
    else if (r.family === 'furniture') box.append(el('p', 'px-note', 'Furniture goes among your things, to set down in a room of your own (Decorate).'));
    if (takesQuality(r) && recipeOpen(r, rank)) {
      const odds = qualityOdds(rank - r.rank, { masterwright: false });
      box.append(el('p', 'px-note', `Your rank ${rank}, margin ${rank - r.rank}: ${odds.map((o, q) => (o ? `${QUALITY_NAMES[q]} ${o}` : null)).filter(Boolean).join(' | ')}. A clean pass of the plane is a step better.`));
    }
    heartwoodToggle(box, el, r, book, _bench, rerender, planing);
    const gentle = getPref('gentleActs') === true;
    const ready = !r.later && recipeOpen(r, rank) && craftable(r, held, spends) && !_bench.busy && !_bench.act && !short;
    // AUDIT 30 A3: the pass makes the recipe it began on, with its Heartwood - never the page's pick when it lands
    const craftOf = (id, wood) => async (clean, rep = null) => {
      _bench.act = null; _bench.actRecipe = null;
      _bench.busy = true; rerender();
      const res = await p.craft(id, { clean: clean && getPref('gentleActs') !== true, heartwood: wood });
      _bench.busy = false; _bench.word = [planeWord(rep), res?.text ?? ''].filter(Boolean).join(' ') || null; rerender();
    };
    const finish = craftOf(r.id, _bench.heartwood && takesHeartwood(r));
    if (_bench.act) {
      // THE PLANE: draw along the grain from its head to its foot
      const panel = el('div', 'prof-plane');
      panel.append(el('span', 'prof-heatword', 'The plane - press at the board\'s head and draw along the grain to its foot'));
      const planed = craftOf(_bench.actRecipe ?? r.id, _bench.actRecipe ? _bench.actWood : _bench.heartwood && takesHeartwood(r));
      panel.append(planeBoard(el, _bench.act, (clean, rep) => { void planed(clean, rep); }, rerender));
      if (_bench.act.state.slips) panel.append(el('span', 'prof-split', `let go ${_bench.act.state.slips} time${_bench.act.state.slips === 1 ? '' : 's'} - start again at the head`));
      const cancel = el('button', 'act', 'Set the plane down');
      cancel.type = 'button';
      cancel.onclick = () => { _bench.act?.cancel(); _bench.act = null; _bench.actRecipe = null; _bench.word = 'You set the plane down; nothing is spent.'; rerender(); };
      panel.append(cancel);
      box.append(panel);
    } else {
      const go = el('button', 'act primary', _bench.busy ? 'At the workbench...' : 'Craft');
      go.type = 'button';
      go.disabled = !ready;
      go.onclick = () => {
        if (gentle) { void finish(false); return; }   // Gentle acts: a plain craft, no plane
        _bench.act = createPlaneAct({ rank, band: p.planeBand?.() ?? 1 });
        _bench.actRecipe = r.id; _bench.actWood = _bench.heartwood && takesHeartwood(r);
        rerender();
      };
      const quick = el('button', 'act', 'Quick craft');
      quick.type = 'button';
      quick.disabled = !ready;
      quick.onclick = () => { void finish(false); };
      box.append(go, quick);
    }
    detail.append(box);
  }
  if (_bench.word) detail.append(el('p', 'prof-word', _bench.word));
}
