// FIELD BUGS 2026-10-04e - the Arena's feedback (bible/01-Overview/Field-Bugs-2026-10-04e.md, report 2).
//
// Discord (Draugr): "Great feature and first tournament. But some small problems. Arrows are not refunded, which causes
// problems; The ghosts outside are bothersome (I know they're story related); The multiple npc arena fights will target
// each other despite being on the same team" - and then "The dungeon under the arena is also completely missing enemies".
// ARENA-ARROWS, CURSE-OFF-SAND, ARENA-TEAMS, UNDERCROFT-DEEP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createArenaBouts } from '../src/scenes/arenaBouts.js';
import { newArenaLadder, nextLadderBout } from '../src/systems/arenaLadder.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { markQuiver, refundQuiver, QUIVER_TEMPLATES } from '../src/systems/arenaQuiver.js';
import { keptOffArenaGround, ARENA_GROUND_M, ARENA_GROUND_QUESTS } from '../src/systems/arenaGround.js';
import { boutTeammates } from '../src/combat/friendlyFire.js';
import { boutGate } from '../src/characters/enemyTargets.js';
import { arenaHudModel } from '../src/ui/arenaHud.js';
import { undercroftPopulation, deepFoesOf, undercroftHallNear, UNDERCROFT_DEEP_M, UNDERCROFT_BEASTS, UNDERCROFT_PEOPLE } from '../src/world/arenaUndercroft.js';
import { spendArrow, ARROW_TEMPLATE } from '../src/systems/inventory.js';
import { PELLET_TEMPLATE } from '../src/characters/thunderlockIds.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 0));
const arrows = (n, extra = {}) => ({ name: 'Arrow', group: 'Weapons', templateIndex: ARROW_TEMPLATE, stackCount: n, ...extra });
const realArrows = (items) => items.filter((i) => i.templateIndex === ARROW_TEMPLATE && !i.timeForItemToDisappear).reduce((n, i) => n + i.stackCount, 0);

// ── ARENA-ARROWS ────────────────────────────────────────────────────────────────────────────────────────────────────

test('ARENA-ARROWS law: the quiver is counted as the bout begins and what it spent is handed back - real stacks only, never more than went in, a stack spent to nothing stood again (mutants: conjured counted; a refund past the mark; the empty stack lost)', () => {
  assert.deepEqual([...QUIVER_TEMPLATES], [ARROW_TEMPLATE, PELLET_TEMPLATE], 'every ammunition inventory.js spendAmmoFor spends');
  const items = [arrows(20), arrows(3, { timeForItemToDisappear: 99 }), arrows(4, { questItem: true })];
  const mark = markQuiver(items);
  assert.deepEqual(mark.map((m) => [m.template, m.count]), [[ARROW_TEMPLATE, 20]], 'the twenty real arrows - not the conjured, not the quest\'s');
  for (let i = 0; i < 5; i++) spendArrow(items);   // three conjured first, then two real
  assert.equal(realArrows(items.filter((i) => !i.questItem)), 18);
  assert.equal(refundQuiver(items, mark), 2, 'the two real arrows the bout spent');
  assert.equal(items.find((i) => !i.questItem && !i.timeForItemToDisappear).stackCount, 20, 'onto the stack they came off');
  assert.equal(refundQuiver(items, mark), 0, 'nothing twice');
  // spent to nothing
  const two = [arrows(2), { name: 'Pellet', group: 'Weapons', templateIndex: PELLET_TEMPLATE, stackCount: 6 }];
  const m2 = markQuiver(two);
  spendArrow(two); spendArrow(two);
  two.find((i) => i.templateIndex === PELLET_TEMPLATE).stackCount = 1;
  assert.equal(two.some((i) => i.templateIndex === ARROW_TEMPLATE), false, 'the quiver emptied');
  assert.equal(refundQuiver(two, m2), 2 + 5);
  assert.equal(two.find((i) => i.templateIndex === ARROW_TEMPLATE)?.stackCount, 2, 'a new stack off the copy');
  assert.equal(two.find((i) => i.templateIndex === PELLET_TEMPLATE)?.stackCount, 6, 'and the Thunderlock\'s pellets too');
  // more than went in: nothing
  const grown = [arrows(5)];
  const m3 = markQuiver(grown);
  grown[0].stackCount = 9;
  assert.equal(refundQuiver(grown, m3), 0);
  assert.equal(grown[0].stackCount, 9);
  assert.equal(refundQuiver(null, m3), 0); assert.equal(refundQuiver(grown, null), 0);
});

