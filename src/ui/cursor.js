// The classic mouse pointer (U arc). CURSOR.IMG decoded through the
// same ImgFile + ART_PAL.COL path every native window uses, upscaled
// nearest-neighbour and installed as the DOCUMENT cursor - one rule on
// <html> covers every surface (the game canvas, the folder picker, the
// error overlay), so all UI shows Daggerfall's arrow instead of the OS
// default. Hotspot is the arrow tip at (0,0), as DFU's SetCursor uses.
// NEVER TRAPS: a missing CURSOR.IMG leaves the OS cursor in charge.

import { ImgFile } from '../formats/imgFile.js';
import { DFPalette } from '../formats/dfPalette.js';
import { bitmapToColor32 } from '../formats/color32Order.js';   // BOOT2: from the formats leaf - through hud.js this one line put the whole HUD and the world tick on the boot path

const SCALE = 2;   // the 32x16 source reads too small at modern DPI
// CURSOR-EDGE: and no further than 32 DIP a side - Chromium shows a larger custom cursor only while the whole image lies
// inside the viewport, and the OS arrow anywhere else (64 px wide was the arrow within 64 px of the right edge). The
// image is cropped to what it draws first; the hotspot is (0,0), so the crop keeps it.
export const MAX_CURSOR_DIP = 32;
/** CURSOR-EDGE (AUDIT part five UI1): a native scrollbar shows the OS arrow whatever <html> wears, and a classic page
 *  never lays ENHANCED_CSS (the chat, the social panel, the profile and the decorator mount on either skin) - so the
 *  document cursor brings the enhanced sheet's dress itself; a pointer device only (UI2: a touch screen keeps its
 *  overlay scrollbar, and has no cursor to keep). */
export const CURSOR_SCROLLBAR_CSS = `@media (any-pointer: fine) {
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: rgba(0,0,0,0.3); }
::-webkit-scrollbar-thumb { background: rgba(125,116,96,0.5); border: 2px solid rgba(0,0,0,0.3); border-radius: 0; } }`;
export const cursorScale = (w, h) => Math.max(1, Math.min(SCALE, Math.floor(MAX_CURSOR_DIP / Math.max(w, h))));
/** The drawn extent from the (0,0) corner: one past the right- and bottom-most pixel with any alpha (RGBA bytes). */
export function drawnExtent(rgba, w, h) {
  let dw = 0, dh = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rgba[(y * w + x) * 4 + 3]) { dw = Math.max(dw, x + 1); dh = y + 1; }
  return dw ? [dw, dh] : [w, h];
}

export async function installCursor(fetchBytes) {
  try {
    const palette = new DFPalette();
    palette.load(await fetchBytes('ART_PAL.COL'), 'ART_PAL.COL');
    const img = new ImgFile();
    if (!img.load(await fetchBytes('CURSOR.IMG'), 'CURSOR.IMG', palette)) return false;
    const bmp = img.getDFBitmap();
    const { width, height, colors } = bitmapToColor32(bmp, palette);
    if (!width || !height) return false;
    const src = document.createElement('canvas');
    src.width = width; src.height = height;
    const rgba = new Uint8ClampedArray(colors.buffer);
    src.getContext('2d').putImageData(new ImageData(rgba, width, height), 0, 0);
    const [w, h] = drawnExtent(rgba, width, height);
    const k = cursorScale(w, h);
    const out = document.createElement('canvas');
    out.width = w * k; out.height = h * k;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, w, h, 0, 0, out.width, out.height);
    document.documentElement.style.cursor = `url(${out.toDataURL()}) 0 0, auto`;
    if (!document.getElementById('df-cursor-scrollbars')) {
      const st = document.createElement('style');
      st.id = 'df-cursor-scrollbars'; st.textContent = CURSOR_SCROLLBAR_CSS;
      document.head.append(st);
    }
    return true;
  } catch (e) {
    console.warn('[cursor] CURSOR.IMG unavailable; the OS cursor stands in', e);
    return false;
  }
}
