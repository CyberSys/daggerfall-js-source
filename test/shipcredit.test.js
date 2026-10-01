// SHIP-PRICE and SHIP-CREDIT (2026-10-01, Mac: "make ship prices more reasonable and provide more accessibility options
// to acquiring"; his picks "About a quarter" and "Buy on credit - Pay part now; the bank lends you the rest under
// Daggerfall's own loan rules") - THE HULLS' PRICES a quarter of Come Sail Away's; A BOAT BOUGHT ON CREDIT at a shop's
// counter: the purse its share (CREDIT_DOWN_SHARE at least), the bank of the shop's region the rest under BorrowLoan's
// own law, paid to the shop - the offer and its refusals in both trade skins, the host's commit asking again
// (bible/03-World/Naval-Combat.md SHIP-PRICE, SHIP-CREDIT).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { HULL_PRICES, HULL_NAMES } from '../src/systems/comeSailAwayBoat.js';
import {
  createBankAccounts, creditDecision, takeCredit, borrowLoan, calculateBankLoanRepayment, CREDIT_DOWN_SHARE, LOAN_MINIMUM,
  LOAN_MAX_PER_LEVEL, LOAN_REPAY_MINUTES, TRANSACTION_RESULT, EMPIRE_LOAN_DIVISOR,
} from '../src/systems/banking.js';
import { lotHasBoat, creditRows, creditRefusalRows, CREDIT_ITEM_TEMPLATES, CREDIT_REFUSALS } from '../src/systems/tradeModes.js';
import { BOAT_PARTS_TEMPLATE, BOAT_DEED_TEMPLATE } from '../src/systems/comeSailAwayItems.js';
import { NativeTradeWindow } from '../src/ui/nativeTrade.js';

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
const MODES = src('scenes/worldModes.js');
const ENHANCED = src('ui/enhancedTrade.js');

// ── SHIP-PRICE ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('SHIP-PRICE the hulls about a quarter of Come Sail Away\'s, as Mac picked them: Rowboat 1,000, Large Boat 2,500, Small Ship 25,000, Large Galley 50,000, Carrack 37,500 (mutants: a price put back)', () => {
  assert.deepEqual([...HULL_NAMES], ['Rowboat', 'Large Boat', 'Small Ship', 'Large Galley', 'Carrack']);
  assert.deepEqual([...HULL_PRICES], [1000, 2500, 25000, 50000, 37500]);
  const csa = [4000, 8000, 100000, 200000, 150000];
  for (let h = 0; h < csa.length; h++) assert.ok(HULL_PRICES[h] / csa[h] >= 0.25 && HULL_PRICES[h] / csa[h] <= 0.32, HULL_NAMES[h]);
});

// ── SHIP-CREDIT: the bank's law ────────────────────────────────────────────────────────────────────────────────────

test('SHIP-CREDIT the bank\'s law: a purse short of a boat\'s price pays all it holds - a fifth of the price at least - and the bank lends the shortfall (the minimum loan at least), no more than level x 50,000 (online a tenth); a loan or default standing refuses, online the Empire\'s one loan anywhere; no credit while the purse pays (mutants: the down share, the shortfall, the minimum, the cap, the gate)', () => {
  const acc = () => createBankAccounts(62);
  assert.equal(CREDIT_DOWN_SHARE, 0.2);
  assert.deepEqual(creditDecision(acc(), 5, { price: 25000, purse: 25000, level: 3, online: false }), { kind: 'none' });
  assert.deepEqual(creditDecision(acc(), 5, { price: 25000, purse: 6000, level: 3, online: false }), { kind: 'credit', loan: 19000, pay: 6000, owed: calculateBankLoanRepayment(19000) });
  assert.equal(calculateBankLoanRepayment(19000), 20900);
  // a fifth down at least
  assert.deepEqual(creditDecision(acc(), 5, { price: 25000, purse: 4999, level: 3, online: false }), { kind: 'refuse', result: TRANSACTION_RESULT.NOT_ENOUGH_GOLD, down: 5000 });
  assert.equal(creditDecision(acc(), 5, { price: 25000, purse: 5000, level: 3, online: false }).kind, 'credit');
  // a shortfall under the minimum loan borrows the minimum, and the purse pays the less
  assert.deepEqual(creditDecision(acc(), 5, { price: 2500, purse: 2450, level: 1, online: false }), { kind: 'credit', loan: LOAN_MINIMUM, pay: 2500 - LOAN_MINIMUM, owed: calculateBankLoanRepayment(LOAN_MINIMUM) });
  // the cap: level x 50,000 offline
  assert.equal(LOAN_MAX_PER_LEVEL, 50000);
  assert.deepEqual(creditDecision(acc(), 5, { price: 120000, purse: 40000, level: 1, online: false }), { kind: 'refuse', result: TRANSACTION_RESULT.LOAN_REQUEST_TOO_HIGH, max: 50000 });
  assert.equal(creditDecision(acc(), 5, { price: 120000, purse: 40000, level: 2, online: false }).kind, 'credit');
  // online the Empire lends a tenth
  assert.deepEqual(creditDecision(acc(), 5, { price: 25000, purse: 6000, level: 3, online: true }), { kind: 'refuse', result: TRANSACTION_RESULT.LOAN_REQUEST_TOO_HIGH, max: 3 * LOAN_MAX_PER_LEVEL / EMPIRE_LOAN_DIVISOR });
  // a loan standing in this region refuses; offline another region's does not, online it does (the Empire's one loan)
  const owing = acc();
  assert.equal(borrowLoan(owing, 7, 1000, { level: 3, online: false }), TRANSACTION_RESULT.NONE);
  assert.equal(creditDecision(owing, 7, { price: 25000, purse: 6000, level: 3, online: false }).result, TRANSACTION_RESULT.ALREADY_HAVE_LOAN);
  assert.equal(creditDecision(owing, 5, { price: 25000, purse: 6000, level: 3, online: false }).kind, 'credit');
  const empire = creditDecision(owing, 5, { price: 2500, purse: 1000, level: 3, online: true });
  assert.equal(empire.result, TRANSACTION_RESULT.ALREADY_HAVE_LOAN);
  assert.equal(empire.empireRegion, 7);
  const defaulted = acc();
  defaulted[5].hasDefaulted = true;
  assert.equal(creditDecision(defaulted, 5, { price: 25000, purse: 6000, level: 3, online: false }).result, TRANSACTION_RESULT.ALREADY_DEFAULTED);
});

