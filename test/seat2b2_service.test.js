// SEAT2b part two (2026-10-01, Mac: "I want to finish the inprogress"): THE WORKS' EFFECTS AND A SEAT'S REVOLT AS THE
// SERVICE KEEPS THEM - the Shrine's Standing and its gates' influence, the Watchtowers' word, a revolt called at the
// Turning in the holder's window, fought (put down: Standing 20; lost: the Charter lapses) or left unanswered (lapsed at
// its Turning), a battle's works frozen on its pass (the Walls, the Gatehouse, the Barracks' guards, the Rams, a
// Siegewright's), the Siegewright's project a day sooner, the halls' quality steps, the Ram Kit to a Siege Camp, the
// list's works and a coastal Harbour (bible/11-Multiplayer/Seats-Arc.md 6.2, 7.3, 7.5, 7.7; server-account/src/
// seatTurning.js, seatInfluence.js, seatSiege.js, seatBattles.js, seatForts.js, professions.js, writs.js). Driven through
// the real Worker over node:sqlite with every migration applied (test/accountDb.mjs). `06-Systems/Online-Arc.md` SEAT2b
// (part two).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from './accountDb.mjs';
import { seatReportText, seatWeekOf, seatWeekStartMs, siegeStartMs, SEAT_MEMBER_WAIT_S, turningPlan, seasonEndingAt } from '../src/net/townSeatLaw.js';
import { verifyOrder } from '../src/net/identityToken.js';
import { mintSiegeReceipt } from '../src/net/siegeReceipt.js';
import { SIEGE_UNITS_PER_M } from '../src/net/siegeRef.js';
import { gameDayAt, gateTimes } from '../src/net/gateLaw.js';
import { xpForRank, STORES_MAX } from '../src/net/professionLaw.js';

const { subtle } = globalThis.crypto;
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
const AFTER = (w) => turning(w) + 3 * 3600;
const S = (ms) => Math.floor(ms / 1000);
const START = S(siegeStartMs(W + 1, 0, 20));   // Wednesday 20:00 - the default window
const PF = [[0, 40], [40, 0], [-40, 0], [0, -40], [0, 80], [0, -60]].map(([x, z]) => [x * SIEGE_UNITS_PER_M, z * SIEGE_UNITS_PER_M]);
const CF = [...PF, [0, 120 * SIEGE_UNITS_PER_M]];
let _rid = 0;
const rid = () => `s2b2-${String(++_rid).padStart(6, '0')}`;
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
/** The service's dice steered (professions.js dice - every four-byte draw all `b`), the ids the CSPRNG's - PROF3's way. */
async function steered(b, fn) {
  globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(b), arr) : realRandom(arr));
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = realRandom; }
}

