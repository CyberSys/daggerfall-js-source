// WHERE-ROBES (FIELD BUGS 2026-10-04c, Balcony on Discord, "THE QUALIFYING EXAMINATION - Quest bug": "my letter says
// for me to steel priests Robes from Hawkton residence and i did it.. i should give me another letter with were should i
// go to bring the quest item and go on, but the didn't get the letter and nothing changed in quest dialog.. so i can't do
// my Class guild promotion quest."; `bible/01-Overview/Field-Bugs-2026-10-04c.md`).
//
// O0A0AL00's `_S.03_` is `clicked item _clothing_ say 1018` / `get item _note_`: the note that names the guild's man
// rides the CLICK on the robes, and DFU sends that click from two places only - the stand in the world
// (QuestResourceBehaviour.DoClick) and the loot list's row (DaggerfallInventoryWindow.cs:2027-2037, the first act of
// RemoteItemListScroller_OnItemClick, the right click included). The port has more doors onto a loot row than that one
// list, and three of them took a quest item without the click: quick loot (on by default), the enhanced skin's
// right-click/long-press/pad-Y menu, and its pad's X. Every fixture from its producer: the quest is the vendored
// script on the real QuestMachine, the robes are its own `_clothing_`, and the trigger is ticked, not read.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { sendQuestItemClick } from '../src/systems/itemTransfer.js';
import { hoverLines } from '../src/systems/worldHover.js';
import { foldQuickLoot, quickLootTake, quickLootArm, resetQuickLoot } from '../src/systems/quickLoot.js';
import { PREF_DEFAULTS, setPref } from '../src/systems/uiPrefs.js';
import { mountEnhancedInventory, inventoryQuickAct } from '../src/ui/enhancedInventory.js';
import { _resetForTests } from '../src/systems/settings.js';
import { withDom } from './invdrag.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}

/** The flattened words of a popup's tokens. */
const words = (tokens) => (tokens ?? []).map((t) => t.text ?? '').join(' ').replace(/\s+/g, ' ');

/** The Qualifying Examination, begun: the beggar's letter in hand, the robes minted and somewhere not the pack. Its
 *  map placements want a loaded world, so those lines are left out (the AUDIT TIMEFREE II harness's cut) - the robes'
 *  click and `_S.03_` are what is asked. */
function examination() {
  const now = { s: 1e6 };
  const popups = [], given = [];
  const m = new QuestMachine({
    nowSeconds: () => now.s, isPlayerInTown: () => true,
    getQuestSourceLines: (n) => rd(`vendor/dfu-quests/Quests/${n}.txt`).split(/\r?\n/).filter((l) => !/^\s*(place npc|place item|create npc at)/.test(l)),
    showPopup: (_q, tokens) => popups.push(words(tokens)),
    giveItemToPlayer: (it) => given.push(it),
  });
  const q = m.startQuestByName('O0A0AL00');
  const step = (n = 2) => { for (let i = 0; i < n; i++) { now.s += 1; m.tick(); } };
  step();
  const robes = q.getItem({ name: 'clothing' }).daggerfallUnityItem;
  const note = q.getItem({ name: 'note' }).daggerfallUnityItem;
  return { m, q, robes, note, popups, given, step, getQuest: (uid) => m.getQuest(uid) };
}
/** Whether the robes' note reached the player: message 1018 said and `_note_` given. */
const noteCame = (e) => e.popups.some((p) => /As you pick up the/.test(p) && /note is tucked/.test(p)) && e.given.includes(e.note);

test('WHERE-ROBES: the examination as DFU runs it - a click on the robes says 1018 and hands over the note; no click, no note (the trigger is the click, ticked through the real machine)', () => {
  const e = examination();
  assert.equal(e.robes.questItem, true, 'the robes are the quest\'s own item');
  assert.equal(e.popups.length, 1, 'the beggar\'s line alone so far');
  e.step(5);
  assert.equal(noteCame(e), false, 'unclicked, nothing comes');
  assert.equal(sendQuestItemClick(e.robes, e.getQuest), true, 'the one home clicks the quest\'s Item');
  e.step();
  assert.equal(noteCame(e), true, '"As you pick up the ... A note is tucked inside" - and the note');
});

