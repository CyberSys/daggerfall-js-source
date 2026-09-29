// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Begin!") - THE PROFESSIONS, AS THE SERVICE
// KEEPS THEM: a character's tracks and Stores, the day's harvests, the
// witnessed pixels, withdrawals to the pack, and the Court writs
// (bible/06-Systems/Professions-Arc.md, PROF0 3, 6, 7, 11 and 22; the
// numbers are src/net/professionLaw.js and src/net/nodeLaw.js, which
// the client reads too).
//
// ═══ REGISTERED ONLY, AND BEHIND A SWITCH ══════════════════════════
//
// The Stores are a character's and a guest is a device (MARKS1's
// reading): materials held by a credential a cleared browser loses are
// materials gone. PROFESSIONS_OPEN (off, dev, on - PROF0 20) opens it; a
// Court writ pays Marks, so a delivery asks MARKS_OPEN as well.
//
// ═══ THE SERVICE ROLLS, THE CLIENT PLAYS ═══════════════════════════
//
// A node's id is real by the law (nodeLaw.js - a hash of the pixel and
// the UTC day); the hour is the shared clock's, computed here from the
// act's end (sharedClassicMinutes); the cap, the Stores' room and the
// dice are the service's. The act's report moves the roll by its bounded
// step only (PROF0 5.1: a bruise one less, the Basket's +50% at most) -
// the tool, its wear, the foe and the load are the client's courtesy.
//
// ═══ ONE STATEMENT DECIDES, AND A REQUEST ASKED TWICE IS ONE ════════
//
// Each act is one `db.batch` (one transaction) whose FIRST statement
// decides it against the rows as they stand - a harvest's row, a
// withdrawal's row, a writ's fill - writing a fresh nonce `n`; the
// statements after it move the Stores, the XP, the Marks and the Renown
// only where that row carries this request's nonce. So a decision is never
// half carried out, two requests racing never both pass a cap, and a
// request sent again because its answer was lost finds its row and is
// answered `repeat`, moving nothing (MARKS1's law, one table over). The
// row is looked for BEFORE the switch (AUDIT 28 M2's rule): a request
// that was made is answered whatever the switch says now.
//
// EVERY CLOCK IS AN ARGUMENT, as in accounts.js.
// ═══════════════════════════════════════════════════════════════════
import { accountKind, mintId, overRate } from './accounts.js';
import { isDeveloper } from './titles.js';
import { marksOpenFor, balanceOf } from './marks.js';
import { CHAR_ID_RE } from './service.js';
import { MARKS_MAX, utcDay } from '../../src/net/marksLaw.js';
import { renownForXp, RENOWN_XP_MAX, RENOWN_TRACKS_MAX } from '../../src/net/renown.js';
import { sharedClassicMinutes } from '../../src/net/wire.js';
import { isForagingDaylight } from '../../src/systems/foragingCore.js';
import {
  PROFESSIONS, isProfession, rankOfXp, tierOpen, harvestXp, writXp, specOk, specsAt, SPEC_RANKS, RESPEC,
  HARVESTS_PER_DAY, STORES_MAX, WITHDRAW_MAX, PROF_OPS_MAX, PROF_OPS_WINDOW_S, HARVEST_LATE_S, HARVEST_EARLY_S,
  PROF_RID_RE, PROF_XP_MAX, profSwitchOf, basketStep, herbKey, professionOfFamily, courtWritCount, COURT_WRITS_PER_DAY,
  glintsMax, smeltRecipe, SMELT_MAX, smeltXp, craftXpCap, HARVESTS_PER_ACCOUNT_DAY, DEEP_UNCONFIRMED_PER_DAY,
  stockOf, STOCK_MAX, withdrawable, cutsMax, workPer, workSpecRank, hideOfFoe, HIDES_PER_DAY, HIGH_HIDES_PER_DAY, HIGH_HIDE_TIER,
} from '../../src/net/professionLaw.js';
import {
  recipeById, recipeOpen, qualityOdds, rollQuality, qualitySteps, craftQuality, takesQuality, craftXp, craftCount,
  makerName, FIRST_CRAFT_XP, recipeInputs, takesHeartwood, carriesMark, dyeOk,
} from '../../src/net/recipeLaw.js';
import { mintProductRecord } from '../../src/net/productRecord.js';
import { signingKey } from './signing.js';
import {
  parseNodeKey, nodeCount, herbPatch, herbSeasonMult, daySeason, HERB_TABLES, HERB_YIELD, FOOD_YIELD, herbYield, foodYield,
  basketFood, isMarch, regionOk, pixelOk, pixelKey, pixelReport, witnessedFact, factConfirmed, WITNESS, material,
  regionWritTable, courtWrits, VEIN_TABLES, vein, boulder, dungeonVein, dungeonOk, veinYield, boulderYield, VEIN_YIELD,
  BOULDER_YIELD, veinGem, veinSlots, WOOD_TABLES, tree, TREE_YIELD, treeYield, treeFinds, hideYield, bodyFinds,
} from '../../src/net/nodeLaw.js';
import { CLIMATES } from '../../src/formats/mapsTables.js';

const DAY_S = 86_400;
/** The pixels one read may ask after - a streamed 5 x 5. */
export const PIXELS_READ_MAX = 25;
/** The dungeons one read may ask after - the one the player stands in, and a few it has walked out of today. */
export const DUNGEONS_READ_MAX = 4;

/** Whether the professions are open to this account: the switch, and at `dev` the developers alone. */
export function profOpenFor(player, env) {
  const s = profSwitchOf(env?.PROFESSIONS_OPEN);
  return s === 'on' || (s === 'dev' && isDeveloper(player, env));
}

const charOk = (c) => typeof c === 'string' && CHAR_ID_RE.test(c);
/** The first door every professions request walks through: a registered account, its character, and (for an act) a
 *  request id. The switch is asked after the row an act's request may already have made. */
function asks(player, { character, rid, needRid = true }) {
  if (accountKind(player) !== 'linked') return { error: 'prof-need-account' };
  if (!charOk(character)) return { error: 'prof-character' };
  if (needRid && (typeof rid !== 'string' || !PROF_RID_RE.test(rid))) return { error: 'prof-rid' };
  return null;
}
const shut = (player, env) => (profOpenFor(player, env) ? null : { error: 'prof-closed' });
/** A random unit in [0, 1) from the service's CSPRNG. */
function dice(rand) {
  const b = new Uint32Array(1);
  rand(new Uint8Array(b.buffer));
  return b[0] / 4294967296;
}
/** The shared clock's hour at an instant (epoch seconds). */
const sharedHourAt = (atS) => Math.floor((((Math.floor(sharedClassicMinutes(atS * 1000)) % 1440) + 1440) % 1440) / 60);

// ─── WHAT A CHARACTER HAS ────────────────────────────────────────────

/** A track as the tabs read it: its XP and rank, the specialisations it stands under now, a change on its way. */
function trackView(row, profession, nowS) {
  const xp = Number(row?.xp ?? 0);
  const specs = specsAt(row, nowS);
  const pending = row?.respec_to && Number(row.respec_at) > nowS ? { rank: Number(row.respec_rank), to: row.respec_to, at: Number(row.respec_at) } : null;
  return { profession, xp, rank: rankOfXp(xp), specs, respec: pending };
}
const trackRow = (db, player, character, profession) =>
  db.prepare('SELECT * FROM prof_tracks WHERE player = ?1 AND char_id = ?2 AND profession = ?3').bind(player, character, profession).first();
/** One material's count in a character's Stores, own and bought. PROF5: the market's answers read it too. */
export async function storeOf(db, player, character, key) {
  const { results = [] } = await db.prepare('SELECT origin, qty FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = ?3')
    .bind(player, character, key).all();
  const out = { material: key, own: 0, bought: 0 };
  for (const r of results) out[r.origin === 'bought' ? 'bought' : 'own'] = Number(r.qty);
  return out;
}
/** A character's harvests today, by profession. */
async function todayOf(db, player, character, day) {
  const { results = [] } = await db.prepare('SELECT profession, COUNT(*) AS n FROM node_harvests WHERE player = ?1 AND char_id = ?2 AND day = ?3 GROUP BY profession')
    .bind(player, character, day).all();
  return Object.fromEntries(results.map((r) => [r.profession, Number(r.n)]));
}
const writsToday = async (db, player, day) =>
  Number((await db.prepare('SELECT COUNT(*) AS n FROM writs WHERE filled_by = ?1 AND day = ?2').bind(player, day).first())?.n ?? 0);

/**
 * A CHARACTER'S PROFESSIONS, as the Professions and Stores tabs and the nodes read them: every track, today's harvests
 * and the nodes taken, the Stores, today's Court writs filled, and the bounds.
 */
