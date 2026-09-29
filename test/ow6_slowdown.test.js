// OW6 - THE JOURNEY SLOWS AS ENEMIES CLOSE (2026-09-29, the player: "If a player is traveling very fast, they should slow
// if enemies become close"). The law (systems/travelThreat.js: an enemy's reach along the way, the cap that gives the
// traveller THREAT_WARN_S of real time before it, the spinner's ladder); a journey flown frame by frame at x40 straight at
// a band, with and without it; and the host's governor lifted out of scenes/world.js and RUN on both skins - the lower of
// the ground's cap and the enemies' holds, the panel told why, a line said once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THREAT_WARN_S, metresToReach, threatStep, threatCap } from '../src/systems/travelThreat.js';
import { createLoadGovernor } from '../src/systems/travelGovernor.js';
import { TRAVEL_HELD_TEXT, TRAVEL_HELD_WHY } from '../src/ui/enhancedTravelControl.js';
import { foeHostile, areEnemiesNearby } from '../src/systems/encounters.js';
import { TRAVEL_VIEW_TEXT, travelWalkRate, TV_MOVE_ACTIONS } from '../src/scenes/travelView.js';

const NORTH = { x: 0, z: 1 };

test('OW6 law: AN ENEMY\'S REACH ALONG THE WAY - dead ahead, the distance to its edge; beside the way, where the way first comes within it; a way that passes it by, or it behind, never; inside it, held while the way goes deeper and free as it leads out; no way, the straight distance (mutants: the root\'s sign, behind counted, inside always held)', () => {
  assert.equal(metresToReach(0, 1000, 300, NORTH), 700, 'dead ahead: its edge, 700 m on');
  const beside = metresToReach(200, 1000, 300, NORTH);   // the way enters the circle where (200, z) is 300 from it
  assert.ok(Math.abs(beside - (1000 - Math.sqrt(300 * 300 - 200 * 200))) < 1e-9, `beside the way: ${beside.toFixed(1)} m`);
  assert.equal(metresToReach(400, 1000, 300, NORTH), Infinity, 'the way passes 400 m off a 300 m reach: never');
  assert.equal(metresToReach(0, -1000, 300, NORTH), Infinity, 'behind: never');
  assert.equal(metresToReach(0, 100, 300, NORTH), 0, 'inside it, the way deeper: held');
  assert.equal(metresToReach(0, -100, 300, NORTH), Infinity, 'inside it, the way leading out: free');
  assert.equal(metresToReach(300, 400, 100, null), 400, 'no way: the straight distance to its edge');
  assert.equal(metresToReach(30, 40, 100, null), 0);
});

