# THE SEATS ARC - guilds hold the Iliac Bay (SEAT0, the design record)

**Status: DESIGN RECORD. Nothing here is built.** Opened 2026-09-28. This page is the whole design of guild town
control - SEAT1 (holding a seat) and SEAT2 (sieges) of THE HOLDINGS ARC (`06-Systems/Online-Arc.md`, "THE HOLDINGS
ARC") - grown out before a line of it is written, at Mac's word:

- "So the 3 main castle hubs should be larger capture points, while every other location with a palace (must have)
  will be a lower capture point"
- asked which palace locations: **"Every palace location"** (not only the ringed hubs - a region may hold several)
- asked what makes a castle seat larger: **"All of the above"** - it costs and pays more, its sieges are bigger, it
  reaches over its kingdom, and it carries rewards no palace seat has
- "Make sure we're documenting everything before building. You have some amazing ideas, so I want this to have
  insane depth, replayabiity and everything else."
- "If theres also sub systems (like life skills + materials) that can play a part, we can do that also. The sky is
  the limit" - the companion design is `06-Systems/Professions-Arc.md` (PROF0), and section 11 below is where the
  two meet.

Mac's answers to the first record's questions (2026-09-28), each folded in where it applies:

- the currency: **"New currency"** - Marks, a server-held currency (`06-Systems/Professions-Arc.md` section 8); claim
  fees, upkeep, Tribute and the Tithe are paid in Marks (4.2, 7.1, 7.2)
- one guild a week per account: **"Yes"** (4.4)
- the Turning and the siege times: **"Yes"** (5.1, 6.3)
- the kingdoms: **"You"** - the record draws them (4.3)
- the registry: **"Figure it out"** - the record decides (3.2)
- and two things Mac had already planned, which this design now carries: life skills with "Active player
  involvement and actual UI integration" (tree chopping, picking up ingredients, fishing) - PROF0 section 5A - and
  **"The new notice board should be a physical object that houses quests, the player auction house, etc"** - PROF0
  section 8, and the Seat tab it gives this arc (7.9).

## How to read this page

Every rule here carries one of four marks, and the marks are the point: a reader must be able to tell Mac's word
from the record's own proposal at a glance.

| Mark | Meaning |
|---|---|
| **DECIDED** | Mac's word, quoted. Law until Mac changes it. |
| **PROPOSED** | This record's default, with its reason. Mac may overrule any of it; a slice builds it as written unless he does. |
| **OPEN** | A question only Mac can answer. No slice that depends on it starts until it is answered. |
| **FACT** | What the tree does today, read off the file named. |

Numbers marked PROPOSED are starting points for tuning, not measurements. Every one of them lives in ONE law module
(section 14) so a balance pass is an edit to one file.

## 1. The laws this arc keeps

1. **ONLINE ONLY.** Offline Daggerfall stays Daggerfall Unity, 1:1 (`01-Overview/Port-Doctrine.md`). A seat is a
   Ledger A departure (`01-Overview/Port-Ledger.md` section A, a row added when SEAT1 ships), online's alone, as the
   hubs, homes and guilds are.
2. **THE COURT IS THE GAME'S.** A palace's ruler, its court faction, its quests and its opening hours stay exactly
   what DFU makes them (FACT: `npcSession` routes a palace NPC to the region's court; `buildingLocks.js` keeps type
   16 open 10:00-16:00). A guild does not become the king. It holds the town's **Charter** - a royal writ granting a
   guild the keeping of the town - and everything a seat changes is layered over the game, never written into it.
3. **A SEAT IS DECIDED WHERE NO CLIENT CAN LIE.** This is the arc's hardest law and the reason for most of its
   shape. FACT: almost everything online today trusts the client - gold and items live in the save, Renown XP is
   client-reported (bounded, never verified; `server-account/src/renownTracks.js`), a duel is resolved by the
   defender's own machine (`src/net/duelSession.js`), and no pose is speed-checked (`validPose` in
   `src/net/wire.js`). That is fine when a lie only cheats the liar. A seat is a prize other guilds lose, so:
   - every influence source is either **witnessed by a server** (the relay or the account service saw it happen) or
     **bounded** (client-reported, capped, and worth less);
   - every siege outcome is **refereed by the relay**, the way the Oblivion Gate's boss already is
     (`bible/11-Multiplayer/World-Bosses.md`, `src/net/gateBrain.js`) - never by a fighter's own client;
   - every scheduled moment is a **pure function of the clock**, like the gate's (`src/net/gateLaw.js`), so every
     client and both servers agree without a frame.
