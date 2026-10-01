-- SEAT2b part two (2026-10-01, Mac: "I want to finish the inprogress") - A SEAT'S REVOLT, ITS BATTLE'S WORKS AND THE
-- SIEGEWRIGHT'S DAY (bible/11-Multiplayer/Seats-Arc.md 6.2, 7.5, 7.7; src/net/fortLaw.js; server-account/src/seatTurning.js,
-- seatSiege.js, seatForts.js):
--   - a battle may be a REVOLT (7.7: "a relay-run uprising" in the holder's window - its attackers the relay's rebels, so
--     it names no attacking guild);
--   - a battle keeps its WORKS (`works`, the pass's `sx` - fortLaw.js siegeWorksPass: the Walls' tier, the Gatehouse's
--     vitality, the Barracks' guards, the Ram Kits and a Ram's vitality), frozen at its first pass so every pass agrees;
--   - a fortification project keeps whether a SIEGEWRIGHT began it (`wright`: "siege works a day sooner").
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the deploy runs (ACC1-CI).
--
-- SQLite cannot widen a CHECK in place, so the battles are rebuilt with their rows (nothing references the table) and
-- their index - every column the table has grown since 0051 kept (0052's field, 0060's rams).
CREATE TABLE IF NOT EXISTS town_seat_battles_new (
  week       INTEGER NOT NULL,
  key        INTEGER NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('siege', 'tourney', 'revolt')),
  tier       TEXT NOT NULL CHECK (tier IN ('palace', 'crown')),
  attacker   TEXT CHECK ((kind = 'revolt') = (attacker IS NULL)),
  defender   TEXT NOT NULL,
  starts_at  INTEGER NOT NULL,
  ends_at    INTEGER NOT NULL,
  moved      INTEGER NOT NULL DEFAULT 0 CHECK (moved IN (0, 1)),
  state      TEXT NOT NULL DEFAULT 'scheduled' CHECK (state IN ('scheduled', 'fought', 'forfeit', 'void')),
  at         INTEGER NOT NULL,
  field      TEXT,
  rams       INTEGER NOT NULL DEFAULT 0 CHECK (rams >= 0),
  works      TEXT,
  PRIMARY KEY (week, key)
);
INSERT INTO town_seat_battles_new (week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, state, at, field, rams)
  SELECT week, key, kind, tier, attacker, defender, starts_at, ends_at, moved, state, at, field, rams FROM town_seat_battles;
DROP TABLE town_seat_battles;
ALTER TABLE town_seat_battles_new RENAME TO town_seat_battles;
CREATE INDEX IF NOT EXISTS idx_town_seat_battles_start ON town_seat_battles (starts_at);

-- the Siegewright's project (Professions-Arc 3.3: "siege works a day sooner") - its starter's choice, kept with the
-- project as the Builder's stone is (`builder`)
ALTER TABLE town_seat_forts ADD COLUMN wright INTEGER NOT NULL DEFAULT 0 CHECK (wright IN (0, 1));
