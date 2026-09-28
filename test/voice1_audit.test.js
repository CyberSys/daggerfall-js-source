// AUDIT VOICE1 (2026-09-28, Mac: "Have it on by default and do an audit") - the proximity voice's twelve findings, each
// pinned where it was fixed: A1 a video-only offer froze the frame; A2 push-to-talk stuck on past a lost focus; A3 voice
// outlived going offline, a held frame and the page; A4 a muted player's standing links kept talking; A5 a rest nobody
// could lift (a door, a reload, the switch turned on); A6 frames the gate refused were lost; A7 speaker echo; A8 a
// microphone captured twice; A9 the answerer past the cap; A10 a stood link rested; A11 a blocked microphone never
// asked again; A12 the rests never pruned.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { acceptsOffer, VOICE_RETRY_MS, VOICE_PEERS_MAX } from '../src/net/voiceLaw.js';
import { createProxVoice, VOICE_HI_MS, VOICE_OUTBOX_MAX, VOICE_MIC_RETRY_MS, VOICE_CONNECT_MS, VOICE_STALL_MS, VOICE_TALK_HOLD_MS } from '../src/net/proxVoice.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const flush = () => new Promise((r) => setImmediate(r));

class FakePC {
  constructor() { this.trs = []; this.remoteDescription = null; this.connectionState = 'new'; this.added = []; FakePC.all.push(this); }
  addTransceiver(kind, o) { const tr = { direction: o.direction, sender: { track: null, replaceTrack(t) { this.track = t; } } }; this.trs.push(tr); return tr; }
  getTransceivers() { return this.trs; }
  async createOffer() { return { type: 'offer', sdp: 'o' }; }
  async createAnswer() { return { type: 'answer', sdp: 'a' }; }
  async setLocalDescription() {}
  async setRemoteDescription(d) { this.remoteDescription = d; if (d.type === 'offer' && !this.trs.length) this.addTransceiver('audio', { direction: 'recvonly' }); }
  async addIceCandidate(c) { this.added.push(c); }
  close() { this.closed = true; }
  state(s) { this.connectionState = s; this.onconnectionstatechange?.(); }
}
FakePC.all = [];
const node = (kind) => ({ kind, connect(x) { return x; }, disconnect() {} });
const ctxOk = () => ({ createMediaStreamSource: () => node('src'), createPanner: () => node('pan'), createGain: () => ({ ...node('gain'), gain: { value: 1 } }), createAnalyser: () => ({ ...node('an'), fftSize: 256, getByteTimeDomainData(b) { b.fill(128); } }) });

function rig({ id = 'aaaa-0001', ctx = ctxOk(), gum = null, onFail = null, sendOk = () => true } = {}) {
  const sent = [], tried = [];
  const tracks = [];
  const v = createProxVoice({
    myId: () => id,
    send: (d) => { tried.push(d); if (!sendOk(d)) return false; sent.push(d); return true; },
    RTCPeerConnection: FakePC,
    getUserMedia: gum ?? (() => { const t = { enabled: true, stopped: false, stop() { this.stopped = true; } }; tracks.push(t); return Promise.resolve({ getAudioTracks: () => [t], getTracks: () => [t] }); }),
    ctx: () => ctx, bus: () => ({ kind: 'bus' }), place: () => {},
    onFail,
  });
  return { v, sent, tried, tracks };
}
const near = (id, d = 10) => ({ id, d, head: [0, 0, 0] });
async function withClock(fn) { const real = Date.now; let clock = 1e6; Date.now = () => clock; try { await fn({ tick: (ms) => { clock += ms; } }); } finally { Date.now = real; } }

