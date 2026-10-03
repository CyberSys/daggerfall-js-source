// AUDIT REST III (2026-10-03, Mac: "Audit this and ensure its perfection" - bible/06-Systems/Rest-Arc.md "AUDIT REST
// III"): six fresh lenses over every AUDIT REST II fix, each finding verified before it was fixed. The fixes a file of
// their own pins (the dungeon fires' E1 rides test/auditrest2_fires.test.js's harness, the H8 draw its own test) are
// RUN here where they can be: the hosts' own statements sliced out of the source and mounted over stubs
// (test/restsync.test.js's harness), the systems called.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { setSharedClock } from '../src/systems/worldTick.js';
import { _resetForTests } from '../src/systems/uiPrefs.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
afterEach(() => { setSharedClock(null); _resetForTests(); });

// ---- the hosts' own statements, mounted ----
const parsed = new Map();
function nodeOf(file, pred) {
  if (!parsed.has(file)) { const src = rd(file); parsed.set(file, { src, ast: acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' }) }); }
  const { src, ast } = parsed.get(file);
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(ast);
  assert.ok(hit, `${file} has the node`);
  return src.slice(hit.start, hit.end);
}
const fnOf = (file, name) => nodeOf(file, (x) => x.type === 'FunctionDeclaration' && x.id?.name === name);
const methodOf = (file, name) => nodeOf(file, (x) => x.type === 'Property' && x.method && x.key?.name === name);
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));

test('AUDIT REST III A1: the same dungeon\'s own load (F9, the pause\'s Load underground) stands the save\'s camps outside, after the character - as the world host\'s dungeon load does; a save from another place is the world host\'s, which stands them itself (mutants: the dungeon\'s load never asks; the mode machine never forwards; the host never answers)', () => {
  const order = [];
  const extras = { world: { outerCamps: [] }, locationKey: 'dungeon:7' };
  const state = {
    opts: {
      dungeonOnline: () => false, loadRebuilds: () => false, worldLoad: (k) => order.push(['worldLoad', k]),
      modStartLoad() {}, onStartLoad() {}, modSaveLoad() {}, horseCartLoad() {}, modLoaded: () => order.push('modLoaded'),
      outerCampsLoad: (x) => order.push(['outerCampsLoad', x]),
    },
    loadSlot: () => state.snap, quickLoadSlot: () => state.snap, snap: { locationKey: 'dungeon:7' },
    playerEntity: { name: 'Mara' }, hudText: { add: (l) => order.push(l) }, _locationKey: 'dungeon:7',
    restorePlayer: () => extras, spellsByIndex: null, Promise,
  };
  const quickLoad = mount(`return ({ ${methodOf('src/scenes/dungeonContext.js', 'quickLoad')} }).quickLoad;`, state);
  quickLoad.call({ restoreSaved: () => order.push('restored') }, null);
  assert.deepEqual(order, ['restored', ['outerCampsLoad', extras], 'modLoaded'], 'the character first, then the save\'s camps outside, then OnLoad');
  // a save from another dungeon: handed up whole - the world host's load stands them (world.js standOuterCamps)
  order.length = 0; state.snap = { locationKey: 'dungeon:9' };
  quickLoad.call({ restoreSaved: () => order.push('restored') }, 'slot');
  assert.deepEqual(order, []);
  // the seam, through the mode machine to the world host's one home
  assert.match(rd('src/scenes/worldModes.js'), /outerCampsLoad: \(extras\) => host\.outerCampsLoad\?\.\(extras\),/);
  assert.match(rd('src/scenes/world.js'), /outerCampsLoad: \(extras\) => standSavedOuterCamps\(extras\),/);
});

test('AUDIT REST III A1: the world host\'s one home stands the save\'s camps outside - the page\'s own dropped first, each re-stood on today\'s ground when the save\'s terrain scale differs; a save from before carries none and what stands, stands', () => {
  const calls = [];
  const state = {
    camps: { dropOwn: () => calls.push('drop'), restore: (rows, from) => calls.push(['restore', rows, from]) },
    scaleOf: (s) => (s > 0 ? s : 1), STREAMING_TERRAIN_SCALE: 2, state: { localFromWorld: (x, z) => [x / 10, z / 10] },
    restandHeight: (y, x, z, was) => `y${y}@${x},${z}/${was}`, campFromNatives: 'fromNatives',
  };
  const stand = mount(`${fnOf('src/scenes/world.js', 'standSavedOuterCamps')}\nreturn standSavedOuterCamps;`, state);
  stand({ world: {} });
  stand(undefined);
  assert.deepEqual(calls, [], 'a save from before AUDIT REST II H6 carries none: nothing dropped');
  const row = { id: 'me:1:1', pos: [100, 5, 200] };
  stand({ world: { outerCamps: [row] }, terrainScale: 2 });
  assert.deepEqual(calls, ['drop', ['restore', [row], 'fromNatives']], 'the same ground: the save\'s rows as they are');
  calls.length = 0;
  stand({ world: { outerCamps: [row] }, terrainScale: 1 });
  assert.deepEqual(calls[1][1], [{ id: 'me:1:1', pos: [100, 'y5@10,20/1', 200] }], 'another ground: re-stood');
});
