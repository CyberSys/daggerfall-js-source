// @ts-check
// ═══════════════════════════════════════════════════════════════════
// SEAT2b (2026-10-01, Mac: "Finish the seats"; "We need to do a comprehensive audit on everything and finish the not
// done"): A SEAT'S FORTIFICATIONS AS THE SERVICE KEEPS THEM (bible/11-Multiplayer/Seats-Arc.md 7.5; the law
// src/net/fortLaw.js; migration 0060).
//
// THE SEAT'S, NOT THE GUILD'S: a work's tier stands at the seat whoever holds it. A PROJECT is one tier of one work,
// begun by the holder's Guildmaster or an Officer at the board - its Marks burnt from the treasury then - and supplied
// from the seat's STOCKPILE (the Levy's tenth, and the seat writs SEAT2b delivers): each read and each delivery moves
// what the stockpile holds of the project's needs into it, the works in the table's order. The day its last need is
// met it is "delivered", and it stands 2, 4 or 7 days later (7.5). A Builder's project (Masonry 50, its starter's)
// asks nine tenths of the stone.
//
// THE DROPS: a capture takes every work a tier down (fortLaw.js fortsAfterCapture - the Walls kept once a Season where
// a Fortifier stood on the losing side's roster), and a building project falls with the Charter, what it held going
// back to the stockpile (the seat's) and its Marks spent; a Season's end takes every work a tier down; Season 0's end
// wipes them (seatTurning.js SEASON_ZERO_WIPED). A Charter relinquished keeps them (16).
//
// DECIDED: one project a work at a time, any number of works at once; a Harbour is raised where the funding client
// names its town a port (DFU's own port flag, read by the client - bounded: a lie spends the liar's own treasury on a
// harbour nothing docks at).
// ═══════════════════════════════════════════════════════════════════
import { accountKind, overRate } from './accounts.js';
import { guildActorOf } from './guilds.js';
import { seatsOpenFor, confirmedSeats } from './townSeats.js';
import { mustChange } from './realm.js';
import { utcDay } from '../../src/net/marksLaw.js';
import { seatWeekOf, seatKeyOk, SEAT_LEVER_RANKS, SEAT_EDICTS_HOUR } from '../../src/net/townSeatLaw.js';
import { FORT_WORKS, fortWork, fortMaxTier, fortMayRaise, fortNeeds, fortStandsAt, fortWanting, marketHallListings, marketHallTitheCap, campSpent } from '../../src/net/fortLaw.js';
import { MARKET_LISTINGS_MAX } from '../../src/net/marketLaw.js';
import { TITHE_CAP } from '../../src/net/townSeatLaw.js';
import { specsAt, isBuilder as isBuilderSpec, isFortifier as isFortifierSpec } from '../../src/net/professionLaw.js';
import { siegeWorksPass } from '../../src/net/fortLaw.js';   // SEAT2b part two: a battle's works on its pass

const weekAt = (nowS) => seatWeekOf(nowS * 1000);
const ORDER = new Map(FORT_WORKS.map((w, i) => [w.id, i]));
const byOrder = (a, b) => (ORDER.get(a.work) ?? 99) - (ORDER.get(b.work) ?? 99);
/** A Chronicle row at `key` this week. */
const historyRow = (db, key, nowS, kind, data) => db.prepare('INSERT INTO town_seat_history (key, week, kind, data, at) VALUES (?, ?, ?, ?, ?)')
  .bind(key, weekAt(nowS), kind, JSON.stringify(data), nowS);

/** A seat's works' rows, `[{ work, tier, building, builder, wright, standsAt, guild }]`, in the table's order (SEAT2b part two:
 *  `wright` - a Siegewright began the project). */
async function rowsOf(db, key) {
  const { results = [] } = await db.prepare('SELECT work, tier, building, builder, wright, stands_at, guild_id FROM town_seat_forts WHERE key = ?').bind(key).all();
  return results.map((r) => ({ work: r.work, tier: Number(r.tier), building: r.building == null ? null : Number(r.building), builder: Number(r.builder) === 1,
    wright: Number(r.wright) === 1, standsAt: r.stands_at == null ? null : Number(r.stands_at), guild: r.guild_id ?? null })).filter((r) => fortWork(r.work)).sort(byOrder);
}
/**
 * SEAT2b part two: THE WORKS AS THEY STAND AT `atS`, for many seats and without a write - each project whose day has come
 * counted at its tier (the lazy rise, riseDue, writes at the reader's clock; the Turning and the seats' list must not):
 * `Map<key, { [work]: tier }>`, tiers above nought alone.
 */
