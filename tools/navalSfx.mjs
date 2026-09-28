// THE SEA FIGHT'S SOUNDS, SYNTHESISED AND BAKED (NAV-E, 2026-09-28, Mac: "proper naval combat with a huge reference
// to assassins creed black flag ... extremely detailed, authentic").
//
// OURS, the gun lab's way (tools/gunSfx.mjs): built here from noise and sine with the shared kit (tools/sfxSynth.mjs)
// and put through the one bake - tools/sndify.mjs, down to DAGGER.SND's own 11025 Hz unsigned 8-bit mono - so a
// broadside sits IN Daggerfall's world rather than on top of it: nothing above 5 kHz that matters, transients shaped
// to survive the decimation, the tails a black-powder gun has in open air. DAGGER.SND has splashes, bells, bubbles
// and fire (the naval host plays those by index), and no cannon, no splintering oak and no grapnel - these six.
//
//   naval-cannon      a long gun near: the crack off the muzzle, the gas leaving (a body falling 2.4 kHz -> 180 Hz),
//                     the chest-deep thump (75 -> 34 Hz), and the roll across open water with its slap back off the
//                     sea and the hulls - no stone room: a field of water, so the tail is long and low
//   naval-cannon-far  a broadside across the bay: the top gone in the air (all under 500 Hz), a soft onset, two
//                     thumps rolled together and a long rumble - what Black Flag's distant fights sound like
//   naval-swivel      the swivel gun on a rail: sharper, higher, shorter - a musket's big brother
//   naval-hit         a ball into oak: the thud through the frames, the splinters flying (uneven ticks, loudest
//                     first), and the timbers' groan after
//   naval-blast       a powder barrel going up: the deepest thump in the set, a body that takes a third of a second to
//                     leave, the debris crackling down for over a second
//   naval-grapple     the grapnels thrown: a rope's whoosh, two iron hooks biting a rail (each a clank with its own
//                     ringing partials over a wooden knock), and the hawsers creaking taut as she is hauled in
//
//     node tools/navalSfx.mjs            # writes public/sfx/naval-*.wav
//     node tools/navalSfx.mjs --raw=dir  # also the 44.1 kHz source
//
// DETERMINISTIC: every noise is a seeded PRNG (each clip its own seed), so re-running writes the same bytes - the rule
// public/README.md sets for anything of ours that ships. Provenance: public/sfx/SOURCES.md; the doctrine allow-list
// (test/doctrine.test.js) carries a row for each.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bake, writeWav8, DF_RATE } from './sndify.mjs';
import { RATE, rng, seconds, buf, decay, attack, biquad, sweepLowpass, noise, mix, softClip, envelope } from './sfxSynth.mjs';

const OUT = 'public/sfx';

/** A sine sweep from `from` to `to` Hz over `tau`, enveloped - a thump's chest. */
function thump(len, from, to, tau, decayTau, attackMs = 1) {
  const out = buf(len);
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const f = to + (from - to) * decay(i, tau);
    phase += 2 * Math.PI * f / RATE;
    out[i] = Math.sin(phase) * attack(i, attackMs) * decay(i, decayTau);
  }
  return out;
}
/** Short bandpassed ticks at uneven times, each quieter than the last on average - splinters, debris. */
function ticks(out, rand, { count, from, to, lo, hi, tauLo, tauHi, gain }) {
  for (let k = 0; k < count; k++) {
    const at = from + (to - from) * Math.pow(rand(), 1.6);   // bunched to the front: most fly at once
    const f0 = lo + (hi - lo) * rand();
    const tau = tauLo + (tauHi - tauLo) * rand();
    const t = biquad(noise(seconds(tau * 8), rand), { type: 'bandpass', f0, q: 1.8 });
    envelope(t, (i) => attack(i, 0.2) * decay(i, tau));
    mix(out, t, at, gain * (0.45 + 0.55 * rand()) * (1 - 0.6 * (at - from) / Math.max(1e-6, to - from)));
  }
  return out;
}
/** A struck piece of iron: a hard edge over ringing partials, on a wooden knock. */
function clank(rand, { partials = [1870, 2950, 4100], taus = [0.09, 0.06, 0.035], wood = 200, len = 0.32 } = {}) {
  const out = buf(len);
  const edge = biquad(noise(seconds(0.05), rand), { type: 'bandpass', f0: 2600, q: 2.5 });
  envelope(edge, (i) => attack(i, 0.2) * decay(i, 0.005));
  mix(out, edge, 0, 1);
  partials.forEach((f, k) => {
    const ring = buf(len);
    const ph = rand() * Math.PI * 2;
    for (let i = 0; i < ring.length; i++) ring[i] = Math.sin(ph + 2 * Math.PI * f * i / RATE) * attack(i, 0.3) * decay(i, taus[k]);
    mix(out, ring, 0, 0.42 / (k + 1));
  });
  const knock = buf(len);
  for (let i = 0; i < knock.length; i++) knock[i] = Math.sin(2 * Math.PI * wood * i / RATE) * attack(i, 0.6) * decay(i, 0.028);
  mix(out, knock, 0, 0.6);
  return out;
}

