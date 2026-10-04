# The Sea Serpent - Sethrakul, the Old Coil (SERPENT1)

> Design page and record of the slice, written 2026-10-04 as it shipped. The code's comments cite this page by
> section number; where the page and a pin disagree, the pin is what runs.

## What Mac asked for

Mac, 2026-10-04: *"I want to talk about developing a new world boss. The sea serpent. A new world event that
requires players with a ship to meet up and take on a large scale sea serpent in the ocean."* Then, handing over every
decision: *"You make the decisions and online only. I trust your instinct. Be as detailed as possible and make this
something truly special."*

So, as decided here:

- **Online only.** Like the gate, the serpent is a fact about the shared world: the relay keeps its fight, signs each
  fighter's kill and the account service pays for it. Offline there is no serpent.
- **A ship's fight.** It lives on the open sea and is fought from decks with the guns the naval fight already has
  (`03-World/Naval-Combat.md`). A player with no ship can still crew another player's ship and earn a share by
  standing the fight out (section 8).
- **One beast, named.** SETHRAKUL, the Shed-Skin of Satakal, whom the Bay's sailors call the Old Coil. The Redguards say
  Satakal, the World-Skin, sheds the world as a snake sheds its skin, and that not every skin he leaves behind is
  dead. The table (`SERPENT_BOSSES`) holds one serpent now, so a later slice can add more without a new mechanism (the
  gate's `GATE_BOSSES` law).
- **The gate's trust model, Option B** (`World-Bosses.md`): the relay's Durable Object is the authority over the
  boss. Its health, its swim, its attacks and its kill are the relay's. Each blow it lands is judged on the struck
  player's own machine.

Daggerfall has no other players and no sea serpent, so none of this is a DFU member. Its Ledger A row is SERPENT1.

## The shape, end to end

```
 the event clock ─► the SIGHTING (02:00) ─► it RISES (05:00) ─► the STORM closes its waters (08:00) ─► it SOUNDS (10:00)
   (no frame)        chat line, map ring     ships sail in, `in`    no newcomer; the fight goes on        unslain: gone
                     compass in the ring          │
                                                  ▼
                        the CELL ROOM its site stands in keeps the fight (brain on the cell's alarm)
                                                  │  every 250 ms: its swim, its attacks, its phases
   the account ◄── claim ◄── RECEIPT `l1` ◄── the KILL ──► the hub ──► everyone online hears it
   service (D1)     │        (signed)           │
                    └──► the HOARD (rolled from the receipt's seed) and RENOWN for the character that fought
```

## 1. The schedule - a function of the clock

The serpent runs on the gate's event clock (WORLD5's shared clock at TimeScale 12, a game day every two real hours;
`net/serpentLaw.js`). A serpent rises every `SERPENT_EVERY_DAYS` (2) game days, on the odd days (`SERPENT_DAY_PHASE`
1). That is once every four real hours, at the same six UTC times each day, so every timezone's evening holds one.
It takes the dawn watch, the gate's quiet half of the day, so the two never stand at once.

| game time | real time (UTC, every 4 h) | what |
|---|---|---|
| 02:00 | HH:02:30 | **the sighting**: the chat line, the map ring |
| 05:00 | HH:17:30 | **it rises**: its waters open to every ship, the fight begins (it surfaces over `SERPENT_SURFACE_MS`, 12 s) |
| 08:00 | HH:32:30 | **the storm closes its waters**: no newcomer joins, the ships already in it fight on |
| 10:00 | HH:42:30 | **it sounds**: unslain, it dives over `SERPENT_DIVE_MS` (15 s) and is gone |

(HH is 03, 07, 11, 15, 19 and 23.) That gives fifteen real minutes from the sighting to the rising, fifteen to
reach it, and twenty-five minutes of fight at most. Every client and the relay compute the same instants with
nothing sent (`serpentTimes`, `serpentPhase`: quiet, omen, rising, hunt, late, slain, sounding, gone). A kill makes
the phase `slain` for `SERPENT_DIVE_MS` (its death throes), then `gone`.

## 2. The sighting - the chat, the ring, the compass

`systems/serpentOmen.js` (`createSerpentOmen`), one call a frame from the online frame. It says nothing until the
relay's clock is read and the hub has welcomed the player (AUDIT WB C4's law), then waits `SERPENT_OMEN_SETTLE_MS`
more. Each line is said once a day, in order. A player arriving late hears only the line for where it stands now:

