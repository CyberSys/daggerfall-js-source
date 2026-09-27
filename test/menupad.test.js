// PAD-DOOR + PAD-SETTINGS (2026-09-27, Discord - an AYN Thor: "i can login get to the main screen but im unable to
// select online, load game anything" - "doesnt seem to let me change controller sensitivity either, i press the 1.0
// to try and change it but it doesnt register"). The front door answers a controller (ui/menuPad.js - walked in a
// real page by tools/menuPadProbe.mjs), and the four gamepad settings are numbers with steppers, not readouts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PAD, STICK_DIRECTION, REPEAT_DELAY_MS, REPEAT_MS, REFOCUS_MS, padDirection, pickDoorPad, nextFocus, nearestTo,
  padDoorFrame, attachMenuPad,
} from '../src/ui/menuPad.js';
import { widgetFor, formatValue, stepValue, NUMBER_LAW } from '../src/ui/settingsLaw.js';

const pad = (held = [], axes = [0, 0]) => ({
  mapping: 'standard', connected: true, axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: held.includes(i) })),
});

/** A page of controls in a grid of 100 px cells: [name, col, row]. */
function fakeUi(cells) {
  const els = cells.map(([name, col, row]) => ({ name, connected: true, rect: { x: col * 100, y: row * 100, w: 80, h: 40 }, steps: 0, steppable: name.startsWith('select') }));
  const ui = {
    els, focused: null, pressed: [], backs: 0,
    candidates: () => els.filter((e) => e.connected).map((e) => ({ el: e, rect: e.rect })),
    connected: (e) => e.connected,
    active: () => (ui.focused && ui.focused.connected ? ui.focused : null),
    focus: (e) => { ui.focused = e; },
    press: (e) => ui.pressed.push(e.name),
    back: () => { ui.backs++; },
    step: (e, dir) => { if (!e.steppable) return false; e.steps += dir === 'right' ? 1 : -1; return true; },
  };
  return ui;
}
const fresh = () => ({ confirm: false, back: false, dir: null, heldAt: 0, lastRepeat: 0, lastEl: null, lastRect: null, lostAt: null });

test('PAD-DOOR: the d-pad first, then the left stick past half-way; a standard pad is the one read', () => {
  assert.equal(padDirection(pad([PAD.UP])), 'up');
  assert.equal(padDirection(pad([PAD.DOWN])), 'down');
  assert.equal(padDirection(pad([PAD.LEFT])), 'left');
  assert.equal(padDirection(pad([PAD.RIGHT])), 'right');
  assert.equal(padDirection(pad([], [0, STICK_DIRECTION - 0.01])), null, 'inside half-way is no direction');
  assert.equal(padDirection(pad([], [0, 0.9])), 'down');
  assert.equal(padDirection(pad([], [-0.8, 0.3])), 'left', 'the larger axis wins');
  assert.equal(padDirection(pad([PAD.UP], [0, 0.9])), 'up', 'the d-pad before the stick');
  const odd = { ...pad(), mapping: '' };
  const std = pad();
  assert.equal(pickDoorPad([null, odd, std]), std);
  assert.equal(pickDoorPad([null, odd]), odd);
  assert.equal(pickDoorPad([null, undefined]), null);
});

test('PAD-DOOR: the focus goes to the nearest control THAT way, the one in line before the one off to the side', () => {
  const at = (x, y) => ({ rect: { x, y, w: 10, h: 10 } });
  const from = { x: 0, y: 0, w: 10, h: 10 };
  const inLine = at(0, 100), aside = at(60, 60), behind = at(0, -50);
  assert.equal(nextFocus(from, [aside, inLine, behind], 'down'), inLine, 'in line at 100 beats aside at 60 + 2x60');
  // the weight is what decides it: 50 ahead and 40 across is nearer as the crow flies (90 < 100), and still loses
  assert.equal(nextFocus(from, [at(40, 50), inLine], 'down'), inLine, 'across counts double: 50 + 2x40 = 130 > 100');
  assert.equal(nextFocus(from, [behind], 'down'), null, 'nothing that way');
  assert.equal(nextFocus(from, [behind, inLine], 'up'), behind);
  assert.equal(nextFocus(from, [aside], 'right'), aside);
  assert.equal(nextFocus(from, [aside], 'left'), null);
  assert.equal(nearestTo(from, [inLine, aside, behind]), behind);
});

