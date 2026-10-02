// @ts-check
// ARENA2 (2026-10-02, Mac: "Players can choose to watch AI fights ... and climb esclating tiers of opponents"; "During
// fights, the crowd is present and can cheer/boo you"; "extremely detailed and authentic"): THE BOUT ON THIS SCREEN -
// the bout law (systems/arenaBout.js) driven over real bodies, its crowd (systems/arenaCrowd.js) seen and heard, its
// HUD (ui/arenaHud.js), its music (systems/arenaScore.js), its Herald. Design: bible/11-Multiplayer/Arena.md "2. The
// fights", "4. The crowd".
//
// ONE DRIVER, TWO FLOORS. A bout stands on a STAGE the host hands in (`setStage`): the CITY's floor (the colosseum in
// Daggerfall's cell 4,3 - scenes/world.js, the exterior's own foe pool) for an exhibition on the hour, or the floor's
// INSTANCE (world/arenaFloor.js - the dungeon arm's own pool, scenes/worldModes.js) for a ladder bout or an exhibition
// watched from the stands. A stage is `{ kind, centre(), spawn(mobile, feet, o), remove(foe), heightAt(x, z) }` in its
// host's frame; the driver never asks which host it is in. A stage that goes (the door taken, the city left) takes its
// bout with it, unsaid.
//
// THE FIGHTERS are Daggerfall's own class enemies and monsters (`spawn` - the exterior's spawnFoe `loose`, `transient`,
// `managed`, no loot, no champion, at the tier's level; the dungeon's spawnLooseFoe at its level), each carrying its
// BOUT TAG on its entity (`entity.bout` - `{ id, side, out, hold, hooks }`): the targeting law's bout team
// (characters/enemyTargets.js boutGate) keeps them to each other, and the pools' damage doors hold them at the foe yield
// floor and tell the driver every blow (`hooks.hurt`), the floor (`hooks.floor`) and a blow from outside the bout
// (`hooks.intrude`). The player fights as `you` (setPlayerBout), held at the 1 HP floor by `playerSpare`, and yields by
// sheathing the blade at the yield line.
//
// Not a DFU member. Ledger A (ARENA).

import {
  newBout, boutTick, boutHit, boutFell, boutYield, boutPos, boutHealth, boutAtMarks, takeBoutEvents, boutLive, boutOver, boutFighter,
  fighterShare, boutPurse, sideNames, otherNames, YIELD_SHARE,
} from '../systems/arenaBout.js';
import { newCrowd, crowdHear, crowdTick, crowdBark, crowdCount, crowdFlipFps, crowdHop, verdictThrows, seatPeople, THROWN_FLOWERS, THROWN_REFUSE } from '../systems/arenaCrowd.js';
import { fighterIdentity, boutMarks } from '../systems/arenaFighters.js';
import { EXHIBITION_PURSE, ladderAfter, arenaLadderRestore, arenaHash, seededRng } from '../systems/arenaLadder.js';
import { ARENA_TEXT } from '../systems/arenaText.js';
import { arenaScoreFor } from '../systems/arenaScore.js';
import { crowdSeats, pickSeats, RING_R } from '../world/arenaFloor.js';
import { arenaHudModel } from '../ui/arenaHud.js';

/** A blow of this share of the struck's whole health is the crowd's "crit" - a telling blow (the critical-strike roll
 *  is the formula's, not the damage door's: the door hears only the damage). */
export const CRIT_SHARE = 0.15;
/** An AI fighter's id; the player's. */
export const YOU = 'you';
/** How long after the healers the fighters stand before they leave the sand, ms; how long the crowd stays after. */
export const LEAVE_AFTER_MS = 2500;
export const CROWD_STAYS_MS = 25_000;
/** The crowd near: full within this of the floor's centre, nothing past FAR (metres) - the city's bout heard from the
 *  market, not from the far gate. */
export const NEAR_M = 40;
export const FAR_M = 140;
/** A crowd's shout stands under its meter this long, ms. */
export const BARK_SHOWN_MS = 2400;
/** A thrown flat's flight from the stands to the sand, ms. */
export const THROW_MS = 900;

