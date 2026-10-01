// @ts-check
// CLIMB5 - THE CLIMB, SEEN AND HEARD BY THE OTHERS (the Enhanced Climbing arc - bible/03-World/Parkour-Arc.md; Mac: "I
// really want you to go all in on this").
//
// Before it a peer on a wall was a body standing in the air: facing wherever their camera looked (over the shoulder,
// down the street), posed on the ground, walking in place along a lip as they shimmied, and silent. The pose carries
// the climb now (net/wire.js validPose: `cl` 1 hanging, 2 on a face, 3 a move in flight; `cw` the way the body faces
// on it - player/motor.js climbPoseOf), and every way the others draw a peer reads it here:
//   - FACING: the body and the sprite turn to the wall (peerBodyYaw) - the Morrowind body eases to it as it eases to
//     any yaw, the billboards and the riders' sprites take it as their facing;
//   - THE POSE: off the ground (the Morrowind body's own in-air pose, the one the local third person takes on the wall),
//     and no walk on the wall (peerMoving) - a shimmy is hands, not strides;
//   - THE SOUNDS: the climb's own clips (player/climbSounds.js), played AT the peer as their steps are
//     (remotePlayers.js PEER_SOUND_PROFILE) - the catch, the hands onto a face, the haul over a lip, a hand at every
//     reach up the wall and every span along a lip, the hands letting go - off the changes of their climb, since the
//     wire carries the state and not the frame's events. The port's own sounds' switch (ES1) over them, as over the
//     local climb's.

import { CLIMB_SOUND, climbClip, installClimbSounds } from '../player/climbSounds.js';
import { FEEL } from '../player/climbFeel.js';
import { enhancedSoundsOn } from '../systems/enhancedSounds.js';

/** The wire's climb states (`cl`). */
export const PEER_CLIMB = Object.freeze({ HANG: 1, FACE: 2, MOVE: 3 });

/** Is this drawn pose on the climb. */
export const peerClimbing = (shown) => (shown?.cl | 0) > 0;
/** The yaw a peer's body faces - the climb's (`cw`) on it, the pose's own otherwise. */
export function peerBodyYaw(shown) {
  return peerClimbing(shown) && Number.isFinite(shown.cw) ? shown.cw : shown?.yaw;
}
/** Is the peer walking - the move bit, never on the wall (a shimmy moves the feet along the lip, and is no stride). */
export const peerMoving = (shown) => !!shown?.mv && !peerClimbing(shown);

/**
 * What a change of a peer's climb sounds - `[sound, volume]` pairs, from the state they were in to the one they are in
 * now (0 off the wall). The local climb's volumes (CLIMB_SOUND), the moves' own sounds read off their ends: onto a
 * lip from the air is a catch, onto a face a hand, a move begun from a hang the haul over the lip, a move ending in a
 * hold the hands taking it, a hold let go the hands leaving the stone. Off a move onto the ground is the stride's.
 * @param {number} was @param {number} now
 * @returns {Array<[string, number]>}
 */
export function peerClimbCues(was, now) {
  const C = CLIMB_SOUND, { HANG, FACE, MOVE } = PEER_CLIMB;
  if (was === now) return [];
  if (!was) return now === HANG ? [['catch', C.CATCH_BASE + 0.1]] : [['grab', C.GRAB * (now === FACE ? 0.75 : 0.7)]];
  if (!now) return was === MOVE ? [] : [['step', C.LET_GO]];
  if (now === MOVE) return [['pull', C.PULL * (was === HANG ? 1 : 0.7)]];
  if (was === MOVE) return [['grab', C.GRAB * (now === HANG ? 1 : 0.8)]];
  return [['grab', C.GRAB * 0.75]];   // a hang to a face, or back
}

export class PeerClimbSounds {
  /**
   * @param {{ audio?: any, profile?: any, on?: () => boolean, rand?: () => number, install?: boolean }} [opts]
   *   `audio` the bus (play3d); `profile` the peers' falloff (remotePlayers.js PEER_SOUND_PROFILE); `on` the port's own
   *   sounds' switch; `rand` the variety's dice (the pins' seam); `install` false keeps the clips unloaded.
   */
  constructor({ audio = null, profile = null, on = enhancedSoundsOn, rand = Math.random, install = true } = {}) {
    this.audio = audio;
    this.profile = profile;
    this.on = on;
    this.rand = rand;
    this.install = install;
    this.peers = new Map();   // id -> { cl, at, climb, shimmy }
    this.last = new Map();    // sound -> the key last played
  }

  /** One drawn frame of a peer: `shown` their pose, `at` their feet in the scene, `heard` whether they are in earshot
   *  (a peer out of it changes state silently, and the rhythm's travel is not saved up for later). */
  update(id, shown, at, heard = true) {
    const cl = shown?.cl | 0;
    const s = this.peers.get(id);
    if (!s) { this.peers.set(id, { cl, at: at ? [at[0], at[1], at[2]] : null, climb: 0, shimmy: 0 }); return; }   // first seen: an old climb is not replayed
    const on = this.on() && !!this.audio?.play3d;
    if (on && this.install) installClimbSounds(this.audio);
    if (on && heard && at) for (const [sound, vol] of peerClimbCues(s.cl, cl)) this._play(sound, vol, 1, at);
    // the rhythm: a hand at every reach up a face (a boot half a reach on), a hand every span along a lip
    if (cl !== s.cl) { s.climb = 0; s.shimmy = 0; }
    if (at && s.at && cl === s.cl && (cl === PEER_CLIMB.FACE || cl === PEER_CLIMB.HANG)) {
      const dx = at[0] - s.at[0], dy = at[1] - s.at[1], dz = at[2] - s.at[2];
      const d = cl === PEER_CLIMB.FACE ? Math.hypot(dx, dy, dz) : Math.hypot(dx, dz);
      if (d > 1e-5 && d < 1) {   // past a metre a frame is a snap (a recentre, a placement), never a climb
        if (cl === PEER_CLIMB.FACE) {
          const was = s.climb;
          s.climb += d / FEEL.REACH;
          if (on && heard && Math.floor(s.climb) > Math.floor(was)) this._play('step', CLIMB_SOUND.STEP, 1, at);
          if (on && heard && Math.floor(s.climb - 0.5) > Math.floor(was - 0.5)) this._play('step', CLIMB_SOUND.FOOT, CLIMB_SOUND.FOOT_PITCH, at);
        } else {
          const was = s.shimmy;
          s.shimmy += d / FEEL.SHIMMY_SPAN;
          if (on && heard && Math.floor(s.shimmy) > Math.floor(was)) this._play('step', CLIMB_SOUND.SHIMMY, CLIMB_SOUND.SHIMMY_PITCH, at);
        }
      }
    }
    s.cl = cl;
    s.at = at ? [at[0], at[1], at[2]] : null;
  }

  /** A peer gone (left the room, out of the drawn set): the next sight of them is a first. */
  forget(id) { this.peers.delete(id); }
  /** The floating origin moved: every peer's last place is in the old frame - the next frame's travel is no climb. */
  rebase() { for (const s of this.peers.values()) s.at = null; }

  _play(sound, vol, pitch, at) {
    const c = climbClip(sound, this.last.get(sound), this.rand, pitch);
    if (!c) return;
    this.last.set(sound, c.key);
    this.audio.play3d(c.key, at, Math.min(1, vol), { ...(this.profile ?? {}), pitch: c.pitch });
  }
}
