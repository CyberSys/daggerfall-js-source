// GUILD2 (2026-10-03) - THE GUILD PAGE'S OVERHAUL, ON THE SERVICE: a new name for a price (the guildmaster's, from the
// realm's gold in the treasury, through the name filter, a fortnight apart, never in a siege week) and the VAULT - a piece
// put in leaves the depositor's realm record in the vault's own batch, one taken out enters the taker's, each member's
// standing the guildmaster's grant or its rank's default, a withdrawer's day counted. Driven through the real Worker over
// the real migrations (test/accountDb.mjs, test/realmSeat.mjs). bible/11-Multiplayer/Guild-Overhaul.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { seatRealm, realmAt } from './realmSeat.mjs';
import { GUILD_RENAME_GOLD, GUILD_RENAME_COOLDOWN_S, guildRenameOpen } from '../src/net/guildLaw.js';
import { vaultStanding, vaultMayTake, vaultGrantOf, VAULT_RANK_DEFAULTS, guildVaultSlots, GUILD_VAULT_SLOTS } from '../src/net/guildVaultLaw.js';
import { seatWeekOf } from '../src/net/townSeatLaw.js';

const realNow = Date.now;
let _now = T0;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });

const sword = (extra = {}) => ({ templateIndex: 115, group: 'Weapons', name: 'Steel Longsword', material: 1, value: 300, currentCondition: 900, maxCondition: 1000, ...extra });
const arrows = (n) => ({ templateIndex: 131, group: 'Weapons', name: 'Arrow', value: 1, stackCount: n });

/** A service, and a guild founded by a realm character with gold enough, and a second realm character in it. */
async function stand() {
  const s = await standService({ MARKS_OPEN: 'on', DEVELOPER_HANDLES: 'Mac' });
  const raw = s.env.DB._raw;
  const gm = await s.registered('Aldric', { renown: 10 });
  gm.realm = await seatRealm(s.env, gm.secret, 'Aldric', { name: 'Aldric', level: 5, goldPieces: 20_000, items: [sword(), arrows(40)], bankAccounts: [{ accountGold: 0 }] });
  gm.character = gm.realm.id;
  raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(gm.id, gm.character, 'Aldric', 1_000_000, T0, T0);
  const found = await s.call('/v1/guilds/found', { character: gm.character, name: 'The Iron Oath', tag: 'IRON', realm: gm.realm.at(), region: 0 }, gm.secret);
  assert.equal(found.status, 200, JSON.stringify(found.body));
  const gid = found.body.guild.id;
  const member = await s.registered('Brenna');
  member.realm = await seatRealm(s.env, member.secret, 'Brenna', { name: 'Brenna', level: 3, goldPieces: 50, items: [sword({ name: 'Brenna\'s Blade' })], bankAccounts: [{ accountGold: 0 }] });
  member.character = member.realm.id;
  assert.equal((await s.call('/v1/guilds/invite', { character: gm.character, handle: 'Brenna' }, gm.secret)).status, 200);
  assert.equal((await s.call('/v1/guilds/answer', { character: member.character, guild: gid, accept: true }, member.secret)).status, 200);
  const realmGold = (n) => raw.prepare("UPDATE guilds SET treasury = ?, realm_gold = ?, moved_by = 'seed', moved_at = ? WHERE id = ?").run(n, n, _now, gid);
  const record = async (who) => {
    const row = raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(who.character);
    return JSON.parse(new TextDecoder().decode(s.env.SAVES._map.get(row.obj)));
  };
  const memberRow = (who) => raw.prepare('SELECT rowid AS rid FROM guild_members WHERE char_id = ?').get(who.character);
  return { ...s, raw, gm, member, gid, realmGold, record, memberRow };
}

// ─── THE LAWS ────────────────────────────────────────────────────────

