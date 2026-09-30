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
import { accountKind, displayName, overRate } from './accounts.js';
import { CHAR_ID_RE } from './service.js';
import { homeMapIdOk, homeBuildingKeyOk } from '../../src/net/homeLaw.js';
import { DECOR_CAP, DECOR_ID_RE, DECOR_OPS_MAX, DECOR_OPS_WINDOW_S, DECOR_STATION_FEES, decorPieceOf, decorPlaceOf, decorHiddenOf, decorRefund, DECOR_YARD_CAP, DECOR_YARDS_TOWN_MAX, decorYardPieceOf, decorYardPlaceOf } from '../../src/net/decorLaw.js';   // HOME-YARD: and a yard's
import { prepareRealmRecord, realmSideOf, realmActFirst, recordMovedOf, mustChange, dropObjects, dropIfUnnamed, REALM_ID_RE } from './realm.js';   // REALM P2.2b; AUDIT REALM L1-F2: the record asked first; AUDIT REALM2 S2/S3
import { payFromSave, creditSave } from '../../src/net/realmGoldLaw.js';   // REALM P2.2b: the wallet's own order, over the record
import { GUILD_TREASURY_MAX } from '../../src/net/guildLaw.js';   // GUILD1d: a hall's treasury's cap
import { HALL_POWERS } from '../../src/net/hallLaw.js';   // GUILD1d: a hall's keepers

/**
 * REALM P2.2b: WHAT A PIECE'S CHANGE COSTS, as the client's wallet pays it - placed: what it cost (`paid`); grown: the
 * difference, shrunk: half the difference back (net/decorLaw.js decorRescale's arithmetic, off the service's own record
 * of what it cost); made a station or changed to another: that station's licence (DECOR_STATION_FEES, never given back);
 * removed: half of what it cost. Answers the gold the record gains (negative: pays) - `delta` - and `ledger`, what
 * records have now paid for the piece as it stands.
 * AUDIT REALM L1-F3: WHAT COMES BACK IS HALF OF WHAT RECORDS PAID (`ledger`, home_decor.paid - migration 0020), never
 * half of a cost a client named: a piece placed before the realm, or through the old lane, carries a `paid` no record
 * ever paid, and customs carries its house in - its removal, its shrinking or its house's sale made gold. A piece a
 * record placed has paid it all (`ledger` = `paid`, the default), and changes exactly as before; a shrink gives back
 * half of the part records paid, and the ledger never stands above the piece's own cost.
 * @param {any} was @param {any} now @param {number} [ledger]
 */
export function decorGoldMove(was, now, ledger = was?.paid) {
  const paidWas = was ? Math.max(0, Number(was.paid) || 0) : 0;
  const own = Math.min(paidWas, Math.max(0, Number(ledger) || 0));
  if (!now) return { delta: decorRefund(own), ledger: 0 };
  const paidNow = Math.max(0, Number(now.paid) || 0);
  let delta, next;
  if (paidNow >= paidWas) { delta = paidWas - paidNow; next = own + paidNow - paidWas; }
  else { const base = Math.min(paidWas - paidNow, own); delta = Math.trunc(base / 2); next = own - base; }
  if (now.station && now.station !== (was?.station ?? null)) delta -= DECOR_STATION_FEES[now.station] ?? 0;
  return { delta, ledger: next };
}
/** The gold alone (decorGoldMove's `delta`). */
export const decorGoldDelta = (/** @type {any} */ was, /** @type {any} */ now, /** @type {number} */ ledger = was?.paid) => decorGoldMove(was, now, ledger).delta;

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
    await dropIfUnnamed(db, bucket, player.id, at.id, prep.key);   // AUDIT REALM2 S3: a batch that landed and lost its answer keeps its save
    return (await recordMovedOf(db, player.id, at)) || { error: await refusal() };
  }
  await dropObjects(bucket, [prep.prev]);
  const piece = await after();
  return piece ? { ok: true, piece, gold: delta, realm: { seq: prep.seq } } : { error: 'no-decor' };   // AUDIT REALM L1-F3: the gold the record moved - the client takes it, never its own sum
}

