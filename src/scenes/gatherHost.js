// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF2 (2026-09-28, Mac: "Go") - THE GATHERING PROFESSIONS IN THE
// STREAMING WORLD, one shell for every kind of node (bible/06-Systems/
// Professions-Arc.md 5, 6, 8, 22, 23; FORAGE0 14). PROF1 built it as
// Herbalism's own host; every gathering profession needs the same shell,
// so the shell is this, and each profession is a KIND in it - PROF1's
// patches (scenes/herbHost.js herbKind) and PROF2's veins and boulders
// (scenes/mineHost.js mineKind) now; Logging's trees, Hunting's bodies and
// Fishing's water later. One prompt, one act, one book.
//
//   THE NODES. Each built wilderness pixel stands its day's nodes of every
//   kind (net/nodeLaw.js - the clock's, the same for every client), each
//   kind saying where it stands and what pictures it draws. The batches
//   are the pixel's own - appended to its list, so its frame walk draws
//   them and destroyPixel frees them (EVERY ALLOCATION HAS AN OWNER) - and
//   stood again at the UTC day's turn, when the service says a pixel's
//   state, or when a node is taken whole (gone for the day, PROF0 5.3).
//   THE TARGET. The node in reach nearest the look, of any kind; the
//   prompt says what E does there, or what it needs.
//   THE ACT. E starts it (the kind's checks - Foraging's first, FORAGE0
//   14.3); the frame plays it (the kind's machine: systems/herbAct.js,
//   systems/mineAct.js); Escape, or walking off, ends it with nothing
//   lost; its end wears the tool and asks the service (net/profBook.js -
//   kept and asked again until answered). The answer is said in the
//   toasts, the rank's rise in the banner.
//
// One owner: the host builds it online, and disposes it with the page.
// ═══════════════════════════════════════════════════════════════════
import { utcDayOfMs, pixelKey } from '../net/nodeLaw.js';
import { rankName, professionName } from '../net/professionLaw.js';
import { wearForagingTool } from '../systems/foragingInstall.js';
import { materialCountLabel } from '../systems/profItems.js';
import { accountRefusalText } from '../net/accountClient.js';
import { DEFAULT_ACTIVATION_DISTANCE } from '../player/activate.js';

/** A node answers E within DFU's activation distance, and within this many degrees of the look. */
export const NODE_REACH = DEFAULT_ACTIVATION_DISTANCE;
export const NODE_AIM_DEG = 25;
/** The ranks a banner marks (PROF0 8). */
export const BANNER_RANKS = Object.freeze([25, 50, 75, 100]);
/** The day's chip stays this long after an act or a look (s). */
const CHIP_S = 6;

/** The shortest signed angle a - b, degrees in (-180, 180]. */
export const wrapDeg = (d) => { let x = d % 360; if (x > 180) x -= 360; if (x <= -180) x += 360; return x; };
/**
 * WHERE THE CROSSHAIR IS ON A NODE'S FACE: the view's bearing from the node's centre, degrees - `yaw` to the right
 * (the port's +yaw turns right, player/cameraRecoiler.js), `pitch` up.
 * @param {number[]} eyePos @param {number[]} at the node's centre, world @param {{ yaw: number, pitch: number }} view degrees
 */
export function aimAt(eyePos, at, view) {
  const dx = at[0] - eyePos[0], dy = at[1] - eyePos[1], dz = at[2] - eyePos[2];
  const yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
  const pitch = (Math.atan2(dy, Math.hypot(dx, dz)) * 180) / Math.PI;
  return { yaw: wrapDeg(view.yaw - yaw), pitch: view.pitch - pitch };
}

