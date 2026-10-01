// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEAT1 (2026-09-30, Mac: "Finish the seats"; "Or we could go ahead and
// do sieges") - THE SEATS' LAW, ONE HOME FOR EVERY END: the numbers of
// bible/11-Multiplayer/Seats-Arc.md Appendix B, the seat's shape as a
// client derives and reports it, the witnessed registry's rule (3.2),
// the Charter's and the arrival's words (3.3), the map's marks (3.3),
// and the seat week's clock (5.1). The record decided every number;
// balance is an edit here, pinned by its own tests, never a hunt (SEAT0:
// "Every number lives in ONE pure law module").
//
// THE WORD "SEAT" IS TAKEN IN THE CODE (ONE-SEAT, SEAT-HEAL, the party's
// kept seat): the player reads "seat", the code says `townSeat`.
//
// Pure: no clock, no DOM, no network. The account service
// (server-account/src/townSeats.js), the client's derivation
// (systems/townSeats.js) and its book (net/townSeatBook.js) read it.
// ═══════════════════════════════════════════════════════════════════
import { ONLINE_EPOCH_MS } from './wire.js';
import { KINGDOMS, MARCHES, kingdomOf, isMarch, isFreeLand } from './kingdomLaw.js';

/** A seat's tier: a crown (the three capitals) or a palace (every other location with a Palace) - SEAT0 3.1. */
export const SEAT_TIERS = Object.freeze(['palace', 'crown']);
/** The crown seats, by their region's index (REGION_NAMES) - Daggerfall, Wayrest, Sentinel (SEAT0 3.2: "Crown seats
 *  must also match: tier crown, name in HUB_CAPITALS, region index 17, 23 or 20"). */
export const CROWN_SEAT_REGIONS = Object.freeze({ 17: 'daggerfall', 23: 'wayrest', 20: 'sentinel' });

/** THE WITNESSED REGISTRY (SEAT0 3.2, Appendix B). A seat is witnessed as the professions' pixels are - ONE table
 *  (`world_witness`, the kind `seat`, keyed by the map id) and ONE law (net/nodeLaw.js witnessedFact and WITNESS: an
 *  account a week registered; three agreeing byte for byte confirm; two agreeing on another answer dispute). What is
 *  the seats' own: an account whose disagreements match nobody else's three times has its seat reports ignored for a
 *  week; 24 reports an account an hour; a client reports a seat town it stands in once a UTC day. */
export const SEAT_WITNESS_UNMATCHED_MAX = 3;
/** THE AUDIT (SEAT0 3.2: "a seat confirmed by exactly three witnesses whom nobody else ever joins"): a seat whose
 *  confirmation still rests on this many (WITNESS.confirm), no fourth ever agreeing, is listed for a person to read. */
export const SEAT_WITNESSES_AUDIT = 3;
export const SEAT_WITNESS_IGNORED_S = 7 * 86400;
export const SEAT_WITNESS_REPORTS_HOUR = 24;
export const SEAT_REPORT_EVERY_S = 86400;

/** The switch the service's config holds (SEATS_OPEN, SEAT0 18): off, dev (the developers alone), on. */
export const SEATS_SWITCH = Object.freeze(['off', 'dev', 'on']);
export const seatsSwitchOf = (v) => (SEATS_SWITCH.includes(v) ? v : 'off');

/** A seat's key: its location's MAPS.BSA map id, unsigned (regionHubs.js's key). */
export const seatKeyOk = (k) => Number.isSafeInteger(k) && k >= 0 && k <= 0xffffffff;
/** A region index MAPS.BSA holds (0-61). */
export const seatRegionOk = (r) => Number.isSafeInteger(r) && r >= 0 && r <= 61;
/** A map pixel (MAPS.BSA's 1000 x 500). */
const pixelOk = (p) => Array.isArray(p) && p.length === 2 && Number.isSafeInteger(p[0]) && Number.isSafeInteger(p[1])
  && p[0] >= 0 && p[0] < 1000 && p[1] >= 0 && p[1] < 500;
