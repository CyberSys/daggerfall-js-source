// @ts-check
// LW2 (2026-10-04, bible/06-Systems/Living-World.md): THE LIVING TOWN - the residents on the street. It stands where
// DFU's wandering pool stood (systems/townPopulation.js TownPopulation) and answers the street's seams in the pool's own
// shape - `pool` rows of { person, active, scheduleEnable, scheduleRecycle, visible }, `update()` the live seats,
// `retire(person)`, `nav`, `maxPopulation` - so the talk ray, the watch's conversion, the trample, the probes and the
// draw take a resident as they took a walker. What stands on the street is not a pool's roll but the town's day:
//
//  - THE CENSUS AND THE DAY. Every resident of the town (census.js) has their day (dayPlan.js); four times a second the
//    town reads each one's entry at the clock's minute, and those OUTDOORS - walking, or standing at a spot - within
//    LIVING_RANGE of the player are wanted on the street, the nearest first, to DFU's own cap (maxPopulationFor).
//  - WHERE EXACTLY. A walk is the grid's A* path (townPaths.js, a few searches a frame), walked at the day's pace and
//    never slower (a path longer than the plan guessed is walked faster, to WALK_FAST times the pace, and arrives late
//    past that - the stay after it starts when they arrive). A stay at a spot is a place about it: in a circle with
//    the others met there (meetups.js), else a place of their own.
//  - POP-IN IS HIDDEN, DFU'S WAY: a resident wanted comes onto the street beyond POP_VISIBLE_RANGE or behind the
//    player's half of the view (PopulationManager's own rule) - or out of a door, which is a coming-out and needs no
//    hiding. One walking into a door is gone through it at once; one only out of range goes when unseen. BUT ON
//    ARRIVAL - the town's first frame, the clock jumped past ARRIVAL_JUMP_MIN (a rest, a wait, a load), or the player
//    moved past ARRIVAL_STEP_M in one frame (a Recall, a teleport) - the street is simply as the day has it: everyone
//    out of doors is there, as they were before the player came (DFU's rule alone would keep a street the player
//    arrives facing empty but for its doors). The hiding is for the street's own churn: one more stood under the cap
//    as another goes in.
//  - THE POLITENESS GATE holds them as it holds DFU's walkers (the street's own `wantsToStop`), and their day waits
//    for them: the minutes they stood are owed, and walked off at CATCH_UP faster until they are back on their day.
//  - WHAT THEY SAY (`speech()`): a circle's line at this minute (pure: every reader hears it), and a word to the player
//    passing close - by name from a friend, a cold one from an enemy (relations.js).
//  - A RESIDENT TAKEN off the street - converted to the watch, trampled - is gone for the rest of the day.
//  - LW3, THE ROADS IN TOWN (`o.tripsOf`): a traveller of this town on a trip has its away window (geared at home, out
//    to the exit facing the road, home again - dayPlan.js schedule), and walks it ARMED in their class's sprite
//    (`o.armOf`, ResidentWalker.arm); a party of another town staying here is a VISITOR - in by the exit facing the road
//    it came, lodged at a tavern, out by the same exit when it leaves.
import { POP_VISIBLE_RANGE, POP_RECYCLE_DISTANCE, maxPopulationFor } from '../townPopulation.js';
import { PERSON_MOVE_SPEED } from '../../characters/mobilePerson.js';
import { townPlaces, exitToward } from './places.js';
import { townCensus } from './census.js';
import { dayPlan, entryAt, isOutdoor, DAY_START_MIN, DAY_MIN } from './dayPlan.js';
import { BUILDING_TYPES } from '../../world/buildingNames.js';
import { createPathBook, pointAlong } from './townPaths.js';
import { spotCircles, circleLine, circleStands, aloneStand, ROUND_S, lineMinutes } from './meetups.js';
import { LIVING_GREETINGS, fillLine, firstNameOf } from './lines.js';
import { lwSeed, textSeed } from './seed.js';

