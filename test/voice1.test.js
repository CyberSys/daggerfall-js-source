// VOICE1 (2026-09-28, Mac: "Lets instead take this idea and develop prox chat" - the idea of PR #375's voice lines; Mac
// chose PUSH-TO-TALK, STUN ONLY, NEARBY ONLY) - PROXIMITY VOICE.
//
// Pinned here: the wire (the `rtc` frame's four kinds and bounds, the parser's arm, the version gate); the relay over
// the real Room (routed to the one player named, the sender's id stamped, never from a muted player, never on a
// channel, a frame at myself junk, its own meter and funnel); the session (sent only to a relay that routes it, gated,
// delivered only when addressed to me); the law of earshot (the gain curve, the links held with hysteresis, the nearest
// few, a failed link rested, the lower id offers, a stranger refused); the links and the sound over a fake browser
// (offer, answer, ICE held and flushed, the voice placed and speaking, push-to-talk asking once, off letting go, a bye
// resting the link, a link that never connects let go - said only when the other side answered); the controls, the
// switch and the readout; and world.js by source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseClient, validRtcData, RTC_KINDS, RTC_SDP_MAX, RTC_ICE_MAX, RTC_MID_MAX, RTC_FRAME_MAX, RTC_HZ_MAX, MAX_FRAME_BYTES,
  VOICE_RELAY_MIN, relaySupportsVoice, RELAY_VERSION, DROP_STRIKES_MAX,
} from '../src/net/wire.js';
import { OnlineSession } from '../src/net/online.js';
import { voiceGain, voicePlan, offersTo, acceptsOffer, VOICE_FULL_M, VOICE_HEAR_M, VOICE_LINK_M, VOICE_UNLINK_M, VOICE_PEERS_MAX, VOICE_RETRY_MS } from '../src/net/voiceLaw.js';
import { createProxVoice, VOICE_ICE_SERVERS, VOICE_CONNECT_MS, VOICE_PENDING_ICE_MAX, VOICE_MIC_CONSTRAINTS } from '../src/net/proxVoice.js';
import { voiceHudLines, VOICE_HUD_NAMES_MAX } from '../src/ui/voiceHud.js';
import { DEFAULT_BINDINGS, ACTIONS, PORT_ACTIONS, ACTION_GROUPS } from '../src/systems/inputActions.js';
import { MOUSE_CODES, mouseCode } from '../src/ui/input.js';
import { PREF_DEFAULTS } from '../src/systems/uiPrefs.js';
import { ONLINE_PLAYERS_OWN_PREFS as ONLINE_OWN_PREFS } from '../src/systems/onlineLane.js';
import { fakeRoom } from './fakeRoom.mjs';
import { fakeSocketClass } from './fakeSocket.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const quiet = (fn) => { const info = console.info, warn = console.warn; console.info = () => {}; console.warn = () => {}; try { return fn(); } finally { console.info = info; console.warn = warn; } };
const flush = () => new Promise((r) => setImmediate(r));
const SDP = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';

// ─── THE WIRE ───────────────────────────────────────────────────────────────────────────────────────────────────

