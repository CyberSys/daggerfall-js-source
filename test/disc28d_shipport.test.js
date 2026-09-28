// SHIP-PORT (2026-09-28, Discord through Mac: "a player is at a port but unable to set sail"). The map's ship passage
// asks Travel Options' IsNotAtPort of the player's location. On their own ship that location is "Your Ship" (2,2 or
// 5,5), which is in neither port list (the mod's 378 harbours; the MAPS byte's 343, every one of them among the 378),
// while every trip from the deck is reckoned from the port the ship was boarded at (playerTravelOrigin,
// TravelTimeCalculator.GetPlayerTravelPosition). So the passage was refused from the deck ("since there's no port")
// and By land walked out onto the sea. Now, on the ship, the ship laws read the boarding port. Two more on the same
// road: the enhanced map's card re-bills a trip whose ship its guard knocked off (it showed By land over the ship's
// fare, and Begin gold-checked that fare), and the Overworld's sea refusal names the map's passage where its law
// allows one ("a boat would carry you across the water" read as no way to sail).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { playerTravelPosition, calculateTravelTime } from '../src/systems/travel.js';
import { shipTransition, shipMemory, isOnShip } from '../src/systems/ship.js';
import { assignShipToPlayer, SHIP_TYPES, SHIP_COORDS } from '../src/systems/banking.js';
import { shipTravelRefusal, isPlayerControlledTravel } from '../src/ui/travelPopUp.js';
import { readTravelOptionsSettings } from '../src/systems/travelOptions.js';
import { hasPort } from '../src/systems/travelPorts.js';
import { HeldMapWindow } from '../src/ui/heldMap.js';
import { setTravelMapPopUpState } from '../src/systems/travelMapState.js';
import { TRAVEL_VIEW_TEXT } from '../src/scenes/travelView.js';
import { CLIMATES } from '../src/formats/mapsFile.js';

const WORLD = readFileSync(new URL('../src/scenes/world.js', import.meta.url), 'utf8');
/** A two-space-indented function of world.js's host, whole. */
const fnOf = (head) => {
  const i = WORLD.indexOf(head);
  assert.ok(i >= 0, head);
  return WORLD.slice(i, WORLD.indexOf('\n  }\n', i) + 4);
};
const hostSeam = fnOf('  function playerTravelOrigin() {') + fnOf('  function travelOriginMapId() {');
const mountSeam = (d) => new Function('d', `const { playerEntity, playerTravelPixel, playerTravelPosition, _musicLoc, locationIndex } = d;\n${hostSeam}\nreturn travelOriginMapId;`)(d);

// Daggerfall's own harbour and Wayrest's across the Bay (two of the list's, named off the retail MAPS.BSA), and the
// deck of a small ship.
const DAGGERFALL = { x: 207, y: 213 }, DAGGERFALL_ID = 213207, WAYREST_ID = 244859;
const town = (name, mapId) => ({ name, mapTableData: { mapId } });
const DECK = SHIP_COORDS[SHIP_TYPES.Small];
const YOUR_SHIP = town('Your Ship', DECK.y * 1000 + DECK.x);

/** A player who bought a ship and boarded it in Daggerfall's harbour - through the bank's and the ship's own mints. */
function boarded() {
  const p = { items: [] };
  assignShipToPlayer(p, SHIP_TYPES.Small);
  const t = shipTransition(p, { boardShipPosition: null, mapPixel: DAGGERFALL, position: shipMemory({ mapPixel: DAGGERFALL, pos: [10, 5, 10], yaw: 0 }, 0) });
  p.boardShipPosition = t.boardShipPosition;
  assert.deepEqual(t.go, DECK, 'boarding goes to the ship\'s own pixel');
  return p;
}

test('SHIP-PORT: on the deck, the ship laws read the port the ship was boarded at - the passage sails, as the trip is reckoned from there', () => {
  const settings = readTravelOptionsSettings();
  assert.equal(settings.shipTravelPortsOnly, true, 'the mod ships its ports rule on');
  assert.ok(hasPort(DAGGERFALL_ID) && hasPort(WAYREST_ID) && !hasPort(YOUR_SHIP.mapTableData.mapId), 'the harbours, and a deck that is none');
  const p = boarded();
  const locationIndex = new Map([[`${DAGGERFALL.x},${DAGGERFALL.y}`, town('Daggerfall', DAGGERFALL_ID)], [`${DECK.x},${DECK.y}`, YOUR_SHIP]]);
  const onDeck = mountSeam({ playerEntity: p, playerTravelPixel: () => DECK, playerTravelPosition, _musicLoc: YOUR_SHIP, locationIndex });
  assert.ok(isOnShip(p, p.boardShipPosition, DECK));
  assert.equal(onDeck(), DAGGERFALL_ID, 'the boarding port, not "Your Ship"');
  const ask = (currentLocationMapId) => shipTravelRefusal({ settings, currentLocationMapId, isOnShip: true, destinationMapId: WAYREST_ID, oceanPixels: 40 });
  assert.equal(ask(onDeck()), null, 'the passage sails from the deck');
  assert.equal(ask(YOUR_SHIP.mapTableData.mapId), 'noport', 'the deck\'s own pixel is what refused it');
  // Ashore it is PlayerGPS.CurrentLocation, as before: the harbour sails, the wilderness does not.
  const ashore = { items: [] };
  assert.equal(mountSeam({ playerEntity: ashore, playerTravelPixel: () => DAGGERFALL, playerTravelPosition, _musicLoc: locationIndex.get('207,213'), locationIndex })(), DAGGERFALL_ID);
  assert.equal(mountSeam({ playerEntity: ashore, playerTravelPixel: () => ({ x: 300, y: 300 }), playerTravelPosition, _musicLoc: null, locationIndex })(), null);
  // Boarded, then saved and loaded elsewhere: not on the ship (IsOnShip wants the ship's pixel), so where they stand.
  const inland = town('Inland', 150000);
  assert.equal(mountSeam({ playerEntity: p, playerTravelPixel: () => ({ x: 0, y: 150 }), playerTravelPosition, _musicLoc: inland, locationIndex })(), 150000);
});

