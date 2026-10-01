// @ts-check
// SEAT2b (2026-10-01, Mac: "Finish the seats"; "We need to do a comprehensive audit on everything and finish the not
// done"): A SEAT'S FORTIFICATIONS, ITS SIEGE WORKS AND ITS REVOLT - the law both ends read (bible/11-Multiplayer/
// Seats-Arc.md 6.2, 7.5, 7.7, 4.2's Siege Camp; Appendix B). Fortifications belong to the SEAT, not the guild: a
// project on the seat's board, its materials delivered by writs to the stockpile and its Marks paid from the
// treasury, standing 2, 4 or 7 days after its last delivery; each drops a tier when the seat changes hands and at a
// Season's end, and Season 0's end wipes them (18).
//
// THE MATERIALS (PROF0 section 4, net/professionLaw.js's keys): the table's "Cut Stone" `stone:cut`, "Oak Planks"
// `plank:oak` (and Pine, Cherry, Teak, Mahogany), "Iron/Steel/Mithril Ingots" `ingot:*`, "Pearls" `gem:pearl`.
// DECIDED: the table's bare "Silver" and "Gold" are the raw metals `metal:silver` and `metal:gold` - it names an ingot
// "Ingots" wherever it means one, and no gold ingot exists.
//
// Pure (it reads professionLaw.js's materials and its Builder). Not a DFU member: Daggerfall's towns have no player
// works. Ledger A (EVERY PALACE A SEAT's row).
//
// SEAT2b part two (2026-10-01, Mac: "I want to finish the inprogress"): the works' effects and their part in battle -
// the numbers the relay's referee COPIES (net/siegeRef.js is a leaf the relay bundles; this module reads professionLaw,
// which the relay never bundles - so siegeRef holds each number again, pinned EQUAL to this one by test, as its
// SIEGE_LENGTH_MS is to townSeatLaw.js's), the pass's works (siegeWorksPass), the relay-run figures (SIEGE_FIGURES -
// the Barracks' guards, the revolt's rebels and its Captain), the Siege Camp's Ram Kits and the Siegewright's day.
import { fortificationStone, minedMaterial, RAM_KIT_KEY } from './professionLaw.js';

/** The days a tier stands after its last delivery (7.5): tier 1, 2, 3. */
export const FORT_TIER_DAYS = Object.freeze([2, 4, 7]);
const need = (...pairs) => Object.freeze(pairs.map(([k, n]) => Object.freeze([k, n])));
const tier = (marks, ...pairs) => Object.freeze({ marks, needs: need(...pairs) });

/**
 * THE WORKS (7.5), in the table's order: each `{ id, name, tiers: [{ marks, needs: [[material, units]] }], where }` -
 * `where` the seats that may raise it: 'any'; 'gate' (a crown's, or a palace whose Walls stand at tier 3 - "palace
 * seats with tier 3 Walls gain a gate of their own"); 'coast' (coastal seats only).
 */
