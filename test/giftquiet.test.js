// GIFT-QUIET (2026-10-04: "sometimes theres notification spam when putting a spell on companion. Ensure there's no
// leftover notifications"): a gift's lines - the armed ready's ("Press button to fire spell." and "Aim at your
// companion...") and the caster's ("You cast Heal on Hilda.") - are said once, then held back while they are asked for
// again inside GIFT_LINE_QUIET_S (systems/allyCast.js) of the cast engine's own clock (scenes/hostMagic.js sayGift).
// Each was a new toast every cast and told apart from the line before it, so the notice stack's repeat guard
// (ui/hudText.js NOTICE-SPAM: the back row only) never caught them - a heal cast again and again near a companion
// stacked three plates a cast in the Enhanced notice panel.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPlayerMagic } from '../src/scenes/hostMagic.js';
import { COMPANION_ARMED_LINE, GIFT_LINE_QUIET_S } from '../src/systems/allyCast.js';
import { PRESS_BUTTON_TO_FIRE_SPELL } from '../src/systems/mysticism.js';
import { HudText } from '../src/ui/hudText.js';

const fx = (type, subType = 0, mag = 20, dur = 0) => ({
  type, subType,
  magnitudeBaseLow: mag, magnitudeBaseHigh: mag, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  durationBase: dur, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1,
});
const EMPTY = { type: -1, subType: -1 };
const HEAL = fx(10, 8);
const spellOf = (rangeType) => ({ name: 'Balyna\'s Balm', index: 90, element: 4, rangeType, effects: [HEAL, EMPTY, EMPTY], icon: 7 });
const mkPlayer = () => ({
  isPlayer: true, level: 4, health: 20, maxHealth: 5000, maxMagicka: 5000, magicka: 5000,
  skills: new Array(40).fill(50), skillUses: new Array(40).fill(0),
  stats: { intelligence: 50, willpower: 50, endurance: 50 }, career: {}, activeEffects: [],
});
const hilda = (at) => ({
  companion: '42:Hilda', shipmate: true, dead: false,
  entity: { name: 'Hilda', health: 10, maxHealth: 5000, magicka: 0, maxMagicka: 0, fatigue: 100, maxFatigue: 100, level: 3, activeEffects: [],
    stats: { strength: 50, intelligence: 40, willpower: 40, agility: 50, endurance: 50, personality: 40, speed: 50, luck: 40 }, skills: new Array(40).fill(30), career: {}, team: 'PlayerAlly' },
  ai: { feet: [...at], height: 1.8 },
});
/** The engine with my companion at `at`; what it says goes into a HudText (the notice stack's model - one Enhanced
 *  plate a row), and `most` is the most rows it held at once. */
function rig(at) {
  const said = [];
  const hud = new HudText('giftquiet');
  let most = 0;
  const player = mkPlayer();
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt() {}, heal(n) { player.health += n; }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} },
    say: (l) => { said.push(l); hud.add(l); most = Math.max(most, hud.lines.length); }, surfacePlayer() {},
    foes: () => [],
    foeSinks: (f) => ({ hurt() {}, heal(n) { f.entity.health += n; }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls: () => 0.99, startCastAnim: null,
    companionBodies: () => [hilda(at)],
  });
  magic.firePending([0, 0.9, 0], [0, 0, 1]);
  /** `s` seconds of frames - the engine's clock and the stack's. */
  const wait = (s) => { for (let i = 0; i < Math.round(s * 30); i++) { magic.update(1 / 30, [0, 0, 0]); hud.tick(1 / 30); } };
  return { magic, said, most: () => most, wait };
}
const count = (said, line) => said.filter((l) => l === line).length;

test('GIFT-QUIET: six heals near my companion, a second apart - her armed lines said once, and the notice stack never holds more than three plates, where it climbed to eleven (mutants: the gift lines said every time, the asking not keeping the window open)', () => {
  const { magic, said, most, wait } = rig([1.5, 0, 0.5]);
  for (let k = 0; k < 6; k++) {
    assert.equal(magic.readySpell(spellOf(0)), true);
    magic.castInput([0, 0.9, 0], [1, 0, 0.33]);   // aimed away from her: mine
    wait(1);
  }
  assert.equal(count(said, PRESS_BUTTON_TO_FIRE_SPELL), 1, said.join(' | '));
  assert.equal(count(said, COMPANION_ARMED_LINE), 1, said.join(' | '));
  assert.equal(count(said, 'You are healed 20 points.'), 6, 'every heal said - an event, not a gift line');
  assert.ok(most() <= 3, `at most the armed pair and the heal on screen (held ${most()})`);
});

test('GIFT-QUIET: the caster\'s line on my companion is said once while the heals keep coming, and the classic ready line it no longer splits merges at the back of the stack - three plates at most, where it climbed to ten (mutants: the gift line said every cast)', () => {
  const { magic, said, most, wait } = rig([0, 0, 2]);
  for (let k = 0; k < 6; k++) {
    magic.readySpell(spellOf(1));   // by touch: DFU's own ready line, every time
    magic.castInput([0, 0.9, 0], [0, 0, 1]);
    wait(1);
  }
  assert.equal(count(said, 'You cast Balyna\'s Balm on Hilda.'), 1, said.join(' | '));
  assert.equal(count(said, PRESS_BUTTON_TO_FIRE_SPELL), 6, 'the classic ready line is DFU\'s and stays');
  assert.ok(most() <= 3, `ready, cast, ready - the rest merged (held ${most()})`);
});

test('GIFT-QUIET: after a pause of GIFT_LINE_QUIET_S the lines are said again; a ready inside the window keeps it open (mutants: the clock never advanced, the window not refreshed by the asking)', () => {
  const { magic, said, wait } = rig([1.5, 0, 0.5]);
  const cast = () => { magic.readySpell(spellOf(0)); magic.castInput([0, 0.9, 0], [1, 0, 0.33]); };
  cast();
  wait(GIFT_LINE_QUIET_S * 0.6); cast();   // inside: held back
  wait(GIFT_LINE_QUIET_S * 0.6); cast();   // past the first saying, inside the last asking: still held back
  assert.equal(count(said, COMPANION_ARMED_LINE), 1, said.join(' | '));
  wait(GIFT_LINE_QUIET_S + 1); cast();   // a real pause: said again
  assert.equal(count(said, COMPANION_ARMED_LINE), 2, said.join(' | '));
  assert.equal(count(said, PRESS_BUTTON_TO_FIRE_SPELL), 2);
});
