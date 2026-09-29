# FIELD BUGS 2026-09-29b - the book that changed its title, the skill that sold for less, the lintel over the water

From the Discord (#bug-reports and #suggestions), through Mac: six screenshots and no words, the rule for a batch like
it - every report root-caused on the real modules (and the real ARENA2 where the report lives in the data), the
port's own faults fixed and pinned, and what is Daggerfall's own said plainly, with what would change it left to Mac.

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | books put up for sale show the wrong title; taken back they "duplicate" | Janome | DFU's SplitStack zeroes a book's id; the counters took a lot back with a push | fixed (BOOK-SPLIT) |
| 2 | "Water walking is still evil" - fell out of the map again | Cruor | a water walker's land-speed stride set on a doorway's lintel and out through the ceiling | fixed (WW-LID) |
| 3 | a higher Mercantile sells for less (3499 gold at 60, 2888 at 90) | ValenValarys | REALM P0.4's cap was half the SELLER's ask, which falls as the skill rises | fixed (MERC-RISE) |
| 4 | first-person journeys go straight through the forest; the Overworld follows roads | SylviaBun | TO-ROADS | see below |
| 5 | the pack should show total armour, and an item's stats against what is worn | SylviaBun (Althea's idea) | AC-COMPARE | see below |
| 6 | the enhanced map needs the classic map's filters and its colours | Jigglehimmer | MAP-KEY | see below |

## BOOK-SPLIT: a book split off a stack is that book (1)

**Reproduced first**, on the real enhanced counter: one of "A Tale of Kieran" x3 put on the counter through the
how-many field (DISC25-F) read "The First Scroll of Baan Dar", and taken back it was that book in the pack.

**Why - two faults.** SplitStack (ItemCollection.cs:261-272) mints `ItemBuilder.CreateItem(group, templateIndex)`,
which knows a group and a template and nothing else; A2 ported it faithfully. So the part split off lost the three
terms FindExistingStack reads as identity beside them (:708-713): a book's id - book 0, and the template's 2500 gold
instead of its own 300-800 file price, so a split book also sold for several times its worth - a potion's recipe (an
empty bottle) and a conjured stack's expiry (arrows that outlived their spell). DFU's own split does the same. And both
counters took a lot back with a `push`, where DFU's every click-back and ClearSelectedItems go through
ItemCollection.Transfer -> AddItem (:473-480), which merges a lot into its own stack - so what came back sat as a row of
its own beside the stack it left: the "duplicate".

**The fix.** `systems/inventory.js` `splitStack` keeps the three identity terms and the price and picture a book's id
and a potion's recipe set (`splitPricedByIdentity`); the rest is still the fresh mint - condition, material, variant,
flags, enchantments (Port-Ledger A). `ui/enhancedTrade.js` `move` and `ui/nativeTrade.js` `_move` are Transfer: out of
one list, AddItem into the other, a quest item to the front as DoTransferItem places it. AddItem gained
FindExistingStack's first term, `checkItem != item`. A2's and ROAD-Ar R5's pins flipped to the new law (R5's re-merge
now on a potion the producer mints). `test/fb0929b_booksplit.test.js` (4), `tools/mutants/fb0929b_booksplit.json` (11,
11 dead). `06-Systems/Systems-Arc.md` BOOK-SPLIT.

## WW-LID: a lift the body has no room for is never taken (2)

**Found by fuzzing, not guessed.** A water walker and a plain swimmer driven at random - float up and down, run,
strafe, at 12 to 60 frames a second - through all 32 flooded RDB blocks of the real BLOCKS.BSA, with a probe asking
whether the body's centre crossed a face in one frame. The first road out, W0000021.RDB: a flooded room with its
ceiling at 3.2 and, in its wall, a doorway whose lintel is at 2.8. A crouched swimmer (0.9 tall) floated to the
ceiling and swam at the doorway. Water walking moves a swimmer at the LAND speed (LevitateMotor.cs:116-122), so one
step carried its lower sphere under the lintel's floor-sloped underside before its head had met the lintel, PH1's
one-way floor set the body on it, and the head, over the room's ceiling now, was pushed out on top of that. A slower
swimmer's head meets the lintel first and is turned back - which is why only water walking did it: through the real
motor, 16 of 16 water walker runs went out through the ceiling and 0 of 16 swimmers. With that road shut the fuzz found
two more: a rib hung under the ceiling through the crouched body's waist (straddled, so PH1 lifted the body into the
ceiling - one of those a plain swimmer's), and the step ladder lifting the body onto such a rib.

**The fix: four laws in `player/collider.js`**, each held by its own case. S - the straddling law DISC28-G gave the
rising pass holds in the sideways pass: a surface is a floor to the lower sphere only below the head's centre. H - a
resolve never carries the head up through a face: a raised body's head path is asked, and a face across it refuses the
rise (the refusal says so, `out.refused`). B - a refused sideways pass is not taken: the body is stopped, not left
inside what refused it. L - a refused step-ladder rung is no headroom. A standing body's straddle band is empty, so
walking is unchanged; PH1's own cases stand and are pinned. `test/fb0929b_waterwalk.test.js` (6: every scene built in
the doorway's shape, never read off the block; the real block's step behind ARENA2), `tools/mutants/fb0929b_waterwalk.json`
(10, 10 dead). PH1's source pin and the two DISC28 `rising` mutants re-aimed to the renamed `straddle`.
`03-World/Player-Arc.md` WW-LID.

## MERC-RISE: online, no skill lowers a sale (3)

**Reproduced to the gold.** A quality-5 counter, a lot costing 17397, Personality 100: P0.4's cap was 3499 at
Mercantile 60 and 2888 at 90 - the report's two offers.

**Why.** REALM P0.4 (Mac's vendor spread: "Online, a shop pays at most 50% of its own selling price") capped a sale at
half of the SELLER's own ask. CalculateTradePrice's buying arm (FormulaHelper.cs:1996-2001) asks less of a better
haggler, and online the cap binds for nearly every seller, so the payout fell as Mercantile and Personality rose
(2888/3499 is the two asks' own ratio).

**The fix.** `systems/shopStock.js` `calculateTradePrice`: the half is of the LEAST the counter asks for the piece - the
best haggler's ask, 100 in each (DFU's maximum) or the seller's own where a spell or a curse lifts it higher
(`ONLINE_SALE_REFERENCE_SKILL`). It is still at most half of what the counter asks anyone, so buying back never pays
(P0.4's law, whole), and it is a number of the counter and the piece. Under it Daggerfall's haggle stands and rises with
the skills. P0.4's pin flipped to the new law and its mutant re-aimed. `test/fb0929b_mercantile.test.js` (3),
`tools/mutants/fb0929b_mercantile.json` (6, 6 dead). `06-Systems/Realm-Arc.md` P0.4, Port-Ledger A's P0.4 row.

## For Mac

- **MERC-RISE's price is flat for most sellers.** Your 50% and "no skill lowers a sale" together force it: the best
  haggler may be paid at most half of their own ask, the least any counter asks, and no one below them may be paid more
  than they are. So at the field's counter every seller now gets 2718 - less than both of the report's offers - and
  Mercantile and Personality raise an online sale only where Daggerfall's own offer sits under that cap (low skills at
  the dearest counters). The other lawful shape keeps the skill in it and pays everyone less: scale Daggerfall's offer
  so the best haggler lands exactly on half their ask (2283 at 60, 2609 at 90 there). Or raise the share. Say which.
- **BOOK-SPLIT departs from DFU** (Port-Ledger A): DFU's own split loses the same three terms. The counters' merge on
  the way back is DFU's law restored, not a departure.
