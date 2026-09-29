# FIELD BUGS 2026-09-29 - the realm's first evening

From the Discord (#bug-reports and #suggestions), through Mac, as eight screenshots and a ninth that came in while the
first eight were being worked:

1. EnragedBard (Tony H.: "Same thing happened to me"): *"I've previously played this character online before the current
   update ... when I press the button is says, 'Only a character you have already played online can be brought into the
   realm.'"*
2. Dracula/Valentin: *"MY GUILD IS GONE, I LOST ALL MY MONEY AND I CANT TRAVEL ... IT TOOK ALL MY MONEY BECAUSE OF LOANS
   (HOW TF WAS I SUPPOSED TO KNOW YALL WOULD FORCE THE LOANS TO BE PAID ON FUTURE UPDATE) AND IT SOMEHOW DELETED MY
   GUILD"* - and their suggestion thread, *"PLEASE allow vampires..."*: travel by day under a hood (Starempire42), which
   Sir McMobdon called a good idea.
3. Cruor: *"Bugged Mark item with an error!"* - a Mark of Featherweight reading "Cast when used: ERROR".
4. lumin: *"Vendors selling items for 0 gold"* - bandages; "There should be a hard minimum of 1 gold for anything."
5. Satranath: *"Can't free mouse on Overworld until after pressing Escape (Y doesn't work)"*.
6. Satranath: *"Defending vs raids impossible, guards arrest you"* - with "protect civilians from melee attacks" on.
7. SylviaBun: *"New Overworld map lags when fast-traveling to a distant location"* - sub-10 FPS once a far destination is
   picked on the Travel Map.
8. DoubleDutchess: *"Tiny furniture ... Benches for ants?"* - in a dungeon.

Mac answered the three calls the realm's reports asked for (`06-Systems/Realm-Arc.md` Decisions 6-8): the census admits
**"Any pre-realm trace"**, homes and guild places **"Carry them"**, and customs **"Call in all loans"** - told first.

## CUSTOMS-CARRY: who comes in, what comes with them, and the door says so first (1, 2)

**Reproduced first.** `test/fb0929_customs.test.js` drives the real Worker over the real migrations: a character with a
cloud backup from before the realm and no Renown track is refused `customs-never-online` - the field's refusal.

**Why.** Migration 0020 took the realm's census - "the characters that played online before the realm" (decision 3) - of
`renown_tracks` alone, and a track is only ever written with XP to hold (AUDIT RENOWN1 DATA-7): a first online KILL,
since RENOWN1 on 2026-09-24. A character played online before that, or one that walked the Bay online and never killed,
had no track, so the census never counted it. And AUDIT REALM2 S2 had customs carry the Renown track and nothing else:
a character's online home and guild place stayed under its offline id, which can never come online again - Dracula's
guild "deleted" (its master gone, its name and tag kept from any founding), a house exclusive to nobody who could walk
in. Customs itself did what the plan says (every loan called in, the wealth capped at the allowance), but the door said
so only after it had run, and it runs once.

**The fix.**

- **The census counts every trace from before the realm** (migration 0022): an online home, a guild place, a raid fought
  and a cloud backup, each stamped before 1790638734 (the commit that brought 0020 to main). A backup proves the
  character stood before the realm, not that it played online - Mac's call. The census stays frozen at the realm's
  start, so a Copy to offline's new id never counts (L1-F5), and "once" stays the character's on every account (L3-F2).
  The refusal names what counts.
- **Customs carries the online homes and the guild place again** (`server-account/src/realm.js` `CHARACTER_TABLES`), and
  0022 carried them for every character customs had already made - Dracula's guild comes back to their realm character.
  They are what stood before the realm (since the realm only a realm character claims, places or founds - S2's rule
  stands) and pay out nothing that was not the realm's (0020's `paid` and `realm_gold`: the carried house sells for
  nothing, the treasury's old gold stays the guild's). A realm character already in a guild keeps it.
- **Bring online asks first.** The press shows what customs will do - the loans it calls in, what the allowance leaves
  behind, the deeds that stay, that the homes and guild place cross, that the offline character keeps everything - off
  customs run on a copy, and runs it on the answer.

Pinned: `test/fb0929_customs.test.js` (5), `tools/mutants/fb0929_customs.json` (13 mutants, 13 dead); S2's pins flipped
to the new law and their mutants re-aimed. `06-Systems/Realm-Arc.md` CUSTOMS-CARRY.

## FEATHERWEIGHT: the Mark that read "ERROR" (3)