4. **DERIVED OVER ENUMERATED** (the repo's law, `server-account/src/titles.js`). Which locations are seats is read
   off the game's own data, as the hubs are (`src/systems/regionHubs.js`); who holds a title from a seat is derived
   from who holds the seat, never stored beside it; and **the week settles itself when first read after its
   boundary** rather than on a cron (AUDIT-ACC F9's lesson, restated in `titles.js`: "a cron is a thing that can
   stop running while everything looks fine").
5. **NOTHING OF ARENA2 IS COMMITTED** (Port-Doctrine, and "a render of game data is game data"). Banners, heraldry,
   map marks and anything else a seat draws are either the port's own art or drawn at runtime from the player's own
   data. The servers never hold game data at all, which shapes section 3.
6. **THE WORD "SEAT" IS TAKEN IN THE CODE.** `ONE-SEAT` (one online tab per account, `src/net/oneSeat.js`,
   `SEAT_ELSEWHERE`), SEAT-HEAL (dungeon foe authority) and the party's kept "seat" all use it. So the player reads
   "seat" and the code says **`townSeat`**: src/net/townSeatLaw.js (to be written), D1 tables `town_seats*`, relay frames
   `{t:'tseat'}`. PROPOSED.

## 2. What already stands (FACT)

Each row is a real module or table this arc builds on, and what it gives.

| Foundation | Where | What the arc uses it for |
|---|---|---|
| Region hubs, capitals | `src/systems/regionHubs.js` (HUB1), built at boot in `scenes/world.js` over MAPS.BSA | The boot pass that already reads every location; `HUB_CAPITALS` names Daggerfall, Wayrest, Sentinel |
| Building records in MAPS.BSA | `readBuildingData` (`src/formats/blocksFile.js`), `loc.exterior.buildings[]` | `buildingType` 16 is a Palace (`src/world/buildingNames.js`) - readable for every location without loading a block |
| Castles | `castleBlockAt` / `insideDungeonCastle` (`scenes/dungeonContext.js`) | Castle Daggerfall, Wayrest and Sentinel are RDB dungeon rooms (`dungeon:m<id>`), not building interiors |
| Guilds | `server-account/src/guilds.js`, `0013_guilds.sql`, `src/net/guildLaw.js` | 50 members, four ranks (GM, Officer, Member, Recruit), a treasury the service keeps, a ledger written by trigger, `gi`/`gt`/`gm` on the signed token |
| Homes and decor | `server-account/src/homes.js` (0010), `decor.js` (0011, 0012, 0015), `src/net/homeLaw.js`, `decorLaw.js` | One owner a building, 3 homes a character, entry private/party/public (guild entry planned, not built), stations (alchemy/spells/enchant) for a licence fee |
| Renown | `renown_tracks` (0009), `src/net/renown.js`, `renownTracker.js` | A character's online level (max 50); XP client-reported, 5,000 a report, 20,000 an hour an account; **no region recorded** |
| The Oblivion Gate | `src/net/gateLaw.js`, `gateBrain.js`, `gateReceipt.js`, relay `_gate*`, `0014_gate_kills.sql` | The one relay-refereed fight: HP, hit acceptance (reach + pose slack, rate, damage buckets), phases, signed `r1.` receipts; its site from the day's hash |
| Duels | `src/net/duelSession.js`, `src/combat/duelCombat.js`, `0008_duels.sql` | 1v1, the 12 m ring, defender-resolved; the loss reported by the loser's client |
| Parties | the hub (`chat:world` Durable Object), `PARTY_MAX` 8 | Warbands are built from parties |
| Rooms | `roomKeyFor` (`src/net/online.js`), `wire.js` | A town online is part of a 16x16-pixel CELL room; 256 sockets a room; 32 nearest hear every pose; 8 full bodies drawn, the rest as sprites |
| The shared clock | `sharedClassicMinutes` (`src/net/wire.js`) | One game day = 2 real hours; a game week = 14 real hours; the relay imports the same function |
| Live events, the server's voice | EVENT1 `{t:'stage'}`, RED1 `/red`, `/dm`, MOD1 `/mute` | Announcing a siege, a revolt, a festival |
| Factions and powers | `src/systems/factionRep.js`, `regionPower.js`, `worldTick.js` (WORLD6b) | Per player, client-side; only the DICE are shared online. FACTION.TXT has Province factions with ally/enemy/parent slots (`src/formats/factionFile.js`) |
| World prices | `worldRegionPrice` (`worldTick.js`), `regionPriceAdjustment` (`shopStock.js`) | One pure function of the world day - every client computes the same prices; nothing on the wire |
| Titles and glyphs | `server-account/src/titles.js`, `identityToken.js` `TITLES`/`GLYPHS` | Derived grants; a new title is a vocabulary change the relay must learn first (the SHADOW-FANG lesson: relay version first, then the account service) |

What does NOT stand, and this arc must build or wait for: a region on a Renown report; any server-side record of
where anything happened; a guild's colours or device; guild entry to a home; any PvP referee; any speed check on a
pose; a region-to-kingdom table.

## 3. The seats

### 3.1 Which locations are seats

- **Crown seats (major)** - DECIDED: the three castle capitals, **Daggerfall, Wayrest and Sentinel**. Each is a city
  in the overworld AND a castle dungeon (FACT, section 2). The seat is the pair: the city is where the siege is
  fought, the castle is the holder's hall.
- **Palace seats (minor)** - DECIDED: **every location with a Palace**, hub or not. A location is a palace seat when
  one of its MAPS.BSA building records has `buildingType` 16. The three capitals are crown seats and never also
  palace seats.
- **No palace, no seat** - DECIDED ("must have"). The rings (HUB1) stay what they are: a hub without a palace is
  still a hub, it is just not a seat.
- **How many** - OPEN until counted. PROPOSED: slice SEAT-COUNT is a Node tool (tools/seatCount.mjs (to be written)) that walks
  MAPS.BSA from `ARENA2_PATH` exactly as the boot pass does and prints every seat - region, location, kind, whether
  it is the region's hub, whether its blocks place a bulletin board (PROF0 8.1) - and the totals. It prints and commits NOTHING (the list is read off game data; Mac runs
  it locally). Every economic number below is tuned against that count.

### 3.2 How the servers know a seat without game data

FACT: the relay and the account service never hold ARENA2, so neither can read MAPS.BSA. The client derives the
seat list at boot (as it derives the hubs); the servers must still refuse a guild that claims a seat that does not
exist. PROPOSED, **the witnessed registry**:

- A seat is keyed by its unsigned map id (the key the room names and the homes already use).
- The first time any registered client stands in a seat town online, it reports `{mapId, region, tier, name}` to the
  account service. The service records the row as **unconfirmed**.
- A row becomes **confirmed** when three distinct registered accounts have reported it byte-identically. Only a
  confirmed seat can gather influence or be claimed.
- A report that disagrees with a confirmed row is refused and counted (a modded MAPS.BSA, or a lie).
- The three crown seats are confirmed by name and region the same way, and additionally must match
  `HUB_CAPITALS` - a crown claim for any other name is refused outright.

DECIDED (Mac: "Figure it out" - the record's choice): **the quorum**, not a committed table of map ids, because a
list read off MAPS.BSA is ARENA2's and the doctrine keeps ARENA2 out of the tree. Four more rules close its holes:

- **Who may witness**: a registered account at least 7 days old. Guests and fresh accounts report nothing.
- **What a fake seat could win**: nothing a real player sees. A client never draws, lists or honours a seat its own
  derivation does not have (the map, the board, arrival lines), and a seat's only fee income is Marks spent in its
  own town (7.2), which nobody spends in a town that does not exist.
- **The strike**: a developer's `/seat strike <mapId>` (the dev glyph, RED1's authority) removes a row and its
  history; the strike is itself a history row.
- **The watch on the watchers**: three accounts that confirm a seat nobody else ever reports are listed on the
  service's audit log for a person to read.

### 3.3 The Charter, the words and the look

- **The Charter** - PROPOSED: what a guild holds is "the Charter of <Town>" (palace seat) or "the Crown Charter of
  <Kingdom>" (crown seat). The holder's guildmaster is "Warden of <Town>" / "Lord Protector of <Kingdom>"; these are
  DERIVED titles (section 7.4) - held while the charter is, gone the moment it is.
- **Arrival** - PROPOSED: HUB1's arrival line grows a holder: "Anticlere, held by the Silver Hand <SH>." / "Unheld."
  A seat that is not a hub gets the line too.
- **The map** - DECIDED (the Holdings plan): the seat's circle in the holder's colour. PROPOSED: an unheld palace
  seat is a hollow grey ring; a held one is filled in the guild's colour; a crown seat carries a crown mark over the
  ring (castle tier, "a map mark of its own" - DECIDED under "All of the above").
- **Banners** - DECIDED ("the holder's banners and colours in the city"). PROPOSED: heraldry becomes part of a guild
  (section 8.1): two colours and a device. The banner is drawn at runtime - the port's own device art, tinted, on a
  cloth quad - hung at fixed anchors the seat law derives from the town's own layout (the palace door, the town
  gates, the market square). Nothing of ARENA2 is baked; nothing is drawn offline.

