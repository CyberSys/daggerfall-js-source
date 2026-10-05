// LOAD1 (2026-10-05, Mac: "...and a way to access them in the menu"): THE SCREENSHOTS PANE.
//
// The gallery (systems/shotGallery.js) on the menu: every screenshot the PrintScreen key kept, newest first, each with
// where and when it was taken. A tile's picture opens it large; its switch takes it out of (or back into) the loading
// screens' turn (ui/loadingScreen.js); Save writes it to the player's files; Delete asks once and deletes. Above them,
// a door for pictures from the player's own files, and the key's own switch - whether a shot is also saved as a PNG.
//
// ONE PANE, BOTH DOORS: the front door's shell and the pause window's System page draw this same function (the
// menu's own law - ui/enhancedMenu.js SYSTEM_PANES), so the gallery a player opens at boot is the one they open mid-game.
//
// IT DRAWS AT ONCE AND FILLS WHEN THE GALLERY ANSWERS. The menu repaints synchronously; IndexedDB answers later. The
// pane stands with a line saying it is reading, and fills its own nodes in place - a repaint of the menu builds a new
// pane and the old one's answer, finding its root gone, draws nothing.
//
// EVERY ALLOCATION HAS AN OWNER: each picture is an object URL, let go when the pane fills again and when the menu
// unmounts (releaseShotsPane, ui/enhancedMenu.js unmount); the gallery's change listener goes with them.
import { listShots, deleteShot, setShotLoading, keepShot, onGalleryChange, shotCaption, GALLERY_MAX } from '../systems/shotGallery.js';
import { getPref, setPref } from '../systems/uiPrefs.js';
import { SHOT_DOWNLOAD_PREF, REVOKE_AFTER_MS } from './screenshot.js';
import { loadingMode } from './loadingScreen.js';
import { isEnhanced } from '../systems/uiSkin.js';
import { bindings } from './input.js';
import { codeForAction } from '../systems/inputActions.js';
import { buttonText } from '../systems/controlsConfig.js';

const el = (t, cls, txt) => {
  const n = document.createElement(t);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
};

let urls = [];          // the pictures drawn now
let unlisten = null;    // the gallery's change listener, while a pane stands
let viewing = null;     // the id opened large, or null for the grid
let armed = null;       // the id whose Delete was pressed once
let fillSeq = 0;        // a fill's answer stands only if no later fill began

const letGo = () => { for (const u of urls) URL.revokeObjectURL(u); urls = []; };
const urlOf = (blob) => { const u = URL.createObjectURL(blob); urls.push(u); return u; };

/** The menu's unmount: the pictures and the listener go with the menu. */
export function releaseShotsPane() {
  letGo();
  unlisten?.(); unlisten = null;
  viewing = null; armed = null;
}

/** The PrintScreen key as the Controls page names it, or null when it is bound to nothing a keyboard has. */
export function shotKeyName(store = bindings()) {
  const code = codeForAction(store, 'PrintScreen');
  return code && !/^Joystick/.test(code) ? buttonText(code, true) : null;
}

const LOADING_WORDS = Object.freeze({
  shots: 'Loading screens show the screenshots marked for them below.',
  art: 'Loading screens show the night sky - choose Your screenshots on the Loading screens tile under Features to show these.',
  off: 'Loading screens are off - turn them on with the Loading screens tile under Features.',
  classic: 'Loading screens are drawn under the enhanced UI - the classic UI keeps Daggerfall\u2019s loads.',
});
/** Which of the words above stands: the skin first (the classic UI draws no loading screen), then the row. */
export const loadingWordsKey = () => (isEnhanced() ? loadingMode() : 'classic');

/** The pane, into `body`. */
export function drawShotsPane(body) {
  injectShotsStyle();
  const root = el('div', 'shots');
  body.append(root);
  unlisten?.();
  unlisten = onGalleryChange(() => { if (root.isConnected) fill(root); else { unlisten?.(); unlisten = null; } });
  fill(root);
}

async function fill(root) {
  const seq = ++fillSeq;
  if (!root.firstChild) root.append(el('p', 'shots-wait', 'Reading the gallery…'));
  const shots = await listShots();
  if (seq !== fillSeq || !root.isConnected) return;   // a later fill, or the pane is gone
  letGo();
  root.replaceChildren(topCard(root, shots.length));
  const open = viewing != null ? shots.find((s) => s.id === viewing) : null;
  if (viewing != null && !open) viewing = null;   // deleted from under the view
  if (open) root.append(viewCard(root, shots, open));
  else if (!shots.length) root.append(emptyCard());
  else root.append(grid(root, shots));
}

function topCard(root, count) {
  const c = el('div', 'card shots-top');   // no title of its own: the pane's head says Screenshots
  const key = shotKeyName();
  c.append(el('p', 'meta', `${count} of ${GALLERY_MAX} kept in this browser - never uploaded. `
    + (key ? `Press ${key} in the world to take one.` : 'The Screenshot action is bound to no key - bind one under Settings, Controls.')));
  c.append(el('p', 'meta', LOADING_WORDS[loadingWordsKey()] ?? LOADING_WORDS.shots));
  const row = el('div', 'acts');
  const pick = el('input');
  pick.type = 'file';
  pick.accept = 'image/png,image/jpeg,image/webp';
  pick.multiple = true;
  pick.hidden = true;
  pick.onchange = async () => {
    const files = [...(pick.files ?? [])];
    pick.value = '';
    let full = false;
    for (const f of files) {
      if ((await keepShot(f, { place: '' })) === 'full') { full = true; break; }
    }
    if (full) say(root, `The gallery is full at ${GALLERY_MAX} - delete some to add more.`);
  };
  const add = el('button', 'act', 'Add pictures…');
  add.type = 'button';
  add.onclick = () => pick.click();
  const dl = getPref(SHOT_DOWNLOAD_PREF) !== false;
  const sw = el('button', `act${dl ? ' on' : ''}`, `Also save each shot as a file: ${dl ? 'On' : 'Off'}`);
  sw.type = 'button';
  sw.setAttribute('aria-pressed', String(dl));
  sw.onclick = () => { setPref(SHOT_DOWNLOAD_PREF, !dl); fill(root); };
  row.append(add, sw, pick);
  c.append(row);
  return c;
}

