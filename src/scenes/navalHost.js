// @ts-check
// NAV-H (2026-09-28, Mac: "enhance the newly integrated ships by adding proper naval combat with a huge reference to
// assassins creed black flag. Being able to aim and fire when viewing from the side. Along with this, I want to
// introduce actual sailing ships to the world that players can encounter and pillage, which should also directly
// enhance and integrate into the pirate quest system. ... directly integrate into online mode.") - THE NAVAL HOST:
// the sea fight, stood in the streaming world. It owns the ships of the Iliac Bay (systems/naval/navalAI.js) on Come
// Sail Away's own hulls (scenes/comeSailAwayPool.js `spawnSeaNow` - drawn, baked and lit as the player's boats), the
// guns of the player's boat and their aim, the shots and what they strike, the smoke and the spray, boarding and
// repelling boarders, the law, its record in the save, and its word to the other players in a cell.
//
// THE WORLD HOST IS ITS ONE HOST. The sea is the streaming world's (the exterior): a building or a dungeon has no
// broadside, and the other three hosts own no sea - THE FOUR HOSTS RULE, named in bible/03-World/Naval-Combat.md.
// Every seam it reaches is in `deps` (below), so the whole of it runs in Node under the tests.
//
// deps = {
//   pool                         scenes/comeSailAwayPool.js's (spawnSeaNow, remove, ready(), models, seaBoats)
//   csa() -> runtime | null      Come Sail Away's runtime (isSailing(), state.CurrentBoat, state.velocityCurrent,
//                                state.windVectorCurrent, StopSailing()) - null with the mod off
//   seaY() -> number             the sea's height in the scene
//   isWater(x, z, hull) -> bool  open water deep enough for a hull there
//   feet() -> [x, y, z]          the player's feet
//   look() -> { origin, dir }    the view's eye and its forward (the first-person eye, or Eye of the Beholder's)
//   level() -> number            the player's level
//   where() -> { px, py, region, day, nearPort, capitals, cityLights }  the waters: the map pixel, its region, the day
//                                number (the seeds and notoriety's decay), a port within reach, the three capitals'
//                                pixels (navalShips.js crownOf), the lanterns' hour
//   say(text, seconds), mid(text, seconds)     the HUD's line and the mid-screen word
//   audio: { play3d(key, pos, vol, opts), loop3d(key, pos, vol, opts) -> handle }
//   flame(pos) -> { move(pos), retire() }       a deck fire - Daggerfall's own fire flat (scenes/navalFlames.js)
//   law: { crime(region, crime), legal(region, n), faction(id, n) }
//   board: { leaveHelm(), placePlayer(pos, yaw), deckSpots(boat, n) -> [pos, yaw][], spawnFoe(mobile, pos, yaw, side)
//            -> handle, foeDown(handle) -> bool, removeFoe(handle), startRaid(name) -> quest | null,
//            openPlunder(model) -> bool (false: no window could open), giveItems(items, boat | null) -> { left: items } }
//   hold(key, tier) -> items                   DFU's loot roll at the player's level (systems/loot.js generateItems), its
//                                              rarity at the lot's tier (navalPlunder.js holdTier)
//   online: { id() -> string|null, peers() -> [{ id, feet }], sendHit(data) -> bool } | null
//   setting(key) -> value                      the arc's own settings (NAVAL_SETTINGS)
//   random() -> [0, 1)                         the engine draw (Port-Ledger A's rule: injectable, Math.random by default)
//   groundY(x, z) -> y, shake(amount), peerBoats() -> [{ id, pos, vel, speed }], warmAshesOn() -> bool   (optional)
//   raiderSpent(raiderId)                      NAV-R: a raider ship of mine sunk, struck, taken or given the slip - spent
//                                              for its life (the Overworld's own law, scenes/world.js tvRaid.spent)
// }

import { createShotField } from '../systems/naval/navalShots.js';
import { createNavalEffects } from '../systems/naval/navalEffects.js';
import { createNavalDirector, DENSITY, seedBaseOf } from '../systems/naval/navalDirector.js';
import { createSeaShip, stepCaptain, quatOfYaw, forwardOfYaw, velocityOf, provoke, hostile, RUN_OUT_S, RUN_OUT_DEG, BOW_RUN_OUT } from '../systems/naval/navalAI.js';
import { wrapAngle } from '../world/mat4.js';   // ONCRASH1: the port's one angle wrap
import { createShipDamage, shotDamage, SHIP_STATES, SINK_SECONDS, BRACE_TAKEN, FIRE_CHANCE, repairCost } from '../systems/naval/navalDamage.js';
import { createGunDeck, aimSolution, volleyLaunches, bearingOf, sideForBearing, toWorld, RIPPLE_S } from '../systems/naval/navalGunnery.js';
import { hullBuild, batteryOf, batteriesOf, GUNS, classById, shipNames, crownOf, classLine, SIDES, SIDE_DIR, BARREL, NAVAL_FACTIONS, HULL } from '../systems/naval/navalShips.js';
import { orientedBox, arcPoints, flatUnit, NAVAL_DEG, rangeAt, segmentBoxEntry, shotPosition, landing } from '../systems/naval/navalBallistics.js';
import { lawOf, createNotoriety, crownRegion, notorietyLevel, WITNESS_RANGE, KNIGHTLY_FACTION, TEMPLE_FACTION } from '../systems/naval/navalLaw.js';
import { drawHold, flotsamKeys, choiceEffect, choiceOffer, holdTier, CHOICES } from '../systems/naval/navalPlunder.js';
import { createBoarding, berthPose, musterOf, handsOf, repelPartyOf, raidQuestOf, raidQuestWon, boardingWon, BOARD_RANGE, BOARD_SPEED, ABANDON_RANGE, HAND } from '../systems/naval/navalBoarding.js';
import { navalWireRecord, validNavalRecord, navalHitData, validNavalHit, NAVAL_SHARE_RADIUS, NAVAL_VOLLEY_KEEP_MS, BOARD_CODES } from '../systems/naval/navalWire.js';
import { Boat, boatAnimators, boatParticleSystems, animatorOf, setLights, meshLocalBounds, HULL_NAMES } from '../systems/comeSailAwayBoat.js';
import { stowSail } from '../systems/comeSailAway.js';
import { quatEuler } from '../world/unityAnimator.js';
import { quatRotate, quatLookRotation } from '../world/quat.js';
import { constantCurve } from '../world/unityParticles.js';
import { amGroupRollOwner } from '../systems/campEncounters.js';
import { NAVAL_SFX, NAVAL_CLASSIC, NAVAL_FIRE_LOOP, navalSoundRange } from '../systems/naval/navalSounds.js';
import { raiderPlan, raiderClassOf } from '../systems/naval/navalRaiders.js';

/** The record's name in the save's per-mod slot (systems/modSaveData.js) - the port's own, as the Sigil Broker's is. */
export const NAVAL_SAVE_VENDOR = 'NavalCombat';
/** The save record's shape version. */
export const NAVAL_SAVE_VERSION = 1;
/** A ball's report heard as the near boom within this (m); past it the far one. */
export const NEAR_BOOM_M = 260;
/** A muzzle's light: its reach (m) and its life (s). */
export const MUZZLE_FLASH_RANGE = 26;
export const MUZZLE_FLASH_S = 0.12;
/** A muzzle's flash, and a burning deck's glow: their colours (colour x intensity), the glow's reach (m), and how
 *  many burning ships light the scene at once. */
export const MUZZLE_FLASH_COLOR = Object.freeze([1.35, 1.0, 0.6]);
export const BURN_COLOR = Object.freeze([1.25, 0.72, 0.36]);
export const BURN_RANGE = 16;
export const BURN_LIGHTS = 3;
/** A ship within this of the player stands in the world's collider (its deck walkable, its hull a thing to strike). */
export const COLLIDE_RANGE = 180;
/** A boarding's deck spots: the least a ship offers before the rest share. */
export const HANDS_AROUND = 2.2;
/** A player on foot goes over a struck ship's rail within this of her side (m). */
export const FOOT_BOARD_M = 14;
/** Enemies near, for Come Sail Away's time scale: a hostile ship within this (m). */
export const HOSTILE_NEAR_M = 700;
/** The share's hysteresis (DEEP-SHARE's): one who stands the sea keeps it until a lower id is within the radius;
 *  one who does not takes it only when every lower id is past this many radii. */
export const SHARE_HYSTERESIS = 1.25;
/** The ram: the closing speed a bow must strike at (m/s), and what it does a metre a second. */
export const RAM_SPEED = 1.6;
export const RAM_DAMAGE = 14;
/** A galley's ram multiplies what it deals, and takes this share back. */
export const GALLEY_RAM = 3;
export const RAM_RECOIL = 0.3;
/** One ram a ship a stretch (s). */
export const RAM_COOLDOWN_S = 3;
/** Another player's ship eases toward its word at this rate (per second) and snaps past this far (m) - the team's law
 *  (systems/horseCartWire.js easeToward), a ship's scale. */
export const PUPPET_EASE = 6;
export const PUPPET_SNAP_M = 25;
/** How often the room's roster is read for owners who left (s), and how long a quiet owner's ships stand (s). */
export const OWNER_SWEEP_S = 2;
export const OWNER_STALE_S = 6;
/** A ship another player stands that goes down within this of my last blow on her is mine to answer for (s): her
 *  stander lands the hurt (the victim's law), and my word never reaches it - the sinking does, in their next word. */
export const SINK_CREDIT_S = 20;
/** NAV-R: a raider given the slip sheers off for its life: it steers for a point this far on, away from who slipped it. */
export const RAIDER_SHEER_M = 3000;
/** AUDIT NAV1: a frame's time is stepped this finely (s), at most this many steps a frame - Come Sail Away's time scale
 *  runs the sea as fast as the world, where one clamped step ran it at a fraction. */
export const FRAME_STEP_S = 0.1;
export const FRAME_STEPS_MAX = 12;
/** AUDIT NAV1 (the guns): the rest of the volley that struck her - the same striker within this (s) - cannot take her
 *  under one hull (a ball's ripple and its flight's spread: under a second), so sinking a prize is a new volley. */
export const STRUCK_GRACE_S = 2;
/** My volley's tally stands on the readout this long once its last ball has come down (s). */
export const TALLY_S = 3.5;
/** The run-out's warning reads a battery as bearing on my boat within this many degrees past its own arc. */
export const INCOMING_SLACK = 10;
/** AUDIT NAV1 (the helm): the look's ray finds a ship out to the battery's reach and this much more (m); a laid arc is
 *  walked this finely (s) against each ship as she will stand. */
export const LOOK_REACH_PAD = 60;
export const HOT_STEP_S = 0.1;
/** THE BROADSIDE CAMERA: while a broadside is laid, the eye eases (over AIM_CAM_TAU s) to AIM_CAM_OUT past the battery's
 *  ports, AIM_CAM_UP over them and AIM_CAM_AFT toward the stern (m) - her guns, the zone and the enemy on one screen. */
export const AIM_CAM_OUT = 4;
export const AIM_CAM_UP = 5.5;
export const AIM_CAM_AFT = 3;
export const AIM_CAM_TAU = 0.22;
/** ...and stops this far (m) short of another ship's side on its way out from the ports. */
export const AIM_CAM_CLEAR = 1.2;

/** A boat's hull as an oriented box in the world: its MeshCollider's own bounds through its MeshObject (null before
 *  its mesh is known) - the shots' target, the ram's, the target card's, and the host's deck rays'. */
export function hullBoxOf(boat, models) {
  const local = boat?.MeshCollider ? meshLocalBounds({ models }, boat.MeshCollider.m_Mesh) : null;
  if (!local) return null;
  return orientedBox(boat.MeshObject.worldMatrix(), local.center, local.extent);
}
/** AUDIT NAV1 (the guns): a boat's rig as oriented boxes in the world - its build's canvas (navalShips.js HULL_BUILDS
 *  `rig`, the root's frame) through the same MeshObject the hull rides, so the masts heel and settle with her. */
export function rigBoxesOf(boat) {
  const rig = hullBuild(boat?.hull).rig;
  const mo = boat?.MeshObject;
  if (!rig?.length || !mo) return [];
  const m = mo.worldMatrix();
  const lp = mo.localPosition ?? [0, 0, 0];
  return rig.map(([mn, mx]) => orientedBox(m, [(mn[0] + mx[0]) / 2 - lp[0], (mn[1] + mx[1]) / 2 - lp[1], (mn[2] + mx[2]) / 2 - lp[2]], [(mx[0] - mn[0]) / 2, (mx[1] - mn[1]) / 2, (mx[2] - mn[2]) / 2]));
}

const MY_BOAT = 'me';
/** A boat of mine as the shots know it: its own id, so its balls never meet its own planking. */
const myBoatId = (boat) => `${MY_BOAT}:${boat?.uid || 0}`;
const isMine = (id) => typeof id === 'string' && id.startsWith(`${MY_BOAT}:`);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const dist2d = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** A launch's arc to `t` seconds, in 18 points - an aim's line to where its ball stops short of the sea. */
const arcTo = (l, t) => Array.from({ length: 18 }, (_, j) => shotPosition(l.p0, l.v0, t * j / 17));

/**
 * @param {any} deps - see the file's head
 */
