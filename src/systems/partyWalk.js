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
// stopped for a reason of theirs (a foe, a band, a window) - the leader halts on a member's stop newer than the last
// go, and the halt reaches everyone. Every stamp is the shared clock's (the hub's `now`), so every client orders them
// alike. AUDIT OW3 P10: a member's yes or no is LOCAL - it rides nothing (PARTY-TRAVEL's `tr`/`td` are its own round's,
// never this one's); the leader hears of a member's walk only through that member's `ts`.
//
// PURE: the leader's step and a member's, off the poses and what this client's journey did; the host (scenes/world.js
// partyWalkFrame) does the prompting and the journeys. AUDIT OW3 P11: every decision the host used to make inline lives
// here now, so the halt/resume cycle, a stale yes, an arrival told from a stop, the pose's grace and the resume to the
// same place are proved by running them, not by the shape of the host's lines.
// ═══════════════════════════════════════════════════════════════════

/** How near the leader a member stands to be asked (m) - the party gathered for the road, a little wider than a rest's. */
export const PARTY_WALK_RADIUS_M = 60;
/** How long a round is asked about (ms). AUDIT OW3 P10: a member who has not answered by then IS left behind - the
 *  question comes down (walkAskStands) and the round is never put again (memberWalkStep). */
export const PARTY_WALK_ASK_MS = 30_000;
/** AUDIT OW3 P7: how long the leader's last walk is believed without a pose to say it (ms). A member's picture holds the
 *  leader's pose null for a moment after any hub reconnect (net/social.js: `p` is null until the first frame), and "no
 *  pose" read as "no walk" dropped a halfway member out of the walk - and past PARTY_WALK_ASK_MS they could never be
 *  asked back. A pose that SAYS no walk is believed at once. */
export const PARTY_WALK_GRACE_MS = 10_000;
/** A member's answer to no round. */
export const NO_WALK_ANSWER = Object.freeze({ at: null, yes: false, go: null });

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
 * Whether a live journey's destination `d` `{ x, y, spot }` (a map pixel, and whether it is a spot) is the walk's.
 * `anyKind` for a MEMBER's journey: a member who has not found the leader's place walks to its pixel as a spot, and that
 * is still the walk's journey; the leader's own is held to its kind, a place walk never resumed as a spot's.
 * @param {any} tw
 * @param {{ x: number, y: number, spot?: boolean }|null|undefined} d
 */
export function sameWalkDest(tw, d, anyKind = false) {
  return !!tw && !!d && tw.x === d.x && tw.y === d.y && (anyKind || (tw.sx != null) === !!d.spot);
}

/**
 * THE LEADER'S BEGIN, as a journey of the Overworld's starts (`dest` as walkOf takes it; `gathered` the members standing
 * within PARTY_WALK_RADIUS_M). AUDIT OW3 P9: the journey TAKEN UP AGAIN to the halted walk's own destination (the
 * Overworld's flag, the place clicked again) SETS IT OUT again - the same round, `go` now, the halt lifted - so every
 * member who said yes takes theirs up from wherever they stopped, near or far; before, it was a new round, asked only of
 * those within 60 m, and a member who had stopped further off was dropped from the walk they were on. A spot's point
 * rides the set-out (its pixel is the walk's; the click is the new point). The same destination while it WALKS is the
 * same walk. Anything else is a new round, and only with someone gathered to ask; AUDIT OW3 P2: never the old walk.
 * @param {any} prev the walk I led until now, or null
 * @param {{ pixel: {x:number,y:number}, point?: {x:number,z:number}|null }} dest
 * @param {number} now the shared clock
 * @param {number} gathered
 */
export function walkBegin(prev, dest, now, gathered) {
  if (prev && sameWalkDest(prev, { x: dest.pixel.x, y: dest.pixel.y, spot: !!dest.point })) {
    if (prev.h == null) return prev;
    const w = { ...prev, go: Math.round(now), h: null };
    if (dest.point) { w.sx = Math.round(dest.point.x); w.sz = Math.round(dest.point.z); }
    return w;
  }
  return gathered > 0 ? walkOf(dest, now) : null;
}

