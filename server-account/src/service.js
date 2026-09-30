// @ts-check
// ═══════════════════════════════════════════════════════════════════
// AUDIT-ACC F2: WHAT THIS SERVICE IS, SEPARATE FROM ITS ENTRYPOINT.
//
// These four constants lived in `src/index.js` until the audit stood
// the Worker up in a real workerd and it refused to boot:
//
//   Uncaught TypeError: Incorrect type for map entry 'ACCOUNT_VERSION':
//   the provided value is not of type 'function or ExportedHandler'.
//
// IN A MODULE WORKER, EVERY NAMED EXPORT OF THE ENTRYPOINT IS AN
// ENTRYPOINT. workerd reads them as additional handlers - a
// WorkerEntrypoint, a Durable Object, a Workflow - and a plain string
// or Set is not one of those, so it is a hard startup failure rather
// than something ignored. The relay's own `server/src/index.js` is the
// control: it exports `default` and the `Room` Durable Object class,
// both legal, and it has deployed for months.
//
// No node test could see this. The tests IMPORTED those very names, so
// they proved the exports existed while the runtime rejected them for
// existing. The fix is not to hide them - it is to stop the entrypoint
// doubling as a library. The entrypoint answers requests; this file
// says what the service is; both the entrypoint and the tests read it
// from here.
// ═══════════════════════════════════════════════════════════════════

/** Bumped with every change to this Worker's law, and answered by
 *  /v1/health - the same discipline RELAY_VERSION keeps, for the same
 *  reason: a deploy that did not happen looks exactly like one that
 *  did. Kept in step with ACCOUNT_VERSION in wrangler.toml, which
 *  test/accountworker.test.js holds. */
