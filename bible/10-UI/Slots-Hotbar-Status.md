# Slots, the hotbar and the status widget - the Plus UI pass (UI)

## What Mac asked for

> "I want to find a way to make the actual inventory plots have the rarity frame with sprites enlarged properly,
> instead of the inventory icon just plopping into a slot, if that makes sense. The hotbar also is missing sprite icons
> like spells, and you should be able to slot spells and different items. For the UI, I want to move buffs/debuffs/etc
> to their own widget space somewhere on the side of the screen, where it doesn't interact with other UI elements, and
> use square icons with glyphs for each effect (climates and calories included) which then gives more space for the XP
> bar and being able to fit the XP amounts inside. This needs to be a detailed adjustment after all current work is
> finalized"

Three slices, each shippable alone: UI1 the slots, UI2 the hotbar, UI3 the status widget and the XP bar. The
enhanced skin only - Plus is its only dress (`isEnhancedPlus === isEnhanced`); the classic skin keeps DFU's own
inventory paper, its HUD's ICON00I0 rows and no hotbar.

## UI0 - the ground truth (2026-09-27)

Read with the real ARENA2 through the dev server's mount (a scratch probe drew the pack with its real records).

**The pictures.** Every enhanced item picture is an `<img>` holding a PNG data URL, made on a canvas at a fixed
whole-number scale - 2 for a tile, 4 for the card (`requestIcon`, `ui/textureCanvas.js`) - and then CAPPED by CSS:
`.tile img { max-width: 30px; max-height: 30px }` (`ui/enhancedStyle.js`). The pack's grid slot is 56px; its picture is
at most 30. The real records, measured over the 282 templates the game mints (their longest side):

| group | median | range |
|---|---|---|
| weapons | 86 | 27-141 (a staff 102x141, a longsword 88x29) |
| armour | 57 | 42-112 |
| clothing | 62-63 | 29-149 |
| jewellery | 37 | 5-88 |
| ingredients | 12-23 | 11-61 |
| gems | 11 | 9-12 |

So a longsword's 2x canvas (176x58) was drawn at 30x10 - crushed nearly six times under `image-rendering: pixelated`,
which at a ratio like that DROPS pixels unevenly - and a gem's 2x canvas stood at 18px in a 56px slot. Nothing
computed a scale that fits the slot. The grid also never showed a stack's count (`itemRow` never made the element its
sheet has a rule for).

