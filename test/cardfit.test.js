// CARD-FIT (2026-09-28, Discord - Cruor, "New sigil items descriptor is a bit long!": "You can still interact with it by
// right clicking, but notably all the buttons on it's pop-up card are.. off the screen, because it's got a bit much on
// it!"; Mac: "Address screenshot for current and future weapons/gear. Want to improve this and reduce text bloat").
// THE ITEM CARD FITS AND SAYS LESS, for every piece the game has and every one it will get:
//   - a set tier's BRIEF (systems/sigilSets.js) is short enough for one line of the card, at every stage, for every set -
//     a new set's too - and its recovery is its own number, never in its words;
//   - the card's WORDS for every Aetheric piece stay under a budget (the set's and the sigil's blocks in their card dress,
//     the tier's lines without the lore), and the Info box (their whole dress) says more;
//   - the card's height is capped at its window and it sheds a step at a time before its BODY scrolls - its buttons are
//     a row of their own under the body, never inside it (ui/enhancedInventory.js fitCard, the placement, the sheet);
//   - the Info box is the whole read: the tier's lines and the lore, the sigil and the set whole.
// A layout engine is the last word: tools/cardFitProbe.mjs presses every button of the heaviest cards at six screens.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withDom } from './invdrag.mjs';
import { SIGIL_SETS, BRIEF_MAX, SET_STAGE_MAX, tierValues, setState, setLines, setSetsWearer, _resetSigilSetsForTests } from '../src/systems/sigilSets.js';
import { setSigilOnline, setSigilRenown, _resetSigilForTests } from '../src/systems/sigil.js';
import { AETHERIC_RECORDS, mintAetheric } from '../src/systems/aetheric.js';
import { rarityLines, LOOT_RARITY_KEY } from '../src/systems/lootRarity.js';
import { setPref, _resetForTests } from '../src/systems/uiPrefs.js';
import { sigilCard } from '../src/ui/sigilCard.js';
import { setCard } from '../src/ui/setCard.js';
import { fitCard, CARD_FITS, CARD_SHEET_SHARE } from '../src/ui/enhancedInventory.js';
import { PLUS_CSS } from '../src/ui/enhancedPlusStyle.js';
import { wrapToolTipRows, TOOLTIP_WRAP_W } from '../src/ui/toolTip.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
const kids = (n, cls) => (n?.children ?? []).flatMap((c) => [...(c.classList?.contains(cls) ? [c] : []), ...kids(c, cls)]);
const one = (n, cls) => kids(n, cls)[0] ?? null;
/** The words a block says - every node's own text (the mini DOM keeps each node's own). */
const words = (n) => (n ? [n.textContent ?? '', ...(n.children ?? []).map(words)].join('') : '');
/** The most characters a card's words may run to - the set's and the sigil's blocks in the card's dress and the tier's
 *  lines without the lore. The heaviest card (Ruhn's Gatecleaver: a blow, a set, three affixes) says 264. */
const CARD_WORDS_MAX = 320;