export const FORT_WORKS = Object.freeze([
  Object.freeze({ id: 'walls', name: 'Walls', where: 'any', tiers: Object.freeze([
    tier(1000, ['stone:cut', 400], ['plank:oak', 100]), tier(3000, ['stone:cut', 800], ['ingot:iron', 200]), tier(8000, ['stone:cut', 1600], ['ingot:steel', 200])]) }),
  Object.freeze({ id: 'gatehouse', name: 'Gatehouse', where: 'gate', tiers: Object.freeze([
    tier(2000, ['stone:cut', 300], ['ingot:iron', 200]), tier(5000, ['stone:cut', 600], ['ingot:steel', 200]), tier(12000, ['stone:cut', 1000], ['ingot:mithril', 100])]) }),
  Object.freeze({ id: 'watchtowers', name: 'Watchtowers', where: 'any', tiers: Object.freeze([
    tier(800, ['stone:cut', 200], ['plank:pine', 200]), tier(2000, ['stone:cut', 400], ['ingot:iron', 100])]) }),
  Object.freeze({ id: 'barracks', name: 'Barracks', where: 'any', tiers: Object.freeze([
    tier(1500, ['plank:oak', 300], ['ingot:iron', 100]), tier(4000, ['plank:oak', 600], ['ingot:steel', 200]), tier(9000, ['plank:teak', 800], ['ingot:mithril', 100])]) }),
  Object.freeze({ id: 'market', name: 'Market Hall', where: 'any', tiers: Object.freeze([
    tier(1000, ['plank:oak', 200], ['stone:cut', 100]), tier(2500, ['plank:cherry', 400], ['stone:cut', 200]), tier(6000, ['plank:mahogany', 400], ['metal:gold', 50])]) }),
  Object.freeze({ id: 'shrine', name: 'Shrine', where: 'any', tiers: Object.freeze([
    tier(1000, ['stone:cut', 100], ['metal:silver', 20]), tier(3000, ['stone:cut', 200], ['gem:pearl', 10])]) }),
  Object.freeze({ id: 'forge', name: 'Forge', where: 'any', tiers: Object.freeze([
    tier(1000, ['stone:cut', 200], ['ingot:iron', 100]), tier(2500, ['stone:cut', 300], ['ingot:steel', 100])]) }),
  Object.freeze({ id: 'workshop', name: 'Workshop', where: 'any', tiers: Object.freeze([
    tier(1000, ['plank:oak', 200], ['ingot:iron', 50]), tier(2500, ['plank:teak', 300], ['ingot:steel', 50])]) }),
  Object.freeze({ id: 'apothecary', name: 'Apothecary', where: 'any', tiers: Object.freeze([
    tier(1000, ['stone:cut', 100], ['plank:oak', 100]), tier(2500, ['stone:cut', 200], ['gem:pearl', 20])]) }),
  Object.freeze({ id: 'harbour', name: 'Harbour', where: 'coast', tiers: Object.freeze([
    tier(2000, ['plank:oak', 400], ['stone:cut', 200]), tier(5000, ['plank:teak', 800], ['stone:cut', 400])]) }),
]);
const BY_ID = new Map(FORT_WORKS.map((w) => [/** @type {string} */ (w.id), w]));
/** Every material a work's tier asks - what a seat writ may ask for its stockpile or a Siege Camp (Professions-Arc 11:
 *  "A seat's writs build its fortifications"). */
export const FORT_MATERIALS = Object.freeze([...new Set(FORT_WORKS.flatMap((w) => w.tiers.flatMap((t) => t.needs.map(([k]) => k))))].sort());
export const fortMaterialOk = (key) => FORT_MATERIALS.includes(key);
/** A work by its id, or null. */
export const fortWork = (id) => (typeof id === 'string' ? BY_ID.get(id) ?? null : null);
/** A work's highest tier (2 or 3), or 0 for none. */
export const fortMaxTier = (id) => fortWork(id)?.tiers.length ?? 0;
/** Tier `t`'s row of a work (1-based), or null. */
export const fortTierRow = (id, t) => (Number.isSafeInteger(t) && t >= 1 ? fortWork(id)?.tiers[t - 1] ?? null : null);

/**
 * WHETHER A SEAT MAY RAISE A WORK (7.5): `seat` `{ tier: 'palace'|'crown', coastal, walls }` - its tier, whether its
 * town is coastal and its Walls' tier now. A Gatehouse at a crown, or at a palace whose Walls stand at tier 3; a
 * Harbour at a coastal seat; the rest anywhere.
 */
export function fortMayRaise(id, seat) {
  const w = fortWork(id);
  if (!w) return false;
  if (w.where === 'gate') return seat?.tier === 'crown' || (seat?.tier === 'palace' && Number(seat?.walls ?? 0) >= 3);
  if (w.where === 'coast') return !!seat?.coastal;
  return true;
}

/** Whether a material is the stone a Builder saves: the Stores' stone family (Cut Stone; Rough Stone and Mortar should a
 *  work ever ask them) - professionLaw.js's own test, so the Builder has one law. */
const isStone = (key) => minedMaterial(key)?.family === 'stone';
/**
 * WHAT A PROJECT ASKS (7.5): tier `t` of a work, its needs as `[[material, units]]` - a Builder's (`builder`, Masonry 50,
 * Professions-Arc 3.3: "fortification projects need 10% less stone") stone a tenth less, rounded UP
 * (professionLaw.js fortificationStone, PROF11's) - and its Marks; or null for no such tier.
 */
