// BOAT-MENU (2026-09-30, Mac: "make the boat interaction like the loot menu. Being able to pick up, view storage,
// mount, all from a simple menu and button press") - a boat of mine lists its verbs on the plaque under the
// crosshair (systems/csaBoatMenu.js), the box aimed at lighting its own verb first, and the press goes through the
// mod's own activation on that verb's box.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { scene, ctxFor } from './csaScene.mjs';
import { spawnBoat, Boat, TRIGGER_MODEL } from '../src/systems/comeSailAwayBoat.js';
import { activationModelOf, ACTIVATION_DISTANCE, PASSENGERS_ABOARD_TEXT } from '../src/systems/comeSailAway.js';
import { boatTriggers, boatMenuRows, boatMenuStart, boatMenuRefusal, boatVerbNode, pressBoatVerb, BOAT_VERB, BOAT_MENU_TEXT, BOAT_MENU_WHY } from '../src/systems/csaBoatMenu.js';
import { mintBoatItem } from '../src/systems/comeSailAwayItems.js';
import { resolveHover, nextSelection } from '../src/systems/worldHover.js';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
const menuOf = (boat, s = {}) => {
  const boxes = boatTriggers(boat.GameObject, activationModelOf, TRIGGER_MODEL);
  return { boxes, rows: boatMenuRows({ boxes, packable: boat.packable, variants: boat.VariantObject != null && boat.GetVariantCount >= 1, ...s }) };
};
const labels = (rows) => rows.map((r) => (r.disabled ? `${r.label} (${r.why})` : r.label));

test('BOAT-MENU: EACH HULL LISTS THE BOXES IT CARRIES - the rowboat its helm, its ladder and the pick-up; the Large Boat its chest and its styles too; the ships their chest, status and position, the pick-up refused with its reason (a deed ship is not packed); the helm taken reads "Leave the helm" and hides the ladder; aboard, no ladder (mutants: a box not walked, a row not gated on its box, the refusals dropped)', () => {
  const at = { position: [0, 0, 0], rotation: [0, 0, 0, 1] };
  const hull = (h) => { const b = new Boat(h, 0); spawnBoat(b, ctxFor(at)); return b; };
  const want = [
    ['Take the helm', 'Board', 'Pick up'],
    ['Take the helm', 'Board', 'Open storage', 'Pick up', 'Change style'],
    ['Take the helm', 'Board', 'Open storage', `Pick up (${BOAT_MENU_WHY.moored})`, 'Status', 'Position'],
    ['Take the helm', 'Board', 'Open storage', `Pick up (${BOAT_MENU_WHY.moored})`, 'Status'],
    ['Take the helm', 'Board', 'Open storage', `Pick up (${BOAT_MENU_WHY.moored})`],
  ];
  for (let h = 0; h < 5; h++) assert.deepEqual(labels(menuOf(hull(h)).rows), want[h], `hull ${h}`);
  const b = hull(1);
  assert.deepEqual(labels(menuOf(b, { sailingThis: true, sailing: true }).rows), ['Leave the helm', 'Open storage', `Pick up (${BOAT_MENU_WHY.driving})`, `Change style (${BOAT_MENU_WHY.sailing})`]);
  assert.deepEqual(labels(menuOf(b, { aboard: true }).rows), ['Take the helm', 'Open storage', 'Pick up', 'Change style']);
  assert.deepEqual(labels(menuOf(b, { passengers: 1 }).rows).slice(3, 4), [`Pick up (${BOAT_MENU_WHY.passengers})`]);
  assert.equal(boatMenuRefusal(BOAT_MENU_WHY.driving), 'You cannot pack a boat you are driving!', 'the mod\'s own words');
  assert.equal(boatMenuRefusal(BOAT_MENU_WHY.passengers), PASSENGERS_ABOARD_TEXT);
  assert.ok(boatMenuRefusal(BOAT_MENU_WHY.moored));
  assert.ok(boatMenuRefusal(BOAT_MENU_WHY.sailing));
});

