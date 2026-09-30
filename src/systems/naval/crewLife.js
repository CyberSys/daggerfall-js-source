// @ts-check
// LIVING CREW (2026-09-29, Mac: "Crew members shouldnt be the static sprites and instead the enemy type sprites with
// multiple animations, they should navigate the deck, talk with each other, blurb, sing chantys, etc") - ONE SHIP'S
// CREW AT THEIR WORK: who stands on her deck, where each walks, who talks to whom, the lines over their heads and the
// chanty they sing, and - her guns out or a grapple thrown - the rail they muster at. Stepped by its host
// (scenes/navalCrew.js draws them) on her deck (navalDeck.js), in her deck's frame. Pure: a draw seeded by the ship
// (her `seed`, a boat's uid), so every player in a room sees the same crew at the same kind of work, and no world.
//
// WHO THEY ARE. A ship of the sea's crew is her muster (navalBoarding.js musterOf, by what her crew has left): her
// captain and her men, the first CREW_SHOWN of them standing - and in a boarding the ones standing are the ones who
// fight, where they stand (scenes/navalHost.js takes them). A crewed boat of a player's is a hand's mix (PLAYER_CREW,
// a Bard among them to lead the song), CREW_PER_HAND of her crew a man.
//
// WHERE THEY STAND. The mod's own people flats are where a hull's crew stood (their places at rest, handed in as
// `places`): one on her walkable deck starts a walker there; one off it (the helmsman at her wheel on the poop) is a
// STATION - a man who stays at his post, turning and talking but never walking off it. The rest start spread across
// her deck (`deck.spots`).

import { musterOf, MOBILE, CREW_PER_HAND, MUSTER_MIN, MUSTER_MAX } from './navalBoarding.js';
import { seededRng } from '../wind.js';

/** A walker's pace on deck (m/s) - an amble, a hurry under fire or to a muster. */
export const CREW_WALK = 1.2;
export const CREW_HURRY = 2.4;
/** How fast a man turns to face (rad/s). */
export const CREW_TURN = 5;
/** How long a man stands before he does something else (s), and how far apart two stand to talk (m). */
export const CREW_IDLE_S = Object.freeze([4, 11]);
export const CREW_TALK_REACH = 1.6;
/** How far a man looks for someone to talk to (m), and how long he waits on someone in his way before he goes
 *  elsewhere (s). */
export const CREW_TALK_SEEK = 14;
export const CREW_BLOCKED_S = 2;
/** How long a line stays over a head (s), and the quiet between one man's blurbs (s). */
export const CREW_LINE_S = 3.4;
export const CREW_BLURB_S = Object.freeze([22, 70]);
/** The quiet between a ship's chanties (s), and the first one's wait. */
export const CHANTY_S = Object.freeze([75, 150]);
export const CHANTY_FIRST_S = Object.freeze([20, 55]);
/** How many of a hull's crew stand on her deck: Rowboat, Large Boat, Small Ship, Large Galley, Carrack. */
export const CREW_SHOWN = Object.freeze([0, 2, 6, 8, 8]);
/** A player's crew, round and round: the hands' Warriors with the rest of a ship's company - a Bard leads the song. */
export const PLAYER_CREW = Object.freeze([MOBILE.Warrior, MOBILE.Barbarian, MOBILE.Bard, MOBILE.Archer, MOBILE.Warrior, MOBILE.Monk, MOBILE.Rogue, MOBILE.Warrior]);
/** A player's crewed boat stands a man for every CREW_PER_HAND of her crew (at least one while any are aboard). */
export const playerCrewCount = (hull, crew) => (crew > 0 ? Math.min(CREW_SHOWN[hull] ?? 0, Math.max(1, Math.round(crew / CREW_PER_HAND))) : 0);

/** How many of a crew stand on her deck - `crewRoster`'s length, without making one (the world asks it every frame). */
export function crewCount({ hull, shipClass = null, crewShare = 1, crew = 0 }) {
  if (!shipClass) return playerCrewCount(hull, crew);
  const n = Math.min(MUSTER_MAX, Math.max(MUSTER_MIN, Math.round(shipClass.boarders * Math.min(1, Math.max(0, crewShare)))));
  return Math.min(CREW_SHOWN[hull] ?? 0, n);
}

/** The DFU classes whose sprites are human, male or female (all the musters' are). */
const HUMAN = new Set(Object.values(MOBILE));

