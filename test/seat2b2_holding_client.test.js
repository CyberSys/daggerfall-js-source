// SEAT2b part two (2026-10-01, Mac: "I want to finish the inprogress"): THE HOLDING'S CLIENT - the works' effects a
// holder's members feel (bible/11-Multiplayer/Seats-Arc.md 7.5, 7.7; `06-Systems/Online-Arc.md` SEAT2b (part one)'s "NOT
// YET (part two)"): each seat dressed in its standing works and the list's `watch` (net/townSeatBook.js); the
// Watchtowers' word said once a (week, seat, guild, share) and on the Seat tab, the list read on a bounded wait
// (net/memberWorks.js); a revolt's battle line and its holder-only signing (ui/seatTab.js); the Harbour's coastal test
// over the climate map kept before the dilation, and the member ports through HasPort and each of its callers
// (systems/travelPorts.js); the halls' quality steps - `at` kept and replayed to the craft door, a line at each station
// (net/profBook.js, ui/profPages.js); the Ram Kit on the workbench, into the Stores (the real Worker's answer), never
// withdrawn, on a Siege Camp's writ alone; the Siegewright's card; the world's and the modes' wiring by source.
//
// The seats list's `works` and `watch` are the service's half of the contract (the integrator's LANE S, built in
// parallel): the fixtures here are the contract's SEATS LIST shape, the holder as the service's holdsOf mints it
// (server-account/src/seatInfluence.js guildView). The Ram Kit's craft answer is the real Worker's (Phase 1 built it).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { byClass } from './chargenDom.mjs';
import { standService, T0, sessionStorageOf } from './accountDb.mjs';
import {
  seatWorksOf, heldBy, memberWorksOf, memberPortsOf, watchtoweredOf, hallStepsLine, WATCH_SHARE_WORDS, watchRowOf, watchRowsOf,
  watchtowerLine, watchtowerWordId, NO_WORKS,
} from '../src/net/memberWorks.js';
import {
  createTownSeatBook, SEAT_WATCHTOWER_READ_MS, SEAT_RED_READ_MS, SEAT_LIST_CACHE_MS, SEAT_WORD_SEEN_KEY, SEAT_WORD_SEEN_MAX,
} from '../src/net/townSeatBook.js';
import { accountSeats, accountProf, SESSION_KEY, accountRefusalText } from '../src/net/accountClient.js';
import { createProfBook } from '../src/net/profBook.js';
import { seatWeekOf, siegeStartMs } from '../src/net/townSeatLaw.js';
import { recipeById, RAM_KIT_RANK } from '../src/net/recipeLaw.js';
import { xpForRank, RAM_KIT_KEY } from '../src/net/professionLaw.js';
import { FORT_MATERIALS, watchtowerShare } from '../src/net/fortLaw.js';
import {
  hasPort, setMemberPorts, memberPort, memberPortsVersion, maskMapId, coastalPixel, coastOf, PORT_LOCATION_IDS,
} from '../src/systems/travelPorts.js';
import { isNotAtPort, hasNoOceanTravel, isDestNotValidPort, shipTravelRefusal } from '../src/ui/travelPopUp.js';
import { portsFilterAllows } from '../src/ui/travelMapOptions.js';
import { createTravelOptions } from '../src/systems/travelOptions.js';
import { PakFile, PAK_WIDTH } from '../src/formats/pakFile.js';
import { MapsFile } from '../src/formats/mapsFile.js';
import { dilateCoastalClimate, OCEAN_CLIMATE } from '../src/world/terrainHelper.js';
import { createSeatTab, SEAT_REVOLT_SIDE, SEAT_REVOLT_WORDS } from '../src/ui/seatTab.js';
import { drawSeatWorks } from '../src/ui/seatWorks.js';
import {
  setProfessionsPages, drawStoresPage, drawProfessionsPage, resetProfPages, storedWorkText, RAM_KIT_BENCH_LINE, RAM_KIT_STAYS_LINE,
} from '../src/ui/profPages.js';
import { materialLabel, materialCountLabel, mintMaterialItem } from '../src/systems/profItems.js';
import { mintPieces } from '../src/systems/smithItems.js';
import { setPref } from '../src/systems/uiPrefs.js';
import { utcDay } from '../src/net/marksLaw.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), m }; };
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await Promise.resolve(); };
const noWait = () => Promise.resolve();
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const kit = { el, divider: (w) => el('h3', null, w), meter: () => el('div') };

// THE SEATS LIST AS THE CONTRACT MINTS IT: each seat its holder (holdsOf's `{ guild: guildView, since, standing, tithe }`
// with the Edict seatsWithHolders adds), its battle, and (part two) its standing works; the list `watch` for the reader's
// guild. A seat key is its map id unsigned (systems/townSeats.js) - a flag bit above the twenty the port table masks.
const SH = { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry: null };
const EO = { id: 'g2', name: 'Ebon Oath', tag: 'EO', heraldry: null };
const IC = { id: 'g3', name: 'Iron Circle', tag: 'IC', heraldry: null };
const FLAG = 0x00100000;
const ANTICLERE = { key: FLAG | 120300, name: 'Anticlere', region: 21, tier: 'palace', pixel: [300, 120] };
const ASHFIELD = { key: FLAG | 130410, name: 'Ashfield', region: 21, tier: 'palace', pixel: [410, 130] };
const KIRKBETH = { key: FLAG | 140520, name: 'Kirkbeth', region: 21, tier: 'palace', pixel: [520, 140] };
const NAMES = new Map([ANTICLERE, ASHFIELD, KIRKBETH].map((s) => [s.key, s.name]));
const holder = (guild) => ({ guild, since: 3, standing: 55, tithe: 6, edict: null });
const listOf = ({ watch } = {}) => ({
  seats: [
    { key: ANTICLERE.key, name: 'Anticlere', region: 21, tier: 'palace', state: 'confirmed', holder: holder(SH), battle: null, works: { walls: 2, watchtowers: 1, harbour: 1, forge: 1, workshop: 2 } },
    { key: ASHFIELD.key, name: 'Ashfield', region: 21, tier: 'palace', state: 'confirmed', holder: holder(SH), battle: null, works: { walls: 1 } },
    { key: KIRKBETH.key, name: 'Kirkbeth', region: 21, tier: 'palace', state: 'confirmed', holder: holder(EO), battle: null, works: { harbour: 2, watchtowers: 2 } },
  ],
  red: [], zero: null,
  ...(watch ? { watch } : {}),
});
/** A book over a door answering the list (`answer()` each read) - the characters each read asked with, kept. */
function bookOn({ answer = () => ({ ok: true, data: listOf() }), guild = () => 'g1', character = () => 'c1', storage = null, nowMs = () => T0 * 1000, onWord = null, nameOf = (k) => NAMES.get(k) ?? null } = {}) {
  const asked = [];
  const door = { list: async (c) => { asked.push(c); return answer(); } };
  const book = createTownSeatBook({ door: /** @type {any} */ (door), character, storage, nowMs, guildId: guild, nameOf, onWord });
  return { book, asked };
}

// ─── THE DRESSED WORKS AND THE WATCH ─────────────────────────────────

