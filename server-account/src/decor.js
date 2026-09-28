// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR1 - AN ONLINE HOME'S DECOR, KEPT WHERE EVERY VISITOR READS IT.
//
// Mac: decor is "Gold per placement", the catalogue "Everything
// Daggerfall furnishes". An online home's pieces live here, so the room
// its owner furnished is the room every visitor walks into; the offline
// house's and ship's live in the save (the client's). What a piece is -
// its shape, its bounds, its price - is src/net/decorLaw.js, which the
// client reads too. The gold is the save's, as all of it is: this keeps
// WHERE the pieces stand, and who may move them.
//
// ═══ ONE PIECE A WRITE ═════════════════════════════════════════════
//
// A room is furnished a piece at a time and every write is one piece -
// placed, moved, removed - so a body stays far inside the service's
// 4 KiB (service.js MAX_BODY_BYTES) however full the room grows, and two
// of the owner's tabs moving two chairs cannot overwrite each other's.
//
// ═══ THE OWNER, IN THE SAME STATEMENT ══════════════════════════════
//
// Every write names the home's owner - the account AND the character,
// a home being one character's (HOME1) - inside its own WHERE, so a
// piece in somebody else's home is exactly as absent as none (`no-home`
// to place, `no-decor` to move or remove). A placement lands only while
// the home holds fewer than DECOR_CAP. WHAT a piece is - a model, or a
// flat - is written once, at the placement, into columns no later
// statement touches: a move rewrites `place` alone.
// ═══════════════════════════════════════════════════════════════════
import { accountKind, overRate } from './accounts.js';
import { CHAR_ID_RE } from './service.js';
import { homeMapIdOk, homeBuildingKeyOk } from '../../src/net/homeLaw.js';
import { DECOR_CAP, DECOR_ID_RE, DECOR_OPS_MAX, DECOR_OPS_WINDOW_S, DECOR_STATION_FEES, decorPieceOf, decorPlaceOf, decorHiddenOf, decorRefund } from '../../src/net/decorLaw.js';
import { prepareRealmRecord, realmSideOf, recordMovedOf, mustChange, dropObjects } from './realm.js';   // REALM P2.2b
import { payFromSave, creditSave } from '../../src/net/realmGoldLaw.js';   // REALM P2.2b: the wallet's own order, over the record

/**
 * REALM P2.2b: WHAT A PIECE'S CHANGE COSTS, as the client's wallet pays it - placed: what it cost (`paid`); grown: the
 * difference, shrunk: half the difference back (net/decorLaw.js decorRescale's arithmetic, off the service's own record
 * of what it cost); made a station or changed to another: that station's licence (DECOR_STATION_FEES, never given back);
 * removed: half of what it cost. Answers the gold the record gains (negative: pays).
 */
export function decorGoldDelta(/** @type {any} */ was, /** @type {any} */ now) {
  const paidWas = was ? Math.max(0, Number(was.paid) || 0) : 0;
  if (!now) return decorRefund(paidWas);
  const paidNow = Math.max(0, Number(now.paid) || 0);
  let delta = paidNow >= paidWas ? paidWas - paidNow : Math.trunc((paidWas - paidNow) / 2);
  if (now.station && now.station !== (was?.station ?? null)) delta -= DECOR_STATION_FEES[now.station] ?? 0;
  return delta;
}

/** REALM P2.2b: a realm character names its record only when gold moves - a free write (one's own item, a piece moved
 *  and no bigger, a station unmade) is no act on the record. Answers realmSideOf's answer, or a refusal's. */
function decorSideOf(/** @type {unknown} */ character, /** @type {unknown} */ realm, /** @type {number} */ delta) {
  const side = realmSideOf(character, realm);
  if (side.error === 'realm-needed' && realm == null && delta === 0) return { at: null };
  return side;
}

