// PORTAL1 - THE PORTAL STONE (2026-10-04, the owner: "with the removal of fast travel, I want to implement a new item
// available at all shops, this should cost weykar shards (from dismantling gear with rarity). These should always be
// readily available. When using this item, it opens a portal allowing you to traverse to anywhere on the map. This is a
// one use item that stays open for a short time, allowing multiple players to traverse"). The laws pinned here:
//   - THE STONE: template 572 beside the Welkynd Shard - stacking with its own kind, BOUND (the realm's list names it).
//   - THE COUNTER: PORTAL_STONE_SHARDS unlocked shards for one stone, through the carry gate; refused with nothing taken;
//     never out of stock. Every shop keeper's popup carries the row on both skins - a teller and a mod's service never.
//   - THE USE: the pack's Use, both skins' readers and the hotbar hand the stone to the host's `openPortal` door; a host
//     without one says why. One stone spent at the pick, the rest of the stack kept.
//   - THE PORTAL: opened ahead of the player, standing PORTAL_OPEN_MS, entered by a STEP IN (never by opening on top of
//     someone), kept in the world frame; online on the opener's full foes frame (`pg`), each peer's copy kept to its time.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as PS from '../src/systems/portalStone.js';
import { PORTAL_STONE_TEMPLATE, PORTAL_STONE_TEMPLATES, PORTAL_STONE, portalStones, isPortalStone, welkyndShards, WELKYND_SHARD, WELKYND_SHARD_TEMPLATE, isWelkyndShard } from '../src/systems/gateSpoils.js';
import { BOUND_TEMPLATES } from '../src/net/realmTradeLaw.js';
import { isBound } from '../src/systems/itemBound.js';
import { setLocked } from '../src/systems/itemLock.js';
import { addItem } from '../src/systems/inventory.js';
import { templateByIndex } from '../src/systems/itemTemplates.js';
import { useItem, USE_PENDING } from '../src/systems/useItem.js';
import { survivalInfoTokens } from '../src/systems/itemInfo.js';
import { useResultAction } from '../src/ui/enhancedInventory.js';
import * as qs from '../src/systems/quickslots.js';
import { createPortalGates, PORTAL_SAY_REACH } from '../src/scenes/portalGates.js';
import { portalOpenAt, portalLife, PORTAL_MS, createPortalSet } from '../src/scenes/portalFx.js';
import { MerchantServiceWindow, MERCHANT_PANEL_X, MERCHANT_PANEL_Y, MERCHANT_PANEL_H, portalRowRect, PORTAL_ROW_KEY } from '../src/ui/merchantServiceWindow.js';
import { MerchantRepairWindow, REPAIR_PANEL_X, REPAIR_PANEL_Y, REPAIR_PANEL_H } from '../src/ui/merchantRepairWindow.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const shardsIn = (items) => items.filter(isWelkyndShard).reduce((n, it) => n + (it.stackCount ?? 1), 0);
const stonesIn = (items) => items.filter(isPortalStone).reduce((n, it) => n + (it.stackCount ?? 1), 0);
const fakeRenderer = () => {
  const made = [], freed = [];
  return {
    made, freed,
    uploadTexture() {}, uploadEmissionTexture() {},
    createBillboardBatch: (archive, record, size) => { const b = { archive, record, size }; made.push(b); return b; },
    destroyBillboardBatch: (b) => freed.push(b),
  };
};

