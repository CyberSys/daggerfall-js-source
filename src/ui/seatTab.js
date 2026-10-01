// @ts-check
// SEAT1b (2026-09-30, Mac: "Finish the seats"): THE SEAT TAB of the Notice Board (bible/11-Multiplayer/Seats-Arc.md 7.9:
// "its Seat tab, at every Notice Board in a seat town (not its bounty boards) ... the standings: every pledged guild's
// influence this week, live") - drawn inside the board's window (ui/noticeWindow.js), beside Notices, Work, Market and
// Guilds, at a seat town's rumour board while the seats are open to this account.
//
// WHAT HANGS THERE, top to bottom: the seat's Charter (SEAT1a's words - unheld until SEAT1c's claims); the week's clock
// (the Muster until the Reckoning, then the Reckoning until the Turning); THE STANDINGS - every guild pledged here this
// week, its banner, its name and its influence, highest first; the reader's own guild at this seat (pledged here, or to
// another seat of the region, or nowhere; whether this character counts yet and whether its account fights for another
// guild this week; its own week here against the 2,000 cap); an Officer's or the guildmaster's pledge buttons, in the
// Muster; and the guildmaster's Tribute, with its room.
//
// A seat is run from its town's board, in person - that is the point of a physical board: the war has a place.
//
// Every act goes through the window's one-at-a-time door (`ui.run`), and the standings are read again after each.
import { accountRefusalText } from '../net/accountClient.js';
import {
  seatInfoLine, seatWeekLine, seatStandingLine, seatNoStandingsLine, seatMineLines, seatTributeLine, seatMay,
  SEAT_PLEDGE_WORDS, SEAT_PLEDGE_REGIONS_MAX, TRIBUTE_MARKS_PER_INFLUENCE,
  seatHolderLine, seatBattleLine, seatClaimLine, chronicleLine, SEAT_RELINQUISH_WORDS,
  seatRuleLine, seatHoldingLines, edictLine, edictMayFollow, edictForTier, royalTourneyLines, EDICTS, TITHE_CAP, SEAT_LEVER_RANKS, BOUNTY_MARKS,
  politicsRows, POLITICS_ACTS, seasonLine,
  battleAnnouncement, sideLine, siegeWindowText, SIEGE_WINDOW_DAYS, SIEGE_WINDOW_HOURS, SIEGE_WINDOW_DEFAULT, SELLSWORD_FEE_MAX, passOpens, passWindowEnds,
} from '../net/townSeatLaw.js';
import { GUILD_RANK_MASTER } from '../net/guildLaw.js';
import { tideLine } from '../net/tideLaw.js';

/** SEAT1c: how long the relinquish button stays armed after its first press, ms. */
export const SEAT_RELINQUISH_ARM_MS = 4000;

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

/** What the tab says while it has no standings to show. */
export const SEAT_TAB_WORDS = Object.freeze({
  reading: 'Reading the week\'s standings...',
  slow: 'The standings could not be read - the counting-house is slow to answer.',
  shut: 'The seats are not open to you yet.',
});
/** The refusals that say the seats are shut to this account (no retry offered). */
const SHUT = new Set(['seats-closed', 'no-session', 'auth', 'seat-unconfirmed']);

/**
 * @param {{ seat: { key: number, name: string, region: number, tier: string },
 *   book: ReturnType<typeof import('../net/townSeatBook.js').createTownSeatBook>,
 *   nameOf?: (key: number) => (string|null), banner?: (heraldry: any, width: number) => (Node|null),
 *   enterBattle?: (seat: any, fight: any) => boolean, enterRoyal?: (seat: any, royal: any, watch: boolean) => boolean }} host   SEAT2a part four: the world's door into the battle   CROWN1 part two: and into a Royal Tourney
 * @param {{ busy: () => boolean, run: (start: () => Promise<any>) => any, rerender: () => void, nowS: () => number,
 *   alive?: () => boolean }} ui
 */