## 4. Influence - the currency of a claim

Influence is how a guild earns the right to claim or besiege a seat. It is counted **per guild, per seat, per
week**, and it is spent or cleared at the week's Turning (section 5).

### 4.1 The Pledge

A region may hold several seats (DECIDED, every palace), so influence earned in a region needs a target.
PROPOSED: each week a guild **pledges** to at most one seat in each region (Officer or GM, before the Turning; the
pledge can be moved until the Muster closes). Influence earned in a region flows to the pledged seat. A guild that
has not pledged in a region earns there nothing. This is the arc's first strategic choice: spread thin or stack one
town.

### 4.2 The sources

Every source names its trust level. Weights are PROPOSED.

| Source | Trust | Influence | Why |
|---|---|---|---|
| **The Watch** - a member's socket present in the seat's cell room, in the town's rect | Relay-witnessed | 1 per 2 minutes present, capped 60 a character a day | The relay knows who is connected and where; the cheapest honest signal of a guild that actually lives in a town |
| **Gate kills** - an Oblivion Gate felled whose site is in the seat's region | Relay-signed (`r1.` receipts carry the day; the day's site is a pure function) | 300 a receipt | The gate is already the server's; defending the region is the lore of a seat |
| **Writs** - a delivery of materials to the seat's stockpile (PROF, section 11) | Service-witnessed (materials live in the Stores) | By the writ's value | The material economy is the seat's supply line |
| **Homes** - members' homes in the seat's town | Service-witnessed (the homes registry) | 25 a home a day, capped 5 homes a guild a seat | Settling a town is claiming it |
| **Siege results** | Relay-refereed (section 6) | Section 6.8 | War is the loudest voice |
| **Renown in the region** - Renown XP a member earned while in the seat's region | Client-reported, bounded | 1 per 20 Renown XP, capped 400 a character a week | The original plan's source (the Holdings arc: "members' Renown XP earned in the region"), kept - but it is the one source a modified client can inflate, so it is worth the least and capped hardest |
| **Tribute** - treasury Marks spent on the pledge | Service-witnessed (Marks are the server's - DECIDED, "New currency") | 1 per 10 Marks, capped 20% of the guild's week | Wealth matters, but must never be the whole answer |

- **Per-character cap** - PROPOSED: whatever the sources, one character contributes at most **2,000 influence a
  seat a week**. So a 50-member guild's ceiling is 100,000 and a 12-member guild's is 24,000: size matters, and
  commitment matters more.
- **Renown needs its region** - FACT: nothing records one. The Renown report grows `region` (0-61, the client's
  PlayerGPS region at the kill or the quest); the service keeps a per-character, per-region, per-week sum beside the
  track. It is still client-reported; the cap above is what makes that acceptable.
- **The Watch is not idling** - PROPOSED: presence only counts while the socket's pose has moved in the last
  5 minutes and the character is not resting, so a parked tab earns nothing. A bot can still walk; the daily cap is
  what bounds it.

### 4.3 Kingdom reach (crown tier)

DECIDED ("All of the above"): holding a crown seat gives the guild an influence bonus toward the palace seats in that
kingdom's regions. PROPOSED: **+25%** on every source except Tribute, on palace seats in the kingdom, while the crown
charter is held.

**The kingdoms** - DECIDED (Mac: "You" - the record draws them). FACT, why they are drawn and not derived: nothing
in the tree maps a region to a kingdom, and the one geographic table the port has - DFU's `borderRegions`
(`BORDER_REGIONS`, `src/systems/factionRelations.js`, transcribed 1:1) - is not laid out in region order: its row
commented "Daggerfall" is its eighth row and names Betony, Tulune, Glenpoint, Shalgora and Ilessan Hills, which is
Daggerfall's real neighbourhood, while its eighteenth row (Daggerfall's index in `REGION_NAMES`) names Alcaire's.
So the map below is drawn from the Iliac Bay itself - High Rock north of the bay, Hammerfell south - and from the
labelled rows where they agree with it, with the region names and indices of `REGION_NAMES` (`src/formats/mapsFile.js`,
DFU's own table, MIT). The table lives in the seat law module with this paragraph beside it.

| Kingdom | Regions (index) |
|---|---|
| **Daggerfall** (western High Rock) | Daggerfall (17), Glenumbra Moors (59), Tulune (58), Ilessan Hills (60), Glenpoint (18), Shalgora (42), Daenia (41), Northmoor (32) |
| **Wayrest** (eastern High Rock) | Wayrest (23), Menevia (33), Alcaire (34), Koegria (35), Bhoriane (36), Kambria (37), Dwynnen (5), Phrygias (38), Urvaius (39), Ykalon (40), Gavaudon (57) |
| **Sentinel** (Hammerfell) | Sentinel (20), Alik'r Desert (0), Dragontail Mountains (1), Dak'fron (11), Abibon-Gora (43), Kairou (44), Pothago (45), Myrkwasa (46), Ayasofya (47), Tigonus (48), Kozanset (49), Satakalaam (50), Totambu (51), Mournoth (52), Ephesus (53), Santaki (54), Antiphyllos (55), Bergama (56), Cybiades (61) |
| **The Marches** - claimed by two crowns | Betony (19) - Daggerfall and Sentinel, the very quarrel Daggerfall's own story is fought over; Anticlere (21) - Daggerfall and Wayrest, where the two High Rock kingdoms meet; Lainlyn (22) - Wayrest and Sentinel, across the bay's eastern mouth |
| **The Free Lands** - no crown's reach | Isle of Balfiera (9) - the Direnni's; Orsinium Area (26) and Wrothgarian Mountains (16) - the Orcs' |

The regions left out hold no location at all (the wildernesses, the coast strips, the two generic villages - FACT,
`travelMapWindow.js` counts eighteen with no map page), so they can hold no seat. **The Marches** are this map's own
depth, PROPOSED: kingdom reach applies there from BOTH crowns at half strength (+12.5% each), so a march is where two
crown-holding guilds' wars overlap - and a guild holding both of its crowns gets the whole +25% there.

### 4.4 Collusion - the per-account law

FACT: guild membership is per CHARACTER (GUILD1, Mac: "Per character"), so one account's characters may sit in
rival guilds. That is a collusion lever: an account can feed a friendly challenger with one character and defend with
another. DECIDED (Mac: "Yes"): **influence and siege places are per ACCOUNT per week** - the first guild an account's character contributes to in a week is that account's guild for
the week's seats; its other characters earn nothing toward any other guild's seat that week. Membership stays per
character; only the war is per person.

## 5. The week - the Turning

### 5.1 The cycle

A game week is 14 real hours (FACT), far too fast for a war. PROPOSED: the seat week is a **real week** counted from
`ONLINE_EPOCH_MS`, with **the Turning at a fixed UTC moment**: DECIDED (Mac: "Yes"), **Sunday 18:00 UTC**.

| Phase | When (PROPOSED) | What happens |
|---|---|---|
| **Muster** | Turning to Friday 18:00 UTC | Influence accrues; pledges may move |
| **Reckoning** | Friday 18:00 to the Turning | Pledges are locked; influence still accrues; the standings are public |
| **The Turning** | Sunday 18:00 UTC | The week settles (5.2) |
| **Siege days** | The week after a Turning that named a challenger | The siege is fought in the holder's chosen window (6.3) |

### 5.2 What the Turning decides

The Turning is not a job that runs. PROPOSED: the account service settles week N **the first time anything asks
about a seat after N's boundary**, in one transaction, idempotently (a second reader finds it settled). The result is
a row in the seat's history, and every client learns it by reading.

For each confirmed seat:

1. **Unheld seat.** The guild with the most influence, if it passed the **claim threshold** and its treasury can pay
   the **claim fee**, takes the charter. PROPOSED thresholds - palace 5,000 influence and 5,000 Marks; crown 25,000
   influence and 50,000 Marks. If the top two are within 10% of each other, nobody takes it: the seat is
   **Contested**, and next week opens with a **Tourney** (6.7) between them. (Every fee on this page is in **Marks**,
   the server's currency - DECIDED, "New currency"; the gold figures of the first record are divided by ten: a Mark
   is worth about ten gold of play, PROPOSED.)
2. **Held seat.** The top challenger, if its influence beat the holder's own **defence** (the holder's influence
   that week, plus Standing's bonus, section 7.3), wins the **Right of Siege**: a siege is scheduled in the next week.
   Otherwise the holder keeps the seat unchallenged and banks a Standing gain.
3. **Upkeep.** The holder's treasury pays the week's upkeep (7.1). A treasury that cannot pay puts the seat in
   **Neglect**: one week's grace, then the charter lapses and the seat is unheld.
4. **Truce.** A seat that changed hands this Turning cannot be challenged at the next one.
5. **Clear.** Influence is cleared. PROPOSED: 10% of a guild's influence at each seat carries as **Legacy** (a
   standing start next week), so a long campaign is not thrown away by one bad week.

