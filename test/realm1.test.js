// REALM P1 (2026-09-28, Mac: "A true separation while allowing people to still play offline"; asked where an online
// character's save lives: "Account service"): THE REALM'S CHARACTERS, SERVICE SIDE (server-account/src/realm.js,
// migration 0016). These pins drive the REAL Worker over the REAL migrations (node:sqlite behind a D1-shaped face and
// R2's three calls, as test/cloudsaves.test.js does): a realm character is minted by the service, joined under a lease
// that takes it from any other tab, checkpointed only under that lease at the next sequence, left, deleted, copied
// back, and brought in once from offline through customs when it has played online before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { ROUTES, realmPathOf, ACCOUNT_VERSION } from '../server-account/src/service.js';
import {
  REALM_CHARACTERS_MAX, REALM_ID_RE, LEASE_RE, REALM_MAX_BYTES, REALM_PLAYING_S, realmKey, realmPrefix, realmSummaryOf, realmNameOf,
} from '../server-account/src/realm.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();

function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  for (const f of MIGRATIONS) db.exec(src(`server-account/migrations/${f}`));
  return {
    _raw: db,
    prepare(sql) {
      const stmt = db.prepare(sql);
      let args = [];
      const api = {
        bind(...a) { args = a; return api; },
        async first() { return stmt.get(...args) ?? null; },
        async all() { return { results: stmt.all(...args) }; },
        async run() { const r = stmt.run(...args); return { meta: { changes: Number(r.changes) } }; },
      };
      return api;
    },
  };
}
function r2() {
  const m = new Map();
  return {
    _map: m,
    async put(key, body) { m.set(key, new Uint8Array(body instanceof ArrayBuffer ? body : new TextEncoder().encode(String(body)))); return { key }; },
    async get(key) { const v = m.get(key); return v === undefined ? null : { key, size: v.byteLength, body: v }; },
    async delete(key) { m.delete(key); },
  };
}

async function stand() {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: 'https://daggerfalljs.dev' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  /** A checkpoint: the save raw, the lease, the sequence and the tile in headers. */
  const put = async (id, bytes, bearer, { lease, seq, summary = null }) => {
    const headers = { authorization: `Bearer ${bearer}`, 'x-realm-lease': lease ?? '', 'x-realm-seq': String(seq) };
    if (summary) headers['x-realm-summary'] = JSON.stringify(summary);
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, { method: 'PUT', headers, body: bytes }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const get = async (id, bearer) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, { method: 'GET', headers: { authorization: `Bearer ${bearer}` } }), env);
    const ct = res.headers.get('content-type') ?? '';
    return {
      status: res.status, seq: res.headers.get('x-realm-seq'), expose: res.headers.get('access-control-expose-headers'),
      json: ct.includes('json') ? await res.json().catch(() => null) : null,
      bytes: ct.includes('json') ? null : new Uint8Array(await res.arrayBuffer()),
    };
  };
  const guest = async () => (await call('POST', '/v1/auth/guest', {})).body;
  return { env, call, put, get, guest };
}
const save = (text) => new TextEncoder().encode(text);

test('REALM P1: the routes are the service\'s, behind a session and never open - a guest holds realm characters too; acct17 and the toml in step', async () => {
  for (const r of ['/v1/realm', '/v1/realm/create', '/v1/realm/customs', '/v1/realm/join', '/v1/realm/leave', '/v1/realm/delete']) assert.ok(ROUTES.has(r), r);
  assert.deepEqual(realmPathOf('/v1/realm/r0123456789abcdef0123/data'), { id: 'r0123456789abcdef0123' });
  assert.equal(realmPathOf('/v1/realm/c0ffee00-1111/data'), null, 'a client\'s id is no realm id');
  assert.equal(realmPathOf('/v1/realm/r0123456789abcdef0123/shot'), null);
  assert.equal(ACCOUNT_VERSION, 'acct17');
  assert.match(src('server-account/wrangler.toml'), /ACCOUNT_VERSION = "acct17"/);
  const { call, guest } = await stand();
  assert.equal((await call('GET', '/v1/realm')).status, 401, 'no secret, no characters');
  const g = await guest();
  const listed = await call('GET', '/v1/realm', undefined, g.secret);
  assert.deepEqual([listed.status, listed.body], [200, { characters: [], max: REALM_CHARACTERS_MAX }]);
  assert.equal((await call('GET', '/v1/realm/create', undefined, g.secret)).status, 405);
});

