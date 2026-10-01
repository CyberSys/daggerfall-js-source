// @ts-check
// ═══════════════════════════════════════════════════════════════════
// NODE-MARKS (2026-10-01, Mac: "Any profession node, like herbs, should
// appear on the compass. The node itself should also stand out with a
// detailed slight glow or something"): A PROFESSION'S NODES, IN ITS
// OWN COLOUR - every herb patch, vein, boulder, tree, school and body
// standing near the player on the compass (both skins: ui/hud.js
// drawNodeCompassMarks, ui/enhancedHud.js) and lit in the world by its
// glow (render/nodeGlow.js), one colour a profession in both, so a mark
// and the light it points at read as one thing. The nodes themselves
// are the gathering host's (scenes/gatherHost.js marks).
//
// The colours keep clear of the compass's other marks: the party's
// green, the quest's gold, the Detect markers' blood red and the ships'.
// Mining keeps the copper PROF2's Prospector's veins were drawn in. A
// leaf - it imports nothing, so the HUD and the glow take it without
// taking each other.
// ═══════════════════════════════════════════════════════════════════

/** A gathering profession's mark colour (CSS hex) - its compass mark and its node's glow. */
export const NODE_MARK_CSS = Object.freeze({
  herbalism: '#e586ec',   // a blossom's orchid
  mining: '#d9894a',      // PROF2's copper
  logging: '#f0dfa8',     // pale heartwood
  hunting: '#ff7360',     // a fresh hide's coral
  fishing: '#5ec8ff',     // the shallows' blue
});
/** A profession no colour is named for is drawn in Mining's (the first the compass marked). */
const FALLBACK = 'mining';

/** The mark's CSS colour for a profession. Pure. */
export const nodeMarkCss = (profession) => NODE_MARK_CSS[profession] ?? NODE_MARK_CSS[FALLBACK];
/** The mark's colour as display-encoded floats [r, g, b], one frozen triple a profession. Pure. */
const RGB = Object.freeze(Object.fromEntries(Object.entries(NODE_MARK_CSS).map(([k, hex]) => {
  const n = parseInt(hex.slice(1), 16);
  return [k, Object.freeze([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255])];
})));
export const nodeMarkRgb = (profession) => RGB[profession] ?? RGB[FALLBACK];

/** How dim a mark at the edge of its reach stands beside one at the player's feet: nearer reads brighter. */
export const NODE_MARK_FAR_DIM = 0.45;
/** A mark's opacity at `d` metres of its `reach` - 1 at the feet, 1 - NODE_MARK_FAR_DIM at the reach. Pure. */
export const nodeMarkAlpha = (d, reach) => 1 - NODE_MARK_FAR_DIM * Math.min(1, Math.max(0, reach > 0 ? d / reach : 0));

/**
 * @typedef {{ xz: number[], mark: string, a: number }} NodeCompassPoint `xz` the place's scene XZ (compassMarkerLerp's
 *   target), `mark` the profession whose colour it is drawn in, `a` its opacity
 */
/** The compass's points: one list, refilled (AUDIT WB D10's law) - the HUD reads it in the frame it is made. */
const _points = /** @type {NodeCompassPoint[]} */ ([]);
const _pool = /** @type {NodeCompassPoint[]} */ ([]);
/**
 * THE COMPASS'S NODE POINTS: the gathering host's marks (`{ profession, at, d, reach }`, nearest first) and a Tracker's
 * living animals (`[x, z]` scene XZ, PROF7 - in Hunting's colour), as NodeCompassPoints - the nearest LAST, so each
 * skin draws it over the rest. Null with nothing to mark.
 * @param {ReadonlyArray<{ profession: string, at: number[], d: number, reach: number }>|null|undefined} marks
 * @param {ReadonlyArray<number[]>|null|undefined} [animals]
 * @returns {NodeCompassPoint[]|null}
 */
export function nodeCompassPoints(marks, animals = null) {
  _points.length = 0;
  let used = 0;
  const put = (x, z, mark, a) => {
    const p = _pool[used] ??= { xz: [0, 0], mark: '', a: 1 };
    used++;
    p.xz[0] = x; p.xz[1] = z; p.mark = mark; p.a = a;
    _points.push(p);
  };
  for (const v of animals ?? []) put(v[0], v[1], 'hunting', 1);
  if (marks) for (let i = marks.length - 1; i >= 0; i--) { const m = marks[i]; put(m.at[0], m.at[2], m.profession, nodeMarkAlpha(m.d, m.reach)); }
  return _points.length ? _points : null;
}
