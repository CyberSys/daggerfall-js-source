# Patch Notes: Houses, the market and paying for magic

## Magic costs gold now (online)
Melee fighters pay a smith to keep their gear in shape. Now casters pay to keep their magicka up, so magic is no longer free to use.

- **Resting gives magicka back up to half your pool.** Resting, collapsing from exhaustion, and arriving from a cautious journey all refill magicka to 50% of your maximum and no further. "Rest until healed" stops there. If you're already above half, for example after a potion, resting never takes any back.
- **Restore Power potions top up the rest.** Each potion restores 5 magicka plus 4 per level. It now costs what it restores at your level, 1 gold per point of magicka, before haggling: about 9 gold at level 1, 45 at level 10 and 85 at level 20.
- **Every alchemist sells them.** Each alchemist has 20 Restore Power potions on the shelf every day.
- **The Mages Guild sells them to anyone.** Use the guild's magic-items merchant. Members of rank 3 and up see the potions next to the usual magic items. Everyone else, members or not, can buy the potions there instead of being turned away.
- Selling a Restore Power potion back is priced the same way, so buying potions to resell never pays.
- **Offline, nothing changes.**

## The market (online)
- **Sell anything from your pack.** Under **My listings**, choose **A piece from your pack (gold)** and set a price in gold. The piece leaves your pack at once. If you cancel, or it doesn't sell within 72 hours, it comes back. The new **Goods** view lists everyone's pieces.
- A piece bought at a board in its seller's region reaches your pack at once. From another region it comes by courier.
- Some things stay off the market, and the List form says why for each one:
  - bound pieces (Sigil Stones and the Sigil Broker's wares)
  - anything you're wearing, locked pieces, quest items and summoned items
  - gold, letters of credit, boat deeds and boat parts
  - arrows
  - Stores materials such as ores, ingots, gems and herbs (list those from your Stores)
- Pieces from your pack sell for gold only, not Drakes.
- A crafted piece someone else made can't be sold as a crafted piece; only its maker can do that. It sells from your pack, for gold.
- **Fixed:** listing a crafted piece someone had traded you made it vanish from your pack. It now stays.

## Decorating outside your home
- **Yard pieces stay off the road.** A piece could be set down on the street, on its edges or on a track running past town, and the blue lot edge ran across the road. A piece on the road is now refused with a message, and the lot edge runs along the side of the road. Pieces can still touch the road's edge.
- **No more furniture through your walls outside.** A long piece turned at an angle could be placed cutting through the corner of your house. It's now refused until it's clear of the wall.
- **Yard changes stick.** A piece you had just placed could vanish, or one you had removed could come back, for about a minute. Your changes now stay put.
- **Yards don't blink at map edges.** Walking across a map boundary near decorated yards made their pieces disappear for a moment. They now stay in place.

## Painting your house
- **You can paint your house's outside again.** In the Decorate panel's Exterior tab, the "Paint it", "Put back" and "The town's own" buttons were hidden. A look you tried disappeared as soon as you left the tab. Press "Paint it" to keep a look for everyone.
- A look you just painted no longer flips back to the old one for up to a minute. That could happen when the town's list of homes refreshed at the same moment, or when you painted twice in a row.
- Closing the decorator after trying a look you didn't paint now reopens the Exterior tab on your house's real look, not on the one you put away.

## Renting rooms
- **Tenants can rest.** If you rent a room in someone's home, you can now rest there. Before, it said "You have not rented a room here."
- **Renewing only offers the days you can buy.** A room can be paid at most 30 days ahead. When you renew, the door now lists only the day counts that fit, and tells you when your room is already paid that far. Before, it offered 30 days anyway, refused the rent, and moved the cost from your purse to the bank.
- **Rent paid while you're home shows up.** The "Rooms to rent" tab checks again each time you open the Decorate panel, and every half minute while it's open.
- **Offers in a house that is one room again stay listed.** You can still see your tenants and stop offering a room. Before, visitors could rent a room you could no longer see. While your rooms are still being found, the tab says "Finding the rooms of your house..." instead of "A house of one room...".
- **Room numbers match.** A room you offer as "Room 2" is "Room 2" at the door, not "Room 1".
- **The door opens right after you rent.** Before, it could stay locked for up to a minute.
- If the owner stops offering your room, the door now says your room can't be renewed and how many days you have left.

## Skills past 100
- **Running keeps every step past 100.** A mastered skill past 100 stopped counting after about an hour and a half of running between rests, and the extra progress from a long run was thrown away. Now all of it counts, and whatever a rest doesn't turn into a point is kept for the next rest.
- **Climbing past 100 does something now.** Climbing is already a sure thing at 95, so a mastered Climbing gained nothing past 100. Now each point past 100 makes you climb faster: about 8% faster at 125, 17% at 150 and 40% at 200.
- If your Running, Jumping or Climbing seemed stuck past 100 before the "Running past 100" update, that update already fixed it. Real movement counts again.
- Below 100, nothing changes.

---

## For developers
- `src/systems/rest.js` (MANA-HALF): `ONLINE_REST_MAGICKA_SHARE` (0.5), `restMagickaCap`, `restedMagicka`. These are read by `restVitals` and `restFullyHealed` (`scenes/shared.js`), `exhaustionOutcome`, and the cautious journey (`scenes/world.js`).
- `src/systems/restorePower.js` (MANA-SHOP): `restorePowerCost` (online, magnitude at the buyer's level × `RESTORE_POWER_GOLD_PER_POINT`), `restorePowerStack`, `RESTORE_POWER_SHELF` (20), `magesSellRestorePower`. `tradeModes.js` `buyItemPrice` and `tradeCost` take `buyerLevel` (the Buy and Sell arms). worldModes' price context, keyed purchase and keyed sale pass `effectiveLevel(playerEntity)`. The Mages Guild's refused BuyMagicItems opens the `guildServiceBuyRestorePower` shelf.
- `src/ui/decorPanel.js` (LOOK-BUTTONS, LOOK-TRIED): the painter's row has its own class, `dfdecor-paint-btns`. Closing the panel puts the tried look away.
- `src/systems/onlineHomes.js` (LOOK-STALE, HOMES-FORCE): one rule. A forced town read is asked after the read in flight, unless that read was itself forced after the last write. An answer from before a write is not believed.
- `src/systems/homeRent.js`, `src/systems/restSession.js`, `src/scenes/decorTool.js`, `src/scenes/worldModes.js` (RENT-REST, RENT-RENEW, RENT-FRESH, RENT-ORPHANS, RENT-NUMBER).
- `src/scenes/homeYards.js` (ROAD-LOT, YARD-CORNER, YARD-STALE): `yardRoadsOf` reads the built pixel's tilemap. Road is path records 46/47/55, or a tile the road painter's mask marks. `yardWhyNot` refuses a piece that meets the road (`YARD_ON_ROAD`) or a footprint (`yardFootMeets`, separating axes). `yardLotEdges` marks the lot with the road cut out (`decorTool.js` `DECOR_LOT_MARKS`). The owner's writes are kept by turn against stale town reads.
- `src/scenes/decorRoom.js` `restand` and `homeYards.js` `rebase` (YARD-RECENTRE): a world recentre moves every yard piece in place. `world.js` calls it on the recentre's own line.
- `src/systems/skills.js` and `src/systems/advancement.js` (MOVE-BANK): past 100, a skill that can pass the cap has no 20,000-use bucket. The shift is read in float, and the carry is kept whole and re-priced at the next point's cost.
- `src/systems/skillSoftcap.js` `overcapClimbSpeed` (CLIMB-PAST), `src/player/climbing.js` `climbingSpeed` and `src/player/motor.js`: climb speed is ×(1 + (effective − 100) / 100) past 100, bounded at effective 140.
- `src/net/marketLaw.js` `goodRefusal`, `server-account/src/market.js` `listGood` and `collectGood`, `src/systems/tradePack.js` `createMarketGoods` and `src/ui/marketTab.js` (MARKET-ANY): a realm character's pack piece lists for gold. It is taken out of the seller's realm record in the listing's batch and put into the buyer's record on collection. `src/net/marketBook.js` (MARKET-KEEP): `market-not-yours` is no longer read as proof of a copy.

### For the team: deploy order
- **The account service must deploy:** `acct44` with migration `0044_market_goods.sql`. The migration rebuilds `market_listings`, `market_sales` and `market_deliveries` with a third kind, and carries every row, report and index. `account-deploy.yml` runs it on merge.
- A new client talking to the old service degrades safely. A pack listing is refused and the piece comes back. The Goods view says it could not be read.
- Record: `bible/01-Overview/Field-Bugs-2026-10-01.md`. Tests: `test/fb1001_*.test.js`. Mutants: `tools/mutants/fb1001_*.json`.
