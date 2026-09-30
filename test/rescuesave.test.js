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
  assert.deepEqual({ ...readUnsent(dev.storage, c.id), at: null }, { seq: 2, text: JSON.stringify(save(15, 9000)), at: null });
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
  assert.deepEqual({ ...readUnsent(dev.storage, c.id), at: null }, { seq: 2, text: JSON.stringify(save(14, 2)), at: null }, 'the newer save, following the one that landed');
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
  storage.setItem = (k, v) => { if (String(k).startsWith(REALM_UNSENT_PREFIX) && !String(k).endsWith('.at')) throw new Error('QuotaExceededError'); set(k, v); };
  const dev = acct.device(storage);
  const c = await joined(acct, dev);
  assert.deepEqual(await c.session.checkpoint(JSON.stringify(save(13, 1))), { ok: true, seq: 2 });
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
