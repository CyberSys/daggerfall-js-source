// CUSTOMS-GRANT (2026-09-29, Mac: "Please activate ToxicTaco69 character for online mode. He cant access it"). Customs
// admits an offline character only if the census (migrations 0020 and 0022) saw it before the realm began, and the census
// is frozen - that is what keeps a Copy to offline's new id out (AUDIT REALM L1-F5) - so a character the service never saw
// is refused ("The realm has no record of this character from before it opened") and nobody had any way to let it in.
// A grant is a handle on CUSTOMS_GRANT_HANDLES (server-account/wrangler.toml): ONE such character, once, through customs'
// own guarded batch (server-account/src/realm.js customsRealm), its use on the record (migration 0024, `customs_grants`).
// These pins drive the REAL Worker over the REAL migrations (node:sqlite behind a D1-shaped face whose batch is one
// transaction), as test/fb0929_customs.test.js does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { webcrypto } from 'node:crypto';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { REALM_ID_RE, REALM_CHARACTERS_MAX, holdsCustomsGrant } from '../server-account/src/realm.js';
import { r2, freshSave } from './realmSeat.mjs';
import { ACCEPTED } from '../src/net/legalLaw.js';   // TERMS1 (at the merge with main): a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
/** The grant as it ships: the service's own config, read where wrangler reads it. */
const SHIPPED = /^CUSTOMS_GRANT_HANDLES = "([^"]*)"$/m.exec(src('server-account/wrangler.toml'))?.[1];

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
      const st = {
        bind(...a) { args = a; return st; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
        _result() { const results = stmt.all(...args); return { results, meta: { changes: writes ? Number(db.prepare('SELECT changes() AS c').get().c) : 0 } }; },
      };
      return st;
    },
    async batch(list) {
      db.exec('BEGIN');
      try { const out = list.map((st) => st._result()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; }
    },
  };
}

async function stand(vars = {}) {
  _resetKeyForTests();
  const kp = await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await webcrypto.subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*', ...vars };
  const call = async (path, body, secret) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` }, body: JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const put = async (id, text, secret, { lease, seq }) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, {
      method: 'PUT', headers: { authorization: `Bearer ${secret}`, 'x-realm-lease': lease, 'x-realm-seq': String(seq) }, body: text,
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  /** A registered account under `handle` (a grant names people, so a guest can hold none). */
  const account = async (handle) => {
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: JSON.stringify(ACCEPTED) }), env)).json();
    assert.equal((await call('/v1/auth/register', { secret: g.secret, handle, password: 'a good long one', ...ACCEPTED }, g.secret)).status, 200, handle);
    return { id: g.id, secret: g.secret };
  };
  const rows = (sql, ...a) => env.DB._raw.prepare(sql).all(...a).map((r) => ({ ...r }));
  const exec = (sql, ...a) => env.DB._raw.prepare(sql).run(...a);
  /** Customs asked for `origin`, as the Online door's "Bring online" asks it (level 5: an allowance of 70,000). */
  const customs = (who, origin) => call('/v1/realm/customs', { origin, name: 'Taco', summary: { level: 5 } }, who.secret);
  /** The first save customs' answer is written with. */
  const firstSave = (who, came, extra = {}) => put(came.body.id, JSON.stringify(freshSave({ name: 'Taco', level: 5, ...extra })), who.secret, { lease: came.body.lease, seq: 1 });
  /** Customs, and its first save landed - a realm character brought in. */
  const bringIn = async (who, origin) => {
    const came = await customs(who, origin);
    assert.equal(came.status, 200, `${origin} comes in`);
    assert.equal((await firstSave(who, came)).status, 200, `${origin}'s first save lands`);
    return came.body.id;
  };
  return { env, call, account, rows, exec, customs, firstSave, bringIn };
}

