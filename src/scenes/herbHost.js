// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Life skills will utilize things like tree
// chopping, picking up ingredients, fishing, etc. Active player
// involvement and actual UI integration for life skills") - HERBALISM IN
// THE STREAMING WORLD, composed for a host (bible/06-Systems/
// Professions-Arc.md 5, 6, 8, 22; FORAGE0 14):
//
//   THE PATCHES. Each built wilderness pixel stands its day's herb
//   patches (net/nodeLaw.js - the clock's, the same for every client),
//   each where DFU's own nature would stand on that tile (world/
//   terrainNature.js natureStandsAt: never in a town, on water or a
//   cliff), as a small cluster of the herb's own world picture (TEXTURE
//   .254, the plant's item flat - no new art). The batches are the
//   pixel's own - appended to its list, so its frame walk draws them and
//   destroyPixel frees them (EVERY ALLOCATION HAS AN OWNER) - and stood
//   again at the UTC day's turn, when the service says a pixel's state,
//   or when a patch is taken whole (herbs and food both: gone for the
//   day, PROF0 5.3).
//   THE TARGET. The patch in reach (DFU's activation distance) nearest
//   the look; the prompt says what E does there, or what it needs.
//   THE ACT. E starts it (Foraging's checks first, with the Sickle's
//   lines or the Basket's - FORAGE0 14.3); the frame plays it (systems/
//   herbAct.js); Escape or letting go of E ends it with nothing lost; its
//   end wears the tool and asks the service (net/profBook.js - kept and
//   asked again until answered). The answer is said in the toasts.
//
// One owner: the host builds it online, and disposes it with the page.
// ═══════════════════════════════════════════════════════════════════
import { herbPatches, nodeKey, utcDayOfMs, pixelKey, HERB_TABLES } from '../net/nodeLaw.js';
import { tierOpen, TIER_RANKS, actBand, rankName, PROF_RANK_MAX, herbKey } from '../net/professionLaw.js';
import { natureStandsAt } from '../world/terrainNature.js';
import { createHerbAct } from '../systems/herbAct.js';
import { FT } from '../systems/foragingLaw.js';
import { foragingActRefusal, foragingToolIn, wearForagingTool } from '../systems/foragingInstall.js';
import { materialLabel, materialCountLabel } from '../systems/profItems.js';
import { templateByIndex } from '../systems/itemTemplates.js';
import { accountRefusalText } from '../net/accountClient.js';
import { liveStat } from '../systems/statMods.js';
import { getPref } from '../systems/uiPrefs.js';
import { WORLD_MAP_TILE_DIM } from '../world/terrainTiles.js';
import { DEFAULT_ACTIVATION_DISTANCE } from '../player/activate.js';

