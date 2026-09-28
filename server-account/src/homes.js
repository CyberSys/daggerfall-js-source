// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME1 - THE ONLINE HOMES: ONE OWNER A BUILDING, SERVER-WIDE.
//
// Mac: "Housing is exclusive." The registry is here because a claim
// has to be ONE answer for every client: two players at one door, each
// with their gold out, get one "yours" and one "taken" - never two
// homes. What a home is (its shapes, the cap, who may walk in) is
// src/net/homeLaw.js, which the client reads too.
//
// ═══ REGISTERED ONLY, TO OWN ═══════════════════════════════════════
//
// A guest is a device (MAIL1's reading, letters.js): a cleared browser
// loses it, and a home held by an account nobody can sign back into is
// a building taken out of the world for good. A guest may READ a town -
// the doors say whose a home is to everyone - and may not claim. The
// route's wall refuses first; `claimHome` asks again, because a
// function that trusts its caller's wall is one refactor from having
// none.
//
// ═══ ONE STATEMENT DECIDES ═════════════════════════════════════════
//
// The claim is ONE INSERT that lands only while the character holds
// fewer than HOME_CAP and the building is nobody's (the key is the
// table's primary key, and OR IGNORE turns a taken key into no change
// rather than a thrown error). So two claims racing for one building,
// or one character's two claims racing for its last place, cannot both
// land. What did not land is read back afterwards only to NAME the
// refusal. A claim sent again because its answer was lost finds the
// building already the same character's, and is answered as a claim.
//
// Every write names the owner in its WHERE (`AND player = ?`), so a
// building that is somebody else's is exactly as absent as one that is
// nobody's - one word, `no-home`, for both.
// ═══════════════════════════════════════════════════════════════════
import { accountKind, displayName, overRate } from './accounts.js';
import { CHAR_ID_RE } from './service.js';
import { prepareRealmRecord, realmActFirst, realmAtOf, recordMovedOf, mustChange, dropObjects, REALM_ID_RE } from './realm.js';   // REALM P2.2b; AUDIT REALM L1-F2: the record asked first
import { payFromSave, creditSave } from '../../src/net/realmGoldLaw.js';   // REALM P2.2b: the wallet's own order, over the record
import {
  HOME_CAP, HOME_ENTRY_DEFAULT, HOME_CLAIMS_MAX, HOME_CLAIMS_WINDOW_S, HOME_TOWN_MAX,
  homeMapIdOk, homeBuildingKeyOk, homeRegionOk, homePriceOk, homeEntryOk, homeSaleRefund,
} from '../../src/net/homeLaw.js';

const homeOf = (row) => ({
  mapId: row.map_id, buildingKey: row.building_key, region: row.region, character: row.char_id,
  entry: row.entry, price: row.price, boughtAt: row.bought_at,
});

/** THE CLAIM'S ONE WRITE: the house the character's, while it is nobody's and the character holds fewer than its cap.
 *  `paid` (AUDIT REALM L1-F3, migration 0018): the gold a realm record paid for it - the price, for a realm character's
 *  claim; nothing for any other character's, whose client paid (or did not) out of a save the service never sees. */
const claimStatement = (db, player, { mapId, buildingKey, region, character, price }, nowS, paid = 0) => db.prepare(`INSERT OR IGNORE INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM homes WHERE player = ? AND char_id = ?) < ?`)
  .bind(mapId, buildingKey, player.id, character, displayName(player), region, HOME_ENTRY_DEFAULT, price, nowS, paid, player.id, character, HOME_CAP);

/**
 * REALM P2.2b: A REALM CHARACTER'S CLAIM - the house and the record's payment in ONE batch, the price off the record by
 * the wallet's own order (the region's account last), or neither. Where the record stands is asked before it, by
 * claimHome (realm.js realmActFirst - an act sent again because its answer was lost finds it one on: `seq`, which the
 * client reads as landed); here the house (the character's own already - a second press - is answered as the claim,
 * and pays nothing).
 */
async function realmClaim(ctx, player, at, claim) {
  const { db, bucket, nowS } = ctx;
  const held = await db.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ?').bind(claim.mapId, claim.buildingKey).first();
  if (held) return held.player === player.id && held.char_id === claim.character ? { ok: true, repeat: true, home: homeOf(held), realm: { seq: at.seq } } : { error: 'home-taken' };
  const prep = await prepareRealmRecord(ctx, player.id, at, (save) => (payFromSave(save, claim.price, claim.region) ? null : 'realm-gold'));
  if (prep.error) return prep;
  try {
    await db.batch([...prep.steps, claimStatement(db, player, claim, nowS, claim.price), mustChange(db)]);
  } catch {
    await dropObjects(bucket, [prep.key]);
    const now = await recordMovedOf(db, player.id, at);
    if (now) return now;
    return (await db.prepare('SELECT 1 AS one FROM homes WHERE map_id = ? AND building_key = ?').bind(claim.mapId, claim.buildingKey).first()) ? { error: 'home-taken' } : { error: 'home-cap' };
  }
  await dropObjects(bucket, [prep.prev]);
  const row = await db.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ?').bind(claim.mapId, claim.buildingKey).first();
  return { ok: true, home: homeOf(row), realm: { seq: prep.seq } };
}

