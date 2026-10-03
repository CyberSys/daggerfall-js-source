// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF12 (2026-10-02, Mac: "2 and 4"; "lets just finish out everything
// before merge") - ALCHEMY'S BREW AND ENCHANTING'S DISENCHANT, AS THE
// SERVICE KEEPS THEM (bible/06-Systems/Professions-Arc.md 3.3, 4.3, 9.3,
// 37; the law is src/net/alchemyLaw.js, which the client reads too).
//
// TWO DOORS, ONE BOOK (9.3). DFU's own potion maker and item maker stay
// 1:1 and earn nothing online: the service never sees them. What it sees
// is the BREWING ACT - the cauldron's ingredients out of the Stores, DFU's
// own recipe law run on them (POTION_RECIPES and its hash, imported) - and
// DISENCHANTING a piece it minted (its provenance) into Arcane Essence.
//
// The professions' own laws stand (professions.js): a registered
// account's character, the switch, one statement deciding each act
// against the rows as they stand with a fresh nonce, a request asked twice
// answered from its row (`repeat`), bought units spent first, the
// crafter's limit on the XP, every clock an argument.
// ═══════════════════════════════════════════════════════════════════
import { mintId, overRate } from './accounts.js';
import {
  asks, shut, dice, trackView, trackRow, storeOf, spendableSql, spendStatements, seatStepsFor,
} from './professions.js';
import { rankOfXp, specsAt, craftXpCap, STORES_MAX, PROF_OPS_MAX, PROF_OPS_WINDOW_S, ARCANE_ESSENCE } from '../../src/net/professionLaw.js';
import { FIRST_CRAFT_XP, recipeById, PROVENANCE_RE } from '../../src/net/recipeLaw.js';
import {
  potionById, brewSpends, brewCount, potentChance, potentPct, brewXp, brewFirstPays, DISTILLER,
  piecePoints, essenceOf, disenchantXp, DISENCHANTER,
} from '../../src/net/alchemyLaw.js';

const HERB_RE = /^p[12]:\d+$/;

/** The character's tracks, their ranks, and the choices one stands under now. */
async function tracksOf(db, player, character, profession, nowS) {
  const { results: tracks = [] } = await db.prepare('SELECT * FROM prof_tracks WHERE player = ?1 AND char_id = ?2').bind(player, character).all();
  const ranks = Object.fromEntries(tracks.map((t) => [t.profession, rankOfXp(Number(t.xp))]));
  return { ranks, rank: ranks[profession] ?? 0, specs: specsAt(tracks.find((t) => t.profession === profession), nowS) };
}

// ─── THE BREW (9.3) ──────────────────────────────────────────────────

/** A brew's answer, read back from its row. */
async function brewAnswer(db, player, row, nowS, extra = {}) {
  /** @type {string[]} */
  const keys = (() => { try { const k = JSON.parse(row.keys); return Array.isArray(k) ? k : []; } catch { return []; } })();
  return {
    ok: true, ...extra, potion: row.potion, keys, count: Number(row.count), potent: Number(row.potent), unbruised: Number(row.unbruised),
    steps: Number(row.steps), xp: Number(row.xp), first: Number(row.first) === 1,
    track: trackView(await trackRow(db, player.id, row.char_id, 'alchemy'), 'alchemy', nowS),
    stores: await Promise.all([...new Set(keys)].map((k) => storeOf(db, player.id, row.char_id, k))),
  };
}

/**
 * A BREW: `{ character, potion, keys, seat?, rid }` - one of DFU's twenty (alchemyLaw POTIONS, by its recipe's name),
 * `keys` the cauldron as the Stores hold it (an herb's group the brewer's), which DFU's own law must answer with that very
 * potion (brewSpends: the templates' sorted hash its key - `bad-brew` else); the potion's rank (its price's tier -
 * `prof-rank`). The service cannot see the alchemy station (as it cannot see the forge): the inputs are the Stores' and
 * their units the bound. `seat` the town the station stands in - its holder's members brew there under its Apothecary's
 * steps (professions.js seatStepsFor; alchemyLaw potentChance: +10 a step).
 * POTENT is rolled here, once a brew: the rank's chance (10 at Expert, 20 at Master), +5 an unbruised herb the brew spends
 * (prof_unbruised, its units reckoned against the OWN units spent - bought ones are spent first), a Distiller's +10, the
 * hall's; its share +25, a Master Alchemist's +40. The potions a brew makes: brewCount (1; 2 at Journeyman, a Brewer's 3;
 * 3 at Master). XP 20 x the potion's tier, +500 the character's first of it (not for one made wholly of the Apothecaries'
 * goods - brewFirstPays), under the crafter's limit. Decided by the brew's own INSERT: every input held (never gold's).
 * Then the inputs out (bought first), the unbruised count down by what it reckoned, the XP in. The potions are the
 * client's to mint on the answer (DFU's own potion, potions.js's key; a Potent one carries its share).
 */
