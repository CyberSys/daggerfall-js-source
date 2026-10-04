// @ts-check
// ═══════════════════════════════════════════════════════════════════
// OW-FILTER - WHAT THE OVERWORLD SHOWS (bible/06-Systems/Travel-View.md).
//
// The player's ask (2026-09-29): "all the locations show cause a lot of clutters add a filers to the bottom right
// segments". Five groups, each a switch in the view's corner (ui/travelViewHud.js), kept on the device as the path
// mode is:
//   towns      - the places in the grid, their plates (kind 'place')
//   distant    - the far places held at the edge with their distance (kind 'far', not a dungeon)
//   dungeons   - the unfound lairs and the found dungeons far off ('lair', 'far dungeon')
//   enemies    - the roaming bands, the camps and packs, the raiders' sails ('band', 'camp', 'raider ...')
//   travellers - the other players ('traveller ...')
//   gathering  - GATHER-OW: each profession's group of nodes on the land near me ('gather <profession>')
// NEVER HIDDEN, whatever the switches say: the journey's end ('dest', 'target'), anything giving chase (a threat is
// never filtered off the screen), and my party.
// ═══════════════════════════════════════════════════════════════════
import { appStorage } from './appStorage.js';

export const TV_FILTER_GROUPS = Object.freeze(['towns', 'distant', 'dungeons', 'enemies', 'travellers', 'gathering']);
export const TV_FILTER_STORE_KEY = 'dfjs.overworld.filters';

/** The switches' words. */
export const TV_FILTER_TEXT = Object.freeze({
  title: 'Show',
  towns: 'Towns',
  distant: 'Distant',
  dungeons: 'Dungeons',
  enemies: 'Enemies',
  travellers: 'Travellers',
  gathering: 'Gathering',
  tip: (label, on) => `${on ? 'Hide' : 'Show'} ${label.toLowerCase()} on the overworld`,
});

/**
 * The group a mark's kind belongs to, or null for a mark that is never filtered.
 * @param {string} kind
 */
export function markGroup(kind = '') {
  const words = String(kind).split(' ');
  const k = words[0];
  if (words.includes('chase')) return null;   // a threat coming at me stays on the screen
  if (k === 'place') return 'towns';
  if (k === 'far') return words.includes('dungeon') ? 'dungeons' : 'distant';
  if (k === 'lair') return 'dungeons';
  if (k === 'band' || k === 'camp' || k === 'raider') return 'enemies';
  if (k === 'traveller' || k === 'wayfarer') return 'travellers';   // LW3: the living world's parties beside the players
  if (k === 'gather') return 'gathering';   // GATHER-OW
  return null;   // dest, target, party - always drawn
}

let shown = null;
const listeners = new Set();

function read() {
  const all = Object.fromEntries(TV_FILTER_GROUPS.map((g) => [g, true]));
  let raw = null;
  try { raw = appStorage()?.getItem(TV_FILTER_STORE_KEY) ?? null; } catch { raw = null; }
  if (raw) {
    try {
      const v = JSON.parse(raw);
      for (const g of TV_FILTER_GROUPS) if (typeof v?.[g] === 'boolean') all[g] = v[g];
    } catch { /* a bad word: all on */ }
  }
  return all;
}

/** The switches now, { group: on }. */
export function travelViewFilters() {
  shown ??= read();
  return shown;
}

/** Flip one group; kept on the device, told to whoever listens. Returns its new state. */
export function toggleTravelViewFilter(group) {
  if (!TV_FILTER_GROUPS.includes(group)) return false;
  const next = { ...travelViewFilters(), [group]: !travelViewFilters()[group] };
  shown = next;
  try { appStorage()?.setItem(TV_FILTER_STORE_KEY, JSON.stringify(next)); } catch { /* held for the session */ }
  for (const fn of [...listeners]) { try { fn(next); } catch { /* a listener's own fault */ } }
  return next[group];
}

/** Hear a change; returns the way to stop hearing it. */
export function onTravelViewFilters(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Is this mark drawn under these switches? */
export function markShown(m, f = travelViewFilters()) {
  const g = markGroup(m?.kind);
  return g == null || f[g] !== false;
}

/** How many marks of each group there are (drawn or not) - the switches' counts. */
export function countGroups(marks) {
  const n = Object.fromEntries(TV_FILTER_GROUPS.map((g) => [g, 0]));
  for (const m of marks ?? []) { const g = markGroup(m?.kind); if (g) n[g] += 1; }
  return n;
}

/** Pins: back to the device's word. */
export function _resetTravelViewFilters() { shown = null; listeners.clear(); }
