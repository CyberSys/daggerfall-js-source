// TV7 - THE ROAMING BANDS (bible/06-Systems/Travel-View.md, THE OVERHAUL; Mac 2026-09-28: "Roaming parties", "Shared
// per area"). The pure law (systems/travelBands.js): born of the land and the shared clock, a seeded wander, the chase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BAND_CELL_PX, BAND_LIFE_MS, BAND_CHANCE_DAY, BAND_CHANCE_NIGHT, BAND_WANDER_MPS, BAND_LEG_MS, BAND_CHASE_MPS, BAND_LEASH_M,
  BAND_GIVE_UP_MS, BAND_CONTACT_M, BAND_REACH_PX, bandOf, wanderAt, bandsNear, bandSight, bandChaseStep, bandLabel,
  BAND_SIGHT_DAY_M, BAND_SIGHT_NIGHT_M, bandWordOf, validBandWord, chaseYields, BAND_ID_RE, BANDS_WIRE_MAX, BAND_WORD_MS,
  bandMakeSeed, bandLifeOf, bandNearMe, BAND_STAND_RETRY_MS, BAND_STAND_TRIES, bandPixelOf,
} from '../src/systems/travelBands.js';
import { seededRng } from '../src/systems/wind.js';
import { NATIVE_PER_M } from '../src/systems/travelDungeons.js';

const land = () => true;
const PX = 32768;

test('TV7 law: a band is BORN of the cell and the life alone - the same for every player who asks, a different one the next life; a cell\'s odds by day and by night; never born in the water or a town', () => {
  const q = { cx: 40, cy: 21, life: 1000, night: false, ok: land };
  const lives = [];
  for (let life = 0; life < 400; life++) lives.push(bandOf({ ...q, life }));
  const born = lives.filter(Boolean);
  assert.ok(born.length > 400 * BAND_CHANCE_DAY * 0.7 && born.length < 400 * BAND_CHANCE_DAY * 1.3, `about ${BAND_CHANCE_DAY} of lives by day (${born.length}/400)`);
  let nights = 0;
  for (let life = 0; life < 400; life++) if (bandOf({ ...q, life, night: true })) nights++;
  assert.ok(nights > born.length, 'more by night');
  const b = born[0];
  assert.deepEqual(bandOf({ ...q, life: b.life }), b, 'asked again (another player): the same band, to the unit');
  assert.equal(b.id, `b40.21.${b.life}`);
  const span = BAND_CELL_PX * PX;
  assert.ok(b.born.x >= 40 * span && b.born.x < 41 * span && b.born.z >= 21 * span && b.born.z < 22 * span, 'born inside its cell');
  assert.equal(b.bornMs, b.life * BAND_LIFE_MS);
  assert.equal(bandOf({ ...q, life: b.life, ok: () => false }), null, 'the land says no: no band');
});

test('TV7 law: WHERE A BAND WANDERS - a pure function of its seed and the shared time; at the wanderer\'s pace; turned back off the land\'s edge; still before its birth and after its life', () => {
  let b = null;
  for (let life = 7; !b; life++) b = bandOf({ cx: 3, cy: 3, life, night: true, ok: land });
  assert.ok(b, 'some band to follow');
  const at0 = wanderAt(b, b.bornMs, land);
  assert.deepEqual([at0.x, at0.z], [b.born.x, b.born.z], 'at birth, where it was born');
  const t = b.bornMs + 3 * BAND_LEG_MS + 10000;
  assert.deepEqual(wanderAt(b, t, land), wanderAt(b, t, land), 'the same time, the same place - for everyone');
  const one = wanderAt(b, b.bornMs + BAND_LEG_MS, land);
  const m = Math.hypot(one.x - b.born.x, one.z - b.born.z) / NATIVE_PER_M;
  assert.ok(Math.abs(m - BAND_WANDER_MPS * BAND_LEG_MS / 1000) < 1e-6, `a leg at the wanderer's pace (${m.toFixed(1)} m)`);
  assert.deepEqual(wanderAt(b, b.bornMs + 10 * BAND_LIFE_MS, land), wanderAt(b, b.bornMs + BAND_LIFE_MS, land), 'still after its life');
  // a wall where its first leg would go: turned back
  const heading = wanderAt(b, b.bornMs, land).heading;
  const ahead = (x, z) => ((x - b.born.x) * Math.sin(heading) + (z - b.born.z) * Math.cos(heading)) <= 0;
  const back = wanderAt(b, b.bornMs + BAND_LEG_MS, ahead);
  assert.ok(ahead(back.x, back.z) && Math.hypot(back.x - b.born.x, back.z - b.born.z) > 0, 'the leg ran the other way');
  assert.deepEqual(wanderAt(b, b.bornMs + BAND_LEG_MS, () => false), { x: b.born.x, z: b.born.z, heading: wanderAt(b, b.bornMs + BAND_LEG_MS, () => false).heading }, 'walled in: it stands');
});

