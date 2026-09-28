// AUDIT REALM2 S1/S2: A REALM CHARACTER FOR A PIN - one home (decorFakes.mjs's lesson: copies grow in lockstep, and a
// fake that lies makes a pin pass that production would fail).
//
// S1: the service reads a character's FIRST save (server-account/src/realm.js firstSaveRefusal) - a new character's
// is level 1 with a new character's purse, never any save a pin cares to start from. So a pin's character is made the
// way the realm makes one - created, its first save a fresh character's - and the record the pin counts from (what a
// character holds after play, which a later checkpoint would have written) is LAID OVER that first save's object, at
// the same sequence: every sequence a pin asserts stays the one it wrote.
//
// S2: claiming a house, placing a piece and founding a guild are a realm character's alone now - so the pins of those
// acts seat one (`seatRealm`), and name where its record stands (`at()`, read off the row at each call).
import assert from 'node:assert/strict';
import worker from '../server-account/src/index.js';

/** A first save the realm takes: a character as chargen makes one - level 1, the starting purse. */
export const freshSave = (extra = {}) => ({ level: 1, goldPieces: 100, items: [], ...extra });

/** R2's calls, over a Map (the realm pins' own face): `get` answers the body and a text reader. */
export function r2() {
  const m = new Map();
  return {
    _map: m,
    async put(key, body) { m.set(key, new Uint8Array(body instanceof ArrayBuffer ? body : new TextEncoder().encode(String(body)))); return { key }; },
    async get(key) {
      const v = m.get(key);
      return v === undefined ? null : { key, size: v.byteLength, body: v, async text() { return new TextDecoder().decode(v); } };
    },
    async delete(key) { m.delete(key); },
    async list({ prefix = '' } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }; },
  };
}

/** THE RECORD A PIN COUNTS FROM, laid over the character's current save at its sequence (the row's `obj`, and its
 *  `bytes`) - `save` an object, or the text itself. */
export function layRecord(env, id, save) {
  const row = env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(id);
  assert.ok(row?.obj, 'a record is laid over a save that landed');
  const text = typeof save === 'string' ? save : JSON.stringify(save);
  const bytes = new TextEncoder().encode(text);
  env.SAVES._map.set(row.obj, bytes);
  env.DB._raw.prepare('UPDATE realm_characters SET bytes = ? WHERE id = ?').run(bytes.byteLength, id);
}

/** Where a realm character's record stands now: `{ id, lease, seq }` off its row. */
export const realmAt = (env, id) => {
  const row = env.DB._raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(id);
  return { id, lease: row.lease, seq: row.seq };
};

/** THE CHARACTER TAKEN UP (a join): one account plays one character, so a pin that acts for two of an account's joins
 *  the one it acts for. Answers where its record stands, under the new lease. */
export async function realmJoinAt(env, secret, id) {
  const res = await worker.fetch(new Request('https://accounts.invalid/v1/realm/join', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` }, body: JSON.stringify({ id }),
  }), env);
  assert.equal(res.status, 200, 'joined');
  return realmAt(env, id);
}

/**
 * A REALM CHARACTER for the account whose session is `secret`, made through the service: created, its first save a fresh
 * one at 1, and `save` (when given) laid over it. Answers `{ id, lease, at }` - `at()` is where its record stands now.
 * @param {any} env @param {string} secret @param {string} name @param {any} [save]
 */
export async function seatRealm(env, secret, name, save = null) {
  const auth = { authorization: `Bearer ${secret}` };
  const made = await worker.fetch(new Request('https://accounts.invalid/v1/realm/create', {
    method: 'POST', headers: { 'content-type': 'application/json', ...auth }, body: JSON.stringify({ name }),
  }), env);
  assert.equal(made.status, 200, `${name} is made`);
  const { id, lease } = await made.json();
  const put = await worker.fetch(new Request(`https://accounts.invalid/v1/realm/${id}/data`, {
    method: 'PUT', headers: { ...auth, 'x-realm-lease': lease, 'x-realm-seq': '1' }, body: JSON.stringify(freshSave({ name })),
  }), env);
  assert.equal(put.status, 200, `${name}'s first save lands`);
  if (save) layRecord(env, id, save);
  return { id, lease, at: () => realmAt(env, id) };
}