test('PORTAL1 the stone: its own row beside the shard (572, the Diamond\'s art, miscellany - never a crystal worn), stacking with its own kind alone, BOUND - the realm\'s service names it - and priced at its shards\' worth', () => {
  assert.equal(PORTAL_STONE_TEMPLATE, 572);
  assert.equal(WELKYND_SHARD_TEMPLATE + 1, PORTAL_STONE_TEMPLATE, 'beside the shard');
  const row = templateByIndex(PORTAL_STONE_TEMPLATE);
  assert.equal(row?.name, 'Portal Stone');
  assert.equal(row.bound, true); assert.equal(row.stackable, true);
  assert.deepEqual([row.worldTextureArchive, row.worldTextureRecord], [254, 3]);
  assert.equal(PORTAL_STONE.value, PS.PORTAL_STONE_SHARDS * WELKYND_SHARD.value);
  assert.equal(PORTAL_STONE_TEMPLATES.length, 1);
  assert.ok(BOUND_TEMPLATES.includes(PORTAL_STONE_TEMPLATE), 'the realm\'s service refuses it too');
  const s = portalStones(1);
  assert.ok(isPortalStone(s) && isBound(s));
  assert.equal(s.group, 'UselessItems2', 'miscellany - a gem is a crystal a slot takes'); assert.equal(s.name, 'Portal Stone');
  assert.equal(qs.hotbarKindOf(s), 'use', 'used from the bar, never worn');
  assert.equal(portalStones(0).stackCount, 1, 'at least one');
  const pack = [portalStones(1)];
  addItem(pack, portalStones(2));
  assert.equal(pack.length, 1); assert.equal(pack[0].stackCount, 3, 'stones stack');
  addItem(pack, welkyndShards(2));
  assert.equal(pack.length, 2, '...with their own kind alone');
  const lines = survivalInfoTokens(s).map((t) => t.text);
  assert.deepEqual(lines.slice(2), PS.portalStoneLines(), 'the card says what it does');
  assert.match(lines[3], /30 seconds/);
});

test('PORTAL1 the counter: five unlocked shards for a stone, taken whole or not at all - short, locked or too heavy refuses with nothing taken; never out of stock', () => {
  assert.equal(PS.PORTAL_STONE_SHARDS, 5);
  const short = [welkyndShards(4)];
  assert.equal(PS.portalStoneRefusal(short), 'shards');
  assert.deepEqual(PS.buyPortalStone(short), { ok: false, reason: 'shards' });
  assert.equal(shardsIn(short), 4, 'nothing taken');
  const locked = [welkyndShards(10)];
  setLocked(locked[0], true);
  assert.equal(PS.portalStoneRefusal(locked), 'shards', 'a locked stack is the player\'s word to keep it');
  // the carry gate sees the pack as the shards leave it
  const seen = [];
  const heavy = [welkyndShards(7)];
  assert.deepEqual(PS.buyPortalStone(heavy, { canCarry: (item, rest) => { seen.push([item.name, shardsIn(rest)]); return false; } }), { ok: false, reason: 'heavy' });
  assert.deepEqual(seen, [['Portal Stone', 2]]);
  assert.equal(shardsIn(heavy), 7, 'nothing taken');
  // the sale - and again, and again, while the shards last
  const pack = [welkyndShards(3), welkyndShards(9)];
  for (let i = 0; i < 2; i++) assert.equal(PS.buyPortalStone(pack).ok, true);
  assert.equal(shardsIn(pack), 2); assert.equal(stonesIn(pack), 2, 'one stack of two');
  assert.equal(pack.filter(isPortalStone).length, 1);
  assert.equal(PS.buyPortalStone(pack).reason, 'shards');
  assert.match(PS.PORTAL_TEXT.ask(12), /5 Welkynd Shards\? You carry 12\./);
  assert.match(PS.PORTAL_TEXT.shards(1), /costs 5 Welkynd Shards\. You carry 1\./);
});