/** A location's name as MAPS.BSA spells it - printable, bounded. */
const nameOk = (n) => typeof n === 'string' && n.length >= 1 && n.length <= 48 && /^[\x20-\x7e]+$/.test(n) && n.trim() === n;

/**
 * A SEAT AS A CLIENT REPORTS IT, checked and CANONICAL - `{ key, name, region, tier, pixel: [x, y] }` in that key order,
 * so two witnesses who derived the same seat report the same bytes (seatReportText) - or null. A crown must stand in
 * its crown's region and bear its name (SEAT0 3.2); the rest is the shape.
 * @param {any} raw
 */
export function seatReportOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { key, name, region, tier, pixel } = raw;
  if (!seatKeyOk(key) || !nameOk(name) || !seatRegionOk(region) || !SEAT_TIERS.includes(tier) || !pixelOk(pixel)) return null;
  // a crown stands in its crown's region and bears its name (SEAT0 3.2: "tier crown, name in HUB_CAPITALS, region index
  // 17, 23 or 20")
  if (tier === 'crown' && (!Object.prototype.hasOwnProperty.call(CROWN_SEAT_REGIONS, region) || name !== KINGDOMS[CROWN_SEAT_REGIONS[region]]?.name)) return null;
  return { key, name, region, tier, pixel: [pixel[0], pixel[1]] };
}
/** The report's bytes - what three witnesses must agree on, byte for byte. */
export const seatReportText = (seat) => JSON.stringify([seat.key, seat.name, seat.region, seat.tier, seat.pixel[0], seat.pixel[1]]);

/** A seat's report read back (witnessedFact's `parse`): the seat it names, or null for a report that is no seat's. */
export function parseSeatReport(text) {
  let a;
  try { a = JSON.parse(text); } catch { return null; }
  if (!Array.isArray(a) || a.length !== 6) return null;
  const seat = seatReportOf({ key: a[0], name: a[1], region: a[2], tier: a[3], pixel: [a[4], a[5]] });
  return seat && seatReportText(seat) === text ? { seat } : null;
}

/**
 * THE ACCOUNTS WHOSE SEAT REPORTS ARE IGNORED (SEAT0 3.2: "An account whose disagreements match nobody else's three times
 * has its reports ignored for a week"): over every seat's reports (`[{ key, account, report, at }]`) and each seat's
 * confirmed answer (`confirmed`: key -> text), an account that, in the last SEAT_WITNESS_IGNORED_S before `nowS`, gave
 * SEAT_WITNESS_UNMATCHED_MAX answers that differ from the confirmed one and that no other account gave. Pure.
 * @param {{ key: string, account: string, report: string, at: number }[]} rows
 * @param {Map<string, string>} confirmed
 * @param {number} nowS
 */
export function seatIgnoredAccounts(rows, confirmed, nowS) {
  const givers = new Map();   // `${key}\n${report}` -> accounts
  for (const r of rows ?? []) {
    const k = `${r.key}\n${r.report}`;
    const set = givers.get(k) ?? new Set();
    set.add(r.account);
    givers.set(k, set);
  }
  const unmatched = new Map();
  for (const r of rows ?? []) {
    const c = confirmed.get(r.key);
    if (c == null || r.report === c || r.at < nowS - SEAT_WITNESS_IGNORED_S) continue;
    if ((givers.get(`${r.key}\n${r.report}`)?.size ?? 0) > 1) continue;
    unmatched.set(r.account, (unmatched.get(r.account) ?? 0) + 1);
  }
  return new Set([...unmatched].filter(([, n]) => n >= SEAT_WITNESS_UNMATCHED_MAX).map(([a]) => a));
}

/** The kingdom a seat is under (kingdomLaw.js) - its id, or null for a March or a Free Land. */
export const seatKingdomOf = (seat) => kingdomOf(seat?.region);
/** A kingdom's name. */
export const kingdomName = (id) => KINGDOMS[id]?.name ?? null;

