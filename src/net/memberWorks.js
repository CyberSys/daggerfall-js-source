// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEAT2b part two (2026-10-01, Mac: "I want to finish the inprogress") - THE WORKS A HOLDER'S MEMBERS FEEL, as this
// client lives them (bible/11-Multiplayer/Seats-Arc.md 7.5's Watchtowers, Harbour, Forge, Workshop and Apothecary;
// `06-Systems/Online-Arc.md` SEAT2b (part one)'s "NOT YET (part two)"):
//
//   - each seat's standing works, as the seats' list says them (`works`, `{ [workId]: tier }` - public, tiers > 0);
//   - whether the reader's guild holds a seat (the dressed seat's holder against the playing character's own guild);
//   - THE MEMBER PORTS - the towns a held seat's Harbour makes a port for its guild's members (7.5: "ships (the Sea
//     update) dock at the seat; the town is a Travel Options port for members"), which systems/travelPorts.js asks at
//     every port question;
//   - THE SEAT'S HALL AT A STATION - the steps a held seat's Forge, Workshop or Apothecary gives a member's craft at any
//     station in its town (7.5's "members smithing here: quality +1 step"; DECIDED in the contract: a step a tier);
//   - THE WATCHTOWERS' WORD - "Your Watchtowers at Anticlere: the Silver Hand <SH> has passed half your defence." -
//     each row of the list's `watch` (the reader's guild's held seats with Watchtowers, a challenger past its share NOW,
//     the service's fortLaw.js watchtowerPassed) said once a (week, seat, guild, share) by net/townSeatBook.js.
//
// The numbers are fortLaw.js's (harbourPort, watchtowerShare, stationSteps) and the quality steps recipeLaw.js's
// qualitySteps - built on, never re-typed. Pure: the dressed seats, the guild and the week are arguments. Not a DFU
// member - Daggerfall's towns have no player works (Ledger A, EVERY PALACE A SEAT's row).
// ═══════════════════════════════════════════════════════════════════
import { FORT_WORKS, fortMaxTier, fortWork, harbourPort, watchtowerShare, stationSteps, STATION_PROFESSIONS } from './fortLaw.js';
import { qualitySteps, takesQuality } from './recipeLaw.js';
import { seatKeyOk, guildWords } from './townSeatLaw.js';   // a guild in the middle of a sentence, as the seats' words say one

/** No works standing - what an unheld, unread or bare seat is dressed in. */
export const NO_WORKS = Object.freeze({});

/** A SEAT'S STANDING WORKS as the list says them: each known work at a whole tier from 1 to its highest (fortLaw.js
 *  FORT_WORKS), in the table's order; anything else dropped - the list's own shape, standing tiers alone. */
export function seatWorksOf(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return NO_WORKS;
  /** @type {Record<string, number>} */
  const out = {};
  for (const w of FORT_WORKS) {
    const t = raw[w.id];
    if (Number.isSafeInteger(t) && t >= 1 && t <= fortMaxTier(w.id)) out[w.id] = t;
  }
  return Object.keys(out).length ? Object.freeze(out) : NO_WORKS;
}

/** Whether a dressed seat (net/townSeatBook.js dressed: `{ holder: { guild: { id } } }`) is held by the guild `guildId` -
 *  the reader's own; a reader in no guild holds nothing. */
export const heldBy = (seat, guildId) => guildId != null && seat?.holder?.guild?.id === guildId;
/** THE HALLS A MEMBER CRAFTS BY (7.5): a dressed seat's standing works where the reader's guild holds it, else null. */
export const memberWorksOf = (seat, guildId) => (heldBy(seat, guildId) ? seat.works ?? NO_WORKS : null);
/**
 * THE MEMBER PORTS (7.5's Harbour): the keys of the dressed seats `seats` the reader's guild holds whose Harbour stands
 * (fortLaw.js harbourPort - tier 1 or more), and only those this client's own derivation names (`known(key)` - "a client
 * never draws, lists or honours a seat its own derivation lacks", SEAT1a). Nobody else's seats; nobody else's ports.
 */
