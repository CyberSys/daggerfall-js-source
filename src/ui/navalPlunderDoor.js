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
// sails on), 'leave' (AUDIT NAV1: Leave her - back to the captor's own helm), 'close' (the back key, the scrim, the
// Close press, or anything that put it away). The host hears it
// through `onClose(reason)` before its slot drops the overlay. One stands at a time.
//
// AUDIT NAV1 (the helm): THE SHIPWRIGHT'S WINDOW (ui/navalYardWindow.js) opens through the same door - one shape for the
// sea fight's two windows (`openNavalWindow`), each its own host, chunk and slot.
import { mountEnhancedChunk } from './enhancedChunk.js';
import { registerOverlay } from './enhancedOverlays.js';

/**
 * The sea fight's two window doors, one shape (AUDIT NAV1): each its host's id, its chunk and the chunk's mount, and
 * the overlay standing now (`open` - one at a time, each).
 * @typedef {{ id: string, label: string, load: () => Promise<any>, mount: (mod: any, host: HTMLElement, deps: any) => any, open: any }} NavalWindowSlot
 */
/** @type {NavalWindowSlot} */
const PLUNDER = {
  id: 'naval-plunder-host', label: 'naval-plunder', open: null,
  load: () => import('./navalPlunderWindow.js'),
  mount: ({ mountNavalPlunderWindow }, host, deps) => mountNavalPlunderWindow(host, deps),
};
/** @type {NavalWindowSlot} */
const YARD = {
  id: 'naval-yard-host', label: 'naval-yard', open: null,
  load: () => import('./navalYardWindow.js'),
  mount: ({ mountNavalYardWindow }, host, deps) => mountNavalYardWindow(host, deps),
};
/** @param {NavalWindowSlot} slot */
const isOpen = (slot) => !!slot.open && !slot.open.done;
/** @param {NavalWindowSlot} slot */
function shut(slot) {
  const was = isOpen(slot);
  slot.open?.dispose();
  return was;
}

/**
 * A window of the slot's, as an overlay for the host's slot (townTalk.showOverlay): its own host div, its chunk mounted
 * through the one home, `done` once it is shut, `dispose` to shut it - the one standing before it put away first.
 * @param {NavalWindowSlot} slot
 * @param {any} deps - the window's own, less `onExit` (the door's close is its way out), plus `onClose(reason)`
 */
function openNavalWindow(slot, deps) {
  if (typeof document === 'undefined') return null;
  slot.open?.dispose();
  let fired = false;
  let view = null;
  let why = 'close';
  const host = document.createElement('div');
  host.id = slot.id;
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
    if (slot.open === overlay) slot.open = null;
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
  slot.open = overlay;
  mountEnhancedChunk({
    load: slot.load,
    mount: (mod) => { view = slot.mount(mod, host, { ...deps, onExit: close }); },
    alive: () => !fired, host, onDismiss: () => { close('close'); }, label: slot.label,
  });
  return overlay;
}

/** Is a plunder window up. */
export const navalPlunderOpen = () => isOpen(PLUNDER);
/** Shut it, if it is up (the sea emptied under it: a transition, a load) - and say whether it was. */
export const closeNavalPlunder = () => shut(PLUNDER);
/**
 * Open the window, as an overlay for the host's slot (townTalk.showOverlay). `deps` is navalPlunderWindow.js's own,
 * less `onExit` - the door's close is the window's way out - and plus `onClose(reason)`.
 * @param {any} deps
 * @returns {any} the overlay, or null with no document
 */
export const createNavalPlunderOverlay = (deps) => openNavalWindow(PLUNDER, deps);

/** AUDIT NAV1: is the shipwright's window up. */
export const navalYardOpen = () => isOpen(YARD);
/** Shut the shipwright's window, if it is up - and say whether it was. */
export const closeNavalYard = () => shut(YARD);
/** The shipwright's window (ui/navalYardWindow.js), as an overlay for the host's slot; `deps` as that window's, plus
 *  `onClose(reason)`. */
export const createNavalYardOverlay = (deps) => openNavalWindow(YARD, deps);
