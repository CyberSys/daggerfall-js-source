// B1 (AUDIT 25 blocker 1): the HOST half of quest foe spawning.
//
// The quest machine has declared the spawn seams since Q3-iii -
// world.createFoeGameObjects(foe, count) and world.tryPlaceFoe(handle)
// (contract in systems/quest/machine.js) - and the placement law,
// PlaceFoeFreely, has sat fully ported in sceneMount.js with NO
// CALLER. This module is the wiring both foe pools share:
//
//   mintQuestFoeWave     - GameObjectHelper.CreateFoeGameObjects
//                          (GameObjectHelper.cs:1243-1305): mint
//                          `count` INACTIVE handles, one behaviour
//                          each, activation deferred to placement
//   bindQuestFoeHost     - the QuestResourceBehaviour host handle
//                          over a live pool foe (the `enemy` surface
//                          resourceBehaviour.js documents)
//   placeFoeEnv          - the placeFoeFreely env adapter over the
//                          port's collider ([x,y,z] arrays in, the
//                          law's {x,y,z} objects out)
//   questFoeGender       - the Foe resource's own 0.55-male humanoid
//                          gender (Foe.cs:290, rolled at construction
//                          and already ported in quest/foe.js), the
//                          same read sceneMount's marker stand uses
//
// DFU builds each enemy GameObject whole and inactive, then
// TryPlacement positions + activates one per machine tick. The port's
// foe build is async (textures), so a handle here is DATA until
// placement finds a spot; the pool's async build then stands the foe
// a beat later. A build that fails after placement (a missing
// CLASS*.CFG) logs loudly and the foe never appears - DFU's
// equivalent failure throws at mint. Recorded runtime difference.

import { QuestResourceBehaviour } from '../systems/quest/resourceBehaviour.js';
import { applySpell } from '../systems/effects.js';
import { GENDERS } from '../characters/nameHelper.js';

export function questFoeGender(foe) { return foe.gender === GENDERS.Female ? 'female' : 'male'; }

/** CreateFoeGameObjects' mint loop (:1248-1305), data-side: one
 *  handle + one QuestResourceBehaviour per instance (AddComponent +
 *  AssignResource, :1276-1280), count clamped 1..8 (:1248 - foe.js
 *  clamps spawnCount at parse too; kept for direct callers).
 *  behaviour.start() waits for placement: the C# objects are
 *  SetActive(false), so Unity defers Start until activation. The
 *  resource's own questResourceBehaviour field couples in
 *  behaviour.update() ("coupling is otherwise lost"), so a wave of
 *  several instances ends owned by the last updated - C#'s shape. */
export function mintQuestFoeWave(machine, foe, count) {
  const total = Math.min(Math.max(count, 1), 8);
  const handles = [];
  for (let i = 0; i < total; i++) {
    const behaviour = new QuestResourceBehaviour(machine);
    behaviour.assignResource(foe);
    handles.push({ foe, behaviour });
  }
  return handles;
}

/** The behaviour's host handle over a live pool foe `f` (the pool
 *  record shape both pools share: { entity, ai, dead, corpse }).
 *  pool supplies: removeFoe(f) - Destroy(gameObject) (the isHidden
 *  teardown); zeroFoeHealth(f) - the DeathTrigger zeroing routed
 *  through the pool's own death door so corpse/loot/alert all run;
 *  spellsByIndex() + foeSinks(f) + rolls - the CastSpellQueue drain.
 *  Called at PLACEMENT (the activation moment), so behaviour.start()
 *  runs here - Unity defers Start on an inactive object. */