test('CUSTOMS-GRANT: the field\'s refusal, reproduced - and the grant as it ships lets ToxicTaco69\'s character in, once, on the record; a second character is the census\'s, and one deleted never comes back', async () => {
  const s = await stand({ CUSTOMS_GRANT_HANDLES: '' });
  const taco = await s.account('ToxicTaco69');
  assert.deepEqual(await s.customs(taco, 'taco-offline-01'), { status: 403, body: { error: 'customs-never-online' } }, 'the census never saw it, and nobody could let it in');
  s.env.CUSTOMS_GRANT_HANDLES = SHIPPED;
  const id = await s.bringIn(taco, 'taco-offline-01');
  assert.match(id, REALM_ID_RE);
  assert.deepEqual(s.rows('SELECT id, origin_id FROM realm_characters'), [{ id, origin_id: 'taco-offline-01' }]);
  const [spent] = s.rows('SELECT player, char_id, at FROM customs_grants');
  assert.deepEqual({ ...spent, at: typeof spent.at }, { player: taco.id, char_id: 'taco-offline-01', at: 'number' }, 'the grant\'s use is on the record: whose, which character, when');
  assert.deepEqual(s.rows('SELECT player, char_id, spent FROM realm_census'), [{ player: taco.id, char_id: 'taco-offline-01', spent: 1 }], 'the census remembers it came in');
  // ONCE: the character again, and another the census never saw - the grant was one character's
  assert.deepEqual(await s.customs(taco, 'taco-offline-01'), { status: 409, body: { error: 'customs-already' } });
  assert.deepEqual(await s.customs(taco, 'taco-offline-02'), { status: 403, body: { error: 'customs-never-online' } }, 'a second character is the census\'s to admit');
  assert.deepEqual(s.rows('SELECT origin_id FROM realm_characters'), [{ origin_id: 'taco-offline-01' }], 'the refused batch made no character...');
  assert.deepEqual(s.rows('SELECT char_id FROM realm_census'), [{ char_id: 'taco-offline-01' }], '...and wrote no census row');
  // deleted, it never comes back - its census row stays spent, and so does the grant
  assert.equal((await s.call('/v1/realm/delete', { id }, taco.secret)).status, 200);
  assert.deepEqual(await s.customs(taco, 'taco-offline-01'), { status: 409, body: { error: 'customs-already' } });
  assert.deepEqual(s.rows('SELECT char_id FROM customs_grants'), [{ char_id: 'taco-offline-01' }]);
});

test('CUSTOMS-GRANT: a character the census counts goes the census\'s way and never spends the grant; a grant never brings in a character that came in anywhere - one character on two granted accounts comes in once - and one counted only on another account comes in and is spent there too', async () => {
  const s = await stand({ CUSTOMS_GRANT_HANDLES: 'ToxicTaco69, CopyHolder1' });
  const taco = await s.account('ToxicTaco69'), other = await s.account('CopyHolder1'), third = await s.account('Bystander1');
  s.exec('INSERT INTO realm_census (player, char_id) VALUES (?, ?)', taco.id, 'counted-01');
  await s.bringIn(taco, 'counted-01');
  assert.deepEqual(s.rows('SELECT * FROM customs_grants'), [], 'the census let it in; the grant is still his');
  // in already, from another account (a copy of it stood on both before the realm): no grant brings it in again
  s.exec('INSERT INTO realm_census (player, char_id, spent) VALUES (?, ?, 1)', third.id, 'crossed-01');
  assert.deepEqual(await s.customs(taco, 'crossed-01'), { status: 409, body: { error: 'customs-already' } });
  assert.deepEqual(s.rows('SELECT * FROM customs_grants'), [], 'a refused grant is not spent');
  // one character on two granted accounts: the first brings it in, the second finds it in and keeps its grant
  await s.bringIn(taco, 'shared-01');
  assert.deepEqual(await s.customs(other, 'shared-01'), { status: 409, body: { error: 'customs-already' } });
  assert.deepEqual(s.rows('SELECT player, char_id FROM customs_grants'), [{ player: taco.id, char_id: 'shared-01' }]);
  // counted only under another account (its traces under an old one), never brought in: the grant brings it, and it is
  // spent on every account, as customs always spends
  s.exec('INSERT INTO realm_census (player, char_id) VALUES (?, ?)', third.id, 'elsewhere-01');
  await s.bringIn(other, 'elsewhere-01');
  assert.deepEqual(s.rows('SELECT player, spent FROM realm_census WHERE char_id = ? ORDER BY player = ?', 'elsewhere-01', other.id), [
    { player: third.id, spent: 1 }, { player: other.id, spent: 1 },
  ]);
  assert.deepEqual(await s.customs(third, 'elsewhere-01'), { status: 409, body: { error: 'customs-already' } });
});

