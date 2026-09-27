// ONE-SEAT (2026-09-27, Mac: "Can we also make it where the player can only have one character only at a time. Like
// they shouldnt be able to open multiple tabs and join as different characters").
//
// ONE TAB OF A PLAYER ONLINE. The hub - the one room every online tab holds - decides it for an ACCOUNT (the token's
// verified subject): a hub hello that CLAIMS (`cl`) closes the account's other tabs there, and one that does not is a
// reconnect, refused while another tab of the account holds the hub. The client that is closed so leaves every room
// and stays out (net/online.js `superseded`) until its player presses Play online here; and every tab of one browser
// hears the others go online (net/oneSeat.js), so two tabs signed in as two players are one seat too. These pins drive
// the real Room over the fake object, the real session over a fake socket, and the lock over a fake channel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeRoom } from './fakeRoom.mjs';
import { parseClient, SEAT_ELSEWHERE, SOCIAL_ROOM, CLOSE_REPLACED, RELAY_VERSION } from '../src/net/wire.js';
import { OnlineSession, SEAT_TEXT, BACKOFF_MAX_MS } from '../src/net/online.js';
import { createSeatLock, SEAT_CHANNEL, SEAT_NOTICE, SEAT_MID_TEXT, PLAY_HERE_LABEL } from '../src/net/oneSeat.js';
import { createChatPanel, CHAT_CSS } from '../src/ui/chatPanel.js';
import { ChatLog } from '../src/net/chat.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const look = { race: 'Nord', gender: 'male', faceIndex: 0, items: [] };
const errorsOf = (ws) => ws.sent.filter((f) => f.t === 'error').map((f) => f.m);
const welcomed = (ws) => ws.sent.some((f) => f.t === 'welcome');

test('ONE-SEAT: the hello\'s claim is 1 or nothing - anything else is refused, as a malformed token is; the version moved (mutants: the claim dropped at the door; any value taken)', () => {
  const base = { t: 'hello', id: 'tab-0001', secret: 'secret-of-tab-0001', name: 'Mac', look, pose: null };
  assert.equal(parseClient(JSON.stringify({ ...base, cl: 1 })).cl, 1, 'a tab going online says so');
  assert.equal('cl' in parseClient(JSON.stringify(base)), false, 'a reconnect says nothing');
  for (const bad of [0, true, '1', 2]) assert.deepEqual(parseClient(JSON.stringify({ ...base, cl: bad })), { error: 'bad claim' }, JSON.stringify(bad));
  assert.equal(SEAT_ELSEWHERE, 'online in another tab, window or device');
  assert.equal(RELAY_VERSION, 'world119');
});

test('ONE-SEAT at the hub: a claim closes the account\'s other tab - the reason said first, CLOSE_REPLACED - and its leave is said to the room; the newest tab stays; another account is not touched (mutants: no supersede; by the browser\'s account instead of the verified one; every room instead of the hub)', async () => {
  const r = fakeRoom(SOCIAL_ROOM);
  const a = r.connect(), b = r.connect(), other = r.connect();
  await r.hello(other, 'tab-other', null, { tokenSub: 'player-2' });
  await r.hello(a, 'tab-a', null, { tokenSub: 'player-1', cl: 1, acct: 'aprofile1', asecret: 'asecret-profile-1' });
  assert.ok(welcomed(a) && !a.closed, 'the first tab online');
  // the second tab is another browser profile (its own hub account) signed in as the same player
  await r.hello(b, 'tab-b', null, { tokenSub: 'player-1', cl: 1, acct: 'aprofile2', asecret: 'asecret-profile-2' });
  assert.ok(welcomed(b) && !b.closed, 'the tab that claimed is in');
  assert.deepEqual(a.closed, { code: CLOSE_REPLACED, reason: SEAT_ELSEWHERE }, 'the older tab is closed, CLOSE_REPLACED');
  assert.deepEqual(errorsOf(a), [SEAT_ELSEWHERE], 'and told why first');
  assert.ok(!other.closed && welcomed(other), 'another player is not touched');
  assert.ok(other.sent.some((f) => f.t === 'leave' && f.id === 'tab-a'), 'the room hears the older tab go (its leave, at the reap)');
  assert.ok(!r.sockets.includes(a), 'and it is out of the object');
});