test('VOICE1 wire: four kinds - offer and answer carry an SDP, ice a candidate with its mid and index, bye nothing - each projected to exactly its own fields, every bound refused past; the parser\'s arm; the widest frame under the door; the version gate', () => {
  assert.deepEqual([...RTC_KINDS], ['offer', 'answer', 'ice', 'bye', 'hi']);
  assert.deepEqual(validRtcData({ to: 'peer-0002', k: 'hi', sdp: SDP }), { to: 'peer-0002', k: 'hi' }, 'AUDIT VOICE1 A5: the higher id, here - nothing else carried');
  assert.deepEqual(validRtcData({ to: 'peer-0002', k: 'offer', sdp: SDP, extra: 1 }), { to: 'peer-0002', k: 'offer', sdp: SDP });
  assert.deepEqual(validRtcData({ to: 'peer-0002', k: 'answer', sdp: SDP }), { to: 'peer-0002', k: 'answer', sdp: SDP });
  assert.deepEqual(validRtcData({ to: 'peer-0002', k: 'bye', sdp: SDP }), { to: 'peer-0002', k: 'bye' });
  assert.deepEqual(validRtcData({ to: 'peer-0002', k: 'ice', c: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', m: '0', i: 0 }), { to: 'peer-0002', k: 'ice', c: 'candidate:1 1 udp 1 1.2.3.4 5 typ host', m: '0', i: 0 });
  assert.deepEqual(validRtcData({ to: 'peer-0002', k: 'ice', c: '' }), { to: 'peer-0002', k: 'ice', c: '', m: null, i: null }, 'the end of candidates is an empty line');
  assert.ok(validRtcData({ to: 'peer-0002', k: 'offer', sdp: 's'.repeat(RTC_SDP_MAX) }));
  for (const bad of [
    { to: 'peer-0002', k: 'offer', sdp: 's'.repeat(RTC_SDP_MAX + 1) }, { to: 'peer-0002', k: 'offer', sdp: '' }, { to: 'peer-0002', k: 'answer' },
    { to: 'peer-0002', k: 'offer', sdp: 'v=0\u0001' }, { to: 'peer-0002', k: 'offer', sdp: 'caf\u00e9' }, { to: 'peer-0002', k: 'ice', c: 'c\n' }, { to: 'peer-0002', k: 'ice', c: 'c', m: '\u0000' },
    { to: 'peer-0002', k: 'ice', c: 'c'.repeat(RTC_ICE_MAX + 1) }, { to: 'peer-0002', k: 'ice', c: 'c', m: 'm'.repeat(RTC_MID_MAX + 1) },
    { to: 'peer-0002', k: 'ice', c: 'c', i: 16 }, { to: 'peer-0002', k: 'ice', c: 'c', i: 1.5 }, { to: 'peer-0002', k: 'ice', c: 'c', m: 3 }, { to: 'peer-0002', k: 'ice' },
    { to: 'x', k: 'bye' }, { k: 'bye' }, { to: 'peer-0002', k: 'hello' }, null, [], 'bye',
  ]) assert.equal(validRtcData(bad), null, JSON.stringify(bad)?.slice(0, 80));
  const frame = (d) => JSON.stringify({ t: 'rtc', data: d });
  const ok = { to: 'peer-0002', k: 'bye' };
  assert.deepEqual(parseClient(frame(ok), { hasHello: true }), { t: 'rtc', data: ok });
  assert.deepEqual(parseClient(frame(ok)), { error: 'rtc before hello' });
  assert.deepEqual(parseClient(frame({ to: 'peer-0002', k: 'nope' }), { hasHello: true }), { error: 'bad rtc' });
  const widest = JSON.stringify({ t: 'rtc', data: { to: 'p'.repeat(40), k: 'answer', sdp: '\r'.repeat(RTC_SDP_MAX) } });   // \r: one of the few characters JSON writes two wide, and the widest the law admits
  assert.ok(validRtcData(JSON.parse(widest).data), 'the widest SDP is an SDP');
  assert.ok(widest.length <= RTC_FRAME_MAX, `and its frame fits: ${widest.length} of ${RTC_FRAME_MAX}`);
  assert.ok(RTC_FRAME_MAX <= MAX_FRAME_BYTES);
  assert.equal(RELAY_VERSION, 'world126');
  assert.equal(VOICE_RELAY_MIN, 125);   // world124 on its branch; main's TV8 took it first
  assert.equal(relaySupportsVoice('world125'), true);
  assert.equal(relaySupportsVoice('world124'), false, 'never said to a relay that would close the socket on it');
  assert.equal(relaySupportsVoice(undefined), false);
});

// ─── THE RELAY ──────────────────────────────────────────────────────────────────────────────────────────────────

async function withRoom(key, fn) {
  const r = fakeRoom(key);
  const realNow = Date.now; let clock = 1e12; Date.now = () => clock;
  try { await fn({ r, tick: (ms = 1000) => { clock += ms; } }); } finally { Date.now = realNow; }
}
const rtcs = (ws) => ws.sent.filter((m) => m.t === 'rtc');
const OFFER = { to: 'peer-0002', k: 'offer', sdp: SDP };

test('VOICE1 relay: a voice frame reaches the one player it names, stamped with its sender\'s id; nobody else sees it; a channel is nowhere to speak; a frame at myself is junk; a player gone is nothing; a MUTED player opens no link, in silence', () => withRoom('world:3,12', async ({ r, tick }) => {
  const a = r.connect(); await r.hello(a, 'peer-0001');
  const b = r.connect(); await r.hello(b, 'peer-0002');
  const c = r.connect(); await r.hello(c, 'peer-0003');
  for (const ws of [a, b, c]) ws.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'rtc', data: OFFER }));
  assert.deepEqual(rtcs(b), [{ t: 'rtc', id: 'peer-0001', data: OFFER }]);
  assert.equal(rtcs(a).length + rtcs(c).length, 0, 'the sender and a bystander see nothing');
  await r.raw(a, JSON.stringify({ t: 'rtc', data: { to: 'peer-0001', k: 'bye' } }));
  assert.equal(a.meters.junk, 1, 'a frame at my own id is junk');
  await r.raw(b, JSON.stringify({ t: 'rtc', data: { to: 'peer-0099', k: 'bye' } }));
  assert.equal(b.meters.junk ?? 0, 0, 'a leave races a frame - not junk');
  const until = Math.floor(Date.now() / 1000) + 600;
  const m = r.connect(); await r.hello(m, 'peer-0004', null, { mu: until });
  b.sent.length = 0; m.sent.length = 0;
  tick(1000);
  await r.raw(m, JSON.stringify({ t: 'rtc', data: OFFER }));
  assert.equal(rtcs(b).length, 0, 'a mute that stopped a line and let a voice through would be no mute');
  assert.deepEqual(m.sent, [{ t: 'muted', until }], 'AUDIT VOICE1 A4: told why on an offer, so its own voice goes quiet');
  m.sent.length = 0; tick(1000);
  await r.raw(m, JSON.stringify({ t: 'rtc', data: { to: 'peer-0002', k: 'ice', c: 'candidate:1' } }));
  assert.equal(m.sent.length + rtcs(b).length, 0, 'and in silence on the rest - a link\'s setup is a burst');
  assert.equal(a.closed ?? b.closed ?? c.closed ?? m.closed, null);
}).then(() => withRoom('chat:world', async ({ r }) => {
  const a = r.connect(); await r.hello(a, 'peer-0001');
  const b = r.connect(); await r.hello(b, 'peer-0002');
  b.sent.length = 0;
  await r.raw(a, JSON.stringify({ t: 'rtc', data: OFFER }));
  assert.equal(rtcs(b).length, 0, 'a channel - and the hub - is nowhere to stand within earshot');
})));