/** The census read this often (real seconds). */
export const LIVING_TICK_S = 0.25;
/** How far a resident is stood from the player (m) - DFU's recycle distance. */
export const LIVING_RANGE = POP_RECYCLE_DISTANCE;
/** The searches one frame may make. */
export const PATHS_PER_FRAME = 4;
/** A path longer than the day guessed is walked up to this many times the pace. */
export const WALK_FAST = 1.6;
/** The owed minutes are walked off this much faster than the day. */
export const CATCH_UP = 0.35;
/** A body further than this from where its day has it (m) is stood there at once (a first frame, a rest's jump of the
 *  clock); nearer, it walks there (a circle reshuffled, a stand left for the next walk). */
export const SNAP_M = 30;
/** A walk begun this many of the clock's minutes ago from a door is a coming-out (seen at any range). */
export const DOOR_POP_MIN = 2;
/** How near the player passes for a word (m), how far lines are heard (m), and a resident's word's rest (minutes). */
export const GREET_RANGE = 3.2;
export const LINE_RANGE = 24;
export const GREET_REST_MIN = 90;
/** A clock jump past this (minutes) between two frames is an arrival: the street is stood whole. */
export const ARRIVAL_JUMP_MIN = 15;
/** A player moved past this in one frame (m) has arrived (a journey's x100 step is a few metres). */
export const ARRIVAL_STEP_M = 40;
/** The searches a frame may make while the street is being stood on arrival. */
export const ARRIVAL_PATHS_PER_FRAME = 32;
/** How long a word to the player stands (real seconds). */
export const GREET_S = 3.4;
/** A resident's line stands this high over their feet (m) - a townsperson's billboard and a little. */
export const LINE_HEAD_M = 2.1;
/** What an enemy says to the talk ray instead of talking ({a} their first name). */
export const LIVING_REFUSAL = '{a} turns away from you.';

/**
 * @typedef {import('./census.js').Resident} Resident
 * @typedef {import('./dayPlan.js').Entry} Entry
 * @typedef {{ person: any, active: boolean, scheduleEnable: boolean, scheduleRecycle: boolean, visible: boolean, res: Resident|null, mine: boolean, arrival: boolean }} Row
 */

export class LivingTown {
  /**
   * @param {any} nav - the town's CityNavigation
   * @param {{
   *   town: import('./census.js').LwTown,
   *   buildings: readonly import('./census.js').LwBuilding[],
   *   doors: readonly { key: number, x: number, z: number, nx: number, nz: number }[],
   *   makePerson: (archive: number, guard: boolean) => any,
   *   clock: () => number, rate: () => number, mpm: number,
   *   suppressSpawns?: () => boolean,
   *   relations?: () => (ReturnType<typeof import('./relations.js').createRelations> | null),
   *   playerName?: () => string, weather?: () => (string|null), townName?: string, regionName?: string,
   *   tripsOf?: (day: number) => ({ away: Map<string, { t0: number, t1: number, yaw: number, armed: boolean }[]>, visitors: { res: Resident, inT: number, outT: number, yaw: number }[] } | undefined),
   *   armOf?: (res: Resident) => ({ mobileType: number, basics: any, archive: number, frameCount: (record: number) => number, sex?: 'male'|'female' } | null),
   * }} o - `tripsOf(day)` the roads' word on the town for a day (trips.js through the host's book: who of it is away
   *   when, who of elsewhere stays here), undefined while its ways are still being asked; `armOf(res)` a resident's
   *   class sprite once its art is loaded, else null - `clock` the sky's minute (worldTick.js skyMinutes); `rate` the clock's minutes a real second now (a
   *   journey's scale in it); `mpm` the walking pace in the clock's metres a minute (LW0 decision 3)
   */
  constructor(nav, o) {
    this.nav = nav;
    this.o = o;
    this.places = townPlaces(nav, o.doors, o.buildings);
    this.residents = townCensus(o.town, o.buildings);
    this.maxPopulation = maxPopulationFor(o.town.blocks);
    /** @type {Row[]} */
    this.pool = [];
    /** @type {Map<string, { day: number, plan: Entry[], roads?: boolean }>} */
    this._plans = new Map();
    this._paths = createPathBook(nav);
    this._timer = Infinity;
    /** @type {Map<string, number>} the residents taken off the street, and the day */
    this._taken = new Map();
    /** @type {Map<string, number>} the minutes each is behind its day */
    this._lag = new Map();
    /** @type {Map<string, { circle: any, index: number, spot: any }>} this tick's circles, by member */
    this._inCircle = new Map();
    /** @type {Map<string, number>} when each last spoke to the player (the clock's minute) */
    this._greeted = new Map();
    /** @type {{ person: any, text: string, until: number }[]} the words to the player standing */
    this._greetings = [];
    this._now = 0;
    this._realNow = 0;
    /** @type {number|null} the clock at the last frame (an arrival is a jump from it) */
    this._lastClock = null;
    /** @type {number[]|null} the player's feet at the last frame (an arrival is a jump from them) */
    this._lastPlayer = null;
    this._arriving = false;
    /** PERF-TOWN1's discipline: the live list and its rows are the town's own, refilled each frame. @type {any[]} */
    this._live = [];
    /** @type {{ person: any, out: any }[]} */
    this._rows = [];
  }

