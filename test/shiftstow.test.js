// WAGON-FILTER + SHIFT-STOW (2026-10-04, Mac: "The wagon needs a filter option and shift click to deposit items (like
// materials) needs to be a thing"). Pinned by DRIVING both skins: the enhanced pack mounted on the fake document
// (test/invdrag.mjs) and clicked with the browser's own event, the classic window through its own click and key arms.
//   - the filter (ui/storeFilter.js): the pack's nine pages and Materials over the wagon, the storage and the bag; the
//     search reads the row's name; a take from a filtered list takes that piece; other remotes carry no filter;
//   - Shift on a pack row puts the whole stack into the player's own store beside it, through the same ladder (the
//     750 kg, the bag's materials-only), never the ground or a corpse, and never a double click's wear;
//   - the classic window holds Shift as it holds Control, and Shift with the left button is Remove, whole, no popup.
// Mutants: tools/mutants/shiftstow.json.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withDom } from './invdrag.mjs';
import { mountEnhancedInventory, SHIFT_STOW_HINT } from '../src/ui/enhancedInventory.js';
import { NativeInventoryWindow, WAGON_KG_LIMIT } from '../src/ui/nativeInventory.js';
import { CELL_X } from '../src/ui/itemScroller.js';
import { STORE_FILTERS, STORE_FILTER_KINDS, filterStore, storeFilterChips, storeFilterAccepts, storeQuery } from '../src/ui/storeFilter.js';
import { SMALL_CART_TEMPLATE } from '../src/systems/inventorySession.js';
import { mintMaterialItem } from '../src/systems/profItems.js';
import { ITEM_TEMPLATES } from '../src/characters/paperdoll.js';
import { isEquipped } from '../src/systems/equip.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';
import { PACK_PAGES } from '../src/ui/packPages.js';
import { effectiveUnitWeightInKg, totalWeight } from '../src/systems/inventory.js';