export function bindQuestFoeHost(f, behaviour, pool) {
  const host = {
    // Person hide/show only in core - no Foe caller reaches setActive
    // (behaviour.update tears a hidden Foe DOWN via destroy instead)
    setActive: () => {},
    destroy: () => pool.removeFoe(f),
    enemy: {
      get currentHealth() { return f.entity.health; },
      get maxHealth() { return f.entity.maxHealth; },
      setCurrentHealth: (n) => { if (n <= 0) pool.zeroFoeHealth(f); else f.entity.health = n; },
      setNonHostile: () => { if (f.ai) f.ai.isHostile = false; },
      // wave 31/32: every port entity runs the broker's magic rounds,
      // so the manager always stands - the queue never parks here
      hasEffectManager: () => true,
      /** CastSpellQueue's per-entry drain (QuestResourceBehaviour.cs:
       *  293-351): resolve the classic record and AssignBundle with
       *  BypassSavingThrows; the bundle's caster is the foe ITSELF
       *  (enemyEntityBehaviour), so casterLevel is the foe's level. A
       *  record the seam cannot resolve - custom keys included, the
       *  port has no custom effect registry - is skipped, never
       *  retried, C#'s own `continue`. */
      assignSpellBundle: (ref) => {
        if (ref?.customKey) return;
        const record = pool.spellsByIndex?.()?.get?.(ref?.classicId);
        if (!record) return;
        applySpell(record, f.entity.level ?? 1, f.entity, pool.foeSinks(f), pool.rolls ?? Math.random, null, { bypassSavingThrows: true });
      },
      // The port's corpse loot IS the entity's items (both pools'
      // takeLoot reads them), so the corpse and live arms of
      // AddItemQueue land in the one place and this stays false.
      hasCorpseLootContainer: () => false,
      addItemsToEntity: (items) => { if (items) (f.entity.items ??= []).push(...items); },
    },
  };
  f.questBehaviour = behaviour;
  behaviour.bindHost(host);
  behaviour.start();
  return host;
}

/** placeFoeFreely's env over the port collider. isOccupied(point,
 *  radius) is the host's entity term: characters are not in the
 *  collider's triangle soup (its own comment says so), where Unity's
 *  OverlapSphere sees their capsules - the caller supplies foe and
 *  player proximity. */
export function placeFoeEnv({ collider, playerFeet, playerYawRad, fovDegrees, rolls = Math.random, isOccupied = null }) {
  const toObj = (p) => ({ x: p[0], y: p[1], z: p[2] });
  return {
    playerPosition: toObj(playerFeet),
    playerYawRadians: playerYawRad,
    fovDegrees,
    rolls,
    raycast: (origin, dir, maxDist) => {
      const o = [origin.x, origin.y, origin.z];
      const d = [dir.x, dir.y, dir.z];
      const h = collider.raycastHit(o, d, maxDist);
      let dist = h.dist;
      let normal = h.normal;
      // THE ANALYTIC FLOOR IS GROUND TOO (the guards-run-in-place
      // class of bug): the exterior collider's terrain and town
      // surface live in heightAt, not in triangles, so the law's
      // straight-down floor probe found no ground anywhere in the
      // open and no exterior spot could ever place a foe. Same fix as
      // the motor's FallCheck.
      if (d[1] < -0.999 && Math.abs(d[0]) < 1e-6 && Math.abs(d[2]) < 1e-6) {
        const drop = o[1] - (collider.heightAt?.(o[0], o[2]) ?? -Infinity);
        if (drop >= 0 && drop <= maxDist && drop < dist) { dist = drop; normal = [0, 1, 0]; }
      }
      if (!Number.isFinite(dist) || dist > maxDist) return null;
      return {
        point: { x: o[0] + d[0] * dist, y: o[1] + d[1] * dist, z: o[2] + d[2] * dist },
        normal: normal ? { x: normal[0], y: normal[1], z: normal[2] } : { x: -d[0], y: -d[1], z: -d[2] },
        distance: dist,
      };
    },
    overlapSphere: (p, r) => collider.sphereOverlaps([p.x, p.y, p.z], r) || (isOccupied?.(p, r) ?? false),
  };
}

/** The occupancy term over a foe list + the player: DFU's
 *  OverlapSphere(0.65) catches character capsules; the port tests
 *  centre distance against the test radius + the capsule radius the
 *  pools stand foes at (~0.45). feetOf(f) answers a foe's [x,y,z]. */
export function entityOccupancy(feetOf, liveFoes, playerFeet) {
  const CAPSULE_R = 0.45;
  return (p, r) => {
    const hit = (feet, half = 0.9) => {   // REVIEW 2026-09-05: a foe's sphere sits at ITS capsule centre
      if (!feet) return false;
      const dx = feet[0] - p.x, dy = feet[1] + half - p.y, dz = feet[2] - p.z;
      return dx * dx + dy * dy + dz * dz < (r + CAPSULE_R) * (r + CAPSULE_R);
    };
    if (hit(playerFeet)) return true;
    for (const f of liveFoes()) if (!f.dead && hit(feetOf(f), (f.ai?.height ?? 1.8) / 2)) return true;
    return false;
  };
}

