// @ts-check
// SET7 (2026-09-26, Sigil Sets - bible/11-Multiplayer/Sigil-Sets.md section 7; Mac: "Sigil stones become a currency to
// trade for daily reset sigil items at a new NPC vendor that stands outside the oblivion gate"): THE SIGIL BROKER, WHERE
// SHE STANDS - the pool on the runtime pools' shape (scenes/camps.js, scenes/gatePool.js): her body, the eye's box and
// her name, and the press on her.
//
// SHE STANDS WITH THE GATE, AND ONLY WHILE IT STANDS WHOLE: off the gate's place (gatePool.js `state().place`, stood
// each frame from the clock) at a spot in the gate's OWN frame - beside the fire's approach, off the plinth - so every
// player in the Bay finds her where every other does, and a floating-origin recentre carries her with the gate. Not
// while it climbs or sinks, not at a beacon alone (a pixel not built - GATE-SEEN): no stone, no Broker. The gate
// falling takes her with it, and a window open on her is shut (the host's `gone`).
//
// HER BODY is the Daedra Seducer's mortal guise (EnemyBasics 29, TEXTURE.284 - the game has no Dremora sprite), its idle
// records by the eight orientations (characters/mobileUnit.js IDLE_ANIMS, read through world/gateBoss.js bossFrame, the
// court's own reader), a billboard on the flats' axis. She faces out of the gate, and turns to a player come within
// BROKER_NOTICE_M of her - at a walk's pace, never a snap.
//
// NOTHING HERE IS SAVED OR SENT: where she stands is the gate's, and the gate is the clock's. What she sells, and what a
// character bought of it, are the law's (systems/sigilBroker.js); the window is ui/brokerWindow.js behind
// ui/brokerDoor.js; the sale is the host's (scenes/world.js), through the law.
//
// Not a DFU member. Ledger A (SET).
import { bossFrame } from '../world/gateBoss.js';
import { IDLE_ANIMS, IDLE_ANIM_SPEED } from '../characters/mobileUnit.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { mobileBillboardSize } from '../world/rmbFlats.js';
import { RAY_DISTANCE, STATIC_NPC_ACTIVATION_DISTANCE, presentNpcInfoText } from '../player/activate.js';
import { trs } from '../world/mat4.js';

/** The mobile whose sprite she wears: the Daedra Seducer, in her mortal guise. */
export const BROKER_MOBILE = 29;
/** Where she stands, in the gate's own frame (metres - x across the arch, z through the fire): off the plinth
 *  (PLINTH_R 8.2) and clear of the horns' roots, beside the approach to the fire's +z face, where a player walking up to
 *  the gate passes her (tools/brokerProbe.mjs photographs it). */
export const BROKER_SPOT = Object.freeze({ lx: 6.4, lz: 10.6 });
/** The eye's box about her feet: half its width, and its height before her sprite has loaded (her idle's own, 2.15). */
export const BROKER_HALF_W = 0.45;
export const BROKER_H = 2.15;
/** The press reaches her as it reaches a static NPC (PlayerActivate's StaticNPCActivationDistance, 6.4). */
export const BROKER_REACH = STATIC_NPC_ACTIVATION_DISTANCE;
/** A player this near turns her head (metres), and how fast she turns (radians a second - a walk's turn). */
export const BROKER_NOTICE_M = 12;
export const BROKER_TURN_RATE = 2.4;
/** Her words: her plaque's name and line, the Info press, the Steal press, and the gate taking her away mid-sale. */
export const BROKER_TEXT = Object.freeze({
  name: 'Sigil Broker',
  trade: 'Trades in Sigil Stones',
  info: presentNpcInfoText('the Sigil Broker'),
  steal: 'The Broker\'s eyes never leave her stones.',
  gone: 'The Sigil Broker is gone with the gate.',
});
/** The one empty answer for no Broker - the host asks for the targets and the batches every frame. */
const NONE = Object.freeze([]);
/** Her body in the collider: a post a player walks into rather than through, inside her eye's box (so the ray meets
 *  the box first and she never hides herself), under its own bucket. */