test('OW6 law: THE CAP - the highest rate that leaves THREAT_WARN_S of real time to the nearest reach, stepped down the spinner\'s own ladder, never under walking pace; a chaser from any side at its own pace too; nothing near, no cap (mutants: the warning, the ladder, the chaser\'s pace dropped, the worst threat not the one kept)', () => {
  assert.equal(THREAT_WARN_S, 2);   // OW6-LATE: was 5 - the player: it slowed "waaaay to early"
  assert.deepEqual([0.2, 1.7, 3.9, 4.99, 5, 9.9, 10, 47, 100].map(threatStep), [1, 1, 3, 4, 5, 5, 10, 45, 100]);
  assert.deepEqual(threatCap({ threats: [], heading: NORTH, speedMps: 16 }), { cap: Infinity, threat: null, metres: Infinity });
  const band = { dx: 0, dz: 2000, reach: 320 };
  assert.equal(threatCap({ threats: [band], heading: NORTH, speedMps: 0 }).cap, Infinity, 'standing: nothing to hold');
  // a rider (16 m/s) 1680 m from a band's sight: 1680 / (2 x 16) = 52.5 -> x50
  const r = threatCap({ threats: [band], heading: NORTH, speedMps: 16 });
  assert.deepEqual([r.cap, r.metres, r.threat], [50, 1680, band]);
  assert.equal(threatCap({ threats: [band], heading: NORTH, speedMps: 4 }).cap, 210, 'on foot the same band asks for less');
  assert.equal(threatCap({ threats: [{ dx: 900, dz: 2000, reach: 320 }], heading: NORTH, speedMps: 16 }).cap, Infinity, 'one the way passes by: no cap');
  // a chaser 400 m BEHIND, closing at 5.2 m/s on a walker at 3: (400 - 30) / (2 x 8.2) = 22.6 -> x20
  const chaser = { dx: 0, dz: -400, reach: 30, chasing: true, mps: 5.2 };
  assert.equal(threatCap({ threats: [chaser], heading: NORTH, speedMps: 3 }).cap, 20, 'a chaser from behind still holds');
  assert.equal(threatCap({ threats: [{ ...chaser, mps: 0 }], heading: NORTH, speedMps: 3 }).cap, 60, 'its own pace counted');
  // the worst of several is the one kept
  const near = { dx: 50, dz: 150, reach: 60 };
  const both = threatCap({ threats: [band, near, { dx: 0, dz: -5000, reach: 320 }], heading: NORTH, speedMps: 16 });
  assert.equal(both.threat, near);
  assert.equal(both.cap, 3, 'a camp\'s foe a hundred-odd metres ahead: 117 m to its sight / (2 x 16) -> x3');
});

/** A journey flown frame by frame (30 fps) straight at a band `startM` ahead, at the spinner's `asked`: the real seconds
 *  taken over the last `lastM` metres before its sight, and the rate at the frame the traveller entered it. */
const fly = ({ asked, speed, startM, sight = 320, capped, lastM = 500 }) => {
  let z = 0, t = 0, tLast = null, rateAtEntry = null;
  const bandZ = startM;
  for (let frame = 0; frame < 100000; frame++) {
    const d = bandZ - z;
    if (d - sight <= lastM && tLast == null) tLast = t;
    if (d <= sight) { rateAtEntry = rateAtEntry ?? (capped ? Math.min(asked, threatCap({ threats: [{ dx: 0, dz: d, reach: sight }], heading: NORTH, speedMps: speed }).cap) : asked); break; }
    const cap = capped ? threatCap({ threats: [{ dx: 0, dz: d, reach: sight }], heading: NORTH, speedMps: speed }).cap : Infinity;
    const rate = Math.min(asked, cap);
    z += speed * rate / 30; t += 1 / 30;
  }
  return { seconds: t - tLast, rateAtEntry };
};

test('OW6: A RIDER AT x40 STRAIGHT AT A BAND - with the cap it comes into the band\'s sight at walking pace after seconds of warning; without it, the last half-kilometre went in under a second at x40 (the "run thru them" of AUDIT OW5b, before it could even begin)', () => {
  const before = fly({ asked: 40, speed: 16, startM: 5000, capped: false });
  assert.equal(before.rateAtEntry, 40);
  assert.ok(before.seconds < 1, `uncapped: the last 500 m in ${before.seconds.toFixed(2)} s`);
  const after = fly({ asked: 40, speed: 16, startM: 5000, capped: true });
  assert.equal(after.rateAtEntry, 1, 'into its sight at walking pace');
  assert.ok(after.seconds >= THREAT_WARN_S, `capped: the last 500 m in ${after.seconds.toFixed(1)} s`);
  const foot = fly({ asked: 40, speed: 3.5, startM: 3000, capped: true });
  assert.equal(foot.rateAtEntry, 1, 'on foot too');
});

