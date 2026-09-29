# Naval Combat - the sea fight (NAV-A to NAV-H, 2026-09-28)

Mac, 2026-09-28: "We have a lot of cool updates on the way. Today were going to be doing something extremely
detailed. We're going to enhance the newly integrated ships by adding proper navel combat with a huge reference to
assiasins creed black flag. Being able to aim and fire when viewing from the side. Along with this, I want to
introduce actual sailing ships to the world yhat players can encounter and pillage, with should also directly
enhance and integrate into the pirate quest system. All UI elements should follow enhanced plus UI. This task is to
be extremely detailed, authentic and easy to use. This is your baby and I want it to be as detailed as possible and
directly integrate into online mode."

**THE PORT'S OWN.** Daggerfall has no sea fight and Daggerfall Unity none either; nothing here is transcribed from a
mod's IL, so no `[IL]` citation points into any assembly and the arc carries no credits row - Port-Ledger section A
carries its row instead. It stands on three things the port already had:

- **Come Sail Away's hulls** (`03-World/Come-Sail-Away.md`): the player's boats are the ones that carry guns, and the
  sea's ships are built on the same five prefabs (`scenes/comeSailAwayPool.js` `spawnSeaNow`: drawn, baked and lit as
  a boat of the player's, in the pool's own SEA list - never `boats`, so no helm is taken on one and no deed places
  one). With the mod off there is no sea fight (`world.js navalOn`).
- **Warm Ashes - Ships' quests** (`03-World/Warm-Ashes-Ships.md`): the pirate quest system Mac named. A crewed boat a
  pirate grapples meets the mod's own raid on its own planks, and a pirate FLAGSHIP brings `WAQ_SHIP_ATTACK_PIRATE` -
  the quest the mod registers and never starts - with the Spellsword leader it was written around.
- **DFU's own law, loot and foes**: Piracy is `Crimes.Piracy` through `LowerRepForCrime`; a hold is the DFU loot
  tables' roll; boarders and defenders are the classic mobile classes on the exterior foe pool.

## The slices

| slice | what | modules |
|---|---|---|
| NAV-A | THE GUNS: closed-form ballistics, the batteries each hull carries, the aim from the look, the reload, the brace; what a ball does to a ship (hull, sails, crew, fire, the waterline) and the states a ship goes through | `systems/naval/navalBallistics.js`, `navalShips.js` (HULL_BUILDS, GUNS), `navalGunnery.js`, `navalDamage.js`, `navalShots.js` |
| NAV-B | THE PICTURE: the naval pass (smoke, muzzle flame, spray, splinters, the founder's foam, the balls in flight, the aim's arcs and splash zone), the deck fires on Daggerfall's own fire flat, a sea ship's colours on her flag; and the root fix of Come Sail Away's soft drop (below) | `systems/naval/navalEffects.js`, `render/navalRender.js`, `scenes/navalFlames.js`, `render/comeSailAwayRender.js` (flagRuns, softParticleTexture) |
| NAV-C | THE SHIPS OF THE ILIAC BAY: nine classes in three trades, their names and captains off the region's name bank, the crowns their navies serve; the captains' seamanship; the traffic | `systems/naval/navalShips.js` (SHIP_CLASSES, CROWNS), `navalAI.js`, `navalDirector.js`, `scenes/comeSailAwayPool.js` (seaBoats, spawnSeaNow) |
| NAV-D | BOARDING, PLUNDER, THE LAW AND THE QUESTS: grapples, musters, the prize window's model, holds and flotsam, notoriety and the crowns' law, Warm Ashes' raids started and gated | `systems/naval/navalBoarding.js`, `navalPlunder.js`, `navalLaw.js`, `systems/warmAshesShips.js` (the gate) |
| NAV-E | THE SOUNDS: six synthesised clips baked to DAGGER.SND's own format (a seventh and an eighth, the run-out and the ready, with AUDIT NAV1), and the distances every naval sound carries | `tools/navalSfx.mjs`, `tools/sfxSynth.mjs`, `systems/naval/navalSounds.js`, `public/sfx/naval-*.wav` |
| NAV-F | THE UI, ENHANCED PLUS: the helm's readout (ship plate, battery rose, aim, target card) and the plunder window, in the stone-and-brass kit on either skin | `ui/navalHud.js`, `ui/navalPlunderDoor.js`, `ui/navalPlunderWindow.js`, `ui/enhancedFrame.js` (FRAME_ROLES, scopeRules) |
| NAV-G | ONLINE: one player stands the sea for everyone near; the ships, volleys and barrels ride the foes frame; a blow on another's ship goes to its owner; a boarding claims the ship | `systems/naval/navalWire.js`, `scenes/exteriorFoes.js` (setOnNaval), `scenes/comeSailAwayPeers.js` (helmBoats) |
| NAV-H | THE HOST: the sea fight stood in the streaming world - the frame, the input, the activation, the draw, the lights, the origin, the colliders, the save, the transitions, the quests, the settings | `scenes/navalHost.js`, `scenes/world.js` (the NAV-H block) |
| AUDIT NAV1 | THE DEEP AUDIT (2026-09-29): six lenses measured the arc against Black Flag on its own harnesses; the captains' seamanship rebuilt (below), the hulls kept apart, a galley's ram, the sea on the world's clock; THE GUNS - the captains' gunnery and the run-out that tells a broadside is coming, the rig a target, fire, the prize kept a prize, the readout's warning and tally | `systems/naval/navalAI.js`, `navalShips.js` (the hulls' extents and rigs, the classes' pace, the carriages), `navalDirector.js` (the berths), `navalDamage.js`, `navalShots.js`, `navalGunnery.js`, `navalWire.js` (the run-out's bits, a barrel's fire), `navalSounds.js` and `tools/navalSfx.mjs` (the run-out), `navalEffects.js` (the glint, the shreds), `scenes/navalHost.js` (`stepSea`, `separateHulls`, `checkShipRams`, `strike`, the tell and the tally), `ui/navalHud.js` (the warning, the tally), `scenes/comeSailAwayPeers.js` (helmBoats' hull and heading); THE HELM - the aim a look lays and its red, the broadside camera, the brace, the ram, her hurts in her handling, the shipwright and the mending at sea: `navalGunnery.js` (lookReach), `navalYard.js`, `systems/comeSailAway.js` (wayScale, sailRefused), `render/navalRender.js` (the posts, the strikes, the tones), `ui/navalYardWindow.js`, `ui/navalPlunderDoor.js` (one door for both windows) |
| NAV-R | WARM ASHES' RAIDERS AS SHIPS (merged OWS3): a raider near the player at sea stood as a pirate of her seed's own class and name, sailing her seeded course until her lookout sights a boat, then fighting and boarding as any pirate; spent for her life; one copy between two players | `systems/naval/navalRaiders.js`, `scenes/navalHost.js` (`raiders`, `raiderShipOf`), `systems/naval/navalAI.js` (`sight`, `course`), `scenes/world.js` (`raidShips`, the marks) |

## How it plays

- **At the helm of an armed boat, look to a side.** The look's bearing off the bow picks the battery
  (`navalGunnery.js` sideForBearing: within BOW_ARC of the bow the bow chasers, within STERN_ARC of the stern the stern,
  else port or starboard). The rose on the ship plate lights that battery gold.