test('CARD-FIT every set tier\'s brief fits one line of the card - BRIEF_MAX at every stage from Faint to Ascendant, for every set there is and every one to come - in plain ASCII, with no recovery in its words (the tier\'s `recover` is its own number: the card\'s dashed tag, a line\'s ", every Ns") (mutants: a brief over the line; a recovery dropped from the view; the line saying the whole sentence)', () => {
  assert.equal(BRIEF_MAX, 32);
  let tiers = 0;
  for (const set of Object.values(SIGIL_SETS)) {
    for (const t of set.tiers) {
      tiers++;
      assert.equal(typeof t.brief, 'function', `${set.id}.${t.key}: a brief`);
      for (let st = 0; st <= SET_STAGE_MAX; st++) {
        const v = tierValues(t, st), b = t.brief(v);
        assert.ok(b.length > 0 && b.length <= BRIEF_MAX, `${set.id}.${t.key} at ${st}: "${b}" is ${b.length}`);
        assert.match(b, /^[\x20-\x7e]+$/, `${set.id}.${t.key}: plain ASCII`);
        assert.doesNotMatch(b, /[Rr]ecover|\bevery \d/, `${set.id}.${t.key}: "${b}" says its recovery in words`);
        assert.ok(b.length <= t.text(v).length, `${set.id}.${t.key}: never longer than its sentence`);
      }
    }
  }
  assert.equal(tiers, Object.keys(SIGIL_SETS).length * 3);
  // the view carries the brief and the recovery
  const st = setState('malacath', [{ sigil: { set: 'malacath', party: 1, xp: 0 } }], 1, true);
  assert.equal(st.tiers[2].brief, SIGIL_SETS.malacath.tiers[2].brief(st.tiers[2].values));
  assert.equal(st.tiers[2].recover, 300);
  assert.equal(st.tiers[1].recover, null, 'a tier with no recovery has none');
  // a line says the brief and the recovery after it
  _resetSigilForTests(); _resetSigilSetsForTests();
  const e = { isPlayer: true, items: [], equip: {} };
  setSetsWearer(() => e);
  const helm = { group: 'Armor', templateIndex: 107, sigil: { set: 'ruhn', party: 1, xp: 0 } };
  const lines = setLines(helm);
  assert.equal(lines[3], `6 pieces - Wrath of the Warden: ${SIGIL_SETS.ruhn.tiers[2].brief(tierValues(SIGIL_SETS.ruhn.tiers[2], 0))}, every 180s (6 more)`);
  // every set's lines, as the classic tooltip wraps them (its four-pixel glyph and one of spacing): two rows at most -
  // the sentences ran to four
  const measure = (r) => r.length * 5;
  for (const set of Object.values(SIGIL_SETS)) {
    const piece = { group: 'Armor', templateIndex: 107, sigil: { set: set.id, party: 1, xp: 0 } };
    for (const l of setLines(piece)) assert.ok(wrapToolTipRows([l], measure, TOOLTIP_WRAP_W).length <= 2, `${set.id}: "${l}" wraps in two rows at most`);
  }
  _resetSigilSetsForTests();
});

test('CARD-FIT the card\'s words for every Aetheric piece stay under CARD_WORDS_MAX - its tier\'s lines without the lore, its sigil\'s block and its set\'s in the card\'s dress - and the Info box\'s whole dress says more: every sentence, the Prince, the lore (mutants: the card\'s set block in its whole dress; the lore back on the card; the sigil\'s explanations back on the card)', () => {
  withDom(() => {
    _resetForTests(); setPref(LOOT_RARITY_KEY, true);
    _resetSigilForTests(); _resetSigilSetsForTests();
    setSigilOnline(true); setSigilRenown(12);
    const e = { isPlayer: true, items: [], equip: null };
    let heaviest = 0;
    for (const r of AETHERIC_RECORDS) {
      const it = mintAetheric(r);
      const card = rarityLines(it, { sigil: false, set: false, lore: false }).join('').length + words(sigilCard(it)).length + words(setCard(it, e)).length;
      const info = rarityLines(it, { sigil: false, set: false }).join('').length + words(sigilCard(it, { full: true })).length + words(setCard(it, e, undefined, { full: true })).length;
      heaviest = Math.max(heaviest, card);
      assert.ok(card <= CARD_WORDS_MAX, `${r.id}: the card says ${card} characters`);
      assert.ok(info > card * 1.5, `${r.id}: the Info box says more (${info} to ${card})`);
      assert.ok(!rarityLines(it, { sigil: false, set: false, lore: false }).includes(r.lore), `${r.id}: no lore on the card`);
      assert.ok(rarityLines(it, { sigil: false, set: false }).includes(r.lore), `${r.id}: the lore is the Info box's`);
    }
    assert.ok(heaviest > 200, `the budget is measured against real cards (${heaviest})`);
    _resetForTests(); _resetSigilForTests();
  });
});

