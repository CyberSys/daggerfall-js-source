// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Life skills will utilize things like tree
// chopping, picking up ingredients, fishing, etc. Active player
// involvement and actual UI integration for life skills") - HERBALISM IN
// THE STREAMING WORLD (bible/06-Systems/Professions-Arc.md 5, 6, 8, 22;
// FORAGE0 14). PROF2 made the host every gathering profession's
// (scenes/gatherHost.js - one prompt, one act, one book); this is
// Herbalism's KIND in it:
//
//   THE PATCHES. Each built wilderness pixel stands its day's herb
//   patches (net/nodeLaw.js - the clock's, the same for every client),
//   each where DFU's own nature would stand on that tile (world/
//   terrainNature.js natureStandsAt: never in a town, on water or a
//   cliff), as a small cluster of the herb's own world picture (TEXTURE
//   .254, the plant's item flat - no new art). A patch is gone for the
//   day once both its harvests are (herbs and food, PROF0 5.3).
//   THE PLAN. What E does at a patch - the herbs first while untaken, the
//   Basket by the act choice key - or what it needs. TOOL-USE: the
//   Sickle's Use asks the herbs, the Basket's the food, the choice unmoved.
//   THE ACT. Foraging's checks first, with the Sickle's lines or the
//   Basket's (FORAGE0 14.3); the machine is systems/herbAct.js; the
//   Sickle's steady hand draws DFU's Tanto in the hand.
// ═══════════════════════════════════════════════════════════════════
import { herbPatches, nodeKey, HERB_TABLES } from '../net/nodeLaw.js';
import { tierOpen, TIER_RANKS, actBand, PROF_RANK_MAX, herbKey } from '../net/professionLaw.js';
import { natureStandsAt } from '../world/terrainNature.js';
import { createHerbAct } from '../systems/herbAct.js';
import { FT } from '../systems/foragingLaw.js';
import { foragingActRefusal, foragingToolIn } from '../systems/foragingInstall.js';
import { materialLabel } from '../systems/profItems.js';
import { templateByIndex } from '../systems/itemTemplates.js';
import { liveStat } from '../systems/statMods.js';
import { getPref } from '../systems/uiPrefs.js';
import { WORLD_MAP_TILE_DIM } from '../world/terrainTiles.js';

/** The item flats' archive - every plant's world picture is in it (its template's worldTextureRecord). */
export const HERB_FLAT_ARCHIVE = 254;
/** A patch is this many of its herb's flats, spread this far (m) about its point, at this times the item's own size. */
export const PATCH_FLATS = 5;
export const PATCH_SPREAD = 0.7;
export const PATCH_SCALE = 1.6;
/** NODE-MARKS: a patch's glow about its point - its flats' ring and their height (m). */
export const PATCH_MARK = Object.freeze({ w: 2.2, h: 1.3 });

/**
 * A PIXEL'S PATCHES AS THE CLIENT STANDS THEM: the law's patches of the day, each at the tile its (u, v) falls on,
 * where DFU's nature would stand there - `{ key, slot, herb, tier, offSeason, local }`, `local` pixel-local metres.
 * @param {{ px: number, py: number, day: number, climate: number, confirmed?: boolean, seasonalEye?: boolean,
 *   samples: Float32Array, tilemap: Uint8Array, locationRect?: any }} p
 */
export function standPatches({ px, py, day, climate, confirmed = false, seasonalEye = false, samples, tilemap, locationRect = null }) {
  const out = [];
  if (!HERB_TABLES[climate]) return out;
  for (const p of herbPatches({ x: px, y: py, day, climate, confirmed, seasonalEye })) {
    const tx = Math.min(WORLD_MAP_TILE_DIM - 1, Math.floor(p.u * WORLD_MAP_TILE_DIM));
    const ty = Math.min(WORLD_MAP_TILE_DIM - 1, Math.floor(p.v * WORLD_MAP_TILE_DIM));
    const base = natureStandsAt(samples, tilemap, locationRect, tx, ty);
    if (!base) continue;
    out.push({ key: nodeKey({ kind: 'herb', x: px, y: py, day, slot: p.slot }), slot: p.slot, herb: p.herb, tier: p.tier, offSeason: p.offSeason, local: [base.x, base.y, base.z] });
  }
  return out;
}
/** A patch's flats: PATCH_FLATS base positions, one at its point and the rest in a ring turned by its slot. */
export function patchFlats(patch) {
  const [x, y, z] = patch.local;
  const out = [[x, y, z]];
  for (let i = 1; i < PATCH_FLATS; i++) {
    const a = (patch.slot * 1.3) + (i * 2 * Math.PI) / (PATCH_FLATS - 1);
    const r = PATCH_SPREAD * (i % 2 ? 1 : 0.6);
    out.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]);
  }
  return out;
}

