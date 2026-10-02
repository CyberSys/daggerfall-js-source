// @ts-check
// ═══════════════════════════════════════════════════════════════════
// NEMESIS (2026-10-02, Mac: "the ability for these enemies that kill you, or a very small chance to flee at low
// health. These enemies can return at a later time stronger, with a new name, a chance of more loot and taunt the
// player. This is our own similar nemesis system").
//
// WHO BECOMES ONE. A SPECIAL foe - an elite (systems/eliteFoes.js), a LOOT7 champion (systems/champions.js) or a
// nemesis already - that
//   - lands the blow that KILLS the player (melee or an arrow: the blows the struck seam names, formulas.js), or
//   - at under a fifth of its health, wins a small roll (NEMESIS_FLEE_CHANCE; a nemesis already, more) and RUNS -
//     and is out of reach before its run is spent (scenes/exteriorFoes.js: the open world's foes).
// Never under level 3, the city watch, an ally, a quest's foe or a summons - LOOT7's floor and exclusions.
//
// WHAT IT BECOMES. A record per character (below): a given name from DFU's own name banks (characters/nameHelper.js,
// drawn on a seeded side-stream so the shared DFRandom never moves) and an EPITHET that says what it did - "Grushnak
// the Butcher" for a kill, "Grushnak the Scarred" for an escape. Every deed after the first RANKS IT UP (to
// NEMESIS_MAX_RANK) and gives it a NEW epithet; a foe that killed you stands in the world under its new name at once.
//
// ITS RETURN. One to three days later on the character's own clock, an open-world encounter roll may stand it instead
// (NEMESIS_RETURN_CHANCE a roll, one nemesis at a time): its own kind and sprite, its trait (a champion's) or its
// glow (an elite's, online), and over that its rank - more health, harder blows, a class foe a higher level. In
// sight and near, it TAUNTS - a line that knows what it did and to whom. Slain, it carries a nemesis's drop (gold by
// level and rank, a chance of Magic, Rare and Legendary gear that grows with the rank, a Rare always from rank 3) and
// is gone for good. Run from, it slips away and comes back later.
//
// KEPT TWICE. In the save (the per-mod slot, systems/modSaveData.js - it travels with an online character) AND in the
// app's own storage under the character's id (systems/characterId.js), because an offline death ends the run with
// nothing saved and a death is exactly what makes a nemesis. Each record carries a revision; the two are merged by
// it, so a reload of an older save never forgets a nemesis made since, nor raises one already slain.
//
// OFF IS DFU EXACTLY: with the loot-rarity row off (the Loot arc's switch, as LOOT7's), no nemesis is made, flees or
// returns.
//
// ONLINE: a nemesis is its character's own memory; a returning one is my own foe, streamed as any - its kind, health,
// trait, glow and (NEMESIS-WIRE) its NAME, the foe record's `nm`, so every puppet is called what its owner calls it.
//
// NEMESIS-CARD: everything a nemesis says or does is an EVENT (below) - its portrait, its name, its words - which the
// enhanced skin draws as a card (ui/nemesisCard.js, through systems/nemesisVoice.js) and the classic says as a line.
// NEMESIS-HARM: a death no blow names (a spell, a lingering effect, a poison) goes to the foe whose harm last reached
// the player (systems/harmMark.js). NEMESIS-DUNGEON: a dungeon foe of mine alone may run and escape too.
// NEMESIS-PAGE: the pause menu's Stats rail lists them (ui/nemesisPage.js).
// ═══════════════════════════════════════════════════════════════════

import { lootRarityOn } from './lootRarity.js';
import { registerPlayerBlowLanded } from './sigilSetPowers.js';
import { registerPlayerHurtListener } from '../characters/playerEntity.js';   // NEMESIS-HARM: a death no blow names
import { registerPlayerStruckListener } from '../combat/formulas.js';   // NEMESIS-HARM: a foe's blow leaves its mark (its poison's ticks come later)
import { markPlayerHarm, playerHarmMark, HARM_MARK_STRUCK_MS } from './harmMark.js';
import { playerDoor } from './playerDoor.js';
import { registerModSaveData } from './modSaveData.js';
import { appStorage } from './appStorage.js';
import { characterIdOf, mintCharacterId } from './characterId.js';
import { ownMinutes } from './worldTick.js';
import { tieredGear } from './eliteFoes.js';
import { goldStack } from './inventory.js';
import { enemyDisplayName, ENEMY_BASICS } from '../characters/enemyBasics.js';
import { KNIGHT_CITY_WATCH, MOBILE_TYPES } from '../characters/mobileTypes.js';
import { firstName, monsterName, BANK_TYPES, GENDERS } from '../characters/nameHelper.js';
import { getSeed, setSeed, srand } from '../formats/dfRandom.js';