test('CARD-FIT fitCard: the card is capped at its room, sheds CARD_FITS a step at a time while its BODY is taller than it can show, stops at the first step that fits, and past the last lets the body scroll - a card that fits sheds nothing; no room, no cap (mutants: the cap never written; a step skipped; a step taken with room to spare; the card\'s own height read in place of its body\'s)', () => {
  assert.deepEqual([...CARD_FITS], ['card-compact', 'card-tight']);
  assert.equal(CARD_SHEET_SHARE, 0.8);
  const card = (heights) => {
    const on = [];
    const body = { get scrollHeight() { return heights[on.length] ?? heights.at(-1); }, clientHeight: 400 };
    return { on, style: {}, classList: { add: (c) => on.push(c) }, querySelector: (q) => (q === ':scope > .card-body' ? body : null), scrollHeight: 999, clientHeight: 10 };
  };
  let c = card([560, 380]);
  assert.deepEqual(fitCard(c, 612), ['card-compact'], 'the first step was enough');
  assert.equal(c.style.maxHeight, '612px');
  c = card([560, 450, 420]);
  assert.deepEqual(fitCard(c, 612), ['card-compact', 'card-tight'], 'both steps, and the body scrolls the rest');
  c = card([390]);
  assert.deepEqual(fitCard(c, 612), [], 'a card that fits sheds nothing');
  c = card([2000]);
  assert.deepEqual(fitCard(c, 0), [], 'no room: nothing');
  assert.equal(c.style.maxHeight, undefined);
  assert.deepEqual(fitCard(null, 600), []);
});

test('CARD-FIT the placement: the band a card may stand in is its window\'s AND the screen\'s, its room that band less what the tip carries beside its card; fitted BEFORE its height is read; written in the tip\'s own containing block\'s frame; a phone\'s sheet rises to its share of the screen from the screen\'s foot (mutants: fitted after the height is read; the window\'s height alone - a window taller than the screen; the frame\'s origin for a box that is not it; the sheet placed as a tip)', () => {
  const inv = strip(read('src/ui/enhancedInventory.js'));
  assert.match(inv, /const card = tip\.querySelector\('\.card'\);\s*const chrome = card \? Math\.max\(0, tip\.offsetHeight - card\.offsetHeight\) : 0;\s*const sheet = window\.getComputedStyle\(tip\)\.position === 'fixed';\s*const bandTop = Math\.max\(w\.top, 0\) \+ 10, bandFoot = Math\.min\(w\.bottom, window\.innerHeight\) - 10;\s*fitCard\(card, \(sheet \? Math\.round\(window\.innerHeight \* CARD_SHEET_SHARE\) : bandFoot - bandTop\) - chrome\);\s*if \(sheet\) return;\s*const tw = tip\.offsetWidth; const th = tip\.offsetHeight;/);
  assert.match(inv, /const top = Math\.max\(bandTop, Math\.min\(r\.top \+ r\.height \/ 2 - th \/ 2, bandFoot - th\)\);/);
  assert.match(inv, /const box = tip\.offsetParent \?\? frame;\s*const b = box\.getBoundingClientRect\(\);\s*tip\.style\.left = `\$\{Math\.round\(left - b\.left - \(box\.clientLeft \?\? 0\)\)\}px`;\s*tip\.style\.top = `\$\{Math\.round\(top - b\.top - \(box\.clientTop \?\? 0\)\)\}px`;/);
  // the card's words in a body, its buttons under it
  assert.match(inv, /const \{ c, line, big \} = infoCard\(picked, side, render, \{ body: true \}\);\s*const acts = itemActs\(picked, side\);\s*c\.append\(acts\);/);
  assert.match(inv, /const into = body \? el\('div', 'card-body'\) : c;\s*if \(body\) c\.append\(into\);/);
});

