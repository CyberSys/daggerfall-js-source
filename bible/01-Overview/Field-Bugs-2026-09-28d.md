# FIELD BUGS 2026-09-28d - the deck, the level box, the cursed stars, the passage, the frame rate

Mac, with four screenshots of the Discord's bug-reports threads and one line of Mac's own. This page is the batch's
record; each fix has its own section below. Then Mac's answers to the page's own questions: SHIP-SAIL and FPS-VSYNC.
Mutants: `tools/mutants/disc28d.json` (34, all dead).

The list, as the screenshots carried it:

1. michelle!!, *"unable to add attributes"*: *"i'm having issues adding attributes on create a character. i can't see
   the different options. i've tried safari and firefox and switching to landscape."* Her screenshot: the Strength
   description, "What these buy you", "12 left to spend", Roll again, Back, a red *"CRASH (2) / unknown error"* box. A
   reply in the thread: *"I actually use classic to create the character, then save and go back to enhanced"*.
2. dragonatg, *"Level Progress Inconsistency"*: *"The level progress is inconsistent between the Uis. On GrimoireUi a
   level progress of 93% is only 12/100 on EnhancedPlus."*
3. Regi, *"FPS issues and FPS limit"*: *"FPS are TANKING when my character loads into the outdoors (see first video).
   When I try a test room character, this issue is resolved (second video). Settings are also set for 300 FPS but it
   seems it's limited to 60 (possibly by vsync)."* Then: *"There was also a mysterious "uc crash" but i haven't managed
   to get the popup again."*
4. Megatronism, *"Werewolf (ect..) level up bug"*: *"The permanent stat bonuses from being a werewolf (vampire, ect...)
   Do not appear on the level up screen, only showing what your stats would be before the bonuses were applied. You
   can actually put points into an already maxed out attribute if you are not careful, and waste part of your level
   up, since it will show the attribute as being less than it really is."*
5. Mac: *"Also a bug where a player is at a port but unable to set sail"*.

## SHIP-PORT: the deck is no port (5)

