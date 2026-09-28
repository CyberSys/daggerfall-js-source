// @ts-check
// ═══════════════════════════════════════════════════════════════════
// NOTICE1 (2026-09-28) — THIS DEVICE'S NOTICE BOARDS: each town's board as the account service last said it, read
// through a minute's cache (PROF0 19: "a slow service shows the last good board"), what this device has already read
// of it (the count over the board is what it has not), and a note pinned, taken down or reported. The service keeps
// every note (server-account/src/board.js); the law both ends read is src/net/boardLaw.js.
//
// ASYNC NEVER DROPS. A pin carries its own request id, kept until the service answers it; a lost answer is asked
// again with the SAME id, which the service answers with the note it already made (`repeat`), never a second one. A
// second press while one is in flight is the same press (the promise is shared).
//
// Pure - the door, the storage and the clock are handed in - so the pins drive it without a network.
// ═══════════════════════════════════════════════════════════════════
import { BOARD_CACHE_MS, boardKeyOk, unseenCount, NOTE_ID_RE } from './boardLaw.js';
import { accountRefusalText } from './accountClient.js';

/** A moderator's chat word (PROF0 20: "`/note remove <id>`"): `{ op: 'remove', id }`, `{ error }` in words, or null
 *  when the line is not /note. NEVER GUARDED HERE (RED1's law): whether this player may is the service's question. */
export const NOTE_USAGE = 'Usage: /note remove <note id> - the id a moderator sees on the note.';
export function parseNoteCommand(text) {
  const m = /^\/note(?:\s+([\s\S]*))?$/i.exec(String(text ?? '').trim());
  if (!m) return null;
  const [op, id, ...more] = (m[1] ?? '').trim().split(/\s+/).filter(Boolean);
  if (String(op ?? '').toLowerCase() !== 'remove' || !id || more.length || !NOTE_ID_RE.test(id)) return { error: NOTE_USAGE };
  return { op: 'remove', id };
}

/** Where this device keeps what it has read: { [mapId]: unix seconds of the newest note seen }. */
export const NOTICE_SEEN_KEY = 'notice1.seen';
/** The towns remembered, newest first - a player who wanders the Bay does not grow the key for ever. */
export const NOTICE_SEEN_MAX = 200;
/** How many times one press asks before it gives the player the answer it has. */
export const NOTICE_TRIES = 3;
/** The answers a write is asked again after (the service did not say no): the network, the service's own fault. */
const RETRY = Object.freeze(['offline', 'server']);

/** A request id: `n` and fifteen of base 36, from the handed-in randomness (crypto's by default). */
export function mintNoticeRid(rand = (b) => globalThis.crypto.getRandomValues(b)) {
  const b = new Uint8Array(15);
  rand(b);
  return `n${[...b].map((x) => (x % 36).toString(36)).join('')}`;
}

/**
 * @param {{
 *   door: ReturnType<typeof import('./accountClient.js').accountBoard>,
 *   storage?: { getItem: (k: string) => (string|null), setItem: (k: string, v: string) => void }|null,
 *   nowMs?: () => number,
 *   rid?: () => string,
 * }} deps
 */
