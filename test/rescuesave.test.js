// RESCUE-SAVE (2026-09-30, the outage: SwordsmanEB lost progress; Mac: "Do it") - A SAVE THE SERVICE HAS NOT TAKEN IS
// KEPT ON THE DEVICE. A realm character's save lived in the playing session's memory until a put landed: a page closed,
// reloaded or exited while the service was away took everything since the last checkpoint that landed, and so did an
// ordinary close whose keepalive leave landed ahead of the page's checkpoint (the checkpoint then refused `lease`).
// Now every save the session takes is on the device first (systems/realmSaves.js keepUnsent), with the sequence it
// follows; a put that lands with nothing newer behind it drops it; and a join whose record still stands at that
// sequence plays it (openRealmBoot `restored`) - a record that moved past it (another device, a trade, an act) drops it
// unread, so the copy never writes over anything the service holds.
// Real modules throughout: realmSaves.js over the REAL account Worker and migrations (test/realm2.test.js's device).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { REALM_MAX_BYTES } from '../server-account/src/realm.js';
import { SESSION_KEY } from '../src/net/accountClient.js';
import {
  realmIo, realmCreate, realmPut, realmFetch, realmLeave, realmDelete, openRealmBoot, createRealmSession,
  readUnsent, keepUnsent, forgetUnsent, REALM_UNSENT_PREFIX, REALM_RESTORED_TEXT,
} from '../src/systems/realmSaves.js';
import { r2, freshSave, layRecord } from './realmSeat.mjs';
import { ACCEPTED } from '../src/net/legalLaw.js';
import * as acorn from 'acorn';
import { createSpoilsPool, spoilsStore, recoverSpoils, SPOILS_STORE_KEY, SPOILS_TEXT } from '../src/scenes/spoilsPool.js';
import { raidSpoilsList, raidSpoilsDay, RAID_SPOILS_KEYS, RAID_SPOILS_TEXT, RAID_SPOILS_RECORDS_MAX } from '../src/systems/raidSpoils.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      const writes = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return api;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}
function fakeStorage() {
  const m = new Map();
  return { _map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
}
/** One account on the service, and its devices: each its own storage and its own door, the same Worker behind them.
 *  `door.plan` is a queue of per-request modes ('ok', 'offline' - the service away); empty is 'ok'. */
async function account() {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1' };
  const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
  const device = (storage = fakeStorage()) => {
    storage.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
    const door = { plan: [] };
    const fetch = async (url, init) => {
      const mode = door.plan.length ? door.plan.shift() : 'ok';
      if (mode === 'offline') throw new TypeError('network');
      return worker.fetch(new Request(url, init), env);
    };
    return { storage, door, io: realmIo({ fetch, storage }) };
  };
  return { env, device };
}
/** A realm character saved at 1 and joined as a boot joins it, on `dev`: its session, and the service's row and save. */
async function joined(acct, dev, save = { v: 1, name: 'SwordsmanEB', level: 12, goldPieces: 100 }) {
  const made = (await realmCreate(dev.io, 'SwordsmanEB')).data;
  assert.equal((await realmPut(dev.io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify(freshSave({ name: 'SwordsmanEB' })))).ok, true);
  layRecord(acct.env, made.id, save);
  const boot = await openRealmBoot({ io: dev.io, id: made.id });
  const lost = [];
  const session = createRealmSession({ io: dev.io, id: made.id, lease: boot.lease, seq: boot.seq, onLost: (why) => lost.push(why) });
  const row = () => acct.env.DB._raw.prepare('SELECT seq, lease FROM realm_characters WHERE id = ?').get(made.id);
  return { id: made.id, session, lost, row, served: async () => JSON.parse((await realmFetch(dev.io, made.id)).text) };
}
const save = (level, gold) => ({ v: 1, name: 'SwordsmanEB', level, goldPieces: gold });

test('RESCUE-SAVE: THE OUTAGE - a save the service never took is kept on the device, and the next join plays it and gives it to the service', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  // a checkpoint that lands leaves nothing on the device
  assert.deepEqual(await c.session.checkpoint(JSON.stringify(save(13, 500))), { ok: true, seq: 2 });
  assert.equal(readUnsent(dev.storage, c.id), null, 'landed: the device keeps no copy');
  // the service goes away: the newest save waits - in the page's memory, and now on the device, at the sequence it follows
  dev.door.plan = ['offline'];
  assert.equal((await c.session.checkpoint(JSON.stringify(save(15, 9000)))).ok, false);
  assert.deepEqual({ ...readUnsent(dev.storage, c.id), at: null }, { seq: 2, text: JSON.stringify(save(15, 9000)), at: null, held: [] });
  // the page goes (the keepalive leave alone, as world.js whenPageGoes sends it) - before RESCUE-SAVE, levels 13-15 went with it
  await c.session.leave({ keepalive: true });
  assert.equal(c.row().lease, null, 'the lease given up');
  assert.equal((await c.served()).level, 13, 'the service never took the save');
  // the next boot: the record still stands at 2, so the device's copy is newer than anything the service holds
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.ok, true);
  assert.equal(boot.restored, true);
  assert.equal(boot.seq, 2);
  assert.deepEqual(boot.snap, { ...save(15, 9000), characterId: c.id });
  assert.equal(c.row().lease, boot.lease, 'joined under a new lease');
  // its first checkpoint gives it to the service, and the device's copy goes
  const s = createRealmSession({ io: dev.io, id: c.id, lease: boot.lease, seq: boot.seq });
  assert.deepEqual(await s.checkpoint(JSON.stringify(boot.snap)), { ok: true, seq: 3 });
  assert.equal(readUnsent(dev.storage, c.id), null);
  assert.equal((await c.served()).level, 15, 'the service holds the rescued save');
  // and a boot after it plays the service's, with nothing restored
  const again = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(again.restored, undefined);
  assert.equal(again.snap.level, 15);
});