test('VOICE1 relay: the sender\'s meter holds it to RTC_HZ_MAX a second, striking a flood out in its own words; the funnel onto the reader is per sender', () => withRoom('world:3,12', async ({ r, tick }) => {
  const me = r.connect(); await r.hello(me, 'peer-0001');
  const s = r.connect(); await r.hello(s, 'peer-0002');
  const o = r.connect(); await r.hello(o, 'peer-0003');
  tick(5000);
  me.sent.length = 0;
  const ice = JSON.stringify({ t: 'rtc', data: { to: 'peer-0001', k: 'ice', c: 'candidate:1' } });
  for (let k = 0; k < RTC_HZ_MAX; k++) await r.raw(s, ice);
  assert.equal(rtcs(me).length, RTC_HZ_MAX, 'a burst of candidates is a second\'s worth');
  await r.raw(o, ice);
  assert.equal(rtcs(me).length, RTC_HZ_MAX + 1, 'another sender\'s slot is its own');
  tick(5000);
  me.sent.length = 0;
  for (let k = 0; k < RTC_HZ_MAX + DROP_STRIKES_MAX; k++) await r.raw(s, ice);
  assert.equal(s.closed, null, 'the strikes at the bound, not past it');
  assert.equal(s.meters.rtcDrops, DROP_STRIKES_MAX);
  await r.raw(s, ice);
  assert.equal(s.closed?.reason, 'too many rtc frames', 'one past it, closed in its own words');
}));

// ─── THE SESSION ────────────────────────────────────────────────────────────────────────────────────────────────

function linkRig(relayV = RELAY_VERSION) {
  const { FakeWS, sockets } = fakeSocketClass();
  let t = 1000;
  const s = new OnlineSession({ url: 'wss://relay.test', name: 'a', id: 'aaaa-0001', secret: 'secret-of-aaaa-0001', WebSocketImpl: FakeWS, now: () => t });
  const got = []; s.onRtc = (id, d) => got.push({ id, d });
  quiet(() => s.join('dungeon:m187', { x: 1, y: 0, z: 1, yaw: 0 }));
  const ws = sockets[0]; ws.open();
  quiet(() => ws.receive({ t: 'welcome', id: 'aaaa-0001', peers: [{ id: 'peer-0002', name: 'Bran', p: { x: 2, y: 0, z: 1, yaw: 0 } }], host: 'aaaa-0001', world: null, v: relayV }));
  const out = () => ws.sent.map((x) => JSON.parse(x)).filter((x) => x.t === 'rtc');
  return { s, ws, got, out, tick: (ms) => { t += ms; } };
}

test('VOICE1 session: a voice frame goes only to a relay that routes it, through the wire\'s law, to a peer in the room, at RTC_HZ_MAX; one addressed to me is delivered, one to anyone else or from me is not', () => {
  const old = linkRig('world124');
  assert.equal(old.s.voiceOk, false);
  assert.equal(old.s.sendRtc({ to: 'peer-0002', k: 'bye' }), false, 'an older relay would close the socket on it');
  const { s, ws, got, out, tick } = linkRig();
  assert.equal(s.voiceOk, true);
  assert.equal(s.sendRtc({ to: 'peer-0002', k: 'offer', sdp: SDP }), true);
  assert.deepEqual(out(), [{ t: 'rtc', data: { to: 'peer-0002', k: 'offer', sdp: SDP } }]);
  assert.equal(s.sendRtc({ to: 'peer-0002', k: 'offer', sdp: '' }), false, 'the law first');
  assert.equal(s.sendRtc({ to: 'aaaa-0001', k: 'bye' }), false, 'never to myself');
  assert.equal(s.sendRtc({ to: 'peer-0099', k: 'bye' }), false, 'nobody in my rooms by that id');
  tick(5000);
  let sent = 0;
  for (let k = 0; k < RTC_HZ_MAX + 5; k++) if (s.sendRtc({ to: 'peer-0002', k: 'ice', c: 'candidate:1' })) sent++;
  assert.equal(sent, RTC_HZ_MAX, 'my own gate before the relay\'s');
  ws.receive({ t: 'rtc', id: 'peer-0002', data: { to: 'aaaa-0001', k: 'answer', sdp: SDP } });
  ws.receive({ t: 'rtc', id: 'peer-0002', data: { to: 'peer-0003', k: 'bye' } });
  ws.receive({ t: 'rtc', id: 'aaaa-0001', data: { to: 'aaaa-0001', k: 'bye' } });
  ws.receive({ t: 'rtc', id: 'peer-0002', data: { to: 'aaaa-0001', k: 'answer' } });
  assert.deepEqual(got, [{ id: 'peer-0002', d: { to: 'aaaa-0001', k: 'answer', sdp: SDP } }]);
});