/** test/audit1003_bouts.test.js's rig, cut down: a ladder bout on a fake floor, the driver's doors logged. */
async function ladderRig(items) {
  let t = 1000;
  const log = { say: [], heal: 0 };
  const P = { name: 'Hero', health: 100, maxHealth: 100, arenaLadder: newArenaLadder(), goldPieces: 5000, items, arenaLeague: null };
  const foes = [];
  const stage = {
    kind: 'floor', centre: () => [50, 0, 40],
    spawn: async (mobile, feet, o) => { const f = { mobile, o, entity: { health: 60, maxHealth: 60, bout: o.bout, items: [] }, ai: { feet: [...feet], target: null, isHostile: true } }; foes.push(f); return f; },
    remove: () => {}, heightAt: () => null,
  };
  const A = createArenaBouts({
    now: () => t, rng: () => 0.99, playerEntity: P, setPlayerBout: () => {},
    say: (l) => log.say.push(l), notice: () => {}, pay: () => {}, heal: () => { log.heal++; P.health = P.maxHealth; },
    crime: () => {}, drawHud: () => {}, sound: { cue: () => {}, bed: () => {}, stop: () => {} }, gameMinutes: () => 523530,
  });
  A.setStage(stage);
  A.ask({ where: 'floor', kind: 'ladder', next: nextLadderBout(P.arenaLadder) });
  await settle();
  const step = (ms) => { t += ms; A.frame(ms / 1000, { playerFeet: [44, 0, 40], sheathed: false }); };
  return { A, P, foes, log, step };
}

test('ARENA-ARROWS driven: a ladder bout fought with the bow - its healers hand back every real arrow it spent, and say so (mutants: no mark at the bout; no refund at the heal)', async () => {
  const items = [arrows(12), arrows(2, { timeForItemToDisappear: 50 })];
  const r = await ladderRig(items);
  for (let i = 0; i < 200 && r.A.bout()?.phase !== 'fight'; i++) r.step(100);
  assert.equal(r.A.bout().phase, 'fight');
  for (let i = 0; i < 7; i++) spendArrow(r.P.items);   // two conjured, then five real
  assert.equal(realArrows(r.P.items), 7);
  const f = r.foes[0];
  f.entity.health = 0; f.entity.bout.out = true; f.entity.bout.hooks.floor?.(f, { fromPlayer: true });
  for (let i = 0; i < 400 && r.A.bout()?.phase !== 'done'; i++) r.step(100);
  assert.equal(r.A.bout().phase, 'done');
  assert.ok(r.log.heal >= 1, 'the healers came');
  assert.equal(realArrows(r.P.items), 12, 'every real arrow back');
  assert.ok(r.log.say.includes(ARENA_TEXT.ammoBack(5)), `said: ${r.log.say.join(' | ')}`);
  assert.equal(r.A.refundQuiver(), 0, 'and paid once - a later let-go hands back nothing more');
});

test('ARENA-ARROWS: a private session\'s bout let go before its healers hands the quiver back too (the world host\'s session door)', () => {
  assert.match(read('src/scenes/world.js'), /heal: \(\) => \{ arenaHeal\(\); arenaBouts\.refundQuiver\(\); \},/);
});

