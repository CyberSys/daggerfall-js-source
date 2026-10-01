// @ts-check
// ═══════════════════════════════════════════════════════════════════
// HOME1 (2026-09-25) — THE ONLINE HOMES, AS THIS CLIENT KNOWS THEM.
//
// Mac: "allowing online players to purchase housing in any location";
// asked: "Housing is exclusive"; a home is bought "At its front door"
// ("Click any unowned house's door and buy it there. Works in every
// town, including hamlets with no bank."); a house bought offline
// "Stay[s] offline only"; who walks in, "Owner chooses".
//
// The account service keeps the one registry (server-account/src/
// homes.js, its shapes net/homeLaw.js). This is the client's reading of
// it - one town at a time, asked when that town's doors are and believed
// for HOME_TOWN_TTL_MS - and the door's laws over what it holds, pure,
// so the press, the swing, the hover and the building all read ONE
// answer (worldModes.js is the host).
//
// ═══ WHERE THE SERVER'S LIST DECIDES ═══════════════════════════════
//
// Online, a building the list names is that player's home: to its
// owner their own (storage, a bed, a door open at any hour), to every
// other player a house that opens as its owner says. A building the
// list does NOT name stands under Daggerfall's own law - and that
// includes this character's own OFFLINE house. "Stay offline only" is a
// house the server never hears of, not one taken away: it keeps its
// storage and its bed for me, and anyone may still buy the building
// online, which then decides it (and my offline house is still mine
// offline - "Nobody ever loses a house to a conflict").
//
// ═══ AN ONLINE HOME KEEPS ITS OWN SCENE ════════════════════════════
//
// What I keep in my online home is saved under its OWN scene name
// (homeSceneName), never the building's. Offline the same building is a
// stranger's, and a stranger's cupboard restocks the moment it is
// opened: under one name, the first offline visit would have thrown my
// things away. The owner's offline house, the other way round, is
// never read as an online home's storage.
// ═══════════════════════════════════════════════════════════════════

import {
  HOME_ENTRIES, HOME_ENTRY_DEFAULT, homeMapIdOk, homeBuildingKeyOk, homePriceOk, homeMayEnter, rentPriceOk, rentDaysLeft, homeLookOf,
} from '../net/homeLaw.js';
import { RENT_VERB, rentRowLabel, rentTenantLabel } from './homeRent.js';   // HOME-RENT: the door's rows for a room to rent
import { BUILDING_TYPES, isResidence } from '../world/buildingNames.js';
import { DEED_SELL_MULT, CROSSED_DEED_LINES } from './banking.js';

/** How long a town's answer is believed before a door asks again. */
export const HOME_TOWN_TTL_MS = 60_000;
/** After an unanswered ask, how long before the next - a service that is down is not asked at every door. */
export const HOME_RETRY_MS = 10_000;
/** How long a door waits for a town's first answer before it goes on under Daggerfall's own law. */
export const HOME_ASK_WAIT_MS = 2_500;

/** What each entry reads as, to the owner. */
export const HOME_ENTRY_WORDS = Object.freeze({ private: 'Only me', party: 'My party', public: 'Anyone' });

/**
 * WHETHER A BUILDING CAN BE A HOME AT ALL: Daggerfall's own for-sale houses and every house type it has - House1-4
 * (the residences GetHousesForSale tops its list up from) and, HOME2 (Mac: "We need to ensure any house can be
 * bought"; asked, "Also widen what counts as a house (House5/House6 too)"), House5 and House6, which RMBLayout.
 * IsResidence leaves out - never a House2 that belongs to a faction, which Daggerfall's lock law keeps for that
 * guild's members alone (buildingLocks.js; the Thieves Guild's and the Dark Brotherhood's): a guild's hideout sold
 * to one player would shut the guild out.
 */
export function homeCandidate(bd) {
  const t = bd?.buildingType;
  if (!homeBuildingKeyOk(bd?.buildingKey)) return false;
  if (t === BUILDING_TYPES.House2 && (bd.factionId ?? 0) !== 0) return false;
  return t === BUILDING_TYPES.HouseForSale || isResidence(t) || t === BUILDING_TYPES.House5 || t === BUILDING_TYPES.House6;
}

/** ...and whether one can be BOUGHT: a candidate no active quest is using (GetHousesForSale's own exclusion). */
export const homePurchasable = (bd, { isActiveQuestBuilding = null } = {}) =>
  homeCandidate(bd) && !(isActiveQuestBuilding?.(bd) ?? false);