export const ACCOUNT_VERSION = 'acct37';   // acct37: PINE-SHARE (2026-09-30, Mac: "2 in 5 trees Pine") - the tree law the service recomputes each felling from (src/net/nodeLaw.js tree): a forest whose own woods hold no tier-1 wood (Woodlands, Haunted Woodlands, Swamp, Rainforest, Subtropical) stands PINE_SHARE (2 in 5) of its trees as Pine, on any ground, so a Novice logger can chop in every forest; no migration, no route changed, a node's key unchanged (felled trees stay felled). Before it, acct36: the PROF7 branch merged onto main (2026-09-30, Mac: "Get ready to merge") - main shipped acct33 (FIELD BUGS 2026-09-30) while the branch built acct33-acct35 (PROF7, AUDIT 32, AUDIT 32 S1) undeployed, so the joined service goes past both; the branch's one migration, 0036_hunting, already runs after main's 0035 and none is renumbered. MAIN'S: acct33: FIELD BUGS 2026-09-30 - HOME-CROSSED (Seanobi's "Sold House for 600 K, Got Nothing Back": a realm character's home customs carried in, which no record paid for, is refused its sale, `home-crossed` 409, where it was sold for its deed share of nothing and deleted; the town's answer marks my own such house `crossed`), GUILD-LETTER (a guild withdrawal the pack cannot carry is paid as a letter of credit on the record, `letter: true`) and CUSTOMS-ELSEWHERE (Dwarfblood's "I did go online with this one in an older build": a character the census counted on another account is refused `customs-other-account` 403, not "no record").THE BRANCH'S (never deployed): acct35: AUDIT 32 S1 (2026-09-30, Mac: "Whatever you think is best") - a recipe made wholly of goods only a counter sells (the Weavers' Linen and Wool, never gathered - recipeLaw firstCraftPays) earns its craft's XP and no first-craft bonus: 152 recipes of it bought a fresh character Outfitting 87 for 811 Marks and no hide. Before it, acct34: AUDIT 32 (2026-09-30, Mac: "Audit this") - PROF7 audited: Hunting's day counts hides (a clean pelt's second among them), the last skinning cut to the day's room; a body's foe refused before the hour's acts, its ground never read nor witnessed; a second find kept where one of it fits; a weave's answer names no track. Before it, acct33: PROF7 (2026-09-29, Mac: "Do it") - Hunting, the Skinning Knife and Outfitting: migration 0036 (the day's harvests take a body's hide, the tier it was decided at and its second find's count; a craft's and a piece's dye), a body's harvest (`body:<day>:<id>` and the foe the client names - Hunting bounded, not witnessed: 30 hides an account a day, 3 of them of tiers 5-6, decided in the harvest's own INSERT), the loom's cures and weave on /v1/prof/smelt (a Tanner's at 50), Outfitting's recipes and a garment's dye on /v1/prof/craft (signed into the piece's record, `u`), the market's pieces with their dye, the state's hides today. Before it, acct32: PROF-DELETE (2026-09-29, Mac's choice: "Goes with it; wait on trades") - a realm character deleted takes its Stores and its professions' tracks with it, and is refused 'realm-market-open' (409) while it has market business open (realm.js REALM_MARKET_OPEN_SQL). Before it, acct31: RENOWN-CHAR (2026-09-29, Mac: "Can we make renown per character again") - Renown a track a CHARACTER again (renownTracks.js; the report, the mint's `lv`, the raid claim, the guild founding's gate, a Court writ's delivery and /v1/account's `renown` list are each a character's), the hour's bound still the account's and every source still at three quarters; migration 0035 gives each track back what it held plus everything the account earned while Renown was the account's (Mac's choice, "Own + recent gains"), and a realm character with no track those gains alone; `renown_accounts` stays as history. Before it, acct30: MERGE 2 (2026-09-29, Mac: "Merge and markdown notes") of main's realm with the professions branch - main shipped acct19-acct23 (THE MERGE's REALM and RENOWN-ACCOUNT, TERMS1, PENITENT, REALM-DOOR and CUSTOMS-PASS, HOUSE-LOSS and RESTORE) while the branch built acct22-acct29 (the MERGE of main's raids to AUDIT 31) undeployed; the branch's migrations are renumbered 0025-0034 behind main's 0018-0024 (realm_characters, realm_trades, realm_audit, renown_account, customs_carry, terms, customs_passes): D1 applies by name in order, and none of the ten was ever applied anywhere. MAIN'S: acct23: HOUSE-LOSS (2026-09-29, Mac: "GarySoup lost his house and furniture") - a customs whose first save never landed is undone by its delete, never a delete of what it carried, and a customs pass it spent comes back with it (realm.js undoCustoms), and the door's own `/v1/realm/undo` (undoRealm); and RESTORE (Mac: "I want people to get their stuff back") - the join names a customs character's offline id (joinRealm `origin`) and the service can be held for maintenance (MAINTENANCE, `maintaining`) while the history restore reads the past. (acct20, then acct21 and acct22, on its branch, never deployed - renumbered past main's TERMS1, PENITENT and REALM-DOOR at the merges. Its CUSTOMS-GRANT - Mac: "Please activate ToxicTaco69 character for online mode", a config list letting one such character in, and its `customs_grants` migration - was retired at the last for main's CUSTOMS-PASS, which does the same by Mac's own choice, "Staff customs pass".) Before it, acct22: REALM-DOOR and CUSTOMS-PASS (2026-09-29, the field: Gryphoth's character, made and played online on a build from before the realm after the census froze, could not come in) - every identity token says whether the character its mint names is one of the account's realm characters (`rc`, realm.js realmCharacterHeld), which the relay's door reads (world130); and `/v1/mod/customs-pass` (Mac: 'Staff customs pass'): a developer grants one account one open pass, which customs spends on the next character its census does not count and no account has brought in (realm.js grantCustomsPass, customsRealm; migration 0024). (acct21 on its branch, renumbered past main's PENITENT at the merge.) Before it, acct21: PENITENT's title and glyph (2026-09-29, Mac: "This new custom title/glyph is for the user Diggleborf" - Diggleborf's own, off PENITENT_HANDLES) and a fifth Disciple ("Add valenvalarys as a disciple ingame"); acct20: TERMS1 (2026-09-28, "reviewed and checked off by players before creating an account") - the guest and register routes refuse a request that has not ticked the current Terms of Service and Privacy Policy (accounts.js legalRefusal, src/net/legalLaw.js), and the row records the versions and when (migration 0023) (acct17, then acct19, on its branch, never deployed; renumbered past main's RAID4 (acct17) and AUDIT RAID (acct18), then THE MERGE's REALM and RENOWN-ACCOUNT (acct19, migrations 0018-0021), at the merges; its migration 0016, then 0018, then 0022 on its branch, and 0023 past main's CUSTOMS-CARRY (0022, rows only - acct19 still) at the merge with #428-#432). Before it, acct19: THE MERGE (2026-09-28, REALM onto main): main's RAID4 and AUDIT RAID took acct17 and acct18, so REALM's acct17 (never deployed) is acct19, and its migrations 0016-0018 are 0018-0020, after the raids'. RENOWN-ACCOUNT rides the same undeployed acct19 (2026-09-28, Mac: "can you make sure renown is account based and not character based?" and "reducing the accumulation of renown from resources a bit"): Renown one track an ACCOUNT (renownTracks.js, migration 0021 - each account at its best character's total), every source at three quarters and the hour's bound 15,000 (src/net/renown.js). REALM's, as its branch said it: REALM P1 (2026-09-28, Mac: "A true separation while allowing people to still play offline") - the realm's characters (realm.js, migration 0018 (0016 on its branch)): an online character's save held here under a lease and a sequence; and REALM P2.1 in the same deploy (Mac: "eliminate duping") - a trade between two realm characters settled here, both records at once (realmTrade.js, migration 0019 (0017 on its branch)), every write of a realm character a new object. Before it, THE BRANCH'S (its migrations named by their new numbers): acct29: AUDIT 31 (2026-09-29, Mac: "let's first do a comprehensive audit and ensure everything so far is perfect") - an auction whose leading bid is gone closes unsold, a won one its seller's cap holds void after seven days, a bid overtaken its own word, the thirty the auctions that stand; a guild's Officers and Guildmaster deliver to none of its writs, any member takes back their own deposit, a writ posted only with the guild Stores' room for it, the twenties the writs and commissions that stand, nothing unmakeable commissioned, a commission's fill says why a piece is held and the Work read names the pieces that would fill it, a memberless guild keeping anything never reclaimed; before it acct28: PROF6 (2026-09-29, Mac: "continue") - guild writs, the guild Stores and commissions: migration 0034 (a guild's writs and their deliveries, the Officers' writ budgets, the guild Stores with their ledger and moves, commissions, the note's fourth button), the /v1/writs/* and /v1/stores/guild* routes (writs.js), a guild keeping its Stores or a writ refused its going, the weekly report's escrow off the ledger's escrow end; before it acct27: PROF5b (2026-09-29, Mac: "Go") - timed auctions for Masterworks: migration 0033 (the auctions, the bids, the auction reports), the auction and bid routes, the auctions closed on any read; before it acct26: AUDIT 30 (2026-09-29, Mac: "Do it") - the market's and the stock's ledger lines their own (a plain INSERT under a suffixed rid, a spent rid refused), the tax on a listing's running total, a piece listed only as minted and never twice; before it acct25: PROF5 (2026-09-29, Mac: "Continue") - the market: migration 0032 (listings, sales and their couriers, deliveries, buy orders and fills, the prices' history, reports; the ledger's `escrow` end, the witness's `hub` kind, the products' owner kept past its account), /v1/market/* (market.js), the Weavers' counter on the stock route, the weekly report's medians. Before it, acct24: PROF4 (2026-09-28, Mac: "Continue") - Logging, Carpentry and the furniture: migration 0031 (the day's harvests take a tree's logs and a second find, its Resin; a craft's Heartwood; a piece's mark), a tree's harvest (the Wood-Axe's Clean Cuts bounded; Resin, and Heartwood on confirmed ground), the forge's burns and the workbench's saws on /v1/prof/smelt, the workbench's recipes on /v1/prof/craft (the recipe names its profession; a Heartwood for a plank, a Joiner's half the planks, a Master Joiner's mark; the Ram Kit refused, `prof-later`), the furnisher's Linen on /v1/prof/stock, and a crafted piece's mark written into a home's set-down piece from its own `products` row (decor.js). Before it, acct23: PROF3 (2026-09-28, Mac: "Lets keep moving") - Smithing: migration 0030 (`prof_crafts`, a craft's row; `products`, every crafted piece's provenance id, owner and signed record; `prof_stock`, a purchase from the smith's stock), /v1/prof/craft (the anvil: the recipe law, the quality the service rolls, the pieces and their records, the Smithing XP) and /v1/prof/stock (the fittings no profession yields yet, bought into the Stores for Marks - a `stock` line); the Stores withdraw none of the stock (their templates are their professions'); a Quartermaster's smelt yields two ingots a unit. Before it, acct22: the MERGE (2026-09-28, Mac: "Lets keep moving") of main's raids with the professions branch - main shipped acct17-acct18 (RAID4, AUDIT RAID) while the branch built acct17-acct21 (MARKS1 to AUDIT 29) undeployed; its migrations were renumbered 0025-0029 behind main's 0016-0017 (raid_cleanses, raid_spoils), as WB5b's was behind RENOWN1's. MAIN'S: acct18: AUDIT RAID (2026-09-28, Mac: "1. Audit this properly 2. Ensure online functionality is perfect") - `/v1/raid/claim` writes a town's thanks row once a (raid, account), a guest's too, keyed to the device's claim id (`cid`, migration 0017), and answers `spoils` to the claim whose row it is (a second browser rolled the thanks again); a raid's Renown is charged to the account's hour, as a report's is (six forged raids a game day were half the hour's bound again). Before it, acct17: RAID4 (2026-09-28, Mac on World Events - Raiding Parties online: "3. We can also add renown and it's own atheric + armor sets") - `/v1/raid/claim`: a raid's receipt the relay signed (src/net/raidReceipt.js), counted once a (raid, account) and at most RAID_CLAIMS_DAY_MAX a game day, paid to the character that fought it in Renown (renownRaidXp, outside the hour's bound) in one transaction (migration 0016, raids.js); `/v1/account` and the Inspect record carry `raids: { defended }`. Before it, THE BRANCH'S (renumbered migrations named by their new numbers): acct21: AUDIT 29 (2026-09-28, Mac: "Lets audit everything so far before we continue") - migration 0029 (a dungeon nobody vouched for marked on the day's harvests; `prof_choices`, a free first specialisation's row); a node read in its one spelling, the day's harvests bounded an account too, four veins a day from unconfirmed dungeons, a dissent on confirmed ground written down, a signature's own slot, the XP answered as credited, a paid change of specialisation its own track's and asked as the client saw it, a writ one filled oneself answered as one's own. acct20: PROF2 (2026-09-28, Mac: "Go") - Mining and Quarrying: migration 0028 (the day's harvests take a vein's ore, a boulder's stone and a gem; the witnessed world takes a dungeon; a smelt's row), the vein, boulder and dungeon-vein harvests, the witnessed dungeon, /v1/prof/smelt. Before it, acct19: PROF1 (2026-09-28, Mac: "Begin!") - the professions: migration 0027 (tracks, the Stores, the day's harvests, withdrawals, the witnessed pixel, Court writs), professions.js, the /v1/prof/*, /v1/stores/* and /v1/writs/* routes, PROFESSIONS_OPEN; a Court writ's pay the second faucet. Before it, acct18: NOTICE1 (2026-09-28, Mac: "The new notice board should be a physical object that houses quests, the player auction house, etc") - the Notice Board: migration 0026 (a town's notes, their reports, the server's notices), board.js, the /v1/board/* routes, BOARD_OPEN. Before it, acct17: MARKS1 (2026-09-28, Mac: "New currency") - Marks, the server's currency: migration 0025 (the balances, a guild's Marks treasury, the one ledger that moves them), marks.js, the /v1/marks/* routes, the gate receipt's Marks, the account view's balance, a disband refused while the Marks treasury holds any, MARKS_OPEN. Before it, acct16: HOME-STATIONS (2026-09-27, Tabitha on Discord: "CRAFTABLE / PURCHASABLE CRAFT / GUILD STATIONS") - a home's placed piece keeps the craft it serves (the place's `station`, net/decorLaw.js decorPlaceOf; decor.js placeJson). (acct15 on its branch, never deployed; renumbered past main's FOUNDER3 (acct15) at the merge). Before it, acct15: FOUNDER3's Founder read off when the account first played (`created_at`), not when it registered; acct14: SHADOW-FANG's title and glyph (SirMcMobdon's, off SHADOW_FANG_HANDLES) (acct12 on its branch, never deployed; renumbered past main's acct12 and acct13 at the merge); acct13: RENOWN4's track total in the mint's answer, GUILD1c's guild on the token (the mint's `gi`/`gt`/`gm` and its answer's tag - signed only for a mint that asks, AUDIT MERGE-PLUS A6) and the guild acts' signed orders (one deploy; acct11, then acct12, on their branch - main's WB5b took acct11 first and BASE-HIDE acct12); acct12: BASE-HIDE's taken-out furniture (migration 0015); acct11: WB5b's gates closed (the kill receipt's claim; acct10 on its branch - RENOWN1, HOME1, DECOR1 and GUILD1 took acct10 first); acct10: RENOWN1's Renown, HOME1's online homes, DECOR1's decor and GUILD1's guilds (all unshipped, one deploy; acct9 on the branch - FOUNDER2 took acct9 first); acct8: DUEL1's duelling record; acct3: ACC3's titles and glyphs; acct4: ACC4's time played; acct5: MOD1's moderation; acct6: MAIL1's letters; acct7: TITLE-N's Dungeon Master and Patreon tiers; acct9: FOUNDER2's cutoff at 2026-09-25 (acct8 on its branch; DUEL1 took acct8 first)

