// @ts-check
// WB4 (2026-09-25, Mac: "a large boss arena with an oversized enemy with telegraphed attacks (like wind ups, etc)"):
// THE FIGHT IN THE COURT, ON THIS SCREEN - the boss's body where the relay says he stands, doing what it says he is
// doing, three times a Daedra Lord's size; his glow; the telegraph of the attack he is winding up; his voice at the
// word, at the landing, at a phase and at his fall; the bar over the screen; and THE PLAYER'S OWN SIDE of every attack -
// the landing tested against this player's feet, and the blow taken through the host's own door. Design:
// bible/11-Multiplayer/World-Bosses.md section 5.
//
// ONE SOURCE: the court's link (net/gateLink.js - the relay's words, folded). Nothing here is sent: a strike's verdict
// is this machine's own (co-op's law - "an enemy's strike on a client is applied by that client", net/gateStrike.js),
// and it lands through `strike` - the dungeon context's door (hurt, flash, cry), the same as any foe's blow.
//
// THE PARTS, each pure where it can be: the look (world/gateBoss.js bossAct/bossFrame/bossGlow/BOSS_CUES), the ground
// (render/gateTelegraph.js telegraphShape and its pass), the verdict (net/gateStrike.js strikeVerdict), the bar
// (ui/gateBossBar.js bossBarModel). This file is their driver: it holds the sprite's texture and batch, the attacks it
// has already cued, landed and judged, and the host's doors.
//
// Not a DFU member. Ledger A (WB).
import { ATTACK_BY_ID, ATTACKS, COURT_CENTRE, COURTS, COURT_R, HIT_KINDS, POOL_TICK_MS, PHASE_NAMES, profileOf, nearestCourt, windupOf, CRYSTAL_R, CRYSTAL_H } from '../net/gateBrain.js';
import { strikeVerdict, blowOf, strikeDamage, savedShare, landingPools, poolUnder } from '../net/gateStrike.js';
import { GATE_BOSSES, gateBossOf } from '../net/gateLaw.js';
import { bossAct, bossFrame, bossGlow, bossPlace, bossHop, bossLookOf, bossStandIn, bossCue, BOSS_CUES, BOSS_STRIDE_M, GROWL_EVERY_MS, HURT_GAP_MS, HURT_SHARE, QUAKE_ON, THUD_AT_MS, WARD_COLOR, EMBER_COLOR, poolColor, emberColor, attackColor, crystalStandIn, crystalColor, groundStepCue } from '../world/gateBoss.js';
import { courtToDungeon, portalDoor, PORTAL_AFTER_MS, PORTAL_RISE_MS, PORTAL_DROP, COURT_TEXT } from '../world/gateArena.js';
import { GateTelegraphRenderer, telegraphShape, markShape, poolShapes, TELEGRAPH_STYLE } from '../render/gateTelegraph.js';
import { CourtCrystalRenderer, crystalGrowth, CRYSTAL_GROW_MS, CRYSTAL_SHATTER_MS, CRYSTAL_FLASH_MS, CRYSTALS_DRAW_MAX } from '../render/courtCrystals.js';   // WB9c: the crystals of Oblivion, drawn
import { GateFxRenderer, fxBurstOf, meteorFall, FX_BURST_MS, FX_BURSTS_MAX, FX_KINDS } from '../render/gateFx.js';   // WB9e: his blows seen landing
import { tierColour } from '../render/spoilsGlow.js';   // WB9f: a piece's landing sparks in its tier's colour
import { RARITIES } from '../systems/lootRarity.js';
import { GatePassRenderer, gateSpinRate } from '../render/gatePass.js';   // WBX2: the portal's fire is the gate's own
import { gateArchProfile } from '../world/gateModel.js';
import { ONLINE_MINUTES_PER_MS } from '../net/wire.js';   // WBX7: a soul trap's rounds on the shared world's clock
import { spoilsLevel } from './spoilsPool.js';   // AUDIT WBX S2: the spoils never rolled past the level the fight admitted
import { bossBarModel, drawGateBossBar } from '../ui/gateBossBar.js';
import { marksCardModel, drawGateMarksCard } from '../ui/gateMarksView.js';   // WB9a: the night's marks over the screen as a fighter steps in
import { groundViewModel, drawGateGround } from '../ui/gateGroundView.js';   // WB9d: his ground and his element, felt
import { readReceipt } from '../net/gateReceipt.js';
import { ENEMY_BASICS } from '../characters/enemyBasics.js';
import { mobileBillboardSize } from '../world/rmbFlats.js';

/** WB8b: what a resisted strike's element is called in its line. */
const RESISTED_WHAT = Object.freeze({ fire: 'flames', frost: 'frost', shock: 'lightning', poison: 'venom' });
/** The words a strike says that the hurt itself does not; and the fall's, to a player the receipt never came for. */
export const COURT_STRIKE_TEXT = Object.freeze({
  resisted: (name, el = 'fire') => `You resist the ${RESISTED_WHAT[el] ?? 'flames'} of the ${name}.`,   // WB8b: the element his aspect gives it
  noSpoils: (name) => `${name}'s spoils are not yours - you did not stand the fight.`,
  // WBX3 (Swololo on Discord: "loot was not distributed, was instantly pillaged by others"): said at the burst - every
  // fighter's spoils are their own, on their own screen, and nobody else can see or take them
  spilled: (name) => `${name}'s spoils spill across the floor - yours alone to take.`,
  burning: 'burning ground',
});
/** WBX5: THE TURN OF A PHASE, said over the screen as he leaps into the court's heart - each phase by its name
 *  (net/gateBrain.js PHASE_NAMES), and what it brings. WB8b: in his aspect's words (net/gateMods.js `floor`, `stuff`) -
 *  the Burning Warden's are these. */
export const courtPhaseText = (n, aspect) => (n === 2 ? `${PHASE_NAMES[1]}: he bounds across the fire - follow him over the walkway. There the floor will ${aspect.floor} - keep out of the ${aspect.stuff}.`
  : n === 3 ? `${PHASE_NAMES[2]}: he bounds to the last court and calls on Dagon - stand between the spokes of ${aspect.stuff}, and shatter the crystals when he calls his Reckoning.` : null);   // WB9b/c: the turn crosses to the next court; the last brings the Reckoning
export const COURT_PHASE_TEXT = Object.freeze({
  2: `${PHASE_NAMES[1]}: he bounds across the fire - follow him over the walkway. There the floor will burn - keep out of the fire.`,
  3: `${PHASE_NAMES[2]}: he bounds to the last court and calls on Dagon - stand between the spokes of fire, and shatter the crystals when he calls his Reckoning.`,
});
/** WB9c (2026-09-30, Mac: "a detailed wipe mechanic on the final phase that should require players to destroy oblivion
 *  crystaline formations ... which then stuns his wipe mechanic"): DAGON'S RECKONING, said - its call (how many crystals
 *  there are to break), each crystal broken (by whom, and how many stand), and the Reckoning broken (he is stunned). */
export const COURT_RECKON_TEXT = Object.freeze({
  call: (n) => `Dagon's Reckoning! Shatter all ${n} crystals of Oblivion before it lands!`,
  shattered: (who, left) => (left > 0 ? `${who || 'A challenger'} shatters a crystal - ${left} ${left === 1 ? 'remains' : 'remain'}.` : `${who || 'A challenger'} shatters the last crystal!`),
  broken: (boss) => `The Reckoning breaks! ${boss} is stunned - strike now!`,
});
/** WB9c: a crystal's word, or the stun's, heard later than this after it happened is neither said nor sounded
 *  (FED_LATE_MS's law - heard live, never a stale one). */
