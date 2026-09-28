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
//
// AUDIT PRE-MERGE 0928 O3: A WORD IS KEPT, NEVER BUILT FROM. The socket's handler only stores it; the frame stands what
// it names - ONE boat a frame across every owner, and each owner's builds under a bucket (CSA_PEER_BUILD_BURST at once,
// one more every CSA_PEER_BUILD_REFILL_MS), so a peer swapping its hulls on every frame it sends cannot spend another
// player's frames on SpawnBoat. A boat the word moved to another place in its list (a place, a pack) is the same boat -
// matched by its hull, nearest first - and builds nothing. A place in the list not built yet stands nothing.
// AUDIT PRE-MERGE 0928 O1: a throw building or re-dressing a peer's boat costs that owner's word and boats, said once -
// never the frame (AUDIT MWBODY A1's law, net/peerBodies.js).
// AUDIT PRE-MERGE 0928 O4: the owner's look is their boat's (AUDIT 0927 I-B's law, the cart pool's): the boat under a
// hidden owner at its helm (the classic lane) stands nowhere; under a concealed one (the enhanced lane) its crew and
// lanterns wear the owner's look while the hull draws whole; a moored boat is a boat in the world either way.
import { validCsaRecord, CSA_WIRE_BOATS_MAX } from '../systems/comeSailAwayWire.js';
import { Boat, boatAnimators, animatorOf, setLights } from '../systems/comeSailAwayBoat.js';
import { stowSail } from '../systems/comeSailAway.js';
import { easeToward, EASE_SNAP_M } from '../systems/horseCartWire.js';
import { quatSlerp } from '../world/quat.js';
import { FOES_FULL_MS } from '../net/online.js';

/** How fast a peer's boat turns toward its word (per second, the ease's rate). */
export const CSA_PEER_TURN_RATE = 12;
/** AUDIT PRE-MERGE 0928 O3: the builds an owner may spend at once - its whole list - and the time one more comes back in. */
export const CSA_PEER_BUILD_BURST = CSA_WIRE_BOATS_MAX;
export const CSA_PEER_BUILD_REFILL_MS = FOES_FULL_MS;
/** The distinct failures said to the console (a crafted stream is its own flood). */
const SAID_MAX = 16;
/** NAV-H: how fast a peer's boat's measured way settles (per second) - a jump of the ease is not a ship's speed. */
export const PEER_VEL_RATE = 4;

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/**
 * @param {{ pool: any, selfId?: () => (string | null), log?: any }} opts
 */
