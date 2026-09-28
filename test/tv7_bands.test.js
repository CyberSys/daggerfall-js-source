// TV7 - THE ROAMING BANDS (bible/06-Systems/Travel-View.md, THE OVERHAUL; Mac 2026-09-28: "Roaming parties", "Shared
// per area"). The pure law (systems/travelBands.js): born of the land and the shared clock, a seeded wander, the chase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BAND_CELL_PX, BAND_LIFE_MS, BAND_CHANCE_DAY, BAND_CHANCE_NIGHT, BAND_WANDER_MPS, BAND_LEG_MS, BAND_CHASE_MPS, BAND_LEASH_M,
  BAND_GIVE_UP_MS, BAND_CONTACT_M, BAND_REACH_PX, bandOf, wanderAt, bandsNear, bandSight, chaseStep, bandLabel,
  BAND_SIGHT_DAY_M, BAND_SIGHT_NIGHT_M,
} from '../src/systems/travelBands.js';
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
  assert.deepEqual([bandSight(false), bandSight(true)], [BAND_SIGHT_DAY_M, BAND_SIGHT_NIGHT_M]);
  assert.ok(BAND_SIGHT_NIGHT_M < BAND_SIGHT_DAY_M);
  assert.equal(bandLabel('Orc', 4), 'Orc, 4');
  assert.equal(bandLabel('', 3), 'A band, 3');
});

test('TV7 law: THE CHASE - the band closes at a runner\'s pace (the journey\'s time scale its own), makes contact within reach, and gives up past the leash or when it stops closing', () => {
  const feet = { x: 0, z: 0 };
  const at = (m) => ({ x: 0, z: m * NATIVE_PER_M });
  const s1 = chaseStep({ pos: at(100), feet, dt: 1, contact: BAND_CONTACT_M, since: 0, now: 1000, best: 100 });
  assert.ok(Math.abs(s1.dist - (100 - BAND_CHASE_MPS)) < 1e-9, 'a second: a runner\'s stride');
  assert.equal(s1.what, null);
  const fast = chaseStep({ pos: at(100), feet, dt: 1, scale: 10, contact: BAND_CONTACT_M, since: 0, now: 1000, best: 100 });
  assert.ok(Math.abs(fast.dist - (100 - BAND_CHASE_MPS * 10)) < 1e-9, 'on a journey at x10 the band on the map keeps the map\'s pace');
  assert.equal(chaseStep({ pos: at(BAND_CONTACT_M + 2), feet, dt: 1, contact: BAND_CONTACT_M, since: 0, now: 1000, best: 40 }).what, 'contact');
  assert.equal(chaseStep({ pos: at(BAND_LEASH_M + 20), feet, dt: 1, contact: BAND_CONTACT_M, since: 0, now: 1000, best: BAND_LEASH_M + 20 }).what, 'lost', 'past the leash');
  assert.equal(chaseStep({ pos: at(200), feet: { x: 0, z: -BAND_CHASE_MPS * NATIVE_PER_M * 0 }, dt: 0, contact: BAND_CONTACT_M, since: 0, now: BAND_GIVE_UP_MS + 1, best: 150 }).what, 'lost', 'two minutes and further than its best: it gives up');
  assert.equal(chaseStep({ pos: at(200), feet, dt: 1, contact: BAND_CONTACT_M, since: 0, now: BAND_GIVE_UP_MS + 1, best: 300 }).what, null, 'still closing: it runs on');
});

