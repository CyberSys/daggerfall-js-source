// THE SYNTH KIT - the DSP the port's synthesised sounds are built from, shared (NAV-E, 2026-09-28: the naval arc's
// guns joined the gun lab's). Moved out of tools/gunSfx.mjs unchanged, so its three clips come out byte for byte as
// they did; tools/navalSfx.mjs builds the sea fight's six from the same pieces. Everything here synthesises at RATE
// and is baked down to DAGGER.SND's own 11025 Hz 8-bit mono by tools/sndify.mjs.

/** Synthesise high, bake down - the bake owns the aliasing. */
export const RATE = 44100;

/** mulberry32 - a seeded PRNG, so a re-run is byte-identical. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const seconds = (s) => Math.round(s * RATE);
export const buf = (s) => new Float32Array(seconds(s));

/** Exponential decay, the shape every percussive envelope wants. */
export const decay = (i, tau) => Math.exp(-i / (tau * RATE));
/** A short attack so a transient does not start on a vertical edge -
 *  a step is a click, and a click survives the bake louder than the
 *  sound it belongs to. */
export const attack = (i, ms) => Math.min(1, i / Math.max(1, seconds(ms / 1000)));

/** RBJ biquad, the two shapes used here. */
export function biquad(x, { type, f0, q }) {
  const w = 2 * Math.PI * f0 / RATE, cw = Math.cos(w), sw = Math.sin(w);
  const alpha = sw / (2 * q);
  let b0, b1, b2;
  const a0 = 1 + alpha, a1 = -2 * cw, a2 = 1 - alpha;
  if (type === 'bandpass') { b0 = alpha; b1 = 0; b2 = -alpha; }
  else { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }   // lowpass
  const out = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const y = (b0 / a0) * x[i] + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** A one-pole lowpass whose cutoff MOVES - the sound of a pressure
 *  wave losing its top as it leaves the barrel. A fixed filter gives a
 *  flat "pff"; the sweep is what makes it a gunshot. */
export function sweepLowpass(x, fromHz, toHz, tau) {
  const out = new Float32Array(x.length);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    const f = toHz + (fromHz - toHz) * decay(i, tau);
    const a = Math.exp(-2 * Math.PI * f / RATE);
    y = (1 - a) * x[i] + a * y;
    out[i] = y;
  }
  return out;
}

export const noise = (len, rand) => {
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = rand() * 2 - 1;
  return out;
};

/** dst += src * gain, starting at `at` seconds. */
export function mix(dst, src, at = 0, gain = 1) {
  const o = seconds(at);
  for (let i = 0; i < src.length; i++) {
    const j = o + i;
    if (j >= 0 && j < dst.length) dst[j] += src[i] * gain;
  }
  return dst;
}

/** tanh saturation: the grit a loud sound has, and a limiter that
 *  cannot overshoot into the 8-bit rail. */
export const softClip = (x, drive = 1) => x.map((v) => Math.tanh(v * drive) / Math.tanh(drive));

export const envelope = (x, fn) => { for (let i = 0; i < x.length; i++) x[i] *= fn(i); return x; };