test('WHERE-ROBES: the one home answers nothing for what is not a live quest item - a plain item, a quest gone, no resolver - and never throws (C# NREs on a missing symbol)', () => {
  const e = examination();
  assert.equal(sendQuestItemClick({ name: 'Priestess Robes', templateIndex: 201 }, e.getQuest), false, 'a wardrobe\'s robes are nobody\'s quest');
  assert.equal(sendQuestItemClick({ ...e.robes, questUID: e.robes.questUID + 999 }, e.getQuest), false, 'a quest no longer held');
  assert.equal(sendQuestItemClick({ ...e.robes, questSymbol: { name: 'nothere' } }, e.getQuest), false, 'a symbol the quest has not');
  assert.equal(sendQuestItemClick(e.robes, null), false, 'a host with no machine');
  assert.equal(sendQuestItemClick(null, e.getQuest), false);
  e.step(3);
  assert.equal(noteCame(e), false, 'and none of them clicked anything');
});

// ── QUICK LOOT: the row taken with no window ───────────────────────────────────────────────────────────────────────

/** The feature with its switch on and its state clean, restored after (test/quickloot.test.js's own). */
function withQuickLoot(fn) {
  setPref('quickLoot', true);
  resetQuickLoot();
  try { return fn(); } finally { resetQuickLoot(); setPref('quickLoot', PREF_DEFAULTS.quickLoot); }
}
/** A frame as resolveHover mints one, the rows hoverLines' own. */
const frameOf = (key, items) => {
  const { shown, rest, empty } = hoverLines(items);
  return { key, kind: 'items', title: 'Loot Pile', subs: [], rows: shown, rest, empty };
};
const thief = () => ({ name: 'Balcony', items: [], goldPieces: 0, stats: { strength: 50 } });

test('WHERE-ROBES: QUICK LOOT\'s take is the loot row\'s click - the robes off a pile with E send the quest click, and the note comes (mutant: the click left out of takeThrough)', () => withQuickLoot(() => {
  const e = examination();
  const p = thief();
  const pile = [e.robes];
  foldQuickLoot(frameOf('droppedLoot:3', pile));
  const got = quickLootTake('droppedLoot:3', { items: () => pile }, p, () => {}, { getQuest: e.getQuest });
  assert.equal(got, e.robes, 'taken, no window');
  assert.deepEqual([pile.length, p.items[0]], [0, e.robes], 'off the pile, into the pack');
  e.step();
  assert.equal(noteCame(e), true, 'the click reached `_S.03_`: 1018 said, the note given');
}));

test('WHERE-ROBES: QUICK LOOT\'s take-all (P) clicks every quest item it takes, as a click on each row would', () => withQuickLoot(() => {
  const e = examination();
  const p = thief();
  const body = [{ name: 'Dagger', group: 'Weapons', templateIndex: 113 }, e.robes];
  foldQuickLoot(frameOf('foeCorpse:1', body));
  assert.equal(quickLootArm('QuickLootAll'), true);
  quickLootTake('foeCorpse:1', { items: () => body }, p, () => {}, { getQuest: e.getQuest });
  assert.equal(body.length, 0, 'the lot taken');
  e.step();
  assert.equal(noteCame(e), true);
}));

// ── THE ENHANCED SKIN: the menu and the pad's quick act ─────────────────────────────────────────────────────────────

/** The enhanced pack over a loot pile - the remote target the hosts hand it (`loot.items`) and their quest resolver. */
function overPile(e, pile, fn) {
  const prev = globalThis.location, prevWin = globalThis.window, hadWin = 'window' in globalThis;
  globalThis.location = { search: '?skin=enhanced' };
  globalThis.window = { innerWidth: 1280, innerHeight: 800 };   // the menu is placed beside the pointer (placeBeside reads the view)
  _resetForTests();
  try {
    withDom((dom) => {
      const host = dom.mk('div'); dom.body.append(host);
      const p = thief();
      let view = null;
      view = mountEnhancedInventory(host, { entity: p, items: () => p.items, loot: { items: () => pile }, getQuest: e.getQuest, onExit: () => view?.unmount() });
      try {
        const lootRow = () => host.querySelectorAll('.itemrow').find((r) => r.closest('.loot-win') && r._padItem === e.robes) ?? null;
        fn({ dom, host, p, lootRow });
      } finally { view.unmount(); }
    });
  } finally { globalThis.location = prev; if (hadWin) globalThis.window = prevWin; else delete globalThis.window; _resetForTests(); }
}

