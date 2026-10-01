// @ts-check
// TIME1: THE SKY'S DATE FOR A MINUTE OF THE EVENT CLOCK (bible/06-Systems/Online-Time-Arc.md section 6.4).
//
// The weather keeps the event clock's pace online - rolled on its days, evolved on its hours, its systems born, moving
// and dying in its minutes - but the season and the hour a roll or a birth is drawn for are the SKY's at that instant:
// a winter sky never rolls summer rain, and a storm favours the afternoon the player sees. Both clocks are pure
// functions of the relay's clock, so an event minute names one instant and the sky has one reading there
// (skyClassicMinutes over wallMsForClassicMinutes) - no offset, no state, the same on every client.
//
// A LEAF: worldTick.js's setSharedClock switches it on with the sky it installs (and off with the clock), so the
// weather's modules read it without importing the tick module and the side effects its import carries. Off - offline,
// or a shared clock installed with no sky (a test's bare source) - an event minute is its own sky minute, the one rate.
import { skyClassicMinutes } from '../net/skyLaw.js';
import { wallMsForClassicMinutes } from '../net/wire.js';

let _on = false;

/** TIME1: worldTick.js's setSharedClock - on while a shared clock stands with a sky beside it. */
export function setSkyCalendar(on) { _on = !!on; }
/** Whether an event minute maps onto a sky of its own (tests and the census). */
export const skyCalendarOn = () => _on;

/** TIME1: the sky's classic minute at the instant the event clock reads `eventMinutes` - the minute a season, a month
 *  or an hour of the day is read off for a law that walks the event clock. The minute itself when off. */
export const skyMinuteOfEvent = (eventMinutes) => (_on && Number.isFinite(eventMinutes) ? skyClassicMinutes(wallMsForClassicMinutes(eventMinutes)) : eventMinutes);
