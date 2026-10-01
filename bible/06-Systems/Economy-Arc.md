# The Economy Arc (ECON-PLAN, opened 2026-10-01)

THE DESIGN RECORD for gold, selling and everything that moves wealth around:
what the economy is FOR, decided before any number is set, and the order the
work goes in. It opened with the repair triage of 2026-10-01 (players: items
break too fast, and cost too much to fix), whose memo asked the questions
below and put the frame they are answered in. Four read-only lenses mapped
the economy as it stands (shops and selling, the online economy, every source
and sink of gold, the work in flight); the answers were proposed from what
they found and confirmed the same day ("Confirm.").

## The frame

From the memo, kept as the arc's law:

- **Influence, never control.** An economy like this is not something you can
  control, only influence; its tools guide players toward an intended
  playstyle.
- **Assume infinite wealth.** "Someone will, eventually, obtain infinite
  wealth either by great effort, error, or exploitation. Do not attempt to
  design a system to be bulletproof, design with the expectation that the
  system will fail, catastrophically, and that such a failure will minimally
  impact the world."
- **Repairs are friction, not a sink.** "Things like repairs exist to limit
  outings and force planning. Their function is not to remove money from the
  economy."

## The intent (confirmed 2026-10-01)

1. **The progression core is character growth** - skills, crafting rank,
   reputation - with gear as how it shows. Gold cannot buy it (training stops
   at skill 50; Drakes come only from acts the server saw), so it survives a
   player with infinite gold. The Loot Arc's chase stays a second loop.
2. **Friction and roleplay.** Roleplay is enforced by how the world reacts -
   dress, standing, factions, the law - never by blocks on play. Fast travel
   between towns stays; the journey matters in the wilderness and below
   ground. Field repair stays partial.
3. **Returning to hubs.** About one dungeon - one to two hours - per outing,
   stretched by preparation (kits, potions, a cart, a mage friend). The
   pressure to return is capacity, supplies and wear, never price; returning
   is cheap and worth it (selling, training, quests, people).
4. **Class-unique features stay.** Anyone can reach the outcome; the
   specialist does it cheaper, faster or anywhere. A mage teleports anywhere;
   anyone else pays the Mages Guild's teleport.
5. **Shops are the floor, crafting the ceiling.** NPC prices are fixed, which
   is what shields a newcomer from inflation among players; the world keeps
   its exclusives (Legendaries, signature drops, artifacts, the NPC-only
   services). What an NPC pays for a crafted piece is capped, or smithing
   prints gold.
6. **Unfairness that brings people together is kept.** Each class has one
   answer it can reach alone that is worse than the answer a group gives. No
   new friction to even things out (no spell components), no free
   regeneration; field repair partial; arrows spent, cheap, some recovered.
   Potions are the solo answer to healing, so they are easy to come by.
7. **Information trade, lightly.** Maps and notes become items players can
   trade at their own prices (Shared Cartography already shares a map with a
   party live); the systems price none of it.

**The three features the friction needs** (the memo: without them the
current design "does not work in an enjoyable manner"):

- **The Vault** - storage reachable at any bank branch and guild hall, held
  on the account service (which is also the answer to duplication there),
  a small fee per item.
- **Loadouts** - named sets of gear, swapped as one action out of combat.
- **Secure services** - a Service mode on the escrowed trade window: the
  customer's item never leaves them while the provider repairs, enchants or
  recharges it in the window, and one confirm settles the fee.

**The guardrails "assume infinite wealth" gives:**

- Gold buys convenience, consumables and status - never the top of power.
- Anything that changes another player's game (seats, sieges, a guild's
  power) is priced in Drakes, which gold cannot buy - the direction the Seats
  arc already took (`11-Multiplayer/Seats-Arc.md`).
- Failure must be seen to be contained: the server-side gold ledger comes
  before any tuning that depends on it.
- A sink that scales with wealth is a prestige one a player chooses (homes,
  decor, halls) - never a tax on everyone.

## Where the economy stands (2026-10-01)