// ── the numbers ─────────────────────────────────────────────────────
/** A nemesis is a foe of this level or more (LOOT7's champion floor, ELITE-FLOOR's). */
export const NEMESIS_MIN_LEVEL = 3;
/** How many living nemeses a character keeps; a new one past it replaces the weakest, oldest. */
export const NEMESIS_MAX = 5;
/** The highest rank a nemesis climbs to. */
export const NEMESIS_MAX_RANK = 5;
/** Under this share of its health a special foe may run - once, the first time it falls under. */
export const NEMESIS_FLEE_HEALTH = 0.2;
/** ...and runs on this roll: a "very small chance" for an elite or a champion, a better one for a nemesis already. */
export const NEMESIS_FLEE_CHANCE = 0.05;
export const NEMESIS_FLEE_CHANCE_NEMESIS = 0.15;
/** How long a fleeing foe runs (the motor's flee, characters/enemyMotor.js) - out of reach when it ends, it escapes. */
export const NEMESIS_FLEE_SECONDS = 8;
/** ...or the moment it is this far from the player. */
export const NEMESIS_ESCAPE_DISTANCE = 45;
/** ...or its run spent past this far (metres). Spent nearer - chased down - it is CORNERED: it turns and fights. */
export const NEMESIS_ESCAPE_NEAR = 20;
/** How many slain nemeses a character's page keeps (the newest); older ones, and the forgotten, leave a tombstone. */
export const NEMESIS_FALLEN_MAX = 12;
/** How many tombstones are kept - each one id and a revision, so an older save never raises what was put down. */
export const NEMESIS_TOMBS_MAX = 200;
/** It comes back between one and three days later, on the character's own clock. */
export const NEMESIS_RETURN_MIN_MINUTES = 1440;
export const NEMESIS_RETURN_MAX_MINUTES = 4320;
/** A due nemesis takes an open-world encounter roll this often. */
export const NEMESIS_RETURN_CHANCE = 0.5;
/** Out in the world and gone unfought (outrun, a load, a sweep), it waits this long and comes again. */
export const NEMESIS_LOST_MINUTES = 360;
/** Its rank over what it was: health and blows per rank, and a class foe's level per rank. */
export const NEMESIS_HEALTH_PER_RANK = 0.25;
export const NEMESIS_DAMAGE_PER_RANK = 0.1;
export const NEMESIS_LEVEL_PER_RANK = 2;
/** In sight and this near (metres), a returning nemesis taunts - once a return. */
export const NEMESIS_TAUNT_DISTANCE = 25;
/** Its drop on its death - over its kind's own loot. */
export const NEMESIS_LOOT = Object.freeze({
  goldPerLevel: [15, 40],   // times the rank
  magicChance: 0.5,
  rareChance: 0.15, rarePerRank: 0.1,
  legendaryChance: 0.03, legendaryPerRank: 0.03,
  rareFromRank: 3,          // a Rare always, from this rank
});
/** The save slot's vendor, and the app storage's key. */
export const NEMESIS_SAVE = 'Nemesis';
export const NEMESIS_STORE_PREFIX = 'dagger.nemesis.';
/** How many deeds a record remembers. */
const HISTORY_MAX = 12;

/** Kinds that do not speak - beasts and the mindless: they bare their teeth where another would taunt. */
const VOICELESS = new Set([
  MOBILE_TYPES.Rat, MOBILE_TYPES.GiantBat, MOBILE_TYPES.GrizzlyBear, MOBILE_TYPES.SabertoothTiger, MOBILE_TYPES.Spider,
  MOBILE_TYPES.Slaughterfish, MOBILE_TYPES.SkeletalWarrior, MOBILE_TYPES.Zombie, MOBILE_TYPES.GiantScorpion,
  MOBILE_TYPES.Dragonling, MOBILE_TYPES.Dragonling_Alternate, MOBILE_TYPES.FireAtronach, MOBILE_TYPES.IronAtronach,
  MOBILE_TYPES.FleshAtronach, MOBILE_TYPES.IceAtronach, MOBILE_TYPES.Dreugh,
]);
export const nemesisSpeaks = (mobileType) => !VOICELESS.has(mobileType);

// ── the words ───────────────────────────────────────────────────────
// `{p}` is the player's first name. An epithet starting "the" follows the given name ("Grushnak the Butcher"); any
// other follows a comma ("Grushnak, Bane of Ayla").
export const NEMESIS_EPITHETS = Object.freeze({
  slew: Object.freeze(['the Butcher', 'the Gravedigger', 'the Widowmaker', 'Bloodhand', 'Bane of {p}', 'the Unbowed', 'Who Slew {p}', 'the Reaper']),
  fled: Object.freeze(['the Scarred', 'the Survivor', 'the Cunning', 'the Hunted', 'Half-Dead', 'the Lucky', 'Who Ran', 'the Unbroken']),
  // from rank 3, whatever the deed
  risen: Object.freeze(['the Thrice-Risen', 'the Undying', 'the Dread', 'Nemesis of {p}', 'the Relentless', '{p}\'s Shadow']),
});
const TAUNTS = Object.freeze({
  slew: Object.freeze([
    'Back for more, {p}? I remember how you fell.',
    'I still wear your blood, {p}.',
    'You died once by my hand. Again, then.',
    'They told me you were dead, {p}. I will make sure of it.',
  ]),
  fled: Object.freeze([
    'You should have finished me, {p}.',
    'I remember your blade, {p}. Now remember mine.',
    'Every scar you gave me, I bring back to you.',
    'I ran from you once. Never again.',
  ]),
  risen: Object.freeze([
    'How many times must I bury you, {p}?',
    'Every time we meet, I grow. Every time, you bleed.',
    'Still standing, {p}? Not for long.',
  ]),
});
const GROWLS = Object.freeze([
  '{n} bares its teeth - it remembers you.',
  '{n} circles, scarred and patient. It knows your scent.',
  '{n} lets out a long, hateful cry at the sight of you.',
]);

