// SHIP-PORT (2026-09-28, Discord through Mac: "a player is at a port but unable to set sail"). The map's ship passage
// asks Travel Options' IsNotAtPort of the player's location. On their own ship that location is "Your Ship" (2,2 or
// 5,5), which is in neither port list (the mod's 378 harbours; the MAPS byte's 343, every one of them among the 378),
// while every trip from the deck is reckoned from the port the ship was boarded at (playerTravelOrigin,
// TravelTimeCalculator.GetPlayerTravelPosition). So the passage was refused from the deck ("since there's no port")
// and By land walked out onto the sea. Now, on the ship, the ship laws read the boarding port. Two more on the same
// road: the enhanced map's card re-bills a trip whose ship its guard knocked off (it showed By land over the ship's
// fare, and Begin gold-checked that fare). SHIP-SAIL (Mac, of the Overworld taking the map's passage itself: "Shouldn't
// it already function as such?"): where the Overworld refuses a place across the water and the map's passage sails
// there, the Overworld OFFERS the passage and takes it, priced by the map's own popup headless (partyTripFare).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { playerTravelPosition, calculateTravelTime } from '../src/systems/travel.js';
import { shipTransition, shipMemory, isOnShip } from '../src/systems/ship.js';
import { assignShipToPlayer, SHIP_TYPES, SHIP_COORDS } from '../src/systems/banking.js';
import { shipTravelRefusal, isPlayerControlledTravel, TravelPopUpWindow } from '../src/ui/travelPopUp.js';
import { readTravelOptionsSettings } from '../src/systems/travelOptions.js';
import { hasPort } from '../src/systems/travelPorts.js';
import { HeldMapWindow } from '../src/ui/heldMap.js';
import { setTravelMapPopUpState } from '../src/systems/travelMapState.js';
import { TRAVEL_VIEW_TEXT, shipPassageRows } from '../src/scenes/travelView.js';
import { fareText } from '../src/systems/partyTravelLaw.js';
import { YesNoBoxWindow } from '../src/ui/yesNoBox.js';
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

