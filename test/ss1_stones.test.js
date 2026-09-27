// SS1 (2026-09-27, Mac: "make sigil stones bound items and stackable, raise the prices on the new boss vendor"): the
// Sigil Stone BOUND (systems/itemBound.js - never handed to another player: the trade will not hold one out, and a
// peer's lot carrying one is refused whole) and STACKING with its own kind alone (systems/gateSpoils.js), the stones a
// save holds from before folded into their stacks on load (systems/save.js, below its index-keyed relinks), and the
// card's line. The Broker's count, sale and prices over the stacks are test/set7_broker.test.js's.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sigilStone, restackStones, isSigilStone, SIGIL_STONE_TEMPLATE } from '../src/systems/gateSpoils.js';
import { isBound, BOUND_LINE, BOUND_TRADE_TEXT } from '../src/systems/itemBound.js';
import { isLocked, setLocked, lockRefuses } from '../src/systems/itemLock.js';
import { tradeRefusal, createTradePack } from '../src/systems/tradePack.js';
import { createTradeManager, inTradeRange } from '../src/net/tradeSession.js';
import { validTradeData } from '../src/net/wire.js';
import { addItem, stacksWith } from '../src/systems/inventory.js';
import { mintCondition, setItemFields, templateByIndex } from '../src/systems/itemTemplates.js';
import { restorePlayer, snapshotPlayer } from '../src/systems/save.js';
import { withDom } from './invdrag.mjs';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { _resetForTests as _resetPrefsForTests } from '../src/systems/uiPrefs.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const ruby = () => mintCondition(setItemFields({ group: 'Gems', templateIndex: 0 }));
const stack = (n) => Object.assign(sigilStone(), { stackCount: n });
const summary = (list) => list.map((i) => [i.name, i.stackCount ?? 1, isLocked(i)]);

test('SS1 the stone is bound by its row: every stone, one minted before the row said so too, and nothing else - a gem, a set piece, no item at all; the binding closes the trade alone - the stone still drops, sells and stows, and the player\'s lock is its own (mutants: the row unbound; the binding read off the record)', () => {
  assert.equal(templateByIndex(SIGIL_STONE_TEMPLATE).bound, true, 'the row says it');
  assert.equal(isBound(sigilStone()), true);
  assert.equal(isBound({ group: 'Gems', templateIndex: SIGIL_STONE_TEMPLATE, name: 'Sigil Stone' }), true, 'a record from before SS1: bound, by its row');
  assert.equal(isBound({ ...sigilStone(), bound: false }), true, 'no field on the record unbinds it');
  assert.equal(isBound({ ...ruby(), bound: true }), false, 'nor binds a piece its row does not');
  assert.equal(isBound(ruby()), false);
  assert.equal(isBound(null), false);
  assert.equal(isBound(undefined), false);
  const stone = sigilStone();
  assert.equal(isLocked(stone), false, 'bound is not locked');
  for (const way of ['drop', 'sell', 'trade']) assert.equal(lockRefuses(stone, way), false, `the lock's ${way} is the player's word alone`);
  assert.equal(BOUND_LINE, 'Bound - it cannot be traded.');
  assert.equal(BOUND_TRADE_TEXT, 'Bound items cannot be traded.');
});

test('SS1 the trade: a bound piece is never put on the table (the pack\'s own refusal, in words), never taken out of the pack for a lot, and a peer\'s lot carrying one - an older build, a forged frame - is refused whole (mutants: the table takes a bound piece; a peer\'s bound lot taken)', () => {
  const stone = sigilStone();
  assert.equal(tradeRefusal(stone), BOUND_TRADE_TEXT);
  assert.equal(tradeRefusal(ruby()), null, 'a gem is traded as ever');
  const e = { items: [stone, ruby()], goldPieces: 10 };
  const pack = createTradePack(e);
  assert.equal(pack.offerable(stone), BOUND_TRADE_TEXT);
  assert.equal(pack.take([{ item: stone, count: 1 }], 0), null, 'never reserved for a lot');
  assert.equal(e.items.length, 2, 'and never out of the pack');
  const wired = (it) => JSON.parse(JSON.stringify(it));
  assert.equal(pack.unwire([wired(ruby()), wired(stack(3))]), null, 'a lot carrying a stone: refused whole');
  assert.equal(pack.unwire([wired(ruby())]).length, 1, 'a lot without one: taken');
});

