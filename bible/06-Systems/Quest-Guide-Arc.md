# Quest-Guide-Arc (ACTIVE)

Opened 2026-09-29, Mac: *"How can we set the foundation and improve the
quest system substantially? Like really modernize it, make it more
accessible"*.

THE ANSWER, IN ONE PARAGRAPH. The quest MACHINE is finished and it stays
DFU's: Port-Doctrine lists "quest machine (quest script parsing +
execution)" among the things ported 1:1, and `06-Systems/Quest-Arc.md`
is its record. What is not modern is everything the PLAYER sees of it -
a journal of raw entries, no word when the journal changes, no way from
an entry to a place on the default skin, a deadline in one tab, nothing
marked anywhere, and an accessibility lane nobody has walked. So the arc
builds a layer of the port's own OVER the machine and never in it: one
read-only picture of the player's quests (GUIDE1, THE QUEST LENS -
SHIPPED), and on it the faces, each its own slice on the enhanced skin
with its own switch - and, where it departs from DFU, its own Ledger A
row, which is Mac's to approve (Port-Ledger's charter). The classic skin
stays DFU's, byte for byte.

## WHAT THE PLAYER HAS TODAY (the map, 2026-09-29)

Three read-only lanes walked the tree before a line was written (the
presentation surfaces, the machine's data, the bible's asks and rules).
What they found, with the gap each surface leaves:

