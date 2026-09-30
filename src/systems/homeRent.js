// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME-RENT (2026-09-30) — THE CLIENT'S HALF OF A RENTED ROOM.
//
// Asked: "For houses with multiple rooms, the owner can choose to rent
// out to other players and adjust the price as needed". The law both
// ends read is net/homeLaw.js (RENT_*), the service's writes
// server-account/src/rent.js; this is what the door and the decorator do
// with them. Pure but for the doors handed in: `api` (net/accountClient.js
// accountHomes), `homes` (systems/onlineHomes.js - told to read the town
// again once a tenancy changes who may walk in), `realm` (the host's
// realm act - systems/realmSaves.js realmGoldAct) and `wallet` (the
// purse and the home's region's account, as a home is paid).
//
// RENTING pays on the tenant's record, in the rent's own write: the purse
// pays at once and gets it back on a refusal (the act's reserve), as a
// home's claim does (onlineHomes.js buyOnlineHome). COLLECTING is the
// owner's: what the service held for them comes into the purse, by the
// service's own count of it, never this client's.
//
// Not a DFU member: Daggerfall rents a tavern's rooms to its one player
// (systems/tavern.js), never a player's own. Ledger A.
// ═══════════════════════════════════════════════════════════════════
import {
  RENT_DAYS, RENT_ROOMS_MAX, rentCost, rentPriceOk, rentRoomOk, rentAnchorOf, rentDaysLeft, RENT_PRICE_MIN, RENT_PRICE_MAX,
} from '../net/homeLaw.js';

/** The door's verb for a home with a room free to rent (onlineHomes.js HOME_VERB's own row). */
export const RENT_VERB = 'home-rent';
/** The steps a price is moved by in the owner's panel, gold a day. */
export const RENT_PRICE_STEPS = Object.freeze([-100, -10, 10, 100]);
/** The price a room is first offered at, gold a day - a tavern's room is a few gold a night; a player's, the owner's. */
export const RENT_PRICE_FIRST = 50;

/** The door's row for a home with rooms free: the cheapest of them a day. */
export const rentRowLabel = (from) => `Rent a room: from ${from} gold a day`;
/** A tenant's row at the door: their own room, and how long it has left. */
export const rentTenantLabel = (daysLeft) => `Your room: ${daysLeft} day${daysLeft === 1 ? '' : 's'} left - renew it`;
/** What a tenant hears walking in. */
export const rentWelcomeLine = (daysLeft) => `You rent a room here - ${daysLeft} day${daysLeft === 1 ? '' : 's'} left. You may rest here.`;
/** The rent window's lines: the rooms to choose from. */
export const rentPickLines = (owner) => [`Rooms to rent in ${owner}'s home.`, 'The rent is paid now, from your purse and this region\'s bank account.'];
/** The rent window's lines: how many days, at a room's price. */
export const rentDaysLines = (room, price) => [`Room ${room} - ${price} gold a day.`, 'For how many days? A day is a real day.'];
/** The rent window's lines: the price asked, before it is paid. */
export const rentConfirmLines = (room, days, price) => [`Rent room ${room} for ${days} day${days === 1 ? '' : 's'}?`, `It costs ${rentCost(price, days)} gold.`];
/** A room rented, said. */
export const rentDoneLine = (room, days) => `Room ${room} is yours for ${days} day${days === 1 ? '' : 's'}. The door will open for you.`;
/** The purse short of a rent. */
export const rentShortLine = (cost) => `You need ${cost} gold, in your purse and this region's bank account together.`;
/** No room free to rent, said at the door. */
export const RENT_NONE_FREE = 'No room here is free to rent right now.';
/** Renting asks an online character of the realm - said where there is none. */
export const RENT_REALM_ONLY = 'Only an online character of the realm can rent a room.';

/**
 * A HOME'S ROOMS, read: `{ ok, rooms, due, owner, mine, now }` - each room `{ room, anchor, price, listed, taken, yours,
 * until, tenant }` as the service answers them (a row the law refuses dropped) - or `{ ok: false, error }`.
 */
export async function homeRooms(api, mapId, buildingKey) {
  const r = await api.rooms(mapId, buildingKey);
  if (!r?.ok) return { ok: false, error: r?.error ?? 'server' };
  const d = r.data ?? {};
  const rooms = (Array.isArray(d.rooms) ? d.rooms : []).filter((x) => rentRoomOk(x?.room) && rentPriceOk(x?.price) && rentAnchorOf(x?.anchor))
    .map((x) => ({
      room: x.room, anchor: rentAnchorOf(x.anchor), price: x.price, listed: x.listed === true, taken: x.taken === true, yours: x.yours === true,
      until: Number.isSafeInteger(x.until) ? x.until : null, tenant: typeof x.tenant === 'string' ? x.tenant : null,
    }));
  const n = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);
  return { ok: true, rooms, due: n(d.due), owner: typeof d.owner === 'string' ? d.owner : '', mine: d.mine === true, now: n(d.now) };
}

