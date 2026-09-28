// NAV-F (2026-09-28, Mac: "All UI elements should follow enhanced plus UI. This task is to be extremely detailed,
// authentic and easy to use") - THE UI: the helm's readout (the ship plate, the battery rose, the aim, the target card)
// and the plunder window with its door, in the stone-and-brass kit on either skin (bible/03-World/Naval-Combat.md).
// The readout's words and the window's are pure and pinned as words; both are then mounted on the suite's minimal DOM
// and driven as a player drives them.
import { byClass, keydown, windowListenerCount, Node_ } from './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navalHudText, drawNavalHud, destroyNavalHud, navalKitCss, injectNavalKit, NAVAL_HUD_CSS } from '../src/ui/navalHud.js';
import { plunderText, takenText, thingsText, mountNavalPlunderWindow, HOLD_ROWS } from '../src/ui/navalPlunderWindow.js';
import { createNavalPlunderOverlay, navalPlunderOpen, closeNavalPlunder } from '../src/ui/navalPlunderDoor.js';
import { FRAME_ROLES, frameCss } from '../src/ui/enhancedFrame.js';
import { WARM_CHUNKS } from '../src/ui/enhancedChunk.js';
import { setPref, _resetForTests as resetPrefs } from '../src/systems/uiPrefs.js';

// The suite's minimal DOM, three steps nearer a browser for a window that greys its presses: the `disabled` and
// `hidden` attributes reflected onto their properties (a real button's click is refused while it is disabled - the
// helper's dispatch already asks the property), `removeAttribute`, `dataset`, and `closest` by class (the scrim's test).
{
  const proto = Node_.prototype;
  const setAttr = proto.setAttribute;
  proto.setAttribute = function (k, v) { setAttr.call(this, k, v); if (k === 'disabled' || k === 'hidden') this[k] = true; };
  proto.removeAttribute = function (k) { delete this.attrs[k]; if (k === 'disabled' || k === 'hidden') this[k] = false; };
  Object.defineProperty(proto, 'dataset', { get() { return (this._dataset ??= {}); } });
  proto.closest = function (sel) {
    for (let n = this; n; n = n.parentNode) if (typeof n.className === 'string' && n.className.split(/\s+/).includes(sel.replace(/^\./, ''))) return n;
    return null;
  };
}

/** A click as a browser delivers it: an event that can be stopped. */
const press = (n) => n.dispatch('click', { stopPropagation() {}, preventDefault() {} });

const KEYS = { aim: 'RIGHT CLICK', board: 'E', brace: 'C' };
const helm = (o = {}) => ({
  ship: { name: 'Small Ship', hull: 0.8, sail: 0.5, crew: 0.9, fire: false, wrecked: false, braced: false },
  armed: true, aiming: false, aim: null, board: null, boarding: null, target: null,
  batteries: [
    { side: 'bow', gun: 'chain', guns: 2, progress: 1, ready: true, active: false, barrels: null },
    { side: 'port', gun: 'long', guns: 6, progress: 0.25, ready: false, active: false, barrels: null },
    { side: 'starboard', gun: 'long', guns: 1, progress: 1, ready: true, active: true, barrels: null },
    { side: 'stern', gun: 'barrel', guns: 1, progress: 1, ready: false, active: false, barrels: 0 },
  ],
  notoriety: { crown: 'Wayrest', value: 55, level: 2 },
  ...o,
});
const card = (o = {}) => ({ name: 'The Red Wake', captain: 'Irna Vosk', classLine: 'Pirate Brigantine', faction: 'pirate', hull: 0.3, sail: 0.75, state: 'afloat', boarded: false, distance: 142, hostile: true, box: undefined, ...o });

// ── the readout's words ─────────────────────────────────────────────────────────────────────────────────────────

