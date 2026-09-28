// @ts-check
// VOICE1 (2026-09-28, Mac: "Lets instead take this idea and develop prox chat"; Mac chose push-to-talk, STUN only,
// nearby only) - THE LAW OF EARSHOT, pure: who a player holds a voice link with, how loud each one is, and who offers.
//
// A voice link is a WebRTC peer connection, browser to browser (net/proxVoice.js); the relay only introduces the two
// (wire.js `rtc`). Links cost a connection each, so they are held with the players who could be HEARD and let go
// past it - with a band between the two so a player pacing on the edge is not linked and unlinked every step.
//
// Distances are the scene's metres (the port's world unit), feet to feet.

/** Heard at full voice within this, and fading to silence at VOICE_HEAR_M - a linear fall (WebAudio's 'linear'
 *  distance model, so the panner and this law say the same number). */
export const VOICE_FULL_M = 2;
export const VOICE_HEAR_M = 30;
/** A link is opened within this, and kept until past VOICE_UNLINK_M. */
export const VOICE_LINK_M = 35;
export const VOICE_UNLINK_M = 45;
/** At most this many links - the nearest. A crowd past it is heard by its nearest few. */
export const VOICE_PEERS_MAX = 8;
/** A link that failed to connect (no TURN: two networks that cannot meet) is not tried again for this long. */
export const VOICE_RETRY_MS = 60000;

/** How loud a voice `d` metres off is, 0..1 - WebAudio's linear model at refDistance VOICE_FULL_M, maxDistance
 *  VOICE_HEAR_M, rolloff 1. */
export function voiceGain(d) {
  if (!(d >= 0)) return 0;
  if (d <= VOICE_FULL_M) return 1;
  if (d >= VOICE_HEAR_M) return 0;
  return 1 - (d - VOICE_FULL_M) / (VOICE_HEAR_M - VOICE_FULL_M);
}

/** Of two players, the one who OFFERS a link: the lower id - so two players who both want one never cross offers. */
export const offersTo = (myId, peerId) => String(myId) < String(peerId);

/**
 * THE LINKS TO HOLD: of `peers` ({id, d} - metres from me), those within VOICE_LINK_M, and those already `linked`
 * still within VOICE_UNLINK_M, nearest first, at most `max`; a peer `failedUntil` names (id -> ms) is not linked again
 * before its time. `open` the ones to make, `close` the linked ones to let go.
 * @param {{ peers: {id: string, d: number}[], linked: Set<string>, now?: number, failedUntil?: Map<string, number>, max?: number }} q
 */
export function voicePlan({ peers, linked, now = 0, failedUntil = new Map(), max = VOICE_PEERS_MAX }) {
  const want = peers
    .filter((p) => typeof p?.id === 'string' && p.d >= 0 && (p.d <= VOICE_LINK_M || (linked.has(p.id) && p.d <= VOICE_UNLINK_M)))
    .filter((p) => linked.has(p.id) || !((failedUntil.get(p.id) ?? 0) > now))
    .sort((a, b) => a.d - b.d)
    .slice(0, Math.max(0, max))
    .map((p) => p.id);
  const keep = new Set(want);
  return { want: keep, open: want.filter((id) => !linked.has(id)), close: [...linked].filter((id) => !keep.has(id)) };
}

/** Whether an offer from `id` is one to answer: voice on, and they stand within the band a link is kept in. A stranger
 *  across the town is not let into my speakers by asking. */
export function acceptsOffer({ on, id, peers }) {
  if (!on) return false;
  const p = peers.find((x) => x.id === id);
  return !!p && p.d >= 0 && p.d <= VOICE_UNLINK_M;
}