- **Hold Attack** (the SwingWeapon action - right mouse by default, RT on a pad, the swipe on a phone): the guns are
  LAID under the look - on the sea where it meets the water (out to where that point would move more than AIM_SLOPE a
  degree, then AIM_SLOPE a degree on to the battery's longest), and ON A SHIP for her very point: the crosshair on her
  side lays the broadside into her side, on her canvas round shot into her hull and chain into the canvas. Every
  muzzle's arc is drawn to where it stops - a splash ringed on the sea with a post of light standing over it, or a
  mark on her side where the ball will meet her - all turning red when the guns will strike a ship as she will stand
  when the balls get there, and the range read under the crosshair ("Starboard broadside - 138 m", "(longest)" at the
  battery's reach, "on target"; or why it will not fire yet - "reloading 6.1 s", "braced", "no barrels", "guns
  silent" - the zone grey). THE BROADSIDE CAMERA eases the eye out over that side while a broadside is laid - her
  ports, the zone and the enemy on one screen - and home on the release (the Broadside camera part of the row).
  **Let go and they fire**, a ripple down the side (RIPPLE_S apart), the smoke drifting down the wind. Black Flag's
  "viewing from the side" is exactly this: the look IS the aim, in first person or over Eye of the Beholder's
  shoulder - so while the attack is held at the guns the mouse's drag, the pad's right stick and the finger's drag all
  TURN THE VIEW (the swing's look law, which drops the look under a held swing, stands down there, and the pad and the
  finger hold the attack plainly - `aimHold`). A readied spell still eats the press first. A window opened over the
  aim puts it down unfired; the release itself is never gated.
- **Crouch braces** (C, LB on a pad - R3 under Enhanced Plus's pad layout, whose bumpers are the crossbar's; on a
  phone the plate's own BRACE press, held): the crew ducks behind the rail - half the hull and sail damage while held,
  no gun fires and no gun is loaded (AUDIT NAV1: the reload waits). It is the Crouch action because that is what
  bracing is, and at the helm it is nothing else (AUDIT NAV1: the stance stays as it was); see the departures.
- **Watch for the run-out** (AUDIT NAV1): an enemy's battery is RUN OUT before it fires - its ports glint along her side,
  the gun trucks rumble across the water, and when it bears on you BROADSIDE and the brace's key stand over the
  crosshair, from the run-out until her balls are down. That is the moment to brace, or to turn out of her arc.
- **The tally**: once your volley's last ball is down, the line under the aim counts it - how many struck, how many
  below her waterline, how many through her rigging.
- **Interact boards** (E): a ship that has struck her colours within BOARD_RANGE of the helm, the way under
  BOARD_SPEED - the grapples fly, she is hauled alongside, and you go over her rail. On foot (swimming up, or from a
  deck alongside) the same press within FOOT_BOARD_M of her side with the look on her. The target card and the plate's
  hint say the key ("Colours struck - E: board her"). Too fast beside her, the same press HEAVES TO (AUDIT NAV1): the
  sails struck and her way taken off at HEAVE_TO_ACCEL times her own rate until she is under BOARD_SPEED, HEAVE_TO_S at
  most ("Colours struck - E: heave to", then "heaving to").
- **Taken, she opens**: the plunder window - her hold, one thing to take from her, and her fate. Shut it and she lies
  taken where she is; Interact opens her again.

## The guns (NAV-A)

Each hull's batteries are measured off its own model (`navalShips.js` HULL_BUILDS - muzzles at the gunports, the
rail's height, the beam); the table is what each carries, a side at a time:

| hull | hull / sails / crew | batteries |
|---|---|---|
| Rowboat | 60 / 0 / 0 | none - it rams, it does not fight |
| Large Boat | 150 / 60 / 0 | 3 swivels a side, 1 on the bow |
| Small Ship | 420 / 160 / 24 | 6 long guns a side, 2 chain-shot chasers, a fire barrel over the stern |
| Large Galley | 520 / 90 / 60 | 4 long guns a side, 3 great guns on the bow - and the ram (GALLEY_RAM) |
| Carrack | 560 / 220 / 30 | 7 long guns a side, 2 chain-shot chasers, a fire barrel over the stern |

The guns (`GUNS`), their muzzle speed and the ranges that gives from a 4.5 m deck (the lowest elevation to the
highest):

| gun | speed | range | reload | hull / sails / crew a ball |
|---|---|---|---|---|
| long gun | 62 m/s | 26 - 211 m | 9 s | 14 / 3 / 1 |
| swivel | 55 m/s | 21 - 161 m | 4 s | 5 / 2 / 2 |
| great gun | 68 m/s | 32 - 251 m | 12 s | 30 / 4 / 2 |
| chain shot | 58 m/s | 30 - 196 m | 7 s | 3 / 16 / 1 |
| fire barrel | rolled over the stern | where it drifts (FLOAT_DRIFT of the wind) | BARREL_DROP_S (1.2 s), BARREL.stock aboard | 45 / 6 / 3, and always a fire - BARREL.burnPerSecond for BARREL.burn |

AUDIT NAV1 set the carriages' depression (-8 long, -6 great and chase, -10 swivel - a sloop alongside to grapple was
out of every broadside's reach at -3) and made the great guns heavy (68 m/s to 15 degrees: from a galley's deck 263 m
against her long guns' 231 - they fell 50 m short of them).

**The flight is closed form** (`navalBallistics.js`): `p(t) = p0 + v0 t - g t^2 / 2`, no integration and no step
size, so a ball's path is the same on every machine and a peer can fly a volley from its word alone. The aim solves
the LOW arc for the look's range (`elevationForRange`), clamped to the gun's elevation band; past its reach the gun
lies at its highest. The boat's own way is carried by every ball. A volley's spread is the gun's own (`yawSpread`,
`pitchSpread`) scaled by the crew's skill (`volleyLaunches`: x1.5 unskilled down to x0.4), from a SEED - the volley's
balls are reproducible from `(seed, skill)`.

**The reload** is the gun's seconds over the crew left (`reloadSeconds`): an undermanned crewed ship reloads
RELOAD_UNDERMANNED slower as it thins, a crewless boat single-handed at RELOAD_SINGLEHANDED.

## What a ball does (NAV-A)

A ship is three numbers (`navalDamage.js`): HULL (at nought an AI ship sinks), SAILS (its way: BARE_POLES of its best
under bare poles, the rest in proportion to the canvas left) and CREW (the reload, the boarders). A ball that strikes
her HULL box holes her - HOLED (HOLED_BONUS more) when the point it struck is within WATERLINE_BAND of the sea - and
one that passes through her RIG (HULL_BUILDS `rig`: her canvas and spars as boxes over her roof, riding her hull's own
matrix so the masts heel with her) tears canvas and takes a man aloft, and FLIES ON; chain shot is for the rig. A hull
hit above the waterline may start a FIRE (FIRE_CHANCE; a barrel's always does, hotter and longer); each fire burns its
own bite for its own seconds and eats canvas (FIRE_SAIL) and men (one each FIRE_CREW_S) as well as timber, up to
FIRE_STACK at once. At STRUCK_AT of her hull an AI ship STRIKES HER COLOURS - her bell rings, she heaves to, her crew
puts her fires out - and can be boarded, or shot on until she SINKS over SINK_SECONDS as her casks float free:
listing, going down by the head or the stern, until her highest spar is under the sea (`sinkAngles`, `sinkDepth`;
AUDIT NAV1, "The presentation"), her fires burning on until the sea reaches them. The rest of the volley that struck
her cannot sink her (STRUCK_GRACE_S): sinking a prize is a new volley, never the click that took her.

**The player's boat never sinks.** At nought it is WRECKED: no sail will set, the oars at WRECKED_OARS, the guns
silent, until it is repaired - at a port's shipwright, with a prize's timber, or by her own hands at sea. A boat
is a possession bought for up to two hundred thousand gold; losing one to a lucky broadside is a punishment
Daggerfall never deals.

**The shipwright** (AUDIT NAV1, `systems/naval/navalYard.js`, `ui/navalYardWindow.js`): at the helm in a port town's
waters (the host's `nearPort`), her way under YARD_SPEED and no hostile ship near, Activate opens his yard - the
plate's hint names him. He sells her HULL and CANVAS back by the point (REPAIR_PRICE), HANDS by the man and FIRE
BARRELS by the barrel (BARREL_PRICE) - each as much as the purse pays for (coins and letters of credit, DFU's
DeductGoldAmount), never past her whole; MAKE HER WHOLE buys the four in YARD_ORDER as far as the purse goes. **Her
own hands mend her at sea**: no hostile ship near and nothing struck her for FIELD_QUIET_S, her hull and canvas come
back FIELD_MEND_PER_S of their whole a second times her crew's share (FIELD_MEND_ALONE with none aboard), up to
FIELD_MEND_CAP and never past it, never while she burns (a fire strikes her every moment it burns); a wreck floats
again past FIELD_REFLOAT of her hull. Hands
are never mended - they are hired, or pressed from a prize. The plate says MENDING while they work.

**Rams**: a stem striking a hull - her own bow's (`bowZ`) within RAM_REACH of the other's box - at a closing speed of
RAM_SPEED or more (the way she came in with, the most of the last RAM_MEMORY_S, less the other's along her course)
deals RAM_DAMAGE a metre a second (a galley's ram GALLEY_RAM times that) and takes RAM_RECOIL of it back - BOW_RECOIL
times that for a stem not built to ram, a GALLEY_RAM-th of it for a galley's, half braced (AUDIT NAV1).

## The ships of the Iliac Bay (NAV-C)

Nine classes in three trades (`SHIP_CLASSES`), each on one of Come Sail Away's hulls:

| class | trade | hull | from level | boarders | cargo lots | tactic |
|---|---|---|---|---|---|---|
| pirate sloop | pirate | Large Boat | 1 | 8 | 1 | broadside |
| pirate brig | pirate | Small Ship | 4 | 13 | 2 | broadside |
| pirate galley | pirate | Large Galley | 7 | 13 | 2 | bow (steers her great guns on) |
| pirate flagship | pirate | Carrack | 9 | 20 | 4 (the last her strongbox) | broadside; never runs |
| coaster | merchant | Large Boat | 1 | 5 | 1 | runs |
| galleon | merchant | Small Ship | 3 | 9 | 3 | runs |
| carrack | merchant | Carrack | 5 | 11 | 4 | runs |
| navy cutter | navy | Small Ship | 1 | 14 | 2 | broadside |
| navy galley | navy | Large Galley | 6 | 18 | 2 | bow |

**Names**: a pirate or a merchantman a line from her trade's list, a navy ship her crown's own
(`CROWNS` - Daggerfall's under Gothryd, Wayrest's under Eadwyre, Sentinel's under Akorithi), and every captain
DFU's `NameHelper.FullName` over the region's name bank on the ship's own seed (the global DFRandom stream put back as
it stood). The crown of any water is the nearest of the three capitals (`crownOf`).

**The captains** (`navalAI.js stepCaptain`, rebuilt by AUDIT NAV1 - below) sail the wind at the player's own pace
(`windFactor`: in irons nothing, a broad reach best; `windShare`: Come Sail Away's linear wind), never nearer it than
close-hauled - a course into the eye is beaten on a TACK, a slow ship WEARS; they turn on their hull's own turning
circle, eased and heeling on a spring; they keep off the land (the hull's own width sounded every SCAN_STEP past the
turning circle, swinging by AVOID_SWINGS and holding a swing) and off each other (the rule of the road); and they
fight as Black Flag's do: far off they INTERCEPT (a true intercept on the enemy's smoothed way); in reach they show
the broadside that will bear SOONEST - its lead laid dead abeam while it is loaded, bent to work the range while it
reloads; a galley steers her bow guns at the LEAD. A gun fires when the lead bears (`leadPoint`: where the target will
be when the ball arrives). A merchantman RUNS from anything that would take her, on her fastest point of sail; a pirate
under PIRATE_RUNS_AT of her hull runs too - a flagship never. A pirate with GRAPPLE_CREW men to send COMES ALONGSIDE a
player's boat that is crippled, under GRAPPLE_HULL of its hull, or has lain under GRAPPLE_STILL m/s for GRAPPLE_STILL_S,
her broadsides held, and GRAPPLES across GRAPPLE_GAP of water (GRAPPLE_RANGE where a hull is unknown). A navy HUNTS a
player whose notoriety in its waters is NAVY_HUNTS or more, and turns on anyone who struck a lawful ship in its sight
(PROVOKED_S).

**The traffic** (`navalDirector.js`): while the player is on open water, a roll every SPAWN_EVERY seconds (the first
FIRST_ROLL_S after reaching it) stands a ship SPAWN_RING away - out of sight, never nearer than SPAWN_CLEAR to any
player - up to the setting's DENSITY (few 2, some 3, many 5); by trade (FACTION_WEIGHTS; near a port PORT_WEIGHTS - a
port's waters are a merchant's and a navy's), by class (`classFor`: the player's level, the class weights), and a
navy HUNTER (HUNTER_WEIGHT) once the player's notoriety passes HUNTER_AT. A ship past DESPAWN_BEYOND of every player,
not fighting, is gone. The seeds are the waters' (`seedBaseOf`: the pixel and the day).

## Boarding, plunder and the quests (NAV-D)

**Boarding** (`navalBoarding.js`): grapples thrown (GRAPPLE_S of haul, the two hulls BERTH_GAP apart), then the
FIGHT on her deck: her MUSTER - her class's boarders thinned by her crew's losses, never under MUSTER_MIN nor over
MUSTER_MAX, led by her CAPTAIN (a pirate's a Spellsword, a merchantman's a Ranger, a navy's a Knight) - against the
player and, from a crewed boat, their HANDS (Warm Ashes' `_ally_` Warriors, one for every CREW_PER_HAND of the crew,
HANDS_MAX at most). The captain down and SURRENDER_SHARE of the muster with him - or every man - and she is a PRIZE.
Swim or sail ABANDON_RANGE from her and the fight is given up. The dead lie on her deck (lootable) and go down with
her.

**Repelling boarders**: a pirate that grapples the player's boat hauls alongside and comes over the rail. A crewed
boat meets them with WARM ASHES' OWN RAID on its own deck - `WAQ_SHIP_SMALLRAID`, or from a pirate flagship
`WAQ_SHIP_ATTACK_PIRATE` (its waves, its healers, its Spellsword leader, its 5,000-10,000 gold and its repute) - the
quests' foes stood on the boarded deck (`world.js` tryPlaceFoe asks `navalHost.placeQuestFoe` first). A boat with no
crew meets a party of the arc's own (REPEL_PARTY). Thrown back - the small raid's "Leave Ship", or the quest ending
won (`raidQuestWon`: the tasks `winner`, `endquestproper`, `endquestproper2`, `endquestproper5`) - and their ship,
her boarders spent, lies struck alongside: board her in turn.

**Warm Ashes' voyage ambush**, the mod's own raid on the ship you own at sea: when its raiders are beaten its "Leave
Ship" WAITS (`leaveShipGate`: 'wait') while the raiders' vessel's hold is laid open in the plunder window, and sails on
when the window shuts - the voyage never waits on a closed window. The switch "Raiders' plunder" turns it off.

**One raid at a time** (THE MERGE with OWS3): beside the mod's own fast travel, two starters make Warm Ashes' raid -
the boarders above on a crewed deck, and main's Overworld raiders alongside (`warmAshesShips.js raidAtSea`) - and
neither saw the other's, so one could start a raid over the other's (the mod's ship boarded under a fight on a Come
Sail Away deck). Warm Ashes' module is the one answer now: `raidUnderWay()` - an ambush armed or boarding, a lent ship
out, or a raid quest running whoever started it (the host's `raidRunning`, off the quest machine's live table:
WA_RAID_QUESTS, neither complete nor tombstoned). `raidAtSea` says 'busy' while one runs, and the sea fight's
`startRaid` starts none while one is under way - the boarders come over as the arc's own party instead.

**THE GATE** (DECLARED, the Warm Ashes page's own departure): the mod's `LeaveShip.Update` asks the host's
`leaveShipGate(quest)` first - 'naval', a raid the sea fight started (on the player's own boat, where the IL would lend
a ship and set the player on it): complete, nothing sailed; 'wait': not yet; 'proceed': the IL's own body. A raid
the sea fight started is remembered by its quest's UID in the save, so a load mid-raid is still the sea fight's.

**The prize** (`navalPlunder.js`): her HOLD is one LOT for each tier of her cargo, each a draw of DFU's treasure
tables under a key that fits her trade (HOLD_KEYS: a pirate's plunder gold, jewels and arms; a merchantman's cloth,
spices and books; a navy's armoury), rolled at the player's level and given its rarity at the lot's tier (HOLD_RARITY_TIER
- a merchantman's a mine's, a pirate's a stronghold's, a navy's a giant's hold's; a flagship's strongbox
STRONGBOX_RARITY_TIER, a barbarian chief's). Drawn once from her seed: whoever opens her again finds what is left.
TAKE ALL goes into the captor boat's own hold (Come Sail Away's cargo, whose weight slows her as the mod weighs it),
or into the pack as far as it carries; OPEN HER HOLD lays it in the pack's own loot window.

**The captor's one choice** (Black Flag's, in Daggerfall's words): **Timber and cordage** (REPAIR_SHARE of the hull
and canvas made good), **Powder and shot** (every battery loaded, the fire barrels to BARREL.stock) or **Press her
crew** (PRESS_SHARE of the losses made good). Each tile says what it would make good NOW and stands greyed, with why,
when it would make nothing good. **Her fate**: SCUTTLE her (she burns to the waterline) or CAST HER ADRIFT.

**Flotsam**: a ship SUNK rather than taken gives up FLOTSAM_OF her lots as casks afloat; a boat sailing through one
hauls it into its hold.

## Warm Ashes' raiders as ships (NAV-R)

Mac, of main's Overworld raiders (OWS3, `bible/06-Systems/Travel-View.md`): "Definitely want them to appear as ships".
OWS3 sails one raider a cell a life on the Overworld (`systems/seaRaiders.js`: seeded, so every player sees the same
sail at the same minute), and drew none in play - alongside, the mod's raid carried the player onto a borrowed ship.
With the sea fight on, a raider IS a pirate of the sea (`systems/naval/navalRaiders.js`, `scenes/navalHost.js`
`raiders`):

- **Stood near the player at sea.** Each TV_RAID_LIST_MS the Overworld's frame hands the naval host the raiders about
  the traveller - where each sails now and where its seeded course is RAIDER_LEAD_S on (`raiderAt`), in the scene -
  and the lookout's reach (`raiderSight`: a day's 1,000 m, a night's 500). A raider within RAIDER_STAND_M stands as a
  ship, the nearest RAIDER_SHIPS_MAX at most; a spent one never.
- **Her seed's own ship.** Her class is a pirate the player's level has met, drawn off the raider's seed by the
  classes' weights (`raiderClassOf`) - a sloop, a brigantine or a corsair galley, never the flagship (the small raid's
  crew); her name and her captain are her seed's (`shipNames`).
- **Her course, then her fight.** She steers for her course's lead (`ship.course`, navalAI.js cruiseCourse), so the
  sail on the map is the sail met on the water, and her lookout reaches as far as the raiders' does (`ship.sight` in
  place of ENGAGE_RANGE). Sighting a boat she is a captain like any pirate's: the broadsides, the grapple of a boat
  crippled or lying still, and Warm Ashes' own raid on the boarded deck (`WAQ_SHIP_SMALLRAID`, one raid at a time).
- **Spent for its life** (OWS3's own law): sunk, struck, taken or boarded, or chased and given the slip - said once to
  the world host (`raiderSpent`, `tvRaid.spent`). Given the slip she sheers off RAIDER_SHEER_M away and looks for no
  one. She leaves only out of sight - past RAIDER_DROP_M and fighting no one - whether spent, struck or her life over:
  a ship on the water never vanishes in view. The director counts her in the density and never despawns her.
- **The map finds her where she sails** (`raiderShipOf`): the Overworld's mark rides the ship, and says she chases
  when her captain has the player for a target.
- **One copy.** A raider is stood by the client she is near - the chased traveller's own, as OWS3's chase was - and
  said in that client's word like any ship; a peer's copy of the same seed with the lower id keeps her (TV7b's
  `chaseYields`), and mine goes.
- With no sea fight (the switch off), OWS3 stands as it was: the chase on the Overworld and the mod's raid alongside.

**THE MERGE with main's OW6 (2026-09-29).** Main shared the Overworld's raider chase on the cell's foes frames (OW6,
`bible/06-Systems/Travel-View.md`: a chase said where it sails, a spent raider said and kept by the cell's ledger, never
a sail a peer's chase holds, the lower id keeping one two players chase) and made a fast journey slow as enemies close
(`systems/travelThreat.js`) - both on the Overworld's own chase, which a sea fight does not run. So the ships join them:

- **Spent through the Overworld's own spend.** A raider ship spent here goes through `seaRaidSpend` (`raiderSpent`):
  spent for its life, said on my word to the cell's others and owed to the cell's ledger (OW6L) - a late joiner never
  sees a sunk raider's sail again.
- **Held, and said so.** The ships my sea stands and has not spent are said on my raider word as held, where each
  sails (`naval.raiderHeld`, world.js `seaRaidHeld`), so a peer's client - with the sea fight or without it - holds off
  a raider I hold as it holds off one a peer chases: never a chase of its own on her, and her mark where she sails.
- **Never a sail a peer holds.** The raiders a peer's word holds reach the plan with the peer's id (`held`): never
  stood here, and one stood here that a lower id holds too - by a copy or by a word - goes, as to a peer's copy
  (`raiderPlan`).
- **A journey slows for every hostile ship.** NAV-H made a hostile ship within HOSTILE_NEAR_M an enemy nearby that
  stops a journey; OW6's governor slows a journey before an enemy's reach so the stop never comes unwarned - and read
  no ship. The naval host now hands it its hostile ships afloat (`threats`, raiders stood as ships among them), each
  where she sails with the ring the journey stops at, or her lookout past it (`lookoutOf`, the captain's own law) while
  she has not sighted me, closing at her pace once she comes for me - on either skin, as the stop is. A raider stood as
  a ship is counted as the ship, never her seeded sail beside it.

## The law (NAV-D)

`navalLaw.js`: striking a lawful ship (a merchantman or a navy) in a crown's waters is PIRACY - `Crimes.Piracy`
through DFU's own `LowerRepForCrime` in that crown's region (the court's table's legal loss, half of it off the
region's People), once per act per ship; no watch stands at sea, so no crime is COMMITTED for one to arrest. NOTORIETY
in the crown's waters rises with each act (NOTORIETY: fire, sink, board) and decays a day at a time
(decayPerDay); the plate shows it as four anchors. Past NAVY_HUNTS a navy engages on sight; past HUNTER_AT the
director sends hunters. Sinking or taking a PIRATE is lawful: PIRATE_REWARD - legal repute with the crown, and the
Knightly Order's and the temples' regard (KNIGHTLY_FACTION, TEMPLE_FACTION), a flagship's the most.

## An enemy nearby (NAV-H)

A hostile ship in reach (`navalHost.js hostileNear`: afloat, within HOSTILE_NEAR_M, and hostile to the player by
`navalAI.js hostile`) is an ENEMY NEARBY wherever the game asks it outdoors, as DUEL1's opponent is: Come Sail Away's
time scale will not run past one, the travel map and a party's trip refuse ("You cannot travel with enemies
nearby."), a Travel Options journey stops for her - so main's Overworld crossing (OWS2) is brought up short by a pirate
bearing down, as a road journey is by a bandit - and nobody rests under her guns (`world.js navalHostileNear`, one
helper at the five doors). A merchantman, a navy that is not hunting the player, a struck or sinking ship is no enemy.

## Online (NAV-G)

- **One player stands the sea**: the lowest id within NAVAL_SHARE_RADIUS (DEEP-SHARE's greedy election,
  `campEncounters.js amGroupRollOwner`, with SHARE_HYSTERESIS) runs the director and the captains for everyone near;
  the others see puppets eased toward the owner's word (PUPPET_EASE, PUPPET_SNAP_M).
- **The word** (`navalWire.js`): the ships an owner stands (NAVAL_WIRE_SHIPS, sixteen fields each), its volleys
  (NAVAL_WIRE_VOLLEYS: the shooter, the hull, the side, the pose, the elevation, the seed and the skill - everything a
  peer needs to fly the same balls) and its barrels, kept NAVAL_VOLLEY_KEEP_MS; it rides the owner's foes frame (`nv`,
  beside Come Sail Away's `sa`) on every full frame and whenever it changed. `validNavalRecord` takes it whole or not
  at all, every number bounded (the pose bounds are `net/wire.js`'s own). NO RELAY CHANGE: the relay passes the foes
  frame through and routes a cell's hit by its `to`.
- **The victim resolves**: a ball that strikes MY boat is mine to take, from any ship's volley flown here; a blow on a
  ship another player stands goes to them as a hit frame (`navalHitData`: `to`, the ship's number, the damage,
  bounded by NAVAL_HIT_MAX), and they land it. **No fight between players at sea**: a peer's own volley never hurts my
  boat.
- **A boarding claims the ship** (BOARD_CODES on the hit frame: boarding, taken, scuttled, adrift), so her owner stops
  sailing her.
- **The striker answers for what they sank**: the stander lands the hurt, so the sinking happens in their world - it
  reaches mine in their next word, and a ship that goes down within SINK_CREDIT_S of my last blow on her is charged to
  me too (`lawOf('sink')`: a lawful ship's notoriety, a pirate's reward). Two players who both fired on her both
  answer for her.
- **A ship going down goes down on every screen** (AUDIT NAV1): her sinking runs on each peer's own clock between her
  stander's words (`sinkOn`; a word that says she still sinks never starts her over), and one their word lets go of
  while she sinks - her stander drops her the moment she is under, a word or two before a peer's clock has her there -
  finishes going down before she is gone (`letGo`). A room left takes every peer's ship at once.
- **Flotsam is the stander's**: a sunk ship's casks are dropped in the stander's world and are not on the wire, so only
  the stander's boats haul them in.
- **The pirates fight every player's boat** - a peer at their helm is a contact (`comeSailAwayPeers.js helmBoats`),
  led by the way their own word says: CSA-K's `m` on the boats' word, the velocity the boat at the helm says on the
  wire, carried through the frame as the lead carries it (the frame is affine, so a way is the difference of two
  converted points). A word that says no way - a boat brought up short, a moored fleet, an older build's - has none,
  and a snap (a summons, a fast travel) moves her place and never her speed, which is never measured off her places.
  (Before the merge with CSA-K the port measured the way off the eased places and threw a snap's step away; the
  owner's own word is the truth that measure stood in for.) But a pirate GRAPPLES only the
  boat of the player who stands the sea: a boarding is a fight on one client's deck, and the others' boats meet the
  guns alone.
- **The switch is forced ON online** (the Features row): the ships at sea are the room's world, and a room where one
  player sees the pirate boarding another and the other does not is two worlds. The traffic, the boarders and a
  voyage raid's plunder stay each player's own.

## The UI (NAV-F) - Enhanced Plus

- **The helm's readout** (`ui/navalHud.js`) is a READOUT, not a window (the gate bar's law): built once, updated in
  place, hidden with the HUD and under every window. The SHIP PLATE (bottom right): the hull, sails and crew as the
  vitals' banded bars with brass clasps (the hull in health's red, the canvas in bone, the crew in fatigue's green; a
  hull under a quarter pulses), chips for fire, brace and a crippled ship, the crown's waters and four notoriety
  anchors, the BATTERY ROSE (bow over stern, port and starboard either side - each its guns, filling as it reloads
  and FULL brass when loaded, flashing as it comes ready - AUDIT NAV1 - gold when the look lays it, brass-edged when it
  can fire) and the hint (the key that matters most first - a ship in reach
  to board or plunder, then the guns). The AIM under the crosshair (AUDIT NAV1: dimmed, with why, while the battery
  cannot fire; one stack with THE TALLY under it, below). The TARGET CARD under the compass: her name, class and captain, the distance, her hull and sails,
  whether she is hostile (its red over her trade's colour), her state and the key that boards her - while a broadside is
  laid, the ship its guns strike; her hull bar reads a hit as the foe bar does (AUDIT NAV1: `ui/barLoss.js` - the ghost
  where it was, a piece breaking off, the card flashing). On
  foot, the card alone - while a struck ship or a prize is in reach. AUDIT NAV1: THE SEA'S SHIPS ON THE COMPASS, both skins
  (a bow's triangle in what she is to me); THE WARNING over the crosshair -
  BROADSIDE and the brace's key, pulsing in the kit's blood edge - while a run-out bears on you and until its balls are
  down; THE TALLY under the aim for TALLY_S once your volley's last ball is down.
- **Where the card stands** (THE MERGE with CSA-L): by the house law for what stands under the compass (the journey
  bar's PLUS8, the helm panel's CSA-L) - the compass's foot times the HUD scale and a gap (NAVAL_CARD_TOP), a step
  lower while the foe's bar is up under the compass and further under its blade. Come Sail Away's HELM PANEL stands
  there too on Enhanced Plus, and its bar is as tall as its buttons wrap, so while it stands the card is placed
  NAVAL_CARD_GAP under its measured foot (`drawNavalHud`'s `under`, `enhancedHelm.js enhancedHelmBar` - the panel is
  drawn earlier in the frame, and its foot is read only while a card stands or the layout is due). The layer copies
  the HUD scale onto its root, so every part follows the player's HUD scale together - the card at it capped by its
  column's room (The layout, below).
- **On a finger's screen** (`touch`): no key is named - "Hold and drag to aim", "Lift to fire", "Tap: board her" (the
  host's one activation arm answers a key, a click and a tap alike), "hold Brace" (AUDIT NAV1: the readout's own
  BRACE, shown at an armed helm - the touch table's three slots hold no Crouch - its own press beside the plate's foot,
  NAVAL_BRACE_H by NAVAL_BRACE_W at any scale; the warning names it, "Broadside - Brace") - and the plate stands
  NAVAL_PLATE_TOUCH_BOTTOM up, over the touch corner's presses rather than on them. With A PAD in hand (AUDIT NAV1,
  the presentation) the readout names the pad's own buttons (`hdGlyphName` off the attack's pad binding, else the
  swing's right-click button; Activate's click; the brace's) - "Hold RT to aim - LB: brace" - and at an armed helm the
  Plus pad's prompt bar shows the guns' rows beside the d-pad's (`navalPadPrompts`: the attack laying and firing, the
  brace, Activate for the ship in reach), a row only for a button bound.
- **The layout** (AUDIT NAV1, the presentation - measured in a real browser over the real HUD and helm panel, 1920x1080
  to a 667x375 phone at HUD scale 0.5 to 2, aim up and down): no part covers another or the HUD, and a finger's press
  never shrinks. THE PLATE stands over the vitals where she would reach into their rows, rather than shrinking
  (`platePlace`); her scale the HUD's capped by the room under what stands over her columns (the helm panel's bar, the
  card's band - held for her whether or not a card stands, so she never jumps as the look finds a ship) and clear of
  the centre column's bands (the warning's, the stack's: narrower or lower, whichever costs her less), never under
  PLATE_SCALE_MIN; on the classic skin her foot over the compass box (the host's `classicCompassBox`), and the kit's face
  loaded by the readout itself. A SHORT screen (NAVAL_SHORT_H tall or less in the HUD's own pixels: a phone on its side,
  720 lines at scale 1.5) packs her - her bars side by side, her rose in two rows, port and starboard either side of
  bow over stern. THE CARD in its column at the HUD's scale capped by the room above the warning's band (`cardScale`;
  on foot the crosshair's arms); where that holds it at less than CARD_SCALE_MIN, or the screen is short, it stands
  ASIDE - slim, at the plate's foot beside her and her Brace, no wider than the room right of the quick block. THE AIM
  AND THE TALLY one stack under the crosshair, no wider than the room either side of the centre line, wrapped balanced
  (a range and its seconds kept whole); on a short screen closer, the aim its range and state alone (the rose's lit
  side is the battery), the tally its count alone and waiting while the aim is up, the warning closer too. The places
  are read (`placeParts`) on a change of the screen, the scale, the skin or her rows and every PLATE_LAYOUT_S - never
  every frame. The helm panel's bar is as wide as its buttons (it wrapped at half the screen), and a finger's stands
  centred in the room right of the corner's two presses (its 60 px reserve left the menu's press under it).
- **The plunder window** (`ui/navalPlunderWindow.js`, a lazy chunk behind `ui/navalPlunderDoor.js`, the Sigil
  Broker's door's shape): her colours, name, class and captain; HER HOLD (the first HOLD_ROWS by name, Take all, Open
  her hold); TAKE FROM HER (the three tiles); HER FATE (Scuttle her - the warn role's blood edge - and Cast her adrift);
  a raid's prize has Sail on. The back key and the scrim leave; the pad lands on the press the window is for.
- **The shipwright's window** (AUDIT NAV1, `ui/navalYardWindow.js`, a lazy chunk behind the plunder window's own door -
  one door shape for the sea fight's two windows, `openNavalWindow`): the purse; HER NEEDS - her hull, canvas, hands
  (a crewed ship's) and fire barrels (a ship whose stern rolls them), each what she has, what is wanting at what a
  piece, and its press (all of it, as much as the purse pays, or greyed - "Whole", or the price a piece); MAKE HER
  WHOLE or "Make good what your purse pays"; the last press's word under the title. The same kit and sheet as the
  plunder window (`injectNavalWindowStyle`), the rows its list well's.
- **The kit's roles** (`ui/enhancedFrame.js` FRAME_ROLES, each `body .dfnaval-*`): window `dfnaval-win`, panel
  `dfnaval-plate` and `dfnaval-card`, button `dfnaval-btn`, primary `dfnaval-take`, warn `dfnaval-scuttle`, tile
  `dfnaval-choice`, chip `dfnaval-chip` and `dfnaval-gun`, well `dfnaval-holdlist`, header `dfnaval-winhead`,
  headerRule `dfnaval-sechead`, listRow `dfnaval-item`. On Enhanced Plus the Plus sheet carries the kit; on the
  classic skin the readout and the window lay the kit's rules cut to their own selectors (`injectNavalKit`,
  `scopeRules` - moved into the kit's module so a HUD in the main bundle never imports the Broker's lazy chunk for it).

## The sounds (NAV-E)

Eight clips, OURS, synthesised from noise and sine by `tools/navalSfx.mjs` on the gun lab's kit (`tools/sfxSynth.mjs`,
moved out of `tools/gunSfx.mjs` unchanged - its three clips come out byte for byte as before) and baked to DAGGER.SND's
own 11025 Hz 8-bit mono by `tools/sndify.mjs`: the long gun near, a broadside across the bay (past NEAR_BOOM_M), the
swivel, a ball into oak, a powder barrel, the grapnels - and AUDIT NAV1's seventh, a battery RUNNING OUT (four gun
carriages' trucks rumbling over the deck seams one after another, the tackles creaking, the carriages brought up hard
against the sills: the tell before a broadside, carried to 900 m), and its eighth, a battery of mine READY (the rammer's
head rapped twice on the muzzle, the gun captain's iron tapped on the breech - heard at my own helm). DAGGER.SND's own
play by index: the splashes, the ship's bell as the colours come down, the bubbles of a ship going down, the burning
loop. Every sound carries its own range (`navalSounds.js` NAVAL_SOUND_RANGE: the bus's footstep profile would have made
a broadside at 300 m silence), and none is played past its range's end (AUDIT NAV1: the bus's inverse law never
reaches silence). THE MIX (AUDIT NAV1, "The presentation"): each report its own pitch and level, my own ripple at one
over the root of its guns, the far roll once a volley and crossfaded in equal power with the near reports over
FAR_FADE_M either side of NEAR_BOOM_M; a ball of mine striking her heard at HIT_CONFIRM_REF_M.

## The picture (NAV-B)

One program (`render/navalRender.js`): soft quads premultiplied, the muzzle flame and the aim additive, the fog the
world's (FOG_GLSL); depth tested, never written, drawn after the sea's transparent top. The aim (AUDIT NAV1): the
zone's discs on the sea, a post of light over each (AIM_POST_HALF_W by AIM_POST_HALF_H, turned to the eye - a disc
150 m off was 3.7 px tall), a mark where a ball meets a hull (AIM_STRIKE_HALF), in the tones of `aimTone` - brass laid,
red on her, grey while the battery cannot fire. The textures are procedural
(white, the shape in alpha). The deck fires are Daggerfall's own fire flat (TEXTURE.210 record 1, FLAME_SCALE the
camp's size), carried on her deck as she heels, lists and trims, and out as the sea reaches each (FLAME_AWASH); a
muzzle flash and a burning deck light the scene (MUZZLE_FLASH_COLOR, BURN_COLOR,
BURN_LIGHTS). A sea ship's flag flies her colours (`navalShips.js` NAVAL_FACTIONS' `flag`, the one table; the renderer
draws the flags in runs of one colour - `flagRuns` - the player's boats keeping FlagMaterial's orange) - by her state
(AUDIT NAV1): her faction's while she sails, down when she strikes or founders, the captor's orange once taken; a hull the
mod gave no flag (the Carrack) is given the Small Ship's at her tallest mast's truck (`comeSailAwayPool.js`
graftColours, FLAG_DONOR_HULL). A hull hit's burst is grown for an eye far off (HIT_BURST_M, HIT_BURST_MAX).

**Found on the way, fixed at the root**: Come Sail Away's stand-in for Unity's Default-Particle was a WHITE disc with
its shape in alpha, sampled by the drops' "Alpha Blended Premultiply" material (One, OneMinusSrcAlpha), whose `One`
takes the texel's colour whole - every oar's and rudder's drop drew as a white square. The disc is premultiplied now
(its colour its coverage), and its pin says so.

## THE FOUR HOSTS RULE

Only the streaming world's host (`scenes/world.js`) has a sea: the naval host is made there and its frame runs in the
exterior branch alone. A building's host and a dungeon's (`scenes/worldModes.js`, `scenes/dungeonContext.js`) have no
broadside, and every transition into them, every teleport and every load empties the sea (`navalTransition`); the
`?exterior` bench's host (`scenes/exterior.js`) has no Come Sail Away runtime and so no sea fight.

## The save

`NavalCombat` in DFU's per-mod slot (`systems/modSaveData.js`, the Sigil Broker's precedent), version 1: each boat's
hull, sails, crew, fire and state by its deed's UID (a boat restored later picks its record up when it is first seen),
the crowns' notoriety and the day it was last decayed, and the raids the sea fight started. The sea's ships are never
a save's: they are the waters', rolled again.

## The settings

The Features row **Naval Combat** (group Combat, the port's own): the switch (`naval`, on; FORCED ON online), and in
its drawer Ships at sea (`naval-ships`: few, some, many), Pirates board you (`naval-boarders`), Raiders' plunder
(`naval-raid-prize`) and Broadside camera (`naval-aim-camera`, AUDIT NAV1) - each the player's own online.

## Departures (Port-Ledger section A)

- **The arc itself** is the port's own design, on Come Sail Away's hulls and Warm Ashes' quests.
- **Brace is the Crouch action at the helm**, not an action of its own. Every letter key is spent; Left Ctrl is free
  but a held Ctrl turns the helm's W into the browser's close-tab; ducking behind the rail is what bracing is, and a
  pad's LB crouches already. AUDIT NAV1: at the helm it is the brace alone - the motor's stance and a levitating
  descent are not fed while sailing (world.js `helmBrace`).
- **Come Sail Away's way and its sails take the sea fight's word** (AUDIT NAV1): the mod has no hurt, so the port's
  runtime asks the naval host three things it never asked - `wayScale` (its moveSpeed times the host's share: the canvas
  a shot-up rig still sets, a wreck's oars, nothing while she heaves to), `sailRefused` (RaiseSails refused with that
  line, before the mod's own obstruction) and `accelScale` (its moveAccel times HEAVE_TO_ACCEL while she heaves to).
- **Warm Ashes' LeaveShip asks a gate first** (above).
- **A pirate flagship starts `WAQ_SHIP_ATTACK_PIRATE`**, which the mod registers and never starts.
- **The player's boat is wrecked, never sunk.**
- **At a helm with guns the attack is the broadside's** (How it plays): the press lays them after a readied spell, the
  release fires as its own ungated statement beside the rig's, and the drag and the look under the held attack are
  the aim's - `scenes/world.js`'s five attack doors, `ui/gamepadInput.js` and `ui/touch.js` (`aimHold`); the pins that
  hold the old doors were re-pinned with the law they state intact.
- **Come Sail Away's soft drop premultiplied** (above) - a fix, recorded because the pin moved.

## AUDIT NAV1 (2026-09-29) - the deep audit

Mac, 2026-09-28, of the arc: "Lets do a deep comprehensive audit and ensure this is perfection. I want ship movement
and combat to flow perfectly, just like assisins creed black flag. This is your baby."

**THE AUDIT.** Six lenses, each run against a frozen snapshot of the arc on its own harness - the real naval host over
Come Sail Away's real pool, frames driven as `world.js` drives them - and each measuring rather than reading: THE
CAPTAINS' MOVEMENT (25 five-minute scenarios at 30, 60 and 144 fps and on jittered frames, seeded and on a constant
draw), THE HELM (the player's boat on Come Sail Away's runtime, the aim's sight lines ray-cast on the hull colliders),
THE GUNS (a thousand AI volleys at the player, 6,000 balls against a fine-step ground truth), BOARDING (Warm Ashes'
real quest files through the port's real parser and machine), THE PICTURE (the real HUD and pass in headless
Chromium) and ONLINE (two real hosts over a stand-in relay). About ninety findings; this section records what each fix
answered, slice by slice, and what was measured before and after.

### The captains (the seamanship)

The movement audit's twelve findings, and the guns' and boarding's that were the captains' own:

| finding | before (the audit's measure) | the law now | after (the same harness) |
|---|---|---|---|
| ships stall head to wind - no tack (M2) | a brig 600 m downwind of an anchored player made 0.3 m/s for 300 s and never fired; 108-147 s in irons in duels | no course nearer than CLOSE_HAULED: `tackCourse` beats on a tack, put about when the goal bears TACK_FLIP past the eye; a turn through the eye decided once - TACK with way (TACK_CARRY of her rate through it), WEAR the long way round without; in irons she PAYS OFF (PAYOFF_TURN) | first broadside at 159-184 s; the anchored duel 0 s in irons |
| the coast stall (M3) | 101 s loaded and in reach without firing, bow to the wind | the side that bears SOONEST: turn time against reload, a course past close-hauled presented close-hauled (`sailable`, BEAR_COST_S), a side onto the land never taken, the side held unless the other is SIDE_HOLD_S better | 0 s of hull on land; no side-dithering |
| half the player's pace (M4) | 2.5-4.4 m/s against the player's 6.2-9 | the classes rated at the player's own hulls (a brig 7.6, a cutter 8.0; `windShare` linear in the wind) | the pirate catches a boat beating or rowing, loses one running free |
| tops that snap into turns (M5) | a brig turned in 0.53 of her length, full rate in one frame, the heel stepping 18-20 deg/s | TURN_RADIUS_K lengths, eased over TURN_TAU, critically damped, a hard turn costing TURN_SPEED_LOSS; heel by way and turn and to leeward on a spring (HEEL_OMEGA, HEEL_ZETA) | a brig at 7 m/s turns 5.7 deg/s (the player's pace); heel steps 0.1 |
| hulls through each other (M6) | two merchantmen head-on overlapped 14.6 s; duels 16-52 s | `trafficCourse`: room given inside AVOID_SHIP_S, starboard for one met ahead (AVOID_HEAD_ON - the guns' audit found the rule run out to 112.5 degrees, steering her into a hull on her starboard beam), else away from the side one passes on; the host's `separateHulls` pushes overlapping hulls apart and takes their way into it | head-on 35 m apart; duels under 1.1 s |
| land crossed and scraped (M7) | an 18 m spit crossed; an island hugged with the hull on land 38.8 s | the hull's width sounded every SCAN_STEP past the turning circle; swings held; the course retried; a stem never stood on land (AGROUND_WAY, warped round); a big turn round the open side; waypoints never upwind nor across land, one reached let go | 0 s on land (a dead-end channel's quarter 12 s while it pivots) |
| the sea falls behind the time scale (M8) | 60% of the world's pace at x10, 20% at x30 | FRAME_STEP_S steps, FRAME_STEPS_MAX a frame (`stepSea`) | one long frame = ten short ones |
| the intercept minutes ahead, range overshot (M11) | the brig led a 5 m/s player by 162 s, 810 m | `intercept` solves the meeting (PURSUIT_LEAD_S past it); the enemy's way smoothed (TARGET_VEL_TAU); the bend (RANGE_BEND) only while reloading | first broadside at 92 s against a 3 m/s player (was 206-222) |
| never alongside - a wreck shelled forever (M1, G3) | a sloop 55 m off a wreck for 300 s, 59 broadsides, never grappled | a pirate comes ALONGSIDE on the side she approaches from, her way falling to stop her short, broadsides held; grapples across GRAPPLE_GAP; no captain fires on a wreck, and one that will not board her leaves it (WRECK_SPARE_S) | the sloop grapples at 94 s, the brig at 69 s |
| no giving up (M12) | a chase ended only at 750 m | DISENGAGE hysteresis; a chase that gains nothing in CHASE_GIVE_UP_S (past her fighting range) given up, the chased left SPARE_S | the 7 m/s runner given up at 150 s |
| paths depend on frame rate | a galley duel ended 0.7-1.5 km apart between 60 and 144 fps | the lookout on her own clock (NAV_EVERY_S), the heel stepped at 0.05 s | 5 m at most on the same draw (a spit 43 m) |
| a galley never rams (G9) | - | `checkShipRams`: a galley's stem into a hull at RAM_SPEED is the ram's own law (braced, half) | - |
| prizes fill the sea (B1) | three prizes emptied the sea until the next transition | `boarded` cleared on a win; engaged only while fighting, alongside or boarded; only a ship afloat fills a berth; a prize cast adrift drifts off (ADRIFT_SPEED) | a new ship rolls with two prizes lying by |

### The guns (the gunnery, the tell, the ball)

The gunnery audit's fifteen findings, and what the slice's own harness found on the way (`nav2` in the session's
scratch: the audit's duel re-pointed at the live tree - the player's Small Ship on a scripted course, a captain on
her own, every AI volley re-flown against the player's real hull box; and the time-to-wreck and fire-interval runs):

| finding | before (the audit's measure) | the law now | after (the same harness) |
|---|---|---|---|
| the AI fires at the edge of its window (G1) | the first frame the lead came within 13 degrees: 12.9 degrees off at the median, 0% of balls at 150-200 m (270 volleys) | the lead laid abeam; the FIRE WINDOW (`fireWindow`): her half-extent across the line of fire - her length turned to it, her half beam - times the crew's share (FIRE_EXTENT_K, FIRE_EXTENT_SKILL more at no skill) over the range, never inside the gun's spread nor past BEAR_DEG; laid at AIM_FREEBOARD of her height, chain shot through the middle of her rig; the crew's range error LAY_ERR | 79-81% of balls on a Small Ship inside 150 m, 65% at 150-200 m; the near misses pass her bow or stern, the far ones fall short and long too |
| no warning, and the brace free (G6) | the flash and boom 1.0-3.3 s before impact the only cue; holding Crouch for ever doubled the time to wreck | THE RUN-OUT: a battery runs out RUN_OUT_S before it can fire - begun only when the lead will bear inside RUN_OUT_S (`bearsWithin`) and within RUN_OUT_REACH of its reach, run in unfired past RUN_OUT_WAIT_S or RUN_IN_DEG and not again for RUN_IN_S; the glint at her ports, the trucks' rumble (`naval-runout.wav`), BROADSIDE over the crosshair from the run-out through the balls' flight; a peer's ship's run-out on the wire as bits; the brace stops the reload | every volley warned 1.30-2.90 s ahead (median 1.33 s); bracing on the warning alone: a brig's time to wreck 77-288 s becomes 305-454, a flagship's 201-304 becomes 346-574 |
| pirates feud (G5) | 3,227 hull lost to sisters' balls in 16 fights; six feuds | a friend within FRIEND_CLEAR of the line from her guns out past the lead holds the battery (`lineFoul`); a stray from her own trade, or between two lawful ones, provokes nothing (the host's `strike`) | no feud |
| one volley strikes and sinks a prize (G7) | 99.7% of Small-Ship broadsides that struck a sloop sank her too | the rest of the volley that struck her floors at one hull (STRUCK_GRACE_S, the same striker); striking puts her fires out | a prize stays a prize; a new volley sinks her |
| the guns cannot reach down (G8) | every broadside 0% on a Large Boat inside 25 m, a galley's inside 60 | the carriages to -8 (long), -6 (great, chase), -10 (swivel); a lay that passes over her or falls short is never run out nor fired (`layPasses`) | a sloop alongside to grapple under a Small Ship's broadside at 25 m; the galley holds a volley that would fly over a boat under her side |
| chain shot slows nothing; a plunge does no harm (G4) | 4.5-5.7 of 144 canvas a volley on her waterline; laid at her sails, 0 at 60-100 m; 48% of plunging balls "rig" for 0 hull | the RIG a target of its own (HULL_BUILDS `rig`, measured off the prefabs' spars and riding the hull's matrix): a ball through the canvas tears it and flies on, once a ship; the hull box's roof is her deck, hull | a chain volley through a brig's lateens tears about 64 of her 144 canvas |
| the ripple fires from where she was (G10) | a Carrack's last gun 4.9 m behind its port at 9 m/s | each gun from its port carried by the deck's way over its wait (`volleyLaunches`) | 0 |
| dead constants, and fire does little (G11) | FIRE_CHANCE read by nothing - the host's own 6% on every zone; a barrel's fire a ball's; one fire topped up | FIRE_CHANCE of a hull hit above the waterline only; a barrel's fire BARREL.burnPerSecond for BARREL.burn; fires stack to FIRE_STACK and eat canvas and men | - |
| the waterline by the box's axis (G13) | 65 of 2,121 hits misjudged on a heeled hull | the height of the point it struck | 0 |
| every hull box rebuilt for every ball (G14) | 1.5 ms a frame for 30 balls and 6 hulls | the targets read once a step | one reading a step |
| barrels only bob (G9) | "where it drifts", and it did not | FLOAT_DRIFT of the wind a second | downwind |
| no long reach (G15) | the great guns 157 m, the long 211 | the great guns HEAVY: 68 m/s to 15 degrees | 263 m against 231 from a galley's deck |
| no count of a volley (G15) | - | THE TALLY under the aim: struck, below her waterline, through her rigging | - |
| (the slice's own) presented at a flat PRESENT_SAILS | fell astern of a boat under way and chased her again | her way matched to the enemy's along her course (PRESENT_GAIN on the lead's draw), PRESENT_SAILS the floor | kept abeam |
| (the slice's own) a side the wind will not let bear | close-hauled, the lead 8-26 degrees abaft her beam for a minute, unfired | NO_BEAR_S in the side's weighing; not presented (full sail to go round) | she wears or tacks to show the other side at once |
| (the slice's own) the helm trailed the orbit | a steady orbit held the lead 4 TURN_TAU times its rate (8 degrees) aft of the beam | presented, the helm leads by the heading's own rate (TRACK_TAU, a jump past TRACK_JUMP a new course) | a still boat's second broadside from the same side 23 s after the first, where it came 100 s later from the other |
| (the slice's own) the rule of the road steered into a beam hull | "starboard for one ahead" ran to 112.5 degrees | AVOID_HEAD_ON; else away from the side one passes on | - |
| (the slice's own) slugging hull to hull | loaded, she held a boat 18-28 m off her side | loaded, she still opens the range inside POINT_BLANK of her fighting range | - |

THE BALANCE, measured (the player's Small Ship circling at 3 m/s and never firing, boarders off): a brig wrecks her in
77-288 s unbraced and 305-454 s braced on the warning; a flagship 201-304 and 346-574; a corsair galley 172-220 and
258-452. A boat making way slowly is broadsided every 12 s (median; 21 s at the ninetieth), one circling at 5 m/s
every 16 s (44), and one running free at 7 m/s outruns a brig. The player's side is the audit's own (a same-level brig
takes 4-5 good broadsides): the fight is the player's to win, and the tell is how.

### The helm (the aim)

The helm audit's aiming findings (the player at the guns; 1080p, DFU's default FOV 65 degrees and mouse sensitivity 2.0 -
0.286 degrees a count):

| finding | before (the audit's measure) | the law now | after |
|---|---|---|---|
| the lay too sensitive to aim with (H2) | where the look met the sea: the Large Boat's lays a count apart from the horizon 150, 150, 150, 131, 98, 78, 65 m - none inside a sloop's red window at 120 m (108-116); the Small Ship's first 11 counts "(longest)", then 11-18 m a count | `lookReach`: where the look meets the sea while that point moves out less than AIM_SLOPE (30 m) a degree - the seam where sin^2 = h / slope, one value and one rate either side - then AIM_SLOPE a degree through the horizon and over it; the lay measured from the guns along the fire | the Large Boat 8-9 m a count (141, 132, 124, 115, 107 ...); the Small Ship 8-9 m a count, "(longest)" 7 counts under the horizon |
| a look on a ship laid past her (H2, H7) | the ray through her side met the sea behind her: the lay flew over | THE LOOK ON A SHIP (`lookOnShip`): the nearest of her hull's box and her rig's the look meets within the battery's reach (+LOOK_REACH_PAD) lays the guns for that point, at its height (`look.at`); on her canvas round shot is laid for her hull's centre and chain for the canvas; her way along the fire led over the ball's flight | the crosshair on her side: all six of a Small Ship's arcs end in it |
| red judged from the crosshair, and wrong (H3, H7) | red when a landing fell in her footprint +-2 m: against a beam-on Small Ship at 150 m, red laid 132-152 m, balls striking laid 134-198 m (23 lays that hit never red, one red that missed); five red lays missed a ship sailing away at 3.7 m/s; only the ship under the crosshair asked - a galley laid square on a sloop 14.7 degrees off it: no red, no card | `aimStrikes`: each gun's unscattered arc walked HOT_STEP_S at a time against every ship's hull box (and her rig's for chain) moved on by her way over the ball's time aloft; red when a gun strikes and the battery can fire; each arc drawn to where it stops, a mark where it meets her; the card is the ship the guns strike | red exactly when the unscattered balls strike, wherever the look is |
| no broadside camera (H4) | the Small Ship's rail hid the sea for every lay under 82-84 m from the helm; the head on the crosshair | THE BROADSIDE CAMERA (`aimEye`): while a broadside is laid the eye eases (AIM_CAM_TAU, smoothstepped) to AIM_CAM_OUT past the battery's ports, AIM_CAM_UP over them, AIM_CAM_AFT toward the stern - AIM_CAM_CLEAR short of a ship alongside - and home on the release; the look's ray starts from it (`_dwEyeOffset`); never for the chasers or a crippled ship; the row's Broadside camera part | the eye outboard of her own hull: nothing of her between it and the zone |
| the aim looks ready when it is not (H9) | the zone drawn braced, reloading ("Starboard broadside - 164 m" at 12% loaded) and wrecked; a braced release silent; no time on the reload | the aim's STATE (`aimState`): the line's tail says why - "reloading 6.1 s", "braced", "no barrels", "guns silent" - dimmed, the zone grey, never red; a braced release says so; the reload's message its seconds | - |
| the zone a sliver on screen (H10) | discs 6 cm over the sea: 3.7 px tall at 150 m from the Small Ship's helm, 0.7 px at 100 m from the Large Boat's | a post of light over each splash, turned to the eye (AIM_POST_HALF_H: 3.4 m) | about 19 px at 150 m |
| no way to mend her (H1) | the page promised a shipwright and none stood: `repairCost` written into the readout and read by nothing, the one mend a prize's timber - a Small Ship shot to nought still wrecked at hull 0 after a reload and an hour at sea, its unread quote 5,940 gold; with "Pirates board you" off a wreck stayed one for ever | THE SHIPWRIGHT (`yardHere`, `yardModel`, `navalYard.js`, `navalYardWindow.js` behind the plunder window's own door): a port's waters, still, no hostile near - hull, canvas, hands and barrels by the piece as far as the purse pays, MAKE HER WHOLE in order; HER HANDS' MENDING at sea to FIELD_MEND_CAP after FIELD_QUIET_S, a wreck afloat past FIELD_REFLOAT; the wreck's hint "Crippled - make port for a shipwright" | a wrecked Small Ship floats again after 75 s of quiet at a full crew, and a port makes her whole |
| boarding needs a near-stop, and nothing says so (H11) | refused above BOARD_SPEED with the card at "Colours struck" - no key, no reason; under sail W/S do nothing, and a Small Ship at 8.2 m/s with her sails struck took 28.4 s and 151 m to come under 2.5 m/s | HEAVE TO (`heaveFor`, `startHeaveTo`): a struck ship in reach and the helm too fast - the card "Colours struck - E: heave to", the hint "E: heave to beside her"; the press strikes the sails and takes her way off at HEAVE_TO_ACCEL times her own rate (Come Sail Away's `accelScale`, nothing driving her on) until she is under BOARD_SPEED, HEAVE_TO_S at most, and never for a ship no longer struck | about 3 s from 8 m/s to boarding way |
| no ship bearings on the compass (H14) | the card only within 6 degrees of the crosshair; "There are enemies nearby" and no direction | THE SEA'S SHIPS ON THE COMPASS (`compassShips`, `hud.js drawShipCompassMarks`, `enhancedHud.js` the strip's `hud-ship` marks): within COMPASS_SHIP_RANGE, afloat or struck, by what she is to me - hostile red, a ship bone, struck grey - a triangle turned up (a bow; the party's and a Detect's point down) | - |
| a fire on my own deck invisible (H15) | only `damage.fire`: a chip on the plate | my own boat's fire as a sea ship's (`poseMyFires`): the flames along her deck with her, the embers and smoke, the burning loop, her glow first among the host's lights; out with the fire | - |
| (minor) my volley skill fixed | 0.6 whatever was left of the crew | `crewSkill`: PLAYER_SKILL at a full crew or my own hand, down to PLAYER_SKILL_THIN at none | - |
| the brace is the Crouch toggle (H5) | the press toggled the motor's crouch under the helm's freeze: the first brace left the player crouched (the eye 1.7 m over the feet to 0.8 - the lay 6.1 m shorter at 150 m), the next stood them; a phone had no brace - the touch table's slots hold none by default, and the hint said "Crouch: brace" | at the helm the Crouch action is the brace alone (`helmBrace`: the stance and the descent never fed while sailing); under a finger the plate's own BRACE, held (`navalTouchBrace`), named "hold Brace" in the hint and the warning; under Enhanced Plus the pad layout puts Crouch on R3 (its bumpers are the crossbar's) and the hint names it | - |
| the ram cannot land (H6) | the bow point `beam x 2.4` from the root: a stem 1.0 m (Large Boat), 1.2 (Small Ship), 5.0 (Carrack) and 29.2 m (galley) inside her box before it counted - and Come Sail Away takes the way off a bow at the planking it meets: no ram ever landed; its recoil `RAM_RECOIL * 2`, the page's RAM_RECOIL | the STEM (`bowZ`) within RAM_REACH of her box, read after the hulls are posed; the way she came in with (the most of the last RAM_MEMORY_S) less hers along the course; the way spent on the first; BOW_RECOIL named - a plain stem takes twice RAM_RECOIL, a galley's ram a GALLEY_RAM-th - half braced | a Small Ship at 6 m/s rams for 84 and takes 50; a galley's ram from her own stem for 252 |
| her hurts never in her handling (H8) | WRECKED_OARS read by nothing; a shot-up rig kept its whole way to the last of its canvas; wrecked, the host struck the sails every frame they went up - a line a press on top of the mod's own | Come Sail Away's seams: `wayScale` (moveSpeed times `wayShare` under sail - BARE_POLES and the rest by the canvas left - and WRECKED_OARS on a wreck's oars) and `sailRefused` (RaiseSails refused with one line: a wreck, a rig shot away); a rig lost with the canvas set struck once | - |
| (the slice's own) the aim and the ram read the last frame's hulls | computed before the ships were posed: a ship's way behind | both after the poses | - |

### Boarding (the grapple, the raid, the prize)

The boarding audit's findings (Warm Ashes' real quest files through the port's own parser and machine; the host over
Come Sail Away's real pool) - B1, prizes filling the sea, was the captains' (above); B8, a boarding online, is the
online slice's:

| finding | before (the audit's measure) | the law now | after |
|---|---|---|---|
| Warm Ashes' raid never starts on the open sea (B2) | both raids threw in the sea's region - 31 holds no house for the raid's `_KnightlyGuard_` (message 1013's "on your way to ...") - so the sea fight's boarders fell back to the arc's own party and a crewed Small Ship (24 men) met 4 boarders with no hand of hers beside the player | `waRaidQuest`: a raid parsed while the player's region is the sea's (Warm Ashes' WA_SEA_REGION) reads the crown of these waters' region for the length of its parse alone - the mod parses it on a voyage's arrival, in the destination's land region; both starters through it (the sea fight's boarders, and Warm Ashes' own coroutine for an Overworld raider alongside); every repel the raid does not run brings her hands (`handsOf`) | both raids parse in a crown's region; a refused raid's repel has 4 hands beside the player |
| the flagship's raid invisible, and endless (B5) | its file WAQ_SHIP_ATTACK_PIRATE names itself WAQ_SHIP_PIRATEATTACK: "one raid at a time" never read it running. Slower than its hour after the second wave, its `_retreat_` cleared the waves and stopped its own end - no leader, no end, and the boarding that waited on it held every other off; a win reached the sea fight 25 s after its leader fell | WA_RAID_QUESTS the machine's own names (each file's `Quest:` header); the raid WON the frame a winning task fires (`raidQuestWon`, polled); its retreat - the mod's own unfinished clock - the boarders falling back (`raidQuestRetreated`, `castOff`) | - |
| a raid let go of runs on (B6) | swimming 200 m away, a transition or a respawn: its quest kept running, its waves round the player (8 Rogues grown to 10 in ten game minutes) | `board.endRaid` - QuestMachine's own TombstoneQuest - from every early end: the cast-off, my deck left to them, the sea emptied, her ship gone; its living boarders withdrawn by their quest's UID (a tombstone leaves the foes it made standing), except her stranded ones | - |
| boarders who cast off stay alongside (B7) | swimming away: "Her crew stands down" (a line for boarding her), and a fresh grapple at once; the raid's hour out: "cast off", and she grappled again | `castOff`: her boarders withdrawn, SPARE_S before she will take me again, and she sheers off RAIDER_SHEER_M (`sheerOff`, NAV-R's own); my own deck left: "You leave your deck to them" | no grapple in the next 20 s |
| "her crew surrenders", and fights on (B3) | the prize window opened over three survivors still swinging; rest and travel refused while they stood | `board.standDown` for each living man before her window - the quest system's own restrain (hostile no more, where he stands); one still standing up yields as he arrives | - |
| the fire's finish unannounced (B4) | a burning struck brig went struck, sinking, sunk: no bell, no "going down", no cask, no reward; boarded and burning, she foundered 6 s in, the fight ran 22 s on a sinking deck and ended without a word | one arm for a ball's change and her fires' own (`stateChanged`), charged to who set her afire (`fireBy`) - another's fire never mine; the grapple puts her fires out; a boarded ship going down ends the fight, her men over the side and the player set on their own deck ("Back to your ship!", `founderUnderFight`) | - |
| nothing on screen in the fight (B9) | `hudModel` answered null on foot during a boarding, in a board and a repel fight alike; the captain the win asks for a plain Spellsword among the rest | THE FIGHT'S CARD in the target card's place (`fightOf`, navalHud.js `fightCard`): whose deck, her captain standing or down, her crew down and the count they yield at (SURRENDER_SHARE); the boarders and where from, their tally (a raid's its own); the haul; her captain by name on the target bar (`spawnFoe`'s `name`) | - |
| a wave on a heap (B10) | a raid's spot drawn at random from 12 with no test: of a wave's opening 13, a median of 5 on a spot already taken | the deck DEALT (`dealer`): DECK_SPOTS shuffled once, taken round, for her muster, my hands, the arc's boarders and a raid's waves; the world passes over a spot a body holds or one standing up there (the ring's own `entityOccupancy`, `holdSpotWhile`); every spot held, the wave waits; a raid of mine whose fight is over is stood nowhere - never the open ground's ring round the player | a wave of 13 on 13 spots |
| after the prize, not at the helm (B11) | "Leave her" left the player on her deck with 2.2 m of water between the hulls; back aboard at a deck spot, off the wheel | her fate decided, "Leave her" pressed ('leave', its own way out - the back key and the scrim only shut the window, her deck still to walk) or her going down under the fight: over my rail and at my wheel (`takeHelm`, Come Sail Away's StartSailing) | - |
| too fast to board, and nothing says so (B12) | the card stayed at "Colours struck" | answered by the helm's HEAVE TO (H11): "Colours struck - E: heave to" | - |
| no "lower your wanted level" (B13) | notoriety fell only by its day's decay; a taken lawful ship added more and no choice lowered it | the prize's FOURTH CHOICE (`papers`): a lawful prize's papers burned, a pirate's crew handed to the crown - PAPERS_NOTORIETY (the boarding's own weight) off my notoriety in her crown's waters, greyed where no one hunts me; the one choice as ever; the tiles two by two | - |
| a save mid-fight loads into the sea (B14) | F9 in a boarding: loaded at her deck's height over open water, the prize gone | `saveRefused`: a boarding under way, or feet on a ship of the sea's deck (DECK_REACH_M), and "You cannot save now." - F9, the checkpoints and the pause window's Save | - |
| (minors) | a hostile ship lost the player off the helm (a second pirate 18 m off went to cruise); only a hull collected a cask; a rowboat's powder tile said "Your guns are loaded" | the boat the sea takes me by (`boatInPlay`): at her helm, the one I boarded from, the one under my feet; a swimmer's cask into the pack (SWIMMER, the world's `swimming`); "No guns aboard" | - |

### The presentation (what a sea fight looks and sounds like)

The presentation audit's findings (the real HUD, helm panel, readout and naval pass in headless Chromium; the host over
Come Sail Away's real pool). Of its seventeen, the guns' and the helm's slices had already answered the broadside's
warning (#6: the run-out and BROADSIDE over the crosshair), a fire on the player's own deck (#7's third part), the
sea's ships on the compass (#14's second) and the aim's reasons (#5's readout); the rest, as each is fixed:

| finding | before (the audit's measure) | the law now | after |
|---|---|---|---|
| a ship vanishes with her masts standing (#1) | she settled her deck and 8 m (`(deck + 8) k²`), then was removed: the last frame drawn left a brig's highest spar 19.5 m over the sea, a galley's 24.5, a carrack's 32.2 - only the Large Boat was under | GOING DOWN (`navalDamage.js` SINK_LIST, SINK_PITCH, SINK_CLEAR; `sinkAngles`, `sinkDepth`): she lists to her seed's side and goes down by the head or the stern (her seed's next bit) as the time grows, and her root settles by its square to `sinkUnder` - her highest point at her last pose, SINK_CLEAR under the sea. Her spars measured as they stand (`sparsOf`: every rigid mesh of her rig and hull under her mesh object - a skinned sail's bind pose is not where it hangs, the Carrack's reads 101 m - once a hull and rig, the Large Boat's 6 to 9.4 m apart) | every hull 1.6-2.3 m under at the last frame drawn; half her height still stands at half time |
| a peer never sees a sinking (#1) | a puppet's damage was never stepped and every word's `restore` set her sinking clock to nought: a peer's brig stood whole at the surface for 22 s, then was removed from 40 m | her sinking run on the peer's own clock between the words (`sinkOn`, to SINK_SECONDS at most); `restore` starts it only on a new sinking; one the word lets go of while she sinks finishes going down (`letGo`, `lost`) - an afloat one goes at once, a room left takes them all; a second scuttle never starts her over | a peer's brig settles with the stander's; let go of at 18 s, gone at 21.9 s, 1.9 m under |
| fire and sinking disagree (#7) | a burning ship holed to nought lost her flames and her loop within 0.1 s (`settle` doused her); a scuttled prize "burns to the waterline" kept hers at her deck's height as she settled - at 20 s they burned 5.1 m under the sea, and 62 embers and puffs were born under it (the sea writes no depth: they showed through) | her fires burn on as she goes down (the sinking douses nothing - a scuttling's torch), each flame on her deck as she lies (through her mesh object: heel, list and trim) and out as the sea reaches its place (FLAME_AWASH), no ember nor smoke born under the sea; the loop out with her last flame | holed: out at 7.9, 8.5, 9.1 s; scuttled: 6.9, 7.5, 8.1 s; nothing under the sea |
| her colours as she goes down (#8, its sinking part) | her faction's flag flew on from a masthead under the sea | the flag's emitter stopped as she founders | - |
| a hit barely registers (#3) | her hull struck at 150 m came to the helm at -19 to -20 dB (the hit's reference 16 m), 2.4 s after the ripple, under its roll; splinters 0.18-0.4 m (two pixels), the flash eight for 0.08 s; her card's bar slid for 160 ms | a ball of mine striking her heard at HIT_CONFIRM_REF_M; the burst grown for a far eye (HIT_BURST_M to HIT_BURST_MAX: the splinters, flash and puff by it, thrown faster, a few more); her card's hull bar reads it as the foe bar does - the ghost where it was, a piece breaking off over the span, the card's frame flashing CARD_HIT_S (`ui/barLoss.js`, the vitals' law in a home of its own) | at 150 m -8 dB; a splinter up to 1.2 m |
| the reload silent and backwards (#5) | nothing played as a side came ready (9.2 s: only a class changed); the fill read 97% at 97% and dropped to nought, loaded; its wash 1.4-1.6:1 on its chip | the gun captain's word as a battery of mine comes ready (NAVAL_SFX.ready, the eighth clip), its chip's flash for READY_FLASH_S, never for a side loaded when I take the helm; a loaded side FULL brass; the wash with a lit level line - the aim's reasons and the braced release are the helm's | the wash 2.2-3.0:1 on every theme, its line more; the text on it over 4:1 |
| a ship's colours (#8) | struck, taken and sinking flew her faction's flag; the Carrack's prefab had no FlagObject - the pirate flagship and the merchant carrack flew no colours; a hostile navy or merchantman's card kept its trade's colour (`.hostile` lost by source order) | her colours by her state - hers afloat, down struck or going down, the captor's orange taken; the Small Ship's FlagObject grafted at a flagless sea hull's tallest truck (`graftColours`), a player's Carrack the mod's own; the hostile red last | the Carrack's black at 47.5 m |
| the mix clips, and far guns get louder (#9) | my ripple of six summed to +3.4 dBFS at the default volume (11% of samples clipped at full); every gun one clip at pitch 1; the far roll 6.5 dB over the near at the switch, and played once a GUN; the inverse law never silent (0.006 at 5 km) | THE MIX: my own ripple at one over the root of its guns, each report GUN_PITCH_JITTER and GUN_GAIN_JITTER_DB its own; the far roll once a volley at FAR_MATCH times the root of her guns (the clips' own RMS through their references), crossfaded in equal power over FAR_FADE_M either side of NEAR_BOOM_M; nothing past its range | my ripple -4.4 dBFS at the default volume; at full 0.27% of samples (a single report is 0.95 - the bus has no limiter: a bus-wide change, not the arc's to make) |
| the broadside's feel (#16) | the release shook the camera once, 1.2 (a Thunderlock pistol 3); a powder barrel on my deck 1.6 to a holed ball's 2.5; each launch 2.8 m aft of its port at 6 m/s | each gun of mine kicks as it goes (GUN_KICK, along the ripple); a barrel's blast BLAST_SHAKE; the launch carry the guns' slice's (`volleyLaunches` carry) | six kicks of 1.1 a Small Ship's broadside |
| a phone's helm stack covers the aim (#2) | at 844x390 the helm panel's bar 188 px tall; the card over the band under the crosshair (204-299, the aim printed inside it); the plate 272x263, 67% of the screen's height (73% at 740x360), over the helm panel's buttons | THE LAYOUT (The UI, above): a SHORT screen packs the plate and caps her by the room under the bar; the card ASIDE at her foot; the aim and the tally one stack under the crosshair, the aim its range and state alone; the Brace a finger's own press at any scale (under her rose it shrank to 23 px); the bar as wide as its buttons (it wrapped at half the screen) and a finger's clear of the corner's presses (the menu's stood under it once it was) | at 844x390 the bar 138 px, the plate 214x156 at 0.79 under it, the card at 259-314, the aim at 215; nothing over anything on 16 screens, aim up and down - but the warning, for its seconds, over the bar's foot on the two shortest phones (14 px at 740x360, 6 at 667x375) |
| the classic skin's plate (#10) | she stood on the classic compass (91% of its width and 57% of its height at 1280x720; 79% by 74% at 1920x1080), the readout in monospace (the face was the enhanced HUD's to load) | her foot over the compass box (`classicCompassBox`: COMPBOX at the classic scale); the readout loads the kit's face itself | clear of the compass; the pixel face on every skin |
| the HUD scale (#11) | the plate over the vitals at 1.5 on a 1280 or 1366 screen and at 2 on 1920; the card, the aim and the helm panel's bar one size at every scale; three of the HUD's notice lines over her at 1.5 on 1280x720 | the plate over the vitals where she would meet them, never shrunk for them; her scale capped by her room and clear of the centre column's bands; the card, the aim, the tally and the warning at the HUD's scale, the card capped by its column's room above the warning (`cardScale`), aside under CARD_SCALE_MIN; the stack no wider than its room | nothing over anything from 0.5 to 2 at 1280x720, 1366x768 and 1920x1080 (the card at 1.21 in 1366x768's column; at 2 on 1280x720 the plate 1.57, the aim in two lines); the notices (ENH-NOTICE3's panel, over every HUD part by its own z) still meet her top at 1.5 on 720 lines for their seconds |
| contrast off Slate, two wording slips (#12) | the plate's hint (which carries "E: board her") 1.9:1 on Stone, 3.7 on Iron, 4.1 on Forest; on Stone the waters 2.9, the labels and the card's sub-line 3.8, the plunder window's sub-line, lede and counts 3.3-3.5; a refused choice's reason 2.3 (3.2 on Slate); "The Crimson Gannet are coming alongside"; the card's "Taken - E: her hold" to the plate's "open X's hold" | the hint in the waters' tone; the sea fight's dim words joined to MERGE-PLUS D3's Stone rule; a refused tile greyed by its title and ground, its reason whole; "X is coming alongside"; the hold one wording, "open her hold" | the hint 5.1 on Stone, 5.5 on Iron, 6.2 on Forest; the plunder window's 5.8 on Stone, a refused reason 6.5 (10.8 on Slate) |
| a pad player told keyboard keys (#13) | "Hold RIGHT CLICK to aim - C: brace", "E: board The Red Wake"; the helm's pad prompts the d-pad's alone | with a pad in hand the readout names its buttons (`hdGlyphName`); at an armed helm the prompt bar shows the guns' rows (`navalPadPrompts`) | "Hold RT to aim - LB: brace", "A: board The Red Wake"; the bar's RT, LB and A |

## The tests

One suite a slice - `test/nav_a_guns.test.js` (the flight, the aim, the volley, the reload, a ball's hurt, a ship's
life, the shot field), `nav_b_picture` (the effects, the pass on a recording GL, the deck fires, the colours),
`nav_c_ships` (the classes, names and crowns, the captains, the traffic), `nav_d_boarding` (the muster, the berth, the
reckoning, the raids' win, the hold, the choice, the law, notoriety, THE GATE, one raid at a time), `nav_e_sounds` (the seven files, the
bake regenerated byte for byte, the ranges, the one registration), `nav_f_ui` (the readout's words and node, the kit's
cut, the plunder window driven on the suite's DOM, its door, the card's place, a finger's screen), `nav_g_online` (the word, its door, the blow frame, the
helm boats, the doors) and `nav_h_host` (the host through real frames over Come Sail Away's real pool - the guns, the
traffic, the law, boarding, boarders and Warm Ashes' raids, the voyage's wait, the save, the stander and the striker -
and the world host's wiring, a hostile ship an enemy nearby at its five doors) - and `nav_r_raiders` (Warm Ashes'
raiders as ships: the class law, the plan, a raider stood, sighting and spent, the director and a peer's copy, the world
host's wiring, and the merge with OW6 - a peer's hold, the held ships said, the spend said and owed, the sea's
hostile ships as a journey's threats and the map, run through the world host's own lifted code; the governor's own
run in `ow6_slowdown`) - and the audit's own suites: `navaudit_captains` (the way, the turn and the heel, the wind's eye, other
hulls and the land, the intercept, the side that bears soonest, giving up, alongside to board, the wreck, the cruise,
a prize adrift, the berths, the hulls kept apart, a galley's ram, the sea's time, a boarder chasing) and
`navaudit_guns` (the run-out and its promise, the fire's window, never over her nor short, no friend across the line,
the lay, station alongside, the helm's lead, the prize kept a prize, no feud from a stray, fire, the rig, the shots'
own, the guns' reach, the warning, the tell heard and seen, the tally) and `navaudit_helm` (the look's reach, a look
on a ship, the red where the balls strike her as she will stand, why the guns will not fire yet, the aim drawn, the
broadside camera, the world's wiring) and `navaudit_boarding` (the raids' names and their retreat, the real parser in
the sea's region and a crown's, the world host's pin and endRaid and stand-down run, a crewed boat's hands, the win
polled, the cast-off, the surrender, the fire's finish, the founder, no save mid-fight, the helm on return, the dealt
deck, the fight's card, the prize's papers, the minors) and `navaudit_presentation` (going down - every hull under,
her list and trim, her spars as they stand, a peer's sinking on their own clock and let go of, her fires to the
waterline, her colours; the mix, a hit that registers, the ready, her bar's loss, her colours by her state and the
Carrack's; the plate's place, the card's column, the draw by the screen, the places written, the Brace's press, the
centre column's sheet, the pad at the guns, the skins and the words), on the shared sea of `test/navalSea.mjs`.
Mutants: `tools/mutants/nav_a.json` to `nav_h.json`, `nav_r.json`, `navaudit_captains.json`, `navaudit_guns.json`,
`navaudit_helm.json`, `navaudit_boarding.json` and `navaudit_presentation.json`, 608 records, every one dead (149 at the arc's close; 23 more at the merge with main - the
card's place and the finger's screen, one raid at a time, a hostile ship an enemy nearby, a peer's way read off its
word; 21 with NAV-R; 54 with the audit's captains, and eight of the arc's own re-aimed by content at the laws the
rebuilt captains keep; 60 with the audit's guns, and eight more re-aimed at the laws the guns keep; 131 with the
audit's helm, and seven of other suites' re-aimed by content at the laws the helm keeps; 14 with the merge with
main's OW6, and eight of the arc's own re-aimed by content at the lines the merge rewrote; 56 with the audit's
boarding, and NAV-R's sheer-off and NAV-F's card foot re-aimed at the lines the boarding rewrote; 27 with the
audit's presentation, going down; 32 with its feedback, and NAV-H's reload record re-aimed at the line the kick
left; 41 with its layout and words, and five of the arc's own - the card under the panel, the panel read with no card,
the plate over the presses, the finger's root, the warning - re-aimed by content at the lines the layout rewrote);
the first run's four survivors each named a test that was not checking its law (two hulls in one sweep, a moored boat
once built, a stale owner masking the sink window, the sea off the player's shore), and each test was mended.

## THE MERGE with main (2026-09-28)

Main had moved on under the arc - Come Sail Away's CSA-K (sailing together) and CSA-L (the helm on screen), the
Overworld's sea (OWS1-OWS3), the raids (RAID1-RAID4), the 3D dungeon map, the gate's work - and the merge carried both
sides whole. What each met of the other, and what was decided:

- **A peer's way** (CSA-K): the boat at the helm says its velocity on the wire now (`sa`'s `m`), so the sea's contacts
  are led by that word instead of a way measured off the eased places (Online, above). The measure, its settling rate
  and the snap it threw away are gone with the need for them.
- **The collider** (CSA-K): the deck of another player's boat I stand aboard joins MY boats and the sea's ships near
  enough to board (`csaSyncColliders`), and nothing else of a peer's stands in it (PR-WAGON1).
- **The foes frame**: my boats' word, my place aboard another's (`ab`), the Overworld's bands' (`bd`, TV7b - taken in
  by the second merge of main the same day, with TV6-TV8), the sea's word (`nv`) and the raids' (`rk`) ride one frame,
  each changed word asking for it.
- **The top of the screen** (CSA-L): the helm panel and the target card both stand under the compass - the card under
  the panel's foot while it stands (The UI, above); and on a phone the plate stands over the touch corner.
- **One raid at a time** (OWS3): above, in Boarding.
- **An enemy nearby** (OWS2): a journey across the sea stops for a hostile ship (above).
- OPEN: main's Overworld raiders are Warm Ashes' own raid seen coming - on the Overworld they are marks, and in play
  their hull is not drawn (a ship's length off, `seaRaiders.js` RAIDER_CONTACT_PLAY_M) before the mod's raid boards the
  player's ship. The sea's pirates are drawn ships on Come Sail Away's hulls. FOLD: an Overworld raider that closes
  in play could be stood as one of the sea's pirates (seeded from its cell, so every player still meets the same
  sail), her boarding the raid - one pirate of the Bay, seen from the map and met at the rail.

## Not seen

Not seen on a GPU in this session: the pass, the flags' colours and the deck fires are verified by their pins and by
the Node harness, not by eye.