test('NAV-F the ship plate\'s words: her name, the crown\'s waters and the anchors, the bars as whole percents, the chips; the rose\'s batteries - their guns counted in the gun\'s own word (one long gun, six long guns, two chain shot, the barrels left), filling as they reload, lit where the look lays them, the empty barrel rack dimmed (mutants: the singular, a reload shown full, the rack never empty)', () => {
  assert.equal(navalHudText(null), null);
  const { plate } = navalHudText(helm(), KEYS);
  assert.equal(plate.name, 'Small Ship');
  assert.equal(plate.waters, 'Wayrest waters');
  assert.equal(plate.anchors, 2);
  assert.deepEqual([plate.hull, plate.sail, plate.crew], [80, 50, 90]);
  assert.deepEqual(plate.chips, []);
  const b = Object.fromEntries(plate.batteries.map((x) => [x.side, x]));
  assert.equal(b.port.count, '6 long guns');
  assert.equal(b.starboard.count, '1 long gun');
  assert.equal(b.bow.count, '2 chain shot');
  assert.equal(b.stern.count, '0 barrels');
  assert.equal(b.port.fill, 25);
  assert.equal(b.port.ready, false);
  assert.equal(b.starboard.active, true);
  assert.equal(b.stern.empty, true);
  assert.equal(navalHudText(helm({ batteries: [{ side: 'stern', gun: 'barrel', guns: 1, progress: 1, ready: true, barrels: 1 }] }), KEYS).plate.batteries[0].count, '1 barrel');
  const worn = navalHudText(helm({ ship: { name: 'Carrack', hull: 0, sail: null, crew: null, fire: true, wrecked: true, braced: true } }), KEYS).plate;
  assert.deepEqual(worn.chips, ['wreck', 'fire', 'brace']);
  assert.equal(worn.sail, null, 'a hull with no canvas has no sail bar');
  assert.equal(navalHudText(helm({ ship: { ...helm().ship, hull: 1.7 } })).plate.hull, 100, 'bounded');
});

test('NAV-F the hint says the press that matters most, in the registry\'s own names: a ship in reach to board or plunder, then the guns - hold to aim, let go to fire - and the brace; a boat with no guns says so (mutants: the board hint shadowed by the guns, the keys hard-coded)', () => {
  assert.equal(navalHudText(helm(), KEYS).plate.hint, 'Hold RIGHT CLICK to aim - C: brace');
  assert.equal(navalHudText(helm({ aiming: true }), KEYS).plate.hint, 'Let go to fire - C: brace');
  assert.equal(navalHudText(helm({ armed: false, batteries: [] }), KEYS).plate.hint, 'No guns aboard');
  assert.equal(navalHudText(helm({ board: { name: 'The Red Wake', kind: 'board' } }), KEYS).plate.hint, 'E: board The Red Wake');
  assert.equal(navalHudText(helm({ board: { name: 'The Red Wake', kind: 'hold' } }), KEYS).plate.hint, "E: open The Red Wake's hold");
  assert.equal(navalHudText(helm()).plate.hint, 'Hold Attack to aim - Brace: brace', 'no names handed: the actions\' own');
});

test('NAV-F the aim under the crosshair: the battery and its word - a broadside, the chasers, a barrel rolled - the range the guns are laid for, "(longest)" at the carriage\'s top, and ON TARGET when the zone lies on a ship (mutants: the chasers called a broadside, the longest never said)', () => {
  const aim = (a) => navalHudText(helm({ aim: a }), KEYS).aim;
  assert.deepEqual(aim({ side: 'starboard', range: 120, max: 190, hot: false }), { text: 'Starboard broadside - ', range: '120 m', hot: false, target: '' });
  assert.deepEqual(aim({ side: 'port', range: 189, max: 190, hot: true }), { text: 'Port broadside - ', range: '189 m (longest)', hot: true, target: ' - on target' });
  assert.equal(aim({ side: 'bow', range: 80, max: 150, hot: false }).text, 'Bow chasers - ');
  assert.deepEqual(aim({ side: 'stern', barrel: true, range: 0, max: 0, hot: false }), { text: 'Stern - roll a fire barrel', range: '', hot: false, target: '' });
  assert.equal(navalHudText(helm(), KEYS).aim, null, 'nothing laid, nothing said');
});

