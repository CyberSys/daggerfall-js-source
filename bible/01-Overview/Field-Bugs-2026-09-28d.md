# FIELD BUGS 2026-09-28 (d) - DISC29: ten screenshots, eight reports

From the Discord, through Mac: ten screenshots and no words, the rule for a batch like it - every report root-caused
on the real modules (and the real ARENA2 where the report lives in the data), the port's own faults fixed and pinned,
and what is Daggerfall's or a mod's own said plainly, with what would change it left to Mac.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| A | the throne puzzle's switch never activates when walked on | Skibbster | the walk-on pass read the object's BOX top, not its surface | fixed |
| B | a coloured-tier "iron" helmet refused for a class forbidden leather | Julian | the refusal is Roleplay & Realism: Items' design; the rarity name dropped its "Brigandine" | fixed (the name) |
| C | Climates & Calories: fatigue never below 1%, and drains in ~20 min standing still | lumin | Roleplay & Realism's overload round, the mod's own arithmetic | Mac's call |
| D | a dungeon at 99.9% CPU, 68-203 ms frames, DOM nodes climbing past 3,000 | Skeptikali | eight DOM faces rebuilt every slow frame by wall-clock watchdogs | the climb fixed |
| E | interior lights flicker; shadows cast through walls (the Mages Guild) | Kristian B | (below) | (below) |
| F | the gallop keeps looping inside a building entered while riding | Skibbster | a mode change never stopped the riding channel | fixed |
| G | ~4 swings a second at "Speed 55", faster as a wolf, online | Lynk | DFU's own rate for a lycanthrope's live Speed (55 + 40) | DFU's; pinned |
| H | Mages Guild membership lost mid guard-quest; the quest won't complete | Triage | the quest script's own penalty; Info mode could spring it | the port's part fixed |

## DISC29-A: a Collision01 object is stood on wherever its own surface is (Skibbster)

**Reproduced first**, on the real BLOCKS.BSA through the port's own layout, collider, motor and action system:
N0000037's two thrones (objects 22908 and 22979, model 41123) are CastSpell effects with the Collision01 trigger -
WalkOn only - chained to a tapestry (23098, a 1.6 m Translation) that stands over a Collision03 teleporter brick. A
motor walked onto the seat logged `WalkInto refused` eighteen times; the tapestry never moved.

**Why.** DaggerfallActionCollision (:68-85) calls a contact WalkOn when it is beneath the player, and on a Collision01
object also when "a ray straight down from the controller's bottom, skinWidth long" hits the object's own collider.
The port's pass read "beneath" as the top of the object's box (within 0.15 of the feet) and folded the ray into it "at
our capsule scale". A throne's box tops its backrest at 34.08; the seat is at 32.55.

**The fix** (`world/actionSystem.js standsOnAction`, `ownSurfaceUnderFeet`): the box's top, or - Collision01 alone -
the object's own surface within Unity's 0.08 skin under the feet. A mover or a door is its own bucket already; an
effect or relay is in the shared `'dungeon'` bucket, so the dungeon host keeps a copy of a Collision01 one's triangles
in a probe-only collider nothing moves against (`triggerSurfaces`). With it the whole puzzle ran on the real data:
WalkOn on the seat, the spell (record 17) cast, the tapestry aside, the brick walked into and the teleport taken.
Measured over BLOCKS.BSA: 49 of the 104 Collision01 objects had no upward face within the old band and 12 only some -
Activate relays, DoorText plaques, Hurt23/Hurt24 rooms, CastSpell rooms - and each now fires as DFU's does, which
players will notice. Every other flag keeps the box's top (they admit no WalkOn: the arm only decides a refusal).
`03-World/Player-Arc.md` DISC29-A.

## DISC29-B: a rarity name keeps the word the mint wrote (Julian)

**What the report is.** A light-set piece of Roleplay & Realism: Items in a plate material is BRIGANDINE, and the
class's NativeMaterialValue takes 0x0200 off "so DFU treats this item as leather for forbidden checks" - the refusal is
the mod's design, and the port's forbid check reads it correctly (`equip.js isForbiddenEquip`, AUDIT-RR F7). The port's
fault was the name: the mint named the piece "Brigandine Helmet", and the Loot Rarity ladder built "Sentinel's Helmet
of the Bear" again from the bare template - the list read "Iron Sentinel's Helmet".