test('PORTAL1 the use: the stone hands itself to the host\'s door on every reader - the pack\'s two skins and the hotbar - and a host with no open world says why; one stone spent at the pick', () => {
  const pack = [portalStones(2)];
  const r = useItem(pack[0], pack, { entity: { items: pack } });
  assert.equal(r.kind, 'openPortal'); assert.equal(r.item, pack[0]);
  assert.equal(pack[0].stackCount, 2, 'Use spends nothing - the pick does');
  assert.equal(USE_PENDING.openPortal, PS.PORTAL_TEXT.notHere, 'the readers\' stand-in is the door\'s own refusal');
  // the enhanced pack
  assert.deepEqual(useResultAction(r, { openPortal: () => {} }), { kind: 'openPortal', item: pack[0], closeFirst: true });
  assert.deepEqual(useResultAction(r, {}), { kind: 'message', text: PS.PORTAL_TEXT.notHere });
  // the classic pack: closes, then the door
  const inv = read('src/ui/nativeInventory.js');
  assert.match(inv, /if \(r\.kind === 'openPortal'\) \{\n\s+if \(this\.hooks\.openPortal\) \{ this\._closeSilently\(\); this\.hooks\.openPortal\(r\.item, collection\); \}\n\s+else this\.boxes = \[\{ rows: \[\{ text: USE_PENDING\.openPortal, center: true \}\] \}\];/);
  assert.match(read('src/ui/enhancedInventory.js'), /const openPortal = deps\.openPortal;\n\s+onExit\(\);[^\n]*\n\s+openPortal\(act\.item, collection\);/, 'the hook read before the unmount clears it');
  // the hotbar: the door's answer is the press's
  const e = { items: pack, equipTable: {} };
  const press = (hooks) => {
    qs.clearHotbar();
    qs.setHotbarSlot(0, qs.hotbarEntryForItem(pack[0]));
    const said = [];
    let done = null;
    const doors = { quickUse: (n) => { done = qs.useQuickslot(n === 1 ? 'c1' : 'c2', { entity: e, items: pack, hooks, say: (l) => said.push(l) }); return true; } };
    qs.hotbarPress(0, { entity: e, doors, say: (l) => said.push(l) });
    qs.clearHotbar();
    return { done, said };
  };
  const calls = [];
  assert.equal(press({ openPortal: (item, list) => { calls.push([item, list]); return true; } }).done.kind, 'used');
  assert.deepEqual(calls, [[pack[0], pack]]);
  assert.equal(press({ openPortal: () => false }).done.kind, 'refused', 'a refused door is a refused press');
  const none = press({});
  assert.equal(none.done.kind, 'refused'); assert.deepEqual(none.said, [PS.PORTAL_TEXT.notHere]);
  // the pick spends one
  assert.equal(PS.spendPortalStone(pack[0], pack), true); assert.equal(pack[0].stackCount, 1);
  const last = pack[0];
  assert.equal(PS.spendPortalStone(last, pack), true); assert.equal(pack.length, 0, 'the last stone leaves the pack');
  assert.equal(PS.spendPortalStone(last, pack), false, 'a stone no longer there spends nothing');
  assert.equal(PS.spendPortalStone(welkyndShards(3), [welkyndShards(3)]), false, 'only a stone');
});

test('PORTAL1 the portal\'s place and its step: ahead of the player along the camera\'s forward, on the ground found there; an entry is a step from outside to inside - a portal opening on someone takes nobody', () => {
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(PS.portalSpot([0, 5, 0], 0), [0, 5, PS.PORTAL_AHEAD]), 'yaw 0 faces +z ([sin, cos] - world.js playerForward)');
  assert.ok(near(PS.portalSpot([1, 5, 1], Math.PI / 2), [1 + PS.PORTAL_AHEAD, 5, 1]));
  assert.ok(near(PS.portalSpot([0, 5, 0], 0, () => 1.5), [0, 4.5, PS.PORTAL_AHEAD]), 'the probe\'s ground (a metre over the feet, down)');
  assert.ok(near(PS.portalSpot([0, 5, 0], 0, () => null), [0, 5, PS.PORTAL_AHEAD]), 'no ground: the feet\'s height');
  assert.ok(PS.PORTAL_AHEAD > PS.PORTAL_REACH, 'the opener stands outside their own portal');
  const at = [0, 0, 0];
  assert.deepEqual(PS.portalStepIn(null, [0, 0, 0], at), { inside: true, entered: false }, 'never asked: no entry');
  assert.deepEqual(PS.portalStepIn(true, [0, 0, 0], at), { inside: true, entered: false }, 'standing in: no entry');
  assert.deepEqual(PS.portalStepIn(false, [PS.PORTAL_REACH - 0.01, 0, 0], at), { inside: true, entered: true });
  assert.deepEqual(PS.portalStepIn(false, [PS.PORTAL_REACH + 0.01, 0, 0], at), { inside: false, entered: false });
  assert.deepEqual(PS.portalStepIn(false, [0, PS.PORTAL_REACH_Y + 0.01, 0], at), { inside: false, entered: false }, 'over it is not in it');
  assert.equal(PS.insidePortal(null, at), false);
});

