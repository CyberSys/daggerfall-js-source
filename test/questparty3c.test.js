// QUEST-PARTY phase 3c (2026-09-26, Mac: "Dungeons and buildings"). A quest foe past a dungeon's layout run was every
// client's private object - in no frame (the ONLINE-DUNGEON-FOES flag's NOT SYNCED) and blind to every peer (its NOT
// REACTIVE) - so two party members on one dungeon quest each fought their own copy of the vampire, and neither could
// strike the other's. A quest the party SHARES now streams its foes on the room's own lane (OWN1) to the party alone,
// whoever hosts the room: the foe is its spawner's, a party member stands it as a puppet through the layout's own record
// door, strikes it through its owner, counts on its own copy what it sees, takes it over when its owner goes, and a
// marker's foe stands once for the party. Mounted, not matched: the statements are sliced out of the context's source
// (test/restsync.test.js's harness) and run; the hosts' wiring by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { validFoeRecord, FOE_HEALTH_MAX, FOE_LEVEL_MAX, CELL_FRAME_RECORDS_MAX } from '../src/net/wire.js';
import { validQuestTags, questMarkerYields, QUEST_PUPPETS_MAX } from '../src/scenes/exteriorFoes.js';

const D = readFileSync(new URL('../src/scenes/dungeonContext.js', import.meta.url), 'utf8');
const WM = readFileSync(new URL('../src/scenes/worldModes.js', import.meta.url), 'utf8');
const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const AST = acorn.parse(D, { ecmaVersion: 'latest', sourceType: 'module' });

function find(pred) {
  let hit = null;
  (function walk(n) {
    if (!n || typeof n.type !== 'string' || hit) return;
    if (pred(n)) { hit = n; return; }
    for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
  })(AST);
  return hit;
}
const fnSrc = (name) => {
  const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name);
  assert.ok(n, `src has function ${name}`);
  return D.slice(n.start, n.end);
};
const declSrc = (name) => {
  const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name));
  assert.ok(n, `src declares ${name}`);
  return D.slice(n.start, n.end);
};
const scoped = (state) => new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
});
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(scoped(state));
const tick = () => new Promise((r) => setTimeout(r, 0));

const QUEST = 'M0B00Y16';
/** A dungeon foe as the pool holds it, as far as these doors read it. */
const foe = (over = {}) => ({
  mobileType: 5, gender: 'male', dead: false, corpse: false, batch: { b: 1 },
  ai: { feet: [0, 0, 0], yaw: 0, moving: false, target: null, height: 1.8, resumeLive() { this.resumed = true; } },
  entity: { health: 30, maxHealth: 30, items: [] },
  ...over,
});
const questFoe = (symbol = '_vampire_', over = {}) => foe({ questBehaviour: { questUID: 7, targetSymbol: { name: symbol } }, ...over });
const PARTY = new Set(['aaa-0001', 'mmm-0002', 'zzz-0009']);

