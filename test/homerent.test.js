// HOME-RENT (2026-09-30, asked: "For houses with multiple rooms, the owner can choose to rent out to other players and
// adjust the price as needed"). A ROOM OF A HOME, RENTED TO ANOTHER PLAYER. The law both ends read (net/homeLaw.js
// RENT_*); the service through the real Worker over node:sqlite with every migration applied (server-account/src/
// rent.js): the owner offers and prices, another player's realm character rents on its record, the rent is held on the
// home and collected by the owner, a sale and a delete wait for the tenants; the client's half (systems/homeRent.js,
// systems/onlineHomes.js): the registry's tenancies and vacancies, the door's rows, a rent paid and given back, the
// rent collected by the service's count; the owner's rooms view in the decorator; the host's wiring by source.
// `06-Systems/Online-Arc.md` HOME-RENT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RENT_ROOMS_MAX, RENT_PRICE_MAX, RENT_DAY_S, RENT_DAYS, RENT_DAYS_MAX, RENT_HELD_MAX,
  rentRoomOk, rentPriceOk, rentDaysOk, rentAnchorOf, rentCost, rentUntil, rentDaysLeft, homeMayEnter,
} from '../src/net/homeLaw.js';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { createOnlineHomes, homeDoorAnswer, homeVisitorRows, HOME_VERB } from '../src/systems/onlineHomes.js';
import {
  homeRooms, rentable, rentHomeRoom, collectHomeRent, rentRoomsView, rentRowSub, rentPriceStep, rentAnchorOfRoom, RENT_PRICE_FIRST,
  rentRowLabel, rentTenantLabel, rentConfirmLines,
} from '../src/systems/homeRent.js';
import { REFUSALS } from '../src/net/accountClient.js';
import { ROUTES } from '../server-account/src/service.js';
import { toolRig, settle, all } from './decorFakes.mjs';
import { Collider } from '../src/player/collider.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const recordOf = (env, id) => {
  const row = env.DB._raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(id);
  return JSON.parse(new TextDecoder().decode(env.SAVES._map.get(row.obj)));
};

test('HOME-RENT the law: a room a number of at most eight, a price a day within bounds, days within thirty, a point within the decor law\'s bound; a rent\'s cost the days\' price; a tenancy renewed from its end and never more than thirty days ahead; the days left rounded up; a tenant walks in whoever else may (mutants: the renewal from now; the cap; the days rounded down; the tenant shut out)', () => {
  assert.deepEqual([RENT_ROOMS_MAX, RENT_PRICE_MAX, RENT_DAY_S, [...RENT_DAYS], RENT_DAYS_MAX, RENT_HELD_MAX], [8, 10_000, 86_400, [1, 3, 7, 14, 30], 30, 3]);
  assert.deepEqual([rentRoomOk(0), rentRoomOk(1), rentRoomOk(8), rentRoomOk(9), rentRoomOk(1.5)], [false, true, true, false, false]);
  assert.deepEqual([rentPriceOk(0), rentPriceOk(1), rentPriceOk(10_000), rentPriceOk(10_001)], [false, true, true, false]);
  assert.deepEqual([rentDaysOk(0), rentDaysOk(30), rentDaysOk(31)], [false, true, false]);
  assert.deepEqual(rentAnchorOf([1.234, 0.5, -2.349]), [1.23, 0.5, -2.35]);
  assert.equal(rentAnchorOf([1, 2]), null);
  assert.equal(rentAnchorOf([257, 0, 0]), null);
  assert.equal(rentCost(40, 3), 120);
  assert.equal(rentCost(40, 31), 0, 'days the law refuses cost nothing - and are not rented');
  const now = T0;
  assert.equal(rentUntil(now, 0, 3), now + 3 * RENT_DAY_S, 'from now');
  assert.equal(rentUntil(now, now + 2 * RENT_DAY_S, 3), now + 5 * RENT_DAY_S, 'renewed from its end');
  assert.equal(rentUntil(now, now - 5, 1), now + RENT_DAY_S, 'an ended one from now');
  assert.equal(rentUntil(now, now + 28 * RENT_DAY_S, 3), null, 'never more than thirty days ahead');
  assert.equal(rentUntil(now, now + 27 * RENT_DAY_S, 3), now + 30 * RENT_DAY_S);
  assert.equal(rentDaysLeft(now + RENT_DAY_S + 1, now), 2, 'rounded up');
  assert.equal(rentDaysLeft(now, now), 0);
  const home = { owner: 'Olga', entry: 'private', mine: false };
  assert.equal(homeMayEnter(home), false);
  assert.equal(homeMayEnter({ ...home, tenant: now + 10 }), true, 'a tenant walks in');
});