test('GUILD2 law: a rename waits a fortnight; a member stands at its rank\'s default until the guildmaster grants otherwise; the guildmaster always takes out, unlimited', () => {
  assert.equal(guildRenameOpen(null, T0), true);
  assert.equal(guildRenameOpen(T0, T0 + GUILD_RENAME_COOLDOWN_S - 1), false);
  assert.equal(guildRenameOpen(T0, T0 + GUILD_RENAME_COOLDOWN_S), true);
  assert.deepEqual(VAULT_RANK_DEFAULTS[1], { level: 'withdraw', limit: 10 });
  assert.deepEqual(vaultStanding(2, null), { level: 'deposit', limit: 0, granted: false });
  assert.deepEqual(vaultStanding(2, { level: 'withdraw', limit: 3 }), { level: 'withdraw', limit: 3, granted: true });
  assert.deepEqual(vaultStanding(0, { level: 'none', limit: 0 }), { level: 'withdraw', limit: 0, granted: false }, 'nobody grants the guildmaster');
  assert.equal(vaultMayTake({ level: 'withdraw', limit: 3 }, 2), true);
  assert.equal(vaultMayTake({ level: 'withdraw', limit: 3 }, 3), false);
  assert.equal(vaultMayTake({ level: 'withdraw', limit: 0 }, 999), true, '0 is no limit');
  assert.equal(vaultMayTake({ level: 'deposit', limit: 0 }, 0), false);
  assert.deepEqual(vaultGrantOf({ level: 'deposit', limit: 9 }), { level: 'deposit', limit: 0 }, 'a depositor has no limit to keep');
  assert.equal(vaultGrantOf({ level: 'admin' }), null);
  assert.deepEqual(vaultGrantOf({ level: null }), { level: null, limit: 0 }, 'revoked: back to the rank\'s');
  assert.equal(guildVaultSlots(false), GUILD_VAULT_SLOTS);
  assert.equal(guildVaultSlots(true), 100);
});

// ─── GUILD2a: THE RENAME ─────────────────────────────────────────────

test('GUILD2 service: a rename is the guildmaster\'s, from the realm\'s gold in the treasury - the row, the ledger line, the history and the hall\'s name in one batch; the new tag rides the badge', async () => {
  const s = await stand();
  const body = { character: s.gm.character, name: 'The Ember Oath', tag: 'EMBR' };
  assert.deepEqual((await s.call('/v1/guilds/rename', { ...body, character: s.member.character }, s.member.secret)).body, { error: 'guild-rank' });
  assert.deepEqual((await s.call('/v1/guilds/rename', body, s.gm.secret)).body, { error: 'guild-rename-gold' }, 'an empty treasury pays nothing');
  // gold in the treasury that no realm record paid in buys no new name (HALL-GOLD's rule)
  s.raw.prepare("UPDATE guilds SET treasury = ?, realm_gold = 0, moved_by = 'seed', moved_at = ? WHERE id = ?").run(GUILD_RENAME_GOLD * 2, _now, s.gid);
  assert.deepEqual((await s.call('/v1/guilds/rename', body, s.gm.secret)).body, { error: 'guild-rename-gold' });
  s.realmGold(GUILD_RENAME_GOLD + 500);
  const r = await s.call('/v1/guilds/rename', body, s.gm.secret);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.guild.name, r.body.guild.tag, r.body.guild.treasury, r.body.cost], ['The Ember Oath', 'EMBR', 500, GUILD_RENAME_GOLD]);
  assert.equal(typeof r.body.order, 'string', 'the actor wears the new tag at once - its badge signed into an order for its rooms (GUILD1c)');
  assert.equal(r.body.guild.ledger[0].kind, 'rename');
  assert.equal(r.body.guild.renameAt, _now + GUILD_RENAME_COOLDOWN_S);
  const hist = s.raw.prepare('SELECT old_name, old_tag, new_name, new_tag, cost FROM guild_renames WHERE guild_id = ?').all(s.gid);
  assert.deepEqual(hist.map((h) => ({ ...h })), [{ old_name: 'The Iron Oath', old_tag: 'IRON', new_name: 'The Ember Oath', new_tag: 'EMBR', cost: GUILD_RENAME_GOLD }]);
  // a fortnight apart
  s.realmGold(GUILD_RENAME_GOLD * 2);
  assert.equal((await s.call('/v1/guilds/rename', { ...body, name: 'The Ash Oath' }, s.gm.secret)).body.error, 'guild-rename-soon');
  _now += GUILD_RENAME_COOLDOWN_S;
  assert.deepEqual((await s.call('/v1/guilds/rename', body, s.gm.secret)).body, { error: 'guild-rename-same' });
  const tagOnly = await s.call('/v1/guilds/rename', { character: s.gm.character, tag: 'ASH' }, s.gm.secret);
  assert.deepEqual([tagOnly.status, tagOnly.body.guild.name, tagOnly.body.guild.tag], [200, 'The Ember Oath', 'ASH'], 'a name left out keeps the one standing');
  _now = T0;
});