test('RESCUE-SAVE: THE ORDINARY CLOSE - the keepalive leave landed ahead of the page\'s checkpoint, refused `lease`: kept, and played at the next join', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  const lease = c.row().lease;
  // the page's leave, sent with keepalive as it goes, reaches the service first...
  assert.equal((await realmLeave(dev.io, c.id, lease, { keepalive: true })).ok, true);
  // ...and the checkpoint the hidden page sent is refused for the lease it no longer holds
  assert.deepEqual(await c.session.checkpoint(JSON.stringify(save(14, 2000))), { ok: false, error: 'lease' });
  assert.deepEqual(c.lost, ['lease']);
  assert.equal(readUnsent(dev.storage, c.id)?.seq, 1, 'kept: the record still stands where the save follows');
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, true);
  assert.equal(boot.snap.level, 14);
});

test('RESCUE-SAVE: A RECORD MOVED PAST THE COPY - another device played on and saved - drops it unread: the service\'s save is played', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(20, 1)));
  assert.equal(readUnsent(dev.storage, c.id)?.seq, 1);
  // the same account on another device: joined (this tab's lease taken) and a checkpoint landed there
  const other = acct.device();
  const theirs = await openRealmBoot({ io: other.io, id: c.id });
  assert.equal(theirs.restored, undefined, 'the other device keeps no copy of this one\'s');
  const s = createRealmSession({ io: other.io, id: c.id, lease: theirs.lease, seq: theirs.seq });
  assert.equal((await s.checkpoint(JSON.stringify(save(13, 777)))).ok, true);
  // back on the first device: the record stands at 2, past the copy's 1 - never written over
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, undefined);
  assert.equal(boot.snap.level, 13);
  assert.equal(readUnsent(dev.storage, c.id), null, 'dropped');
});

test('RESCUE-SAVE: a put that lands with a newer save waiting keeps that one, at the sequence the service now holds', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['ok', 'offline'];
  const first = c.session.checkpoint(JSON.stringify(save(13, 1)));   // leaves at once
  const second = c.session.checkpoint(JSON.stringify(save(14, 2)));   // waits behind it
  assert.deepEqual(await first, { ok: true, seq: 2 });
  assert.equal((await second).ok, false);
  assert.deepEqual({ ...readUnsent(dev.storage, c.id), at: null }, { seq: 2, text: JSON.stringify(save(14, 2)), at: null, held: [] }, 'the newer save, following the one that landed');
  await c.session.leave({ keepalive: true });
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, true);
  assert.equal(boot.snap.level, 14);
});

test('RESCUE-SAVE: a save held behind a trade or a gold act is never kept - its goods are in flight', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  let release = () => {};
  const gate = new Promise((r) => { release = r; });
  const act = c.session.transact(async () => { await gate; return { ok: true }; });
  assert.deepEqual(await c.session.checkpoint(JSON.stringify(save(99, 99999))), { ok: false, error: 'held' });
  assert.equal(readUnsent(dev.storage, c.id), null);
  release();
  assert.equal((await act).ok, true);
});

