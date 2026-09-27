// L10N3d (2026-09-27): THE WORDS BETWEEN THE BATCHES, IN THE PLAYER'S LANGUAGE. The five part-2 batches each routed the
// words of their own DFU windows; the lines a batch found in another's file - or in no one's - were routed after the
// merge, and are pinned here through the port's own functions: the exhausted swimmer's line and the sick body's alert
// (their readers beside their constants), the over-encumbered swimmer's latch, the weapon hand's switch line (said by the
// rig, where it is shown), the
// pinched purse (the one-coin row and the %d row), the Features tile that shows DFU's dungeon-texture words while its
// law stays English (All off and the switch reading find Off by the law's words), and the menu clock, which reads the
// time off the date rather than splitting a formatted line a translation need not shape the same. English is byte for
// byte what each showed before, with no language chosen and with English chosen again.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as tm from '../src/systems/textManager.js';
import { exhaustedInWaterText, EXHAUSTED_IN_WATER } from '../src/systems/rest.js';
import { youFeelSomewhatBadText, YOU_FEEL_SOMEWHAT_BAD } from '../src/systems/diseases.js';
import { afloatMessageStep, CANNOT_FLOAT_TEXT } from '../src/player/motor.js';
import { PlayerWeapon, USING_RIGHT_HAND_TEXT, USING_LEFT_HAND_TEXT } from '../src/combat/playerWeapon.js';
import { pickpocket } from '../src/systems/talk.js';
import { SKILLS } from '../src/systems/skills.js';
import { FEATURES } from '../src/systems/features.js';
import { tileStates, barReading, classicSegment } from '../src/ui/enhancedMenu.js';
import { _resetForTests as resetSettings } from '../src/systems/settings.js';

beforeEach(() => { tm._resetTextManagerForTests(); resetSettings(); });
const fr = (rows, table = 'Internal_Strings') => { tm.patchLocaleTable('fr', table, rows); tm.setLocale('fr'); };
const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };

test('L10N3d crossings: the exhausted swimmer\'s line and the sick body\'s alert read by DFU\'s keys - English their constants', () => {
  assert.equal(exhaustedInWaterText(), EXHAUSTED_IN_WATER);
  assert.equal(youFeelSomewhatBadText(), YOU_FEEL_SOMEWHAT_BAD);
  fr([['exhaustedInWater', 'La fatigue vous emporte dans une tombe liquide....'], ['youFeelSomewhatBad', 'Vous vous sentez un peu mal.']]);
  assert.equal(exhaustedInWaterText(), 'La fatigue vous emporte dans une tombe liquide....');
  assert.equal(youFeelSomewhatBadText(), 'Vous vous sentez un peu mal.');
  tm.setLocale('en');
  assert.equal(exhaustedInWaterText(), 'Fatigue overcomes you and sends you to a watery grave....');
  assert.equal(youFeelSomewhatBadText(), 'You feel somewhat bad.');
});

test('L10N3d crossings: the afloat latch says cannotFloat in the player\'s language, once; the weapon hand\'s switch - ToggleHand\'s English is the hand\'s name, and the rig says usingRightHand / usingLeftHand where it shows it', () => {
  const swimmer = () => ({ carriedWeight: () => 1000, swimming: true, displayAfloatMessage: false });
  assert.equal(afloatMessageStep(swimmer(), false), CANNOT_FLOAT_TEXT);
  fr([['cannotFloat', 'Vous portez trop pour flotter.'], ['usingRightHand', 'Arme dans la main droite.'], ['usingLeftHand', 'Arme dans la main gauche.']]);
  const p = swimmer();
  assert.equal(afloatMessageStep(p, false), 'Vous portez trop pour flotter.');
  assert.equal(afloatMessageStep(p, false), null, 'latched: said once');
  const w = new PlayerWeapon();
  assert.deepEqual([w.toggleHand({ apply: false, bowSwitching: false }), w.toggleHand({ apply: false, bowSwitching: false })].sort(),
    [USING_RIGHT_HAND_TEXT, USING_LEFT_HAND_TEXT].sort(), 'the hand\'s name, in any language (the rig reads it, and says the row)');
  const rig = readFileSync(new URL('../src/combat/weaponRig.js', import.meta.url), 'utf8');
  assert.match(rig, /say\(line === USING_RIGHT_HAND_TEXT \? localizedText\('usingRightHand', 'Using weapon in right hand\.'\) : localizedText\('usingLeftHand', 'Using weapon in left hand\.'\)\);/);
  assert.equal(/\bsay\(line\);/.test(rig), false, 'never the bare English');
});