test('SEAT2b2 THE DRESSED WORKS: the list asked with the reader\'s character (its guild\'s `watch`), each seat dressed in its standing works - the known works at their tiers, nothing else; an unread or bare seat none; another character\'s ask reads afresh; the door posts the character (mutants: the character asked; the works kept; their bounds; the cache a character\'s; the door\'s body)', async () => {
  assert.deepEqual(seatWorksOf({ walls: 2, watchtowers: 1, harbour: 1, gatehouse: 0, barracks: 4, shrine: 1.5, bogus: 3, forge: '1' }), { walls: 2, watchtowers: 1, harbour: 1 }, 'a tier past the work\'s last, a tier 0, a fraction, a word and an unknown work dropped');
  assert.equal(seatWorksOf({ walls: 3, gatehouse: 3, barracks: 3, market: 3 }).market, 3);
  assert.equal(seatWorksOf({ shrine: 3 }), NO_WORKS, 'the Shrine stands two tiers');
  assert.deepEqual([seatWorksOf(null), seatWorksOf([1, 2]), seatWorksOf('x')], [NO_WORKS, NO_WORKS, NO_WORKS]);
  assert.ok(Object.isFrozen(seatWorksOf({ walls: 1 })));
  let who = 'c1';
  const { book, asked } = bookOn({ character: () => who });
  assert.deepEqual(book.dressed(ANTICLERE).works, {}, 'unread: none');
  await book.read();
  assert.deepEqual(asked, ['c1'], 'asked with the reader\'s character');
  const d = book.dressed(ANTICLERE);
  assert.deepEqual([d.holder.guild.tag, d.battle, d.works], ['SH', null, { walls: 2, watchtowers: 1, harbour: 1, forge: 1, workshop: 2 }]);
  assert.deepEqual(book.dressed({ ...ANTICLERE, key: 999 }).works, {}, 'a seat the list does not name: none');
  await book.read();
  assert.deepEqual(asked, ['c1'], 'the list\'s minutes hold for the same character');
  who = 'c2';
  await book.read();
  assert.deepEqual(asked, ['c1', 'c2'], 'another character reads afresh - its guild\'s `watch` is not the first\'s');
  // the door: the character in the body, none without one
  const bodies = [];
  const fetch = async (u, init) => { bodies.push([u.replace(/^.*\/v1/, '/v1'), JSON.parse(init.body)]); return { ok: true, json: async () => ({ ok: true, seats: [] }) }; };
  const door = accountSeats({ fetch, storage: sessionStorageOf(SESSION_KEY, { secret: 's3cret', id: 'acct-1' }) });
  await door.list('c9'); await door.list(); await door.list('');
  assert.deepEqual(bodies, [['/v1/seats/list', { character: 'c9' }], ['/v1/seats/list', {}], ['/v1/seats/list', {}]]);
  // the fund's flag: `coastal` (SEAT2b part two), sent only when true
  bodies.length = 0;
  await door.fortFund('c9', ANTICLERE.key, 'harbour', 'r1', true);
  await door.fortFund('c9', ANTICLERE.key, 'walls', 'r2');
  assert.deepEqual(bodies.map(([, b]) => b), [{ character: 'c9', key: ANTICLERE.key, work: 'harbour', rid: 'r1', coastal: true }, { character: 'c9', key: ANTICLERE.key, work: 'walls', rid: 'r2' }]);
});

test('SEAT2b2 WHAT THE READER\'S GUILD HOLDS: a seat held by its guild (none for a reader in no guild); its halls\' works; the member ports - its held seats whose Harbour stands, named by this client\'s own derivation; whether a held seat\'s Watchtowers stand (mutants: the guild match; no guild; the Harbour; the derivation; the Watchtowers)', async () => {
  const seats = listOf().seats.map((s) => ({ key: s.key, holder: s.holder, works: seatWorksOf(s.works) }));
  assert.deepEqual([heldBy(seats[0], 'g1'), heldBy(seats[0], 'g2'), heldBy({ holder: null }, null), heldBy({ holder: null }, undefined), heldBy(null, 'g1')], [true, false, false, false, false]);
  assert.deepEqual(memberWorksOf(seats[0], 'g1'), seats[0].works);
  assert.equal(memberWorksOf(seats[0], 'g2'), null, 'another guild\'s seat: no halls');
  assert.deepEqual(memberWorksOf({ key: 1, holder: holder(SH) }, 'g1'), {}, 'held and bare');
  assert.deepEqual([...memberPortsOf(seats, 'g1')], [ANTICLERE.key], 'Ashfield has no Harbour; Kirkbeth is the Oath\'s');
  assert.deepEqual([...memberPortsOf(seats, 'g2')], [KIRKBETH.key]);
  assert.deepEqual([...memberPortsOf(seats, null)], []);
  assert.deepEqual([...memberPortsOf(seats, 'g1', () => false)], [], 'a seat this client\'s derivation lacks is never a port');
  assert.deepEqual([...memberPortsOf([{ key: -1, holder: holder(SH), works: { harbour: 1 } }], 'g1')], [], 'no seat key, no port');
  assert.ok(Object.isFrozen(memberPortsOf(seats, 'g1')));
  assert.deepEqual([watchtoweredOf(seats, 'g1'), watchtoweredOf(seats, 'g2'), watchtoweredOf(seats, 'g3'), watchtoweredOf([{ key: 1, holder: holder(IC), works: { watchtowers: 0 } }], 'g3')], [true, true, false, false]);
  // the book's: worked out once a list and a guild, nothing while the seats are shut
  let guild = 'g1';
  let answer = { ok: true, data: listOf() };
  const { book } = bookOn({ guild: () => guild, answer: () => answer });
  assert.deepEqual([...book.memberPorts()], [], 'unread');
  await book.read();
  const ports = book.memberPorts();
  assert.deepEqual([...ports], [ANTICLERE.key]);
  assert.equal(book.memberPorts(), ports, 'the same array until the list or the guild moves');
  assert.equal(book.watchtowered(), true);
  assert.deepEqual(book.memberWorks(book.dressed(ANTICLERE)), { walls: 2, watchtowers: 1, harbour: 1, forge: 1, workshop: 2 });
  assert.equal(book.memberWorks(book.dressed(KIRKBETH)), null);
  guild = 'g3';
  assert.deepEqual([[...book.memberPorts()], book.watchtowered(), book.memberWorks(book.dressed(ANTICLERE))], [[], false, null], 'another guild: nothing of the Hand\'s');
  guild = 'g1';
  answer = { ok: false, error: 'seats-closed' };
  await book.read({ force: true });
  assert.deepEqual([[...book.memberPorts()], book.watchtowered(), book.memberWorks(book.dressed(ANTICLERE))], [[], false, null], 'shut: nothing');
  const thrown = bookOn({ guild: () => { throw new ReferenceError('guildBook'); } });
  await thrown.book.read();
  assert.deepEqual([...thrown.book.memberPorts()], [], 'a host whose guild is not ready holds nothing (never a throw)');
  const lacking = bookOn({ nameOf: () => null });
  await lacking.book.read();
  assert.deepEqual([...lacking.book.memberPorts()], [], 'a seat this client\'s own derivation lacks is no port');
  // the seats shut by a standings read: what the guild holds goes with them (the list itself not read again)
  const shutBy = createTownSeatBook({ door: /** @type {any} */ ({ list: async () => ({ ok: true, data: listOf() }), standings: async () => ({ ok: false, error: 'seats-closed' }) }), character: () => 'c1', guildId: () => 'g1', nameOf: (k) => NAMES.get(k) ?? null, nowMs: () => T0 * 1000 });
  await shutBy.read();
  assert.deepEqual([...shutBy.memberPorts()], [ANTICLERE.key]);
  await shutBy.standings(ANTICLERE.key);
  assert.deepEqual([[...shutBy.memberPorts()], shutBy.watchtowered(), shutBy.memberWorks(shutBy.dressed(ANTICLERE))], [[], false, null], 'shut: no port, no tower, no hall');
});

// ─── THE WATCHTOWERS' WORD ───────────────────────────────────────────

test('SEAT2b2 THE WATCHTOWERS\' WORD: a row of the list\'s `watch` read as the service mints it; "Your Watchtowers at Anticlere: the Silver Hand <SH> has passed half your defence." - a quarter at tier 2; the word\'s id a (week, seat, guild, share) (mutants: the shares; each bound; the words; the guild\'s "the"; the id)', () => {
  assert.deepEqual({ ...WATCH_SHARE_WORDS }, { 0.5: 'half', 0.25: 'a quarter of' });
  assert.deepEqual([watchtowerShare(1), watchtowerShare(2)], [0.5, 0.25], 'fortLaw.js\'s own shares');
  const row = { key: ANTICLERE.key, guild: { name: 'The Silver Hand', tag: 'SH' }, share: 0.5 };
  assert.deepEqual(watchRowOf(row), row);
  for (const bad of [{ ...row, share: 0.3 }, { ...row, share: '0.5' }, { ...row, key: -1 }, { ...row, key: 2 ** 32 }, { ...row, guild: { name: 'X', tag: '' } }, { ...row, guild: { name: 7, tag: 'X' } }, { ...row, guild: null }, null])
    assert.equal(watchRowOf(bad), null, JSON.stringify(bad));
  assert.deepEqual(watchRowsOf([row, { ...row, share: 9 }, 'x']), [row]);
  assert.deepEqual([watchRowsOf(null), watchRowsOf({})], [[], []]);
  assert.equal(watchtowerLine(row, 'Anticlere'), 'Your Watchtowers at Anticlere: the Silver Hand <SH> has passed half your defence.');
  assert.equal(watchtowerLine({ ...row, guild: { name: 'Iron Circle', tag: 'IC' }, share: 0.25 }, 'Ashfield'), 'Your Watchtowers at Ashfield: Iron Circle <IC> has passed a quarter of your defence.');
  assert.equal(watchtowerWordId(40, row), `40|${ANTICLERE.key}|SH|0.5`);
  assert.notEqual(watchtowerWordId(40, row), watchtowerWordId(41, row), 'a week anew');
  assert.notEqual(watchtowerWordId(40, row), watchtowerWordId(40, { ...row, share: 0.25 }), 'a quarter after half: told again');
});