/** The scene an online home's things are kept under - its own, never the building's (the header). */
export const homeSceneName = (mapId, buildingKey) => `OnlineHome [MapID=${Number(mapId) >>> 0}, BuildingKey=${buildingKey}]`;

/** What a home sells back for: Daggerfall's deed share (DEED_SELL_MULT) of what was paid. */
export const homeRefund = (price) => Math.trunc((Number.isSafeInteger(price) && price > 0 ? price : 0) * DEED_SELL_MULT);

/**
 * WHAT A HOME'S DOOR DOES FOR THIS PLAYER, the one answer every door reads. `home` is `homeAt`'s view or null.
 *   'none'   - no player's home (or its town is not known yet): Daggerfall's own law stands
 *   'own'    - this character's own: open at any hour
 *   'enter'  - someone's home this player may walk into - its owner's other characters, anyone when it is public,
 *              the owner's party when it is theirs, and a player whose active quest is set in it (Daggerfall's own
 *              rung: "Buildings part of an active quest are always unlocked" - a quest must not strand its player)
 *   'locked' - someone's home this player may not
 */
export function homeDoorAnswer(home, { partyNames = [], questSite = false } = {}) {
  if (!home) return 'none';
  if (home.own) return 'own';
  if (homeMayEnter(home, { partyNames }) || questSite) return 'enter';
  return 'locked';
}

/**
 * HOME-OFFER (2026-09-26, Mac: "Enhanced plus cant buy house"): WHAT A PRESS ON A HOUSE'S DOOR ASKS FIRST, if
 * anything. HOME1 put the offer and the owner's menu behind Info mode alone, and nothing on the enhanced skins says
 * so - the mode word is drawn, not pressed, and the default is Grab - so a player told by the bank that "a home is
 * bought at its own front door" pressed the door and walked in, on Enhanced and Enhanced Plus alike. The offer asks
 * now in any mode but Steal (a thief is not shopping), ONCE: a No goes on through the door, as it always did, and
 * that house asks no more this session unless the player presses it in Info, which always asks. The owner's menu
 * stays Info's - an owner's press is the way in.
 *   door     - homeDoorAnswer's word;   mode - the interaction mode;   price - homeOfferPrice's (0: not for sale)
 *   declined - this player said No to this house this session;   asked - the press IS the answer's onward step
 * Answers 'menu', 'offer' or null (the door opens as Daggerfall's law says).
 */
export function homeDoorPrompt({ door, mode, price = 0, declined = false, asked = false, isBash = false }) {
  if (isBash || asked) return null;
  if (door === 'own') return mode === 'info' ? 'menu' : null;
  if (door !== 'none' || !(price > 0)) return null;
  if (mode === 'info') return 'offer';
  return mode === 'steal' || declined ? null : 'offer';
}

/** The door's name for a home, over the building's own. */
export const homeDoorTitle = (home) => (home.own ? 'Your home' : `${home.owner}'s home`);
/**
 * FIELD BUGS 2026-09-30b (HOME-PLAQUE): "every door looks like just a house I can buy". A private house has no name
 * (DFU's BuildingNames names none), and a nameless door drew no plaque - so HOME2's verbs, which ride the plaque, were
 * never listed at an ordinary house, and the first click in Grab or Talk fell through to HOME-OFFER's box ("This house
 * can be your home ... Buy it?") at every door in town. A house whose door has verbs to list is named with DFU's own
 * word for one (Internal_Strings 50, "Residence"): its plaque stands, "Go in" lit, and the quest's residence - named
 * "The <surname> Residence" and never for sale - reads apart from the rest.
 */