test('SHIP-SAIL: where the walk is refused and the passage sails, the Overworld offers it and takes it as the map does', () => {
  const said = [], shown = [], journeys = [], asked = [];
  let fare = null, refusal = null, proposed = false, online = false;
  const d = {
    csaRuntime: {}, csaOn: () => true, planRoute: () => ({ pixels: [] }), tvRouteGround: () => ({}),
    townTalk: { say: (t) => said.push(t), showOverlay: (w) => shown.push(w) }, TRAVEL_VIEW_TEXT,
    partyTripFare: (to, opts) => { asked.push({ to, opts }); return fare; },
    travelMapPopUpState: () => ({ speedCautious: false, sleepModeInn: true, travelShip: false }),
    partyTravelRefusal: () => refusal, fareText, sharedClockOn: () => online, travelDays: (m) => Math.ceil(m / 1440),
    YesNoBoxWindow, shipPassageRows,
    partyTravel: { propose: () => proposed }, partyTravelJourney: (pick, opts, computed) => journeys.push({ pick, opts, computed }),
  };
  const src = fnOf('  function tvOfferPassage(') + fnOf('  function tvSeaNoWay(');
  const noWay = new Function('d', `const { ${Object.keys(d).join(', ')} } = d;\n${src}\nreturn tvSeaNoWay;`)(d);
  const place = { pixel: { x: 225, y: 213 }, name: 'Wayrest', mapId: WAYREST_ID, regionIndex: 17, locationIndex: 4 };
  const priced = (over = {}) => ({ opts: { speedCautious: false, sleepModeInn: true, travelShip: true }, computed: { minutes: 3 * 1440 - 5, totalCost: 150, piecesCost: 50 }, afford: true, unwell: false, ...over });
  const reset = () => { said.length = 0; shown.length = 0; journeys.length = 0; asked.length = 0; };
  // At a port, the passage sails and the purse holds it: asked, with the map's own words and days - then taken.
  fare = priced();
  noWay(DAGGERFALL, place.pixel, null, null, 'land', place);
  assert.deepEqual(asked, [{ to: place.pixel, opts: { speedCautious: false, sleepModeInn: true, travelShip: true } }], 'priced by the ship, over my own toggles');
  assert.deepEqual(said, []);
  assert.equal(shown.length, 1);
  assert.ok(shown[0] instanceof YesNoBoxWindow);
  assert.deepEqual(shown[0].rows, ['There is no way to Wayrest by land. Sail there by ship?', 'The journey costs 150 gold.', 'The voyage takes 3 days.']);
  shown[0].answer(true);
  assert.deepEqual(journeys, [{ pick: { pixel: place.pixel, name: 'Wayrest', mapId: WAYREST_ID, regionIndex: 17, locationIndex: 4 }, opts: fare.opts, computed: fare.computed }]);
  // A party gathered is asked first, as the map's Begin asks it; No leaves me where I stand.
  reset(); proposed = true;
  noWay(DAGGERFALL, place.pixel, null, null, 'land', place);
  shown[0].answer(true);
  assert.deepEqual(journeys, [], 'the party round took it');
  reset(); proposed = false;
  noWay(DAGGERFALL, place.pixel, null, null, 'land', place);
  shown[0].answer(false);
  assert.deepEqual(journeys, []);
  // Online the arrival is now - no days - and the popup's warning rides the question.
  reset(); online = true; fare = priced({ unwell: true });
  noWay(DAGGERFALL, place.pixel, null, null, 'land', place);
  assert.deepEqual(shown[0].rows, ['There is no way to Wayrest by land. Sail there by ship?', 'The journey costs 150 gold.', 'You are diseased or poisoned.']);
  online = false;
  // The purse cannot hold it: said, and not asked.
  reset(); fare = priced({ afford: false });
  noWay(DAGGERFALL, place.pixel, null, null, 'land', place);
  assert.deepEqual([said, shown.length], [['There is no way there by land. You cannot afford the journey (150 gold).'], 0]);
  // The map door's own rungs refuse it (foes near, the sun): in their words.
  reset(); fare = priced(); refusal = 'You cannot travel with enemies nearby.';
  noWay(DAGGERFALL, place.pixel, null, null, 'land', place);
  assert.deepEqual([said, shown.length], [[refusal], 0]);
  refusal = null;
  // The passage's own law refuses the place (no port here): the boat's line stands. A spot is never offered one.
  reset(); fare = priced({ opts: { speedCautious: false, sleepModeInn: true, travelShip: false } });
  noWay(DAGGERFALL, place.pixel, null, null, 'land', place);
  noWay(DAGGERFALL, place.pixel, null, null, 'land');
  assert.deepEqual([said, shown.length], [[TRAVEL_VIEW_TEXT.needBoat, TRAVEL_VIEW_TEXT.needBoat], 0]);
  // ...and the route planner hands it the place it was asked for.
  assert.match(WORLD, /if \(!plan\) \{ tvSeaNoWay\(from, summary\.pixel, means, net, 'land', summary\); return false; \}/);
});

test('SHIP-SAIL: the passage is priced by the map\'s own popup, which prices itself as it is built - its guard sees the water', () => {
  // partyTripFare's steps over the real popup: built (its constructor prices the trip), toggled, guarded, priced.
  const settings = readTravelOptionsSettings();
  const fareOf = (to, climate, destMapId) => {
    const pop = new TravelPopUpWindow(to, {
      getPlayerPixel: () => DAGGERFALL, getClimateIndex: (x) => climate(x),
      travelOptions: () => ({ settings }), currentLocationMapId: () => DAGGERFALL_ID, isOnShip: () => false,
      locationSummary: () => ({ mapID: destMapId }), gold: () => 1000, goldPieces: () => 1000,
    });
    pop.speedCautious = true; pop.sleepModeInn = true; pop.travelShip = true;
    pop.enforceShipRestriction();
    pop.refresh();
    return pop;
  };
  const strait = (x) => (x > 209 && x < 219 ? CLIMATES.Ocean : 231);
  const island = fareOf({ x: 225, y: 213 }, strait, 150000);
  assert.equal(island.travelShip, true, 'a place with no harbour across the water: the ship stays (DFU\'s HasNoOceanTravel asks only for water)');
  assert.ok(island.trip.oceanPixels > 0 && island.trip.totalCost > 0);
  const inland = fareOf({ x: 225, y: 213 }, () => 231, 150000);
  assert.equal(inland.travelShip, false, 'no water between and no harbour there: "a ship is not needed" - no passage to offer');
  assert.match(fnOf('  function partyTripFare(to, opts) {'), /pop\.enforceShipRestriction\(\);\s*pop\.refresh\(\);/, 'the same steps the offer prices by');
});
