// AUDIT-SEATS II (2026-10-01, Mac: "Lets do a comprehensive audit on everything. I just want perfection"): THE SERVICE'S
// FINDINGS FIXED - each pinned through the real Worker over node:sqlite with every migration applied (test/accountDb.mjs),
// each finding's id in its test's name (bible/06-Systems/Online-Arc.md AUDIT-SEATS II).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standService, T0 } from './accountDb.mjs';
import { seatReportText, seatWeekOf, seatWeekStartMs, SEAT_MEMBER_WAIT_S } from '../src/net/townSeatLaw.js';
import { mintSiegeReceipt, mintRoyalReceipt } from '../src/net/siegeReceipt.js';
import { siegeClaimSettles, royalClaimSettles } from '../src/net/siegeClaims.js';

const { subtle } = globalThis.crypto;
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const WAYREST = { key: 5023, name: 'Wayrest', region: 23, tier: 'crown', pixel: [590, 166] };
const DAY = 86400;
const W = seatWeekOf(T0 * 1000);
const turning = (w) => Math.floor(seatWeekStartMs(w + 1) / 1000);
let _rid = 0;
const rid = () => `as2s-${String(++_rid).padStart(6, '0')}`;

async function stood(t, extra = {}) {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const svc = await standService({ SEATS_OPEN: 'on', MARKS_OPEN: 'on', PROFESSIONS_OPEN: 'on', BOARD_OPEN: 'on', ...extra });
  const raw = svc.env.DB._raw;
  const witnesses = [await svc.guest(), await svc.guest(), await svc.guest()];
  for (const seat of [ANTICLERE, WAYREST]) for (const w of witnesses) raw.prepare("INSERT INTO world_witness (kind, key, account, report, region, at) VALUES ('seat', ?, ?, ?, ?, ?)").run(String(seat.key), w.id, seatReportText(seat), seat.region, T0 - DAY);
  raw.prepare('INSERT INTO town_seat_weeks (week, settled_at) VALUES (?, ?)').run(W - 1, T0);
  const guild = async (handle, name, tag) => {
    const gm = await svc.registered(handle, { renown: 12 });
    assert.equal((await svc.found(gm, { name, tag })).status, 200);
    const gid = raw.prepare('SELECT guild_id FROM guild_members WHERE player = ? AND char_id = ?').get(gm.id, gm.character).guild_id;
    raw.prepare('UPDATE guild_members SET joined_at = ? WHERE guild_id = ?').run(T0 - SEAT_MEMBER_WAIT_S - DAY, gid);
    return { gm, gid };
  };
  const call = async (path, body, who) => svc.call(path, body, who.secret);
  return { svc, raw, witnesses, guild, call, at: (s) => { now = s; }, now: () => now };
}

test('AUDIT-SEATS II S2: A RECEIPT REFUSAL KEEPS ITS WHY - the seats\' claims answer a mendable refusal\'s rung (a receipt from a clock ahead: `future`), as the gate\'s claim does, so the carrier keeps the receipt to offer again; a refusal for good still lets it go (mutants: the why dropped)', async (t) => {
  const s = await stood(t);
  const sh = await s.guild('Gamal', 'The Silver Hand', 'SH');
  // a relay whose clock runs an hour ahead of the service's: the service can mend that by waiting - the carrier must keep it
  const ahead = await mintSiegeReceipt({ s: sh.gm.id, sk: ANTICLERE.key, sw: W, sd: 'defend', r: 'defend', a: 1, h: 1, th: 0 }, s.svc.gateKey, { subtle, nowS: T0 + 3600 });
  const r = await s.call('/v1/seats/siege/claim', { receipt: ahead, character: sh.gm.character }, sh.gm);
  assert.deepEqual([r.status, r.body], [400, { error: 'receipt', why: 'future' }]);
  assert.equal(siegeClaimSettles({ ok: false, ...r.body }), false, 'the carrier keeps it');
  const royal = await mintRoyalReceipt({ s: sh.gm.id, l: 'x'.repeat(8), sk: WAYREST.key, sw: W, n: 1 }, s.svc.gateKey, { subtle, nowS: T0 + 3600 });
  const q = await s.call('/v1/seats/royal/claim', { receipt: royal }, sh.gm);
  assert.deepEqual([q.status, q.body], [400, { error: 'receipt', why: 'future' }]);
  assert.equal(royalClaimSettles({ ok: false, ...q.body }), false, 'the bouts\' carrier keeps it');
  // a refusal for good (not a receipt at all) settles - the carrier lets go
  const bad = await s.call('/v1/seats/siege/claim', { receipt: 'nonsense', character: sh.gm.character }, sh.gm);
  assert.equal(bad.status, 400);
  assert.equal(siegeClaimSettles({ ok: false, ...bad.body }), true);
});
