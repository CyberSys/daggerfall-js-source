// PROF12 (2026-10-02) - ALCHEMY AND THE ENCHANTING LAYER AS THE SERVICE KEEPS THEM: the brewing act (/v1/prof/brew) -
// DFU's own recipe law on the Stores' cauldron (POTION_RECIPES and its hash, imported), the ingredients out (bought first),
// the potions a rank brews, Potent rolled (the rank's chance, an unbruised herb's +5, a Distiller's, a Master Alchemist's
// +40%), Alchemy's XP and its first time's 500 (none for a cauldron wholly of the Apothecaries' goods); the herbs picked
// unbruised counted at the harvest and spent by a brew; the Apothecaries' counter; a Transmuter's transmutations at the
// station (the smelt's route); Disenchanting (/v1/prof/disenchant) - a crafted piece into Arcane Essence by its record's
// points, its origin, Enchanting's XP, the piece gone. Driven through the real Worker over node:sqlite with every
// migration applied (test/accountDb.mjs). bible/06-Systems/Professions-Arc.md 3.3, 4.3, 4.5, 9.3, 37.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { standService, T0 } from './accountDb.mjs';
import { xpForRank } from '../src/net/professionLaw.js';
import { FIRST_CRAFT_XP, recipeById } from '../src/net/recipeLaw.js';
import { herbPatches, nodeKey } from '../src/net/nodeLaw.js';
import { utcDay } from '../src/net/marksLaw.js';
import { ACCOUNT_VERSION } from '../server-account/src/service.js';

const DAY = 86_400;
let _now = utcDay(T0) * DAY + 43_200;
const realNow = Date.now;
Date.now = () => _now * 1000;
test.after(() => { Date.now = realNow; });
let _rid = 0;
const rid = () => `brew-${String(++_rid).padStart(6, '0')}`;
const realRandom = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
/** The service's dice steered: every four-byte draw (a unit's - professions.js dice) all `b` while `fn` runs. */
async function steered(b, fn) {
  globalThis.crypto.getRandomValues = (arr) => (arr.byteLength === 4 ? (new Uint8Array(arr.buffer, arr.byteOffset, 4).fill(b), arr) : realRandom(arr));
  try { return await fn(); } finally { globalThis.crypto.getRandomValues = realRandom; }
}
const HEALING = ['p1:16', 'reagent:troll-blood', 'reagent:elixir-vitae', 'metal:mercury'];

async function stand() {
  const s = await standService({ PROFESSIONS_OPEN: 'on', MARKS_OPEN: 'on', BOARD_OPEN: 'on' });
  const raw = s.env.DB._raw;
  const stores = (who, m) => raw.prepare('SELECT origin, qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? AND qty > 0 ORDER BY origin').all(who.id, who.character, m).map((r) => [r.origin, Number(r.qty)]);
  const give = (who, m, origin, qty) => raw.prepare(`INSERT INTO prof_stores (player, char_id, material, origin, qty) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, material, origin) DO UPDATE SET qty = excluded.qty`).run(who.id, who.character, m, origin, qty);
  const xpOf = (who, prof) => Number(raw.prepare('SELECT xp FROM prof_tracks WHERE player = ? AND char_id = ? AND profession = ?').get(who.id, who.character, prof)?.xp ?? 0);
  const setXp = (who, prof, xp, { spec50 = null, spec100 = null } = {}) => raw.prepare(`INSERT INTO prof_tracks (player, char_id, profession, xp, spec50, spec100, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (player, char_id, profession) DO UPDATE SET xp = excluded.xp, spec50 = excluded.spec50, spec100 = excluded.spec100`)
    .run(who.id, who.character, prof, xp, spec50, spec100, _now);
  const brew = (who, potion, keys, extra = {}) => s.call('/v1/prof/brew', { character: who.character, potion, keys, rid: rid(), ...extra }, who.secret);
  /** a cauldron's goods given, each its own (or `origin`'s) one */
  const cauldron = (who, keys, origin = 'own') => { for (const k of keys) give(who, k, origin, 1 + (raw.prepare("SELECT qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? AND origin = ?").get(who.id, who.character, k, origin)?.qty ?? 0)); };
  const unbruised = (who, m) => Number(raw.prepare('SELECT qty FROM prof_unbruised WHERE player = ? AND char_id = ? AND material = ?').get(who.id, who.character, m)?.qty ?? 0);
  const fund = (who, marks) => raw.prepare('INSERT INTO marks (account, balance) VALUES (?, ?) ON CONFLICT (account) DO UPDATE SET balance = excluded.balance').run(who.id, marks);
  const balance = (who) => Number(raw.prepare('SELECT balance FROM marks WHERE account = ?').get(who.id)?.balance ?? 0);
  const product = (p) => raw.prepare('SELECT * FROM products WHERE provenance = ?').get(p) ?? null;
  /** a piece made through the real craft route */
  const craft = async (who, recipe) => {
    for (const { key, n } of recipeById(recipe).inputs) give(who, key, 'own', n + (raw.prepare("SELECT qty FROM prof_stores WHERE player = ? AND char_id = ? AND material = ? AND origin = 'own'").get(who.id, who.character, key)?.qty ?? 0));
    const r = await s.call('/v1/prof/craft', { character: who.character, recipe, clean: false, name: 'Silverthorn', rid: rid() }, who.secret);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.pieces[0].provenance;
  };
  const disenchant = (who, provenance, id = rid()) => s.call('/v1/prof/disenchant', { character: who.character, provenance, rid: id }, who.secret);
  return { ...s, raw, stores, give, xpOf, setXp, brew, cauldron, unbruised, fund, balance, product, craft, disenchant };
}