test('ONE-SEAT at the hub: a hello that does NOT claim is a reconnect - refused while another tab of the account holds the hub, before anything is written; admitted when none does (an older build\'s first tab); the holder\'s own reconnect replaces its old socket (mutants: the refusal dropped; the same-id exclusion dropped, so a holder\'s reconnect refused itself)', async () => {
  const r = fakeRoom(SOCIAL_ROOM);
  const holder = r.connect();
  await r.hello(holder, 'tab-holder', null, { tokenSub: 'player-1' });   // no claim: a build before ONE-SEAT, first in
  assert.ok(welcomed(holder) && !holder.closed, 'the first tab in holds the seat, claim or none');
  const stale = r.connect();
  await r.hello(stale, 'tab-stale', null, { tokenSub: 'player-1' });   // a tab superseded while its socket was down, back
  assert.deepEqual(stale.closed, { code: CLOSE_REPLACED, reason: SEAT_ELSEWHERE }, 'the seat is the holder\'s');
  assert.equal(welcomed(stale), false, 'no welcome');
  assert.equal(r.store.has('secret:tab-stale'), false, 'and nothing written for it - a refused hello leaves nothing behind');
  assert.ok(!holder.closed, 'the holder stands');
  // the holder's own socket drops without the object hearing it, and the tab reconnects - the same id, no claim
  const again = r.connect();
  await r.hello(again, 'tab-holder', null, { tokenSub: 'player-1' });
  assert.ok(welcomed(again) && !again.closed, 'its own reconnect is in');
  assert.deepEqual(holder.closed, { code: CLOSE_REPLACED, reason: 'replaced' }, 'its old socket replaced, as every reconnect is');
  // and a claim from the stale tab takes the seat back - the player pressed Play online here
  const back = r.connect();
  await r.hello(back, 'tab-stale', null, { tokenSub: 'player-1', cl: 1 });
  assert.ok(welcomed(back) && !back.closed, 'a claim is always in');
  assert.deepEqual(again.closed, { code: CLOSE_REPLACED, reason: SEAT_ELSEWHERE }, 'and the other tab goes');
});

test('ONE-SEAT: only the hub decides - two tabs of one account in a place room are both admitted there, claim or none; the client that the hub closes leaves the rest (mutant: the rule run in every room)', async () => {
  const r = fakeRoom('1234567890');
  const a = r.connect(), b = r.connect();
  await r.hello(a, 'tab-a', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 }, { tokenSub: 'player-1' });
  await r.hello(b, 'tab-b', { x: 1, y: 0, z: 0, yaw: 0, pitch: 0 }, { tokenSub: 'player-1', cl: 1 });
  assert.ok(welcomed(a) && welcomed(b) && !a.closed && !b.closed);
});

/** A fake WebSocket class: records what was sent, lets the test drive the events (test/online.test.js's own). */
function fakeSocketClass() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.sent = []; this.closed = null; sockets.push(this); }
    send(s) { this.sent.push(JSON.parse(s)); }
    close(code, reason) { this.closed = { code, reason }; }
    open() { this.onopen?.(); }
    receive(o) { this.onmessage?.({ data: typeof o === 'string' ? o : JSON.stringify(o) }); }
    drop(code = 1006) { this.onclose?.({ code, reason: '' }); }
  }
  return { FakeWS, sockets };
}
const hub = (FakeWS, clock) => new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', look, id: 'tab-0001', secret: 'secret-of-tab-0001', presence: false, WebSocketImpl: FakeWS, now: () => clock.t });
const hellos = (ws) => ws.sent.filter((f) => f.t === 'hello');

test('ONE-SEAT, the session: the hub link claims until the hub welcomes it, and a reconnect after does not (mutants: the claim never sent; the welcome not spending it)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const s = hub(FakeWS, clock);
  s.claim = true;
  s.join(SOCIAL_ROOM);
  await sockets[0].onopen();
  assert.equal(hellos(sockets[0])[0].cl, 1, 'the tab going online claims');
  sockets[0].drop(1006);   // dropped before the hub answered: the claim was never taken
  clock.t += BACKOFF_MAX_MS;
  s.tick();
  await sockets[1].onopen();
  assert.equal(hellos(sockets[1])[0].cl, 1, 'so the retry claims again');
  sockets[1].receive({ t: 'welcome', id: 'tab-0001', peers: [], n: 1, v: RELAY_VERSION, now: clock.t });
  assert.equal(s.claim, false, 'the hub took it');
  sockets[1].drop(1006);
  clock.t += BACKOFF_MAX_MS;
  s.tick();
  await sockets[2].onopen();
  assert.equal('cl' in hellos(sockets[2])[0], false, 'a reconnect is a reconnect');
});

