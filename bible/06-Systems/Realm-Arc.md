# THE REALM: online characters, the economy and balance (REALM)

Mac, 2026-09-27, after EMPIRE-BANK: "I want to make sure players cant take an offline character and bring in massive
resources", then: "I wanna do this as comprehensively as possible. A true separation while allowing people to still
play offline. Honestly I also want to take into account of how we can balance the gold economy, eliminate duping,
eliminate true overpowered builds online, and overall bring the experience more in line with a balanced MMO".

**Status: PLAN, decisions 1-4 taken (2026-09-28).** Building begins with phase 0. Items still marked **OPEN** are Mac's call. The research behind it was
read on main at 6108d8bd. Code is cited by file and symbol, not line, so the page survives drift.

## What this supersedes, for online characters only

Offline play keeps every one of these decisions exactly as it stands.

- `Accounts-And-Cloud-Saves-Arc.md`: "THE LOCAL SAVE STAYS AUTHORITATIVE", and the service header
  `server-account/src/saves.js`: "THE CLOUD IS A BACKUP. THE LOCAL SAVE IS THE TRUTH". Online, the service holds
  the truth.
- `11-Multiplayer/Multiplayer.md`:
  - inventory and gold "never leaves their browser";
  - "There is no anti-cheat in v1 and no plan for one".
- `Online-Arc.md`'s opening line: "bring your own developed character into a massive server".
- Port-Ledger F304, where the URL power flags were left in ("DECIDED: leave them"). That holds offline; online
  refuses them.

## Where things stand

### The trust boundary

- **The Online door lists every local slot.** The pieces are `src/main.js` (the Online choice sets `load`, `online`
  and `loadkey`), `src/systems/saveSlots.js` `restorableSaves`, and `src/ui/enhancedMenu.js`.
  - `online` is only a URL flag (`src/systems/onlineLane.js` `isOnlinePage`).
  - The save is plain JSON with no signature or hash. Its only gate is `SAVE_VERSION` (`src/systems/save.js`).
- **Online progress writes into every slot of the character.** Closing an online tab saves them all
  (`world.js` `beforeunload` and `saveSlots.js`). The only thing held back is Renown's health and magicka layer.
- **Character ids are minted by the client** (`src/systems/characterId.js`). The service checks their shape only
  (`server-account/src/service.js` `CHAR_ID_RE`), so one character can sit on two accounts.