/**
 * @typedef {object} GatherKind One profession's nodes in the shell.
 * @property {string} id
 * @property {readonly string[]} professions the professions its nodes are worked under
 * @property {(ctx: any) => any[]} nodesOf a pixel's nodes today: `{ key, local: [x,y,z], lift?, ... }`
 * @property {(ctx: any) => any[]} [dungeonNodesOf] a dungeon's nodes today (PROF2's veins), in the dungeon's own space
 * @property {(node: any) => Array<{ archive: number, record: number, scale: number, centers: number[][] }>} flatsOf
 * @property {(node: any) => boolean} gone whether every harvest of the node is taken today
 * @property {(node: any, ctx: any) => any} plan what E does: `{ harvest, verb, rest, ready, both?, alt? }`
 * @property {(node: any, plan: any, ctx: any) => any} start the act: `{ act, harvest, tool, profession, label, hand? }`
 *   or `{ refused: text }`
 * @property {(node: any) => void} [choose] the act choice key at this node
 * @property {() => void} [retarget] a new node is targeted
 * @property {(a: any, data: any) => string} cleanNote what a clean act is called in the XP toast
 * @property {(profession: string) => string} title a rank's banner word ('Herbalist', 'Miner')
 */

/**
 * @param {{
 *   book: any, hud: any, kinds: GatherKind[],
 *   renderer: any, getTexture: (a: number) => Promise<any>, uploadRecord: (a: number, r: number) => void,
 *   billboardSize: (t: any, r: number) => { w: number, h: number }, flatBatchAabb: (c: number[][], s: any) => number[],
 *   built: () => Map<string, any>, pixelTranslation: (px: number, py: number, out: number[]) => number[],
 *   pixelInfo: (px: number, py: number) => ({ climate: number, region: number } | null),
 *   nowMs: () => number, eye: () => ({ pos: number[], dir: number[] }), view: () => ({ yaw: number, pitch: number }),
 *   feet: () => number[], entity: () => any, keyLabel: (a: string) => string,
 *   input: () => ({ held: boolean, attack: boolean, choice: boolean }), active: () => boolean,
 *   activeDungeon?: () => boolean, onSettle?: () => void,
 * }} deps `active` - the streaming world's exterior, walking, nothing over it (the host's); `activeDungeon` - a dungeon
 *   entered, walking, nothing over it; `nowMs` the shared clock
 */
