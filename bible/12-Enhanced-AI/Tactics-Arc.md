# Enhanced AI - tactics, cover, the crowd and telegraphed blows (TACT, proposed 2026-10-02)

Mac, 2026-10-02: *"Enhance enemy/guard AI. Proper line of sight with billboard props, enemy tactics like backing off
and knowing when to strike, and overall improvements to our enhanced AI system"*; *"Players can grief others with
guards by bringing them into interiors and blocking doorways. We need to reduce enemy clumping and also have enemies
aware of each other"*; *"Introducing new attack patterns and smaller telegraphed attacks (like our world boss) but not
overdoing it"*. His calls, asked the same day:

| | The question | Mac's call |
|---|---|---|
| Scope | Where does the smarter AI apply? | **Everywhere, Enhanced on** - dungeons, streets, interiors and guards when the Enhanced AI switch is on; classic DFU AI byte for byte when it is off |
| Cover | What do billboard props block? | **Sight and missiles** - trees, crates and decor flats block what a foe sees and stop arrows and spells (real cover, both ways) |
| Griefing | How is it done today? | **Guards blocking doors** - guards clump in a doorway so nobody can get in or out |
| Blows | How many new telegraphed attacks? | **One or two, tier-based** - small wind-up attacks on tougher foes only, used sparingly, always readable and dodgeable |

**Status: TACT3 BUILT 2026-10-02 (Mac: anti-grief first) - see its record at the foot; TACT1, TACT2, TACT4 designed, not built.**

## Where it stands (measured on the code, 2026-10-02)