export const homeDoorName = (name, hasVerbs) => name || (hasVerbs ? 'Residence' : '');
/** What a player reads at a home's door they may not open. */
export const homeLockedLine = (home) => `This is ${home.owner}'s home. The door is locked.`;
/** What a visitor reads at a home's cupboard. */
export const homeBelongsLine = (home) => `This belongs to ${home.owner}.`;
/** The hover's line under a house anyone may buy. */
export const homeForSaleLine = (price) => `Can be your home: ${price} gold`;
/** The offer at the door. */
export const homeOfferLines = (price) => ['This house can be your home.', `It costs ${price} gold, from your purse and this region's bank account.`, 'Buy it?'];
export const HOME_BOUGHT_LINE = 'This house is your home now. Only you can enter it until you say otherwise.';
export const homeShortLine = (price) => `You need ${price} gold, in your purse and this region's bank account together.`;
/**
 * HOME2 (Mac: "We need to ensure any house can be bought"; offered the door's offer on any click but Steal, with "our
 * tooltip implementation"): THE DOOR'S VERBS ON THE PLAQUE. HOME1 offered a house only to a click in Info mode, a
 * window every other mode never opened - so a player who clicked a door in the mode they walk in (Grab, Talk) walked
 * in, and no house could be bought that way. The door's tooltip (World Tooltips' plaque) now lists what the door
 * does, as ACT-MENU lists a player's and a horse's (systems/worldHover.js): the wheel lights a row and the click
 * presses it. "Go in" is first and lit, so a plain click is still a plain click.
 *
 * BUYING TAKES TWO PRESSES. The first arms the row ("Click again to buy") for HOME_BUY_ARM_MS and the second buys - a
 * wheel notch too many and one click must never spend thousands of gold. Where the plaque draws no rows (a touch
 * screen, World Tooltips off) the click itself offers, once a house a session (worldModes.js).
 */
export const HOME_BUY_ARM_MS = 5_000;
export const HOME_VERB = Object.freeze({ enter: 'home-enter', buy: 'home-buy', entry: 'home-entry', sell: 'home-sell', rent: RENT_VERB });   // HOME-RENT: a room rented at the door
/** The rows over a house anyone may buy, at `price`; `armed` after its first press. */
export const homeBuyRows = (price, armed = false) => [
  { id: HOME_VERB.enter, label: 'Go in' },
  { id: HOME_VERB.buy, label: armed ? `Click again to buy: ${price} gold` : `Buy it: ${price} gold` },
];
/** The rows over my own home: go in, who may enter (a press moves it on), sell it (its own window - the warning
 *  that what is inside is lost is not a row's to say). */
export const homeOwnerRows = (entry) => [
  { id: HOME_VERB.enter, label: 'Go in' },
  { id: HOME_VERB.entry, label: `Who may enter: ${HOME_ENTRY_WORDS[entry] ?? HOME_ENTRY_WORDS[HOME_ENTRY_DEFAULT]}` },
  { id: HOME_VERB.sell, label: 'Sell it' },
];
/**
 * HOME-RENT: THE ROWS OVER SOMEONE ELSE'S HOME, where they say more than "Locked": a tenant's (go in, and their own room
 * to renew), and a home with rooms free to rent - go in where the door opens for me, and rent one. `door` is
 * homeDoorAnswer's; `nowS` the clock the days left are counted by. Null where a plain door is all there is.
 */
export function homeVisitorRows(home, door, nowS = Math.floor(Date.now() / 1000)) {
  if (!home || home.own) return null;
  if (rentDaysLeft(home.tenant, nowS) > 0) return [{ id: HOME_VERB.enter, label: 'Go in' }, { id: HOME_VERB.rent, label: rentTenantLabel(rentDaysLeft(home.tenant, nowS)) }];
  // AUDIT: never from one's own account (the service refuses it `rent-own`) - another character of the owner's is shown
  // only the door
  if (!home.rent || home.mine) return null;
  return [...(door === 'enter' ? [{ id: HOME_VERB.enter, label: 'Go in' }] : []), { id: HOME_VERB.rent, label: rentRowLabel(home.rent.from) }];
}
/** Who may enter after `entry`, a press on the row: only me, my party, anyone, and round again. */
export const homeNextEntry = (entry) => HOME_ENTRIES[(Math.max(0, HOME_ENTRIES.indexOf(entry)) + 1) % HOME_ENTRIES.length];
/** Where the plaque draws no rows, the click's own offer: its two answers. */
export const HOME_OFFER_BUY = 'Y - buy it';
export const HOME_OFFER_PASS = 'N - just go in';

/** The owner's menu at their own door. */
export const homeOwnerLines = (home) => ['This is your home.', homeEntryLine(home.entry)];
export const homeEntryLine = (entry) => `Who may enter: ${HOME_ENTRY_WORDS[entry] ?? HOME_ENTRY_WORDS[HOME_ENTRY_DEFAULT]}.`;
export const homeSaleLines = (refund) => [`Sell your home for ${refund} gold?`, "The gold goes to this region's bank account. Anything left inside is lost.",
  'Its placed pieces go too, for half of what they cost; your own things come back to your pack.'];   // DECOR1e; DECOR2a