test('PORTAL1 the wire: the opener says where it stands, the pixel and the time left - never the name; a field outside its law refuses the record whole', () => {
  const gate = { id: 'k3x0', native: [1.234, 2.5, -3.456], dest: { pixel: { x: 12, y: 345 }, name: 'Daggerfall' }, until: 31000 };
  const w = PS.portalWire(gate, 1000);
  assert.deepEqual(w, { i: 'k3x0', p: [1.23, 2.5, -3.46], d: [12, 345], r: 30000 });
  assert.ok(!JSON.stringify(w).includes('Daggerfall'), 'the name is read off each receiver\'s map');
  assert.deepEqual(PS.validPortalRecord(w), w);
  const bad = [
    null, [], 'x', { ...w, i: 'a b' }, { ...w, i: 'x'.repeat(25) }, { ...w, i: 7 },
    { ...w, p: [1, 2] }, { ...w, p: [1, NaN, 2] }, { ...w, p: [1e12, 0, 0] }, { ...w, p: [0, 1e9, 0] },
    { ...w, d: [1.5, 2] }, { ...w, d: [-1, 2] }, { ...w, d: [1000, 2] }, { ...w, d: [2, 500] }, { ...w, d: [2] },
    { ...w, r: 0 }, { ...w, r: -5 }, { ...w, r: PS.PORTAL_OPEN_MS + 1 }, { ...w, r: Infinity },
  ];
  for (const b of bad) assert.equal(PS.validPortalRecord(b), null, JSON.stringify(b));
  assert.deepEqual(PS.validPortalRecord({ ...w, r: PS.PORTAL_OPEN_MS, extra: 1 }), { ...w, r: PS.PORTAL_OPEN_MS }, 'projected: nothing else rides');
});

test('PORTAL1 the vortex held: a hold of its own and a place of its own - COMPANION-PORTAL\'s defaults untouched', () => {
  assert.equal(portalLife(), PORTAL_MS.open + PORTAL_MS.hold + PORTAL_MS.close);
  assert.equal(portalLife({ holdMs: 5000 }), PORTAL_MS.open + 5000 + PORTAL_MS.close);
  assert.equal(portalOpenAt(PORTAL_MS.open + 4000, { holdMs: 5000 }).open, 1, 'held');
  assert.equal(portalOpenAt(portalLife({ holdMs: 5000 }), { holdMs: 5000 }).done, true, 'sealed at its life');
  assert.equal(portalOpenAt(PORTAL_MS.open + PORTAL_MS.hold + PORTAL_MS.close).done, true, 'a companion\'s as ever');
  const r = fakeRenderer();
  let now = 0;
  const set = createPortalSet({ renderer: r, now: () => now });
  const p = set.open([10, 0, 10], { holdMs: 5000, fixed: true });
  now = 100; set.tick([10, 1.6, 0]);
  assert.deepEqual([p.origin[0], p.origin[2]], [10, 10], 'fixed: where it opened, never a step behind from the eye');
  now = 4000; set.tick(); assert.equal(set.count, 1);
  set.remove(p); assert.equal(set.count, 0); assert.deepEqual(r.freed, [p.batch], 'removed, its batch freed');
  set.remove(p); assert.equal(r.freed.length, 1, 'once');
});