export function createSeatTab(host, ui) {
  const { seat, book } = host;
  const nameOf = host.nameOf ?? (() => null);
  const banner = host.banner ?? (() => null);
  let data = null, error = null, loading = false;
  let tributeDrakes = 0;
  let armedAt = -Infinity;   // SEAT1c: the relinquish button's first press
  let titheAsk = null, edictAsk = null, bountyAside = 200;   // SEAT1d: the levers' own choices, kept across redraws
  let windowAsk = null, hireHandle = '', hireFee = 0;   // SEAT2a: the window and the contract asked, kept across redraws
  let politicsTag = '';   // CROWN2: the guild an offer is made to, kept across redraws

  async function load(force) {
    if (loading) return;
    loading = true; ui.rerender();
    let r;
    try { r = await book.standings(seat.key, { force }); } catch { r = { data: null, error: 'offline' }; }
    loading = false;
    if (ui.alive && !ui.alive()) return;
    if (r.data) data = r.data;
    error = r.error;
    ui.rerender();
  }
  /** An act through the window's door, the standings read afresh after it. */
  const act = (start) => ui.run(async () => { const r = await start(); load(true); return r; });

  function standingsNode() {
    const list = el('ol', 'notice-standings');
    const rows = data?.standings ?? [];
    rows.forEach((s, i) => {
      const li = el('li', `notice-standing${data?.mine?.guild === s.guild.id ? ' mine' : ''}`);
      const img = banner(s.guild.heraldry, 26);
      if (img) li.append(img);
      li.append(el('span', null, seatStandingLine(s, i)));
      list.append(li);
    });
    if (!rows.length) list.append(el('li', 'notice-empty', seatNoStandingsLine(seat)));
    return list;
  }

  function leversNode(mine) {
    const out = el('div', 'notice-seat-levers');
    const here = mine.pledges.find((p) => p.region === seat.region) ?? null;
    const busy = ui.busy();
    if (seatMay(mine.rank, 'pledge') && data.phase === 'muster' && !here?.held) {   // SEAT1c: a held region is pledged by its Charter
      let b = null;
      if (here?.key === seat.key) b = button('notice-seat-drop', SEAT_PLEDGE_WORDS.drop, () => act(() => book.unpledge(seat.region)));
      else if (here) b = button('notice-seat-pledge', SEAT_PLEDGE_WORDS.move(seat), () => act(() => book.pledge(seat)));
      else if (mine.pledges.length >= SEAT_PLEDGE_REGIONS_MAX) out.append(el('p', 'notice-seat-mine', SEAT_PLEDGE_WORDS.full));
      else b = button('notice-seat-pledge', SEAT_PLEDGE_WORDS.pledge(seat), () => act(() => book.pledge(seat)));
      if (b) { b.disabled = busy; out.append(b); }
    }
    if (seatMay(mine.rank, 'tribute') && here?.key === seat.key) {
      const room = Math.max(0, Number(mine.tributeRoom) || 0);
      out.append(el('p', 'notice-seat-mine', seatTributeLine(room)));
      if (room >= TRIBUTE_MARKS_PER_INFLUENCE) {
        const n = /** @type {HTMLInputElement} */ (el('input', 'notice-input notice-seat-drakes'));
        n.type = 'number'; n.min = String(TRIBUTE_MARKS_PER_INFLUENCE); n.step = String(TRIBUTE_MARKS_PER_INFLUENCE); n.max = String(room);
        if (!tributeDrakes || tributeDrakes > room) tributeDrakes = Math.min(100, room - (room % TRIBUTE_MARKS_PER_INFLUENCE));
        n.value = String(tributeDrakes);
        n.setAttribute('aria-label', 'Drakes of Tribute');
        n.setAttribute('data-focus', 'seat-tribute');
        n.oninput = () => { tributeDrakes = Math.floor(Number(n.value) || 0); };
        const pay = button('notice-seat-tribute', 'Pay Tribute', () => {
          const marks = Math.floor(tributeDrakes / TRIBUTE_MARKS_PER_INFLUENCE) * TRIBUTE_MARKS_PER_INFLUENCE;
          if (marks < TRIBUTE_MARKS_PER_INFLUENCE || marks > room) return ui.run(async () => ({ ok: false, text: accountRefusalText('bad-tribute') }));
          return act(() => book.tribute(seat, marks));
        });
        pay.disabled = busy;
        out.append(n, pay);
      }
    }
    return out;
  }

  /** SEAT1d: THE HOLDER'S LEVERS (SEAT0 7.9: "for the holder's Officers: the levers - the Tithe, the Edict") - the
   *  Tithe, once a week, within its tier's cap; the coming week's Edict, proclaimed or taken back. */
  function holdingNode(h) {
    const out = el('div', 'notice-seat-levers');
    const busy = ui.busy();
    const cap = TITHE_CAP[seat.tier] ?? 0;
    if (h.titheWeek !== data.week) {
      const n = /** @type {HTMLInputElement} */ (el('input', 'notice-input notice-seat-tithe'));
      n.type = 'number'; n.min = '0'; n.max = String(cap); n.step = '1';
      n.value = String(titheAsk ?? h.tithe);
      n.setAttribute('aria-label', 'The Tithe, in percent');
      n.setAttribute('data-focus', 'seat-tithe');
      n.oninput = () => { titheAsk = Math.floor(Number(n.value) || 0); };
      const set = button('notice-seat-tithe-set', 'Set the Tithe', () => act(() => book.tithe(seat, Math.max(0, Math.min(cap, titheAsk ?? h.tithe)))));
      set.disabled = busy;
      out.append(n, set);
    } else out.append(el('p', 'notice-seat-mine', 'The Tithe has been set this week.'));
    const sel = /** @type {HTMLSelectElement} */ (el('select', 'notice-input notice-seat-edict'));
    sel.setAttribute('aria-label', 'The Edict for next week');
    // none two weeks running but Market Day: this week's Edict is not offered again
    const allowed = Object.keys(EDICTS).filter((k) => edictForTier(k, seat.tier) && edictMayFollow(k, h.edict));   // CROWN1: a crown's own at a crown
    for (const k of allowed) {
      const o = /** @type {HTMLOptionElement} */ (el('option', null, EDICTS[k].name));
      o.value = k;
      sel.append(o);
    }
    const chosen = edictAsk && allowed.includes(edictAsk) ? edictAsk : (h.next && allowed.includes(h.next) ? h.next : allowed[0] ?? null);
    if (chosen) sel.value = chosen;
    sel.onchange = () => { edictAsk = sel.value; ui.rerender(); };
    out.append(sel);
    const words = edictLine(chosen, seat.tier, data?.tides?.next ?? 'calm');   // SEASON1 part two: the coming week's Tide on its cost
    if (words) out.append(el('p', 'notice-seat-mine', words));
    if (chosen === 'bounty') {
      const a = /** @type {HTMLInputElement} */ (el('input', 'notice-input notice-seat-bounty'));
      a.type = 'number'; a.min = String(BOUNTY_MARKS); a.step = String(BOUNTY_MARKS); a.value = String(bountyAside);
      a.setAttribute('aria-label', 'Drakes set aside for the Bounty');
      a.oninput = () => { bountyAside = Math.floor(Number(a.value) || 0); };
      out.append(a);
    }
    const go = button('notice-seat-edict-set', 'Proclaim for next week', () => act(() => book.edict(seat, chosen, chosen === 'bounty' ? bountyAside : 0)));
    go.disabled = busy || !chosen;
    out.append(go);
    if (h.next) {
      const back = button('notice-seat-edict-back', 'Take it back', () => act(() => book.edict(seat, null)));
      back.disabled = busy;
      out.append(back);
    }
    return out;
  }

  /** SEAT2a: THE HOLDER'S WINDOW (SEAT0 6.3) - a day and a start hour, its Officers' and guildmaster's to set. */
  function windowNode(w) {
    const out = el('div', 'notice-seat-levers');
    const busy = ui.busy();
    out.append(el('p', 'notice-seat-mine', `Battles here are fought from ${siegeWindowText(w ?? SIEGE_WINDOW_DEFAULT)}${w ? '' : ' (the default)'}.`));
    const want = windowAsk ?? w ?? SIEGE_WINDOW_DEFAULT;
    const day = /** @type {HTMLSelectElement} */ (el('select', 'notice-input notice-seat-window-day'));
    day.setAttribute('aria-label', 'The window\'s day');
    SIEGE_WINDOW_DAYS.forEach((d, i) => { const o = /** @type {HTMLOptionElement} */ (el('option', null, d)); o.value = String(i); day.append(o); });
    day.value = String(want.day);
    const hour = /** @type {HTMLSelectElement} */ (el('select', 'notice-input notice-seat-window-hour'));
    hour.setAttribute('aria-label', 'The window\'s start');
    for (const h of SIEGE_WINDOW_HOURS) { const o = /** @type {HTMLOptionElement} */ (el('option', null, `${String(h).padStart(2, '0')}:00 UTC`)); o.value = String(h); hour.append(o); }
    hour.value = String(want.hour);
    day.onchange = () => { windowAsk = { day: Number(day.value), hour: want.hour }; ui.rerender(); };
    hour.onchange = () => { windowAsk = { day: want.day, hour: Number(hour.value) }; ui.rerender(); };
    const set = button('notice-seat-window-set', 'Set the window', () => act(() => book.window(seat, want.day, want.hour)));
    set.disabled = busy;
    out.append(day, hour, set);
    return out;
  }

  /** CROWN1 part two: THE ROYAL TOURNEY ruling at this crown this week (SEAT0 7.6) - what it is and gives, the ladder, and
   *  the doors into it (net/royalSession.js, through the world's hook): to contend, or to watch. */
  function royalNode(r) {
    const out = el('div', 'notice-seat-royal');
    const lines = royalTourneyLines(r);
    out.append(el('p', 'notice-seat-battle', lines[0]));
    for (const line of lines.slice(1)) out.append(el('p', 'notice-seat-mine', line));
    if (host.enterRoyal) {
      const busy = ui.busy();
      /** @type {Array<[string, string, boolean, string]>} */
      const doors = [['notice-seat-royal-enter', 'Enter the Royal Tourney', false, 'To the ring.'], ['notice-seat-royal-watch', 'Watch the Royal Tourney', true, 'You take your place to watch.']];
      for (const [cls, words, watch, said] of doors) {
        const b = button(cls, words, () => ui.run(async () => (host.enterRoyal(seat, r, watch) ? { ok: true, text: said } : { ok: false, text: '' })));
        b.disabled = busy;
        out.append(b);
      }
    }
    return out;
  }

  /** CROWN2: A GUILD'S CROWN POLITICS (SEAT0 7.8) - its liege, vassals, Pacts and the offers standing, for every member;
   *  for an Officer or the guildmaster, each one's lever and a guild's tag to offer fealty or a Pact to. */
  function politicsNode(p, lever) {
    const out = el('div', 'notice-seat-politics');
    const busy = ui.busy();
    out.append(el('p', 'notice-section', 'Fealty and Pacts'));
    const rows = politicsRows(p);
    if (!rows.length) out.append(el('p', 'notice-seat-mine', 'Your guild has no liege, no vassal and no Pact.'));
    const acts = {
      'fealty-accept': (t) => book.acceptFealty(t), 'fealty-withdraw': (t) => book.breakFealty(t), 'fealty-break': (t) => book.breakFealty(t),
      'pact-accept': (t) => book.offerPact(t), 'pact-withdraw': (t) => book.breakPact(t), 'pact-break': (t) => book.breakPact(t),
    };
    for (const r of rows) {
      const line = el('p', 'notice-seat-mine', r.text);
      if (lever && r.act) {
        const b = button(`notice-seat-${r.act}`, POLITICS_ACTS[r.act], () => act(() => acts[r.act](r.tag)));
        b.disabled = busy;
        line.append(b);
      }
      out.append(line);
    }
    if (!lever) return out;
    const tag = /** @type {HTMLInputElement} */ (el('input', 'notice-input notice-seat-politics-tag'));
    tag.setAttribute('aria-label', 'A guild\'s tag');
    tag.placeholder = 'Guild tag';
    tag.maxLength = 8;
    tag.value = politicsTag;
    tag.oninput = () => { politicsTag = tag.value.trim(); };
    out.append(tag);
    /** @type {Array<[string, string, (t: string) => Promise<any>]>} */
    const offers = [
      ['notice-seat-swear', 'Swear fealty', (t) => book.offerFealty(t, 'vassal')],
      ['notice-seat-take', 'Take as vassal', (t) => book.offerFealty(t, 'liege')],
      ['notice-seat-pact', 'Offer a Pact', (t) => book.offerPact(t)],
    ];
    for (const [cls, words, ask] of offers) {
      const b = button(cls, words, () => (politicsTag ? act(() => ask(politicsTag)) : null));
      b.disabled = busy;
      out.append(b);
    }
    return out;
  }

  /** SEAT2a: THE WEEK'S BATTLE (SEAT0 6.3-6.4) - its announcement, each side's roster, the reader's place on it (signed,
   *  or a button to sign while the rosters are open), and a side's Guildmaster's Sellswords. */
  function fightNode(f) {
    const out = el('div', 'notice-seat-fight');
    const busy = ui.busy();
    out.append(el('p', 'notice-seat-battle', battleAnnouncement(f, seat.name)));
    const label = f.kind === 'tourney' ? ['The first contender', 'The second contender'] : ['Attackers', 'Defenders'];
    out.append(el('p', 'notice-seat-mine', sideLine(label[0], f.sides.attack.n, f.max, f.sides.attack.swords)));
    out.append(el('p', 'notice-seat-mine', sideLine(label[1], f.sides.defend.n, f.max, f.sides.defend.swords)));
    const mine = f.mine ?? null;
    if (!f.open) out.append(el('p', 'notice-seat-mine', 'The rosters are closed.'));
    if (mine?.signed) {
      out.append(el('p', 'notice-seat-mine', `You are signed for the ${mine.side === 'attack' ? label[0].toLowerCase() : label[1].toLowerCase()}${mine.sellsword ? ' as a Sellsword' : ''}.`));
      if (f.open) { const b = button('notice-seat-unsign', 'Give back your place', () => act(() => book.unsign(seat))); b.disabled = busy; out.append(b); }
    } else if (f.open && (mine?.side || mine?.hire)) {
      const words = mine.hire ? `Sign as a Sellsword${mine.hire.fee ? ` (${mine.hire.fee} Drakes)` : ''}` : 'Sign for your side';
      const b = button('notice-seat-sign', words, () => act(() => book.sign(seat)));
      b.disabled = busy;
      out.append(b);
    }
    // SEAT2a part four: THE BATTLE ENTERED from here, while its door is open (ten minutes before the start to its
    // window's close) - a signed fighter to fight, anyone else to watch (net/siegeSession.js, through the world's hook)
    const nowS = ui.nowS();
    if (host.enterBattle && f.startsAt && nowS >= passOpens({ starts_at: f.startsAt }) && nowS < passWindowEnds({ starts_at: f.startsAt, kind: f.kind, tier: f.tier })) {
      const b = button('notice-seat-enter', mine?.signed ? 'Enter the battle' : 'Watch the battle', () => ui.run(async () => {
        const ok = host.enterBattle(seat, f);
        return ok ? { ok: true, text: mine?.signed ? 'To the field.' : 'You take your place to watch.' } : { ok: false, text: '' };
      }));
      b.disabled = busy;
      out.append(b);
    }
    if (mine?.hires && f.open) {
      for (const h of mine.hires) {
        const p = el('p', 'notice-seat-mine', `${h.handle} - ${h.state === 'signed' ? 'signed' : 'offered'}${h.fee ? `, ${h.fee} Drakes` : ''}.`);
        if (h.state === 'offered') { const w = button('notice-seat-withdraw', 'Withdraw', () => act(() => book.withdrawHire(seat, h.handle))); w.disabled = busy; p.append(w); }
        out.append(p);
      }
      if (mine.hires.length < f.swordsMax) {
        const n = /** @type {HTMLInputElement} */ (el('input', 'notice-input notice-seat-hire-name'));
        n.value = hireHandle; n.setAttribute('aria-label', 'The Sellsword\'s username'); n.setAttribute('data-focus', 'seat-hire-name');
        n.oninput = () => { hireHandle = n.value.trim(); };
        const fee = /** @type {HTMLInputElement} */ (el('input', 'notice-input notice-seat-hire-fee'));
        fee.type = 'number'; fee.min = '0'; fee.max = String(SELLSWORD_FEE_MAX); fee.value = String(hireFee);
        fee.setAttribute('aria-label', 'The Sellsword\'s fee in Drakes'); fee.setAttribute('data-focus', 'seat-hire-fee');
        fee.oninput = () => { hireFee = Math.max(0, Math.floor(Number(fee.value) || 0)); };
        const hire = button('notice-seat-hire', 'Hire a Sellsword', () => (hireHandle
          ? act(() => book.hire(seat, hireHandle, Math.min(SELLSWORD_FEE_MAX, hireFee)))
          : ui.run(async () => ({ ok: false, text: accountRefusalText('bad-handle') }))));
        hire.disabled = busy;
        out.append(n, fee, hire);
      }
    }
    return out;
  }

  return {
    /** The tab first shown: the standings read. */
    open: () => load(false),
    /** The standings read again (the window's refresh). */
    reload: () => load(true),
    body() {
      const body = el('div', 'notice-cork notice-seat');
      // SEAT1c: the Charter under its holder's banner, the holder, this week's battle
      const holder = data?.holder ?? null;
      const head = el('p', 'notice-section');
      const img = holder ? banner(holder.guild.heraldry, 30) : null;
      if (img) head.append(img);
      head.append(el('span', null, seatInfoLine(seat, holder?.guild ?? null)));
      body.append(head);
      if (!data) {
        const shut = SHUT.has(error ?? '');
        const p = el('p', 'notice-empty', loading || !error ? SEAT_TAB_WORDS.reading : shut ? (error === 'seat-unconfirmed' ? accountRefusalText(error) : SEAT_TAB_WORDS.shut) : SEAT_TAB_WORDS.slow);
        if (error && !shut && !loading) p.append(button('notice-retry', 'Try again', () => load(true)));
        body.append(p);
        return body;
      }
      body.append(el('p', 'notice-seat-mine', seatHolderLine(holder)));
      // SEAT1d: the Tithe and the Edict for everyone; the holder's own lines and its Officers' levers
      const rule = seatRuleLine(seat, holder);
      if (rule) body.append(el('p', 'notice-seat-mine', rule));
      if (data.holding) {
        for (const line of seatHoldingLines(seat, data.holding)) body.append(el('p', 'notice-seat-mine', line));
        if (SEAT_LEVER_RANKS.includes(data.mine?.rank)) body.append(holdingNode(data.holding));
      }
      // SEAT2a: the battle placed in the week, with its sides - or the Turning's line where none is placed (an older week)
      if (data.fight?.kind) body.append(fightNode(data.fight));
      else {
        const battle = seatBattleLine(data.battle ?? null);
        if (battle) body.append(el('p', 'notice-seat-battle', battle));
      }
      if (data.royal) body.append(royalNode(data.royal));   // CROWN1 part two: the Royal Tourney ruling here
      // SEAT2a: the holder's window, its Officers' and guildmaster's to set
      if (holder && data.mine?.guild === holder.guild.id && SEAT_LEVER_RANKS.includes(data.mine?.rank)) body.append(windowNode(data.fight?.window ?? null));
      const season = seasonLine(data.week, data.season ?? null);   // SEASON1
      if (season) body.append(el('p', 'notice-seat-week notice-seat-season', season));
      const tide = data.tides ? tideLine(seat.region, data.tides.now, data.tides.next) : null;   // SEASON1 part two (9.3)
      if (tide) body.append(el('p', 'notice-seat-week notice-seat-tide', tide));
      body.append(el('p', 'notice-seat-week', seatWeekLine(data, ui.nowS())));
      body.append(el('p', 'notice-section', 'This week\'s standings'));
      body.append(standingsNode());
      body.append(el('p', 'notice-seat-mine', seatClaimLine(seat, data.defence ?? null)));
      for (const line of seatMineLines(seat, data.mine ?? null, nameOf)) body.append(el('p', 'notice-seat-mine', line));
      if (data.mine) body.append(leversNode(data.mine));
      if (data.mine?.politics) body.append(politicsNode(data.mine.politics, SEAT_LEVER_RANKS.includes(data.mine.rank)));   // CROWN2
      // SEAT1c: the guildmaster of the holder gives the Charter up here, at its board - armed by a first press
      if (holder && data.mine?.guild === holder.guild.id && data.mine.rank === GUILD_RANK_MASTER) {
        const armed = () => ui.nowS() * 1000 - armedAt < SEAT_RELINQUISH_ARM_MS;   // asked at the press, not at the draw
        const b = button('notice-seat-relinquish', armed() ? SEAT_RELINQUISH_WORDS.sure : SEAT_RELINQUISH_WORDS.arm, () => {
          if (!armed()) { armedAt = ui.nowS() * 1000; ui.rerender(); return null; }
          armedAt = -Infinity;
          return act(() => book.relinquish(seat));
        });
        b.disabled = ui.busy();
        body.append(b);
      }
      // SEAT1c: the Chronicle (SEAT0 9.2), newest first
      const lines = (data.chronicle ?? []).map((r) => chronicleLine(r, seat)).filter(Boolean);
      if (lines.length) {
        body.append(el('p', 'notice-section', 'The Chronicle'));
        const ol = el('ol', 'notice-chronicle');
        for (const l of lines) ol.append(el('li', null, l));
        body.append(ol);
      }
      return body;
    },
  };
}
