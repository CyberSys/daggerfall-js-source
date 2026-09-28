// @ts-check
// ═══════════════════════════════════════════════════════════════════
// REALM P1.2 — THE REALM'S CHARACTERS, CLIENT SIDE: the calls, and the
// playing tab's session - its lease, its sequence and its checkpoints.
//
// Mac: "A true separation while allowing people to still play offline";
// decision 1, "Account service". The service's half is
// server-account/src/realm.js; the plan is bible/06-Systems/Realm-Arc.md
// section 2.
//
// ═══ THE SERVICE IS THE TRUTH, SO THE SESSION FOLLOWS ITS WORD ════════
//
// A realm character's save is the service's. This tab plays it under a
// LEASE a join minted, and writes it at the NEXT SEQUENCE only. Three
// answers end the session, and the host takes the character offline:
// `lease` (another tab or device joined it), `no-realm-character` (it
// was deleted) and `auth` (signed out). One answer is resynced rather
// than obeyed: `seq` with the service's own sequence one ahead of ours
// is our own last checkpoint, landed with its answer lost - adopted,
// and the save retried at the next. A network failure keeps the newest
// save for the next checkpoint; nothing here throws.
//
// THE SAVE IS THE SNAPSHOT'S JSON - what a local slot holds under its
// data key (saveSlots.js saveSlot), so a copy to offline is a slot like
// any other, and a join's load parses what a slot load parses.
// ═══════════════════════════════════════════════════════════════════

import { storedSession, serviceBase, forgetSession, accountRefusalText } from '../net/accountClient.js';

/**
 * The service, as this device can reach it - or null when nobody is signed in (cloudSaves.js cloudIo's shape).
 * @param {{ fetch: (url: string, init: object) => Promise<any>, storage: any }} io
 */
export function realmIo({ fetch, storage }) {
  const session = storedSession(storage);
  if (!session) return null;
  return { fetch, base: serviceBase(storage), secret: session.secret, storage };
}

/**
 * ONE DOOR, the credential in a header and nowhere else (AUDIT-ACC F13). `raw` sends the save as text; a raw answer
 * comes back as `text` with the service's sequence. Never throws: a network failure is `{ ok: false, error: 'offline' }`.
 * @param {any} io @param {string} path
 * @param {{ method?: string, json?: any, raw?: string | null, headers?: Record<string, string>, keepalive?: boolean }} [opts]
 * @returns {Promise<any>}
 */
async function realmAsk(io, path, { method = 'GET', json = null, raw = null, headers: extra = {}, keepalive = false } = {}) {
  if (!io) return { ok: false, error: 'signed-out' };
  /** @type {Record<string, string>} */
  const headers = { accept: 'application/json', authorization: `Bearer ${io.secret}`, ...extra };
  if (json) headers['content-type'] = 'application/json';
  if (raw != null) headers['content-type'] = 'application/octet-stream';
  let res;
  try {
    res = await io.fetch(`${io.base}${path}`, {
      method, headers, body: json ? JSON.stringify(json) : (raw ?? undefined), ...(keepalive ? { keepalive: true } : {}),
    });
  } catch {
    return { ok: false, error: 'offline' };
  }
  const type = res.headers?.get?.('content-type') ?? '';
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    const error = typeof data?.error === 'string' ? data.error : 'server';
    if (error === 'auth') forgetSession(io.storage);   // accountClient.js's law: only `auth` signs out
    return { ok: false, error, status: res.status, ...(Number.isSafeInteger(data?.seq) ? { seq: data.seq } : {}) };
  }
  if (type.includes('json')) {
    try { return { ok: true, data: await res.json() }; } catch { return { ok: false, error: 'server' }; }
  }
  const seq = Number(res.headers?.get?.('x-realm-seq') ?? NaN);
  return { ok: true, text: await res.text(), ...(Number.isSafeInteger(seq) ? { seq } : {}) };
}