test('HOME-RENT the service: the owner offers a room and prices it; anyone reads the rooms (the tenant\'s name to the owner alone); another player\'s realm character rents it on its record in one write - the rent held on the home, the room taken, the town answer opening the door to that character; a stale price, a taken room, one\'s own home and a tenancy past thirty days are refused; a tenancy is renewed from its end (mutants: the record unpaid; the hold unmoved; the price unchecked; the owner renting; the name to everyone; the held rooms uncounted)', async (t) => {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const svc = await standService();
  const home = { mapId: 7, buildingKey: 300, region: 17, price: 5000 };
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, home);
  assert.equal(o.status, 200, 'the owner\'s home');
  const offer = (body, who = owner) => svc.call('/v1/homes/rooms/offer', { mapId: 7, buildingKey: 300, character: o.character, ...body }, who.secret);
  assert.equal((await offer({ room: 1, anchor: [1.5, 0.4, 2], price: 40 })).status, 200);
  assert.equal((await offer({ room: 2, anchor: [8, 0.4, 2], price: 60 })).status, 200);
  assert.equal((await offer({ room: 9, anchor: [8, 0.4, 2], price: 60 })).body.error, 'bad-room');
  // somebody else offering the owner's rooms: no home of theirs
  const tenant = await svc.registered('Tomas');
  const T = await seatRealm(svc.env, tenant.secret, 'Tomas', { name: 'Tomas', level: 5, goldPieces: 1000, items: [] });
  assert.equal((await svc.call('/v1/homes/rooms/offer', { mapId: 7, buildingKey: 300, character: T.id, room: 3, anchor: [0, 0, 0], price: 5 }, tenant.secret)).body.error, 'no-home');
  // a guest reads them - taken or free, never who rents
  const g = await svc.guest();
  const seen = await svc.call('/v1/homes/rooms', { mapId: 7, buildingKey: 300 }, g.secret);
  assert.equal(seen.status, 200);
  assert.deepEqual(seen.body.rooms.map((r) => [r.room, r.price, r.listed, r.taken]), [[1, 40, true, false], [2, 60, true, false]]);
  assert.equal(seen.body.due, undefined, 'the rent held is the owner\'s to see');
  let town = await svc.call('/v1/homes/town', { mapId: 7, character: T.id }, tenant.secret);
  assert.deepEqual(town.body.homes[0].rent, { vacant: 2, from: 40 }, 'the door says rooms are free, from the cheapest');
  assert.equal(town.body.homes[0].tenant, undefined);
  // renting: the record pays, the room is taken, the rent is held
  const rent = (body, who = tenant, at = T) => svc.call('/v1/homes/rooms/rent', { mapId: 7, buildingKey: 300, character: at.id, realm: at.at(), ...body }, who.secret);
  const r1 = await rent({ room: 1, days: 3, price: 40 });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.equal(r1.body.cost, 120);
  assert.equal(r1.body.until, T0 + 3 * RENT_DAY_S);
  assert.equal(recordOf(svc.env, T.id).goldPieces, 880, 'paid on the record');
  assert.equal(svc.env.DB._raw.prepare('SELECT rent_due FROM homes WHERE map_id = 7 AND building_key = 300').get().rent_due, 120, 'held on the home');
  town = await svc.call('/v1/homes/town', { mapId: 7, character: T.id }, tenant.secret);
  assert.equal(town.body.homes[0].tenant, T0 + 3 * RENT_DAY_S, 'the door opens for the tenant');
  assert.deepEqual(town.body.homes[0].rent, { vacant: 1, from: 60 });
  const byOwner = await svc.call('/v1/homes/rooms', { mapId: 7, buildingKey: 300 }, owner.secret);
  assert.equal(byOwner.body.rooms[0].tenant, 'Tomas', 'the owner sees who');
  assert.equal(byOwner.body.due, 120);
  const byTenant = await svc.call('/v1/homes/rooms', { mapId: 7, buildingKey: 300 }, tenant.secret);
  assert.equal(byTenant.body.rooms[0].yours, true);
  assert.equal(byTenant.body.rooms[0].tenant, undefined, 'a tenant is not told names');
  // refusals
  const third = await svc.registered('Vera');
  const V = await seatRealm(svc.env, third.secret, 'Vera', { name: 'Vera', level: 5, goldPieces: 1000, items: [] });
  assert.equal((await rent({ room: 1, days: 1, price: 40 }, third, V)).body.error, 'rent-taken');
  assert.equal((await offer({ room: 2, anchor: [8, 0.4, 2], price: 70 })).status, 200, 'the owner changes the price');
  const stale = await rent({ room: 2, days: 1, price: 60 }, third, V);
  assert.deepEqual([stale.status, stale.body.error], [409, 'rent-price']);
  assert.equal(recordOf(svc.env, V.id).goldPieces, 1000, 'nothing paid');
  const alt = await seatRealm(svc.env, owner.secret, 'Olga Two', { name: 'Olga Two', level: 5, goldPieces: 1000, items: [] });
  assert.equal((await rent({ room: 2, days: 1, price: 70 }, owner, alt)).body.error, 'rent-own', 'never from one\'s own account');
  assert.equal((await rent({ room: 1, days: 28, price: 40 })).body.error, 'rent-long', 'three days held and twenty-eight more: past thirty');
  // renewed from its end
  const r2 = await rent({ room: 1, days: 3, price: 40 });
  assert.equal(r2.body.until, T0 + 6 * RENT_DAY_S);
  assert.equal(recordOf(svc.env, T.id).goldPieces, 760);
  assert.equal(svc.env.DB._raw.prepare('SELECT rent_due FROM homes WHERE map_id = 7 AND building_key = 300').get().rent_due, 240);
  // RENT_HELD_MAX rooms a character: a fourth refused, unpaid - its own renewed all the same
  assert.equal(RENT_HELD_MAX, 3);
  for (const room of [3, 4]) assert.equal((await offer({ room, anchor: [room, 0.4, 5], price: 10 })).status, 200);
  assert.equal((await rent({ room: 2, days: 1, price: 70 })).status, 200);
  assert.equal((await rent({ room: 3, days: 1, price: 10 })).status, 200);
  assert.equal(recordOf(svc.env, T.id).goldPieces, 680);
  const fourth = await rent({ room: 4, days: 1, price: 10 });
  assert.deepEqual([fourth.status, fourth.body.error], [409, 'rent-held']);
  assert.equal(recordOf(svc.env, T.id).goldPieces, 680, 'nothing paid');
  assert.equal((await rent({ room: 1, days: 1, price: 40 })).status, 200, 'a renewal is no fourth room');
  assert.ok(ROUTES.has('/v1/homes/rooms/rent') && ROUTES.has('/v1/homes/rooms/collect'), 'the routes are known');
});

