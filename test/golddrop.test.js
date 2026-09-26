// GOLD-DROP (2026-09-26, a player on Discord: "Gold isnt able to be put in a container", "Cant put gold in
// containers", "Can't drop gold at all"): THE GOLD BUTTON IS THE PACK'S. DFU keeps its goldButton on the player's
// own panel (DaggerfallInventoryWindow.cs:47, :515-517) and GoldButton_OnMouseClick drops the amount into whatever the
// window's remote list is - the ground, the wagon, a container (:1269-1316). The enhanced pack carried it on the
// remote window's bar alone, and that window is built for the ground only once something lies on it (PX19c) and is
// take-only for anything the host opened (MAC-M2 B) - so over bare ground there was no Gold control anywhere, and the
// player's own storage (the ship's chest, a house's cupboards, a placed chest), which opens beside the pack
// (SHIP-STORE), never had one. The button rides the pack's footer now, named for where the gold goes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mountEnhancedInventory } from '../src/ui/enhancedInventory.js';
import { SMALL_CART_TEMPLATE } from '../src/systems/inventorySession.js';
import { GOLD_TEMPLATE } from '../src/systems/inventory.js';
import { withDom } from './invdrag.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAGGER = () => ({ name: 'Dagger', templateIndex: 113, group: 'Weapons', stackCount: 1, material: 0 });
const CART = () => ({ name: 'Small cart', group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, stackCount: 1 });

/** The pack over fakes: `deps` the session's (a loot target, the wagon). */
function withPack(fn, { deps = {}, items = () => [DAGGER()] } = {}) {
  return withDom((dom) => {
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'Aelwyn', stats: { strength: 50, endurance: 48 }, items: items(), goldPieces: 1287 };
    let view = null;
    view = mountEnhancedInventory(host, { entity: e, items: () => e.items, onExit: () => view.unmount(), dropItem: () => {}, ...deps });
    const button = () => host.querySelectorAll('.goldbtn')[0] ?? null;
    const field = () => host.querySelectorAll('.goldfield')[0] ?? null;
    /** Open the field, type `amount`, submit - the gesture a player makes. */
    const give = (amount) => {
      if (!field()) button().onclick();
      const f = field();
      const input = f.children.find((c) => c.tagName === 'INPUT');
      input.value = String(amount);
      input.oninput();
      f.onsubmit({ preventDefault() {} });
    };
    try { return fn({ dom, host, e, view, button, field, give }); } finally { view.unmount(); }
  });
}
const isGold = (it) => it.group === 'Currency' && it.templateIndex === GOLD_TEMPLATE;

test('GOLD-DROP: over bare ground (F6, nothing dropped) the pack has its Gold button - Drop - and the amount given leaves the purse as ONE gold stack on the ground, worth its count, the ground window arriving with it (mutants: the button gone, the field never shown, the purse untouched)', () => {
  withPack(({ host, e, view, button, field, give }) => {
    assert.equal(host.querySelectorAll('.loot-win').length, 0, 'bare ground: no remote frame (PX19c)');
    assert.ok(button(), 'yet the pack carries its Gold button - the bug: there was none');
    assert.equal(button().textContent, 'Drop gold', 'named for where it goes');
    assert.ok(button().parent.classList.contains('packgold'), 'beside the purse, on the pack\'s own footer');
    assert.equal(field(), null, 'the field waits for the press');
    button().onclick();
    assert.ok(field(), 'the press opens it');
    button().onclick();
    assert.equal(field(), null, 'and a second press puts it away');
    give(120);
    assert.equal(e.goldPieces, 1287 - 120, 'out of the purse');
    const dropped = view.dropped();
    assert.equal(dropped.length, 1);
    assert.ok(isGold(dropped[0]), 'a gold stack');
    assert.deepEqual([dropped[0].stackCount, dropped[0].value], [120, 1], 'CreateGoldPieces: its count, worth one apiece');
    assert.equal(field(), null, 'the field closes on a drop');
    assert.equal(host.querySelectorAll('.loot-win').length, 1, 'and the ground window arrives with the stack on it');
    give(7);
    assert.deepEqual([view.dropped().length, view.dropped()[0].stackCount, e.goldPieces], [1, 127, 1160], 'a second drop joins the stack');
  });
});

