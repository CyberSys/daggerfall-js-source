// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF7 (2026-09-29, Mac: "Do it") - HUNTING, a kind in the gathering
// host (scenes/gatherHost.js; bible/06-Systems/Professions-Arc.md 4.4,
// 5.2, 6, 29; FORAGE0 14):
//
//   THE BODY. "A body your own blow felled" (5.2): a foe's death is told
//   by one signal, the player's own kill (systems/playerKills.js - the
//   melee, the arrow, the spell, and a puppet's owner's word), and a foe
//   4.4 skins is stamped there with its id - the UTC day and twelve hex
//   digits drawn at the kill (net/nodeLaw.js bodyKey). Hunting is bounded,
//   not witnessed (PROF0 6): the id is the client's word and the account's
//   day - 30 hides, 3 of tiers 5-6 - the service's whole defence.
//   THE NODE. A stamped body is a node while it lies in its pool (the
//   street's, or the dungeon's) and the pack holds a Skinning Knife: DFU's
//   corpse first, a node only for the one who can skin it - so a body is
//   never a prompt in the way of a player with no knife. It carries its
//   own place (`at`, the corpse marker's ground, which the floating origin
//   moves), not a pixel's or a dungeon's: a LOOSE node.
//   THE PLAN. E skins; the act choice key searches the body instead (its
//   loot is DFU's, untouched - "skinning adds, never replaces", 4.4) and
//   hands the press on to the loot.
//   THE ACT. The knife's checks in Foraging's voice (KNIFE_CHECKS: never
//   inside nor daylight - the body lies where it fell, and foes die at
//   night); the machine is systems/traceAct.js - E held, the crosshair
//   drawn along the line (attack is the weapon's, and DFU's swing modes
//   hold the look still under it); the hand draws DFU's Dagger (FORAGE0
//   14.2).
// ═══════════════════════════════════════════════════════════════════
import { bodyKey, utcDayOfMs } from '../net/nodeLaw.js';
import {
  hideOfFoe, tierOpen, TIER_RANKS, knifeBand, SKINNING_KNIFE, KNIFE_CHECKS, KNIFE_REFUSALS, HIDES_PER_DAY, HIGH_HIDES_PER_DAY,
  HIGH_HIDE_TIER, TRACKER_M,
} from '../net/professionLaw.js';
import { enemyDisplayName } from '../characters/enemyBasics.js';
import { createTraceAct } from '../systems/traceAct.js';
import { actChecksRefusal, foragingToolIn } from '../systems/foragingInstall.js';
import { materialLabel } from '../systems/profItems.js';
import { liveStat } from '../systems/statMods.js';
import { getPref } from '../systems/uiPrefs.js';

/** The Skinning Knife in the hand (FORAGE0 14.2): DFU's own Dagger. */
export const KNIFE_HAND = Object.freeze({ group: 'Weapons', templateIndex: 113, material: 0 });
/** A body answers E within this many metres (a carcass lies low - DFU's activation distance less the reach up to a
 *  door), and stands this far above its ground for the look. */
export const BODY_REACH = 2.5;
export const BODY_LIFT = 0.2;

