# FIELD BUGS 2026-09-27h - the escape menu's doors, the sea's deathloop, the street's shield, the map a load greyed

Mac, with eight Discord threads as screenshots: six bug reports and two suggestions. This page is the batch's record;
each fix has its own section below. Mutants: `tools/mutants/fieldbugs27h.json` (45, all dead).

The list, as it came:

1. **Equipment sprites too big for the boxes** (kurkku) - a screenshot of a shop list: a pauldron's and a dai-katana's
   pictures hanging out of their framed boxes into the rows beneath, the spellbook's fitting.
2. **Underwater Deathloop** (Yugi): *"My character just autoran into the ocean, stuck at the bottom because of my loot.
   No more puddles does nothing"*.
3. **Escape Menue Discrepencies** (Eterna): *"if one goes to the escape manue and attempts to navigate tp the notes or
   quests, via the butttons there, player will be told thers no links to that info from this menue space, so one must
   use keybinds exlusivly to open both the note book and quest log...."*
4. **Stuck Spell Book Screen** (Eterna): *"if u enter the spellbook via the escape menue, instead of the chosen
   keybind, the spellbook willopen and stay persistent, behind all screens, making it unable to exit or play ( ctrl,
   alt, del ) desktop app"*.
5. **Shield Widget show as broken outdoors** (SlipperyPeasant): *"My shield is fully repaired and looks as such
   inside, but once I'm out in the open world it visually appears as if its broken."*
6. **3D Map Unfilling areas mid-dungeon** (Flylighter): *"Parts of the map previously filled out will randomly
   disappear from the 3D map ... just about every dungeon. Using desktop client!"* (a video link, and a message cut off
   at "It may be, on second glance, that...").
7. **Extremely long buffs :(** (suggestions - Leafen): *"Could there be a way to dispel magic for non-magic users?"* -
   a Shield Group at 11397 rounds - *"Or maybe have a hard limit for the number of ticks"*; Zerofyre: *"An option to
   right click cancel buffs on yourself like most RPGs would be incredibly nice"*.
8. **hold mouse button to keep repeating button action** (suggestions - Skeptikali): *"hold a + or - button in for
   example spell making to increase values instead of clicking hundred times"*; Tabitha: *"add a field to type in the
   value !!"*.

## ESC-BOOK: the F5 page's doors, and the escape menu's Notes and Quests (3, 4)

On the enhanced skin F5 opens the pause window on its Stats page (PX27) - the same window as Escape's, tabs and all,
which is why both reports say "the escape menu". Its Pack, Spellbook and Chronicle doors called the SHEET's hooks,
closed the page and dropped what they returned - and those hooks are FACTORIES: the classic sheet pushes what they
build as its own child. So on the F5 page:

- **Spellbook** built the enhanced book, which mounts its screen the moment it is built (z-index 11), and no host slot
  held it. The pointer relocked and the game ran on under it; Escape opened the pause OVER it (13), and it stood
  behind every screen - report 4, word for word.
- **Pack** (and F6's crossover from the page) did the same with the pack.
- **Chronicle** - the notebook's door - built the CLASSIC journal, which nothing drew: the page closed and nothing
  opened. With the Quests tab's "The journal is not wired into this place yet" (F5-QUESTS fixed that tab a day
  earlier, which a desktop app a day old still showed), that is report 3.

The page's three doors are the HOST's arms now (`ui/charSheetDoor.js` sheetPageDoors) - the ones each host's pause bag
has always handed the Escape window, which open each window in that host's own slot. The page goes down first, then
the arm; a host with no arm gets no door. A building's F5 page used to be handed the STREET's bag with the street's
sheet builder; it is handed the building's own now (`scenes/worldModes.js` interiorPauseHooks, the bag its pause door
spreads), whose doors mount in the building's slot. And a door that opens another window HANDS OFF rather than resumes
(`ui/pauseDoor.js` pauseMenuAct 'handoff'): nothing relocks under the window about to open, and a pause window opened
from the classic pause's Controls button does not bounce back to it first. `test/escbook.test.js` (3).

## SEA-RISE: the sea's deathloop (2)

The sink is DFU's own rule - an over-encumbered swimmer takes `Vector3.down` instead of the float keys
(LevitateMotor.Update :83-85), which Iliac Puddle No More's forged water level carries to the sea - and it stands.
What made it a LOOP was the port's own:

