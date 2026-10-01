// @ts-check
// ═════════════════════════════════════════════════════════════════════
// SEAT1c (2026-09-30, Mac: "Finish the seats") - THE TURNING: the week
// settled, the Charters claimed, the Contested seats and the Rights of
// Siege named, the Legacy carried.
//
// bible/11-Multiplayer/Seats-Arc.md 5.2: "The Turning is never a job that
// runs. The account service settles week N the first time anything asks
// about any seat after N's boundary (settleWeek(N), one D1 transaction,
// idempotent on town_seat_weeks.week - a second reader finds it
// settled)." The decision is townSeatLaw.js turningPlan, pure; this file
// gathers what it reads and writes what it answers, in ONE batch whose
// first statement is the week's own key - a plain INSERT, so a second
// reader racing the first fails on the key and its whole batch rolls back.
// A batch that fails for any other reason (a treasury emptied between the
// read and the write) rolls back whole too, and the next read settles it
// again.
//
// The settle reads the week's standings as they stood at its Turning
// (seatInfluence.js gatherStandings - a home's days counted to the
// boundary, not to the reader's now). Upkeep, Neglect and Overreach are
// SEAT1d's; the battles a Right or a Contested seat names are SEAT2a's to
// fight - until then they are the Chronicle's.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═════════════════════════════════════════════════════════════════════
import { confirmedSeats, seatsOpenFor } from './townSeats.js';
import { gatherStandings, seatGuildsOf, holdsOf, battlesOf } from './seatInfluence.js';
import { guildActorOf } from './guilds.js';
import { mustChange } from './realm.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { GUILD_RANK_MASTER } from '../../src/net/guildLaw.js';
import { seatWeekOf, seatWeekStartMs, seatKeyOk, turningPlan, SEAT_WEEK_MS, STANDING_START } from '../../src/net/townSeatLaw.js';

/** The most weeks one read settles - a service asleep for longer starts its count again from there. */
export const SETTLE_WEEKS_MAX = 8;

const weekAt = (nowS) => seatWeekOf(nowS * 1000);
const turningOf = (week) => Math.floor((seatWeekStartMs(week) + SEAT_WEEK_MS) / 1000);

/** A guild as the Chronicle keeps it: its name and tag that day. */
async function namesOf(db, ids) {
  const list = [...new Set(ids)].filter(Boolean);
  if (!list.length) return new Map();
  const { results = [] } = await db.prepare(`SELECT id, name, tag FROM guilds WHERE id IN (${list.map(() => '?').join(', ')})`).bind(...list).all();
  return new Map(results.map((g) => [g.id, { name: g.name, tag: g.tag }]));
}

/**
 * SETTLE WEEK `week` (SEAT0 5.2) - the plan over its standings, written in one batch keyed on the week. Answers
 * `{ settled: true, plan }`, or `{ settled: false }` when another reader settled it first (or the batch rolled back -
 * the next read settles it again).
 * @param {any} db
 * @param {number} week
 * @param {number} nowS
 */