test('REALM P1: a new character is the service\'s - its id and lease minted there, at sequence 0 with no save; six an account, the seventh refused and nothing deleted', async () => {
  const { call, guest } = await stand();
  const g = await guest();
  const made = await call('POST', '/v1/realm/create', { name: '  Nystul  ', summary: { level: 1, className: 'Spellsword', race: 'Breton', gender: 'male', face: 3, secret: 'x' } }, g.secret);
  assert.equal(made.status, 200);
  assert.match(made.body.id, REALM_ID_RE);
  assert.match(made.body.lease, LEASE_RE);
  assert.equal(made.body.seq, 0);
  const [row] = (await call('GET', '/v1/realm', undefined, g.secret)).body.characters;
  assert.equal(row.id, made.body.id);
  assert.equal(row.name, 'Nystul', 'trimmed');
  assert.deepEqual(row.summary, { level: 1, className: 'Spellsword', race: 'Breton', gender: 'male', face: 3, region: null }, 'the tile\'s fields and nothing else');
  assert.deepEqual([row.seq, row.bytes, row.playing, row.customs], [0, 0, true, false]);
  assert.equal('lease' in row, false, 'the lease is never listed');
  assert.equal((await call('POST', '/v1/realm/create', { name: '' }, g.secret)).status, 400);
  assert.equal((await call('POST', '/v1/realm/create', { name: 'Bad\u0007' }, g.secret)).status, 400);
  for (let i = 1; i < REALM_CHARACTERS_MAX; i++) assert.equal((await call('POST', '/v1/realm/create', { name: `Alt ${i}` }, g.secret)).status, 200);
  const over = await call('POST', '/v1/realm/create', { name: 'One Too Many' }, g.secret);
  assert.deepEqual([over.status, over.body], [409, { error: 'too-many-characters' }]);
  assert.equal((await call('GET', '/v1/realm', undefined, g.secret)).body.characters.length, REALM_CHARACTERS_MAX);
});

test('REALM P1: a checkpoint lands only under the current lease at the next sequence; the save alternates, so the one before survives; the tile rides along', async () => {
  const { env, call, put, get, guest } = await stand();
  const g = await guest();
  const { id, lease } = (await call('POST', '/v1/realm/create', { name: 'Nystul' }, g.secret)).body;
  assert.deepEqual((await get(id, g.secret)).json, { error: 'no-data' }, 'no save before the first checkpoint');
  const one = await put(id, save('save one'), g.secret, { lease, seq: 1, summary: { level: 2, className: 'Spellsword' } });
  assert.deepEqual([one.status, one.body], [200, { ok: true, seq: 1 }]);
  const read = await get(id, g.secret);
  assert.deepEqual([read.status, read.seq, new TextDecoder().decode(read.bytes)], [200, '1', 'save one']);
  assert.equal(read.expose, 'x-realm-seq', 'the browser may read the sequence');
  assert.deepEqual((await put(id, save('again'), g.secret, { lease, seq: 1 })).body, { error: 'seq', seq: 1 }, 'a replay - told the service\'s own');
  assert.deepEqual((await put(id, save('ahead'), g.secret, { lease, seq: 3 })).body, { error: 'seq', seq: 1 }, 'a skip');
  assert.equal((await put(id, save('ahead'), g.secret, { lease, seq: 3 })).status, 409);
  assert.deepEqual((await put(id, save('forged'), g.secret, { lease: 'f'.repeat(32), seq: 2 })).body, { error: 'lease' });
  assert.equal((await put(id, save('shapeless'), g.secret, { lease: 'nope', seq: 2 })).status, 400);
  assert.equal((await put(id, new Uint8Array(0), g.secret, { lease, seq: 2 })).status, 400, 'an empty save');
  assert.equal((await put(id, new Uint8Array(REALM_MAX_BYTES + 1), g.secret, { lease, seq: 2 })).status, 413);
  assert.deepEqual([...env.SAVES._map.keys()], [realmKey(g.id, id, 1)], 'a refused checkpoint writes nothing - the stale lease is refused before a byte lands');
  assert.equal((await put(id, save('save two'), g.secret, { lease, seq: 2 })).status, 200);
  const keys = [...env.SAVES._map.keys()];
  assert.deepEqual(keys.sort(), [realmKey(g.id, id, 1), realmKey(g.id, id, 2)].sort(), 'two objects, alternating');
  assert.deepEqual(keys.sort(), [`realm/${encodeURIComponent(g.id)}/${id}/0`, `realm/${encodeURIComponent(g.id)}/${id}/1`], 'by parity, the player first');
  assert.ok(keys.every((k) => k.startsWith(realmPrefix(g.id))), 'under the account\'s prefix');
  assert.equal(new TextDecoder().decode(env.SAVES._map.get(realmKey(g.id, id, 1))), 'save one', 'the one before survives');
  const [row] = (await call('GET', '/v1/realm', undefined, g.secret)).body.characters;
  assert.deepEqual([row.seq, row.bytes, row.summary.level], [2, 8, 2], 'a checkpoint without a tile keeps the last one');
});

