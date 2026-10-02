// @ts-check
// ═══════════════════════════════════════════════════════════════════
// ARENA4 - THE ARENA'S RECORDS, ONLINE.
//
// Mac (2026-10-02): "join a team (red and blue) and climb esclating
// tiers of opponents, or choose to matchmake for a real opponent ...
// Joining a team comes with it's own enhanced UI where you can view your
// ranking and even player leaderboards ... Being a top rank PvE fighter
// comes with it's own title. Being the #1 pvp arena player comes with
// it's own temporary title/glyph". Design: bible/11-Multiplayer/Arena.md
// "7. Online" and "6. Titles and the laurel".
//
// ═══ A ROW IS A RECEIPT ════════════════════════════════════════════
//
// Every result here was refereed by the relay and SIGNED by it
// (src/net/arenaReceipt.js). The claim verifies the signature with the
// relay's public half (the gate's own key, GATE_PUBLIC_KEY) and writes
// ONE row keyed by the bout's id - so a receipt counts once whoever
// carries it, and a bout between two players is one row whichever of
// them claims it first.
//
// ═══ THE CLIMB IS IN ORDER, IN THE WRITE ═══════════════════════════
//
// A ladder WIN is written only where it is the account's next bout:
// the won rows are only ever written in order, so their count IS the
// next bout's key (src/net/arenaLaw.js ladderKey), and the INSERT asks
// exactly that in its own WHERE. Two claims at once cannot both step,
// and no receipt for the Grand Champion lands on an account that has not
// won the thirty-nine bouts under it. A loss is kept whatever its order
// (the record counts it; the climb never reads it).
//
// ═══ EVERYTHING ELSE IS COUNTED ════════════════════════════════════
//
// The ladder an account stands on, a season's rating board, the
// banners' points and the laurel are COUNTED from the rows on each read
// - nothing is a total another row could disagree with. The titles they
// give are derived at the token's mint (titles.js, `arena` on the row):
// `grandchampion` while a Grand Champion row stands, `arenachampion` and
// the laurel while the account is the season's #1 - so the laurel passes
// to whoever takes the top and lapses by itself, with no cron.
// ═══════════════════════════════════════════════════════════════════
import { verifyArenaReceipt } from '../../src/net/arenaReceipt.js';
import {
  arenaSeasonOf, arenaSeasonEndsS, arenaSeasonDay, eloAfter, ARENA_ELO_START, arenaLadderOf, ladderKey, ARENA_BANNERS, ARENA_TEAM_POINTS,
  ARENA_TIERS, ARENA_TIER_BOUTS, ARENA_PAIR_DAY_MAX, ARENA_CHAMPION_MIN_BOUTS, arenaRatingOk,
} from '../../src/net/arenaLaw.js';
import { displayName } from './accounts.js';
import { titleWorn, glyphsOf } from './titles.js';

/** The service's doors that read a badge (a token's mint, the account's wardrobe, an equip): the arena's honours ride the
 *  row there and nowhere else (two reads - one an index lookup, one kept a minute). */
export const ARENA_HONOUR_PATHS = new Set(['/v1/auth/token', '/v1/account', '/v1/account/title', '/v1/account/aura', '/v1/account/insignia', '/v1/patreon/unlink']);
/** A board's rows before the caller's own is pinned under them. */
export const ARENA_BOARD_TOP = 10;
/** The Hall of Champions' names a board carries. */
export const ARENA_HALL_MAX = 20;
/** How long the season's #1 (the laurel) is kept by a Worker before it is counted again, seconds - a token lives five
 *  minutes, so a laurel is at most six behind the board. */
export const ARENA_CHAMPION_CACHE_S = 60;
const GRAND_TIER = ARENA_TIERS - 1;

/** The points a ladder win gives its banner: a bout 1, a tier's champion 3, the Grand Champion 10. */
const pvePoints = (tier, step) => (step === ARENA_TIER_BOUTS ? (tier === GRAND_TIER ? ARENA_TEAM_POINTS.grand : ARENA_TEAM_POINTS.champion) : ARENA_TEAM_POINTS.bout);
/** The SQL of the same, over a row's `tier` and `step`. */
const PVE_POINTS_SQL = `CASE WHEN step = ${ARENA_TIER_BOUTS} AND tier = ${GRAND_TIER} THEN ${ARENA_TEAM_POINTS.grand} WHEN step = ${ARENA_TIER_BOUTS} THEN ${ARENA_TEAM_POINTS.champion} ELSE ${ARENA_TEAM_POINTS.bout} END`;