test('OW6: the panel says why the clock is held - the land loading, an enemy near, the view down (it said "while the land loads" for all three); the hostility gate is the sweep\'s own, one home', () => {
  assert.equal(TRAVEL_HELD_TEXT(20, 40), 'Held to ×20 of ×40 while the land loads');
  assert.equal(TRAVEL_HELD_TEXT(5, 40, 'foes'), 'Held to ×5 of ×40 with enemies near');
  assert.equal(TRAVEL_HELD_TEXT(1, 40, 'ground'), 'Held to ×1 of ×40 until the Overworld rises');   // AUDIT OW5 G1's word
  assert.equal(TRAVEL_HELD_TEXT(1, 40, 'junk'), `Held to ×1 of ×40 ${TRAVEL_HELD_WHY.load}`);
  assert.equal(TRAVEL_VIEW_TEXT.enemiesSlow, 'Enemies near - you slow your pace.');
  const foe = (o = {}) => ({ dead: false, ai: { isHostile: true, detected: true, inSight: true }, entity: { mobileEnemy: { team: 'Orcs' } }, ...o });
  assert.equal(foeHostile(foe()), true);
  assert.equal(foeHostile(foe({ dead: true })), false);
  assert.equal(foeHostile(foe({ ai: { isHostile: false } })), false, 'pacified');
  assert.equal(foeHostile(null), false);
  assert.equal(areEnemiesNearby([foe()]), true, 'the sweep reads it');
  assert.equal(areEnemiesNearby([foe({ ai: { isHostile: false, detected: true, inSight: true } })]), false);
});

// ── THE HOST'S GOVERNOR, RUN ─────────────────────────────────────────────────────────────────────────────────────────
const W = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const cut = (name) => {
  const m = new RegExp(`\\n {2}function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n {2}\\}\\n`).exec(W);
  assert.ok(m, `${name} lifted`);
  return m[0];
};
const constLine = (name) => { const m = new RegExp(`\\n {2}const ${name} = [^\\n]*\\n`).exec(W); assert.ok(m, `${name} lifted`); return m[0]; };

