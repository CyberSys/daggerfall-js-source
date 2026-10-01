# FIELD BUGS 2026-10-01 - the runaway pet's tiger; and seven lines: the yard, the market, the paint, the rent, the road, the potions, the climb past 100

*The same date, twice (the merge of PR #498 with main, 2026-10-01): KEPT-KILL was written on main (PR #497) while part
two - a list of seven - was written on PR #498's branch under the same name. The merge keeps both here, so every cite of
this page stands; part two's numbers (1-7), its tags and its pins' `fb1001_` are its own.*

One #bug-reports thread, and Mac's ask on it: *"Report on other player's quest enemies being dead"*, then *"If someone
kills a quest target regardless of relation then it should ping the quest for the players involved regardless ... So if
it doesnt work that way now it should, imo I suggested party only sync with quest entities for best solution"*. Asked
how the one gap found should be closed - a field on the party pose (a relay deploy), the quest-share frame (none), or no
handover to a member off the quest - Mac chose the party pose.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "Does anybody know if the tiger from the 'runaway pet' quest respawns?" / "Somebody entered the dungeon where the tiger was and I think it was killed" | (#bug-reports) | not the quest's tiger: a quest's foes are its player's alone, and a shared quest's ride to the party only - a stranger never sees, strikes or is hunted by one; a Natural Cave rolls ordinary Sabretooth Tigers, the room's to kill | answered |
| 2 | (found answering it) a quest foe its owner handed to a party member whose copy holds no such quest, killed with no linked copy in the room, counted on no copy - the owner came back to a fresh one at the marker | - | QUEST-PARTY counts on each copy only the deaths it sees, and AUDIT DISC28 QS-J's heir keeps the foe on the partner's word with nothing to count it on | fixed (KEPT-KILL) |

## The report (1) - what a quest foe is online

**The quest.** "Runaway Pet" is `M0B00Y17` (`vendor/dfu-quests/Quests/M0B00Y17.txt`, the Fighters Guild's): `Foe _tiger_ is
Sabretooth_tiger`, `place foe _tiger_ at _mondung_` - a `dungeon6`, a Natural Cave (`Quests-Places.txt:124`). It is
fetched ALIVE - an `injured _tiger_` and the bell (`_S.02_`, `_S.04_`, `_S.05_`'s `remove foe`); `killed 1 _tiger_`
(`_S.03_`) is the failure: "Oops. You killed the tiger.", and `_dummy_` orders the player out, unpaid. (`M0B00Y07`, "Unwanted
Houseguest", is the other tiger in the pack: a house, and a kill.)

**Whose foe it is** (verified on the code, `scenes/questFoeHost.js`, `scenes/dungeonContext.js`, `scenes/exteriorFoes.js`,
`scenes/world.js` questShareSeam):

- The quest's own mount stands it on its player's machine alone (`systems/quest/sceneMount.js:118` - only while
  `killCount < spawnCount`), past the layout's run (`dungeonContext.js:1441` spawnQuestFoe). The room's stream carries
  the layout alone (`foesFrame`), and a peer's blow past the run is refused (`applyHit`, `i >= _layoutFoes`).
- Shared with the party (QUEST-PARTY), it rides the room's own lane to the party alone, stood as a puppet for a LINKED
  copy only (DISC28-J's `accepts`), struck only by the party, hunting only the party (`isPrivateQuestFoe`,
  `questShareTag`, `peerMayHit`). Every member's linked copy counts the injury and the kill it sees; the resync's max
  merge (`machine.js:1290`) keeps the copies equal.
- It is never the room's: the hourly respawn (`RESPAWN_MS`) and the relay's memory of the dead (`sharedWorld`'s
  `slice(0, _layoutFoes)`) cover the layout's run alone. Once its copy counts it killed it is never stood again; alive,
  it stands at full health each time its player comes in.

So the reporter's tiger was a cave's own, a stranger's to kill. The quest's tiger was still standing in the reporter's
own copy of the cave - unless the player who came in was in their party, and then only by the road below.

## KEPT-KILL: a kept quest foe's fall is said in the heir's party pose (2)

**Reproduced first** (`test/keptkill.test.js`, the dungeon's own-lane doors sliced out of the source and run - the
questparty3c harness): the owner stands Runaway Pet's tiger; a party member whose copy holds no such quest (a share
refused - Runaway Pet is a guild quest, and a non-member's receipt is refused `'guild'` - or a link a reload dropped)
stands no puppet of it (DISC28-J). The owner dies to it or walks out: the handover names that member heir, who takes it
on the partner's word (QS-J's `_keptTag`). The heir kills it. No linked copy is in the room, so no copy saw it fall,
and nothing the heir's world does reaches the owner's. Back in the cave, the owner's copy (`killCount` 0) stands a fresh
tiger at the marker - to the owner, the tiger respawned.

**Why.** Each copy counts what it sees (QUEST-PARTY phase 1): its own foe's death through its QuestResourceBehaviour, a
partner's puppet's through `onPuppetDied`. A kept foe has neither - the heir has no copy to bind it to - and the own
lane is the room's, so a death nobody linked saw was nobody's word.

**The fix.**

- The heir says it. Each frame, beside the quest behaviours' update, a kept foe at zero health (the behaviour's own
  test) says its fall once with its number on the heir's stream - `keptKillTick` in both pools
  (`dungeonContext.js`, `exteriorFoes.js`), through the seam's `onKeptDied(tag, i)`.
- The heir's party pose carries it: `qk`, rows of `{q, s, i}` (the quest, the Foe's symbol, the number), held five
  minutes (`KEPT_KILL_HOLD_MS` - the hub keeps a member's last pose, so a link that drops and comes back in it still
  hears), eight at most (`net/wire.js` validPartyPose, `KEPT_KILL_POSE_MAX`).
- Every party member's linked copy counts it, wherever the member stands (`creditKeptKills`: `sharedQuestFoe`, the
  injury then the kill, as the behaviour sets them). A copy that holds no such quest counts nothing (DISC28-J's law).
- Once. The pose repeats its rows on every change for the hold, and a linked member in the room saw the puppet fall
  too: the puppet's death names its owner and number now (`onPuppetDied(tag, owner, i)`), and both doors ask one
  ledger keyed by the holder's account, the quest, the symbol and the number (`KeptKillLedger.credit`), remembered
  past the hold. Whichever lands first counts.

**The relay.** `qk` is a party-pose field, so the hub must project it: RELAY_VERSION world136 -> world137 (main's GATE-UX took world136 first), which
`relay-deploy.yml` deploys on the merge - and a relay deploy drops every open socket once. Until it is live the hub
strips the field, and the kill counts on no copy that did not see it, as before; nothing else changes.

Pins: `test/keptkill.test.js` (7): the wire's law, every vendored quest name and Foe symbol inside it, the gap and its
say in the dungeon, the witness's key equal to the heir's, the ledger, Runaway Pet's `killed 1 _tiger_` firing on the
owner's and a linked copy from the heir's word (and not on an unlinked one, and not twice), and the hosts' wiring.
Red on the code before (the module's exports are not there). Mutants: `tools/mutants/keptkill.json` (22, all dead).
PIN MOVED: `test/questparty.test.js` (the world host's
`onPuppetDied` shape); the relay's version pins to world137 and `relayversion.test.js`'s row; mutants
`questparty.json` QP-no-kill-credit and `questparty3c.json` QP3C-no-kill re-aimed by content, `soc1.json`
S38-version-not-bumped to world137.

**Not changed.** The handover itself: QS-J's reason stands (refused, the foe was lost for every linked member in the
room). A kept foe killed while its owner's relay link is down past the hold is still uncounted on the owner's copy; the
owner's next resync from a linked member who counted it (one in the room, or one that got the pose) carries it. A
quest that is not shared is its player's alone: its foe is never handed, and leaves with its owner.

## Part two - seven lines: the yard, the market, the paint, the rent, the road, the potions, the climb past 100

One list of seven, relayed as it was written:

> 1. Decorating the exterior is bugged for houses.
> 2. The market doesn't allow you to list any item that isnt bound, also it's bugged
> 3. Switching textures on houses doesnt stay and resets
> 4. Room renting is buggy
> 5. Exterior placement bounds shouldnt touch roads/pathways
> 6. Potions are durability Mages could basicly kill.for free Potions makes them cost to use magic Gold sink Same as repairs for melee
> 7. Running jumping climbing dint work passed 100

The rule of the last batch stands (Mac, `Field-Bugs-2026-09-30b.md` part two: *"I dont care about DFU. We're our own
thing now"*): every report root-caused on the real modules with a reproduction before anything changed, the faults
fixed wherever they failed the player, each fix pinned red on the code before it and mutation-checked. Five lanes ran
at once, one a report (the yard and the road together); 6 was a design ask, asked before it was built - and
withdrawn after it shipped; 2 was both.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "Decorating the exterior is bugged for houses." | three: a long piece turned at an angle could stand through the house's corner (the lot asked a piece's corners, not its ground); the town's minute read, answered before a place or a remove and landing after it, stood a removed piece back and dropped a new one for a minute; at a pixel crossing every yard piece was drawn 819 m off for a frame and not at all the next | fixed (YARD-CORNER, YARD-STALE, YARD-RECENTRE) |
| 2 | "The market doesn't allow you to list any item that isnt bound, also it's bugged" | only a Stores material or a crafted piece carrying its maker's record could list, by design (10.2: "Loot does not list") - nothing bound was ever offered, and nothing from the world either; and a crafted piece handed on by a trade was destroyed when its new holder pressed List | fixed (MARKET-KEEP), built (MARKET-ANY) |
| 3 | "Switching textures on houses doesnt stay and resets" | three: the painter's "Paint it", "Put back" and "The town's own" were never drawn (they stood in the rent tab's row, which the decorator's sheet hides in every other tab), so a look could only be tried and was put away on leaving the tab; a town's read in flight when a look was painted landed over it and was believed for a minute; closing the panel left the tried look in the painter | fixed (LOOK-BUTTONS, LOOK-STALE, LOOK-TRIED) |
| 4 | "Room renting is buggy" | six: a tenant could not rest in the room they rented; the renewal window offered days the service refuses, after the purse had paid; the owner's rooms were read once a visit; a house one room again hid its offers from its owner; the owner's "Room 2" was "Room 1" at the door; a rent that landed under a plaque's read kept the door shut a minute | fixed (RENT-REST, RENT-RENEW, RENT-FRESH, RENT-ORPHANS, RENT-NUMBER, HOMES-FORCE) |
| 5 | "Exterior placement bounds shouldnt touch roads/pathways" | the lot was the house's box and six metres round it, and nothing read the ground: a piece stood in the street, and the marked edge ran across it | fixed (ROAD-LOT) |
| 6 | "Potions are durability ... Gold sink Same as repairs for melee" | a design ask: online a rest gave magicka back whole and free; asked, rest gave "Half the pool" and Restore Power sold "Everywhere, 1 g/point" | built (MANA-HALF, MANA-SHOP), shipped in #498, then withdrawn (Mac: "Revert all the potion and magic stuff") |
| 7 | "Running jumping climbing dint work passed 100" | the report reproduces whole on the code before MOVE-REAL (#475, merged the day before); on today's two remained: past 100 a run stopped counting at DFU's 20,000-use bucket - some 83 minutes between rests - and a rest's leftover was capped; Climbing past 100 bought nothing (its one law is certain at 95) | fixed (MOVE-BANK, CLIMB-PAST) |

## LOOK-BUTTONS: the painter's buttons drawn (3)

**Reproduced first** (`test/fb1001_look.test.js`: the decorator's real sheet, `DECOR_CSS`, cascaded over the real panel
and the real decorator tool by a small selector matcher - classes, attributes, `:not`, descendants, specificity - with
its own sanity pin; and the yard's decorator on the real homes registry over the real Worker): on her own lot the
owner opens the decorator, Exterior, Walls, Swamp and Manor - the house wears it (the host's preview) - and "The town's
own", "Paint it" and "Put back" are all `display: none`. The only ways out of the tab, leaving it or closing the panel,
put the tried look away, and the house wears the town's own again: the report, whole.

**Why.** The three buttons stood in a row classed `dfdecor-rent-actions` - the "Rooms to rent" tab's row - and the
decorator's own sheet hides that class in every tab but the rent tab's (`.dfdecor-card:not([data-mode="rent"])
.dfdecor-rent-actions`), and again in the painter's. HOME-LOOK's pin pressed "Paint it" in a headless document that
reads no CSS: it pressed a button nobody could see, and the housing audit's lanes read the code, not the drawn page.

**The fix** (`ui/decorPanel.js`): the row has its own class, `dfdecor-paint-btns`, laid out as a row.

**Found on the way, not changed.** A fault like this one is only caught by reading the sheet; the pin's cascade helper
could serve the other DOM windows' pins.

## LOOK-STALE: an older answer never lands over a newer look (3)

**Reproduced first** (the real service, `accountHomes` and `createOnlineHomes`, over a network that holds a town's
answer): the town's minute ran out and a door asked again; the service answered the town as it stood, and the answer
was still on its way when the paint landed. The look showed at once, then went back to the town's own when the older
answer arrived - and was believed for the town's minute. Two looks painted one after the other did the same: the first
paint's read-back put the first look back over the second.

**Why.** `ensure` handed a forced ask the read already in flight, so the read-back a write asks for was dropped (ASYNC
NEVER DROPS), and that flight's answer - from before the write - overwrote the row the write had set.

**The fix** (`systems/onlineHomes.js`): the registry counts each town's answered writes, and each read keeps the count
it set out under; an answer from before a write is not believed (a claim, a door's entry and a sale ride the same
`wrote`). A forced ask is asked after the flight it finds - the one rule HOMES-FORCE (below) shares: the two lanes
fixed the same root two ways, and the merge kept one - unless that flight was itself forced and set out after the last
write, whose answer is the one asked.

**Found on the way, not changed.** A look tried while a paint is still being written is put away on the house by the
write's answer, the panel disagreeing for that round trip; other players see a new look at their next read of the town
(a door hover or a pixel's build), nothing re-asking while they stand still; "Put back" previews the house's look rather
than clearing the preview.

## LOOK-TRIED: closing the panel is leaving the tab (3)

**Reproduced first:** try Manor, close, reopen - the painter opened on "Manor, Temperate - changed" and "Tried on your
house - paint it to keep it" over a house wearing its painted look. **Why.** Leaving the tab cleared the painter's
tried look; closing put it away on the house alone. **The fix** (`ui/decorPanel.js` `hide`): the tried look goes with
the close.

`test/fb1001_look.test.js` (7), five red on the code before (the cascade's sanity pin and the no-second-ask guard are
green both sides). `tools/mutants/fb1001_look.json` (15: 14 dead, 1 equivalent as recorded - a landed flight's count
left behind is never read); `home1`'s HOME1-two-asks-in-flight re-aimed by content.

## RENT-REST: a tenant rests in the home they rent (4)

**Reproduced first** (`test/fb1001_rent.test.js`: the real Worker and its rent route, `accountHomes`, `realmGoldAct`,
`createOnlineHomes`, and the interior host's rest bag over `interiorRestPlace` and `canRest`): walking in, the tenant
is told "You rent a room here ... You may rest here."; pressing Rest, `{ allowed: false }`, "You have not rented a room
here." The owner rests.

**Why.** `canRest` asks IsHouseOwned only inside its permanent-scene test - DFU's rule, since a house DFU sells is a
permanent scene from its purchase. The owner's visit stands in the home's own scene, made permanent at entry; a
tenant's in the building's ordinary scene, which no tenant's cache holds - so the host's `houseOwned` for a tenant was
never read.

**The fix** (`systems/restSession.js` interiorRestPlace `homeBed`; `systems/homeRent.js` `homeBedIsMine`;
`scenes/worldModes.js`): an online home's bed - its owner's, or its tenant's until the tenancy ends - stands where a
bought house stands, in both halves of the test. PIN MOVED: `homerent`, `restlodging` and `houses` re-aimed by content
at the bag's new host line.

## RENT-RENEW: the renewal window offers the days the service takes (4)

**Reproduced first:** three days held; the window offered 1, 3, 7, 14 and 30; 30 was refused `rent-long` after the
purse had paid 1,500, which came back to the region's bank (purse 4,850 -> 3,350, bank 0 -> 1,500).

**Why.** A renewal counts from the tenancy's end and never runs past thirty days ahead (`homeLaw.js` rentUntil,
`rent.js`), the window listed all five, the purse pays before the service answers, and a refusal's reserve comes back
to the region's account (the housing audit's known limit). A tenant's own room taken off the offer said "No room here
is free to rent right now." under a door that said "renew it".

**The fix** (`systems/homeRent.js` `rentDayRows`, `RENT_FULL_LINE`, `rentNoneLine`; `scenes/worldModes.js`): the door
offers only the days that fit, read on the service's clock (`now` in the rooms' answer); with none, it says the room is
paid as far ahead as a room can be; a room no longer offered says so, with the days left.

**Found on the way, not changed.** The other refusals (`rent-price`, `rent-taken`, `rent-held`, `realm-gold`) still give
the reserve back to the bank, not the purse.

## RENT-FRESH, RENT-ORPHANS, RENT-NUMBER: the owner's tab tells the truth (4)

**Reproduced first** (the real decorator and panel over the real service and the real room finder): a tenant paid
while the owner stood in the house - the service held 120 gold, and the tab, closed and opened again, said "No rent to
collect" (RENT-FRESH); two rooms offered, one rented, the door between them taken down - the tab read "Rooms to rent
(0)" and "A house of one room has none to rent out" while visitors could still rent both (RENT-ORPHANS); the owner
offered the finder's "Room 2" first and the service held room 1 - "Room 2 is offered" on the panel, "Room 1" to every
tenant (RENT-NUMBER).

**Why.** The rooms were read once a visit (`decorTool.js`), and the panel's change signature missed `loaded`, so
"Asking the account service..." stood until something else moved; rows were built only for a house of two rooms or
more, and "Finding the rooms..." tested a flag that is true only when rows exist - dead; every room not yet offered
took the first free number.

**The fix** (`scenes/decorTool.js`, `ui/decorPanel.js`, `systems/homeRent.js` `rentRoomsView`): the rooms are read
again on every opening and every `RENT_VIEW_FRESH_MS` (30 s) while the tab is up, the newest read alone counting, and
the signature carries `loaded` and `finding`; once the finder is done the rows are built for one room too, so the
offers left are listed and can be withdrawn, and `finding` says "Finding the rooms of your house..."; a room takes its
own number where no offer holds it.

**Found on the way, not changed.** An offer keeps its number after a door renumbers the rooms, and the panel's stepped
prices are keyed by the finder's number, so a renumbering mid-panel can carry a price to another row.

## HOMES-FORCE: a forced town read waits behind the one in flight (4)

**Reproduced first** (a town read the service answered before the rent, delivered after it): the rent succeeded - "Room
1 is yours for 1 day. The door will open for you." - and the registry held no tenancy; the door answered `locked` for
the town's minute.

**Why** - LOOK-STALE's root: the forced read `rentHomeRoom` asks after a rent (`homes.ensure(mapId, { force: true })`)
was handed the plaque's read in flight, answered before the rent landed.

**The fix** (`systems/onlineHomes.js`, the merge's one rule with LOOK-STALE): a forced ask is asked after the flight it
finds; one such read a town, however many ask - the first to land sets out a forced flight, and `ensure` hands the
rest that flight. `test/fb1001_rent.test.js` (6), each red on the code before. `tools/mutants/fb1001_rent.json` (28: 27
dead, 1 equivalent as recorded - `finding` in the panel's signature, which the doorway count beside it changes with);
`housing`'s HOME-RENT-the-orphans-number-taken re-aimed by content.

**Found and left open, for Mac.** A tenancy's end is read on the client's clock (the door, the plaque's days, the bed,
the welcome line), so a clock a day off locks out a paying tenant; the fix needs `now` in the town's answer - a service
change and a deploy. After a renewal the line names the days added, not the total left. `collectHomeRent`'s comment says
"the purse takes"; the gold goes to the region's account.

## MANA-HALF, MANA-SHOP: built, shipped, withdrawn (6)

Asked how much of the pool a rest should give back online and how Restore Power should be sold, Mac chose "Half the
pool" and "Everywhere, 1 g/point": online every rested hour (the rest window's, the collapse's, a cautious journey's)
filled magicka up to half the pool, and Restore Power cost what it restored at the buyer's level, a gold a point, shelved
by every alchemist and sold at the Mages Guild's magic-items counter to anyone. It shipped in PR #498 and was withdrawn
the same day - Mac: *"Revert all the potion and magic stuff"*. The revert takes all of it out (`systems/rest.js`,
`scenes/shared.js`, `scenes/world.js`, `systems/shopStock.js`, `systems/tradeModes.js`, `scenes/worldModes.js`;
`systems/restorePower.js`, `test/fb1001_mana.test.js` and `tools/mutants/fb1001_mana.json` DELETED; the pins and mutant
records it re-aimed put back; the Ledger's two rows removed). Online rest gives magicka back as REST-MANA1 left it,
and Restore Power is sold and priced as before.

What the measuring found stands for whoever asks again: every way magicka comes back online is free but the potion;
a whole pool rests back in about 3.6 real seconds, almost anywhere; Restore Power is sold only on the temples' and the
Dark Brotherhood's potion shelves, to members, a random handful a day, at a flat price whose gold a point falls as its
drinker rises (5 at level 1, 0.5 at 20). The rest window's header says eight hours take six seconds; the code takes
about 3.6.

## ROAD-LOT: a yard's lot is no road (5)

**Reproduced first** (`test/fb1001_yard.test.js`: the real yard - `createHomeYards`, the decorator, the panel, `decorRoom`,
the real `Collider` and the real account Worker over node:sqlite through `accountDecor` - over a town of the producers'
own, `test/fb1001Town.mjs`: `layoutLocation`/`layoutRmbBlock`, `setLocationTiles`, the terrain kernel with the road
painter's mask): house A's lot runs onto the street on its north (record 46) and a road-grass edge (55) cuts into its
east. A chair on the street was placed and written with nothing said; on the 55 edge the same. The marked edge was the
lot's four sides, its north band standing 2.6 m inside the street.

**Why.** The lot was the house's box and six metres round it, never inside the house nor on another building's
footprint (HOME-YARD). Nothing read the ground: `yardWhyNot` and `yardLotQuads` knew no road.

**The fix** (`scenes/homeYards.js`). The road is read off the built pixel's own tilemap - the one its terrain draws and
the feet read (`world.js` playerGroundSample): Daggerfall's path records 46, 47 and 55 (PlayerMotor.OnPathTile -
`player/exteriorSurface.js` onPathTile, the family `cityNavigation.js` and the grass placer already keep off: the town's
streets and the ring the road painter lays round a town), or a tile the road painter's own mask says it wrote (GRASS-PATH1:
a painted track writes record 11, which a field's dirt edge writes too, so only the mask can tell them apart).
`yardRoadsOf` turns them into squares in the lot's frame and `ownYardHere` hands them over as `cur.roads`. `yardWhyNot`
refuses a piece whose turned box meets one - "That is the road - keep the street and its paths clear." (`YARD_ON_ROAD`) -
touching the road's side is not on it (a 5 cm pad). The marked edge is the lot with the road cut out, run along the
road's side, each band facing into the lot (`yardLotEdges`; `scenes/decorTool.js` `DECOR_LOT_MARKS`, the batch's room).
Dirt (1) and stone (3) are ground, as Daggerfall's navigation reads them: a dirt yard stays a yard.

**Found on the way, not changed.** A flat's ground is a square of its whole radius, so a tall flat is refused well clear
of a road or a wall. The house's and the neighbours' footprints are not marked (their walls show them). The client's
lot is not clamped to the service's 48 m yard bound (`decorLaw.js`): a building whose models spread wide (Roleplay
Realism's fort block stands props 55 m from its origin) could have a lot the client takes and the service refuses
`bad-decor` - not measurable without ARENA2.

## YARD-CORNER: a piece's ground, not its corners (1)

**Reproduced first:** a 3 m bench turned 45 degrees across the house's north-east corner - none of its corners and not
its middle inside the house, the house's corner 16 cm inside the bench - was placed and written. **Why.** The housing
audit asked a piece's corners and middle; a convex piece covers a wall's corner with none of its own points in the
house. **The fix** (`scenes/homeYards.js` `yardFootMeets`): the separating axes of the piece's turned box against a
footprint - the house's, a neighbour's ground and the road's alike.

## YARD-STALE: a read from before a write stands nothing back (1)

**Reproduced first:** the town's minute read was answered before the owner placed a second piece and removed the first,
and landed after: the yard stood the removed piece again and dropped the new one while the service held the new one
alone - for the town's minute. **Why.** The answer replaced the town's whole cache, `sync` stood the yard from it, and
`keep()` covered only the writes made before the read set out. **The fix** (`scenes/homeYards.js`): the owner's writes
are kept by turn, and an answer asked before a write keeps the owner's latest list for that building - LOOK-STALE's law,
for the yards' own registry.

**Found on the way, not changed.** Where the town's answer names no pieces for the owner's yard, the yard keeps its own
pool, so a piece removed from another tab stands on this screen until the yard is made again.

## YARD-RECENTRE: yards move with the shift, in place (1)

**Reproduced first:** at a pixel crossing a yard's piece was drawn 819.2 m off on the crossing's frame, not at all on
the next, and right on the third. **Why.** The host runs the yards' frame above the motor and the recentre below it, then
draws, so the yards stood at the old offset when drawn; the next frame's re-stand put every piece again, and a model
stands only once its model's promise resolves - after that frame is drawn. The housing audit's "stood again the frame
the world recentres" held only in a test that shifted first. **The fix** (`scenes/decorRoom.js` `restand`,
`scenes/homeYards.js` `rebase`, `scenes/world.js`): the recentre moves every yard piece in place - its matrix, collider
bucket, billboard origin and light, a flat whose picture is still loading included - on the recentre's own line, so no
line cite into world.js moved.

**Found on the way, not changed.** Any other re-stand (the minute read finding a list in another order) still leaves a
yard's models undrawn for a frame.

`test/fb1001_yard.test.js` (5), each red on the code before on its own assertion. `tools/mutants/fb1001_yard.json` (34,
34 dead); `decor1` (2), `fieldbugs27g` DECOR-FLIP and `housing` (3) re-aimed by content, all dead; `homeyard`'s
lot-marks pin re-aimed at `DECOR_LOT_MARKS` (PIN MOVED). Four hosts: `world.js` WIRED (the rebase; the road read off its
built pixel); `worldModes.js` shares `createDecorRoom` (`restand` never called indoors); `dungeonContext.js` has no
street and `exterior.js` (the bench) no online homes - both FLAGGED, not wired.

## MOVE-BANK: past 100 a run is counted whole (7)

**Reproduced first** (the real chargen, `masterSkill`, `PlayerMotor`, `Collider`, `tickPlayerMinutes`, `raiseSkills`).
On the code before MOVE-REAL (#475, merged 2026-09-30) the report reproduces whole: ten minutes' running at a mastered
Running 110 counted 41 uses (2,398 now), 79 jumps counted 21, 70 climbing checks 20 - the spam weight's burst of six,
which MOVE-REAL took off the motion tallies. The chain MOVE-REAL built was walked again link by link - the odometer in
metres, the four hosts handing it to the tick, the tick's three tallies and the climb check through
`tallyMovementSkill`, the credit's mark, the masteries (all four can be mastered as primary, major or minor), mentor mode
- and holds. Two faults stood: a level-30 master ran 100 minutes and rested, and the pass banked 20,000 uses - 0.68 of
the first point - of a 24,000-use run; a 60,000-use day at level 20 landed one point and kept 0.009, and the next rest,
with no new running, landed nothing.

**Why.** `tallySkill` still clamped a mastered skill past 100 at PlayerEntity.TallySkill's 20,000 - a clamp that exists
to keep `(uses * reflexesMod) >> 16` inside an int32, where the past-100 arm spends progress in float - and
`raiseSkills` capped the carry at 0.99 and skipped any pass with no new uses. At four uses a second the bucket fills in
83 minutes; a full bucket at level 30 is 0.68 point at 100, 0.27 at 125 and 0.11 at 150, however long the run. The
notes' "if you run constantly" table held only for a player who rested every 83 minutes.

**The fix** (`systems/skills.js` tallySkill, `systems/advancement.js` raiseSkills): past 100, for a skill that can pass
it, there is no bucket; the past-100 arm reads the shift in float (`floor(uses * mod / 65536)`, the same number up to
20,000); what a pass does not land is carried whole, re-priced at the next point's cost (nothing at 200), so the next
pass lands it - still one point a pass. Below 100, unmastered, or with Master Skills off, DFU's clamp and carry stand.

**Found on the way, not changed.** Offline, switching Master Skills off with more than 20,000 uses banked leaves the
excess for the next tally's clamp. Climbing's credit is the odometer's vertical since its last check, so a hop in place
banks up to two Climbing uses for the next wall. The Master Skills boxes (`MASTER_SKILLS_INFO_ROWS`, `OFFER_ROWS`,
`INTRO_ROWS`, `ABOUT`) still say a skill past 100 learns only from tough foes, which the four movement skills do not.
Past 100 the movement gains are small (Running's speed +2.2% at 125, +4.6% at 150), and the integer `effectiveSkill`
reads 101-103 as 100: a player at 100-110 feels no difference - the global 25% law, for Mac.

## CLIMB-PAST: a mastered Climbing climbs faster past 100 (7)

**Reproduced first** (the real motor and collider, `climbingDeps` on a chargen'd, mastered character, online): Climbing
200 and Climbing 100 each climbed 7.76 m in the five seconds after the climb took hold, and `climbingChance` read the
same at 95 and at 140 - certain from Luck 40.

**Why.** In Daggerfall the skill drives one thing, CalculateClimbingChance, which clamps it to 5..95 and is certain at
95; GetClimbingSpeed reads no skill. A Climbing mastery - one of five a character has - bought nothing; Running, Swimming
and Jumping already read `effectiveSkill` in their speeds (`scenes/shared.js` motorStats, `skills.js`
jumpSpeedMultiplier), as combat does.

**The fix** (`systems/skillSoftcap.js` `CLIMB_OVERCAP_SPEED_PER_POINT`, `overcapClimbSpeed`; `player/climbing.js`
`climbingSpeed`; `player/motor.js`, the climb's move, with the live Climbing the check reads): past 100 each effective
point climbs 1% faster - x1.08 at 125, x1.17 at 150, x1.4 at 200 - bounded at the effective cap. To 100 the climb is
DFU's base/3, and the spell still doubles it. The 1% a point is the lane's own number, one constant to tune. A curse or
a Fortify that lifts the live Climbing past 100 speeds the climb as it already speeds the run.

`test/fb1001_move.test.js` (2) and `test/fb1001_climb.test.js` (2), red on the code before. `tools/mutants/fb1001_move.json`
(16, 16 dead). Four hosts: none needed wiring - MOVE-BANK lives in `skills.js` and `advancement.js`, CLIMB-PAST in the
motor and `climbing.js`; `world.js`, `exterior.js`, `worldModes.js` and `dungeonContext.js` each hand the odometer and
the climbing deps as before.

## MARKET-KEEP: a piece the service calls another's stays in the pack (2)

**Reproduced first** (`test/fb1001_market.test.js`: the real Worker and the real anvil craft, the piece handed on with
`settleRealmTrade` - the law the service settles a realm trade by): the crafter makes a sword and trades it to Ann; the
product's owner stays the crafter. Ann presses List: the piece leaves her pack, the service answers `market-not-yours`,
and her pack is empty - the piece destroyed. A listing kept through a network silence and answered "not yours" on a
later settle was dropped from the save the same way, and the game's own take had already queued a checkpoint, so the
realm record lost it too.

**Why.** AUDIT 31 H1's `PIECE_GONE` (`net/marketBook.js`) read `market-not-yours` as proof the save's piece was a copy,
beside listed, on the road and standing in a home - so the piece was never put back and a settle took it out of the
save; the writs' Fill reads the same list (`net/writBook.js`). But "not yours" is a fact about the record alone: the
hand-over of Professions-Arc section 18 (a trade moving a crafted piece's owner) was never built - the realm trade
(`server-account/src/realmTrade.js`) moves the piece between saves and never `products.owner`, and a shop's shelf, a
room's container and a looted body hand crafted pieces on without the service at all. A traded piece was its holder's
only copy, and List destroyed it.

**The fix** (`net/marketBook.js`, `net/writBook.js`'s reader): `market-not-yours` is no longer in `PIECE_GONE`; the
piece goes back to the pack on a press and on a settle, for the market and the writs, and the refusal says it stays in
the pack and can be sold from it for gold. The List form no longer offers such a piece as a crafted piece (MARKET-ANY's
`ways`, below).

**Found on the way, not changed.** A real copy can still exist: a crafted listing that lands and sells while the pack's
checkpoint is lost in a crash leaves the copy an ordinary piece now, rather than removed - it can no longer list as a
crafted piece. That is the price of never destroying a traded piece; the hand-over closes it at the root.

## MARKET-ANY: a piece from the pack lists, for gold (2)

**Reproduced first** (the real producers through the List form): a looted dagger and a looted piece of armour - not
offered; a crafted Mithril Longsword - offered; a Sigil Stone and a Sigil Broker's ware - not offered. "Only bound items"
read backwards: nothing bound was offered, and nothing from the world either - the form offers Stores materials and
crafted pieces with a maker's record (`scenes/world.js`'s filter, `ui/marketTab.js` "You carry no crafted piece to
sell"), and the service takes `material` or `piece` alone (`server-account/src/market.js`). A player who had crafted
nothing could list nothing.

**Why.** 10.2's rule ("Loot does not list": it has no provenance) was right while a save was the client's alone. Since
REALM P1 a realm character's save is a record on the service, REALM P2.1 already moves a piece between two records in
one write, and since REALM-DOOR every online character is a realm character.

**The law** (`net/marketLaw.js` `goodRefusal`; `server-account/src/market.js` `listGood`, `collectGood`;
`server-account/migrations/0044_market_goods.sql`; `net/marketBook.js`; `systems/tradePack.js` `createMarketGoods`;
`ui/marketTab.js`; `net/accountClient.js`; Ledger A). A piece from a realm character's pack lists **for gold alone** -
the move a realm trade already makes face to face, so no new trust. Never for Drakes: after the first save the service
never inspects a checkpoint, so a client could write any piece into its record, and a save-edited piece must not buy
Drakes (law 3; the threat table's "a save-edited item enters the economy"). Refused, each in words on the form: worn,
locked, quest, summoned and bound pieces; gold, letters of credit, boat deeds and parts; arrows; Stores materials (ores,
ingots, gems, herbs, hides, creature parts - GOLD-MARKET's wall: what Drakes bought never lists for gold); a record over
the request body's bound. `listGood` reads where the realm record stands and takes the record's own piece at `pick`
out of the seller's record in the listing's batch (`prepareRealmRecord` with a `mustChange` guard); the offer must be
the record's (`recordIsOffered`), and a crafted piece whose record is the seller's must list as a crafted piece
(`market-piece-route`). A gold buy writes a delivery (one bought in the board's region arrives at once); a cancel, an
expiry and a moderator's removal write a returned one; `collectGood` puts the piece into the collector's record in the
collect's batch, guarded. Nothing is copied: the piece is in one record, on the listing or on the road. The tab shows a
**Goods** view after Auctions, the road, My listings and History rows, and "A piece from your pack (gold)" to realm
characters alone; My listings sends the crafted pieces the tab holds and the service answers each one's `ways` (yours,
another's, elsewhere, no record) - the crafted picker offers only one's own and names the others.

**The service.** Migration 0044 rebuilds `market_listings`, `market_sales` and `market_deliveries` with the third kind
(SQLite widens no CHECK in place), every row carried, every index made again as 0032 and 0043 (SCALE1) wrote them; the
reports - `market_reports` names a listing by a cascading foreign key, and the drop cascades whatever
`defer_foreign_keys` says - are kept aside and put back. No other table names the three. `ACCOUNT_VERSION` is `acct44`
(`service.js`, `wrangler.toml`). **It deploys with the merge** (`account-deploy.yml` runs on `server-account/**`). A new
client before the new service degrades safely: a pack listing is refused `bad-act` and the piece comes back, the crafted
picker offers what it did with no `ways`, and the Goods view says it could not be read.

**Found on the way, not changed - for Mac.** (1) Drakes for a pack piece: not built - law 3. (2) The wall on Stores
materials keeps looted gems, herbs, metals and creature parts off the pack route too; relax it? (3) The trade hand-over
(section 18): the realm trade could move a crafted piece's owner in its settle batch, which closes MARKET-KEEP at the
root and the forged copy below - should a handed-on piece count as bought with gold, so it never relists for Drakes?
(4) A pack piece lists as its whole stack; the service takes part of one, the form offers none. Also: the original
crafter still owns the record of a piece traded away, and can list a forged copy as a crafted piece for Drakes (older
than this batch; the hand-over closes it); Stores materials withdrawn to the pack still reach gold through a trade or a
shop (older; the market walls them now); the four foods are not walled (their templates ride client settings; worth
almost nothing).

`test/fb1001_market.test.js` (3) and `test/fb1001_market_goods.test.js` (12), red on the code before (the goods file
fails to load without its modules). `tools/mutants/fb1001_market.json` (64, 64 dead); the 246 market mutants of the
arcs before (prof5, prof5b, audit30, audit31, goldmarket and others) re-run - 236 dead, 9 equivalent as recorded, and
audit30's U2, which did not parse on the base either, re-aimed and dead. PIN MOVED: AUDIT 31 H1 at `market-listed`, the
market's views, the gold wiring's pattern, eight `acct43` pins; mutant records re-aimed by content (audit30 S7, U16,
U2; gatekeys; goldmarket's one-cache; prof5's cancel-still-listed, collect-early, collect-any-character; prof5b's
any-piece-auctioned).
