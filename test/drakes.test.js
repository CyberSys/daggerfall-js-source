// DRAKES (2026-09-29, Mac: "Can we change the name of marks to something else"; asked what to, "Drakes"; bible/06-Systems/
// Online-Arc.md DRAKES): THE SERVER'S CURRENCY IS CALLED DRAKES WHEREVER A PLAYER READS IT. Only the words changed: the
// balances, the ledger, the routes, the switch (MARKS_OPEN) and the code's own name for them (marks, MARKS1) stand, so
// no account's balance moved and no stored row was touched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { marksText } from '../src/net/marksLaw.js';
import { accountRefusalText } from '../src/net/accountClient.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** A source with its comments blanked - what is left is code and the words it shows. */
function code(text) {
  const out = text.split('');
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '\'' || c === '"' || c === '`') { quote = c; continue; }
    if (text.startsWith('/*', i)) { const j = text.indexOf('*/', i + 2); const end = j < 0 ? text.length : j + 2; for (let k = i; k < end; k++) if (out[k] !== '\n') out[k] = ' '; i = end - 1; continue; }
    if (text.startsWith('//', i)) { const j = text.indexOf('\n', i); const end = j < 0 ? text.length : j; for (let k = i; k < end; k++) out[k] = ' '; i = end - 1; }
  }
  return out.join('');
}

/** Every file that shows the currency to a player. */
const SHOWN = [
  'src/net/marksLaw.js', 'src/net/marksBook.js', 'src/net/accountClient.js', 'src/scenes/world.js', 'src/ui/bankWindow.js',
  'src/ui/enhancedAccount.js', 'src/ui/enhancedPorts.js', 'src/ui/marketTab.js', 'src/ui/workTab.js', 'src/ui/noticeWindow.js',
  'src/ui/profPages.js', 'src/ui/socialPanel.js',
];

test('DRAKES a balance reads in Drakes - one Drake, and the rest Drakes (mutants: the old name back; "1 Drakes")', () => {
  assert.equal(marksText(1), '1 Drake');
  assert.equal(marksText(1240), '1,240 Drakes');
  assert.equal(marksText(0), '0 Drakes');
  assert.equal(accountRefusalText('marks-short'), 'You do not hold that many Drakes.');
  assert.equal(accountRefusalText('guild-marks-short'), 'The treasury does not hold that many Drakes.');
});

test('DRAKES no word a player reads says Marks any more - the account card, the Bank, the market, the Work tab, the guild treasury, the professions\' pages, the refusals (mutants: a label or a line left on the old name)', () => {
  for (const f of SHOWN) {
    const left = code(src(f)).split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /\bMarks?\b/.test(l));
    assert.deepEqual(left.map(([n, l]) => `${f}:${n}: ${l.trim().slice(0, 90)}`), [], `${f} still shows the old name`);
  }
  // the places it is said, by name
  const ports = src('src/ui/enhancedPorts.js');
  for (const w of ["'Drakes to sell'", "title: 'Drakes'", "['Drakes held'", '`${MARKS_BANK.goldPerMark} gold a Drake`', "'Sell Drakes'"]) assert.ok(ports.includes(w), w);
  assert.match(src('src/ui/enhancedAccount.js'), /row\('Drakes', marksText\(flow\.account\.marks\)\)/, 'the account card');
  assert.match(src('src/ui/socialPanel.js'), /el\('div', 'dfsocial-sec', 'Drake treasury'\)/, 'the guild\'s treasury');
  assert.match(src('src/ui/bankWindow.js'), /MARKS_COUNTING = 'The Bank counts your Drakes\.\.\.'/);
  // and the unrelated marks stand: DFU's Mark slots, the King's Mark, the map's middle-click, the blood marks
  assert.match(src('src/ui/enhancedInventory.js'), /\[EQUIP_SLOTS\.Mark0\]: \{ x: 44, y: 296, label: 'Mark', off: true \}/);
  assert.match(src('src/systems/lootRarity.js'), /name: "King's Mark"/);
  assert.match(src('src/systems/travelOptionsText.js'), /MiddleClick - Mark a location/);
});