/** REALM P2.2b: the home's region - its bank account is the one the decor wallet pays from. */
const homeRegionOf = async (db, mapId, buildingKey) => (await db.prepare('SELECT region FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first())?.region ?? null;

/**
 * REALM P2.2b: A REALM CHARACTER'S DECOR WRITE AND ITS GOLD, one batch: the record paid or credited `delta` (the
 * wallet's order, the home's region's account last) with `write` - the piece's own statement - each guarded; both or
 * neither. The record is asked first, so a write sent again because its answer was lost finds it one on (`seq`, which
 * the client reads as landed). `after()` answers the piece as it now stands.
 */
async function realmDecorWrite(ctx, player, at, { mapId, buildingKey, delta, write, after, refusal }) {
  const { db, bucket } = ctx;
  const moved = await recordMovedOf(db, player.id, at);
  if (moved) return moved;
  const region = await homeRegionOf(db, mapId, buildingKey);
  const prep = await prepareRealmRecord(ctx, player.id, at, (save) => (delta < 0
    ? (payFromSave(save, -delta, region) ? null : 'realm-gold')
    : (creditSave(save, delta) ? null : 'no-data')));
  if (prep.error) return prep;
  try {
    await db.batch([...prep.steps, write, mustChange(db)]);
  } catch {
    await dropObjects(bucket, [prep.key]);
    return (await recordMovedOf(db, player.id, at)) || { error: await refusal() };
  }
  await dropObjects(bucket, [prep.prev]);
  const piece = await after();
  return piece ? { ok: true, piece, realm: { seq: prep.seq } } : { error: 'no-decor' };
}

/** The home is the caller's character's: map, key, account, character. */
const OWNS = 'EXISTS (SELECT 1 FROM homes WHERE map_id = ? AND building_key = ? AND player = ? AND char_id = ?)';
const placeJson = ({ pos, rot, scale, light, storage, paid, station }) => JSON.stringify({ pos, rot, scale, light, storage, paid, ...(station ? { station } : {}) });   // HOME-STATIONS: the craft, when it serves one

/** A stored row as a piece - projected again on the way out, so a row the law would refuse is never handed out.
 *  DECOR2a: `item` (migration 0012) is the owner's own item's descriptor, or NULL. */
function pieceOfRow(row) {
  let place = null;
  let item = null;
  try { place = JSON.parse(row.place); } catch { place = null; }
  if (!place || typeof place !== 'object') return null;
  if (row.item != null) {
    try { item = JSON.parse(row.item); } catch { return null; }
  }
  return decorPieceOf({
    ...place, id: row.id,
    model: row.model ?? null,
    flat: row.model == null ? [row.flat_archive, row.flat_record] : null,
    item,
  });
}

/** The shared first steps of every write: a registered account, a home named, a character, the hour's writes. */
async function writeDoor({ db, nowS }, player, { mapId, buildingKey, character }) {
  if (accountKind(player) !== 'linked') return 'homes-need-account';
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return 'bad-home';
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character)) return 'home-character';
  if (await overRate({ db, nowS }, `decor:${player.id}`, DECOR_OPS_MAX, DECOR_OPS_WINDOW_S)) return 'decor-rate';
  return null;
}

/**
 * A HOME'S PIECES, for everyone standing in it - guests too, the room being the same room to all of them. Oldest
 * first; never more than the cap.
 * @param {{db: any}} ctx
 */
export async function decorOf({ db }, _player, { mapId, buildingKey } = {}) {
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return { error: 'bad-home' };
  const { results = [] } = await db.prepare(`SELECT * FROM home_decor WHERE map_id = ? AND building_key = ?
    ORDER BY placed_at, id LIMIT ?`).bind(mapId, buildingKey, DECOR_CAP).all();
  return { mapId, buildingKey, pieces: results.map(pieceOfRow).filter(Boolean), hidden: await hiddenOf(db, mapId, buildingKey) };
}

/** BASE-HIDE: what the home's owner took out of the room (migration 0015) - projected on the way out, so a list the law
 *  would refuse is handed out as none. */