test('RESCUE-SAVE: a copy no join may play is dropped - the record moved (`seq`), or the service will never take it (`too-large`)', async () => {
  const acct = await account();
  // the record moved under the session's lease (an act this tab never made): refused `seq`, and the copy with it
  const dev = acct.device();
  const c = await joined(acct, dev);
  acct.env.DB._raw.prepare('UPDATE realm_characters SET seq = seq + 1 WHERE id = ?').run(c.id);
  assert.equal((await c.session.checkpoint(JSON.stringify(save(13, 1)))).error, 'seq');
  assert.equal(readUnsent(dev.storage, c.id), null);
  // a save past the service's bound: every join would play it and every checkpoint refuse it - never kept past the refusal
  const dev2 = acct.device();
  const d = await joined(acct, dev2);
  assert.equal((await d.session.checkpoint('x'.repeat(REALM_MAX_BYTES + 1))).error, 'too-large');
  assert.equal(readUnsent(dev2.storage, d.id), null);
});

test('RESCUE-SAVE: the player\'s own delete drops the copy', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(13, 1)));
  assert.ok(readUnsent(dev.storage, c.id));
  await c.session.leave({ keepalive: true });
  assert.equal((await realmDelete(dev.io, c.id)).ok, true);
  assert.equal(readUnsent(dev.storage, c.id), null);
});

test('RESCUE-SAVE: a device with no room keeps nothing half-written, and the checkpoint still goes', async () => {
  const acct = await account();
  const storage = fakeStorage();
  const set = storage.setItem;
  // the save's text fits and its record does not: the text written must not stay behind without it
  storage.setItem = (k, v) => { if (String(k).startsWith(REALM_UNSENT_PREFIX) && String(k).endsWith('.at')) throw new Error('QuotaExceededError'); set(k, v); };
  const dev = acct.device(storage);
  const c = await joined(acct, dev);
  assert.deepEqual(await c.session.checkpoint(JSON.stringify(save(13, 1))), { ok: true, seq: 2 });
  assert.deepEqual([...storage._map.keys()].filter((k) => k.startsWith(REALM_UNSENT_PREFIX)), []);
  // and with the service away, the text written before its record failed goes at once - never a save-sized orphan no
  // join can read, holding the device's room until some later put lands
  dev.door.plan = ['offline'];
  assert.equal((await c.session.checkpoint(JSON.stringify(save(14, 2)))).ok, false);
  assert.deepEqual([...storage._map.keys()].filter((k) => k.startsWith(REALM_UNSENT_PREFIX)), []);
  // and the law of the copy itself: no sequence before the first save, no storage, no text - nothing kept
  const s = fakeStorage();
  assert.equal(keepUnsent(s, c.id, 0, '{}'), false);
  assert.equal(keepUnsent(null, c.id, 3, '{}'), false);
  assert.equal(keepUnsent(s, c.id, 3, ''), false);
  assert.equal(keepUnsent(s, c.id, 3, '{"v":1}'), true);
  forgetUnsent(s, c.id);
  assert.equal(s._map.size, 0);
});

test('RESCUE-SAVE: the world host says it once the world stands, beside the realm\'s other boot words', () => {
  const w = src('src/scenes/world.js');
  const said = w.indexOf('if (realmBoot?.restored) townTalk.say(REALM_RESTORED_TEXT);');
  assert.ok(said > 0, 'the host says the restore');
  assert.ok(Math.abs(said - w.indexOf('if (realmRefused) townTalk.say(REALM_OFFLINE_TEXT);')) < 400, 'beside REALM P1.3\'s own boot word');
  assert.match(REALM_RESTORED_TEXT, /this device kept it/i);
});

// ═══ AUDIT RESCUE-SAVE (2026-09-30, Mac: "Audit this") ═══════════════════════════════════════════════════════════════
// A1 - A KEPT SAVE HOLDS THE SPOILS IT WAS COMPOSED HOLDING. A gate's spoils and a town's thanks go into the pack with a
// device record the crash's door hands back at every boot until a save holding them lands (scenes/spoilsPool.js
// recoverSpoils; REALM P1.3's `landed` hook). A checkpoint composed holding them that never landed was the device's copy,
// and the join played it - so the pack held them AND the door handed them again: every piece twice. The copy now keeps
// the records its save holds (`held`), the boot answers them, and the door adopts those records without handing a piece;
// the save that lands clears them. A copy the join drops leaves the records to be handed as before - nothing lost.

