// LOOT-CLICK (FIELD BUGS 2026-10-04b, the town-mods audit's quest finding "quick loot never tells the quest a quest item
// was taken"): R0C20Y07 gives its sapphire to a giant (`give item _item_ to _giant_`), and only `clicked item _item_`
// raises the questor's friend the sapphire must be carried to (`create npc _qgfriend_`). DFU's remote list tells the
// quest at every click on a quest item - the FIRST act of RemoteItemListScroller_OnItemClick
// (DaggerfallInventoryWindow.cs:2027-2037), ahead of its action-mode branch. Quick loot took the sapphire off the body
// through the window's own plan and move and never said it, so the friend was never created and the quest could not be
// completed; the enhanced window's right-click menu, its card's Take and the pad's quick act took it the same way.
// S0000503, N0B00Y06, O0B00Y11 and Q0C4XY04 gate on a clicked item a foe carries too.
//
// Every fixture is the producer's: the quest is the vendored R0C20Y07 through the real parser and machine, the body's
// pile is the giant's own item queue as AddItemQueue lands it on a corpse (Foe.getClonedItemQueue), and the takes are
// the real quick loot, the real classic window and the mounted enhanced window.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { QuestMachine } from '../src/systems/quest/machine.js';
import { setPref, PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { hoverLines } from '../src/systems/worldHover.js';
import * as quickLoot from '../src/systems/quickLoot.js';
import * as itemTransfer from '../src/systems/itemTransfer.js';
import { NativeInventoryWindow } from '../src/ui/nativeInventory.js';
import { mountEnhancedInventory, inventoryQuickAct } from '../src/ui/enhancedInventory.js';
import { _resetForTests } from '../src/systems/settings.js';
import { BUILDING_TYPES } from '../src/world/buildingNames.js';
import { withDom } from './invdrag.mjs';
import { loadTables, questScript, rmbBlock, rdbBlock, town, dungeon, worldOf } from './fb1004bTowns.mjs';

loadTables();
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** R0C20Y07 taken in the wilds of a region holding two towns of houses and a giants' stronghold (dungeon13): its
 *  start-up gives the sapphire to the giant, and the giant's body holds what AddItemQueue lands on a corpse. */
function giantQuest() {
  const blocks = new Map([
    ['HOUSES.RMB', rmbBlock('HOUSES.RMB', [{ type: BUILDING_TYPES.House2 }, { type: BUILDING_TYPES.House3 }, { type: BUILDING_TYPES.Tavern }])],
    ['DUNG.RDB', rdbBlock()],
  ]);
  const locations = [
    town({ name: 'Aldleigh', locationIndex: 0, mapId: 1001, grid: ['HOUSES.RMB'] }),
    town({ name: 'Bridgewood', locationIndex: 1, mapId: 1003, grid: ['HOUSES.RMB'] }),
    dungeon({ name: 'Giants Hold', locationIndex: 2, mapId: 1002, dungeonType: 13 }),
  ];
  const popups = [];
  const machine = new QuestMachine({
    nowSeconds: () => 0, world: worldOf({ locations, blocks }), getReputation: () => 0, changeReputation: () => {}, playerGender: () => 'male', playerLevel: () => 5,
    giveItemToPlayer: () => {}, showPopup: (_q, tokens) => popups.push(tokens.map((t) => t.text).join(' ').replace(/\s+/g, ' ').trim()),
  });
  const warn = console.warn; console.warn = () => {};   // the questor no NPC was clicked for compiles as a virtual one, and says so
  let quest;
  try { quest = machine.scheduleQuest(questScript('R0C20Y07'), 0, { rolls: () => 0.4 }); machine.tick(); } finally { console.warn = warn; }
  const giant = quest.getResource({ name: 'giant' });
  const sapphire = quest.getItem({ name: 'item' });
  return { machine, quest, popups, sapphire, body: giant.getClonedItemQueue(), getQuest: (uid) => machine.getQuest(uid) };
}
const triggered = (quest, name) => [...quest.tasks.values()].find((t) => t.symbol?.name === name)?.triggered ?? false;
/** The quick-loot switch on, the plaque lit over the body's pile (the fold the host runs every frame). */
function lit(key, items, fn) {
  setPref('quickLoot', true);
  quickLoot.resetQuickLoot();
  try {
    const { shown, rest, empty } = hoverLines(items);
    quickLoot.foldQuickLoot({ key, kind: 'items', title: 'Giant', subs: [], rows: shown, rest, empty });
    return fn();
  } finally { quickLoot.resetQuickLoot(); setPref('quickLoot', PREF_DEFAULTS.quickLoot); }
}
const hero = (strength = 50) => ({ items: [], goldPieces: 0, stats: { strength } });

test('LOOT-CLICK, the trace: R0C20Y07\'s sapphire, taken off the giant\'s body by quick loot, is the clicked item - `clicked item _item_` fires, says 1011, and the friend it gates is created (it never was)', () => {
  const { machine, quest, popups, sapphire, body, getQuest } = giantQuest();
  assert.equal(quest.questName, 'R0C20Y07');
  assert.equal(body.length, 1, 'the giant\'s body holds the sapphire (`give item _item_ to _giant_`, AddItemQueue)');
  assert.deepEqual([body[0].questItem, body[0].questUID, body[0].questSymbol?.name], [true, quest.uid, 'item'], 'the quest\'s own record, cloned');
  assert.equal(sapphire.hasPlayerClicked, false);
  const friend = quest.getResource({ name: 'qgfriend' });
  assert.notEqual(friend.assignedToHome, true, 'no friend before the sapphire is found');
  const p = hero();
  const got = lit('corpse:1', body, () => quickLoot.quickLootTake('corpse:1', { items: () => body }, p, () => {}, { getQuest }));
  assert.equal(got?.questItem, true, 'taken');
  assert.deepEqual(body, [], 'off the body');
  assert.equal(sapphire.hasPlayerClicked, true, 'and the quest heard it - DaggerfallInventoryWindow.cs:2027-2037\'s SetPlayerClicked');
  machine.tick();
  assert.ok(triggered(quest, 'pchasitem'), '`clicked item _item_` fired');
  assert.equal(popups.at(-1), 'You have found the sapphire.', 'say 1011');
  machine.tick(); machine.tick();
  assert.equal(friend.assignedToHome, true, '`create npc _qgfriend_` - the friend the toting task needs now stands at home');
});

test('LOOT-CLICK: quick loot\'s LOT (P) tells the quest of every quest item it takes, as a click on each row would', () => {
  const { quest, sapphire, body, getQuest } = giantQuest();
  const p = hero();
  const n = lit('corpse:1', body, () => { quickLoot.quickLootArm('QuickLootAll'); return quickLoot.quickLootTake('corpse:1', { items: () => body }, p, () => {}, { getQuest }); });
  assert.ok(n, 'the lot taken');
  assert.equal(p.items[0]?.questUID, quest.uid);
  assert.equal(sapphire.hasPlayerClicked, true);
});

test('LOOT-CLICK: the click comes FIRST, as DFU\'s does - a quest item the pack then refuses (too heavy to carry) has been clicked all the same; a row left for the window (a map) is the window\'s click, not the press\'s', () => {
  const { sapphire, body, getQuest } = giantQuest();
  const weak = { ...hero(0), stats: { strength: 0 } };
  const said = [];
  const r = lit('corpse:1', body, () => quickLoot.quickLootTake('corpse:1', { items: () => body }, weak, (l) => said.push(l), { getQuest }));
  assert.equal(r, quickLoot.QUICK_LOOT_REFUSED, 'refused: a hero with no strength carries nothing');
  assert.equal(body.length, 1, 'it stays on the body');
  assert.equal(sapphire.hasPlayerClicked, true, 'SetPlayerClicked runs above TransferItem');
  // a map is USED by the window, not taken (F156) - the press opens the window, whose own click tells the quest
  const map = { ...body[0], name: 'Map', group: 'Maps', templateIndex: 287 };
  sapphire.rearmPlayerClick();
  assert.equal(lit('corpse:2', [map], () => quickLoot.quickLootTake('corpse:2', { items: () => [map] }, hero(), () => {}, { getQuest })), null, 'null: the window opens');
  assert.equal(sapphire.hasPlayerClicked, false);
});

test('LOOT-CLICK: the one door - sendQuestItemClick sets the resource\'s PlayerClicked for a quest item whose quest holds it, and answers false for any other item, an unresolvable quest or a symbol the quest no longer holds', () => {
  const { quest, sapphire, body, getQuest } = giantQuest();
  assert.equal(itemTransfer.sendQuestItemClick(body[0], getQuest), true);
  assert.equal(sapphire.hasPlayerClicked, true);
  sapphire.rearmPlayerClick();
  assert.equal(itemTransfer.sendQuestItemClick({ ...body[0], questItem: false }, getQuest), false, 'not a quest item');
  assert.equal(itemTransfer.sendQuestItemClick(body[0], () => null), false, 'no quest');
  assert.equal(itemTransfer.sendQuestItemClick(body[0], null), false, 'no resolver');
  assert.equal(itemTransfer.sendQuestItemClick({ ...body[0], questSymbol: { name: 'gone' } }, getQuest), false, 'no such item');
  assert.equal(sapphire.hasPlayerClicked, false, 'none of them clicked it');
  assert.equal(quest.getItem({ name: 'reward' }).hasPlayerClicked, false);
});

const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
test('LOOT-CLICK: the classic window\'s remote pick tells the quest through the same door (DFU\'s own click, as it always did)', () => {
  _resetForTests();
  const { sapphire, body, getQuest } = giantQuest();
  const bag = [];
  const w = new NativeInventoryWindow({ items: () => bag, icons: ICONS, loot: { items: () => body }, getQuest, entity: hero() });
  w._pickRemote(0, 'info');
  assert.equal(sapphire.hasPlayerClicked, true, 'an Info click on the remote list counts, as DFU\'s does (ahead of the action-mode branch)');
  assert.equal(body.length, 1, 'and takes nothing');
  sapphire.rearmPlayerClick();
  w._pickRemote(0, 'remove');
  assert.equal(sapphire.hasPlayerClicked, true);
  assert.equal(bag[0]?.questItem, true, 'taken');
});

/** The enhanced window over the body's pile, its remote rows by what they hold. The menu places itself by the
 *  window's size (placeBeside) and the pad acts only on a row in the document - the two things this DOM lacks. */
function withEnhanced(fn) {
  const hadWindow = 'window' in globalThis;
  if (!hadWindow) globalThis.window = globalThis;
  try {
    return withDom((dom) => {
      const host = dom.mk('div'); dom.body.append(host);
      const g = giantQuest();
      const e = { name: 'Janome', stats: { strength: 50 }, items: [], goldPieces: 0 };
      let view = null;
      view = mountEnhancedInventory(host, { entity: e, items: () => e.items, loot: { items: () => g.body }, getQuest: g.getQuest, onExit: () => view?.unmount() });
      const remoteRow = () => {
        const row = host.querySelectorAll('.itemrow').find((r) => r._padFrom === 'remote' && r._padItem?.questItem);
        if (row) row.isConnected = true;
        return row;
      };
      try { return fn({ ...g, dom, host, e, remoteRow }); } finally { view?.unmount(); }
    });
  } finally { if (!hadWindow) delete globalThis.window; }
}
const PRESS = { preventDefault() {}, stopPropagation() {}, clientX: 10, clientY: 10 };

test('LOOT-CLICK through the ENHANCED window: a right-click on the body\'s quest item is DFU\'s right-click on the remote list - the quest hears it before any act; the menu\'s Take takes it (it never told the quest)', () => {
  withEnhanced(({ sapphire, e, dom, remoteRow }) => {
    const row = remoteRow();
    assert.ok(row, 'the sapphire\'s row on the remote side');
    row.oncontextmenu(PRESS);
    assert.equal(sapphire.hasPlayerClicked, true, 'RemoteItemListScroller_OnItemRightClick: the click, whatever its mode');
    sapphire.rearmPlayerClick();
    const takeVerb = dom.body.querySelectorAll('.inv-menu-item').find((b) => b.textContent === 'Take');
    assert.ok(takeVerb, 'the menu offers Take');
    takeVerb.onclick(PRESS);
    assert.equal(e.items[0]?.questItem, true, 'taken');
    assert.equal(sapphire.hasPlayerClicked, true, 'and the take is a click on the remote list');
  });
});

test('LOOT-CLICK through the ENHANCED window: the pad\'s quick act (X over a row) takes the body\'s quest item and tells the quest; the row\'s own click still does', () => {
  withEnhanced(({ sapphire, e, remoteRow }) => {
    assert.equal(inventoryQuickAct(remoteRow()), true, 'the quick act took');
    assert.equal(e.items[0]?.questItem, true);
    assert.equal(sapphire.hasPlayerClicked, true);
  });
  withEnhanced(({ sapphire, e, remoteRow }) => {
    remoteRow().onclick(PRESS);
    assert.equal(e.items[0]?.questItem, true);
    assert.equal(sapphire.hasPlayerClicked, true);
  });
});

test('LOOT-CLICK: every door that takes off the remote side calls the one helper, and no window spells the chain itself - quick loot\'s take, the classic pick, the enhanced row, right-click and take (mutant: a door without it)', () => {
  const ql = rd('src/systems/quickLoot.js');
  const through = ql.slice(ql.indexOf('function takeThrough('), ql.indexOf('/**', ql.indexOf('function takeThrough(')));
  assert.ok(through.indexOf('sendQuestItemClick(item, getQuest);') > through.indexOf('if (isMap(item)) return null;')
    && through.indexOf('sendQuestItemClick(item, getQuest);') < through.indexOf('planTake('), 'quick loot: after the map is left for the window, before the plan');
  const nat = rd('src/ui/nativeInventory.js');
  const pick = nat.slice(nat.indexOf('  _pickRemote(slot'), nat.indexOf("if (mode === 'info')", nat.indexOf('  _pickRemote(slot')));
  assert.match(pick, /if \(it\.questItem\) sendQuestItemClick\(it, this\.hooks\.getQuest \?\? null\);/);
  const enh = rd('src/ui/enhancedInventory.js');
  const takeFn = enh.slice(enh.indexOf('function take(item) {'), enh.indexOf('planTake(', enh.indexOf('function take(item) {')));
  assert.match(takeFn, /sendQuestItemClick\(item, deps\.getQuest \?\? null\);/, 'the enhanced take');
  const menu = enh.slice(enh.indexOf('function openMenu(item, from, x, y) {'), enh.indexOf('hideTip();', enh.indexOf('function openMenu(item, from, x, y) {')));
  assert.match(menu, /if \(from === 'remote'\) sendQuestItemClick\(item, deps\.getQuest \?\? null\);/, 'the right-click');
  for (const f of ['src/ui/nativeInventory.js', 'src/ui/enhancedInventory.js', 'src/systems/quickLoot.js']) {
    assert.doesNotMatch(rd(f), /getItem\?\.\([^)]*\)\?\.setPlayerClicked/, `${f}: the chain is the helper's alone`);
  }
});