/** One player's dungeon: its layout run, its own foes past it, and the own lane's doors over stubs. */
function side(self, { layout = [], own = [] } = {}) {
  const foes = [...layout, ...own];
  const built = [], bound = [], credit = { hurt: [], died: [] }, landed = [], removed = [];
  const share = {
    tagOf: (f) => (f.questBehaviour?.targetSymbol?.name && !f.questBehaviour.private ? { q: QUEST, s: f.questBehaviour.targetSymbol.name } : null),
    accepts: (from) => PARTY.has(self) && PARTY.has(from),
    peerMayHit: (peerId) => PARTY.has(peerId),
    onPuppetHurt: (tag) => credit.hurt.push(tag.s), onPuppetDied: (tag) => credit.died.push(tag.s),
    behaviourFor: (tag) => { const b = { questUID: 7, targetSymbol: { name: tag.s } }; bound.push(b); return b; },
    adoptsOrphan: () => false,
  };
  const state = {
    opts: { selfId: () => self, questShare: () => share },
    _layoutFoes: layout.length, foes, _authority: true, _encId: undefined, _ctxDead: false, _locationKey: 'dungeon:7',
    _ownSeq: 0, _ownFrameSeq: 0, _ownGen: 0, _ownPups: new Map(), _ownPending: new Map(), _ownOwners: new Map(),
    FOE_HEALTH_MAX, FOE_LEVEL_MAX, CELL_FRAME_RECORDS_MAX, QUEST_PUPPETS_MAX, HIT_DMG_MAX: 10000,
    validFoeRecord, validQuestTags, questMarkerYields, GENDER_BIT: ['male', 'female'],
    _sharedFoe: () => false, fightN: () => 1, canStandFoe: () => true,
    applyFoeRecord: (f, r) => { if (r.f) f.ai.feet = [...r.f]; if (Number.isFinite(r.h)) f.entity.health = r.h; if (r.d === 1) f.dead = true; f._pup = { feet: [...(r.f ?? f.ai.feet)], yaw: r.y ?? 0 }; },
    buildFoeAt: async (e) => { const f = foe({ mobileType: e.mobileType, gender: e.gender, ai: { feet: [e.x, e.y, e.z], yaw: 0, resumeLive() { this.resumed = true; } } }); built.push(f); foes.push(f); return f; },
    renderer: { destroyBillboardBatch: () => {} }, freeCorpse: (f) => { f.corpse = false; }, dropCandidate: () => {},
    bindQuestFoeHost: (f, b) => { f.questBehaviour = b; },
    questPoolOps: { removeFoe: (f) => { f.dead = true; removed.push(f); } },
    landPeerBlow: (f, id, data, dmg) => { landed.push([f, id, dmg]); return true; },
    console: { info() {}, warn() {}, error: (...a) => assert.fail(a.join(' ')) },
  };
  const api = mount(`
    const q2 = (v) => Math.round(v * 100) / 100;
    const q3 = (v) => Math.round(v * 1000) / 1000;
    ${declSrc('isRoomFoe')}
    ${declSrc('ownPupKey')}
    ${declSrc('ownShare')}
    ${declSrc('ownQuestTag')}
    ${declSrc('questTouched')}
    ${declSrc('ownHeirIsMe')}
    ${fnSrc('roomRecord')}
    ${fnSrc('ownFrame')}
    ${fnSrc('applyOwnFrame')}
    ${fnSrc('ownPuppetsOf')}
    ${fnSrc('standOwnPuppet')}
    ${fnSrc('applyOwnRecord')}
    ${fnSrc('dropOwnPuppet')}
    ${fnSrc('clearOwnPuppets')}
    ${fnSrc('pruneOwnOwners')}
    ${fnSrc('adoptOwn')}
    ${fnSrc('ownHandOverFrame')}
    ${fnSrc('dropOwnHanded')}
    ${fnSrc('standDownMarkerCopies')}
    ${fnSrc('applyOwnHit')}
    ${fnSrc('lootableBody')}
    return { ownFrame, applyOwnFrame, applyOwnHit, pruneOwnOwners, clearOwnPuppets, ownHandOverFrame, dropOwnHanded, lootableBody };
  `, state);
  return { ...api, state, foes, built, bound, credit, landed, removed, share };
}

test('QUEST-PARTY 3c: my shared quest\'s foes past the layout ride the own lane with their words - never the layout\'s, never a private quest\'s; a marker\'s flagged 1, touched 3; a quiet dungeon says nothing between full frames', () => {
  const vamp = questFoe('_vampire_', { _questMarker: true, ai: { feet: [4, 0, 6], yaw: 1, moving: false, target: null } });
  const wave = questFoe('_thrall_');
  const secret = questFoe('_spy_'); secret.questBehaviour.private = true;
  const layoutQuest = questFoe('_layout_');
  const me = side('aaa-0001', { layout: [layoutQuest], own: [vamp, wave, secret] });
  const full = me.ownFrame(true);
  assert.equal(full.k, 'dungeon:7', 'keyed to this dungeon');
  assert.equal(full.full, 1);
  assert.deepEqual(full.f.map((r) => r.i), [vamp._ownSeq, wave._ownSeq], 'my shared quest\'s two - not the layout\'s run, not a private quest\'s');
  assert.deepEqual(full.qf, [[vamp._ownSeq, QUEST, '_vampire_', 1], [wave._ownSeq, QUEST, '_thrall_']]);
  assert.deepEqual([full.f[0].t, full.f[0].f, full.f[0].g], [5, [4, 0, 6], '.'], 'the layout\'s own record - its target \'.\' the owner');
  assert.equal(me.ownFrame(false), null, 'quiet');
  vamp.entity.health = 12;
  const hurt = me.ownFrame(false);
  assert.deepEqual(hurt.qf, [[vamp._ownSeq, QUEST, '_vampire_', 3]], 'touched');
  assert.equal(hurt.full, 0);
  const empty = side('aaa-0001').ownFrame(true);
  assert.deepEqual([empty.f, empty.full, empty.qf], [[], 1, undefined], 'a full frame goes with nothing in it - the readers take down what it no longer lists');
});

