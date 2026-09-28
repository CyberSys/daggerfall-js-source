// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REALM P1 — THE REALM'S CHARACTERS, SERVICE SIDE. The row in D1, the
// save in R2, and the lease that says which tab may write it.
//
// Mac: "A true separation while allowing people to still play offline",
// and, asked where an online character's save lives: "Account service".
// The plan is bible/06-Systems/Realm-Arc.md, sections 1 and 2.
//
// ═══ HERE THE SERVICE IS THE TRUTH ═════════════════════════════════
//
// saves.js is a backup and says so: "THE LOCAL SAVE IS THE TRUTH". A
// realm character is the other lane. Its save lives here, the Online
// door loads it only from here, and a local copy is a cache that no
// door lists. That is what makes a copy worthless as a way in: a
// restored backup, an imported zip or an edited file can be loaded
// offline, where it is an offline character, and nowhere else.
//
// ═══ THE LEASE AND THE SEQUENCE ════════════════════════════════════
//
// A JOIN mints a new lease and so takes the character from any tab that
// held it - ONE-SEAT's own rule, newest wins - and it frees every other
// character of the account, so one account plays one character. A
// CHECKPOINT lands only under the current lease and only at `seq + 1`.
// So an old tab, a second device or a replayed request can never write
// the character again; the tab that lost the lease is told so and goes
// offline.
//
// EVERY WRITE IS A NEW OBJECT (REALM P2.1). The row names the current
// save (`obj`) and the one before it (`prev`), and a write lands at a
// key of its own before the row moves to it - so a write that loses its
// race (a checkpoint against a trade the service is settling, a join
// between the read and the write) leaves the current save untouched,
// and the one before the last checkpoint always survives. P1 alternated
// two objects by `seq`, and a write that lost its race could land on
// the current one.
//
// ═══ EVERYTHING IS SCOPED BY THE PLAYER THE CALLER PROVED ══════════
//
// saves.js's law, kept: every statement binds the resolved player, and
// no route takes a player id from a caller.
// ═══════════════════════════════════════════════════════════════════

import { SAVE_MAX_BYTES } from './service.js';
import { GUILD_RANK_MASTER } from '../../src/net/guildLaw.js';   // AUDIT REALM L1-F7: a deleted guildmaster hands the guild over first

/** Realm characters an ACCOUNT may hold. A new one past it is refused; nothing is ever deleted to make room. */
export const REALM_CHARACTERS_MAX = 6;
/** A character's name as the Online door shows it. */
export const REALM_NAME_MAX = 32;
/** The summary's JSON, in bytes. */
export const REALM_SUMMARY_MAX = 512;
/** A lease renewed this recently is a character in play ("playing now" on the tile). Checkpoints come every two minutes. */
export const REALM_PLAYING_S = 300;
/** The largest save a checkpoint may carry - the cloud save's own bound. */
export const REALM_MAX_BYTES = SAVE_MAX_BYTES;
/** The service's ids: `r` and twenty hex digits. Nothing a client mints looks like one. */
export const REALM_ID_RE = /^r[0-9a-f]{20}$/;
/** A lease: thirty-two hex digits, a secret the playing tab holds. */
export const LEASE_RE = /^[0-9a-f]{32}$/;
/** An offline character's id (CHARID1's two shapes, service.js CHAR_ID_RE's bound), for customs. */
export const ORIGIN_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;

/** The R2 keys: player first, so an account is a prefix walk; a character's saves under its id, each at the sequence
 *  it lands at and a tag of its own, so no two writes ever share a key. */
export const realmPrefix = (/** @type {string} */ playerId) => `realm/${encodeURIComponent(playerId)}/`;
export const realmObjectKey = (/** @type {string} */ playerId, /** @type {string} */ id, /** @type {number} */ seq, /** @type {string} */ tag) => `${realmPrefix(playerId)}${id}/${seq}-${tag}`;