- the sighting - *"Bells ring in the harbours: a great serpent is sighted off Sentinel, Sentinel. Sethrakul rises at
  04:17 your time."* (the place is the nearer port and its province; the time is this machine's local time, as the
  gate's lines are);
- the rising - *"Sethrakul rises off Sentinel. The storm closes over its waters in 15:00."*;
- the storm closing - *"A storm closes over Sethrakul's waters off Sentinel. It sounds at 04:42 your time."*;
- the sounding - *"Sethrakul sounds off Sentinel and is gone into the deep."* (never said of a serpent slain).

The kill's line is the HUB's word (section 8): *"Sethrakul is slain off Sentinel by Ama, Bryn and Cass. The sea gives
up its hoard."* Each client names the place from its own site.

**The ring.** `mapMark()` gives a ring `SERPENT_RING_PIXELS` (3) map pixels across, its centre pulled up to
`SERPENT_RING_SHIFT_PIXELS` (1.2) off the site by the day's roll, so the ring marks the waters and not the spot. Its
label says the countdown, and its card names the serpent, the port it lies off and the packet lane it hunts. The held
map draws it with the gate's own reader and painter in the sea's colours (`ui/serpentMapMark.js`, `ui/inkMap.js`
`paintGateRing`'s `ink`, `ui/heldMap.js`: the legend's "Sea serpent", the card under the pointer). The classic region
page draws no serpent: a province's sheet shows little of the open sea it hunts.

**The compass.** Inside the ring, the enhanced HUD's strip carries a sea-green diamond where it hunts
(`ui/enhancedHud.js` `drawSerpentMark`, `scenes/world.js` `serpentCompassMark`).

## 3. Where it rises - the packet lanes

`systems/serpentSite.js` (`findSerpentSite`). The serpent hunts the Bay's packet lanes (`systems/naval/seaLanes.js`):
the lanes between the map's ports, the same list on every client, made from map files every client holds. The day
rolls a lane (`serpentLaneOf`) and a place along that lane's way (`serpentAlongOf`, inside `SERPENT_ALONG`, 0.3 to
0.7 of its length). A place is kept only where the sea is open all round it: every map pixel within `SITE_CLEAR_PX`
(1) must be the ocean's water (the lanes' own `open` law, never a lake). If not, the place slides along the way up to
`SITE_SLIDE` (0.16) each side. A lane shorter than `SITE_LANE_MIN_M` (six map pixels) is skipped. After
`SERPENT_LANE_TRIES` (24) lanes with no site, there is no serpent that day, and the omen stays silent rather than name
nowhere.

The site is the native point the fight is framed about (`sx`, `sz`). Its card names the nearer port, the port's
province and both ports the lane joins. A client with no map data yet asks again every `SITE_RETRY_MS` (5 s).