/** A body bigger than this is not a request this service has. Read
 *  BEFORE the JSON is parsed, so a megabyte of nothing costs nothing. */
export const MAX_BODY_BYTES = 4 * 1024;

/** ═══ ACC2: THE SAVE ROUTES, AND WHY THEY ARE NOT IN `ROUTES` ══════
 *
 * Every route above is a fixed string, so a Set answers "does this
 * exist?". A save route carries the character and the slot in the path,
 * so it needs a match rather than a lookup - and the match lives here,
 * pure, beside the Set, because `index.js` asks BOTH before it decides
 * a path is a 404.
 *
 * `/v1/saves/<characterId>/<saveName>[/data|/shot]`, with both segments
 * percent-encoded by the caller: a save name is the player's own words
 * ("before the lich"), so it may hold a space, a slash or a hash, and
 * pasting it into a path unencoded is how one slot comes to address
 * another.
 *
 * It returns null for anything it is not sure of. A name that decodes
 * to nothing, one past SAVE_NAME_MAX, an id that is not id-shaped and a
 * tail that is not one of the two known parts are all "no such route"
 * rather than a request this service half-understands.
 */
export const SAVE_NAME_MAX = 64;
/** Both shapes `systems/characterId.js` mints - a `crypto.randomUUID()`
 *  where the runtime has one, and `<base36 stamp>-<10 random>` on an old
 *  WebView where it does not. A pin drives that minter and asserts every
 *  id it produces passes this. DELIBERATELY NOT `net/wire.js` ID_RE:
 *  that is the shape of a PEER id, which is a different thing that
 *  happens to look similar, and reusing it would tie a save's filing to
 *  a bound the online arc is free to move. */
