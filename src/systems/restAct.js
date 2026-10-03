// REST1 (2026-10-03, bible/06-Systems/Rest-Arc.md; Mac: "Resting is no longer time based online with campfires, beds,
// camping sets, being the main way to rest", then "Go") - THE REST ACT ONLINE.
//
// Online a rest is no longer hours on a dial. It is an ACT at a REST POINT - a lit fire (a placed Campfire, a tent's
// fire, a world brazier or hearth), a bed where DFU lets you sleep indoors - and it is ONE NIGHT: the character's own
// clock moves eight hours in a single step, so everything that reads their time (spells, diseases, needs, rooms,
// training, guild waits - the arc's 29-row census, section 7) sees exactly the eight hours a rest gave it before.
//
// THE NIGHT IS THE SAME NIGHT. It is the timed rest's own RestSession - its sub-ticks, its quest ticks, its hourly
// enemy check, its vitals, its rent count - run to its end in one call instead of paced over the window's timer, with
// the host's own rest deps (scenes/shared.js createRestDeps). Nothing a sub-tick does is restated here, so nothing can
// drift from what an eight-hour rest does everywhere else. The resting encounter roll still rides each sub-tick's
// advance at the odds it always had; a foe it spawns breaks the night at the hour it lands, as it always did.
//
// THE NIGHT INTERVAL. A night passes at most once per NIGHT_INTERVAL_MINUTES of the character's clock since the last
// one ended (two hours: ten real minutes of play, the character's clock running at TimeScale 12). Inside it a rest is
// a SHORT REST: it heals, and nothing else - no clock moves, nothing ages, no encounter rolls. A fire is a place to
// recover, never a fast-forward button.
//
// THE YIELD. A night at a bed or a fire, or any rest the tier prices whole (Casual's rough, or the arc off), ends full:
// health, fatigue and magicka (online no career rests short of its magicka - REST-MANA1). A rough night the tier prices
// at half (Hard's) keeps what its eight hours gave. A short rest heals in full where the tier prices whole, and half of
// what is missing where it does not.
//
// Offline nothing here runs: DFU's rest window, byte for byte.

import { RestSession, REST_TEXT, REST_WAIT_PER_HOUR } from './restSession.js';
import { restCost } from './survival/rest.js';

/** A night: DFU's customary eight hours, on the character's own clock. */
export const NIGHT_HOURS = 8;
export const NIGHT_MINUTES = NIGHT_HOURS * 60;
/** Two hours of the character's clock between nights - ten real minutes of play. */
export const NIGHT_INTERVAL_MINUTES = 120;
/** The character's clock runs at TimeScale 12 while they play: twelve of its minutes a real minute. */
export const OWN_MINUTES_PER_REAL_MINUTE = 12;
/** The act's hold, in real seconds: long enough to need safety, short enough not to bore. */
export const REST_CHANNEL_SECONDS = 6;
/** A day of a rented room, in the character's minutes - a night online spends one. */
export const ROOM_DAY_MINUTES = 24 * 60;

export const REST_ACT_TEXT = Object.freeze({
  noPoint: 'Find a fire or a bed to rest.',
  inTown: 'It is illegal to camp in town.',
  shortRest: 'You rest a while.',
  interrupted: 'Your rest is interrupted.',
  channel: (where) => `Resting by the ${where}...`,
  channelBed: 'Resting...',
  nextNight: (minutes) => `A night can pass again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,
  rested: 'Rested',
});

/** Whether a night may pass now: none yet, the interval run out, or a clock behind the stamp (a load from another
 *  timeline) - never a night refused for a stamp from the future. */
export function nightDue(entity, ownNow) {
  const at = entity?.restNightAt;
  if (!Number.isFinite(at) || !Number.isFinite(ownNow)) return true;
  return ownNow < at || ownNow - at >= NIGHT_INTERVAL_MINUTES;
}

/** Real minutes until a night may pass again (0 when one may now) - the Rested tile's foot. */
export function nightRealMinutesLeft(entity, ownNow) {
  if (nightDue(entity, ownNow)) return 0;
  return Math.max(1, Math.ceil((NIGHT_INTERVAL_MINUTES - (ownNow - entity.restNightAt)) / OWN_MINUTES_PER_REAL_MINUTE));
}

/** The night's end, stamped on the character's clock. */
export function stampNight(entity, ownNow) {
  if (entity && Number.isFinite(ownNow)) entity.restNightAt = Math.floor(ownNow);
}

/**
 * One night: the timed rest's own session, eight hours, run to its end in one call. `deps` is the host's rest bag
 * (createRestDeps' output); `rentedHours` is CanRest's out-parameter, so a room that runs out mid-night ends the night
 * with the landlord's line, as an eight-hour rest always has. Answers the session's own result and the hours slept.
 */
export function runRestNight(deps, { rentedHours = -1, hours = NIGHT_HOURS } = {}) {
  const s = new RestSession('timed', hours, deps, rentedHours, null);
  const hourDt = (REST_WAIT_PER_HOUR / 10) * 6;   // one hour's six sub-ticks of the session's own timer
  let r = null;
  // each call owes about one hour; the guard is twice the night, so a float that falls a sub-tick short each call
  // still finishes, and a session that never answers cannot hang the frame
  for (let i = 0; r === null && i < hours * 2 + 4; i++) r = s.tick(hourDt);
  return { result: r ?? s._finish(REST_TEXT.wakeUp), hours: s.totalHours };
}

/** Whether the tier prices a rest of this kind whole (a bed, a fire, Casual's rough, the arc off). */
export const restPricedWhole = (kind, rules) => !rules || (restCost(kind, rules)?.recovery ?? 1) >= 1;

/**
 * The yield's top-up. `maxFatigueOf` is the host's (statMods.maxFatigue). A night or short rest priced whole ends
 * full; a short rest priced at half heals half of what is missing; a night priced at half keeps what its hours gave.
 */
export function topUpRest(entity, kind, rules, { night = true, maxFatigueOf = (e) => e.maxFatigue ?? 0 } = {}) {
  if (!entity) return;
  const fill = (cur, max, frac) => Math.min(max, Math.round((cur ?? 0) + Math.max(0, max - (cur ?? 0)) * frac));
  const frac = restPricedWhole(kind, rules) ? 1 : night ? 0 : 0.5;
  if (frac <= 0) return;
  entity.health = fill(entity.health, entity.maxHealth ?? 0, frac);
  entity.fatigue = fill(entity.fatigue, maxFatigueOf(entity), frac);
  if (Number.isFinite(entity.maxMagicka)) entity.magicka = fill(entity.magicka, entity.maxMagicka, frac);
}

/** A rented room's night: the night's eight hours already ran off its expiry; the rest of the day goes with them, so a
 *  day rented is a night slept (the arc's OPEN 10). A room with less than a day left is simply spent. */
export function spendRoomNight(room) {
  if (!room || !Number.isFinite(room.expiryMinutes)) return;
  room.expiryMinutes -= ROOM_DAY_MINUTES - NIGHT_MINUTES;
}
