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
