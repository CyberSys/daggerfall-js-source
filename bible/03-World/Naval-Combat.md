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
| NAV-E | THE SOUNDS: six synthesised clips baked to DAGGER.SND's own format (a seventh, the run-out, with AUDIT NAV1), and the distances every naval sound carries | `tools/navalSfx.mjs`, `tools/sfxSynth.mjs`, `systems/naval/navalSounds.js`, `public/sfx/naval-*.wav` |
| NAV-F | THE UI, ENHANCED PLUS: the helm's readout (ship plate, battery rose, aim, target card) and the plunder window, in the stone-and-brass kit on either skin | `ui/navalHud.js`, `ui/navalPlunderDoor.js`, `ui/navalPlunderWindow.js`, `ui/enhancedFrame.js` (FRAME_ROLES, scopeRules) |
| NAV-G | ONLINE: one player stands the sea for everyone near; the ships, volleys and barrels ride the foes frame; a blow on another's ship goes to its owner; a boarding claims the ship | `systems/naval/navalWire.js`, `scenes/exteriorFoes.js` (setOnNaval), `scenes/comeSailAwayPeers.js` (helmBoats) |
| NAV-H | THE HOST: the sea fight stood in the streaming world - the frame, the input, the activation, the draw, the lights, the origin, the colliders, the save, the transitions, the quests, the settings | `scenes/navalHost.js`, `scenes/world.js` (the NAV-H block) |
| AUDIT NAV1 | THE DEEP AUDIT (2026-09-29): six lenses measured the arc against Black Flag on its own harnesses; the captains' seamanship rebuilt (below), the hulls kept apart, a galley's ram, the sea on the world's clock; THE GUNS - the captains' gunnery and the run-out that tells a broadside is coming, the rig a target, fire, the prize kept a prize, the readout's warning and tally | `systems/naval/navalAI.js`, `navalShips.js` (the hulls' extents and rigs, the classes' pace, the carriages), `navalDirector.js` (the berths), `navalDamage.js`, `navalShots.js`, `navalGunnery.js`, `navalWire.js` (the run-out's bits, a barrel's fire), `navalSounds.js` and `tools/navalSfx.mjs` (the run-out), `navalEffects.js` (the glint, the shreds), `scenes/navalHost.js` (`stepSea`, `separateHulls`, `checkShipRams`, `strike`, the tell and the tally), `ui/navalHud.js` (the warning, the tally), `scenes/comeSailAwayPeers.js` (helmBoats' hull and heading) |
| NAV-R | WARM ASHES' RAIDERS AS SHIPS (merged OWS3): a raider near the player at sea stood as a pirate of her seed's own class and name, sailing her seeded course until her lookout sights a boat, then fighting and boarding as any pirate; spent for her life; one copy between two players | `systems/naval/navalRaiders.js`, `scenes/navalHost.js` (`raiders`, `raiderShipOf`), `systems/naval/navalAI.js` (`sight`, `course`), `scenes/world.js` (`raidShips`, the marks) |

## How it plays

- **At the helm of an armed boat, look to a side.** The look's bearing off the bow picks the battery
  (`navalGunnery.js` sideForBearing: within BOW_ARC of the bow the bow chasers, within STERN_ARC of the stern the stern,
  else port or starboard). The rose on the ship plate lights that battery gold.
- **Hold Attack** (the SwingWeapon action - right mouse by default, RT on a pad, the swipe on a phone): the guns are
  LAID where the look meets the sea - every muzzle's arc drawn to its splash, the splash zone ringed, both turning red
  when the zone lies on a ship, and the range read under the crosshair ("Starboard broadside - 138 m", "(longest)" at
  the battery's reach, "on target"). **Let go and they fire**, a ripple down the side (RIPPLE_S apart), the smoke
  drifting down the wind. Black Flag's "viewing from the side" is exactly this: the look IS the aim, in first person or
  over Eye of the Beholder's shoulder - so while the attack is held at the guns the mouse's drag, the pad's right stick
  and the finger's drag all TURN THE VIEW (the swing's look law, which drops the look under a held swing, stands down
  there, and the pad and the finger hold the attack plainly - `aimHold`). A readied spell still eats the press first.
  A window opened over the aim puts it down unfired; the release itself is never gated.