// ── THE ROWS, READ ───────────────────────────────────────────────────────────────────────────
/** The account's ladder bouts won, and its ladder record (wins, losses, by how). */
export async function arenaPveOf({ db }, playerId) {
  const won = (await db.prepare('SELECT tier, step AS bout FROM arena_pve WHERE player = ?1 AND won = 1 ORDER BY tier, step').bind(playerId).all()).results ?? [];
  const r = await db.prepare(`SELECT SUM(won) AS wins, SUM(1 - won) AS losses, SUM(CASE WHEN won = 0 AND how = 'yield' THEN 1 ELSE 0 END) AS yields,
      SUM(CASE WHEN won = 0 AND how = 'fall' THEN 1 ELSE 0 END) AS falls, SUM(CASE WHEN won = 0 AND how = 'ringout' THEN 1 ELSE 0 END) AS ringouts
    FROM arena_pve WHERE player = ?1`).bind(playerId).first();
  const n = (v) => Number(v ?? 0) || 0;
  return { won, record: { wins: n(r?.wins), losses: n(r?.losses), yields: n(r?.yields), falls: n(r?.falls), ringouts: n(r?.ringouts) } };
}
/** The account's ladder, in the save ladder's own shape (src/net/arenaLaw.js arenaLadderOf). */
export async function arenaLadderOfAccount(ctx, playerId) {
  const { won, record } = await arenaPveOf(ctx, playerId);
  return arenaLadderOf(won, record);
}

/** One side's rows of a season's rated bouts between players, as a CTE - an account per row, its rating after, and
 *  whether it won, lost or drew. */
const SIDES_SQL = `sides AS (
    SELECT a AS p, ra1 AS r, at, rowid AS k, CASE result WHEN 0 THEN 1 ELSE 0 END AS w, CASE result WHEN 1 THEN 1 ELSE 0 END AS l, CASE result WHEN 2 THEN 1 ELSE 0 END AS d
      FROM arena_pvp WHERE season = ?1 AND rated = 1 AND a IS NOT NULL
    UNION ALL
    SELECT b, rb1, at, rowid, CASE result WHEN 1 THEN 1 ELSE 0 END, CASE result WHEN 0 THEN 1 ELSE 0 END, CASE result WHEN 2 THEN 1 ELSE 0 END
      FROM arena_pvp WHERE season = ?1 AND rated = 1 AND b IS NOT NULL)`;
/** The season's board: each account's rating after its last rated bout, its wins, losses and draws, ranked - the rating
 *  first, then wins, then fewer bouts, then the one who got there first. */
const BOARD_SQL = `WITH ${SIDES_SQL},
  last AS (SELECT p, r, at, ROW_NUMBER() OVER (PARTITION BY p ORDER BY at DESC, k DESC) AS rn FROM sides),
  tally AS (SELECT p, SUM(w) AS w, SUM(l) AS l, SUM(d) AS d, COUNT(*) AS n FROM sides GROUP BY p)
  SELECT last.p AS player, last.r AS rating, last.at AS at, tally.w AS wins, tally.l AS losses, tally.d AS draws, tally.n AS bouts
    FROM last JOIN tally ON tally.p = last.p WHERE last.rn = 1
    ORDER BY last.r DESC, tally.w DESC, tally.n ASC, last.at ASC, last.p ASC`;