test('WHERE-ROBES: the enhanced skin\'s RIGHT CLICK on a loot row (a long press, the pad\'s Y) is DFU\'s right click - the quest click goes first, then its Take takes (mutant: the menu\'s click left out)', () => {
  const e = examination();
  const pile = [e.robes];
  overPile(e, pile, ({ dom, p, lootRow }) => {
    const row = lootRow();
    assert.ok(row, 'the robes stand on the loot side');
    row.oncontextmenu({ preventDefault() {}, clientX: 10, clientY: 10 });
    const take = dom.body.querySelectorAll('.inv-menu-item').find((b) => b.textContent === 'Take');
    assert.ok(take, 'the menu offers Take');
    take.onclick({ stopPropagation() {} });
    assert.deepEqual([pile.length, p.items.includes(e.robes)], [0, true], 'taken through the menu');
  });
  e.step();
  assert.equal(noteCame(e), true, 'and `_S.03_` heard it');
});

test('WHERE-ROBES: the enhanced skin\'s pad X on a loot row is a click on it - the quest click, then the take (mutant: the quick act\'s click left out)', () => {
  const e = examination();
  const pile = [e.robes];
  overPile(e, pile, ({ p, lootRow }) => {
    const row = lootRow();
    row.isConnected = true;   // the harness's tree has no document to be connected to; the pane's row is in it
    assert.equal(inventoryQuickAct(row), true, 'the quick act acted');
    assert.deepEqual([pile.length, p.items.includes(e.robes)], [0, true], 'taken by X');
  });
  e.step();
  assert.equal(noteCame(e), true);
});

test('WHERE-ROBES: every door onto a loot row clicks through the ONE home - no inline copy of the send survives in either skin or quick loot', () => {
  const src = (f) => readFileSync(join(ROOT, f), 'utf8');
  for (const f of ['src/ui/nativeInventory.js', 'src/ui/enhancedInventory.js', 'src/systems/quickLoot.js']) {
    assert.doesNotMatch(src(f), /setPlayerClicked\(/, `${f}: the send is itemTransfer.js sendQuestItemClick's`);
  }
  // the native skin's one remote handler, the enhanced row, menu and quick act, and quick loot's take
  assert.equal((src('src/ui/nativeInventory.js').match(/sendQuestItemClick\(it, this\.hooks\.getQuest \?\? null\);/g) ?? []).length, 1);
  assert.equal((src('src/ui/enhancedInventory.js').match(/sendQuestItemClick\(item, deps\.getQuest \?\? null\)/g) ?? []).length, 3);
  assert.equal((src('src/systems/quickLoot.js').match(/sendQuestItemClick\(item, getQuest\);/g) ?? []).length, 1);
});

// ── THE PLAQUE: the robes named where they stand ────────────────────────────────────────────────────────────────────

test('WHERE-ROBES: a quest ITEM stand is named by the Item resource\'s own item - the robes read as the robes, not a nameless pile (mutant: the old field read)', async () => {
  const { questStandItem, questResourceName } = await import('../src/systems/worldTooltips.js');
  const { itemLongName } = await import('../src/systems/itemInfo.js');
  const e = examination();
  const clothing = e.q.getItem({ name: 'clothing' });
  assert.equal(questStandItem(clothing), e.robes, 'the resource the stand\'s behaviour targets carries its item here');
  const name = questResourceName(questStandItem(clothing), { archive: 204, record: 0 });
  assert.ok(name && name === itemLongName(e.robes, { differentiatePlantIngredients: false }), `named "${name}"`);
  // the mod's `is Item` gate: a Person or a Foe stand answers nothing, whatever it carries
  assert.equal(questStandItem(e.q.getPerson({ name: 'thiefmember' })), null, 'a quest person is never named here');
  assert.equal(questStandItem(e.q.getFoe({ name: 'F.00' })), null, 'nor a foe');
  assert.equal(questStandItem(null), null);
});

test('WHERE-ROBES: both hosts\' quest-stand namers ask the one reader - no namer reads a field no resource has', () => {
  const wm = readFileSync(join(ROOT, 'src/scenes/worldModes.js'), 'utf8');
  assert.equal((wm.match(/questResourceName\(questStandItem\(res\), \{ archive: st\.archive \?\? -1, record: st\.record \?\? -1 \}\)/g) ?? []).length, 2,
    'the building\'s namer and the dungeon\'s');
  assert.doesNotMatch(wm, /res\.daggerfallItem|res\.item \?\?/, 'the old read is gone from both');
});

// ── THE PRESS: the robes on a bed, a dresser, a shelf ───────────────────────────────────────────────────────────────

/** A real Collider holding a bed as a building files it (one shared bucket, the interior's own key): a mattress 0.5 m
 *  high from x 2..4, a headboard at its far end (x 3.9..4) up to 1.4 m - the bed's box, as worldAabb mints it, is the
 *  hull of both. Quads as two triangles each, every face. */
async function bedRoom() {
  const { Collider } = await import('../src/player/collider.js');
  const c = new Collider(() => -Infinity);
  const box = (x0, y0, z0, x1, y1, z1) => {
    const p = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    const f = [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]];
    return { positions: p.flat(), indices: f.flatMap(([a, b, cc, d]) => [a, b, cc, a, cc, d]) };
  };
  const mattress = box(2, 0, -1, 4, 0.5, 1), head = box(3.9, 0.5, -1, 4, 1.4, 1);
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  c.addMesh('interior', new Float32Array(mattress.positions), new Uint32Array(mattress.indices), I);
  c.addMesh('interior', new Float32Array(head.positions), new Uint32Array(head.indices), I);
  const wall = box(6, 0, -3, 6.2, 3, 3);   // the room's far wall, past the bed
  c.addMesh('interior', new Float32Array(wall.positions), new Uint32Array(wall.indices), I);
  const bed = { key: 'bed:0', aabb: { min: [2, 0, -1], max: [4, 1.4, 1] }, distance: 76.8, reach: 3.2, surface: true };
  // the robes, a 0.5 m pile standing on the mattress (questStandBox's shape: base-anchored, `width` square)
  const robes = { key: 'questflat:0', aabb: { min: [3.0, 0.5, -0.25], max: [3.5, 1.0, 0.25] }, distance: 3.2 };
  return { c, bed, robes };
}