export function fortNeeds(id, t, { builder = false } = {}) {
  const row = fortTierRow(id, t);
  if (!row) return null;
  return { marks: row.marks, needs: row.needs.map(([k, n]) => [k, isStone(k) ? fortificationStone(n, builder) : n]) };
}
/** SEAT2b part two: THE SIEGEWRIGHT'S DAY (Carpentry 100, Professions-Arc 3.3: "siege works a day sooner") - DECIDED: a
 *  fortification project BEGUN by a Siegewright stands a day sooner (2, 4, 7 days - 1, 3, 6), the starter's craft as the
 *  Builder's stone is (seatForts.js keeps who began it). */
export const SIEGEWRIGHT_SOONER_DAYS = 1;
/** When a project of tier `t` stands: its last delivery (s) and the tier's days (7.5) - a Siegewright's a day sooner -
 *  or null. */
export const fortStandsAt = (lastDeliveryS, t, { siegewright = false } = {}) => (Number.isFinite(lastDeliveryS) && t >= 1 && t <= 3
  ? lastDeliveryS + (FORT_TIER_DAYS[t - 1] - (siegewright ? SIEGEWRIGHT_SOONER_DAYS : 0)) * 86400 : null);
/** How much of each need is still wanting, given what the project holds (`held`: material -> units). */
export const fortWanting = (needs, held) => (needs ?? []).map(([k, n]) => [k, Math.max(0, n - Math.max(0, Number(held?.get?.(k) ?? held?.[k] ?? 0)))]);
/** Whether every need is met. */
export const fortMet = (needs, held) => fortWanting(needs, held).every(([, n]) => n === 0);

// ─── THE DROPS (7.5, 9.1, 18) ─────────────────────────────────────────

/** A work's tier after a drop: one less, at least nought. */
export const fortDropped = (t) => Math.max(0, Math.floor(Number(t) || 0) - 1);
/**
 * THE CAPTURE'S DROP (6.8: "the fortifications, each one tier down"; Appendix A: "the Walls drop to tier 0") over a
 * seat's works (`{ [id]: tier }`): each a tier down - but the Walls kept where a Fortifier saved them (Masonry 100,
 * Professions-Arc 3.3: "once a Season a seat's Walls skip their drop on capture"). A building project falls with
 * the Charter (the new holder raises its own).
 */
export function fortsAfterCapture(forts, { fortifier = false } = {}) {
  const out = {};
  for (const [id, t] of Object.entries(forts ?? {})) out[id] = id === 'walls' && fortifier ? Math.max(0, Number(t) || 0) : fortDropped(t);
  return out;
}
/** A Season's end (9.1): every work a tier down. */
export const fortsAfterSeason = (forts) => Object.fromEntries(Object.entries(forts ?? {}).map(([id, t]) => [id, fortDropped(t)]));

// ─── WHAT A TIER DOES (7.5, "Effect per tier") ────────────────────────

/** The Walls: the defenders' respawn wave 3 s faster a tier, never under 5 s. */
export const WALLS_WAVE_STEP_MS = 3000;
export const WALLS_WAVE_MIN_MS = 5000;
export const defendersWaveMs = (baseMs, walls) => Math.max(WALLS_WAVE_MIN_MS, baseMs - WALLS_WAVE_STEP_MS * Math.max(0, Math.min(3, Number(walls) || 0)));
/** The Gatehouse (6.2): vitality 20,000, +50% a tier; a fighter's blow deals a tenth of its damage to it. */
export const GATEHOUSE = Object.freeze({ vitality: 20000, perTier: 0.5, blowShare: 0.1 });
export const gatehouseVitality = (t) => Math.round(GATEHOUSE.vitality * (1 + GATEHOUSE.perTier * Math.max(0, Math.min(3, Number(t) || 0))));
/** A Ram (6.2): vitality 3,000 (a Siegewright's +50%, Professions-Arc 3.3), 500 every 10 s to the Gatehouse while two
 *  of its side stand within 3 m; one a side at a time; a destroyed Ram is gone. */