/** world.js's own statements, sliced (test/auditrealm2_client.test.js's harness). */
function sliced(rel) {
  const S = src(rel);
  const AST = acorn.parse(S, { ecmaVersion: 'latest', sourceType: 'module' });
  const all = (pred) => {
    const hits = [];
    (function walk(n) {
      if (!n || typeof n.type !== 'string') return;
      if (pred(n)) hits.push(n);
      for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
    })(AST);
    return hits;
  };
  const text = (n) => S.slice(n.start, n.end);
  const one = (hits, what) => { assert.equal(hits.length, 1, `${rel}: ${what} (${hits.length} found)`); return text(hits[0]); };
  const decl = (name) => one(all((n) => n.type === 'VariableDeclaration' && n.declarations.some((d) => d.id?.name === name)), `the declaration of ${name}`);
  const top = (host, has) => {
    const h = all((n) => n.type === 'FunctionDeclaration' && n.id?.name === host);
    assert.equal(h.length, 1, `${rel}: function ${host}`);
    return one(h[0].body.body.filter((st) => text(st).includes(has)), `${host}'s statement holding ${has}`);
  };
  return { decl, top };
}
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
// eslint-disable-next-line no-new-func
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const W = sliced('src/scenes/world.js');

/** One boot of the world host's realm half over `dev`'s storage: the realm save sink, both spoils pools and their hooks,
 *  and the crash's door as the host's stand-up asks it - every one of them world.js's own statement. */
function hostBoot(dev, R, realmSession, realmBoot) {
  const pack = { gold: 0, items: [] };
  const takeSpoil = (p) => { if (p.kind === 'gold') pack.gold += p.gold; else pack.items.push(p.item); };
  let sink = null;
  const said = [];
  const host = mount(`
    const _realmSaveHooks = { held: () => null, landed: () => {} };
    ${W.top('bootWorld', 'if (realmSession) setRealmSaveSink(')}
    const spoilsPool = createSpoilsPool({ ray: () => null, now: () => 1, take: takeSpoil, store: _spoilsStore, who: () => characterIdOf(playerEntity) });
    const raidSpoils = createSpoilsPool({ ray: () => null, now: () => 1, take: takeSpoil, store: _spoilsStore, who: () => characterIdOf(playerEntity), keys: RAID_SPOILS_KEYS, recordsMax: RAID_SPOILS_RECORDS_MAX });
    ${W.top('bootWorld', '_realmSaveHooks.held = ')}
    ${W.top('bootWorld', '_realmSaveHooks.landed = ')}
    ${W.decl('_spoilsAskedFor')}
    ${W.decl('_spoilsInSave')}
    ${W.decl('spoilsRecoverFrame')}
    spoilsRecoverFrame();
    return { spoilsPool, raidSpoils };
  `, {
    realmSession, realmBoot, playerSpawned: true,
    setRealmSaveSink: (f) => { sink = f; },
    characterIdOf: () => R, realmSummaryOf: () => null, playerEntity: {},
    createSpoilsPool, recoverSpoils, RAID_SPOILS_KEYS, RAID_SPOILS_RECORDS_MAX, SPOILS_TEXT, RAID_SPOILS_TEXT, takeSpoil,
    _spoilsStore: spoilsStore(dev.storage), enumerateSaves: () => ({ info: new Map() }), setMidScreenText: (t) => said.push(t),
    console: { warn() {} },
  });
  return { ...host, pack, said, save: (snap) => sink(snap) };
}
const settle = async () => { for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 0)); };

test('AUDIT RESCUE-SAVE A1: a kept save holds the spoils it was composed holding - the join plays it and the crash\'s door adopts their records, handing no piece twice; the save that lands clears them (mutants: nothing held with the copy, the door hands them anyway, the host never asks)', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  const one = hostBoot(dev, c.id, c.session, null);
  assert.deepEqual([one.pack.gold, one.pack.items.length], [0, 0], 'a first boot: nothing on the device');
  // a town defended and a boss's spoils: in the pack, and on the device until a save holding them lands
  assert.equal(one.raidSpoils.grant({ day: raidSpoilsDay('k:1:40:7'), acct: 'acct-a', roll: () => raidSpoilsList(0xC0FFEE, 30, 2), text: RAID_SPOILS_TEXT.granted, owner: c.id }), true);
  assert.equal(one.spoilsPool.grant({ day: 700, seed: 99, level: 30, acct: 'acct-a' }), true);
  const got = { gold: one.pack.gold, items: one.pack.items.length };
  assert.ok(got.gold > 0 && got.items > 0);
  // the two-minute checkpoint, composed holding both - and the service away
  dev.door.plan = ['offline'];
  one.save({ v: 1, name: 'SwordsmanEB', level: 12, pack: got });
  await settle();
  const kept = readUnsent(dev.storage, c.id);
  assert.equal(kept.held.length, 2, 'the copy keeps both records its save holds');
  assert.ok(dev.storage.getItem(SPOILS_STORE_KEY) && dev.storage.getItem(RAID_SPOILS_KEYS.store), 'and both records stay on the device: unlanded');
  await c.session.leave({ keepalive: true });
  // the next boot plays the copy, whose pack holds them: the door hands nothing
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, true);
  assert.deepEqual(boot.held, kept.held);
  assert.deepEqual(boot.snap.pack, got, 'the kept save holds the spoils');
  const s = createRealmSession({ io: dev.io, id: c.id, lease: boot.lease, seq: boot.seq });
  const two = hostBoot(dev, c.id, s, boot);
  assert.deepEqual([two.pack.gold, two.pack.items.length], [0, 0], 'no piece handed twice');
  assert.deepEqual(two.said, [], 'and nothing said gathered');
  assert.deepEqual([...two.spoilsPool.heldIds(c.id), ...two.raidSpoils.heldIds(c.id)].sort(), [...kept.held].sort(), 'adopted: the next save holds them');
  // the restored save's first checkpoint lands: the records go, and the copy with them
  two.save(boot.snap);
  await settle();
  assert.equal(dev.storage.getItem(SPOILS_STORE_KEY), null);
  assert.equal(dev.storage.getItem(RAID_SPOILS_KEYS.store), null);
  assert.equal(readUnsent(dev.storage, c.id), null);
});

