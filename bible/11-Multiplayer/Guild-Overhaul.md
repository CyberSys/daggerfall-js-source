# THE GUILD PAGE'S OVERHAUL - a new name, the vault, the arms, the pages (GUILD2, 2026-10-03)

The port's own (DFU's guilds are its factions; a player's guild is GUILD1's, `06-Systems/Online-Arc.md` GUILD1 to
GUILD1e). Four parts: **GUILD2a** a new name for a price, **GUILD2b** the guild's vault and who may use it, **GUILD2c**
arms worth choosing that every banner draws, and **GUILD2d** the Guild tab in pages. The laws are
`src/net/guildLaw.js`, `src/net/guildVaultLaw.js` and `src/net/heraldryLaw.js`; the service is
`server-account/src/guilds.js` and `server-account/src/guildVault.js` (migration `0074_guild_overhaul.sql`); the client
`src/net/guildBook.js`, `src/ui/socialPanel.js` and `src/ui/heraldryArt.js`.

## Asked

Mac: "Also the guild page needs an overhaul. A way to change your guild name for a price, guild item storage with the
leader able to grant and revoke perms, a proper choosable insignia that also plays with guild banners, etc" - "This is
something I really want you be detailed on and focus."

## GUILD2a - a new name, for a price

- **The guildmaster's alone** (`GUILD_POWERS.rename`): a new name, a new tag, or both, in the founding's shapes (3 to 32
  plain words; 2 to 4 capitals or digits) and free of every other guild's - a guild nobody is left in gives its own up,
  as at a founding.
- **25,000 gold** (`GUILD_RENAME_GOLD`, two and a half foundings) **from the treasury** - from the gold realm characters
  put in (`realm_gold`, the part a hall is bought with: HALL-GOLD), so no bank's word buys it. A sink a guild chooses
  (Economy-Arc: "a sink that scales with wealth is a prestige one a player chooses").
- **A fortnight between** (`GUILD_RENAME_COOLDOWN_S`), so a name is not a costume changed by the hour; the page says
  when the next may come. **Never in a week the guild fights for a seat** (heraldry's own rule, AUDIT-SEATS S10: its
  banners are on the field).
- **One batch**: the row renamed and paid only where every one of those still holds; the treasury's line the ledger
  trigger's (`moved_kind` 'rename'); the rename written down (`guild_renames`: the names it left and took, who, the
  cost); the hall's owner name with it. The answer carries the guildmaster's badge with the new tag, signed into
  GUILD1c's order, so the rooms say it at once. The old name is free for anyone at once.
- **The name filter, at last.** Seats-Arc 18 said a guild's name and tag "pass the name filter they already pass" -
  and neither ever had: only the chat called it. A founding and a rename both pass it now (`guildWordsOk`): the name,
  the tag, and EACH WORD of the name on its own - the filter is a handle's and reads a name run together, so "Server
  Admins" and "Moderator Guild" passed it whole (`guild-name-word`).
- The Settings page: the name and tag fields start at the ones that stand; **Rename** arms, and the second press -
  "Sure? 25,000 gold" - pays. It waits, and says why: already the guild's, not yet (the fortnight), the realm's gold
  short.

## GUILD2b - the vault, and who may use it

- **A shelf of items**, a slot each: **50**, and **50 more while the guild holds a hall** (its cupboards, Seats-Arc
  8.2). A piece is its record exactly as it left its depositor's realm record - every field, its stack - with its
  depositor's name and when.
- **A realm character's**, as a trade is: a piece put in leaves the record and enters the vault in ONE batch on the
  service (`prepareRealmRecord` with the trade's own `takeTradeGoods`); a piece taken out enters the taker's record in
  one batch with the slot emptied (`giveTradeGoods`). The client checkpoints and holds the save (`realmGoldAct`), takes
  the piece out of the pack at once, and gives it back on a refusal. Only what may leave a pack goes in: never a worn,
  quest, summoned or bound piece, gold, a boat's, or the Materials Bag (`06-Systems/Materials-Bag.md`).
- **Two deposits racing for one slot** write one and refuse the other whole (the slot is the primary key). A piece
  taken is the one the taker saw: the slot AND the time it was put there, so a slot emptied and filled again is never
  the one taken.
- **Who may use it - the leader's word.** Each rank stands at a default (`VAULT_RANK_DEFAULTS`): Officers take out, ten
  pieces a UTC day; Members and Recruits put in. The guildmaster **grants and revokes** per member on the Members page:
  no access, puts in, or takes out with a limit a day (1, 3, 5, 10, 25 or any number) - or "as their rank", the grant
  revoked. The guildmaster always takes out, unlimited; a grant on that row is never read. The day's count is the
  service's, counted in the take's own batch, so two takes racing at the limit cannot both land.
- **Reached in a town**, as the Stores are (`06-Systems/Materials-Bag.md` section 4): read anywhere; put in and taken
  out in town. **The hall's chest IS the vault**: pressing it opens the Guild tab at the Vault page (the guild Stores a
  page beside it).
