// @ts-check
// ═══════════════════════════════════════════════════════════════════
// RAID4 (2026-09-28) — THE TOWNS DEFENDED, AS THE SERVICE KEEPS THEM.
//
// Mac, on World Events - Raiding Parties online: "1. Server ... 3. We
// can also add renown and it's own atheric + armor sets". The relay
// keeps a town raid's ledger and, at its cleanse, signs a receipt for
// each account that struck a raider and stood in the town
// (src/net/raidReceipt.js - `w1`, under the relay's GATE_SIGNING_KEY).
// This file is where that receipt is honoured: counted once, and paid
// in Renown to the character that fought it. Design:
// bible/03-World/Raiding-Parties.md, "The rewards (RAID4)".
//
// ═══ WHOSE WORD, AND WHAT BOUNDS IT ════════════════════════════════
//
// The receipt is the RELAY's word - it saw the count reach its target
// and the account stand in the town - so a claim is not the client's
// report of a kill, and its Renown is credited OUTSIDE the hour's bound
// (renownTracks.js): one raid, one credit, whatever the hour has left.
// What the relay could not check, this file bounds: it holds no copy
// of the day's schedule (no game data), so a modified client could name
// a raid the day never rolled; an account is counted at most
// RAID_CLAIMS_DAY_MAX a game day (a game day is two real hours, and a
// raid is ten minutes of them), and the key's day must be its own.
//
// ═══ ONE TRANSACTION ═══════════════════════════════════════════════
//
// The claim is one `db.batch` (renownTracks.js's law, AUDIT RENOWN1):
// the row is written first, under the day's bound, stamped with this
// claim's own NONCE; the track is credited only where THAT row exists -
// so a receipt claimed twice, from two devices at once, credits once
// (the second claim's INSERT is ignored, and no row carries its nonce).
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { verifyRaidReceipt } from '../../src/net/raidReceipt.js';
import { raidDayOfKey } from '../../src/net/raidLaw.js';
import { renownForXp, renownRaidXp, RENOWN_XP_MAX, RENOWN_TRACKS_MAX } from '../../src/net/renown.js';
import { renownCharacterOk, renownNameOf, renownTrackOf } from './renownTracks.js';

/** The raids an account is counted for in one game day. */
export const RAID_CLAIMS_DAY_MAX = 6;

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** An account's towns defended, for the cards: `{ defended }`. */
export async function raidRecordOf({ db }, playerId) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM raid_cleanses WHERE account = ?1').bind(playerId).first();
  return { defended: int(r?.n) };
}

/**
 * THE CLAIM: `receipt` verified with the relay's public half and naming `player` (the session's row, never the
 * body's word), counted once a (raid, account), no more than RAID_CLAIMS_DAY_MAX a game day, and paid to `character`
 * - the character that fought it, which the client names (its own save's id) - in Renown (renownRaidXp at the track's
 * level before it). Answers:
 *   `{ recorded: true, defended, renown: { character, xp, level, credited, rose } }`,
 *   `{ recorded: false, why: 'claimed' | 'guest' | 'day-full', defended }`, or
 *   `{ error }` - `no-gate-key` (this service holds no public half), `receipt` (not a receipt the relay signed, or
 *   expired - `why` says which rung), `not-yours` (another account's), `renown-character` (no character to pay).
 * A new character past RENOWN_TRACKS_MAX is counted and paid nothing (its track has no place).
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => Uint8Array }} ctx
 * @param {{ id: string, handle?: string|null }} player
 * @param {{ receipt: unknown, character: unknown, name?: unknown }} body
 * @param {CryptoKey|null} publicKey
 */
export async function claimRaid({ db, nowS, subtle, rand }, player, { receipt, character, name = null }, publicKey) {
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifyRaidReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.s !== player.id) return { error: 'not-yours' };
  if (!player.handle) return { recorded: false, why: 'guest', ...(await raidRecordOf({ db }, player.id)) };
  if (typeof character !== 'string' || !renownCharacterOk(character)) return { error: 'renown-character' };
  const day = raidDayOfKey(c.w);
  const before = await renownTrackOf({ db }, player.id, character);
  const xp = renownRaidXp(before?.level ?? 1);
  const nonce = hex(rand(new Uint8Array(8)));
  const mine = 'EXISTS (SELECT 1 FROM raid_cleanses WHERE raid = ?7 AND account = ?1 AND nonce = ?8)';
  const [row, , , after, count] = await db.batch([
    // THE ROW, under the day's bound, stamped with this claim's nonce - RETURNING it only when it was written
    db.prepare(
      `INSERT OR IGNORE INTO raid_cleanses (raid, account, day, party, char_id, xp, nonce, at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
       WHERE (SELECT COUNT(*) FROM raid_cleanses WHERE account = ?2 AND day = ?3) < ?9
       RETURNING nonce`,
    ).bind(c.w, player.id, day, c.y, character, xp, nonce, nowS, RAID_CLAIMS_DAY_MAX),
    // THE TRACK THAT EXISTS grows by the raid's Renown (never past the cap's total) - by THIS claim's row alone
    db.prepare(
      `UPDATE renown_tracks SET xp = MIN(?3, xp + ?4), name = COALESCE(?5, name), updated_at = ?6
       WHERE player = ?1 AND char_id = ?2 AND ${mine}`,
    ).bind(player.id, character, RENOWN_XP_MAX, xp, renownNameOf(name), nowS, c.w, nonce),
    // A NEW TRACK, under the bound - by THIS claim's row alone
    db.prepare(
      `INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at)
       SELECT ?1, ?2, ?5, MIN(?3, ?4), ?6, ?6
       WHERE NOT EXISTS (SELECT 1 FROM renown_tracks WHERE player = ?1 AND char_id = ?2)
         AND (SELECT COUNT(*) FROM renown_tracks WHERE player = ?1) < ?9
         AND ${mine}`,
    ).bind(player.id, character, RENOWN_XP_MAX, xp, renownNameOf(name), nowS, c.w, nonce, RENOWN_TRACKS_MAX),
    db.prepare('SELECT xp FROM renown_tracks WHERE player = ?1 AND char_id = ?2').bind(player.id, character),
    db.prepare('SELECT COUNT(*) AS n FROM raid_cleanses WHERE account = ?1').bind(player.id),
  ]);
  const defended = int(count?.results?.[0]?.n);
  if (!row?.results?.length) {
    const had = await db.prepare('SELECT 1 AS x FROM raid_cleanses WHERE raid = ?1 AND account = ?2').bind(c.w, player.id).first();
    return { recorded: false, why: had ? 'claimed' : 'day-full', defended };
  }
  const total = after?.results?.length ? int(after.results[0].xp) : null;
  const was = before?.xp ?? 0;
  return {
    recorded: true, defended,
    renown: total === null
      ? { character, xp: null, level: null, credited: 0, rose: false }   // no place for a new track: counted, paid nothing
      : { character, xp: total, level: renownForXp(total), credited: total - was, rose: renownForXp(total) > renownForXp(was) },
  };
}
