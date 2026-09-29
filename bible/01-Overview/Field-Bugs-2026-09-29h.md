# FIELD BUGS 2026-09-29h - Dunkitay's Silver: the press that said nothing, and the pack's Pick-Axe

One screenshot from the Discord (Dunkitay, through Mac): *"how do i mine this, if i use the pick axe it says "you
cannot mine in here!""*. A dungeon, a vein on the wall under the crosshair, the prompt "[E] Mine Silver - needs Mining
25" above the hotbar, the chip "Mining 0 - 0 / 60 today" under the compass, a Pick-Axe on the hotbar. Mac's word with
it: "We recently implemented foraging and our new life skill system". The rule for a batch (29g's): every report
root-caused on the real modules, the port's own faults fixed and pinned, and what is a design call said plainly and
left to Mac.

| | Report | What it was | Done |
|---|---|---|---|
| 1 | "how do i mine this" - E at the vein | Silver is tier 3, which needs Mining 25 (PROF0 3.2); every vein of a dungeon nobody has confirmed is Silver (PROF0 23), and every dungeon vein is tier 3 or more. E at a node that cannot be worked passes the press on (AUDIT 29 C1), and with nothing else under the ray the press opened nothing and said nothing - the prompt's [E] a drawn door | fixed (VEIN-NEED): the node says what it needs, the player's own rank beside it |
| 2 | "if i use the pick axe it says "you cannot mine in here!"" | Foraging's own Use from the pack - the hotbar's Pick-Axe is the pack's Use (UI2) - and the mod mines only in the wilderness (FORAGE0 6.2). Its line is the mod's (FORAGE0 law 1, Mac's) | the mod's line kept; for Mac |

## VEIN-NEED: E at a node that cannot be worked says what it needs, when nothing else takes the press (1)

**Reproduced first**, on the real gathering host over a real book (`test/fb0929h_veinneed.test.js`): a dungeon nobody
has confirmed, Mining 0, a Pick-Axe in the pack, a vein under the crosshair. Every vein there is Silver at tier 3; the
prompt reads "[E] Mine Silver - needs Mining 25", the screenshot's words. `press()` answers false - the press goes on
down the dungeon's ladder - and at the ladder's foot, with nothing under the ray (`key === null`), the ladder answers
false and nothing is said. A player pressing the key the prompt names hears nothing at all; the only other gesture
they have is the pack's (2).

**Why.** PROF1 built E at a node as "an act started, or what it needs said": a node that could not be worked took the
press and toasted its need. AUDIT 29 C1 found that press stolen from the door, the chest or the foe beside a node,
"and when it could not be worked (every dungeon vein below Mining 25)", and made such a node pass the press on, so the
ladder gives it to what it was meant for (`06-Systems/Online-Arc.md` AUDIT 29). The need went with it, and the prompt
still names E. So where nothing else is under the ray the press opens nothing and says nothing - a drawn door that
opens nothing, the lie this repository names (`10-UI/UI-Arc.md` AUDIT 62 F10) - and every Novice who meets a
dungeon vein meets it.

**The fix.** The press a node passes on keeps what the node needs (`scenes/gatherHost.js` press); each ladder hands
the press back at its foot when it opened nothing else, for an E press alone - the dungeon's at `key === null`
(`scenes/worldModes.js` tryExitDungeon, through the world host's `profNeed`), the street's where the door arm answers
that nothing opened (`scenes/world.js`, before GRAVE1's epitaph) - and the node says it (`sayNeed`). C1's order stands:
every arm of both ladders comes first (the quest foe's click, the lock, the plaque's act, the foe, the boat, the loot,
the doors; on the street the ship, the gate, the camp and the wagon too), and a press no node was asked - a click, or
underground a touch spell's release - hands nothing back. The words are the prompt's, and where the rank is what is
short - the kinds' plans carry it (`needsRank`, `scenes/mineHost.js`, `herbHost.js`, `treeHost.js`) - the player's own
rank beside it:

- **"Mine Silver: needs Mining 25 - your Mining is 0"** (the report's vein), and at Mining 12, "... your Mining is 12";
- "Mine Silver: needs a Pick-Axe"; "Mine Silver: Mining 25 - 60 of 60 today"; "Mine Silver: Stores full - Silver";
  "That gathering is being counted." (PROF1's own line, from before C1);
- the same for every kind - a patch ("Pick ...: needs Herbalism 10 - your Herbalism is 3"), a tree, a boulder, a
  surface vein. A node worked today is no target, and says nothing.

One press, one line; a press with no node under the look forgets the one before. The prompt is unchanged (PROF0 8's
form): it already says what the node needs, and the press now says it too, with the rank the player holds.

`test/fb0929h_veinneed.test.js` (5). MEASURED against the code before the fix (its new doors stubbed to the old
silence), three fail - the report reproduced on the real host; each need's words off each kind's own plan; each
ladder's new line lifted off its source and run, with every arm of both ladders before it - and two hold, as they
must: the pack's line and the vein's skipped checks as they stand, and the presses that must still say nothing (the
press the node took, no press, a newer press with no node - pinned against the fix saying too much, their mutants
dead);
`tools/mutants/fb0929h_veinneed.json` (17, 17 dead). `tools/mutants/audit29.json`'s C1 record re-aimed by content
(49, 49 dead). 60 line cites into `world.js` and `worldModes.js` moved (tools/citeShift.mjs), and five struck
Ledger/Settings cites by hand.

## The pack's Pick-Axe (2)

Foraging's Use, 1:1 (`06-Systems/Foraging.md` law 1, **Mac's**: "What a tool does from the inventory ... and every
message, are the mod's"; law 4: "Neither gesture changes the other"). The mod's first check is
`IsPlayerInside || IsPlayerInsideDungeon || IsPlayerInsideDungeonCastle` (IL_1328), so underground it answers "You
cannot mine in here!" whatever stands on the wall - true of Foraging's mining, which is a wilderness quest; beside a
vein it reads as if the vein could not be mined. The vein's own act never asks that check (PROF0 23: a dungeon vein
skips inside, settlement, daylight and sea; `DUNGEON_SKIP`). Pinned as it stands, unchanged; For Mac 1.

## For Mac

1. **The pack's Pick-Axe beside a vein.** Keep Foraging's line 1:1 (law 1, yours), or, online and with a node of the
   tool's own kind under the look: (a) the Use does what E does there - the act, or what the node needs - law 4's "the
   same tool, carried to a node online, is the profession's tool" read as taking in a Use there (the pack's and the
   hotbar's); or (b) Foraging's line, and the port's own after it ("The vein takes [E]"). Anywhere else the Use stays
   Foraging's. The record's lean: (a) - "use the pick on the ore" is what a player tries first, as this one did.
2. **Every dungeon vein needs Mining 25.** Dungeon veins are tier 3 to 6 (PROF0 6) and a dungeon nobody has confirmed
   holds only Silver (PROF0 23), so a Novice finds veins in every dungeon and can work none. Mining 25 is 6,250 XP:
   MEASURED on the law (`harvestXp`), 163 clean harvests at the surface veins by day (tier 1, then tier 2 from rank
   10), 242 plain - three to four days at the cap of 60. Keep (a dungeon vein the Apprentice's reward, and the need now
   said), or a vein the Novice may work underground? The record's lean: keep.

The Mining patch notes (`PATCH-NOTES-Professions-Mining.md`) never said a dungeon vein needs Mining 25, nor that the
pack's Pick-Axe is Foraging's mining and not the vein's; `PATCH-NOTES-What-a-Vein-Needs.md` says both, beside the fix.