/** THE CHARTER (SEAT0 3.3): "the Charter of <Town>", or a crown's "the Crown Charter of <Kingdom>". */
export function charterName(seat) {
  if (seat?.tier === 'crown') return `the Crown Charter of ${kingdomName(CROWN_SEAT_REGIONS[seat.region]) ?? seat.name}`;
  return `the Charter of ${seat?.name ?? 'the town'}`;
}
/** A guild as the arrival line names it: "the Silver Hand <SH>". */
const guildWords = (g) => `${/^the /i.test(g.name) ? `the ${g.name.slice(4)}` : g.name} <${g.tag}>`;
/**
 * THE ARRIVAL LINE (SEAT0 3.3 - HUB1's five-second line, extended to every seat): "Anticlere. Its Charter is unheld."; a
 * held one "Anticlere, held by the Silver Hand <SH>."; a crown "Wayrest, capital of the Kingdom of Wayrest, held by the
 * Ebon Oath <EO>." (unheld: "... Its Crown Charter is unheld.").
 * @param {{ name: string, tier: string, region: number }} seat
 * @param {{ name: string, tag: string }|null} [holder]
 */
export function seatArrivalLine(seat, holder = null) {
  if (seat.tier === 'crown') {
    const k = kingdomName(CROWN_SEAT_REGIONS[seat.region]) ?? seat.name;
    return holder ? `${seat.name}, capital of the Kingdom of ${k}, held by ${guildWords(holder)}.` : `${seat.name}, capital of the Kingdom of ${k}. Its Crown Charter is unheld.`;
  }
  return holder ? `${seat.name}, held by ${guildWords(holder)}.` : `${seat.name}. Its Charter is unheld.`;
}

/** The map's line for a seat, in its box: "The Charter of Anticlere: unheld" (SEAT1c: "held by the Silver Hand <SH>"). */
export function seatInfoLine(seat, holder = null) {
  const c = charterName(seat);
  return `${c[0].toUpperCase()}${c.slice(1)}: ${holder ? `held by ${guildWords(holder)}` : 'unheld'}`;
}

/** THE MAP'S MARKS (SEAT0 3.3): the unheld ring's stone grey; each crown's metal; a free land's green. */
export const SEAT_RING_UNHELD = '#8a8a8a';
export const KINGDOM_METALS = Object.freeze({ daggerfall: '#3b6fd8', wayrest: '#b3262e', sentinel: '#d4a017' });
export const FREE_LAND_RING = '#2f8f4e';
/** The same metals as heraldry colours (net/heraldryLaw.js keys) - the kingdom's plain banner at an unheld seat. */
export const KINGDOM_BANNER_COLOURS = Object.freeze({ daggerfall: 'azure', wayrest: 'crimson', sentinel: 'gold' });
/**
 * How a seat is marked on the map - `{ ring, crown, second }`: the ring's colour (unheld stone grey; SEAT1c's holders
 * fill it), the crown's metal over a crown seat (or null), and a thin second ring - a March's in both claiming crowns'
 * metals, a Free Land's green - or null.
 * @param {{ tier: string, region: number }} seat
 */
export function seatMapMark(seat) {
  const crown = seat.tier === 'crown' ? KINGDOM_METALS[CROWN_SEAT_REGIONS[seat.region]] ?? null : null;
  const second = isMarch(seat.region) ? MARCHES[seat.region].map((k) => KINGDOM_METALS[k])
    : isFreeLand(seat.region) ? [FREE_LAND_RING] : null;
  return { ring: SEAT_RING_UNHELD, crown, second };
}
/**
 * THE BANNER AN UNHELD SEAT HANGS (SEAT0 3.4: "An unheld seat's anchors carry the kingdom's plain banner (the crown's
 * metal, no device); a free land's carry nothing") - a heraldry `{ field, border, device: null }` in heraldryLaw.js's
 * colour keys, or null for none. A March's is its two claimants' metals, field and border.
 * @param {{ region: number }} seat
 */
