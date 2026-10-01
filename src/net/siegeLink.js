// @ts-check
// SEAT2a part four (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): WHAT THE
// CLIENT HOLDS OF A SIEGE - the room's words (net/wire.js validSiegeOut) folded into one state: the field (the banners,
// the Throne, the clock, who is in), the roll call (every fighter's vitality and side), the end and this fighter's own
// receipt; and the HUD's words for it (bible/11-Multiplayer/Seats-Arc.md 19, "The siege HUD" and "The result card").
//
// PURE: a state and a word in, the next state out (`foldSiege`); the words from a state and what the client knows of the
// battle (its seat, its two guilds, its kind and tier, this player's id and side). The session around it (scenes/
// world.js) keeps the state, moves the player on a `back` or a rise at its camp, and carries the receipt to the service
// (net/siegeClaims.js).
//
// Not a DFU member. Ledger A (EVERY PALACE A SEAT's row).
//
// SEAT2b part two (2026-10-01, Mac: "I want to finish the inprogress"): THE WORKS, THE FIGURES AND THE REVOLT
// (bible/11-Multiplayer/Seats-Arc.md 6.2, 7.5, 7.7, 19; SEAT2b part two's contract, items 1-6) - the relay's `w` (the
// Gatehouse `[hp, max]` or 0, its breach, the standing Ram `[hp, max, crew, swing]` or 0, the Ram Kits still to field)
// and `n` (the relay-run figures: the Barracks' guards, a revolt's twelve rebels and its Rebel Captain) folded beside the
// rest, a `fell` naming a figure kept off the roll call; what the battle froze read off the pass the service handed this
// client (`readSiegePass` - its works `sx`, its kind, its settled field `sf`), where its works stand (`siegeWorksPoints`)
// and the side rule at a figure or a work (`siegeStrikesAt` - the relay's own). THE HUD'S WORDS for them: the Gatehouse's
// vitality or BREACHED, the standing Ram (its vitality, the attackers at it and its swing to the next stroke), the kits to
// come, the guards up and down (`siegeWorksLine`); the Throne's rule "and the Gatehouse breached" where a gate stands; a
// defender's wave by the pass's Walls (net/fortLaw.js defendersWaveMs). A REVOLT'S HUD: no banners and no Throne - the
// Rebel Captain's vitality, the rebels standing, the clock (hours past an hour: a revolt runs two); its card in its own
// words, the Chronicle's (net/townSeatLaw.js chronicleLine), and DECIDED (the contract's item 6: "No Honours for a
// revolt"): it promises none - its receipt is CARRIED (the revolt's end reaches the Charter by it), never claimed.
import { SIEGE_THRONE, SIEGE_BANNER_NAMES, SIEGE_SPECTATORS_MAX, SIEGE_WAVE_MS, SIEGE_UNITS_PER_M, siegeNextWave } from './siegeRef.js';
import { defendersWaveMs, RAM, RAM_OFFSET_M, REVOLT } from './fortLaw.js';   // SEAT2b part two: a defender's wave, a Ram's stroke and its place, the revolt's twelve
import { isSiegeFigure, siegeFigureKind } from './wire.js';   // SEAT2b part two: a figure's id, and its kind by its letter
import { orderValid, _b64url } from './identityToken.js';   // SEAT2b part two: a pass read for what its battle froze
import { chronicleLine, chronicleWhen } from './townSeatLaw.js';   // SEAT2b part two: a revolt's card in the Chronicle's words

/**
 * @typedef {{ hp: number, max: number, down: boolean, side: 'attack'|'defend'|null }} SiegeFighter
 * @typedef {{ id: string, kind: number, x: number, z: number, tx: number, tz: number, hp: number, max: number, down: boolean,
 *   act: number }} SiegeFigure
 * @typedef {{ g: any, br: number, r: any, rl: number }} SiegeWorks
 * @typedef {{ banners: ReadonlyArray<ReadonlyArray<number>>, throne: number, startMs: number, endMs: number,
 *   counts: ReadonlyArray<number>, roll: Readonly<Record<string, SiegeFighter>>, end: { r: string, a: number }|null,
 *   receipt: string|null, no: string|null, heardAt: number, fellAt: Readonly<Record<string, number>>,
 *   works: SiegeWorks|null, figures: ReadonlyArray<SiegeFigure>, figuresAt: number }} SiegeState
 */