test('QUEST-PARTY 3c: a party member stands my shared quest\'s foes as puppets and follows them; a stranger stands none; another dungeon\'s or an older frame is not the world; a full frame takes down what it no longer lists', async () => {
  const vamp = questFoe('_vampire_', { ai: { feet: [4, 0, 6], yaw: 1, moving: false, target: null } });
  const owner = side('aaa-0001', { own: [vamp] });
  const frame = owner.ownFrame(true);
  const amy = side('mmm-0002');
  assert.equal(amy.applyOwnFrame('aaa-0001', frame), true);
  await tick();
  assert.equal(amy.built.length, 1, 'a puppet stood from its first record');
  const pup = amy.state._ownPups.get(`aaa-0001:${vamp._ownSeq}`);
  assert.ok(pup && amy.foes.includes(pup), 'in the member\'s pool, by the owner and its number');
  assert.deepEqual([pup._ownFrom, pup._ownI, pup._pupQuest.s], ['aaa-0001', vamp._ownSeq, '_vampire_']);
  assert.deepEqual(pup.ai.feet, [4, 0, 6]);
  assert.equal(amy.lootableBody({ ...pup, dead: true, corpse: true }), false, 'its body is its owner\'s - a quest\'s loot stays its host\'s');
  assert.equal(amy.lootableBody({ dead: true, corpse: true }), true);
  vamp.ai.feet = [5, 0, 7];
  amy.applyOwnFrame('aaa-0001', owner.ownFrame(false));
  assert.deepEqual(pup.ai.feet, [5, 0, 7], 'the owner\'s foe moves, the puppet follows');
  assert.equal(amy.applyOwnFrame('aaa-0001', { ...owner.ownFrame(true), n: 1 }), false, 'an older frame is stale');
  assert.equal(amy.applyOwnFrame('aaa-0001', { ...owner.ownFrame(true), k: 'dungeon:8' }), false, 'another dungeon\'s is not the world');
  const bob = side('bob-0005');
  bob.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  await tick();
  assert.equal(bob.built.length, 0, 'a stranger never sees the party\'s quest');
  vamp.dead = true;   // Destroy()ed - no body
  amy.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  assert.equal(amy.state._ownPups.size, 0, 'a full frame that no longer lists it takes it down');
  assert.ok(!amy.foes.includes(pup), 'out of the pool');
});

test('QUEST-PARTY 3c: my copy counts what it sees on a party member\'s quest foe - the first blow the injury, once; the fall the kill', async () => {
  const vamp = questFoe('_vampire_');
  const owner = side('aaa-0001', { own: [vamp] });
  const amy = side('mmm-0002');
  amy.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  await tick();
  vamp.entity.health = 20; amy.applyOwnFrame('aaa-0001', owner.ownFrame(false));
  vamp.entity.health = 10; amy.applyOwnFrame('aaa-0001', owner.ownFrame(false));
  assert.deepEqual(amy.credit.hurt, ['_vampire_'], 'the injury once');
  vamp.dead = true; vamp.corpse = true; vamp.entity.health = 0;
  amy.applyOwnFrame('aaa-0001', owner.ownFrame(false));
  assert.deepEqual(amy.credit.died, ['_vampire_'], 'and the kill');
});

test('QUEST-PARTY 3c: a party member\'s blow on my shared quest foe lands through the peer\'s door, whoever hosts; a stranger\'s, a private quest\'s, another dungeon\'s and an unbounded one do not', () => {
  const vamp = questFoe('_vampire_');
  const secret = questFoe('_spy_'); secret.questBehaviour.private = true;
  const me = side('aaa-0001', { own: [vamp, secret] });
  me.state._authority = false;   // another hosts the room - my quest foe is still mine
  me.ownFrame(true);
  secret._ownSeq = 99;
  assert.equal(me.applyOwnHit('mmm-0002', { own: 1, to: 'aaa-0001', k: 'dungeon:7', i: vamp._ownSeq, dmg: 7, kind: 'melee' }), true);
  assert.deepEqual(me.landed.map(([f, id, d]) => [f === vamp, id, d]), [[true, 'mmm-0002', 7]], 'a party member\'s blow lands');
  assert.equal(me.applyOwnHit('bob-0005', { own: 1, i: vamp._ownSeq, dmg: 7 }), false, 'a stranger\'s does not');
  assert.equal(me.applyOwnHit('mmm-0002', { own: 1, i: 99, dmg: 7 }), false, 'nor on a private quest\'s foe');
  assert.equal(me.applyOwnHit('mmm-0002', { own: 1, k: 'dungeon:8', i: vamp._ownSeq, dmg: 7 }), false, 'nor keyed to another dungeon');
  assert.equal(me.applyOwnHit('mmm-0002', { own: 1, i: vamp._ownSeq, dmg: 1e9 }), false, 'nor unbounded');
  assert.equal(me.applyOwnHit('mmm-0002', { own: 1, i: vamp._ownSeq + 50, dmg: 7 }), false, 'nor a number I never gave');
  assert.equal(me.landed.length, 1);
});

