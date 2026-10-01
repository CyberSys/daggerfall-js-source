// @ts-check
// ═════════════════════════════════════════════════════════════════════
// SEAT2a part three (2026-10-01, Mac: "Finish the seats"; "Or we could go
// ahead and do sieges"; "Continue") - WHAT THE SERVICE SAYS OF A BATTLE:
// who may enter it (the pass, over the field the fighters' games agree),
// what it gave (the result off the relay's `s1` receipt), and each
// fighter's Honours.
//
// bible/11-Multiplayer/Seats-Arc.md 6.2, 6.5-6.8. The numbers are
// src/net/townSeatLaw.js's; the battle is the relay's (net/siegeRef.js).
//
// FACT: the relay has no door to this service. So the pass is an order
// this service signs and the room checks with the key it already holds
// (net/identityToken.js's `siege` order), and the result comes back in a
// fighter's own client - each fighter's receipt carries it - the first
// to arrive writing it, once a battle.
//
// ONE STATEMENT DECIDES, as everywhere a seat's rows move: the result's
// INSERT is the batch's first write and its key the battle's, so a second
// receipt for the same battle rolls back whole; an Honours row the same,
// once an account a battle.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═════════════════════════════════════════════════════════════════════
import { accountKind, displayName, overRate } from './accounts.js';
import { seatsOpenFor, confirmedSeats } from './townSeats.js';
import { mustChange } from './realm.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { mintSiegeOrder, siegeFieldValid } from '../../src/net/identityToken.js';
import { verifySiegeReceipt } from '../../src/net/siegeReceipt.js';
import { RENOWN_XP_MAX, RENOWN_TRACKS_MAX } from '../../src/net/renown.js';
import {
  seatWeekOf, seatKeyOk, settleField, passWindowEnds, passOpens, siegeWinner, siegeAftermath, spoilsOf, SIEGE_HONOURS,
  SIEGE_PAIR_WEEKS, CLAIM_FEE, STANDING_START, STANDING_MAX,
} from '../../src/net/townSeatLaw.js';

