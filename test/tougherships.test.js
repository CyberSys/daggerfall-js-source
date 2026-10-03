// TOUGHER-SHIPS, QUICK-REPAIRS, SALVAGE (2026-10-03, Mac: "For naval combat and such I want to buff health of ships,
// allow for more streamlined repairs, allow sunken vessels to provide nessecary materials so you dont have to rely on
// the port"): every ship stands SHIP_TOUGHNESS times the punishment - her hull, her canvas and her men - with the yard's
// prices and a store's work moved so a wreck costs what it did and an older save loads as it was; her hands spend her
// stores on their own once a fight is over (thriftily, past the free mending) and the order MAKE REPAIRS works under
// fire; a sunk ship leaves her wreckage afloat - carpenter's stores and powder for whoever hauls it in.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sea } from './navalSea.mjs';
import { HULL, HULL_BUILDS, SHIP_CLASSES, SHIP_TOUGHNESS, hullBuild, firstBuildOf, classById, BARREL } from '../src/systems/naval/navalShips.js';
import { shotDamage, ballMen, repairCost, REPAIR_PRICE, FIRE_CREW_S, SHIP_STATES } from '../src/systems/naval/navalDamage.js';
import { storesToWhole, STORE_POINTS, STORE_PRICE, FIELD_QUIET_S, FIELD_MEND_CAP, SEA_REPAIR_PER_S, SEA_REPAIR_UNDER_FIRE } from '../src/systems/naval/navalYard.js';
import { salvageOf, flotsamKeys, isSalvage, SALVAGE_LOT, SALVAGE_SHARE, SALVAGE_BARRELS, LOT_KEYS } from '../src/systems/naval/navalPlunder.js';
import { navalWireRecord, validNavalRecord, navalHitData, NAVAL_HIT_MAX } from '../src/systems/naval/navalWire.js';
import { mintStores, storesIn, spendStore, isStores } from '../src/systems/naval/navalStores.js';
import { savedHurts, ramMen } from '../src/scenes/navalHost.js';
import { CREW_ORDERS, mendScaleOf } from '../src/systems/naval/shipCrew.js';
import { FEATURES } from '../src/systems/features.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} (${a} against ${b})`);
const small = HULL_BUILDS[HULL.SmallShip];

/** A Small Ship of mine at sea, crewed, her hurts a record of today's (her whole said), `stores` in her hold - the hold
 *  the yard, the repairs and a wreck's salvage all stow into. */
async function atSea({ hull = small.hullHp, sail = small.sailHp, crew = 24, fire = 0, state = 'afloat', stores = 0, barrels = 4, settings = {}, boatHull = HULL.SmallShip } = {}) {
  const b = hullBuild(boatHull);
  const h = await sea({ hull: boatHull, settings: { ShipsAtSea: 'off', Boarders: false, ...settings } });
  h.boat.crewed = b.crew > 0;
  h.host.restoreSaveData({ v: 1, boats: { 42: { hull, maxHull: b.hullHp, sail, maxSail: b.sailHp, crew, fire, state, barrels } }, notoriety: {}, day: 1, raids: [] });
  const hold = stores ? [mintStores(stores)] : [];
  h.deps.stores = { count: () => storesIn(hold), spend: () => spendStore(hold), add: (_b, n) => { hold.push(mintStores(n)); return true; } };
  h.deps.board.giveItems = (items, to) => { h.log.given.push([items.length, to]); if (to === h.boat) hold.push(...items); else (h.pack ??= []).push(...items); return { left: [] }; };
  h.hold = hold;
  return h;
}
const frames = (h, seconds) => { for (let t = 0; t < seconds - 1e-9; t += 0.1) h.host.frame(0.1); };
const hullOf = (h) => h.host._myState(h.boat).damage.hull;
/** A peer's blow, past one hit's most as several. */
function blow(h, e, from, hull) {
  for (let left = Math.max(0, hull); left > 0; left -= NAVAL_HIT_MAX) h.host.applyPeerHit(from, navalHitData('local', { n: e.n, hull: Math.min(left, NAVAL_HIT_MAX) }));
}
function place(h, classId, pos) {
  const e = h.host._sea.get(h.host.spawnShip(classId, { range: Math.hypot(pos[0], pos[2]), bearing: Math.atan2(pos[0], pos[2]) }));
  e.ship.pos = [...pos];
  h.host.frame(0.1);
  return e;
}