// ---- the long gun, near ---------------------------------------------
function cannon() {
  const rand = rng(0xca77074);
  const out = buf(1.8);
  const crack = biquad(noise(seconds(0.06), rand), { type: 'bandpass', f0: 1800, q: 0.6 });
  envelope(crack, (i) => attack(i, 0.5) * decay(i, 0.012));
  mix(out, crack, 0, 1.0);
  const body = sweepLowpass(noise(seconds(0.7), rand), 2400, 180, 0.09);
  envelope(body, (i) => attack(i, 1.5) * decay(i, 0.14));
  mix(out, body, 0.002, 1.6);
  mix(out, thump(0.9, 75, 34, 0.08, 0.22), 0, 1.1);
  // the roll across the water, and its slap back off the sea and the hulls
  const roll = biquad(noise(seconds(1.5), rand), { type: 'lowpass', f0: 420, q: 0.7 });
  envelope(roll, (i) => attack(i, 20) * decay(i, 0.45));
  mix(out, roll, 0.03, 0.55);
  mix(out, roll, 0.21, 0.25);
  mix(out, roll, 0.52, 0.12);
  return softClip(out, 2.2);
}

// ---- a broadside across the bay -------------------------------------
function cannonFar() {
  const rand = rng(0xfa7ca77);
  const out = buf(2.2);
  mix(out, thump(1.1, 58, 32, 0.12, 0.3, 25), 0, 1.0);
  mix(out, thump(1.1, 52, 30, 0.12, 0.28, 25), 0.14, 0.7);   // the next gun of the broadside
  const rumble = biquad(noise(seconds(2.0), rand), { type: 'lowpass', f0: 260, q: 0.7 });
  envelope(rumble, (i) => attack(i, 40) * decay(i, 0.6));
  mix(out, rumble, 0.01, 0.9);
  mix(out, rumble, 0.35, 0.35);
  return softClip(biquad(out, { type: 'lowpass', f0: 500, q: 0.7 }), 1.6);
}

// ---- the swivel -----------------------------------------------------
function swivel() {
  const rand = rng(0x5717e1);
  const out = buf(0.75);
  const crack = biquad(noise(seconds(0.04), rand), { type: 'bandpass', f0: 2800, q: 0.8 });
  envelope(crack, (i) => attack(i, 0.3) * decay(i, 0.007));
  mix(out, crack, 0, 1.0);
  const body = sweepLowpass(noise(seconds(0.3), rand), 3200, 500, 0.04);
  envelope(body, (i) => attack(i, 1) * decay(i, 0.06));
  mix(out, body, 0.001, 1.3);
  mix(out, thump(0.3, 140, 70, 0.03, 0.05), 0, 0.7);
  const tail = biquad(noise(seconds(0.6), rand), { type: 'lowpass', f0: 700, q: 0.7 });
  envelope(tail, (i) => attack(i, 8) * decay(i, 0.18));
  mix(out, tail, 0.01, 0.3);
  mix(out, tail, 0.16, 0.12);
  return softClip(out, 1.9);
}

// ---- a ball into oak ------------------------------------------------
function hit() {
  const rand = rng(0x0a4b17);
  const out = buf(0.95);
  mix(out, thump(0.4, 95, 55, 0.03, 0.07), 0, 1.0);
  const crunch = biquad(noise(seconds(0.12), rand), { type: 'lowpass', f0: 600, q: 0.8 });
  envelope(crunch, (i) => attack(i, 0.5) * decay(i, 0.04));
  mix(out, crunch, 0, 0.9);
  ticks(out, rand, { count: 16, from: 0.004, to: 0.34, lo: 1400, hi: 3400, tauLo: 0.003, tauHi: 0.009, gain: 0.75 });
  // the timbers' groan: a low harmonic tone, wavering
  const groan = buf(0.6);
  let ph = 0;
  for (let i = 0; i < groan.length; i++) {
    const f = 150 + 18 * Math.sin(2 * Math.PI * 3.1 * i / RATE);
    ph += 2 * Math.PI * f / RATE;
    const tone = Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph);
    groan[i] = tone * attack(i, 30) * decay(i, 0.16);
  }
  mix(out, biquad(groan, { type: 'bandpass', f0: 420, q: 0.9 }), 0.11, 0.35);
  return softClip(out, 1.8);
}

