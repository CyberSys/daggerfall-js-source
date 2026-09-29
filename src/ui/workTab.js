// @ts-check
// PROF6 (2026-09-29, Mac: "continue"): THE WORK TAB'S GUILD WRITS AND COMMISSIONS, beside the Court's writs on the
// Notice Board (bible/06-Systems/Professions-Arc.md 11, 21's wireframe, 28) - drawn inside the board's window
// (ui/noticeWindow.js), under the Court's cards.
//
// THIS REGION'S GUILD WRITS (the guild blue, its tag - no guild's colours are stored until SEAT1c): what the guild needs
// and pays a unit, what has come in, the time left; Deliver a number from the Stores; Withdraw where the reader's rank
// may. THIS REGION'S COMMISSIONS (green): the crafter named, the piece and its least quality, the pay; the named crafter's
// Fill with a piece of their make, and Decline; the poster's Withdraw. YOURS: the account's commissions posted and
// naming it, and the guild's open writs, every region. POST A GUILD WRIT (a Guildmaster's, or an Officer's within the
// week's budget) and COMMISSION A PIECE (the crafter, the recipe by family, the least quality, the pay) - the note's
// "Commission a piece" button opens the second with its author named.
//
// Every act goes through the window's one-at-a-time door (`ui.run`) and the writs' book (net/writBook.js); a piece that
// leaves the save for a commission is kept before it is asked. A number typed moves only the words that hang on it, and
// the field keeps the focus through a read's redraw (the Market tab's law, AUDIT 30 U8).
import { accountRefusalText } from '../net/accountClient.js';
import { CRAFTED_FAMILIES, marketCatalogue, saleTax, MARKET_PRICE_MAX } from '../net/marketLaw.js';
import { RECIPES, QUALITY_NAMES, MASTERWORK } from '../net/recipeLaw.js';
import { marksText } from '../net/marksLaw.js';
import {
  WRIT_UNITS_MAX, writPayMax, commissionable, commissionTakesQuality, COMMISSIONS_MAX,
} from '../net/writLaw.js';
import { WRIT_MOVED } from '../net/writBook.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const button = (cls, text, onPress) => {
  const b = /** @type {HTMLButtonElement} */ (el('button', `act ${cls}`, text));
  b.setAttribute('type', 'button');
  b.onclick = (e) => { e?.stopPropagation?.(); return onPress(); };
  return b;
};
/** A field, named and keyed for the focus a redraw keeps. */
const input = (type, value, label, focus, cls = 'notice-input work-num') => {
  const i = /** @type {HTMLInputElement} */ (el('input', cls));
  i.type = type; i.value = String(value);
  i.setAttribute('aria-label', label);
  i.setAttribute('data-focus', focus);
  return i;
};
const select = (options, value, onChange, label) => {
  const s = /** @type {HTMLSelectElement} */ (el('select', 'notice-select work-select'));
  s.setAttribute('aria-label', label);
  s.setAttribute('data-focus', `select|${label}`);
  for (const [v, text] of options) { const o = /** @type {HTMLOptionElement} */ (el('option', null, text)); o.value = v; if (v === value) o.selected = true; s.append(o); }
  s.onchange = () => onChange(s.value);
  return s;
};
const intOf = (s, lo, hi) => { const n = Math.floor(Number(s)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };
const plural = (n, one) => `${n.toLocaleString('en-US')} ${one}${n === 1 ? '' : 's'}`;
/** "5 days left", "3 hours left", "under an hour left", "ended". */
export function writLeftText(atS, nowS) {
  const s = (Number(atS) || 0) - nowS;
  if (s <= 0) return 'ended';
  if (s >= 86400) return `${plural(Math.floor(s / 86400), 'day')} left`;
  if (s >= 3600) return `${plural(Math.floor(s / 3600), 'hour')} left`;
  return 'under an hour left';
}
const recipeName = (id) => RECIPES.find((r) => r.id === id)?.name ?? id;
/** "a Mithril Longsword, Fine or better" - a commission's piece in words. */
export function commissionPieceText(c) {
  const name = recipeName(c.recipe);
  const an = /^[AEIOU]/i.test(name) ? 'an' : 'a';
  return `${an} ${name}${c.quality != null ? `, ${QUALITY_NAMES[c.quality]} or better` : ''}`;
}
/** A closed commission's state, as "Yours" says it. */
const COMMISSION_SAID = Object.freeze({ filled: 'filled', withdrawn: 'withdrawn', declined: 'declined', expired: 'run out' });

/**
 * THE WORK TAB'S PROF6 SECTIONS.
 * @param {{
 *   writs: any, held: (material: string) => number, region: number, regionName: string, regionNameOf: (r: number) => string,
 *   countName: (key: string, n: number) => string,
 *   pieces: (c: any) => Array<{ item: any, where: string, name: string, take: () => boolean, putBack: (item: any, where: string) => void }>,
 *   reload: () => void,
 * }} w `writs` - net/writBook.js; `held` - the Stores' count of a material (the professions' book); `pieces` - the
 *   pieces in the save that answer a commission (its recipe, at least its quality, unworn, as minted); `reload` - the
 *   Work tab's list read again
 * @param {{ busy: () => boolean, run: (start: () => Promise<any>) => Promise<void>, rerender: () => void, nowS: () => number }} ui
 */
export function createWorkTab(w, ui) {
  const catalogue = marketCatalogue();
  const st = {
    /** the open form: 'writ' | 'commission' | null */
    form: /** @type {string|null} */ (null),
    writ: { material: catalogue.find((m) => m.key === 'log:oak')?.key ?? catalogue[0]?.key ?? '', units: 100, pay: 1 },
    comm: { crafter: '', family: 'weapons', recipe: '', quality: 2, pay: 100 },
    /** a delivery's units typed, by writ; a commission's piece picked, by commission */
    supply: /** @type {Record<string, number>} */ ({}),
    pick: /** @type {Record<string, string>} */ ({}),
  };
  const recipesOf = (family) => RECIPES.filter((r) => r.family === family && commissionable(r.id));
  const firstRecipe = (family) => recipesOf(family)[0]?.id ?? '';
  st.comm.recipe = firstRecipe(st.comm.family);

  /** An act through the window's door: its word; the list read again on success, and on a word that says it moved. */
  const act = (start, okText) => ui.run(async () => {
    const r = await start();
    if (r?.ok) { w.reload(); return { ok: true, text: typeof okText === 'function' ? okText(r.data) : okText }; }
    if (WRIT_MOVED.includes(r?.error)) w.reload();
    return { ok: false, text: r?.text ?? accountRefusalText(r?.error) };
  });
  const guildName = (g) => (g?.tag ? `${g.name} [${g.tag}]` : g?.name ?? 'A guild');

  // ─── A GUILD WRIT ──────────────────────────────────────────────────
  function guildWritCard(x, i) {
    const li = el('li', `notice-card notice-writ seal-guild${x.state !== 'open' ? ' done' : ''}`);
    li.style.setProperty('--tilt', `${((i * 41) % 5) - 2}deg`);
    li.append(el('span', 'notice-pin'), el('span', 'writ-kind', 'Guild writ'));
    li.append(el('p', 'writ-need', `${guildName(x.guild)} needs ${x.left.toLocaleString('en-US')} more ${w.countName(x.material, x.left)}`));
    li.append(el('p', 'writ-pay', `Pays ${marksText(x.pay)} each - ${(x.units - x.left).toLocaleString('en-US')} / ${x.units.toLocaleString('en-US')} delivered`));
    li.append(el('p', 'writ-left', writLeftText(x.expiresAt, ui.nowS())));
    const held = w.held(x.material);
    const most = Math.min(x.left, held);
    const bar = el('div', 'writ-take');
    if (x.state === 'open' && most > 0) {
      const units = () => intOf(st.supply[x.id] ?? most, 1, most);
      const n = input('number', units(), `Units to deliver to ${guildName(x.guild)}`, `supply|${x.id}`);
      n.min = '1'; n.max = String(most);
      const go = button('primary notice-take work-deliver', `Deliver ${units()}`, () => {
        const u = units();
        return act(() => w.writs.supply({ region: w.region, writ: x.id, units: u }),
          (d) => `Delivered ${u.toLocaleString('en-US')} ${w.countName(x.material, u)}: ${marksText(d?.fill?.pay ?? 0)} struck to your account, less ${marksText(d?.fill?.tax ?? 0)} tax.`);
      });
      go.disabled = ui.busy();
      n.oninput = () => { st.supply[x.id] = intOf(n.value, 1, most); go.textContent = `Deliver ${units()}`; };
      bar.append(n, go);
    }
    bar.append(el('span', null, `${held.toLocaleString('en-US')} in your Stores`));
    if (x.may) bar.append(withdrawWrit(x));
    li.append(bar, el('span', 'notice-seal', ''));
    return li;
  }
  const withdrawWrit = (x) => {
    const b = button('work-withdraw', 'Withdraw', () => act(() => w.writs.withdraw(x.id), 'Withdrawn. What was left of its pay is back in the guild\'s treasury.'));
    b.disabled = ui.busy();
    return b;
  };

  // ─── A COMMISSION ──────────────────────────────────────────────────
  function commissionCard(c, i) {
    const li = el('li', `notice-card notice-writ seal-commission${c.state !== 'open' ? ' done' : ''}`);
    li.style.setProperty('--tilt', `${((i * 29) % 5) - 2}deg`);
    li.append(el('span', 'notice-pin'), el('span', 'writ-kind', 'Commission'));
    li.append(el('p', 'writ-need', `For ${c.crafter ?? 'a crafter'} only: ${commissionPieceText(c)}`));
    li.append(el('p', 'writ-pay', `Pays ${marksText(c.pay)}${c.poster ? ` - from ${c.poster}` : ''}`));
    li.append(el('p', 'writ-left', writLeftText(c.expiresAt, ui.nowS())));
    const bar = el('div', 'writ-take');
    if (c.state === 'open' && c.forMe) {
      if (c.region === w.region) bar.append(...fillNodes(c));
      else bar.append(el('span', null, `Filled at the boards of ${w.regionNameOf(c.region)}`));
      const d = button('work-decline', 'Decline', () => act(() => w.writs.decline(c.id), 'Declined. Its pay goes back to its poster.'));
      d.disabled = ui.busy();
      bar.append(d);
    }
    if (c.state === 'open' && c.mine) {
      const b = button('work-withdraw', 'Withdraw', () => act(() => w.writs.cancel(c.id), `Withdrawn. ${marksText(c.pay)} back to your account.`));
      b.disabled = ui.busy();
      bar.append(b);
    }
    li.append(bar, el('span', 'notice-seal', ''));
    return li;
  }
  /** The crafter's Fill: a piece of theirs that answers it, picked, handed over (out of the save first - kept). */
  function fillNodes(c) {
    const pieces = w.pieces(c);
    if (!pieces.length) return [el('span', 'work-none', `You carry no ${commissionPieceText(c).replace(/^an? /, '')} of your make, unworn.`)];
    const picked = () => pieces.find((p) => p.item.provenance === st.pick[c.id]) ?? pieces[0];
    const s = select(pieces.map((p) => [p.item.provenance, p.name]), picked().item.provenance, (v) => { st.pick[c.id] = v; }, `The piece to fill ${c.poster ?? 'the'} commission with`);
    const go = button('primary work-fill', 'Fill', () => {
      const p = picked();
      return act(() => w.writs.fulfil({ region: w.region, commission: c.id, provenance: p.item.provenance, wear: 1000 }, p),
        `Filled: ${p.name} is on its way to ${c.poster ?? 'its poster'}; ${marksText(c.pay - saleTax(c.pay))} struck to your account, less ${marksText(saleTax(c.pay))} tax.`);
    });
    go.disabled = ui.busy();
    return [s, go];
  }

  // ─── YOURS ─────────────────────────────────────────────────────────
  function yoursNode(data) {
    const cs = data?.yours?.commissions ?? [], gw = data?.yours?.guildWrits ?? [];
    if (!cs.length && !gw.length) return null;
    const box = el('div', 'work-yours');
    box.append(el('h3', 'work-head', 'Yours'));
    const list = el('ul', 'work-rows');
    for (const c of cs) {
      const li = el('li', 'work-row');
      const who = c.mine ? `You commissioned ${c.crafter ?? 'a crafter gone'}` : `${c.poster} commissioned you`;
      const where = c.region === w.region ? 'here' : w.regionNameOf(c.region);
      const said = c.state === 'open' ? writLeftText(c.expiresAt, ui.nowS())
        : `${COMMISSION_SAID[c.state] ?? c.state}${c.mine && c.state !== 'filled' ? (c.returned ? ' - Marks back' : ' - Marks to come back') : ''}`;
      li.append(el('span', 'work-what', `${who}: ${commissionPieceText(c)}, ${marksText(c.pay)}`), el('span', 'work-where', `${where} · ${said}`));
      if (c.state === 'open' && c.mine) {
        const b = button('work-withdraw', 'Withdraw', () => act(() => w.writs.cancel(c.id), `Withdrawn. ${marksText(c.pay)} back to your account.`));
        b.disabled = ui.busy();
        li.append(b);
      }
      list.append(li);
    }
    for (const x of gw) {
      const li = el('li', 'work-row');
      li.append(el('span', 'work-what', `${guildName(x.guild)}: ${x.left.toLocaleString('en-US')} more ${w.countName(x.material, x.left)}, ${marksText(x.pay)} each`),
        el('span', 'work-where', `${x.region === w.region ? 'here' : w.regionNameOf(x.region)} · ${writLeftText(x.expiresAt, ui.nowS())}`));
      if (x.may) li.append(withdrawWrit(x));
      list.append(li);
    }
    box.append(list);
    return box;
  }

  // ─── THE FORMS ─────────────────────────────────────────────────────
  function writForm(g) {
    const box = el('div', 'work-form');
    box.append(el('h3', 'work-head', `Post a guild writ - ${guildName(g)}`));
    const max = () => writPayMax(st.writ.material);
    const f = st.writ;
    f.pay = intOf(f.pay, 1, Math.max(1, max()));
    const mat = select(catalogue.map((m) => [m.key, w.countName(m.key, 2)]), f.material, (v) => { f.material = v; f.pay = Math.min(f.pay, writPayMax(v)); ui.rerender(); }, 'The material the writ asks');
    const units = input('number', f.units, 'Units the writ asks', 'writ|units');
    units.min = '1'; units.max = String(WRIT_UNITS_MAX);
    const pay = input('number', f.pay, 'Marks each', 'writ|pay');
    pay.min = '1'; pay.max = String(max());
    const said = el('p', 'work-hint');
    said.setAttribute('aria-live', 'polite');
    const go = button('primary work-post', 'Post', () => act(() => w.writs.post({ region: w.region, material: f.material, units: f.units, pay: f.pay }),
      () => { st.form = null; return `Posted on the boards of ${w.regionName} for seven days.`; }));
    const refresh = () => {
      const escrow = f.units * f.pay;
      const officer = g.rank !== 0;
      said.textContent = `Holds ${marksText(escrow)} from the guild's treasury (it holds ${marksText(g.marks ?? 0)}) until it is delivered, withdrawn or runs out in seven days. At most ${marksText(max())} each - half again the material's worth.`
        + (officer ? ` Your writ budget this week: ${marksText(g.left ?? 0)} of ${marksText(g.budget ?? 0)} left.` : '');
      go.disabled = ui.busy() || escrow > (g.marks ?? 0) || (officer && escrow > (g.left ?? 0));
    };
    units.oninput = () => { f.units = intOf(units.value, 1, WRIT_UNITS_MAX); refresh(); };
    pay.oninput = () => { f.pay = intOf(pay.value, 1, Math.max(1, max())); refresh(); };
    refresh();
    const row = el('div', 'work-fields');
    row.append(mat, units, pay, go);
    box.append(row, said);
    return box;
  }
  function commissionForm() {
    const box = el('div', 'work-form');
    box.append(el('h3', 'work-head', 'Commission a piece'));
    const f = st.comm;
    const who = input('text', f.crafter, 'The crafter\'s name', 'comm|crafter', 'notice-input work-text');
    who.maxLength = 24;
    const fam = select(CRAFTED_FAMILIES.map(([k, label]) => [k, label]), f.family, (v) => { f.family = v; f.recipe = firstRecipe(v); ui.rerender(); }, 'The family of piece');
    const rec = select(recipesOf(f.family).map((r) => [r.id, r.name]), f.recipe, (v) => { f.recipe = v; ui.rerender(); }, 'The piece');
    const takes = commissionTakesQuality(f.recipe);
    const q = takes ? select(QUALITY_NAMES.map((n, i) => [String(i), `${n} or better`]), String(f.quality), (v) => { f.quality = intOf(v, 0, MASTERWORK); }, 'The least quality it takes') : null;
    const pay = input('number', f.pay, 'Marks it pays', 'comm|pay');
    pay.min = '1'; pay.max = String(MARKET_PRICE_MAX);
    const said = el('p', 'work-hint');
    said.setAttribute('aria-live', 'polite');
    const go = button('primary work-post', 'Commission', () => act(() => w.writs.commission({
      region: w.region, crafter: f.crafter.trim(), recipe: f.recipe, quality: takes ? f.quality : null, pay: f.pay,
    }), () => { st.form = null; return `Commissioned from ${f.crafter.trim()}. The pay is held until it is filled, withdrawn or declined.`; }));
    const refresh = () => {
      said.textContent = `Holds ${marksText(f.pay)} for seven days; the crafter receives it less ${marksText(saleTax(f.pay))} tax, and only for a piece of their own make, unworn. At most ${COMMISSIONS_MAX} of yours stand at once.`;
      go.disabled = ui.busy() || !f.crafter.trim() || !f.recipe;
    };
    who.oninput = () => { f.crafter = who.value; refresh(); };
    pay.oninput = () => { f.pay = intOf(pay.value, 1, MARKET_PRICE_MAX); refresh(); };
    refresh();
    const row = el('div', 'work-fields');
    row.append(who, fam, rec, ...(q ? [q] : []), pay, go);
    box.append(row, said);
    return box;
  }

  const focusNow = () => {
    const a = /** @type {any} */ (globalThis.document?.activeElement);
    const key = a?.getAttribute?.('data-focus');
    if (!key) return null;
    let at = null;
    try { at = [a.selectionStart, a.selectionEnd]; } catch { /* a number field has none */ }
    return { key, at };
  };
  const refocus = (box, was) => {
    if (!was) return;
    Promise.resolve().then(() => {
      const n = /** @type {any} */ ([...box.querySelectorAll('input, select')].find((x) => x.getAttribute('data-focus') === was.key));
      if (!n || !n.isConnected) return;
      n.focus?.();
      if (was.at && was.at[0] != null) { try { n.setSelectionRange(was.at[0], was.at[1]); } catch { /* none to set */ } }
    });
  };

  return {
    /** The sections under the Court's cards, from the Work tab's list (`/v1/writs/list`'s answer). */
    node(data) {
      const was = focusNow();
      const box = el('div', 'work-more');
      const gws = data?.guildWrits ?? [], cs = data?.commissions ?? [];
      if (gws.length || cs.length) {
        const grid = el('ul', 'notice-grid work-grid');
        grid.setAttribute('role', 'list');
        gws.forEach((x, i) => grid.append(guildWritCard(x, i)));
        cs.forEach((c, i) => grid.append(commissionCard(c, gws.length + i)));
        box.append(grid);
      }
      const yours = yoursNode(data);
      if (yours) box.append(yours);
      const g = data?.guild ?? null;
      const acts = el('div', 'work-acts');
      if (g?.mayPost) acts.append(button(`work-open${st.form === 'writ' ? ' on' : ''}`, 'Post a guild writ', () => { st.form = st.form === 'writ' ? null : 'writ'; ui.rerender(); }));
      acts.append(button(`work-open${st.form === 'commission' ? ' on' : ''}`, 'Commission a piece', () => { st.form = st.form === 'commission' ? null : 'commission'; ui.rerender(); }));
      box.append(acts);
      if (st.form === 'writ' && g?.mayPost) box.append(writForm(g));
      if (st.form === 'commission') box.append(commissionForm());
      refocus(box, was);
      return box;
    },
    /** The note's "Commission a piece" (10.6): the form open, its author named. */
    openCommission(crafter) {
      st.form = 'commission';
      if (typeof crafter === 'string') st.comm.crafter = crafter;
    },
    /** The tab's state, for a test. */
    _state: st,
  };
}
