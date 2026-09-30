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

/** THE WITNESSED REGISTRY (SEAT0 3.2, Appendix B): confirmed by 3 distinct witnesses reporting byte-identically;
 *  disputed only by 2 agreeing on another answer; a witness an account at least 7 days old; an account whose
 *  disagreements match nobody else's 3 times is ignored for a week; 24 reports an account an hour. */
export const SEAT_WITNESSES_CONFIRM = 3;
export const SEAT_WITNESSES_DISPUTE = 2;
export const SEAT_WITNESS_AGE_S = 7 * 86400;
export const SEAT_WITNESS_UNMATCHED_MAX = 3;
export const SEAT_WITNESS_IGNORED_S = 7 * 86400;
export const SEAT_WITNESS_REPORTS_HOUR = 24;
/** How often a client standing in a seat town reports it: once a UTC day (SEAT0 3.2). */
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
 * its crown's region (SEAT0 3.2); a palace never does in a crown region's capital's place is not asked here (the
 * derivation's), only the shape.
 * @param {any} raw
 */
export function seatReportOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const { key, name, region, tier, pixel } = raw;
  if (!seatKeyOk(key) || !nameOk(name) || !seatRegionOk(region) || !SEAT_TIERS.includes(tier) || !pixelOk(pixel)) return null;
  if (tier === 'crown' && !Object.prototype.hasOwnProperty.call(CROWN_SEAT_REGIONS, region)) return null;
  return { key, name, region, tier, pixel: [pixel[0], pixel[1]] };
}
/** The report's bytes - what three witnesses must agree on, byte for byte. */
export const seatReportText = (seat) => JSON.stringify([seat.key, seat.name, seat.region, seat.tier, seat.pixel[0], seat.pixel[1]]);

/**
 * THE ONE DISPUTE RULE (SEAT0 3.2), over a seat's reports - `[{ text, witness }]`, one per witness (their latest):
 * the answer at least SEAT_WITNESSES_CONFIRM witnesses agree on byte for byte is CONFIRMED; once a row is confirmed, it
 * keeps every effect, and becomes DISPUTED only when SEAT_WITNESSES_DISPUTE witnesses agree on ONE other answer (a lone
 * dissenter is counted, not obeyed). Before any confirmation the row is unconfirmed. `confirmed` is the text the row was
 * confirmed with (null before). Answers `{ state: 'unconfirmed'|'confirmed'|'disputed', text }` - `text` the answer in
 * force (the confirmed one, whatever the dispute).
 * @param {{ text: string, witness: string }[]} reports
 * @param {string|null} confirmed
 */
export function seatStateOf(reports, confirmed = null) {
  const by = new Map();
  for (const r of reports ?? []) {
    if (!r || typeof r.text !== 'string' || typeof r.witness !== 'string') continue;
    const set = by.get(r.text) ?? new Set();
    set.add(r.witness);
    by.set(r.text, set);
  }
  if (confirmed == null) {
    const agreed = [...by.entries()].filter(([, w]) => w.size >= SEAT_WITNESSES_CONFIRM).sort((a, b) => b[1].size - a[1].size || (a[0] < b[0] ? -1 : 1));
    return agreed.length ? { state: 'confirmed', text: agreed[0][0] } : { state: 'unconfirmed', text: null };
  }
  const other = [...by.entries()].some(([t, w]) => t !== confirmed && w.size >= SEAT_WITNESSES_DISPUTE);
  return { state: other ? 'disputed' : 'confirmed', text: confirmed };
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