test('SHIP-CREDIT the loan a credit purchase takes is BorrowLoan\'s debt and year - with no gold into the account: the bank paid the shop (mutants: the interest, the year, the gold credited)', () => {
  const a = createBankAccounts(62);
  const gold = a[5].accountGold;
  takeCredit(a, 5, 19000, { nowMinutes: 1000 });
  assert.equal(a[5].loanTotal, 20900);
  assert.equal(a[5].loanDueDate, 1000 + LOAN_REPAY_MINUTES);
  assert.equal(a[5].accountGold, gold, 'nothing into the account');
});

// ── SHIP-CREDIT: the trade window ──────────────────────────────────────────────────────────────────────────────────

test('SHIP-CREDIT the lot: only a boat - Come Sail Away\'s parts or deed - is sold on credit; the refusals named are the bank\'s own (mutants: any lot, a template missed)', () => {
  assert.deepEqual([...CREDIT_ITEM_TEMPLATES], [BOAT_PARTS_TEMPLATE, BOAT_DEED_TEMPLATE]);
  assert.equal(lotHasBoat([{ templateIndex: 1321 }]), true);
  assert.equal(lotHasBoat([{ templateIndex: 100 }, { templateIndex: 1320 }]), true);
  assert.equal(lotHasBoat([{ templateIndex: 100 }]), false);
  assert.equal(lotHasBoat([]), false);
  for (const k of Object.keys(CREDIT_REFUSALS)) assert.equal(CREDIT_REFUSALS[k], TRANSACTION_RESULT[k], k);
  assert.deepEqual(creditRows({ loan: 19000, pay: 6000, owed: 20900 }, 25000, 6000).map((r) => r.text), [
    'You have 6000 of the 25000 gold.', 'The bank will lend you 19000 gold for the boat.', 'You pay 6000 now, and owe 20900 within a year.', 'Buy on credit?',
  ]);
  assert.deepEqual(creditRefusalRows({ result: 289 }).map((r) => r.text), ['The bank will not lend: a loan of yours stands here.']);
  assert.deepEqual(creditRefusalRows({ result: 288 }).map((r) => r.text), ['The bank lends nothing to one who has defaulted.']);
  assert.deepEqual(creditRefusalRows({ result: 454, down: 5000 }).map((r) => r.text), ['The bank lends on a boat only to one who pays 5000 gold down.']);
  assert.deepEqual(creditRefusalRows({ result: 295, max: 50000 }).map((r) => r.text), ['The bank will lend you no more than 50000 gold.']);
  assert.deepEqual(creditRefusalRows({ result: 289 }, ['The Empire lends one loan at a time.']).map((r) => r.text), ['The Empire lends one loan at a time.']);
  assert.deepEqual(creditRefusalRows({ result: 1 }), []);
});

