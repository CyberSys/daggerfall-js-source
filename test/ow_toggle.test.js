// OW-TOGGLE (2026-09-28, Mac: "bring back the original travel option as a toggle. Off by default." - "Travel Options
// was changed. The normal first person travel accelerated was removed in favor of the overworld travel") - FIRST-PERSON
// TRAVEL, A SWITCH. OW-ONLY made every walked trip on the enhanced interface the Overworld's; the port's own key on
// Travel Options' pane (`GeneralOptions.FirstPersonTravel`, OFF) gives the first-person journey back. On, a pick on the
// map begins Travel Options' own journey on the ground, the map's Resume is the mod's, the view does not rise with a
// journey and coming down does not stop one - Travel Options as it was before OW-ONLY. Off, OW-ONLY exactly.
//
// Pinned here: the key (declared, off, a toggle, the port's own words, on the tile, read into the settings), and the
// world host's doors MOUNTED from their own source over a fake host - tvOwnsJourneys, beginAcceleratedTravel,
// travelViewResume, tvJourneyUp and the view's onLower - both ways.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MOD_SETTINGS, _resetModSettings } from '../src/systems/modSettings.js';
import { MOD_CURATED, modDials } from '../src/systems/features.js';
import { readTravelOptionsSettings } from '../src/systems/travelOptions.js';
import { travelWalkRate, TV_MOVE_ACTIONS } from '../src/scenes/travelView.js';
import { createLoadGovernor, unbuiltAround } from '../src/systems/travelGovernor.js';
import { timeScale, setTimeScale, resetTimeScale, MAX_TIME_SCALE } from '../src/systems/timeScale.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WORLD = read('src/scenes/world.js');
const KEY = 'GeneralOptions.FirstPersonTravel';

test('OW-TOGGLE THE SWITCH: the port\'s own key on Travel Options\' pane - OFF by default, a toggle, saying it is the port\'s, on the tile, read into the settings; the vendored modsettings.json does not carry it', () => {
  const def = MOD_SETTINGS['travel-options'].keys[KEY];
  assert.ok(def, 'declared');
  assert.equal(def.default, false, 'OFF - the Overworld\'s journeys stay the default (Mac: "Off by default")');
  assert.equal(typeof def.default, 'boolean', 'a toggle');
  assert.match(def.description, /first person/);
  assert.match(def.description, /port’s own switch - the mod has none/);
  const shipped = JSON.parse(read('vendor/travel-options/modsettings.json'));
  assert.ok(!shipped.Sections.flatMap((s) => s.Keys.map((k) => `${s.Name}.${k.Name}`)).includes(KEY), 'the author\'s file is untouched');
  assert.ok(MOD_CURATED['travel-options'].includes(KEY) && modDials('travel-options').includes(KEY), 'reachable: on the tile');
  _resetModSettings();
  assert.equal(readTravelOptionsSettings().firstPersonTravel, false, 'the shipped store: off');
  const reader = (on) => (vendor, key) => (vendor === 'travel-options' && key === KEY ? on : MOD_SETTINGS[vendor]?.keys[key]?.default);
  assert.equal(readTravelOptionsSettings(reader(true)).firstPersonTravel, true, 'on is on');
  assert.equal(readTravelOptionsSettings(reader(false)).firstPersonTravel, false, '...and off is off');
});

/** One of world.js's own functions, by name: a one-line declaration, or up to its closing brace at the host's indent. */
function fnSource(name) {
  const at = WORLD.indexOf(`  function ${name}(`);
  assert.ok(at >= 0, `world.js declares ${name}`);
  const eol = WORLD.indexOf('\n', at);
  if (WORLD.slice(at, eol).trimEnd().endsWith('}')) return WORLD.slice(at, eol);
  return WORLD.slice(at, WORLD.indexOf('\n  }\n', at) + 4);
}
/** the view's onLower dep, as the host hands it to createTravelView */
function onLowerSource() {
  const m = WORLD.match(/\n\s*onLower: (\(why\) => \{[^\n]*\}),\n/);
  assert.ok(m, 'the host\'s onLower');
  return m[1];
}