// ── the store ───────────────────────────────────────────────────────
/** @typedef {{ deed: 'slew'|'fled'|'returned'|'fell', at: number }} NemesisDeed */
/** @typedef {{ id: string, rev: number, mobileType: number, gender: 'male'|'female', given: string, epithet: string,
 *   name: string, rank: number, kills: number, escapes: number, returns: number, trait: string|null, elite: boolean,
 *   born: number, dueAt: number, out: boolean, outAt: number, defeated: boolean, defeatedAt: number|null,
 *   notice: string|null, history: NemesisDeed[], archive: number|null, gone?: boolean }} NemesisRecord */

/** @type {{ list: NemesisRecord[], mirrorId: string|null }} */
const _state = { list: [], mirrorId: null };

export const nemesisOn = () => lootRarityOn();
const nowMinutes = () => { try { return Math.floor(ownMinutes()); } catch { return 0; } };
const firstWord = (s) => String(s ?? '').trim().split(/\s+/)[0] || 'stranger';
const pick = (list, rolls) => list[Math.min(list.length - 1, Math.floor(rolls() * list.length))];
const fill = (s, { p = '', n = '' } = {}) => s.replace(/\{p\}/g, p).replace(/\{n\}/g, n);
const joinName = (given, epithet) => (/^the /.test(epithet) ? `${given} ${epithet}` : `${given}, ${epithet}`);

/** A small stable hash (FNV-1a) of a string - a name's seed. */
function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** A NEMESIS'S GIVEN NAME: DFU's own banks - a monster's from Monster1/Monster2, a class foe's (a person) a first
 *  name from one of the eight races' banks - drawn on a stream SEEDED by the nemesis's id, the shared DFRandom put
 *  back after, so making a nemesis moves nobody's dice and one id is always one name. */
export function nemesisGivenName(id, mobileType, gender = 'male') {
  const saved = getSeed();
  try {
    const h = hashStr(String(id));
    srand(h);
    const g = gender === 'female' ? GENDERS.Female : GENDERS.Male;
    let name = '';
    if (mobileType >= 128) {
      const banks = [BANK_TYPES.Breton, BANK_TYPES.Redguard, BANK_TYPES.Nord, BANK_TYPES.DarkElf, BANK_TYPES.HighElf, BANK_TYPES.WoodElf, BANK_TYPES.Khajiit, BANK_TYPES.Imperial];
      name = firstName(banks[h % banks.length], g);
    } else {
      name = monsterName(/** @type {any} */ (g), () => ((h >>> 8) % 2) / 2);
    }
    name = String(name ?? '').trim();
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Nameless';
  } finally { setSeed(saved); }
}

/** A deed's epithet - from rank 3 the risen ones, whatever the deed - never the one it wears now. */
export function nemesisEpithet(deed, rank, playerName, rolls = Math.random, current = null) {
  const pool = rank >= 3 ? NEMESIS_EPITHETS.risen : (NEMESIS_EPITHETS[deed] ?? NEMESIS_EPITHETS.slew);
  const p = firstWord(playerName);
  const choices = pool.map((e) => fill(e, { p })).filter((e) => e !== current);
  return pick(choices.length ? choices : pool.map((e) => fill(e, { p })), rolls);
}

/** The living nemeses (the slain kept in their records, `defeated`; the forgotten are tombstones, `gone`). */
export const livingNemeses = () => _state.list.filter((r) => !r.defeated && !r.gone);
/** Every record, the slain too - a journal's page (never a tombstone). */
export const allNemeses = () => _state.list.filter((r) => !r.gone);
/** NEMESIS-PAGE: this character's records (the mirror read in first), the slain too - the pause menu's page. */
export function nemesesFor(player) { ensureMirror(player); return allNemeses(); }
export const nemesisById = (id) => _state.list.find((r) => r.id === id && !r.gone) ?? null;

const isStr = (v) => typeof v === 'string';
const isNum = (v) => Number.isFinite(v);
/** A record read back (a save, the app's storage) - the shape checked, anything else dropped. */
function sanitize(r) {
  if (r && isStr(r.id) && r.id && r.gone === true) return { id: r.id, rev: isNum(r.rev) ? r.rev : 0, gone: true };   // a tombstone: the id and its revision alone
  if (!r || !isStr(r.id) || !r.id || !Number.isInteger(r.mobileType) || !isStr(r.given) || !isStr(r.epithet)) return null;
  const rank = Math.max(1, Math.min(NEMESIS_MAX_RANK, Number.isInteger(r.rank) ? r.rank : 1));
  return {
    id: r.id, rev: isNum(r.rev) ? r.rev : 0, mobileType: r.mobileType, gender: r.gender === 'female' ? 'female' : 'male',
    given: r.given, epithet: r.epithet, name: isStr(r.name) && r.name ? r.name : joinName(r.given, r.epithet), rank,
    kills: isNum(r.kills) ? r.kills : 0, escapes: isNum(r.escapes) ? r.escapes : 0, returns: isNum(r.returns) ? r.returns : 0,
    trait: isStr(r.trait) && r.trait ? r.trait : null, elite: !!r.elite,
    born: isNum(r.born) ? r.born : 0, dueAt: isNum(r.dueAt) ? r.dueAt : 0,
    out: false, outAt: 0,   // never out across a load: the foe that stood for it is not in a fresh world
    defeated: !!r.defeated, defeatedAt: isNum(r.defeatedAt) ? r.defeatedAt : null,
    notice: isStr(r.notice) ? r.notice : null,
    archive: Number.isInteger(r.archive) ? r.archive : null,
    history: Array.isArray(r.history) ? r.history.filter((d) => d && isStr(d.deed) && isNum(d.at)).slice(-HISTORY_MAX) : [],
  };
}
/** Two lists as one: per id, the higher revision. */
export function mergeNemeses(a, b) {
  const by = new Map();
  for (const r of [...(a ?? []), ...(b ?? [])]) {
    const s = sanitize(r);
    if (!s) continue;
    const had = by.get(s.id);
    if (!had || s.rev > had.rev) by.set(s.id, s);
  }
  return [...by.values()];
}