export function createNoticeBook({ door, storage = null, nowMs = () => Date.now(), rid = () => mintNoticeRid() }) {
  /** mapId -> { board, at, error, pending } */
  const boards = new Map();
  /** whether the board is open to this account, as the last read said: true, false, or null not yet asked */
  let open = null;
  let _seenMemory = null;   // the seen table, when the storage refuses writes

  const seenTable = () => {
    if (_seenMemory) return _seenMemory;
    try {
      const v = JSON.parse(storage?.getItem?.(NOTICE_SEEN_KEY) ?? 'null');
      if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    } catch { /* a bad key reads as none */ }
    return {};
  };
  const writeSeen = (t) => {
    const keep = Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, NOTICE_SEEN_MAX);
    const table = Object.fromEntries(keep);
    try { storage?.setItem?.(NOTICE_SEEN_KEY, JSON.stringify(table)); _seenMemory = null; } catch { _seenMemory = table; }
  };

  async function ask(fn) {
    let r = null;
    for (let i = 0; i < NOTICE_TRIES; i++) {
      try { r = await fn(); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok || !RETRY.includes(r?.error)) return r;
    }
    return r;
  }

  /** The board of town `map`: the last answer inside a minute - a board or a refusal alike, so a town stood in at `dev`
   *  asks the service once a minute and not once a second - else the service's, the last good board kept when it fails. */
  function read(map, { force = false } = {}) {
    if (!boardKeyOk(map)) return Promise.resolve({ board: null, error: 'bad-board', stale: false });
    const e = boards.get(map) ?? { board: null, at: -Infinity, error: null, pending: null };
    boards.set(map, e);
    if (!force && nowMs() - e.at < BOARD_CACHE_MS) return Promise.resolve({ board: e.board, error: e.error, stale: !!(e.error && e.board) });
    if (e.pending) return e.pending;
    e.pending = (async () => {
      const r = await ask(() => door.read(map));
      e.pending = null;
      if (r?.ok) {
        open = true; e.board = r.data; e.at = nowMs(); e.error = null;
        return { board: e.board, error: null, stale: false };
      }
      if (r?.error === 'board-closed') { open = false; e.board = null; }
      e.error = r?.error ?? 'server';
      e.at = nowMs();   // a refusal is an answer too: asked again after the minute, not on the next frame
      return { board: e.board, error: e.error, stale: !!e.board };
    })();
    return e.pending;
  }

  /** What a read would show without asking: the cached board, or null. */
  const cached = (map) => boards.get(map)?.board ?? null;
  const forget = (map) => { const e = boards.get(map); if (e) e.at = -Infinity; };

  /** When this device last read town `map`'s board (unix seconds of its newest note then), or null. */
  const seenAt = (map) => { const v = seenTable()[String(map)]; return Number.isFinite(v) ? v : null; };
  /** The board read to its newest note: the count over it goes to nought. */
  function markSeen(map) {
    const b = cached(map);
    if (!b) return;
    const newest = Math.max(0, ...[...(b.notices ?? []), ...(b.notes ?? [])].map((x) => (Number.isFinite(x.at) ? x.at : 0)));
    const t = seenTable();
    if ((t[String(map)] ?? -1) >= newest) return;
    t[String(map)] = newest;
    writeSeen(t);
  }
  /** The count that floats over town `map`'s boards: what this device has not read. */
  const unseen = (map) => { const b = cached(map); return b ? unseenCount(b, seenAt(map)) : 0; };

  /** A write, then the board read again (the answer the window repaints from). */
  async function write(map, fn, okText) {
    const r = await ask(fn);
    if (r?.ok) { forget(map); await read(map, { force: true }); return { ok: true, data: r.data, text: okText }; }
    return { ok: false, error: r?.error ?? 'server', text: accountRefusalText(r?.error) };
  }

  /** mapId -> the pin in flight (its promise), so a second press is the same press. */
  const pinning = new Map();

  return {
    read, cached, markSeen, seenAt, unseen,
    /** Whether the board is open to this account, as the last read said (null before any). */
    get open() { return open; },
    /**
     * PIN A NOTE on town `map`'s board - its request id minted once and kept until the service answers it.
     * @param {number} map
     * @param {{ subject: string, body: string, days: number, button?: string|null, character?: string|null }} note
     */
    pin(map, note) {
      if (pinning.has(map)) return pinning.get(map);
      const id = rid();
      const p = write(map, () => door.pin({ map, ...note }, id), 'Your note is pinned up.')
        .finally(() => pinning.delete(map));
      pinning.set(map, p);
      return p;
    },
    takeDown: (map, id) => write(map, () => door.takeDown(id), 'Your note is taken down.'),
    /** The chat's `/note remove <id>`: a moderator's remove from anywhere - every cached board is read afresh after. */
    async modRemoveAnywhere(id) {
      const r = await ask(() => door.modRemove(id));
      for (const e of boards.values()) e.at = -Infinity;
      return r?.ok ? { ok: true, text: 'The note is removed.' } : { ok: false, error: r?.error ?? 'server', text: accountRefusalText(r?.error) };
    },
    report: (map, id) => write(map, () => door.report(id), 'Reported. You will not see that note again.'),
    modRemove: (map, id) => write(map, () => door.modRemove(id), 'The note is removed.'),
    modRestore: (map, id) => write(map, () => door.modRestore(id), 'The note is restored.'),
    notice: (map, n) => write(map, () => door.notice(n), 'The notice is up on every board.'),
    noticeRemove: (map, id) => write(map, () => door.noticeRemove(id), 'The notice is taken down.'),
    /** Test seam. */
    _entry: (map) => boards.get(map) ?? null,
  };
}