  /** The living day `t` falls in. @param {number} t */
  dayOf(t) { return Math.floor((t - DAY_START_MIN) / DAY_MIN); }

  /** A resident's day - a traveller's bent round its trips, a visitor's round its stay. @param {Resident} res @param {number} day */
  planOf(res, day) {
    let e = this._plans.get(res.id);
    if (!e || e.day !== day) {
      const roads = this._roadsOf(day);
      const visit = roads?.visitorOf.get(res.id) ?? null;
      let plan;
      if (visit) {
        const exit = exitToward(this.places, visit.yaw);
        const D0 = day * DAY_MIN + DAY_START_MIN;
        const away = [{ t0: D0 - DAY_MIN, t1: visit.inT, exit, armed: false }, { t0: visit.outT, t1: D0 + 2 * DAY_MIN, exit, armed: false }];
        plan = dayPlan(res, this.places, day, { mpm: this.o.mpm, visitor: true, home: this._lodging(res), away });
      } else {
        const away = (roads?.away.get(res.id) ?? []).map((w) => ({ t0: w.t0, t1: w.t1, exit: exitToward(this.places, w.yaw), armed: w.armed }));
        plan = dayPlan(res, this.places, day, { mpm: this.o.mpm, away });
      }
      e = { day, plan, roads: !!roads };
      this._plans.set(res.id, e);
    }
    return e.plan;
  }

  /** The roads' word for a day, kept (undefined while its ways are being asked - the day is planned without them and
   *  planned again once they are known). */
  _roadsOf(day) {
    if (!this.o.tripsOf) return null;
    if (this._roads?.day === day) return this._roads;
    const got = this.o.tripsOf(day);
    if (!got) return null;
    this._roads = { day, away: got.away, visitorOf: new Map(got.visitors.map((v) => [v.res.id, v])), visitors: got.visitors.map((v) => v.res) };
    for (const [id, e] of this._plans) if (e.day === day && !e.roads) this._plans.delete(id);   // planned before the roads were known: again
    return this._roads;
  }

  /** A visitor's lodging: one of the town's taverns, by their id (none: the square). */
  _lodging(res) {
    const taverns = [...this.places.doors.entries()].filter(([k]) => this.places.types.get(k) === BUILDING_TYPES.Tavern).map(([, s]) => s);
    return taverns.length ? taverns[lwSeed(textSeed(res.id), 0x6c6f6467) % taverns.length] : (this.places.square ?? null);   // 'lodg'
  }

  /** Everyone the town reads today: its people, and its visitors. @param {number} day */
  peopleOf(day) {
    const v = this._roadsOf(day)?.visitors;
    return v?.length ? this.residents.concat(v) : this.residents;
  }