// ── TOUGHER-SHIPS ────────────────────────────────────────────────────────────────────────────────────────────────

test('TOUGHER-SHIPS every hull stands SHIP_TOUGHNESS times her first build\'s timbers and canvas, the classes scaling it; a ball\'s men its gun\'s over the toughness on the ball\'s own roll, a fire\'s and a ram\'s the same; the yard\'s whole for a wreck what it was, a store\'s work the same share (mutants: a hull untoughened, the men untoughened, the prices unmoved)', () => {
  assert.equal(SHIP_TOUGHNESS, 1.6);
  for (const [i, b] of HULL_BUILDS.entries()) {
    const first = firstBuildOf(i);
    assert.equal(b.hullHp, Math.round(first.hullHp * SHIP_TOUGHNESS), `hull ${i}`);
    assert.equal(b.sailHp, Math.round(first.sailHp * SHIP_TOUGHNESS), `canvas ${i}`);
  }
  assert.deepEqual(HULL_BUILDS.map((b) => b.hullHp), [96, 240, 672, 832, 896]);
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => firstBuildOf(i).hullHp), [60, 150, 420, 520, 560], 'the numbers they were built with');
  for (const c of SHIP_CLASSES) assert.ok(c.hullHp > firstBuildOf(c.hull).hullHp, `${c.id} toughened with her hull`);
  // a ball's men: whole men, its gun's over the toughness on the average of its roll
  for (const men of [0, 1, 2, 3]) {
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += ballMen(men, (i + 0.5) / 1000);
    near(sum / 1000, men / SHIP_TOUGHNESS, 1e-3, `${men} a ball`);
    assert.ok(Number.isInteger(ballMen(men, 0.37)));
  }
  assert.deepEqual([ballMen(1, 0), ballMen(1, 0.999)], [0, 1], 'the roll decides the odd man');
  assert.equal(shotDamage({ hull: 14, sail: 3, crew: 1 }, 'hull', { roll: 0.2 }).crew, ballMen(1, 0.2));
  assert.equal(shotDamage({ hull: 14, sail: 3, crew: 1 }, 'rig', { roll: 0.9 }).crew, ballMen(1, 0.9));
  assert.equal(FIRE_CREW_S, 10 * SHIP_TOUGHNESS, 'a fire takes a man the slower');
  assert.equal(ramMen(40 * SHIP_TOUGHNESS * 3), 3, 'a ram\'s men by the toughened hull it deals');
  // the yard and the stores: a wreck costs what it did, and takes as many stores
  assert.deepEqual([REPAIR_PRICE.hull, REPAIR_PRICE.sail, REPAIR_PRICE.crew], [7, 4, 30]);
  const wreck = (b) => ({ hull: 0, maxHull: b.hullHp, sail: 0, maxSail: b.sailHp, crew: 0, maxCrew: 0 });
  const was = 420 * 12 + 160 * 6;
  const now = repairCost(wreck(small));
  assert.ok(now <= was && now >= was * 0.9, `a wrecked Small Ship whole for ${now} (${was} before)`);
  assert.equal(STORE_POINTS, 64);
  assert.equal(STORE_PRICE, Math.round(64 * 7 * 0.7));
  assert.equal(storesToWhole(wreck(small)), 13, 'thirteen stores, as before');
});