test('GUILD2 service: a new name passes the name filter (and now a founding\'s does too), is free of every other guild\'s, and waits out a week the guild fights for a seat', async () => {
  const s = await stand();
  s.realmGold(GUILD_RENAME_GOLD * 3);
  const rename = (b) => s.call('/v1/guilds/rename', { character: s.gm.character, ...b }, s.gm.secret);
  assert.deepEqual((await rename({ name: 'Server Admins' })).body, { error: 'guild-name-word' }, 'a reserved word inside a name, word by word');
  assert.deepEqual((await rename({ tag: 'MODS' })).body, { error: 'guild-name-word' });
  // another guild's name and tag are taken
  const other = await s.registered('Corin', { renown: 10 });
  other.realm = await seatRealm(s.env, other.secret, 'Corin', { name: 'Corin', level: 5, goldPieces: 20_000, items: [], bankAccounts: [{ accountGold: 0 }] });
  s.raw.prepare('INSERT OR REPLACE INTO renown_tracks (player, char_id, name, xp, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)').run(other.id, other.realm.id, 'Corin', 1_000_000, T0, T0);
  const theirs = await s.call('/v1/guilds/found', { character: other.realm.id, name: 'The Grey Hand', tag: 'GREY', realm: other.realm.at(), region: 0 }, other.secret);
  assert.equal(theirs.status, 200, JSON.stringify(theirs.body));
  assert.deepEqual((await rename({ name: 'the grey  hand' })).body, { error: 'guild-name-taken' });
  assert.deepEqual((await rename({ tag: 'grey' })).body, { error: 'guild-tag-taken' });
  // a founding through the filter, which it never passed before
  const filtered = await s.call('/v1/guilds/found', { character: s.member.character, name: 'Moderator Guild', tag: 'MODS', realm: realmAt(s.env, s.member.character), region: 0 }, s.member.secret);
  assert.equal(filtered.body.error, 'guild-name-word');
  // a seat battle this week
  s.raw.prepare("INSERT INTO town_seat_battles (week, key, kind, tier, attacker, defender, starts_at, ends_at, at) VALUES (?, 1, 'siege', 'palace', ?, ?, ?, ?, ?)")
    .run(seatWeekOf(_now * 1000), theirs.body.guild.id, s.gid, _now + 3600, _now + 7200, _now);
  assert.deepEqual((await rename({ name: 'The Ember Oath' })).body, { error: 'guild-rename-siege' });
});

// ─── GUILD2b: THE VAULT ──────────────────────────────────────────────

test('GUILD2 service: a piece put in leaves the depositor\'s realm record in the vault\'s own batch, one sequence on; taken out, it enters the taker\'s - never in both, never in neither', async () => {
  const s = await stand();
  const seq0 = s.gm.realm.at().seq;   // the founding paid on the record: one on already
  const put = await s.call('/v1/guilds/vault/put', { character: s.gm.character, realm: s.gm.realm.at(), pick: 0, item: sword() }, s.gm.secret);
  assert.equal(put.status, 200, JSON.stringify(put.body));
  assert.deepEqual([put.body.slot, put.body.item.name, put.body.realm.seq], [0, 'Steel Longsword', seq0 + 1]);
  let rec = await s.record(s.gm);
  assert.deepEqual(rec.items.map((i) => i.name), ['Arrow'], 'the sword left the record');
  // part of a stack
  const some = await s.call('/v1/guilds/vault/put', { character: s.gm.character, realm: s.gm.realm.at(), pick: 0, item: arrows(40), count: 15 }, s.gm.secret);
  assert.deepEqual([some.status, some.body.slot, some.body.item.stackCount], [200, 1, 15]);
  rec = await s.record(s.gm);
  assert.equal(rec.items[0].stackCount, 25);
  // the view: every slot, who put it there; the log
  const v = (await s.call('/v1/guilds/vault', { character: s.member.character }, s.member.secret)).body.vault;
  assert.deepEqual(v.items.map((i) => [i.slot, i.name, i.count, i.by]), [[0, 'Steel Longsword', 1, 'Aldric'], [1, 'Arrow', 15, 'Aldric']]);
  assert.deepEqual(v.log.map((l) => [l.kind, l.name, l.count]), [['put', 'Arrow', 15], ['put', 'Steel Longsword', 1]]);
  assert.deepEqual(v.me, { level: 'deposit', limit: 0, granted: false, taken: 0 }, 'a recruit puts in');
  // a recruit may not take out; granted, it may - its day counted
  const take = (who, b) => s.call('/v1/guilds/vault/take', { character: who.character, realm: who.realm.at(), ...b }, who.secret);
  assert.deepEqual((await take(s.member, { slot: 0 })).body, { error: 'guild-vault-rank' });
  const m = `m${s.memberRow(s.member).rid}`;
  assert.deepEqual((await s.call('/v1/guilds/vault/grant', { character: s.member.character, member: m, level: 'withdraw', limit: 1 }, s.member.secret)).body, { error: 'guild-rank' }, 'the leader\'s alone');
  const g = await s.call('/v1/guilds/vault/grant', { character: s.gm.character, member: m, level: 'withdraw', limit: 1 }, s.gm.secret);
  assert.deepEqual(g.body.vault, { level: 'withdraw', limit: 1, granted: true });
  const mseq = s.member.realm.at().seq;
  const got = await take(s.member, { slot: 1, count: 5 });
  assert.equal(got.status, 200, JSON.stringify(got.body));
  assert.deepEqual([got.body.item.stackCount, got.body.left, got.body.realm.seq], [5, 10, mseq + 1]);
  rec = await s.record(s.member);
  assert.deepEqual(rec.items.map((i) => [i.name, i.stackCount ?? 1]), [['Brenna\'s Blade', 1], ['Arrow', 5]]);
  assert.deepEqual((await take(s.member, { slot: 0 })).body, { error: 'guild-vault-limit' }, 'one a day, as granted');
  // revoked: back to the rank's - a recruit's put
  await s.call('/v1/guilds/vault/grant', { character: s.gm.character, member: m, level: null }, s.gm.secret);
  _now += 86_400;
  assert.deepEqual((await take(s.member, { slot: 0 })).body, { error: 'guild-vault-rank' });
  // the guildmaster takes the rest whole
  const all = await take(s.gm, { slot: 1 });
  assert.deepEqual([all.status, all.body.left], [200, 0]);
  assert.equal(s.raw.prepare('SELECT COUNT(*) AS n FROM guild_vault WHERE guild_id = ? AND slot = 1').get(s.gid).n, 0, 'the slot cleared');
  _now = T0;
});