export const CHAR_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
export const SAVE_PARTS = Object.freeze(['data', 'shot']);

export function savePathOf(path) {
  if (typeof path !== 'string' || !path.startsWith('/v1/saves/')) return null;
  const rest = path.slice('/v1/saves/'.length);
  if (!rest) return null;
  const seg = rest.split('/');
  if (seg.length < 2 || seg.length > 3) return null;
  const part = seg.length === 3 ? seg[2] : null;
  if (part !== null && !SAVE_PARTS.includes(part)) return null;
  let characterId, saveName;
  try { characterId = decodeURIComponent(seg[0]); saveName = decodeURIComponent(seg[1]); }
  catch { return null; }   // a malformed escape is not a slot
  if (!CHAR_ID_RE.test(characterId)) return null;
  // A NAME IS BOUNDED AND PRINTABLE. The store's own cards carry
  // whatever the player typed, and this is the one door where that
  // string becomes part of a key somebody else's row also lives under.
  if (!saveName || saveName.length > SAVE_NAME_MAX || /[\u0000-\u001f\u007f]/.test(saveName)) return null;
  return { characterId, saveName, part };
}

/** The R2 key. PLAYER FIRST, so "everything this account holds" is a
 *  prefix walk rather than a join against D1 - which is what makes a
 *  deleted account cleanable at all. Every segment is encoded, for the
 *  reason `savePathOf` decodes: a save name is player-typed. */
