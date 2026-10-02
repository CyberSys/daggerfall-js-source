// TIMEFREE (2026-10-02, Mac: "we recently adjusted quest timing for online and im really getting tired of it ... Is there
// a way we can overhaul online quests to not use time and edit anything questwise to make since that depends on time?";
// asked, a waiting step online is a "Short real wait", and the bounties, the curse quests and the crime-guild letters go
// time-free too). Online a deadline never runs out, a delay lands on the short wait, the scripts' day counts read "a
// few", no surface shows time left, a letter waits for town alone, a bounty never lapses, the curse quests come one at
// a time on the short wait and a crime guild's letter after it. Offline, DFU's clock, whole. The real scripts, parsed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { clockIsDeadline, ONLINE_DELAY_SECONDS, ONLINE_DEADLINES, questTimeFree } from '../src/systems/quest/clock.js';
import { handleStartingCrimeGuildQuests, setCrimeGuildQuestHost, CRIME_GUILD_LETTER_DELAY_MINUTES, CRIME_GUILD_LETTER_ONLINE_MINUTES } from '../src/systems/crimeGuilds.js';
import { racialArmIdle, setRacialQuestHost, ONLINE_RACIAL_INTERVAL_MINUTES } from '../src/systems/racialQuests.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/^﻿/, '');
{
  const sources = {};
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Tables'))) if (f.endsWith('.txt')) sources[f.replace('.txt', '')] = rd(join('vendor/dfu-quests/Tables', f));
  loadQuestTables(sources);
}
const parse = (name, online = false, now = { s: 0 }) => {
  const lines = rd(`vendor/dfu-quests/Quests/${name}.txt`).split(/\r?\n/);
  return new QuestMachine({ nowSeconds: () => now.s, showPopup() {}, getQuestSourceLines: () => lines, sharedClock: () => online }).parseQuestShape(name);
};
const kind = (q, n) => {
  const c = q.resources.get(n);
  assert.ok(c?.isClock, `${q.questName} has the clock ${n}`);
  return c.isDeadline ? 'deadline' : 'delay';
};

test('TIMEFREE: the reading - a clock whose end loses the quest, costs a standing or shuts a reward waiting on it is a deadline; a letter, a page, a meeting, a reward after a wait is a delay (mutants: the reading inverted, a standing not counted, the not-reward arm dropped)', () => {
  const brisienna = parse('_BRISIEN');
  assert.equal(kind(brisienna, 'invitepc'), 'delay', 'her invitation comes - WORLD1 froze it and the main quest never began');
  assert.equal(kind(brisienna, 'pcfailed'), 'deadline', 'her fortnight: -15 with her and the main quest stopped');
  assert.equal(kind(parse('A0C01Y03'), 'S.01'), 'deadline', 'ninety days, then `end quest`');
  const kavar = parse('S0000500');
  assert.equal(kind(kavar, 'S.00'), 'delay', 'Lord K\'avar\'s letter (31-93 days)');
  assert.equal(kind(kavar, 'firsttimer'), 'deadline', '`when _firsttimer_ and not _S.03_`: a rumour, and the quest lost');
  assert.equal(kind(parse('K0C00Y02'), '2mondung'), 'delay', 'two months, then the gold is yours (`give pc nothing` is the success)');
  assert.equal(kind(parse('A0C00Y16'), 'delay'), 'delay', 'the gold after the wait');
  assert.equal(kind(parse('A0C00Y00'), 'traveltime'), 'deadline', 'the travel-time limit');
  assert.equal(kind(parse('O0B00Y11'), 'S.01'), 'deadline', 'the heist is paid only `when ... not _S.01_` - its end shuts the reward');
  assert.equal(kind(parse('S0000008'), 'brisiennafirstletter'), 'delay');
  assert.equal(kind(parse('_TUTOR__'), 'page1'), 'delay', 'the tutorial\'s pages');
  assert.equal(kind(parse('N0B20Y02'), 'S.12'), 'delay', 'the trance ends (`hide npc`)');
});

