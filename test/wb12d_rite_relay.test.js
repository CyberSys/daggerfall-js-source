// WB12d (2026-10-01, Mac: "faithful and a Summoner"): THE FAITHFUL'S RITE ON THE RELAY - the circle's cell keeps who
// struck the faithful and tells the hub when the Summoner falls; the hub says the broken rite to everyone online, at
// every hello and to the channel; the breach's room asks it for the day's helpers at the kill - a fighter's receipt
// carries `r`, one who broke it alone is minted a receipt of the rite alone (bible/11-Multiplayer/World-Bosses.md
// section 19 D).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riteNativeOf, RITE_REACH_M, RITE_UNITS_PER_M } from '../src/net/gateRite.js';
import { gateTimes, gateRoomKey } from '../src/net/gateLaw.js';
import { BRAIN_TICK_MS, HIT_KINDS, COURT_CENTRE } from '../src/net/gateBrain.js';
import { readReceipt } from '../src/net/gateReceipt.js';
import { worldRoom, SOCIAL_ROOM, RITE_KEY, GATE_BRAIN_V, gateReceiptKey, RITE_TELL_RETRY_MS } from '../src/net/wire.js';
import { fakeRooms } from './fakeRoom.mjs';

const DAY = 200;
const TT = gateTimes(DAY);
const PX = 300, PY = 200;
const CELL = worldRoom(PX, PY);
const [CX, CZ] = riteNativeOf(DAY, PX, PY);
const AT = { x: CX + 3 * RITE_UNITS_PER_M, y: 0, z: CZ, yaw: 0, pitch: 0 };
const FAR = { ...AT, x: CX + (RITE_REACH_M + 5) * RITE_UNITS_PER_M };
const HOOK = 'https://discord.com/api/webhooks/123456789012345678/abc_DEF-123';
const court = (x, z) => ({ x: COURT_CENTRE[0] + x, y: 0, z: COURT_CENTRE[2] + z, yaw: 0, pitch: 0 });
const rites = (ws) => ws.sent.filter((m) => m.t === 'rite');
const quiet = (fn) => { const warn = console.warn; console.warn = () => {}; return Promise.resolve().then(fn).finally(() => { console.warn = warn; }); };

async function withRite(fn, { start = TT.omenAt + 60_000 } = {}) {
  const realNow = Date.now, realFetch = globalThis.fetch;
  let clock = start;
  Date.now = () => clock;
  const posts = [];
  globalThis.fetch = async (url, init) => { posts.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 204 }; };
  const world = fakeRooms({ now: () => clock });
  const cell = world.room(CELL), hub = world.room(SOCIAL_ROOM);
  const say = (ws, o = {}, room = cell) => room.raw(ws, JSON.stringify({ t: 'rite', d: DAY, px: PX, py: PY, s: 0, f: 0, ...o }));
  const at = async (id, pose = AT, room = cell) => { const ws = room.connect(); await room.hello(ws, id, pose); clock += 1000; return ws; };
  try { await quiet(() => fn({ world, cell, hub, say, at, posts, now: () => clock, set: (t) => { clock = t; }, step: (ms) => { clock += ms; } })); }
  finally { Date.now = realNow; globalThis.fetch = realFetch; }
}

test('WB12d relay: the cell keeps who struck the faithful - from a pose at the day\'s circle, inside the window, by the verified account; a word from past its reach, before the omen or from the opening on, or said in another cell is kept nowhere (mutants: the pose unasked; the window unasked; the cell unasked; the guest kept)', async () => {
  await withRite(async ({ world, cell, say, at, step, set }) => {
    const a = await at('peer-0001');
    await say(a, { s: 1 });
    assert.deepEqual(cell.store.get(RITE_KEY), { d: DAY, px: PX, py: PY, h: { 'acct-peer-0001': 'peer-0001' }, f: 0, at: 0, told: -1 });
    const b = await at('peer-0002', FAR);
    await say(b, { s: 1 });
    assert.deepEqual(Object.keys(cell.store.get(RITE_KEY).h), ['acct-peer-0001'], 'past its reach: not at the circle');
    const other = world.room(worldRoom(PX + 16, PY));
    const x = await at('peer-0003', AT, other);
    await say(x, { s: 1 }, other);
    assert.equal(x.meters.junk, 1, 'the circle is not in that cell');
    set(TT.openAt);
    const c = await at('peer-0004');
    await say(c, { s: 1 });
    assert.deepEqual(Object.keys(cell.store.get(RITE_KEY).h), ['acct-peer-0001'], 'the breach open: the rite is over');
    set(TT.omenAt - 1000);
    await say(c, { s: 1 });
    assert.deepEqual(Object.keys(cell.store.get(RITE_KEY).h), ['acct-peer-0001'], 'before the omen: no rite yet');
    step(0);
  });
});