test('GUILD2 service: what may not leave a pack never reaches the vault; a record that does not hold the offer moves nothing; a guild keeping pieces does not go', async () => {
  const s = await stand();
  const put = (b) => s.call('/v1/guilds/vault/put', { character: s.gm.character, realm: s.gm.realm.at(), ...b }, s.gm.secret);
  assert.deepEqual((await put({ pick: 0, item: sword({ name: 'Not My Sword' }) })).body, { error: 'vault-goods' }, 'the offer must be its record');
  assert.deepEqual((await put({ pick: 5, item: sword() })).body, { error: 'vault-goods' }, 'nothing at that place');
  assert.deepEqual((await put({ pick: 1, item: arrows(40), count: 41 })).body, { error: 'bad-vault-count' });
  // a worn piece, a quest's, a Materials Bag
  const s2 = await stand();
  const { layRecord } = await import('./realmSeat.mjs');
  layRecord(s2.env, s2.gm.character, { name: 'Aldric', level: 5, goldPieces: 0, items: [sword({ equipSlot: 'RightHand' }), { templateIndex: 600, group: 'UselessItems2', name: 'Materials Bag' }], bankAccounts: [] });
  const put2 = (b) => s2.call('/v1/guilds/vault/put', { character: s2.gm.character, realm: s2.gm.realm.at(), ...b }, s2.gm.secret);
  assert.deepEqual((await put2({ pick: 0, item: sword({ equipSlot: 'RightHand' }) })).body, { error: 'vault-goods' }, 'worn');
  assert.deepEqual((await put2({ pick: 1, item: { templateIndex: 600, group: 'UselessItems2', name: 'Materials Bag' } })).body, { error: 'vault-goods' }, 'BAG1: a bag stays with its owner');
  // the guild keeps its pieces: no disband, no lone guildmaster's leave, until they are taken out
  assert.equal((await put({ pick: 0, item: sword() })).status, 200);
  s.raw.prepare('DELETE FROM guild_members WHERE char_id = ?').run(s.member.character);
  assert.deepEqual((await s.call('/v1/guilds/disband', { character: s.gm.character }, s.gm.secret)).body, { error: 'guild-vault' });
  assert.deepEqual((await s.call('/v1/guilds/leave', { character: s.gm.character }, s.gm.secret)).body, { error: 'guild-vault' });
});

test('GUILD2 service: the guild\'s view carries the vault\'s shelves and every member\'s standing; a hall adds fifty', async () => {
  const s = await stand();
  const view = (await s.call('/v1/guilds/mine', { character: s.gm.character }, s.gm.secret)).body.guild;
  assert.deepEqual(view.vault, { used: 0, max: 50, me: { level: 'withdraw', limit: 0, granted: false, taken: 0 } });
  assert.deepEqual(view.members.map((m) => [m.name, m.vault.level]), [['Aldric', 'withdraw'], ['Brenna', 'deposit']]);
  assert.equal(view.renamedAt, null);
  s.raw.prepare("INSERT INTO homes (map_id, building_key, player, char_id, region, price, paid, bought_at, guild_id, owner_name) VALUES (1, 'b1', ?, ?, 0, 100, 100, 1, ?, 'x')").run(s.gm.id, s.gm.character, s.gid);
  const hall = (await s.call('/v1/guilds/mine', { character: s.gm.character }, s.gm.secret)).body.guild;
  assert.equal(hall.vault.max, 100);
});