// ─── THE BREW (9.3) ──────────────────────────────────────────────────

test('PROF12 service: a Healing brewed at rank 0 - DFU\'s own recipe law on the Stores\' cauldron (any order), its four out (bought first), one potion, never Potent at Novice; 20 XP and the first time\'s 500, credited; asked twice one, nothing moved; the next no 500; short; another cauldron, another size or a key no Stores hold refused (bad-brew), nothing spent', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.cauldron(mac, HEALING, 'own');
  s.cauldron(mac, HEALING, 'own');
  s.give(mac, 'p1:16', 'bought', 1);
  const ask = { character: mac.character, potion: 'healing', keys: HEALING, rid: rid() };
  const r = await steered(0x00, () => s.call('/v1/prof/brew', ask, mac.secret));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.potion, r.body.count, r.body.potent, r.body.unbruised, r.body.steps, r.body.first, r.body.xp], ['healing', 1, 0, 0, 0, true, 20 + FIRST_CRAFT_XP], 'Novice: one potion, the lowest roll never Potent');
  assert.deepEqual([r.body.track.profession, r.body.track.xp, s.xpOf(mac, 'alchemy')], ['alchemy', 520, 520]);
  assert.deepEqual(r.body.keys, HEALING);
  assert.deepEqual([s.stores(mac, 'p1:16'), s.stores(mac, 'metal:mercury')], [[['own', 2]], [['own', 1]]], 'the bought Red Berries spent first');
  assert.deepEqual(r.body.stores.map((st) => st.material).sort(), [...HEALING].sort());
  s.env.PROFESSIONS_OPEN = 'off';
  const again = await s.call('/v1/prof/brew', ask, mac.secret);
  assert.deepEqual([again.body.repeat, again.body.xp, again.body.count], [true, 520, 1], 'asked twice: the row\'s answer - looked for before the switch (AUDIT 28 M2\'s rule)');
  assert.deepEqual((await s.brew(mac, 'healing', HEALING)).body, { error: 'prof-closed' }, 'a new brew under a shut switch');
  s.env.PROFESSIONS_OPEN = 'on';
  assert.deepEqual([s.stores(mac, 'metal:mercury'), s.xpOf(mac, 'alchemy')], [[['own', 1]], 520], 'nothing moved twice');
  const shuffled = await s.brew(mac, 'healing', [HEALING[3], HEALING[1], HEALING[0], HEALING[2]]);
  assert.deepEqual([shuffled.status, shuffled.body.first, shuffled.body.xp], [200, false, 20], 'DFU sorts the cauldron: any order; the second no 500');
  assert.deepEqual((await s.brew(mac, 'healing', HEALING)).body, { error: 'stores-short' }, 'the Red Berries\' own one left, the Troll\'s Blood none');
  s.cauldron(mac, HEALING, 'own');
  for (const keys of [['p1:9', ...HEALING.slice(1)], HEALING.slice(1), [...HEALING, 'metal:mercury'], ['metal:nope', ...HEALING.slice(1)], 'p1:16']) {
    const bad = await s.brew(mac, 'healing', keys);
    assert.deepEqual([bad.status, bad.body], [400, { error: 'bad-brew' }], JSON.stringify(keys));
  }
  assert.deepEqual((await s.brew(mac, 'elixir', HEALING)).body, { error: 'bad-recipe' });
  assert.deepEqual([s.stores(mac, 'metal:mercury'), s.raw.prepare('SELECT COUNT(*) AS n FROM prof_brews').get().n], [[['own', 1]], 2], 'refused before anything moved');
  // GOLD-MARKET: what gold bought takes no station
  s.give(mac, 'p1:16', 'own', 0);
  s.raw.prepare("DELETE FROM prof_stores WHERE player = ? AND material = 'p1:16'").run(mac.id);
  s.give(mac, 'p1:16', 'gold', 1);
  assert.deepEqual((await s.brew(mac, 'healing', HEALING)).body, { error: 'stores-gold' });
  assert.match(ACCOUNT_VERSION, /^acct69$/);
});