const realmSavePath = (/** @type {string} */ id) => `/v1/realm/${encodeURIComponent(id)}/data`;

/** Every realm character of the account, the one played last first. */
export const realmList = async (/** @type {any} */ io) => {
  const r = await realmAsk(io, '/v1/realm');
  return r.ok ? { ok: true, characters: Array.isArray(r.data?.characters) ? r.data.characters : [], max: r.data?.max ?? 0 } : r;
};
/** A character born online: `{ ok, data: { id, lease, seq } }`. */
export const realmCreate = (/** @type {any} */ io, /** @type {string} */ name, /** @type {any} */ summary = null) => realmAsk(io, '/v1/realm/create', { method: 'POST', json: { name, summary } });
/** An offline character brought in through customs, once: `{ ok, data: { id, lease, seq } }`. */
export const realmCustoms = (/** @type {any} */ io, /** @type {string} */ origin, /** @type {string} */ name, /** @type {any} */ summary = null) => realmAsk(io, '/v1/realm/customs', { method: 'POST', json: { origin, name, summary } });
/** A join: a new lease - `{ ok, data: { id, lease, seq, bytes } }`. */
export const realmJoin = (/** @type {any} */ io, /** @type {string} */ id) => realmAsk(io, '/v1/realm/join', { method: 'POST', json: { id } });
/** A leave: the lease given up. `keepalive` for the page's going. */
export const realmLeave = (/** @type {any} */ io, /** @type {string} */ id, /** @type {string} */ lease, { keepalive = false } = {}) => realmAsk(io, '/v1/realm/leave', { method: 'POST', json: { id, lease }, keepalive });
/** The player's own delete. */
export const realmDelete = (/** @type {any} */ io, /** @type {string} */ id) => realmAsk(io, '/v1/realm/delete', { method: 'POST', json: { id } });
/** The save as it stands: `{ ok, text, seq }` - a join's load, or a copy to offline. */
export const realmFetch = (/** @type {any} */ io, /** @type {string} */ id) => realmAsk(io, realmSavePath(id));
/** A checkpoint: the save's text under the lease at `seq`, the tile beside it. */
export const realmPut = (/** @type {any} */ io, /** @type {string} */ id, /** @type {{ lease: string, seq: number, summary?: any }} */ { lease, seq, summary = null }, /** @type {string} */ text) =>
  realmAsk(io, realmSavePath(id), {
    method: 'PUT', raw: text,
    headers: { 'x-realm-lease': lease, 'x-realm-seq': String(seq), ...(summary ? { 'x-realm-summary': JSON.stringify(summary) } : {}) },
  });

/** The answers that end a session: the character is not this tab's to write any more. */
export const REALM_LOST = Object.freeze(['lease', 'no-realm-character', 'auth', 'signed-out']);

/**
 * THE PLAYING TAB'S SESSION over one realm character: the lease a join minted and the sequence it answered. Checkpoints
 * go one at a time, in order; one asked while another is in flight waits, the newest replacing an older one that never
 * left. `onLost(error)` is called once, when the service says the character is no longer this tab's.
 * @param {{ io: any, id: string, lease: string, seq: number, onLost?: (error: string) => void }} at
 */
