// @ts-check
// ═══════════════════════════════════════════════════════════════════
// DECOR-OUTDOOR (FIELD BUGS 2026-10-05) — A YARD'S TREES AND PLANTS,
// DRAWN AS ITS TOWN'S OWN NATURE IS DRAWN.
//
// The owner: "There seems to be a lot of missing decor items with house
// decoration"; asked which, the outdoor pieces for a yard among them. A
// yard's nature piece is its climate's own (systems/decorCatalogue.js
// DECOR_NATURE_BASES): the piece stores its set's SUMMER archive - the
// one a climate names - and its record, and it is drawn as the pixel it
// stands in draws the town's own nature (scenes/world.js buildPixelNow's
// flat groups):
//
//   - the SEASON's archive (world/climateSwaps.js getNatureArchive - the
//     four woodland sets' winter twins), read off the yard's pixel;
//   - Seasons of the Iliac Bay's picture of that record, where the mod
//     re-skins the archive now (systems/seasonsIliacBay.js lookup) -
//     uploaded under the install's own key, without mips, as the pixel
//     uploads it (AUDIT 61: the mod's atlas has one NEAREST level);
//   - else the classic record;
//
// at the piece's own scale, mirrored when it is turned half round as any
// placed picture is (net/decorLaw.js decorFlatMirrored), leaning with the
// wind as the town's flora leans (WIND3, systems/windDrive.js
// floraSwayOf). The yard stands its pieces again when its pixel is built
// again - a season's turn, an install - as the town's own flats are.
//
// Pure of the world host: everything it reads is handed in.
// ═══════════════════════════════════════════════════════════════════

import { getNatureArchive } from '../world/climateSwaps.js';
import { isNatureArchive, billboardSize } from '../world/rmbFlats.js';
import { floraSwayOf } from '../systems/windDrive.js';
import { decorFlatMirrored } from '../net/decorLaw.js';

/** Whether a placed piece is the climate's nature - a flat of a nature set's archive (any piece of the catalogue's
 *  "Trees and plants" stores its set's summer archive). */
export const isNaturePiece = (piece) => piece?.model == null && Array.isArray(piece?.flat) && isNatureArchive(piece.flat[0]) && !piece.item;

/** The flat a nature piece draws in `season` (world/climateSwaps.js SEASON): its set's archive for the season, its own
 *  record - [archive, record]. */
export const yardNatureFlat = (flat, season) => [getNatureArchive(flat[0], season), flat[1]];

/**
 * A YARD'S NATURE, STOOD. `deps`:
 *   renderer      - createBillboardBatch, uploadTexture
 *   getTexture(a), uploadRecord(a, r) - the pipeline's
 *   seasonal()    - Seasons of the Iliac Bay's helper while it stands (`lookup(archive, record)`, `installedSeason`), else
 *                   null
 */
export function createYardNature({ renderer, getTexture, uploadRecord, seasonal = () => null }) {
  /**
   * STAND ONE NATURE PIECE at `at` (the yard's origin, this visit's), in its pixel's `season` beside its `natureArchive`
   * (the season's own - what the pixel's flora is drawn from) - answering `{ batch, size }` (`size` its picture's, at the
   * piece's scale, for the eye's box), or null: not a nature piece, a record the archive lacks, or `live()` false once
   * the picture is in hand (the piece moved or went - nothing is made).
   * @param {any} piece @param {number[]} at @param {{ season: number, natureArchive?: number|null, live?: () => boolean }} where
   */
  async function stand(piece, at, { season, natureArchive = null, live = () => true }) {
    if (!isNaturePiece(piece) || !renderer?.createBillboardBatch) return null;
    const [archive, record] = yardNatureFlat(piece.flat, season);
    const t = await getTexture?.(archive);
    if (!t || !(record < t.recordCount) || !live()) return null;
    const s = seasonal?.() ?? null;
    const sib = s?.lookup?.(archive, record) ?? null;
    let key = record;
    let plain;
    if (sib) {
      key = `${record}#season${s.installedSeason}`;
      renderer.uploadTexture?.(archive, key, sib.texture.image, { mips: false, variant: '' });
      plain = sib.size;
    } else {
      uploadRecord?.(archive, record);
      plain = billboardSize(t, record);
    }
    const size = { w: plain.w * piece.scale, h: plain.h * piece.scale };
    const drawn = decorFlatMirrored(piece) ? { w: -size.w, h: size.h } : size;
    const batch = renderer.createBillboardBatch(archive, key, drawn, [[at[0] + piece.pos[0], at[1] + piece.pos[1], at[2] + piece.pos[2]]]);
    batch.sway = floraSwayOf(archive, natureArchive ?? archive, size.h);
    return { batch, size };
  }
  return { stand };
}