test('SEAT2b2 THE WORD SAID ONCE: each `watch` row in the chat once a (week, seat, guild, share) at a seat this client\'s derivation names - kept unsaid while there is no chat and said at the next read; a new week, a new share, another challenger said anew; kept on the device; never for a character the list was not read for (mutants: once; the name; no chat; the week; the store; the character)', async () => {
  const storage = memStorage();
  const said = [];
  let chat = false;
  let now = T0 * 1000;
  let who = 'c1';
  let watch = [{ key: ANTICLERE.key, guild: { name: 'Ebon Oath', tag: 'EO' }, share: 0.5 }, { key: 999, guild: { name: 'Iron Circle', tag: 'IC' }, share: 0.5 }];
  const onWord = (line) => { if (!chat) return false; said.push(line); return true; };
  const { book } = bookOn({ storage, onWord, nowMs: () => now, character: () => who, answer: () => ({ ok: true, data: listOf({ watch }) }) });
  await book.read();
  assert.deepEqual(said, [], 'no chat yet');
  chat = true;
  await book.read({ force: true });
  assert.deepEqual(said.map((l) => l.text), ['Your Watchtowers at Anticlere: Ebon Oath <EO> has passed half your defence.'], 'said - and never for a seat the derivation lacks (999)');
  assert.equal(said[0].at, now);
  await book.read({ force: true });
  assert.equal(said.length, 1, 'once a week, seat, guild and share');
  const again = bookOn({ storage, onWord, nowMs: () => now, answer: () => ({ ok: true, data: listOf({ watch }) }) });
  await again.book.read();
  assert.equal(said.length, 1, 'kept on the device - a new page says it no more');
  assert.deepEqual(JSON.parse(storage.getItem(SEAT_WORD_SEEN_KEY)), [watchtowerWordId(seatWeekOf(now), watch[0])]);
  watch = [{ ...watch[0], share: 0.25 }, { key: ANTICLERE.key, guild: { name: 'The Silver Hand', tag: 'SH' }, share: 0.25 }];
  await book.read({ force: true });
  assert.deepEqual(said.slice(1).map((l) => l.text), ['Your Watchtowers at Anticlere: Ebon Oath <EO> has passed a quarter of your defence.', 'Your Watchtowers at Anticlere: the Silver Hand <SH> has passed a quarter of your defence.'], 'a new share, another challenger');
  now += 7 * 86_400_000;
  await book.read({ force: true });
  assert.equal(said.length, 5, 'a new week: both said anew');
  // a list answered for another character is not this one's to say
  let release = null;
  const late = bookOn({ storage: memStorage(), onWord, character: () => who, nowMs: () => now, answer: () => new Promise((r) => { release = () => r({ ok: true, data: listOf({ watch }) }); }) });
  const p = late.book.read();
  who = 'c2';
  release();
  await p;
  assert.equal(said.length, 5, 'the reader changed mid-read: not said');
  assert.deepEqual(late.book.watchLines(ANTICLERE), [], 'nor shown');
  who = 'c1';
  // the device keeps the newest SEAT_WORD_SEEN_MAX
  const s2 = memStorage();
  s2.setItem(SEAT_WORD_SEEN_KEY, JSON.stringify(Array.from({ length: SEAT_WORD_SEEN_MAX }, (_, i) => `old-${i}`)));
  const full = bookOn({ storage: s2, onWord, nowMs: () => now, answer: () => ({ ok: true, data: listOf({ watch }) }) });
  await full.book.read();
  const kept = JSON.parse(s2.getItem(SEAT_WORD_SEEN_KEY));
  assert.deepEqual([kept.length, kept[0], kept.at(-1)], [SEAT_WORD_SEEN_MAX, 'old-2', watchtowerWordId(seatWeekOf(now), watch[1])]);
  assert.equal(SEAT_WORD_SEEN_MAX, 100);
  // a chat that throws (a host not ready) is no chat: the read answers, the word kept for the next
  const s3 = memStorage();
  const throwing = bookOn({ storage: s3, onWord: () => { throw new ReferenceError('chatLog'); }, nowMs: () => now, answer: () => ({ ok: true, data: listOf({ watch }) }) });
  assert.equal((await throwing.book.read()).error, null);
  assert.equal(s3.getItem(SEAT_WORD_SEEN_KEY), null, 'nothing kept as said');
});

test('SEAT2b2 THE BOUNDED WAIT: a member whose guild holds a seat with Watchtowers reads the list again every SEAT_WATCHTOWER_READ_MS (the list\'s own five minutes), anyone else every SEAT_RED_READ_MS; a read in flight is the one asked; shut, never (mutants: the wait; the Watchtowers\' arm; the guild; the coalesce)', async () => {
  assert.deepEqual([SEAT_WATCHTOWER_READ_MS, SEAT_LIST_CACHE_MS, SEAT_RED_READ_MS], [300_000, 300_000, 900_000]);
  let now = T0 * 1000;
  let guild = 'g1';
  let release = null;
  let slow = false;
  const { book, asked } = bookOn({ guild: () => guild, nowMs: () => now, answer: () => (slow ? new Promise((r) => { release = () => r({ ok: true, data: listOf() }); }) : { ok: true, data: listOf() }) });
  await book.read();
  now += SEAT_WATCHTOWER_READ_MS - 1;
  book.redTick(); await settle();
  assert.equal(asked.length, 1, 'not before its five minutes');
  now += 1;
  slow = true;
  book.redTick(); book.redTick(); book.redTick();
  assert.equal(asked.length, 2, 'the Watchtowers\' holder reads at five minutes - once, the ticks in flight coalesced');
  release(); await settle();
  slow = false;
  guild = 'g3';
  now += SEAT_WATCHTOWER_READ_MS;
  book.redTick(); await settle();
  assert.equal(asked.length, 2, 'a guild with no Watchtowers waits the red lines\' quarter hour');
  now += SEAT_RED_READ_MS - SEAT_WATCHTOWER_READ_MS;
  book.redTick(); await settle();
  assert.equal(asked.length, 3);
  const shut = bookOn({ answer: () => ({ ok: false, error: 'seats-closed' }), nowMs: () => now });
  await shut.book.read();
  now += SEAT_RED_READ_MS * 2;
  shut.book.redTick(); await settle();
  assert.equal(shut.asked.length, 1, 'shut: never');
});

// ─── THE SEAT TAB ────────────────────────────────────────────────────

/** The Seat tab over the real book: its list (`watch`) and its standings (`data`) from one door. */
function tabOn({ data, watch = null, guild = 'g1', coastal = false, enterBattle = null }) {
  const funded = [];
  const door = {
    list: async () => ({ ok: true, data: listOf({ watch }) }),
    standings: async () => ({ ok: true, data }),
    forts: async () => ({ ok: true, data: { works: { walls: { tier: 1, building: null } }, stockpile: [] } }),
    fortFund: async (c, key, work, rid, flag) => { funded.push([key, work, flag]); return { ok: true, data: { tier: 1, marks: 2000 } }; },
    sign: async () => ({ ok: true, data: { side: 'defend', sellsword: false } }),
  };
  const book = createTownSeatBook({ door: /** @type {any} */ (door), character: () => 'c1', nowMs: () => T0 * 1000, guildId: () => guild, nameOf: (k) => NAMES.get(k) ?? null });
  const ui = { busy: () => false, run: (start) => start(), rerender: () => {}, nowS: () => T0, alive: () => true };
  const tab = createSeatTab({ seat: ANTICLERE, book, coastal, ...(enterBattle ? { enterBattle } : {}) }, ui);
  return { tab, book, funded };
}
const standing = (o = {}) => ({
  seat: ANTICLERE, week: 6, phase: 'muster', reckoningAt: T0 + 3600, turningAt: T0 + 86400, defence: 4500, holder: holder(SH),
  battle: null, standings: [], chronicle: [], mine: { guild: 'g1', rank: 0, seasoned: true, bound: 'g1', pledges: [], influence: 0, tributeRoom: 0 },
  holding: { next: null, standing: 55, upkeep: 2500, owed: 0, edict: null, tithe: 6, titheWeek: 6 }, ...o,
});

