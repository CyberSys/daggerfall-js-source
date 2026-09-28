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
// offline. The save alternates between two objects by `seq`, so the one
// before the last checkpoint always survives a bad write.
//
// ═══ EVERYTHING IS SCOPED BY THE PLAYER THE CALLER PROVED ══════════
//
// saves.js's law, kept: every statement binds the resolved player, and
// no route takes a player id from a caller.
// ═══════════════════════════════════════════════════════════════════

import { SAVE_MAX_BYTES } from './service.js';

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

/** The R2 keys: player first, so an account is a prefix walk; two objects a character, alternating by `seq`. */
export const realmPrefix = (/** @type {string} */ playerId) => `realm/${encodeURIComponent(playerId)}/`;
export const realmKey = (/** @type {string} */ playerId, /** @type {string} */ id, /** @type {number} */ seq) => `${realmPrefix(playerId)}${id}/${seq % 2}`;

const hex = (/** @type {(b: Uint8Array) => Uint8Array} */ rand, /** @type {number} */ n) => [...rand(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
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
 * A NEW REALM CHARACTER - born online, or brought in through customs (`originId`). The id and the lease are minted
 * here; the character is the caller's in play from this moment, at `seq` 0 with no save yet (its first checkpoint is
 * seq 1). The bound is asked IN the write, as saves.js's putCard asks it. Answers `{ id, lease, seq }` or `{ error }`.
 * @param {any} ctx @param {string} playerId @param {{ name: unknown, summary?: unknown, originId?: string | null }} at
 */
export async function createRealm({ db, rand, nowS }, playerId, { name, summary = null, originId = null }) {
  const n = realmNameOf(name);
  if (!playerId || !n) return { error: 'body' };
  const id = mintRealmId(rand);
  const lease = mintLease(rand);
  const wrote = await db.prepare(
    'INSERT INTO realm_characters (id, player, name, summary, seq, bytes, lease, lease_at, origin_id, created_at, updated_at)'
    + ' SELECT ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM realm_characters WHERE player = ?) < ?',
  ).bind(id, playerId, n, realmSummaryOf(summary), lease, nowS, originId, nowS, nowS, playerId, REALM_CHARACTERS_MAX).run();
  if (!wrote.meta.changes) return { error: 'too-many-characters' };
  await freeOthers({ db }, playerId, id);
  return { id, lease, seq: 0 };
}

/**
 * CUSTOMS' GATE (decision 3: "Migrate once via customs"). An offline character may come into the realm once, and only
 * if it played online before the realm - it has a Renown track, which only an online session writes (renownTracks.js)
 * and which a realm character's own id could never own, since the service mints those. Answers null when it may, or
 * the refusal's word.
 * @param {any} ctx @param {string} playerId @param {unknown} originId
 */
export async function customsRefusal({ db }, playerId, originId) {
  if (typeof originId !== 'string' || !ORIGIN_ID_RE.test(originId) || REALM_ID_RE.test(originId)) return 'body';
  const track = await db.prepare('SELECT 1 AS one FROM renown_tracks WHERE player = ? AND char_id = ?').bind(playerId, originId).first();
  if (!track) return 'customs-never-online';
  const came = await db.prepare('SELECT 1 AS one FROM realm_characters WHERE player = ? AND origin_id = ?').bind(playerId, originId).first();
  return came ? 'customs-already' : null;
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
 * refused before a byte is written), the object lands in the slot `seq` names - never the current one - and the row
 * moves only if the lease and sequence still hold, so a join between the two leaves the current save untouched.
 * Answers `{ ok, seq }` or `{ error }`: 'lease' - another tab or device has the character now; 'seq' - not the next one,
 * with the service's `seq` beside it, so a tab whose last checkpoint landed but whose answer was lost can resync.
 * @param {any} ctx @param {string} playerId
 * @param {{ id: string, lease: unknown, seq: unknown, summary?: unknown }} at @param {ArrayBuffer} body @param {number} bytes
 */
export async function checkpointRealm({ db, bucket, nowS }, playerId, { id, lease, seq, summary = null }, body, bytes) {
  if (!bucket) return { error: 'no-storage' };
  if (!REALM_ID_RE.test(id) || typeof lease !== 'string' || !LEASE_RE.test(lease) || !Number.isSafeInteger(seq) || /** @type {number} */ (seq) < 1) return { error: 'body' };
  const row = await db.prepare('SELECT seq, lease FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (row.lease !== lease) return { error: 'lease' };
  if (seq !== row.seq + 1) return { error: 'seq', seq: row.seq };   // the service's own: a client whose last answer was lost resyncs
  await bucket.put(realmKey(playerId, id, /** @type {number} */ (seq)), body);
  const moved = await db.prepare(
    'UPDATE realm_characters SET seq = ?, bytes = ?, lease_at = ?, summary = COALESCE(?, summary), updated_at = ?'
    + ' WHERE id = ? AND player = ? AND lease = ? AND seq = ?',
  ).bind(seq, bytes, nowS, realmSummaryOf(summary), nowS, id, playerId, lease, /** @type {number} */ (seq) - 1).run();
  if (!moved.meta.changes) return { error: 'lease' };
  return { ok: true, seq };
}

/** THE SAVE, as it stands - for a join's load, and for "Copy to offline", which needs no lease: a copy played offline
 *  is an offline character and never comes back. Answers `{ ok, object, seq }` or `{ error }`. */
export async function getRealmBlob({ db, bucket }, /** @type {string} */ playerId, /** @type {string} */ id) {
  if (!bucket) return { error: 'no-storage' };
  if (!REALM_ID_RE.test(id)) return { error: 'body' };
  const row = await db.prepare('SELECT seq, bytes FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (!row.seq || !row.bytes) return { error: 'no-data' };
  const object = await bucket.get(realmKey(playerId, id, row.seq));
  return object ? { ok: true, object, seq: row.seq } : { error: 'no-data' };
}

/** A LEAVE: the lease given up, if it is still this tab's. Answers `{ ok, released }`. */
export async function leaveRealm({ db }, /** @type {string} */ playerId, /** @type {{ id: unknown, lease: unknown }} */ { id, lease }) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id) || typeof lease !== 'string' || !LEASE_RE.test(lease)) return { error: 'body' };
  const r = await db.prepare('UPDATE realm_characters SET lease = NULL WHERE id = ? AND player = ? AND lease = ?').bind(id, playerId, lease).run();
  return { ok: true, released: r.meta.changes > 0 };
}

/** THE PLAYER'S OWN DELETE: both objects, then the row - saves.js's order, so a failure halfway leaves a row whose
 *  bytes lie rather than objects nothing names. */
export async function deleteRealm({ db, bucket }, /** @type {string} */ playerId, /** @type {unknown} */ id) {
  if (typeof id !== 'string' || !REALM_ID_RE.test(id)) return { error: 'body' };
  const row = await db.prepare('SELECT 1 AS one FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).first();
  if (!row) return { error: 'no-realm-character' };
  if (bucket) {
    for (const seq of [0, 1]) {
      try { await bucket.delete(realmKey(playerId, id, seq)); }
      catch { /* an object that will not go is not a reason to keep the row */ }
    }
  }
  await db.prepare('DELETE FROM realm_characters WHERE id = ? AND player = ?').bind(id, playerId).run();
  return { ok: true };
}