- **ONE-SEAT is per account, not per character** (`src/net/oneSeat.js`, and the hub's `cl` claim in `server/src/index.js`).
- **The hub has two identities:** a browser-minted social id for friends and parties, and the token's `sub` for
  seat, guild and Renown.
- **What the service holds:**
  - guild treasuries, on the client's word;
  - the homes registry, at a price the client names;
  - decor;
  - Renown tracks, bounded per account per hour;
  - gate kills, letters and duels.
  - Everything else is the save's. In the code's own words: "The gold is the save's, as all of it is" (`server-account/src/decor.js`) and "The GOLD is the client's" (`server-account/src/guilds.js`).
- **What the client is trusted with:**
  - PvE damage, up to 10,000 a blow (`dungeonContext.js`);
  - loot grants ("A forged item still lands, at its true price", `src/systems/loot.js`);
  - trade goods ("the price of having no server-side inventory", `src/net/tradeSession.js`);
  - Renown XP, within its caps;
  - guild deposits and home prices.
- **The relay checks shape and rate only.** It is authoritative for one thing: the gate boss (`src/net/gateBrain.js`).

### Duplication and rollback

Items have no unique ids: "the port's items have no UID" (`save.js`), and "the port's item IS its UID"
(`inventory.js`). Nothing on the service keeps a save's history: no sequence number, no watermark, no ledger.

1. **Give something away, then skip the exit save.** An exit save cannot fire in three cases, and there is no periodic
   online autosave:
   - a second tab takes the seat, and the old tab never saves (`seatOut`);
   - the player dies, and the tab closes on the death screen;
   - the page is killed (a phone gets no `beforeunload`).
   Load the older save and the goods are back.
2. **Bring back an older copy.**
   - An imported export zip adds a slot and never overwrites one (`saveTransfer.js`).
   - Downloading a cloud card has no age check (`cloudSaves.js`).
   - The exit save writes only the first of two twin slots.
3. **One character on two accounts.** Copy the save to a second browser or account. Nothing binds the character id.
4. **Trade.** An honest client fails toward loss, as `tradeSession.js`'s law says. A modified client can commit and
   keep its goods, because nothing checks that the sender removed them.
5. **Guild deposit.** The service never sees the purse. Roll back and deposit again, or deposit from a tab that lost
   the seat.
6. **Homes and guild founding.** The claim lands first and the purse pays after. Roll back, then sell for 85% of the
   client-named price. A guild founded this way is free.
7. **Decor and stations.** The service is written first and the client pays after. `moveDecor` rewrites `paid` and
   `station` on the client's word, and station fees never reach the service.
8. **Shared containers.**
   - Two players open the same chest: "both take it and both keep it" (`Online-Arc.md`).
   - A non-host takes, leaves, and re-enters before the host's 15-second publish.
   - The last close writes the whole list.
9. **Gate spoils.** The crash record hands the pieces back at every boot until a save of the character lands.

**Safe today:**
- decor made of the player's own items (`decorItems.js`);
- home storage and visitor drops;
- player corpses, private drops, wagons;
- quest items, which cannot be traded.

### The economy

**Sources:**
- **Corpse gold.** Unleveled Loot turns it from level-scaled to luck-scaled.
- **Pile gold.** Unleveled Loot's hook that divides pile gold by level is never called (`unleveledLoot.js`), so pile
  gold grows with level.
- **Hourly respawn, online only.** Dead layout foes and emptied piles come back after one real hour.
- **Loot rarity.** Forced on online. Luck adds 2 per mille over 50 to every threshold (`lootRarity.js`).
- **Quest gold.** At most about 7.5k. A shared quest pays every member their own roll (`questShare.js`).
- **Gate spoils.** Per account, per gate, and a gate comes every 2 real hours:
  - 250 × level × (0.8 to 1.2) in gold;
  - a Sigil Stone;
  - one Rare or Legendary piece and two Magic-or-better pieces;
  - a Regalia piece one time in six.
  Items plus the stone average about 27k at level 10 and 33k at level 30. The full payout goes to anyone who stands
  alive through half the fight (`gateSpoils.js`, `gateBrain.js`).
- **The Sigil Broker.** Six offers a day at 2, 3, 3 and 6 stones. The average item value is about 14.5k per stone. A
  stone sells to a shop for about 3.7k to 5.9k. A Regalia plate sells for 117k to 222k. "no server checks a sale"
  (`sigilBroker.js`).
- **Selling to shops.** DFU's formula verbatim (`shopStock.js`). A quality-1 shop pays more than it charges from
  Mercantile 2. Travel online is instant and free, so buying in one region and selling in another also pays.
- **Loans.** Each region lends separately (`banking.js` `borrowDecision`). A default costs a reputation drop in that
  region only (`settleOverdueLoan`), and there are up to 62 regions. Roleplay & Realism's `loanAmountPerLevel` stays
  the player's own setting online.

**Sinks:**
- **Mostly one-time:** stations at 50k, 100k and 200k; ships; houses; Daedra summoning.
- **Small and recurring:** training, repairs, identify.
- **None at all:** taxes, upkeep, and any cost for dying online. A dead player respawns at 50% health
  (`deathRespawn.js`). Prison serves no days online.

**Holes:**
- **Settings the player still controls online that change loot value.** The online lane forces only `Enabled` for
  most mods (`onlineLane.js`). The online-lane pin checks on/off switches only, so none of these are caught:
  - Unleveled Loot's material remaps: Iron → Daedric turns a 300-gold cuirass into a 153,600-gold one;
  - RRI's `conditionBasedPrices`;
  - Roleplay & Realism's `loanAmountPerLevel`.
- **Cheat flags work online.** `?shot` installs `window.__addGold`, and nothing refuses `?shot` online. `?fly`,
  `?nofoes`, `?tp` and `?timescale` also work online (F304).

### Power

- **Spell cost floor.** Cost is `trunc(gold × (110 − skill) / 400)` with a floor of 5 (`spellcost.js`), and skill
  values are never capped (`skills.js`). At 110 in a school, every spell in it costs 5 SP. Enhances Skill (+15, and
  it stacks), a skill affix (up to +30) and Mora's Mantle get a character there. Magnitude per level makes spells of
  2,000 to 3,000 points: damage, a Shield pool, or Regenerate per round.
- **Custom classes.**
  - Immunity costs 10 points for any element (`specialAdvantages.js`).
  - Disadvantages that cost a warrior nothing pay for six immunities plus Regenerate.
  - Attributes can be set freely within the 400 total.
  - Class files can be imported.
  - Nothing checks any of this online.
- **The item maker.** Side effects add budget at no gold cost (`enchanting.js`), and several never fire on worn gear:
  Weakens Armor (−700), Health Leech "whenever used" (−4,000). On top of that:
  - Daedric triples an item's power;
  - an item takes 10 enchantments;
  - Extra Spell Points stacks;
  - magic repairs are forced on online.
- **Stacking.**
  - Luck lifts every rarity threshold.
  - Affix bonuses sum with no cap (`entityMods.js`), and resistances that sum to 50 give immunity.
  - PCAAO critical hits scale with a skill that has no cap.
  - Backstab is certain at 100.
  - Set powers multiply on top (Nightfall +60% against an unaware target).
- **Online settings the player still controls.**
  - PCAAO's modules: `fixedStrengthDamageModifier` off doubles the strength bonus, and `fadingEnchantedItems` off
    stops enchanted gear breaking for good.
  - Oblivion leveling's settings: up to 40 attribute points a level.
- **Rest.** A rest online restores everything and runs a skill check in seconds. The shared clock runs at 12×, so the
  skill clock opens every 30 real minutes.
- **Already restricted:**
  - duels clamp stats, level and material and strip enchantments;
  - the gate boss has a damage budget;
  - party scaling;
  - clamps on spells cast on other players;
  - HOME-MAGIC;
  - Test Room characters are refused online.

## The design

### 1. Two lanes, two truths

- **OFFLINE characters** stay exactly as they are today. The local save is the truth, and every mod switch, URL flag,
  loan cap and console command belongs to the player.
- **ONLINE (realm) characters:**
  - They are born online, through the Online door's own character creation.
  - Their character id is minted by the service and bound to the account.
  - The service holds the truth: a `realm_characters` row (id, account, `seq`, lease, summary, flags) plus the save
    blob in R2, which the existing cloud-save store already holds.
  - The client keeps a working copy.
- **The doors:** the Online door lists realm characters only, and offline Load lists offline slots only.
- **Realm characters never load offline.** "Copy to offline" forks a snapshot into a new offline character with a new
  id. Nothing played on the copy ever comes back. **OPEN, decision 2.**
- **Offline to online:** **OPEN, decision 3.** Recommended: no ongoing import. There is a one-time migration at
  cutover for characters that have already played online, through customs (section 6).

### 2. The realm save protocol

- **Join.**
  - The service grants a lease on the character: ONE-SEAT, taken from the account to the character.
  - It returns the blob and `seq`. The blob always comes from the service, never from a local slot.
- **Checkpoint.** The client writes `{seq + 1, blob, summary}`:
  - every 2 real minutes;
  - before any hand-over (section 3);
  - on exit.
  The service takes a checkpoint only from the lease holder, and only at `seq + 1`. So these can never write again:
  - an old tab or a second device;
  - a restored backup, an import, or an edited copy.
  A copy of the blob is also worthless as a way in, because the Online door loads only from the service.
- **Crashes.** A crash loses at most two minutes of play, and never a hand-over, because every hand-over is settled on
  the service first.
- **Local slots never hold a realm character's truth.** A local copy is a cache under its own key, so offline Load
  never lists it.
- **The hub gets one identity per player.** Friends, parties, the seat and guilds all hang off the account.

### 3. Hand-overs become service transactions

- **Trade.** Escrowed on the service, or on a Durable Object per trade. Both offers are checked against both
  characters' last checkpoints. The swap is applied to both records at once, both `seq`s go up, and both clients
  load the result. This replaces the peer-to-peer commit, which can never be atomic.
- **Guild treasury.** One D1 transaction debits the character and credits the treasury. A withdrawal is the reverse.
- **Homes, decor, stations and guild founding.** The service debits the character's gold at claim time, at the
  service's own price.
- **Gate spoils and broker purchases.** The service grants them into the record, from the relay's signed receipt and
  its seed.
- **Shared containers.**
  - The room keeps a lock per container, and the second taker is refused.
  - Takes publish at once, which closes the leave-and-re-enter window.
  - A close writes only what was taken, not the whole list.

### 4. Validation at checkpoint: the budget model

The service reads the checkpoint's summary, spot-checks the blob, and refuses a checkpoint that breaks the law. The
last good checkpoint then stands, and the character is flagged for review.

- **Caps (section 5):**
  - attributes 100;
  - skills at the online cap, item bonuses included;
  - the online level cap (**OPEN**);
  - online class rules;
  - item values within their template for their material;
  - no forbidden items (Test Room or dev items);
  - enchantments within the online item-maker rules.
- **Budgets per hour of online play the service measured itself** (`accounts.js` already measures play time: "The
  client sends no number"):
  - gold plus item value gained, as a function of level;
  - XP;
  - Rare-or-better items.
  These follow the shape of Renown's `RENOWN_XP_HOUR_MAX`.
- **Item ids.** Valuable items get a service-issued id: Magic and above, artifacts, sigil stones and Regalia. The same
  id in two records freezes both for review.
- **Honest limit.** A modified client can still invent loot inside the budgets. The budgets bound it and the id
  ledger catches copies. Removing it entirely needs the service to roll the loot (phase 5), as the gate already does
  with its seeds.

### 5. Power rules online

These apply at online character creation and are enforced at checkpoint. The numbers are proposals.

- **Skills.** A hard cap of 100 for every use: spell cost, critical hits, backstab. Item bonuses count toward it.
- **Spell cost.** Never below 20% of the spell's cost before skill, instead of a flat 5.
- **The spellmaker.** Per-level magnitude is capped, and Shield and Regenerate pools are capped as a share of maximum
  health.
- **Custom classes (OPEN, decision 4).** Either:
  - rebalanced points: no immunities (resistances only), new costs, and disadvantages that don't touch the build (a
    magic restriction on a class with no magic skills) worth little; or
  - a curated list of classes.
- **The item maker.**
  - Side effects fund at most 25% of an item's budget.
  - Effects that never fire on worn gear cannot be taken for it.
  - One Extra Spell Points and one Enhances Skill per item.
- **Across all worn gear:** at most +30 to any skill and at most 75% in any resistance.
- **Luck.** Its rarity term counts up to luck 70 only.
- **Critical hits and backstab.** Each capped at 50% chance.
- **Set powers.** They add to each other instead of multiplying.
- **Rest.** A cooldown, or only at an inn or a home. The skill-clock credit from resting is capped per hour.
- **Every mod setting locked online**, not just `Enabled`. The online-lane pin should walk every key of every mod.
- **Cheat flags and probe seams refused online:** `?shot` (and `__addGold` with it), `?fly`, `?nofoes`, `?tp` and
  `?timescale`.

### 6. The economy online

**Faucets:**
- **Broker items are bound:** no shop sale and no trade, or a nominal sale price.
- **Gate spoils by contribution.** Only standing alive earns a small share.
- **Pile gold divided by level** online. Respawn is set per dungeon instead of hourly for every pile.
- **Shared quest rewards are split** across the party.
- **The Empire is one lender.**
  - One loan per character.
  - A default anywhere closes the Empire everywhere and garnishes future deposits.
  - The cap comes from the service, with `loanAmountPerLevel` locked.
  - At cutover, any debt above the Empire's cap is called in.

**Sinks:**
- **Vendor spread.** Online, a shop pays at most 50% of its own selling price. This ends both the same-shop profit and
  the region-to-region profit.
- **Trade tax** of 5% of the gold that moves, and a fee on guild treasury moves.
- **Weekly upkeep** on online homes, stations included.
- **Dying costs something:** durability, plus a fee of 5% of the gold carried, capped.
- **A fee for each fast travel online.** Online travel has no inn nights to pay for.

**Telemetry.** Checkpoint summaries give the service a live ledger: total gold in the realm, the top holders, and
source and sink tallies. Tune by data rather than by guess.

**Customs** (the migration at cutover, decision 3):
- Loans are settled from bank and purse.
- Liquid wealth (purse, banks, letters of credit) is capped at an allowance for the character's level (**OPEN**).
- Skills, attributes and items are brought within online caps. Anything over is converted to gold inside the
  allowance, or removed.
- A custom class is re-checked under online rules.
- Renown starts from its existing track, as it already does.

## Phases

- **0. Hotfixes.** Days, no migration needed:
  - refuse cheat flags and probe seams online;
  - lock every mod setting online, with the online-lane pin walking every key;
  - the Empire as one lender, and call in oversized debt when a character joins;
  - vendor spread online;
  - divide pile gold by level;
  - bind broker items;
  - split shared quest rewards;
  - a periodic online autosave, which narrows rollback vector 1 until phase 1 closes it.
- **1. Realm characters: the separation.**
  - character ids minted by the service;
  - `realm_characters` with lease and `seq` checkpoints;
  - the Online door and online character creation;
  - "Copy to offline";
  - one identity at the hub;
  - the cutover migration through customs.
- **2. Service transactions.** Trade escrow, the treasury, homes, decor and stations, gate and broker grants, and
  container locks.
- **3. Validation.** Caps, budgets, item ids, quarantine, and a review tool.
- **4. The balance pass.** The power rules and the economy numbers, plus telemetry.
- **5. Later.** The service rolls loot for high-value sources, and an auction house.

## Progress

- **P0.1 done (2026-09-28): the URL's powers stay offline.** An online boot drops `?shot` (whose probe seams include `window.__addGold`), `?fly`, `?nofoes`, `?tp`, `?class`, `?spell`, `?weapon`, `?spawn`, `?region`, `?loc` and the clock and sky overrides before anything reads them (`onlineLane.js` `ONLINE_REFUSED_FLAGS`, `refuseOnlinePowerFlags`; `world.js` beside the Test Room refusal). Offline, F304 stands.
- **P0.2 done (2026-09-28): the balance mods are the room's whole.** Online, every key of Meaner Monsters, PCAAO, Unleveled Loot, Roleplay & Realism, RR: Items and Oblivion leveling reads the room's value or its shipped default (`onlineLane.js` `ONLINE_WHOLE_MODS`, `modSettings.js` `onlineModSetting`): forty-eight dials beside the thirty-four the room already owned. Two cosmetic keys (who stands behind a counter and in a house) and Oblivion leveling's on/off stay the player's. The Mods pane locks a room dial with its reason, and the offline "sync from server" copies the dials home.
- **P0.3 done (2026-09-28): the Empire is one lender.** Online (`banking.js`): one loan a character, wherever it stands (`empireRefusal` in `borrowDecision` and `borrowLoan`, and the bank window names the branch); a default anywhere shuts every branch; an overdue loan draws on every account before it defaults (`drawEmpireAccounts`); a defaulter's deposit, gold or letters, pays the default first (`garnishDeposit`). At the join (`worldTick.js` `empireJoin`, called in `onlineStart` after the markers are aligned to the world's clock) the Empire keeps one loan, the largest, up to its cap with interest, and calls in the rest: the loan's own account, the other accounts, then the purse. A call left unpaid falls due and defaults at once, with the region's reputation. The cap from the service waits for phase 1; `loanAmountPerLevel` is the room's since P0.2.
- **P0.4 done (2026-09-28): the faucets.** Online:
  - **Vendor spread.** A shop pays at most half its own asking price for the same piece (`shopStock.js` `calculateTradePrice`, `ONLINE_SALE_SHARE`), so buying a piece and selling it back no longer makes gold (a quality-1 shop with Mercantile 2 paid 488 and asked 484).
  - **Pile gold.** Every treasure pile's gold is divided back by the level, never below one piece (`loot.js` `addPileLootExtras`, `unlevelPileGold`). This is Unleveled Loot's own arm, which DFU never calls, and here it runs whether the mod is on or off. The dungeon, interior and camp piles all hand in the level.
  - **Bound broker items.** The Sigil Broker's piece is bound as it is bought (`sigilBroker.js` `makeBrokerSale`; `itemLock.js` `isBound`, the `bound` field). It can't be dropped, sold, traded or stowed anywhere another player may open (`itemTransfer.js` `planStore`); the wagon still takes it. The binding holds offline too, because an offline sale's gold rides the same save online until phase 1. It will stay in a player's own home chest once containers carry owners (phase 2).
  - **Shared quest rewards.** A party's shared quest pays its gold in the party's shares (`quest/actions.js` `shareQuestGold` in GivePc; the machine's `rewardShares`; the host's `partySize`). Each partner's copy pays, so a party of six drew six purses. Item rewards stay each partner's own.