test('TIMEFREE: the penalties the reading cannot see are deadlines by hand - the cure quests\' hunters, the monster\'s escape, the mark leaving, Brisienna\'s month (AUDIT TIMEFREE T6) (mutants: the table emptied)', () => {
  assert.deepEqual(Object.keys(ONLINE_DEADLINES).sort(), ['$CUREVAM', '$CUREWER', 'M0B11Y18', 'U0C00Y00', '_BRISIEN']);
  for (const [quest, clocks] of Object.entries(ONLINE_DEADLINES)) {
    const q = parse(quest);
    for (const c of clocks) {
      assert.equal(clockIsDeadline(q, q.resources.get(c)), false, `${quest}:${c} reads as a delay - why it is in the table`);
      assert.equal(kind(q, c), 'deadline', `${quest}:${c}, by hand`);
    }
  }
});

test('TIMEFREE: every vendored clock is read, and the split stands where this change left it - a script or rule change that moves it is seen (mutants: the reading inverted)', () => {
  let deadlines = 0, delays = 0;
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Quests')).sort()) {
    if (!f.endsWith('.txt')) continue;
    let q = null;
    try { q = parse(f.replace('.txt', '')); } catch { continue; }
    for (const r of q?.resources.values() ?? []) if (r.isClock) { if (r.isDeadline) deadlines++; else delays++; }
  }
  assert.deepEqual({ deadlines, delays }, { deadlines: 262, delays: 137 });   // AUDIT TIMEFREE: 279/120 before T1-T6
});

test('TIMEFREE: online a deadline is charged nothing and never runs out; a delay lands on the short wait; offline both are DFU\'s (mutants: online charged, the wait never cut)', () => {
  const now = { s: 1000 };
  const on = parse('A0C01Y03', true, now);
  const limit = on.resources.get('S.01');
  limit.startTimer();
  now.s += 200 * 86400;   // two hundred days
  limit.tick(on);
  assert.equal(limit.clockFinished, false, 'online: ninety days do not run out');
  assert.equal(limit.remainingTimeInSeconds, 90 * 86400, '...and are charged nothing');
  assert.equal(limit.liveRemainingSeconds(on), 90 * 86400);

  const off = parse('A0C01Y03', false, now);
  const offLimit = off.resources.get('S.01');
  offLimit.startTimer();
  now.s += 91 * 86400;
  offLimit.tick(off);
  assert.equal(offLimit.clockFinished, true, 'offline: DFU\'s ninety days');

  const kavar = parse('S0000500', true, now);
  const letter = kavar.resources.get('S.00');
  letter.startTimer();
  now.s += ONLINE_DELAY_SECONDS - 60;
  letter.tick(kavar);
  assert.equal(letter.clockFinished, false, 'a minute short of the wait');
  assert.equal(letter.liveRemainingSeconds(kavar), 60);
  now.s += 60;
  letter.tick(kavar);
  assert.equal(letter.clockFinished, true, 'the letter lands on the short wait, not 31 days on');
  assert.equal(ONLINE_DELAY_SECONDS, 24 * 60, 'twenty-four minutes of the character\'s clock - about two real minutes of play at 12:1');
});

test('TIMEFREE: online a clock\'s day count reads "a few" - "within a few days", "I have a few days" - and offline the number (mutants: the count kept online)', () => {
  const on = parse('A0C01Y03', true);
  const off = parse('A0C01Y03', false);
  assert.equal(on.resources.get('S.01').expandMacro(5), 'a few');
  assert.equal(off.resources.get('S.01').expandMacro(5), '90');
  assert.equal(questTimeFree(on), true);
  assert.equal(questTimeFree(off), false);
});