- **The enhanced AI is a pathfinder, and only in dungeons.** `EnhancedEnemyAI` (`ai/enhancedMotor.js`) overrides one
  question - where a foe walks next - on the navmesh. Senses, decisions and attacks are DFU's (`characters/enemyMotor.js`
  `_classicTick`): walk in to 2.25 m and swing; never strafe, back off, circle or wait. The only retreat is `flee()`,
  whose one caller is a guard frightened by a werewolf. Streets, interiors, guards and exterior foes always run the
  classic motor (`dungeonContext.js` is the switch's only reader).
- **Sight sees through every billboard.** `canSeeTarget` casts one eye-to-eye ray through the collider, and the
  collider holds meshes alone: no flat, tree or decor sprite is in it. Missiles fly the same collider.
- **Foes know each other only as overlapping capsules.** `characters/foeSpacing.js` pushes apart foes of ONE pool;
  the dungeon's, the street guards', the exterior encounters' and the interior watch's are separate pools, so a guard and
  a bandit stand in each other. The navmesh's `syncNavObstacles` and RVO `avoidHeading` are ported and called nowhere
  (the arc's 4b). Nothing keeps a foe out of a doorway.
- **Telegraphs exist for the world boss alone** (`net/gateBrain.js`, `net/gateStrike.js`, `render/gateTelegraph.js`):
  shaped wind-ups resolved by where the feet stand at the landing. Ordinary foes swing on DFU's clock, with no tell.

## The design: four slices, each behind the Enhanced AI switch

### TACT1 - cover (sight and missiles)
- Every billboard that reads as solid - trees, crates, barrels, statues, decor flats over a size floor - gets a
  **cover proxy**: an upright box of its drawn width and height (a tree: its trunk's width to its crown's height),
  kept in a cover index beside the collider, never in it (walking is unchanged).
- `canSeeTarget` and `canHearTarget`'s line test, and every missile (arrows, thrown, spell bolts - the player's and the
  foes'), test the cover index after the collider. A target behind cover is unseen; a missile that meets cover stops
  there. Area spells still burst where they land.
- Grass, flowers, small clutter and see-through sprites (fences drawn as flats, hanging signs) are not cover - a list
  by archive/record, with a size floor.
- Classic lane untouched: with the switch off, nothing reads the index.

### TACT2 - tactics (the brain)
A thin decision layer over the motor, per foe, the motor still doing the walking:
- **Engage ring.** A melee foe holds a ring just outside the target's reach (by both reaches), not in its face.
- **The strike window.** It steps in to strike when the target is open - mid-swing recovery, casting, drinking, turned
  away, or staggered - and backs out after its own blow. A foe never waits forever: a patience clock forces an attack.
- **Backing off.** Hurt past a share of its health, or caught by a combo, a foe backs out of reach and circles before
  coming back; at low health a coward class flees (DFU's flee), a brave one fights on.
- **Circling and flanking.** Foes waiting their turn strafe round the ring; two or more spread to flank.
- **Ranged kiting.** Archers and casters keep their stand-off band, back away from a closing melee target, and seek a
  clear line (cover-aware, TACT1) rather than shoot into a crate.
- **Guards** use the same brain, with the watch's own rule: they arrest on yield, they hold a door's outside, never its
  threshold (TACT3).
- Every number is a constant on one table; the class's DFU stats (speed, skill, level) scale it.

### TACT3 - the crowd and the door (anti-grief)
- **One spacing over all pools.** `foeSpacing` takes every live foe near the player - guards, encounters, the
  dungeon's, the watch - in one pass.
- **Attack tokens.** At most N foes (2 melee, 2 ranged by default) hold a token to attack one target; the rest hold the
  ring, circle and wait (this is most of "aware of each other", and most of the clumping).
- **Slots on the ring.** Each waiting foe takes its own angle on the ring, so they spread rather than stack.
- **Doorways are no place to stand.** A threshold zone at every door (both sides). A foe never idles, waits or holds a
  ring slot in it; one in it with nothing to do steps out to the nearer side within a second. A foe passing through
  passes through. Guards in an interior spread into the room from the door on arrival.
- **No guard wall.** The interior watch spawns past the threshold and spreads; guards that cannot reach their target
  for a while give up the door rather than hold it.
- Applies with the switch on; the cross-pool spacing and the doorway rule are cheap enough to consider for the classic
  lane later (Mac's call).

### TACT4 - telegraphed blows (one or two, tier-based)
- Three small shapes, the world boss's language at foe scale: **the lunge** (a short lane ahead), **the sweep** (a
  front cone), **the slam** (a small disc at the foe's feet or just ahead). Each a short wind-up (0.6-0.9 s) with the
  boss's floor telegraph, scaled down and fainter; resolved by where the feet stand at the landing (`gateStrike`'s law).
- **Who gets them:** foes of a tier (level, or the meaner-monsters tier) and up, one or two shapes by family (a beast's
  lunge, a warrior's sweep, a giant's slam). Weaker foes: DFU's blows alone.
- **Sparingly:** a cooldown per foe (8-15 s), at most one telegraph from any foe near a player at a time, never two in
  a row from one foe, and only from the engage ring (TACT2) - a foe in a corridor never sweeps the wall.
- **Fair:** damage is the foe's own blow scaled, armor and skill as DFU's; dodgeable by moving out; a block halves it.
- Online: the foe's owner (each client for its own foes, the dungeon host for the dungeon's) decides and resolves it;
  the wind-up rides the existing foe stream so peers near it see the same telegraph.

## Order and proof

TACT1 -> TACT3 -> TACT2 -> TACT4: cover first (everything else reads it), the crowd second (the grief is live), the brain
third (it needs both), the blows last (they need the ring). Each slice: pins first, a real-collider harness in a real
dungeon and town block, a mutation list, an audit before merge, patch notes in its PR.

## Mac's calls, the second set (2026-10-02)

| | The question | Mac's call |
|---|---|---|
| Attack tokens | How many foes attack one player at once? | **2 melee + 2 ranged**; the rest hold the ring, circle and wait |
| Fleeing | Who breaks and runs when badly hurt? | **Animals and the cowardly human classes**; undead, daedra, constructs and guards fight to the death (the others back off and circle) |
| Classic lane | The anti-grief fixes with Enhanced AI off? | **Always on**: the cross-pool spacing and the doorway rule apply on the classic lane too (the grief works whatever the victim's setting) |
| Telegraph tier | Who gets a telegraphed blow? | **Level 10 and up, or an elite (meaner-monsters) foe** |

**Status: DESIGNED - all calls made.** Built slice by slice; Mac moved TACT3 first ("anti-grief first").

## TACT3 - BUILT 2026-10-02 (always on, both lanes)

Every version of the door grief, fixed without asking further (Mac: "stop asking me questions"):
- **a. Across pools** - `characters/foeSpacing.js spaceAcross`: the street's watch and encounters (`scenes/world.js`), and a
  building's foes and the watch called in (`scenes/worldModes.js`), push apart pair by pair across pools, the same
  capsule gap, push speed and edge rule as a pool's own `spaceFoes`; another player's foe (`_ownFrom`) is its owner's.
- **b. No foe holds a doorway** - `clearDoorways` over `doorSpotsNear` (the street's building doors within 40 m; a
  building's own doors within 30 m): a threshold 1.4 m deep each side and 1.2 m either way across; a foe in it is eased
  along the door's normal to its own side's edge at 1.6 m/s - unless its way lies through the door, or it is hostile and
  its quarry stands in the doorway itself (no sanctuary on a sill). Through the collider: never through a wall or off
  an edge; another storey is not this door's.
- **c. No guard wall** - `scenes/cityGuards.js indoorWatchSpot`: PlayerEntity's 2-5 watchmen no longer stand at ONE
  point in the door; each walks from that point 2.0 m into the room and out to its own lane (0, -0.9, +0.9, -1.8,
  +1.8 m), the collider stopping it at a wall.
- **d. The door click** - `player/mobileEnemyActivate.js yieldsToDoor` and `player/activate.js peacefulFoePass`: a foe
  NOT hostile to the player standing between the crosshair and a door (or the ladder's other winner) within the door's
  3.2 m reach no longer takes the press, and the plaque names the door it opens; a hostile foe is still DFU's one hit.
- Not built from the slice: attack tokens and ring slots (they need TACT2's ring); guards giving up a door they cannot
  pass (the doorway rule makes it moot for now).
- Pins `test/tact3.test.js` (15); mutants `tools/mutants/tact3.json` (23), all dead.