test('PROF12 service: the alchemist\'s ladder asked (Invisibility at 70, refused below, nothing spent); a brew\'s potions - 2 at Journeyman, a Brewer\'s 3, 3 at Master; Potent at Expert\'s 10% (the roll under it Potent, at it plain), a Distiller\'s +10 at 50, a Master Alchemist\'s +40% share; no 500 for a cauldron wholly of the Apothecaries\' goods', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const INVIS = ['gem:diamond', 'reagent:ectoplasm', 'reagent:rain-water', 'reagent:nectar'];
  s.cauldron(mac, INVIS);
  s.setXp(mac, 'alchemy', xpForRank(69));
  assert.deepEqual((await s.brew(mac, 'invisibility', INVIS)).body, { error: 'prof-rank' });
  assert.deepEqual(s.stores(mac, 'gem:diamond'), [['own', 1]], 'refused before anything moved');
  s.setXp(mac, 'alchemy', xpForRank(70));
  const inv = await steered(0xff, () => s.brew(mac, 'invisibility', INVIS));
  assert.deepEqual([inv.status, inv.body.count, inv.body.potent, inv.body.xp], [200, 2, 0, 120 + FIRST_CRAFT_XP], 'tier 6: 120, and two potions past Journeyman');
  const plain = async (spec50 = null, spec100 = null, rank = 50) => {
    s.setXp(mac, 'alchemy', xpForRank(rank), { spec50, spec100 });
    s.cauldron(mac, HEALING);
    return s.brew(mac, 'healing', HEALING);
  };
  assert.equal((await steered(0xff, () => plain())).body.count, 2, 'Journeyman: two');
  assert.equal((await steered(0xff, () => plain('brewer'))).body.count, 3, 'a Brewer: three at Journeyman');
  assert.equal((await steered(0xff, () => plain(null, null, 100))).body.count, 3, 'a Master: three');
  assert.equal((await steered(0x00, () => plain(null, null, 74))).body.potent, 0, 'below Expert: no chance at all');
  assert.equal((await steered(0x19, () => plain(null, null, 75))).body.potent, 25, 'Expert\'s 10: a roll of 9.8 Potent');
  assert.equal((await steered(0x1a, () => plain(null, null, 75))).body.potent, 0, 'a roll of 10.2 plain');
  assert.equal((await steered(0x19, () => plain('distiller', null, 50))).body.potent, 25, 'a Distiller\'s 10 at Journeyman');
  assert.equal((await steered(0x19, () => plain(null, null, 50))).body.potent, 0, 'a Journeyman who is none: no chance');
  assert.equal((await steered(0x34, () => plain(null, null, 100))).body.potent, 0, 'Master\'s 20: a roll of 20.3 plain');
  assert.equal((await steered(0x32, () => plain(null, null, 100))).body.potent, 25, 'a roll of 19.5 Potent - at +25%');
  assert.equal((await steered(0x00, () => plain(null, 'master-alchemist', 100))).body.potent, 40, 'a Master Alchemist\'s +40%');
  const LEVIT = ['reagent:ectoplasm', 'reagent:pure-water', 'reagent:nectar'];
  s.setXp(mac, 'alchemy', xpForRank(40));
  s.cauldron(mac, LEVIT, 'bought');
  const lev = await s.brew(mac, 'levitation', LEVIT);
  assert.deepEqual([lev.status, lev.body.first, lev.body.xp], [200, true, 80], 'the counter\'s goods alone: tier 4\'s 80 and no 500 (AUDIT 32 S1\'s law)');
});