test('SEAT2b2 THE SEAT TAB\'S WATCHTOWERS AND HARBOUR: the holder\'s block says each challenger past the share as the list last said it; another guild\'s reader sees none; the Harbour offered where the town is coastal and funded with its coast (mutants: the block\'s lines; the seat\'s rows alone; the coastal gate; the fund\'s flag)', async () => {
  const watch = [{ key: ANTICLERE.key, guild: { name: 'Ebon Oath', tag: 'EO' }, share: 0.5 }, { key: ASHFIELD.key, guild: { name: 'Iron Circle', tag: 'IC' }, share: 0.25 }];
  const t = tabOn({ data: standing(), watch, coastal: true });
  await t.book.read();
  await t.tab.open(); await settle();
  let body = t.tab.body();
  assert.deepEqual(byClass(body, 'notice-seat-watch').map((n) => n.textContent), ['Your Watchtowers at Anticlere: Ebon Oath <EO> has passed half your defence.'], 'this seat\'s rows alone');
  assert.deepEqual(t.book.watchLines(ASHFIELD), ['Your Watchtowers at Ashfield: Iron Circle <IC> has passed a quarter of your defence.']);
  const harbour = byClass(body, 'notice-seat-fort-harbour')[0];
  assert.ok(harbour, 'a coastal town\'s Harbour offered');
  await harbour.onclick({}); await settle();
  assert.deepEqual(t.funded, [[ANTICLERE.key, 'harbour', true]], 'funded with the town\'s coast');
  // another guild's reader: no holding block, no word; an inland town: no Harbour
  const o = tabOn({ data: standing({ holding: undefined, mine: { guild: 'g2', rank: 0, seasoned: true, bound: 'g2', pledges: [], influence: 0, tributeRoom: 0 } }), watch });
  await o.book.read();
  await o.tab.open(); await settle();
  body = o.tab.body();
  assert.equal(byClass(body, 'notice-seat-watch').length, 0);
  assert.equal(byClass(body, 'notice-seat-fort-harbour').length, 0, 'inland');
  // the panel's own gate
  const host = el('div');
  assert.ok(drawSeatWorks(host, { forts: { works: {}, stockpile: [] }, seat: { tier: 'palace' }, coastal: true, lever: true }).harbour);
  assert.equal(drawSeatWorks(el('div'), { forts: { works: {}, stockpile: [] }, seat: { tier: 'palace' }, lever: true }).harbour, undefined);
});

test('SEAT2b2 A REVOLT ON THE SEAT TAB: the announcement\'s revolt arm; one roster - the holder\'s side, as a siege\'s defenders, its Sellswords counted; the holder\'s member offered Sign, a Sellsword hired to it Sign as a Sellsword, anyone else told the holder\'s side alone signs; signed, its side said; the Turning\'s line where no fight is placed (mutants: the attackers\' line; the side\'s label; the holder-only arm; the hire\'s side; the fallback)', async () => {
  const start = siegeStartMs(seatWeekOf(T0 * 1000), 0, 20);
  const fight = (mine, open = true) => ({ week: 6, key: ANTICLERE.key, kind: 'revolt', tier: 'palace', startsAt: start / 1000, endsAt: start / 1000 + 7200, moved: false, state: 'scheduled',
    attackerGuild: null, defenderGuild: SH, sides: { attack: { n: 0, swords: 0 }, defend: { n: 3, swords: 1 } }, max: 10, swordsMax: 2, open, window: { day: 0, hour: 20 }, mine });
  const announced = 'Anticlere has risen against the Silver Hand <SH>. Its rebels hold the palace door; the Rebel Captain must fall by the window\'s end, or the Charter lapses. Battle is joined Wednesday at 20:00 UTC.';
  const mount = async (f, o = {}) => { const t = tabOn({ data: standing({ fight: f, ...o }) }); await t.tab.open(); await settle(); return t.tab.body(); };
  let body = await mount(fight({ side: 'defend', signed: false, sellsword: false }));
  assert.ok(body.textContent.includes(announced), body.textContent);
  assert.ok(body.textContent.includes(`${SEAT_REVOLT_SIDE}: 3 of 10 signed (1 Sellsword).`));
  assert.ok(!body.textContent.includes('Attackers:') && !body.textContent.includes('Defenders:'), 'no attackers\' roster: the rebels are the relay\'s');
  assert.equal(byClass(body, 'notice-seat-sign')[0]?.textContent, 'Sign for your side', 'the holder\'s member signs');
  body = await mount(fight({ side: null, signed: false, sellsword: true, hire: { side: 'defend', fee: 300 } }), { mine: { guild: 'g9', rank: 2, seasoned: true, bound: 'g9', pledges: [], influence: 0, tributeRoom: 0 } });
  assert.equal(byClass(body, 'notice-seat-sign')[0]?.textContent, 'Sign as a Sellsword (300 Drakes)', 'a Sellsword hired to the holder\'s side');
  body = await mount(fight({ side: null, signed: false, sellsword: false }), { mine: { guild: 'g2', rank: 0, seasoned: true, bound: 'g2', pledges: [], influence: 0, tributeRoom: 0 } });
  assert.equal(byClass(body, 'notice-seat-sign').length, 0, 'another guild signs nothing');
  assert.ok(body.textContent.includes(SEAT_REVOLT_WORDS.others));
  assert.equal(SEAT_REVOLT_WORDS.others, 'Only the holder\'s side signs against a revolt - the rebels are the town\'s own.');
  body = await mount(fight({ side: null, signed: false, sellsword: false }, false), { mine: { guild: 'g2', rank: 0, seasoned: true, bound: 'g2', pledges: [], influence: 0, tributeRoom: 0 } });
  assert.ok(!body.textContent.includes(SEAT_REVOLT_WORDS.others), 'the rosters closed: nothing to tell');
  body = await mount(fight({ side: 'defend', signed: true, sellsword: true }));
  assert.ok(body.textContent.includes('You are signed for the holder\'s side as a Sellsword.'));
  // a siege still names both sides
  body = await mount({ ...fight({ side: 'attack', signed: false, sellsword: false }), kind: 'siege', attackerGuild: EO });
  assert.ok(body.textContent.includes('Attackers: 0 of 10 signed.') && body.textContent.includes('Defenders: 3 of 10 signed (1 Sellsword).'));
  // the Turning's line, no fight placed: the revolt's announcement where it has its start, nothing where it has none
  body = await mount(null, { battle: { kind: 'revolt', guild: null, against: SH, startsAt: start / 1000, endsAt: start / 1000 + 7200, moved: false, state: 'scheduled' } });
  assert.ok(body.textContent.includes(announced), 'the revolt arm, not a Right of Siege');
  body = await mount(null, { battle: { kind: 'revolt', guild: null, against: SH, startsAt: null, endsAt: null, moved: false, state: 'void' } });
  assert.ok(!body.textContent.includes('risen against') && !body.textContent.includes('has won a Right of Siege'), 'nothing where it has no start - never a Right of Siege\'s line');
});

// ─── THE HARBOUR'S COAST ─────────────────────────────────────────────

/** A CLIMATE.PAK of the reader's own making: all sea, a block of land, as MapsFile reads it. */
function mapsOf(land) {
  const maps = new MapsFile();
  const pak = new PakFile();
  pak.buffer.fill(OCEAN_CLIMATE);
  for (let y = land.y0; y <= land.y1; y++) for (let x = land.x0; x <= land.x1; x++) pak.buffer[y * PAK_WIDTH + (x + 1)] = 226;
  maps.climatePak = pak;
  return maps;
}