export const savePrefix = (playerId) => `saves/${encodeURIComponent(playerId)}/`;
export const saveKey = (playerId, characterId, saveName, part) =>
  `${savePrefix(playerId)}${encodeURIComponent(characterId)}/${encodeURIComponent(saveName)}/${part}`;

/** THE BOUNDS. `MAX_BODY_BYTES` above is 4 KiB and is right for every
 *  JSON route this service has; a save is hundreds of kilobytes, so the
 *  blob routes read a RAW body against these instead. Named here rather
 *  than written into the ladder, because a bound nobody can find is a
 *  bound somebody raises by accident. */
export const SAVE_MAX_BYTES = 4 * 1024 * 1024;

/** RESTORE (2026-09-29): the switch the history restore throws for its minute - MAINTENANCE = "1", a var only its own
 *  deploy sets (.github/workflows/realm-restore.yml); every call but /v1/health and /v1/pubkey is then refused 503. */
export const maintaining = (/** @type {any} */ env) => env?.MAINTENANCE === '1';
export const SHOT_MAX_BYTES = 256 * 1024;
/** Slots per ACCOUNT. An account at this bound is refused; its oldest
 *  slot is never taken to make room, because this is a BACKUP and a
 *  backup that deletes things to make room is not one. */
export const SAVES_MAX = 60;

