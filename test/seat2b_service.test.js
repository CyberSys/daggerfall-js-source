// SEAT2b (2026-10-01, Mac: "Finish the seats"; "We need to do a comprehensive audit on everything and finish the not
// done"): A SEAT'S FORTIFICATIONS AS THE SERVICE KEEPS THEM - a project begun by the holder's Officer, its Marks burnt;
// supplied from the seat's stockpile; standing its tier's days after its last need is met; a Builder's stone; who may
// raise what; the drops (bible/11-Multiplayer/Seats-Arc.md 7.5; server-account/src/seatForts.js). Driven through the
// real Worker over node:sqlite with every migration applied (test/accountDb.mjs). `06-Systems/Online-Arc.md` SEAT2b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from './accountDb.mjs';
import { seatReportText, seatWeekOf, SEAT_MEMBER_WAIT_S, chronicleLine } from '../src/net/townSeatLaw.js';
import { fortsCapturedStatements, fortsSeasonStatements } from '../server-account/src/seatForts.js';

const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
let _rid = 0;
const rid = () => `fort-${String(++_rid).padStart(6, '0')}`;

async function stood(t) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on' });
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
  const member = async (g, handle, rank) => {
    const m = await svc.registered(handle);
    raw.prepare('INSERT INTO guild_members (player, char_id, guild_id, rank, name, joined_at) VALUES (?, ?, ?, ?, ?, ?)').run(m.id, m.character, g.gid, rank, handle, T0 - 30 * DAY);
    return m;
  };
  const treasury = (gid, n) => raw.prepare(`INSERT INTO marks_ledger (src_kind, src_id, dst_kind, dst_id, kind, amount, day, at, actor, who, rid)
    VALUES ('mint', NULL, 'guild', ?, 'test', ?, 1, 1, 'seed', NULL, ?)`).run(gid, n, `seed-${gid}-${n}-${Math.random().toString(36).slice(2, 10)}`);
  const purse = (gid) => Number(raw.prepare('SELECT balance FROM guild_marks WHERE guild_id = ?').get(gid)?.balance ?? 0);
  const hold = (seat, gid) => raw.prepare(`INSERT INTO town_seat_holds (key, guild_id, region, tier, since_week, standing, truce_week, at, tithe, owed)
    VALUES (?, ?, ?, ?, ?, 50, NULL, ?, 6, 0)`).run(seat.key, gid, seat.region, seat.tier, W - 1, T0 - 7 * DAY);
  const stock = (key, material, qty) => raw.prepare(`INSERT INTO town_seat_stockpile (key, material, qty) VALUES (?, ?, ?)
    ON CONFLICT (key, material) DO UPDATE SET qty = town_seat_stockpile.qty + excluded.qty`).run(key, material, qty);
  const stockOf = (key) => Object.fromEntries(raw.prepare('SELECT material, qty FROM town_seat_stockpile WHERE key = ? AND qty > 0').all(key).map((r) => [r.material, Number(r.qty)]));
  const fund = async (who, key, work, o = {}) => (await svc.call('/v1/seats/fort/fund', { character: who.character, key, work, rid: rid(), ...o }, who.secret));
  const forts = async (who, key) => (await svc.call('/v1/seats/forts', { key }, who.secret)).body;
  const chronicle = (key) => raw.prepare('SELECT kind, week, data FROM town_seat_history WHERE key = ? ORDER BY seq').all(key).map((r) => ({ kind: r.kind, week: r.week, data: JSON.parse(r.data) }));
  return { svc, raw, guild, member, treasury, purse, hold, stock, stockOf, fund, forts, chronicle, at: (s) => { now = s; } };
}

