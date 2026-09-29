// @ts-check
// NAV-F (2026-09-28, Mac: "All UI elements should follow enhanced plus UI ... extremely detailed, authentic and easy to
// use") - THE HELM'S READOUT: what a captain needs at a glance while the guns are served, in the stone-and-brass kit.
// A READOUT, NOT A WINDOW (the gate bar's law, ui/gateBossBar.js): no overlay, no pause, no keys of its own - one node
// made on the first word and UPDATED, NOT REBUILT, hidden with the HUD and under every window.
//
// FOUR PARTS, placed where Black Flag's stand and where the port's own HUD leaves room:
//   the SHIP PLATE (bottom right)  your ship: her name, her hull, sails and crew as the vitals' banded bars (the Plus
//                                  sheet's own tones - VITALS_CSS - the hull in health's red, the canvas in bone, the
//                                  crew in fatigue's green), a fire and a brace chip, the crown's waters and your
//                                  notoriety in them as four anchors, and THE BATTERY ROSE: bow over stern, port and
//                                  starboard either side - each battery a chip with its guns, filling as it reloads,
//                                  lit gold where the look lays it and brass-edged when it is loaded
//   the AIM (under the crosshair)  while the attack is held: the battery, the range the guns are laid for and their
//                                  longest, and ON TARGET in red when the volley's zone lies on a ship
//   the TARGET CARD (under the     the ship the look is on: her name, her class and captain, how far, her hull and
//   compass, the boss bar's place) sails, whether she is hostile, and her state - striking her colours, going down,
//                                  taken - and when she can be boarded, the key that boards her
//   the HINT (the plate's foot)    the keys, in the registry's own names (the host hands them)
//   the WARNING (over the          AUDIT NAV1 (the guns): a ship's battery run out and bearing on you - "BROADSIDE" and
//   crosshair)                     the brace's key, pulsing - the readout's half of the run-out's tell (the host's glint
//                                  along her ports and the trucks' rumble are the rest)
//   the TALLY (under the aim)      AUDIT NAV1: your last volley's count once its last ball is down - how many struck,
//                                  how many below her waterline, how many through her rigging
// Every part's words are its model's (scenes/navalHost.js hudModel); `navalHudText` is pure, and the pins read it.
//
// THE DRESS. The plate and the card play the kit's `panel` role and the plunder window's presses its `button`,
// `primary` and `warn` (ui/enhancedFrame.js FRAME_ROLES) - on Enhanced Plus the kit is already on the page; on the
// classic skin this module lays the kit's rules cut to its own selectors (the Sigil Broker's own answer, AUDIT SET
// U1), so a captain reads the same readout whatever skin they play. The bars are the vitals' own banded paint with
// brass clasps; every word is the pixel face with the HUD's hard outline.

import { FRAME_TONES, frameCss, scopeRules } from './enhancedFrame.js';
import { PIXEL_FONT_CSS, PIXELIFY_FIVE_FACE } from './pixelifyFive.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';

export const NAVAL_HUD_STYLE_ID = 'dagger-naval-hud-style';
export const NAVAL_KIT_STYLE_ID = 'dagger-naval-kit-style';
/** Where the card stands: under the compass by the house law (the journey bar's PLUS8, the helm panel's CSA-L) - the
 *  compass's foot (.hud-top at 18px, the strip 26px and its 2px rule, all times the HUD scale) and a gap - a step lower
 *  while the foe's bar is up under the compass (its blade taller still, NAVAL_CARD_TOP_FOE / _BLADE). Under the helm
 *  panel when it stands (THE MERGE with CSA-L): its bar is as tall as its buttons wrap, so it is measured -
 *  drawNavalHud's `under` - and the card stands NAVAL_CARD_GAP below its foot. And how wide the plate is. */
export const NAVAL_CARD_TOP = 'calc(18px + 28px * var(--hud-scale, 1) + 12px)';
export const NAVAL_CARD_TOP_FOE = 'calc(18px + 28px * var(--hud-scale, 1) + 12px + 46px * var(--hud-scale, 1))';
export const NAVAL_CARD_TOP_BLADE = 'calc(18px + 28px * var(--hud-scale, 1) + 12px + 76px * var(--hud-scale, 1))';
export const NAVAL_CARD_GAP = 8;
export const NAVAL_PLATE_W = 272;
/** On a finger's screen the plate stands over the touch corner's presses - 16px up and 48px tall (ui/touch.js
 *  layoutCorner) - and a gap, never on them. */