  /** The entry a resident is in at minute `t` (with the one before and the one after), or null. @param {Resident} res @param {number} t */
  entryOf(res, t) {
    const plan = this.planOf(res, this.dayOf(t));
    const i = entryAt(plan, t);
    return i >= 0 ? { e: plan[i], prev: plan[i - 1] ?? null, next: plan[i + 1] ?? null } : null;
  }

  /** The walk's line, if its path is known (undefined: not searched yet; null: no way). */
  _line(e, search) {
    const a = e.from.cell, b = e.to.cell;
    const known = this._paths.get(a, b);
    if (known !== undefined || !search) return known;
    return this._paths.want(a, b);
  }

  /** How far along a walk's line at minute `t` - the day's pace, never slower, to WALK_FAST times it. */
  _walked(e, line, t) {
    const dur = Math.max(1e-6, e.t1 - e.t0);
    const v = Math.min(this.o.mpm * WALK_FAST, Math.max(this.o.mpm, line.len / dur));
    return { s: (t - e.t0) * v, arrive: e.t0 + line.len / v };
  }

  /**
   * Where a resident's day has them at minute `t`, or null indoors. `search` lets this frame's budget search a path.
   * A walk is its path walked at `_walked`'s pace: one that has not arrived when its window closes holds the walker
   * past it, and one that arrives early stands them at its end (or takes them through the door, out of the gate).
   * @param {Resident} res @param {number} t @param {boolean} search
   * @returns {{ x: number, z: number, yaw: number, moving: boolean, e: Entry, pending?: boolean, fromDoor?: boolean } | null}
   */
  where(res, t, search) {
    const at = this.entryOf(res, t);
    if (!at) return null;
    let e = at.e, after = at.next;
    if (e.kind !== 'walk' && at.prev?.kind === 'walk') {
      const line = this._line(at.prev, search);
      if (line && this._walked(at.prev, line, t).arrive > t) { after = e; e = at.prev; }
    }
    if (e.kind === 'walk') {
      const line = this._line(e, search);
      if (line === undefined) return { x: e.from.x, z: e.from.z, yaw: 0, moving: false, e, pending: true };
      if (line === null) return null;
      const w = this._walked(e, line, t);
      if (w.s < line.len) {
        const p = pointAlong(line, w.s);
        return { x: p.x, z: p.z, yaw: p.yaw, moving: true, e, fromDoor: e.from.kind === 'door' && (t - e.t0) < DOOR_POP_MIN };
      }
      if (!after || !isOutdoor(after) || after.kind === 'walk') return null;   // arrived: in through the door, out of the gate
      e = after;
    }
    if (!isOutdoor(e)) return null;
    const c = this._inCircle.get(res.id);
    const st = c && c.spot === e.at ? circleStands(e.at, c.circle)[c.index] : aloneStand(e.at, res.id);
    return { x: st.x, z: st.z, yaw: st.yaw, moving: false, e };
  }

  _rowOf(res) { return this.pool.find((r) => r.res === res) ?? null; }

  _freeRow() {
    for (const r of this.pool) if (!r.active && !r.res) return r;
    if (this.pool.length >= this.maxPopulation) return null;
    const row = { person: this.o.makePerson(this.residents[0]?.archive ?? 0, false), active: false, scheduleEnable: false, scheduleRecycle: false, visible: false, res: null, mine: true, arrival: false };
    this.pool.push(row);
    return row;
  }

  /** A body becomes a resident: their outfit, their name, their face, their talk seed. */
  _dress(row, res) {
    const p = row.person;
    p.setIdentity(res.archive, res.guard);
    p.gender = res.gender;
    p.nameNPC = res.name;
    p.personFaceRecordId = res.face;
    p._talkSeed = lwSeed(textSeed(res.id), 0x74616c6b) & 0x7fffffff;   // 'talk': their own, for life
    p.pickpocketAttempted = false;
    p.living = { id: res.id, res, town: this };
    row.res = res;
  }

