// @ts-check
// WB9d (2026-09-30, Mac: "Further improve his effects, ensure his ground affects actually cause damage and the player
// recieves proper feedback"): HIS GROUND AND HIS ELEMENT, FELT. His ground bit, and his fire landed - but a strike with
// an element never flashed the screen (ui/damageFlash.js: DFU's red flash rides a blow, never spell damage - the law the
// port keeps for every foe), so a fighter standing in his fire lost a tenth of their health a second to a hiss they
// could not place. The court is not DFU's: its ground and its elemental blows say themselves here, in their own colour.
//
//   - THE EDGE: the screen's rim glows in the ground's colour while I stand in it (breathing, never still), and FLARES
//     at each bite - and at each of his elemental blows that lands on me - fading over GROUND_BITE_MS.
//   - THE WARNING: while I stand in it, its name and the one thing to do, under the crosshair - "Burning ground - step
//     out!" - pulsing.
//
// A READOUT, NOT A WINDOW (ui/gateBossBar.js's law): no click, two nodes made on the first need and UPDATED, NOT REBUILT,
// each written only when it changes, hidden (never removed) with nothing to show and with the HUD. `groundViewModel` is
// pure - the pins read it.
//
// Not a DFU member. Ledger A (WB).

/** A bite's flare fades over this (ms); the rim breathes this fast while I stand in it (cycles a second). */
export const GROUND_BITE_MS = 650;
export const GROUND_BREATH_HZ = 1.6;
/** How bright the rim stands while I am in the ground (at the breath's low and high), and a bite's flare over it. */
export const GROUND_EDGE_IN = Object.freeze([0.28, 0.46]);
export const GROUND_EDGE_BITE = 0.62;
/** The rim's alpha is written in steps this fine (a style write only when it moves a step). */
export const GROUND_EDGE_STEP = 0.02;
/** The words. */
export const GROUND_VIEW_TEXT = Object.freeze({
  warn: (ground) => `${ground || 'Burning ground'} - step out!`,
});

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const rgbOf = (c) => `${Math.round(clamp01(c[0]) * 255)}, ${Math.round(clamp01(c[1]) * 255)}, ${Math.round(clamp01(c[2]) * 255)}`;

/**
 * What the rim and the warning say now, or null (nothing to feel). `inside` whether I stand in his ground now, `ground`
 * its name (his aspect's - net/gateMods.js `ground`), `color` its colour ([r, g, b] 0..1 - world/gateBoss.js poolColor);
 * `biteAt` when the last bite or elemental blow landed on me (the court's clock), `biteColor` its colour. Pure.
 * @param {{ inside?: boolean, ground?: string, color?: ReadonlyArray<number>|null, biteAt?: number, biteColor?: ReadonlyArray<number>|null, now: number }} m
 */
export function groundViewModel({ inside = false, ground = '', color = null, biteAt = -Infinity, biteColor = null, now }) {
  const since = now - biteAt;
  const bite = since >= 0 && since < GROUND_BITE_MS ? 1 - since / GROUND_BITE_MS : 0;
  if (!inside && !(bite > 0)) return null;
  const breath = inside ? GROUND_EDGE_IN[0] + (GROUND_EDGE_IN[1] - GROUND_EDGE_IN[0]) * (0.5 + 0.5 * Math.sin((now / 1000) * GROUND_BREATH_HZ * Math.PI * 2)) : 0;
  const edge = clamp01(Math.max(breath, breath + bite * bite * GROUND_EDGE_BITE));
  const c = (bite > 0 && biteColor) || color || biteColor || [1, 0.4, 0.1];
  return { edge: Math.round(edge / GROUND_EDGE_STEP) * GROUND_EDGE_STEP, rgb: rgbOf(c), warn: inside ? GROUND_VIEW_TEXT.warn(ground) : null };
}

export const GROUND_VIEW_STYLE_ID = 'dagger-gate-ground-style';
export const GROUND_VIEW_CSS = `
.wb-ground-edge { position: fixed; inset: 0; pointer-events: none; z-index: 28; opacity: 0; }
.wb-ground-warn { position: fixed; left: 50%; top: 60%; transform: translateX(-50%); pointer-events: none; z-index: 30;
  font: 700 17px 'Cormorant', Georgia, serif; letter-spacing: 0.16em; text-transform: uppercase; white-space: nowrap;
  text-shadow: 0 0 3px #000, 0 0 12px rgba(0,0,0,0.95); animation: wb-ground-warn 0.62s ease-in-out infinite alternate; }
@keyframes wb-ground-warn { from { opacity: 0.72; } to { opacity: 1; } }
`;

let edgeNode = null, warnNode = null;
let shown = { edge: -1, rgb: '', warn: null, vis: '' };

function build(doc) {
  if (doc.getElementById && !doc.getElementById(GROUND_VIEW_STYLE_ID)) {
    const st = doc.createElement('style');
    st.id = GROUND_VIEW_STYLE_ID;
    st.textContent = GROUND_VIEW_CSS;
    (doc.head ?? doc.body)?.append(st);
  }
  edgeNode = doc.createElement('div');
  edgeNode.className = 'wb-ground-edge';
  warnNode = doc.createElement('div');
  warnNode.className = 'wb-ground-warn';
  warnNode.style.display = 'none';
  (doc.body ?? doc.documentElement)?.append(edgeNode, warnNode);
}

/** Draw the rim and the warning for a model (null hides them); `hidden` is the HUD's own hide. */
export function drawGateGround(model, { hidden = false, doc = globalThis.document } = {}) {
  const want = !hidden && !!model;
  if (!edgeNode) {
    if (!want || !doc?.createElement) return;
    build(doc);
  }
  const vis = want ? 'on' : 'off';
  if (vis !== shown.vis) {
    shown.vis = vis;
    if (!want) { edgeNode.style.opacity = '0'; warnNode.style.display = 'none'; shown.edge = 0; shown.warn = null; }
  }
  if (!want || !model) return;
  if (model.rgb !== shown.rgb) {
    shown.rgb = model.rgb;
    edgeNode.style.background = `radial-gradient(ellipse at 50% 50%, rgba(${model.rgb}, 0) 42%, rgba(${model.rgb}, 0.55) 78%, rgba(${model.rgb}, 1) 100%)`;
    warnNode.style.color = `rgb(${model.rgb})`;
  }
  if (model.edge !== shown.edge) { shown.edge = model.edge; edgeNode.style.opacity = String(model.edge); }
  if (model.warn !== shown.warn) {
    shown.warn = model.warn;
    warnNode.style.display = model.warn ? '' : 'none';
    if (model.warn) warnNode.textContent = model.warn;
  }
}

/** The page is going (a test's reset): the nodes leave with it. */
export function destroyGateGround() {
  edgeNode?.remove?.(); warnNode?.remove?.();
  edgeNode = null; warnNode = null;
  shown = { edge: -1, rgb: '', warn: null, vis: '' };
}