test('BOAT-MENU: THE LIT ROW STARTS ON THE BOX UNDER THE CROSSHAIR - the helm\'s box the helm (Steal mode: the pick-up, as the mod\'s Steal press packs), the chest its storage, the ladder the board, the hull the top row, a door (or a box this boat lists no verb for) nothing, keeping its own press; the plaque\'s law carries the start row, keeps a wheeled row on the same key, and an unlit list stays unlit (mutants: the start ignored, the steal ignored, the start over the wheel, the door lit)', () => {
  const rows = boatMenuRows({ boxes: new Set(['drive', 'board', 'cargo', 'status', 'position']), packable: true });
  assert.equal(rows[boatMenuStart('drive', rows, 'grab')].id, BOAT_VERB.helm);
  assert.equal(rows[boatMenuStart('drive', rows, 'steal')].id, BOAT_VERB.pack);
  assert.equal(rows[boatMenuStart('cargo', rows, 'grab')].id, BOAT_VERB.cargo);
  assert.equal(rows[boatMenuStart('board', rows, 'grab')].id, BOAT_VERB.board);
  assert.equal(rows[boatMenuStart('position', rows, 'info')].id, BOAT_VERB.position);
  assert.equal(boatMenuStart(null, rows, 'grab'), 0, 'the hull: the top row');
  assert.equal(boatMenuStart('door', rows, 'grab'), -1, 'a door lists nothing - it keeps its own press');
  assert.equal(boatMenuStart('variant', rows, 'grab'), -1, 'nor a box whose verb this boat does not list');
  const hit = { key: 'csaBoat:1:112402', distance: 1, reach: 3.2 };
  const frame = resolveHover(hit, { name: () => ({ title: 'Large Boat', actions: rows, actionsStart: 2 }) });
  assert.equal(frame.kind, 'actions');
  assert.equal(frame.startRow, 2);
  let sel = nextSelection(null, frame, 0);
  assert.equal(sel.id, BOAT_VERB.cargo, 'a new key lights its start row');
  sel = nextSelection(sel, frame, 1);
  assert.equal(sel.id, rows[3].id, 'the wheel moves on from it');
  sel = nextSelection(sel, frame, 0);
  assert.equal(sel.id, rows[3].id, 'and the same key keeps the row wheeled to');
  const top = resolveHover(hit, { name: () => ({ title: 'Large Boat', actions: rows }) });
  assert.equal(top.startRow, undefined, 'a namer naming no start: the frame as before');
  assert.equal(nextSelection(null, top, 0).row, 0);
  const unlit = resolveHover(hit, { name: () => ({ title: 'x', actions: rows, actionsUnlit: true, actionsStart: 2 }) });
  assert.equal(nextSelection(null, unlit, 0).row, -1, 'an unlit list stays unlit');
});