const storeKey = (id) => `${NEMESIS_STORE_PREFIX}${id}`;
/** The character's mirror merged in, once per character (a load, a new character, the first ask). */
function ensureMirror(player) {
  const id = player ? characterIdOf(player) : null;
  if (!id || _state.mirrorId === id) return;
  let kept = [];
  try { const raw = appStorage()?.getItem(storeKey(id)); if (raw) kept = JSON.parse(raw)?.list ?? []; } catch { /* a bad mirror is no mirror */ }
  const live = _state.list.map((r) => ({ id: r.id, out: r.out, outAt: r.outAt }));
  _state.list = mergeNemeses(_state.list, kept);
  for (const l of live) { const r = nemesisById(l.id); if (r) { r.out = l.out; r.outAt = l.outAt; } }   // a live stand is this session's, not the mirror's
  _state.mirrorId = id;
}
function persist() {
  if (!_state.mirrorId) return;
  try { appStorage()?.setItem(storeKey(_state.mirrorId), JSON.stringify({ v: 1, list: _state.list })); } catch { /* storage full or gone: the save still keeps it */ }
}
const touch = (r) => { r.rev = (r.rev | 0) + 1; };
/** A record forgotten: its place in the list becomes a tombstone (its id and a newer revision), which a merge keeps over
 *  any older copy of the record. */
function bury(r) {
  const i = _state.list.indexOf(r);
  if (i >= 0) _state.list[i] = /** @type {any} */ ({ id: r.id, rev: (r.rev | 0) + 1, gone: true });
}
/** THE LIST KEPT BOUNDED: the newest NEMESIS_FALLEN_MAX slain stay on the page, older ones are buried; the oldest
 *  tombstones past NEMESIS_TOMBS_MAX go (a save older than two hundred buryings is the one thing that could raise one). */
function prune() {
  const fallen = _state.list.filter((r) => r.defeated && !r.gone).sort((a, b) => (b.defeatedAt ?? 0) - (a.defeatedAt ?? 0));
  for (const r of fallen.slice(NEMESIS_FALLEN_MAX)) bury(r);
  const tombs = _state.list.filter((r) => r.gone);
  if (tombs.length > NEMESIS_TOMBS_MAX) {
    const drop = new Set(tombs.slice(0, tombs.length - NEMESIS_TOMBS_MAX));
    _state.list = _state.list.filter((r) => !drop.has(r));
  }
}
const deed = (r, d, at) => { r.history.push({ deed: d, at }); if (r.history.length > HISTORY_MAX) r.history.splice(0, r.history.length - HISTORY_MAX); };
const dueFrom = (now, rolls) => now + NEMESIS_RETURN_MIN_MINUTES + Math.floor(rolls() * (NEMESIS_RETURN_MAX_MINUTES - NEMESIS_RETURN_MIN_MINUTES + 1));

// ── who may become one ──────────────────────────────────────────────
/** A foe that may become (or stay) a nemesis: special (an elite, a champion, a nemesis already), of the floor's level,
 *  never the watch or an ally; `rec` the pool's record when there is one - never a quest's foe or a summons. */
export function nemesisCandidate(entity, rec = null) {
  if (!entity || !nemesisOn()) return false;
  const special = !!entity.nemesis || !!entity.eliteFoe || (typeof entity.champion === 'string' && !!entity.champion);
  if (!special) return false;
  if ((entity.level | 0) < NEMESIS_MIN_LEVEL) return false;
  if (entity.mobileType === KNIGHT_CITY_WATCH || entity.team === 'PlayerAlly' || entity.mobileTeam === 'PlayerAlly') return false;
  if (rec && (rec.questBehaviour || rec.allied || rec.questMarker)) return false;
  return true;
}

// ── the deeds ───────────────────────────────────────────────────────
/** Make `entity` a nemesis for what it just did (`deed` 'slew' or 'fled'), or rank up the one it already is. Answers
 *  the record, or null when it may not be one. `mobileType`/`gender` from the pool's record where the entity lacks
 *  them. */
