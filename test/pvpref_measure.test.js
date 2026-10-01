// PVP-REF (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): THE MEASUREMENT GATE
// (bible/11-Multiplayer/Seats-Arc.md 6.1: "PVP-REF's slice must run a full room - 40 fighters, 60 spectators and 6
// relay-run guards (a crown siege at its largest; a revolt's 13 rebels stand in the guards' place) ... with headless
// clients, the SLAM probes' way, at or under 60% of every room budget (FOES_ROOM_BYTES_PER_S, HIT_ROOM_BYTES_PER_S, the
// pose fan). If it cannot, siege sizes drop to 8 against 8 and 16 against 16 until it can").
//
// The real Room on the fake Durable Object (test/fakeRoom.mjs), a siege room's ten seconds of the room's clock: every
// socket MOVING and posing at the client's own crowded rate (net/online.js poseHzFor - 4 a second), each fighter striking
// the man in front of it at the referee's ceiling (four blows a second, every one landing and fanned) and casting at the
// window's (three a five seconds). Every byte the room sends is counted at the socket.
//
// PIN MOVED (SEAT2b part two): THE GUARDS ARE THE ROOM'S OWN. PVP-REF had no relay-run figure to field, so its six
// "guards" were six more sockets posing as a fighter does; now the room runs them (net/siegeRef.js siegeFiguresStep): a
// crown siege by the service's pass - 20 a side by pass, 60 spectators, and the pass's works (`sx`: the Walls, a tier-3
// Gatehouse, the Barracks' SIX guards, two Ram Kits) - so the guards walk, strike and are said each half-second beat in
// the room's `n` frame, the works in its `w`, beside the field's `f`. Four guards stand on four attackers' lanes and
// fight them through the window (each on its own man, so no fighter falls and every blow keeps landing); the Throne's two
// stand off the lanes. And the revolt's room beside it: the holder's twenty (a crown side) striking the rebels about
// their door, sixty spectators, and the Rebel Captain and his twelve said each beat - 6.1's "a revolt's 13 rebels stand
// in the guards' place". The walk turns every two seconds (it turned every five), so a fighter at a guard's post stays
// within the guard's leash; every pose still moves.
//
// THE BUDGETS, as the relay defines them: FOES_ROOM_BYTES_PER_S is a room's egress for its heaviest stream (a cell's
// foes, fanned) - the siege's own frames (vitality, falls, rises, the field, the works, the figures) are that stream's
// peer here; HIT_ROOM_BYTES_PER_S is what one destination may receive of the room's blows a second; and the pose fan's is
// the bound's own design point (SLAM1/SLAM6: 200 standing in one block, every one moving - N x (POSE_FAN_MAX + the rest /
// POSE_FAR_SHARE) x POSE_HZ_MIN = 59,000 sends a second, arithmetic).
//
// MEASURED (PVP-REF, 2026-10-01): 106 sockets at 4 Hz - 21,293 pose sends a second (36% of the 59,000); 160 blows and 24
// casts landed a second, 1,045 KiB/s of siege frames (26% of FOES_ROOM_BYTES_PER_S's 4,096); the busiest socket 10 KiB/s
// (4% of HIT_ROOM_BYTES_PER_S's 256). MEASURED (SEAT2b part two, 2026-10-01, this file, the real guards and rebels): the
// crown siege - 100 sockets and six guards at 4 Hz: 7,791 pose sends a second (13% of the 59,000 - AUDIT-SEATS T2 took
// the spectators' bodies out of the fan, and the forty fighters' poses are what is left); 160 blows and 24 casts fanned a
// second, 19,070 siege sends, 1,070 KiB/s (26% of FOES_ROOM_BYTES_PER_S - the field, the works and the figures each
// half-second beat beside the blows); the busiest socket 11 KiB/s of siege frames (4% of HIT_ROOM_BYTES_PER_S), 35 KiB/s
// of everything. The revolt - 80 sockets and thirteen figures: 3,495 pose sends a second (6%); its siege frames
// 111 KiB/s (3%) - a blow on a rebel fans nothing, the thirteen rows each beat are most of it; the busiest socket 1.4 KiB/s
// (under 1%).
// The sizes stand - 6.4's 20 a side and 4 sellswords - and the fall to 8/16 is not taken. What this cannot measure is a
// deployed object's CPU (AUDIT SLAM FINAL C1's caveat, kept): the counts are the room's own sends, observed on the fake,
// not a Cloudflare isolate's ceiling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { siegeRoomKey, SIEGE_UNITS_PER_M, SIEGE_BLOWS_HZ, SIEGE_CASTS, SIEGE_FIGURE_TICK_MS } from '../src/net/siegeRef.js';
import { mintSiegeOrder } from '../src/net/identityToken.js';
import { FOES_ROOM_BYTES_PER_S, HIT_ROOM_BYTES_PER_S, POSE_FAN_MAX, POSE_FAR_SHARE, SIEGE_FIGURES_MAX } from '../src/net/wire.js';
import { poseHzFor, POSE_HZ_MIN } from '../src/net/online.js';
import { fakeRoom } from './fakeRoom.mjs';

