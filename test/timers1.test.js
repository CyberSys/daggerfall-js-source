// TIMERS1 (2026-10-02, Mac: "we need to create a new unique UI element for reset times like the Sunday wars, oblivion
// gates, town raids, and anything else so the player can keep track of when things are and watch countdowns. Im
// thinking maybe an enhanced plus button on the pause menu next to the profile icon").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eventTimerRows, timerText, localWhenText } from '../src/systems/eventTimers.js';
import { timersMark, timersWindow, placeBeside } from '../src/ui/enhancedTimers.js';
import { gateTimes, gameDayAt, gateAt } from '../src/net/gateLaw.js';
import { seatWeekOf, seatWeekStartMs, SEAT_RECKONING_MS, BATTLE_LENGTH_MS } from '../src/net/townSeatLaw.js';
import { ENHANCED_CSS } from '../src/ui/enhancedStyle.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const byId = (rows, id) => rows.find((r) => r.id === id);
// Friday 2026-10-02 12:20 UTC - a Muster, a gate day, the Reckoning that evening
const NOW = Date.UTC(2026, 9, 2, 12, 20, 0);

test('TIMERS1: the gate\'s row is gateLaw\'s - coming to its opening, live to its seal, then to its collapse', () => {
  const t = gateAt(NOW);
  const before = eventTimerRows({ now: t.omenAt - 1000 });
  assert.equal(byId(before, `gate:${t.day}`).at, t.openAt, 'quiet: counts to the opening');
  assert.equal(byId(before, `gate:${t.day}`).live, false);
  const open = eventTimerRows({ now: t.openAt + 1000, gate: { place: 'Daggerfall' } });
  const g = byId(open, `gate:${t.day}`);
  assert.deepEqual([g.live, g.at, g.where], [true, t.sealAt, 'Near Daggerfall'], 'open: live to the seal, where it stands');
  assert.equal(byId(open, `gate:${t.day + 1}`).at, gateTimes(t.day + 1).openAt, '...and the next one after it');
  const shut = eventTimerRows({ now: t.sealAt + 1000 });
  assert.deepEqual([byId(shut, `gate:${t.day}`).live, byId(shut, `gate:${t.day}`).at], [true, t.wrathAt], 'sealed for the night: live to the collapse');
});

test('TIMERS1: the seat week is townSeatLaw\'s - the Reckoning and the Turning (Sunday 18:00 UTC), and a Season\'s end', () => {
  const rows = eventTimerRows({ now: NOW, zero: 0 });
  const turning = seatWeekStartMs(seatWeekOf(NOW) + 1);
  assert.equal(byId(rows, 'turning').at, turning);
  assert.equal(new Date(turning).getUTCDay(), 0, 'a Sunday');
  assert.equal(new Date(turning).getUTCHours(), 18, '18:00 UTC');
  assert.equal(byId(rows, 'reckoning').at, turning - SEAT_RECKONING_MS, 'the Muster counts to the Reckoning');
  assert.equal(byId(rows, 'reckoning').live, false);
  const reck = eventTimerRows({ now: turning - 3600_000 });
  assert.deepEqual([byId(reck, 'reckoning').live, byId(reck, 'reckoning').at], [true, turning], 'in the Reckoning: live to the Turning');
  assert.ok(rows.some((r) => r.id.startsWith('season:') && /ends$/.test(r.title)), 'a counted Season names its end');
  assert.ok(!eventTimerRows({ now: NOW }).some((r) => r.id.startsWith('season:')), 'no zero, no Season');
});

test('TIMERS1: the week\'s battles from the seats list - coming to the start, live to the end; the Royal Tourney to the Turning', () => {
  const start = NOW + 26 * 3600_000;
  const seats = [
    { key: 'w', name: 'Wayrest', tier: 'palace', battle: { kind: 'siege', guild: 'The Red Hand', against: 'Crows', startsAt: start / 1000, endsAt: null, state: 'scheduled' } },
    { key: 'v', name: 'Ilessan', tier: 'palace', battle: { kind: 'revolt', guild: 'Ilessan', startsAt: (NOW - 600_000) / 1000, endsAt: null, state: 'scheduled' } },
    { key: 'f', name: 'Old', tier: 'palace', battle: { kind: 'siege', startsAt: (NOW - 7200_000) / 1000, endsAt: (NOW - 3600_000) / 1000, state: 'scheduled' } },
    { key: 'x', name: 'Fought', tier: 'palace', battle: { kind: 'siege', startsAt: start / 1000, state: 'fought' } },
    { key: 's', name: 'Sentinel', tier: 'crown', holder: { edict: 'royal-tourney' } },
  ];
  const rows = eventTimerRows({ now: NOW, seats });
  const siege = byId(rows, 'battle:w');
  assert.deepEqual([siege.title, siege.where, siege.live, siege.at], ['Siege of Wayrest', 'The Red Hand against Crows', false, start]);
  const revolt = byId(rows, 'battle:v');
  assert.deepEqual([revolt.live, revolt.at], [true, NOW - 600_000 + BATTLE_LENGTH_MS.revolt], 'a revolt under way, to its two hours\' end');
  assert.equal(byId(rows, 'battle:f'), undefined, 'a battle already over says nothing');
  assert.equal(byId(rows, 'battle:x'), undefined, 'nor one fought');
  assert.equal(byId(rows, 'royal:s').at, seatWeekStartMs(seatWeekOf(NOW) + 1));
});