/** HOME-CROSSED (FIELD BUGS 2026-09-30): a home customs carried in is never bought back online - the bank's own words for
 *  a crossed deed (RESTORE), and that it stays a home. The door says them and asks no price. */
export const HOME_CROSSED_LINES = Object.freeze([...CROSSED_DEED_LINES, 'It stays your home.']);
/** The sale said: the home's share, and (DECOR1e) its pieces' half, both into the region's account. */
export const homeSoldLine = (refund, piecesBack = 0, rent = 0) => `You sold your home. ${refund + piecesBack + rent} gold went to this region's bank account`
  + ([piecesBack > 0 ? `${piecesBack} of it for its placed pieces` : null, rent > 0 ? `${rent} of it rent you had not collected` : null].filter(Boolean).map((t, i) => (i ? ` and ${t}` : `, ${t}`)).join('')) + '.';   // HOME-RENT: the held rent named
/** The bank's answer to Buy House online (Mac chose the door, not the bank - its list is the offline house). */
export const HOME_BANK_LINES = Object.freeze(['Online, a home is bought', 'at its own front door.']);

/**
 * THE CLIENT'S REGISTRY over `api` (net/accountClient.js accountHomes: every answer `{ ok, data }` or
 * `{ ok: false, error }`, never a throw). `character()` is the character playing - a home is ONE character's
 * (`own`), though its account may always walk in (`mine`). Answers `{ ensure, waitFor, known, homeAt, claim,
 * release, setEntry, version }`; `version` moves on every change a door would show.
 * @param {{ api: any, character?: () => (string|null), now?: () => number, ttlMs?: number }} opts
 */