/** The host's journey doors, mounted over a fake host. `firstPerson` is the switch as the world loaded it. */
function rig({ firstPerson = false, enhanced = true } = {}) {
  const calls = [];
  const view = { state: 'off', enter() { calls.push('view up'); view.state = 'up'; } };
  const travelOptions = {
    settings: { firstPersonTravel: firstPerson },
    isTravelActive: false,
    state: { autopilot: null },
    route: null,
    beginTravel: (dest, cautious, est) => { calls.push(['beginTravel', dest.name, cautious, est]); },
    beginTravelToCoords: (pixel, cautious) => { calls.push(['beginTravelToCoords', pixel.x, pixel.y, cautious]); },
    resumeTravel: () => calls.push('resumeTravel'),
    messages: { pauseTravel: () => calls.push('pauseTravel') },
  };
  const env = {
    travelOptions, travelView: view, isEnhanced: () => enhanced,
    travelViewAllowed: () => ({ ok: true }), travelViewCanGo: () => true,
    tvPlaceSummary: (x, y) => ({ pixel: { x, y }, name: 'Daggerfall' }),
    travelViewRouteTo: (s) => { calls.push(['travelViewRouteTo', s.name]); return true; },
    travelViewWalkTo: (at, pixel) => { calls.push(['travelViewWalkTo', pixel.x, pixel.y]); return true; },
    townTalk: { say: (t) => calls.push(['say', t]) },
    mapPixelToWorldCoords: (x, y) => ({ x: x * 32768, z: y * 32768 }), tvSceneOf: (x, z) => [x, 10, z],
    tvWater: () => false, tvSeaY: () => 0, TV_SEA_EPS_M: 0.5, TRAVEL_VIEW_TEXT: { water: 'water' },
    locationIndex: new Map(), locationWorldRect: () => null,
    gamePaused: () => false, modes: { modalWindowUp: () => false }, duelEnemyNear: () => false,
    areEnemiesNearby: () => false, exteriorFoePool: () => [],
  };
  const names = Object.keys(env);
  const body = [fnSource('tvOwnsJourneys'), fnSource('travelViewResume'), fnSource('beginAcceleratedTravel'), fnSource('tvJourneyUp'),
    `const onLower = ${onLowerSource()};`,
    'return { tvOwnsJourneys, travelViewResume, beginAcceleratedTravel, tvJourneyUp, onLower };'].join('\n');
  const host = new Function(...names, body)(...names.map((k) => env[k]));
  return { host, calls, view, travelOptions };
}

const PICK = { pixel: { x: 207, y: 213 }, name: 'Daggerfall', mapId: 1, regionIndex: 17, locationIndex: 3 };

test('OW-TOGGLE host, OFF (the default): OW-ONLY exactly - the map\'s pick is the Overworld\'s journey, the view rises with it, and brought down it stops', () => {
  const { host, calls, view, travelOptions } = rig();
  assert.equal(host.tvOwnsJourneys(), true, 'the Overworld owns the walked trip');
  assert.equal(host.beginAcceleratedTravel(PICK, { speedCautious: false }, { estimateMinutes: 90 }), true);
  assert.deepEqual(calls, [['travelViewRouteTo', 'Daggerfall']], 'a place: by the roads, in the view - never the mod\'s ground journey');
  calls.length = 0;
  travelOptions.isTravelActive = true; travelOptions.state.autopilot = {};
  host.tvJourneyUp();
  assert.deepEqual(calls, ['view up'], 'a walking journey raises the view');
  calls.length = 0;
  host.onLower('button');
  assert.deepEqual(calls, ['pauseTravel'], 'brought down by the player: the journey stops');
  view.state = 'off';
  assert.equal(rig({ enhanced: false }).host.tvOwnsJourneys(), false, 'the classic skin keeps Travel Options exactly');
});