// ─── THE LAW OF EARSHOT ─────────────────────────────────────────────────────────────────────────────────────────

test('VOICE1 law: full voice within VOICE_FULL_M, a linear fall to silence at VOICE_HEAR_M; links opened within VOICE_LINK_M, kept to VOICE_UNLINK_M, the nearest VOICE_PEERS_MAX; a failed link rested; the lower id offers; an offer answered only from within the kept band while on', () => {
  assert.deepEqual([VOICE_FULL_M, VOICE_HEAR_M, VOICE_LINK_M, VOICE_UNLINK_M, VOICE_PEERS_MAX], [2, 30, 35, 45, 8]);
  assert.ok(VOICE_HEAR_M < VOICE_LINK_M && VOICE_LINK_M < VOICE_UNLINK_M, 'a link stands before its voice can be heard');
  assert.equal(voiceGain(0), 1);
  assert.equal(voiceGain(VOICE_FULL_M), 1);
  assert.equal(voiceGain(16), 0.5);
  assert.equal(voiceGain(VOICE_HEAR_M), 0);
  assert.equal(voiceGain(200), 0);
  assert.equal(voiceGain(NaN), 0);
  const plan = (peers, linked = [], extra = {}) => voicePlan({ peers, linked: new Set(linked), ...extra });
  const p = plan([{ id: 'far', d: 40 }, { id: 'near', d: 5 }, { id: 'edge', d: VOICE_LINK_M }]);
  assert.deepEqual([...p.want], ['near', 'edge']);
  assert.deepEqual(p.open, ['near', 'edge']);
  const kept = plan([{ id: 'far', d: 40 }, { id: 'gone', d: VOICE_UNLINK_M + 1 }], ['far', 'gone', 'left']);
  assert.deepEqual([...kept.want], ['far'], 'a link is kept past the opening line, to the band\'s far edge');
  assert.deepEqual(kept.close.sort(), ['gone', 'left'], 'past the band, or out of the room, let go');
  const crowd = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, d: 20 - i }));
  assert.deepEqual([...plan(crowd).want], ['p11', 'p10', 'p9', 'p8', 'p7', 'p6', 'p5', 'p4'], 'the nearest eight');
  const rested = plan([{ id: 'x', d: 3 }], [], { now: 1000, failedUntil: new Map([['x', 2000]]) });
  assert.deepEqual(rested.open, [], 'a failed link rests');
  assert.deepEqual(plan([{ id: 'x', d: 3 }], [], { now: 2001, failedUntil: new Map([['x', 2000]]) }).open, ['x'], 'and is tried again after');
  assert.equal(VOICE_RETRY_MS, 60000);
  assert.equal(offersTo('aaaa', 'bbbb'), true);
  assert.equal(offersTo('bbbb', 'aaaa'), false);
  const peers = [{ id: 'near', d: 10 }, { id: 'band', d: VOICE_UNLINK_M }, { id: 'far', d: VOICE_UNLINK_M + 1 }];
  assert.equal(acceptsOffer({ on: true, id: 'near', peers }), true);
  assert.equal(acceptsOffer({ on: true, id: 'band', peers }), true);
  assert.equal(acceptsOffer({ on: true, id: 'far', peers }), false, 'a stranger across the town is not let into my speakers by asking');
  assert.equal(acceptsOffer({ on: true, id: 'nobody', peers }), false);
  assert.equal(acceptsOffer({ on: false, id: 'near', peers }), false);
});

// ─── THE LINKS AND THE SOUND, OVER A FAKE BROWSER ───────────────────────────────────────────────────────────────

class FakePC {
  constructor(cfg) { this.cfg = cfg; this.trs = []; this.localDescription = null; this.remoteDescription = null; this.connectionState = 'new'; this.added = []; this.closed = false; FakePC.all.push(this); }
  addTransceiver(kind, o) { const tr = { kind, direction: o.direction, sender: { track: null, replaceTrack(t) { this.track = t; return Promise.resolve(); } } }; this.trs.push(tr); return tr; }
  getTransceivers() { return this.trs; }
  async createOffer() { return { type: 'offer', sdp: `offer-of-${FakePC.all.indexOf(this)}` }; }
  async createAnswer() { return { type: 'answer', sdp: `answer-of-${FakePC.all.indexOf(this)}` }; }
  async setLocalDescription(d) { this.localDescription = d; }
  async setRemoteDescription(d) { this.remoteDescription = d; if (d.type === 'offer' && !this.trs.length) this.addTransceiver('audio', { direction: 'recvonly' }); }
  async addIceCandidate(c) { this.added.push(c); }
  close() { this.closed = true; }
  state(s) { this.connectionState = s; this.onconnectionstatechange?.(); }
}
FakePC.all = [];