export const RECKON_LATE_MS = 2000;
/** WB9c: a crystal is a target once it has grown this far out of the stone; each standing one lights the floor about it
 *  (its light's reach, m, and its heart's height). */
export const CRYSTAL_STRIKE_GROWN = 0.5;
export const CRYSTAL_LIGHT_RANGE = 9;
export const CRYSTAL_LIGHT_Y = 1.6;
/** WB8c: THE WARDEN'S MARKS, said as a fighter steps into his court (his aspect's own line, and his trials by name), and
 *  a Soul-Hungry Warden's feeding on a fallen challenger - by their name (the relay's `fed`), or none it may say. */
export const COURT_MARKS_TEXT = Object.freeze({
  arrive: (P) => `${P.aspect.arrive}${P.trials.length ? ` His marks tonight: ${P.trials.map((t) => t.name).join(', ')}.` : ''}`,
  // AUDIT PRE-MERGE 0929 W1-3: the beat's feedings, every name - "on Ann's soul", "on the souls of Ann and Bran"
  fed: (boss, names) => {
    const ns = (Array.isArray(names) ? names : [names]).filter(Boolean);
    if (ns.length <= 1) return `${boss} feeds on ${ns.length ? `${ns[0]}'s` : 'a fallen challenger\'s'} soul.`;
    return `${boss} feeds on the souls of ${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}.`;
  },
});
/** WBX7: a magic round on the shared world's clock, ms - one game minute (net/wire.js ONLINE_MINUTES_PER_MS: TimeScale
 *  12, five seconds) - so a soul trap laid on him lasts its rounds as it would on any foe in the same world. */
export const COURT_ROUND_MS = Math.round(1 / ONLINE_MINUTES_PER_MS);
/** WBX4: his mark's ember, a little brighter than his glow's, so the floor under him reads at a glance - WB8b: his
 *  aspect's ember (MARK_COLOR the Burning Warden's). */
export const markColorOf = (ember) => Object.freeze(ember.map((c) => Math.min(1, c * 1.1)));
export const MARK_COLOR = markColorOf(EMBER_COLOR);
/** WB9f: his spoils rest no nearer the court's edge than this (m) - the throw is softened until they do
 *  (world/gateSpew.js keepLaunch) - and the gold his chest bursts in as they leave it. */
export const SPEW_RIM_M = 2;
export const SPOILS_BURST_COLOR = Object.freeze([1, 0.78, 0.28]);
/** WB9f: the court floor his spoils must come to rest on - the court he fell in, SPEW_RIM_M in from its edge, in the
 *  dungeon's frame (the burst's `keep`). Pure. */
export function spoilsKeep(x, z) {
  const C = COURTS[nearestCourt(x, z)], centre = courtToDungeon(C[0], 0, C[1]);
  return { centre, r: COURT_R - SPEW_RIM_M, floorY: centre[1] };
}
/** WB5: his body bursts this long into his fall, and the spoils leave it (world/gateBoss.js FALL_MS is the whole fall);
 *  a receipt not come this long after it never will. */
export const SPEW_AT_MS = 500;
export const RECEIPT_WAIT_MS = 4000;
/** AUDIT WB B7: his death cry is heard only this near his fall - a player who comes to the court (or back to it) after
 *  he fell hears the thud's own late rule, not a cry from minutes ago. */
export const FALL_CRY_LATE_MS = 1500;
/** WB8c: a Soul-Hungry feeding heard later than this after it happened is not said (nor growled) - heard live, never a
 *  stale one (AUDIT PRE-MERGE 0929 W2-3: for every feeding, not the entry's first alone). */
export const FED_LATE_MS = 2000;

/** AUDIT WB B4: AN ATTACK IS ITS NUMBER AND ITS MOMENT. The relay numbers a fight's attacks, and a room woken from its
 *  checkpoint numbers them from there again - the next attack would wear the number of one this screen already judged,
 *  cued and landed, and pass unheard and unfelt. */
const noMark = () => ({ i: -1, at: NaN });
const marked = (m, atk) => m.i === atk.i && m.at === atk.at;
const setMark = (m, atk) => { m.i = atk.i; m.at = atk.at; };
const NONE = Object.freeze([]);

/** The boss by his id (the relay's word), or the day's (net/gateLaw.js). */
export const bossOf = (s) => GATE_BOSSES.find((b) => b.id === s?.boss) ?? gateBossOf(s?.day ?? 0);

/**
 * @param {{
 *   renderer?: any, gl?: any,
 *   getTexture?: ((archive: number) => Promise<any>)|null,
 *   uploadRecordFrame?: ((archive: number, record: number, frame: number) => void)|null,
 *   audio?: any,
 *   link: { state: () => any, receipt?: (day: number) => string|null },
 *   spoils?: any,
 *   now: () => number,
 *   cam?: () => number[]|null,
 *   feet?: () => number[]|null,
 *   player?: () => any,
 *   save?: (entity: any, el?: string) => number,
 *   strike?: (dmg: number, how: { fire: boolean, el?: string|null, name: string }) => void,
 *   say?: (text: string) => void,
 *   hudHidden?: () => boolean,
 *   veiled?: () => boolean,
 *   send?: (hit: { q: number, d: number, r: number }) => boolean,
 *   sendCrystal?: (hit: { c: number, q: number, d: number, r: number }) => boolean,
 *   rng?: () => number,
 *   portalDoor?: (door: any) => void,
 *   soulTrap?: (trap: { chance: number, mobile: number, name: string }) => void,
 * }} deps
 *   WB9a: `veiled` - the step's fire is over the screen (ui/gateVeil.js): the marks' card waits under it. WB9c:
 *   `sendCrystal` - a blow of mine on a crystal of Oblivion, to the court's room (the wire's `xhit`).
 *   WB8b: `save` answers the saving throw against `el` (his aspect's element - fire, frost, shock, poison) and `strike`
 *   is told the element it landed with. WBX2: `portalDoor` lays the risen portal's door into the court's exit doors, once, so the exit's own ray, name and
 *   press take it - the way home, the bridge membrane's own (SS3: the court no longer takes a way home of its own - the
 *   portal is never walked through). WBX7:
 *   `soulTrap` rolls a soul trap of mine still on him at his fall (the host's attemptSoulTrap - a gem filled with his soul,
 *   and its words).
 */
export function createGateCourt({
  renderer = null, gl = null, getTexture = null, uploadRecordFrame = null, audio = null,
  link, spoils = null, now, cam = () => null, feet = () => null, player = () => null, save = () => 100,
  strike = () => {}, say = () => {}, hudHidden = () => false, veiled = () => false, send = () => false, sendCrystal = () => false, rng = Math.random,
  portalDoor: layPortalDoor = () => {}, soulTrap = () => {},
}) {
  let pass = null;
  try { if (gl) pass = new GateTelegraphRenderer(gl); } catch (e) { console.warn('[gate] the telegraph would not build', e?.message ?? e); pass = null; }
  /** the sprite: its texture once loaded (or the promise, or a failure), its batch while drawn */
  let body = null, loading = null, batch = null;
  let batchShown = false;   // PERF-EXT10: the body's shown-or-not is the court's own, never a field the batch was not born with
  /** the fight this driver is on (its day), and what it has done with its attacks */
  let day = null, judged = noMark(), cued = noMark(), landed = noMark(), phaseHeard = 0, fellCued = false, wrathLanded = false;
  let prevT = -Infinity, hurtAt = -Infinity, shape = null;
  /** WB4b: his stand-in for the formulas (made once a fight), and my blows' sequence (the wire's `q`) */
  let standIn = null, blowSeq = 0;
  /** WB5: whether this fight's spoils have left him, and whether their absence has been said */
  let spewed = false, spoilsSaid = false;
  /** WB7: his body's sounds - where he stood last frame and how far he has come since his last step, when he growls
   *  next, the health last heard and his last grunt, the landing that shook the ground, the phase the thunder has
   *  answered, and whether his body has met the floor */
  let stepFrom = null, strideRun = 0, growlAt = null, hpHeard = null, gruntAt = -Infinity, quaked = noMark(), thunderPhase = 0, thudCued = false;
  /** WBX5: the burning ground the landings this screen saw have left (net/gateStrike.js landingPools), the attack whose
   *  pools were laid last, and when the fire under my feet last bit; WBX4: his mark on the floor, and the pools' shapes */
  let pools = [], pooled = noMark(), burnAt = -Infinity, inFire = false, outAt = -Infinity, mark = null;
  /** @type {ReadonlyArray<any>} */
  let poolDraw = NONE;
  let _mark = markShape([0, 0], 0, MARK_COLOR), _markOf = null, markEmber = MARK_COLOR;   // WB8b: his mark and its ember, remade when his profile is another
  /** WB8c: whether his marks have been said to me on this entry, and the last feeding heard; WB9a: when they were (the
   *  marks' card stands from then - ui/gateMarksView.js MARKS_CARD_ARRIVE_MS) */
  let marksSaid = false, fedHeard = null, marksAt = null;
  /** WBX2: the portal home once he has fallen - where it stands (the court's frame) and how far it has risen, its fire's
   *  pass and the arch's opening (made the first time one stands), its fire's turn, and whether its door is laid and its
   *  rising said */
  let portal = null, portalPass = null, portalTried = false, profile = null, spin = 0, portalLaid = false, portalSaid = false;
  /** WBX7: my soul trap on him - its chance (frozen at the cast) and when it runs out on the relay's clock - and whether
   *  his fall has rolled it */
  let trapMark = null, trapJudged = null;   // AUDIT WBX F6: the day whose fall rolled it - once a fight, across a walk out and back
  /** AUDIT WB D10: the frame's lists, refilled rather than made - the host asks for them every frame */
  const _batches = [], _lights = [];
  /** WB9c: THE RECKONING'S CRYSTALS as this screen holds them (crystalsOf - made at its word): its number and first spot
   *  (its identity - AUDIT WB B4's law: a room woken from its checkpoint numbers again), each crystal's foot in the
   *  dungeon's frame and its body as a target, when they grew (the relay's clock), each one's health share, when it broke
   *  (null standing) and when I last struck it, its turn and seed, when its Reckoning lands; `ended` once the relay has
   *  done with it (broken or landed) - kept until the last shard has flown. The last one ended (never seen again as new),
   *  the stun last heard, the stand-in every crystal shares (made once a fight), and the pass. */
  let rk = null, rkDone = null, stunHeard = 0, crystalIn = null, crystalPass = null, crystalTried = false;
  const _targets = [], _crystalDraw = [], _crystalSlots = [], _crystalLights = [], _chest = [0, 0, 0];
  /** WB9d: his ground and his element, felt - the ground I stand in (its name and colour) and the last bite or elemental
   *  blow that landed on me (when, and its colour) */
  let groundName = '', groundColor = null, biteAt = -Infinity, biteColor = null;
  /** WB9e: his blows seen landing - the bursts' slots (each where it landed in the dungeon's frame, its moment on the
   *  relay's clock, its kind and colour), the frame's live ones and the meteor's fall; the pass (made the first time) */
  const _bursts = [], _fxLive = [], _meteor = { at: [0, 0, 0], color: null };
  let meteorNow = null, fxPass = null, fxTried = false;

  function reset(d) {
    day = d; judged = noMark(); cued = noMark(); landed = noMark(); phaseHeard = 0; fellCued = false; wrathLanded = false;
    prevT = -Infinity; hurtAt = -Infinity; shape = null; standIn = null; spewed = false; spoilsSaid = false;
    stepFrom = null; strideRun = 0; growlAt = null; hpHeard = null; gruntAt = -Infinity; quaked = noMark(); thunderPhase = 0; thudCued = false;
    pools = []; pooled = noMark(); burnAt = -Infinity; inFire = false; outAt = -Infinity; mark = null; poolDraw = [];
    marksSaid = false; fedHeard = null; marksAt = null;
    portal = null; spin = 0; portalLaid = false; portalSaid = false;
    rk = null; rkDone = null; stunHeard = 0; crystalIn = null; _targets.length = 0; _crystalDraw.length = 0;   // WB9c
    _bursts.length = 0; _fxLive.length = 0; meteorNow = null;   // WB9e
    groundName = ''; groundColor = null; biteAt = -Infinity; biteColor = null;   // WB9d
    if (d !== null && trapMark?.day !== d) trapMark = null;   // AUDIT WBX F6: a trap of this day's fight outlives a cast-out and a walk back in
  }

  /** WBX7: HIS FALL ROLLS MY TRAP, once - a trap of mine still running at the moment he fell (the relay's `fell.at`, not
   *  when this screen heard of it) goes to the host's roll with his mobile, the soul a gem takes. */
  function judgeTrap(s) {
    if (!s.fell || trapJudged === s.day) return;
    trapJudged = s.day;
    if (trapMark && s.fell.at < trapMark.until) soulTrap({ chance: trapMark.chance, mobile: bossLookOf(s.boss).mobile, name: bossOf(s).name });
  }

  /** WBX2: THE PORTAL HOME - PORTAL_AFTER_MS into his fall it stands where he fell and rises; its door is laid into the
   *  court's exit doors once (the ray, the plaque's name and the PRESS - the bridge membrane's own way home), and the
   *  rising is said once. SS3 (2026-09-27, a player through Mac, "Oblivion gate exit on touch prevents looting": "I was
   *  close to the guy when he died, got zoned out by touching the gate before I could pick up loot"): it is never WALKED
   *  through. It stands where he fell - where his spoils leave him and land - so a player going for them stepped through
   *  its fire and out of the court with the floor still full (gathered into the pack on the way out, never seen fall). */
  function portalFrame(s, t, dt) {
    if (!s.fell || t < s.fell.at + PORTAL_AFTER_MS) { portal = null; return; }
    const at = bossPlace(s, s.fell.at);
    portal = { at, rise: Math.min(1, (t - s.fell.at - PORTAL_AFTER_MS) / PORTAL_RISE_MS), origin: courtToDungeon(at[0], -PORTAL_DROP, at[1]) };
    profile ??= gateArchProfile();   // the arch's opening - the fire's shape and the step's bound, with or without a GL
    if (!portalTried && gl) {
      portalTried = true;
      try { portalPass = new GatePassRenderer(gl, profile); } catch (e) { console.warn('[gate] the portal would not build', e?.message ?? e); portalPass = null; }
    }
    spin = (spin + gateSpinRate(1) * Math.max(0, dt)) % 1;
    if (!portalLaid) { portalLaid = true; layPortalDoor(portalDoor(at)); }
    if (!portalSaid) { portalSaid = true; if (t < s.fell.at + PORTAL_AFTER_MS + PORTAL_RISE_MS + 1000) say(COURT_TEXT.portal); }   // said as it rises, never long after
  }

  function sound(cue, s, t, atk, point = null) {
    if (!cue || !audio) return;
    const where = cue.at === 'point' && point ? [point]   // WB9c: a crystal's own place (the dungeon's frame)
      : cue.at === 'targets' && atk?.tg?.length ? atk.tg.map((p) => courtToDungeon(p[0], 0.5, p[1]))
      : [(() => { const [x, z] = bossPlace(s, t); return courtToDungeon(x, 2.5, z); })()];
    const opts = { maxDistance: cue.reach, distanceModel: 'linear', pitch: cue.pitch };
    for (const p of where) {
      try { if (cue.id != null) audio.play3dId?.(cue.id, p, cue.volume, opts); else audio.play3d?.(cue.clip, p, cue.volume, opts); } catch { /* a sound is never the fight */ }
    }
  }

  /** A strike on me: its share of my own health and its base (WBX4), an element through my saving throw against it (the
   *  Wrath through nothing) - WB8b: all under his profile (his aspect's element and names, Vengeful's weight). */
  function land(atk, P) {
    const e = player(), so = blowOf(atk, P);
    if (!e || !so || !(e.health > 0)) return;
    let dmg = strikeDamage(so.pct, e.maxHealth, so.base);
    if (so.saved) dmg = savedShare(dmg, save(e, so.el));
    if (dmg <= 0) { say(COURT_STRIKE_TEXT.resisted(so.name, so.el)); return; }
    strike(dmg, { fire: so.el === 'fire', el: so.el, name: so.name });
    if (so.el) { biteAt = now(); biteColor = attackColor(ATTACK_BY_ID[atk.a], P); }   // WB9d: an elemental blow flares the screen's rim in its colour (DFU's red flash is a blow's alone)
  }

  /** WBX5: THE BURNING GROUND - a landing that leaves fire lays its pools the frame this screen sees it land (never one
   *  it did not see: the pools are this screen's, as the verdict is); STAYING in one bites every POOL_TICK_MS - the first
   *  bite a tick after I stepped in (or it fell under me: the landing has already struck), so a step out in time is
   *  free - fire, through my saving throw. The burnt-out go. */
  function burn(s, t, P) {
    const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
    if (A && P.atk[A.key].pool && !marked(pooled, atk) && t >= atk.at) {   // WB8b: the ground his profile gives the landing (Scarring's too)
      setMark(pooled, atk);
      if (t < atk.at + Math.max(A.active, 1) + 400) for (const p of landingPools(atk, P)) pools.push(p);   // AUDIT WB B7's law: a landing long past is not laid now
    }
    if (pools.length) pools = pools.filter((p) => t < p.until);
    const f = feet(), e = player();
    if (!pools.length || !f || !e || !(e.health > 0) || s.fell || s.wrath != null) { inFire = false; return; }
    const p = poolUnder(pools, f[0] - COURT_CENTRE[0], f[2] - COURT_CENTRE[2], t);
    if (!p) { if (inFire) { inFire = false; outAt = t; } return; }
    // WB9d: the ground I stand in, named and coloured for the rim and the warning (ui/gateGroundView.js); a step in
    // hisses under my feet at once - the bite is a tick off, the warning is not
    groundName = P.aspect.ground; groundColor = poolColor(P);
    if (!inFire && t - outAt >= POOL_TICK_MS) sound(groundStepCue(P), s, t, null, f);
    // AUDIT WBX F8: a step in starts the fire's count a tick off - unless the step out was shorter than a tick, which
    // keeps the count it had (a frame out of the fire each second was never bitten)
    if (!inFire) { inFire = true; if (t - outAt >= POOL_TICK_MS) { burnAt = t; return; } }
    if (t - burnAt < POOL_TICK_MS) return;
    burnAt = t;
    const el = p.el ?? 'fire';   // WB8b: his aspect's ground
    const dmg = savedShare(strikeDamage(p.pct, e.maxHealth, p.base), save(e, el));
    if (dmg > 0) {
      strike(dmg, { fire: el === 'fire', el, name: el === 'fire' ? COURT_STRIKE_TEXT.burning : P.aspect.ground.toLowerCase() });
      biteAt = t; biteColor = groundColor;   // WB9d: the bite flares the rim
    }
  }

  function judge(s, t, P) {
    const atk = s.atk;
    const f = feet(), e = player();
    const standing = !!f && !!e && e.health > 0;
    if (atk && !marked(judged, atk) && standing) {
      const v = strikeVerdict(atk, f[0] - COURT_CENTRE[0], f[2] - COURT_CENTRE[2], t, prevT, P);
      if (v !== 'wait') {
        setMark(judged, atk);
        if (v === 'hit') { if (ATTACK_BY_ID[atk.a] === ATTACKS.wrath) wrathLanded = true; land(atk, P); }
      }
    }
    // the Wrath's own word, when it overtook its attack's landing on this screen: it lands all the same
    if (s.wrath != null && !wrathLanded) { wrathLanded = true; if (standing) land({ a: ATTACKS.wrath.id }, P); }
  }

  function cue(s, t, P) {
    const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null;
    if (A && !marked(cued, atk)) { setMark(cued, atk); if (t < atk.at) sound(bossCue('windup', A, P), s, t, atk); }   // WB8b: in his aspect's voice
    if (A && !marked(landed, atk) && t >= atk.at) { setMark(landed, atk); if (t < atk.at + Math.max(A.active, 1) + 400) { sound(bossCue('land', A, P), s, t, atk); burstsOf(atk, A, P); } }   // WB9e: and seen landing
    if (A && !marked(quaked, atk) && t >= atk.at && QUAKE_ON.includes(A.key)) { setMark(quaked, atk); if (t < atk.at + Math.max(A.active, 1) + 400) sound(BOSS_CUES.quake, s, t, atk); }   // WB7: the ground's shock under a heavy landing
    if (s.phase > thunderPhase) { if (thunderPhase > 0) sound(BOSS_CUES.thunder, s, t, null); thunderPhase = s.phase; }   // WB7: thunder over his roar as a phase turns
    if (s.phase > phaseHeard) { if (phaseHeard > 0) { sound(BOSS_CUES.roar, s, t, null); const line = courtPhaseText(s.phase, P.aspect); if (line) say(line); } phaseHeard = s.phase; }   // WBX5: and the turn said, by its name; WB8b: in his aspect's words
    // WB8c: his marks said as I step into his court (never to a court whose Warden has already gone), and a feeding said
    if (!marksSaid) { marksSaid = true; if (P.md && !s.fell && s.wrath == null) { say(COURT_MARKS_TEXT.arrive(P)); marksAt = t; } }   // an unmarked Warden (an older relay's) says nothing new; WB9a: and the card stands from now
    // AUDIT PRE-MERGE 0929 W2-3: a feeding is said while it is news, judged by its age alone - "the first of this
    // entry" stood in for "stale", and a tab hidden through a second feeding said it, and growled, a minute late
    if (s.fed && s.fed.at !== fedHeard) { fedHeard = s.fed.at; if (t - s.fed.at <= FED_LATE_MS) { say(COURT_MARKS_TEXT.fed(bossOf(s).name, s.fed.ns)); sound(BOSS_CUES.growl, s, t, null); } }
    if (s.fell && !fellCued) { fellCued = true; if (t < s.fell.at + FALL_CRY_LATE_MS) sound(BOSS_CUES.fall, s, t, null); }   // AUDIT WB B7: never a cry from long ago
    bodySounds(s, t, A);
  }

  /** WB7: HIS BODY, heard - a step each stride he walks or charges; a growl now and then while he is not striking; a
   *  grunt when a share of his health goes (no closer together than HURT_GAP_MS); his body meeting the floor. */
  function bodySounds(s, t, A) {
    if (s.fell) {
      if (!thudCued && t >= s.fell.at + THUD_AT_MS) { thudCued = true; if (t < s.fell.at + THUD_AT_MS + 1000) sound(BOSS_CUES.thud, s, t, null); }
      return;
    }
    const [x, z] = bossPlace(s, t);
    // AUDIT WBX F9: no step on the stone while a leap carries him through the air - his feet find it again where it lands
    if (bossHop(s, t) > 0) { stepFrom = null; strideRun = 0; }
    else {
      if (stepFrom) {
        strideRun += Math.hypot(x - stepFrom[0], z - stepFrom[1]);
        if (strideRun >= BOSS_STRIDE_M) { strideRun %= BOSS_STRIDE_M; sound(BOSS_CUES.step, s, t, null); }
      }
      stepFrom = [x, z];
    }
    const striking = !!A && t < s.atk.at + Math.max(A.active, 1) + 1500;
    const nextGrowl = () => t + GROWL_EVERY_MS[0] + rng() * (GROWL_EVERY_MS[1] - GROWL_EVERY_MS[0]);
    if (growlAt === null) growlAt = nextGrowl();
    else if (striking) growlAt = Math.max(growlAt, t + 3000);
    else if (t >= growlAt) { sound(BOSS_CUES.growl, s, t, null); growlAt = nextGrowl(); }
    // AUDIT WB D3: the loss is counted from his last grunt, not from the last word - the relay says his health in small
    // steps, and in a big fight no one step was ever a share, so he never grunted at all; a heal (a newcomer's share)
    // starts the count again from where he stands
    if (hpHeard === null || s.hp > hpHeard) hpHeard = s.hp;
    else if (s.max > 0 && hpHeard - s.hp >= s.max * HURT_SHARE && t - gruntAt >= HURT_GAP_MS) { gruntAt = t; hpHeard = s.hp; sound(BOSS_CUES.hurt, s, t, null); }
  }

  /** WB5: THE BURST - SPEW_AT_MS into his fall, this player's spoils leave his chest toward them, off the seed of the
   *  receipt the relay signed for them (net/gateReceipt.js `c`); no receipt by RECEIPT_WAIT_MS, and none is coming - said
   *  once. */
  function burst(s, t) {
    if (!spoils || !s.fell || spewed || t < s.fell.at + SPEW_AT_MS) return;
    const r = link.receipt?.(s.day) ?? null, claims = r ? readReceipt(r) : null;
    if (!claims) {
      if (!spoilsSaid && t >= s.fell.at + RECEIPT_WAIT_MS) { spoilsSaid = true; say(COURT_STRIKE_TEXT.noSpoils(bossOf(s).name)); }
      return;
    }
    spewed = true;
    const [x, z] = bossPlace(s, s.fell.at);
    const at = courtToDungeon(x, profileOf(s).bossH * 0.55, z), f = feet();   // his chest - WB8b: Colossal's stands higher
    const bearing = f ? Math.atan2(f[0] - at[0], f[2] - at[2]) : s.yaw;
    const keep = spoilsKeep(x, z);   // WB9f: on the floor of the court he fell in, never off its edge into the fire
    if (spoils.spew({ day: s.day, seed: claims.c, level: spoilsLevel(player()?.level ?? 1, claims.l), at, bearing, acct: claims.s, keep })) {   // AUDIT WBX S2: never past the level the fight admitted   // AUDIT WB A9: once a receipt - its day and account
      say(COURT_STRIKE_TEXT.spilled(bossOf(s).name));   // WBX3: and said to be theirs
      addBurst(at, t, FX_KINDS.spoils, SPOILS_BURST_COLOR, keep.floorY);   // WB9f: his chest bursts in gold as they leave it
    }
  }

  /** WB9e: THE BURSTS A LANDING THROWS (render/gateFx.js fxBurstOf) - at his feet for his own (the slam, the nova,
   *  Dagon's), where it lands for a leap, a bound or a meteor, under each mark for Hellfire - from its moment on the
   *  relay's clock, in its colour under his profile; a slot reused, the oldest given up past FX_BURSTS_MAX. */
  /** A burst at `p` (the dungeon's frame) from `at0` (the relay's clock) - a slot reused, the oldest given up past
   *  FX_BURSTS_MAX; `floor` the floor's height under it (WB9f: his spoils' gold bursts out of his chest), else its own. */
  function addBurst(p, at0, kind, color, floor = NaN) {
    let b = _bursts.length < FX_BURSTS_MAX ? null : _bursts.reduce((o, q) => (q.at0 < o.at0 ? q : o));
    if (!b) { b = { at: [0, 0, 0], at0: 0, t: 0, kind, color, floor: NaN }; _bursts.push(b); }
    b.at[0] = p[0]; b.at[1] = p[1]; b.at[2] = p[2]; b.at0 = at0; b.kind = kind; b.color = color; b.floor = floor;
  }
  /** WB9f: A PIECE OF HIS SPOILS CAME TO REST (scenes/spoilsPool.js frame's `onRest`): its tier's sparks where it lies,
   *  a Rare-or-better's brighter. Made once, handed every frame. */
  const onSpoilRest = (pos, tier) => {
    const rare = (RARITIES[tier]?.rank ?? 0) >= RARITIES.rare.rank;
    addBurst(pos, now(), rare ? FX_KINDS.spoilRestRare : FX_KINDS.spoilRest, tierColour(tier));
  };
  function burstsOf(atk, A, P) {
    const kind = fxBurstOf(A);
    if (!kind) return;
    const color = attackColor(A, P);
    const add = (x, z) => addBurst(courtToDungeon(x, 0.1, z), atk.at, kind, color);
    if (A.aim === 'self') add(atk.x, atk.z);
    else if (A.aim === 'point') { const p = atk.tg?.[0]; if (p) add(p[0], p[1]); }
    else if (A.aim === 'players') for (const p of atk.tg ?? NONE) add(p[0], p[1]);
  }
  /** WB9e: the frame's live bursts (their sparks still flying) and the meteor's fall, refilled. */
  function fxFrame(s, t, P) {
    _fxLive.length = 0;
    for (const b of _bursts) { b.t = (t - b.at0) / 1000; if (b.t >= 0 && b.t < FX_BURST_MS / 1000) _fxLive.push(b); }
    const mf = s.fell ? null : meteorFall(s.atk, t);
    if (mf) {
      const p = courtToDungeon(mf.at[0], mf.at[1], mf.at[2]);
      _meteor.at[0] = p[0]; _meteor.at[1] = p[1]; _meteor.at[2] = p[2]; _meteor.color = attackColor(ATTACKS.meteor, P);
      meteorNow = _meteor;
    } else meteorNow = null;
  }

  /** WB9c: is `X` (the state's crystals) the Reckoning `r` this screen holds (or ended) - its number and its first spot? */
  const sameCx = (r, X) => !!r && !!X && r.i === X.i && r.x0 === X.c[0][0] && r.z0 === X.c[0][1];

  /** WB9c: A RECKONING'S CRYSTALS, FIRST SEEN - grown from its word (its attack's moment less its wind-up, the relay's
   *  clock) when its attack is the one in flight, else already whole (a screen come in late sees them standing). */
  function crystalsOf(X, s, t) {
    const atk = s.atk, A = atk ? ATTACK_BY_ID[atk.a] : null, mine = A === ATTACKS.reckon && atk.i === X.i;
    const n = Math.min(X.c.length, CRYSTALS_DRAW_MAX);
    const r = { i: X.i, x0: X.c[0][0], z0: X.c[0][1], n, grewAt: mine ? atk.at - windupOf(A, s.phase) : -Infinity, landAt: mine ? atk.at : null, ended: false, endAt: 0,
      feet: [], hp: [], brokeAt: [], flashAt: [], yaw: [], seed: [], targets: [] };
    for (let k = 0; k < n; k++) {
      const q = X.c[k], feet = courtToDungeon(q[0], 0, q[1]);
      const seed = (((X.i * 7919 + k * 104729) % 997) + 997) % 997 / 997;
      r.feet.push(feet);
      r.hp.push(X.m > 0 ? Math.max(0, q[2] / X.m) : 1);
      r.brokeAt.push(q[2] > 0 ? null : -Infinity);   // one broken before this screen saw it: gone, no shards
      r.flashAt.push(-Infinity);
      r.seed.push(seed);
      r.yaw.push(seed * Math.PI * 2);
      r.targets.push({ c: k, feet, height: CRYSTAL_H, radius: CRYSTAL_R, entity: null });
    }
    return r;
  }

  /** WB9c: a crystal broken at `at` (the relay's clock) - its shards fly from then; its crash heard, and who broke it and
   *  how many stand said, while it is news (RECKON_LATE_MS). `spent`: the Reckoning's own landing took it (no name). */
  function breakCrystal(s, k, at, t, who, spent = false) {
    rk.brokeAt[k] = at;
    rk.hp[k] = 0;
    if (!(t - at <= RECKON_LATE_MS)) return;
    sound(BOSS_CUES.crystalBreak, s, t, null, rk.feet[k]);
    if (spent) return;
    sound(BOSS_CUES.crystalRing, s, t, null, rk.feet[k]);
    let left = 0;
    for (let j = 0; j < rk.n; j++) if (rk.brokeAt[j] === null) left++;
    say(COURT_RECKON_TEXT.shattered(who, left));
  }

  /**
   * WB9c: THE CRYSTALS, EACH FRAME - a Reckoning's crystals taken at its word (its call said, each one heard grinding up
   * out of the stone), each one's health from the relay's word, each one broken as the relay says (its shards, its crash,
   * who broke it), and the Reckoning done with - its word gone (broken: the stun; or landed and the relay moved on), its
   * landing seen here, the Wrath or his fall: every crystal still standing bursts - and its shards kept flying out. The
   * stun said and heard once. The targets my blows meet and the draw list refilled.
   */
  function crystals(s, t, P) {
    const X = s.cx;
    if (X && X.c.length && !sameCx(rk, X) && !(rkDone && rkDone.i === X.i && rkDone.x0 === X.c[0][0] && rkDone.z0 === X.c[0][1])) {
      rk = crystalsOf(X, s, t);
      crystalIn ??= crystalStandIn(bossLookOf(s.boss));
      for (const q of rk.targets) q.entity = crystalIn;
      // its call said while it is still to land (news to a fighter come in late through the wind-up too); each crystal
      // heard grinding up out of the stone as it grows, never long after
      let left = 0;
      for (let k = 0; k < rk.n; k++) if (X.c[k][2] > 0) left++;
      if (rk.landAt !== null && t < rk.landAt && left > 0 && !s.fell && s.wrath == null) say(COURT_RECKON_TEXT.call(left));
      if (t - rk.grewAt <= RECKON_LATE_MS && !s.fell && s.wrath == null) for (let k = 0; k < rk.n; k++) sound(BOSS_CUES.crystalRise, s, t, null, rk.feet[k]);
    }
    // THE STUN, said once as it comes (the Reckoning broken - the last crystal's word said just before it)
    if (s.stunAt && s.stunAt !== stunHeard && t < s.stunUntil) {
      stunHeard = s.stunAt;
      if (t - s.stunAt <= RECKON_LATE_MS) { say(COURT_RECKON_TEXT.broken(bossOf(s).name)); sound(BOSS_CUES.stunned, s, t, null); }
    }
    _targets.length = 0;
    _crystalDraw.length = 0;
    if (!rk) return;
    if (!rk.ended) {
      const live = sameCx(rk, X);
      if (live) {
        for (let k = 0; k < rk.n; k++) {
          const h = X.c[k][2];
          rk.hp[k] = X.m > 0 ? Math.max(0, h / X.m) : 0;
          if (rk.brokeAt[k] === null && !(h > 0)) {
            let b = null;
            for (const e of X.broke) if (e.c === k) b = e;
            breakCrystal(s, k, b ? b.at : t, t, b ? b.n : null);
          }
        }
      }
      if (!live || (rk.landAt !== null && t >= rk.landAt) || s.fell || s.wrath != null) {
        rk.ended = true; rk.endAt = t;
        rkDone = { i: rk.i, x0: rk.x0, z0: rk.z0 };
        for (let k = 0; k < rk.n; k++) if (rk.brokeAt[k] === null) breakCrystal(s, k, t, t, null, true);
      }
    }
    if (rk.ended && t - rk.endAt > CRYSTAL_SHATTER_MS + 250) { rk = null; return; }
    const grow = crystalGrowth(t - rk.grewAt);
    // the targets my blows meet: the crystals standing, grown far enough out of the stone
    if (!rk.ended && grow >= CRYSTAL_STRIKE_GROWN) for (let k = 0; k < rk.n; k++) if (rk.brokeAt[k] === null) _targets.push(rk.targets[k]);
    // the draw: each crystal's slot refilled - growing, standing, cracking as its health goes, flashing as I strike it,
    // flying apart once broken; a beam from each one standing into his chest while the Reckoning winds up
    const atk = s.atk, winding = !!atk && ATTACK_BY_ID[atk.a] === ATTACKS.reckon && t < atk.at;
    if (winding) { const [bx, bz] = bossPlace(s, t); _chest[0] = COURT_CENTRE[0] + bx; _chest[1] = COURT_CENTRE[1] + P.bossH * 0.62; _chest[2] = COURT_CENTRE[2] + bz; }
    const color = crystalColor(P);
    for (let k = 0; k < rk.n; k++) {
      const d = (_crystalSlots[k] ??= { at: null, yaw: 0, seed: 0, grow: 0, broke: -1, hp: 1, flash: 0, color: null, beam: null });
      const b = rk.brokeAt[k];
      d.at = rk.feet[k]; d.yaw = rk.yaw[k]; d.seed = rk.seed[k]; d.grow = grow;
      d.broke = b === null ? -1 : Number.isFinite(b) ? Math.max(0, (t - b) / 1000) : Infinity;
      d.hp = rk.hp[k];
      d.flash = Math.max(0, 1 - (t - rk.flashAt[k]) / CRYSTAL_FLASH_MS);
      d.color = color;
      d.beam = winding && b === null ? _chest : null;
      _crystalDraw.push(d);
    }
  }

  function loadBody(s) {
    if (body || loading || !getTexture || !uploadRecordFrame || !renderer?.createBillboardBatch) return;
    const look = bossLookOf(s.boss), basics = ENEMY_BASICS[look.mobile];
    const archive = basics?.maleTexture;
    if (!archive) return;
    loading = Promise.resolve().then(() => getTexture(archive)).then((tex) => {
      body = tex ? { tex, archive, scale: look.scale } : { failed: true };
      if (!tex) console.warn(`[gate] the boss's sprite (archive ${archive}) would not load`);
    }, (e) => { body = { failed: true }; console.warn('[gate] the boss\'s sprite', e?.message ?? e); });
  }

  function drawBody(s, t, P) {
    loadBody(s);
    const act = bossAct(s, t, hurtAt);
    if (!body?.tex || act.act === 'gone') { batchShown = false; return; }
    const [x, z] = bossPlace(s, t);
    const at = courtToDungeon(x, bossHop(s, t), z);   // WBX5: high over the floor through a leap's arc
    const eye = cam() ?? at;
    const fr = bossFrame(act, s.yaw, at, eye, (rec) => body.tex.getFrameCount?.(rec) ?? 1);
    const rkey = `${fr.record}#${fr.frame}`;
    if (!renderer.textures?.has?.(`${body.archive}_${rkey}`)) uploadRecordFrame(body.archive, fr.record, fr.frame);
    const sz = mobileBillboardSize(body.tex, fr.record);   // a shared, cached object: read, never written
    const w = sz.w * body.scale * P.size, h = sz.h * body.scale * P.size;   // WB8b: Colossal stands a quarter larger
    const size = { w: fr.flip ? -w : w, h };
    if (!batch) {
      batch = renderer.createBillboardBatch(body.archive, rkey, { w, h }, [[0, 0, 0]]);
      batch.origin = [0, 0, 0];
    }
    batchShown = true;
    batch.record = rkey;
    batch.size = size;
    if (batch.bounds) batch.bounds[3] = Math.hypot(w, h) * 0.5;   // the cull sphere follows the frame's own size
    batch.origin[0] = at[0]; batch.origin[1] = at[1]; batch.origin[2] = at[2];
  }

  return {
    /** One frame of the court: the verdicts, the voice, the body, the ground's shape and the bar. */
    frame() {
      const s = link.state(), t = now();
      if (!s || s.day === null) { if (day !== null) this.leave(); return; }
      if (s.day !== day) reset(s.day);
      const P = profileOf(s);   // WB8b: the fight's marks, as law - the relay's word of them
      judge(s, t, P);
      judgeTrap(s);   // WBX7: a soul trap of mine on him, rolled at his fall
      burn(s, t, P);   // WBX5: the ground his landings left burning
      cue(s, t, P);
      crystals(s, t, P);   // WB9c: the Reckoning's crystals - seen, struck, broken, drawn
      fxFrame(s, t, P);   // WB9e: the sparks of his landings and the meteor's fall
      drawBody(s, t, P);
      burst(s, t);
      spoils?.frame(onSpoilRest);   // WB9f: each piece's landing sparks
      portalFrame(s, t, Number.isFinite(prevT) ? Math.max(0, t - prevT) / 1000 : 0);   // WBX2: the way home, once he has fallen
      shape = s.fell ? null : telegraphShape(s.atk, s.phase, t, P);
      // WBX4: his mark under him, while he stands; WBX5: the burning ground (WB8b: his aspect's)
      if (_markOf !== P) { _markOf = P; const ember = emberColor(P); markEmber = ember === EMBER_COLOR ? MARK_COLOR : markColorOf(ember); _mark = markShape([0, 0], 0, markEmber, P.bossR); }
      if (s.fell || s.wrath != null || bossAct(s, t, hurtAt).act === 'gone') mark = null;
      else { const [mx, mz] = bossPlace(s, t); _mark.origin[0] = mx; _mark.origin[1] = mz; _mark.yaw = s.yaw; _mark.color = t < s.shieldUntil ? WARD_COLOR : markEmber; _mark.court = nearestCourt(mx, mz); mark = _mark; }   // AUDIT WB D10's law: one shape, refilled; WB9b: over the court he stands in
      poolDraw = pools.length ? poolShapes(pools, t, poolColor(P), TELEGRAPH_STYLE[P.el] ?? TELEGRAPH_STYLE.fire) : NONE;   // WB9e: his ground in its own grain
      drawGateBossBar(bossBarModel(s, t, bossOf(s)), { hidden: hudHidden() });
      // WB9a (Mac: "Allow people to see the modifers/trial as a popup before it starts"): THE MARKS' CARD as I step in -
      // his aspect and his trials, each with its sign, its line and how to meet it, while he stands to be read
      // (net/gateBrain.js OPENING_MS); gone once he has fallen, and never over the step's fire
      if (marksAt !== null && s.fell) marksAt = null;
      drawGateMarksCard(marksAt !== null ? marksCardModel(s.md, bossOf(s), { mode: 'arrive', since: marksAt, now: t }) : null, { hidden: hudHidden() || veiled() });
      // WB9d: his ground under me and his element on me, felt - the screen's rim in its colour, the warning while I stand in it
      drawGateGround(groundViewModel({ inside: inFire, ground: groundName, color: groundColor, biteAt, biteColor, now: t }), { hidden: hudHidden() });
      prevT = t;
    },
    /**
     * WB4b: HIM AS A BODY MY BLOWS MEET, or null (no fight, or he has fallen): his feet in the dungeon's frame, his
     * facing, his height and radius (net/gateBrain.js - the relay measures a melee blow from the same body), whether
     * his ward stands, and his stand-in for the formulas (world/gateBoss.js bossStandIn).
     */
    target() {
      const s = link.state(), t = now();
      // AUDIT WB B6: nor once the Wrath has come - the relay judges no blow after it, and he is no one's to strike
      if (!s || s.day === null || s.fell || s.wrath != null || bossAct(s, t).act === 'gone') return null;
      standIn ??= bossStandIn(bossLookOf(s.boss), bossOf(s).name);
      const [x, z] = bossPlace(s, t), P = profileOf(s);
      return { feet: courtToDungeon(x, 0, z), yaw: s.yaw, height: P.bossH, radius: P.bossR, warded: t < s.shieldUntil, entity: standIn, mobile: bossLookOf(s.boss).mobile };   // WB8b: his profile's body - the relay measures a blow from the same
    },
    /**
     * WB4b: A BLOW OF MINE MET HIM - `d` the formula's number on this machine, `r` its kind (net/gateBrain.js
     * HIT_KINDS). Out to the relay as the wire's hit (whole points, a sequence of its own), and he flinches. The ward
     * turns it (nothing sent - the relay would refuse it); a blow under one point is none. Answers whether it went.
     */
    hit({ d, r }) {
      const s = link.state(), t = now();
      if (!s || s.day === null || s.fell || s.wrath != null || !Object.values(HIT_KINDS).includes(r)) return false;   // AUDIT WB B6
      if (t < s.shieldUntil) return false;
      const dmg = Math.round(d);
      if (!(dmg >= 1)) return false;
      hurtAt = t;
      return !!send({ q: ++blowSeq, d: dmg, r });
    },
    /** A blow of mine landed on him: he flinches. */
    struck() { hurtAt = now(); },
    /**
     * WB9c: THE CRYSTALS OF OBLIVION AS BODIES MY BLOWS MEET - each standing one's number (the wire's `c`), its foot in the
     * dungeon's frame, its body (net/gateBrain.js CRYSTAL_R, CRYSTAL_H - the relay measures a melee blow to the same) and
     * the stand-in a blow on it is computed against (world/gateBoss.js crystalStandIn); none outside a Reckoning, and
     * none still low in the stone. One list, refilled each frame (AUDIT WB D10's law) - read, never written.
     */
    crystalTargets() {
      const s = link.state();
      return !s || s.day === null || s.fell || s.wrath != null ? NONE : _targets;
    },
    /**
     * WB9c: A BLOW OF MINE MET A CRYSTAL - `c` its number, `d` the formula's number on this machine, `r` its kind. It
     * flashes and rings here at once, and the number goes out as the wire's `xhit` (whole points, my blows' own
     * sequence); the relay's caps decide what lands and say its health back. A blow under one point is none. Answers
     * whether it went.
     */
    crystalHit({ c, d, r } = /** @type {any} */ ({})) {
      const s = link.state(), t = now();
      if (!s || s.day === null || s.fell || s.wrath != null || !rk || rk.ended || !Object.values(HIT_KINDS).includes(r)) return false;
      if (!Number.isInteger(c) || c < 0 || c >= rk.n || rk.brokeAt[c] !== null) return false;
      const dmg = Math.round(d);
      if (!(dmg >= 1)) return false;
      rk.flashAt[c] = t;
      sound(BOSS_CUES.crystalHit, s, t, null, rk.feet[c]);
      return !!sendCrystal({ c, q: ++blowSeq, d: dmg, r });
    },
    /**
     * WBX7: A SOUL TRAP OF MINE LAID ON HIM (the dungeon context's spell door - scenes/dungeonContext.js spellOnBoss): its
     * chance and its rounds, kept on the relay's clock until his fall rolls it. A trap already running takes the new
     * rounds and keeps its own chance (AddState, SoulTrap.cs:94-97 - systems/effects.js's own law). Answers whether it
     * was kept (no fight, a fight over: nothing to keep it for).
     * @param {{ chance?: number, rounds?: number }} [trap]
     */
    trapped({ chance, rounds } = {}) {
      const s = link.state(), t = now();
      if (!s || s.day === null || s.fell || s.wrath != null || !Number.isFinite(chance) || !(rounds > 0)) return false;
      if (trapMark && t < trapMark.until) trapMark.until += rounds * COURT_ROUND_MS;
      else trapMark = { chance, until: t + rounds * COURT_ROUND_MS, day: s.day };
      return true;
    },
    /** AUDIT WBX F6: my soul trap on him while it runs (`{chance}`), or null - a recast stacks onto it as it would on any
     *  foe (effects.js AddState: its rounds, no new save), where his stand-in forgets every trap between casts. */
    trapNow() { const t = now(); return trapMark && t < trapMark.until ? { chance: trapMark.chance } : null; },
    /** The body and the spoils, for the host's billboard pass (AUDIT WB D10: one list, refilled each frame). */
    batches() {
      _batches.length = 0;
      if (batch && batchShown) _batches.push(batch);
      for (const b of spoils?.batches() ?? NONE) _batches.push(b);
      return _batches;
    },
    /** The glow on him and on the spoils, for the court's light channel (world/gateArena.js withCourtLights). */
    lights() {
      const s = link.state(), t = now(); const g = s && s.day !== null ? bossGlow(s, t) : null;
      _lights.length = 0;
      if (g) _lights.push(g);
      // WB9c: each crystal standing lights the floor about it, breathing - one light a crystal, refilled
      for (let k = 0; k < _crystalDraw.length; k++) {
        const d = _crystalDraw[k];
        if (!(d.broke < 0) || !(d.grow > 0.05)) continue;
        const L = (_crystalLights[k] ??= { x: 0, y: 0, z: 0, range: CRYSTAL_LIGHT_RANGE, color: [0, 0, 0] });
        const kk = d.grow * (0.55 + 0.45 * d.hp) * (1.1 + 0.25 * Math.sin(t / 240 + d.seed * 6) + 0.8 * d.flash);
        L.x = d.at[0]; L.y = d.at[1] + CRYSTAL_LIGHT_Y; L.z = d.at[2];
        L.color[0] = d.color[0] * kk; L.color[1] = d.color[1] * kk; L.color[2] = d.color[2] * kk;
        _lights.push(L);
      }
      for (const l of spoils?.lights() ?? NONE) _lights.push(l);
      return _lights;
    },
    /** The telegraph and the spoils' glow, in the host's world pass (after the court and the billboards, before the
     *  foes' screen quads). Answers whether either drew (the host marks the foreign pass). */
    drawPass(proj, view, eye, seconds, fog = null) {
      let drew = false;
      if (_crystalDraw.length) {   // WB9c: the crystals first - opaque, their depth written, so his ground's glow sits behind them
        if (!crystalTried && gl) { crystalTried = true; try { crystalPass = new CourtCrystalRenderer(gl); } catch (e) { console.warn('[gate] the crystals would not build', e?.message ?? e); crystalPass = null; } }
        if (crystalPass) { crystalPass.draw(_crystalDraw, proj, view, eye, seconds, fog); drew = drew || crystalPass.drawn > 0; }
      }
      if (pass) {
        for (const ps of poolDraw) { pass.draw(ps, proj, view, eye, seconds, fog); drew = true; }   // WBX5: the burning ground under all
        if (mark) { pass.draw(mark, proj, view, eye, seconds, fog); drew = true; }   // WBX4: where he stands and faces
        if (shape) { pass.draw(shape, proj, view, eye, seconds, fog); drew = true; }
      }
      if (_fxLive.length || meteorNow) {   // WB9e: his blows landing - the sparks and the meteor's fall, over the telegraph
        if (!fxTried && gl) { fxTried = true; try { fxPass = new GateFxRenderer(gl); } catch (e) { console.warn('[gate] his effects would not build', e?.message ?? e); fxPass = null; } }
        if (fxPass) { fxPass.draw(_fxLive, meteorNow, proj, view, eye, seconds, fog); drew = drew || fxPass.bursts > 0 || fxPass.meteors > 0; }
      }
      if (portal && portalPass) {   // WBX2: the portal home's fire and its beacon, rising where he fell
        portalPass.draw([{ origin: portal.origin, yaw: 0, open: 1, fade: portal.rise, spin }], proj, view, eye, seconds, fog);
        drew = drew || portalPass.drawn > 0;
      }
      const lit = !!spoils?.drawPass(proj, view, eye, seconds, fog);
      return drew || lit;
    },
    /** What the driver holds, for the tests and the stats. */
    state: () => ({
      day, judgedI: judged.i, cuedI: cued.i, landedI: landed.i, phaseHeard, fellCued, wrathLanded, body: !!body?.tex, batch: !!batch && batchShown, shape, mark, pools: pools.map((p) => ({ ...p })), portal: portal ? { at: [...portal.at], rise: portal.rise, laid: portalLaid } : null,
      // WB9c: the crystals as this screen holds them; WB9d: the ground I stand in and the last bite's moment
      crystals: rk ? { i: rk.i, n: rk.n, ended: rk.ended, brokeAt: [...rk.brokeAt], hp: [...rk.hp], grewAt: rk.grewAt } : null, drawn: _crystalDraw.map((d) => ({ ...d })), inFire, biteAt,
      // WB9e: the sparks flying and the meteor falling
      bursts: _fxLive.map((b) => ({ at: [...b.at], t: b.t, kind: b.kind, color: b.color })), meteor: meteorNow ? { at: [...meteorNow.at] } : null,
    }),
    /** WBX2: the portal home, while it stands - where (the court's frame) and how far it has risen - or null. */
    portal: () => (portal ? { at: [...portal.at], rise: portal.rise } : null),
    /** Out of the court: the body put away, the bar hidden, the fight forgotten (the texture is kept - the next court wears it). */
    leave() {
      spoils?.gather();   // WB5: whatever is still on the floor goes into the pack - never lost to a door, a death or the day's end
      if (batch) { renderer?.destroyBillboardBatch?.(batch); batch = null; batchShown = false; }
      drawGateBossBar(null);
      drawGateMarksCard(null);   // WB9a
      drawGateGround(null);   // WB9d
      reset(null);
    },
  };
}