// ─── THE UNBRUISED HERB (4.3, 5.2) ───────────────────────────────────

/** The first Swamp patch of tier 2 (its Bamboo - T0's day is winter) along a row from `from`. */
function bambooPatch(from = 300) {
  for (let x = from; x < 700; x++) {
    const p = herbPatches({ x, y: 200, day: utcDay(_now), climate: 228, confirmed: false }).find((q) => q.tier === 2);
    if (p) return { x, y: 200, climate: 228, ...p };
  }
  throw new Error('no patch');
}
const pick = (s, who, p, act) => s.call('/v1/prof/harvest', {
  character: who.character, node: nodeKey({ kind: 'herb', x: p.x, y: p.y, day: utcDay(_now), slot: p.slot }), kind: 'herbs',
  climate: p.climate, region: 21, act, at: _now - 2, rid: rid(),
}, who.secret);

test('PROF12 service: an herb picked unbruised is counted beside the Stores (a bruised one is not); a Free Action brewed of a BOUGHT Bamboo reckons none, of its own unbruised Bamboo one - +5% Potent, the roll of 13 Potent at Expert\'s 10 - and the count spent with it', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, 'herbalism', xpForRank(10));
  const p = bambooPatch();
  const clean = await pick(s, mac, p, { clean: true, bruised: false });
  assert.equal(clean.status, 200, JSON.stringify(clean.body));
  const got = clean.body.qty ?? s.stores(mac, 'p2:28')[0][1];
  assert.equal(s.unbruised(mac, 'p2:28'), got, 'the herb\'s units, counted unbruised');
  const bruised = await pick(s, mac, bambooPatch(p.x + 1), { clean: false, bruised: true });
  assert.equal(bruised.status, 200, JSON.stringify(bruised.body));
  assert.equal(s.unbruised(mac, 'p2:28'), got, 'a bruised herb is not');
  const FREE = ['p1:8', 'p2:28', 'part:venom', 'reagent:ichor'];
  s.setXp(mac, 'alchemy', xpForRank(75));
  s.give(mac, 'p2:28', 'bought', 1);
  s.cauldron(mac, ['p1:8', 'part:venom', 'reagent:ichor']);
  const boughtBrew = await steered(0x22, () => s.brew(mac, 'freeAction', FREE));
  assert.deepEqual([boughtBrew.status, boughtBrew.body.unbruised, boughtBrew.body.potent], [200, 0, 0], 'the bought Bamboo spent first: nobody\'s steady hand');
  assert.equal(s.unbruised(mac, 'p2:28'), got, 'nothing reckoned, nothing spent');
  s.cauldron(mac, ['p1:8', 'part:venom', 'reagent:ichor']);
  const own = await steered(0x22, () => s.brew(mac, 'freeAction', FREE));
  assert.deepEqual([own.status, own.body.unbruised, own.body.potent], [200, 1, 25], 'its own unbruised Bamboo: 10 + 5 - the roll of 13.3 Potent');
  assert.equal(s.unbruised(mac, 'p2:28'), got - 1, 'the count spent with it');
});