/**
 * WHAT E DOES AT A PATCH, and the prompt that says it: `{ kind, verb, rest, ready, needsRank? }` - `kind` 'herbs' or 'food'
 * (the choice key's pick, the herbs first while untaken); `ready` false with `rest` naming what is missing, and a rank
 * short the rank it needs (VEIN-NEED). TOOL-USE: `only` - a tool's Use asks `basket`'s harvest alone (the Sickle the
 * herbs, the Basket the food): taken, it says so, never the other harvest's act.
 * @param {{ patch: any, taken: (k: string) => boolean, counting: (k: string) => boolean, basket: boolean, rank: number,
 *   sickle: boolean, basketTool: boolean, storesFull: (key: string) => boolean, herbKeyOf: (t: number) => string,
 *   today: number, cap: number, only?: boolean }} o
 */
export function patchPlan({ patch, taken, counting, basket, rank, sickle, basketTool, storesFull, herbKeyOf, today, cap, only = false }) {
  const herbsLeft = !taken('herbs') && !counting('herbs');
  const foodLeft = !taken('food') && !counting('food');
  let kind = basket ? 'food' : 'herbs';
  if (!only && kind === 'herbs' && !herbsLeft && foodLeft) kind = 'food';
  if (!only && kind === 'food' && !foodLeft && herbsLeft) kind = 'herbs';
  const both = herbsLeft && foodLeft;
  const name = templateByIndex(patch.herb)?.name ?? 'the herb';
  const rankWord = `Herbalism ${rank}`;
  if (!herbsLeft && !foodLeft) return { kind, verb: `${name} - gathered today`, rest: counting('herbs') || counting('food') ? 'being counted' : '', ready: false, both: false };
  // TOOL-USE: the tool's own harvest gone, the other left
  if (!(kind === 'food' ? foodLeft : herbsLeft)) return { kind, verb: kind === 'food' ? 'Search with the Basket' : `Pick ${name}`, rest: counting(kind) ? 'being counted' : 'gathered today', ready: false, both };
  if (today >= cap) return { kind, verb: kind === 'food' ? 'Search with the Basket' : `Pick ${name}`, rest: `${rankWord} - ${today} of ${cap} today`, ready: false, both, full: true };
  if (kind === 'food') {
    if (!basketTool) return { kind, verb: 'Search with the Basket', rest: 'needs a Basket', ready: false, both };
    return { kind, verb: 'Search with the Basket', rest: rankWord, ready: true, both };
  }
  if (!tierOpen(rank, patch.tier)) return { kind, verb: `Pick ${name}`, rest: `needs Herbalism ${TIER_RANKS[patch.tier - 1]}`, ready: false, both, needsRank: TIER_RANKS[patch.tier - 1] };
  if (patch.tier > 1 && !sickle) return { kind, verb: `Pick ${name}`, rest: 'needs a Sickle', ready: false, both };
  const key = herbKeyOf(patch.herb);
  if (key && storesFull(key)) return { kind, verb: `Pick ${name}`, rest: `Stores full - ${materialLabel(key)}`, ready: false, both };
  return { kind, verb: `Pick ${name}`, rest: rankWord, ready: true, both };
}

/** The Sickle in the hand for the steady hand's length (FORAGE0 14.2): DFU's own Tanto, its idle frame. */
export const SICKLE_HAND = Object.freeze({ group: 'Weapons', templateIndex: 114, material: 0 });