test('QUEST-PARTY 3c: a departing owner names a party heir - the heir takes it bound to its own copy and its motor resumes; the owner lets it go; an owner gone without a word leaves it to the one the law names, else it goes', async () => {
  const vamp = questFoe('_vampire_');
  const owner = side('aaa-0001', { own: [vamp] });
  const amy = side('mmm-0002');
  amy.applyOwnFrame('aaa-0001', owner.ownFrame(true));
  await tick();
  const pup = amy.state._ownPups.get(`aaa-0001:${vamp._ownSeq}`);
  const handed = owner.ownHandOverFrame(() => 'mmm-0002');
  assert.equal(handed.f[0].e, 'mmm-0002', 'the heir named on the frame');
  amy.applyOwnFrame('aaa-0001', handed);
  assert.equal(pup._ownFrom, null, 'the heir took it');
  assert.equal(amy.state._ownPups.size, 0);
  assert.equal(amy.bound.length, 1, 'bound to the heir\'s own copy of the quest');
  assert.equal(pup.questBehaviour, amy.bound[0]);
  assert.equal(pup.ai.resumed, true, 'its motor resumes from the pose');
  assert.equal(amy.ownFrame(true).qf?.[0]?.[2], '_vampire_', 'and it rides to the party as the heir\'s');
  assert.equal(owner.dropOwnHanded(), 1, 'the owner lets it go');
  assert.ok(!owner.foes.includes(vamp));
  // an owner gone without a handover
  const v2 = questFoe('_vampire_');
  const o2 = side('aaa-0001', { own: [v2] });
  const cat = side('zzz-0009');
  cat.applyOwnFrame('aaa-0001', o2.ownFrame(true));
  await tick();
  const p2 = cat.state._ownPups.get(`aaa-0001:${v2._ownSeq}`);
  cat.share.adoptsOrphan = () => true;
  cat.pruneOwnOwners(new Set(), 0, 0);
  assert.equal(p2._ownFrom, null, 'the one the law names takes the orphan');
  const dog = side('mmm-0002');
  dog.applyOwnFrame('aaa-0001', o2.ownFrame(true));
  await tick();
  dog.pruneOwnOwners(new Set(['aaa-0001']), 0, 0);
  assert.equal(dog.state._ownPups.size, 1, 'an owner still in the room keeps its foes');
  dog.pruneOwnOwners(new Set(), 0, 0);
  assert.equal(dog.state._ownPups.size, 0, 'another member lets them go');
  const eel = side('mmm-0002');
  eel.applyOwnFrame('aaa-0001', o2.ownFrame(true));
  await tick();
  eel.state._ownOwners.get('aaa-0001').at = 0;
  eel.pruneOwnOwners(new Set(['aaa-0001']), 10000, 6000);
  assert.equal(eel.state._ownPups.size, 0, 'an owner silent past the stale window goes as one gone');
});

test('QUEST-PARTY 3c: a marker\'s foe stands once for the party in a dungeon too - the higher id\'s untouched copy stands down; the room clears', async () => {
  const a = side('aaa-0001', { own: [questFoe('_vampire_', { _questMarker: true })] });
  const mine = questFoe('_vampire_', { _questMarker: true });
  const m = side('mmm-0002', { own: [mine] });
  m.applyOwnFrame('aaa-0001', a.ownFrame(true));
  await tick();
  assert.equal(mine.dead, true, 'mine stood down');
  assert.deepEqual(m.removed, [mine], 'as the cull takes one');
  assert.equal(m.state._ownPups.size, 1, 'and the lower id\'s stands here');
  // a party member's marker foe of ANOTHER symbol stands nothing down
  const ghostSide = side('aaa-0001', { own: [questFoe('_ghost_', { _questMarker: true })] });
  const keep = questFoe('_vampire_', { _questMarker: true });
  const k = side('mmm-0002', { own: [keep] });
  k.applyOwnFrame('aaa-0001', ghostSide.ownFrame(true));
  await tick();
  assert.equal(keep.dead, false, 'the ghost is not the vampire');
  m.clearOwnPuppets();
  assert.equal(m.state._ownPups.size, 0, 'a room change takes the lane\'s puppets down');
  assert.equal(m.state._ownOwners.size, 0);
});