export function createRealmSession({ io, id, lease, seq, onLost = () => {} }) {
  let current = seq;
  /** @type {{ text: string, summary: any } | null} */
  let pending = null;
  /** @type {Promise<any> | null} */
  let running = null;
  /** @type {string | null} */
  let lost = null;
  const lose = (/** @type {string} */ error) => {
    if (lost) return;
    lost = error;
    try { onLost(error); } catch (e) { console.warn('[realm] the lost handler failed', e); }
  };
  async function drain() {
    /** @type {any} */
    let last = { ok: true, seq: current };
    while (pending && !lost) {
      const job = pending;
      pending = null;
      let r = await realmPut(io, id, { lease, seq: current + 1, summary: job.summary }, job.text);
      if (!r.ok && r.error === 'seq' && r.seq === current + 1) {
        // our own last checkpoint landed and its answer was lost: the service is one ahead - adopt it, and send this one
        current = r.seq;
        r = await realmPut(io, id, { lease, seq: current + 1, summary: job.summary }, job.text);
      }
      if (r.ok) { current = r.data?.seq ?? current + 1; last = { ok: true, seq: current }; continue; }
      if (REALM_LOST.includes(r.error) || r.error === 'seq') { lose(r.error); last = { ok: false, error: r.error }; break; }
      // offline, a busy service, the hour's bound: this save waits for the next checkpoint unless a newer one came
      if (!pending) pending = job;
      last = { ok: false, error: r.error };
      break;
    }
    return last;
  }
  const session = {
    id,
    get seq() { return current; },
    get lost() { return lost; },
    get waiting() { return !!pending; },
    /** A checkpoint of this save text; answers a promise of the outcome (the drain's, when one is running). */
    checkpoint(/** @type {string} */ text, /** @type {any} */ summary = null) {
      if (lost) return Promise.resolve({ ok: false, error: lost });
      pending = { text, summary };
      if (!running) running = drain().finally(() => { running = null; });
      return running;
    },
    /** The session's end: what is waiting is sent first (unless the page is going - `keepalive` sends the leave alone,
     *  which a browser can finish after the page is gone), then the lease given up. */
    async leave({ keepalive = false } = {}) {
      if (lost) return { ok: false, error: lost };
      if (!keepalive) { if (running) await running; if (pending) await session.checkpoint(pending.text, pending.summary); }
      lost = 'left';
      return realmLeave(io, id, lease, { keepalive });
    },
  };
  return session;
}

// ── REALM P1.3: THE DOOR'S AND THE BOOT'S HALVES ──────────────────────

/** The service's id shape (server-account/src/realm.js REALM_ID_RE), so a boot never asks for what no row can be. */
export const REALM_ID_SHAPE = /^r[0-9a-f]{20}$/;

/**
 * THE TILE A CHECKPOINT CARRIES: what the Online door shows of a character - the service keeps these and nothing else
 * (server-account/src/realm.js realmSummaryOf). Read off the live entity, the fields the local save's own tile reads.
 * @param {any} entity
 */
export function realmSummaryOf(entity) {
  return {
    level: Number.isSafeInteger(entity?.level) ? entity.level : null,
    className: typeof entity?.career?.name === 'string' ? entity.career.name : null,
    race: typeof entity?.race === 'string' ? entity.race : null,
    gender: entity?.gender === 'female' ? 'female' : 'male',
    face: Number.isSafeInteger(entity?.faceIndex) ? entity.faceIndex : null,
  };
}

/**
 * A REALM ROW AS A TILE'S SAVE (ui/saveTile.js's row): the name and the summary, with no local key - nothing here loads
 * from this device - and "Playing now" where the service says a lease is fresh.
 * @param {any} row @param {{ dateText?: (sec: number) => string | null }} [at]
 */
export function realmRowAsSave(row, { dateText = () => null } = {}) {
  const s = row?.summary ?? {};
  return {
    realmId: row?.id ?? null,
    name: row?.name || 'Unnamed',
    race: typeof s.race === 'string' ? s.race : null,
    gender: s.gender === 'female' ? 'female' : 'male',
    faceIndex: Number.isInteger(s.face) ? s.face : 0,
    career: typeof s.className === 'string' ? s.className : null,
    level: Number.isInteger(s.level) ? s.level : null,
    when: row?.playing ? 'Playing now' : (Number.isFinite(row?.updatedAt) ? dateText(row.updatedAt) : null),
    hour: null,
    saveName: row?.customs ? 'Brought in' : 'Online',
    unfinished: !(row?.bytes > 0),
  };
}