export const BROKER_BUCKET = 'set7:broker';
export const BROKER_BODY_R = 0.3;
export const BROKER_BODY_H = 1.9;
/** The post's eight corners and twelve triangles, about her feet. */
export const BROKER_POST = Object.freeze((() => {
  const r = BROKER_BODY_R, h = BROKER_BODY_H;
  const positions = new Float32Array([-r, 0, -r, r, 0, -r, r, 0, r, -r, 0, r, -r, h, -r, r, h, -r, r, h, r, -r, h, r]);
  const indices = new Uint16Array([0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
  return { positions, indices };
})());

/**
 * Where she stands for a gate placed at `place` (gatePool.js gatePlacement's answer): the spot carried out of the gate's
 * frame (gatePool.js gateLocal, undone - trs's R_y), on the ground there (the host's `heightAt`; the gate's own foot
 * where that answers nothing), facing out of the gate - or null when no gate stands whole. Pure.
 * @param {{ day: number, phase: string, origin: number[], ground: number, yaw: number, risen: boolean, coarse: boolean }|null} place
 * @param {(x: number, z: number) => number} heightAt
 */
export function brokerPlace(place, heightAt) {
  if (!place || place.coarse || !place.risen || place.phase === 'collapsing') return null;
  const c = Math.cos(place.yaw), s = Math.sin(place.yaw), o = place.origin;
  const x = o[0] + c * BROKER_SPOT.lx + s * BROKER_SPOT.lz, z = o[2] - s * BROKER_SPOT.lx + c * BROKER_SPOT.lz;
  const h = heightAt(x, z);
  return { day: place.day, feet: [x, Number.isFinite(h) ? h : place.ground, z], rest: place.yaw };
}

/** The yaw she turns toward this frame: to feet within BROKER_NOTICE_M, else her rest (out of the gate). Pure. */
export function brokerFacing(at, rest, feet) {
  if (!feet) return rest;
  const dx = feet[0] - at[0], dz = feet[2] - at[2];
  const d = Math.hypot(dx, dz);
  return d > 1e-6 && d <= BROKER_NOTICE_M ? Math.atan2(dx, dz) : rest;
}

/** One step of a turn from `yaw` toward `want`, the short way round, at most `rate * dt`. Pure. */
export function turnToward(yaw, want, dt, rate = BROKER_TURN_RATE) {
  let d = (want - yaw) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  const step = rate * Math.max(0, dt);
  return Math.abs(d) <= step ? want : yaw + Math.sign(d) * step;
}

/**
 * @param {{
 *   renderer?: any, getTexture?: ((archive: number) => Promise<any>)|null,
 *   uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null,
 *   place: () => any, heightAt: (x: number, z: number) => number, now?: () => number,
 *   feet?: () => (number[]|null), cam?: () => (number[]|null),
 *   say?: (text: string) => void, open?: () => void, gone?: () => boolean, collider?: () => any,
 * }} deps  `gone` is the host's: shut a window open on her, and say whether one was
 */
export function createSigilBroker({
  renderer = null, getTexture = null, uploadRecordFrame = null, place, heightAt, now = () => Date.now(),
  feet = () => null, cam = () => null, say = () => {}, open = () => {}, gone = () => false, collider = () => null,
}) {
  /** Where she stands this frame, or null. */
  let at = null;
  /** Where her post stands in the collider (its feet, as a key), or null. */
  let postAt = null;
  let yaw = null;
  /** Her sprite: loading, loaded, or failed (a failed load leaves her unseen - her box and her window stay). */
  let body = null, loading = null;
  let batch = null;
  /** AUDIT WBX W6's lesson: the box made when she moves, not every frame the eye asks. */
  let box = null, boxAt = '';
  const _batches = [];

  /** A texture her frames can be read off: every idle record there, with a frame. A file that would not parse is
   *  cached all the same (the pipeline keeps what `load` left - a header and no records), and reading a frame count
   *  off it throws: she is unseen, never a throw in the frame. */
  const readable = (tex) => {
    try { return !!tex && IDLE_ANIMS.every((a) => tex.getFrameCount(a.record) > 0); } catch { return false; }
  };
  function loadBody() {
    if (body || loading || !getTexture || !uploadRecordFrame || !renderer?.createBillboardBatch) return;
    const archive = ENEMY_BASICS[BROKER_MOBILE]?.maleTexture;
    if (!archive) return;
    loading = Promise.resolve().then(() => getTexture(archive)).then((tex) => {
      body = readable(tex) ? { tex, archive } : { failed: true };
      if (body.failed) console.warn(`[broker] her sprite (archive ${archive}) would not load`);
    }, (e) => { body = { failed: true }; console.warn('[broker] her sprite', e?.message ?? e); });
  }
  /** Her frame: the idle record her yaw and the eye choose, uploaded when first seen, her billboard sized to it. */
  function drawBody() {
    if (!at || !body?.tex) return false;
    const eye = cam() ?? at.feet;
    // the court's reader of an act (world/gateBoss.js bossFrame) - typed for his acts, read here for the one field set an
    // idle act carries (its anims, its frame, its loop); `atk` and `t` are his alone and bossFrame never reads them
    const act = /** @type {any} */ ({ act: 'idle', anims: IDLE_ANIMS, frame: Math.floor((now() / 1000) * IDLE_ANIM_SPEED), loop: true });
    const fr = bossFrame(act, yaw ?? at.rest, at.feet, eye, (rec) => body.tex.getFrameCount?.(rec) ?? 1);
    const rkey = `${fr.record}#${fr.frame}`;
    if (!renderer.textures?.has?.(`${body.archive}_${rkey}`)) uploadRecordFrame(body.archive, fr.record, fr.frame);
    const sz = mobileBillboardSize(body.tex, fr.record);   // a shared, cached object: read, never written
    if (!batch) {
      batch = renderer.createBillboardBatch(body.archive, rkey, { w: sz.w, h: sz.h }, [[0, 0, 0]]);
      batch.origin = [0, 0, 0];
    }
    batch.record = rkey;
    batch.size = { w: fr.flip ? -sz.w : sz.w, h: sz.h };
    if (batch.bounds) batch.bounds[3] = Math.hypot(sz.w, sz.h) * 0.5;
    batch.origin[0] = at.feet[0]; batch.origin[1] = at.feet[1]; batch.origin[2] = at.feet[2];   // a walker stands on her feet
    return true;
  }
  /** Her post where she stands, restood when she moves (a floating-origin recentre moves the gate) and taken down when
   *  she goes - the gate's own law (gatePool.js standCollider). */
  function standPost() {
    const col = collider();
    if (!col?.addMesh) return;
    const want = at ? `${at.feet[0]},${at.feet[1]},${at.feet[2]}` : null;
    if (want === postAt) return;
    col.removeBucket?.(BROKER_BUCKET);
    postAt = null;
    if (!at) return;
    col.addMesh(BROKER_BUCKET, BROKER_POST.positions, BROKER_POST.indices, trs(at.feet[0], at.feet[1], at.feet[2], 0, 0, 0));
    postAt = want;
  }
  const keyOf = () => (at ? `broker:${at.day}` : null);
  const ours = (key) => typeof key === 'string' && key.startsWith('broker:') && key === keyOf();

  return {
    /** One frame: where she stands, her turn, her frame - and, the gate gone from under an open window, the window shut. */
    frame(dt = 0) {
      const was = at;
      at = brokerPlace(place?.() ?? null, heightAt);
      standPost();
      if (!at) {
        yaw = null;
        if (was && gone()) say(BROKER_TEXT.gone);
        return null;
      }
      loadBody();
      yaw = turnToward(yaw ?? at.rest, brokerFacing(at.feet, at.rest, feet()), dt);
      drawBody();
      return at;
    },
    /** Her billboard, for the host's flats. */
    batches() {
      _batches.length = 0;
      if (at && batch && body?.tex) _batches.push(batch);
      return _batches;
    },
    /** The eye's box: her body, feet to crown. */
    targets() {
      if (!at) return NONE;
      const h = body?.tex ? mobileBillboardSize(body.tex, IDLE_ANIMS[0].record).h : BROKER_H;
      const f = at.feet, k = `${f[0]},${f[1]},${f[2]},${at.day},${h}`;
      if (!box || k !== boxAt) {
        boxAt = k;
        box = [{ key: `broker:${at.day}`, aabb: { min: [f[0] - BROKER_HALF_W, f[1], f[2] - BROKER_HALF_W], max: [f[0] + BROKER_HALF_W, f[1] + h, f[2] + BROKER_HALF_W] }, distance: RAY_DISTANCE, reach: BROKER_REACH, noSurface: true }];
      }
      return box;
    },
    /** WORLD-HOVER: her name, and what she deals in. */
    hoverName(key) { return ours(key) ? { title: BROKER_TEXT.name, subs: [BROKER_TEXT.trade] } : null; },
    /** A press on her: Info names her, Steal is watched, anything else opens her window. */
    activate(key, mode = 'grab') {
      if (!ours(key)) return false;
      if (mode === 'info') say(BROKER_TEXT.info);
      else if (mode === 'steal') say(BROKER_TEXT.steal);
      else open();
      return true;
    },
    /** Whether she stands now - the sale asks, so a window left open on a gate that fell sells nothing. */
    stands: () => !!at,
    /** For the tests and the probes. */
    state: () => ({ at, yaw, body: body ? (body.tex ? 'loaded' : 'failed') : (loading ? 'loading' : null), batch: !!batch, post: postAt !== null }),
    /** A transition takes her post down with the gate's stone: she is stood again by the next frame that finds the gate. */
    destroyAll() {
      collider()?.removeBucket?.(BROKER_BUCKET);
      postAt = null; at = null; yaw = null;
    },
  };
}
