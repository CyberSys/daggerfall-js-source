// @ts-check
// ═══════════════════════════════════════════════════════════════════
// GUILD1d (2026-09-30, Mac: "Lets do this") — THE HERALDRY, DRAWN
// (bible/11-Multiplayer/Seats-Arc.md 8.1: "A device, one of 24 of the
// port's own drawn charges (SVG silhouettes committed as the port's
// own art)").
//
// Each device is a few SVG path parts in a 100 x 100 box: `fg` parts
// in the device's colour, `bg` parts in the field's (a hole - an eye,
// a door, a gap between bars), a `w` part stroked that wide rather than
// filled. The banner (Seats-Arc 3.4) is the port's own cloth, 1 wide by
// 3 tall: its field the first colour, a border in the second, the
// device centred in the second colour, the foot cut as a swallowtail.
// One drawing, two faces: an SVG string for the Guild tab, and a canvas
// for the world's cloth (render/bannerPass.js) - Path2D reads the same
// path text, so the tab and the street show one banner.
//
// Not a DFU member: Daggerfall Unity has no player guilds. Ledger A
// (ONLINE).
// ═══════════════════════════════════════════════════════════════════
import { HERALDRY_DEVICES, heraldryOf, heraldryColourOf } from '../net/heraldryLaw.js';