test('TOUGHER-SHIPS a save from before loads her hurts as the share of her old whole they were - a whole ship whole, a half-holed one half - and a save of today as it says; she is saved with her whole (mutants: the record read as points, the whole unsaved)', async () => {
  const b = hullBuild(HULL.SmallShip);
  assert.deepEqual(savedHurts({ hull: 210, sail: 80, crew: 20 }, HULL.SmallShip, { maxHull: b.hullHp, maxSail: b.sailHp }), { hull: b.hullHp / 2, sail: b.sailHp / 2, crew: 20 }, 'a record from before: shares of her first build');
  assert.deepEqual(savedHurts({ hull: 336, maxHull: 672, sail: 256, maxSail: 256 }, HULL.SmallShip, { maxHull: 672, maxSail: 256 }), { hull: 336, maxHull: 672, sail: 256, maxSail: 256 }, 'today\'s: as said');
  assert.equal(savedHurts({ hull: 0, sail: 0, state: 'wrecked' }, HULL.SmallShip, { maxHull: 672, maxSail: 256 }).hull, 0, 'a wreck a wreck');
  assert.equal(savedHurts({ hull: 60, sail: 0 }, HULL.Rowboat, { maxHull: 96, maxSail: 0 }).sail, 0, 'a rowboat\'s no canvas');
  // the host: an older save's whole Small Ship stands whole, and is saved with her whole
  const h = await sea({ hull: HULL.SmallShip, settings: { ShipsAtSea: 'off' } });
  h.host.restoreSaveData({ v: 1, boats: { 42: { hull: 420, sail: 160, crew: 24, fire: 0, state: 'afloat', barrels: 4 } }, notoriety: {}, day: 1, raids: [] });
  h.host.frame(0.1);
  assert.equal(h.host.hudModel().ship.hull, 1, 'whole, never 62% of a toughened hull');
  const rec = h.host.getSaveData().boats[42];
  assert.deepEqual([rec.hull, rec.maxHull, rec.sail, rec.maxSail], [b.hullHp, b.hullHp, b.sailHp, b.sailHp]);
});

// ── SALVAGE ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('SALVAGE a sunk ship\'s wreckage: her stores SALVAGE_SHARE of her hull in a store\'s work (one at least), her powder SALVAGE_BARRELS; never a hold\'s lot; on the wire a key of its own - an older build reads none of it, and a word of wreckage alone is still said (mutants: the stores unscaled, the lot among LOT_KEYS, the key unread)', () => {
  assert.equal(SALVAGE_SHARE, 0.4);
  assert.equal(SALVAGE_BARRELS, 2);
  for (const c of SHIP_CLASSES) {
    const s = salvageOf(c);
    assert.equal(s.stores, Math.max(1, Math.round((c.hullHp * SALVAGE_SHARE) / STORE_POINTS)), c.id);
    assert.equal(s.barrels, SALVAGE_BARRELS, `${c.id}: every class carries guns`);
  }
  assert.deepEqual(['pirateSloop', 'pirateBrig', 'pirateFlagship'].map((id) => salvageOf(classById(id)).stores), [2, 4, 6], 'more from a bigger hull');
  assert.deepEqual(salvageOf(null), { stores: 0, barrels: 0 });
  assert.equal(isSalvage(SALVAGE_LOT), true);
  assert.equal(LOT_KEYS.includes(SALVAGE_LOT), false, 'a lot past an older build\'s LOT_KEYS would fail its door, and the word with it');
  // the wire: the wreckage on `w`, the casks on `f`
  const word = navalWireRecord({ casks: [{ id: 7, pos: [10, 0, 20], from: 'pirateBrig', lot: SALVAGE_LOT }, { id: 8, pos: [12, 0, 20], from: 'pirateBrig', lot: 'S' }] });
  assert.deepEqual(word.w, [[7, 10, 0, 20, SHIP_CLASSES.findIndex((c) => c.id === 'pirateBrig')]]);
  assert.equal(word.f.length, 1);
  const back = validNavalRecord(JSON.parse(JSON.stringify(word)));
  assert.deepEqual(back.casks.map((c) => [c.id, c.lot, c.from]), [[8, 'S', 'pirateBrig'], [7, SALVAGE_LOT, 'pirateBrig']]);
  assert.ok(navalWireRecord({ casks: [{ id: 9, pos: [0, 0, 0], from: 'navyCutter', lot: SALVAGE_LOT }] })?.w, 'a word of wreckage alone');
  assert.equal(validNavalRecord({ ...word, w: [[7, 10, 0, 20, 1, 0]] }), null, 'a malformed piece fails the word');
  const older = { ...word };
  delete older.w;
  assert.equal(validNavalRecord(older).casks.length, 1, 'an older build\'s word: no wreckage');
});