test('AUDIT RESCUE-SAVE A1: a copy the join drops leaves its records to the crash\'s door, which hands them into the service\'s save - nothing lost', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  const one = hostBoot(dev, c.id, c.session, null);
  one.spoilsPool.grant({ day: 701, seed: 7, level: 30, acct: 'acct-a' });
  const got = one.pack.items.length + one.pack.gold;
  dev.door.plan = ['offline'];
  one.save({ v: 1, name: 'SwordsmanEB', level: 12 });
  await settle();
  assert.equal(readUnsent(dev.storage, c.id).held.length, 1);
  await c.session.leave({ keepalive: true });
  // another device plays on and saves: the record moved past the copy
  const other = acct.device();
  const theirs = await openRealmBoot({ io: other.io, id: c.id });
  assert.equal((await createRealmSession({ io: other.io, id: c.id, lease: theirs.lease, seq: theirs.seq }).checkpoint(JSON.stringify(save(13, 5)))).ok, true);
  const boot = await openRealmBoot({ io: dev.io, id: c.id });
  assert.equal(boot.restored, undefined, 'the copy dropped');
  const two = hostBoot(dev, c.id, createRealmSession({ io: dev.io, id: c.id, lease: boot.lease, seq: boot.seq }), boot);
  assert.equal(two.pack.items.length + two.pack.gold, got, 'the spoils handed into the service\'s save, once');
});

test('AUDIT RESCUE-SAVE A2: a character deleted from another device takes this device\'s copy with it at the next join - no copy outlives its character', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(13, 1)));
  await c.session.leave({ keepalive: true });
  assert.ok(readUnsent(dev.storage, c.id));
  const other = acct.device();
  assert.equal((await realmDelete(other.io, c.id)).ok, true);
  assert.deepEqual(await openRealmBoot({ io: dev.io, id: c.id }), { ok: false, error: 'no-realm-character' });
  assert.equal(readUnsent(dev.storage, c.id), null);
});

test('AUDIT RESCUE-SAVE A1: the title exit sends the waiting save once more - and a copy kept again keeps the records its save holds', async () => {
  const acct = await account();
  const dev = acct.device();
  const c = await joined(acct, dev);
  dev.door.plan = ['offline'];
  await c.session.checkpoint(JSON.stringify(save(13, 1)), null, ['700::1', 'raid:k:1:40:7::2']);
  assert.deepEqual(readUnsent(dev.storage, c.id).held, ['700::1', 'raid:k:1:40:7::2']);
  // the pause menu's Exit (world.js setBeforeTitleExit): the waiting save sent again, and the service still away
  dev.door.plan = ['offline'];
  await c.session.leave();
  assert.deepEqual(readUnsent(dev.storage, c.id).held, ['700::1', 'raid:k:1:40:7::2'], 'kept with it: never dropped by the resend');
  // and the copy's record bounds what it keeps: strings only, sixty-four at most
  keepUnsent(dev.storage, c.id, 3, '{"v":1}', ['a', 7, null, 'x'.repeat(129), ...Array.from({ length: 80 }, (_, i) => `k${i}`)]);
  const h = readUnsent(dev.storage, c.id).held;
  assert.equal(h.length, 64);
  assert.equal(h[0], 'a');
  assert.ok(h.every((x) => typeof x === 'string' && x.length <= 128));
});