/**
 * @param {{
 *   now?: () => number, rng?: () => number,
 *   playerEntity: any, setPlayerBout?: (b: any) => void,
 *   say?: (line: string) => void, bark?: (line: string) => void, notice?: (lines: string[]) => void,
 *   sound?: { cue: (list: any[], near?: number) => void, bed: (mood: number, near?: number) => void, stop: () => void } | null,
 *   drawHud?: (model: any, o?: any) => void,
 *   renderer?: any, getTexture?: (archive: number) => Promise<any>, uploadRecordFrame?: (a: number, r: number, f: number) => void,
 *   pay?: (gold: number) => void, heal?: () => void, crime?: () => void, ladderChanged?: (ladder: any, out: any) => void,
 * }} deps
 */
export function createArenaBouts(deps) {
  const now = deps.now ?? (() => performance.now());
  const rng = deps.rng ?? Math.random;
  const P = deps.playerEntity;
  let stage = null;
  /** The bout standing: `{ b, crowd, kind, stage, fighters: Map<id, foe>, tags: Map<id, tag>, you, purse, next, ... }` */
  let cur = null;
  /** A bout asked for before its stage stood (the Herald's choice, the instance still building). */
  let pending = null;
  let intrusions = 0;

  // ── THE STAGE ───────────────────────────────────────────────────────────────────────────────────────────
  /** The host's floor now (or null): a new stage takes no bout of the old one's - the old one is gone, unsaid. */
  function setStage(s) {
    if (s === stage) return;
    if (cur && cur.stage !== s) dismiss();
    stage = s ?? null;
    if (stage && pending && pending.where === stage.kind) { const p = pending; pending = null; start(p); }
  }
  /** A bout asked for on a stage of `where` ('city' | 'floor'), started when it stands. */
  function ask(p) { pending = p; if (stage && stage.kind === p.where) { pending = null; start(p); } }

  // ── A BOUT ──────────────────────────────────────────────────────────────────────────────────────────────
  const floorFeet = (xz) => { const c = stage.centre(); return [c[0] + xz[0], c[1], c[2] + xz[1]]; };
  const yawTo = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);

  /**
   * START: an exhibition (`{ kind: 'exhibition', ex }` - systems/arenaLadder.js exhibitionFor) or a ladder bout
   * (`{ kind: 'ladder', next }` - nextLadderBout, the player on side 0). The fighters' names from the bout's seed, their
   * marks on the sand, their tags; the law's bout and the crowd.
   */
  function start(p) {
    if (!stage) return null;
    dismiss();
    const t = now();
    const ladder = p.kind === 'ladder';
    const seed = ladder ? arenaHash(Math.floor(t) & 0x7fffffff, 7) : p.ex.seed;
    const opps = ladder ? p.next.opponents : p.ex.opponents;
    const free = ladder && !!p.next.free;
    const id = ladder ? `ladder:${p.next.tier}:${p.next.bout}:${seed}` : `ex:${p.ex.hour}`;
    // the sides: an exhibition's two, a ladder bout's player against the rest (a Grand Melee every fighter its own)
    const specs = opps.map((o, i) => ({ ...o, i, side: free ? i + 1 : ladder ? 1 : i }));
    const sides = free ? specs.length + 1 : 2;
    const perSide = Array(sides).fill(0);
    if (ladder) perSide[0] = 1;
    for (const s of specs) perSide[s.side]++;
    const marks = boutMarks(sides, perSide);
    const used = Array(sides).fill(0);
    if (ladder) used[0] = 1;
    const fighters = [];
    const tags = new Map();
    const hooks = (fid) => ({
      hurt: (foe, dmg, o) => hurtFoe(fid, foe, dmg, o),
      floor: (foe) => floorFoe(fid, foe),
      intrude: (foe) => intrude(fid, foe),
    });
    for (const s of specs) {
      const fid = `f${s.i}`;
      const who = fighterIdentity(seed, s.i, s.mobile);
      const mark = marks[s.side][used[s.side]++];
      tags.set(fid, { id, side: s.side, out: false, hold: true, hooks: hooks(fid) });
      fighters.push({ id: fid, name: who.name, side: s.side, maxHealth: 1, temper: who.temper, ai: true, home: who.home, epithet: who.epithet, spec: s, who, mark });
    }
    if (ladder) fighters.unshift({ id: YOU, name: P?.name || 'You', side: 0, maxHealth: Math.max(1, P?.maxHealth | 0), health: Math.max(1, P?.health | 0), temper: 0, ai: false, home: '', mark: marks[0][0] });
    cur = {
      kind: p.kind, id, seed, stage, ladder, next: ladder ? p.next : null, ex: ladder ? null : p.ex, fighters: new Map(), tags, marks,
      roster: fighters, b: null, crowd: null, you: ladder ? YOU : null, playerTag: ladder ? { id, side: 0, out: false, hold: true } : null,
      lastHealth: P?.health ?? 0, lastSheathed: null, verdictAt: NaN, doneAt: NaN, paid: false, said: false, crowdSeats: null,
      crowdBatches: [], throws: [], spawning: 0, title: false, startedAt: t, bark: '', barkAt: -Infinity, ringed: null,
    };
    if (ladder) deps.setPlayerBout?.(cur.playerTag);
    // the fighters stand at their marks, facing the middle; the law starts once every body stands
    const C = cur;
    for (const f of fighters) {
      if (!f.ai) continue;
      const feet = floorFeet(f.mark);
      C.spawning++;
      Promise.resolve(stage.spawn(f.spec.mobile, feet, { level: f.spec.level, gender: f.who.gender, yaw: yawTo(f.mark, [0, 0]), bout: tags.get(f.id) }))
        .then((foe) => {
          C.spawning--;
          if (cur !== C || !foe) { if (foe) stage?.remove?.(foe); if (cur === C && !foe) dismiss(); return; }
          C.fighters.set(f.id, foe);
          if (foe.entity) { foe.entity.bout = tags.get(f.id); foe.entity.items = []; }
          f.maxHealth = Math.max(1, foe.entity?.maxHealth ?? foe.entity?.health ?? 1);
          f.health = Math.max(1, foe.entity?.health ?? f.maxHealth);
          if (foe.ai) { foe.ai.isHostile = !!C.ladder; foe.ai.target = null; foe.ai.yaw = yawTo(f.mark, [0, 0]); }
          if (C.spawning === 0) beginLaw(C);
        })
        .catch(() => { C.spawning--; if (cur === C) dismiss(); });
    }
    return cur;
  }

  /** Every body stands: the law's bout, the crowd's, the seats. */
  function beginLaw(C) {
    const t = now();
    const c = stage.centre();
    C.b = newBout({
      id: C.id, kind: C.ladder ? (C.next.grand ? 'grand' : C.next.champion ? 'champion' : C.next.free ? 'melee' : 'ladder') : 'exhibition',
      fighters: C.roster.map((f) => ({ id: f.id, name: f.name, side: f.side, maxHealth: f.maxHealth, health: f.health, temper: f.temper, ai: f.ai, home: f.home, epithet: f.epithet })),
      ring: { centre: [c[0], c[2]], radius: RING_R }, now: t, tier: C.ladder ? C.next.tier : C.ex.tier, label: C.ladder ? C.next.label : '',
    });
    C.crowd = newCrowd({ fighters: C.roster.map((f) => ({ id: f.id, home: f.home, ai: f.ai })), beasts: C.ladder ? !!C.next.beasts : !!C.ex.beasts });
    buildCrowd(C);
  }

  // ── THE BODIES' DOORS (the pools' bout hooks) ───────────────────────────────────────────────────────────
  function hurtFoe(fid, foe, dmg, { fromPlayer = false, striker = null } = {}) {
    const C = cur;
    if (!C?.b) return;
    const t = now();
    if (!boutLive(C.b)) {
      // a blow before the word or after the verdict: the body is made whole again (the healers' law), nothing counts
      if (foe?.entity) foe.entity.health = Math.min(foe.entity.maxHealth ?? foe.entity.health, foe.entity.health + dmg);
      return;
    }
    const from = fromPlayer ? (C.ladder ? YOU : null) : idOf(C, striker);
    if (!from) { boutHealth(C.b, fid, foe?.entity?.health ?? 0); return; }
    const f = boutFighter(C.b, fid);
    boutHit(C.b, { from, to: fid, dmg, health: foe?.entity?.health, crit: !!f && dmg >= f.maxHealth * CRIT_SHARE, now: t });
  }
  function floorFoe(fid, foe) {
    const C = cur;
    if (!C?.b) return;
    if (!boutLive(C.b)) { if (foe?.entity) foe.entity.health = Math.max(foe.entity.health, 1); return; }
    boutFell(C.b, fid, now());
    standDown(foe);
  }
  /** A blow from outside the bout: before the word (the player's own opponent), a word from the Herald; an exhibition
   *  fighter struck from the stands, a warning and then the watch. */
  function intrude(fid, foe) {
    const C = cur;
    if (!C) return;
    if (C.ladder && C.b && !boutLive(C.b) && !boutOver(C.b)) { deps.say?.(ARENA_TEXT.herald.waitWord); return; }
    if (C.ladder) return;
    intrusions++;
    if (intrusions === 1) deps.say?.(ARENA_TEXT.herald.intrude);
    else { deps.say?.(ARENA_TEXT.herald.intrudeCrime); deps.crime?.(); }
  }
  const idOf = (C, foe) => { if (!foe) return null; for (const [id, f] of C.fighters) if (f === foe) return id; return null; };
  /** A fighter out of the bout stands down: no target, nobody's target (its tag is out), no hostility. */
  function standDown(foe) {
    if (!foe) return;
    if (foe.entity?.bout) foe.entity.bout.out = true;
    if (foe.ai) { foe.ai.target = null; foe.ai.secondaryTarget = null; foe.ai.isHostile = false; }
  }

  // ── THE PLAYER'S DOORS ──────────────────────────────────────────────────────────────────────────────────
  /** The `spare` the host's damage doors pass while I fight a live bout: the blow that would kill leaves me at 1 and
   *  I am down (playerEntity.hurtPlayer's own law, the duel's). Null outside one. */
  function playerSpare() {
    const C = cur;
    if (!C?.ladder || !C.b || C.b.phase !== 'fight' || C.playerTag?.out) return null;
    return { spare: () => { if (cur === C && C.b && boutLive(C.b)) { boutFell(C.b, YOU, now()); } } };
  }
  /** My own bout stands (its call to its healers): the duel's law - no door, no rest, no travel. */
  const holds = () => !!cur?.ladder && !!cur.b && cur.b.phase !== 'done';

  // ── THE FRAME ───────────────────────────────────────────────────────────────────────────────────────────
  /**
   * One frame: the bodies read into the law (their health, their feet, my blows taken, my sheathing), the law's clock,
   * its events heard (the crowd, the Herald, the sound), the HUD drawn, the crowd's people moved. `o.playerFeet` my feet
   * in the stage's frame, `o.sheathed` my weapon put away, `o.stamina` my fatigue's share, `o.hidden` the HUD hidden.
   */
  function frame(dt, o = {}) {
    const C = cur;
    const t = now();
    if (!C || !C.b) { deps.drawHud?.(null, { hidden: true }); return; }
    const c = stage?.centre?.() ?? null;
    const near = c && o.playerFeet ? nearOf(Math.hypot(o.playerFeet[0] - c[0], o.playerFeet[2] - c[2])) : (C.stage?.kind === 'floor' ? 1 : 0);
    // the bodies into the law
    for (const [fid, foe] of C.fighters) {
      const tag = C.tags.get(fid);
      if (foe.dead) { if (boutLive(C.b)) boutFell(C.b, fid, t); continue; }
      if (foe.ai?.feet) boutPos(C.b, fid, [foe.ai.feet[0], foe.ai.feet[2]]);
      if (tag) tag.hold = !boutLive(C.b);
    }
    if (C.playerTag) C.playerTag.hold = !boutLive(C.b);
    if (C.ladder && P) {
      // my health: a fall in it is a blow at me from the opponent nearest me who has me as their target
      const h = P.health ?? 0;
      if (boutLive(C.b) && h < C.lastHealth) {
        const from = attackerOfMe(C, o.playerFeet);
        if (from) boutHit(C.b, { from, to: YOU, dmg: C.lastHealth - h, health: h, crit: (C.lastHealth - h) >= (P.maxHealth || 1) * CRIT_SHARE, now: t });
        else boutHealth(C.b, YOU, h);
      } else if (h !== C.lastHealth) boutHealth(C.b, YOU, h);
      C.lastHealth = h;
      if (o.playerFeet) boutPos(C.b, YOU, [o.playerFeet[0], o.playerFeet[2]]);
      // THE YIELD: the blade sheathed at the line (drawn again first: a sheathe from before the line is no yield)
      const you = boutFighter(C.b, YOU);
      if (o.sheathed != null) {
        if (C.lastSheathed === false && o.sheathed === true && boutLive(C.b) && you && !you.out) {
          const no = boutYield(C.b, YOU, t);
          if (no === 'early' && fighterShare(you) > YIELD_SHARE) deps.say?.(ARENA_TEXT.refuse.yieldEarly);
        }
        C.lastSheathed = !!o.sheathed;
      }
    }
    boutTick(C.b, t, rng);
    for (const e of takeBoutEvents(C.b)) hear(C, e, t, near);
    // the word given (or the verdict said) this frame: the bout team's hold follows it now, not a frame late
    for (const tag of C.tags.values()) tag.hold = !boutLive(C.b);
    if (C.playerTag) C.playerTag.hold = !boutLive(C.b);
    crowdTick(C.crowd, dt);
    deps.sound?.bed(C.crowd.mood, near);
    // the fighters out of the bout stand down; at the end everyone does
    for (const f of C.b.fighters) {
      const foe = C.fighters.get(f.id);
      if (foe && (f.out || boutOver(C.b))) { standDown(foe); if (C.tags.get(f.id)) C.tags.get(f.id).out = !!f.out || boutOver(C.b); }
    }
    if (C.playerTag && (boutOver(C.b) || boutFighter(C.b, YOU)?.out)) C.playerTag.out = true;
    // the healers, then off the sand
    if (C.b.phase === 'done' && !Number.isFinite(C.doneAt)) C.doneAt = t;
    if (Number.isFinite(C.doneAt) && t - C.doneAt >= LEAVE_AFTER_MS && C.fighters.size) {
      for (const foe of C.fighters.values()) stage?.remove?.(foe);
      C.fighters.clear();
      deps.setPlayerBout?.(null);
    }
    if (Number.isFinite(C.doneAt) && t - C.doneAt >= CROWD_STAYS_MS && C.stage?.kind === 'city') { dismiss(); return; }
    const bark = t - C.barkAt < BARK_SHOWN_MS ? C.bark : '';
    deps.drawHud?.(near > 0 ? arenaHudModel(C.b, C.crowd, t, { you: C.you, stamina: o.stamina ?? null, bark }) : null, { hidden: !!o.hidden, touch: !!o.touch });
    crowdFrame(C, t);
  }
  const nearOf = (d) => (d <= NEAR_M ? 1 : d >= FAR_M ? 0 : 1 - (d - NEAR_M) / (FAR_M - NEAR_M));
  /** The opponent striking me: of those whose target is a player, the nearest. */
  function attackerOfMe(C, feet) {
    let best = null, bd = Infinity;
    for (const [fid, foe] of C.fighters) {
      const f = boutFighter(C.b, fid);
      if (!f || f.out || f.side === 0 || !foe.ai?.feet) continue;
      const tgt = foe.ai.target;
      const d = feet ? Math.hypot(foe.ai.feet[0] - feet[0], foe.ai.feet[2] - feet[2]) : 0;
      const k = (tgt && tgt.isPlayer ? 0 : 50) + d;
      if (k < bd) { bd = k; best = fid; }
    }
    return best;
  }

  /** AN EVENT HEARD: the crowd moved and heard, a bark, the Herald's words, the verdict's purse and the healers. */
  function hear(C, e, t, near) {
    const title = C.ladder && C.next.champion && C.b.result?.side === 0;
    const cues = crowdHear(C.crowd, e, { share: (id) => { const f = boutFighter(C.b, id); return f ? fighterShare(f) : 1; }, title, now: t });
    deps.sound?.cue(cues, near);
    if (near > 0.3) { const line = crowdBark(C.crowd, e, t, rng); if (line) { C.bark = line; C.barkAt = t; deps.bark?.(line); } }
    const say = (line) => { if (near > 0.3) deps.say?.(line); };
    switch (e.k) {
      case 'call':
        say(C.ladder ? (C.next.grand ? ARENA_TEXT.call.grand : C.next.champion ? ARENA_TEXT.call.champion(C.next.tierName) : C.next.free ? ARENA_TEXT.call.melee : ARENA_TEXT.call.ladder(C.next.tierName, C.next.label)) : ARENA_TEXT.call.exhibition);
        break;
      case 'crier': { const f = boutFighter(C.b, e.a); if (f) say(f.ai ? ARENA_TEXT.call.fighter(`${f.name}, ${f.epithet || ''}`.replace(/, $/, ''), f.home) : ARENA_TEXT.call.fighter(f.name, '')); break; }
      case 'walk': say(ARENA_TEXT.call.marks); for (const f of C.b.fighters) boutAtMarks(C.b, f.id, t); break;   // every fighter stood on their mark at the spawn
      case 'count': say(ARENA_TEXT.count[3 - (e.n ?? 3)]); break;
      case 'fight': say(ARENA_TEXT.count[3]); break;
      case 'verdict': verdict(C, t); break;
      case 'heal': heal(C); break;
      default: break;
    }
  }

  /** THE VERDICT: the Herald's words, the purse, the ladder's step. */
  function verdict(C, t) {
    const r = C.b.result;
    C.verdictAt = t;
    if (!r) return;
    const V = ARENA_TEXT.verdict;
    const w = r.side === null ? '' : sideNames(C.b, r.side), l = r.side === null ? '' : otherNames(C.b, r.side);
    const line = r.side === null ? V.draw : r.how === 'judges' ? V.judges(w) : r.how === 'yield' ? V.yield(w, l) : r.how === 'ringout' ? V.ringout(w, l) : V.fall(w, l);
    deps.say?.(line);
    // the crowd's throw: flowers for a winner it liked, refuse for one it did not
    const throws = verdictThrows(C.crowd, r.winners, r.losers);
    throwAt(C, r.winners, throws.flowers, THROWN_FLOWERS);
    throwAt(C, [...r.losers, ...r.winners], throws.refuse, THROWN_REFUSE);
    if (C.ladder) {
      const won = r.side === 0;
      const purse = won ? boutPurse(C.next.purse, C.crowd.favour[YOU] ?? 0) : 0;
      if (won && purse > 0 && !C.paid) { C.paid = true; deps.pay?.(purse); }
      const fav = C.crowd.favour[YOU] ?? 0;
      const pline = !won ? ARENA_TEXT.purse.lost : fav >= 0.25 ? ARENA_TEXT.purse.favoured(purse) : fav <= -0.25 ? ARENA_TEXT.purse.hated(purse) : ARENA_TEXT.purse.won(purse);
      const before = arenaLadderRestore(P?.arenaLadder);
      const out = ladderAfter(before, { won, how: r.side === null ? 'draw' : (boutFighter(C.b, YOU)?.out ?? r.how), purse });
      if (P) P.arenaLadder = out.ladder;
      const lines = [line, pline];
      if (out.grand) lines.push(V.grand(P?.name || 'You'));
      else if (out.title) lines.push(V.tier(P?.name || 'You', ARENA_TEXT.tiers[C.next.tier]));
      if (out.tierUp) lines.push(ARENA_TEXT.ladder.tierUp(ARENA_TEXT.tiers[out.ladder.tier]));
      else if (won && !C.next.champion) lines.push(out.ladder.won >= 3 ? ARENA_TEXT.ladder.champOpen(ARENA_TEXT.tiers[out.ladder.tier]) : ARENA_TEXT.ladder.boutWon(out.ladder.won));
      deps.ladderChanged?.(out.ladder, out);
      deps.notice?.(lines);
    } else if (r.side !== null) { C.bark = ARENA_TEXT.purse.won(EXHIBITION_PURSE); C.barkAt = t; }
  }
  /** THE HEALERS: everyone whole (the duel's own heal, the host's), the fighters' bodies too. */
  function heal(C) {
    if (C.ladder) { deps.heal?.(); deps.say?.(ARENA_TEXT.healed); C.lastHealth = P?.health ?? C.lastHealth; }
    for (const foe of C.fighters.values()) if (foe.entity) foe.entity.health = foe.entity.maxHealth ?? foe.entity.health;
  }

  // ── THE CROWD, SEEN ─────────────────────────────────────────────────────────────────────────────────────
  /** The tiers' people: the seats sought on the stage's ground, as many as the bout draws, batched by picture (two
   *  batches a picture, so the tiers' hop is not one plank). In the floor's frame; drawn about its centre. */
  async function buildCrowd(C) {
    const r = deps.renderer;
    if (!r?.createBillboardBatch || !deps.getTexture || !stage?.heightAt) return;
    const c = stage.centre();
    const seats = crowdSeats((x, z) => { const h = stage.heightAt(c[0] + x, c[2] + z); return Number.isFinite(h) ? h - c[1] : null; });
    const n = crowdCount({ kind: C.ladder ? 'ladder' : 'exhibition', tier: C.ladder ? C.next.tier : C.ex.tier, champion: C.ladder && C.next.champion, grand: C.ladder && C.next.grand });
    const sat = seatPeople(pickSeats(seats, n, seededRng(arenaHash(C.seed, 3))), seededRng(arenaHash(C.seed, 4)));
    const groups = new Map();
    for (const s of sat) {
      const k = `${s.archive}:${s.record}:${s.phase < 0.5 ? 0 : 1}`;
      if (!groups.has(k)) groups.set(k, { archive: s.archive, record: s.record, half: s.phase < 0.5 ? 0 : 1, at: [] });
      groups.get(k).at.push([s.x, s.y, s.z]);
    }
    const batches = [];
    for (const g of groups.values()) {
      let tex;
      try { tex = await deps.getTexture(g.archive); } catch { continue; }
      if (cur !== C) return;
      const size = sizeOf(tex, g.record);
      const frames = Math.max(1, tex?.getFrameCount?.(g.record) ?? 1);
      const batch = r.createBillboardBatch(g.archive, g.record, size, g.at);
      batches.push({ batch, archive: g.archive, record: g.record, frames, half: g.half, origin: [0, 0, 0], size, uploaded: new Set() });
    }
    if (cur !== C) { for (const x of batches) r.destroyBillboardBatch?.(x.batch); return; }
    C.crowdBatches = batches;
  }
  const sizeOf = (tex, record) => {
    try { const s = tex.getSize(record), k = tex.getScale(record); return { w: (s.width + Math.trunc(s.width * (k.width / 256))) * 0.025, h: (s.height + Math.trunc(s.height * (k.height / 256))) * 0.025 }; } catch { return { w: 1.1, h: 1.95 }; }
  };
  function crowdFrame(C, t) {
    if (!C.crowdBatches.length || !stage) return;
    const c = stage.centre();
    const fps = crowdFlipFps(C.crowd.mood);
    const hop = crowdHop(C.crowd, t);
    for (const x of C.crowdBatches) {
      x.origin[0] = c[0]; x.origin[1] = c[1] + (x.half ? hop : hop * 0.6); x.origin[2] = c[2];
      x.batch.origin = x.origin;
      if (x.frames > 1) {
        const f = Math.floor((t / 1000) * fps + x.half * 0.5 * x.frames) % x.frames;
        if (!x.uploaded.has(f)) { x.uploaded.add(f); deps.uploadRecordFrame?.(x.archive, x.record, f); }
        x.batch.record = `${x.record}#${f}`;
      }
    }
    for (const th of C.throws) {
      const k = Math.min(1, (t - th.at) / THROW_MS);
      const y = th.from[1] + (th.to[1] - th.from[1]) * k + Math.sin(Math.PI * k) * 3;
      th.origin[0] = c[0] + th.from[0] + (th.to[0] - th.from[0]) * k; th.origin[1] = c[1] + y; th.origin[2] = c[2] + th.from[2] + (th.to[2] - th.from[2]) * k;
      th.batch.origin = th.origin;
    }
  }
  /** `count` flats of `kinds` thrown from the stands to the sand round the fighters `ids`. */
  async function throwAt(C, ids, count, kinds) {
    const r = deps.renderer;
    if (!(count > 0) || !r?.createBillboardBatch || !deps.getTexture || !C.crowdBatches.length) return;
    const c = stage.centre();
    const dice = seededRng(arenaHash(C.seed, 9 + count));
    const at = ids.map((id) => C.fighters.get(id)?.ai?.feet ?? null).filter(Boolean).map((f) => [f[0] - c[0], f[2] - c[2]]);
    for (let i = 0; i < count; i++) {
      const [archive, record] = kinds[Math.floor(dice() * kinds.length)];
      let tex;
      try { tex = await deps.getTexture(archive); } catch { return; }
      if (cur !== C) return;
      const size = sizeOf(tex, record);
      const small = { w: size.w * 0.6, h: size.h * 0.6 };
      const a = dice() * Math.PI * 2, r0 = 22 + dice() * 6;
      const target = at.length ? at[Math.floor(dice() * at.length)] : [0, 0];
      const to = [target[0] + (dice() - 0.5) * 5, 0, target[1] + (dice() - 0.5) * 5];
      const batch = r.createBillboardBatch(archive, record, small, [[0, 0, 0]]);
      C.throws.push({ batch, from: [Math.cos(a) * r0, 8, Math.sin(a) * r0], to, at: now() + dice() * 600, origin: [0, 0, 0] });
    }
  }
  /** The crowd's and the throws' batches, for the host's billboard pass. */
  function batches() {
    if (!cur) return [];
    const out = [];
    for (const x of cur.crowdBatches) out.push(x.batch);
    for (const th of cur.throws) out.push(th.batch);
    return out;
  }

  // ── THE END OF IT ───────────────────────────────────────────────────────────────────────────────────────
  /** The bout gone, unsaid (its stage went, or another took its place): its fighters off the sand, its crowd and its
   *  sound let go, the HUD hidden. */
  function dismiss() {
    const C = cur;
    if (!C) return;
    cur = null;
    for (const foe of C.fighters.values()) C.stage?.remove?.(foe);
    C.fighters.clear();
    for (const x of C.crowdBatches) deps.renderer?.destroyBillboardBatch?.(x.batch);
    for (const th of C.throws) deps.renderer?.destroyBillboardBatch?.(th.batch);
    C.crowdBatches = []; C.throws = [];
    deps.setPlayerBout?.(null);
    deps.sound?.stop();
    deps.drawHud?.(null, { hidden: true });
    intrusions = 0;
  }

  return {
    setStage, ask, start, dismiss, frame, batches, playerSpare, holds,
    /** The ring the motor keeps me in while my bout stands (player/motor.js `arena`), or null. */
    ring: () => {
      if (!holds() || !stage || cur.stage !== stage) return null;
      const c = stage.centre();
      const r = (cur.ringed ??= { centre: [0, 0, 0], radius: RING_R });
      r.centre[0] = c[0]; r.centre[1] = c[1]; r.centre[2] = c[2];
      return r;
    },
    /** What the floor plays now (systems/arenaScore.js), or null (no bout heard here). */
    scoreWant: (t = now()) => (cur?.b ? arenaScoreFor(cur.b.phase, cur.verdictAt, t) : null),
    /** The bout standing (its law's state), its crowd, its kind, its stage's kind. */
    bout: () => cur?.b ?? null,
    crowd: () => cur?.crowd ?? null,
    kind: () => cur?.kind ?? null,
    stageKind: () => cur?.stage?.kind ?? null,
    pending: () => pending,
    /** The names on the sand now, for the Herald ("On the sand now: A against B"), or null. */
    onSand: () => (cur?.b && !boutOver(cur.b) ? { a: sideNames(cur.b, cur.b.fighters[0].side), b: otherNames(cur.b, cur.b.fighters[0].side) } : null),
    /** The hour whose exhibition stands here (the world host's schedule reads it). */
    hour: () => cur?.ex?.hour ?? null,
  };
}