test('TV7 law: the bands about the traveller are the cells within BAND_REACH_PX, this life\'s; a sight shorter by night; a band\'s words', () => {
  const ms = 5000 * BAND_LIFE_MS + 1234;
  const got = bandsNear({ at: { x: 200, y: 100 }, ms, night: true, ok: land });
  const life = 5000;
  assert.ok(got.length > 0 && got.every((b) => b.life === life));
  const cells = new Set(got.map((b) => `${b.cx},${b.cy}`));
  for (const b of got) {
    assert.ok(Math.abs(b.cx * BAND_CELL_PX - 200) <= BAND_REACH_PX + BAND_CELL_PX && Math.abs(b.cy * BAND_CELL_PX - 100) <= BAND_REACH_PX + BAND_CELL_PX);
  }
  assert.equal(cells.size, got.length, 'one band a cell');
  const want = [];
  for (let cy = Math.floor((100 - BAND_REACH_PX) / BAND_CELL_PX); cy <= Math.floor((100 + BAND_REACH_PX) / BAND_CELL_PX); cy++) {
    for (let cx = Math.floor((200 - BAND_REACH_PX) / BAND_CELL_PX); cx <= Math.floor((200 + BAND_REACH_PX) / BAND_CELL_PX); cx++) {
      const b = bandOf({ cx, cy, life, night: true, ok: land });
      if (b) want.push(b.id);
    }
  }
  assert.deepEqual(got.map((b) => b.id), want, 'exactly the cells within the reach (AUDIT OW3: a halved reach passed)');
  assert.deepEqual([bandSight(false), bandSight(true)], [BAND_SIGHT_DAY_M, BAND_SIGHT_NIGHT_M]);
  assert.ok(BAND_SIGHT_NIGHT_M < BAND_SIGHT_DAY_M);
  assert.equal(bandLabel('Orc', 4), 'Orc, 4');
  assert.equal(bandLabel('', 3), 'A band, 3');
});

test('TV7 law: THE CHASE - the band closes at a runner\'s pace (the journey\'s time scale its own), makes contact within reach, and gives up past the leash or when it stops closing', () => {
  const feet = { x: 0, z: 0 };
  const at = (m) => ({ x: 0, z: m * NATIVE_PER_M });
  const s1 = bandChaseStep({ pos: at(100), feet, dt: 1, contact: BAND_CONTACT_M, gainAt: 0, now: 1000, best: 100 });
  assert.ok(Math.abs(s1.dist - (100 - BAND_CHASE_MPS)) < 1e-9, 'a second: a runner\'s stride');
  assert.equal(s1.what, null);
  const fast = bandChaseStep({ pos: at(100), feet, dt: 1, scale: 10, contact: BAND_CONTACT_M, gainAt: 0, now: 1000, best: 100 });
  assert.ok(Math.abs(fast.dist - (100 - BAND_CHASE_MPS * 10)) < 1e-9, 'on a journey at x10 the band on the map keeps the map\'s pace');
  assert.equal(bandChaseStep({ pos: at(BAND_CONTACT_M + 2), feet, dt: 1, contact: BAND_CONTACT_M, gainAt: 0, now: 1000, best: 40 }).what, 'contact');
  assert.equal(bandChaseStep({ pos: at(BAND_LEASH_M + 20), feet, dt: 1, contact: BAND_CONTACT_M, gainAt: 0, now: 1000, best: BAND_LEASH_M + 20 }).what, 'lost', 'past the leash');
  assert.equal(bandChaseStep({ pos: at(200), feet: { x: 0, z: -BAND_CHASE_MPS * NATIVE_PER_M * 0 }, dt: 0, contact: BAND_CONTACT_M, gainAt: 0, now: BAND_GIVE_UP_MS + 1, best: 150 }).what, 'lost', 'two minutes and further than its best: it gives up');
});

test('AUDIT OW3 T7-3: A CHASE STILL CLOSING RUNS ON - the host feeds each step\'s nearest and last gain back, sixty frames a second: a walker a band gains on is caught however long it takes; a traveller it cannot gain on is lost two minutes after its last metre', () => {
  const run = (walkMps, startM) => {
    let pos = { x: 0, z: startM * NATIVE_PER_M }, feetZ = 0, best = startM, gainAt = 0, what = null, t = 0;
    const dt = 1 / 60;
    while (!what && t < 1200) {
      t += dt; feetZ -= walkMps * dt * NATIVE_PER_M;   // walking straight away from it
      const s = bandChaseStep({ pos, feet: { x: 0, z: feetZ }, dt, contact: BAND_CONTACT_M, gainAt, now: t * 1000, best });
      pos = s.pos; best = s.best; gainAt = s.gainAt; what = s.what;
    }
    return { what, t };
  };
  const walker = run(4.43, 300);
  assert.equal(walker.what, 'contact', `a walker 300 m off at 4.43 m/s is caught (${walker.what} at ${walker.t.toFixed(1)} s)`);
  assert.ok(walker.t > BAND_GIVE_UP_MS / 1000, 'and the catch took longer than two minutes - closing all the while');
  const rider = run(BAND_CHASE_MPS + 2, 200);
  assert.equal(rider.what, 'lost');
  assert.ok(Math.abs(rider.t - BAND_GIVE_UP_MS / 1000) < 1, `a rider it never gains on: lost two minutes on (${rider.t.toFixed(1)} s)`);
  const s = bandChaseStep({ pos: { x: 0, z: 100 * NATIVE_PER_M }, feet: { x: 0, z: 0 }, dt: 1, contact: BAND_CONTACT_M, gainAt: 5, now: 9000, best: 100 });
  assert.deepEqual([s.best, s.gainAt], [100 - BAND_CHASE_MPS, 9000], 'a metre nearer: the nearest and the clock move');
  const t = bandChaseStep({ pos: { x: 0, z: 100 * NATIVE_PER_M }, feet: { x: 0, z: 0 }, dt: 0.1, contact: BAND_CONTACT_M, gainAt: 5, now: 9000, best: 100 });
  assert.deepEqual([t.best, t.gainAt], [100, 5], 'less than a metre: neither moves');
});