/** Two players over a fake wire, each with a REAL trade pack (systems/tradePack.js) - test/trade_session.test.js's rig. */
function rig(aItems, bItems) {
  const q = [], said = { A: [], B: [] };
  const ents = { A: { items: aItems, goldPieces: 100 }, B: { items: bItems, goldPieces: 100 } };
  const mk = (me, other, id) => createTradeManager({
    pack: createTradePack(ents[me]), now: () => 0, say: (t) => said[me].push(t), peerName: () => other, selfId: () => id,
    send: (d) => { const v = validTradeData(d); if (!v) return false; q.push({ from: id, to: v.to, d: v }); return true; },
    near: () => inTradeRange([0, 0, 0], [1, 0, 0]), open: () => {},
  });
  const A = mk('A', 'B', 'peerAAAA'), B = mk('B', 'A', 'peerBBBB');
  const mgrs = { peerAAAA: A, peerBBBB: B };
  const pump = () => { while (q.length) { const f = q.shift(); mgrs[f.to].onFrame(f.from, f.d); } };
  assert.deepEqual(A.request('peerBBBB'), { ok: true }); pump();
  assert.deepEqual(B.request('peerAAAA'), { ok: true }); pump();
  assert.ok(A.session && B.session, 'a trade open between them');
  return { A, B, ents, said, pump, q };
}

test('SS1 the trade, end to end over the wire: my stone is refused at the table, with its words; a peer that sends one anyway (the frame the session\'s own offer writes, a stone on it) ends the trade as refused on my side, and nothing of mine moves (mutants: the table takes a bound piece; a peer\'s bound lot taken)', () => {
  const stone = stack(4);
  const r = rig([stone, ruby()], [ruby()]);
  const sa = r.A.session;
  assert.deepEqual(sa.setOffer([{ item: stone, count: 2 }], 0), { ok: false, why: BOUND_TRADE_TEXT });
  assert.deepEqual(sa.mine.entries, [], 'the offer stays as it was');
  assert.equal(sa.setOffer([{ item: r.ents.A.items[1], count: 1 }], 0).ok, true, 'a gem goes on the table');
  r.pump();
  assert.equal(r.B.session?.theirs.items.length, 1, 'and reaches the peer');
  // B's build holds a stone out (a forged frame: the offer B's session would write, a stone on it)
  const sb = r.B.session;
  const frame = { k: 'offer', s: sb.sid, to: 'peerAAAA', r: sb.rev + 1, items: [JSON.parse(JSON.stringify(stack(2)))], g: 0 };
  const v = validTradeData(frame);
  assert.ok(v, 'the wire itself carries it - the refusal is the receiver\'s');
  r.A.onFrame('peerBBBB', v);
  assert.equal(r.A.session, null, 'the trade is over on my side');
  assert.deepEqual(summary(r.ents.A.items), [['Sigil Stone', 4, false], ['Ruby', 1, false]], 'nothing of mine moved');
});

test('SS1 the stone stacks with its own kind alone: a won stone joins the stack in the pack, a locked stack takes only locked stones, a gem never joins it (mutants: the row unstacked)', () => {
  const pack = [];
  addItem(pack, sigilStone());
  addItem(pack, ruby());
  addItem(pack, sigilStone());
  addItem(pack, sigilStone());
  assert.deepEqual(summary(pack), [['Sigil Stone', 3, false], ['Ruby', 1, false]]);
  setLocked(pack[0], true);
  addItem(pack, sigilStone());
  assert.deepEqual(summary(pack), [['Sigil Stone', 3, true], ['Ruby', 1, false], ['Sigil Stone', 1, false]], 'a locked stack is its own');
  assert.equal(stacksWith(ruby(), sigilStone()), false);
});

test('SS1 the fold: a pack saved before the stone stacked - a record a stone - is one stack, each record into the first before it that it stacks with (a locked one with a locked one), its count whole, the other records in their order (mutants: the fold merging locked into unlocked; the fold losing a count)', () => {
  const r = ruby();
  const list = [sigilStone(), r, sigilStone(), Object.assign(stack(2), { locked: true }), stack(3), Object.assign(sigilStone(), { locked: true })];
  assert.equal(restackStones(list), 3, 'three records folded');
  assert.deepEqual(summary(list), [['Sigil Stone', 5, false], ['Ruby', 1, false], ['Sigil Stone', 3, true]]);
  assert.equal(list[1], r, 'a gem untouched, in its place');
  assert.equal(restackStones(list), 0, 'folded once: nothing more to fold');
  const plain = [ruby(), ruby()];
  assert.equal(restackStones(plain), 0, 'a pack with no stones is left as it is - a split gem stays split');
  assert.equal(plain.length, 2);
  assert.equal(restackStones(null), 0);
  assert.ok(list.every((i) => !isSigilStone(i) || i.stackCount >= 1));
});