No screenshot came with it, so every door to the sea was read against the retail MAPS.BSA before anything was
changed. Four systems sail, and three of them read "a port" three ways: the travel map's passage (Travel Options'
378 harbours, `systems/travelPorts.js`, the mod's own list verbatim), the bank's ship and Come Sail Away's deeds (the
location's `PortTownAndUnknown` byte), and the Overworld's crossing (no port at all - the player's own boat to hand).
The two lists do not fight: of the 15,251 locations, 343 carry the byte and every one of them is among the 378 (the
other 35 are the mod's additions). So no harbour where the bank sells a ship refuses the passage.

What does refuse it is the player's own ship. Bought at the bank and boarded from the transport picker, it puts the
player on "Your Ship" (2,2 or 5,5) - in neither list - and Travel Options' `IsNotAtPort` asks of the pixel stood on,
while every trip from the deck is reckoned from the port the ship was boarded at (`playerTravelOrigin`,
TravelTimeCalculator.GetPlayerTravelPosition). So the map refused By ship ("since there's no port"), knocked it off as
it opened, and By land walked from the deck onto the sea into the mod's ocean stop ("maybe you should travel on a
ship") - a player on their own ship in a harbour could not sail it anywhere. The mod does the same (it reads
PlayerGPS.CurrentLocation), but its own `HasNoOceanTravel` names `IsOnShip` - the passage from the deck it meant. The
one dep bag both maps and a party's fare read now hands the ship laws the boarding port when the player stands on
their ship (`travelOriginMapId`); ashore nothing changed. Departure 20 in `06-Systems/Travel-Options.md`.

Two more on the same road:

- **The re-bill.** The enhanced map's card priced the trip, then ran the mod's OnPush guard and never priced it again,
  so a guard that knocked the ship off showed By land over the ship's days and fare, and Begin gold-checked that fare -
  a walk refused for gold it does not cost. The card re-bills whenever the guard moved the ship, as the classic window
  refreshes after its guard.
- **The Overworld's line.** The Overworld sails the player's own boats alone (OWS2); with none to hand, a place across
  the water was refused with "a boat would carry you across the water" - which at a port reads as no way to sail. At
  first the line named the map's passage; Mac's answer made it the passage itself - SHIP-SAIL, below.

Not changed, and why: Come Sail Away's "Unable to raise sail. Boat is obstructed." is the mod's own refusal while any
of a boat's five nodes reads land (`03-World/Come-Sail-Away.md`, seen on Daggerfall's town pond), and its deeds want
a port by the byte within its search square - both 1:1. CORRECTED: this page first said the classic window and a
party's fare run the mod's guard before pricing the trip, so a fresh popup read the ocean as none. They do not - the
popup prices itself as it is built (`TravelPopUpWindow`'s constructor ends in `refresh()`), so its guard sees the
water; `test/disc28d_shipport.test.js` pins it through the real popup. `test/disc28d_shipport.test.js` (5).

## LEVEL-PCT: the classic Level box reads the law that levels the character (2)

GrimoireUI is the classic skin under an art pack (`10-UI/Overhauls.md`), so its "Progress made to the next level: 93%"
is the classic sheet's Level box (`ui/charsheet.js` `_showLevel`), and Enhanced Plus's "Toward the next 12/100" is the
Ascension's crown. The crown asks whose law levels the character; the box never did. A character who chose Oblivion
Remaster-like levelling at creation (ORL1) levels by a bar out of 100 - and still has DFU's skill sum kept
(`advancement.js` raiseSkills feeds both), a sum that levels nothing for them. The report's numbers are one history:
one primary raise and two miscellaneous ones put 8 + 2 + 2 on the bar and 1 on the sum, which DFU's arithmetic reads
as 93%. The box now reads the bar for such a character (12%), through `levelBarProgress`, the one reading the crown
draws too.

Found beside it: the box's DFU arithmetic was a double's. DFU holds the level in a `float currentLevel`
(DaggerfallCharacterSheetWindow.cs:782), so the quotient is a single before its fraction is taken; in a double 36/15's
fraction is 0.3999... and 27/15's 0.8000..., and the box read 39% and 80% where DFU's reads 40% and 79%. It is a
single now (`Math.fround`), pinned against DFU's own values for spans 26 to 41. `test/disc28d_levelpct.test.js` (3),
four mutants.

## ASCEND-LIVE: the Ascension's stars wear what the character has (4)

Every level-up lane spends and caps the PERMANENT value - DFU's StatsRollout draws and caps GetPermanentStatValue and
the mod reads `.base` - and still does. The curse's bonuses ride the live channel (a werewolf's +40 on Strength,
Agility, Endurance and Speed; a vampire's +20 by night, -20 by day), so the Ascension's stars, read off the permanent
value, said 63 for a werewolf whose Stats page says 100, and a point there moved nothing the player has while the
curse lasts. A row now carries its live value (liveStat's own law over the working permanent value) and whether a
press the law allows would show; the star wears the live value, tinted as the classic sheet tints a live value above
or below its permanent one, and the chosen star's line says it in words: "100 with its bonus - a point here shows only
once that ends". The presses, the caps and the exit gate are unchanged. The classic skin's level-up is DFU's own
window (DFU draws the permanent values there too) and is untouched. `10-UI/UI-Arc.md` ASCEND-LIVE;
`test/disc28d_ascendlive.test.js` (4), nine mutants.

## THE READING: the phone's attribute rows (1)

Already fixed and live. This is the report `01-Overview/Field-Bugs-2026-09-27-phone-backup-drains.md` records
(CHARGEN-PHONE, `08db3b3c`, merged in PR 409 with its audit `54daf140`); the screenshot is the pre-fix layout, where
the attribute list got a sliver of the screen under the description card. The live site serves this tree's head
(its `build-tag` meta read 74ad1ed58655 on 2026-09-28), which carries the one scrolling column. The two errors behind
"CRASH (2) / unknown error" were never traced: before that fix the box printed "unknown error" for any error event
with no error object, and a bare line with no `at` under it means the event had no file either - the shape of a muted
cross-origin "Script error.", which a browser's own injected scripts raise (both her browsers are WebKit on iOS). The
box has printed the event's own message since, so a repeat will name itself. Nothing changed here.

## THE READING: the frame rate (3)

- **300 is 60 on a 60 Hz screen, by design - in a browser.** The Frame Rate Cap holds frames back; it never runs
  faster than the screen, because every frame waits on requestAnimationFrame, which waits on the screen (FPS-CAP1,
  `07-Rendering/Rendering-Arc.md`; the patch notes say "The game never runs faster than your screen"). The desktop app
  was the same Chromium with no switch to lift the wait - until FPS-VSYNC, below.
- **The outdoors.** The report's counter reads "in frame 63.8 before 9.7 stream 0", 48 draws, and a GPU line ending
  "ACO), OpenGL ES 3..." at dpr 1 - an AMD card on Mesa (Linux). 63.8 ms inside the frame is SCRIPT-SPLIT's own
  reading (`07-Rendering/Performance-Exterior.md`): the time the frame callback takes, which includes waiting on the GPU.
  The Test Room is not the same place: its characters start in Privateer's Hold and always offline, so it compares a
  dungeon to an exterior (online, if the save was). Not reproducible here (SwiftShader); the questions are
  SCRIPT-SPLIT's three - Render Scale at 50%, the counter's whole lines, and whether the save was online.
- **"uc crash".** No such label exists in the tree; "uc" is almost certainly a minified name from the build the player
  ran (the same shape as the recorded "'Ut' before initialization"). It can be read only against that build: the app's
  version names it, and the recorded way is to rebuild that commit and slice the bundle at the crash's line and column.

Nothing changed for the outdoors or "uc"; the cap is FPS-VSYNC's.

## SHIP-SAIL: the Overworld takes the passage (Mac's answer)

Asked whether the Overworld should book the map's ship passage itself, Mac: *"Shouldn't it already function as such?"*
It does now. Where the Overworld refuses a place across the water (no route by land, no boat of the player's own to
hand) and the map's passage sails there from here, the Overworld OFFERS it in a Yes/No box - "There is no way to
Wayrest by land. Sail there by ship?", the fare in the party prompts' own words, the days as the map counts them (none
online, where the arrival is now), and the popup's warning to a diseased or poisoned traveller. It is priced by the
map's own popup, headless (`partyTripFare`: the ports rule, the guild's blessing, the fare, the two-sided gold gate),
refused by the map door's own rungs (foes near, the sun, indoors - `partyTravelRefusal`), and on Yes taken as the map
takes it: a party gathered is asked first, then the fade and `fastTravelTo`. A purse that cannot pay is told so ("You
cannot afford the journey (150 gold).") and not asked; where the passage's own law refuses the place - no port here -
the boat's line stands. The same offer answers both doors to it: a town clicked in the Overworld, and a place picked
on the map with By land chosen. `test/disc28d_shipport.test.js` (the offer and the popup's pricing), eight mutants.

## FPS-VSYNC: the desktop app runs past the screen, as DFU does (Mac's answer)

Asked whether the desktop app should run above the screen's refresh, Mac: *"Yes"*. Done by DFU's own law
(StartGameBehaviour.cs:238-250) rather than beside it: with VSync on every frame waits for the screen and the cap
does nothing; with VSync OFF the Frame Rate Cap is what holds them, and Off lets them run free. A page cannot stop
waiting; the app's Chromium can, if told before it starts. So the shell reads the player's saved VSync at launch
(`app/lib/frameRate.cjs`: the page's own settings blob in the shell's file store, read as the page's GetBool reads it)
and, with it off, lifts both of Chromium's waits (`disable-gpu-vsync`, `disable-frame-rate-limit`); the page's cap
(`systems/frameCap.js`) then holds the frames, up to its 300. VSync on - DFU's default - changes nothing, so no install
runs uncapped unless its player turns VSync off. In the app the VSync row is a real switch now, said to take effect
the next time the app starts (the settings screen's `restart` tier); in a browser it stays unavailable. The report's
"300 FPS but limited to 60 (possibly by vsync)" is answered in the app: turn Wait For Screen Refresh off, restart.
`test/disc28d_vsync.test.js` (4), nine mutants. Not proven on a real desktop GPU here (no display in this box).

## For Mac

- **SHIP-PORT's deck is a departure from Travel Options** (departure 20): on the ship, the ports rule asks of the port
  the ship was boarded at. Kept unless you say otherwise.
- **A point into a curse-capped attribute is still allowed**, as DFU allows it (it counts after a cure). The window now
  says so where it happens; making the press refuse there would change the law, and is yours.

## Records

- Tests: `test/disc28d_levelpct.test.js` (3), `test/disc28d_ascendlive.test.js` (4), `test/disc28d_shipport.test.js`
  (5), `test/disc28d_vsync.test.js` (4) - each red before its fix.
- Mutants: `tools/mutants/disc28d.json` (34 dead); `lv1.json`'s `canRaise-restates-the-law-instead-of-asking-it`
  re-aimed by content (the row's `canRaise` is a const now), dead.
- Citations: `tools/citeShift.mjs --apply` (93 moved) and the four struck `world.js` cites CD4 reads moved by hand;
  then, over the Overworld's ship question, `--apply --struck` against that state (20 moved).
- Re-aimed: `test/to1_travelOptions.test.js`'s D1 pin reads the location through `travelOriginMapId`.