const deed = () => ({ templateIndex: 1321, name: "Deed to Small Ship 'I'", value: 25000, message: 20 });
const hooks = (o = {}) => ({
  mode: 'Buy', shelfItems: () => [], packItems: () => [], accepts: () => true, enchanted: () => false,
  priceCtx: () => ({ quality: 10, skills: {} }), gold: () => 6000, rows: (id) => [{ text: `#${id}`, center: true }],
  weight: () => ({ carriedWeightKg: 0, maxEncumbranceKg: 1e9 }), commit: () => {},
  icons: { getTexture: async () => ({ recordCount: 0 }), uploadRecord: () => {}, textures: new Map() }, ...o,
});

test('SHIP-CREDIT the classic trade window: a boat the purse falls short of is offered on credit - the bank\'s box with Yes and No, and Yes commits the purchase with the credit; a refused credit says why under the gold\'s own refusal; a lot with no credit hook refuses as ever (mutants: the offer unasked, the credit not handed to the commit, the refusal unsaid)', () => {
  const asked = [], committed = [];
  const credit = { kind: 'credit', loan: 19000, pay: 6000, owed: 20900 };
  const w = new NativeTradeWindow(hooks({ credit: (staged, price) => { asked.push([staged.length, price]); return credit; }, commit: (...a) => committed.push(a) }));
  w.basket.push(deed());
  w._modeAction();
  assert.equal(asked.length, 1, 'the host asked');
  assert.equal(w.box.buttons, 'YesNo');
  assert.deepEqual(w.box.rows.map((r) => r.text), creditRows(credit, asked[0][1], 6000).map((r) => r.text));
  w.box.onYes();
  assert.equal(committed.length, 1);
  assert.equal(committed[0][0], 'Buy');
  assert.equal(committed[0][3], credit, 'the credit is the commit\'s proceeds');
  // refused: the gold's refusal, then why
  const r = new NativeTradeWindow(hooks({ credit: () => ({ kind: 'refuse', result: 289 }) }));
  r.basket.push(deed());
  r._modeAction();
  assert.equal(r.box.buttons, null);
  assert.equal(r.box.rows.at(-1).text, 'The bank will not lend: a loan of yours stands here.');
  assert.ok(r.box.rows.some((x) => /^#/.test(x.text)), 'the gold\'s own refusal first');
  // no hook: the refusal as ever
  const plain = new NativeTradeWindow(hooks());
  plain.basket.push(deed());
  plain._modeAction();
  assert.equal(plain.box.buttons, null);
  assert.ok(plain.box.rows.every((x) => /^#/.test(x.text)));
});

test('SHIP-CREDIT the enhanced trade window and the host: the same offer and refusal; the shop asks the bank only for a boat; the commit asks again at the Yes and buys nothing on a credit no longer given, pays the purse its share, takes the loan in the shop\'s region and says so (mutants: the host\'s hook, the second asking, the share, the loan untaken)', () => {
  assert.match(ENHANCED, /const credit = mode === 'Buy' \? deps\.credit\?\.\(\[\.\.\.stagedForCost\(\)\], price\) \?\? null : null;/);
  assert.match(ENHANCED, /box = \{ rows: creditRows\(credit, price, deps\.gold\?\.\(\) \?\? 0\), buttons: 'YesNo', onYes: \(\) => confirmTrade\(price, credit\) \};/);
  assert.match(ENHANCED, /creditRefusalRows\(credit, credit\.lines\)/);
  assert.match(ENHANCED, /const proceeds = isSelling \? sellProceeds\(price, deps\.weight\?\.\(\) \?\? \{\}\) : credit;/);
  assert.match(MODES, /credit: \(staged, price\) => \(lotHasBoat\(staged\) \? shopCredit\(b, price\) : null\),/);
  assert.match(MODES, /const credit = proceeds\?\.kind === 'credit' \? creditAt\(proceeds\.region, price\) : null;\n\s*if \(proceeds\?\.kind === 'credit' && \(credit\?\.kind !== 'credit' \|\| credit\.loan !== proceeds\.loan\)\) return false;\n\s*deductGold\(playerEntity, credit \? credit\.pay : price\);/);
  assert.match(MODES, /takeCredit\(playerEntity\.bankAccounts, credit\.region, credit\.loan, \{ nowMinutes: Math\.floor\(ownMinutes\(\)\) \}\);/);
  assert.match(MODES, /const c = \{ \.\.\.creditDecision\(playerEntity\.bankAccounts, region, \{ price, purse: totalGoldAmount\(playerEntity\), level: playerEntity\.level \?\? 1 \}\), region \};/);
  assert.match(MODES, /const shopCredit = \(b, price\) => creditAt\(shopRegion\(b\), price\);/);
});
