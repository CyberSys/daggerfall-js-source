// AUDIT ARENA-LADDER (2026-10-05, the owner: "Before we merge this. Can you do a comprehensive audit on the new arena?
// Ensure AI enemies sometimes recieve telegraphed attacks, ensure climbing the PvE ladder isnt an easy feat, and look at
// where we can make improvements"; asked, "Lose the tier's run", "No cheese spells or potions", "Elite champions",
// "Relay and service"). Every finding of bible/01-Overview/Audit-Arena-Ladder.md pinned here: the telegraphs between
// fighters (the brain's and the relay's), the climb's cost (the run, the elites, the judges' floor, the kit law, the
// ticket), and the bout's holes (the sand's collapse, a dispelled champion, the player's live tag, a blow from the side).
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setPref } from '../src/systems/uiPrefs.js';
import { Collider } from '../src/player/collider.js';
import { MOBILE_TYPES as M } from '../src/characters/mobileTypes.js';
import { setTacticsClock, resetTactics, tacticsStep, noteLocalPlayer, LOCAL_TARGET } from '../src/ai/tactics.js';
import {
  resetBlows, makeBlow, setLiveBlow, drawableBlows, blowConnects, blowScaled, registerBlowDodgedListener, SAND_DRAW_RANGE,
  BLOW_TIER_LEVEL, BLOW_COOLDOWN_MIN, BLOW_COOLDOWN_MAX, BLOW_CHANCE, blowShapesOf as foeShapesOf, inBlow as foeInBlow, BLOW as FOE_BLOW,
} from '../src/ai/foeBlows.js';
import { BLOW, BLOW_FAMILY, BLOW_CASTERS, blowShapesOf, inBlow } from '../src/ai/blowShapes.js';
import { setPlayerBout, playerBoutOf, boutGate, inBout } from '../src/characters/enemyTargets.js';
import { LADDER_TIERS, ladderAfter, arenaLadderRestore, BOUTS_PER_TIER } from '../src/systems/arenaLadder.js';
import { newBout, boutTick, boutHit, boutAtMarks, takeBoutEvents, callMs, COUNT_MS, BOUT_LIMIT_MS } from '../src/systems/arenaBout.js';
import { SAND_BARRED_EFFECTS, SAND_BARRED_KINDS, SAND_CEILING_M, onTheSand, sandPotionRefusal, sandSpellRefusal, stripSandBarred } from '../src/systems/arenaKit.js';
import { PlayerMotor, JUMP_SPEED } from '../src/player/motor.js';
import { JUMP_SPELL_MULTIPLIER, ATHLETICISM_MULTIPLIER, IMPROVED_ATHLETICISM_MULTIPLIER } from '../src/systems/skills.js';
import { useItem, TEMPLATES } from '../src/systems/useItem.js';
import { ARENA_TEXT } from '../src/systems/arenaText.js';
import { ELITE_FOE_HEALTH_MULT, ELITE_FOE_DAMAGE_MULT } from '../src/systems/eliteFoes.js';
import {
  arenaFoeStats, arenaLadderBout, ARENA_CLASS_SPEED, ARENA_BEAST_SPEED, ARENA_ELITE_HP_MULT, ARENA_ELITE_DMG_MULT, ARENA_BLOW_TIER_LEVEL,
  ARENA_BLOW_CHANCE, ARENA_BLOW_COOLDOWN_MIN_MS, ARENA_BLOW_COOLDOWN_MAX_MS, ARENA_BLOW_SHAPES, LADDER_JUDGES_SHARE, ARENA_TICKET_RE,
  validArenaIn, validArenaOut, ARENA_NO_TEXT, ARENA_FLOOR_CENTRE, arenaBoutRoom, ARENA_CHAMPION_MIN_BOUTS, ARENA_CHAMPION_MIN_FOES, ARENA_PAIR_SEASON_MAX,
  ARENA_PAIR_DAY_MAX, ladderKey,
} from '../src/net/arenaLaw.js';
import { openBout, joinBout, stepBout } from '../src/net/arenaBrain.js';
import { mintArenaReceipt, readArenaReceipt, arenaReceiptValid } from '../src/net/arenaReceipt.js';
import { fakeRooms } from './fakeRoom.mjs';
import { standService } from './accountDb.mjs';
import { laurelWorthy, laurelOfBoard } from '../server-account/src/arena.js';
import { createArenaOnline } from '../src/scenes/arenaOnline.js';
import { arenaLadderOf } from '../src/net/arenaLaw.js';

const { subtle } = globalThis.crypto;
const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
let T = 0;
setTacticsClock(() => T);
beforeEach(() => { resetTactics(); resetBlows(); T = 0; setPref('enhancedAI', true); setPlayerBout(null); });

// ── THE TELEGRAPHS: the owner's "Ensure AI enemies sometimes recieve telegraphed attacks" ──────────────────────

test('AUDIT ARENA-LADDER T1: the families moved to the leaf by MobileTypes number - every number the kind it names, the brain\'s law unchanged, one home handed on (mutants: a number off by one; a caster left throwing; the re-export a copy)', () => {
  const named = {
    GrizzlyBear: 'lunge', SabertoothTiger: 'lunge', Spider: 'lunge', Werewolf: 'lunge', Wereboar: 'lunge', GiantScorpion: 'lunge', Dragonling: 'lunge', Dragonling_Alternate: 'lunge',
    Giant: 'slam', OrcWarlord: 'slam', Daedroth: 'slam', DaedraLord: 'slam', IronAtronach: 'slam', FleshAtronach: 'slam', Gargoyle: 'slam', Dreugh: 'slam',
    Centaur: 'sweep', Orc: 'sweep', OrcSergeant: 'sweep', SkeletalWarrior: 'sweep', Mummy: 'sweep', Vampire: 'sweep', VampireAncient: 'sweep', FrostDaedra: 'sweep', FireDaedra: 'sweep', DaedraSeducer: 'sweep', Lamia: 'sweep',
  };
  const fam = { lunge: ['lunge'], slam: ['slam', 'sweep'], sweep: ['sweep', 'lunge'] };
  for (const [k, first] of Object.entries(named)) {
    assert.ok(Number.isInteger(M[k]), k);
    assert.deepEqual([...BLOW_FAMILY.get(M[k])], fam[first], `${k} (${M[k]})`);
  }
  assert.equal(BLOW_FAMILY.size, Object.keys(named).length, 'no number the table names that the kinds do not');
  assert.deepEqual([...BLOW_CASTERS].sort(), [M.Mage, M.Sorcerer, M.Healer].sort());
  for (const c of [M.Mage, M.Sorcerer, M.Healer]) assert.deepEqual(blowShapesOf(c), [], 'a caster throws none');
  assert.deepEqual([...blowShapesOf(M.Knight)], ['sweep', 'lunge'], 'a class with a blade');
  assert.deepEqual(blowShapesOf(M.Rat), [], 'the small');
  assert.deepEqual(blowShapesOf(M.None), []);
  assert.equal(foeShapesOf, blowShapesOf, 'ai/foeBlows.js hands the leaf\'s own on');
  assert.equal(foeInBlow, inBlow);
  assert.equal(FOE_BLOW, BLOW);
  assert.doesNotMatch(rd('src/ai/blowShapes.js'), /^import /m, 'a leaf: the relay\'s graph reaches it and nothing past it');
});