const governorHost = (over = {}) => {
  const d = {
    journey: true, up: true, owns: true, asked: 40, unbuilt: 0, speed: 16, driveYaw: 0,
    bands: [], spent: new Set(), chases: new Map(), foes: [], raiders: [], raidChase: new Map(), sea: false,
    camps: true, prevent: false, scale: 40, said: [], now: 0,
    ...over,
  };
  const scope = {
    travelControlUI: { get isShowing() { return d.journey; }, get timeAcceleration() { return d.spinner ?? 0; }, accelerationLimit: () => 100 }, travelOptions: { state: { get autopilot() { return d.journey ? {} : null; } } },
    travelView: { get active() { return d.up; }, get state() { return d.up ? 'up' : 'off'; } }, tvOwnsJourneys: () => d.owns,
    worldTimeScale: () => d.scale, setWorldTimeScale: (n) => { d.scale = n; },
    travelGovernor: createLoadGovernor({ max: 100 }), state: { terrainDistance: 3, localFromWorld: (x, z) => [x, z] },
    playerTravelPixel: () => ({ x: 100, y: 100 }), tvGroundGenNow: () => 1, _tvUnbuilt: { gen: -1, x: NaN, y: NaN, r: -1, n: 0 },
    unbuiltAround: () => d.unbuilt, built: new Set(),
    player: { feetAt: () => [0, 0, 0], get speed() { return d.speed; }, isPlayerSwimming: false },
    getPref: () => d.camps, playerEntity: { get preventEnemySpawns() { return d.prevent; } },
    bandNowMs: () => 0, bandSight: () => 320, tvBandSeen: { night: false }, travelViewBands: () => d.bands,
    _bandSpent: d.spent, _bandChase: d.chases, bandMake: () => ({ mobileTypes: [1], name: 'Orc' }), bandPlace: (b) => b.at,
    BAND_CONTACT_M: 30, BAND_CHASE_MPS: 5.2, warmAshesOn: () => d.sea, csaOn: () => d.sea, raidQuarry: () => d.sea,
    raiderSight: () => 1000, isNight: () => false, minuteNow: () => 0, travelViewRaiders: () => d.raiders,
    tvRaid: { spent: new Set(), chase: d.raidChase }, RAIDER_CONTACT_M: 60, RAIDER_CHASE_MPS: 4.2, seaRaidPeerChase: (id) => d.peerRaid?.[id] ?? null,
    exteriorFoes: { get foes() { return d.foes; } }, foeHostile, SIGHT_RADIUS: 102.4,
    _tvAttack: d.attack ?? null, foeCampKey: (f) => f?.camp ?? null,   // OW-ATTACK: the enemy I go to fight, if any
    get _travelDrive() { return d.driveYaw == null ? null : { yaw: d.driveYaw }; }, threatCap,
    tvSay: (t) => d.said.push(t), TRAVEL_VIEW_TEXT, performance: { now: () => d.now },   // AUDIT OW5 G2: the view's own lines through tvSay
    // TV-WASD (main): the keys' travel beside the journey - none held unless a test says so
    travelWalkRate, TV_MOVE_ACTIONS, held: (keys, a) => keys.has(a), keys: d.keys ?? new Set(), walkMode: true, playerSpawned: true,
    csaBoatUnderMe: () => null, gamePaused: () => false, csaHoldsTimeScale: () => d.helm ?? false, resetTimeScale: () => { d.scale = 1; },
    // THE MERGE (NAV-H, NAV-R): the sea fight - none unless a test stands one (its hostile ships, its raiders as ships)
    naval: d.naval ?? null, navalRaidersOn: () => !!d.navalRaiders,
  };
  const names = Object.keys(scope);
  const body = `
    let { ${names.filter((n) => n !== '_travelDrive').join(', ')} } = s;
    let tvHeld = null, tvHeldWhy = null, tvWalking = 0, _tvWalkYaw = d.walkYaw ?? null;
    const travelAsked = d.asked;
    ${constLine('JOURNEY_SLOW_SAY_MS')}
    let _slowWas = null, _slowSaidAt = -Infinity;
    ${cut('journeyThreats')}${cut('journeyThreatCap')}${cut('journeySlowSaid')}${cut('travelViewGovern')}
    return { govern: travelViewGovern, held: () => [tvHeld, tvHeldWhy] };`.replace(/\b_travelDrive\b/g, 's._travelDrive');
  const h = new Function('s', 'd', body)(scope, d);
  return { d, ...h };
};

test('OW6 host run: UNDER THE VIEW, AN ENEMY AHEAD HOLDS THE JOURNEY - a band a kilometre and more down the way holds the rider under the spinner, the panel told it is the enemies, the line said once; the ground\'s cap and the enemies\' the lower holds; a spent band, the camps off, the spawns held, or a band beside the way hold nothing (mutants: the enemies\' cap never met, the spent counted, the reason wrong)', () => {
  const g = governorHost({ bands: [{ id: 'b1', at: { x: 0, z: 1000 } }] });
  g.govern(0.033);
  assert.equal(g.d.scale, 20, 'held to x20 of x40 (680 m to its sight at 16 m/s: 680 / (2 x 16) = 21.25) - OW6-LATE: a band 2 km off holds nothing now');
  assert.deepEqual(g.held(), [20, 'foes']);
  assert.deepEqual(g.d.said, [TRAVEL_VIEW_TEXT.enemiesSlow], 'said as it began');
  g.govern(0.033); g.govern(0.033);
  assert.equal(g.d.said.length, 1, 'once, not every frame');
  // the ground's cap, lower still, is the reason
  const both = governorHost({ bands: [{ id: 'b1', at: { x: 0, z: 1000 } }], unbuilt: 3 });
  for (let i = 0; i < 20; i++) both.govern(0.05);   // a second of holes halves the ground's ceiling below the enemies'
  assert.equal(both.held()[1], 'load');
  assert.ok(both.d.scale <= 20);
  for (const quiet of [{ spent: new Set(['b1']) }, { camps: false }, { prevent: true }, { bands: [{ id: 'b1', at: { x: 900, z: 1000 } }] }]) {
    const q = governorHost({ bands: [{ id: 'b1', at: { x: 0, z: 1000 } }], ...quiet });
    q.govern(0.033);
    assert.deepEqual([q.d.scale, ...q.held()], [40, null, null], `nothing held: ${JSON.stringify(Object.keys(quiet))}`);
  }
});