export async function profState({ db, nowS }, player, env, { character } = {}) {
  const refused = asks(player, { character, needRid: false }) ?? shut(player, env);
  if (refused) return refused;
  const day = utcDay(nowS);
  // PROF0 20: a day's harvests are kept two days - a bounded sweep on the state's own read
  await db.prepare('DELETE FROM node_harvests WHERE rowid IN (SELECT rowid FROM node_harvests WHERE day < ? LIMIT 500)').bind(day - 1).run();
  const { results: rows = [] } = await db.prepare('SELECT * FROM prof_tracks WHERE player = ?1 AND char_id = ?2').bind(player.id, character).all();
  const byProf = new Map(rows.map((r) => [r.profession, r]));
  const { results: stores = [] } = await db.prepare('SELECT material, origin, qty FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND qty > 0 ORDER BY material')
    .bind(player.id, character).all();
  const held = new Map();
  for (const r of stores) {
    const s = held.get(r.material) ?? { material: r.material, own: 0, bought: 0 };
    s[r.origin === 'bought' ? 'bought' : 'own'] = Number(r.qty);
    held.set(r.material, s);
  }
  const { results: taken = [] } = await db.prepare('SELECT node, kind FROM node_harvests WHERE player = ?1 AND char_id = ?2 AND day = ?3')
    .bind(player.id, character, day).all();
  return {
    character, day,
    tracks: PROFESSIONS.map((p) => trackView(byProf.get(p.id), p.id, nowS)),
    today: await todayOf(db, player.id, character, day),
    taken: taken.map((t) => `${t.node}|${t.kind}`),
    stores: [...held.values()],
    writs: { today: await writsToday(db, player.id, day), max: COURT_WRITS_PER_DAY },
    hunt: await huntToday(db, player.id, day),   // PROF7: the account's hides today (PROF0 6)
    caps: { harvests: HARVESTS_PER_DAY, stores: STORES_MAX, withdraw: WITHDRAW_MAX, hides: HIDES_PER_DAY, highHides: HIGH_HIDES_PER_DAY },
  };
}

// ─── THE WITNESSED WORLD: PIXELS AND DUNGEONS ────────────────────────

/** What the witnesses say of each thing of `kind` in `keys` (a pixel "x,y", a dungeon its id): a Map of key to nodeLaw
 *  witnessedFact. */
async function factsOf(db, keys, kind = 'pixel') {
  const out = new Map(keys.map((k) => [k, witnessedFact([])]));
  if (!keys.length) return out;
  const { results = [] } = await db.prepare(`SELECT key, account, report, at FROM world_witness WHERE kind = ?1 AND key IN (${keys.map((_, i) => `?${i + 2}`).join(', ')})`)
    .bind(kind, ...keys).all();
  const rowsBy = new Map();
  for (const r of results) { const a = rowsBy.get(r.key) ?? []; a.push({ account: r.account, report: r.report, at: Number(r.at) }); rowsBy.set(r.key, a); }
  for (const [k, rows] of rowsBy) out.set(k, witnessedFact(rows));
  return out;
}
const factView = (f) => (factConfirmed(f) ? { state: f.state, climate: f.climate, region: f.region } : { state: f.state });
/**
 * THE STATES OF WHAT A CLIENT HAS STREAMED: `{ pixels: [{ x, y, state, climate?, region? }], dungeons: [{ id, ... }] }`
 * - the confirmed answer where there is one (a client whose own derivation disagrees stands no node it could not
 * harvest), the state alone where there is not. So a node never shows a rare find its ground would not give. PROF2: a
 * dungeon the player stands in, asked beside the pixels.
 */
export async function profPixels({ db }, player, env, { character, pixels, dungeons = [] } = {}) {
  const refused = asks(player, { character, needRid: false }) ?? shut(player, env);
  if (refused) return refused;
  if (!Array.isArray(pixels) || pixels.length > PIXELS_READ_MAX) return { error: 'bad-pixels' };
  if (!Array.isArray(dungeons) || dungeons.length > DUNGEONS_READ_MAX || !dungeons.every(dungeonOk)) return { error: 'bad-pixels' };
  const want = [];
  for (const p of pixels) {
    if (!Array.isArray(p) || !pixelOk(p[0], p[1])) return { error: 'bad-pixels' };
    want.push(pixelKey(p[0], p[1]));
  }
  const keys = [...new Set(want)];
  const facts = await factsOf(db, keys);
  const dkeys = [...new Set(dungeons.map(String))];
  const dfacts = await factsOf(db, dkeys, 'dungeon');
  return {
    pixels: keys.map((k) => { const [x, y] = k.split(',').map(Number); return { x, y, ...factView(facts.get(k)) }; }),
    dungeons: dkeys.map((k) => ({ id: Number(k), ...factView(dfacts.get(k)) })),
  };
}

// ─── A HARVEST ───────────────────────────────────────────────────────

/** The answer a harvest's row gives - the first time (`rankBefore` the track's rank before it, so a rise is said), or
 *  again to a request asked twice. PROF2: a gem the strikes found, and its Stores. */
async function harvestAnswer(db, row, nowS, extra, rankBefore = null) {
  const t = trackView(await trackRow(db, row.player, row.char_id, row.profession), row.profession, nowS);
  return {
    ok: true, ...extra, ...(rankBefore === null ? {} : { rose: t.rank > rankBefore }), node: row.node, kind: row.kind, material: row.material, qty: Number(row.qty), xp: Number(row.xp),
    track: t, today: (await todayOf(db, row.player, row.char_id, Number(row.day)))[row.profession] ?? 0,
    store: await storeOf(db, row.player, row.char_id, row.material),
    ...(row.gem ? { gem: row.gem, gemStore: await storeOf(db, row.player, row.char_id, row.gem) } : {}),
    ...(row.extra ? { extra: row.extra, extraQty: Number(row.extra_qty ?? 1), extraStore: await storeOf(db, row.player, row.char_id, row.extra) } : {}),   // PROF4: a tree's Resin; PROF7: a body's butchery
    ...(row.profession === 'hunting' ? { hunt: await huntToday(db, row.player, Number(row.day)) } : {}),   // PROF7: the account's hides today
  };
}

/** Each node kind's harvests and the profession it is worked under (PROF0 5.2): a patch's herbs and food, a vein's and a
 *  dungeon vein's ore, a boulder's stone; PROF4: a tree's logs; PROF7: a body's hide. */
const NODE_HARVESTS = Object.freeze({
  body: Object.freeze({ kinds: Object.freeze(['hide']), profession: 'hunting' }),
  tree: Object.freeze({ kinds: Object.freeze(['logs']), profession: 'logging' }),
  herb: Object.freeze({ kinds: Object.freeze(['herbs', 'food']), profession: 'herbalism' }),
  vein: Object.freeze({ kinds: Object.freeze(['ore']), profession: 'mining' }),
  boulder: Object.freeze({ kinds: Object.freeze(['stone']), profession: 'mining' }),
  dvein: Object.freeze({ kinds: Object.freeze(['ore']), profession: 'mining' }),
});
/** Whether a climate may hold the node kind: a patch where herbs grow, a vein where veins run, a boulder where the
 *  climate has boulders, a dungeon vein in any climate a location has. */
function climateHolds(nodeKind, climate) {
  if (!Number.isSafeInteger(climate)) return false;
  if (nodeKind === 'herb') return !!HERB_TABLES[climate];
  if (nodeKind === 'vein') return !!VEIN_TABLES[climate];
  if (nodeKind === 'boulder') return nodeCount(climate, 'boulder') > 0;
  if (nodeKind === 'tree') return !!WOOD_TABLES[climate] && nodeCount(climate, 'tree') > 0;
  return Object.values(CLIMATES).includes(climate);
}
/** A Pick-Axe's report, bounded (PROF0 23): the strikes on the glint, at most the finish's; a clean finish only with
 *  every strike on it. */
function strikesOf(act, tier) {
  const most = glintsMax(tier);
  const glints = Number.isSafeInteger(act?.glints) ? Math.max(0, Math.min(most, act.glints)) : 0;
  return { glints, clean: act?.clean === true && glints === most };
}

/** PROF7 - a Skinning Knife's report, bounded (PROF0 29): a clean pelt or a torn one, never both - a report claiming both
 *  is neither. The score behind them is the client's; the act's bound is the step it can buy (5.1). */