  _free(row) {
    row.active = false; row.scheduleEnable = false; row.scheduleRecycle = false; row.visible = false; row.arrival = false;
    if (row.res) this._lag.delete(row.res.id);
    row.res = null;
    if (row.person) row.person.living = null;
  }

  /** A resident taken off the street for the day. @param {Resident} res */
  _take(res) { this._taken.set(res.id, this.dayOf(this._now)); }

  _inView(dx, dz, viewYaw) { return dx * Math.sin(viewYaw) + dz * Math.cos(viewYaw) > 0; }

  /** The census read: who is wanted on the street now, and the circles at the spots. */
  _tick(playerPos, viewYaw) {
    const t = this._now;
    const day = this.dayOf(t);
    // a row the street disabled itself (the watch's conversion copies the pool's free inline): that resident is taken
    for (const r of this.pool) if (r.res && !r.active) { this._take(r.res); this._free(r); }
    /** @type {Map<string, { who: Resident, t0: number, t1: number }[]>} */
    const presence = new Map();
    /** @type {Map<string, any>} */
    const spotOf = new Map();
    const wanted = [];
    for (const res of this.peopleOf(day)) {
      if (this._taken.get(res.id) === day) continue;
      const at = this.entryOf(res, t);
      if (!at) continue;
      if (at.e.kind !== 'walk' && isOutdoor(at.e)) {
        const list = presence.get(at.e.at.key) ?? [];
        list.push({ who: res, t0: at.e.t0, t1: at.e.t1 });
        presence.set(at.e.at.key, list);
        spotOf.set(at.e.at.key, at.e.at);
      }
      const w = this.where(res, t, false);
      if (!w) continue;
      const d = Math.hypot(w.x - playerPos[0], w.z - playerPos[2]);
      if (d < LIVING_RANGE) wanted.push({ res, d });
    }
    wanted.sort((a, b) => a.d - b.d || (a.res.id < b.res.id ? -1 : 1));
    const keep = new Set(wanted.slice(0, this.maxPopulation).map((w) => w.res));
    // the circles at every spot two or more stand at (the whole census's, so every reader's circles agree)
    const roundMin = ROUND_S * this._baseRate();
    this._inCircle.clear();
    for (const [key, list] of presence) {
      if (list.length < 2) continue;
      const spot = spotOf.get(key);
      for (const circle of spotCircles(key, list, t, roundMin)) circle.members.forEach((m, index) => this._inCircle.set(m.id, { circle, index, spot }));
    }
    // the street: a row whose resident is no longer wanted goes when unseen; one wanted again stays
    for (const r of this.pool) if (r.active && r.res) r.scheduleRecycle = !keep.has(r.res);
    // the wanted not yet on the street come on
    if (this.o.suppressSpawns?.()) return;
    for (const res of keep) {
      if (this._rowOf(res)) continue;
      const row = this._freeRow();
      if (!row) break;
      this._dress(row, res);
      row.active = true; row.scheduleEnable = true; row.visible = false; row.scheduleRecycle = false;
      row.arrival = this._arriving;   // stood with the street on arrival: seen as soon as it has its place
    }
  }

  /** The clock's minutes a real second at the walking pace's own rate (a journey's scale left out). */
  _baseRate() { return PERSON_MOVE_SPEED / Math.max(1e-6, this.o.mpm); }