**The hotbar** (`ui/enhancedHotbar.js`, the model `systems/quickslots.js` HB1): ten slots (sixteen on the pad's
crossbar). A spell's slot shows the spell's INITIALS - "A spell has no ARENA2 icon this skin reads" - though the art is
there: ICON00I0.IMG, 69 spell icons of 16px (`ui/spellIcons.js`), and a DOM door already cuts them
(`ui/enhancedArt.js spellIconUrl`). Items: four KINDS alone - a consumable, a light, a shield, a weapon
(`hotbarKindOf`, and again in the save's restore) - and a press of any other kind would fall to the light's arm.

**The status row** (`ui/enhancedHud.js`): the HUD's effects are TEXT chips - "Wrath 10s" - in one row at the foot of the
centred column, under the vitals and the Renown row: spells (`effectRows` - their ICON00I0 index dropped on the
way), the sets' powers, and the survival needs ("Hungry", "Freezing" - `survivalHudChips`). A poison, a disease and an
infection never show there at all (they carry no bundle). The Renown bar is an 8px track with no words: the numbers
went inside a 16px bar once (RENOWN-BAR) and came out ("Actually lets just keep the other bar and remove the xp"),
because the row under it was the chips' and the column had no room. On a phone the vitals' words run into their
numbers ("MAGICKA70%").

## UI1 - the slots: a framed plate, the sprite fitted (2026-09-27)

**THE FIT LAW** (`ui/iconFit.js`, pure). A picture is fitted to its slot's box in DEVICE pixels:
- the record is TRIMMED to its opaque pixels first (a sprite's transparent margin is not the sprite; a replacement
  PNG's fringe under alpha 8 is not either - `bitmapCanvas.js TRIM_ALPHA`);
- its longest side is scaled to the box (`floor(box x devicePixelRatio)`, the ratio clamped to 1..4), never past `cap`
  (4) CSS pixels a source pixel, so a gem does not become a boulder (an 11px ruby stands 44px in a 48px box);
- a WHOLE-number scale is drawn by nearest neighbour alone - every source pixel exactly `k` device pixels - and the
  scale is SNAPPED down to the whole number under it whenever that keeps three quarters of the size (`SNAP`): a 20px
  ring in a 48px box is 40px of whole pixels, not 48 of resampled ones;
- any other scale over one is "sharp bilinear": nearest neighbour up to the next whole number (`prescale`), then a
  smooth resample down to the size - crisp pixels, no uneven drops;
- a scale under one (a 141px staff in a 48px box) is a smooth reduction, halving while it is twice too big, then one
  pass to the size (`bitmapCanvas.js fitCanvas`) - never a pixelated one.

The picture is made at exactly the device size it is drawn at, so the page resamples nothing: an `<img>` carrying its
own width and height (`textureCanvas.js fittedImg`), never past its box (a slot the page draws smaller shrinks it
whole, smoothly). The door is `textureCanvas.js requestFittedPicture`: the picture's own door at scale 1 is its source
(the record through `requestIcon` - its vendored arm, its replacement by the dye, the classic record with the mask
stripped - or the cart's model bake), the fitted picture cached by the picture, the box, the ratio and the cap, every
screen waiting on it told once when it lands. `requestIcon` itself now tells EVERY screen that asked while a record was
in flight - the first asker's `onReady` had been the only one heard, and a slot asking second kept its initials.

**THE BOXES** (`SLOT_BOX`): each surface's well inside its frame, less two pixels a side, so a sprite never touches its
frame - the pack's grid 48 (40 on a phone), a worn panel 28 below a desktop and 48 on one (a half panel 22 and 38),
a loot row 30, the shop's and a player trade's rows 26, the shelf's socket 32, the hover card and the detail card 96,
the Sigil Broker's offer 32. Measured with the real ARENA2 (`tools/uiSlotsProbe.mjs`): every grid picture fills three
quarters of its box or more (a gem stands at the cap), none past it, none resampled by the page, at 1x, 1.25x, 2x and
a phone's 2.625x.

**THE SLOT IS THE FRAME** (UI1b - Mac, mid-pass: "rarity outlines actually [on] the UI/Hotbar border itself instead
of it being an icon within an icon"). The pack's grid slot is 64px (it was 56) round a 52px room for the picture - a
room, not a box: the tier's frame is the slot's own border (its colours, lit from the top left), its glow on the slot's
ground, and the sprite stands straight on it in no second box. Its corners: the hotbar's key top left, the sigil's or
the set's rune top right, the tier's pips bottom left, the stack's COUNT bottom right (new; stepping off the padlock's
corner for a locked stack and over the wear bar), the wear bar along the foot. A Common piece wears the kit's stone.
On a phone the slot is 56 round a 44px room, so a 393px screen keeps six a row; a desktop's dock keeps five. The same
law everywhere a slot stands: a WORN PANEL is its piece's frame (the tier on the panel's border and its glow behind the
picture, the rune and the padlock at the panel's corners - it had been a small framed tile inside the big panel), a
shelf socket, a hotbar slot, a diamond cell and the carried ghost were their own frames already. Only a LIST's row (the
loot window, the shop, a player trade) keeps the frame on its picture: a list has no slot.

**THE BODY'S PICTURES.** On a desktop (the pack's `min-width: 1000px` layout, where the worn map's rows stand 64px and
more) a worn panel's picture has a room up to 56px - the grid's own 48px box, so the pack's slot and the body's are
one picture - and a half panel's (a chest, arms or legs pair) up to 44 over its name; a short window's row shrinks the
room with it. The phone's map keeps its compact rows (34px tiles, 28 a half).

**EVERY OTHER SURFACE** fits its picture to its own box by the same law, through the same door: the accessory shelf,
the loot window's rows (a stack says its count in its name there, which the row shows), the shop's and a player
trade's rows and detail strips, the hover card and the Info box, the Sigil Broker's offers. THE DRAG GHOST lifts the
slot's own picture - the grid's box, so a carry starts with its picture already made; one carried off the body (whose
panel's box is smaller below a desktop) takes its picture the moment it lands - and its tile is 56px, bigger than the
52px well it lifts from.

## UI2 - the hotbar: every spell's icon, every item (2026-09-27)

**A SPELL'S SLOT SHOWS ITS ICON** - the ICON00I0 tile its record names (SPELLS.STD's `icon` byte, a made spell's
SetIcon), cut from the real sheet (`ui/enhancedArt.js spellIconPicture`) and fitted to the slot by UI1's law, whole and
untrimmed (a spell icon is a square tile, its dark border part of it): 32px in the row's 50px slot at every ratio. The
element's rim and the range's pip stay; the initials show only while the sheet loads. The entry STORES the icon
(`hotbarEntryForSpell`, the save with it), so a spell that has left the book keeps the picture it was slotted with,
dimmed as a ghost. The spellbook's drag carries the icon; the diamond's spell chip wears it before its name. The sheet
cutter now tells every screen that waited on it (`sheetCutUrl`'s `onReady`).

**ANY ITEM GOES ON THE BAR** (`systems/quickslots.js hotbarKindOf`), its press the pack's own primary act
(`localPrimaryAct`, the pad's quick act):
- a consumable used, a weapon readied, a light lit, a shield strapped on - as before;
- a piece a slot of the body takes - armour, clothing, jewellery, a gem's crystal (the equip table's own answer) - is
  WORN: put on, or taken off when it is on, in its own words ("You put on your Steel Cuirass." / "You take off...";
  a shield keeps SHIELD1's), the equip delay billed as the swap bills it, broken and forbidden refused;
- everything else is USED through the host's own quick use, which is the pack's Use: a book OPENED in the reader, the
  spellbook item opening the book, a map read, food eaten, a tent or a fire placed on the host's ground - every host
  (`scenes/world.js`, `exterior.js`, `dungeonContext.js`) now hands its quick use the pack's three window doors, one bag
  (`packDoors`) with the pack's own - and an item with no use at all SAYS so ("You cannot use your Prayer Beads."),
  flashing the refusal, where the pack's click is silent (DFU's catch-all).
The save carries the two new kinds and refuses a kind it does not know.

**THE SLOT'S PICTURE IS FITTED** (UI1's law) at a MEASURED box: the slot's face less two a side, at the ratio its
pixels land at - the screen's times the HUD's own scale, which the bar rides in play - read again every second and on
any layout change (the crossbar, the bar carried under a window). A stack shows its COUNT on any slot (a consumable
always); a worn piece its WEAR - a weapon, a shield, a light, armour, anything enchanted - and never a gem, a ring or a
book. The diamond's cells are fitted too (40px, 28 on a narrow screen), at the HUD's scale. The drop hint says any item.

Measured with the real ARENA2 (`tools/uiHotbarProbe.mjs`): three spell icons (one a ghost) and seven items on the row,
every picture fitted and unresampled, the counts, the diamond's cells and its spell chip, at 1x, 2x and a phone's 2.625x.

## UI3 - the status widget, and the XP in the bar (2026-09-27)

The effects leave the foot of the screen for their own widget at the left edge's middle (the least contested place
on the HUD: the diamond is below it, the chat and the escorts above, the notices on the right): a column of SQUARE
tiles, one an effect, each a glyph - a spell's own ICON00I0 icon, a set power's rune in its set's colour, and the
port's own pixel glyphs for what Daggerfall has no icon for: hunger, thirst, sleep, wet, hot, cold, stiff, drunk, a
poison, a disease. Its frame says what it is (a buff, a debuff, a need's warning, a need that costs), its foot how long
it has left, and it blinks as it ends. Poisons and diseases show at last. On a phone the widget is icons alone.

With the foot free, the Renown bar is a vitals-height track with its XP INSIDE it ("5,420 / 12,500 XP", "Highest" at
the cap), the level's box beside it, and the row's 22px kept - the diamond's lifts do not move. The phone's vitals
drop their words for their numbers.

## What it does not do, said so

- The classic skin is untouched: DFU's inventory paper, its HUD's spell rows, no hotbar.
- No icon pack (DFU's SpellIconCollection packs) is read: the 69 classic icons alone.
- A sprite is never rotated to fit a slot: a longsword is long.
- A phone's accessory shelf keeps its compact row: six pairs across a 393px screen leave a 23px socket, and the
  picture is shrunk into it (smoothly) rather than the shelf growing (UI1).
- Below a desktop the worn map keeps its compact rows and their 34px tiles; the 56px wells are the desktop's (UI1).
