import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TravelControlUI } from '../src/ui/travelControlUI.js';
import { createTravelOptions, readTravelOptionsSettings } from '../src/systems/travelOptions.js';
test('travel remembers chosen acceleration after a half-cap path and returns the clock to it', () => {
  let clock = 1;
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60, onTimeAccelerationChanged: n => { clock = n; } });
  const to = createTravelOptions({ settings: { ...readTravelOptionsSettings(), alwaysUseStartingAccel: false }, ui,
    pushWindow: w => w.show(), mapPixel: () => ({ x: 500, y: 250 }), worldPos: () => ({ x: 0, z: 0 }),
    setTimeScale: n => { clock = n; }, locationTileRect: () => null });
  to.beginTravelToCoords({ x: 501, y: 250 });
  while (ui.timeAcceleration < 60) ui.faster();
  to.beginPathTravel({ x: 502, y: 250 });   // replace a journey while its panel remains visible
  assert.equal(ui.timeAcceleration, 60, 'an already-visible journey retains its active higher speed');
  assert.equal(clock, 60);
  ui.closeWindow(); to.interruptTravel();
  to.beginPathTravel({ x: 502, y: 250 });
  assert.equal(ui.timeAcceleration, 30);
  assert.equal(clock, 30, 'a newly opened path uses its existing half cap');
  ui.closeWindow(); to.interruptTravel();
  to.beginTravelToCoords({ x: 503, y: 250 });
  assert.equal(ui.timeAcceleration, 60, 'a temporary path cap must not replace the chosen speed');
  assert.equal(clock, 60, 'the restored spinner and actual clock agree');
  ui.closeWindow(); to.interruptTravel();
  to.settings = { ...to.settings, alwaysUseStartingAccel: true, defaultStartingAccel: 10 };
  to.beginTravelToCoords({ x: 504, y: 250 });
  assert.equal(ui.timeAcceleration, 10, 'explicit always-start setting still takes precedence');
});