test('HOME-RENT the owner: a room taken off the offer keeps its tenant until the days run out, a free one goes; the house is not sold nor the character deleted while a tenancy runs or rent is held; the rent collected into the owner\'s record, all of it, once; the days run out, the house sells (mutants: the withdraw deleting a tenancy; the sale unguarded; the collection twice; the delete unguarded)', async (t) => {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const at = () => svc.env.DB._raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(o.character);
  const ownerAt = () => ({ id: o.character, ...at() });
  const call = (path, body, who = owner) => svc.call(path, { mapId: 7, buildingKey: 300, ...body }, who.secret);
  await call('/v1/homes/rooms/offer', { character: o.character, room: 1, anchor: [1, 0, 1], price: 40 });
  await call('/v1/homes/rooms/offer', { character: o.character, room: 2, anchor: [5, 0, 1], price: 40 });
  const tenant = await svc.registered('Tomas');
  const T = await seatRealm(svc.env, tenant.secret, 'Tomas', { name: 'Tomas', level: 5, goldPieces: 1000, items: [] });
  assert.equal((await call('/v1/homes/rooms/rent', { character: T.id, room: 1, days: 2, price: 40, realm: T.at() }, tenant)).status, 200);
  const w1 = await call('/v1/homes/rooms/withdraw', { character: o.character, room: 1 });
  assert.deepEqual([w1.body.gone, w1.body.until], [false, T0 + 2 * RENT_DAY_S], 'rented: kept until its days run out');
  const w2 = await call('/v1/homes/rooms/withdraw', { character: o.character, room: 2 });
  assert.equal(w2.body.gone, true, 'free: gone');
  const rooms = (await call('/v1/homes/rooms', {})).body.rooms;
  assert.deepEqual(rooms.map((r) => [r.room, r.listed, r.taken]), [[1, false, true]]);
  // the sale and the delete wait
  const sale = await call('/v1/homes/release', { realm: ownerAt() });
  assert.deepEqual([sale.status, sale.body.error], [409, 'home-tenants']);
  const del = await svc.call('/v1/realm/delete', { id: o.character }, owner.secret);
  assert.deepEqual([del.status, del.body.error], [409, 'home-tenants']);
  // collected, once
  const before = recordOf(svc.env, o.character).goldPieces;
  const c1 = await call('/v1/homes/rooms/collect', { character: o.character, realm: ownerAt() });
  assert.equal(c1.status, 200, JSON.stringify(c1.body));
  assert.equal(c1.body.gold, 80);
  assert.equal(recordOf(svc.env, o.character).goldPieces, before + 80, 'into the owner\'s record');
  const c2 = await call('/v1/homes/rooms/collect', { character: o.character, realm: ownerAt() });
  assert.deepEqual([c2.status, c2.body.error], [409, 'rent-none']);
  // the days run out: the door shuts to the tenant, the house sells, and the room with it
  clock = (T0 + 2 * RENT_DAY_S + 1) * 1000;
  const town = await svc.call('/v1/homes/town', { mapId: 7, character: T.id }, tenant.secret);
  assert.equal(town.body.homes[0].tenant, undefined, 'the tenancy ran out');
  const sold = await call('/v1/homes/release', { realm: ownerAt() });
  assert.equal(sold.status, 200, JSON.stringify(sold.body));
  assert.equal(svc.env.DB._raw.prepare('SELECT COUNT(*) AS n FROM home_rooms').get().n, 0, 'the rooms go with the home');
});