test('SEAT2b2 THE HARBOUR\'S COAST: a town touches the sea when a sea pixel is among its eight neighbours (a diagonal too; itself never counts); read off the climate map KEPT BEFORE the dilation - the real dilateCoastalClimate relabels the coast\'s first two rings, after which no town touches the sea; the kept map is a copy, never the reader\'s live buffer (mutants: the sea\'s value; the eight; the centre; the bounds; the copy)', () => {
  const maps = mapsOf({ x0: 100, y0: 100, x1: 110, y1: 110 });
  const coast = coastOf(maps);
  assert.deepEqual([coast(100, 105), coast(110, 110), coast(105, 100), coast(105, 105), coast(101, 101)], [true, true, true, false, false], 'the block\'s edge touches the sea; its heart does not');
  // a diagonal alone: land everywhere but one corner of the town's square
  const pak = new Uint8Array(PAK_WIDTH * 500).fill(226);
  pak[(51) * PAK_WIDTH + (51 + 1)] = OCEAN_CLIMATE;
  assert.equal(coastalPixel(pak, 50, 50), true, 'the sea at a corner');
  assert.equal(coastalPixel(pak, 52, 52), true);
  assert.equal(coastalPixel(pak, 51, 51), false, 'the town\'s own pixel is not a neighbour');
  assert.equal(coastalPixel(pak, 53, 53), false, 'two away');
  pak[(51) * PAK_WIDTH + (51 + 1)] = 224;
  assert.equal(coastalPixel(pak, 50, 50), false, 'a desert is not the sea');
  assert.deepEqual([coastalPixel(null, 1, 1), coastalPixel(pak, 1.5, 1), coastalPixel(pak, 0, 0), coastalPixel(pak, 999, 499)], [false, false, false, false], 'no map; no pixel; the map\'s edge reads no sea past it');
  const edge = new Uint8Array(PAK_WIDTH * 500).fill(226);
  edge[0 * PAK_WIDTH + (999 + 1)] = OCEAN_CLIMATE;
  assert.equal(coastalPixel(edge, 998, 1), true, 'the last column\'s sea counts');
  edge[1 * PAK_WIDTH + 0] = OCEAN_CLIMATE;
  assert.equal(coastalPixel(edge, 0, 0), false, 'the PAK\'s own extra column is no pixel of the map');
  assert.equal(coastalPixel(edge, 999, 0), false, 'nor is a pixel past the map\'s last column (the next row\'s extra byte)');
  // THE DILATION: DFU's own repair, run on the reader - after it the coast's towns touch no sea
  // a writer in place after the capture - the town's three sea neighbours to the west made land on the reader's own buffer:
  // the kept map is a copy taken when it was asked
  for (const y of [104, 105, 106]) maps.climatePak.buffer[y * PAK_WIDTH + (99 + 1)] = 226;
  assert.equal(coastOf(maps)(100, 105), false, 'the live buffer touches no sea there now');
  assert.equal(coast(100, 105), true, 'kept as it was when taken');
  assert.ok(dilateCoastalClimate(maps, 2) > 0);
  const late = coastOf(maps);
  assert.deepEqual([late(100, 105), late(110, 110), late(105, 100)], [false, false, false], 'after the dilation no town touches the sea');
  assert.deepEqual([coast(100, 105), coast(110, 110), coast(105, 100)], [true, true, true], 'the coast kept before it still does');
});

const ARENA2 = process.env.ARENA2_PATH;
const skipReal = !ARENA2 || !existsSync(join(ARENA2, 'MAPS.BSA')) ? 'ARENA2_PATH not set or missing - real-data validation skipped' : false;
test('SEAT2b2 THE HARBOUR\'S COAST ON THE RETAIL MAP: some towns of the Bay touch the sea on the climate map as the file holds it; after the dilation every land town that did touches it no more - which is why the host keeps the coast from before it', { skip: skipReal }, async () => {
  const { buildMapDict } = await import('../src/systems/mapDirectory.js');
  const maps = new MapsFile();
  maps.load(new Uint8Array(readFileSync(join(ARENA2, 'MAPS.BSA'))), new Uint8Array(readFileSync(join(ARENA2, 'CLIMATE.PAK'))), new Uint8Array(readFileSync(join(ARENA2, 'POLITIC.PAK'))));
  const pixels = [...buildMapDict(maps).keys()].map((id) => [id % 1000, Math.floor(id / 1000)]);
  const before = coastOf(maps);
  const land = (x, y) => maps.getClimateIndex(x, y) !== OCEAN_CLIMATE;
  const coastal = pixels.filter(([x, y]) => land(x, y) && before(x, y));
  assert.ok(coastal.length > 0, 'the Bay has a coast');
  dilateCoastalClimate(maps, 2);
  const after = coastOf(maps);
  assert.deepEqual(coastal.filter(([x, y]) => after(x, y)), [], 'none of them touches the sea after the dilation');
  assert.ok(coastal.every(([x, y]) => before(x, y)), 'the coast kept before it');
});

// ─── THE MEMBER PORTS ────────────────────────────────────────────────

test('SEAT2b2 THE MEMBER PORTS: a member\'s harbour is a port through HasPort - the popup\'s three ship laws, the map\'s PORTS filter, the mod\'s own hasPort for other mods, the host\'s harbour (csaIsPortTown, lifted off world.js) - a stranger\'s and a seat with no Harbour never; the mod\'s 378 untouched; a count that moves with them (mutants: HasPort\'s member arm; the mask; the source\'s answer; the version; the reset)', async () => {
  const town = maskMapId(ANTICLERE.key);
  const bare = maskMapId(ASHFIELD.key);
  try {
    assert.deepEqual([hasPort(ANTICLERE.key), hasPort(town), hasPort(ASHFIELD.key)], [false, false, false], 'no Travel Options port of the mod\'s');
    let guild = 'g1';
    const { book } = bookOn({ guild: () => guild });
    await book.read();
    const v0 = memberPortsVersion();
    setMemberPorts(() => book.memberPorts());
    assert.equal(hasPort(ANTICLERE.key), true, 'the Hand\'s Harbour, for the Hand');
    assert.equal(hasPort(town), true, 'by its masked id too, as MapSummary.ID');
    assert.equal(hasPort(0x7FF00000 | town), true, 'whatever flags its MapId carries');
    assert.equal(memberPort(ANTICLERE.key), true);
    assert.equal(memberPort(PORT_LOCATION_IDS[0]), false, 'one of the mod\'s is no member port');
    assert.equal(hasPort(PORT_LOCATION_IDS[0]), true, 'and still a port');
    assert.equal(hasPort(ASHFIELD.key), false, 'a held seat with no Harbour');
    assert.equal(hasPort(KIRKBETH.key), false, 'the Oath\'s Harbour is not the Hand\'s');
    assert.ok(memberPortsVersion() > v0, 'the count moved');
    // every caller
    assert.equal(isNotAtPort(ANTICLERE.key), false, 'the ship may sail from it');
    assert.equal(isNotAtPort(ASHFIELD.key), true);
    assert.equal(hasNoOceanTravel(0, false, ANTICLERE.key), false, 'a passage to it');
    assert.equal(isDestNotValidPort({ shipTravelDestinationPortsOnly: true }, ANTICLERE.key), false, 'a destination port');
    assert.equal(shipTravelRefusal({ settings: { shipTravelDestinationPortsOnly: true }, currentLocationMapId: ANTICLERE.key, destinationMapId: PORT_LOCATION_IDS[0], oceanPixels: 4 }), null);
    assert.equal(shipTravelRefusal({ settings: {}, currentLocationMapId: ASHFIELD.key, destinationMapId: PORT_LOCATION_IDS[0], oceanPixels: 4 }), 'noport');
    assert.equal(portsFilterAllows(true, ANTICLERE.key), true, 'on the map\'s PORTS filter');
    assert.equal(portsFilterAllows(true, ASHFIELD.key), false);
    const to = createTravelOptions({});
    assert.deepEqual([to.messages.hasPort(ANTICLERE.key), to.messages.hasPort(ASHFIELD.key)], [true, false], 'the mod\'s hasPort for other mods');
    const W = src('src/scenes/world.js');
    const lifted = /\n {2}(const csaIsPortTown = \(x, y\) => \{\n[\s\S]*?\n {2}\};)\n/.exec(W);
    assert.ok(lifted, 'the host\'s port test moved');
    const dict = new Map([[town, { id: town, regionIndex: 21, mapIndex: 0 }], [bare, { id: bare, regionIndex: 21, mapIndex: 1 }]]);
    const maps = { getLocation: () => ({ exterior: { exteriorData: { portTownAndUnknown: 0 } } }) };
    // eslint-disable-next-line no-new-func
    const csaIsPortTown = new Function('mapDict', 'maps', 'travelLocationSummaryAt', 'hasPort', `${lifted[1]}\nreturn csaIsPortTown;`)(dict, maps, (d, x, y) => d.get(y * 1000 + x) ?? null, hasPort);
    assert.deepEqual([csaIsPortTown(300, 120), csaIsPortTown(410, 130)], [true, false], 'a harbour ships dock at - the member\'s town, not the bare one');
    // a stranger: the same list, another guild
    guild = 'g3';
    assert.deepEqual([hasPort(ANTICLERE.key), isNotAtPort(ANTICLERE.key), portsFilterAllows(true, ANTICLERE.key), csaIsPortTown(300, 120)], [false, true, false, false], 'nobody else\'s ports change');
    const v1 = memberPortsVersion();
    guild = 'g1';
    assert.equal(hasPort(ANTICLERE.key), true);
    assert.ok(memberPortsVersion() > v1, 'moved again as they came back');
    const v2 = memberPortsVersion();
    hasPort(ANTICLERE.key);
    assert.equal(memberPortsVersion(), v2, 'unmoved while they stand');
    guild = 'g2';
    assert.deepEqual([hasPort(KIRKBETH.key), hasPort(ANTICLERE.key)], [true, false], 'the Oath\'s member: the Oath\'s harbour');
    assert.ok(memberPortsVersion() > v2, 'moved - one port for another, the count the same');
    guild = 'g1';
    setMemberPorts(() => { throw new Error('host gone'); });
    assert.equal(hasPort(ANTICLERE.key), false, 'a source that throws holds none');
    setMemberPorts(() => book.memberPorts());
    assert.equal(hasPort(ANTICLERE.key), true);
    setMemberPorts(null);
    assert.equal(hasPort(ANTICLERE.key), false, 'offline: the mod\'s 378 alone');
    assert.equal(hasPort(199102), true, 'Daggerfall\'s Whitecroft, the mod\'s own');
  } finally { setMemberPorts(null); }
});