- **P0.5 done (2026-09-28): the character is saved as it plays online.** `onlineCheckpoint.js`: every two real minutes, and at each change a trade makes to the pack (the goods out before the commit frame is queued, back, the peer's in), the character is saved quietly to every slot the exit save writes (`exitAutosaveNames`; no shot, no "Game saved."). It is refused out of the seat, in a duel and on the death screen, as the exit save is. This narrows rollback vector 1 (a seat taken, a crash, a death screen skipping the exit save) to two minutes, and a trade's to none. Phase 1 replaces it with the service's `seq` checkpoints. A chest or a pile handed over in a room is not yet checkpointed; container locks in phase 2 close that.
- `test/realm0.test.js`; `tools/mutants/realm0.json`.

## Decisions

Mac, 2026-09-28, answering the four questions:

1. **Truth:** "Account service". An online character's truth lives on the service; the browser caches it.
2. **Offline play:** "No, fork a copy". A realm character plays only online; "Copy to offline" forks it.
3. **Existing characters:** "Migrate once via customs". Characters that have played online move over once, through customs; new realm characters start fresh.
4. **Classes:** "Rebalanced points". The class maker stays online, with online costs.
5. **The numbers** stay OPEN. The proposals on this page are the starting values, each a named constant.

### As asked

1. **Where does an online character's truth live?** Recommended: on the service. Without that, no rollback or copy
   dupe (vectors 1 to 3, 5 to 7 and 9) can be closed.
2. **Can a realm character be played offline?** Recommended: no, with "Copy to offline" as a fork.
3. **What happens to existing characters?**
   - (a) a fresh realm for everyone;
   - (b) a one-time migration through customs for characters that have played online (recommended);
   - (c) any offline character may move online through customs, at any time.
4. **Custom classes online:** rebalanced points, a curated list, or standard classes only.
5. **The numbers:** the online level cap, the customs allowance, the vendor spread, the trade tax, the upkeep and the
   death fee.