export async function brewAtStation(ctx, player, env, { character, potion: id, keys, rid, seat = null } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const prior = await db.prepare('SELECT * FROM prof_brews WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) return brewAnswer(db, player, prior, nowS, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  const potion = potionById(id);
  if (!potion) return { error: 'bad-recipe' };
  const inputs = brewSpends(potion, keys);
  if (!inputs) return { error: 'bad-brew' };   // DFU's law answers no such potion for that cauldron
  if (await overRate(ctx, `prof:${player.id}`, PROF_OPS_MAX, PROF_OPS_WINDOW_S)) return { error: 'prof-rate' };
  const { ranks, rank, specs } = await tracksOf(db, player.id, character, 'alchemy', nowS);
  if (rank < potion.rank) return { error: 'prof-rank' };
  const cap = craftXpCap('alchemy', ranks);
  const steps = await seatStepsFor(db, player.id, character, seat, 'alchemy', nowS);
  // THE UNBRUISED HERBS (4.3): each herb's own units this brew spends (bought ones go first), at most what was picked
  // unbruised
  let unbruised = 0;
  const reckoned = [];
  for (const inp of inputs) {
    if (!HERB_RE.test(inp.key)) continue;
    const st = await storeOf(db, player.id, character, inp.key);
    const ownSpent = Math.max(0, Math.min(inp.n, inp.n - st.bought));
    const row = await db.prepare('SELECT qty FROM prof_unbruised WHERE player = ?1 AND char_id = ?2 AND material = ?3').bind(player.id, character, inp.key).first();
    const u = Math.min(ownSpent, Number(row?.qty ?? 0));
    if (u > 0) { unbruised += u; reckoned.push({ key: inp.key, n: u }); }
  }
  const chance = potentChance(rank, { distiller: specs[50] === DISTILLER, unbruised, steps });
  const potent = dice(rand) * 100 < chance ? potentPct(specs[100]) : 0;
  const count = brewCount(rank, specs[50]);
  const xp = brewXp(potion, rank, false);
  const nonce = mintId(rand);
  // ?1 player ?2 character ?3 rid ?4 potion ?5 keys ?6 count ?7 potent ?8 unbruised ?9 steps ?10 xp ?11 the first time's
  // ?12 now ?13 nonce; the inputs ?14 on, two a one
  const binds = [player.id, character, rid, potion.id, JSON.stringify(keys), count, potent, unbruised, steps, xp, brewFirstPays(potion) ? FIRST_CRAFT_XP : 0, nowS, nonce];
  const held = [];
  inputs.forEach((inp, i) => {
    binds.push(inp.key, inp.n);
    held.push(`${spendableSql('?1', '?2', `?${14 + 2 * i}`)} >= ?${15 + 2 * i}`);   // GOLD-MARKET: never gold's units
  });
  const decided = 'EXISTS (SELECT 1 FROM prof_brews WHERE player = ?1 AND rid = ?5 AND n = ?6)';
  await db.batch([
    // THE DECISION: every input held - and the XP what the track can take under the crafter's limit, the first brew's 500
    // laid on when the character has brewed none of the potion
    db.prepare(`INSERT OR IGNORE INTO prof_brews (player, rid, char_id, potion, keys, count, potent, unbruised, steps, xp, first, at, n)
      SELECT ?1, ?3, ?2, ?4, ?5, ?6, ?7, ?8, ?9,
        MAX(0, MIN(?10 + f * ?11, ${Number(cap)} - COALESCE((SELECT xp FROM prof_tracks WHERE player = ?1 AND char_id = ?2 AND profession = 'alchemy'), 0))),
        f, ?12, ?13
      FROM (SELECT CASE WHEN EXISTS (SELECT 1 FROM prof_brews WHERE player = ?1 AND char_id = ?2 AND potion = ?4) THEN 0 ELSE 1 END AS f)
      WHERE ${held.join(' AND ')}`).bind(...binds),
    // the cauldron out of the Stores, each bought first
    ...inputs.flatMap((inp) => spendStatements(db, {
      player: player.id, character, materialSql: '?3', qtySql: '?4', guard: decided, binds: [inp.key, inp.n, rid, nonce],
    })),
    // the unbruised herbs it reckoned, spent with it
    ...reckoned.map((u) => db.prepare(`UPDATE prof_unbruised SET qty = MAX(0, qty - ?4)
      WHERE player = ?1 AND char_id = ?2 AND material = ?3 AND EXISTS (SELECT 1 FROM prof_brews WHERE player = ?1 AND rid = ?5 AND n = ?6)`)
      .bind(player.id, character, u.key, u.n, rid, nonce)),
    // the XP the decision credited, under the crafter's limit
    db.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at)
      SELECT ?1, ?2, 'alchemy', MIN(?4, xp), ?5 FROM prof_brews WHERE player = ?1 AND rid = ?3 AND n = ?6
      ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = MAX(prof_tracks.xp, MIN(?4, prof_tracks.xp + excluded.xp)), updated_at = excluded.updated_at`)
      .bind(player.id, character, rid, cap, nowS, nonce),
  ]);
  const made = await db.prepare('SELECT * FROM prof_brews WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (made?.n === nonce) return brewAnswer(db, player, made, nowS);
  if (made) return brewAnswer(db, player, made, nowS, { repeat: true });
  for (const inp of inputs) {
    const st = await storeOf(db, player.id, character, inp.key);
    if (st.own + st.bought < inp.n) return { error: st.own + st.bought + (st.gold ?? 0) >= inp.n ? 'stores-gold' : 'stores-short', material: inp.key };   // GOLD-MARKET
  }
  return { error: 'stores-short' };
}

// ─── DISENCHANTING (9.3) ─────────────────────────────────────────────

/** A disenchant's answer, read back from its row. */
async function disenchantAnswer(db, player, row, nowS, extra = {}) {
  return {
    ok: true, ...extra, provenance: row.provenance, recipe: row.recipe, points: Number(row.points), essence: Number(row.essence),
    origin: row.origin, xp: Number(row.xp),
    track: trackView(await trackRow(db, player.id, row.char_id, 'enchanting'), 'enchanting', nowS),
    store: await storeOf(db, player.id, row.char_id, ARCANE_ESSENCE.key),
  };
}

/**
 * A DISENCHANT: `{ character, provenance, rid }` - a crafted piece this account holds (its provenance id - "Loot cannot be
 * disenchanted": a save item's Essence would be a pack item entering the Stores, law 3) becomes Arcane Essence, ONE PER 100
 * ENCHANTMENT POINTS IT CARRIED (alchemyLaw piecePoints - its DFU template's budget, a jewel's own, read from the service's
 * own record of it, never the client's word), a Disenchanter's twice (3.3), into the Stores, and is gone: its `products`
 * row deleted in the same batch, so it lists, auctions and answers a commission no more. Refused: no such piece
 * (`prof-no-piece`), another's (`prof-not-yours`), one listed, on the road or standing in a home (`prof-piece-busy`), one
 * whose points make no Essence (`prof-no-essence`), a full Stores (`stores-full`). The Essence's origin: OWN where this
 * character made it and nobody bought it (PROF0 7: "Essence from an own provenance item (one this character made, never
 * sold)"), GOLD where it was bought with gold (GOLD-MARKET's wall), else BOUGHT. Enchanting XP: alchemyLaw disenchantXp (5
 * x the rank's tier an Essence before the doubling), under the crafter's limit. The client takes the piece out of its pack
 * on the answer.
 */
export async function disenchantPiece(ctx, player, env, { character, provenance, rid } = {}) {
  const { db, nowS, rand } = ctx;
  const refused = asks(player, { character, rid });
  if (refused) return refused;
  const prior = await db.prepare('SELECT * FROM prof_disenchants WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (prior) return disenchantAnswer(db, player, prior, nowS, { repeat: true });
  const closed = shut(player, env);
  if (closed) return closed;
  if (typeof provenance !== 'string' || !PROVENANCE_RE.test(provenance)) return { error: 'bad-piece' };
  if (await overRate(ctx, `prof:${player.id}`, PROF_OPS_MAX, PROF_OPS_WINDOW_S)) return { error: 'prof-rate' };
  const p = await db.prepare('SELECT * FROM products WHERE provenance = ?1').bind(provenance).first();
  if (!p) return { error: 'prof-no-piece' };
  if (p.owner !== player.id) return { error: 'prof-not-yours' };
  const r = recipeById(p.recipe);
  const points = piecePoints(r, p.hand == null ? null : Number(p.hand));
  const { ranks, rank, specs } = await tracksOf(db, player.id, character, 'enchanting', nowS);
  const base = essenceOf(points);
  const essence = essenceOf(points, specs[50] === DISENCHANTER);
  if (essence < 1) return { error: 'prof-no-essence' };
  const origin = p.bought_with === 'gold' ? 'gold' : p.char_id === character && p.bought_with == null ? 'own' : 'bought';
  const cap = craftXpCap('enchanting', ranks);
  const xp = disenchantXp(rank, base);
  const nonce = mintId(rand);
  const decided = 'EXISTS (SELECT 1 FROM prof_disenchants WHERE player = ?1 AND rid = ?2 AND n = ?3)';
  await db.batch([
    // THE DECISION: the piece this account's, on no listing, no road and in no home, the Essence's room - and the XP what
    // the track can take under the crafter's limit
    db.prepare(`INSERT OR IGNORE INTO prof_disenchants (player, rid, char_id, provenance, recipe, points, essence, origin, xp, at, n)
      SELECT ?1, ?3, ?2, ?4, ?5, ?6, ?7, ?8,
        MAX(0, MIN(?9, ${Number(cap)} - COALESCE((SELECT xp FROM prof_tracks WHERE player = ?1 AND char_id = ?2 AND profession = 'enchanting'), 0))),
        ?10, ?11
      WHERE EXISTS (SELECT 1 FROM products WHERE provenance = ?4 AND owner = ?1 AND listed = 0)
        AND NOT EXISTS (SELECT 1 FROM market_deliveries WHERE provenance = ?4 AND collected = 0)
        AND NOT EXISTS (SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = ?4)
        AND COALESCE((SELECT SUM(qty) FROM prof_stores WHERE player = ?1 AND char_id = ?2 AND material = ?12), 0) + ?7 <= ?13`)
      .bind(player.id, character, rid, provenance, p.recipe, points, essence, origin, xp, nowS, nonce, ARCANE_ESSENCE.key, STORES_MAX),
    // the piece gone
    db.prepare(`DELETE FROM products WHERE provenance = ?4 AND ${decided}`).bind(player.id, rid, nonce, provenance),
    // the Essence in, of its origin
    db.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty)
      SELECT player, char_id, ?4, origin, essence FROM prof_disenchants WHERE player = ?1 AND rid = ?2 AND n = ?3
      ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = prof_stores.qty + excluded.qty`).bind(player.id, rid, nonce, ARCANE_ESSENCE.key),
    // the XP the decision credited
    db.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at)
      SELECT ?1, ?2, 'enchanting', MIN(?4, xp), ?5 FROM prof_disenchants WHERE player = ?1 AND rid = ?3 AND n = ?6
      ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = MAX(prof_tracks.xp, MIN(?4, prof_tracks.xp + excluded.xp)), updated_at = excluded.updated_at`)
      .bind(player.id, character, rid, cap, nowS, nonce),
  ]);
  const made = await db.prepare('SELECT * FROM prof_disenchants WHERE player = ?1 AND rid = ?2').bind(player.id, rid).first();
  if (made?.n === nonce) return disenchantAnswer(db, player, made, nowS);
  if (made) return disenchantAnswer(db, player, made, nowS, { repeat: true });
  const now = await db.prepare('SELECT owner, listed FROM products WHERE provenance = ?1').bind(provenance).first();
  if (!now) return { error: 'prof-no-piece' };   // another request took it first
  if (now.owner !== player.id) return { error: 'prof-not-yours' };
  const room = await storeOf(db, player.id, character, ARCANE_ESSENCE.key);
  if (room.own + room.bought + (room.gold ?? 0) + essence > STORES_MAX) return { error: 'stores-full', material: ARCANE_ESSENCE.key };
  return { error: 'prof-piece-busy' };
}