// ── ARENA-TEAMS ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('ARENA-TEAMS: a two-against-one\'s pair are teammates and a blast of one passes the other by; a Grand Melee has none (mutants: the side ignored; the blast\'s skip gone; a caster without its foe)', () => {
  const tag = (id, side) => ({ entity: { bout: { id, side, out: false, hold: false } } });
  const a = tag('b1', 1), b = tag('b1', 1), me = tag('b1', 0), other = tag('b2', 1);
  assert.equal(boutTeammates(a, b), true, 'one bout, one side');
  assert.equal(boutGate(a, b, false), false, 'and the gate already kept them out of each other\'s targets');
  assert.equal(boutTeammates(a, me), false, 'across the sand');
  assert.equal(boutTeammates(a, other), false, 'another bout');
  assert.equal(boutTeammates(a, a), false, 'nobody is their own teammate');
  assert.equal(boutTeammates(a, { entity: {} }), false);
  assert.equal(boutTeammates({ entity: {} }, { entity: {} }), false, 'no bout, no team');
  assert.equal(boutTeammates(tag('m', 1), tag('m', 2)), false, 'a Grand Melee: each a side of its own');
  const M = read('src/scenes/hostMagic.js');
  const blast = M.slice(M.indexOf('function explodeAt('), M.indexOf('applySpellToFoe(spell, casterLevel, t, caster);', M.indexOf('function explodeAt(')));
  assert.match(blast, /if \(caster\?\.foe && boutTeammates\(caster\.foe, t\)\) continue;/, 'the blast passes a teammate by');
  // the floor's instance is a dungeon level: its foe missiles' blasts carry their foe as hostMagic's own do
  const D = read('src/scenes/dungeonContext.js');
  for (const w of ['wCaster', 'fCaster', 'mCaster']) assert.match(D, new RegExp(`const ${w} = m\\.casterFoe \\? \\{ entity: m\\.casterFoe\\.entity, sinks: foeSinks\\(m\\.casterFoe\\), foe: m\\.casterFoe \\} : null;`), w);
});

test('ARENA-TEAMS: the HUD calls a Grand Melee "each alone" between its columns, a team bout "vs" (mutants: the melee test inverted; the word never written)', () => {
  const f = (id, side) => ({ id, name: id, side, health: 10, maxHealth: 10 });
  const at = (fighters) => arenaHudModel({ phase: 'fight', fighters, fightAt: 0, limitMs: 180000 }, null, 0, { you: 'you' });
  assert.equal(at([f('you', 0), f('a', 1), f('b', 2), f('c', 3)]).vs, ARENA_TEXT.hud.eachAlone, 'every fighter a side of its own');
  assert.equal(at([f('you', 0), f('a', 1), f('b', 1)]).vs, ARENA_TEXT.hud.vs, 'two against one: a team');
  assert.equal(at([f('you', 0), f('a', 1)]).vs, ARENA_TEXT.hud.vs, 'a duel');
  assert.match(read('src/ui/arenaHud.js'), /if \(\(model\.vs \?\? ARENA_TEXT\.hud\.vs\) !== shown\.vs\) \{ shown\.vs = model\.vs \?\? ARENA_TEXT\.hud\.vs; parts\.vs\.textContent = shown\.vs; \}/);
});

// ── CURSE-OFF-SAND ──────────────────────────────────────────────────────────────────────────────────────────────────