test('WB12d relay: the Summoner\'s fall breaks the rite - the hub told once, and again as more who struck are said; the hub says it to everyone online once, at every hello while the breach holds, and posts it to the channel with their names (mutants: the hub never told; the broken word unsaid; said at every word; the hello unsaid; the post owed nowhere)', async () => {
  await withRite(async ({ cell, hub, say, at, posts, set }) => {
    Object.assign(hub.env, { GATE_DISCORD_WEBHOOK: HOOK });
    const h = hub.connect(); await hub.hello(h, 'peer-0009');
    const a = await at('peer-0001');
    await say(a, { s: 1 });
    assert.deepEqual(rites(h), [], 'struck, not yet broken');
    await say(a, { s: 1, f: 1 });
    const led = cell.store.get(RITE_KEY);
    assert.equal(led.f, 1);
    assert.equal(led.told, 1, 'the hub heard it, with the one who struck');
    assert.deepEqual(rites(h), [{ t: 'rite', k: 'br', d: DAY, px: PX, py: PY, at: led.at, by: ['peer-0001'] }]);
    await say(a, { s: 1, f: 1 });
    assert.equal(rites(h).length, 1, 'said once');
    const b = await at('peer-0002');
    await say(b, { s: 1, f: 1 });
    assert.deepEqual(Object.keys(hub.store.get(RITE_KEY).h).sort(), ['acct-peer-0001', 'acct-peer-0002'], 'told again: the second who struck');
    assert.equal(rites(h).length, 1, 'and not said again');
    const late = hub.connect(); await hub.hello(late, 'peer-0010');
    assert.equal(rites(late).length, 1, 'a hello hears it while the breach holds');
    set(TT.wrathAt + 60 * 60_000);
    const gone = hub.connect(); await hub.hello(gone, 'peer-0011');
    assert.equal(rites(gone).length, 0, 'not once it is gone');
    set(TT.omenAt + 2 * 60_000);
    await hub.fire();
    const post = posts.find((p) => /is broken/.test(p.body.content));
    assert.ok(post, 'posted');
    assert.equal(post.body.content, '**The faithful\'s rite in the wilds is broken** by peer-0001.');
  });
});

test('WB12d relay: a cell whose hub does not answer tells it again on its alarm, and once (mutants: no retry; told at every beat)', async () => {
  await withRite(async ({ world, cell, say, at, step }) => {
    const get = world.ROOMS.get;
    let asked = 0;
    world.ROOMS.get = (id) => (id === SOCIAL_ROOM ? { fetch: async () => { asked++; return new Response('no', { status: 503 }); } } : get(id));
    const a = await at('peer-0001');
    await say(a, { s: 1, f: 1 });
    assert.equal(asked, 1);
    assert.equal(cell.store.get(RITE_KEY).told, -1, 'not told');
    assert.ok(cell.alarm.at != null && cell.alarm.at <= Date.now() + RITE_TELL_RETRY_MS, 'a beat to tell it again');
    world.ROOMS.get = get;
    step(RITE_TELL_RETRY_MS);
    await cell.fire();
    assert.equal(cell.store.get(RITE_KEY).told, 1);
    const hub = world.room(SOCIAL_ROOM);
    assert.deepEqual(Object.keys(hub.store.get(RITE_KEY).h), ['acct-peer-0001']);
    step(RITE_TELL_RETRY_MS);
    await cell.fire();
    assert.equal(cell.store.get(RITE_KEY).told, 1, 'and once');
  });
});

test('WB12d relay: the kill asks the hub for the day\'s helpers - a fighter who broke the rite is minted `r`, one who did not none, and one who broke it and took no part in the fight a receipt of the rite alone, kept by the hub for their next hello (mutants: the helpers unasked; r for every fighter; the rite\'s own never minted)', async () => {
  await withRite(async ({ world, say, at, set }) => {
    for (const id of ['peer-0001', 'peer-0003']) { const ws = await at(id); await say(ws, { s: 1 }); }
    const a1 = await at('peer-0001');
    await say(a1, { s: 1, f: 1 });
    set(TT.openAt + 1000);
    const r = world.room(gateRoomKey(DAY));
    const tick = async (n = 1) => { for (let i = 0; i < n; i++) { set(Date.now() + BRAIN_TICK_MS); if (r.alarm.at != null && Date.now() >= r.alarm.at) await r.fire(); } };
    const gsay = (ws, o) => r.raw(ws, JSON.stringify({ t: 'gate', ...o }));
    const f1 = r.connect(); await r.hello(f1, 'peer-0001', court(0, 3));
    const f2 = r.connect(); await r.hello(f2, 'peer-0002', court(2, 3));
    await gsay(f1, { k: 'in', lv: 10, bv: GATE_BRAIN_V });
    await gsay(f2, { k: 'in', lv: 12, bv: GATE_BRAIN_V });
    await tick(2);
    for (const sub of ['acct-peer-0001', 'acct-peer-0002']) r.room._fight.players[sub].stoodMs = 1e9;
    r.room._fight.hp = 1;
    await gsay(f1, { k: 'hit', q: 1, d: 10, r: HIT_KINDS.Spell });
    const mine = (ws) => readReceipt(ws.sent.find((m) => m.t === 'gate' && m.k === 'rcpt')?.r);
    assert.equal(mine(f1).r, 1, 'fought and broke the rite: an ember more');
    assert.equal(mine(f1).x === 'dealt' || mine(f1).x === 'stood', true);
    assert.equal('r' in mine(f2), false, 'fought, never at the circle: none');
    const hub = world.room(SOCIAL_ROOM);
    const kept = hub.store.get(gateReceiptKey('acct-peer-0003'));
    assert.ok(kept, 'the hub keeps the rite\'s own');
    const c = readReceipt(kept.r);
    assert.deepEqual([c.x, c.s, c.d, 'r' in c], ['rite', 'acct-peer-0003', DAY, false]);
    const h3 = hub.connect(); await hub.hello(h3, 'peer-0003');
    assert.equal(readReceipt(h3.sent.find((m) => m.t === 'gate' && m.k === 'rcpt')?.r)?.x, 'rite', 'handed over at their hello');
  });
});