export async function settleWeek(db, week, nowS) {
  if (await db.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').bind(week).first()) return { settled: false };
  const atS = turningOf(week);
  const registry = await confirmedSeats(db, nowS);
  const { results: pledgedKeys = [] } = await db.prepare('SELECT DISTINCT key FROM town_seat_pledges WHERE week = ?').bind(week).all();
  const { results: holdRows = [] } = await db.prepare('SELECT key, guild_id, region, standing, truce_week FROM town_seat_holds').all();
  const holds = new Map(holdRows.map((h) => [Number(h.key), h]));
  const keys = [...new Set([...pledgedKeys.map((p) => Number(p.key)), ...holds.keys()])].filter((k) => registry.has(k)).sort((a, b) => a - b);
  const { results: legacyRows = [] } = await db.prepare('SELECT key, guild_id, amount FROM town_seat_legacy WHERE week = ?').bind(week).all();
  const legacyOf = new Map(legacyRows.map((l) => [`${l.key}\n${l.guild_id}`, Number(l.amount)]));
  const seats = [];
  for (const key of keys) {
    const seat = registry.get(key);
    const at = await seatGuildsOf(db, key, week);
    const list = await gatherStandings(db, seat, week, atS);
    const h = holds.get(key);
    seats.push({
      key, tier: seat.tier,
      holder: h ? { guild: h.guild_id, standing: Number(h.standing), truceWeek: h.truce_week == null ? null : Number(h.truce_week) } : null,
      guilds: list.map((s) => ({ guild: s.guild, influence: s.total, legacy: legacyOf.get(`${key}\n${s.guild}`) ?? 0, pledgedAt: at.get(s.guild) ?? atS })),
    });
  }
  const guildIds = [...new Set(seats.flatMap((s) => s.guilds.map((g) => g.guild)))];
  const { results: purses = [] } = guildIds.length
    ? await db.prepare(`SELECT guild_id, balance FROM guild_marks WHERE guild_id IN (${guildIds.map(() => '?').join(', ')})`).bind(...guildIds).all() : { results: [] };
  const plan = turningPlan({ week, seats, treasuries: new Map(purses.map((p) => [p.guild_id, Number(p.balance)])) });
  const names = await namesOf(db, [...guildIds, ...holdRows.map((h) => h.guild_id)]);
  const next = week + 1;
  const history = (key, kind, data) => db.prepare('INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (?, ?, ?, ?, ?)')
    .bind(key, week, kind, JSON.stringify(data), nowS);
  const stmts = [db.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').bind(week, nowS)];
  for (const c of plan.claims) {
    // the fee burnt from the treasury - only where it holds it and the seat is still unheld, or the whole settle rolls back
    stmts.push(db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'guild', ?1, 'burn', NULL, 'seat-claim', ?2, ?3, ?4, 'seats', 'The Turning', ?5
      WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0) >= ?2 AND NOT EXISTS (SELECT 1 FROM town_seat_holds WHERE key = ?6)`)
      .bind(c.guild, c.fee, utcDay(nowS), nowS, `claim-${week}-${c.key}`, c.key), mustChange(db));
    stmts.push(db.prepare('INSERT INTO town_seat_holds (key, guild_id, region, since_week, standing, truce_week, at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(c.key, c.guild, registry.get(c.key).region, next, STANDING_START, next, nowS));
    stmts.push(history(c.key, 'claim', { guild: names.get(c.guild), total: c.total, fee: c.fee }));
  }
  for (const c of plan.contested) {
    stmts.push(db.prepare("INSERT INTO town_seat_rights (week, key, kind, guild_id, against, total, defence, at) VALUES (?, ?, 'tourney', ?, ?, 0, 0, ?)")
      .bind(next, c.key, c.a, c.b, nowS));
    stmts.push(history(c.key, 'contested', { a: names.get(c.a), b: names.get(c.b) }));
  }
  for (const r of plan.rights) {
    const holder = holds.get(r.key).guild_id;
    stmts.push(db.prepare("INSERT INTO town_seat_rights (week, key, kind, guild_id, against, total, defence, at) VALUES (?, ?, 'siege', ?, ?, ?, ?, ?)")
      .bind(next, r.key, r.guild, holder, r.total, r.defence, nowS));
    stmts.push(history(r.key, 'right', { guild: names.get(r.guild), holder: names.get(holder), total: r.total, defence: r.defence }));
  }
  for (const h of plan.held) {
    stmts.push(db.prepare('UPDATE town_seat_holds SET standing = ? WHERE key = ? AND guild_id = ?').bind(h.standing, h.key, h.guild));
    stmts.push(history(h.key, 'held', { guild: names.get(h.guild), standing: h.standing }));
  }
  for (const l of plan.legacy) {
    stmts.push(db.prepare('INSERT INTO town_seat_legacy (week, key, guild_id, amount) VALUES (?, ?, ?, ?)').bind(next, l.key, l.guild, l.amount));
  }
  try { await db.batch(stmts); } catch { return { settled: false }; }
  return { settled: true, plan };
}

/** THE SEATS AS THE MAP AND THE ARRIVAL NEED THEM: each listed seat with its holder and this week's battle at it (a
 *  Contested seat's Tourney, a held seat's siege), or null. */
export async function seatsWithHolders(db, seats, nowS) {
  const holds = await holdsOf(db);
  const battles = await battlesOf(db, weekAt(nowS));
  return seats.map((s) => ({ ...s, holder: holds.get(s.key) ?? null, battle: battles.get(s.key) ?? null }));
}

/**
 * THE TURNINGS DUE (SEAT0 5.2: "the first time anything asks about any seat"): every week before this one not yet
 * settled, oldest first - from the week after the last settled (or, on a service that has settled none, the last week
 * alone), at most SETTLE_WEEKS_MAX back. Cheap when nothing is due: one read.
 * @param {any} db
 * @param {number} nowS
 */
export async function settleDue(db, nowS) {
  const current = weekAt(nowS);
  const last = (await db.prepare('SELECT MAX(week) AS w FROM town_seat_weeks').first())?.w;
  const from = Math.max(last == null ? current - 1 : Number(last) + 1, current - SETTLE_WEEKS_MAX);
  let n = 0;
  for (let w = from; w < current; w++) if ((await settleWeek(db, w, nowS)).settled) n++;
  return n;
}

/**
 * RELINQUISH A CHARTER (SEAT0 16: "The Guildmaster first relinquishes each Charter at its board - the seat is unheld at
 * once, its fortifications stay, a history row says so"). The guildmaster's alone, asked in the DELETE.
 * @param {{db: any, nowS: number}} ctx
 */
export async function relinquishSeat({ db, nowS }, player, env, { character, key } = {}) {
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  if (Number(a.me.rank) !== GUILD_RANK_MASTER) return { error: 'guild-rank' };
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  const names = await namesOf(db, [a.me.guild_id]);
  const [gone] = await db.batch([
    db.prepare(`DELETE FROM town_seat_holds WHERE key = ?1 AND guild_id = ?2
      AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?3 AND guild_id = ?2 AND rank = ?4)`).bind(key, a.me.guild_id, Number(a.me.rid), GUILD_RANK_MASTER),
    db.prepare(`INSERT INTO town_seat_history (key, week, kind, data, at) SELECT ?1, ?2, 'relinquish', ?3, ?4 WHERE changes() > 0`)
      .bind(key, weekAt(nowS), JSON.stringify({ guild: names.get(a.me.guild_id) }), nowS),
  ]);
  return gone?.meta?.changes ? { ok: true } : { error: 'seat-not-held' };
}
