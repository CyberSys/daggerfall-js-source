// ENEMY-PACE: the second stepper's wiring and the panel's draw, by source + a tiny DOM-less check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const world = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const panel = readFileSync(new URL('../src/ui/enhancedTravelControl.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/ui/enhancedStyle.js', import.meta.url), 'utf8');

test('enemy pace floors the enemies cap on both paths and is wired to the panel', () => {
  assert.match(world, /foeFloor\(foes\.cap, travelAsked\)/);
  assert.match(world, /foeFloor\(foes\.cap, want\)/);
  assert.match(world, /foeFaster:/); assert.match(world, /foeSlower:/);
  assert.match(world, /foeRate: tvFoeRate/);
  assert.match(world, /accelerationLimit\(\) \|\| MAX_TIME_SCALE, foeLadder\(tvFoeRate, true\)/);   // capped at the general limit
});

test('panel: foe row hidden by default, shown only while enemies hold; Camp stacked above Exit in the dock', () => {
  assert.match(panel, /travelpanel-foe" hidden/);
  assert.match(panel, /foesHold = held != null && state\.heldWhy === 'foes'/);
  assert.ok(panel.indexOf('data-act="camp"') < panel.indexOf('data-act="exit"'));
  assert.match(css, /tview-dock \.travelpanel-acts \{[^}]*flex-direction: column/);
});

test('floor arithmetic', () => {
  const floor = (cap, want, r) => Math.min(want, Math.max(cap, r));
  assert.equal(floor(1, 60, 5), 5);        // enemy inside reach: not walking pace any more
  assert.equal(floor(30, 60, 5), 30);      // eased, not cut
  assert.equal(floor(Infinity, 60, 5), 60);// nothing near: the general speed
  assert.equal(floor(1, 3, 5), 3);         // never above what was asked
});