/** Nothing heard yet. SEAT2b part two: no works heard (an older relay's battle says none), no figures. @type {Readonly<SiegeState>} */
export const SIEGE_STATE_EMPTY = Object.freeze({
  banners: Object.freeze([]), throne: 0, startMs: 0, endMs: 0, counts: Object.freeze([0, 0, 0]), roll: Object.freeze({}),
  end: null, receipt: null, no: null, heardAt: 0, fellAt: Object.freeze({}),
  works: null, figures: Object.freeze([]), figuresAt: 0,
});
/** @type {ReadonlyArray<'attack'|'defend'|null>} */
const SIDE = [null, 'attack', 'defend'];

/**
 * One word folded in: the roll call replaces every fighter's; one fighter's vitality, fall and rise move its own; the
 * field replaces the field; the end is said once, and a receipt once heard is kept. A `back` moves the player, not the
 * state. SEAT2b part two: the works replace the works; the figures replace the figures (the relay names every one standing
 * or down, each beat - `figuresAt` the walk's clock); a felled figure lies down until its next row - never a fighter of
 * the roll call. @param {Readonly<SiegeState>} s @param {any} g a validSiegeOut projection @param {number} now
 * @returns {Readonly<SiegeState>}
 */
export function foldSiege(s, g, now) {
  if (!g) return s;
  switch (g.k) {
    case 'w': return { ...s, works: { g: g.g, br: g.br, r: g.r, rl: g.rl } };
    case 'n': return { ...s, figures: g.n.map(([id, kind, x, z, tx, tz, hp, max, down, act]) => ({ id, kind, x, z, tx, tz, hp, max, down: down === 1, act })), figuresAt: now };
    case 'st': {
      /** @type {Record<string, SiegeFighter>} */
      const roll = {};
      for (const [id, hp, max, down, side] of g.f) roll[id] = { hp, max, down: down === 1, side: SIDE[side ?? 0] ?? null };
      return { ...s, roll, heardAt: now };
    }
    case 'hp': {
      const was = s.roll[g.id];
      return { ...s, roll: { ...s.roll, [g.id]: { hp: g.h, max: g.m, down: g.h > 0 ? false : (was?.down ?? false), side: was?.side ?? null } }, heardAt: now };
    }
    case 'fell': {
      if (isSiegeFigure(g.id)) return { ...s, figures: s.figures.map((f) => (f.id === g.id ? { ...f, hp: 0, down: true, act: 0 } : f)), heardAt: now };   // SEAT2b part two
      const was = s.roll[g.id];
      return { ...s, roll: { ...s.roll, [g.id]: { hp: 0, max: was?.max ?? 0, down: true, side: was?.side ?? null } }, fellAt: { ...s.fellAt, [g.id]: now }, heardAt: now };
    }
    case 'up': {
      const was = s.roll[g.id];
      return { ...s, roll: { ...s.roll, [g.id]: { hp: was?.max ?? 0, max: was?.max ?? 0, down: false, side: was?.side ?? null } }, heardAt: now };
    }
    case 'f': return { ...s, banners: g.b, throne: g.th, startMs: g.s, endMs: g.e, counts: g.n, heardAt: now };
    case 'end': return { ...s, end: { r: g.r, a: g.a }, receipt: g.rc ?? s.receipt, heardAt: now };
    case 'no': return { ...s, no: g.m, heardAt: now };
    default: return s;
  }
}

// ─── SEAT2b part two: THE PASS, THE WORKS' PLACES, THE SIDE RULE ─────

/** WHAT A PASS SAYS (net/identityToken.js's `siege` order): its claims, read off the token the service handed this client -
 *  its signature is the relay's to check, never this reader's; the client reads the battle's frozen works (`sx`), its kind
 *  (`sn`) and its settled field (`sf`) off it - or null for anything that is not a pass's (an unreadable token, another
 *  order, claims the order law refuses). */
export function readSiegePass(pass) {
  if (typeof pass !== 'string') return null;
  const parts = pass.split('.');
  if (parts.length !== 3) return null;
  let c = null;
  try { c = JSON.parse(new TextDecoder().decode(_b64url.decode(parts[1]))); } catch { return null; }   // a body that is not base64url JSON throws here
  return c?.o === 'siege' && orderValid(c) ? c : null;
}
/** WHERE THE WORKS STAND (the contract's items 2 and 4): the Gatehouse at the Throne's point; a Ram RAM_OFFSET_M before it,
 *  on the line to the attackers' camp (DECIDED: the `w` frame names no place - this is the relay's own arithmetic on the
 *  field the pass carries). `field` a pass's (net/siegeRef.js fieldOf), in the room's units; `{ gate, ram }` (each
 *  `[x, z]`), or null with no field. */