/** An account's rating in a season and its tally - the start for one that has fought nobody. */
export async function arenaRatingOf({ db }, playerId, season) {
  const last = await db.prepare(`SELECT CASE WHEN a = ?2 THEN ra1 ELSE rb1 END AS r FROM arena_pvp
     WHERE season = ?1 AND rated = 1 AND (a = ?2 OR b = ?2) ORDER BY at DESC, rowid DESC LIMIT 1`).bind(season, playerId).first();
  const t = await db.prepare(`SELECT SUM(CASE WHEN (a = ?2 AND result = 0) OR (b = ?2 AND result = 1) THEN 1 ELSE 0 END) AS w,
       SUM(CASE WHEN (a = ?2 AND result = 1) OR (b = ?2 AND result = 0) THEN 1 ELSE 0 END) AS l,
       SUM(CASE WHEN result = 2 THEN 1 ELSE 0 END) AS d, COUNT(*) AS n
     FROM arena_pvp WHERE season = ?1 AND rated = 1 AND (a = ?2 OR b = ?2)`).bind(season, playerId).first();
  const n = (v) => Number(v ?? 0) || 0;
  return { rating: last ? arenaRatingOk(Number(last.r)) : ARENA_ELO_START, wins: n(t?.w), losses: n(t?.l), draws: n(t?.d), bouts: n(t?.n) };
}

/** The season's #1 who may wear the laurel - ARENA_CHAMPION_MIN_BOUTS rated bouts at least - or null. */
export async function arenaChampionOf({ db }, season) {
  const rows = (await db.prepare(`${BOARD_SQL} LIMIT 25`).bind(season).all()).results ?? [];
  const top = rows.find((r) => Number(r.bouts) >= ARENA_CHAMPION_MIN_BOUTS) ?? null;
  // the #1 is the board's FIRST row; one short of the bouts holds the top and nobody wears the laurel over them
  return top && top === rows[0] ? top.player : null;
}
/** One Worker's word of the season's #1, kept ARENA_CHAMPION_CACHE_S. */
let _champ = { season: 0, at: -Infinity, id: null };
/** Tests: the kept #1 forgotten. */
export function _resetArenaCache() { _champ = { season: 0, at: -Infinity, id: null }; }
async function championNow(ctx, nowS) {
  const season = arenaSeasonOf(nowS);
  if (_champ.season === season && nowS - _champ.at < ARENA_CHAMPION_CACHE_S) return _champ.id;
  const id = await arenaChampionOf(ctx, season);
  _champ = { season, at: nowS, id };
  return id;
}

/**
 * THE ARENA'S HONOURS OF AN ACCOUNT, as the token's mint reads them: `grand` - a Grand Champion row stands (a title for
 * good); `champion` - the season's #1 now (the laurel, while it lasts). Never true of a guest (a guest's receipts are
 * not kept).
 * @param {{ db: any }} ctx
 */
export async function arenaHonoursOf(ctx, player, nowS) {
  if (!player?.handle) return { grand: false, champion: false };
  const g = await ctx.db.prepare(`SELECT 1 AS one FROM arena_pve WHERE player = ?1 AND tier = ${GRAND_TIER} AND step = ${ARENA_TIER_BOUTS} AND won = 1 LIMIT 1`).bind(player.id).first();
  const champion = (await championNow(ctx, nowS)) === player.id;
  return { grand: !!g, champion };
}
/** The row with its honours on it - what titles.js reads (`arena`). */
export async function withArenaHonours(ctx, player, nowS) {
  return player ? { ...player, arena: await arenaHonoursOf(ctx, player, nowS) } : player;
}

/** The account's banner row, read. */
export async function arenaMemberOf({ db }, playerId) {
  return db.prepare('SELECT banner, season, left_banner, left_season FROM arena_members WHERE player = ?1').bind(playerId).first();
}

// ── THE CLAIM ────────────────────────────────────────────────────────────────────────────────
/**
 * A BOUT'S RECEIPT, CLAIMED. Verified with the relay's public half; a ladder receipt names the claiming account, a
 * players' one names it as one of its two. Answers `{ recorded: true, ... }`, `{ recorded: false, why }` (`claimed` - this
 * bout is kept already; `guest`; `order` - a win that is not the account's next bout), or `{ error }` - `no-gate-key`,
 * `receipt` (`why` the rung), `not-yours`.
 * @param {{ db: any, nowS: number, subtle: SubtleCrypto }} ctx
 * @param {any} player the session's account
 * @param {unknown} receipt @param {CryptoKey|null} publicKey
 */
