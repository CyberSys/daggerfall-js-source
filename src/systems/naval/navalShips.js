// @ts-check
// NAV-A (2026-09-28, Mac: "introduce actual sailing ships to the world that players can encounter and pillage") -
// THE SHIPS: what each of Come Sail Away's five hulls carries into a fight, and the classes the Iliac Bay's
// captains sail them as. The port's own numbers - DFU has no cannon, and the mod's hulls none either.
//
// THE GUNS SIT WHERE THE HULLS ARE. Every muzzle below was measured off the vendored prefabs themselves (the hull's
// MeshCollider, `vendor/come-sail-away/Models/`, cast at from outside and from above at each station - the
// scratch probe the arc page records): a broadside's guns stand 0.9 m over the deck they are mounted on, along the
// waist where that deck runs clear, and a hair outside the planking at that height; a bow chaser on the forecastle,
// a stern gun over the transom. The numbers are in the boat ROOT's frame (Unity's: +x starboard, +y up, +z the
// bow), where SpawnBoat stands the hull - the root sits on the waterline. The port side is the starboard side
// mirrored (x negated); `batteryMuzzles` makes it.
//
// Black Flag's arsenal, on a Daggerfall deck:
//   long   - the broadside's long guns: laid square to the hull, the ship the traverse
//   swivel - a small boat's swivel guns: quick, light, short
//   heavy  - a galley's great bow guns, fired over the stem
//   chain  - the bow chasers loaded with chain: they cut rigging (sails) more than they hole a hull
//   barrel - fire barrels rolled off the stern: they float, and burst on the first hull that meets them
// Which the player fires is chosen by where they look (systems/naval/navalGunnery.js): the side a broadside, the
// bow the chasers, astern the barrels.
//
// SHIP CLASSES are the sea's captains: a class is a hull, a faction (pirates, merchantmen, a kingdom's navy), its
// own durability and crew, its speed and its handiness, and what its hold is worth. `classFor` picks one the way the
// encounter director asks (systems/naval/navalDirector.js): by faction and the player's level.
//
// NAMES are seeded - a ship's seed names it the same on every client in a room. A captain's name is DFU's own
// NameHelper.FullName over the region's bank (characters/nameHelper.js, verbatim), drawn on the seed's own DFRandom
// stream and the global stream put back after, so naming a ship moves no other system's rolls.

import { srand, getSeed, setSeed } from '../../formats/dfRandom.js';
import { fullName, getNameBankOfRegion, GENDERS } from '../../characters/nameHelper.js';
import { REGION_NAMES } from '../../formats/mapsFile.js';
import { mulberry32 } from '../../combat/bloodArt.js';

/** Come Sail Away's hull indices (systems/comeSailAwayBoat.js HULL_NAMES). */
export const HULL = Object.freeze({ Rowboat: 0, LargeBoat: 1, SmallShip: 2, LargeGalley: 3, Carrack: 4 });

/**
 * The gun kinds. `speed` the muzzle speed (m/s); `minEl`/`maxEl` the carriage's elevation (degrees); `reload`
 * seconds with a full crew; `yawSpread`/`pitchSpread` degrees; `radius` the ball's (m, for the hit's sweep and the
 * draw); `hull`/`sail`/`crew` the damage one ball does to each. A barrel has no flight: it floats.
 */
export const GUNS = Object.freeze({
  long: Object.freeze({ speed: 62, minEl: -3, maxEl: 15, reload: 9, yawSpread: 1.6, pitchSpread: 0.9, radius: 0.11, hull: 14, sail: 3, crew: 1 }),
  swivel: Object.freeze({ speed: 55, minEl: -6, maxEl: 14, reload: 4, yawSpread: 1.3, pitchSpread: 0.8, radius: 0.07, hull: 5, sail: 2, crew: 2 }),
  heavy: Object.freeze({ speed: 56, minEl: -2, maxEl: 13, reload: 12, yawSpread: 2.0, pitchSpread: 1.0, radius: 0.15, hull: 30, sail: 4, crew: 2 }),
  chain: Object.freeze({ speed: 58, minEl: -2, maxEl: 16, reload: 7, yawSpread: 2.2, pitchSpread: 1.2, radius: 0.13, hull: 3, sail: 16, crew: 1 }),
  barrel: Object.freeze({ speed: 0, minEl: 0, maxEl: 0, reload: 6, yawSpread: 0, pitchSpread: 0, radius: 0.5, hull: 45, sail: 6, crew: 3 }),
});