const { subtle } = globalThis.crypto;
const M = SIEGE_UNITS_PER_M;
const LOOK = { race: 'Nord', gender: 'male', faceIndex: 0, items: [{ templateIndex: 123, group: 'Weapons', equipSlot: 19, material: 9 }] };   // PIN MOVED (AUDIT-SEATS): R8 - the weapon in the right hand (EquipSlots.RightHand 19); slot 0 is an amulet's, and a weapon there is held no more
const SHARE = 0.6;
const SECONDS = 10;
/** The pose fan's design point (SLAM1/SLAM6): 200 in one block, all moving, at the crowded floor. */
const SLAM_N = 200;
const POSE_FAN_REF = SLAM_N * (POSE_FAN_MAX + (SLAM_N - 1 - POSE_FAN_MAX) / POSE_FAR_SHARE) * POSE_HZ_MIN;
const SK = 3021, SW = 20;
const SB = 1_800_000_000;   // the battle's start, epoch seconds
const T = SB * 1000;
const PT = (x, z) => [x * M, z * M];
/** PIN MOVED (SEAT2b part two): the crown's field - its four banners on four attackers' lanes (z 0, 15, 30, 45 m: a guard
 *  at each fights that lane's attacker), the Throne and its two guards sixty metres off the lanes, the camps at their
 *  middle. The revolt's: its palace door, where the Captain and his twelve stand, at the lanes' end. */
const SF_CROWN = [PT(0, 0), PT(0, 15), PT(0, 30), PT(0, 45), PT(-60, 30), PT(-1, 30), PT(3, 30)];
const SF_REVOLT = [PT(0, 0), PT(0, 15), PT(0, 30), PT(0, 45), PT(1, 33), PT(-1, 15), PT(3, 15)];

/**
 * Ten seconds of a full siege room, joined: `revolt` false - a crown siege, 20 a side and the six guards its pass's works
 * field; true - a crown's revolt, the holder's twenty and the Captain and his twelve. Sixty spectators either way. The
 * fighters walk in pairs across a 2 m line, each pair its own lane, and strike the man in front of them (a revolt's, a
 * rebel each - `~r1` to `~r12` in turn).
 */
