// REALM phase 0 (2026-09-28, Mac: "I wanna do this as comprehensively as possible. A true separation while allowing
// people to still play offline ... balance the gold economy, eliminate duping, eliminate true overpowered builds
// online"): the hotfixes that need no migration (bible/06-Systems/Realm-Arc.md, "Phases").
//   P0.1 - the URL's powers stay offline: an online boot drops ?shot (and window.__addGold with it), ?fly, ?nofoes and
//          the rest before anything reads them.
//   P0.2 - the balance mods are the room's whole online: every key of Meaner Monsters, PCAAO, Unleveled Loot,
//          Roleplay & Realism (its two cosmetic keys aside), RR: Items and Oblivion leveling's dials reads its shipped
//          default, where only their Enable switch was forced before.
//   P0.3 - the Empire is one lender: one loan a character online, a default anywhere shuts every branch, the Empire
//          takes from every account and every deposit, and a character joining with more debt than the Empire would
//          lend has the rest called in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ONLINE_REFUSED_FLAGS, refuseOnlinePowerFlags, ONLINE_WHOLE_MODS, ONLINE_ROOM_MOD_KEYS, onlineWholeModKey } from '../src/systems/onlineLane.js';
import { MOD_SETTINGS, modSetting, setModSetting, onlineModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { onlineSyncPlan } from '../src/systems/onlineSync.js';
import {
  TRANSACTION_RESULT as R, createBankAccounts, borrowDecision, borrowLoan, settleOverdueLoan, depositGold, depositAllLetters,
  empireRefusal, empireRefusalLines, callInEmpireDebt, empireCallInLines, calculateMaxBankLoan, LOAN_MAX_PER_LEVEL,
} from '../src/systems/banking.js';
import { empireJoin } from '../src/systems/worldTick.js';
import { deductGold, goldAmount } from '../src/systems/court.js';
import { letterOfCredit, LETTER_OF_CREDIT_TEMPLATE } from '../src/systems/inventory.js';
import { BankWindow, BANK_RECTS, BANK_PANEL_X, BANK_PANEL_Y } from '../src/ui/bankWindow.js';
import { REGION_NAMES } from '../src/formats/mapsFile.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** Runs `fn` as if the page were `search`, then restores the page. */
function onPage(search, fn) {
  const was = globalThis.location;
  globalThis.location = { search };
  try { return fn(); } finally { globalThis.location = was; }
}

test('REALM P0.1: an online boot drops every power flag before anything reads it - offline, F304 stands', () => {
  for (const f of ['shot', 'fly', 'nofoes', 'tp', 'timescale', 'class', 'spell', 'weapon', 'spawn', 'region', 'loc', 'tod', 'weather', 'wseed', 'season']) {
    assert.ok(ONLINE_REFUSED_FLAGS.includes(f), `?${f} is refused online`);
  }
  const all = ONLINE_REFUSED_FLAGS.map((f) => `${f}=1`).join('&');
  const online = new URLSearchParams(`online&load&world&${all}`);
  assert.deepEqual(refuseOnlinePowerFlags(online), [...ONLINE_REFUSED_FLAGS]);
  for (const f of ONLINE_REFUSED_FLAGS) assert.equal(online.has(f), false, `?${f} is gone`);
  assert.ok(online.has('online') && online.has('load') && online.has('world'), 'the doors the Online choice needs stand');
  const offline = new URLSearchParams(`load&world&${all}`);
  assert.deepEqual(refuseOnlinePowerFlags(offline), [], 'offline nothing is dropped');
  for (const f of ONLINE_REFUSED_FLAGS) assert.equal(offline.has(f), true, `?${f} stands offline`);
});

test('REALM P0.1 by source: the world host drops them beside the Test Room refusal - before the start location, the probe seams and the walk mode read them', () => {
  const w = src('src/scenes/world.js');
  const drop = w.indexOf('if (refuseOnlinePowerFlags(params).length) publishBootParams(params);');
  assert.ok(drop > 0, 'the drop is at the boot, and it is published');
  assert.ok(drop > w.indexOf("if (testRoomOffline) { params.delete('online'); publishBootParams(params); }"), 'after the Test Room refusal (which may take `online` itself away)');
  for (const reader of ["const regionName = params.get('region')", "const shotMode = params.has('shot');", "window.__addGold = (n) => addGold(playerEntity, n);"]) {
    const at = w.indexOf(reader);
    assert.ok(at > drop, `${reader} reads after the drop`);
  }
  assert.match(w, /if \(shotMode\) \{/, 'the probe seams stand only in ?shot - which an online page no longer has');
});

test('REALM P0.2: online, every key of a balance mod reads its shipped default - the room\'s own value first, its cosmetic keys still the player\'s', () => {
  let whole = 0;
  for (const [vendor, own] of Object.entries(ONLINE_WHOLE_MODS)) {
    assert.ok(MOD_SETTINGS[vendor], `${vendor} is a vendored mod`);
    for (const k of own) assert.ok(Object.hasOwn(MOD_SETTINGS[vendor].keys, k), `${vendor}/${k} is a real key`);
    for (const [key, def] of Object.entries(MOD_SETTINGS[vendor].keys)) {
      const room = ONLINE_ROOM_MOD_KEYS[vendor] && Object.hasOwn(ONLINE_ROOM_MOD_KEYS[vendor], key);
      const want = room ? ONLINE_ROOM_MOD_KEYS[vendor][key] : own.includes(key) ? undefined : def.default;
      assert.deepEqual(onlineModSetting(vendor, key, '?online=1'), want, `${vendor}/${key} online`);
      assert.equal(onlineModSetting(vendor, key, ''), undefined, `${vendor}/${key} offline is the player's`);
      if (!room && !own.includes(key)) whole++;
    }
  }
  assert.equal(whole, 48, 'forty-eight dials the room now owns beside the thirty-four it did');
  assert.equal(onlineWholeModKey('dynamic-skies', 'Enabled', '?online=1'), false, 'a looks mod is not the room\'s');
  assert.equal(onlineWholeModKey('roleplay-realism', 'variantNpcs', '?online=1'), false, 'who stands behind a counter is looks');
  assert.equal(onlineWholeModKey('oblivion-remaster-leveling', 'Enabled', '?online=1'), false, 'which leveling a character uses stays its own');
  assert.equal(onlineWholeModKey('oblivion-remaster-leveling', 'attributePoints', '?online=1'), true, 'the points a level are the room\'s');
});

test('REALM P0.2: the holes the research found are closed - Iron as Daedric, the strength bonus, the loan dial, sale prices and forty points a level', () => {
  _resetModSettings();
  try {
    setModSetting('unleveledLoot', 'Iron', 9);   // Iron -> Daedric: a 300-gold cuirass rolls as a 153,600-gold one
    setModSetting('pcaao', 'fixedStrengthDamageModifier', false);
    setModSetting('roleplay-realism', 'loanAmountPerLevel', 0);
    setModSetting('roleplay-realism-items', 'conditionBasedPrices', false);
    setModSetting('oblivion-remaster-leveling', 'attributePoints', 60);
    setModSetting('roleplay-realism', 'variantNpcs', false);
    onPage('', () => {
      assert.equal(modSetting('unleveledLoot', 'Iron'), 9, 'offline the player\'s own shelf stands');
      assert.equal(modSetting('oblivion-remaster-leveling', 'attributePoints'), 60);
    });
    onPage('?online=1', () => {
      assert.equal(modSetting('unleveledLoot', 'Iron'), MOD_SETTINGS.unleveledLoot.keys.Iron.default, 'Iron is Iron online');
      assert.equal(modSetting('pcaao', 'fixedStrengthDamageModifier'), true);
      assert.equal(modSetting('roleplay-realism', 'loanAmountPerLevel'), MOD_SETTINGS['roleplay-realism'].keys.loanAmountPerLevel.default, 'the loan dial EMPIRE-BANK reads');
      assert.equal(modSetting('roleplay-realism-items', 'conditionBasedPrices'), true);
      assert.equal(modSetting('oblivion-remaster-leveling', 'attributePoints'), 12, 'the mod\'s own twelve');
      assert.equal(modSetting('roleplay-realism', 'variantNpcs'), false, 'a cosmetic key stays the player\'s');
    });
  } finally { _resetModSettings(); }
});

test('REALM P0.2: the Mods pane locks a room dial as it locks a switch, with the balance reason, and the offline sync copies the dials home', () => {
  const menu = src('src/ui/enhancedMenu.js');
  assert.match(menu, /const ONLINE_BALANCE_NOTE = '[^']*one balance[^']*';/, 'the balance lock has its own words');
  assert.match(menu, /const modLockNote = \(vendor, key\) => \(!Object\.hasOwn\(ONLINE_ROOM_MOD_KEYS\[vendor\] \?\? \{\}, key\) && onlineWholeModKey\(vendor, key, undefined, \{ offline: true \}\) \? ONLINE_BALANCE_NOTE : onlineLockNote\(vendor, key\)\);/);
  assert.match(menu, /if \(\(isChoiceKey\(def\) \|\| isTextKey\(def\) \|\| isTupleKey\(def\) \|\| isFloatKey\(def\) \|\| isIntKey\(def\)\) && onlineModSetting\(vendor, key\) !== undefined\) lockDial\(ctl, modLockNote\(vendor, key\)\);/, 'a dial is locked too');
  assert.match(menu, /function lockDial\(ctl, note\) \{\s*for \(const b of ctl\.querySelectorAll\('button'\)\) \{ b\.disabled = true;/);
  _resetModSettings();
  try {
    setModSetting('unleveledLoot', 'Iron', 9);
    const plan = onPage('', () => onlineSyncPlan({ search: '' }));
    const row = plan.find((r) => r.id === 'mods:unleveledLoot/Iron');
    assert.ok(row, 'the sync names the dial');
    assert.equal(row.online, 0, 'the room\'s value is the shipped Iron');
    assert.equal(row.offline, 9);
    assert.equal(row.same, false);
    assert.ok(!plan.some((r) => r.id === 'mods:roleplay-realism/variantNpcs'), 'a cosmetic key is not the room\'s to copy');
  } finally { _resetModSettings(); }
});

/** Accounts with loans and balances set by region: `{ 3: { loanTotal, accountGold, hasDefaulted } }`. */
function bank(by) {
  const accounts = createBankAccounts();
  for (const [r, v] of Object.entries(by)) Object.assign(accounts[r], { loanDueDate: v.loanTotal > 0 ? 500_000 : 0, ...v });
  return accounts;
}

test('REALM P0.3: online the Empire lends once - another branch\'s loan or default refuses here, in its own words naming the branch; offline each region is its own lender', () => {
  const loan = bank({ 3: { loanTotal: 11_000 } });
  assert.deepEqual(borrowDecision(loan, 17, { online: false }), { kind: 'input', transactionType: 'Borrowing_loan' }, 'offline region 17 lends');
  const d = borrowDecision(loan, 17, { online: true });
  assert.deepEqual(d, { kind: 'refuse', result: R.ALREADY_HAVE_LOAN, empireRegion: 3 });
  assert.deepEqual(empireRefusalLines(d, (i) => REGION_NAMES[i]), ['The Empire lends one loan at a time.', `Yours stands in ${REGION_NAMES[3]}.`]);
  assert.deepEqual(borrowDecision(loan, 3, { online: true }), { kind: 'refuse', result: R.ALREADY_HAVE_LOAN }, 'the loan\'s own branch answers as Daggerfall does');
  assert.equal(borrowLoan(loan, 17, 1_000, { level: 5, online: true }), R.ALREADY_HAVE_LOAN, 'the transaction refuses too, whatever asked');
  assert.equal(borrowLoan(loan, 17, 1_000, { level: 5, online: false }), R.NONE);
  // a default anywhere shuts every branch - even paid off, as Daggerfall's own flag never clears
  const defaulted = bank({ 5: { hasDefaulted: true } });
  const dd = borrowDecision(defaulted, 17, { online: true });
  assert.deepEqual(dd, { kind: 'refuse', result: R.ALREADY_DEFAULTED, empireRegion: 5 });
  assert.deepEqual(empireRefusalLines(dd, (i) => REGION_NAMES[i]), ['The Empire lends nothing to one', `who defaulted on it, in ${REGION_NAMES[5]}.`]);
  assert.equal(borrowLoan(defaulted, 17, 1_000, { level: 5, online: true }), R.ALREADY_DEFAULTED);
  assert.equal(empireRefusal(bank({ 5: { hasDefaulted: true }, 2: { loanTotal: 500 } })).result, R.ALREADY_DEFAULTED, 'a default outranks a loan');
  assert.equal(empireRefusal(createBankAccounts()), null, 'no loan, no default: the Empire lends');
});

test('REALM P0.3: online an overdue loan is paid from every branch before it defaults, and a defaulter\'s deposit is the Empire\'s - gold and letters; offline only the loan\'s own account pays', () => {
  const payer = { deductGold: () => 0 };
  const off = bank({ 3: { loanTotal: 11_000, accountGold: 1_000 }, 7: { accountGold: 4_000 }, 9: { accountGold: 10_000 } });
  assert.equal(settleOverdueLoan(off, 3, payer, { online: false }).kind, 'defaulted', 'offline: 1,000 paid, a default');
  assert.equal(off[7].accountGold, 4_000);
  const on = bank({ 3: { loanTotal: 11_000, accountGold: 1_000 }, 7: { accountGold: 4_000 }, 9: { accountGold: 10_000 } });
  assert.equal(settleOverdueLoan(on, 3, payer, { online: true }).kind, 'settled');
  assert.deepEqual([on[3].accountGold, on[7].accountGold, on[9].accountGold, on[3].loanTotal, on[3].loanDueDate], [0, 0, 4_000, 0, 0], 'own branch, then the rest in region order');

  const entity = { goldPieces: 10_000, items: [letterOfCredit(3_000)] };
  const purse = { gold: () => goldAmount(entity), deductGold: (n) => deductGold(entity, n), takeLetter: () => { const i = entity.items.findIndex((it) => it.templateIndex === LETTER_OF_CREDIT_TEMPLATE); return i < 0 ? null : entity.items.splice(i, 1)[0]; } };
  const garnished = bank({ 3: { loanTotal: 5_000, hasDefaulted: true } });
  assert.equal(depositGold(garnished, 17, 2_000, purse, { online: true }), R.NONE);
  assert.deepEqual([garnished[17].accountGold, garnished[3].loanTotal], [0, 3_000], 'the deposit paid the default');
  assert.equal(depositAllLetters(garnished, 17, purse, { online: true }), R.NONE);
  assert.deepEqual([garnished[17].accountGold, garnished[3].loanTotal, garnished[3].loanDueDate], [0, 0, 0], 'the letters paid the rest');
  assert.equal(depositGold(garnished, 17, 1_000, purse, { online: true }), R.NONE);
  assert.equal(garnished[17].accountGold, 1_000, 'a default paid off takes nothing more');
  const kept = bank({ 3: { loanTotal: 5_000, hasDefaulted: true } });
  depositGold(kept, 17, 2_000, purse, { online: false });
  assert.deepEqual([kept[17].accountGold, kept[3].loanTotal], [2_000, 5_000], 'offline the deposit is the account\'s');
  const standing = bank({ 3: { loanTotal: 5_000 } });
  depositGold(standing, 17, 2_000, purse, { online: true });
  assert.equal(standing[17].accountGold, 2_000, 'a loan not in default takes no deposit');
  const before = bank({ 3: { loanTotal: 5_000, hasDefaulted: true }, 17: { accountGold: 1_000 } });
  depositGold(before, 17, 500, purse, { online: true });
  assert.deepEqual([before[17].accountGold, before[3].loanTotal], [1_000, 4_500], 'the deposit is taken, not the balance before it (that is the sweep\'s)');
});

test('REALM P0.3: the bank window says the Empire\'s refusal and its garnish (mutants: Daggerfall\'s record for another branch; a silent garnish)', () => {
  const was = globalThis.location;
  globalThis.location = { search: '?online=1' };
  try {
    const entity = { level: 5, goldPieces: 5_000, items: [] };
    const accounts = bank({ 3: { loanTotal: 4_000, hasDefaulted: true } });
    const w = new BankWindow({
      accounts: () => accounts, regionIndex: () => 17, level: () => 5, now: () => 1_000,
      player: { gold: () => goldAmount(entity), totalGold: () => goldAmount(entity), deductGold: (n) => deductGold(entity, n), wagonGold: () => 0 },
      rows: (id) => [{ text: `#${id}`, center: true }],
    });
    const click = (key) => { const [x, y, rw, rh] = BANK_RECTS[key]; return w.click(BANK_PANEL_X + x + rw / 2, BANK_PANEL_Y + y + rh / 2); };
    click('loanBorrow');
    assert.deepEqual(w.box.rows.map((r) => r.text), ['The Empire lends nothing to one', `who defaulted on it, in ${REGION_NAMES[3]}.`]);
    w.input('Escape');
    click('depositGold');
    for (const ch of '3000') w.input(`char:${ch}`);
    w.input('Enter');
    assert.deepEqual(w.box?.rows.map((r) => r.text), ['The Empire takes', '3000 gold of it for your default.']);
    assert.deepEqual([accounts[17].accountGold, accounts[3].loanTotal, entity.goldPieces], [0, 1_000, 2_000]);
  } finally { globalThis.location = was; }
});

test('REALM P0.3: a character joining online has the debt past the Empire\'s one loan called in - accounts first, then the purse; unpaid, it defaults at once with the region\'s reputation; offline Daggerfall\'s debt stands', () => {
  // level 10: the Empire lends 50,000 and one loan may owe 55,000
  const cap = Math.floor(10 * LOAN_MAX_PER_LEVEL / 10);
  const paid = bank({ 3: { loanTotal: 22_000 }, 7: { loanTotal: 110_000, accountGold: 30_000 }, 9: { loanTotal: 5_500 }, 12: { accountGold: 40_000 } });
  const rich = { goldPieces: 20_000, items: [letterOfCredit(50_000)] };
  const call = callInEmpireDebt(paid, { deductGold: (n) => deductGold(rich, n) }, { cap, nowMinutes: 900_000 });
  assert.deepEqual(call, { called: 82_500, paid: 82_500, owed: 0, unpaid: [] }, 'the largest loan\'s excess and the other two whole');
  assert.deepEqual([paid[7].loanTotal, paid[7].loanDueDate, paid[3].loanTotal, paid[9].loanTotal, paid[3].loanDueDate], [55_000, 500_000, 0, 0, 0], 'one loan stands - the largest, at the Empire\'s most, due when it was');
  assert.deepEqual([paid[7].accountGold, paid[12].accountGold, rich.goldPieces, rich.items[0].value], [0, 0, 7_500, 50_000], 'its own account, the other branch, then coins before a letter');
  assert.deepEqual(empireCallInLines(call), ['The Empire calls in 82500 gold of your loans.', 'Your accounts and purse have paid it.']);
  assert.deepEqual(empireCallInLines(callInEmpireDebt(bank({ 3: { loanTotal: 55_000 } }), { deductGold: () => 0 }, { cap })), [], 'a loan the Empire would have made is not called');

  onPage('?online=1', () => {
    assert.equal(calculateMaxBankLoan(10), cap);
    const entity = { level: 10, goldPieces: 1_000, items: [], bankAccounts: bank({ 3: { loanTotal: 22_000 }, 7: { loanTotal: 110_000, accountGold: 30_000 }, 9: { loanTotal: 5_500 }, 12: { accountGold: 40_000 } }) };
    const said = [];
    const joined = empireJoin({ entity, nowMinutes: 900_000.7, say: (l) => said.push(l) });
    assert.deepEqual([joined.owed, joined.unpaid], [11_500, [3, 9]]);
    assert.equal(entity.goldPieces, 0, 'the purse paid what it had');
    assert.deepEqual([entity.bankAccounts[3].loanTotal, entity.bankAccounts[3].loanDueDate], [6_000, 900_000], 'what stands unpaid fell due now');
    for (const r of [3, 9]) {
      assert.equal(entity.bankAccounts[r].hasDefaulted, true, `region ${r} defaulted`);
      assert.ok(entity.legalRep[r] < 0, `region ${r}'s reputation fell`);
    }
    assert.equal(entity.bankAccounts[7].hasDefaulted, false, 'the loan the Empire keeps is in good standing');
    assert.deepEqual(said, ['The Empire calls in 82500 gold of your loans.', '11500 gold is unpaid: you are in default.']);
    assert.equal(borrowDecision(entity.bankAccounts, 20).result, R.ALREADY_DEFAULTED, 'and every branch is shut');
    assert.equal(empireJoin({ entity: { level: 1 }, nowMinutes: 0 }), null, 'a character with no accounts owes nothing');
  });
});

test('REALM P0.3 by source: the join calls the debt in after the markers are aligned to the world\'s clock', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /onlineArrival\(\); empireJoin\(\{ entity: playerEntity, nowMinutes: worldMinutes\(\), say: \(l, d\) => townTalk\.say\(l, d\) \}\);/);
  assert.ok(w.indexOf('empireJoin({') > w.indexOf('const onlineArrival = () => { alignEntityClocks(playerEntity, worldMinutes());'), 'the loan due dates ride the shift first');
});