test('SEAT2b A PROJECT BEGUN: the holder\'s Officer begins the Walls\' first tier, its 1,000 burnt from the treasury; a Member, another guild, a short treasury, a second project of the same work and a work the seat may not raise refused; the same rid twice is one project (mutants: the rank; the holder; the Marks; one a work; the next tier)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid);
  const off = await s.member(sh, 'Ofelia', 1), mem = await s.member(sh, 'Menno', 2);
  assert.equal((await s.fund(off, ANTICLERE.key, 'walls')).body.error, 'seat-treasury');
  s.treasury(sh.gid, 2500);
  assert.equal((await s.fund(mem, ANTICLERE.key, 'walls')).body.error, 'guild-rank');
  assert.equal((await s.fund(eo.gm, ANTICLERE.key, 'walls')).body.error, 'seat-not-held');
  assert.equal((await s.fund(off, ANTICLERE.key, 'moat')).body.error, 'bad-work');
  assert.equal((await s.fund(off, ANTICLERE.key, 'gatehouse')).body.error, 'fort-not-here', 'a palace without tier-3 Walls has no gate');
  assert.equal((await s.fund(off, ANTICLERE.key, 'harbour')).body.error, 'fort-not-here', 'nor a harbour inland');
  const r = await s.fund(off, ANTICLERE.key, 'walls', { rid: 'fort-walls-01' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.tier, r.body.marks, r.body.needs, r.body.builder], [1, 1000, [['stone:cut', 400], ['plank:oak', 100]], false]);
  assert.equal(s.purse(sh.gid), 1500, 'burnt');
  assert.deepEqual(s.raw.prepare("SELECT src_kind, dst_kind, amount FROM marks_ledger WHERE kind = 'fort'").all().map((x) => [x.src_kind, x.dst_kind, x.amount]), [['guild', 'burn', 1000]]);
  assert.equal((await s.fund(off, ANTICLERE.key, 'walls', { rid: 'fort-walls-01' })).body.repeat, true, 'the same rid: no second project, no second burn');
  assert.equal(s.purse(sh.gid), 1500);
  assert.equal((await s.fund(off, ANTICLERE.key, 'walls')).body.error, 'fort-building');
  assert.equal((await s.fund(off, ANTICLERE.key, 'harbour', { port: true })).body.error, 'seat-treasury', 'a port\'s harbour may be begun - its 2,000 not held');
  assert.equal((await s.fund(off, ANTICLERE.key, 'shrine')).status, 200, 'another work beside it');
  assert.equal(s.purse(sh.gid), 500);
  const row = s.chronicle(ANTICLERE.key).find((c) => c.kind === 'fort-begun');
  assert.equal(chronicleLine(row, ANTICLERE), `In week ${W}, the Silver Hand <SH> began raising Anticlere's Walls to their first tier.`);
});

test('SEAT2b THE SUPPLY AND THE RISE: the stockpile\'s units move into the project, the works in the table\'s order; a met project stands 2 days on, and its tier is the Walls\' then - the Chronicle says so; a Builder\'s project asks nine tenths of the stone (mutants: the move; the order; the day; the rise; the Builder)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  s.hold(ANTICLERE, sh.gid);
  s.treasury(sh.gid, 10_000);
  s.stock(ANTICLERE.key, 'stone:cut', 450);
  s.stock(ANTICLERE.key, 'plank:oak', 40);
  assert.equal((await s.fund(sh.gm, ANTICLERE.key, 'walls')).status, 200);
  assert.equal((await s.fund(sh.gm, ANTICLERE.key, 'shrine')).status, 200);
  let f = await s.forts(sh.gm, ANTICLERE.key);
  assert.deepEqual(f.works.walls, { tier: 0, building: 1, standsAt: null, needs: [['stone:cut', 400], ['plank:oak', 100]], held: [['stone:cut', 400], ['plank:oak', 40]] });
  assert.deepEqual(f.works.shrine.held, [['stone:cut', 50], ['metal:silver', 0]], 'the Walls first, the Shrine the stone left');
  assert.deepEqual(s.stockOf(ANTICLERE.key), {}, 'every unit moved');
  s.stock(ANTICLERE.key, 'plank:oak', 70);
  s.at(T0 + 3600);
  f = await s.forts(sh.gm, ANTICLERE.key);
  assert.equal(f.works.walls.standsAt, T0 + 3600 + 2 * DAY, 'met: two days on');
  assert.deepEqual(s.stockOf(ANTICLERE.key), { 'plank:oak': 10 }, 'no more than it needs');
  s.at(T0 + 3600 + 2 * DAY - 1);
  assert.equal((await s.forts(sh.gm, ANTICLERE.key)).works.walls.tier, 0);
  s.at(T0 + 3600 + 2 * DAY);
  f = await s.forts(sh.gm, ANTICLERE.key);
  assert.deepEqual([f.works.walls.tier, f.works.walls.building, f.works.walls.held], [1, null, null]);
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM town_seat_fort_held WHERE work = 'walls'").get().n, 0, 'spent into the work');
  const raised = s.chronicle(ANTICLERE.key).find((c) => c.kind === 'fort-raised');
  assert.deepEqual(raised.data, { work: 'walls', tier: 1 });
  // the next tier: begun from tier 1; a Builder's asks 720 of 800 stone
  s.raw.prepare("INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, updated_at) VALUES (?, ?, 'masonry', 5000, 'builder', ?)").run(sh.gm.id, sh.gm.character, T0);
  const b = await s.fund(sh.gm, ANTICLERE.key, 'walls');
  assert.deepEqual([b.body.tier, b.body.builder, b.body.needs], [2, true, [['stone:cut', 720], ['ingot:iron', 200]]]);
});