// ─── THE HALLS' QUALITY STEPS ────────────────────────────────────────

test('SEAT2b2 THE HALLS\' STEPS AT A STATION: "The seat\'s Forge: +1 quality step here." - a step a tier of the hall serving the recipe\'s profession, through qualitySteps\' own `station` (its three the most); no line where the guild holds nothing here, for a recipe with no quality, or a hall that serves another craft (mutants: the works; the quality guard; the steps; the hall\'s name; the plural)', () => {
  const sword = recipeById('dagger:iron'), staff = recipeById('staff:pine'), shirt = recipeById('garment-165:linen'), column = recipeById('column:stone');
  assert.equal(hallStepsLine(sword, { forge: 1 }), 'The seat\'s Forge: +1 quality step here.');
  assert.equal(hallStepsLine(sword, { forge: 2, workshop: 2 }), 'The seat\'s Forge: +2 quality steps here.');
  assert.equal(hallStepsLine(staff, { forge: 2, workshop: 1 }), 'The seat\'s Workshop: +1 quality step here.');
  assert.equal(hallStepsLine(shirt, { workshop: 2 }), 'The seat\'s Workshop: +2 quality steps here.');
  assert.equal(hallStepsLine(column, { workshop: 1 }), 'The seat\'s Workshop: +1 quality step here.', 'Masonry is the Workshop\'s');
  assert.equal(hallStepsLine(sword, { workshop: 2 }), null, 'the Workshop serves no smith');
  assert.equal(hallStepsLine(sword, {}), null);
  assert.equal(hallStepsLine(sword, null), null, 'the guild holds nothing here');
  assert.equal(hallStepsLine(recipeById('kit:iron'), { forge: 2 }), null, 'a Repair Kit takes no quality');
  assert.equal(hallStepsLine(recipeById('ramkit:oak'), { workshop: 2 }), null, 'nor a Ram Kit');
  assert.equal(hallStepsLine(sword, { forge: 9 }), 'The seat\'s Forge: +3 quality steps here.', 'qualitySteps holds a station at three');
  assert.equal(hallStepsLine(null, { forge: 1 }), null);
});

test('SEAT2b2 `at` THREADED: the station\'s town kept with the craft and sent to the door; a lost answer replayed with the same `at` and the same id; a record kept before `at` replays none; the door posts it as a seat key or null (mutants: the kept `at`; the replay\'s; its bound; the door\'s)', async () => {
  const asked = [];
  let online = false;
  const door = {
    account: () => 'acct-1',
    craft: async (c, recipe, clean, name, rid, heartwood, dye, at) => { asked.push({ recipe, rid, at }); return online ? { ok: true, data: { recipe, quality: 1, count: 1, seed: 7, pieces: [], stores: [], xp: 20 } } : { ok: false, error: 'offline' }; },
  };
  const storage = memStorage();
  const book = createProfBook({ door, storage, character: () => 'c1', now: () => T0 * 1000, sleep: noWait });
  const r = await book.craft('dagger:iron', { at: ANTICLERE.key }, () => {});
  assert.equal(r.kept, true);
  assert.ok(asked.length >= 1 && asked.every((a) => a.at === ANTICLERE.key), 'asked at the station\'s town');
  const kept = JSON.parse(storage.getItem('prof1.kept'));
  assert.equal(Object.values(kept)[0].crafts[0].at, ANTICLERE.key, 'kept with the craft');
  online = true;
  const n = asked.length;
  await book.settle(() => {}, () => {});
  assert.deepEqual([asked[n].at, asked[n].rid], [ANTICLERE.key, asked[0].rid], 'replayed at the same town, under the same id');
  await book.craft('staff:pine', { at: -4 }, () => {});
  assert.equal(asked.at(-1).at, null, 'no seat key, no town');
  await book.craft('staff:pine', {}, () => {});
  assert.equal(asked.at(-1).at, null);
  // a record kept by a client before part two: replayed with none
  const old = memStorage();
  old.setItem('prof1.kept', JSON.stringify({ 'acct-1|c1': { harvests: [], withdrawals: [], crafts: [{ rid: 'pold', recipe: 'dagger:iron', clean: false, name: null, character: 'c1', heartwood: false, fee: 0 }] } }));
  const later = createProfBook({ door, storage: old, character: () => 'c1', now: () => T0 * 1000, sleep: noWait });
  await later.settle(() => {}, () => {});
  assert.deepEqual([asked.at(-1).rid, asked.at(-1).at], ['pold', null]);
  // the door's body
  const bodies = [];
  const fetch = async (u, init) => { bodies.push(JSON.parse(init.body)); return { ok: true, json: async () => ({ ok: true }) }; };
  const prof = accountProf({ fetch, storage: sessionStorageOf(SESSION_KEY, { secret: 's3cret', id: 'acct-1' }) });
  await prof.craft('c1', 'dagger:iron', false, null, 'r1', false, null, ANTICLERE.key);
  await prof.craft('c1', 'dagger:iron', false, null, 'r2');
  await prof.craft('c1', 'dagger:iron', false, null, 'r3', false, 3, 2 ** 33);
  assert.deepEqual(bodies.map((b) => [b.rid, b.at, b.dye]), [['r1', ANTICLERE.key, undefined], ['r2', null, undefined], ['r3', null, 3]]);
});

/** The Stores page drawn with every station, each the player's own (no fee), the seat's halls `halls()`'s. */
function stationsPage({ halls = () => null, tracks: t = {}, held = {} } = {}) {
  const h = new Map(Object.entries(held));
  const tracks = new Map(Object.entries(t).map(([p, [rank, specs = {}]]) => [p, { profession: p, xp: xpForRank(rank), rank, specs: { 50: null, 100: null, ...specs } }]));
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map([...h].map(([k, n]) => [k, { material: k, own: n, bought: 0 }])), tracks, today: {}, caps: null },
    stale: () => false, refresh: async () => ({ ok: true }), held: (k) => h.get(k) ?? 0, store: (k) => ({ material: k, own: h.get(k) ?? 0, bought: 0 }),
    track: (p) => tracks.get(p) ?? { profession: p, xp: 0, rank: 0, specs: { 50: null, 100: null } }, materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0, choose: async () => ({ ok: true }),
  };
  const home = () => ({ kind: 'home', fee: 0 });
  const crafted = [];
  setProfessionsPages({
    book, name: (k) => materialLabel(k), withdraw: async () => ({ ok: true, text: '' }), forge: home, workbench: home, loom: home, mason: home,
    smelt: async () => ({ ok: true, text: '' }), craft: async (recipe, o) => { crafted.push([recipe, o]); return { ok: true, text: 'made' }; },
    heatBand: () => 1, planeBand: () => 1, stitchBand: () => 1, chiselBand: () => 1, clothing: () => 'MensClothing', halls,
  });
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  draw();
  const buttons = () => [...root.querySelectorAll('button')];
  return {
    draw, crafted, text: () => root.textContent, hall: () => [...root.querySelectorAll('.prof-hall')].map((n) => n.textContent),
    press: (label) => buttons().find((b) => b.textContent.startsWith(label))?.onclick?.(),
    button: (label) => buttons().find((b) => b.textContent.startsWith(label)) ?? null,
    done() { root?.remove?.(); setProfessionsPages(null); resetProfPages(); },
  };
}