export function nemesisDeed(player, entity, deedName, { mobileType = entity?.mobileType, gender = 'male', rec = null, archive = null, now = nowMinutes(), rolls = Math.random } = {}) {
  if (!nemesisCandidate(entity, rec) || !Number.isInteger(mobileType)) return null;
  ensureMirror(player);
  const pName = player?.name ?? '';
  let r = entity.nemesis?.id ? nemesisById(entity.nemesis.id) : null;
  if (r && !r.defeated) {
    r.rank = Math.min(NEMESIS_MAX_RANK, r.rank + 1);
    r.epithet = nemesisEpithet(deedName, r.rank, pName, rolls, r.epithet);
  } else {
    const id = mintCharacterId();
    const given = nemesisGivenName(id, mobileType, gender);
    r = {
      id, rev: 0, mobileType, gender: gender === 'female' ? 'female' : 'male', given,
      epithet: nemesisEpithet(deedName, 1, pName, rolls), name: '', rank: 1, kills: 0, escapes: 0, returns: 0,
      trait: typeof entity.champion === 'string' && entity.champion ? entity.champion : null, elite: !!entity.eliteFoe,
      born: now, dueAt: 0, out: false, outAt: 0, defeated: false, defeatedAt: null, notice: null, history: [],
      archive: Number.isInteger(archive) ? archive : null,   // NEMESIS-CARD: the sprite it wore (a retextured kind's own), for its portrait
    };
    _state.list.push(r);
    // past the cap: the weakest, oldest living one is forgotten - a tombstone, so no older save raises it again
    const living = livingNemeses();
    if (living.length > NEMESIS_MAX) {
      const drop = living.filter((x) => x !== r).sort((x, y) => x.rank - y.rank || x.born - y.born)[0];
      if (drop) bury(drop);
    }
  }
  r.name = joinName(r.given, r.epithet);
  if (deedName === 'slew') { r.kills++; r.notice = 'slew'; } else { r.escapes++; r.notice = null; }
  r.dueAt = dueFrom(now, rolls);
  deed(r, deedName, now);
  // the foe that did it wears its name at once - while it still stands (a killer over my body), it IS the nemesis
  entity.nemesis = { id: r.id, name: r.name, rank: r.rank };
  r.out = deedName === 'slew';
  r.outAt = r.out ? Date.now() : 0;
  touch(r);
  prune();
  persist();
  return r;
}

/** THE KILL. A killing BLOW names its foe (the struck seam's attacker, systems/sigilSetPowers.js's landed blow); a
 *  death no blow names - a spell's burn, a lingering effect's round, a poison's tick (NEMESIS-HARM) - goes to the foe
 *  whose harm last reached the player (systems/harmMark.js). Either is confirmed once the hurt is done (a microtask
 *  after it): a death a Stendarr's mercy undoes made nobody a nemesis. */
let _blowKiller = null;
let _deathCheck = false;
function armDeathCheck(entity) {
  if (_deathCheck) return;
  _deathCheck = true;
  Promise.resolve().then(() => {
    _deathCheck = false;
    const killer = _blowKiller ?? playerHarmMark();
    _blowKiller = null;
    if (!(entity.health <= 0) || !killer || killer.isPlayer || !(killer.health > 0)) return;   // a foe I slew is no nemesis - a fall after the fight names nobody dead
    const rec = playerDoor()?.foes?.()?.find((x) => x?.entity === killer) ?? null;
    nemesisDeed(entity, killer, 'slew', { mobileType: rec?.mobileType ?? killer.mobileType, gender: rec?.gender ?? 'male', rec, archive: rec?.archive ?? rec?.mobileArchive ?? null });
  });
}
function onBlowLanded(entity, attacker) {
  if (!entity?.isPlayer || entity.peer || !(entity.health <= 0) || !attacker || attacker.isPlayer) return;
  _blowKiller = attacker;
  armDeathCheck(entity);
}
function onPlayerHurt(entity, { after } = /** @type {any} */ ({})) {
  if (!entity?.isPlayer || entity.peer || !(after <= 0)) return;
  armDeathCheck(entity);
}
registerPlayerBlowLanded('nemesis', onBlowLanded);
registerPlayerHurtListener('nemesis', onPlayerHurt);
registerPlayerStruckListener('nemesis', (attacker, target) => {
  if (target?.isPlayer && !target.peer && attacker && !attacker.isPlayer) markPlayerHarm(attacker, { ms: HARM_MARK_STRUCK_MS });
});

/** THE FLEE ROLL: does this special foe, under NEMESIS_FLEE_HEALTH of its health for the first time, run? */
export function rollNemesisFlee(entity, rolls = Math.random) {
  if (!nemesisCandidate(entity)) return false;
  return rolls() < (entity.nemesis ? NEMESIS_FLEE_CHANCE_NEMESIS : NEMESIS_FLEE_CHANCE);
}
/** Under the line? (a foe's own share of its health; a dead one never) */
export const nemesisFleeHealth = (entity) => !!entity && entity.health > 0 && entity.health < (entity.maxHealth || 1) * NEMESIS_FLEE_HEALTH;

/**
 * THE FLEE, ONE LAW FOR EVERY POOL (scenes/exteriorFoes.js, scenes/dungeonContext.js): one frame of a foe record
 * `f` ({ entity, ai, fleeing?, _fleeRolled? }) against the player's feet. Answers what the host does now:
 *   'start'    - it breaks and runs (the motor's flee, characters/enemyMotor.js) - say it; no blow, no cast; its walk drawn
 *   'run'      - still running: no blow, no cast; its walk drawn
 *   'escape'   - out of reach (NEMESIS_ESCAPE_DISTANCE off, or its run spent past NEMESIS_ESCAPE_NEAR): retire it - no
 *                corpse, no kill - and make it a nemesis (nemesisDeed 'fled')
 *   'cornered' - its run spent with the player close behind: it turns and fights to the end (it never runs again) - say it
 *   null       - nothing: it fights on as ever
 * `onMe()` - whether it fights the player (asked only when it might run); `mayRun` - the host's word that the foe is the
 * player's alone (a room's shared foe never runs: vanishing on one client would leave it standing on the rest).
 */
export function nemesisFleeStep(f, feet, { onMe = () => true, mayRun = true, rolls = Math.random } = {}) {
  if (f.fleeing) {
    const d = Math.hypot(feet[0] - f.ai.feet[0], feet[2] - f.ai.feet[2]);
    if (d > NEMESIS_ESCAPE_DISTANCE) return 'escape';
    if (f.ai.fleeLeft > 0) return 'run';
    if (d > NEMESIS_ESCAPE_NEAR) return 'escape';
    f.fleeing = false;
    return 'cornered';
  }
  if (!mayRun || f._fleeRolled || !f.ai?.isHostile || !nemesisFleeHealth(f.entity) || !onMe() || !nemesisCandidate(f.entity, f)) return null;
  f._fleeRolled = true;
  if (!rollNemesisFlee(f.entity, rolls)) return null;
  f.fleeing = true;
  f.ai.flee(feet, NEMESIS_FLEE_SECONDS);
  return 'start';
}

