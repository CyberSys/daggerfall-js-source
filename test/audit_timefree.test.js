// AUDIT TIMEFREE (2026-10-02, Mac: "Audit this and ensure its perfect", of TIMEFREE + WEAR-ONE;
// bible/01-Overview/Audit-Timefree.md). Every vendored clock was read by hand against the reading, the main quest's
// whole, and each misreading found is pinned here over the real script: the closings that never closed (T1), the
// letters and arrivals a conditional `when` froze (T2), the endings a sequenced beat froze and the "at once" clocks
// (T3), the item a closing hands over and the reward that outranks it (T4), the limit taken after the reward (T5), and
// Brisienna's month (T6).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuestMachine } from '../src/systems/quest/machine.js';
import { loadQuestTables } from '../src/systems/quest/tables.js';
import { clockIsDeadline, ONLINE_CLOSINGS, ONLINE_DELAY_SECONDS } from '../src/systems/quest/clock.js';

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

test('AUDIT TIMEFREE T1: a clock its starter starts AFTER settling the quest - the reward handed over, the next quest begun, a deadline already lost - is the script closing it, a delay; frozen, those quests stood open for ever (mutants: the closing rule dropped, the starter read whole)', () => {
  assert.equal(kind(parse('M0B40Y05'), 'end'), 'delay', '`give pc _gold_`, then `start timer _end_` (00:00), then `end quest`');
  assert.equal(kind(parse('_BRISIEN'), 'oneday'), 'delay', 'a day after meeting her (whose `start task` starts the main quest) or after her fortnight ran out');
  assert.equal(kind(parse('S0000007'), 'delay'), 'delay', 'the main quest: `start quest 12 12`, then the close');
  assert.equal(kind(parse('S0000988'), 'delay'), 'delay');
  assert.equal(kind(parse('A0C01Y06'), 'S.13'), 'delay', '`give pc nothing`, a day, the close');
  // ...and what is NOT a closing
  assert.equal(kind(parse('S0000500'), 'escapetime'), 'deadline', 'the traitor scene pays only `when` the contact is met too - the starter\'s own deeds settle nothing, and the escape is a real limit');
  assert.equal(kind(parse('A0C41Y18'), 'S.10'), 'deadline', 'the start-up block\'s `give pc nothing` starts no closing: the finger and the gold are kept their 1001 days');
});

test('AUDIT TIMEFREE T1: the closing after a failure the reading cannot see is a delay by hand, and reads as a deadline without the table; the two that close `when` the failure and the clock both stand read as delays on their own (mutants: the table emptied)', () => {
  assert.deepEqual(Object.entries(ONLINE_CLOSINGS).map(([q, c]) => `${q}:${c.join(',')}`).sort(), ['R0C11Y03:2ndparton']);
  assert.equal(kind(parse('N0B20Y02'), 'S.09'), 'delay', '`when _S.07_ and _S.09_` - the revenge week closes the failed quest');
  assert.equal(kind(parse('N0B10Y03'), 'S.10'), 'delay', '`when _S.10_ and _S.07_` - the unguarded hall\'s hour closes it');
  for (const [quest, clocks] of Object.entries(ONLINE_CLOSINGS)) {
    const q = parse(quest);
    for (const c of clocks) {
      assert.equal(clockIsDeadline(q, q.resources.get(c)), true, `${quest}:${c} reads as a deadline - why it is in the table`);
      assert.equal(kind(q, c), 'delay', `${quest}:${c}, by hand`);
    }
  }
});

test('AUDIT TIMEFREE T1/T5: online, once the quest is a SUCCESS a deadline a task started before it closes on the short wait; one started after it - a new limit - and one the start-up block started stay frozen; the mark rides the save (mutants: the run-time half dropped, the after-success mark ignored, the mark not saved)', () => {
  const now = { s: 1000 };
  const q = parse('S0000009', true, now);
  const close = q.resources.get('S.14');
  close.startTimer();   // the contact clicked...
  assert.equal(close.isDeadline, true, '...the reward not yet paid');
  now.s += 5 * 86400;
  close.tick(q);
  assert.equal(close.clockFinished, false, 'not a success yet: frozen');
  q.questSuccess = true;   // ...and S.01 pays on the same click
  assert.equal(close.isDeadline, false);
  now.s += ONLINE_DELAY_SECONDS;
  close.tick(q);
  assert.equal(close.clockFinished, true, 'the quest closes on the short wait');

  const raid = parse('M0B11Y18', true, now);
  raid.questSuccess = true;   // the raid paid (S.18)...
  const hunt = raid.resources.get('gettraitor');
  hunt.startTimer();   // ...then the traitor's hunt taken (S.23)
  assert.equal(hunt.startedAfterSuccess, true);
  assert.equal(hunt.isDeadline, true, 'a new limit, taken after the reward: frozen, not closed');
  const saved = hunt.getSaveData();
  assert.equal(saved.startedAfterSuccess, true);
  const again = parse('M0B11Y18', true, now);
  again.questSuccess = true;
  const restored = again.resources.get('gettraitor');
  restored.restoreSaveData(saved);
  assert.equal(restored.isDeadline, true, 'a load keeps it a limit');
  restored.restoreSaveData({ ...saved, startedAfterSuccess: undefined });
  assert.equal(restored.startedAfterSuccess, false, 'a save from before the mark reads false');

  const finger = parse('A0C41Y18', true, now);
  finger.questSuccess = true;
  assert.equal(kind(finger, 'S.10'), 'deadline', 'the start-up block\'s 1001 days stay frozen through the success');
});