// ─── THE APOTHECARIES' COUNTER (4.5) AND THE TRANSMUTER (3.3) ────────

test('PROF12 service: the Apothecaries\' counter sells its sixteen into the Stores, bought, for silver burnt (Ichor 4 a measure, Unicorn Horn 40); a Transmuter\'s three Tin and a Mercury make one Copper at the station (bought in, bought out; no XP) - refused to all others (403, nothing spent)', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.fund(mac, 100);
  const ichor = await s.call('/v1/prof/stock', { character: mac.character, material: 'reagent:ichor', qty: 3, rid: rid() }, mac.secret);
  assert.equal(ichor.status, 200, JSON.stringify(ichor.body));
  assert.deepEqual([ichor.body.marks, ichor.body.balance, s.stores(mac, 'reagent:ichor')], [12, 88, [['bought', 3]]]);
  const horn = await s.call('/v1/prof/stock', { character: mac.character, material: 'reagent:unicorn-horn', qty: 2, rid: rid() }, mac.secret);
  assert.deepEqual([horn.status, horn.body.marks, s.balance(mac)], [200, 80, 8]);
  const smelt = (count = 1) => s.call('/v1/prof/smelt', { character: mac.character, recipe: 'transmute:tin', count, rid: rid() }, mac.secret);
  s.give(mac, 'metal:tin', 'own', 6);
  s.give(mac, 'metal:mercury', 'own', 2);
  s.setXp(mac, 'alchemy', xpForRank(100), { spec100: 'master-alchemist' });
  const no = await smelt();
  assert.deepEqual([no.status, no.body], [403, { error: 'prof-transmuter' }]);
  assert.deepEqual([s.stores(mac, 'metal:tin'), s.stores(mac, 'metal:mercury')], [[['own', 6]], [['own', 2]]], 'nothing spent');
  s.setXp(mac, 'alchemy', xpForRank(100), { spec100: 'transmuter' });
  const yes = await smelt();
  assert.equal(yes.status, 200, JSON.stringify(yes.body));
  assert.deepEqual([yes.body.own, yes.body.bought, yes.body.xp, yes.body.track], [1, 0, 0, null]);
  assert.deepEqual([s.stores(mac, 'metal:tin'), s.stores(mac, 'metal:mercury'), s.stores(mac, 'metal:copper')], [[['own', 3]], [['own', 1]], [['own', 1]]]);
  s.give(mac, 'metal:mercury', 'bought', 1);
  const b = await smelt();
  assert.deepEqual([b.body.own, b.body.bought, s.stores(mac, 'metal:copper')], [0, 1, [['bought', 1], ['own', 1]]], 'a bought Mercury: a bought Copper');
  assert.deepEqual((await smelt()).body, { error: 'stores-short' });
});

// ─── DISENCHANTING (9.3) ─────────────────────────────────────────────

