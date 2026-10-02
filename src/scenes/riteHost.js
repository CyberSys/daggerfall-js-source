// @ts-check
// WB12d (2026-10-01, Mac: "faithful and a Summoner"; then "Btw I want to do all 4. We're going balls deep with this"):
// THE FAITHFUL'S RITE, IN THE WORLD. Each breach's circle (net/gateRite.js riteLocalOf) stands from the omen until the
// breach collapses: Dagon's sigil burned into the earth, its braziers alight, the altar and the faithful's casket
// (world/riteModel.js), their tents and fire, and a pillar of smoke over it until the breach opens (render/riteSmoke.js).
//
// ITS FAITHFUL - the Summoner and six to eight of Dagon's Faithful (riteFaithfulOf) - chant at it until disturbed, and
// one woken wakes them all (a camp's law, scenes/exteriorFoes.js). They are SHARED by the World of Daggerfall camps' law
// (world/wodShared.js): the first player to come within reach springs them and owns them, every other sees the owner's
// - one site, `px,py:rite`. Every screen knows the Summoner by his kind (a Sorcerer, RITE_SUMMONER_CAREER).
//
// A PLAYER AT THE CIRCLE says the rite's word to its cell every RITE_WORD_MS while the rite holds, and at once when it
// changes: whether they have struck one of the faithful, whether they have seen the Summoner fall (net/wire.js
// validRiteIn - the relay's cell judges where and when). When the breach opens, the faithful still standing finish their
// rite and pass into it. The hub's word that the rite is broken (net/wire.js validRiteOut) is said once, and opens the
// faithful's casket for each character once a day (systems/riteChest.js) - its contents a pile the casket holds.
//
// Online alone: offline there is no breach. Design: bible/11-Multiplayer/World-Bosses.md section 19 D.
//
// Not a DFU member. Ledger A (WB).
import { riteLocalOf, riteFaithfulOf, riteHolds, riteStands, riteWindow, RITE_REACH_M, RITE_SUMMONER_CAREER, RITE_SUMMONER_HEALTH, RITE_WORD_MS } from '../net/gateRite.js';
import { gateSpotLocal } from '../net/gateLaw.js';
import { worldRoom } from '../net/wire.js';
import { wodSiteId } from '../world/wodShared.js';
import { buildRiteModel, riteLayout, RITE_BRAZIER_H } from '../world/riteModel.js';
import { gateArt, GATE_ARCHIVE } from '../world/gateArt.js';
import { RiteSmokeRenderer } from '../render/riteSmoke.js';
import { FlatAnim } from '../render/flatAnimation.js';
import { GLOBAL_SCALE } from '../player/activate.js';
import { FIRE_FLAT, TENT_MODEL, FIRE_LIGHT_RANGE } from '../systems/survival/camp.js';
import { riteChestItems, riteChestOpened, markRiteChest } from '../systems/riteChest.js';
import { trs } from '../world/mat4.js';

/** The rite's words - each one thing, said once. */
export const RITE_TEXT = Object.freeze({
  near: 'Chanting rises from the smoke.',
  broken: (place) => `The faithful's rite ${place ? `near ${place}` : 'in the wilds'} is broken.`,
  pass: 'The faithful finish their rite and pass into the breach.',
  sealed: 'Sealed by the faithful\'s rite.',
  chest: 'The Faithful\'s Chest',
  summoner: 'the Summoner',
  faithful: 'Dagon\'s Faithful',
});

/** The faithful are sprung by a player this near the circle (World of Daggerfall's marker reach). */
export const RITE_SPRING_M = 100;
/** The near line is said, and the circle's end said, to a player this near. */
export const RITE_SAY_M = 40;
/** The faithful see this far while they chant - they are lost in the rite until disturbed. */
export const RITE_SIGHT_M = 12;
/** One woken wakes every one of the faithful this near it (the camp's own law). */
export const RITE_ALERT_M = 30;
/** The casket's pile is seeded for a player this near it, and the circle's lights reach this far. */
export const RITE_CHEST_SEED_M = 40;
export const RITE_LIGHT_REACH_M = 70;
/** The most of the circle's lights a frame lends the world's list. */
export const RITE_LIGHTS_MAX = 3;
/** The smoke rises over this many ms from the omen, and thins over this many after the opening. */
export const RITE_SMOKE_IN_MS = 8000;
export const RITE_SMOKE_OUT_MS = 30000;

const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
/** No circle, no garbage (AUDIT WB C7, the gate's law): the one empty list. */
const NONE = Object.freeze([]);