/** Every path this service serves. Named once, so the 404 and the
 *  ladder cannot come to disagree about what exists. */
export const ROUTES = new Set([
  '/v1/health', '/v1/pubkey', '/v1/auth/guest', '/v1/auth/token', '/v1/auth/session',
  '/v1/account', '/v1/auth/logout',
  // ACC1c: username and password. `register` needs a session (it
  // upgrades the guest row that session belongs to); `login` and
  // `recover` are the two that do NOT, because a player standing at
  // them has no session yet - which is exactly why they are the two
  // that are throttled.
  '/v1/auth/register', '/v1/auth/login', '/v1/auth/recover',
  '/v1/account/password', '/v1/account/email',
  // ACC3: the one WRITE in the wardrobe. Holding a title is derived
  // and nothing can equip a glyph, so this is the only thing about
  // either that a player chooses - and so the only route.
  '/v1/account/title',
  // ACC4: the beat that counts time played. It writes, and it is the
  // service's clock that decides how much - the body is never read.
  '/v1/account/played',
  // MOD1: the one moderation route. Behind a session like every other,
  // and it refuses anybody the service's own lists do not name.
  '/v1/mod/mute',
  // CUSTOMS-PASS: a developer grants one account one character through
  // customs - the same wall, the developers' list alone.
  '/v1/mod/customs-pass',
  // ACC2: the LISTING is a fixed path; every other save route carries
  // the slot in it and is matched by `savePathOf`.
  '/v1/saves',
  // MAIL1: letters to a registered player, kept until their reader
  // throws them away. The box is a GET; the three that change something
  // are POSTs, each naming the letter in its body - never in the path,
  // so an id is never a URL a log keeps.
  '/v1/mail/inbox', '/v1/mail/send', '/v1/mail/read', '/v1/mail/delete',
  // DUEL1: the duelling record - the loser's own report, and any
  // account's two counts for the Inspect card. Both behind a session.
  '/v1/duel/loss', '/v1/duel/record',
  // RENOWN1: Renown - what one of the caller's characters earned
  // online (the account's for a day under RENOWN-ACCOUNT; the
  // character's again since RENOWN-CHAR). Behind a session; the level
  // itself rides the token.
  '/v1/renown/xp',
  // HOME1: the online homes - one owner a building (homes.js). A town's
  // homes are read by every session, a guest's too (the doors say whose
  // a home is to everyone); the three that change one are an account's.
  '/v1/homes/town', '/v1/homes/mine', '/v1/homes/claim', '/v1/homes/release', '/v1/homes/entry',
  // DECOR1: an online home's decor (decor.js). Its pieces are read by every session (the room is the same room to
  // every visitor); the three that change one are its owner's.
  '/v1/homes/decor', '/v1/homes/decor/place', '/v1/homes/decor/move', '/v1/homes/decor/remove',
  // BASE-HIDE: what the owner took out of the room's own furniture - read with the pieces, written by the owner
  '/v1/homes/decor/hidden',
  // GUILD1: the guilds (guilds.js) - a character's own guild and the account's invitations read by any session (a
  // guest's reads nothing); the rest change one, an account's alone.
  '/v1/guilds/mine', '/v1/guilds/invites', '/v1/guilds/found', '/v1/guilds/invite', '/v1/guilds/answer', '/v1/guilds/leave',
  '/v1/guilds/remove', '/v1/guilds/rank', '/v1/guilds/ranks', '/v1/guilds/deposit', '/v1/guilds/withdraw', '/v1/guilds/handover',
  '/v1/guilds/disband',
  // WB5b: the gates closed - the kill receipt the relay signed, carried
  // here by the account it names. Behind a session.
  '/v1/gate/claim',
  // RAID4: the towns defended - a raid's receipt the relay signed, carried
  // here by the account it names with the character that fought it.
  '/v1/raid/claim',
  // MARKS1: Marks (marks.js) - an account's balance, the Bank's exchange (Marks for gold, never the other way), a
  // guild's Marks treasury, and the developers' weekly report. Every one behind a session, an account's alone.
  '/v1/marks/balance', '/v1/marks/exchange', '/v1/marks/guild/deposit', '/v1/marks/guild/withdraw', '/v1/marks/report',
  '/v1/board/read', '/v1/board/pin', '/v1/board/take-down', '/v1/board/report', '/v1/board/mod/remove', '/v1/board/mod/restore',
  '/v1/board/notice', '/v1/board/notice/remove',
  // PROF1: the professions (professions.js) - a character's tracks, Stores and day, the witnessed pixels, a harvest,
  // a specialisation, a withdrawal to the pack, a region's Court writs and a delivery. Every one behind a session, a
  // registered account's alone, and PROFESSIONS_OPEN's.
  '/v1/prof/state', '/v1/prof/pixels', '/v1/prof/harvest', '/v1/prof/spec', '/v1/prof/smelt', '/v1/prof/craft', '/v1/prof/stock', '/v1/stores/withdraw', '/v1/writs/list', '/v1/writs/deliver',
  // PROF6: guild writs (posted, supplied, withdrawn, the Officers' budget), commissions (posted, fulfilled, cancelled,
  // declined) and the guild Stores (read, deposit, withdraw) - writs.js; behind a session, a registered account's alone.
  '/v1/writs/post', '/v1/writs/supply', '/v1/writs/withdraw', '/v1/writs/budget', '/v1/writs/commission', '/v1/writs/fulfil',
  '/v1/writs/cancel', '/v1/writs/decline', '/v1/stores/guild', '/v1/stores/guild-deposit', '/v1/stores/guild-withdraw',
  // PROF5: the market (market.js) - the Market tab's views, a listing, a purchase, a cancel, a buy order, a fill, an
  // order withdrawn, a piece collected, a report and a moderator's removal. Every one behind a session, a registered
  // account's alone, and the board's, the professions' and the Marks' switches together. PROF5b: an auction posted, a bid.
  '/v1/market/read', '/v1/market/list', '/v1/market/buy', '/v1/market/cancel', '/v1/market/order', '/v1/market/fill',
  '/v1/market/unorder', '/v1/market/collect', '/v1/market/report', '/v1/market/remove', '/v1/market/auction', '/v1/market/bid',
  // REALM P1: the realm's characters (realm.js). The listing and the five that change one; the save itself rides a
  // path that names the character, matched by `realmPathOf`.
  '/v1/realm', '/v1/realm/create', '/v1/realm/customs', '/v1/realm/join', '/v1/realm/leave', '/v1/realm/delete',
  // REALM P2.1: a trade's half (realmTrade.js) - settled here, both records at once or neither.
  '/v1/realm/trade',
  // HOUSE-LOSS: the door's undo of a customs whose first save never landed (realm.js undoRealm) - its own path, so a
  // door newer than this service is told `not-found`, never handed a delete.
  '/v1/realm/undo',
]);

/** REALM P1: `/v1/realm/<id>/data` - a realm character's save, PUT as a checkpoint and GET for a join's load or a copy
 *  to offline. The id is the service's own shape (realm.js REALM_ID_RE); anything else is no route. */
export function realmPathOf(path) {
  const m = typeof path === 'string' ? /^\/v1\/realm\/(r[0-9a-f]{20})\/data$/.exec(path) : null;
  return m ? { id: m[1] } : null;
}

/** The routes a caller reaches WITHOUT a credential. Everything else
 *  resolves a session first. Named rather than special-cased inside the
 *  ladder, so "what can a stranger reach?" has one answer. */
export const OPEN_ROUTES = new Set(['/v1/health', '/v1/auth/guest', '/v1/auth/login', '/v1/auth/recover']);