| Surface | What it shows | The gap |
|---|---|---|
| Pause window, Quests tab (`src/ui/enhancedMenu.js` pauseQuests; PX4, PX22, QT-LIVE1) | Main / Side / Archived rail; the LATEST entry as the description; the trail newest-first; the live "Time remains", gold under a day | No "where"; no way to the map; and "latest" was the last entry of the machine's first-logged order - a step logged again showed a superseded entry (GUIDE1 fixed) |
| Chronicle (`src/ui/enhancedChronicle.js`, the L key; MAC-K2) | A card per quest, entries newest first, fold, Share to the party | No timer, no Main/Side split, no "where" |
| Classic logbook (`src/ui/questJournal.js`, U32) | DaggerfallQuestJournalWindow verbatim, with HandleQuestClicks' "Travel to location?" | None - it is DFU's |
| Quest popups (`say`, `prompt`) | The enhanced notice panel (ENH-NOTICE1) or DFU's parchment | None by themselves |
| News | Nothing. `log` is a bare addLogStep; no "journal updated", no "quest complete" (DISC6's player: "Theres no quest notification when you killed all monsters and no quest update in the log") | Everything |
| Marks | One: a residence an NPC marked, named on the town map (`stampResidenceQuestNames`, the town sheet's ring) | Nothing on the travel map, the held map, the compass or the dungeon map |
| The way there on the ENHANCED skin | Nothing: only the classic logbook ever calls `gotoPlace`, so the held map's consumer (`heldMap._consumeGotoPlace`) is never reached | DFU's own feature, missing on the default skin |
| DFU's quest debugger | `GUI/EnableQuestDebugger` is stored and read by nothing (no HUDQuestDebugger port) | DFU's, unported |
| Accessibility | The Settings Accessibility category: 19 DFU keys, no port rows; `textScale` dead since the old settings window (`01-Overview/Audit-54.md`); `play/index.html` sets `user-scalable=no`; no contrast or screen-reader audit (`01-Overview/Audit-UI.md`, `01-Overview/Audit-UI-2.md`); the notice stack is `aria-live="polite"` | A lane, empty |

## THE LAWS (every slice of this arc)

1. **THE MACHINE NEVER KNOWS.** No face writes quest state, and no face
   reads the journal the loud way (below). A game with the arc's faces
   and a game without them are the same game - pinned, not promised.
2. **NOTHING THE JOURNAL HAS NOT SAID.** PX4's law, made operational: "a
   Daggerfall quest speaks in journal entries, not objective flags: the
   entries ARE the tasks, and inventing checkbox objectives the machine
   does not track would be a lying UI" (`10-UI/UI-Arc.md`, PX4). A face
   shows an entry's words, the place DFU's own logbook would travel to
   from it, and of that place only what the entry says or DFU's
   find-place box would say. A face that wants more - a marker inside a
   dungeon - is an opt-in tier with its own row (GUIDE8), never a default.
3. **ONE WALK.** `questBridge.questLog()` (MAC-K2) walks the machine;
   `ui/questRail.js` decides which entries and in what order; the lens
   adds the rest. A face never walks the machine, and never builds a lens:
   the bridge makes the one (THE ONE CONSTRUCTION SEAM), so every host
   that has quests has it.
4. **THE CLASSIC SKIN IS DFU'S.** Every face asks `isEnhanced()`; the
   classic logbook, parchment and HUD are untouched.
5. **ACCESSIBLE BY CONSTRUCTION.** Every face is DOM on the enhanced
   skin: its text scales, news is `aria-live`, a state is never colour
   alone, `prefers-reduced-motion` is honoured, and a keyboard and a pad
   reach every control a mouse does.
6. **THE FOUR HOSTS.** A face fed through the bridge reaches all four
   hosts at once; a face wired through a host names all four in its
   record, each wired or flagged (Home.md, THE FOUR HOSTS RULE).

## GUIDE1 - THE QUEST LENS (SHIPPED 2026-09-29)

`src/ui/questLens.js`, made once by `createQuestBridge`
(`src/scenes/questBridge.js`, `bridge.lens`) and reset by its `restore` -
a loaded game's quests are the lens's baseline, not news. No face draws
from it yet; it is the floor every face of this arc stands on.

**What a look answers.** `lens.look({ canFindPlace, currentLocationName })`
- the classic logbook's own two gates, the host's - returns
`{ quests, finished, events }`. A quest view is its title (questRail's
`questTitleOf`), `main`, the clock the journal's "Time remains" counts
and whether it is `urgent`, its entries in the order they were WRITTEN
(each with its step, message, time, lines and target), the `latest` of
them, `updatedAt`, and `target` - the latest entry's, never an older
one's: a quest that has moved on points where it points now. The events
are what changed since the previous look: `started`, `updated` (naming
the new entries), `urgent` (a clock crossing under
`QUEST_URGENT_SECONDS`, one home in `ui/questRail.js`, shared with the
pause window's gold line), and `completed` / `ended` - the notebook's
own two verdicts, off the walk's new `ended` list (a quest the machine
has completed and still holds as a tombstone, with `questSuccess`). The
first look, and the first after a reset, is the baseline and says
nothing. A quest that lost every entry to `remove log step` leaves the
journal without an ending and, when it writes again, is `updated`, not
new.

**THE QUIET READ.** An entry's text is not free to read. The journal's
own read, `Message.getTextTokens` - DFU's logbook and the port's - reveals
the talk topics the entry names (QuestMacroHelper's reveal arm), latches
the quest's LastResourceReferenced, LastPlaceReferenced and
CurrentLogMessageId, re-seeds DFRandom (%n %fn %mn) and draws the quest's
own rolls (%god %olf). DFU's logbook does all of it each time it is
opened; a lens that read on every change would do it at moments no
player chose, and a talk topic would open because a HUD line was drawn.
`quietTokens` reads with the reveal off - `getTextTokens`' new fourth
argument, whose default is C#'s literal `true`, so every DFU caller is
unchanged - and puts the three latches, the seed and the rolls back,
including when the expansion throws. Measured over all 3,817 messages
of the corpus, from the same states, the journal's read moves 1,895
reveals, 1,761 resource latches, 846 place latches, 15 log ids, 7 seeds
and 94 roll draws; the quiet read moves none of them and prints the same
words. Two recorded differences:

- **%god's random arm** (a region with no temple of its own) answers the
  FIRST divine, because the quiet roll draws nothing. DFU's logbook
  re-rolls that word on every open, so no one value of it is the
  journal's.
- **Fifteen corpus messages** throw on DFU's own %di NRE when nothing has
  referenced a Place yet (LastPlaceReferenced.Scope before the null
  check; the corpus gate meets three because its reads latch in
  sequence). None of the fifteen is ever logged, so no journal entry is
  one; the quiet read answers null for each, puts the latch back and
  says so once.

Lines are read once per entry and kept; a macro that reads the world as
it is (%di's direction, a countdown's days) goes stale in a kept line, so
a face that shows text calls `rereadText()` when it opens - the moment
DFU's logbook reads.

**THE TARGET, AND THE SAID LAW.** `entryTarget` is DFU's
GetLastPlaceMentionedInMessage - the LAST Place any macro in the entry
names (DaggerfallQuestJournalWindow.cs:469-485), never
LastPlaceReferenced, which DFU's own comment says can point at an
unrelated home - and it now has ONE home: the classic logbook imports
`lastPlaceMentionedInMessage` from the lens and keeps no copy. Of that
place the lens gives only what is said: the building ONLY when the entry
names the building (`_p_`) - "a house in Daggerfall" stays a house in
Daggerfall; the town when the entry names it (`__p_`, `___p_`), when it
is on the player's map (DFU's find-place box names it) or when the
player stands in it; the region the same way or when the entry names the
region (`____p_`). Only the target's own macros say anything. `find` is
what the logbook's Yes hands the travel map, present exactly when
HandleQuestClicks would offer the box: on the map, and not where the
player already is. The variant is drawn on a roll that draws nothing -
`getMessageResources` took the same `roll` seam `getTextTokens` carries,
Math.random by default - so a look never touches the engine's stream.

**THE WRITTEN ORDER - the one thing a player sees change.** The machine
keeps its log in a Map keyed by step, and `addLogStep` re-sets an
existing step in place, so the walk lists steps in the order each was
FIRST logged. A quest that logs step 0 again after step 1 still listed
step 0 first, and the pause window's description ("the LATEST log entry
as the description", PX4) and the chronicle's newest-first card showed a
superseded entry as the state of the quest. The bridge's walk now hands
each message the time its step was written (`steps`, aligned with
`messages`), and questRail orders a row's entries by that time
(`writtenOrder`, stable) - after READING them in the walk's order, the
logbook's, because a loud read latches the last-referenced resource and
place for the next entry's pronouns. The classic logbook keeps DFU's
order.

**Pins.** `test/guide1_questLens.test.js` (7): the feed over the real
bridge and machine; the order; the quiet read over every message of the
corpus; a whole game played twice, the lens re-reading and looking at
every tick and not - the same save, popups, topics, seed and roll draws,
and no draw from Math.random inside a look; the target and the said law
over producer-minted Places; the one homes. `test/questbridge.test.js`'s
MAC-K2 walk pin and `test/enhancedPause.test.js`'s PX22 timer pin grew
with the walk's `steps` and `ended` and the one urgent number.
`tools/mutants/guide1.json`: 38 mutants, 38 dead.

**Ledger.** GUIDE1 departs from nothing, so it has no section A row: the
lens is invisible to the machine; `revealDialogLinks` and `roll` are
seams whose defaults are DFU's; and the written order changes only what
the enhanced faces call "latest", which is what PX4 specified.

NOT SEEN IN A BROWSER - GUIDE1 has no face. The one visible change (the
latest entry) is pinned through the real walk.

## GUIDE2 - THE WAY THERE (SHIPPED 2026-09-29)

DFU's logbook has always taken a click on an entry to the place it names
(HandleQuestClicks: "Travel to location?", then the travel map opened on
the place). The enhanced skin - the default - never had it: only the
classic logbook ever called `gotoPlace`, so the held map's consumer
(`heldMap._consumeGotoPlace`) was never reached. GUIDE2 gives both
enhanced journal faces the way there, and says the place beside it.

**What the player sees.**

- **The pause window's Quests tab** (`ui/enhancedMenu.js` `questWhere`):
  under the quest's name and deadline, the WHERE LINE - the latest
  entry's target in the find-place box's own phrase ("Llugwych in
  Wayrest province", "The Feather and Dog, Bigtown in ... province",
  "Somewhere in ... province" with the region alone, "(you are here)"
  underfoot) - with **Show on map** beside it where a map can open, and
  "Not on your map yet. Ask around for directions." where the player's
  map is KNOWN not to have a named place (Daggerfall's own answer: ask,
  and an NPC marks it - `06-Systems/Talk-Arc.md`, THE COMPASS MARK). An
  OLDER entry naming a different place that is on the map carries its
  own small Show on map in the trail, because the classic logbook takes
  a click on any entry.
- **The chronicle** (the window the L key opens, `ui/enhancedChronicle.js`
  `questState`): the same line and the same way there on every live
  quest's card, under its head and standing when the card is folded -
  and the DEADLINE the pause tab has carried since PX5, which this
  window never showed, live once a second off the host's walk alone (no
  entry's text is read for it), gold under a day, a stopped clock
  repainting the card. One owner for its interval: every render and
  destroy clear it.

**The way there is DFU's own door, in DFU's order** (FindPlace_OnButtonClick):
the journal goes down, THEN the map is asked for with the place -
`gotoPlace({ siteDetails: find })`, the payload both maps already read.
The pause page keeps its own door law (AUDIT 27h A4): a HANDOFF, then the
door, and a map the host refuses resumes the game with DFU's refusal on
the notice stack. The chronicle closes itself first and reads the door
before the close (its destroy empties the module's deps). The street's
map door, `toggleTravelMap`, now answers whether a map opened - `true`
once it is in the slot, `false` from each of its nine refusals (every
one says why first); the travel callback inside it is untouched.

**THE FOUR HOSTS.**

| Host | The questions (is it on the map, is the player in it) | The way there |
|---|---|---|
| `scenes/world.js` - the street | its own (`canFindPlace` over the maps, `_questLoc`) | the door; the journal builder offers it only in exterior mode, because the same builder serves the interior host |
| `scenes/worldModes.js` - buildings | the street's (`host.questCanFindPlace`, `host.questLocationName`) | none: indoors DFU's map door refuses (IsPlayerInside), and a door that only ever says no is not drawn |
| `scenes/dungeonContext.js` - dungeons | the street's, delegated through worldModes the way the quest Share button's hooks are | none: this context owns no map |
| `scenes/exterior.js` - the fixed-town route | the city it stands in; no map to ask | none: it builds no travel map |

**THE THREE-STATE MAP.** A host with no map to ask hands no
`canFindPlace`, and the lens's `onMap` is now `null` there rather than
`false`: a face must not tell a player that a place is missing from a
map nobody looked at. With `null` the line names only what the entry
says, and offers no note and no way there.

**ONE HOMES.** DFU's `locationInRegionProvince` phrase moved from the
classic logbook into the lens (`locationInRegionText`; FIND_PLACE_TEXT
reads it); `remainWords` moved from the pause window into
`ui/questRail.js`, so the chronicle's deadline reads exactly as the tab's.

**Found on the way.** `test/chargenDom.mjs` had no `childNodes`, which
the Quests tab's PX22 meta line reads - so the tab had never been mounted
headless with a live quest in it; the minimal DOM carries it now. The
refusals' new `false` re-aimed three suites' door pins
(`test/audit64_travel.test.js`, `test/audit58_magic.test.js`,
`test/partytravel.test.js`) and five other slices' mutant records by
content (`auditpartyui`, `auditpartyui2`, `party-travel`, `vamphood`,
`qtlive1`).

**NO LIVE TIMER IN A FACE'S SUITE** - learned the hard way, and a law for
every suite this arc adds. The first mutation campaign over GUIDE2 hung:
the pressed-chronicle pin mounted the window without a `finally`, so a
mutant that failed an assertion before the press left the chronicle's
real once-a-second interval armed, and the test process never exited
(`tools/mutate.mjs` waits on it with no timeout of its own). The suite
now RECORDS every interval instead of arming it - a pin fires one by
hand, and every mount asserts none is left standing - so a leak fails a
pin instead of holding the run open.

**Pins.** `test/guide2_wayThere.test.js` (6): the words over producer-
minted Places; the pause tab mounted and pressed (the handoff before the
door, the resume on a refusal, no door no button, the note, the unasked
map); the trail's older places (offered once); the chronicle mounted and
pressed (close before the map, the door read before the close, the line
on a shut card); the chronicle's live deadline; the four hosts by
source. `tools/mutants/guide2.json`: 25 mutants, 25 dead. Ledger A:
THE JOURNAL SAYS WHERE, AND TAKES YOU THERE.

NOT SEEN IN A BROWSER: both faces are driven headless over the minimal
DOM; the dress (`.px-qwhere`, `.cr-where`, the Plus button role) is
unlooked at on a real screen.

## THE SLICES (Mac, 2026-09-29: "This is your baby. Take your time")

In order. Every one reads the lens and nothing else. SHIPPED: GUIDE2 (below).

| Slice | What the player gets | DFU? | Switch |
|---|---|---|---|
| **GUIDE2 THE WAY THERE** | The enhanced journal (pause tab and chronicle) gets DFU's own logbook click: on an entry whose target has a `find`, "Show on map" closes the journal and opens the map on the place through the host's `gotoPlace` - world.js's `toggleTravelMap(place)`, which already hands it to the held map (`_travelMap.gotoPlace`) and refuses indoors in DFU's words. Under the title, a "where" line of the target's SAID names. world.js wires it; the dungeon and `?exterior` hosts flag it (DFU's map will not open inside). | Parity: DFU's logbook has it; the "where" line is the enhanced face's | none - the journal's own |
| **GUIDE3 THE HERALD** | The lens's events as the enhanced notices (ENH-NOTICE3's toast stack): "New quest", "Journal updated", "Quest completed" / "Quest ended", "Under a day left" - title and first line, `aria-live`, a chime if Mac wants one. Fed from the bridge's tick, so all four hosts at once. | Departure: DFU says nothing | `quest-herald` (interface, enhanced, `online: 'player'`) |
| **GUIDE4 THE TRACKER** | A HUD card: the tracked quest's title, its latest entry's opening, the target's said names and the live timer; a key to cycle quests and one to open the journal on it. The tracked quest is kept per character through `registerModSaveData`, by uid. | Departure | `quest-tracker` |
| **GUIDE5 THE MARKS** | The target on the held map, the travel map and the enhanced compass (which already carries detect, gate and party marks) - only a target with `find` (DFU's own discovered gate). A target off the map gets the talk arc's hint instead: ask about it, which is what Daggerfall's directions are for (`06-Systems/Talk-Arc.md`, THE COMPASS MARK). | Departure | `quest-marks` |
| **GUIDE6 THE ACCESSIBLE JOURNAL** | The pause tab: filter by kind (Main, Guild - the quest list's own group, `findQuestMeta` - Other), sort by updated or deadline, search, each entry's date, the deadline as words AND a date, keyboard and pad navigation with visible focus, a text size that works, and an entry read aloud (speechSynthesis). | Enhanced face | per choice |
| **GUIDE7 THE ACCESSIBILITY SHELF** | Port rows in the Accessibility category: quest text size, high-contrast panels, reduce motion (the OS's, overridable), quest popups read aloud, notices held until dismissed - and the contrast and screen-reader audit Audit-UI named and nobody ran. | Port's own | per row |
| **GUIDE8 GUIDANCE TIERS** | Off by default: *Journal* (GUIDE5's law) / *Town* (the building the entry names, marked when the player is in its town) / *Exact* (the marker a quest resource stands on, DFU's quest-debugger knowledge, on the dungeon map). The one tier that can spoil; its own row. | Departure | `quest-guidance` |
| **GUIDE9 DFU'S QUEST DEBUGGER** | HUDQuestDebugger behind the inert `GUI/EnableQuestDebugger`: tasks, timers and globals per quest - for quest authors and bug reports. | 1:1 - DFU's | DFU's own key |

## DECISIONS (2026-09-29, Mac: "This is your baby. Take your time")

Mac handed the arc's open questions back with the arc. Each call is
recorded here as the arc's own, with its reason, so a later slice - or
Mac - can see what was decided and reverse it where it stands.

1. **The order** is the table's: GUIDE2 first (it is DFU's own feature,
   missing on the default skin), then the news, the tracker, the marks,
   the accessible journal and the shelf, the guidance tiers, the debugger.
2. **The herald is on by default** on the enhanced skin: the silence it
   answers is a reported bug (DISC6), and a notice is the enhanced skin's
   own idiom (ENH-NOTICE1/3). **The tracker is on by default too**, but
   quiet - it follows the quest the journal last changed until the player
   pins one, and says nothing when there is no quest to follow. Both are
   switches in the Features rows.
3. **The *Exact* guidance tier is allowed, off by default**, behind its
   own row: DFU itself has the knowledge (its quest debugger draws the
   markers) and a player who cannot read a dungeon should be able to ask
   for it; a player who wants Daggerfall never meets it.
4. **Text size starts with the quest faces** (GUIDE7's row), not a
   revived global `textScale` - one surface done properly before the
   whole UI is scaled. `user-scalable=no` stays on the game page: the
   touch layer's pinch and drag own the gesture, and the quest text size
   is the escape hatch it lacked.
5. **Read-aloud is in, and opt-in** (speechSynthesis, which the browser
   and the desktop shell both carry): off by default, never a voice a
   player did not ask for.
