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
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';
import { SMALL_CART_TEMPLATE } from '../src/systems/inventorySession.js';
import { GOLD_TEMPLATE } from '../src/systems/inventory.js';
import { withDom } from './invdrag.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const DAGGER = () => ({ name: 'Dagger', templateIndex: 113, group: 'Weapons', stackCount: 1, material: 0 });
const CART = () => ({ name: 'Small cart', group: 'Transportation', templateIndex: SMALL_CART_TEMPLATE, stackCount: 1 });

/** AUDIT GOLD-DROP 2: the fake's elements drop their listeners; these keep them, so a click can be handed to the
 *  frame the pane listens on, as the browser bubbles one up to it. */
const listening = (dom) => {
  const make = dom.doc.createElement;
  dom.doc.createElement = (t) => {
    const n = make(t);
    const on = [];
    n.addEventListener = (type, fn) => { on.push([type, fn]); };
    n.fire = (type, e) => { for (const [ty, fn] of on) if (ty === type) fn(e); };
    return n;
  };
};

/** The pack over fakes: `deps` the session's (a loot target, the wagon); `setup` sees the document first. */
function withPack(fn, { deps = {}, items = () => [DAGGER()], gold = 1287, setup = () => {} } = {}) {
  return withDom((dom) => {
    setup(dom);
    const host = dom.mk('div'); dom.body.append(host);
    const e = { name: 'Aelwyn', stats: { strength: 50, endurance: 48 }, items: items(), goldPieces: gold };
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
    /** The field's own submit, as the player reads it (AUDIT GOLD-DROP 5). */
    const submit = () => field()?.children.find((c) => c.tagName === 'BUTTON')?.textContent ?? null;
    /** A button of the window, by its word (the fake's selectors are one element's classes, never a descendant's). */
    const act = (word) => host.querySelectorAll('.act').find((b) => b.textContent === word) ?? null;
    try { return fn({ dom, host, e, view, button, field, give, submit, act }); } finally { view.unmount(); }
  });
}
const isGold = (it) => it.group === 'Currency' && it.templateIndex === GOLD_TEMPLATE;
/** The window's standing notice, whichever surface the skin draws it on. */
const noticeNow = () => JSON.parse(globalThis.__pack()).notice;
/** Every button the remote frame draws whose word is about gold, by any verb - a gold stack's own row is an item. */
const goldOnRemote = (host) => (host.querySelectorAll('.loot-win')[0]?.querySelectorAll('button') ?? [])
  .filter((b) => !b.classList.contains('itemrow') && /gold/i.test(b.textContent)).map((b) => b.textContent);

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

test('GOLD-DROP: by source - the button rides the pack\'s footer and its field the footer too (AUDIT GOLD-DROP 1); the remote bar carries none, by any label; the field\'s verb is the button\'s (mutants: the bar\'s button back)', () => {
  const s = src('src/ui/enhancedInventory.js');
  const remoteCol = s.slice(s.indexOf('function remoteCol()'), s.indexOf('function goldField()'));
  assert.ok(!/'Gold'\)/.test(remoteCol) && !/goldField\(\)/.test(remoteCol), 'no gold on the remote window');
  assert.ok(!/el\('button'[^;]*gold/i.test(remoteCol), 'AUDIT GOLD-DROP 5: nor a gold button under another word - "Drop gold", "Store gold"');
  assert.match(s, /const verb = `\$\{GOLD_VERB\[remote\?\.kind\] \?\? 'Drop'\} gold`;/);
  assert.match(s, /const give = el\('button', `act goldbtn\$\{goldEntry != null \? ' primary' : ''\}`, verb\);/);
  assert.match(s, /if \(giving && goldEntry != null\) bar\.append\(goldField\(\)\);/);
  assert.match(s, /const go = el\('button', 'act primary', GOLD_VERB\[remote\?\.kind\] \?\? 'Drop'\);/);
});