const hex = (/** @type {(b: Uint8Array) => Uint8Array} */ rand, /** @type {number} */ n) => [...rand(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
/** A fresh key for a write of this character at `seq`. */
export const mintObjectKey = (/** @type {(b: Uint8Array) => Uint8Array} */ rand, /** @type {string} */ playerId, /** @type {string} */ id, /** @type {number} */ seq) => realmObjectKey(playerId, id, seq, hex(rand, 4));
/** Objects nothing names any more - a write that lost its race, or the save two back. Best effort: one that will not go
 *  is only bytes under the character's prefix, which its delete walks. */
export async function dropObjects(/** @type {any} */ bucket, /** @type {(string | null | undefined)[]} */ keys) {
  for (const k of keys) {
    if (!k) continue;
    try { await bucket.delete(k); } catch { /* bytes nothing names */ }
  }
}
export const mintRealmId = (/** @type {(b: Uint8Array) => Uint8Array} */ rand) => `r${hex(rand, 10)}`;
export const mintLease = (/** @type {(b: Uint8Array) => Uint8Array} */ rand) => hex(rand, 16);

/** A name the door may show: trimmed, printable, bounded - or null. */
export function realmNameOf(/** @type {unknown} */ v) {
  if (typeof v !== 'string') return null;
  const name = v.trim().slice(0, REALM_NAME_MAX);
  return name && !/[\u0000-\u001f\u007f]/.test(name) ? name : null;
}

const whole = (/** @type {unknown} */ v, /** @type {number} */ max) => (Number.isSafeInteger(v) && /** @type {number} */ (v) >= 0 && /** @type {number} */ (v) <= max ? v : null);
const text = (/** @type {unknown} */ v, /** @type {number} */ max) => (typeof v === 'string' && v && !/[\u0000-\u001f\u007f]/.test(v) ? v.slice(0, max) : null);

/**
 * THE SUMMARY A CLIENT MAY SEND, projected - what the tile shows and nothing else: level, class, race, gender, and
 * the face the tile draws. Extra keys do not exist here. Answers the JSON to store, or null.
 * @param {any} v
 */
export function realmSummaryOf(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const s = {
    level: whole(v.level, 1000),
    className: text(v.className, 40),
    race: text(v.race, 24),
    gender: text(v.gender, 8),
    face: whole(v.face, 1000),
    region: text(v.region, 40),
  };
  const json = JSON.stringify(s);
  return json.length <= REALM_SUMMARY_MAX ? json : null;
}

/** The row as the Online door sees it. The lease is never in it. */
const view = (/** @type {any} */ r, /** @type {number} */ nowS) => {
  let summary = null;
  try { summary = r.summary ? JSON.parse(r.summary) : null; } catch { summary = null; }
  return {
    id: r.id, name: r.name, summary, seq: r.seq, bytes: r.bytes,
    playing: !!r.lease && nowS - r.lease_at < REALM_PLAYING_S,
    customs: !!r.origin_id,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
};

/** Every realm character this account holds, the one played last first. */
export async function listRealm({ db, nowS }, /** @type {string} */ playerId) {
  const r = await db.prepare(
    'SELECT id, name, summary, seq, bytes, lease, lease_at, origin_id, created_at, updated_at FROM realm_characters'
    + ' WHERE player = ? ORDER BY updated_at DESC LIMIT ?',
  ).bind(playerId, REALM_CHARACTERS_MAX).all();
  return (r?.results ?? []).map((row) => view(row, nowS));
}

/** ONE CHARACTER IN PLAY AN ACCOUNT: every lease of this account but `keep`'s is dropped. */
async function freeOthers({ db }, /** @type {string} */ playerId, /** @type {string} */ keep) {
  await db.prepare('UPDATE realm_characters SET lease = NULL WHERE player = ? AND id != ? AND lease IS NOT NULL').bind(playerId, keep).run();
}

/**
 * A NEW REALM CHARACTER, born online (customs is customsRealm's, below). The id and the lease are minted here; the
 * character is the caller's in play from this moment, at `seq` 0 with no save yet (its first checkpoint is seq 1). The
 * bound is asked IN the write, as saves.js's putCard asks it. Answers `{ id, lease, seq }` or `{ error }`.
 * @param {any} ctx @param {string} playerId @param {{ name: unknown, summary?: unknown }} at
 */
export async function createRealm({ db, rand, nowS }, playerId, { name, summary = null }) {
  const n = realmNameOf(name);
  if (!playerId || !n) return { error: 'body' };
  const id = mintRealmId(rand);
  const lease = mintLease(rand);
  const wrote = await db.prepare(
    'INSERT INTO realm_characters (id, player, name, summary, seq, bytes, lease, lease_at, origin_id, created_at, updated_at)'
    + ' SELECT ?, ?, ?, ?, 0, 0, ?, ?, NULL, ?, ? WHERE (SELECT COUNT(*) FROM realm_characters WHERE player = ?) < ?',
  ).bind(id, playerId, n, realmSummaryOf(summary), lease, nowS, nowS, nowS, playerId, REALM_CHARACTERS_MAX).run();
  if (!wrote.meta.changes) return { error: 'too-many-characters' };
  await freeOthers({ db }, playerId, id);
  return { id, lease, seq: 0 };
}

/** THE TABLES A CHARACTER'S ONLINE LIFE IS KEYED IN, by the character's id: its Renown (renownTracks.js), its homes
 *  (homes.js) and its guild (guilds.js). Customs carries them to the realm's id. */
export const CHARACTER_TABLES = Object.freeze(['renown_tracks', 'homes', 'guild_members']);

/** CUSTOMS CARRIES A CHARACTER'S ONLINE LIFE IN: its Renown track, its homes and its guild, re-keyed from the offline id
 *  to the realm's - the plan's "Renown starts from its existing track" - so nothing it earned online is left behind
 *  under an id the realm never plays again. The account's own rows only. */
async function carryOnlineLife({ db }, /** @type {string} */ playerId, /** @type {string} */ originId, /** @type {string} */ id) {
  for (const table of CHARACTER_TABLES) {
    await db.prepare(`UPDATE ${table} SET char_id = ? WHERE player = ? AND char_id = ?`).bind(id, playerId, originId).run();
  }
}

/**
 * WHY CUSTOMS REFUSED (decision 3: "Migrate once via customs"). An offline character may come into the realm once, and
 * only if it played online before the realm. AUDIT REALM L1-F5 / L3-F2: "played online" is the CENSUS migration 0018
 * took of the Renown tracks standing at the realm's start (`realm_census`) - never a track written since: any session
 * files a track for any id, and a Copy to offline's new id, one report, brought the realm character in a second time.
 * And "once" is the character's, on every account: a customs SPENDS its character's census rows everywhere
 * (customsRealm), so a character copied onto two accounts before the realm, or a realm character deleted, never brings
 * its origin in again. The gate itself is customsRealm's one guarded write; this reads, after it refused, which word is
 * true: `customs-never-online` (this account counted no such character), `customs-already` (it came in, from here or
 * from an account it was copied to), `too-many-characters` (the account's bound) - or null, when none is (the store
 * failed, and the caller says so).
 * @param {any} ctx @param {string} playerId @param {string} originId
 */
export async function customsRefusal({ db }, playerId, originId) {
  const counted = await db.prepare('SELECT spent FROM realm_census WHERE player = ? AND char_id = ?').bind(playerId, originId).first();
  if (!counted) return 'customs-never-online';
  if (counted.spent) return 'customs-already';
  const held = await db.prepare('SELECT COUNT(*) AS n FROM realm_characters WHERE player = ?').bind(playerId).first();
  return (held?.n ?? 0) >= REALM_CHARACTERS_MAX ? 'too-many-characters' : null;
}

/**
 * CUSTOMS, MADE (AUDIT REALM L3-F2, L3-F3): the realm character from `origin` in ONE guarded batch - its row written only
 * while the account is under its bound and its census row for the origin stands unspent, and every census row of the
 * origin spent with it, so two accounts (or two tabs) bringing one character in race to one winner. The law is that
 * write, at one site; customsRefusal only names why it refused. A customs whose first save never landed (the door's PUT
 * lost on the way) is RESUMED - the same row, a new lease - rather than refused for good, which left the character
 * barred and its online life under a row nobody could play. Answers `{ id, lease, seq }` (`resumed` for the row taken
 * up again) or `{ error }`.
 * @param {any} ctx @param {string} playerId @param {{ origin: unknown, name: unknown, summary?: unknown }} at
 */
export async function customsRealm(ctx, playerId, { origin, name, summary = null }) {
  const { db, rand, nowS } = ctx;
  if (typeof origin !== 'string' || !ORIGIN_ID_RE.test(origin) || REALM_ID_RE.test(origin)) return { error: 'body' };
  const mine = await db.prepare('SELECT id, bytes FROM realm_characters WHERE player = ? AND origin_id = ?').bind(playerId, origin).first();
  if (mine && !(mine.bytes > 0)) {
    const joined = await joinRealm(ctx, playerId, mine.id);
    return joined.error ? joined : { id: joined.id, lease: joined.lease, seq: 0, resumed: true };
  }
  const n = realmNameOf(name);
  if (!playerId || !n) return { error: 'body' };
  const id = mintRealmId(rand);
  const lease = mintLease(rand);
  try {
    await db.batch([
      db.prepare(
        'INSERT INTO realm_characters (id, player, name, summary, seq, bytes, lease, lease_at, origin_id, created_at, updated_at)'
        + ' SELECT ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM realm_characters WHERE player = ?) < ?'
        + ' AND EXISTS (SELECT 1 FROM realm_census WHERE player = ? AND char_id = ? AND spent = 0)',
      ).bind(id, playerId, n, realmSummaryOf(summary), lease, nowS, origin, nowS, nowS, playerId, REALM_CHARACTERS_MAX, playerId, origin),
      mustChange(db),
      db.prepare('UPDATE realm_census SET spent = 1 WHERE char_id = ?').bind(origin),
    ]);
  } catch (e) {
    const why = await customsRefusal(ctx, playerId, origin);
    if (why) return { error: why };
    throw e;
  }
  await freeOthers({ db }, playerId, id);
  await carryOnlineLife({ db }, playerId, origin, id);
  return { id, lease, seq: 0 };
}

/**
 * A JOIN: a new lease on the account's own character, taking it from any tab that held it and freeing the account's
 * others. Answers `{ id, lease, seq, bytes }` - `bytes` 0 is a character whose first save never landed - or `{ error }`.
 * @param {any} ctx @param {string} playerId @param {unknown} id
 */
export async function joinRealm({ db, rand, nowS }, playerId, id) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id)) return { error: 'body' };
  const lease = mintLease(rand);
  const took = await db.prepare('UPDATE realm_characters SET lease = ?, lease_at = ? WHERE id = ? AND player = ?').bind(lease, nowS, id, playerId).run();
  if (!took.meta.changes) return { error: 'no-realm-character' };
  await freeOthers({ db }, playerId, id);
  const row = await db.prepare('SELECT seq, bytes FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  return { id, lease, seq: row?.seq ?? 0, bytes: row?.bytes ?? 0 };
}

/**
 * A CHECKPOINT: the save, under the current lease, at `seq + 1`. The row is asked first (a stale lease or sequence is
 * refused before a byte is written), the object lands at a key of its own, and the row moves to it only if the lease
 * and sequence still hold - so a join or a trade between the two leaves the current save untouched, and the losing
 * write's object is dropped. The save two back goes; the one before stays. Answers `{ ok, seq }` or `{ error }`:
 * 'lease' - another tab or device has the character now; 'seq' - not the next one, with the service's `seq` beside it,
 * so a tab whose last checkpoint landed but whose answer was lost can resync.
 * @param {any} ctx @param {string} playerId
 * @param {{ id: string, lease: unknown, seq: unknown, summary?: unknown }} at @param {ArrayBuffer} body @param {number} bytes
 */
export async function checkpointRealm({ db, bucket, rand, nowS }, playerId, { id, lease, seq, summary = null }, body, bytes) {
  if (!bucket) return { error: 'no-storage' };
  if (!REALM_ID_RE.test(id) || typeof lease !== 'string' || !LEASE_RE.test(lease) || !Number.isSafeInteger(seq) || /** @type {number} */ (seq) < 1) return { error: 'body' };
  const row = await db.prepare('SELECT seq, lease, prev FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (row.lease !== lease) return { error: 'lease' };
  if (seq !== row.seq + 1) return { error: 'seq', seq: row.seq };   // the service's own: a client whose last answer was lost resyncs
  const key = mintObjectKey(rand, playerId, id, /** @type {number} */ (seq));
  await bucket.put(key, body);
  const moved = await db.prepare(
    'UPDATE realm_characters SET seq = ?, bytes = ?, obj = ?, prev = obj, lease_at = ?, summary = COALESCE(?, summary), updated_at = ?'
    + ' WHERE id = ? AND player = ? AND lease = ? AND seq = ?',
  ).bind(seq, bytes, key, nowS, realmSummaryOf(summary), nowS, id, playerId, lease, /** @type {number} */ (seq) - 1).run();
  if (!moved.meta.changes) { await dropObjects(bucket, [key]); return { error: 'lease' }; }
  await dropObjects(bucket, [row.prev]);   // two back now: the one before the last stays
  return { ok: true, seq };
}

/** THE SAVE, as it stands - for a join's load, and for "Copy to offline", which needs no lease: a copy played offline
 *  is an offline character and never comes back. Answers `{ ok, object, seq }` or `{ error }`. */
export async function getRealmBlob({ db, bucket }, /** @type {string} */ playerId, /** @type {string} */ id) {
  if (!bucket) return { error: 'no-storage' };
  if (!REALM_ID_RE.test(id)) return { error: 'body' };
  const row = await db.prepare('SELECT seq, bytes, obj FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (!row.seq || !row.bytes || !row.obj) return { error: 'no-data' };
  const object = await bucket.get(row.obj);
  return object ? { ok: true, object, seq: row.seq } : { error: 'no-data' };
}

// ── REALM P2.2: A REALM CHARACTER'S GOLD MOVES ON ITS RECORD ─────────

/** THE GUARD a batch step answers to (migration 0017's `realm_tx_guard`): placed right after an UPDATE that must change
 *  exactly `n` rows, it inserts only when that UPDATE changed another number, and the table's CHECK refuses the row - so
 *  D1 rolls the whole batch back. An UPDATE that matches nothing is not an error by itself; this makes it one. */
export const mustChange = (/** @type {any} */ db, n = 1) => db.prepare('INSERT INTO realm_tx_guard (moved, expected) SELECT changes(), ? WHERE changes() != ?').bind(n, n);

/** Where a tab says its record stands - `{ id, lease, seq }` - or null. */
export function realmAtOf(/** @type {any} */ v) {
  if (!v || typeof v !== 'object') return null;
  const { id, lease, seq } = v;
  if (typeof id !== 'string' || !REALM_ID_RE.test(id) || typeof lease !== 'string' || !LEASE_RE.test(lease) || !Number.isSafeInteger(seq) || seq < 1) return null;
  return { id, lease, seq };
}

/**
 * A REALM CHARACTER'S RECORD, CHANGED WITH AN ACT - the service's half of every act online that costs or pays a realm
 * character gold: a guild's treasury, a founding, a home, a piece of decor. `at` is the record as its tab last
 * checkpointed it (the tab checkpoints just before, and holds its checkpoints until the answer, so the save read here
 * is the one it plays); `change(save)` changes it in place (net/realmGoldLaw.js payFromSave, creditSave) and answers
 * null, or a refusal's word. The record is written ONE SEQUENCE ON as a new object - but the row is not moved here: the
 * answer's `steps` go into the caller's OWN batch beside the act they pay for (the row's move and its guard), so the
 * gold and the act land together or neither does. After the batch the caller drops `prev` (it landed) or `key` (it did
 * not). Answers `{ steps, key, prev, seq }` or `{ error }`: 'lease' or 'seq' (the record is not where the tab says - a
 * checkpoint's own words, `seq` with the service's), `change`'s own word, 'no-data'.
 * @param {any} ctx @param {string} playerId @param {{ id: string, lease: string, seq: number }} at
 * @param {(save: any) => string | null} change
 */
export async function prepareRealmRecord({ db, bucket, rand, nowS }, playerId, at, change) {
  if (!bucket) return { error: 'no-storage' };
  const row = await db.prepare('SELECT seq, lease, obj, prev FROM realm_characters WHERE id = ? AND player = ?').bind(at.id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (row.lease !== at.lease) return { error: 'lease' };
  if (row.seq !== at.seq || !row.obj) return { error: 'seq', seq: row.seq };
  const object = await bucket.get(row.obj);
  let save = null;
  try { save = object ? JSON.parse(typeof object.text === 'function' ? await object.text() : new TextDecoder().decode(object.body)) : null; } catch { save = null; }
  if (!save || typeof save !== 'object' || Array.isArray(save)) return { error: 'no-data' };
  const refused = change(save);
  if (refused) return { error: refused };
  const text = JSON.stringify(save);
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > REALM_MAX_BYTES) return { error: 'no-data' };
  const key = mintObjectKey(rand, playerId, at.id, at.seq + 1);
  await bucket.put(key, text);
  const steps = [
    db.prepare('UPDATE realm_characters SET seq = ?, bytes = ?, obj = ?, prev = obj, updated_at = ? WHERE id = ? AND player = ? AND lease = ? AND seq = ?')
      .bind(at.seq + 1, bytes, key, nowS, at.id, playerId, at.lease, at.seq),
    mustChange(db),
  ];
  return { steps, key, prev: row.prev, seq: at.seq + 1 };
}

/** After a batch that carried a record's move failed: the record's own reason - 'lease' (another tab holds it) or
 *  'seq' with the service's sequence (it moved) - or null when it still stands where the tab said, and the act's own
 *  write was what failed. */
export async function recordMovedOf(/** @type {any} */ db, /** @type {string} */ playerId, /** @type {{ id: string, lease: string, seq: number }} */ at) {
  const row = await db.prepare('SELECT seq, lease FROM realm_characters WHERE id = ? AND player = ?').bind(at.id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (row.lease !== at.lease) return { error: 'lease' };
  return row.seq !== at.seq ? { error: 'seq', seq: row.seq } : null;
}

/**
 * THE REALM SIDE OF AN ACT, asked before the act: a realm character (its id the service's own shape - REALM_ID_RE,
 * minted only here) must say where its record stands (`realm`, `{ id, lease, seq }`, the same character), and any other
 * character may not. Answers `{ at }` for a realm character, `{ at: null }` for another, or `{ error }`.
 * @param {unknown} character @param {unknown} realm
 */
export function realmSideOf(character, realm) {
  const mine = typeof character === 'string' && REALM_ID_RE.test(character);
  if (!mine) return realm == null ? { at: null } : { error: 'body' };
  const at = realmAtOf(realm);
  if (!at || at.id !== character) return { error: 'realm-needed' };
  return { at };
}

/**
 * AUDIT REALM L1-F2: THE RECORD, ASKED FIRST. An act that moves a realm character's gold answers where its record
 * stands BEFORE any other word - a rank, a rate, a guild already joined, a house already held - because the client reads
 * a lost answer by it: an act sent again finds its record one on (`seq`, the service's own), and that is the act,
 * landed (systems/realmSaves.js realmGoldAct). Asked after them, a founding that landed was told 'guild-already' on its
 * retry, a deposit 'rate', a claim 'home-rate' - each read as "nothing moved" - and the tab gave itself the gold back
 * and checkpointed it over the record that had paid. Answers realmSideOf's `{ at }` (null for a character that is not
 * the realm's), or `{ error }` - 'lease', or 'seq' with the service's sequence.
 * @param {any} db @param {string} playerId @param {unknown} character @param {unknown} realm
 */
export async function realmActFirst(db, playerId, character, realm) {
  const side = realmSideOf(character, realm);
  if (side.error || !side.at) return side;
  return (await recordMovedOf(db, playerId, side.at)) ?? side;
}

/** A LEAVE: the lease given up, if it is still this tab's. Answers `{ ok, released }`. */
export async function leaveRealm({ db }, /** @type {string} */ playerId, /** @type {{ id: unknown, lease: unknown }} */ { id, lease }) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id) || typeof lease !== 'string' || !LEASE_RE.test(lease)) return { error: 'body' };
  const r = await db.prepare('UPDATE realm_characters SET lease = NULL WHERE id = ? AND player = ? AND lease = ?').bind(id, playerId, lease).run();
  return { ok: true, released: r.meta.changes > 0 };
}

/** THE PLAYER'S OWN DELETE: its objects - the two the row names, and anything else under its prefix a lost write left
 *  - then the row: saves.js's order, so a failure halfway leaves a row whose bytes lie rather than objects nothing
 *  names. AUDIT REALM L1-F7 / L3-F5: AND ITS ONLINE LIFE WITH IT, as the door promises ("its Renown, its home and its
 *  guild place with it"): the row's delete carries its homes (their pieces and hidden furniture go by the tables' own
 *  cascade), its guild place and its Renown track in ONE batch. They stood under a dead id: a house nobody could buy
 *  again nor its owner sell, a guild whose master could never be succeeded, a track that counted against the account.
 *  A guildmaster with members hands the guild over first ('guild-master-leaves', the guild's own word for leaving). */
export async function deleteRealm({ db, bucket }, /** @type {string} */ playerId, /** @type {unknown} */ id) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id)) return { error: 'body' };
  const row = await db.prepare('SELECT obj, prev FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  const master = await db.prepare(`SELECT (SELECT COUNT(*) FROM guild_members o WHERE o.guild_id = m.guild_id) AS n FROM guild_members m
    WHERE m.player = ? AND m.char_id = ? AND m.rank = ?`).bind(playerId, id, GUILD_RANK_MASTER).first();
  if ((master?.n ?? 0) > 1) return { error: 'guild-master-leaves' };
  if (bucket) {
    await dropObjects(bucket, [row.obj, row.prev]);   // an object that will not go is not a reason to keep the row
    if (typeof bucket.list === 'function') {
      try {
        const listed = await bucket.list({ prefix: `${realmPrefix(playerId)}${id}/` });
        await dropObjects(bucket, (listed?.objects ?? []).map((/** @type {any} */ o) => o.key));
      } catch { /* the walk is the sweep's, not the delete's */ }
    }
  }
  await db.batch([
    db.prepare('DELETE FROM homes WHERE player = ? AND char_id = ?').bind(playerId, id),
    db.prepare('DELETE FROM guild_members WHERE player = ? AND char_id = ?').bind(playerId, id),
    db.prepare('DELETE FROM renown_tracks WHERE player = ? AND char_id = ?').bind(playerId, id),
    db.prepare('DELETE FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId),
  ]);
  return { ok: true };
}