test('NAV-F the target card: her name and colours, her class, captain and distance, her hull and canvas, and her state - hostile, colours struck (with the key that boards her when she is in reach), boarded, taken (her hold\'s key), going down (mutants: the board key offered for another ship, the prize state missed)', () => {
  const c = navalHudText(helm({ target: card() }), KEYS).card;
  assert.deepEqual(c, { name: 'The Red Wake', faction: 'pirate', hostile: true, sub: 'Pirate Brigantine - Captain Irna Vosk - 142 m', hull: 30, sail: 75, state: 'Hostile', stateKind: '' });
  const st = (t, board = null) => { const x = navalHudText(helm({ target: card(t), board }), KEYS).card; return [x.state, x.stateKind]; };
  assert.deepEqual(st({ hostile: false }), ['', '']);
  assert.deepEqual(st({ state: 'struck' }), ['Colours struck', '']);
  assert.deepEqual(st({ state: 'struck' }, { name: 'The Red Wake', kind: 'board' }), ['Colours struck - E: board her', 'board']);
  assert.deepEqual(st({ state: 'struck' }, { name: 'The Black Kraken', kind: 'board' }), ['Colours struck', ''], 'another ship is the one in reach');
  assert.deepEqual(st({ state: 'afloat', boarded: true }), ['Boarded', '']);
  assert.deepEqual(st({ state: 'prize' }), ['Taken', '']);
  assert.deepEqual(st({ state: 'prize' }, { name: 'The Red Wake', kind: 'hold' }), ['Taken - E: her hold', 'board']);
  assert.deepEqual(st({ state: 'sinking' }, { name: 'The Red Wake', kind: 'board' }), ['Going down', 'sinking']);
  const merchant = navalHudText(helm({ target: card({ captain: null, faction: 'merchant', sail: null, hostile: false }) }), KEYS).card;
  assert.equal(merchant.sub, 'Pirate Brigantine - 142 m');
  assert.equal(merchant.sail, null);
  // on foot: the card alone, and only the plate's absence says so
  const foot = navalHudText({ ship: null, armed: false, batteries: [], aim: null, aiming: false, target: card({ state: 'prize' }), board: { name: 'The Red Wake', kind: 'hold' }, notoriety: { crown: 'Wayrest', level: 0 } }, KEYS);
  assert.equal(foot.plate, null);
  assert.equal(foot.card.state, 'Taken - E: her hold');
});

// ── the kit ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('NAV-F the dress is the kit\'s: the window, the plate and the card, the presses (Take all the primary, Scuttle the warn), the choice tiles, the chips and the rose, the hold\'s well, the heads and the rows each play a FRAME_ROLES role; the classic skin gets the kit\'s rules cut to the naval surfaces alone, once (mutants: a surface left undressed, the whole kit laid on the classic page)', () => {
  const role = (r, sel) => assert.ok(FRAME_ROLES[r].includes(sel), `${sel} plays ${r}`);
  role('window', 'body .dfnaval-win');
  role('panel', 'body .dfnaval-plate'); role('panel', 'body .dfnaval-card');
  role('button', 'body .dfnaval-btn');
  role('primary', 'body .dfnaval-take');
  role('warn', 'body .dfnaval-scuttle');
  role('tile', 'body .dfnaval-choice');
  role('chip', 'body .dfnaval-chip'); role('chip', 'body .dfnaval-gun');
  role('well', 'body .dfnaval-holdlist');
  role('header', 'body .dfnaval-winhead');
  role('headerRule', 'body .dfnaval-sechead');
  role('listRow', 'body .dfnaval-item');
  const cut = navalKitCss();
  assert.ok(cut.length > 1000 && cut.length < frameCss().length, 'a cut, not the kit');
  const sels = [...cut.matchAll(/(^|\})\s*([^{}@]+)\{/g)].map((m) => m[2].trim()).filter((s) => !/^(from|to|\d+%)/.test(s));
  assert.ok(sels.length > 10);
  for (const s of sels) assert.ok(s.includes('dfnaval'), `only naval rules: ${s.slice(0, 60)}`);
  assert.match(cut, /body \.dfnaval-scuttle \{ border-color: #e0584a/);
  assert.match(NAVAL_HUD_CSS, /\.dfnaval-gun\.active/);
  // Plus carries the kit already; the classic page is given the cut, once
  resetPrefs();
  setPref('skin', 'enhanced');
  const before = globalThis.document.head.children.length;
  assert.equal(injectNavalKit(globalThis.document), false, 'Plus: the kit is on the page');
  setPref('skin', 'classic');
  const byId = globalThis.document.getElementById;
  const ids = new Set();
  globalThis.document.getElementById = (id) => (ids.has(id) ? {} : null);
  try {
    assert.equal(injectNavalKit(globalThis.document), true);
    ids.add(globalThis.document.head.children.at(-1).id);
    assert.equal(injectNavalKit(globalThis.document), false, 'once');
  } finally { globalThis.document.getElementById = byId; }
  assert.equal(globalThis.document.head.children.length, before + 1);
  assert.equal(globalThis.document.head.children.at(-1).textContent, cut);
  resetPrefs();
});

