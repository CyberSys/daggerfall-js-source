// RENOWN-ACCOUNT (2026-09-28, Mac: "can you make sure renown is account based and not character based? Along with
// reducing the accumulation of renown from resources a bit. Want some more oomph to the grind"): ONE RENOWN AN
// ACCOUNT, AND A SLOWER GRIND. The law (src/net/renown.js): every source pays RENOWN_RATE_PCT - three quarters - of its
// full rate, floored once (renownRate), the hour's bound 15,000, the curve unmoved. The service over the real
// migrations (server-account/src/renownTracks.js, raids.js, guilds.js, index.js): ONE track an account, keyed by the
// account alone (migration 0021's renown_accounts) - two characters' reports land on one total, a character new to the
// account stands at its level, the token's level is the account's whoever the mint names, a raid pays the account.
// The migration: each account starts at its BEST character's total (MAX, never SUM), the per-character tracks kept as
// history, the realm's census still standing. A realm character deleted takes its own history and never the account's
// Renown. The client: the account card draws the one Renown, and the page adopts a raid's credit whoever fought it.
// And the relay is untouched: the law is never in its bundle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { createGuest, mintId } from '../server-account/src/accounts.js';
import { reportRenownXp, renownTrackOf } from '../server-account/src/renownTracks.js';
import { claimRaid } from '../server-account/src/raids.js';
import { createRealm, customsRealm, deleteRealm, CHARACTER_TABLES } from '../server-account/src/realm.js';
import { ACCOUNT_VERSION } from '../server-account/src/service.js';
import * as law from '../src/net/renown.js';
import {
  RENOWN_RATE_PCT, renownRate, renownKillXp, renownQuestXp, renownRaidXp, renownPartyXp, renownXpFor, renownForXp,
  RENOWN_KILL_XP_PER_LEVEL, RENOWN_KILL_LEVEL_MAX, RENOWN_QUEST_XP_BASE, RENOWN_QUEST_XP_PER_LEVEL, RENOWN_QUEST_LEVEL_MAX,
  RENOWN_OVER_MAX, RENOWN_XP_HOUR_MAX, RENOWN_XP_REPORT_MAX, RENOWN_XP_MAX, RENOWN_MAX, RENOWN_RAID_QUESTS,
} from '../src/net/renown.js';
import { mintRaidReceipt } from '../src/net/raidReceipt.js';
import { importReceiptKey } from '../src/net/gateReceipt.js';
import { importPublicKeyB64, verifyToken } from '../src/net/identityToken.js';
import { accountCard, accountRenownOf } from '../src/ui/enhancedAccount.js';
import { AccountFlow } from '../src/ui/accountFlow.js';
import { graph } from './importGraph.mjs';
import { r2, seatRealm } from './realmSeat.mjs';   // AUDIT REALM2 S2: a founder is a realm character
import { ACCEPTED } from '../src/net/legalLaw.js';   // TERMS1: a request that makes an account carries the versions ticked

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { subtle } = globalThis.crypto;
const rand = (b) => globalThis.crypto.getRandomValues(b);
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
const ACCOUNT_MIGRATION = '0021_renown_account.sql';
const migrate = (db, files) => { for (const f of files) db.exec(src(`server-account/migrations/${f}`)); };
/** D1's shape over node:sqlite (auditrealm.test.js's): `batch` as ONE transaction, a write's changes() beside it. */
function wrap(db) {
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
/** The service's database, every migration applied. */
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db, MIGRATIONS);
  return wrap(db);
}
const T0 = 1_800_000_000;   // a clock hour's first second
const DAY = 500;
const player = async (db) => ({ id: (await createGuest({ db, subtle, rand, nowS: T0 }, { deviceLabel: null })).id });
let _handles = 0;
/** A registered account (a raid is counted for one). */
const member = async (db) => {
  const { id } = await player(db);
  const h = `Herald${++_handles}`;
  db._raw.prepare('UPDATE players SET handle = ?, handle_lc = ? WHERE id = ?').run(h, h.toLowerCase(), id);
  return { id, handle: h };
};
/** The relay's pair, as tools/mintGateKeys.mjs mints it (raid4_rewards.test.js's). */
async function relayPair() {
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const pub = Buffer.from(new Uint8Array(await subtle.exportKey('raw', kp.publicKey))).toString('base64url');
  return { priv: await importReceiptKey(pkcs8, { subtle }), pubKey: await importPublicKeyB64(pub, { subtle }) };
}
const raidFor = (s, key, priv) => mintRaidReceipt({ w: key, s, c: 777, y: 2 }, priv, { subtle, nowS: T0 });
const rowsOf = (db, table, id) => db._raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE player = ?`).get(id).n;

// ═══ THE LAW ═════════════════════════════════════════════════════════════════════════════════════

test('RENOWN-ACCOUNT the rate: every source pays RENOWN_RATE_PCT (75) of its full rate, floored ONCE (renownRate) - a kill 7.5 a foe level (7, 15, 22 ... 225), a quest 75 + 30 a level, a raid three such quests (585 at Renown 1, 1,395 at 10, 2,925 from 27), the party\'s bonus on the rated kill (383 for eight at level 30); every result whole; the curve unmoved; the hour 15,000 (mutants: the rate unread for a kill; for a quest; rounded rather than floored; the full rate kept; the hour at 20,000)', () => {
  assert.equal(RENOWN_RATE_PCT, 75);
  assert.deepEqual([0, 1, 10, 15, 30, 100, 140, 4000].map(renownRate), [0, 0, 7, 11, 22, 75, 105, 3000]);
  assert.deepEqual([renownRate(-5), renownRate(Number.NaN), renownRate(undefined), renownRate(10.9)], [0, 0, 0, 7], 'whole XP in, whole XP out');
  // THE KILL - at the cap's Renown nothing is read lower (RENOWN3's ceiling is test/renown3.test.js's)
  const kills = Array.from({ length: RENOWN_KILL_LEVEL_MAX }, (_, i) => renownKillXp(i + 1, RENOWN_MAX));
  assert.deepEqual(kills.slice(0, 10), [7, 15, 22, 30, 37, 45, 52, 60, 67, 75], 'a rat is 7 - it was 10');
  assert.deepEqual([renownKillXp(20, RENOWN_MAX), renownKillXp(30, RENOWN_MAX), renownKillXp(99, RENOWN_MAX), renownKillXp(0, RENOWN_MAX)], [150, 225, 225, 7], 'a lich 150, a level-30 foe 225 - they were 200 and 300');
  kills.forEach((k, i) => assert.equal(k, Math.floor((RENOWN_KILL_XP_PER_LEVEL * (i + 1) * 3) / 4), `a level-${i + 1} kill is three quarters of ${RENOWN_KILL_XP_PER_LEVEL * (i + 1)}, floored`));
  // THE QUEST - 75 and 30 a level, whole already
  for (let L = 1; L <= RENOWN_QUEST_LEVEL_MAX; L++) assert.equal(renownQuestXp(L, RENOWN_MAX), 75 + 30 * L, `a quest at character level ${L}`);
  assert.deepEqual([RENOWN_KILL_XP_PER_LEVEL, RENOWN_QUEST_XP_BASE, RENOWN_QUEST_XP_PER_LEVEL], [10, 100, 40], 'the full rates stand: the rate is taken after them, in one place');
  // EVERY SOURCE, at every Renown: at most three quarters of its full rate, and short of it by less than one XP
  for (let r = 1; r <= RENOWN_MAX; r++) {
    for (let L = 1; L <= RENOWN_KILL_LEVEL_MAX; L++) {
      const read = Math.min(L, r + RENOWN_OVER_MAX);
      const k = renownKillXp(L, r), q = renownQuestXp(L, r);
      assert.ok(Number.isSafeInteger(k) && k * 4 <= RENOWN_KILL_XP_PER_LEVEL * read * 3 && (k + 1) * 4 > RENOWN_KILL_XP_PER_LEVEL * read * 3, `a level-${L} kill at Renown ${r}: ${k}`);
      assert.equal(q * 4, (RENOWN_QUEST_XP_BASE + RENOWN_QUEST_XP_PER_LEVEL * read) * 3, `a level-${L} quest at Renown ${r}: ${q}`);
    }
  }
  // THE RAID follows the quests: three at the top quest level
  assert.equal(RENOWN_RAID_QUESTS, 3);
  assert.deepEqual([renownRaidXp(null), renownRaidXp(1), renownRaidXp(10), renownRaidXp(27), renownRaidXp(RENOWN_MAX)], [585, 585, 1395, 2925, 2925], 'they were 780, 1,860 and 3,900');
  // THE PARTY: the bonus rides on the rated kill, so its base is a quarter less too
  assert.equal(renownPartyXp(renownKillXp(30, RENOWN_MAX), 8), 383, 'eight at level 30 - it was 510');
  assert.equal(renownPartyXp(renownKillXp(20, RENOWN_MAX), 4), 195);
  // THE CURVE did not move: the grind is slower because every source pays less, never because a level costs more
  assert.deepEqual([2, 10, 20, 50].map(renownXpFor), [100, 5510, 68200, 2318660]);
  assert.equal(RENOWN_XP_MAX, 2318660);
  assert.equal(renownForXp(5510), 10);
  // THE HOUR: a quarter off, as every source
  assert.equal(RENOWN_XP_HOUR_MAX, 15_000);
  assert.equal(RENOWN_XP_REPORT_MAX, 5_000, 'one report\'s bound stands');
  assert.equal(Math.ceil(RENOWN_XP_MAX / RENOWN_XP_HOUR_MAX), 155, 'a client that lies every hour takes 155 hours to the cap - it was 116');
  assert.equal('RENOWN_TRACKS_MAX' in law, false, 'the tracks\' bound went with the tracks');
  // the law's own worked examples say the new numbers
  const words = src('src/net/renown.js').replace(/\s*\n \*\s*/g, ' ').replace(/\s*\n\/\/\s*/g, ' ');
  assert.match(words, /at Daggerfall level 30, Renown 10 is 79 kills and Renown 20 is 531/);
  assert.match(words, /383 XP a kill at level 30 with the whole party's bonus/);
  assert.match(words, /takes 155 hours \(2,318,660 \/ 15,000\)/);
  assert.match(words, /Renown 1 takes 585, Renown 10 1,395, Renown 27 and up 2,925/);
});

// ═══ THE SERVICE ═════════════════════════════════════════════════════════════════════════════════

test('RENOWN-ACCOUNT the track: ONE an account - two characters\' reports land on the same total, a report naming no character (or one out of shape) is the account\'s too, and sixty-one characters are never refused; one row an account, no character\'s track written; the hour is the account\'s 15,000; the account gone takes it (mutants: a report keyed by its character; a second row an account; the hour at 20,000)', async () => {
  const db = d1();
  const P = await player(db);
  let r = await reportRenownXp({ db, nowS: T0 }, P, { character: 'char-aaaa', xp: 1000, name: 'Mara' });
  assert.deepEqual(r, { xp: 1000, level: renownForXp(1000), credited: 1000, rose: true }, 'the answer is the account\'s track - no character in it');
  r = await reportRenownXp({ db, nowS: T0 + 1 }, P, { character: 'char-bbbb', xp: 500, name: 'Tam' });
  assert.deepEqual([r.xp, r.credited], [1500, 500], 'the second character\'s report lands on the SAME total');
  for (const character of [undefined, null, 'x', 42, 'a b c d']) {
    r = await reportRenownXp({ db, nowS: T0 + 2 }, P, { character, xp: 10 });
    assert.equal(r.credited, 10, `a report naming ${JSON.stringify(character)} is the account's: the character is never the key`);
  }
  for (let i = 0; i < 61; i++) assert.equal((await reportRenownXp({ db, nowS: T0 + 3 }, P, { character: `new-${String(i).padStart(4, '0')}`, xp: 1 })).credited, 1, 'no character is refused - there is no tracks\' bound to meet');
  assert.deepEqual(await renownTrackOf({ db }, P.id), { xp: 1611, level: renownForXp(1611) });
  assert.equal(rowsOf(db, 'renown_accounts', P.id), 1, 'one row an account');
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM renown_tracks').get().n, 0, 'and no character\'s track is written - they are history');
  assert.throws(() => db._raw.prepare('INSERT INTO renown_accounts (player, xp, created_at, updated_at) VALUES (?, 1, 1, 1)').run(P.id), /UNIQUE|PRIMARY KEY/, 'its key allows no second');
  // THE HOUR is the account's 15,000, whichever characters earn it
  const Q = await player(db);
  let got = 0;
  for (let i = 0; i < 5; i++) got += (await reportRenownXp({ db, nowS: T0 + 10 + i }, Q, { character: `char-q${i}xx`, xp: RENOWN_XP_REPORT_MAX })).credited;
  assert.equal(got, 15_000, 'five characters, one hour: 15,000 - never 20,000');
  assert.deepEqual(await renownTrackOf({ db }, Q.id), { xp: 15_000, level: renownForXp(15_000) });
  assert.equal((await reportRenownXp({ db, nowS: T0 + 3600 }, Q, { xp: 100 })).credited, 100, 'the next hour opens again');
  // an account that has earned nothing: none, which every reader takes as Renown 1 - and a report the hour credits
  // nothing makes no empty track (AUDIT RENOWN1 DATA-7's law, on the account's)
  const N = await player(db);
  assert.equal(await renownTrackOf({ db }, N.id), null);
  db._raw.prepare('UPDATE players SET renown_hour = ?, renown_hour_xp = ? WHERE id = ?').run(Math.floor(T0 / 3600), RENOWN_XP_HOUR_MAX, N.id);
  assert.deepEqual(await reportRenownXp({ db, nowS: T0 + 20 }, N, { character: 'char-nnnn', xp: 10 }), { xp: 0, level: 1, credited: 0, rose: false });
  assert.equal(await renownTrackOf({ db }, N.id), null, 'no empty track');
  // the account gone, its Renown with it
  db._raw.prepare('DELETE FROM players WHERE id = ?').run(Q.id);
  assert.equal(rowsOf(db, 'renown_accounts', Q.id), 0);
});

