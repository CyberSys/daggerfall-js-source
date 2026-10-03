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
// BAG1 (bible/06-Systems/Materials-Bag.md): A CARRYING BOOK - one handed
// `carry`, the host's hands on the Materials Bag and the pack (systems/
// materialsBag.js) - asks every harvest and withdrawal as carried: the
// units are the service's count, and the items are minted into the bag
// or the pack ONCE, by the tab that lets the kept act go (AUDIT 29 C5's
// law). What a station, a craft, a brew or a Court writ may spend is
// the Stores' and what the character carries and still holds; the
// shortfall is put in the Stores first (a deposit, the items taken out
// and given back on a refusal), so the station's own route spends the
// Stores as it always has.
//
// AUDIT BAG1 (bible/06-Systems/Materials-Bag.md, the audit): WHAT THE
// PACK HOLDS IS SAID WHEN THE ACT IS ASKED, never when it was kept -
// `held` read at the send, with the units of every deposit still out (the
// pack gave them up; the count holds them until the deposit lands), beside
// `seen`, the count as this book last heard it, and `heldKey`, the material
// it is of. The service cuts the count only where `seen` is its own: an
// answer lost (a kept act's units counted, not yet minted) makes the count
// move under the client, and the cut is skipped. A carried harvest is
// never let go unminted: heard under another character it waits for its
// own, and lapsed it is asked once - the service answers a landed one
// whatever its age. A deposit is KEPT as the other acts are, so a page
// closed before its answer still hears it.
//
// Pure - the door, the storage, the clock and the ids are handed in - so
// the pins drive it without a network.
// ═══════════════════════════════════════════════════════════════════
import { HARVEST_LATE_S, HIDES_PER_DAY, HIGH_HIDES_PER_DAY, HAULS_PER_DAY, NODE_PROFESSIONS, smeltRecipe } from './professionLaw.js';   // PROF8: the day's forty hauls; BAG1: a work's inputs
import { CARRIED_MAX, DEPOSIT_MAX, carriedUsable, carriedTotal, clampCarried } from './bagLaw.js';   // BAG1: what a character carries, counted
import { recipeById, recipeInputs } from './recipeLaw.js';   // BAG1: a craft's inputs, moved in from the bag first
import { potionById, brewSpends } from './alchemyLaw.js';   // BAG1: a brew's
import { pixelKey, parseNodeKey } from './nodeLaw.js';
import { accountRefusalText } from './accountClient.js';
import { ASK_AGAIN_NOW, jittered } from './backoff.js';   // SCALE1: asks again spread out, and never at once into a minute's refusal

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
/** The answers an act is asked again after: the network, the service's own fault, the account's minute spent; GATHER-SAID:
 *  the service held for its maintenance minute (RESTORE's 503, answered before any route - the act never reached it). */
const RETRY = Object.freeze(['offline', 'server', 'rate', 'maintenance']);
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
/**
 * @typedef {{ held: (key: string) => number, room: (key: string) => number,
 *   mint: (key: string, n: number) => { bag: number, pack: number, left: number },
 *   take: (key: string, n: number) => { taken: number, back: () => void } }} CarryHands
 *   BAG1: the host's hands on the bag and the pack - what they hold of a material, how many more fit, the units minted
 *   into them (the bag first), and the units taken out of them with the undo that puts them back.
 */
