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
// boundary, not to the reader's now). SEAT1d: each holder's week beside
// it - its own members' Watch there, the gates felled in its region, its
// writs filled there, its Tithe and what it owes from Neglect, the Edict
// proclaimed for the coming week - and the accounts that played (the
// crown's scale); the batch pays the upkeep and the Edicts, lapses a
// Charter neglected twice, writes every Standing, and sends a Bounty's
// unspent escrow home. The battles a Right or a Contested seat names are
// SEAT2a's to fight - until then they are the Chronicle's.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═════════════════════════════════════════════════════════════════════
import { confirmedSeats, seatsOpenFor } from './townSeats.js';
import { gatherStandings, seatGuildsOf, holdsOf, battlesOf, agreedGateRegions } from './seatInfluence.js';
import { activeIn, edictsOf } from './seatHolding.js';
import { gameDayAt, gateTimes } from '../../src/net/gateLaw.js';
import { guildActorOf } from './guilds.js';
import { mustChange } from './realm.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { GUILD_RANK_MASTER } from '../../src/net/guildLaw.js';
import { seatWeekOf, seatWeekStartMs, seatKeyOk, turningPlan, seatGlyphsOf, seatTitleOf, SEAT_WEEK_MS, STANDING_START } from '../../src/net/townSeatLaw.js';

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
  const { results: holdRows = [] } = await db.prepare('SELECT key, guild_id, region, tier, standing, truce_week, tithe, owed FROM town_seat_holds').all();
  const holds = new Map(holdRows.map((h) => [Number(h.key), h]));
  const keys = [...new Set([...pledgedKeys.map((p) => Number(p.key)), ...holds.keys()])].filter((k) => registry.has(k)).sort((a, b) => a - b);
  const { results: legacyRows = [] } = await db.prepare('SELECT key, guild_id, amount FROM town_seat_legacy WHERE week = ?').bind(week).all();
  const legacyOf = new Map(legacyRows.map((l) => [`${l.key}\n${l.guild_id}`, Number(l.amount)]));
  const next = week + 1;
  // SEAT1d: the holders' week - the gates the week's days felled, region by region; the Edicts proclaimed for the next
  const fromS = Math.floor(seatWeekStartMs(week) / 1000);
  const days = [];
  for (let d = gameDayAt(fromS * 1000); d <= gameDayAt(atS * 1000); d++) { const r = gateTimes(d).riseAt / 1000; if (r >= fromS && r < atS) days.push(d); }
  const gatesIn = new Map();
  for (const region of (await agreedGateRegions(db, days)).values()) gatesIn.set(region, (gatesIn.get(region) ?? 0) + 1);
  const { results: proclaimed = [] } = await db.prepare("SELECT key, edict, guild_id, set_aside FROM town_seat_edicts WHERE week = ? AND state = 'proclaimed'").bind(next).all();
  const seats = [];
  for (const key of keys) {
    const seat = registry.get(key);
    const at = await seatGuildsOf(db, key, week);
    const list = await gatherStandings(db, seat, week, atS);
    const h = holds.get(key);
    let holder = null;
    if (h) {
      const watched = await db.prepare("SELECT 1 FROM town_seat_influence WHERE week = ? AND key = ? AND guild_id = ? AND source = 'watch' LIMIT 1").bind(week, key, h.guild_id).first();
      const writs = await db.prepare("SELECT COUNT(*) AS n FROM guild_writs WHERE guild_id = ? AND region = ? AND state = 'filled' AND closed_at >= ? AND closed_at < ?")
        .bind(h.guild_id, Number(h.region), fromS, atS).first();
      const e = proclaimed.find((x) => Number(x.key) === key && x.guild_id === h.guild_id) ?? null;
      holder = {
        guild: h.guild_id, standing: Number(h.standing), truceWeek: h.truce_week == null ? null : Number(h.truce_week),
        tithe: Number(h.tithe), owed: Number(h.owed), watched: !!watched, gates: gatesIn.get(Number(h.region)) ?? 0, writs: Number(writs?.n ?? 0),
        edict: e?.edict ?? null, setAside: Number(e?.set_aside ?? 0),
      };
    }
    seats.push({
      key, tier: seat.tier, holder,
      guilds: list.map((s) => ({ guild: s.guild, influence: s.total, legacy: legacyOf.get(`${key}\n${s.guild}`) ?? 0, pledgedAt: at.get(s.guild) ?? atS })),
    });
  }
  const guildIds = [...new Set(seats.flatMap((s) => s.guilds.map((g) => g.guild)))];
  // the holders' treasuries too - a holder nobody else pledged against still pays its upkeep
  const purseIds = [...new Set([...guildIds, ...holdRows.map((h) => h.guild_id)])];
  const { results: purses = [] } = purseIds.length
    ? await db.prepare(`SELECT guild_id, balance FROM guild_marks WHERE guild_id IN (${purseIds.map(() => '?').join(', ')})`).bind(...purseIds).all() : { results: [] };
  const plan = turningPlan({ week, seats, treasuries: new Map(purses.map((p) => [p.guild_id, Number(p.balance)])), active: await activeIn(db, week) });
  const names = await namesOf(db, purseIds);
  const history = (key, kind, data) => db.prepare('INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (?, ?, ?, ?, ?)')
    .bind(key, week, kind, JSON.stringify(data), nowS);
  const stmts = [db.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').bind(week, nowS)];
  for (const c of plan.claims) {
    // the fee burnt from the treasury - only where it holds it and the seat is still unheld, or the whole settle rolls back
    stmts.push(db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'guild', ?1, 'burn', NULL, 'seat-claim', ?2, ?3, ?4, 'seats', 'The Turning', ?5
      WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0) >= ?2 AND NOT EXISTS (SELECT 1 FROM town_seat_holds WHERE key = ?6)`)
      .bind(c.guild, c.fee, utcDay(nowS), nowS, `claim-${week}-${c.key}`, c.key), mustChange(db));
    stmts.push(db.prepare('INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(c.key, c.guild, registry.get(c.key).region, registry.get(c.key).tier, next, STANDING_START, next, nowS));
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
  // SEAT1d (7.1, 5.2 step 5): THE UPKEEP - burnt where the treasury holds it (or the settle rolls back whole), Neglect's
  // debt written, a Charter neglected twice lapsed and its coming Edict void
  const burn = (guild, kind, amount, rid) => db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    SELECT 'guild', ?1, 'burn', NULL, ?2, ?3, ?4, ?5, 'seats', 'The Turning', ?6 WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0) >= ?3`)
    .bind(guild, kind, amount, utcDay(nowS), nowS, rid);
  for (const u of plan.upkeep) {
    if (u.state === 'paid' || u.state === 'late') {
      if (u.paid > 0) stmts.push(burn(u.guild, 'seat-upkeep', u.paid, `upkeep-${week}-${u.key}`), mustChange(db));
      stmts.push(db.prepare('UPDATE town_seat_holds SET owed = 0 WHERE key = ? AND guild_id = ?').bind(u.key, u.guild));
      if (u.state === 'late') stmts.push(history(u.key, 'late', { guild: names.get(u.guild), paid: u.paid }));
    } else if (u.state === 'neglect') {
      stmts.push(db.prepare('UPDATE town_seat_holds SET owed = ? WHERE key = ? AND guild_id = ?').bind(u.owed, u.key, u.guild));
      stmts.push(history(u.key, 'neglect', { guild: names.get(u.guild), owed: u.owed }));
    } else {
      stmts.push(db.prepare('DELETE FROM town_seat_holds WHERE key = ? AND guild_id = ?').bind(u.key, u.guild));
      stmts.push(db.prepare("UPDATE town_seat_edicts SET state = 'void' WHERE key = ? AND week = ? AND state = 'proclaimed'").bind(u.key, next));
      stmts.push(history(u.key, 'lapse', { guild: names.get(u.guild) }));
    }
  }
  // the coming week's Edicts: law, their cost burnt (a Bounty's escrowed) - or fallen
  for (const e of plan.edicts) {
    if (e.state === 'law') {
      if (e.cost > 0) {
        stmts.push(e.edict === 'bounty'
          ? db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
              SELECT 'guild', ?1, 'escrow', ?2, 'bounty-escrow', ?3, ?4, ?5, 'seats', 'The Turning', ?2
              WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0) >= ?3`).bind(e.guild, `bounty:${e.key}:${next}`, e.cost, utcDay(nowS), nowS)
          : burn(e.guild, 'seat-edict', e.cost, `edict-${next}-${e.key}`), mustChange(db));
      }
      stmts.push(db.prepare("UPDATE town_seat_edicts SET state = 'law', cost = ? WHERE key = ? AND week = ? AND guild_id = ? AND state = 'proclaimed'").bind(e.cost, e.key, next, e.guild));
      stmts.push(history(e.key, 'edict', { guild: names.get(e.guild), edict: e.edict }));
    } else {
      stmts.push(db.prepare("UPDATE town_seat_edicts SET state = 'unpaid' WHERE key = ? AND week = ? AND guild_id = ? AND state = 'proclaimed'").bind(e.key, next, e.guild));
      stmts.push(history(e.key, 'edict-unpaid', { guild: names.get(e.guild), edict: e.edict }));
    }
  }
  // the week's Bounties done: what their escrow did not pay goes home
  for (const [key, b] of await edictsOf(db, week)) {
    if (b.edict !== 'bounty') continue;
    stmts.push(db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'escrow', ?1, 'guild', guild_id, 'bounty-return', set_aside - spent, ?2, ?3, 'seats', 'The Turning', ?1 || ':return'
      FROM town_seat_edicts WHERE key = ?4 AND week = ?5 AND state = 'law' AND set_aside > spent AND EXISTS (SELECT 1 FROM guilds WHERE id = guild_id)`)
      .bind(`bounty:${key}:${week}`, utcDay(nowS), nowS, key, week));
    stmts.push(db.prepare("UPDATE town_seat_edicts SET state = 'returned' WHERE key = ? AND week = ? AND state = 'law'").bind(key, week));
  }
  // every held seat's Standing after its week (7.3); the unchallenged in the Chronicle
  for (const w of plan.standings) {
    stmts.push(db.prepare('UPDATE town_seat_holds SET standing = ? WHERE key = ? AND guild_id = ?').bind(w.standing, w.key, w.guild));
  }
  for (const h of plan.held) {
    stmts.push(history(h.key, 'held', { guild: names.get(h.guild), standing: h.standing }));
  }
  for (const l of plan.legacy) {
    stmts.push(db.prepare('INSERT INTO town_seat_legacy (week, key, guild_id, amount) VALUES (?, ?, ?, ?)').bind(next, l.key, l.guild, l.amount));
  }
  try { await db.batch(stmts); } catch { return { settled: false }; }
  return { settled: true, plan };
}