export const NAVAL_PLATE_TOUCH_BOTTOM = 16 + 48 + 12;
/** AUDIT NAV1 (the helm): a finger's BRACE - the plate's own press under the rose, held to brace (the touch table's
 *  three slots hold no Crouch by default, and the hint said "Crouch: brace"): a finger's height (the platforms'
 *  48 px target, less the plate's border). */
export const NAVAL_BRACE_H = 46;

const OUTLINED = '-1px 0 0 #050608, 1px 0 0 #050608, 0 -1px 0 #050608, 0 1px 0 #050608, 2px 2px 0 rgba(0,0,0,0.7)';
const CLASP = 'linear-gradient(180deg, #f3cf86 0 2px, transparent 2px), linear-gradient(90deg, #e2b064 0 2px, #c08a3e 2px 4px, #7a5424 4px 6px)';
const T = FRAME_TONES;

export const NAVAL_HUD_CSS = `
${PIXELIFY_FIVE_FACE}
.dfnaval-hud { position: fixed; inset: 0; pointer-events: none; z-index: 5; ${PIXEL_FONT_CSS} color: #d8cfae; --nc-top: ${NAVAL_CARD_TOP}; }
body:has(.hud-foe.on) .dfnaval-hud { --nc-top: ${NAVAL_CARD_TOP_FOE}; }
body:has(.hud-foe.on.blade) .dfnaval-hud { --nc-top: ${NAVAL_CARD_TOP_BLADE}; }
.dfnaval-hud.touch .dfnaval-plate { right: calc(18px + env(safe-area-inset-right, 0px)); bottom: calc(${NAVAL_PLATE_TOUCH_BOTTOM}px + env(safe-area-inset-bottom, 0px)); }
.dfnaval-plate { position: absolute; right: 18px; bottom: 22px; width: ${NAVAL_PLATE_W}px; padding: 10px 12px 9px;
  background: ${T.groundPanel}; border: 2px solid ${T.stoneLit}; transform: scale(var(--hud-scale, 1)); transform-origin: bottom right; }
.dfnaval-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: -10px -12px 8px; padding: 6px 12px 5px;
  font-size: 14px; letter-spacing: 0.12em; text-transform: uppercase; color: #efe8d6; text-shadow: ${OUTLINED}; }
.dfnaval-waters { font-size: 10px; letter-spacing: 0.06em; color: #b3a684; text-transform: none; white-space: nowrap; }
.dfnaval-anchors { display: inline-flex; gap: 3px; margin-left: 5px; vertical-align: middle; }
.dfnaval-anchor { width: 7px; height: 7px; background: #2a241b; box-shadow: 0 0 0 1px #050608; }
.dfnaval-anchor.on { background: #b83a2e; box-shadow: 0 0 0 1px #050608, inset 1px 1px 0 rgba(255,255,255,0.3); }
.dfnaval-bar { display: grid; grid-template-columns: 44px 1fr; align-items: center; gap: 8px; margin: 0 6px 5px; }
.dfnaval-bar-label { font-size: 11px; letter-spacing: 0.08em; color: #c9bfa4; text-shadow: 1px 1px 0 #050608; }
.dfnaval-track { position: relative; height: 12px; border: 2px solid; border-color: #9a9079 #3a352a #25221b #6e6755; isolation: isolate;
  background: linear-gradient(180deg, rgba(0,0,0,0.6) 0 2px, transparent 2px), #140d0a; box-shadow: 0 0 0 1px #050608, 2px 2px 0 1px rgba(0,0,0,0.45); }
.dfnaval-track::before, .dfnaval-track::after { content: ''; position: absolute; top: -2px; bottom: -2px; width: 6px; z-index: 2; box-shadow: 0 0 0 1px #050608; background: ${CLASP}; }
.dfnaval-track::before { left: -6px; }
.dfnaval-track::after { right: -6px; }
.dfnaval-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 100%; transition: width 160ms linear; }
.dfnaval-fill::after { content: ''; position: absolute; top: 0; bottom: 0; right: 0; width: min(2px, 100%); opacity: 0.85; background: #fff; }
.dfnaval-track.hull .dfnaval-fill { background: linear-gradient(180deg, #f2a597 0 2px, #d8685a 2px 4px, #b53a2e 4px 8px, #8a2820 8px 10px, #5c1812 10px); }
.dfnaval-track.sail .dfnaval-fill { background: linear-gradient(180deg, #fbf6e4 0 2px, #e9e0c4 2px 4px, #c9bd98 4px 8px, #9c916f 8px 10px, #6b6249 10px); }
.dfnaval-track.crew .dfnaval-fill { background: linear-gradient(180deg, #b9f0c4 0 2px, #5fc27c 2px 4px, #2f9152 4px 8px, #216b3b 8px 10px, #134526 10px); }
.dfnaval-track.low { animation: dfnaval-low 0.9s steps(1) infinite; }
@keyframes dfnaval-low { 50% { border-color: #e0584a #5a130f #3d0d0a #b83a2e; } }
.dfnaval-chips { display: flex; gap: 6px; justify-content: flex-end; min-height: 0; margin: 2px 6px 0; }
.dfnaval-chip { padding: 1px 6px; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; background: ${T.groundChip}; border: 2px solid ${T.stoneDim}; color: #efe8d6; text-shadow: 1px 1px 0 #050608; }
.dfnaval-chip.fire { border-color: #e0584a #5a130f #3d0d0a #b83a2e; color: #ffd9a8; }
.dfnaval-chip.brace { border-color: ${T.brassHi} ${T.brassLo} #5c3f1a ${T.brass}; color: ${T.brassHi}; }
.dfnaval-chip.wreck { border-color: #e0584a #5a130f #3d0d0a #b83a2e; color: #ffc4bb; }
.dfnaval-rose { display: grid; grid-template-columns: 1fr 1fr 1fr; grid-template-rows: auto auto auto; gap: 4px; margin: 8px 6px 2px; align-items: stretch; }
.dfnaval-gun { position: relative; overflow: hidden; padding: 3px 4px 4px; min-height: 30px; text-align: center; background: ${T.groundButton};
  border: 2px solid; border-color: ${T.stoneLit} ${T.stoneDim} ${T.stoneDark} ${T.stoneMid}; box-shadow: 0 0 0 1px #050608; }
.dfnaval-gun.bow { grid-column: 2; grid-row: 1; }
.dfnaval-gun.port { grid-column: 1; grid-row: 2; }
.dfnaval-gun.starboard { grid-column: 3; grid-row: 2; }
.dfnaval-gun.stern { grid-column: 2; grid-row: 3; }
.dfnaval-ship { grid-column: 2; grid-row: 2; align-self: center; justify-self: center; width: 16px; height: 34px;
  background: linear-gradient(180deg, ${T.stoneLit}, ${T.stoneMid}); clip-path: polygon(50% 0, 100% 30%, 100% 100%, 0 100%, 0 30%); box-shadow: 0 0 0 1px #050608; }
.dfnaval-gun-fill { position: absolute; left: 0; right: 0; bottom: 0; height: 0; background: rgba(192,138,62,0.28); z-index: 0; }
.dfnaval-gun-side, .dfnaval-gun-count { position: relative; z-index: 1; display: block; line-height: 1.15; text-shadow: 1px 1px 0 #050608; }
.dfnaval-gun-side { font-size: 10px; letter-spacing: 0.12em; color: #efe8d6; text-transform: uppercase; }
.dfnaval-gun-count { font-size: 9px; color: #a89f88; }
.dfnaval-gun.ready { border-color: ${T.brassHi} ${T.brassLo} #5c3f1a ${T.brass}; }
.dfnaval-gun.ready .dfnaval-gun-count { color: ${T.brassHi}; }
.dfnaval-gun.active { background: #2c2413; box-shadow: 0 0 0 1px #050608, 0 0 8px rgba(243,207,134,0.45); }
.dfnaval-gun.active .dfnaval-gun-side { color: ${T.gold}; text-shadow: 1px 1px 0 rgb(93,77,12); }
.dfnaval-gun.empty { opacity: 0.5; }
.dfnaval-hint { margin: 7px 6px 0; font-size: 10px; letter-spacing: 0.05em; color: #8f8670; text-align: center; text-shadow: 1px 1px 0 #050608; }
.dfnaval-brace { margin: 8px 6px 0; height: ${NAVAL_BRACE_H}px; line-height: ${NAVAL_BRACE_H - 4}px; text-align: center; pointer-events: auto; touch-action: none;
  user-select: none; -webkit-user-select: none; font-size: 14px; letter-spacing: 0.16em; text-transform: uppercase; color: #efe8d6; text-shadow: ${OUTLINED};
  background: ${T.groundButton}; border: 2px solid; border-color: ${T.stoneLit} ${T.stoneDim} ${T.stoneDark} ${T.stoneMid}; box-shadow: 0 0 0 1px #050608; }
.dfnaval-brace.down { background: #2c2413; border-color: ${T.brassHi} ${T.brassLo} #5c3f1a ${T.brass}; color: ${T.gold}; }
.dfnaval-aim { position: absolute; left: 50%; top: calc(50% + 34px); transform: translateX(-50%); white-space: nowrap; font-size: 13px;
  letter-spacing: 0.14em; text-transform: uppercase; color: #efe8d6; text-shadow: ${OUTLINED}; }
.dfnaval-aim .dfnaval-aim-range { color: ${T.brassHi}; }
.dfnaval-aim.hot { color: #ffb4a6; }
.dfnaval-aim.hot .dfnaval-aim-range { color: #ff8a76; }
.dfnaval-aim.dim { color: #a39a86; }
.dfnaval-aim.dim .dfnaval-aim-range { color: #8f8670; }
.dfnaval-card { position: absolute; left: 50%; top: var(--nc-top); transform: translateX(-50%); width: 400px; max-width: 86vw; padding: 7px 14px 8px;
  text-align: center; background: ${T.groundPanel}; border: 2px solid ${T.stoneLit}; }
.dfnaval-card-name { font-size: 15px; letter-spacing: 0.14em; text-transform: uppercase; color: #efe8d6; text-shadow: ${OUTLINED}; }
.dfnaval-card.hostile .dfnaval-card-name { color: #ffb4a6; }
.dfnaval-card.navy .dfnaval-card-name { color: #f1d0c6; }
.dfnaval-card.merchant .dfnaval-card-name { color: #f6e3a6; }
.dfnaval-card-sub { margin: 2px 0 6px; font-size: 11px; letter-spacing: 0.05em; color: #c9bfa4; text-shadow: 1px 1px 0 #050608; }
.dfnaval-card .dfnaval-track { margin: 0 8px 4px; height: 10px; }
.dfnaval-card .dfnaval-track.sail { height: 5px; }
.dfnaval-card-state { min-height: 14px; margin-top: 4px; font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: ${T.brassHi}; text-shadow: ${OUTLINED}; }
.dfnaval-card-state.board { color: ${T.gold}; }
.dfnaval-card-state.sinking { color: #ff8a76; }
.dfnaval-warn { position: absolute; left: 50%; top: calc(50% - 62px); transform: translateX(-50%); white-space: nowrap; padding: 3px 12px 4px;
  font-size: 15px; letter-spacing: 0.16em; text-transform: uppercase; color: #ffd9cf; text-shadow: ${OUTLINED};
  background: rgba(60, 12, 8, 0.72); border: 2px solid; border-color: #e0584a #5a130f #3d0d0a #b83a2e; box-shadow: 0 0 0 1px #050608;
  animation: dfnaval-warn 0.5s steps(1) infinite; }
.dfnaval-warn .dfnaval-warn-key { color: ${T.brassHi}; }
@keyframes dfnaval-warn { 50% { color: #ff9c8a; border-color: #ff8a76 #7a1a12 #52110c #e0584a; } }
.dfnaval-tally { position: absolute; left: 50%; top: calc(50% + 56px); transform: translateX(-50%); white-space: nowrap; font-size: 12px;
  letter-spacing: 0.1em; text-transform: uppercase; color: #efe8d6; text-shadow: ${OUTLINED}; }
.dfnaval-tally .dfnaval-tally-hits { color: ${T.brassHi}; }
.dfnaval-tally.miss .dfnaval-tally-hits { color: #b3a684; }
`;