test('HOME-RENT held rent comes with a sale, and a delete waits for it: rent nobody collected is paid with the house, and a character is not deleted while its home holds some (mutants: the rent lost at the sale; the delete unguarded)', async (t) => {
  let clock = T0 * 1000;
  t.mock.method(Date, 'now', () => clock);
  const svc = await standService();
  const owner = await svc.registered('Olga');
  const o = await svc.seatHome(owner, { mapId: 7, buildingKey: 300, region: 17, price: 5000 });
  const ownerAt = () => ({ id: o.character, ...svc.env.DB._raw.prepare('SELECT lease, seq FROM realm_characters WHERE id = ?').get(o.character) });
  await svc.call('/v1/homes/rooms/offer', { mapId: 7, buildingKey: 300, character: o.character, room: 1, anchor: [1, 0, 1], price: 40 }, owner.secret);
  const tenant = await svc.registered('Tomas');
  const T = await seatRealm(svc.env, tenant.secret, 'Tomas', { name: 'Tomas', level: 5, goldPieces: 1000, items: [] });
  await svc.call('/v1/homes/rooms/rent', { mapId: 7, buildingKey: 300, character: T.id, room: 1, days: 1, price: 40, realm: T.at() }, tenant.secret);
  clock = (T0 + RENT_DAY_S + 5) * 1000;
  const del = await svc.call('/v1/realm/delete', { id: o.character }, owner.secret);
  assert.deepEqual([del.status, del.body.error], [409, 'home-rent-due'], 'collect it first');
  // what the record holds, purse and every bank account (the sale pays into the home's region's account, if it keeps one)
  const wealth = () => { const r = recordOf(svc.env, o.character); return (r.goldPieces ?? 0) + (r.bankAccounts ?? []).reduce((n, a) => n + (a?.accountGold ?? 0), 0); };
  const before = wealth();
  const sold = await svc.call('/v1/homes/release', { mapId: 7, buildingKey: 300, realm: ownerAt() }, owner.secret);
  assert.equal(sold.status, 200);
  assert.equal(sold.body.rent, 40, 'the held rent comes with the sale');
  assert.equal(wealth(), before + sold.body.refund + sold.body.decorBack + 40, 'and is paid into the record with the house');
});