test('PAD-DOOR: A focuses the first control, then presses the focused one - once per press, however long it is held', () => {
  const ui = fakeUi([['Continue', 0, 0], ['Load Game', 0, 1]]);
  const s = fresh();
  padDoorFrame(pad([PAD.A]), ui, s, 0);
  assert.equal(ui.focused?.name, 'Continue', 'nothing focused: the first press focuses the first control');
  assert.deepEqual(ui.pressed, []);
  padDoorFrame(pad([PAD.A]), ui, s, 16);   // still held
  assert.deepEqual(ui.pressed, [], 'a held A is one press');
  padDoorFrame(pad([]), ui, s, 32);
  padDoorFrame(pad([PAD.A]), ui, s, 48);
  assert.deepEqual(ui.pressed, ['Continue']);
  padDoorFrame(pad([]), ui, s, 64);
  padDoorFrame(pad([PAD.START]), ui, s, 80);
  assert.deepEqual(ui.pressed, ['Continue', 'Continue'], 'Start presses too');
});

test('PAD-DOOR: B is the door\'s Escape, once per press', () => {
  const ui = fakeUi([['Continue', 0, 0]]);
  const s = fresh();
  padDoorFrame(pad([PAD.B]), ui, s, 0);
  padDoorFrame(pad([PAD.B]), ui, s, 16);
  assert.equal(ui.backs, 1);
  padDoorFrame(pad([]), ui, s, 32);
  padDoorFrame(pad([PAD.B]), ui, s, 48);
  assert.equal(ui.backs, 2);
});

test('PAD-DOOR: a held direction moves once, then repeats after the delay at the repeat rate', () => {
  const ui = fakeUi([['a', 0, 0], ['b', 0, 1], ['c', 0, 2], ['d', 0, 3], ['e', 0, 4], ['f', 0, 5]]);
  const s = fresh();
  ui.focused = ui.els[0];
  padDoorFrame(pad([PAD.DOWN]), ui, s, 0);
  assert.equal(ui.focused.name, 'b');
  padDoorFrame(pad([PAD.DOWN]), ui, s, REPEAT_DELAY_MS - 1);
  assert.equal(ui.focused.name, 'b', 'no repeat before the delay');
  padDoorFrame(pad([PAD.DOWN]), ui, s, REPEAT_DELAY_MS);
  assert.equal(ui.focused.name, 'c');
  padDoorFrame(pad([PAD.DOWN]), ui, s, REPEAT_DELAY_MS + REPEAT_MS - 1);
  assert.equal(ui.focused.name, 'c');
  padDoorFrame(pad([PAD.DOWN]), ui, s, REPEAT_DELAY_MS + REPEAT_MS);
  assert.equal(ui.focused.name, 'd');
  padDoorFrame(pad([]), ui, s, 2000);
  padDoorFrame(pad([PAD.UP]), ui, s, 2016);
  assert.equal(ui.focused.name, 'c', 'a new direction moves at once');
});

test('PAD-DOOR: left and right step a list box instead of leaving it; up and down still leave', () => {
  const ui = fakeUi([['select-skin', 0, 0], ['Next', 1, 0], ['Below', 0, 1]]);
  const s = fresh();
  ui.focused = ui.els[0];
  padDoorFrame(pad([PAD.RIGHT]), ui, s, 0);
  assert.equal(ui.focused.name, 'select-skin');
  assert.equal(ui.els[0].steps, 1);
  padDoorFrame(pad([]), ui, s, 16);
  padDoorFrame(pad([PAD.DOWN]), ui, s, 32);
  assert.equal(ui.focused.name, 'Below');
});

