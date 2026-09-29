// AUDIT 29g (Mac: "audit this", then "Fix them now"): THE MARKET'S CACHE KEYED A SEARCH THAT MATCHED NOTHING AS NO SEARCH.
// ui/marketTab.js hands a Materials search's matches as `materials` - an empty list when the word matches no
// material, which the service answers with no rows (server-account/src/market.js marketRead). net/marketBook.js keyed
// `(q.materials ?? []).join(',')`, so `[]` and no search at all were one key: the search was served the whole cached
// market, and the box cleared inside the minute was served the empty search. The key tells them apart now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMarketBook } from '../src/net/marketBook.js';

const noWait = () => Promise.resolve();
const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
/** A door that answers as the service does: no search, every row; a search's matches, their rows; none, none. */
const serviceDoor = (asked) => ({
  account: () => 'acct-1',
  read: async (b) => {
    asked.push(b.materials);
    const rows = b.materials == null ? ['ore:iron', 'ore:silver'] : b.materials.filter((k) => k.startsWith('ore:'));
    return { ok: true, data: { rows } };
  },
});

test('AUDIT 29g: a search that matched nothing is never served the unfiltered market, nor the unfiltered view the empty search - each asked once, cached apart; a search\'s own matches keyed apart too (mutant: the old key)', async () => {
  for (const order of [['none', 'empty'], ['empty', 'none']]) {
    const asked = [];
    const book = createMarketBook({ door: serviceDoor(asked), storage: memStorage(), character: () => 'c', now: () => 1_000_000, sleep: noWait });
    const q = { none: { region: 17, hubs: {} }, empty: { region: 17, hubs: {}, materials: [] } };
    const want = { none: ['ore:iron', 'ore:silver'], empty: [] };
    for (const k of order) assert.deepEqual((await book.read('materials', q[k])).data.rows, want[k], `${order.join(' then ')}: ${k}`);
    for (const k of order) assert.deepEqual((await book.read('materials', q[k])).data.rows, want[k], `${order.join(' then ')}: ${k} again, from the cache`);
    assert.equal(asked.length, 2, 'each asked of the service once, the second read of each the cache\'s');
    assert.deepEqual(book.cached('materials', q.empty), { rows: [] });
  }
  const asked = [];
  const book = createMarketBook({ door: serviceDoor(asked), storage: memStorage(), character: () => 'c', now: () => 1_000_000, sleep: noWait });
  assert.deepEqual((await book.read('materials', { region: 17, hubs: {}, materials: ['ore:iron'] })).data.rows, ['ore:iron']);
  assert.deepEqual((await book.read('materials', { region: 17, hubs: {} })).data.rows, ['ore:iron', 'ore:silver'], 'a search\'s matches are not the whole market');
  assert.deepEqual((await book.read('materials', { region: 17, hubs: {}, materials: ['ore:silver'] })).data.rows, ['ore:silver'], 'nor another search\'s');
});