async function stand() {
  _resetKeyForTests();
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pkcs8 = Buffer.from(new Uint8Array(await subtle.exportKey('pkcs8', kp.privateKey))).toString('base64');
  const env = { DB: d1(), SAVES: r2(), IDENTITY_PRIVATE_KEY: pkcs8, ACCOUNT_VERSION: 'test1', ALLOWED_ORIGIN: '*' };
  const call = async (method, path, body, bearer = null) => {
    const res = await worker.fetch(new Request(`https://accounts.invalid${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env);
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  return { env, call, kp };
}

test('RENOWN-ACCOUNT the worker: the token\'s level is the ACCOUNT\'s whichever character the mint names - one new to the account starts there; a mint naming none still carries none; a report answers the account\'s track, a character named or not; /v1/account says the ONE Renown ({ xp, level }, null before any); a character that never earned founds a guild at the account\'s Renown; acct19 still (mutants: the mint reading a character\'s track; the card sent a list; the founding asking the character)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { env, call, kp } = await stand();
  const me = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  assert.equal((await call('GET', '/v1/account', undefined, me.secret)).body.account.renown, null, 'nothing earned: no Renown to say');
  let r = (await call('POST', '/v1/renown/xp', { character: 'char-aaaa', xp: 5000, name: 'Mara' }, me.secret));
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.xp, r.body.level, r.body.credited, r.body.rose, 'character' in r.body, typeof r.body.order], [5000, 9, 5000, true, false, 'string']);
  r = await call('POST', '/v1/renown/xp', { xp: 510 }, me.secret);
  assert.deepEqual([r.status, r.body.xp, r.body.level, r.body.rose], [200, 5510, 10, true], 'a report naming no character is the account\'s too');
  for (const character of ['char-aaaa', 'char-bbbb', 'char-never-played']) {
    const tok = (await call('POST', '/v1/auth/token', { character }, me.secret)).body;
    assert.deepEqual([tok.level, tok.xp], [10, 5510], `${character}: the account's Renown and total`);
    assert.equal((await verifyToken(tok.token, kp.publicKey, { subtle, nowS: T0 })).claims.lv, 10, `${character}: signed in`);
  }
  const none = (await call('POST', '/v1/auth/token', {}, me.secret)).body;
  assert.deepEqual([none.level, none.xp], [null, null], 'a mint naming no character (an older build) still carries none');
  assert.equal((await verifyToken(none.token, kp.publicKey, { subtle, nowS: T0 })).claims.lv, undefined);
  assert.deepEqual((await call('GET', '/v1/account', undefined, me.secret)).body.account.renown, { xp: 5510, level: 10 }, 'the card: the ONE Renown');
  assert.equal((await call('POST', '/v1/renown/xp', { character: 'char-aaaa', xp: 0 }, me.secret)).status, 400, 'the one refusal left: an amount out of its bound');
  // A GUILD: founding asks the account's Renown, so a character that never earned founds at it (AUDIT REALM2 S2: a realm
  // character founds, on its record)
  assert.equal((await call('POST', '/v1/auth/register', { handle: 'Aldric', password: 'a good long one', ...ACCEPTED }, me.secret)).status, 200);
  const fresh = await seatRealm(env, me.secret, 'Fresh', { name: 'Fresh', level: 9, goldPieces: 100_000, items: [] });
  const found = await call('POST', '/v1/guilds/found', { character: fresh.id, name: 'The Hound', tag: 'HND', realm: fresh.at() }, me.secret);
  assert.equal(found.status, 200, 'a character that never earned stands at the account\'s Renown 10');
  const low = (await call('POST', '/v1/auth/guest', { ...ACCEPTED })).body;
  assert.equal((await call('POST', '/v1/auth/register', { handle: 'Lowly', password: 'a good long one', ...ACCEPTED }, low.secret)).status, 200);
  const lowly = await seatRealm(env, low.secret, 'Lowly', { name: 'Lowly', level: 9, goldPieces: 100_000, items: [] });
  assert.equal((await call('POST', '/v1/renown/xp', { character: lowly.id, xp: 5000 }, low.secret)).status, 200);
  assert.deepEqual(await call('POST', '/v1/guilds/found', { character: lowly.id, name: 'Low Band', tag: 'LOW', realm: lowly.at() }, low.secret), { status: 403, body: { error: 'guild-renown' } }, 'Renown 9 is not 10, whichever character asks');
  assert.equal(ACCOUNT_VERSION, 'acct23', 'RENOWN-ACCOUNT rode REALM\'s undeployed acct19; TERMS1, merged after it, moved it to acct20, PENITENT to acct21, REALM-DOOR with CUSTOMS-PASS to acct22, and HOUSE-LOSS and RESTORE to acct23');
  assert.match(src('server-account/wrangler.toml'), /ACCOUNT_VERSION = "acct23"/);
});

test('RENOWN-ACCOUNT the raid: a town defended is paid to the ACCOUNT - onto the total the reports grew, whichever character the claim names, at the account\'s level before it; the answer says the account\'s total and the character that fought, whose row keeps it; a claim naming none, or one out of shape, is paid too (mutants: the claim keyed by its character; the character left off its row)', async () => {
  const db = d1();
  const A = await member(db);
  const { priv, pubKey } = await relayPair();
  const ctx = { db, nowS: T0 + 60, subtle, rand };
  await reportRenownXp({ db, nowS: T0 }, A, { character: 'char-aaaa', xp: 1000 });
  const lv = renownForXp(1000);
  const paid = renownRaidXp(lv);
  const c1 = await claimRaid(ctx, A, { receipt: await raidFor(A.id, `3:7:${DAY}`, priv), character: 'char-bbbb' }, pubKey);
  assert.equal(c1.recorded, true);
  assert.deepEqual(c1.renown, { character: 'char-bbbb', xp: 1000 + paid, level: renownForXp(1000 + paid), credited: paid, rose: renownForXp(1000 + paid) > lv }, 'another character\'s raid, onto the account\'s total at the account\'s level');
  const c2 = await claimRaid(ctx, A, { receipt: await raidFor(A.id, `3:8:${DAY}`, priv) }, pubKey);
  const lv2 = renownForXp(1000 + paid);
  assert.deepEqual([c2.recorded, c2.renown.character, c2.renown.credited, c2.renown.xp], [true, null, renownRaidXp(lv2), 1000 + paid + renownRaidXp(lv2)], 'a claim naming no character: paid to the account all the same');
  const c3 = await claimRaid(ctx, A, { receipt: await raidFor(A.id, `3:9:${DAY}`, priv), character: 'no such/id' }, pubKey);
  assert.deepEqual([c3.recorded, c3.renown.character], [true, null], 'one out of the id\'s shape - paid, and never written down');
  assert.deepEqual(db._raw.prepare('SELECT char_id FROM raid_cleanses WHERE account = ? ORDER BY raid').all(A.id).map((x) => x.char_id), ['char-bbbb', '', ''], 'the row keeps who fought, as a record');
  assert.deepEqual(await renownTrackOf({ db }, A.id), { xp: c3.renown.xp, level: renownForXp(c3.renown.xp) });
  assert.equal(rowsOf(db, 'renown_accounts', A.id), 1);
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM renown_tracks').get().n, 0, 'no character\'s track');
  // a registered account with no Renown yet: the raid makes its track
  const B = await member(db);
  const b1 = await claimRaid(ctx, B, { receipt: await raidFor(B.id, `4:1:${DAY}`, priv), character: 'char-cccc' }, pubKey);
  assert.deepEqual(b1.renown, { character: 'char-cccc', xp: renownRaidXp(1), level: renownForXp(renownRaidXp(1)), credited: 585, rose: true });
});

