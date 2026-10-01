# FIELD BUGS 2026-09-30b - the fishing death, the tools that gathered nothing, the werewolf's bank, the falling foe, the unmarked residence, the Overworld's surf

Five screenshots of the Discord's #support and #general, and one line of Mac's own beside them: *"Also you can get
instakilled when fishing"*. The rule for a batch like it: every report root-caused on the real modules, the port's own
faults fixed and pinned, and what was Daggerfall's own (or a mod's) fixed wherever it failed the player - Mac, on this
batch's first answer, which had left the drowning collapse and the tools' Foraging use as the source's: *"I dont care
about DFU. We're our own thing now."* So SWIM-SPENT and TOOL-USE, and nothing here is offered back. Six
investigations ran first, each on the real modules with a reproduction; the fixes were built and pinned one to a tag.
The letter is this batch's own: 30's page is PR #468's.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "you can get instakilled when fishing" | Mac | on a lake the net works only while the angler swims, and a swimmer holding still pays the swim's fatigue (8 or 33 a game minute); at 0 in the water DFU's collapse is death whatever the health, said after it - the day's forty hauls take about as long as a 6,400 bar lasts at Swimming 5, and nine seeded days in twenty died inside them | fixed (FISH-TIRED, SWIM-SPENT) |
| 2 | "I've been chopping wood but it doesn't look like anything about the logging profession is changing"; "using my sickle to gather herbs in the wild, but I dont get any exp"; "I fish, or use the axe and I get no exp ... I just physically get lumber in the misc tab" ("Skinning is working though") | midijamz, Maevin, 名無しの人 | a tool used from the pack or the hotbar is Foraging's own gesture (FORAGE0 law 4) - the mod's yields into the pack, its quest, no profession - and nothing said so; the professions gather only at their nodes | fixed (TOOL-SAID, then TOOL-USE) |
| 3 | "is it normal when u become a werewolf you loose the gold in your bank and u have to rejoin fighters guild~?" | Guppy | the curse takes nothing (walked on the real tick, a save and a load with it); online every bank is "The Bank of the Empire" but a deposit lives in its region's account, and the teller in another region read "Account balance 0" | fixed (BANK-REGION); the rest said |
| 4 | "constant fps drop in overworld? Resets after saving\loading, heard its from an enemy endlessly falling through the ground somewhere" | ReynBlackwinter | a World of Daggerfall camp's foe (never culled) re-minted by a load over a pixel not built falls for ever, and every fixed step of the fall costs more collider work - 2,560 capsule resolves a frame from 201.6 s, one foe | fixed (FALL-HOLD) |
| 5 | "a couple quests that take place a <someone>'s residence. People aren't marking it on the map ... every door looks like just a house I can buy" | midijamz | three: the Enhanced town sheet never rang a residence an NPC had marked (it is override-named at its discovery); DFU's 35% roll marks 26 questions in 100; a nameless house drew no plaque, so its HOME2 verbs never showed and the first click at any house asked "Buy it?" | fixed (RES-RING, RES-MARK, HOME-PLAQUE) |
| 6 | a screenshot: the Overworld over a coast, the sea laid over with light-blue rectangles | (no words) | Come Sail Away's breaker strips, surf from a ground eye, seen whole from the travel view's 150-450 m | fixed (TV-SURF) |
| 7 | "If i battle I'll die / And I was trying to sail to Privateers hold" ("I can't fix it without battling") | ItMustBeMonday | answered in the thread by Mac ("Okay I got you"); the words do not say what the fight is | asked |

