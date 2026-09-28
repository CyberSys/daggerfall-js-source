// AUDIT REALM (2026-09-28, Mac: "finish up the audit" of the REALM branch - bible/06-Systems/Realm-Arc.md): the
// findings of the audit of REALM P0.1-P2.2b on the tree merged with main (#412, the Sigil Stones), each reproduced
// before it was fixed and pinned here. The service is driven through the REAL Worker over the REAL migrations
// (node:sqlite behind a D1-shaped face whose batch is one transaction, and R2's calls), as test/realm4.test.js does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../server-account/src/index.js';
import { _resetKeyForTests } from '../server-account/src/signing.js';
import { SESSION_KEY } from '../src/net/accountClient.js';
import { tradeableRecord, BOUND_TEMPLATES, boundRecord } from '../src/net/realmTradeLaw.js';
import { isBound } from '../src/systems/itemBound.js';
import { ITEM_TEMPLATES } from '../src/systems/itemTemplates.js';
import { SURVIVAL_TEMPLATES } from '../src/systems/survival/items.js';
import { DEEP_WATERS_FISH_TEMPLATES } from '../src/systems/deepWatersFishItems.js';
import { SIGIL_STONE_TEMPLATES, SIGIL_STONE_TEMPLATE, sigilStone } from '../src/systems/gateSpoils.js';
import { THUNDERLOCK_TEMPLATES } from '../src/systems/thunderlock.js';
import { RRI_TEMPLATES, RRI_TEMPLATE_PATCHES } from '../src/systems/rriItems.js';
import { createTradePack, tradeRefusal } from '../src/systems/tradePack.js';
import { createWeapon } from '../src/combat/enemyEquipment.js';
import { realmIo, realmCreate, realmFetch, realmPut, realmTradeCall } from '../src/systems/realmSaves.js';
import { applyCustoms, liquidWealthOf, stashedItemLists } from '../src/systems/realmCustoms.js';
import { LETTER_OF_CREDIT_TEMPLATE, goldStack } from '../src/systems/inventory.js';
import { LOOT_CONTAINER_TYPES } from '../src/systems/sceneCache.js';
import { createBankAccounts } from '../src/systems/banking.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const MIGRATIONS = readdirSync(new URL('../server-account/migrations', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();

