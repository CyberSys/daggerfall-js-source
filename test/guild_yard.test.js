// GUILD-YARD (2026-10-02, Mac: "Guild hall next"): A GUILD HALL'S OUTSIDE AND ITS YARD - Seats-Arc 8.2's NOT YET ("a
// hall's outside and yard (HOME-LOOK and HOME-YARD name a character)"). A hall's keepers (its Officers and its
// guildmaster, a realm character each - decor.js OWNS, the rule its rooms are furnished by) paint its outside and place
// its yard; a plain member and anyone outside the guild do neither; everyone sees both. The service through the real
// Worker over node:sqlite (test/accountDb.mjs): the look, the yard's pieces paid off the keeper's record, a piece's half
// into the guild's treasury, the sale paying its yard's half as its rooms'; the client: whose outside the playing
// character keeps (systems/onlineHomes.js homeOutsideKept), the yard's decorator on a hall's lot (scenes/homeYards.js),
// the hall drawn out of the merge for its keeper's painter (scenes/world.js). `06-Systems/Online-Arc.md` GUILD-YARD.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { standService, T0 } from './accountDb.mjs';
import { seatRealm } from './realmSeat.mjs';
import { homeSaleRefund, homeLookOf } from '../src/net/homeLaw.js';
import { DECOR_YARD_CAP } from '../src/net/decorLaw.js';
import { REFUSALS } from '../src/net/accountClient.js';
import { homeOutsideKept, homeYardWhere, createOnlineHomes } from '../src/systems/onlineHomes.js';
import { createHomeYards } from '../src/scenes/homeYards.js';
import { fakeDoc, fakeWin, fakeBlocks, rmb, TOWN, settle } from './decorFakes.mjs';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const HALL = { mapId: 7, buildingKey: 300, region: 17, price: 20_000 };
const piece = (over = {}) => ({ id: 'yard1', model: 41000, flat: null, pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 120, ...over });
const LOOK = { walls: { set: 'manor', climate: 'swamp' }, door: { climate: 'desert', record: 1 } };

/** A guild founded by Gwen with its hall bought; Otto its Officer, Rhea a Recruit, Hugo outside it - each a realm
 *  character of their own. */
async function stood() {
  const svc = await standService();
  const gm = await svc.registered('Gwen', { renown: 12 });
  assert.equal((await svc.found(gm, { name: 'The Silver Hand', tag: 'SH' })).status, 200);
  const dep = await svc.call('/v1/guilds/deposit', { character: gm.character, gold: 60_000, realm: gm.at(), region: 17 }, gm.secret);
  assert.equal(dep.status, 200, JSON.stringify(dep.body));
  const realmOf = async (handle) => {
    const who = await svc.registered(handle);
    const R = await seatRealm(svc.env, who.secret, handle, { name: handle, level: 5, goldPieces: 50_000, items: [] });
    who.character = R.id; who.at = R.at;
    return who;
  };
  const join = async (handle) => {
    const who = await realmOf(handle);
    assert.equal((await svc.call('/v1/guilds/invite', { character: gm.character, handle }, gm.secret)).status, 200);
    const inv = await svc.call('/v1/guilds/invites', {}, who.secret);
    assert.equal((await svc.call('/v1/guilds/answer', { character: who.character, guild: inv.body.invites[0].guild, accept: true }, who.secret)).status, 200);
    return who;
  };
  const officer = await join('Otto');
  const recruit = await join('Rhea');
  const outsider = await realmOf('Hugo');
  const view = async () => (await svc.call('/v1/guilds/mine', { character: gm.character }, gm.secret)).body.guild;
  const otto = (await view()).members.find((m) => m.name === 'Otto');
  assert.equal((await svc.call('/v1/guilds/rank', { character: gm.character, member: otto.member, rank: 1 }, gm.secret)).status, 200);
  assert.equal((await svc.call('/v1/guilds/hall/buy', { character: gm.character, ...HALL }, gm.secret)).status, 200);
  const raw = svc.env.DB._raw;
  const goldOf = (who) => JSON.parse(new TextDecoder().decode(svc.env.SAVES._map.get(raw.prepare('SELECT obj FROM realm_characters WHERE id = ?').get(who.character).obj))).goldPieces;
  const place = (who, body) => svc.call('/v1/homes/decor/place', { mapId: 7, buildingKey: 300, character: who.character, realm: who.at(), yard: true, ...body }, who.secret);
  const paint = (who, look) => svc.call('/v1/homes/look', { mapId: 7, buildingKey: 300, character: who.character, look }, who.secret);
  const hallIn = async (who) => (await svc.call('/v1/homes/town', { mapId: 7, character: who?.character ?? null }, who?.secret ?? (await svc.guest()).secret)).body.homes.find((h) => h.buildingKey === 300);
  return { svc, gm, officer, recruit, outsider, view, raw, goldOf, place, paint, hallIn };
}