/**
 * @param {{
 *   renderer?: any, gl?: WebGL2RenderingContext|null, meshes?: any, getTexture?: ((archive: number) => Promise<any>)|null,
 *   uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null,
 *   now: () => number, omen?: () => any, pixelTranslation: (px: number, py: number) => number[],
 *   groundAt?: (x: number, z: number) => number, coarseGround?: ((px: number, py: number, x: number, z: number) => number)|null,
 *   feet?: () => number[]|null, online?: () => boolean,
 *   foes?: { spawn: (career: number, xz: number[], o: { yaw: number, site: string }) => Promise<any>, list: () => any[], removeSite: (site: string) => void, campId: () => number }|null,
 *   peerSprang?: (site: string) => boolean, sprang?: (site: string) => void, struckAt?: (foe: any) => (number|null),
 *   send?: (word: any, cell: string) => boolean, say?: (text: string) => void, sayNear?: (text: string) => void,
 *   loot?: { seed: (items: any[], feet: number[], pixelKey: string) => any, keyOf?: (pile: any) => string }|null, level?: () => number, rolls?: () => number,
 * }} deps
 */
export function createRiteHost({
  renderer = null, gl = null, meshes = null, getTexture = null, uploadRecordFrame = null,
  now, omen = () => null, pixelTranslation, groundAt = () => NaN, coarseGround = null, feet = () => null, online = () => false,
  foes = null, peerSprang = () => false, sprang = () => {}, struckAt = () => null,
  send = () => false, say = () => {}, sayNear = () => {}, loot = null, level = () => 1, rolls = Math.random,
}) {
  /** the day's circle, or null: its day and pixel, site, heart in the scene, bearing to the gate, layout */
  let C = null;
  let mesh = null, meshKey = '', artUp = false;
  let tent = null, tentTried = false;
  let fire = null, fireTried = false, flames = null, flamesAt = null, anim = null;
  let smokePass = null, smokeTried = false;
  /** made once a heart: the stone's and the tents' matrices, the casket's target, the lights' points */
  let madeAt = null, mats = null, target = null, lightPts = null;
  const smoke = { origin: null, fade: 0 }, smokeList = [smoke];
  /** the hub's word: the days whose rite is broken, and the ones said */
  const broken = new Set(), saidBroken = new Set();

  function enter(s) {
    leave();
    const [e, n] = riteLocalOf(s.day), [gx, gz] = gateSpotLocal(s.day);
    C = {
      day: s.day, px: s.px, py: s.py, place: s.place ?? null, site: wodSiteId(s.px, s.py, 'rite'),
      local: [e, n], facing: Math.atan2(gx - e, gz - n), layout: null, heart: [0, 0, 0], known: false,
      spawned: false, struck: false, fell: false, nearSaid: false, passed: false,
      wordAt: -Infinity, said: '', pile: null, pileCount: 0,
    };
    C.layout = riteLayout(C.facing);
  }
  function leave() {
    if (C && foes) foes.removeSite(C.site);
    if (flames) { renderer?.destroyBillboardBatch?.(flames); flames = null; flamesAt = null; }
    C = null; mesh = null; meshKey = ''; madeAt = null;
  }
  /** The circle's heart in the scene this frame (a recentre moves it), on its ground - the coarse ground where its pixel is
   *  not built, and `known` only on the built one. */
  function placeHeart() {
    const t = pixelTranslation(C.px, C.py);
    const x = t[0] + C.local[0], z = t[2] + C.local[1];
    let y = groundAt(x, z);
    C.known = Number.isFinite(y);
    if (!C.known) y = coarseGround ? coarseGround(C.px, C.py, x, z) : NaN;   // the scene's point (world.js gateGroundAt)
    C.heart[0] = x; C.heart[1] = Number.isFinite(y) ? y : t[1]; C.heart[2] = z;
  }
  /** What stands at the heart, made again only when it moves (a recentre, the ground built). */
  function made() {
    const h = C.heart;
    if (madeAt && madeAt[0] === h[0] && madeAt[1] === h[1] && madeAt[2] === h[2] && madeAt[3] === C.day) return;
    madeAt = [h[0], h[1], h[2], C.day];
    mats = { stone: trs(h[0], h[1], h[2], 0, 0, 0), tents: C.layout.tents.map((tt) => { const p = sceneAt(tt.x, tt.z); return trs(p[0], p[1], p[2], 0, (tt.yaw * 180) / Math.PI, 0); }) };
    const c = C.layout.casket, p = sceneAt(c.x, c.z);
    target = [{ key: `rite:${C.day}`, aabb: { min: [p[0] - 0.6, p[1], p[2] - 0.6], max: [p[0] + 0.6, p[1] + 0.8, p[2] + 0.6] }, distance: 3.2, reach: 3.2 }];
    lightPts = C.layout.braziers.map(([x, z]) => { const q = sceneAt(x, z); return { x: q[0], y: q[1] + RITE_BRAZIER_H + 0.4, z: q[2], range: FIRE_LIGHT_RANGE }; });
    const fp = sceneAt(C.layout.fire[0], C.layout.fire[1]);
    lightPts.push({ x: fp[0], y: fp[1] + 0.6, z: fp[2], range: FIRE_LIGHT_RANGE });
  }
  /** The ground over the heart's at a point of the circle's frame (0 where nothing answers). */
  const heightAt = (lx, lz) => { const y = groundAt(C.heart[0] + lx, C.heart[2] + lz); return Number.isFinite(y) ? y - C.heart[1] : 0; };
  /** A point of the circle's frame, in the scene, on its ground. */
  const sceneAt = (lx, lz) => [C.heart[0] + lx, C.heart[1] + heightAt(lx, lz), C.heart[2] + lz];

  const siteFoes = () => (C && foes ? foes.list().filter((f) => f && f.site === C.site) : []);

  /** THE FAITHFUL SPRUNG: the Summoner behind the altar, the rest on the ring - one camp, chanting, the Summoner thrice a
   *  caster's health. */
  function spring() {
    C.spawned = true;
    sprang(C.site);
    const day = C.day, site = C.site, camp = foes.campId();
    const all = riteFaithfulOf(day), ring = C.layout.ring(all.length - 1);
    all.forEach((m, i) => {
      const [x, z, yaw] = m.summoner ? C.layout.summoner : ring[i - 1];
      foes.spawn(m.career, [C.heart[0] + x, C.heart[2] + z], { yaw, site }).then((f) => {
        if (!f) return;
        if (!C || C.day !== day) { foes.removeSite(site); return; }
        f.campId = camp; f.campAlertRadius = RITE_ALERT_M;
        if (f.entity) f.entity.campId = camp;
        if (f.ai) f.ai.sightRadius = RITE_SIGHT_M;
        if (m.summoner && f.entity) { f.entity.maxHealth = Math.max(1, Math.round((f.entity.maxHealth ?? 1) * RITE_SUMMONER_HEALTH)); f.entity.health = f.entity.maxHealth; }
      }).catch(() => {});
    });
  }
  /** Every screen's faithful named; my own woken together; who struck them and whether the Summoner fell, read. */
  function tend(holds) {
    const list = foes.list();
    let waker = null;
    for (const f of list) {
      if (!f || f.site !== C.site) continue;
      const name = f.mobileType === RITE_SUMMONER_CAREER ? RITE_TEXT.summoner : RITE_TEXT.faithful;
      if (f.entity && f.entity.name !== name) f.entity.name = name;
      if (struckAt(f) != null) C.struck = true;
      if (holds && f.mobileType === RITE_SUMMONER_CAREER && f.dead && f.corpse) C.fell = true;
      if (!f.puppet && !f.dead && f.ai?.target && !waker) waker = f;
    }
    // ONE WOKEN WAKES THEM ALL - a blow on one that never saw its striker too (the camp's own wake rides sight alone)
    if (waker) for (const g of list) if (g && g.site === C.site && !g.puppet && !g.dead && g.ai && !g.ai.target) g.ai.target = waker.ai.target;
  }
  /** The rite's word to its cell - every RITE_WORD_MS, and at once when it changes. */
  function word(t) {
    const w = { d: C.day, px: C.px, py: C.py, s: C.struck ? 1 : 0, f: C.fell ? 1 : 0 };
    const k = `${w.s}${w.f}`;
    if (k === C.said && t - C.wordAt < RITE_WORD_MS) return;
    if (send(w, worldRoom(C.px, C.py))) { C.wordAt = t; C.said = k; }
  }
  /** THE CASKET: the day's pile, seeded for a player near it once the rite is broken and this character has not opened
   *  it today; opened (anything taken from it), the day is kept on the character. */
  function chest(d) {
    if (C.pile) {
      const taken = C.pile.items.length < C.pileCount;
      if (taken) { markRiteChest(C.day); C.pile = null; return; }
      if (C.pile.dead) C.pile = null;   // gone with its pixel, untouched - seeded again the next time
      return;
    }
    if (!loot || !C.known || !broken.has(C.day) || riteChestOpened(C.day) || d > RITE_CHEST_SEED_M) return;
    const c = C.layout.casket;
    const items = riteChestItems(level(), rolls);
    const p = sceneAt(c.x, c.z);
    C.pile = loot.seed(items, [p[0], p[1] + 0.6, p[2]], `${C.px},${C.py}`);   // dies with its pixel
    C.pileCount = C.pile?.items?.length ?? 0;
  }

  // ── the art ──
  function ensureMesh() {
    if (!C.known || !renderer?.createMesh) return;
    const key = `${C.day}`;
    if (mesh && meshKey === key) return;
    try {
      if (!artUp) {
        for (const [rec, art] of gateArt()) { renderer.uploadTexture?.(GATE_ARCHIVE, rec, art.albedo); renderer.uploadEmissionTexture?.(GATE_ARCHIVE, rec, art.emission); }
        artUp = true;
      }
      mesh = renderer.createMesh(buildRiteModel(C.facing, heightAt));
      meshKey = key;
    } catch (e) { console.warn('[rite] the circle would not build', e?.message ?? e); mesh = null; meshKey = key; }
  }
  function ensureTent() {
    if (tent || tentTried || !meshes?.getGpuMesh) return;
    tentTried = true;
    Promise.resolve(meshes.getGpuMesh(TENT_MODEL)).then((g) => { tent = g ?? null; }).catch(() => {});
  }
  function ensureFire() {
    if (fire || fireTried || !getTexture) return;
    fireTried = true;
    Promise.resolve(getTexture(FIRE_FLAT.archive)).then((t) => {
      if (!t) return;
      const count = t.getFrameCount?.(FIRE_FLAT.record) ?? 1;
      for (let i = 0; i < count; i++) uploadRecordFrame?.(FIRE_FLAT.archive, FIRE_FLAT.record, i);
      const size = t.getSize(FIRE_FLAT.record);
      fire = { count, size: { w: size.width * GLOBAL_SCALE * 0.8, h: size.height * GLOBAL_SCALE * 0.8 } };
    }).catch(() => {});
  }
  /** The flames: one on each brazier, and the camp's fire - one batch, stood again when the heart moves. */
  function mountFlames() {
    if (!fire || !renderer?.createBillboardBatch || !C.known) return;
    const h = C.heart;
    if (flames && flamesAt && flamesAt[0] === h[0] && flamesAt[1] === h[1] && flamesAt[2] === h[2]) return;
    if (flames) { renderer.destroyBillboardBatch?.(flames); flames = null; }
    const pos = C.layout.braziers.map(([x, z]) => { const p = sceneAt(x, z); return [p[0], p[1] + RITE_BRAZIER_H, p[2]]; });
    pos.push(sceneAt(C.layout.fire[0], C.layout.fire[1]));
    flames = renderer.createBillboardBatch(FIRE_FLAT.archive, FIRE_FLAT.record, fire.size, pos);
    flames.frame = 0;
    anim = fire.count > 1 ? new FlatAnim(FIRE_FLAT.archive, fire.count, false) : null;
    flamesAt = [h[0], h[1], h[2]];
  }
  /** The smoke's strength now: rising from the omen, thinning after the opening; 0 with no circle. */
  function smokeFade() {
    if (!C) return 0;
    const t = now(), w = riteWindow(C.day);
    return Math.min(1, Math.max(0, (t - w.from) / RITE_SMOKE_IN_MS), Math.max(0, 1 - (t - w.to) / RITE_SMOKE_OUT_MS));
  }

  return {
    /** The frame's beat: the circle stood or let go, the faithful sprung and tended, the words said. Answers the circle. */
    frame() {
      const t = now();
      const c = omen?.() ?? null, s = c?.site ?? null;
      if (!s || !Number.isSafeInteger(s.day) || !riteStands(s.day, t)) { if (C) leave(); return null; }
      if (!C || C.day !== s.day || C.px !== s.px || C.py !== s.py) enter(s);
      if (s.place && !C.place) C.place = s.place;
      placeHeart();
      const f = feet(), d = f ? dist2(f, C.heart) : Infinity;
      const holds = riteHolds(C.day, t), on = online();
      if (on && holds && foes && !C.spawned && !broken.has(C.day) && C.known && d <= RITE_SPRING_M && !peerSprang(C.site)) spring();
      if (foes) tend(holds);
      if (holds && !C.nearSaid && !broken.has(C.day) && d <= RITE_SAY_M) { C.nearSaid = true; sayNear(RITE_TEXT.near); }
      // THE OPENING: the faithful still standing pass into the breach
      if (!holds && t >= riteWindow(C.day).to && !C.passed) {
        C.passed = true;
        const standing = siteFoes().filter((g) => !g.dead);
        if (standing.length && foes) foes.removeSite(C.site);
        if (standing.length && !broken.has(C.day) && d <= RITE_SPRING_M) sayNear(RITE_TEXT.pass);
      }
      if (on && holds && d <= RITE_REACH_M) word(t);
      chest(d);
      if (C.known) { made(); ensureMesh(); ensureTent(); ensureFire(); mountFlames(); }
      return C;
    },
    /** The flames' clock (the host's per-frame tick). */
    tick(dt) { if (flames && anim) flames.frame = anim.tick(dt); },
    /** THE HUB'S WORD (net/wire.js validRiteOut): the rite broken - said once a day, and its casket opened. */
    onBroken(w) {
      if (!w || !Number.isSafeInteger(w.d)) return;
      broken.add(w.d);
      if (broken.size > 8) broken.delete(broken.values().next().value);
      if (saidBroken.has(w.d)) return;
      saidBroken.add(w.d);
      say(RITE_TEXT.broken(C?.day === w.d ? C.place : null));
    },
    /** The circle's stone and the tents, in the host's world pass. */
    draw(r = renderer, texRemap = null) {
      if (!C?.known || !r?.drawMesh) return 0;
      made();
      let n = 0;
      if (mesh) { r.drawMesh(mesh, mats.stone, texRemap); n++; }
      if (tent) for (const m of mats.tents) { r.drawMesh(tent, m, texRemap); n++; }
      return n;
    },
    /** The flames, for the host's billboard list. */
    batches: () => (C?.known && flames ? [flames] : NONE),
    /** The braziers' and the fire's light - the nearest few, in reach of the eye. */
    lights() {
      if (!C?.known) return NONE;
      const f = feet();
      if (!f || dist2(f, C.heart) > RITE_LIGHT_REACH_M) return NONE;
      made();
      const d = (p) => Math.hypot(p.x - f[0], p.z - f[2]);
      return [...lightPts].sort((a, b) => d(a) - d(b)).slice(0, RITE_LIGHTS_MAX);
    },
    /** The pillar of smoke: from the omen, rising, until the breach opens, thinning after. */
    smokes() {
      const fade = smokeFade();
      if (!(fade > 0)) return NONE;
      smoke.origin = C.heart; smoke.fade = fade;
      return smokeList;
    },
    /** Whether the smoke shows - the host builds the pass's arguments only then (AUDIT WB C7). */
    smoking: () => smokeFade() > 0,
    /** The smoke's pass, after the world's (the gate's fire's seat). */
    drawSmoke(proj, view, eye, seconds, fog = null) {
      const list = this.smokes();
      if (!list.length) return 0;
      if (!smokePass && !smokeTried && gl) { smokeTried = true; try { smokePass = new RiteSmokeRenderer(gl); } catch (e) { console.warn('[rite] the smoke would not build', e?.message ?? e); } }
      if (!smokePass) return 0;
      smokePass.draw(list, proj, view, eye, seconds, fog);
      return smokePass.drawn;
    },
    /** THE CASKET, while it holds no pile: its name, and sealed until the rite is broken. */
    targets() {
      if (!C?.known || C.pile) return NONE;
      made();
      return target;
    },
    hoverName(key) {
      if (typeof key !== 'string' || !C) return null;
      if (key.startsWith('rite:')) return { title: RITE_TEXT.chest, subs: broken.has(C.day) ? (riteChestOpened(C.day) ? ['Opened'] : []) : ['Sealed'] };
      return C.pile && loot?.keyOf && key === loot.keyOf(C.pile) ? { title: RITE_TEXT.chest } : null;   // open: its pile wears its name
    },
    activate(key) {
      if (typeof key !== 'string' || !key.startsWith('rite:') || !C) return false;
      if (!broken.has(C.day)) sayNear(RITE_TEXT.sealed);
      return true;
    },
    /** The host's state, for the tests and the probes. */
    state: () => (C ? { day: C.day, site: C.site, heart: C.heart, known: C.known, spawned: C.spawned, struck: C.struck, fell: C.fell, broken: broken.has(C.day), passed: C.passed, pile: !!C.pile, mesh: !!mesh } : null),
    destroyAll() { leave(); },
  };
}