/** A circle as path text. */
const circle = (cx, cy, r) => `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
/** A star of `n` points about (cx, cy), its points at `R` and its hollows at `r`, the first point straight up. */
function star(cx, cy, R, r, n) {
  const pts = [];
  for (let i = 0; i < 2 * n; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const d = i % 2 ? r : R;
    pts.push(`${(cx + d * Math.cos(a)).toFixed(1)} ${(cy + d * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}
const fg = (d) => ({ d });
const bg = (d) => ({ d, bg: true });
const line = (d, w) => ({ d, w });

/** THE TWENTY-FOUR DEVICES - the record's order (heraldryLaw.js HERALDRY_DEVICES), each its parts. */
export const DEVICE_ART = Object.freeze({
  wolf: [fg('M84 80 L70 62 L74 30 L65 40 L60 16 L52 36 C40 36 30 42 22 50 L8 56 L10 63 L30 65 L40 72 L46 86 Z'), bg(circle(47, 47, 3.5))],
  bear: [fg(circle(27, 26, 10)), fg(circle(73, 26, 10)), fg('M50 26 C72 26 84 42 82 60 C80 78 66 88 50 88 C34 88 20 78 18 60 C16 42 28 26 50 26 Z'), bg(circle(38, 52, 4)), bg(circle(62, 52, 4)), bg('M42 68 C44 62 56 62 58 68 C56 74 44 74 42 68 Z')],
  boar: [fg('M12 60 C14 44 32 36 54 38 L66 30 L68 40 C78 42 86 50 90 58 L82 60 L86 65 L76 65 C74 70 70 72 66 72 L66 84 L58 84 L58 72 L36 72 L36 84 L28 84 L28 72 C18 70 12 66 12 60 Z'), bg(circle(70, 48, 3)), bg('M80 64 L90 56 L88 62 Z')],
  stag: [fg('M43 92 L41 62 L32 54 L37 49 L46 55 L54 55 L63 49 L68 54 L59 62 L57 92 Z'), fg('M42 50 L31 30 L20 26 L27 22 L33 27 L29 12 L37 25 L41 14 L42 30 L48 48 Z'), fg('M58 50 L69 30 L80 26 L73 22 L67 27 L71 12 L63 25 L59 14 L58 30 L52 48 Z')],
  lion: [fg(star(50, 52, 42, 32, 14)), bg(circle(40, 46, 4)), bg(circle(60, 46, 4)), bg('M42 64 L50 72 L58 64 C54 68 46 68 42 64 Z')],
  eagle: [fg('M50 14 L57 25 L55 38 L80 28 L92 33 L79 41 L90 46 L75 52 L60 53 L58 65 L67 82 L56 75 L50 87 L44 75 L33 82 L42 65 L40 53 L25 52 L10 46 L21 41 L8 33 L20 28 L45 38 L43 25 Z')],
  raven: [fg('M16 58 L32 50 C34 38 46 30 58 32 L72 25 L67 36 C75 40 81 50 79 60 L92 76 L72 71 C64 77 50 79 40 73 L26 82 L31 68 Z'), bg(circle(60, 40, 3))],
  dragon: [fg('M16 82 C28 72 35 62 33 50 L20 41 L35 38 L39 24 L48 35 L60 16 L63 38 L80 28 L71 49 C78 58 82 69 77 79 C71 88 57 88 50 81 C59 81 66 75 64 66 C57 73 49 75 41 73 C34 79 26 84 16 82 Z'), bg(circle(37, 44, 2.5))],
  serpent: [line('M30 22 C64 8 82 36 50 50 C18 64 38 92 74 78', 11), fg(circle(28, 22, 9)), bg(circle(25, 20, 2.5))],
  fish: [fg('M10 50 C24 28 56 26 72 43 L90 28 L86 50 L90 72 L72 57 C56 74 24 72 10 50 Z'), bg(circle(26, 46, 3.5)), bg('M44 36 C50 44 50 56 44 64 L46 64 C53 56 53 44 46 36 Z')],
  tower: [fg('M28 92 L28 34 L24 34 L24 14 L33 14 L33 21 L42 21 L42 14 L58 14 L58 21 L67 21 L67 14 L76 14 L76 34 L72 34 L72 92 Z'), bg('M42 92 L42 74 C42 64 58 64 58 74 L58 92 Z'), bg('M46 40 h8 v12 h-8 Z')],
  gate: [fg('M12 90 L12 22 L88 22 L88 90 Z'), bg('M26 90 L26 54 C26 32 74 32 74 54 L74 90 Z'), fg('M36 44 h5 v46 h-5 Z'), fg('M47.5 38 h5 v52 h-5 Z'), fg('M59 44 h5 v46 h-5 Z'), fg('M26 60 h48 v5 h-48 Z'), fg('M26 76 h48 v5 h-48 Z')],
  crown: [fg('M16 74 L12 30 L32 50 L50 20 L68 50 L88 30 L84 74 Z'), fg('M16 78 h68 v10 h-68 Z'), bg(circle(50, 60, 5))],
  sword: [fg('M50 4 L56 14 L55 62 L45 62 L44 14 Z'), fg('M30 62 h40 v7 h-40 Z'), fg('M46 69 h8 v17 h-8 Z'), fg(circle(50, 90, 6))],
  axe: [fg('M46 10 h8 v82 h-8 Z'), fg('M54 18 C72 12 86 24 88 44 C78 41 66 44 54 48 Z'), fg('M46 22 L32 26 L32 42 L46 44 Z')],
  hammer: [fg('M22 14 h56 v24 h-56 Z'), fg('M45 38 h10 v54 h-10 Z')],
  bow: [line('M34 8 C76 28 76 72 34 92', 8), line('M34 8 L34 92', 2), line('M16 50 L80 50', 4), fg('M92 50 L78 42 L78 58 Z')],
  shield: [fg('M18 12 L82 12 L82 44 C82 70 66 84 50 94 C34 84 18 70 18 44 Z'), bg('M18 38 L50 60 L82 38 L82 48 L50 70 L18 48 Z')],
  sun: [fg(star(50, 50, 44, 26, 12)), bg(circle(50, 50, 20)), fg(circle(50, 50, 15))],
  moon: [fg('M72 10 A40 40 0 0 0 72 90 A46 46 0 0 1 72 10 Z')],
  star: [fg(star(50, 52, 44, 18, 5))],
  eye: [fg('M6 50 C28 18 72 18 94 50 C72 82 28 82 6 50 Z'), bg(circle(50, 50, 17)), fg(circle(50, 50, 9))],
  rose: [...[0, 1, 2, 3, 4].map((i) => fg(circle(+(50 + 17 * Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / 5)).toFixed(1), +(50 + 17 * Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / 5)).toFixed(1), 15))), bg(circle(50, 50, 9)), fg(circle(50, 50, 5))],
  tree: [fg('M44 58 h12 v34 h-12 Z'), fg(circle(50, 30, 22)), fg(circle(32, 48, 17)), fg(circle(68, 48, 17)), fg(circle(50, 52, 16))],
});

/** The banner's cloth in a 100 x 300 box: the field, and its foot cut as a swallowtail. */
export const BANNER_CLOTH = 'M0 0 H100 V300 L50 262 L0 300 Z';
/** The border, drawn inside the cloth's edge (the same outline, stroked this wide, clipped to the cloth). */
export const BANNER_BORDER_W = 16;
/** Where the device stands on the cloth: its 100 box scaled to this and set at this corner. */
export const BANNER_DEVICE = Object.freeze({ x: 14, y: 84, scale: 0.72 });