/** Slain: the record is closed. Answers the record (its name for the line), or null for no nemesis. */
export function nemesisSlain(player, entity, { now = nowMinutes() } = {}) {
  const id = entity?.nemesis?.id;
  if (!id) return null;
  ensureMirror(player);
  const r = nemesisById(id);
  if (!r || r.defeated) return null;
  r.defeated = true; r.defeatedAt = now; r.out = false; r.notice = null;
  deed(r, 'fell', now);
  touch(r);
  prune();
  persist();
  return r;
}

// ── the return ──────────────────────────────────────────────────────
/** An open-world encounter roll's question: does a nemesis come instead? The one due (its time come, none of the
 *  character's out in the world already), the highest rank first, on NEMESIS_RETURN_CHANCE. Answers the record, or null. */
export function nemesisToReturn(player, { now = nowMinutes(), rolls = Math.random } = {}) {
  if (!nemesisOn()) return null;
  ensureMirror(player);
  const living = livingNemeses();
  if (living.some((r) => r.out)) return null;
  const due = living.filter((r) => r.dueAt <= now).sort((a, b) => b.rank - a.rank || a.dueAt - b.dueAt);
  if (!due.length || rolls() >= NEMESIS_RETURN_CHANCE) return null;
  // CLAIMED from here: its stand crosses awaits (the career's bytes, the sprite) and the next roll must not stand it twice
  due[0].out = true;
  due[0].outAt = Date.now();
  return due[0];
}
/** A claimed stand that stood nobody (no place for it, the pool full, a sweep) - free to come on a later roll. */
export function releaseNemesisStand(r) {
  if (r && r.out && !r.defeated && !r.gone) { r.out = false; r.outAt = 0; }
}
/** The spawn options a returning nemesis stands with (scenes/exteriorFoes.js spawnFoe): its record, its gender, and a
 *  class foe's level over the player's. */
export function nemesisSpawnOptions(r, playerLevel) {
  return { nemesis: r, gender: r.mobileType >= 128 ? r.gender : null, level: r.mobileType >= 128 ? Math.max(1, (playerLevel | 0) + r.rank * NEMESIS_LEVEL_PER_RANK) : null };   // a monster's sprite is its kind's, whatever its gender
}
/** Stand the record on a freshly built entity (before its loot): its name, its rank's health and blows. The record is
 *  OUT from here until the foe dies, escapes or leaves the world. */
export function applyNemesis(entity, r, { now = nowMinutes() } = {}) {
  if (!entity || !r) return false;
  entity.nemesis = { id: r.id, name: r.name, rank: r.rank };
  entity.maxHealth = Math.max(1, Math.round((entity.maxHealth || 1) * (1 + NEMESIS_HEALTH_PER_RANK * r.rank)));
  entity.health = entity.maxHealth;
  const prior = Number.isFinite(entity.damageScale) && entity.damageScale > 0 ? entity.damageScale : 1;
  entity.damageScale = prior * (1 + NEMESIS_DAMAGE_PER_RANK * r.rank);
  r.out = true; r.outAt = Date.now(); r.returns++;
  deed(r, 'returned', now);
  touch(r);
  persist();
  return true;
}
/** Out in the world and no longer there (outrun past the cull, a load, a sweep) - it comes again later. `foes` the
 *  pools' live records ({ entity, dead }). A stand still crossing its awaits has a few seconds' grace. */
export function nemesisPresence(foes, { now = nowMinutes(), wall = Date.now() } = {}) {
  let changed = false;
  // the open world's pool and whichever host the player stands in (a dungeon's foe that killed me stands there)
  let pools = null;
  for (const r of _state.list) {
    if (!r.out || r.defeated || r.gone || wall - r.outAt < 15000) continue;
    pools ??= [...(foes ?? []), ...(playerDoor()?.foes?.() ?? [])];
    const here = pools.some((f) => f && !f.dead && f.entity?.nemesis?.id === r.id);
    if (here) continue;
    r.out = false;
    r.dueAt = Math.max(r.dueAt, now + NEMESIS_LOST_MINUTES);
    touch(r);
    changed = true;
  }
  if (changed) persist();
  return changed;
}

// ── its drop ────────────────────────────────────────────────────────
/** A nemesis's drop, over its kind's: gold by level and rank, and gear on chances that grow with the rank. */
export function nemesisLoot(level = 1, rank = 1, rolls = Math.random) {
  const lv = Math.max(1, level | 0), rk = Math.max(1, Math.min(NEMESIS_MAX_RANK, rank | 0));
  const out = [];
  const L = NEMESIS_LOOT;
  if (rolls() < L.magicChance) { const it = tieredGear(lv, 'magic', rolls); if (it) out.push(it); }
  if (rk >= L.rareFromRank || rolls() < L.rareChance + L.rarePerRank * rk) { const it = tieredGear(lv, 'rare', rolls); if (it) out.push(it); }
  if (rolls() < L.legendaryChance + L.legendaryPerRank * rk) { const it = tieredGear(lv, 'legendary', rolls); if (it) out.push(it); }
  const [lo, hi] = L.goldPerLevel;
  out.push(goldStack(Math.round(lv * rk * (lo + rolls() * (hi - lo)))));
  return out;
}
/** Give a returned nemesis its drop (once). */
export function grantNemesisLoot(entity, level, rolls = Math.random) {
  if (!entity?.nemesis || entity._nemesisLoot) return;
  entity._nemesisLoot = true;
  entity.items = entity.items ?? [];
  entity.items.push(...nemesisLoot(level ?? entity.level, entity.nemesis.rank ?? 1, rolls));
}