test('SALVAGE on the host: a ship sunk leaves her wreckage afloat beside her casks; sailed through, her stores go into my hold and her powder fills my stern\'s barrels to their stock; a swimmer\'s into the pack; a boat that rolls no barrels takes the stores alone; the crew stows mine before the sea goes (mutants: no wreckage, the stores unstowed, the barrels past stock, the swimmer\'s lost, the stow skipping it)', async () => {
  const h = await atSea({ barrels: 3 });
  const e = place(h, 'pirateBrig', [300, 0, 0]);
  blow(h, e, 'local', Math.floor(e.ship.damage.hull - 1));
  frames(h, 2);
  blow(h, e, 'local', Math.ceil(e.ship.damage.hull + 1));
  frames(h, 0.5);
  assert.equal(e.ship.damage.state, SHIP_STATES.sinking);
  const afloat = () => h.host._shots.floaters().filter((f) => f.kind === 'flotsam');
  const wrecks = afloat().filter((f) => isSalvage(f.lot));
  assert.equal(wrecks.length, 1, 'her wreckage');
  assert.equal(wrecks[0].from, 'pirateBrig');
  assert.equal(afloat().length, flotsamKeys(e.ship.cls, e.ship.seed).length + 1, 'beside her casks');
  // sailed through: into my hold, and her powder to my barrels
  const st = h.host._myState(h.boat);
  h.host._shots.floater(wrecks[0].id).pos = [0, 0, 0];
  frames(h, 0.3);
  const got = salvageOf(classById('pirateBrig'));
  assert.equal(storesIn(h.hold), got.stores, 'her stores in my hold');
  assert.equal(st.guns.barrels, BARREL.stock, 'her powder: my barrels to their stock, never past it');
  assert.ok(h.log.say.includes(`You haul her wreckage aboard: ${got.stores} carpenter's stores and 1 fire barrel.`), h.log.say.join(' | '));
  assert.equal(afloat().some((f) => isSalvage(f.lot)), false, 'hauled in');
  // a Large Boat rolls no barrels: the stores alone
  const lb = await atSea({ boatHull: HULL.LargeBoat, hull: hullBuild(HULL.LargeBoat).hullHp, sail: hullBuild(HULL.LargeBoat).sailHp, crew: 0, barrels: 0 });
  lb.host._shots.dropFlotsam({ id: 'w1', pos: [0, 0, 0], lot: SALVAGE_LOT, from: 'pirateSloop' });
  frames(lb, 0.3);
  assert.equal(storesIn(lb.hold), salvageOf(classById('pirateSloop')).stores);
  assert.equal(lb.host._myState(lb.boat).guns.barrels, 0);
  assert.ok(lb.log.say.includes('You haul her wreckage aboard: 2 carpenter\'s stores.'));
  // a swimmer with no boat of mine: into the pack
  const s = await sea({ hull: null });
  s.deps.swimming = () => true;
  const pack = [];
  s.deps.board.giveItems = (items, to) => { s.log.given.push([items.length, to]); pack.push(...items); return { left: [] }; };
  s.host._shots.dropFlotsam({ id: 'w2', pos: [0.3, 0, 0.2], lot: SALVAGE_LOT, from: 'navyCutter' });
  s.run(0.3);
  assert.deepEqual(s.log.given, [[1, null]], 'into the pack');
  assert.equal(storesIn(pack), salvageOf(classById('navyCutter')).stores);
  assert.ok(pack.every(isStores));
  assert.ok(s.log.say.some((t) => t.startsWith('You pick through the wreckage: 4 carpenter\'s stores')));
  // too heavy for the pack: said
  const full = await sea({ hull: null });
  full.deps.swimming = () => true;
  full.deps.board.giveItems = (items) => ({ left: items });
  full.host._shots.dropFlotsam({ id: 'w3', pos: [0.3, 0, 0.2], lot: SALVAGE_LOT, from: 'pirateSloop' });
  full.run(0.3);
  assert.ok(full.log.say.some((t) => /too heavy to carry/.test(t)));
  // the crew stows my wreckage before the sea goes
  const k = await atSea();
  const sunk = place(k, 'merchantGalleon', [300, 0, 0]);
  blow(k, sunk, 'local', Math.floor(sunk.ship.damage.hull - 1));
  frames(k, 2);
  blow(k, sunk, 'local', Math.ceil(sunk.ship.damage.hull + 1));
  frames(k, 0.5);
  const r = k.host.stowPlunder();
  assert.equal(storesIn(k.hold), salvageOf(classById('merchantGalleon')).stores, 'her wreckage\'s stores stowed');
  assert.equal(r.casks, flotsamKeys(sunk.ship.cls, sunk.ship.seed).length + 1);
  assert.equal(k.host._shots.floaters().filter((f) => f.kind === 'flotsam').length, 0);
});