export function createGatherHost(deps) {
  const { book, hud, kinds } = deps;
  const kindOf = (node) => kinds.find((k) => k.id === node.kind) ?? null;
  /** pixel key -> { entry, info, nodes, batches } */
  const stood = new Map();
  let day = utcDayOfMs(deps.nowMs());
  let target = null;          // { node, px, py, info, world }
  let act = null;             // { act, node, harvest, tool, profession, label, px, py, info, world, hand }
  let refreshAt = 0, settled = false, sayKept = false, pixelsAt = 0, targetKey = null;
  let chipLeft = 0;
  let chipProfession = /** @type {string|null} */ (null);
  const _t = [0, 0, 0];
  /** PROF2: the dungeon the player stands in, as a place: its identity and ground, the wall its veins stand on, and its
   *  own doors for the flats (owned with the dungeon's batches). */
  let dungeon = null;
  const inDungeon = () => !!dungeon && !!deps.activeDungeon?.();
  const rank = (profession) => book.track(profession).rank;
  const specs = (profession) => book.track(profession).specs ?? { 50: null, 100: null };

  // ─── THE NODES ─────────────────────────────────────────────────────
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
    const rec = { entry, info, nodes: [], batches: [] };
    stood.set(key, rec);
    if (!info) return;
    const fact = book.pixel(entry.px, entry.py);
    const confirmed = fact?.state === 'confirmed' || fact?.state === 'disputed';
    // a pixel the witnesses confirmed as something else stands nothing: nothing here could be gathered
    if (confirmed && (fact.climate !== info.climate || fact.region !== info.region)) return;
    const ctx = { entry, px: entry.px, py: entry.py, day, info, confirmed, specs, book };
    rec.nodes = kinds.flatMap((k) => k.nodesOf(ctx).map((n) => ({ ...n, kind: k.id })));
    /** archive -> `${record}:${scale}` -> centres */
    const groups = new Map();
    for (const n of rec.nodes) {
      const k = kindOf(n);
      if (!k || k.gone(n)) continue;   // gone for the day
      for (const f of k.flatsOf(n)) {
        if (!groups.has(f.archive)) groups.set(f.archive, new Map());
        const g = groups.get(f.archive);
        const gk = `${f.record}:${f.scale}`;
        if (!g.has(gk)) g.set(gk, { record: f.record, scale: f.scale, centers: [] });
        g.get(gk).centers.push(...f.centers);
      }
    }
    for (const [archive, byRecord] of groups) {
      const t = await deps.getTexture(archive);
      if (deps.built().get(key) !== entry || stood.get(key) !== rec) return;   // torn down, or stood again, during the await
      for (const { record, scale, centers } of byRecord.values()) {
        if (!t || record >= t.recordCount) continue;
        deps.uploadRecord(archive, record);
        const base = deps.billboardSize(t, record);
        const size = { w: base.w * scale, h: base.h * scale };
        const batch = deps.renderer.createBillboardBatch(archive, record, size, centers);
        batch._box = deps.flatBatchAabb(centers, size);
        entry.batches.push(batch);
        rec.batches.push(batch);
      }
    }
  }
  /** PROF2: A DUNGEON'S NODES stood - its veins on its walls, the flats through its own doors; stood again at the day's
   *  turn, the state's read, the witnesses' word and a vein taken. A dungeon the witnesses confirmed as something else
   *  stands nothing. */
  async function standDungeon() {
    const d = dungeon;
    if (!d) return;
    for (const b of d.batches) d.drop(b);
    d.batches = [];
    d.nodes = [];
    if (book.state.open !== true) return;
    const fact = book.dungeon(d.id);
    const confirmed = fact?.state === 'confirmed' || fact?.state === 'disputed';
    if (confirmed && (fact.climate !== d.info.climate || fact.region !== d.info.region)) return;
    const ctx = { dungeon: d.id, day, info: d.info, confirmed, specs, book, wall: d.wall };
    const nodes = kinds.flatMap((k) => (k.dungeonNodesOf?.(ctx) ?? []).map((n) => ({ ...n, kind: k.id })));
    d.nodes = nodes;
    for (const n of nodes) {
      const k = kindOf(n);
      if (!k || k.gone(n)) continue;
      for (const f of k.flatsOf(n)) {
        const b = await d.stand(f.archive, f.record, f.scale, f.centers);
        if (dungeon !== d) { if (b) d.drop(b); return; }   // left, or entered another, during the await
        if (b) d.batches.push(b);
      }
    }
  }
  /** Every built pixel stood again - the day's turn, the state first read (a pixel built before it stood nothing). */
  const restandAll = () => { for (const entry of deps.built().values()) stand(entry); standDungeon(); };
  const restandAt = (px, py) => { const s = stood.get(pixelKey(px, py)); if (s) stand(s.entry); };
  /** A node's place stood again: its pixel's, or the dungeon's. */
  const restandOf = (a) => (a.dungeon ? standDungeon() : restandAt(a.px, a.py));

  // ─── THE TARGET ────────────────────────────────────────────────────
  const worldOf = (s, n) => {
    const tr = deps.pixelTranslation(s.entry.px, s.entry.py, _t);
    return [n.local[0] + tr[0], n.local[1] + tr[1] + (n.lift ?? 0.3), n.local[2] + tr[2]];
  };
  function findTarget() {
    const { pos, dir } = deps.eye();
    const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    let best = null, bestAng = NODE_AIM_DEG;
    // PROF2: underground the dungeon's nodes, in its own space; above ground the streamed pixels'
    const places = inDungeon() ? [{ nodes: dungeon.nodes, entry: null, info: dungeon.info, at: (n) => [n.local[0], n.local[1] + (n.lift ?? 0.3), n.local[2]] }]
      : [...stood.values()].map((s) => ({ nodes: s.nodes, entry: s.entry, info: s.info, at: (n) => worldOf(s, n) }));
    for (const s of places) {
      if (!s.nodes.length) continue;
      for (const n of s.nodes) {
        const k = kindOf(n);
        if (!k || k.gone(n)) continue;
        const w = s.at(n);
        const dx = w[0] - pos[0], dy = w[1] - pos[1], dz = w[2] - pos[2];
        if (Math.hypot(dx, dz) > (n.reach ?? NODE_REACH)) continue;
        const d = Math.hypot(dx, dy, dz) || 1;
        const cos = (dx * dir[0] + dy * dir[1] + dz * dir[2]) / (d * dl);
        const ang = Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
        if (ang < bestAng) { bestAng = ang; best = { node: n, px: s.entry?.px ?? null, py: s.entry?.py ?? null, dungeon: !s.entry, info: s.info, world: w }; }
      }
    }
    return best;
  }
  const ctxFor = (t) => ({ entity: deps.entity(), info: t.info, book, rank, specs, keyLabel: deps.keyLabel });
  const planFor = (t) => kindOf(t.node)?.plan(t.node, ctxFor(t)) ?? null;

  // ─── THE ACT ───────────────────────────────────────────────────────
  function start(t, plan) {
    const k = kindOf(t.node);
    const a = k?.start(t.node, plan, ctxFor(t));
    if (!a) return;
    if (a.refused) { hud.toast(a.refused); return; }
    act = { ...a, node: t.node, px: t.px, py: t.py, dungeon: t.dungeon, info: t.info, world: t.world };
    chipProfession = a.profession;
    chipLeft = CHIP_S;
  }
  function finish(a) {
    const report = a.act.report();
    act = null;
    hud.setMeter(null);
    if (!report) return;
    a.clean = report.clean === true || report.finds >= 3;
    if (a.tool) wearForagingTool(a.tool, deps.entity());   // FORAGE0 14.1: a completed act wears its tool by one
    const before = rank(a.profession);
    book.harvest({
      node: a.node.key, kind: a.harvest, climate: a.info.climate, region: a.info.region, act: report,
      at: Math.floor(deps.nowMs() / 1000),
    }).then((r) => answered(a, r, before), () => {});
  }
  /** A harvest's answer said: the Stores, the XP, a gem, a rank's rise; a refusal in words; a kept one once. */
  function answered(a, r, before) {
    if (r?.ok) {
      const d = r.data;
      const profession = d.track?.profession ?? a?.profession ?? 'herbalism';
      const k = a ? kindOf(a.node) : kinds.find((x) => x.professions.includes(profession));
      hud.toast(`+${d.qty} ${materialCountLabel(d.material, d.qty)} to your Stores`);
      if (d.gem) hud.toast(`...and a ${materialCountLabel(d.gem, 1)}!`);
      hud.toast(`+${d.xp} ${professionName(profession)} XP${a?.clean ? (k?.cleanNote(a, d) ?? '') : ''}`);
      const after = d.track?.rank ?? before;
      if (after > before) {
        hud.toast(`${professionName(profession)} ${before} -> ${after}`);
        const crossed = BANNER_RANKS.filter((b) => before < b && after >= b);
        if (crossed.length) {
          const at = crossed[crossed.length - 1];
          hud.banner(`${rankName(at)} ${k?.title(profession) ?? professionName(profession)}`);
          if (at === 50 || at === 100) hud.toast('A specialisation may be chosen on the Professions page (F5).');
        }
      }
      chipProfession = profession;
      chipLeft = CHIP_S;
      if (a && k?.gone(a.node)) restandOf(a);
      return;
    }
    if (r?.kept) {
      if (!sayKept) { sayKept = true; hud.toast('The counting-house is slow to answer. Your gathering is kept and will be counted.'); }
      return;
    }
    if (r?.error === 'lapsed') { hud.toast('A gathering the counting-house never answered has lapsed with the day.'); return; }
    hud.toast(accountRefusalText(r?.error));
    if (a && r?.error === 'node-taken') restandOf(a);
  }

  return {
    /** A pixel built: its nodes stood. */
    onBuilt(entry) { if (entry) stand(entry); },
    /** A pixel torn down: its batches went with it (they are in its list); forgotten here. */
    onDestroyed(entry) { if (entry) stood.delete(`${entry.px},${entry.py}`); },
    /**
     * PROF2: A DUNGEON ENTERED - `{ id, climate, region, wall, stand, drop }`: DFU's identity for it (MapId & 0xfffff),
     * its ground as this client derives it, the wall its veins stand on (`wall(marker, bearing)`), and its own doors
     * for flats (`stand(archive, record, scale, centers)` -> a batch it owns, `drop(batch)`).
     */
    enterDungeon(d) {
      if (dungeon) this.leaveDungeon();
      if (!d || !Number.isSafeInteger(d.id)) return;
      dungeon = { id: d.id, info: { climate: d.climate, region: d.region }, wall: d.wall, stand: d.stand, drop: d.drop, nodes: [], batches: [] };
      standDungeon();
    },
    /** The dungeon left: its flats dropped (before the dungeon's own teardown frees the rest), an act in it ended. */
    leaveDungeon() {
      const d = dungeon;
      dungeon = null;
      if (!d) return;
      for (const b of d.batches) d.drop(b);
      d.batches = [];
      if (act?.dungeon) { act.act.cancel(); act = null; hud.setMeter(null); }
    },
    /** Whether an act is playing - the host keeps the weapon's swing, and the press ladder, off it. */
    acting: () => !!act,
    /** The tool in the hand for the rig (combat/weaponRig.js actTool): the act's, as DFU's own sprite. */
    handTool: () => (act?.hand ? act.hand(act) : null),
    /** E pressed: a node in reach takes it - an act started, or what it needs said. True when the press was the node's. */
    press() {
      if (act || !target || !(deps.active() || inDungeon()) || book.state.open !== true) return false;
      const plan = planFor(target);
      if (!plan) return false;
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
      if (want.length) book.askPixels(want).then((changed) => { for (const c of changed ?? []) restandAt(c.x, c.y); }, () => {});
      else if (dungeon && now >= pixelsAt && !book.dungeon(dungeon.id)) {   // PROF2: the dungeon's witnessed state
        pixelsAt = now + 5_000;
        const d = dungeon;
        book.askDungeon(d.id).then((changed) => { if (changed && dungeon === d) standDungeon(); }, () => {});
      }
      book.pump((h, r) => answered(null, r, rank(r?.data?.track?.profession ?? 'herbalism')));
      const input = deps.input();
      if (act) {
        const { pos } = deps.eye();
        const v = deps.view();
        const feet = deps.feet();
        act.act.tick(dt, { held: input.held, attack: input.attack, view: v, pos: { x: feet[0], z: feet[2] }, aim: aimAt(pos, act.world, v) });
        const away = Math.hypot(act.world[0] - pos[0], act.world[2] - pos[2]) > (act.node.reach ?? NODE_REACH) + 1;
        const here = act.dungeon ? inDungeon() : deps.active();
        if (act.act.state.cancelled || away || !here) { act = null; hud.setMeter(null); }
        else if (act.act.state.done) finish(act);
        else hud.setMeter(act.act, act.label ?? '');
        hud.setPrompt(null);
      } else {
        target = deps.active() || inDungeon() ? findTarget() : null;
        if ((target?.node.key ?? null) !== targetKey) {
          targetKey = target?.node.key ?? null;
          for (const k of kinds) k.retarget?.();   // a new node: its first harvest first (the herbs before the Basket)
        }
        if (target && input.choice) kindOf(target.node)?.choose?.(target.node);
        if (target) {
          const plan = planFor(target);
          if (plan) hud.setPrompt({ key: deps.keyLabel('Interact'), verb: plan.verb, rest: plan.rest, alt: plan.alt ?? '' });
          else hud.setPrompt(null);
          chipProfession = plan?.profession ?? chipProfession;
          chipLeft = Math.max(chipLeft, 0.5);
        } else hud.setPrompt(null);
      }
      chipLeft = Math.max(0, chipLeft - dt);
      const cp = chipProfession;
      hud.setChip(chipLeft > 0 && cp ? `${professionName(cp)} ${rank(cp)} - ${book.state.today?.[cp] ?? 0} / ${book.state.caps?.harvests ?? 60} today` : null);
      hud.frame(dt);
    },
    /** For the pins and the compass: what stands, and the target. */
    get target() { return target; },
    nodesOf: (px, py) => stood.get(pixelKey(px, py))?.nodes ?? [],
    /** Every stood node of a kind, with its world place (the Prospector's compass - PROF0 3.3).
     *  @param {string} kindId @param {(n: any) => boolean} [pred] */
    stoodOf(kindId, pred = () => true) {
      const out = [];
      for (const s of stood.values()) for (const n of s.nodes) if (n.kind === kindId && pred(n) && !kindOf(n)?.gone(n)) out.push({ node: n, world: worldOf(s, n) });
      return out;
    },
    /** The page's teardown. */
    dispose() { this.leaveDungeon(); for (const s of stood.values()) unstand(s.entry); stood.clear(); act = null; hud.dispose(); },
  };
}