export function createOnlineHomes({ api, character = () => null, now = () => Date.now(), ttlMs = HOME_TOWN_TTL_MS }) {
  /** @type {Map<number, {at: number, homes: Map<number, any>}>} */
  const towns = new Map();
  /** @type {Map<number, Promise<boolean>>} */
  const asking = new Map();
  /** @type {Map<number, number>} */
  const failed = new Map();
  /** @type {Map<number, number>} FB1001 LOOK-STALE: my answered writes to each town, counted - and the count each town's
   *  ask in flight set out under. An answer that set out before a write of mine landed is older than the row I wrote. */
  const writes = new Map();
  /** @type {Map<number, number>} */
  const askedAt = new Map();
  const writesTo = (id) => writes.get(id) ?? 0;
  /** @type {Set<number>} FB1001 (LOOK-STALE, HOMES-FORCE): the towns whose ask in flight was itself a forced one */
  const forcedFlight = new Set();
  let version = 0;
  const idOf = (mapId) => (Number.isFinite(Number(mapId)) ? Number(mapId) >>> 0 : 0);

  /** Ask for a town unless its answer is fresh - one ask in flight a town. Resolves whether the town is known. */
  function ensure(mapId, { force = false } = {}) {
    const id = idOf(mapId);
    if (!homeMapIdOk(id)) return Promise.resolve(false);
    const had = towns.get(id);
    if (!force && had && now() - had.at < ttlMs) return Promise.resolve(true);
    const flying = asking.get(id);
    // FB1001 (LOOK-STALE, HOMES-FORCE): a forced ask is asked AFTER the flight it finds - never answered by it (ASYNC
    // NEVER DROPS): that flight set out before whatever forced this one (a look painted, a room rented), and its answer
    // does not hold it. The one exception is a forced flight that set out after my last write: its answer is the one asked
    if (flying) return !force || (forcedFlight.has(id) && askedAt.get(id) === writesTo(id)) ? flying : afterFlight(id, flying);
    if (!force && now() - (failed.get(id) ?? -Infinity) < HOME_RETRY_MS) return Promise.resolve(!!had);
    const gen = writesTo(id);
    const p = Promise.resolve()
      .then(() => api.town(id, character()))   // HOME-RENT: the playing character's own tenancies ride the answer
      .then((r) => {
        const list = r?.ok ? r.data?.homes : null;
        // unanswered: what was known stands, nothing new is believed, and the next ask waits a little
        if (!Array.isArray(list)) { failed.set(id, now()); return towns.has(id); }
        // FB1001 LOOK-STALE: the service answered before a write of mine landed - a painted look, a door's entry, a claim
        // - so the town as it stood then is never believed over it (it put a painted house back for a minute); the
        // write's own ask follows this one
        if (writesTo(id) !== gen) return towns.has(id);
        const homes = new Map();
        for (const h of list) {
          if (!homeBuildingKeyOk(h?.buildingKey) || typeof h.owner !== 'string') continue;
          homes.set(h.buildingKey, {
            buildingKey: h.buildingKey, owner: h.owner,
            entry: HOME_ENTRIES.includes(h.entry) ? h.entry : HOME_ENTRY_DEFAULT,
            mine: h.mine === true, character: typeof h.character === 'string' ? h.character : null,
            crossed: h.crossed === true,   // HOME-CROSSED: mine, carried in through customs - no sale
            // HOME-RENT: rooms free to rent (how many, from what a day), and the playing character's tenancy's end
            rent: Number.isSafeInteger(h.rent?.vacant) && h.rent.vacant > 0 && rentPriceOk(h.rent.from) ? { vacant: h.rent.vacant, from: h.rent.from } : null,
            tenant: Number.isSafeInteger(h.tenant) && h.tenant > 0 ? h.tenant : null,
            look: homeLookOf(h.look ?? null),   // HOME-LOOK: how its owner painted it (null: the town's own)
          });
        }
        towns.set(id, { at: now(), homes });
        failed.delete(id);
        version++;
        return true;
      }, () => { failed.set(id, now()); return towns.has(id); })
      .finally(() => { asking.delete(id); askedAt.delete(id); forcedFlight.delete(id); });
    asking.set(id, p);
    askedAt.set(id, gen);
    if (force) forcedFlight.add(id);
    return p;
  }

  /**
   * HOMES-FORCE (FIELD BUGS 2026-10-01, "Room renting is buggy"): A FORCED READ ASKED WHILE ANOTHER IS IN FLIGHT IS ASKED
   * AFTER IT, never answered by it - the one in flight left before the change that forced this one (a room rented, a
   * home bought or sold), and its answer does not hold it: a rent that landed under a plaque's read kept the door shut on
   * its tenant for the town's whole minute. ASYNC NEVER DROPS: and one such read a town, however many ask for it - the
   * first to land sets out as a forced flight under the same writes, and `ensure` hands the rest that flight.
   */
  const afterFlight = (id, flying) => flying.then(() => ensure(id, { force: true }));

  /** `ensure`, but a door does not wait on it longer than `ms`: resolves whether the town is known by then. */
  function waitFor(mapId, ms = HOME_ASK_WAIT_MS) {
    const id = idOf(mapId);
    /** @type {any} */
    let timer = null;
    const late = new Promise((res) => { timer = setTimeout(() => res(towns.has(id)), ms); });
    return Promise.race([ensure(id), late]).finally(() => clearTimeout(timer));
  }

  const known = (mapId) => towns.has(idOf(mapId));

  /** The home a building is, as this client last heard - `own` read against the character playing NOW - or null. */
  function homeAt(mapId, buildingKey) {
    const row = towns.get(idOf(mapId))?.homes.get(buildingKey) ?? null;
    if (!row) return null;
    const me = character();
    return Object.freeze({ ...row, own: row.mine && typeof me === 'string' && row.character === me });
  }

  /** A change I made, shown now and read back from the service after (the owner's name, the others' doors). */
  function wrote(id, buildingKey, row) {
    writes.set(id, writesTo(id) + 1);   // FB1001 LOOK-STALE: an ask already out answers the town from before this
    const t = towns.get(id);
    if (t) {
      if (row) t.homes.set(buildingKey, row);
      else t.homes.delete(buildingKey);
      version++;
    }
    ensure(id, { force: true });
  }

  /** REALM P2.2b: a refusal's sequence rides out with it (a realm act reads one a step on as its own, landed), and an
   *  answer's record sequence (data.realm) - neither there for any other character. */
  const refused = (r) => ({ ok: false, error: r?.error ?? 'server', ...(Number.isSafeInteger(r?.seq) ? { seq: r.seq } : {}) });
  const realmOf = (r) => (r?.data?.realm ? { data: { realm: r.data.realm } } : {});

  async function claim({ mapId, buildingKey, region, price, realm = null }) {
    const id = idOf(mapId);
    const me = character();
    const r = await api.claim({ mapId: id, buildingKey, region, character: me, price, ...(realm ? { realm } : {}) });
    if (r?.ok) {
      const had = towns.get(id)?.homes.get(buildingKey);
      wrote(id, buildingKey, { buildingKey, owner: had?.owner ?? '', entry: r.data?.home?.entry ?? HOME_ENTRY_DEFAULT, mine: true, character: me });
      return { ok: true, repeat: r.data?.repeat === true, ...realmOf(r) };   // REALM P2.2b: the record's new sequence, in data.realm
    }
    if (r?.error === 'home-taken' || r?.error === 'seq') ensure(id, { force: true });   // somebody's now, or mine already: the door should say whose
    return refused(r);
  }

  async function release(mapId, buildingKey, realm = null) {
    const id = idOf(mapId);
    const r = realm ? await api.release(id, buildingKey, realm) : await api.release(id, buildingKey);
    if (r?.ok) {
      wrote(id, buildingKey, null);
      const n = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);
      // DECOR1e: and its placed pieces, gone with it, and half of what they cost - the service's own sum; AUDIT REALM
      // L1-F3: and, for a realm character's record, the deed share the record was paid (`refund`)
      // HOME-RENT: and the rent held on it that its owner never collected, paid with it (`rent`)
      return { ok: true, price: n(r.data?.price), decorCount: n(r.data?.decorCount), decorBack: n(r.data?.decorBack), ...(r.data?.refund != null ? { refund: n(r.data.refund) } : {}), ...(r.data?.rent != null ? { rent: n(r.data.rent) } : {}), ...realmOf(r) };
    }
    if (r?.error === 'no-home' || r?.error === 'seq') ensure(id, { force: true });
    return refused(r);
  }

  async function setEntry(mapId, buildingKey, entry) {
    const id = idOf(mapId);
    const r = await api.entry(id, buildingKey, entry);
    if (r?.ok) {
      const row = towns.get(id)?.homes.get(buildingKey);
      wrote(id, buildingKey, row ? { ...row, entry } : null);
      return { ok: true, entry };
    }
    if (r?.error === 'no-home') ensure(id, { force: true });
    return { ok: false, error: r?.error ?? 'server' };
  }

  /** HOME-LOOK: MY HOME PAINTED - shown at once (every house in the town is drawn from this registry) and read back. */
  async function setLook(mapId, buildingKey, look) {
    const id = idOf(mapId);
    const next = look == null ? null : homeLookOf(look);
    if (look != null && !next) return { ok: false, error: 'bad-look' };
    const r = await api.look({ mapId: id, buildingKey, character: character(), look: next });
    if (r?.ok) {
      const row = towns.get(id)?.homes.get(buildingKey);
      wrote(id, buildingKey, row ? { ...row, look: homeLookOf(r.data?.look ?? next) } : null);
      return { ok: true, look: next };
    }
    if (r?.error === 'no-home') ensure(id, { force: true });
    return { ok: false, error: r?.error ?? 'server' };
  }
  /** HOME-LOOK: every home of a town this page has heard from, by its building key - the pixel's painter reads it. */
  function homesIn(mapId) {
    const t = towns.get(idOf(mapId));
    return t ? new Map([...t.homes].map(([k, row]) => [k, row])) : null;
  }

  return { ensure, waitFor, known, homeAt, claim, release, setEntry, setLook, homesIn, version: () => version };
}