test('PAD-DOOR: a press that redraws the menu puts the focus back on the control now standing there - and a new screen starts over', () => {
  const ui = fakeUi([['Continue', 0, 0], ['Online', 0, 3]]);
  const s = fresh();
  padDoorFrame(pad([PAD.DOWN]), ui, s, 0);            // focuses Continue (nothing was)
  padDoorFrame(pad([]), ui, s, 16);
  padDoorFrame(pad([PAD.DOWN]), ui, s, 32);           // -> Online
  assert.equal(ui.focused.name, 'Online');
  // the press redraws: the rail button is replaced by a new one at the same place
  ui.els[1].connected = false;
  const redrawn = { name: 'Online (redrawn)', connected: true, rect: { x: 2, y: 301, w: 80, h: 40 } };
  ui.els.push(redrawn);
  padDoorFrame(pad([]), ui, s, 48);
  assert.equal(ui.focused, redrawn, 'the same button, redrawn, holds the focus again');
  // a different screen: nothing where it stood, and after the grace nothing is resumed
  const ui2 = fakeUi([['Begin', 3, 2]]);
  const s2 = fresh();
  padDoorFrame(pad([PAD.A]), ui2, s2, 0);            // focus Begin
  ui2.els[0].connected = false;
  ui2.els.push({ name: 'Continue', connected: true, rect: { x: 0, y: 0, w: 80, h: 40 } }, { name: 'About', connected: true, rect: { x: 600, y: 400, w: 80, h: 40 } });
  padDoorFrame(pad([]), ui2, s2, 16);
  assert.equal(ui2.active(), null, 'no control stands where Begin stood');
  padDoorFrame(pad([]), ui2, s2, 16 + REFOCUS_MS + 1);
  assert.equal(s2.lastEl, null, 'the grace ends: nothing to resume');
  padDoorFrame(pad([PAD.DOWN]), ui2, s2, 16 + REFOCUS_MS + 20);
  assert.equal(ui2.focused.name, 'Continue', 'the first control, as on a fresh page - not the one nearest where Begin was');
});

test('PAD-DOOR: main.js attaches it around the front door and stops it when a game is chosen; no page, no loop', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /const \{ attachMenuPad \} = await import\('\.\/ui\/menuPad\.js'\);\s*\n\s*const detachMenuPad = attachMenuPad\(\);/);
  assert.match(main, /choice = await runCinematicFrontDoor\([\s\S]{0,900}?\}\)\.finally\(detachMenuPad\);/,
    'the door\'s pad stops with the choice, before the scene\'s pad starts');
  assert.equal(typeof attachMenuPad({ doc: null }), 'function', 'without a page it answers a no-op detach');
});

test('PAD-SETTINGS: the four gamepad settings are numbers with steppers, over their consumer\'s own clamps', () => {
  const pads = readFileSync(new URL('../src/systems/gamepad.js', import.meta.url), 'utf8');
  for (const [key, fmt, shown] of [
    ['Controls/JoystickLookSensitivity', 'mult', 'x1.0'],
    ['Controls/JoystickCursorSensitivity', 'mult', 'x1.0'],
    ['Controls/JoystickMovementThreshold', 'pct', '90%'],
    ['Controls/JoystickDeadzone', 'pct', '10%'],
  ]) {
    assert.equal(widgetFor(key), 'number', `${key} is a control, not a readout`);
    const law = NUMBER_LAW[key];
    assert.equal(law.format, fmt);
    const m = pads.match(new RegExp(`getFloat\\('Controls', '${key.split('/')[1]}', ([\\d.]+), ([\\d.]+)\\)`));
    assert.ok(m, `${key}: the consumer's clamp`);
    assert.deepEqual([law.min, law.max], [Number(m[1]), Number(m[2])], `${key}: range equals clamp`);
    assert.equal(formatValue(key, fmt === 'mult' ? '1.0' : key.endsWith('Deadzone') ? '0.1' : '0.9'), shown);
    assert.ok(stepValue(key, String(law.min), +1, false) !== null, `${key}: the stepper steps`);
  }
});