export function createProfBook({ door, storage = null, character = () => null, now = () => Date.now(), rid = () => mintProfRid(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), carry = /** @type {CarryHands|null} */ (null) }) {
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
    /** BAG1: the service's carried count, by material - every unit it handed to the bag or the pack (bagLaw.js) */
    carried: new Map(),
    writs: { today: 0, max: 3 },
    caps: /** @type {any} */ (null),
    /** PROF3: the account's Marks as the smith's stock last answered them, or null */
    marks: /** @type {number|null} */ (null),
    /** PROF7: the account's hides today, every character's together (PROF0 6: 30, of them 3 of tiers 5-6) */
    hunt: { hides: 0, high: 0 },
    /** PROF8: the account's hauls today (40 a day, every character's together) */
    hauls: 0,
    /** REFUSALS-LEARNED: the state to be read again (a refusal said the day's count or the Stores moved elsewhere) */
    reread: false,
    /** REFUSALS-LEARNED: what the account's refusals closed, by key (`account:<profession>`, `deep`) -> the UTC day */
    closed: new Map(),
  };
  const account = () => { try { return door.account?.() ?? null; } catch { return null; } };
  /** BAG1: the carried count as far as the bag and the pack still hold it (bagLaw.js clampCarried). */
  const clampedCarried = (m) => { const c = state.carried.get(m) ?? { own: 0, bought: 0 }; return carry ? clampCarried(c, carry.held(m)) : c; };
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
      deposits: Array.isArray(k?.deposits) ? k.deposits : [],   // AUDIT BAG1 B17: a deposit asked, its items out of the bag and the pack
    };
  };
  const writeKept = (kept, key = slot()) => {
    const t = { ...table() };
    if (kept.harvests.length || kept.withdrawals.length || kept.crafts?.length || kept.deposits?.length) t[key] = kept; else delete t[key];
    writeTable(t);
  };

  /** One ask, up to PROF_TRIES times with a wait between; the service's no is final at once. */
  async function ask(fn) {
    let r = null;
    for (let i = 0; i < PROF_TRIES; i++) {
      if (i > 0) await sleep(jittered(PROF_RETRY_MS[Math.min(i - 1, PROF_RETRY_MS.length - 1)]));
      try { r = await fn(); } catch { r = { ok: false, error: 'offline' }; }
      if (r?.ok || !ASK_AGAIN_NOW.includes(r?.error)) return r;   // SCALE1: `rate` and `maintenance` go back kept, to the pump
    }
    return r;
  }
  const shutBy = (r) => { if (SHUT.includes(r?.error)) { state.open = false; state.account = account(); } };

  // ─── WHAT THE SERVICE SAID ─────────────────────────────────────────
  const applyTrack = (t) => { if (t && typeof t.profession === 'string') state.tracks.set(t.profession, t); };
  // GOLD-MARKET: and what gold bought, where there is any - to the pack or back on the market for gold, nowhere else
  const applyStore = (s) => {
    if (!s || typeof s.material !== 'string') return;
    const gold = s.gold | 0;
    if ((s.own | 0) + (s.bought | 0) + gold > 0) state.stores.set(s.material, { material: s.material, own: s.own | 0, bought: s.bought | 0, ...(gold > 0 ? { gold } : {}) });
    else state.stores.delete(s.material);
  };
  /** BAG1: a carried count as the service said it, in the Stores' shape. */
  const applyCarried = (c) => {
    if (!c || typeof c.material !== 'string') return;
    const gold = c.gold | 0;
    if ((c.own | 0) + (c.bought | 0) + gold > 0) state.carried.set(c.material, { material: c.material, own: c.own | 0, bought: c.bought | 0, ...(gold > 0 ? { gold } : {}) });
    else state.carried.delete(c.material);
  };
  function apply(data) {
    state.open = true;
    state.reread = false;   // REFUSALS-LEARNED: read
    state.account = account();
    state.day = Number.isSafeInteger(data?.day) ? data.day : dayOf(now());
    state.character = data?.character ?? character();
    state.tracks = new Map();
    for (const t of data?.tracks ?? []) applyTrack(t);
    state.today = data?.today && typeof data.today === 'object' ? { ...data.today } : {};
    state.taken = new Set(Array.isArray(data?.taken) ? data.taken : []);
    state.stores = new Map();
    for (const s of data?.stores ?? []) applyStore(s);
    state.carried = new Map();
    for (const c of data?.carried ?? []) applyCarried(c);   // BAG1
    if (data?.writs) state.writs = { today: data.writs.today | 0, max: data.writs.max | 0 };
    state.caps = data?.caps ?? null;
    applyHunt(data?.hunt);
    applyHauls(data?.hauls);
  }
  /** PROF7: the account's hides today, as the state or a skinning answered them. */
  /** PROF8: the account's hauls today, as the service counted them. */
  function applyHauls(n) { if (Number.isSafeInteger(n) && n >= 0) state.hauls = n; }
  function applyHunt(h) {
    if (h && typeof h === 'object') state.hunt = { hides: Math.max(0, h.hides | 0), high: Math.max(0, h.high | 0) };
  }

  /** The pixels' states, as the service last said them this UTC day: 'x,y' -> { day, state, climate?, region?, stale? }. */
  const pixels = new Map();
  /** PROF2: the dungeons' states the same way: id -> { day, state, climate?, region?, stale? }. */
  const dungeons = new Map();
  let _pixelsBusy = null;
  /**
   * GROUND-STALE (AUDIT 2026-10-01 part four): A HARVEST'S ANSWER IS WHEN ITS GROUND CAN MOVE. The service reads a
   * pixel's or a dungeon's witnesses fresh at every harvest, and the third week-old account's harvest confirms it in that
   * very statement; the book kept the morning's state for the whole UTC day, so its client went on standing the ground's
   * least (an Oak where the service rolls Cherry, Iron where it rolls Silver), offered a novice the act, wore the tool
   * and was refused `prof-rank` - every try, until midnight. Now the answered node's ground is marked stale: it stands as
   * it did, and the host's next ask reads it again (`pixelWanted`, `dungeonWanted`); a state that moved stands its
   * nodes again. A body names no ground.
   */
  function staleGround(node) {
    const n = parseNodeKey(node);
    const g = !n || n.kind === 'body' ? null : n.kind === 'dvein' ? dungeons.get(n.dungeon) : pixels.get(pixelKey(n.x, n.y));
    if (g) g.stale = true;
  }
  /** The writs' cache: `slot|region` -> { at, data, error } (AUDIT 31 B7: the list carries this account's and
   *  character's own - PROF6's "yours", its guild, its balance). */
  const writCache = new Map();
  /** AUDIT 31 B7: the Work list's generation - moved on by every act the list shows (a guild writ, a commission), so a
   *  read begun before one is read again, never painted after it. */
  let writGen = 0;
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
  let _depositBusy = false;   // BAG1: one deposit at a time
  /** BAG1: the deposits whose answer never came - their items kept out of the bag and the pack, asked again with the same
   *  id at the next settle, given back only on the service's own refusal (an honest client fails toward loss, never a
   *  copy: a deposit that landed and lost its answer, given back, would be the units in the Stores AND in the pack).
   *  AUDIT BAG1 B17: KEPT with the other acts (`deposits`), so a page closed before the answer still hears it; this page's
   *  own undo by the deposit's id - after a reload there is none, and a refusal gives back what the pack is short. */
  const depositBacks = new Map();
  /** AUDIT BAG1 B2: what the service must read as held of a material - the bag's and the pack's items, and the units of
   *  every deposit still out (the pack gave them up; the count holds them until the deposit lands). */
  const heldNow = (m) => (carry ? carry.held(m) : 0) + keptOf().deposits.reduce((n, d) => n + (d.material === m ? d.qty | 0 : 0), 0);
  /** AUDIT BAG1 B2: the count of a material as this book last heard it - the service cuts only against its own. */
  const seenNow = (m) => carriedTotal(state.carried.get(m));

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
      if (state.reread && now() - state.readAt >= PROF_REFRESH_BACKOFF_MS) return true;   // REFUSALS-LEARNED
      return state.day !== dayOf(now()) && now() - state.readAt >= PROF_REFRESH_BACKOFF_MS;
    },
    /** REFUSALS-LEARNED: whether today a refusal closed `key` for the account - `account:<profession>` (the account's
     *  day in that craft, every character's), or `deep` (its veins in dungeons nobody has vouched for). */
    closed(key) { return state.closed.get(key) === dayOf(now()); },
    /** A track as the service last said it (never null: a profession not worked yet is at nothing). */
    track(profession) { return state.tracks.get(profession) ?? { profession, xp: 0, rank: 0, specs: { 50: null, 100: null }, respec: null }; },
    /** One material's count in the Stores, own and bought (GOLD-MARKET: and `gold`, bought with gold, where held). */
    store(material) { return state.stores.get(material) ?? { material, own: 0, bought: 0 }; },
    /** What a station, a craft or a writ may spend of it - never what gold bought (GOLD-MARKET's wall). BAG1: the Stores'
     *  and, for a carrying book, what the character carries and still holds (bagLaw.js carriedUsable) - a craft puts the
     *  shortfall in the Stores before it spends (`ensureInStores`). */
    held(material) { return this.storesHeld(material) + this.carriedUsable(material); },
    /** BAG1: what the Stores alone may spend of it - the Stores page's, and every act that reads the Stores alone. */
    storesHeld(material) { const s = this.store(material); return s.own + s.bought; },
    /** BAG1: whether this book carries (a host handed it the bag and the pack) - every harvest and withdrawal is then
     *  the bag's or the pack's, never the Stores'. */
    carrying() { return !!carry; },
    /** BAG1: the service's carried count of a material, as it last said it. */
    carried(material) { return state.carried.get(material) ?? { material, own: 0, bought: 0 }; },
    /** BAG1: what of the carried count a station may use - as far as the bag and the pack still hold it, never gold's. */
    carriedUsable(material) { return carry ? carriedUsable(this.carried(material), carry.held(material)) : 0; },
    /** BAG1: whether one more unit of a material has nowhere to go - neither the bag nor the pack has room, or the
     *  service's count of it is at its bound (professionLaw.js storesFullIn asks it of a carrying book). */
    carryFull(material) { return !carry || carry.room(material) < 1 || carriedTotal(clampedCarried(material)) >= CARRIED_MAX; },
    /** AUDIT 30 U1: a material's count as another book heard it from the service (the market's answers - a listing's
     *  units out, a purchase or a cancel in, a fill, a delivery landed) - one count, whoever asked. */
    applyStore(s) { if (state.open === true && state.character === character()) applyStore(s); },
    /** BAG1: a carried count another book heard (none yet - the deposit's and the withdrawal's are this book's own). */
    applyCarried(c) { if (state.open === true && state.character === character()) applyCarried(c); },

    // ─── THE PIXELS ─────────────────────────────────────────────────
    /** A streamed pixel's witnessed state today, or null not yet asked. */
    pixel(x, y) { const p = pixels.get(pixelKey(x, y)); return p && p.day === dayOf(now()) ? p : null; },
    /** GROUND-STALE: whether the host should ask after a pixel - not yet known today, or a harvest answered on it since. */
    pixelWanted(x, y) { const p = this.pixel(x, y); return !p || p.stale === true; },
    /** Asks after the pixels not yet known today, PROF_PIXELS_MAX at a time, one read in flight. Answers the pixels
     *  whose state is new (the host re-stands their patches). */
    async askPixels(list) {
      if (_pixelsBusy || state.open === false) return [];
      const c = character();
      const day = dayOf(now());
      const want = (list ?? []).filter(([x, y]) => { const p = pixels.get(pixelKey(x, y)); return p?.day !== day || p.stale === true; }).slice(0, PROF_PIXELS_MAX);   // GROUND-STALE: and one a harvest answered on
      if (!c || !want.length) return [];
      _pixelsBusy = (async () => {
        const r = await ask(() => door.pixels(c, want));
        if (!r?.ok) { shutBy(r); return []; }
        const changed = [];
        for (const p of r.data?.pixels ?? []) {
          const k = pixelKey(p.x, p.y);
          const before = pixels.get(k);
          pixels.set(k, { day, state: p.state, climate: p.climate ?? null, region: p.region ?? null });
          // GROUND-MIDNIGHT (AUDIT 2026-10-01 part four): yesterday's word is no word - the day's turn stood every pixel
          // again before today's states were read (the ground's least), so a pixel confirmed yesterday AND today was
          // never stood again: it stood unconfirmed all day, its signature veins gone
          if (!before || before.day !== day || before.state !== p.state) changed.push(p);
        }
        return changed;
      })().finally(() => { _pixelsBusy = null; });
      return _pixelsBusy;
    },

    // ─── THE DUNGEONS (PROF2) ───────────────────────────────────────
    /** A dungeon's witnessed state today (its id DFU's MapId & 0xfffff), or null not yet asked. */
    dungeon(id) { const d = dungeons.get(id); return d && d.day === dayOf(now()) ? d : null; },
    /** GROUND-STALE: whether the host should ask after a dungeon - not yet known today, or a harvest answered in it since. */
    dungeonWanted(id) { const d = this.dungeon(id); return !d || d.stale === true; },
    /** Asks after a dungeon not yet known today, beside no pixels - one read in flight. Answers whether its state is
     *  new (the dungeon's veins stand again). */
    async askDungeon(id) {
      if (_pixelsBusy || state.open === false || !this.dungeonWanted(id)) return false;   // GROUND-STALE: or one a harvest answered in
      const c = character();
      if (!c) return false;
      const day = dayOf(now());
      _pixelsBusy = (async () => {
        const r = await ask(() => door.pixels(c, [], [id]));
        if (!r?.ok) { shutBy(r); return []; }
        const d = (r.data?.dungeons ?? []).find((x) => x.id === id);
        const before = dungeons.get(id);
        dungeons.set(id, { day, state: d?.state ?? 'none', climate: d?.climate ?? null, region: d?.region ?? null });
        return !before || before.day !== day || before.state !== (d?.state ?? 'none') ? [id] : [];   // GROUND-MIDNIGHT: yesterday's is no word
      })().finally(() => { _pixelsBusy = null; });
      return (await _pixelsBusy).length > 0;
    },

    // ─── A HARVEST ──────────────────────────────────────────────────
    /** Whether a node's kind is taken today - by the service's word, or on its way to it (being counted). */
    taken(node, kind) { return state.taken.has(`${node}|${kind}`); },
    counting(node, kind) { return keptOf().harvests.some((h) => h.node === node && h.kind === kind); },
    /**
     * A NODE HARVESTED: `{ node, kind, climate, region, act, at }` (the act's end, epoch seconds on the shared clock;
     * PROF7: a body's `foe` beside them) - kept with its own id, then asked. Answers `{ ok: true, data }` (the service's harvest), `{ ok: false, error }` (the
     * service's no - the act is let go), or `{ ok: false, kept: true }` (no answer yet - kept, and `pump` asks again).
     */
    async harvest(req) {
      const key = slot();
      const c = character();
      if (!c) return { ok: false, error: 'prof-character' };
      // BAG1: a carrying book's harvest is the bag's or the pack's - the material it is of kept where the host names it (a
      // Basket's food is the service's roll: none), so the count is cut to the truth first. AUDIT BAG1 B2: what is held of
      // it is read at each ask (`send`), never here - a harvest kept while another's items were still to come said too few
      const { material: named = null, ...ask0 } = req ?? {};
      const h = { ...ask0, character: c, rid: rid(), queuedAt: now(), tries: 0, nextAt: 0,
        ...(carry ? { carry: true, ...(typeof named === 'string' ? { material: named } : {}) } : {}) };
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
          // AUDIT 29 C4: the rank before the answer, handed to the caller - `send` applies the new track first, and a
          // rise read after it was no rise (no toast, no banner)
          const ranks = new Map([...state.tracks].map(([p, t]) => [p, t.rank]));
          if (lapsed) {
            // AUDIT BAG1 B1: a carried harvest that landed with its answer lost is counted, and only its answer mints the
            // items - let go unasked, the count held units the pack never got. Asked once: the service answers a landed
            // harvest whatever its age (its row); one that never landed is refused, and let go as lapsed
            if (h.carry === true) {
              const r = await send(h, key);
              if (r.ok && !r.elsewhere) { onAnswer(h, r, ranks.get(r?.data?.track?.profession) ?? 0); continue; }
              if (r.elsewhere) continue;
            }
            drop(h.rid, key); onAnswer(h, { ok: false, error: 'lapsed' }); continue;
          }
          const r = await send(h, key);
          if (!r.kept && !r.elsewhere) onAnswer(h, r, ranks.get(r?.data?.track?.profession) ?? 0);   // AUDIT 32 B5: another character's, unsaid
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
        // BAG1: a carrying book's withdrawal is counted as carried. AUDIT BAG1 B2: what the bag and the pack hold of it is
        // read at each ask (settleOne), with the count as last heard
        const w = { rid: rid(), material, qty, character: c, ...(carry ? { carry: true } : {}) };
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
      await settleDeposits();   // BAG1
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

    // ─── BAG1: A DEPOSIT - WHAT IS CARRIED, INTO THE STORES ────────
    /**
     * `qty` carried units of `material` into the Stores, each origin as it was (server-account/src/professions.js
     * depositStores): the items taken out of the bag and then the pack first, `held` what they held before, the request
     * asked; given back on the service's refusal. An answer that never comes keeps them out and asks again at the next
     * settle (pendingDeposits). `order` 'all' (the Stores page's Put in) or 'spend' (a craft's shortfall - never gold's).
     * @returns {Promise<{ ok: boolean, data?: any, error?: string, kept?: boolean }>}
     */
    async deposit(material, qty, { order = 'all' } = {}) {
      if (!carry) return { ok: false, error: 'bad-held' };
      const c = character();
      if (!c || !account()) return { ok: false, error: 'no-session' };
      if (!Number.isSafeInteger(qty) || qty < 1 || qty > DEPOSIT_MAX) return { ok: false, error: 'bad-qty' };
      if (_depositBusy) return { ok: false, error: 'prof-busy' };
      _depositBusy = true;
      try {
        const key = slot();
        const before = carry.held(material);
        const took = carry.take(material, qty);
        if (took.taken < qty) { took.back(); return { ok: false, error: 'carried-short' }; }
        // AUDIT BAG1 B17: kept before it is asked - `before` what the bag and the pack held, so a refusal heard after a
        // reload gives back only what they are short of it (a save that never saw the items go still holds them)
        const d = { id: rid(), character: c, material, qty, order, before };
        depositBacks.set(d.id, took.back);
        const kept = keptOf(key);
        kept.deposits.push(d);
        writeKept(kept, key);
        return await askDeposit(d, key);
      } finally { _depositBusy = false; }
    },
    /** BAG1: how many deposits wait on the service's answer, their items out of the bag. */
    get pendingDeposits() { return keptOf().deposits.length; },
    /**
     * BAG1: A STATION'S, A CRAFT'S OR A WRIT'S SHORTFALL PUT IN THE STORES FIRST - for each input `{ key, n }` (summed by
     * key), what the Stores lack of `n` deposited from what is carried (`spend`: bought first, never gold's), so the act's
     * own route spends the Stores as it always has. A carried count that cannot cover a shortfall moves nothing and
     * answers `materials-short`; a deposit refused answers its refusal (one unanswered: `deposit-kept`). A book that does not carry answers `ok` at once.
     * @param {{ key: string, n: number }[]|null|undefined} inputs
     */
    async ensureInStores(inputs) {
      if (!carry || !Array.isArray(inputs)) return { ok: true, moved: 0 };
      const need = new Map();
      for (const i of inputs) if (i && typeof i.key === 'string' && i.n > 0) need.set(i.key, (need.get(i.key) ?? 0) + i.n);
      // every shortfall covered before any moves, so a craft refused for one input moves none of the others
      for (const [k, n] of need) if (n - this.storesHeld(k) > this.carriedUsable(k)) return { ok: false, error: 'materials-short', material: k };
      let moved = 0;
      for (const [k, n] of need) {
        let left = n - this.storesHeld(k);
        while (left > 0) {
          const q = Math.min(left, DEPOSIT_MAX);
          const r = await this.deposit(k, q, { order: 'spend' });
          // AUDIT BAG1 B8: a put-in whose answer has not come is no shortfall - its items are on their way, and said so
          if (!r?.ok) return { ok: false, error: r?.kept === true ? 'deposit-kept' : (r?.error ?? 'offline'), material: k, kept: r?.kept === true };
          left -= q;
          moved += q;
        }
      }
      return { ok: true, moved };
    },

    // ─── A CRAFT AT THE ANVIL (PROF3) ───────────────────────────────
    /**
     * A recipe made at the anvil (net/recipeLaw.js): `clean` the heat's report (the service lays one step on it at most),
     * `name` the maker's mark. The craft is KEPT before it is asked - its pieces are the save's once the service answers,
     * so a lost answer is asked again (the same id, the same pieces) and `mint` makes them on the answer, once: the tab
     * that lets the craft go mints it (AUDIT 29 C5's law). One at a time. AUDIT 30 C4: `fee` the station's gold, kept with
     * the craft and handed to `mint` with it - the tab that mints the pieces pays it, whenever the answer comes.
     * @returns {Promise<{ ok: boolean, data?: any, error?: string, kept?: boolean, elsewhere?: boolean }>}
     */
    async craft(recipe, { clean = false, name = null, heartwood = false, fee = 0, dye = null, seat = null, cracked = false } = {}, mint) {
      if (_craftBusy) return { ok: false, error: 'prof-busy' };
      const key = slot();
      const c = character();
      if (!c || !account()) return { ok: false, error: 'no-session' };
      _craftBusy = (async () => {
        // BAG1: what the Stores lack, from the bag and the pack first - the anvil's route spends the Stores
        const r0 = recipeById(recipe);
        const ready = r0 ? await book.ensureInStores(recipeInputs(r0, { heartwood: heartwood === true, joiner: book.track(r0.profession ?? 'smithing').specs?.[50] === 'joiner', cracked: cracked === true })) : { ok: true };
        if (!ready.ok) return { ok: false, error: ready.error ?? 'materials-short', material: ready.material, kept: ready.kept };
        const w = { rid: rid(), recipe, clean: clean === true, name: typeof name === 'string' ? name : null, character: c, heartwood: heartwood === true,   // PROF4: a Heartwood for a plank
          fee: Number.isSafeInteger(fee) && fee > 0 ? fee : 0, ...(Number.isInteger(dye) ? { dye } : {}),   // PROF7: a garment's dye
          ...(Number.isSafeInteger(seat) && seat >= 0 ? { seat } : {}),   // SEAT2b part two: the held town the station stands in (its crafting halls' steps)
          ...(cracked === true ? { cracked: true } : {}) };   // PROF10: a Lapidary's Siege-cracked Gem for the piece's gem
        const kept = keptOf(key);
        kept.crafts.push(w);
        writeKept(kept, key);
        return craftOne(w, key, mint);
      })().finally(() => { _craftBusy = null; });
      return _craftBusy;
    },
    get pendingCrafts() { return keptOf().crafts.length; },
    // ─── A BREW AT THE ALCHEMY STATION (PROF12) ─────────────────────
    /**
     * One of DFU's twenty brewed from the Stores (net/alchemyLaw.js): `potion` its recipe's name, `keys` the cauldron as the
     * Stores hold it. KEPT as a craft is - its potions are the save's once the service answers, so a lost answer is asked
     * again (the same id, the same potions) and `mint` makes them on the answer, once, by the tab that lets it go; `fee` the
     * Alchemist's gold, paid with them; `seat` the held town the station stands in (the Apothecary's steps). One craft or
     * brew at a time.
     * @returns {Promise<{ ok: boolean, data?: any, error?: string, kept?: boolean, elsewhere?: boolean }>}
     */
    async brew(potion, keys, { fee = 0, seat = null } = {}, mint) {
      if (_craftBusy) return { ok: false, error: 'prof-busy' };   // one craft or brew at a time
      const key = slot();
      const c = character();
      if (!c || !account()) return { ok: false, error: 'no-session' };
      _craftBusy = (async () => {
        // BAG1: the cauldron's herbs the Stores lack, from the bag and the pack first
        const ready = await book.ensureInStores(brewSpends(potionById(potion), keys));
        if (!ready.ok) return { ok: false, error: ready.error ?? 'materials-short', material: ready.material, kept: ready.kept };
        const w = { rid: rid(), brew: true, recipe: potion, keys: Array.isArray(keys) ? [...keys] : [], character: c,
          fee: Number.isSafeInteger(fee) && fee > 0 ? fee : 0, ...(Number.isSafeInteger(seat) && seat > -1 ? { seat } : {}) };
        const kept = keptOf(key);
        kept.crafts.push(w);
        writeKept(kept, key);
        return craftOne(w, key, mint);
      })().finally(() => { _craftBusy = null; });
      return _craftBusy;
    },
    /** A crafted piece DISENCHANTED (PROF12) at an enchanting station - into Arcane Essence in the Stores, the piece gone. The
     *  id is the piece's own until an answer comes, so a press after a lost answer is the same disenchant. Answers the
     *  service's answer; the Stores and Enchanting's track moved with it - the caller takes the piece out of the pack.
     *  AUDIT PROF-541 B2: `realm` a realm character's record where it stands (the host's realm act, realmSaves.js
     *  realmGoldAct) - the service takes the piece out of it in the disenchant's own batch. */
    async disenchant(provenance, realm = null) {
      const c = character();
      if (!c) return { ok: false, error: 'prof-character' };
      const key = `disenchant|${slot()}|${provenance}`;
      const m = idFor(key, PROF_QUEUE_MS);
      if (m.promise) return m.promise;
      m.promise = (async () => {
        // AUDIT PROF-541 B2: a realm act asks once - the realm act asks again itself, reading a record one on as the act landed
        const once = () => door.disenchant(c, provenance, m.id, realm);
        const r = realm ? await Promise.resolve().then(once).catch(() => ({ ok: false, error: 'offline' })) : await ask(once);
        m.promise = null;
        if (!keptAnswer(r)) ids.delete(key);
        if (r?.ok) { applyStore(r.data?.store); applyTrack(r.data?.track); } else shutBy(r);
        return r;
      })();
      return m.promise;
    },
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
    /** AUDIT 31 B7: the Work list let go - an act it shows was answered (the writs' book's, through the Work tab). */
    forgetWrits() { writCache.clear(); writGen++; },
    /** A region's Court writs through a minute's cache; `force` reads now. Answers `{ data, error, stale }`. */
    async writs(region, { force = false } = {}) {
      const c = character();
      // AUDIT 31 B7: the list is this account's and character's (PROF6's "yours", its guild, its balance) - kept per slot
      const wk = `${slot()}|${region}`;
      const hit = writCache.get(wk);
      if (!force && hit && now() - hit.at < PROF_WRITS_CACHE_MS) return { data: hit.data, error: hit.error, stale: false };
      const g = writGen;
      const r = c ? await ask(() => door.writs(c, region)) : { ok: false, error: 'prof-character' };
      if (g !== writGen) return book.writs(region, { force: true });   // an act answered while it was read: read again
      if (r?.ok) {
        writCache.set(wk, { at: now(), data: r.data, error: null });
        if (r.data?.today) state.writs = { today: r.data.today.filled | 0, max: r.data.today.max | 0 };
        return { data: r.data, error: null, stale: false };
      }
      shutBy(r);
      if (hit?.data) return { data: hit.data, error: r?.error ?? 'offline', stale: true };   // a slow service shows the last good list
      // AUDIT 29 C11: a read that failed is kept for the backoff, not the minute a good list is
      writCache.set(wk, { at: now() - PROF_WRITS_CACHE_MS + PROF_REFRESH_BACKOFF_MS, data: null, error: r?.error ?? 'offline' });
      return { data: null, error: r?.error ?? 'offline', stale: false };
    },
    /** A COURT WRIT TAKEN - delivered from the Stores. The id is the writ's own until an answer comes. Answers the
     *  service's answer (`{ ok, data }` or `{ ok: false, error }`), the book's state and the writ's cache moved with it.
     *  AUDIT BAG1 B9: `card` the writ as the board showed it (`{ material, qty }`) - the shortfall's word where this book's
     *  list has none (another book read the board), so what is carried still fills it. */
    async deliver(writId, region, card = null) {
      const c = character();
      if (!c) return { ok: false, error: 'prof-character' };
      const m = idFor(`deliver|${slot()}|${writId}`);
      if (m.promise) return m.promise;
      m.promise = (async () => {
        // BAG1: the writ's units the Stores lack, from the bag and the pack first - a Court writ is filled from the Stores
        const asked = writCache.get(`${slot()}|${region}`)?.data?.writs?.find((x) => x.id === writId)
          ?? (card && typeof card.material === 'string' && Number.isSafeInteger(card.qty) && card.qty > 0 ? card : null);
        const ready = asked ? await book.ensureInStores([{ key: asked.material, n: asked.qty }]) : { ok: true };
        if (!ready.ok) { m.promise = null; return { ok: false, error: ready.error ?? 'materials-short' }; }
        const r = await ask(() => door.deliver(c, writId, m.id));
        m.promise = null;
        if (!keptAnswer(r)) ids.delete(`deliver|${slot()}|${writId}`);
        if (r?.ok) {
          applyStore(r.data?.store);
          applyTrack(r.data?.track);
          if (r.data?.today) state.writs = { today: r.data.today.filled | 0, max: r.data.today.max | 0 };
          const hit = writCache.get(`${slot()}|${region}`);
          if (hit?.data) hit.data = { ...hit.data, writs: hit.data.writs.map((w) => (w.id === writId ? { ...w, state: 'mine' } : w)), today: r.data?.today ?? hit.data.today };
        } else {
          shutBy(r);
          if (r?.error === 'writ-taken') writCache.delete(`${slot()}|${region}`);   // the list read again shows who
        }
        return r;
      })();
      return m.promise;
    },

    // ─── A SMELT AT A FORGE (PROF2) ─────────────────────────────────
    /** A recipe `count` times at the forge. The id is kept until an answer comes, so a press after a lost answer is the
     *  same smelt, never a second. Answers the service's answer; the Stores and Smithing's track moved with it. PROF11:
     *  or a mason's work at the bench, `clean` the chisel's report (the service reads it only where the work has the act;
     *  a press after a lost answer is the same work, whatever its chisel). */
    async smelt(recipe, count, { clean = false } = {}) {
      const c = character();
      if (!c) return { ok: false, error: 'prof-character' };
      const key = `smelt|${slot()}|${recipe}|${count}`;
      const m = idFor(key, PROF_QUEUE_MS);
      if (m.promise) return m.promise;
      m.promise = (async () => {
        // BAG1: the work's inputs the Stores lack, from the bag and the pack first
        const work = smeltRecipe(recipe);
        const ready = work ? await book.ensureInStores(work.inputs.map((i) => ({ key: i.key, n: i.n * count }))) : { ok: true };
        if (!ready.ok) { m.promise = null; return { ok: false, error: ready.error ?? 'materials-short', material: ready.material }; }
        const r = await ask(() => door.smelt(c, recipe, count, m.id, clean === true));
        m.promise = null;
        if (!keptAnswer(r)) ids.delete(key);
        if (r?.ok) { for (const s of r.data?.stores ?? []) applyStore(s); applyTrack(r.data?.track); } else shutBy(r);
        // BAG1: AND WHAT IT MADE INTO THE BAG OR THE PACK - as much as fits; the rest stays in the Stores, said
        if (r?.ok && carry && work) r.data.put = await carryOut(work.out, (Number(r.data.own) || 0) + (Number(r.data.bought) || 0));
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
    const body = {
      character: h.character, node: h.node, kind: h.kind, climate: h.climate, region: h.region, act: h.act, at: h.at, rid: h.rid,
      ...(h.foe === undefined ? {} : { foe: h.foe }),   // PROF7: the foe a body is (PROF0 6: the client's claim)
      ...(typeof h.watch === 'string' ? { watch: h.watch } : {}),   // PROF2b: a Motherlode's - the relay's Watch receipt for its pixel
      ...(h.carry === true ? { carry: true, ...heldBody(h) } : {}),   // BAG1: into the bag or the pack
    };
    let r;
    sending.add(h.rid);
    try { r = await door.harvest(body); } catch { r = { ok: false, error: 'offline' }; } finally { sending.delete(h.rid); }
    // AUDIT 32 B5: the answer is its press's character's - heard after a switch, it is let go and the book (the other
    // character's now) is left as it stands; that character's next read says it (AUDIT 31 B2's law, the market's)
    const here = key === slot();
    // AUDIT BAG1 B1: a carried harvest's items are its own character's to mint - let go here, they were never made; it
    // waits kept for that character, whose next ask the service answers with the same harvest
    if (r?.ok && !here && h.carry === true) return { ok: false, error: 'elsewhere', kept: true, elsewhere: true };
    if (r?.ok && !here) { drop(h.rid, key); return { ok: true, data: r.data, elsewhere: true }; }
    if (r?.ok) {
      // BAG1: THE ITEMS ARE MINTED ONCE, by the tab that lets the kept harvest go - read and let go in one turn, BEFORE the
      // items are made (AUDIT 29 C5's law, the withdrawal's): a second tab settling the same kept harvest finds it gone
      const had = keptOf(key).harvests.some((x) => x.rid === h.rid);
      drop(h.rid, key);
      if (r.data?.carry === true) {
        applyCarried(r.data.carried); applyCarried(r.data.gemCarried); applyCarried(r.data.extraCarried);
        if (had && carry) r.data.put = mintHarvest(r.data);
      }
      state.taken.add(`${h.node}|${h.kind}`);
      staleGround(h.node);   // GROUND-STALE: this harvest may be the witness that confirmed its ground
      applyStore(r.data?.store);
      applyStore(r.data?.gemStore);   // PROF2: a gem the strikes found
      applyStore(r.data?.extraStore);   // PROF7 (FOUND): a tree's Resin and a body's butchery - PROF4 never applied it
      applyHunt(r.data?.hunt);   // PROF7: the account's hides today
      applyHauls(r.data?.hauls);   // PROF8: and its hauls
      applyTrack(r.data?.track);
      if (r.data?.track && Number.isSafeInteger(r.data?.today)) state.today = { ...state.today, [r.data.track.profession]: r.data.today };
      return { ok: true, data: r.data };
    }
    // RATE-KEPT (AUDIT 2026-10-01 part four): the hour's acts spent (`prof-rate`) said "Try again later" and let the harvest
    // go - the act played and the tool worn for nothing; kept now, and asked again inside its ten minutes
    if (keptAnswer(r) || r?.error === 'prof-rate') {
      const kept = keptOf(key);
      const k = kept.harvests.find((x) => x.rid === h.rid);
      if (k) { k.tries = (k.tries | 0) + 1; k.nextAt = now() + PROF_PUMP_MS[Math.min(k.tries - 1, PROF_PUMP_MS.length - 1)]; writeKept(kept, key); }
      return { ok: false, error: r?.error ?? 'offline', kept: true };
    }
    drop(h.rid, key);
    if (!here) return { ok: false, error: r?.error ?? 'server', elsewhere: true };
    shutBy(r);
    if (r?.error === 'node-taken') state.taken.add(`${h.node}|${h.kind}`);
    // REFUSALS-LEARNED (AUDIT 2026-10-01 part four): WHAT A REFUSAL SAYS OF THE DAY IS KEPT - the plan went on offering
    // the act as ready, the act played, the tool wore, and the same refusal came every try. The character's day or the
    // Stores filled elsewhere (another device): the state is read again. The account's day in the craft, or its veins in
    // dungeons nobody has vouched for - counts the state does not carry: closed until the UTC day turns.
    if (r?.error === 'prof-cap' || r?.error === 'stores-full') state.reread = true;
    if (r?.error === 'prof-account-cap') state.closed.set(`account:${NODE_PROFESSIONS[parseNodeKey(h.node)?.kind] ?? ''}`, dayOf(now()));
    if (r?.error === 'prof-deep-cap') state.closed.set('deep', dayOf(now()));
    staleGround(h.node);   // GROUND-STALE: a refusal (`prof-rank` on a node the client stood within the rank) is the stale ground's word too
    // AUDIT 32 B2: the account's day as the refusal says it - the book counted what this device saw, and another
    // character (or device) of the account may have taken the rest; a knife worn on every try until the next day's read
    if (r?.error === 'prof-hunt-cap') state.hunt = { ...(state.hunt ?? { hides: 0, high: 0 }), hides: Math.max(state.hunt?.hides ?? 0, state.caps?.hides ?? HIDES_PER_DAY) };
    if (r?.error === 'prof-fish-cap') state.hauls = Math.max(state.hauls ?? 0, state.caps?.hauls ?? HAULS_PER_DAY);   // PROF8: the day's forty, as the service says
    if (r?.error === 'prof-hunt-high') state.hunt = { ...(state.hunt ?? { hides: 0, high: 0 }), high: Math.max(state.hunt?.high ?? 0, state.caps?.highHides ?? HIGH_HIDES_PER_DAY) };
    return { ok: false, error: r?.error ?? 'server' };
  }
  /** AUDIT BAG1 B2: a carried harvest's `held`, `heldKey` and `seen`, read now - kept harvests from before the audit,
   *  which name no material, say a held count the service no longer reads. */
  function heldBody(h) {
    if (!carry || typeof h.material !== 'string') return Number.isSafeInteger(h.held) ? { held: h.held } : {};
    return { held: heldNow(h.material), heldKey: h.material, seen: seenNow(h.material) };
  }
  /** BAG1: a carried harvest's goods into the bag or the pack - the material, a gem, a second find - each minted by the
   *  host's hands; `{ bag, pack, left }` summed, for the words (a unit with no room was left where it was gathered: the
   *  service's count of it falls to the truth at the next act that reads it). AUDIT BAG1 B9: and `lost`, what was left of
   *  each material by name - a gem or a second find left was said as the harvest's own. */
  function mintHarvest(d) {
    const out = { bag: 0, pack: 0, left: 0, lost: /** @type {{ key: string, n: number }[]} */ ([]) };
    const add = (k, n) => {
      if (typeof k !== 'string' || !(n > 0)) return;
      let got = null;
      try { got = carry?.mint(k, n) ?? null; } catch (e) { console.warn('[prof] a harvest would not mint', e); }
      const left = got ? got.left : n;
      if (got) { out.bag += got.bag; out.pack += got.pack; }
      if (left > 0) { out.left += left; out.lost.push({ key: k, n: left }); }
    };
    add(d.material, Number(d.qty) || 0);
    if (d.gem) add(d.gem, 1);
    if (d.extra) add(d.extra, Number(d.extraQty) || 1);
    return out;
  }
  function drop(id, key) {
    const kept = keptOf(key);
    kept.harvests = kept.harvests.filter((x) => x.rid !== id);
    writeKept(kept, key);
  }
  /** A kept craft's ask (PROF3): its pieces minted and the craft let go on an answer, let go on a refusal, kept on
   *  silence - the service's row answers the same id with the same pieces whenever it is asked again. */
  async function craftOne(w, key, mint) {
    const r = await ask(() => (w.brew === true   // PROF12: a brew kept as a craft is
      ? door.brew(w.character, w.recipe, w.keys, w.rid, Number.isSafeInteger(w.seat) ? w.seat : null)
      : door.craft(w.character, w.recipe, w.clean, w.name, w.rid, w.heartwood === true, Number.isInteger(w.dye) ? w.dye : null, Number.isSafeInteger(w.seat) ? w.seat : null, w.cracked === true)));   // PROF10: the cracked gem
    // AUDIT 32 B5: heard after a switch, the craft waits kept for its own character's settle - asked again there, the
    // service's row answers the same pieces into the right pack
    if (key !== slot()) return { ok: false, error: 'elsewhere', kept: true };
    const kept = keptOf(key);
    if (r?.ok) {
      const had = kept.crafts.some((x) => x.rid === w.rid);
      kept.crafts = kept.crafts.filter((x) => x.rid !== w.rid);
      writeKept(kept, key);   // let go BEFORE the pieces are made: a mint that threw is never a second mint
      for (const st of r.data?.stores ?? []) applyStore(st);
      applyTrack(r.data?.track);
      if (!had) return { ok: true, data: r.data, elsewhere: true };
      try { mint(r.data, w); } catch (e) { console.warn('[prof] a craft would not mint', e); }   // AUDIT 30 C4: the kept craft its fee
      return { ok: true, data: r.data };
    }
    if (keptAnswer(r)) return { ok: false, error: r?.error ?? 'offline', kept: true };
    kept.crafts = kept.crafts.filter((x) => x.rid !== w.rid);
    writeKept(kept, key);
    shutBy(r);
    return { ok: false, error: r?.error ?? 'server' };
  }
  /** BAG1: units of a material a station made, out of the Stores into the bag or the pack - as many as fit - by a
   *  carrying withdrawal of the book's own (its kept act, minted once). `{ bag, pack, stored }`: how many went where,
   *  and how many stayed in the Stores. */
  async function carryOut(material, n) {
    const out = { bag: 0, pack: 0, stored: n };
    const fit = Math.min(n, carry?.room(material) ?? 0, 200);
    if (!(fit > 0)) return out;
    const r = await book.withdraw(material, fit, (k, q) => { const got = carry?.mint(k, q); if (got) { out.bag += got.bag; out.pack += got.pack; out.stored -= got.bag + got.pack; } });
    return r?.ok ? out : { bag: 0, pack: 0, stored: n };
  }
  /** BAG1: a deposit's ask - answered (the Stores and the count moved), refused (its items given back), or kept out and
   *  pending, asked again with the same id. AUDIT BAG1 B2: `held` read at each ask (this deposit's own units counted
   *  among those still out), with the count as last heard. AUDIT BAG1 B17: let go by the tab that hears the answer - read
   *  and removed in one turn before anything is given back (AUDIT 29 C5's law), so two tabs give back once. */
  async function askDeposit(d, key) {
    const r = await ask(() => door.deposit(d.character, d.material, d.qty, heldNow(d.material), d.order, d.id, seenNow(d.material)));
    if (keptAnswer(r) || r?.error === 'prof-rate') return { ok: false, error: r?.error ?? 'offline', kept: true };
    if (key !== slot()) return { ok: false, error: 'elsewhere', kept: true };   // its own character's settle hears it again
    const kept = keptOf(key);
    const had = kept.deposits.some((x) => x.id === d.id);
    kept.deposits = kept.deposits.filter((x) => x.id !== d.id);
    writeKept(kept, key);
    const back = depositBacks.get(d.id);
    depositBacks.delete(d.id);
    if (r?.ok) { applyStore(r.data?.store); applyCarried(r.data?.carried); return r; }
    if (had) {
      try {
        if (back) back();
        else {   // a reload: only what the bag and the pack are short of what they held - never a copy of a save's own
          const short = Math.min(d.qty | 0, Math.max(0, (d.before | 0) - (carry?.held(d.material) ?? 0)));
          if (short > 0) carry?.mint(d.material, short);
        }
      } catch (e) { console.warn('[prof] a deposit would not give back', e); }
    }
    shutBy(r);
    if (r?.error === 'carried-short' || r?.error === 'stores-full') state.reread = true;   // the counts moved elsewhere: read again
    return r ?? { ok: false, error: 'server' };
  }
  /** BAG1: the deposits whose answers never came, asked again - this account's and character's only. */
  async function settleDeposits() {
    const key = slot();
    for (const d of [...keptOf(key).deposits]) await askDeposit(d, key);
  }
  /** A kept withdrawal's ask: minted and let go on an answer, let go on a refusal, kept on silence. */
  async function settleOne(w, key, mint) {
    // AUDIT BAG1 B2: held read at the ask, with the count as last heard (a withdrawal kept from before the audit: its own)
    const r = await ask(() => door.withdraw(w.character, w.material, w.qty, w.rid, w.carry === true
      ? (carry ? { held: heldNow(w.material), seen: seenNow(w.material) } : { held: w.held | 0 }) : null));
    if (key !== slot()) return { ok: false, kept: true, text: '' };   // AUDIT 32 B5: its own character's settle mints it
    const kept = keptOf(key);
    if (r?.ok) {
      // AUDIT 29 C5: minted by the tab that lets it go - read and removed in one turn, so a second tab settling the same
      // kept withdrawal (both booted with it) finds it gone and mints nothing
      const had = kept.withdrawals.some((x) => x.rid === w.rid);
      kept.withdrawals = kept.withdrawals.filter((x) => x.rid !== w.rid);
      writeKept(kept, key);   // let go BEFORE the items are made: a mint that threw is never a second mint
      applyStore(r.data?.store);
      applyCarried(r.data?.carried);   // BAG1
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