test('PORTAL1 the pool: mine opened and walked into once, peers\' kept to their own time, a bad word or a nameless pixel refused, the same word refreshing, another replacing; my word said only near it', () => {
  let now = 1000;
  const r = fakeRenderer();
  const entered = [];
  const places = new Map([['12,345', 'Daggerfall'], ['40,40', 'Wayrest']]);
  const gates = createPortalGates({
    renderer: r, now: () => now,
    toScene: (p) => [p[0] - 100, p[1], p[2]], toWire: (p) => [p[0] + 100, p[1], p[2]],   // a floating origin 100 along x
    destOf: (x, y) => (places.has(`${x},${y}`) ? { pixel: { x, y }, name: places.get(`${x},${y}`) } : null),
    onEnter: (g) => entered.push(g.dest.name),
  });
  const g = gates.open([0, 0, 2], { pixel: { x: 12, y: 345 }, name: 'Daggerfall' });
  assert.deepEqual(g.native, [100, 0, 2], 'kept in the world frame');
  assert.equal(gates.mine(), g);
  assert.equal(g.until, 1000 + PS.PORTAL_OPEN_MS);
  // standing on it as it opens takes nobody; walking off and back in does - once
  now += 100; gates.tick([0, 0, 2]); assert.deepEqual(entered, []);
  now += 100; gates.tick([0, 0, 0]);
  now += 100; assert.equal(gates.tick([0, 0, 2], { canEnter: false }), null, 'the host busy: nobody through');
  now += 100; gates.tick([0, 0, 0]);
  now += 100; assert.equal(gates.tick([0, 0, 2])?.dest.name, 'Daggerfall');
  now += 100; gates.tick([0, 0, 2]); assert.deepEqual(entered, ['Daggerfall'], 'once a step');
  now += 100; gates.tick(null); now += 100; gates.tick([0, 0, 2]); assert.deepEqual(entered, ['Daggerfall'], 'off foot and back is not a step');
  now += 100; gates.tick([0, 0, 0]); now += 100; gates.tick(null); now += 100; gates.tick([0, 0, 2]);
  assert.deepEqual(entered, ['Daggerfall'], 'outside, off foot, back on foot inside (a dismount, a door): the step is forgotten - no entry');
  // my word: near it, else none
  const w = gates.wireRecord([100, 0, 0]);
  assert.deepEqual(w.d, [12, 345]); assert.deepEqual(w.p, [100, 0, 2]); assert.equal(w.r, g.until - now);
  assert.equal(gates.wireRecord([100 + PORTAL_SAY_REACH + 3, 0, 0]), null, 'far behind me, said to nobody');
  assert.equal(gates.wireRecord(null), null);
  // a peer's
  assert.equal(gates.applyOwner('p1', { ...w, i: 'z9', d: [7, 7] }), false, 'a pixel with no place');
  assert.equal(gates.applyOwner('p1', { ...w, r: 0 }), false);
  assert.equal(gates.applyOwner(null, w), false, 'never ownerless (mine)');
  assert.equal(gates.applyOwner('p1', { i: 'z9', p: [140, 0, 0], d: [40, 40], r: 5000 }), true);
  const peer = gates.gates.find((x) => x.owner === 'p1');
  assert.equal(peer.dest.name, 'Wayrest', 'named off my map');
  assert.equal(r.made.length, 2);
  now += 1000;
  assert.equal(gates.applyOwner('p1', { i: 'z9', p: [140, 0, 0], d: [40, 40], r: 4000 }), true);
  assert.equal(r.made.length, 2, 'the same portal said again keeps its look');
  assert.equal(gates.mine(), g, 'a peer\'s is never mine');
  // the peer walks in: I step through theirs
  now += 100; gates.tick([0, 0, 0]);
  now += 100; gates.tick([40, 0, 0]);
  assert.deepEqual(entered, ['Daggerfall', 'Wayrest']);
  // another word replaces it; it runs out on its own time, with no word since
  assert.equal(gates.applyOwner('p1', { i: 'z10', p: [150, 0, 0], d: [40, 40], r: 2000 }), true);
  assert.equal(gates.gates.filter((x) => x.owner === 'p1').length, 1);
  assert.equal(r.freed.length, 1, 'the replaced one freed');
  now += 2001; gates.tick(null);
  assert.equal(gates.gates.filter((x) => x.owner === 'p1').length, 0, 'gone at its time');
  // mine runs out
  now = g.until; gates.tick(null);
  assert.equal(gates.mine(), null); assert.equal(gates.gates.length, 0);
  // one of mine at a time; a teardown clears all
  gates.open([0, 0, 0], { pixel: { x: 12, y: 345 }, name: 'Daggerfall' });
  gates.open([5, 0, 0], { pixel: { x: 40, y: 40 }, name: 'Wayrest' });
  assert.equal(gates.gates.length, 1); assert.equal(gates.mine().dest.name, 'Wayrest');
  gates.applyOwner('p2', { i: 'q', p: [0, 0, 0], d: [40, 40], r: 1000 });
  gates.clear();
  assert.equal(gates.gates.length, 0); assert.equal(gates.batches().length, 0);
});

