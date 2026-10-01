// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF2 (2026-09-28, Mac: "Go") - THE GATHERING PROFESSIONS IN THE
// STREAMING WORLD, one shell for every kind of node (bible/06-Systems/
// Professions-Arc.md 5, 6, 8, 22, 23; FORAGE0 14). PROF1 built it as
// Herbalism's own host; every gathering profession needs the same shell,
// so the shell is this, and each profession is a KIND in it - PROF1's
// patches (scenes/herbHost.js herbKind), PROF2's veins and boulders
// (scenes/mineHost.js mineKind), PROF4's trees (scenes/treeHost.js
// treeKind), PROF7's bodies (scenes/huntHost.js huntKind - LOOSE nodes,
// each its own place) and PROF8's casts (scenes/fishHost.js fishKind - a
// loose node ahead of the look while the net stands in its water, and the
// day's schools as flats). One prompt, one act, one book. (AUDIT 32 R9:
// this said the trees and the bodies were to come.)
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
//   toasts, the rank's rise in the banner. A node that cannot be worked
//   passes E on to the door, the chest or the foe (AUDIT 29 C1), and
//   when the press opened nothing else the host hands it back: the node
//   says what it needs (VEIN-NEED, sayNeed).
//   THE TOOL'S USE (TOOL-USE). The Wood-Axe, the Pick-Axe, the Sickle,
//   the Basket and the Fishing-Net used from the hotbar or a quick slot
//   are E at a node of their own kind (useTool) - the act, or its need.
//   THE MARKS (NODE-MARKS). Every node standing near the player - a
//   patch, a vein, a boulder, a tree, a school, a body - on the compass
//   in its profession's colour and lit in the world by its glow (marks:
//   the kind's own word on each, its footprint and its reach).
//
// One owner: the host builds it online, and disposes it with the page.
// ═══════════════════════════════════════════════════════════════════
import { utcDayOfMs, pixelKey, parseNodeKey } from '../net/nodeLaw.js';
import { TERRAIN_SIZE } from '../world/terrainSampler.js';
/** A map pixel's side in the scene (metres). */
const PIXEL_M = TERRAIN_SIZE;
import { rankName, professionName } from '../net/professionLaw.js';
import { wearForagingTool } from '../systems/foragingInstall.js';
import { materialCountLabel } from '../systems/profItems.js';
import { accountRefusalText } from '../net/accountClient.js';
import { DEFAULT_ACTIVATION_DISTANCE } from '../player/activate.js';

/** A node answers E within DFU's activation distance, and within this many degrees of the look. */
export const NODE_REACH = DEFAULT_ACTIVATION_DISTANCE;
/** AUDIT 29 C1: 12 degrees - a node near the crosshair, not a quarter of the view (25 took E from a door beside it). */
export const NODE_AIM_DEG = 12;
/** The ranks a banner marks (PROF0 8). */
export const BANNER_RANKS = Object.freeze([25, 50, 75, 100]);
/** The day's chip stays this long after an act or a look (s). */
const CHIP_S = 6;
/** NODE-MARKS: the compass marks every standing node within this many metres of the player (a kind's `reach` past it -
 *  a Prospector's veins, PROF0 3.3), and the glow lights the same; the nearest NODE_MARK_MAX of them, at most. */
export const NODE_MARK_M = 150;
export const NODE_MARK_MAX = 16;
/** NODE-MARKS: a node's glow footprint about its base where its kind names none - metres across (`w`) and up (`h`). */
export const NODE_MARK_SIZE = Object.freeze({ w: 1.8, h: 1.3 });
/** NODE-MARKS: the stood pixels walked for the marks - those within this many metres, past any kind's reach. */
const MARK_WALK_M = 256;

/**
 * VEIN-NEED (FIELD BUGS 2026-09-29h): WHAT E SAYS AT A NODE THAT CANNOT BE WORKED, when the press opened nothing else -
 * the prompt's own words, and where a rank is what is short (the kind's `needsRank`), the player's own rank beside it:
 * "Mine Silver: needs Mining 25 - your Mining is 0". Nothing for a plan that is ready, or one whose prompt already says
 * all there is (a node worked today).
 * @param {any} plan the kind's plan, its `profession` on it @param {(profession: string) => number} rankOf
 */
export function needLine(plan, rankOf) {
  if (!plan || plan.ready || !plan.rest) return '';
  if (plan.rest === 'being counted') return 'That gathering is being counted.';
  const own = Number.isSafeInteger(plan.needsRank) ? ` - your ${professionName(plan.profession)} is ${rankOf(plan.profession)}` : '';
  return `${plan.verb}: ${plan.rest}${own}`;
}