test('CUSTOMS-GRANT: customs still runs in full - the account\'s bound refuses and spends nothing, the allowance holds the first save, and a first save that never landed is taken up again with no second grant', async () => {
  const s = await stand({ CUSTOMS_GRANT_HANDLES: 'ToxicTaco69' });
  const taco = await s.account('ToxicTaco69');
  const born = [];
  for (let i = 0; i < REALM_CHARACTERS_MAX; i++) born.push((await s.call('/v1/realm/create', { name: `Born${i}` }, taco.secret)).body.id);
  assert.deepEqual(await s.customs(taco, 'taco-offline-01'), { status: 409, body: { error: 'too-many-characters' } });
  assert.deepEqual([s.rows('SELECT * FROM customs_grants'), s.rows('SELECT * FROM realm_census')], [[], []], 'nothing spent, nothing written');
  assert.equal((await s.call('/v1/realm/delete', { id: born[0] }, taco.secret)).status, 200);
  const came = await s.customs(taco, 'taco-offline-01');
  assert.equal(came.status, 200);
  // the grant opens the door, not the purse: past the allowance at the level customs was asked at, the first save is refused
  assert.deepEqual(await s.firstSave(taco, came, { goldPieces: 1_000_000 }), { status: 403, body: { error: 'customs-allowance' } });
  // "Bring it online again": the same row taken up again under a new lease - the grant is not asked twice
  const again = await s.customs(taco, 'taco-offline-01');
  assert.deepEqual([again.status, again.body.id, again.body.resumed], [200, came.body.id, true]);
  assert.equal((await s.firstSave(taco, again)).status, 200);
  assert.deepEqual(s.rows('SELECT char_id FROM customs_grants'), [{ char_id: 'taco-offline-01' }]);
});

test('CUSTOMS-GRANT: who holds one - a handle on the list, read as every handle list is (case and spaces), never a guest; a handle taken off before its grant is spent holds none from the next call', async () => {
  const env = { CUSTOMS_GRANT_HANDLES: ' toxictaco69 ,  Someone_Else ' };
  assert.equal(holdsCustomsGrant({ handle: 'ToxicTaco69' }, env), true);
  assert.equal(holdsCustomsGrant({ handle: 'someone_else' }, env), true);
  assert.equal(holdsCustomsGrant({ handle: 'ToxicTaco' }, env), false, 'a handle, never a prefix');
  assert.equal(holdsCustomsGrant({ handle: null }, env), false, 'a guest holds none - the list names people');
  assert.equal(holdsCustomsGrant(null, env), false);
  assert.equal(holdsCustomsGrant({ handle: 'ToxicTaco69' }, {}), false);
  assert.equal(holdsCustomsGrant({ handle: 'ToxicTaco69' }, { CUSTOMS_GRANT_HANDLES: '' }), false);
  const s = await stand({ CUSTOMS_GRANT_HANDLES: 'ToxicTaco69' });
  const taco = await s.account('ToxicTaco69');
  s.env.CUSTOMS_GRANT_HANDLES = 'SomebodyElse';
  assert.deepEqual(await s.customs(taco, 'taco-offline-01'), { status: 403, body: { error: 'customs-never-online' } });
  assert.deepEqual(s.rows('SELECT * FROM customs_grants'), []);
});

test('CUSTOMS-GRANT: Mac\'s grant is the config\'s - ToxicTaco69 on CUSTOMS_GRANT_HANDLES, inside the service\'s own [vars], where wrangler binds it', () => {
  const toml = src('server-account/wrangler.toml');
  const vars = toml.slice(toml.indexOf('\n[vars]\n'), toml.indexOf('\n[[d1_databases]]\n'));
  assert.ok(vars.length > 0);
  assert.match(vars, /^CUSTOMS_GRANT_HANDLES = "ToxicTaco69"$/m);
  assert.equal(SHIPPED, 'ToxicTaco69');
});