/** A share as a whole percent, bounded. */
const pct = (v) => Math.max(0, Math.min(100, Math.round((Number(v) || 0) * 100)));
const SIDE_WORDS = Object.freeze({ bow: 'Bow', port: 'Port', starboard: 'Starboard', stern: 'Stern' });
const GUN_WORDS = Object.freeze({ long: 'long guns', swivel: 'swivels', heavy: 'great guns', chain: 'chain shot', barrel: 'fire barrels' });

/** AUDIT NAV1 (the helm): the aim line's tail - on target, or why the battery will not fire yet. */
function aimTail(a) {
  switch (a.state) {
    case 'reloading': return ` - reloading ${(Number(a.left) || 0).toFixed(1)} s`;
    case 'braced': return ' - braced';
    case 'crippled': return ' - guns silent';
    case 'empty': return ' - no barrels';
    default: return a.hot ? ' - on target' : '';
  }
}

/** The card's state line: what she is doing, and - when she is in reach - the key that goes over her rail. */
function cardState(t, board, key) {
  const mine = board?.name === t.name;
  if (t.state === 'sinking') return { text: 'Going down', kind: 'sinking' };
  if (t.state === 'prize') return mine && board.kind === 'hold' ? { text: `Taken - ${key}: her hold`, kind: 'board' } : { text: 'Taken', kind: '' };
  if (t.boarded) return { text: 'Boarded', kind: '' };
  if (t.state === 'struck') return mine && board.kind === 'board' ? { text: `Colours struck - ${key}: board her`, kind: 'board' } : { text: 'Colours struck', kind: '' };
  return { text: t.hostile ? 'Hostile' : '', kind: '' };
}

