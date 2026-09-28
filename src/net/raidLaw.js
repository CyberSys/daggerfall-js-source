// @ts-check
// RAID3 (2026-09-27, Mac, on World Events - Raiding Parties online: "1. Server" - the relay tracks each raid's kill
// count, kept even if everyone leaves, the cleanse and the participants, and signs the rewards): A TOWN'S RAID, AS THE
// RELAY KEEPS IT. Design: bible/03-World/Raiding-Parties.md, "The relay holds the raid (RAID3)".
//
// THE LEDGER lives in the raided town's CELL (net/wire.js worldRoom - the room every player standing in the town is
// in), one a raid, in the cell object's storage for the raid's window and RAID_KEEP_MS past it: so a raid's count
// outlives everyone leaving it, and the next player to walk in fights on from it. It is fed by the players' WORDS -
// each, every few seconds while they stand in the town during its raid: the raid they stand in (its key, its start,
// its target, its party and its town's map pixel, as the day's own roll made them - RAID1), the deaths of THEIR OWN
// raiders so far, and whether they have struck a raider (the renown stamp). The first word keeps what the raid is
// (WOD7's law: the first claim keeps); every word after it adds only its deaths and its speaker.
//
// WHAT THE RELAY CAN CHECK, it checks: a word is heard only inside its raid's day and window (the shared clock -
// WORLD5), in the cell its town stands in, from a socket whose own pose stands on the town's pixel; a raid's count
// grows no faster than raiders can stand (RAID_KILL_MS: the mod stands one every one to ten seconds), and a share
// said past that is CLIPPED, not refused - the rest is credited as the raid runs on; each account's share is the most
// it has said (RAID2's law - a share is never taken back, and a speaker who says it again adds nothing). WHAT IT
// CANNOT: a kill and a blow are the players' own machines' word (co-op's law - the relay has no world to see them
// in), and it has no copy of the day's schedule (no game data), so it holds a raid it was told of in its window, its
// cell and its pose, and no other. The account service bounds the record (RAID4).
//
// THE CLEANSE is the ledger's: the count at the target, stamped ONCE, with a receipt (net/raidReceipt.js) to each
// account that EARNED one - it struck a raider (said) and stood in the town at the cleanse (a word within
// RAID_PRESENT_MS), the mod's own law (it paid a player on the town's pixel at the cleanse; RAID1 fix 5: one who
// fought). One receipt an account a raid.
//
// PURE - no clock, no storage, no socket: the relay (server/src/index.js) hands in the minute and the millisecond, and
// the pins drive it as the relay would. Imports nothing, so the worker's graph stays flat (guildLaw.js's law).
//
// Not a DFU member. Ledger A (RAID1's row).

/** A raid's key - RaidEnemyName's bracket [IL_13cc]: `region:location:day` (systems/raidingParties.js raidKey). */
export const RAID_KEY_RE = /^\d{1,2}:\d{1,4}:\d{1,7}$/;
/** A game day, classic minutes. */
export const RAID_DAY_MINUTES = 1440;
/** A raid's window, classic minutes (systems/raidingParties.js RAID_DURATION_MINUTES - pinned equal). */
export const RAID_WINDOW_MINUTES = 120;
/** The latest a raid starts in its day, classic minutes (RAID_START_SPAN - 1: `Random.Range(0, 1321)` - pinned). */
export const RAID_START_LAST = 1320;
/** A raid's target: `Random.Range(15, 26)` (RAID_KILLS_MIN, RAID_KILLS_MAX_EXCLUSIVE - 1 - pinned equal). */
export const RAID_TARGET_MIN = 15;
export const RAID_TARGET_MAX = 25;
/** The parties: 0 knights, 1 bandits, 2 orcs (the mod's `type`). */
export const RAID_TYPES = 3;
/** The slack either side of a raid's window, classic minutes - ten real seconds of two clocks' skew (WORLD5). */
export const RAID_SLACK_MINUTES = 2;
/** The most deaths one word may say (raidShared.js RAID_KILLS_WIRE_MAX - pinned equal). */
export const RAID_WORD_KILLS_MAX = 999;
/** THE CAP: a raid's count grows no faster than raiders can stand - one a RAID_KILL_MS (the mod's Random.Range(1, 11)
 *  seconds between raiders, at its shortest), and RAID_KILLS_BURST more from the moment of its first word. An honest
 *  raid never meets it; a word that says more is credited as the raid runs on. */
export const RAID_KILL_MS = 1000;
export const RAID_KILLS_BURST = 3;
/** The accounts one ledger records - a town's raid is twenty-five raiders; past this a newcomer's word counts nothing. */
export const RAID_ACCOUNTS_MAX = 64;
/** "Stood in the town at the cleanse": a word within this of it (a word goes every RAID_WORD_MS). */
export const RAID_PRESENT_MS = 15000;
/** How often a player standing in a raided town says its word, ms (and at once when its deaths or its strike change). */
export const RAID_WORD_MS = 5000;
/** How long a ledger outlives its raid's window, ms - its receipts handed again to an account that comes back. */
export const RAID_KEEP_MS = 10 * 60 * 1000;
/** A word that moves nothing but its speaker's moment is written at most this often - an eviction loses that much of
 *  who stood where, never a death or a strike (those are written at once). */
