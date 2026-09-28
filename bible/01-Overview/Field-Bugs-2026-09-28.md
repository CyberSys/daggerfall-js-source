# FIELD BUGS 2026-09-28 - the pause key, the arrest, the shop box, Speed, the dead span, the swimmer, the dragonling, the shared quest

Mac, with eleven screenshots of the Discord's bug-reports and support threads and no words of his own. This page is
the batch's record; each fix has its own section below. The arc's own record is `06-Systems/Online-Arc.md` THE
2026-09-28 DISCORD BATCH. Mutants: `tools/mutants/disc28.json` (48, all dead).

The list, as the screenshots carried it:

1. A quest shared by a friend who then finished it (The Courier; the Buckingwing Residence) does not complete, and the
   quest's house could not be entered after the first player had entered it.
2. Dying over and over from fatigue after an online respawn - "respawn at 0% fatigue"; a second player: "it gives me a
   small portion and I collapse again" (and the older DISC24-D "death loop after level 5 online").
3. Two Mages Guild "cast the Sleep spell" jobs sent to the same house showed the first job's residence name.
4. EvoAva: "If you change the default pause key binding from escape to anything else, it allows you to open pause menu
   with that key binding, but not close it".
5. The game locks up if guards hit you the moment you fast travel.
6. Arrested again and again for Criminal Conspiracy. The DFU developer's answer in the thread: DFU's own behaviour at a
   legal reputation of -10 or lower, "should be adjusted probably".