/** A fighter on the sand, of `bout` and `side`, at `feet`, as the brain reads one (an entity, its feet, its target). */
function fighter({ feet, side, bout = 'b1', level = 12, type = M.Orc, out = false, hold = false } = {}) {
  const body = { health: 100, maxHealth: 100, mobileType: type, level, bout: { id: bout, side, ...(out ? { out } : {}), ...(hold ? { hold } : {}) } };
  const ai = { inSight: true, detected: true, _dist: 1.6, feet: [...feet], stopDistance: 2.25, yaw: 0, canAct: true, _armedTargeting: true, collider: new Collider(() => 0), vitals: () => body, flee() {} };
  return { ai, entity: body };
}
const targetOf = (f) => ({ isPlayer: false, entity: f.entity, ai: f.ai, dead: false });
/** `a` engaged on `b` with its token, the roll the wind-up's. */
function windUp(a, b) {
  a.ai.target = targetOf(b);
  const rnd = Math.random;
  Math.random = () => 0;
  try { tacticsStep(a.ai, b.ai.feet[0] - a.ai.feet[0], b.ai.feet[2] - a.ai.feet[2]); } finally { Math.random = rnd; }
  return a.ai._tac;
}

test('AUDIT ARENA-LADDER T2: ON THE SAND A FIGHTER WINDS UP AT ITS BOUT-MATE - a token holder of the tier, at a fighter of the same live bout on another side; the blow marked for it and drawn for the stands (mutants: the mark the player alone; the bout\'s id unread; the side unread; the stands\' range off)', () => {
  noteLocalPlayer([40, 0, 40], [0, 0, 1]);
  const a = fighter({ feet: [0, 0, 0], side: 0 }), b = fighter({ feet: [0, 0, 1.6], side: 1 });
  const s = windUp(a, b);
  assert.equal(s.state, 'windup', 'a wind-up at the other fighter');
  assert.equal(s.blow.tg, a.ai.target, 'marked for the one it was wound up at');
  assert.equal(s.blow.sand, true);
  // and none where the mark is no bout-mate
  for (const [why, other] of [
    ['the same side', fighter({ feet: [0, 0, 1.6], side: 0 })],
    ['another bout', fighter({ feet: [0, 0, 1.6], side: 1, bout: 'b2' })],
    ['a fighter out', fighter({ feet: [0, 0, 1.6], side: 1, out: true })],
    ['a bout on hold', fighter({ feet: [0, 0, 1.6], side: 1, hold: true })],
  ]) {
    resetTactics(); resetBlows();
    const x = fighter({ feet: [0, 0, 0], side: 0 });
    assert.notEqual(windUp(x, other).state, 'windup', why);
  }
  resetTactics(); resetBlows();
  const street = fighter({ feet: [0, 0, 0], side: 0 }), mark = fighter({ feet: [0, 0, 1.6], side: 1 });
  street.entity.bout = null;
  assert.notEqual(windUp(street, mark).state, 'windup', 'a street\'s infighting: no telegraph (TACT4\'s law kept)');
  // the stands see a sand's blow from the far tier; a street's stays within its 40 m
  T = 1;
  const sand = makeBlow('lunge', [0, 0, 0], 0, T); sand.sand = true;
  const road = makeBlow('lunge', [0, 0, 0], 0, T);
  const ka = {}, kb = {};
  setLiveBlow(ka, sand); setLiveBlow(kb, road);
  assert.equal(SAND_DRAW_RANGE, 100);
  const far = drawableBlows(T, [90, 0, 0]);
  assert.deepEqual(far.map((x) => x.blow), [sand], '90 m off: the sand\'s alone');
  assert.equal(drawableBlows(T, [30, 0, 0]).length, 2);
});

test('AUDIT ARENA-LADDER T3: the bout-mate\'s blow lands by its shape - the verdict where the mark stands, the shape\'s weight on the damage, a dodge a miss told to the listeners; a wind-up whose foe turned lands on no one (mutants: the verdict read at my feet; the weight dropped; the dodge untold)', () => {
  noteLocalPlayer([40, 0, 40], [0, 0, 1]);
  const told = [];
  registerBlowDodgedListener('t3', (ai) => told.push(ai));
  try {
    const a = fighter({ feet: [0, 0, 0], side: 0 }), b = fighter({ feet: [0, 0, 1.6], side: 1 });
    const s = windUp(a, b);
    const mult = s.blow.mult;
    T = s.blow.land + 0.01;
    tacticsStep(a.ai, 0, 1.6);
    assert.equal(a.ai._blowVerdict, true, 'the mark stood in its shape');
    assert.equal(a.ai._blowMult, mult, 'its weight carried to the swing');
    assert.ok(mult > 1);
    assert.equal(blowConnects(a.ai, false, T), true, 'the shape decides, not the classic reach');
    assert.equal(blowScaled(a.ai, 10), Math.round(10 * mult), 'weighed by its shape');
    assert.equal(told.length, 0);
    // stepped out of it: a dodge
    resetTactics(); resetBlows(); T = 0;
    const c = fighter({ feet: [0, 0, 0], side: 0 }), d = fighter({ feet: [0, 0, 1.6], side: 1 });
    const s2 = windUp(c, d);
    d.ai.feet = [8, 0, 1.6];   // out of any shape's reach
    T = s2.blow.land + 0.01;
    tacticsStep(c.ai, 8, 1.6);
    assert.equal(c.ai._blowVerdict, false);
    assert.equal(blowConnects(c.ai, true, T), false, 'stepped out of: no blow, whatever the classic reach said');
    assert.deepEqual(told, [c.ai], 'and the dodge told (the judges\' miss)');
    // turned on another before it landed: no one
    resetTactics(); resetBlows(); T = 0;
    const e = fighter({ feet: [0, 0, 0], side: 0 }), f = fighter({ feet: [0, 0, 1.6], side: 1 }), g = fighter({ feet: [0, 0, -1.6], side: 2 });
    const s3 = windUp(e, f);
    e.ai.target = targetOf(g);
    T = s3.blow.land + 0.01;
    tacticsStep(e.ai, 0, -1.6);
    assert.equal(e.ai._blowVerdict ?? null, null, 'turned: no verdict');
  } finally { registerBlowDodgedListener('t3', null); }
  // the local player's blows as they were: one wound up without a mark lands on me
  resetTactics(); resetBlows(); T = 0;
  noteLocalPlayer([0, 0, 2], [0, 0, 1]);
  const ai = { inSight: true, detected: true, _dist: 2, feet: [0, 0, 0], stopDistance: 2.25, yaw: 0, canAct: true, _armedTargeting: false, target: null, flee() {} };
  ai._tac = { key: LOCAL_TARGET, kind: 'melee', state: 'windup', until: 0, slot: 0, hp: [], fled: false, seen: 0, swung: 0, shot: 0, kiting: false, meleeUntil: 0, leased: 0, blow: makeBlow('lunge', [0, 0, 0], 0, -1) };
  tacticsStep(ai, 0, 2);
  assert.equal(ai._blowVerdict, true, 'TACT4\'s law: a blow with no mark is mine');
});