test('OW6 host run: a CHASER holds from any side, at its own pace; at sea a raider\'s lookout and a raider\'s chase hold a crossing; on land no raider is asked of (mutants: the chase uncounted, the sea\'s arm unwired)', () => {
  const chase = governorHost({ chases: new Map([['b2', { pos: { x: 0, z: -300 } }]]) });
  chase.govern(0.033);
  assert.deepEqual(chase.held(), [5, 'foes'], 'a band closing from behind: (300 - 30) / (2 x (16 + 5.2)) = 6.4 - x5');
  const sea = governorHost({ sea: true, raiders: [{ id: 'r1', x: 0, z: 2000 }] });
  sea.govern(0.033);
  assert.deepEqual(sea.held(), [30, 'foes'], 'a raider 2000 m ahead, its lookout 1000 m: (2000 - 1000) / (2 x 16) = 31.25 - x30 of x40');
  // OW6: a raider a peer's chase holds is where they say it sails - here 600 m nearer: (1400 - 1000) / (2 x 16) = 12.5 - x10
  const held = governorHost({ sea: true, raiders: [{ id: 'r1', x: 0, z: 2000 }], peerRaid: { r1: { x: 0, z: 1400 } } });
  held.govern(0.033);
  assert.deepEqual(held.held(), [10, 'foes'], 'a peer\'s chase: where it runs, not where it would wander');
  const land = governorHost({ sea: false, raiders: [{ id: 'r1', x: 0, z: 2000 }] });
  land.govern(0.033);
  assert.deepEqual(land.held(), [null, null], 'ashore, no raider');
});

test('THE MERGE (NAV-H x OW6) host run: AT SEA A HOSTILE SHIP HOLDS THE CROSSING before her ring - where she is an enemy nearby and the journey stops (navalHost.js HOSTILE_NEAR_M), or her lookout past it - on either skin, and one coming for me from any side at her pace; a raider stood as a ship holds as the ship, never her seeded sail beside it; no hostile ship, nothing held (mutants: the sea unread by the journey, her closing unsaid, a raider ship counted twice)', () => {
  const sea = (threats, more = {}) => ({ threats: () => threats, raiderShipOf: () => null, ...more });
  // OW6-LATE (main): THREAT_WARN_S 2 - each distance below re-derived at the 2 s warning
  const ahead = [{ pos: [0, 0, 1600], reach: 750, chasing: false, mps: 6 }];
  const view = governorHost({ naval: sea(ahead) });
  view.govern(0.033);
  assert.deepEqual(view.held(), [25, 'foes'], 'a ship 1600 m ahead, her lookout 750 m: (1600 - 750) / (2 x 16) = 26.6 - x25 of x40');
  const classic = governorHost({ up: false, owns: false, naval: sea(ahead) });
  classic.govern(0.033);
  assert.deepEqual(classic.held(), [25, 'foes'], 'the classic skin the same');
  const behind = governorHost({ naval: sea([{ pos: [0, 0, -1500], reach: 700, chasing: true, mps: 8 }]) });
  behind.govern(0.033);
  assert.deepEqual(behind.held(), [15, 'foes'], 'coming for me from behind: (1500 - 700) / (2 x (16 + 8)) = 16.7 - x15');
  const raider = governorHost({ sea: true, navalRaiders: true, raiders: [{ id: 'r1', seed: 7, x: 0, z: 1000 }],
    naval: sea([{ pos: [0, 0, 2000], reach: 1000, chasing: false, mps: 4.6 }], { raiderShipOf: (seed) => (seed === 7 ? { pos: [0, 0, 2000], chase: false } : null) }) });
  raider.govern(0.033);
  assert.deepEqual(raider.held(), [30, 'foes'], 'the ship where she sails, (2000 - 1000) / (2 x 16) = 31.25 - x30, never her seeded sail at the lookout\'s edge');
  const none = governorHost({ naval: sea([]) });
  none.govern(0.033);
  assert.deepEqual(none.held(), [null, null], 'no hostile ship: nothing held');
});

