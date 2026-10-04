# FIELD BUGS 2026-10-04e - the controller's bindings and its hotbar; the arena's quiver, its ghosts, its teams and its cellars; the Overworld's filters, carriages, names and seats; the road's encounters; the rider's facing

The Discord's #feature-feedback threads of 2026-10-03 and 04, handed over as screenshots, with two of the owner's own:
*"We need a hover tooltips for capturable cities/towns that show occupation"* and *"When on the horse in the overworld,
the sprite doesnt face the direction of travel"*. Each change below is pinned by tests that fail on the code before it,
and its pins are mutation-checked (`tools/mutants/fb1004e.json`). Nothing here was seen in a browser: this container has
no ARENA2, so every claim is the suites' and the mounted host slices'.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | Sir Timbers: "Overworld and Quick Dial are missing from the controller binding options" | the Controller bindings window draws its own rows and its own d-pad list - neither held them - and the Overworld has no key, so a d-pad choice of it pressed nothing | PAD-BINDS |
| 1 | "rearranging the hot bar icons on controller is not possible ... when adding a spell/item/etc to your hotbar it could prompt you by asking what hotbar button to apply to" | under Plus the bar tucks beneath a window and rises only for a drag; a pad cannot start one on a node it cannot reach; "Add to hotbar" took the first free slot | PAD-ARRANGE |
| 2 | Draugr: "Arrows are not refunded, which causes problems" | the healers put back health, fatigue and magicka; an arrow lodged in a bout fighter (no corpse, taken at the verdict) or a remote body was gone | ARENA-ARROWS |
| 2 | "The ghosts outside are bothersome (I know they're story related)" | the Curse of Daggerfall (S0000977) stands a wraith and a ghost round the player from 19:00 to 05:00 - at the gate, in the stands, in the instance and the undercroft | CURSE-OFF-SAND |
| 2 | "The multiple npc arena fights will target each other despite being on the same team" | the bout gate keeps a teammate out of every target; an area spell's blast hit every body in it, partner included - and a Grand Melee (every fighter its own side) stood under one "vs" | ARENA-TEAMS |
| 2 | "The dungeon under the arena is also completely missing enemies" | ARENA-FIX 4 made the undercroft a hall and left all 328 of its other markers empty | UNDERCROFT-DEEP |
| 3 | Chilloutman: "Add a distance filter so players can decide how many km away they hide nodes" | the gathering groups had one switch and no reach | OW-NODE-KM |
| 3 | "Highlight fast travel hubs (cities with carriages)"; ItMustBeMonday: "WHEEL icon for carriage places" | no map said which towns stand a carriage driver | OW-HUBS |
| 3 | "Change name colors of players in your guild or friend list" | the names knew only the party | OW-KIN |
| 3 | "More filters for players in general (filter by guild, friend, level etc), both in Overworld map and travel map" | one Travellers switch on the Overworld, none on the travel map | OW-WHO |
| 4 | Private Joker: "having to completely halt my travel because 1 rat chose today to die ... the random hunting y/n prompts that stop you completely ... let it be for something important or dangerous. a roving orc patrol, a bandit holdup" | DFU's wanderer keeps its table's bottom in reach at every level, and a journey stops for every one (AUDIT OW5b E1); TO-FIELD3 rolls the hunt on the road | WILD-ROAD, HUNT-ROAD |
| 5 | the owner: "hover tooltips for capturable cities/towns that show occupation" | the held map rings a seat but answers its hover with the town's name; the Overworld had no card at all; the held map's I box said "unheld" whoever held it | SEAT-TIP |
| 6 | the owner: "When on the horse in the overworld, the sprite doesnt face the direction of travel" | ARENA-FIX 14's placing (feet past PLACE_JUMP_M in a frame) fired every frame of a gallop under the time scale, and its -1 orientation was painted by the walk loop as orientation 7 | HORSE-FACE |