test('HOME-RENT the client\'s registry and door: the town is asked for the playing character, a row keeps its rooms free and its tenancy, a tenant\'s door opens, and the door\'s rows say "Go in" where it opens, "Rent a room" from the cheapest, and a tenant\'s own room to renew (mutants: the character unsent; the tenancy dropped; the rent row where none is free)', async () => {
  const asked = [];
  const api = {
    town: async (mapId, character) => {
      asked.push([mapId, character]);
      return { ok: true, data: { homes: [
        { buildingKey: 1, owner: 'Olga', entry: 'private', mine: false, rent: { vacant: 2, from: 40 } },
        { buildingKey: 2, owner: 'Olga', entry: 'private', mine: false, tenant: T0 + 100 },
        { buildingKey: 3, owner: 'Olga', entry: 'public', mine: false, rent: { vacant: 0, from: 40 } },
        { buildingKey: 4, owner: 'Olga', entry: 'public', mine: false, rent: { vacant: 1, from: 25 } },
      ] } };
    },
  };
  const homes = createOnlineHomes({ api, character: () => 'r0123456789abcdef0123' });
  await homes.ensure(7);
  assert.deepEqual(asked, [[7, 'r0123456789abcdef0123']], 'the playing character rides the ask');
  const [a, b, c, d] = [1, 2, 3, 4].map((k) => homes.homeAt(7, k));
  assert.deepEqual(a.rent, { vacant: 2, from: 40 });
  assert.equal(b.tenant, T0 + 100);
  assert.equal(c.rent, null, 'none free: no rent');
  assert.equal(homeDoorAnswer(a), 'locked');
  assert.equal(homeDoorAnswer(b), 'enter', 'the tenant walks in');
  assert.deepEqual(homeVisitorRows(a, 'locked', T0), [{ id: HOME_VERB.rent, label: rentRowLabel(40) }], 'shut, but a room to rent');
  assert.deepEqual(homeVisitorRows(d, 'enter', T0).map((r) => r.id), [HOME_VERB.enter, HOME_VERB.rent], 'open, and a room to rent');
  assert.deepEqual(homeVisitorRows(b, 'enter', T0), [{ id: HOME_VERB.enter, label: 'Go in' }, { id: HOME_VERB.rent, label: rentTenantLabel(1) }]);
  assert.equal(homeVisitorRows(c, 'enter', T0), null, 'a plain door');
  assert.equal(homeVisitorRows({ ...a, own: true }, 'own', T0), null, 'my own home is the owner\'s rows');
});