export async function effectiveTiersOf(db, keys, atS) {
  const out = new Map();
  if (!keys?.length) return out;
  const { results = [] } = await db.prepare(`SELECT key, work, CASE WHEN building IS NOT NULL AND stands_at IS NOT NULL AND stands_at <= ? THEN building ELSE tier END AS t
    FROM town_seat_forts WHERE key IN (${keys.map(() => '?').join(', ')})`).bind(atS, ...keys).all();
  for (const r of results) {
    if (!fortWork(r.work) || !(Number(r.t) > 0)) continue;
    let m = out.get(Number(r.key));
    if (!m) out.set(Number(r.key), m = {});
    m[r.work] = Number(r.t);
  }
  return out;
}
/** What each of a seat's projects holds: `Map<work, Map<material, qty>>`. */
async function heldOf(db, key) {
  const { results = [] } = await db.prepare('SELECT work, material, qty FROM town_seat_fort_held WHERE key = ?').bind(key).all();
  const out = new Map();
  for (const r of results) { let m = out.get(r.work); if (!m) out.set(r.work, m = new Map()); m.set(r.material, Number(r.qty)); }
  return out;
}

/** THE PROJECTS DUE RAISED: each whose day has come stands at its tier, its held materials spent (they are the work now). */
async function riseDue(db, key, nowS) {
  for (const r of await rowsOf(db, key)) {
    if (r.building == null || r.standsAt == null || r.standsAt > nowS) continue;
    try {
      await db.batch([
        db.prepare('UPDATE town_seat_forts SET tier = building, building = NULL, stands_at = NULL, builder = 0, wright = 0 WHERE key = ? AND work = ? AND building = ? AND stands_at <= ?')
          .bind(key, r.work, r.building, nowS),
        mustChange(db),
        db.prepare('DELETE FROM town_seat_fort_held WHERE key = ? AND work = ?').bind(key, r.work),
        historyRow(db, key, nowS, 'fort-raised', { work: r.work, tier: r.building }),
      ]);
    } catch { /* another reader raised it first */ }
  }
}

/**
 * THE SUPPLY: what the stockpile holds of each building project's needs moved into it, the works in the table's order -
 * and a project whose needs are met given its day (fortLaw.js fortStandsAt). Each move asks the stockpile's units in
 * its own statement (mustChange), so two readers racing move a unit once; the loser's batch rolls back whole.
 */
export async function supplyForts(db, key, nowS) {
  const rows = (await rowsOf(db, key)).filter((r) => r.building != null && r.standsAt == null);
  if (!rows.length) return;
  const { results: stock = [] } = await db.prepare('SELECT material, qty FROM town_seat_stockpile WHERE key = ? AND qty > 0').bind(key).all();
  const left = new Map(stock.map((s) => [s.material, Number(s.qty)]));
  const held = await heldOf(db, key);
  const stmts = [];
  for (const r of rows) {
    const needs = fortNeeds(r.work, r.building, { builder: r.builder })?.needs ?? [];
    const has = new Map(held.get(r.work) ?? []);
    for (const [k, want] of fortWanting(needs, has)) {
      const take = Math.min(want, left.get(k) ?? 0);
      if (take <= 0) continue;
      left.set(k, (left.get(k) ?? 0) - take);
      has.set(k, (has.get(k) ?? 0) + take);
      stmts.push(
        db.prepare('UPDATE town_seat_stockpile SET qty = qty - ? WHERE key = ? AND material = ? AND qty >= ?').bind(take, key, k, take), mustChange(db),
        db.prepare(`INSERT INTO town_seat_fort_held (key, work, material, qty) VALUES (?, ?, ?, ?)
          ON CONFLICT (key, work, material) DO UPDATE SET qty = town_seat_fort_held.qty + excluded.qty`).bind(key, r.work, k, take),
      );
    }
    if (fortWanting(needs, has).every(([, n]) => n === 0)) {
      stmts.push(db.prepare('UPDATE town_seat_forts SET stands_at = ? WHERE key = ? AND work = ? AND building = ? AND stands_at IS NULL')
        .bind(fortStandsAt(nowS, r.building, { siegewright: r.wright }), key, r.work, r.building));   // SEAT2b part two: a Siegewright's a day sooner
    }
  }
  if (!stmts.length) return;
  try { await db.batch(stmts); } catch { /* a racing reader moved them; the next read moves what is left */ }
}

