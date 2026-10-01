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
// unspent escrow home. SEAT2a: the battles a Right or a Contested seat names placed in
// the coming week (step 8) - their fighting is the relay's. CROWN1: a crown's Conscription
// that ruled the week paid out of the conscripted guilds' Tithe (7.6), after their upkeep;
// and part two: a Royal Tourney's prize escrowed as it is made law, and the week's champion
// named, paid and titled as its week settles. CROWN2: each vassal's tribute to its liege (5% of
// its week's Tithe, after its upkeep), the liege's half-reach on a vassal's defence, a fealty
// broken (the breaker's Standing -10 at every seat) or lapsed (a pair that no longer fits).
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═════════════════════════════════════════════════════════════════════
import { confirmedSeats, seatsOpenFor } from './townSeats.js';
import { gatherStandings, seatGuildsOf, holdsOf, battlesOf, agreedGateRegions } from './seatInfluence.js';
import { activeIn, edictsOf } from './seatHolding.js';
import { windowOf } from './seatBattles.js';   // SEAT2a: the holder's window, frozen into its battle
import { royalTurning } from './seatRoyal.js';   // CROWN1 part two: a Royal Tourney's champion named
import { gameDayAt, gateTimes } from '../../src/net/gateLaw.js';
import { guildActorOf } from './guilds.js';
import { mustChange } from './realm.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { GUILD_RANK_MASTER } from '../../src/net/guildLaw.js';
import { seatWeekOf, seatWeekStartMs, seatKeyOk, turningPlan, seatGlyphsOf, seatTitleOf, SEAT_WEEK_MS, STANDING_START, placeBattles, CROWN_SEAT_REGIONS, conscriptionDue,
  fealtyReckoning, fealtyTribute, seasonEndingAt, seasonStanding, seasonTitles, seasonOf, seasonRibbons } from '../../src/net/townSeatLaw.js';
import { tideAt } from '../../src/net/tideLaw.js';   // SEASON1 part two: the Tides
import { MARKS_MAX } from '../../src/net/marksLaw.js';

/** SEASON1 (18: "At its end seats, influence, fortifications and history are wiped; Marks, the Stores and profession
 *  tracks are kept"): what Season 0's last Turning clears, after it has settled its own week. DECIDED: what money is
 *  still owed out of - a battle's contracts, an Edict's escrow, a Royal Tourney's prize - and the titles and Honours
 *  earned stay, and so does every red line. */
export const SEASON_ZERO_WIPED = Object.freeze(['town_seat_holds', 'town_seat_legacy', 'town_seat_pledges', 'town_seat_binds', 'town_seat_influence',
  'town_seat_renown', 'town_seat_rights', 'town_seat_aftermath', 'town_seat_windows', 'town_seat_stockpile', 'town_seat_levies', 'town_seat_history',
  'guild_fealty', 'guild_pacts']);

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
 * SEASON1: `zero` the week Season 0 began (townSeatLaw.js seasonZeroOf), or null - no Season counted. A Turning that ends a
 * Season names its titles and moves every Standing halfway back toward 50, with no Legacy carried; Season 0's end
 * settles its own week, names nothing for the next and wipes the seats (SEASON_ZERO_WIPED).
 * @param {any} db
 * @param {number} week
 * @param {number} nowS
 * @param {number|null} [zero]
 */