test('REALM P1: a join takes the character from any other tab, and one account plays one character - the tab that lost the lease can never write again', async () => {
  const { call, put, guest } = await stand();
  const g = await guest();
  const a = (await call('POST', '/v1/realm/create', { name: 'Nystul' }, g.secret)).body;
  assert.equal((await put(a.id, save('a1'), g.secret, { lease: a.lease, seq: 1 })).status, 200);
  const second = await call('POST', '/v1/realm/join', { id: a.id }, g.secret);
  assert.deepEqual([second.status, second.body.seq, second.body.bytes], [200, 1, 2]);
  assert.notEqual(second.body.lease, a.lease, 'a new lease');
  const out = await put(a.id, save('old tab'), g.secret, { lease: a.lease, seq: 2 });
  assert.deepEqual([out.status, out.body], [409, { error: 'lease' }], 'the old tab is out');
  assert.equal((await put(a.id, save('new tab'), g.secret, { lease: second.body.lease, seq: 2 })).status, 200);
  // a second character of the same account frees the first
  const b = (await call('POST', '/v1/realm/create', { name: 'Alt' }, g.secret)).body;
  assert.deepEqual((await put(a.id, save('a3'), g.secret, { lease: second.body.lease, seq: 3 })).body, { error: 'lease' }, 'one character in play an account');
  const rows = (await call('GET', '/v1/realm', undefined, g.secret)).body.characters;
  assert.deepEqual(rows.map((r) => [r.name, r.playing]).sort(), [['Alt', true], ['Nystul', false]]);
  // and a join frees the account's other character as a creation does
  const back = await call('POST', '/v1/realm/join', { id: a.id }, g.secret);
  assert.equal((await put(b.id, save('b1'), g.secret, { lease: b.lease, seq: 1 })).status, 409, 'the alt is out');
  assert.equal((await put(a.id, save('a3'), g.secret, { lease: back.body.lease, seq: 3 })).status, 200);
  assert.equal((await call('POST', '/v1/realm/join', { id: 'r' + '0'.repeat(20) }, g.secret)).status, 404);
  assert.equal((await call('POST', '/v1/realm/join', { id: 'c0ffee00' }, g.secret)).status, 400);
  assert.ok(b.id);
});

test('REALM P1: a leave gives the lease up - only the tab that holds it; another account can neither read, join, write nor delete my character', async () => {
  const { call, put, get, guest } = await stand();
  const g = await guest();
  const other = await guest();
  const a = (await call('POST', '/v1/realm/create', { name: 'Nystul' }, g.secret)).body;
  assert.equal((await put(a.id, save('mine'), g.secret, { lease: a.lease, seq: 1 })).status, 200);
  assert.deepEqual((await call('POST', '/v1/realm/leave', { id: a.id, lease: 'e'.repeat(32) }, g.secret)).body, { ok: true, released: false });
  assert.deepEqual((await call('POST', '/v1/realm/leave', { id: a.id, lease: a.lease }, g.secret)).body, { ok: true, released: true });
  assert.deepEqual((await put(a.id, save('after'), g.secret, { lease: a.lease, seq: 2 })).body, { error: 'lease' }, 'a left character takes no checkpoint');
  assert.equal((await get(a.id, other.secret)).status, 404);
  assert.equal((await call('POST', '/v1/realm/join', { id: a.id }, other.secret)).status, 404);
  assert.equal((await put(a.id, save('theirs'), other.secret, { lease: a.lease, seq: 2 })).status, 404);
  assert.equal((await call('POST', '/v1/realm/delete', { id: a.id }, other.secret)).status, 404);
  assert.equal(new TextDecoder().decode((await get(a.id, g.secret)).bytes), 'mine', 'untouched');
});