export function createNavalHost(deps) {
  const random = deps.random ?? Math.random;
  const u32 = () => (Math.floor(random() * 0xffffffff) >>> 0) || 1;
  const setting = (k, d) => { const v = deps.setting?.(k); return v === undefined || v === null ? d : v; };
  /** The waters, read ONCE a frame (the frame refreshes it): every ship's pose, every charge and the readout ask it. */
  let whereNow = null;
  const where = () => (whereNow ??= deps.where?.() ?? {});
  const now = () => clock;
  let clock = 0;
  let enabled = true;

  // ── the sea's ships ──────────────────────────────────────────────────────────────────────────────────────────────
  /** @type {Map<string, any>} id -> { id, n, owner, ship, boat, fires, fireLoop, target, seen, charged, ramAt, myBlowAt, hunter, deck, prize } */
  const sea = new Map();
  let seq = 0;
  const myId = () => deps.online?.id?.() ?? 'local';
  const director = createNavalDirector({ random });
  const notoriety = createNotoriety();
  let lastDecayDay = null;
  let standing = true;
  let lastSweep = 0;

  // ── the player's boats: each its own hurts and gun deck, by the boat's own deed UID (a console boat by itself) ──
  const boatState = new Map();   // uid (non-zero) -> { damage, guns }
  const boatStateByObj = new WeakMap();   // uid 0: the boat object
  const pendingBoats = new Map();   // a save's records waiting for their boat
  function myBoatState(boat) {
    if (!boat) return null;
    const keyed = boat.uid ? boatState.get(boat.uid) : boatStateByObj.get(boat);
    if (keyed) return keyed;
    const b = hullBuild(boat.hull);
    const st = {
      damage: createShipDamage({ hullHp: b.hullHp, sailHp: b.sailHp, crew: b.crew, player: true }),
      guns: null,
    };
    st.guns = createGunDeck(boat.hull, { crewed: !!boat.crewed, crewShare: () => st.damage.crewShare(), barrels: BARREL.stock });
    const saved = boat.uid ? pendingBoats.get(boat.uid) : null;
    if (saved) { st.damage.restore(saved); if (Number.isFinite(saved.barrels)) st.guns.barrels = saved.barrels; pendingBoats.delete(boat.uid); }
    if (boat.uid) boatState.set(boat.uid, st); else boatStateByObj.set(boat, st);
    return st;
  }
  const csa = () => deps.csa?.() ?? null;
  const sailing = () => !!csa()?.isSailing?.();
  const myBoat = () => (sailing() ? csa().state.CurrentBoat : null);
  /** The boats of mine that stand in the world (the shots' targets, the flotsam's collectors). */
  const myBoats = () => (csa()?.state?.AllBoats ?? []).filter((b) => b.GameObject?.activeSelf);
  /** A boat's root pose as the gunnery reads it. */
  function boatPose(boat) {
    const r = csa();
    const rot = boat.GameObject.rotation;
    const local = boat === r?.state?.CurrentBoat && sailing() ? (r.state.velocityCurrent ?? [0, 0, 0]) : [0, 0, 0];
    return { position: boat.GameObject.position, rotation: rot, velocity: quatRotate(rot, local), hull: boat.hull };
  }
  const yawOfRot = (rot) => { const f = quatRotate(rot, [0, 0, 1]); return Math.atan2(f[0], f[2]); };

  const hullBox = (boat) => hullBoxOf(boat, deps.pool.models);

  // ── the effects, the shots ───────────────────────────────────────────────────────────────────────────────────────
  const wind = () => csa()?.state?.windVectorCurrent ?? [0.6, 0, 0.8];
  const effects = createNavalEffects({ random, wind });
  const flashes = [];   // { pos, t }
  /** The shots' targets this frame: every sea ship afloat, and my own boats - each hull's box and its rig's. */
  function targets() {
    const out = [];
    for (const e of sea.values()) {
      if (!e.boat || e.ship.damage.state === SHIP_STATES.sunk) continue;
      const box = hullBox(e.boat);
      if (box) out.push({ id: e.id, box, rig: rigBoxesOf(e.boat) });
    }
    for (const b of myBoats()) {
      const box = hullBox(b);
      if (box) out.push({ id: myBoatId(b), box, rig: rigBoxesOf(b), boat: b });
    }
    return out;
  }
  const shots = createShotField({
    seaY: () => deps.seaY(),
    wind,
    targets,
    ground: (p) => !deps.isWater(p[0], p[2], -1) && p[1] < (deps.groundY?.(p[0], p[2]) ?? -Infinity),
    collectors: () => myBoats().map((b) => ({ id: myBoatId(b), box: hullBox(b), boat: b })).filter((c) => c.box),
    onEvent: (e) => onShot(e),
    random,
  });

  /** Recent volleys and barrels for the word (NAV-G), the owner's own - each kept NAVAL_VOLLEY_KEEP_MS. */
  let wireVolleys = [];
  let wireBarrels = [];
  /** A peer's volleys and barrels seen already: owner -> Set of ids. */
  const seenVolleys = new Map();

  /** A sound at a place, heard over its own range (systems/naval/navalSounds.js NAVAL_SOUND_RANGE). */
  function sound(key, pos, vol = 1, opts = {}) { try { deps.audio?.play3d?.(key, pos, vol, { ...navalSoundRange(key), ...opts }); } catch { /* a missing clip is silence */ } }

  // ── firing ───────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * A volley from a ship: its balls flown (resolved here when `resolve`), its word kept for the others.
   * @param {{ shooter: string, wireShooter: number, hull: number, pose: any, solution: any, skill: number, resolve?: boolean }} v
   */
  function fire({ shooter, wireShooter, hull, pose, solution, skill, resolve = true }) {
    if (!solution) return 0;
    if (solution.barrel) {
      for (const drop of solution.landings) {
        const id = u32();
        shots.dropBarrel({ id: String(id), shooter, pos: drop.point, resolve });
        wireBarrels.push({ id, pos: [...drop.point], at: clock });
        sound(NAVAL_CLASSIC.splashSmall, drop.point, 0.5);   // a barrel over the side
      }
      return solution.landings.length;
    }
    const seed = u32();
    const launches = volleyLaunches(solution, seed, { skill, carry: pose.velocity });
    const id = u32();
    shots.fireVolley({ id: String(id), shooter, launches, resolve, side: solution.side });
    if (isMine(shooter)) tallies.set(String(id), { balls: launches.length, ended: 0, hits: 0, holed: 0, rig: 0 });
    wireVolleys.push({ id, shooter: wireShooter, hull, side: solution.side, pos: [...pose.position], yaw: yawOfRot(pose.rotation), vel: pose.velocity ?? [0, 0, 0], elevation: solution.elevation, seed, skill, at: clock });
    return launches.length;
  }

  /** A peer's volley, flown here from its word: drawn, and a ball that strikes MY boat - an AI's - is mine to take. */
  function fireFromWord(owner, v, toScene) {
    const pos = toScene(v.pos);
    const pose = { position: pos, rotation: quatOfYaw(v.yaw), velocity: v.vel, hull: v.hull };
    const solution = aimSolution(pose, v.side, null, deps.seaY(), { range: 1 });
    if (!solution) return;
    if (solution.barrel) return;
    // the lay the shooter used, not a range this client would pick
    const g = GUNS[solution.gun];
    solution.elevation = clamp(v.elevation, g.minEl * NAVAL_DEG, g.maxEl * NAVAL_DEG);
    const launches = volleyLaunches(solution, v.seed, { skill: v.skill, carry: v.vel });
    const shooter = v.shooter >= 0 ? `${owner}:${v.shooter}` : `peer:${owner}`;
    shots.fireVolley({ id: `${owner}:${v.id}`, shooter, launches, resolve: false, side: v.side, owner });
  }

  // ── what the shots meet ──────────────────────────────────────────────────────────────────────────────────────────
  function onShot(e) {
    const seaY = deps.seaY();
    countTally(e);
    if (e.type === 'muzzle') {
      const scale = e.gun === 'heavy' ? 1.35 : e.gun === 'swivel' ? 0.55 : 1;
      effects.muzzle(e.pos, e.dir, scale);
      flashes.push({ pos: [...e.pos], t: clock });
      const d = dist2d(e.pos, deps.feet());
      sound(d < NEAR_BOOM_M ? (e.gun === 'swivel' ? NAVAL_SFX.swivel : NAVAL_SFX.cannon) : NAVAL_SFX.cannonFar, e.pos, e.gun === 'swivel' ? 0.7 : 1, { far: d >= NEAR_BOOM_M });
      return;
    }
    if (e.type === 'splash') {
      effects.splash([e.point[0], seaY, e.point[2]], e.gun === 'heavy');
      if (dist2d(e.point, deps.feet()) < 220) sound(e.gun === 'heavy' ? NAVAL_CLASSIC.splashLarge : NAVAL_CLASSIC.splashSmall, e.point, 0.8);
      return;
    }
    if (e.type === 'land') { effects.hit(e.point, [0, 1, 0], false); return; }
    if (e.type === 'hit' || e.type === 'blast') {
      if (e.type === 'blast') { effects.blast(e.point); sound(NAVAL_SFX.blast, e.point, 1); }
      else if (e.zone === 'rig') { effects.tear(e.point, e.dir ?? [0, 0, 1]); sound(NAVAL_SFX.hit, e.point, 0.3); }   // through her canvas: shreds and a crack of spars
      else { effects.hit(e.point, e.dir ?? [0, 0, 1], e.gun === 'heavy'); sound(NAVAL_SFX.hit, e.point, 0.9); }
      landHit(e);
      return;
    }
    if (e.type === 'pickup') pickFlotsam(e);
  }

  /** A strike on a hull: whose it is decides who counts it. */
  function landHit(e) {
    const gun = GUNS[e.type === 'blast' ? 'barrel' : e.gun];
    if (!gun) return;
    const zone = e.type === 'blast' ? 'hull' : e.zone;
    // AUDIT NAV1 (the guns): a fire is a barrel's, or FIRE_CHANCE of a hull hit above the waterline - never the canvas
    // a ball passed through, nor a hole the sea comes in by
    const fire = e.type === 'blast' ? 'barrel' : zone === 'hull' && random() < FIRE_CHANCE;
    if (isMine(e.target)) {
      // MY boat: the victim's own client takes what strikes it - but never another player's ball (no fight between
      // players at sea), nor one of mine, only a ship's of the sea
      if (e.shooter?.startsWith?.('peer:') || isMine(e.shooter)) return;
      const boat = myBoats().find((b) => myBoatId(b) === e.target);
      const st = myBoatState(boat);
      if (!st) return;
      const hurt = shotDamage(gun, zone, { braced: st.guns.braced, roll: random() });
      if (fire) hurt.fire = fire;
      const change = st.damage.apply(hurt, clock);
      deps.shake?.(zone === 'holed' ? 2.5 : 1.6);
      if (change === SHIP_STATES.wrecked) deps.mid?.('Your ship is crippled! The sails hang in rags.', 3);
      return;
    }
    if (!e.resolve) return;
    const target = sea.get(e.target);
    if (!target) return;
    const hurt = shotDamage(gun, zone, { roll: random() });
    if (fire) hurt.fire = fire;
    const byMe = isMine(e.shooter);
    if (byMe) { chargePlayer('fire', target); target.myBlowAt = clock; }
    if (target.owner) {
      // a ship another player stands: the blow is theirs to land
      deps.online?.sendHit?.(navalHitData(target.owner, { n: target.n, hull: hurt.hull, sail: hurt.sail, crew: hurt.crew, fire: hurt.fire ?? false, zone }));
      return;
    }
    strike(target, hurt, byMe ? myId() : e.shooter);
  }

  /**
   * A hurt on a ship I stand: its state, the word, the law's reckoning when the player sank her. AUDIT NAV1 (the guns):
   * a ball from a ship of her own trade - or between two lawful ones - provokes nothing (a stray is not a feud: the
   * audit's pirates turned on their sisters in six fights of sixteen); the rest of the volley that struck her cannot
   * take her under one hull (STRUCK_GRACE_S), and striking puts her fires out (navalDamage.js).
   */
  function strike(entry, hurt, by) {
    const s = entry.ship;
    const striker = typeof by === 'string' ? sea.get(by)?.ship ?? null : null;
    if (!striker || !kindred(striker, s)) provoke(s, by, clock);
    const floor = entry.struck && entry.struck.by === by && clock - entry.struck.at <= STRUCK_GRACE_S ? 1 : 0;
    const before = s.damage.state;
    const change = s.damage.apply(hurt, clock, { floor });
    if (hurt.fire && s.damage.fire > 0) igniteShip(entry);
    // a navy that saw a lawful ship struck by the player is provoked at once
    if (by === myId() && s.cls.faction !== 'pirate') {
      for (const w of sea.values()) if (w.ship.cls.faction === 'navy' && dist2d(w.ship.pos, s.pos) < WITNESS_RANGE) provoke(w.ship, by, clock);
    }
    if (change === SHIP_STATES.struck) {
      entry.struck = { by, at: clock };
      deps.say?.(`${entry.ship.names?.name ?? 'The ship'} strikes her colours!`, 4);
      sound(NAVAL_CLASSIC.bell, s.pos, 0.8);   // her bell as the colours come down
    } else if (change === SHIP_STATES.sinking) {
      deps.say?.(`${entry.ship.names?.name ?? 'The ship'} is going down!`, 4);
      sound(NAVAL_CLASSIC.bubbles, s.pos, 1);
      if (before !== SHIP_STATES.sinking) onSinking(entry, by);
    }
  }

  /** Two ships of one trade, or two lawful ones (a navy and a merchantman): a stray ball between them is no feud. */
  const kindred = (a, b) => a.cls.faction === b.cls.faction || (!!NAVAL_FACTIONS[a.cls.faction]?.lawful && !!NAVAL_FACTIONS[b.cls.faction]?.lawful);

  // ── AUDIT NAV1 (the guns): my volley's tally ─────────────────────────────────────────────────────────────────────
  /** volley id -> { balls, ended, hits, holed, rig } while its balls fly; `tally` the last one down, for TALLY_S. */
  const tallies = new Map();
  let tally = null;
  function countTally(e) {
    const t = e.volley != null ? tallies.get(String(e.volley)) : null;
    if (!t) return;
    if (e.type === 'hit') {
      if (!sea.has(e.target)) { if (e.zone !== 'rig') t.ended++; }
      else if (e.zone === 'rig') t.rig++;
      else { t.hits++; if (e.zone === 'holed') t.holed++; t.ended++; }
    } else if (e.type === 'splash' || e.type === 'land' || e.type === 'gone') t.ended++;
    else return;
    if (t.ended >= t.balls) { tally = { balls: t.balls, hits: t.hits, holed: t.holed, rig: t.rig, at: clock }; tallies.delete(String(e.volley)); }
  }

  // ── AUDIT NAV1 (the guns): the run-out - the tell before a broadside ────────────────────────────────────────────
  /** A battery of hers begins to run out: the trucks' rumble from her side (the glint is drawn while it is out). */
  function runOutTell(entry, side) {
    const bat = batteryOf(entry.ship.hull, side);
    if (!bat) return;
    const pose = { position: entry.ship.pos, rotation: quatOfYaw(entry.ship.yaw) };
    const mid = toWorld(pose, bat.muzzles[bat.muzzles.length >> 1]);
    sound(NAVAL_SFX.runout, mid, 1);
  }
  /** Her run-out batteries' ports, glinting - the linstocks' match and the lanterns behind the open lids. */
  function glintRunOut(entry, d, seaY) {
    const s = entry.ship;
    if (!s.runOut?.size || !entry.boat) return;
    const pose = { position: [s.pos[0], seaY, s.pos[2]], rotation: quatOfYaw(s.yaw) };
    for (const [side, since] of s.runOut) {
      const bat = batteryOf(s.hull, side);
      if (!bat) continue;
      const k = clamp((clock - since) / RUN_OUT_S, 0, 1);
      for (const m of bat.muzzles) effects.glint(toWorld(pose, m), k, d);
    }
  }
  /** Whether a battery of hers bears on a point: within its run-out arc and INCOMING_SLACK, inside its reach. */
  function bearsOn(s, side, p) {
    const bat = batteryOf(s.hull, side);
    if (!bat || bat.gun === 'barrel') return false;
    const dx = p[0] - s.pos[0], dz = p[2] - s.pos[2];
    const off = Math.abs(wrapAngle(Math.atan2(dx, dz) - s.yaw - (side === 'starboard' ? Math.PI / 2 : side === 'port' ? -Math.PI / 2 : 0))) / NAVAL_DEG;
    if (off > (side === 'bow' ? BOW_RUN_OUT : RUN_OUT_DEG) + INCOMING_SLACK) return false;
    const g = GUNS[bat.gun];
    return Math.hypot(dx, dz) <= rangeAt(g.maxEl * NAVAL_DEG, g.speed, bat.muzzles[0][1]) * 1.05;
  }
  /** Her volleys fired at my boat still in the air - the warning stands until the last ball is down: `{ name, until }`. */
  let inbound = [];
  /** An AI volley fired: if it bore on my boat, the warning holds through its flight (its range over the ball's way). */
  function noteInbound(e, side) {
    const boat = myBoat();
    if (!boat) return;
    const p = boatPose(boat).position;
    if (!bearsOn(e.ship, side, p)) return;
    const g = GUNS[batteryOf(e.ship.hull, side).gun];
    inbound.push({ name: e.ship.names?.name ?? 'A ship', side, until: clock + dist2d(e.ship.pos, p) / Math.max(1, g.speed * 0.9) + (batteryOf(e.ship.hull, side).muzzles.length - 1) * RIPPLE_S + 0.3 });
  }
  /** The run-out that bears on my boat now, soonest to fire - or a volley of hers at me still in the air: `{ name,
   *  side, t }` (t: seconds until it may fire, 0 once it has), or null. */
  function incoming(boat) {
    if (!boat) return null;
    const p = boatPose(boat).position;
    inbound = inbound.filter((v) => v.until > clock);
    let best = inbound.length ? { name: inbound[0].name, side: inbound[0].side, t: 0 } : null;
    for (const e of sea.values()) {
      const s = e.ship;
      if (!s.runOut?.size || s.damage.state !== SHIP_STATES.afloat) continue;
      for (const [side, since] of s.runOut) {
        if (!bearsOn(s, side, p)) continue;
        const t = Math.max(0, RUN_OUT_S - (clock - since));
        if (!best || t < best.t) best = { name: s.names?.name ?? 'A ship', side, t: +t.toFixed(1) };
      }
    }
    return best;
  }

  function onSinking(entry, by) {
    const s = entry.ship;
    // her lots that float free
    for (const key of flotsamKeys(s.cls, s.seed)) {
      const a = random() * Math.PI * 2, r = 6 + random() * 10;
      shots.dropFlotsam({ id: String(u32()), pos: [s.pos[0] + Math.sin(a) * r, deps.seaY(), s.pos[2] + Math.cos(a) * r], lot: key, from: s.cls.id });
    }
    if (by === myId()) chargePlayer('sink', entry);
  }

  /** The law's reckoning with the player, once per act per ship. */
  function chargePlayer(act, entry) {
    const s = entry.ship;
    entry.charged ??= new Set();
    if (entry.charged.has(act)) return;
    entry.charged.add(act);
    const w = where();
    const crown = s.names?.crown ?? crownOf(w.px ?? 0, w.py ?? 0, w.capitals ?? null, w.region ?? -1).name;
    const law = lawOf(act, s.cls, { crown, firstStrike: act === 'fire' });
    for (const c of law.crimes) { deps.law?.crime?.(c.region, c.crime); deps.say?.(`Piracy! The crown of ${crown} will hear of this.`, 4); }
    for (const n of law.notoriety) notoriety.add(n.crown, n.add);
    for (const r of law.rewards) {
      if (r.legal) deps.law?.legal?.(r.region, r.legal);
      if (r.knightly) deps.law?.faction?.(KNIGHTLY_FACTION, r.knightly);
      if (r.temple) deps.law?.faction?.(TEMPLE_FACTION, r.temple);
    }
  }

  function igniteShip(entry) {
    if (entry.fires?.length || !deps.flame) return;
    entry.fires = [];
    const spots = entry.ship.hull === 1 ? 1 : 3;
    for (let i = 0; i < spots; i++) {
      const at = (i - (spots - 1) / 2) * 0.5;
      entry.fires.push({ at, handle: deps.flame(entry.ship.pos) });
    }
  }
  function douse(entry) {
    for (const f of entry.fires ?? []) f.handle?.retire?.();
    entry.fires = null;
    entry.fireLoop?.stop?.();
    entry.fireLoop = null;
  }

  /** A cask hauled aboard: its lot's items into the hold of the boat that sailed through it (Come Sail Away's cargo). */
  function pickFlotsam(e) {
    const items = deps.hold?.(e.lot, holdTier(classById(e.from))) ?? [];
    const boat = myBoats().find((b) => myBoatId(b) === e.collector) ?? myBoat();
    if (items.length) deps.board?.giveItems?.(items, boat ?? null);
    deps.say?.(items.length ? `You haul a floating cask aboard (${items.length} ${items.length === 1 ? 'thing' : 'things'} in it).` : 'You haul a floating cask aboard. It is empty.', 3);
    sound(NAVAL_CLASSIC.splashSmall, e.point, 0.6);
  }

  // ── the ships' lives ──────────────────────────────────────────────────────────────────────────────────────────────
  /** A ship launched: its record, its names, its build queued. */
  function launch(spec, owner = null, n = null) {
    const w = where();
    const cls = classById(spec.classId);
    if (!cls) return null;
    const crown = cls.faction === 'navy' ? crownOf(w.px ?? 0, w.py ?? 0, w.capitals ?? null, w.region ?? -1) : null;
    const names = shipNames(cls, spec.seed, { regionIndex: crown?.region ?? w.region ?? 17, crown });
    const num = n ?? (seq = (seq + 1) & 0xffff);
    const id = owner ? `${owner}:${num}` : `${myId()}:${num}`;
    const ship = createSeaShip({ id, seed: spec.seed, classId: spec.classId, variant: spec.variant ?? 0, pos: spec.pos, yaw: spec.yaw ?? 0, names, owner });
    const entry = { id, n: num, owner, ship, boat: null, fires: null, fireLoop: null, target: null, seen: clock, charged: null, ramAt: -Infinity, myBlowAt: -Infinity, hunter: !!spec.hunter, phase: random() * 6.28, wake: false, deck: null, prize: null };
    sea.set(id, entry);
    return entry;
  }
  /** A ship gone: its hull out of the pool, its fires out, and whoever fell on her deck with her. */
  function drop(entry) {
    douse(entry);
    for (const h of entry.deck ?? []) deps.board?.removeFoe?.(h);
    entry.deck = null;
    if (entry.boat) deps.pool.remove(entry.boat);
    sea.delete(entry.id);
  }
  /** One build a frame: the first sea ship with no hull yet (SpawnBoat is the frame's heaviest single act). */
  function buildOne() {
    if (!deps.pool?.ready?.()) return;
    for (const e of sea.values()) {
      if (e.boat) continue;
      try {
        e.boat = deps.pool.spawnSeaNow(new Boat(e.ship.hull, e.ship.variant));
        if (e.boat) {
          for (const sail of e.boat.Sails ?? []) { const a = animatorOf(sail); if (a) stowSail(a, false); }
          e.boat.IdleObject?.setActive?.(false);
          e.boat.ActiveObject?.setActive?.(true);
          e.boat.flagColor = NAVAL_FACTIONS[e.ship.cls?.faction]?.flag ?? null;   // her colours: the faction's own pennant
        }
      } catch (err) {
        console.warn('[naval] a ship would not build', err);
        drop(e);
      }
      return;
    }
  }

  /** A ship's hull stood where its record says - root, bob and heel, the sinking's settle - and its rigging alive. */
  function poseShip(e, dt, seaY) {
    const b = e.boat;
    if (!b) return;
    const s = e.ship;
    const w = wind();
    const wl = Math.hypot(w[0], w[2]);
    const state = s.damage.state;
    const sinkK = state === SHIP_STATES.sinking ? clamp(s.damage.sinkT / SINK_SECONDS, 0, 1) : state === SHIP_STATES.sunk ? 1 : 0;
    const depth = (hullBuild(s.hull).deck + 8) * sinkK * sinkK;
    const pos = s.pos;
    const yaw = s.yaw;
    b.GameObject.position = [pos[0], seaY - depth, pos[2]];
    b.GameObject.rotation = quatOfYaw(yaw);
    const t = clock + e.phase;
    const lean = (s.seed & 1 ? 1 : -1) * 32 * sinkK;
    const roll = s.heel + Math.sin(t * 0.5 * wl) * wl * 0.9 + lean;
    const pitch = Math.sin(t * wl) * wl * 0.5 + 9 * sinkK;
    if (b.MeshObject) b.MeshObject.localRotation = quatEuler(pitch, 0, roll);
    // the sails: set while she fights or runs, stowed struck, taken or going down
    const set = state === SHIP_STATES.afloat && s.sails > 0.5;
    for (const sail of b.Sails ?? []) {
      const a = animatorOf(sail);
      if (!a) continue;
      if (a.GetBool('Stowed') === set) stowSail(a, !set);
      a.SetFloat('Wind', set ? Math.min(1, wl) : 0);
    }
    if (b.FlagObject) {
      const v = velocityOf(s);
      const f = [w[0] - v[0] * 0.1, 0, w[2] - v[2] * 0.1];
      const fl = Math.hypot(f[0], f[2]);
      if (fl > 1e-4) {
        b.FlagObject.rotation = quatLookRotation([f[0] / fl, 0, f[2] / fl]);
        if (b.FlagEmitterMain) b.FlagEmitterMain.startSpeed = constantCurve(fl * 0.5);
      }
    }
    if (b.WakeEmitter) {
      const moving = s.speed > 0.5 && state === SHIP_STATES.afloat;
      if (moving && !e.wake) { b.WakeEmitter.play(); e.wake = true; } else if (!moving && e.wake) { b.WakeEmitter.stop(); e.wake = false; }
      if (b.WakeEmitterMain) { b.WakeEmitterMain.startLifetimeMultiplier = clamp(s.speed * 0.2 * 2, 1, 10); b.WakeEmitterMain.startSize = constantCurve(s.speed * 0.1); }
    }
    const lit = !!where().cityLights;
    if (b.LightOn !== lit && (b.Lights?.length ?? 0) > 0) setLights(b, lit);
    for (const a of boatAnimators(b)) a.update(dt);
    for (const ps of (b.particleSystems ??= boatParticleSystems(b))) ps.step(dt);
    // her fires follow her; the burn breathes embers and smoke
    if (e.fires) {
      const f = forwardOfYaw(yaw);
      const deckY = seaY - depth + hullBuild(s.hull).deck + 1;
      const len = (hullBuild(s.hull).beam || 4) * 1.6;
      for (const fire of e.fires) {
        const p = [pos[0] + f[0] * fire.at * len, deckY, pos[2] + f[2] * fire.at * len];
        fire.handle?.move?.(p);
        effects.burn(p, dt);
      }
      e.fireLoop ??= deps.audio?.loop3d?.(NAVAL_CLASSIC.burning, pos, 0.7, NAVAL_FIRE_LOOP) ?? null;
      e.fireLoop?.move?.(pos);
      if (s.damage.fire <= 0 || state === SHIP_STATES.sunk) douse(e);
    }
    if (state === SHIP_STATES.sinking) effects.founder([pos[0], seaY, pos[2]], dt, hullBuild(s.hull).beam);
  }

  // ── the sea's share (NAV-G): who stands it ────────────────────────────────────────────────────────────────────────
  function standsSea() {
    const on = deps.online;
    const id = on?.id?.();
    if (!on || !id) return true;
    const peers = on.peers?.() ?? [];
    standing = amGroupRollOwner(id, deps.feet(), peers, standing ? NAVAL_SHARE_RADIUS : NAVAL_SHARE_RADIUS * SHARE_HYSTERESIS);
    return standing;
  }

  // ── NAV-R: Warm Ashes' raiders, stood as ships (systems/naval/navalRaiders.js) ─────────────────────────────────────
  /** A raider of mine busy at sea - fighting, running, boarded or going down: never let go of while it is. */
  const raiderBusy = (e) => e.ship.mode === 'engage' || e.ship.mode === 'board' || e.ship.mode === 'flee' || e.ship.boarded || boarding?.shipId === e.id
    || e.ship.damage.state === SHIP_STATES.sinking;
  /**
   * The raiders about the player, where they sail now (the world host's, off seaRaiders.js - the shared clock's):
   * `list` [{ id, seed, pos, yaw, ahead }] in the scene (`ahead` where the seeded course is RAIDER_LEAD_S on); `sight`
   * the lookout's reach tonight or today; `spent` the raiders spent this life. Mine stand and go by raiderPlan; each
   * steers its seeded course and looks out, until it is spent.
   */
  function raiders(list, { sight = null, spent = new Set() } = {}) {
    if (!enabled) return;
    const stood = new Map(), peers = new Map();
    for (const e of sea.values()) {
      if (!e.owner && e.raider) stood.set(e.raider.id, { pos: e.ship.pos, engaged: raiderBusy(e) });
      else if (e.owner && e.ship.cls.faction === 'pirate') peers.set(e.ship.seed, e.owner);
    }
    const plan = raiderPlan({ raiders: list, me: deps.feet(), myId: myId(), stood, peers, spent });
    for (const id of plan.drop) { const e = raiderEntry(id); if (e) drop(e); }
    const level = deps.level?.() ?? 1;
    for (const id of plan.stand) {
      const r = list.find((x) => x.id === id);
      const cls = raiderClassOf(r.seed, level);
      if (!deps.isWater(r.pos[0], r.pos[2], cls.hull)) continue;   // a sail not yet on water deep enough for her hull
      const e = launch({ seed: r.seed, classId: cls.id, pos: [r.pos[0], deps.seaY(), r.pos[2]], yaw: r.yaw });
      if (e) e.raider = { id, chased: false, spent: false };
    }
    for (const e of sea.values()) {
      if (e.owner || !e.raider || e.raider.spent) continue;
      const r = list.find((x) => x.id === e.raider.id);
      e.ship.sight = sight;
      e.ship.course = r?.ahead ? [r.ahead[0], r.ahead[2]] : null;   // its life over, it sails on for a waypoint of its own
    }
  }
  const raiderEntry = (raiderId) => [...sea.values()].find((e) => !e.owner && e.raider?.id === raiderId) ?? null;
  /** A raider spent for its life: said to the world host once; one given the slip sheers off and looks for no one. */
  function spendRaider(e, sheerOff) {
    e.raider.spent = true;
    deps.raiderSpent?.(e.raider.id);
    if (!sheerOff) return;
    const me = deps.feet();
    const dx = e.ship.pos[0] - me[0], dz = e.ship.pos[2] - me[2], d = Math.hypot(dx, dz) || 1;
    e.ship.sight = 0;
    e.ship.course = [e.ship.pos[0] + (dx / d) * RAIDER_SHEER_M, e.ship.pos[2] + (dz / d) * RAIDER_SHEER_M];
  }
  /** The ship a raider of this seed sails as - mine or a peer's copy - for the Overworld's mark: where, and whether it
   *  chases me. Null: none stands. */
  function raiderShipOf(seed) {
    for (const e of sea.values()) {
      if (e.ship.seed !== (seed >>> 0) || e.ship.cls.faction !== 'pirate' || (!e.owner && !e.raider)) continue;
      return { pos: e.ship.pos, chase: chasesMe(e) };
    }
    return null;
  }

  // ── contacts the captains see ────────────────────────────────────────────────────────────────────────────────────
  function contacts() {
    const out = [];
    for (const e of sea.values()) {
      if (e.ship.damage.state !== SHIP_STATES.afloat) continue;
      out.push({ id: e.id, kind: 'ship', faction: e.ship.cls.faction, pos: e.ship.pos, vel: velocityOf(e.ship), speed: e.ship.speed, yaw: e.ship.yaw, hull: e.ship.hull, ship: e.ship });
    }
    const boat = myBoat();
    if (boat) {
      const st = myBoatState(boat);
      const pose = boatPose(boat);
      out.push({
        id: myId(), kind: 'player', pos: pose.position, vel: pose.velocity, speed: Math.hypot(pose.velocity[0], pose.velocity[2]),
        yaw: yawOfRot(pose.rotation), hull: boat.hull,   // AUDIT NAV1: her heading (the berth a boarder comes up to) and her hull (the room a captain gives her)
        hullShare: st.damage.hullShare(), crippled: st.damage.state === SHIP_STATES.wrecked,
      });
    }
    // the other players' boats at their helms (Come Sail Away's `sa`): a pirate takes them as it takes me; their hurts
    // are their own clients' to take (the victim's law), and only I am ever grappled by the sea I stand
    for (const p of deps.peerBoats?.() ?? []) out.push({ id: p.id, kind: 'player', pos: p.pos, vel: p.vel ?? [0, 0, 0], speed: p.speed ?? 0, yaw: p.yaw, hull: p.hull ?? null, peer: true });
    return out;
  }

  // ── aiming ───────────────────────────────────────────────────────────────────────────────────────────────────────
  let aiming = false;
  let aim = null;   // the solution this frame, while aiming
  let aimHit = null;   // AUDIT NAV1: where that solution's guns strike this frame (aimStrikes: { ship, hits }), or null
  let braceHeld = false;

  /**
   * AUDIT NAV1 (the helm): the point on a sea ship the look meets - her hull's box or her rig's, the nearest - inside
   * the battery's reach and LOOK_REACH_PAD: the guns are laid on it (navalGunnery.js `look.at`). A look on her canvas
   * lays round shot for her hull - her centre, at her box's middle height: a ball laid for a sail flies on through it,
   * and a galley's yard reaches out past her side - and chain for the canvas itself. Her way along the fire is led over
   * the ball's flight, so a ship sailing away is laid for where she will be; across the fire it is the helm's own
   * timing, as a broadside's always is.
   */
  function lookOnShip(boat, side, look) {
    const bat = batteryOf(boat.hull, side);
    if (!bat || bat.gun === 'barrel' || !look) return null;
    const g = GUNS[bat.gun];
    const reach = rangeAt(g.maxEl * NAVAL_DEG, g.speed, bat.muzzles[0][1]) + LOOK_REACH_PAD;
    const l = Math.hypot(look.dir[0], look.dir[1], look.dir[2]) || 1;
    const far = [look.origin[0] + look.dir[0] / l * reach, look.origin[1] + look.dir[1] / l * reach, look.origin[2] + look.dir[2] / l * reach];
    let best = null;
    for (const e of sea.values()) {
      if (!e.boat || e.ship.damage.state === SHIP_STATES.sunk) continue;
      const hull = hullBox(e.boat);
      const boxes = [hull, ...rigBoxesOf(e.boat)];
      for (let i = 0; i < boxes.length; i++) {
        if (!boxes[i]) continue;
        const hit = segmentBoxEntry(look.origin, far, boxes[i], 0);
        if (hit && (!best || hit.t < best.t)) best = { t: hit.t, point: hit.point, e, hull, rig: i > 0 };
      }
    }
    if (!best) return null;
    const pose = boatPose(boat);
    const fire = flatUnit(quatRotate(pose.rotation, SIDE_DIR[side])) ?? [0, 0, 1];
    const v = velocityOf(best.e.ship);
    const p = best.rig && bat.gun !== 'chain' && best.hull ? best.hull.c : best.point;
    const along = (v[0] * fire[0] + v[2] * fire[2]) * dist2d(p, pose.position) / Math.max(1, g.speed * 0.97);
    return [p[0] + fire[0] * along, p[1], p[2] + fire[2] * along];
  }
  /** My aim for a side: the look's pitch, or the point on a ship it meets. */
  function lookAim(boat, side) {
    const look = deps.look?.();
    return aimSolution(boatPose(boat), side, look ? { ...look, at: lookOnShip(boat, side, look) } : null, deps.seaY());
  }
  /**
   * AUDIT NAV1 (the helm): where each gun of a laid volley stops - its unscattered arc walked HOT_STEP_S at a time
   * against every ship's hull box (and her rig's for chain shot) as she will stand when it gets there, her way times
   * the ball's time aloft. `{ ship, hits }`: `hits[i]` the i-th gun's `{ t, point }` (the ball where it meets her) or
   * null (it reaches the sea); `ship` the first struck. Every ship at sea is asked, not only the one under the crosshair
   * (a broadside's zone lies forward of the look). Null when no gun strikes: the aim's red is this, never a guess.
   */
  function aimStrikes(solution) {
    if (!solution || solution.barrel) return null;
    const seaY = deps.seaY();
    const ships = [];
    for (const e of sea.values()) {
      const st = e.ship.damage.state;
      if (!e.boat || st === SHIP_STATES.sunk || st === SHIP_STATES.sinking) continue;
      const boxes = [hullBox(e.boat), ...(solution.gun === 'chain' ? rigBoxesOf(e.boat) : [])].filter(Boolean);
      if (boxes.length) ships.push({ e, v: velocityOf(e.ship), boxes: boxes.map((b) => ({ b, r: Math.hypot(b.h[0], b.h[1], b.h[2]) })) });
    }
    if (!ships.length) return null;
    let ship = null;
    const hits = solution.launches.map((l) => {
      const end = landing(l.p0, l.v0, seaY)?.t ?? 4;
      const n = Math.max(8, Math.ceil(end / HOT_STEP_S));
      let a = l.p0, ta = 0;
      for (let i = 1; i <= n; i++) {
        const tb = end * i / n, b = shotPosition(l.p0, l.v0, tb), tm = (ta + tb) / 2;
        const half = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2;
        let best = null;
        for (const s of ships) {
          const sx = s.v[0] * tm, sz = s.v[2] * tm;
          const a2 = [a[0] - sx, a[1], a[2] - sz], b2 = [b[0] - sx, b[1], b[2] - sz];
          const m = [(a2[0] + b2[0]) / 2, (a2[1] + b2[1]) / 2, (a2[2] + b2[2]) / 2];
          for (const { b: box, r } of s.boxes) {
            if (Math.hypot(m[0] - box.c[0], m[1] - box.c[1], m[2] - box.c[2]) > r + half) continue;   // nowhere near her
            const hit = segmentBoxEntry(a2, b2, box, 0);
            if (hit && (!best || hit.t < best.k)) best = { k: hit.t, e: s.e };
          }
        }
        if (best) {
          const t = ta + (tb - ta) * best.k;
          ship ??= best.e;
          return { t, point: shotPosition(l.p0, l.v0, t) };
        }
        a = b; ta = tb;
      }
      return null;
    });
    return ship ? { ship, hits } : null;
  }
  /** The state of my battery for the aim's line: 'ready', 'reloading', 'braced', 'crippled' or 'empty' (no barrels). */
  function aimState(st, side, boat) {
    if (st.damage.state === SHIP_STATES.wrecked) return 'crippled';
    if (st.guns.braced) return 'braced';
    if (!st.guns.ready(side)) return batteryOf(boat.hull, side)?.gun === 'barrel' && st.guns.barrels <= 0 ? 'empty' : 'reloading';
    return 'ready';
  }

  /** THE BROADSIDE CAMERA: the eye this frame - `ownEye` eased toward the broadside's own while one is laid, and home. */
  let camK = 0, camSide = null;
  function aimEye(ownEye, dt) {
    const boat = myBoat();
    const want = setting('AimCamera', true) !== false && aiming && boat && aim && (aim.side === 'port' || aim.side === 'starboard')
      && myBoatState(boat).damage.state !== SHIP_STATES.wrecked ? aim.side : null;
    if (want) camSide = want;
    camK += ((want ? 1 : 0) - camK) * (1 - Math.exp(-Math.max(0, dt) / AIM_CAM_TAU));
    if (!want && camK < 1e-3) { camK = 0; camSide = null; }
    if (!boat || !camSide || camK <= 0) return ownEye;
    const pose = boatPose(boat);
    const bat = batteryOf(boat.hull, camSide);
    if (!bat) return ownEye;
    const ports = bat.muzzles.map((m) => toWorld(pose, m));
    const c = ports.reduce((acc, m) => [acc[0] + m[0] / ports.length, acc[1] + m[1] / ports.length, acc[2] + m[2] / ports.length], [0, 0, 0]);
    const fire = flatUnit(quatRotate(pose.rotation, SIDE_DIR[camSide])) ?? [1, 0, 0];
    const fwd = flatUnit(quatRotate(pose.rotation, [0, 0, 1])) ?? [0, 0, 1];
    let at = [c[0] + fire[0] * AIM_CAM_OUT - fwd[0] * AIM_CAM_AFT, c[1] + AIM_CAM_UP, c[2] + fire[2] * AIM_CAM_OUT - fwd[2] * AIM_CAM_AFT];
    // never inside a ship alongside - a broadside at her rail's width is the one Black Flag remembers
    let clear = 1;
    for (const e of sea.values()) {
      const box = e.boat && e.ship.damage.state !== SHIP_STATES.sunk ? hullBox(e.boat) : null;
      const hit = box ? segmentBoxEntry(c, at, box, AIM_CAM_CLEAR) : null;
      if (hit && hit.t < clear) clear = hit.t;
    }
    if (clear < 1) at = [c[0] + (at[0] - c[0]) * clear, c[1] + (at[1] - c[1]) * clear, c[2] + (at[2] - c[2]) * clear];
    const k = camK * camK * (3 - 2 * camK);   // eased in and out
    return [ownEye[0] + (at[0] - ownEye[0]) * k, ownEye[1] + (at[1] - ownEye[1]) * k, ownEye[2] + (at[2] - ownEye[2]) * k];
  }

  /** The side the look lays on my boat, and whether it has guns. */
  function lookSide(boat) {
    const look = deps.look?.();
    if (!look) return null;
    const side = sideForBearing(bearingOf(look.dir, boat.GameObject.rotation));
    return batteryOf(boat.hull, side) ? side : null;
  }
  const armed = (boat) => !!boat && batteriesOf(boat.hull).length > 0;

  /**
   * The attack button at the helm: held, the guns are laid under the look and the zone drawn; let go, they fire. The
   * swing never runs at a helm with guns (the answer is true); a boat with none leaves the swing alone (false).
   */
  function attackInput(held) {
    if (!enabled) return false;
    const boat = myBoat();
    if (!armed(boat)) { aiming = false; return false; }
    const st = myBoatState(boat);
    if (held) { aiming = true; return true; }
    if (!aiming) return true;
    aiming = false;
    const side = lookSide(boat);
    if (!side) { deps.say?.('No guns bear there.', 1.5); return true; }
    if (st.damage.state === SHIP_STATES.wrecked) { deps.say?.('Your guns are silent - the ship is crippled.', 2); return true; }
    if (st.guns.braced) { deps.say?.('Braced - let go of the brace to fire.', 1.5); return true; }
    if (!st.guns.ready(side)) {
      const bat = batteryOf(boat.hull, side);
      deps.say?.(bat?.gun === 'barrel' && st.guns.barrels <= 0 ? 'No fire barrels left.' : `The ${side} guns are reloading (${st.guns.left(side).toFixed(1)} s).`, 1.5);
      return true;
    }
    const pose = boatPose(boat);
    const solution = lookAim(boat, side);
    fire({ shooter: myBoatId(boat), wireShooter: -1, hull: boat.hull, pose, solution, skill: 0.6 });
    st.guns.fired(side);
    deps.shake?.(1.2);
    return true;
  }

  /** The aim put down without a shot - a window opened over it, the helm was left: the release owes nothing. */
  function cancelAim() { aiming = false; aim = null; }

  // ── boarding ─────────────────────────────────────────────────────────────────────────────────────────────────────
  let boarding = null;
  /** The ship a boarding at the helm would take: struck, not taken, within reach - the one the look is on first. */
  function boardable(boat) {
    if (!boat) return null;
    const pose = boatPose(boat);
    const speed = Math.hypot(pose.velocity[0], pose.velocity[2]);
    if (speed > BOARD_SPEED) return null;
    const look = deps.look?.();
    let best = null, bestScore = Infinity;
    for (const e of sea.values()) {
      if (e.ship.damage.state !== SHIP_STATES.struck || e.ship.boarded || !e.boat) continue;
      const d = dist2d(e.ship.pos, pose.position) - (hullBuild(e.ship.hull).beam + hullBuild(boat.hull).beam);
      if (d > BOARD_RANGE) continue;
      let score = d;
      if (look) {
        const to = [e.ship.pos[0] - look.origin[0], 0, e.ship.pos[2] - look.origin[2]];
        const l = Math.hypot(to[0], to[2]) || 1;
        const lf = flatUnit(look.dir) ?? [0, 0, 1];
        score -= 40 * (to[0] / l * lf[0] + to[2] / l * lf[2]);
      }
      if (score < bestScore) { bestScore = score; best = e; }
    }
    return best;
  }

  /**
   * Activate: at the helm, throw the grapples on a struck ship in reach; on foot (a deck alongside her, or swimming
   * up), go over her rail when she is within reach and the look is on her. True when it took the press.
   */
  function activate() {
    if (!enabled || boarding) return false;
    const boat = myBoat();
    // a prize of mine whose fate is not yet set: her hold again
    const prize = prizeInReach(boat);
    if (prize) { openPrize(prize); return true; }
    if (boat) {
      const e = boardable(boat);
      if (!e) return false;
      startBoarding('board', e, boat);
      return true;
    }
    const e = boardableOnFoot();
    if (!e) return false;
    startBoarding('board', e, null);
    return true;
  }
  /** A prize this player took and has not yet scuttled or cast off, within reach - of the helm (BOARD_RANGE past the
   *  two beams) or of the feet (FOOT_BOARD_M past hers) - the look on her. */
  function prizeInReach(boat) {
    const from = boat ? boatPose(boat).position : deps.feet();
    const look = deps.look?.();
    const lf = look ? flatUnit(look.dir) : null;
    for (const e of sea.values()) {
      if (!e.prize || e.prize.fate || !e.boat || e.ship.damage.state !== SHIP_STATES.prize) continue;
      const reach = boat ? BOARD_RANGE + hullBuild(boat.hull).beam : FOOT_BOARD_M;
      if (dist2d(e.ship.pos, from) - hullBuild(e.ship.hull).beam > reach) continue;
      if (lf) {
        const to = [e.ship.pos[0] - look.origin[0], 0, e.ship.pos[2] - look.origin[2]];
        if ((to[0] * lf[0] + to[2] * lf[2]) / (Math.hypot(to[0], to[2]) || 1) < 0.5) continue;
      }
      return e;
    }
    return null;
  }
  /** The struck ship a player on foot can go over the rail of: within FOOT_BOARD_M of the feet, the look on her. */
  function boardableOnFoot() {
    const feet = deps.feet();
    const look = deps.look?.();
    for (const e of sea.values()) {
      if (e.ship.damage.state !== SHIP_STATES.struck || e.ship.boarded || !e.boat) continue;
      if (dist2d(e.ship.pos, feet) - hullBuild(e.ship.hull).beam > FOOT_BOARD_M) continue;
      if (look) {
        const box = hullBox(e.boat);
        const to = box ? [box.c[0] - look.origin[0], 0, box.c[2] - look.origin[2]] : null;
        const lf = flatUnit(look.dir);
        if (to && lf && (to[0] * lf[0] + to[2] * lf[2]) / (Math.hypot(to[0], to[2]) || 1) < 0.5) continue;
      }
      return e;
    }
    return null;
  }

  function startBoarding(kind, entry, boat) {
    const from = { pos: [...entry.ship.pos], yaw: entry.ship.yaw };
    let to = from;
    if (boat) {
      const pose = boatPose(boat);
      const anchor = { pos: pose.position, yaw: yawOfRot(pose.rotation), beam: hullBuild(boat.hull).beam, midZ: 0 };
      to = berthPose(anchor, { pos: entry.ship.pos, yaw: entry.ship.yaw, beam: hullBuild(entry.ship.hull).beam, midZ: 0 });
    }
    boarding = createBoarding({ kind, shipId: entry.id, from, to: { pos: to.pos, yaw: to.yaw } });
    boarding.boat = boat;
    if (!boat) boarding.t = Infinity;   // on foot: no haul - over the rail at once
    entry.ship.boarded = true;
    entry.ship.speed = 0;
    if (entry.owner) deps.online?.sendHit?.(navalHitData(entry.owner, { n: entry.n, board: BOARD_CODES.boarding }));
    sound(NAVAL_SFX.grapple, entry.ship.pos, 0.9);
    deps.say?.(kind === 'board' ? `Grapples away! Hauling ${entry.ship.names?.name ?? 'her'} alongside...` : `Grappling hooks! ${entry.ship.names?.name ?? 'The pirates'} are coming alongside - repel boarders!`, 3);
  }

  /** The boarding's frame: the haul, then the fight's tally, then the prize. */
  function stepBoarding(dt) {
    const b = boarding;
    if (!b) return;
    const entry = sea.get(b.shipId);
    if (!entry) { endBoarding(); return; }
    const was = b.phase;
    b.step(dt);
    const pose = b.pose();
    if (pose) { entry.ship.pos = [pose.pos[0], entry.ship.pos[1], pose.pos[2]]; entry.ship.yaw = pose.yaw; }
    if (was === 'grapple' && b.phase === 'fight') beginFight(b, entry);
    if (b.phase !== 'fight') return;
    // the fight: its muster's tally, the player's distance
    if (dist2d(deps.feet(), entry.ship.pos) > ABANDON_RANGE) {
      deps.say?.('You leave the fight. Her crew stands down.', 3);
      for (const f of b.foes) deps.board?.removeFoe?.(f.handle);
      b.foes = [];
      entry.ship.boarded = false;
      b.abandon();
      endBoarding();
      return;
    }
    if (b.quest) return;   // a Warm Ashes raid: its own flow, its own end (raidEnded)
    const down = b.foes.filter((f) => deps.board?.foeDown?.(f.handle)).length;
    const captainDown = b.foes.some((f) => f.captain && deps.board?.foeDown?.(f.handle));
    if (boardingWon({ captainDown, down, total: b.foes.length })) winBoarding(b, entry);
  }

  function beginFight(b, entry) {
    const boat = b.boat;
    deps.board?.leaveHelm?.();
    if (b.kind === 'board') {
      const spots = deps.board?.deckSpots?.(entry.boat, 16) ?? [];
      const [first, ...rest] = spots.length ? spots : [[entry.ship.pos, entry.ship.yaw]];
      deps.board?.placePlayer?.(first[0], first[1]);
      const muster = musterOf(entry.ship.cls, entry.ship.damage.crewShare());
      const all = [muster.captain, ...muster.men];
      b.foes = [];
      for (let i = 0; i < all.length; i++) {
        const spot = rest[(i + 3) % Math.max(1, rest.length)] ?? first;
        const handle = deps.board?.spawnFoe?.(all[i], spot[0], spot[1], 'enemy');
        if (handle) b.foes.push({ handle, captain: i === 0 });
      }
      entry.deck = b.foes.map((f) => f.handle);   // they fall on her deck, and go with her
      const st = myBoatState(boat);
      const hands = handsOf(st?.damage.crew ?? 0, !!boat?.crewed);
      for (let i = 0; i < hands; i++) {
        const spot = rest[i % Math.max(1, rest.length)] ?? first;
        const handle = deps.board?.spawnFoe?.(HAND, spot[0], spot[1], 'ally');
        if (handle) b.hands.push({ handle });
      }
      deps.mid?.(`You board ${entry.ship.names?.name ?? 'her'}!`, 3);
      deps.say?.(entry.ship.cls.faction === 'pirate' ? `Captain ${entry.ship.names?.captain ?? ''} rallies the pirates. Cut them down!` : `The crew of ${entry.ship.names?.name ?? 'the ship'} stand to defend their ship.`, 5);
      return;
    }
    // repel: she boards the player
    const crewed = !!boat?.crewed;
    const wa = deps.warmAshesOn?.() !== false;
    if (crewed && wa) {
      const quest = deps.board?.startRaid?.(raidQuestOf(entry.ship.cls));
      if (quest) { b.quest = quest; raids.set(quest, b); if (Number.isFinite(quest.uid)) raidUids.add(quest.uid); return; }
    }
    const spots = deps.board?.deckSpots?.(boat, 12) ?? [];
    const n = repelPartyOf(entry.ship.cls);
    b.foes = [];
    for (let i = 0; i < n; i++) {
      const spot = spots[i % Math.max(1, spots.length)];
      if (!spot) break;
      const handle = deps.board?.spawnFoe?.(musterOf(entry.ship.cls).men[i % 4], spot[0], spot[1], 'enemy');
      if (handle) b.foes.push({ handle, captain: false });
    }
  }

  /** The fight won: a boarding's prize, or boarders thrown back. */
  function winBoarding(b, entry) {
    if (b.kind === 'repel') {
      deps.mid?.('The boarders are thrown back!', 3);
      entry.ship.damage.apply({ hull: 0, sail: 0, crew: entry.ship.damage.crew }, clock);
      if (entry.ship.damage.state === SHIP_STATES.afloat) entry.ship.damage.apply({ hull: Math.max(0, entry.ship.damage.hull - entry.ship.damage.maxHull * 0.24), sail: 0, crew: 0 }, clock);
      entry.ship.boarded = false;
      endBoarding();
      return;
    }
    b.win();
    entry.ship.damage.takePrize();
    entry.ship.boarded = false;   // AUDIT NAV1 (B1): the fight is over - a prize is let go like any hulk once out of sight
    chargePlayer('board', entry);
    if (entry.owner) deps.online?.sendHit?.(navalHitData(entry.owner, { n: entry.n, board: BOARD_CODES.taken }));
    sound(NAVAL_CLASSIC.bell, entry.ship.pos, 1);
    deps.mid?.(`${entry.ship.names?.name ?? 'The ship'} is yours!`, 3);
    // the prize: her hold drawn once (whoever opens it again finds what is left), the boat that took her
    entry.prize = { hold: drawHold(entry.ship.cls, entry.ship.seed, (key, tier) => deps.hold?.(key, tier) ?? []), boat: b.boat ?? nearestBoat(entry.ship.pos), chosen: null, fate: null };
    endBoarding();   // the hands go home over the rail; her dead lie on her deck (entry.deck)
    openPrize(entry);
  }
  /**
   * A hold emptied into a boat's hold (Come Sail Away's cargo - its weight slows her, as the mod weighs it), or with no
   * boat into the pack as far as the pack will carry; what will not go stays where it was. Answers the tally.
   */
  function takeInto(hold, boat) {
    if (!hold.length) return { taken: 0, left: 0, where: boat ? 'hold' : 'pack' };
    const all = hold.splice(0);
    const r = deps.board?.giveItems?.(all, boat) ?? { left: all };
    const left = Array.isArray(r.left) ? r.left : [];
    for (const it of left) hold.push(it);
    return { taken: all.length - left.length, left: left.length, where: boat ? 'hold' : 'pack' };
  }
  /** The boat of mine nearest a place, within COLLIDE_RANGE - the one a prize taken on foot answers to. */
  function nearestBoat(pos) {
    let best = null, bestD = COLLIDE_RANGE;
    for (const b of myBoats()) { const d = dist2d(b.GameObject.position, pos); if (d < bestD) { bestD = d; best = b; } }
    return best;
  }

  /**
   * The prize's window: her hold (what is left of it), the captor's one choice and her fate - the plunder window's
   * model (ui/navalPlunderWindow.js). Shut without a fate, she lies taken where she is and Activate opens her again.
   */
  function openPrize(entry) {
    const s = entry.ship;
    const pz = entry.prize;
    if (!pz) return false;
    const boat = pz.boat && myBoats().includes(pz.boat) ? pz.boat : null;
    const st = boat ? myBoatState(boat) : null;
    const numbers = () => ({ maxHull: st.damage.maxHull, hull: st.damage.hull, maxSail: st.damage.maxSail, sail: st.damage.sail, maxCrew: st.damage.maxCrew, crew: st.damage.crew });
    const armament = () => ({
      barrelStock: BARREL.stock, barrels: st.guns.barrels, barrelGuns: batteriesOf(boat.hull).some((x) => x.gun === 'barrel'),
      loaded: SIDES.every((side) => !batteryOf(boat.hull, side) || st.guns.left(side) === 0),
    });
    return deps.board?.openPlunder?.({
      name: s.names?.name ?? 'The prize', captain: s.names?.captain ?? null, classLine: classLine(s.cls, s.names?.crown),
      faction: s.cls.faction, items: pz.hold, raid: false,
      /** the captor's ship as the choices find her, read fresh at every paint */
      mine: () => (st ? { name: HULL_NAMES[boat.hull], hull: st.damage.hullShare(), sail: st.damage.maxSail > 0 ? st.damage.sailShare() : null, crew: st.damage.maxCrew > 0 ? st.damage.crewShare() : null } : null),
      offers: () => (st ? CHOICES.map((c) => choiceOffer(c, numbers(), armament())) : []),
      takeAll: () => takeInto(pz.hold, boat),
      chosen: () => pz.chosen,
      fated: () => pz.fate,
      choose(choice) {
        if (pz.chosen || pz.fate || !st) return false;
        if (!CHOICES.includes(choice)) return false;
        const fx = choiceEffect(choice, numbers(), { barrelStock: BARREL.stock });
        pz.chosen = choice;
        if (fx.repair) st.damage.repair({ hull: fx.repair.hull, sail: fx.repair.sail, crew: 0 });
        if (fx.barrels != null) st.guns.barrels = Math.max(st.guns.barrels, fx.barrels);
        if (fx.reload) st.guns.restore({ clocks: {}, barrels: st.guns.barrels });   // every battery loaded
        if (fx.crew) st.damage.repair({ hull: 0, sail: 0, crew: fx.crew });
        deps.say?.(choice === 'repair' ? `Her timber and cordage patch your ${HULL_NAMES[boat.hull]}.` : choice === 'powder' ? 'Her powder is stowed aboard - every gun loaded.' : 'Her crew are pressed to your guns.', 3);
        return true;
      },
      fate(which) {
        if (pz.fate) return;
        pz.fate = which === 'scuttle' ? 'scuttle' : 'adrift';
        if (pz.fate === 'scuttle') { s.damage.scuttle(); s.damage.apply({ hull: 0, sail: 0, crew: 0, fire: true }, clock); igniteShip(entry); deps.say?.(`You put a torch to ${s.names?.name ?? 'her'}. She burns to the waterline.`, 4); sound(NAVAL_CLASSIC.bubbles, s.pos, 1); }   // a sinking ship's fire burns on until she is gone (navalDamage.js step)
        else { s.adrift = true; deps.say?.(`You cast ${s.names?.name ?? 'her'} off to drift.`, 3); }   // AUDIT NAV1 (B11): she drifts off downwind
        if (entry.owner) deps.online?.sendHit?.(navalHitData(entry.owner, { n: entry.n, board: pz.fate === 'scuttle' ? BOARD_CODES.scuttled : BOARD_CODES.adrift }));
        if (boat) returnAboard(boat);
      },
    }) !== false;
  }

  /** Back over the rail onto your own deck (the helm's side of it). */
  function returnAboard(boat) {
    const spots = deps.board?.deckSpots?.(boat, 4) ?? [];
    if (spots[0]) deps.board?.placePlayer?.(spots[0][0], spots[0][1]);
  }

  function endBoarding() {
    if (!boarding) return;
    if (boarding.quest) raids.delete(boarding.quest);
    for (const h of boarding.hands) deps.board?.removeFoe?.(h.handle);   // my hands, back aboard their own ship
    boarding = null;
  }

  // ── Warm Ashes' raids (the pirate quest system) ──────────────────────────────────────────────────────────────────
  /** The raids this host started: quest -> boarding. */
  const raids = new Map();
  /** And their quests' UIDs, which the save keeps: a raid restored from a save has no boarding (the sea is not a
   *  save's), and its "Leave Ship" must still be the naval arc's - never Warm Ashes' voyage home. */
  const raidUids = new Set();
  let prizeRaid = null;   // a fast-travel raid's prize window: { quest, state: 'open' | 'done' }
  /**
   * Warm Ashes' "Leave Ship", asked first (systems/warmAshesShips.js's gate): a raid THIS host started is its own -
   * 'naval': the boarders are thrown back and nothing is sailed; a raid of the mod's own voyage waits ('wait') while
   * its prize window is open, and then goes on ('proceed').
   */
  function leaveShipGate(quest) {
    const b = raids.get(quest);
    if (b) {
      raidUids.delete(quest.uid);
      const entry = sea.get(b.shipId);
      if (entry) winBoarding(b, entry); else endBoarding();
      return 'naval';
    }
    if (quest && raidUids.has(quest.uid)) { raidUids.delete(quest.uid); return 'naval'; }   // a raid of mine a load carried: thrown back, nothing sailed
    if (!enabled || setting('RaidPrize', true) !== true) return 'proceed';
    if (prizeRaid?.quest === quest) return prizeRaid.state === 'done' ? 'proceed' : 'wait';
    // the voyage's raiders beaten: their vessel's hold, before the ship sails on
    prizeRaid = { quest, state: 'open' };
    const cls = classById(deps.level?.() >= 4 ? 'pirateBrig' : 'pirateSloop');
    const seed = u32();
    const names = shipNames(cls, seed, { regionIndex: where().region ?? 17 });
    const items = drawHold(cls, seed, (key, tier) => deps.hold?.(key, tier) ?? []);
    const opened = deps.board?.openPlunder?.({
      name: names.name, captain: names.captain, classLine: classLine(cls), faction: 'pirate', items, raid: true,
      mine: () => null, offers: () => [], takeAll: () => takeInto(items, null),
      chosen: () => null, fated: () => (prizeRaid?.state === 'done' ? 'sailed' : null),
      choose: () => false,
      fate: () => { if (prizeRaid) prizeRaid.state = 'done'; },
    });
    if (opened === false) { prizeRaid.state = 'done'; return 'proceed'; }   // no window to show it in: the voyage goes on
    return 'wait';
  }
  /**
   * A raid's quest ended (the machine's OnQuestEnded). Won - the pirate attack's leader down, or a small raid's wave
   * killed with no "Leave Ship" to say so (navalBoarding.js raidQuestWon) - the boarders are thrown back; ended by its
   * own clock first, they give up the fight and cast off.
   */
  function raidEnded(quest) {
    if (quest) raidUids.delete(quest.uid);
    const b = raids.get(quest);
    if (!b) return;
    const entry = sea.get(b.shipId);
    if (entry && raidQuestWon(quest)) { winBoarding(b, entry); return; }
    if (entry) { entry.ship.boarded = false; deps.say?.(`${entry.ship.names?.name ?? 'The pirates'} cast off.`, 3); }
    endBoarding();
  }
  /** Where a naval raid's quest foe stands: a spot on the deck being boarded (world.js's tryPlaceFoe asks first). */
  function placeQuestFoe(quest) {
    const b = raids.get(quest);
    if (!b?.boat) return null;
    const spots = deps.board?.deckSpots?.(b.boat, 12) ?? [];
    if (!spots.length) return null;
    return spots[Math.floor(random() * spots.length)];
  }

  // ── rams ─────────────────────────────────────────────────────────────────────────────────────────────────────────
  function checkRams(boat) {
    if (!boat) return;
    const pose = boatPose(boat);
    const v = pose.velocity;
    const fwd = quatRotate(pose.rotation, [0, 0, 1]);
    const speed = v[0] * fwd[0] + v[2] * fwd[2];
    if (speed < RAM_SPEED) return;
    const bowLocal = [0, 1, (hullBuild(boat.hull).beam || 2) * 2.4];
    const bow = [pose.position[0] + fwd[0] * bowLocal[2], pose.position[1] + 1, pose.position[2] + fwd[2] * bowLocal[2]];
    for (const e of sea.values()) {
      if (!e.boat || e.ship.damage.state === SHIP_STATES.sunk || clock - e.ramAt < RAM_COOLDOWN_S) continue;
      const box = hullBox(e.boat);
      if (!box) continue;
      const l = [bow[0] - box.c[0], bow[1] - box.c[1], bow[2] - box.c[2]];
      const x = Math.abs(l[0] * box.ax[0] + l[1] * box.ax[1] + l[2] * box.ax[2]), z = Math.abs(l[0] * box.az[0] + l[1] * box.az[1] + l[2] * box.az[2]);
      if (x > box.h[0] + 1 || z > box.h[2] + 1) continue;
      e.ramAt = clock;
      const galley = hullBuild(boat.hull).ram;
      const dealt = Math.round(speed * RAM_DAMAGE * (galley ? GALLEY_RAM : 1));
      effects.hit(bow, fwd, true);
      sound(NAVAL_SFX.hit, bow, 1);
      deps.shake?.(3);
      deps.mid?.(galley ? 'Your ram smashes into her hull!' : 'You ram her!', 2);
      const hurt = { hull: dealt, sail: 0, crew: Math.round(dealt / 40) };
      chargePlayer('fire', e);
      e.myBlowAt = clock;
      if (e.owner) deps.online?.sendHit?.(navalHitData(e.owner, { n: e.n, hull: Math.min(400, hurt.hull), crew: hurt.crew, zone: 'holed' }));
      else strike(e, hurt, myId());
      const st = myBoatState(boat);
      st?.damage.apply({ hull: Math.round(dealt * (galley ? RAM_RECOIL / GALLEY_RAM : RAM_RECOIL * 2)), sail: 0, crew: 0 }, clock);
    }
  }

  // ── the frame ────────────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * One frame of the sea, the streaming world's exterior only. `paused` holds every clock (the shots, the ships, the
   * smoke - a pause is a pause); `outdoors` false (a building, a dungeon) takes the sea away.
   */
  function frame(dt, { paused = false, outdoors = true, brace = false } = {}) {
    if (!enabled) return;
    if (!outdoors) { if (sea.size || shots.inFlight) clear(); return; }
    // AUDIT NAV1: the sea keeps the world's time. A frame's time - Come Sail Away's time scale's too - is stepped in
    // FRAME_STEP_S steps (FRAME_STEPS_MAX at most; a longer stall drops the rest), and the hulls are posed once after
    const total = paused ? 0 : Math.min(Math.max(0, dt), FRAME_STEP_S * FRAME_STEPS_MAX);
    const seaY = deps.seaY();
    const boat = myBoat();
    const st = boat ? myBoatState(boat) : null;
    // notoriety fades day by day
    whereNow = null;   // the waters, read afresh for this frame
    const day = where().day ?? null;
    if (day != null) { if (lastDecayDay != null && day > lastDecayDay) notoriety.decay(day - lastDecayDay); lastDecayDay = day; }
    if (!total) return;
    braceHeld = !!brace;
    for (let left = total; left > 1e-9;) {
      const h = Math.min(left, FRAME_STEP_S);
      stepSea(h, seaY, boat);
      left -= h;
    }
    if (st && (st.damage.state === SHIP_STATES.wrecked || st.damage.sailShare() <= 0)) {
      const r = csa();
      if (r?.state?.sailPosition > 0) { r.LowerSails?.(); deps.say?.('The rigging is shot away - no sail will set.', 2.5); }
    }
    // an owner gone from the room takes their ships with them (checked every OWNER_SWEEP_S)
    if (deps.online && clock - lastSweep >= OWNER_SWEEP_S) { lastSweep = clock; sweepOwners(new Set((deps.online.peers?.() ?? []).map((p) => p.id))); }
    buildOne();
    for (const e of sea.values()) poseShip(e, total, seaY);
    // the aim, on the hulls as this frame stands them (AUDIT NAV1: it read the last frame's, a ship's way behind)
    aim = null; aimHit = null;
    if (aiming && boat) {
      const side = lookSide(boat);
      if (side) { aim = lookAim(boat, side); aimHit = aimStrikes(aim); }
    } else if (!boat) aiming = false;
    // the word's memory of the last moments
    wireVolleys = wireVolleys.filter((v) => clock - v.at <= NAVAL_VOLLEY_KEEP_MS / 1000);
    wireBarrels = wireBarrels.filter((v) => clock - v.at <= NAVAL_VOLLEY_KEEP_MS / 1000);
    for (let i = flashes.length - 1; i >= 0; i--) if (clock - flashes[i].t > MUZZLE_FLASH_S) flashes.splice(i, 1);
  }

  /** One step of the sea's clocks (`d` at most FRAME_STEP_S): my boats, the rams, the traffic, the captains and the
   *  hulls kept apart, the raiders' reckoning, the others' ships eased, the boarding, the shots and the smoke. */
  function stepSea(d, seaY, boat) {
    clock += d;
    // my boats: their clocks, the brace, their fires
    for (const b of myBoats()) {
      const s = myBoatState(b);
      s.guns.step(d);
      s.guns.braced = b === boat && braceHeld;
      s.damage.step(d, clock);
    }
    checkRams(boat);

    // the sea's traffic, when this player stands it and is on the water
    const stands = standsSea();
    const onWater = !!boat || deps.isWater(deps.feet()[0], deps.feet()[2], 0);
    const density = DENSITY[setting('ShipsAtSea', 'some')] ?? DENSITY.some;
    if (stands && onWater && density > 0) {
      const w = where();
      const crown = crownOf(w.px ?? 0, w.py ?? 0, w.capitals ?? null, w.region ?? -1);
      const players = [deps.feet(), ...(deps.online?.peers?.() ?? []).map((p) => p.feet)];
      const mine = [...sea.values()].filter((e) => !e.owner);
      const out = director.step(d, {
        density, player: deps.feet(), players, level: deps.level?.() ?? 1, seaY,
        // AUDIT NAV1 (B1): engaged while she fights, comes alongside or is boarded - a prize, a struck hulk or a boarding
        // given up is let go once out of sight - and only a ship afloat counts against the density; NAV-R: a raider is
        // its own law's to despawn (raiders()), and counts in the density
        ships: mine.map((e) => ({ id: e.id, pos: e.ship.pos, classId: e.ship.cls.id, engaged: e.ship.mode === 'engage' || e.ship.mode === 'board' || boarding?.shipId === e.id || !!e.raider, afloat: e.ship.damage.state === SHIP_STATES.afloat })),
        isOpenWater: (x, z, hull) => deps.isWater(x, z, hull), nearPort: !!w.nearPort, notoriety: notoriety.get(crown.name),
        seedBase: seedBaseOf(w.px ?? 0, w.py ?? 0, w.day ?? 0),
      });
      for (const id of out.despawn) { const e = sea.get(id); if (e) drop(e); }
      if (out.spawn) launch(out.spawn);
    } else if (!onWater) director.reset();

    // the captains of the ships I stand
    const world = {
      now: clock, dt: d, seaY, wind: wind(), isWater: (x, z, hull = HULL.SmallShip) => deps.isWater(x, z, hull), contacts: contacts(),
      notoriety: (c) => notoriety.get(c), random, boarders: setting('Boarders', true) !== false,
    };
    for (const e of [...sea.values()]) {
      if (e.owner) continue;
      const s = e.ship;
      if (s.damage.state === SHIP_STATES.sunk) { drop(e); continue; }
      if (boarding?.shipId === e.id) { s.damage.step(d, clock); continue; }
      const out = stepCaptain(s, world);
      s.damage.step(d, clock);
      for (const side of out.runOuts) runOutTell(e, side);
      const pose = { position: s.pos, rotation: quatOfYaw(s.yaw), velocity: velocityOf(s), hull: s.hull };
      for (const v of out.volleys) { fire({ shooter: e.id, wireShooter: e.n, hull: s.hull, pose, solution: v.solution, skill: s.cls.skill }); noteInbound(e, v.side); }
      for (const bsol of out.barrels) fire({ shooter: e.id, wireShooter: e.n, hull: s.hull, pose, solution: bsol, skill: s.cls.skill });
      if (out.grapple && !boarding && boat && out.grapple === myId() && setting('Boarders', true) !== false) startBoarding('repel', e, boat);
    }
    checkShipRams();
    separateHulls();
    // NAV-R: a raider of mine sunk, struck, taken or boarding, or one that chased me and lost me, is spent for its life
    for (const e of sea.values()) {
      if (e.owner || !e.raider || e.raider.spent) continue;
      if (chasesMe(e)) e.raider.chased = true;
      const slipped = e.raider.chased && e.ship.mode === 'cruise';
      if (slipped || e.ship.boarded || boarding?.shipId === e.id || e.ship.damage.state !== SHIP_STATES.afloat) spendRaider(e, slipped);
    }
    // the others' ships: eased toward their word
    for (const e of sea.values()) {
      if (!e.owner || !e.target || boarding?.shipId === e.id) continue;
      const tgt = e.target;
      if (dist2d(e.ship.pos, tgt.pos) > PUPPET_SNAP_M) { e.ship.pos = [...tgt.pos]; e.ship.yaw = tgt.yaw; continue; }
      const k = 1 - Math.exp(-PUPPET_EASE * d);
      e.ship.pos = [e.ship.pos[0] + (tgt.pos[0] - e.ship.pos[0]) * k, tgt.pos[1], e.ship.pos[2] + (tgt.pos[2] - e.ship.pos[2]) * k];
      e.ship.yaw = wrapAngle(e.ship.yaw + wrapAngle(tgt.yaw - e.ship.yaw) * k);
    }
    stepBoarding(d);
    for (const e of sea.values()) glintRunOut(e, d, seaY);
    shots.step(d);
    effects.step(d);
  }

  /** A ship of mine coming for me: fighting me, or coming alongside to board. */
  const chasesMe = (e) => (e.ship.mode === 'engage' || e.ship.mode === 'board') && e.ship.target === myId();

  // ── hulls kept apart, and a galley's ram (AUDIT NAV1) ──────────────────────────────────────────────────────────────
  /** A hull on the flat, off its build: its centre, forward and right, half length and half width. */
  function flatHull(pos, yaw, hull) {
    const b = hullBuild(hull);
    const f = [Math.sin(yaw), Math.cos(yaw)];
    const mid = (b.bowZ + b.aftZ) / 2;
    return { c: [pos[0] + f[0] * mid, pos[2] + f[1] * mid], f, r: [f[1], -f[0]], hl: (b.bowZ - b.aftZ) / 2, hw: b.halfWidth };
  }
  /** The least push that takes hull A out of hull B (separating axes on the flat), or null when they stand apart. */
  function hullOverlap(A, B) {
    const d = [B.c[0] - A.c[0], B.c[1] - A.c[1]];
    let best = null, least = Infinity;
    for (const u of [A.f, A.r, B.f, B.r]) {
      const ra = A.hl * Math.abs(A.f[0] * u[0] + A.f[1] * u[1]) + A.hw * Math.abs(A.r[0] * u[0] + A.r[1] * u[1]);
      const rb = B.hl * Math.abs(B.f[0] * u[0] + B.f[1] * u[1]) + B.hw * Math.abs(B.r[0] * u[0] + B.r[1] * u[1]);
      const dd = d[0] * u[0] + d[1] * u[1];
      const o = ra + rb - Math.abs(dd);
      if (o <= 0) return null;
      if (o < least) { least = o; best = [-Math.sign(dd || 1) * u[0] * o, -Math.sign(dd || 1) * u[1] * o]; }
    }
    return best;
  }
  /**
   * Every sea ship of mine that stands in another hull - a ship of mine, another player's, one of my boats - is pushed
   * out along the shallowest axis (two of mine share it), and the way she made into it is taken off her.
   */
  function separateHulls() {
    const list = [];
    for (const e of sea.values()) {
      if (boarding?.shipId === e.id || e.ship.damage.state === SHIP_STATES.sunk) continue;
      list.push({ ship: e.ship, movable: !e.owner, pos: e.ship.pos, yaw: e.ship.yaw, hull: e.ship.hull });
    }
    for (const b of myBoats()) list.push({ ship: null, movable: false, pos: b.GameObject.position, yaw: yawOfRot(b.GameObject.rotation), hull: b.hull });
    if (list.length < 2) return;
    const shove = (x, v) => {
      x.ship.pos[0] += v[0]; x.ship.pos[2] += v[1];
      const l = Math.hypot(v[0], v[1]) || 1, f = forwardOfYaw(x.ship.yaw);
      const into = -(f[0] * v[0] + f[2] * v[1]) / l;   // her heading into what she met
      if (into > 0) x.ship.speed *= clamp(1 - into, 0, 1);
    };
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const A = list[i], B = list[j];
        if (!A.movable && !B.movable) continue;
        const push = hullOverlap(flatHull(A.pos, A.yaw, A.hull), flatHull(B.pos, B.yaw, B.hull));
        if (!push) continue;
        if (A.movable && B.movable) { shove(A, [push[0] / 2, push[1] / 2]); shove(B, [-push[0] / 2, -push[1] / 2]); }
        else if (A.movable) shove(A, push);
        else shove(B, [-push[0], -push[1]]);
      }
    }
  }
  /** A galley of mine that strikes a hull with her ram at RAM_SPEED or more: the ram's own law, the player's boats
   *  and the sea's ships alike - my boats take it on my client (the victim's law), a ship of mine is struck. */
  function checkShipRams() {
    for (const e of sea.values()) {
      const s = e.ship;
      if (e.owner || !hullBuild(s.hull).ram || s.damage.state !== SHIP_STATES.afloat || s.speed < RAM_SPEED) continue;
      if (clock - (e.rammedAt ?? -Infinity) < RAM_COOLDOWN_S) continue;
      const f = forwardOfYaw(s.yaw), bowZ = hullBuild(s.hull).bowZ;
      const bow = [s.pos[0] + f[0] * bowZ, deps.seaY() + 1, s.pos[2] + f[2] * bowZ];
      const inBox = (box) => {
        const l = [bow[0] - box.c[0], bow[1] - box.c[1], bow[2] - box.c[2]];
        return Math.abs(l[0] * box.ax[0] + l[1] * box.ax[1] + l[2] * box.ax[2]) <= box.h[0] + 1 && Math.abs(l[0] * box.az[0] + l[1] * box.az[1] + l[2] * box.az[2]) <= box.h[2] + 1;
      };
      for (const b of myBoats()) {
        const box = hullBox(b);
        if (!box || !inBox(box)) continue;
        const v = boatPose(b).velocity;
        const closing = s.speed - (v[0] * f[0] + v[2] * f[2]);
        if (closing < RAM_SPEED) continue;
        e.rammedAt = clock;
        const st = myBoatState(b);
        const dealt = Math.round(closing * RAM_DAMAGE * GALLEY_RAM * (st.guns.braced ? BRACE_TAKEN : 1));
        st.damage.apply({ hull: dealt, sail: 0, crew: Math.round(dealt / 40) }, clock);
        effects.hit(bow, f, true);
        sound(NAVAL_SFX.hit, bow, 1);
        deps.shake?.(3.5);
        deps.mid?.(`${s.names?.name ?? 'A galley'} rams you!`, 2);
        s.damage.apply({ hull: Math.round(dealt * RAM_RECOIL / GALLEY_RAM), sail: 0, crew: 0 }, clock);
        break;
      }
      if (clock - (e.rammedAt ?? -Infinity) < RAM_COOLDOWN_S) continue;
      for (const t of sea.values()) {
        if (t === e || !t.boat || t.owner || t.ship.damage.state === SHIP_STATES.sunk || boarding?.shipId === t.id) continue;
        const box = hullBox(t.boat);
        if (!box || !inBox(box)) continue;
        const tv = velocityOf(t.ship);
        const closing = s.speed - (tv[0] * f[0] + tv[2] * f[2]);
        if (closing < RAM_SPEED) continue;
        e.rammedAt = clock;
        const dealt = Math.round(closing * RAM_DAMAGE * GALLEY_RAM);
        effects.hit(bow, f, true);
        sound(NAVAL_SFX.hit, bow, 1);
        strike(t, { hull: dealt, sail: 0, crew: Math.round(dealt / 40) }, e.id);
        s.damage.apply({ hull: Math.round(dealt * RAM_RECOIL / GALLEY_RAM), sail: 0, crew: 0 }, clock);
        break;
      }
    }
  }

  // ── the others (NAV-G) ───────────────────────────────────────────────────────────────────────────────────────────
  /** My word: the ships I stand, my recent volleys and barrels. */
  function word(toWire) {
    const ships = [...sea.values()].filter((e) => !e.owner).map((e) => ({
      n: e.n, classId: e.ship.cls.id, variant: e.ship.variant, pos: e.ship.pos, yaw: e.ship.yaw, speed: e.ship.speed, sails: e.ship.sails,
      hull: e.ship.damage.hullShare(), sail: e.ship.damage.sailShare(), crew: e.ship.damage.crewShare(),
      state: e.ship.boarded && e.ship.damage.state === SHIP_STATES.struck ? 'boarded' : e.ship.damage.state, heel: e.ship.heel, seed: e.ship.seed, fire: e.ship.damage.fire > 0,
      runOut: [...e.ship.runOut.keys()].reduce((m, side) => m | (1 << SIDES.indexOf(side)), 0),
    }));
    return navalWireRecord({ ships, volleys: wireVolleys, barrels: wireBarrels }, toWire);
  }
  /** A peer's word: their ships stood as puppets, their volleys flown and drawn, their barrels afloat. */
  function applyWord(owner, raw, toScene = (p) => p) {
    if (!enabled || typeof owner !== 'string' || owner === myId()) return false;
    const rec = raw == null ? null : validNavalRecord(raw);
    if (!rec) { if (raw == null) dropOwner(owner); return raw == null; }
    const keep = new Set();
    for (const w of rec.ships) {
      const id = `${owner}:${w.n}`;
      keep.add(id);
      let e = sea.get(id);
      const pos = toScene(w.pos);
      if (!e) e = launch({ seed: w.seed, classId: w.classId, variant: w.variant, pos: [pos[0], deps.seaY(), pos[2]], yaw: w.yaw }, owner, w.n);
      if (!e) continue;
      e.seen = clock;
      e.target = { pos: [pos[0], deps.seaY(), pos[2]], yaw: w.yaw };
      e.ship.speed = w.speed; e.ship.sails = w.sails; e.ship.heel = w.heel;
      const dmg = e.ship.damage;
      const was = dmg.state;
      dmg.restore({ hull: dmg.maxHull * w.hull100 / 100, sail: dmg.maxSail * w.sail100 / 100, crew: dmg.maxCrew * w.crew100 / 100, fire: w.fire ? 5 : 0, state: w.state === 'boarded' ? SHIP_STATES.struck : w.state });
      // she went down in their word: if my blows were on her, the sinking is mine to answer for too (the law, a reward)
      const down = (st) => st === SHIP_STATES.sinking || st === SHIP_STATES.sunk;
      if (!down(was) && down(dmg.state) && clock - (e.myBlowAt ?? -Infinity) <= SINK_CREDIT_S) chargePlayer('sink', e);
      e.ship.boarded = w.state === 'boarded' && boarding?.shipId !== id;
      if (w.fire) igniteShip(e);
      // AUDIT NAV1 (the guns): her run-out, as her stander says it - the tell is every player's to see and hear
      SIDES.forEach((side, i) => {
        const on = (w.runOut & (1 << i)) !== 0;
        if (on && !e.ship.runOut.has(side)) { e.ship.runOut.set(side, clock); runOutTell(e, side); }
        else if (!on) e.ship.runOut.delete(side);
      });
    }
    for (const e of [...sea.values()]) if (e.owner === owner && !keep.has(e.id) && boarding?.shipId !== e.id) drop(e);
    let seen = seenVolleys.get(owner);
    if (!seen) { seen = new Set(); seenVolleys.set(owner, seen); }
    for (const v of rec.volleys) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      fireFromWord(owner, v, toScene);
      const from = v.shooter >= 0 ? sea.get(`${owner}:${v.shooter}`) : null;
      if (from) noteInbound(from, v.side);   // AUDIT NAV1 (the guns): her volley at me, the warning through its flight
    }
    for (const b of rec.barrels) {
      const key = `b${b.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      shots.dropBarrel({ id: `${owner}:${b.id}`, shooter: `peer:${owner}`, pos: toScene(b.pos), resolve: false, owner });
    }
    if (seen.size > 512) { const keepIds = [...seen].slice(-256); seen.clear(); for (const k of keepIds) seen.add(k); }
    return true;
  }
  function dropOwner(owner) {
    for (const e of [...sea.values()]) if (e.owner === owner && boarding?.shipId !== e.id) drop(e);
    seenVolleys.delete(owner);
  }
  /** A room change, a leave: every peer's ships go (the pool's puppets' own clear - exteriorFoes clearPuppets). */
  function clearPeers() {
    for (const e of [...sea.values()]) if (e.owner) drop(e);
    seenVolleys.clear();
  }
  /** An owner gone from the room, or quiet past `staleMs`, takes their ships with them. */
  function sweepOwners(alive, staleS = OWNER_STALE_S) {
    const owners = new Set([...sea.values()].map((e) => e.owner).filter(Boolean));
    for (const o of owners) {
      const last = Math.max(...[...sea.values()].filter((e) => e.owner === o).map((e) => e.seen));
      if (!alive?.has?.(o) || clock - last > staleS) dropOwner(o);
    }
  }
  /** A blow on a ship I stand, from a peer (or a boarding claim). */
  function applyPeerHit(from, data) {
    const hit = validNavalHit(data);
    if (!hit) return false;
    const entry = sea.get(`${myId()}:${hit.n}`);
    if (!entry || entry.owner) return false;
    if (hit.board) {
      if (hit.board === BOARD_CODES.boarding) entry.ship.boarded = true;
      else if (hit.board === BOARD_CODES.taken) entry.ship.damage.takePrize();
      else if (hit.board === BOARD_CODES.scuttled) entry.ship.damage.scuttle();
      else if (hit.board === BOARD_CODES.adrift) { entry.ship.damage.takePrize(); entry.ship.boarded = false; }
      return true;
    }
    strike(entry, { hull: hit.hull, sail: hit.sail, crew: hit.crew, fire: hit.fire }, from);
    return true;
  }

  // ── the HUD's model ──────────────────────────────────────────────────────────────────────────────────────────────
  /**
   * What the naval HUD draws this frame (ui/navalHud.js). At a helm: the plate, the rose, the aim, the card and the
   * prompt. On foot: the card alone, and only while a struck ship or a prize of mine is in reach - the prompt that says
   * which key goes over her rail. Otherwise null.
   */
  function hudModel() {
    if (!enabled) return null;
    const boat = myBoat();
    const w = where();
    const crown = crownOf(w.px ?? 0, w.py ?? 0, w.capitals ?? null, w.region ?? -1);
    const notorietyWord = { crown: crown.name, value: notoriety.get(crown.name), level: notorietyLevel(notoriety.get(crown.name)) };
    if (!boat) {
      const e = boarding ? null : (prizeInReach(null) ?? boardableOnFoot());
      if (!e) return null;
      const card = targetCardOf(e, deps.feet());
      return {
        ship: null, armed: false, batteries: [], aim: null, aiming: false,
        target: card,
        board: { name: card.name, kind: e.prize ? 'hold' : 'board' },
        boarding: null, notoriety: notorietyWord,
      };
    }
    const st = myBoatState(boat);
    const look = lookSide(boat);
    const batteries = SIDES.map((side) => {
      const b = batteryOf(boat.hull, side);
      if (!b) return null;
      return { side, gun: b.gun, guns: b.muzzles.length, progress: st.guns.progress(side), ready: st.guns.ready(side), active: side === look, barrels: b.gun === 'barrel' ? st.guns.barrels : null };
    }).filter(Boolean);
    const target = targetCard(boat);
    const state = aim ? aimState(st, aim.side, boat) : null;
    const hot = !!aimHit && state === 'ready';
    const nb = boarding ? null : boardable(boat);
    const pr = nb || boarding ? null : prizeInReach(boat);
    return {
      ship: { name: HULL_NAMES[boat.hull], hull: st.damage.hullShare(), sail: st.damage.maxSail > 0 ? st.damage.sailShare() : null, crew: st.damage.maxCrew > 0 ? st.damage.crewShare() : null, fire: st.damage.fire > 0, wrecked: st.damage.state === SHIP_STATES.wrecked, braced: st.guns.braced, repair: repairCost(st.damage) },
      armed: batteries.length > 0,
      batteries,
      aim: aim ? { side: aim.side, gun: aim.gun, range: Math.round(aim.range), max: Math.round(aim.maxRange), hot, barrel: aim.barrel, state, left: state === 'reloading' ? +st.guns.left(aim.side).toFixed(1) : 0 } : null,
      aiming,
      target,
      board: nb ? { name: nb.ship.names?.name ?? 'the ship', kind: 'board' } : pr ? { name: pr.ship.names?.name ?? 'the ship', kind: 'hold' } : null,
      boarding: boarding ? { kind: boarding.kind, phase: boarding.phase } : null,
      notoriety: notorietyWord,
      incoming: st.damage.state === SHIP_STATES.wrecked ? null : incoming(boat),
      tally: tally && clock - tally.at <= TALLY_S ? { balls: tally.balls, hits: tally.hits, holed: tally.holed, rig: tally.rig } : null,
    };
  }
  /** The ship the target card reads: while a broadside is laid, the one its guns strike (AUDIT NAV1: a broadside's
   *  zone lies forward of the look - the galley's helm laid square on a sloop 14.7 degrees off the crosshair showed no
   *  card); else the one the look is on (within 900 m, within 6 degrees of its bearing or its box). */
  function targetCard(boat) {
    if (aimHit?.ship?.boat && sea.has(aimHit.ship.id)) return targetCardOf(aimHit.ship, boatPose(boat).position);
    const look = deps.look?.();
    if (!look) return null;
    const lf = flatUnit(look.dir) ?? [0, 0, 1];
    let best = null, bestA = Infinity;
    for (const e of sea.values()) {
      if (!e.boat || e.ship.damage.state === SHIP_STATES.sunk) continue;
      const p = e.ship.pos;
      const to = [p[0] - look.origin[0], 0, p[2] - look.origin[2]];
      const dist = Math.hypot(to[0], to[2]);
      if (dist > 900) continue;
      const cos = (to[0] * lf[0] + to[2] * lf[2]) / (dist || 1);
      const halfWidth = Math.atan2(hullBuild(e.ship.hull).beam * 3 + 8, dist);
      const a = Math.acos(clamp(cos, -1, 1));
      if (a > Math.max(6 * NAVAL_DEG, halfWidth)) continue;
      if (a < bestA) { bestA = a; best = e; }
    }
    return best ? targetCardOf(best, boatPose(boat).position) : null;
  }
  /** A ship's card, its distance from `from`. */
  function targetCardOf(e, from) {
    const s = e.ship;
    return {
      name: s.names?.name ?? 'A ship', captain: s.names?.captain ?? null, classLine: classLine(s.cls, s.names?.crown), faction: s.cls.faction,
      hull: s.damage.hullShare(), sail: s.damage.maxSail > 0 ? s.damage.sailShare() : null, state: s.damage.state, boarded: !!s.boarded,
      distance: Math.round(dist2d(s.pos, from)),
      hostile: hostile(s, { kind: 'player', id: myId() }, { notoriety: (c) => notoriety.get(c), now: clock }),
    };
  }

  // ── the draw ─────────────────────────────────────────────────────────────────────────────────────────────────────
  /** What render/navalRender.js draws this frame. */
  function drawFrame() {
    let aimDraw = null;
    if (aim && !aim.barrel) {
      // AUDIT NAV1 (the helm): each gun's arc to where it stops - her side (a strike's mark) or the sea (a zone's)
      const hits = aimHit?.hits ?? [];
      const arcs = aim.launches.map((l, i) => (hits[i] ? arcTo(l, hits[i].t) : arcPoints(l.p0, l.v0, deps.seaY(), 18)));
      const zone = aim.landings.map((l, i) => (l && !hits[i] ? l.point : null)).filter(Boolean);
      const strikes = hits.filter(Boolean).map((h) => h.point);
      const boat = myBoat();
      const ready = !!boat && aimState(myBoatState(boat), aim.side, boat) === 'ready';
      aimDraw = { arcs, zone, strikes, hot: ready && strikes.length > 0, radius: Math.max(1.6, aim.width / 2), ready, posts: true };
    } else if (aim?.barrel) {
      const boat = myBoat();
      aimDraw = { arcs: [], zone: aim.landings.map((l) => l.point), hot: false, radius: 2, ready: !!boat && aimState(myBoatState(boat), aim.side, boat) === 'ready', posts: false };
    }
    return { particles: effects.drawList(), balls: shots.balls(), floaters: shots.floaters(), aim: aimDraw };
  }
  /** The muzzles' light this frame, and the burning ships' glow (the nearest BURN_LIGHTS of them, flickering), for
   *  the host's light list - carried lights: no shadow caster, no glare. */
  function lights() {
    const out = flashes.map((f) => ({ x: f.pos[0], y: f.pos[1], z: f.pos[2], range: MUZZLE_FLASH_RANGE * (1 - (clock - f.t) / MUZZLE_FLASH_S), color: MUZZLE_FLASH_COLOR, carried: true }));
    const feet = deps.feet();
    const burning = [...sea.values()].filter((e) => e.fires?.length && e.boat).sort((a, b) => dist2d(a.ship.pos, feet) - dist2d(b.ship.pos, feet)).slice(0, BURN_LIGHTS);
    for (const e of burning) {
      const p = e.ship.pos;
      out.push({ x: p[0], y: deps.seaY() + hullBuild(e.ship.hull).deck + 2, z: p[2], range: BURN_RANGE * (0.85 + 0.15 * Math.sin(clock * 9 + e.phase)), color: BURN_COLOR, carried: true });
    }
    return out;
  }

  // ── the world moved, or went away ────────────────────────────────────────────────────────────────────────────────
  function offsetAll(o) {
    const shift = (system) => { if (system?.particleCount > 0) system.setParticles(system.getParticles().map((q) => ({ ...q, position: [q.position[0] + o[0], q.position[1] + o[1], q.position[2] + o[2]] }))); };
    for (const e of sea.values()) {
      e.ship.pos[0] += o[0]; e.ship.pos[1] += o[1]; e.ship.pos[2] += o[2];
      if (e.target) { e.target.pos[0] += o[0]; e.target.pos[2] += o[2]; }
      if (e.ship.waypoint) { e.ship.waypoint[0] += o[0]; e.ship.waypoint[1] += o[2]; }
      // her hull where the shift put the world, and her wake's living foam with it (OnPositionUpdateBoat's own)
      const b = e.boat;
      if (b) { const p = b.GameObject.position; b.GameObject.position = [p[0] + o[0], p[1] + o[1], p[2] + o[2]]; shift(b.WakeEmitter); }
    }
    for (const f of flashes) { f.pos[0] += o[0]; f.pos[1] += o[1]; f.pos[2] += o[2]; }
    if (boarding) for (const p of [boarding.from, boarding.to]) { p.pos[0] += o[0]; p.pos[2] += o[2]; }
    shots.offsetAll(o);
    effects.offsetAll(o);
  }
  /** A transition, a fast travel, a load, a room change: the sea empties (its ships were never a save's). */
  function clear() {
    for (const e of [...sea.values()]) drop(e);
    shots.clear();
    effects.clear();
    wireVolleys = []; wireBarrels = [];
    seenVolleys.clear();
    flashes.length = 0;
    aiming = false; aim = null;
    if (boarding) { for (const f of boarding.foes) deps.board?.removeFoe?.(f.handle); endBoarding(); }
    director.reset();
  }

  // ── the save (systems/modSaveData.js) ────────────────────────────────────────────────────────────────────────────
  const newSaveData = () => ({ v: NAVAL_SAVE_VERSION, boats: {}, notoriety: {}, day: null, raids: [] });
  function getSaveData() {
    const boats = {};
    for (const [uid, rec] of pendingBoats) boats[uid] = rec;
    for (const [uid, st] of boatState) boats[uid] = { ...st.damage.snapshot(), barrels: st.guns.barrels };
    return { v: NAVAL_SAVE_VERSION, boats, notoriety: notoriety.snapshot(), day: lastDecayDay, raids: [...raidUids] };
  }
  function restoreSaveData(r) {
    boatState.clear();
    pendingBoats.clear();
    notoriety.restore(r?.notoriety ?? null);
    lastDecayDay = Number.isFinite(r?.day) ? r.day : null;
    raidUids.clear();
    for (const uid of Array.isArray(r?.raids) ? r.raids : []) if (Number.isSafeInteger(uid)) raidUids.add(uid);
    for (const [uid, rec] of Object.entries(r?.boats ?? {})) {
      const key = Number(uid);
      if (!Number.isSafeInteger(key) || key <= 0 || !rec || typeof rec !== 'object') continue;
      pendingBoats.set(key, rec);
    }
    clear();
  }

  return {
    frame, attackInput, cancelAim, activate, hudModel, drawFrame, lights, offsetAll, clear, aimEye,
    word, applyWord, sweepOwners, applyPeerHit, dropOwner, clearPeers,
    leaveShipGate, raidEnded, placeQuestFoe,
    newSaveData, getSaveData, restoreSaveData,
    raiders, raiderShipOf,   // NAV-R
    /** Whether a hostile ship is near - Come Sail Away's time scale refuses to run with one (AreEnemiesNearby). */
    hostileNear() {
      for (const e of sea.values()) {
        if (e.ship.damage.state !== SHIP_STATES.afloat) continue;
        if (dist2d(e.ship.pos, deps.feet()) > HOSTILE_NEAR_M) continue;
        if (hostile(e.ship, { kind: 'player', id: myId() }, { notoriety: (c) => notoriety.get(c), now: clock })) return true;
      }
      return false;
    },
    /** The sea ships' boats standing near enough to be struck and walked on (the world's collider takes them). */
    collidable() { const f = deps.feet(); return [...sea.values()].filter((e) => e.boat && dist2d(e.ship.pos, f) < COLLIDE_RANGE).map((e) => e.boat); },
    /** Every sea ship's boat (their particles ride Come Sail Away's lists). */
    boats: () => [...sea.values()].map((e) => e.boat).filter(Boolean),
    setEnabled(v) { enabled = !!v; if (!enabled) clear(); },
    get enabled() { return enabled; },
    get aiming() { return aiming; },
    /** Whether the attack is the broadside's: at the helm of a boat with guns. The world's doors read it - the drag and
     *  the look under a held attack are the aim's there, never the swing's, and the pad and the finger hold it plainly. */
    get atGuns() { return enabled && armed(myBoat()); },
    get boarding() { return boarding; },
    get notoriety() { return notoriety; },
    /** The probes' and the tests' reading. */
    stat: () => ({ ships: [...sea.values()].map((e) => ({ id: e.id, cls: e.ship.cls.id, owner: e.owner, pos: e.ship.pos.map((v) => +v.toFixed(1)), mode: e.ship.mode, state: e.ship.damage.state, hull: +e.ship.damage.hullShare().toFixed(2), built: !!e.boat })), inFlight: shots.inFlight, particles: effects.count, standing }),
    /** A test's and a console's door: a ship launched by class near the player. */
    spawnShip(classId, { range = 300, bearing = 0, yaw = null } = {}) {
      const f = deps.feet();
      const pos = [f[0] + Math.sin(bearing) * range, deps.seaY(), f[2] + Math.cos(bearing) * range];
      return launch({ seed: u32(), classId, variant: 0, pos, yaw: yaw ?? bearing + Math.PI })?.id ?? null;
    },
    _sea: sea, _shots: shots, _effects: effects,
    get volleyWire() { return wireVolleys; },
    directorState: director,
    SIDE_DIR,
  };
}