/**
 * A crew's roster, in the order they stand and fight: a ship of the sea's her captain then her men (`shipClass`, what
 * her crew has left), a player's the hands' mix (`crew`, her crew's count). Each a class and a sex, off the seed.
 * @param {{ hull: number, seed: number, shipClass?: any, crewShare?: number, crew?: number }} o
 * @returns {{ mobile: number, gender: 'male'|'female' }[]}
 */
export function crewRoster({ hull, seed, shipClass = null, crewShare = 1, crew = 0 }) {
  const rng = seededRng(((seed >>> 0) ^ 0x6c1e5ea) >>> 0);
  let mobiles;
  if (shipClass) {
    const m = musterOf(shipClass, crewShare);
    mobiles = [m.captain, ...m.men].slice(0, CREW_SHOWN[hull] ?? 0);
  } else {
    const n = playerCrewCount(hull, crew);
    const start = Math.floor(rng() * PLAYER_CREW.length);
    mobiles = Array.from({ length: n }, (_, i) => PLAYER_CREW[(start + i) % PLAYER_CREW.length]);
  }
  return mobiles.map((mobile) => ({ mobile, gender: HUMAN.has(mobile) && rng() < 0.35 ? 'female' : 'male' }));
}

// ── what they say ────────────────────────────────────────────────────────────────────────────────────────────────

/** A man's own words, by what the ship is about, and by her trade where it colours them. */
export const CREW_BLURBS = Object.freeze({
  calm: Object.freeze([
    'Fair wind today.', 'Mind that line!', 'Smell the salt on her.', 'Another day on the Iliac Bay.', 'Steady as she goes.',
    'Anyone seen my pipe?', 'Wind\'s backing westerly.', 'Coil it proper, or the bosun\'ll have you.', 'Land\'s near. I can smell it.',
    'Gulls off the bow!', 'Sentinel spice fetches a fine price.', 'Wayrest by week\'s end, mark me.', 'My back\'s not what it was.',
    'Who\'s on the next watch?', 'Swab that, you lubber.', 'Calm as a Wayrest pond.', 'I\'d trade my ration for a dry bunk.',
    'Ever seen the lights of Daggerfall from the water?', 'Haul away!', 'She\'s a good ship, this one.',
  ]),
  battle: Object.freeze([
    'Run out the guns!', 'Fire as she bears!', 'Reload! Reload!', 'Keep your heads down!', 'Hold fast!',
    'She\'s coming about!', 'Powder, more powder!', 'Mind the rigging!', 'Put the fire out!', 'Steady, lads, steady!',
  ]),
  muster: Object.freeze([
    'Stand by to repel boarders!', 'Blades out, lads!', 'Here they come!', 'Over the rail!', 'For the ship!',
    'Grapples - make ready!', 'Hold the rail!', 'Nobody sets foot on our deck!',
  ]),
  pirate: Object.freeze([
    'Plunder waits for no one.', 'A fat merchant\'d suit me fine.', 'The captain\'s share, the captain\'s share...',
    'Keep a weather eye for the navy.', 'Gold, lads. Think of the gold.',
  ]),
  navy: Object.freeze([
    'For the crown.', 'Eyes sharp. Pirates about.', 'The captain wants her shipshape.', 'Steady, men.',
  ]),
  merchant: Object.freeze([
    'Mind the cargo!', 'Every crate counted.', 'Pray we meet no pirates.', 'Wine for Sentinel, wool for Wayrest.',
  ]),
});

/** Two men at their talk - the first says the first line, then each in turn. */
export const CREW_TALKS = Object.freeze([
  Object.freeze(['Heard the court at Daggerfall\'s hiring blades.', 'Aye, and paying in promises.']),
  Object.freeze(['What\'s for supper?', 'Hardtack and regret.', 'Again?']),
  Object.freeze(['You ever seen a sea serpent?', 'Once. Off Anticlere. Never again.']),
  Object.freeze(['Captain\'s in a mood.', 'Captain\'s always in a mood.', 'Fair point.']),
  Object.freeze(['Storm\'s brewing to the west.', 'Then we\'d best make port before it breaks.']),
  Object.freeze(['First round\'s on me when we make port.', 'You said that last time.', 'And I meant it last time too.']),
  Object.freeze(['They say the Orsinium lot are building ships now.', 'Orcs at sea? Gods help us all.']),
  Object.freeze(['How long have you sailed?', 'Since I could walk. Longer, some days.']),
  Object.freeze(['Sentinel or Wayrest?', 'Sentinel. Better wine.', 'Wayrest. Better company.']),
  Object.freeze(['Did you hear that?', 'Just the timbers.', '...I hope.']),
  Object.freeze(['My old mother wanted me a smith.', 'And here you are, hauling rope.', 'She\'d still say I chose wrong.']),
  Object.freeze(['Think we\'ll see a fight this voyage?', 'Pray not. I just mended this shirt.']),
]);