/**
 * A SEAT'S WORKS AS THE BOARD SHOWS THEM - the due raised and the stockpile's units moved in first: `{ [work]: { tier,
 * building, standsAt, needs, held } }` for every work with a row (`needs` the building tier's, as `[[material, units]]`;
 * `held` what the project holds), and the stockpile itself (`stockpile`: `[[material, qty]]`).
 */
export async function fortsOf(db, key, nowS) {
  await riseDue(db, key, nowS);
  await supplyForts(db, key, nowS);
  await riseDue(db, key, nowS);   // a project met with nothing to wait (none today: every tier waits days) - kept honest
  const held = await heldOf(db, key);
  const works = {};
  for (const r of await rowsOf(db, key)) {
    const needs = r.building == null ? null : fortNeeds(r.work, r.building, { builder: r.builder })?.needs ?? null;
    works[r.work] = { tier: r.tier, building: r.building, standsAt: r.standsAt, needs, held: needs ? needs.map(([k]) => [k, held.get(r.work)?.get(k) ?? 0]) : null };
  }
  const { results: stock = [] } = await db.prepare('SELECT material, qty FROM town_seat_stockpile WHERE key = ? AND qty > 0 ORDER BY material').bind(key).all();
  return { works, stockpile: stock.map((s) => [s.material, Number(s.qty)]) };
}
/** A seat's standing tiers alone - `{ [work]: tier }` - the effects' input (the pass, the Tithe's cap, the Shrine). */
export async function fortTiersOf(db, key, nowS) {
  await riseDue(db, key, nowS);
  return Object.fromEntries((await rowsOf(db, key)).map((r) => [r.work, r.tier]));
}

/** A character's specialisations in `profession` now (professionLaw.js specsAt over its track row). */
async function specsOf(db, player, character, profession, nowS) {
  const row = await db.prepare('SELECT spec50, spec100, respec_rank, respec_to, respec_at FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?')
    .bind(player, character, profession).first();
  return specsAt(row ? { ...row, respec_rank: row.respec_rank == null ? null : Number(row.respec_rank), respec_at: row.respec_at == null ? null : Number(row.respec_at) } : null, nowS);
}
/** Whether `character` of `player` is a Builder (Masonry 50) now. */
const isBuilder = async (db, player, character, nowS) => isBuilderSpec(await specsOf(db, player, character, 'masonry', nowS));   // PROF11's law
/** SEAT2b part two: whether `character` of `player` stands as a Siegewright (Carpentry 100) now. */
const isSiegewright = async (db, player, character, nowS) => (await specsOf(db, player, character, 'carpentry', nowS))[100] === 'siegewright';

/**
 * BEGIN A PROJECT (7.5): `{ character, key, work, coastal, rid }` - the holder's Guildmaster or an Officer, the next tier
 * of a work the seat may raise and that is not already building; its Marks burnt from the treasury in the same batch
 * as the row (`fort`, once a `rid`), and the stockpile's units moved in at once. Answers `{ ok, work, tier, needs,
 * forts }` or `{ error }`. SEAT2b part two: `coastal` - the funding client's word that the town touches the sea (fortLaw.js
 * harbourPort's DECIDED, correcting part one's port flag; an older client's `port` read as it); a Siegewright's project
 * stands a day sooner (`wright`, kept with it as the Builder's stone is).
 * @param {{db: any, nowS: number}} ctx
 */
