// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HERALDRY-SHOWN (2026-10-02, Mac: "lets finish the build work") —
// EVERY GUILD'S HERALDRY THE CLIENT HAS BEEN TOLD, BY ITS TAG.
//
// Seats-Arc 8.1: the heraldry is drawn on the guild tag's frame, the
// siege HUD and the Chronicle. None of those carries it on its own wire
// (a peer's token names its tag alone, the fight's answer its guilds'
// names and tags, a Chronicle row the names and tags as they were that
// day), so each face reads it, by the guild's TAG (one guild a tag - the
// guilds table's unique), off what the client already holds: the seats'
// list (each holder's guild and its battle's two), a dressed seat, a
// seat's standings, and the reader's own guild.
//
// The client's alone, beside net/heraldryLaw.js rather than in it: that
// law is bundled by the relay and the account service, and an index
// neither of them reads is no change to what they run. Pure: no clock,
// no DOM, no network.
// ═══════════════════════════════════════════════════════════════════
import { heraldryOf } from './heraldryLaw.js';

/**
 * A guild's heraldry by its tag - `sources` read in order and the first word on a tag kept: a guild `{ tag, heraldry }`,
 * the seats' list (`{ seats }`), a seat (its `holder.guild` and its battle's `guild` and `against`), a seat's standings
 * (`{ holder, battle, standings }`). A guild with none, or a heraldry the law refuses, adds nothing.
 * @param {...any} sources
 * @returns {Map<string, {field: string, border: string, device: string}>}
 */
export function heraldryByTag(...sources) {
  const out = new Map();
  const put = (g) => {
    const h = heraldryOf(g?.heraldry);
    if (h && typeof g.tag === 'string' && g.tag && !out.has(g.tag)) out.set(g.tag, h);
  };
  const seat = (s) => { put(s?.holder?.guild); put(s?.battle?.guild); put(s?.battle?.against); };
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    put(src);
    seat(src);
    for (const s of Array.isArray(src.seats) ? src.seats : []) seat(s);
    for (const r of Array.isArray(src.standings) ? src.standings : []) put(r?.guild);
  }
  return out;
}