test('GUILD-YARD the hall\'s OUTSIDE: its Officer and its guildmaster paint it, free, as a home\'s owner does; a Recruit of its own guild and a stranger paint nothing of it (`no-home`); the town answers its look to everyone - a member, a stranger, a guest; null paints it back the town\'s own (mutants: the look\'s owner a character again; OWNS\'s keepers any rank; the hall\'s look unanswered)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { officer, gm, recruit, outsider, paint, hallIn, goldOf } = await stood();
  const had = goldOf(officer);
  const r = await paint(officer, LOOK);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.look, homeLookOf(LOOK));
  assert.equal(goldOf(officer), had, 'free, as a home\'s look is');
  assert.equal((await paint(recruit, { walls: { set: 'tavern', climate: 'desert' } })).body.error, 'no-home', 'a Recruit paints nothing of it');
  assert.equal((await paint(outsider, { walls: { set: 'tavern', climate: 'desert' } })).body.error, 'no-home', 'nor anyone outside the guild');
  for (const who of [recruit, outsider, null]) assert.deepEqual((await hallIn(who)).look, homeLookOf(LOOK), 'everyone sees it - a guest too');
  const mine = await hallIn(gm);
  assert.equal(mine.keeper, true);
  assert.deepEqual(mine.look, homeLookOf(LOOK));
  assert.equal((await paint(gm, null)).status, 200, 'the guildmaster keeps it too');
  assert.equal((await hallIn(null)).look, undefined, 'the town\'s own again');
});

test('GUILD-YARD the hall\'s YARD: its keepers place pieces outside it off their own records, under the yard\'s own cap and law; a Recruit and a stranger place nothing; the room\'s list never shows the yard and the town\'s yards show it to a guest (mutants: the hall\'s yard refused again - its read and its write; OWNS\'s keepers any rank)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, officer, gm, recruit, outsider, raw, goldOf, place } = await stood();
  const had = goldOf(officer);
  const y = await place(officer, { piece: piece() });
  assert.equal(y.status, 200, JSON.stringify(y.body));
  assert.equal(goldOf(officer), had - 120, 'the Officer\'s own record paid for it, as a home\'s yard is paid');
  assert.equal((await place(gm, { piece: piece({ id: 'yard2' }) })).status, 200, 'the guildmaster keeps it too');
  assert.equal((await place(recruit, { piece: piece({ id: 'r1' }) })).body.error, 'no-home', 'a Recruit places nothing');
  assert.equal((await place(outsider, { piece: piece({ id: 'h1' }) })).body.error, 'no-home', 'nor a stranger');
  assert.equal((await place(officer, { piece: piece({ id: 'yard3', storage: true }) })).body.error, 'bad-decor', 'the yard\'s own law: nothing held outside');
  const room = await svc.call('/v1/homes/decor', { mapId: 7, buildingKey: 300 }, recruit.secret);
  assert.deepEqual(room.body.pieces, [], 'the hall\'s rooms list none of it');
  const g = await svc.guest();
  const yards = await svc.call('/v1/homes/yards', { mapId: 7 }, g.secret);
  assert.deepEqual(yards.body.yards.map((x) => [x.buildingKey, x.pieces.map((p) => p.id)]), [[300, ['yard1', 'yard2']]], 'a visitor sees it');
  // its own cap: sixty a yard, as a home's
  const ins = raw.prepare('INSERT INTO home_decor (map_id, building_key, id, model, place, placed_at, paid, yard) VALUES (7, 300, ?, 41000, ?, ?, 0, 1)');
  for (let i = 0; i < DECOR_YARD_CAP - 2; i++) ins.run(`y${i}`, JSON.stringify({ pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 0 }), T0);
  assert.equal((await place(officer, { piece: piece({ id: 'yardX' }) })).body.error, 'yard-cap');
  // a palace stands no yard still - its word
  assert.match(REFUSALS['hall-yard'], /palace/);
});