test('WHERE-ROBES: furniture is struck at its MESH - the robes on a mattress win the press over the bed whose box holds them, in either list order; the mattress itself is still the bed (mutants: the surface law dropped; the box-containment test dropped; struck at the box\'s entry, not the surface)', async () => {
  const { pickActivatableHit } = await import('../src/player/activate.js');
  const { c, bed, robes } = await bedRoom();
  const eye = [1.0, 1.1, 0], toRobes = (() => { const d = [2.25, -0.35, 0]; const n = Math.hypot(...d); return d.map((v) => v / n); })();
  for (const list of [[bed, robes], [robes, bed]]) {
    assert.equal(pickActivatableHit(eye, toRobes, list, c)?.key, 'questflat:0', 'the ray reaches the robes before any of the bed');
  }
  // the box law the port had: the bed's box entered first, the robes lost (this is the report)
  assert.equal(pickActivatableHit(eye, toRobes, [{ ...bed, surface: false }, robes], c)?.key, 'bed:0', 'without the law the bed\'s box wins');
  // a look at the mattress is the bed's, at the mattress, whatever stands beside
  const down = (() => { const d = [1.5, -0.8, 0.6]; const n = Math.hypot(...d); return d.map((v) => v / n); })();
  const atBed = pickActivatableHit(eye, down, [bed, robes], c);
  assert.equal(atBed?.key, 'bed:0');
  assert.ok(atBed.distance > 0 && atBed.distance <= 3.2, 'struck where the mattress is');
  // a ray that crosses the bed's box above the headboard's reach and meets nothing of it never struck the bed
  const over = (() => { const d = [3, 0.5, 0]; const n = Math.hypot(...d); return d.map((v) => v / n); })();
  assert.equal(pickActivatableHit(eye, over, [bed], c), null, 'air over the bed is not the bed - the wall the ray meets is past its box');
});