test('BOAT-MENU: A VERB PRESSED GOES THROUGH THE MOD\'S OWN ACTIVATION - "Take the helm" from the hull sails her, "Leave the helm" leaves, "Pick up" packs the rowboat (Steal mode, whatever the player\'s own), "Open storage" opens her cargo, "Board" stands the player at her ladder, "Position" reads her; past the mod\'s 3.2 from the point aimed at nothing runs; a refused row says the mod\'s words and runs nothing (mutants: the reach unkept, the pack in the player\'s mode, the refusal pressed, the nearer ladder not chosen)', () => {
  const s = scene();
  const cargo = [];
  s.deps.openCargo = (c) => cargo.push(c);
  const pack = [];
  s.deps.items = { create: (t) => mintBoatItem(t, 1), addToPlayer: (it) => pack.push(it) };
  s.deps.cargoWeight = () => 0;
  const boat = s.place(1);
  const said = [];
  const press = (verb, distance = 2, mode = 'info', over = {}) => {
    const { boxes, rows } = menuOf(boat, { sailingThis: s.rt.isSailing() && s.rt.state.CurrentBoat === boat, sailing: s.rt.isSailing(), ...over });
    return pressBoatVerb({
      boxes, rows, verb, distance, reach: ACTIVATION_DISTANCE, at: s.player.position, posOf: (n) => n.position,
      hit: { root: boat.GameObject }, mode, models: TRIGGER_MODEL, activate: (m, h, md) => s.rt.activate(m, h, md), say: (l) => said.push(l),
    });
  };
  assert.equal(press(BOAT_VERB.helm, 3.3), 'far', 'past the mod\'s reach');
  assert.equal(s.rt.isSailing(), false);
  assert.equal(press(BOAT_VERB.helm), 'pressed');
  assert.equal(s.rt.state.CurrentBoat, boat, 'at her helm - from the hull');
  assert.equal(press(BOAT_VERB.pack), 'refused');
  assert.deepEqual(said, ['You cannot pack a boat you are driving!'], 'the mod\'s own words, and no pack');
  assert.ok(s.rt.AllBoats.includes(boat));
  assert.equal(press(BOAT_VERB.board), 'none', 'no ladder at her helm');
  press(BOAT_VERB.helm);
  for (let i = 0; i < 12; i++) s.frame();
  assert.equal(s.rt.isSailing(), false, '"Leave the helm" leaves');
  assert.equal(press(BOAT_VERB.cargo), 'pressed');
  assert.deepEqual(cargo, [boat.Cargo], 'her own cargo opened');
  const before = [...s.player.position];
  s.deps.helm.setPlayerPosition = (p) => { s.player.position = [...p]; };
  assert.equal(press(BOAT_VERB.board), 'pressed');
  assert.notDeepEqual(s.player.position, before, 'stood at her ladder');
  assert.equal(press(BOAT_VERB.pack, 2, 'grab', { passengers: 1 }), 'refused', 'another player on her deck');
  assert.ok(s.rt.AllBoats.includes(boat));
  assert.equal(press(BOAT_VERB.pack, 2, 'grab'), 'pressed');
  assert.ok(!s.rt.AllBoats.includes(boat), 'packed - in Steal mode, the player\'s own mode Grab');
  assert.equal(pack.length, 1, 'her parts in the pack');
  // two ladders: the nearer boarded
  const ship = new Boat(2, 0);
  spawnBoat(ship, ctxFor({ position: [0, 0, 0], rotation: [0, 0, 0, 1] }));
  const boxes = boatTriggers(ship.GameObject, activationModelOf, TRIGGER_MODEL);
  const ladders = boxes.get('board');
  assert.equal(ladders.length, 2);
  for (const l of ladders) assert.equal(boatVerbNode(boxes, BOAT_VERB.board, l.position, (n) => n.position), l, 'the nearer ladder');
});

test('BOAT-MENU: THE WORLD\'S WIRING - my boat\'s plaque lists its verbs (the bed only its name), the box under the crosshair lit first; the press takes the verb the plaque lit before the box\'s own, and where no plaque stands (a tap, the classic skins) a press on the hull opens the verbs as a picker, closed before the verb runs (mutants: the verbs unlisted, the lit verb unread, the picker unasked, the walk kept past a style)', () => {
  assert.match(WORLD, /if \(mine\.part === 'bed'\) return \{ title \};/);
  assert.match(WORLD, /const start = boatMenuStart\(box, rows, getInteractionMode\(\)\);\n\s+return start < 0 \? \{ title \} : \{ title, actions: rows, actionsStart: start \};/);
  assert.match(WORLD, /const verb = plaqueActionFor\(pick\?\.key\);\n\s+if \(verb && pick\.boat\) \{ csaBoatVerb\(pick, verb\); return; \}/);
  assert.match(WORLD, /if \(pick\?\.boat && !worldPlaqueOn\(\) && pick\.distance <= CSA_ACTIVATION_DISTANCE\) csaOpenBoatMenu\(pick\);/);
  assert.match(WORLD, /if \(_csaPicker\) \{ modes\?\.closeWindow\?\.\(_csaPicker\); _csaPicker = null; \}\n\s+csaBoatVerb\(pick, rows\[i\]\?\.id\);/);
  assert.match(WORLD, /const csaStandsOn = \(boat\) => !!player\.grounded && typeof player\.groundKey === 'string' && player\.groundKey\.startsWith\(`csaBoat:\$\{csaBoatId\(boat\)\}:`\);/);
  assert.match(WORLD, /if \(!c \|\| c\.root !== boat\.GameObject \|\| c\.variant !== boat\.variant\) _csaBoxes\.set\(boat,/, 'the walk kept per hull and style');
  assert.equal(BOAT_MENU_TEXT.cargo, 'Open storage');
});