test('TIMERS1: the raids, the game day and the UTC day', () => {
  const raids = [
    { name: 'Gothway Garden', region: 'Daggerfall', type: 'orcs', startMs: NOW + 300_000, endMs: NOW + 900_000 },
    { name: 'Ashfield', region: 'Wayrest', type: 'bandits', startMs: NOW - 60_000, endMs: NOW + 540_000 },
    { name: 'Gone', startMs: NOW - 900_000, endMs: NOW - 60_000 },
    { name: 'Cleansed', startMs: NOW - 60_000, endMs: NOW + 60_000, done: true },
  ];
  const rows = eventTimerRows({ now: NOW, raids });
  const coming = rows.find((r) => r.title === 'Raid on Gothway Garden');
  assert.deepEqual([coming.live, coming.at, coming.where, coming.detail], [false, NOW + 300_000, 'In Daggerfall', 'Orcs attack']);
  const under = rows.find((r) => r.title === 'Raid on Ashfield');
  assert.deepEqual([under.live, under.at], [true, NOW + 540_000]);
  assert.ok(!rows.some((r) => /Gone|Cleansed/.test(r.title)), 'an ended or cleansed raid says nothing');
  const next = byId(rows, 'gameday').at;
  assert.equal(gameDayAt(next), gameDayAt(NOW) + 1, 'the next game day');
  assert.ok(gameDayAt(next - 1) === gameDayAt(NOW), '...at its first instant');
  assert.equal(byId(rows, 'daily').at, Date.UTC(2026, 9, 3), '00:00 UTC');
});

test('TIMERS1: live rows first, soonest end first; then what is coming, soonest first; nothing without a clock', () => {
  const rows = eventTimerRows({ now: NOW, raids: [{ name: 'A', startMs: NOW - 1, endMs: NOW + 5000 }] });
  const firstComing = rows.findIndex((r) => !r.live);
  assert.ok(rows.slice(0, firstComing).every((r) => r.live) && rows.slice(firstComing).every((r) => !r.live));
  for (let i = firstComing + 1; i < rows.length; i++) assert.ok(rows[i].at >= rows[i - 1].at);
  assert.deepEqual(eventTimerRows({ now: NaN }), []);
  assert.deepEqual(eventTimerRows(null), []);
});

test('TIMERS1: the words - a countdown in d/h, h:mm:ss or m:ss, and the moment in the player\'s own clock', () => {
  assert.equal(timerText(0), '0:00');
  assert.equal(timerText(-5000), '0:00');
  assert.equal(timerText(247_000), '4:07');
  assert.equal(timerText(3_909_000), '1:05:09');
  assert.equal(timerText(2 * 86400_000 + 4 * 3600_000 + 59_000), '2d 04h');
  const today = new Date(2026, 9, 2, 9, 0).getTime();
  assert.equal(localWhenText(new Date(2026, 9, 2, 18, 5).getTime(), today), '18:05');
  assert.equal(localWhenText(new Date(2026, 9, 4, 18, 0).getTime(), today), 'Sun 18:00');
});

// ── the window, over a document just real enough ──
function fakeDoc() {
  const node = (tag) => {
    const n = { tag, children: [], className: '', textContent: '', attrs: {}, style: {}, listeners: {}, title: '', type: '',
      append(...cs) { for (const c of cs) n.children.push(c); }, setAttribute(k, v) { n.attrs[k] = v; },
      addEventListener(t, f) { (n.listeners[t] ??= []).push(f); } };
    Object.defineProperty(n, 'textContent', { get() { return n._t ?? ''; }, set(v) { n._t = v; if (v === '') n.children = []; } });
    return n;
  };
  return { createElement: node };
}
const walk = (n, f) => { f(n); for (const c of n.children ?? []) walk(c, f); };
const all = (root, cls) => { const out = []; walk(root, (n) => { if (String(n.className).split(' ').includes(cls)) out.push(n); }); return out; };

