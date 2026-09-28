// @ts-check
// VOICE1 (2026-09-28, Mac: "Lets instead take this idea and develop prox chat"; Mac chose PUSH-TO-TALK, STUN ONLY,
// NEARBY ONLY) - PROXIMITY VOICE: the links and the sound.
//
// Every player within earshot (net/voiceLaw.js voicePlan) holds one WebRTC peer connection with me, browser to
// browser; the relay only carries the introductions (wire.js `rtc`: offer, answer, ICE, bye) and never the voice.
// Each link is ONE audio transceiver, sendrecv from birth, so the microphone joins a link that already stands with
// `replaceTrack` - no renegotiation - and a player who has not yet granted the microphone still HEARS everyone.
//
//   Push-to-talk: the microphone's track is enabled only while the key is held (`setTalking`); asked for on the
//   first press, never before. Denied, the player still hears.
//   The sound: each voice through a PannerNode at the speaker's head (HRTF, WebAudio's 'linear' model at
//   VOICE_FULL_M..VOICE_HEAR_M - voiceLaw's own curve), a gain for the Voice volume, into the listener's bus
//   (systems/audio.js listenerBus - past the sound-effects volume, under the underwater muffle like every sound).
//   Who is speaking: an AnalyserNode per voice, read ten times a second (`speaking`).
//   No TURN server: a link that cannot connect is let go, said once, and not tried again for VOICE_RETRY_MS.
//
// Everything the browser owns is INJECTED (the peer connection class, getUserMedia, the audio context, the sink that
// keeps Chrome's remote stream flowing), so node drives it in a test exactly as the page does.

import { voicePlan, acceptsOffer, offersTo, VOICE_FULL_M, VOICE_HEAR_M, VOICE_RETRY_MS, VOICE_PEERS_MAX } from './voiceLaw.js';

/** STUN only (Mac's choice): two public servers, so one down is not voice down. */
export const VOICE_ICE_SERVERS = Object.freeze([
  Object.freeze({ urls: 'stun:stun.l.google.com:19302' }),
  Object.freeze({ urls: 'stun:stun.cloudflare.com:3478' }),
]);
/** ICE candidates held for a link whose remote description has not landed yet - past it, the rest are dropped. */
export const VOICE_PENDING_ICE_MAX = 64;
/** A voice louder than this (RMS of the waveform, 0..1) is speaking, and stays so this long after. */
export const VOICE_SPEAKING_RMS = 0.02;
export const VOICE_SPEAKING_HOLD_MS = 300;
const LEVEL_EVERY_MS = 100;
/** A link not connected this long after it was made is let go - an old client that never answers, or two networks
 *  that cannot meet (said only when the other side DID answer: silence from an old client is not news). */
export const VOICE_CONNECT_MS = 20000;
/** AUDIT VOICE1 A5: the higher id's "I am here and listening" (`hi`), at most this often to one peer - the lower id
 *  offers again at once instead of waiting out a rest a door, a reload or a switch turned on left behind. */
export const VOICE_HI_MS = 5000;
/** AUDIT VOICE1 A6: frames the relay's gate (RTC_HZ_MAX) held back, sent on the next frames in order - at most this many. */
export const VOICE_OUTBOX_MAX = 256;
/** AUDIT VOICE1 A11: a blocked microphone is asked again on a press this long after the refusal (the player may have
 *  allowed it in the browser since). */
export const VOICE_MIC_RETRY_MS = 10000;
/** AUDIT VOICE1 A3: THE STALL WATCH - no frame has ticked the voice this long (offline, a video holding the frame, a
 *  hidden tab, the page going): every link let go with its goodbye and the microphone released. And push-to-talk is
 *  live only while a frame keeps saying so: unrefreshed this long, it is let go (A2's other half). */
export const VOICE_STALL_MS = 3000;
export const VOICE_TALK_HOLD_MS = 400;
/** The microphone's own clean-up - the browser's, on. */
export const VOICE_MIC_CONSTRAINTS = Object.freeze({ audio: Object.freeze({ echoCancellation: true, noiseSuppression: true, autoGainControl: true }), video: false });

/**
 * @param {{
 *   myId: () => string|null,
 *   send: (d: object) => boolean,
 *   RTCPeerConnection: any,
 *   getUserMedia: (c: object) => Promise<any>,
 *   ctx: () => any,
 *   bus: () => any,
 *   place: (pan: any, pos: number[]) => void,
 *   makeSink?: (stream: any) => ({ stop: () => void }|null),
 *   onFail?: (id: string) => void,
 *   onMic?: (state: 'on'|'denied') => void,
 *   timers?: { setInterval: Function, clearInterval: Function, setTimeout: Function, clearTimeout: Function },
 * }} deps
 */
