// DISC28-A (2026-09-28, EvoAva, Discord: "If you change the default pause key binding from escape to anything else,
// it allows you to open pause menu with that key binding, but not close it").
//
// The host opens the enhanced pause screen on the PAUSE ACTION (inputActions 'Escape'), but the screen's own key
// handler knew back only as overlayAction's literal Escape - so a pause rebound to P opened the screen and P then did
// nothing there. DFU's pause window closes on the action's own binding (DaggerfallPauseOptionsWindow.cs:159
// toggleClosedBinding = GetBinding(Actions.Escape), :186 GetKeyUp), and the classic window already does
// (ui/pauseWindow.js). Driven through the real registry, the real input table and the mounted screen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keydown } from './chargenDom.mjs';
import { createBindings, setBinding } from '../src/systems/inputActions.js';
import { setBindings } from '../src/ui/input.js';
import { mountEnhancedMenu } from '../src/ui/enhancedMenu.js';

console.warn = () => {};

function mount(mode, rebind = 'KeyP') {
  const store = createBindings();
  if (rebind) setBinding(store, rebind, 'Escape');
  setBindings(store);
  const acts = [];
  const host = globalThis.document.createElement('div');
  const menu = mountEnhancedMenu(host, { mode, hooks: {}, onAction: (a) => acts.push(a) });
  return { acts, menu };
}

test('DISC28-A: a pause rebound to P closes the pause screen it opened', () => {
  const { acts, menu } = mount('pause');
  const ev = keydown('KeyP', undefined, { key: 'p' });
  assert.deepEqual(acts, ['resume'], 'the pause action\'s own key is back on the pause face');
  assert.equal(ev.stopped, true, 'and the key is the screen\'s - it does not fall through to the world');
  menu.unmount();
});

test('DISC28-A: the held key that opened the screen does not close it on its first auto-repeat', () => {
  const { acts, menu } = mount('pause');
  keydown('KeyP', undefined, { key: 'p', repeat: true });
  assert.deepEqual(acts, []);
  menu.unmount();
});

test('DISC28-A: only the pause action\'s key - an unbound letter is not back', () => {
  const { acts, menu } = mount('pause');
  keydown('KeyQ', undefined, { key: 'q' });
  assert.deepEqual(acts, []);
  menu.unmount();
});

test('DISC28-A: the literal Escape still resumes after the rebind (the back button, U51)', () => {
  const { acts, menu } = mount('pause');
  keydown('Escape');
  assert.deepEqual(acts, ['resume']);
  menu.unmount();
});

test('DISC28-A: the default binding resumes exactly once per press', () => {
  const { acts, menu } = mount('pause', null);
  keydown('Escape');
  assert.deepEqual(acts, ['resume']);
  menu.unmount();
});

test('DISC28-A: the boot menu is no pause screen - the pause key means nothing there', () => {
  const { acts, menu } = mount('boot');
  keydown('KeyP', undefined, { key: 'p' });
  assert.deepEqual(acts, []);
  menu.unmount();
});

test('DISC28-A: a mod TextKey capture waiting for its key owns it - the back stack stands down, the capture has one owner', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/ui/enhancedMenu.js', import.meta.url), 'utf8');
  const onKey = src.slice(src.indexOf('function onKey(e)'), src.indexOf('function releaseLock()'));
  assert.ok(onKey.indexOf('if (textKeyCapture) return;') > 0 && onKey.indexOf('if (textKeyCapture) return;') < onKey.indexOf('const pauseKey'),
    'standing down before the pause key is read');
  assert.match(src, /textKeyCapture = onKey;\s*\n\s*addEventListener\('keydown', onKey, true\);/);
  assert.match(src, /removeEventListener\('keydown', onKey, true\);\s*\n\s*textKeyCapture = null;/, 'the capture clears itself');
  assert.match(src, /unmount\(\) \{[\s\S]*?if \(textKeyCapture\) \{ globalThis\.removeEventListener\('keydown', textKeyCapture, true\); textKeyCapture = null; \}/, 'and unmount clears it');
});
