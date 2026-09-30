# Patch Notes: The Seats of the Iliac Bay

The first part of guild town control is in. It is open to the developers first, so the seats can be played on the live servers before everyone sees them.

## Every palace is a seat (online)
- **Seats.** Every town with a palace is a **seat**: a town a guild will one day hold. Daggerfall, Wayrest and Sentinel are the three **crown seats**, the largest prizes.
- **Arriving.** Walking into a seat town tells you whose it is. For now every seat is unheld: "Anticlere. Its Charter is unheld."
- **The map.** Seats are marked on the online map:
  - a grey ring around the town;
  - a crown above the three capitals, in their kingdom's colour (Daggerfall blue, Wayrest crimson, Sentinel gold);
  - a thin second ring on the Marches (half in each claiming kingdom's colour) and a green one on the Free Lands.
  - Selecting a seat shows its Charter.
- **Banners.** A seat town flies its kingdom's plain banner at its palace door, its city gates and above its notice boards. The Free Lands fly none.

## Behind the scenes
- **The registry.** Each client works out the seats from its own game files. When you stand in a seat town, your game reports it to the server once a day. The server trusts a seat once three players whose accounts are at least a week old agree on it exactly.
- Guild influence, claims, the weekly Turning and sieges come in the next updates.

---

### For the team
- Apply migration **`0046_town_seats.sql`** (with 0044 and 0045, after main's 0043) to production D1 and deploy the account service (**`acct44`**).
- Seats are behind **`SEATS_OPEN = "dev"`** in `server-account/wrangler.toml`. Change it to `"on"` to open them to everyone.
- **SEAT-COUNT**: run `ARENA2_PATH=/path/to/arena2 node tools/seatCount.mjs` to list every seat and the totals.
- A developer can strike a false seat from the registry in chat: `/seat strike <map id>`.