export function createProxVoice(deps) {
  const { place } = deps;
  /** @type {Map<string, any>} */
  const links = new Map();
  const failedUntil = new Map();
  const hardFail = new Set();   // AUDIT VOICE1 A5: rests a `hi` may not lift - two networks that could not meet
  const hiAt = new Map();
  const heardAt = new Map();
  let on = false;
  let talking = false;
  let volume = 1;
  let mic = null;   // MediaStream
  let micState = 'none';   // 'none' | 'asking' | 'on' | 'denied'
  let micGen = 0;   // AUDIT VOICE1 A8: a stale getUserMedia answer is stopped, never kept
  let deniedAt = 0;
  let levelAt = -Infinity;
  let lastPeers = [];
  let tickAt = 0, watch = null, talkTimer = null;
  const timers = deps.timers ?? globalThis;
  // AUDIT VOICE1 A6: THE OUTBOX - a frame the relay's gate refused waits its turn instead of vanishing (an offer or a
  // candidate lost was a link that never connected); a link let go takes its unsent frames with it
  let outbox = [];
  const flush = () => { while (outbox.length && deps.send(outbox[0])) outbox.shift(); };
  const send = (d) => { outbox.push(d); if (outbox.length > VOICE_OUTBOX_MAX) outbox.shift(); flush(); };

  const micTrack = () => mic?.getAudioTracks?.()[0] ?? null;
  const applyTalking = () => { const t = micTrack(); if (t) t.enabled = on && talking; };

  function attachRemote(link, stream) {
    // AUDIT VOICE1 A1: only a stream that HOLDS audio - createMediaStreamSource throws on one without, and the frame
    // that retried it threw every frame after
    if (stream?.getAudioTracks && !stream.getAudioTracks().length) return;
    link.stream = stream;
    const ctx = deps.ctx(), bus = deps.bus();
    if (!ctx || !bus || link.graph || link.graphFailed) return;
    try { buildGraph(link, ctx, bus, stream); } catch { link.graphFailed = true; }
  }
  function buildGraph(link, ctx, bus, stream) {
    const src = ctx.createMediaStreamSource(stream);
    const pan = ctx.createPanner();
    pan.panningModel = 'HRTF';
    pan.distanceModel = 'linear';
    pan.refDistance = VOICE_FULL_M;
    pan.maxDistance = VOICE_HEAR_M;
    pan.rolloffFactor = 1;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    src.connect(pan).connect(gain).connect(bus);
    link.graph = { src, pan, gain, analyser, buf: new Uint8Array(analyser.fftSize) };
    link.sink ??= deps.makeSink?.(stream) ?? null;
  }

  function makeLink(id, offerer) {
    const pc = new deps.RTCPeerConnection({ iceServers: VOICE_ICE_SERVERS });
    const link = { id, pc, offerer, sender: null, pendingIce: [], stream: null, graph: null, sink: null, closed: false, born: Date.now(), up: false };
    pc.onicecandidate = (e) => {
      if (link.closed || !e?.candidate) return;
      send({ to: id, k: 'ice', c: e.candidate.candidate ?? '', m: e.candidate.sdpMid ?? null, i: e.candidate.sdpMLineIndex ?? null });
    };
    pc.ontrack = (e) => {
      if (link.closed) return;
      if (e.track?.kind && e.track.kind !== 'audio') return;   // AUDIT VOICE1 A1: a voice link carries a voice
      const stream = globalThis.MediaStream && e.track ? new globalThis.MediaStream([e.track]) : e.streams?.[0] ?? null;
      if (stream) attachRemote(link, stream);
    };
    pc.onconnectionstatechange = () => {
      if (link.closed) return;
      if (pc.connectionState === 'connected') link.up = true;
      else if (pc.connectionState === 'failed') fail(id, { say: !link.up, rest: !link.up });   // a link that stood and dropped is not "could not connect", and is tried again at once (AUDIT VOICE1 A10)
    };
    links.set(id, link);
    return link;
  }

  function wireSender(link) {
    const tr = link.pc.getTransceivers?.()[0] ?? null;
    if (!tr) return;
    tr.direction = 'sendrecv';
    link.sender = tr.sender;
    const t = micTrack();
    if (t) link.sender.replaceTrack(t);
  }

  function closeLink(id, sayBye) {
    const link = links.get(id);
    if (!link) return;
    link.closed = true;
    links.delete(id);
    outbox = outbox.filter((d) => d.to !== id);
    if (sayBye) send({ to: id, k: 'bye' });
    const g = link.graph;
    if (g) for (const n of [g.src, g.pan, g.gain, g.analyser]) { try { n.disconnect(); } catch { /* gone */ } }
    try { link.sink?.stop(); } catch { /* gone */ }
    try { link.pc.close(); } catch { /* gone */ }
    heardAt.delete(id);
  }

  /** A link let go - rested VOICE_RETRY_MS unless it had stood (`rest`), said when the player should hear of it (`say`).
   *  A said failure is a HARD rest: two networks that could not meet, which a `hi` does not lift. */
  function fail(id, { say = true, rest = true } = {}) {
    closeLink(id, true);
    if (rest) failedUntil.set(id, Date.now() + VOICE_RETRY_MS);
    if (say) { hardFail.add(id); deps.onFail?.(id); }
  }

  async function offer(id) {
    const link = makeLink(id, true);
    link.pc.addTransceiver('audio', { direction: 'sendrecv' });
    wireSender(link);
    try {
      const o = await link.pc.createOffer();
      if (link.closed) return;
      await link.pc.setLocalDescription(o);
      if (link.closed) return;
      send({ to: id, k: 'offer', sdp: o.sdp });
    } catch { if (!link.closed) fail(id); }
  }

  async function flushIce(link) {
    const held = link.pendingIce.splice(0);
    for (const c of held) { try { await link.pc.addIceCandidate(c); } catch { /* a stale candidate is not a failure */ } }
  }

  /** A voice frame from `id` (wire.js validRtcData's projection). */
  async function receive(id, d) {
    if (typeof id !== 'string' || !d) return;
    if (d.k === 'bye') { if (links.has(id)) { closeLink(id, false); failedUntil.set(id, Date.now() + VOICE_RETRY_MS); } return; }   // declined or ended: not offered again at once (every frame would)
    // AUDIT VOICE1 A5: the higher id is here and listening - its rest (a bye, a silent timeout) is lifted and the next
    // frame offers; a rest two networks earned by failing to meet is not
    if (d.k === 'hi') { if (on && !links.has(id) && !hardFail.has(id)) failedUntil.delete(id); return; }
    if (d.k === 'offer') {
      // only from a player who stands within the kept band, while my voice is on - and only the lower id offers
      if (!acceptsOffer({ on, id, peers: lastPeers, max: VOICE_PEERS_MAX }) || !offersTo(id, deps.myId() ?? '')) { send({ to: id, k: 'bye' }); return; }
      closeLink(id, false);   // an offer over a standing link is a new link (the other side restarted)
      const link = makeLink(id, false);
      try {
        await link.pc.setRemoteDescription({ type: 'offer', sdp: d.sdp });
        if (link.closed) return;
        wireSender(link);
        const a = await link.pc.createAnswer();
        if (link.closed) return;
        await link.pc.setLocalDescription(a);
        if (link.closed) return;
        send({ to: id, k: 'answer', sdp: a.sdp });
        await flushIce(link);
      } catch { if (!link.closed) fail(id); }
      return;
    }
    const link = links.get(id);
    if (!link) return;
    if (d.k === 'answer') {
      if (!link.offerer || link.pc.remoteDescription) return;
      try { await link.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp }); await flushIce(link); } catch { if (!link.closed) fail(id); }
      return;
    }
    if (d.k === 'ice') {
      const c = { candidate: d.c, sdpMid: d.m, sdpMLineIndex: d.i };
      if (!link.pc.remoteDescription) { if (link.pendingIce.length < VOICE_PENDING_ICE_MAX) link.pendingIce.push(c); return; }
      try { await link.pc.addIceCandidate(c); } catch { /* a stale candidate is not a failure */ }
    }
  }

  /**
   * ONCE A FRAME: `on` (the setting, online, a place room), `peers` ({id, d, head} - metres from me, and the head in
   * scene coordinates), `now` (ms). Opens the links I offer, lets go of the ones out of earshot, and places each voice.
   */
  function tick({ on: want, peers, now }) {
    tickAt = Date.now();
    if (want && !watch) watch = timers.setInterval(() => { if (Date.now() - tickAt > VOICE_STALL_MS) closeAll(); }, VOICE_STALL_MS / 3);
    watch?.unref?.();   // never what keeps a process alive
    if (want !== on) {
      on = !!want;
      if (!on) { for (const id of [...links.keys()]) closeLink(id, true); stopMic(); }
      applyTalking();
    }
    flush();
    lastPeers = on ? peers : [];
    if (!on) return;
    const me = deps.myId();
    const wall = Date.now();
    for (const [id, until] of failedUntil) if (until <= wall) { failedUntil.delete(id); hardFail.delete(id); }   // AUDIT VOICE1 A12: a rest ends
    const plan = voicePlan({ peers, linked: new Set(links.keys()), now: wall, failedUntil });
    for (const id of plan.close) closeLink(id, true);
    for (const link of [...links.values()]) {
      if (link.up || wall - link.born < VOICE_CONNECT_MS) continue;
      const answered = !!link.pc.remoteDescription;
      fail(link.id, { say: answered });
    }
    if (me) {
      for (const id of plan.open) {
        if (offersTo(me, id)) { offer(id); continue; }
        if (wall - (hiAt.get(id) ?? -Infinity) < VOICE_HI_MS) continue;   // AUDIT VOICE1 A5: the higher id says it is here
        hiAt.set(id, wall);
        send({ to: id, k: 'hi' });
      }
      for (const id of hiAt.keys()) if (!plan.want.has(id)) hiAt.delete(id);
    }
    const read = now - levelAt >= LEVEL_EVERY_MS;
    if (read) levelAt = now;
    for (const p of peers) {
      const link = links.get(p.id);
      if (!link) continue;
      try {   // AUDIT VOICE1 A1: one voice's graph never takes the frame down
        if (!link.graph && link.stream) attachRemote(link, link.stream);
        const g = link.graph;
        if (!g) continue;
        if (Array.isArray(p.head)) place(g.pan, p.head);
        if (read) {
          g.analyser.getByteTimeDomainData(g.buf);
          let sum = 0;
          for (const v of g.buf) { const x = (v - 128) / 128; sum += x * x; }
          if (Math.sqrt(sum / g.buf.length) > VOICE_SPEAKING_RMS) heardAt.set(p.id, now);
        }
      } catch { link.graphFailed = true; }
    }
  }

  function askMic() {
    if (micState === 'asking' || micState === 'on') return;
    micState = 'asking';
    const gen = ++micGen;
    const drop = (stream) => { for (const t of stream?.getTracks?.() ?? []) { try { t.stop(); } catch { /* gone */ } } };
    let ask;
    try { ask = deps.getUserMedia(VOICE_MIC_CONSTRAINTS); } catch (e) { ask = Promise.reject(e); }
    Promise.resolve(ask).then((stream) => {
      if (gen !== micGen || !on) { drop(stream); if (gen === micGen) micState = 'none'; return; }   // AUDIT VOICE1 A8: a stale answer is let go
      drop(mic);
      mic = stream; micState = 'on';
      applyTalking();
      const t = micTrack();
      for (const link of links.values()) link.sender?.replaceTrack(t);
      deps.onMic?.('on');
    }, () => { if (gen !== micGen) return; micState = 'denied'; deniedAt = Date.now(); deps.onMic?.('denied'); });
  }

  function stopMic() {
    micGen++;
    for (const t of mic?.getTracks?.() ?? []) { try { t.stop(); } catch { /* gone */ } }
    mic = null;
    if (micState !== 'denied') micState = 'none';
    for (const link of links.values()) link.sender?.replaceTrack(null);
  }

  function closeAll() {
    if (watch) { timers.clearInterval(watch); watch = null; }
    if (talkTimer) { timers.clearTimeout(talkTimer); talkTimer = null; }
    for (const id of [...links.keys()]) closeLink(id, true);
    flush();
    stopMic();
    on = false; talking = false;
  }

  return {
    tick,
    receive,
    /** Push-to-talk held or let go. The first press asks for the microphone. */
    setTalking(held) {
      talking = !!held;
      if (talkTimer) { timers.clearTimeout(talkTimer); talkTimer = null; }
      if (talking) { talkTimer = timers.setTimeout(() => { talkTimer = null; talking = false; applyTalking(); }, VOICE_TALK_HOLD_MS); talkTimer?.unref?.(); }   // A2/A3: a frame must keep saying it
      if (talking && on && (micState === 'none' || (micState === 'denied' && Date.now() - deniedAt >= VOICE_MIC_RETRY_MS))) { if (micState === 'denied') micState = 'none'; askMic(); }
      applyTalking();
    },
    setVolume(v) { volume = Math.max(0, Math.min(2, Number(v) || 0)); for (const l of links.values()) if (l.graph) l.graph.gain.gain.value = volume; },
    /** The ids heard speaking within the last VOICE_SPEAKING_HOLD_MS. */
    speaking(now) { return [...heardAt].filter(([, at]) => now - at <= VOICE_SPEAKING_HOLD_MS).map(([id]) => id); },
    /** Whether my own voice is going out now. */
    talking: () => on && talking && micState === 'on',
    micState: () => micState,
    linked: () => [...links.keys()],
    /** Everything let go - offline, or the page closing. */
    close: closeAll,
  };
}