export async function fundFort(ctx, player, env, { character, key, work, coastal = undefined, port = false, rid } = {}) {
  const { db, nowS } = ctx;
  if (accountKind(player) !== 'linked') return { error: 'seats-need-account' };
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  if (typeof rid !== 'string' || !/^[A-Za-z0-9_-]{8,40}$/.test(rid)) return { error: 'bad-rid' };
  const w = fortWork(work);
  if (!w) return { error: 'bad-work' };
  const a = await guildActorOf(db, player, character);
  if ('error' in a) return a;
  if (!SEAT_LEVER_RANKS.includes(Number(a.me.rank))) return { error: 'guild-rank' };
  const hold = await db.prepare('SELECT key, guild_id, tier FROM town_seat_holds WHERE key = ?').bind(key).first();
  if (!hold || hold.guild_id !== a.me.guild_id) return { error: 'seat-not-held' };
  const prior = await db.prepare("SELECT 1 FROM marks_ledger WHERE actor = ? AND rid = ? AND kind = 'fort'").bind(player.id, `${rid}:fort`).first();
  if (prior) return { ok: true, repeat: true, work, forts: await fortsOf(db, key, nowS) };
  const tiers = await fortTiersOf(db, key, nowS);
  const rows = await rowsOf(db, key);
  const cur = rows.find((r) => r.work === work);
  if (!fortMayRaise(work, { tier: hold.tier, coastal: (coastal ?? port) === true, walls: tiers.walls ?? 0 })) return { error: 'fort-not-here' };
  if (cur?.building != null) return { error: 'fort-building' };
  const t = (cur?.tier ?? 0) + 1;
  if (t > fortMaxTier(work)) return { error: 'fort-max' };
  const builder = await isBuilder(db, player.id, character, nowS);
  const wright = await isSiegewright(db, player.id, character, nowS);   // SEAT2b part two
  const { marks, needs } = /** @type {{ marks: number, needs: any[] }} */ (fortNeeds(work, t, { builder }));
  // the rate, once the ask is one the board would take - its own bucket, beside the levers' (Appendix B's five an hour)
  if (await overRate(ctx, `seat-fort:${player.id}`, SEAT_EDICTS_HOUR, 3600)) return { error: 'seats-rate' };
  const g = hold.guild_id;
  const guild = await db.prepare('SELECT name, tag FROM guilds WHERE id = ?').bind(g).first();
  try {
    await db.batch([
      // the treasury's Marks, burnt - the rank and the Charter still the guild's, asked in the write
      db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
        SELECT 'guild', ?1, 'burn', NULL, 'fort', ?2, ?3, ?4, ?5, ?6, ?7
        WHERE COALESCE((SELECT balance FROM guild_marks WHERE guild_id = ?1), 0) >= ?2
          AND EXISTS (SELECT 1 FROM town_seat_holds WHERE key = ?8 AND guild_id = ?1)
          AND EXISTS (SELECT 1 FROM guild_members WHERE rowid = ?9 AND guild_id = ?1 AND rank IN (${SEAT_LEVER_RANKS.join(', ')}))`)
        .bind(g, marks, utcDay(nowS), nowS, player.id, w.name, `${rid}:fort`, key, Number(a.me.rid)),
      mustChange(db),
      // the project: the next tier, no other building at this work
      db.prepare(`INSERT INTO town_seat_forts (key, work, tier, building, guild_id, builder, wright, stands_at, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?8, NULL, ?7)
        ON CONFLICT (key, work) DO UPDATE SET building = excluded.building, guild_id = excluded.guild_id, builder = excluded.builder, wright = excluded.wright, stands_at = NULL, at = excluded.at
        WHERE town_seat_forts.building IS NULL AND town_seat_forts.tier = ?3`).bind(key, work, t - 1, t, g, builder ? 1 : 0, nowS, wright ? 1 : 0),
      mustChange(db),
      historyRow(db, key, nowS, 'fort-begun', { guild: { name: guild?.name ?? '', tag: guild?.tag ?? '' }, work, tier: t }),
    ]);
  } catch {
    const has = Number((await db.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').bind(g).first())?.balance ?? 0);
    if (has < marks) return { error: 'seat-treasury' };
    return { error: 'fort-building' };
  }
  await supplyForts(db, key, nowS);
  return { ok: true, work, tier: t, marks, needs, builder, wright, forts: await fortsOf(db, key, nowS) };
}

/** THE BOARD'S READ (`/v1/seats/forts`): `{ ok, key, works, stockpile }` - anyone the seats are open to. */
export async function readForts({ db, nowS }, player, env, { key } = {}) {
  if (!seatsOpenFor(player, env)) return { error: 'seats-closed' };
  if (!seatKeyOk(key)) return { error: 'bad-seat' };
  return { ok: true, key, ...(await fortsOf(db, key, nowS)) };
}

// ─── THE DROPS (7.5, 6.8, 9.1) ───────────────────────────────────────

/**
 * THE CAPTURE'S STATEMENTS, for the result's own batch (seatSiege.js applyResult): every work at `key` a tier down - the
 * Walls kept where `fortifier` (a Fortifier saved them this Season) - every building project fallen, what it held back
 * to the stockpile.
 */
export function fortsCapturedStatements(db, key, { fortifier = false } = {}) {
  return [
    db.prepare(`INSERT INTO town_seat_stockpile (key, material, qty) SELECT key, material, qty FROM town_seat_fort_held WHERE key = ? AND qty > 0
      ON CONFLICT (key, material) DO UPDATE SET qty = town_seat_stockpile.qty + excluded.qty`).bind(key),
    db.prepare('DELETE FROM town_seat_fort_held WHERE key = ?').bind(key),
    db.prepare(`UPDATE town_seat_forts SET tier = CASE WHEN ?2 = 1 AND work = 'walls' THEN tier ELSE MAX(0, tier - 1) END,
      building = NULL, stands_at = NULL, builder = 0, wright = 0, guild_id = NULL WHERE key = ?1`).bind(key, fortifier ? 1 : 0),
  ];
}
/**
 * THE FORTIFIER'S SAVE AT A CAPTURE (Masonry 100, Professions-Arc 3.3: "once a Season a seat's Walls skip their drop on
 * capture") - DECIDED: a Fortifier who stood on the losing side's roster of that siege (the fortifications are the seat's,
 * so the save is a defender's craft at the walls it defended), once a Season a seat (`town_seat_fortifier`, the save's
 * week: none while a save stands since `seasonWeek`, the Season's first week - seasonFloor, any eight weeks while no
 * Season is counted), and only Walls that stand. Answers the account whose save it is, or null.
 */
export async function fortifierAt(db, week, key, nowS, seasonWeek) {
  const walls = Number((await db.prepare("SELECT tier FROM town_seat_forts WHERE key = ? AND work = 'walls'").bind(key).first())?.tier ?? 0);
  if (walls <= 0) return null;
  if (await db.prepare('SELECT 1 FROM town_seat_fortifier WHERE key = ? AND week >= ?').bind(key, seasonWeek).first()) return null;
  const { results = [] } = await db.prepare(`SELECT r.account, t.spec50, t.spec100, t.respec_rank, t.respec_to, t.respec_at FROM town_seat_rosters r
    JOIN prof_tracks t ON t.player = r.account AND t.char_id = r.char_id AND t.profession = 'masonry'
    WHERE r.week = ? AND r.key = ? AND r.side = 'defend' ORDER BY r.at, r.account`).bind(week, key).all();
  for (const row of results) {
    const specs = specsAt({ ...row, respec_rank: row.respec_rank == null ? null : Number(row.respec_rank), respec_at: row.respec_at == null ? null : Number(row.respec_at) }, nowS);
    if (isFortifierSpec(specs)) return row.account;
  }
  return null;
}
/**
 * SEAT2b part two: A SIEGEWRIGHT ON THE ATTACKING ROSTER (Carpentry 100, Professions-Arc 3.3: "Rams +50% vitality") -
 * DECIDED: the Rams are the attackers' works, so a Siegewright who signed the attacking side of the battle gives them its
 * half again (the Fortifier's mirror on the defending roster).
 */
export async function siegewrightAt(db, week, key, nowS) {
  const { results = [] } = await db.prepare(`SELECT t.spec50, t.spec100, t.respec_rank, t.respec_to, t.respec_at FROM town_seat_rosters r
    JOIN prof_tracks t ON t.player = r.account AND t.char_id = r.char_id AND t.profession = 'carpentry'
    WHERE r.week = ? AND r.key = ? AND r.side = 'attack'`).bind(week, key).all();
  return results.some((row) => specsAt({ ...row, respec_rank: row.respec_rank == null ? null : Number(row.respec_rank), respec_at: row.respec_at == null ? null : Number(row.respec_at) }, nowS)[100] === 'siegewright');
}
/**
 * SEAT2b part two: A BATTLE'S WORKS, FROZEN (the pass's `sx` - fortLaw.js siegeWorksPass): written once, at the battle's
 * first pass (`town_seat_battles.works`, `WHERE works IS NULL`), from the seat's works as they stand then, the Ram Kits the
 * Siege Camp sent and a Siegewright on the attacking roster (the rosters closed as the door opened) - so every pass of the
 * battle carries the same works, and the room, which refuses a pass that disagrees with the first, stays whole. Answers the
 * frozen `[walls, gate, guards, rams, ramHp]`.
 */
export async function battleWorks(db, b, nowS) {
  if (b.works != null) return JSON.parse(String(b.works));
  const forts = (await effectiveTiersOf(db, [b.key], nowS)).get(b.key) ?? {};
  const sx = siegeWorksPass({ kind: b.kind, tier: b.tier, forts, rams: Number(b.rams ?? 0), siegewright: b.kind === 'siege' && await siegewrightAt(db, b.week, b.key, nowS) });
  await db.prepare('UPDATE town_seat_battles SET works = ? WHERE week = ? AND key = ? AND works IS NULL').bind(JSON.stringify(sx), b.week, b.key).run();
  const kept = (await db.prepare('SELECT works FROM town_seat_battles WHERE week = ? AND key = ?').bind(b.week, b.key).first())?.works;
  return kept != null ? JSON.parse(String(kept)) : sx;
}
/** The capture's statements with the Fortifier's save written beside them (its Season's one), and the Chronicle's word. */
export function fortsCaptureWithSave(db, key, { week, nowS, fortifier = null, history }) {
  return [
    ...fortsCapturedStatements(db, key, { fortifier: !!fortifier }),
    ...(fortifier ? [
      db.prepare('INSERT OR IGNORE INTO town_seat_fortifier (week, key, account, at) VALUES (?, ?, ?, ?)').bind(week, key, fortifier, nowS),
      history('walls-kept', {}),
    ] : []),
  ];
}
/**
 * THE SIEGE CAMPS AT THE TURNING (4.2: "its siege works (a Ram Kit) go to the siege it won, and everything else is burnt;
 * a camp that won no Right of Siege is burnt whole"): the week's camps read, each guild's Ram Kits (fortLaw.js campSpent)
 * set on the battle the Turning placed for `next` where its Right was won and a Gatehouse stands (`tierOf` the seat's
 * tier), and every camp of the week emptied.
 */
export async function campsSpent(db, week, next, rights, tierOf) {
  const { results = [] } = await db.prepare('SELECT key, guild_id, material, qty FROM town_seat_camps WHERE week = ? AND qty > 0').bind(week).all();
  if (!results.length) return [];
  const camps = new Map();
  for (const r of results) {
    const k = `${r.key}\n${r.guild_id}`;
    if (!camps.has(k)) camps.set(k, { key: Number(r.key), guild: r.guild_id, items: [] });
    camps.get(k).items.push([r.material, Number(r.qty)]);
  }
  const out = [];
  for (const c of camps.values()) {
    const won = (rights ?? []).some((r) => r.key === c.key && r.guild === c.guild);
    const gate = Number((await db.prepare("SELECT tier FROM town_seat_forts WHERE key = ? AND work = 'gatehouse'").bind(c.key).first())?.tier ?? 0);
    const { rams } = campSpent(c.items, { won, gated: tierOf(c.key) === 'crown' || gate >= 1 });
    if (rams > 0) out.push(db.prepare('UPDATE town_seat_battles SET rams = rams + ? WHERE week = ? AND key = ? AND attacker = ?').bind(rams, next, c.key, c.guild));
  }
  out.push(db.prepare('DELETE FROM town_seat_camps WHERE week = ?').bind(week));
  return out;
}
/** A Season's end (9.1): every seat's works a tier down; a building project keeps building. */
export const fortsSeasonStatements = (db) => [db.prepare('UPDATE town_seat_forts SET tier = MAX(0, tier - 1) WHERE tier > 0')];

// ─── THE MARKET HALL (7.5: "the town's boards list 25% more; the Tithe's cap +1%") ───

/** A seat's Market Hall tier, or nought. */
const marketTierOf = async (db, key, nowS) => (await fortTiersOf(db, key, nowS)).market ?? 0;
/**
 * THE OPEN LISTINGS an account may hold, listing at the board at map pixel `board` (`[x, y]`, or null): the market's
 * MARKET_LISTINGS_MAX, a quarter more a tier where the board stands in a seat town with a Market Hall. DECIDED: the
 * board's town, not its bailiwick - "the town's boards".
 */
export async function listingsCapAt(db, nowS, board) {
  if (!Array.isArray(board)) return MARKET_LISTINGS_MAX;
  if (!(await db.prepare("SELECT 1 FROM town_seat_forts WHERE work = 'market' AND tier > 0 LIMIT 1").first())) return MARKET_LISTINGS_MAX;
  const seat = [...(await confirmedSeats(db, nowS)).values()].find((x) => x.pixel?.[0] === board[0] && x.pixel?.[1] === board[1]);
  return seat ? marketHallListings(MARKET_LISTINGS_MAX, await marketTierOf(db, seat.key, nowS)) : MARKET_LISTINGS_MAX;
}
/** A held seat's Tithe cap: its tier's, a point more a Market Hall tier. */
export const titheCapAt = async (db, key, tier, nowS) => marketHallTitheCap(TITHE_CAP[tier] ?? 0, await marketTierOf(db, key, nowS));