test('SEAT2b2 THE STATIONS\' STEP LINES: at the anvil, the workbench, the loom and the mason\'s bench a line under the craft\'s odds where the player\'s guild holds the town\'s seat and its hall serves the craft - "The seat\'s Forge: +1 quality step here." - and none anywhere else (mutants: each station\'s line; the provider\'s halls)', () => {
  setPref('gentleActs', false);
  resetProfPages();
  let works = { forge: 1, workshop: 2 };
  const page = stationsPage({ halls: () => works, tracks: { smithing: [0], carpentry: [0], outfitting: [0], masonry: [100, { 100: 'sculptor' }] } });
  try {
    page.press('Iron Dagger');
    page.press('Pine Staff');
    page.press('Clothing'); page.press('Men\'s'); page.press('Linen');
    page.press('Linen Short Shirt');
    page.press('Stone Column');
    page.draw();
    assert.deepEqual(page.hall(), ['The seat\'s Forge: +1 quality step here.', 'The seat\'s Workshop: +2 quality steps here.', 'The seat\'s Workshop: +2 quality steps here.', 'The seat\'s Workshop: +2 quality steps here.'],
      'the anvil\'s, the workbench\'s, the loom\'s and the mason\'s bench\'s');
    works = { forge: 1 };
    page.draw();
    assert.deepEqual(page.hall(), ['The seat\'s Forge: +1 quality step here.'], 'a seat with a Forge alone serves the anvil alone');
    works = null;
    page.draw();
    assert.deepEqual(page.hall(), [], 'the guild holds nothing in this town: no line');
  } finally { page.done(); }
});

// ─── THE RAM KIT ─────────────────────────────────────────────────────