function traceOf(act) {
  const clean = act?.clean === true, torn = act?.torn === true;
  return { clean: clean && !torn, torn: torn && !clean };
}
/** PROF7 - the account's hides today (PROF0 6: 30, of them 3 of tiers 5-6), every character's together. */
async function huntToday(db, player, day) {
  const r = await db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN tier >= ?3 THEN 1 ELSE 0 END), 0) AS high
    FROM node_harvests WHERE player = ?1 AND profession = 'hunting' AND day = ?2`).bind(player, day, HIGH_HIDE_TIER).first();
  return { hides: Number(r?.n ?? 0), high: Number(r?.high ?? 0) };
}

/** A Wood-Axe's report, bounded (PROF0 25): the Clean Cuts at most the finish's (every chop clean); a clean act only with
 *  every chop clean. */
function cutsOf(act, tier, lumberjack) {
  const most = cutsMax(tier, lumberjack);
  const cuts = Number.isSafeInteger(act?.cuts) ? Math.max(0, Math.min(most, act.cuts)) : 0;
  return { cuts, clean: act?.clean === true && cuts === most };
}

/**
 * A NODE HARVESTED (PROF0 6): `{ character, node, kind, climate, region, act, at, rid }` - the node's id, what of it is
 * taken (`herbs` or `food` at a patch, `ore` at a vein, `stone` at a boulder), its ground as the client derived it (a
 * pixel's climate and region; a dungeon's, for a dungeon vein), the act's report (`{ clean, bruised }` for an herb,
 * `{ finds }` for the Basket, `{ glints, clean }` for the Pick-Axe, `{ cuts, clean }` for the Wood-Axe - PROF4's `logs`
 * at a tree), the act's end on the shared clock (epoch seconds)
 * and the request's id. The id must be today's and real by the law; `at` at most ten minutes past and, on the surface,
 * in daylight; the ground as the witnesses confirmed it, or taken at the claim's word at the least it is worth (a
 * pixel's tiers 1-2 and no march or signature; a dungeon's tier 3 and no gem); the tier inside the rank; the day's cap
 * and the Stores' room decided in the harvest's own INSERT. The yield, and a gem, are the service's dice.
 *
 * PROF7: A BODY (`body:<day>:<id>`, kind `hide`, `foe` the DFU MobileTypes of the body the client says its own blow
 * felled; the act `{ clean, torn }` - the Skinning Knife's trace). Hunting is bounded, not witnessed (PROF0 6): a body
 * names no ground, keeps no hours and writes no witness, the tier is the foe's the client claims - and the account's day
 * is the whole defence, 30 hides and 3 of them of tiers 5-6, decided in the same INSERT.
 */
export async function harvestNode(ctx, player, env, body = {}) {
  const { db, nowS, rand } = ctx;
  const { character, node, kind, climate, region, act, at, rid, foe } = body ?? {};
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const prior = await db.prepare('SELECT * FROM node_harvests WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) return harvestAnswer(db, prior, nowS, { repeat: true });   // before the switch: a harvest made is a harvest answered
  const closed = shut(player, env);
  if (closed) return closed;
  const n = parseNodeKey(node);
  const law = n ? NODE_HARVESTS[n.kind] : null;
  if (!law) return { error: 'bad-node' };
  if (!law.kinds.includes(kind)) return { error: 'prof-kind' };
  const isBody = n.kind === 'body';   // PROF7: a body names no ground (PROF0 6)
  if (!isBody && (!climateHolds(n.kind, climate) || !regionOk(region))) return { error: 'prof-pixel' };
  const day = utcDay(nowS);
  if (n.day !== day) return { error: 'prof-day' };   // PROF0 19: a node whose UTC day has ended lapses
  if (!Number.isSafeInteger(at) || at < nowS - HARVEST_LATE_S || at > nowS + HARVEST_EARLY_S || utcDay(at) !== day) return { error: 'prof-late' };
  const deep = n.kind === 'dvein';
  // the wilderness keeps Foraging's day (FORAGE0 14.3); a dungeon vein keeps no hours (PROF0 5.1), nor Hunting (14.3)
  if (!deep && !isBody && !isForagingDaylight(sharedHourAt(at))) return { error: 'prof-night' };
  if (await overRate(ctx, `prof:${player.id}`, PROF_OPS_MAX, PROF_OPS_WINDOW_S)) return { error: 'prof-rate' };

  // THE GROUND, as the witnesses say it is - a pixel's, or a dungeon's; a body's none
  const wkind = deep ? 'dungeon' : 'pixel';
  const key = deep ? String(n.dungeon) : isBody ? null : pixelKey(n.x, n.y);
  const fact = key === null ? null : (await factsOf(db, [key], wkind)).get(key);
  const confirmed = factConfirmed(fact);
  const witness = !isBody && Number.isSafeInteger(player.registered_at) && player.registered_at <= nowS - WITNESS.ageS ? 1 : 0;
  if (confirmed && (fact.climate !== climate || fact.region !== region)) {
    // AUDIT 29 A4: refused - and, from an account that may witness, written down: a dissent is what a dispute is made
    // of (SEAT0 3.2), and a refusal that kept no report let the first three words stand for good
    if (witness) {
      await db.prepare('INSERT OR IGNORE INTO world_witness (kind, key, account, report, region, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)')
        .bind(wkind, key, player.id, pixelReport(climate, region), region, nowS).run();
    }
    return { error: 'prof-pixel' };
  }
  // a vein's slots are its climate's and, on confirmed ground, its region's signature beside them (AUDIT 29 A6)
  const slots = n.kind === 'vein' ? veinSlots({ climate, region, confirmed }) : nodeCount(climate, n.kind);
  if (!deep && !isBody && n.slot >= slots) return { error: 'bad-node' };

  // THE TRACK it is worked under
  const profession = law.profession;
  const row = await trackRow(db, player.id, character, profession);
  const rank = rankOfXp(Number(row?.xp ?? 0));
  const specs = specsAt(row, nowS);
  const march = !deep && !isBody && confirmed && isMarch(region);
  const roll = (lo, hi) => lo + Math.floor(dice(rand) * (hi - lo + 1));
  let tier, key2, qty, clean, gem = null, extra = null, extraQty = 1;
  if (isBody) {
    // PROF7: THE SKINNING KNIFE - the hide of the foe the client names; a clean pelt x1.5 (the act's bound), a torn one's
    // DFU part lost; the part one body in four; the butchery beside it, a Butcher's two (PROF0 4.4, 29)
    const h = hideOfFoe(foe);
    if (!h) return { error: 'prof-foe' };
    tier = h.tier;
    if (!tierOpen(rank, tier)) return { error: 'prof-rank' };
    const t = traceOf(act);
    clean = t.clean;
    key2 = h.key;
    qty = hideYield({ clean }, dice(rand));
    const finds = bodyFinds({ hide: h, torn: t.torn, butcher: specs[100] === 'butcher' }, () => dice(rand));
    gem = finds.part;
    extra = finds.meat;
    extraQty = finds.meatQty || 1;
  } else if (n.kind === 'tree') {
    // PROF4: THE WOOD-AXE - a tree's logs; Resin one in four, Heartwood a Clean Cut's find on confirmed ground (PROF0 25)
    const found = tree({ x: n.x, y: n.y, day, slot: n.slot, climate, confirmed });
    if (!found) return { error: 'bad-node' };
    tier = found.tier;
    if (!tierOpen(rank, tier)) return { error: 'prof-rank' };
    const c = cutsOf(act, tier, specs[50] === 'lumberjack');
    clean = c.clean;
    key2 = found.material;
    qty = treeYield({ roll: roll(TREE_YIELD[0], TREE_YIELD[1]), march }, dice(rand));
    const finds = treeFinds({ cuts: c.cuts, confirmed, forester: specs[50] === 'forester' }, () => dice(rand));
    gem = finds.heartwood;
    extra = finds.resin;
  } else if (n.kind === 'herb') {
    const patch = herbPatch({ x: n.x, y: n.y, day, slot: n.slot, climate, confirmed, seasonalEye: specs[100] === 'seasonal-eye' });
    if (!patch) return { error: 'bad-node' };
    if (kind === 'herbs') {
      tier = patch.tier;
      if (!tierOpen(rank, tier)) return { error: 'prof-rank' };
      key2 = herbKey(patch.herb, region);
      const common = tier === 1;
      // the steady hand's report, bounded: an uncommon or rare herb unbruised is the clean act; a bruised one yields one
      // less. A common herb has no moment. Apothecary's Friend: every herb picked counts as unbruised (PROF0 3.3).
      let bruised = !common && act?.bruised === true;
      clean = !common && act?.clean === true && !bruised;
      if (!common && specs[100] === 'apothecarys-friend') { bruised = false; clean = true; }
      qty = herbYield({
        roll: roll(HERB_YIELD[0], HERB_YIELD[1]), common, gardener: specs[50] === 'gardener',
        seasonMult: herbSeasonMult(patch.herb, daySeason(day)), offSeason: patch.offSeason, bruised, march,
      }, dice(rand));
    } else {
      tier = 1;
      const food = basketFood(climate, day, dice(rand));
      key2 = food.material;
      const finds = Number.isSafeInteger(act?.finds) ? Math.max(0, Math.min(3, act.finds)) : 0;
      clean = finds >= 3;
      const [lo, hi] = FOOD_YIELD[food.block];
      qty = foodYield({ roll: roll(lo, hi), step: basketStep(finds), march }, dice(rand));
    }
  } else {
    // PROF2: THE PICK-AXE - a vein's ore, a boulder's stone, a dungeon vein's deep ore (PROF0 23)
    const found = n.kind === 'vein' ? vein({ x: n.x, y: n.y, day, slot: n.slot, climate, region, confirmed })
      : n.kind === 'boulder' ? boulder({ x: n.x, y: n.y, day, slot: n.slot, climate })
        : dungeonVein({ dungeon: n.dungeon, day, slot: n.slot, climate, confirmed });
    if (!found) return { error: 'bad-node' };
    tier = found.tier;
    if (!tierOpen(rank, tier)) return { error: 'prof-rank' };
    const s = strikesOf(act, tier);
    clean = s.clean;
    if (n.kind === 'boulder') {
      const y = boulderYield({ roll: roll(BOULDER_YIELD[0], BOULDER_YIELD[1]), march, cut: clean || specs[100] === 'stonebreaker' }, dice(rand));
      key2 = y.material;
      qty = y.qty;
    } else {
      key2 = found.material;
      qty = veinYield({ roll: roll(VEIN_YIELD[0], VEIN_YIELD[1]), deep, deepDelver: specs[50] === 'deep-delver', march }, dice(rand));
      // a gem: each strike on the glint a chance (a Prospector's x1.1), on ground the witnesses confirmed - one at most
      gem = veinGem({ kind: n.kind, climate, glints: s.glints, confirmed, prospector: specs[50] === 'prospector' }, () => dice(rand));
    }
  }
  if (!key2) return { error: 'bad-node' };
  const xp = harvestXp(tier, rank, clean);
  const nonce = mintId(rand);
  const deepUnconfirmed = deep && !confirmed ? 1 : 0;
  const mine = 'player = ?1 AND rid = ?2 AND n = ?3';
  const stored = 'COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?4 AND material = ?5), 0)';
  await db.batch([
    // THE DECISION: today's cap for the profession (the character's, and the account's - AUDIT 29 A3), a dungeon nobody
    // vouched for within its four (A5), PROF7: Hunting's day for the account - 30 hides, 3 of tiers 5-6 (PROF0 6) - the
    // node not yet taken (the key), room in the Stores - the yield cut to it, the XP to what the track can take (A14: the
    // answer says what was credited)
    db.prepare(`INSERT OR IGNORE INTO node_harvests (day, node, kind, player, char_id, profession, material, qty, xp, gem, at, rid, n, deep_unconfirmed, extra, tier, extra_qty)
      SELECT ?6, ?7, ?8, ?1, ?4, ?9, ?5, MIN(?10, ?11 - ${stored}),
        MAX(0, MIN(?12, ?19 - COALESCE((SELECT xp FROM prof_tracks WHERE player = ?1 AND char_id = ?4 AND profession = ?9), 0))),
        CASE WHEN COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?4 AND material = ?15), 0) < ?11 THEN ?15 END, ?13, ?2, ?3, ?17,
        CASE WHEN COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?4 AND material = ?20), 0) + ?25 <= ?11 THEN ?20 END, ?22, ?25
      WHERE (SELECT COUNT(*) FROM node_harvests WHERE player = ?1 AND char_id = ?4 AND profession = ?9 AND day = ?6) < ?14
        AND (SELECT COUNT(*) FROM node_harvests WHERE player = ?1 AND profession = ?9 AND day = ?6) < ?16
        AND (?17 = 0 OR (SELECT COUNT(*) FROM node_harvests WHERE player = ?1 AND day = ?6 AND deep_unconfirmed = 1) < ?18)
        AND (?9 <> 'hunting' OR ((SELECT COUNT(*) FROM node_harvests WHERE player = ?1 AND profession = 'hunting' AND day = ?6) < ?21
          AND (?22 < ?23 OR (SELECT COUNT(*) FROM node_harvests WHERE player = ?1 AND profession = 'hunting' AND day = ?6 AND tier >= ?23) < ?24)))
        AND ?11 - ${stored} >= 1`)
      .bind(player.id, rid, nonce, character, key2, day, node, kind, profession, qty, STORES_MAX, xp, at, HARVESTS_PER_DAY, gem,
        HARVESTS_PER_ACCOUNT_DAY, deepUnconfirmed, DEEP_UNCONFIRMED_PER_DAY, PROF_XP_MAX, extra,
        HIDES_PER_DAY, tier, HIGH_HIDE_TIER, HIGH_HIDES_PER_DAY, extraQty),
    db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT player, char_id, material, 'own', qty FROM node_harvests WHERE ${mine}
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(player.id, rid, nonce),
    // the gem beside it - the decision kept it only where its own material had room
    db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT player, char_id, gem, 'own', 1 FROM node_harvests WHERE ${mine} AND gem IS NOT NULL
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(player.id, rid, nonce),
    // PROF4: a tree's Resin beside the logs, kept the same way; PROF7: a body's butchery, its count (a Butcher's two)
    db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT player, char_id, extra, 'own', extra_qty FROM node_harvests WHERE ${mine} AND extra IS NOT NULL
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(player.id, rid, nonce),
    db.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at)
      SELECT player, char_id, profession, MIN(?4, xp), ?5 FROM node_harvests WHERE ${mine}
      ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = MIN(?4, prof_tracks.xp + excluded.xp), updated_at = excluded.updated_at`)
      .bind(player.id, rid, nonce, PROF_XP_MAX, nowS),
    // THE WITNESS: the ground as this client derived it, once an account - an account a week registered
    db.prepare(`INSERT OR IGNORE INTO world_witness (kind, key, account, report, region, at)
      SELECT ?9, ?4, ?1, ?5, ?6, ?7 WHERE ?8 = 1 AND EXISTS (SELECT 1 FROM node_harvests WHERE ${mine})`)
      .bind(player.id, rid, nonce, key, pixelReport(climate, region), region ?? null, nowS, witness, wkind),   // PROF7: a body names no region - D1 binds no undefined
  ]);
  const made = await db.prepare('SELECT * FROM node_harvests WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (made?.n === nonce) return harvestAnswer(db, made, nowS, {}, rank);
  if (made) return harvestAnswer(db, made, nowS, { repeat: true });   // the same request, racing itself
  if (await db.prepare('SELECT 1 FROM node_harvests WHERE day = ?1 AND node = ?2 AND kind = ?3 AND player = ?4 AND char_id = ?5')
    .bind(day, node, kind, player.id, character).first()) return { error: 'node-taken' };
  if (((await todayOf(db, player.id, character, day))[profession] ?? 0) >= HARVESTS_PER_DAY) return { error: 'prof-cap' };
  const acct = await db.prepare('SELECT COUNT(*) AS n FROM node_harvests WHERE player = ?1 AND profession = ?2 AND day = ?3').bind(player.id, profession, day).first();
  if (Number(acct?.n ?? 0) >= HARVESTS_PER_ACCOUNT_DAY) return { error: 'prof-account-cap' };
  if (isBody) {   // PROF7: Hunting's day (PROF0 6)
    const hunt = await huntToday(db, player.id, day);
    if (hunt.hides >= HIDES_PER_DAY) return { error: 'prof-hunt-cap' };
    if (tier >= HIGH_HIDE_TIER && hunt.high >= HIGH_HIDES_PER_DAY) return { error: 'prof-hunt-high' };
  }
  if (deepUnconfirmed) {
    const d = await db.prepare('SELECT COUNT(*) AS n FROM node_harvests WHERE player = ?1 AND day = ?2 AND deep_unconfirmed = 1').bind(player.id, day).first();
    if (Number(d?.n ?? 0) >= DEEP_UNCONFIRMED_PER_DAY) return { error: 'prof-deep-cap' };
  }
  return { error: 'stores-full', material: key2 };
}