export function seatPlainBanner(seat) {
  if (isFreeLand(seat.region)) return null;
  if (isMarch(seat.region)) {
    const [a, b] = MARCHES[seat.region];
    return { field: KINGDOM_BANNER_COLOURS[a], border: KINGDOM_BANNER_COLOURS[b], device: null };
  }
  const k = kingdomOf(seat.region);
  return k ? { field: KINGDOM_BANNER_COLOURS[k], border: KINGDOM_BANNER_COLOURS[k], device: null } : null;
}
/** How many banners a seat town hangs at most (SEAT0 3.4). */
export const SEAT_BANNERS_MAX = 8;

// ═══ THE SEAT WEEK (SEAT0 5.1) ══════════════════════════════════════
// A seat week is a real week; week n begins at ONLINE_EPOCH_MS + 6 days 18 hours + n weeks - the first Turning fell on
// Sunday 2026-09-20 at 18:00 UTC. The Reckoning is the last 48 hours of a week (Friday 18:00 to the Turning).
const H = 3600_000;
export const SEAT_WEEK_MS = 7 * 24 * H;
export const SEAT_WEEK0_MS = ONLINE_EPOCH_MS + 6 * 24 * H + 18 * H;
export const SEAT_RECKONING_MS = 2 * 24 * H;
/** The seat week holding the instant `ms` (-1 before the first Turning). */
export const seatWeekOf = (ms) => Math.floor((ms - SEAT_WEEK0_MS) / SEAT_WEEK_MS);
/** When seat week `n` begins (its Turning), ms. */
export const seatWeekStartMs = (n) => SEAT_WEEK0_MS + n * SEAT_WEEK_MS;
/** The week's phase at `ms`: the Muster, or the Reckoning (its last 48 hours, pledges locked). */
export const seatPhaseOf = (ms) => (ms - seatWeekStartMs(seatWeekOf(ms)) >= SEAT_WEEK_MS - SEAT_RECKONING_MS ? 'reckoning' : 'muster');

// ═══ SEAT1b: INFLUENCE (SEAT0 4.1-4.2, Appendix B) ═══════════════════
// Influence is counted per guild, per seat, per week. A guild PLEDGES each week to at most one seat a region, in at most
// five regions; an Officer or the guildmaster sets or moves a pledge until the Reckoning. What an account earns counts
// for the guild its account is BOUND to that week (the first guild one of its characters contributed to - per-account
// war), from a character 7 days in that guild, at that guild's pledged seat in the region it was earned in - and never
// more than ACCOUNT_SEAT_WEEK_CAP a seat a week from every source together.

/** A guild's reach: the regions it may pledge in a week (one seat each). */
export const SEAT_PLEDGE_REGIONS_MAX = 5;
/** What a rank may do of a guild's seats (guildLaw.js GUILD_POWERS's shape): pledge (an Officer's too), and Tribute -
 *  Marks out of the guild's Drake treasury - the guildmaster's, as every Marks withdrawal is. */
export const SEAT_POWERS = Object.freeze({ pledge: Object.freeze([0, 1]), tribute: Object.freeze([0]) });
export const seatMay = (rank, power) => (SEAT_POWERS[power] ?? []).includes(rank);
/** The Watch: a tick each WATCH_TICK_MS a socket stands in a town's cell room having moved in the last WATCH_MOVED_MS -
 *  1 influence a tick, at most WATCH_DAY_CAP an account a UTC day. The tick's rhythm lives beside its receipt
 *  (net/watchReceipt.js), so the relay's bundle holds the Watch's law and none of the rest of the seats'. */
export { WATCH_TICK_MS, WATCH_MOVED_MS, watchDue } from './watchReceipt.js';
export const WATCH_INFLUENCE = 1;
export const WATCH_DAY_CAP = 60;
/** A gate kill: 300 a receipt claimed in its own week, the region at least 3 of that game day's receipts agree on, at most
 *  900 an account a week (three receipts). */
