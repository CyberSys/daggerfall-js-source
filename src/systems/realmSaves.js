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
import { realmTradeRefusalText } from '../net/realmTradeLaw.js';   // REALM P2.1: a trade the realm settles
import { REALM_DOOR_WORD } from '../net/wire.js';   // REALM-DOOR: the relay's word for a token that names no realm character

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
/** HOUSE-LOSS: a customs whose first save never landed, undone - its home, guild place and customs given back to the
 *  offline character (server-account/src/realm.js undoRealm). Its own route: an older service answers `not-found`. */
export const realmUndo = (/** @type {any} */ io, /** @type {string} */ id) => realmAsk(io, '/v1/realm/undo', { method: 'POST', json: { id } });
/** The save as it stands: `{ ok, text, seq }` - a join's load, or a copy to offline. */
export const realmFetch = (/** @type {any} */ io, /** @type {string} */ id) => realmAsk(io, realmSavePath(id));
/** AUDIT REALM2 C5: A HEADER CARRIES BYTES - a value past U+00FF makes fetch throw (WHATWG: a ByteString), so a tile
 *  whose class name the player typed as Łowca, Маг, an emoji or a smart apostrophe failed every checkpoint as
 *  'offline', for good. Every character past ASCII rides as its JSON escape, which the service's JSON.parse reads back. */
const headerJson = (/** @type {any} */ v) => JSON.stringify(v).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
/** A checkpoint: the save's text under the lease at `seq`, the tile beside it. */
export const realmPut = (/** @type {any} */ io, /** @type {string} */ id, /** @type {{ lease: string, seq: number, summary?: any }} */ { lease, seq, summary = null }, /** @type {string} */ text) =>
  realmAsk(io, realmSavePath(id), {
    method: 'PUT', raw: text,
    headers: { 'x-realm-lease': lease, 'x-realm-seq': String(seq), ...(summary ? { 'x-realm-summary': headerJson(summary) } : {}) },
  });

/** REALM P2.1: a trade's half - `{ id, lease, seq, sid, give, get, pick }`; answers `{ state: 'waiting' | 'done' | 'refused' }`. */
export const realmTradeCall = (/** @type {any} */ io, /** @type {any} */ half) => realmAsk(io, '/v1/realm/trade', { method: 'POST', json: half });

/** The answers that end a session: the character is not this tab's to write any more. */
export const REALM_LOST = Object.freeze(['lease', 'no-realm-character', 'auth', 'signed-out']);
/** AUDIT REALM2 C8: a checkpoint's refusal that may clear if the save is sent again - no answer, the service's own
 *  trouble (5xx: its error, its storage or its database away) or the account's request rate. Any other (the save too
 *  big, a request the service cannot read) meets the same save again every time. */
const putMayClear = (/** @type {any} */ r) => REALM_ACT_TRANSIENT.includes(r.error) || r.status >= 500;

/**
 * THE PLAYING TAB'S SESSION over one realm character: the lease a join minted and the sequence it answered. Checkpoints
 * go one at a time, in order; one asked while another is in flight waits, the newest replacing an older one that never
 * left. `onLost(error)` is called once, when the service says the character is no longer this tab's.
 * @param {{ io: any, id: string, lease: string, seq: number, onLost?: (error: string) => void }} at
 */