export function memberPortsOf(seats, guildId, known = (_key) => true) {
  return Object.freeze([...(seats ?? [])].filter((s) => heldBy(s, guildId) && harbourPort(s.works?.harbour ?? 0) && seatKeyOk(s.key) && known(s.key)).map((s) => s.key));
}
/** Whether the reader's guild holds a seat whose Watchtowers stand (a tier fortLaw.js watchtowerShare gives a share) - its
 *  members read the seats' list on the shorter wait (net/townSeatBook.js redTick). */
export const watchtoweredOf = (seats, guildId) => [...(seats ?? [])].some((s) => heldBy(s, guildId) && watchtowerShare(Number(s.works?.watchtowers ?? 0)) != null);

// ─── THE SEAT'S HALL AT A STATION (7.5's Forge, Workshop, Apothecary) ───

/**
 * WHAT A HELD SEAT'S HALL GIVES A CRAFT HERE: "The seat's Forge: +1 quality step here." - `works` the seat's (memberWorksOf:
 * null where the reader's guild does not hold the town's seat), `r` the recipe (net/recipeLaw.js). The steps are
 * qualitySteps' own `station` arm (fortLaw.js stationSteps over the works - the law the service rolls the craft by,
 * held at its three), so a recipe that takes no quality (a Repair Kit, arrows, a Ram Kit) and a profession no hall serves
 * have no line. Null for no line.
 * @param {any} r @param {Record<string, number>|null} works
 */
export function hallStepsLine(r, works) {
  if (!r || !works || !takesQuality(r)) return null;
  const steps = qualitySteps(r, { station: stationSteps(r.profession, works) }) - qualitySteps(r, {});
  const id = Object.keys(STATION_PROFESSIONS).find((k) => STATION_PROFESSIONS[k].includes(r.profession));
  if (!(steps >= 1) || !id) return null;
  return `The seat's ${fortWork(id)?.name}: +${steps} quality step${steps === 1 ? '' : 's'} here.`;
}

// ─── THE WATCHTOWERS' WORD (7.5) ──────────────────────────────────────

/** The shares a Watchtowers' row carries - its tier's (fortLaw.js watchtowerShare: half at tier 1, a quarter at tier 2) -
 *  and how the word says each before "your defence". */
export const WATCH_SHARE_WORDS = Object.freeze({ [String(watchtowerShare(1))]: 'half', [String(watchtowerShare(2))]: 'a quarter of' });
/**
 * A ROW OF THE LIST'S `watch` as the service mints it (the contract's SEATS LIST: `{ key, guild: { name, tag }, share }`)
 * - a seat key, the challenger's name and tag, and a share a Watchtowers' tier gives - or null for anything else.
 * @returns {{ key: number, guild: { name: string, tag: string }, share: number }|null}
 */
export function watchRowOf(r) {
  if (!r || !seatKeyOk(r.key) || typeof r.guild?.name !== 'string' || typeof r.guild?.tag !== 'string' || !r.guild.tag) return null;
  if (typeof r.share !== 'number' || !Object.hasOwn(WATCH_SHARE_WORDS, String(r.share))) return null;
  return { key: r.key, guild: { name: r.guild.name, tag: r.guild.tag }, share: r.share };
}
/** The list's `watch`, each row read (watchRowOf), the rest dropped. */
export const watchRowsOf = (raw) => (Array.isArray(raw) ? raw.map(watchRowOf).filter(Boolean) : []);
/** THE WORD (7.5: "the holder is told when a challenger passes half its defence (tier 1) or a quarter (tier 2)"), in the
 *  seat's name as this client's own derivation says it: "Your Watchtowers at Anticlere: the Silver Hand <SH> has passed
 *  half your defence." */
export const watchtowerLine = (row, seatName) => `Your Watchtowers at ${seatName}: ${guildWords(row.guild)} has passed ${WATCH_SHARE_WORDS[String(row.share)]} your defence.`;
/** ONCE A (WEEK, SEAT, GUILD, SHARE) - the word's id: a challenger by its tag (unique, `guilds.tag`), so a challenger
 *  passing half and then (the Watchtowers raised) a quarter is told twice, and each week anew. */
export const watchtowerWordId = (week, row) => `${week}|${row.key}|${row.guild.tag}|${row.share}`;