test('CARD-FIT the sheet: the tip\'s card a column - its body the one thing that scrolls, its buttons a row of their own pinned under it - the tip free of the phone column\'s sheet, the phone\'s card a sheet at the screen\'s foot, its close bar the sheet\'s alone; the numbers as whole pairs; the lore\'s dim italic by its own class (mutants: the buttons inside the scroll; the tip stretched to the column\'s foot; the sheet with no foot; a pair broken across two lines; the last affix dressed as lore)', () => {
  const css = read('src/ui/enhancedStyle.js');
  assert.ok(css.includes('.pack-shell .packtip.packdetail .card { display: flex; flex-direction: column; overflow: hidden; }'));
  assert.match(css, /\.pack-shell \.packtip\.packdetail \.card-body \{ flex: 1 1 auto; min-height: 0; overflow-y: auto;/);
  assert.match(css, /\.pack-shell \.packtip\.packdetail \.card > \.acts \{ flex: 0 0 auto;/);
  assert.match(css, /overflow: visible;[\s\S]{0,300}max-height: none; bottom: auto; right: auto; \}/, 'the tip wears none of the phone column\'s sheet');
  assert.match(css, /@media \(max-width: 640px\) \{[\s\S]{0,400}\.pack-shell \.packtip\.packdetail \{ position: fixed; width: auto; max-width: none;\s*left: 0 !important; right: 0; top: auto !important; bottom: 0; max-height: none; \}/);
  assert.ok(css.includes('@media (min-width: 641px) { .pack-shell .packtip.packdetail .sheet-close { display: none; } }'));
  assert.ok(css.includes('.stats > .pair { display: contents; }'));
  assert.ok(css.includes('.pack-shell .packtip.packdetail .card .stats .pair { display: inline-flex; align-items: baseline; gap: 6px; white-space: nowrap; }'));
  assert.ok(css.includes('.packdetail ul.rarity li.lore { color: var(--dim); font-style: italic; }'));
  assert.doesNotMatch(css, /li:last-child:not\(:first-child\):not\(:nth-child\(2\)\)/, 'the last line is no longer taken for the lore');
  assert.ok(PLUS_CSS.includes('.inv-tip dl.stats > .pair { display: contents; }'));
  assert.ok(PLUS_CSS.includes('.setbox.compact .set-tier-every {'));
  assert.ok(PLUS_CSS.includes('.sigilbox.compact .sigil-gem.next { background: linear-gradient(90deg, var(--sigil-mid) 0 var(--fill, 0%), rgba(0,0,0,0.5) var(--fill, 0%)); }'));
});

test('CARD-FIT the Info box is the whole read: the tier\'s lines and the lore (a line the powers box says is not said twice), then the sigil and the set in their whole dress; the card\'s own list leaves the lore out (mutants: the Info box without the tier\'s lines; a line said twice; the card with the lore)', () => {
  const inv = strip(read('src/ui/enhancedInventory.js'));
  assert.match(inv, /const said = new Set\(boxes\.flat\(\)\.map\(\(r\) => String\(r\?\.text \?\? r \?\? ''\)\.trim\(\)\)\);\s*const tier = rarityLines\(item, \{ sigil: false, set: false \}\)\.filter\(\(t\) => t && !said\.has\(t\)\);\s*if \(tier\.length\) boxes\.splice\(1, 0, tier\.map\(\(text\) => \(\{ text, center: true \}\)\)\);/);
  assert.match(inv, /\{ const sb = sigilCard\(item, \{ full: true \}\); if \(sb\) card\.append\(sb\); \}/);
  assert.match(inv, /\{ const set = setCard\(item, deps\.entity, itemLongName, \{ full: true \}\); if \(set\) card\.append\(set\); \}/);
  assert.match(inv, /itemPowerLines\(picked, deps, \{ set: false, lore: false \}\)/);
  _resetForTests(); setPref(LOOT_RARITY_KEY, true);
  const leg = { group: 'Weapons', templateIndex: 120, rarity: 'aetheric', aetheric: 'oath-longsword', affixes: [], isIdentified: true };
  assert.ok(rarityLines(leg).length > rarityLines(leg, { lore: false }).length, 'the lore is the one line the card asks without');
  _resetForTests();
});