test('SEAT2b WHAT MAY STAND: a palace\'s Gatehouse once its Walls stand at tier 3; a crown\'s at once; a work at its last tier refused (mutants: the gate\'s rule; the last tier)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  const eo = await s.guild('Horst', 'Ebon Oath', 'EO');
  s.hold(ANTICLERE, sh.gid); s.hold(WAYREST, eo.gid);
  s.treasury(sh.gid, 50_000); s.treasury(eo.gid, 50_000);
  assert.equal((await s.fund(eo.gm, WAYREST.key, 'gatehouse')).status, 200, 'a crown\'s gate');
  s.raw.prepare("INSERT INTO town_seat_forts (key, work, tier, at) VALUES (?, 'walls', 3, ?)").run(ANTICLERE.key, T0);
  assert.equal((await s.fund(sh.gm, ANTICLERE.key, 'walls')).body.error, 'fort-max');
  assert.equal((await s.fund(sh.gm, ANTICLERE.key, 'gatehouse')).status, 200, 'tier 3 Walls gain a gate of their own');
  s.raw.prepare("INSERT INTO town_seat_forts (key, work, tier, at) VALUES (?, 'shrine', 2, ?)").run(ANTICLERE.key, T0);
  assert.equal((await s.fund(sh.gm, ANTICLERE.key, 'shrine')).body.error, 'fort-max', 'a Shrine has two');
});

test('SEAT2b THE DROPS: a capture takes every work a tier down and a building project falls, its units back to the stockpile; a Fortifier\'s save keeps the Walls; a Season\'s end every work a tier down, a project still building (mutants: the drop; the units home; the Fortifier; the Season)', async (t) => {
  const s = await stood(t);
  const db = s.svc.env.DB;
  const put = (work, tier, building = null) => s.raw.prepare('INSERT INTO town_seat_forts (key, work, tier, building, at) VALUES (?, ?, ?, ?, ?)').run(ANTICLERE.key, work, tier, building, T0);
  put('walls', 2); put('shrine', 1); put('market', 0, 1);
  s.raw.prepare("INSERT INTO town_seat_fort_held (key, work, material, qty) VALUES (?, 'market', 'plank:oak', 120)").run(ANTICLERE.key);
  const tiers = () => Object.fromEntries(s.raw.prepare('SELECT work, tier, building FROM town_seat_forts WHERE key = ?').all(ANTICLERE.key).map((r) => [r.work, [r.tier, r.building]]));
  await db.batch(fortsCapturedStatements(db, ANTICLERE.key));
  assert.deepEqual(tiers(), { walls: [1, null], shrine: [0, null], market: [0, null] });
  assert.deepEqual(s.stockOf(ANTICLERE.key), { 'plank:oak': 120 }, 'the seat\'s units back in its stockpile');
  await db.batch(fortsCapturedStatements(db, ANTICLERE.key, { fortifier: true }));
  assert.deepEqual(tiers().walls, [1, null], 'the Fortifier\'s Walls kept');
  s.raw.prepare("UPDATE town_seat_forts SET tier = 3, building = NULL WHERE work = 'walls'").run();
  s.raw.prepare("UPDATE town_seat_forts SET building = 1 WHERE work = 'market'").run();
  await db.batch(fortsSeasonStatements(db));
  assert.deepEqual(tiers(), { walls: [2, null], shrine: [0, null], market: [0, 1] }, 'a Season\'s wear, the project kept');
});
