// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Begin!") — THIS DEVICE'S PROFESSIONS: the
// character's tracks, Stores and day as the account service last said
// them, its streamed pixels' witnessed states, the harvests on their way,
// the withdrawals to the pack, the region's Court writs and a delivery.
// The service keeps every unit and point (server-account/src/
// professions.js); the laws both ends read are src/net/professionLaw.js
// and src/net/nodeLaw.js.
//
// ASYNC NEVER DROPS (PROF0 17.2, 19). A harvest carries its own request
// id and is KEPT (PROF_KEPT_KEY) until the service answers it - asked
// again with the same id, which the service answers with the harvest it
// already made (`repeat`), never a second - for up to ten minutes (the
// service's own bound on an act's end); a harvest whose UTC day ends
// first lapses, and the host says so. The node greys only when the
// service confirms; until then it is "being counted", and no second act
// is played on it. A withdrawal is kept the same way until its items are
// minted into the pack - once, on the answer that says what it took. A
// delivery's and a choice's id is kept until an answer comes, so a press
// after a lost answer is the same act, never a second.
//
// KEPT ACTS ARE THEIR ACCOUNT'S AND CHARACTER'S (MARKS1's AUDIT 28 M2
// rule): each (account, character) keeps its own, asked again only under
// them, and let go only on a refusal the service gives after it looked
// for the act's row - every refusal but the network's, the service's own
// fault, the account's rate and a missing session.
//
// Pure - the door, the storage, the clock and the ids are handed in - so
// the pins drive it without a network.
// ═══════════════════════════════════════════════════════════════════
import { HARVEST_LATE_S } from './professionLaw.js';
import { pixelKey } from './nodeLaw.js';
import { accountRefusalText } from './accountClient.js';

/** Where this device keeps the acts whose answers did not come: { [account|character]: { harvests, withdrawals } }. */
export const PROF_KEPT_KEY = 'prof1.kept';
/** A kept harvest is asked again for this long after its act, then let go (the service would call it late). */
export const PROF_QUEUE_MS = HARVEST_LATE_S * 1000;
/** How many times one ask tries before the act is left kept, and the waits between the tries (ms). */
export const PROF_TRIES = 3;
export const PROF_RETRY_MS = Object.freeze([400, 1500]);
/** The waits between a kept harvest's asks, by how often it has been asked (ms). */
export const PROF_PUMP_MS = Object.freeze([2_000, 5_000, 15_000, 30_000]);
/** A region's Court writs are read through a minute's cache (the board's own, PROF0 19). */
export const PROF_WRITS_CACHE_MS = 60_000;
/** The pixels one read asks after (the service's PIXELS_READ_MAX). */
export const PROF_PIXELS_MAX = 25;
/** PROF2: the dungeons one read asks after (the service's DUNGEONS_READ_MAX). */
export const PROF_DUNGEONS_MAX = 4;
/** AUDIT 29 C1: a read the service did not answer is not asked again for this long (the pages drew one a frame); a
 *  read answered for another UTC day than this device's (the two clocks either side of midnight) is not stale again
 *  before it either. */
export const PROF_REFRESH_BACKOFF_MS = 30_000;
/** AUDIT 29 C8: a shut switch is asked again this often - it opens without a reload. */
export const PROF_CLOSED_RECHECK_MS = 300_000;
/** The answers an act is asked again after: the network, the service's own fault, the account's minute spent. */
const RETRY = Object.freeze(['offline', 'server', 'rate']);
/** The answers that say nothing about the act's row - kept, and asked again once there is a session. */
const WAIT = Object.freeze(['no-session', 'auth']);
/** The answers that say the professions are not this account's now. */
const SHUT = Object.freeze(['prof-closed', 'prof-need-account']);
const keptAnswer = (r) => RETRY.includes(r?.error) || WAIT.includes(r?.error);

/** A request id: `p` and fifteen of base 36, from the handed-in randomness (crypto's by default). */
export function mintProfRid(rand = (b) => globalThis.crypto.getRandomValues(b)) {
  const b = new Uint8Array(15);
  rand(b);
  return `p${[...b].map((x) => (x % 36).toString(36)).join('')}`;
}
/** The UTC day of an instant (ms). */
const dayOf = (ms) => Math.floor(ms / 86_400_000);

