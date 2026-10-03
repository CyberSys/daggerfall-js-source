# HOLDINGS - the pause menu's Holdings tab: the Stable, the Fleet, a ship's refits and her name (the port's own)

Opened 2026-10-03. Mac, on PR #549 (TOUGHER-SHIPS): *"Lets add a new tab to the pause menu as the stat page is starting
to get bloated. Lets organize everything appropriately. Under the new tab add a page that allows you to see your
currently owned mounts ships and carts. You can summon your horse/cart from this page/send away much like the companion
system. You can also do this with ships instead of relying on a deed item. Ships show their values, current health, and
option to repair if theres crew (even if youre away) etc. Introducing the new ship upgrade system. Allowing you to
improve capacity, speed, health, damage, etc. This can utilize foraging items used within the world. Loaned ships
shouldnt be able to be upgraded until the loan is paid off. This also introduces the ability to change your ship name
for others to see ... Ship deeds can now be replaced in favor of the new enhanced plus UI tabs on the pause menu. Take
your time."*

Nothing here is DFU's or a mod's: it is the port's own, over Come Sail Away (`03-World/Come-Sail-Away.md`), Horse Cart
and Cargo (`06-Systems/Horse-Cart-And-Cargo.md`) and the sea fight (`03-World/Naval-Combat.md`), whose laws it calls and
never restates.

## 1. The tab (HOLDINGS)

The enhanced pause window's tabs are **Quests, Stats, Holdings, System** (`ui/enhancedMenu.js` `PAUSE_TABS`; a landing
names any of them - `PAUSE_TAB_IDS`, the strip's own list). The Stats rail is the character sheet again - Character,
Attributes, Skills, Advantages, Standing, Effects, and online the Professions page. The Holdings rail (`pauseHoldings`,
PX6's rail-and-detail bones a fourth time) holds what the player owns and who follows them, each page while it has a
thing to show:

| Page | Module | Shown |
|---|---|---|
| Stable | `ui/holdingsPages.js` | whenever a host provides it - owning nothing is a thing it says, and where to buy |
| Fleet | `ui/fleetPage.js` | while Come Sail Away runs in the world host |
| Companions | `ui/companionRoster.js` (moved off the Stats rail) | anyone sworn or at the player's side |
| Revenants | `ui/revenantPage.js` (moved) | revenants made, or any remembered |
| Stores | `ui/profPages.js` (moved; the Professions page stays on Stats) | online, the professions this account's |

A home station's press that opened the Stores page lands on the Holdings tab there; the Professions key on the Stats tab.
Every visit opens the rail on its first page and forgets the pages' words (an act's answer, an open name field, a panel).
The pages' cards are the Companions page's: the stone-and-brass kit's roles (`ui/enhancedFrame.js` FRAME_ROLES - a card a
panel, a picture a well, a state a chip), the sheet writing geometry and its words' colours alone.

**THE PROVIDER.** The pages touch no runtime: the host hands them `setHoldingsProvider({ stable, stableAct, fleet })`.
THE FOUR HOSTS: `scenes/world.js` provides both pages; `scenes/exterior.js` (the `?exterior` dev host, no Come Sail Away)
the Stable alone - both through ONE constructor, `stableProviderFor` (THE ONE CONSTRUCTION SEAM); `scenes/worldModes.js`
(interiors) and `scenes/dungeonContext.js` stand no runtime of their own - the world host's provider answers over them,
and a summon or a send away there is refused by the runtimes' own indoor laws.

## 2. The Stable

The horse (DFU item 94) and the wagon (93), each a card with the item's own inventory picture: owned or not; where it is
- **Riding**, **In harness** / **Driving**, **Following**, **Waiting** (where it was left, how far), **Hitched** to the
parked wagon, **Parked** (how far), **Stabled**; with the mod off, or its physical persistence off, the classic
transport's **With you**; the wagon's load against its 750 kg.

- **SUMMON** is Horse Cart and Cargo's own (`HandleSummonTransport`), its line ANSWERED now rather than said
  (`summonTransport`: the page says it under the cards, the hotkey on the HUD - one body).