async function fullRoom({ revolt = false } = {}) {
  const realNow = Date.now; let clock = T - 5 * 60_000; Date.now = () => clock;
  try {
    const r = fakeRoom(siegeRoomKey(SK, SW), { now: () => clock });
    const o = revolt ? { sn: 'revolt', se: SB + 7200, sf: SF_REVOLT, sx: [3, 0, 0, 0, 0] } : { sn: 'siege', se: SB + 3600, sf: SF_CROWN, sx: [3, 50_000, 6, 2, 4500] };
    const pass = async (id, sd) => mintSiegeOrder({ s: `acct-${id}`, sk: SK, sw: SW, sd, st: 'crown', sb: SB, ...o }, (await r.signer()).privateKey, { subtle, nowS: Math.floor(clock / 1000) });
    const fighters = revolt ? 20 : 40, spectators = 60;
    const n = fighters + spectators;
    const peers = [];
    for (let i = 0; i < n; i++) {
      const id = `peer-${String(i + 1).padStart(4, '0')}`;
      const kind = i < fighters ? 'fighter' : 'spectator';
      const side = kind === 'spectator' ? 'watch' : revolt || i % 2 ? 'defend' : 'attack';
      // fighters in pairs across the line (x 0 and 2 m), each pair its own lane 3 m on; the spectators stand back on the walls
      const lane = kind === 'fighter' ? Math.floor(i / 2) * 3 : (i - fighters) * 2;
      const x0 = kind === 'fighter' ? (i % 2) * 2 : -30;
      const ws = r.connect();
      await r.hello(ws, id, { x: x0 * M, y: 0, z: lane * M, yaw: 0, pitch: 0, mv: 1 }, { lv: revolt ? 50 : 25, look: LOOK, sp: await pass(id, side) });
      clock += 1000 / 10;   // under the stands' hello gate
      peers.push({ id, ws, kind, x0, lane });
    }
    for (const p of peers) await r.raw(p.ws, JSON.stringify({ t: 'siege', k: 'in' }));
    const fire = async () => { while (r.alarm.at != null && r.alarm.at <= clock) { r.alarm.at = null; await r.fire(); } };
    // the fighters walk from their camps to their lanes, a second's run at a time, before the battle is joined
    for (let more = true, strides = 0; more; strides++) {
      if (strides > 100) throw new Error('a walk that never arrives');
      more = false;
      for (const p of peers) {
        if (p.kind !== 'fighter') continue;
        const f = r.room._siege.fighters[p.ws.att.sub], to = { x: p.x0 * M, z: p.lane * M };
        const d = Math.hypot(to.x - f.pose.x, to.z - f.pose.z) / M;
        if (d < 1e-6) continue;
        const k = Math.min(1, 18 / d);
        await r.pose(p.ws, { ...f.pose, x: f.pose.x + (to.x - f.pose.x) * k, z: f.pose.z + (to.z - f.pose.z) * k, mv: 1 });
        if (k < 1) more = true;
      }
      clock += 1000;
      await fire();
    }
    clock = T + 1000;   // joined: the guards and the rebels at work
    await fire();
    // count at the socket from here: every frame, its bytes, by kind
    const per = new Map();
    const tally = { pose: { n: 0, b: 0 }, siege: { n: 0, b: 0 }, other: { n: 0, b: 0 } };
    let nFrames = 0, wFrames = 0, nRows = 0;
    for (const p of peers) {
      const mine = { siege: 0, all: 0 };
      per.set(p.id, mine);
      p.ws.send = function (s) {
        if (this.closed) throw new Error('closed');
        const kind = s.startsWith('{"t":"pose"') ? 'pose' : s.startsWith('{"t":"siege"') ? 'siege' : 'other';
        tally[kind].n++; tally[kind].b += s.length;
        mine.all += s.length;
        if (kind === 'siege') mine.siege += s.length;
        if (p === peers[0] && s.startsWith('{"t":"siege","k":"n"')) { nFrames++; nRows = JSON.parse(s).n.length; }
        if (p === peers[0] && s.startsWith('{"t":"siege","k":"w"')) wFrames++;
      };
    }
    const hz = poseHzFor(n - 1);
    const start = clock;
    const poseEvery = 1000 / hz;
    const blowEvery = 1000 / SIEGE_BLOWS_HZ;
    const castEvery = SIEGE_CASTS.windowMs / SIEGE_CASTS.max + 1;
    let landed = 0, cast = 0;
    const lastPose = new Map(), lastBlow = new Map(), lastCast = new Map();
    const foeOf = (k) => (revolt ? `~r${(k % 12) + 1}` : peers[k ^ 1].id);
    // a 25 ms tick: each socket acts when its own interval has come, staggered by its index so the room is not one burst;
    // the room's own beat fires as its alarm comes due
    for (let t = 0; t < SECONDS * 1000; t += 25) {
      clock = start + t;
      await fire();
      for (let k = 0; k < peers.length; k++) {
        const p = peers[k];
        const off = (k * 7) % 25 * 10;
        if (t >= off && t - (lastPose.get(p.id) ?? -Infinity) >= poseEvery) {
          lastPose.set(p.id, t);
          // everyone walks the lane at 4 m/s, turning every 2 s - always moving, so no keepalive is ever spared the tier
          const z = p.lane + 4 * ((t % 4000) < 2000 ? (t % 2000) / 1000 : (2000 - (t % 2000)) / 1000);
          await r.pose(p.ws, { x: p.x0 * M, y: 0, z: z * M, yaw: (t / 1000) % 3, pitch: 0, mv: 1 });
        }
        if (p.kind !== 'fighter') continue;
        if (t >= off && t - (lastBlow.get(p.id) ?? -Infinity) >= blowEvery) {
          lastBlow.set(p.id, t);
          const before = tally.siege.n;
          await r.raw(p.ws, JSON.stringify({ t: 'siege', k: 'blow', to: foeOf(k), w: 123, m: 9, d: 1, r: 0 }));
          if (tally.siege.n > before) landed++;
        }
        if (t >= off && t - (lastCast.get(p.id) ?? -Infinity) >= castEvery) {
          lastCast.set(p.id, t);
          const before = tally.siege.n;
          await r.raw(p.ws, JSON.stringify({ t: 'siege', k: 'cast', to: foeOf(k), d: 1 }));
          if (tally.siege.n > before) cast++;
        }
      }
    }
    const s = SECONDS;
    const b = r.room._siege.battle;
    return {
      n, hz, landed: landed / s, cast: cast / s, figures: b.figures.length, nFrames, wFrames, nRows,
      rebelsHurt: b.figures.reduce((sum, g) => sum + (g.kind === 'rebel' ? g.max - g.hp : 0), 0),
      guardsFighting: b.figures.filter((g) => g.target != null).length,
      poseSends: tally.pose.n / s, poseBytes: tally.pose.b / s,
      siegeBytes: tally.siege.b / s, siegeSends: tally.siege.n / s,
      worstDest: Math.max(...[...per.values()].map((x) => x.siege)) / s, worstDestAll: Math.max(...[...per.values()].map((x) => x.all)) / s,
      kept: Object.values(r.room._siege.fighters).filter((f) => f.side && !f.down).length,
      result: b.result,
    };
  } finally { Date.now = realNow; }
}
const lineOf = (m) => `${m.n} sockets and ${m.figures} figures at ${m.hz} Hz: ${Math.round(m.poseSends)} pose sends/s (${Math.round(m.poseBytes / 1024)} KiB/s) against ${Math.round(POSE_FAN_REF)}; ${Math.round(m.landed)} blows and ${m.cast.toFixed(1)} casts fanned a second, ${Math.round(m.siegeSends)} siege sends/s, ${Math.round(m.siegeBytes / 1024)} KiB/s against ${FOES_ROOM_BYTES_PER_S / 1024} KiB/s; the busiest socket ${Math.round(m.worstDest / 1024)} KiB/s of siege frames against ${HIT_ROOM_BYTES_PER_S / 1024} KiB/s (${Math.round(m.worstDestAll / 1024)} KiB/s of everything)`;