// ---- the service, as test/realm4.test.js stands it -------------------------------------------------------------------

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
function r2() {
  const m = new Map();
  return {
    _map: m,
    async put(key, body) { m.set(key, new Uint8Array(body instanceof ArrayBuffer ? body : new TextEncoder().encode(String(body)))); return { key }; },
    async get(key) {
      const v = m.get(key);
      return v === undefined ? null : { key, size: v.byteLength, body: v, async text() { return new TextDecoder().decode(v); } };
    },
    async delete(key) { m.delete(key); },
    async list({ prefix = '' } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}
function fakeStorage() {
  const m = new Map();
  return { _map: m, get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
}
/** One service; `player()` is a signed-in guest account on its own device. */
async function realm() {
  _resetKeyForTests();
  const env = { DB: d1(), SAVES: r2(), ACCOUNT_VERSION: 'test1' };
  async function player() {
    const g = await (await worker.fetch(new Request('https://accounts.invalid/v1/auth/guest', { method: 'POST', body: '{}' }), env)).json();
    const storage = fakeStorage();
    storage.setItem(SESSION_KEY, JSON.stringify({ id: g.id, secret: g.secret }));
    return { g, storage, io: realmIo({ fetch: (url, init) => worker.fetch(new Request(url, init), env), storage }) };
  }
  return { env, player };
}
/** A realm character with its first save: `{ id, lease, seq }` after the checkpoint. */
async function character(io, name, save) {
  const made = (await realmCreate(io, name)).data;
  const put = await realmPut(io, made.id, { lease: made.lease, seq: 1 }, JSON.stringify(save));
  assert.equal(put.ok, true);
  return { id: made.id, lease: made.lease, seq: 1 };
}
const record = async (io, id) => { const r = await realmFetch(io, id); return { seq: r.seq, save: JSON.parse(r.text) }; };
const dagger = () => createWeapon(113, 9, () => 0.5);

// ---- F1: the service's trade law binds as the game does ---------------------------------------------------------------

test('AUDIT REALM F1: a Sigil Stone never changes hands through the realm - the service\'s law binds by the row as well as the mark (itemBound.js isBound), so two halves naming a stone are refused and move nothing', { timeout: 60_000 }, async () => {
  const stone = sigilStone();
  assert.equal(stone.bound, undefined, 'a stone\'s record carries no mark of its own - its row binds it');
  // the law over plain save records, beside the pack's own
  const table = [
    [stone, false],
    [{ ...stone, stackCount: 7 }, false],
    [{ ...stone, bound: false }, false],   // no field on the record unbinds what the row binds
    [{ ...dagger(), bound: true }, false],   // SS4: the Broker's ware, bound by its own mark
    [dagger(), true],
  ];
  for (const [rec, may] of table) {
    const plain = JSON.parse(JSON.stringify(rec));
    assert.equal(tradeableRecord(plain), may, JSON.stringify(plain).slice(0, 90));
    assert.equal(boundRecord(plain), isBound(rec), 'the service reads a binding as the game does');
    assert.equal(tradeRefusal(rec) === null, may, 'the pack\'s own law says the same');
  }
  // the service, driven: two colluding halves - A gives a stone off its stack of three, B takes it - are refused whole
  const r = await realm();
  const A = await r.player(), B = await r.player();
  A.char = await character(A.io, 'Arthago', { name: 'Arthago', items: [{ ...stone, stackCount: 3 }], goldPieces: 50 });
  B.char = await character(B.io, 'Brisienna', { name: 'Brisienna', items: [dagger()], goldPieces: 50 });   // enough to pay: only the stone refuses
  const before = [await record(A.io, A.char.id), await record(B.io, B.char.id)];
  const give = { items: [{ ...stone, stackCount: 1 }], gold: 0 }, get = { items: [], gold: 10 };
  const ask = (P, sid, g, t) => realmTradeCall(P.io, { id: P.char.id, lease: P.char.lease, seq: P.char.seq, sid, give: g, get: t });
  assert.deepEqual((await ask(A, 'sidstone1', give, get)).data, { state: 'waiting' });
  assert.deepEqual((await ask(B, 'sidstone1', get, give)).data, { state: 'refused', why: 'goods' }, 'A\'s record cannot back a bound piece');
  assert.deepEqual([await record(A.io, A.char.id), await record(B.io, B.char.id)], before, 'both records as they were: three stones with A, none with B');
});

test('AUDIT REALM F1: BOUND_TEMPLATES is every row the game registers with `bound` - the classic table, each registrar\'s rows and RRI\'s patches - and the registrars are the five it reads', () => {
  const rows = [
    ...ITEM_TEMPLATES.map((t, i) => ({ ...t, index: t.index ?? i })),
    ...SURVIVAL_TEMPLATES, ...DEEP_WATERS_FISH_TEMPLATES, ...SIGIL_STONE_TEMPLATES, ...THUNDERLOCK_TEMPLATES, ...RRI_TEMPLATES, ...RRI_TEMPLATE_PATCHES,
  ];
  assert.deepEqual(rows.filter((t) => t.bound === true).map((t) => t.index).sort((a, b) => a - b), [...BOUND_TEMPLATES]);
  assert.ok(BOUND_TEMPLATES.includes(SIGIL_STONE_TEMPLATE));
  // a sixth registrar must join the list above, or its bound rows would pass the service unseen
  const registrars = [];
  const walk = (dir) => {
    for (const e of readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (p.endsWith('.js') && /registerCustomTemplates\(|registerTemplateOverrides\(/.test(src(p)) && p !== 'src/systems/itemTemplates.js') registrars.push(p);
    }
  };
  walk('src');
  assert.deepEqual(registrars.sort(), ['src/systems/deepWatersFishItems.js', 'src/systems/gateSpoils.js', 'src/systems/rriInstall.js', 'src/systems/survival/items.js', 'src/systems/thunderlock.js']);
  // and the honest client never offers one: the window's pack refuses it before a half is ever written
  const holder = { items: [{ ...sigilStone(), stackCount: 2 }], goldPieces: 0 };
  assert.equal(createTradePack(holder).offerable(holder.items[0]), tradeRefusal(holder.items[0]));
  assert.notEqual(tradeRefusal(holder.items[0]), null);
});

// ---- F2: customs caps the wealth a character left in the world too ----------------------------------------------------

test('AUDIT REALM F2: customs counts every coin and letter the character owns wherever it lies - the wagon\'s letters, a house chest, a storage piece, a pile dropped in a room, on a street or in a dungeon - takes the excess from those stashes first, and leaves the world\'s loot alone', () => {
  const letter = (value) => ({ group: 'MiscItems', templateIndex: LETTER_OF_CREDIT_TEMPLATE, value });
  const T = LOOT_CONTAINER_TYPES;
  const scene = {
    sceneName: 'house',
    lootContainers: [
      { containerType: T.HouseContainers, key: 'container:0', items: [goldStack(40_000), letter(60_000)] },
      { containerType: T.ShopShelves, key: 'shelf:0', items: [letter(9_999)] },   // a shop's stock: the world's
      { containerType: T.CorpseMarker, key: 'body:0', items: [goldStack(7_777)] },   // a body: the world's
    ],
    droppedPiles: [{ pos: [0, 0, 0], items: [goldStack(15_000)] }],
    decorItems: { 'piece-1': [goldStack(25_000), letter(5_000)] },
  };
  const street = { sceneName: 'street', lootContainers: [{ containerType: T.DroppedLoot, items: [goldStack(1_000)] }, { containerType: T.RandomTreasure, items: [goldStack(4_444)] }] };
  const open = { level: 1, goldPieces: 10_000, items: [letter(3_000)], wagonItems: [letter(100_000), goldStack(2_000)], bankAccounts: createBankAccounts(),
    sceneCache: { permanentScenes: ['house'], scenes: [scene, street] }, dungeon: null, world: { piles: [{ items: [goldStack(8_000)] }] } };
  // before AUDIT REALM these crossed uncapped: 100,000 in a wagon letter, 145,000 in the house and 9,000 on the floors
  assert.equal(liquidWealthOf(open), 10_000 + 3_000 + 102_000 + (40_000 + 60_000 + 15_000 + 25_000 + 5_000) + 1_000 + 8_000);
  const stashed = stashedItemLists(open);
  assert.ok(stashed.includes(scene.lootContainers[0].items) && stashed.includes(scene.decorItems['piece-1']) && stashed.includes(scene.droppedPiles[0].items));
  assert.ok(!stashed.includes(scene.lootContainers[1].items) && !stashed.includes(scene.lootContainers[2].items) && !stashed.includes(street.lootContainers[1].items), 'no shelf, body or treasure');
  const r = applyCustoms(open);
  assert.equal(r.allowance, 30_000);
  assert.equal(liquidWealthOf(open), 30_000, 'what is left is the allowance, wherever it lay');
  assert.equal(r.taken, 269_000 - 30_000);
  // the stashes went first - so the wagon, the pack and the purse the player sees at the door are what stays
  assert.deepEqual([scene.lootContainers[0].items, scene.decorItems['piece-1'], scene.droppedPiles[0].items, street.lootContainers[0].items, open.world.piles[0].items], [[], [], [], [], []], 'every stash emptied, and the emptied records gone from their lists');
  assert.equal(open.wagonItems.length, 2);
  assert.equal(open.wagonItems[0].value + open.wagonItems[1].stackCount, 30_000 - 10_000 - 3_000 + 0, 'the wagon keeps what the allowance leaves after the pack and the purse');
  assert.deepEqual([open.items[0].value, open.goldPieces], [3_000, 10_000]);
  // the world's loot is untouched
  assert.deepEqual([scene.lootContainers[1].items[0].value, scene.lootContainers[2].items[0].stackCount, street.lootContainers[1].items[0].stackCount], [9_999, 7_777, 4_444]);
  // a dungeon save: its `droppedLoot` is the player's, its `piles` are the dungeon's treasure
  const deep = { level: 1, goldPieces: 0, items: [], wagonItems: [], bankAccounts: createBankAccounts(), dungeon: { id: 1 },
    world: { piles: [{ items: [goldStack(90_000)] }], droppedLoot: [{ items: [goldStack(50_000)] }] } };
  assert.equal(liquidWealthOf(deep), 50_000);
  applyCustoms(deep);
  assert.deepEqual([deep.world.droppedLoot[0].items.map((it) => it.stackCount), deep.world.piles[0].items[0].stackCount], [[30_000], 90_000]);
});