test('PORTAL1 the counter\'s row on the classic popups: under the panel, its key P, the popup closed before the sale asks - no hook, no row', () => {
  for (const [Win, px, py, ph] of [[MerchantServiceWindow, MERCHANT_PANEL_X, MERCHANT_PANEL_Y, MERCHANT_PANEL_H], [MerchantRepairWindow, REPAIR_PANEL_X, REPAIR_PANEL_Y, REPAIR_PANEL_H]]) {
    const [rx, ry, rw, rh] = portalRowRect(ph);
    assert.equal(ry, ph + 2, 'just under the art');
    const order = [];
    const w = new Win({ service: 'Sell', portal: { label: PS.PORTAL_TEXT.row, onBuy: () => order.push(['buy', w.done]) }, onClose: () => order.push(['close']) });
    w.click(px + rx + rw / 2, py + ry + rh / 2);
    assert.deepEqual(order, [['close'], ['buy', true]], `${Win.name}: closed, then the sale`);
    const k = [];
    const w2 = new Win({ service: 'Sell', portal: { label: 'x', onBuy: () => k.push('buy') } });
    w2.input(PORTAL_ROW_KEY);
    assert.deepEqual(k, ['buy']); assert.equal(w2.done, true);
    const bare = new Win({ service: 'Sell' });
    bare.click(px + rx + rw / 2, py + ry + rh / 2);
    bare.input(PORTAL_ROW_KEY);
    assert.equal(bare.done, false, `${Win.name}: no hook, no row and no key`);
  }
  assert.equal(PORTAL_ROW_KEY, 'KeyP');
  assert.equal(PS.PORTAL_TEXT.row, 'Portal Stone (5 shards)');
  for (const door of ['src/ui/merchantServiceDoor.js', 'src/ui/merchantRepairDoor.js']) {
    assert.match(read(door), /\.\.\.\(hooks\.portal \? \[\{ label: hooks\.portal\.label, onClick: \(\) => \{ close\(\); hooks\.portal\.onBuy\?\.\(\); \} \}\] : \[\]\),/, `${door}: the Enhanced Plus panel's button`);
  }
});