test('WHERE-ROBES: a building\'s containers, beds and shelves and a dungeon\'s searchables race the ray by the surface law, and a shelf that does nothing is no target at all (DFU leaves a residence\'s shelf geometry)', () => {
  const wm = readFileSync(join(ROOT, 'src/scenes/worldModes.js'), 'utf8');
  for (const fam of ['container', 'bed', 'shelf']) {
    assert.match(wm, new RegExp(`targets\\.push\\(\\{ key: \`${fam}:\\$\\{i\\}\`[^\\n]*surface: true \\}\\);`), `${fam}: struck at its mesh`);
  }
  // THE FOUR HOSTS: a dungeon's searchable models (SEARCH1 - coffins, shelves, chests, crates) are the same case, in its
  // own shared 'dungeon' bucket; the street's headstones stand where no quest item can (a quest item's Place is a
  // building or a dungeon), and exterior.js stands no furniture
  const dc = readFileSync(join(ROOT, 'src/scenes/dungeonContext.js'), 'utf8');
  assert.match(dc, /targets\.push\(\{ key: `search:\$\{i\}`, aabb: sb\.aabb, distance: RAY_DISTANCE, reach: SEARCH_REACH, surface: true \}\)/, 'the dungeon\'s searchables too');
  assert.match(wm, /if \(shelvesAct\(interiorBuilding\)\) interiorCtx\.shelves\.forEach\(/, 'the shelves are targets only where they act');
  // the predicate is openShelf's three arms, asked as one question - a fourth arm added to the press must be added here
  assert.match(wm, /const shelvesAct = \(b\) => !!b && \(hallOfRecordsHere\(b\) \|\| isShop\(b\.buildingType\) \|\| isBookshelfBuilding\(b\.buildingType\)\);/);
  const open = wm.slice(wm.indexOf('  function openShelf(i) {'), wm.indexOf('    // A2: PlayerActivate.ActivateLootContainer\'s ShopShelves arm'));
  assert.match(open, /if \(hallOfRecordsHere\(b\)\) \{ openHallOfRecords\(b\); return; \}/);
  assert.match(open, /if \(!isShop\(b\.buildingType\)\) \{/);
  assert.match(open, /if \(isBookshelfBuilding\(b\.buildingType\)\) openBookshelf\(shelf, b\);/);
});

// ── A PARTY'S RESYNC: the pickup is this world's ────────────────────────────────────────────────────────────────────

test('WHERE-ROBES: a shared quest\'s resync between the pickup and the next tick keeps THIS world\'s click and pickup - the note still comes, and the stand does not stand again over robes in the pack (mutants: the click not kept; the pickup not kept)', async () => {
  const { QuestResourceBehaviour } = await import('../src/systems/quest/resourceBehaviour.js');
  const run = (resync) => {
    const e = examination();
    e.m.markQuestShared('O0A0AL00');
    const partner = JSON.parse(JSON.stringify(e.q.getSaveData()));   // the partner's copy: they have not touched the robes
    const clothing = e.q.getItem({ name: 'clothing' });
    // the stand, clicked - QuestResourceBehaviour.DoClick: the click, the robes to the player, the stand hidden
    const stand = new QuestResourceBehaviour(e.m);
    stand.assignResource(clothing);
    stand.start();
    assert.equal(stand.doClick(), true);
    assert.ok(e.given.includes(e.robes), 'the robes in hand');
    if (resync) e.m.updateSharedQuest('O0A0AL00', partner);   // the partner's word lands between frames, before the tick
    const live = e.q.getItem({ name: 'clothing' });
    e.step();
    return { e, live };
  };
  const solo = run(false);
  assert.equal(noteCame(solo.e), true, 'unshared, the note comes');
  const { e, live } = run(true);
  assert.notEqual(live, null);
  assert.equal(noteCame(e), true, '1018 said and the note given, through the resync');
  assert.equal(live.isHidden, true, 'the stand stays down - the robes are in the pack');
  // and the keep is THIS world's alone: a partner's envelope that says nothing of a click cannot make one up
  const quiet = examination();
  quiet.m.markQuestShared('O0A0AL00');
  quiet.m.updateSharedQuest('O0A0AL00', JSON.parse(JSON.stringify(quiet.q.getSaveData())));
  quiet.step(3);
  assert.equal(noteCame(quiet), false, 'no click here, none kept');
  assert.equal(quiet.q.getItem({ name: 'clothing' }).isHidden, false);
});