/** The home is the caller's character's: map, key, account, character. GUILD1d (Seats-Arc 8.2: "decor in the hall by
 *  Officers"): or it is a guild's hall and the character is one of its keepers (hallLaw.js HALL_POWERS.decorate) - the
 *  same four places bound, in the same order, read once through `k`. */
const OWNS = `EXISTS (SELECT 1 FROM (SELECT ? AS m, ? AS b, ? AS p, ? AS c) k JOIN homes h ON h.map_id = k.m AND h.building_key = k.b
  WHERE (h.guild_id IS NULL AND h.player = k.p AND h.char_id = k.c)
    OR (h.guild_id IS NOT NULL AND EXISTS (SELECT 1 FROM guild_members g WHERE g.guild_id = h.guild_id AND g.player = k.p AND g.char_id = k.c
      AND g.rank IN (${HALL_POWERS.decorate.join(', ')})
      AND EXISTS (SELECT 1 FROM realm_characters rc WHERE rc.id = g.char_id AND rc.player = k.p))))`;   // AUDIT GUILD1d S2: a realm character's - its moves and stations are paid on its record, never on a client's word
/** GUILD1d: the guild whose hall a building is, or null (a home, or nobody's). */
const hallGuildOf = async (db, mapId, buildingKey) => (await db.prepare('SELECT guild_id FROM homes WHERE map_id = ? AND building_key = ?').bind(mapId, buildingKey).first())?.guild_id ?? null;

/**
 * GUILD1d: WHAT COMES BACK FROM A HALL'S PIECE GOES TO ITS GUILD. A piece in a hall is the guild's once it stands - its
 * keeper paid for it off their own record (a placement, a growth, a station's licence, as in any home), but half of
 * what records paid for it, given back when it is shrunk or taken out, goes into the guild's treasury (into what records
 * paid in - `realm_gold`), never to whichever Officer takes it down: one keeper's piece is never another's purse. The
 * piece's write and the treasury's move in ONE batch, both or neither; the ledger names it `hall-piece`. The record is
 * not touched, so the answer carries no sequence (`gold` 0 - nothing to the purse).
 */
async function hallPieceBack(ctx, player, guildId, { delta, write, after, refusal }) {
  const { db, nowS } = ctx;
  try {
    await db.batch([
      write, mustChange(db),
      db.prepare(`UPDATE guilds SET treasury = treasury + ?1, realm_gold = realm_gold + ?1, moved_by = ?2, moved_at = ?3, moved_kind = 'hall-piece'
        WHERE id = ?4 AND treasury + ?1 <= ?5`).bind(delta, displayName(player), nowS, guildId, GUILD_TREASURY_MAX),
      mustChange(db),
    ]);
  } catch {
    const g = await db.prepare('SELECT treasury FROM guilds WHERE id = ?').bind(guildId).first();
    return { error: g && g.treasury + delta > GUILD_TREASURY_MAX ? 'guild-treasury-full' : await refusal() };
  }
  const piece = await after();
  return piece ? { ok: true, piece, gold: 0, treasury: delta } : { error: 'no-decor' };
}
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

/** The shared first steps of every write: a registered account, a home named, a character, the hour's writes.
 *  AUDIT REALM2 S2: a placement's character is a realm character's (`realmOnly`) - any other id still placed on its
 *  client's word, a 200,000-gold station among them, into a house customs then carried in. */
async function writeDoor({ db, nowS }, player, { mapId, buildingKey, character }, realmOnly = false) {
  if (accountKind(player) !== 'linked') return 'homes-need-account';
  if (!homeMapIdOk(mapId) || !homeBuildingKeyOk(buildingKey)) return 'bad-home';
  if (typeof character !== 'string' || !CHAR_ID_RE.test(character)) return 'home-character';
  if (realmOnly && !REALM_ID_RE.test(character)) return 'realm-only';
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
  const { results = [] } = await db.prepare(`SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND yard = 0
    ORDER BY placed_at, id LIMIT ?`).bind(mapId, buildingKey, DECOR_CAP).all();   // HOME-YARD: the room's alone
  return { mapId, buildingKey, pieces: results.map(pieceOfRow).filter(Boolean), hidden: await hiddenOf(db, mapId, buildingKey) };
}