// ═══ THE MIGRATION ═══════════════════════════════════════════════════════════════════════════════

test('RENOWN-ACCOUNT the migration: over the real migrations, each account starts at its BEST character\'s XP - the most any one track holds, never the sum - with the last report its most recently earned track took; an account whose tracks hold nothing has no row; the tracks stay as history; the census 0020 took of them still lets a character through customs, whose carry never moves the account\'s Renown (mutants: SUM for MAX; the empty account given a row; the report in flight credited again)', async () => {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  const i20 = MIGRATIONS.findIndex((f) => f.startsWith('0020_'));
  assert.equal(MIGRATIONS[i20 + 1], ACCOUNT_MIGRATION, '0021 follows 0020: the census is taken first');
  migrate(raw, MIGRATIONS.slice(0, i20));
  const db = wrap(raw);
  // accounts made before 0020 were written by the service as it was then - TERMS1's columns (migration 0023, after
  // these) did not exist yet, so the guest row is the one it wrote before them
  const before = () => { const id = mintId(rand); raw.prepare('INSERT INTO players (id, handle, handle_lc, guest_name, created_at, last_seen) VALUES (?, NULL, NULL, ?, ?, ?)').run(id, 'Guest', T0, T0); return { id }; };
  const A = before(), B = before(), C = before(), D = before();
  const track = raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, last_rid, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  track.run(A.id, 'char-main', 'Main', 6000, 'aaaaaaaaaaaaaaaa', 100, 500);
  track.run(A.id, 'char-alt1', 'Alt', 500, 'bbbbbbbbbbbbbbbb', 200, 900);   // the most recently earned
  track.run(A.id, 'char-alt2', null, 300, null, 50, 400);
  track.run(B.id, 'char-zero', null, 0, null, 10, 10);
  track.run(C.id, 'char-capp', 'Old', RENOWN_XP_MAX, null, 10, 20);
  track.run(C.id, 'char-newb', 'New', 10, 'cccccccccccccccc', 30, 40);
  migrate(raw, MIGRATIONS.slice(i20));   // 0020's census, 0021, and whatever follows
  const rows = raw.prepare('SELECT player, xp, last_rid, created_at, updated_at FROM renown_accounts ORDER BY xp').all().map((x) => ({ ...x }));
  assert.deepEqual(rows, [
    { player: A.id, xp: 6000, last_rid: 'bbbbbbbbbbbbbbbb', created_at: 50, updated_at: 900 },
    { player: C.id, xp: RENOWN_XP_MAX, last_rid: 'cccccccccccccccc', created_at: 10, updated_at: 40 },
  ], 'the best character\'s total (6,000, never 6,800); nothing for an account that earned nothing, or had no track');
  assert.deepEqual(await renownTrackOf({ db }, A.id), { xp: 6000, level: 10 });
  assert.deepEqual(await renownTrackOf({ db }, C.id), { xp: RENOWN_XP_MAX, level: RENOWN_MAX });
  assert.deepEqual([await renownTrackOf({ db }, B.id), await renownTrackOf({ db }, D.id)], [null, null]);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM renown_tracks').get().n, 6, 'the characters\' tracks stay, as history');
  assert.deepEqual(raw.prepare('SELECT char_id FROM realm_census WHERE player = ? ORDER BY char_id').all(A.id).map((x) => x.char_id), ['char-alt1', 'char-alt2', 'char-main'], 'the census, as 0020 took it');
  // a report in flight across the deploy, sent again under the id the account last took: answered, never paid twice
  const again = await reportRenownXp({ db, nowS: T0 }, A, { character: 'char-alt1', xp: 50, rid: 'bbbbbbbbbbbbbbbb' });
  assert.deepEqual([again.credited, again.repeat, again.xp], [0, true, 6000]);
  const next = await reportRenownXp({ db, nowS: T0 + 1 }, A, { character: 'char-alt2', xp: 100, rid: 'dddddddddddddddd' });
  assert.deepEqual([next.credited, next.xp], [100, 6100], 'an alt earns onto the best character\'s total - never onto its own 300');
  const nextAgain = await reportRenownXp({ db, nowS: T0 + 2 }, A, { character: 'char-main', xp: 100, rid: 'dddddddddddddddd' });
  assert.deepEqual([nextAgain.credited, nextAgain.repeat, nextAgain.xp], [0, true, 6100], 'the account keeps the id of the report it last took, whichever character sends it again');
  const capped = await reportRenownXp({ db, nowS: T0 }, C, { character: 'char-newb', xp: 500 });
  assert.deepEqual([capped.credited, capped.xp, capped.max], [0, RENOWN_XP_MAX, true], 'an account whose best stood at the cap is there');
  // CUSTOMS: the census still lets a character in; its history row is carried to the realm's id; the account's
  // Renown does not move
  const came = await customsRealm({ db, rand, nowS: T0 + 5 }, A.id, { origin: 'char-alt1', name: 'Alt' });
  assert.ok(came.id && !came.error, `customs: ${JSON.stringify(came)}`);
  assert.deepEqual(await renownTrackOf({ db }, A.id), { xp: 6100, level: renownForXp(6100) }, 'the account\'s Renown, where it stood');
  assert.equal(raw.prepare('SELECT xp FROM renown_tracks WHERE player = ? AND char_id = ?').get(A.id, came.id).xp, 500, 'the history row came in under the realm\'s id');
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM renown_tracks WHERE char_id = ?').get('char-alt1').n, 0);
  const sql = src(`server-account/migrations/${ACCOUNT_MIGRATION}`);
  assert.match(sql, /player {5}TEXT PRIMARY KEY,/, 'one row an account, by its key');
  assert.match(sql, /FOREIGN KEY \(player\) REFERENCES players\(id\) ON DELETE CASCADE/);
  assert.match(sql, /WHY A TABLE OF ITS OWN/, 'the schema\'s choice, justified where it is made');
});