- **Crouch braces** (C, LB on a pad): the crew ducks behind the rail - half the hull and sail damage while held, no gun
  fires and no gun is loaded (AUDIT NAV1: the reload waits). It is the Crouch action because that is what bracing is;
  see the departures.
- **Watch for the run-out** (AUDIT NAV1): an enemy's battery is RUN OUT before it fires - its ports glint along her side,
  the gun trucks rumble across the water, and when it bears on you BROADSIDE and the brace's key stand over the
  crosshair, from the run-out until her balls are down. That is the moment to brace, or to turn out of her arc.
- **The tally**: once your volley's last ball is down, the line under the aim counts it - how many struck, how many
  below her waterline, how many through her rigging.
- **Interact boards** (E): a ship that has struck her colours within BOARD_RANGE of the helm, the way under
  BOARD_SPEED - the grapples fly, she is hauled alongside, and you go over her rail. On foot (swimming up, or from a
  deck alongside) the same press within FOOT_BOARD_M of her side with the look on her. The target card and the plate's
  hint say the key ("Colours struck - E: board her").
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
puts her fires out - and can be boarded, or shot on until she SINKS over SINK_SECONDS, settling and heeling as her
casks float free. The rest of the volley that struck her cannot sink her (STRUCK_GRACE_S): sinking a prize is a new
volley, never the click that took her.

**The player's boat never sinks.** At nought it is WRECKED: no sail will set, the oars at WRECKED_OARS, the guns
silent, until it is repaired - at a port's shipwright (`repairCost`, REPAIR_PRICE) or with a prize's timber. A boat
is a possession bought for up to two hundred thousand gold; losing one to a lucky broadside is a punishment
Daggerfall never deals.

**Rams**: a bow striking a hull at RAM_SPEED or more deals RAM_DAMAGE a metre a second (a galley's ram GALLEY_RAM
times that) and takes RAM_RECOIL of it back.

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
  anchors, the BATTERY ROSE (bow over stern, port and starboard either side - each its guns, filling as it reloads,
  gold when the look lays it, brass-edged when loaded) and the hint (the key that matters most first - a ship in reach
  to board or plunder, then the guns). The AIM under the crosshair. The TARGET CARD under the compass: her name, class
  and captain, the distance, her hull and sails, whether she is hostile, her state and the key that boards her. On
  foot, the card alone - while a struck ship or a prize is in reach. AUDIT NAV1: THE WARNING over the crosshair -
  BROADSIDE and the brace's key, pulsing in the kit's blood edge - while a run-out bears on you and until its balls are
  down; THE TALLY under the aim for TALLY_S once your volley's last ball is down.
- **Where the card stands** (THE MERGE with CSA-L): by the house law for what stands under the compass (the journey
  bar's PLUS8, the helm panel's CSA-L) - the compass's foot times the HUD scale and a gap (NAVAL_CARD_TOP), a step
  lower while the foe's bar is up under the compass and further under its blade. Come Sail Away's HELM PANEL stands
  there too on Enhanced Plus, and its bar is as tall as its buttons wrap, so while it stands the card is placed
  NAVAL_CARD_GAP under its measured foot (`drawNavalHud`'s `under`, `enhancedHelm.js enhancedHelmBar` - the panel is
  drawn earlier in the frame, and its foot is read only while both stand). The layer copies the HUD scale onto its
  root, so the plate's size and the card's place follow the player's HUD scale together.