function fakeCtx(level = 128) {
  const nodes = [];
  const node = (kind) => { const n = { kind, to: [], connect(x) { this.to.push(x); return x; }, disconnect() { this.cut = true; } }; nodes.push(n); return n; };
  return {
    nodes,
    createMediaStreamSource: (stream) => Object.assign(node('src'), { stream }),
    createPanner: () => node('pan'),
    createGain: () => Object.assign(node('gain'), { gain: { value: 1 } }),
    createAnalyser: () => Object.assign(node('analyser'), { fftSize: 2048, getByteTimeDomainData(b) { b.fill(0); for (let i = 0; i < b.length; i++) b[i] = i % 2 ? 128 + (ctxLevel.v - 128) : 128 - (ctxLevel.v - 128); } }),
  };
}
const ctxLevel = { v: 128 };

function rig({ id, onFail, onMic, mic = 'grant' } = {}) {
  const ctx = fakeCtx(); const bus = { kind: 'bus' };
  const sent = []; const placed = []; const asked = [];
  const track = { enabled: true, stopped: false, stop() { this.stopped = true; } };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  const v = createProxVoice({
    myId: () => id,
    send: (d) => { sent.push(d); return true; },
    RTCPeerConnection: FakePC,
    getUserMedia: (c) => { asked.push(c); return mic === 'grant' ? Promise.resolve(stream) : Promise.reject(new Error('NotAllowed')); },
    ctx: () => ctx, bus: () => bus,
    place: (pan, pos) => placed.push([pan, pos]),
    makeSink: () => ({ stop() {} }),
    onFail, onMic,
  });
  return { v, ctx, bus, sent, placed, asked, track };
}
const near = (id, d = 10) => ({ id, d, head: [d, 1.6, 0] });

test('VOICE1 links: the lower id offers, the other answers on its one transceiver made sendrecv; ICE crosses, held until the far side\'s description lands; the voice is placed at the speaker\'s head, loud enough is speaking; STUN servers only', async () => {
  FakePC.all = [];
  const realNow = Date.now; let clock = 1e6; Date.now = () => clock;
  try {
    const A = rig({ id: 'aaaa-0001' }), B = rig({ id: 'bbbb-0002' });
    A.v.tick({ on: true, peers: [near('bbbb-0002')], now: 0 });
    B.v.tick({ on: true, peers: [near('aaaa-0001')], now: 0 });
    await flush();
    assert.deepEqual(B.sent, [{ to: 'aaaa-0001', k: 'hi' }], 'the higher id never offers - it says it is here (AUDIT VOICE1 A5)');
    const [offer] = A.sent;
    assert.deepEqual(offer, { to: 'bbbb-0002', k: 'offer', sdp: 'offer-of-0' });
    const pcA = FakePC.all[0];
    assert.deepEqual(pcA.cfg.iceServers.map((s) => s.urls), VOICE_ICE_SERVERS.map((s) => s.urls));
    assert.ok(VOICE_ICE_SERVERS.every((s) => s.urls.startsWith('stun:')), 'STUN only - no TURN (Mac\'s choice)');
    assert.equal(pcA.trs.length, 1);
    assert.equal(pcA.trs[0].direction, 'sendrecv');
    // an ICE candidate raced ahead of the offer's answer is held on A, then flushed
    await B.v.receive('aaaa-0001', offer);
    const pcB = FakePC.all[1];
    assert.equal(pcB.trs[0].direction, 'sendrecv', 'the answerer speaks on the same transceiver');
    const answer = B.sent.find((d) => d.k === 'answer');
    assert.deepEqual(answer, { to: 'aaaa-0001', k: 'answer', sdp: 'answer-of-1' });
    await A.v.receive('bbbb-0002', { to: 'aaaa-0001', k: 'ice', c: 'candidate:early', m: '0', i: 0 });
    assert.equal(pcA.added.length, 0, 'held: no remote description yet');
    await A.v.receive('bbbb-0002', answer);
    assert.deepEqual(pcA.added, [{ candidate: 'candidate:early', sdpMid: '0', sdpMLineIndex: 0 }], 'flushed when it lands');
    pcA.onicecandidate({ candidate: { candidate: 'candidate:a1', sdpMid: '0', sdpMLineIndex: 0 } });
    assert.deepEqual(A.sent.at(-1), { to: 'bbbb-0002', k: 'ice', c: 'candidate:a1', m: '0', i: 0 });
    await B.v.receive('aaaa-0001', A.sent.at(-1));
    assert.equal(pcB.added.length, 1);
    // the voice: through a panner (HRTF, linear, 2..30 m), a gain at the volume, into the listener's bus
    B.v.setVolume(1.5);
    pcB.ontrack({ streams: [{ id: 'remote' }] });
    const pan = B.ctx.nodes.find((n) => n.kind === 'pan');
    assert.deepEqual([pan.panningModel, pan.distanceModel, pan.refDistance, pan.maxDistance, pan.rolloffFactor], ['HRTF', 'linear', VOICE_FULL_M, VOICE_HEAR_M, 1]);
    const gain = B.ctx.nodes.find((n) => n.kind === 'gain');
    assert.equal(gain.gain.value, 1.5);
    assert.deepEqual(gain.to, [B.bus]);
    assert.deepEqual(pan.to, [gain]);
    ctxLevel.v = 160;
    B.v.tick({ on: true, peers: [near('aaaa-0001', 7)], now: 1000 });
    assert.deepEqual(B.placed.at(-1), [pan, [7, 1.6, 0]], 'placed at the speaker\'s head');
    assert.deepEqual(B.v.speaking(1000), ['aaaa-0001']);
    assert.deepEqual(B.v.speaking(1400), [], 'held a moment, then quiet');
    ctxLevel.v = 129;
    B.v.tick({ on: true, peers: [near('aaaa-0001', 7)], now: 2000 });
    assert.deepEqual(B.v.speaking(2000), [], 'a hiss is not speech');
    B.v.setVolume(0.5);
    assert.equal(gain.gain.value, 0.5, 'the volume reaches a voice already playing');
  } finally { Date.now = realNow; ctxLevel.v = 128; }
});