// AUDIT GOLD-DROP 1 (2026-09-27, the audit of GOLD-DROP): ON A PHONE THE BUTTON WAS OFF THE SCREEN. The footer is one
// flex row never narrower than ~550px, the host clips and play/index.html will not zoom, so on a 393px Pixel 5 the
// button stood at x=446..550 and "Can't drop gold at all" stayed true there. It was 32px under a finger where every
// other button of this window is 44; and its field, a row of the window below the bar, took its ~110px out of the item
// list, which a stacked window (641-999px) has about 50px of - the list went to nothing and the dock ran under the
// footer. Chromium measured the fix over the real module and sheet (320-430 on a touch screen, 640-999, 800x600, 1280):
// the button on the screen and opened by a real tap, the field's input and submit under the pointer, the list's height
// and the dock's foot unmoved by the field. What node can hold is the rules and the field's home.
test('AUDIT GOLD-DROP 1: the field is the FOOTER\'s, floated over it and never a row of the window the list pays for; on a phone the footer wraps - the purse and its button on the count\'s row, the carry on the next; a coarse pointer\'s button is 44px (mutants: the field back in the window, no wrap, the carry first, 32px under a finger, the rules gone)', () => {
  withPack(({ host, button, field }) => {
    button().onclick();
    assert.equal(field().parent, host.querySelector('.packbar'), 'the footer holds the field');
    assert.equal(host.querySelector('.pack-win').children.includes(field()), false, 'not the window, whose fixed height the list paid');
  });
  const css = ENHANCED_CSS;
  assert.match(css, /\.pack-shell \.packgold \.goldbtn \{ margin-left: 12px; min-height: 32px; padding: 0 12px; font-size: 12px; \}/, 'the button beside the purse');
  assert.match(css, /@media \(pointer: coarse\) \{ \.pack-shell \.packgold \.goldbtn \{ min-height: 44px; \} \}/, 'a finger\'s 44px, .act\'s own floor');
  assert.match(css, /\.pack-shell \.packbar \{ position: relative; \}/, 'the footer is the field\'s containing block');
  assert.match(css, /\.pack-shell \.packbar > \.goldfield \{ position: absolute; right: 16px; bottom: calc\(100% \+ 8px\); z-index: 5;/,
    'hung off the footer\'s top edge');
  assert.match(css, /\.pack-shell \.packtip\.packdetail \{ position: absolute; z-index: 4;/, 'above the card, so its input is always there');
  assert.doesNotMatch(css, /\.pack-win > \.goldfield/, 'no in-flow rule left');
  const at = css.indexOf('@media (max-width: 640px) {\n  .pack-win { width: 100vw; height: 100dvh;');
  assert.notEqual(at, -1, 'the pack\'s phone block');
  const phone = css.slice(at, css.indexOf('\n}\n', at));
  assert.match(phone, /\n {2}\.pack-shell \.packbar \{ flex-wrap: wrap; row-gap: 8px; \}/, 'the footer wraps, so the button is on the screen');
  assert.match(phone, /\n {2}\.pack-shell \.packcarry \{ order: 1; white-space: nowrap; \}/, 'in two rows, not three');
});

// AUDIT GOLD-DROP 2: THE FIRST CLICK INTO THE FIELD WAS LOST WITH A CARD UP. The window's click-away puts an item's
// card away on any click that is not the card's or a button's, and GOLD-DROP put the field inside that window - so the
// click into its input closed the card and redrew the window under the caret, focus went to the body and the amount
// typed went nowhere (Chromium: "250" typed, "0" in the field). A field is interactive, and the click-away passes it.
test('AUDIT GOLD-DROP 2: with an item\'s card up, a click into the gold field keeps the card and the very input clicked - nothing redrawn under the caret; a click on nothing still puts the card away (mutants: the click-away blind to the field)', () => {
  withPack(({ host, button, field }) => {
    const frame = () => host.querySelector('.pack-win');
    const input = () => field()?.children.find((c) => c.tagName === 'INPUT') ?? null;
    host.querySelector('.pack-dock').querySelectorAll('.itemrow')[0].onclick();
    assert.equal(host.querySelectorAll('.packtip').length, 1, 'the card is up');
    button().onclick();
    assert.equal(host.querySelectorAll('.packtip').length, 1, 'the field opens beside it');
    const clicked = input();
    frame().fire('click', { target: clicked });   // the browser bubbles the input's click to the frame
    assert.equal(host.querySelectorAll('.packtip').length, 1, 'the card stays');
    assert.equal(input(), clicked, 'and the input is the one the player clicked, not a redrawn one');
    frame().fire('click', { target: field().children.find((c) => c.tagName === 'P') });
    assert.equal(host.querySelectorAll('.packtip').length, 1, 'the field\'s own ground is the field');
    frame().fire('click', { target: frame() });
    assert.equal(host.querySelectorAll('.packtip').length, 0, 'a click on nothing still puts the card away');
    assert.ok(field(), 'and leaves the field open');
  }, { setup: listening });
});

// AUDIT GOLD-DROP 3: A REWARD TRAY TOOK GOLD, AND LOST IT. A choose-one session builds the pack, so the button read
// "Drop gold" and dropGold put the stack into the tray's list - the gift's: the piece taken is the claim and the host
// keeps nothing else, so the gold went with the rest when a piece was chosen or the window closed (the purse 1287 ->
// 1087, the 200 in the discarded list). DFU's DropGoldPopup does the same. The port's rule is that nothing leaves the
// pack while a choice is up (planStore's chooseOnePile), and MAC-M2 B's reason for a body is this one.
test('AUDIT GOLD-DROP 3: a reward tray never offers the gold button nor its field - the purse and the gift stand; the wagon, opened beside a tray, still takes gold, INTO the wagon (mutants: the button over the tray, the field over it, a choice hiding the wagon\'s too, the gold onto the ground)', () => {
  let gift = [DAGGER(), DAGGER()];
  withPack(({ host, e, button, field }) => {
    assert.ok(host.querySelector('.pack-id'), 'the pack beside the tray');
    assert.equal(host.querySelector('.remotewho').children[0].textContent, 'Choose one');
    assert.equal(button(), null, 'no gold button - the tray is the gift\'s, not the purse\'s');
    assert.equal(field(), null);
    assert.equal(host.querySelector('.packgold').children[1].textContent, (1287).toLocaleString(), 'the purse still shows');
    assert.deepEqual([e.goldPieces, gift.length], [1287, 2]);
  }, { deps: { chooseOne: { items: gift, onChoose: () => {} } } });
  gift = [DAGGER(), DAGGER()];
  const wagon = [];
  withPack(({ e, button, field, give, act }) => {
    act('Wagon').onclick();
    assert.equal(button()?.textContent, 'Stow gold', 'the wagon, opened beside the tray, keeps what it is given');
    give(50);
    assert.deepEqual([wagon.length, wagon[0]?.stackCount, e.goldPieces, gift.length], [1, 50, 1237, 2], 'into the wagon - not the tray, not the ground');
    button().onclick();
    assert.ok(field(), 'the field open over the wagon');
    act('Leave wagon').onclick();
    assert.deepEqual([button(), field()], [null, null], 'back to the tray: the button and its field go');
    assert.deepEqual([gift.length, e.goldPieces], [2, 1237]);
  }, { deps: { chooseOne: { items: gift, onChoose: () => {} }, wagonItems: () => wagon }, items: () => [DAGGER(), CART()] });
});

// AUDIT GOLD-DROP 5: WHAT THE SEVEN MUTANTS LEFT UNCHECKED. The field's verb was held by a regex over the source alone;
// a gold button back on the remote bar under its verb ("Store gold") passed every check, which looked for the bare
// word 'Gold'; the press's clearing of a standing notice and the mount's closing of the field were checked by nothing.
// Read here as the player meets them.
test('AUDIT GOLD-DROP 5: the field\'s submit is the button\'s verb - Drop onto the ground, Store into storage, Stow into the wagon; no remote frame draws a gold button, whatever its word; over the wagon the button stays and a second press puts the field away (mutants: the field\'s verb lost, a "Store gold" back on the remote bar, the wagon hiding an open field\'s button)', () => {
  withPack(({ host, button, submit, give }) => {
    button().onclick();
    assert.equal(submit(), 'Drop', 'the ground');
    give(5);
    assert.equal(host.querySelectorAll('.loot-win').length, 1, 'the ground window, with the stack on it');
    assert.deepEqual(goldOnRemote(host), [], 'and no gold button on it');
  });
  const chest = [];
  const wagon = [];
  withPack(({ host, button, submit, act }) => {
    assert.equal(button().textContent, 'Store gold');
    button().onclick();
    assert.equal(submit(), 'Store', 'the player\'s own storage: the field says where, as the button does');
    assert.deepEqual(goldOnRemote(host), [], 'the chest\'s frame draws no gold button');
    act('Wagon').onclick();
    assert.equal(submit(), 'Stow', 'the wagon: the field follows it');
    assert.deepEqual(goldOnRemote(host), [], 'nor the wagon\'s');
    assert.ok(button().classList.contains('primary'), 'the button stays, lit, while its field is open');
    button().onclick();
    assert.equal(submit(), null, 'and a second press puts the field away over the wagon too');
  }, { deps: { loot: { items: () => chest, storage: true }, wagonItems: () => wagon }, items: () => [DAGGER(), CART()] });
});

test('AUDIT GOLD-DROP 5: a press of the button clears a standing notice - the wagon\'s "could only hold" among them - and the field does not outlive the window: closed and opened again, the pack comes back without it (mutants: the notice kept, the field kept across a mount)', () => {
  const chest = [];
  const wagon = [{ ...DAGGER(), name: 'Anvil', weightInKg: 749.9 }];
  withPack(({ e, button, field, give, act }) => {
    act('Wagon').onclick();
    give(1000);
    assert.deepEqual([e.goldPieces, wagon.filter(isGold).map((i) => i.stackCount)], [100000 - 40, [40]], 'the wagon took what it could hold');
    assert.equal(noticeNow(), 'Your wagon could only hold 40 gold pieces.', 'and said so');
    button().onclick();
    assert.equal(noticeNow(), null, 'the next press starts clean');
    assert.ok(field());
  }, { deps: { loot: { items: () => chest, storage: true }, wagonItems: () => wagon }, items: () => [DAGGER(), CART()], gold: 100000 });
  withDom((dom) => {
    const e = { name: 'Aelwyn', stats: { strength: 50, endurance: 48 }, items: [DAGGER()], goldPieces: 50 };
    const first = dom.mk('div'); dom.body.append(first);
    const v1 = mountEnhancedInventory(first, { entity: e, items: () => e.items });
    first.querySelectorAll('.goldbtn')[0].onclick();
    assert.equal(first.querySelectorAll('.goldfield').length, 1, 'opened, and never used');
    v1.unmount();
    const again = dom.mk('div'); dom.body.append(again);
    const v2 = mountEnhancedInventory(again, { entity: e, items: () => e.items });
    try {
      assert.equal(again.querySelectorAll('.goldfield').length, 0, 'the pack opens again without it');
      assert.equal(again.querySelectorAll('.goldbtn')[0].classList.contains('primary'), false, 'its button unlit');
    } finally { v2.unmount(); }
  });
});