- **On a finger's screen** (`touch`): no key is named - "Hold and drag to aim", "Lift to fire", "Tap: board her" (the
  host's one activation arm answers a key, a click and a tap alike), "Crouch: brace" (the touch table's own press) -
  and the plate stands NAVAL_PLATE_TOUCH_BOTTOM up, over the touch corner's presses rather than on them. A pad's
  button is no key to print either: the hint names its action (the helm panel's `csaKeyLabel` law).
- **The plunder window** (`ui/navalPlunderWindow.js`, a lazy chunk behind `ui/navalPlunderDoor.js`, the Sigil
  Broker's door's shape): her colours, name, class and captain; HER HOLD (the first HOLD_ROWS by name, Take all, Open
  her hold); TAKE FROM HER (the three tiles); HER FATE (Scuttle her - the warn role's blood edge - and Cast her adrift);
  a raid's prize has Sail on. The back key and the scrim leave; the pad lands on the press the window is for.
- **The kit's roles** (`ui/enhancedFrame.js` FRAME_ROLES, each `body .dfnaval-*`): window `dfnaval-win`, panel
  `dfnaval-plate` and `dfnaval-card`, button `dfnaval-btn`, primary `dfnaval-take`, warn `dfnaval-scuttle`, tile
  `dfnaval-choice`, chip `dfnaval-chip` and `dfnaval-gun`, well `dfnaval-holdlist`, header `dfnaval-winhead`,
  headerRule `dfnaval-sechead`, listRow `dfnaval-item`. On Enhanced Plus the Plus sheet carries the kit; on the
  classic skin the readout and the window lay the kit's rules cut to their own selectors (`injectNavalKit`,
  `scopeRules` - moved into the kit's module so a HUD in the main bundle never imports the Broker's lazy chunk for it).

## The sounds (NAV-E)

Seven clips, OURS, synthesised from noise and sine by `tools/navalSfx.mjs` on the gun lab's kit (`tools/sfxSynth.mjs`,
moved out of `tools/gunSfx.mjs` unchanged - its three clips come out byte for byte as before) and baked to DAGGER.SND's
own 11025 Hz 8-bit mono by `tools/sndify.mjs`: the long gun near, a broadside across the bay (past NEAR_BOOM_M), the
swivel, a ball into oak, a powder barrel, the grapnels - and AUDIT NAV1's seventh, a battery RUNNING OUT (four gun
carriages' trucks rumbling over the deck seams one after another, the tackles creaking, the carriages brought up hard
against the sills: the tell before a broadside, carried to 900 m). DAGGER.SND's own play by index: the splashes, the ship's bell
as the colours come down, the bubbles of a ship going down, the burning loop. Every sound carries its own range
(`navalSounds.js` NAVAL_SOUND_RANGE: the bus's footstep profile would have made a broadside at 300 m silence).

## The picture (NAV-B)

One program (`render/navalRender.js`): soft quads premultiplied, the muzzle flame and the aim additive, the fog the
world's (FOG_GLSL); depth tested, never written, drawn after the sea's transparent top. The textures are procedural
(white, the shape in alpha). The deck fires are Daggerfall's own fire flat (TEXTURE.210 record 1, FLAME_SCALE the
camp's size), carried with the ship; a muzzle flash and a burning deck light the scene (MUZZLE_FLASH_COLOR, BURN_COLOR,
BURN_LIGHTS). A sea ship's flag flies her colours (`navalShips.js` NAVAL_FACTIONS' `flag`, the one table; the renderer
draws the flags in runs of one colour - `flagRuns` - the player's boats keeping FlagMaterial's orange).

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
its drawer Ships at sea (`naval-ships`: few, some, many), Pirates board you (`naval-boarders`) and Raiders' plunder
(`naval-raid-prize`) - each the player's own online.

## Departures (Port-Ledger section A)

- **The arc itself** is the port's own design, on Come Sail Away's hulls and Warm Ashes' quests.
- **Brace is the Crouch action at the helm**, not an action of its own. Every letter key is spent; Left Ctrl is free
  but a held Ctrl turns the helm's W into the browser's close-tab; ducking behind the rail is what bracing is, and a
  pad's LB crouches already.
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
host's wiring) - and the audit's own suites: `navaudit_captains` (the way, the turn and the heel, the wind's eye, other
hulls and the land, the intercept, the side that bears soonest, giving up, alongside to board, the wreck, the cruise,
a prize adrift, the berths, the hulls kept apart, a galley's ram, the sea's time, a boarder chasing) and
`navaudit_guns` (the run-out and its promise, the fire's window, never over her nor short, no friend across the line,
the lay, station alongside, the helm's lead, the prize kept a prize, no feud from a stray, fire, the rig, the shots'
own, the guns' reach, the warning, the tell heard and seen, the tally), on the shared sea of `test/navalSea.mjs`.
Mutants: `tools/mutants/nav_a.json` to `nav_h.json`, `nav_r.json`, `navaudit_captains.json` and
`navaudit_guns.json`, 307 records, every one dead (149 at the arc's close; 23 more at the merge with main - the
card's place and the finger's screen, one raid at a time, a hostile ship an enemy nearby, a peer's way read off its
word; 21 with NAV-R; 54 with the audit's captains, and eight of the arc's own re-aimed by content at the laws the
rebuilt captains keep; 60 with the audit's guns, and eight more re-aimed at the laws the guns keep);
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