export const RAM = Object.freeze({ vitality: 3000, damage: 500, everyMs: 10000, crew: 2, crewM: 3, siegewright: 0.5 });
export const ramVitality = (siegewright = false) => Math.round(RAM.vitality * (siegewright ? 1 + RAM.siegewright : 1));
/** The Watchtowers: the holder told when a challenger passes half its defence (tier 1), a quarter (tier 2). */
export const watchtowerShare = (t) => (t >= 2 ? 0.25 : t === 1 ? 0.5 : null);
/** The Barracks: the relay-run town guards that fight for the holder - 2, 4, 6. */
export const barracksGuards = (t) => [0, 2, 4, 6][Math.max(0, Math.min(3, Number(t) || 0))];
/** The Market Hall: the town's boards list a quarter more a tier; the Tithe's cap a point more a tier. */
export const marketHallListings = (base, t) => Math.floor(base * (1 + 0.25 * Math.max(0, Math.min(3, Number(t) || 0))) + 1e-9);
export const marketHallTitheCap = (baseCap, t) => baseCap + Math.max(0, Math.min(3, Number(t) || 0));
/** The Shrine: Standing +1 a week a tier; each gate felled in the region +50 influence a tier to the holder. */
export const SHRINE_GATE_INFLUENCE = 50;
export const shrineStanding = (t) => Math.max(0, Math.min(2, Number(t) || 0));
export const shrineGateInfluence = (t) => SHRINE_GATE_INFLUENCE * shrineStanding(t);
/** The Forge, the Workshop and the Apothecary: a member crafting at the seat in their professions, +1 quality step a
 *  tier (PROF0 9.2's steps). */
export const STATION_PROFESSIONS = Object.freeze({
  forge: Object.freeze(['smithing']),
  workshop: Object.freeze(['carpentry', 'outfitting', 'masonry']),
  apothecary: Object.freeze(['alchemy', 'cooking', 'jewelcrafting']),
});
/** The steps a seat's works give a craft in `profession`, over its works' tiers (`{ [id]: tier }`). */
export function stationSteps(profession, forts) {
  let steps = 0;
  for (const [id, profs] of Object.entries(STATION_PROFESSIONS)) if (profs.includes(profession)) steps += Math.max(0, Number(forts?.[id] ?? 0) || 0);
  return steps;
}
/** The Harbour: a port for members (the Travel Options' port, and a harbour ships dock at) at tier 1 or more.
 *  SEAT2b part two - DECIDED, CORRECTING PART ONE: "coastal seats only" is a seat whose town's map pixel touches the sea
 *  (a sea pixel among its eight neighbours) - part one asked DFU's port flag, and every DFU port is already one of Travel
 *  Options' 378, so a Harbour changed nothing; now it makes a coastal town that is no port a port, for the holder's own. */
export const harbourPort = (t) => Number(t) >= 1;

// ─── THE SIEGE CAMP (4.2, 5.2 step 7) ─────────────────────────────────

/** A Ram Kit as the Stores hold it (PROF0 4.8's 690, a siege work) - professionLaw.js's own key (its Stores row and value
 *  live there), said here for the camp. */
export { RAM_KIT_KEY };
/** SEAT2b part two: WHAT A SIEGE CAMP'S WRIT MAY ASK (4.2: "its siege works (a Ram Kit) go to the siege it won") - a
 *  material some work asks, or a Ram Kit; a held seat's stockpile asks the works' materials alone (fortMaterialOk). */
export const campGoodOk = (key) => fortMaterialOk(key) || key === RAM_KIT_KEY;
/**
 * A CHALLENGER'S SIEGE CAMP AT THE TURNING (4.2: "its siege works (a Ram Kit) go to the siege it won, and everything
 * else is burnt; a camp that won no Right of Siege is burnt whole"): `camp` `[[material, units]]`, `won` whether its
 * guild won the Right there, `gated` whether the seat has a Gatehouse a Ram could strike (Appendix A: "no Ram - a
 * palace has no Gatehouse"). Answers `{ rams, burnt: [[material, units]] }`.
 */
export function campSpent(camp, { won = false, gated = false } = {}) {
  let rams = 0;
  const burnt = [];
  for (const [k, n] of camp ?? []) {
    const u = Math.max(0, Math.floor(Number(n) || 0));
    if (!u) continue;
    if (k === RAM_KIT_KEY && won && gated) rams += u;
    else burnt.push([k, u]);
  }
  return { rams, burnt };
}

// ─── THE REVOLT (7.7) ─────────────────────────────────────────────────