test('AUDIT ARENA-LADDER T4: the hosts resolve a fighter\'s blow on a fighter by its shape and tell the arena a dodge (mutants: the classic reach alone between foes; the weight dropped; the listener unregistered)', () => {
  const dc = rd('src/scenes/dungeonContext.js'), ef = rd('src/scenes/exteriorFoes.js');
  assert.match(dc, /if \(blowConnects\(f\.ai, foeDeps\.meleeHitConnects\(/);
  assert.match(dc, /dealDamage: \(tt, d\) => tt\.hurtFromFoe\?\.\(blowScaled\(f\.ai, d\), fwd, f\)/);
  assert.match(ef, /if \(blowConnects\(f\.ai, meleeHitConnects\(/);
  assert.match(ef, /d = blowScaled\(f\.ai, d\);/);
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(h), /registerBlowDodgedListener\('arena', \(ai\) => arenaBouts\.blowDodged\(ai\)\);/, h);
  const ab = rd('src/scenes/arenaBouts.js');
  assert.match(ab, /function blowDodged\(ai\) \{[\s\S]*?recordStrike\(C\.rec, t, from\);\s*boutMiss\(C\.b, \{ from, now: t \}\);/);
  // a relay's telegraph drawn off its word, where it was wound up
  assert.match(ab, /if \(w\.s && foe\?\.ai\?\.feet\) \{\s*const p = relayToStage\(C, w\.ox, w\.oz\);\s*const blow = makeBlow\(w\.s, \[p\[0\], foe\.ai\.feet\[1\], p\[1\]\], w\.yw, tacticsNow\(\), BLOW_COLOR\);\s*blow\.sand = true;\s*setLiveBlow\(foe\.ai, blow\);/);
});

/** A relay's ladder bout of `tier`/`bout`, its fighter on the sand and the law fighting at `t`. */
function relayLadder(tier, bout, { cl = 20 } = {}) {
  let t = 1_000_000;
  const st = openBout({ o: '00000000000000c1', kind: 'pve', f: [{ sub: 'acct-x', name: 'Ceryn', lv: cl, cl, tk: 'feedc0de00000009' }], tier, bout, now: t });
  joinBout(st, 'acct-x', 'f', t);
  const C = ARENA_FLOOR_CENTRE;
  st.last.p0 = [C[0], C[2], t];
  t += callMs(st.b);
  stepBout(st, t, () => 0.9);
  for (const x of st.b.fighters) boutAtMarks(st.b, x.id, t);
  t += COUNT_MS;
  stepBout(st, t, () => 0.9);
  assert.equal(st.b.phase, 'fight');
  return { st, t, C };
}

test('AUDIT ARENA-LADDER T5: THE RELAY\'S FIGHTERS TELEGRAPH TOO - of the tier (level 10 up, or a champion), its cooldown spent, the roll: the `atk` word carries the shape, its facing and where it was wound up; it lands by the shape and its weight, and a step out of it is a miss (mutants: the tier unread; the shape\'s verdict the reach\'s; the weight dropped; the cooldown unset)', () => {
  assert.equal(ARENA_BLOW_TIER_LEVEL, BLOW_TIER_LEVEL, 'the brain\'s tier');
  assert.deepEqual([ARENA_BLOW_COOLDOWN_MIN_MS, ARENA_BLOW_COOLDOWN_MAX_MS], [BLOW_COOLDOWN_MIN * 1000, BLOW_COOLDOWN_MAX * 1000], 'the brain\'s cooldown');
  assert.ok(ARENA_BLOW_CHANCE > BLOW_CHANCE && ARENA_BLOW_CHANCE < 1, 'rolled once a blow, not a tick: more often a roll, sometimes');
  assert.deepEqual([...ARENA_BLOW_SHAPES].sort(), Object.keys(BLOW).sort());
  const { st, t, C } = relayLadder(6, 0);   // the Knight, level 13
  const a = st.ai[0];
  a.pos = [C[0], C[2] + 1.6]; a.mv = null;
  const words = stepBout(st, t, () => 0);
  const atk = words.find((w) => w.k === 'atk');
  assert.ok(atk?.s, 'a telegraphed blow');
  assert.deepEqual(validArenaOut(atk), atk, 'its word as the wire carries it');
  assert.equal(atk.tg, 'p0');
  assert.ok(atk.at - t >= BLOW[atk.s].windup * 1000 - 1, 'its wind-up the shape\'s');
  assert.ok(a.blowAt >= t + ARENA_BLOW_COOLDOWN_MIN_MS, 'its cooldown set');
  const hp0 = st.b.fighters.find((f) => f.id === 'p0').health;
  const land = stepBout(st, atk.at, () => 0);
  const blow = land.find((w) => w.k === 'blow');
  assert.ok(blow, 'stood in its shape: struck');
  assert.equal(blow.d, Math.max(1, Math.round(a.dmg[0] * BLOW[atk.s].mult)), 'the roll weighed by the shape');
  assert.equal(st.b.fighters.find((f) => f.id === 'p0').health, hp0 - blow.d);
  // the next telegraph (past its cooldown), stepped out of
  a.nextAt = 0; a.blowAt = 0;
  const w2 = stepBout(st, atk.at + 10, () => 0).find((w) => w.k === 'atk');
  assert.ok(w2?.s);
  st.last.p0 = [C[0], C[2] + 3.1, atk.at + 10];   // behind it: in the plain blow's reach, out of every shape
  const missBefore = st.b.fighters.find((f) => f.id === 'a0')?.misses ?? 0;
  const l2 = stepBout(st, w2.at, () => 0);
  assert.equal(l2.find((w) => w.k === 'blow'), undefined, 'out of its shape: no blow, though in its reach');
  assert.equal((st.b.fighters.find((f) => f.id === 'a0')?.misses ?? 0), missBefore + 1, 'a miss for the judges');
  // under the tier, never
  const low = relayLadder(0, 0);
  const la = low.st.ai[0];
  la.pos = [low.C[0], low.C[2] + 1.6]; la.mv = null;
  const lw = stepBout(low.st, low.t, () => 0).find((w) => w.k === 'atk');
  assert.ok(lw && lw.s === undefined, 'the Pit\'s thief swings plainly');
  // and the champion, under the tier by level, is of it as an elite
  const ch = relayLadder(0, 3);
  const ca = ch.st.ai[0];
  assert.equal(ca.elite, true);
  ca.pos = [ch.C[0], ch.C[2] + 1.6]; ca.mv = null;
  assert.ok(stepBout(ch.st, ch.t, () => 0).find((w) => w.k === 'atk')?.s, 'the Pit\'s champion telegraphs');
});

// ── THE CLIMB: the owner's "ensure climbing the PvE ladder isnt an easy feat" ──────────────────────────────

test('AUDIT ARENA-LADDER L1: A LOSS BREAKS THE TIER\'S RUN - back to its first bout, said; a champion beaten stays beaten; a loss at the run\'s start loses nothing more; a draw is a loss (mutants: the run kept; runLost always said; the champion\'s tier taken back)', () => {
  let L = arenaLadderRestore(null);
  L = ladderAfter(L, { won: true }).ladder;
  L = ladderAfter(L, { won: true }).ladder;
  assert.equal(L.won, 2);
  const lost = ladderAfter(L, { won: false, how: 'fall' });
  assert.equal(lost.ladder.won, 0, 'back to the first bout');
  assert.equal(lost.runLost, true);
  assert.equal(lost.ladder.tier, 0);
  assert.equal(lost.ladder.record.losses, 1);
  const again = ladderAfter(lost.ladder, { won: false, how: 'yield' });
  assert.equal(again.runLost, false, 'nothing to lose at the start');
  // three wins, the champion: the next tier, kept through a loss there
  let M2 = lost.ladder;
  for (let i = 0; i < BOUTS_PER_TIER; i++) M2 = ladderAfter(M2, { won: true }).ladder;
  const champ = ladderAfter(M2, { won: true });
  assert.equal(champ.tierUp, true);
  const l2 = ladderAfter(ladderAfter(champ.ladder, { won: true }).ladder, { won: false, how: 'judges' });
  assert.deepEqual([l2.ladder.tier, l2.ladder.won, l2.runLost], [1, 0, true], 'a judges\' loss in the second tier: its run, never the first tier\'s title');
  assert.equal(ladderAfter(champ.ladder, { won: false, how: 'draw' }).ladder.record.losses, champ.ladder.record.losses + 1, 'a draw counts as a loss');
  assert.match(ARENA_TEXT.ladder.runLost('the Pit'), /run in the Pit is over/);
  assert.match(rd('src/scenes/arenaBouts.js'), /else if \(out\.runLost\) lines\.push\(ARENA_TEXT\.ladder\.runLost\(ARENA_TEXT\.tiers\[out\.ladder\.tier\]\)\);/);
});

test('AUDIT ARENA-LADDER L2: EVERY TIER\'S CHAMPION FIGHTS AS AN ELITE - offline (spawned elite on both floors) and on the relay (its body the elite multipliers\'); no other bout\'s foe is (mutants: a champion plain; a bout\'s foe elite; the spawn\'s elite dropped)', () => {
  for (const t of LADDER_TIERS) {
    assert.ok(t.champion.length && t.champion.every((c) => c.elite === true), 'the champion elite');
    assert.ok(t.bouts.every((b) => b.every((c) => !c.elite)), 'its bouts plain');
  }
  const wm = rd('src/scenes/worldModes.js');
  assert.equal((wm.match(/bout: o\.bout \?\? null, eliteFoe: !!o\.elite \}/g) ?? []).length, 2, 'both floors\' stage spawns');
  assert.match(rd('src/scenes/arenaBouts.js'), /stage\.spawn\(f\.spec\.mobile, feet, \{ level: f\.spec\.level, elite: !!f\.spec\.elite,/);
  assert.deepEqual([ARENA_ELITE_HP_MULT, ARENA_ELITE_DMG_MULT], [ELITE_FOE_HEALTH_MULT, ELITE_FOE_DAMAGE_MULT], 'the relay\'s elite is the world\'s');
  const plain = arenaFoeStats(M.Knight, 5), el = arenaFoeStats(M.Knight, 5, { elite: true });
  assert.equal(el.hp, plain.hp * 5);
  assert.deepEqual(el.dmg, plain.dmg.map((d) => d * 3));
  const beast = arenaFoeStats(M.GrizzlyBear, null), eb = arenaFoeStats(M.GrizzlyBear, null, { elite: true });
  assert.equal(eb.hp, beast.hp * 5);
  for (let tier = 0; tier < 10; tier++) {
    assert.ok(arenaLadderBout(tier, 3).foes.every((f) => f.elite), `tier ${tier}'s champion`);
    for (let b = 0; b < 3; b++) assert.ok(arenaLadderBout(tier, b).foes.every((f) => !f.elite), `tier ${tier} bout ${b}`);
  }
});

test('AUDIT ARENA-LADDER L3: THE RELAY\'S FIGHTERS RUN - faster than any character\'s walk (mutants: the old 3.2 and 3.6)', () => {
  assert.equal(ARENA_CLASS_SPEED, 5.0);
  assert.equal(ARENA_BEAST_SPEED, 6.0);
  assert.equal(arenaFoeStats(M.Knight, 5).speed, ARENA_CLASS_SPEED);
  assert.equal(arenaFoeStats(M.GrizzlyBear, null).speed, ARENA_BEAST_SPEED);
});

/** A bout of player `p` (side 0) and an AI (side 1), to its fight. */
function judged(judgesFloor) {
  const b = newBout({ id: 'j', kind: 'ladder', fighters: [{ id: 'p', name: 'Me', side: 0, maxHealth: 100, ai: false }, { id: 'a', name: 'Foe', side: 1, maxHealth: 200, ai: true }], ring: { centre: [0, 0], radius: 14 }, now: 0, judgesFloor });
  boutTick(b, callMs(b));
  for (const f of b.fighters) boutAtMarks(b, f.id, callMs(b));
  const t = callMs(b) + COUNT_MS;
  boutTick(b, t);
  takeBoutEvents(b);
  return { b, t };
}

test('AUDIT ARENA-LADDER L4: THE LADDER\'S JUDGES\' FLOOR - at the time limit a player\'s side short of half its opponents\' whole health wins no card; the relay\'s ladder alone sets it (mutants: the floor unread; read off the player\'s own health; the relay passing none)', () => {
  assert.equal(LADDER_JUDGES_SHARE, 0.5);
  // one blow and the clock walked away from
  const { b, t } = judged(LADDER_JUDGES_SHARE);
  boutHit(b, { from: 'p', to: 'a', dmg: 30, now: t + 1 });
  boutTick(b, t + BOUT_LIMIT_MS);
  assert.equal(b.result.how, 'judges');
  assert.equal(b.result.side, 1, 'short of the floor: the card is the fighter\'s');
  // the same, past the floor (100 of 200)
  const x = judged(LADDER_JUDGES_SHARE);
  boutHit(x.b, { from: 'p', to: 'a', dmg: 100, now: x.t + 1 });
  boutTick(x.b, x.t + BOUT_LIMIT_MS);
  assert.equal(x.b.result.side, 0, 'past it: mine');
  // no floor: the judges as they always were
  const y = judged(0);
  boutHit(y.b, { from: 'p', to: 'a', dmg: 30, now: y.t + 1 });
  boutTick(y.b, y.t + BOUT_LIMIT_MS);
  assert.equal(y.b.result.side, 0);
  assert.match(rd('src/net/arenaBrain.js'), /judgesFloor: st\.kind === 'pve' \? LADDER_JUDGES_SHARE : 0 \}\);/);
});

test('AUDIT ARENA-LADDER L5: THE SAND\'S KIT LAW - in a bout of one\'s own no potion is drunk (the bottle kept), no Invisibility, Levitate, Chameleon, Shadow, Charm or Teleport is cast, and those already on the fighter come off; outside a bout, all as before (mutants: a barred type dropped; the bottle eaten; the strip unread)', () => {
  assert.deepEqual([...SAND_BARRED_EFFECTS], [13, 14, 23, 24, 34, 43]);
  const table = rd('src/systems/spellEffects.js');
  for (const [type, name] of [[13, 'Invisibility'], [14, 'Levitate'], [23, 'Chameleon'], [24, 'Shadow'], [34, 'Charm'], [43, 'Teleport']]) assert.match(table, new RegExp(`\\[${type}, \\d+, '${name}'`), `${type} is ${name}`);
  const potion = { name: 'Potion', group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle, stackCount: 1 };
  const pack = [potion];
  assert.equal(onTheSand(), false);
  assert.equal(sandPotionRefusal(), null);
  assert.equal(sandSpellRefusal({ effects: [{ type: 14 }] }), null, 'off the sand: Levitate as ever');
  setPlayerBout({ id: 'b1', side: 0 });
  assert.equal(onTheSand(), true);
  const r = useItem(potion, pack, { drinkPotion: () => { throw new Error('drunk'); } });
  assert.equal(r.kind, 'refused');
  assert.equal(r.refused, true, 'a refusal the quick slot reads as one');
  assert.equal(r.text, ARENA_TEXT.refuse.potion);
  assert.deepEqual(pack, [potion], 'the bottle kept');
  for (const type of SAND_BARRED_EFFECTS) assert.equal(sandSpellRefusal({ effects: [{ type: 3 }, { type }] }), ARENA_TEXT.refuse.magic, `type ${type}`);
  assert.equal(sandSpellRefusal({ effects: [{ type: 3 }, { type: 10 }] }), null, 'fighting magic stands');
  assert.equal(sandSpellRefusal(null), null);
  const P = { activeEffects: [...SAND_BARRED_KINDS.map((kind) => ({ kind, roundsRemaining: 9 })), { kind: 'shield', roundsRemaining: 9 }] };
  assert.equal(stripSandBarred(P), SAND_BARRED_KINDS.length);
  assert.deepEqual(P.activeEffects.map((e) => e.kind), ['shield'], 'a Shield stays');
  assert.match(rd('src/scenes/hostMagic.js'), /why = spellRefusal\?\.\(sp\) \?\? sandSpellRefusal\(sp\);/, 'every host\'s one cast engine asks');
  const ab = rd('src/scenes/arenaBouts.js');
  assert.match(ab, /if \(boutLive\(C\.b\)\) stripSandBarred\(P\);/, 'the floor\'s frame takes them off');
  assert.match(ab, /if \(C\.you && P && boutLive\(C\.b\)\) stripSandBarred\(P\);/, 'and the relay\'s');
});

test('AUDIT ARENA-LADDER L6: A CEILING OVER THE SAND - my bout\'s ring holds the body under SAND_CEILING_M, its rise taken away; over any honest jump; a ring that names none (the duel\'s) is never touched in height (mutants: the ceiling unread; the rise kept; the ring naming none)', () => {
  const g = 20, top = (JUMP_SPEED * (1.5 + JUMP_SPELL_MULTIPLIER + ATHLETICISM_MULTIPLIER + IMPROVED_ATHLETICISM_MULTIPLIER)) ** 2 / (2 * g);
  assert.ok(SAND_CEILING_M > top, `over the highest honest jump (${top.toFixed(2)} m)`);
  const body = (y, velY) => ({ arena: null, pos: new Float32Array([0, y, 0]), velY, _airVelX: 0, _airVelZ: 0, _putBack: PlayerMotor.prototype._putBack });
  const up = body(12, 3);
  up.arena = { centre: [0, 5, 0], radius: 14, ceilAbove: SAND_CEILING_M };
  PlayerMotor.prototype._keepInArena.call(up);
  assert.equal(up.pos[1], 5 + SAND_CEILING_M, 'held under it');
  assert.equal(up.velY, 0, 'its rise taken away');
  const low = body(6, 3);
  low.arena = up.arena;
  PlayerMotor.prototype._keepInArena.call(low);
  assert.deepEqual([low.pos[1], low.velY], [6, 3], 'under it: untouched');
  const duel = body(12, 3);
  duel.arena = { centre: [0, 5, 0], radius: 14 };
  PlayerMotor.prototype._keepInArena.call(duel);
  assert.equal(duel.pos[1], 12, 'a duel\'s ring: height never touched');
  assert.match(rd('src/scenes/arenaBouts.js'), /radius: cur\.ring \?\? RING_R, ceilAbove: SAND_CEILING_M \}/, 'my bout\'s ring names it');
});

// ── THE BOUT'S HOLES ─────────────────────────────────────────────────────────────────────────────────────

test('AUDIT ARENA-LADDER A1: the sand\'s collapse is the bout\'s fall - 1 health, a breath of fatigue, no death and no rest (mutants: the spare unread; the fatigue left at 0)', () => {
  const dc = rd('src/scenes/dungeonContext.js');
  assert.match(dc, /const sandSpare = opts\.playerSpare\?\.\(\) \?\? null;\s*if \(sandSpare\) \{ hurtEntity\(playerEntity, playerEntity\.health, \{ bypassShield: true, \.\.\.sandSpare \}\); playerEntity\.fatigue = Math\.max\(playerEntity\.fatigue \?\? 0, 1\); surfacePlayer\(\); return; \}/);
  const h = dc.indexOf('function onExhausted()');
  assert.ok(h > 0 && dc.indexOf('const sandSpare', h) < dc.indexOf('opts.csaOnPlayerDeath?.()', h) && dc.indexOf('const sandSpare', h) < dc.indexOf('advanceOwnMinutes(60)', h), 'asked before the death and the rest are acted on');
});

test('AUDIT ARENA-LADDER A2: a fighter on the sand is its bout\'s - no dispel or Wabbajack takes it, and a body gone without falling voids my bout (healed, nothing won or lost) where it was a champion beaten (mutants: the dispel unfiltered; the Wabbajack unguarded; the gone body a fall; the import a comment)', () => {
  assert.equal(inBout({ entity: { bout: { id: 'x', side: 1 } } }), true);
  assert.equal(inBout({ entity: {} }), false);
  assert.equal(inBout(null), false);
  // the streaming host imports it; the dungeon's reaches it on the lazy foe subsystem (MT-iv: never static there)
  const w = rd('src/scenes/world.js'), dc = rd('src/scenes/dungeonContext.js'), ex = rd('src/scenes/exterior.js');
  assert.match(w, /dispelNearby\(list\.map\(\(no\) => no\.ref\)\.filter\(\(f\) => !inBout\(f\)\),/);
  assert.match(w, /^(?:(?!\/\/).)*import \{[^}\n]*inBout[^}\n]*\} from '\.\.\/characters\/enemyTargets\.js';/m, 'world.js: imported in code, not in a comment');
  assert.match(dc, /dispelNearby\(list\.map\(\(no\) => no\.ref\)\.filter\(\(f\) => !foeDeps\?\.inBout\?\.\(f\)\),/);
  assert.match(dc, /arrowAimDirection, bumpAtkCount, inBout \}\] = await Promise\.all\(\[/, 'the dungeon: taken off the lazy module');
  assert.match(dc, /resetAllyTeamOnPlayerAttack, boutGate, bumpAtkCount, inBout,/, '...and published on foeDeps');
  for (const [h, s] of [['world.js', w], ['exterior.js', ex]]) assert.match(s, /if \(inBout\(f\)\) return;   \/\/ AUDIT ARENA-LADDER A2: the Wabbajack/, h);
  assert.match(dc, /if \(foeDeps\?\.inBout\?\.\(f\)\) return;   \/\/ AUDIT ARENA-LADDER A2: the Wabbajack/);
  const ab = rd('src/scenes/arenaBouts.js');
  assert.match(ab, /if \(foe\.dead\) \{\s*if \(boutLive\(C\.b\) && !boutFighter\(C\.b, fid\)\?\.out\) \{ if \(!C\.ex\) \{ voidBout\(C\); return; \} boutFell\(C\.b, fid, t\); \}/);
  assert.match(ab, /function voidBout\(C\) \{\s*deps\.say\?\.\(ARENA_TEXT\.verdict\.void\);\s*if \(C\.ladder\) \{ deps\.heal\?\.\(\); refundMine\(C\); \}\s*dismiss\(\);/);
});

test('AUDIT ARENA-LADDER A3: the player\'s tag is the driver\'s own, held live - an `out` or a `hold` written as the bout runs is the gate\'s at once; a blow of mine after I am out is made good (mutants: a copy taken at the bell; the out-striker\'s blow counted)', () => {
  const tag = { id: 'b9', side: 0 };
  setPlayerBout(tag);
  assert.deepEqual(playerBoutOf(), { id: 'b9', side: 0, out: false });
  const foe = { entity: { bout: { id: 'b9', side: 1 } } };
  assert.notEqual(boutGate(foe, { isPlayer: true }, true), false, 'in the fight: a mark');
  tag.out = true;
  assert.equal(playerBoutOf().out, true, 'the driver\'s write, read live');
  assert.equal(boutGate(foe, { isPlayer: true }, true), false, 'out: no fighter\'s mark any more');
  tag.out = false; tag.hold = true;
  assert.equal(playerBoutOf().hold, true);
  assert.match(rd('src/scenes/arenaBouts.js'), /if \(boutFighter\(C\.b, from\)\?\.out\) \{ if \(foe\?\.entity\) foe\.entity\.health = Math\.min\(foe\.entity\.maxHealth \?\? foe\.entity\.health, foe\.entity\.health \+ dmg\); return; \}/);
});

test('AUDIT ARENA-LADDER A4: my damage is the striker\'s the formula named a moment ago, never the nearest fighter facing me; a fighter is taken off the stage it stood on (mutants: the told striker unread; the host\'s stage read)', () => {
  const ab = rd('src/scenes/arenaBouts.js');
  assert.match(ab, /if \(to === YOU\) C\.hitMe = \{ from, at: t \};/);
  assert.match(ab, /const told = C\.hitMe;\s*C\.hitMe = null;\s*if \(told && lawNow\(\) - told\.at <= RESOLUTION_MS && !boutFighter\(C\.b, told\.from\)\?\.out\) return told\.from;/);
  assert.equal((ab.match(/\(C\.stage \?\? stage\)\?\.remove\?\.\(foe\)/g) ?? []).length, 4, 'all four removals');
  assert.doesNotMatch(ab, /[^?)] stage\?\.remove\?\.\(foe\)/, 'no removal off the host\'s stage alone');
});

test('AUDIT ARENA-LADDER A5: no Recall off the sand - my bout holds me as its doors do (mutants: either host\'s refusal dropped)', () => {
  for (const h of ['src/scenes/world.js', 'src/scenes/exterior.js']) assert.match(rd(h), /if \(arenaBouts\.holds\(\)\) \{ townTalk\.say\(ARENA_TEXT\.refuse\.travel\); return; \}/, h);
});

// ── ONLINE: the relay and the service ────────────────────────────────────────────────────────────────────

test('AUDIT ARENA-LADDER O1: the `in` word\'s ticket and the `atk` word\'s shape on the wire; the receipt signs `z` on a ladder bout alone (mutants: a ticket of any shape; a shape not one of the three; `z` on a players\' receipt)', async () => {
  assert.equal(ARENA_TICKET_RE.test('feedc0de00000001'), true);
  for (const z of ['FEEDC0DE00000001', 'feedc0de0000001', 'feedc0de000000011', 'zzzzzzzzzzzzzzzz']) assert.equal(validArenaIn({ k: 'in', r: 'f', tier: 0, bout: 0, z }), null, z);
  assert.deepEqual(validArenaIn({ k: 'in', r: 'f', tier: 0, bout: 0, z: 'feedc0de00000001' }), { k: 'in', r: 'f', tier: 0, bout: 0, z: 'feedc0de00000001' });
  const atk = { k: 'atk', i: 'a0', at: 5, x: 1, z: 2, tg: 'p0' };
  assert.deepEqual(validArenaOut({ ...atk, s: 'slam', yw: 1.2, ox: 3, oz: 4 }), { ...atk, s: 'slam', yw: 1.2, ox: 3, oz: 4 });
  assert.equal(validArenaOut({ ...atk, s: 'kick', yw: 1, ox: 3, oz: 4 }), null);
  assert.equal(validArenaOut({ ...atk, s: 'slam', ox: 3, oz: 4 }), null, 'a shape with no facing');
  assert.deepEqual(validArenaOut(atk), atk, 'a plain blow as it was');
  const kp = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const r = await mintArenaReceipt({ a: 'l', j: '00000000000000c1', s: 'acct-x', q: 0, u: 1, r: 0, h: 'fall', z: 'feedc0de00000001' }, kp.privateKey, { subtle, nowS: 1_800_000_000 });
  assert.equal(readArenaReceipt(r).z, 'feedc0de00000001', 'signed in');
  assert.equal(arenaReceiptValid({ a: 'l', j: '00000000000000c1', s: 'acct-x', q: 0, u: 1, r: 0, h: 'fall', z: 'nope', i: 1, e: 2 }), false);
  assert.equal(arenaReceiptValid({ a: 'p', j: '00000000000000c1', f: ['acct-a', 'acct-b'], r: 0, h: 'fall', z: 'feedc0de00000001', i: 1, e: 2 }), false, 'never on a players\' receipt');
  // the relay's own: a bout's receipt carries its fighter's ticket
  const { st } = relayLadder(0, 0);
  st.b.result = { side: 1, how: 'fall', winners: ['a0'], losers: ['p0'], judges: null };
  stepBout(st, 2_000_000, () => 0.9);
  assert.equal(st.owed[0].z, 'feedc0de00000009');
});

test('AUDIT ARENA-LADDER O1b: the relay opens a ladder bout only for a ticket - one without is refused, said (mutants: the ticket unrequired)', async () => {
  const W = fakeRooms();
  const R = W.room(arenaBoutRoom('00000000000000ad'));
  const p = R.connect();
  const C = ARENA_FLOOR_CENTRE;
  await R.hello(p, 'fight-x', { x: C[0], y: 0.3, z: C[2], yaw: 0, pitch: 0, mv: 0 }, { name: 'Ceryn', kind: 'linked', tokenSub: 'acct-x', charLevel: 5 });
  await R.raw(p, JSON.stringify({ t: 'arena', k: 'in', r: 'f', tier: 0, bout: 0, lv: 5 }));
  const no = p.sent.filter((m) => m.t === 'arena' && m.k === 'no').at(-1);
  assert.equal(no?.m, 'no ticket');
  assert.equal(ARENA_NO_TEXT['no ticket'], ARENA_TEXT.online.ticketFail);
  assert.equal(await R.room._boutOf?.() ?? null, null, 'no bout opened');
});

const T0 = Math.floor(Date.now() / 1000);
let _j = 0;
const jid = () => (0xc000 + ++_j).toString(16).padStart(16, '0');
const ticketReceipt = (S, who, tier, step, won, z, h = 'fall') => mintArenaReceipt({ a: 'l', j: jid(), s: who.id, q: tier, u: step, r: won ? 1 : 0, h, z }, S.gatePriv, { subtle, nowS: T0 });
const attempt = (S, who, tier, bout) => S.call('/v1/arena/attempt', { tier, bout }, who.secret);
const claim = (S, who, receipt) => S.call('/v1/arena/claim', { receipt }, who.secret);
/** Fight and claim the account's next bout - an attempt, its receipt carried. */
async function fight(S, who, won, h = 'fall') {
  const board = await S.call('/v1/arena/board', {}, who.secret);
  const L = board.body.me.ladder;
  const next = L.tier * 4 + (L.champs?.[L.tier] ? 4 : L.won);
  const tier = Math.floor(next / 4), bout = L.won;
  const a = await attempt(S, who, tier, bout);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  return claim(S, who, await ticketReceipt(S, who, tier, bout, won, a.body.ticket, h));
}

test('AUDIT ARENA-LADDER O2: THE SERVICE\'S ATTEMPTS - a ticket for the account\'s next bout alone; a loss claimed breaks the tier\'s run; an attempt left open is FORFEIT at the next (a loss, its run broken), and its win carried after is refused; another account\'s ticket takes nothing (mutants: the order unchecked; the run kept; the forfeit unwritten; the ticket\'s owner unread)', async () => {
  const S = await standService();
  const A = await S.registered('Ilsa'), B = await S.registered('Orrin');
  assert.equal((await attempt(S, A, 0, 1)).status, 409, 'not my next bout');
  assert.equal((await attempt(S, A, 0, 1)).body.error, 'order');
  assert.equal((await fight(S, A, true)).body.recorded, true);
  assert.equal((await fight(S, A, true)).body.recorded, true);
  let me = (await S.call('/v1/arena/board', {}, A.secret)).body.me.ladder;
  assert.deepEqual([me.tier, me.won], [0, 2]);
  // a loss claimed: the run broken
  const lost = await fight(S, A, false);
  assert.equal(lost.body.recorded, true);
  me = (await S.call('/v1/arena/board', {}, A.secret)).body.me.ladder;
  assert.deepEqual([me.tier, me.won], [0, 0], 'back to the first bout');
  // two won again, then an attempt never claimed: forfeit at the next ask
  await fight(S, A, true); await fight(S, A, true);
  const open = await attempt(S, A, 0, 2);
  assert.equal(open.status, 200);
  const next = await attempt(S, A, 0, 0);
  assert.equal(next.status, 200, 'the forfeit broke the run: the first bout is next');
  assert.equal(next.body.forfeits, 1);
  const late = await claim(S, A, await ticketReceipt(S, A, 0, 2, true, open.body.ticket));
  assert.deepEqual([late.body.recorded, late.body.why], [false, 'forfeit'], 'its win carried after: refused');
  // another account's ticket
  const mine = await attempt(S, B, 0, 0);
  const stolen = await claim(S, A, await ticketReceipt(S, A, 0, 0, true, mine.body.ticket));
  assert.deepEqual([stolen.body.recorded, stolen.body.why], [false, 'reused']);
  // the record keeps every bout: two losses (one forfeit), four wins out of the climb's two... and the board's reach
  const r = S.env?.DB?._raw ?? null;
  if (r) {
    const rows = r.prepare('SELECT won, voided, how FROM arena_pve WHERE player = ? ORDER BY at, rowid').all(A.id);
    assert.equal(rows.filter((x) => x.won === 0).length, 2);
    assert.ok(rows.some((x) => x.how === 'forfeit'));
    assert.equal(rows.filter((x) => x.won === 1 && x.voided === 1).length, 4, 'the broken runs\' wins kept, out of the climb');
  }
});

test('AUDIT ARENA-LADDER O3: a champion beaten stays beaten - a loss in the next tier breaks that tier\'s run alone (mutants: the champion\'s step voided)', async () => {
  const S = await standService();
  const A = await S.registered('Wenna');
  for (let i = 0; i < 4; i++) assert.equal((await fight(S, A, true)).body.recorded, true);
  let me = (await S.call('/v1/arena/board', {}, A.secret)).body.me.ladder;
  assert.deepEqual([me.tier, me.won, me.champs[0]], [1, 0, true]);
  await fight(S, A, true);
  await fight(S, A, false, 'judges');
  me = (await S.call('/v1/arena/board', {}, A.secret)).body.me.ladder;
  assert.deepEqual([me.tier, me.won, me.champs[0]], [1, 0, true], 'the Pit\'s title kept');
  assert.equal(ladderKey(1, 0), 4);
});

test('AUDIT ARENA-LADDER O3b: the whole climb on tickets - forty attempts, the Grand Champion said on its claim (mutants: the ticketed claim\'s grand unsaid)', async () => {
  const S = await standService();
  const A = await S.registered('Brisa');
  let last = null;
  for (let i = 0; i < 40; i++) { last = await fight(S, A, true); assert.equal(last.body.recorded, true, `step ${i}`); }
  assert.equal(last.body.grand, true, 'the Grand Champion');
  assert.equal((await S.call('/v1/arena/board', {}, A.secret)).body.me.ladder.grand, true);
  assert.equal((await attempt(S, A, 9, 3)).status, 409, 'nothing past the summit');
});

test('AUDIT ARENA-LADDER O4: THE LAUREL TAKES TEN RATED BOUTS AGAINST FIVE ACCOUNTS, and a pair\'s rated bouts are capped a season (mutants: the foes unread; the old three bouts; the season cap off)', () => {
  assert.deepEqual([ARENA_CHAMPION_MIN_BOUTS, ARENA_CHAMPION_MIN_FOES, ARENA_PAIR_SEASON_MAX], [10, 5, 10]);
  assert.ok(ARENA_PAIR_SEASON_MAX >= ARENA_PAIR_DAY_MAX);
  assert.equal(laurelWorthy({ bouts: 10, foes: 5 }), true);
  assert.equal(laurelWorthy({ bouts: 30, foes: 4 }), false, 'thirty bouts against four second accounts');
  assert.equal(laurelWorthy({ bouts: 9, foes: 9 }), false);
  assert.equal(laurelOfBoard([{ player: 'a', bouts: 3, foes: 1 }, { player: 'b', bouts: 20, foes: 8 }]), null, 'the #1 short of it holds the top, and nobody wears the laurel over them');
  assert.equal(laurelOfBoard([{ player: 'b', bouts: 20, foes: 8 }]), 'b');
  assert.match(rd('server-account/src/arena.js'), /const rated = Number\(pair\?\.n \?\? 0\) < ARENA_PAIR_DAY_MAX && Number\(pairSeason\?\.n \?\? 0\) < ARENA_PAIR_SEASON_MAX;/);
});

test('AUDIT ARENA-LADDER O5: the client asks its ticket - every receipt carried first, the `in` waiting for it; no ticket and the bout is let go, said (mutants: the claims not flushed first; the `in` sent without the ticket; the failure silent)', async () => {
  const order = [], said = [], boutSent = [];
  const session = { status: 'open', arenaOk: true, room: 'world:1,1', sendArena: (w) => { boutSent.push(w); return true; } };
  const board = { me: { ladder: arenaLadderOf([]) } };
  const entered = [];
  const mk = (attemptOk) => createArenaOnline({
    now: () => 0, session: () => session, say: (l) => said.push(l), makeHall: () => ({ status: 'open', join() {}, leave() {}, sendArena: () => true }),
    bouts: { ask() {}, relayWord: () => true, dismiss() {}, holds: () => false, relay: () => null },
    account: { board: async () => ({ ok: true, data: board }), claim: async () => { order.push('claim'); return { ok: true, data: {} }; },
      attempt: async () => { order.push('attempt'); return attemptOk ? { ok: true, data: { ticket: 'feedc0de0000000a' } } : { ok: false, data: { error: 'busy' } }; }, me: () => null },
    enterFloor: (k, o) => { entered.push([k, o]); return true; }, level: () => 4, maxHealth: () => 60,
  });
  const A = mk(true);
  A.model();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(A.fightLadder().ok, true);
  session.room = arenaBoutRoom(entered.at(-1)[1]);
  A.tick();
  assert.equal(boutSent.length, 0, 'the `in` waits for its ticket');
  await new Promise((r) => setTimeout(r, 0));
  A.tick();
  assert.equal(boutSent.at(-1)?.z, 'feedc0de0000000a');
  assert.equal(order.at(-1), 'attempt');
  assert.match(rd('src/scenes/arenaOnline.js'), /try \{ await claims\.flush\(\); \} catch \{[^}]*\}\s*const r = await Promise\.resolve\(deps\.account\.attempt\?\.\(b\.tier, b\.bout\)\)/, 'the receipts carried before the ask');
  const B = mk(false);
  B.model();
  await new Promise((r) => setTimeout(r, 0));
  boutSent.length = 0;
  assert.equal(B.fightLadder().ok, true);
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(said.includes(ARENA_TEXT.online.ticketFail), 'said');
  B.tick();
  assert.equal(boutSent.length, 0, 'and let go: no `in`');
});