/** A body's id: twelve hex digits from `rand` (the crypto source's fill). @param {(b: Uint8Array<ArrayBuffer>) => void} rand */
export function bodyId(rand) {
  const b = new Uint8Array(6);
  rand(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * THE STAMPS: a foe 4.4 skins, stamped at the kill the player's own blow made - `{ key, foe, tier, hide }` by its entity.
 * A kill told again (the same entity felled anew) stamps it anew.
 * @param {{ nowMs: () => number, rand?: (b: Uint8Array<ArrayBuffer>) => void }} deps `nowMs` the shared clock
 */
export function createBodyStamps({ nowMs, rand = (b) => { globalThis.crypto.getRandomValues(b); } }) {
  let stamps = new WeakMap();
  return {
    /** The player's own kill (systems/playerKills.js's listener). The stamp, or null for a foe no knife takes a hide from. */
    stamp(entity) {
      if (!entity || typeof entity !== 'object') return null;
      const hide = hideOfFoe(entity.mobileType);
      if (!hide) return null;
      const s = Object.freeze({ key: bodyKey({ day: utcDayOfMs(nowMs()), id: bodyId(rand) }), foe: entity.mobileType, tier: hide.tier, hide: hide.key });
      stamps.set(entity, s);
      return s;
    },
    /** A body's stamp, or null. */
    of: (entity) => (entity && typeof entity === 'object' ? stamps.get(entity) ?? null : null),
    /** A new character: no body is theirs. */
    clear() { stamps = new WeakMap(); },
  };
}

/**
 * A POOL'S STAMPED BODIES - `{ key, foe, tier, hide, at, lift, reach }` for each dead foe with a body and a stamp;
 * `at()` its place now (the pool's own: the corpse marker's ground on the street, the feet in a dungeon), or null.
 * @param {readonly any[]|null|undefined} foes @param {{ of: (e: any) => any }} stamps @param {(f: any) => number[]|null|undefined} placeOf
 */
export function bodiesOf(foes, stamps, placeOf) {
  const out = [];
  for (const f of foes ?? []) {
    if (!f?.dead || !f.corpse) continue;
    const s = stamps.of(f.entity);
    if (!s) continue;
    out.push({ key: s.key, foe: s.foe, tier: s.tier, hide: s.hide, at: () => placeOf(f) ?? null, lift: BODY_LIFT, reach: BODY_REACH });
  }
  return out;
}

/** A Tracker's marks (3.3): the living animals of a pool within TRACKER_M of `at` - the foes 4.4 skins - as scene XZ.
 *  @param {readonly any[]|null|undefined} foes @param {number[]} at */
export function trackerMarks(foes, at) {
  const out = [];
  for (const f of foes ?? []) {
    const feet = f?.ai?.feet;
    if (!f || f.dead || !feet || !hideOfFoe(f.entity?.mobileType ?? f.mobileType)) continue;
    if (Math.hypot(feet[0] - at[0], feet[2] - at[2]) <= TRACKER_M) out.push([feet[0], feet[2]]);
  }
  return out;
}

/** The foe's name as DFU gives it ("Grizzly Bear"). */
const foeName = (mobileType) => enemyDisplayName(mobileType) ?? 'body';

/**
 * WHAT E DOES AT A BODY, and the prompt that says it: `{ harvest, verb, rest, ready }` - `ready` false with `rest`
 * naming what is missing (skinned, being counted, the account's day, its rare hides, the rank, the Stores' room); a rank
 * short carries the rank it needs (VEIN-NEED). `loot` - the choice key's pick: the body's loot, the press handed on.
 * @param {{ body: any, taken: boolean, counting: boolean, rank: number, storesFull: (key: string) => boolean,
 *   hides: number, high: number, loot?: boolean }} o
 */
export function huntPlan({ body, taken, counting, rank, storesFull, hides, high, loot = false }) {
  const name = foeName(body.foe);
  const harvest = 'hide';
  const verb = `Skin the ${name}`;
  const rankWord = `Hunting ${rank}`;
  if (loot) return { harvest, verb: `Search the ${name}`, rest: '', ready: false, loot: true };
  if (taken) return { harvest, verb: `The ${name} - skinned`, rest: '', ready: false };
  if (counting) return { harvest, verb, rest: 'being counted', ready: false };
  if (hides >= HIDES_PER_DAY) return { harvest, verb, rest: `${rankWord} - ${hides} of ${HIDES_PER_DAY} hides today`, ready: false, full: true };
  if (body.tier >= HIGH_HIDE_TIER && high >= HIGH_HIDES_PER_DAY) return { harvest, verb, rest: `${high} of ${HIGH_HIDES_PER_DAY} rare hides today`, ready: false, full: true };
  if (!tierOpen(rank, body.tier)) return { harvest, verb, rest: `needs Hunting ${TIER_RANKS[body.tier - 1]}`, ready: false, needsRank: TIER_RANKS[body.tier - 1] };
  if (storesFull(body.hide)) return { harvest, verb, rest: `Stores full - ${materialLabel(body.hide)}`, ready: false };
  return { harvest, verb, rest: rankWord, ready: true };
}

/**
 * HUNTING'S KIND in the gathering host (scenes/gatherHost.js): the stamped bodies as loose nodes, the plan, the act.
 * @param {{ book: any, bodies: () => any[] }} deps `bodies` the stamped bodies where the player is (bodiesOf over the
 *   street's pool or the dungeon's)
 * @returns {import('./gatherHost.js').GatherKind}
 */
export function huntKind({ book, bodies }) {
  let lootChoice = false;   // the choice key's pick at the targeted body
  return {
    id: 'body',
    professions: Object.freeze(['hunting']),
    nodesOf: () => [],
    /** A body is a node only while the pack holds a Skinning Knife. */
    looseNodesOf: ({ entity }) => (foragingToolIn(entity, SKINNING_KNIFE.templateIndex) ? bodies() : []),
    flatsOf: () => [],   // the body is its own picture (DFU's corpse)
    gone: (b) => book.taken(b.key, 'hide'),
    choose() { lootChoice = !lootChoice; },
    retarget() { lootChoice = false; },
    plan(b, { rank, keyLabel }) {
      const hunt = book.state.hunt ?? { hides: 0, high: 0 };
      const plan = huntPlan({
        body: b, taken: book.taken(b.key, 'hide'), counting: book.counting(b.key, 'hide'), rank: rank('hunting'),
        storesFull: (key) => book.held(key) >= (book.state.caps?.stores ?? 5000), hides: hunt.hides ?? 0, high: hunt.high ?? 0, loot: lootChoice,
      });
      return { ...plan, profession: 'hunting', alt: `[${keyLabel('ActChoice')}] ${lootChoice ? 'skin it' : 'search the body'}` };
    },
    start(b, plan, { entity, rank, keyLabel }) {
      const refusal = actChecksRefusal(KNIFE_CHECKS, KNIFE_REFUSALS);
      if (refusal) return { refused: refusal };
      return {
        act: createTraceAct({
          tier: b.tier, rank: rank('hunting'),
          band: knifeBand({ intelligence: liveStat(entity, 'intelligence'), agility: liveStat(entity, 'agility') }),
          gentle: getPref('gentleActs') === true,
        }),
        harvest: plan.harvest, tool: foragingToolIn(entity, SKINNING_KNIFE.templateIndex), profession: 'hunting', label: keyLabel('Interact'),   // the key the meter says to hold
        ask: { foe: b.foe },   // the harvest names the foe the body is (PROF0 6: the tier is the client's claim)
        hand: (a) => (a.tool ? KNIFE_HAND : null),
      };
    },
    /** The account's day, as the chip says it: its hides against the day's 30. */
    tally: () => ({ n: book.state.hunt?.hides ?? 0, cap: book.state.caps?.hides ?? HIDES_PER_DAY }),
    cleanNote: () => ' (a clean pelt)',
    title: () => 'Hunter',
  };
}