const tmpl = (name) => ITEM_TEMPLATES.find((t) => t.name === name);
const mk = (name, group = 'Weapons', extra = {}) => {
  const t = tmpl(name);
  assert.ok(t, `${name} is not a template in this build`);
  return { name: t.name, templateIndex: t.index, group, stackCount: 1, currentCondition: t.hitPoints ?? 50, maxCondition: t.hitPoints ?? 50, ...extra };
};
const arrows = (n) => mk('Arrow', 'Weapons', { stackCount: n });
const ingots = (n) => { const it = mintMaterialItem('ingot:iron'); it.stackCount = n; return it; };
const cart = () => ({ name: 'Small cart', group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, stackCount: 1 });
const hero = (items) => ({ name: 'Aelwyn', career: { name: 'Spellsword' }, stats: { strength: 50, endurance: 48 }, items, goldPieces: 10 });
const textOf = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(textOf).join('')}`;
let clock = 0;
const epoch = () => (clock += 100_000);

/** The pack mounted with the wagon open (the cart's door pressed), or over `loot` when one is handed. */
function withWagon(items, wagon, fn, { loot = null, open = true } = {}) {
  _resetForTests();
  globalThis.location = { search: '?skin=enhanced' };
  return withDom((dom) => {
    const host = dom.mk('div');
    dom.body.append(host);
    const e = hero(items);
    e.wagonItems = wagon;
    const view = mountEnhancedInventory(host, { entity: e, items: () => e.items, wagonItems: () => e.wagonItems, onExit: () => {}, ...(loot ? { loot } : {}) });
    const rows = () => host.querySelectorAll('.itemrow');
    const rowOf = (name) => rows().find((r) => !r.closest('.loot-win') && textOf(r).includes(name)) ?? null;
    const lootRows = () => rows().filter((r) => !!r.closest('.loot-win')).map((r) => textOf(r));
    const lootRowOf = (name) => rows().find((r) => !!r.closest('.loot-win') && textOf(r).includes(name)) ?? null;
    const pack = () => JSON.parse(globalThis.__pack());
    const door = () => host.querySelectorAll('button').find((b) => b.onclick && /cart|wagon/i.test(textOf(b)) && !b.closest('.loot-win .remotelist'));
    const chip = (label) => host.querySelectorAll('.storechip').find((b) => b.textContent.startsWith(label)) ?? null;
    const search = () => host.querySelectorAll('input').find((i) => i.className === 'storesearch') ?? null;
    const click = (node, at, extra = {}) => node.onclick({ timeStamp: at, detail: 1, ...extra });
    const tabTo = (label) => host.querySelectorAll('.packtab').find((b) => b.textContent.startsWith(label)).onclick();
    try {
      if (open && !loot) { door().onclick(); assert.equal(pack().remoteKind, 'wagon'); }
      return fn({ dom, host, e, view, rowOf, lootRows, lootRowOf, pack, chip, search, click, tabTo });
    } finally { view.unmount(); }
  });
}

test('WAGON-FILTER storeFilter: All, Materials and the pack\'s nine pages; Materials is the bag\'s own test and crosses the pages; the search is the row\'s name, trimmed and lower-cased; the chips name what the store holds and keep the lit one (mutants: Materials read as a page, the query unlowered)', () => {
  assert.deepEqual(STORE_FILTERS.map(([id]) => id), ['all', 'materials', ...PACK_PAGES.map(([id]) => id)]);
  assert.deepEqual([...STORE_FILTER_KINDS].sort(), ['bag', 'storage', 'wagon']);
  const a = arrows(3), i = ingots(4), herb = mintMaterialItem('herb:PlantIngredients1:4') ?? null;
  assert.equal(storeFilterAccepts(i, 'materials'), true, 'an ingot is a material');
  assert.equal(storeFilterAccepts(i, 'misc'), true, '... and lives on Misc');
  assert.equal(storeFilterAccepts(a, 'materials'), false, 'an arrow is not');
  assert.equal(storeFilterAccepts(a, 'weapons'), true);
  assert.equal(storeFilterAccepts(a, 'nonsense'), true, 'an id the list does not have shows everything');
  if (herb) assert.equal(storeFilterAccepts(herb, 'materials'), true, 'a herb too, from the Ingredients page');
  assert.equal(storeQuery('  IRON  '), 'iron');
  const items = [a, i];
  assert.deepEqual(filterStore(items, { cat: 'all', query: ' IrOn ' }, (it) => it.name), [i]);
  assert.deepEqual(filterStore(items, { cat: 'materials' }, (it) => it.name), [i]);
  assert.deepEqual(filterStore(items, { cat: 'weapons', query: 'iron' }, (it) => it.name), []);
  assert.deepEqual(storeFilterChips(items, 'all').map((c) => `${c.id}:${c.count}`), ['all:2', 'materials:1', 'weapons:1', 'misc:1']);
  assert.deepEqual(storeFilterChips([a], 'materials').map((c) => `${c.id}:${c.count}`), ['all:1', 'materials:0', 'weapons:1'], 'the lit chip stays at nought');
});

test('WAGON-FILTER on the enhanced pack: the wagon carries the search and the chips; a chip and a search narrow the rows; a take from the narrowed list takes that piece; nothing matching says so (mutants: the rows unfiltered, the bar on every remote)', () => {
  withWagon([cart()], [arrows(20), ingots(6), mk('Mace')], ({ e, lootRows, lootRowOf, chip, search, click, pack }) => {
    assert.ok(search(), 'the wagon has its search');
    assert.deepEqual(['All', 'Materials', 'Weapons', 'Misc'].map((l) => !!chip(l)), [true, true, true, true]);
    assert.equal(lootRows().length, 3);
    chip('Materials').onclick();
    assert.equal(lootRows().length, 1);
    assert.match(lootRows()[0], /Iron Ingot/);
    click(lootRowOf('Iron Ingot'), epoch());
    assert.equal(e.items.filter((it) => /Ingot/.test(it.name)).length, 1, 'the ingots taken - the right piece out of the whole wagon');
    assert.equal(e.wagonItems.length, 2);
    // the lit chip stays at nought; All brings the rest back; the search narrows by name
    assert.ok(chip('Materials'), 'the lit chip stays');
    assert.match(lootRows()[0] ?? '', /Nothing|^$/);
    chip('All').onclick();
    const s = search();
    s.value = 'mac'; s.oninput();
    assert.deepEqual(lootRows().map((r) => /Mace/.test(r)), [true]);
    s.value = 'zzz'; s.oninput();
    assert.equal(lootRows().length, 0);
    assert.ok(pack().remoteKind === 'wagon');
  });
  // a corpse carries no bar: a glance is not a store
  const body = [arrows(2), mk('Mace')];
  withWagon([], [], ({ host, search, lootRows }) => {
    assert.equal(lootRows().length, 2, 'the body\'s rows are drawn');
    assert.equal(search(), null);
    assert.equal(host.querySelectorAll('.storefilter').length, 0);
  }, { loot: { items: () => body } });
});

test('SHIFT-STOW on the enhanced pack: Shift on a pack row stows the whole stack in the wagon in one press - no card - and a quick second one on a refused piece never wears it; a plain click still only picks; the hint says the gesture (mutants: the shift arm gone, the arm after the double click, the arm on the ground)', () => {
  withWagon([cart(), arrows(30), mk('Mace'), mk('Dagger')], [], ({ e, rowOf, click, pack, host }) => {
    assert.ok(host.querySelectorAll('.storehint').some((p) => p.textContent === SHIFT_STOW_HINT.wagon), 'the hint under the wagon\'s head');
    const T = epoch();
    click(rowOf('Arrow'), T);
    assert.equal(e.wagonItems.length, 0, 'a plain click picks');
    assert.equal(pack().picked, 'Arrow');
    click(rowOf('Arrow'), T + 5000, { shiftKey: true });
    assert.deepEqual(e.wagonItems.map((it) => `${it.name}:${it.stackCount}`), ['Arrow:30'], 'the whole stack, in one press');
    assert.equal(e.items.some((it) => it.name === 'Arrow'), false);
  });
  // a full wagon refuses the Mace, and the Mace stays on its row: two quick shift-clicks on it are two refusals, never
  // the double click that wears it
  const brim = () => Array.from({ length: Math.floor(WAGON_KG_LIMIT / effectiveUnitWeightInKg(mk('Mace'))) }, () => mk('Mace'));
  withWagon([cart(), mk('Mace')], brim(), ({ e, rowOf, click, pack }) => {
    const T = epoch();
    click(rowOf('Mace'), T, { shiftKey: true });
    click(rowOf('Mace'), T + 100, { shiftKey: true, detail: 2 });
    assert.equal(e.items.some(isEquipped), false, 'not worn');
    assert.ok(e.items.some((it) => it.name === 'Mace'), 'still in the pack');
    assert.ok(pack().notice, 'the wagon\'s refusal is said');
  });
  // the ground: Shift is a plain click there - nothing dropped
  withWagon([arrows(5)], [], ({ e, rowOf, click, pack }) => {
    click(rowOf('Arrow'), epoch(), { shiftKey: true });
    assert.equal(e.items.length, 1, 'nothing dropped on the ground');
    assert.equal(pack().picked, 'Arrow');
  }, { open: false });
});

test('SHIFT-STOW goes through the ladder: the wagon\'s 750 kg takes what fits; the player\'s own storage takes it as the wagon does', () => {
  const unit = effectiveUnitWeightInKg(ingots(1));
  const room = 2.5 * unit;   // the wagon loaded to two and a half ingots short of its limit
  const load = () => { const it = mk('Mace'); return Array.from({ length: Math.floor((WAGON_KG_LIMIT - room) / effectiveUnitWeightInKg(it)) }, () => mk('Mace')); };
  withWagon([cart(), ingots(40)], load(), ({ e, rowOf, click, tabTo }) => {
    const before = totalWeight(e.wagonItems);
    tabTo('Misc');
    click(rowOf('Iron Ingot'), epoch(), { shiftKey: true });
    const moved = e.wagonItems.filter((it) => /Ingot/.test(it.name)).reduce((n, it) => n + it.stackCount, 0);
    assert.equal(moved, Math.floor((WAGON_KG_LIMIT - before) / unit), `what fits went in, and no more: ${moved}`);
    assert.equal(e.items.find((it) => /Ingot/.test(it.name))?.stackCount, 40 - moved, 'the rest stays in the pack');
  });
  const chest = [];
  withWagon([arrows(12)], [], ({ e, rowOf, click }) => {
    click(rowOf('Arrow'), epoch(), { shiftKey: true });
    assert.deepEqual([chest.length, e.items.length], [1, 0], 'into the chest');
  }, { loot: { items: () => chest, storage: true } });
});

// ── the classic window
const ICONS = { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() };
const firstSlot = (w, right = false) => w.click(163 + CELL_X + 5, 48 + 5, right);
const classic = (bag, wagon, extra = {}) => {
  const w = new NativeInventoryWindow({ items: () => bag, wagonItems: () => wagon, icons: ICONS, ...extra });
  return w;
};

test('SHIFT-STOW on the classic window: Shift is held as Control is (down edge, up edge, and the pointer\'s own word); Shift and the left button on a pack slot are Remove into the wagon, the whole stack, whatever the mode - no popup on a partial fit; the ground, a right click and no Shift keep DFU\'s click (mutants: the latch never raised, the popup kept, the shift arm on the ground)', () => {
  const bag = [cart(), arrows(10)];
  const wagon = [];
  const w = classic(bag, wagon);
  w.click(226 + 5, 14 + 5);   // the wagon button
  assert.equal(w.usingWagon, true);
  w.mode = 'info';
  w.input('ShiftLeft', { code: 'ShiftLeft', key: 'Shift' });
  assert.equal(w._shiftDown, true, 'the down edge');
  w.keyup('ShiftLeft', { code: 'ShiftLeft', key: 'Shift' });
  assert.equal(w._shiftDown, false, 'the up edge');
  w.hover(10, 10, { shiftKey: true, buttons: 0 });
  assert.equal(w._shiftDown, true, 'the pointer says Shift is down');
  firstSlot(w, true);
  assert.equal(wagon.length, 0, 'a right click is not the gesture');
  assert.ok(w.topBox, '... it is the mode\'s own (Info\'s box)');
  w.click(10, 10);   // the click-anywhere box answers the press
  assert.equal(w.topBox, null);
  firstSlot(w);
  assert.deepEqual(wagon.map((it) => `${it.name}:${it.stackCount}`), ['Arrow:10'], 'Remove, whole, in Info mode');
  assert.equal(w.inputBox, null);
  // a partial fit: the wagon nearly full takes what fits, with no how-many popup
  const iUnit = effectiveUnitWeightInKg(ingots(1));
  const full = Array.from({ length: Math.floor((WAGON_KG_LIMIT - 20.5 * iUnit) / effectiveUnitWeightInKg(mk('Mace'))) }, () => mk('Mace'));
  const bag2 = [ingots(200), cart()];   // the ingots first on the tab (the cart is a misc piece too)
  const w2 = classic(bag2, full);
  w2.click(226 + 5, 14 + 5);
  w2.tab = 'clothing';   // DFU's fourth tab holds the misc pieces (tabAccepts)
  w2.hover(10, 10, { shiftKey: true });
  firstSlot(w2);
  assert.equal(w2.inputBox, null, 'no popup');
  const moved = full.filter((it) => /Ingot/.test(it.name)).reduce((n, it) => n + it.stackCount, 0);
  assert.equal(moved, Math.floor((WAGON_KG_LIMIT - totalWeight(full.filter((it) => !/Ingot/.test(it.name)))) / iUnit), `what fits went, with no popup: ${moved}`);
  assert.equal(bag2.find((it) => /Ingot/.test(it.name))?.stackCount, 200 - moved);
  // the ground: Shift changes nothing - Info mode answers with its info, nothing leaves
  const bag3 = [arrows(4)];
  const w3 = classic(bag3, []);
  w3.mode = 'info';
  w3.hover(10, 10, { shiftKey: true });
  firstSlot(w3);
  assert.equal(bag3.length, 1, 'nothing dropped on the ground');
});
