// @ts-check
// TIMERS1 (2026-10-02, Mac: "we need to create a new unique UI element for reset times like the Sunday wars, oblivion
// gates, town raids, and anything else so the player can keep track of when things are and watch countdowns").
//
// THE SCHEDULE, AS ROWS. Every shared moment of the online world is already a pure function of the relay's clock in
// its own law - the gate's day (net/gateLaw.js), the seat week's Reckoning and Turning (net/townSeatLaw.js), a game
// day's turnover and the UTC day's - or a fact the client already holds (the week's battles in the seats list, the
// day's raids the mod rolled). This module derives nothing of its own: it asks those laws and lays their answers out
// as one list a window can draw, each row either LIVE (running now, counting down to its end) or COMING (counting down
// to its start). It reads no globals; the host hands in the relay's now and what it holds.
//
// A row: { id, kind, title, where, detail, live, at, until }
//   at     the moment the countdown runs to (ms, relay clock): the start of a coming row, the end of a live one
//   until  a live row's end; null on a coming row
import { gateAt, gateTimes, gatePhase, GATE_EVERY_DAYS, gameDayAt, GATE_DAY_MINUTES } from '../net/gateLaw.js';
import { wallMsForClassicMinutes } from '../net/wire.js';
import { seatWeekOf, seatWeekStartMs, seatPhaseOf, SEAT_RECKONING_MS, seasonOf, seatSeasonName, battleLengthMs, SIGN_CLOSES_MS } from '../net/townSeatLaw.js';

const DAY_MS = 86_400_000;

/** The battle kinds in the words a seat's own tab uses for them. */
const BATTLE_TITLE = Object.freeze({ siege: (n) => `Siege of ${n}`, tourney: (n) => `Tourney at ${n}`, revolt: (n) => `Revolt at ${n}` });

const capital = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * @param {{ now: number,
 *           gate?: { place?: string|null, fellAt?: (day: number) => (number|null) } | null,
 *           seats?: Array<any> | null, zero?: number | null,
 *           raids?: Array<{ name: string, region?: string, type?: string, startMs: number, endMs: number, done?: boolean }> | null }} src
 */