// ── QUICK-REPAIRS ────────────────────────────────────────────────────────────────────────────────────────────────

test('QUICK-REPAIRS her hands spend her stores on their own once a fight is over - no order, past the free mending\'s cap, to whole, said once; never on what the free mending reaches, never with a hostile near, never with the switch off; the stores giving out said once (mutants: the stores spent under the cap, the quiet unread, the switch unread, the word every frame)', async () => {
  // past the cap: her stores at it, at the repairs' pace, to whole
  const h = await atSea({ hull: Math.round(small.hullHp * 0.7), stores: 10 });
  frames(h, 0.2);
  const h0 = hullOf(h);
  frames(h, 2);
  const pace = SEA_REPAIR_PER_S * mendScaleOf(h.host.crewOf(h.boat).morale) * small.hullHp;
  near(hullOf(h) - h0, pace * 2, pace * 0.15, 'at the repairs\' pace, unordered');
  assert.equal(h.host.hudModel().ship.repairing, true, 'REPAIRING on the plate');
  assert.equal(h.host.crewOf(h.boat).order, CREW_ORDERS.stand, 'no order given');
  frames(h, 60);
  assert.equal(hullOf(h), small.hullHp, 'whole');
  assert.equal(h.log.say.filter((l) => /Repairs done/.test(l)).length, 1, 'said once');
  const left = storesIn(h.hold);
  assert.ok(left < 10 && left >= 10 - Math.ceil((small.hullHp * 0.3) / STORE_POINTS), `her stores spent on the work (${left} left)`);
  frames(h, 5);
  assert.equal(h.log.say.filter((l) => /Repairs done/.test(l)).length, 1, 'and never again');
  // under the cap: the free mending's work, and her stores kept
  const t = await atSea({ hull: Math.round(small.hullHp * 0.3), stores: 10 });
  frames(t, 10);
  assert.equal(storesIn(t.hold), 10, 'no store on what her hands do for nothing');
  assert.ok(hullOf(t) > small.hullHp * 0.3, 'the free mending at it');
  t.host._myState(t.boat).damage.repair({ hull: small.hullHp * FIELD_MEND_CAP - hullOf(t) + 1, sail: 0, crew: 0 });
  frames(t, 2);
  assert.ok(storesIn(t.hold) < 10 || t.host._myState(t.boat).credit > 0, 'past the cap: her stores');
  // a hostile near: nothing
  const p = await atSea({ hull: Math.round(small.hullHp * 0.7), stores: 10 });
  const pid = p.host.spawnShip('pirateBrig', { range: 200, temper: 'bold' });
  frames(p, 0.2);
  const p0 = hullOf(p);
  for (let s = 0; s < 3; s += 0.1) { p.host._sea.get(pid).ship.pos = [0, 0, 200]; p.host.frame(0.1); }
  assert.ok(hullOf(p) <= p0, 'no repairs with a pirate in the offing, unordered');
  assert.equal(storesIn(p.hold), 10);
  // the switch off
  const off = await atSea({ hull: Math.round(small.hullHp * 0.7), stores: 10, settings: { AutoRepair: false } });
  frames(off, 5);
  assert.equal(hullOf(off), Math.round(small.hullHp * 0.7), 'off: nothing past the free mending');
  assert.equal(storesIn(off.hold), 10);
  // too few: the stores giving out, said once
  const short = await atSea({ hull: Math.round(small.hullHp * 0.6), stores: 1 });
  frames(short, 30);
  assert.equal(storesIn(short.hold), 0);
  assert.equal(short.log.say.filter((l) => /stores are spent/.test(l)).length, 1);
  assert.ok(hullOf(short) < small.hullHp);
  assert.ok(FIELD_QUIET_S <= 15, 'her hands turn to sooner');
});

