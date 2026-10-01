# Patch Notes: Houses, the market and paying for magic

## Magic costs gold now (online)
Melee fighters pay a smith to keep their gear in shape. Now casters pay to keep their magicka up, so magic is no longer free to use.

- **Resting gives magicka back up to half your pool.** Resting, collapsing from exhaustion, and arriving from a cautious journey all refill magicka to 50% of your maximum and no further. "Rest until healed" stops there. If you're already above half, for example after a potion, resting never takes any back.
- **Restore Power potions top up the rest.** Each potion restores 5 magicka plus 4 per level. It now costs what it restores at your level, 1 gold per point of magicka, before haggling: about 9 gold at level 1, 45 at level 10 and 85 at level 20.
- **Every alchemist sells them.** Each alchemist has 20 Restore Power potions on the shelf every day.
- **The Mages Guild sells them to anyone.** Use the guild's magic-items merchant. Members of rank 3 and up see the potions next to the usual magic items. Everyone else, members or not, can buy the potions there instead of being turned away.
- Selling a Restore Power potion back is priced the same way, so buying potions to resell never pays.
- **Offline, nothing changes.**

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

---

## For developers
- `src/systems/rest.js` (MANA-HALF): `ONLINE_REST_MAGICKA_SHARE` (0.5), `restMagickaCap`, `restedMagicka`. These are read by `restVitals` and `restFullyHealed` (`scenes/shared.js`), `exhaustionOutcome`, and the cautious journey (`scenes/world.js`).
- `src/systems/restorePower.js` (MANA-SHOP): `restorePowerCost` (online, magnitude at the buyer's level × `RESTORE_POWER_GOLD_PER_POINT`), `restorePowerStack`, `RESTORE_POWER_SHELF` (20), `magesSellRestorePower`. `tradeModes.js` `buyItemPrice` and `tradeCost` take `buyerLevel` (the Buy and Sell arms). worldModes' price context, keyed purchase and keyed sale pass `effectiveLevel(playerEntity)`. The Mages Guild's refused BuyMagicItems opens the `guildServiceBuyRestorePower` shelf.
- `src/ui/decorPanel.js` (LOOK-BUTTONS, LOOK-TRIED): the painter's row has its own class, `dfdecor-paint-btns`. Closing the panel puts the tried look away.
- `src/systems/onlineHomes.js` (LOOK-STALE, HOMES-FORCE): one rule. A forced town read is asked after the read in flight, unless that read was itself forced after the last write. An answer from before a write is not believed.
- `src/systems/homeRent.js`, `src/systems/restSession.js`, `src/scenes/decorTool.js`, `src/scenes/worldModes.js` (RENT-REST, RENT-RENEW, RENT-FRESH, RENT-ORPHANS, RENT-NUMBER).
- The account service is unchanged: no deploy.
- Record: `bible/01-Overview/Field-Bugs-2026-10-01.md`. Tests: `test/fb1001_*.test.js`. Mutants: `tools/mutants/fb1001_*.json`.