/**
 * @param {{
 *   door: ReturnType<typeof import('./accountClient.js').accountProf>,
 *   storage?: { getItem: (k: string) => (string|null), setItem: (k: string, v: string) => void }|null,
 *   character?: () => (string|null),
 *   now?: () => number,
 *   rid?: () => string,
 *   sleep?: (ms: number) => Promise<void>,
 * }} deps `character` the character this device plays now; `now` the shared clock's wall time (ms)
 */
export function createProfBook({ door, storage = null, character = () => null, now = () => Date.now(), rid = () => mintProfRid(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  const state = {
    /** whether the professions are this account's: true, false, or null not yet asked */
    open: /** @type {boolean|null} */ (null),
    day: /** @type {number|null} */ (null),
    character: /** @type {string|null} */ (null),
    /** AUDIT 29 C8: the account the state was read under - another account's state is stale */
    account: /** @type {string|null} */ (null),
    /** when the state was last read, answered or not (ms) */
    readAt: -Infinity,
    tracks: new Map(),
    today: /** @type {Record<string, number>} */ ({}),
    taken: new Set(),
    stores: new Map(),
    writs: { today: 0, max: 3 },
    caps: /** @type {any} */ (null),
    /** PROF3: the account's Marks as the smith's stock last answered them, or null */
    marks: /** @type {number|null} */ (null),
  };
  const account = () => { try { return door.account?.() ?? null; } catch { return null; } };
  const slot = () => `${account() ?? ''}|${character() ?? ''}`;

  // ─── THE KEPT ACTS ─────────────────────────────────────────────────
  let _memory = null;
  const table = () => {
    if (_memory) return _memory;
    try {
      const v = JSON.parse(storage?.getItem?.(PROF_KEPT_KEY) ?? 'null');
      return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    } catch { return {}; }
  };
  const writeTable = (t) => {
    try { storage?.setItem?.(PROF_KEPT_KEY, JSON.stringify(t)); _memory = null; } catch { _memory = t; }
  };
  const keptOf = (key = slot()) => {
    const k = table()[key];
    return {
      harvests: Array.isArray(k?.harvests) ? k.harvests : [], withdrawals: Array.isArray(k?.withdrawals) ? k.withdrawals : [],
      crafts: Array.isArray(k?.crafts) ? k.crafts : [],   // PROF3: a craft asked and not yet answered - its pieces minted on the answer
    };
  };
  const writeKept = (kept, key = slot()) => {
    const t = { ...table() };
    if (kept.harvests.length || kept.withdrawals.length || kept.crafts?.length) t[key] = kept; else delete t[key];
    writeTable(t);
  };

  /** One ask, up to PROF_TRIES times with a wait between; the service's no is final at once. */
  async function ask(fn) {
    let r = null;
    for (let i = 0; i < PROF_TRIES; i++) {
      if (i > 0) await sleep(PROF_RETRY_MS[Math.min(i - 1, PROF_RETRY_MS.length - 1)]);
      try { r = await fn(); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok || !RETRY.includes(r?.error)) return r;
    }
    return r;
  }
  const shutBy = (r) => { if (SHUT.includes(r?.error)) { state.open = false; state.account = account(); } };

  // ─── WHAT THE SERVICE SAID ─────────────────────────────────────────
  const applyTrack = (t) => { if (t && typeof t.profession === 'string') state.tracks.set(t.profession, t); };
  const applyStore = (s) => {
    if (!s || typeof s.material !== 'string') return;
    if ((s.own | 0) + (s.bought | 0) > 0) state.stores.set(s.material, { material: s.material, own: s.own | 0, bought: s.bought | 0 });
    else state.stores.delete(s.material);
  };
  function apply(data) {
    state.open = true;
    state.account = account();
    state.day = Number.isSafeInteger(data?.day) ? data.day : dayOf(now());
    state.character = data?.character ?? character();
    state.tracks = new Map();
    for (const t of data?.tracks ?? []) applyTrack(t);
    state.today = data?.today && typeof data.today === 'object' ? { ...data.today } : {};
    state.taken = new Set(Array.isArray(data?.taken) ? data.taken : []);
    state.stores = new Map();
    for (const s of data?.stores ?? []) applyStore(s);
    if (data?.writs) state.writs = { today: data.writs.today | 0, max: data.writs.max | 0 };
    state.caps = data?.caps ?? null;
  }

  /** The pixels' states, as the service last said them this UTC day: 'x,y' -> { day, state, climate?, region? }. */
  const pixels = new Map();
  /** PROF2: the dungeons' states the same way: id -> { day, state, climate?, region? }. */
  const dungeons = new Map();
  let _pixelsBusy = null;
  /** The writs' cache: region -> { at, data, error }. */
  const writCache = new Map();
  /** A delivery's or a choice's request id, kept until an answer comes. */
  const ids = new Map();
  const idFor = (key, maxAgeMs = Infinity) => {
    let v = ids.get(key);
    // AUDIT 29 C6: a kept id older than its bound is forgotten - past the service's ten minutes it can only catch a
    // later, deliberate act of the same shape and answer it with the old one's `repeat`
    if (v && !v.promise && now() - v.at > maxAgeMs) v = null;
    if (!v) ids.set(key, v = { id: rid(), promise: null, at: now() });
    return v;
  };
  /** AUDIT 29 C1: the state's one read on the wire, and the last one's answer */
  let _refresh = null;
  let _lastRead = { at: -Infinity, key: '', r: null };
  let _pump = null;
  /** PROF2: the kept harvests on the wire - a pump never asks one again while its first ask waits (its answer said once). */
  const sending = new Set();
  let _withdrawBusy = null;
  let _craftBusy = null;   // PROF3: one craft at a time, asked or settled

  const book = {
    state,
    /** The character's professions, from the service - on arrival online, at the UTC day's turn, and after a character
     *  change. A closed switch or a guest reads `open` false. */
    async refresh({ force = false } = {}) {
      const c = character();
      if (!c) return { ok: false, error: 'prof-character' };
      // AUDIT 29 C1: one read at a time, shared by every press; an unanswered read not asked again inside its backoff
      // (the pages asked every draw, and a read that failed left them stale - a loop that starved the tab)
      if (_refresh) return _refresh;
      const key = `${account() ?? ''}|${c}`;
      if (!force && _lastRead.key === key && !_lastRead.r?.ok && now() - _lastRead.at < PROF_REFRESH_BACKOFF_MS) return _lastRead.r;
      _refresh = (async () => {
        const r = await ask(() => door.state(c));
        if (r?.ok) apply(r.data);
        else shutBy(r);
        state.readAt = now();
        _lastRead = { at: state.readAt, key, r };
        return r;
      })().finally(() => { _refresh = null; });
      return _refresh;
    },
    /** Whether the state read is stale: another account or character now, or another UTC day - a day the service
     *  answered otherwise not again inside the backoff (AUDIT 29 C1); a shut switch only after its recheck (C8). */
    stale() {
      if (state.open === false) return account() !== state.account || now() - state.readAt >= PROF_CLOSED_RECHECK_MS;
      if (state.character !== character() || state.account !== account()) return true;
      return state.day !== dayOf(now()) && now() - state.readAt >= PROF_REFRESH_BACKOFF_MS;
    },
    /** A track as the service last said it (never null: a profession not worked yet is at nothing). */
    track(profession) { return state.tracks.get(profession) ?? { profession, xp: 0, rank: 0, specs: { 50: null, 100: null }, respec: null }; },
    /** One material's count in the Stores, own and bought. */
    store(material) { return state.stores.get(material) ?? { material, own: 0, bought: 0 }; },
    held(material) { const s = this.store(material); return s.own + s.bought; },

    // ─── THE PIXELS ─────────────────────────────────────────────────
    /** A streamed pixel's witnessed state today, or null not yet asked. */
    pixel(x, y) { const p = pixels.get(pixelKey(x, y)); return p && p.day === dayOf(now()) ? p : null; },
    /** Asks after the pixels not yet known today, PROF_PIXELS_MAX at a time, one read in flight. Answers the pixels
     *  whose state is new (the host re-stands their patches). */
    async askPixels(list) {
      if (_pixelsBusy || state.open === false) return [];
      const c = character();
      const day = dayOf(now());
      const want = (list ?? []).filter(([x, y]) => pixels.get(pixelKey(x, y))?.day !== day).slice(0, PROF_PIXELS_MAX);
      if (!c || !want.length) return [];
      _pixelsBusy = (async () => {
        const r = await ask(() => door.pixels(c, want));
        if (!r?.ok) { shutBy(r); return []; }
        const changed = [];
        for (const p of r.data?.pixels ?? []) {
          const k = pixelKey(p.x, p.y);
          const before = pixels.get(k);
          pixels.set(k, { day, state: p.state, climate: p.climate ?? null, region: p.region ?? null });
          if (!before || before.state !== p.state) changed.push(p);
        }
        return changed;
      })().finally(() => { _pixelsBusy = null; });
      return _pixelsBusy;
    },

    // ─── THE DUNGEONS (PROF2) ───────────────────────────────────────
    /** A dungeon's witnessed state today (its id DFU's MapId & 0xfffff), or null not yet asked. */
    dungeon(id) { const d = dungeons.get(id); return d && d.day === dayOf(now()) ? d : null; },
    /** Asks after a dungeon not yet known today, beside no pixels - one read in flight. Answers whether its state is
     *  new (the dungeon's veins stand again). */
    async askDungeon(id) {
      if (_pixelsBusy || state.open === false || this.dungeon(id)) return false;
      const c = character();
      if (!c) return false;
      const day = dayOf(now());
      _pixelsBusy = (async () => {
        const r = await ask(() => door.pixels(c, [], [id]));
        if (!r?.ok) { shutBy(r); return []; }
        const d = (r.data?.dungeons ?? []).find((x) => x.id === id);
        const before = dungeons.get(id);
        dungeons.set(id, { day, state: d?.state ?? 'none', climate: d?.climate ?? null, region: d?.region ?? null });
        return !before || before.state !== (d?.state ?? 'none') ? [id] : [];
      })().finally(() => { _pixelsBusy = null; });
      return (await _pixelsBusy).length > 0;
    },

    // ─── A HARVEST ──────────────────────────────────────────────────
    /** Whether a node's kind is taken today - by the service's word, or on its way to it (being counted). */
    taken(node, kind) { return state.taken.has(`${node}|${kind}`); },
    counting(node, kind) { return keptOf().harvests.some((h) => h.node === node && h.kind === kind); },
    /**
     * A NODE HARVESTED: `{ node, kind, climate, region, act, at }` (the act's end, epoch seconds on the shared clock) -
     * kept with its own id, then asked. Answers `{ ok: true, data }` (the service's harvest), `{ ok: false, error }` (the
     * service's no - the act is let go), or `{ ok: false, kept: true }` (no answer yet - kept, and `pump` asks again).
     */
    async harvest(req) {
      const key = slot();
      const c = character();
      if (!c) return { ok: false, error: 'prof-character' };
      const h = { ...req, character: c, rid: rid(), queuedAt: now(), tries: 0, nextAt: 0 };
      const kept = keptOf(key);
      kept.harvests.push(h);
      writeKept(kept, key);
      return send(h, key);
    },
    /** How many harvests wait on the service. */
    get pendingHarvests() { return keptOf().harvests.length; },
    /**
     * THE KEPT HARVESTS ASKED AGAIN, each at its own pace (PROF_PUMP_MS) - every frame the host asks; one pump at a
     * time. `onAnswer(h, r)` for each that ends: answered, refused, or lapsed (`r.error` 'lapsed' - its ten minutes out,
     * or its UTC day over).
     */
    /** @param {(h: any, r: any, rankBefore?: number) => void} [onAnswer] */
    pump(onAnswer = () => {}) {
      if (_pump) return _pump;
      const key = slot();
      const due = keptOf(key).harvests.filter((h) => (h.nextAt ?? 0) <= now() && !sending.has(h.rid));
      if (!due.length) return null;
      _pump = (async () => {
        for (const h of due) {
          const lapsed = now() - h.queuedAt > PROF_QUEUE_MS || dayOf(h.at * 1000) !== dayOf(now());
          if (lapsed) { drop(h.rid, key); onAnswer(h, { ok: false, error: 'lapsed' }); continue; }
          // AUDIT 29 C4: the rank before the answer, handed to the caller - `send` applies the new track first, and a
          // rise read after it was no rise (no toast, no banner)
          const ranks = new Map([...state.tracks].map(([p, t]) => [p, t.rank]));
          const r = await send(h, key);
          if (!r.kept) onAnswer(h, r, ranks.get(r?.data?.track?.profession) ?? 0);
        }
      })().finally(() => { _pump = null; });
      return _pump;
    },

    // ─── WITHDRAW TO THE PACK ───────────────────────────────────────
    /**
     * `qty` of `material` out of the Stores, and `mint(material, qty)` - the host's, into the pack - once, on the
     * service's answer. Kept when no answer comes, and minted when `settle` hears it. One at a time.
     * @returns {Promise<{ ok: boolean, text: string, kept?: boolean }>}
     */
    async withdraw(material, qty, mint) {
      if (_withdrawBusy) return { ok: false, text: 'The Stores are still counting your last withdrawal.' };
      const key = slot();
      const c = character();
      if (!c || !account()) return { ok: false, text: accountRefusalText('no-session') };
      _withdrawBusy = (async () => {
        const w = { rid: rid(), material, qty, character: c };
        const kept = keptOf(key);
        kept.withdrawals.push(w);
        writeKept(kept, key);
        return settleOne(w, key, mint);
      })().finally(() => { _withdrawBusy = null; });
      return _withdrawBusy;
    },
    /** The kept withdrawals of this account's character, asked again - their items minted as each is answered; and,
     *  given `mintPieces` (PROF3), its kept crafts, their pieces minted as each is answered. */
    async settle(mint, mintPieces = null) {
      if (_withdrawBusy) return [];
      const key = slot();
      const out = [];
      _withdrawBusy = (async () => {
        for (const w of keptOf(key).withdrawals) out.push(await settleOne(w, key, mint));
        return out;
      })().finally(() => { _withdrawBusy = null; });
      await _withdrawBusy;
      if (mintPieces && !_craftBusy && keptOf(key).crafts.length) {
        _craftBusy = (async () => {
          const done = [];
          for (const w of keptOf(key).crafts) done.push(await craftOne(w, key, mintPieces));
          return done;
        })().finally(() => { _craftBusy = null; });
        out.push(...await _craftBusy);
      }
      return out;
    },
    get pendingWithdrawals() { return keptOf().withdrawals.length; },

    // ─── A CRAFT AT THE ANVIL (PROF3) ───────────────────────────────
    /**
     * A recipe made at the anvil (net/recipeLaw.js): `clean` the heat's report (the service lays one step on it at most),
     * `name` the maker's mark. The craft is KEPT before it is asked - its pieces are the save's once the service answers,
     * so a lost answer is asked again (the same id, the same pieces) and `mint` makes them on the answer, once: the tab
     * that lets the craft go mints it (AUDIT 29 C5's law). One at a time.
     * @returns {Promise<{ ok: boolean, data?: any, error?: string, kept?: boolean, elsewhere?: boolean }>}
     */
    async craft(recipe, { clean = false, name = null } = {}, mint) {
      if (_craftBusy) return { ok: false, error: 'prof-busy' };
      const key = slot();
      const c = character();
      if (!c || !account()) return { ok: false, error: 'no-session' };
      _craftBusy = (async () => {
        const w = { rid: rid(), recipe, clean: clean === true, name: typeof name === 'string' ? name : null, character: c };
        const kept = keptOf(key);
        kept.crafts.push(w);
        writeKept(kept, key);
        return craftOne(w, key, mint);
      })().finally(() => { _craftBusy = null; });
      return _craftBusy;
    },
    get pendingCrafts() { return keptOf().crafts.length; },
    /** The smith's stock (PROF3): `qty` of a fitting bought into the Stores for Marks. The id is kept until an answer
     *  comes, so a press after a lost answer is the same purchase. Answers the service's answer; the Stores moved. */
    async stock(material, qty) {
      const c = character();
      if (!c) return { ok: false, error: 'prof-character' };
      const key = `stock|${slot()}|${material}|${qty}`;
      const m = idFor(key, PROF_QUEUE_MS);
      if (m.promise) return m.promise;
      m.promise = (async () => {
        const r = await ask(() => door.stock(c, material, qty, m.id));
        m.promise = null;
        if (!keptAnswer(r)) ids.delete(key);
        if (r?.ok) { applyStore(r.data?.store); if (Number.isSafeInteger(r.data?.balance)) state.marks = r.data.balance; } else shutBy(r);
        return r;
      })();
      return m.promise;
    },

    // ─── COURT WRITS ────────────────────────────────────────────────
    /** A region's Court writs through a minute's cache; `force` reads now. Answers `{ data, error, stale }`. */
    async writs(region, { force = false } = {}) {
      const c = character();
      const hit = writCache.get(region);
      if (!force && hit && now() - hit.at < PROF_WRITS_CACHE_MS) return { data: hit.data, error: hit.error, stale: false };
      const r = c ? await ask(() => door.writs(c, region)) : { ok: false, error: 'prof-character' };
      if (r?.ok) {
        writCache.set(region, { at: now(), data: r.data, error: null });
        if (r.data?.today) state.writs = { today: r.data.today.filled | 0, max: r.data.today.max | 0 };
        return { data: r.data, error: null, stale: false };
      }
      shutBy(r);
      if (hit?.data) return { data: hit.data, error: r?.error ?? 'offline', stale: true };   // a slow service shows the last good list
      // AUDIT 29 C11: a read that failed is kept for the backoff, not the minute a good list is
      writCache.set(region, { at: now() - PROF_WRITS_CACHE_MS + PROF_REFRESH_BACKOFF_MS, data: null, error: r?.error ?? 'offline' });
      return { data: null, error: r?.error ?? 'offline', stale: false };
    },
    /** A COURT WRIT TAKEN - delivered from the Stores. The id is the writ's own until an answer comes. Answers the
     *  service's answer (`{ ok, data }` or `{ ok: false, error }`), the book's state and the writ's cache moved with it. */
    async deliver(writId, region) {
      const c = character();
      if (!c) return { ok: false, error: 'prof-character' };
      const m = idFor(`deliver|${slot()}|${writId}`);
      if (m.promise) return m.promise;
      m.promise = (async () => {
        const r = await ask(() => door.deliver(c, writId, m.id));
        m.promise = null;
        if (!keptAnswer(r)) ids.delete(`deliver|${slot()}|${writId}`);
        if (r?.ok) {
          applyStore(r.data?.store);
          applyTrack(r.data?.track);
          if (r.data?.today) state.writs = { today: r.data.today.filled | 0, max: r.data.today.max | 0 };
          const hit = writCache.get(region);
          if (hit?.data) hit.data = { ...hit.data, writs: hit.data.writs.map((w) => (w.id === writId ? { ...w, state: 'mine' } : w)), today: r.data?.today ?? hit.data.today };
        } else {
          shutBy(r);
          if (r?.error === 'writ-taken') writCache.delete(region);   // the list read again shows who
        }
        return r;
      })();
      return m.promise;
    },

    // ─── A SMELT AT A FORGE (PROF2) ─────────────────────────────────
    /** A recipe `count` times at the forge. The id is kept until an answer comes, so a press after a lost answer is the
     *  same smelt, never a second. Answers the service's answer; the Stores and Smithing's track moved with it. */
    async smelt(recipe, count) {
      const c = character();
      if (!c) return { ok: false, error: 'prof-character' };
      const key = `smelt|${slot()}|${recipe}|${count}`;
      const m = idFor(key, PROF_QUEUE_MS);
      if (m.promise) return m.promise;
      m.promise = (async () => {
        const r = await ask(() => door.smelt(c, recipe, count, m.id));
        m.promise = null;
        if (!keptAnswer(r)) ids.delete(key);
        if (r?.ok) { for (const s of r.data?.stores ?? []) applyStore(s); applyTrack(r.data?.track); } else shutBy(r);
        return r;
      })();
      return m.promise;
    },

    // ─── A SPECIALISATION ───────────────────────────────────────────
    /** A specialisation chosen (PROF0 3.3) - free the first time, 1,000 Marks and a week after. Asked with the choice
     *  this client sees standing (AUDIT 29 A15): the service refuses a change the player was shown as free, and a
     *  refusal that says the track moved reads it again. */
    async choose(profession, rank, spec) {
      const c = character();
      if (!c) return { ok: false, error: 'prof-character' };
      const from = this.track(profession).specs?.[rank] ?? null;
      const key = `spec|${slot()}|${profession}|${rank}|${spec}|${from ?? ''}`;
      const m = idFor(key, PROF_QUEUE_MS);
      if (m.promise) return m.promise;
      m.promise = (async () => {
        const r = await ask(() => door.spec(c, profession, rank, spec, from, m.id));
        m.promise = null;
        if (!keptAnswer(r)) ids.delete(key);
        if (r?.ok) applyTrack(r.data?.track);
        else {
          shutBy(r);
          if (r?.error === 'prof-spec-stale' || r?.error === 'prof-spec-taken') await book.refresh({ force: true });
        }
        return r;
      })();
      return m.promise;
    },
  };

  /** A kept harvest's one ask: answered (the state moved), refused (let go), or kept for the pump. */
  async function send(h, key) {
    const body = { character: h.character, node: h.node, kind: h.kind, climate: h.climate, region: h.region, act: h.act, at: h.at, rid: h.rid };
    let r;
    sending.add(h.rid);
    try { r = await door.harvest(body); } catch { r = { ok: false, error: 'offline' }; } finally { sending.delete(h.rid); }
    if (r?.ok) {
      drop(h.rid, key);
      state.taken.add(`${h.node}|${h.kind}`);
      applyStore(r.data?.store);
      applyStore(r.data?.gemStore);   // PROF2: a gem the strikes found
      applyTrack(r.data?.track);
      if (r.data?.track && Number.isSafeInteger(r.data?.today)) state.today = { ...state.today, [r.data.track.profession]: r.data.today };
      return { ok: true, data: r.data };
    }
    if (keptAnswer(r)) {
      const kept = keptOf(key);
      const k = kept.harvests.find((x) => x.rid === h.rid);
      if (k) { k.tries = (k.tries | 0) + 1; k.nextAt = now() + PROF_PUMP_MS[Math.min(k.tries - 1, PROF_PUMP_MS.length - 1)]; writeKept(kept, key); }
      return { ok: false, error: r?.error ?? 'offline', kept: true };
    }
    drop(h.rid, key);
    shutBy(r);
    if (r?.error === 'node-taken') state.taken.add(`${h.node}|${h.kind}`);
    return { ok: false, error: r?.error ?? 'server' };
  }
  function drop(id, key) {
    const kept = keptOf(key);
    kept.harvests = kept.harvests.filter((x) => x.rid !== id);
    writeKept(kept, key);
  }
  /** A kept craft's ask (PROF3): its pieces minted and the craft let go on an answer, let go on a refusal, kept on
   *  silence - the service's row answers the same id with the same pieces whenever it is asked again. */
  async function craftOne(w, key, mint) {
    const r = await ask(() => door.craft(w.character, w.recipe, w.clean, w.name, w.rid));
    const kept = keptOf(key);
    if (r?.ok) {
      const had = kept.crafts.some((x) => x.rid === w.rid);
      kept.crafts = kept.crafts.filter((x) => x.rid !== w.rid);
      writeKept(kept, key);   // let go BEFORE the pieces are made: a mint that threw is never a second mint
      for (const st of r.data?.stores ?? []) applyStore(st);
      applyTrack(r.data?.track);
      if (!had) return { ok: true, data: r.data, elsewhere: true };
      try { mint(r.data); } catch (e) { console.warn('[prof] a craft would not mint', e); }
      return { ok: true, data: r.data };
    }
    if (keptAnswer(r)) return { ok: false, error: r?.error ?? 'offline', kept: true };
    kept.crafts = kept.crafts.filter((x) => x.rid !== w.rid);
    writeKept(kept, key);
    shutBy(r);
    return { ok: false, error: r?.error ?? 'server' };
  }
  /** A kept withdrawal's ask: minted and let go on an answer, let go on a refusal, kept on silence. */
  async function settleOne(w, key, mint) {
    const r = await ask(() => door.withdraw(w.character, w.material, w.qty, w.rid));
    const kept = keptOf(key);
    if (r?.ok) {
      // AUDIT 29 C5: minted by the tab that lets it go - read and removed in one turn, so a second tab settling the same
      // kept withdrawal (both booted with it) finds it gone and mints nothing
      const had = kept.withdrawals.some((x) => x.rid === w.rid);
      kept.withdrawals = kept.withdrawals.filter((x) => x.rid !== w.rid);
      writeKept(kept, key);   // let go BEFORE the items are made: a mint that threw is never a second mint
      applyStore(r.data?.store);
      if (!had) return { ok: true, text: '', material: w.material, qty: 0, elsewhere: true };
      try { mint(r.data?.material ?? w.material, Number.isSafeInteger(r.data?.qty) ? r.data.qty : w.qty); } catch (e) { console.warn('[prof] a withdrawal would not mint', e); }
      return { ok: true, text: '', material: w.material, qty: r.data?.qty ?? w.qty };
    }
    if (keptAnswer(r)) return { ok: false, kept: true, text: 'The Stores have your order and will send it when the counting-house answers.' };
    kept.withdrawals = kept.withdrawals.filter((x) => x.rid !== w.rid);
    writeKept(kept, key);
    shutBy(r);
    return { ok: false, text: accountRefusalText(r?.error) };
  }

  return book;
}