/**
 * BUY ONE AT ITS DOOR. The claim first - the service's one answer decides whether the building can be mine at all -
 * and the gold only once it is. `afford(price)` asks the purse and the region's bank account together, before the
 * claim and again after it (the purse can change while the answer is out); a claim the player can no longer pay for
 * is given back rather than kept unpaid. `pay(price)` takes it, purse first, as Daggerfall's own purchase does.
 * Answers `{ ok: true }` or `{ ok: false, error }` - `gold` for the purse, else the service's word.
 */
export async function buyOnlineHome(homes, { mapId, buildingKey, region, price, afford, pay, refund = null, realm = null }) {
  if (!homePriceOk(price)) return { ok: false, error: 'bad-home' };
  // AUDIT MERGE-PLUS A1: ONE CLAIM A HOUSE AT A TIME. The registry is written only when the claim answers, so until
  // then the door went on offering "Buy it" - a second press sent a second claim, the service answered it `repeat`
  // (the house was already this player's) and this paid again: 42,000 twice for one house. A buy already out for the
  // same house answers `busy` and pays nothing; the first one's answer speaks for both.
  const key = `${mapId}:${buildingKey}`;
  let out = _buying.get(homes);
  if (!out) _buying.set(homes, out = new Set());
  if (out.has(key)) return { ok: false, error: HOME_BUY_BUSY };
  out.add(key);
  try {
    if (!afford(price)) return { ok: false, error: 'gold' };
    if (realm) {
      // REALM P2.2b: the claim and the record's payment are one write on the service - the purse pays at once and gets it
      // back on a refusal (systems/realmSaves.js realmGoldAct); there is no claim to give back
      const r = await realm.act({
        reserve: () => { pay(price); return () => refund?.(price); },
        // AUDIT REALM: a claim answered as the house already this character's (`repeat`) moved no gold on the record - the
        // purse's reserve comes back, or the next checkpoint would write the price paid twice
        apply: (/** @type {any} */ res) => { if (res?.repeat) refund?.(price); },
        call: (/** @type {any} */ at) => homes.claim({ mapId, buildingKey, region, price, realm: at }),
      });
      return r?.ok ? { ok: true } : { ok: false, error: r?.error ?? 'server' };
    }
    const r = await homes.claim({ mapId, buildingKey, region, price });
    if (!r.ok) return r;
    if (!afford(price)) {
      await homes.release(mapId, buildingKey);
      return { ok: false, error: 'gold' };
    }
    pay(price);
    return { ok: true };
  } finally {
    out.delete(key);
  }
}
/** AUDIT MERGE-PLUS A1: the word for a buy already out for the same house - the caller says nothing of its own. */
export const HOME_BUY_BUSY = 'busy';
/** The houses whose claim is out, per registry (a page has one; a test stands several). */
const _buying = new WeakMap();
/** HOME-CROSSED (FIELD BUGS 2026-09-30): the word for a sale already out for the same house - the caller says nothing of
 *  its own. A second press while the first was out reached the realm's hold (`busy`) and said "The account service had
 *  a problem. Try again." after the first sale's line. */