/**
 * The readout's words for a model - pure, the pins' reading. `keys` the registry's names for the attack, Activate and
 * the brace. `plate` is null on foot (the card alone stands, and only while a ship is in reach). `touch`: a finger's
 * screen, where no key is named - a tap is the activation (the host's one arm, a key's or a click's alike), the
 * finger held and dragged the aim (touch.js aimHold), the lift the broadside, and Crouch the touch table's press.
 */
export function navalHudText(model, keys = {}, { touch = false } = {}) {
  if (!model) return null;
  const aimKey = keys.aim ?? 'Attack', boardKey = touch ? 'Tap' : (keys.board ?? 'Activate'), braceKey = keys.brace ?? 'Brace';
  const bracePress = touch ? 'hold Brace' : `${braceKey}: brace`;   // AUDIT NAV1: a finger's is the plate's own press
  const batteries = (model.batteries ?? []).map((b) => ({
    side: b.side, word: SIDE_WORDS[b.side],
    count: b.gun === 'barrel' ? `${b.barrels ?? 0} barrel${b.barrels === 1 ? '' : 's'}` : `${b.guns} ${b.guns === 1 ? GUN_WORDS[b.gun].replace(/s$/, '') : GUN_WORDS[b.gun]}`,
    fill: pct(b.ready ? 1 : b.progress), ready: !!b.ready, active: !!b.active, empty: b.gun === 'barrel' && !(b.barrels > 0),
  }));
  const a = model.aim;
  const aim = a ? {
    text: a.barrel ? `${SIDE_WORDS[a.side]} - roll a fire barrel` : `${SIDE_WORDS[a.side]} ${a.side === 'bow' || a.side === 'stern' ? 'chasers' : 'broadside'} - `,
    range: a.barrel ? '' : `${a.range} m${a.range >= a.max - 1 ? ' (longest)' : ''}`,
    hot: !!a.hot && (a.state ?? 'ready') === 'ready', dim: !!a.state && a.state !== 'ready', target: aimTail(a),
  } : null;
  const t = model.target;
  const st = t ? cardState(t, model.board, boardKey) : null;
  const card = t ? {
    name: t.name, faction: t.faction, hostile: !!t.hostile,
    sub: [t.classLine, t.captain ? `Captain ${t.captain}` : null, `${t.distance} m`].filter(Boolean).join(' - '),
    hull: pct(t.hull), sail: t.sail == null ? null : pct(t.sail),
    state: st.text, stateKind: st.kind,
  } : null;
  const ship = model.ship;
  const plate = ship ? {
    name: ship.name, waters: `${model.notoriety.crown} waters`, anchors: model.notoriety.level,
    hull: pct(ship.hull), sail: ship.sail == null ? null : pct(ship.sail), crew: ship.crew == null ? null : pct(ship.crew),
    chips: [ship.wrecked ? 'wreck' : null, ship.fire ? 'fire' : null, ship.braced ? 'brace' : null].filter(Boolean),
    batteries,
    // the press that matters most, first: a ship in reach to board or plunder, then the guns
    hint: model.board ? `${boardKey}: ${model.board.kind === 'hold' ? `open ${model.board.name}'s hold` : `board ${model.board.name}`}`
      : !model.armed ? 'No guns aboard' : model.aiming ? `${touch ? 'Lift' : 'Let go'} to fire - ${bracePress}`
      : `${touch ? 'Hold and drag' : `Hold ${aimKey}`} to aim - ${bracePress}`,
    brace: touch && !!model.armed,
  } : null;
  // AUDIT NAV1 (the guns): the tell's words, and the last volley's count
  const warn = model.incoming ? { text: 'Broadside', key: bracePress } : null;
  const tl = model.tally;
  const tally = tl ? {
    hits: `${tl.hits} of ${tl.balls} ${tl.balls === 1 ? 'ball' : 'balls'} struck`, miss: tl.hits === 0,
    rest: [tl.holed ? `${tl.holed} below her waterline` : null, tl.rig ? `${tl.rig} through her rigging` : null].filter(Boolean).map((x) => ` - ${x}`).join(''),
  } : null;
  return { plate, aim, card, warn, tally };
}
const CHIP_WORDS = Object.freeze({ wreck: 'Crippled', fire: 'On fire', brace: 'Braced' });