/** A fire barrel's life afloat (s), the radius a hull sets it off within (m), and a burn it leaves (s). */
export const BARREL = Object.freeze({ life: 90, fuse: 7, burn: 12, burnPerSecond: 2.5, stock: 4 });

/** The four batteries, and the local direction each fires along. */
export const SIDES = Object.freeze(['starboard', 'port', 'bow', 'stern']);
export const SIDE_DIR = Object.freeze({ starboard: Object.freeze([1, 0, 0]), port: Object.freeze([-1, 0, 0]), bow: Object.freeze([0, 0, 1]), stern: Object.freeze([0, 0, -1]) });

/**
 * Each hull's fighting build, measured off its prefab. `broadside` lists the STARBOARD muzzles (the port side is
 * their mirror); `bow` and `stern` their own. `hullHp`, `sailHp` and `crew` are what the PLAYER's boat of that hull
 * stands with; a class scales them. `deck` is the height boarders stand on, `beam` the half beam at it, `ram` a bow
 * that rams (the galley's).
 */
export const HULL_BUILDS = Object.freeze([
  Object.freeze({   // 0 Rowboat - no guns; a rowboat is shot at, never fights
    hull: 0, gun: null, broadside: Object.freeze([]), bow: null, stern: null,
    hullHp: 60, sailHp: 0, crew: 0, deck: 0.1, beam: 1.0, ram: false,
  }),
  Object.freeze({   // 1 Large Boat - swivels on the gunwale (1.2 m), three a side and one in the bow
    hull: 1, gun: 'swivel',
    broadside: Object.freeze([[1.8, 1.3, -2.3], [2.05, 1.3, 0.3], [1.8, 1.3, 2.3]].map(Object.freeze)),
    bow: Object.freeze({ gun: 'swivel', muzzles: Object.freeze([Object.freeze([0, 1.6, 5.9])]) }),
    stern: null,
    hullHp: 150, sailHp: 60, crew: 0, deck: 0.1, beam: 1.9, ram: false,
  }),
  Object.freeze({   // 2 Small Ship - the gun deck at 3.64, ports 0.9 over it from the quarter to the forecastle
    hull: 2, gun: 'long',
    broadside: Object.freeze([[7.2, 4.5, -12], [7.8, 4.5, -8], [8.1, 4.5, -4.5], [7.8, 4.5, -1], [7.4, 4.5, 2.5], [7.0, 4.5, 6]].map(Object.freeze)),
    bow: Object.freeze({ gun: 'chain', muzzles: Object.freeze([Object.freeze([-1.4, 7.6, 16.0]), Object.freeze([1.4, 7.6, 16.0])]) }),
    stern: Object.freeze({ gun: 'barrel', muzzles: Object.freeze([Object.freeze([0, 7.6, -23.0])]) }),
    hullHp: 420, sailHp: 160, crew: 24, deck: 3.64, beam: 7.4, ram: false,
  }),
  Object.freeze({   // 3 Large Galley - four long guns a side on the upper deck (10.25), three heavy guns over the stem, a ram
    hull: 3, gun: 'long',
    broadside: Object.freeze([[9.3, 11.1, -20], [9.3, 11.1, -8], [9.3, 11.1, 4], [9.3, 11.1, 16]].map(Object.freeze)),
    bow: Object.freeze({ gun: 'heavy', muzzles: Object.freeze([Object.freeze([-1.6, 8.3, 45.0]), Object.freeze([0, 8.3, 46.0]), Object.freeze([1.6, 8.3, 45.0])]) }),
    stern: null,
    hullHp: 520, sailHp: 90, crew: 60, deck: 10.25, beam: 8.8, ram: true,
  }),
  Object.freeze({   // 4 Carrack - seven long guns a side on the main deck (3.64), chasers under the forecastle, barrels astern
    hull: 4, gun: 'long',
    broadside: Object.freeze([[6.3, 4.5, -16], [7.0, 4.5, -12], [7.7, 4.5, -8], [7.9, 4.5, -4.2], [7.4, 4.5, 0], [7.1, 4.5, 4.2], [5.8, 4.5, 8.4]].map(Object.freeze)),
    bow: Object.freeze({ gun: 'chain', muzzles: Object.freeze([Object.freeze([-1.2, 10.1, 19.5]), Object.freeze([1.2, 10.1, 19.5])]) }),
    stern: Object.freeze({ gun: 'barrel', muzzles: Object.freeze([Object.freeze([0, 7.6, -27.5])]) }),
    hullHp: 560, sailHp: 220, crew: 30, deck: 3.64, beam: 7.4, ram: false,
  }),
]);