  /**
   * One frame: the census read on its beat, every body laid where its day has it. `playerPos` the player's feet in the
   * location frame; `viewYaw` the camera's yaw; `cameraPos` the eye (location frame); `wantsToStopFn(person)` the
   * street's politeness gate. Answers the live seats - { person, out } - the pool's own reused rows.
   * @param {number} dt @param {number[]} playerPos @param {number} viewYaw @param {number[]} cameraPos @param {boolean} _isDay
   * @param {(person: any) => boolean} [wantsToStopFn]
   */
  update(dt, playerPos, viewYaw, cameraPos, _isDay, wantsToStopFn = () => false) {
    this._now = this.o.clock();
    this._realNow += dt;
    this._timer += dt;
    const stepped = this._lastPlayer ? Math.hypot(playerPos[0] - this._lastPlayer[0], playerPos[2] - this._lastPlayer[2]) : 0;
    this._arriving = this._lastClock === null || Math.abs(this._now - this._lastClock) > ARRIVAL_JUMP_MIN || stepped > ARRIVAL_STEP_M;
    this._lastClock = this._now;
    this._lastPlayer = [playerPos[0], playerPos[1], playerPos[2]];
    if (this._arriving) this._timer = LIVING_TICK_S;   // an arrival reads the census at once
    if (this._timer >= LIVING_TICK_S) { this._timer = 0; this._tick(playerPos, viewYaw); }
    this._paths.budget(this.pool.some((r) => r.arrival) ? ARRIVAL_PATHS_PER_FRAME : PATHS_PER_FRAME);
    const rate = this.o.rate();
    const scale = Math.max(1, rate / this._baseRate());
    const out = this._live;
    out.length = 0;
    const seats = this._rows;
    for (const row of this.pool) {
      if (!row.active || !row.res) continue;
      const res = row.res, p = row.person;
      const stop = row.visible && dt > 0 ? !!wantsToStopFn(p) : false;
      // the politeness gate's minutes, owed and walked off
      let lag = this._lag.get(res.id) ?? 0;
      if (stop) lag += dt * rate;
      else if (lag > 0) lag = Math.max(0, lag - dt * rate * CATCH_UP);
      const w = this.where(res, this._now - lag, true);
      if (!w) { this._free(row); continue; }   // indoors: in through the door, out through the gate
      // LW3: walking to or from the road, in their gear
      const armed = !!w.e.armed && res.cls != null;
      if (armed !== !!p.armed && typeof p.arm === 'function') { if (!armed) p.arm(null); else { const look = this.o.armOf?.(res) ?? null; if (look) p.arm(look); } }
      if (w.e.kind !== 'walk') lag = 0;   // standing at a spot owes nothing
      if (lag > 0) this._lag.set(res.id, lag); else this._lag.delete(res.id);
      if (w.pending) { if (!row.visible) continue; }
      else {
        const dx0 = w.x - p.pos[0], dz0 = w.z - p.pos[2];
        const d = Math.hypot(dx0, dz0);
        const step = PERSON_MOVE_SPEED * WALK_FAST * dt * scale;
        if (!row.visible || d > Math.max(SNAP_M, step * 3)) { p.pos[0] = w.x; p.pos[2] = w.z; p.yaw = w.yaw; p.moving = w.moving; }
        else if (d > 0.05) {
          const k = Math.min(1, step / d);
          p.pos[0] += dx0 * k; p.pos[2] += dz0 * k;
          p.yaw = w.moving ? w.yaw : Math.atan2(dx0, dz0);
          p.moving = true;
        } else { p.pos[0] = w.x; p.pos[2] = w.z; p.yaw = w.yaw; p.moving = w.moving; }
        p.pos[1] = p.groundY(p.pos[0], p.pos[2]);
      }
      const dx = p.pos[0] - playerPos[0], dz = p.pos[2] - playerPos[2];
      const dist = Math.hypot(dx, dz);
      const allowChange = dist > POP_VISIBLE_RANGE || !this._inView(dx, dz, viewYaw);
      if (row.scheduleRecycle && allowChange) { this._free(row); continue; }
      if (row.scheduleEnable && !w.pending && (allowChange || w.fromDoor || row.arrival)) { row.scheduleEnable = false; row.visible = true; row.arrival = false; }
      if (!row.visible) continue;
      const frameOut = p.update(dt, cameraPos, stop);
      const seat = seats[out.length] ??= { person: null, out: null };
      seat.person = p; seat.out = frameOut;
      out.push(seat);
      if (dt > 0) this._greet(res, p, dist, stop);
    }
    return out;
  }

