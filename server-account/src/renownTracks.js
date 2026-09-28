// @ts-check
// ═══════════════════════════════════════════════════════════════════
// RENOWN1 (2026-09-24) — THE RENOWN, AS THE SERVICE KEEPS IT.
//
// Mac: "What if the leveling system was something seperate unique to
// online but compatible" (src/net/renown.js carries the whole of the
// law and Mac's answers; this file is where the track is kept).
//
// ONE TRACK AN ACCOUNT (RENOWN-ACCOUNT, 2026-09-28, Mac: "can you make
// sure renown is account based and not character based?" - migration
// 0021's `renown_accounts`, keyed by the account alone). RENOWN1 kept a
// track a CHARACTER (0009's `renown_tracks`); those rows stay as history
// - what each character had earned when Renown became the account's -
// and nothing here reads or writes them again. Every read and write of
// Renown is this file's, against the account's one row: a report, a
// raid's claim (raids.js), the token's level and the account card
// (index.js), a guild's founding (guilds.js). A character a client names
// is never the key: a report may still name one (a client from before
// RENOWN-ACCOUNT does), and it is credited to the account whoever it is.
//
// ═══ WHOSE WORD, AND WHAT BOUNDS IT ════════════════════════════════
//
// A report says "this account earned N" and nothing can check a kill,
// so the bounds are the service's:
//
//   ONE REPORT carries at most RENOWN_XP_REPORT_MAX.
//   ONE ACCOUNT earns at most RENOWN_XP_HOUR_MAX in a clock hour. The
//   window is spent by ONE UPDATE that also writes what it credited,
//   read back with RETURNING, so two reports in flight at once each spend
//   what is left and never the same remainder (ACC4's `creditPlay` law,
//   one column over).
//   ONE ACCOUNT holds ONE track - its key says so, and no count of tracks
//   is needed to hold it (the tracks' bound, RENOWN_TRACKS_MAX, went with
//   the tracks).
//
// A report the hour has already spent is credited 0 and answered, not
// refused: the fighting happened, it simply earns nothing more this
// hour, and the client says so rather than retrying.
//
// THE LEVEL IS NEVER STORED. It is derived from the total by the curve
// both ends share, here and at the token's mint alike, so a level over
// somebody's head and the total on their card cannot disagree.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════

import { renownForXp, RENOWN_XP_MAX, RENOWN_XP_REPORT_MAX, RENOWN_XP_HOUR_MAX, renownRidOf } from '../../src/net/renown.js';
import { CHAR_ID_RE } from './service.js';

const HOUR_S = 3600;

/** A character id in the shape the saves are filed under (service.js CHAR_ID_RE) - the same id, one door. RENOWN-ACCOUNT:
 *  never Renown's key; a mint that names one is a character coming online (index.js), and a raid's claim records the one
 *  that fought it (raids.js). */
export const renownCharacterOk = (c) => typeof c === 'string' && CHAR_ID_RE.test(c);

const int = (v) => (Number.isSafeInteger(Number(v)) ? Number(v) : 0);

/** RENOWN-ACCOUNT: the account's Renown - `{ xp, level }`, or null while it has earned none (an account that has earned
 *  nothing is level 1). The one reader: the token's mint, the account card, a guild's founding and a raid's claim. */
export async function renownTrackOf({ db }, playerId) {
  const row = await db.prepare('SELECT xp FROM renown_accounts WHERE player = ?1').bind(playerId).first();
  if (!row) return null;
  const xp = int(row.xp);
  return { xp, level: renownForXp(xp) };
}

/**
 * A REPORT: `player` (the session's row, never the body's word) earned `xp`, under the report id `rid` (null from a
 * client before the audit). Answers `{ xp, level, credited, rose, max?, repeat? }` - the ACCOUNT's track after it, what
 * the track gained (the hour and the cap let through), whether the level rose, `max` once the track holds the cap's
 * total, and `repeat` when this report's id is the one the account last took (it was credited then, and nothing is
 * credited now) - or `{ error: 'renown-xp' }` (not a whole number from 1 to RENOWN_XP_REPORT_MAX, or a report id out of
 * its shape). RENOWN-ACCOUNT: a `character` and a `name` in the report are a client's from before it, and are neither
 * refused nor read - the Renown is the account's, whichever character earned it.
 *
 * ═══ AUDIT RENOWN1: ONE TRANSACTION ════════════════════════════════
 *
 * This was five statements, each committed alone, with the decisions
 * taken in JS from reads made before the writes - and every seam between
 * them was a finding:
 *   - SEC-1/DATA-1: the window was `renown_hour = ?`, so a report
 *     stamped with the hour BEFORE (a request that arrived at 00:59:59
 *     and whose body came after the boundary) reopened the window the
 *     report before it had just opened - 1,500,000 XP in a minute,
 *     driven through the real worker. The window now only moves
 *     forward, and a late report is charged to the window that is open.
 *   - DATA-3: the track bound was a COUNT, then an INSERT - fifty new
 *     characters reporting at once all fit under 60 (109 tracks).
 *     (RENOWN-ACCOUNT: one track an account, by its key - there is no
 *     bound left to race.)
 *   - DATA-4: the hour was spent, then the track grown - an error
 *     between them spent the hour for nothing; and a report whose answer
 *     was lost was sent again and credited twice.
 *   - DATA-5: what the track could still take, and whether it rose,
 *     were read before the write - two reports near the cap were both
 *     charged in full and both said `rose`.
 *   - DATA-7 (UI-10): a report the hour had spent still made a track of
 *     0 XP. A track is still made only with XP to hold.
 * Now ONE `db.batch` - D1 runs a batch as one transaction, and nothing
 * else runs between its statements - whose first statement decides
 * everything in SQL, against the rows as they stand inside it, and says
 * what it decided with RETURNING; the rest carry that decision out.
 * @param {{ db: any, nowS: number }} ctx
 * @param {{ id: string }} player
 * @param {{ xp: unknown, rid?: unknown }} report
 */