export function createRealmSession({ io, id, lease, seq, onLost = () => {} }) {
  let current = seq;
  /** @type {{ text: string, summary: any, waiters: Array<(r: any) => void> } | null} */
  let pending = null;
  /** @type {Promise<any> | null} */
  let running = null;
  /** @type {string | null} */
  let lost = null;
  let holding = false;   // REALM P2: a transaction is in flight - no checkpoint goes until it is answered
  // AUDIT REALM L1-F2 / L2-F1: a put of this session whose answer never came (offline, the service's own error) - it may
  // have landed. Only then is the service one ahead of us our own write: any other move of the record is one this tab
  // does not hold (a settle it read as refused, an act it read as undone), and a checkpoint over it would destroy it.
  let unsure = false;
  const lose = (/** @type {string} */ error) => {
    if (lost) return;
    lost = error;
    try { onLost(error); } catch (e) { console.warn('[realm] the lost handler failed', e); }
  };
  /** AUDIT REALM2 C4: a save's callers told how the put that carried it went - once. */
  const answer = (/** @type {{ waiters: Array<(r: any) => void> }} */ job, /** @type {any} */ r) => { for (const settle of job.waiters.splice(0)) settle(r); };
  async function drain() {
    /** @type {any} */
    let last = { ok: true, seq: current };
    try {
      while (pending && !lost) {
        const job = pending;
        pending = null;
        let r = await realmPut(io, id, { lease, seq: current + 1, summary: job.summary }, job.text);
        if (!r.ok && r.error === 'seq' && r.seq === current + 1 && unsure) {
          // our own last checkpoint landed and its answer was lost: the service is one ahead - adopt it, and send this one
          current = r.seq;
          unsure = false;
          r = await realmPut(io, id, { lease, seq: current + 1, summary: job.summary }, job.text);
        }
        if (r.ok) { unsure = false; current = r.data?.seq ?? current + 1; last = { ok: true, seq: current }; answer(job, last); continue; }
        // AUDIT REALM2 C8: and a refusal no retry clears (the save too big) ends it too - it was kept and sent again at
        // every checkpoint for good, the host never told and F9 saying "saved"
        if (REALM_LOST.includes(r.error) || r.error === 'seq' || !putMayClear(r)) { lose(r.error); last = { ok: false, error: r.error }; answer(job, last); break; }
        // offline, a busy service, the hour's bound: this save waits for the next checkpoint unless a newer one came - and
        // an answer lost on the way (offline, the service's own error) may be a checkpoint that landed
        if (r.error === 'offline' || r.error === 'server') unsure = true;
        if (!pending) pending = job;
        last = { ok: false, error: r.error };
        answer(job, last);
        break;
      }
    } finally {
      // AUDIT REALM2 C4: a save still waiting never left - answered as the drain ended (the failure it queued behind, or
      // the session lost under it), and the next checkpoint carries it. The drain is over from THIS line: a checkpoint
      // asked a microtask later found it still running, started none, and was never answered
      if (pending) answer(pending, lost ? { ok: false, error: lost } : last);
      running = null;
    }
    return last;
  }
  const session = {
    id,
    get seq() { return current; },
    get lost() { return lost; },
    get waiting() { return !!pending; },
    /** A checkpoint of this save text; answers a promise of the outcome - the put that carried it, or a newer one's. */
    checkpoint(/** @type {string} */ text, /** @type {any} */ summary = null) {
      if (lost) return Promise.resolve({ ok: false, error: lost });
      // REALM P2: a save composed while a transaction is in flight holds its goods in flight - never sent; the outcome's
      // own checkpoint (the host's, as it applies the answer) is the next one
      if (holding) return Promise.resolve({ ok: false, error: 'held' });
      // AUDIT REALM2 C4: EACH CHECKPOINT ANSWERED BY THE PUT THAT CARRIED ITS SAVE - or, replaced before it left, by the
      // newer one's. All were answered with the drain's LAST put: a checkpoint that landed (the spoils it held banked on
      // the service) was told it failed when the one queued behind it did, and the spoils were handed again at a join
      return new Promise((settle) => {
        pending = { text, summary, waiters: [...(pending?.waiters ?? []), settle] };
        if (!running) running = drain();
      });
    },
    /**
     * REALM P2: A TRANSACTION over this character's record, settled by the service (a trade's half). Everything asked
     * before it lands first - the host checkpoints the save it reads just before - and while it runs no checkpoint is
     * sent, so the service moves the record it read and nothing overwrites the move before this tab adopts its sequence.
     * `call({ io, id, lease, seq })` answers `{ ok, seq? }`: a `seq` is the service's move, adopted. An answer that never
     * came (`unknown`) ends the session - this tab cannot know how its record stands, and only a join reads it.
     * @param {(at: { io: any, id: string, lease: string, seq: number }) => Promise<any>} call
     */
    async transact(call) {
      if (lost) return { ok: false, error: lost };
      if (holding) return { ok: false, error: 'busy', why: 'busy' };
      holding = true;
      try {
        if (running) await running;
        if (lost) return { ok: false, error: lost };
        if (pending) return { ok: false, error: 'offline', why: 'offline' };   // the save it must read never reached the service: nothing was asked
        const r = await call({ io, id, lease, seq: current });
        if (r?.ok && Number.isSafeInteger(r.seq) && r.seq > current) current = r.seq;
        if (r?.unknown) lose('unknown');
        else if (REALM_LOST.includes(r?.error)) lose(r.error);
        return r;
      } finally {
        holding = false;
      }
    },
    /** AUDIT REALM L2-F6: THE TAB CANNOT HOLD WHAT THE REALM NOW HOLDS (a settle whose goods this game refuses): the
     *  session ends as a lost answer does - to the door, where a join reads the record - never a checkpoint over it. */
    abandon(/** @type {string} */ error = 'unknown') { lose(error); },
    /** The session's end: what is waiting is sent first (unless the page is going - `keepalive` sends the leave alone,
     *  which a browser can finish after the page is gone), then the lease given up. */
    async leave({ keepalive = false } = {}) {
      if (lost) return { ok: false, error: lost };
      if (!keepalive) { if (running) await running; if (pending) await session.checkpoint(pending.text, pending.summary); }
      lost = 'left';
      return realmLeave(io, id, lease, { keepalive });
    },
    /** AUDIT REALM2 C2: THE PAGE CAME BACK from the back-forward cache, its lease given up as it went (pagehide): joined
     *  again - onto the record this tab left alone, at its own sequence (or one on: its own put whose answer was lost).
     *  A record moved meanwhile (another tab, another device) is not this tab's to write over: the session ends, and a
     *  join at the door reads it. */
    async rejoin() {
      if (lost !== 'left') return { ok: false, error: lost ?? 'joined' };
      const j = await realmJoin(io, id);
      const at = j.ok ? j.data?.seq : null;
      lost = null;
      if (!j.ok || !(at === current || (unsure && at === current + 1))) { lose(j.ok ? 'seq' : j.error); return { ok: false, error: lost }; }
      lease = j.data.lease;
      current = at;
      unsure = false;
      return { ok: true, seq: current };
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
 * the offline id it came from). Answers `{ ok, snap, lease, seq, origin }` - `origin` the offline id a customs
 * character came from, from the join (RESTORE) - or `{ ok: false, error }`.
 * @param {{ io: any, id: string }} at
 */
export async function openRealmBoot({ io, id }) {
  if (!io) return { ok: false, error: 'signed-out' };
  if (typeof id !== 'string' || !REALM_ID_SHAPE.test(id)) return { ok: false, error: 'no-realm-character' };
  const joined = await realmJoin(io, id);
  if (!joined.ok) return { ok: false, error: joined.error };
  const { lease, seq, bytes, origin = null } = joined.data ?? {};
  if (!(bytes > 0)) return { ok: false, error: 'no-data' };
  const got = await realmFetch(io, id);
  if (!got.ok) return { ok: false, error: got.error };
  let snap = null;
  try { snap = JSON.parse(got.text); } catch { snap = null; }
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return { ok: false, error: 'no-data' };
  snap.characterId = id;
  return { ok: true, snap, lease, seq: got.seq ?? seq, origin: typeof origin === 'string' ? origin : null };   // RESTORE: the offline id it came from
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
 * REALM-BIRTH (FIELD BUGS 2026-09-30, "crashed to the main menu" after online character creation): IT IS THE ONLINE
 * DOOR'S PLAY, KEY FOR KEY, AND IT NAMES ITS HOST. The door boots the world host in its own page with the classic start
 * beside these three (main.js's front door). A born character reaches that host by a reload (scenes/world.js
 * realmBirth), and main.js boots a game only on a scene door: this address had none, so it was the front door's, which
 * clears every door key, the realm id with them, and shows the menu. The make and the save had landed, so the Online
 * door played the character fine. test/fb0930_realmbirth.test.js holds the two boots to each other.
 * @param {string} search @param {string} id @param {readonly string[]} doorKeys
 */
export function realmBootSearch(search, id, doorKeys) {
  const p = new URLSearchParams(search);
  for (const k of doorKeys) p.delete(k);
  p.set('online', '1');
  p.set('load', '1');
  p.set('realm', id);
  p.set('classic', '1');   // REALM-BIRTH: the Online door's classic start - the start cell the load lands over
  p.set('world', '1');   // REALM-BIRTH: the world host's scene door (main.js) - the host the Online door boots
  return `?${p.toString()}`;
}

/** The HUD's word when a save pressed online lands in the realm (scenes/shared.js realmSaveSink). */
export const REALM_SAVED_TEXT = 'Saved to the realm.';
/** AUDIT REALM2 C2: ...and when it does not. */
export const REALM_NOT_SAVED_TEXT = 'Not saved to the realm.';
/** AUDIT REALM2 C2: the HUD's word for a save pressed online, from the realm's answer - "Saved" for a checkpoint that
 *  landed alone, else why not. */
export const realmSaveText = (/** @type {any} */ r) => (r?.ok ? REALM_SAVED_TEXT : `${REALM_NOT_SAVED_TEXT} ${realmRefusalText(r?.error ?? 'server')}`);
/** AUDIT REALM2 C2: THE WORD SAID ONCE THE REALM HAS ANSWERED (the realm's sink answers the checkpoint's outcome). It
 *  was said as the save was handed over, so a save the session refused - the page's leave already given, a trade in
 *  flight, no answer - still said "Saved to the realm." */
export function sayRealmSave(/** @type {any} */ outcome, /** @type {(text: string) => void} */ say) {
  return Promise.resolve(outcome).catch(() => null).then((r) => { try { say(realmSaveText(r)); } catch { /* the HUD went with its host */ } });
}

/** A realm refusal in the Online door's words: the two this side names itself, the service's own through its table. */
export function realmRefusalText(/** @type {string} */ error) {
  if (error === 'signed-out') return 'Sign in - or continue as a guest - to play online.';
  // HOUSE-LOSS: "Delete it and make it again" was said of a character brought in too, and its delete took the home
  // customs had carried. One brought in is finished from its offline tile, or undone - never made again.
  if (error === 'no-data') return 'That online character was never saved. One you brought in: press Bring online on it again, or undo it. One made online: delete it and make it again.';
  if (error === 'left') return 'You left the realm.';
  if (error === 'held') return 'A trade or a purchase is being settled - the save follows it.';   // AUDIT REALM2 C2: F9 mid-transaction
  if (error === 'too-large') return 'This character\'s save is too big for the realm to take. The realm keeps the last save it took.';   // AUDIT REALM2 C8
  if (error === 'customs-load-once') return 'Load this character once offline, then it can be brought online.';
  if (error === 'test-room') return 'A Test Room character plays offline only.';
  if (error === 'no-room') return 'This device has no room for another save. Delete one, then copy again.';
  if (error === 'unknown') return 'The realm did not answer about a trade in flight. Join again - the realm holds how it ended.';   // REALM P2.1
  return accountRefusalText(error);
}
/** Said once the world stands, when an online boot carried no realm character (a stale address, a local save). */
export const REALM_OFFLINE_TEXT = 'Online characters live in the realm now, so this one plays offline. The Online door brings it in, once.';

/** REALM-DOOR: HAS THE RELAY SHUT ITS DOOR ON THIS SESSION AS NO REALM CHARACTER'S? - a socket closed for good with the
 *  relay's own word (net/wire.js REALM_DOOR_WORD). The words are written for a build from before the realm, which prints
 *  them as they stand; a realm-era tab meets them only when its character stopped being its account's under it (deleted
 *  elsewhere, the account signed out and another in) - the realm's own end, which goes to the Online door with the
 *  realm's word, never the old build's "out of date". */
export const realmDoorShut = (/** @type {any} */ session) => !!session?.terminal && session.error === REALM_DOOR_WORD;

/** How long the door to the title menu waits for a realm character's last checkpoint and leave (scenes/world.js). */
export const REALM_EXIT_WAIT_MS = 5_000;

/** REALM P1.3: A PAGE PUT AWAY (a phone's home button, another tab) - `fn` runs as it hides, while it still can send.
 *  The realm's own hook, kept here: the world host's frame loop answers to no page-lifecycle timer (AUDIT WORLD7/8). */
export function whenPageHides(/** @type {any} */ doc, /** @type {() => void} */ fn) {
  doc?.addEventListener?.('visibilitychange', () => { if (doc.visibilityState === 'hidden') fn(); });
}
/** AUDIT REALM2 C2: THE PAGE GOING, AND COMING BACK - `gone` as the page is unloaded or put in the back-forward cache
 *  (pagehide: the unload guard's "Leave site?" already answered, so a Stay never reaches it), `back` as a page that
 *  cache kept is shown again (pageshow, persisted). `beforeunload` comes before that answer: no place to leave from. */
export function whenPageGoes(/** @type {any} */ win, /** @type {() => void} */ gone, /** @type {() => void} */ back) {
  win?.addEventListener?.('pagehide', () => { gone(); });
  win?.addEventListener?.('pageshow', (/** @type {any} */ e) => { if (e?.persisted) back(); });
}

// ── REALM P2.1: A TRADE THE REALM SETTLES ─────────────────────────────

/** How long a side asks the service how its trade stands before it calls the answer lost (the first half waits
 *  REALM_TRADE_TTL_S, 60 s, on the service; this is past it). */
export const REALM_TRADE_WAIT_MS = 90_000;
/** How often it asks while the other half has not come. */
export const REALM_TRADE_POLL_MS = 1_500;

/**
 * THIS SIDE'S HALF, sent and asked after until the service says how the trade ended - inside the session's
 * transaction, so no checkpoint goes meanwhile. `half` may be a promise: the transaction - and so the hold - begins at
 * this call, and the half follows once the goods are reserved (a null half abandons it). Answers `{ ok, seq, items,
 * gold }` (what this side received), `{ ok: false, why, text }` (refused: nothing moved) or `{ ok: false, unknown: true }`
 * (no answer - the session ends).
 * @param {{ session: any, half: any, wait?: (ms: number) => Promise<void>, now?: () => number }} at
 */
export async function settleRealmTradeHalf({ session, half, wait = (ms) => new Promise((r) => { setTimeout(r, ms); }), now = () => Date.now() }) {
  const r = await session.transact(async (/** @type {any} */ at) => {
    const h = await half;
    if (!h) return { ok: false, why: 'abandoned' };
    const until = now() + REALM_TRADE_WAIT_MS;
    for (;;) {
      const a = await realmTradeCall(at.io, { id: at.id, lease: at.lease, seq: at.seq, sid: h.sid, give: h.give, get: h.get, pick: h.pick });
      if (a.ok && a.data?.state === 'done') return { ok: true, seq: a.data.seq, items: Array.isArray(a.data.items) ? a.data.items : [], gold: a.data.gold ?? 0 };
      if (a.ok && a.data?.state === 'refused') return { ok: false, why: a.data.why ?? 'refused' };
      if (!a.ok && REALM_LOST.includes(a.error)) return { ok: false, error: a.error, why: a.error };
      // AUDIT REALM L2-F1: a record off the half's sequence - the service answers a settled trade's outcome before it looks
      // at the sequence (server-account/src/realmTrade.js), so this is a move this tab never made: only a join reads it
      if (!a.ok && a.error === 'seq') return { ok: false, unknown: true };
      // a sid another pair spent, a half that is no half: never registered, nothing moved
      if (!a.ok && (a.error === 'trade-spent' || a.status === 400)) return { ok: false, why: 'refused' };
      // waiting, or no answer at all (offline, the service busy): ask again - the half may have landed
      if (now() >= until) return { ok: false, unknown: true };
      await wait(REALM_TRADE_POLL_MS);
    }
  });
  return r.ok || r.unknown ? r : { ...r, text: realmTradeRefusalText(r.why ?? r.error ?? 'refused') };
}

/**
 * REALM P2.1: THE TRADE'S ESCROW over a realm session - what net/tradeSession.js hands its commit to. `hold()` runs
 * while the goods are still in the pack: the host's `checkpoint()` composes the save as it stands - what the service
 * settles against - and the session's hold begins at once, so the checkpoint the pack makes as the goods are reserved
 * (onlineCheckpoint.js checkpointedTradePack), a timer's or a hidden page's never goes: a record with the goods out and
 * nothing received would be what the service read. `settle(half)` sends the half; `release()` abandons a hold whose
 * goods could not be reserved.
 * @param {{ session: any, checkpoint: () => any, wait?: (ms: number) => Promise<void>, now?: () => number }} at
 */
export function realmTradeEscrow({ session, checkpoint, wait, now }) {
  return {
    hold() {
      // AUDIT REALM L1-F1: the service settles against the save composed HERE (its records are what the half picks) - a
      // host that refuses to compose one now (onlineCheckpoint: a duel, out of the seat) answers false, and nothing is held
      if (checkpoint() === false) return null;
      /** @type {(half: any) => void} */
      let hand = () => {};
      const half = new Promise((resolve) => { hand = resolve; });
      const outcome = settleRealmTradeHalf({ session, half, wait, now });   // the session holds from this line
      return {
        settle: (/** @type {any} */ h) => { hand(h); return outcome; },
        release: () => { hand(null); },
        abandon: () => { session.abandon('unknown'); },   // AUDIT REALM L2-F6: a settle this tab cannot hold
      };
    },
  };
}

// ── REALM P2.2: AN ACT THAT MOVES A REALM CHARACTER'S GOLD ON THE SERVICE ──

/** How many times an act asks again when its answer is lost, and how long it waits a time (ms, times the try). */
export const REALM_ACT_TRIES = 4;
export const REALM_ACT_RETRY_MS = 1_000;
/** AUDIT REALM L1-F2: the answers that say nothing about the act - no answer (offline), the service's own error, and the
 *  account's request rate, which the Worker answers before any route: asked again. */
export const REALM_ACT_TRANSIENT = Object.freeze(['offline', 'server', 'rate']);

/**
 * AN ACT THAT MOVES A REALM CHARACTER'S GOLD ON ITS RECORD - a guild's founding, deposit or withdrawal, a home, a piece
 * of decor (server-account/src/realm.js prepareRealmRecord). The save as it stands is checkpointed (`checkpoint`, the
 * host's) and the session's hold begins; `reserve()` then takes the gold out of the purse at once, as the old door did,
 * and answers its undo; `call(at)` asks the service, which moves the record's gold in the act's own batch - both or
 * neither. A refusal (the service's own word) undoes the reserve; an answer gives `apply()` its turn; either way the
 * outcome is checkpointed. A LOST ANSWER IS ASKED AGAIN with the same record: while the hold stands nothing else moves
 * the record, and every realm act answers where the record stands before any other word (AUDIT REALM L1-F2), so a `seq`
 * refusal one ahead, when the act was asked before, is this act, landed - and any other word is the act refused, nothing
 * moved. A `seq` on the first asking is a move this tab never made. Still lost after REALM_ACT_TRIES, the session ends
 * (`unknown`) with the gold where it is - only a join reads how the act ended.
 * `apply(answer)` gets the service's answer; an act whose client needs it (`needsAnswer` - a sale, whose refund the
 * service's price decides) cannot take a landed act without it, and ends the session instead.
 * @param {{ session: any, checkpoint: () => any, reserve?: (() => (() => void)) | null, apply?: ((answer: any) => void) | null,
 *   call: (at: { id: string, lease: string, seq: number }) => Promise<any>, wait?: (ms: number) => Promise<void>, needsAnswer?: boolean }} at
 */
export async function realmGoldAct({ session, checkpoint, reserve = null, apply = null, call, wait = (ms) => new Promise((r) => { setTimeout(r, ms); }), needsAnswer = false }) {
  checkpoint();
  const outcome = session.transact(async (/** @type {any} */ at) => {
    const where = { id: at.id, lease: at.lease, seq: at.seq };
    for (let i = 0; i < REALM_ACT_TRIES; i++) {
      const r = await call(where);
      if (r?.ok) return { ...r, seq: r.data?.realm?.seq ?? at.seq };   // the service says when the record moved; unsaid, it did not
      // AUDIT REALM L1-F2: every realm act answers where the record stands before any other word (server-account/src/
      // realm.js realmActFirst) - so a record one on, when this act was asked before and its answer lost, is this act,
      // landed; on its first asking, or any further on, it is a move nothing this tab sent made: only a join reads it
      if (r?.error === 'seq') return i > 0 && r.seq === at.seq + 1 && !needsAnswer ? { ok: true, landed: true, seq: r.seq } : { ok: false, error: 'offline', unknown: true };
      if (!REALM_ACT_TRANSIENT.includes(r?.error)) return r;   // the service's own word, asked where the record stands: nothing moved
      await wait(REALM_ACT_RETRY_MS * (i + 1));
    }
    return { ok: false, error: 'offline', unknown: true };
  });
  const undo = reserve ? reserve() : null;   // the hold began above: no checkpoint of the purse with it out goes
  const r = await outcome;
  if (r?.ok) apply?.(r);
  else if (!r?.unknown) undo?.();
  if (!r?.unknown) checkpoint();   // the outcome, at the record's next sequence
  return r;
}
