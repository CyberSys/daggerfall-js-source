// SEAT2b part two (2026-10-01, Mac: "I want to finish the inprogress"): THE BATTLE'S WORKS AND FIGURES IN THE RELAY,
// pinned over the real Room and its fake sockets (test/fakeRoom.mjs - the pattern of test/seat2a_relay.test.js and
// test/audit_seats_relay.test.js): a siege's room takes its works from the service's pass (`sx` - every later pass must
// agree), fields the Gatehouse, its Rams and the Barracks' guards, routes a blow at a figure or a work to the battle's
// law, steps the figures each beat (their blows said to the room as `hp` and `fell`), fans `w` and `n` and says both at
// a fighter's `in`; a revolt's room stands the Rebel Captain and his twelve, its end the Captain's fall or the clock.
// Every frame the room sends is run through net/wire.js validSiegeOut - the client's own projection. Headless clients
// drive it (bible/11-Multiplayer/Seats-Arc.md 6.1's way). bible/11-Multiplayer/Seats-Arc.md 6.2, 7.5, 7.7;
// `06-Systems/Online-Arc.md` SEAT2b (part two).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siegeRoomKey, SIEGE_UNITS_PER_M, SIEGE_LENGTH_MS, SIEGE_PROTECT_MS, siegeRamPoint, fieldOf } from '../src/net/siegeRef.js';
import { mintSiegeOrder } from '../src/net/identityToken.js';
import { readSiegeReceipt, verifySiegeReceipt } from '../src/net/siegeReceipt.js';
import { validSiegeOut } from '../src/net/wire.js';
import { fakeRoom } from './fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const M = SIEGE_UNITS_PER_M;
const SK = 3021, SW = 20;
const KEY = siegeRoomKey(SK, SW);
const SB = 1_800_000_000;   // the battle's start, epoch seconds - on a 20 s and a 30 s wave alike
const T = SB * 1000;
/** A pose `x`, `z` and `y` metres out. */
const at = (x, z = 0, y = 0) => ({ x: x * M, y: y * M, z: z * M, yaw: 0, pitch: 0 });
const PT = (x, z) => [x * M, z * M];
/** A palace's field in metres: Gate, Market, Temple, the Throne, the attackers' camp, the defenders'. */
const SF = [PT(0, 40), PT(40, 0), PT(-40, 0), PT(0, -40), PT(0, 80), PT(0, -60)];
/** A crown's: the Palace square its fourth banner, forty metres from the Throne. */
const SF_CROWN = [PT(0, 40), PT(40, 0), PT(-40, 0), PT(40, -40), PT(0, -40), PT(0, 80), PT(0, -60)];
/** A Daedric Dai-Katana in the right hand. */
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }] };
const pad = (i) => String(i).padStart(4, '0');
const sieges = (ws, k) => ws.sent.filter((m) => m.t === 'siege' && (!k || m.k === k));
const refused = (ws, m) => { assert.deepEqual(ws.sent.at(-1), { t: 'error', m }); assert.ok(ws.closed, m); };
const welcomed = (ws) => ws.sent.some((m) => m.t === 'welcome') && !ws.closed;
const signing = async () => {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return { kp, pkcs8: Buffer.from(await subtle.exportKey('pkcs8', kp.privateKey)).toString('base64') };
};
/** TEST THE SHAPE THE PRODUCER MINTS: every siege frame a socket was sent is one the client's own projection accepts. */
function allValid(sockets) {
  let n = 0;
  for (const ws of sockets) for (const fr of sieges(ws)) { assert.ok(validSiegeOut(fr), `a frame the client would refuse: ${JSON.stringify(fr)}`); n++; }
  return n;
}

/**
 * A battle room on the fake object, the clock the test's: `enter(id, side, o)` a hello by the service's pass (a palace
 * siege by default, `o` laid over the pass - its works `sx` among them), `until(ms)` every alarm due fired, the clock
 * walking with them, `rounds(ms, bots)` the headless fighters acting four times a second until `ms` or the end.
 */