  /** A word to the player passing close, at most once in GREET_REST_MIN of the clock. */
  _greet(res, person, dist, stopped) {
    if (dist > GREET_RANGE || this._inCircle.has(res.id)) return;
    const last = this._greeted.get(res.id);
    if (last != null && this._now - last < GREET_REST_MIN) return;
    const rel = this.o.relations?.() ?? null;
    const day = this.dayOf(this._now);
    const standing = rel ? rel.standing(res.id, day) : 'neutral';
    const pool = standing === 'friend' ? LIVING_GREETINGS.friend : standing === 'enemy' || standing === 'hostile' ? LIVING_GREETINGS.enemy
      : rel?.known(res.id) ? LIVING_GREETINGS.known : LIVING_GREETINGS.stranger;
    this._greeted.set(res.id, this._now);
    // a stranger says something only now and then (and always when the player stops before them)
    if (pool === LIVING_GREETINGS.stranger && !stopped && (lwSeed(textSeed(res.id), Math.floor(this._now)) % 4) !== 0) return;
    const text = fillLine(pool[lwSeed(textSeed(res.id), Math.floor(this._now / 7)) % pool.length], { player: this.o.playerName?.() ?? '' });
    this._greetings = this._greetings.filter((g) => g.person !== person && g.until > this._realNow);
    this._greetings.push({ person, text, until: this._realNow + GREET_S });
    rel?.seen(res.id, day);
  }

  /**
   * What is being said on the street this moment: each talking circle's line (pure - every reader hears it), and the
   * words to the player. Only the residents standing, within `range` of `eye` (location frame).
   * @param {number[]} eye @param {number} [range]
   * @returns {{ person: any, text: string, kind: 'talk' }[]}
   */
  speech(eye, range = LINE_RANGE) {
    const out = [];
    const lineMin = lineMinutes(this._baseRate());
    const hour = Math.floor((((this._now % DAY_MIN) + DAY_MIN) % DAY_MIN) / 60);
    const ctx = { town: this.o.townName, region: this.o.regionName, weather: this.o.weather?.() ?? null, hour };
    this._greetings = this._greetings.filter((g) => g.until > this._realNow);
    for (const row of this.pool) {
      if (!row.visible || !row.res) continue;
      const p = row.person;
      if (Math.hypot(p.pos[0] - eye[0], p.pos[2] - eye[2]) > range) continue;
      const c = this._inCircle.get(row.res.id);
      if (c) {
        const line = circleLine(c.circle, this._now, lineMin, ctx);
        if (line && line.who.id === row.res.id) out.push({ person: p, text: line.text, kind: /** @type {'talk'} */ ('talk') });
        continue;
      }
      const g = this._greetings.find((x) => x.person === p);
      if (g) out.push({ person: p, text: g.text, kind: /** @type {'talk'} */ ('talk') });
    }
    return out;
  }

  /** RR2's trample, and any seam that takes a walker off the street: that resident is gone for the day. */
  retire(person) {
    for (const r of this.pool) {
      if (r.person !== person) continue;
      if (r.res) this._take(r.res);
      this._free(r);
      return true;
    }
    return false;
  }

  /** The player spoke with this body: a word noted in the resident's regard. Answers the resident's id, or null. */
  talked(person) {
    const id = person?.living?.id;
    if (!id) return null;
    this.o.relations?.()?.note(id, 'talk', this.dayOf(this._now));
    return id;
  }

  /** LW3: a hand caught in a body's resident's purse - a crime they saw, noted in their regard. */
  caught(person) {
    const id = person?.living?.id;
    if (!id) return null;
    this.o.relations?.()?.note(id, 'crime', this.dayOf(this._now));
    return id;
  }

  /** What a body's resident says instead of talking, when they count the player an enemy - else null. */
  refuses(person) {
    const id = person?.living?.id;
    const rel = this.o.relations?.();
    if (!id || !rel) return null;
    const s = rel.standing(id, this.dayOf(this._now));
    return s === 'enemy' || s === 'hostile' ? fillLine(LIVING_REFUSAL, { a: firstNameOf(person.nameNPC) }) : null;
  }
}