export function siegeWorksPoints(field) {
  if (!field?.throne) return null;
  const [gx, gz] = field.throne, camp = field.camps?.attack ?? field.throne;
  const dx = camp[0] - gx, dz = camp[1] - gz, l = Math.hypot(dx, dz);
  const k = l > 1e-9 ? (RAM_OFFSET_M * SIEGE_UNITS_PER_M) / l : 0;
  return { gate: [gx, gz], ram: [gx + dx * k, gz + dz * k] };
}
/** THE SIDE RULE AT A FIGURE OR A WORK (the contract's items 3, 5, 6 - the relay's own): the attackers strike the Barracks'
 *  guards and the Gatehouse; the defenders - a revolt's holder's side among them - the Ram, the rebels and their Captain;
 *  a spectator nothing. Never a side's own figure or work. */
export function siegeStrikesAt(side, id) {
  if (side === 'attack') return id === '~gate' || (isSiegeFigure(id) && siegeFigureKind(id) === 0);
  if (side === 'defend') return id === '~ram' || (isSiegeFigure(id) && siegeFigureKind(id) > 0);
  return false;
}

// ─── THE HUD'S WORDS (Seats-Arc 19) ─────────────────────────────────

/** A guild in the HUD's words: its tag, or its name. */
const tagOf = (g) => (g?.tag ? g.tag : g?.name ?? '');
/** mm:ss, never negative - SEAT2b part two: h:mm:ss past an hour (a revolt's window runs two). */
export const siegeClockText = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), ss = String(t % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`; };
/** The bar's clock: to the start, then to the end; nothing before the field is heard. */
const clockOf = (s, now) => (!s.startMs ? '' : now < s.startMs ? `joined in ${siegeClockText(s.startMs - now)}` : siegeClockText(s.endMs - now));
/** A banner's mark (19: "^ attackers, o defenders, ~ contested" - DECIDED here: `~` a banner being raised from the other
 *  side, its raise beside it). */
export function bannerMark(b, att, def) {
  const [held, raise, by] = b;
  if (by && by !== held && raise > 0) return `~ ${raise}/20`;
  return held === 1 ? `^ ${tagOf(att)}` : held === 2 ? `o ${tagOf(def)}` : '-';
}
/**
 * THE BAR: `[title line, banner line]` - the seat in capitals, the holder against the challenger, the clock (to the
 * start, then to the end); each banner by name and mark, and the Throne (a siege's) - its share of the hold and the rule
 * that opens it. `battle` `{ seat, kind, tier, attacker, defender }` (the guilds `{ name, tag }`). SEAT2b part two (the
 * contract's item 3): where a Gatehouse stands, the Throne opens only while its banners rule holds AND it is breached -
 * the rule says so.
 */
export function siegeBarLines(s, battle, now) {
  const head = `${String(battle.seat ?? '').toUpperCase()}   ${battle.defender?.name ?? ''} <${tagOf(battle.defender)}>   vs   ${battle.attacker?.name ?? ''} <${tagOf(battle.attacker)}>`;
  const clock = clockOf(s, now);
  const names = SIEGE_BANNER_NAMES.slice(0, s.banners.length);
  const marks = s.banners.map((b, i) => `${names[i].toUpperCase()} [${bannerMark(b, battle.attacker, battle.defender)}]`).join('    ');
  let throne = '';
  if (battle.kind === 'siege') {
    const rule = SIEGE_THRONE[battle.tier] ?? SIEGE_THRONE.palace;
    const held = s.banners.filter((b) => b[0] === 1).length;
    const pct = Math.min(100, Math.floor((100 * s.throne) / rule.holdS));
    const gate = !!s.works?.g;
    const open = held >= rule.banners && (!gate || s.works?.br === 1);
    throne = `THRONE ${open ? 'OPEN ' : ''}${pct}% (${rule.banners} of ${s.banners.length}${gate ? ' and the Gatehouse breached' : ''})`;
  }
  return [`${head}   ${clock}`.trimEnd(), `${marks}${throne ? `    ${throne}` : ''}`];
}
const num = (n) => Number(n).toLocaleString('en-US');
/** SEAT2b part two: THE WORKS' LINE under the bar (19's layout, its third line) - the Gatehouse's vitality, or BREACHED;
 *  the standing Ram: its vitality, the attackers at it and its swing to the next stroke (held while fewer than RAM.crew
 *  stand within its reach - the swing pauses, never empties); the Ram Kits still to come; the Barracks' guards up and
 *  down. '' where the battle holds none of them (or its relay says none). */
export function siegeWorksLine(s) {
  const w = s.works, out = [];
  if (w?.g) out.push(w.br === 1 ? 'GATEHOUSE BREACHED' : `GATEHOUSE ${num(w.g[0])} / ${num(w.g[1])}`);
  if (w?.r) {
    const [hp, max, crew, swing] = w.r;
    out.push(`RAM ${num(hp)} / ${num(max)} - ${crew} at it, ${crew >= RAM.crew ? `a stroke in ${Math.max(0, RAM.everyMs / 1000 - swing)} s` : 'its swing held'}`);
  }
  if (w?.rl) out.push(`${w.rl} Ram Kit${w.rl === 1 ? '' : 's'} to come`);
  const guards = s.figures.filter((f) => f.kind === 0);
  if (guards.length) { const down = guards.filter((f) => f.down).length; out.push(`GUARDS ${guards.length - down} up / ${down} down`); }
  return out.join('    ');
}
/** Each side's fighters up and down, off the roll call: `SH  8 up / 2 down`. */
export function siegeSidesLine(s, battle) {
  const n = { attack: [0, 0], defend: [0, 0] };
  for (const f of Object.values(s.roll)) if (f.side) n[f.side][f.down ? 1 : 0]++;
  return `${tagOf(battle.defender)}  ${n.defend[0]} up / ${n.defend[1]} down      ${tagOf(battle.attacker)}  ${n.attack[0]} up / ${n.attack[1]} down`;
}
/** SEAT2b part two (the contract's item 1): a side's wave - the defenders' the Walls' faster one (net/fortLaw.js
 *  defendersWaveMs, `walls` the pass's tier - a revolt's holder's side is the defenders), the attackers' the base. */
const sideWave = (side, base, walls) => (side === 'defend' ? defendersWaveMs(base, walls) : base);
/** This fighter's own lines - its vitality, and when it has fallen, its wave (`waveMs` the tier's; SEAT2b part two: a
 *  defender's by the pass's Walls) - or the spectator's. */
export function siegeSelfLines(s, me, now, { tier = 'palace', watching = false, walls = 0 } = {}) {
  if (watching) return [`Spectating - ${s.counts[2] ?? 0} of ${SIEGE_SPECTATORS_MAX}`];
  const f = s.roll[me];
  if (!f) return [];
  const bars = f.max > 0 ? Math.round((10 * f.hp) / f.max) : 0;
  const out = [`vitality  ${'|'.repeat(bars)}${'.'.repeat(10 - bars)}  ${f.hp} / ${f.max}`];
  if (f.down) out.push(`next wave in ${Math.max(0, Math.ceil((siegeNextWave(s.fellAt[me] ?? now, sideWave(f.side, SIEGE_WAVE_MS[tier] ?? SIEGE_WAVE_MS.palace, walls)) - now) / 1000))} s`);
  return out;
}
/** THE RESULT CARD's title (19), in capitals: who holds or takes the Throne, the forfeit, the absence, a Tourney's
 *  winner, a dead heat. */
export function siegeResultTitle(end, battle) {
  const seat = String(battle.seat ?? '').toUpperCase();
  const D = String(battle.defender?.name ?? '').toUpperCase(), A = String(battle.attacker?.name ?? '').toUpperCase();
  if (battle.kind === 'tourney') {
    if (end.r === 'attack') return `${A} WINS THE TOURNEY FOR ${seat}`;
    if (end.r === 'defend') return `${D} WINS THE TOURNEY FOR ${seat}`;
    return `A DEAD HEAT AT ${seat} - THE GREATER INFLUENCE TAKES IT`;
  }
  if (end.r === 'attack') return `${A} TAKES THE THRONE OF ${seat}`;
  if (end.r === 'forfeit') return `${A} NEVER CAME - ${D} HOLDS ${seat}`;
  if (end.r === 'absent') return `NEITHER SIDE CAME - ${D} KEEPS ${seat}`;
  return `${D} HOLDS THE THRONE OF ${seat}`;
}
/** The card's second line: how long it ran, and each banner's mark at the end. */
export function siegeResultLine(s) {
  const t = Math.max(0, Math.round(((s.heardAt || s.startMs) - s.startMs) / 1000));
  const names = SIEGE_BANNER_NAMES.slice(0, s.banners.length);
  const marks = s.banners.map((b, i) => `${names[i]} ${b[0] === 1 ? '^' : b[0] === 2 ? 'o' : '-'}`).join('  ');
  return `${Math.floor(t / 60)} minutes ${t % 60} seconds.  ${marks}`.trimEnd();
}
/** AUDIT-SEATS C7: THE CARD'S WORDS FOR A CLAIM REFUSED FOR GOOD (net/siegeClaims.js siegeClaimSettles) - claimed before,
 *  the battle void or gone, a receipt that is not the relay's (the account service's words for those - accountRefusalText
 *  - speak of a gate's receipt and of signing a roster, not of this battle's Honours). SEAT2b part two: `battle-void` too -
 *  the service's word for a battle its Turning voided (server-account/src/seatSiege.js claimSiege, AUDIT-SEATS S3; settled
 *  by siegeClaimSettles), said as the void it is, never as a receipt that could not be read. */
export const SIEGE_CLAIM_REFUSED = Object.freeze({
  'honours-twice': 'Your Honours from this battle are claimed already.',
  'battle-none': 'No Honours this battle: the battle was void.',
  'battle-void': 'No Honours this battle: the battle was void.',
  receipt: 'No Honours this battle: your receipt from it could not be read.',
});
/** AUDIT-SEATS C7: a settling refusal (`{ ok: false, error }`) in the card's words. */
export const siegeClaimRefusal = (a) => SIEGE_CLAIM_REFUSED[a?.error] ?? SIEGE_CLAIM_REFUSED.receipt;
/** The card's Honours line, once the service answered the claim (`honours` its answer, null for none earned; AUDIT-SEATS
 *  C7: a refusal's own words, siegeClaimRefusal). */
export function siegeHonourLine(honours) {
  if (typeof honours === 'string') return honours;
  if (!honours) return 'No Honours this battle: they are earned by standing half the battle or felling a foe.';
  if (honours.spent) return 'Your Honour: these two guilds\' Honours were earned already this Season.';
  return `Your Honour: ${honours.marks} Marks, ${Number(honours.xp).toLocaleString('en-US')} Renown, one Spoils of War roll`;
}

// ─── SEAT2b part two: A REVOLT'S HUD AND ITS CARD (Seats-Arc 7.7, 9.2, 19) ─────

/** A REVOLT'S BAR - no banners and no Throne (the contract's item 6): the seat against its holder and the clock; the Rebel
 *  Captain's vitality (his fall ends it) and the rebels standing of REVOLT.rebels - before the relay names them, where
 *  they wait. */
export function revoltBarLines(s, battle, now) {
  const head = `${String(battle.seat ?? '').toUpperCase()}   ${battle.defender?.name ?? ''} <${tagOf(battle.defender)}>   against the rebels`;
  const cap = s.figures.find((f) => f.kind === 2);
  const up = s.figures.reduce((n, f) => n + (f.kind === 1 && !f.down ? 1 : 0), 0);
  const line = !cap ? 'THE REBELS HOLD THE PALACE DOOR'
    : `${cap.down ? 'THE REBEL CAPTAIN HAS FALLEN' : `REBEL CAPTAIN ${cap.hp} / ${cap.max}`}    REBELS ${up} of ${REVOLT.rebels} standing`;
  return [`${head}   ${clockOf(s, now)}`.trimEnd(), line];
}
/** A revolt's one side - the holder's (its foes are the relay's rebels, no roll call's). */
export function revoltSidesLine(s, battle) {
  let up = 0, down = 0;
  for (const f of Object.values(s.roll)) if (f.side === 'defend') { if (f.down) down++; else up++; }
  return `${tagOf(battle.defender)}  ${up} up / ${down} down`;
}
/** A REVOLT'S CARD TITLE in 19's capitals: the Captain felled - put down, the Charter holds; the window run out with him
 *  standing - the rebels hold, the Charter lapses (7.7). */
export function revoltResultTitle(end, battle) {
  const seat = String(battle.seat ?? '').toUpperCase();
  return end.r === 'defend' ? `THE REVOLT AT ${seat} IS PUT DOWN - THE CHARTER HOLDS` : `THE REBELS HOLD ${seat} - THE CHARTER LAPSES`;
}
/** ITS LINE IN THE CHRONICLE'S OWN WORDS (net/townSeatLaw.js chronicleLine's `revolt-down` and `revolt-lapsed` - 9.2's
 *  "Anticlere rose against the Silver Hand. The rebel captain fell at the palace door, and the Charter held."), less the
 *  week the Chronicle names it by (chronicleWhen's own clause) - the sentence opens on the seat's name. A crown's Charter is
 *  named by its city (net/townSeatLaw.js charterName - each crown city its kingdom's name). */
export function revoltResultLine(end, battle) {
  const line = chronicleLine({ kind: end.r === 'defend' ? 'revolt-down' : 'revolt-lapsed', week: 0, data: { guild: battle.defender ?? { name: '', tag: '' } } }, { name: battle.seat ?? '', tier: battle.tier }) ?? '';
  const when = `${chronicleWhen(0)}, `;
  return line.startsWith(when) ? line.slice(when.length) : line;
}
/** DECIDED (the contract's item 6: "No Honours for a revolt"): A REVOLT'S CARD PROMISES NONE - its receipt is carried (the
 *  revolt's end reaches the Charter by it). Its words while kept and once carried; its button's (a siege's Claim). */
export const REVOLT_CARD_WORDS = Object.freeze({
  kept: 'Your receipt is kept - carry it, and the revolt\'s end reaches the Charter. A revolt earns no Honours.',
  carried: 'The revolt\'s end is carried to the Charter. A revolt earns no Honours.',
});
export const SIEGE_CARD_WORDS = Object.freeze({ claim: 'Claim', carry: 'Carry' });
/** A carry refused for good (net/siegeClaims.js siegeClaimSettles), in a revolt's words - none speaks of Honours. */
export const REVOLT_CLAIM_REFUSED = Object.freeze({
  'honours-twice': 'The revolt\'s end was carried already.',
  'battle-none': 'The revolt was void - there is nothing to carry.',
  'battle-void': 'The revolt was void - there is nothing to carry.',
  receipt: 'Your receipt from the revolt could not be read.',
});
export const revoltClaimRefusal = (a) => REVOLT_CLAIM_REFUSED[a?.error] ?? REVOLT_CLAIM_REFUSED.receipt;
const revoltHonourLine = (honours, claimable) => (honours === undefined ? (claimable ? REVOLT_CARD_WORDS.kept : '') : typeof honours === 'string' ? honours : REVOLT_CARD_WORDS.carried);

/**
 * WHAT THE HUD SAYS: `{ bar: [title, banners], sides, self: [...], card: { title, line, honour, claim } | null }`.
 * `battle` `{ seat, kind, tier, attacker, defender }`; `me` this player's peer id; `watching` a spectator; `honours` the
 * service's answer to the claim (undefined: not yet asked), `claimable` a receipt is kept to claim. SEAT2b part two: and
 * `works` (the works' line, '' for none), the card's `button`; `walls` the pass's Walls (a defender's wave); a REVOLT's
 * (`battle.kind` 'revolt') bar, side and card its own.
 */
export function siegeHudModel(s, battle, me, now, { watching = false, honours = undefined, claimable = false, walls = 0 } = {}) {
  const revolt = battle.kind === 'revolt';
  const card = s.end ? {
    title: revolt ? revoltResultTitle(s.end, battle) : siegeResultTitle(s.end, battle),
    line: revolt ? revoltResultLine(s.end, battle) : siegeResultLine(s),
    honour: watching ? '' : revolt ? revoltHonourLine(honours, claimable) : honours === undefined ? (claimable ? 'Your receipt is kept - claim it for your Honours.' : '') : siegeHonourLine(honours),
    claim: !watching && honours === undefined && claimable,
    button: revolt ? SIEGE_CARD_WORDS.carry : SIEGE_CARD_WORDS.claim,
  } : null;
  return {
    bar: revolt ? revoltBarLines(s, battle, now) : siegeBarLines(s, battle, now),
    works: revolt ? '' : siegeWorksLine(s),
    sides: revolt ? revoltSidesLine(s, battle) : siegeSidesLine(s, battle),
    self: siegeSelfLines(s, me, now, { tier: battle.tier, watching, walls }),
    card,
  };
}