## PAD-BINDS (1)

`ui/plusPadBinds.js` (PLUS_BIND_ROWS: `quickdial` on QuickDial, `overworld` on TravelView - both start unbound, the
row's own Bind and Unbind as every other's), `ui/plusPad.js` (DPAD_CHOICES: Quick dial and Overworld for any
direction's tap or hold), `ui/gamepadInput.js` (plusFrame's `fireDpad`: an action on no key at all is the host's own
door, `hooks.padAction` - TravelView ships unbound, TV1's own pin, so a synthetic press of nothing reached nothing),
`scenes/world.js` (`travelViewKey`, the one TravelView toggle the key's arm and the pad's `padAction` both call - the
key's arm keeps its repeat guard and its place above the mode gate). Quick dial on the d-pad presses its own Tab. A
button bound to either in the window works as any secondary binding does; under the window it opens, B closes it (the
view's Escape, the dial's own). THE FOUR HOSTS: the Overworld is world.js's alone (TV1's pin); the dial's door is
`ui/input.js` routeKeyAction in every host, unchanged. `test/fb1004e_padarrange.test.js` (the rows and their binds; the
d-pad's tap and hold - the dial's Tab, the Overworld's door, once each).

## PAD-ARRANGE (1)

`ui/enhancedHotbar.js` (`hand`, `arranging`, raiseSync, takeHotbarHand, placeHotbarHand, toggleHotbarArrange,
PAD_ARRANGE_TEXT; the crossbar API's canArrange, arranging, arrange, holding, crossbar and place), `ui/gamepadInput.js`
(plusFrame's window branch; `hotbarPrompt`), `ui/plusPad.js` (HOTBAR_ARRANGE_CODE, windowPrompts' `hotbar`). With the
pad the live device and a window up:
- **LT raises the bar** to be arranged, and again lowers it. LT is the world's (Interact) and stood down under a window,
  so in one it was nothing. The prompt bar names it ("Arrange hotbar" / "Hotbar done").
- **A on a filled slot takes it in hand** (its frame lifted and lit); A on another slot puts it there - a swap, or a
  move onto an empty one; A on the same slot puts it back. Y clears a slot, the right-click it always was.
- **"Add to hotbar" asks**: the item card's and the spellbook's press puts the new entry in hand and raises the bar
  ("Choose a hotbar slot for ..."), instead of taking the first free slot. A on a slot places it - or, on the crossbar,
  a bumper held and the slot's own button (the player's "what hotbar button to apply to"): the bumpers are the bar's
  while something is in hand, never the tabs', and the button that placed is the bar's until it is let go, so the A
  under LB never also clicks at the cursor.
- The last window closing lets go of the hand and lowers the bar. The mouse and the finger are unchanged - they drag.

All sixteen crossbar slots are reached so, where the keyboard's row of ten never could reach the six past it.
Not built: a pad's own cursor-less slot picker (the cursor and the d-pad jumps reach the risen bar). Recorded: the
bumpers' tab turn while nothing is in hand reads the page's tab strip, which the node harness does not stand, so the
"bumper still a tab in hand" mutant is not in the list - `windowPrompts`' handxb row pins the words. Pins:
`test/fb1004e_padarrange.test.js` (the prompts; the poller - LT, LB + A placing slot 7 with no click, a fresh A a
click again; the bar on a fake page - the pad's Add in hand and placed on crossbar slot 12, the mouse's Add on the first
free slot as before, the tucked bar risen and lowered, A's pick and swap, the crossbar API's place, the hand let go
with the window).

## ARENA-ARROWS (2)

`systems/arenaQuiver.js` (new: QUIVER_TEMPLATES, markQuiver, refundQuiver), `scenes/arenaBouts.js` (`markMine` where a
bout sets my bout tag - a ladder or practice bout and a relay's; `refundMine` with the healers; `refundQuiver` on the
driver's face), `scenes/world.js` (a private session's bout let go before its healers - `letGoPriv`'s heal - pays too),
`systems/arenaText.js` (`ammoBack`). The quiver is counted as I step into a bout: every ammunition inventory.js
spendAmmoFor spends (an Arrow, a Dwemer Pellet), real stacks only - a conjured arrow is spent first and vanishes anyway,
a quest's is never loosed. The healers hand back what is missing - onto the kind's first stack, or a new one off the
first stack's copy when it was spent to nothing - and say so ("The keepers hand back the 5 shots you loosed."). Never
more than went in. THE FOUR HOSTS: the driver is world.js's and exterior.js's (both hand it the same deps); a bout is
fought on the floor's instance (worldModes.js's dungeon arm, dungeonContext.js's release site) and spends there through
the same inventory - nothing to wire there. Pins: `test/fb1004e_arena.test.js` (the law; a ladder bout driven - seven
spent, two conjured, five handed back and said, paid once).

## CURSE-OFF-SAND (2)

`systems/arenaGround.js` (new: ARENA_GROUND_QUESTS, ARENA_GROUND_M, keptOffArenaGround), wired in `scenes/world.js`'s
and `scenes/exterior.js`'s tryPlaceFoe (outdoors: the colosseum's sand within ARENA_GROUND_M - the hosts' own
ARENA_NEAR_M, 150 m) and `scenes/worldModes.js` tryPlaceQuestFoe (the floor's instance and the undercroft, by
isArenaFloor / isArenaUndercroft). A curse wave there is REFUSED - `false`, TryPlacement's own failed shape: the wave
waits and is tried again on the next machine tick, so the curse is not lifted, it waits outside the gate (and its
vengeance sound with it). Only the curse: any other quest's foes are placed as DFU places them. THE FOUR HOSTS: world.js,
exterior.js and worldModes.js wired; dungeonContext.js stands what worldModes.js places (spawnQuestFoe) - nothing to
wire. A departure (Ledger A, CURSE-OFF-SAND). Pins: `test/fb1004e_arena.test.js`.

## ARENA-TEAMS (2)

The bout gate (characters/enemyTargets.js boutGate) was sound: a fighter never takes a teammate for a target. Two things
read as infighting. **A teammate's blast**: an area spell's burst (scenes/hostMagic.js explodeAt) met every body in it,
the caster's partner too - the two-against-one bouts (Knight + Healer, Warrior + Mage) are where an AI casts one. Now
`combat/friendlyFire.js` boutTeammates (one bout, one side) and the blast passes a teammate by; the dungeon's foe
missiles (the floor's instance is a dungeon level) carry their foe as hostMagic's own already did (`scenes/dungeonContext.js`
wCaster, fCaster, mCaster), so the blast can ask whose it is. **The Grand Melee's look**: every fighter its own side by
design ("Every fighter for themselves!"), but the HUD stood the rest in one column under "vs". `ui/arenaHud.js` calls a
bout where every fighter is a side of its own "each alone" (`ARENA_TEXT.hud.eachAlone`); a team bout keeps "vs". Not
changed: the melee stays a melee - giving its fighters one side against the player is a design call, recorded for the
owner. Pins: `test/fb1004e_arena.test.js`.

## UNDERCROFT-DEEP (2)

`world/arenaUndercroft.js` (UNDERCROFT_DEEP_M, `deep`, `near`, deepFoesOf, undercroftHallNear), `scenes/dungeonContext.js`
(the chained beasts and the deep cellars' own foes; the rest gate). ARENA-FIX 4 made the undercroft the fighters' hall
and left every other marker empty - "the deep cellars are quiet". Now the hall is kept and, a whole RDB block (51.2 m)
from the stair and from every place the hall took, the layout's own random foe stands again at its marker - the
HumanStronghold's table the keep was laid with (collectDungeonEnemies, unchanged; only its foes at those markers stand).
A rest within the hall's reach is never broken; out in the deep it is a keep's. No champion is marked there (ARENA-FIX
4's line kept). ARENA-FIX 4's record in `11-Multiplayer/Arena.md` is superseded in place. Pins:
`test/fb1004e_arena.test.js` (the law over a 240 m cellar; the small rig's undercroft - all of it the hall's reach -
stands nothing), `test/arena_fix.test.js` (PIN MOVED: the population line and the rest gate).

## OW-NODE-KM, OW-WHO, OW-KIN (3)

`systems/travelViewFilters.js` (the WHO: TV_WHO_GROUPS, TV_RENOWN_STEPS, TV_NODE_KM_STEPS, travelViewWho,
toggleTravelViewWho, cycleTravelViewRenown, cycleTravelViewNodeKm, travellerKin, playerShown, TV_KIN_COLORS,
TV_KIN_LEGEND; markShown reads it), kept on the device under its own key beside the switches and read by both maps.
- **The node reach** - "Nodes: any / 0.5 / 1 / 2 km", a press for the next: a gathering group farther than it is not
  drawn (`scenes/gatherHost.js` overworldGroups gives each group its `dist`, km). GATHER-OW's groups reach 3 km.
- **The players** - Friends, Guild, Others, and the least Renown ("Any renown", 5+, 10+, 20+, 40+; Renown is online's
  level, the number boxed beside a name). A player shows while Travellers is on, their kin's switch is on and their
  Renown reaches the floor. My party is never filtered.
- **The names' colours** - a friend's in the friends' blue (net/social.js FRIEND_CSS, the chat's own), a guild-mate's
  (their tag my guild's) in violet; my party's green stays the party's.
On the Overworld (`ui/travelViewHud.js`): a "Players" block under the switches; the badge's name and a bare label in
the kin's colour (the sprite keyed by it). On the travel map (`ui/heldMap.js`, `ui/partyMapMarks.js`): the region's
travellers carry their kin and Renown (`scenes/world.js`'s `travellers` dep), are filtered by the same switches, drawn in
the kin's colour, the legend names the two colours, and the key gains a Players row while travellers are drawn.
`scenes/travelView.js` carries every new field through to the readout (the drop AUDIT NAMES N2-1 found once). Pins:
`test/fb1004e_overworld.test.js`; PIN MOVED: `tv3_travellers`, `tv5_far_places`, `ows1_ships`.

## OW-HUBS (3)

`world/immersiveTravelGates.js` hasCarriageGate (one of the town's blocks a gate Immersive Travel edits, IT_GATE_FILE's
own law - a Beautiful Cities composite on one too), `ui/carriageWheel.js` (new: the wheel's one path), `scenes/world.js`
(`carriageTown`: by map id, while the mod is loaded - online always - kept per id until the location index moves).
The Overworld draws a carriage town's dot as a brass wheel and edges its plate in brass; the travel map draws the wheel
LEFT of the town's mark (the anchor stands right), at every band, in the anchor's pens (`ui/inkMap.js`
paintCarriageWheel). Pins: `test/fb1004e_overworld.test.js`.

## SEAT-TIP (5)

`net/townSeatLaw.js` seatTipOf - a dressed seat's card (`{ title, lines }`, the EVENT-TIP card): the town; its Charter
and who holds it; how long and how firmly (seatHolderLine); the holder's rule (seatRuleLine); this week's battle and a
called siege. The travel map's hover over a seat answers with it (`ui/heldMap.js` `_hoverLabel`'s place branch); the
Overworld's plate under the pointer shows the same card (`ui/travelViewHud.js` showMarkTip, the held map's `.hmtip`
look) - a town's mark carries it while the seats are open (`scenes/world.js` seatTipAt). And the travel map's I box
named a held seat "unheld" - `seatInfoLine(seat)` was asked with no holder; it names it now. Online alone, as the seats
are. Pins: `test/fb1004e_overworld.test.js`; PIN MOVED: `seat1a_client`.

## WILD-ROAD, HUNT-ROAD (4)

`systems/roadEncounters.js` (new: trivialOnRoad, roadCompany, wandererCount), `scenes/world.js` runEncounterTick
(`onTheRoad` - a Travel Options journey running, or the Overworld up), `systems/features.js` ('road-encounters' and
'hunt-on-road', the World group). ON THE ROAD, with Encounters on the road on (the default):
- a wanderer whose own level is a third of the traveller's or less is passed by - a Rat from level 3 ("A level 1 ...
  can take care of the rat problems"), a Giant Bat from 9, an Orc from 15; the minute passes, nothing stands, nothing
  stops. A class foe (built at the traveller's level) and a solitary terror never are;
- the rest bring company now and then - from level 5, a chance of level/50 (two in five at most) of a patrol of their
  own kind: one more, then one more each six levels past five, three at most, never past four with the party's own
  extras (PSCALE1's law). A solitary kind comes alone.
Off the road, or the switch off, DFU's wanderer as it was. A departure (Ledger A, WILD-ROAD).

HUNTING WHILE TRAVELLING stays ON by default - TO-FIELD3, Mac's: "hunting rolls fire during travel again", the wilderness
rolls at the traveller. The switch is the player's: off, no hunt is rolled while a journey runs or the Overworld is up
(`scenes/hunting.js` `held` - the minute passes unrolled and is never banked for the road's end). The roll is still the
overworld host's mode (TO-FIELD3's pins hold). Not changed: the roaming bands (TV7/OW6) and the camps - they are groups
already and the Wilderness camps & packs switch is theirs. Pins: `test/fb1004e_road.test.js` (the law; runEncounterTick's
head mounted - the rat passed by on the road and met off it, the switch, a level 2's rat, the patrol; the hunt held);
PIN MOVED: `auditpscale1` (the mount names the road's words), `features`, `ft18_features`.

## HORSE-FACE (6)

`player/eotbBody.js` (faceYaw's `forceOrient`; the placing gate; `rebase`), `player/mwView.js` (mwViewRebase). Eye Of
The Beholder's body faced a PLACING (ARENA-FIX 14: feet carried past PLACE_JUMP_M, 8 m, in one frame - a door, a warp)
the view's way, and asked the next UpdateOrientation for a repaint by writing -1 into `lastOrientation`. Every repaint
the walk loop queued meanwhile painted that -1, which stateFor wraps to orientation 7 - one front-three-quarter view.
A horse under the Overworld's time scale passes 8 m a frame (about x45 at 60 fps), so it was placed every frame and the
riding clock's sixteen repaints a second beat the orientation's ten. Now the placing asks its repaint with a flag of its
own and never touches `lastOrientation`; a body moving under its own input is never placed (its facing is the move's);
and the floating origin's shift moves the sprite's own feet (an 819 m recentre read as a placing too). Pins:
`test/fb1004e_horseface.test.js` (a gallop at three times PLACE_JUMP_M a frame shows the slow ride's view from behind,
both sides and ahead, never -1; a placing at rest still faces the view; a strafe's gallop keeps the move's facing; the
rebase, and mwViewRebase's call). `test/arena_fix.test.js`'s ARENA-FIX 14 pins hold.

## The gates

Lint, the types, the bible's gates and the changed files' suites run clean before the push; `tools/mutants/fb1004e.json`
(61 records). Re-aimed BY CONTENT where this slice moved their text: `pscale1.json` and `auditpscale1.json` (the
wanderer's count, roadEncounters.js wandererCount), `fb0929d_mapkey.json` (the key's signature grew the players' row),
`hub1.json` (the I box names the holder), `ows1.json`, `tv3.json`, `tv5.json` (the marks' new fields) and `arenafix.json`
(the undercroft's rest gate).