test('REALM P1: the player\'s own delete takes both objects and the row', async () => {
  const { env, call, put, guest } = await stand();
  const g = await guest();
  const a = (await call('POST', '/v1/realm/create', { name: 'Nystul' }, g.secret)).body;
  await put(a.id, save('1'), g.secret, { lease: a.lease, seq: 1 });
  await put(a.id, save('2'), g.secret, { lease: a.lease, seq: 2 });
  assert.equal(env.SAVES._map.size, 2);
  assert.deepEqual((await call('POST', '/v1/realm/delete', { id: a.id }, g.secret)).body, { ok: true });
  assert.equal(env.SAVES._map.size, 0);
  assert.deepEqual((await call('GET', '/v1/realm', undefined, g.secret)).body.characters, []);
});

test('REALM P1: customs brings an offline character in ONCE, and only one that played online before the realm (a Renown track); a realm id is no origin', async () => {
  const { env, call, guest } = await stand();
  const g = await guest();
  const origin = 'c0ffee00-1111-2222-3333-444455556666';
  const never = await call('POST', '/v1/realm/customs', { origin, name: 'Nystul' }, g.secret);
  assert.deepEqual([never.status, never.body], [403, { error: 'customs-never-online' }]);
  env.DB._raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(g.id, origin, 'Nystul', 500, 1, 1);
  const came = await call('POST', '/v1/realm/customs', { origin, name: 'Nystul', summary: { level: 12 } }, g.secret);
  assert.equal(came.status, 200);
  assert.match(came.body.id, REALM_ID_RE);
  assert.notEqual(came.body.id, origin, 'the service mints its own id');
  const again = await call('POST', '/v1/realm/customs', { origin, name: 'Nystul' }, g.secret);
  assert.deepEqual([again.status, again.body], [409, { error: 'customs-already' }]);
  assert.equal((await call('POST', '/v1/realm/customs', { origin: came.body.id, name: 'X' }, g.secret)).status, 400, 'a realm id is no offline character');
  const [row] = (await call('GET', '/v1/realm', undefined, g.secret)).body.characters;
  assert.equal(row.customs, true);
  // another account's track is not mine
  const other = await guest();
  assert.equal((await call('POST', '/v1/realm/customs', { origin, name: 'Nystul' }, other.secret)).status, 403);
});

test('REALM P1: the shapes - a summary projected and bounded, a name trimmed and printable, the CORS door open to the realm headers', async () => {
  assert.equal(realmSummaryOf(null), null);
  assert.equal(realmSummaryOf([1]), null);
  assert.deepEqual(JSON.parse(realmSummaryOf({ level: -1, className: 7, race: 'Nord', face: 1.5 })), { level: null, className: null, race: 'Nord', gender: null, face: null, region: null });
  assert.equal(realmNameOf('x'.repeat(50)).length, 32);
  assert.equal(realmNameOf('   '), null);
  assert.equal(REALM_PLAYING_S, 300, 'a tile says "playing" for five minutes past the last checkpoint (they come every two)');
  const { env } = await stand();
  const res = await worker.fetch(new Request('https://accounts.invalid/v1/realm', { method: 'OPTIONS' }), env);
  assert.match(res.headers.get('access-control-allow-headers'), /x-realm-lease, x-realm-seq, x-realm-summary/);
  assert.match(src('server-account/migrations/0016_realm_characters.sql'), /CREATE UNIQUE INDEX IF NOT EXISTS realm_characters_origin ON realm_characters \(player, origin_id\) WHERE origin_id IS NOT NULL;/);
});