// ── the readout, drawn ──────────────────────────────────────────────────────────────────────────────────────────

test('NAV-F the readout is ONE node made on the first word and UPDATED, never rebuilt: hidden with the HUD and under every window, the plate gone on foot, the rose showing only the batteries she carries, the anchors lit to the level (mutants: a rebuild a frame, covered still drawn)', () => {
  destroyNavalHud();
  const body = globalThis.document.body;
  drawNavalHud(null, { keys: KEYS });
  assert.equal(byClass(body, 'dfnaval-hud').length, 0, 'nothing made for nothing');
  drawNavalHud(helm({ target: card() }), { keys: KEYS });
  const [root] = byClass(body, 'dfnaval-hud');
  assert.ok(root);
  const name = byClass(root, 'dfnaval-name')[0];
  assert.equal(name.textContent, 'Small Ship');
  assert.equal(byClass(root, 'dfnaval-hint')[0].textContent, 'Hold RIGHT CLICK to aim - C: brace');
  assert.equal(byClass(root, 'dfnaval-anchor').filter((a) => a.className.includes(' on')).length, 2);
  assert.equal(byClass(root, 'dfnaval-card-name')[0].textContent, 'The Red Wake');
  assert.equal(byClass(root, 'dfnaval-card')[0].className, 'dfnaval-card pirate hostile');
  assert.equal(byClass(root, 'dfnaval-fill')[0].style.width, '30%', 'the card\'s hull');
  const port = byClass(root, 'port').find((n) => n.className.startsWith('dfnaval-gun'));
  assert.equal(port.className, 'dfnaval-gun port');
  assert.equal(byClass(port, 'dfnaval-gun-fill')[0].style.height, '25%');
  assert.equal(byClass(root, 'starboard').find((n) => n.className.startsWith('dfnaval-gun')).className, 'dfnaval-gun starboard ready active');
  assert.equal(byClass(root, 'stern').find((n) => n.className.startsWith('dfnaval-gun')).className, 'dfnaval-gun stern empty');
  // the next word updates the same nodes
  drawNavalHud(helm({ ship: { ...helm().ship, name: 'Carrack', hull: 0.2 }, aim: { side: 'port', range: 100, max: 180, hot: true } }), { keys: KEYS });
  assert.equal(byClass(body, 'dfnaval-hud').length, 1, 'one node');
  assert.equal(byClass(body, 'dfnaval-hud')[0], root);
  assert.equal(byClass(root, 'dfnaval-name')[0], name);
  assert.equal(name.textContent, 'Carrack');
  assert.ok(byClass(root, 'dfnaval-track').some((t) => t.className === 'dfnaval-track hull low'), 'a hull under a quarter pulses');
  assert.equal(byClass(root, 'dfnaval-aim')[0].className, 'dfnaval-aim hot');
  assert.equal(byClass(root, 'dfnaval-aim')[0].style.display, '');
  assert.equal(byClass(root, 'dfnaval-card')[0].style.display, 'none', 'no ship in the look');
  // a rowboat's rose is gone
  drawNavalHud(helm({ armed: false, batteries: [] }), { keys: KEYS });
  assert.equal(byClass(root, 'dfnaval-rose')[0].style.display, 'none');
  assert.equal(byClass(root, 'dfnaval-gun-side').length, 4, 'the rose\'s chips stand, hidden');
  // covered, and gone
  drawNavalHud(helm(), { covered: true, keys: KEYS });
  assert.equal(root.style.display, 'none');
  drawNavalHud(helm(), { keys: KEYS });
  assert.equal(root.style.display, '');
  drawNavalHud({ ...helm(), ship: null, target: card(), board: null }, { keys: KEYS });
  assert.equal(byClass(root, 'dfnaval-plate')[0].style.display, 'none', 'on foot: the card alone');
  drawNavalHud(null);
  assert.equal(root.style.display, 'none');
  destroyNavalHud();
  assert.equal(byClass(body, 'dfnaval-hud').length, 0);
});

