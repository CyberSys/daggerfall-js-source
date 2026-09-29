-- CUSTOMS-GRANT (2026-09-29) - A CUSTOMS GRANT, SPENT: ONE ROW AN ACCOUNT - THE CHARACTER IT BROUGHT IN, AND WHEN.
--
--   npx wrangler d1 migrations apply daggerfall-accounts --remote
--
-- Applied exactly once through the `d1_migrations` ledger, which the
-- deploy runs (ACC1-CI). One new table; no table changes shape.
--
-- Mac, 2026-09-29: "Please activate ToxicTaco69 character for online
-- mode. He cant access it". Customs admits an offline character only
-- if the census (0020, widened by 0022) saw it before the realm began,
-- and the census is FROZEN - that is what keeps a Copy to offline's new
-- id out (L1-F5) - so a character the service never saw is refused
-- ("The realm has no record of this character from before it opened")
-- and nobody had any way to let it in.
--
-- WHO HOLDS A GRANT IS NOT HERE. It is CUSTOMS_GRANT_HANDLES in the
-- service's config (server-account/wrangler.toml), for the reason
-- DEVELOPER_HANDLES is: granting one is a reviewed, deployed edit, not
-- a write into a live database. What IS here is its USE - MOD1's law
-- (0006): a power with no record of its use is a power nobody can
-- review.
--
-- ONE CHARACTER, ONCE. The key is the account, so a grant brings in one
-- character, and a second is refused by the same batch that would have
-- made it (src/realm.js customsRealm). An open grant would be L1-F5's
-- dupe for that account: a realm character copied to offline would come
-- back in under the copy's new id, as often as asked. The census
-- remembers the character too - customs writes it a row and spends it
-- with every other row of it - so it never comes in again, from any
-- account. The account row goes, and its grant's record with it
-- (CASCADE).
CREATE TABLE IF NOT EXISTS customs_grants (
  player   TEXT PRIMARY KEY,
  char_id  TEXT NOT NULL,
  at       INTEGER NOT NULL,
  FOREIGN KEY (player) REFERENCES players(id) ON DELETE CASCADE
);