// ── what is said ────────────────────────────────────────────────────
// Every word below comes two ways: the EVENT a face draws (NEMESIS-CARD - ui/nemesisCard.js on the enhanced skin: the
// portrait, the name, what it says in its own voice, what happens in the narrator's) and the one LINE a text surface
// says instead (the classic skin, a page without a document). `nemesisSay` hands an event to the face, or its line to
// the host's own `say`.
const ESCAPES = Object.freeze([
  'You will see me again, {p}.',
  'Not today. But soon.',
  'Count your days, {p}.',
]);
const LAST_WORDS = Object.freeze([
  'This... is not... the end...',
  'Remember... my name...',
  'You were... worthy...',
  'Curse you, {p}...',
]);
const GLOATS = Object.freeze([
  'Rest while you can, {p}. I am coming.',
  'Your blood is on my blade still.',
  'Sleep lightly, {p}.',
]);
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** What a returning nemesis greets the player with: its words (a speaker's) or what it does (a beast's). */
function tauntParts(r, playerName, rolls) {
  const p = firstWord(playerName);
  if (!nemesisSpeaks(r.mobileType)) {
    const g = pick(GROWLS, rolls);
    return { speech: null, body: capFirst(fill(g, { n: '' }).trim()), line: fill(g, { n: r.name }) };
  }
  const last = [...(r.history ?? [])].reverse().find((d) => d.deed === 'slew' || d.deed === 'fled')?.deed ?? 'slew';
  const pool = r.rank >= 3 ? TAUNTS.risen : TAUNTS[last];
  const speech = fill(pick(pool, rolls), { p });
  return { speech, body: null, line: `${r.name}: "${speech}"` };
}
/** The line a returning nemesis greets the player with (a beast's, what it does). */
export function nemesisTaunt(r, playerName, rolls = Math.random) {
  return r ? tauntParts(r, playerName, rolls).line : null;
}
/** A special foe breaking and running. */
export function nemesisFleeLine(entity, base) {
  const n = entity?.nemesis?.name ?? base;
  return nemesisSpeaks(entity?.mobileType) ? `${n} breaks and runs! "This isn't over!"` : `${n} breaks and runs!`;
}
/** Out of reach: it is a nemesis now (or a stronger one). */
export const nemesisEscapeLine = (r) => `${r.given} got away. ${r.name} will remember this.`;
/** Slain at last. */
export const nemesisSlainLine = (r) => `${r.name} has fallen. Your nemesis is no more.`;
/** The line the player meets once alive again after a nemesis's kill (online's respawn, the next load). */
export function nemesisRiseLine(r) {
  const kind = enemyDisplayName(r.mobileType) ?? 'foe';
  return r.kills > 1
    ? `${r.name} has killed you ${r.kills} times. It grows stronger.`
    : `The ${kind} that killed you lives on as ${r.name}. It will come for you again.`;
}

// ── NEMESIS-CARD: the events a face draws ───────────────────────────
const ROMAN = Object.freeze(['', 'I', 'II', 'III', 'IV', 'V']);
/** A rank as the card writes it (I to V). */
export const nemesisRankNumeral = (rank) => ROMAN[Math.max(0, Math.min(NEMESIS_MAX_RANK, rank | 0))];
/** The picture a nemesis is drawn by: the sprite it wore (`archive` - a retextured kind's own), else its kind's by
 *  gender, and its front-facing record - the idle's (15) where its kind has one, else the walk's (0)
 *  (characters/mobileUnit.js's tables). Null for a kind with no sprite. */
export function nemesisPortrait({ mobileType, gender = 'male', archive = null } = /** @type {any} */ ({})) {
  const b = ENEMY_BASICS[mobileType];
  const a = Number.isInteger(archive) ? archive : (b ? (gender === 'female' && b.femaleTexture ? b.femaleTexture : b.maleTexture) : null);
  if (!Number.isInteger(a)) return null;
  return { archive: a, record: b?.hasIdle ? 15 : 0 };
}
const KICKERS = Object.freeze({ taunt: 'Nemesis', flee: 'Fleeing', cornered: 'Cornered', escape: 'Escaped', slain: 'Nemesis slain', rise: 'A nemesis rises' });
/** @typedef {{ kind: string, kicker: string, id: string|null, name: string, rank: number, sub: string,
 *   portrait: { archive: number, record: number } | null, speech: string|null, body: string|null, line: string }} NemesisEvent */
/** One thing a nemesis (or a special foe about to become one) says or does, as a face draws it: `kind` (taunt, flee,
 *  escape, slain, rise), its name and what it is (rank, kind, trait, elite), its portrait, what it SAYS (its own voice,
 *  quoted) and what HAPPENS (the narrator's), and `line` - the one sentence a text surface says instead.
 *  @returns {NemesisEvent} */