/** The chanties - original to the port: a verse the leader sings, each followed by its chorus the whole crew sings. */
export const CHANTIES = Object.freeze([
  Object.freeze({
    name: 'The Iliac Bay',
    chorus: 'Heave away, haul away, bound for the Iliac Bay!',
    verses: Object.freeze([
      'Oh, we sailed out of Daggerfall under a grey sky,',
      'With a hold full of wool and a keg running dry,',
      'The bosun he swore by Stendarr and by Kyne,',
      'We\'d be drinking in Sentinel ere the next bell\'s chime!',
    ]),
  }),
  Object.freeze({
    name: 'Haul the Line',
    chorus: 'So haul, boys, haul the line!',
    verses: Object.freeze([
      'There\'s a lass in Wayrest with eyes like the sea,',
      'She\'s promised her heart to a sailor like me,',
      'But the wind\'s in the west and the tide\'s running strong,',
      'So I\'ll sing her my love in a hauling song!',
    ]),
  }),
  Object.freeze({
    name: 'The Captain\'s Gold',
    chorus: 'Yo-ho, and away we go!',
    verses: Object.freeze([
      'The captain keeps his gold in a chest by his bed,',
      'He counts it by lantern and sleeps on its head,',
      'But the gold of the sea is the wind and the spray,',
      'And we spend it like kings every day, every day!',
    ]),
  }),
]);

/** A leader's verse or the crew's chorus, sung: the song's own marks round it. */
export const sung = (text) => `♪ ${text} ♪`;

// ── the crew at their work ───────────────────────────────────────────────────────────────────────────────────────

const TAU = Math.PI * 2;
const angleTo = (from, to) => { let d = (to - from) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length];
/** A draw in `range` ([lo, hi]). @param {() => number} rng @param {readonly number[]} range */
const within = (rng, range) => range[0] + rng() * (range[1] - range[0]);

/**
 * One ship's crew at their work, in her deck's frame.
 * @param {{
 *   deck: any,
 *   roster: { mobile: number, gender: string }[],
 *   seed: number,
 *   places?: number[][],
 *   faction?: string | null,
 * }} o - `deck` navalDeck.js's; `places` where her own people flats stood (her deck's frame), each a walker's start
 *   on her deck or a station off it
 */
