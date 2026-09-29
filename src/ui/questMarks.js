// @ts-check
// GUIDE5 (2026-09-29, Mac: "How can we set the foundation and improve the
// quest system substantially? Like really modernize it, make it more
// accessible", then, of the Quest Guide arc: "This is your baby. Take
// your time"): THE MARKS - where a quest points, on the held map and the
// enhanced compass.
//
// ONLY WHAT THE PLAYER'S MAP ALREADY KNOWS. A mark stands exactly where
// DFU's own logbook would offer the travel map: a target with `find`
// (ui/questLens.js entryTarget) - a place the entry names, on the player's
// map (the host's canFindPlace, DFU's CanFindPlace: discovered), and not
// the place the player stands in. A named place not yet on the map gets
// no mark; it gets the talk arc's answer instead, the tracker card's "Not
// on your map yet. Ask around for directions." - which is what
// Daggerfall's directions are for (06-Systems/Talk-Arc.md, THE COMPASS
// MARK: a person who knows marks it). Nothing here is the quest
// debugger's knowledge; GUIDE8's Exact tier is that, off by default.
//
// THE MAP marks every active quest's place - the one the tracker follows
// filled, the rest hollow - each answering a hover with a card: the
// quest's title, where, and the time left. THE COMPASS carries one mark,
// the tracker's quest, on the street (the gate's bearing law). The host
// resolves a place to its map pixel (scenes/world.js questPixel); this
// module is PURE and imports nothing of the maps or the quest machine,
// because the HUD reads its switch (GUIDE3's lesson: the HUD stays light).
//
// Not a DFU member. Ledger A (GUIDE5).

import { isEnhanced } from '../systems/uiSkin.js';
import { getPref } from '../systems/uiPrefs.js';
import { timeLeftWords } from './questRail.js';   // the quest faces' one phrase for the time left

/** The switch's prefs key (systems/features.js row `quest-marks`). */
export const MARKS_PREF = 'questMarks';
/** A quest's ink: the journal's gold, drawn as a DIAMOND so it never reads as the selection's amber ring. */
export const QUEST_MARK_CSS = '#c9962c';
/** What the map's legend calls it. */
export const QUEST_LEGEND_TEXT = 'Quest';
/** How near the pointer a quest's mark answers, paper pixels - the location marks' own reach (the raid's, 16): the
 *  mark stands over the place's own. */
export const QUEST_HIT_PX = 16;
/** How far above the place's mark the diamond stands, paper pixels (the raid's blades stand 18 up). */
export const QUEST_MARK_LIFT = 17;

/** Are the marks on? The enhanced skin, the player's switch, and a page (the herald's reason). */
export const marksOn = () => isEnhanced() && !!getPref(MARKS_PREF) && typeof document !== 'undefined';

/**
 * A quest target's place to its map pixel: the lens's `find` (DFU's own find-place payload - present only for a place
 * the player's map holds) resolved the way the held map's goto resolves it (ui/heldMap.js _consumeGotoPlace): the
 * region by name, the place by its map name, the row's longitude and latitude through `toPixel` (formats/mapsFile.js
 * longitudeLatitudeToMapPixel, handed in by the host so this module stays off the map readers). Null for anything it
 * cannot place.
 * @param {any} maps the host's MapsFile
 * @param {any} find
 * @param {(longitude: number, latitude: number) => ({x:number, y:number})} toPixel
 */
export function questPixelOf(maps, find, toPixel) {
  const region = maps?.getRegionByName?.(find?.regionName ?? '');
  const index = region?.mapNameLookup?.get(find?.locationName ?? '');
  const row = index == null ? null : region.mapTable?.[index];
  return row ? toPixel(row.longitude, row.latitude) : null;
}

/**
 * The marks a map draws from the tracker's last look (ui/questTracker.js `views`): one per active quest whose target
 * the player's map holds (`target.find`), at the host's pixel for it - `pixelOf(find)` answers `{x, y}` or null for a
 * place it cannot place. Two quests pointing at one place are one mark (the tracked one's, else the first), which
 * names them all. `trackedId` is the tracker's quest.
 * @param {ReadonlyArray<any>|null|undefined} views
 * @param {string|null} trackedId
 * @param {(find: any) => ({x:number, y:number}|null)} pixelOf
 */
export function questMapMarks(views, trackedId, pixelOf) {
  const byPixel = new Map();
  for (const v of views ?? []) {
    const find = v?.target?.find;
    if (!find) continue;
    let p = null;
    try { p = pixelOf(find); } catch { p = null; }
    if (!p || !Number.isInteger(p.x) || !Number.isInteger(p.y)) continue;
    const key = `${p.x},${p.y}`;
    const tracked = v.id != null && v.id === trackedId;
    const at = byPixel.get(key) ?? { px: p.x, py: p.y, place: v.words?.where || find.locationName, quests: [], tracked: false };
    at.quests.push({ title: String(v.title ?? ''), clockSeconds: v.clockSeconds, tracked });
    at.tracked = at.tracked || tracked;
    byPixel.set(key, at);
  }
  const left = (q) => (Number.isFinite(q.clockSeconds) ? timeLeftWords(q.clockSeconds) : '');
  return [...byPixel.values()].map((m) => {
    const titles = m.quests.map((q) => q.title).filter(Boolean);
    const one = m.quests.length === 1;
    return {
      key: `quest:${m.px},${m.py}`,
      px: m.px,
      py: m.py,
      tracked: m.tracked,
      label: titles.length ? `${titles.join(' / ')} - ${m.place}` : m.place,
      // one quest: its title, where, and the time left; several: how many, where, and each with its time
      tip: one
        ? { title: titles[0] || QUEST_LEGEND_TEXT, lines: [m.place, left(m.quests[0])].filter(Boolean) }
        : { title: `${m.quests.length} quests`, lines: [m.place, ...m.quests.map((q) => (left(q) ? `${q.title} - ${left(q)}` : q.title))] },
    };
  });
}

/**
 * The host's marks, read and checked - [] for none, a throw, or anything a map could not place (the raids' shape,
 * ui/eventMapMarks.js readRaidMarks): each `{key, px, py, x, y, label, tip, tracked}`, x/y the pixel's centre. The
 * tip is the host's; the map bounds it with its own reader.
 * @param {(() => any) | undefined} fn
 * @param {{width:number, height:number}} size
 */
export function readQuestMarks(fn, size) {
  let list = null;
  try { list = typeof fn === 'function' ? fn() : null; } catch { return []; }
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const m of list) {
    if (!m || typeof m !== 'object') continue;
    const { px, py } = m;
    if (!Number.isInteger(px) || !Number.isInteger(py) || px < 0 || py < 0 || px >= size.width || py >= size.height) continue;
    out.push({ key: String(m.key ?? `quest:${px},${py}`), px, py, x: px + 0.5, y: py + 0.5, tracked: !!m.tracked, label: String(m.label ?? '').slice(0, 120), tip: m.tip ?? null });
  }
  return out;
}

/** What the held map repaints its quest marks on: where they stand, which is followed, and what they say. */
export const questMarksKey = (marks) => marks.map((m) => `${m.key}@${m.px},${m.py}|${m.tracked ? 1 : 0}|${m.label}`).join(';');
