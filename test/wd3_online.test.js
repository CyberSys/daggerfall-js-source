// WD3 (2026-10-01, Mac: "ensure this doesn't conflict or regress anything (For example housing customization)") -
// ONLINE, THE TOWNS ARE THE ROOM'S. Beautiful Villages and Beautiful Cities are the room's switches
// (systems/onlineLane.js), and a home is a building KEY, which names a building only in one layout of its town: the
// account service keeps the layout each home's town was bought in (migration 0046, homes.js), a town's later homes
// take its first home's, and every client reads the towns holding homes at its online boot and keeps each in its layout
// (scenes/world.js, systems/layoutPins.js).
//
// Held here, on the real service over node:sqlite with every migration applied: the column and its index; a claim
// storing its town's layout, the town's first home deciding for every later one (a town of homes from before WD3
// stays Daggerfall's own whatever a client sends); a bad stamp refused; /v1/homes/layouts - any session's, one row a
// town (its oldest home's), a town released when its last home goes; and by source the client's ask, the boot's wait
// and retries, and the room's switches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { standService, d1, T0 } from './accountDb.mjs';
import { realmJoinAt } from './realmSeat.mjs';
import { ROUTES, OPEN_ROUTES } from '../server-account/src/service.js';
import { HOME_LAYOUT_MAX, HOME_LAYOUTS_MAX, HOME_LAYOUT_MODS } from '../src/net/homeLaw.js';
import { ONLINE_ROOM_MOD_KEYS } from '../src/systems/onlineLane.js';
import { MOD_SETTINGS } from '../src/systems/modSettings.js';
import { LAYOUT_MODS } from '../src/systems/layoutPins.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const BV = 'beautiful-villages@1.4.2', BOTH = 'beautiful-cities@0.5.0+beautiful-villages@1.4.2';
const TOWN = 1291010263, CLASSIC_TOWN = 1291010999;

test('WD3 online, the record: migration 0046 adds `homes.layout` (NULL - Daggerfall\'s own town, every home before it) and the town-age index the claim and the read ask; the law\'s bounds', () => {
  const m = src('server-account/migrations/0046_home_layout.sql');
  assert.match(m, /^ALTER TABLE homes ADD COLUMN layout TEXT;$/m);
  assert.match(m, /^CREATE INDEX IF NOT EXISTS idx_homes_town_age ON homes \(map_id, bought_at, building_key\);$/m);
  const db = d1()._raw;
  assert.ok(db.prepare('PRAGMA table_info(homes)').all().some((c) => c.name === 'layout' && c.type === 'TEXT' && c.dflt_value === null));
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_homes_town_age'").get());
  assert.equal(HOME_LAYOUT_MAX, 96); assert.equal(HOME_LAYOUTS_MAX, 20000);
  assert.deepEqual(HOME_LAYOUT_MODS, LAYOUT_MODS);
  assert.ok(ROUTES.has('/v1/homes/layouts') && !OPEN_ROUTES.has('/v1/homes/layouts'), 'behind a session - any session');
});