test('PVP-REF THE MEASUREMENT (6.1): a full room - 40 fighters, 60 spectators and 6 relay-run guards (PIN MOVED, SEAT2b part two: the room\'s own, by a crown pass\'s works), all moving at the client\'s crowded rate, every fighter striking at four a second and casting at the window\'s, the guards fighting and said each half-second beat - runs at or under 60% of every room budget: the pose fan against SLAM\'s 200-in-a-block, the siege\'s fanned frames against FOES_ROOM_BYTES_PER_S, the most any one socket receives of them against HIT_ROOM_BYTES_PER_S - so the sizes stand (no fall to 8/16)', async () => {
  const m = await fullRoom();
  const line = lineOf(m);
  assert.equal(m.n, 100);
  assert.equal(m.figures, 6, 'six guards, the relay\'s own');
  assert.equal(m.hz, POSE_HZ_MIN, 'the crowded floor');
  assert.ok(m.landed >= 40 * SIEGE_BLOWS_HZ * 0.95, `every fighter landing at the ceiling (${m.landed})`);
  assert.ok(m.cast >= 40 * (SIEGE_CASTS.max / (SIEGE_CASTS.windowMs / 1000)) * 0.9, `and casting at the window's (${m.cast})`);
  assert.equal(m.kept, 40, 'nobody fell: every blow fanned');
  assert.ok(m.guardsFighting >= 4, `the guards on the lanes at work (${m.guardsFighting})`);
  assert.ok(m.nFrames >= SECONDS * (1000 / SIEGE_FIGURE_TICK_MS) - 2 && m.wFrames >= SECONDS * (1000 / SIEGE_FIGURE_TICK_MS) - 2, `the figures and the works each half-second beat (${m.nFrames}, ${m.wFrames})`);
  assert.equal(m.result, null);
  assert.ok(m.poseSends <= SHARE * POSE_FAN_REF, `the pose fan: ${line}`);
  assert.ok(m.siegeBytes <= SHARE * FOES_ROOM_BYTES_PER_S, `the room's siege egress: ${line}`);
  assert.ok(m.worstDest <= SHARE * HIT_ROOM_BYTES_PER_S, `one destination's: ${line}`);
});

test('SEAT2b2 THE MEASUREMENT\'S REVOLT (6.1: "a revolt\'s 13 rebels stand in the guards\' place"): a crown\'s revolt at its largest - the holder\'s twenty striking the rebels at the ceiling and casting, sixty spectators, the Rebel Captain and his twelve fighting and said each half-second beat - runs at or under 60% of every room budget', async () => {
  const m = await fullRoom({ revolt: true });
  const line = lineOf(m);
  assert.equal(m.n, 80);
  assert.equal(m.figures, SIEGE_FIGURES_MAX, 'the Captain and his twelve');
  assert.equal(m.nRows, SIEGE_FIGURES_MAX, 'thirteen rows each beat');
  assert.ok(m.nFrames >= SECONDS * (1000 / SIEGE_FIGURE_TICK_MS) - 2, `each half-second beat (${m.nFrames})`);
  assert.ok(m.rebelsHurt > 0, 'the holder\'s blows land on the rebels');
  assert.equal(m.result, null, 'the Captain stands: the revolt runs on');
  assert.ok(m.poseSends <= SHARE * POSE_FAN_REF, `the pose fan: ${line}`);
  assert.ok(m.siegeBytes <= SHARE * FOES_ROOM_BYTES_PER_S, `the room's siege egress: ${line}`);
  assert.ok(m.worstDest <= SHARE * HIT_ROOM_BYTES_PER_S, `one destination's: ${line}`);
});