test('TIMERS1: the window draws Now and Coming up, rewrites the countdowns in place, and rebuilds only when a row changes', () => {
  let now = NOW;
  const src = { raids: [{ name: 'Ashfield', region: 'Wayrest', type: 'bandits', startMs: NOW - 1, endMs: NOW + 5000 }] };
  let closed = 0;
  const view = timersWindow(fakeDoc(), { read: () => ({ ...src, now }), onClose: () => { closed++; }, every: 1e9 });
  view.stop();
  const root = view.root;
  assert.ok(root.className.includes('px-win') && root.className.includes('px-timerswin'), 'the pause window\'s frame');
  assert.deepEqual(all(root, 'tm-section').map((n) => n.textContent), ['Now', 'Coming up']);
  const row = all(root, 'tm-raid')[0];
  const count = all(row, 'tm-count')[0];
  assert.equal(count.textContent, '0:05');
  now += 2000; view.draw();
  assert.equal(all(root, 'tm-raid')[0], row, 'the same row, moved on');
  assert.equal(all(row, 'tm-count')[0].textContent, '0:03');
  now += 10_000; view.draw();
  assert.equal(all(root, 'tm-raid').length, 0, 'an ended raid leaves the list');
  all(root, 'tm-close')[0].listeners.click[0]();
  assert.equal(closed, 1);
  const empty = timersWindow(fakeDoc(), { read: () => null, onClose() {}, every: 1e9 });
  empty.stop();
  assert.equal(all(empty.root, 'tm-empty')[0].textContent, 'Nothing is scheduled.', 'offline: nothing, said');
});

test('TIMERS1: the hourglass - a button that opens, placed just left of the profile mark it is measured against', () => {
  let opened = 0;
  const b = timersMark(fakeDoc(), { onOpen: () => { opened++; } });
  assert.equal(b.className, 'px-timersmark');
  assert.match(b.attrs['aria-label'], /Timers/);
  b.listeners.click[0]();
  assert.equal(opened, 1);
  const mark = { style: {}, offsetHeight: 44 };
  placeBeside(mark, { getBoundingClientRect: () => ({ left: 1096, top: 10, width: 172, height: 48 }) }, { getBoundingClientRect: () => ({ right: 1280, top: 0 }) });
  assert.deepEqual(mark.style, { right: '194px', top: '12px' });
});

test('TIMERS1 wiring: the pause face carries the hourglass where the host hands a source, and every host hands the world\'s', () => {
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /home\.append\(profileMark\(\)\);[\s\S]{0,600}?if \(hooks\.timers\?\.\(\)\) \{\s*\n\s*const mark = timersMark\(document,/, 'beside the profile mark, online only');
  assert.match(menu, /const back = accountOpen \? \(\) => \{ accountOpen = false; render\(\); \}\n\s*: timersOpen \? \(\) => \{ timersOpen = false; render\(\); \}/, 'Escape closes the window before it resumes');
  assert.match(menu, /stopTimers\(\);   \/\/ TIMERS1: a rebuild/, 'a rebuild stops the old tick');
  assert.match(menu, /timersOpen = false;   \/\/ TIMERS1: and the timers window the same/, 'a visit\'s window');
  const world = read('src/scenes/world.js');
  assert.match(world, /const timersSource = \(\) => \{\n\s*if \(!online\) return null;/, 'offline: no source, no hourglass');
  assert.equal((world.match(/timers: timersSource,/g) ?? []).length, 2, 'the street\'s pause bag and the modes host');
  assert.match(read('src/scenes/worldModes.js'), /timers: host\.timers,/, 'a building\'s pause');
  assert.match(read('src/scenes/worldModes.js'), /timers: \(\) => host\.timers\?\.\(\) \?\? null,/, 'the dungeon\'s opts');
  assert.match(read('src/scenes/dungeonContext.js'), /timers: \(\) => opts\.timers\?\.\(\) \?\? null,/, 'the dungeon\'s pause');
  assert.match(ENHANCED_CSS, /\n\.px-timersmark \{ position: absolute;/);
  assert.match(ENHANCED_CSS, /\n\.px-win\.px-timerswin \{/);
});