export function eventTimerRows(src) {
  const now = Number(src?.now);
  if (!Number.isFinite(now)) return [];
  /** @type {Array<{id: string, kind: string, title: string, where: string|null, detail: string|null, live: boolean, at: number, until: number|null}>} */
  const rows = [];
  const coming = (id, kind, title, at, where = null, detail = null) => rows.push({ id, kind, title, where, detail, live: false, at, until: null });
  const live = (id, kind, title, until, where = null, detail = null) => rows.push({ id, kind, title, where, detail, live: true, at: until, until });

  // ── THE OBLIVION GATE (gateLaw: a gate every game day - omen, rise, open, seal, wrath) ──
  const t = gateAt(now);
  const fell = src?.gate?.fellAt?.(t.day) ?? null;
  const phase = gatePhase(t, now, fell);
  const place = src?.gate?.place ? `Near ${src.gate.place}` : null;
  // (gateLaw's words: 'sealed' is the risen gate not yet open, 'closed' the gate shut for the night)
  if (phase === 'quiet') coming(`gate:${t.day}`, 'gate', 'Oblivion Gate opens', t.openAt, null, 'Its omen burns in the sky 15 minutes before');
  else if (phase === 'omen' || phase === 'rising' || phase === 'sealed') coming(`gate:${t.day}`, 'gate', 'Oblivion Gate opens', t.openAt, place, 'The omen is in the sky');
  else if (phase === 'open') live(`gate:${t.day}`, 'gate', 'Oblivion Gate open', t.sealAt, place, 'Seals when this runs out - get inside');
  else if (phase === 'closed') live(`gate:${t.day}`, 'gate', 'Oblivion Gate sealed', t.wrathAt, place, 'Collapses when this runs out');
  // ...and the gate after it, once this one is under way
  if (phase !== 'quiet') coming(`gate:${t.day + GATE_EVERY_DAYS}`, 'gate', 'Next Oblivion Gate opens', gateTimes(t.day + GATE_EVERY_DAYS).openAt);

  // ── THE TOWN RAIDS (the mod's day: each town's raid a two-hour classic window) ──
  for (const r of src?.raids ?? []) {
    if (!r || !Number.isFinite(r.startMs) || !Number.isFinite(r.endMs) || r.endMs <= now || r.done) continue;
    const where = r.region ? `In ${r.region}` : null;   // the title names the town
    const who = r.type ? capital(r.type) : null;
    if (r.startMs > now) coming(`raid:${r.name}:${r.startMs}`, 'raid', `Raid on ${r.name}`, r.startMs, where, who ? `${who} attack` : null);
    else live(`raid:${r.name}:${r.startMs}`, 'raid', `Raid on ${r.name}`, r.endMs, where, who ? `${who} withdraw when this runs out` : null);
  }

  // ── THE GAME DAY (two real hours: the bounty board's hunts and the raids roll with it) ──
  const nextDay = Math.round(wallMsForClassicMinutes((gameDayAt(now) + 1) * GATE_DAY_MINUTES));
  coming('gameday', 'reset', 'New game day', nextDay, null, 'New bounty hunts and town raids');

  // ── THE UTC DAY (the daily caps: gathering, hauls, Court writs, the Watch) ──
  coming('daily', 'reset', 'Daily reset', (Math.floor(now / DAY_MS) + 1) * DAY_MS, '00:00 UTC', 'Gathering, hauls, Court writs and the Watch\'s daily limits');

  // ── THE SEAT WEEK (Muster, Reckoning, the Turning - Sunday 18:00 UTC) ──
  const week = seatWeekOf(now);
  const turningAt = seatWeekStartMs(week + 1);
  const reckoningAt = turningAt - SEAT_RECKONING_MS;
  if (seatPhaseOf(now) === 'muster') coming('reckoning', 'seat', 'The Reckoning', reckoningAt, 'Friday 18:00 UTC', 'Pledges lock until the Turning');
  else live('reckoning', 'seat', 'The Reckoning', turningAt, 'Pledges are locked', 'Ends at the Turning');
  coming('turning', 'seat', 'The Turning', turningAt, 'Sunday 18:00 UTC', 'Seats change hands; writs, weekly caps and the Tides reset');
  const season = seasonOf(week, src?.zero ?? null);
  if (season) {
    const name = seatSeasonName(season.n);
    if (name) coming(`season:${season.n}`, 'seat', `${capital(name)} ends`, seatWeekStartMs(season.end), 'At its last Turning');
  }

  // ── THE WEEK'S BATTLES (the seats list the service sends: sieges, tourneys, revolts; the Royal Tourney) ──
  for (const s of src?.seats ?? []) {
    const name = s?.name ?? s?.key ?? 'a seat';
    const b = s?.battle;
    if (b && b.state === 'scheduled' && Number.isFinite(b.startsAt)) {
      const start = b.startsAt * 1000;
      const end = Number.isFinite(b.endsAt) ? b.endsAt * 1000 : start + battleLengthMs({ kind: b.kind, tier: s.tier });
      const title = (BATTLE_TITLE[b.kind] ?? BATTLE_TITLE.siege)(name);
      const sides = b.guild && b.against ? `${b.guild} against ${b.against}` : b.guild ?? null;
      if (end <= now) continue;
      if (start > now) coming(`battle:${s.key ?? name}`, 'battle', title, start, sides, `Rosters close ${Math.round(SIGN_CLOSES_MS / 60_000)} minutes before`);
      else live(`battle:${s.key ?? name}`, 'battle', title, end, sides, 'Under way');
    }
    if (s?.holder?.edict === 'royal-tourney') live(`royal:${s.key ?? name}`, 'battle', `Royal Tourney at ${name}`, turningAt, null, 'The champion is named at the Turning');
  }

  // live first (soonest end first), then what is coming (soonest first)
  return rows.sort((a, b) => (a.live === b.live ? a.at - b.at : a.live ? -1 : 1));
}

/** A countdown in the window's words: "2d 04h" past a day, "1:05:09" past an hour, "4:07" under it, "0:00" at the end. */
export function timerText(ms) {
  const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const two = (n) => String(n).padStart(2, '0');
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${two(h)}h`;
  if (h > 0) return `${h}:${two(m)}:${two(sec)}`;
  return `${m}:${two(sec)}`;
}

const WEEKDAYS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
/** The moment in the player's own clock: "18:00" today, "Sun 18:00" another day. `wallMs` is this machine's ms. */
export function localWhenText(wallMs, todayMs = Date.now()) {
  const d = new Date(wallMs), t = new Date(todayMs);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const sameDay = d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  return sameDay ? hm : `${WEEKDAYS[d.getDay()]} ${hm}`;
}