async function stood(t, extra = {}) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on', ...extra });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [ANTICLERE, WAYREST]) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const guild = async (handle, name, tag) => {
    const gm = await svc.registered(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    return { gm, gid };
  };
  const member = async (g, handle, { rank = 2, bound = true } = {}) => {
    const m = await svc.registered(handle, { renown: 5 });
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(m.id, m.character, g.gid, rank, handle, T0 - 30 * DAY);
    if (bound) raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(W, m.id, g.gid, m.character, T0);
    return m;
  };
  const treasury = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-${gid}-${n}-${Math.random().toString(36).slice(2, 10)}`);
  const hold = (seat, gid, { standing = 50, tithe = 6, since = W - 2 } = {}) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 0)`).run(seat.key, gid, seat.region, seat.tier, since, standing, T0 - 14 * DAY, tithe);
  const works = (seat, gid, tiers) => { for (const [work, tier] of Object.entries(tiers)) raw.prepare(`INSERT INTO town_seat_forts (key, work, tier, building, guild_id, builder, stands_at, at)
    VALUES (?, ?, ?, NULL, ?, 0, NULL, ?) ON CONFLICT (key, work) DO UPDATE SET tier = excluded.tier`).run(seat.key, work, tier, gid, T0); };
  const earn = async (gid, seat, amount, week = W) => {
    while (amount > 0) {
      const a = await svc.guest();
      const n = Math.min(2000, amount);
      raw.prepare('INSERT INTO town_seat_binds (week, account, guild_id, char_id, at) VALUES (?, ?, ?, ?, ?)').run(week, a.id, gid, 'c', T0);
      raw.prepare(`INSERT INTO town_seat_influence (week, key, guild_id, account, char_id, source, amount, region, day, ref, at)
        VALUES (?, ?, ?, ?, 'c', 'watch', ?, ?, 1, ?, ?)`).run(week, seat.key, gid, a.id, n, seat.region, `t:${a.id}:${week}:${seat.key}`, now);
      amount -= n;
    }
  };
  const pledge = (gid, seat, week = W) => raw.prepare('INSERT INTO town_seat_pledges (week, guild_id, region, key, set_by, at) VALUES (?, ?, ?, ?, ?, ?)').run(week, gid, seat.region, seat.key, 'x', T0);
  const call = async (path, body, who) => svc.call(path, body, who.secret);
  const holdOf = (key) => { const h = raw.prepare('SELECT guild_id, standing FROM town_seat_holds WHERE key = ?').get(key); return h ? { ...h } : null; };
  const battle = (key, week = W + 1) => { const b = raw.prepare('SELECT * FROM town_seat_battles WHERE week = ? AND key = ?').get(week, key); return b ? { ...b } : null; };
  const chronicle = (key) => raw.prepare('SELECT kind, week, data FROM town_seat_history WHERE key = ? ORDER BY seq').all(key).map((r) => ({ kind: r.kind, week: r.week, data: JSON.parse(r.data) }));
  const kinds = (key) => chronicle(key).map((r) => r.kind);
  const give = (who, m, qty, origin = 'own') => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const setXp = (who, xp, prof, { spec50 = null, spec100 = null } = {}) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`).run(who.id, who.character, prof, xp, spec50, spec100, T0);
  /** `n` gate days of `week` risen before `untilS` (past the first `skip` of them), three claims agreeing each in `region`. */
  const gates = async (region, n, untilS, { week = W, skip = 0 } = {}) => {
    const start = seatWeekStartMs(week), days = [];
    let seen = 0;
    for (let d = gameDayAt(start); days.length < n; d++) if (gateTimes(d).riseAt >= start && gateTimes(d).riseAt < untilS * 1000 && seen++ >= skip) days.push(d);
    const claimers = [await svc.guest(), await svc.guest(), await svc.guest()];
    for (const d of days) for (const c of claimers) raw.prepare("INSERT INTO gate_kills (day, account, boss, earned, at, region) VALUES (?, ?, 'ruhn', 'x', ?, ?)").run(d, c.id, T0, region);
    return days;
  };
  return { svc, raw, guild, member, treasury, hold, works, earn, pledge, call, holdOf, battle, chronicle, kinds, give, setXp, gates, at: (s) => { now = s; }, now: () => now };
}
const receipt = (svc, who, key, week, o, nowS) => mintSiegeReceipt({ s: who.id, sk: key, sw: week, sd: 'defend', r: 'defend', a: 0, h: 1, th: 0, ...o }, svc.gateKey, { subtle, nowS });

test('SEAT2b2 THE SHRINE: a held seat\'s Standing a point a week a tier at the Turning (its own row), and each gate felled in its region a tier\'s fifty influence to the holder - in its total and its defence, never its Tribute room; none without a Shrine (mutants: the row; the tier; the gate share; the holder alone; the region)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const ic = await s.guild('Ilse', 'Iron Circle', 'IC');
  s.hold(ANTICLERE, sh.gid);
  s.works(ANTICLERE, sh.gid, { shrine: 2 });
  s.treasury(sh.gid, 10000);
  await s.earn(sh.gid, ANTICLERE, 1000);
  s.pledge(ic.gid, ANTICLERE); await s.earn(ic.gid, ANTICLERE, 1500);   // a challenger ahead of the holder: the Shrine is the holder's alone
  const before = turning(W) - 3600;
  await s.gates(21, 2, before);
  await s.gates(22, 1, before, { skip: 2 });   // another region's gate day: not this Shrine's
  s.at(before);
  const read = async () => (await s.call('/v1/seats/standings', { key: ANTICLERE.key }, sh.gm)).body;
  const st = await read();
  const own = st.standings.find((x) => x.holder);
  assert.equal(own.influence, 1000 + 2 * 50 * 2, 'two gates in the region, fifty a tier each');
  assert.equal(st.standings.find((x) => x.guild.tag === 'IC').influence, 1500, 'the challenger\'s week its own');
  s.at(AFTER(W));
  await s.call('/v1/seats/list', {}, sh.gm);   // the Turning
  // 50 + 5 unchallenged + 2 x 2 gates (the gate row) + 2 the Shrine (its own Watch kept - the week's rows are the Watch's)
  assert.equal(s.holdOf(ANTICLERE.key).standing, 61);
  const changes = s.chronicle(ANTICLERE.key).filter((r) => r.kind === 'held');
  assert.equal(changes.length, 1);
  // the same week with no Shrine: no row, no influence
  const s2 = await stood(t);
  const eo = await s2.guild('Horst', 'Ebon Oath', 'EO');
  s2.hold(ANTICLERE, eo.gid);
  s2.treasury(eo.gid, 10000);
  await s2.earn(eo.gid, ANTICLERE, 1000);
  await s2.gates(21, 2, before);
  s2.at(before);
  assert.equal((await s2.call('/v1/seats/standings', { key: ANTICLERE.key }, eo.gm)).body.standings.find((x) => x.holder).influence, 1000);
  s2.at(AFTER(W));
  await s2.call('/v1/seats/list', {}, eo.gm);
  assert.equal(s2.holdOf(ANTICLERE.key).standing, 59);
  // the plan's row itself (the law the Turning reads)
  const plan = turningPlan({ week: W, seats: [{ key: 1, tier: 'palace', holder: { guild: 'g', standing: 50, tithe: 6, watched: true, shrine: 1 }, guilds: [] }], treasuries: new Map([['g', 99999]]) });
  assert.deepEqual(plan.standings[0].changes.find(([row]) => row === 'shrine'), ['shrine', 1]);
});

test('SEAT2b2 THE WATCHTOWERS\' WORD: the list tells the holder\'s member, by its character, of each challenger past half the defence (tier 1) or a quarter (tier 2) - strictly - and the board\'s holding says it; nothing for a stranger, nothing without a character, nothing where no towers stand (mutants: the share; strictness; the holder\'s guild; the character)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  const ic = await s.guild('Ilse', 'Iron Circle', 'IC');
  s.hold(ANTICLERE, sh.gid);
  s.works(ANTICLERE, sh.gid, { watchtowers: 1 });
  await s.earn(sh.gid, ANTICLERE, 1000);   // Standing 50: the defence is its week, 1,000
  s.pledge(eo.gid, ANTICLERE); await s.earn(eo.gid, ANTICLERE, 501);
  s.pledge(ic.gid, ANTICLERE); await s.earn(ic.gid, ANTICLERE, 500);   // exactly half: not past it
  const mem = await s.member(sh, 'Mira');
  const list = async (who, body) => (await s.call('/v1/seats/list', body, who)).body;
  assert.deepEqual((await list(mem, { character: mem.character })).watch, [{ key: ANTICLERE.key, guild: { name: 'Ebon Oath', tag: 'EO' }, share: 0.5 }]);
  assert.equal('watch' in (await list(mem, {})), false, 'no character, no word');
  assert.deepEqual((await list(eo.gm, { character: eo.gm.character })).watch, [], 'a challenger hears nothing of it');
  const board = (await s.call('/v1/seats/standings', { key: ANTICLERE.key, character: mem.character }, mem)).body;
  assert.deepEqual(board.holding.watch, [{ guild: { name: 'Ebon Oath', tag: 'EO' }, share: 0.5 }]);
  s.works(ANTICLERE, sh.gid, { watchtowers: 2 });   // a quarter: both past it
  assert.deepEqual((await list(mem, { character: mem.character })).watch.map((w) => [w.guild.tag, w.share]), [['EO', 0.25], ['IC', 0.25]]);
  s.works(ANTICLERE, sh.gid, { watchtowers: 0 });
  assert.deepEqual((await list(mem, { character: mem.character })).watch, []);
});

test('SEAT2b2 A REVOLT CALLED: a held seat the Turning writes at Standing nought revolts in its holder\'s window - two hours, no attacker, the Chronicle\'s "rose against" - on the seats\' list as `revolt`; not where a Right is granted there (the siege stands in its place) (mutants: the due; the window; the kind; the Right\'s precedence; the list)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid, { standing: 3, tithe: 10 });   // 3 + 5 unchallenged - 3 the Tithe high - 5 no Watch: 0
  s.treasury(sh.gid, 10000);
  s.raw.prepare('INSERT INTO town_seat_windows (key, guild_id, day, hour, set_by, at) VALUES (?, ?, 1, 21, ?, ?)').run(ANTICLERE.key, sh.gid, sh.gm.id, T0);   // Thursday 21:00
  const THURSDAY = S(siegeStartMs(W + 1, 1, 21));
  s.at(AFTER(W));
  const r = (await s.call('/v1/seats/list', {}, sh.gm)).body;
  assert.equal(s.holdOf(ANTICLERE.key).standing, 0);
  const b = s.battle(ANTICLERE.key);
  assert.deepEqual([b.kind, b.attacker, b.defender, b.starts_at, b.ends_at, b.state], ['revolt', null, sh.gid, THURSDAY, THURSDAY + 7200, 'scheduled'], 'the holder\'s own window');
  assert.ok(s.kinds(ANTICLERE.key).includes('revolt'));
  const seat = r.seats.find((x) => x.key === ANTICLERE.key);
  assert.deepEqual([seat.battle.kind, seat.battle.guild, seat.battle.against.tag, seat.battle.startsAt], ['revolt', null, 'SH', THURSDAY]);
  // a strong challenger at a seat in revolt: its Right of Siege, and no revolt
  const s2 = await stood(t);
  const sh2 = await s2.guild('Gamal', 'The Silver Hand', 'SH');
  const eo2 = await s2.guild('Horst', 'Ebon Oath', 'EO');
  s2.hold(ANTICLERE, sh2.gid, { standing: 3, tithe: 10 });
  s2.treasury(sh2.gid, 10000);
  s2.pledge(eo2.gid, ANTICLERE); await s2.earn(eo2.gid, ANTICLERE, 7000);
  s2.at(AFTER(W));
  await s2.call('/v1/seats/list', {}, sh2.gm);
  assert.equal(s2.battle(ANTICLERE.key).kind, 'siege');
  assert.equal(s2.kinds(ANTICLERE.key).includes('revolt'), false);
  // a Season's end writes the Standing halfway back toward 50 first - no revolt (the plan's law)
  const seats = [{ key: 1, tier: 'palace', holder: { guild: 'g', standing: 3, tithe: 10, watched: false }, guilds: [] }];
  assert.deepEqual(turningPlan({ week: W, seats, treasuries: new Map([['g', 99999]]) }).revolts, [{ key: 1, guild: 'g' }]);
  assert.deepEqual(turningPlan({ week: W, seats, treasuries: new Map([['g', 99999]]), seasonEnds: true }).revolts, []);
});

test('SEAT2b2 A REVOLT FOUGHT: the holder\'s member of seven days signs (no Right\'s week asked), no outsider; its pass the holder\'s side, `sn` revolt, its works the Walls alone; the Captain felled (`defend`) - Standing 20, "the Charter held", no Honours; the window run out (`attack`) - the Charter lapses, its coming Edict void (mutants: the sign rule; the pass\'s kind and works; Standing 20; the lapse; no Honours)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid, { standing: 3, tithe: 10 });
  s.works(ANTICLERE, sh.gid, { walls: 2, barracks: 3 });
  s.treasury(sh.gid, 10000);
  const d1 = await s.member(sh, 'Dorran', { bound: false });   // bound to nobody last week
  const out = await s.member(eo, 'Arden');
  s.at(AFTER(W));
  await s.call('/v1/seats/list', {}, sh.gm);
  const fight = (await s.call('/v1/seats/standings', { key: ANTICLERE.key, character: d1.character }, d1)).body.fight;
  assert.deepEqual([fight.kind, fight.attackerGuild, fight.defenderGuild.tag, fight.mine.side], ['revolt', null, 'SH', 'defend'], 'the board\'s view: no attacking guild');
  assert.equal((await s.call('/v1/seats/siege/sign', { character: d1.character, key: ANTICLERE.key }, d1)).body.side, 'defend');
  assert.equal((await s.call('/v1/seats/siege/sign', { character: out.character, key: ANTICLERE.key }, out)).body.error, 'battle-not-side');
  s.at(START - 300);
  const p = await s.call('/v1/seats/siege/pass', { key: ANTICLERE.key, field: PF }, d1);
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.deepEqual([p.body.side, p.body.kind, p.body.works], ['defend', 'revolt', [2, 0, 0, 0, 0]]);
  const v = await verifyOrder(p.body.pass, s.svc.identityPublic, { subtle, nowS: START - 300, kind: 'siege' });
  assert.deepEqual([v.ok, v.claims.sn, v.claims.sd, v.claims.sx], [true, 'revolt', 'defend', [2, 0, 0, 0, 0]]);
  s.at(START + 1800);
  const c = await s.call('/v1/seats/siege/claim', { receipt: await receipt(s.svc, d1, ANTICLERE.key, W + 1, { r: 'defend' }, START + 1800), character: d1.character }, d1);
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.deepEqual([c.body.result, c.body.honours], ['defend', null]);
  assert.deepEqual(s.holdOf(ANTICLERE.key), { guild_id: sh.gid, standing: 20 });
  assert.equal(s.battle(ANTICLERE.key).state, 'fought');
  assert.ok(s.kinds(ANTICLERE.key).includes('revolt-down'));
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'siege-honours'").get().n, 0);
  // the other ending: the window run out with the Captain standing
  const s2 = await stood(t);
  const sh2 = await s2.guild('Gamal', 'The Silver Hand', 'SH');
  s2.hold(ANTICLERE, sh2.gid, { standing: 3, tithe: 10 });
  s2.treasury(sh2.gid, 10000);
  const e1 = await s2.member(sh2, 'Elke');
  s2.at(AFTER(W));
  await s2.call('/v1/seats/list', {}, sh2.gm);
  assert.equal((await s2.call('/v1/seats/siege/sign', { character: e1.character, key: ANTICLERE.key }, e1)).status, 200);
  s2.raw.prepare("INSERT INTO town_seat_edicts (key, week, edict, guild_id, set_by, at) VALUES (?, ?, 'market-day', ?, ?, ?)").run(ANTICLERE.key, W + 2, sh2.gid, sh2.gm.id, AFTER(W));
  s2.at(START + 7200);
  const c2 = await s2.call('/v1/seats/siege/claim', { receipt: await receipt(s2.svc, e1, ANTICLERE.key, W + 1, { r: 'attack' }, START + 7200), character: e1.character }, e1);
  assert.equal(c2.status, 200, JSON.stringify(c2.body));
  assert.equal(s2.holdOf(ANTICLERE.key), null, 'the Charter lapsed');
  assert.equal(s2.raw.prepare('SELECT state FROM town_seat_edicts WHERE key = ? AND week = ?').get(ANTICLERE.key, W + 2).state, 'void');
  assert.ok(s2.kinds(ANTICLERE.key).includes('revolt-lapsed'));
});

test('SEAT2b2 A REVOLT UNANSWERED: no result by its week\'s Turning - the rebels held the palace door: the Charter lapses there (no upkeep, no Standing, no new revolt), the battle void with no siege\'s void line, the seat unheld from the next week - never claimed at that Turning (mutants: the lapse; the void; its Chronicle; the claim)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid, { standing: 3, tithe: 10 });
  s.treasury(sh.gid, 10000);
  s.treasury(eo.gid, 20000);
  s.at(AFTER(W));
  await s.call('/v1/seats/list', {}, sh.gm);
  assert.equal(s.battle(ANTICLERE.key).kind, 'revolt');
  const paidBefore = s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'seat-upkeep'").get().n;
  // the week of the revolt: a challenger pledges hard; nobody answers the rising
  s.pledge(eo.gid, ANTICLERE, W + 1); await s.earn(eo.gid, ANTICLERE, 9000, W + 1);
  s.at(AFTER(W + 1));
  await s.call('/v1/seats/list', {}, sh.gm);
  assert.equal(s.holdOf(ANTICLERE.key), null, 'lapsed');
  assert.equal(s.battle(ANTICLERE.key).state, 'void');
  const k = s.kinds(ANTICLERE.key);
  assert.ok(k.includes('revolt-lapsed'));
  assert.equal(k.includes('siege-void'), false);
  assert.equal(k.filter((x) => x === 'revolt').length, 1, 'no second revolt at a Charter that lapsed');
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM marks_ledger WHERE kind = 'seat-upkeep'").get().n, paidBefore, 'no upkeep for the week the rebels held');
  assert.equal(k.includes('claim'), false, 'unheld from the next week - claimed at none before it');
  assert.equal(s.battle(ANTICLERE.key, W + 2), null);
});

test('SEAT2b2 A REVOLT AT A SEASON\'S END: a Charter held the whole Season whose revolt went unanswered lapses at the Turning that ends it - and earns no Keeper\'s title, as a Charter lapsing for its upkeep earns none; answered, it keeps its Charter and its title (mutants: the lapse in the Season\'s count)', async (t) => {
  // a Season whose last week is the revolt's (W + 1): W's Turning calls it, W + 1's ends the Season
  let zero = null;
  for (let z = Math.max(0, W - 40); z <= W && zero == null; z++) if (seasonEndingAt(W + 1, z)?.n >= 1 && !seasonEndingAt(W, z)) zero = z;
  assert.ok(zero != null);
  const scenario = async (answered) => {
    const s = await stood(t, { SEASON_ZERO_WEEK: String(zero) });
    const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
    s.hold(ANTICLERE, sh.gid, { standing: 3, tithe: 10, since: W - 30 });
    s.treasury(sh.gid, 20000);
    const d1 = await s.member(sh, 'Dorran');
    s.at(AFTER(W));
    await s.call('/v1/seats/list', {}, sh.gm);
    assert.equal(s.battle(ANTICLERE.key).kind, 'revolt');
    if (answered) {
      assert.equal((await s.call('/v1/seats/siege/sign', { character: d1.character, key: ANTICLERE.key }, d1)).status, 200);
      s.at(START + 1800);
      assert.equal((await s.call('/v1/seats/siege/claim', { receipt: await receipt(s.svc, d1, ANTICLERE.key, W + 1, { r: 'defend' }, START + 1800), character: d1.character }, d1)).status, 200);
    }
    s.at(AFTER(W + 1));
    await s.call('/v1/seats/list', {}, sh.gm);
    return { s, sh };
  };
  const lost = await scenario(false);
  assert.equal(lost.s.holdOf(ANTICLERE.key), null);
  assert.deepEqual(lost.s.raw.prepare("SELECT title FROM town_seat_titles WHERE title = 'keeper'").all(), [], 'no Keeper for a Charter the rebels took');
  const kept = await scenario(true);
  assert.equal(kept.s.holdOf(ANTICLERE.key).guild_id, kept.sh.gid);
  assert.deepEqual(kept.s.raw.prepare("SELECT account, title FROM town_seat_titles WHERE title = 'keeper'").all().map((r) => [r.account, r.title]), [[kept.sh.gm.id, 'keeper']]);
});

test('SEAT2b2 THE PASS\'S WORKS: a crown siege\'s pass carries the Walls\' tier, the Gatehouse\'s vitality at its tier, the Barracks\' guards, the Siege Camp\'s Ram Kits and a Ram\'s vitality - half again with a Siegewright on the attacking roster - frozen at the first pass, so a tier risen after changes no pass (mutants: each work; the camp\'s kits; the Siegewright; the freeze)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(WAYREST, sh.gid);
  s.works(WAYREST, sh.gid, { walls: 2, gatehouse: 1, barracks: 3 });
  s.treasury(sh.gid, 100000);
  await s.earn(sh.gid, WAYREST, 2000);
  s.pledge(eo.gid, WAYREST); await s.earn(eo.gid, WAYREST, 36000);
  s.raw.prepare("INSERT INTO town_seat_camps (week, key, guild_id, material, qty) VALUES (?, ?, ?, 'work:ram', 2)").run(W, WAYREST.key, eo.gid);
  const a1 = await s.member(eo, 'Arden'), d1 = await s.member(sh, 'Dorran');
  s.setXp(a1, xpForRank(100), 'carpentry', { spec100: 'siegewright' });
  s.at(AFTER(W));
  await s.call('/v1/seats/list', {}, sh.gm);
  const b = s.battle(WAYREST.key);
  assert.deepEqual([b.kind, b.rams], ['siege', 2]);
  for (const who of [a1, d1]) assert.equal((await s.call('/v1/seats/siege/sign', { character: who.character, key: WAYREST.key }, who)).status, 200);
  s.at(Number(b.starts_at) - 300);
  assert.equal((await s.call('/v1/seats/siege/pass', { key: WAYREST.key, field: CF }, a1)).body.error, 'field-unsettled', 'one side alone');
  const p2 = await s.call('/v1/seats/siege/pass', { key: WAYREST.key, field: CF }, d1);
  assert.equal(p2.status, 200, JSON.stringify(p2.body));
  assert.deepEqual(p2.body.works, [2, 30000, 6, 2, 4500]);
  const p1 = await s.call('/v1/seats/siege/pass', { key: WAYREST.key }, a1);
  assert.deepEqual(p1.body.works, p2.body.works, 'every pass of the battle alike');
  s.works(WAYREST, sh.gid, { gatehouse: 3 });   // a tier risen after the first pass
  const p3 = await s.call('/v1/seats/siege/pass', { key: WAYREST.key, field: CF }, d1);
  assert.deepEqual(p3.body.works, [2, 30000, 6, 2, 4500], 'frozen');
  const v = await verifyOrder(p3.body.pass, s.svc.identityPublic, { subtle, nowS: Number(b.starts_at) - 300, kind: 'siege' });
  assert.deepEqual(v.claims.sx, [2, 30000, 6, 2, 4500]);
});

test('SEAT2b2 THE SIEGEWRIGHT\'S PROJECT AND THE COASTAL HARBOUR: a project a Siegewright begins stands a day sooner (its `wright` kept); a Harbour begun on the client\'s word that the town is coastal (an older client\'s `port` read as it), refused without it (mutants: the day; the flag kept; the coastal word)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 20000);
  const off = await s.member(sh, 'Ofelia', { rank: 1 });
  s.setXp(off, xpForRank(100), 'carpentry', { spec100: 'siegewright' });
  s.raw.prepare("INSERT INTO town_seat_stockpile (key, material, qty) VALUES (?, 'stone:cut', 400), (?, 'plank:oak', 100)").run(ANTICLERE.key, ANTICLERE.key);
  const r = await s.call('/v1/seats/fort/fund', { character: off.character, key: ANTICLERE.key, work: 'walls', rid: rid() }, off);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.wright, true);
  const row = s.raw.prepare("SELECT stands_at, wright FROM town_seat_forts WHERE key = ? AND work = 'walls'").get(ANTICLERE.key);
  assert.deepEqual([Number(row.stands_at) - T0, Number(row.wright)], [1 * DAY, 1], 'the tier\'s two days less one');
  assert.equal((await s.call('/v1/seats/fort/fund', { character: off.character, key: ANTICLERE.key, work: 'harbour', rid: rid() }, off)).body.error, 'fort-not-here');
  assert.equal((await s.call('/v1/seats/fort/fund', { character: off.character, key: ANTICLERE.key, work: 'harbour', coastal: true, rid: rid() }, off)).status, 200);
  const s2 = await stood(t);
  const eo = await s2.guild('Horst', 'Ebon Oath', 'EO');
  s2.hold(ANTICLERE, eo.gid);
  s2.treasury(eo.gid, 20000);
  assert.equal((await s2.call('/v1/seats/fort/fund', { character: eo.gm.character, key: ANTICLERE.key, work: 'harbour', port: true, rid: rid() }, eo.gm)).status, 200, 'an older client\'s port');
});

test('SEAT2b2 THE HALLS\' STEPS: a craft at a station in a seat\'s town (`at`), by a member of the guild that holds it, takes its Forge\'s steps - a step a tier; nothing for another guild\'s member, another profession\'s hall, another town or no `at` (mutants: the member; the profession; the town; the steps)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid);
  s.works(ANTICLERE, sh.gid, { forge: 2, workshop: 1 });
  const smith = await s.member(sh, 'Smitt'), stranger = await s.member(eo, 'Stray');
  const iron = (who) => { s.give(who, 'ingot:iron', 3); s.give(who, 'metal:copper', 1); s.give(who, 'leather:cured', 1); };
  for (const who of [smith, stranger]) s.setXp(who, xpForRank(5), 'smithing');   // an Iron recipe's rank 0: the margin's first row
  // the dice at the middle of the margin's first row (20 / 60 / 20): Standard (1), every time
  const craft = async (who, at) => { iron(who); return steered(0x80, () => s.call('/v1/prof/craft', { character: who.character, recipe: 'longsword:iron', clean: false, name: 'X', rid: rid(), ...(at === undefined ? {} : { at }) }, who)); };
  const q = async (who, at) => { const r = await craft(who, at); assert.equal(r.status, 200, JSON.stringify(r.body)); return r.body.quality; };
  assert.equal(await q(smith), 1, 'no `at`: the roll alone');
  assert.equal(await q(smith, ANTICLERE.key), 3, 'the Forge\'s two tiers: two steps');
  assert.equal(await q(smith, WAYREST.key), 1, 'another town');
  assert.equal(await q(stranger, ANTICLERE.key), 1, 'another guild\'s member');
});

test('SEAT2b2 THE RAM KIT TO A CAMP: a challenger pledged at a seat posts a writ for Ram Kits to its Siege Camp, and a member\'s kit made in the Stores is delivered there; the holder\'s stockpile writ may not ask one, nor a guild writ (mutants: the camp\'s good; the stockpile\'s; the market\'s)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid);
  s.pledge(eo.gid, ANTICLERE);
  s.treasury(eo.gid, 5000); s.treasury(sh.gid, 5000);
  const post = (who, o) => s.call('/v1/writs/post', { character: who.character, region: 21, material: 'work:ram', units: 1, pay: 100, rid: rid(), ...o }, who);
  const w = await post(eo.gm, { seat: ANTICLERE.key });
  assert.equal(w.status, 200, JSON.stringify(w.body));
  assert.equal((await post(sh.gm, { seat: ANTICLERE.key })).body.error, 'bad-material', 'a held seat\'s stockpile asks the works\' materials');
  assert.equal((await post(eo.gm, {})).body.error, 'bad-material', 'no market sells a Ram Kit');
  assert.equal((await post(eo.gm, { seat: ANTICLERE.key, material: 'metal:iron' })).body.error, 'bad-material', 'a camp asks the works\' materials and Ram Kits alone');
  const maker = await s.svc.registered('Wright');
  // made into the Stores and kept there: the room asked in the craft's decision, never withdrawn to the pack
  s.setXp(maker, xpForRank(60), 'carpentry');
  s.give(maker, 'plank:oak', 40); s.give(maker, 'ingot:iron', 20); s.give(maker, 'hide:bear', 4); s.give(maker, 'work:ram', STORES_MAX);
  assert.equal((await s.call('/v1/prof/craft', { character: maker.character, recipe: 'ramkit:oak', clean: false, name: 'W', rid: rid() }, maker)).body.error, 'stores-full');
  s.give(maker, 'work:ram', 1);
  assert.equal((await s.call('/v1/stores/withdraw', { character: maker.character, material: 'work:ram', qty: 1, rid: rid() }, maker)).body.error, 'prof-no-pack-form');
  const d = await s.call('/v1/writs/supply', { character: maker.character, writ: w.body.writ.id, region: 21, units: 1, rid: rid() }, maker);
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.deepEqual(s.raw.prepare('SELECT material, qty FROM town_seat_camps WHERE week = ? AND key = ? AND guild_id = ?').all(W, ANTICLERE.key, eo.gid).map((r) => [r.material, Number(r.qty)]), [['work:ram', 1]]);
});

test('SEAT2b2 THE LIST\'S WORKS: each seat on the seats\' list carries its works as they stand - a project whose day has come counted at its tier, nothing below one (mutants: the works; the risen project)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  s.works(ANTICLERE, sh.gid, { walls: 2, harbour: 1, shrine: 0 });
  s.raw.prepare("INSERT INTO town_seat_forts (key, work, tier, building, guild_id, builder, stands_at, at) VALUES (?, 'forge', 0, 1, ?, 0, ?, ?)").run(ANTICLERE.key, sh.gid, T0 - 60, T0 - DAY);
  const r = (await s.call('/v1/seats/list', {}, sh.gm)).body;
  assert.deepEqual(r.seats.find((x) => x.key === ANTICLERE.key).works, { walls: 2, harbour: 1, forge: 1 });
  assert.deepEqual(r.seats.find((x) => x.key === WAYREST.key).works, {});
});
