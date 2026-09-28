// @ts-check
// NAV-F (2026-09-28) - THE PLUNDER WINDOW'S DOOR: the one place a host opens a taken ship's window through (ui/
// navalPlunderWindow.js), in the Sigil Broker's door's own shape (ui/brokerDoor.js): a lazy chunk mounted through the
// one home (ui/enhancedChunk.js - a chunk that will not arrive is a notice the player dismisses, MENU1), in a host of
// its own, wrapped in the generic overlay every host's frame drives - `done` once it is shut, `dispose` to shut it, the
// keyboard and the pointer the window's own - and registered with the overlay stack, so the QuickDial key puts it away
// as it puts away every enhanced window (PX28b).
//
// THE WAY OUT SAYS WHY. The window leaves through `onExit(reason)`: 'hold' (Open her hold - the host lays the pack's
// loot window over the hold and brings this one back when it shuts), 'fate' (she was scuttled, cast off, or the voyage
// sails on), 'close' (the back key, the scrim, the Close press, or anything that put it away). The host hears it
// through `onClose(reason)` before its slot drops the overlay. One stands at a time.
import { mountEnhancedChunk } from './enhancedChunk.js';
import { registerOverlay } from './enhancedOverlays.js';

/** The overlay standing now, or null. */
let _open = null;
/** Is a plunder window up. */
export const navalPlunderOpen = () => !!_open && !_open.done;
/** Shut it, if it is up (the sea emptied under it: a transition, a load) - and say whether it was. */
export function closeNavalPlunder() {
  const was = navalPlunderOpen();
  _open?.dispose();
  return was;
}

/**
 * Open the window, as an overlay for the host's slot (townTalk.showOverlay). `deps` is navalPlunderWindow.js's own,
 * less `onExit` - the door's close is the window's way out - and plus `onClose(reason)`.
 * @param {any} deps
 * @returns {any} the overlay, or null with no document
 */
export function createNavalPlunderOverlay(deps) {
  if (typeof document === 'undefined') return null;
  _open?.dispose();
  let fired = false;
  let view = null;
  let why = 'close';
  const host = document.createElement('div');
  host.id = 'naval-plunder-host';
  host.style.cssText = 'position:fixed;inset:0;z-index:13;background:transparent;overflow:hidden';
  document.body.append(host);
  let unregister = () => {};
  /** @param {string} [reason] */
  const close = (reason) => {
    if (fired) return;
    if (typeof reason === 'string') why = reason;
    unregister();
    view?.unmount();
    view = null;
    host.remove();
    fired = true;   // last: `done` must not read true while the DOM is up
    if (_open === overlay) _open = null;
    deps.onClose?.(why);
  };
  unregister = registerOverlay(() => close('close'));
  const overlay = {
    isChoiceWindow: true,
    get done() { return fired; },
    input() { /* the window's own capture keydown owns the keyboard */ },
    click() { /* the window is a fixed div over the canvas; pointers never get here */ },
    wheel() { /* its list scrolls itself */ },
    hover() { /* its own :hover */ },
    tick() { /* nothing under it moves while it stands (the sea is paused) */ },
    draw() { /* DOM, not canvas */ },
    dispose() { close(); },
    repaint() { view?.repaint(); },
  };
  _open = overlay;
  mountEnhancedChunk({
    load: () => import('./navalPlunderWindow.js'),
    mount: ({ mountNavalPlunderWindow }) => { view = mountNavalPlunderWindow(host, { ...deps, onExit: close }); },
    alive: () => !fired, host, onDismiss: () => { close('close'); }, label: 'naval-plunder',
  });
  return overlay;
}