test('L10N3d crossings: the pinched purse - youPinchedGoldPiece for one coin, youPinchedGoldPieces with %d filled AFTER the lookup', () => {
  const thief = () => ({
    isPlayer: true, level: 8, goldPieces: 0, items: [],
    skills: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 100])),
    skillUses: Object.fromEntries(Object.values(SKILLS).map((s) => [s, 0])),
    stats: { personality: 50 }, activeEffects: [],
  });
  assert.equal(pickpocket(thief(), { rolls: seq(0, 0.5, 0.5) }).message, 'You pinched 4 gold pieces.');
  assert.equal(pickpocket(thief(), { rolls: seq(0, 0.5, 0) }).message, 'You pinched 1 gold piece.');
  fr([['youPinchedGoldPiece', 'Vous avez chipé 1 pièce d\'or.'], ['youPinchedGoldPieces', 'Vous avez chipé %d pièces d\'or.']]);
  assert.equal(pickpocket(thief(), { rolls: seq(0, 0.5, 0.5) }).message, 'Vous avez chipé 4 pièces d\'or.');
  assert.equal(pickpocket(thief(), { rolls: seq(0, 0.5, 0) }).message, 'Vous avez chipé 1 pièce d\'or.');
});

test('L10N3d crossings: the dungeon-texture tile shows DFU\'s words in the player\'s language while its law - the labels All off and the switch reading use - stays English', () => {
  const row = FEATURES.find((f) => f.id === 'dungeon-wall-style');
  const en = tileStates(row);
  assert.deepEqual(en.labels, ['Classic', 'Climate', 'Climate Only', 'Random', 'Random Only']);
  assert.deepEqual(en.shown, en.labels, 'English: the words shown are the law\'s');
  tm.patchLocaleTable('fr', 'Internal_Settings', [['dungeonTextureModes', 'Classique\nClimat\nClimat seul\nAléatoire\nAléatoire seul']]);
  tm.setLocale('fr');
  const st = tileStates(row);
  assert.deepEqual(st.shown, ['Classique', 'Climat', 'Climat seul', 'Aléatoire', 'Aléatoire seul']);
  assert.deepEqual(st.labels, en.labels, 'the law under the words never moves');
  assert.deepEqual(barReading(st), barReading(en), 'a choice with no Off in either language');
  assert.equal(classicSegment(row, st), 0, 'All off still presses Classic');
  const src = readFileSync(new URL('../src/ui/enhancedMenu.js', import.meta.url), 'utf8');
  assert.match(src, /el\('button', `ft-segb\$\{i === r\.off \? ' off' : ''\}`, st\.shown\?\.\[i\] \?\? L\)/, 'the bar draws the shown word, else the law\'s');
});

test('L10N3d crossings: the menu clock reads the time off the date - never by splitting a formatted line at " on ", which a translation\'s pattern need not contain', () => {
  const src = readFileSync(new URL('../src/ui/enhancedMenu.js', import.meta.url), 'utf8');
  assert.equal(/split\(' on '\)/.test(src), false);
  assert.match(src, /el\('span', 'px-clocktime', formatText\('\{0:00\}:\{1:00\}:\{2:00\}', d\.hour, d\.minute, d\.second\)\)/);
  assert.equal(tm.formatText('{0:00}:{1:00}:{2:00}', 7, 5, 0), '07:05:00');
});

test('L10N3d crossings, by source: the hosts say each crossing line through its reader - never the bare English or its constant, which would stay English in every language', () => {
  const rd = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  const hosts = Object.fromEntries(['world', 'worldModes', 'exterior', 'dungeonContext', 'dungeon', 'townTalk'].map((h) => [h, rd(`scenes/${h}.js`)]));
  const BARE = [
    /\bTOO_FAR_AWAY_TEXT\b/, /'You are too far away\.\.\.'/, /\bEXHAUSTED_IN_WATER\b/, /watery grave/, /\bSUNLIGHT_TRAVEL_TEXT\b/,
    /initiate fast travel during the day/, /\bLOCKED_EXTERIOR_DOOR_TEXT\b/, /'Locked\.'/, /Interaction is now in \$\{/,
  ];
  for (const [h, s] of Object.entries(hosts)) for (const re of BARE) assert.equal(re.test(s), false, `${h}.js says ${re} bare`);
  for (const h of ['world', 'exterior', 'dungeonContext', 'worldModes']) assert.match(hosts[h], /out\.inWater \? \[exhaustedInWaterText\(\)\] :/, `${h}: the exhausted swimmer`);
  assert.match(hosts.worldModes, /townTalk\?\.say\?\.\(lockedExteriorDoorText\(\)\);/, 'the locked door');
  assert.match(hosts.world, /townTalk\.say\(sunlightTravelText\(\)\);/, 'the travel map door');
  assert.match(hosts.world, /&& isDayFromMinutes\(nowMin\)\) return sunlightTravelText\(\);/, 'the party\'s refusal');
  for (const h of ['world', 'exterior']) assert.match(hosts[h], /tooFarText: tooFarAwayText,/, `${h}: the horse cart's refusal`);
  assert.match(hosts.dungeon, /\{ setMidScreenText\(tooFarAwayText\(\)\); return true; \}/, 'the dungeon\'s own reach');
  for (const [p, n] of [['systems/diseases.js', 1], ['systems/poisons.js', 1]]) {
    assert.equal((rd(p).match(/onAlert\(youFeelSomewhatBadText\(\)\)/g) ?? []).length, n, `${p}: the alert`);
    assert.equal(/onAlert\((?:YOU_FEEL_SOMEWHAT_BAD|'You feel somewhat bad\.')\)/.test(rd(p)), false, `${p}: never bare`);
  }
});