/** The rooms a visitor may rent now - offered and free, or their own (to renew). */
export const rentable = (rooms) => (rooms ?? []).filter((r) => (r.listed && !r.taken) || r.yours);

/**
 * RENT ONE (or renew one's own) for `days`: the purse pays at once and gets it back on a refusal, the tenant's record
 * pays on the service in the rent's own write, and the town is read again so the door opens. Answers `{ ok, until,
 * cost }` or `{ ok: false, error }` - `gold` for a purse too short, `realm-only` for a character with no record.
 * @param {{ api: any, homes?: any, realm?: any, wallet: { gold: number, pay: (n: number) => void, credit?: (n: number) => void },
 *   mapId: number, buildingKey: number, character: string|null, room: number, days: number, price: number }} o
 */
export async function rentHomeRoom({ api, homes = null, realm = null, wallet, mapId, buildingKey, character, room, days, price }) {
  const cost = rentCost(price, days);
  if (!cost || !rentRoomOk(room)) return { ok: false, error: 'bad-room' };
  if (!realm?.act) return { ok: false, error: 'realm-only' };
  if (!(wallet.gold >= cost)) return { ok: false, error: 'gold' };
  const r = await realm.act({
    reserve: () => { wallet.pay(cost); return () => wallet.credit?.(cost); },
    call: (/** @type {any} */ at) => api.rentRoom({ mapId, buildingKey, character, room, days, price, realm: at }),
  });
  if (!r?.ok) return { ok: false, error: r?.error ?? 'server' };
  homes?.ensure?.(mapId, { force: true });
  return { ok: true, until: Number.isSafeInteger(r.data?.until) ? r.data.until : null, cost };
}

/**
 * COLLECT THE RENT held for the owner: the service pays it into the owner's record, and the purse takes what the
 * service says it paid (an answer that landed but never came back ends the session - `needsAnswer`). Answers
 * `{ ok, gold }` or `{ ok: false, error }`.
 */
export async function collectHomeRent({ api, realm = null, wallet, mapId, buildingKey, character }) {
  if (!realm?.act) return { ok: false, error: 'realm-only' };
  let gold = 0;
  const r = await realm.act({
    needsAnswer: true,
    apply: (/** @type {any} */ res) => { gold = Math.max(0, Number(res?.data?.gold) || 0); if (gold > 0) wallet.credit?.(gold); },
    call: (/** @type {any} */ at) => api.collectRent({ mapId, buildingKey, character, realm: at }),
  });
  return r?.ok ? { ok: true, gold } : { ok: false, error: r?.error ?? 'server' };
}

/** A price moved by `step`, kept within the law. */
export const rentPriceStep = (price, step) => Math.min(RENT_PRICE_MAX, Math.max(RENT_PRICE_MIN, (rentPriceOk(price) ? price : RENT_PRICE_FIRST) + step));

/**
 * THE OWNER'S ROOMS: each room the house's walls part it into (systems/decorRooms.js - `found`, `{ id, name, eye }`)
 * beside the service's offer for it (`offered`: the room whose point stands in it - `roomOf(point)` the finder's), and
 * every offer whose room the walls no longer make (a room a door once parted), so it can still be withdrawn. A found room
 * past RENT_ROOMS_MAX cannot be offered.
 * @param {{ id: number, name: string, eye: number[] }[]} found
 * @param {any[]} offers
 * @param {(p: number[]) => ({ id: number }|null)} roomOf
 * @param {number[]} origin
 */
export function rentRoomsView(found, offers, roomOf, origin) {
  const used = new Set();
  const rows = (found ?? []).map((f) => {
    const o = (offers ?? []).find((x) => !used.has(x.room) && roomOf([origin[0] + x.anchor[0], origin[1] + x.anchor[1], origin[2] + x.anchor[2]])?.id === f.id) ?? null;
    if (o) used.add(o.room);
    return { id: f.id, name: f.name, eye: f.eye, offer: o, offerable: rentRoomOk(f.id) };
  });
  for (const o of offers ?? []) if (!used.has(o.room)) rows.push({ id: null, name: `Room ${o.room} (its walls have changed)`, eye: null, offer: o, offerable: false });
  return rows;
}

/** What an owner's room row says: not offered, offered at a price, or rented and until when. */
export function rentRowSub(row, nowS) {
  const o = row.offer;
  if (!o) return row.offerable ? 'Not offered to rent' : `Only ${RENT_ROOMS_MAX} rooms can be offered`;
  if (o.taken) return `Rented by ${o.tenant ?? 'a tenant'} - ${rentDaysLeft(o.until, nowS)} day${rentDaysLeft(o.until, nowS) === 1 ? '' : 's'} left${o.listed ? '' : ' - offered to nobody after'}`;
  return `Offered at ${o.price} gold a day`;
}
/** The anchor a found room is offered by: its flight's point, from the building's origin. */
export const rentAnchorOfRoom = (room, origin) => rentAnchorOf([room.eye[0] - origin[0], room.eye[1] - origin[1], room.eye[2] - origin[2]]);
/** The days a visitor is offered, as the window's rows. */
export const RENT_DAY_ROWS = RENT_DAYS;