test('PROF12 service: a Gold Ruby Ring disenchanted - its record\'s 2,160 points 21 Arcane Essence, own (its maker\'s, never sold), Enchanting XP 5 x 1 x 21; the piece\'s row gone; asked twice one; asked again under a new id, no piece; a Disenchanter\'s twice and 5 x 4 x 21 at 50', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  s.setXp(mac, 'jewelcrafting', xpForRank(25));
  const pv = await s.craft(mac, 'ring:gold:ruby');
  const id = rid();
  const r = await s.disenchant(mac, pv, id);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.provenance, r.body.recipe, r.body.points, r.body.essence, r.body.origin, r.body.xp], [pv, 'ring:gold:ruby', 2160, 21, 'own', 105]);
  assert.deepEqual([r.body.track.profession, r.body.track.xp, r.body.store], ['enchanting', 105, { material: 'essence:arcane', own: 21, bought: 0 }]);
  assert.equal(s.product(pv), null, 'the piece is gone');
  const again = await s.disenchant(mac, pv, id);
  assert.deepEqual([again.body.repeat, again.body.essence, s.stores(mac, 'essence:arcane'), s.xpOf(mac, 'enchanting')], [true, 21, [['own', 21]], 105]);
  const gone = await s.disenchant(mac, pv);
  assert.deepEqual([gone.status, gone.body], [404, { error: 'prof-no-piece' }]);
  s.setXp(mac, 'enchanting', xpForRank(50), { spec50: 'disenchanter' });
  const pv2 = await s.craft(mac, 'ring:gold:ruby');
  const d = await s.disenchant(mac, pv2);
  assert.deepEqual([d.body.essence, d.body.xp, s.stores(mac, 'essence:arcane')], [42, 420, [['own', 63]]], 'a Disenchanter\'s two an Essence; XP on the one');
  // a Gemcutter's gemmed ring carries its hand's points (+30%: 2,340) into the disenchant, from the service's own row
  s.setXp(mac, 'jewelcrafting', xpForRank(50), { spec50: 'gemcutter' });
  const cut = await s.craft(mac, 'ring:gold:ruby');
  s.setXp(mac, 'enchanting', 0);
  const g = await s.disenchant(mac, cut);
  assert.deepEqual([g.body.points, g.body.essence], [2340, 23], 'the jeweller\'s hand read off the piece');
  // ONE disenchant a piece, whatever came before it: the row's provenance is UNIQUE
  assert.throws(() => s.raw.prepare(`INSERT INTO prof_disenchants (player, rid, char_id, provenance, recipe, points, essence, origin, xp, at, n)
    VALUES (?, 'again-000001', ?, ?, 'ring:gold:ruby', 2160, 21, 'own', 0, 1, 'x')`).run(mac.id, mac.character, pv), /UNIQUE/);
});

test('PROF12 service: what may not be disenchanted - another\'s piece (403), a listed one (409), a piece too thin for an Essence - a dish (409), a bad id (400) - nothing moved; a piece bought for silver gives bought Essence, one bought with gold gold\'s', async () => {
  const s = await stand();
  const mac = await s.registered('Mac');
  const ann = await s.registered('Ann');
  s.setXp(mac, 'jewelcrafting', xpForRank(25));
  const mine = await s.craft(mac, 'ring:gold:ruby');
  const hers = await s.disenchant(ann, mine);
  assert.deepEqual([hers.status, hers.body], [403, { error: 'prof-not-yours' }]);
  s.raw.prepare('UPDATE products SET listed = 1 WHERE provenance = ?').run(mine);
  const listed = await s.disenchant(mac, mine);
  assert.deepEqual([listed.status, listed.body], [409, { error: 'prof-piece-busy' }]);
  assert.notEqual(s.product(mine), null, 'still there');
  s.raw.prepare('UPDATE products SET listed = 0 WHERE provenance = ?').run(mine);
  const stew = await s.craft(mac, 'stew:north');
  const dish = await s.disenchant(mac, stew);
  assert.deepEqual([dish.status, dish.body], [409, { error: 'prof-no-essence' }]);
  assert.deepEqual((await s.disenchant(mac, 'not-a-piece')).body, { error: 'bad-piece' });
  assert.deepEqual([s.stores(mac, 'essence:arcane'), s.xpOf(mac, 'enchanting')], [[], 0], 'nothing moved');
  s.raw.prepare("UPDATE products SET bought_with = 'marks' WHERE provenance = ?").run(mine);
  assert.equal((await s.disenchant(mac, mine)).body.origin, 'bought');
  const theirs = await s.craft(mac, 'ring:gold:ruby');
  s.raw.prepare("UPDATE products SET char_id = 'char-another' WHERE provenance = ?").run(theirs);
  assert.equal((await s.disenchant(mac, theirs)).body.origin, 'bought', 'another character\'s make, never sold: bought - own is the maker\'s alone');
  const other = await s.craft(mac, 'ring:gold:ruby');
  s.raw.prepare("UPDATE products SET bought_with = 'gold' WHERE provenance = ?").run(other);
  assert.equal((await s.disenchant(mac, other)).body.origin, 'gold');
  assert.deepEqual(s.stores(mac, 'essence:arcane'), [['bought', 42], ['gold', 21]]);
});
