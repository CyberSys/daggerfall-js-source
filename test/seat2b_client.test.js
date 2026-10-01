// SEAT2b (2026-10-01, Mac: "Finish the seats"; "We need to do a comprehensive audit on everything and finish the not
// done"): THE WORKS ON THE SEAT TAB - each work the seat may raise, its tier and what it does, the project and what it
// still wants (or its day), the stockpile, and the holder's lever a work (bible/11-Multiplayer/Seats-Arc.md 7.5, 7.9;
// src/ui/seatWorks.js, src/net/fortLaw.js fortWorkLine). `06-Systems/Online-Arc.md` SEAT2b.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byClass } from './chargenDom.mjs';
import { drawSeatWorks, fortLeverText, SEAT_WORKS_WORDS } from '../src/ui/seatWorks.js';
import { fortWorkLine, FORT_EFFECT_WORDS } from '../src/net/fortLaw.js';

const NAMES = { 'stone:cut': 'Cut Stone', 'plank:oak': 'Oak Planks', 'ingot:iron': 'Iron Ingots', 'metal:silver': 'Silver' };
const nameOf = (k) => NAMES[k] ?? k;

test('SEAT2b THE WORKS\' WORDS: a tier and what it does; a project and what it still wants, or the day it stands; every work\'s effect said at its tiers (mutants: the wanting; the day; each effect\'s words)', () => {
  assert.equal(fortWorkLine('walls', { tier: 0, building: null }), 'Walls: none raised.');
  assert.equal(fortWorkLine('walls', { tier: 1, building: 2, standsAt: null, needs: [['stone:cut', 800], ['ingot:iron', 200]], held: [['stone:cut', 480], ['ingot:iron', 0]] }, { nameOf }),
    'Walls: tier 1 - the defenders\' wave 3 s faster. Raising tier 2: 320 Cut Stone, 200 Iron Ingots still wanted.');
  assert.equal(fortWorkLine('shrine', { tier: 0, building: 1, standsAt: 1_800_000_000, needs: [['stone:cut', 100]], held: [['stone:cut', 100]] }, { whenOf: (ms) => `at ${ms}` }),
    'Shrine: none raised. Tier 1 stands at 1800000000000.');
  assert.equal(fortWorkLine('walls', { tier: 0, building: 1, standsAt: null, needs: [['stone:cut', 400]], held: [['stone:cut', 400]] }, { nameOf }), 'Walls: none raised. Raising tier 1: every need met.');
  assert.equal(fortWorkLine('nope', { tier: 1 }), '');
  assert.deepEqual(Object.entries(FORT_EFFECT_WORDS).map(([id, f]) => `${id}: ${f(2)}`), [
    'walls: the defenders\' wave 6 s faster',
    'gatehouse: its vitality 40,000',
    'watchtowers: the holder told when a challenger passes a quarter of its defence',
    'barracks: 4 town guards fight for the holder',
    'market: the town\'s boards list 50% more, the Tithe\'s cap 2 points higher',
    'shrine: Standing +2 a week, +100 influence for each gate felled in the region',
    'forge: members smithing here 2 quality steps better',
    'workshop: members\' carpentry, outfitting and masonry here 2 quality steps better',
    'apothecary: members\' alchemy, cooking and jewelcrafting here 2 quality steps better',
    'harbour: a port for the holder\'s members',
  ]);
  assert.deepEqual([FORT_EFFECT_WORDS.watchtowers(1), FORT_EFFECT_WORDS.forge(1), FORT_EFFECT_WORDS.market(1)],
    ['the holder told when a challenger passes half of its defence', 'members smithing here a quality step better', 'the town\'s boards list 25% more, the Tithe\'s cap 1 point higher']);
});

test('SEAT2b THE WORKS PANEL: the works a palace may raise (no Gatehouse below tier-3 Walls, no Harbour inland), each line; the stockpile; the holder\'s lever a work at its next tier, none for one building or at its last, none for a reader without the rank; the lever\'s press begins that work (mutants: which works; the lever\'s rules; its words; the press)', () => {
  const forts = {
    works: { walls: { tier: 1, building: null }, shrine: { tier: 2, building: null }, market: { tier: 0, building: 1, standsAt: null, needs: [['plank:oak', 200], ['stone:cut', 100]], held: [['plank:oak', 50], ['stone:cut', 100]] } },
    stockpile: [['ingot:iron', 40], ['stone:cut', 0]],
  };
  const begun = [];
  const host = document.createElement('div');
  const buttons = drawSeatWorks(host, { forts, seat: { tier: 'palace' }, lever: true, nameOf, onBegin: (w) => begun.push(w) });
  const lines = byClass(host, 'notice-seat-works-line').map((n) => n.textContent);
  assert.deepEqual(lines.map((l) => l.split(':')[0]), ['Walls', 'Watchtowers', 'Barracks', 'Market Hall', 'Shrine', 'Forge', 'Workshop', 'Apothecary'], 'no Gatehouse, no Harbour');
  assert.match(lines[3], /Raising tier 1: 150 Oak Planks still wanted\./);
  assert.equal(byClass(host, 'notice-seat-works-stock')[0].textContent, 'The stockpile: 40 Iron Ingots.');
  assert.deepEqual(Object.keys(buttons), ['walls', 'watchtowers', 'barracks', 'forge', 'workshop', 'apothecary'], 'none for the Market Hall (building) nor the Shrine (at its last tier)');
  assert.equal(buttons.walls.textContent, 'Raise the Walls to tier 2 (3,000 Drakes)');
  buttons.forge.click();
  assert.deepEqual(begun, ['forge']);
  // a port and tier-3 Walls: the Harbour and a gate of its own
  const h2 = document.createElement('div');
  const b2 = drawSeatWorks(h2, { forts: { works: { walls: { tier: 3, building: null } }, stockpile: [] }, seat: { tier: 'palace' }, port: true, lever: true, nameOf });
  assert.ok(b2.gatehouse && b2.harbour && !b2.walls);
  assert.equal(byClass(h2, 'notice-seat-works-stock')[0].textContent, SEAT_WORKS_WORDS.emptyStock);
  // no rank: the lines, no lever; reading: the words
  const h3 = document.createElement('div');
  assert.deepEqual(Object.keys(drawSeatWorks(h3, { forts, seat: { tier: 'crown' }, lever: false, nameOf })), []);
  assert.ok(byClass(h3, 'notice-seat-works-line').some((n) => n.textContent.startsWith('Gatehouse')), 'a crown\'s gate');
  const h4 = document.createElement('div');
  drawSeatWorks(h4, { forts: null, seat: { tier: 'palace' } });
  assert.equal(h4.textContent, `${SEAT_WORKS_WORDS.head}${SEAT_WORKS_WORDS.reading}`);
  assert.equal(fortLeverText('shrine', 3), '', 'no such tier');
});