Pins: `test/fb0930b_{fishtired,swimspent,toolsaid,bankregion,fallhold,questresidence,tvsurf}.test.js` (31), each file
red on the code before (guards green both sides: `bankregion`'s walk of the curse, `fallhold`'s interior floor,
`toolsaid`'s lanes). Mutants: `tools/mutants/fb0930b_*.json`, 95 records, 95 dead; older records re-aimed by content
(`em34` EM4-14, `forage1` FORAGE1-18, `foecatchup`'s two step records, `csa_close`'s CSA-J dungeon hook, and the four
cite records of `survtiers`/`survtiers3` the cite shift moved), all dead.

## FISH-TIRED: no net in the water on the last quarter of the fatigue bar (1)

**Reproduced first** (the real gathering host, Fishing's kind and act, the real player ticker - `scenes/shared.js`
createPlayerTicker over `systems/worldTick.js` - and world.js's collapse over them): an angler in a lake, Swimming 5,
STR and END 50 (a 6,400 bar), fishing the day's forty. From a full bar nine of twenty seeded days died inside the forty
(hauls 36-39); from three quarters at haul 31 (12.6 real minutes), from half at haul 21 - each at 100 health. The same
angler on a pier at sea spends no fatigue and fishes all forty.

**Why.** The net works in its water (FORAGE0 6.4's test, `netHasWater`): swimming, or at sea - on a lake, that is
swimming. The minute's band charges a swimmer holding still the swim's price: FATIGUE-IDLE spares only `standing &&
!swimming` (`worldTick.js`), and the swim arm costs 44 on a failed Swimming roll and 11 on a passed one, times 0.75 - 33
or 8 a game minute, a game minute every five real seconds. MEASURED through the ticker: 6.34 fatigue a real second at
Swimming 5 (the bar gone in 16.8 minutes), 4.71 at Swimming 40, 1.59 at Swimming 100 or for an Argonian. At 0 in the
water DFU's collapse is death, whatever the health: PlayerEntity.OnExhausted `SetHealth(0)`s a swimmer
(`systems/rest.js` exhaustionOutcome, world.js onExhaustedExterior's `hurtPlayer(entity, entity.health)`), and the only
line is the one after it. Nothing warns: no fatigue line exists in the port, only the HUD's bar - while each cast holds
the eye on its meter for 5-85 s. A Lamia's fatigue rider (damage x 128 a hit; two in twenty of the underwater table)
reaches the same death.

**The fix** (`scenes/fishHost.js`): the net keeps its angler off the collapse (the collapse itself is SWIM-SPENT's,
below): no cast in the water under a quarter of the fatigue bar (`NET_TIRED_SHARE`), and an act there ends when the bar
falls into it (the kind's frame cancels the act it started); the prompt and E say "too tired to fish in the water - get
out and rest", with a quarter of the bar to swim out on (of 6,400, four minutes of treading water at the worst rate).
The test is the collapse's own - Foraging's world's `swimming`, `isPlayerSwimming` - so a pier or a deck asks nothing.
`test/fb0930b_fishtired.test.js` (3), red on the code before.

**Not chosen.** Charging a still swimmer nothing (a change to every swimmer; FATIGUE-IDLE kept the swim's price on
purpose, and it misses the Lamia); a warning alone (a toast among the haul toasts, and the trap still set).
**Found on the way, left.** At sea, an angler between 62.5 kg carried (the afloat line, weight x 4 > 250) and the net's
encumbrance check (75 kg at STR 50) casts while sinking - DFU and Deep Waters' own law, with its line ("You are
carrying too much to stay afloat.") and some 30 s of breath; a trophy (1 in 200 hauls) can push a pack over it. For Mac.

## SWIM-SPENT: a swimmer who runs out of fatigue drowns, not at once (1)

Mac, on this batch's first answer - which fixed the net and left the collapse as DFU's: *"I dont care about DFU.
We're our own thing now."*

**Why.** DFU's PlayerEntity.OnExhausted `SetHealth(0)`s a swimmer whose fatigue runs out, whatever the health, and says
so only after ("Fatigue overcomes you and sends you to a watery grave....") in a box that held the swimmer still. The
port kept it 1:1 in the three hosts a swimmer can collapse in (`scenes/world.js`, `scenes/exterior.js`,
`scenes/dungeonContext.js`). FISH-TIRED keeps the net's angler off the last quarter of the bar; the death itself stood
for every swimmer, and for a Lamia's fatigue rider.

**The fix** (`systems/rest.js` exhaustionOutcome, the three hosts): in the water a drain to nothing is `drown` - a
tenth of the health pool (`EXHAUSTED_SWIM_SHARE`, never nothing), and "You are too exhausted to swim - get out of the
water!" on the HUD, with no box. The ticker drains to nothing once a game minute while the swimmer stays in the water,
so MEASURED on the real ticker: from full health a drain at 5, 10 ... 50 real seconds, dead at 50 - where it was dead at
the first. At the shore the collapse is the rest hour it always was, and on dry feet foes about still kill. Come Sail
Away hears no death of a swimmer still swimming (its OnPlayerDeath rides the collapse's two arms). The interior host
passes no swimmer and is unchanged. `test/fb0930b_swimspent.test.js` (3), red on the code before; `rest`'s water case
and `csa_close`'s CSA-J dungeon pin re-aimed (PIN MOVED), `fishtired`'s stand-in for world.js given the drown arm.

## TOOL-SAID, then TOOL-USE: a profession tool is the profession's (2)

**Reproduced first** (the real `installForaging`, `useItem`, `hotbarPress` -> `useQuickslot` and an open `profBook`,
`?online=1`): Foraging is on online by default (MO1; `'foraging'` is in `ONLINE_PLAYERS_OWN_MODS`, never forced) and all
six tools offer Use. The pack's Wood-Axe says "You were able to chop and gather three Wood Bundles!", three Wood
Bundles land in the misc tab (UselessItems2), ChopWoodQuest starts and the axe wears to 49; the Sickle and the Pick-Axe
say nothing at all (a quest and its wait page, "Forage for Plants...", "Mine for Gems or Elements..."); the Fishing-Net
catches two Raw Fish into the pack - C&C's item, the Stores' haul material's name. The hotbar's axe is the same use.
Harvests asked of the service: none. Stores: empty. Logging XP: 0.

**Why.** FORAGE0 law 4, Mac's: "A Foraging tool used from the inventory is Foraging, both lanes ... Neither gesture
changes the other". The professions gather only at their nodes (E at an herb patch, a tree, a vein or a boulder, a body,
the water with a net - PROF0 law 5: every harvest an act the player plays), and nothing the player saw said so: the Use
never said what it was, the Professions page said how to gather for Hunting and Fishing alone, and the empty Stores
said "What you gather online is kept here" beside a pack filling with lumber. Skinning "works" because the Skinning
Knife has no Use: a body is its only gesture. The same misreading is 30's CHOP-WAIT ("the woodcutting animation") and
29h's report 2 (the pack's Pick-Axe beside a vein, For Mac 1).

**The first fix** (TOOL-SAID, `systems/foragingInstall.js`, `ui/profPages.js`, `scenes/world.js` `setForagingHost`),
kept to laws 1 and 4: online, while the professions are the account's, a Use of the Wood-Axe, the Pick-Axe, the Sickle,
the Basket or the Fishing-Net says after the mod's own words - in the same box, which the hotbar says too - that it earns
no XP and where the profession is done, naming the node and the bound key ("No Logging XP from this. Logging is done at
a tree in the wilderness: walk up to one until the prompt shows, then press E. Only some trees can be felled each
day."); a refused Use says it after the refusal ("You cannot mine in here!"). With Foraging switched off online the Use
is still offered and says the line alone (law 6's exception: the tools are the professions'). The mod's yields, lines
and quests are kept (law 1); offline and a guest's lane are the mod's 1:1; the Spade stays Foraging's alone. The
Professions page says how Herbalism, Mining and Logging gather (`GATHER_HOW`), and the empty Stores where their goods
come from (`STORES_EMPTY_LINE`).

**The fix** (TOOL-USE - Mac, on TOOL-SAID: *"I dont care about DFU. We're our own thing now"*; laws 1 and 4 give way
online): while the professions are the account's, the Wood-Axe, the Pick-Axe, the Sickle, the Basket and the
Fishing-Net are the professions'. Their Use from the hotbar or a quick slot at a node of their own kind is E there
(`scenes/gatherHost.js` `useTool`: each kind declares its `tools`, the target is the tool's kinds' alone under E's own
cone and reach) - the Wood-Axe fells the tree, the Pick-Axe works the vein or the boulder (and a dungeon vein), the
Sickle picks the patch's herbs and the Basket searches it for food (`herbHost.js` `patchPlan`'s `only`: a tool asks
its own harvest whatever the choice key picked, and never starts the other's), the Fishing-Net casts; or the node's
need is said at once. Anywhere else, and from the open pack (its window holds the world off), the Use gives none of
Foraging's yields, quests or wear: it says where the profession is done ("Logging is done at a tree in the
wilderness: walk up to one until the prompt shows, then press E (or use the Wood-Axe)."). Foraging's own refusal
("You cannot mine in here!") is no longer said there. Offline and a guest's lane are the mod's 1:1; the Spade stays
Foraging's alone. The Sickle's Use holds the steady hand itself (no E held: Escape or walking off ends it), and the
net's Use is a tap - the shortest throw, E taking the tug. `test/fb0930b_toolsaid.test.js` (10), over the real
`useItem`, `hotbarPress` and `createGatherHost` with its four kinds; red on the code before.

**Found on the way, left open.** A tree node draws no picture of its own (`treeHost.js` `flatsOf: () => []`): 6 nodes
among 1,664-4,376 tree flats a pixel (MEASURED on `layoutNature` over a grass Woodlands pixel), and E at a tree that is
no node says nothing. For Mac 2.

## BANK-REGION: the curse took nothing; the teller names its region (3)

**Reproduced first** - and the curse cleared: the werewolf turn walked on the real tick, offline and online over
LIVED1's two clocks (the bite, the dream, the turn, the beast and back, a realm save through JSON and `restorePlayer`),
leaves every account where it stood - a 5,000 loan and a second region's deposit with them - and the Fighters Guild at
rank 4, the hall showing no Join; a rank review forty days on changes nothing. Then the bank: 12,345 deposited in
Daggerfall, and the door in Wayrest says "The Bank of the Empire", the Enhanced Plus teller "Bank of the Empire /
Wayrest", "Account balance 0".

**Why.** DFU keeps one account a region (`systems/banking.js`, THE STORE IS PER REGION), and online every bank is the
Empire's (EMPIRE-BANK: the door, the teller's title) and the Empire one lender (a loan a character; a default collected
from every region's account) - so nothing said the account was the region's, and a player in another region read their
gold gone. The one list of every region's account (CreateBankingStatusBox) opens only from the classic sheet's gold
button. The guild half cannot be the curse: a member sees Join again only as a vampire (DFU's own swap to an empty guild
book, `guilds.js` activeMemberships - a cure gives the rank back) or expelled at a monthly review after a probation
notice (`guilds.js`); nothing in the lycanthropy code touches either.

**The fix** (`ui/enhancedPorts.js`): the teller's row reads "Account in <region>", and each other region holding gold
stands beneath it ("Banked in Daggerfall 12,345"), in both lanes; the classic parchment is DFU's and unchanged.
`test/fb0930b_bankregion.test.js` (2): the report red on the code before, and the curse's walk a guard.

**For Guppy** (#support): becoming a werewolf doesn't touch the bank or the guilds; each region keeps its own account,
so the gold is in the region it was deposited in (the classic sheet's gold button lists every one). If the Fighters
Guild still shows Join, a screenshot, and whether the bite was a vampire's.

## FALL-HOLD: a foe over a pixel not built is held, not stepped (4)

**Reproduced first** (the real EnemyAI, Collider and exterior pool, a load over pixels not built): a World of Daggerfall
camp's foe the save kept falls from the load's first frame and never stops - at -576 km after four minutes - and the
pool's cost climbs with it: 12 capsule resolves a frame at 1 s, 577 averaged over 30-60 s, 2,513 at 240 s (0.04 to 4.5
ms a frame, one foe, in node). Saved and loaded again, the foe starts from rest and the cost from 12 - the report's
"resets after saving\loading".

**Why.** World of Daggerfall's camp foes are spawned `placed` (standWodAction): never culled (exteriorFoes.js), and
they outlive their pixel - its teardown frees corpses; only Privateer's Hold's foes go with their block. The save keeps
every live foe where it stands and the load re-mints it there, but the load's teleport waits only for the arrival's
pixel: a camp the player rode away from has no ground built. `heightAt` answers -Infinity off a built pixel, so the
collider has no floor, the restored motor no rest latch, and gravity takes it. Nothing in EnemyAI bounds a fall (DFU's
ApplyGravity has no safeguard either - its loose objects never outlive their terrain), and each fixed step costs more:
`collider.move` sweeps in 0.2625 m pieces, 256 at most (DFU's CharacterController.Move is one sweep), ten capsule and
ninety sphere resolves a piece - 770 capsule resolves a frame at a minute's fall, 2,560 from 201.6 s; at 20 fps
FOE-CATCHUP's three steps make 7,656. The watch is saved and restored the same way, with no distance cull at all.

**The fix** (`characters/enemyMotor.js` `holdFrame`, `scenes/exteriorFoes.js`, `scenes/cityGuards.js`,
`scenes/world.js`): the streaming host's two pools take `groundStands(x, z)` - `heightAt` finite - and a foe whose
column has no built ground is held, not stepped: PlayerMotor.holdFrame's law (the host holds the player the same way,
`_seasonHoldKey`), foe-side. A held foe costs no collider work and drops the senses it latched (`detected` spared it
the cull and held the encounter cap; `inSight` kept its swings; either, or `wouldBeSpawned`, refused the player's
rest); the pixel's build stands it back on its floor, no fall billed. The column alone is asked, never the height: a
flyer, a levitator or a swimmer over built ground, and a Deep Waters swimmer (a carved cell answers its seafloor), step
as before; the interior host and the one-location host hand no law and hold nothing. A quickload's attacker across a
pixel edge still building is kept, where it used to fall and be culled. `test/fb0930b_fallhold.test.js` (8), seven red
on the code before; `foecatchup`'s two step records re-aimed by content.

## RES-RING, RES-MARK, HOME-PLAQUE: a quest's residence, found (5)

**Reproduced first** (`test/fb0930b_questresidence.test.js`: the real QuestMachine with `Place _house_ local house2` in
a crafted town, the real TopicTree fed by the machine's hooks, AnswerPipeline and the talk macros, discovery.js,
`stampResidenceQuestNames` and the Enhanced town sheet): a townsperson's "Let me just mark The T'erdta Residence here on
your map" leaves the Place's hint flag at LocationWasMarkedOnMap and the house discovered under the quest's name - and
the town sheet draws it as any house (`quest: false`) with no ring. At a 0.9 roll the same question answers "north of
here". Online, a click at any other house in Grab or Talk opens "This house can be your home. It costs 4000 gold ...
Buy it?".

**Why - three faults.**
- RES-RING (the port's): every quest house the player learns of is override-named at its discovery (AUDIT 63 F49,
  `discovery.js`), and `stampResidenceQuestNames` stamped `questName` only on the other arm (ExteriorAutomap.cs's
  ladder, :676-682, which the classic plate keeps) - so the Enhanced sheet's ring and quest pen, which read
  `questName`, never drew a marked residence. EM4's ring pins set `questName` by hand on a record the game does not make.
- RES-MARK (DFU's own): TalkManager's hint marks the map on a roll of 0.35 or under, outdoors
  (:1707-1723); MEASURED over 20,000 seeded questions, a street commoner who knows a local building marks it 26 times in
  100, gives "north of here" 49 times and does not know 25 - and a residence has no sign on its door.
- HOME-PLAQUE (the port's): a private house has no name (DFU's BuildingNames names none), a nameless door draws no
  plaque (`worldTooltips.js` `staticDoorName`), and HOME2's verbs ride the plaque: "Its door lists Buy it, Go in" held
  only for a building named "House for sale". At every other house the first click fell through to HOME-OFFER's box.
  The quest's own house was named ("To The T'erdta Residence"), never for sale (`homePurchasable`,
  `isActiveQuestBuilding`), and opened - among doors that all asked to be bought.

**The fix.** RES-RING (`ui/exteriorAutomapWindow.js`, `ui/townSheet.js`): the stamp says `questMarked` on either arm, and
the sheet's pen and ring read it; the classic plate's ladder is unchanged. RES-MARK (Port-Ledger A,
`systems/answerPipeline.js`): a quest's own building (its row a quest resource's) is marked by one who knows, outdoors,
whatever the roll; every other building keeps DFU's roll, and indoors never marks. HOME-PLAQUE (`systems/onlineHomes.js`
`homeDoorName`, `scenes/worldModes.js`): a nameless house whose door has verbs to list is named with DFU's own word,
"Residence" (Internal_Strings 50): its plaque stands, "Go in" lit, and the click goes in; the quest's residence reads
apart by its name. `test/fb0930b_questresidence.test.js` (3), red on the code before; `answerpipeline`'s quest-person
hint at 0.9 re-aimed to the map (PIN MOVED), `home2`, `home1` and `empirebank`'s door-name source pins re-aimed.

**Left as they are.** A quest person's generated home (`_contact_home_`) is a second quest "Residence" under General
(DFU's `Person.AssignHomeTown`). With World Tooltips off, or on a phone, a house still asks HOME-OFFER's question once a
session (Mac's HOME-OFFER). `questSiteHere` asks the quests of the town the player stands in while the offer uses the
door's own town - a quest house in a neighbouring town could be offered; read, not reproduced (For Mac).

## TV-SURF: Come Sail Away's breakers wait for the traveller's eye (6)

**Reproduced first** (the port's own passes - the Deep Waters floor and top, the Come Sail Away wave renderer with the
author's shipped paints - over a synthetic diagonal coast, rendered from 400 m at 45 degrees): pixel-aligned light-blue
dithered sheets with straight edges over the sea, the screenshot's; the same frame without the waves is a sea that
follows the coast. The screenshot's sheet is a checker at one screen pixel over the plain sea - the 29 sea #4 Bayer
discard at half coverage - its lit colour the material's tint (0.5, 0.75, 1) over near-white.

**Why.** CSA-F's breakers, ported 1:1: from each water pixel (WOODS height 2 or less, no quarter-point ray over 1 m
above the sea) a flat fan toward every land neighbour, a quarter-pixel inside the water out to the land pixel's centre
(some 614 m), 0.1 m over the sea, within Waves.Distance (2) pixels of the player. From a ground eye - DFU has no other -
it is seen edge-on, surf. Where a "land" pixel is mostly water (a bay, a coast through the pixel) the strip lies on
open water and stops in a straight line at the land pixel's centre line; MEASURED on a diagonal coast, some 70% of its
visible area lies over water more than 150 m from the shore. The travel view (TV1) is the port's own raised eye, and
its list of ground-eye passes to adapt (fog, clouds, rain, shadows, grass, billboards, the far ring) missed the waves:
`csaDrawWaves()` ran on every exterior frame.

**The fix** (`scenes/world.js`): `if (!tvf) csaDrawWaves();` - the travel view's own gate, the grass's. Only the
drawing: the waves' state (the currents, the helm's neighbours) is untouched. `test/fb0930b_tvsurf.test.js` (2);
`fbsea_water`'s order pin re-aimed at the gated line (PIN MOVED).

## For Mac

1. **The trees.** A tree node draws no picture of its own and stands 6 among 1,664-4,376 tree flats a pixel; E (or the
   Wood-Axe) at a tree that is no node says nothing, and the Logging notes say "look at a tree and press E". A node's
   own mark, or a line at a tree that is none, is a design call.
2. **TOOL-USE's two feels.** The Sickle's Use holds the steady hand without E (letting go ends nothing; Escape, walking
   off or a bruise does), and the Fishing-Net's Use throws the shortest cast (3 m) where a held E winds it farther - a
   default wind is one line.
3. **Offline.** Offline, the tools are still Foraging's 1:1 (there are no professions offline); "our own thing" may
   reach there too.
4. **A sinking angler at sea.** Between the afloat line (62.5 kg carried, whatever the STR) and the net's encumbrance
   check (75 kg at STR 50) the net casts while its angler sinks, with its line and some 30 s of breath; a trophy (1 in
   200 hauls) can push a pack over it. A trophy that would sink its swimmer could go to the Stores instead.
5. **Exhaustion with foes about** on dry feet is still DFU's death, whatever the health - no report named it, but it is
   the same shape SWIM-SPENT ended in the water.
6. **A quest house in a neighbouring town.** `questSiteHere` asks the quests of the town the player stands in while the
   home offer uses the door's own town (`homeTownOf`), so a quest house across a town line could be offered for sale -
   read, not reproduced.
7. **ItMustBeMonday (7)**: what the fight at sea was, if it was not what you answered in the thread.