test('AUDIT OW3 T7-4/T7-6/T7-8: a band\'s make is rolled from its OWN stream (the birth\'s first draw is under the spawn chance - Daggerfall\'s roll over 80 could never come); it carries the night its life began in; a leg part-walked never flips', () => {
  const firsts = [];
  for (let life = 0; firsts.length < 400 && life < 4000; life++) {
    const b = bandOf({ cx: 17, cy: 9, life, night: true, ok: land });
    if (!b) continue;
    assert.notEqual(bandMakeSeed(b), b.seed);
    assert.ok(seededRng(b.seed)() < BAND_CHANCE_NIGHT, 'the birth stream\'s first draw: always under the chance');
    firsts.push(seededRng(bandMakeSeed(b))());
  }
  assert.ok(firsts.filter((r) => r > 0.8).length > 400 * 0.1, 'the make\'s first draw spans the whole roll - over 80 a fair share of the time');
  assert.equal(bandOf({ cx: 17, cy: 9, life: 3, night: true, ok: land })?.night ?? true, true);
  const day = bandsNear({ at: { x: 34, y: 18 }, ms: 3 * BAND_LIFE_MS, night: false, ok: land });
  assert.ok(day.length && day.every((b) => b.night === false), 'each band carries its life\'s night');
  // a wall across its way: sampled every quarter second through a life, it never jumps
  let b = null;
  for (let life = 11; !b; life++) b = bandOf({ cx: 5, cy: 5, life, night: true, ok: land });
  const h0 = wanderAt(b, b.bornMs, land).heading;   // a wall forty metres along its first leg
  const wall = (x, z) => ((x - b.born.x) * Math.sin(h0) + (z - b.born.z) * Math.cos(h0)) < 40 * NATIVE_PER_M;
  let prev = wanderAt(b, b.bornMs, wall), most = 0;
  for (let ms = b.bornMs + 250; ms <= b.bornMs + BAND_LIFE_MS; ms += 250) {
    const p = wanderAt(b, ms, wall);
    most = Math.max(most, Math.hypot(p.x - prev.x, p.z - prev.z) / NATIVE_PER_M);
    prev = p;
  }
  assert.ok(most <= BAND_WANDER_MPS * 0.25 + 1e-6, `never faster than it walks (${most.toFixed(2)} m in a quarter second)`);
});

test('AUDIT OW4 B1: THE BANDS ABOUT ME ARE ABOUT ME - from the feet through the map\'s own pixel (its y runs north-down) and bandPixelOf, every band asked for is born within the reach of the feet, never at the mirror of their latitude', async () => {
  const { worldCoordToMapPixel } = await import('../src/formats/mapsFile.js');
  for (const feet of [{ x: 207.4 * PX, z: 286.6 * PX }, { x: 200.5 * PX, z: 399.5 * PX }, { x: 640.2 * PX, z: 31.7 * PX }]) {
    const at = bandPixelOf(worldCoordToMapPixel(feet.x, feet.z));
    let got = [];
    for (let life = 50; !got.length && life < 200; life++) got = bandsNear({ at, ms: life * BAND_LIFE_MS, night: true, ok: land });
    assert.ok(got.length, 'some band about');
    const reach = (BAND_REACH_PX + BAND_CELL_PX) * PX;
    for (const b of got) assert.ok(Math.abs(b.born.x - feet.x) <= reach && Math.abs(b.born.z - feet.z) <= reach, `born within the reach of the feet (${((b.born.z - feet.z) / PX).toFixed(1)} px off in z)`);
    const mirrored = bandsNear({ at: worldCoordToMapPixel(feet.x, feet.z), ms: 60 * BAND_LIFE_MS, night: true, ok: land });
    if (Math.abs(feet.z / PX - 249.5) > 20) assert.ok(mirrored.every((b) => Math.abs(b.born.z - feet.z) > reach), 'the map\'s own y handed straight in is the mirror - never near');
  }
  assert.deepEqual(bandPixelOf({ x: 12, y: 499 }), { x: 12, y: 0 });
});

test('AUDIT OW3 T7-9/T7-1: a peer\'s word is kept only for a band that can be about me - this life\'s or the last, a cell within the reach; a contact that finds no ground retries before the band is lost', () => {
  assert.equal(bandLifeOf('b-3.4.99'), 99);
  const at = { x: 200, y: 100 };
  assert.equal(bandNearMe('b100.50.7', at, 7), true);
  assert.equal(bandNearMe('b100.50.6', at, 7), true, 'the life just over');
  assert.equal(bandNearMe('b100.50.5', at, 7), false, 'two lives gone');
  assert.equal(bandNearMe('b100.50.8', at, 7), false, 'a life to come');
  assert.equal(bandNearMe(`b${(200 + BAND_REACH_PX + BAND_CELL_PX) / BAND_CELL_PX}.50.7`, at, 7), true, 'the reach\'s edge');
  assert.equal(bandNearMe(`b${(200 + BAND_REACH_PX + BAND_CELL_PX) / BAND_CELL_PX + 1}.50.7`, at, 7), false, 'past it');
  assert.equal(bandNearMe('b100.60.7', at, 7), false);
  assert.equal(bandNearMe('nope', at, 7), false);
  assert.deepEqual([BAND_STAND_RETRY_MS, BAND_STAND_TRIES], [1500, 5]);
});