test('CURSE-OFF-SAND: the Curse of Daggerfall\'s wave waits outside the arena\'s grounds and its levels; any other quest\'s is placed as ever (mutants: every quest kept off; the reach inverted; the levels open)', () => {
  assert.deepEqual([...ARENA_GROUND_QUESTS], ['S0000977']);
  const centre = [100, 0, 100];
  const near = [100 + ARENA_GROUND_M - 1, 0, 100], far = [100 + ARENA_GROUND_M + 1, 0, 100];
  assert.equal(keptOffArenaGround({ questName: 'S0000977', feet: near, centre }), true, 'at the gate: the wave waits');
  assert.equal(keptOffArenaGround({ questName: 's0000977', feet: near, centre }), true, 'by name, as the machine reads one');
  assert.equal(keptOffArenaGround({ questName: 'S0000977', feet: far, centre }), false, 'past the grounds: the curse as ever');
  assert.equal(keptOffArenaGround({ questName: 'S0000977', feet: near, centre: null }), false, 'no arena built: nothing kept');
  assert.equal(keptOffArenaGround({ questName: 'S0000977', inArenaLevel: true }), true, 'the floor\'s instance, the undercroft');
  assert.equal(keptOffArenaGround({ questName: 'M0B00Y16', feet: near, centre }), false, 'another quest\'s foe');
  assert.equal(keptOffArenaGround({ questName: 'M0B00Y16', inArenaLevel: true }), false);
  assert.equal(keptOffArenaGround({ questName: null, feet: near, centre }), false);
  // the hosts that place a quest's foes: both exteriors, and the modes host for the dungeon arm (the floor's instance and
  // the undercroft are dungeon levels; dungeonContext.js stands what worldModes.js places - THE FOUR HOSTS RULE)
  assert.match(read('src/scenes/world.js'), /if \(keptOffArenaGround\(\{ questName: handle\.foe\?\.parentQuest\?\.questName, feet: player\.pos, centre: arenaCityPixel\(\) \? arenaCityStage\.centre\(\) : null \}\)\) return false;/);
  assert.match(read('src/scenes/exterior.js'), /if \(keptOffArenaGround\(\{ questName: handle\.foe\?\.parentQuest\?\.questName, feet, centre: arenaCityOrigin \? arenaCityStage\.centre\(\) : null \}\)\) return false;/);
  assert.match(read('src/scenes/worldModes.js'), /if \(keptOffArenaGround\(\{ questName: handle\.foe\?\.parentQuest\?\.questName, inArenaLevel: isArenaFloor\(dungeonLoc\) \|\| isArenaUndercroft\(dungeonLoc\) \}\)\) return false;/);
});

// ── UNDERCROFT-DEEP ─────────────────────────────────────────────────────────────────────────────────────────────────

test('UNDERCROFT-DEEP: past a block from the hall the keep\'s own foes stand again - the hall\'s block stays quiet, and a rest is broken only out there (mutants: the reach dropped; every quiet marker deep; the near list without the stair)', () => {
  // a start, then 60 random markers 4 m apart out along x - 240 m of cellar
  const markers = [{ archive: 199, record: 10, x: 0, y: 1, z: 0 }];
  for (let i = 1; i <= 60; i++) markers.push({ archive: 199, record: 15, x: i * 4, y: 1, z: 0 });
  const blocks = [{ layout: { markers, flats: [] }, originX: 0, originZ: 0 }];
  const h = undercroftPopulation(blocks);
  const used = 2 + UNDERCROFT_PEOPLE.length + UNDERCROFT_BEASTS.length;   // the pit, the Hall, the people, the beasts
  const lastHall = used * 4;   // the furthest marker the hall took
  assert.ok(h.deep.length > 0, 'the deep cellars hold foes');
  assert.ok(h.deep.every((m) => m.x - lastHall >= UNDERCROFT_DEEP_M), 'every one a block past the hall');
  assert.equal(h.deep[0].x, Math.ceil((lastHall + UNDERCROFT_DEEP_M) / 4) * 4, 'the first marker past the reach');
  assert.equal(h.quiet + h.deep.length + used, 60, 'every marker is the hall\'s, quiet or deep');
  assert.deepEqual(h.near[0], [0, 1, 0], 'the reach is measured from the stair too');
  // the layout's foes at those markers, and only those
  const layout = markers.slice(1).map((m) => ({ x: m.x, y: m.y, z: m.z, mobileType: 128 }));
  const deep = deepFoesOf(layout, h.deep);
  assert.deepEqual(deep.map((e) => e.x), h.deep.map((m) => m.x));
  // the rest: in the hall's reach, never broken; out in the deep, the keep's
  assert.equal(undercroftHallNear(h, [lastHall + 10, 1, 0]), true);
  assert.equal(undercroftHallNear(h, [h.deep.at(-1).x, 1, 0]), false);
  assert.equal(undercroftHallNear(null, [0, 0, 0]), false);
  // a small undercroft (the ARENA-FIX 4 rig): all of it the hall's reach - nothing deep
  const small = [{ archive: 199, record: 10, x: 0, y: 1, z: 0 }];
  for (let i = 1; i <= 20; i++) small.push({ archive: 199, record: 15, x: i * 3, y: 1, z: 0 });
  assert.equal(undercroftPopulation([{ layout: { markers: small, flats: [] }, originX: 0, originZ: 0 }]).deep.length, 0);
});