- **SEND AWAY** is its other half (`sendTransportAway`, the port's own): whatever of the pair stands in the world - a
  parked wagon, a horse waiting or following - leaves it, and the pair is "with the player" in the mod's own sense: the
  record the persistence switch's turning on makes (`resolvePersistenceEnabledState` for a player on foot). Stabled, the
  pair is mounted from the Transport window as the mod's WithPlayer state always was, or summoned again. Refused indoors
  and aboard (as the summon is), while riding or driving, with the persistence off, and with nothing out.
- **RENAME HORSE** in place, by the name prompt's own law (`renameHorse` - `resolveHorseNameInput`).

## 3. The Fleet - a ship's title is a ledger's, not an item's

**THE LEDGER** (`systems/fleet.js`) keeps every ship the player holds title to, by her number - the UID her deed placed
her by, Come Sail Away's own (`GetPlacedBoatWithUID`): her hull and rig, her worth, her name, her refits, the bank's
claim while the loan she was bought on stands, the port she was last laid up at. Its own save slot, `Fleet` (carried
whether Come Sail Away runs or not - AUDIT REALM2 C3's law).

**THE BOOK** is her title. A deed (Come Sail Away's item 1321) no longer rides in the pack: it is entered in the book, a
collection of the same deed items by the same UIDs, and every one of the mod's laws that asked the pack for a deed finds
it there (`deedInPack` reads the book too):

- **Bought** at a counter, a deed goes to the book (`worldModes.js` commitTrade, after the furnisher delivers), stamped
  with the loan that bought her (her region's bank and the due date `takeCredit` set) and the port she waits at; the
  HUD says where, and where to look.
- **A prize** claimed at sea (`navalHost.js` claimPrize) has her title entered by the world host's `packDeed`.
- **An older save's deed** - or the console's - is entered the first time the Fleet page reads the pack (`titleDeedsIn`).
- **Picked up** (SHIP-PACK's Steal at her helm, a fast travel at her helm), a ship's parts stand for her and her title
  STAYS in the book; her parts placed are spent and no deed comes back into the pack (`takePlaceItem` through the host's
  `retitle`, which makes her title where an older save's packed ship has none). Without the book's seam the mod's own
  swap stands.
- **A small boat's** title (the Large Boat's) is spent on placing, as the mod spends its deed; laid up, it is made again.

**WHERE SHE IS** is never stored: it is read off the world each time (`scenes/fleetHost.js` `whereIs`) - **At your helm**,
**Afloat** here (how far) or elsewhere (how far, which way), **Packed** (her parts in the pack), **Laid up** (her title
and nothing of her standing). A ship with none of these (sold, purged) draws no card.

**THE CARD** (`ui/fleetPage.js`): her name, her hull and rig, her worth, the bank's claim while it stands, where she is,
her hull, canvas and crew against their whole (the sea fight's own numbers - `navalHost.js` `fleetStatus`), a wreck, a
fire, her carpenter's stores, her refits, and the acts below. A refused act says why on its title and, pressed, under her
card.

| Act | What it does | Refused |
|---|---|---|
| Summon | brought round to the free berth nearest the player of a harbour the sea fight knows (`freeBerth`) by Come Sail Away's `SummonBoat` - moved there if she stands anywhere, placed from her title if laid up; with no berth known, the deed's own placing (a door: the water clicked) | already here, packed, indoors, at a helm, fighting, away from any port (`IsNearPort`'s reach) |
| Send away | she sails for the nearest port and is laid up there (`LayUpBoat`: her hold into PackedCargoes under her number, placed again it is aboard) | laid up, packed, at her helm, fighting, another player aboard; a boat with no crew not here |
| Repair | her hands, wherever she lies (below); the boat underfoot, her captain's order Make repairs | no crew, no hands aboard, nothing to mend, fighting |
| Shipwright | a door to the yard's window (`navalYardWindow.js`) for a ship laid up or lying here, at a port | away from a port; she elsewhere |
| Refit | the panel below | below |
| Rename | the field below | - |

**A LAID-UP SHIP'S STAND-IN** - `{ uid, hull, variant, crewed, Cargo: { Items }, laidUp }`, her hold Come Sail Away's
PackedCargoes under her number, live (`laidUpHold`, made where none is) - is what the sea fight's state, the yard and her
stores read of a boat, so a laid-up ship is repaired, provisioned and refitted as one afloat is.

## 4. Repairs made away

Mac: *"option to repair if theres crew (even if youre away)"*. `navalHost.js` `repairAway`: what QUICK-REPAIRS' hands do
over the quiet, done at once where she lies - her hull and canvas mended free to FIELD_MEND_CAP of each whole (the free
mending's own reach), the rest paid out of her carpenter's stores by `seaRepair`'s law (her hull first, her spare work
spent first, a store STORE_POINTS of work), her fires put out, a wreck refloated. A crewed ship with a hand aboard, never
one fighting. Her First Mate answers by name.

## 5. Refits

Four lines, three tiers each, bought from a shipwright at a port for gold and materials from the pack and her hold (all
or none):

| Line | Betters | A tier | Built of |
|---|---|---|---|
| Hold | the threshold her load is weighed against (Come Sail Away's UpdateBoatCargoMod) | +20% | Timber, Iron |
| Rigging | her way under sail and its coming on (moveSpeed, moveAccel - never her oars) | +4% | Timber, Pitch |
| Hull | her hull's and canvas's whole (myBoatState's build) | +10% | Timber, Pitch, Iron |
| Guns | her balls' hull and canvas harm (landHit - never a fire barrel's) | +8% | Iron, Pitch - a hull that carries guns |

A tier costs a Small Ship 600 / 1,500 / 3,500 gold and 3 / 6 / 10 of each material, times her hull's share
(`HULL_UPGRADE_SCALE`: Rowboat 0.5, Large Boat 0.75, Small Ship 1, Large Galley 1.75, Carrack 2.5). The materials are
things of the world (Mac: *"can utilize foraging items"*):

| Material | Offline | Online (a Stores good withdrawn) |
|---|---|---|
| Timber | Wood Bundle (1604) - Foraging's Wood-Axe | planks (645-651), logs (635-641) |
| Iron | Iron (71) - an alchemist's | Iron Ingot (620), Steel Ingot (621) |
| Pitch | Pine Branch (14) - an alchemist's, the Sickle's quests | Resin (653) |

The refits are read WHERE THE RATES ARE READ (`deps.refit`, the ledger by her number), never written into the prefab's
modifiers a variant's change walks again. A refit never heals her nor hurts her: her state is built again on her new
whole with her hurts the share of it they were (`refitBoat`); a save keeps her on her first build's scale (TOUGHER-SHIPS)
and reads her on her refitted whole.

**THE BANK'S CLAIM** (Mac: *"Loaned ships shouldnt be able to be upgraded until the loan is paid off"*): a ship bought on
the bank's credit takes no refit while the loan that bought her stands - her region's bank still owed AND its due date
the one her purchase set (`loanOwed`; a later loan there is another's). Repaid, she is refitted. A ship bought before the
ledger carries no stamp and is free (nothing recorded which loan bought her).

## 6. A ship's name

Mac: *"the ability to change your ship name for others to see"*. A name is printable ASCII, its runs of spaces closed,
SHIP_NAME_MAX (24) at most, and passes the filter every player's name passes (`net/nameFilter.js` checkName); empty, she
is called by her hull again. She is named on her card, on the plaque over her (`world.js` `csaHoverName`), and to every
other player: the boats' word carries **`n`**, a name for each boat of `b` ('' for none), only while one is named - an
unnamed fleet's record is the older build's to the letter, and a renamed boat is said at once (`csaRecordKey`). A reader
takes each name through the same law; a bad `n` never drops the boats, a refused name reads as none, and an older
reader ignores the key (`systems/comeSailAwayWire.js`; `scenes/comeSailAwayPeers.js` `nameAt`).

## 7. Files, tests

`systems/fleet.js`, `scenes/fleetHost.js`, `ui/holdingsPages.js`, `ui/fleetPage.js`; seams in `systems/horseCart.js`,
`systems/comeSailAway.js` (SummonBoat, LayUpBoat, laidUpHold, the book's seams, the refits' reads),
`systems/comeSailAwayWire.js`, `scenes/navalHost.js` (fleetStatus, repairAway, refitBoat, freeBerth, the refits' reads),
`scenes/world.js`, `scenes/exterior.js`, `scenes/worldModes.js`, `ui/enhancedMenu.js`, `ui/enhancedFrame.js`.

`test/holdings.test.js` (the tab, the Stable, the runtime's summon and send away), `test/fleet.test.js` (the ledger, the
book under Come Sail Away's real runtime, the refits on the helm and the sea, the away repairs, the host half's every act
and refusal, the word's names, the page).