test('GUILD-YARD a yard piece\'s HALF goes to the GUILD\'S TREASURY - taken out or shrunk, by whichever keeper, never to the keeper\'s purse; the ledger names it `hall-piece` (mutants: a yard piece\'s half to the record)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, officer, gm, view, goldOf, place } = await stood();
  assert.equal((await place(officer, { piece: piece() })).status, 200);
  const paidBy = goldOf(officer), gmHad = goldOf(gm);
  const t0 = (await view()).treasury;
  const gone = await svc.call('/v1/homes/decor/remove', { mapId: 7, buildingKey: 300, character: gm.character, id: 'yard1', realm: gm.at() }, gm.secret);
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.deepEqual([gone.body.gold, gone.body.treasury], [0, 60], 'nothing to the purse, half into the treasury');
  const g = await view();
  assert.equal(g.treasury, t0 + 60);
  assert.equal(g.ledger[0].kind, 'hall-piece');
  assert.deepEqual([goldOf(officer), goldOf(gm)], [paidBy, gmHad], 'neither keeper\'s record moved');
  // shrunk: half the difference, the same way
  assert.equal((await place(officer, { piece: piece({ id: 'y2', paid: 200 }) })).status, 200);
  const shrink = await svc.call('/v1/homes/decor/move', { mapId: 7, buildingKey: 300, character: officer.character, id: 'y2', realm: officer.at(), place: { pos: [8, 0, 2], rot: [0, 0, 0], scale: 1, light: null, storage: false, paid: 100 } }, officer.secret);
  assert.equal(shrink.status, 200, JSON.stringify(shrink.body));
  assert.equal(shrink.body.treasury, 50);
  assert.equal((await view()).treasury, t0 + 110);
});

test('GUILD-YARD the hall SOLD: its yard goes with it as its rooms\' pieces do - half of what records paid for each, yard and room alike, back into the treasury with the deed share, nothing left standing outside (mutants: the sale\'s sum without the yard)', async (t) => {
  t.mock.method(Date, 'now', () => T0 * 1000);
  const { svc, officer, gm, view, raw, place } = await stood();
  assert.equal((await place(officer, { piece: piece() })).status, 200);
  assert.equal((await place(officer, { piece: piece({ id: 'y2', paid: 200 }) })).status, 200);
  assert.equal((await place(officer, { piece: piece({ id: 'room1', pos: [2, 0, 2] }), yard: false })).status, 200);
  const t0 = (await view()).treasury;
  const sold = await svc.call('/v1/guilds/hall/sell', { character: gm.character }, gm.secret);
  assert.equal(sold.status, 200, JSON.stringify(sold.body));
  assert.equal(sold.body.decorCount, 3, 'the yard\'s two and the room\'s one');
  assert.equal(sold.body.decorBack, 60 + 100 + 60);
  assert.equal(sold.body.refund, homeSaleRefund(30_000));
  assert.equal((await view()).treasury, t0 + homeSaleRefund(30_000) + 220);
  assert.equal(raw.prepare('SELECT COUNT(*) AS n FROM home_decor WHERE yard = 1').get().n, 0, 'cleared');
  const g = await svc.guest();
  assert.deepEqual((await svc.call('/v1/homes/yards', { mapId: 7 }, g.secret)).body.yards, [], 'the street sees none of it');
});

test('GUILD-YARD whose outside the playing character keeps: its own home\'s, or a hall it is a keeper of - never a hall it is a plain member of, nor a stranger\'s; the yard\'s name follows (mutants: a member keeps; a keeper keeps none)', () => {
  assert.equal(homeOutsideKept({ own: true }), true, 'one\'s own home');
  assert.equal(homeOutsideKept({ own: false, hall: { name: 'The Hand' }, member: true, keeper: true }), true, 'a hall one keeps');
  assert.equal(homeOutsideKept({ own: false, hall: { name: 'The Hand' }, member: true, keeper: false }), false, 'a member keeps nothing outside');
  assert.equal(homeOutsideKept({ own: false, mine: true }), false, 'another character\'s home of the account');
  assert.equal(homeOutsideKept({ own: false, keeper: true }), false, 'a keeper\'s word on no hall');
  assert.equal(homeOutsideKept(null), false);
  assert.equal(homeYardWhere({ hall: true }), "Your guild's yard");
  assert.equal(homeYardWhere({ hall: false }), 'Your yard');
});

