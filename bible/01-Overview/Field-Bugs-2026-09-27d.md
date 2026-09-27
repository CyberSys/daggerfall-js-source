# FIELD BUGS 2026-09-27d - the Discord batch after RISE-STUCK

Mac, with screenshots from the Discord's bug reports and suggestions. This page is the batch's record; each fix
has its own section below as it lands.

1. *"Potion seller restock instantly - You only have to close the shopping window and the potions are available to
   purchase again. I dont know if its a bug, but you could buy infinite amount of potions this way"* (Bagneres)

## GUILD-SHELF: a guild's Buy shelf is the day's (1)

The "potion seller" is a guild's Buy Potions service (the Temples' and the Mages Guild's), and the same law
stocks Buy Magic Items and Buy Soulgems. DFU mints each of those shelves on every open of the service - the magic
and soul gem shelves from the day's seed, so what was just bought is back at the next open, and the potions from
the walking random stream, a fresh lot at every open. Either way the shop never runs out. The port had recorded the
first as a quirk it kept, and seeded the potions on the day as well - which turned them into the first kind: close
the window, and every potion just bought was back.

Each service's shelf is now minted once a game day and kept on the building (`systems/shopStock.js` `dayShelf`,
`scenes/worldModes.js` `guildShelf`). The trade window buys out of that same array, so a closed window finds the
shelf as it was left, and it rides the scene cache beside the shop shelves' own stock - a walk out of the hall and
back, and a save and a load, keep what was bought gone. The next day restocks it. A world move clears the ordinary
scene cache, so a visit after one mints the day's shelf again, as a shop's shelves re-roll. Offline and online
alike; a recorded departure (Port-Ledger section A, GUILD-SHELF). Pinned: `test/guildshelf.test.js` (6),
`tools/mutants/guild_shelf.json` (9, all dead).
