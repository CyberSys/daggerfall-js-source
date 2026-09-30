// FIELD BUGS 2026-09-30b (TOOL-SAID) - three players, one fault: "I've been chopping wood but it doesn't look like
// anything about the logging profession is changing"; "I've been using my sickle to gather herbs in the wild, but I dont
// get any exp towards the herbology skill"; "I fish, or use the axe and I get no exp ... I just physically get lumber in
// the misc tab. Is using the tools in the wilderness via use/hotkey not how you gain exp?" ("Skinning is working though"
// - the Skinning Knife has no Use: a body is its only gesture).
//
// Online, a tool used from the pack, the hotbar or a quick slot is Foraging's own gesture (FORAGE0 law 4): the mod's
// yields into the pack, its quest, its wear - and no profession, with nothing said. The professions gather at their
// nodes. With the professions this account's, the Use now says so after the mod's own words: no XP from this, and how
// the profession gathers, naming the node and the key. The mod's yields, lines and quests are kept (law 1); offline and
// a guest's lane are the mod's 1:1; the Spade is Foraging's alone. The Professions page says how the three other
// gathering professions gather, and the empty Stores say where their goods come from.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  setForagingHost, createForagingItem, installForaging, _setForagingRandomForTests, professionToolLine, PROFESSION_TOOL_HOW,
} from '../src/systems/foragingInstall.js';
import { FT } from '../src/systems/foragingLaw.js';
import { useItem, usableItem } from '../src/systems/useItem.js';
import * as qs from '../src/systems/quickslots.js';
import { useResultAction } from '../src/ui/enhancedInventory.js';
import { registerPresenter } from '../src/systems/notify.js';
import { setModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { CLIMATES, LOCATION_TYPES } from '../src/formats/mapsFile.js';
import { FATIGUE_MULTIPLIER } from '../src/systems/statMods.js';
import { GATHER_HOW, STORES_EMPTY_LINE } from '../src/ui/profPages.js';

const heard = [];
registerPresenter({ hudText: (l) => { heard.push(l); return true; }, popupMessage: (l) => { heard.push(`POPUP ${l}`); return true; }, priority: 99 });
installForaging({ fetchBytes: async () => new Uint8Array(0) });

const WILD = Object.freeze({ inside: false, insideDungeon: false, insideCastle: false, locationType: LOCATION_TYPES.None, inLocationRect: false,
  hour: 12, climate: CLIMATES.Woodlands, region: 17, enemiesNear: false, carriedWeight: 10, maxEncumbrance: 100, swimming: false, exteriorWater: 'None' });
const player = () => ({ stats: { intelligence: 62, strength: 55, agility: 50, endurance: 50, luck: 45 }, items: [], wagonItems: [], fatigue: 40 * FATIGUE_MULTIPLIER, health: 20, maxHealth: 100, magicka: 5, maxMagicka: 50 });
const CHOP = 'You were able to chop and gather three Wood Bundles!';

/** Online (or not), the professions open (or not), Woodlands at noon (or `world`); the quests a use starts. */
function lane({ online = true, open = true, world = WILD } = {}) {
  _resetModSettings(); heard.length = 0;
  globalThis.location = { search: online ? '?online=1' : '' };
  const started = [];
  setForagingHost({
    world: () => world, monthValue: () => 5, entity: () => null, startQuest: (n) => { started.push(n); return true; },
    professionsOpen: () => open, keyLabel: (a) => (a === 'Interact' ? 'E' : a === 'ActChoice' ? 'Up' : null),
  });
  _setForagingRandomForTests(() => 0.99);   // the best draw of every table: Foraging always yields
  return started;
}
const done = () => { _setForagingRandomForTests(null); setForagingHost(null); delete globalThis.location; };
const withTool = (t) => { const e = player(); const tool = createForagingItem(t); e.items.push(tool); return { e, tool }; };
const bundles = (e) => e.items.filter((i) => i.templateIndex === FT.WoodBundle).length;

test('TOOL-SAID: online, the professions open - the pack\'s Wood-Axe is Foraging\'s still, and its box says there is no Logging XP and where Logging is done', () => {
  const started = lane();
  try {
    const { e, tool } = withTool(FT.WoodAxe);
    const r = useItem(tool, e.items, { entity: e });   // the pack's one use seam (enhancedInventory, nativeInventory)
    assert.equal(bundles(e), 3, 'the mod\'s yield kept (law 1)');
    assert.deepEqual(started, ['ChopWoodQuest'], 'the mod\'s quest kept');
    assert.equal(tool.currentCondition, 49, 'the mod\'s wear kept');
    assert.ok(r.text.startsWith(CHOP), 'the mod\'s own words first');
    assert.match(r.text, /No Logging XP from this\. Logging is done at a tree .* press E\b/);
    assert.equal(useResultAction(r).text, r.text, 'the open pack\'s box says both');
  } finally { done(); }
});

test('TOOL-SAID: each profession tool names its profession, its node and the key; the Spade stays Foraging\'s, said nothing more', () => {
  const cases = [[FT.Sickle, /No Herbalism XP.*herb patch.*press E\b/], [FT.PickAxe, /No Mining XP.*ore vein or a boulder.*press E\b/],
    [FT.FishingNet, /No Fishing XP.*in water.*press E\b/], [FT.Basket, /No Herbalism XP.*Basket searches an herb patch.*press Up for the Basket, then E\b/]];
  for (const [t, words] of cases) {
    lane({ world: { ...WILD, swimming: true } });
    try {
      const { e, tool } = withTool(t);
      const r = useItem(tool, e.items, { entity: e });
      assert.match(useResultAction(r).text ?? '', words, `${t}: the box says how the profession gathers`);
    } finally { done(); }
  }
  const started = lane({ world: { ...WILD, locationType: LOCATION_TYPES.Graveyard, inLocationRect: true } });
  try {
    const { e, tool } = withTool(FT.Spade);
    const r = useItem(tool, e.items, { entity: e });
    assert.match(started[0] ?? '', /^GraveRobbingQuest/, 'the Spade robs the grave - Foraging\'s alone (FORAGE0 14.2, 14.8)');
    assert.equal(r?.text ?? null, null);
    assert.equal(professionToolLine(FT.Spade), null);
    assert.deepEqual(Object.keys(PROFESSION_TOOL_HOW).map(Number).sort((a, b) => a - b), [FT.WoodAxe, FT.PickAxe, FT.Sickle, FT.FishingNet, FT.Basket].sort((a, b) => a - b));
  } finally { done(); }
});

test('TOOL-SAID: a refused Use ("You cannot mine in here!") says the line after the mod\'s refusal', () => {
  lane({ world: { ...WILD, inside: true } });
  try {
    const { e, tool } = withTool(FT.PickAxe);
    const r = useItem(tool, e.items, { entity: e });
    assert.equal(r?.refused, true);
    assert.equal(heard.length, 2, JSON.stringify(heard));
    assert.match(heard[1], /No Mining XP from this/);
  } finally { done(); }
});

test('TOOL-SAID: the hotbar\'s Wood-Axe (hotbarPress -> quick use -> useItem) says the mod\'s line and the professions\' after it', () => {
  lane();
  try {
    const { e, tool } = withTool(FT.WoodAxe);
    qs.clearHotbar();
    qs.setHotbarSlot(0, qs.hotbarEntryForItem(tool));
    const said = [];
    const doors = { quickUse: (n) => { qs.useQuickslot(n === 1 ? 'c1' : 'c2', { entity: e, items: e.items, hooks: {}, say: (l) => said.push(l) }); return true; } };
    qs.hotbarPress(0, { entity: e, doors, say: (l) => said.push(l) });
    assert.equal(bundles(e), 3);
    assert.equal(said.length, 1, JSON.stringify(said));
    assert.ok(said[0].startsWith(CHOP));
    assert.match(said[0], /No Logging XP from this/);
  } finally { done(); qs.clearHotbar(); }
});

test('TOOL-SAID: Foraging switched off online, the professions open - the card still offers Use, and it says how the profession gathers (law 6)', () => {
  lane();
  try {
    setModSetting('foraging', 'Enabled', false);
    const { e, tool } = withTool(FT.Sickle);
    assert.equal(usableItem(tool), true, 'the card offers Use');
    const r = useItem(tool, e.items, { entity: e });
    assert.equal(heard.length, 1);
    assert.match(heard[0], /No Herbalism XP.*herb patch/);
    assert.equal(r?.refused, true, 'nothing was gathered');
    assert.deepEqual(e.items.map((i) => i.templateIndex), [FT.Sickle]);
  } finally { done(); }
});

test('TOOL-SAID keeps the lanes: offline, and online with the professions closed (a guest), the Wood-Axe is Foraging\'s 1:1', () => {
  for (const o of [{ online: false, open: true }, { online: true, open: false }]) {
    const started = lane(o);
    try {
      const { e, tool } = withTool(FT.WoodAxe);
      const r = useItem(tool, e.items, { entity: e });
      assert.equal(r?.text, CHOP, JSON.stringify(o));
      assert.equal(bundles(e), 3);
      assert.deepEqual(started, ['ChopWoodQuest']);
      assert.equal(tool.currentCondition, 49);
    } finally { done(); }
    lane(o);
    try {
      setModSetting('foraging', 'Enabled', false);
      const { tool } = withTool(FT.WoodAxe);
      assert.equal(usableItem(tool), false, `${JSON.stringify(o)}: the switch off, the tool is inert`);
    } finally { done(); }
  }
});

test('TOOL-SAID: the world host tells Foraging whether the professions are this account\'s, and the keys (world.js setForagingHost)', () => {
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const at = w.indexOf('setForagingHost({');
  assert.ok(at > 0);
  const host = w.slice(at, w.indexOf('\n  });', at));
  assert.match(host, /professionsOpen: \(\) => profBook\?\.state\.open === true,/);
  assert.match(host, /keyLabel: \(a\) => \{ const c = getBinding\(bindings\(\), a\); return c \? tagText\(c\) : null; \},/);
});

test('TOOL-SAID: the Professions page says how Herbalism, Mining and Logging gather, and the empty Stores where their goods come from', () => {
  assert.match(GATHER_HOW.herbalism, /herb patch/);
  assert.match(GATHER_HOW.mining, /ore vein or a boulder/);
  assert.match(GATHER_HOW.logging, /tree/);
  for (const k of ['herbalism', 'mining', 'logging']) assert.match(GATHER_HOW[k], /from your pack is Foraging's own and earns no XP/);
  assert.match(STORES_EMPTY_LINE, /A tool used from your pack gathers into the pack, not here/);
  const src = readFileSync(new URL('../src/ui/profPages.js', import.meta.url), 'utf8');
  assert.match(src, /if \(GATHER_HOW\[_sel\]\) pane\.append\(el\('p', 'px-note', GATHER_HOW\[_sel\]\)\);/);
  assert.match(src, /: STORES_EMPTY_LINE\)\);/);
});