export const GATE_INFLUENCE = 300;
export const GATE_WEEK_CAP = 900;
export const GATE_REGION_AGREE = 3;
/** A member's home in the seat's town: 25 a day, at most 5 homes a guild a seat. */
export const HOME_INFLUENCE_DAY = 25;
export const HOMES_SEAT_MAX = 5;
/** Renown earned in the seat's region: 1 per 20 XP, at most 400 an account a week. */
export const RENOWN_XP_PER_INFLUENCE = 20;
export const RENOWN_WEEK_CAP = 400;
/** A delivery to the seat's stockpile: 1 per Mark of the materials' own value (PROF0 4.8) - the deliverer's own units;
 *  bought units count at Tribute's rate, inside Tribute's cap. */
export const WRIT_INFLUENCE_PER_MARK = 1;
/** Tribute: 1 per 10 Marks, burnt, at most 20% of the guild's week at the seat. */
export const TRIBUTE_MARKS_PER_INFLUENCE = 10;
export const TRIBUTE_SHARE_MAX = 0.2;
/** One account's whole week at one seat, every source together. */
export const ACCOUNT_SEAT_WEEK_CAP = 2000;
/** A character new to its guild contributes nothing for this long. */
export const SEAT_MEMBER_WAIT_S = 7 * 86400;
/** Legacy: the share of a guild's influence at a seat that carries into the next week (SEAT1c's Turning). */
export const SEAT_LEGACY_SHARE = 0.1;

/**
 * How much Tribute a guild's week at a seat can still take, in influence: Tribute is at most TRIBUTE_SHARE_MAX of the
 * guild's whole week there, so at most a quarter of everything else - less what it has already paid.
 * @param {number} others the guild's influence at the seat from every other source
 * @param {number} tributeSoFar its Tribute there this week, influence
 */
export function tributeRoom(others, tributeSoFar = 0) {
  const cap = Math.floor((Math.max(0, others) * TRIBUTE_SHARE_MAX) / (1 - TRIBUTE_SHARE_MAX) + 1e-9);
  return Math.max(0, cap - Math.max(0, tributeSoFar));
}

/**
 * ONE ACCOUNT'S WEEK AT ONE SEAT, every source at its own cap and then all of them at ACCOUNT_SEAT_WEEK_CAP: `watch` its
 * ticks (each day's already at WATCH_DAY_CAP), `gates` the receipts that count, `renownXp` the XP earned in the seat's
 * region, `writ` the own units' value delivered, `homeDays` the days its counting homes stood this week (the guild's
 * HOMES_SEAT_MAX already chosen).
 * @param {{ watch?: number, gates?: number, renownXp?: number, writ?: number, homeDays?: number }} a
 */
export function accountSeatInfluence({ watch = 0, gates = 0, renownXp = 0, writ = 0, homeDays = 0 } = {}) {
  const w = Math.max(0, watch) * WATCH_INFLUENCE;
  const g = Math.min(GATE_WEEK_CAP, Math.max(0, gates) * GATE_INFLUENCE);
  const r = Math.min(RENOWN_WEEK_CAP, Math.floor(Math.max(0, renownXp) / RENOWN_XP_PER_INFLUENCE));
  const h = Math.max(0, homeDays) * HOME_INFLUENCE_DAY;
  const m = Math.max(0, writ) * WRIT_INFLUENCE_PER_MARK;
  return Math.min(ACCOUNT_SEAT_WEEK_CAP, w + g + r + h + m);
}

/**
 * A GUILD'S WEEK AT A SEAT: its accounts' own influence (accountSeatInfluence each), then its Tribute (the Marks it
 * burnt, and bought units delivered, at TRIBUTE_MARKS_PER_INFLUENCE) inside tributeRoom. Answers `{ total, others,
 * tribute }`.
 * @param {number[]} accounts each account's accountSeatInfluence
 * @param {number} tributeMarks Marks of Tribute and bought units' value, together
 */