test('ONE-SEAT, the session: the hub\'s close is STICKY - nothing joins, rejoins or retries, and the line says why - until resume(), whose join claims again (mutants: the close not sticky; join or rejoin not shut; resume not claiming)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const s = hub(FakeWS, clock);
  let heard = 0;
  s.onSuperseded = () => { heard++; throw new Error('a host that throws is contained'); };
  s.join(SOCIAL_ROOM);
  await sockets[0].onopen();
  sockets[0].receive({ t: 'welcome', id: 'tab-0001', peers: [], n: 1, v: RELAY_VERSION, now: clock.t });
  sockets[0].receive({ t: 'error', m: SEAT_ELSEWHERE });
  sockets[0].drop(CLOSE_REPLACED);
  assert.equal(s.superseded, true);
  assert.equal(s.statusLine('World'), `World: ${SEAT_TEXT}`, 'the line says why');
  clock.t += BACKOFF_MAX_MS * 4;
  s.tick();
  assert.equal(s.rejoin(SOCIAL_ROOM, 0), false, 'the chat frame\'s door is shut');
  s.join(SOCIAL_ROOM);
  s.join('1234567890');
  assert.equal(sockets.length, 1, 'no socket opened - by the clock, the chat frame, or a crossing');
  assert.equal(heard, 1, 'the host heard it at once - a hidden tab draws no frame to notice in');
  s.resume({ claim: true });
  assert.equal(s.superseded, false);
  s.join(SOCIAL_ROOM);
  assert.equal(sockets.length, 2, 'Play online here: in again');
  await sockets[1].onopen();
  assert.equal(hellos(sockets[1])[0].cl, 1, 'taking the seat back');
});

test('ONE-SEAT, the session: supersede() - the host\'s word, when the hub closed ANOTHER of this tab\'s links or another tab of the browser went online - leaves the room cleanly and shuts the doors (mutant: supersede only marking)', async () => {
  const { FakeWS, sockets } = fakeSocketClass();
  const clock = { t: 1000 };
  const presence = new OnlineSession({ url: 'wss://relay.test/', name: 'Mac', look, id: 'tab-0001', secret: 'secret-of-tab-0001', WebSocketImpl: FakeWS, now: () => clock.t });
  presence.join('1234567890', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  await sockets[0].onopen();
  presence.supersede();
  assert.deepEqual(sockets[0].closed, { code: 1000, reason: 'leaving' }, 'a clean leave - the room says it at once');
  assert.equal(presence.room, null);
  assert.equal(presence.superseded, true);
  assert.equal(presence.statusLine('Local'), `Local: ${SEAT_TEXT}`);
  presence.join('1234567891', { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  assert.equal(sockets.length, 1, 'the next crossing joins nothing');
});

/** A BroadcastChannel over one bus: a post reaches every OTHER object of the name, never its source - the real one's law. */
function fakeChannels() {
  const all = [];
  class Channel {
    constructor(name) { this.name = name; this.onmessage = null; this.closed = false; all.push(this); }
    postMessage(data) { if (this.closed) throw new Error('closed'); for (const c of all) if (c !== this && !c.closed && c.name === this.name) c.onmessage?.({ data: structuredClone(data) }); }
    close() { this.closed = true; }
  }
  return { Channel, all };
}

test('ONE-SEAT, the browser\'s arm: a tab going online takes the seat from every other tab of the browser that holds it - once, the newest wins, and it turns back (mutants: the hold not asked; the page\'s own word taken for another\'s)', () => {
  const { Channel, all } = fakeChannels();
  const lost = { a: 0, b: 0 };
  const a = createSeatLock({ Channel, onLost: () => { lost.a++; } });
  const b = createSeatLock({ Channel, onLost: () => { lost.b++; } });
  assert.equal(all[0].name, SEAT_CHANNEL);
  a.claim();
  assert.deepEqual(lost, { a: 0, b: 0 }, 'b held nothing, so it lost nothing');
  b.claim();
  assert.deepEqual(lost, { a: 1, b: 0 }, 'a gave the seat to the newer tab');
  assert.equal(a.held, false); assert.equal(b.held, true);
  b.claim();
  assert.equal(lost.a, 1, 'said once - a tab out of the seat is not told again');
  a.claim();
  assert.deepEqual(lost, { a: 1, b: 1 }, 'Play online here: it turns back');
  b.release();
  a.claim();
  assert.equal(lost.b, 1, 'a released tab holds nothing to lose');
  // one PAGE's two objects (a nonce shared) are one tab: its own word is never another's
  const one = createSeatLock({ Channel, nonce: 'page-1', onLost: () => { lost.a += 100; } });
  const same = createSeatLock({ Channel, nonce: 'page-1' });
  one.claim(); same.claim();
  assert.equal(one.held, true, 'a page does not take its own seat');
});

test('ONE-SEAT, the browser\'s arm: a browser without BroadcastChannel (or a channel that throws) has the hub\'s arm alone - the lock never throws', () => {
  const none = createSeatLock({ Channel: undefined });
  none.claim(); assert.equal(none.held, true); none.release(); none.close();
  const bad = createSeatLock({ Channel: class { constructor() { throw new Error('no'); } } });
  bad.claim(); bad.close();
});

// ── THE BUTTON ───────────────────────────────────────────────────────
function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', type: '',
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), scrollTop: 0, scrollHeight: 100, clientHeight: 100,
    append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    removeAttribute(k) { delete n.attrs[k]; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener(t, fn) { const l = n.listeners.get(t) ?? []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
    fire(t) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {} }; for (const fn of n.listeners.get(t) ?? []) fn(ev); },
    focus() { doc.activeElement = n; }, blur() { if (doc.activeElement === n) doc.activeElement = null; },
    remove() { if (n.parent) { n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 440, height: 300, right: 440, bottom: 300 }),
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.documentElement = fakeNode('html', doc);
  const byId = (n, id) => { if (n.id === id) return n; for (const c of n.children) { const f = byId(c, id); if (f) return f; } return null; };
  doc.getElementById = (id) => byId(doc.head, id) ?? byId(doc.body, id);
  return doc;
}
const fakeWindow = () => ({ innerWidth: 1280, innerHeight: 720, listeners: [], addEventListener(t, fn) { this.listeners.push({ t, fn }); }, removeEventListener() {} });
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };

