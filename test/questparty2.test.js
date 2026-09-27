// QUEST-PARTY phase 2 (2026-09-26, Mac: "Party shares them" - "then passing enemies to another member if that player
// leaves"). Phase 1 kept a shared quest's foes with their host: a host that died or walked out of the open country took
// them with it (they were never an heir's), and one whose connection dropped left them to vanish at every member - and
// a member's copy, whose waves had counted as placed while the host stood them, was left with a quest it could not
// finish. Now the dying or departing host names a party member heir (never a stranger), an owner gone without a word
// leaves its quest's foes to the one party member the law names (the lowest id near the foe), and either way the foe is
// bound to the new owner's own copy of the quest. Driven over the helpers and real encounter pools, and the world host
// by source.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adoptsOrphanQuestFoe, questBehaviourFor, QUEST_SHARE_RADIUS } from '../src/scenes/questFoeHost.js';
import { createExteriorFoes } from '../src/scenes/exteriorFoes.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('QUEST-PARTY 2: an orphan goes to the lowest id near it - me only if I stand near it and no nearer party member ranks below me', () => {
  const foe = [0, 0, 0];
  const base = { myId: 'mmm-0002', myFeet: [10, 0, 0], foeFeet: foe };
  assert.equal(adoptsOrphanQuestFoe({ ...base, partyPeers: [] }), true, 'the only one near');
  assert.equal(adoptsOrphanQuestFoe({ ...base, partyPeers: [{ id: 'aaa-0001', feet: [20, 0, 0] }] }), false, 'a lower id near it takes it');
  assert.equal(adoptsOrphanQuestFoe({ ...base, partyPeers: [{ id: 'zzz-0009', feet: [5, 0, 0] }] }), true, 'a higher id defers to me');
  assert.equal(adoptsOrphanQuestFoe({ ...base, partyPeers: [{ id: 'aaa-0001', feet: [QUEST_SHARE_RADIUS + 50, 0, 0] }] }), true, 'a lower id out of reach does not count');
  assert.equal(adoptsOrphanQuestFoe({ ...base, myFeet: [QUEST_SHARE_RADIUS + 50, 0, 0], partyPeers: [] }), false, 'not when I am out of reach of it');
  assert.equal(adoptsOrphanQuestFoe({ ...base, myId: null, partyPeers: [] }), false, 'offline, no one');
});

test('QUEST-PARTY 2: a foe taken over is bound to the taker\'s own Foe - a behaviour over it, or nothing for a quest it does not share', () => {
  const pirate = { isFoe: true, symbol: { name: '_pirate_' }, parentQuest: { uid: 7 } };
  const machine = { hasSharedQuestNamed: (n) => n === 'WAQ_SHIP_SMALLRAID', sharedCandidateNamed: () => ({ resources: new Map([['_pirate_', pirate]]) }) };
  const b = questBehaviourFor(machine, { q: 'WAQ_SHIP_SMALLRAID', s: '_pirate_' });
  assert.ok(b, 'a behaviour');
  assert.equal(b.questUID, 7, 'over the taker\'s own quest');
  assert.equal(b.targetSymbol, pirate.symbol, 'and its own Foe');
  assert.equal(questBehaviourFor(machine, { q: 'OTHER', s: '_pirate_' }), null, 'a quest the taker does not share binds nothing');
});

