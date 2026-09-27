# FIELD BUGS 2026-09-27d - the ghosts only one player could see

A screenshot from the Discord (! OG, to lattymoy):

1. *"Monsters aren't syncing"* - *"The ghost on daggerfall"*, *"We all had to kill them"*, *"And everyone had to kill
   thier ow[n]"*.

## CURSE-SYNC: a world quest's foes are the world's (1)

The ghosts are S0000977, the Curse of Daggerfall (`vendor/dfu-quests/Quests/S0000977.txt`). The tutorial starts it for
every character (`_TUTOR__`: `start quest 977 977`), and at night in Daggerfall's streets it stands a wraith every 21
minutes and a ghost every 31, one time in two, for as long as the player walks them. Online every player runs their own
copy, and a quest's foe rode nowhere - Multiplayer.md's first lock, which QUEST-PARTY opened only for a quest the party
shared, and a main quest cannot be shared. So each player in the streets fought a haunting nobody else could see, and
swung at air in everyone else's view.

The curse is no player's story - no task counts its foes - so its foes are the world's now: they ride the cell as an
encounter's do (their spawner's, everyone else's puppet), anyone may strike them, they hunt every player, and a player
who leaves or falls hands them to the nearest player. Their quest still holds them. Every other quest's foe stays its
player's own. `06-Systems/Online-Arc.md` CURSE-SYNC.

## For Mac

- **Every copy still rolls its own.** Three players in the streets at night face three players' ghosts and wraiths, as
  a cell's encounters already do (WORLD6b) - they now see them and fight them together. One haunting for everyone near
  (one copy standing it, the way a quest marker's foe stands once for a party) is a design call, not taken here.
- **"They just don't allow placement"** is the tail of a message the screenshot cuts off; nothing was changed for it.

## Verification

Lint, types, the build and the full suite green: 13159 tests across 1378 files, 0 failing (the ones that need ARENA2
skipped). New pins `cursesync` (7); mutants `cursesync` 9, all dead. Re-aimed by content: the handover pins in
`auditpscale1`, `questparty2`, `questparty3b` and `summonsync`, and ten mutant records (`auditpace`, `auditqp`,
`pscale1` four, `questparty`, `questparty2`, `questparty3b`, `summonsync`), re-run, all dead; 11 line cites moved by
tools/citeShift.mjs. Not proven in a browser or with two players.