/** A seat at Standing 0 revolts at its next siege window: a Rebel Captain (vitality as a siege fighter of Renown 50)
 *  and 12 rebels at the palace door; the holder must fell the Captain inside the window's two hours - fail, and the
 *  Charter lapses; succeed, and Standing returns to 20 (townSeatLaw.js STANDING_CHANGES.revoltTo). SEAT2b part two -
 *  DECIDED: a felled rebel rises at the door every 30 seconds (the uprising's strength is its twelve, not a count to clear
 *  one by one); the Captain never rises - his fall ends it. */
export const REVOLT = Object.freeze({ captainRenown: 50, rebels: 12, windowMs: 2 * 3600 * 1000, rebelsWaveMs: 30000 });
/** Whether a seat revolts at its next window: its Standing at nought. */
export const revoltDue = (standing) => Number(standing) <= 0;

// ─── SEAT2b part two: THE WORKS IN BATTLE AND THE RELAY-RUN FIGURES (6.2, 7.5, 7.7) ───

/** A Ram stands this far before the Gatehouse, on the line to the attackers' camp (DECIDED: 6.2 names its crew's 3 m and
 *  never its place - before the gate it strikes, where the defenders must come out to it). */
export const RAM_OFFSET_M = 4;
/**
 * THE RELAY-RUN FIGURES (7.5's Barracks: "relay-run town guards fight for the holder ... the gate's brain with adds";
 * 7.7's Rebel Captain and his twelve). DECIDED (the record named the Captain's vitality alone): each kind's vitality as a
 * siege fighter's of its Renown (net/siegeRef.js siegeVitality: 300 + 2 x the level) - a guard 25 (350), a rebel 1
 * (302), the Captain 50 (400, 7.7's own); its blow a roll in `blow` (DFU-scaled to a fighter's 302-400: a guard's sword
 * fells a lone fighter in some twenty-five seconds), one every `swingMs`, within `reachM` (melee's 2.5); its walk
 * `speedMps`; it engages the nearest standing enemy within `aggroM` of itself while that enemy is within `leashM` of its
 * post, and walks home otherwise. Online's own (Ledger A): DFU's towns have no siege.
 */
export const SIEGE_FIGURES = Object.freeze({
  guard: Object.freeze({ renown: 25, blow: Object.freeze([10, 30]), swingMs: 1500, reachM: 2.5, speedMps: 5, leashM: 16, aggroM: 12 }),
  rebel: Object.freeze({ renown: 1, blow: Object.freeze([8, 22]), swingMs: 1600, reachM: 2.5, speedMps: 4.5, leashM: 24, aggroM: 16 }),
  captain: Object.freeze({ renown: 50, blow: Object.freeze([16, 36]), swingMs: 1300, reachM: 2.5, speedMps: 4.5, leashM: 8, aggroM: 10 }),
});
/** A figure's vitality: a siege fighter's at its kind's Renown (300 + 2 x it - siegeRef.js siegeVitality's law). */
export const figureVitality = (kind) => 300 + 2 * (SIEGE_FIGURES[kind]?.renown ?? 1);
/**
 * THE GUARDS' POSTS (DECIDED): the Throne first - the door the holder must keep - then the banners in the field's order,
 * round again: guard i at posts[i % posts.length]. `field` `{ banners: [[x, z]], throne: [x, z] }` (siegeRef.js fieldOf's
 * shape); answers each guard's post, `n` of them.
 */
export function guardPosts(field, n) {
  const posts = [field?.throne, ...(field?.banners ?? [])].filter(Boolean);
  if (!posts.length) return [];
  return Array.from({ length: Math.max(0, Math.min(6, Math.floor(Number(n) || 0))) }, (_, i) => [posts[i % posts.length][0], posts[i % posts.length][1]]);
}
/**
 * THE WORKS A BATTLE'S PASS CARRIES (net/identityToken.js `sx`): `[walls, gate, guards, rams, ramHp]` - the Walls' tier
 * (the defenders' wave), the Gatehouse's vitality (0 none: a palace whose Gatehouse never stood), the Barracks' guards,
 * the Ram Kits the Siege Camp sent and a Ram's vitality (a Siegewright on the attacking roster's +50%). `kind` the
 * battle's ('siege' | 'tourney' | 'revolt'), `tier` the seat's, `forts` its standing tiers (`{ [work]: tier }`), `rams`
 * the battle's kits, `siegewright` whether one stands on the attacking roster. A Tourney fights over no works (DECIDED:
 * the seat is unheld - its works wait for the winner); a revolt keeps the Walls alone (the holder's side is the
 * defenders; DECIDED: no guard draws on the town, no Ram, no gate); a Ram needs a Gatehouse to strike.
 */
