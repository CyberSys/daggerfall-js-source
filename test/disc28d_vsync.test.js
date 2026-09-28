// FPS-VSYNC (2026-09-28, Discord, Regi: "Settings are also set for 300 FPS but it seems it's limited to 60 (possibly by
// vsync)"; Mac, asked whether the desktop app should run above the screen's refresh: "Yes"). DFU's own law
// (StartGameBehaviour.cs:238-250): VSync on, frames wait for the screen and the cap does nothing; VSync off, the Frame
// Rate Cap holds them. A page cannot stop waiting; the desktop app's Chromium can, told at launch - so the shell reads
// the player's saved VSync (the page's own settings blob, written through the page's own writer into the shell's
// file store) and lifts the wait when it is off. In the app the setting is a real one, read at the next start; in a
// browser it stays unavailable (test/fpscap1.test.js holds that side).
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

import { setValue, saveSettings, _resetForTests, tierOf, SHELL_AT_LAUNCH } from '../src/systems/settings.js';
import { widgetFor, formatValue } from '../src/ui/settingsLaw.js';
import { TIER_TEXT } from '../src/ui/settingsCopy.js';

const require = createRequire(import.meta.url);
const { SETTINGS_PREF, VSYNC_OFF_SWITCHES, savedVSync, frameRateSwitches } = require('../app/lib/frameRate.cjs');
const { createFileStorage } = require('../app/lib/fileStorage.cjs');
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

const roots = [];
/** A userData folder with the shell's file store on the page's bridge, as app/preload.cjs puts it there. */
function shell() {
  const root = mkdtempSync(join(tmpdir(), 'vsync-'));
  roots.push(root);
  globalThis.daggerShell = { storage: createFileStorage(root) };
  _resetForTests();
  return root;
}
afterEach(() => {
  delete globalThis.daggerShell;
  _resetForTests();
  while (roots.length) rmSync(roots.pop(), { recursive: true, force: true });
});

test('FPS-VSYNC: the shell reads the VSync the page saved - off lifts both of Chromium\'s waits, on (DFU\'s default) lifts nothing', () => {
  const root = shell();
  assert.equal(savedVSync(root), true, 'nothing saved: DFU\'s default, on');
  assert.deepEqual(frameRateSwitches(root), []);
  setValue('Video', 'VSync', 'False');
  assert.ok(saveSettings(), 'the page writes through the shell\'s store');
  assert.equal(savedVSync(root), false);
  assert.deepEqual(frameRateSwitches(root), ['disable-gpu-vsync', 'disable-frame-rate-limit']);
  assert.deepEqual([...VSYNC_OFF_SWITCHES], ['disable-gpu-vsync', 'disable-frame-rate-limit']);
  setValue('Video', 'VSync', 'True');
  saveSettings();
  assert.deepEqual(frameRateSwitches(root), [], 'on again: the wait stays');
});

test('FPS-VSYNC: the shell reads the value as the page\'s GetBool does - any case of true is on, anything else stored is off, an unreadable store is the default', () => {
  const root = shell();
  const store = createFileStorage(root);
  const put = (v) => store.setItem(SETTINGS_PREF, JSON.stringify({ Video: { VSync: v } }));
  put(' TRUE ');
  assert.equal(savedVSync(root), true);
  put('no');
  assert.equal(savedVSync(root), false, 'GetBool reads a stored non-boolean as False');
  store.setItem(SETTINGS_PREF, '{ not json');
  assert.equal(savedVSync(root), true, 'unreadable: DFU\'s default, never a surprise uncapped launch');
  store.setItem(SETTINGS_PREF, JSON.stringify({ Video: { TargetFrameRate: '300' } }));
  assert.equal(savedVSync(root), true, 'a cap alone does not lift the wait - VSync decides, as in DFU');
});

test('FPS-VSYNC: in the app VSync is a real setting read at the next start; in a browser it stays unavailable', () => {
  const k = 'Video/VSync';
  assert.equal(SHELL_AT_LAUNCH[k], 'app/lib/frameRate.cjs');
  assert.equal(tierOf(k), 'unavailable', 'no shell: the browser always waits');
  shell();
  assert.equal(tierOf(k), 'restart');
  assert.equal(widgetFor(k), 'switch', 'a switch, not the blocked readout');
  assert.equal(formatValue(k, 'True'), 'On');
  assert.equal(TIER_TEXT.restart, 'Takes effect the next time the app starts.');
  assert.equal(tierOf('Video/TargetFrameRate'), 'live', 'the cap itself is live everywhere');
});

test('FPS-VSYNC by source: the shell asks before the app is ready, over the page\'s own key; the screen draws the row with the live ones', () => {
  const main = read('app/main.cjs');
  const at = main.indexOf('for (const s of frameRateSwitches(app.getPath(\'userData\'))) app.commandLine.appendSwitch(s);');
  assert.ok(at > main.indexOf("app.setPath('userData'"), 'after the storage root is pinned');
  assert.ok(at < main.indexOf('app.whenReady()'), 'before the app is ready - Chromium reads its switches at launch');
  assert.match(read('src/systems/settings.js'), new RegExp(`const STORAGE_KEY = '${SETTINGS_PREF.replace(/\./g, '\\.')}';`), 'the key the page saves under');
  const menu = read('src/ui/enhancedMenu.js');
  assert.match(menu, /function drawsFlat\(key\) \{ const t = tierOf\(key\); return t === 'live' \|\| t === 'restart'; \}/);
  assert.match(menu, /for \(const key of keys\) if \(drawsFlat\(key\)\) \{ const r = settingRow\(key\); if \(r\) out\.push\(r\); \}/);
  assert.match(menu, /const liveKeys = paneKeys\(cat\.id\)\.filter\(\(key\) => tierOf\(key\) === 'live'\);/, 'Quick Settings keeps to what applies at once');
});