function say(root, text) {
  const top = root.querySelector('.shots-top');
  if (!top) return;
  top.querySelector('.shots-say')?.remove();
  top.append(el('p', 'meta shots-say', text));
}

function emptyCard() {
  const e = el('div', 'empty');
  e.append(el('h3', null, 'No screenshots yet'));
  const key = shotKeyName();
  e.append(el('p', null, key
    ? `Press ${key} anywhere in the world. Every shot is kept here, and can stand on the loading screens.`
    : 'Bind the Screenshot action under Settings, Controls, then take one anywhere in the world.'));
  return e;
}

function grid(root, shots) {
  const g = el('div', 'shots-grid');
  for (const s of shots) {
    const t = el('div', `shot-tile${s.loading === false ? ' out' : ''}`);
    const thumb = el('button', 'shot-thumb');
    thumb.type = 'button';
    thumb.setAttribute('aria-label', `Open ${shotCaption(s) || 'this screenshot'}`);
    const img = el('img');
    img.alt = '';
    img.loading = 'lazy';
    img.src = urlOf(s.thumb ?? s.blob);
    thumb.append(img);
    thumb.onclick = () => { viewing = s.id; armed = null; fill(root); };
    t.append(thumb, el('div', 'shot-cap', shotCaption(s) || 'A picture'), tileActs(root, s));
    g.append(t);
  }
  return g;
}

function tileActs(root, s) {
  const row = el('div', 'acts');
  const on = s.loading !== false;
  const turn = el('button', `act shot-turn${on ? ' on' : ''}`, on ? 'On loading screens' : 'Not on loading screens');
  turn.type = 'button';
  turn.setAttribute('aria-pressed', String(on));
  turn.onclick = () => { armed = null; setShotLoading(s.id, !on); };
  const save = el('button', 'act', 'Save');
  save.type = 'button';
  save.onclick = () => saveFile(s);
  const del = el('button', `act${armed === s.id ? ' primary' : ''}`, armed === s.id ? 'Delete it?' : 'Delete');
  del.type = 'button';
  del.onclick = () => {
    if (armed !== s.id) { armed = s.id; fill(root); return; }
    armed = null;
    if (viewing === s.id) viewing = null;
    deleteShot(s.id);
  };
  row.append(turn, save, del);
  return row;
}

function viewCard(root, shots, s) {
  const c = el('div', 'card shots-view');
  const img = el('img');
  img.alt = shotCaption(s) || 'A screenshot';
  img.src = urlOf(s.blob);
  c.append(img, el('p', 'meta', shotCaption(s) || 'A picture'));
  const at = shots.indexOf(s);
  const nav = el('div', 'acts');
  const go = (label, id, primary = false) => {
    const b = el('button', `act${primary ? ' primary' : ''}`, label);
    b.type = 'button';
    if (id == null) b.disabled = true;
    else b.onclick = () => { viewing = id === 'grid' ? null : id; armed = null; fill(root); };
    return b;
  };
  nav.append(go('All screenshots', 'grid', true), go('Newer', shots[at - 1]?.id ?? null), go('Older', shots[at + 1]?.id ?? null));
  c.append(nav, tileActs(root, s));
  return c;
}

/** The kept JPEG, to the player's files - the PrintScreen download's own shape (ui/screenshot.js). */
function saveFile(s) {
  const url = URL.createObjectURL(s.blob);
  const a = el('a');
  a.href = url;
  a.download = `daggerfall-shot-${s.id}.jpg`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}

const SHOTS_STYLE_ID = 'enhanced-shots-style';
function injectShotsStyle(doc = document) {
  if (doc.getElementById(SHOTS_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = SHOTS_STYLE_ID;
  st.textContent = SHOTS_CSS;
  doc.head.append(st);
}

export const SHOTS_CSS = `
.shots-wait { color: var(--dim); }
.shots-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-bottom: 16px; }
.shot-tile { display: flex; flex-direction: column; border: 1px solid var(--iron); background: #12161b; min-width: 0; }
.shot-thumb { display: block; padding: 0; border: 0; background: #000; cursor: zoom-in; aspect-ratio: 16 / 9; overflow: hidden; }
.shot-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
.shot-thumb:focus-visible { outline: 2px solid var(--brass); outline-offset: -2px; }
.shot-tile.out .shot-thumb img { opacity: 0.45; }
.shot-cap { padding: 8px 10px 0; color: var(--dim); font-size: 13px; min-height: 1.5em; overflow-wrap: anywhere; }
.shot-tile .acts { padding: 8px 10px 10px; gap: 6px; }
.shot-tile .acts .shot-turn, .shots-view .acts .shot-turn { flex: 1 1 100%; }
.shot-tile .act, .shots-view .act { padding: 8px 12px; min-height: 44px; font-size: 13px; }
.shots-view img { display: block; max-width: 100%; max-height: 62vh; margin: 0 auto 10px; background: #000; }
.shots-view .acts + .acts { margin-top: 8px; }
`;