test('GUILD-YARD the client\'s registry: a hall\'s look is kept from the town\'s answer and its keeper\'s paint is sent as a home\'s, with the playing character - shown at once, the hall still a hall (mutants: none - the registry is a home\'s)', async () => {
  const writes = [];
  const api = {
    town: async () => ({ ok: true, data: { homes: [{ buildingKey: 300, owner: 'The Silver Hand', entry: 'guild', mine: false, hall: { name: 'The Silver Hand', tag: 'SH', heraldry: null }, member: true, keeper: true, look: LOOK }] } }),
    look: async (b) => { writes.push(b); return { ok: true, data: { look: b.look } }; },
  };
  const homes = createOnlineHomes({ api, character: () => 'r0123456789abcdef0123' });
  await homes.ensure(7);
  const h = homes.homeAt(7, 300);
  assert.deepEqual(h.look, homeLookOf(LOOK));
  assert.equal(homeOutsideKept(h), true);
  const next = { roof: { climate: 'mountain', record: 2 } };
  assert.equal((await homes.setLook(7, 300, next)).ok, true);
  assert.deepEqual(writes[0], { mapId: 7, buildingKey: 300, character: 'r0123456789abcdef0123', look: next });
  assert.deepEqual(homes.homesIn(7).get(300).look, next);
  assert.equal(homes.homeAt(7, 300).hall.name, 'The Silver Hand');
});

/** A fake world: one town pixel, the guild's hall (key 300) at 10, 0, 10 - 8 by 6 - as `row` says it to the playing
 *  character; the decorator's writes and its words kept. */
function world(row, { pieces = [] } = {}) {
  const homeFrames = new Map([[300, { at: [10, 0, 10], box: [6, 0, 7, 14, 6, 13] }]]);
  const built = new Map([['0,0', { px: 0, py: 0, homeTown: 7, homeFrames, homeRegion: 17 }]]);
  const writes = [], said = [], looks = [];
  const api = {
    yards: async () => ({ ok: true, data: { yards: [{ buildingKey: 300, pieces }] } }),
    place: async (b) => { writes.push(['place', b]); return { ok: true, data: { piece: b.piece } }; },
    move: async (b) => { writes.push(['move', b]); return { ok: true, data: {} }; },
    remove: async (b) => { writes.push(['remove', b]); return { ok: true, data: { piece: pieces.find((p) => p.id === b.id), gold: 0, treasury: 60 } }; },
  };
  const homes = { homeAt: (m, k) => (k === 300 ? row : null), setLook: async (m, k, look) => { looks.push([m, k, look]); return { ok: true, look }; } };
  const feet = [18, 0, 10];
  const gold = { n: 5000 };
  const doc = fakeDoc();
  const yards = createHomeYards({
    api, homes, built: () => built, translation: () => [0, 0, 0], feet: () => feet, outside: () => true, eye: () => [feet[0], 1.6, feet[2]],
    collider: () => ({ addMesh() {}, removeBucket() {}, surfaceHit: (o, d) => ({ dist: d[1] < 0 ? o[1] / -d[1] : Infinity, normal: [0, 1, 0] }) }),
    meshes: { getGpuMesh: async (id) => id, cpuModels: new Map([[41000, { positions: new Float32Array([-0.5, 0, -0.5, 0.5, 1, 0.5]), indices: new Uint32Array([0, 1, 0]) }]]) },
    renderer: { drawMesh() {}, createBillboardBatch: () => ({}), destroyBillboardBatch() {} }, getTexture: async () => ({ recordCount: 1 }), uploadRecord() {},
    scanDeps: () => ({ blocks: fakeBlocks([{ type: TOWN, block: rmb([41000]) }]), isTownBlock: (x) => x === TOWN, modelRadius: () => 0.8, flatRadius: async () => 0.2 }),
    character: () => 'r0123456789abcdef0123', realm: () => null,
    wallet: () => ({ get gold() { return gold.n; }, pay: (n) => { gold.n -= n; }, credit: (n) => { gold.n += n; } }), regionOf: () => 17,
    doc, win: fakeWin(), canvas: null, touch: false, actionOf: () => null, locked: () => true, cursorOff() {}, stick: () => null,
    say: (l) => said.push(l), refusal: (w) => w, openSlot() {}, now: () => 0,
    look: { preview() {}, season: () => 0 },
  });
  return { yards, writes, said, looks, gold, doc };
}
const cam = { pos: [18, 1.6, 10], yaw: Math.PI, pitch: -0.6 };
const HALL_ROW = { owner: 'The Silver Hand', own: false, mine: false, hall: { name: 'The Silver Hand', tag: 'SH', heraldry: null }, member: true, keeper: true, look: null };
const stand = async (w) => { for (let i = 0; i < 3; i++) { w.yards.frame({ dt: 1, cam, overlayUp: false }); await settle(); await settle(); } };

