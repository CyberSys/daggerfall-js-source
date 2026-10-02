// @ts-check
// REVENANT-COMPANION (2026-10-02, Mac: "Spare should allow you to free the enemy, which then adds them as a companion,
// which you could keep send them away or keep them with you. Reuse the crew companion system. Companion slots should
// still be limited") - THE SWORN. A revenant the player spares is sworn to the player for good: it hunts nobody, and it
// walks at the player's side - or waits, sent away, until it is called.
//
//  - ONE LAYER: the crew's (scenes/crewAshore.js) stands them, places them, brings them along through every door, keeps
//    them to the player's heel, catches one up that falls behind, and carries their health and spells between places.
//    This file is that layer's PARTY for the sworn - the crew's own party shape (systems/naval/crewCompanions.js): who
//    walks ashore, a knock, a hurt - kept in the revenant's own record (systems/revenant.js `companion`), so it rides the
//    character's save and app storage with everything else the revenant is.
//  - THE PLAYER'S SIDE HAS SLOTS (systems/companionSlots.js COMPANION_SLOTS, the crew's hands ashore counted with
//    them). A spared one past them is sworn all the same and waits AWAY until there is room and the player calls it.
//  - AT MOST REVENANT_RETINUE_MAX sworn at once, with the player and away together; past it the player must release
//    one before sparing another.
//  - KNOCKED OUT it is carried off to rest, as a hand is carried aboard: REVENANT_REST_MIN of the character's minutes,
//    then it waits, fit again, to be called.
import { swornRevenants, revenantCompanionUpdate, revenantRecord, REVENANT_HEALTH_PER_RANK, REVENANT_DAMAGE_PER_RANK } from './revenant.js';
import { registerCompanionCount, companionsWithYou, COMPANION_SLOTS } from './companionSlots.js';

/** How many revenants may be sworn to the player at once - with it and away. */
export const REVENANT_RETINUE_MAX = 6;
/** How long a sworn one knocked out rests before it can be called again - the character's minutes (8 hours). */
export const REVENANT_REST_MIN = 8 * 60;
/** A sworn one's key in the companion layer (crewAshore.js companionKeyOf) - never a boat's. */
export const revenantCompanionKey = (id) => `rv:${id}`;
export const isRevenantCompanionKey = (k) => typeof k === 'string' && k.startsWith('rv:');
export const revenantIdOfKey = (k) => (isRevenantCompanionKey(k) ? k.slice(3) : null);

let _player = null;
/** @type {((kind: 'arrive'|'dismiss'|'release', r: any) => void) | null} */
let _listener = null;
/** The host's ear for the roster's acts (its portal's words as the body steps through - ui/companionRoster.js). */
export function setRetinueListener(fn) { _listener = typeof fn === 'function' ? fn : null; }
const tell = (kind, r) => { try { _listener?.(kind, r); } catch { /* a word is nobody's failure */ } };
/** @type {((id: string) => any) | null} */
let _bodies = null;
/** The host's answer to "where does this sworn one stand now" - its live entity (the roster's health bar). */
export function setRetinueBodies(fn) { _bodies = typeof fn === 'function' ? fn : null; }
/** A sworn one's live body's entity, where one stands, else null. */
export const swornBodyOf = (id) => { try { return _bodies?.(id) ?? null; } catch { return null; } };
/** The player whose sworn these are (the host's, once it stands one). */
export function setRetinuePlayer(player) { _player = player ?? null; }

const stateOf = (r) => r?.companion?.state ?? 'with';
/** The sworn, every one, the strongest first. */
export const retinue = () => swornRevenants().slice().sort((a, b) => b.rank - a.rank || (a.swornAt ?? 0) - (b.swornAt ?? 0));
/** The sworn walking with the player. */
export const revenantsWithYou = () => swornRevenants().filter((r) => stateOf(r) === 'with');
/** The sworn sent away, or resting after a fall. */
export const revenantsAway = () => swornRevenants().filter((r) => stateOf(r) !== 'with');
registerCompanionCount('revenant', () => revenantsWithYou().length);

/** May the player spare one more - a place in the retinue? */
export const retinueHasRoom = () => swornRevenants().length < REVENANT_RETINUE_MAX;
/** Where a newly spared one goes: at the player's side while a slot is free, else away. */
export const swornPlace = () => (companionsWithYou() < COMPANION_SLOTS ? 'with' : 'away');