test('AUDIT VOICE1 A1: a voice link carries a voice - a video track is ignored, a stream with no audio is never handed to WebAudio, and a graph that throws marks its link and never throws out of the frame', async () => {
  FakePC.all = [];
  const bad = { createMediaStreamSource: () => { throw new Error('InvalidStateError'); }, createPanner: () => node('pan'), createGain: () => node('gain'), createAnalyser: () => node('an') };
  const { v } = rig({ id: 'bbbb-0002', ctx: bad });
  v.tick({ on: true, peers: [near('aaaa-0001')], now: 0 });
  await v.receive('aaaa-0001', { to: 'bbbb-0002', k: 'offer', sdp: 'o' });
  const pc = FakePC.all.at(-1);
  pc.ontrack({ track: { kind: 'video' }, streams: [{ getAudioTracks: () => [1] }] });
  pc.ontrack({ streams: [{ getAudioTracks: () => [] }] });
  pc.ontrack({ streams: [{ getAudioTracks: () => [1] }] });   // an audio stream whose graph throws
  for (let k = 0; k < 3; k++) assert.doesNotThrow(() => v.tick({ on: true, peers: [near('aaaa-0001')], now: 1000 * k }), 'the frame goes on');
  const src = rd('src/net/proxVoice.js');
  assert.match(src, /if \(e\.track\?\.kind && e\.track\.kind !== 'audio'\) return;/);
  assert.match(src, /if \(stream\?\.getAudioTracks && !stream\.getAudioTracks\(\)\.length\) return;/);
  assert.match(src, /try \{ buildGraph\(link, ctx, bus, stream\); \} catch \{ link\.graphFailed = true; \}/);
});

test('AUDIT VOICE1 A5: the higher id says `hi` (at most every VOICE_HI_MS); the lower id lifts a soft rest on it and offers at once - never a rest two networks earned by failing to meet', async () => withClock(async ({ tick }) => {
  FakePC.all = [];
  const hi = rig({ id: 'bbbb-0002' });
  hi.v.tick({ on: true, peers: [near('aaaa-0001')], now: 0 });
  hi.v.tick({ on: true, peers: [near('aaaa-0001')], now: 16 });
  assert.deepEqual(hi.sent, [{ to: 'aaaa-0001', k: 'hi' }], 'once, not every frame');
  tick(VOICE_HI_MS);
  hi.v.tick({ on: true, peers: [near('aaaa-0001')], now: 32 });
  assert.equal(hi.sent.length, 2, 'and again after VOICE_HI_MS while no link stands');
  const lo = rig({ id: 'aaaa-0001' });
  lo.v.tick({ on: true, peers: [near('bbbb-0002')], now: 0 });
  await flush();
  await lo.v.receive('bbbb-0002', { to: 'aaaa-0001', k: 'bye' });   // declined (voice off then): rested
  lo.v.tick({ on: true, peers: [near('bbbb-0002')], now: 16 });
  await flush();
  assert.equal(lo.sent.filter((d) => d.k === 'offer').length, 1, 'rested');
  await lo.v.receive('bbbb-0002', { to: 'aaaa-0001', k: 'hi' });
  lo.v.tick({ on: true, peers: [near('bbbb-0002')], now: 32 });
  await flush();
  assert.equal(lo.sent.filter((d) => d.k === 'offer').length, 2, 'the hi lifts the rest - offered at once');
  // answered, then never met: a hard rest a hi does not lift
  await lo.v.receive('bbbb-0002', { to: 'aaaa-0001', k: 'answer', sdp: 'a' });
  tick(VOICE_CONNECT_MS);
  lo.v.tick({ on: true, peers: [near('bbbb-0002')], now: 48 });
  await lo.v.receive('bbbb-0002', { to: 'aaaa-0001', k: 'hi' });
  lo.v.tick({ on: true, peers: [near('bbbb-0002')], now: 64 });
  await flush();
  assert.equal(lo.sent.filter((d) => d.k === 'offer').length, 2, 'two networks that could not meet stay rested');
  tick(VOICE_RETRY_MS + 1);
  lo.v.tick({ on: true, peers: [near('bbbb-0002')], now: 80 });
  await flush();
  assert.equal(lo.sent.filter((d) => d.k === 'offer').length, 3, 'A12: and the rest ends (pruned) on its time');
}));