/**
 * CLAIM ONE: the building becomes the character's, or the claim is refused and nothing changes. A realm character's
 * record pays for it in the claim's own batch (REALM P2.2b).
 * @param {{db: any, nowS: number, bucket?: any, rand?: any}} ctx
 * @param {any} player  the session's player row
 * @param {{mapId?: unknown, buildingKey?: unknown, region?: unknown, character?: unknown, price?: unknown, realm?: unknown}} claim
 */
export async function claimHome(ctx, player, { mapId, buildingKey, region, character, price, realm = null } = {}) {
  const { db, nowS } = ctx;
  if (accountKind(player) !== 'linked') return { error: 'homes-need-account' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey) || !homeRegionOk(region) || !homePriceOk(price)) return { error: 'bad-home' };
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character)) return { error: 'home-character' };
  const side = await realmActFirst(db, player.id, character, realm);   // AUDIT REALM L1-F2: where the record stands, before the hour's claims
  if (side.error) return side;
  if (await overRate({ db, nowS }, `home:${player.id}`, HOME_CLAIMS_MAX, HOME_CLAIMS_WINDOW_S)) return { error: 'home-rate' };
  if (side.at) return realmClaim(ctx, player, side.at, { mapId, buildingKey, region, character, price });
  const r = await claimStatement(db, player, { mapId, buildingKey, region, character, price }, nowS).run();
  const row = await db.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first();
  if (r?.meta?.changes) return { ok: true, home: homeOf(row) };
  if (row && row.player === player.id && row.char_id === character) return { ok: true, repeat: true, home: homeOf(row) };
  if (row) return { error: 'home-taken' };
  return { error: 'home-cap' };
}

/** DECOR1e: a home's placed pieces and half of what they cost - what its sale gives back for them. */
const decorBackStatement = (db, mapId, buildingKey) => db.prepare(`SELECT COALESCE(SUM(CASE WHEN json_valid(place) THEN 1 ELSE 0 END), 0) AS n,
      COALESCE(SUM(CASE WHEN json_valid(place) THEN CAST(json_extract(place, '$.paid') AS INTEGER) / 2 ELSE 0 END), 0) AS back
      FROM home_decor WHERE map_id = ? AND building_key = ?`).bind(mapId, buildingKey);
/** AUDIT REALM L1-F3: the same pieces, and half of what REALM RECORDS paid for them (home_decor.paid, decor.js) - what a
 *  realm character's sale gives back: never half of a cost a client named that no record paid. */
const realmDecorBackStatement = (db, mapId, buildingKey) => db.prepare(`SELECT COALESCE(SUM(CASE WHEN json_valid(place) THEN 1 ELSE 0 END), 0) AS n,
      COALESCE(SUM(CASE WHEN json_valid(place) THEN paid / 2 ELSE 0 END), 0) AS back
      FROM home_decor WHERE map_id = ? AND building_key = ?`).bind(mapId, buildingKey);

/**
 * REALM P2.2b: A HOME A REALM CHARACTER SELLS - the house given up and the record paid back in ONE batch: Daggerfall's
 * deed share of what the house cost (homeLaw.js homeSaleRefund) and half of what its placed pieces cost, into the bank
 * account of the house's region, as the client's sale pays. The record asked first, as a claim asks it.
 * AUDIT REALM L1-F3: THE CHARACTER'S OWN HOUSE, AND ONLY WHAT A RECORD PAID FOR IT. The sale read any house of the
 * account and credited its client-named price - a claim at the ten-million cap by a character no record stands behind,
 * sold by the realm character's record, made 8,500,000; a house customs carried in from before the realm, the same. The
 * house must be this character's - the batch's DELETE names it, so another character's house moves nothing and the sale
 * is refused - and what comes back is the deed share of `paid` (migration 0018) and half of what records paid for its
 * pieces: a house no record paid for comes back as a house, never as gold. The answer says what the record got
 * (`refund`), which the client takes - never its own sum of a price.
 */