**The relay never reads a map.** The first `in` it hears names the site (section 6). Its own cell must hold that site
(`cellRoomOfWire(sx, sz)` is the cell's key), so a correct client always says it in the right room. The account
service's one row per (day, account) bounds what a forged site could buy.

## 4. The body - a path, not a physics

`net/serpentBody.js`, shared by the relay and every client, so both draw the same serpent from the same words.

- **The head runs LEGS**: lines and arcs at a constant speed (`legAt`, `headAt`). An arc's centre lies `r` to its
  side (`sd` is +1 for a right turn, -1 for a left). A jump leg (`j`) starts a fresh track: the coil's wind and the
  maelstrom's orbit.
- **The body follows the head's track** back by arclength (`spinePoint`). It has `SEG_N` (24) segments of `SEG_LEN`
  (7 m), 168 m in all, with radii tapering from the head to a tail fin (`radiusAt`).
- **How it rides the sea** is a mode, each change blended over `MODE_BLEND_MS` (1.5 s):
  - `deep`: under the sea, `DEEP_Y`.
  - `cruise`: humps break the surface, `HUMP_L` (46 m) waves along it, the head just over the sea.
  - `breach`: the head thrown up `BREACH_Y` (12 m), the neck arched out.
  - `rear`: the head high, `REAR_Y` (24 m).
  - `coil`: the track sinks to `DEEP_Y` and the body winds `COIL_TURN` (0.92) of a turn about the coiled ship at
    `COIL_R` (22 m), its head reared `COIL_HEAD_Y` over her.
  - `dying`: its throes.
- **What may be struck.** A segment more than `EXPOSED_M` (0.4 m) above the sea is a target (`segExposed`). Its
  oriented box (`segmentBox`) is a target among the naval shots' own (section 7). The head counts as **thrown up**
  only while it breaches, rears or is stunned (`headExposed`), and only then does a ball on it land `HEAD_X`.
- The relay keeps `LEGS_KEPT` legs and `MODES_KEPT` modes, pruned by time and never by count alone, so the body never
  loses the track it lies along.

## 5. Its blows - judged on the struck ship

The brain says each attack's shape, its landing time and its target (`atk` words). Every client tests its own ship and
its own feet against it (`systems/serpentStrike.js`). The relay never learns a ship's hurts: this is co-op's victim's
law, which the naval fight already keeps.

| attack | phase | shape | wind-up | what it does |
|---|---|---|---|---|
| Tail Lash | 1 | sector, 85 m, 120 degrees | 2.6 s | 14% of her hull + 18, canvas, three men; a throw |
| Breaching Ram | 1 | lane, 18 m wide | 3.6 s | dives, then runs its lane at `RAM_V` (34 m/s); 22% + 30; a throw across the lane |
| Rising Maw | 1 | disc, 20 m | 3.2 s | dives, and bursts up under its mark, running in on it the last `BREACH_LEAD_MS` (1.2 s); 18% + 24; a throw |
| Venom Spit | 1 | disc, 13 m | 2.6 s | a glob flies `SPIT_FLIGHT_MS`; a venom pool stays 9 s and bites anyone standing in it (5% of their health + 3, each second) |
| Constrict | 2 | ring, 36 m | 4.8 s | the coil (below) |
| Abyssal Roar | 3 | rings, 22 to 120 m | 2.8 s | safe close in under its jaws; 10% + 14 and the canvas torn |
| Satakal's Call | the turn to 2 | none | 2.6 s | its cry as it turns |
| The Maelstrom | the turn to 3 | none | 5 s | the whirl forms (below) |

**A blow's hurt is a share of HER whole hull and canvas, with points on top** (`shipHurt`, TOUGHER-SHIPS' law). A
rowboat and a carrack feel each blow alike. A shape meets a ship at her bow, her middle or her stern, with her beam as
slack (`shipPoints`), because a carrack is fifty metres long. The ram meets her only once its head has run as far as
she lies (`shapeMeets` at `t`). The coil's ring takes her middle alone.

**The throw** (`shoveOf`) pushes her away from the blow (across the ram's lane) and dies away over `SHOVE_S` (2.5 s).
It is carried by Come Sail Away's new `drift` seam (section 7).

### The coil

At 66% the serpent turns (section 6) and winds about the ship it hates most. Her own machine judges whether she was
inside the ring at the landing:

- **Inside**: she says `held` with her hull's middle. The coil closes onto her, and the warp seam holds her where it
  took her, her way off and her helm dead.
- **Outside**: she says `esc` within `COIL_ESC_MS` (3 s), and it closes on empty sea.

The coil has its own health: `COIL_TEAM_S` (6) seconds of every fighter's broadside, at least `COIL_HP_MIN` (60).
While it holds, it grips her every second (`gripHurt`: 2.5% of her hull + 3, and 0.4 men, the fractions carried so
3.4 a second is 3.4). Then one of two things happens:

- **The ships' fire breaks it**: blows on a coil segment go to the coil's health. It lets go and lies **stunned** for
  `SERPENT_STUN_MS` (9 s), with no attack, its head thrown up and every blow `STUN_X` (1.5) heavier. The ball that
  breaks it is named: *"Ama breaks the coil! Sethrakul reels, stunned - strike its head!"*
- **Left whole for `COIL_MS` (24 s), it CRUSHES her** (`crushHurt`: 35% + 40, a fifth of her canvas, five men).

The client holds her on its own judgement until the relay's word of the coil arrives (`COIL_WORD_WAIT_MS`, 2.5 s, the
next beat and the wire), and lets her go if it never does. A coil whose end is never heard lets her go
`COIL_LOST_MS` (4 s) past its time, so a lost socket never holds a ship forever.

### The maelstrom

At 33% the whirl forms at its waters' heart (`maelPull`). Over `MAEL_GROW_MS` (4 s) it grows to pull every ship
within `MAEL_R` (230 m) toward its heart, at 1.2 m/s at its edge rising to 5 m/s near the eye, and round it at up to
`MAEL_SWIRL` (4 m/s). In the eye (`MAEL_EYE_R`, 40 m) it grinds her hull (3% + 2 a second). The serpent circles the
eye reared, at `MAEL_ORBIT_R` (85 m), and roars from it. The pull rides the `drift` seam. Her own helm still answers,
so she sails out of the whirl or she does not.