The item is DFU's own and whole: MAGIC.DEF's *%it of Featherweight* is one CastWhenUsed slot at classic spell 37,
Slowfalling; used, it casts Slowfalling on its user for 10 of its 1500 condition. The READER was wrong: DFU's
MagicPowers (DaggerfallUnityItemMCP.cs:345-363) names a CastWhen* spell out of the whole of SPELLS.STD, and
`itemPowers.js` asked the item maker's list for that one power - which offers Slowfalling only as Cast When Held. It
reads the SPELLS.STD registry now (and, until that lands, the catalogue's three CastWhen* lists as one table). A saved
Mark reads right on load. `test/fb0929_featherweight.test.js` (5), `tools/mutants/fb0929_featherweight.json` (4, 4
dead). `06-Systems/Systems-Arc.md` FEATHERWEIGHT.

## FB0929: the Overworld's mouse, free from its first frame (5)

A browser answers a pointer-lock request a task later, and `releaseLook` lets go only of a lock that is HELD. A journey
begun or resumed on the map raises the Overworld on the frame after the map goes down (`world.js` `tvJourneyUp`) - the
very frame whose look gate has just asked for the lock back on the map's close edge - so the view's `freeCursor` found
nothing to release, and the lock landed under a view whose cursor is its own: the mouse captured, Y refused under the
view (TV1's law, which stands), until the browser's own Escape. The map's Overworld button never raced. The toggle's
lock-change listener now lets go of a lock that lands while the cursor is free (`player/pointerLock.js`) - the law of
every host that binds the toggle, and it also covers Y pressed while a click's relock is in flight. Reproduced in a
Node test and in real Chromium first. `test/fb0929_overworld_mouse.test.js` (3),
`tools/mutants/fb0929_overworld_mouse.json` (3, 3 dead). `06-Systems/Travel-View.md` FB0929.

## FB0929 (min price): a purchase is never free (4)

Daggerfall's cost law and haggle, to the bit: CalculateCost floors a piece at 2 gold, and CalculateTradePrice's buying
arm (FormulaHelper.cs:2000) scales the lot by 66/256 to 256/256 and truncates - so a piece at that floor (a bandage off
the General Store's own shelf, a candle, the parchment worth 0, a Climates & Calories apple, a cheap blade's repair)
went for nothing over about a third of the counters and hagglers it meets, and a stack for less than a gold a piece.
Reproduced with the real shelf first. Mac's word in the report ("a hard minimum of 1 gold for anything") is the law,
Port-Ledger A: `tradeModes.js` `getTradePrice` asks Buy and Repair for a gold a piece at least (`tradeCost` counts the
pieces in the walk that totals the cost) and Daggerfall's number wherever it is more. The classic and enhanced
counters, the enhanced quote and the keyed shelf and repair rows all price through it, so what a counter shows is what
it takes. The SALE is not floored - online a shop pays at most half its ask (P0.4), and a floored sale would mint gold -
so the floor only raises an ask, and it shut Daggerfall's own loop (a bandage bought for nothing and sold back for a
gold). `test/fb0929_min_price.test.js` (8), `tools/mutants/fb0929.json` (17, 17 dead). `06-Systems/Systems-Arc.md`
FB0929.

## FB0929 (raids): the swing no longer finds the town's defenders (6)

The setting is DFU's MeleeAttackFriendlyProtection ("Protect Friendlies and Neutrals"). The world host offered each
swing to the watch, the monsters, then the defenders ALONE (DISC19-F), and that last pass took the nearest defender in
reach and view - Audit 28's stand-in for DFU's look ray - so every swing that met no raider fell on one. A blow on a
defender is Assault (AUDIT DISC19 W2): the squad turned, the Halt box lowered the region's standing, and the court
followed. Reproduced in node first (crime 4, both defenders hostile and hunting the player). Under the protection the
watch's pool now spares its defenders on every pass (`cityGuards.resolvePlayerHit`), as the player's spells, shafts and
torches always have, and a defender on the look ray stops the swing short of the townsperson behind. With the
protection off nothing changes. Port-Ledger A (DFU's ray would still strike an ally alone in front).
`test/fb0929_raidguards.test.js` (3), `tools/mutants/fb0929_raidguards.json` (5, 5 dead). `03-World/Raiding-Parties.md`
FB0929.

## RAID-GUARDS and RAID-REP: Mac's two follow-ups on the raids (6)

Mac, after FB0929: *"1. Raids shouldnt let you damage the guards 2. Town raids are supposed to improve the region the
player is at, need more testing but I think it improves rep in all regions kinda broken if so"*.

- **RAID-GUARDS.** While a raid is on in the town, its defenders take none of the player's blows, whatever the setting.
  `cityGuards.playerSpares` asks one question - a defender, under friendly protection or with a raid on here (the
  world host answers `raidHere` with `raidDefendingHere`) - and the swing's pass and the riding charge's list ask it,
  while the guards' damage door refuses any blow of the player's on a raid's defender by whatever road it came: it
  lands nothing and raises no Assault. The crime watch is never spared; with no raid on and the protection off, DFU's
  rule stands. Spells, shafts and thrown torches always passed a defender by. Online, a peer's watchman puppet can
  still flash under my swing, but its owner refuses the blow. `test/fb0929_raidguards.test.js` (now 5),
  `tools/mutants/raidguards.json` (8, 8 dead).
- **RAID-REP: checked, and not broken.** GrantReputation raises the raided region's legal reputation, its People and
  its first knightly order - for a player who fought and stands on the town's pixel - and no other region's. The one
  standing that is no region's is Kamer's +3 with the Fighters Guild, which the Standing page shows everywhere (the
  likely source of the impression). Pinned with the other region's factions first in the dictionary, so a law that
  forgot the region would pay them. `03-World/Raiding-Parties.md` RAID-GUARDS, RAID-REP.

## FB0929 (far route): the Overworld's line, cut to the screen (7)

The route was planned once, at the pick; the per-frame cost was its LINE. `routePath` drew one dashed SVG path through
every projected point of the journey, and a far pick is 139 legs and 557 points - a point beside the eye's plane
projects hundreds of thousands of pixels out, so the path ran about 1.5 million pixels and the browser laid some
100,000 dashes, off the screen too, and rastered them again every frame the camera moved: 383-433 ms a frame in
Chromium, the median. PERF-TV's probe had timed JavaScript and layout, never paint, over a route that stayed on the
screen. The line is cut to the screen grown by `ROUTE_CLIP_PX` now (`ui/travelViewHud.js`): on the screen it is the
same line (byte for byte when it is all on screen), and a far pick draws in 16.7 ms. The planner and the journey are
untouched. `test/fb0929_farroute.test.js` (4), `tools/mutants/fb0929_farroute.json` (13, 13 dead),
`tools/travelViewPerf.mjs` times the frames now. `06-Systems/Travel-View.md` PERF-TV.

## VAMP-HOOD: a vampire with its hood up travels by day (2, the suggestion)

What stopped the vampire was never the sun - VAMP-DAY (2026-09-26) had already taken the burn away for a -20 by day.
It was the map's door: `vampirism.js` `racialFastTravelBlock` refuses fast travel whenever the clock says day, and the
Overworld's and Travel Options' walked journeys start behind the same door. Online the shared clock's day is one real
hour that no rest or trip shortens, and since REALM a realm character cannot slip offline to pass it - Dracula's "wait
1 hour to travel anywhere". Now `racialSunAverse` asks the hood: under a cloak or plain robes worn hood up
(`survival/temperature.js` `cloakState`, the felt temperature's one hood law) the door opens by day and an arrival is
not pushed to dusk; a bare head is refused with DFU's line and "Raise the hood of a cloak or robe to travel by day." The
day's -20 stays (it is the hour's, not the sun's). Port-Ledger A: Starempire42's suggestion, which Sir McMobdon called a good idea, sent in by Mac with the reports.
`test/fb0929_vampirehood.test.js` (6), `tools/mutants/vamphood.json` (11, 11 dead). `06-Systems/Systems-Arc.md`
VAMP-HOOD.

## The benches (8): not reproduced

No code path the port owns shrinks a model in a dungeon. `rdbLayout.js` `getModelMatrix` is translation times three
rotations, as DFU's; the dungeon host adds only the block's origin and bakes it into the static batch; its only
models are the block's own placements (a custom model is one of Detailed Ships' stand-ins, none a bench); a mod's
dungeon block from JSON carries no scale; the gibs are sprites; nothing online stands furniture in a dungeon. What is
left is the data itself - the block may place a small furniture model at an angle, which DFU would draw the same way -
or a place that was not a dungeon (Detailed Ships' own records squash beds into bunks and benches to 0.58 below decks).
**Wanted: the dungeon's name, or a save standing in it**, and the block's furniture is listed against the real ARENA2
in minutes.



## For Mac

- **The deploy.** Migration 0022 rides the account service's next deploy (it applies on the push to main, ACC1-CI): the
  census widens and every customs character already made takes its home and guild place at that moment.
- **Left open:** a home or guild place under an origin whose realm character was since DELETED still stands under the
  dead id (a building nobody can buy); 0022 moves nothing no realm character stands on.
- **The Fighters Guild's +3 for a cleansed town** is Kamer's and global - the one part of a raid's reward that is no
  region's. Say if it should go.
- **The hood** lifts the day's travel ban only; the -20 by day stays under it, a custom class's Damage from Sunlight is
  a chosen disadvantage and is not lifted, and no rule has guards spotting vampires, so a hood hides nothing from them.
  The unbound Overworld key never asked the sun at all.
- **A repair is floored too** (DFU groups it with Buy): a rank-9 Fighters Guild member's cheap mend costs a gold now.
  A cheap piece inside a dearer lot can still add nothing, because the lot is haggled once, as DFU does.
- **One test flaked once under load** (`test/realm6.test.js`'s end-to-end sale) during a full changed-files run; it
  passed alone and in 22 runs after, 16 of them at once. Noted, not explained.
- **MAGIC.DEF, not DFU's patched templates.** DFU 0.11.1+ builds magic items from its bundled MagicItemTemplates.txt;
  the port reads the player's own MAGIC.DEF. On an unpatched MAGIC.DEF a record could differ from DFU's.