/**
 * GATHER-SAID (the PROF7 merge, 2026-09-30, Mac: "had reports of people not getting materials when using a profession"):
 * A HARVEST'S GOODS IN ONE LINE - the Stores' own, a gem (PROF2) and a second find (PROF4's Resin, PROF7's butchery) beside
 * them: "+1 Bear Hide, a Big Tooth and 2 Raw Meat to your Stores". Each was a line of its own, and with the XP and a rank's
 * rise an answer said five into the four the toasts hold (PROF0 8) - the Stores' line, the oldest, went first.
 * @param {{ qty: number, material: string, gem?: string|null, extra?: string|null, extraQty?: number }} d the answer's data
 */
export function storesLine(d) {
  const goods = [`${d.qty} ${materialCountLabel(d.material, d.qty)}`];
  if (d.gem) { const g = materialCountLabel(d.gem, 1); goods.push(`${/^[aeiou]/i.test(g) ? 'an' : 'a'} ${g}`); }
  if (d.extra) { const n = Number(d.extraQty) || 1; goods.push(`${n > 1 ? `${n} ` : ''}${materialCountLabel(d.extra, n)}`); }
  const said = goods.length > 1 ? `${goods.slice(0, -1).join(', ')} and ${goods[goods.length - 1]}` : goods[0];
  return `+${said} to your Stores`;
}
/** GATHER-SAID: where the Stores are, said with a session's first harvest - the goods are never in the pack.
 *  CLASSIC-PAGES: on either skin, by the Professions key the player has it bound to (`key`, its label; none bound, the
 *  pause menu's page). */
export const storesWhereLine = (key) => `Gathered goods go to your Stores, not your pack: ${key ? `${key} opens your Stores page` : 'the pause menu\'s Stores page'}.`;
/** GATHER-SAID: an act that ended before its end - let go, walked off, a window over it, the dungeon left - nothing asked. */
export const ACT_STOPPED_LINE = 'The gathering stopped before its end - nothing was taken.';
/** A harvest the service did not answer, kept and asked again (net/profBook.js PROF_QUEUE_MS: ten minutes). */
export const KEPT_LINE = 'The counting-house is slow to answer. Your gathering is kept and will be counted.';
/** GATHER-SAID: kept because the account is signed out ('auth', 'no-session') - asked again once there is a session. */
export const KEPT_SIGNED_OUT_LINE = 'You are signed out. Your gathering is kept for ten minutes, and counted once you sign in.';
/** A kept harvest let go unanswered: its ten minutes out, or the UTC day turned under it. */
export const LAPSED_LINE = 'A gathering the counting-house never answered has lapsed - it was not counted.';

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
 * @property {(node: any, ctx: any) => any} plan what E does: `{ harvest, verb, rest, ready, both?, alt? }` - TOOL-USE:
 *   `ctx.tool` the template of a tool whose Use asks (the Sickle the herbs, the Basket the food), null for E
 * @property {(node: any, plan: any, ctx: any) => any} start the act: `{ act, harvest, tool, profession, label, hand?,
 *   heldByUse? }` or `{ refused: text }` - `heldByUse`, TOOL-USE: a Use started it, and the Use holds it (E's level unasked)
 * @property {readonly number[]} [tools] TOOL-USE: the Foraging tools whose Use (the hotbar's, a quick slot's) at this
 *   kind's node is E there
 * @property {(node: any) => void} [choose] the act choice key at this node
 * @property {() => void} [retarget] a new node is targeted
 * @property {(a: any, data: any) => string} cleanNote what a clean act is called in the XP toast
 * @property {(report: any) => string} [actNote] AUDIT 32 P10: what the act's report says in the XP toast, clean or not (a
 *   torn pelt, a true line drawn too quick) - the kind's own word, where cleanNote says only a clean act
 * @property {(profession: string) => string} title a rank's banner word ('Herbalist', 'Miner')
 * @property {(node: any, entry: any) => Array<{ archive: number, record: number, scale: number, centers: number[][] }>} [goneFlatsOf]
 *   PROF4: what a node gone for the day leaves standing (a felled tree's stump)
 * @property {(entry: any, nodes: any[]) => void} [stood] PROF4: a pixel's nodes of this kind stood (the felled trees sunk)
 * @property {(node: any, at: { entry: any, from: number[], tr: number[] }) => void} [felled] PROF4: a node taken on the
 *   service's answer, this session (the tree's fall)
 * @property {(dt: number, ctx: { feet: number[], translation: (entry: any) => number[]|null }) => void} [frame] PROF4: every frame
 * @property {(entry: any) => void} [dropped] PROF4: a pixel torn down
 * @property {(ctx: { entity: any, dungeon: boolean }) => any[]} [looseNodesOf] PROF7: nodes that carry their own place -
 *   `{ key, at: () => number[]|null, lift?, reach? }`, `at` the node's scene place now (Hunting's bodies), above ground
 *   or below; the start's `ask` rides the harvest (the body's foe)
 * @property {() => { n: number, cap: number }} [tally] PROF7: the day's count the chip says, where it is not the
 *   character's harvests against 60 (Hunting's: the account's hides against 30)
 * @property {(data: any) => string} [storesLine] PROF8: the goods' one line in the kind's own words (a haul's species)
 * @property {(data: any, toast: (text: string) => void) => void} [answered] PROF8: a harvest's answer heard - the kind's
 *   own after-step (a trophy into the pack, once)
 * @property {(node: any, ctx: { specs: (profession: string) => any }) => ({ w: number, h: number, reach?: number }|null)} [mark]
 *   NODE-MARKS: the node on the compass and in the glow - its footprint about its base (`w` across, `h` up, metres) and
 *   how far off the compass marks it (`reach`, NODE_MARK_M without one); null for a node never marked. Without it, a
 *   node is marked at NODE_MARK_SIZE while it is not gone for the day.
 * @property {boolean} [marksLoose] NODE-MARKS: its loose nodes are walked for the marks (Hunting's bodies); without it
 *   they are never asked for there (Fishing's cast - the look itself, and its water's check is Foraging's whole world)
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
 *   activeDungeon?: () => boolean, onSettle?: () => void, clear?: (from: number[], to: number[], underground: boolean) => boolean,
 * }} deps `active` - the streaming world's exterior, walking, nothing over it (the host's); `activeDungeon` - a dungeon
 *   entered, walking, nothing over it; `nowMs` the shared clock
 */
