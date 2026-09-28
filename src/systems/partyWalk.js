// @ts-check
// ═══════════════════════════════════════════════════════════════════
// TV8 - GROUP TRAVEL, THE LEADER DRIVES (bible/06-Systems/Travel-View.md, THE OVERHAUL).
//
// Mac (2026-09-28): "Group traveling is possible? Where the leader dictates on the map where to go?" - his call, "Leader
// drives". A party leader's Overworld journey (a place, or a spot) is offered to the members gathered with them; a
// member who says yes walks the same journey beside them, in their own Overworld. A stop for one is a stop for all.
//
// THE WIRE (net/wire.js validPartyPose, world123): the leader's pose carries the WALK `tw` - the destination pixel `x`,
// `y` (and a spot's own point `sx`, `sz` in native units), the round's stamp `at`, the moment the party (re)set out
// `go`, and the moment it HALTED `h` (null while it walks); a member's pose carries `ts`, the moment their own journey
// stopped for a reason of theirs (a foe, a band, a stop) - the leader halts on a member's stop newer than the last go,
// and the halt reaches everyone. Every stamp is the shared clock's (the hub's `now`), so every client orders them alike.
// A member's yes or no rides PARTY-TRAVEL's own `tr`/`td`, naming the round's `at`.
//
// PURE: a member's next step and the leader's, off the poses; the host does the prompting and the journeys.
// ═══════════════════════════════════════════════════════════════════

/** How near the leader a member stands to be asked (m) - the party gathered for the road, a little wider than a rest's. */
export const PARTY_WALK_RADIUS_M = 60;
/** How long a round is asked about (ms) - a member who has not answered by then is left behind. */
export const PARTY_WALK_ASK_MS = 30_000;

/**
 * A walk as the leader's pose carries it. `dest` `{ pixel: {x, y}, point?: {x, z} }` (a spot's own point, native).
 * @param {{ pixel: {x:number,y:number}, point?: {x:number,z:number}|null }} dest
 * @param {number} at the shared-clock stamp
 */
export function walkOf(dest, at) {
  const w = { x: dest.pixel.x, y: dest.pixel.y, at: Math.round(at), go: Math.round(at), h: null };
  if (dest.point) { w.sx = Math.round(dest.point.x); w.sz = Math.round(dest.point.z); }
  return w;
}

/**
 * A MEMBER'S NEXT STEP, off the leader's walk and what this member has done with it:
 *   'ask'    a new round, the member gathered and not journeying, unanswered - put the question
 *   'start'  the member said yes and the party is walking, the member is not - begin (or take up again) the journey
 *   'halt'   the party halted after the member last set out, and the member is walking - stop
 *   null     nothing to do
 * @param {{ tw: any, mine: { at: number|null, yes: boolean, go: number|null }, gathered: boolean, journeying: boolean, now: number }} q
 *   `mine.at` the round I answered, `mine.yes` my answer, `mine.go` the party's set-out I last walked on
 */
export function memberWalkStep({ tw, mine, gathered, journeying, now }) {
  if (!tw) return journeying && mine.yes && mine.at != null ? 'halt' : null;   // the leader's walk is over (arrived, or dropped): so is mine
  if (mine.at !== tw.at) {
    if (now - tw.at > PARTY_WALK_ASK_MS) return null;   // too old to be asked about
    return gathered && !journeying ? 'ask' : null;
  }
  if (!mine.yes) return null;
  if (tw.h != null && tw.h >= (mine.go ?? -Infinity)) return journeying ? 'halt' : null;
  if (tw.h == null && tw.go !== mine.go && !journeying) return 'start';
  return null;
}

/**
 * THE LEADER'S HALT: whether a present member's stop (`ts`) came after the party last set out - then the leader's own
 * journey stops, and its halt reaches everyone.
 * @param {any} tw the leader's walk
 * @param {Array<number|null|undefined>} stops the present members' `ts`
 */
export function leaderMustHalt(tw, stops) {
  if (!tw || tw.h != null) return false;
  for (const s of stops ?? []) if (Number.isFinite(s) && /** @type {number} */ (s) > tw.go) return true;
  return false;
}