/**
 * THE LEADER'S STEP, four times a second: `{ tw, halt }` - the walk as it now stands (null: over) and whether my own
 * journey must be stopped. `journeying` my journey is MOVING (the panel up and an autopilot under it); `dest` its live
 * destination `{ x, y, spot }` or null; `ended` Travel Options CLEARED the destination since the last step (an arrival,
 * Exit, the map's Forget it, a load - `travelOptions.cleared`); `stops` the present members' `ts`.
 *   - Walking, and my journey stopped: an END (`ended`) is the walk's end - the members are released (AUDIT OW3 P8) and
 *     carry on; anything else is a STOP and the walk halts. AUDIT OW3 P5: told apart by the journey's own end, never by
 *     the destination fields - a spot's stop nulls its route (TV2 AUDIT TV A4), and read that way every stop of a spot
 *     walk was an arrival that let the party walk on.
 *   - Walking to another place (the map's journey, the follow key): the walk is over.
 *   - A member's stop after the last set-out: the walk halts AT ONCE and `halt` says to stop my journey. AUDIT OW3 P1:
 *     the host stops it through the panel (the mod's Camp) - interruptTravel alone left the panel up, the leader counted
 *     as journeying, `h` never set, re-interrupted every step while the others walked on.
 *   - Halted: taken up again to the walk's own place SETS OUT again; AUDIT OW3 P2: a halted walk forgotten (`ended`), left
 *     with no destination to resume (a place's; a spot's stop leaves none by design and waits for the next click), or
 *     replaced by a journey elsewhere is DROPPED - before, it stayed, and the leader's next journey of ANY kind "set it
 *     out again" and every yes-member started for the OLD place.
 * @param {{ tw: any, journeying: boolean, dest: {x:number,y:number,spot?:boolean}|null, ended: boolean, stops: Array<number|null|undefined>, now: number }} q
 * @returns {{ tw: any, halt: boolean }}
 */