test('SEAT2b2 THE RAM KIT ON THE WORKBENCH AND IN THE STORES: listed at Carpentry 60 with no word of the sieges to come, crafted through the real Worker into the Stores - the answer\'s record null, no piece minted, the craft said into the Stores - its kept record let go and its Stores row taken; the Stores page names it "Ram Kit" in the Siege Works and never offers to withdraw it (mutants: the bench\'s words; the page\'s works arm; the label; the craft\'s word)', async (t) => {
  const NOON = utcDay(T0) * 86_400 + 12 * 3600;
  t.mock.method(Date, 'now', () => NOON * 1000);
  setPref('gentleActs', false);
  resetProfPages();
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const mac = await s.registered('Mac');
  const give = (m, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, 'own', ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(mac.id, mac.character, m, qty);
  raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, updated_at) VALUES (?, ?, 'carpentry', ?, ?)`).run(mac.id, mac.character, xpForRank(RAM_KIT_RANK), NOON);
  for (const inp of recipeById('ramkit:oak').inputs) give(inp.key, inp.n);
  const prof = accountProf({ fetch: s.fetch, storage: sessionStorageOf(SESSION_KEY, mac) });
  const storage = memStorage();
  const book = createProfBook({ door: prof, storage, character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
  assert.equal((await book.refresh()).ok, true);
  const minted = [];
  const said = [];
  setProfessionsPages({
    book, name: (k) => materialLabel(k), withdraw: async () => ({ ok: true, text: 'withdrawn' }), forge: () => null,
    workbench: () => ({ kind: 'home', fee: 0 }), smelt: async () => ({ ok: true, text: '' }), planeBand: () => 1,
    craft: async (recipe, o) => {
      const r = await book.craft(recipe, { ...o, name: 'Mac', at: ANTICLERE.key }, (data) => { minted.push(...mintPieces(data)); const w = storedWorkText(data); if (w) said.push(w); });
      return { ok: r.ok, text: r.ok ? `${storedWorkText(r.data) ?? 'made'} (+${r.data.xp} Carpentry XP).` : accountRefusalText(r.error) };
    },
  });
  let root = null;
  const draw = () => { root?.remove?.(); root = el('div'); document.body.append(root); drawStoresPage(root, draw, kit); };
  const buttons = () => [...root.querySelectorAll('button')];
  const press = (label) => buttons().find((b) => b.textContent.startsWith(label))?.onclick?.();
  try {
    draw();
    buttons().find((b) => b.textContent === 'Siege').onclick();   // the workbench's family, not the Stores' Siege Works
    const row = buttons().find((b) => b.textContent.startsWith('Ram Kit'));
    assert.ok(row, 'the workbench lists the Ram Kit');
    assert.equal(row.textContent, 'Ram Kitcan make now', 'open at Carpentry 60 - no word of the sieges');
    assert.doesNotMatch(root.textContent, /sieges come|Comes with the sieges/);
    row.onclick();
    assert.ok(root.textContent.includes(RAM_KIT_BENCH_LINE), 'it says where it goes');
    assert.equal(RAM_KIT_BENCH_LINE, 'A Ram Kit goes into your Stores, never your pack - a siege work, delivered to a Siege Camp by a seat writ at a Notice Board\'s Work tab.');
    const quick = buttons().find((b) => b.textContent === 'Quick craft');
    assert.equal(quick.disabled, false, 'its inputs held');
    await quick.onclick();
    for (let i = 0; i < 40 && !said.length; i++) await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(minted, [], 'no piece minted: the answer\'s record is null');
    assert.deepEqual(said, ['You made a Ram Kit - it waits in your Stores for a Siege Camp\'s writ']);
    assert.equal(book.held(RAM_KIT_KEY), 1, 'its Stores row taken from the answer');
    assert.equal(book.pendingCrafts, 0, 'the kept record let go');
    assert.equal(raw.prepare('SELECT qty FROM prof_stores WHERE player = ? AND material = ?').get(mac.id, RAM_KIT_KEY).qty, 1, 'the Worker put it in the Stores');
    // THE REPLAY: a second kit whose answer is lost - kept, then settled through the real Worker: the same answer taken
    for (const inp of recipeById('ramkit:oak').inputs) give(inp.key, inp.n);
    let lost = true;
    const flaky = { ...prof, craft: (...a) => (lost ? Promise.resolve({ ok: false, error: 'offline' }) : prof.craft(...a)) };
    const kept = createProfBook({ door: flaky, storage, character: () => mac.character, now: () => NOON * 1000, sleep: noWait });
    assert.equal((await kept.refresh()).ok, true);
    const replayMinted = [], replaySaid = [];
    const mint = (data) => { replayMinted.push(...mintPieces(data)); const w = storedWorkText(data); if (w) replaySaid.push(w); };
    assert.equal((await kept.craft('ramkit:oak', { name: 'Mac', at: ANTICLERE.key }, mint)).kept, true, 'kept - no answer');
    assert.equal(kept.pendingCrafts, 1);
    lost = false;
    await kept.settle(() => {}, mint);
    assert.deepEqual([replayMinted, replaySaid, kept.pendingCrafts, kept.held(RAM_KIT_KEY)], [[], ['You made a Ram Kit - it waits in your Stores for a Siege Camp\'s writ'], 0, 2], 'the replay takes the same answer: no piece, the word, the kit\'s row');
    // THE STORES PAGE: "Ram Kit" in the Siege Works, never offered to the pack
    draw();
    press('Siege Works');
    const card = buttons().find((b) => b.className.includes('prof-mat') && b.textContent.startsWith('Ram Kit'));
    assert.ok(card, 'listed by its name in the Siege Works');
    card.onclick();
    assert.ok(root.textContent.includes('Ram Kit x1 - tier 5 - 108 Drakes each'));
    assert.ok(root.textContent.includes(RAM_KIT_STAYS_LINE));
    assert.equal(buttons().some((b) => /Withdraw to pack/.test(b.textContent)), false, 'never offered to withdraw');
    assert.equal([...root.querySelectorAll('.prof-qty')].length, 0, 'no quantity to withdraw');
    // a material of the pack still offers it
    assert.deepEqual([materialLabel(RAM_KIT_KEY), materialCountLabel(RAM_KIT_KEY, 3), mintMaterialItem(RAM_KIT_KEY)], ['Ram Kit', 'Ram Kits', null]);
    assert.equal(storedWorkText({ recipe: 'ramkit:oak', count: 2 }), 'You made 2 Ram Kits - it waits in your Stores for a Siege Camp\'s writ');
    assert.equal(storedWorkText({ recipe: 'dagger:iron', count: 1 }), null, 'a piece\'s craft says its piece');
  } finally { root?.remove?.(); setProfessionsPages(null); resetProfPages(); }
});

test('SEAT2b2 THE RAM KIT ON A WRIT: a Siege Camp\'s writ may ask Ram Kits (fortLaw.js campGoodOk) - offered in the Work tab\'s "For" a camp, never for a held seat\'s stockpile nor the guild Stores; posted with its seat (mutants: the camp\'s goods; the stockpile\'s; the kit\'s row)', async () => {
  const { createWorkTab } = await import('../src/ui/workTab.js');
  const posted = [];
  const w = { writs: { state: { workDrafts: null }, post: async (req) => { posted.push(req); return { ok: true }; } }, held: () => 0, region: 21, regionName: 'Anticlere', regionNameOf: () => 'Elsewhere', countName: (k, n) => materialCountLabel(k, n), pieces: () => [], reload() {} };
  const ui = { busy: () => false, run: async (f) => { await f(); }, rerender() {}, nowS: () => T0 };
  const tab = createWorkTab(w, ui);
  tab._state.form = 'writ';
  const data = {
    writs: [], today: { filled: 0, max: 3 }, commissions: [], balance: 0, writsOpen: true, me: 'Me', guildWrits: [], yours: { commissions: [], guildWrits: [] },
    guild: { id: 'g1', name: 'The Silver Hand', tag: 'SH', rank: 0, mayPost: true, marks: 100_000, budget: 0, spent: 0, left: 0, seats: [{ key: ANTICLERE.key, name: 'Anticlere', camp: false }, { key: ASHFIELD.key, name: 'Ashfield', camp: true }] },
  };
  const find = (root, label) => root.querySelectorAll('*').find((n) => n.getAttribute?.('aria-label') === label);
  const choose = (v) => { const where = find(tab.node(data), "Where the writ's units go"); where.value = v; where.onchange(); return find(tab.node(data), 'The material the writ asks').children.map((o) => [o.value, o.textContent]); };
  const stores = choose('');
  assert.equal(stores.some(([k]) => k === RAM_KIT_KEY), false, 'the guild Stores: no Ram Kit (the market\'s catalogue)');
  const stock = choose(String(ANTICLERE.key));
  assert.deepEqual(stock.map(([k]) => k).sort(), [...FORT_MATERIALS].sort(), 'a held seat\'s stockpile: the works\' materials alone');
  const camp = choose(String(ASHFIELD.key));
  assert.deepEqual(camp.map(([k]) => k).sort(), [...FORT_MATERIALS, RAM_KIT_KEY].sort(), 'a Siege Camp: the works\' materials and the Ram Kit');
  assert.deepEqual(camp.at(-1), [RAM_KIT_KEY, 'Ram Kits'], 'named, and after them');
  const mat = find(tab.node(data), 'The material the writ asks');
  mat.value = RAM_KIT_KEY; mat.onchange();
  const node = tab.node(data);
  node.querySelectorAll('*').find((n) => n.className?.includes?.('work-post')).click();
  await settle();
  assert.deepEqual([posted.at(-1).material, posted.at(-1).seat], [RAM_KIT_KEY, ASHFIELD.key]);
});

// ─── THE SIEGEWRIGHT ─────────────────────────────────────────────────

test('SEAT2b2 THE SIEGEWRIGHT\'S CARD: chosen at Carpentry 100 like any card - unlocked, no word of the sieges to come - and pressed it asks the choice (mutants: the card\'s lock; its words)', async () => {
  resetProfPages();
  const tracks = new Map([['carpentry', { profession: 'carpentry', xp: xpForRank(100), rank: 100, specs: { 50: 'joiner', 100: null } }]]);
  const chosen = [];
  const book = {
    state: { open: true, day: 1, character: 'c', account: 'a', readAt: Date.now(), stores: new Map(), tracks, today: {}, caps: null }, stale: () => false, refresh: async () => ({ ok: true }),
    held: () => 0, track: (p) => tracks.get(p) ?? { profession: p, xp: 0, rank: 0, specs: { 50: null, 100: null } }, materials: () => [], pendingWithdrawals: 0, pendingCrafts: 0,
    choose: async (p, r, s) => { chosen.push([p, r, s]); return { ok: true }; },
  };
  setProfessionsPages({ book, name: (k) => k, withdraw: async () => ({ ok: true, text: '' }) });
  let root = el('div'); document.body.append(root);
  try {
    drawProfessionsPage(root, () => {}, kit);
    [...root.querySelectorAll('button')].find((b) => b.textContent.startsWith('Carpentry')).onclick();
    root.remove(); root = el('div'); document.body.append(root);
    drawProfessionsPage(root, () => {}, kit);
    const card = [...root.querySelectorAll('button')].find((b) => b.className.includes('prof-spec') && b.textContent.startsWith('Siegewright'));
    assert.ok(card);
    assert.equal(card.disabled, false, 'chosen at 100');
    assert.doesNotMatch(card.textContent, /Comes with/);
    assert.match(card.textContent, /Rams \+50% vitality; siege works a day sooner\./);
    await card.onclick();
    assert.deepEqual(chosen, [['carpentry', 100, 'siegewright']]);
    assert.equal(accountRefusalText('prof-later'), 'That is not made in the Bay yet.', 'no refusal word waits on the sieges');
  } finally { root.remove(); setProfessionsPages(null); }
});

// ─── THE WIRING (the four hosts) ─────────────────────────────────────

test('SEAT2b2 THE WIRING: world.js keeps the coast before the dilation and hands the Seat tab `coastal`; the seats\' book its guild, its names and its chat; the member ports\' source; the naval reads keyed on them; the craft\'s `at` the station\'s town, a siege work\'s word, the halls\' works; worldModes.js names the stations\' town; the fixed city and the dungeons hold none of it (mutants: each seam)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /\n {2}const seatCoastal = coastOf\(maps\);\n {2}const dilated = dilateCoastalClimate\(maps, 2\);\n/, 'kept BEFORE the dilation');
  assert.match(w, /nameOf: \(k\) => seatAtMapId\(townSeats, k\)\?\.name \?\? null, coastal: seatCoastal\(town\.px, town\.py\), countName: materialCountLabel \} : null,/);
  assert.doesNotMatch(w, /port: csaIsPortTown\(town\.px, town\.py\)/, 'DFU\'s port flag gone from the Seat tab');
  assert.match(w, /guildId: \(\) => guildBook\?\.guild\?\.id \?\? null, nameOf: \(k\) => seatAtMapId\(townSeats, k\)\?\.name \?\? null,\n/);
  assert.match(w, /onWord: \(line\) => \{ if \(!redChat \|\| !chatLog\) return false; chatLog\.pushAll\(\{ text: line\.text, at: line\.at \}\); return true; \},/);
  assert.match(w, /\n {2}setMemberPorts\(seatBook \? \(\) => seatBook\.memberPorts\(\) : null\);\n/);
  assert.equal((w.match(/const key = `\$\{p\.x\},\$\{p\.y\},\$\{memberPortsVersion\(\)\}`;/g) ?? []).length, 2, 'navalNearPort and navalHarbourNear ask again as the member ports move');
  assert.match(w, /name: typeof playerEntity\?\.name === 'string' \? playerEntity\.name : null, at: modes\?\.stationTown\?\.\(\) \?\? null \}, profMintCraft\);/);
  assert.match(w, /text: `\$\{storedWorkText\(r\.data\) \?\? craftedText\(mintPieces\(r\.data\)\)\} \(\+\$\{r\.data\.xp\} \$\{st\.xp\} XP\)/);
  assert.match(w, /\n {4}else if \(storedWorkText\(data\)\) townTalk\.say\(`\$\{storedWorkText\(data\)\}\.`\);/);
  assert.match(w, /halls: \(\) => seatBook\?\.memberWorks\(seatHere\(modes\?\.stationTown\?\.\(\) \?\? null\)\) \?\? null,/);
  assert.match(w, /if \(hasPort\(summary\.id\)\) return true;/, 'the host\'s harbour asks HasPort - the member ports with it');
  const m = src('src/scenes/worldModes.js');
  assert.match(m, /stationTown\(\) \{\n\s*if \(mode !== 'interior' \|\| !interiorBuilding\) return null;\n\s*return \(homeTownOf\(interiorBuilding\) >>> 0\) \|\| null;\n\s*\},/);
  const held = src('src/ui/heldMap.js');
  assert.match(held, /const ports = memberPortsVersion\(\);\n\s*if \(this\._portsVersion !== ports\) \{ this\._portsVersion = ports; this\._marksDirty = true; \}/, 'the held map\'s marks made again');
  assert.match(held, /isPort: \(s\) => hasPort\(s\?\.mapID \?\? s\?\.mapId\),/);
  assert.match(src('src/systems/travelOptions.js'), /hasPort: \(mapId\) => hasPort\(mapId\),/);
  // the four hosts: the fixed city (a development host) and the dungeons hold no professions, no seats and no stations
  const x = src('src/scenes/exterior.js');
  assert.doesNotMatch(x, /createTownSeatBook|setProfessionsPages|setMemberPorts|stationTown/);
  const dc = src('src/scenes/dungeonContext.js');
  assert.doesNotMatch(dc, /forgeHere|workbenchHere|loomHere|masonHere|stationTown|setMemberPorts/);
});