test('QUICK-REPAIRS DAMAGE CONTROL: the order MAKE REPAIRS works under fire at SEA_REPAIR_UNDER_FIRE of the pace, her fires left burning; out of the fight, the full pace (mutants: the fire doused, the full pace under fire)', async () => {
  const h = await atSea({ hull: Math.round(small.hullHp * 0.5), stores: 10, fire: 10 });
  frames(h, 0.1);
  assert.equal(h.host.giveOrder(h.boat, CREW_ORDERS.repair).ok, true);
  const d = h.host._myState(h.boat).damage;
  const h0 = d.hull;
  frames(h, 2);
  assert.ok(d.fire > 0, 'her fire burns on: a patch is no bucket chain');
  assert.equal(h.host.hudModel().ship.repairing, true);
  const pace = SEA_REPAIR_PER_S * mendScaleOf(h.host.crewOf(h.boat).morale) * small.hullHp;
  const burn = 1.4;   // navalDamage.js FIRE_HP
  near(d.hull - h0, (pace * SEA_REPAIR_UNDER_FIRE - burn) * 2, pace * 0.1, 'the pace under fire, less what burns');
  assert.ok(SEA_REPAIR_UNDER_FIRE > 0 && SEA_REPAIR_UNDER_FIRE < 1);
  // the fire out and the quiet come: the full pace
  frames(h, 10 + FIELD_QUIET_S);
  assert.equal(d.fire, 0);
  const h1 = d.hull;
  frames(h, 1);
  near(d.hull - h1, pace, pace * 0.1, 'out of the fight, the full pace');
});

// ── the switch ───────────────────────────────────────────────────────────────────────────────────────────────────

test('QUICK-REPAIRS the Features row\'s Crew repairs on their own, each player\'s own, on by default; the world hands it to the sea as AutoRepair (mutants: the row missing, the key unwired)', () => {
  const row = FEATURES.find((r) => r.id === 'naval-combat');
  assert.ok(row.control.also.some((a) => a.key === 'naval-auto-repair' && a.initial === true && a.online === 'player'));
  assert.equal(row.control.parts.find((p) => p.key === 'naval-auto-repair')?.label, 'Crew repairs on their own');
  assert.match(src('src/scenes/world.js'), /key === 'AutoRepair' \? getPref\('naval-auto-repair'\) !== false/);
  assert.match(src('src/render/navalRender.js'), /const wreck = f\.kind === 'flotsam' && !!f\.wreck;/, 'the wreckage drawn as broken timber');
});