let root = null, parts = null;
let shown = {};
let touchBrace = false;   // AUDIT NAV1: the plate's Brace held under a finger

/** AUDIT NAV1 (the helm): whether a finger holds the plate's Brace - read by the world's brace beside the Crouch key.
 *  Only while the press stands: a plate hidden, covered or gone lets go (drawNavalHud, destroyNavalHud). */
export function navalTouchBrace() { return touchBrace; }

function el(doc, tag, cls, text = null) {
  const n = doc.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
const addSheet = (doc, id, text) => {
  if (doc.getElementById?.(id)) return false;
  const st = doc.createElement('style');
  st.id = id;
  st.textContent = text;
  (doc.head ?? doc.body)?.append(st);
  return true;
};
/** The kit's rules cut to the naval surfaces' own selectors - the classic skin's copy of their Plus dress. */
export const navalKitCss = () => scopeRules(frameCss(), (sel) => sel.includes('dfnaval'));
/** The kit for the readout and the plunder window, on the classic skin (Enhanced Plus already carries it) - once. */
export function injectNavalKit(doc = globalThis.document) {
  if (!doc?.createElement || isEnhancedPlus()) return false;
  return addSheet(doc, NAVAL_KIT_STYLE_ID, navalKitCss());
}
function injectSheets(doc) {
  addSheet(doc, NAVAL_HUD_STYLE_ID, NAVAL_HUD_CSS);
  injectNavalKit(doc);
}

function bar(doc, kind, label) {
  const row = el(doc, 'div', 'dfnaval-bar');
  const track = el(doc, 'div', `dfnaval-track ${kind}`);
  const fill = el(doc, 'i', 'dfnaval-fill');
  track.append(fill);
  row.append(el(doc, 'span', 'dfnaval-bar-label', label), track);
  return { row, track, fill };
}

function build(doc) {
  injectSheets(doc);
  root = el(doc, 'div', 'dfnaval-hud');
  root.setAttribute?.('aria-hidden', 'true');
  // the card
  const card = el(doc, 'div', 'dfnaval-card');
  const cardName = el(doc, 'div', 'dfnaval-card-name');
  const cardSub = el(doc, 'div', 'dfnaval-card-sub');
  const cardHull = el(doc, 'div', 'dfnaval-track hull'); const cardHullFill = el(doc, 'i', 'dfnaval-fill'); cardHull.append(cardHullFill);
  const cardSail = el(doc, 'div', 'dfnaval-track sail'); const cardSailFill = el(doc, 'i', 'dfnaval-fill'); cardSail.append(cardSailFill);
  const cardState = el(doc, 'div', 'dfnaval-card-state');
  card.append(cardName, cardSub, cardHull, cardSail, cardState);
  // the aim
  const aim = el(doc, 'div', 'dfnaval-aim');
  const aimText = el(doc, 'span', 'dfnaval-aim-text'), aimRange = el(doc, 'span', 'dfnaval-aim-range'), aimTarget = el(doc, 'span', 'dfnaval-aim-target');
  aim.append(aimText, aimRange, aimTarget);
  // the warning and the tally
  const warn = el(doc, 'div', 'dfnaval-warn');
  const warnText = el(doc, 'span', 'dfnaval-warn-text'), warnKey = el(doc, 'span', 'dfnaval-warn-key');
  warn.append(warnText, el(doc, 'span', null, ' - '), warnKey);
  const tallyEl = el(doc, 'div', 'dfnaval-tally');
  const tallyHits = el(doc, 'span', 'dfnaval-tally-hits'), tallyRest = el(doc, 'span', 'dfnaval-tally-rest');
  tallyEl.append(tallyHits, tallyRest);
  // the plate
  const plate = el(doc, 'div', 'dfnaval-plate');
  const head = el(doc, 'div', 'dfnaval-head');
  const name = el(doc, 'span', 'dfnaval-name');
  const waters = el(doc, 'span', 'dfnaval-waters');
  const watersWord = el(doc, 'span', 'dfnaval-waters-word');
  const anchorsBox = el(doc, 'span', 'dfnaval-anchors');
  const anchors = [0, 1, 2, 3].map(() => { const a = el(doc, 'i', 'dfnaval-anchor'); anchorsBox.append(a); return a; });
  waters.append(watersWord, anchorsBox);
  head.append(name, waters);
  const hull = bar(doc, 'hull', 'Hull'), sail = bar(doc, 'sail', 'Sails'), crew = bar(doc, 'crew', 'Crew');
  const chips = el(doc, 'div', 'dfnaval-chips');
  const rose = el(doc, 'div', 'dfnaval-rose');
  const guns = {};
  for (const side of ['bow', 'port', 'starboard', 'stern']) {
    const g = el(doc, 'div', `dfnaval-gun ${side}`);
    const fill = el(doc, 'i', 'dfnaval-gun-fill');
    const word = el(doc, 'span', 'dfnaval-gun-side', SIDE_WORDS[side]);
    const count = el(doc, 'span', 'dfnaval-gun-count');
    g.append(fill, word, count);
    guns[side] = { g, fill, count };
    rose.append(g);
  }
  rose.append(el(doc, 'i', 'dfnaval-ship'));
  const hint = el(doc, 'div', 'dfnaval-hint');
  const brace = el(doc, 'div', 'dfnaval-brace', 'Brace');
  const hold = (on) => (e) => { e?.preventDefault?.(); e?.stopPropagation?.(); touchBrace = on; };
  brace.addEventListener?.('touchstart', hold(true), { passive: false });
  brace.addEventListener?.('touchend', hold(false), { passive: false });
  brace.addEventListener?.('touchcancel', hold(false));
  plate.append(head, hull.row, sail.row, crew.row, chips, rose, hint, brace);
  root.append(card, warn, aim, tallyEl, plate);
  (doc.body ?? doc.documentElement)?.append(root);
  parts = { card, cardName, cardSub, cardHull, cardHullFill, cardSail, cardSailFill, cardState, aim, aimText, aimRange, aimTarget, warn, warnText, warnKey, tally: tallyEl, tallyHits, tallyRest, plate, name, watersWord, anchors, hull, sail, crew, chips, rose, guns, hint, brace };
  shown = {};
  touchBrace = false;
}

const put = (key, node, text) => { if (shown[key] !== text) { shown[key] = text; node.textContent = text; } };
const cls = (key, node, name) => { if (shown[key] !== name) { shown[key] = name; node.className = name; } };
const show = (key, node, on) => { if (shown[key] !== on) { shown[key] = on; node.style.display = on ? '' : 'none'; } };
const width = (key, node, v) => { if (shown[key] !== v) { shown[key] = v; node.style.width = `${v}%`; } };

/**
 * Draw the readout for a model (null hides it). `covered` - the HUD's own hide, a window over the world, a pause;
 * `keys` the registry's names for the aim, Activate and the brace; `scale` the HUD's scale (the enhanced HUD's
 * --hud-scale, which this sibling layer copies onto its root - the plate's size and the card's place read it);
 * `under` what stands over the card at the top of the screen (the helm panel's bar, ui/enhancedHelm.js) or null;
 * `touch` a finger's screen (the plate over the touch corner, the hints in its words).
 */
export function drawNavalHud(model, { covered = false, doc = globalThis.document, keys = {}, scale = 1, under = null, touch = false } = {}) {
  const want = !covered && !!model;
  if (!root) {
    if (!want || !doc?.createElement) return;
    build(doc);
  }
  show('root', root, want);
  if (!want) { shown.braceBtn = false; touchBrace = false; return; }
  const t = navalHudText(model, keys, { touch });
  // the helm panel's foot, read before this frame's writes here and only while the card and the panel both stand
  const foot = t.card ? (under?.getBoundingClientRect?.()?.bottom ?? 0) : 0;
  if (shown.scale !== scale) { shown.scale = scale; root.style.setProperty?.('--hud-scale', String(scale)); }
  cls('rootc', root, touch ? 'dfnaval-hud touch' : 'dfnaval-hud');
  const p = t.plate;
  show('plate', parts.plate, !!p);
  const braceOn = !!p?.brace;
  if (shown.braceBtn !== braceOn) { shown.braceBtn = braceOn; parts.brace.style.display = braceOn ? '' : 'none'; if (!braceOn) touchBrace = false; }
  cls('bracec', parts.brace, braceOn && touchBrace ? 'dfnaval-brace down' : 'dfnaval-brace');
  if (p) {
    put('name', parts.name, p.name);
    put('waters', parts.watersWord, p.waters);
    for (let i = 0; i < 4; i++) cls(`anchor${i}`, parts.anchors[i], i < p.anchors ? 'dfnaval-anchor on' : 'dfnaval-anchor');
    width('hull', parts.hull.fill, p.hull);
    cls('hullLow', parts.hull.track, p.hull <= 25 ? 'dfnaval-track hull low' : 'dfnaval-track hull');
    show('sailRow', parts.sail.row, p.sail != null);
    if (p.sail != null) width('sail', parts.sail.fill, p.sail);
    show('crewRow', parts.crew.row, p.crew != null);
    if (p.crew != null) width('crew', parts.crew.fill, p.crew);
    const chipKey = p.chips.join(',');
    if (shown.chips !== chipKey) {
      shown.chips = chipKey;
      parts.chips.textContent = '';
      for (const c of p.chips) parts.chips.append(el(doc, 'span', `dfnaval-chip ${c}`, CHIP_WORDS[c]));
    }
    for (const side of ['bow', 'port', 'starboard', 'stern']) {
      const g = parts.guns[side];
      const b = p.batteries.find((x) => x.side === side);
      show(`gun-${side}`, g.g, !!b);
      if (!b) continue;
      cls(`gunc-${side}`, g.g, `dfnaval-gun ${side}${b.ready ? ' ready' : ''}${b.active ? ' active' : ''}${b.empty ? ' empty' : ''}`);
      put(`gunn-${side}`, g.count, b.count);
      if (shown[`gunf-${side}`] !== b.fill) { shown[`gunf-${side}`] = b.fill; g.fill.style.height = `${b.ready ? 0 : b.fill}%`; }
    }
    show('rose', parts.rose, p.batteries.length > 0);
    put('hint', parts.hint, p.hint);
  }
  // the aim
  show('aim', parts.aim, !!t.aim);
  if (t.aim) {
    cls('aimc', parts.aim, t.aim.hot ? 'dfnaval-aim hot' : t.aim.dim ? 'dfnaval-aim dim' : 'dfnaval-aim');
    put('aimt', parts.aimText, t.aim.text);
    put('aimr', parts.aimRange, t.aim.range);
    put('aimg', parts.aimTarget, t.aim.target);
  }
  // the warning, and the last volley's tally (under the aim's line while the aim is up)
  show('warn', parts.warn, !!t.warn);
  if (t.warn) { put('warnt', parts.warnText, t.warn.text); put('warnk', parts.warnKey, t.warn.key); }
  show('tally', parts.tally, !!t.tally);
  if (t.tally) {
    cls('tallyc', parts.tally, t.tally.miss ? 'dfnaval-tally miss' : 'dfnaval-tally');
    put('tallyh', parts.tallyHits, t.tally.hits);
    put('tallyr', parts.tallyRest, t.tally.rest);
  }
  // the card - under the compass by the sheet's law (--nc-top), under the helm panel's foot while it stands
  show('card', parts.card, !!t.card);
  if (t.card) {
    const top = foot > 0 ? `${Math.ceil(foot) + NAVAL_CARD_GAP}px` : '';
    if (shown.cardTop !== top) { shown.cardTop = top; parts.card.style.top = top; }
    cls('cardc', parts.card, `dfnaval-card ${t.card.faction}${t.card.hostile ? ' hostile' : ''}`);
    put('cardn', parts.cardName, t.card.name);
    put('cards', parts.cardSub, t.card.sub);
    width('cardh', parts.cardHullFill, t.card.hull);
    show('cardsail', parts.cardSail, t.card.sail != null);
    if (t.card.sail != null) width('cardsl', parts.cardSailFill, t.card.sail);
    put('cardst', parts.cardState, t.card.state);
    cls('cardstc', parts.cardState, `dfnaval-card-state${t.card.stateKind ? ` ${t.card.stateKind}` : ''}`);
  }
}

/** The page is going (a test's reset, the host's teardown): the node leaves with it. */
export function destroyNavalHud() {
  root?.remove?.();
  root = null; parts = null; shown = {}; touchBrace = false;
}