export async function claimArena(ctx, player, receipt, publicKey) {
  const { nowS, subtle } = ctx;
  if (!publicKey) return { error: 'no-gate-key' };
  const v = await verifyArenaReceipt(receipt, publicKey, { subtle, nowS });
  if (!v.ok) return { error: 'receipt', why: v.why };
  const c = v.claims;
  if (c.a === 'l' ? c.s !== player.id : !c.f.includes(player.id)) return { error: 'not-yours' };
  if (!player.handle) return { recorded: false, why: 'guest' };
  const season = arenaSeasonOf(c.i);
  const member = await arenaMemberOf(ctx, player.id);
  if (c.a === 'l') return claimLadder(ctx, player, c, season, member?.banner ?? null);
  return claimPlayers(ctx, player, c, season);
}

async function claimLadder(ctx, player, c, season, banner) {
  const { db, nowS } = ctx;
  const won = c.r === 1;
  // THE ORDER IS THE WRITE'S: a win lands only while the account's won rows number exactly its key
  const r = await db.prepare(`INSERT OR IGNORE INTO arena_pve (bout, player, season, tier, step, won, how, banner, at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9
      WHERE ?6 = 0 OR (SELECT COUNT(*) FROM arena_pve WHERE player = ?2 AND won = 1) = ?10`)
    .bind(c.j, player.id, season, c.q, c.u, won ? 1 : 0, c.h, banner, nowS, ladderKey(c.q, c.u)).run();
  const recorded = Number(r?.meta?.changes ?? 0) > 0;
  const ladder = await arenaLadderOfAccount(ctx, player.id);
  if (!recorded) {
    const kept = await db.prepare('SELECT 1 AS one FROM arena_pve WHERE bout = ?1').bind(c.j).first();
    return { recorded: false, why: kept ? 'claimed' : 'order', ladder };
  }
  return {
    recorded: true, kind: 'ladder', won, tier: c.q, bout: c.u, how: c.h, ladder,
    points: won && banner ? pvePoints(c.q, c.u) : 0, banner, grand: won && c.q === GRAND_TIER && c.u === ARENA_TIER_BOUTS,
  };
}

async function claimPlayers(ctx, player, c, season) {
  const { db, nowS } = ctx;
  const [a, b] = c.f;
  const kept = await db.prepare('SELECT * FROM arena_pvp WHERE bout = ?1').bind(c.j).first();
  if (kept) return { recorded: false, why: 'claimed', ...(await pvpAnswer(ctx, player.id, kept)) };
  const rows = (await db.prepare('SELECT id, handle FROM players WHERE id IN (?1, ?2)').bind(a, b).all()).results ?? [];
  const linked = (id) => rows.some((r) => r.id === id && r.handle);
  // both must be registered to be rated (the hall queues no guest; a crafted pair is kept as nothing)
  if (!linked(a) || !linked(b)) return { recorded: false, why: 'guest' };
  const ra = await arenaRatingOf(ctx, a, season), rb = await arenaRatingOf(ctx, b, season);
  // THE PAIR'S DAY: past ARENA_PAIR_DAY_MAX rated bouts between the two in a day, a bout is kept and not counted - two
  // friends trading wins cannot climb the board on each other
  const pair = await db.prepare(`SELECT COUNT(*) AS n FROM arena_pvp WHERE rated = 1 AND at > ?3 - 86400
      AND ((a = ?1 AND b = ?2) OR (a = ?2 AND b = ?1))`).bind(a, b, nowS).first();
  const rated = Number(pair?.n ?? 0) < ARENA_PAIR_DAY_MAX;
  const [na, nb] = rated ? eloAfter(ra.rating, rb.rating, c.r === 0 ? 1 : c.r === 1 ? 0 : 0.5) : [ra.rating, rb.rating];
  const ma = await arenaMemberOf(ctx, a), mb = await arenaMemberOf(ctx, b);
  const ins = await db.prepare(`INSERT OR IGNORE INTO arena_pvp (bout, season, a, b, result, how, ra0, rb0, ra1, rb1, rated, banner_a, banner_b, at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`)
    .bind(c.j, season, a, b, c.r, c.h, ra.rating, rb.rating, na, nb, rated ? 1 : 0, ma?.banner ?? null, mb?.banner ?? null, nowS).run();
  const row = await db.prepare('SELECT * FROM arena_pvp WHERE bout = ?1').bind(c.j).first();
  const recorded = Number(ins?.meta?.changes ?? 0) > 0;
  return recorded ? { recorded: true, kind: 'pvp', ...(await pvpAnswer(ctx, player.id, row)) } : { recorded: false, why: 'claimed', ...(await pvpAnswer(ctx, player.id, row)) };
}
/** What a players' bout's claim answers its claimant: their side, the result for them, their rating before and after,
 *  whether it counted, and their season now. */
