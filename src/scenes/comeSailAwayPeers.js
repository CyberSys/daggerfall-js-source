// @ts-check
// COME SAIL AWAY - ANOTHER PLAYER'S BOAT (CSA-J, 2026-09-28). A peer's word (systems/comeSailAwayWire.js, `sa` on
// their foes frame) stood as boats the others can see: each built as SpawnBoat builds one, into the pool's PEER list
// (scenes/comeSailAwayPool.js) - drawn, baked and lit as a boat of mine, but never a collider, a ray's hit or an
// activation, because the host's loops read the pool's own `boats` - and posed every frame from the word, which stays
// in the wire frame and is converted each frame (the floating origin, AUDIT HCC O1). A step past twenty metres is a
// teleport and snaps; anything nearer eases (horseCartWire.js easeToward, the team's law). The sails raise and stow
// as the owner's stand, through the mod's own Animator calls; the crew's idle and active objects follow the helm, the
// lanterns the owner's switch. The owner law is the camps' and the team's: an owner's word replaces theirs alone, and
// an owner gone from the room or quiet past the stale time takes their boats with them.
import { validCsaRecord } from '../systems/comeSailAwayWire.js';
import { Boat, boatAnimators, animatorOf, setLights } from '../systems/comeSailAwayBoat.js';
import { stowSail } from '../systems/comeSailAway.js';
import { easeToward } from '../systems/horseCartWire.js';
import { quatSlerp } from '../world/quat.js';

/** How fast a peer's boat turns toward its word (per second, the ease's rate). */
export const CSA_PEER_TURN_RATE = 12;

/**
 * @param {{ pool: any, selfId?: () => (string | null) }} opts
 */
export function createComeSailAwayPeers({ pool, selfId = () => null }) {
  let enabled = true;
  /** owner -> { boats, toScene, at }: the live word, in the wire frame */
  const live = new Map();
  /** owner -> [{ boat, hull, variant, shown, turn, helm, light }]: what stands for it, in the word's order */
  const shown = new Map();

  function drop(owner) {
    for (const s of shown.get(owner) ?? []) pool.remove(s.boat);
    shown.delete(owner);
  }
  /** What stands for an owner made to match their word: a boat kept where the same hull stands at the same place in the
   *  list - its variant set as SetBoatVariant sets it, the variants standing in the one instance - else built again;
   *  the rest go. Before the pool's models are in, nothing stands yet. */
  function sync(owner) {
    const l = live.get(owner);
    if (!l) { drop(owner); return; }
    if (!pool.ready?.()) return;
    const have = shown.get(owner) ?? [];
    const next = [];
    for (let i = 0; i < l.boats.length; i++) {
      const w = l.boats[i];
      let s = have[i] ?? null;
      if (s && s.hull !== w.hull) { pool.remove(s.boat); s = null; }
      if (s && s.variant !== w.variant) { pool.setVariant(s.boat, w.variant); s.variant = w.variant; }
      if (!s) {
        const boat = pool.spawnPeerNow(new Boat(w.hull, w.variant));
        if (!boat) break;
        s = { boat, hull: w.hull, variant: w.variant, shown: null, turn: null, helm: false, light: false };
      }
      next.push(s);
    }
    for (let i = next.length; i < have.length; i++) if (!next.includes(have[i])) pool.remove(have[i].boat);
    shown.set(owner, next);
  }

  /** One frame: each boat eased toward its word, its sails, crew and lanterns as the word says, its Animators stepped. */
  function frame(dt) {
    for (const [owner, l] of live) {
      if ((shown.get(owner)?.length ?? 0) !== l.boats.length) sync(owner);   // the models came in since the word did
      const list = shown.get(owner) ?? [];
      for (let i = 0; i < list.length; i++) {
        const s = list[i], w = l.boats[i];
        s.shown = easeToward(s.shown, l.toScene(w.position), dt);
        s.turn = s.turn ? quatSlerp(s.turn, w.rotation, 1 - Math.exp(-CSA_PEER_TURN_RATE * Math.max(0, dt))) : [...w.rotation];
        s.boat.GameObject.position = s.shown;
        s.boat.GameObject.rotation = s.turn;
        for (let k = 0; k < s.boat.Sails.length; k++) {
          const a = animatorOf(s.boat.Sails[k]);
          const stowed = !((w.sails >> k) & 1);
          if (a && a.GetBool('Stowed') !== stowed) stowSail(a, stowed);
        }
        if (s.helm !== w.helm) { s.helm = w.helm; s.boat.IdleObject?.setActive(!w.helm); s.boat.ActiveObject?.setActive(w.helm); }
        if (s.light !== w.light) { s.light = w.light; setLights(s.boat, w.light); }
        for (const a of boatAnimators(s.boat)) a.update(dt);
      }
    }
  }

  /** Another's word through validCsaRecord; `null` (or an invalid record) drops theirs. */
  function applyOwner(owner, raw, toScene = (p) => p, nowMs = 0) {
    if (!enabled) return false;
    if (typeof owner !== 'string' || !owner || owner === (selfId?.() ?? null)) return false;
    const r = raw == null ? null : validCsaRecord(raw);
    if (!r) { live.delete(owner); drop(owner); return raw == null; }
    live.set(owner, { boats: r.boats, toScene, at: nowMs });
    sync(owner);
    return true;
  }
  /** An owner gone from the room, or quiet past staleMs, takes their boats with them. */
  function sweepOwners(alive, nowMs, staleMs = 0) {
    for (const [owner, l] of [...live]) {
      if (alive?.has?.(owner) && !(staleMs > 0 && nowMs - l.at > staleMs)) continue;
      live.delete(owner);
      drop(owner);
    }
  }
  /** Every transition, a room change, a fast travel: nobody's boats stand until their next word. */
  function clearPeers() {
    live.clear();
    for (const owner of [...shown.keys()]) drop(owner);
  }
  /** The floating origin moved: the eased places move with the world (the words are converted every frame anyway). */
  function rebase(offset) {
    for (const list of shown.values()) for (const s of list) if (s.shown) s.shown = [s.shown[0] + offset[0], s.shown[1] + offset[1], s.shown[2] + offset[2]];
  }
  function setEnabled(v) { enabled = !!v; if (!enabled) clearPeers(); }

  return {
    applyOwner, sweepOwners, clearPeers, rebase, frame, setEnabled,
    get enabled() { return enabled; },
    /** What stands, owner by owner - a probe's and the tests' reading. */
    shown: () => [...shown].map(([owner, list]) => ({ owner, boats: list.map((s) => ({ hull: s.hull, variant: s.variant, position: s.shown ? [...s.shown] : null, boat: s.boat })) })),
  };
}