/**
 * THE BOOT'S JOIN: a new lease on the character, then its save read from the service - never a local slot - and
 * parsed as a slot load parses. The character's id in the save is the realm's (a customs character's save still names
 * the offline id it came from). Answers `{ ok, snap, lease, seq }` or `{ ok: false, error }`.
 * @param {{ io: any, id: string }} at
 */
export async function openRealmBoot({ io, id }) {
  if (!io) return { ok: false, error: 'signed-out' };
  if (typeof id !== 'string' || !REALM_ID_SHAPE.test(id)) return { ok: false, error: 'no-realm-character' };
  const joined = await realmJoin(io, id);
  if (!joined.ok) return { ok: false, error: joined.error };
  const { lease, seq, bytes } = joined.data ?? {};
  if (!(bytes > 0)) return { ok: false, error: 'no-data' };
  const got = await realmFetch(io, id);
  if (!got.ok) return { ok: false, error: got.error };
  let snap = null;
  try { snap = JSON.parse(got.text); } catch { snap = null; }
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return { ok: false, error: 'no-data' };
  snap.characterId = id;
  return { ok: true, snap, lease, seq: got.seq ?? seq };
}

/** A word for the Online door, carried across the page's reload (sessionStorage - this tab's alone). */
export const REALM_NOTICE_KEY = 'dagger.realm.notice';
export function setRealmNotice(/** @type {any} */ storage, /** @type {string} */ text) {
  try { storage?.setItem?.(REALM_NOTICE_KEY, String(text)); return true; } catch { return false; }
}
export function takeRealmNotice(/** @type {any} */ storage) {
  try {
    const t = storage?.getItem?.(REALM_NOTICE_KEY) ?? null;
    if (t != null) storage.removeItem(REALM_NOTICE_KEY);
    return t;
  } catch { return null; }
}

/**
 * THE URL THAT BOOTS A REALM CHARACTER: the online lane, the load door and the character's id - the one online boot
 * there is. Every other door key off it (onlineLane.js BOOT_DOOR_KEYS), so a stale load key never rides in.
 * @param {string} search @param {string} id @param {readonly string[]} doorKeys
 */
export function realmBootSearch(search, id, doorKeys) {
  const p = new URLSearchParams(search);
  for (const k of doorKeys) p.delete(k);
  p.set('online', '1');
  p.set('load', '1');
  p.set('realm', id);
  return `?${p.toString()}`;
}

/** The HUD's word when a save pressed online lands in the realm (scenes/shared.js realmSaveSink). */
export const REALM_SAVED_TEXT = 'Saved to the realm.';

/** A realm refusal in the Online door's words: the two this side names itself, the service's own through its table. */
export function realmRefusalText(/** @type {string} */ error) {
  if (error === 'signed-out') return 'Sign in - or continue as a guest - to play online.';
  if (error === 'no-data') return 'That online character was never saved. Delete it and make it again.';
  if (error === 'left') return 'You left the realm.';
  if (error === 'customs-load-once') return 'Load this character once offline, then it can be brought online.';
  if (error === 'test-room') return 'A Test Room character plays offline only.';
  if (error === 'no-room') return 'This device has no room for another save. Delete one, then copy again.';
  return accountRefusalText(error);
}
/** Said once the world stands, when an online boot carried no realm character (a stale address, a local save). */
export const REALM_OFFLINE_TEXT = 'Online characters live in the realm now, so this one plays offline. The Online door brings it in, once.';

/** How long the door to the title menu waits for a realm character's last checkpoint and leave (scenes/world.js). */
export const REALM_EXIT_WAIT_MS = 5_000;

/** REALM P1.3: A PAGE PUT AWAY (a phone's home button, another tab) - `fn` runs as it hides, while it still can send.
 *  The realm's own hook, kept here: the world host's frame loop answers to no page-lifecycle timer (AUDIT WORLD7/8). */
export function whenPageHides(/** @type {any} */ doc, /** @type {() => void} */ fn) {
  doc?.addEventListener?.('visibilitychange', () => { if (doc.visibilityState === 'hidden') fn(); });
}