test('ONE-SEAT, the way back: the chat\'s strip carries "Play online here" while the host hands the action in, a press runs it, and Hide does not take it - a player who hid the chat is still told (mutants: the button never drawn; the press not wired; hidden with the chat)', () => {
  const doc = fakeDocument(), win = fakeWindow();
  const panel = createChatPanel({ log: new ChatLog(), onSend: () => true, doc, win, overlay: () => false });
  const [here] = find(doc.body, 'dfchat-here');
  assert.ok(here, 'the button is built');
  assert.equal(here.type, 'button');
  panel.render({ status: `World: ${SEAT_TEXT}`, here: null });
  assert.equal(here.className, 'dfchat-here', 'no action, no button');
  let ran = 0;
  panel.render({ status: `World: ${SEAT_TEXT}`, here: { label: PLAY_HERE_LABEL, run: () => { ran++; } } });
  assert.equal(here.className, 'dfchat-here on');
  assert.equal(here.textContent, 'Play online here');
  here.fire('click');
  assert.equal(ran, 1, 'the press takes the seat back');
  panel.render({ status: null, here: null });
  assert.equal(here.className, 'dfchat-here', 'back online, gone');
  here.fire('click');
  assert.equal(ran, 1, 'and a stale press does nothing');
  const hiddenRule = CHAT_CSS.slice(CHAT_CSS.indexOf('.dfchat[data-hidden="1"]'), CHAT_CSS.indexOf('.dfchat-show { display: inline-flex'));
  assert.ok(hiddenRule.length > 40 && !hiddenRule.includes('dfchat-here'), 'Hide does not take it');
  assert.match(CHAT_CSS, /\n\.dfchat-here \{ display: none; pointer-events: auto;[^}]*font-size: 14px; padding: 6px 10px;/, 'a thumb\'s button, unscaled, as the others');
  assert.match(CHAT_CSS, /\n\.dfchat-here\.on \{ display: inline-flex; \}/);
  panel.destroy();
});

