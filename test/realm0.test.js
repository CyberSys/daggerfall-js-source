// REALM phase 0 (2026-09-28, Mac: "I wanna do this as comprehensively as possible. A true separation while allowing
// people to still play offline ... balance the gold economy, eliminate duping, eliminate true overpowered builds
// online"): the hotfixes that need no migration (bible/06-Systems/Realm-Arc.md, "Phases").
//   P0.1 - the URL's powers stay offline: an online boot drops ?shot (and window.__addGold with it), ?fly, ?nofoes and
//          the rest before anything reads them.
//   P0.2 - the balance mods are the room's whole online: every key of Meaner Monsters, PCAAO, Unleveled Loot,
//          Roleplay & Realism (its two cosmetic keys aside), RR: Items and Oblivion leveling's dials reads its shipped
//          default, where only their Enable switch was forced before.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ONLINE_REFUSED_FLAGS, refuseOnlinePowerFlags, ONLINE_WHOLE_MODS, ONLINE_ROOM_MOD_KEYS, onlineWholeModKey } from '../src/systems/onlineLane.js';
import { MOD_SETTINGS, modSetting, setModSetting, onlineModSetting, _resetModSettings } from '../src/systems/modSettings.js';
import { onlineSyncPlan } from '../src/systems/onlineSync.js';

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