// ---- a powder barrel ------------------------------------------------
function blast() {
  const rand = rng(0xb1a57);
  const out = buf(2.4);
  mix(out, thump(1.4, 60, 28, 0.1, 0.35), 0, 1.3);
  const body = sweepLowpass(noise(seconds(1.6), rand), 1800, 120, 0.18);
  envelope(body, (i) => attack(i, 2) * decay(i, 0.3));
  mix(out, body, 0.003, 1.8);
  ticks(out, rand, { count: 34, from: 0.1, to: 1.4, lo: 800, hi: 2600, tauLo: 0.004, tauHi: 0.012, gain: 0.35 });
  const roll = biquad(noise(seconds(2.2), rand), { type: 'lowpass', f0: 300, q: 0.7 });
  envelope(roll, (i) => attack(i, 30) * decay(i, 0.7));
  mix(out, roll, 0.02, 0.7);
  return softClip(out, 2.6);
}

// ---- the grapnels ---------------------------------------------------
function grapple() {
  const rand = rng(0x96a991e);
  const out = buf(1.3);
  // the rope through the air: a rising, falling whoosh
  const whoosh = sweepLowpass(noise(seconds(0.34), rand), 300, 1800, 0.12);
  envelope(whoosh, (i) => attack(i, 120) * decay(i, 0.06));
  mix(out, biquad(whoosh, { type: 'bandpass', f0: 900, q: 0.7 }), 0, 1.4);
  // two hooks bite the rail
  mix(out, clank(rand), 0.28, 1.0);
  mix(out, clank(rand, { partials: [2140, 3310, 4600], taus: [0.07, 0.05, 0.03], wood: 230 }), 0.37, 0.7);
  // the hawsers creak taut: a jittered pulse train through a woody band
  for (const [at, g] of [[0.5, 0.45], [0.72, 0.38], [0.95, 0.3]]) {
    const creak = buf(0.16);
    let next = 0;
    for (let i = 0; i < creak.length; i++) {
      if (i >= next) { creak[i] = 1; next = i + seconds((1 / 90) * (0.85 + 0.3 * rand())); }
    }
    envelope(creak, (i) => attack(i, 25) * decay(i, 0.07));
    mix(out, biquad(creak, { type: 'bandpass', f0: 700, q: 1.4 }), at, g * 8);
  }
  return softClip(out, 1.7);
}

// ---- write ----------------------------------------------------------
export const CLIPS = [
  ['naval-cannon', cannon, 0.95],
  ['naval-cannon-far', cannonFar, 0.82],
  ['naval-swivel', swivel, 0.88],
  ['naval-hit', hit, 0.9],
  ['naval-blast', blast, 0.95],
  ['naval-grapple', grapple, 0.85],
];

const rawDir = process.argv.find((a) => a.startsWith('--raw='))?.split('=')[1] ?? null;
mkdirSync(OUT, { recursive: true });
if (rawDir) mkdirSync(rawDir, { recursive: true });

for (const [name, make, peak] of CLIPS) {
  const mono = make();
  const pcm = bake(mono, RATE, { peak });
  writeFileSync(join(OUT, `${name}.wav`), writeWav8(pcm));
  if (rawDir) writeFileSync(join(rawDir, `${name}-44k.wav`), writeWav8(bakeRaw(mono), RATE));
  console.log(`${name}.wav  ${DF_RATE}Hz 8-bit mono  ${pcm.length} samples  ${(pcm.length / DF_RATE).toFixed(3)}s  ${(44 + pcm.length)} bytes`);
}

function bakeRaw(mono) {
  let max = 0;
  for (const v of mono) max = Math.max(max, Math.abs(v));
  const g = max > 0 ? 0.92 / max : 1;
  const out = new Uint8Array(mono.length);
  for (let i = 0; i < mono.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(Math.max(-1, Math.min(1, mono[i] * g)) * 127 + 128)));
  return out;
}