async function pvpAnswer(ctx, me, row) {
  const side = row.a === me ? 0 : 1;
  const result = row.result === 2 ? 'draw' : row.result === side ? 'won' : 'lost';
  const before = side === 0 ? row.ra0 : row.rb0, after = side === 0 ? row.ra1 : row.rb1;
  return { bout: row.bout, side, result, how: row.how, rating: after, delta: after - before, rated: row.rated === 1, season: row.season, standing: await arenaRatingOf(ctx, me, row.season) };
}

// ── THE BANNERS ──────────────────────────────────────────────────────────────────────────────
/**
 * JOIN OR QUIT A BANNER - `banner` 'red' or 'blue' to join, null to quit. Free; quitting is at once; the OTHER banner
 * is refused until the next season (`season`), the banner quit takes you back at once (systems/arenaLeague.js's law).
 * A guest joins none (`guest`); a second banner while one is worn is `joined`.
 * @param {{ db: any, nowS: number }} ctx
 */
export async function arenaTeam(ctx, player, banner) {
  const { db, nowS } = ctx;
  if (!player?.handle) return { error: 'guest' };
  if (banner !== null && !ARENA_BANNERS.includes(banner)) return { error: 'bad-banner' };
  const season = arenaSeasonOf(nowS);
  const m = await arenaMemberOf(ctx, player.id);
  if (banner === null) {
    if (!m?.banner) return { ok: true, banner: null, repeat: true };
    await db.prepare('UPDATE arena_members SET banner = NULL, left_banner = ?2, left_season = ?3, season = ?3, at = ?4 WHERE player = ?1').bind(player.id, m.banner, season, nowS).run();
    return { ok: true, banner: null, left: m.banner };
  }
  if (m?.banner === banner) return { ok: true, banner, repeat: true };
  if (m?.banner) return { error: 'joined', banner: m.banner };
  if (m?.left_banner && m.left_banner !== banner && Number(m.left_season) >= season) return { error: 'season', left: m.left_banner };
  await db.prepare(`INSERT INTO arena_members (player, banner, season, left_banner, left_season, at) VALUES (?1, ?2, ?3, NULL, NULL, ?4)
      ON CONFLICT (player) DO UPDATE SET banner = ?2, season = ?3, at = ?4`).bind(player.id, banner, season, nowS).run();
  return { ok: true, banner };
}

/** A season's points by banner, counted from the rows: ladder wins by step, rated players' wins two each. */
export async function arenaStandingsOf({ db }, season) {
  const pve = (await db.prepare(`SELECT banner, SUM(${PVE_POINTS_SQL}) AS pts FROM arena_pve WHERE season = ?1 AND won = 1 AND banner IS NOT NULL GROUP BY banner`).bind(season).all()).results ?? [];
  const pvp = (await db.prepare(`SELECT banner, SUM(n) AS n FROM (
      SELECT banner_a AS banner, COUNT(*) AS n FROM arena_pvp WHERE season = ?1 AND rated = 1 AND result = 0 AND banner_a IS NOT NULL GROUP BY banner_a
      UNION ALL SELECT banner_b, COUNT(*) FROM arena_pvp WHERE season = ?1 AND rated = 1 AND result = 1 AND banner_b IS NOT NULL GROUP BY banner_b) GROUP BY banner`).bind(season).all()).results ?? [];
  const out = { red: 0, blue: 0 };
  for (const r of pve) if (r.banner in out) out[r.banner] += Number(r.pts) || 0;
  for (const r of pvp) if (r.banner in out) out[r.banner] += (Number(r.n) || 0) * ARENA_TEAM_POINTS.pvp;
  return out;
}
/** A banner's fighters this season by the points they gave it, ranked. */
async function bannerRoster({ db }, season, banner) {
  return (await db.prepare(`SELECT p AS player, SUM(pts) AS points, SUM(w) AS wins FROM (
      SELECT player AS p, ${PVE_POINTS_SQL} AS pts, 1 AS w FROM arena_pve WHERE season = ?1 AND won = 1 AND banner = ?2
      UNION ALL SELECT a, ${ARENA_TEAM_POINTS.pvp}, 1 FROM arena_pvp WHERE season = ?1 AND rated = 1 AND result = 0 AND banner_a = ?2
      UNION ALL SELECT b, ${ARENA_TEAM_POINTS.pvp}, 1 FROM arena_pvp WHERE season = ?1 AND rated = 1 AND result = 1 AND banner_b = ?2)
    WHERE p IS NOT NULL GROUP BY p ORDER BY points DESC, wins DESC, p ASC`).bind(season, banner).all()).results ?? [];
}