export function createCrewLife({ deck, roster, seed, places = [], faction = null }) {
  const rng = seededRng(((seed >>> 0) ^ 0x51ce11fe) >>> 0);
  const spots = deck?.count ? deck.spots(Math.max(16, roster.length * 3)) : [];
  // a flat on her walkable deck starts a walker; one off it (her wheel, her poop) is a station
  const onDeck = [], stations = [];
  for (const p of places) (deck?.walkable(p[0], p[2]) ? onDeck : stations).push(p);
  const starts = [...stations.map((p) => ({ p, station: true })), ...onDeck.map((p) => ({ p, station: false })), ...spots.map((p) => ({ p, station: false }))];
  /** @type {any[]} */
  const members = roster.map((r, i) => {
    const start = starts[i] ?? { p: deck?.nearest?.(0, 0) ?? [0, 0, 0], station: false };
    return {
      i, mobile: r.mobile, gender: r.gender, station: start.station, post: [...start.p], pos: [...start.p],
      yaw: rng() * TAU, face: null, state: 'idle', t: within(rng, CREW_IDLE_S) * rng(), path: null, leg: 0, speed: CREW_WALK,
      mate: null, talk: null, line: null, blurbT: within(rng, CREW_BLURB_S) * (0.4 + rng()), moving: false, gone: false,
    };
  });
  let chantyT = within(rng, CHANTY_FIRST_S), chanty = null;
  let musterKey = '';

  const live = () => members.filter((m) => !m.gone);
  const say = (m, text, kind = 'talk') => { m.line = { text, kind, t: CREW_LINE_S }; };
  /** A walk for `m` to `to` (her deck's frame) - the deck's own path, or none for a station. */
  function walkTo(m, to, speed = CREW_WALK) {
    if (m.station) { m.state = 'idle'; m.t = within(rng, CREW_IDLE_S); return false; }
    const path = deck?.path?.([m.pos[0], m.pos[2]], [to[0], to[2]]);
    if (!path || path.length < 2) return false;
    m.path = path; m.leg = 1; m.state = 'walk'; m.speed = speed;
    return true;
  }
  /** A spot no other man stands at or is walking to. */
  function freeSpot() {
    for (let tries = 0; tries < 8 && spots.length; tries++) {
      const s = spots[Math.floor(rng() * spots.length) % spots.length];
      if (!members.some((o) => !o.gone && Math.hypot(o.pos[0] - s[0], o.pos[2] - s[2]) < 1.2)) return s;
    }
    return null;
  }
  /** Start a talk: `m` walks over to `o`, who turns to him. */
  function startTalk(m, o) {
    const dx = m.pos[0] - o.pos[0], dz = m.pos[2] - o.pos[2], d = Math.hypot(dx, dz) || 1;
    const to = deck?.clamp?.(o.pos[0] + dx / d * CREW_TALK_REACH, o.pos[2] + dz / d * CREW_TALK_REACH) ?? o.pos;
    const script = pick(rng, CREW_TALKS);
    m.mate = o; o.mate = m;
    m.talk = { script, line: -1, t: 0, lead: true }; o.talk = { script, line: -1, t: 0, lead: false };
    o.state = 'wait'; o.path = null;
    if (Math.hypot(m.pos[0] - to[0], m.pos[2] - to[2]) < 0.3 || !walkTo(m, to)) m.state = 'talk';
    else m.state = 'toTalk';
  }
  function endTalk(m) {
    for (const x of [m, m.mate]) {
      if (!x) continue;
      x.mate = null; x.talk = null; x.state = 'idle'; x.t = within(rng, CREW_IDLE_S); x.face = null;
    }
  }
  /** What an idle man does next. */
  function decide(m) {
    if (m.station) { m.face = m.face ?? m.yaw; m.t = within(rng, CREW_IDLE_S); if (rng() < 0.3) m.face = rng() * TAU; return; }
    if (rng() < 0.35) {
      let best = null, bestD = CREW_TALK_SEEK;
      for (const o of members) {
        if (o === m || o.gone || o.state !== 'idle' || o.mate) continue;
        const d = Math.hypot(o.pos[0] - m.pos[0], o.pos[2] - m.pos[2]);
        if (d < bestD) { bestD = d; best = o; }
      }
      if (best) { startTalk(m, best); return; }
    }
    const s = freeSpot();
    if (!s || !walkTo(m, s)) { m.t = within(rng, CREW_IDLE_S); m.face = rng() * TAU; }
  }

  /**
   * The crew's step. `ctx.battle` - her guns out: no song, no talk, the battle's words and a hurry; `ctx.muster` - a
   * grapple thrown: the side of her deck (her frame's x sign, +1 or -1) the other ship lies on, every man to that rail,
   * facing out; `ctx.avoid` - a point (her frame) no walker steps within 0.8 m of (the player on her deck).
   * @param {number} dt
   * @param {{ battle?: boolean, muster?: number, avoid?: number[] | null }} [ctx]
   */
  function step(dt, ctx = {}) {
    if (!(dt > 0)) return;
    const muster = ctx.muster === 1 || ctx.muster === -1 ? ctx.muster : 0;
    const battle = !!ctx.battle || !!muster;
    // a muster: every man to the rail on that side, spread along it
    const key = muster ? String(muster) : '';
    if (key !== musterKey) {
      musterKey = key;
      const crew = live();
      if (muster) {
        chanty = null;
        for (const m of crew) { if (m.mate) endTalk(m); }
        const zs = crew.map((_, n) => n);
        const ext = deckExtentZ(deck);
        crew.forEach((m, n) => {
          const z = ext ? ext[0] + (ext[1] - ext[0]) * ((zs[n] + 0.5) / crew.length) : m.pos[2];
          const at = deck?.rail?.(muster, z) ?? m.pos;
          m.post = [...at];
          m.face = muster > 0 ? Math.PI / 2 : -Math.PI / 2;
          if (!walkTo(m, at, CREW_HURRY)) { m.state = 'ready'; }
          else m.state = 'toMuster';
        });
      } else {
        for (const m of crew) { m.state = 'idle'; m.t = within(rng, CREW_IDLE_S) * 0.5; m.face = null; m.path = null; }
      }
    }
    // the song
    if (!battle && !muster) {
      if (chanty) {
        chanty.t -= dt;
        if (chanty.t <= 0) {
          chanty.line++;
          const song = chanty.song, n = song.verses.length * 2;
          if (chanty.line >= n) { chanty = null; chantyT = within(rng, CHANTY_S); }
          else {
            chanty.t = CREW_LINE_S;
            const verse = chanty.line % 2 === 0;
            if (verse) { if (!chanty.leader.gone) say(chanty.leader, sung(song.verses[chanty.line / 2]), 'sing'); }
            else for (const m of live()) if (!m.mate) say(m, sung(song.chorus), 'sing');
          }
        }
      } else if ((chantyT -= dt) <= 0) {
        const crew = live();
        if (crew.length >= 2) {
          const bard = crew.find((m) => m.mobile === MOBILE.Bard);
          chanty = { song: pick(rng, CHANTIES), line: -1, t: 0, leader: bard ?? pick(rng, crew) };
        } else chantyT = within(rng, CHANTY_S);
      }
    } else if (chanty) { chanty = null; chantyT = within(rng, CHANTY_S); }

    for (const m of members) {
      if (m.gone) continue;
      if (m.line && (m.line.t -= dt) <= 0) m.line = null;
      m.moving = false;
      switch (m.state) {
        case 'idle':
          if ((m.t -= dt) > 0) break;
          if (!battle) decide(m);
          else if (!m.station) { const s = freeSpot(); if (!s || !walkTo(m, s, CREW_HURRY)) m.t = within(rng, CREW_IDLE_S) * 0.5; }   // at the guns: from post to post at a run
          else m.t = within(rng, CREW_IDLE_S);
          break;
        case 'walk': case 'toTalk': case 'toMuster':
          if (advance(m, dt, ctx.avoid ?? null)) { m.blockT = 0; } else if ((m.blockT = (m.blockT ?? 0) + dt) > CREW_BLOCKED_S && m.state === 'walk') { m.path = null; m.blockT = 0; }   // someone in his way too long: somewhere else
          if (m.state === 'walk' && !m.path) { m.state = 'idle'; m.t = within(rng, CREW_IDLE_S); }
          else if (m.state === 'toTalk' && !m.path) m.state = 'talk';
          else if (m.state === 'toMuster' && !m.path) m.state = 'ready';
          break;
        case 'wait':   // his mate is coming over to talk
          if (m.mate) m.face = Math.atan2(m.mate.pos[0] - m.pos[0], m.mate.pos[2] - m.pos[2]);
          if (!m.mate || m.mate.gone || m.mate.state !== 'toTalk' && m.mate.state !== 'talk') endTalk(m);
          break;
        case 'talk': {
          const o = m.mate;
          if (!o || o.gone) { endTalk(m); break; }
          m.face = Math.atan2(o.pos[0] - m.pos[0], o.pos[2] - m.pos[2]);
          o.face = Math.atan2(m.pos[0] - o.pos[0], m.pos[2] - o.pos[2]);
          if (o.state === 'wait') o.state = 'talk';
          if (!m.talk?.lead) break;   // the one who came over keeps the talk's clock
          if ((m.talk.t -= dt) > 0) break;
          m.talk.line++;
          const lines = m.talk.script;
          if (m.talk.line >= lines.length) { endTalk(m); break; }
          say(m.talk.line % 2 === 0 ? m : o, lines[m.talk.line]);
          m.talk.t = CREW_LINE_S;
          break;
        }
        case 'ready':
          m.face = muster > 0 ? Math.PI / 2 : muster < 0 ? -Math.PI / 2 : m.face;
          break;
        default: break;
      }
      // a word of his own, now and then - never over a talk or a song
      if (!m.mate && !chanty && (m.blurbT -= dt) <= 0) {
        m.blurbT = within(rng, CREW_BLURB_S) * (battle ? 0.35 : 1);
        if (!m.line) {
          const own = !battle && faction && CREW_BLURBS[faction] && rng() < 0.3 ? CREW_BLURBS[faction] : null;
          say(m, pick(rng, own ?? (muster ? CREW_BLURBS.muster : battle ? CREW_BLURBS.battle : CREW_BLURBS.calm)), muster || battle ? 'shout' : 'talk');
        }
      }
      // turn toward his face (a walker faces his way)
      if (m.face != null && !m.moving) {
        const d = angleTo(m.yaw, m.face), s = CREW_TURN * dt;
        m.yaw += Math.abs(d) <= s ? d : Math.sign(d) * s;
      }
    }
  }

  /** A walker along his path: toward its next corner at his pace, facing his way; waiting while the one to avoid
   *  stands in his next step. Answers whether he moved. */
  function advance(m, dt, avoid) {
    const p = m.path;
    if (!p) return true;
    let left = m.speed * dt;
    while (left > 0 && m.path) {
      const to = p[m.leg];
      const dx = to[0] - m.pos[0], dz = to[2] - m.pos[2], d = Math.hypot(dx, dz);
      if (avoid && Math.hypot(m.pos[0] + dx / (d || 1) * 0.8 - avoid[0], m.pos[2] + dz / (d || 1) * 0.8 - avoid[2]) < 0.8) return false;   // someone in the way: wait
      m.yaw = Math.atan2(dx, dz);
      m.moving = true;
      if (d <= left) {
        m.pos[0] = to[0]; m.pos[1] = to[1]; m.pos[2] = to[2];
        left -= d;
        if (++m.leg >= p.length) { m.path = null; break; }
      } else {
        const k = left / d;
        m.pos[0] += dx * k; m.pos[2] += dz * k;
        m.pos[1] = deck?.heightAt?.(m.pos[0], m.pos[2]) ?? m.pos[1];
        if (Number.isNaN(m.pos[1])) m.pos[1] = to[1];
        left = 0;
      }
    }
    return true;
  }

  return {
    members,
    step,
    /** The lines over their heads now: [{ member, text, kind }] ('talk', 'sing', 'shout'). */
    speech() { const out = []; for (const m of members) if (!m.gone && m.line) out.push({ member: m, text: m.line.text, kind: m.line.kind }); return out; },
    /** Her crew fewer, to `n` standing (the guns took the rest): the last of the roster first, never her first man. */
    trim(n) {
      let alive = members.filter((m) => !m.gone).length;
      for (let i = members.length - 1; i > 0 && alive > n; i--) {
        const m = members[i];
        if (m.gone) continue;
        if (m.mate) endTalk(m);
        if (chanty?.leader === m) chanty = null;
        m.gone = true; m.line = null; alive--;
      }
    },
    /** How many stand. */
    standing: () => members.reduce((a, m) => a + (m.gone ? 0 : 1), 0),
    /** Whether a chanty is being sung. */
    singing: () => !!chanty,
    /**
     * Up to `n` of the crew taken off her deck, in the roster's order (a boarding's muster, a party over the rail, my
     * hands going over) - `from` standing men passed over first (a party leaves her captain aboard): each as it stands,
     * its class, its sex, where (her frame) and which way it faces.
     * @param {number} n @param {{ from?: number }} [o]
     */
    take(n, { from = 0 } = {}) {
      const out = [];
      let skip = from;
      for (const m of members) {
        if (out.length >= n) break;
        if (m.gone) continue;
        if (skip > 0) { skip--; continue; }
        if (m.mate) endTalk(m);
        m.gone = true; m.line = null;
        if (chanty?.leader === m) chanty = null;
        out.push({ mobile: m.mobile, gender: m.gender, pos: [...m.pos], yaw: m.yaw });
      }
      return out;
    },
  };
}

/** Her deck's fore-and-aft extent (her frame's z), off its cells: [aft, fore], or null for no deck. */
export function deckExtentZ(deck) {
  if (!deck?.count) return null;
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < deck.y.length; j++) {
    if (Number.isNaN(deck.y[j])) continue;
    const k = Math.floor(j / deck.nx), z = deck.minZ + (k + 0.5) * deck.cell;
    if (z < lo) lo = z;
    if (z > hi) hi = z;
  }
  return [lo, hi];
}