test('HOME-RENT the client\'s rent: the rooms read (a row the law refuses dropped), the ones to rent (free, or one\'s own to renew); a rent the purse pays at once on the record\'s act and gets back on a refusal, a purse too short never asked, a character with no record told; the rent collected by the service\'s count (mutants: the reserve kept on a refusal; the purse unasked; the client\'s own sum collected)', async () => {
  const api = {
    rooms: async () => ({ ok: true, data: { owner: 'Olga', mine: false, now: T0, rooms: [
      { room: 1, anchor: [1, 0, 1], price: 40, listed: true, taken: false },
      { room: 2, anchor: [2, 0, 1], price: 40, listed: true, taken: true },
      { room: 3, anchor: [3, 0, 1], price: 40, listed: false, taken: true, yours: true, until: T0 + 9 },
      { room: 4, anchor: 'bad', price: 40 },
    ] } }),
    rentRoom: async (b) => (b.room === 1 ? { ok: true, data: { until: T0 + 3 * RENT_DAY_S } } : { ok: false, error: 'rent-taken' }),
    collectRent: async () => ({ ok: true, data: { gold: 55 } }),
  };
  const got = await homeRooms(api, 7, 300);
  assert.deepEqual(got.rooms.map((r) => r.room), [1, 2, 3], 'a room with no point is none');
  assert.deepEqual(rentable(got.rooms).map((r) => r.room), [1, 3], 'free, or mine to renew');
  const wallet = { gold: 500, pay(n) { this.gold -= n; }, credit(n) { this.gold += n; } };
  const realm = { act: async ({ reserve, apply, call }) => { const undo = reserve?.(); const r = await call({ id: 'x', lease: 'y', seq: 1 }); if (r.ok) apply?.(r); else undo?.(); return r; } };
  const forced = [];
  const homes = { ensure: (id, o) => forced.push([id, o]) };
  const ok = await rentHomeRoom({ api, homes, realm, wallet, mapId: 7, buildingKey: 300, character: 'r1', room: 1, days: 3, price: 40 });
  assert.deepEqual([ok.ok, ok.cost, wallet.gold], [true, 120, 380], 'paid');
  assert.deepEqual(forced, [[7, { force: true }]], 'the town read again: the door opens');
  const no = await rentHomeRoom({ api, homes, realm, wallet, mapId: 7, buildingKey: 300, character: 'r1', room: 2, days: 1, price: 40 });
  assert.deepEqual([no.ok, no.error, wallet.gold], [false, 'rent-taken', 380], 'refused: given back');
  const short = await rentHomeRoom({ api: { rentRoom: () => { throw new Error('never asked'); } }, realm, wallet, mapId: 7, buildingKey: 300, character: 'r1', room: 1, days: 30, price: 40 });
  assert.equal(short.error, 'gold');
  assert.equal((await rentHomeRoom({ api, wallet, mapId: 7, buildingKey: 300, character: 'x', room: 1, days: 1, price: 40 })).error, 'realm-only');
  const c = await collectHomeRent({ api, realm, wallet, mapId: 7, buildingKey: 300, character: 'r1' });
  assert.deepEqual([c.ok, c.gold, wallet.gold], [true, 55, 435], 'the service\'s count');
  assert.deepEqual(rentConfirmLines(1, 3, 40), ['Rent room 1 for 3 days?', 'It costs 120 gold.']);
  for (const w of ['rent-taken', 'rent-held', 'rent-rooms', 'rent-none', 'rent-own', 'rent-price', 'rent-rate', 'rent-long', 'no-rent-room', 'bad-room', 'home-tenants', 'home-rent-due']) assert.equal(typeof REFUSALS[w], 'string', `${w} is a sentence`);
});

