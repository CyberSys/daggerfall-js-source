// DISC28-D (2026-09-28, Discord: "the speed attribute only affects the third-person animation, not the first-person
// swing rate", pointing at weaponStates.js's formula).
//
// The formula was right - GetMeleeWeaponAnimTime is 3*(115-LiveSpeed)/980 a frame (FormulaHelper.cs:830-838) - and
// never saw the player. The rig built its PlayerWeapon with no speed, the weapon took the default 50 as a NUMBER once,
// and nothing wrote it again: every player's swing clock, hit frame and bow cooldown ran at Speed 50, while the
// third-person body and the widget's clone read the live stat. DFU asks player.Stats.LiveSpeed on every UpdateWeapon
// (FPSWeapon.cs:431, :549-556). The weapon now reads a live Speed, and the rig hands it the entity's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PlayerWeapon } from '../src/combat/playerWeapon.js';
import { machineAttack, getMeleeWeaponAnimTime } from '../src/characters/weaponStates.js';

const SABER = { name: 'Saber', templateIndex: 117 };
const DT = 1 / 240;

/** Seconds from the strike to the machine's return to Idle, driven through the weapon's own update. */
function swingSeconds(pw) {
  assert.ok(machineAttack(pw.machine, 'StrikeDown'));
  let t = 0;
  while (pw.machine.state !== 'Idle' && t < 10) { pw.update(DT); t += DT; }
  return t;
}
const drawn = (liveSpeed) => { const pw = new PlayerWeapon({ weapon: SABER, liveSpeed }); pw.sheathed = false; pw.update(0); return pw; };

test('DISC28-D: the first-person swing runs on the Speed it is given - fast is fast, slow is slow', () => {
  const at50 = swingSeconds(drawn(() => 50));
  const at100 = swingSeconds(drawn(() => 100));
  const at20 = swingSeconds(drawn(() => 20));
  // five frames a swing, each the formula's tick (the remainder dropped per resume: within a tick and a step)
  const near = (got, speed) => Math.abs(got - 5 * getMeleeWeaponAnimTime(speed)) <= getMeleeWeaponAnimTime(speed) + 2 * DT;
  assert.ok(near(at50, 50), `Speed 50: ${at50.toFixed(3)}s`);
  assert.ok(near(at100, 100), `Speed 100: ${at100.toFixed(3)}s`);
  assert.ok(near(at20, 20), `Speed 20: ${at20.toFixed(3)}s`);
  assert.ok(at100 < at50 / 3, 'Speed 100 swings about four times as fast as 50');
  assert.ok(at20 > at50 * 1.4, 'and Speed 20 half again as slow');
});

test('DISC28-D: the Speed is read LIVE - a stat that changes mid-life (a spell, a level, a curse) changes the next swing', () => {
  let speed = 50;
  const pw = drawn(() => speed);
  const before = swingSeconds(pw);
  speed = 100;
  const after = swingSeconds(pw);
  assert.ok(after < before / 3, `${before.toFixed(3)}s at 50, then ${after.toFixed(3)}s at 100 - no rebuild`);
  assert.equal(pw.liveSpeed, 100);
});

test('DISC28-D: a plain number is still a fixed Speed (every formula pin at 50), and assigning one replaces the reader', () => {
  const pw = drawn(50);
  assert.equal(pw.liveSpeed, 50);
  pw.liveSpeed = 90;
  assert.equal(pw.liveSpeed, 90);
});

test('DISC28-D: the rig hands its weapon the entity\'s live Speed', () => {
  const src = readFileSync(new URL('../src/combat/weaponRig.js', import.meta.url), 'utf8');
  assert.match(src, /new PlayerWeapon\(\{ liveSpeed: \(\) => \(entity \? liveStat\(entity, 'speed'\) : 50\) \}\)/);
  assert.doesNotMatch(src, /new PlayerWeapon\(\{\}\)/, 'no weapon built blind to the player');
});