**The fix.** One rule per armour class for its word (`rriItems.js lightWord`, `mailWord`, `rriVariantWord` - Fur read
before the fold or after it), which `rarityName` puts before the template's name; a save's Magic and Rare names are
given it back on load (`repairRarityNames`: only a name that is the old bare build moves). And the same class value,
read by two other mods: Immersive Footsteps and Better Ambience read `NativeMaterialValue` - the property the mod
overrides - where the port read the raw material, so brigandine boots walked in plate and a mail hauberk clanked as
plate. Both read `rriNativeMaterialValue` now. `06-Systems/Roleplay-Realism-Items.md` DISC29-B.

## DISC29-C: fatigue at 1% is Roleplay & Realism's own round (lumin) - Mac's call

Traced through the port's own ticker, survival minutes and the world host's collapse, with a 67/63 body (a pool of
8,320). Neither symptom is Climates & Calories' - its needs drain far less than the mod's own (`needs.js`), each minute
is charged once, and the tier is honoured.

- **"Drains very fast, about 20 minutes standing still."** Roleplay & Realism's encumbrance round charges fatigue for a
  load over 75% of the ceiling, moving or not (RoleplayRealism.cs:581-600, no standing-still gate): at 92% about 26 raw
  a game minute after BALANCE1's 0.75, beside the minute's own 8 (DFU's 11 at the same scale). The Climates & Calories kit is 12.5 kg of that load, and
  hunted meat goes into the pack. With 80 kg and the kit the bar met its floor in 20.7 real minutes standing still.
- **"Never lowers past 1%."** The same round's cost is `Mathf.Min(CurrentFatigue - 100, encOver * 100)`
  (RoleplayRealism.cs:595) - negative below 100 raw, and `DecreaseFatigue` of a negative REFILLS: each round puts the
  bar back to 100 raw, 1.2% of the pool, which the HUD prints as 1%. The collapse at 0 never comes. It is the mod's own
  arithmetic, ported and pinned as such (`test/rr1_realism.test.js`), and DFU with the mod shows the same floor.

What would change it is Mac's: a departure from the mod (the round never refills - then the overload runs the bar to 0
and the exhaustion collapse, which kills with foes near, returns every few minutes of carrying too much), a gentler
overload scale, a lighter kit (the 3 kg Campfire Kit is the port's own item), or an "Overloaded" chip on the status
strip so a player can see where the drain comes from. The report (09-26) predates BALANCE1's scale and ENC-CEIL.

## DISC29-D: a draw's watchdog counts frames, not milliseconds (Skeptikali)

**The climb, reproduced** in the real game at a slowed frame rate: the notice stack added and removed sixty times in
sixty frames, the tutorial's Yes/No shell fifty-three; the nodes are collectable garbage, reclaimed by a forced GC.
Eight per-frame DOM faces (the notice stack, the dialog and choice menu, the picker, a ported window, the input box, the
Yes/No card, the world plaque, the death layer) re-armed a 150-400 ms wall-clock timer per draw and took themselves down
when it fired - so a frame slower than the timer tore the face down and built it again every frame. `ui/drawWatchdog.js`
releases a face only when an animation frame came and went without its draw (its own ticker, running only while a face
is armed), or when no frame at all has come for 3 s. All eight read it.

**The CPU** has no single bad call: 15-30 ms of frame script on a desktop CPU, 62-183 ms walking with the CPU slowed
four times - the reported band - spent in the foes' motors and senses, the player's motor and collider, and the
collector. A slow frame costs more (a 0.1 s cap on a fixed 1/60 s step is six physics steps). The FPS counter could
not tell whose the frame was indoors: the indoor foot closed its token unsampled. It takes its sample now, so the
counter's script time reads in dungeons and interiors - the number to ask the next report for, beside whether the
desktop app is on the GPU. `10-UI/UI-Arc.md` DISC29-D.

## DISC29-E: interior lighting (Kristian B)

(Pending its trace - this section is completed with it.)

## DISC29-F: a mode change stops the riding loop, as UpdateMode does (Skibbster)

**Reproduced** on the real worldModes with a real Mages Guild interior: a gallop, a door, the mode Foot - and the loop
still playing inside, zero rig frames having run between the dismount and the interior. The riding sound is one
channel that re-arms at each clip's end, and only the rig's frame ever stopped it; the door's dismount goes through
`mountRig.setMode`, which never did, and the indoor frame returns before the rig. DFU's UpdateMode stops the source
first on every change (TransportManager.cs:332-336); `setMode` does now - doors, teleports into an interior, a
quickload indoors, the ship, the deep-water dismount, a horse swapped for the cart. The fixed-city host never handed
worldModes its dismount seam at all (a rider stayed mounted through a door); it does. `06-Systems/Systems-Arc.md`
DISC29-F.

## DISC29-G: four swings a second is DFU's rate for a werewolf (Lynk)

DISC28-D made the first-person swing read the live Speed, as GetMeleeWeaponAnimTime always did - before it every
player swung at the number 50. Lynk is a lycanthrope: the curse adds 40 Speed in both forms every magic round
(LycanthropyEffect.ApplyLycanthropeAdvantages), so a base-55 character swings at live 95, about 3.3 blows a second in
DFU too, and a +5 Speed item reaches the cap at 4.4. The wolf is faster still under the default Roleplay & Realism:
Items weaponBalance, which slows a held weapon by its weight - the claws hold none. The Attributes page shows the live
95 / 100; if Lynk's really reads 55, a screenshot of it, the Weapon Swing Style and the weapon would find what this did
not. Pinned as DFU's rate (`test/disc29_swing.test.js`), so a slower werewolf would be a decision (a declared departure
at the one Speed the clock reads), not an accident.