test('TIMEFREE: online a quest letter waits for town alone, not for the sky\'s morning; the journal walk shows no time; a bounty never lapses online (mutants: the morning kept online, the walk read online, the lapse kept)', () => {
  const actions = rd('src/systems/quest/actions.js');
  assert.match(actions, /const night = !hooks\?\.sharedClock\?\.\(\) && \(now\.hour < minHour \|\| now\.hour > maxHour\);\n\s+if \(!hooks\?\.isPlayerInTown\?\.\(\) \|\| night\) \{/);
  assert.match(rd('src/scenes/questBridge.js'), /if \(!questTimeFree\(q\)\) for \(const r of q\.resources\.values\(\)\) \{/);
  const bounty = rd('src/scenes/bountyHost.js');
  assert.match(bounty, /for \(const gone of \(sharedClockOn\(\) \? \[\] : lapseBounties\(ledger, now\)\)\) \{/);
  assert.match(bounty, /clockSeconds: sharedClockOn\(\) \? null : bountyMinutesLeft\(h, now\) \* 60,/);
});

test('TIMEFREE: online a crime guild\'s letter is due the short wait after the tally reached it; offline three days (mutants: online kept at three days)', () => {
  const started = [];
  const prev = setCrimeGuildQuestHost({ startQuest: (n) => started.push(n) });
  try {
    const stamp = 5000 + CRIME_GUILD_LETTER_DELAY_MINUTES;   // the tally reached its mark at minute 5000
    const entity = () => ({ thievesGuildRequirementTally: 10, timeForThievesGuildLetter: stamp, darkBrotherhoodRequirementTally: 0, timeForDarkBrotherhoodLetter: 0 });
    assert.deepEqual(handleStartingCrimeGuildQuests(entity(), { nowClassicMinutes: 5000 + CRIME_GUILD_LETTER_ONLINE_MINUTES - 1, online: true }), []);
    assert.equal(handleStartingCrimeGuildQuests(entity(), { nowClassicMinutes: 5000 + CRIME_GUILD_LETTER_ONLINE_MINUTES + 1, online: true }).length, 1, 'online: the short wait');
    assert.deepEqual(handleStartingCrimeGuildQuests(entity(), { nowClassicMinutes: 5000 + CRIME_GUILD_LETTER_ONLINE_MINUTES + 1 }), [], 'offline: not yet');
    assert.equal(CRIME_GUILD_LETTER_ONLINE_MINUTES, 24);
  } finally { setCrimeGuildQuestHost(prev); }
});

test('TIMEFREE: online the curse\'s quests roll on the short wait, each arm only while it has nothing running; offline the 38 and 84 days (mutants: the idle check dropped, both arms on online)', () => {
  const live = [];
  const prev = setRacialQuestHost({ activeQuestNames: () => live });
  try {
    assert.equal(racialArmIdle(false), true);
    assert.equal(racialArmIdle(true), true);
    live.push('P0B00L04');
    assert.equal(racialArmIdle(false), false, 'a clan quest running: no second');
    assert.equal(racialArmIdle(true), true, '...the cure arm is its own');
    live.push('$CUREVAM');
    assert.equal(racialArmIdle(true), false);
  } finally { setRacialQuestHost(prev); }
  assert.equal(racialArmIdle(false), false, 'no host, no arm');
  assert.equal(ONLINE_RACIAL_INTERVAL_MINUTES, 24);
  const tick = rd('src/systems/worldTick.js');
  assert.match(tick, /if \(ownArms && !timeFree\) startRacialOverrideQuest\(entity, false, \{ rolls \}\);/);
  assert.match(tick, /if \(ownArms && !timeFree && i % CURE_QUEST_INTERVAL_MINUTES === 0\) \{/);
  assert.match(tick, /if \(ownArms && timeFree && i % ONLINE_RACIAL_INTERVAL_MINUTES === 0\) \{\n\s+if \(racialArmIdle\(false\)\) startRacialOverrideQuest\(entity, false, \{ rolls \}\);\n\s+if \(racialArmIdle\(true\)\) startRacialOverrideQuest\(entity, true, \{ rolls \}\);/);
  assert.match(tick, /handleStartingCrimeGuildQuests\(entity, \{ nowClassicMinutes: next, inside, online: sharedClockOn\(\) \}\);/);
});