test('TV7 host: the bands about the traveller kept a life and a pixel; made once of Daggerfall\'s themed groups from their own seed; seen from above with their kind and number, a chaser held at the edge; the chase under the view, the contact standing exactly that band; the enhanced interface outdoors', async () => {
  const { readFileSync } = await import('node:fs');
  const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const w = rd('src/scenes/world.js');
  assert.match(rd('src/systems/campEncounters.js'), /^export function rollGroupComposition\(ctx, rolls\) \{/m, 'the themed group is the camps\' own');
  assert.match(w, /const bandNowMs = \(\) => Date\.now\(\) \+ \(online \? _sharedOffsetMs : 0\);/, 'the shared clock online');
  assert.match(w, /return px >= 0 && py >= 0 && px < 1000 && py < 500 && !tvWater\(px, py\) && !_bandPlacePixels\.has\(`\$\{px\},\$\{py\}`\);/, 'never the water, never a place - the maps\' own places, the same on every client (AUDIT OW4 B2)');
  // PIN MOVED (AUDIT OW5 B2): filled in the boot's own index loop, from the game's rows alone - a world-data mod's
  // appended rows stand only where Replace Game Artwork is on, each client's own switch
  assert.match(w, /const baseCount = maps\.baseLocationCount\(r\);[\s\S]{0,420}?if \(l < baseCount\) \{ _hubRows\.push\(loc\); _bandPlacePixels\.add\(`\$\{p\.x\},\$\{p\.y\}`\); \}/, 'taken at boot, before any spawn stands - the game\'s own rows');
  assert.ok(!/_bandPlacePixels = new Set\(locationIndex/.test(w), 'never the index, which holds a mod\'s rows too');
  assert.ok(w.includes('const spawnedDungeonAt = ') && w.indexOf('_bandPlacePixels.add(`${p.x},${p.y}`); }') < w.indexOf('const spawnedDungeonAt = '), 'before the spawns can add to the index');
  assert.match(w, /const at = bandPixelOf\(playerTravelPixel\(\)\), ms = bandNowMs\(\), life = Math\.floor\(ms \/ BAND_LIFE_MS\);/, 'the bands\' own rows about me (AUDIT OW4 B1)');
  assert.match(w, /const now = performance\.now\(\), at = bandPixelOf\(playerTravelPixel\(\)\), life = Math\.floor\(bandNowMs\(\) \/ BAND_LIFE_MS\);/, 'a peer\'s word judged in the same rows');
  assert.match(w, /const night = tvBandSeen\.life === life \? tvBandSeen\.night : bandNight\(life \* BAND_LIFE_MS\);\n\s*tvBandSeen = \{ at, life, night, list: bandsNear\(\{ at, ms, night, ok: bandOk \}\) \};/, 'the night the life began in - the same for everyone, and read once a life (AUDIT OW3 T7-8)');
  assert.match(w, /const hit = rollGroupComposition\(\{ climateIndex: maps\.getClimateIndex\(px, py\), playerLevel: playerEntity\.level, inLocationRect: false,\n\s*gameMinutes: b\.night \? 0 : 720 \}, seededRng\(bandMakeSeed\(b\)\)\);/, 'made from its own stream (AUDIT OW3 T7-4), by its life\'s night');
  assert.match(w, /if \(!up \|\| _bandChase\.size >= 2 \|\| bandPeerChase\(b\.id\)\) continue;/, 'only under the view does a band first see me; two chasers at most; never a band a peer\'s chase holds (TV7b)');
  assert.match(w, /if \(d > sight\) continue;/);
  assert.match(w, /for \(const \[id, c\] of _bandChase\) \{\n\s*const s = bandChaseStep\(\{ pos: c\.pos, feet, dt, scale: worldTimeScale\(\), contact: up \? BAND_CONTACT_M : BAND_STAND_M, gainAt: c\.gainAt, now: ms, best: c\.best \}\);\n\s*c\.pos = s\.pos; c\.best = s\.best; c\.gainAt = s\.gainAt;/, 'every chase stepped on its own band (AUDIT OW3 T7-2), the journey\'s pace, the view\'s reach or the stand-off, the last gain fed back (T7-3)');
  assert.match(w, /else if \(s\.what === 'contact' && !\(c\.retryAt > now\)\) \{\n\s*c\.yaw \?\?= bandYaw\(c\.pos\);[^\n]*\n\s*if \(bandStand\(bandMake\(c\.band\), c\.yaw\) \|\| \+\+c\.tries >= BAND_STAND_TRIES\) \{ _bandChase\.delete\(id\); bandSpend\(id\); \}[^\n]*\n\s*else c\.retryAt = now \+ BAND_STAND_RETRY_MS;/, 'contact stands the band, once - spent only once it stood, or its tries are spent (AUDIT OW3 T7-1)');
  assert.match(w, /if \(s\.what === 'lost'\) \{ _bandChase\.delete\(id\); bandSpend\(id\); \}/, 'a lost trail: the band is gone for its life');
  assert.match(w, /_bandChase\.set\(b\.id, \{ band: b, pos: \{ x: p\.x, z: p\.z \}, gainAt: ms, best: d, tries: 0, retryAt: 0 \}\);/, 'a chase keeps its band');
  assert.match(w, /if \(_bandSpent\.has\(b\.id\) \|\| _bandChase\.has\(b\.id\)\) continue;/);
  assert.match(w, /if \(!isEnhanced\(\) \|\| \(modes\?\.mode \?\? 'exterior'\) !== 'exterior' \|\| !walkMode \|\| !playerSpawned \|\| getPref\('wildernessCamps'\) === false\n\s*\|\| playerEntity\.preventEnemySpawns \|\| player\.isPlayerSwimming \|\| aboard\n\s*\|\| _inAnyLocationRect\(player\.feetAt\(\)\)\) \{ bandDrop\(\); return; \}/, 'the enhanced interface, outdoors, the camps\' own switch, never at sea, never into a town - and a chase so ended is spent (AUDIT OW3 T7-7)');
  assert.match(w, /function bandDrop\(\) \{ for \(const id of _bandChase\.keys\(\)\) bandSpend\(id\); _bandChase\.clear\(\); \}/);
  assert.match(w, /function bandStand\(mk, yaw\) \{[\s\S]{0,300}?const fx = player\.feetAt\(\);\n\s*for \(const turn of \[0, Math\.PI \/ 2, -Math\.PI \/ 2, Math\.PI\]\) \{\n\s*if \(_standCampEncounter\(\{ kind: 'pack', mobileTypes: mk\.mobileTypes, spacing: PACK_SPACING, alertRadius: PACK_ALERT_RADIUS,\n\s*minDistance: 18, maxDistance: 32, bearingDegrees: 0, yawRad: yaw \+ turn \}, fx\)\) return true;\n\s*\}\n\s*return false;/, 'on its own bearing, then a quarter turn either way, then behind (AUDIT OW3 T7-1)');
  assert.match(w, /if \(!anchor\) return false;/, 'the camps\' stand says whether it stood');
  assert.match(w, /\}\)\.catch\(\(\) => null\);\n\s*\}\n\s*return placed > 0;\n\s*\};\n\s*const _standLooseFoe/, 'stood is a member placed (AUDIT OW4 B3)');
  assert.match(w, /if \(!spot\) continue;\n\s*placed\+\+;/);
  assert.match(w, /function bandYaw\(pos\) \{\n\s*const fx = player\.feetAt\(\), sp = tvSceneOf\(pos\.x, pos\.z, 0\);\n\s*return Math\.atan2\(sp\[0\] - fx\[0\], sp\[2\] - fx\[2\]\);/, 'the bearing it came from, read at the first contact (AUDIT OW4 B4)');
  assert.match(w, /if \(modes\.frame\(dt, now\)\) \{\n[\s\S]{0,5000}?\n\s*if \(_bandChase\.size\) bandDrop\(\);   \/\/ AUDIT OW4 B5/, 'a door ends every chase, spent (AUDIT OW4 B5) - inside the modal arm');
  assert.match(w, /const shown = getPref\('wildernessCamps'\) === false \|\| playerEntity\.preventEnemySpawns \? \[\] : \[\.\.\.travelViewBands\(\)\];/, 'none drawn where none can come (AUDIT OW4 B6)');
  assert.match(w, /for \(let i = _bandSpentAt\.length - 1; i >= 0; i--\) if \(bandLifeOf\(_bandSpentAt\[i\]\) < life - 1\) _bandSpentAt\.splice\(i, 1\);/, 'the spent list pruned with the rest (AUDIT OW4 B7)');
  assert.match(w, /const listed = travelViewBands\(\), sight = bandSight\(tvBandSeen\.night\);/, 'the sight of the night the bands were made in (AUDIT OW4 B8)');
  assert.match(w, /const shown = getPref\('wildernessCamps'\) === false \|\| playerEntity\.preventEnemySpawns \? \[\] : \[\.\.\.travelViewBands\(\)\];\n\s*for \(const c of _bandChase\.values\(\)\) if \(!shown\.some\(\(o\) => o\.id === c\.band\.id\)\) shown\.push\(c\.band\);/, 'a chaser out of the list still seen (AUDIT OW3 T7-2)');
  assert.match(w, /if \(!bandNearMe\(id, at, life\)\) continue;/, 'a peer\'s word only for a band that can be about me (AUDIT OW3 T7-9)');
  assert.match(w, /if \(tvBandSeen\.life !== life\) bandPrune\(life\);/);
  assert.match(w, /for \(const m of \[_bandMake, _bandPos, _bandPeer\]\) for \(const id of m\.keys\(\)\) if \(bandLifeOf\(id\) < life - 1 && !_bandChase\.has\(id\)\) m\.delete\(id\);\n\s*for \(const id of _bandSpent\) if \(bandLifeOf\(id\) < life - 1\) _bandSpent\.delete\(id\);/);
  assert.match(w, /anchor = campAnchorSpot\(\{ feet, yawRad: hit\.yawRad \?\? cam\.yaw, fovDegrees:/, 'the camps\' anchor takes the band\'s bearing');
  assert.match(w, /const chasing = _bandChase\.has\(b\.id\), p = bandPlace\(b, bms\);\n\s*marks\.push\(\{ key: `band:\$\{b\.id\}`, at: tvSceneKept\(b, p\.x, p\.z, 2\), label: bandLabel\(mk\.name, partyGroupMembers\(mk\.mobileTypes, partySize\(\)\)\.length\), kind: chasing \? 'band chase' : 'band', edge: chasing \}\);/, 'seen from above');
  assert.match(w, /bandFrame\(performance\.now\(\)\);   \/\/ TV7/);
  assert.match(w, /tvBandSeen = \{ at: null, life: -1, list: \[\] \}; _bandChase\.clear\(\); _bandSpent\.clear\(\); _bandMake\.clear\(\); _bandPos\.clear\(\); _bandPeer\.clear\(\); _bandSpentAt\.length = 0;/, 'a load forgets them - and what the peers said (TV7b)');
  const hud = await import('../src/ui/travelViewHud.js');
  assert.equal(hud.TRAVEL_VIEW_MARK_COLORS.band, '#e0503c');
  assert.match(rd('src/ui/travelViewHud.js'), /\|\| k === 'lair' \|\| k === 'band'(?: \|\| k === 'raider')? \? k : 'traveller';/);
});

test('TV7b THE CHASE, SHARED: the band word - my chases where they are, then the bands spent here, at most BANDS_WIRE_MAX; heard, only what a band word can be; two chasers of one band settled by id alike on every client', () => {
  const chases = new Map([['b10.20.5', { pos: { x: 12345.6, z: 999.4 } }], ['b11.20.5', { pos: { x: 1, z: 2 } }]]);
  assert.deepEqual(bandWordOf(chases, ['b3.4.5', 'b3.5.5']), [['b10.20.5', 12346, 999, 1], ['b11.20.5', 1, 2, 1], ['b3.4.5', 0, 0, 2], ['b3.5.5', 0, 0, 2]]);
  const many = Array.from({ length: 20 }, (_, i) => `b${i}.0.1`);
  assert.equal(BANDS_WIRE_MAX, 8);
  assert.equal(bandWordOf(new Map(), many).length, BANDS_WIRE_MAX, 'the cap');
  assert.equal(bandWordOf(new Map(many.map((id) => [id, { pos: { x: 1, z: 1 } }])), []).length, BANDS_WIRE_MAX, 'the cap on the chases too');
  assert.ok(BAND_ID_RE.test('b-3.12.504231') && !BAND_ID_RE.test('b3.12') && !BAND_ID_RE.test('<script>'));
  assert.deepEqual(validBandWord([
    ['b1.2.3', 100, 200, 1], ['b1.2.3', 5, 5, 1],          // once
    ['b4.5.6', 0, 0, 2],                                      // spent
    ['nope', 1, 1, 1], ['b7.8.9', -1, 2, 1], ['b7.8.9', 1.5, 2, 1], ['b7.8.9', 1, 2, 3], ['b7.8.9', 1e12, 2, 1],   // refused
    'junk', [1, 2], null,
  ]), [['b1.2.3', 100, 200, 1], ['b4.5.6', 0, 0, 2]]);
  assert.deepEqual(validBandWord('x'), []);
  assert.equal(validBandWord(Array.from({ length: 20 }, (_, i) => [`b${i}.0.1`, 1, 1, 1])).length, BANDS_WIRE_MAX);
  assert.equal(chaseYields('peer-b', 'peer-a'), true, 'the lower id keeps it');
  assert.equal(chaseYields('peer-a', 'peer-b'), false);
  assert.equal(BAND_WORD_MS, 3000);
});

test('TV7b host: the band word rides my cell\'s foes frame (a chase asks for a frame; the relay reads none of it), a peer\'s word is heard past the room test - their chase shown where it is, their spent bands spent here, a band we both chase kept by the lower id', async () => {
  const { readFileSync } = await import('node:fs');
  const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const w = rd('src/scenes/world.js'), ef = rd('src/scenes/exteriorFoes.js');
  assert.match(ef, /if \(data\.bd !== undefined\) _onBands\?\.\(from, data\.bd, _now\(\)\);/, 'read off the frame, past the room test');
  assert.match(ef, /function setOnBands\(fn\) \{ _onBands = typeof fn === 'function' \? fn : null; \}/);
  assert.match(w, /exteriorFoes\.setOnBands\(\(from, bd\) => bandHear\(from, bd\)\);/);
  assert.match(w, /const bandMoved = cell && bandWord\(null, full\);/);
  assert.match(w, /exteriorFoes\.foesFrame\(full, _hccDirty \|\| csaMoved(?: \|\| csaAboardMoved)? \|\| bandMoved(?: \|\| navalMoved)?\)/, 'a chase asks for a frame');   // THE MERGE with NAV-G: the sea's moved word asks beside it
  assert.match(w, /if \(cell\) csaWord\(frame, full\);(?: if \(cell\) csaAboardWord\(frame, full\);)? if \(cell\) bandWord\(frame, full\);/, 'and rides it');
  assert.match(w, /if \(!full && !_bandChase\.size && key === _bandWordKey\) return false;/, 'a chase is said every frame; a spent list on a change and the full frames');
  assert.match(w, /if \(flag === 2\) \{ _bandSpent\.add\(id\); _bandChase\.delete\(id\); _bandPeer\.delete\(id\); continue; \}/, 'a peer\'s spent band: spent here');
  assert.match(w, /_bandPeer\.set\(id, \{ x, z, at: now, from \}\);\n\s*if \(_bandChase\.has\(id\) && chaseYields\(online\?\.id \?\? '', from\)\) _bandChase\.delete\(id\);/, 'one band, one chaser');
  assert.match(w, /const pc = bandPeerChase\(b\.id\);\n\s*if \(pc\) return pc;/, 'a peer\'s chase shown where it runs');
  assert.match(w, /if \(performance\.now\(\) - p\.at > BAND_WORD_MS\) \{ _bandPeer\.delete\(id\); return null; \}/, 'a word gone stale: the band wanders on');
});


// AUDIT OW4 B10: THE HOST RUN - bandFrame, bandStand and bandHear lifted out of world.js's own text and run against
// stubs (the tv6 host tests' way), so the host's chase law is proven by what it DOES, not by how it reads.
const liftBands = async () => {
  const { readFileSync } = await import('node:fs');
  const w = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
  const cut = (name) => {
    const m = new RegExp(`\\n  function ${name}\\([^)]*\\) \\{[^\\n]*\\}\\n`).exec(w) ?? new RegExp(`\\n  function ${name}\\([^)]*\\) \\{\\n[\\s\\S]*?\\n  \\}\\n`).exec(w);
    assert.ok(m, `${name} lifted`);
    return m[0];
  };
  return { frame: cut('bandFrame'), stand: cut('bandStand'), hear: cut('bandHear'), drop: cut('bandDrop'), spend: cut('bandSpend'), hold: cut('bandHold') };
};
const bandHost = async (over = {}) => {
  const src = await liftBands();
  const law = await import('../src/systems/travelBands.js');
  const stood = [], d = {
    _bandChase: new Map(), _bandSpent: new Set(), _bandSpentAt: [], _bandPeer: new Map(),
    worldMoveBusy: () => false, travelView: { active: true }, isEnhanced: () => true, modes: { mode: 'exterior', deathUp: () => false },
    walkMode: true, playerSpawned: true, getPref: () => true, gamePaused: () => false, csaRuntime: null, isBoatEffectBundle: () => false,
    playerEntity: { health: 50, preventEnemySpawns: false, activeEffects: [] },
    player: { isPlayerSwimming: false, pos: [0, 0, 0], feetAt: () => [0, 0, 0] },
    _inAnyLocationRect: () => false, bandNowMs: () => d.ms, ms: 1_000_000,
    state: { worldCoords: () => ({ x: d.feet.x, z: d.feet.z }) }, feet: { x: 0, z: 0 },
    list: [], travelViewBands: () => d.list, tvBandSeen: { night: false },
    worldTimeScale: () => 1, bandPlace: (b) => b.at, bandMake: () => ({ mobileTypes: [1, 2], name: 'Orc' }), bandPeerChase: () => null,
    bandYaw: (pos) => Math.atan2(pos.x - d.feet.x, pos.z - d.feet.z),
    standOk: () => true, standCalls: [], online: { id: 'b' }, playerTravelPixel: () => ({ x: 0, y: 499 }),
    ...over,
  };
  const names = Object.keys(d).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k));
  const make = new Function('d', 'law', `
    const { ${names.join(', ')} } = d;
    const { bandChaseStep, bandSight, validBandWord, bandNearMe, bandPixelOf, chaseYields, BAND_CONTACT_M, BAND_STAND_M, BAND_STAND_TRIES,
      BAND_STAND_RETRY_MS, BANDS_WIRE_MAX, BAND_LIFE_MS } = law;
    const NATIVE_PER_M = 40, PACK_SPACING = 6, PACK_ALERT_RADIUS = 30;
    const partyGroupMembers = (t) => t, partySize = () => 1, exteriorFoes = { encounterRoom: () => d.room ?? Infinity };
    const _standCampEncounter = (hit) => { d.standCalls.push(hit.yawRad); return d.standOk(hit); };
    let _bandLast = 0;
    ${src.spend} ${src.drop} ${src.hold} ${src.stand} ${src.hear} ${src.frame}
    return { bandFrame, bandStand, bandHear };`);
  return { d, ...make(d, law), stood };
};
const bandAt = (id, xM, zM) => ({ id, at: { x: xM * NATIVE_PER_M, z: zM * NATIVE_PER_M } });

test('AUDIT OW4 B10 host run: a wanderer in sight chases (under the view, two at most, never a peer\'s); the chase runs on after its band left the list; contact stands it and spends it', async () => {
  const h = await bandHost();
  h.d.list = [bandAt('b1.1.5', 0, 200), bandAt('b2.1.5', 0, 250), bandAt('b3.1.5', 0, 280), bandAt('b4.1.5', 0, 900)];
  h.bandFrame(1000);
  assert.deepEqual([...h.d._bandChase.keys()], ['b1.1.5', 'b2.1.5'], 'two chasers at most, the far one unseen');
  h.d.list = [];   // a life turned over: the list rebuilt without them
  for (let t = 1016, i = 0; i < 60 * 60 && h.d._bandChase.size; i++, t += 16) { h.d.ms += 16; h.bandFrame(t); }
  assert.equal(h.d._bandChase.size, 0, 'both ran on to contact though their list was gone');
  assert.ok(h.d._bandSpent.has('b1.1.5') && h.d._bandSpent.has('b2.1.5'), 'stood, so spent');
  assert.deepEqual(h.d._bandSpentAt.slice().sort(), ['b1.1.5', 'b2.1.5'], 'and said, for the others');
  const view = await bandHost({ travelView: { active: false } });
  view.d.list = [bandAt('b1.1.5', 0, 200)];
  view.bandFrame(1000);
  assert.equal(view.d._bandChase.size, 0, 'with the view down no band first sees me');
  const peer = await bandHost({ bandPeerChase: (id) => (id === 'b1.1.5' ? { x: 0, z: 0 } : null) });
  peer.d.list = [bandAt('b1.1.5', 0, 200)];
  peer.bandFrame(1000);
  assert.equal(peer.d._bandChase.size, 0, 'a band a peer chases is theirs');
});

test('AUDIT OW4 B10 host run: a contact the ground refuses holds its first bearing through every retry, BAND_STAND_RETRY_MS apart, and is lost after BAND_STAND_TRIES - spent, never standing nobody', async () => {
  const h = await bandHost({ standOk: () => false });
  h.d.list = [bandAt('b1.1.5', 0, 40)];
  h.bandFrame(1000);
  let t = 1000;
  for (let i = 0; i < 5000 && h.d._bandChase.size; i++) { t += 16; h.d.ms += 16; h.bandFrame(t); }
  assert.equal(h.d._bandChase.size, 0);
  assert.ok(h.d._bandSpent.has('b1.1.5'), 'lost after its tries');
  const tries = h.d.standCalls.length / 4;
  assert.equal(tries, BAND_STAND_TRIES, 'BAND_STAND_TRIES stands tried, four bearings each');
  const first = h.d.standCalls[0];
  for (let i = 0; i < h.d.standCalls.length; i += 4) assert.ok(Math.abs(h.d.standCalls[i] - first) < 1e-9, 'every try on the bearing it first came from');
  assert.deepEqual(h.d.standCalls.slice(0, 4).map((y) => +(y - first).toFixed(6)), [0, +(Math.PI / 2).toFixed(6), +(-Math.PI / 2).toFixed(6), +Math.PI.toFixed(6)], 'its own, a quarter turn either way, then behind');
  assert.ok(t - 1000 >= (BAND_STAND_TRIES - 1) * BAND_STAND_RETRY_MS, 'the tries BAND_STAND_RETRY_MS apart');
  const room = await bandHost({ room: 1 });
  assert.equal(room.bandStand({ mobileTypes: [1, 2, 3] }, 0), false, 'no room in the foe pool: not stood');
  assert.equal(room.d.standCalls.length, 0);
});

test('AUDIT OW4 B10 host run: water, a boat, a town\'s rect or the camps off end every chase SPENT; death or a window holding the game HOLDS it', async () => {
  for (const [what, over] of [['swimming', { player: { isPlayerSwimming: true, pos: [0, 0, 0], feetAt: () => [0, 0, 0] } }], ['a boat', { isBoatEffectBundle: () => true, playerEntity: { health: 50, activeEffects: [{ bundleName: 'boat' }] } }],
    ['a sailing boat', { csaRuntime: { isSailing: () => true } }], ['a town', { _inAnyLocationRect: () => true }], ['camps off', { getPref: () => false }]]) {
    const h = await bandHost();
    h.d._bandChase.set('b1.1.5', { band: bandAt('b1.1.5', 0, 200), pos: { x: 0, z: 200 * NATIVE_PER_M }, gainAt: h.d.ms, best: 200, tries: 0, retryAt: 0 });
    Object.assign(h.d, over);
    const again = await bandHost({ ...over, _bandChase: h.d._bandChase, _bandSpent: h.d._bandSpent, _bandSpentAt: h.d._bandSpentAt });
    again.bandFrame(1000);
    assert.equal(again.d._bandChase.size, 0, `${what}: the chase ends`);
    assert.ok(again.d._bandSpent.has('b1.1.5'), `${what}: spent, not forgotten`);
  }
  for (const [what, over] of [['dead', { playerEntity: { health: 0, activeEffects: [] } }], ['a window', { gamePaused: () => true }]]) {
    const h = await bandHost(over);
    const c = { band: bandAt('b1.1.5', 0, 200), pos: { x: 0, z: 200 * NATIVE_PER_M }, gainAt: h.d.ms, best: 200, tries: 0, retryAt: 0 };
    h.d._bandChase.set('b1.1.5', c);
    h.bandFrame(1000); h.bandFrame(1200);
    assert.equal(c.pos.z, 200 * NATIVE_PER_M, `${what}: the chase holds where it was`);
    assert.equal(h.d._bandSpent.size, 0);
  }
});

test('AUDIT OW5 B1 host run: a hold carries the chase\'s patience - two and a half minutes in a window, and the band chases on after it', async () => {
  let paused = true;
  const h = await bandHost({ gamePaused: () => paused });
  const c = { band: bandAt('b1.1.5', 0, 245), pos: { x: 0, z: 245 * NATIVE_PER_M }, gainAt: h.d.ms, best: 245, tries: 0, retryAt: 0 };
  h.d._bandChase.set('b1.1.5', c);
  for (let t = 1000; t <= 151_000; t += 1000) { h.d.ms += 1000; h.bandFrame(t); }   // the shared clock runs on through the window
  assert.equal(c.pos.z, 245 * NATIVE_PER_M, 'held where it was');
  paused = false;
  h.d.ms += 16;
  h.bandFrame(151_016);
  assert.ok(h.d._bandChase.has('b1.1.5'), 'the first frame after: still chasing (it was lost - 150 s past its last closing)');
  assert.equal(h.d._bandSpent.size, 0, 'and not spent');
});

test('AUDIT OW4 B10 host run: a peer\'s word - only a band about me (in the bands\' own rows), a spent band spent here, a band we both chase kept by the lower id', async () => {
  const h = await bandHost({ playerTravelPixel: () => ({ x: 200, y: 499 - 100 }), ms: 7 * BAND_LIFE_MS + 5 });
  h.d._bandChase.set('b100.50.7', { pos: { x: 1, z: 1 } });
  h.bandHear('a', [['b100.50.7', 10, 20, 1], ['b101.50.7', 0, 0, 2], ['b100.200.7', 5, 5, 1]]);
  assert.equal(h.d._bandChase.has('b100.50.7'), false, 'the lower id (a) keeps it');
  assert.ok(h.d._bandPeer.has('b100.50.7'), 'their chase shown');
  assert.ok(h.d._bandSpent.has('b101.50.7'), 'their spent band spent here');
  assert.equal(h.d._bandPeer.has('b100.200.7'), false, 'a band a hundred and fifty rows off is nobody\'s here');
  const mirror = await bandHost({ playerTravelPixel: () => ({ x: 200, y: 100 }), ms: 7 * BAND_LIFE_MS + 5 });
  mirror.bandHear('a', [['b100.50.7', 10, 20, 1]]);
  assert.equal(mirror.d._bandPeer.has('b100.50.7'), false, 'at the mirror row the same word is not about me (AUDIT OW4 B1)');
});
