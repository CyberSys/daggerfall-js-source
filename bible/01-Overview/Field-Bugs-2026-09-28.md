# FIELD BUGS 2026-09-28 - the card that ran off the screen

From the Discord (#bug-reports, Cruor), through Mac, with a screenshot of Ruhn's Horned Crown's card on the Enhanced
pack:

1. *"New sigil items descriptor is a bit long! You can still interact with it by right clicking, but notably all the
   buttons on it's pop-up card are.. off the screen, because it's got a bit much on it!"*

Mac: *"1. Audit this properly 2. Ensure online functionality is perfect 3. Address screenshot for current and future
weapons/gear. Want to improve this and reduce text bloat"*.

## CARD-FIT: the card fits its window, and says what a glance needs (1)

**Reproduced first.** `tools/cardFitProbe.mjs` (new) draws the real pack over the real sheets with the heaviest cards
the game has - a piece of Ruhn's Regalia carried (the report's own Horned Crown), a raid set's weapon, Ruhn's
Gatecleaver, a Legendary with an enchantment, a worn set piece held at its stage, a raid piece with the longest name, a
stack with its how-many field, a locked piece - at a 1920x1080 screen, a 1366x768 laptop (the reporter's class), a
1280x720 window, a 1024x600 netbook, a phone on its side (740x360) and a phone upright (390x844), and presses every
button of every card. Before: **the buttons of every set piece's card were below the screen at every size, a 1920x1080
screen included** - the Horned Crown's card stood 1,032 px tall in the pack's 660 px window (the window is capped there
on every screen), placed from the window's top, and the Gatecleaver's 1,117. 80 of 406 checks failed.

**Why.** The card is a tooltip placed beside its row (PX19g), as tall as what it says (PX21f, Mac: no scrolling in the
tooltip), and a set piece says a great deal: its tier and three affixes, its lore, a sigil block of six rows (the rune
and stage, a sentence on what a set's sigil is, five gems, a bar, the numbers, a note on how it grows), a set block of
up to eighteen rows (the name, the Prince and the role, nine places, the stage line, and each tier's whole sentence -
the Wrath of the Warden's alone ran five lines), four rows of numbers, and two rows of buttons under all of it. The
placement clamped the card's top to the window and nothing clamped its height. On a phone two old rules made it worse:
the phone column's sheet (`max-height: 70dvh; bottom: 0`) leaked into the tip, stretching it to the window's foot and
cutting it, and the phone's own sheet rule set `top: auto` with no `bottom`, so the "sheet" stood where the flow left it.

**The fix, for every card and every piece to come:**

- **The buttons are always on screen.** The card is a column: its words in a body of their own (`.card-body`), its
  buttons a row UNDER the body, never inside it. The placement caps the card at the band it may stand in (the window's
  AND the screen's, less what the tip carries beside its card), and `fitCard` sheds the picture's size and then the
  picture while the body will not fit; past that the body scrolls and the buttons stay put. A phone's card is a real
  sheet at the screen's foot, rising to 80% of the screen. Position is written in the tip's own containing block (a
  narrow screen's layout positions a box between the window and the tip).
- **Less text.** Every set tier has a BRIEF - "+15 fire resist, +2 fire a blow", "Cheat death, then half damage 4s",
  "Kill marks next foe: +15% (10s)" - one line of the card, never past 32 characters at any stage (a test holds every
  set's, a new one's too); a recovery is its own number, drawn in the dashed frame a recovering power wears on the HUD
  ("180s"). The set block on a card: the name, the pieces worn and the stage in one head, the nine places as a thin row,
  what would raise it, and three one-line tiers; the whole sentence is under the pointer. The sigil block on a card: two
  rows - the stage and the numbers toward the next, then the five stages as ONE bar with the stage it grows into filled
  as far as it has drunk - and a weapon's blow in one line ("+2.4% damage (up to +12%)"). The lore left the card. The
  numbers are whole pairs flowing two a line. Four buttons share a row (the kit's 104 px a button is a dialog's).
- **The Info box is the whole read**: the tier's lines and the lore, the sigil's and the set's blocks in their whole
  dress (the Prince and the role, every sentence, every note). The classic tooltip, the trade window and a chat post
  say each tier by its brief too ("2 pieces - The Burning Gate: +15 fire resist, +2 fire a blow"), so a set piece's
  lines wrap in two rows at most where they ran to four.

After: 438 of 438 checks. On every screen 720 px tall or more every heavy card reads WHOLE, no scroll - the Horned
Crown's card is 568 px with its full picture, the Gatecleaver's 543; on the netbook two cards scroll their body a
little, on a phone on its side most do, and on every screen every button is pressed. The heaviest card's words fell
from 694 characters to 264. `10-UI/UI-Arc.md` CARD-FIT.

## For Mac

- **The words are mine.** Each tier's brief is written to say its numbers in a line - read them on the cards (the Test
  Room's loot ladder lays out every Aetheric piece) and say which to change.
- **The recovery tag** ("180s", dashed) reads like the HUD's recovering chip; the words "Recovers in 180 s" are under
  the pointer and in the Info box.
- **A phone on its side** (740x360) is the one screen where a heavy card still scrolls most of its body: the pack's
  window is 338 px tall there, and two rows of buttons take a third of it.