- **Every piece in or out is a line** (`guild_vault_log`), the latest forty on the page.
- **A guild holding pieces does not go**: the guildmaster empties the vault before disbanding (`guild-vault`), as the
  treasury and the hall are emptied first.

## GUILD2c - the arms

- **Forty devices**: GUILD1d's twenty-four, then sixteen of the guilds' own trades and creeds - skull, key, anchor,
  ship, horse, spider, hand, flame, scales, book, chalice, dagger, owl, bat, crossed swords, anvil (the port's own art,
  `ui/heraldryArt.js`, law 6's one committed art).
- **A divided field**: plain (GUILD1d's every banner), per pale, per fess, per bend, per bend sinister, quarterly, per
  chevron, per saltire - a divided field's second colour any but Ash and the field's.
- **The device's own colour** (`charge`): the border's by default, or any other - never a colour of the field it lies
  on.
- **Arms that carry neither are exactly GUILD1d's three keys**: every stored heraldry, banner and pin unmoved; a
  street banner of plain arms keeps its texture's key (`heraldryKey`), so nothing cached is drawn again.
- **Every face draws them**: the hall's two banners and the seats' (`render/bannerPass.js` through `drawBanner`), the
  shield on the tag's frame, the siege HUD and the Chronicle (`shieldSvg`), the Guild tab's header. The words say them:
  "Per pale Azure and Crimson, bordered Gold, an Owl Argent".
- **The Arms page** shows the banner, the shield and the tag as they will stand, and the choices as the things
  themselves - the divisions a tile each drawn in the draft's own colours, the colours swatches (the ones the law
  refuses shut), the devices a tile of forty - drawn again in place at each pick with the keyboard's focus kept on the
  pick. The price is GUILD1d's: the first raising free, a change 500 Drakes from the silver treasury.

## GUILD2d - the tab in pages

GUILD1b's tab was one scroll - roster, invites, two treasuries and their ledgers, the hall, the heraldry, the guild
Stores, the rank names and leaving, every section under the one before. It is pages now, under the guild's own header
(its banner, its name and tag, the reader's rank and the treasury, the members and the vault's count):

| Page | What it holds |
|---|---|
| Overview | the arms in words, where the reader stands at the vault, the hall |
| Members | the roster and what the reader's rank may do to each; the guildmaster's grants; invitations |
| Treasury | the gold and its ledger, the silver and its lines |
| Vault | the pieces, Take and Take one, Put in from the pack, the lines |
| Stores | the guild Stores and the writ budget - where the professions are this account's |
| Arms | the arms, and the guildmaster's choosing |
| Settings | a new name, the rank names, leaving and disbanding |

Each page keeps every control and sentence the section it took over had, so a refusal still says its reason beside its
button. `openGuild(page)` opens the tab at a page (the hall's chest: the Vault).

## The threats, and the answers

| Threat | Answer |
|---|---|
| A save-edited piece laundered through the vault | Only what the realm record holds goes in, by the trade's own law, in the record's own batch |
| A piece duplicated by two takes | The slot is emptied, and the record written, in one batch guarded by the slot's time and count |
| An officer drains the vault | Ten pieces a day by default; the guildmaster limits or revokes |
| A name that reads as a slur or as the server's | The name filter, word by word, at a founding and a rename |
| A name changed to dodge a siege's record | Refused in a week the guild fights for a seat; a fortnight between renames |

## Pins

`test/guild2_service.test.js` (the service, through the real Worker) and `test/guild2_client.test.js` (the laws, the
art, the book, the door, the pages); `tools/mutants/guild2.json`.