- **The respawn searched only the death's region.** An open-sea pixel is politic 64, region 31, whose table holds a
  crux and two moorings - no temple, town or graveyard - so the online respawn stood the player where they fell: the
  carved seafloor, with the loot that sank them and one breath, to drown and rise there again. A region with none now
  searches every region for the nearest (`systems/deathRespawn.js` nearestSafeLocationAnywhere; one region resident at
  a time, the one before put back, roadsProducer's sweep).
- **The autorun latch survived the respawn** and walked the risen player back into the water. The respawn drops it
  (`player/motor.js` stopAutorun - the two latches a held MoveBackwards drops).
- **The sea's breath ran on under an open pack**, so emptying the pack drowned the player doing it. It waits under a
  window now, as the dungeon's breathTick and this host's own calendar always have (DFU's windows pause the game).

"No More Puddles does nothing": its switch is the ROOM's online (forced on, the Mods pane greys it "On (online)") and
offline it reaches the next world load - it never drained a sea under a swimmer, and it never touched the weight rule.
Dropping to 62.5 kg (the pack now waits for you), Levitate, Water Walking or Water Breathing gets a sinking swimmer up.
`test/searise.test.js` (3).

## SHIELD-OUT: the street's shield (5)

The Shield Widget mod has ONE component; the port builds one per weapon rig, and only the host on screen steps its
rig. The street's widget sat out the whole visit to the smith and resumed on the sprite it last read: its template key
had not moved, and only a DOWNWARD crossing (hitShield) repoints the sheet. The mod's one component sees the shield come
off for the repair (DFU repairs nothing equipped) and re-reads it when it goes back on. The widgets count their steps
together now, and a widget that missed any re-reads its shield on its next frame (`combat/shieldWidget.js`
`_widgetSteps`, `stale`): repaired indoors is repaired outside, and a shield battered indoors is battered outside. A
widget that never looked away keeps the mod's own law. `test/shieldout.test.js` (3).

## LIST-FIT: the list tile holds its picture (1)

The shop's list rows (a player trade's too - it is a trade-shell) frame each picture in a 34px tile, and a tiered
item's picture is capped at `max-height: 100%` inside the tier's 2px frame (AUDIT MERGE-PLUS D2). The base tile is a
GRID, and a grid's auto row gives that percentage nothing to resolve against: only the width was held, and a tall
picture hung out of its box. The trade tile is a flex room now, centred, as the loot window's has been since UI1
(`ui/enhancedPlusStyle.js`) - never `overflow: hidden`, which would clip the sigil rune and the padlock standing past
the edge. Measured in Chromium over the injected sheets (a pauldron, a dai-katana, a staff, a spellbook; fitted,
Morrowind-square, grid-sized and raw 2x pictures): eight tiered trade rows overflowed before, none after. The UI pass's
fit law (UI1, merged the same day) had already sized each picture under the box, so the report's build may have been
the one before it; the tile now holds whatever it is handed. `test/listfit.test.js` (1).

## MAP-KEEP: a load greyed the map (6)

The reveal store only ever grows while a player stands in a dungeon: its keys are the block and the RDB offset, the
draw list it filters is the whole level, and no stream, sync or cap removes a key mid-visit. What took the map away
was the LOAD - and the players who report this die in dungeons and load:

- The world host builds a saved dungeon through the door's own build, and that build entered the restored record on
  the FRESH-ENTRY arm: the colour tier (visited this run) reset, so every step of the run went gray; the record
  stamped; the store pruned. DFU's load arm (initFromLoadingSave, Automap.cs:2492-2493) touches none of it. The load
  passes `fromLoad` through (`startInDungeon` -> `dungeonTransition` -> `automapFromLoad` -> `enterDungeonAutomap`).
- The save was restored BEFORE the scene being left was torn down, and that teardown's exit stamped the dungeon it left
  - in the SAVE's store - with the clock being left, and at "remember 0 dungeons" cleared the whole store it had just
  restored. A restored store names no live dungeon now (`systems/automap.js` restoreAutomap), so the teardown writes
  nothing into it; walking out still forgets, as the vanilla law says.

What this does not answer, and says so: the 3D map's own cut plane. Above the player's height a dungeon's upper storeys
are drawn transparent (the dungeon default) or cut away (Cutout, which Return cycles to and F2 forces), and seen from
below an upper floor's faces point away - DFU's own presentation, which the port draws as DFU does. A player moving
between storeys sees "parts disappear" and reappear with no data lost. The video and the cut-off second message were
not readable here; if the parts come back when the player returns to their height, that is the slice.
`test/mapkeep.test.js` (3).

## BUFF-END: ending a spell of your own (7)

Never DFU's: its one way off is Dispel Magic, a spell a warrior has none of. The Shield Group's 11397 rounds are DFU's
own stacking (Shield.AddState adds a recast's rounds - the port's `inc.roundsRemaining += rounds`), many maximum casts
deep; the stacking law and every duration stand, and no cap is laid on anyone's cast. What the player gets is the
choice to end one:

- **The law** (`systems/mysticism.js` canEndBundle / endBundle): a SPELL of the kinds that only help - every duration
  buff but Silence, Shield, Fortify Attribute, Regenerate, the elemental resistances, Spell Absorption, Reflection and
  Resistance, Comprehend Languages and the heals (ENDABLE_KINDS). Never a held item's magic (back the moment the item is
  read again), a duel's, an armed Open or Lock, a disease or a poison (neither is a bundle), and never a bundle with a
  harmful kind in it - a foe's Drain merges into the incumbent it finds, so the caster is not enough and every entry's
  kind is asked. Ending takes that bundle's entries alone (Dispel Magic's self-cast arm, no roll) and says
  "<name> ends.".