test('GUILD-YARD the decorator on a hall\'s lot: its keeper standing on it finds it - an empty yard stood for them, a guild\'s yard by name, `hall` to the tool; a plain member finds none, and a yard with pieces stands for every visitor (mutants: the stand\'s keeper unasked; the lot\'s keeper unasked; the room\'s `hall`; the yard\'s name)', async () => {
  const k = world(HALL_ROW);
  await stand(k);
  assert.equal(k.yards.yards().length, 1, 'an empty yard stands for its keeper');
  const here = k.yards.here();
  assert.ok(here, 'the keeper stands on the hall\'s lot');
  assert.equal(here.hall, true);
  assert.equal(homeYardWhere(here), "Your guild's yard");
  const m = world({ ...HALL_ROW, keeper: false });
  await stand(m);
  assert.equal(m.yards.here(), null, 'a plain member furnishes nothing outside');
  assert.equal(m.yards.yards().length, 0, 'and no empty yard stands for them');
  const v = world({ ...HALL_ROW, member: false, keeper: false }, { pieces: [piece()] });
  await stand(v);
  assert.equal(v.yards.yards().length, 1, 'a visitor sees the yard');
  assert.deepEqual(v.yards.yards()[0].pool.list().map((p) => p.id), ['yard1']);
  assert.equal(v.yards.here(), null, 'and furnishes none of it');
});

test('GUILD-YARD the keeper\'s yard decorator: a yard piece taken out says its half went to the guild\'s treasury and gives the purse nothing; the hall\'s outside painted from the Exterior tab is sent as a home\'s and said as the hall\'s (mutants: the room\'s `hall` lost - the half to the purse; the painted word)', async () => {
  const w = world(HALL_ROW, { pieces: [piece()] });
  await stand(w);
  const tool = w.yards.tool();
  assert.equal(tool.openPanel(), true);
  for (let i = 0; i < 4; i++) { w.yards.frame({ dt: 0.1, cam, overlayUp: true }); await settle(); }
  // the panel's Remove, on the yard's own piece
  const walk = (n, f) => { f(n); for (const c of n.children ?? []) walk(c, f); };
  const panel = () => w.doc.body.children.find((c) => c.className === 'dfdecor');
  const press = (match) => walk(panel(), (n) => { if (match(n)) n.fire('click'); });
  press((n) => typeof n.textContent === 'string' && n.textContent.startsWith('In this yard') && n.tag === 'button');
  await settle();
  press((n) => n.dataset?.key === 'yard1');
  await settle();
  let text = '';
  walk(panel(), (n) => { if (typeof n.textContent === 'string') text += `${n.textContent}\n`; });
  assert.match(text, /back to the guild's treasury/, 'the panel says whose the half is');
  press((n) => n.tag === 'button' && n.textContent === 'Remove');
  for (let i = 0; i < 4; i++) await settle();
  const sent = w.writes.find((x) => x[0] === 'remove')?.[1];
  assert.ok(sent, w.said.join(' / '));
  assert.deepEqual([sent.mapId, sent.buildingKey, sent.id, sent.character], [7, 300, 'yard1', 'r0123456789abcdef0123']);
  assert.equal(w.gold.n, 5000, 'nothing back to the keeper\'s purse');
  assert.ok(w.said.some((l) => /60 gold back to the guild's treasury/.test(l)), w.said.join(' / '));
  // the hall's outside, painted from the Exterior tab
  assert.equal(await tool.paintAct('commit', LOOK), true);
  assert.deepEqual(w.looks[0], [7, 300, LOOK], 'sent for the hall, as a home\'s look is');
  assert.ok(w.said.includes("Your guild's hall is painted."), w.said.join(' / '));
});

test('GUILD-YARD the world host by source: a hall its playing character keeps leaves the pixel\'s merge as an owner\'s home does, so its keeper\'s painter tries a look on it, and a hall kept in a merged pixel rebuilds it once (mutants: the keeper unasked at the build; at the refresh)', () => {
  const w = src('src/scenes/world.js');
  assert.match(w, /if \(homeRow && \(homeLook \|\| homeRow\.mine \|\| homeRow\.keeper\)\) \{/);
  assert.match(w, /\(row\?\.look \|\| row\?\.mine \|\| row\?\.keeper\)\) merged = true;/);
  const y = src('src/scenes/homeYards.js');
  assert.match(y, /if \(!home \|\| \(!pieces\?\.length && !homeOutsideKept\(home\)\)\) continue;/);
  assert.match(src('server-account/src/homes.js'), /UPDATE homes SET look = \? WHERE map_id = \? AND building_key = \? AND \$\{OWNS\}/);
});