test('PORTAL1 the hosts: every shop\'s keeper sells it (a teller and a mod\'s service never); the open world opens and draws the portals, says and hears them on the foes frame; a building\'s pack refuses in words, and the dungeon\'s and the street\'s have no door', () => {
  const wm = read('src/scenes/worldModes.js');
  assert.match(wm, /const portalRow = \(\) => \(mode === 'interior' && isShop\(interiorBuilding\?\.buildingType\)\n\s+\? \{ label: PORTAL_TEXT\.row, onBuy: \(\) => askPortalStone\(\) \} : undefined\);/);
  assert.match(wm, /onSell: \(\) => openMerchantSell\(\),\n\s+portal: portalRow\(\),/, 'the repair shop\'s popup');
  assert.match(wm, /portal: banking \|\| custom \? undefined : portalRow\(\),/, 'the plain shop\'s - never a bank\'s or a mod\'s service');
  assert.match(wm, /const sale = buyPortalStone\(playerEntity\.items, \{\n\s+canCarry: \(item, rest\) => planTake\(item, \{ bag: rest, entity: playerEntity, dryRun: true \}\)\.ok,/, 'the pack\'s own carry gate');
  const w = read('src/scenes/world.js');
  assert.match(w, /openPortal: \(item, list\) => openPortalStone\(item, list\),/, 'the pack\'s door (the interior\'s pack is this host\'s)');
  assert.match(w, /if \(_mode\(\) !== 'exterior'\) return refuse\(PORTAL_TEXT\.notHere\);/);
  assert.match(w, /travelOptions: \(\) => null,[^\n]*\n\s+onTeleport: \(pick\) => \{ standPortal\(pick, item, live\); \},/, 'the guild\'s teleport map, no fee');
  assert.match(w, /if \(!spendPortalStone\(item, live\(\)\)\) \{ townTalk\.say\(PORTAL_TEXT\.gone\); return; \}/, 'one stone, at the pick');
  assert.match(w, /onEnter: \(g\) => \{ hudFade\.smashHUDToBlack\(\); teleportTo\(g\.dest\); \},/, 'the guild\'s arrival');
  assert.match(w, /if \(cell\) \{ const rk = raidWireWord\(\); if \(rk\) frame\.rk = rk; \} if \(cell\) portalWord\(frame, full\);/, 'my portal on my foes frame, the line\'s last word');
  assert.match(w, /const portalWord = \(frame, full\) => \{\n\s+if \(!full\) return;\n\s+const pg = portalGates\.wireRecord\(campToWire\([^\n]*\)\);\n\s+if \(pg\) frame\.pg = pg;/, '...on every full frame, near it');
  assert.match(w, /exteriorFoes\.setOnPortals\(\(from, r\) => \{ portalGates\.applyOwner\(from, r\); \}\);/);
  assert.match(w, /portalGates\.tick\(_mode\(\) === 'exterior' && walkMode && playerSpawned \? player\.feetAt\(\) : null, \{ canEnter: !worldMoveBusy\(\) && !_teleporting && playerEntity\.health > 0 \}\);/);
  assert.match(w, /if \(_mode\(\) === 'exterior'\) livePersonBatches\.push\(\.\.\.portalGates\.batches\(\)\);/);
  assert.match(w, /camps\.restore\(restandAt\('pos'\)\(w\.camps\), campFromNatives\);   \/\/ SURV3\n\s+portalGates\.clear\(\);   \/\/ PORTAL1: a load/, 'a load ends every portal');
  const f = read('src/scenes/exteriorFoes.js');
  assert.match(f, /if \(data\.pg !== undefined\) _onPortals\?\.\(from, data\.pg\);[^\n]*\n\s+if \(data\.hv !== undefined\) _onHcc/, 'past the pool\'s room test, beside the camps');
  assert.doesNotMatch(read('server/src/index.js'), /\bpg\b/, 'the relay reads nothing inside a foes frame - no relay change, no version');
  assert.match(read('src/scenes/shared.js'), /import '\.\.\/systems\/portalStone\.js';/, 'the Use registers in every host');
  for (const host of ['src/scenes/dungeonContext.js', 'src/scenes/exterior.js']) assert.doesNotMatch(read(host), /openPortal/, `${host}: no door - the reader says PORTAL_TEXT.notHere`);
});
