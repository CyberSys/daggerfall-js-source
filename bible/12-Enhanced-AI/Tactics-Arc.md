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

**Status: ALL FOUR BUILT 2026-10-02 - TACT3, TACT1, TACT2, TACT4 (Mac: anti-grief first); records at the foot. Not yet looked at on a real install.**

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

## TACT1 - BUILT 2026-10-02 (the Enhanced AI switch on, every host)

- **The proxy** - `ai/cover.js`: a flat at least 1.2 m tall and 0.5 m wide is cover (not the editor's markers 199, the
  animals 201, the lights 210 or treasure 216); its proxy an upright cylinder of 0.35 x its drawn width in radius and
  0.9 x its drawn height, at its BASE. A ray that starts inside one is not stopped by it (a foe in a thicket sees out).
- **The index** rides the collider (`collider.cover`, `createCoverIndex`), never in it: walking, the navmesh and every
  ground probe are unchanged. Sets are keyed like buckets and leave with them (`Collider.removeBucket`); a set's points
  are the batches' own base arrays by reference in its frame, so a recentre moves them and a felled tree sinks its own.
  A 4 m grid per set is the broad phase.
- **Stood by** the streamed world (each pixel's flats - classic, seasonal and scaled - under the pixel's bucket key in
  its translation), the dungeon (its RDB flats at the base - an RDB y is the centre), the interior (its grouped flats;
  a furnishable room's own pieces, which can be taken out, are not), and the single-location exterior host.
- **Read by** `canSeeTarget` (both arms; a tree is never a door to open), the foe's clear shot
  (`hasClearPathToShootProjectile` - an archer behind a trunk holds its shot), every missile (`ArrowFlight`, the
  hosts' bolts in `hostMagic`, the dungeon's arrows and bolts - an area spell bursts on the cover), and the watch's two
  witness rays (a crime behind a market stall's crates is unseen). Hearing is not cover (Mac's call: sight and
  missiles).
- **Off** - with the switch off `coverDistance` answers Infinity before the index is asked: DFU's sight to the bit.
- The switch's Features note says it (+63 chars). Not looked at on a real install yet.
- Pins `test/tact1.test.js` (9); mutants `tools/mutants/tact1.json` (23), all dead.

## TACT2 - BUILT 2026-10-02 (the Enhanced AI switch on, every host)

- **Where** - `ai/tactics.js tacticsStep`, called from the motor's classic tick (`EnemyAI._classicTick`, after the
  destination, ahead of the ranged stand-off), for a foe that SEES its target within 14 m (a shooter: DFU's 51.2 m
  band) and is not detouring or following; otherwise the classic ladder (and the dungeon's navmesh) pursues. The
  motor still walks: the brain sets `_tacDir` (a step back or round the ring, facing the target, at a share of the
  walk - a wall or a drop behind stops it) and the gates `_tacStrike` (melee and touch spells) and `_tacShoot` (the
  bow roll and the ranged spell roll). With the switch off none is set: DFU to the bit (pinned on a five-foe crowd).
- **Tokens** - one board per target (the local player one key, a peer by its owner, a foe by itself): 2 melee and 2
  ranged (Mac). A holder walks in and swings on DFU's clock; after its blow it STANDS it (0.7 s), steps back to the
  ring for 0.8-1.6 s and hands the token on - to the foe that has waited longest. A foe waiting past 6 s goes in
  regardless (patience). A holder not ticked for 1.5 s (despawned, unloaded) loses its token.
- **The ring** - the waiting stand 1.5 m outside their reach (+-0.6), circle slowly toward their own slot angle (each
  its own, drifting), never swinging. A target whose back is turned on a waiting foe at the ring is open: it goes in.
  (The local player's feet and facing, noted by the world host each frame - `noteLocalPlayer`.)
- **Backing off** - a quarter of its health lost inside 3 s: out to 3 m past the ring for 2 s, then back in the queue.
- **Fleeing** - animals and the cowardly classes (Mage, Sorcerer, Healer, Bard, Burglar, Acrobat, Thief) below a
  fifth of their health run, once (DFU's own `flee`, 8 s); the watch, undead, daedra, constructs and every other class
  fight on. The hosts hand each foe's entity (`vitals`) for the read.
- **Kiting** - a shooter holding a ranged token backs away from a target inside 5 m; a shooter without one holds its
  fire.
- **Not built** - the player's other open moments (mid-swing recovery, casting, drinking, staggered) are not read;
  ranged foes do not yet seek a clear line round cover; guards giving up a door is TACT3's doorway rule.
- The switch's Features note says it. Not looked at on a real install yet.
- Pins `test/tact2.test.js` (15); mutants `tools/mutants/tact2.json` (25), all dead.

## TACT4 - BUILT 2026-10-02 (the Enhanced AI switch on, every host)

- **The law** - `ai/foeBlows.js`: three shapes, the world boss's language at a foe's scale - the LUNGE (a lane 4.5 m
  ahead, 0.6 m either side, x1.5, 0.7 s), the SWEEP (a 3.2 m cone of +-65 degrees, x1.25, 0.8 s), the SLAM (a 2 m disc
  1 m ahead, x1.75, 0.9 s). The families: beasts lunge; brutes (giants, the Orc Warlord, Daedroth, the Daedra Lord,
  atronachs, gargoyles, dreugh) slam and sweep; blades (orcs, skeletons, mummies, vampires, frost and fire daedra,
  seducers, lamias, centaurs, every class but the three casters, the watch) sweep and lunge; the casters, the spectral,
  the small and the flying none. The tier (Mac): level 10 and up, or an elite.
- **When** - from the brain (`ai/tactics.js`): a melee-token holder in reach of the local player, its cooldown (8-15 s)
  spent, no other foe winding up within 20 m of the player, a 1-in-10 roll a classic tick. It STANDS the wind-up, its
  aim locked; a knock or a paralysis (any classic tick the motor did not let it decide) breaks it. Once begun it is
  committed - it lands where it was aimed though the target slips out of its sight.
- **The landing** - where the player's feet stand (noted each frame) is the verdict; the swing comes at once (the
  attack component's forced swing, past DFU's clock and reach); the host's own hit resolution asks `blowConnects`
  in place of its reach test and `blowScaled` on DFU's damage roll (armour, skill, the party's weighing and all) - in
  the street's encounters, the watch, and the dungeon (the interior's foes are the street's pool). A blow is only
  ever at the local player.
- **The ground** - `render/foeTelegraph.js` (`renderer.drawFoeTelegraphs`): one flat quad at the foe's feet, the shape
  the fragment's own `inBlow` (pinned point for point), a dim rim at once, filling outward through the wind-up, a
  flash at the landing; additive, depth-tested, unwritten; drawn under the bodies beside the blood marks in the street,
  the building, the dungeon and both standalone hosts.
  `tools/foeTelegraphProbe.mjs` compiles, links and draws the three shapes in a real WebGL2 context (Chromium) and
  reads the frame back: lit inside, the ground untouched beside and behind, dimmer through the wind-up (12 held).
- **Not built** - online, a peer does not see another's foe's telegraph (the wind-up does not ride the foe stream yet),
  and a blow is never at a peer; a block halving it (the port has no player block).
- Pins `test/tact4.test.js` (13); mutants `tools/mutants/tact4.json` (30), all dead.
