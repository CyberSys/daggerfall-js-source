# FIELD BUGS 2026-09-29f - the skill past its range

From the Discord (#bug-reports, the thread "Mercantile Skill Issue"), through Mac: two screenshots and no words - the
report MERC-RISE answered (29d), and the reminder its reporter, ValenValarys, sent Mac later that morning. The rule for a
batch like it: every report root-caused on the real modules, the port's own faults fixed and pinned, and what is
Daggerfall's own said plainly, with what would change it left to Mac.

> Right now, I'm trading with 346 Mercantile, but I'm certain there's a noticeable difference between 60 and 100.
> Completely naked, I get 303 gold, and with my buff gear - across all my attempts between 90-105 Mercantile - I end up
> receiving a payout of around 207 gold instead. Getting 250,000 gold instead of 1,000 obviously isn't fair at this
> point, but I feel like no matter how much someone exploits, there should at least be some kind of soft cap or hard
> cap in place. Having to pay gold just to sell items feels a bit too punishing!

| | Report | Reporter | What it was | Done |
|---|---|---|---|---|
| 1 | naked 303 gold, dressed to 90-105 Mercantile about 207 | ValenValarys | P0.4's old law, MERC-RISE's own report (29d) | fixed by MERC-RISE up to 100, and past it by MERC-CAP |
| 2 | at 346 Mercantile a sale costs gold; "some kind of soft cap or hard cap" | ValenValarys | DFU reads Mercantile unbounded; its ask falls to nothing by 233, and MERC-RISE's half followed it past 100 | fixed (MERC-CAP) |

## MERC-CAP: online the haggle reads a skill in its own range (1, 2)

**Reproduced first**, on the real modules. At 29d's field counter (quality 5, a lot costing 17397, Personality 100)
MERC-RISE's online sale was 2718 up to Mercantile 100 and then fell - 2616 at 105, 2310 at 120, 679 at 200 - and from
233 it was under nothing: -34 at 233, -2311 at 346. The trade window's Sell arm hands its price to `addGold`, which
takes a price under nothing from the purse and can leave the purse under nothing. The reminder's first half is 29d's
report again and fits P0.4's old law, half the seller's own ask, in shape: at a quality-5 counter a lot of 1509 gold
(any from 1507 to 1511 pays the 303) pays 303 at Mercantile 60, 250 at 90, 226 at 105 and 209 at 115 under it.
MERC-RISE pays that counter's sellers 235 up to 100 - and past 100 it still fell (226 at 105, 209 at 115, -201 at 346).

**Why.** CalculateTradePrice (FormulaHelper.cs:1992-2000) turns a Mercantile or a Personality of 0..100 into a factor
of 128..256 in 256: the seller's `(skill << 8) / 200 + 128`, the buyer's `((100 - skill) << 8) / 200 + 128`. Personality
is bounded where it is read (GetLiveStatValue clamps to MaxStatValue; the port's `liveStat`). Mercantile is not:
GetLiveSkillValue is the permanent value plus the effect mod, with "TODO: Any other clamping or processing"
(DaggerfallSkills.cs:135-143), and the port's `skillValue` makes the same read. A worn Enhances Skill adds 15, a rarity
affix up to 30 (it rolls any of the 35 skills), so a dressed character reaches 346. Past 100 the buying factor falls
under 128 and through 0 at 200, and the ask is nothing by Mercantile 233 at every quality (from 231 at some;
Personality 100) and less after. MERC-RISE took the best haggler's ask at 100 in each "or the seller's own where a spell
lifts it higher" - which kept P0.4's law for such a seller, and made the half fall with the skill past 100 and go under
nothing with the ask.
The purchases fell the same way, online as offline: the counter's ask went under a gold a piece, and FB0929's floor sold
anything for a gold a piece (an item a partner could sell at the half); a night's room (7 gold) was free by 200 (from
158 at quality 0 to 196 at 20) and paid its renter from 234; and a cure and a spell with it - the tavern, `payForCure`
and `purchaseSpell` all pay through `deductGold`, which adds a price under nothing to the purse, behind a gold check
that such a price always passes.

**The fix.** `systems/shopStock.js` `calculateTradePrice`: online, Mercantile and Personality are read within 0 to 100
(`ONLINE_HAGGLE_MAX`, which is MERC-RISE's `ONLINE_SALE_REFERENCE_SKILL` renamed for what it now is) - past 100 as 100,
under 0 as 0, on both arms. It is the one formula every price goes through - the counter both ways, a repair, the keyed
shelf, a room, a cure, a spell, a Travel Options fare - so the least the counter asks anyone is the best haggler's ask,
and MERC-RISE's half is exactly half of it; no seller's own reaches past it. A sale never falls with a skill or goes
under nothing, no price is under the best haggler's, P0.4's buy-back law holds for every seller, and inside the range
nothing moves - no seller or buyer at 0 to 100 sees a different price. It is the reporter's hard cap, placed where the
formula ends: the only shape that keeps P0.4 and "no skill lowers a sale" together, because any slope past 100 in the
ask would pull the half down for everyone. Offline, DFU's reads stand (For Mac, below).
`test/fb0929f_mercantile.test.js` (3; all three fail on the code before it), `tools/mutants/fb0929f_mercantile.json`
(10, 10 dead). MERC-RISE's third pin flipped: a seller lifted past 100 is held to half of what the counter asks them
ONLINE, which reads 100 there, where it was held to half of Daggerfall's own ask, a price under nothing by 234 - and
its mutant list lost the two records whose reference followed that lift and re-aimed two at the fixed reference (4, 4
dead). realm0's P0.4 pin reads the fixed reference (57, 57 dead). `06-Systems/Realm-Arc.md` P0.4, Port-Ledger A's P0.4
row.

## Found on the way, not touched

- **Travel Options' fare reads Mercantile as a stat.** `ui/travelPopUp.js` `scaleTripCost` haggles the scaled fare
  with `liveStat(e, 'mercantile')`, and no stat has that name, so every such fare haggles at Mercantile 0; the read
  CalculateTradePrice makes is `skillValue(e, SKILLS.Mercantile)`. It reaches play only with a Travel Options cost
  scale factor over 1, and it moves every such fare, so it waits for a word.

## Ported, not this batch's

- **`test/tv6_dungeons.test.js`'s walk pin was red on main.** TO-ROADS gave `travelViewWalkTo` a third option
  (`roads = false`), and AUDIT OW4 D1/D6's pin still lifted the function by its two-option signature ("the walk, with
  its one option"). The one-line re-aim LIVED1 (#442) and SPAWN-SHORE (#441) both carry is ported here, byte for byte,
  so this batch's check is green on its own; it merges clean whichever lands first.

## For Mac

- **Offline, Daggerfall's own reads stand**, and past Mercantile 100 they are Daggerfall's own quirk: at 346 a sale
  pays about twice what it pays at 100 (26639 against 13591 at the field's counter), the counter asks a gold a piece
  (FB0929's floor), and past 233 a room, a cure and a spell cost less than nothing - `deductGold`, as DFU's
  DeductGoldAmount, then pays the buyer. FB0929's "a hard minimum of 1 gold for anything" reached the counter only.
  Should offline read the same range (MERC-CAP without its `online`), take FB0929's floor at every purchase, or stay
  Daggerfall's?
- **MERC-RISE's flat price is still yours to settle** (29d's "Say which"). The reporter's own counter now pays every
  seller 235, where naked they were paid 303 under P0.4's old law; the other lawful shapes stand - scale Daggerfall's
  offer so the best haggler lands on half their ask, or raise the share.
- **Online, Mercantile past 100 buys nothing.** Live Mercantile is read only by prices, so a worn Enhances Skill or a
  Mercantile affix past 100 does nothing online now. A soft cap past 100 cannot keep both of your laws (P0.4's half
  and no skill lowering a sale): any slope past 100 in the ask pulls the half down for everyone.