const makeEntity = (over = {}) => ({
  name: 'Tester', race: 'Breton', gender: 'male', level: 3,
  stats: { strength: 50, endurance: 40, agility: 30, speed: 30, willpower: 30, intelligence: 30, luck: 30, personality: 30 },
  skills: new Array(35).fill(10), skillUses: new Array(35).fill(0),
  items: [], wagonItems: [], activeEffects: [], spells: [],
  health: 30, fatigue: 100, magicka: 10, gold: 0,
  ...over,
});

test('SS1 a load folds the stones - the pack\'s and the wagon\'s - BELOW the index-keyed relinks: a light lit after the stones in the saved list is the same light after the load (mutants: the fold never run; the fold before the relinks; the wagon left unfolded)', () => {
  const torch = { group: 'UselessItems2', templateIndex: 1, stackCount: 1, name: 'Torch' };
  const e = makeEntity({ items: [sigilStone(), sigilStone(), sigilStone(), torch], wagonItems: [stack(2), ruby(), sigilStone()] });
  e.lightSource = torch;
  const snap = snapshotPlayer(e, {});
  assert.equal(snap.lightSourceIndex, 3, 'the saved index: past the three stones');
  const t = makeEntity();
  const info = console.info;
  const lines = [];
  console.info = (s) => lines.push(String(s));
  try { restorePlayer(t, snap); } finally { console.info = info; }
  assert.deepEqual(t.items.map((i) => [i.name, i.stackCount ?? 1]), [['Sigil Stone', 3], ['Torch', 1]], 'one stack');
  assert.equal(t.lightSource, t.items[1], 'the torch is still the light - the index was read before a record moved');
  assert.deepEqual(t.wagonItems.map((i) => [i.name, i.stackCount ?? 1]), [['Sigil Stone', 3], ['Ruby', 1]], 'the wagon\'s too');
  assert.ok(lines.some((l) => l.includes('SS1') && l.includes('2 Sigil Stone record(s)')), 'said, in the console');
});

test('SS1 the card says a bound piece is bound, in the lock\'s own line style without its padlock; a gem says nothing of it (mutants: the card line missing)', () => {
  _resetPrefsForTests();
  globalThis.location = { search: '?skin=enhanced' };
  const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
  withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const e = { name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items: [stack(3), ruby()], goldPieces: 10 };
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => {}, dropItem: () => {} });
    try {
      host.querySelectorAll('.packtab').find((t) => textOf(t).toLowerCase().includes('valu'))?.onclick();
      const rowOf = (name) => host.querySelectorAll('.itemrow').find((r) => textOf(r).includes(name)) ?? null;
      assert.ok(rowOf('Sigil Stone'), 'the stack on the Valuables page');
      rowOf('Sigil Stone').onclick({ timeStamp: 100, detail: 1 });
      assert.deepEqual(host.querySelectorAll('.boundline').map((n) => n.textContent), [BOUND_LINE], 'the card says it once');
      rowOf('Ruby').onclick({ timeStamp: 5000, detail: 1 });
      assert.deepEqual(host.querySelectorAll('.boundline'), [], 'a gem says nothing of it');
    } finally { view.unmount(); }
  });
  assert.match(read('src/ui/enhancedPlusStyle.js'), /\.card \.lockline, \.card \.boundline \{/, 'the lock\'s line style');
  assert.doesNotMatch(read('src/ui/enhancedPlusStyle.js'), /\.boundline::before/, 'without its padlock');
});

test('SS2 the Broker\'s price column is one width in every row, wide enough for a two-digit price - "12 Sigil Stones" measures 108px in the window\'s 12px face, "4 Sigil Stones" 101 (tools/brokerProbe.mjs measures it on the real page; each row is its own grid, so a column sized by its text moved the Regalia\'s price 7px out of the line) (mutants: the price column sized by its text)', () => {
  const css = read('src/ui/enhancedPlusStyle.js');
  const grid = /\.broker-offer \{ display: grid; grid-template-columns: 48px minmax\(0, 1fr\) (\d+)px 148px;/.exec(css);
  assert.ok(grid, 'the price column has a width of its own');
  assert.ok(Number(grid[1]) >= 109, `wide enough for the widest price (${grid[1]}px)`);
  assert.match(css, /\.broker-price \{ font-size: 12px;/, 'the face the width was measured in');
});