// the WORLD6b-ii rig
function craftCfg({ hpPerLevel = 40, speed = 90, str = 40, agi = 85, luck = 55, atkFlags = 0x08 } = {}) {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = atkFlags; v.setUint16(52, hpPerLevel, true);
  const attrs = [str, 50, 50, agi, 50, 50, speed, luck];
  for (let i = 0; i < 8; i++) v.setUint16(58 + i * 2, attrs[i], true);
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const dataLen = records.reduce((a, [, b]) => a + b.length, 0);
  const out = new Uint8Array(4 + dataLen + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const bsa = craftMonsterBsa([['ENEMY000.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const settle = async () => { for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0)); };
const playerEntity = () => ({ level: 1, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: { strength: 50, agility: 50, luck: 50, speed: 50, endurance: 50 }, armorValues: new Array(7).fill(60) });
const PARTY = new Set(['host-0001', 'amy-0003', 'cat-0004']);
const fakeBehaviour = () => ({ questUID: 7, targetSymbol: { name: '_pirate_' }, bound: null, started: false, bindHost(h) { this.bound = h; }, start() { this.started = true; }, update() {} });
function pool(self, { orphans = () => false } = {}) {
  const p = createExteriorFoes({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
    collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (feet, mx, my, mz) => { feet[0] += mx; feet[2] += mz; return { grounded: true, hitCeiling: false, groundKey: 'floor' }; } },
    fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return bsa; throw new Error(`no ${n} in this pin`); },
    getTexture: async () => stubTex, uploadRecordFrame: () => {},
    currentMinute: () => 0, currentPixelKey: () => '3,12',
    playerEntity: playerEntity(), audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  });
  p.setNet({ room: () => 'world:3,12', selfId: () => self, peers: () => [], now: () => 0, staleMs: 0, onPeerHit: () => true, toWire: (f) => [f[0], f[1], f[2]], toScene: (w) => [w[0], w[1], w[2]] });
  const bound = [];
  p.setQuestShare({
    tagOf: (f) => (f.questBehaviour ? { q: 'WAQ_SHIP_SMALLRAID', s: f.questBehaviour.targetSymbol.name } : null),
    accepts: (from) => PARTY.has(self) && PARTY.has(from),
    peerMayHit: (peerId) => PARTY.has(peerId),
    onPuppetHurt: () => {}, onPuppetDied: () => {},
    behaviourFor: (tag) => { const b = fakeBehaviour(); b.targetSymbol = { name: tag.s }; bound.push(b); return b; },
    adoptsOrphan: (from, f) => orphans(from, f),
  });
  return { p, bound };
}
async function questFoes(p, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = await p.spawnFoe(0, [100 + i, 0, 100], { feetGiven: true, loose: true });
    f.questBehaviour = fakeBehaviour();
    out.push(f);
  }
  return out;
}

test('QUEST-PARTY 2 executed: a dying host names a party member heir for its shared quest\'s foes; the heir takes them as its own quest\'s, they ride as its, and the host lets them go', async () => {
  const host = pool('host-0001'), amy = pool('amy-0003');
  await questFoes(host.p, 3);
  amy.p.applyFoes('host-0001', host.p.foesFrame(true));
  await settle();
  assert.equal(amy.p.foes.filter((f) => f.puppet === 'host-0001').length, 3);
  const frame = host.p.handOverFrame(() => 'amy-0003');
  assert.ok(frame.f.every((r) => r.e === 'amy-0003'), 'every live foe of the quest names its heir');
  amy.p.applyFoes('host-0001', frame);
  const mine = amy.p.foes.filter((f) => !f.puppet && !f.dead);
  assert.equal(mine.length, 3, 'the heir takes them');
  assert.ok(mine.every((f) => f.isQuestFoe && f.questBehaviour?.started && f.questBehaviour.bound), 'each bound to the heir\'s own copy of the quest');
  assert.equal(amy.bound.length, 3);
  assert.ok(mine.every((f) => f._pupQuest == null), 'no longer a partner\'s word');
  const now = amy.p.foesFrame(true);
  assert.equal(now.qf?.length, 3, 'they ride to the party as the heir\'s');
  assert.equal(host.p.dropOwnLive(), 3, 'and the host lets them go');
});

test('QUEST-PARTY 2 executed: an owner gone without a handover leaves its quest\'s foes to the member the law names; the rest let them go, and a plain foe is let go by all', async () => {
  const host = pool('host-0001');
  await questFoes(host.p, 2);
  await host.p.spawnFoe(0, [120, 0, 100], { feetGiven: true, loose: true });   // a foe of no quest
  const frame = host.p.foesFrame(true);
  const amy = pool('amy-0003', { orphans: () => true }), cat = pool('cat-0004', { orphans: () => false });
  amy.p.applyFoes('host-0001', frame); cat.p.applyFoes('host-0001', frame);
  await settle();
  amy.p.pruneOwners(new Set()); cat.p.pruneOwners(new Set());
  const amyOwn = amy.p.foes.filter((f) => !f.puppet && !f.dead);
  assert.equal(amyOwn.length, 2, 'the named member takes the quest\'s two');
  assert.ok(amyOwn.every((f) => f.isQuestFoe && f.questBehaviour?.started), 'as its own quest\'s');
  assert.equal(amy.p.foes.filter((f) => f.puppet === 'host-0001').length, 0, 'and the plain foe went with its owner, as ever');
  assert.equal(cat.p.foes.filter((f) => f.puppet === 'host-0001' || !f.dead).length, 0, 'another member lets them go - it sees them again on the taker\'s stream');
});

test('QUEST-PARTY 2 by source: the world host\'s heirs for a quest foe are the party, and a taken foe is bound through its own copy', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const heirOf = \(f\) => \{[^\n]*if \(f\.isQuestFoe && !social\?\.isPartyPeer\(q\.id\)\) continue;[^\n]*\n\s*const frame = exteriorFoes\.handOverFrame\(heirOf\);/, 'never a stranger (the open air\'s handover; QUEST-PARTY phase 3b\'s building one is pinned beside its own)');
  assert.match(w, /behaviourFor: \(tag\) => questBehaviourFor\(questBridge\?\.machine, tag\),/);
  assert.match(w, /adoptsOrphan: \(from, f\) => !!social\?\.party && adoptsOrphanQuestFoe\(\{ myId: online\?\.id \?\? null, myFeet: player\.feetAt\(\), foeFeet: f\.ai\?\.feet, partyPeers: \(peersNear\(\) \?\? \[\]\)\.filter\(\(p\) => p\.id !== from && social\.isPartyPeer\(p\.id\)\) \}\),/);
});