test('ONE-SEAT, the host: the World link claims, the tab claims the browser\'s seat as it goes online, a lost seat is left once before anything else of the frame (the foes handed and the room\'s last word said first) and every session is marked, the renown earns only in the seat, and Play online here resumes every link with the hub\'s claiming (mutants: each line)', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /if \(tab\.room === SOCIAL_ROOM\) link\.claim = true;/, 'the hub link\'s first hello claims');
  assert.match(w, /seatLock = createSeatLock\(\{ onLost: \(\) => seatLostNow\(\) \}\);\n\s*seatLock\.claim\(\);/, 'the browser\'s arm, at online start - acted on as it arrives');
  assert.match(w, /if \(tab\.room === SOCIAL_ROOM\) link\.onSuperseded = \(\) => seatLostNow\(\);/, 'the hub\'s close acted on as it arrives - a hidden tab draws no frame');
  assert.match(w, /online\.onSuperseded = \(\) => seatLostNow\(\);/, 'and a room\'s');
  assert.match(w, /const seatLostNow = \(\) => \{\n\s*_seatOut = true;\n\s*try \{ leaveSeat\(performance\.now\(\)\); \}/, 'the network\'s half at once, contained');
  assert.match(w, /const seatOut = \(\) => _seatOut \|\| !!online\?\.superseded \|\| !!chatLinks\?\.get\('world'\)\?\.superseded;/, 'either arm');
  const frame = w.slice(w.indexOf('  const onlineFrame = (now, dt) => {'));
  const branch = frame.indexOf('    if (seatOut()) {\n      if (!_seatLeft) leaveSeat(now);');
  assert.ok(branch > 0, 'the frame asks');
  assert.ok(branch < frame.indexOf('// AUDIT ONLINE D12: the dead broadcast nothing and see no one'), 'before the dead\'s law');
  assert.ok(branch < frame.indexOf('online.join('), 'and before anything joins');
  assert.match(frame.slice(branch, branch + 1200), /peerBodies\.destroy\(\); remotePlayers\.sync\(\[\], onlineToScene\);[^\n]*return;/, 'nobody drawn while out');
  const leave = w.slice(w.indexOf('  const leaveSeat = (now) => {'), w.indexOf('  const seatLostNow = () => {'));
  assert.match(leave, /const leaveSeat = \(now\) => \{\n\s*if \(_seatLeft\) return;\n\s*_seatLeft = true;/, 'once, whoever asks first');
  assert.ok(leave.indexOf('handOverFoes() || handOverRoomFoes()') > 0 && leave.indexOf('worldPublish(now, true)') > 0, 'my foes and the room\'s memory, first');
  assert.ok(leave.indexOf('online?.supersede();') > leave.indexOf('worldPublish(now, true)'), 'while the socket still stands');
  assert.match(leave, /for \(const link of chatLinks\?\.values\?\.\(\) \?\? \[\]\) link\.supersede\(\);/, 'every link marked');
  const words = frame.slice(branch, frame.indexOf('peerBodies.destroy();', branch));
  assert.match(words, /if \(!_seatSaid\) \{[^\n]*\n\s*_seatSaid = true;/, 'the frame\'s half, once');
  assert.match(words, /if \(modes\?\.gateArenaDay\?\.\(\) != null\) ejectFromCourt\(COURT_TEXT\.lost\);/, 'the court is online\'s alone - cast out in the frame, where a mode may change');
  assert.match(words, /chatNotice\(SEAT_NOTICE\);/);
  assert.match(words, /setMidScreenText\(SEAT_MID_TEXT\);/);
  const take = w.slice(w.indexOf('  const takeSeat = () => {'), w.indexOf('  const onlineFrame = (now, dt) => {'));
  assert.match(take, /_seatOut = false; _seatLeft = false; _seatSaid = false;/, 'a seat taken back is lost afresh next time');
  assert.match(take, /online\?\.resume\(\);/);
  assert.match(take, /link\.resume\(\{ claim: room === SOCIAL_ROOM \}\);\n\s*if \(room\) link\.join\(room\);/, 'the hub\'s link claims the seat back');
  assert.match(take, /seatLock\?\.claim\(\);/, 'and the browser\'s other tabs are told');
  assert.match(w, /earning: \(\) => !!online && !seatOut\(\),/, 'a tab out of the seat earns no Renown');
  assert.match(w, /here: seatOut\(\) \? \{ label: PLAY_HERE_LABEL, run: takeSeat \} : null,/, 'the way back, drawn');
  assert.match(w, /const chatRegionFrame = \(now\) => \{\n\s*if \(seatOut\(\)\) return;/, 'no region said while out');
  assert.ok(SEAT_NOTICE.includes(PLAY_HERE_LABEL) && SEAT_MID_TEXT.length < 60);
});