test('HOME-RENT the owner\'s rooms: each room the walls make beside the offer whose point stands in it, an offer whose room the walls no longer make listed to withdraw, a room past eight unofferable; what each row says; a price stepped within the law; a room offered by its flight\'s point (mutants: the match by number; the orphan dropped; the step unbounded)', () => {
  const found = [{ id: 1, name: 'Room 1', eye: [11, 1.6, 12] }, { id: 2, name: 'Room 2', eye: [18, 1.6, 12] }, { id: 9, name: 'Room 9', eye: [30, 1.6, 12] }];
  const offers = [{ room: 5, anchor: [8, 1.6, 2], price: 40, listed: true, taken: false }, { room: 1, anchor: [50, 0, 0], price: 10, listed: true, taken: true, tenant: 'Tomas', until: T0 + RENT_DAY_S }];
  const roomOf = (p) => (p[0] < 15 ? { id: 1 } : p[0] < 25 ? { id: 2 } : null);
  const rows = rentRoomsView(found, offers, roomOf, [10, 0, 10]);
  assert.deepEqual(rows.map((r) => [r.id, r.offer?.room ?? null, r.offerable]), [[1, null, true], [2, 5, true], [9, null, false], [null, 1, false]], 'matched by where its point stands, never by its number');
  assert.equal(rentRowSub(rows[0], T0), 'Not offered to rent');
  assert.equal(rentRowSub(rows[1], T0), 'Offered at 40 gold a day');
  assert.equal(rentRowSub(rows[2], T0), 'Only 8 rooms can be offered');
  assert.equal(rentRowSub(rows[3], T0), 'Rented by Tomas - 1 day left');
  assert.equal(rentPriceStep(5, -10), 1);
  assert.equal(rentPriceStep(9_950, 100), 10_000);
  assert.equal(rentPriceStep(null, 10), RENT_PRICE_FIRST + 10);
  assert.deepEqual(rentAnchorOfRoom(found[1], [10, 0, 10]), [8, 1.6, 2]);
});

/** A two-room house the rig stands in (its eye at 10, 1.6, 10): x 4 to 24, z 5 to 15, a shut door at x 14. */
function twoRooms() {
  const c = new Collider();
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const q = (k, a, b, cc, d) => c.addMesh(k, new Float32Array([...a, ...b, ...cc, ...d]), new Uint32Array([0, 1, 2, 0, 2, 3]), I);
  q('floor', [4, 0, 5], [24, 0, 5], [24, 0, 15], [4, 0, 15]);
  q('ceiling', [4, 3, 5], [24, 3, 5], [24, 3, 15], [4, 3, 15]);
  q('w1', [4, 0, 5], [4, 3, 5], [4, 3, 15], [4, 0, 15]);
  q('w2', [24, 0, 5], [24, 3, 5], [24, 3, 15], [24, 0, 15]);
  q('w3', [4, 0, 5], [24, 0, 5], [24, 3, 5], [4, 3, 5]);
  q('w4', [4, 0, 15], [24, 0, 15], [24, 3, 15], [4, 3, 15]);
  q('inner', [14, 0, 5], [14, 3, 5], [14, 3, 15], [14, 0, 15]);
  return c;
}