export async function settleWeek(db, week, nowS, zero = null) {
  if (await db.prepare('SELECT 1 FROM town_seat_weeks WHERE week = ?').bind(week).first()) return { settled: false };
  const atS = turningOf(week);
  const registry = await confirmedSeats(db, nowS);
  const { results: pledgedKeys = [] } = await db.prepare('SELECT DISTINCT key FROM town_seat_pledges WHERE week = ?').bind(week).all();
  const { results: holdRows = [] } = await db.prepare('SELECT key, guild_id, region, tier, standing, truce_week, tithe, owed, since_week FROM town_seat_holds').all();
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
  // SEAT2a part three: the week's sieges remembered (6.5, 6.8) - a holder that held or won by forfeit defends at x1.2, its
  // challenger barred from the seat at this Turning
  const { results: afterRows = [] } = await db.prepare('SELECT key, guild_id, what FROM town_seat_aftermath WHERE week = ?').bind(week).all();
  const aftermath = (key, what) => afterRows.filter((r) => Number(r.key) === key && r.what === what).map((r) => r.guild_id);
  // CROWN2 (7.8): THE FEALTIES standing - each pair's Charters as they stand now; one that no longer fits lapses (no
  // Standing), one broken ends (its breaker's Standing -10 at every seat), the rest give the liege's half-reach on the
  // vassal's defence; each sworn the week through pays its tribute
  const charters = holdRows.map((h) => ({ key: Number(h.key), guild: h.guild_id, tier: h.tier, region: Number(h.region) }));
  const chartersOf = (g) => charters.filter((h) => h.guild === g);
  const { results: fealtyRows = [] } = await db.prepare("SELECT vassal, liege, state, broken_by FROM guild_fealty WHERE state IN ('sworn', 'breaking')").all();
  const reckoned = fealtyReckoning(fealtyRows, charters);
  const { fealties, breakers } = reckoned;
  // CROWN1 (7.6): THE CONSCRIPTIONS that ruled the week - each crown's, still held by the guild that proclaimed it, over
  // the Tithe every guild took this week; a seat that pays loses its Standing row (CROWN2: never a vassal of that crown's)
  const conscriptions = [];
  const ruling = [...(await edictsOf(db, week))].filter(([key, e]) => e.edict === 'conscription' && holds.get(key)?.guild_id === e.guild && holds.get(key)?.tier === 'crown');
  let tithes = new Map();
  if (ruling.length || fealties.length) {
    const { results: titheRows = [] } = await db.prepare("SELECT dst_id, SUM(amount) AS n FROM marks_ledger WHERE dst_kind = 'guild' AND kind = 'tithe' AND at >= ? AND at < ? GROUP BY dst_id")
      .bind(fromS, atS).all();
    tithes = new Map(titheRows.map((t) => [t.dst_id, Number(t.n)]));
  }
  for (const [key, e] of ruling) {
    const vassals = new Set(fealties.filter((f) => f.liege === e.guild).map((f) => f.vassal));
    for (const d of conscriptionDue({ kingdom: CROWN_SEAT_REGIONS[Number(holds.get(key).region)], crownGuild: e.guild, holds: charters, tithes, vassals })) {
      if (d.amount > 0) conscriptions.push({ crownKey: key, crown: e.guild, ...d });
    }
  }
  const conscripted = new Set(conscriptions.flatMap((c) => c.keys));
  const counted = !!seasonOf(week, zero);   // SEASON1 part two: the Tides roll while a Season is counted
  const seats = [];
  for (const key of keys) {
    const seat = registry.get(key);
    const at = await seatGuildsOf(db, key, week);
    const list = await gatherStandings(db, seat, week, atS, counted);
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
        edict: e?.edict ?? null, setAside: Number(e?.set_aside ?? 0), bonus: aftermath(key, 'bonus').includes(h.guild_id),
        conscripted: conscripted.has(key),
        // CROWN2: a vassal's liege's reach here, halved in the defence (seatDefence); a breaker's Standing row
        liegeReach: reckoned.liegeReach(h.guild_id, registry.get(key)),
        brokeFealty: breakers.has(h.guild_id),
        // SEASON1 part two (9.3): the week's Tide here (a Royal Wedding's Standing, a Tax Revolt's) and the coming week's
        // (a Festival's cost)
        tide: tideAt(week, seat.region, counted), tideNext: tideAt(next, seat.region, !!seasonOf(next, zero)),
      };
    }
    seats.push({
      key, tier: seat.tier, holder, barred: aftermath(key, 'barred'),
      guilds: list.map((s) => ({ guild: s.guild, influence: s.total, legacy: legacyOf.get(`${key}\n${s.guild}`) ?? 0, pledgedAt: at.get(s.guild) ?? atS })),
    });
  }
  const guildIds = [...new Set(seats.flatMap((s) => s.guilds.map((g) => g.guild)))];
  // the holders' treasuries too - a holder nobody else pledged against still pays its upkeep
  const purseIds = [...new Set([...guildIds, ...holdRows.map((h) => h.guild_id)])];
  const { results: purses = [] } = purseIds.length
    ? await db.prepare(`SELECT guild_id, balance FROM guild_marks WHERE guild_id IN (${purseIds.map(() => '?').join(', ')})`).bind(...purseIds).all() : { results: [] };
  const reckonedPlan = turningPlan({ week, seats, treasuries: new Map(purses.map((p) => [p.guild_id, Number(p.balance)])), active: await activeIn(db, week) });
  // SEASON1 (9.1, 18): the Season this Turning ends, if it ends one - Season 0's end settles its own week and sets nothing
  // up for the next (no Charter claimed, no Right, no battle, no Edict, no Legacy), then wipes the seats
  const ending = seasonEndingAt(week, zero);
  const wipe = ending?.n === 0;
  const plan = wipe ? { ...reckonedPlan, claims: [], contested: [], rights: [], edicts: [], standings: [], held: [], legacy: [] } : reckonedPlan;
  const names = await namesOf(db, [...purseIds, ...fealties.flatMap((f) => [f.vassal, f.liege])]);   // CROWN2: a lapsed liege may hold nothing now
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
  // SEAT2a (5.2 step 8, 6.3): THE SCHEDULE - every battle the Turning names placed in the coming week, in key order, a
  // siege at the holder's window frozen now (a crown's at its slot, a Tourney's Wednesday 20:00), moved where it would
  // overlap another battle of either of its guilds; a battle no start can hold is void, the Chronicle says so
  const battles = [
    ...plan.contested.map((c) => ({ key: c.key, kind: 'tourney', attacker: c.a, defender: c.b })),
    ...plan.rights.map((r) => ({ key: r.key, kind: 'siege', attacker: r.guild, defender: holds.get(r.key).guild_id })),
  ];
  for (const b of battles) {
    const seat = registry.get(b.key);
    Object.assign(b, { tier: seat.tier, kingdom: CROWN_SEAT_REGIONS[seat.region] ?? null, window: b.kind === 'siege' ? await windowOf(db, b.key, b.defender) : null });
  }
  const schedule = placeBattles(next, battles);
  for (const p of schedule.placed) {
    stmts.push(db.prepare('INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(next, p.key, p.kind, p.tier, p.attacker, p.defender, Math.floor(p.startsAt / 1000), Math.floor(p.endsAt / 1000), p.moved ? 1 : 0, nowS));
    if (p.moved) stmts.push(history(p.key, 'battle-moved', { at: Math.floor(p.startsAt / 1000) }));
  }
  for (const u of schedule.unplaced) stmts.push(history(u.key, 'battle-void', { kind: u.kind }));
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
        const held = e.edict === 'bounty' ? 'bounty' : e.edict === 'royal-tourney' ? 'royal' : null;   // CROWN1 part two: a Royal Tourney's prize held for its champion
        stmts.push(held
          ? db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
              SELECT 'guild', ?1, 'escrow', ?2, ?6, ?3, ?4, ?5, 'seats', 'The Turning', ?2
              WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0) >= ?3`).bind(e.guild, `${held}:${e.key}:${next}`, e.cost, utcDay(nowS), nowS, `${held}-escrow`)
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
  // CROWN1 (7.6): THE CONSCRIPTIONS PAID - after the upkeep and the Edicts, what is left of the guild's treasury up to
  // its due, to the crown (burnt where the crown's treasury is full, as a Tithe is); a treasury empty pays nothing
  for (const c of conscriptions) {
    const to = `COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?2), 0) + MIN(?3, balance) <= ${MARKS_MAX} AND EXISTS (SELECT 1 FROM guilds WHERE id = ?2)`;
    stmts.push(db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'guild', ?1, CASE WHEN ${to} THEN 'guild' ELSE 'burn' END, CASE WHEN ${to} THEN ?2 END, 'conscription', MIN(?3, balance), ?4, ?5, 'seats', 'The Turning', ?6
      FROM guild_marks WHERE guild_id = ?1 AND balance > 0`)
      .bind(c.guild, c.crown, c.amount, utcDay(nowS), nowS, `conscription-${week}-${c.crownKey}-${c.guild}`));
    stmts.push(history(c.crownKey, 'conscription', { guild: names.get(c.crown), from: names.get(c.guild), marks: c.amount }));
    for (const k of c.keys) stmts.push(history(k, 'conscripted', { guild: names.get(c.guild), crown: names.get(c.crown), marks: c.amount }));
  }
  // CROWN2 (7.8): THE FEALTIES - each vassal's tribute (5% of its week's Tithe, a fealty that stood the week through,
  // broken at this Turning or not), after its upkeep and Edicts and Conscription, from what is left of its treasury; then
  // the broken and the lapsed ended, the Chronicle saying so at the liege's crown and the vassal's seats
  const crownKeyOf = (g) => chartersOf(g).find((h) => h.tier === 'crown')?.key ?? null;
  for (const f of fealties) {
    const both = [crownKeyOf(f.liege), ...chartersOf(f.vassal).map((h) => h.key)].filter((k) => k != null);
    const owed = f.fits ? fealtyTribute(tithes.get(f.vassal) ?? 0) : 0;
    if (owed > 0) {
      const to = `COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?2), 0) + MIN(?3, balance) <= ${MARKS_MAX} AND EXISTS (SELECT 1 FROM guilds WHERE id = ?2)`;
      stmts.push(db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
        SELECT 'guild', ?1, CASE WHEN ${to} THEN 'guild' ELSE 'burn' END, CASE WHEN ${to} THEN ?2 END, 'fealty-tribute', MIN(?3, balance), ?4, ?5, 'seats', 'The Turning', ?6
        FROM guild_marks WHERE guild_id = ?1 AND balance > 0`).bind(f.vassal, f.liege, owed, utcDay(nowS), nowS, `fealty-${week}-${f.vassal}`));
      const k = crownKeyOf(f.liege);
      if (k != null) stmts.push(history(k, 'fealty-tribute', { vassal: names.get(f.vassal), liege: names.get(f.liege), marks: owed }));
    }
    if (f.broken || !f.fits) {
      stmts.push(db.prepare('DELETE FROM guild_fealty WHERE vassal = ? AND liege = ?').bind(f.vassal, f.liege));
      for (const k of both) stmts.push(history(k, f.broken ? 'fealty-broken' : 'fealty-lapsed', { vassal: names.get(f.vassal), liege: names.get(f.liege), ...(f.broken ? { breaker: names.get(f.broken) } : {}) }));
    }
  }
  // CROWN1 part two (7.6): THE WEEK'S ROYAL TOURNEYS - each champion named, paid its prize and titled; none, the prize home
  stmts.push(...(await royalTurning(db, week, nowS, history, registry)));
  // every held seat's Standing after its week (7.3) - SEASON1: halfway back toward 50 at a Season's end; the unchallenged
  // in the Chronicle
  for (const w of plan.standings) {
    stmts.push(db.prepare('UPDATE town_seat_holds SET standing = ? WHERE key = ? AND guild_id = ?').bind(ending ? seasonStanding(w.standing) : w.standing, w.key, w.guild));
  }
  for (const h of plan.held) {
    stmts.push(history(h.key, 'held', { guild: names.get(h.guild), standing: h.standing }));
  }
  for (const l of ending ? [] : plan.legacy) {   // SEASON1 (9.1): "Legacy is cleared"
    stmts.push(db.prepare('INSERT INTO town_seat_legacy (week, key, guild_id, amount) VALUES (?, ?, ?, ?)').bind(next, l.key, l.guild, l.amount));
  }
  // SEASON1 (9.1): A SEASON'S END - its titles, each its guild's guildmaster's for good ("Crowned in Season N" for every
  // crown's, "Keeper of <Town>, Season N" for a seat held the whole Season), over the Charters that stood its last week
  // through (none lapsed now); and the Chronicle's line at every one of them (Season 0's titles none, its lines wiped below)
  if (ending) {
    const lapsed = new Set(plan.upkeep.filter((u) => u.state === 'lapse').map((u) => u.key));
    const stood = holdRows.filter((h) => !lapsed.has(Number(h.key))).map((h) => ({ key: Number(h.key), guild: h.guild_id, tier: h.tier, since: Number(h.since_week) }));
    const titles = seasonTitles(ending, stood);
    const masters = await guildmastersOf(db, [...new Set(titles.map((t) => t.guild))]);
    for (const t of titles) {
      if (masters.has(t.guild)) stmts.push(db.prepare('INSERT OR IGNORE INTO town_seat_titles (account, title, key, week, at) VALUES (?, ?, ?, ?, ?)').bind(masters.get(t.guild), t.title, t.key, week, nowS));
    }
    // SEASON1 part two (9.1): the banner ribbon - each keeper's guild, for its members as they stand at this Turning
    for (const g of seasonRibbons(titles)) stmts.push(db.prepare('INSERT OR IGNORE INTO town_seat_ribbons (season, guild_id, at) VALUES (?, ?, ?)').bind(ending.n, g, atS));
    for (const h of stood) stmts.push(history(h.key, 'season-end', { guild: names.get(h.guild), season: ending.n, kept: h.since <= ending.start }));
  }
  // SEASON1 (18): SEASON 0'S END - the Edicts proclaimed for the next week void (none was paid), then the seats wiped
  if (wipe) {
    stmts.push(db.prepare("UPDATE town_seat_edicts SET state = 'void' WHERE week = ? AND state = 'proclaimed'").bind(next));
    for (const t of SEASON_ZERO_WIPED) stmts.push(db.prepare(`DELETE FROM ${t}`));
  }
  try { await db.batch(stmts); } catch { return { settled: false }; }
  return { settled: true, plan, season: ending };
}

/** SEASON1: each guild's guildmaster's account, by guild. */
async function guildmastersOf(db, guilds) {
  if (!guilds.length) return new Map();
  const { results = [] } = await db.prepare(`SELECT guild_id, player FROM guild_members WHERE rank = ? AND guild_id IN (${guilds.map(() => '?').join(', ')})`).bind(GUILD_RANK_MASTER, ...guilds).all();
  return new Map(results.map((r) => [r.guild_id, r.player]));
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
 * @param {number|null} [zero] SEASON1: the week Season 0 began, or null
 */
export async function settleDue(db, nowS, zero = null) {
  const current = weekAt(nowS);
  const last = (await db.prepare('SELECT MAX(week) AS w FROM town_seat_weeks').first())?.w;
  const from = Math.max(last == null ? current - 1 : Number(last) + 1, current - SETTLE_WEEKS_MAX);
  let n = 0;
  for (let w = from; w < current; w++) if ((await settleWeek(db, w, nowS, zero)).settled) n++;
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
export async function seatBadgeOf(db, playerId, character, season = 0) {   // SEASON1: the Season counted, on the title's claim
  const m = typeof character === 'string'
    ? await db.prepare('SELECT guild_id, rank FROM guild_members WHERE player = ? AND char_id = ?').bind(playerId, character).first() : null;
  if (!m) return { glyphs: [], title: null, ts: null };
  const { results = [] } = await db.prepare('SELECT key, tier, region FROM town_seat_holds WHERE guild_id = ? ORDER BY key').bind(m.guild_id).all();
  const holds = results.map((h) => ({ key: Number(h.key), tier: h.tier, region: Number(h.region) }));
  const t = Number(m.rank) === GUILD_RANK_MASTER ? seatTitleOf(holds, season) : null;
  return { glyphs: seatGlyphsOf(holds), title: t?.title ?? null, ts: t?.ts ?? null };
}
/** SEAT1c: the seat titles an ACCOUNT may choose to wear - those its guildmaster characters' guilds' Charters give. The
 *  wardrobe offers them; a token wears one only for the guildmaster character it is minted for. CROWN1 part two: and the
 *  Royal Tourney's champion, which is the account's own (worn whatever character it brings). */
export async function seatTitlesOf(db, playerId) {
  const { results = [] } = await db.prepare(`SELECT h.key, h.tier, h.region FROM town_seat_holds h
    JOIN guild_members m ON m.guild_id = h.guild_id WHERE m.player = ? AND m.rank = ?`).bind(playerId, GUILD_RANK_MASTER).all();
  const out = new Set(results.map((h) => (h.tier === 'crown' ? 'protector' : 'warden')));
  // CROWN1 part two: and a Royal Tourney's champion, the account's own for good; SEASON1: and a Season's crowned and keeper
  const { results: kept = [] } = await db.prepare('SELECT DISTINCT title FROM town_seat_titles WHERE account = ?').bind(playerId).all();
  for (const k of kept) out.add(k.title);
  return ['warden', 'protector', 'crowned', 'keeper', 'champion'].filter((t) => out.has(t));
}