test('RENOWN-ACCOUNT a realm character deleted takes its own history row and NEVER the account\'s Renown: renown_accounts has no char_id, is no character table, and no statement of realm.js writes it; a realm character earns for the account, and a new one stands at its level (mutants: the account\'s Renown walked as a character table; a delete of it beside the history\'s)', async () => {
  const db = d1();
  const A = await player(db);
  await reportRenownXp({ db, nowS: T0 }, A, { character: 'char-aaaa', xp: 4000 });
  const made = await createRealm({ db, rand, nowS: T0 }, A.id, { name: 'Nystul' });
  assert.ok(made.id, `made: ${JSON.stringify(made)}`);
  db._raw.prepare('INSERT INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(A.id, made.id, 'Nystul', 900, 1, 1);   // its history, as customs carries one
  assert.equal((await reportRenownXp({ db, nowS: T0 + 1 }, A, { character: made.id, xp: 1000 })).xp, 5000, 'the realm character earns for the account');
  const before = await renownTrackOf({ db }, A.id);
  assert.deepEqual(before, { xp: 5000, level: renownForXp(5000) });
  assert.deepEqual(await deleteRealm({ db, bucket: null }, A.id, made.id), { ok: true });
  assert.deepEqual(await renownTrackOf({ db }, A.id), before, 'the account\'s Renown, whole');
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM renown_tracks WHERE char_id = ?').get(made.id).n, 0, 'its own history row went with it');
  assert.equal(db._raw.prepare('SELECT COUNT(*) AS n FROM realm_characters WHERE id = ?').get(made.id).n, 0);
  // BY ITS SHAPE: no character's id can reach it
  assert.equal(CHARACTER_TABLES.includes('renown_accounts'), false);
  assert.deepEqual(db._raw.prepare("SELECT name FROM pragma_table_info('renown_accounts') ORDER BY cid").all().map((x) => x.name), ['player', 'xp', 'last_rid', 'created_at', 'updated_at'], 'no char_id column');
  assert.doesNotMatch(src('server-account/src/realm.js'), /(UPDATE|DELETE FROM|INSERT INTO|REPLACE INTO)\s+renown_accounts/i, 'realm.js writes it nowhere');
  // and every character table walked by a customs or a delete leaves it be
  for (const table of CHARACTER_TABLES) db._raw.prepare(`DELETE FROM ${table} WHERE player = ?`).run(A.id);
  assert.deepEqual(await renownTrackOf({ db }, A.id), before);
  // a second realm character, new: it stands at the account's Renown from its first minute
  const next = await createRealm({ db, rand, nowS: T0 + 2 }, A.id, { name: 'Tamsin' });
  assert.equal((await reportRenownXp({ db, nowS: T0 + 3 }, A, { character: next.id, xp: 10 })).xp, 5010);
});

// ═══ THE CLIENT ══════════════════════════════════════════════════════════════════════════════════

const node = (tag) => {
  const n = {
    tag, className: '', title: '', children: [],
    append: (...kids) => n.children.push(...kids.filter(Boolean)),
    get all() { return [n, ...n.children.flatMap((c) => c.all)]; },
  };
  Object.defineProperty(n, 'textContent', { get() { return n._txt ?? null; }, set(v) { n._txt = v; if (v === '') n.children.length = 0; } });
  return n;
};

test('RENOWN-ACCOUNT the client: the account card draws the ONE Renown - its level left of the name ("shared by all your characters") and ONE row of how far into it the account is; a list of characters\' tracks (a service from before it) draws none; the page adopts a raid\'s credit whichever character fought it (mutants: the chip on the password stage; a list read as the Renown; the raid\'s credit dropped for another character)', () => {
  assert.deepEqual(accountRenownOf({ xp: 6000, level: 10 }), { xp: 6000, level: 10 });
  for (const bad of [null, undefined, [], [{ xp: 6000, level: 10 }], { xp: 6000, level: 0 }, { xp: 6000, level: 51 }, { xp: -1, level: 10 }, { xp: 1.5, level: 10 }, { level: 10 }, 'Renown 10']) {
    assert.equal(accountRenownOf(bad), null, `${JSON.stringify(bad)} is no Renown of the account's`);
  }
  const storage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const flow = AccountFlow({ io: { fetch: async () => { throw new Error('no network'); } }, storage });
  const card = accountCard({ createElement: node }, flow);
  const base = { id: 'p1', name: 'Lattymoy', kind: 'linked', handle: 'Lattymoy', playedS: 60 };
  flow.stage = 'in';
  flow.account = { ...base, renown: { xp: 6000, level: 10 } };
  card.paint();
  const h3 = card.root.all.find((n) => n.tag === 'h3');
  assert.deepEqual(h3.children.map((c) => [c.className, c.textContent]), [['acctrenown', '10'], ['acctname', 'Lattymoy']], 'the account\'s level, left of its name');
  assert.equal(h3.children[0].title, 'Renown 10 - shared by all your characters');
  const renownRows = () => card.root.all.filter((n) => n.className === 'acctkey' && n.textContent === 'Renown').length;
  const values = () => card.root.all.filter((n) => n.className === 'acctval').map((n) => n.textContent);
  assert.equal(renownRows(), 1, 'ONE row - it was one a character');
  assert.ok(values().includes('Renown 10, 490 / 2,150 XP to Renown 11'), values().join(' | '));
  flow.account = { ...base, renown: { xp: RENOWN_XP_MAX, level: RENOWN_MAX } };
  card.paint();
  assert.ok(values().includes('Renown 50, the highest there is'), 'the level said once at the cap (AUDIT RENOWN1 UI-6)');
  for (const renown of [[{ character: 'char-aaaa', name: 'Mara Venn', xp: 6000, level: 10 }], null, undefined]) {
    flow.account = { ...base, renown };
    card.paint();
    const plain = card.root.all.find((n) => n.tag === 'h3');
    assert.deepEqual([plain.textContent, plain.children.length, renownRows()], ['Lattymoy', 0, 0], `${JSON.stringify(renown)}: no Renown of the account's, none drawn`);
  }
  flow.account = { ...base, renown: { xp: 6000, level: 10 } };
  flow.stage = 'password';
  card.paint();
  assert.equal(card.root.all.some((n) => n.className === 'acctrenown'), false, 'only signed in');
  // THE PAGE: a counted raid's Renown is the account's, whichever character fought it
  const w = src('src/scenes/world.js');
  assert.doesNotMatch(w, /data\?\.renown\?\.character !== characterIdOf\(playerEntity\)/, 'another character\'s raid is no longer dropped');
  assert.match(w, /onRecorded: \(data\) => \{\n\s+if \(!data\?\.renown\) return;[^\n]*\n\s+const a = renownAnswer\(\{ \.\.\.data\.renown, order: data\.order \?\? null \}, data\.renown\.credited \?\? 0, renownSaid\);\n\s+if \(a\.xp !== null\) renownXpAdopt\(a\.xp\);\n\s+if \(a\.level !== null\) renownAdopt\(a\.level\);/);
  assert.doesNotMatch(src('src/ui/enhancedMenu.js'), /its Renown, its home and its guild place with it/, 'a deleted character no longer takes the Renown with it');
});

test('RENOWN-ACCOUNT the relay is untouched: the law is the account Worker\'s and the page\'s, never in the relay\'s bundle (test/relayversion.test.js holds that bundle\'s hash); the Worker bundles it and its deploy filter names it', () => {
  assert.equal(graph('server/src/index.js').includes('src/net/renown.js'), false, 'not the relay\'s');
  assert.ok(graph('server-account/src/index.js').includes('src/net/renown.js'), 'the account Worker\'s');
  assert.match(src('.github/workflows/account-deploy.yml'), /- "src\/net\/renown\.js"/);
});
