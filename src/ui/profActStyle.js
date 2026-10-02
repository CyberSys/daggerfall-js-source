// @ts-check
// PROF-SCENES (2026-10-01): THE ACTS IN THE WORLD, DRESSED - the act's panel under the crosshair, in the loot plaque's
// own frame (ui/enhancedStyle.js .wplaque: the ink ground, the 2px stone border, the pixel face, the bone title and the
// stone sub-line, the rules between), and each act's scene (ui/profScenes.js) in the kit's own tones (enhancedFrame.js
// FRAME_TONES, enhancedStyle.js's tokens). Appended to PROF_CSS (ui/enhancedPlusStyle.js), after the rules it supersedes;
// the profession HUD lays this sheet itself, so the classic skins wear it too. Still forms under reduced motion.
import { PIXEL_STACK } from './pixelifyFive.js';
import { FRAME_TONES as T } from './enhancedFrame.js';

const S = 'var(--hud-scale, 1)';

export const PROF_ACT_CSS = `/* ── PROF-SCENES: the acts in the world ── */
.prof-meter { position: fixed; left: var(--wp-x, 50%); top: var(--wp-top, 55%); transform: translateX(-50%); z-index: 12;
  width: calc(236px * ${S} * var(--prof-meter-scale, 1)); max-width: 92vw; box-sizing: border-box; pointer-events: none;
  padding: calc(9px * ${S}) calc(13px * ${S}) calc(8px * ${S}); background: rgba(10,12,17,0.9); border: 2px solid #7d7460;
  box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px rgba(0,0,0,0.55);
  font-family: ${PIXEL_STACK}; -webkit-font-smoothing: none; font-variant-ligatures: none; font-feature-settings: 'liga' 0, 'clig' 0;
  font-size: calc(11px * ${S}); color: #d8cfae; text-align: center; text-shadow: 2px 2px 0 rgba(0,0,0,0.85); }
.prof-meter[hidden] { display: none; }
@media (pointer: coarse) { .prof-meter { --prof-meter-scale: 1.2; } }
.prof-acttitle { font-size: calc(15px * ${S}); line-height: 1.35; color: #d8cfae; }
.prof-actsub { font-size: calc(11px * ${S}); line-height: 1.35; color: #7d7460; letter-spacing: 0.04em; }
.prof-scene { margin-top: calc(7px * ${S}); padding-top: calc(7px * ${S}); border-top: 2px solid rgba(125,116,96,0.3); }
.prof-status { display: flex; flex-direction: column; align-items: stretch; gap: calc(4px * ${S}); margin-top: calc(6px * ${S}); }
.prof-status:empty { display: none; }
.prof-meter .prof-hint { margin-top: calc(6px * ${S}); padding-top: calc(5px * ${S}); border-top: 1px solid rgba(125,116,96,0.35);
  color: #a49a80; font-size: calc(11px * ${S}); line-height: 1.35; }
.prof-meter.fish-tug .prof-hint { color: ${T.brassHi}; }
.prof-meter.bruised .prof-hint { color: #e0875a; }

/* the face every scene stands on: an inset plate in the plaque */
.prof-meter .prof-face, .prof-meter .prof-leaves { position: relative; width: 100%; height: auto; margin: 0; overflow: hidden;
  background: ${T.stoneDark}; box-shadow: inset 0 0 0 1px ${T.outline}, inset 0 0 0 2px rgba(163,152,128,0.18); }
.prof-meter .prof-art { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: visible; }

/* the count: pips, a bar */
.prof-pips { display: flex; justify-content: center; gap: calc(4px * ${S}); }
.prof-pip { width: calc(9px * ${S}); height: calc(9px * ${S}); transform: rotate(45deg); background: ${T.stoneDark};
  box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px ${T.stoneLo}; }
.prof-pip.on { background: ${T.brass}; box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px ${T.brassHi}; }
.prof-meter .prof-bar { position: relative; height: calc(8px * ${S}); background: rgba(5,6,8,0.85); box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px ${T.stoneDim}; }
.prof-meter .prof-bar > div, .prof-meter .prof-bar > i { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(180deg, ${T.brassHi} 0 1px, ${T.brass} 1px, ${T.brassLo}); }
.prof-meter.bruised .prof-bar > div { background: linear-gradient(180deg, #f5bdb4 0 1px, #b5553f 1px, #7a2e22); }

/* the markers on a face */
.prof-meter .prof-point { position: absolute; width: 5%; aspect-ratio: 1; margin: -2.5% 0 0 -2.5%; border-radius: 50%;
  background: rgba(233,228,217,0.38); box-shadow: 0 0 0 1px rgba(5,6,8,0.7); }
.prof-meter .prof-point.first { width: 7%; margin: -3.5% 0 0 -3.5%; background: ${T.brassHi}; box-shadow: 0 0 0 1px ${T.outline}; }
.prof-meter .prof-glint { position: absolute; width: 16%; aspect-ratio: 1; margin: -8% 0 0 -8%; border-radius: 50%; pointer-events: none;
  background: radial-gradient(circle, #fff6d8 0 14%, rgba(243,207,134,0.85) 28%, rgba(243,207,134,0.25) 52%, transparent 70%);
  animation: prof-glint 0.5s ease-in-out infinite alternate; }
.prof-meter .prof-glint::before, .prof-meter .prof-glint::after { content: ''; position: absolute; left: 50%; top: 50%; width: 90%; height: 8%;
  transform: translate(-50%, -50%); background: linear-gradient(90deg, transparent, #fff6d8 45% 55%, transparent); }
.prof-meter .prof-glint::after { transform: translate(-50%, -50%) rotate(90deg); }
.prof-meter .prof-glint.still { animation: none; }
.prof-meter .prof-aim { position: absolute; width: 11%; aspect-ratio: 1; margin: -5.5% 0 0 -5.5%; box-sizing: border-box; border: 0;
  background: linear-gradient(${T.brassHi}, ${T.brassHi}) center / 100% 1px no-repeat, linear-gradient(${T.brassHi}, ${T.brassHi}) center / 1px 100% no-repeat;
  filter: drop-shadow(0 0 1px ${T.outline}) drop-shadow(0 0 1px ${T.outline}); box-shadow: none; }
.prof-meter .prof-aim::after { content: ''; position: absolute; inset: 28%; border: 1px solid ${T.brassHi}; border-radius: 50%; }

/* bursts: a blow's sparks, a chop's chips, a find's sparkle, a slip's nick - restarted by alternating names */
.prof-burst { position: absolute; width: 30%; aspect-ratio: 1; margin: -15% 0 0 -15%; pointer-events: none; opacity: 0; }
.prof-burst.on.a { animation: prof-burst-a 0.42s ease-out forwards; }
.prof-burst.on.b { animation: prof-burst-b 0.42s ease-out forwards; }
.prof-sparks { background: radial-gradient(circle, transparent 18%, rgba(233,228,217,0.9) 19% 21%, transparent 22%),
  conic-gradient(from 10deg, transparent 0 8%, ${T.stoneHi} 8% 10%, transparent 10% 33%, ${T.stoneHi} 33% 35%, transparent 35% 58%, ${T.stoneHi} 58% 60%, transparent 60% 83%, ${T.stoneHi} 83% 85%, transparent 85%);
  -webkit-mask: radial-gradient(circle, #000 0 62%, transparent 63%); mask: radial-gradient(circle, #000 0 62%, transparent 63%); }
.prof-sparks.gold { background: radial-gradient(circle, #fff6d8 0 10%, transparent 11%),
  conic-gradient(from 0deg, transparent 0 4%, ${T.brassHi} 4% 7%, transparent 7% 21%, ${T.brassHi} 21% 24%, transparent 24% 38%, ${T.brassHi} 38% 41%, transparent 41% 55%, ${T.brassHi} 55% 58%, transparent 58% 72%, ${T.brassHi} 72% 75%, transparent 75% 89%, ${T.brassHi} 89% 92%, transparent 92%); }
.prof-chips { background: radial-gradient(circle at 30% 40%, #b98a5a 0 5%, transparent 6%), radial-gradient(circle at 68% 30%, #8a6a44 0 6%, transparent 7%),
  radial-gradient(circle at 60% 72%, #b98a5a 0 4%, transparent 5%), radial-gradient(circle at 24% 70%, #6f5233 0 5%, transparent 6%); }
.prof-chips.gold { background: radial-gradient(circle, rgba(243,207,134,0.55) 0 22%, transparent 40%), radial-gradient(circle at 30% 40%, ${T.brassHi} 0 5%, transparent 6%),
  radial-gradient(circle at 68% 30%, #b98a5a 0 6%, transparent 7%), radial-gradient(circle at 60% 72%, ${T.brassHi} 0 4%, transparent 5%); }
.prof-sparkle { background: radial-gradient(circle, #fff6d8 0 8%, rgba(243,207,134,0.6) 9% 20%, transparent 40%); }
.prof-nick { background: radial-gradient(circle, rgba(191,42,31,0.85) 0 12%, transparent 30%); }
@keyframes prof-burst-a { from { opacity: 1; transform: scale(0.4) rotate(0deg); } to { opacity: 0; transform: scale(1.25) rotate(25deg); } }
@keyframes prof-burst-b { from { opacity: 1; transform: scale(0.4) rotate(0deg); } to { opacity: 0; transform: scale(1.25) rotate(-25deg); } }
.prof-meter.struck-glint .prof-face { box-shadow: inset 0 0 0 1px ${T.outline}, inset 0 0 0 2px ${T.brassHi}, 0 0 8px rgba(243,207,134,0.55); }
.prof-meter.clean-cut .prof-face { box-shadow: inset 0 0 0 1px ${T.outline}, inset 0 0 0 2px ${T.brassHi}, 0 0 8px rgba(243,207,134,0.55); }

/* the rock's face */
.rock-base { fill: ${T.stoneLo}; }
.rock-lit { fill: ${T.stoneLit}; }
.rock-mid { fill: ${T.stoneMid}; }
.rock-lo { fill: ${T.stoneDim}; }
.rock-seam { fill: none; stroke: ${T.stoneDark}; stroke-width: 0.9; stroke-linejoin: round; opacity: 0.8; }
.rock-ore { fill: ${T.brass}; stroke: ${T.brassDark}; stroke-width: 0.5; }
.rock-crack { fill: none; stroke: ${T.outline}; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; opacity: 0; transition: opacity 0.2s; }
.rock-crack.on { opacity: 0.9; }

/* the trunk, its notch and the ring */
.wood-shade { fill: #141813; }
.wood-bark { fill: #4a3524; stroke: ${T.outline}; stroke-width: 0.8; }
.wood-groove { fill: none; stroke: #2a1d12; stroke-width: 1.1; stroke-linejoin: round; }
.wood-notch { fill: #c79a62; stroke: #2a1d12; stroke-width: 0.7; }
.wood-notch-shade { fill: #5a4026; }
.wood-trunk.creaked { animation: prof-creak 0.9s ease-in-out infinite alternate; transform-origin: 50px 60px; }
@keyframes prof-creak { from { transform: rotate(-0.6deg); } to { transform: rotate(0.6deg); } }
.ring-band { fill: none; stroke: rgba(243,207,134,0.42); }
.ring-band-edge { fill: none; stroke: rgba(243,207,134,0.85); stroke-width: 0.5; }
.ring-notch { fill: none; stroke: rgba(5,6,8,0.85); stroke-width: 1.2; stroke-dasharray: 2 1.5; }
.ring-line { fill: none; stroke: ${T.stoneHi}; stroke-width: 1.4; filter: drop-shadow(0 0 0.6px ${T.outline}); }
.ring-line.in-band { stroke: ${T.brassHi}; stroke-width: 1.8; filter: drop-shadow(0 0 2px rgba(243,207,134,0.9)); }
.prof-meter .prof-ringbar { position: relative; height: calc(12px * ${S}); background: rgba(5,6,8,0.85); box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px ${T.stoneDim}; }
.prof-meter .prof-ringband { position: absolute; top: 0; bottom: 0; background: rgba(243,207,134,0.45); box-shadow: inset 0 0 0 1px ${T.brassHi}; }
.prof-meter .prof-ringmark { position: absolute; top: -3px; bottom: -3px; width: 3px; margin-left: -1px; background: ${T.stoneHi}; box-shadow: 0 0 0 1px ${T.outline}; }

/* the plant and the hold */
.herb-ground { fill: #1c2416; }
.herb-mound { fill: #2c3a1f; }
.herb-stem { fill: none; stroke: #3f6a33; stroke-width: 1.6; stroke-linecap: round; }
.herb-leaf { fill: #4e7f45; stroke: #22381b; stroke-width: 0.5; transition: fill 0.3s; }
.herb-bloom { fill: #b8473c; stroke: #5a1d18; stroke-width: 0.4; transition: fill 0.3s; }
.herb-heart { fill: ${T.brassHi}; }
.herb-plant.bruised .herb-leaf { fill: #7a6a3a; }
.herb-plant.bruised .herb-bloom { fill: #7a4a3a; }
.hold-track { fill: none; stroke: rgba(5,6,8,0.6); stroke-width: 2.4; }
.hold-fill { fill: none; stroke: ${T.brassHi}; stroke-width: 2.4; stroke-linecap: round; filter: drop-shadow(0 0 1px ${T.outline}); }
.prof-meter.bruised .hold-fill { stroke: #e0875a; }

/* the leaf litter and the basket */
.litter-ground { fill: #232a19; }
.litter-leaf { stroke: rgba(5,6,8,0.55); stroke-width: 0.5; }
.litter-leaf.t0 { fill: #3d5a2c; } .litter-leaf.t1 { fill: #6b5a2a; } .litter-leaf.t2 { fill: #4e6a34; }
.litter-twig { fill: none; stroke: #4a3524; stroke-width: 1.1; stroke-linecap: round; }
.prof-meter .prof-litterface .prof-glint { width: 20%; margin: -10% 0 0 -10%; }
.prof-glintclock { position: absolute; inset: -18%; width: 136%; height: 136%; overflow: visible; }
.clock-left { fill: none; stroke: ${T.brassHi}; stroke-width: 1.4; stroke-linecap: round; opacity: 0.85; }
.prof-basket { display: flex; justify-content: center; gap: calc(6px * ${S}); }
.prof-slot { width: calc(16px * ${S}); height: calc(14px * ${S}); position: relative; background: #3a2b18;
  box-shadow: 0 0 0 1px ${T.outline}, inset 0 -3px 0 #24190d, inset 0 0 0 1px #6f5233;
  clip-path: polygon(0 20%, 100% 20%, 88% 100%, 12% 100%); }
.prof-slot.next { box-shadow: 0 0 0 1px ${T.outline}, inset 0 -3px 0 #24190d, inset 0 0 0 1px ${T.brassHi}; }
.prof-slot.found::after { content: ''; position: absolute; left: 22%; right: 22%; top: 2%; height: 56%; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #e0655a 0 18%, #a8342b 40%, #5a1d18 75%); }
.prof-slot.missed::after { content: ''; position: absolute; left: 30%; right: 30%; top: 34%; height: 2px; background: #7d7460; transform: rotate(-20deg); }

/* the pelt and the line */
.prof-meter .prof-traceface { background: #2a2418; }
.prof-line polyline { fill: none; vector-effect: non-scaling-stroke; }
.prof-line .trace-guide { stroke: rgba(239,224,184,0.5); stroke-width: 1px; stroke-dasharray: 3 3; }
.prof-line .trace-drawn { stroke: ${T.brassHi}; stroke-width: 2px; stroke-linecap: round; stroke-linejoin: round; filter: drop-shadow(0 0 1px ${T.outline}); }
.prof-meter .prof-traceface .prof-glint { width: 9%; margin: -4.5% 0 0 -4.5%; }
.prof-meter .prof-knife { width: 8%; margin: -4% 0 0 -4%; }
.prof-slips { color: #e0875a; font-size: calc(11px * ${S}); }
.prof-slips:empty { display: none; }
.pelt { fill: #6b4a2e; stroke: #3a2716; stroke-width: 1; vector-effect: non-scaling-stroke; fill-rule: nonzero; }
.pelt-fur { fill: none; stroke: rgba(40,26,14,0.55); stroke-width: 1px; vector-effect: non-scaling-stroke; }

/* the water: the sky's band, the deep, the waves, the net, the floats, the tug's rings, the school */
.water-sky { fill: #1d2632; }
.water-deep { fill: #17303a; }
.water-far { fill: #1a2a24; }
.water-bank { fill: #3a3424; stroke: ${T.outline}; stroke-width: 0.4; }
.water-bank-grass { fill: none; stroke: #4e6a34; stroke-width: 1.2; stroke-linecap: round; }
.water-wave { fill: none; stroke: rgba(170,220,240,0.32); stroke-width: 0.7; }
.water-waves { animation: prof-waves 3.2s linear infinite; }
@keyframes prof-waves { from { transform: translateX(0); } to { transform: translateX(20px); } }
.water-arc { fill: none; stroke: rgba(239,224,184,0.45); stroke-width: 0.6; stroke-dasharray: 1.6 1.6; }
.water-net { opacity: 0; }
.water-net.on { opacity: 1; }
.net-mesh { fill: rgba(239,224,184,0.12); stroke: #c2b79a; stroke-width: 0.6; }
.net-lines { fill: none; stroke: #c2b79a; stroke-width: 0.4; }
.water-floats { opacity: 0; transition: opacity 0.2s; }
.water-floats.on { opacity: 1; }
.water-floats.on .float { animation: prof-bob 1.6s ease-in-out infinite alternate; }
.water-floats.on .float:nth-of-type(2) { animation-delay: -0.5s; }
.water-floats.on .float:nth-of-type(3) { animation-delay: -1s; }
.water-floats.dip .float { animation: prof-dip 0.3s ease-in-out infinite alternate; }
@keyframes prof-bob { from { translate: 0 -0.6px; } to { translate: 0 0.6px; } }
@keyframes prof-dip { from { translate: 0 0; } to { translate: 0 2.4px; } }
.float-line { fill: none; stroke: #c2b79a; stroke-width: 0.5; }
.float-body { fill: #b8473c; stroke: ${T.outline}; stroke-width: 0.4; }
.float-tip { fill: ${T.stoneHi}; }
.water-rings { opacity: 0; }
.water-rings.on { opacity: 1; }
.water-rings.on .splash-ring { animation: prof-ring 0.6s ease-out infinite; transform-box: fill-box; transform-origin: center; }
.water-rings.on .splash-ring:nth-of-type(2) { animation-delay: 0.2s; }
.water-rings.on .splash-ring:nth-of-type(3) { animation-delay: 0.4s; }
.splash-ring { fill: none; stroke: rgba(220,240,250,0.85); stroke-width: 0.6; }
@keyframes prof-ring { from { opacity: 1; transform: scale(0.4); } to { opacity: 0; transform: scale(1.3); } }
.water-school { opacity: 0; transition: opacity 0.4s; }
.water-school.on { opacity: 1; }
.water-fish { fill: rgba(200,225,235,0.55); }
.prof-meter.fish-tug .prof-waterface { box-shadow: inset 0 0 0 1px ${T.outline}, inset 0 0 0 2px ${T.brassHi}, 0 0 8px rgba(243,207,134,0.55); }
.prof-meter .prof-throwbar { position: relative; height: calc(10px * ${S}); background: linear-gradient(90deg, #17303a, #2b5566); box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px ${T.stoneDim}; }
.prof-meter .prof-throwtick { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(233,228,217,0.35); }
.prof-meter .prof-throwmark { position: absolute; top: -3px; bottom: -3px; width: 4px; margin-left: -2px; background: ${T.brassHi}; box-shadow: 0 0 0 1px ${T.outline}; }
.prof-meter .prof-haulbar { position: relative; height: calc(12px * ${S}); margin: 0; background: rgba(5,6,8,0.85); box-shadow: 0 0 0 1px ${T.outline}, inset 0 0 0 1px ${T.stoneDim}; }
.prof-meter .prof-haulband { position: absolute; top: 0; bottom: 0; background: rgba(120,190,220,0.4); box-shadow: inset 0 0 0 1px rgba(170,220,240,0.75); }
.prof-meter .prof-haulweight { position: absolute; top: -3px; bottom: -3px; width: 4px; margin-left: -2px; background: ${T.stoneHi}; box-shadow: 0 0 0 1px ${T.outline}; }

/* the prompt where no plaque stands (a phone, the classic skins): the plaque's ground and border */
.prof-prompt { background: rgba(10,12,17,0.9); border: 2px solid #7d7460; box-shadow: 0 0 0 1px ${T.outline}; color: #d8cfae; }
.prof-prompt kbd { color: ${T.brassHi}; }

@media (prefers-reduced-motion: reduce) {
  .prof-meter .prof-glint, .wood-trunk.creaked, .water-waves, .water-floats.on .float, .water-floats.dip .float, .water-rings.on .splash-ring { animation: none; }
  .prof-burst.on.a, .prof-burst.on.b { animation: none; opacity: 0.85; }
  .rock-crack, .herb-leaf, .herb-bloom, .water-floats, .water-school { transition: none; }
  .water-floats.dip .float { translate: 0 2px; }
}`;
