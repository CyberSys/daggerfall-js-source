// LW3 (bible/06-Systems/Living-World.md): A SYNTHETIC MAP for the roads' pins - towns on a grid of map pixels (the
// MAPS row's own columns: mapId, px, py, blocks, people, region, type, port), the planner's way between two as the
// straight run of pixels between them, and the census's own traveller rosters. No game data.
import { travellerRoster } from '../src/systems/livingWorld/census.js';

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
