# Patch Notes: Masonry

## Masonry (online)
- **The mason's bench.** Work stone at a **General Store's** bench (50 gold a work), or at a **mason's bench** in your own home (a new home station, 50,000 gold).
  - **Cut Stone:** 2 Rough Stone make 1 Cut Stone. From rank 0.
  - **Mortar:** 1 Sulphur, 1 Lead and 5 Rough Stone make 10 Mortar. From rank 10.
- **The chisel.** Each work is a few strikes. Five lines are scored on the stone and one is marked: strike the marked line before it moves (the arrow keys, a number key, Space, or a tap on the line). Four strikes make a work, seven a carving. Strike every one true for a clean work and half again the XP.
- **XP follows your rank.** Each unit gives XP at your rank's own tier, and +500 the first time you make it.
- **Mortar** is a new Stores material: withdraw it as an item, or sell it on the market.
- **Specialisations:**
  - **Quarryman** (50): Rough Stone cuts 1:1, not 2:1.
  - **Builder** (50): a seat's fortification projects you begin need 10% less stone.
  - **Fortifier** (100): standing on a seat's defending side in a siege, you keep its Walls from dropping when it's captured, once a Season at each seat.
  - **Sculptor** (100): carve stone furniture for your home - a **column**, a **bench**, a **font** and a **statue plinth**, from Cut Stone and Mortar. They arrive among your home's things, and can be sold on the market.
- **The Professions page** lists Masonry as practised, and the Stores page has the Mason's Bench.

## Fixes
- A stone work's XP is now said as Masonry's, not Smithing's.

---

### For the team
- Apply migration **`0060_masonry.sql`** to production D1 and deploy the account service (**`acct60`**), with the Seats' migrations (`PATCH-NOTES-Seats.md`). Then ship the client.