test('HOME-RENT the decorator\'s rooms view: an online home of two rooms gets "Rooms to rent"; a room chosen, its price stepped and offered by its own point; withdrawn; the rent held collected - each said, and the rooms read again; a house or a ship has no such view (mutants: the tab for a house; the offer at the old price; the rooms not read again)', async () => {
  const calls = [];
  let offered = [];
  let due = 70;
  const door = {
    rooms: async () => { calls.push('rooms'); return { ok: true, rooms: offered, due, now: T0 }; },
    offer: async (b) => { calls.push(['offer', b]); offered = [{ room: b.room, anchor: b.anchor, price: b.price, listed: true, taken: false }]; return { ok: true, data: {} }; },
    withdraw: async (b) => { calls.push(['withdraw', b]); offered = []; return { ok: true, data: { gone: true } }; },
    collect: async () => { calls.push('collect'); const g = due; due = 0; return { ok: true, gold: g }; },
    changed: () => calls.push('changed'),
  };
  const r3 = toolRig({ collider: twoRooms(), room: { kind: 'home', where: 'Your home', mapId: 7, buildingKey: 300 }, rent: () => door });
  r3.frame();
  assert.equal(r3.tool.openPanel(), true);
  for (let i = 0; i < 20; i++) { r3.frame({ overlayUp: true }); await settle(); }
  const root = r3.doc.body.children.find((c) => c.className === 'dfdecor');
  const tab = all(root, 'dfdecor-chip').find((c) => /^Rooms to rent/.test(c.textContent));
  assert.ok(tab, 'the rooms view, for an online home of two rooms');
  tab.fire('click');
  r3.frame({ overlayUp: true });
  const rowsNow = () => all(r3.doc.body.children.find((c) => c.className === 'dfdecor'), 'dfdecor-row');
  assert.equal(rowsNow().length, 2, 'a row a room');
  rowsNow()[0].fire('click');
  const btn = (label) => all(r3.doc.body.children.find((c) => c.className === 'dfdecor'), 'dfdecor-btn').find((b) => b.textContent === label || b.textContent.startsWith(label));
  btn('+10').fire('click');
  btn('Offer').fire('click');
  await settle(); await settle();
  const sent = calls.find((c) => Array.isArray(c) && c[0] === 'offer')[1];
  assert.equal(sent.price, RENT_PRICE_FIRST + 10, 'at the price set');
  assert.ok(Array.isArray(sent.anchor) && sent.anchor.length === 3, 'by its own point');
  assert.ok(calls.includes('changed') && calls.filter((c) => c === 'rooms').length >= 2, 'the rooms read again');
  assert.ok(r3.said.some((l) => /is offered to rent at 60 gold a day/.test(l)));
  for (let i = 0; i < 3; i++) { r3.frame({ overlayUp: true }); await settle(); }
  btn('Collect rent').fire('click');
  await settle(); await settle();
  assert.ok(r3.said.includes('You collected 70 gold in rent.'));
  for (let i = 0; i < 3; i++) { r3.frame({ overlayUp: true }); await settle(); }
  rowsNow().find((r) => /Offered at/.test(JSON.stringify(r.children.map((k) => k.children?.map((x) => x.textContent))))).fire('click');
  btn('Stop offering').fire('click');
  await settle(); await settle();
  assert.ok(calls.some((c) => Array.isArray(c) && c[0] === 'withdraw'), 'withdrawn');
  assert.ok(r3.said.some((l) => /is no longer offered to rent/.test(l)));
  // a house has none
  const house = toolRig({ collider: twoRooms(), rent: () => door });
  house.frame();
  house.tool.openPanel();
  for (let i = 0; i < 10; i++) { house.frame({ overlayUp: true }); await settle(); }
  assert.equal(all(house.doc.body.children.find((c) => c.className === 'dfdecor'), 'dfdecor-chip').some((c) => /^Rooms to rent/.test(c.textContent)), false, 'a house rents no rooms');
});

test('HOME-RENT the host by source: the door lists a tenant\'s and a room-to-rent\'s rows, a rent row pressed (or a click on a home that shuts me out with a room free) asks which room, how many days and the price before it pays on the record, a tenant is told their days and rests there, and the decorator\'s rooms go through the service\'s own door (mutants: the rent before the lock unasked; the tenant\'s bed; the confirm skipped)', () => {
  const wm = src('src/scenes/worldModes.js');
  assert.match(wm, /if \(home\) return homeVisitorRows\(home, homeDoorFor\(bd, home\)\);/);
  assert.match(wm, /&& \(verb === HOME_VERB\.rent \|\| \(verb == null && door === 'locked' && home\.rent\)\)\) \{ openHomeRent\(bd, home\)/);
  assert.ok(wm.indexOf('openHomeRent(bd, home).catch') < wm.indexOf("if (door === 'locked') { townTalk?.say?.(homeLockedLine(home)); return true; }"), 'before the lock');
  assert.match(wm, /action: \(\) => openHomeRentConfirm\(bd, room, d\)/, 'the price asked before it is paid');
  assert.match(wm, /houseOwned: interiorHome \? \(interiorHome\.own \|\| !!interiorHome\.tenant\)/);
  assert.match(wm, /if \(home\?\.tenant && !home\.own\) say\(rentWelcomeLine/);
  assert.match(wm, /rent: \(\) => decorRentDoor\(\),/);
  assert.match(wm, /if \(!api \|\| !interiorHome\?\.own \|\| !b\) return null;/, 'the owner\'s alone');
  const w = src('src/scenes/world.js');
  assert.match(w, /const homesApi = params\.has\('online'\) \? accountHomes\(/);
  assert.match(w, /homesApi,   \/\/ HOME-RENT/);
});