test('AUDIT VOICE1 A6: a frame the relay\'s gate refuses waits in the outbox and goes, in order, on the next frame; a link let go takes its unsent frames with it; the outbox is bounded', async () => {
  FakePC.all = [];
  let open = false;
  const r = rig({ id: 'aaaa-0001', sendOk: () => open });
  r.v.tick({ on: true, peers: [near('bbbb-0002'), near('cccc-0003', 20)], now: 0 });
  await flush();
  FakePC.all[0].onicecandidate({ candidate: { candidate: 'c1', sdpMid: '0', sdpMLineIndex: 0 } });
  assert.equal(r.sent.length, 0, 'the gate is shut');
  open = true;
  r.v.tick({ on: true, peers: [near('bbbb-0002'), near('cccc-0003', 20)], now: 16 });
  assert.deepEqual(r.sent.map((d) => `${d.to}:${d.k}`), ['bbbb-0002:offer', 'cccc-0003:offer', 'bbbb-0002:ice'], 'in order');
  open = false;
  FakePC.all[1].onicecandidate({ candidate: { candidate: 'c2', sdpMid: '0', sdpMLineIndex: 0 } });
  r.v.tick({ on: true, peers: [near('bbbb-0002')], now: 32 });   // cccc out of the room: let go
  open = true;
  r.v.tick({ on: true, peers: [near('bbbb-0002')], now: 48 });
  assert.deepEqual(r.sent.slice(3), [{ to: 'cccc-0003', k: 'bye' }], 'its candidate went with it - only the goodbye');
  assert.equal(VOICE_OUTBOX_MAX, 256);
  assert.match(rd('src/net/proxVoice.js'), /const send = \(d\) => \{ outbox\.push\(d\); if \(outbox\.length > VOICE_OUTBOX_MAX\) outbox\.shift\(\); flush\(\); \};/);
});

test('AUDIT VOICE1 A8/A11: a microphone answer that arrives after the voice was turned off and on is stopped, never kept beside a second; a blocked microphone is asked again on a press VOICE_MIC_RETRY_MS later', async () => withClock(async ({ tick }) => {
  const pending = [];
  const made = [];
  const gum = () => new Promise((res) => pending.push(res));
  const r = rig({ gum });
  r.v.tick({ on: true, peers: [], now: 0 });
  r.v.setTalking(true);
  r.v.tick({ on: false, peers: [], now: 16 });
  r.v.tick({ on: true, peers: [], now: 32 });
  r.v.setTalking(true);
  assert.equal(pending.length, 2);
  const stream = () => { const t = { enabled: true, stopped: false, stop() { this.stopped = true; } }; made.push(t); return { getAudioTracks: () => [t], getTracks: () => [t] }; };
  pending[0](stream()); await flush();
  assert.equal(made[0].stopped, true, 'the stale answer is let go');
  pending[1](stream()); await flush();
  assert.equal(made[1].stopped, false);
  assert.equal(r.v.micState(), 'on');
  // denied, then asked again only after VOICE_MIC_RETRY_MS
  let asks = 0;
  const d = rig({ gum: () => { asks++; return Promise.reject(new Error('NotAllowed')); } });
  d.v.tick({ on: true, peers: [], now: 0 });
  d.v.setTalking(true); await flush();
  assert.equal(d.v.micState(), 'denied');
  d.v.setTalking(false); d.v.setTalking(true);
  assert.equal(asks, 1, 'not at once');
  tick(VOICE_MIC_RETRY_MS);
  d.v.setTalking(false); d.v.setTalking(true);
  assert.equal(asks, 2, 'the player may have allowed it since');
}));

test('AUDIT VOICE1 A9/A10: an offer is answered only from among my nearest VOICE_PEERS_MAX; a link that stood and dropped is neither said nor rested', async () => withClock(async ({ tick }) => {
  const crowd = Array.from({ length: 10 }, (_, i) => ({ id: `p${i}`, d: i + 1 }));
  assert.equal(acceptsOffer({ on: true, id: 'p7', peers: crowd, max: VOICE_PEERS_MAX }), true, 'the eighth nearest');
  assert.equal(acceptsOffer({ on: true, id: 'p8', peers: crowd, max: VOICE_PEERS_MAX }), false, 'the ninth - the plan would close it next frame');
  FakePC.all = [];
  const fails = [];
  const r = rig({ onFail: (id) => fails.push(id) });
  r.v.tick({ on: true, peers: [near('bbbb-0002')], now: 0 });
  await flush();
  const pc = FakePC.all.at(-1);
  pc.state('connected');
  pc.state('failed');
  assert.deepEqual(fails, [], 'not "could not connect"');
  r.v.tick({ on: true, peers: [near('bbbb-0002')], now: 16 });
  await flush();
  assert.equal(r.sent.filter((d) => d.k === 'offer').length, 2, 'offered again at once - a reload on the far side is heard again');
  tick(0);
}));