/** The item flats' archive - every plant's world picture is in it (its template's worldTextureRecord). */
export const HERB_FLAT_ARCHIVE = 254;
/** A patch is this many of its herb's flats, spread this far (m) about its point, at this times the item's own size. */
export const PATCH_FLATS = 5;
export const PATCH_SPREAD = 0.7;
export const PATCH_SCALE = 1.6;
/** A patch answers E within DFU's activation distance, and within this many degrees of the look. */
export const PATCH_REACH = DEFAULT_ACTIVATION_DISTANCE;
export const PATCH_AIM_DEG = 25;
/** The ranks a banner marks (PROF0 8). */
export const BANNER_RANKS = Object.freeze([25, 50, 75, 100]);

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
 * WHAT E DOES AT A PATCH, and the prompt that says it: `{ kind, verb, rest, ready, needs? }` - `kind` 'herbs' or 'food'
 * (the choice key's pick, the herbs first while untaken); `ready` false with `rest` naming what is missing.
 * @param {{ patch: any, taken: (k: string) => boolean, counting: (k: string) => boolean, basket: boolean, rank: number,
 *   sickle: boolean, basketTool: boolean, storesFull: (key: string) => boolean, herbKeyOf: (t: number) => string,
 *   today: number, cap: number }} o
 */
export function patchPlan({ patch, taken, counting, basket, rank, sickle, basketTool, storesFull, herbKeyOf, today, cap }) {
  const herbsLeft = !taken('herbs') && !counting('herbs');
  const foodLeft = !taken('food') && !counting('food');
  let kind = basket ? 'food' : 'herbs';
  if (kind === 'herbs' && !herbsLeft && foodLeft) kind = 'food';
  if (kind === 'food' && !foodLeft && herbsLeft) kind = 'herbs';
  const both = herbsLeft && foodLeft;
  const name = templateByIndex(patch.herb)?.name ?? 'the herb';
  const rankWord = `Herbalism ${rank}`;
  if (!herbsLeft && !foodLeft) return { kind, verb: `${name} - gathered today`, rest: counting('herbs') || counting('food') ? 'being counted' : '', ready: false, both: false };
  if (today >= cap) return { kind, verb: kind === 'food' ? 'Search with the Basket' : `Pick ${name}`, rest: `${rankWord} - ${today} of ${cap} today`, ready: false, both, full: true };
  if (kind === 'food') {
    if (!basketTool) return { kind, verb: 'Search with the Basket', rest: 'needs a Basket', ready: false, both };
    return { kind, verb: 'Search with the Basket', rest: rankWord, ready: true, both };
  }
  if (!tierOpen(rank, patch.tier)) return { kind, verb: `Pick ${name}`, rest: `needs Herbalism ${TIER_RANKS[patch.tier - 1]}`, ready: false, both };
  if (patch.tier > 1 && !sickle) return { kind, verb: `Pick ${name}`, rest: 'needs a Sickle', ready: false, both };
  const key = herbKeyOf(patch.herb);
  if (key && storesFull(key)) return { kind, verb: `Pick ${name}`, rest: `Stores full - ${materialLabel(key)}`, ready: false, both };
  return { kind, verb: `Pick ${name}`, rest: rankWord, ready: true, both };
}

/**
 * @param {{
 *   book: any, hud: any,
 *   renderer: any, getTexture: (a: number) => Promise<any>, uploadRecord: (a: number, r: number) => void,
 *   billboardSize: (t: any, r: number) => { w: number, h: number }, flatBatchAabb: (c: number[][], s: any) => number[],
 *   built: () => Map<string, any>, pixelTranslation: (px: number, py: number, out: number[]) => number[],
 *   pixelInfo: (px: number, py: number) => ({ climate: number, region: number } | null),
 *   nowMs: () => number, eye: () => ({ pos: number[], dir: number[] }), view: () => ({ yaw: number, pitch: number }),
 *   feet: () => number[], entity: () => any, keyLabel: (a: string) => string,
 *   input: () => ({ held: boolean, attack: boolean, choice: boolean }), active: () => boolean,
 *   onSettle?: () => void,
 * }} deps `active` - the streaming world's exterior, walking, nothing over it (the host's); `nowMs` the shared clock
 */
export function createHerbHost(deps) {
  const { book, hud } = deps;
  /** pixel key -> { entry, patches, batches, day, stood } */
  const stood = new Map();
  let day = utcDayOfMs(deps.nowMs());
  let target = null;          // { patch, px, py, world }
  let basketChoice = false;   // the choice key's pick at the targeted patch
  let act = null;             // { act, patch, kind, px, py, tool, climate, region, startedAt }
  let refreshAt = 0, settled = false, sayKept = false, pixelsAt = 0, targetKey = null;
  let chipLeft = 0;
  const _t = [0, 0, 0];
  const rank = () => book.track('herbalism').rank;
  const specs = () => book.track('herbalism').specs ?? { 50: null, 100: null };

  // ─── THE PATCHES ───────────────────────────────────────────────────
  function unstand(entry) {
    const s = stood.get(`${entry.px},${entry.py}`);
    if (!s) return;
    for (const b of s.batches) {
      const i = entry.batches.indexOf(b);
      if (i >= 0) entry.batches.splice(i, 1);
      deps.renderer.destroyBatch(b);
    }
    s.batches = [];
  }
  async function stand(entry) {
    if (!entry?.samples || !entry.tilemap || book.state.open !== true) return;
    const key = `${entry.px},${entry.py}`;
    unstand(entry);
    const info = deps.pixelInfo(entry.px, entry.py);
    const rec = { entry, patches: [], batches: [], day, info };
    stood.set(key, rec);
    if (!info || !HERB_TABLES[info.climate]) return;
    const fact = book.pixel(entry.px, entry.py);
    const confirmed = fact?.state === 'confirmed' || fact?.state === 'disputed';
    // a pixel the witnesses confirmed as something else stands nothing: nothing here could be gathered
    if (confirmed && (fact.climate !== info.climate || fact.region !== info.region)) return;
    rec.patches = standPatches({
      px: entry.px, py: entry.py, day, climate: info.climate, confirmed, seasonalEye: specs()[100] === 'seasonal-eye',
      samples: entry.samples, tilemap: entry.tilemap, locationRect: entry.locationRect ?? null,
    });
    const groups = new Map();
    for (const p of rec.patches) {
      if (book.taken(p.key, 'herbs') && book.taken(p.key, 'food')) continue;   // gone for the day
      const record = templateByIndex(p.herb)?.worldTextureRecord;
      if (!Number.isInteger(record)) continue;
      if (!groups.has(record)) groups.set(record, []);
      groups.get(record).push(...patchFlats(p));
    }
    const t = await deps.getTexture(HERB_FLAT_ARCHIVE);
    if (deps.built().get(key) !== entry || stood.get(key) !== rec) return;   // torn down, or stood again, during the await
    for (const [record, centers] of groups) {
      if (!t || record >= t.recordCount) continue;
      deps.uploadRecord(HERB_FLAT_ARCHIVE, record);
      const base = deps.billboardSize(t, record);
      const size = { w: base.w * PATCH_SCALE, h: base.h * PATCH_SCALE };
      const batch = deps.renderer.createBillboardBatch(HERB_FLAT_ARCHIVE, record, size, centers);
      batch._box = deps.flatBatchAabb(centers, size);
      entry.batches.push(batch);
      rec.batches.push(batch);
    }
  }
  /** Every built pixel stood again - the day's turn, the state first read (a pixel built before it stood nothing). */
  const restandAll = () => { for (const entry of deps.built().values()) stand(entry); };

  // ─── THE TARGET ────────────────────────────────────────────────────
  function findTarget() {
    const { pos, dir } = deps.eye();
    const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    let best = null, bestAng = PATCH_AIM_DEG;
    for (const s of stood.values()) {
      if (!s.patches.length) continue;
      const tr = deps.pixelTranslation(s.entry.px, s.entry.py, _t);
      for (const p of s.patches) {
        const wx = p.local[0] + tr[0], wy = p.local[1] + tr[1] + 0.3, wz = p.local[2] + tr[2];
        const dx = wx - pos[0], dy = wy - pos[1], dz = wz - pos[2];
        const flat = Math.hypot(dx, dz);
        if (flat > PATCH_REACH) continue;
        const d = Math.hypot(dx, dy, dz) || 1;
        const cos = (dx * dir[0] + dy * dir[1] + dz * dir[2]) / (d * dl);
        const ang = Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
        if (ang < bestAng) { bestAng = ang; best = { patch: p, px: s.entry.px, py: s.entry.py, info: s.info, world: [wx, wy, wz] }; }
      }
    }
    return best;
  }
  const planFor = (t) => {
    const e = deps.entity();
    return patchPlan({
      patch: t.patch, taken: (k) => book.taken(t.patch.key, k), counting: (k) => book.counting(t.patch.key, k), basket: basketChoice,
      rank: rank(), sickle: !!foragingToolIn(e, FT.Sickle), basketTool: !!foragingToolIn(e, FT.Basket),
      storesFull: (key) => book.held(key) >= (book.state.caps?.stores ?? 5000), herbKeyOf: (h) => herbKey(h, t.info?.region ?? 0),
      today: book.state.today?.herbalism ?? 0, cap: book.state.caps?.harvests ?? 60,
    });
  };

  // ─── THE ACT ───────────────────────────────────────────────────────
  function start(t, plan) {
    const e = deps.entity();
    const common = plan.kind === 'herbs' && t.patch.tier === 1;
    const refusal = foragingActRefusal(plan.kind === 'food' ? FT.Basket : FT.Sickle);
    if (refusal) { hud.toast(refusal); return; }
    const kind = plan.kind === 'food' ? 'basket' : common ? 'hand' : 'steady';
    const tool = plan.kind === 'food' ? foragingToolIn(e, FT.Basket) : common ? null : foragingToolIn(e, FT.Sickle);
    const r = rank();
    act = {
      act: createHerbAct({ kind, band: actBand(liveStat(e, 'intelligence')), botanist: specs()[50] === 'botanist', master: r >= PROF_RANK_MAX, gentle: getPref('gentleActs') === true }),
      patch: t.patch, kind: plan.kind, px: t.px, py: t.py, tool, info: t.info, world: t.world,
    };
    chipLeft = 6;
  }
  function finish(a) {
    const report = a.act.report();
    act = null;
    hud.setMeter(null);
    if (!report) return;
    a.clean = report.clean === true || report.finds >= 3;
    if (a.tool) wearForagingTool(a.tool, deps.entity());   // FORAGE0 14.1: a completed act wears its tool by one
    const before = rank();
    book.harvest({
      node: a.patch.key, kind: a.kind, climate: a.info.climate, region: a.info.region, act: report,
      at: Math.floor(deps.nowMs() / 1000),
    }).then((r) => answered(a, r, before), () => {});
  }
  /** A harvest's answer said: the Stores, the XP, a rank's rise; a refusal in words; a kept one once. */
  function answered(a, r, before) {
    if (r?.ok) {
      const d = r.data;
      hud.toast(`+${d.qty} ${materialCountLabel(d.material, d.qty)} to your Stores`);
      hud.toast(`+${d.xp} Herbalism XP${a?.clean ? (a.kind === 'food' ? ' (every find)' : ' (unbruised)') : ''}`);
      const after = d.track?.rank ?? before;
      if (after > before) {
        hud.toast(`Herbalism ${before} -> ${after}`);
        const crossed = BANNER_RANKS.filter((b) => before < b && after >= b);
        if (crossed.length) {
          const at = crossed[crossed.length - 1];
          hud.banner(`${rankName(at)} Herbalist`);
          if (at === 50 || at === 100) hud.toast('A specialisation may be chosen on the Professions page (F5).');
        }
      }
      chipLeft = 6;
      if (book.taken(d.node, 'herbs') && book.taken(d.node, 'food')) { const s = stood.get(pixelKey(a.px, a.py)); if (s) stand(s.entry); }
      return;
    }
    if (r?.kept) {
      if (!sayKept) { sayKept = true; hud.toast('The counting-house is slow to answer. Your gathering is kept and will be counted.'); }
      return;
    }
    if (r?.error === 'lapsed') { hud.toast('A gathering the counting-house never answered has lapsed with the day.'); return; }
    hud.toast(accountRefusalText(r?.error));
    const s = a ? stood.get(pixelKey(a.px, a.py)) : null;
    if (s && r?.error === 'node-taken') stand(s.entry);
  }

  return {
    /** A pixel built: its patches stood. */
    onBuilt(entry) { if (entry) stand(entry); },
    /** A pixel torn down: its batches went with it (they are in its list); forgotten here. */
    onDestroyed(entry) { if (entry) stood.delete(`${entry.px},${entry.py}`); },
    /** Whether an act is playing - the host keeps the weapon's swing, and the press ladder, off it. */
    acting: () => !!act,
    /** The tool in the hand for the rig (combat/weaponRig.js actTool): the Sickle's steady hand, as DFU's Tanto. */
    handTool: () => (act && act.kind === 'herbs' && act.tool ? { group: 'Weapons', templateIndex: 114, material: 0 } : null),
    /** E pressed: a patch in reach takes it - an act started, or what it needs said. True when the press was the patch's. */
    press() {
      if (act || !target || !deps.active() || book.state.open !== true) return false;
      const plan = planFor(target);
      if (!plan.ready) { if (plan.rest) hud.toast(plan.rest === 'being counted' ? 'That gathering is being counted.' : `${plan.verb}: ${plan.rest}`); return true; }
      start(target, plan);
      return true;
    },
    /** Escape: the act ends, nothing lost. True when there was one. */
    cancel() { if (!act) return false; act.act.cancel(); act = null; hud.setMeter(null); return true; },
    /** Every frame the host is in the streaming world. */
    tick(dt) {
      const now = deps.nowMs();
      // the state: read on arrival, at a new character and at the UTC day's turn; kept acts settled once
      if (book.stale() && now >= refreshAt) {
        refreshAt = now + 30_000;
        book.refresh().then((r) => { if (r?.ok) { refreshAt = 0; restandAll(); if (!settled) { settled = true; deps.onSettle?.(); } } }, () => {});
      }
      const d = utcDayOfMs(now);
      if (d !== day) { day = d; restandAll(); }
      if (book.state.open !== true) { hud.setPrompt(null); hud.setMeter(null); hud.setChip(null); hud.frame(dt); return; }
      // the streamed pixels' witnessed states - a pixel that changed stands again
      const want = now >= pixelsAt ? [...stood.values()].map((s) => [s.entry.px, s.entry.py]).filter(([x, y]) => !book.pixel(x, y)) : [];
      if (want.length) pixelsAt = now + 5_000;
      if (want.length) book.askPixels(want).then((changed) => { for (const c of changed ?? []) { const s = stood.get(pixelKey(c.x, c.y)); if (s) stand(s.entry); } }, () => {});
      book.pump((h, r) => answered(null, r, rank()));
      const input = deps.input();
      if (act) {
        const { pos } = deps.eye();
        const v = deps.view();
        const feet = deps.feet();
        act.act.tick(dt, { held: input.held, attack: input.attack, view: v, pos: { x: feet[0], z: feet[2] } });
        const away = Math.hypot(act.world[0] - pos[0], act.world[2] - pos[2]) > PATCH_REACH + 1;
        if (act.act.state.cancelled || away || !deps.active()) { act = null; hud.setMeter(null); }
        else if (act.act.state.done) finish(act);
        else hud.setMeter(act.act, act.kind === 'food' ? 'tap the glint' : '');
        hud.setPrompt(null);
      } else {
        target = deps.active() ? findTarget() : null;
        if ((target?.patch.key ?? null) !== targetKey) { targetKey = target?.patch.key ?? null; basketChoice = false; }   // a new patch: the herbs first
        if (target && input.choice) basketChoice = !basketChoice;
        if (target) {
          const plan = planFor(target);
          hud.setPrompt({ key: deps.keyLabel('Interact'), verb: plan.verb, rest: plan.rest, alt: plan.both ? `[${deps.keyLabel('ActChoice')}] ${plan.kind === 'food' ? 'the herbs' : 'the Basket'}` : '' });
          chipLeft = Math.max(chipLeft, 0.5);
        } else hud.setPrompt(null);
      }
      chipLeft = Math.max(0, chipLeft - dt);
      hud.setChip(chipLeft > 0 ? `Herbalism ${rank()} - ${book.state.today?.herbalism ?? 0} / ${book.state.caps?.harvests ?? 60} today` : null);
      hud.frame(dt);
    },
    /** For the pins: what stands, and the target. */
    get target() { return target; },
    patchesOf: (px, py) => stood.get(pixelKey(px, py))?.patches ?? [],
    /** The page's teardown. */
    dispose() { for (const s of stood.values()) unstand(s.entry); stood.clear(); act = null; hud.dispose(); },
  };
}
