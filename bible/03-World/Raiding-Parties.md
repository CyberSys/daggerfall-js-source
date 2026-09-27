# World Events - Raiding Parties (RAID1, RAID2, 2026-09-27)

Kamer's **World Events - Raiding Parties 1.1**, made for this port. Mac, 2026-09-27: "World event mod was specially built
for us. I want to talk about how this can properly be integrated into online in a detailed way." Asked the design's six
questions, Mac answered "1. Server 2. Keep 3. We can also add renown and it's own atheric + armor sets 4. 4 5. Yes
6. Kamer made this for us". RAID1 is answer 5, the offline port with the mod's own bugs fixed. Provenance is
`vendor/world-events-raiding-parties/README.md` (permission: Kamer made the mod for this port). The code is
`systems/raidingParties.js`.

## What it does

Each game day, towns across the Iliac Bay are raided. The roll picks a region evenly among the travel map's regions
that hold a city, hamlet or village, then a town evenly in that region; a town is raided at most once a day. Each raid
starts between 00:00 and 22:00, lasts two game hours (ten real minutes), and brings one party - knights (Knights),
bandits (Rogue 50%, Thief 30%, Burglar 20%) or orcs (Orc 70%, Sergeant 25%, Warlord 5%) - with 15 to 25 deaths to
drive it off.

- A raid on in the player's region is announced once: "Gothway Garden in Daggerfall is under attack by orcs!"
- While the player stands outdoors in the raided town, raiders come one at a time, 10-35 units off and just outside
  the view: every 1-10 s (orcs 1-8 s) while fewer than 25 stand. The town's defenders come the same way, every 1-10 s
  while fewer than 8 stand. A defender's clock is checked first.
- Any raider's death counts. At the target the town "has been cleansed of the orc attack!" A player who fought and
  stands on the town's map pixel gains +5 legal reputation in the region, +5 with its People, +3 with the region's
  knightly order (the first one listed, if the region has one) and +3 with the Fighters Guild.
- A raid that runs out its two hours says "The attackers have withdrawn from Gothway Garden in Daggerfall." to a player
  in the region who was told of it.

One switch, `Enabled`, on by default (`systems/modSettings.js` `world-events-raiding-parties`; the Features row under
World, "Takes effect at once"). The mod had no settings.

**The pace (Mac's "4").** A region is raided about once every four real hours: a game day is two real hours at DFU's
clock, so a day rolls half a raid per eligible region (`raidsPerDay`, `RAID_REGION_REAL_HOURS`). The mod's own count
was 23 a day, which is 3.8 real hours at 44 regions. With the travel map's 43-44 eligible regions the port rolls 22.

## How the port carries it

`systems/raidingParties.js` is TownRaids read off its IL (`vendor/world-events-raiding-parties/il/`), and each number
cites its offset: `SelectRaids` [IL_0bd4] as `raidRegions` + `rollRaids`, `Update` [IL_0428] as `raidFrame(dt)`,
`ChooseEnemy` [IL_137c] as `chooseRaider`, `OnEnemyDeath` [IL_0fec] as a poll of the raid's own records,
`GrantReputation` [IL_1240] as `grantRaidReputation`, and `RaidSaveData` on DFU's per-mod slot
(`systems/modSaveData.js`, registered at boot in every host by `installRaidingParties`).

The world host (`scenes/world.js`) answers the seams:

- **the towns** - MAPS.BSA's reader, the game's own rows only (`baseLocationCount`, the gate scan's law, so every client
  reads the same list), and the picker's bytes from the travel map's art (`travelMapPickerData`, TRAV0I01.IMG);
- **the GPS** - the region (and -1 at sea, fix 8), the town while outdoors in its rect (FindCurrentRaid's three tests),
  the map pixel;
- **the raiders** - the street's own pool, placed by DFU's loose-foe law (`hostEnchant.js standLooseFoe`, twelve tries)
  on the mod's 10-35 band, `loose` (no encounter cap refuses one; they still count toward it, so a raid crowds out the
  wilderness rolls) and `transient` (no save carries one; after a load the raid stands them again);
- **the defenders** - the town watch's own (`cityGuards.standDefender`, new here: one watchman at a time, minted as
  DISC19-F's `summonDefenders` mints its fallback arm - the player's ally, sent at the nearest raider). The cap of 8
  counts every defender standing, the watch's own among them. The watch's switch would send each one home on the frame
  it came, so `_townWatchFrame` keeps the watch up while a raid is on in the town (`raidDefendingHere`). A crime on the
  player or a transformed beast gets no defenders, as with the watch;
- **the reward** - the player and the faction store (`_questStore`);
- **the frames** - once in the street, after the pools move and the watch answers (so a death counts on the frame it
  falls), and once in the modal branch (the roll, the announcements and the expiry run indoors too; nothing is stood
  there). Both are given the frame's time, held by a pause.

## The mod's bugs, and what each is here

These are departures, and Port-Ledger section A carries them.

1. **The day's raids are the day's.** The roll draws from the day's own generator (`worldTick.js dayRng`, a new
   `DAY_SALT.raids`). The mod's `UnityEngine.Random` re-rolled a day's towns at every reload. The same day now rolls
   the same towns for every player, which is what RAID2 needs. The spawn clocks and species stay under THE ENGINE-PRNG
   RULE (an injectable roll).
2. **"Withdrawn" only of a raid the player was told of.** On a day's first frame the mod expired every raid whose hours
   had passed and announced each in the player's region: a new game at 13:30 heard of about half a day's raids at once.