// ── THE BOARD ────────────────────────────────────────────────────────────────────────────────
/** Players by id, with the badge each wears now (titles.js, with its arena honours). */
async function namesOf({ db }, ids, env, nowS, honours) {
  const want = [...new Set(ids.filter(Boolean))];
  const out = new Map();
  for (let i = 0; i < want.length; i += 50) {
    const part = want.slice(i, i + 50);
    const rows = (await db.prepare(`SELECT * FROM players WHERE id IN (${part.map((_, k) => `?${k + 1}`).join(', ')})`).bind(...part).all()).results ?? [];
    for (const row of rows) {
      const withH = { ...row, arena: { grand: honours.grands.has(row.id), champion: honours.champion === row.id } };
      out.set(row.id, { name: displayName(row), title: titleWorn(withH, env) ?? null, glyphs: glyphsOf(withH, env, nowS) });
    }
  }
  return out;
}
/** The ranked rows cut to the top and the caller's own pinned under them when it is not among them. */
function topWithMe(rows, me, top = ARENA_BOARD_TOP) {
  rows.forEach((r, i) => { r.rank = i + 1; r.you = r.player === me; });
  const shown = rows.slice(0, top);
  const mine = rows.find((r) => r.you) ?? null;
  return { rows: shown, pinned: mine && !shown.includes(mine) ? mine : null, total: rows.length };
}

/**
 * THE BOARD (`/v1/arena/board`): the season (its number, day and end), the PvP board (the season's ratings, its #1 and
 * whether they wear the laurel), the PvE board (the climb, every account's highest bout won), the fastest Grand
 * Champions, the banners (this season's points, last season's winner - the laurel - and the caller's banner's top ten),
 * the Hall of Champions, and the caller's own (`me`: their ladder, rating, banner and points). Each board a top ten and
 * the caller pinned under it.
 * @param {{ db: any, nowS: number }} ctx
 */
