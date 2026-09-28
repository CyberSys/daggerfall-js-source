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
// in Renown to the ACCOUNT (RENOWN-ACCOUNT, 2026-09-28 - it was paid to
// the character that fought it; Renown is the account's now, and the
// character the claim names is kept on its row as a record, never as a
// key). Design: bible/03-World/Raiding-Parties.md, "The rewards (RAID4)".
//
// ═══ WHOSE WORD, AND WHAT BOUNDS IT ════════════════════════════════
//
// The receipt is the RELAY's word - it saw the count reach its target
// and the account stand in the town - so a claim is not the client's
// report of a kill. What the relay could not check, this file bounds: it
// holds no copy of the day's schedule (no game data), so a modified
// client could name a raid the day never rolled; an account is counted at
// most RAID_CLAIMS_DAY_MAX a game day (a game day is two real hours, and
// a raid is ten minutes of them), and the key's day must be its own.
//
// AUDIT RAID R5 (2026-09-28): AND ITS RENOWN IS THE HOUR'S. It was
// credited outside the hour's bound ("one raid, one credit"), and six
// raids a game day of up to 3,900 each is 11,700 an hour - over half the
// bound again, for a modified client that names raids the day never
// rolled (the relay cannot tell). A raid's Renown is charged to the
// account's hour now, as every report is (renownTracks.js): the raid is
// counted whatever the hour has left, and paid what it has left.
// (RENOWN-ACCOUNT's rate: up to 2,925 a raid, 8,775 an hour against the
// hour's 15,000 - over half of it still.)
//
// AUDIT RAID R4: A TOWN'S THANKS ARE THIS FILE'S WORD TOO. The receipt's
// seed rolls them on the device (src/systems/raidSpoils.js), once a
// receipt and DEVICE - and the relay hands an account's receipt to every
// socket it has, so a second browser rolled them again. The first claim
// of a (raid, account), a guest's too, writes the thanks' row with its
// device's claim id (`cid`, migration 0017); a claim is answered
// `spoils: true` only when that row is its own.
//
// ═══ ONE TRANSACTION ═══════════════════════════════════════════════
//
// The claim is one `db.batch` (renownTracks.js's law, AUDIT RENOWN1):
// the row is written first, under the day's bound, stamped with this
// claim's own NONCE; the account's track is credited only where THAT row
// exists - so a receipt claimed twice, from two devices at once, credits
// once (the second claim's INSERT is ignored, and no row carries its
// nonce).
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { verifyRaidReceipt } from '../../src/net/raidReceipt.js';
import { raidDayOfKey } from '../../src/net/raidLaw.js';
import { renownForXp, renownRaidXp, RENOWN_XP_MAX, RENOWN_XP_HOUR_MAX } from '../../src/net/renown.js';
import { renownCharacterOk, renownTrackOf } from './renownTracks.js';

/** The raids an account is counted for in one game day. */
export const RAID_CLAIMS_DAY_MAX = 6;
/** AUDIT RAID R4: a device's claim id - the key a town's thanks are given under. */
export const RAID_CID_RE = /^[0-9a-f]{16}$/;
const HOUR_S = 3600;

/** AUDIT RAID R4: the statements that write a (raid, account)'s thanks row for `cid` if none is yet, and read whose it
 *  is - the claim's `spoils` is that row's cid being its own. */
const thanksOf = (db, raid, account, cid, nowS) => [
  db.prepare('INSERT OR IGNORE INTO raid_spoils (raid, account, cid, at) VALUES (?1, ?2, ?3, ?4)').bind(raid, account, cid, nowS),
  db.prepare('SELECT cid FROM raid_spoils WHERE raid = ?1 AND account = ?2').bind(raid, account),
];
const thanksAnswer = (res, cid) => res?.results?.[0]?.cid === cid;

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** An account's towns defended, for the cards: `{ defended }`. */
export async function raidRecordOf({ db }, playerId) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM raid_cleanses WHERE account = ?1').bind(playerId).first();
  return { defended: int(r?.n) };
}

/**
 * THE CLAIM: `receipt` verified with the relay's public half and naming `player` (the session's row, never the
 * body's word), counted once a (raid, account), no more than RAID_CLAIMS_DAY_MAX a game day, and paid to the ACCOUNT's
 * Renown (RENOWN-ACCOUNT) - renownRaidXp at the account's level before it, AUDIT RAID R5: as much of it as the account's
 * hour has left. `character` is the one that fought it, as the client names it (its own save's id): its row keeps it as
 * a record ('' for none, or one out of the id's shape), and the answer says it back - never whose Renown it is. Answers,
 * each with `spoils` (AUDIT RAID R4: whether THIS claim is given the town's thanks):
 *   `{ recorded: true, defended, renown: { character, xp, level, credited, rose }, spoils }` - `xp` and `level` the
 *   account's track after it,
 *   `{ recorded: false, why: 'claimed' | 'guest' | 'day-full', defended, spoils }`, or
 *   `{ error }` - `no-gate-key` (this service holds no public half), `receipt` (not a receipt the relay signed, or
 *   expired - `why` says which rung), `not-yours` (another account's).
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto, rand: (b: Uint8Array) => Uint8Array }} ctx
 * @param {{ id: string, handle?: string|null }} player
 * @param {{ receipt: unknown, character?: unknown, cid?: unknown }} body `cid` the device's claim id (RAID_CID_RE) - a
 *   claim without one is answered `spoils: false` and writes no thanks
 * @param {CryptoKey|null} publicKey
 */