/** QUEST-WAVE (2026-09-26, SquidKamer, Warm Ashes - Ships' author: "ship encounters ... get jumped by everyone"):
 *  THE SPOTS A PLACEMENT HOLDS UNTIL ITS FOE LANDS, per scene (keyed by its collider). PlaceFoeFreely's OverlapSphere
 *  meets every placed foe's capsule (CreateFoe.cs:319-323 - Unity syncs a placed foe's transform before the next
 *  action's test, in the same tick), but a pool's stand is async here - the career, the texture - and its record joins
 *  the pool only after. So a wave placed in ONE machine tick (WAQ_SHIP_SMALLRAID's thirteen) saw none of its own and
 *  stood in a heap: every spot of a tick falls in the same two slivers of the view's edge. AUDIT 68 S21 held the loose
 *  foes' spots; every arm holds them here now, in one set a scene, so a quest wave, a loose foe and each other all
 *  see what is in flight. A held spot is a capsule centred on the point the law tested, released when the stand
 *  settles - by then its record stands in the pool. */
const _heldSpots = new WeakMap();
export function heldSpots(collider) {
  let set = _heldSpots.get(collider);
  if (!set) _heldSpots.set(collider, (set = new Set()));
  return set;
}
/** Hold `spot` while `stand()` runs its async chain; answers the stand's promise, the hold released either way. */
export function holdSpotWhile(collider, spot, stand) {
  const set = heldSpots(collider);
  const held = { ai: { feet: [spot.x, spot.y - 0.9, spot.z], height: 1.8 } };   // a capsule centred on the tested point
  set.add(held);
  const release = () => { set.delete(held); };
  let landing;
  try { landing = stand(); } catch (err) { release(); throw err; }
  return Promise.resolve(landing).finally(release);
}

/** QUEST-POPUP-PAUSE (2026-09-26, SquidKamer on the Discord: a ship raid's box came up and the player "get[s] jumped
 *  by everyone"; Mac, asked: "Pause them offline"). DFU's message box pauses the game (UserInterfaceWindow
 *  .PauseWhileOpen), so a quest's box held every foe. WINFOE1 let the foes run under every window; offline they stand
 *  still again while the host's quest box is open and the window on top of its slot - a rest window keeps WINFOE1,
 *  and the rest under a box resumes with the foes. Online the room keeps one clock for everyone: nothing is held.
 *  Both outdoor hosts ask this (world.js, exterior.js), and hand the answer to the mode machine's interior pools. */
export const questBoxHoldsFoes = (win, { online, onTop }) => !online && !!win && !win.done && !!onTop(win);

/** AUDIT 63r F24 - SerializableEnemy.RestoreSaveData's quest-link arm
 *  (Serialization/SerializableEnemy.cs:206-217), the ONE home for it:
 *
 *      enemy.QuestSpawn = data.questSpawn;
 *      if (enemy.QuestSpawn) {
 *          var b = gameObject.AddComponent<QuestResourceBehaviour>();
 *          b.RestoreSaveData(data.questResource);
 *          if (b.QuestUID == 0 || b.TargetSymbol == null) {
 *              enemy.QuestSpawn = false; Destroy(b);
 *          }
 *      }
 *
 *  The foe POOLS carry no dependency on the quest machine, so the host
 *  that owns one hands this in as `restoreWorld`'s
 *  `reviveQuestBehaviour`. It lives here rather than in either host
 *  because BOTH need it - the interior pools (worldModes
 *  .restoreInteriorPools) and the exterior pool (world.js's load arm),
 *  which is the same law under a different WorldContext - and because
 *  bindQuestFoeHost, the mint-side half of the same link, is already
 *  here. Returns null for a record that names no quest, which is the
 *  Destroy: the foe stands plain.
 *
 *  @param machine the live QuestMachine, or null on a host without one
 *  @param data    the record's `questResource` (GetSaveData's object) */
export function reviveQuestBehaviour(machine, data) {
  if (!machine || !data) return null;
  const b = new QuestResourceBehaviour(machine);
  b.restoreSaveData(data);
  if (!b.questUID || b.targetSymbol == null) return null;   // :214-217 - QuestSpawn = false; Destroy(questResourceBehaviour)
  return b;
}