/**
 * HERBALISM'S KIND in the gathering host (scenes/gatherHost.js): its patches, their pictures, the plan, the act.
 * @param {{ book: any }} deps
 * @returns {import('./gatherHost.js').GatherKind}
 */
export function herbKind({ book }) {
  let basketChoice = false;   // the choice key's pick at the targeted patch
  const gone = (p) => book.taken(p.key, 'herbs') && book.taken(p.key, 'food');
  return {
    id: 'herb',
    professions: Object.freeze(['herbalism']),
    nodesOf({ px, py, day, info, confirmed, specs, entry }) {
      if (!HERB_TABLES[info.climate]) return [];
      return standPatches({
        px, py, day, climate: info.climate, confirmed, seasonalEye: specs('herbalism')[100] === 'seasonal-eye',
        samples: entry.samples, tilemap: entry.tilemap, locationRect: entry.locationRect ?? entry.wodSite ?? null,   // AUDIT 29 C8: a WoD site's rect, as nature keeps off it (terrainGen.js)
      });
    },
    flatsOf(p) {
      const record = templateByIndex(p.herb)?.worldTextureRecord;
      return Number.isInteger(record) ? [{ archive: HERB_FLAT_ARCHIVE, record, scale: PATCH_SCALE, centers: patchFlats(p) }] : [];
    },
    gone,
    mark: (p) => (gone(p) ? null : PATCH_MARK),   // NODE-MARKS: on the compass and lit while either harvest stands
    tools: Object.freeze([FT.Sickle, FT.Basket]),   // TOOL-USE
    choose() { basketChoice = !basketChoice; },
    retarget() { basketChoice = false; },
    plan(p, { entity, info, rank, keyLabel, tool = null }) {
      // TOOL-USE: the Sickle's Use asks the herbs and the Basket's the food, whatever the choice key picked - the pick unmoved
      const only = tool === FT.Sickle ? 'herbs' : tool === FT.Basket ? 'food' : null;
      const plan = patchPlan({
        patch: p, taken: (k) => book.taken(p.key, k), counting: (k) => book.counting(p.key, k), basket: only ? only === 'food' : basketChoice, only: !!only,
        rank: rank('herbalism'), sickle: !!foragingToolIn(entity, FT.Sickle), basketTool: !!foragingToolIn(entity, FT.Basket),
        storesFull: (key) => book.held(key) >= (book.state.caps?.stores ?? 5000), herbKeyOf: (h) => herbKey(h, info?.region ?? 0),
        today: book.state.today?.herbalism ?? 0, cap: book.state.caps?.harvests ?? 60,
      });
      return { ...plan, harvest: plan.kind, profession: 'herbalism', alt: plan.both ? `[${keyLabel('ActChoice')}] ${plan.kind === 'food' ? 'the herbs' : 'the Basket'}` : '' };
    },
    start(p, plan, { entity, rank, tool: used = null }) {
      const common = plan.harvest === 'herbs' && p.tier === 1;
      const refusal = foragingActRefusal(plan.harvest === 'food' ? FT.Basket : FT.Sickle);
      if (refusal) return { refused: refusal };
      const kind = plan.harvest === 'food' ? 'basket' : common ? 'hand' : 'steady';
      const tool = plan.harvest === 'food' ? foragingToolIn(entity, FT.Basket) : common ? null : foragingToolIn(entity, FT.Sickle);
      const r = rank('herbalism');
      return {
        act: createHerbAct({ kind, band: actBand(liveStat(entity, 'intelligence')), botanist: book.track('herbalism').specs?.[50] === 'botanist', master: r >= PROF_RANK_MAX, gentle: getPref('gentleActs') === true }),
        harvest: plan.harvest, tool, profession: 'herbalism', label: plan.harvest === 'food' ? 'tap the glint' : '',
        hand: (a) => (a.harvest === 'herbs' && a.tool ? SICKLE_HAND : null),
        heldByUse: !!used && kind === 'steady',   // TOOL-USE: the Sickle's Use holds the steady hand - keep still, no E held
      };
    },
    cleanNote: (a) => (a.harvest === 'food' ? ' (every find)' : ' (unbruised)'),
    title: () => 'Herbalist',
  };
}