test('VOICE1 push-to-talk: the microphone is asked for on the first press, never before, and once; its track is live only while held; it joins the standing links without renegotiation; blocked, the player still hears', async () => {
  FakePC.all = [];
  const mics = [];
  const A = rig({ id: 'aaaa-0001', onMic: (st) => mics.push(st) });
  A.v.tick({ on: true, peers: [near('bbbb-0002')], now: 0 });
  await flush();
  assert.equal(A.asked.length, 0, 'never before a press');
  A.v.setTalking(true);
  A.v.setTalking(true);
  assert.equal(A.asked.length, 1, 'once');
  assert.deepEqual(A.asked[0], VOICE_MIC_CONSTRAINTS);
  assert.equal(A.v.micState(), 'asking');
  await flush();
  assert.equal(A.v.micState(), 'on');
  assert.deepEqual(mics, ['on']);
  assert.equal(FakePC.all[0].trs[0].sender.track, A.track, 'onto the standing link');
  assert.equal(A.track.enabled, true);
  assert.equal(A.v.talking(), true);
  A.v.setTalking(false);
  assert.equal(A.track.enabled, false, 'let go, silent');
  assert.equal(A.v.talking(), false);
  const D = rig({ id: 'aaaa-0003', mic: 'deny', onMic: (st) => mics.push(st) });
  D.v.tick({ on: true, peers: [near('bbbb-0002')], now: 0 });
  D.v.setTalking(true);
  await flush();
  assert.equal(D.v.micState(), 'denied');
  assert.equal(mics.at(-1), 'denied');
  assert.deepEqual(D.v.linked(), ['bbbb-0002'], 'still linked - still hears');
  D.v.setTalking(true);
  assert.equal(D.asked.length, 1, 'not asked again and again');
  const off = rig({ id: 'aaaa-0004' });
  off.v.setTalking(true);
  assert.equal(off.asked.length, 0, 'voice off: a press asks nothing');
});

