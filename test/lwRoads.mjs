// LW3 (bible/06-Systems/Living-World.md): A SYNTHETIC MAP for the roads' pins - towns on a grid of map pixels (the
// MAPS row's own columns: mapId, px, py, blocks, people, region, type, port), the planner's way between two as the
// straight run of pixels between them, and the census's own traveller rosters. No game data.
import { travellerRoster, mintResident } from '../src/systems/livingWorld/census.js';
import { townTrips, placeCycle, CALENDAR_MPM } from '../src/systems/livingWorld/trips.js';
import { placeAt, turnKey } from '../src/systems/livingWorld/lives.js';
import { troubleOf, troubledTrip } from '../src/systems/livingWorld/trouble.js';
import { rollGroupComposition } from '../src/systems/campEncounters.js';
import { ENEMY_BASICS } from '../src/characters/enemyBasics.js';
import { DAY_MIN } from '../src/systems/livingWorld/dayPlan.js';

/** Towns every `step` pixels on a `n` x `n` grid from (x0, y0); each town's blocks off its place. */
export function synthMap({ x0 = 100, y0 = 100, n = 9, step = 5 } = {}) {
  const towns = [];
  let id = 1000;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = x0 + i * step, y = y0 + j * step;
    towns.push({ mapId: id++, px: x, py: y, blocks: 4 + ((x * 7 + y * 3) % 30), region: 17, people: 3, type: 0, name: `T${x}_${y}`, port: false });
  }
  const rosters = new Map();
  let asked = 0;
  const world = {
    townsNear: (px, py, r) => towns.filter((t) => Math.max(Math.abs(t.px - px), Math.abs(t.py - py)) <= r).sort((a, b) => a.mapId - b.mapId),
    routeOf: (a, b) => {
      asked++;
      const k = Math.max(Math.abs(a.px - b.px), Math.abs(a.py - b.py));
      const pixels = [];
      for (let i = 0; i <= k; i++) pixels.push({ x: Math.round(a.px + ((b.px - a.px) * i) / k), y: Math.round(a.py + ((b.py - a.py) * i) / k) });
      return { pixels, kinds: pixels.slice(1).map(() => 'road') };
    },
    rosterOf: (t) => { let r = rosters.get(t.mapId); if (!r) { r = travellerRoster(t); rosters.set(t.mapId, r); } return r; },
    templeTown: (t) => t.blocks >= 16,
  };
  return { towns, world, asked: () => asked };
}

// LW4: the map with the lives and the trouble on it, as the host composes them (world.js) - for the trouble's pins and
// the live fight's.
/** The synthetic map with the lives and the trouble on it, as the host composes them (world.js). */
export function livingMap({ turns = null, climate = 230 } = {}) {
  const m = synthMap();
  const { towns, world } = m;
  const byId = new Map(towns.map((t) => [t.mapId, t]));
  const book = new Map();
  const placeOf = (res, k) => {
    const key = turnKey(res, k);
    let g = book.get(key);
    if (!g) {
      const pl = placeAt(res, k, turns);
      g = { holder: pl.vacant ? null : pl.holder == null ? res : mintResident(byId.get(res.town), 't', res.slot, res.job, { gen: pl.holder }), dies: !pl.vacant && pl.dies };
      book.set(key, g);
    }
    return g;
  };
  const trouble = {
    climateAt: () => climate,
    foesOf: ({ climateIndex, minute, level, size, rolls }) => rollGroupComposition({ climateIndex, skyMinutes: minute, inLocationRect: false, playerLevel: level, size }, rolls)?.mobileTypes ?? null,
    foeLevel: (type, level) => (type >= 128 ? level : ENEMY_BASICS[type]?.level ?? level),
    dies: (res, trip) => { const roster = world.rosterOf(byId.get(res.town)); const place = roster.find((r) => r.slot === res.slot) ?? res; return placeOf(place, placeCycle(place, roster, Math.floor(trip.outT0 / DAY_MIN), 1)).dies; },
    turnOf: (id) => (turns?.won?.has(id) ? 'won' : turns?.lost?.has(id) ? 'lost' : null),
  };
  world.holderOf = (res, k) => placeOf(res, k).holder;
  world.fated = (res, k) => placeOf(res, k).dies;
  world.fate = (trip) => troubledTrip(trip, troubleOf(trip, trouble));
  return { ...m, byId, placeOf, trouble };
}

/** Every party of every town over a run of days, each once, troubled as the host troubles them. */
export function partiesOver(map, d0, d1, o = { mpm: CALENDAR_MPM, memo: new Map() }) {
  const seen = new Map();
  for (let day = d0; day < d1; day++) for (const town of map.towns) for (const tr of townTrips(town, day * DAY_MIN + 720, map.world, o)) seen.set(tr.id, tr);
  return [...seen.values()];
}