## 6. The relay's arm - the fight in the cell of its site

**Where it lives.** The fight lives in the CELL ROOM (`world:x,y`, a 16-pixel shard) its site stands in. It is not
a room of its own, because naval sync and the halo are already there: a ship within `ADMIT_R` (1500 m, under two map
pixels) of the site always holds that cell, as its own room or as a halo (`RANGE_PIXELS` 3). Words go out on whichever
socket reaches it (`net/online.js` `sendSerpent(word, cell)`, `serpentReady(cell)`).

**The brain** (`net/serpentBrain.js`) is pure law: no clock of its own, an `rng` handed in, no I/O. The relay
(`server/src/index.js`) owns the sockets, the alarm, the storage and the receipts:

- **The beat** steps it every `SERPENT_TICK_MS` (250 ms) on the cell's alarm. The cell's own duties (the raids, the
  rite, the world's memory) still run every `SERPENT_REST_MS` (5 s) and on their own firings. The alarm is the
  sooner of the two (`_alarmRest`), and a cell with no serpent keeps its alarm as before.
- **The checkpoint** goes to storage every `SERPENT_CHECKPOINT_MS` (2 s) as plain numbers and strings, so a woken
  object steps on exactly as the one that slept. The fight is forgotten `SERPENT_KEEP_MS` (2 h) after its sounding.
- **Its words** reach every fighter and every socket within `FAN_R` (3000 m), so a watcher on a headland sees it.
  The words are: the whole state `st` (to a joiner), a swim leg `sw`, a depth `dv`, an attack `atk`, health `hp`, a
  phase `ph`, the coil's `coil`/`ch`/`cb`/`cr`/`cx`, the maelstrom `mael`, the kill `fell` (with its damage chart
  `dm`), the sounding `gone`, a refusal `no`, and a receipt `rcpt`.

**The join** (`in`: the day, the client's brain law `bv`, its level, its hull at its helm (`hl`, -1 aboard another's)
and the site). The relay refuses:

- an older law, with `reload`;
- another day, with *the serpent is gone*;
- a pose past `ADMIT_R`, with *too far from its waters*;
- after 08:00, with *the storm has closed its waters* (a newcomer is shown the fight and refused);
- a full fight (`SERPENT_FIGHTERS_MAX` 128) that frees no idle seat, with *the waters are full*;
- a site in another cell, as junk.

**What a fighter brings and may deal.** Each fighter's hull claim sets both, so no claim buys a faster kill (the
gate's law at sea). The hull's reference broadside a second (`SHIP_REF`: rowboat 0, Large Boat 5, Small Ship 10,
Large Galley 13, Carrack 12) sets:

- the health it brings: `SERPENT_TTK_S` (180) seconds of it, at the fight's current fraction for a late ship;
- its damage bucket: refilled at 3 times the reference a second, 20 deep, no one blow over 14;
- `SERPENT_HIT_HZ_MAX` (6) words a second.

A blow is believed only from where the socket's own pose stands: within `ENGAGE_R` (900 m) plus slack, and within a
gun's reach (`GUN_REACH_M` 300 m) of something of it above the sea. A hand aboard another's ship brings and deals
nothing with guns it does not have.

**Its mind.**
- It surfaces and circles for `SERPENT_OPENING_MS` (10 s) before it strikes.
- It goes at the ship with the most threat `SERPENT_THREAT_PICK` (60%) of the time, otherwise a random one. A ship is
  always picked over a hand.
- It orbits its target and keeps its head within `ARENA_R` (420 m) of its waters.
- It never uses an attack more than twice running, and leaves out the last one while another is open.
- At 66% and 33% it stands warded for `SERPENT_SHIELD_MS` (4 s) and takes its turn (`SERPENT_PHASE_TURN`):
  - Phase II, The Coil: the Call, then a coil on the most hated ship.
  - Phase III, The Maelstrom: the whirl, then the Roar from the eye.

## 7. The client's half - the serpent host

`scenes/serpentHost.js` (`createSerpentHost`). Every seam it touches is in its `deps`, so the whole of it runs in Node
under the pins. Its job:

- **The `in`** is sent once my ship is within `ADMIT_R` of the site, to the cell of its site. It is sent again every
  `IN_RESEND_MS` (20 s), or every `IN_RETRY_MS` (3 s) while unanswered.