7. The shop: the list rows' markers drawn over the haggle/confirm box.
8. "The speed attribute only affects the third-person animation, not the first-person swing rate" (with a link to
   `characters/weaponStates.js`'s formula).
9. Veraten: (a) Atronach Hunting's kill not credited; (b) the swim physics stayed on after leaving the water, and the
   player rose "way up" through the map and fell into the void.
10. The Dragonslayer quest's dragonling stuck half in the floor.

## DISC28-A: the pause key closes what it opened (4)

The host opens the enhanced pause screen on the PAUSE ACTION (inputActions' `Escape`), but the screen's own key handler
(`ui/enhancedMenu.js` onKey) knew back only as the shared table's literal Escape (`overlayAction`). A pause rebound to P
opened the screen, and P there was an ordinary letter that nothing took. DFU's pause window closes on the action's own
binding (DaggerfallPauseOptionsWindow.cs:159 `toggleClosedBinding = GetBinding(Actions.Escape)`, :186 on key-up) as well
as the back button, and the classic window already did (`ui/pauseWindow.js`).

On the pause face the action's key is now back too (`eventMeans(e, 'Escape')`), never its auto-repeat - the held key that
just opened the screen must not close it on its first repeat. The boot menu is not the pause face and is untouched. A
mod's TextKey capture ("press a key", HT1) now owns its key ahead of the back stack, as the Controls pane's capture
already did (FIX-F): registered after the menu's handler, it ran second, so the one key it waited for walked the back
stack first - and with the pause action's key now a back key, a pause rebound to P could not have been given to a mod
key without leaving the page. Its listener has one owner and unmount removes it.

`test/disc28_pause.test.js` (7): the real registry, the real input table and the mounted screen - a rebound P resumes
and is stopped there, its repeat does nothing, an unbound letter does nothing, the literal Escape still resumes, the boot
menu ignores P; the capture's stand-down and its owner by source.

## DISC28-B: a surrender box never outlives its crime (5)

Online the world runs under every window (WORLD5), so a guard's blow can raise the surrender box as the travel map
commits the journey, and the arrival clears the crime (the PostFastTravel clearer, `scenes/world.js` fastTravelTo) with
the box still standing. The box then held the damage veto, asked about a crime that no longer existed, and Y marched
the player into `startCourtFlow` - which set `arrested`, opened the modal courtroom and only THEN asked `startCourt`,
whose null (no crime: DaggerfallCourtWindow.cs:109-114 closes the court) the plead box dereferenced. The throw left a
courtroom with nothing over it and `arrested` standing - every damage veto on, nothing that could close it. The lockup.

- The trial is read before anything is armed: no crime, no court - DFU's court that closes itself, whose OnPop
  (:432-438) clears Arrested.
- The answer re-reads the crime: Y to no crime surrenders to nothing (no forced 1 health), N lands no departed guard's
  blow.
- `arrestFlow.crimeCleared()` withdraws a standing surrender question the moment the crime goes, closing the box as an
  answer does and dropping its veto; the arrival calls it where it clears the crime. A trial already under way is left
  to its release.

`test/disc28_arrest.test.js` (6) through the real flow, the real court and the one damage door. JAIL-HIT's mutant
records re-aimed (6 dead); `test/courtrescue.test.js`'s anchor re-aimed.

## DISC28-C: the shop's confirm box stands above the rows' markers (7)

The counter's Yes/No scrim (`ui/enhancedTrade.js` boxScrim, appended inside the window after the lists) stood at
z-index auto. The shelf rows' furniture climbs out of auto - the wear bar at 1 (WEAR-UI), the sigil rune and the padlock
at 2 (`ui/enhancedPlusStyle.js`) - and nothing between the lists and the scrim makes a stacking context, so every
positive layer painted over the modal whatever the DOM order: the column of dashes in the screenshot is one wear bar per
row. The three shells that raise an `.sb-ask` box (trade, spellbook, tavern) stand it at layer 10.

`test/disc28_shopbox.test.js` (4) reads every z-index the shipped stylesheets (the classic face's and Plus's) declare
under each shell and holds the box above them all.

## DISC28-D: the first-person swing reads the live Speed (8)

The formula was right - GetMeleeWeaponAnimTime, `3 * (115 - LiveSpeed) / 980` a frame (FormulaHelper.cs:830-838) - and
never saw the player. The rig built its `PlayerWeapon` with no speed (`combat/weaponRig.js`), the weapon took the default
50 as a NUMBER once, and nothing wrote it again: every player's swing clock, hit frame, swing sound and bow cooldown ran
at Speed 50, while the third-person body and the widget's clone read the live stat. DFU asks
`player.Stats.LiveSpeed` on every UpdateWeapon (FPSWeapon.cs:431, :549-556). The weapon's `liveSpeed` is now a live
read (a function, or a number for a fixed-speed weapon), and the rig hands it the entity's `liveStat(entity, 'speed')`.
Roleplay & Realism's and RR Items' registered anim-time overrides receive the same live value.

`test/disc28_speed.test.js` (4): the swing lasts five of the formula's ticks at Speed 20, 50 and 100; a Speed that
changes mid-life changes the next swing; a number still fixes it; the rig's reader by source.

## DISC28-E: the dead live no minutes (2)

The online revival handed back a body the next tick killed. Two flaws:

1. **The fatigue was restored only when it was exactly zero** (AUDIT DISC19 S4). A death with a sliver left - a blow
   landing while exhausted, an online collapse that paid its eighth - stood up with the sliver, and the next walking
   drain collapsed the player beside the same foes. The respawn's fatigue is now at LEAST the health's fraction
   (`systems/deathRespawn.js` reviveForPlay); more than that is kept; a living release (no force) is untouched.
2. **The minutes spent dead were charged to the revived body.** Online the shared clock runs on under the death screen
   with nothing ticking (the hosts hold their frame under a window), so the player's markers stood at the minute of
   death and the first tick after the rise replayed the whole span - every minute of stamina drain and needs
   (runSurvivalMinutes floors only a replay's harms) and the magic rounds - against the half pool just given. Five real
   minutes on the death screen in Hard with red needs was sixty game minutes of drain: a collapse on the spot, which with
   foes about is a death, and the same bill again. DFU charges a dead player nothing: PlayerEntity.Update returns while
   CurrentHealth <= 0 (PlayerEntity.cs:352-353), before its minute loop and its marker. The revival now skips the span
   (`systems/worldTick.js` skipDeadMinutes): the player's minute marker and the round broker's move to now, the needs'
   clocks ride over it (`pauseSurvival` - hunger and wakefulness do not age in a corpse), and a 112-day normalise the span
   crossed is still paid (DISC28-F). The WORLD's markers are the world's and do not move: a room rented or a loan falling
   due runs on the world's clock through a death as through any hour. Offline there is no such span (a death is a load).

Left for Mac (below): an online collapse charges no hour (`systems/rest.js`), so a Hard player whose sleep need is
exhausted collapses every few game minutes until they rest - a survival-arc design question, not this loop.

`test/disc28_fatigue.test.js` (E: 6) drives the real tick and revival: a Hard body hunted to death by its own drain,
12, 60 and 90 game minutes on the death screen, stands up at the floor and survives its first tick. AUDIT DISC19 S4's
pin re-aimed ("a sliver is raised to the floor; above the floor, fatigue left is kept") and its four mutants re-aimed.

## DISC28-F: an absence pays the reputation boundaries it crossed (6)

The conspiracy rules are DFU's to the letter (verified): `encounters.js` passiveGuardSpawns is PlayerEntity.cs:486-511's
roll - below -10 (strictly), 5% a game minute, `SpawnCityGuards(false)` - and Criminal Conspiracy's loss of 2 gives back
nothing for a served sentence (PlayerEntity.cs:2301-2303), so four arrests for one standing is DFU's behaviour. What was
NOT DFU's: the one road back. NormalizeReputations - every region's legal reputation and every faction's one point
toward zero - fires on the exact minutes that are multiples of 161280 (PlayerEntity.cs:455-459). The single-player clock
never runs while nobody plays; online it runs on through every absence, and the stamps that end one
(`alignEntityClocks` on arrival and clock correction, and now the dead span) moved the marker to now without walking the
span. At the shared clock's 12x a boundary is an instant about every nine real days, and one that fell while the player
was away was lost for good: the reputation never came back, and the player kept rolling conspiracy.

`normalizeAcross(entity, from, to)` pays each boundary in `[from, to)` once - the same minute values the per-minute
loop tests - under the prison skip's own one-jump shield. The conspiracy roll itself is unchanged; whether to soften it
is Mac's call (below).

`test/disc28_fatigue.test.js` (F: 4): an arrival across three boundaries pays three, one inside an interval pays none
(DFU's `[last, now)`), the shield holds, a death across a boundary pays it.

## DISC28-G: a rising swimmer meets the ceiling, never its top face (9b)

Not a stale swim flag - every dungeon host re-reads it from the player's own block each frame, and DFU's test is height
alone against a water plane that covers the whole block (PlayerEnterExit.cs:380-392). The swimmer TUNNELLED UP THROUGH A
CEILING that was under that plane. A swimmer is crouched to 0.9 (axis 0.2) and a move steps at up to 0.2625, so the
Deep Waters stroke (Run, on by default) brought the LOWER sphere within its radius of the ceiling face while the head
was still beneath it - and PH1's one-way floor, right for a body straddling a floor, set the whole body ON the ceiling's
top. Outside the level and still under the block's water plane, the player swam on up with nothing to meet, out of the
water, and fell with no floor under the dungeon. Reproduced through the real motor, collider and stroke at 45, 30 and
20 fps. DFU's CharacterController sweeps and never crosses a plane.

The rising vertical pass (`player/collider.js` _moveStep) hands `_resolveCapsule` the body's axis: rising, a surface is
a one-way floor only below the head's centre - a floor the body straddles, PH1's own case. Otherwise it is a ceiling.
At rest, falling and moving sideways, PH1 is exactly as it was.

`test/disc28_swim.test.js` (7). PH1's and SQUEEZE1's source pins re-aimed; ASQ-S1's mutant record re-aimed.

## DISC28-H: a flyer never starts with its feet under the floor below its marker (10)

Quest B0B70Y16 places a Dragonling (id 40, behaviour Flying) at a dungeon marker, and Meaner Monsters - on by default,
forced on online - scales its texture 2.5x. A flyer hangs on its marker as DFU's does (the transform is the sprite's
centre, RDBLayout.cs:1546-1548 grounds everything else), which puts its feet half the idle sprite below the marker: for
the dragonling, 1.5-2 m under a floor the marker stood half a metre above. DFU's CharacterController pushes a start
overlap out; the port's collider pushed the middle and head spheres DOWN from the face they were under, and the
dragonling flew on held half in the ground. Every peer's puppet mirrored those feet, and re-hung the streamed FEET as a
centre, half a sprite lower again.

`characters/enemyAnchor.js` flyerSpawnFeet floors the hang at the floor under the marker (a surface above the marker is
not the floor beneath it); a bat high under a ceiling keeps DFU's hang exactly (the ceiling-bats law). Both streamed-puppet
stands in `scenes/dungeonContext.js` build with `feetGiven`.

`test/disc28_flyer.test.js` (7) through the real collider with the flying motor's own move. The bats pin and WORLD3's
`buildFoeAt` signature pin re-aimed.

## DISC28-I: the shared quest ends for the whole party, and its house opens for its holder (1)

**The finish was never sent.** The sharer's `end quest` completes the quest and the machine tombstones it in the same
tick, which takes it out of `sharedQuestNames` - the one set the live sync walks. And the sync's measure was the log's
LENGTH, which a `killed N`, a `give pc`, a `say` or an `end quest` never changes. So:

- A finished shared copy leaves its final envelope (`machine.tombstoneQuest`, taken before the dispose;
  `takeFinishedShares`). The host sends it once, `sync` and `final` (`scenes/world.js` questSyncTick), before anything
  else in the tick can return.
- The receiver's standing copy is restored as the running quest it was a tick before the end, its newly-completed
  rewards re-armed as every resync's are, and ended by the quest's own EndQuest (`machine.updateSharedQuest`): the two
  ticks of grace run the re-armed `give pc` once, the reputation and the notebook entry are the receiver's own, and a
  finish a partner brought is never sent back. Restored as complete instead, it would have been tombstoned with every
  reward unpaid (a complete quest never updates).
- A final envelope never makes a copy for a member who never took the quest (`questShare.receiveSharedQuest`,
  'finished', said to nobody).
- The sync watches `shareSignature` - the log, every task's trigger, every action's completion, each Foe's kills and
  injury, the end.
- `get item` joins the actions a receiver replays (REPLAYABLE_ONE_TIME_ACTIONS): a shared quest's items are the
  receiver's own roll, so The Courier shared after the sharer took the package now hands the receiver theirs, once.

**The door.** The lock ladder's quest rung asked the SITE LINKS, which only a placement action makes. DFU's
IsActiveQuestBuilding (PlayerActivate.cs:1315-1329) asks GetAllActiveQuestSites - every Place of every incomplete quest,
by building key and map id, House1-House6 when residencesOnly. The Exterminator names its house and places nothing in
it, so its own holder was locked out while the friend it was shared with (whose receipt links every Place) walked in.
`machine.isActiveQuestBuilding` is DFU's member; the door (`scenes/worldModes.js` questSiteHere) and the house market
ask it.

`test/disc28_quest.test.js` (9): the real machine, the real share path and the vendored A0C00Y07. QUEST-PARTY's and
PARTY8's pins and records re-aimed.

## DISC28-J: a partner's quest foe credits a linked copy (9a)

Atronach Hunting (N0B10Y01) offline was read end to end and is correct. Online, the party law stood a peer's quest foe
for any party member (`questShareSeam.accepts`), but its death credits only a copy LINKED by a share
(`sharedQuestFoe`). Two members who each took the quest (a share refused as 'active' - the sender's copy is marked shared
the moment it sends), or a copy whose link a reload dropped (the link is session state), stood the partner's atronach
beside their own and killing it counted for nothing. A peer's quest foe now stands only for a linked copy; an
independent one fights its own.

## DISC28-K: a house re-picked by a later quest shows that quest's name (3)

A residence Place rolls a fresh surname on every pick (Place.cs:1219-1224, :1298-1311), and `discoverBuilding` returned
early on any building already discovered (PlayerGPS.cs:926-927) - before the live quest's name was read (:945-959).
The first job's name was never cleared: its tombstone's undiscover (Quest.cs:655) and the next job's topic-add
undiscover (TalkManager.cs:2958) both act at the CURRENT location and only on a stored name equal to the new one, so a
job ended in another town left "The X Residence" standing and the next job's "The Y Residence" never displaced it. The
quest said Y; the door and the map said X. DFU does the same. THE DEPARTURE (Port-Ledger A): a stored name the live
quest no longer gives, once the player has learned of it, is re-stamped.

`test/disc28_names.test.js` (2).

## For Mac

- **Conspiracy (6).** Faithful, as the DFU developer said: below -10, 5% a game minute, and a served conspiracy
  sentence gives back nothing. DISC28-F restores the only recovery DFU has (the 112-day normalise) to online players.
  Whether to soften the roll itself (the threshold, the chance, or a grace after release) is a design change and is
  yours to call.
- **An online collapse charges no hour.** With the survival arc on Hard, an exhausted sleeper collapses every few game
  minutes until they rest, each collapse a death with foes about. The revival no longer causes this (DISC28-E); whether
  a collapse should ease the sleep need online is a design question.

## Records

- Mutants: `tools/mutants/disc28.json` (48 dead). Re-aimed: `jail_hit.json` (6), `auditdisc19.json` (four S4 records),
  `auditparty8.json` (AP-quest-echo), `auditsqueeze.json` (ASQ-S1).
- Citations: `tools/citeShift.mjs --base fe95d9592 --apply --struck`, once (264 moved); the worldModes DiscoverBuilding
  note re-aimed by hand to `discovery.js:83`; `Hardening.md:642` quotes a past mismatch as history and stands.
