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

## Influence: how a guild earns a seat (online)
- **The pledge.** Each week a guild chooses one seat in a region to work toward, in up to five regions. An Officer or the guildmaster sets it from the **Seat** tab of that town's Notice Board, until Friday 18:00 UTC. Influence earned in a region where your guild pledged nothing doesn't count.
- **What counts.** Each of these counts for your guild at its pledged seat in that region:
  - **The Watch.** Walking the streets of the seat town: 1 every 2 minutes, up to 60 a day. Standing still doesn't count.
  - **Gate kills.** A gate you helped close in the seat's region: 300, up to 900 a week.
  - **Renown.** Renown XP you earn in the seat's region: 1 for every 20, up to 400 a week.
  - **Homes.** A member's home in the seat town: 25 a day, up to five homes a guild.
  - **Tribute.** The guildmaster can burn Drakes from the guild's treasury: 1 for every 10 Drakes, up to a fifth of the guild's week at that seat.
- **The limits.** One account counts for at most 2,000 a seat a week. The first guild any of your characters contributes to in a week is your account's guild for that week's seats. A character counts after 7 days in its guild.
- **The Seat tab.** A seat town's Notice Board has a new **Seat** tab: the week's standings, every pledged guild under its banner, your guild's pledge and your own week there. Officers pledge from it, and the guildmaster pays Tribute.

## Behind the scenes
- **The registry.** Each client works out the seats from its own game files. When you stand in a seat town, your game reports it to the server once a day. The server trusts a seat once three players whose accounts are at least a week old agree on it exactly.
- The weekly Turning, claims and sieges come in the next updates. Deliveries to a seat's stockpile come with the Siege Camp.

---

### For the team
- Apply migrations **`0046_town_seats.sql`** and **`0047_seat_influence.sql`** (with 0044 and 0045, after main's 0043) to production D1 and deploy the account service (**`acct44`**).
- **Deploy the relay (`world136`).** It sends the Watch's ticks. An older relay sends none, and nothing else changes.
- Seats are behind **`SEATS_OPEN = "dev"`** in `server-account/wrangler.toml`. Change it to `"on"` to open them to everyone.
- **SEAT-COUNT**: run `ARENA2_PATH=/path/to/arena2 node tools/seatCount.mjs` to list every seat and the totals.
- A developer can strike a false seat from the registry in chat: `/seat strike <map id>`.