test('OW6 host run: ON THE CLASSIC SKIN (no view), A FOE STANDING AHEAD HOLDS THE JOURNEY and nothing near hands the mod\'s ask back whole; a friend, a pacified foe or the dead hold nothing; the Overworld\'s journey with its view down says so, not "the land loads"; no journey, nothing held (mutants: the classic skin ungoverned, the ask not handed back)', () => {
  const foe = (o = {}) => ({ dead: false, ai: { isHostile: true, feet: [0, 0, 300], sightRadius: 60, ...o.ai }, entity: {}, ...o, ...(o.ai ? { ai: { isHostile: true, feet: [0, 0, 300], sightRadius: 60, ...o.ai } } : {}) });
  const g = governorHost({ up: false, owns: false, speed: 4, foes: [foe()] });
  g.govern(0.033);
  assert.deepEqual([g.d.scale, ...g.held()], [30, 30, 'foes'], 'a camp\'s foe 240 m from its sight at 4 m/s: 240 / (2 x 4) = 30 - x30 of x40');
  assert.equal(g.d.said.length, 1);
  g.d.foes.length = 0;
  g.govern(0.033);
  assert.deepEqual([g.d.scale, ...g.held()], [40, null, null], 'nothing near: the ask back whole');
  for (const quiet of [foe({ dead: true }), foe({ ai: { isHostile: false } })]) {
    const q = governorHost({ up: false, owns: false, speed: 4, foes: [quiet] });
    q.govern(0.033);
    assert.deepEqual(q.held(), [null, null]);
  }
  const helm = governorHost({ up: false, owns: false, speed: 4, foes: [foe()], helm: true, scale: 3 });
  helm.govern(0.033);
  assert.deepEqual([helm.d.scale, ...helm.held()], [3, null, null], 'the helm\'s own time step holds the clock: left to it (AUDIT OW5 G5\'s law)');
  const down = governorHost({ up: false, owns: true, foes: [foe()] });
  down.govern(0.033);
  assert.deepEqual([down.d.scale, ...down.held()], [1, 1, 'ground']);   // AUDIT OW5 G1's word
  const none = governorHost({ journey: false, foes: [foe()] });
  none.govern(0.033);
  assert.deepEqual(none.held(), [null, null]);
});

test('OW6 x TV-WASD host run: THE KEYS\' TRAVEL SLOWS FOR ENEMIES TOO - held at the spinner\'s x40 under the view, a band ahead along the way the keys last moved holds it (the reason the enemies), one behind holds nothing, and the keys let go let the hold go (mutants: the keys uncapped, their way unread)', () => {
  const keys = () => new Set([TV_MOVE_ACTIONS[0]]);
  const band = [{ id: 'b1', at: { x: 0, z: 1000 } }];
  const ahead = governorHost({ journey: false, keys: keys(), spinner: 40, driveYaw: null, walkYaw: 0, bands: band });
  ahead.govern(0.033);
  assert.deepEqual([ahead.d.scale, ...ahead.held()], [20, 20, 'foes'], 'x20 of x40: (1000 - 320) / (2 x 16) = 21.25, down the ladder');
  assert.deepEqual(ahead.d.said, [TRAVEL_VIEW_TEXT.enemiesSlow], 'and said, as a journey\'s is');
  const behind = governorHost({ journey: false, keys: keys(), spinner: 40, driveYaw: null, walkYaw: Math.PI, bands: band });
  behind.govern(0.033);
  assert.deepEqual([behind.d.scale, ...behind.held()], [40, null, null], 'walking away from it: the keys\' own speed');
  ahead.d.keys.clear();
  ahead.govern(0.033);
  assert.deepEqual([ahead.d.scale, ...ahead.held()], [1, null, null], 'the keys let go: walking pace, nothing held');
});