/** THE SEATS AS THE MAP AND THE ARRIVAL NEED THEM: each listed seat with its holder and this week's battle at it (a
 *  Contested seat's Tourney, a held seat's siege), or null. SEAT1d: the holder with the Edict that rules this week (the
 *  client's shops, its arrival and its Festival read it), or null. */
export async function seatsWithHolders(db, seats, nowS) {
  const holds = await holdsOf(db);
  const battles = await battlesOf(db, weekAt(nowS));
  const edicts = await edictsOf(db, weekAt(nowS));
  return seats.map((s) => {
    const h = holds.get(s.key) ?? null;
    const e = edicts.get(s.key);
    return { ...s, holder: h ? { ...h, edict: e && e.guild === h.guild.id ? e.edict : null } : null, battle: battles.get(s.key) ?? null };
  });
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

/**
 * SEAT1c (SEAT0 7.4): WHAT A CHARACTER'S GUILD'S CHARTERS GIVE IT at a token's mint - every member the glyphs
 * (seatGlyphsOf), its guildmaster the title (seatTitleOf). `{ glyphs, title, ts }` - empty and null for a character in no
 * guild, or one holding none.
 */
export async function seatBadgeOf(db, playerId, character) {
  const m = typeof character === 'string'
    ? await db.prepare('SELECT guild_id, rank FROM guild_members WHERE player = ? AND char_id = ?').bind(playerId, character).first() : null;
  if (!m) return { glyphs: [], title: null, ts: null };
  const { results = [] } = await db.prepare('SELECT key, tier, region FROM town_seat_holds WHERE guild_id = ? ORDER BY key').bind(m.guild_id).all();
  const holds = results.map((h) => ({ key: Number(h.key), tier: h.tier, region: Number(h.region) }));
  const t = Number(m.rank) === GUILD_RANK_MASTER ? seatTitleOf(holds) : null;
  return { glyphs: seatGlyphsOf(holds), title: t?.title ?? null, ts: t?.ts ?? null };
}
/** SEAT1c: the seat titles an ACCOUNT may choose to wear - those its guildmaster characters' guilds' Charters give. The
 *  wardrobe offers them; a token wears one only for the guildmaster character it is minted for. */
export async function seatTitlesOf(db, playerId) {
  const { results = [] } = await db.prepare(`SELECT h.key, h.tier, h.region FROM town_seat_holds h
    JOIN guild_members m ON m.guild_id = h.guild_id WHERE m.player = ? AND m.rank = ?`).bind(playerId, GUILD_RANK_MASTER).all();
  const out = new Set(results.map((h) => (h.tier === 'crown' ? 'protector' : 'warden')));
  return ['warden', 'protector'].filter((t) => out.has(t));
}
