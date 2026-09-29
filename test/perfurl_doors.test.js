// PERF-URL (2026-09-29, Mac: "I'm receiving reports after some updates, performance seems to be worse") - THE PAGE'S
// QUERY IS PARSED ONCE A SEARCH, AND NO DOOR PARSES ON ITS OWN.
//
// Counted in the real game (Knightstale in the rain, the world host settled): 84 URLSearchParams minted a frame - 54
// by the online lane's `isOnlinePage` (every getPref and every modSetting asks it), 24 by the skin's `skinOverride`,
// the rest by the kill doors read in the frame. systems/pageQuery.js is the one home now; these pins hold it by COUNT
// (the doctrine's own - never a wall clock) and sweep src/ so the next door cannot mint its own again, which is how
// PERF-SUN's single-file fix of the same waste (windDrive.js swayDisabled, 2026-09-19) was undone door by door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { codeOnly } from './codeOnly.mjs';
import { pageParam, pageHas } from '../src/systems/pageQuery.js';
import { isOnlinePage, onlineForcedPref } from '../src/systems/onlineLane.js';
import { skinOverride, uiSkin, isEnhanced } from '../src/systems/uiSkin.js';
import { airOn, contactOn } from '../src/render/airPass.js';
import { shadowCacheOn } from '../src/render/shadowPass.js';
import { exposureFor, EL_EXPOSURE } from '../src/render/enhancedLighting.js';
import { motionEnabled } from '../src/ui/windowMotion.js';

const ROOT = new URL('..', import.meta.url).pathname;

/** Count every URLSearchParams minted while `fn` runs. */
function minted(fn) {
  const Real = globalThis.URLSearchParams;
  let n = 0;
  globalThis.URLSearchParams = class extends Real { constructor(...a) { super(...a); n++; } };
  try { fn(); } finally { globalThis.URLSearchParams = Real; }
  return n;
}

test('PERF-URL: one parse a search - a thousand reads of the same search mint one URLSearchParams, a new search one more', () => {
  const n = minted(() => {
    for (let i = 0; i < 1000; i++) {
      assert.equal(pageParam('skin', '?perfurl-a&skin=classic'), 'classic');
      assert.equal(pageHas('perfurl-a', '?perfurl-a&skin=classic'), true);
    }
  });
  assert.equal(n, 1, 'the same search is parsed once, whatever is read off it');
  assert.equal(minted(() => { pageParam('skin', '?perfurl-b'); pageParam('skin', '?perfurl-b'); }), 1, 'a different search is parsed once more');
});

test('PERF-URL: the frame’s doors read through it - the online lane, the skin, the air, the shadow cache - one parse between them', () => {
  const search = '?perfurl-c&online=1&skin=classic&air=off';
  const n = minted(() => {
    for (let i = 0; i < 100; i++) {
      assert.equal(isOnlinePage(search), true);
      assert.equal(skinOverride(search), 'classic');
      assert.equal(uiSkin(search), 'classic');
      assert.equal(isEnhanced(search), false);
      assert.equal(airOn(search), false);
      assert.equal(contactOn(search), true);
      assert.equal(shadowCacheOn(search), true);
      assert.equal(onlineForcedPref('perfurl-not-a-forced-key', search), undefined);
    }
  });
  assert.equal(n, 1, 'eight doors a hundred times each, off one search: one parse');
});

test('PERF-URL: keyed on the search it READS, so the boot’s published URL is the answer the moment it lands (MAC-N3)', () => {
  // publishBootParams rewrites location.search once, before the world boots - a latch read before it would answer
  // the menu's URL for the whole session, the very bug MAC-N3 fixed. The memo is keyed on the string, never latched.
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  const loc = { search: '' };
  Object.defineProperty(globalThis, 'location', { value: loc, configurable: true, writable: true });
  try {
    assert.equal(isOnlinePage(), false, 'the menu: not online');
    assert.equal(skinOverride(), null);
    loc.search = '?world&online&skin=classic';   // the boot publishes what it decided
    assert.equal(isOnlinePage(), true, 'the published URL is read at once');
    assert.equal(skinOverride(), 'classic');
    loc.search = '?world';
    assert.equal(isOnlinePage(), false, 'and a URL without it is not online');
    assert.equal(skinOverride(), null);
    assert.equal(exposureFor(), EL_EXPOSURE, 'no door: the default');
    loc.search = '?exposure=1.5';
    assert.equal(exposureFor(), 1.5);
    assert.equal(motionEnabled({ location: { search: '?motion' }, navigator: { webdriver: true } }), true, 'a window’s own search is read, not the page’s');
    assert.equal(motionEnabled({ location: { search: '?nomotion' }, navigator: {} }), false);
  } finally {
    if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location;
  }
});

/** Every .js under src/, outside the lab pages (src/tools/ - pages of their own, outside the game). */
function sourceFiles(dir = join(ROOT, 'src'), out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'tools') sourceFiles(p, out); } else if (name.endsWith('.js')) out.push(p);
  }
  return out;
}

test('PERF-URL: no door parses the query on its own - src/ mints URLSearchParams only where it must, each for a reason', () => {
  // The sites that may, and why. A LATCH reads once a page (the URL does not change after the boot's publish, which
  // runs before any of them is asked); the rest build or edit a query rather than read one.
  const ALLOWED = [
    ['src/systems/pageQuery.js', /_params = new URLSearchParams\(search\);/, 'the one home'],
    ['src/main.js', /const params = new URLSearchParams\(location\.search\);/, 'the boot’s own params, which it edits and publishes'],
    ['src/systems/realmSaves.js', /const p = new URLSearchParams\(search\);/, 'realmBootSearch BUILDS a search (deletes and sets)'],
    ['src/systems/windDrive.js', /_swayOff = new URLSearchParams\(search\)\.get\('sway'\) === 'off';/, 'PERF-SUN’s own search-keyed memo, pinned by test/perfsun_fragment.test.js'],
    ['src/systems/renderScale.js', /if \(_door === undefined\) _door = renderScaleOf\(new URLSearchParams\(/, 'a latch, once a page'],
    ['src/systems/weatherSim.js', /UrlDoor \?\?= new URLSearchParams\(/, 'four latches, once a page'],
  ];
  const offenders = [];
  let allowed = 0;
  for (const file of sourceFiles()) {
    const rel = file.slice(ROOT.length);
    const code = codeOnly(readFileSync(file, 'utf8'));
    for (const line of code.split('\n')) {
      if (!line.includes('new URLSearchParams(')) continue;
      const ok = ALLOWED.find(([f, re]) => f === rel && re.test(line));
      if (ok) allowed++; else offenders.push(`${rel}: ${line.trim().slice(0, 140)}`);
    }
  }
  assert.deepEqual(offenders, [], 'a door that parses on its own - read it through systems/pageQuery.js (pageParam / pageHas)');
  assert.equal(allowed, 9, 'the allowed sites are all still there - one each, and weatherSim’s four (a stale allowance is a hole in the sweep)');
});