test('TV7 host: the bands about the traveller kept a life and a pixel; made once of Daggerfall\'s themed groups from their own seed; seen from above with their kind and number, a chaser held at the edge; the chase under the view, the contact standing exactly that band; the enhanced interface outdoors', async () => {
  const { readFileSync } = await import('node:fs');
  const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
  const w = rd('src/scenes/world.js');
  assert.match(rd('src/systems/campEncounters.js'), /^export function rollGroupComposition\(ctx, rolls\) \{/m, 'the themed group is the camps\' own');
  assert.match(w, /const bandNowMs = \(\) => Date\.now\(\) \+ \(online \? _sharedOffsetMs : 0\);/, 'the shared clock online');
  assert.match(w, /return px >= 0 && py >= 0 && px < 1000 && py < 500 && !tvWater\(px, py\) && !locationIndex\.has\(`\$\{px\},\$\{py\}`\);/, 'never the water, never a place');
  assert.match(w, /tvBandSeen = \{ at, life, list: bandsNear\(\{ at, ms, night: bandNight\(life \* BAND_LIFE_MS\), ok: bandOk \}\) \};/, 'the night the life began in - the same for everyone');
  assert.match(w, /const hit = rollGroupComposition\(\{ climateIndex: maps\.getClimateIndex\(px, py\), playerLevel: playerEntity\.level, inLocationRect: false,\n\s*gameMinutes: bandNight\(b\.bornMs\) \? 0 : 720 \}, seededRng\(b\.seed\)\);/, 'made from its own seed');
  assert.match(w, /if \(!up \|\| _bandChase\.size >= 2\) continue;/, 'only under the view does a band first see me; two chasers at most');
  assert.match(w, /if \(d > sight\) continue;/);
  assert.match(w, /const s = chaseStep\(\{ pos: c\.pos, feet, dt, scale: worldTimeScale\(\), contact: up \? BAND_CONTACT_M : BAND_STAND_M, since: c\.since, now: ms, best: c\.best \}\);/, 'the journey\'s pace; the view\'s reach or the stand-off');
  assert.match(w, /else if \(s\.what === 'contact'\) \{ _bandChase\.delete\(b\.id\); _bandSpent\.add\(b\.id\); bandStand\(bandMake\(b\), c\.pos\); \}/, 'contact stands the band, once');
  assert.match(w, /if \(s\.what === 'lost'\) \{ _bandChase\.delete\(b\.id\); _bandSpent\.add\(b\.id\); \}/, 'a lost trail: the band is gone for its life');
  assert.match(w, /if \(!isEnhanced\(\) \|\| \(modes\?\.mode \?\? 'exterior'\) !== 'exterior' \|\| !walkMode \|\| !playerSpawned \|\| getPref\('wildernessCamps'\) === false\n\s*\|\| playerEntity\.preventEnemySpawns \|\| player\.isPlayerSwimming\) \{ _bandChase\.clear\(\); return; \}/, 'the enhanced interface, outdoors, the camps\' own switch, never at sea');
  assert.match(w, /_standCampEncounter\(\{ kind: 'pack', mobileTypes: mk\.mobileTypes, spacing: PACK_SPACING, alertRadius: PACK_ALERT_RADIUS,\n\s*minDistance: 18, maxDistance: 32, bearingDegrees: 0, yawRad: Math\.atan2\(sp\[0\] - fx\[0\], sp\[2\] - fx\[2\]\) \}, fx\);/, 'on its own bearing');
  assert.match(w, /anchor = campAnchorSpot\(\{ feet, yawRad: hit\.yawRad \?\? cam\.yaw, fovDegrees:/, 'the camps\' anchor takes the band\'s bearing');
  assert.match(w, /const chasing = _bandChase\.has\(b\.id\), p = bandPlace\(b, bms\);\n\s*marks\.push\(\{ key: `band:\$\{b\.id\}`, at: tvSceneKept\(b, p\.x, p\.z, 2\), label: bandLabel\(mk\.name, partyGroupMembers\(mk\.mobileTypes, partySize\(\)\)\.length\), kind: chasing \? 'band chase' : 'band', edge: chasing \}\);/, 'seen from above');
  assert.match(w, /bandFrame\(performance\.now\(\)\);   \/\/ TV7/);
  assert.match(w, /tvBandSeen = \{ at: null, life: -1, list: \[\] \}; _bandChase\.clear\(\); _bandSpent\.clear\(\); _bandMake\.clear\(\); _bandPos\.clear\(\);/, 'a load forgets them');
  const hud = await import('../src/ui/travelViewHud.js');
  assert.equal(hud.TRAVEL_VIEW_MARK_COLORS.band, '#e0503c');
  assert.match(rd('src/ui/travelViewHud.js'), /\|\| k === 'lair' \|\| k === 'band' \? k : 'traveller';/);
});