/**
 * HOME-YARD: EVERY YARD OF A TOWN, for everyone walking its streets - each home's pieces outside, by its building key,
 * oldest first; never more than DECOR_YARDS_TOWN_MAX in one answer.
 * @param {{db: any}} ctx
 */
export async function yardsOf({ db }, _player, { mapId } = {}) {
  if (!homeMapIdOk(mapId)) return { error: 'bad-home' };
  const { results = [] } = await db.prepare(`SELECT * FROM home_decor WHERE map_id = ? AND yard = 1
    ORDER BY building_key, placed_at, id LIMIT ?`).bind(mapId, DECOR_YARDS_TOWN_MAX).all();
  const by = new Map();
  for (const row of results) {
    const p = pieceOfRow(row);
    if (!p || !decorYardPieceOf(p)) continue;
    if (!by.has(row.building_key)) by.set(row.building_key, []);
    by.get(row.building_key).push(p);
  }
  return { mapId, yards: [...by].map(([buildingKey, pieces]) => ({ buildingKey, pieces })) };
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
 * PROF4 (bible/06-Systems/Professions-Arc.md 25): A CRAFTED PIECE SET DOWN - its provenance id kept only where the
 * account service's own `products` row says the piece is this account's and this template's, and its maker's mark
 * written from that row alone (where its name carries one - a Masterwork, a Master Joiner's furniture), never from what
 * the client sent. A piece whose id the row does not bear out stands as the plain piece it is.
 */
async function provenOf(db, player, p, mapId, buildingKey) {
  const pv = p.item.pv;
  const plain = { ...p.item };
  delete plain.pv;
  delete plain.mk;   // never the client's word
  const row = await db.prepare('SELECT owner, template, maker, marked, listed FROM products WHERE provenance = ?').bind(pv).first();
  // AUDIT 30 S6: one piece stands in one place - not while it is listed, and not where another placement already bears
  // it (a placement asked again is the same piece, the same id)
  const elsewhere = row ? await db.prepare(`SELECT 1 FROM home_decor WHERE json_extract(item, '$.pv') = ?1
    AND NOT (map_id = ?2 AND building_key = ?3 AND id = ?4)`).bind(pv, mapId, buildingKey, p.id).first() : null;
  const ours = row && row.owner === player.id && Number(row.template) === p.item.t && Number(row.listed) === 0 && !elsewhere;
  return decorPieceOf({ ...p, item: ours ? { ...plain, pv, ...(Number(row.marked) === 1 && row.maker ? { mk: row.maker } : {}) } : plain });
}

/**
 * PLACE ONE: it stands in the owner's home, or it is refused and nothing changes. A placement sent again because its
 * answer was lost finds the same piece standing and is answered as the placement.
 * @param {{db: any, nowS: number}} ctx
 */
export async function placeDecor(ctx, player, { mapId, buildingKey, character, piece, realm = null, yard = false } = {}) {
  const { db, nowS } = ctx;
  if (realm != null) {
    const first = await realmActFirst(db, player.id, character, realm);   // AUDIT REALM L1-F2: where the record stands, before the door's rate
    if (first.error) return first;
  }
  const shut = await writeDoor(ctx, player, { mapId, buildingKey, character }, true);   // AUDIT REALM2 S2: a realm character's
  if (shut) return { error: shut };
  const sent = yard === true ? decorYardPieceOf(piece) : decorPieceOf(piece);   // HOME-YARD: outside, the yard's own law
  if (!sent) return { error: 'bad-decor' };
  // GUILD1d: a hall holds the catalogue's pieces alone - never a keeper's own thing (whose would it be at the sale?) - and
  // stands no yard yet
  if (await hallGuildOf(db, mapId, buildingKey)) {
    if (yard === true) return { error: 'hall-yard' };
    if (sent.item) return { error: 'hall-item' };
  }
  const out = yard === true ? 1 : 0;
  const p = sent.item?.pv ? await provenOf(db, player, sent, mapId, buildingKey) : sent;   // PROF4: a crafted piece's mark off its own record
  if (!p) return { error: 'bad-decor' };
  const { delta, ledger } = decorGoldMove(null, p);
  const side = decorSideOf(character, realm, delta);   // REALM P2.2b
  if (side.error) return side;
  // AUDIT REALM L1-F3: `paid`, what a record paid for it - the price, when a realm character's record pays it; nothing else
  // HOME-YARD: a yard's pieces and a room's are counted apart, each against its own cap
  // AUDIT GUILD1d S3: the hall's own rule (no keeper's own thing, no yard) inside the write too - a hall bought between the
  // rule's read and this INSERT took them
  const insert = db.prepare(`INSERT OR IGNORE INTO home_decor (map_id, building_key, id, model, flat_archive, flat_record, place, placed_at, item, paid, yard)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${OWNS} AND (SELECT COUNT(*) FROM home_decor WHERE map_id = ? AND building_key = ? AND yard = ?) < ?
      AND (? = 0 OR NOT EXISTS (SELECT 1 FROM homes WHERE map_id = ? AND building_key = ? AND guild_id IS NOT NULL))`)
    .bind(mapId, buildingKey, p.id, p.model, p.flat?.[0] ?? null, p.flat?.[1] ?? null, placeJson(p), nowS, p.item ? JSON.stringify(p.item) : null,
      side.at ? ledger : 0, out, mapId, buildingKey, player.id, character, mapId, buildingKey, out, out ? DECOR_YARD_CAP : DECOR_CAP,
      p.item || out ? 1 : 0, mapId, buildingKey);
  /** AUDIT GUILD1d S3: a placement the hall's rule refused, in its own word - or null. */
  const hallWord = async () => ((p.item || out) && await hallGuildOf(db, mapId, buildingKey) ? (out ? 'hall-yard' : 'hall-item') : null);
  if (side.at && delta !== 0) {
    // REALM P2.2b: the piece and what it cost, together - a placement sent again found the record one on above
    const had = await db.prepare('SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?').bind(mapId, buildingKey, p.id).first();
    if (had) return JSON.stringify(pieceOfRow(had)) === JSON.stringify(p) ? { ok: true, repeat: true, piece: pieceOfRow(had), realm: { seq: side.at.seq } } : { error: 'decor-taken' };
    return realmDecorWrite(ctx, player, side.at, {
      mapId, buildingKey, delta, write: insert,
      after: async () => pieceOfRow(await db.prepare('SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?').bind(mapId, buildingKey, p.id).first()),
      refusal: async () => (await hallWord()) ?? ((await db.prepare(`SELECT ${OWNS} AS owns`).bind(mapId, buildingKey, player.id, character).first())?.owns ? (out ? 'yard-cap' : 'decor-cap') : 'no-home'),
    });
  }
  const r = await insert.run();
  if (r?.meta?.changes) return { ok: true, piece: p };
  const hallSaid = await hallWord();
  if (hallSaid) return { error: hallSaid };
  const owns = await db.prepare(`SELECT ${OWNS} AS owns`).bind(mapId, buildingKey, player.id, character).first();
  if (!owns?.owns) return { error: 'no-home' };
  const row = await db.prepare('SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?').bind(mapId, buildingKey, p.id).first();
  if (row) {
    const had = pieceOfRow(row);
    return had && JSON.stringify(had) === JSON.stringify(p) ? { ok: true, repeat: true, piece: had } : { error: 'decor-taken' };
  }
  return { error: out ? 'yard-cap' : 'decor-cap' };   // HOME-YARD (AUDIT): a yard's own cap, in its own words
}

/**
 * MOVE ONE - where it stands, its turn, its scale, its light, whether it holds things, what it has cost - never what
 * it is. The owner's alone.
 * @param {{db: any, nowS: number}} ctx
 */
export async function moveDecor(ctx, player, { mapId, buildingKey, character, id, place, realm = null } = {}) {
  if (realm != null) {
    const first = await realmActFirst(ctx.db, player.id, character, realm);   // AUDIT REALM L1-F2: where the record stands, before the door's rate
    if (first.error) return first;
  }
  const shut = await writeDoor(ctx, player, { mapId, buildingKey, character });
  if (shut) return { error: shut };
  if (typeof id !== 'string' || !DECOR_ID_RE.test(id)) return { error: 'no-decor' };
  const pl = decorPlaceOf(place);
  if (!pl) return { error: 'bad-decor' };
  const { db } = ctx;
  const row = await db.prepare(`SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ? AND ${OWNS}`)
    .bind(mapId, buildingKey, id, mapId, buildingKey, player.id, character).first();
  if (!row) return { error: 'no-decor' };
  // DECOR2a: the moved piece must be one the law takes, as a placed one must - the owner's own item never comes to cost
  // gold or hold things (a piece the law refuses reads as nothing, and its cost would be owed at a sale)
  const was = pieceOfRow(row);
  if (!was || !decorPieceOf({ ...was, ...pl })) return { error: 'bad-decor' };
  if (row.yard === 1 && !decorYardPlaceOf(pl)) return { error: 'bad-decor' };   // HOME-YARD: a yard's piece stays a yard's
  const { delta, ledger } = decorGoldMove(was, pl, row.paid);   // AUDIT REALM L1-F3: half back of what records paid
  const hall = delta > 0 ? await hallGuildOf(db, mapId, buildingKey) : null;
  if (hall) {
    // GUILD1d: a hall's piece shrunk - its half back to the guild's treasury, never to the keeper who shrank it
    return hallPieceBack(ctx, player, hall, {
      delta,
      write: db.prepare(`UPDATE home_decor SET place = ?, paid = ? WHERE map_id = ? AND building_key = ? AND id = ? AND place = ? AND paid = ? AND ${OWNS}`)
        .bind(placeJson(pl), ledger, mapId, buildingKey, id, row.place, row.paid, mapId, buildingKey, player.id, character),
      after: async () => pieceOfRow(await db.prepare('SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ?').bind(mapId, buildingKey, id).first()),
      refusal: async () => 'no-decor',
    });
  }
  const side = decorSideOf(character, realm, delta);
  if (side.error) return side;
  if (side.at && delta !== 0) {
    // REALM P2.2b: a resize or a station, paid or given back on the record with the move - from the row as it was read
    return realmDecorWrite(ctx, player, side.at, {
      mapId, buildingKey, delta,
      write: db.prepare(`UPDATE home_decor SET place = ?, paid = ? WHERE map_id = ? AND building_key = ? AND id = ? AND place = ? AND paid = ? AND ${OWNS}`)
        .bind(placeJson(pl), ledger, mapId, buildingKey, id, row.place, row.paid, mapId, buildingKey, player.id, character),
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
  if (realm != null) {
    const first = await realmActFirst(ctx.db, player.id, character, realm);   // AUDIT REALM L1-F2: where the record stands, before the door's rate
    if (first.error) return first;
  }
  const shut = await writeDoor(ctx, player, { mapId, buildingKey, character });
  if (shut) return { error: shut };
  if (typeof id !== 'string' || !DECOR_ID_RE.test(id)) return { error: 'no-decor' };
  const { db } = ctx;
  {
    const row = await db.prepare(`SELECT * FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ? AND ${OWNS}`)
      .bind(mapId, buildingKey, id, mapId, buildingKey, player.id, character).first();
    const was = row ? pieceOfRow(row) : null;
    const delta = was ? decorGoldMove(was, null, row.paid).delta : 0;   // AUDIT REALM L1-F3: half of what records paid
    const hall = delta > 0 ? await hallGuildOf(db, mapId, buildingKey) : null;
    if (hall) {
      // GUILD1d: a hall's piece taken out - its half back to the guild's treasury, never to the keeper who took it out
      return hallPieceBack(ctx, player, hall, {
        delta,
        write: db.prepare(`DELETE FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ? AND place = ? AND paid = ? AND ${OWNS}`)
          .bind(mapId, buildingKey, id, row.place, row.paid, mapId, buildingKey, player.id, character),
        after: async () => was,
        refusal: async () => 'no-decor',
      });
    }
    const side = decorSideOf(character, realm, delta);
    if (side.error) return side;
    if (side.at && delta > 0) {
      // REALM P2.2b: half of what it cost, into the record's purse with the piece's going
      return realmDecorWrite(ctx, player, side.at, {
        mapId, buildingKey, delta,
        write: db.prepare(`DELETE FROM home_decor WHERE map_id = ? AND building_key = ? AND id = ? AND place = ? AND paid = ? AND ${OWNS}`)
          .bind(mapId, buildingKey, id, row.place, row.paid, mapId, buildingKey, player.id, character),
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