export function guildSeatInfluence(accounts, tributeMarks = 0) {
  const others = (accounts ?? []).reduce((n, v) => n + Math.max(0, v), 0);
  const tribute = Math.min(Math.floor(Math.max(0, tributeMarks) / TRIBUTE_MARKS_PER_INFLUENCE), tributeRoom(others));
  return { total: others + tribute, others, tribute };
}
/** The whole days a home stood in the week [weekStartS, nowS): from when it was bought (or the week's start), whole. */
export const homeDaysIn = (boughtAtS, weekStartS, nowS) => Math.max(0, Math.floor((nowS - Math.max(boughtAtS, weekStartS)) / 86400));
/** Pledges set or moved, an account an hour (Appendix B's rate limits). */
export const SEAT_PLEDGES_HOUR = 30;
/** The Watch's receipts one claim carries at most - what one request's 4 KiB (server-account service.js MAX_BODY_BYTES)
 *  holds with room to spare: a receipt runs to about 240 characters with the longest account id. 24 minutes of ticks. */
export const SEAT_WATCH_CLAIM_MAX = 12;


// ─── THE SEAT TAB'S WORDS (SEAT0 7.9: "the standings") ─────────────

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** A span of seconds as the tab says it: "2d 4h", "3h 20m", "12m". */
export function seatSpanWords(s) {
  const t = Math.max(0, Math.floor(s));
  const d = Math.floor(t / 86400), h = Math.floor((t % 86400) / 3600), m = Math.floor((t % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
/** The week's line: the Muster until the Reckoning, then the Reckoning until the Turning. */
export function seatWeekLine({ phase, reckoningAt, turningAt }, nowS) {
  return phase === 'reckoning'
    ? `The Reckoning: pledges are locked. The Turning comes Sunday 18:00 UTC, in ${seatSpanWords(turningAt - nowS)}.`
    : `The Muster: pledges close Friday 18:00 UTC, in ${seatSpanWords(reckoningAt - nowS)}.`;
}
/** A standing's row: "1. the Silver Hand <SH> - 8,393 influence". */
export const seatStandingLine = (s, i) => `${i + 1}. ${guildWords(s.guild)} - ${s.influence.toLocaleString('en-US')} influence`;
/** No guild pledged here yet. */
export const seatNoStandingsLine = (seat) => `No guild has pledged to ${seat.name} this week.`;
/**
 * The reader's own guild at this seat (`mine` of the standings' answer): where it is pledged in the seat's region, and
 * whether this account's war and this character count here.
 * @param {{ name: string, key: number, region: number }} seat
 * @param {any} mine
 * @param {(key: number) => string|null} nameOf a seat's name by key (the client's derived seats)
 */
export function seatMineLines(seat, mine, nameOf = () => null) {
  if (!mine) return ['Join a guild to fight for a seat.'];
  const out = [];
  const here = mine.pledges.find((p) => p.region === seat.region);
  if (!here) out.push('Your guild has not pledged in this region this week.');
  else if (here.key === seat.key) out.push(`Your guild is pledged to ${seat.name}.`);
  else out.push(`Your guild is pledged to ${nameOf(here.key) ?? 'another seat'} in this region.`);
  if (!mine.seasoned) out.push('You count for your guild\'s seats after 7 days in it.');
  else if (mine.bound && mine.bound !== mine.guild) out.push('Your account fights for another guild this week.');
  else if (here?.key === seat.key) out.push(`Your week here: ${mine.influence.toLocaleString('en-US')} of ${ACCOUNT_SEAT_WEEK_CAP.toLocaleString('en-US')}.`);
  return out;
}
/** What the pledge buttons say. */
export const SEAT_PLEDGE_WORDS = Object.freeze({
  pledge: (seat) => `Pledge to ${seat.name}`,
  move: (seat) => `Move the pledge to ${seat.name}`,
  drop: 'Take the pledge down',
  full: `Your guild has pledged in ${SEAT_PLEDGE_REGIONS_MAX} regions this week.`,
});
/** Tribute's line for the guildmaster: its room in Drakes. */
export const seatTributeLine = (room) => (room > 0
  ? `Tribute: up to ${room.toLocaleString('en-US')} Drakes more this week (1 influence per ${TRIBUTE_MARKS_PER_INFLUENCE}, burnt).`
  : 'Tribute: your guild has no room for more this week. Tribute is at most a fifth of a guild\'s week at a seat.');
