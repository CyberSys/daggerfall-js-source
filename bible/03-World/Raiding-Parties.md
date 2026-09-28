# World Events - Raiding Parties (RAID1, RAID2, RAID3, 2026-09-27)

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
items and armor sets. RAID2 needed no wire or relay change - the relay reads a foes frame's record count and nothing
else (`world/raidShared.js` validates everything new, at the reader). RAID3 is below.

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
(at a relay that keeps raids, RAID3's ledger holds them now - below). A runner who loses a race or leaves keeps its
standing raiders until they die or are culled, so for a moment two owners' raiders can stand together. A frame's word
is a client's: nothing stops a modified client saying a false share - at a RAID3 relay the count is the relay's, and
RAID4's rewards pay from its signed receipt.

## The relay holds the raid (RAID3, 2026-09-27)

Mac's "1. Server": the relay tracks each raid's kill count, kept even if everyone leaves, the cleanse and the
participants, and signs the rewards. `RELAY_VERSION` world122 (a relay deploy - it drops every connected player once).

- **Where.** A raid's LEDGER lives in the raided town's CELL (`worldRoom(px, py)` - every player standing in the town
  is in that room), in the cell object's storage (`raid:<key>`), for the raid's window and `RAID_KEEP_MS` (10 min)
  past it; the cell's alarm forgets it then. A cell keeps `RAID_LEDGERS_MAX` (4) - a new raid takes the stalest one's
  place. The law is `net/raidLaw.js`, pure; the relay's half is `server/src/index.js` (`_raidWord`, `_raidClean`,
  `_raidSweep`).
- **The word.** A player standing in a raided town while it runs says `{t:'raid', k:'w', key, st, tg, ty, px, py, n,
  s}` to the town's cell - the raid as the day's roll made it (its start, target, party and town pixel), the deaths of
  ITS OWN raiders so far (`raid.killed`, saved with the character) and `s` 1 once it has struck a raider - at once
  when `n` or `s` moves, else every `RAID_WORD_MS` (5 s). Every player sends it, whoever runs the raid; RAID2's `rk`
  words still elect the runner.
- **What the relay checks.** A word said in another cell, or in any other room, is junk (struck). One outside its
  raid's day and window (the shared clock, `RAID_SLACK_MINUTES` either side - ten real seconds of skew) is kept
  nowhere and answered nothing; for a raid it already keeps, the ledger's own window is the one asked. One from a
  socket whose pose is not on the town's map pixel is answered but counts nothing and names nobody. The first word
  keeps what the raid is (WOD7's law); later words add only deaths and speakers.
- **The count.** Each ACCOUNT's share is the most it has said (the verified `sub`; a socket no account vouched for
  counts as itself and earns nothing), credited no faster than raiders can stand: the raid's total may not pass
  `RAID_KILLS_BURST` (3) + one a second from its first word (`RAID_KILL_MS` - the mod stands a raider every one to ten
  seconds) - clipped, not refused, and credited later as the raid runs on - and never past the target. A count that
  moved is written at once and fanned to the cell (`st`); a word that moved nothing is answered to its speaker alone.
  So the count outlives every player leaving the town, and the object's own sleep: the next player to walk in fights
  on from it.
- **The cleanse, said once.** At the target the cell mints a receipt for each account that EARNED it - struck a raider
  (its word said so) and said so from the town within `RAID_PRESENT_MS` (15 s) of the cleanse: the mod paid a player on
  the town's pixel at the cleanse, and RAID1's fix 5 asks that they fought - writes the ledger WITH them (the gate's
  AUDIT WB A10 law: kept before it is said), fans `cl` (`at`, the earners' names with the most deaths first, their
  count) to the cell, hands each earner's receipt to its account's newest socket there (AUDIT WBX S4's one tab), and
  tells the hub (`RAID_INTERNAL_CLEAN`) until it answers (the cell's alarm tells it again every `RAID_TELL_RETRY_MS`).
  A word after it is answered with the cleanse and its speaker's receipt again (a dropped link's), and counts nothing.
  Any word that finds the count at its target with no cleanse stamped starts it (a ledger written at its target just
  before an eviction), and a word that lands while the receipts are being minted is not heard - an object's input
  gate holds for storage alone, and the mint awaits the key and the signature - so a raid is cleansed once.
- **The receipt** (`net/raidReceipt.js`): `w1.<base64url({ w, s, c, y, i, e })>.<signature>` - the raid's key, the
  account, a seed from the relay's CSPRNG (RAID4 rolls the spoils off it), the party, issued and expiry (a week).
  Signed by the relay's one key, `GATE_SIGNING_KEY`, which now signs two things - the version is inside the signed
  bytes, so the gate's verifier refuses a `w1` and this one an `r1` before a byte of either body is read, and neither
  passes as an identity. A relay with no key sends it unsigned; the client still reads it.
- **The hub** says every cleanse to everyone online (`cl`) and keeps today's and yesterday's for a hello (`cls`). A
  client closes the raid on hearing it: the mod's line, with who held the town ("Defended by Ann, Bran and 2
  others."), where RAID1 says a raid's lines - from the town's own cell, or to a player told of the raid who stands in
  its region; quietly anywhere else and from a hello's list. So nobody's machine says a cleansed raid withdrew. A
  ledger's `st` naming a cleanse the machine missed closes it too. RAID1's reward is RAID1's law (struck, on the
  pixel) whichever word closes the raid.
- **The client** (`systems/raidingParties.js raidRelayWord`, `net/online.js sendRaid`): at a relay that keeps raids
  (`relaySupportsRaid`, off the primary socket's welcome) the count and the cleanse are the relay's alone - no sum of
  words here cleanses a town; offline, and at an older relay (which closes a socket on the frame, so none is sent to
  it), RAID2's law runs the raid as it did. The receipts are kept, one a raid (`RAID_RECEIPTS_KEPT`), and handed to
  RAID4.

**Limits, recorded.** The relay cannot see a kill or a blow: a player's deaths and its strike are its own machine's
word (co-op's law - the relay has no world to see them in), bounded by the cap, the town's pixel and the raid's
window. It has no copy of the day's schedule (no game data), so it keeps a raid it was told of in its day, its cell
and its pose, and no other; the account service (RAID4) bounds what a receipt is worth. A tab loaded before the deploy
fights by RAID2's law, and its raiders' deaths reach the relay's count only once it reloads.

## Open

- **Not seen in the running game.** This container has no ARENA2 data, so no town, picker or watchman has been stood
  here, and no two browsers have raided a town together. The pins drive the runner through a recording host, trade real
  frames between two foe pools, drive RAID3's ledger over the real relay object and its hub, and read the wiring by
  source. The relay's half ships with its deploy (world122).
- The travel map's eligible-region count (and so the day's count) has not been measured against the data.