async function hiddenOf(db, mapId, buildingKey) {
  const row = await db.prepare('SELECT keys FROM home_hidden WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first();
  if (!row) return [];
  try { return decorHiddenOf(JSON.parse(row.keys)) ?? []; } catch { return []; }
}

/**
 * BASE-HIDE: WHAT IS TAKEN OUT OF THE ROOM, written whole - the list the owner's client now stands (decorLaw.js
 * decorHiddenOf: every name a built-in piece's, none twice, at most DECOR_HIDDEN_CAP). The owner's alone, in the same
 * statement; free, so it asks the hour's writes as a placement does and nothing else.
 * @param {{db: any, nowS: number}} ctx
 */
export async function hideDecorBase(ctx, player, { mapId, buildingKey, character, keys } = {}) {
  const shut = await writeDoor(ctx, player, { mapId, buildingKey, character });
  if (shut) return { error: shut };
  const hidden = decorHiddenOf(keys);
  if (!hidden) return { error: 'bad-decor' };
  const { db } = ctx;
  const r = await db.prepare(`INSERT INTO home_hidden (map_id, building_key, keys) SELECT ?, ?, ? WHERE ${OWNS}
    ON CONFLICT (map_id, building_key) DO UPDATE SET keys = excluded.keys`)
    .bind(mapId, buildingKey, JSON.stringify(hidden), mapId, buildingKey, player.id, character).run();
  if (!r?.meta?.changes) return { error: 'no-home' };
  return { ok: true, hidden };
}

/**
 * PLACE ONE: it stands in the owner's home, or it is refused and nothing changes. A placement sent again because its
 * answer was lost finds the same piece standing and is answered as the placement.
 * @param {{db: any, nowS: number}} ctx
 */
export async function placeDecor(ctx, player, { mapId, buildingKey, character, piece, realm = null } = {}) {
  const shut = await writeDoor(ctx, player, { mapId, buildingKey, character });
  if (shut) return { error: shut };
  const p = decorPieceOf(piece);
  if (!p) return { error: 'bad-decor' };
  const delta = decorGoldDelta(null, p);
  const side = decorSideOf(character, realm, delta);   // REALM P2.2b
  if (side.error) return side;
  const { db, nowS } = ctx;
  const insert = db.prepare(`INSERT OR IGNORE INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${OWNS} AND (SELECT COUNT(*) FROM home_decor WHERE map_id = ? AND building_key = ?) < ?`)
    .bind(mapId, buildingKey, p.id, p.model, p.flat?.[0] ?? null, p.flat?.[1] ?? null, placeJson(p), nowS, p.item ? JSON.stringify(p.item) : null,
      mapId, buildingKey, player.id, character, mapId, buildingKey, DECOR_CAP);
  if (side.at && delta !== 0) {
    // REALM P2.2b: the piece and what it cost, together - a placement sent again finds the record one on and is answered so
    const moved = await recordMovedOf(db, player.id, side.at);
    if (moved) return moved;
    const had = await db.prepare('SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?').bind(mapId, buildingKey, p.id).first();
    if (had) return JSON.stringify(pieceOfRow(had)) === JSON.stringify(p) ? { ok: true, repeat: true, piece: pieceOfRow(had), realm: { seq: side.at.seq } } : { error: 'decor-taken' };
    return realmDecorWrite(ctx, player, side.at, {
      mapId, buildingKey, delta, write: insert,
      after: async () => pieceOfRow(await db.prepare('SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?').bind(mapId, buildingKey, p.id).first()),
      refusal: async () => ((await db.prepare(`SELECT ${OWNS} AS owns`).bind(mapId, buildingKey, player.id, character).first())?.owns ? 'decor-cap' : 'no-home'),
    });
  }
  const r = await insert.run();
  if (r?.meta?.changes) return { ok: true, piece: p };
  const owns = await db.prepare(`SELECT ${OWNS} AS owns`).bind(mapId, buildingKey, player.id, character).first();
  if (!owns?.owns) return { error: 'no-home' };
  const row = await db.prepare('SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?').bind(mapId, buildingKey, p.id).first();
  if (row) {
    const had = pieceOfRow(row);
    return had && JSON.stringify(had) === JSON.stringify(p) ? { ok: true, repeat: true, piece: had } : { error: 'decor-taken' };
  }
  return { error: 'decor-cap' };
}

/**
 * MOVE ONE - where it stands, its turn, its scale, its light, whether it holds things, what it has cost - never what
 * it is. The owner's alone.
 * @param {{db: any, nowS: number}} ctx
 */
export async function moveDecor(ctx, player, { mapId, buildingKey, character, id, place, realm = null } = {}) {
  const shut = await writeDoor(ctx, player, { mapId, buildingKey, character });
  if (shut) return { error: shut };
  if (typeof id !== 'string' || !DECOR_ID_RE.test(id)) return { error: 'no-decor' };
  const pl = decorPlaceOf(place);
  if (!pl) return { error: 'bad-decor' };
  const named = realm == null ? null : realmSideOf(character, realm);   // REALM P2.2b: a record named is asked first
  if (named?.error) return named;
  const { db } = ctx;
  const moved = named?.at ? await recordMovedOf(db, player.id, named.at) : null;   // a move sent again after it landed: said so first
  if (moved) return moved;
  const row = await db.prepare(`SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ? AND ${OWNS}`)
    .bind(mapId, buildingKey, id, mapId, buildingKey, player.id, character).first();
  if (!row) return { error: 'no-decor' };
  // DECOR2a: the moved piece must be one the law takes, as a placed one must - the owner's own item never comes to cost
  // gold or hold things (a piece the law refuses reads as nothing, and its cost would be owed at a sale)
  const was = pieceOfRow(row);
  if (!was || !decorPieceOf({ ...was, ...pl })) return { error: 'bad-decor' };
  const delta = decorGoldDelta(was, pl);
  const side = decorSideOf(character, realm, delta);
  if (side.error) return side;
  if (side.at && delta !== 0) {
    // REALM P2.2b: a resize or a station, paid or given back on the record with the move - from the row as it was read
    return realmDecorWrite(ctx, player, side.at, {
      mapId, buildingKey, delta,
      write: db.prepare(`UPDATE home_decor SET place = ? WHERE map_id = ? AND building_key = ? AND id = ? AND place = ? AND ${OWNS}`)
        .bind(placeJson(pl), mapId, buildingKey, id, row.place, mapId, buildingKey, player.id, character),
      after: async () => pieceOfRow(await db.prepare('SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?').bind(mapId, buildingKey, id).first()),
      refusal: async () => 'no-decor',
    });
  }
  const r = await db.prepare(`UPDATE home_decor SET place = ? WHERE map_id = ? AND building_key = ? AND id = ? AND ${OWNS}`)
    .bind(placeJson(pl), mapId, buildingKey, id, mapId, buildingKey, player.id, character).run();
  if (!r?.meta?.changes) return { error: 'no-decor' };
  const now = await db.prepare('SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?').bind(mapId, buildingKey, id).first();
  const piece = now ? pieceOfRow(now) : null;
  return piece ? { ok: true, piece } : { error: 'no-decor' };
}

/**
 * REMOVE ONE: the owner's alone. Answers the piece as it stood - its cost among it, for the half that comes back.
 * @param {{db: any, nowS: number}} ctx
 */
export async function removeDecor(ctx, player, { mapId, buildingKey, character, id, realm = null } = {}) {
  const shut = await writeDoor(ctx, player, { mapId, buildingKey, character });
  if (shut) return { error: shut };
  if (typeof id !== 'string' || !DECOR_ID_RE.test(id)) return { error: 'no-decor' };
  const { db } = ctx;
  const named = realm == null ? null : realmSideOf(character, realm);   // REALM P2.2b
  if (named?.error) return named;
  if (named?.at) {
    const moved = await recordMovedOf(db, player.id, named.at);   // a removal sent again after it landed: said so first
    if (moved) return moved;
  }
  {
    const row = await db.prepare(`SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ? AND ${OWNS}`)
      .bind(mapId, buildingKey, id, mapId, buildingKey, player.id, character).first();
    const was = row ? pieceOfRow(row) : null;
    const delta = was ? decorGoldDelta(was, null) : 0;
    const side = decorSideOf(character, realm, delta);
    if (side.error) return side;
    if (side.at && delta > 0) {
      // REALM P2.2b: half of what it cost, into the record's purse with the piece's going
      return realmDecorWrite(ctx, player, side.at, {
        mapId, buildingKey, delta,
        write: db.prepare(`DELETE FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ? AND place = ? AND ${OWNS}`)
          .bind(mapId, buildingKey, id, row.place, mapId, buildingKey, player.id, character),
        after: async () => was,
        refusal: async () => 'no-decor',
      });
    }
  }
  const row = await db.prepare(`DELETE FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ? AND ${OWNS} RETURNING *`)
    .bind(mapId, buildingKey, id, mapId, buildingKey, player.id, character).first();
  const piece = row ? pieceOfRow(row) : null;
  return piece ? { ok: true, piece } : { error: 'no-decor' };
}