test('GOLD-DROP: a bad amount moves nothing and says nothing - nothing typed, 0, more than the purse, not a number (DropGoldPopup_OnGotUserInput :1290-1294) (mutants: a clamp for a refusal)', () => {
  withPack(({ host, e, view, give }) => {
    for (const bad of ['', '0', '1288', 'abc', '12x']) {
      give(bad);
      assert.equal(e.goldPieces, 1287, `"${bad}": the purse untouched`);
      assert.equal(view.dropped().length, 0, `"${bad}": nothing on the ground`);
      assert.equal(host.querySelectorAll('.sheet-notice').length, 0, `"${bad}": and no notice - DFU returns silently`);
    }
    give(1287);
    assert.deepEqual([e.goldPieces, view.dropped()[0].stackCount], [0, 1287], 'the whole purse is an amount');
  });
});

test('GOLD-DROP: the player\'s own storage takes gold - Store - into the list the host saves, two gifts one stack, and taken back it is the purse\'s again (mutants: storage gated off with the loot, the gold into the ground instead)', () => {
  const chest = [];
  withPack(({ host, e, button, give }) => {
    assert.ok(host.querySelector('.pack-id') && host.querySelector('.loot-win'), 'the chest opens beside the pack (SHIP-STORE)');
    assert.equal(button().textContent, 'Store gold', 'never the bare Store an item\'s card carries');
    give(300);
    give(200);
    assert.equal(chest.length, 1, 'one stack');
    assert.ok(isGold(chest[0]));
    assert.equal(chest[0].stackCount, 500, 'the two gifts merged');
    assert.equal(e.goldPieces, 787);
    const row = host.querySelectorAll('.loot-win')[0].querySelectorAll('.itemrow')[0];
    assert.ok(row, 'the stack is listed in the chest');
    row.onclick();   // IG7: a click on the chest's side takes, at once
    assert.deepEqual([chest.length, e.goldPieces], [0, 1287], 'taken back: the purse again (applyTransfer\'s gold arm), the chest empty');
  }, { deps: { loot: { items: () => chest, storage: true } } });
});

test('GOLD-DROP: with the wagon showing the button is Stow and the gold goes into the wagon; a body\'s tray never offers it (MAC-M2 B) (mutants: the wagon ignored, gold on a body)', () => {
  const wagon = [];
  const chest = [];
  withPack(({ host, e, button, give }) => {
    const toWagon = host.querySelectorAll('.act').find((b) => b.textContent === 'Wagon');
    assert.ok(toWagon, 'the cart in the bag: the Wagon button');
    toWagon.onclick();
    assert.equal(button().textContent, 'Stow gold');
    give(50);
    assert.deepEqual([wagon.length, wagon[0]?.stackCount, e.goldPieces, chest.length], [1, 50, 1237, 0], 'into the wagon, not the chest');
  }, { deps: { loot: { items: () => chest, storage: true }, wagonItems: () => wagon }, items: () => [DAGGER(), CART()] });
  withPack(({ host, button }) => {
    assert.equal(host.querySelector('.pack-id'), null, 'a body: its frame alone');
    assert.equal(button(), null, 'and no Gold anywhere - the loot window is for taking');
  }, { deps: { loot: { items: () => [DAGGER()] } } });
});

test('GOLD-DROP: by source - the button rides the pack\'s footer and its field the pack window; the remote bar carries none; the field\'s verb is the button\'s (mutants: the bar\'s button back)', () => {
  const s = src('src/ui/enhancedInventory.js');
  const remoteCol = s.slice(s.indexOf('function remoteCol()'), s.indexOf('function goldField()'));
  assert.ok(!/'Gold'\)/.test(remoteCol) && !/goldField\(\)/.test(remoteCol), 'no gold on the remote window');
  assert.match(s, /const verb = `\$\{GOLD_VERB\[remote\?\.kind\] \?\? 'Drop'\} gold`;/);
  assert.match(s, /const give = el\('button', `act goldbtn\$\{goldEntry != null \? ' primary' : ''\}`, verb\);/);
  assert.match(s, /if \(goldEntry != null\) win\.append\(goldField\(\)\);/);
  assert.match(s, /const go = el\('button', 'act primary', GOLD_VERB\[remote\?\.kind\] \?\? 'Drop'\);/);
});