- **My balls on it.** The naval host (`scenes/navalHost.js`) adds its exposed segments to the shots' targets as
  `serpent:<segment>`. A ball or barrel of MINE that strikes one gives its gun's own harm (my Guns refit's with it) to
  `struck`. The host gathers them for `HIT_GATHER_MS` (500 ms) into one `hit` word per zone: the head while it is
  thrown up, a coil while one holds, otherwise the body. Anyone else's balls are their own machine's to say. Its
  segments also redden the broadside's aim, and they count as a hostile near, so no rest, no time scale and no yard
  in its waters.
- **Its blows on MY ship and MY feet** (section 5). The hurt goes through the naval host's `serpentStrike` (the deck's
  shake, the line, the hull's mending as any hit's). The spray and the sound of every landing play for everyone.
- **Come Sail Away's two seams:**
  - `warp`, which QUAYS gave the harbour: the naval host's warp answers the coil's hold first.
  - `drift`, new: a world-space velocity added to the sea's current under her, which carries the whirl's pull and a
    blow's throw (`systems/comeSailAway.js` `lateUpdateSailing`).
- **Leaving**: going offline forgets the fight and lets my ship go (`leave`).

**THE FOUR HOSTS RULE.**
- `scenes/world.js` wires it whole.
- `scenes/exterior.js` (the `?exterior` bench: no relay, no packet lanes, no naval host) carries none of it, by
  design.
- `scenes/worldModes.js` (a building's interior: no sea) carries none of it, by design.
- `scenes/dungeonContext.js` (a dungeon's water is no ocean, and no ship sails it) carries none of it, by design.

A player who steps into a building mid-fight keeps their ship's hold; the bar and the blows wait for the street. The
pin `test/serpent1_client.test.js` reads the three and finds no serpent in them.

## 8. The kill - receipts, the books, the hoard

**Who earned it** (`serpentEarned`): a ship that dealt `SERPENT_RECEIPT_SHARE` (2%) of its own share, or anyone who
stood within `ENGAGE_R` for `SERPENT_STOOD_SHARE` (half) of the fight. The kill is stamped once, with its three best
dealers and the damage chart.

**The receipt** (`net/serpentReceipt.js`, version `l1`). Ed25519, signed by the relay's one key (`GATE_SIGNING_KEY`),
the version inside the signed bytes. It is refused by the gate's (`r1`) and the raid's (`w1`) verifiers, and theirs by
this one. Its claims are:

- `d` the day, `b` the serpent, `s` the account;
- `c` the hoard's seed (32 bits of the relay's CSPRNG);
- `x` how it was earned: `dealt` or `stood`;
- `h` the hull it fought from, `l` the level it was admitted at;
- `i` issued, `e` expiry: a week.

It goes to each earner's socket at the kill, and again at their next `in` while the cell keeps the fight. The relay
then tells the hub (`/internal/serpent/fell`, retried every 5 s until it answers). The hub says the kill to every
socket online, and to every hello while its day holds.

**The books** (`server-account/src/serpents.js`, migration `0078_serpent_kills.sql`, `ACCOUNT_VERSION` acct75,
route `/v1/serpent/claim`):
- The session is the claimant, never the body.
- Each kill is one row per (day, account) in `serpent_kills`, paying the character that fought it
  `RENOWN_SERPENT_QUESTS` (6) quests' Renown at the top quest level, twice a town defended.
- A level that rose comes back with a signed order for the rooms.
- A guest is not counted, but is given its hoard once.
- The account card and the inspect answer say `serpents: { slain }`.

**The hoard** (`systems/serpentSpoils.js`, rolled on the receipt's seed so every crew's is its own):
- gold: `SERPENT_SPOILS_GOLD_PER_LEVEL` (160) a level, the seed varying it a fifth either way;
- a ship that **dealt** also gets one piece Rare or better (Legendary 15% of the time) and one Magic or better;
- a ship that **stood** gets the Magic-or-better piece alone and `STOOD_GOLD` (60%) of the gold.

Every piece is known, and the ladder's last pass is applied (LOOT2). It is given when the service says this claim's
device holds the (day, account)'s hoard row (`serpent_spoils`, the raids' AUDIT RAID R4 law), so a second browser or a
phone is answered no. It goes straight into the pack through a spoils pool under its own keys, and rides the crash's
records until a save holds it. The device carries the receipt (`net/serpentClaims.js`) with the character that fought
it until the service settles it.

## 9. What a player sees and hears

**The body** (`render/serpentRender.js`, `SerpentRenderer`). Two foreign passes on the world host:

- **The body**, with the opaque world before the sea's top. A tube swept along the 25 spine points (Catmull-Rom,
  parallel-transport frames, four sub-rings a segment, a flattened twelve-sided section), with the snout's cap, a
  dorsal sail, horns, eyes and the venom's glob. Its hide is banded, with a darker skull and a pale belly. It is lit as
  the frame is and fogged by `FOG_GLSL`, with the travel view's focus and the deep's fog. The sea's surface over it
  hides what lies under.
- **The sea's marks**, after the sea, premultiplied: each attack's shape filling toward its landing, the maelstrom's
  spiral, and the venom's pools.

The naval host's spray answers its landings (`serpentFx`): the breach's column, the lash's sheet, the ram's bow wave
and the venom's spatter.

**The bar** (`ui/serpentBar.js` `serpentBarModel`) is the gate's boss bar in the sea's colours:

- its name over its title, its health with the two phase marks cut in it, the phase's name, the ward;
- the attack it winds up, named in its colour with a line filling to the landing, and **MOVE** when it is laid on my
  ship; its stun, counting down;
- the coil's health (*"Its coils hold YOUR ship"* on the coiled ship);
- the ships in its waters;
- the countdown to its sounding inside its last five minutes, pulsing in the last one.

After the kill the bar holds a moment and fades.

**Its voice** (`systems/serpentSounds.js`). DAGGER.SND's own records, with no new clip and no game data in the repo
(Port-Doctrine):
- the Dreugh's bark (the Bay's own sea-thing) pitched down an octave and more, for its roar (heard 3.2 km off) and
  its death cry (4.2 km);
- the Lamia's hiss for the spit and the coil;
- the sea's large splash and bubbles (`NAVAL_CLASSIC`), deep and loud, for the breach, the lash and its dives.

## 10. Trust and its bounds

- The relay believes a blow only as far as the fighter's claimed hull allows (the bucket, the cap, the rate), and only
  from where its own pose stands. A hull claim can be a lie. It buys no faster kill, since the health it brings grows
  with it.
- A forged site can only stand a fight in the cell that holds it, and the account service counts one serpent per
  (day, account) whatever site it was fought at.
- The struck ship's hurts never leave its machine. A client that ignores a blow cheats only itself (co-op's law).
- A receipt is signed. The service verifies it and keys it on the day and the account, never on its seed.

## 11. Versions and deploy order

- **The relay: `world162`.** The `serpent` frame (`net/wire.js` `validSerpentIn`, `validSerpentOut`,
  `SERPENT_RELAY_MIN`). `serpentLaw.js`, `serpentBrain.js`, `serpentBody.js` and `serpentReceipt.js` join the bundle.
  A relay before it closes the socket on the frame, so a client sends one only to a relay that welcomed it with 162
  or later (`serpentOk`).
- **The account service: `acct75`.** Apply migration `0078_serpent_kills.sql`, then deploy (the deploy's path filter
  carries `src/net/serpentReceipt.js`). Before acct75 the route answers nothing and a receipt waits on the device for
  its week.
- **The order:** the relay first (it signs), then the service (it counts), then the client. A client on an older
  relay sees the omen and no fight.

## 12. Not done, and why

- **The classic region page draws no ring**: the held map, the chat and the compass carry it.
- **No new audio file**: its voice is the game's own records, pitched and placed.
- **Seen in Node, not in a browser.** The renderer's builders, the host, the brain and the relay are pinned in Node;
  the passes have not been looked at in Chromium. Its first sighting on the live relay is its first look.

## 13. Records

- `test/serpent1_law.test.js` (22): the schedule and its words, the body, the brain - every refusal, the bucket and the
  one-blow cap, the phases, the coil, the end, the checkpoint, the swim.
- `test/serpent1_relay.test.js` (10): the receipt, the wire, the relay's join, refusals, blows and kill, the hub's word
  at a hello, the cell's other duties under its beat, the books and the Worker.
- `test/serpent1_client.test.js` (15): the site, the link, the strike, the sighting, the host end to end against the
  relay's own brain (the `in`, the volleys, a blow, the coil held, broken, lost and slipped, the whirl, the venom, the
  bar and the draw), the renderer's builders, the bar, the voice, the hoard, the map's ring, and the four hosts' wiring.
- Mutants: `tools/mutants/serpent1.json`, 43, all dead.

See also: `World-Bosses.md` (the gate, whose law this follows at sea), `03-World/Naval-Combat.md` (the guns, the
hull and the seams it reaches).