export async function reportRenownXp({ db, nowS }, player, { xp, rid = null }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('reportRenownXp needs an integer epoch-seconds clock');
  if (!Number.isSafeInteger(xp) || /** @type {number} */ (xp) < 1 || /** @type {number} */ (xp) > RENOWN_XP_REPORT_MAX) return { error: 'renown-xp' };
  if (rid != null && !renownRidOf(rid)) return { error: 'renown-xp' };
  const id = rid ?? null;
  const hour = Math.floor(nowS / HOUR_S);
  const track = 'SELECT xp FROM renown_accounts WHERE player = ?1';
  // A REPEAT is a report whose id the account's track last took - it wants nothing.
  const repeat = '(?6 IS NOT NULL AND EXISTS (SELECT 1 FROM renown_accounts WHERE player = ?1 AND last_rid = ?6))';
  // WHAT THE TRACK CAN STILL TAKE, read inside the transaction: a track near the cap asks the hour only for that
  const want = `CASE WHEN ${repeat} THEN 0 ELSE MIN(?2, MAX(0, ?3 - COALESCE((${track}), 0))) END`;
  // WHAT THE HOUR HAS LEFT: the open window's remainder, or a whole window for an hour that has not been counted yet.
  // A report stamped with an hour ALREADY PAST (renown_hour > ?5) is charged to the open window, never given its own.
  const room = 'CASE WHEN renown_hour >= ?5 THEN MAX(0, ?4 - renown_hour_xp) ELSE ?4 END';
  const credit = `MIN(${want}, ${room})`;
  const [decided, , , after] = await db.batch([
    // THE DECISION, and THE HOUR SPENT. Every SET reads the row as it WAS (SQL's own rule), so
    // `renown_last_credit` is what this report took out of the window before `renown_hour_xp` moved.
    db.prepare(
      `UPDATE players SET
         renown_last_credit = ${credit},
         renown_hour_xp = CASE WHEN renown_hour >= ?5 THEN renown_hour_xp + ${credit} ELSE ${credit} END,
         renown_hour = MAX(renown_hour, ?5)
       WHERE id = ?1
       RETURNING renown_last_credit AS credit, (${track}) AS before, ${repeat} AS repeat`,
    ).bind(player.id, xp, RENOWN_XP_MAX, RENOWN_XP_HOUR_MAX, hour, id),
    // THE ACCOUNT'S TRACK, where it stands, grows by the credit (never past the cap's total) and keeps this report's id.
    db.prepare(
      `UPDATE renown_accounts SET
         xp = MIN(?2, xp + (SELECT renown_last_credit FROM players WHERE id = ?1)),
         last_rid = COALESCE(?3, last_rid), updated_at = ?4
       WHERE player = ?1`,
    ).bind(player.id, RENOWN_XP_MAX, id, nowS),
    // AN ACCOUNT'S FIRST TRACK, only with XP to hold (DATA-7) - its key makes it the only one it can ever have.
    db.prepare(
      `INSERT INTO renown_accounts (player, xp, last_rid, created_at, updated_at)
       SELECT ?1, renown_last_credit, ?2, ?3, ?3 FROM players
       WHERE id = ?1 AND renown_last_credit > 0
         AND NOT EXISTS (SELECT 1 FROM renown_accounts WHERE player = ?1)`,
    ).bind(player.id, id, nowS),
    db.prepare(track).bind(player.id),
  ]);
  const d = decided?.results?.[0];
  if (!d) throw new Error('reportRenownXp: no account row to charge');   // the session named a row that is gone - a 500, never bad data
  const before = int(d.before);
  const credited = Math.max(0, int(d.credit));
  const total = int(after?.results?.[0]?.xp);
  const level = renownForXp(total);
  // `rose` against the total this report found, inside the same transaction - so two reports never both say so.
  // `max` when the track now holds the cap's total: nothing more is earned, and the client says so rather than
  // reading a credit of nothing as the hour's bound.
  return {
    xp: total, level, credited, rose: level > renownForXp(before),
    ...(total >= RENOWN_XP_MAX ? { max: true } : {}),
    ...(Number(d.repeat) === 1 ? { repeat: true } : {}),
  };
}
