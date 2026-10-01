# FIELD BUGS 2026-10-01 - the runaway pet's tiger, and a quest foe's kill that counted on no copy

One #bug-reports thread, and Mac's ask on it: *"Report on other player's quest enemies being dead"*, then *"If someone
kills a quest target regardless of relation then it should ping the quest for the players involved regardless ... So if
it doesnt work that way now it should, imo I suggested party only sync with quest entities for best solution"*. Asked
how the one gap found should be closed - a field on the party pose (a relay deploy), the quest-share frame (none), or no
handover to a member off the quest - Mac chose the party pose.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | "Does anybody know if the tiger from the 'runaway pet' quest respawns?" / "Somebody entered the dungeon where the tiger was and I think it was killed" | (#bug-reports) | not the quest's tiger: a quest's foes are its player's alone, and a shared quest's ride to the party only - a stranger never sees, strikes or is hunted by one; a Natural Cave rolls ordinary Sabretooth Tigers, the room's to kill | answered |
| 2 | (found answering it) a quest foe its owner handed to a party member whose copy holds no such quest, killed with no linked copy in the room, counted on no copy - the owner came back to a fresh one at the marker | - | QUEST-PARTY counts on each copy only the deaths it sees, and AUDIT DISC28 QS-J's heir keeps the foe on the partner's word with nothing to count it on | fixed (KEPT-KILL) |

## The report (1) - what a quest foe is online

**The quest.** "Runaway Pet" is `M0B00Y17` (`vendor/dfu-quests/Quests/M0B00Y17.txt`, the Fighters Guild's): `Foe _tiger_ is
Sabretooth_tiger`, `place foe _tiger_ at _mondung_` - a `dungeon6`, a Natural Cave (`Quests-Places.txt:124`). It is
fetched ALIVE - an `injured _tiger_` and the bell (`_S.02_`, `_S.04_`, `_S.05_`'s `remove foe`); `killed 1 _tiger_`
(`_S.03_`) is the failure: "Oops. You killed the tiger.", and `_dummy_` orders the player out, unpaid. (`M0B00Y07`, "Unwanted
Houseguest", is the other tiger in the pack: a house, and a kill.)

**Whose foe it is** (verified on the code, `scenes/questFoeHost.js`, `scenes/dungeonContext.js`, `scenes/exteriorFoes.js`,
`scenes/world.js` questShareSeam):

- The quest's own mount stands it on its player's machine alone (`systems/quest/sceneMount.js:118` - only while
  `killCount < spawnCount`), past the layout's run (`dungeonContext.js:1441` spawnQuestFoe). The room's stream carries
  the layout alone (`foesFrame`), and a peer's blow past the run is refused (`applyHit`, `i >= _layoutFoes`).
- Shared with the party (QUEST-PARTY), it rides the room's own lane to the party alone, stood as a puppet for a LINKED
  copy only (DISC28-J's `accepts`), struck only by the party, hunting only the party (`isPrivateQuestFoe`,
  `questShareTag`, `peerMayHit`). Every member's linked copy counts the injury and the kill it sees; the resync's max
  merge (`machine.js:1290`) keeps the copies equal.
- It is never the room's: the hourly respawn (`RESPAWN_MS`) and the relay's memory of the dead (`sharedWorld`'s
  `slice(0, _layoutFoes)`) cover the layout's run alone. Once its copy counts it killed it is never stood again; alive,
  it stands at full health each time its player comes in.

So the reporter's tiger was a cave's own, a stranger's to kill. The quest's tiger was still standing in the reporter's
own copy of the cave - unless the player who came in was in their party, and then only by the road below.

## KEPT-KILL: a kept quest foe's fall is said in the heir's party pose (2)

**Reproduced first** (`test/keptkill.test.js`, the dungeon's own-lane doors sliced out of the source and run - the
questparty3c harness): the owner stands Runaway Pet's tiger; a party member whose copy holds no such quest (a share
refused - Runaway Pet is a guild quest, and a non-member's receipt is refused `'guild'` - or a link a reload dropped)
stands no puppet of it (DISC28-J). The owner dies to it or walks out: the handover names that member heir, who takes it
on the partner's word (QS-J's `_keptTag`). The heir kills it. No linked copy is in the room, so no copy saw it fall,
and nothing the heir's world does reaches the owner's. Back in the cave, the owner's copy (`killCount` 0) stands a fresh
tiger at the marker - to the owner, the tiger respawned.

**Why.** Each copy counts what it sees (QUEST-PARTY phase 1): its own foe's death through its QuestResourceBehaviour, a
partner's puppet's through `onPuppetDied`. A kept foe has neither - the heir has no copy to bind it to - and the own
lane is the room's, so a death nobody linked saw was nobody's word.

**The fix.**

- The heir says it. Each frame, beside the quest behaviours' update, a kept foe at zero health (the behaviour's own
  test) says its fall once with its number on the heir's stream - `keptKillTick` in both pools
  (`dungeonContext.js`, `exteriorFoes.js`), through the seam's `onKeptDied(tag, i)`.
- The heir's party pose carries it: `qk`, rows of `{q, s, i}` (the quest, the Foe's symbol, the number), held five
  minutes (`KEPT_KILL_HOLD_MS` - the hub keeps a member's last pose, so a link that drops and comes back in it still
  hears), eight at most (`net/wire.js` validPartyPose, `KEPT_KILL_POSE_MAX`).
- Every party member's linked copy counts it, wherever the member stands (`creditKeptKills`: `sharedQuestFoe`, the
  injury then the kill, as the behaviour sets them). A copy that holds no such quest counts nothing (DISC28-J's law).
- Once. The pose repeats its rows on every change for the hold, and a linked member in the room saw the puppet fall
  too: the puppet's death names its owner and number now (`onPuppetDied(tag, owner, i)`), and both doors ask one
  ledger keyed by the holder's account, the quest, the symbol and the number (`KeptKillLedger.credit`), remembered
  past the hold. Whichever lands first counts.

**The relay.** `qk` is a party-pose field, so the hub must project it: RELAY_VERSION world136 -> world137 (main's GATE-UX took world136 first), which
`relay-deploy.yml` deploys on the merge - and a relay deploy drops every open socket once. Until it is live the hub
strips the field, and the kill counts on no copy that did not see it, as before; nothing else changes.

Pins: `test/keptkill.test.js` (7): the wire's law, every vendored quest name and Foe symbol inside it, the gap and its
say in the dungeon, the witness's key equal to the heir's, the ledger, Runaway Pet's `killed 1 _tiger_` firing on the
owner's and a linked copy from the heir's word (and not on an unlinked one, and not twice), and the hosts' wiring.
Red on the code before (the module's exports are not there). Mutants: `tools/mutants/keptkill.json` (22, all dead).
PIN MOVED: `test/questparty.test.js` (the world host's
`onPuppetDied` shape); the relay's version pins to world137 and `relayversion.test.js`'s row; mutants
`questparty.json` QP-no-kill-credit and `questparty3c.json` QP3C-no-kill re-aimed by content, `soc1.json`
S38-version-not-bumped to world137.

**Not changed.** The handover itself: QS-J's reason stands (refused, the foe was lost for every linked member in the
room). A kept foe killed while its owner's relay link is down past the hold is still uncounted on the owner's copy; the
owner's next resync from a linked member who counted it (one in the room, or one that got the pose) carries it. A
quest that is not shared is its player's alone: its foe is never handed, and leaves with its owner.
