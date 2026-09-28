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

import { voicePlan, acceptsOffer, offersTo, VOICE_FULL_M, VOICE_HEAR_M, VOICE_RETRY_MS } from './voiceLaw.js';

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
 * }} deps
 */
export function createProxVoice(deps) {
  const { send, place } = deps;
  /** @type {Map<string, any>} */
  const links = new Map();
  const failedUntil = new Map();
  const heardAt = new Map();
  let on = false;
  let talking = false;
  let volume = 1;
  let mic = null;   // MediaStream
  let micState = 'none';   // 'none' | 'asking' | 'on' | 'denied'
  let levelAt = -Infinity;
  let lastPeers = [];

  const micTrack = () => mic?.getAudioTracks?.()[0] ?? null;
  const applyTalking = () => { const t = micTrack(); if (t) t.enabled = on && talking; };

  function attachRemote(link, stream) {
    link.stream = stream;
    const ctx = deps.ctx(), bus = deps.bus();
    if (!ctx || !bus || link.graph) return;
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
      const stream = e.streams?.[0] ?? (globalThis.MediaStream && e.track ? new globalThis.MediaStream([e.track]) : null);
      if (stream) attachRemote(link, stream);
    };
    pc.onconnectionstatechange = () => {
      if (link.closed) return;
      if (pc.connectionState === 'connected') link.up = true;
      else if (pc.connectionState === 'failed') fail(id, !link.up);   // a link that stood and dropped is not "could not connect"
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
    if (sayBye) send({ to: id, k: 'bye' });
    const g = link.graph;
    if (g) for (const n of [g.src, g.pan, g.gain, g.analyser]) { try { n.disconnect(); } catch { /* gone */ } }
    try { link.sink?.stop(); } catch { /* gone */ }
    try { link.pc.close(); } catch { /* gone */ }
    heardAt.delete(id);
  }

  /** A link let go and not tried again for VOICE_RETRY_MS - `say` when the player should hear of it. */
  function fail(id, say = true) {
    closeLink(id, true);
    failedUntil.set(id, Date.now() + VOICE_RETRY_MS);
    if (say) deps.onFail?.(id);
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
    if (d.k === 'offer') {
      // only from a player who stands within the kept band, while my voice is on - and only the lower id offers
      if (!acceptsOffer({ on, id, peers: lastPeers }) || !offersTo(id, deps.myId() ?? '')) { send({ to: id, k: 'bye' }); return; }
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
    if (want !== on) {
      on = !!want;
      if (!on) { for (const id of [...links.keys()]) closeLink(id, true); stopMic(); }
      applyTalking();
    }
    lastPeers = on ? peers : [];
    if (!on) return;
    const me = deps.myId();
    const plan = voicePlan({ peers, linked: new Set(links.keys()), now: Date.now(), failedUntil });
    for (const id of plan.close) closeLink(id, true);
    const wall = Date.now();
    for (const link of [...links.values()]) {
      if (link.up || wall - link.born < VOICE_CONNECT_MS) continue;
      fail(link.id, !!link.pc.remoteDescription);
    }
    if (me) for (const id of plan.open) if (offersTo(me, id)) offer(id);
    const read = now - levelAt >= LEVEL_EVERY_MS;
    if (read) levelAt = now;
    for (const p of peers) {
      const link = links.get(p.id);
      if (!link) continue;
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
    }
  }

  function askMic() {
    if (micState === 'asking' || micState === 'on') return;
    micState = 'asking';
    deps.getUserMedia(VOICE_MIC_CONSTRAINTS).then((stream) => {
      if (!on) { for (const t of stream.getTracks?.() ?? []) t.stop(); micState = 'none'; return; }
      mic = stream; micState = 'on';
      applyTalking();
      const t = micTrack();
      for (const link of links.values()) link.sender?.replaceTrack(t);
      deps.onMic?.('on');
    }, () => { micState = 'denied'; deps.onMic?.('denied'); });
  }

  function stopMic() {
    for (const t of mic?.getTracks?.() ?? []) { try { t.stop(); } catch { /* gone */ } }
    mic = null;
    if (micState !== 'denied') micState = 'none';
    for (const link of links.values()) link.sender?.replaceTrack(null);
  }

  return {
    tick,
    receive,
    /** Push-to-talk held or let go. The first press asks for the microphone. */
    setTalking(held) {
      talking = !!held;
      if (talking && on && micState === 'none') askMic();
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
    close() { for (const id of [...links.keys()]) closeLink(id, true); stopMic(); on = false; },
  };
}