test('WD3 online, the service: a claim keeps the layout its client\'s town stands in - for the town\'s FIRST home; every later home of the town takes the first one\'s whatever its client sends; a town of homes from before (NULL) stays Daggerfall\'s own; a stamp the law does not take is refused; an owner\'s homes say their towns\' layouts; the layouts read answers one row a town, its oldest home\'s, to any session, and a town whose last home goes is released', async (t) => {
  let now = T0;
  t.mock.method(Date, 'now', () => now * 1000);
  const { env, call, registered, seatHome } = await standService();
  const aldric = await registered('Aldric'), mara = await registered('Mara'), corin = await registered('Corin');
  const home = (extra) => ({ mapId: TOWN, buildingKey: 0x10203, region: 17, price: 42000, ...extra });
  const bad = await seatHome(aldric, home({ layout: 'classic' }));
  assert.deepEqual([bad.status, bad.body?.error], [400, 'bad-home'], 'classic is no field, never a stamp');
  assert.deepEqual((await seatHome(aldric, home({ layout: 'detailed-ships@1.0.0' }))).body?.error, 'bad-home', 'a mod that moves no building');
  const a = await seatHome(aldric, home({ layout: BV }));
  assert.equal(a.status, 200, JSON.stringify(a.body));
  now += 60;
  const b = await seatHome(mara, home({ buildingKey: 0x10305, layout: BOTH }));
  assert.equal(b.status, 200);
  const row = (key) => env.DB._raw.prepare('SELECT layout FROM homes WHERE map_id = ? AND building_key = ?').get(TOWN, key)?.layout;
  assert.equal(row(0x10203), BV);
  assert.equal(row(0x10305), BV, 'the town keeps the layout its first home was bought in - one town for the room');
  // a town whose homes are from before WD3
  env.DB._raw.prepare(`INSERT INTO homes (map_id, building_key, player, char_id, owner_name, region, entry, price, bought_at, paid)
    VALUES (?, ?, ?, ?, 'Old', 17, 'private', 1000, ?, 0)`).run(CLASSIC_TOWN, 0x101, corin.id, 'char-old', T0 - 86400);
  now += 60;
  assert.equal((await seatHome(corin, home({ mapId: CLASSIC_TOWN, buildingKey: 0x202, layout: BV }))).status, 200);
  assert.equal(env.DB._raw.prepare('SELECT layout FROM homes WHERE map_id = ? AND building_key = ?').get(CLASSIC_TOWN, 0x202).layout, null, 'a town bought in before the mods stays Daggerfall\'s own');
  // an owner's own homes say the layout each town keeps; none where it is Daggerfall's
  assert.deepEqual((await call('/v1/homes/mine', {}, mara.secret)).body.homes.map((h) => [h.mapId, h.layout]), [[TOWN, BV]]);
  assert.ok((await call('/v1/homes/mine', {}, corin.secret)).body.homes.every((h) => !('layout' in h)));
  // the layouts read: any session, a guest's too
  const guest = (await call('/v1/auth/guest', { ...(await import('../src/net/legalLaw.js')).ACCEPTED })).body.secret;
  const read = await call('/v1/homes/layouts', {}, guest);
  assert.equal(read.status, 200);
  assert.deepEqual(read.body, { towns: [[TOWN, BV], [CLASSIC_TOWN, null]] });
  assert.equal((await call('/v1/homes/layouts', {})).status, 401, 'a stranger reads nothing');
  // the first home sold: the town keeps the layout its homes stand in (the next oldest took it)
  assert.equal((await call('/v1/homes/release', { mapId: TOWN, buildingKey: 0x10203, realm: await realmJoinAt(env, aldric.secret, a.character) }, aldric.secret)).status, 200);
  assert.deepEqual((await call('/v1/homes/layouts', {}, guest)).body.towns, [[TOWN, BV], [CLASSIC_TOWN, null]]);
  // its last home sold: the town is released, and the next buyer's town stands as the room's mods lay it out now
  assert.equal((await call('/v1/homes/release', { mapId: TOWN, buildingKey: 0x10305, realm: await realmJoinAt(env, mara.secret, b.character) }, mara.secret)).status, 200);
  assert.deepEqual((await call('/v1/homes/layouts', {}, guest)).body.towns, [[CLASSIC_TOWN, null]]);
  now += 60;
  assert.equal((await seatHome(mara, home({ buildingKey: 0x10305, layout: BOTH }))).status, 200);
  assert.deepEqual((await call('/v1/homes/layouts', {}, guest)).body.towns, [[TOWN, BOTH], [CLASSIC_TOWN, null]]);
});

test('WD3 online, the client: the homes\' towns asked at the boot, before the first town is built (a wait of HOME_LAYOUTS_WAIT_MS, then asked again behind the play, each wait longer); online the pins are the service\'s alone - a save\'s own records would stand one player\'s town apart from the room\'s; the claim sends its town\'s layout, none for Daggerfall\'s', () => {
  assert.match(src('src/net/accountClient.js'), /layouts: \(\) => post\('\/v1\/homes\/layouts', \{\}\),/);
  const W = src('src/scenes/world.js');
  assert.match(W, /let _homeLayoutsAsk = homesApi \? homesApi\.layouts\(\)\.catch\(\(\) => null\) : null;/);
  assert.match(W, /const heard = await Promise\.race\(\[_homeLayoutsAsk, new Promise\(\(res\) => setTimeout\(\(\) => res\(null\), HOME_LAYOUTS_WAIT_MS\)\)\]\);/);
  assert.match(W, /if \(attempt > HOME_LAYOUTS_RETRIES \|\| !homesApi\)/);
  assert.match(W, /\}, HOME_LAYOUTS_WAIT_MS \* attempt\);/);
  assert.match(W, /_serverLayoutRecords = towns\.filter\(\(t\) => Array\.isArray\(t\)\)\.map\(\(\[mapId, layout\]\) => \(\{\n {6}locationKey: _layoutKeyOfMapId\.get\(Number\(mapId\) >>> 0\) \?\? null, stamp: typeof layout === 'string' \? layout : undefined, kind: 'house',/);
  assert.match(W, /const records = homeLayoutsOnline \? \(_serverLayoutRecords \?\? \[\]\) : layoutRecordsOf\(/);
  assert.match(src('src/systems/onlineHomes.js'), /call: \(\/\*\* @type \{any\} \*\/ at\) => homes\.claim\(\{ mapId, buildingKey, region, price, realm: at, \.\.\.\(layout \? \{ layout \} : \{\}\) \}\),/);
});

test('WD3 online, the room: both switches are the room\'s (forced on - two players who disagreed would walk two towns, one through the other\'s houses), each a mod\'s one Enabled, on by default', () => {
  for (const v of ['beautiful-villages', 'beautiful-cities']) {
    assert.deepEqual({ ...ONLINE_ROOM_MOD_KEYS[v] }, { Enabled: true }, v);
    assert.deepEqual(Object.keys(MOD_SETTINGS[v].keys), ['Enabled']);
    assert.equal(MOD_SETTINGS[v].keys.Enabled.default, true);
    assert.equal(MOD_SETTINGS[v].author, 'carademono');
  }
  assert.equal(MOD_SETTINGS['beautiful-villages'].title, 'Beautiful Villages of Daggerfall');
  assert.equal(MOD_SETTINGS['beautiful-cities'].title, 'Beautiful Cities of Daggerfall');
});