## DISC29-H: the Mages Guild's own trap, and a way into it DFU does not have (Triage)

The quest is N0B20Y02, "Protect an Honored Mage". A click on the sleeping mage is `_S.04_` (-10 and a shielded hostile
Mage - him) and that Mage's death is `_S.07_` (-50 and the Knight, Battle-mage and Assassin waves - the "raiding mages
and knights"), so the next visit expels (TEXT.RSC 668) and JOIN reads 612, the record for a negative reputation. The
raiders' deaths change no reputation; success needs `not _S.04_`, so the only ending left is the failure seven days on.
It is the same trap KimNix met (`Field-Bugs-2026-09-26b.md` DEAD-CLOCK), and DFU springs it the same way.

The port's part: DFU clicks a quest stand only in Grab, Talk and Steal - Info is "You see <name>" and nothing else
(PlayerActivate.cs:334-338, :753-757) - and the port clicked it in every mode, so a LOOK in Info sprang the trap. Fixed.
Not changed, and Mac's: in a party, a partner's kill of a shared quest's foe is credited to every member's copy, so
`_S.07_`'s -50 also lands on a member who never touched the mage - the same credit that carries an ordinary
summon-and-kill quest forward for the party. `06-Systems/Quest-Arc.md` DISC29-H.

**For Triage:** the quest ends by itself about seven game days after the kill; to rejoin, the guild's non-member jobs
(GET QUEST) raise the reputation +5 a success until it is 0 or more, and JOIN takes it at rank 0.

## Record

`test/disc29_throne.test.js` (5, one on the real N0000037), `test/disc29_rarity.test.js` (6),
`test/disc29_watchdog.test.js` (5), `test/disc29_gallop.test.js` (4), `test/disc29_questinfo.test.js` (3),
`test/disc29_swing.test.js` (2); one test added to `test/if1_immersivefootsteps.test.js`. Re-aimed to the new laws:
`test/enhancedNotice.test.js`, `test/worldhover.test.js`, `test/uxb1m_privateproperty.test.js`,
`test/resourcesafety.test.js`, `test/auditretro1.test.js`, `test/dungeonquestclick.test.js`.
`tools/mutants/disc29.json` (34, all dead); `tools/mutants/ba1.json` and `tools/mutants/worldhover.json` re-aimed by
content. The committed mutants on every file this batch changed were re-run: 378 (B's files), 367 (A's), 77 (D's
faces) and F's - all dead, the four already recorded as equivalent standing. Cites: `tools/citeShift.mjs` moved 194
into the files this batch shifted; the 13 it leaves by design - struck Ledger and Settings rows the citedrift gates
(CD4, CD8) resolve by content, and a continuation on the line below its file's name (`chargenSession.js`'s `(:N)`) -
were mapped through the same diff with the base line's text checked against the tree's. `bible/10-UI/UI.md` counts 241
modules; `test/audit26_talk.test.js` counts the seventh static-NPC name site (the Info look).