// ─── A SPECIALISATION (PROF0 3.3) ────────────────────────────────────

/**
 * A SPECIALISATION CHOSEN: `{ character, profession, rank, spec, from, rid }` - at 50 or 100, one of the two the
 * profession offers there, once the track holds the rank. The first choice at a rank is free; a change costs
 * RESPEC.marks (burnt - a line, `respec`) and takes effect RESPEC.days later, the old choice standing until then; one
 * change at a time. `from` is the choice the client saw standing (null for none): AUDIT 29 A15 - a choice the client
 * thought free, made meanwhile (another device, a lost answer), would have been a paid change the player never
 * confirmed; it is refused, `prof-spec-stale`, and nothing is burnt.
 */
export async function chooseSpec(ctx, player, env, { character, profession, rank, spec, from = null, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const answer = async (extra = {}, prof = profession, char = character) => ({ ok: true, ...extra, track: trackView(await trackRow(db, player.id, char, prof), prof, nowS) });
  // a request made is answered as made, before the switch: a free choice's row (AUDIT 29 A13), a paid change's line -
  // each its own track's (A2: an id asked for another track is not this request)
  const choice = await db.prepare('SELECT * FROM prof_choices WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (choice) return choice.char_id === character && choice.profession === profession ? answer({ repeat: true }) : { error: 'prof-rid' };
  const track = `${character}|${profession}`;
  const line = await db.prepare('SELECT kind, amount, who FROM marks_ledger WHERE actor = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (line) return line.kind === 'respec' && line.who === track ? answer({ repeat: true, marks: Number(line.amount), balance: await balanceOf(db, player.id) }) : { error: 'prof-rid' };
  const closed = shut(player, env);
  if (closed) return closed;
  if (!isProfession(profession) || !SPEC_RANKS.includes(rank) || !specOk(profession, rank, spec)) return { error: 'prof-spec' };
  if (from !== null && typeof from !== 'string') return { error: 'prof-spec' };
  const row = await trackRow(db, player.id, character, profession);
  if (rankOfXp(Number(row?.xp ?? 0)) < rank) return { error: 'prof-rank' };
  const col = rank === 50 ? 'spec50' : 'spec100';
  if (!row[col]) {
    // THE FREE FIRST CHOICE: its row decides, only while the rank has none; the track takes it by the row's nonce
    const nonce = mintId(rand);
    await db.batch([
      db.prepare(`INSERT OR IGNORE INTO prof_choices (player, rid, char_id, profession, rank, spec, at, n)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
        WHERE EXISTS (SELECT 1 FROM prof_tracks WHERE player = ?1 AND char_id = ?3 AND profession = ?4 AND ${col} IS NULL)`)
        .bind(player.id, rid, character, profession, rank, spec, nowS, nonce),
      db.prepare(`UPDATE prof_tracks SET ${col} = ?4, updated_at = ?5 WHERE player = ?1 AND char_id = ?2 AND profession = ?3 AND ${col} IS NULL
        AND EXISTS (SELECT 1 FROM prof_choices WHERE player = ?1 AND rid = ?6 AND n = ?7)`)
        .bind(player.id, character, profession, spec, nowS, rid, nonce),
    ]);
    const made = await db.prepare('SELECT n FROM prof_choices WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
    if (made?.n === nonce) return answer();
    if (made) return answer({ repeat: true });
    return { error: 'prof-spec-taken' };   // chosen meanwhile - the client reads the track again
  }
  const current = specsAt(row, nowS)[rank];
  if (from !== current) return { error: 'prof-spec-stale' };
  if (row.respec_to && Number(row.respec_at) > nowS) return { error: 'prof-respec-pending' };
  if (current === spec) return answer();   // already so
  if (!marksOpenFor(player, env)) return { error: 'marks-closed' };
  if (await overRate(ctx, `prof:${player.id}`, PROF_OPS_MAX, PROF_OPS_WINDOW_S)) return { error: 'prof-rate' };
  const day = utcDay(nowS);
  await db.batch([
    // THE DECISION: the Marks burnt, only while no change is on its way for this track - the line names the track
    // (AUDIT 29 A2: `who`, which a burn's line leaves empty), so the change below is this line's and no other track's.
    // AUDIT 30 S4: a plain INSERT, the id's line refused in the statement - an OR IGNORE swallowed the balance trigger's
    // CHECK as a duplicate would be, and a guard ever short would have burnt nothing and changed the track all the same
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', ?1, 'burn', NULL, 'respec', ?4, ?5, ?6, ?1, ?8, ?7
      WHERE COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) >= ?4
        AND NOT EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?7)
        AND NOT EXISTS (SELECT 1 FROM prof_tracks WHERE player = ?1 AND char_id = ?2 AND profession = ?3 AND respec_to IS NOT NULL AND respec_at > ?6)`)
      .bind(player.id, character, profession, RESPEC.marks, day, nowS, rid, track),
    // a change that has taken effect is folded into its rank's choice first; then the new one waits its week
    db.prepare(`UPDATE prof_tracks SET
        spec50 = CASE WHEN respec_rank = 50 AND respec_at <= ?4 THEN respec_to ELSE spec50 END,
        spec100 = CASE WHEN respec_rank = 100 AND respec_at <= ?4 THEN respec_to ELSE spec100 END,
        respec_rank = ?5, respec_to = ?6, respec_at = ?7, updated_at = ?4
      WHERE player = ?1 AND char_id = ?2 AND profession = ?3
        AND NOT (respec_to IS NOT NULL AND respec_at > ?4)
        AND EXISTS (SELECT 1 FROM marks_ledger WHERE actor = ?1 AND rid = ?8 AND kind = 'respec' AND who = ?9)`)
      .bind(player.id, character, profession, nowS, rank, spec, nowS + RESPEC.days * DAY_S, rid, track),
  ]);
  const made = await db.prepare('SELECT kind, amount, who FROM marks_ledger WHERE actor = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (!made) return { error: (await balanceOf(db, player.id)) < RESPEC.marks ? 'marks-short' : 'prof-respec-pending' };
  if (made.kind !== 'respec' || made.who !== track) return { error: 'prof-rid' };   // the same id, another track's
  return answer({ marks: RESPEC.marks, balance: await balanceOf(db, player.id) });
}

// ─── WITHDRAW TO THE PACK (PROF0 7, law 3: one way) ──────────────────

/** Spend `qtySql` units of a material from a character's Stores - bought units first, so a character's own stay for
 *  writs (PROF0 7) - where `guard` holds; the rows left at 0 deleted. Three statements, in this order: the own row is
 *  charged what the bought row cannot cover, reading the bought row before it is charged. PROF5: a listing's units
 *  and a fill's leave the Stores by it too. */
export function spendStatements(db, { player, character, materialSql, qtySql, guard, binds }) {
  const bought = `COALESCE((SELECT b.qty FROM prof_stores b WHERE b.player = ?1 AND b.char_id = ?2 AND b.material = ${materialSql} AND b.origin = 'bought'), 0)`;
  return [
    db.prepare(`UPDATE prof_stores SET qty = qty - MAX(0, ${qtySql} - ${bought})
      WHERE player = ?1 AND char_id = ?2 AND origin = 'own' AND material = ${materialSql} AND ${guard}`).bind(player, character, ...binds),
    db.prepare(`UPDATE prof_stores SET qty = MAX(0, qty - ${qtySql})
      WHERE player = ?1 AND char_id = ?2 AND origin = 'bought' AND material = ${materialSql} AND ${guard}`).bind(player, character, ...binds),
    db.prepare('DELETE FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND qty = 0').bind(player, character),
  ];
}

/**
 * WITHDRAW TO PACK: `{ character, material, qty, rid }` - `qty` units out of the Stores, bought first, for the client to
 * mint as the items the law names (professionLaw materialOf). They never come back (law 3).
 */
export async function withdrawStores(ctx, player, env, { character, material: key, qty, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const answer = async (row, extra = {}) => ({ ok: true, ...extra, material: row.material, qty: Number(row.qty), store: await storeOf(db, player.id, row.char_id, row.material) });
  const prior = await db.prepare('SELECT * FROM prof_withdrawals WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!material(key)) return { error: 'bad-material' };
  if (!withdrawable(key)) return { error: 'prof-no-pack-form' };   // PROF3: the smith's stock waits for its professions' templates
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > WITHDRAW_MAX) return { error: 'bad-qty' };
  if (await overRate(ctx, `prof:${player.id}`, PROF_OPS_MAX, PROF_OPS_WINDOW_S)) return { error: 'prof-rate' };
  const nonce = mintId(rand);
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO prof_withdrawals (player, rid, char_id, material, qty, at, n)
      SELECT ?1, ?3, ?2, ?4, ?5, ?6, ?7
      WHERE COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = ?4), 0) >= ?5`)
      .bind(player.id, character, rid, key, qty, nowS, nonce),
    ...spendStatements(db, {
      player: player.id, character, materialSql: '?3', qtySql: '?4',
      guard: 'EXISTS (SELECT 1 FROM prof_withdrawals WHERE player = ?1 AND rid = ?5 AND n = ?6)', binds: [key, qty, rid, nonce],
    }),
  ]);
  const made = await db.prepare('SELECT * FROM prof_withdrawals WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  return { error: 'stores-short' };
}

// ─── A SMELT AT A FORGE (PROF0 4.1, 23) ──────────────────────────────

/**
 * A SMELT: `{ character, recipe, count, rid }` - one of the forge's recipes (professionLaw SMELT_RECIPES) `count` times,
 * up to SMELT_MAX; PROF4: or a log burnt at the forge or sawn at the workbench (BURN_RECIPES, SAW_RECIPES - one route,
 * one table, each recipe naming its station, its yield a unit and the choice that raises it). The service cannot see
 * the forge or the workbench (as it cannot see the board): the inputs are the Stores' and their units are the bound.
 * Decided by the smelt's own INSERT: every input held, room in the Stores for the product, the products' origin read in
 * the same statement (an ingot is own only when every unit that made it was - bought units are spent first). Then the
 * inputs out, the products in, and the recipe's XP - Smithing's 10 x the product's tier a unit for a smelt, under the
 * crafter's limit (PROF0 3.2); none for a log's (PROF0 25).
 */
export async function smeltAtForge(ctx, player, env, { character, recipe: id, count, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const answer = async (row, extra = {}) => {
    const r = smeltRecipe(row.recipe);
    const prof = r.xp ?? r.more?.profession ?? 'smithing';
    return {
      ok: true, ...extra, recipe: row.recipe, count: Number(row.count), own: Number(row.own), bought: Number(row.bought), xp: Number(row.xp),
      track: trackView(await trackRow(db, player.id, row.char_id, prof), prof, nowS),
      stores: await Promise.all([r.out, ...r.inputs.map((inp) => inp.key)].map((k) => storeOf(db, player.id, row.char_id, k))),
    };
  };
  const prior = await db.prepare('SELECT * FROM prof_smelts WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  const r = smeltRecipe(id);
  if (!r) return { error: 'bad-recipe' };
  if (!Number.isSafeInteger(count) || count < 1 || count > SMELT_MAX) return { error: 'bad-qty' };
  if (await overRate(ctx, `prof:${player.id}`, PROF_OPS_MAX, PROF_OPS_WINDOW_S)) return { error: 'prof-rate' };
  const out = material(r.out);
  // the crafter's limit, read from the character's crafts as they stand
  const { results: tracks = [] } = await db.prepare('SELECT * FROM prof_tracks WHERE player = ?1 AND char_id = ?2').bind(player.id, character).all();
  const ranks = Object.fromEntries(tracks.map((t) => [t.profession, rankOfXp(Number(t.xp))]));
  // PROF3 (FOUND): a Quartermaster's ingots are two a unit (PROF0 3.3) - the choice was offered and the doubling unbuilt;
  // PROF4: the recipe names its yield a unit and the choice that raises it (a Charcoal Burner's, a Timberwright's too);
  // PROF7: at the rank the choice is made at - a Tanner's at 50
  const specsHere = r.more ? { [r.more.profession]: specsAt(tracks.find((t) => t.profession === r.more.profession), nowS)[workSpecRank(r)] } : {};
  const per = workPer(r, specsHere);
  const cap = r.xp ? craftXpCap(r.xp, ranks) : 0;
  const xp = r.xp ? smeltXp(out.tier, count, ranks[r.xp] ?? 0) : 0;   // AUDIT 29 A7: the record's quarter, at the smith's rank
  const nonce = mintId(rand);
  // ?1 player ?2 character ?3 rid ?4 recipe ?5 count ?6 out ?7 STORES_MAX ?8 xp ?9 now ?10 nonce; the inputs ?11 on, two a one
  const binds = [player.id, character, rid, r.id, count, r.out, STORES_MAX, xp, nowS, nonce];
  const held = [], boughtOf = [];
  r.inputs.forEach((inp, i) => {
    const k = `?${11 + 2 * i}`, need = `?${12 + 2 * i}`;
    binds.push(inp.key, inp.n * count);
    held.push(`COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = ${k}), 0) >= ${need}`);
    // the products bought: the most any input's bought units reach, product by product (professionLaw smeltOrigin)
    boughtOf.push(`((MIN(COALESCE((SELECT qty FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = ${k} AND origin = 'bought'), 0), ${need}) + ${inp.n} - 1) / ${inp.n})`);
  });
  const bought = boughtOf.length > 1 ? `MAX(${boughtOf.join(', ')})` : boughtOf[0];
  await db.batch([
    // THE DECISION: every input held, the product's room - and its origin, read before a unit moves; the XP what the
    // track can take under the crafter's limit (AUDIT 29 A14: the answer says what was credited)
    db.prepare(`INSERT OR IGNORE INTO prof_smelts (player, rid, char_id, recipe, count, own, bought, xp, at, n)
      SELECT ?1, ?3, ?2, ?4, ?5, ${per} * (?5 - MIN(?5, ${bought})), ${per} * MIN(?5, ${bought}),
        MAX(0, MIN(?8, ${Number(cap)} - COALESCE((SELECT xp FROM prof_tracks WHERE player = ?1 AND char_id = ?2 AND profession = '${r.xp ?? 'smithing'}'), 0))), ?9, ?10
      WHERE ${held.join(' AND ')}
        AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = ?6), 0) + ${per} * ?5 <= ?7`).bind(...binds),
    // the inputs out, each bought first
    ...r.inputs.flatMap((inp) => spendStatements(db, {
      player: player.id, character, materialSql: '?3', qtySql: '?4', guard: 'EXISTS (SELECT 1 FROM prof_smelts WHERE player = ?1 AND rid = ?5 AND n = ?6)',
      binds: [inp.key, inp.n * count, rid, nonce],
    })),
    // the products in, own and bought as the decision read them
    ...['own', 'bought'].map((origin) => db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT ?1, ?2, ?4, '${origin}', ${origin} FROM prof_smelts WHERE player = ?1 AND rid = ?3 AND n = ?5 AND ${origin} > 0
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(player.id, character, rid, r.out, nonce)),
    // the XP the decision credited, under the crafter's limit - a smelt's Smithing; a log's none (PROF0 25)
    ...(r.xp ? [db.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at)
      SELECT ?1, ?2, ?7, MIN(?4, xp), ?5 FROM prof_smelts WHERE player = ?1 AND rid = ?3 AND n = ?6
      ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = MAX(prof_tracks.xp, MIN(?4, prof_tracks.xp + excluded.xp)), updated_at = excluded.updated_at`)
      .bind(player.id, character, rid, cap, nowS, nonce, r.xp)] : []),
  ]);
  const made = await db.prepare('SELECT * FROM prof_smelts WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  for (const inp of r.inputs) {
    const st = await storeOf(db, player.id, character, inp.key);
    if (st.own + st.bought < inp.n * count) return { error: 'stores-short', material: inp.key };
  }
  return { error: 'stores-full', material: r.out };
}

// ─── A CRAFT AT THE ANVIL (PROF0 9, 24) ──────────────────────────────

/** A provenance id: 16 hex digits from the service's CSPRNG (PROF0 9.1). */
function provenanceId(rand) {
  const b = new Uint8Array(8);
  rand(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
/** A craft's answer, read back from its row: the pieces it made, each its provenance and its signed record; PROF4:
 *  whether their names carry the maker's mark, and the Stores of what it spent (a Heartwood among them). */
async function craftAnswer(db, player, row, nowS, extra = {}) {
  const r = recipeById(row.recipe);
  const ids = [row.provenance, row.provenance2].filter(Boolean);
  const { results = [] } = await db.prepare(`SELECT provenance, record, maker, marked FROM products WHERE provenance IN (${ids.map((_, i) => `?${i + 1}`).join(', ')})`).bind(...ids).all();
  const by = new Map(results.map((p) => [p.provenance, p]));
  const prof = r?.profession ?? 'smithing';
  const spent = r ? [...new Set([...r.inputs.map((i) => i.key), ...recipeInputs(r, { heartwood: Number(row.heartwood) === 1 }).map((i) => i.key)])] : [];
  return {
    ok: true, ...extra, recipe: row.recipe, quality: Number(row.quality), count: Number(row.count), seed: Number(row.seed),
    maker: by.get(row.provenance)?.maker ?? null, marked: Number(by.get(row.provenance)?.marked ?? 0) === 1, xp: Number(row.xp), first: Number(row.first) === 1,
    heartwood: Number(row.heartwood) === 1, dye: row.dye == null ? null : Number(row.dye),   // PROF7: a garment's dye
    pieces: ids.map((p) => ({ provenance: p, record: by.get(p)?.record ?? null })),
    track: trackView(await trackRow(db, player.id, row.char_id, prof), prof, nowS),
    stores: await Promise.all(spent.map((k) => storeOf(db, player.id, row.char_id, k))),
  };
}

/**
 * A CRAFT: `{ character, recipe, clean, name, heartwood, dye, rid }` - one of the anvil's recipes or, PROF4, the
 * workbench's, or, PROF7, the loom's (net/recipeLaw.js RECIPES; the recipe names its profession). PROF7: `dye` a
 * garment's colour (recipeLaw GARMENT_DYES) - signed into the record, kept on the piece; asked of anything else,
 * refused (`prof-dye`). The service cannot see the anvil, the workbench or the loom (as it cannot see the forge,
 * PROF0 23): the inputs are the Stores' and their units are the bound. The recipe's rank is the
 * character's rank in its profession to reach; a recipe whose slice is to come is refused (`prof-later` - the Ram Kit).
 * The quality is the service's roll on the margin (9.2), then a step each for the act the client reports clean (the
 * honest bound: one step, 5.1), the family's specialisation, and a Warforged ingot or a Heartwood (one step between
 * them); a Masterwright's points; nothing past Masterwork - a Repair Kit and arrows take none, and a Quartermaster's kit
 * is two. A Heartwood asked stands in for one plank (PROF0 25); a Joiner's furniture takes half the planks. Decided by
 * the craft's own INSERT: every input held. Then the inputs out, bought first; the pieces written, each its provenance
 * id, its signed record (net/productRecord.js) and whether its name carries the maker's mark (a Masterwork's, a Master
 * Joiner's furniture); and the XP - 20 x the recipe's tier, +500 the character's first of it, under the crafter's limit
 * (3.2), answered as credited.
 */
export async function craftAtAnvil(ctx, player, env, { character, recipe: id, clean, name, heartwood = false, dye = null, rid } = {}) {
  const { db, nowS, rand, subtle } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const prior = await db.prepare('SELECT * FROM prof_crafts WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) return craftAnswer(db, player, prior, nowS, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  const r = recipeById(id);
  if (!r) return { error: 'bad-recipe' };
  if (r.later) return { error: 'prof-later' };   // PROF4: the Ram Kit - named, made with the sieges (PROF0 25)
  if (!dyeOk(r, dye)) return { error: 'prof-dye' };   // PROF7: a garment's dye, of its ten - nothing else is dyed
  if (await overRate(ctx, `prof:${player.id}`, PROF_OPS_MAX, PROF_OPS_WINDOW_S)) return { error: 'prof-rate' };
  const { results: tracks = [] } = await db.prepare('SELECT * FROM prof_tracks WHERE player = ?1 AND char_id = ?2').bind(player.id, character).all();
  const ranks = Object.fromEntries(tracks.map((t) => [t.profession, rankOfXp(Number(t.xp))]));
  const prof = r.profession;
  const rank = ranks[prof] ?? 0;
  if (!recipeOpen(r, rank)) return { error: 'prof-rank' };
  const specs = specsAt(tracks.find((t) => t.profession === prof), nowS);
  const cap = craftXpCap(prof, ranks);
  const wood = heartwood === true && takesHeartwood(r);
  const inputs = recipeInputs(r, { heartwood: wood, joiner: specs[50] === 'joiner' });
  const quality = takesQuality(r)
    ? craftQuality(rollQuality(dice(rand), qualityOdds(rank - r.rank, { masterwright: specs[100] === 'masterwright' })), qualitySteps(r, { clean: clean === true, spec50: specs[50], heartwood: wood }))
    : -1;
  const count = craftCount(r, specs[100]);
  const maker = makerName(name);
  const marked = carriesMark(r, quality, specs[100]) ? 1 : 0;
  const seed = Math.floor(dice(rand) * 4294967296);
  const provs = Array.from({ length: count }, () => provenanceId(rand));
  const key = await signingKey(env, subtle);
  const u = dye ?? null;
  const records = await Promise.all(provs.map((p) => mintProductRecord({ p, s: player.id, h: character, r: r.id, q: quality, m: maker, c: seed, a: marked === 1 && maker !== null, u }, key, { subtle, nowS })));   // AUDIT 30 L4: the mark signed; PROF7: the dye
  const nonce = mintId(rand);
  // ?1 player ?2 character ?3 rid ?4 recipe ?5 quality ?6 count ?7 provenance ?8 provenance2 ?9 seed ?10 the XP before the
  // first craft's ?13 ?11 now ?12 nonce ?14 the profession ?15 heartwood ?16 the dye; the inputs ?17 on, two a one
  const binds = [player.id, character, rid, r.id, quality, count, provs[0], provs[1] ?? null, seed, craftXp(r.tier, rank, false), nowS, nonce, FIRST_CRAFT_XP, prof, wood ? 1 : 0, u];
  const held = [];
  inputs.forEach((inp, i) => {
    binds.push(inp.key, inp.n);
    held.push(`COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = ?${17 + 2 * i}), 0) >= ?${18 + 2 * i}`);
  });
  const decided = 'EXISTS (SELECT 1 FROM prof_crafts WHERE player = ?1 AND rid = ?5 AND n = ?6)';
  await db.batch([
    // THE DECISION: every input held - and the XP what the track can take under the crafter's limit, the first craft's
    // 500 laid on when the character has made none of the recipe
    db.prepare(`INSERT OR IGNORE INTO prof_crafts (player, rid, char_id, recipe, quality, count, provenance, provenance2, seed, xp, first, at, n, heartwood, dye)
      SELECT ?1, ?3, ?2, ?4, ?5, ?6, ?7, ?8, ?9,
        MAX(0, MIN(?10 + f * ?13, ${Number(cap)} - COALESCE((SELECT xp FROM prof_tracks WHERE player = ?1 AND char_id = ?2 AND profession = ?14), 0))),
        f, ?11, ?12, ?15, ?16
      FROM (SELECT CASE WHEN EXISTS (SELECT 1 FROM prof_crafts WHERE player = ?1 AND char_id = ?2 AND recipe = ?4) THEN 0 ELSE 1 END AS f)
      WHERE ${held.join(' AND ')}`).bind(...binds),
    // the inputs out, each bought first
    ...inputs.flatMap((inp) => spendStatements(db, {
      player: player.id, character, materialSql: '?3', qtySql: '?4', guard: decided, binds: [inp.key, inp.n, rid, nonce],
    })),
    // the pieces, each its provenance id, its owner (this account), its signed record, its mark and (PROF7) its dye
    ...provs.map((p, i) => db.prepare(`INSERT INTO products (provenance, owner, char_id, maker, recipe, template, material, quality, seed, record, made_at, marked, dye)
      SELECT ?4, ?1, ?2, ?6, ?7, ?8, ?9, quality, seed, ?10, at, ?11, dye FROM prof_crafts WHERE player = ?1 AND rid = ?3 AND n = ?5`)
      .bind(player.id, character, rid, p, nonce, maker, r.id, r.templateIndex, r.material, records[i], marked)),
    // the XP the decision credited, under the crafter's limit - the recipe's profession's
    db.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at)
      SELECT ?1, ?2, ?7, MIN(?4, xp), ?5 FROM prof_crafts WHERE player = ?1 AND rid = ?3 AND n = ?6
      ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = MAX(prof_tracks.xp, MIN(?4, prof_tracks.xp + excluded.xp)), updated_at = excluded.updated_at`)
      .bind(player.id, character, rid, cap, nowS, nonce, prof),
  ]);
  const made = await db.prepare('SELECT * FROM prof_crafts WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (made?.n === nonce) return craftAnswer(db, player, made, nowS);
  if (made) return craftAnswer(db, player, made, nowS, { repeat: true });
  for (const inp of inputs) {
    const st = await storeOf(db, player.id, character, inp.key);
    if (st.own + st.bought < inp.n) return { error: 'stores-short', material: inp.key };
  }
  return { error: 'stores-short' };
}

// ─── THE SMITH'S STOCK (PROF0 24) ────────────────────────────────────

/**
 * A PURCHASE FROM THE SMITH'S STOCK: `{ character, material, qty, rid }` - `qty` of one of the fittings no profession
 * yields yet (professionLaw SMITH_STOCK), into the Stores as BOUGHT units (a counter's goods, PROF0 4.5 and 7), for
 * Marks burnt - never purse gold (law 3). The service cannot see the forge: it sells wherever it is asked, and the client
 * asks at a smith's; a lie buys the same goods at the same price. Decided by the purchase's own INSERT: the Marks held,
 * the Stores' room; then the Marks line (kind `stock`) and the units, both keyed on its nonce.
 */
export async function buyStock(ctx, player, env, { character, material: key, qty, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const answer = async (row, extra = {}) => ({
    ok: true, ...extra, material: row.material, qty: Number(row.qty), marks: Number(row.marks),
    balance: await balanceOf(db, player.id), store: await storeOf(db, player.id, row.char_id, row.material),
  });
  const prior = await db.prepare('SELECT * FROM prof_stock WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  const s = stockOf(key);
  if (!s) return { error: 'bad-material' };
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > STOCK_MAX) return { error: 'bad-qty' };
  if (!marksOpenFor(player, env)) return { error: 'marks-closed' };
  if (await overRate(ctx, `prof:${player.id}`, PROF_OPS_MAX, PROF_OPS_WINDOW_S)) return { error: 'prof-rate' };
  const cost = s.marks * qty;
  const nonce = mintId(rand);
  await db.batch([
    // THE DECISION: the Marks held and the Stores' room
    db.prepare(`INSERT OR IGNORE INTO prof_stock (player, rid, char_id, material, qty, marks, at, n)
      SELECT ?1, ?3, ?2, ?4, ?5, ?6, ?7, ?8
      WHERE COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) >= ?6
        AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = ?4), 0) + ?5 <= ?9`)
      .bind(player.id, character, rid, key, qty, cost, nowS, nonce, STORES_MAX),
    // the Marks burnt - one line, naming the material - and the units in, bought
    // AUDIT 30 S1: the line its own name (a client id cannot hold `:`) and a plain INSERT - under the bare id it clashed
    // with an exchange's or a guild move's line, was dropped, and the stock came free
    db.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'account', ?1, 'burn', NULL, 'stock', marks, ?2, at, ?1, material, rid || ':stock' FROM prof_stock WHERE player = ?1 AND rid = ?3 AND n = ?4`)
      .bind(player.id, utcDay(nowS), rid, nonce),
    db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT player, char_id, material, 'bought', qty FROM prof_stock WHERE player = ?1 AND rid = ?2 AND n = ?3
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(player.id, rid, nonce),
  ]);
  const made = await db.prepare('SELECT * FROM prof_stock WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (made?.n === nonce) return answer(made);
  if (made) return answer(made, { repeat: true });
  return { error: (await balanceOf(db, player.id)) < cost ? 'marks-short' : 'stores-full', material: key };
}

// ─── COURT WRITS (PROF0 11) ──────────────────────────────────────────

/** A writ as the Work tab reads it: `state` open, mine (filled by this account) or taken. */
const writView = (w, me) => ({
  id: w.id, kind: w.kind, region: Number(w.region), material: w.material, tier: Number(w.tier), qty: Number(w.qty),
  pay: Number(w.pay), renown: Number(w.renown), expiresAt: Number(w.expires_at),
  state: !w.filled_by ? 'open' : w.filled_by === me ? 'mine' : 'taken',
});

/** A region's witnessed pixels: each pixel whose witnesses name this region, with whether it is confirmed. */
async function regionGround(db, region) {
  // AUDIT 29 A11: the pixels any report names for the region, each read over ALL its reports - a pixel one early report
  // named for this region and three confirmed for another is the other's
  const { results = [] } = await db.prepare(`SELECT key, account, report, at FROM world_witness WHERE kind = 'pixel'
    AND key IN (SELECT key FROM world_witness WHERE kind = 'pixel' AND region = ?)`).bind(region).all();
  const rowsBy = new Map();
  for (const r of results) { const a = rowsBy.get(r.key) ?? []; a.push({ account: r.account, report: r.report, at: Number(r.at) }); rowsBy.set(r.key, a); }
  const out = [];
  for (const rows of rowsBy.values()) {
    const f = witnessedFact(rows);
    if (f.region === region && f.climate !== null) out.push({ climate: f.climate, confirmed: factConfirmed(f) });
  }
  return out;
}
/** The registered accounts that played online in the seven days before `dayStartS` (ACC4's beat) - `active`. */
async function activeBefore(db, dayStartS) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM players WHERE handle IS NOT NULL AND played_at >= ?1 AND played_at < ?2')
    .bind(dayStartS - 7 * DAY_S, dayStartS).first();
  return Number(r?.n ?? 0);
}
/**
 * A REGION'S WRITS FOR THE DAY, written down on the day's first read: how many (`active` then) and each writ (nodeLaw
 * courtWrits over the region's witnessed ground in the day's season). A region whose ground nobody has witnessed posts
 * nothing yet, and nothing is written down - a later read posts once there is ground.
 */
async function postWrits(db, day, region, nowS) {
  if (await db.prepare('SELECT 1 FROM writ_days WHERE day = ?1 AND region = ?2').bind(day, region).first()) return;
  const table = regionWritTable(region, await regionGround(db, region), daySeason(day));
  if (!table.length) return;
  const active = await activeBefore(db, day * DAY_S);
  const writs = courtWrits(day, region, courtWritCount(active), table);
  const expires = (day + 1) * DAY_S;
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO writ_days (day, region, active, posted, at) VALUES (?1, ?2, ?3, ?4, ?5)').bind(day, region, active, writs.length, nowS),
    ...writs.map((w) => db.prepare(`INSERT OR IGNORE INTO writs (id, kind, day, region, slot, material, tier, qty, pay, renown, expires_at)
      VALUES (?1, 'court', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`)
      .bind(`c:${day}:${region}:${w.slot}`, day, region, w.slot, w.material, w.tier, w.units, w.pay, w.renown, expires)),
  ]);
}

/** THE WORK TAB'S WRITS for a region's board: today's Court writs, each open, mine or taken, and the account's day. */
export async function listWrits({ db, nowS }, player, env, { character, region } = {}) {
  const refused = asks(player, { character, needRid: false }) ?? shut(player, env);
  if (refused) return refused;
  if (!regionOk(region)) return { error: 'bad-region' };
  const day = utcDay(nowS);
  await postWrits(db, day, region, nowS);
  const { results = [] } = await db.prepare('SELECT * FROM writs WHERE day = ?1 AND region = ?2 ORDER BY slot').bind(day, region).all();
  return {
    region, day, endsAt: (day + 1) * DAY_S,
    writs: results.map((w) => writView(w, player.id)),
    today: { filled: await writsToday(db, player.id, day), max: COURT_WRITS_PER_DAY },
  };
}

/** The Renown a delivery credited, in the shape `/v1/renown/xp` answers (so the client's one plan reads it) - the
 *  delivering character's track (RENOWN-CHAR), and `max` once it holds the cap's total, as a report says. */
function renownAnswer(character, before, after) {
  return {
    character, xp: after, level: renownForXp(after), credited: Math.max(0, after - before), rose: renownForXp(after) > renownForXp(before),
    ...(after >= RENOWN_XP_MAX ? { max: true } : {}),
  };
}

/**
 * A COURT WRIT TAKEN (PROF0 11: filled whole, once, by the first to deliver - so taking it is delivering it):
 * `{ character, id, rid }`. Decided by the writ's one UPDATE: still open and today's, the account under its three a day,
 * the Stores holding the units, the balance with room for the pay. Then the units out (bought first), the pay struck
 * (`writ`, the second faucet - its line id the writ's own, under the service's `:`), the XP to the profession that
 * gathers the material (twice the pay), the Renown to the character.
 */
export async function deliverWrit(ctx, player, env, { character, id, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const day = utcDay(nowS);
  const answer = async (w, extra = {}) => {
    const m = material(w.material);
    const prof = professionOfFamily(m?.family);
    return {
      ok: true, ...extra, writ: writView(w, player.id), pay: Number(w.pay), balance: await balanceOf(db, player.id),
      track: prof ? trackView(await trackRow(db, player.id, w.filled_char, prof), prof, nowS) : null,
      store: await storeOf(db, player.id, w.filled_char, w.material),
      today: { filled: await writsToday(db, player.id, day), max: COURT_WRITS_PER_DAY },
    };
  };
  const prior = await db.prepare('SELECT * FROM writs WHERE filled_by = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) return answer(prior, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (!marksOpenFor(player, env)) return { error: 'marks-closed' };
  const w = typeof id === 'string' ? await db.prepare('SELECT * FROM writs WHERE id = ?').bind(id).first() : null;
  if (!w) return { error: 'no-writ' };
  // AUDIT 29 A16: a writ one filled oneself (its answer lost, the page reloaded, a new id) is answered as one's own
  if (w.filled_by === player.id) return answer(w, { repeat: true });
  if (Number(w.day) !== day || Number(w.expires_at) <= nowS) return { error: 'writ-expired' };
  if (w.filled_by) return { error: 'writ-taken' };
  if (await overRate(ctx, `prof:${player.id}`, PROF_OPS_MAX, PROF_OPS_WINDOW_S)) return { error: 'prof-rate' };
  const m = material(w.material);
  const prof = professionOfFamily(m?.family);
  const before = Number((await db.prepare('SELECT xp FROM renown_tracks WHERE player = ?1 AND char_id = ?2').bind(player.id, character).first())?.xp ?? 0);
  const nonce = mintId(rand);
  const filled = 'EXISTS (SELECT 1 FROM writs WHERE id = ?5 AND n = ?6)';
  await db.batch([
    // THE DECISION - AUDIT 29 A12: never a second writ under one id (the unique index threw on a same-id race)
    db.prepare(`UPDATE writs SET filled_by = ?1, filled_char = ?2, filled_at = ?3, rid = ?4, n = ?6
      WHERE id = ?5 AND filled_by IS NULL AND expires_at > ?3
        AND NOT EXISTS (SELECT 1 FROM writs WHERE filled_by = ?1 AND rid = ?4)
        AND (SELECT COUNT(*) FROM writs WHERE filled_by = ?1 AND day = ?7) < ?8
        AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = writs.material), 0) >= writs.qty
        AND COALESCE((SELECT balance FROM marks WHERE account = ?1), 0) + writs.pay <= ?9`)
      .bind(player.id, character, nowS, rid, id, nonce, day, COURT_WRITS_PER_DAY, MARKS_MAX),
    // the units out of the Stores, bought first
    ...spendStatements(db, {
      player: player.id, character, materialSql: '(SELECT material FROM writs WHERE id = ?3 AND n = ?4)',
      qtySql: '(SELECT qty FROM writs WHERE id = ?3 AND n = ?4)', guard: 'EXISTS (SELECT 1 FROM writs WHERE id = ?3 AND n = ?4)', binds: [id, nonce],
    }),
    // the pay, struck - the ledger's trigger credits the balance
    db.prepare(`INSERT OR IGNORE INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
      SELECT 'mint', NULL, 'account', ?1, 'writ', pay, ?7, ?3, ?1, NULL, 'writ:' || id FROM writs WHERE id = ?5 AND n = ?6`)
      .bind(player.id, character, nowS, rid, id, nonce, day),
    // the XP to the profession that gathers it
    db.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at)
      SELECT ?1, ?2, ?7, MIN(?8, ?9), ?3 WHERE ${filled}
      ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = MIN(?8, prof_tracks.xp + excluded.xp), updated_at = excluded.updated_at`)
      .bind(player.id, character, nowS, rid, id, nonce, prof ?? 'herbalism', PROF_XP_MAX, writXp(Number(w.pay))),
    // the Renown to the character (its track made where it has none, under RENOWN_TRACKS_MAX) - RENOWN-CHAR: its own
    // again, where MERGE 2 had paid RENOWN-ACCOUNT's one track; outside the hour's bound, as the writ is the service's own
    // to prove: its units spent from the Stores above
    db.prepare(`UPDATE renown_tracks SET xp = MIN(?7, xp + (SELECT renown FROM writs WHERE id = ?5 AND n = ?6)), updated_at = ?3
      WHERE player = ?1 AND char_id = ?2 AND ${filled}`).bind(player.id, character, nowS, rid, id, nonce, RENOWN_XP_MAX),
    db.prepare(`INSERT INTO renown_tracks (player, char_id, name, xp, last_rid, created_at, updated_at)
      SELECT ?1, ?2, NULL, MIN(?7, renown), NULL, ?3, ?3 FROM writs WHERE id = ?5 AND n = ?6 AND renown > 0
        AND NOT EXISTS (SELECT 1 FROM renown_tracks WHERE player = ?1 AND char_id = ?2)
        AND (SELECT COUNT(*) FROM renown_tracks WHERE player = ?1) < ?8`).bind(player.id, character, nowS, rid, id, nonce, RENOWN_XP_MAX, RENOWN_TRACKS_MAX),
  ]);
  const now = await db.prepare('SELECT * FROM writs WHERE id = ?').bind(id).first();
  if (now?.n === nonce) {
    const after = Number((await db.prepare('SELECT xp FROM renown_tracks WHERE player = ?1 AND char_id = ?2').bind(player.id, character).first())?.xp ?? before);
    return answer(now, { renown: renownAnswer(character, before, after) });
  }
  if (now?.filled_by === player.id) return answer(now, { repeat: true });
  const byRid = await db.prepare('SELECT * FROM writs WHERE filled_by = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (byRid) return answer(byRid, { repeat: true });   // the same id raced over another writ - that one is this request
  if (now?.filled_by) return { error: 'writ-taken' };
  if (Number(now?.expires_at ?? 0) <= nowS) return { error: 'writ-expired' };
  if ((await writsToday(db, player.id, day)) >= COURT_WRITS_PER_DAY) return { error: 'writ-cap' };
  const s = await storeOf(db, player.id, character, w.material);
  if (s.own + s.bought < Number(w.qty)) return { error: 'stores-short' };
  return { error: 'marks-full' };
}