export function createComeSailAwayPeers({ pool, selfId = () => null, log = console }) {
  let enabled = true;
  /** @type {((owner: string) => any) | null} 'hidden', a concealed look, or null (AUDIT PRE-MERGE 0928 O4) */
  let peerLook = null;
  /** owner -> { boats, toScene, at, dirty }: the live word, in the wire frame */
  const live = new Map();
  /** owner -> the word's places, each what stands for it or null while it waits for its build:
   *  { boat, hull, variant, wire, slot, shown, turn, helm, light } */
  const shown = new Map();
  /** owner -> { tokens }: the builds an owner may spend (AUDIT PRE-MERGE 0928 O3) - kept past a dropped word and a
   *  sweep, and forgotten only once it is full again, so a word refused or nulled, or an owner out of range and back,
   *  never hands the bucket back full */
  const buckets = new Map();
  let turn = 0;   // the owner the next build asks first
  const said = new Set();

  function drop(owner) {
    for (const s of shown.get(owner) ?? []) if (s) pool.remove(s.boat);
    shown.delete(owner);
  }
  /** AUDIT PRE-MERGE 0928 O1: a peer's boat that throws is that owner's loss alone - their word and boats, said once. */
  function fail(owner, e) {
    live.delete(owner);
    drop(owner);
    const text = `${e?.name ?? 'Error'}: ${e?.message ?? e}`;
    if (said.has(text) || said.size >= SAID_MAX) return;
    said.add(text);
    try { log?.warn?.(`[come-sail-away] a peer's boats stand down - ${text}`); } catch { /* a console is not the boat's problem */ }
  }
  /** The word's places matched with what stands: a boat of the same hull, nearest to its new place first (the same boat
   *  a place or a pack moved along the list), its variant set as SetBoatVariant sets it; the rest go. Builds nothing. */
  function realign(owner, l) {
    const had = (shown.get(owner) ?? []).filter(Boolean);
    const next = new Array(l.boats.length).fill(null);
    const pairs = [];
    for (let i = 0; i < l.boats.length; i++) {
      for (let j = 0; j < had.length; j++) if (had[j].hull === l.boats[i].hull) pairs.push([dist2(had[j].wire, l.boats[i].position), had[j].slot === i ? 0 : 1, i, j]);
    }
    pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2] || a[3] - b[3]);
    const taken = new Set();
    for (const [, , i, j] of pairs) if (!next[i] && !taken.has(j)) { next[i] = had[j]; taken.add(j); }
    for (let j = 0; j < had.length; j++) if (!taken.has(j)) pool.remove(had[j].boat);
    shown.set(owner, next);
    for (let i = 0; i < next.length; i++) {
      const s = next[i], w = l.boats[i];
      if (!s) continue;
      s.slot = i; s.wire = w.position;
      if (s.variant !== w.variant) { pool.setVariant(s.boat, w.variant); s.variant = w.variant; }
    }
  }
  /** One build, across every owner: the first waiting place of the first owner (from `turn`) with a build to spend.
   *  Before the pool's models are in, nothing is built. */
  function buildOne() {
    if (!pool.ready?.()) return;
    const owners = [...live.keys()];
    for (let k = 0; k < owners.length; k++) {
      const owner = owners[(turn + k) % owners.length];
      const l = live.get(owner), list = shown.get(owner), b = buckets.get(owner);
      const i = list ? list.indexOf(null) : -1;
      if (!l || i < 0 || !b || b.tokens < 1) continue;
      turn = (turn + k + 1) % owners.length;
      b.tokens -= 1;
      const w = l.boats[i];
      try {
        const boat = pool.spawnPeerNow(new Boat(w.hull, w.variant));
        if (boat) list[i] = { boat, hull: w.hull, variant: w.variant, wire: w.position, slot: i, shown: null, turn: null, helm: false, light: false };
      } catch (e) { fail(owner, e); }
      return;
    }
  }
  /** One boat's frame: eased toward its word, its sails, crew and lanterns as the word says, the owner's look, its
   *  Animators stepped. */
  function pose(s, w, toScene, dt, look) {
    const was = s.shown;
    const target = toScene(w.position);
    s.shown = easeToward(s.shown, target, dt);
    // NAV-H: its way over the water, smoothed - what a captain at sea leads his guns by (scenes/navalHost.js contacts).
    // A snap (a crossing, a summons: easeToward's teleport) is no ship's way - the measure starts again after it
    if (was && dist2(was, target) > EASE_SNAP_M * EASE_SNAP_M) s.vel = null;
    else if (was && dt > 0) {
      const v = [(s.shown[0] - was[0]) / dt, 0, (s.shown[2] - was[2]) / dt];
      const k = 1 - Math.exp(-PEER_VEL_RATE * dt);
      s.vel = s.vel ? [s.vel[0] + (v[0] - s.vel[0]) * k, 0, s.vel[2] + (v[2] - s.vel[2]) * k] : v;
    }
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
    // AUDIT PRE-MERGE 0928 O4: the boat under a hidden owner stands nowhere; a concealed one's crew and lanterns wear the look
    const hide = look === 'hidden' && w.helm;
    if (s.boat.GameObject.activeSelf === hide) s.boat.GameObject.setActive(!hide);
    s.boat.conceal = w.helm && look && look !== 'hidden' ? look : null;
    for (const a of boatAnimators(s.boat)) a.update(dt);
  }

  /** One frame: the builds' buckets refilled, each moved word matched to what stands, ONE build, then each boat posed. */
  function frame(dt) {
    const ms = Math.max(0, dt) * 1000;
    for (const [owner, b] of buckets) {
      b.tokens = Math.min(CSA_PEER_BUILD_BURST, b.tokens + ms / CSA_PEER_BUILD_REFILL_MS);
      if (b.tokens >= CSA_PEER_BUILD_BURST && !live.has(owner)) buckets.delete(owner);   // owes nothing: a newcomer's own
    }
    for (const [owner, l] of [...live]) {
      if (!l.dirty) continue;
      l.dirty = false;
      try { realign(owner, l); } catch (e) { fail(owner, e); }
    }
    buildOne();
    for (const [owner, l] of [...live]) {
      const list = shown.get(owner);
      if (!list) continue;
      const look = peerLook?.(owner) ?? null;
      try {
        for (let i = 0; i < list.length; i++) if (list[i]) pose(list[i], l.boats[i], l.toScene, dt, look);
      } catch (e) { fail(owner, e); }
    }
  }

  /** Another's word through validCsaRecord; `null` (or an invalid record) drops theirs. Kept, never built from here. */
  function applyOwner(owner, raw, toScene = (p) => p, nowMs = 0) {
    if (!enabled) return false;
    if (typeof owner !== 'string' || !owner || owner === (selfId?.() ?? null)) return false;
    const r = raw == null ? null : validCsaRecord(raw);
    if (!r) { live.delete(owner); drop(owner); return raw == null; }
    if (!buckets.has(owner)) buckets.set(owner, { tokens: CSA_PEER_BUILD_BURST });
    live.set(owner, { boats: r.boats, toScene, at: nowMs, dirty: true });
    return true;
  }
  /** An owner gone from the room, or quiet past staleMs, takes their boats with them (its bucket stays until full). */
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
    buckets.clear();
    for (const owner of [...shown.keys()]) drop(owner);
  }
  /** The floating origin moved: the eased places move with the world (the words are converted every frame anyway). */
  function rebase(offset) {
    for (const list of shown.values()) for (const s of list) if (s?.shown) s.shown = [s.shown[0] + offset[0], s.shown[1] + offset[1], s.shown[2] + offset[2]];
  }
  function setEnabled(v) { enabled = !!v; if (!enabled) clearPeers(); }

  return {
    applyOwner, sweepOwners, clearPeers, rebase, frame, setEnabled,
    /** NAV-H: the boats other players stand at their helms, where each is and how it moves - the sea's contacts
     *  (scenes/navalHost.js): a pirate hunts them as it hunts mine. A boat that stands nowhere (a hidden owner's) is
     *  nobody's contact. */
    helmBoats() {
      const out = [];
      for (const [owner, list] of shown) {
        for (const s of list) {
          if (!s?.helm || !s.shown || !s.boat.GameObject.activeSelf) continue;
          const vel = s.vel ?? [0, 0, 0];
          out.push({ id: owner, pos: s.shown, vel, speed: Math.hypot(vel[0], vel[2]) });
        }
      }
      return out;
    },
    /** AUDIT PRE-MERGE 0928 O4: the host's word on each other player's look - 'hidden', a concealed visual, or null. */
    setPeerLook(fn) { peerLook = typeof fn === 'function' ? fn : null; },
    get enabled() { return enabled; },
    /** What stands, owner by owner, place by place (null: waiting for its build) - a probe's and the tests' reading. */
    shown: () => [...shown].map(([owner, list]) => ({ owner, boats: list.map((s) => (s ? { hull: s.hull, variant: s.variant, position: s.shown ? [...s.shown] : null, boat: s.boat } : null)) })),
  };
}