- **The HUD, right-click** - with the mouse freed (Enter, or the FreeMouse key): the enhanced status widget's tile for
  a spell that may be ended takes the pointer (only then - the HUD stays pointer-transparent) and a right-click ends it;
  its press goes no further (no swing). The classic HUD's icon the same, through the HUD click door every host already
  calls (`ui/hudLarge.js` routeSpellIconClick): the pointerdown is cancelled, so neither the swing nor an armed cast
  hears it; and the classic icon's name now shows with the mouse freed too (DFU's tooltip gate, which the hosts'
  paused flag had halved).
- **The pause window's Stats page, Effects** - every spell on you with its rounds, and an End on each that may be
  ended: the door a pad, a finger or a player who never frees the mouse can use.

`test/buffend.test.js` (5). Port-Ledger A.

## HOLD-STEP: hold to repeat, and a typed value (8)

The Enhanced Plus spell maker's effect editor (the port of DFU's window, `ui/enhancedPort.js`'s spinner block):

- **Hold** a + or - button: the first repeat after 400 ms, then one every 100 ms, every 40 after ten - a 1 to 100 field
  in under five seconds. Every step rebuilds the port's DOM under the finger, so the hold is keyed by the button's
  PLACE among the spinner buttons, each repeat running the latest view's act for the button at that place; a view
  with no such button (the editor shut mid-hold) ends the hold rather than pressing whatever stands at that index
  now. The release is heard anywhere, a hold that stepped swallows its release's click, and a window taken down
  mid-hold stops.
- **Type** the value: the number between the buttons is a field (the numeric keypad; one to three digits). Enter or
  leaving it sets it, by the step's own law - clamped to the spinner's range, the magnitude pair rule, the cost
  (`systems/spellMaker.js` setSetting, the editor's `setValue`, refused where the spinner is off); Escape or anything not
  a number puts the value back. The hosts already step aside for a typed field.

Measured in Chromium over the port (a scratch probe): a 1.2 s hold is nine repeats and its release adds none, a 0.2 s
press one step, 42 and 7 typed set, "abc" and Escape put the value back, a disabled spinner has no field, and a view
changed under a held button stops the hold and presses nothing of the new view. The classic
window keeps DFU's click-per-step. `test/holdstep.test.js` (4). Port-Ledger A.

## THE FOUR HOSTS

ESC-BOOK: world.js, exterior.js and dungeonContext.js hand their sheet their own pause bag, as since F5-QUESTS; the
building (worldModes) hands its own bag through world.js's builder, which takes it. SEA-RISE: the respawn, the autorun
and the sea's breath are world.js's alone (the only host with an online respawn and the carved sea). SHIELD-OUT: every
rig's widget counts in the one module. MAP-KEEP: the load's arm is world.js's (the dungeon context's own quickLoad
already entered on the load arm); the store fix is the module's. BUFF-END: the enhanced widget and the Stats page are
host-free; the classic icon rides `routeLargeHudClick`, which all four hosts' pointerdowns already call, each now
handing it the event. LIST-FIT and HOLD-STEP are the skin's.