/** A device's parts as SVG, in `fgHex` and `bgHex`. */
function deviceSvg(device, fgHex, bgHex) {
  return (DEVICE_ART[device] ?? []).map((p) => (p.w
    ? `<path d="${p.d}" fill="none" stroke="${p.bg ? bgHex : fgHex}" stroke-width="${p.w}" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${p.d}" fill="${p.bg ? bgHex : fgHex}"/>`)).join('');
}

/**
 * SEAT1a (Seats-Arc 3.4: "An unheld seat's anchors carry the kingdom's plain banner (the crown's metal, no device)"): a
 * PLAIN banner - two colours of the palette and no device (net/townSeatLaw.js seatPlainBanner) - or null. A guild's
 * heraldry always carries a device (heraldryOf); only a seat's plain cloth has none.
 */
export function plainBannerOf(raw) {
  if (!raw || typeof raw !== 'object' || raw.device !== null) return null;
  return heraldryColourOf(raw.field) && heraldryColourOf(raw.border) ? { field: raw.field, border: raw.border, device: null } : null;
}
/** What a banner draws: a guild's heraldry, a seat's plain cloth, or null (the unheld's Ash). */
const drawnOf = (raw) => heraldryOf(raw) ?? plainBannerOf(raw);

/**
 * THE BANNER AS SVG - for the Guild tab: `heraldry` (heraldryLaw.js's shape; none draws the unheld's plain Ash cloth)
 * at `width` pixels wide, three times as tall. A string: the tab sets it as its picture's markup.
 */
export function bannerSvg(heraldry, { width = 60 } = {}) {
  const h = drawnOf(heraldry);
  const field = heraldryColourOf(h?.field ?? 'ash')?.hex ?? '#8a8a8a';
  const border = heraldryColourOf(h?.border ?? 'ash')?.hex ?? '#8a8a8a';
  const d = BANNER_DEVICE;
  const clip = `hb${h ? `${h.field}${h.border}${h.device}` : 'none'}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 300" width="${width}" height="${width * 3}" role="img" aria-label="banner">`
    + `<defs><clipPath id="${clip}"><path d="${BANNER_CLOTH}"/></clipPath></defs>`
    + `<path d="${BANNER_CLOTH}" fill="${field}"/>`
    + (h ? `<path d="${BANNER_CLOTH}" fill="none" stroke="${border}" stroke-width="${BANNER_BORDER_W * 2}" clip-path="url(#${clip})"/>`
      + `<g transform="translate(${d.x} ${d.y}) scale(${d.scale})">${deviceSvg(h.device, border, field)}</g>` : '')
    + '</svg>';
}

/**
 * THE BANNER ON A CANVAS - for the world's cloth (render/bannerPass.js): the same drawing into a 2D context `ctx` of
 * `w` by `3w` pixels, the swallowtail's cut left clear. Path2D reads the path text the SVG does.
 * @param {CanvasRenderingContext2D} ctx @param {any} heraldry @param {number} w
 */
export function drawBanner(ctx, heraldry, w) {
  const h = drawnOf(heraldry);
  const field = heraldryColourOf(h?.field ?? 'ash')?.hex ?? '#8a8a8a';
  const border = heraldryColourOf(h?.border ?? 'ash')?.hex ?? '#8a8a8a';
  const P = globalThis.Path2D;
  ctx.save();
  ctx.clearRect(0, 0, w, w * 3);
  ctx.scale(w / 100, w / 100);
  const cloth = new P(BANNER_CLOTH);
  ctx.fillStyle = field;
  ctx.fill(cloth);
  if (h) {
    ctx.save();
    ctx.clip(cloth);
    ctx.strokeStyle = border;
    ctx.lineWidth = BANNER_BORDER_W * 2;
    ctx.stroke(cloth);
    ctx.restore();
    const d = BANNER_DEVICE;
    ctx.translate(d.x, d.y);
    ctx.scale(d.scale, d.scale);
    for (const p of DEVICE_ART[h.device] ?? []) {
      const path = new P(p.d);
      if (p.w) { ctx.strokeStyle = p.bg ? field : border; ctx.lineWidth = p.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(path); } else { ctx.fillStyle = p.bg ? field : border; ctx.fill(path); }
    }
  }
  ctx.restore();
}

/** Every device has its art (a pin holds it). */
export const DEVICES_DRAWN = HERALDRY_DEVICES.every((d) => Array.isArray(DEVICE_ART[d]) && DEVICE_ART[d].length > 0);