## 6. Sieges (SEAT2)

DECIDED (the Holdings plan): "the top challenger meets the holder in a scheduled team battle at the seat, built on
the duel ring". DECIDED ("All of the above"): crown sieges are bigger.

### 6.1 The prerequisite - PVP-REF

FACT: no server sees a blow between players today. A duel is resolved by the defender's own client, and "a client's
damage claim is applied as sent" everywhere else (`bible/11-Multiplayer/Multiplayer.md`). A siege decided that way
is decided by whoever edits their client. So SEAT2 waits on a slice of its own - **PVP-REF, the refereed blow** -
built from the gate's law, which already refereed 256 fighters against one foe:

- In a siege room, the RELAY holds each fighter's **siege vitality** (not their save's health - a siege never costs a
  save anything, PROPOSED), the way it holds the boss's HP.
- A blow is a claim (striker, target, weapon, the character sheet the duel already sends); the relay accepts it only
  when both are alive, the target is within the weapon's reach plus `POSE_SLACK`, the striker is under its rate
  (the gate's `GATE_HIT_HZ_MAX` shape), and the damage is inside the bucket its sheet allows (the gate's `dpsRef`
  shape). Excess is clipped, as the gate clips it.
- **Speed is checked** in a siege room: a pose further from the last than the fastest legal travel (run, Speed
  attribute, spells) plus slack is refused and the fighter is pulled back. FACT: nothing checks this anywhere today.