test('OW-TOGGLE host, ON: Travel Options\' own first-person journey - begun on the ground from the map, resumed by the mod, the view left where the player put it, and coming down stops nothing', () => {
  const { host, calls, view, travelOptions } = rig({ firstPerson: true });
  assert.equal(host.tvOwnsJourneys(), false, 'the switch: the Overworld owns no journey');
  assert.equal(host.beginAcceleratedTravel(PICK, { speedCautious: true }, { estimateMinutes: 90 }), true);
  assert.deepEqual(calls, [['beginTravel', 'Daggerfall', true, 90]], 'a place: the mod\'s own journey, cautious as asked, the popup\'s estimate along');
  calls.length = 0;
  assert.equal(host.beginAcceleratedTravel(PICK, { speedCautious: false }, { coords: true }), true);
  assert.deepEqual(calls, [['beginTravelToCoords', 207, 213, false]], 'a spot: the mod\'s own');
  calls.length = 0;
  travelOptions.route = { summary: { name: 'Daggerfall' } };
  host.travelViewResume();
  assert.deepEqual(calls, ['resumeTravel'], 'the map\'s Resume is the mod\'s');
  calls.length = 0;
  travelOptions.isTravelActive = true; travelOptions.state.autopilot = {};
  host.tvJourneyUp();
  assert.equal(view.state, 'off', 'a journey walking: the view is not raised');
  view.state = 'up';
  host.onLower('button'); host.onLower('escape'); host.onLower('key');
  assert.deepEqual(calls, [], 'the view brought down: the journey walks on, on the ground');
});

/** world.js's governor, mounted from its own source (as test/tv_wasd.test.js mounts it): `let tvHeld` through travelViewGovern. */
function mountGovernor(env) {
  const from = WORLD.indexOf('  let tvHeld = null;');
  const fn = WORLD.indexOf('  function travelViewGovern(dt) {', from);
  const end = WORLD.indexOf('\n  }\n', fn) + 4;
  assert.ok(from >= 0 && fn > from && end > fn, 'the governor\'s source');
  const names = Object.keys(env);
  return new Function(...names, `${WORLD.slice(from, end)}\nreturn { govern: travelViewGovern, held: () => tvHeld };`)(...names.map((k) => env[k]));
}

test('OW-TOGGLE host: a first-person journey under a view brought down runs at the speed asked - AUDIT OW4 J5\'s x1 hold is the Overworld\'s journey\'s alone', () => {
  for (const [owns, want] of [[true, 1], [false, 20]]) {
    resetTimeScale();
    setTimeScale(20);   // the journey's own ask, set by the mod's panel
    const g = mountGovernor({
      travelControlUI: { isShowing: true, timeAcceleration: 20, accelerationLimit: () => 100 },
      travelOptions: { state: { autopilot: {} } },
      travelWalkRate, TV_MOVE_ACTIONS,
      travelView: { active: false, state: 'off' },   // brought down
      held: () => false, keys: new Set(), walkMode: true, playerSpawned: true, player: { isPlayerSwimming: false },
      csaBoatUnderMe: () => null, gamePaused: () => false,
      setWorldTimeScale: setTimeScale, worldTimeScale: timeScale, resetTimeScale,
      travelAsked: 20, csaHoldsTimeScale: () => false, travelGovernor: createLoadGovernor({ max: MAX_TIME_SCALE }),
      state: { terrainDistance: 3 }, playerTravelPixel: () => ({ x: 100, y: 200 }), tvGroundGenNow: () => 0,
      unbuiltAround, built: { has: () => true },
      tvOwnsJourneys: () => owns,
    });
    g.govern(1 / 60);
    assert.equal(timeScale(), want, owns ? 'the Overworld\'s journey on the ground: held at x1 until the view rises' : 'First-Person Travel: the journey\'s own x20, on the ground');
    assert.equal(g.held(), owns ? 1 : null, owns ? 'and the panel told it is held' : 'and nothing held');
  }
  resetTimeScale();
});

test('OW-TOGGLE host: the switch is read through the journey\'s own settings - the world\'s, loaded with the mod\'s others (the tile\'s "Takes effect when the world next loads")', () => {
  assert.match(WORLD, /function tvOwnsJourneys\(\) \{ return !!travelOptions && !travelOptions\.settings\?\.firstPersonTravel && isEnhanced\(\) && !!travelView; \}/);
  assert.match(WORLD, /const travelOptionsSettings = readTravelOptionsSettings\(\);/);
  assert.match(WORLD, /\n    settings: travelOptionsSettings,\n/, 'the settings the world loaded are the journey\'s');
});