test('OW-ATTACK host run: THE ENEMY I GO TO FIGHT HOLDS NOTHING - an attacked band (and its chase) and every member of an attacked camp leave the clock alone; any other enemy still holds it', () => {
  // a band ahead holds the journey (x20 of x40, as above)...
  const band = [{ id: 'b1', at: { x: 0, z: 1000 } }];
  const held = governorHost({ bands: band });
  held.govern(0.033);
  assert.deepEqual(held.held(), [20, 'foes']);
  // ...attacked, it holds nothing: the journey runs at the spinner's x40 straight at it
  const at = governorHost({ bands: band, attack: { kind: 'band', id: 'b1' } });
  at.govern(0.033);
  assert.deepEqual([at.d.scale, ...at.held()], [40, null, null], 'the attacked band lets the clock go');
  // its chase too
  const chase = governorHost({ chases: new Map([['b1', { band: { id: 'b1' }, pos: { x: 0, z: -300 } }]]), attack: { kind: 'band', id: 'b1' } });
  chase.govern(0.033);
  assert.deepEqual(chase.held(), [null, null], 'nor its chase');
  // another band still holds
  const other = governorHost({ bands: [...band, { id: 'b2', at: { x: 0, z: 1000 } }], attack: { kind: 'band', id: 'b1' } });
  other.govern(0.033);
  assert.deepEqual(other.held(), [20, 'foes'], 'any other enemy still holds');
  // a camp: every member of the attacked one lets go, a foe of another still holds
  const foe = (camp) => ({ dead: false, camp, ai: { isHostile: true, feet: [0, 0, 300], sightRadius: 60 }, entity: {} });
  const campAt = governorHost({ up: false, owns: false, speed: 4, foes: [foe('me:7'), foe('me:7')], attack: { kind: 'camp', id: 'me:7' } });
  campAt.govern(0.033);
  assert.deepEqual(campAt.held(), [null, null], 'the attacked camp, every member');
  const campOther = governorHost({ up: false, owns: false, speed: 4, foes: [foe('me:7'), foe('me:9')], attack: { kind: 'camp', id: 'me:7' } });
  campOther.govern(0.033);
  assert.deepEqual(campOther.held()[1], 'foes', 'another camp\'s foe still holds');
});

test('OW6 host wiring: the governor runs before the frame reads its scale, the panel is handed the reason, the enemies\' cap is taken on both skins', () => {
  assert.match(W, /travelViewGovern\(dt\);[^\n]*\n\s*const travelScale = worldTimeScale\(\);/);
  assert.match(W, /heldWhy: tvHeldWhy,/);
  // since the merge with main: every fast travel the governor runs - a journey, or TV-WASD's keys along the way they last went
  assert.match(W, /const foes = journey \|\| walk \? journeyThreatCap\(!!travelView\?\.active, !journey\) : null;/);
  assert.match(W, /const yaw = _travelDrive \? \(_travelDrive\.yaw \* Math\.PI\) \/ 180 : keys \? _tvWalkYaw : null;/);
  assert.match(W, /forward: 1 \}\) === 0\) \{ axes\.forward = 0; axes\.strafe = 0; \}\n\s*_tvWalkYaw = way;/, 'the keys\' way kept as they move the body');
  assert.match(W, /return threatCap\(\{ threats: journeyThreats\(up\), heading: yaw == null \? null : \{ x: Math\.sin\(yaw\), z: Math\.cos\(yaw\) \}, speedMps: player\?\.speed \?\? 0 \}\);/);
});