- Spells: a damaging spell is a claim the relay validates against the caster's magicka budget and the spell's own
  cost, the way it bounds a melee blow.

### 6.2 The battlefield

- **The room** - PROPOSED: a siege is its own room, `siege:<mapId>:<week>` (the gate's `gate:<day>` shape), admitted
  only in its window and only to the two sides' registered fighters (and spectators, 6.6). The town is streamed as it
  is for everyone; the room is separate so the cell's ordinary traffic and the siege's never share a budget.
- **Palace seat** - PROPOSED: three **Banner points** (the town's main gate, its market square, its temple or
  largest open plaza - chosen by the seat law from the town's own layout) and the **Throne** (the palace door).
  Holding a banner is standing within 8 m of it with no living enemy there, for 20 seconds, refereed off the relay's
  own record of poses. The attackers must hold two of three banners to make the Throne capturable; holding the
  Throne uncontested for 120 seconds takes the seat. Time limit 30 minutes; at time, the holder keeps it.
- **Crown seat** - PROPOSED: four Banner points in the city and a **Gatehouse** before the castle entrance - a
  destructible objective with its own vitality, breached by blows (slowly) or a Ram (quickly, section 11) - then
  the Throne at the castle's door. Time limit 45 minutes.
- **Respawns** - PROPOSED: a fallen fighter returns after 20 seconds (palace) or 30 (crown) at their side's
  **camp**: the attackers' outside the town gate, the defenders' at the palace. Each side's respawn wave is shared,
  so a wiped side comes back together.

### 6.3 Scheduling and time zones

- **The window** - PROPOSED: the holder names a **standing window**: a 2-hour block, any day of the week, between
  16:00 and 04:00 UTC. The siege starts at the window's start on the first such day after the Turning. The holder
  may move it, but a move made within 48 hours of the siege does not apply to it.
- **Crown sieges** - fixed to one primetime slot, because three kingdoms' wars are the server's marquee event and
  should be one everyone can plan around. Mac's "Yes" accepted the record's times; the first record named no crown
  slot, so this one does, PROPOSED: **Saturday 20:00 UTC** (evening in Europe, afternoon in the Americas). Three
  crown sieges in one week run at 20:00, 21:00 and 22:00 in Daggerfall, Wayrest, Sentinel order, so one guild can
  never be asked to fight two at once.
- **The announcement** - the hub announces the siege at the Turning and 24 hours, 1 hour and 5 minutes before, in
  the server's voice (RED1's red text, and EVENT1's welcome record so a late joiner knows). On the map, a besieged
  seat's circle burns.

### 6.4 Sides and sizes

- DECIDED: crown sieges are bigger than palace sieges.
- PROPOSED: **palace 10 against 10; crown 20 against 20**. Warbands are parties (FACT: 8 a party), so a crown side is
  three parties. OPEN until measured: FACT, a room holds 256 sockets but its real ceiling "has never been measured"
  (AUDIT SLAM C1), and only 8 bodies are drawn in full. PVP-REF's slice must measure 40 fighters in one room before
  SEAT2 fixes the numbers.
- **Who may fight** - PROPOSED: members of the two guilds, and up to 2 (palace) or 4 (crown) **Sellswords** each - non-
  members hired under a signed contract the guildmaster issues. A sellsword's account must not be a member of the
  other side (4.4).

### 6.5 No-shows and forfeits

- **Defenders absent** - the attackers still have to take the banners and hold the Throne for its full 120 seconds.
  An empty town is not a free capture; it is a slow one.
- **Attackers absent** - no attacker in the room 10 minutes after the start: the siege is forfeit, the holder gains
  Standing and a Legacy boost, and the challenger's week of influence at the seat is lost.
- **Both absent** - the holder keeps the seat.

### 6.6 Spectators and the record

- PROPOSED: anyone may enter a siege room as a spectator (no body drawn to the fighters, no collider, cannot enter a
  banner's radius), capped at 60. Wars are theatre.
- Every siege writes its **record** - the sides, who fought, banner timings, the result - to the seat's history
  (section 9.2), readable in the palace's Hall of Records.

### 6.7 The Tourney (a contested unheld seat)

PROPOSED: when the Turning cannot separate two guilds at an unheld seat (5.2), the next week's window opens a
**Tourney**: the same battlefield with no holder and no Throne - the side holding more banners at the end of 20
minutes takes the charter (and pays the claim fee). A dead heat goes to the higher influence.

### 6.8 What a siege gives

| Outcome | Winner | Loser |
|---|---|---|
| Attacker takes the seat | The charter (Standing starts at 50); the Truce; the fortifications, each one tier down (7.5) | The charter; Legacy at the seat lost |
| Defender holds | Standing +15; next Turning's defence +20% | Influence at the seat cleared; cannot challenge it next week |

Every fighter who stood the siege (half its length, or felled at least one foe) earns a **Siege Honour** - a signed
receipt in the gate's `r1.` shape, claimed at the account service - worth Renown and a Professions reward (section 11).

## 7. Holding a seat

### 7.1 What a seat costs

- **Claim fee** - PROPOSED: palace 5,000 Marks, crown 50,000 Marks, from the guild's Marks treasury (5.2).
- **Upkeep** - PROPOSED: palace 1,000 Marks a week, crown 10,000 Marks a week, from the treasury at the Turning.
- **Overreach** - PROPOSED: each seat beyond a guild's first raises every seat's upkeep by 25%, and lowers its
  defence by 5%. Nothing forbids an empire; everything taxes it. OPEN: a hard cap (PROPOSED none; Mac may want one).

### 7.2 What a seat pays

DECIDED (the Holdings plan): the palace its hall, members' discounts, a share of the seat's fees, the banners and
colours, the map circle. DECIDED ("All of the above"): a crown seat pays more.

- **The Tithe** - DECIDED by the currency answer: the Tithe is a share of the **Marks** spent at the seat's town's
  Notice Board - the market's sales, its listing fees, writ fees and courier fees (PROF0 section 8). Gold purchases
  (homes, station licences, decor) stay the save's and are never tithed: a share of gold would be a Mark minted from
  gold a client may not have had. The holder sets the Tithe: palace **0-10%**, crown **0-15%**; it lands in the
  holder's Marks treasury. The payer still pays the listed price; the tithe is a share the service routes, not an
  extra charge - so a player never feels a seat as a tax on their purse, only a guild feels it as income.
- **Members' discount** - PROPOSED: 10% at the seat's shops, 15% at a crown seat's. Applied on the member's own
  client (their own gold; nothing to cheat but themselves).
- **The hall** - DECIDED ("the palace its hall"). PROPOSED: the palace's interior is the holder's guild hall - the
  guild's roster board, its treasury chest (the service's treasury, reached in person), a Charter Room the holder
  may decorate (DECOR's catalogue, the room's own furniture untouched), and the court left exactly where DFU stands
  it. Crown: the castle is the hall (DECIDED, "the castle as the guild hall") - its throne room the Charter Room.
- **A crown's uniques** - DECIDED ("All of the above"): a title and glyph, the castle as the hall, a map mark of its
  own. PROPOSED in 7.4.

### 7.3 Standing - the town's favour

PROPOSED: every held seat has a **Standing** from 0 to 100, starting at 50 when a charter is taken.

| Raises it | Lowers it |
|---|---|
| A low Tithe (below half its cap) - +2 a week | A high Tithe (above three quarters of its cap) - -3 a week |
| A Festival held (7.6) - +10 | A siege held only after the Throne was reached - -5 |
| A siege held - +15 | A gate in the region left unfelled - -5 each |
| Writs filled for the town - +1 a writ, capped +5 a week | Neglect (7.1) - -10 |
| A revolt put down (7.7) - +20 | Upkeep paid late - -5 |

What Standing does: it adds to the holder's defence at the Turning (**+0.5% a point above 50**, **-1% a point below
50**); at 80+ the members' discount rises by 5%; below 20 the seat is in **Unrest** (challengers earn +25% influence
there); at 0 it **revolts** (7.7).