export function siegeWorksPass({ kind, tier, forts = {}, rams = 0, siegewright = false }) {
  const t = (id) => Math.max(0, Math.min(fortMaxTier(id), Math.floor(Number(forts?.[id] ?? 0) || 0)));
  if (kind === 'revolt') return [t('walls'), 0, 0, 0, 0];
  if (kind !== 'siege') return [0, 0, 0, 0, 0];
  const gate = tier === 'crown' || t('gatehouse') >= 1 ? gatehouseVitality(t('gatehouse')) : 0;
  const kits = gate ? Math.max(0, Math.min(99, Math.floor(Number(rams) || 0))) : 0;
  return [t('walls'), gate, barracksGuards(t('barracks')), kits, kits ? ramVitality(siegewright) : 0];
}
/** THE WATCHTOWERS' WORD (7.5: "the holder is told when a challenger passes half its defence (tier 1) or a quarter
 *  (tier 2)"): whether a challenger's `influence` at the seat has passed - strictly - its share of the holder's `defence`. */
export const watchtowerPassed = (influence, defence, t) => {
  const share = watchtowerShare(Math.floor(Number(t) || 0));
  return share != null && Number(defence) > 0 && Number(influence) > Number(defence) * share;
};

// ─── THE WORKS' WORDS (7.9: "the stockpile: every fortification project and what it still needs") ───

/** What a work's tier does, as the Seat tab says it. */
export const FORT_EFFECT_WORDS = Object.freeze({
  walls: (t) => `the defenders' wave ${(WALLS_WAVE_STEP_MS / 1000) * t} s faster`,
  gatehouse: (t) => `its vitality ${gatehouseVitality(t).toLocaleString('en-US')}`,
  watchtowers: (t) => `the holder told when a challenger passes ${t >= 2 ? 'a quarter' : 'half'} of its defence`,
  barracks: (t) => `${barracksGuards(t)} town guards fight for the holder`,
  market: (t) => `the town's boards list ${25 * t}% more, the Tithe's cap ${t} ${t === 1 ? 'point' : 'points'} higher`,
  shrine: (t) => `Standing +${shrineStanding(t)} a week, +${shrineGateInfluence(t)} influence for each gate felled in the region`,
  forge: (t) => `members smithing here ${t === 1 ? 'a quality step' : `${t} quality steps`} better`,
  workshop: (t) => `members' carpentry, outfitting and masonry here ${t === 1 ? 'a quality step' : `${t} quality steps`} better`,
  apothecary: (t) => `members' alchemy, cooking and jewelcrafting here ${t === 1 ? 'a quality step' : `${t} quality steps`} better`,
  harbour: () => 'a port for the holder\'s members',
});
/**
 * A WORK'S LINE on the Seat tab - `w` its row as the service reads it (`{ tier, building, standsAt, needs, held }`):
 * "Walls: tier 1 - the defenders' wave 3 s faster. Raising tier 2: 320 Cut Stone, 200 Iron Ingots still wanted." -
 * `nameOf` a material's name for a count, `whenOf` a moment's words (ms).
 */
export function fortWorkLine(id, w, { nameOf = (k, n) => `${k}`, whenOf = (ms) => new Date(ms).toISOString() } = {}) {
  const work = fortWork(id);
  if (!work) return '';
  const t = Math.max(0, Number(w?.tier ?? 0) || 0);
  const head = t > 0 ? `${work.name}: tier ${t} - ${FORT_EFFECT_WORDS[id](t)}.` : `${work.name}: none raised.`;
  if (w?.building == null) return head;
  if (w.standsAt != null) return `${head} Tier ${w.building} stands ${whenOf(Number(w.standsAt) * 1000)}.`;
  const held = new Map(w.held ?? []);
  const wanted = fortWanting(w.needs ?? [], held).filter(([, n]) => n > 0).map(([k, n]) => `${n.toLocaleString('en-US')} ${nameOf(k, n)}`);
  return `${head} Raising tier ${w.building}: ${wanted.length ? `${wanted.join(', ')} still wanted` : 'every need met'}.`;
}