3. **Announced once, remembered in the save.** The mod forgot at every load and announced the raid again.
4. **The defenders are the town's watch.** The mod's were Knights re-skinned every three seconds. Killing one was no
   crime, their Knight loot could be farmed, and after a load they showed a Knight's sprite and bow for three seconds.
5. **The reward needs a player who fought.** A blow on one of the raid's raiders (the Renown tracker's own stamp,
   `renownStruckAt`) is required as well as the mod's map pixel. The mod paid a player standing indoors on the pixel
   while the watch did the work. Any death still counts toward the cleanse.
6. **What is left stands down out of sight.** The mod destroyed every raider and defender at the cleanse, the timeout
   and midnight, mid-swing and in view. Here an ended raid's raiders fight on, uncounted, while seen, and go at the first
   3-second sweep that finds them out of the view's cone (`outOfSight`, the view plus a 10-degree margin). Defenders
   stand down by the watch's own law.
7. **The spawn clocks hold with the game.** They ran on `Time.realtimeSinceStartup` through a pause, so raiders piled up
   to the caps behind an open menu.
8. **Nothing is announced or withdrawn at sea.** PlayerGPS reads the sea's politic 64 as region 31 and an unmapped pixel
   as 0.
9. **A raid ending on the day's last minute gets its "withdrawn".** The mod's day roll discarded it before its expiry
   pass could see it. Here the old day's raids expire first.
10. **A spot not found costs nothing.** The mod's spawner searched for eight seconds and then held both clocks ten more,
    so a cramped street starved the raid. The placement here is whole in one call, and a miss waits for the clock's own
    next tick. The 8 s lapse and 10 s back-off remain for a spawn that never lands.
11. **"The orc attack"**, not the mod's "the orcs attack".

**Kept as the mod has it.** The region is picked evenly, not the town, so towns in small regions are raided more often.
Mac's "4" is a per-region pace. A day skipped whole (a long rest or journey) never rolls. A raid is two game hours
however fast the clock runs, and a cleansed raid stays in the list, inert, until its end.

## Online (RAID2, 2026-09-27)

Mac's answers set the plan: RAID2 puts the raid on the online world; RAID3 ("Server") has the relay keep each raid's
count, cleanse and participants and sign the rewards (a relay deploy); RAID4 adds Renown and the raids' own Aetheric
items and armor sets. RAID2 is in, and needs no wire or relay change - the relay reads a foes frame's record count and
nothing else (`world/raidShared.js` validates everything new, at the reader).

- **The same raids everywhere.** The roll is the shared day's (fix 1), so every client names the same towns, times,
  parties and targets. Announcements and "withdrawn" stay each client's own, off that shared list.
- **One runner.** A player standing in a raided town runs its raid only if it wins WOD7's claim law
  (`raidRunnerOf`): every claim heard, oldest first - a later claim takes it only inside `RAID_CLAIM_WINDOW_MS`
  (5 s) and with the smaller id. With no claim, the smallest id standing in the town claims it, and a larger one
  claims once a smaller has left it unclaimed `RAID_CLAIM_GRACE_MS` (10 s: a client without RAID2, or gone quiet,
  must not hold a town unraided). A claim unheard for `RAID_WORD_STALE_MS` (6 s, three full frames) is gone. Everyone
  else stands by (`'standing-by'`): nothing stood, nothing pending.
- **The runner's raiders ride its frame named.** A raider carries its raid (`raidKey`), the frame names each one
  (`rz: [[record, key]]`), and a reader stands them under `RAID_PUPPETS_MAX` (25, the mod's cap, Mac's "Keep") apart
  from the twelve a reader stands of an owner's plain foes. A raider taken over from a fallen runner keeps its raid.
- **Defenders stand as allies.** The frame names the owner's allied watchmen (`al`), and a reader stands them as its
  own allies (`alliedWatchPuppet`); a later frame that no longer names one (a crime turned him) stands him as the watch
  again. This closes WATCH1's recorded limit for every town-watch defender, not only a raid's.
- **The deaths are every owner's, summed.** Each owner counts its own raiders' deaths, and its word (`rk: [[key,
  deaths, claim age]]`, on every frame it sends) says its share and its claim (-1: none). A raid's deaths are mine
  plus the most each peer has said (`raidKillTotal`), and the raid is cleansed wherever the sum meets its target - so
  a runner who walks out or loses a race keeps its share, and the next counts on from it.
- **Who fought.** A blow of mine on one of the raid's raiders - my own, or a peer's raider standing here as a puppet -
  marks the raid fought (the Renown stamp), and RAID1's reward follows on the pixel.
- **The switch is the room's** (`ONLINE_ROOM_MOD_KEYS`, forced on), with a world event's own words on the lock: a
  player with it off would walk a raided town the others fight in, unable to see the raiders striking him.

**Limits, recorded.** Outdoor cells have no memory: if every player leaves a raided town its shares go with them
(RAID3's relay keeps them). A runner who loses a race or leaves keeps its standing raiders until they die or are culled,
so for a moment two owners' raiders can stand together. A frame's word is a client's: nothing stops a modified client
saying a false share - RAID3 moves the count to the relay, and RAID4's rewards will pay from its signed receipt.

## Open

- **Not seen in the running game.** This container has no ARENA2 data, so no town, picker or watchman has been stood
  here, and no two browsers have raided a town together. The pins drive the runner through a recording host, trade real
  frames between two foe pools, and read the wiring by source.
- The travel map's eligible-region count (and so the day's count) has not been measured against the data.