export async function arenaBoardOf(ctx, player, env) {
  const { db, nowS } = ctx;
  const season = arenaSeasonOf(nowS);
  const me = player?.id ?? null;
  // the honours every badge on the board reads: the Grand Champions, and the season's #1
  const grandRows = (await db.prepare(`SELECT player, MIN(at) AS at FROM arena_pve WHERE tier = ${GRAND_TIER} AND step = ${ARENA_TIER_BOUTS} AND won = 1 GROUP BY player ORDER BY at DESC`).all()).results ?? [];
  const pvpAll = (await db.prepare(BOARD_SQL).bind(season).all()).results ?? [];
  const top = pvpAll.find((r) => Number(r.bouts) >= ARENA_CHAMPION_MIN_BOUTS) ?? null;
  const champion = top && top === pvpAll[0] ? top.player : null;
  const honours = { grands: new Set(grandRows.map((r) => r.player)), champion };
  // the climb: each account's wins in order (the won rows' count is the bout it reached), its record, its first and last
  const pveAll = (await db.prepare(`SELECT player, SUM(won) AS reached, SUM(1 - won) AS losses, MIN(at) AS first, MAX(CASE WHEN won = 1 THEN at END) AS last
      FROM arena_pve GROUP BY player HAVING SUM(won) > 0 ORDER BY reached DESC, last ASC, player ASC`).all()).results ?? [];
  const fastAll = (await db.prepare(`SELECT g.player AS player, g.at AS at, (SELECT MIN(at) FROM arena_pve f WHERE f.player = g.player) AS first
      FROM (SELECT player, MIN(at) AS at FROM arena_pve WHERE tier = ${GRAND_TIER} AND step = ${ARENA_TIER_BOUTS} AND won = 1 GROUP BY player) g`).all()).results ?? [];
  const fast = fastAll.map((r) => ({ player: r.player, days: Math.max(1, Math.ceil((Number(r.at) - Number(r.first)) / 86400)), at: Number(r.at) }))
    .sort((x, y) => x.days - y.days || x.at - y.at || (x.player < y.player ? -1 : 1));
  const standings = await arenaStandingsOf(ctx, season);
  const last = season > 1 ? await arenaStandingsOf(ctx, season - 1) : { red: 0, blue: 0 };
  const laurel = last.red > last.blue ? 'red' : last.blue > last.red ? 'blue' : null;
  const member = me ? await arenaMemberOf(ctx, me) : null;
  const banner = member?.banner ?? null;
  const rosters = { red: await bannerRoster(ctx, season, 'red'), blue: await bannerRoster(ctx, season, 'blue') };
  const roster = banner ? rosters[banner] : [];
  const counts = (await db.prepare('SELECT banner, COUNT(*) AS n FROM arena_members WHERE banner IS NOT NULL GROUP BY banner').all()).results ?? [];
  const pvp = topWithMe(pvpAll.map((r) => ({ player: r.player, rating: Number(r.rating), wins: Number(r.wins), losses: Number(r.losses), draws: Number(r.draws), bouts: Number(r.bouts) })), me);
  const pve = topWithMe(pveAll.map((r) => ({ player: r.player, reached: Number(r.reached), losses: Number(r.losses), grand: honours.grands.has(r.player) })), me);
  const fastB = topWithMe(fast, me);
  const teams = Object.fromEntries(ARENA_BANNERS.map((b) => [b, topWithMe(rosters[b].map((r) => ({ player: r.player, points: Number(r.points), wins: Number(r.wins), banner: b })), me)]));
  const hall = grandRows.slice(0, ARENA_HALL_MAX).map((r) => ({ player: r.player, at: Number(r.at) }));
  const ids = [...pvp.rows, pvp.pinned, ...pve.rows, pve.pinned, ...fastB.rows, fastB.pinned, ...teams.red.rows, teams.red.pinned, ...teams.blue.rows, teams.blue.pinned, ...hall, champion ? { player: champion } : null].filter(Boolean).map((r) => r.player);
  const names = await namesOf(ctx, ids, env, nowS, honours);
  // an account's id stays the service's: a row says its name, its badge and whether it is the caller's
  const named = (r) => { if (!r) return null; const { player: id, ...rest } = r; return { ...rest, ...(names.get(id) ?? { name: '', title: null, glyphs: [] }) }; };
  const board = (b) => ({ rows: b.rows.map(named), pinned: named(b.pinned), total: b.total });
  const mine = me ? {
    ladder: await arenaLadderOfAccount(ctx, me),
    pvp: await arenaRatingOf(ctx, me, season),
    rank: pvp.rows.concat(pvp.pinned ? [pvp.pinned] : []).find((r) => r.you)?.rank ?? null,
    banner, left: member?.left_banner ?? null, leftSeason: member?.left_season ?? null,
    points: banner ? (roster.find((r) => r.player === me) ? Number(roster.find((r) => r.player === me).points) : 0) : 0,
    grand: honours.grands.has(me), champion: champion === me,
  } : null;
  return {
    season, day: arenaSeasonDay(nowS), endsAt: arenaSeasonEndsS(season),
    pvp: board(pvp), pve: board(pve), fast: board(fastB),
    champion: champion ? named({ player: champion }) : null,
    team: { standings, last: { season: season - 1, ...last, winner: laurel }, laurel, members: Object.fromEntries(ARENA_BANNERS.map((b) => [b, Number(counts.find((c) => c.banner === b)?.n ?? 0)])), rosters: { red: board(teams.red), blue: board(teams.blue) } },
    hall: hall.map(named),
    me: mine,
  };
}