test('SHIP-PORT by source: the one dep bag both maps (and a party\'s fare) read hands the ship laws the travel origin\'s place', () => {
  const bag = fnOf('  function travelFareDeps() {');
  assert.match(bag, /currentLocationMapId: \(\) => travelOriginMapId\(\),/);
  assert.doesNotMatch(bag, /currentLocationMapId: \(\) => _musicLoc/, 'never the pixel stood in, on a deck');
  const map = fnOf('  function buildTravelMapWindow(');
  assert.match(map, /getPlayerPixel: playerTravelOrigin,[\s\S]*\.\.\.travelFareDeps\(\),/, 'the map reckons its trip from the same place and spreads the bag');
});

test('SHIP-PORT: the enhanced map re-bills a trip whose ship its guard knocked off - By land is a walk, never the ship\'s fare', () => {
  const settings = { ...readTravelOptionsSettings(), shipTravelPortsOnly: true, stopAtInnsTravel: true, cautiousTravel: true };
  setTravelMapPopUpState({ speedCautious: true, sleepModeInn: true, travelShip: true });
  const ocean = (x) => (x > 205 && x < 215 ? CLIMATES.Ocean : 231);   // a strait between here and there
  const w = Object.create(HeldMapWindow.prototype);
  w.deps = {
    getPlayerPixel: () => ({ x: 200, y: 213 }), getClimateIndex: (x) => ocean(x),
    currentLocationMapId: () => 150000, isOnShip: () => false,   // inland: no port
    travelOptions: () => ({ settings }), gold: () => 0, goldPieces: () => 0,
  };
  w._selected = { summary: { id: 213220, mapID: DAGGERFALL_ID } };
  w._renderCard = () => {};
  w._openPanel('travel');
  const st = w._panelState;
  assert.equal(st.opts.travelShip, false, 'no port here: the guard knocked the ship off');
  assert.ok(isPlayerControlledTravel(settings, st.opts), 'the trip is now a walk');
  assert.equal(st.trip.walked, true, 'and the card bills it as one');
  const bill = { ...st.trip };
  w._refreshTrip();
  assert.deepEqual(st.trip, bill, 'the card\'s bill is the trip it would bill afresh');
  assert.ok(calculateTravelTime({ x: 200, y: 213 }, { x: 220, y: 213 }, { travelShip: false }, ocean).oceanPixels > 0, 'the fixture crosses water');
});

test('SHIP-PORT: the Overworld\'s sea refusal names the map\'s ship passage where its law sails, and the boat\'s line elsewhere', () => {
  assert.equal(TRAVEL_VIEW_TEXT.needShip, 'There is no way there by land - a ship sails there from here: choose By ship on the map.');
  const said = [];
  const settings = readTravelOptionsSettings();
  const strait = (x) => (x > 209 && x < 219 ? CLIMATES.Ocean : 231);   // the water between Daggerfall and the place
  let here = DAGGERFALL_ID, rule = settings;
  const d = {
    csaRuntime: {}, csaOn: () => true, planRoute: () => ({ pixels: [] }), tvRouteGround: () => ({}),
    townTalk: { say: (t) => said.push(t) }, TRAVEL_VIEW_TEXT,
    travelOptions: { get settings() { return rule; } }, calculateTravelTime, shipTravelRefusal, isOnShip,
    playerEntity: { items: [] }, playerTravelOrigin: () => DAGGERFALL, playerTravelPixel: () => DAGGERFALL,
    travelOriginMapId: () => here, maps: { getClimateIndex: (x) => strait(x) },
  };
  const src = fnOf('  function tvShipSails(') + fnOf('  function tvSeaNoWay(');
  const noWay = new Function('d', `const { ${Object.keys(d).join(', ')} } = d;\n${src}\nreturn tvSeaNoWay;`)(d);
  const harbour = { pixel: { x: 225, y: 213 }, mapId: WAYREST_ID };
  const inland = { pixel: { x: 225, y: 213 }, mapId: 150000 };   // no harbour there: the passage still sails when it crosses water
  const ask = (place) => noWay(DAGGERFALL, place.pixel, null, null, 'land', place);
  ask(harbour);   // at a port, to a port across the water
  ask(inland);   // at a port, across the water to a town with none - priced FIRST, so the water is seen
  here = 150000;
  ask(harbour);   // not at a port
  rule = { ...settings, shipTravelPortsOnly: false };
  ask(harbour);   // the ports rule off: DFU's passage sails from anywhere
  noWay(DAGGERFALL, harbour.pixel, null, null, 'land');   // a spot: the passage goes to places alone
  assert.deepEqual(said, [TRAVEL_VIEW_TEXT.needShip, TRAVEL_VIEW_TEXT.needShip, TRAVEL_VIEW_TEXT.needBoat, TRAVEL_VIEW_TEXT.needShip, TRAVEL_VIEW_TEXT.needBoat]);
  // ...and the route planner hands it the place it was asked for.
  assert.match(WORLD, /if \(!plan\) \{ tvSeaNoWay\(from, summary\.pixel, means, net, 'land', summary\); return false; \}/);
});