test('VOICE1 lifecycle: off lets every link go with a bye and stops the microphone; out of earshot lets go; a bye rests the link; a stranger\'s or a higher id\'s offer is declined; a link that never connects is let go - said only when the other side answered', async () => {
  FakePC.all = [];
  const realNow = Date.now; let clock = 1e6; Date.now = () => clock;
  try {
    const fails = [];
    const A = rig({ id: 'aaaa-0001', onFail: (id) => fails.push(id) });
    A.v.tick({ on: true, peers: [near('bbbb-0002'), near('cccc-0003', 20)], now: 0 });
    await flush();
    assert.deepEqual(A.v.linked().sort(), ['bbbb-0002', 'cccc-0003']);
    A.v.setTalking(true); await flush();
    // out of earshot: past the band
    A.v.tick({ on: true, peers: [near('bbbb-0002'), near('cccc-0003', VOICE_UNLINK_M + 1)], now: 10 });
    assert.deepEqual(A.v.linked(), ['bbbb-0002']);
    assert.deepEqual(A.sent.at(-1), { to: 'cccc-0003', k: 'bye' });
    // a bye from B: closed, and not offered again next frame
    await A.v.receive('bbbb-0002', { to: 'aaaa-0001', k: 'bye' });
    assert.deepEqual(A.v.linked(), []);
    const before = A.sent.length;
    A.v.tick({ on: true, peers: [near('bbbb-0002')], now: 20 });
    await flush();
    assert.equal(A.sent.length, before, 'a declined link is not re-offered every frame');
    clock += VOICE_RETRY_MS + 1;
    A.v.tick({ on: true, peers: [near('bbbb-0002')], now: 30 });
    await flush();
    assert.equal(A.sent.at(-1).k, 'offer', 'and is offered again once it has rested');
    // never answered (an old client): let go at VOICE_CONNECT_MS, silently
    clock += VOICE_CONNECT_MS;
    A.v.tick({ on: true, peers: [near('bbbb-0002')], now: 40 });
    assert.deepEqual(A.v.linked(), []);
    assert.deepEqual(fails, [], 'silence from an old client is not news');
    // answered, then ICE never met (no TURN): said
    clock += VOICE_RETRY_MS + 1;
    A.v.tick({ on: true, peers: [near('bbbb-0002')], now: 50 });
    await flush();
    await A.v.receive('bbbb-0002', { to: 'aaaa-0001', k: 'answer', sdp: 'x' });
    clock += VOICE_CONNECT_MS;
    A.v.tick({ on: true, peers: [near('bbbb-0002')], now: 60 });
    assert.deepEqual(fails, ['bbbb-0002']);
    // a link that stood and dropped is not "could not connect"
    clock += VOICE_RETRY_MS + 1;
    A.v.tick({ on: true, peers: [near('bbbb-0002')], now: 70 });
    await flush();
    const pc = FakePC.all.at(-1);
    pc.state('connected'); clock += VOICE_CONNECT_MS * 2;
    A.v.tick({ on: true, peers: [near('bbbb-0002')], now: 80 });
    assert.deepEqual(A.v.linked(), ['bbbb-0002'], 'connected: no deadline');
    pc.state('failed');
    assert.deepEqual(fails, ['bbbb-0002'], 'not said again');
    // off: every link let go with a bye, the microphone stopped
    clock += VOICE_RETRY_MS + 1;
    A.v.tick({ on: true, peers: [near('bbbb-0002')], now: 90 });
    await flush();
    A.v.tick({ on: false, peers: [], now: 100 });
    assert.deepEqual(A.v.linked(), []);
    assert.deepEqual(A.sent.at(-1), { to: 'bbbb-0002', k: 'bye' });
    assert.equal(A.track.stopped, true, 'the microphone is let go too');
    // declined offers
    const B = rig({ id: 'bbbb-0002' });
    B.v.tick({ on: true, peers: [near('aaaa-0001', VOICE_UNLINK_M + 5), near('cccc-0003')], now: 0 });
    await flush();   // B's own offer to cccc (the lower id) goes first
    await B.v.receive('aaaa-0001', { to: 'bbbb-0002', k: 'offer', sdp: 'o' });
    assert.deepEqual(B.sent.at(-1), { to: 'aaaa-0001', k: 'bye' }, 'a stranger across the town');
    await B.v.receive('cccc-0003', { to: 'bbbb-0002', k: 'offer', sdp: 'o' });
    assert.deepEqual(B.sent.at(-1), { to: 'cccc-0003', k: 'bye' }, 'the higher id never offers - a crossed offer is declined');
    assert.deepEqual(B.v.linked().filter((id) => id !== 'cccc-0003'), []);
    const Z = rig({ id: 'zzzz-0009' });
    await Z.v.receive('aaaa-0001', { to: 'zzzz-0009', k: 'offer', sdp: 'o' });
    assert.deepEqual(Z.sent, [{ to: 'aaaa-0001', k: 'bye' }], 'voice off: declined');
    // ICE held is bounded
    const H = rig({ id: 'aaaa-0001' });
    H.v.tick({ on: true, peers: [near('bbbb-0002')], now: 0 });
    await flush();
    for (let k = 0; k < VOICE_PENDING_ICE_MAX + 10; k++) await H.v.receive('bbbb-0002', { to: 'aaaa-0001', k: 'ice', c: `c${k}`, m: null, i: null });
    await H.v.receive('bbbb-0002', { to: 'aaaa-0001', k: 'answer', sdp: 'x' });
    assert.equal(FakePC.all.at(-1).added.length, VOICE_PENDING_ICE_MAX);
  } finally { Date.now = realNow; }
});

// ─── THE CONTROLS, THE SWITCH, THE READOUT ──────────────────────────────────────────────────────────────────────