test('AUDIT TIMEFREE T2: what an end DOES costs a standing, not what a later conditional `when` may; a reward a "not yet" reader pays is its own, not a chain\'s (mutants: the lowering read whole, the not-reward read whole)', () => {
  assert.equal(kind(parse('K0C00Y05'), 'S.04'), 'delay', 'the letter after a few hours - only `when _S.09_ and _S.04_` (a misstep) costs the knight');
  assert.equal(kind(parse('M0B11Y18'), 'S.02'), 'delay', 'the traitor arrives - `when _S.18_ and not _S.02_` only says "not yet"');
  assert.equal(kind(parse('_BRISIEN'), 'pcfailed'), 'deadline', 'her fortnight lowers her own standing - still a deadline');
});

test('AUDIT TIMEFREE T3: `end quest` is a loss only when the end ALONE sets it off - the engine\'s own reading of the `when`; a clock declared at an explicit zero with no travel arm is "at once", never a deadline (mutants: the `alone` reading dropped, the at-once rule dropped)', () => {
  assert.equal(kind(parse('S0000016'), 'delay'), 'delay', 'the main quest\'s endings: `when _S.01_ and _S.02_ and _delay_` - a beat after the story, not a loss');
  assert.equal(kind(parse('S0000011'), 'S.01'), 'delay', 'Chapter 6 laid out after six days, `when _S.01_ and not _S.04_`');
  assert.equal(kind(parse('S0000500'), 'firsttimer'), 'deadline', '`when _firsttimer_ and not _S.03_` fires on the time-out alone: a loss');
  const favour = parse('S0000106');
  assert.equal(favour.resources.get('delay').declaredAtOnce, true, '`Clock _delay_ 00:00`');
  assert.equal(kind(favour, 'delay'), 'delay', 'the start-up favour lands at once');
  const travel = parse('S0000010').resources.get('itemindung');
  assert.equal(travel.declaredAtOnce, false, '`00:00 0 flag 17 range 0 2` is a trip, not "at once"');
  assert.equal(travel.isDeadline, true);
});

test('AUDIT TIMEFREE T4: a quest item handed over is progress (S0000002\'s letter43 after three to seven days, the main quest\'s next page); a reward a "not run out" reader settles outranks it (mutants: GetItem not progress, the settling reader outranked)', () => {
  assert.equal(kind(parse('S0000002'), 'S.15'), 'delay');
  assert.equal(kind(parse('O0B00Y11'), 'S.01'), 'deadline', 'the heist pays only `when ... not _S.01_` - its end, which hands the haul back as the posse comes, is the loss of that pay');
});

test('AUDIT TIMEFREE T6: Brisienna\'s month is a deadline by hand (a reminder and her fortnight - the deadline\'s first half); S0000011\'s letter of the same shape is the main quest\'s next page and stays a delay (mutants: remindpc out of the table)', () => {
  const b = parse('_BRISIEN');
  assert.equal(clockIsDeadline(b, b.resources.get('remindpc')), false, 'the reading alone calls it a delay');
  assert.equal(kind(b, 'remindpc'), 'deadline');
  assert.equal(kind(b, 'invitepc'), 'delay', 'the invitation still comes');
  assert.equal(kind(parse('S0000011'), 'S.11'), 'delay', 'letter40 comes');
});

test('AUDIT TIMEFREE: the main quest\'s deadlines, every one read by hand - each a lost limit, a trip, a lifetime or a long-stop; the list moves only on purpose (mutants: the reading inverted)', () => {
  const main = [];
  for (const f of readdirSync(join(ROOT, 'vendor/dfu-quests/Quests')).sort()) {
    if (!/^(S0000|_BRISIEN)/.test(f)) continue;
    const q = parse(f.replace('.txt', ''));
    for (const r of q?.resources.values() ?? []) if (r.isClock && r.isDeadline) main.push(`${q.questName}:${r.symbol.name}`);
  }
  assert.deepEqual(main, [
    'S0000002:1stparton', 'S0000003:2shedungent', 'S0000004:2ndgo', 'S0000005:2shedungent', 'S0000006:queston',
    'S0000007:2mondung', 'S0000007:2ndparton', 'S0000008:oneyear', 'S0000009:S.14', 'S0000010:itemindung',
    'S0000011:S.18', 'S0000012:S.07', 'S0000013:2myndung', 'S0000100:S.02', 'S0000101:S.02', 'S0000102:S.02',
    'S0000103:S.02', 'S0000104:S.02', 'S0000500:firsttimer', 'S0000500:executiondelay', 'S0000500:escapetime',
    'S0000501:patsy', 'S0000501:time2', 'S0000502:S.03', 'S0000503:S.02', 'S0000503:S.10', 'S0000503:S.21',
    'S0000503:S.31', '_BRISIEN:remindpc', '_BRISIEN:pcfailed',
  ]);
});

test('AUDIT TIMEFREE T7: online a frozen deadline never fires, not even one armed at nothing (a travel clock whose places cannot be found answers 0); offline it fires on its first tick, DFU\'s own (mutants: the frozen guard dropped)', () => {
  const now = { s: 1000 };
  const on = parse('A0C01Y03', true, now);
  const limit = on.resources.get('S.01');
  limit.startTimer();
  limit.remainingTimeInSeconds = 0;   // armed at nothing
  limit.tick(on);
  assert.equal(limit.clockFinished, false, 'online: still frozen');
  const off = parse('A0C01Y03', false, now);
  const offLimit = off.resources.get('S.01');
  offLimit.startTimer();
  offLimit.remainingTimeInSeconds = 0;
  offLimit.tick(off);
  assert.equal(offLimit.clockFinished, true, 'offline: DFU\'s first-tick end');
});