// ── the plunder window ──────────────────────────────────────────────────────────────────────────────────────────

test('NAV-F the plunder window\'s words: her name, class and captain, the lede (a prize is yours; with no ship of yours alongside it says so; a raid\'s beaten raiders), the first HOLD_ROWS pieces by name and "and N more", and Take All naming where it goes; a Take All\'s line says what went where and what would not fit (mutants: the count\'s plural, the overflow row, the pack named for a hold)', () => {
  const items = Array.from({ length: HOLD_ROWS + 3 }, (_, i) => ({ name: `Thing ${i}` }));
  const m = { name: 'The Red Wake', classLine: 'Pirate Brigantine', captain: 'Irna Vosk', items, mine: () => ({ name: 'Carrack' }) };
  const t = plunderText(m);
  assert.equal(t.title, 'The Red Wake');
  assert.equal(t.sub, 'Pirate Brigantine - Captain Irna Vosk');
  assert.equal(t.lede, 'She is yours.');
  assert.equal(t.count, `${HOLD_ROWS + 3} things`);
  assert.equal(t.rows.length, HOLD_ROWS + 1);
  assert.equal(t.rows.at(-1), 'and 3 more');
  assert.equal(t.more, true);
  assert.equal(t.take, 'Take all to your Carrack');
  const alone = plunderText({ ...m, mine: () => null, items: [{ name: 'x' }], captain: null });
  assert.equal(alone.lede, 'She is yours. No ship of yours is alongside to take anything from her to.');
  assert.equal(alone.take, 'Take all into your pack');
  assert.equal(alone.count, '1 thing');
  assert.equal(alone.sub, 'Pirate Brigantine');
  assert.deepEqual(plunderText({ ...m, items: [] }).rows, []);
  assert.equal(plunderText({ ...m, items: [] }).count, 'empty');
  const raid = plunderText({ ...m, raid: true });
  assert.equal(raid.lede, 'The raiders are beaten. Their ship lies alongside, her hold open to you.');
  assert.equal(raid.take, 'Take all into your pack', 'a raid\'s goods go to the pack');
  assert.equal(plunderText({ ...m, items: [{ id: 7 }] }, (it) => `#${it.id}`).rows[0], '#7', 'the host names the pieces');
  assert.equal(thingsText(2), '2 things');
  assert.equal(takenText({ taken: 3, left: 0, where: 'hold' }, 'Carrack'), "3 things to your Carrack's hold.");
  assert.equal(takenText({ taken: 1, left: 2, where: 'pack' }), '1 thing into your pack - 2 things will not fit and stay in her hold.');
  assert.equal(takenText({ taken: 0, left: 4 }), 'You cannot carry any of it - 4 things stay in her hold.');
  assert.equal(takenText(null), 'Her hold is empty.');
});

function prizeModel(o = {}) {
  const log = [];
  let chosen = null;
  const items = [{ name: 'Gold pieces' }, { name: 'Silver ring' }, { name: 'Cutlass' }];
  const m = {
    log, name: 'The Red Wake', captain: 'Irna Vosk', classLine: 'Pirate Brigantine', faction: 'pirate', raid: false, items,
    mine: () => ({ name: 'Carrack' }),
    offers: () => [
      { id: 'repair', title: 'Timber and cordage', useful: true, detail: 'Mend 20 of hull' },
      { id: 'powder', title: 'Powder and shot', useful: false, detail: 'Your guns are loaded' },
      { id: 'press', title: 'Press her crew', useful: true, detail: '4 hands to your guns' },
    ],
    takeAll: () => { log.push('takeAll'); const n = m.items.length; m.items.length = 0; return { taken: n, left: 0, where: 'hold' }; },
    chosen: () => chosen,
    choose: (id) => { log.push(['choose', id]); if (chosen) return false; chosen = id; return true; },
    fate: (which) => log.push(['fate', which]),
    ...o,
  };
  return m;
}