test('VOICE1 controls and switch: PushToTalk is a port action on the mouse\'s back side button, in the Online group; the side buttons are binding codes; voice is ON by default, the player\'s own say, with its volume', () => {
  assert.ok(ACTIONS.includes('PushToTalk'));
  assert.ok(PORT_ACTIONS.includes('PushToTalk'));
  assert.ok(ACTIONS.indexOf('PushToTalk') > ACTIONS.indexOf('WalkMode'), 'appended, like every port action');
  assert.deepEqual(DEFAULT_BINDINGS.filter(([, a]) => a === 'PushToTalk'), [['Mouse3', 'PushToTalk']]);
  assert.equal(DEFAULT_BINDINGS.filter(([k]) => k === 'Mouse3').length, 1, 'nothing else on it');
  assert.ok(ACTION_GROUPS.find((g) => g.title === 'Online').rows.some((r) => r.action === 'PushToTalk'));
  assert.deepEqual([...MOUSE_CODES], ['Mouse0', 'Mouse2', 'Mouse1', 'Mouse3', 'Mouse4']);
  assert.equal(mouseCode(3), 'Mouse3');
  assert.equal(mouseCode(4), 'Mouse4');
  assert.equal(mouseCode(5), null);
  assert.equal(PREF_DEFAULTS.proxVoice, true, 'on by default (Mac) - the microphone is still asked for only on the first press');
  assert.equal(PREF_DEFAULTS.voiceVolume, 1);
  assert.ok(ONLINE_OWN_PREFS.includes('proxVoice') && ONLINE_OWN_PREFS.includes('voiceVolume'));
  const menu = rd('src/ui/enhancedMenu.js');
  assert.match(menu, /prefRow\('proxVoice', 'Proximity voice chat',/);
  assert.match(menu, /can learn your network address/);
  assert.match(menu, /stepRow\('voiceVolume', 'Voice volume', [^\n]*\{ min: 0\.1, max: 2, step: 0\.1,/);
});

test('VOICE1 readout: me while push-to-talk is held (or why not), then the speakers by name, at most four and a count', () => {
  assert.deepEqual(voiceHudLines({ talking: false, mic: 'none', held: false, speakers: [] }), []);
  assert.deepEqual(voiceHudLines({ talking: true, mic: 'on', held: true, speakers: ['Bran'] }), ['\u{1F399} Talking', '\u{1F50A} Bran']);
  assert.deepEqual(voiceHudLines({ talking: false, mic: 'denied', held: true, speakers: [] }), ['\u{1F399} Microphone blocked']);
  assert.deepEqual(voiceHudLines({ talking: false, mic: 'asking', held: true, speakers: [] }), ['\u{1F399} Allow the microphone…']);
  assert.deepEqual(voiceHudLines({ talking: false, mic: 'denied', held: false, speakers: ['', 'Ann'] }), ['\u{1F50A} Ann'], 'a nameless id is not drawn');
  const six = ['A', 'B', 'C', 'D', 'E', 'F'];
  assert.deepEqual(voiceHudLines({ talking: false, mic: 'on', held: false, speakers: six }).slice(-2), ['\u{1F50A} D', '+2 more']);
  assert.equal(VOICE_HUD_NAMES_MAX, 4);
});

test('VOICE1 host wiring by source: on only by the player\'s switch, a relay that routes it and an open session; each voice at its speaker\'s head; push-to-talk read as a held action; the side buttons never the browser\'s Back; declared above its first reader', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const on = !!getPref\('proxVoice'\) && !!online\?\.voiceOk && online\.status === 'open' && !\(_voiceMutedUntil > Date\.now\(\) \/ 1000\);/, 'AUDIT VOICE1 A4: never while muted');
  assert.match(w, /const head = \[p\.feet\[0\], p\.feet\[1\] \+ \(p\.height \|\| 1\.8\) \* 0\.9, p\.feet\[2\]\];/);
  assert.match(w, /const ptt = on && held\(keys, 'PushToTalk'\);\n\s*proxVoice\.setTalking\(ptt\);/);
  assert.match(w, /online\.onRtc = \(id, d\) => proxVoice\?\.receive\(id, d\);/);
  assert.match(w, /send: \(d\) => online\?\.sendRtc\(d\) \?\? false,/);
  assert.match(w, /if \(!ctx\?\.createMediaStreamDestination\) return null;\n\s*if \(_voiceOut\?\.ctx !== ctx\) \{\n\s*const dest = ctx\.createMediaStreamDestination\(\);\n\s*const el = globalThis\.document\.createElement\('audio'\);\n\s*el\.srcObject = dest\.stream;/, 'AUDIT VOICE1 A7: an unmuted element plays the voices - the echo canceller\'s reference');
  assert.match(w, /for \(const kind of \['mousedown', 'mouseup'\]\) addEventListener\(kind, \(e\) => \{ if \(e\.button === 3 \|\| e\.button === 4\) e\.preventDefault\(\); \}\);/);
  assert.match(w, /voiceFrame\(performance\.now\(\)\);/);
  assert.ok(w.indexOf('let proxVoice = null, voiceHud = null;') < w.indexOf('online.onRtc = '), 'BOOT-TDZ: declared above its first reader');
  const srv = rd('server/src/index.js');
  assert.match(srv, /a = this\._meterRtc\(ws, a, now\); if \(!a\) return;\n[^\n]*\n\s*if \(a\.mu && a\.mu > Math\.floor\(now \/ 1000\)\) \{ if \(m\.data\.k === 'offer'\) this\._send\(ws, JSON\.stringify\(\{ t: 'muted', until: a\.mu \}\)\); return; \}/);
});