const weekAt = (nowS) => seatWeekOf(nowS * 1000);
/** The passes an account may ask for in an hour - one a connection, a battle's worth of reconnects. */
export const SIEGE_PASS_HOUR = 120;
const seatOpen = (player, env) => (accountKind(player) !== 'linked' ? { error: 'seats-need-account' } : !seatsOpenFor(player, env) ? { error: 'seats-closed' } : null);
const ridOf = () => { const b = new Uint8Array(12); crypto.getRandomValues(b); return [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };

/** A battle row, or null. */
async function battleAt(db, week, key) {
  const b = await db.prepare('SELECT * FROM town_seat_battles WHERE week = ? AND key = ?').bind(week, key).first();
  return b ? { ...b, starts_at: Number(b.starts_at), ends_at: Number(b.ends_at), week: Number(b.week), key: Number(b.key) } : null;
}
const resultAt = (db, week, key) => db.prepare('SELECT result, raised, winner FROM town_seat_results WHERE week = ? AND key = ?').bind(week, key).first();

/**
 * THE PASS (6.2, 6.4, 6.6): this week's battle at `key`, from ten minutes before its start until its window closes - a
 * signed fighter on its side, anyone else a spectator. A fighter's game sends the field it derived from the town
 * (`field`, the pass's `sf`); the battle's field is settled as the law says (townSeatLaw.js settleField) and every pass
 * carries it. Answers `{ pass, side, week, key, startsAt, endsAt, window }`; `pass` null where this service holds no
 * signing key (the room then admits nobody - said, never a pass that cannot be checked).
 * @param {{db: any, nowS: number, subtle: SubtleCrypto}} ctx
 * @param {CryptoKey|null} signingKey
 */
export async function siegePass({ db, nowS, subtle }, player, env, { key, field } = {}, signingKey) {
  const closed = seatOpen(player, env);
  if (closed) return closed;
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  const week = weekAt(nowS);
  const b = await battleAt(db, week, key);
  if (!b || b.state === 'void') return { error: 'battle-none' };
  if (nowS < passOpens(b)) return { error: 'pass-early' };
  const se = passWindowEnds(b);
  if (nowS >= se) return { error: 'pass-late' };
  if (await overRate({ db, nowS }, `seat-pass:${player.id}`, SIEGE_PASS_HOUR, 3600)) return { error: 'seats-rate' };
  const row = await db.prepare('SELECT side FROM town_seat_rosters WHERE week = ? AND key = ? AND account = ?').bind(week, key, player.id).first();
  const side = row?.side === 'attack' || row?.side === 'defend' ? row.side : 'watch';
  let settled = b.field ?? null;
  if (!settled) {
    if (side !== 'watch') {
      if (!siegeFieldValid(field, b.tier)) return { error: 'field-bad' };
      await db.prepare(`INSERT INTO town_seat_fields (week, key, account, side, field, at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (week, key, account) DO UPDATE SET field = excluded.field, at = excluded.at`)
        .bind(week, key, player.id, side, JSON.stringify(field), nowS).run();
    }
    const { results: rows = [] } = await db.prepare('SELECT side, field, at FROM town_seat_fields WHERE week = ? AND key = ? ORDER BY at, rowid').bind(week, key).all();
    const f = settleField(rows.map((r) => ({ side: r.side, field: r.field, at: Number(r.at) })), nowS >= b.starts_at);
    if (!f) return { error: 'field-unsettled' };
    // settled once: a second request racing this one keeps the first's
    await db.prepare('UPDATE town_seat_battles SET field = ? WHERE week = ? AND key = ? AND field IS NULL').bind(f, week, key).run();
    settled = (await db.prepare('SELECT field FROM town_seat_battles WHERE week = ? AND key = ?').bind(week, key).first())?.field ?? f;
  }
  const out = { side, week, key, startsAt: b.starts_at, endsAt: b.ends_at, window: se };
  if (!signingKey) return { ...out, pass: null };
  const sf = JSON.parse(String(settled));
  const pass = await mintSiegeOrder({ s: player.id, sk: key, sw: week, sd: side, st: b.tier, sn: b.kind, sb: b.starts_at, se, sf }, signingKey, { subtle, nowS });
  return { ...out, pass };
}

/** Each contender's influence at the seat in the battle's week - a Tourney's dead heat goes to the higher (6.7). */
async function higherOf(db, b) {
  const { results: rows = [] } = await db.prepare('SELECT guild_id, SUM(amount) AS n FROM town_seat_influence WHERE week = ? AND key = ? AND guild_id IN (?, ?) GROUP BY guild_id')
    .bind(b.week, b.key, b.attacker, b.defender).all();
  const of = (g) => Number(rows.find((r) => r.guild_id === g)?.n ?? 0);
  const a = of(b.attacker), d = of(b.defender);
  return a > d ? 'attack' : d > a ? 'defend' : null;
}

/**
 * THE RESULT (6.5-6.8), written once a battle - what it gave, in the result's own batch:
 *   a seat taken: the Charter the attacker's (Standing 50, in truce at the next Turning, its Tithe and arrears its own -
 *     none), the old holder's Legacy at the seat cleared;
 *   a seat held: the holder's Standing +15 and its next defence x1.2 where a banner was raised; a forfeit: +10 (once a
 *     Season against the same challenger) and x1.2; either way the challenger's influence at the seat this week cleared
 *     and the seat barred to it at the next Turning;
 *   a Tourney: the winner takes the Charter and pays the claim fee - else the other if it can - else the seat stays
 *     unheld;
 *   the Sellswords: a signed contract's escrowed fee paid to its Sellsword, an unsigned one's home to its guild.
 * Answers whether this request wrote it (a racing one finds it written).
 */
async function applyResult(db, b, c, nowS) {
  const W = b.week, K = b.key, result = c.r, raised = c.a === 1 ? 1 : 0;
  const names = new Map();
  const { results: gs = [] } = await db.prepare('SELECT id, name, tag FROM guilds WHERE id IN (?, ?)').bind(b.attacker, b.defender).all();
  for (const g of gs) names.set(g.id, { name: g.name, tag: g.tag });
  const nameOf = (id) => names.get(id) ?? { name: '', tag: '' };
  const history = (kind, data) => db.prepare('INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (?, ?, ?, ?, ?)').bind(K, W, kind, JSON.stringify(data), nowS);
  const day = utcDay(nowS);
  const swords = [
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'escrow', 'hire:' || week || ':' || key || ':' || account || ':' || at, 'account', account, 'sellsword-fee', fee, ?3, ?4, 'seats', 'A siege',
        'hire:' || week || ':' || key || ':' || account || ':' || at || ':fee'
      FROM town_seat_hires WHERE week = ?1 AND key = ?2 AND state = 'signed' AND fee > 0`).bind(W, K, day, nowS),
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'escrow', 'hire:' || week || ':' || key || ':' || account || ':' || at, 'guild', guild_id, 'sellsword-return', fee, ?3, ?4, 'seats', 'A siege',
        'hire:' || week || ':' || key || ':' || account || ':' || at || ':return'
      FROM town_seat_hires WHERE week = ?1 AND key = ?2 AND state = 'offered' AND fee > 0`).bind(W, K, day, nowS),
    db.prepare("UPDATE town_seat_hires SET state = 'withdrawn' WHERE week = ? AND key = ? AND state = 'offered'").bind(W, K),
  ];
  const head = (winner) => [
    db.prepare('INSERT INTO town_seat_results (week, key, result, raised, winner, rid, at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(W, K, result, raised, winner, ridOf(), nowS),
    db.prepare("UPDATE town_seat_battles SET state = ? WHERE week = ? AND key = ?").bind(result === 'forfeit' ? 'forfeit' : 'fought', W, K),
  ];
  const run = async (stmts) => { try { await db.batch(stmts); return true; } catch { return false; } };
  if (b.kind === 'tourney') {
    const higher = result === 'tie' ? await higherOf(db, b) : null;
    const winner = siegeWinner(result, higher);
    const order = winner === 'defend' ? [b.defender, b.attacker] : winner === 'attack' ? [b.attacker, b.defender] : [];
    const seat = (await confirmedSeats(db, nowS)).get(K);
    const fee = CLAIM_FEE[b.tier] ?? CLAIM_FEE.palace;
    for (const g of order) {
      // the fee burnt where the treasury holds it and the seat is still unheld - or this whole attempt rolls back
      const ok = await run([...head(g === b.attacker ? 'attack' : 'defend'),
        db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
          SELECT 'guild', ?1, 'burn', NULL, 'seat-claim', ?2, ?3, ?4, 'seats', 'The Tourney', ?5
          WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0) >= ?2 AND NOT EXISTS (SELECT 1 FROM town_seat_holds WHERE key = ?6)`)
          .bind(g, fee, day, nowS, `tourney-${W}-${K}`, K), mustChange(db),
        db.prepare('INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind(K, g, Number(seat?.region ?? 0), b.tier, W, STANDING_START, W, nowS),
        history('tourney-won', { guild: nameOf(g) }), ...swords]);
      if (ok) return true;
      if (await resultAt(db, W, K)) return false;   // another receipt wrote it first
    }
    return run([...head(null), history('tourney-unheld', {}), ...swords]);
  }
  const forfeitPaid = result === 'forfeit' && !!(await db.prepare(`SELECT 1 FROM town_seat_results r JOIN town_seat_battles x ON x.week = r.week AND x.key = r.key
    WHERE r.result = 'forfeit' AND x.attacker = ? AND x.defender = ? AND r.week > ? AND r.week < ? LIMIT 1`).bind(b.attacker, b.defender, W - SIEGE_PAIR_WEEKS, W).first());
  const after = siegeAftermath('siege', result, raised, { forfeitPaid });
  const stmts = [...head(siegeWinner(result))];
  if (after.taken) {
    const seat = (await confirmedSeats(db, nowS)).get(K);
    stmts.push(
      db.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (key) DO UPDATE SET guild_id = excluded.guild_id, since_week = excluded.since_week, standing = excluded.standing,
          truce_week = excluded.truce_week, tithe = 0, tithe_week = NULL, owed = 0, at = excluded.at`)
        .bind(K, b.attacker, Number(seat?.region ?? 0), b.tier, W, STANDING_START, W, nowS),
      db.prepare('DELETE FROM town_seat_legacy WHERE key = ? AND guild_id = ? AND week >= ?').bind(K, b.defender, W),
      history('siege-taken', { guild: nameOf(b.attacker), from: nameOf(b.defender) }),
    );
  } else {
    if (after.standing) stmts.push(db.prepare('UPDATE town_seat_holds SET standing = MIN(?, standing + ?) WHERE key = ? AND guild_id = ?').bind(STANDING_MAX, after.standing, K, b.defender));
    if (after.bonus) stmts.push(db.prepare("INSERT OR IGNORE INTO town_seat_aftermath (week, key, guild_id, what) VALUES (?, ?, ?, 'bonus')").bind(W, K, b.defender));
    if (after.barred) {
      stmts.push(
        db.prepare("INSERT OR IGNORE INTO town_seat_aftermath (week, key, guild_id, what) VALUES (?, ?, ?, 'barred')").bind(W, K, b.attacker),
        db.prepare('DELETE FROM town_seat_influence WHERE week = ? AND key = ? AND guild_id = ?').bind(W, K, b.attacker),
        db.prepare('DELETE FROM town_seat_legacy WHERE week = ? AND key = ? AND guild_id = ?').bind(W, K, b.attacker),
      );
    }
    const kind = result === 'forfeit' ? 'siege-forfeit' : result === 'absent' ? 'siege-absent' : 'siege-held';
    stmts.push(history(kind, { guild: nameOf(b.defender), against: nameOf(b.attacker) }));
  }
  return run([...stmts, ...swords]);
}

/**
 * THE CLAIM (6.8): a fighter's `s1` receipt, verified with the relay's public half and naming this account - the battle's
 * result written by the first to arrive (applyResult), and this fighter's Honours where it earned them: on the winning
 * side 50 Marks and 2,000 Renown XP to `character`, on the losing 25 and 1,000, and a roll on the Spoils of War into that
 * character's Stores - once a battle an account; nothing but the row where the two guilds' Honours were spent this Season
 * (townSeatLaw.js SIEGE_PAIR_WEEKS). Answers `{ result, winner, applied, honours }` - `honours` null where the receipt
 * earned none.
 * @param {{db: any, nowS: number, subtle: SubtleCrypto}} ctx
 * @param {CryptoKey|null} publicKey
 */
export async function claimSiege({ db, nowS, subtle }, player, env, { receipt, character } = {}, publicKey) {
  const closed = seatOpen(player, env);
  if (closed) return closed;
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifySiegeReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.s !== player.id) return { error: 'not-yours' };
  const b = await battleAt(db, c.sw, c.sk);
  if (!b || b.state === 'void') return { error: 'battle-none' };
  let r = await resultAt(db, c.sw, c.sk);
  const applied = !r && await applyResult(db, b, c, nowS);
  r = await resultAt(db, c.sw, c.sk);
  if (!r) throw new Error('claimSiege: the result was neither written nor found');   // a 500, never a quiet loss
  const out = { result: r.result, winner: r.winner ?? null, applied };
  if (c.h !== 1) return { ...out, honours: null };
  if (typeof character !== 'string' || !character || character.length > 64) return { error: 'honours-character' };
  if (await db.prepare('SELECT 1 FROM town_seat_honours WHERE week = ? AND key = ? AND account = ?').bind(c.sw, c.sk, player.id).first()) return { error: 'honours-twice' };
  // the pair's Honours this Season: any other battle between the two guilds, either way round, in the last 8 weeks
  const spent = !!(await db.prepare(`SELECT 1 FROM town_seat_honours h JOIN town_seat_battles x ON x.week = h.week AND x.key = h.key
    WHERE h.marks > 0 AND h.week > ?1 AND h.week <= ?2 AND NOT (h.week = ?2 AND h.key = ?5)
      AND ((x.attacker = ?3 AND x.defender = ?4) OR (x.attacker = ?4 AND x.defender = ?3)) LIMIT 1`).bind(c.sw - SIEGE_PAIR_WEEKS, c.sw, b.attacker, b.defender, c.sk).first());
  const won = r.winner === c.sd;
  const give = spent ? { marks: 0, xp: 0 } : won ? SIEGE_HONOURS.win : SIEGE_HONOURS.lose;
  const spoil = spent ? null : spoilsOf(c.sw, c.sk, player.id);
  const rid = ridOf();
  const mine = 'EXISTS (SELECT 1 FROM town_seat_honours WHERE week = ?1 AND key = ?2 AND account = ?3 AND rid = ?4)';
  const stmts = [
    db.prepare('INSERT INTO town_seat_honours (week, key, account, side, char_id, marks, xp, spoil, rid, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(c.sw, c.sk, player.id, c.sd, character, give.marks, give.xp, spoil, rid, nowS),
  ];
  if (give.marks > 0) {
    stmts.push(db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'mint', NULL, 'account', ?3, 'siege-honours', ?5, ?6, ?7, ?3, 'Siege Honours', 'siege-honours:' || ?1 || ':' || ?2 WHERE ${mine}`)
      .bind(c.sw, c.sk, player.id, rid, give.marks, utcDay(nowS), nowS));
  }
  if (give.xp > 0) {
    stmts.push(
      db.prepare(`UPDATE renown_tracks SET xp = MIN(?5, xp + ?6), updated_at = ?7 WHERE player = ?3 AND char_id = ?8 AND ${mine}`)
        .bind(c.sw, c.sk, player.id, rid, RENOWN_XP_MAX, give.xp, nowS, character),
      db.prepare(`INSERT INTO renown_tracks (player, char_id, name, xp, last_rid, created_at, updated_at)
        SELECT ?3, ?8, ?9, MIN(?5, ?6), NULL, ?7, ?7 WHERE ${mine}
          AND NOT EXISTS (SELECT 1 FROM renown_tracks WHERE player = ?3 AND char_id = ?8)
          AND (SELECT COUNT(*) FROM renown_tracks WHERE player = ?3) < ?10`)
        .bind(c.sw, c.sk, player.id, rid, RENOWN_XP_MAX, give.xp, nowS, character, displayName(player), RENOWN_TRACKS_MAX),
    );
  }
  if (spoil) {
    stmts.push(db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) SELECT ?3, ?5, ?6, 'own', 1 WHERE ${mine}
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + 1`).bind(c.sw, c.sk, player.id, rid, character, spoil));
  }
  try { await db.batch(stmts); } catch { return { error: 'honours-twice' }; }
  return { ...out, honours: { side: c.sd, won, marks: give.marks, xp: give.xp, spoil, spent } };
}