test('NAV-F the plunder window, driven: it opens on Take All; Take All empties her into your ship and says so, the hold\'s presses then shut; one choice is taken and the rest shut, a useless one never pressable; Scuttle and Cast adrift each decide her fate and leave; Escape and the scrim leave; unmounting takes its key listener with it (mutants: two choices, the fate not told, a listener left behind)', () => {
  const host = globalThis.document.createElement('div');
  const exits = [];
  const keysBefore = windowListenerCount('keydown');
  const m = prizeModel();
  const view = mountNavalPlunderWindow(host, { model: m, onExit: (r) => exits.push(r) });
  assert.equal(windowListenerCount('keydown'), keysBefore + 1);
  const [shell] = byClass(host, 'dfnaval-shell');
  assert.equal(shell.getAttribute('aria-label'), 'The Red Wake - plunder');
  assert.equal(shell.querySelector('h2').textContent, 'The Red Wake');
  assert.equal(byClass(shell, 'dfnaval-flag')[0].className, 'dfnaval-flag pirate');
  assert.deepEqual(byClass(shell, 'dfnaval-item').map((n) => n.textContent), ['Gold pieces', 'Silver ring', 'Cutlass']);
  const take = byClass(shell, 'dfnaval-take')[0];
  assert.equal(take.textContent, 'Take all to your Carrack');
  assert.equal(globalThis.document.activeElement, take, 'the press the window is for');
  const tiles = byClass(shell, 'dfnaval-choice');
  assert.deepEqual(tiles.map((t) => t.dataset.choice), ['repair', 'powder', 'press']);
  assert.equal(tiles[1].getAttribute('disabled'), '', 'useless: greyed');
  assert.equal(tiles[1].getAttribute('title'), 'Your guns are loaded', 'with why');
  // take all
  press(take);
  assert.deepEqual(m.log, ['takeAll']);
  assert.equal(byClass(shell, 'dfnaval-note')[0].textContent, "3 things to your Carrack's hold.");
  assert.deepEqual(byClass(shell, 'dfnaval-item').map((n) => n.textContent), ['Nothing left in her hold.']);
  assert.equal(take.getAttribute('disabled'), '', 'nothing left to take');
  assert.equal(byClass(shell, 'dfnaval-open')[0].getAttribute('disabled'), '');
  // one choice
  press(byClass(shell, 'dfnaval-choice')[2]);
  assert.deepEqual(m.log.at(-1), ['choose', 'press']);
  const after = byClass(shell, 'dfnaval-choice');
  assert.equal(after[2].className, 'dfnaval-choice on');
  assert.equal(after[2].getAttribute('aria-pressed'), 'true');
  assert.ok(after[2].textContent.includes('Taken'));
  assert.ok(after.every((t) => t.getAttribute('disabled') === ''), 'once taken, every tile shuts');
  assert.equal(byClass(shell, 'dfnaval-note')[0].textContent, 'Press her crew: taken.');
  press(after[0]);
  assert.equal(m.log.filter((x) => x[0] === 'choose').length, 1, 'a shut tile presses nothing');
  // her fate
  press(byClass(shell, 'dfnaval-scuttle')[0]);
  assert.deepEqual(m.log.at(-1), ['fate', 'scuttle']);
  assert.deepEqual(exits, ['fate']);
  press(byClass(shell, 'dfnaval-adrift')[0]);
  assert.deepEqual(m.log.at(-1), ['fate', 'adrift']);
  // the way out: a press inside the window is not one, the scrim and Escape are
  shell.dispatch('pointerdown', { button: 0, target: shell.querySelector('h2') });
  assert.deepEqual(exits, ['fate', 'fate'], 'inside the window');
  shell.dispatch('pointerdown', { button: 0, target: shell, preventDefault() {} });
  assert.deepEqual(exits, ['fate', 'fate', 'close'], 'the scrim');
  keydown('Escape');
  assert.deepEqual(exits, ['fate', 'fate', 'close', 'close']);
  press(byClass(shell, 'dfnaval-close')[0]);
  assert.equal(exits.at(-1), 'close');
  view.unmount();
  assert.equal(byClass(host, 'dfnaval-shell').length, 0);
  assert.equal(windowListenerCount('keydown'), keysBefore, 'no listener left behind');
  view.unmount();
});