/** A hull's build, or the rowboat's for anything unknown. */
export const hullBuild = (hull) => HULL_BUILDS[hull] ?? HULL_BUILDS[0];

/** A battery's muzzles in the root's frame, and its gun kind; null when the hull has none on that side. */
export function batteryOf(hull, side) {
  const b = hullBuild(hull);
  if (side === 'starboard' || side === 'port') {
    if (!b.gun || !b.broadside.length) return null;
    const s = side === 'port' ? -1 : 1;
    return { side, gun: b.gun, muzzles: b.broadside.map((m) => [m[0] * s, m[1], m[2]]) };
  }
  const k = side === 'bow' ? b.bow : side === 'stern' ? b.stern : null;
  return k ? { side, gun: k.gun, muzzles: k.muzzles.map((m) => [...m]) } : null;
}
/** Every battery a hull carries. */
export const batteriesOf = (hull) => SIDES.map((s) => batteryOf(hull, s)).filter(Boolean);

// ── factions and classes ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * The three kinds of captain. `hostile` - fights on sight; `lawful` - boarding or sinking one is piracy (DFU's own
 * crime, `court.js` CRIMES.Piracy) in the waters' region; `flees` - runs once hurt rather than fights it out.
 * `flag` the colour the pennant flies (the port's; FlagMaterial's orange is the player's own boats).
 */
export const NAVAL_FACTIONS = Object.freeze({
  pirate: Object.freeze({ id: 'pirate', title: 'Pirates', hostile: true, lawful: false, flees: false, flag: Object.freeze([0.1, 0.09, 0.08]) }),
  merchant: Object.freeze({ id: 'merchant', title: 'Merchantman', hostile: false, lawful: true, flees: true, flag: Object.freeze([0.92, 0.82, 0.3]) }),
  navy: Object.freeze({ id: 'navy', title: 'Navy', hostile: false, lawful: true, flees: false, flag: Object.freeze([0.62, 0.1, 0.09]) }),
});
export const FACTION_IDS = Object.freeze(Object.keys(NAVAL_FACTIONS));

/**
 * The classes. `hullHp`/`sailHp`/`crew` scale the hull's own build; `speed` is the best way it makes with the wind
 * on the quarter (m/s), `turn` degrees a second at way, `skill` the gunners' (0..1: the scatter halved at 1, and how
 * well they lead), `range` how close it likes to fight (m), `cargo` the hold's worth (1-4, navalPlunder.js),
 * `minLevel` the player's level it first sails against, `weight` how often among its faction, `boarders` the muster a
 * boarding meets, `tactic` how it fights ('broadside', or a galley's 'bow' - its great guns over the stem). A flagship
 * carries a named captain the quest makes its boss.
 */
export const SHIP_CLASSES = Object.freeze([
  cls('pirateSloop', 'pirate', HULL.LargeBoat, 'Pirate Sloop', { hullHp: 1.1, sailHp: 1, crew: 10, speed: 4.4, turn: 16, skill: 0.45, range: 55, cargo: 1, minLevel: 1, weight: 5, boarders: 8 }),
  cls('pirateBrig', 'pirate', HULL.SmallShip, 'Pirate Brigantine', { hullHp: 0.9, sailHp: 0.9, crew: 22, speed: 3.7, turn: 9, skill: 0.55, range: 95, cargo: 2, minLevel: 4, weight: 4, boarders: 13 }),
  cls('pirateGalley', 'pirate', HULL.LargeGalley, 'Corsair Galley', { hullHp: 0.85, sailHp: 1, crew: 40, speed: 3.4, turn: 8, skill: 0.5, range: 80, cargo: 2, minLevel: 7, weight: 2, boarders: 13, tactic: 'bow' }),
  cls('pirateFlagship', 'pirate', HULL.Carrack, 'Pirate Flagship', { hullHp: 1.15, sailHp: 1, crew: 34, speed: 3.0, turn: 6, skill: 0.7, range: 110, cargo: 4, minLevel: 9, weight: 1, boarders: 20, flagship: true }),
  cls('merchantCoaster', 'merchant', HULL.LargeBoat, 'Coasting Trader', { hullHp: 0.9, sailHp: 1, crew: 5, speed: 3.9, turn: 13, skill: 0.25, range: 60, cargo: 1, minLevel: 1, weight: 5, boarders: 5 }),
  cls('merchantGalleon', 'merchant', HULL.SmallShip, 'Merchant Galleon', { hullHp: 0.8, sailHp: 0.9, crew: 14, speed: 3.1, turn: 8, skill: 0.3, range: 110, cargo: 3, minLevel: 3, weight: 3, boarders: 9 }),
  cls('merchantCarrack', 'merchant', HULL.Carrack, 'Merchant Carrack', { hullHp: 0.9, sailHp: 0.9, crew: 18, speed: 2.5, turn: 5, skill: 0.3, range: 120, cargo: 4, minLevel: 5, weight: 2, boarders: 11 }),
  cls('navyCutter', 'navy', HULL.SmallShip, 'Navy Cutter', { hullHp: 1, sailHp: 1, crew: 26, speed: 3.9, turn: 10, skill: 0.75, range: 90, cargo: 2, minLevel: 1, weight: 3, boarders: 14 }),
  cls('navyGalley', 'navy', HULL.LargeGalley, 'War Galley', { hullHp: 1, sailHp: 1, crew: 60, speed: 3.5, turn: 9, skill: 0.7, range: 70, cargo: 2, minLevel: 6, weight: 2, boarders: 18, tactic: 'bow' }),
]);

function cls(id, faction, hull, title, o) {
  const b = hullBuild(hull);
  return Object.freeze({
    id, faction, hull, title,
    hullHp: Math.round(b.hullHp * o.hullHp), sailHp: Math.round(b.sailHp * o.sailHp), crew: o.crew,
    speed: o.speed, turn: o.turn, skill: o.skill, range: o.range, cargo: o.cargo, minLevel: o.minLevel,
    weight: o.weight, boarders: o.boarders, flagship: !!o.flagship, tactic: o.tactic ?? 'broadside',
  });
}
export const classById = (id) => SHIP_CLASSES.find((c) => c.id === id) ?? null;

/**
 * The class a spawn sails, by faction and the player's level: every class of the faction the level has reached,
 * weighed by `weight` - the draw `r` in [0, 1). A level below every class's still gets the faction's first.
 */
export function classFor(faction, level, r) {
  const pool = SHIP_CLASSES.filter((c) => c.faction === faction && c.minLevel <= Math.max(1, level | 0));
  const list = pool.length ? pool : SHIP_CLASSES.filter((c) => c.faction === faction).slice(0, 1);
  const total = list.reduce((s, c) => s + c.weight, 0);
  let x = Math.max(0, Math.min(0.999999, r)) * total;
  for (const c of list) { if ((x -= c.weight) < 0) return c; }
  return list[list.length - 1] ?? null;
}

// ── names ────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The three great crowns of the Bay, and whose waters (Daggerfall's 3E 405 - Gothryd, Eadwyre, Akorithi). */
export const CROWNS = Object.freeze([
  Object.freeze({ region: 17, name: 'Daggerfall', ruler: 'Gothryd', ships: Object.freeze(["Gothryd's Resolve", 'King Lysandus', "Mynisera's Grace", 'Daggerfall Vigilant', 'Stalwart', 'Breton Crown']) }),
  Object.freeze({ region: 23, name: 'Wayrest', ruler: 'Eadwyre', ships: Object.freeze(["Eadwyre's Vigil", 'Queen Barenziah', 'Wayrest Sentinel', 'Illessan Guard', 'Loyalty', 'Iliac Warden']) }),
  Object.freeze({ region: 20, name: 'Sentinel', ruler: 'Akorithi', ships: Object.freeze(["Akorithi's Justice", 'Prince Lhotun', 'Sentinel Sun', 'Desert Falcon', 'Crowned Serpent', 'Hammerfell Pride']) }),
]);

export const PIRATE_NAMES = Object.freeze([
  'Black Kraken', "Dreugh's Maw", 'Sea Hag', 'Red Wake', 'Gallows Wind', "Dagon's Tooth", 'Rotting Oar',
  'Salt Reaver', 'Stormcrow', "Hircine's Grin", 'Bloody Gull', 'Drowned King', 'Iliac Wraith', 'Slaughterfish',
  'Scourge of Betony', 'Night Tide', 'Widowmaker', 'Crimson Gannet',
]);
export const MERCHANT_NAMES = Object.freeze([
  'Wayrest Trader', 'Pride of Camlorn', 'Gilded Cog', 'Daggerfall Merchant', 'Abibon-Gora Spice', 'Bountiful',
  'Lady of Anticlere', 'Northmoor Wool', 'Honest Scale', 'Orsinium Iron', 'Bay Pilgrim', 'Glenpoint Lass',
  'Menevian Rose', 'Kambria Barley', 'Satakalaam Silk', 'Fair Winds of Tulune',
]);

/**
 * The crown whose waters these are: the nearest of the three capitals to the map pixel, where the host has found
 * them on the player's own map (`capitals`: `[{ region, x, y }]`, the three cities' pixels) - else the region's own
 * crown when it is one of the three, else Daggerfall's.
 */
export function crownOf(px, py, capitals = null, regionIndex = -1) {
  let best = null, bd = Infinity;
  for (const c of capitals ?? []) {
    const crown = CROWNS.find((k) => k.region === c.region);
    if (!crown || !Number.isFinite(c.x) || !Number.isFinite(c.y)) continue;
    const d = (c.x - px) ** 2 + (c.y - py) ** 2;
    if (d < bd) { bd = d; best = crown; }
  }
  return best ?? CROWNS.find((k) => k.region === regionIndex) ?? CROWNS[0];
}

/**
 * A ship's name and its captain's, from its seed: `{ name, captain, crown }`. A navy ship names its crown; a pirate
 * or a merchant a line from its own list. The captain is NameHelper.FullName over the region's bank on the seed's
 * own DFRandom stream - the global stream put back as it stood.
 * @param {any} shipClass
 * @param {number} seed
 * @param {{ regionIndex?: number, crown?: any }} [where] - the waters' region (the captain's name bank) and the crown
 *   a navy ship serves (crownOf's answer)
 */
export function shipNames(shipClass, seed, { regionIndex = 17, crown: crownIn = null } = {}) {
  const rng = mulberry32((seed ^ 0x5eaf00d) >>> 0);
  const pick = (list) => list[Math.floor(rng() * list.length) % list.length];
  let name, crown = null;
  if (shipClass.faction === 'navy') { crown = crownIn ?? crownOf(0, 0, null, regionIndex); name = pick(crown.ships); }
  else name = pick(shipClass.faction === 'pirate' ? PIRATE_NAMES : MERCHANT_NAMES);
  const saved = getSeed();
  let captain;
  try {
    srand((seed >>> 0) || 1);
    const bank = getNameBankOfRegion(regionIndex >= 0 && regionIndex < REGION_NAMES.length ? regionIndex : 17);
    captain = fullName(bank, rng() < 0.5 ? GENDERS.Male : GENDERS.Female);
  } finally { setSeed(saved); }
  return { name: `The ${name}`.replace(/^The The /, 'The '), captain, crown: crown?.name ?? null };
}

/** The line the target card reads under a ship's name: "Pirate Brigantine" / "Wayrest War Galley". */
export const classLine = (shipClass, crown = null) => (shipClass.faction === 'navy' && crown ? `${crown} ${shipClass.title}` : shipClass.title);