async function withRoom(fn, { start = T - 5 * 60_000 } = {}) {
  const realNow = Date.now; let clock = start; Date.now = () => clock;
  const r = fakeRoom(KEY, { now: () => clock });
  const { kp: relayKp, pkcs8 } = await signing();
  r.env.GATE_SIGNING_KEY = pkcs8;
  const say = (ws, o) => r.raw(ws, JSON.stringify({ t: 'siege', ...o }));
  const pass = async (id, sd, o = {}) => mintSiegeOrder({ s: `acct-${id}`, sk: SK, sw: SW, sd, st: 'palace', sn: 'siege', sb: SB, se: SB + 7200, sf: SF, ...o }, (await r.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
  const enter = async (id, sd, o = {}, { pose = at(0), gap = 100, lv = 50 } = {}) => { clock += gap; const ws = r.connect(); await r.hello(ws, id, pose, { lv, look: LOOK, sp: await pass(id, sd, o) }); return ws; };
  const until = async (ms) => {
    let fires = 0;
    while (r.alarm.at != null && r.alarm.at <= ms) {
      if (++fires > 50_000) throw new Error('the alarm re-arms itself for ever');
      clock = Math.max(clock, r.alarm.at); r.alarm.at = null; await r.fire();
    }
    clock = Math.max(clock, ms);
  };
  const fighter = (ws) => r.room._siege.fighters[ws.att.sub];
  const rounds = async (ms, bots, done = (b) => !!b.result) => {
    for (let t = clock + 250; t <= ms; t += 250) {
      await until(t);
      const b = r.room._siege.battle;
      if (done(b)) return;
      for (const bot of bots) await bot(b, t);
    }
  };
  try { await fn({ r, say, pass, enter, until, rounds, fighter, relayKp, now: () => clock, set: (t) => { clock = t; } }); } finally { Date.now = realNow; }
}
/** Fighters (`moves`, `[ws, pose]`) walked to their places at the referee's ceiling: 18 m strides a second apart - a
 *  walk that never arrives (a step refused) throws, never spins. */
async function walk({ r, until, now }, moves) {
  for (let strides = 0; ; strides++) {
    if (strides > 100) throw new Error('a walk that never arrives');
    let more = false;
    for (const [ws, to] of moves) {
      const p = r.room._siege.fighters[ws.att.sub].pose;
      const dx = to.x - p.x, dz = to.z - p.z, d = Math.hypot(dx, dz) / M;
      if (d < 1e-6) continue;
      const k = Math.min(1, 18 / d);
      await r.pose(ws, { ...p, x: p.x + dx * k, z: p.z + dz * k });
      if (k < 1) more = true;
    }
    if (!more) return;
    await until(now() + 1000);
  }
}
/**
 * A HEADLESS FIGHTER: each round it keeps its station `[x, z]` metres, or a function's (walking back to it after a rise at its camp -
 * 4.4 m a round, inside the referee's 18 m/s) and, standing there, strikes whatever `aim(b, f, t)` names (a figure's or
 * a work's id, or nothing) with its Dai-Katana.
 */
const bot = (h, ws, station, aim = () => null) => async (b, t) => {
  const f = h.fighter(ws);
  if (!f || f.down) return;
  const goal = at(...(typeof station === 'function' ? station() : station));
  const d = Math.hypot(goal.x - f.pose.x, goal.z - f.pose.z) / M;
  if (d > 0.05) {
    const k = Math.min(1, 4.4 / d);
    await h.r.pose(ws, { ...f.pose, x: f.pose.x + (goal.x - f.pose.x) * k, z: f.pose.z + (goal.z - f.pose.z) * k });
    if (k < 1) return;
  }
  const to = aim(b, f, t);
  if (to) await h.say(ws, { k: 'blow', to, w: 123, m: 9, d: 500, r: 0 });
};
/** A standing, unprotected guard within a sword's reach of `f` - its id, or null. */
const guardNear = (b, f, t) => b.figures.find((g) => g.kind === 'guard' && !g.down && t >= g.safeTo && Math.hypot(g.x - f.pose.x, g.z - f.pose.z) / M <= 4.5)?.id ?? null;

test('SEAT2b2 A HEADLESS CROWN SIEGE WITH ITS WORKS: a Gatehouse of 20,000, two Ram Kits and six guards - the first Ram fielded at the start and broken by a defender, the second at the attackers\' next wave; the guards felled at their posts and risen at the defenders\' wave; three banners raised and the Throne SHUT until the Ram breaches the gate; then held and taken - every frame validSiegeOut-valid, `w` and `n` said at `in` and each beat (mutants: the works on the pass; the routing; the side rules; the Ram\'s fielding and wave; the breach; the Throne\'s gate; the frames\' fan)', async () => {
  await withRoom(async (h) => {
    const { r, say, enter, until, rounds, fighter, relayKp, now } = h;
    const o = { st: 'crown', sf: SF_CROWN, se: SB + 3600, sx: [1, 20000, 6, 2, 3000] };
    const eye = await enter('eye-0001', 'watch', o);
    const att = [];
    for (let i = 0; i < 18; i++) att.push(await enter(`atk-${pad(i)}`, 'attack', o));
    const dfn = await enter('def-0001', 'defend', o);
    for (const ws of [eye, ...att, dfn]) await say(ws, { k: 'in' });
    const b = r.room._siege.battle;
    assert.deepEqual([b.walls, b.gate, b.ramsLeft, b.ramHp, b.figures.length], [1, { hp: 20000, max: 20000 }, 2, 3000, 6], 'the works the pass carried');
    assert.deepEqual(sieges(eye, 'w').at(-1), { t: 'siege', k: 'w', g: [20000, 20000], br: 0, r: 0, rl: 2 }, 'said at `in`');
    const n0 = sieges(eye, 'n').at(-1);
    assert.deepEqual(n0.n.map((x) => [x[0], x[1], x[6], x[7], x[8]]), ['~g1', '~g2', '~g3', '~g4', '~g5', '~g6'].map((id) => [id, 0, 350, 350, 0]), 'six guards, whole, said at `in`');
    assert.deepEqual([n0.n[0][2], n0.n[0][3], n0.n[1][2], n0.n[1][3]], [...SF_CROWN[4], ...SF_CROWN[0]], 'the Throne\'s guard at the Throne, the Gate\'s at the Gate');
    // stations: six at the Throne (its guards and the gate), three crewing the Ram, three at each of three banners
    const ram = siegeRamPoint(b.field).map((v) => v / M);
    assert.deepEqual(ram, [0, -36], 'the Ram four metres before the gate, toward the attackers\' camp');
    const throne = [[0, -40], [1, -40], [-1, -40], [0, -41], [1, -41], [-1, -41]];
    const crew = [[0, -36], [1, -36], [-1, -36]];
    const banners = [[0, 40], [1, 40], [-1, 40], [40, 0], [40, 1], [40, -1], [-40, 0], [-40, 1], [-40, -1]];
    const stations = [...throne, ...crew, ...banners];
    await walk(h, att.map((ws, i) => [ws, at(...stations[i])]));
    await walk(h, [[dfn, at(1, -35)]]);
    const breaking = (b2, f, t) => guardNear(b2, f, t) ?? (b2.gate && !b2.breached && b2.gate.hp > 600 ? '~gate' : null);
    let broke = 0;
    const bots = [
      ...att.slice(0, 6).map((ws, i) => bot(h, ws, throne[i], breaking)),
      ...att.slice(6, 9).map((ws, i) => bot(h, ws, crew[i])),
      ...att.slice(9).map((ws, i) => bot(h, ws, banners[i], guardNear)),
      bot(h, dfn, () => (broke ? [0, -60] : [1, -35]), (b2) => { if (b2.ram && broke === 0) return '~ram'; if (!b2.ram && b2.ramsLeft === 1 && b2.ramAt > T) broke = 1; return null; }),   // home once it is broken: at the Ram it stands within the Throne's 8 m
    ];
    await until(T);
    assert.deepEqual(sieges(eye, 'w').at(-1), { t: 'siege', k: 'w', g: [20000, 20000], br: 0, r: [3000, 3000, 3, 0], rl: 1 }, 'the first Ram at the start, crewed by three');
    await rounds(T + 10_000, bots);
    assert.equal(broke, 1, 'the defender broke the first Ram');
    assert.deepEqual([b.ram, b.ramAt, b.ramsLeft], [null, T + 30_000, 1], 'the next at the attackers\' next wave');
    assert.ok(sieges(eye, 'w').some((w) => w.r === 0 && w.rl === 1), 'the Ram gone, said');
    assert.ok(sieges(eye, 'fell').some((x) => /^~g[1-6]$/.test(x.id) && /^atk-/.test(x.by)), 'a guard felled, by an attacker');
    assert.ok(Object.values(r.room._siege.fighters).some((f) => f.side === 'attack' && f.felled > 0), 'its felling is the attacker\'s');
    await rounds(T + 29_750, bots);
    assert.equal(b.ram, null, 'no Ram before its wave');
    await rounds(T + 30_250, bots);
    assert.deepEqual([b.ram?.hp, b.ramsLeft], [3000, 0], 'the second at the attackers\' wave');
    // on to the breach - the gate worn down by blows, a tenth each, and the Ram's swing breaching it
    await rounds(T + 600_000, bots, (b2) => b2.breached || !!b2.result);
    assert.equal(b.breached, true, 'breached');
    const ws = sieges(eye, 'w');
    const first = ws.findIndex((w) => w.br === 1);
    assert.ok(first > 0);
    const before = ws[first - 1].g[0];
    assert.ok(before > 12 && before <= 500, `the last blow was the Ram's 500 (the gate stood at ${before}), never a sword's tenth`);
    assert.deepEqual([ws[first].g, ws[first].r, ws[first].rl], [[0, 20000], 0, 0], 'breached: its Ram\'s work done, no kit after');
    // the Throne was shut until the breach though three banners were held
    const fs = sieges(eye);
    const breachAt = fs.indexOf(ws[first]);
    const fBefore = fs.slice(0, breachAt).filter((x) => x.k === 'f');
    assert.ok(fBefore.some((x) => x.b.filter((bn) => bn[0] === 1).length >= 3), 'three of four banners held before the breach');
    assert.ok(fBefore.every((x) => x.th === 0), 'the Throne shut behind its Gatehouse: never a second held');
    // the guards rose at the defenders' wave (the Walls' 27 s) and were felled again
    const rows = sieges(eye, 'n').map((x) => x.n.find((q) => q[0] === '~g1'));
    const downs = rows.filter((q) => q[8] === 1).length, ups = rows.filter((q) => q[8] === 0).length;
    assert.ok(downs > 0 && ups > 0, 'the Throne\'s guard felled and risen');
    // and the Throne held and taken
    await rounds(T + 900_000, bots);
    assert.equal(b.result, 'attack', 'taken');
    for (const a of att) {
      const e = sieges(a, 'end').at(-1);
      const v = await verifySiegeReceipt(e.rc, relayKp.publicKey, { subtle, nowS: Math.floor(now() / 1000) });
      assert.ok(v.ok, v.why);
      assert.deepEqual([v.claims.r, v.claims.a, v.claims.th, v.claims.sd], ['attack', 1, 1, 'attack']);
    }
    const frames = allValid([eye, ...att, dfn]);
    assert.ok(frames > 1000, `every one of ${frames} frames the client's own`);
    assert.ok(sieges(eye, 'n').length > 300 && sieges(eye, 'w').length > 300, 'the figures and the works each beat');
    const all = sieges(eye, 'w'), at0 = all.findIndex((w) => w.br === 1);
    assert.ok(all.slice(0, at0).every((w) => w.br === 0 && w.g[0] > 0) && all.slice(at0).every((w) => w.br === 1 && w.g[0] === 0), '`br` 1 exactly from the frame the gate stands at nought, and 1 after');
    const ids = ['~g1', '~g2', '~g3', '~g4', '~g5', '~g6'];
    assert.ok(sieges(eye, 'n').every((x) => x.n.map((q) => q[0]).join() === ids.join()), 'every `n` names every figure, standing or down');
    assert.ok(sieges(eye, 'n').some((x) => x.n.some((q) => q[8] === 1)), 'a fallen one among them');
  });
});

test('SEAT2b2 THE GUARDS IN THE ROOM: a guard engages an attacker at its post, strikes it (`hp`) and fells it - `fell` by the guard\'s id - and the attacker rises at its camp on the attackers\' wave; an attacker fells the guard (`fell` by the attacker, its `felled`), the guard rises at its post at the defenders\' wave (the Walls\' own) said in `n`; a defender felled waits the Walls\' wave too; the beat runs at half a second while a figure stands (mutants: the figures\' step in the beat; the hit\'s frames; the fall\'s wave; the rise; the side\'s wave at a fall; the finer beat)', async () => {
  await withRoom(async (h) => {
    const { r, say, enter, until, fighter, now } = h;
    const o = { sx: [2, 0, 2, 0, 0] };
    const victim = await enter('atk-0001', 'attack', o, { lv: 1 });
    const slayer = await enter('atk-0002', 'attack', o);
    const d1 = await enter('def-0001', 'defend', o, { lv: 1 }), d2 = await enter('def-0002', 'defend', o);
    for (const ws of [victim, slayer, d1, d2]) await say(ws, { k: 'in' });
    const b = r.room._siege.battle;
    assert.deepEqual([b.gate, b.figures.map((g) => g.id)], [null, ['~g1', '~g2']], 'a palace with no Gatehouse: its two guards alone');
    assert.equal(sieges(victim, 'w').length, 0, 'no works to say');
    assert.equal(sieges(victim, 'n').at(-1).n.length, 2);
    await walk(h, [[victim, at(0, -40)]]);
    await until(T);
    await until(T + 1);
    assert.equal(r.alarm.at, T + 500, 'joined, its guards standing: the beat at half a second');
    // the Throne's guard fells the attacker standing at its post
    const vf = fighter(victim);
    for (let t = T + 500; t <= T + 120_000 && !vf.down; t += 500) await until(t);
    assert.equal(vf.down, true, 'felled by the guard');
    const hits = sieges(d2, 'hp').filter((x) => x.id === 'atk-0001');
    assert.ok(hits.length >= 10, `struck again and again (${hits.length})`);
    for (let i = 1; i < hits.length; i++) { const dealt = hits[i - 1].h - hits[i].h; assert.ok(dealt >= 10 && dealt <= 30 || hits[i].h === 0, `a guard's blow 10-30 (${dealt})`); }
    assert.deepEqual(sieges(d2, 'fell').at(-1), { t: 'siege', k: 'fell', id: 'atk-0001', by: '~g1' }, 'felled by the Throne\'s guard, said to the room');
    assert.equal(vf.upAt % 20_000, 0, 'down until the palace\'s 20 s wave - an attacker\'s, the Walls are the holder\'s');
    await until(vf.upAt);
    const up = sieges(d2, 'up').at(-1);
    assert.deepEqual([up.id, up.p.x, up.p.z], ['atk-0001', ...SF[4]], 'risen at its camp');
    // an attacker fells the guard; it rises at its post on the defenders' wave - the Walls' 14 s
    await walk(h, [[slayer, at(0, -39)]]);
    const g1 = b.figures[0];
    for (let i = 0; i < 80 && !g1.down; i++) { await until(now() + 250); if (now() >= g1.safeTo) await say(slayer, { k: 'blow', to: '~g1', w: 123, m: 9, d: 500, r: 0 }); }
    assert.equal(g1.down, true, 'the guard felled in twenty seconds');
    assert.deepEqual(sieges(d2, 'fell').at(-1), { t: 'siege', k: 'fell', id: '~g1', by: 'atk-0002' });
    assert.equal(fighter(slayer).felled, 1, 'the attacker\'s foe felled - Honours\' "felled a foe"');
    assert.equal(g1.upAt % 14_000, 0, 'its wave the defenders\' behind two tiers of Walls');
    await until(now() + 600);
    assert.deepEqual(sieges(d2, 'n').at(-1).n[0].slice(6, 9), [0, 350, 1], 'said down');
    const rises = g1.upAt;
    await until(rises + 1);
    const row = sieges(d2, 'n').at(-1).n[0];
    assert.deepEqual([row[2], row[3], row[6], row[8]], [...SF[3], 350, 0], 'risen whole at its post');
    assert.equal(g1.safeTo, rises + SIEGE_PROTECT_MS, 'protected three seconds');
    // a defender felled waits the Walls' wave
    await walk(h, [[d1, at(0, -38)]]);
    const df = fighter(d1);
    for (let i = 0; i < 12 && !df.down; i++) { await until(now() + 1000); await say(slayer, { k: 'blow', to: 'def-0001', w: 123, m: 9, d: 500, r: 0 }); }
    assert.equal(df.down, true);
    assert.equal(df.upAt % 14_000, 0, 'a defender\'s wave behind the Walls');
    allValid([victim, slayer, d1, d2]);
  });
});

test('SEAT2b2 THE PASS\'S WORKS AGREE: the first pass names the battle\'s works and every later one must carry the same - another\'s refused, one with none refused; a battle named by a pass with none fights as before: no Gatehouse, no guards, no `w` or `n`, a crown\'s Throne opened on its banners alone, the beat a second (mutants: `sx` in the agreement; the works read off the pass)', async () => {
  await withRoom(async ({ r, enter }) => {
    const o = { st: 'crown', sf: SF_CROWN, se: SB + 3600, sx: [0, 20000, 6, 2, 3000] };
    assert.ok(welcomed(await enter('atk-0001', 'attack', o)));
    refused(await enter('atk-0002', 'attack', { ...o, sx: [0, 20000, 4, 2, 3000] }), 'that pass is for another battle');
    refused(await enter('atk-0003', 'attack', { ...o, sx: undefined }), 'that pass is for another battle');
    assert.ok(welcomed(await enter('def-0001', 'defend', o)), 'the same works: admitted');
    assert.equal(r.room._siege.of.sx, JSON.stringify(o.sx));
  });
  await withRoom(async (h) => {
    const { r, say, enter, until, now } = h;
    const o = { st: 'crown', sf: SF_CROWN, se: SB + 3600 };
    const a = [await enter('atk-0001', 'attack', o), await enter('atk-0002', 'attack', o), await enter('atk-0003', 'attack', o)];
    refused(await enter('atk-0009', 'attack', { ...o, sx: [0, 20000, 0, 0, 0] }), 'that pass is for another battle');
    const d = await enter('def-0001', 'defend', o);
    for (const ws of [...a, d]) await say(ws, { k: 'in' });
    const b = r.room._siege.battle;
    assert.deepEqual([b.gate, b.figures, b.ramsLeft, b.walls], [null, [], 0, 0], 'no works');
    await walk(h, [[a[0], at(0, 40)], [a[1], at(40, 0)], [a[2], at(-40, 0)]]);
    await until(T + 22_000);
    assert.equal(r.alarm.at - now(), 1000, 'a second\'s beat');
    await walk(h, a.map((ws) => [ws, at(0, -40)]));
    await until(T + 300_000);
    assert.equal(b.result, 'attack', 'three of four and the Throne held: taken, as SEAT2a fought it');
    assert.equal([...a, d].reduce((n, ws) => n + sieges(ws, 'w').length + sieges(ws, 'n').length, 0), 0, 'no works and no figures said');
    allValid([...a, d]);
  });
});

test('SEAT2b2 A REVOLT IN THE RELAY (7.7): the holder\'s side enters at the ATTACKERS\' camp and rises there; the Rebel Captain and twelve said in `n`; the Captain felled ends it at once - every fighter\'s receipt `defend`, `a` 0, `th` 0 - its banners the holder\'s and inert; a revolt with nobody to fell him runs to the clock, no forfeit, and is the rebels\' (`attack`), a fighter at the door felled by the rebels (`fell` by a figure) rising at the attackers\' camp on the Walls\' wave (mutants: the revolt\'s figures; its camp; the Captain\'s end and its wake; the clock\'s; the rebels\' foes; the receipts)', async () => {
  await withRoom(async (h) => {
    const { r, say, enter, until, fighter, relayKp, now } = h;
    const o = { sn: 'revolt', sx: [1, 0, 0, 0, 0] };
    const hs = [];
    for (let i = 0; i < 3; i++) hs.push(await enter(`def-${pad(i)}`, 'defend', o));
    const eye = await enter('eye-0001', 'watch', o);
    for (const ws of [...hs, eye]) await say(ws, { k: 'in' });
    const b = r.room._siege.battle;
    assert.deepEqual([b.kind, b.endMs - b.startMs, b.walls, b.gate], ['revolt', SIEGE_LENGTH_MS.revolt, 1, null]);
    const back = sieges(hs[0], 'back').at(-1);
    assert.deepEqual([back.p.x, back.p.z], SF[4], 'the holder\'s side enters at the attackers\' camp');
    const n = sieges(eye, 'n').at(-1).n;
    assert.deepEqual(n.map((q) => [q[0], q[1], q[6], q[7]]), [['~c', 2, 400, 400], ...Array.from({ length: 12 }, (_, i) => [`~r${i + 1}`, 1, 302, 302])], 'the Captain and his twelve, said at `in`');
    assert.deepEqual([n[0][2], n[0][3]], SF[3], 'the Captain at the palace door');
    assert.equal(sieges(eye, 'w').length, 0, 'a revolt has no works to say');
    // they march on the door before the battle is joined, and fell the Captain
    await walk(h, hs.map((ws, i) => [ws, at(i - 1, -39)]));
    await until(T);
    const cap = b.figures[0];
    for (let i = 0; i < 40 && !cap.down && !b.result; i++) {
      await until(now() + 250);
      for (const ws of hs) if (!fighter(ws).down && now() >= cap.safeTo) await say(ws, { k: 'blow', to: '~c', w: 123, m: 9, d: 500, r: 0 });
    }
    assert.equal(cap.down, true, 'the Captain felled');
    const fellAt = now();
    assert.equal(fellAt - T <= 1000, true, 'felled in the first second');
    assert.deepEqual(sieges(eye, 'fell').at(-1).id, '~c');
    assert.match(sieges(eye, 'fell').at(-1).by, /^def-/, 'by the holder\'s fighter');
    assert.equal(cap.upAt, null, 'never to rise');
    assert.equal(r.alarm.at, fellAt, 'his fall wakes the beat at once');
    await until(fellAt);
    assert.equal(b.result, 'defend', 'put down');
    assert.deepEqual(sieges(eye, 'end').at(-1), { t: 'siege', k: 'end', r: 'defend', a: 0 });
    for (const ws of hs) {
      const v = await verifySiegeReceipt(sieges(ws, 'end').at(-1).rc, relayKp.publicKey, { subtle, nowS: Math.floor(now() / 1000) });
      assert.ok(v.ok, v.why);
      assert.deepEqual([v.claims.r, v.claims.a, v.claims.th, v.claims.sd], ['defend', 0, 0, 'defend'], 'every fighter\'s receipt: put down, no banner, no Throne');
    }
    assert.ok(hs.some((ws) => readSiegeReceipt(sieges(ws, 'end').at(-1).rc).h === 1), 'a foe felled: Honours as the law reads them (the service grants none for a revolt)');
    assert.ok(sieges(eye, 'f').every((x) => x.b.every((bn) => bn[0] === 2 && bn[1] === 0) && x.th === 0), 'its banners the holder\'s, inert');
    const thirteen = ['~c', ...Array.from({ length: 12 }, (_, i) => `~r${i + 1}`)].join();
    assert.ok(sieges(eye, 'n').every((x) => x.n.map((q) => q[0]).join() === thirteen), 'every `n` names all thirteen, standing or down');
    allValid([...hs, eye]);
  });
  await withRoom(async (h) => {
    const { r, say, enter, until, fighter, relayKp, now } = h;
    const o = { sn: 'revolt', st: 'crown', sf: SF_CROWN, sx: [2, 0, 0, 0, 0] };
    const lamb = await enter('def-0001', 'defend', o);
    await say(lamb, { k: 'in' });
    await walk(h, [[lamb, at(0, -40)]]);
    await until(T);
    const f = fighter(lamb);
    for (let t = T + 500; t <= T + 120_000 && !f.down; t += 500) await until(t);
    const fell = sieges(lamb, 'fell').at(-1);
    assert.equal(fell.id, 'def-0001', 'the rebels fell the holder\'s fighter at their door');
    assert.match(fell.by, /^~(?:c|r(?:1[0-2]|[1-9]))$/, 'by a figure');
    assert.equal(f.upAt % 24_000, 0, 'its wave the defenders\' behind two tiers of Walls (a crown\'s 30 s, 6 sooner)');
    await until(f.upAt);
    const up = sieges(lamb, 'up').at(-1);
    assert.deepEqual([up.id, up.p.x, up.p.z], ['def-0001', ...SF_CROWN[5]], 'risen at the attackers\' camp');
    await until(T + 10 * 60_000 + 1000);
    assert.equal(r.room._siege.battle.result, null, 'no forfeit');
    await until(T + SIEGE_LENGTH_MS.revolt - 1000);
    assert.equal(r.room._siege.battle.result, null);
    await until(T + SIEGE_LENGTH_MS.revolt);
    assert.equal(r.room._siege.battle.result, 'attack', 'the clock out, the Captain standing: the rebels hold');
    const rc = sieges(lamb, 'end').at(-1).rc;
    assert.deepEqual([readSiegeReceipt(rc).r, readSiegeReceipt(rc).a, readSiegeReceipt(rc).th, readSiegeReceipt(rc).sd], ['attack', 0, 0, 'defend']);
    assert.ok((await verifySiegeReceipt(rc, relayKp.publicKey, { subtle, nowS: Math.floor(now() / 1000) })).ok);
    allValid([lamb]);
  });
});

test('SEAT2b2 THE SIDES AT A FIGURE OR A WORK: a defender strikes no guard and no gate, an attacker no Ram, a spectator nothing, a heal never - and nothing before the start; a blow lands where the side may strike (mutants: each side rule; the heal; the start)', async () => {
  await withRoom(async (h) => {
    const { r, say, enter, until, fighter } = h;
    const o = { st: 'crown', sf: SF_CROWN, se: SB + 3600, sx: [0, 20000, 6, 1, 3000] };
    const a = await enter('atk-0001', 'attack', o), d = await enter('def-0001', 'defend', o), eye = await enter('eye-0001', 'watch', o);
    for (const ws of [a, d, eye]) await say(ws, { k: 'in' });
    await walk(h, [[a, at(0, -37)], [d, at(1, -37)]]);
    const b = r.room._siege.battle;
    const g1 = b.figures[0];
    await say(a, { k: 'blow', to: '~gate', w: 123, m: 9, d: 500, r: 0 });
    assert.equal(b.gate.hp, 20000, 'nothing before the start');
    await until(T - 1);
    let puts = 0;
    const put = r.state.storage.put;
    r.state.storage.put = async (k, v) => { if (k === 'siege') puts++; return put(k, v); };
    r.room._siegeSavedAt = T;   // a checkpoint just made: the next is the Ram's own
    await until(T);
    r.state.storage.put = put;
    assert.deepEqual([b.ram?.hp, puts], [3000, 1], 'the Ram fielded at the start, checkpointed at once');
    await until(T + 3600);   // the Throne's guards' first beats
    await say(d, { k: 'blow', to: '~g1', w: 123, m: 9, d: 500, r: 0 });
    await say(d, { k: 'blow', to: '~gate', w: 123, m: 9, d: 500, r: 0 });
    await say(d, { k: 'cast', to: '~g1', d: 50 });
    assert.deepEqual([g1.hp, b.gate.hp], [350, 20000], 'a defender strikes neither its guard nor its gate');
    await say(a, { k: 'blow', to: '~ram', w: 123, m: 9, d: 500, r: 0 });
    assert.equal(b.ram.hp, 3000, 'an attacker strikes no Ram');
    await say(eye, { k: 'blow', to: '~g1', w: 123, m: 9, d: 500, r: 0 });
    assert.equal(eye.meters.junk, 1, 'a spectator is no fighter: junk');
    await say(a, { k: 'cast', to: '~g1', d: 50, h: 1 });
    assert.equal(g1.hp, 350, 'no heal for a figure');
    assert.equal(fighter(a).casts.length, 0, 'and the heal spent nothing');
    await say(a, { k: 'blow', to: '~g1', w: 123, m: 9, d: 500, r: 0 });
    assert.equal(g1.hp, 350 - 124, 'an attacker\'s blow at a guard: the referee\'s 124');
    await say(a, { k: 'cast', to: '~g1', d: 500 });
    assert.equal(g1.hp, 350 - 124 - 60, 'a cast at it: 60 at most');
    await say(a, { k: 'blow', to: '~gate', w: 123, m: 9, d: 500, r: 0 });
    assert.equal(b.gate.hp, 20000 - 12, 'the gate a tenth');
    await say(d, { k: 'blow', to: '~ram', w: 123, m: 9, d: 500, r: 0 });
    assert.equal(b.ram.hp, 3000 - 124, 'the Ram the whole');
    b.ram.hp = 100;
    await say(d, { k: 'blow', to: '~ram', w: 123, m: 9, d: 500, r: 0 });
    assert.deepEqual(sieges(eye, 'w').at(-1), { t: 'siege', k: 'w', g: [20000 - 12, 20000], br: 0, r: 0, rl: 0 }, 'broken: said at once, before any beat');
    allValid([a, d, eye]);
    await say(a, { k: 'blow', to: '~g7', w: 123, m: 9, d: 500, r: 0 });
    refused(a, 'bad siege');   // a figure the wire never names: refused at the door (wire.js validSiegeIn)
  });
});

test('SEAT2b2 THE BEAT IN THE ROOM: half a second while a figure stands, the field\'s `f` still once a second - and at once on the beat a banner is raised; no `n` while every figure is down; a fighter a figure fells after a late alarm has drifted the beat off the wave\'s grid rises on its wave, never a beat late (mutants: the field\'s second; its events; the figures\' standing; a figure\'s victim\'s wave armed)', async () => {
  await withRoom(async (h) => {
    const { r, say, enter, until, fighter, now, set } = h;
    const o = { sx: [0, 0, 1, 0, 0] };
    const eye = await enter('eye-0001', 'watch', o);
    const raiser = await enter('atk-0001', 'attack', o), slayer = await enter('atk-0002', 'attack', o), victim = await enter('atk-0003', 'attack', o);
    for (const ws of [eye, raiser, slayer, victim]) await say(ws, { k: 'in' });
    const b = r.room._siege.battle;
    await walk(h, [[raiser, at(49, 0)]]);   // nine metres off the Market: at no point
    await until(T + 1000);
    const f0 = sieges(eye, 'f').length, n0 = sieges(eye, 'n').length;
    await until(T + 9750);
    await r.pose(raiser, at(40, 0));   // at the Market before the beat of T + 10 s, not before that of T + 9.5 s
    await until(T + 11_000);
    assert.equal(sieges(eye, 'n').length - n0, 20, 'ten seconds of half-second beats, a guard standing');
    assert.equal(sieges(eye, 'f').length - f0, 10, 'and the field\'s frame once a second');
    await until(T + 29_000);
    assert.deepEqual(sieges(eye, 'f').at(-1).b[1], [2, 19, 1], 'nineteen seconds raised');
    await until(T + 29_500);
    assert.deepEqual(sieges(eye, 'f').at(-1).b[1], [1, 0, 0], 'raised on a half-second beat: said on it');
    // the guard felled: no `n` while every figure is down
    await walk(h, [[slayer, at(0, -39)]]);
    const g = b.figures[0];
    for (let i = 0; i < 80 && !g.down; i++) { await until(now() + 250); if (now() >= g.safeTo) await say(slayer, { k: 'blow', to: '~g1', w: 123, m: 9, d: 500, r: 0 }); }
    assert.equal(g.down, true, 'the guard felled');
    const rises = g.upAt;
    const n1 = sieges(eye, 'n').length;
    await until(rises - 1);
    assert.ok(rises - now() < 20_000 && now() - (rises - 20_000) > 1000, 'a beat or more with it down');
    assert.equal(sieges(eye, 'n').length, n1, 'no figure standing: no `n`');
    await until(rises);
    assert.equal(sieges(eye, 'n').at(-1).n[0][8], 0, 'risen: said again');
    // a late alarm drifts the beat off the grid; a fighter the guard fells then rises on its wave all the same
    await walk(h, [[slayer, at(0, 80)], [victim, at(0, -20)]]);   // the victim twenty metres off the guard's post: past its leash
    const wave = Math.ceil((now() + 5000) / 20_000) * 20_000;
    await until(wave - 2250);
    await r.pose(victim, at(0, -30));
    await until(wave - 1250);
    await r.pose(victim, at(0, -39));
    await until(wave - 1000);
    assert.equal(r.alarm.at, wave - 500, 'the next beat on the half-second grid');
    const vf = fighter(victim);
    assert.equal(g.target, victim.att.sub, 'the guard on the victim');
    vf.hp = 1; g.swingAt = 0;
    let puts = 0;
    const put = r.state.storage.put;
    r.state.storage.put = async (k, v) => { if (k === 'siege') puts++; return put(k, v); };
    r.room._siegeSavedAt = wave - 100;   // a checkpoint just made: the next is the fall's own
    r.alarm.at = null; set(wave - 100); await r.fire();   // the beat of wave - 500 s fired 400 ms late
    r.state.storage.put = put;
    assert.equal(puts, 1, 'the fall checkpointed at once');
    assert.deepEqual([vf.down, vf.upAt], [true, wave], 'felled on the late beat, down until the attackers\' wave a tenth of a second on');
    assert.equal(r.alarm.at, wave, 'its wave armed - never the next beat, 400 ms late');
    await until(wave);
    assert.equal(sieges(eye, 'up').at(-1).id, 'atk-0003');
    allValid([eye, raiser, slayer, victim]);
  });
});

test('SEAT2b2 A WOKEN ROOM KEEPS ITS WORKS AND FIGURES: the battle\'s works, its Ram, its guards\' places and falls checkpointed with it, read back by a fresh object (mutants: the JSON-plain battle)', async () => {
  await withRoom(async (h) => {
    const { r, say, enter, until } = h;
    const o = { st: 'crown', sf: SF_CROWN, se: SB + 3600, sx: [2, 20000, 6, 2, 3000] };
    const a = await enter('atk-0001', 'attack', o);
    await say(a, { k: 'in' });
    await until(T + 5000);
    const was = JSON.parse(JSON.stringify(r.room._siege.battle));
    assert.ok(was.ram && was.figures.length === 6, 'a Ram and six guards in the checkpointed battle');
    assert.deepEqual(JSON.parse(JSON.stringify(r.store.get('siege').battle)).figures.length, 6, 'stored');
    r.wake();
    await until(T + 6000);
    const now = r.room._siege.battle;
    assert.deepEqual([now.gate, now.ramsLeft, now.figures.map((g) => g.id), now.walls], [was.gate, was.ramsLeft, was.figures.map((g) => g.id), 2], 'the woken object fights on with the same works');
    assert.ok(fieldOf(SF_CROWN, 'crown'));
  });
});