export function createGatherHost(deps) {
  const { book, hud, kinds } = deps;
  const kindOf = (node) => kinds.find((k) => k.id === node.kind) ?? null;
  const kindOfProfession = (p) => kinds.find((k) => k.professions.includes(p)) ?? null;
  /** pixel key -> { entry, info, nodes, batches } */
  const stood = new Map();
  let day = utcDayOfMs(deps.nowMs());
  let target = null;          // { node, px, py, info, world }
  let act = null;             // { act, node, harvest, tool, profession, label, px, py, info, world, hand }
  let refreshAt = 0, pixelsAt = 0, targetKey = null;
  let storesSaid = false;     // GATHER-SAID: storesWhereLine said this session
  let passedOn = '';          // VEIN-NEED: what the node the last press passed on needs, until the host hands it back
  let chipLeft = 0;
  let chipProfession = /** @type {string|null} */ (null);
  const _t = [0, 0, 0];
  /** PROF2: the dungeon the player stands in, as a place: its identity and ground, the wall its veins stand on, and its
   *  own doors for the flats (owned with the dungeon's batches). */
  let dungeon = null;
  const inDungeon = () => !!dungeon && !!deps.activeDungeon?.();
  const rank = (profession) => book.track(profession).rank;
  const specs = (profession) => book.track(profession).specs ?? { 50: null, 100: null };
  /** NODE-MARKS: the marks' one list and the records it is refilled from; what a kind's mark is asked with */
  const _marks = [], _markPool = [];
  const markCtx = { specs };

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
    if (!entry?.samples || !entry.tilemap) return;
    const key = `${entry.px},${entry.py}`;
    unstand(entry);
    // AUDIT 30 A7: a pixel that stands no nodes - the switch shut, no ground to read, the witnesses' other word - stands
    // its forest whole: the day's turn under a shut switch left yesterday's felled tree sunk, and its herbs standing
    const bare = () => { for (const k of kinds) k.stood?.(entry, []); };
    const info = book.state.open === true ? deps.pixelInfo(entry.px, entry.py) : null;
    const rec = { entry, info, nodes: [], batches: [] };
    stood.set(key, rec);
    if (!info) { bare(); return; }
    const fact = book.pixel(entry.px, entry.py);
    const confirmed = fact?.state === 'confirmed' || fact?.state === 'disputed';
    // a pixel the witnesses confirmed as something else stands nothing: nothing here could be gathered
    if (confirmed && (fact.climate !== info.climate || fact.region !== info.region)) { bare(); return; }
    const ctx = { entry, px: entry.px, py: entry.py, day, info, confirmed, specs, book };
    rec.nodes = kinds.flatMap((k) => k.nodesOf(ctx).map((n) => ({ ...n, kind: k.id })));
    for (const k of kinds) k.stood?.(entry, rec.nodes.filter((n) => n.kind === k.id));   // PROF4: the felled trees sunk
    /** archive -> `${record}:${scale}` -> centres */
    const groups = new Map();
    for (const n of rec.nodes) {
      const k = kindOf(n);
      if (!k) continue;
      // gone for the day: nothing, or what it leaves (PROF4: a felled tree's stump)
      for (const f of k.gone(n) ? (k.goneFlatsOf?.(n, entry) ?? []) : k.flatsOf(n)) {
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
    if (!d || d.id === null) return;   // AUDIT 32 H2: a dungeon with no identity stands no veins
    const gen = d.gen = (d.gen | 0) + 1;   // AUDIT 29 C7: the newest stand alone keeps its flats (two in flight drew twice)
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
        if (dungeon !== d || d.gen !== gen) { if (b) d.drop(b); return; }   // left, entered another, or stood again, during the await
        if (b) d.batches.push(b);
      }
    }
  }
  /** Every built pixel stood again - the day's turn, the state first read (a pixel built before it stood nothing). */
  const restandAll = () => { for (const entry of deps.built().values()) stand(entry); standDungeon(); };
  const restandAt = (px, py) => { const s = stood.get(pixelKey(px, py)); if (s) stand(s.entry); };
  /** A node's place stood again: its pixel's, or the dungeon's. */
  const restandOf = (a) => (a.dungeon ? standDungeon() : restandAt(a.px, a.py));
  /** AUDIT 29 C4: the same, by the node's key alone (a kept harvest answered through the pump). */
  function restandNode(key) {
    const n = parseNodeKey(key);
    if (!n || n.kind === 'body' || n.kind === 'haul') return;   // PROF7: a body stands nothing of the host's (it is DFU's corpse); PROF8: nor a haul
    if (n.kind === 'dvein') { if (dungeon?.id === n.dungeon) standDungeon(); } else restandAt(n.x, n.y);
  }

  // ─── THE TARGET ────────────────────────────────────────────────────
  const worldOf = (s, n) => {
    const tr = deps.pixelTranslation(s.entry.px, s.entry.py, _t);
    return [n.local[0] + tr[0], n.local[1] + tr[1] + (n.lift ?? 0.3), n.local[2] + tr[2]];
  };
  /** The node in reach nearest the look - TOOL-USE: of `own`'s kinds alone, for a tool's Use. */
  function findTarget(own = kinds) {
    const { pos, dir } = deps.eye();
    const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    let best = null, bestAng = NODE_AIM_DEG;
    const reachBox = NODE_REACH + 1;
    // PROF2: underground the dungeon's nodes, in its own space; above ground the streamed pixels'
    const under = inDungeon();
    /** @type {Array<{ nodes: any[], entry: any, info: any, loose?: boolean, at: (n: any) => number[]|null }>} */
    const places = under ? [{ nodes: dungeon.nodes, entry: null, info: dungeon.info, at: (n) => [n.local[0], n.local[1] + (n.lift ?? 0.3), n.local[2]] }]
      : nearPixels(pos, reachBox).map((s) => ({ nodes: s.nodes, entry: s.entry, info: s.info, at: (n) => worldOf(s, n) }));
    // PROF7: the loose nodes - each its own place (Hunting's bodies), above ground or below
    for (const k of own) {
      if (!k.looseNodesOf) continue;
      const nodes = k.looseNodesOf({ entity: deps.entity(), dungeon: under }).map((n) => ({ ...n, kind: k.id }));
      if (nodes.length) places.push({ nodes, entry: null, info: null, loose: true, at: looseAt });   // AUDIT 32 H9: its own place names no ground
    }
    for (const s of places) {
      if (!s.nodes.length) continue;
      for (const n of s.nodes) {
        const k = kindOf(n);
        if (!k || !own.includes(k) || k.gone(n)) continue;
        const w = s.at(n);
        if (!w) continue;
        const dx = w[0] - pos[0], dy = w[1] - pos[1], dz = w[2] - pos[2];
        // AUDIT 29 C1: in reach in three dimensions too (a floor above, a pit below), not the ground plane alone; AUDIT 32
        // H7: a loose node (a body on the ground) by its straight distance from the eye, as DFU's corpse is reached - the
        // eye's height below it read against its reach dropped a body a metre downhill, or under a rider
        const reach = n.reach ?? NODE_REACH;
        if (s.loose ? Math.hypot(dx, dy, dz) > reach : Math.hypot(dx, dz) > reach || Math.abs(dy) > reach) continue;
        const d = Math.hypot(dx, dy, dz) || 1;
        const cos = (dx * dir[0] + dy * dir[1] + dz * dir[2]) / (d * dl);
        const ang = Math.acos(Math.max(-1, Math.min(1, cos))) * (180 / Math.PI);
        if (ang < bestAng) {
          bestAng = ang;
          // the node's bearing below the eye (AUDIT 32 H7: a body under the player's feet asks them to step back)
          best = { node: n, px: s.entry?.px ?? null, py: s.entry?.py ?? null, dungeon: s.loose ? under : !s.entry, loose: !!s.loose, info: s.info, world: w, pitch: Math.atan2(dy, Math.hypot(dx, dz)) * (180 / Math.PI) };
        }
      }
    }
    // AUDIT 29 C1: and seen - one ray to the chosen node through the place's collider (a vein through a dungeon's wall, a
    // patch behind a rock, is no target)
    if (best && deps.clear && !deps.clear(pos, best.world, best.dungeon)) return null;
    return best;
  }
  /** AUDIT 29 C10: the stood pixels whose ground is within `r` of `pos` - the player's and its edge neighbours' - never
   *  every streamed pixel's every node, every frame. */
  function nearPixels(pos, r) {
    const out = [];
    for (const s of stood.values()) {
      const tr = deps.pixelTranslation(s.entry.px, s.entry.py, _t);
      const cx = Math.max(tr[0], Math.min(tr[0] + PIXEL_M, pos[0])), cz = Math.max(tr[2], Math.min(tr[2] + PIXEL_M, pos[2]));
      if (Math.hypot(cx - pos[0], cz - pos[2]) <= r) out.push(s);
    }
    return out;
  }
  /** AUDIT 29 C6: the act's node where it stands NOW - the floating origin moves the scene under an act (a recentre
   *  shifted it 819 m and the act ended as "walked off"); null once its pixel is gone. */
  function actWorld(a) {
    if (a.loose) {
      // PROF7: a body where it lies now - found again by its key among its kind's, so one its pool let go (despawned, a
      // load, stood up again) ends the act
      const now = kindOf(a.node)?.looseNodesOf?.({ entity: deps.entity(), dungeon: !!a.dungeon }).find((n) => n.key === a.node.key);
      return now ? looseAt(now) : null;
    }
    if (a.dungeon) return [a.node.local[0], a.node.local[1] + (a.node.lift ?? 0.3), a.node.local[2]];
    const s = stood.get(pixelKey(a.px, a.py));
    return s ? worldOf(s, a.node) : null;
  }
  /** PROF7: a loose node's place now, lifted for the look - null once it is gone. */
  function looseAt(n) {
    const w = n.at?.();
    return Array.isArray(w) ? [w[0], w[1] + (n.lift ?? 0.3), w[2]] : null;
  }
  /** TOOL-USE: `tool` - the template whose Use asks, null for E. */
  const ctxFor = (t, tool = null) => ({ entity: deps.entity(), info: t.info, book, rank, specs, keyLabel: deps.keyLabel, pitch: t.pitch ?? null, tool });
  const planFor = (t, tool = null) => kindOf(t.node)?.plan(t.node, ctxFor(t, tool)) ?? null;

  // ─── THE ACT ───────────────────────────────────────────────────────
  /** The act at `t` started - true - or its checks' refusal said. TOOL-USE: `tool`, the template whose Use started it. */
  function start(t, plan, tool = null) {
    const k = kindOf(t.node);
    const a = k?.start(t.node, plan, ctxFor(t, tool));
    if (!a) return false;
    if (a.refused) { hud.toast(a.refused); return false; }
    act = { ...a, node: t.node, px: t.px, py: t.py, dungeon: t.dungeon, loose: !!t.loose, info: t.info, world: t.world };
    chipProfession = a.profession;
    chipLeft = CHIP_S;
    return true;
  }
  function finish(a) {
    const report = a.act.report();
    act = null;
    hud.setMeter(null);
    if (!report) return;
    a.report = report;   // AUDIT 32 P10: the act's own words, said with its answer
    a.clean = report.clean === true || report.finds >= 3;
    if (a.tool) wearForagingTool(a.tool, deps.entity());   // FORAGE0 14.1: a completed act wears its tool by one
    const before = rank(a.profession);
    book.harvest({
      node: a.node.key, kind: a.harvest, climate: a.info?.climate ?? null, region: a.info?.region ?? null, act: report,   // PROF7: a body names no ground
      at: Math.floor(deps.nowMs() / 1000), ...(a.ask ?? {}),
    }).then((r) => answered(a, r, before), () => {});
  }
  /** A harvest's answer said: the Stores, the XP, a gem, a rank's rise; a refusal in words; a kept one once. */
  function answered(a, r, before, nodeKeyOf = null) {
    if (r?.elsewhere) return;   // AUDIT 32 B5: another character's answer, heard after a switch - theirs, unsaid here
    if (r?.ok) {
      const d = r.data;
      const profession = d.track?.profession ?? a?.profession ?? 'herbalism';
      const k = a ? kindOf(a.node) : kindOfProfession(profession);
      hud.toast(k?.storesLine ? k.storesLine(d) : storesLine(d), { keep: true });   // GATHER-SAID: the goods in one line, outlasting the rest; PROF4's Resin, PROF7's butchery in it; PROF8's species
      if (!storesSaid) { storesSaid = true; hud.toast(storesWhereLine(deps.keyLabel?.('Professions') ?? '')); }
      const note = a && k?.actNote ? k.actNote(a.report) : a?.clean ? (k?.cleanNote(a, d) ?? '') : '';   // AUDIT 32 P10
      hud.toast(`+${d.xp} ${professionName(profession)} XP${note}`);
      const after = d.track?.rank ?? before;
      if (after > before) {
        hud.toast(`${professionName(profession)} ${before} -> ${after}`);
        const crossed = BANNER_RANKS.filter((b) => before < b && after >= b);
        if (crossed.length) {
          const at = crossed[crossed.length - 1];
          hud.banner(`${rankName(at)} ${k?.title(profession) ?? professionName(profession)}`);
          if (at === 50 || at === 100) hud.toast('A specialisation may be chosen on the Professions page (the pause menu\'s Stats).');
        }
      }
      try { k?.answered?.(d, (t) => hud.toast(t)); } catch (e) { console.warn('[gather] an answer', e); }   // PROF8: a trophy into the pack
      chipProfession = profession;
      chipLeft = CHIP_S;
      if (a && !a.loose && k?.gone(a.node)) {   // PROF7: a body stands nothing of the host's to stand again
        // PROF4: the node's fall, seen by the one who worked it (a felled tree tips away from them)
        // AUDIT 30 A5: the node as its pixel stands NOW (stood again under the ask, its wood rebuilt, the act's node is
        // another's flat), and a fall that fails is the fall's alone - the pixel stands again whatever it did
        const s = a.dungeon ? null : stood.get(pixelKey(a.px, a.py));
        const now = s?.nodes.find((x) => x.key === a.node.key) ?? null;
        if (now && k.felled) {
          try { Promise.resolve(k.felled(now, { entry: s.entry, from: deps.eye().pos, tr: deps.pixelTranslation(a.px, a.py, [0, 0, 0]) })).catch((e) => console.warn('[gather] a fall', e)); } catch (e) { console.warn('[gather] a fall', e); }
        }
        restandOf(a);
      } else if (!a && nodeKeyOf) restandNode(nodeKeyOf);
      return;
    }
    // GATHER-SAID: every kept act says so (a flag once a session left the second slow answer silent), and why
    if (r?.kept) { hud.toast(r.error === 'auth' || r.error === 'no-session' ? KEPT_SIGNED_OUT_LINE : KEPT_LINE); return; }
    if (r?.error === 'lapsed') { hud.toast(LAPSED_LINE); return; }
    hud.toast(accountRefusalText(r?.error));
    if (a && !a.loose && r?.error === 'node-taken') restandOf(a);
  }

  return {
    /** A pixel built: its nodes stood. */
    onBuilt(entry) { if (entry) stand(entry); },
    /** A pixel torn down: its batches went with it (they are in its list); forgotten here. */
    onDestroyed(entry) {
      if (!entry) return;
      stood.delete(`${entry.px},${entry.py}`);
      for (const k of kinds) k.dropped?.(entry);   // PROF4: a fall or logs under way on it went with its batches
    },
    /**
     * PROF2: A DUNGEON ENTERED - `{ id, climate, region, wall, stand, drop }`: DFU's identity for it (MapId & 0xfffff),
     * its ground as this client derives it, the wall its veins stand on (`wall(marker, bearing)`), and its own doors
     * for flats (`stand(archive, record, scale, centers)` -> a batch it owns, `drop(batch)`).
     */
    enterDungeon(d) {
      if (dungeon) this.leaveDungeon();
      if (!d) return;
      // AUDIT 32 H2: a dungeon with no identity (a client's hash - every spawned dungeon) is still one the host stands in:
      // no veins, and its loose nodes found (a body names no ground); it told the host nothing, and no body was a node
      const known = Number.isSafeInteger(d.id) && Number.isSafeInteger(d.climate) && Number.isSafeInteger(d.region);
      dungeon = { id: known ? d.id : null, info: known ? { climate: d.climate, region: d.region } : null, wall: d.wall, stand: d.stand, drop: d.drop, nodes: [], batches: [] };
      standDungeon();
    },
    /** The dungeon left: its flats dropped (before the dungeon's own teardown frees the rest), an act in it ended. */
    leaveDungeon() {
      const d = dungeon;
      dungeon = null;
      if (!d) return;
      for (const b of d.batches) d.drop(b);
      d.batches = [];
      if (act?.dungeon) { act.act.cancel(); act = null; hud.setMeter(null); hud.toast(ACT_STOPPED_LINE); }   // GATHER-SAID
    },
    /** Whether an act is playing - the host keeps the weapon's swing, and the press ladder, off it. */
    acting: () => !!act,
    /** The tool in the hand for the rig (combat/weaponRig.js actTool): the act's, as DFU's own sprite. */
    handTool: () => (act?.hand ? act.hand(act) : null),
    /** E pressed: a node in reach takes it - an act started. True when the press was the node's. */
    press() {
      passedOn = '';
      if (act) return true;   // AUDIT 29 D3: a press during an act is the act's - never a door's or a loot's behind it
      if (!target || !(deps.active() || inDungeon()) || book.state.open !== true) return false;
      const plan = planFor(target);
      // AUDIT 32 H8: a plan that opens something of its own (a body's search, by its loot's key) takes the press
      if (plan?.open) { plan.open(); return true; }
      // AUDIT 29 C1: a node that cannot be worked takes no press - the press goes on to the door, the chest or the foe it
      // was meant for. VEIN-NEED: what it needs is kept, for the host to hand back if the press opened nothing else
      if (!plan || !plan.ready) { passedOn = needLine(plan, rank); return false; }
      start(target, plan);
      return true;
    },
    /**
     * VEIN-NEED (FIELD BUGS 2026-09-29h): the press a node passed on opened nothing else - no door, no chest, no foe -
     * so the node says what it needs: the host calls this at the foot of its activation ladder, for the E press that
     * asked `press` first. PROF1's "an act started, or what it needs said", C1's order kept. True when it said a line.
     */
    sayNeed() {
      const line = passedOn;
      passedOn = '';
      if (!line) return false;
      hud.toast(line);
      return true;
    },
    /**
     * TOOL-USE (FIELD BUGS 2026-09-30b #2): A PROFESSION TOOL'S USE - the hotbar's or a quick slot's, nothing over the
     * world - IS E AT A NODE OF THE TOOL'S OWN KIND: the Wood-Axe's a tree, the Pick-Axe's a vein or a boulder (above
     * ground or below), the Sickle's a patch's herbs and the Basket's its food (whatever the choice key picked, which is
     * left as it was), the Fishing-Net's the cast. The act starts, or what the node needs is said at once - no door stands
     * behind a Use to pass it on to. 'started' - an act started; 'taken' - the node's, nothing started (its need or its
     * checks said, or an act already playing - AUDIT 29 D3's law for E); false - no node of its kind in reach, or no world
     * to reach (a window over it - the pack's own Use - or the professions shut): Foraging's side says the way.
     * @param {number} templateIndex @returns {false|'started'|'taken'}
     */
    useTool(templateIndex) {
      const own = kinds.filter((k) => k.tools?.includes(templateIndex));
      if (!own.length || !(deps.active() || inDungeon()) || book.state.open !== true) return false;
      if (act) return 'taken';
      const t = findTarget(own);
      if (!t) return false;
      const plan = planFor(t, templateIndex);
      if (!plan?.ready) { const line = needLine(plan, rank); if (line) hud.toast(line); return 'taken'; }
      return start(t, plan, templateIndex) ? 'started' : 'taken';
    },
    /** Escape: the act ends, nothing lost. True when there was one. */
    cancel() { if (!act) return false; act.act.cancel(); act = null; hud.setMeter(null); return true; },
    /** Every frame the host is in the streaming world. */
    tick(dt) {
      const now = deps.nowMs();
      // the state: read on arrival, at a new character and at the UTC day's turn; kept withdrawals settled on every good
      // read (AUDIT 29 C4: once a session, a withdrawal kept mid-session waited for a reload)
      if (book.stale() && now >= refreshAt) {
        refreshAt = now + 30_000;
        // PROF5 (FOUND): a kept craft settles too, not only beside a kept withdrawal
        book.refresh().then((r) => { if (r?.ok) { refreshAt = 0; restandAll(); if (book.pendingWithdrawals || book.pendingCrafts) deps.onSettle?.(); } }, () => {});
      }
      const d = utcDayOfMs(now);
      if (d !== day) { day = d; restandAll(); }
      if (book.state.open !== true) {
        if (act) { act.act.cancel(); act = null; }   // AUDIT 29 C5: shut mid-act - the act ends (the swing was held off, the tool in the hand)
        hud.setPrompt(null); hud.setMeter(null); hud.setChip(null); hud.frame(dt); return;
      }
      // the streamed pixels' witnessed states - a pixel that changed stands again
      const want = now >= pixelsAt ? [...stood.values()].map((s) => [s.entry.px, s.entry.py]).filter(([x, y]) => !book.pixel(x, y)) : [];
      if (want.length) pixelsAt = now + 5_000;
      if (want.length) book.askPixels(want).then((changed) => { for (const c of changed ?? []) restandAt(c.x, c.y); }, () => {});
      else if (dungeon && dungeon.id !== null && now >= pixelsAt && !book.dungeon(dungeon.id)) {   // PROF2: the dungeon's witnessed state
        pixelsAt = now + 5_000;
        const d = dungeon;
        book.askDungeon(d.id).then((changed) => { if (changed && dungeon === d) standDungeon(); }, () => {});
      }
      // AUDIT 29 C4: a kept harvest's answer said with the rank it rose from (the book hands it - the track moved before
      // this call), and its node stood again by its key
      book.pump((h, r, before) => answered(null, r, before ?? rank(r?.data?.track?.profession ?? 'herbalism'), h?.node));
      // PROF4: the kinds' own frame - a felled tree's fall, the logs at its foot
      const feetNow = deps.feet();
      for (const k of kinds) k.frame?.(dt, { feet: feetNow, translation: (e) => (stood.get(pixelKey(e.px, e.py))?.entry === e ? deps.pixelTranslation(e.px, e.py, [0, 0, 0]) : null) });
      const input = deps.input();
      if (act) {
        const { pos } = deps.eye();
        const v = deps.view();
        const feet = deps.feet();
        const w = actWorld(act);
        act.world = w ?? act.world;
        const gone = act.loose ? !w : !act.dungeon && !stood.has(pixelKey(act.px, act.py));   // its pixel torn down under it; PROF7: its body let go
        act.act.tick(dt, { held: input.held || act.heldByUse === true, attack: input.attack, view: v, pos: { x: feet[0], z: feet[2] }, aim: aimAt(pos, act.world, v) });   // TOOL-USE: a hold the Use made
        const away = gone || Math.hypot(act.world[0] - pos[0], act.world[2] - pos[2]) > (act.node.reach ?? NODE_REACH) + 1;
        const here = act.dungeon ? inDungeon() : deps.active();
        if (act.act.state.cancelled || away || !here) { act = null; hud.setMeter(null); hud.toast(ACT_STOPPED_LINE); }   // GATHER-SAID: said, never only the meter gone (Escape ends it in `cancel`, unsaid)
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
      const tally = (cp && kindOfProfession(cp)?.tally?.()) || { n: book.state.today?.[cp] ?? 0, cap: book.state.caps?.harvests ?? 60 };   // PROF7: Hunting's day is the account's
      hud.setChip(chipLeft > 0 && cp ? `${professionName(cp)} ${rank(cp)} - ${tally.n} / ${tally.cap} today` : null);
      hud.frame(dt);
    },
    /** For the pins and the compass: what stands, and the target. */
    get target() { return target; },
    nodesOf: (px, py) => stood.get(pixelKey(px, py))?.nodes ?? [],
    /** Every stood node of a kind, with its world place (the Prospector's compass - PROF0 3.3).
     *  @param {string} kindId @param {(n: any) => boolean} [pred] */
    stoodOf(kindId, pred = () => true, near = null) {
      const out = [];
      // AUDIT 29 C10: `near` ({ pos, r }) - the pixels within r alone (the compass asked every node every frame)
      for (const s of near ? nearPixels(near.pos, near.r) : stood.values()) for (const n of s.nodes) if (n.kind === kindId && pred(n) && !kindOf(n)?.gone(n)) out.push({ node: n, world: worldOf(s, n) });
      return out;
    },
    /**
     * NODE-MARKS (2026-10-01, Mac: "Any profession node, like herbs, should appear on the compass. The node itself
     * should also stand out with a detailed slight glow"): THE NODES STANDING NEAR `pos` - underground the dungeon's,
     * above ground the stood pixels', and the loose ones (Hunting's bodies) where they lie - each its kind's mark says
     * stands within its reach: `{ key, profession, at: [x, y, z] its base in the scene, w, h, d, reach }`, `d` its
     * distance on the ground, nearest first, at most NODE_MARK_MAX. One list, refilled each call (AUDIT WB D10's law): the
     * compass and the glow read it at once and keep none of it. The professions shut, none.
     * @param {number[]} pos the player's feet, in the place's own frame
     */
    marks(pos) {
      const out = _marks;
      out.length = 0;
      if (book.state.open !== true || !Array.isArray(pos)) return out;
      let used = 0;
      const add = (k, n, x, y, z) => {
        const m = k.mark ? k.mark(n, markCtx) : (k.gone(n) ? null : NODE_MARK_SIZE);
        if (!m) return;
        const reach = m.reach ?? NODE_MARK_M;
        const d = Math.hypot(x - pos[0], z - pos[2]);
        if (!(d <= reach)) return;
        const r = _markPool[used] ??= { key: '', profession: '', at: [0, 0, 0], w: 0, h: 0, d: 0, reach: 0 };
        used++;
        r.key = n.key; r.profession = k.professions[0]; r.at[0] = x; r.at[1] = y; r.at[2] = z; r.w = m.w; r.h = m.h; r.d = d; r.reach = reach;
        out.push(r);
      };
      const under = !!dungeon;
      if (under) {
        for (const n of dungeon.nodes) { const k = kindOf(n); if (k) add(k, n, n.local[0], n.local[1], n.local[2]); }
      } else {
        for (const s of nearPixels(pos, MARK_WALK_M)) {
          const tr = deps.pixelTranslation(s.entry.px, s.entry.py, _t);
          const tx = tr[0], ty = tr[1], tz = tr[2];
          for (const n of s.nodes) { const k = kindOf(n); if (k) add(k, n, n.local[0] + tx, n.local[1] + ty, n.local[2] + tz); }
        }
      }
      for (const k of kinds) {
        if (!k.looseNodesOf || !k.marksLoose) continue;
        for (const n of k.looseNodesOf({ entity: deps.entity(), dungeon: under })) {
          const w = n.at?.();
          if (Array.isArray(w)) add(k, n, w[0], w[1], w[2]);
        }
      }
      out.sort((a, b) => a.d - b.d);
      if (out.length > NODE_MARK_MAX) out.length = NODE_MARK_MAX;
      return out;
    },
    /** The page's teardown. */
    dispose() { this.leaveDungeon(); for (const s of stood.values()) unstand(s.entry); stood.clear(); act = null; hud.dispose(); },
  };
}