export async function claimRaid({ db, nowS, subtle, rand }, player, { receipt, character = null, cid = null }, publicKey) {
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifyRaidReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.s !== player.id) return { error: 'not-yours' };
  const thanks = typeof cid === 'string' && RAID_CID_RE.test(cid);
  if (!player.handle) {   // a guest: never counted - but thanked, once
    const spoils = thanks ? thanksAnswer((await db.batch(thanksOf(db, c.w, player.id, cid, nowS)))[1], cid) : false;
    return { recorded: false, why: 'guest', ...(await raidRecordOf({ db }, player.id)), spoils };
  }
  // RENOWN-ACCOUNT: the character that fought it - its row's record, never Renown's key ('' when the claim names none)
  const fought = renownCharacterOk(character) ? /** @type {string} */ (character) : '';
  const day = raidDayOfKey(c.w);
  const hour = Math.floor(nowS / HOUR_S);
  const before = await renownTrackOf({ db }, player.id);
  const xp = renownRaidXp(before?.level ?? 1);
  const nonce = hex(rand(new Uint8Array(8)));
  // every statement after the row's binds ?1 the account, ?2 the raid, ?3 this claim's nonce
  const mine = 'EXISTS (SELECT 1 FROM raid_cleanses WHERE raid = ?2 AND account = ?1 AND nonce = ?3)';
  const track = 'SELECT xp FROM renown_accounts WHERE player = ?1';
  // AUDIT RAID R5: WHAT THE ACCOUNT'S TRACK CAN TAKE and WHAT THE HOUR HAS LEFT, as a report's (renownTracks.js)
  const want = `MIN(?4, MAX(0, ?5 - COALESCE((${track}), 0)))`;
  const room = 'CASE WHEN renown_hour >= ?7 THEN MAX(0, ?6 - renown_hour_xp) ELSE ?6 END';
  const credit = `CASE WHEN ${mine} THEN MIN(${want}, ${room}) ELSE 0 END`;
  const res = await db.batch([
    // THE ROW, under the day's bound, stamped with this claim's nonce - RETURNING it only when it was written
    db.prepare(
      `INSERT OR IGNORE INTO raid_cleanses (raid, account, day, party, char_id, xp, nonce, at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
       WHERE (SELECT COUNT(*) FROM raid_cleanses WHERE account = ?2 AND day = ?3) < ?9
       RETURNING nonce`,
    ).bind(c.w, player.id, day, c.y, fought, xp, nonce, nowS, RAID_CLAIMS_DAY_MAX),
    // THE HOUR SPENT and THE CREDIT DECIDED - by THIS claim's row alone. Every SET reads the row as it WAS, so
    // `renown_last_credit` is what this claim took out of the window before `renown_hour_xp` moved
    db.prepare(
      `UPDATE players SET
         renown_last_credit = ${credit},
         renown_hour_xp = CASE WHEN ${mine} THEN (CASE WHEN renown_hour >= ?7 THEN renown_hour_xp + ${credit} ELSE ${credit} END) ELSE renown_hour_xp END,
         renown_hour = CASE WHEN ${mine} THEN MAX(renown_hour, ?7) ELSE renown_hour END
       WHERE id = ?1
       RETURNING renown_last_credit AS credit`,
    ).bind(player.id, c.w, nonce, xp, RENOWN_XP_MAX, RENOWN_XP_HOUR_MAX, hour),
    // THE ACCOUNT'S TRACK, where it stands, grows by the credit (never past the cap's total) - by THIS claim's row alone
    db.prepare(
      `UPDATE renown_accounts SET xp = MIN(?4, xp + (SELECT renown_last_credit FROM players WHERE id = ?1)), updated_at = ?5
       WHERE player = ?1 AND ${mine}`,
    ).bind(player.id, c.w, nonce, RENOWN_XP_MAX, nowS),
    // AN ACCOUNT'S FIRST TRACK, with Renown to hold - by THIS claim's row alone
    db.prepare(
      `INSERT INTO renown_accounts (player, xp, created_at, updated_at)
       SELECT ?1, renown_last_credit, ?4, ?4 FROM players
       WHERE id = ?1 AND renown_last_credit > 0
         AND NOT EXISTS (SELECT 1 FROM renown_accounts WHERE player = ?1)
         AND ${mine}`,
    ).bind(player.id, c.w, nonce, nowS),
    // the row says what the claim PAID (the hour may have left less than the raid is worth)
    db.prepare(`UPDATE raid_cleanses SET xp = (SELECT renown_last_credit FROM players WHERE id = ?1) WHERE raid = ?2 AND account = ?1 AND nonce = ?3`)
      .bind(player.id, c.w, nonce),
    db.prepare(track).bind(player.id),
    db.prepare('SELECT COUNT(*) AS n FROM raid_cleanses WHERE account = ?1').bind(player.id),
    ...(thanks ? thanksOf(db, c.w, player.id, cid, nowS) : []),
  ]);
  const [row, decided, , , , after, count] = res;
  const spoils = thanks ? thanksAnswer(res[8], cid) : false;
  const defended = int(count?.results?.[0]?.n);
  if (!row?.results?.length) {
    const had = await db.prepare('SELECT 1 AS x FROM raid_cleanses WHERE raid = ?1 AND account = ?2').bind(c.w, player.id).first();
    return { recorded: false, why: had ? 'claimed' : 'day-full', defended, spoils };
  }
  // the ACCOUNT's track after it - 0 for an account with none yet (a claim the hour paid nothing makes no track)
  const total = int(after?.results?.[0]?.xp);
  const was = before?.xp ?? 0;
  return {
    recorded: true, defended, spoils,
    renown: { character: fought || null, xp: total, level: renownForXp(total), credited: Math.max(0, int(decided?.results?.[0]?.credit)), rose: renownForXp(total) > renownForXp(was) },
  };
}