test('AUDIT VOICE1 A3/A2: the stall watch - no frame ticks the voice for VOICE_STALL_MS (offline, a held frame, a hidden tab) and every link goes with its goodbye, the microphone let go; push-to-talk lives only while a frame keeps saying so', async () => withClock(async ({ tick }) => {
  FakePC.all = [];
  const iv = [], to = [];
  const timers = { setInterval: (fn, ms) => { iv.push({ fn, ms, live: true }); return iv.length; }, clearInterval: (h) => { if (iv[h - 1]) iv[h - 1].live = false; }, setTimeout: (fn, ms) => { to.push({ fn, ms, live: true }); return to.length; }, clearTimeout: (h) => { if (to[h - 1]) to[h - 1].live = false; } };
  const sent = [];
  const trk = { enabled: true, stopped: false, stop() { this.stopped = true; } };
  const v = createProxVoice({ myId: () => 'aaaa-0001', send: (d) => { sent.push(d); return true; }, RTCPeerConnection: FakePC,
    getUserMedia: () => Promise.resolve({ getAudioTracks: () => [trk], getTracks: () => [trk] }), ctx: () => null, bus: () => null, place: () => {}, timers });
  v.tick({ on: true, peers: [near('bbbb-0002')], now: 0 });
  await flush();
  assert.equal(iv.filter((x) => x.live).length, 1, 'one watch');
  v.setTalking(true); await flush();
  assert.equal(trk.enabled, true);
  // push-to-talk unrefreshed: let go
  to.filter((x) => x.live).at(-1).fn();
  assert.equal(trk.enabled, false, 'a frame must keep saying it');
  assert.equal(to.at(-1).ms, VOICE_TALK_HOLD_MS);
  // frames still coming: the watch holds
  tick(VOICE_STALL_MS - 1); iv[0].fn();
  assert.deepEqual(v.linked(), ['bbbb-0002']);
  // no frame for VOICE_STALL_MS: all let go
  tick(2); iv[0].fn();
  assert.deepEqual(v.linked(), []);
  assert.deepEqual(sent.at(-1), { to: 'bbbb-0002', k: 'bye' });
  assert.equal(trk.stopped, true, 'the microphone let go');
  assert.equal(iv[0].live, false, 'the watch with it');
  // a frame again: back on, a new watch
  v.tick({ on: true, peers: [near('bbbb-0002')], now: 99 });
  await flush();
  assert.deepEqual(v.linked(), ['bbbb-0002']);
  assert.equal(iv.filter((x) => x.live).length, 1);
  v.close();
}));

test('AUDIT VOICE1 A2/A3/A4/A7 host wiring by source: push-to-talk let go on a lost focus (a hidden tab runs no frames - the lapse and the stall watch); every link\'s goodbye as the page goes; the relay\'s mute read; the voices played by an unmuted element', () => {
  const w = rd('src/scenes/world.js');
  assert.match(w, /const letGoOfTalk = \(\) => \{ for \(const c of \[\.\.\.keys\]\) if \(held\(new Set\(\[c\]\), 'PushToTalk'\)\) keys\.delete\(c\); proxVoice\?\.setTalking\(false\); \};\n\s*addEventListener\('blur', letGoOfTalk\);/);
  assert.match(w, /globalThis\.addEventListener\?\.\('pagehide', \(\) => proxVoice\?\.close\(\)\);/);
  assert.match(w, /const onMuted = \(\{ until \}\) => \{\n\s*_voiceMutedUntil = Number\(until\) \|\| 0;/);
  assert.match(w, /if \(_voiceOut\.el\.paused\) _voiceOut\.el\.play/);
});