export const RAID_SAVE_MS = 5000;
/** The ledgers one cell keeps - a cell is sixteen pixels square, and the Bay has two dozen raids a game day. */
export const RAID_LEDGERS_MAX = 4;
/** The names a cleanse says. */
export const RAID_TOP_MAX = 3;

/** A raid key's day, or null. */
export function raidDayOfKey(key) {
  if (typeof key !== 'string' || !RAID_KEY_RE.test(key)) return null;
  return Number(key.slice(key.lastIndexOf(':') + 1));
}

/**
 * Is a word inside its raid's time - the start in its key's day, and the shared clock (`g`, classic minutes) inside
 * the window it names, give or take the slack?
 * @param {{key: string, st: number}} w @param {number} g
 */
export function raidWordFits(w, g) {
  const day = raidDayOfKey(w?.key);
  if (day === null || !Number.isSafeInteger(w.st) || !Number.isFinite(g)) return false;
  const first = day * RAID_DAY_MINUTES;
  if (w.st < first || w.st > first + RAID_START_LAST) return false;
  return g >= w.st - RAID_SLACK_MINUTES && g < w.st + RAID_WINDOW_MINUTES + RAID_SLACK_MINUTES;
}

/** The minute past which a ledger's raid can hear no word (the relay adds RAID_KEEP_MS in its own clock). */
export const raidLedgerEndMinute = (led) => led.st + RAID_WINDOW_MINUTES + RAID_SLACK_MINUTES;

/**
 * @typedef {{nm: string, n: number, s: 0|1, last: number}} RaidAccount
 * @typedef {{key: string, st: number, tg: number, ty: number, px: number, py: number, first: number, n: number,
 *   a: Record<string, RaidAccount>, cl: null|{at: number, top: string[], n: number}, rc: Record<string, string>, told: boolean}} RaidLedger
 */

/**
 * A raid's ledger, off its first word: the raid as that word names it, nothing counted.
 * @param {{key: string, st: number, tg: number, ty: number, px: number, py: number}} w @param {number} nowMs
 * @returns {RaidLedger}
 */
export function newRaidLedger(w, nowMs) {
  return { key: w.key, st: w.st, tg: w.tg, ty: w.ty, px: w.px, py: w.py, first: nowMs, n: 0, a: {}, cl: null, rc: {}, told: false };
}

/** The most a raid's count may be at `nowMs` (THE CAP above). */
export const raidCap = (led, nowMs) => RAID_KILLS_BURST + Math.floor(Math.max(0, nowMs - led.first) / RAID_KILL_MS);

/**
 * One word folded in: the account's record (its name, its strike, its last word) and its deaths - the most it has
 * said, credited as far as the cap and the target let them. Answers what the raid's count took from it now, and
 * whether the account is on the ledger at all (a full ledger records no newcomer). Nothing after the cleanse.
 * @param {RaidLedger} led @param {string} acct @param {string} name @param {{n: number, s?: number}} w @param {number} nowMs
 */
export function foldRaidWord(led, acct, name, w, nowMs) {
  if (led.cl) return { credited: 0, known: !!led.a[acct] };
  let rec = led.a[acct];
  if (!rec) {
    if (Object.keys(led.a).length >= RAID_ACCOUNTS_MAX) return { credited: 0, known: false };
    rec = led.a[acct] = { nm: '', n: 0, s: 0, last: 0 };
  }
  rec.nm = typeof name === 'string' ? name : '';
  rec.last = nowMs;
  if (w.s === 1) rec.s = 1;
  let credited = 0;
  if (w.n > rec.n) {
    credited = Math.max(0, Math.min(w.n - rec.n, raidCap(led, nowMs) - led.n, led.tg - led.n));
    rec.n += credited;
    led.n += credited;
  }
  return { credited, known: true };
}

/** Is the raid's count at its target? */
export const raidCleansed = (led) => led.n >= led.tg;

/**
 * The accounts that EARNED the cleanse at `atMs`: struck a raider, and said so from the town's pixel within
 * RAID_PRESENT_MS of it. `[account, record]` pairs, in the ledger's order.
 * @param {RaidLedger} led @param {number} atMs @returns {Array<[string, RaidAccount]>}
 */
export function raidEarned(led, atMs) {
  return Object.entries(led.a).filter(([, r]) => r.s === 1 && atMs - r.last <= RAID_PRESENT_MS);
}

/** The names a cleanse says: the earners who counted most deaths first, then by name, RAID_TOP_MAX of them. */
export function raidTop(earned) {
  return earned.slice()
    .sort(([, a], [, b]) => b.n - a.n || (a.nm < b.nm ? -1 : a.nm > b.nm ? 1 : 0))
    .map(([, r]) => r.nm).filter((nm) => typeof nm === 'string' && nm).slice(0, RAID_TOP_MAX);
}

/** The ledger as a word says it: the count, the target, the start, and the cleanse's moment (0: none yet). */
export const raidLedgerState = (led) => ({ k: 'st', key: led.key, n: led.n, tg: led.tg, st: led.st, c: led.cl ? led.cl.at : 0 });