export const HOME_SALE_OUT = 'sale-out';
/** The houses whose sale is out, per registry. */
const _selling = new WeakMap();

/**
 * SELL ONE BACK: given up first, and credited only once the service agrees it is gone - Daggerfall's share
 * (homeRefund) of what the service says was paid, never of a price this client names. `credit(n)` pays it in.
 */
export async function sellOnlineHome(homes, { mapId, buildingKey, credit, realm = null }) {
  const house = `${mapId}:${buildingKey}`;
  let selling = _selling.get(homes);
  if (!selling) _selling.set(homes, selling = new Set());
  if (selling.has(house)) return { ok: false, error: HOME_SALE_OUT };
  selling.add(house);
  try {
    return await sellOut(homes, { mapId, buildingKey, credit, realm });
  } finally {
    selling.delete(house);
  }
}
async function sellOut(homes, { mapId, buildingKey, credit, realm }) {
  if (realm) {
    // REALM P2.2b: the house given up and the record paid back are one write on the service; the purse takes what the
    // service says it paid (an answer that landed but never came back ends the session - `needsAnswer`)
    /** @type {any} */
    let sold = null;
    const r = await realm.act({
      needsAnswer: true,
      apply: (/** @type {any} */ res) => {
        // AUDIT REALM L1-F3: what the RECORD was paid (the service's `refund`: the deed share of what a record paid for the
        // house - nothing for one from before the realm) - never this client's share of a price, which the record may
        // never have paid, and which the next checkpoint would then write over it
        // HOME-RENT: and the rent held on the house that was never collected - the service paid it into the record with
        // the rest, so the purse must take it too, or the act's checkpoint writes it away
        const rent = Math.max(0, Number(res.rent) || 0);
        sold = { refund: Math.max(0, Number(res.refund) || 0), decorBack: Math.max(0, Number(res.decorBack) || 0), ...(rent > 0 ? { rent } : {}) };
        credit(sold.refund + sold.decorBack + rent);
      },
      call: (/** @type {any} */ at) => homes.release(mapId, buildingKey, at),
    });
    return r?.ok && sold ? { ok: true, ...sold } : { ok: false, error: r?.error ?? 'server' };
  }
  const r = await homes.release(mapId, buildingKey);
  if (!r.ok) return r;
  const refund = homeRefund(r.price);
  const decorBack = r.decorBack ?? 0;   // DECOR1e: its placed pieces' half, as the service summed it
  credit(refund + decorBack);
  return { ok: true, refund, decorBack };
}