/** Why a sworn one cannot come to the player's side now - words for the roster - or null: it may. */
export function callRefusal(r, now) {
  if (!r?.sworn) return 'It is no longer sworn to you.';
  if (stateOf(r) === 'with') return null;
  if (stateOf(r) === 'resting' && now < (r.companion?.until ?? 0)) return 'Still recovering.';
  if (companionsWithYou() >= COMPANION_SLOTS) return `Your companions are full (${COMPANION_SLOTS}).`;
  return null;
}
/** CALLED to the player's side (the roster's Call): answers the refusal's words, or null when it comes. */
export function callRevenant(id, now) {
  const r = revenantRecord(_player, id);
  const why = callRefusal(r, now);
  if (why) return why;
  revenantCompanionUpdate(_player, id, (c) => { c.state = 'with'; c.until = null; });
  tell('arrive', r);
  return null;
}
/** SENT AWAY (the roster's Send away): it leaves the player's side through its portal, and waits to be called. */
export function sendRevenantAway(id) {
  const r = revenantRecord(_player, id);
  if (!r?.sworn || stateOf(r) !== 'with') return false;
  revenantCompanionUpdate(_player, id, (c) => { c.state = 'away'; });
  tell('dismiss', r);
  return true;
}
/** RELEASED (the roster's Release, confirmed): its oath given back - it leaves for good. */
export function releaseRevenant(id) {
  const r = revenantRecord(_player, id);
  if (!r?.sworn) return null;
  const out = revenantCompanionUpdate(_player, id, () => 'release');
  if (out) tell('release', out);
  return out;
}

/** A sworn one's whole and blows over the body a place stands for it: its rank's, as it fought the player with. Its
 *  health once - a body standing with a carried whole (crewAshore) keeps it. */
export function applySwornStrength(entity, r, { fresh = true } = {}) {
  if (!entity || !r) return;
  const rank = Math.max(1, r.rank | 0);
  if (fresh) {
    entity.maxHealth = Math.max(1, Math.round((entity.maxHealth || 1) * (1 + REVENANT_HEALTH_PER_RANK * rank)));
    entity.health = entity.maxHealth;
  }
  entity.damageScale = 1 + REVENANT_DAMAGE_PER_RANK * rank;
  entity.revenant = { id: r.id, name: r.name, rank, sworn: true };   // FOE-TITLE: called by its own name everywhere
}

// ── THE PARTY, in the crew's shape (crewAshore.js reads `party`, `wake`, `knock`, `hurt`, `isAshore`) ──────────────
/** @type {Map<string, any>} - one member object per sworn one, kept: the layer keys its carried spells and its follow
 *  slot on the object itself */
const _members = new Map();
function memberOf(r) {
  let m = _members.get(r.id);
  if (!m) { m = { boat: 'rv', name: r.id, key: revenantCompanionKey(r.id) }; _members.set(r.id, m); }
  m.title = r.name;
  m.mobile = r.mobileType;
  m.gender = r.gender;
  m.health = r.companion?.health ?? null;
  m.maxHealth = r.companion?.maxHealth ?? null;
  m.items = r.companion?.items ?? [];
  m.rank = r.rank;
  m.personality = r.personality;
  return m;
}
/**
 * The sworn as the companion layer's party. `onWake(r)` - one fit again after its rest (the roster's word).
 */
export function revenantParty({ onWake = null } = {}) {
  return {
    get party() { return revenantsWithYou().map(memberOf); },
    wake(now) {
      for (const r of swornRevenants()) {
        if (stateOf(r) === 'resting' && now >= (r.companion?.until ?? 0)) {
          revenantCompanionUpdate(_player, r.id, (c) => { c.state = 'away'; c.until = null; c.health = null; });
          onWake?.(r);
        }
      }
    },
    knock(boat, id, now) {
      const r = revenantRecord(_player, id);
      if (!r?.sworn || stateOf(r) !== 'with') return false;
      revenantCompanionUpdate(_player, id, (c) => { c.state = 'resting'; c.until = now + REVENANT_REST_MIN; c.health = null; });
      return true;
    },
    hurt(boat, id, health, maxHealth) {
      const r = revenantRecord(_player, id);
      const c = r?.companion;
      if (!c || (c.health === health && c.maxHealth === maxHealth)) return;
      // the body's own numbers, kept without a revision each frame: the save reads them, and the next stand does
      c.health = Number.isFinite(health) && health > 0 ? Math.min(health, maxHealth || health) : null;
      c.maxHealth = Number.isFinite(maxHealth) && maxHealth > 0 ? maxHealth : null;
    },
    isAshore(boat, id) { const r = revenantRecord(_player, id); return !!r?.sworn && stateOf(r) === 'with'; },
    /** Its pack (the companion's storage), as the crew's is - the record's own list. */
    packOf(id) { const r = revenantRecord(_player, id); return r?.sworn ? (r.companion.items ??= []) : null; },
  };
}
/** Tests only. */
export function _resetRetinueForTests() { _members.clear(); _player = null; _listener = null; _bodies = null; }