export function leaderWalkStep({ tw, journeying, dest, ended, stops, now }) {
  if (!tw || ended) return { tw: null, halt: false };
  const mine = sameWalkDest(tw, dest);
  if (tw.h == null) {
    if (!journeying) return { tw: { ...tw, h: Math.round(now) }, halt: false };
    if (!mine) return { tw: null, halt: false };
    if (leaderMustHalt(tw, stops)) return { tw: { ...tw, h: Math.round(now) }, halt: true };
    return { tw, halt: false };
  }
  if (journeying) return { tw: mine ? { ...tw, go: Math.round(now), h: null } : null, halt: false };
  if (dest ? !mine : tw.sx == null) return { tw: null, halt: false };
  return { tw, halt: false };
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

/**
 * THE LEADER'S WALK AS A MEMBER HEARS IT (AUDIT OW3 P7): `held` `{ acct, tw, at }` the last word; `seen` the leader's
 * row now - `acct`, `present` (memberPresent: a pose, and not marked offline) and the pose's `tw`. A present pose is
 * believed at once, walk or none; a missing one keeps the last walk PARTY_WALK_GRACE_MS from when it was last heard,
 * then lets it go. A new leader starts from nothing.
 * @param {{ acct: any, tw: any, at: number }|null} held
 * @param {{ acct: any, present: boolean, tw: any }} seen
 * @param {number} now any steady clock (the host's frame clock)
 * @returns {{ acct: any, tw: any, at: number }}
 */
export function walkHeard(held, { acct, present, tw }, now) {
  const h = held && held.acct === acct ? held : { acct, tw: null, at: -Infinity };
  if (present) return { acct, tw: tw ?? null, at: now };
  return h.tw && now - h.at <= PARTY_WALK_GRACE_MS ? h : { acct, tw: null, at: h.at };
}

/**
 * A MEMBER'S ANSWER, kept only while it answers the walk that stands (AUDIT OW3 P3): no walk, or a walk of another round,
 * and the answer is gone. Before, a yes outlived its walk - a member who arrived first kept it, their next journey of
 * their own was stopped at once, and their own stops kept halting walks they never joined.
 * @param {{ at: number|null, yes: boolean, go: number|null }} mine
 * @param {any} tw
 */
export function memberAnswer(mine, tw) {
  return tw && mine && mine.at === tw.at ? mine : NO_WALK_ANSWER;
}

/** Whether I FOLLOW the walk that stands: a yes to its round, and walked on at least once (AUDIT OW3 P3). */
export function memberFollowing(mine, tw) {
  return !!tw && !!mine && mine.at === tw.at && mine.yes && mine.go != null;
}

/**
 * WHAT MY OWN JOURNEY JUST DID, as the party hears of it: 'stop' - it was walking the walk and stopped for a reason of
 * mine (a foe, a band, a window): publish `ts`, and the leader halts; 'done' - Travel Options CLEARED its destination (I
 * arrived first, or forgot it): my part of the walk is over, never a stop, and my yes goes (a later set-out does not
 * start me again); null - nothing. `was` last step I was walking the walk's own journey as a yes (the host reads it
 * AFTER the party's halt, so the party's own halt is never echoed back as mine). AUDIT OW3 P5: the arrival is told by
 * the journey's end (`ended`), not by the destination fields a spot's stop nulls - on a spot walk a member's own stop
 * read as an arrival, and never halted the leader.
 * @param {{ was: boolean, journeying: boolean, ended: boolean, following: boolean }} q
 * @returns {'stop'|'done'|null}
 */
export function memberStopOf({ was, journeying, ended, following }) {
  if (!was && !following) return null;
  if (ended) return 'done';
  return was && following && !journeying ? 'stop' : null;   // released in the same breath (the walk gone, a new round): my stop is mine
}

/**
 * A MEMBER'S NEXT STEP, off the leader's walk and what this member has done with it:
 *   'ask'    a new round within its asking, the member gathered, still and FREE - put the question
 *   'start'  the member said yes and the party is walking, the member is not, and is FREE - begin (or take up again)
 *   'halt'   the party halted after the member last set out, and the member is walking - stop
 *   'leave'  the member said yes, and is walking somewhere else - they have left the walk
 *   null     nothing to do
 * `journeying` my journey is moving; `onWalk` its destination is the walk's (sameWalkDest, any kind); `free` I can be
 * asked or set out now: outdoors, alive, no window up, no foe near, no duel.
 * AUDIT OW3 P6: 'start' waits for `free` - it ran whatever the member was doing (in a dungeon, where the panel is
 * force-closed; dead, a journey under the death screen; mid-fight; a window open) - and a wait does not mark the set-out
 * as walked, so it starts the step the member is able. AUDIT OW3 P4: 'ask' waits for it too.
 * AUDIT OW3 P8 (the lead's call): no walk is NOT a halt. The leader's walk ends - an arrival, a forget, the party gone -
 * and every member is RELEASED: their journey is their own, and it carries on to the same place. Halts come from `tw.h`.
 * @param {{ tw: any, mine: { at: number|null, yes: boolean, go: number|null }, gathered: boolean, journeying: boolean, onWalk?: boolean, free?: boolean, now: number }} q
 *   `mine.at` the round I answered, `mine.yes` my answer, `mine.go` the party's set-out I last walked on
 * @returns {'ask'|'start'|'halt'|'leave'|null}
 */
export function memberWalkStep({ tw, mine, gathered, journeying, onWalk = journeying, free = true, now }) {
  if (!tw) return null;
  if (mine.at !== tw.at) {
    if (now - tw.at > PARTY_WALK_ASK_MS) return null;   // too old to be asked about: left behind
    return gathered && !journeying && free ? 'ask' : null;
  }
  if (!mine.yes) return null;
  if (journeying && !onWalk) return 'leave';
  if (tw.h != null && tw.h >= (mine.go ?? -Infinity)) return journeying ? 'halt' : null;
  if (tw.h == null && tw.go !== mine.go && !journeying) return free ? 'start' : null;
  return null;
}

/**
 * AUDIT OW3 P4/P10: whether the question put for `round` may stay on the screen - the walk that stands is that round,
 * still within its asking, and no danger has come (a foe near, a duel). The round ending, the party gone (no walk), a
 * new round, the asking passed: it comes down, and a member who never answered is left behind.
 * @param {{ tw: any, round: number|null, now: number, danger: boolean }} q
 */
export function walkAskStands({ tw, round, now, danger }) {
  return !!tw && tw.at === round && now - tw.at <= PARTY_WALK_ASK_MS && !danger;
}