test('QUEST-PARTY 3c by source: the blow on a party member\'s quest foe goes to its owner; the loop steps it as a puppet of its owner; my shared quest foe hunts its party; the save holds none of theirs; the marker\'s stand is flagged; the hosts wire the lane', () => {
  assert.match(D, /if \(foe\._ownFrom != null\) \{\n\s*if \(fromPlayer && damage >= 0\) \{[\s\S]*?opts\.onFoeHit\?\.\(\{ own: 1, to: foe\._ownFrom, k: _locationKey, i: foe\._ownI, dmg: damage, kind,[\s\S]*?\}\s*return;\n\s*\}\n\s*if \(!_authority\) \{/, 'the owner\'s to apply, before the host\'s divert');
  assert.match(D, /const _puppet = \(!_authority && _roomFoe\) \|\| f\._ownFrom != null;/);
  assert.match(D, /f\._pupTarget = p\.target === '\.' \? \(f\._ownFrom \?\? _foesFrom\) : \(p\.target \|\| null\);/);
  assert.match(D, /candidates: foeDeps \? \(streamed = false, rec = null\) => \[\.\.\.foes\.filter\(\(f\) => !f\.dead && f\.ai\), \.\.\.\(_authority && streamed \? peerCandidates\(\) : \(ownQuestTag\(rec\) \? peerCandidates\(\)\.filter\(\(c\) => ownShare\(\)\?\.peerMayHit\?\.\(c\.id, rec\)\) : \[\]\)\)\] : null,/, 'the party alone');
  assert.match(D, /foeDeps\.runTargetMachine\(rec, sn\.candidates\(streamed, rec\), pf, cdt, \{/);
  assert.match(D, /foes: foes\.filter\(\(f\) => f\._ownFrom == null\)\.map\(\(f\) => \(\{/, 'the save holds none of theirs');
  assert.match(D, /if \(truncate\) clearOwnPuppets\(\);/, 'and a load takes them down first, so its indices are this pool\'s');
  assert.match(D, /if \(\(!_authority && isRoomFoe\(f, pi\)\) \|\| f\._ownFrom != null\) \{ f\._divertPt = pt; return null; \}/, 'the dose rides the blow to the owner');
  assert.match(D, /if \(marker\) f\._questMarker = true;/);
  assert.match(WM, /position: \[position\.x, position\.y, position\.z\], behaviour,\n\s*marker: true,/, 'the dungeon marker\'s stand is flagged');
  assert.match(WM, /questShare: \(\) => host\.foesQuestShare\?\.\(\) \?\? null,/, 'the party\'s law into the dungeon');
  assert.match(WM, /ownFoesFrame\(full = false\) \{ return mode === 'interior' && interiorFoes \? interiorFoes\.foesFrame\(full\) : mode === 'dungeon' && dungeonCtx \? \(dungeonCtx\.ownFrame\?\.\(full\) \?\? null\) : null; \},/);
  assert.match(WM, /applyOwnFoes\(id, data\) \{ return mode === 'interior' && interiorFoes \? interiorFoes\.applyFoes\(id, data\) : mode === 'dungeon' && dungeonCtx \? !!dungeonCtx\.applyOwnFrame\?\.\(id, data\) : false; \},/);
  assert.match(WM, /applyOwnHit\(id, data\) \{ return mode === 'interior' && interiorFoes \? interiorFoes\.applyHit\(id, data\) : mode === 'dungeon' && dungeonCtx \? !!dungeonCtx\.applyOwnHit\?\.\(id, data\) : false; \},/);
  assert.match(WM, /clearOwnPuppets\(\) \{ interiorFoes\?\.clearPuppets\(\); dungeonCtx\?\.clearOwnPuppets\?\.\(\); \},/);
  assert.match(W, /const m = modes\?\.mode \?\? 'exterior';\n\s*if \(m !== 'interior' && m !== 'dungeon'\) return false;/, 'the own lane streams from a dungeon too');
  assert.match(W, /onDungeonLeave: \(\) => \{ const n = handOverRoomFoes\(\);/, 'the dungeon\'s door hands my shared quest\'s foes to the party who stay');
  assert.match(W, /const near = online\?\.room && isWorldRoom\(online\.room\) && online\.ownOk && \(m === 'interior' \|\| m === 'dungeon'\) \? \(peersNear\(\) \?\? \[\]\) : \[\];/);
  assert.match(W, /if \(ids\) modes\?\.pruneOwnOwners\?\.\(ids, now, FOES_STALE_MS\); \}/);
});