async function realmRelease(ctx, player, at, home) {
  const { db, bucket } = ctx;
  if (!home) return { error: 'no-home' };
  const d = await realmDecorBackStatement(db, home.map_id, home.building_key).first();
  const decorCount = Number(d?.n) || 0, decorBack = Math.max(0, Number(d?.back) || 0);
  const refund = homeSaleRefund(Math.max(0, Number(home.paid) || 0));
  const back = refund + decorBack;
  const prep = await prepareRealmRecord(ctx, player.id, at, (save) => (creditSave(save, back, { bank: home.region }) ? null : 'no-data'));
  if (prep.error) return prep;
  try {
    await db.batch([
      ...prep.steps,
      db.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ? AND player = ? AND char_id = ? AND paid = ?').bind(home.map_id, home.building_key, player.id, at.id, home.paid),
      mustChange(db),
    ]);
  } catch {
    await dropObjects(bucket, [prep.key]);
    return (await recordMovedOf(db, player.id, at)) || { error: 'no-home' };
  }
  await dropObjects(bucket, [prep.prev]);
  return { ok: true, price: home.price, refund, decorCount, decorBack, realm: { seq: prep.seq } };
}

/**
 * GIVE ONE UP: the caller's own, whichever character holds it. Answers what it was bought for (the client pays back
 * Daggerfall's share of it) and, DECOR1e, how many placed pieces went with it and half of what they cost. A realm
 * character's home - or any sale that names a record - pays back into the record, in the release's own batch (REALM
 * P2.2b).
 * @param {{db: any, bucket?: any, rand?: any, nowS?: number}} ctx
 */
export async function releaseHome(ctx, player, { mapId, buildingKey, realm = null } = {}) {
  const { db } = ctx;
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'no-home' };
  const at = realm != null ? realmAtOf(realm) : null;
  if (at) {
    const moved = await recordMovedOf(db, player.id, at);   // AUDIT REALM L1-F2: where the record stands, before the house is looked for
    if (moved) return moved;
  }
  const home = await db.prepare('SELECT * FROM homes WHERE map_id = ? AND building_key = ? AND player = ?').bind(mapId, buildingKey, player.id).first();
  if (realm != null || (typeof home?.char_id === 'string' && REALM_ID_RE.test(home.char_id))) {
    return at ? realmRelease(ctx, player, at, home) : { error: 'realm-needed' };
  }
  // DECOR1e: the home's placed pieces go with it (decor.js - the cascade), and half of what each cost comes back, as
  // removing it would give (net/decorLaw.js decorSaleBack: truncated, a piece at a time). Read in the SAME batch as
  // the release, so no piece is placed between the sum and the going - and answered only when the release is the
  // caller's; a record that is not JSON is no piece and counts nothing.
  const [pieces, gone] = await db.batch([
    decorBackStatement(db, mapId, buildingKey),
    db.prepare('DELETE FROM homes WHERE map_id = ? AND building_key = ? AND player = ? RETURNING price')
      .bind(mapId, buildingKey, player.id),
  ]);
  const row = gone?.results?.[0];
  if (!row) return { error: 'no-home' };
  const d = pieces?.results?.[0];
  return { ok: true, price: row.price, decorCount: Number(d?.n) || 0, decorBack: Math.max(0, Number(d?.back) || 0) };
}

/**
 * WHO MAY WALK IN, as the owner sets it (homeLaw.js HOME_ENTRIES).
 * @param {{db: any}} ctx
 */
export async function setHomeEntry({ db }, player, { mapId, buildingKey, entry } = {}) {
  if (!homeEntryOk(entry)) return { error: 'bad-entry' };
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'no-home' };
  const r = await db.prepare('UPDATE homes SET entry = ? WHERE map_id = ? AND building_key = ? AND player = ?')
    .bind(entry, mapId, buildingKey, player.id).run();
  return r?.meta?.changes ? { ok: true, entry } : { error: 'no-home' };
}

/**
 * A TOWN'S HOMES, for everyone standing in it - guests too: whose each is (the handle the relay signs), who may walk
 * in, and which are the caller's own. Never the price, never another account's character.
 * @param {{db: any}} ctx
 */
export async function homesInTown({ db }, player, { mapId } = {}) {
  if (!homeMapIdOk(mapId)) return { error: 'bad-home' };
  const { results = [] } = await db.prepare(`SELECT building_key, player, char_id, owner_name, entry FROM homes
    WHERE map_id = ? ORDER BY building_key LIMIT ?`).bind(mapId, HOME_TOWN_MAX).all();
  return {
    mapId,
    homes: results.map((h) => {
      const mine = h.player === player.id;
      return { buildingKey: h.building_key, owner: h.owner_name, entry: h.entry, mine, ...(mine ? { character: h.char_id } : {}) };
    }),
  };
}

/**
 * THE CALLER'S OWN, every character's, oldest first - and the cap each character is held to.
 * @param {{db: any}} ctx
 */
export async function homesOf({ db }, player) {
  const { results = [] } = await db.prepare('SELECT * FROM homes WHERE player = ? ORDER BY bought_at, map_id, building_key')
    .bind(player.id).all();
  return { homes: results.map(homeOf), cap: HOME_CAP };
}