- **Authority.** A realm character's gold is checked once, at its first save
  (`server-account/src/realm.js`, `src/net/realmGoldLaw.js`); every later
  checkpoint is stored as written, and every source - loot, quests, shop
  sales, gate spoils (`src/systems/gateSpoils.js`) - is computed by the
  client. "Assume infinite wealth" is already literally true. The budgets and
  telemetry `06-Systems/Realm-Arc.md` planned are not built.
- **Sources scale; sinks do not.** Gate spoils, raid thanks and quest rewards
  climb with level and item values climb with material (DFU's x512 ladder),
  while the recurring costs are flat and online's essentials were halved
  (`src/systems/shopStock.js`). The biggest faucet by the formulas (not
  measured) is high-rank smithing: an Orcish cuirass from about 1,700 gold of
  ore sells online for some 29,000-42,000.
- **Sinks are one-time.** Houses, boats and crafting stations are bought
  once; nothing charges upkeep; bank balances are never touched; the online
  death penalty takes a quarter of the purse alone
  (`src/systems/deathPenalty.js`). Repairs were the one sink that scaled with
  gear, and they scaled hardest for the best gear.
- **Shops.** Merchants have unlimited gold; online a shop pays at most half
  its own asking price, so Mercantile does nothing for a seller there.
- **Already built, and used by this plan:** Drakes and the walled Gold Market
  (`src/net/marksLaw.js`, `src/net/marketLaw.js`), the escrowed trade between
  players (`server-account/src/realmTrade.js`), field and smith-made repair
  kits (`src/systems/smithItems.js`), the Mages Guild's teleport, Shared
  Cartography, homes and their containers.

## The plan

- **Phase 0 - the triage, shipped with this page.** WEAR-VANILLA (gear wears
  at DFU's rate; `05-Combat/Physical-Combat-Overhaul.md`), REPAIR-RATE and
  KIT-CEILING (below), POTION-COMMON (a Potion of Healing on a looting foe 6
  times in 100 and in a J-O pile 12, and a few on every alchemist's and
  general store's shelf each day - `src/systems/healingSupply.js`) and
  COMPANION-WEIGHT (a crew companion's pack carries what a person of his
  strength can, DFU's MaxEncumbrance - `03-World/Naval-Combat.md`).
- **Phase 1 - see failure.** The server-side gold ledger: each checkpoint's
  gold and item deltas read against budgets, every faucet counted. Nothing
  later is tuned blind.
- **Phase 2 - close the printers.** Cap what an NPC pays for a crafted piece;
  customs reads the server's level, not the client's; a defaulted loan stops
  being free gold.
- **Phase 3 - make the friction fair.** The Vault, Loadouts and secure
  services, in that order.
- **Phase 4 - sinks by choice.** Prestige for the rich (homes, decor, halls);
  anything that reaches another player in Drakes.
- **Phase 5 - specialists and information.** Repairs and teleports as
  services a player sells; copied maps and notes as items.

## Repairs, set from the intent

- **Wear** is DFU's own (WEAR-VANILLA): the mods' wear modules are off, and a
  monster's natural attack wears no armour.
- **The price** (REPAIR-RATE, `src/systems/repairService.js`
  `REPAIR_COST_SCALE`): a third of what Daggerfall's formula asks - it was two
  thirds since REPAIR-EASE (2026-09-30). Under Roleplay & Realism: Items'
  damage-scaled price, a full repair is a fifth of the smith's asking price
  for the piece: still a craftsman's fee (a broken Daedric longsword, 9,216
  gold at a middling smith), not a punishment for using the gear.
- **Kits stay partial** (KIT-CEILING, `src/systems/smithItems.js`): a field
  kit or a smith-made kit mends a piece no further than three quarters of its
  condition. Three quarters is the edge of the overhaul's normal band (a blade
  at 61-75% strikes at its own damage); the 1.1 and 1.3 of a sharp edge come
  back at the smith's.
- **Next** (Phase 3): the Vault and Loadouts make "the right tool for the
  job" a choice rather than a chore, and secure services let a smith or a
  mage sell repairs without either side being robbed.

## Open numbers

The outing (one dungeon, one to two hours), the kit ceiling (75%), the repair
scale (a third), the potions' rates and the companion's capacity are all
tunable, and each is to be read again against the Phase 1 ledger before it is
turned.