test('NAV-F a raid\'s prize: her hold and no choice - the voyage\'s one way on is Sail On, which the window lands on; Open her hold leaves to the pack\'s loot window (mutants: a raid offered the captor\'s choice, the hold press not saying why)', () => {
  const host = globalThis.document.createElement('div');
  const exits = [];
  const m = prizeModel({ raid: true, mine: () => null });
  const view = mountNavalPlunderWindow(host, { model: m, onExit: (r) => exits.push(r) });
  const [shell] = byClass(host, 'dfnaval-shell');
  assert.equal(byClass(shell, 'dfnaval-close')[0].textContent, 'Close');
  assert.equal(byClass(shell, 'dfnaval-choices')[0].parentNode.style.display, 'none', 'no choice from a raid');
  assert.equal(byClass(shell, 'dfnaval-scuttle').length, 0);
  const sail = byClass(shell, 'dfnaval-sail')[0];
  assert.equal(sail.textContent, 'Sail on');
  assert.equal(globalThis.document.activeElement, sail);
  press(byClass(shell, 'dfnaval-open')[0]);
  assert.deepEqual(exits, ['hold']);
  press(sail);
  assert.deepEqual(m.log.at(-1), ['fate', 'sail']);
  assert.deepEqual(exits, ['hold', 'fate']);
  view.unmount();
});

test('NAV-F the door: one window at a time, mounted lazily in a host of its own on the overlay stack; its close says why and runs once; the host\'s put-away shuts it; the chunk is warmed with the others (mutants: two windows, the reason lost, a second onClose)', async () => {
  assert.ok(WARM_CHUNKS.some((f) => String(f).includes('navalPlunderWindow.js')), 'warmed');
  const closes = [];
  const a = createNavalPlunderOverlay({ model: prizeModel(), onClose: (r) => closes.push(['a', r]) });
  assert.ok(a);
  assert.equal(navalPlunderOpen(), true);
  const hosts = () => globalThis.document.body.children.filter((n) => n.id === 'naval-plunder-host');
  assert.equal(hosts().length, 1);
  await new Promise((r) => setTimeout(r, 20));   // the chunk's import
  assert.equal(byClass(hosts()[0], 'dfnaval-shell').length, 1, 'the window mounted in the door\'s host');
  const b = createNavalPlunderOverlay({ model: prizeModel(), onClose: (r) => closes.push(['b', r]) });
  assert.deepEqual(closes, [['a', 'close']], 'the one before is shut');
  assert.equal(a.done, true);
  assert.equal(hosts().length, 1);
  await new Promise((r) => setTimeout(r, 20));
  press(byClass(hosts()[0], 'dfnaval-open')[0]);
  assert.deepEqual(closes.at(-1), ['b', 'hold'], 'the way out says why');
  assert.equal(b.done, true);
  assert.equal(navalPlunderOpen(), false);
  assert.equal(hosts().length, 0);
  b.dispose();
  assert.equal(closes.length, 2, 'closed once');
  createNavalPlunderOverlay({ model: prizeModel(), onClose: (r) => closes.push(['c', r]) });
  assert.equal(closeNavalPlunder(), true);
  assert.deepEqual(closes.at(-1), ['c', 'close']);
  assert.equal(closeNavalPlunder(), false, 'nothing up');
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(hosts().length, 0, 'a chunk that arrives after the close mounts nothing');
});