export function nemesisEvent(kind, src, { speech = null, body = null, line = '', archive = null } = /** @type {any} */ ({})) {
  const r = src ?? {};
  const kindName = enemyDisplayName(r.mobileType) ?? '';
  const trait = typeof r.trait === 'string' && r.trait ? capFirst(r.trait) : null;
  return {
    kind, kicker: KICKERS[kind] ?? 'Nemesis', id: r.id ?? null, name: r.name || kindName, rank: r.rank | 0,
    sub: [kindName, trait, r.elite ? 'Elite' : null].filter(Boolean).join(' · '),
    portrait: nemesisPortrait({ mobileType: r.mobileType, gender: r.gender, archive: archive ?? r.archive }),
    speech, body, line,
  };
}
/** The record a live foe stands for, or what it is when it is no nemesis yet (a special foe running). */
function liveSource(entity, base, gender) {
  const r = entity?.nemesis?.id ? nemesisById(entity.nemesis.id) : null;
  if (r) return r;
  return { id: null, name: entity?.nemesis?.name ?? base, rank: entity?.nemesis?.rank ?? 0, mobileType: entity?.mobileType, gender,
    trait: typeof entity?.champion === 'string' ? entity.champion : null, elite: !!entity?.eliteFoe };
}
/** A returning nemesis, in sight: its taunt. */
export function nemesisTauntEvent(r, playerName, { rolls = Math.random, archive = null } = {}) {
  const t = tauntParts(r, playerName, rolls);
  return nemesisEvent('taunt', r, { speech: t.speech, body: t.body, line: t.line, archive });
}
/** A special foe breaking and running. */
export function nemesisFleeEvent(entity, base, { gender = 'male', archive = null } = {}) {
  const src = liveSource(entity, base, gender);
  const speaks = nemesisSpeaks(entity?.mobileType);
  return nemesisEvent('flee', src, { speech: speaks ? 'This isn\'t over!' : null, body: speaks ? null : 'Breaks and runs!', line: nemesisFleeLine(entity, base), archive });
}
/** Run down before it got away: it turns and fights. */
export function nemesisCorneredEvent(entity, base, { gender = 'male', archive = null } = {}) {
  const src = liveSource(entity, base, gender);
  const speaks = nemesisSpeaks(entity?.mobileType);
  return nemesisEvent('cornered', src, {
    speech: speaks ? 'Then I take you with me!' : null, body: speaks ? 'Cornered - it turns to fight.' : 'Cornered - it turns on you.',
    line: `${src.name} is cornered and turns to fight!`, archive,
  });
}
/** Out of reach - a nemesis now, or a stronger one. */
export function nemesisEscapeEvent(r, playerName, { rolls = Math.random, archive = null } = {}) {
  const speaks = nemesisSpeaks(r.mobileType);
  return nemesisEvent('escape', r, {
    speech: speaks ? fill(pick(ESCAPES, rolls), { p: firstWord(playerName) }) : null,
    body: `Got away. ${r.rank > 1 ? `Now rank ${nemesisRankNumeral(r.rank)} - it` : 'It'} will remember this.`,
    line: nemesisEscapeLine(r), archive,
  });
}
/** Slain at last - its last words, a speaker's. */
export function nemesisSlainEvent(r, playerName, { rolls = Math.random, archive = null } = {}) {
  const speaks = nemesisSpeaks(r.mobileType);
  return nemesisEvent('slain', r, {
    speech: speaks ? fill(pick(LAST_WORDS, rolls), { p: firstWord(playerName) }) : null,
    body: 'Has fallen. Your nemesis is no more.', line: nemesisSlainLine(r), archive,
  });
}
/** Alive again after its kill: it lives on, and gloats. */
export function nemesisRiseEvent(r, playerName, { rolls = Math.random } = {}) {
  const kind = enemyDisplayName(r.mobileType) ?? 'foe';
  const speaks = nemesisSpeaks(r.mobileType);
  return nemesisEvent('rise', r, {
    speech: speaks ? fill(pick(GLOATS, rolls), { p: firstWord(playerName) }) : null,
    body: r.kills > 1 ? `Has killed you ${r.kills} times. It grows stronger.` : `The ${kind} that killed you lives on. It will come for you again.`,
    line: nemesisRiseLine(r),
  });
}

// THE FACE (`setNemesisPresenter`, `nemesisSay`) is a leaf's - systems/nemesisVoice.js - so the HUD's card asks it
// without this file's imports.
export { setNemesisPresenter, nemesisSay } from './nemesisVoice.js';

/** The first pending notice, taken (said once): a nemesis's kill, read when the player stands alive again - as the
 *  event a face draws (its `line` the text surfaces'). */
export function takeNemesisNotice(player) {
  if (!player || !(player.health > 0)) return null;
  ensureMirror(player);
  const r = _state.list.find((x) => x.notice && !x.defeated);
  if (!r) return null;
  const ev = r.notice === 'slew' ? nemesisRiseEvent(r, player.name) : null;
  r.notice = null;
  touch(r);
  persist();
  return ev;
}

// ── the save ────────────────────────────────────────────────────────
registerModSaveData(NEMESIS_SAVE, {
  newSaveData: () => ({ v: 1, list: [] }),
  getSaveData: () => ({ v: 1, list: _state.list.map((r) => (r.gone ? r : { ...r, out: false, outAt: 0 })) }),
  restoreSaveData: (rec) => { _state.list = mergeNemeses(rec?.list ?? [], []); _state.mirrorId = null; },
  newGame: () => { _state.list = []; _state.mirrorId = null; },
});

/** Tests only: forget everything. */
export function _resetNemesisForTests() { _state.list = []; _state.mirrorId = null; }
