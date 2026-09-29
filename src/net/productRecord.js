// @ts-check
// PROF3 (2026-09-28, Mac: "Lets keep moving") - A CRAFTED PIECE'S PRODUCT RECORD (bible/06-Systems/Professions-Arc.md
// 9.1, 24): what the account service made, signed with its identity key so any end can hold it to the service's word.
//
//     p1.<base64url({ p, s, h, r, q, m, c, i })>.<base64url(64-byte Ed25519 signature)>
//         p the provenance id (16 hex, the service's CSPRNG)   s the account (the identity token's sub)
//         h the character   r the recipe (net/recipeLaw.js)   q the quality (0 Crude .. 4 Masterwork; a kit's, arrows' -1)
//         m the maker's name (null for none)   c a seed (32 bits) - the piece's Loot Rarity rolls come off it
//         i issued, epoch seconds - a record is history, and carries no expiry
//
// ONE KEY, SEVERAL THINGS, NEVER CONFUSED: the identity key signs tokens (`v1`) and orders; this is `p1`, the version
// inside the signed bytes and read before a byte of the body is, and the claim shapes are disjoint besides - a record
// names `p`, `h`, `r` and `q`, and carries none of a token's `n`, `k` or `t`, an order's `o`, a gate receipt's `d` or
// `b` or a raid's `w` or `y` (refused here outright, whatever key signed them).
//
// UNSIGNED IS A REAL ANSWER, as a receipt's is: a service with no key still crafts - the record goes out `p1.<body>.` and
// the product row stands; only `verifyProductRecord` says one is the service's word.
//
// PURE; the account service mints, the client reads. Not a DFU member. Ledger A (the professions' row).
import { _b64url, SIG_BYTES, ID_RE } from './identityToken.js';
import { PROVENANCE_RE, MAKER_MAX, recipeById, MASTERWORK, takesQuality } from './recipeLaw.js';

/** The only version this file reads or writes. */
export const PRODUCT_RECORD_V = 'p1';
/** The bound on a record's length. */
export const PRODUCT_RECORD_MAX = 512;
/** A character id's shape (the account service's CHAR_ID_RE). */
const CHAR_RE = /^[A-Za-z0-9_-]{4,64}$/;

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Everything a well-formed record's claims must be; another signed shape's fields are refused outright. @param {any} c */
export function productRecordValid(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  for (const k of ['n', 'k', 't', 'o', 'd', 'b', 'w', 'y', 'e']) if (c[k] !== undefined) return false;
  if (typeof c.p !== 'string' || !PROVENANCE_RE.test(c.p)) return false;
  if (typeof c.s !== 'string' || !ID_RE.test(c.s)) return false;
  if (typeof c.h !== 'string' || !CHAR_RE.test(c.h)) return false;
  const r = recipeById(c.r);
  if (!r) return false;
  if (!Number.isInteger(c.q) || (!takesQuality(r) ? c.q !== -1 : c.q < 0 || c.q > MASTERWORK)) return false;   // PROF4: arrows take none, as a kit
  if (c.m !== null && (typeof c.m !== 'string' || !c.m.length || c.m.length > MAKER_MAX)) return false;
  if (!Number.isSafeInteger(c.c) || c.c < 0 || c.c > 0xffffffff) return false;
  if (!Number.isSafeInteger(c.i) || c.i < 0) return false;
  return true;
}

/**
 * MINT - the account service's half. With no key the record goes out unsigned (`p1.<body>.`).
 * @param {{p: string, s: string, h: string, r: string, q: number, m: string|null, c: number}} what
 * @param {CryptoKey|null} privateKey the service's Ed25519 identity key (server-account/src/signing.js), or null
 * @param {{subtle: SubtleCrypto, nowS: number}} env
 * @returns {Promise<string>}
 */
export async function mintProductRecord({ p, s, h, r, q, m, c }, privateKey, { subtle, nowS }) {
  const claims = { p, s, h, r, q, m, c, i: nowS };
  if (!productRecordValid(claims)) throw new TypeError('mintProductRecord refused a claim set it could not verify');
  const body = _b64url.encode(enc.encode(JSON.stringify(claims)));
  if (!privateKey) return `${PRODUCT_RECORD_V}.${body}.`;
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, privateKey, enc.encode(`${PRODUCT_RECORD_V}.${body}`)));
  return `${PRODUCT_RECORD_V}.${body}.${_b64url.encode(sig)}`;
}

/** READ - the claims of a record, signed or not, never a verdict on it; null for anything else. @param {unknown} rec */
export function readProductRecord(rec) {
  if (typeof rec !== 'string' || rec.length > PRODUCT_RECORD_MAX) return null;
  const parts = rec.split('.');
  if (parts.length !== 3 || parts[0] !== PRODUCT_RECORD_V) return null;
  const raw = _b64url.decode(parts[1]);
  if (!raw) return null;
  let c;
  try { c = JSON.parse(dec.decode(raw)); } catch { return null; }
  return productRecordValid(c) ? { ...c, signed: parts[2].length > 0 } : null;
}

/**
 * VERIFY - `{ ok: true, claims }` or `{ ok: false, why }`, never a throw: the version first, the signature before the
 * content, as every signed shape's verifier.
 * @param {unknown} rec
 * @param {CryptoKey} publicKey the service's identity public key
 * @param {{subtle: SubtleCrypto}} env
 * @returns {Promise<{ok: true, claims: any} | {ok: false, why: string}>}
 */
export async function verifyProductRecord(rec, publicKey, { subtle }) {
  if (typeof rec !== 'string' || rec.length > PRODUCT_RECORD_MAX) return { ok: false, why: 'shape' };
  const parts = rec.split('.');
  if (parts.length !== 3) return { ok: false, why: 'shape' };
  const [v, body, sig64] = parts;
  if (v !== PRODUCT_RECORD_V) return { ok: false, why: 'version' };
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
  if (!productRecordValid(claims)) return { ok: false, why: 'claims' };
  return { ok: true, claims };
}