### 7.4 Titles and glyphs from a seat

PROPOSED, DERIVED as every title is (`titles.js`): the service reads who holds what and grants accordingly - held
while the charter is, gone on the next token when it is not. No column stores them.

| Held | Title (guildmaster) | Glyph (every member) |
|---|---|---|
| A palace seat | "Warden of <Town>" | a small tower in the guild's colour |
| A crown seat | "Lord Protector of <Kingdom>" / "Lady Protector" | a crown - one glyph per kingdom (three) |
| Held a crown seat at a Season's end | "Crowned in Season N" (kept for good) | - |

FACT, the SHADOW-FANG lesson: a new title or glyph is new vocabulary in `identityToken.js`, so the relay must carry
it before the account service mints a token wearing it (`account-deploy.yml` waits on the relay's version).

### 7.5 Fortifications - a seat's memory

PROPOSED: a held seat can be **built up** with materials and gold (PROF, section 11). Fortifications belong to the
SEAT, not the guild: when the seat changes hands, each drops one tier and the rest stays. So a town that has been
fought over for a season is a rich prize, and a guild that builds is building for whoever holds it next.

| Work | Tiers | Effect (per tier, PROPOSED) |
|---|---|---|
| **Walls** | 3 | Siege: the defenders' camp respawn 3 s faster |
| **Gatehouse** (crown only; palace seats get it at tier 3 walls) | 3 | Siege: the gatehouse's vitality +50% |
| **Watchtowers** | 2 | The holder's guild is told the moment a challenger passes half the holder's influence |
| **Barracks** | 3 | Siege: relay-run town guards fight for the holder - 2, 4, 6 of them (the gate's brain with adds, 7.7) |
| **Market Hall** | 3 | The town's boards list 25% more; the tithe's cap +1% |
| **Shrine** | 2 | Standing +1 a week; the region's gate felled gives the holder +50 influence |
| **Forge / Workshop / Apothecary** | 2 each | Members crafting there: quality +1 step (PROF) |
| **Harbour** (coastal seats) | 2 | Ships (the Sea update) dock at the seat; a sea route for Travel Options' ports |

### 7.6 Edicts - one each week

PROPOSED: at each Turning the holder may proclaim **one Edict** for the coming week. Edicts are the seat's
replayability engine: the same town plays differently week to week.

| Edict | Tier | Effect |
|---|---|---|
| **Market Day** | Any | Everyone's prices at the seat's shops -10% (client-applied, the world price seam) |
| **Bounty** | Any | World of Daggerfall camps in the region pay double loot to anyone; the treasury funds a gold bounty per camp cleared (witnessed by WOD7's shared camps) |
| **Levy** | Any | 10% of gathering in the region's nodes (PROF) goes to the seat's stockpile |
| **Open Gates** | Any | Homes in the town may not be set private this week; Standing +3 |
| **Curfew** | Any | The town's guards are stronger at night; crime in town costs double legal reputation (client-side, each player's own) |
| **Festival** | Any | Costs 2,500 Marks (palace) / 10,000 Marks (crown); a town-wide buff, music and banners; Standing +10 (7.3) |
| **Royal Tourney** | Crown | A duel ladder at the castle all week; the winner earns a Season title |
| **Conscription** | Crown | Palace seats of the kingdom held by other guilds pay the crown 2% of their tithe (see 7.8) |

### 7.7 Revolt - when Standing hits zero

PROPOSED: a seat at Standing 0 revolts at the next siege window: a **relay-run** uprising (the gate's brain, with
simple adds - the "later" the gate record already named, `World-Bosses.md`) of townsfolk and a rebel captain at the
palace. The holder's guild must defeat it inside the window. Fail, and the charter lapses and the seat is unheld;
succeed, and Standing returns to 20.

### 7.8 Vassals (crown tier)

PROPOSED, a later slice (CROWN2): a palace-seat holder in a crown's kingdom may **swear fealty** to the crown's
holder. A vassal pays the crown 5% of its tithe; the crown's kingdom reach (4.3) adds to the vassal's defence at the
Turning; a vassal cannot challenge its liege's seats and vice versa. Fealty is broken by either side at a Turning,
with a Standing cost to the breaker. This is where the arc becomes politics.

### 7.9 The seat on the Notice Board

DECIDED (Mac: "The new notice board should be a physical object that houses quests, the player auction house,
etc"). The board is designed in PROF0 section 8; this is what it carries for a seat, on its **Seat** tab, at every
board in the seat's town:

- the holder (their banner and device), Standing, the Tithe, this week's Edict and its effect;
- the week's **standings**: every pledged guild's influence at this seat, live, and the claim and defence thresholds;
- the **siege**: the Right of Siege, the window, the countdown, the sides' rosters as they sign;
- the **stockpile**: what each fortification's next tier still needs, each need a writ on the board's Work tab;
- the **Chronicle**: the seat's history (9.2) as notes pinned to the board, the newest on top;
- for the holder's officers, the levers: the Tithe, the Edict, the window, writs from the treasury.

A seat is run from its town's board, in person. That is the point of a physical board: the war has a place.

## 8. What a guild grows

### 8.1 Heraldry - GUILD1d's other half

PROPOSED: a guild gains **two colours** (from a fixed, readable palette of 16, so no two circles on the map read the
same at the map's scale) and a **device** (one of the port's own drawn charges - wolf, tower, sun, crown, blade,
serpent, eye... - never a render of game data). Chosen by the guildmaster; changing it costs gold and is refused
during a siege week. It appears on banners, the map ring, the guild tag's frame, the siege HUD and the Hall of
Records.

### 8.2 The guild hall (GUILD1d)

FACT: planned as "a guild-owned home" and not built; `HOME_ENTRIES` lacks the planned `guild` entry. PROPOSED:
GUILD1d lands BEFORE seats - a guild may own one home as its hall (bought from the treasury, entry `guild`, decor by
Officers), and the guild entry joins private/party/public for every home. A guild that later holds a seat keeps its
own hall and gains the palace as well.

### 8.3 Pacts

PROPOSED, a later slice (PACT1): two guilds may sign a **Pact of non-aggression** for a Season: neither may pledge
against a seat the other holds. Breaking it early is allowed and announced to the whole server.

## 9. Seasons, history and replayability

### 9.1 Seasons

PROPOSED: a **Season** is 8 weeks. At its end:

- every crown holder earns the lasting title "Crowned in Season N" (7.4);
- every seat's fortifications drop one tier (the world wears), Legacy is cleared, and Standing returns toward 50 by
  half its distance - the board is re-opened without being wiped;
- the Season's **Chronicle** is written (9.2).

OPEN: whether a Season ends with a full reset (every charter lapses) instead. PROPOSED no: holding across Seasons is
a story the server should be able to tell.

### 9.2 The Chronicle and the Hall of Records

PROPOSED: every Turning, claim, siege, revolt, edict and change of hands is a row in the seat's history (the account
service). A **Hall of Records** book in every seat's palace (and the three castles) reads it - through the enhanced
book window the port already has - as prose: "In the third week of the Season of the Hearthfire, the Silver Hand
stormed the gates of Anticlere and took its Charter from the Ebon Oath after thirty-one minutes." The server's
history, told in the game's own voice.

### 9.3 Tides - the world moves under the war

PROPOSED: each week the shared clock rolls a **Tide** for each kingdom (a pure function, the gate's way): a Harvest
(material yields +25% there), a Plague (Watch presence counts half), Orc Raids (WOD camps doubled), a Daedric
Incursion (the region's gates open twice a day, gate kills worth double influence), a Royal Wedding (Festival costs
halved)... The same seat is a different war each week, and nobody - not the holder, not the challenger - picks it.

### 9.4 Why a guild comes back

A list, because replayability is the brief: a weekly pledge decision; a weekly edict; a Tide that changes the
calculus; a Standing to manage; fortifications that persist and are worth stealing; sieges with a schedule to
rally for; a Season with a crown at the end; titles that are held only while held; a Chronicle that remembers; and
the Professions economy (section 11) feeding every one of them.

## 10. The threats, and the answers

| Threat | Answer |
|---|---|
| A modified client inflates Renown | Renown is the weakest source, capped at 400 a character a week (4.2) |
| A modified client fakes a blow, a speed or a position in a siege | PVP-REF: the relay referees every blow and checks speed (6.1) |
| One account feeds two guilds | Per-account war (4.4, OPEN) |
| A guild farms its own alt challenger for Standing | A forfeit gives Standing only once a Season against the same challenger; influence thresholds make a fake challenger expensive |
| A parked tab farms the Watch | Presence needs movement and caps at 60 a day (4.2) |
| A zerg guild takes everything | Per-character caps (4.2), Overreach (7.1), fixed team sizes (6.4), Unrest (7.3) |
| A holder schedules sieges at 4 a.m. for the challenger | A standing window between 16:00 and 04:00 UTC, set 48 hours ahead (6.3); crown sieges at one fixed primetime |
| A holder hoards and never builds | Upkeep, Standing, revolt (7.1, 7.3, 7.7) |
| The service's week-settle races two readers | One transaction, idempotent, keyed by (seat, week) (5.2) |
| A fake seat | The witnessed registry (3.2) |
| A relay older than the vocabulary | The SHADOW-FANG order: relay version first, account service waits on it |
| A modified client fakes the gold behind a claim fee, upkeep or Tribute | Closed by the currency answer: every seat cost and Tribute is in Marks, which only the server holds and only server-witnessed acts mint (`06-Systems/Professions-Arc.md` 8.5); gold never becomes Marks |

## 11. Where the Professions arc meets the seats

`06-Systems/Professions-Arc.md` (PROF0) designs the life skills and materials. The seats are what gives them a
purpose beyond a player's own pack:

| Seat side | Professions side |
|---|---|
| Writs (4.2) - influence for supplying a seat | Gatherers and crafters fill them from the Stores |
| Fortifications (7.5) - built from materials | Masonry and Carpentry (and Smithing for the gatehouse's iron) |
| The Ram and siege works (6.2) | Carpentry and Smithing craft them; a siege consumes them |
| The Levy edict (7.6) | Gathering in the region feeds the seat |
| A region's signature material (PROF) | The seat that holds the region taxes the richest nodes |
| The market on the Notice Board (PROF0 8.2) | The seat's Market Hall and Tithe |
| Forge / Workshop / Apothecary (7.5) | Crafting quality bonus for the holder's members |
| Siege Honours (6.8) | Paid partly in rare materials only war yields |
| The Seat tab on the Notice Board (7.9) | The Work tab's writs and the market's Marks - the same physical board (PROF0 section 8) |

## 12. The server's shape (a sketch for the build slices)

PROPOSED, to be refined by each slice:

- **Account service (D1)**:
  - `town_seats` (map_id PK, region, tier, name, confirmed, holder_guild, held_since, standing, tithe, edict, window,
    forts JSON, legacy JSON)
  - `town_seat_reports` (map_id, account, report hash) - the witnessed registry (3.2)
  - `town_seat_pledges` (week, guild_id, region, map_id)
  - `town_seat_influence` (week, map_id, guild_id, account, source, amount) - summed on read, capped on write
  - `town_seat_history` (seq, map_id, week, kind, data JSON) - the Chronicle
  - `town_seat_sieges` (week, map_id, attacker, defender, starts_at, result, receipt)
  - `guilds` gains `colours`, `device`, and a Marks treasury beside its gold one (PROF0 8.5's ledger)
  - the Renown report gains `region`; a `renown_region_week` sum beside the track
- **Relay**: `siege:<mapId>:<week>` rooms, admitted in their window (gateLaw's pattern), stepped by Durable Object
  alarms as the gate's brain is; the Watch counter in cell rooms; signed siege receipts (`s1.`, Ed25519, the gate's
  shape) and Honours.
- **Law modules (pure, imported by client, relay and service alike)**: src/net/townSeatLaw.js (to be written) (the tiers, every
  number in this page, the week, the phases, the window rules), src/systems/townSeats.js (to be written) (the client's derivation
  from MAPS.BSA, beside `regionHubs.js`).
- **Versions**: every relay change a new `RELAY_VERSION` with its LAW row; every token vocabulary change relay-first.

## 13. The slices, in order (PROPOSED)

| Slice | What | Needs |
|---|---|---|
| **SEAT0** | This record | - |
| **SEAT-COUNT** | The count tool (3.1), the Province faction tree printed (4.3) | ARENA2, run by Mac |
| **GUILD1d** | Guild halls, guild entry for homes, heraldry (8.1, 8.2) | - |
| **SEAT1a** | The seats derived on the client; the witnessed registry; map rings (hollow/filled/crown); arrival lines | SEAT-COUNT |
| **SEAT1b** | Influence: pledges, the Watch, gate kills, homes, Renown with region, Tribute; the standings view | SEAT1a |
| **MARKS1** | The server currency and its ledger (PROF0 8.5) | - |
| **NOTICE1** | The Notice Board: DFU's own board online, its first tabs (PROF0 section 8) | - |
| **SEAT1c** | The Turning; claims; the charter; banners; titles and glyphs (relay first); the board's Seat tab (7.9) | SEAT1b, GUILD1d, MARKS1, NOTICE1 |
| **SEAT1d** | Upkeep, Tithe, discounts, Standing, Edicts, Neglect | SEAT1c |
| **PROF1..** | The Professions arc's own slices (its page) | In parallel from SEAT1a |
| **PVP-REF** | The refereed blow and speed check; a 40-fighter room measured | - |
| **SEAT2a** | Siege rooms, banners, the throne, windows, forfeits, spectators, Honours | PVP-REF, SEAT1c |
| **SEAT2b** | Fortifications, Barracks guards, the Ram, the Gatehouse | SEAT2a, PROF (Masonry, Carpentry, Smithing) |
| **CROWN1** | The crown tier's uniques, kingdom reach | SEAT2a, the kingdom map (4.3) |
| **CROWN2 / PACT1** | Vassals, pacts | CROWN1 |
| **SEASON1** | Seasons, the Chronicle, the Hall of Records, Tides, revolts | SEAT1d |

Each slice ships as the repo ships everything: pins that fail under a one-character mutation, the four hosts named,
the bible updated in the same change, a Port-Ledger section A row when the first seat is held.

## 14. OPEN - Mac's questions

Answered on 2026-09-28 and folded in above: the registry (the quorum, 3.2), the kingdoms (drawn, 4.3), per-account
war (4.4), the Turning (Sunday 18:00 UTC, 5.1), the currency (Marks). Still open:

1. **The seat count** (3.1): run SEAT-COUNT when it exists; every number here is tuned to it.
2. **The Marches and the Free Lands** (4.3): keep Betony, Anticlere and Lainlyn as marches, and Balfiera and Orc
   country as free lands?
3. **Crown sieges' slot** (6.3): Saturday 20:00, 21:00 and 22:00 UTC?
4. **Siege sizes** (6.4): 10v10 and 20v20 to start, subject to PVP-REF's measurement?
5. **Overreach** (7.1): taxes only, or also a hard cap on seats a guild may hold?
6. **Season end** (9.1): a soft reset (PROPOSED) or a full one?
7. **A siege and the save** (6.1): PROPOSED a siege never costs the save health, items or gold. Keep?
8. **Every PROPOSED number** in this page: accept as the starting table, or change any now?