test('SEAT2b SEAT WRITS ON THE WORK TAB: the guild\'s seats of the region offered as where a writ\'s units go - the stockpile it holds, the Siege Camp it is pledged to - a seat\'s writ asking only what a work asks, posted with its seat; a seat writ\'s card says so, under its guild\'s banner (mutants: the choice; the materials; the post; the card\'s words; the banner)', async () => {
  const { createWorkTab, seatWritFor, seatWritPlace } = await import('../src/ui/workTab.js');
  const { FORT_MATERIALS } = await import('../src/net/fortLaw.js');
  const T = 1_800_000_000;
  const posted = [];
  const w = { writs: { state: { workDrafts: null }, post: async (req) => { posted.push(req); return { ok: true }; } }, held: () => 0, region: 21, regionName: 'Anticlere', regionNameOf: () => 'Elsewhere', countName: (k) => k, pieces: () => [], reload() {} };
  const ui = { busy: () => false, run: async (f) => { await f(); }, rerender() {}, nowS: () => T };
  const tab = createWorkTab(w, ui);
  tab._state.form = 'writ';
  const heraldry = { field: 'azure', border: 'gold', device: 'eagle' };
  const data = {
    writs: [], today: { filled: 0, max: 3 }, commissions: [], balance: 0, writsOpen: true, me: 'Me',
    guildWrits: [{ id: 'S1', kind: 'guild', guild: { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry }, region: 21, material: 'stone:cut', units: 300, left: 280, pay: 3, escrow: 840, at: 0, expiresAt: T + 5 * 86400, state: 'open', mine: false, may: false, room: null, seat: 3021, camp: false, seatName: 'Anticlere' },
      { id: 'S2', kind: 'guild', guild: { id: 'g2', name: 'Ebon Oath', tag: 'EO', heraldry: null }, region: 21, material: 'plank:oak', units: 100, left: 100, pay: 1, escrow: 100, at: 0, expiresAt: T + 5 * 86400, state: 'open', mine: false, may: false, room: null, seat: 3021, camp: true, seatName: 'Anticlere' }],
    yours: { commissions: [], guildWrits: [] },
    guild: { id: 'g1', name: 'The Silver Hand', tag: 'SH', rank: 0, mayPost: true, marks: 100_000, budget: 0, spent: 0, left: 0,
      seats: [{ key: 3021, name: 'Anticlere', camp: false }, { key: 3022, name: 'Ashfield', camp: true }] },
  };
  const find = (root, label) => root.querySelectorAll('*').find((n) => n.getAttribute?.('aria-label') === label);
  let node = tab.node(data);
  const where = find(node, "Where the writ's units go");
  assert.deepEqual(where.children.map((o) => [o.value, o.textContent]), [['', 'The guild Stores'], ['3021', "Anticlere's stockpile"], ['3022', 'The Siege Camp at Ashfield']]);
  assert.ok(find(node, 'The material the writ asks').children.length > FORT_MATERIALS.length, 'the guild Stores: the whole catalogue');
  where.value = '3022'; where.onchange();
  node = tab.node(data);
  const mats = find(node, 'The material the writ asks').children.map((o) => o.value);
  assert.deepEqual(mats.sort(), [...FORT_MATERIALS].sort(), 'a seat writ asks what a work asks');
  node.querySelectorAll('*').find((n) => n.className?.includes?.('work-post')).click();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(posted.at(-1).seat, 3022);
  // the cards
  const cards = tab.cards(data);
  assert.match(cards[0].textContent, /^Seat writ/);
  assert.match(cards[0].textContent, /The Silver Hand \[SH\] needs 280 more stone:cut for Anticlere's stockpile/);
  assert.match(cards[1].textContent, /Ebon Oath \[EO\] needs 100 more plank:oak for the Siege Camp at Anticlere/);
  assert.equal(cards[0].querySelectorAll('*').filter((n) => n.className?.includes?.('writ-banner')).length, 1, 'its guild\'s banner');
  assert.equal(cards[1].querySelectorAll('*').filter((n) => n.className?.includes?.('writ-banner')).length, 0, 'none without heraldry');
  assert.deepEqual([seatWritPlace({ name: 'Silas', camp: false }), seatWritFor({ camp: true })], ["Silas' stockpile", 'for the Siege Camp at the seat']);
});
