// @ts-check
// SEAT2a (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): THE SIEGE'S RECEIPT -
// the relay's fourth signature, the gate's, the raid's and the Watch's twin (net/gateReceipt.js, net/raidReceipt.js,
// net/watchReceipt.js). Design: bible/11-Multiplayer/Seats-Arc.md 6.8 ("Every fighter who stood half the siege or felled
// a foe earns a signed receipt (`s1.`, the gate's Ed25519 shape), claimed at the account service") and 17 ("its result
// and Honours are signed receipts the relay keeps").
//
//     s1.<base64url({ s, sk, sw, sd, r, a, h, i, e })>.<base64url(64-byte Ed25519 signature)>
//         s the account (the pass's own)   sk the seat's key   sw the seat week the battle was fought in
//         sd the side it fought on ('attack' | 'defend')
//         r the battle's result (SIEGE_RESULTS)   a 1 when the attackers raised a banner (6.8: "a siege nobody fought is
//         not a victory")   h 1 when this fighter earned Honours (stood half the battle or felled a foe)
//         i issued, epoch seconds   e expires (i + SIEGE_RECEIPT_TTL_S)
//
// ONE RECEIPT A FIGHTER, AND EVERY ONE CARRIES THE RESULT: FACT, the relay has no door to the account service, so the
// battle's result reaches it in whichever fighter's client carries its receipt first, and the same receipt is that
// fighter's Honours claim. The service applies the result once a battle (its week and key), and Honours once an account.
//
// ONE KEY, FOUR THINGS, NEVER CONFUSED: the version is inside the signed bytes (`s1` - the gate's `r1`, the raid's `w1`
// and the Watch's `k1` refuse it, and it them), and the claim shapes are disjoint besides: another shape's fields are
// refused here outright. UNSIGNED IS A REAL ANSWER, as the others': a relay with no key still referees - the receipt
// goes out `s1.<body>.` and the account service declines it. PURE, and all three ends import it.
//
// Not a DFU member. Ledger A (EVERY PALACE A SEAT's row).
import { _b64url, SIG_BYTES, SKEW_S, ID_RE } from './identityToken.js';

/** The only version this file reads or writes. */
export const SIEGE_RECEIPT_V = 's1';
/** How long a siege receipt may be carried to the account service: a week, as a gate's (its claim is its own week's
 *  anyway - the service settles the battle by the Turning after it). */
export const SIEGE_RECEIPT_TTL_S = 7 * 24 * 3600;
/** The bound on a receipt's length on the wire. */
export const SIEGE_RECEIPT_MAX = 400;
/** A battle's results (net/siegeRef.js battleStep): a side took it, a Tourney's dead heat, a forfeit (no attacker came),
 *  absent (nobody came). */
export const SIEGE_RESULTS = Object.freeze(['attack', 'defend', 'tie', 'forfeit', 'absent']);

const enc = new TextEncoder();
const dec = new TextDecoder();
const FOREIGN = ['n', 'k', 't', 'o', 'd', 'b', 'w', 'x', 'y', 'c'];

/**
 * Everything a well-formed siege receipt's claims must be, before any signature is considered.
 * @param {any} c
 */
export function siegeReceiptValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  if (FOREIGN.some((f) => c[f] !== undefined)) return false;
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (!Number.isSafeInteger(c.sk) || c.sk < 0 || c.sk > 0xffffffff || !Number.isSafeInteger(c.sw) || c.sw < 0) return false;
  if (c.sd !== 'attack' && c.sd !== 'defend') return false;
  if (!SIEGE_RESULTS.includes(c.r)) return false;
  if ((c.a !== 0 && c.a !== 1) || (c.h !== 0 && c.h !== 1)) return false;
  if (!Number.isSafeInteger(c.i) || !Number.isSafeInteger(c.e)) return false;
  if (c.e <= c.i || c.e - c.i > SIEGE_RECEIPT_TTL_S) return false;
  return true;
}

/**
 * MINT - the relay's half. With no key the receipt goes out unsigned (`s1.<body>.`).
 * @param {{s: string, sk: number, sw: number, sd: string, r: string, a: number, h: number}} what
 * @param {CryptoKey|null} privateKey an Ed25519 private key (net/gateReceipt.js importReceiptKey), or null for none
 * @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintSiegeReceipt({ s, sk, sw, sd, r, a, h }, privateKey, { subtle, nowS }) {
  if (!Number.isSafeInteger(nowS)) throw new TypeError('mintSiegeReceipt needs an integer epoch-seconds clock');
  const claims = { s, sk, sw, sd, r, a, h, i: nowS, e: nowS + SIEGE_RECEIPT_TTL_S };
  if (!siegeReceiptValid(claims)) throw new TypeError('mintSiegeReceipt refused a claim set it could not verify');
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${SIEGE_RECEIPT_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${SIEGE_RECEIPT_V}.${body}`)));
  return `${SIEGE_RECEIPT_V}.${body}.${_b64url.encode(sig)}`;
}

/**
 * READ - the client's half: the claims of a receipt the relay handed this socket, signed or not, never a verdict on it.
 * Null for anything that is not a well-formed siege receipt.
 * @param {unknown} r
 */
export function readSiegeReceipt(r) {
  if (typeof r !== 'string' || r.length > SIEGE_RECEIPT_MAX) return null;
  const parts = r.split('.');
  if (parts.length !== 3 || parts[0] !== SIEGE_RECEIPT_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return siegeReceiptValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY - the account service's half. `{ ok: true, claims }` or `{ ok: false, why }`, never a throw and never a repair:
 * the gate's verifier, rung for rung (the version first, the signature before the content).
 * @param {unknown} r
 * @param {CryptoKey} publicKey the relay's Ed25519 public half
 * @param {{subtle: SubtleCrypto, nowS: number, skewS?: number}} env
 * @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>}
 */
export async function verifySiegeReceipt(r, publicKey, { subtle, nowS, skewS = SKEW_S }) {
  if (typeof r !== 'string' || r.length > SIEGE_RECEIPT_MAX) return { ok: false, why: 'shape' };
  const parts = r.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== SIEGE_RECEIPT_V) return { ok: false, why: 'version' };
  if (!sig64) return { ok: false, why: 'unsigned' };
  const sig = _b64url.decode(sig64);
  if (!sig || sig.length !== SIG_BYTES) return { ok: false, why: 'sig-shape' };
  const raw = _b64url.decode(body);
  if (!raw) return { ok: false, why: 'body-shape' };
  let good = false;
  try { good = await subtle.verify({ name: 'Ed25519' }, publicKey, sig, enc.encode(`${v}.${body}`)); } catch { return { ok: false, why: 'verify-threw' }; }
  if (!good) return { ok: false, why: 'signature' };
  let claims;
  try { claims = JSON.parse(dec.decode(raw)); } catch { return { ok: false, why: 'json' }; }
  if (!siegeReceiptValid(claims)) return { ok: false, why: 'claims' };
  if (!Number.isSafeInteger(nowS)) return { ok: false, why: 'clock' };
  if (nowS >= claims.e) return { ok: false, why: 'expired' };
  if (claims.i > nowS + skewS) return { ok: false, why: 'future' };
  return { ok: true, claims };
}
