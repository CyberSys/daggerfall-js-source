// @ts-check
// ═════════════════════════════════════════════════════════════════════
// PVP-REF (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and
// do sieges"; "Continue") - THE REFEREED BLOW AND STEP
// (bible/11-Multiplayer/Seats-Arc.md 6.1).
//
// FACT: no server sees a blow between players today - a duel's blow is
// the defender's to judge, on its own machine (DUEL1). A siege cannot be
// fought that way: a town's Charter changes hands on it. So in a siege's
// room the RELAY holds every fighter's vitality, and every blow, cast and
// step is judged here, the gate's law (net/gateBrain.js applyHit) grown
// from one foe to many fighters:
//
//   - VITALITY is normalised: 300 + 2 x the Renown level the account
//     service signed (the token's `lv`), 302 to 400 - flat on purpose, so
//     a lie about Renown buys a third more at most. A siege never touches
//     the save's health, items or gold.
//   - A BLOW is a claim `{ to, w, m, d, r }`: accepted while both stand,
//     the target's last pose within the weapon's reach (melee 2.5 m, a
//     shaft 60 m) and POSE_SLACK, the striker under 4 a second - and its
//     damage CLIPPED to the weapon's bucket: DFU's own range for that
//     weapon at that material, the attacker's bonuses at the game's caps,
//     doubled for a critical, never more. The weapon is the one the
//     striker's LOOK carries in hand (the paperdoll every other player
//     draws), never the claim's own word alone.
//   - A CAST: at most 3 damaging a 5 seconds, each to 60; a heal to 40,
//     three a 5 seconds of its own.
//   - A STEP: no faster than 18 m/s and half a metre (MEASURED below) -
//     AUDIT-SEATS R1/R2: its run and its climb together, on an allowance
//     the fighter carries (a second's run and the slack at most); past it
//     the relay pulls the fighter back to its last good pose. A fall is
//     gravity's, never refused.
//   - A FALLEN fighter rises at its side's next wave, with 3 seconds no
//     blow touches.
//
// A LEAF: the relay bundles every byte it imports (test/relayversion
// .test.js), so DFU's damage tables are copied here and pinned EQUAL to
// characters/weapons.js and combat/formulas.js by test, not imported
// (the gate's way - test/wb4b_gate_blows.test.js).
//
// Pure: no clock (every `now` an argument), no DOM, no network.
// ═════════════════════════════════════════════════════════════════════

/** A siege's room: `siege:<seat key>:<seat week>` - one a battle (Seats-Arc 6.2). */
export const SIEGE_ROOM = /^siege:(0|[1-9]\d{0,9}):(0|[1-9]\d{0,5})$/;
export const siegeRoomKey = (key, week) => `siege:${key}:${week}`;
export const isSiegeRoom = (k) => SIEGE_ROOM.test(String(k ?? ''));
/** A siege room's seat and week, or null. */
export function siegeOfRoom(k) {
  const m = SIEGE_ROOM.exec(String(k ?? ''));
  return m ? { key: Number(m[1]), week: Number(m[2]) } : null;
}

/** VITALITY (6.1): 300 + 2 x the Renown level, the level held to the token's own bound (1-50). */
export const SIEGE_VITALITY = Object.freeze({ base: 300, perLevel: 2, levelMax: 50 });
export const siegeVitality = (lv) => SIEGE_VITALITY.base + SIEGE_VITALITY.perLevel * Math.max(1, Math.min(SIEGE_VITALITY.levelMax, Math.trunc(Number(lv) || 1)));

/** World units a metre in a siege's room - a town's cell (world natives, net/duelSession.js NATIVES_PER_M). */
export const SIEGE_UNITS_PER_M = 40;
/** REACH (6.1): DFU's effective melee reach (WeaponManager.cs:35's 2.25 m and the sphere cast's 0.25), a shaft's 60 m,
 *  and the slack a pose's own lag earns (the gate's POSE_SLACK), in metres. */
export const SIEGE_REACH = Object.freeze({ melee: 2.5, shaft: 60, spell: 60, slack: 3 });
/** The kinds of blow on the wire: the gate's HIT_KINDS order. */
export const SIEGE_HIT = Object.freeze({ Melee: 0, Shaft: 1, Spell: 2 });
/** Blows a second a striker, one second deep (the gate's GATE_HIT_HZ_MAX). */
export const SIEGE_BLOWS_HZ = 4;
/** CASTS (6.1): damaging casts in a window, each one's damage, a heal's. A heal is bounded on a window of the same shape,
 *  its own (DECIDED here: 6.1 clamped a heal's size and named no rate, and at the frame gate's 8 a second an unbounded heal
 *  is 320 a second - a fighter nobody can fell; the referee has no unbounded verb). */
export const SIEGE_CASTS = Object.freeze({ max: 3, windowMs: 5000, damageMax: 60, healMax: 40 });
/**
 * THE STEP (6.1): the fastest a fighter may move across the ground, and the slack a step earns, in metres. MEASURED (6.1:
 * "the fastest legal run the motor allows with every Speed buff ... the ceiling 25% above it"): player/motor.js runSpeed
 * at live Speed's cap (statMods.js MAX_STAT_VALUE 100 - a Fortify past it reads 100), Running at the softcap's top
 * (skillSoftcap.js EFFECTIVE_SKILL_MAX 140, a mastered 200) with the lycanthrope's +30 and an Enhances Skill item's +15 -
 * (100 + 150) / 39.5 x (1.35 + 185 / 200) = 14.4 m/s; x 1.25 = 18. The design's starting 12.5 would have pulled back
 * every mastered runner (13.0 m/s); 18 still holds a stack of eight Running items, and refuses any teleport or doubled
 * run. A horse is dismounted on entry (SEAT2a's client).
 */
export const SIEGE_SPEED = Object.freeze({ mps: 18, slackM: 0.5 });
/** THE WAVES (6.2): a fallen fighter rises at its side's next wave - every 20 s at a palace seat, 30 at a crown - with
 *  3 s that no blow touches. */
export const SIEGE_WAVE_MS = Object.freeze({ palace: 20000, crown: 30000 });
export const SIEGE_PROTECT_MS = 3000;
/** The most fighters a siege's room keeps (6.4: a crown's 20 a side and its 4 sellswords a side). */
export const SIEGE_FIGHTERS_MAX = 48;

// ─── THE BUCKET (6.1: "DFU's own damage range for that weapon at that material, doubled for a critical") ───

/** DFU's weapon templates (characters/weapons.js WEAPONS), and the port's own Thunderlock (its 7-26 span). */
export const SIEGE_WEAPONS = Object.freeze({
  Dagger: 113, Tanto: 114, Staff: 115, Shortsword: 116, Wakazashi: 117, Broadsword: 118, Saber: 119, Longsword: 120,
  Katana: 121, Claymore: 122, Dai_Katana: 123, Mace: 124, Flail: 125, Warhammer: 126, Battle_Axe: 127, War_Axe: 128,
  Short_Bow: 129, Long_Bow: 130,
});
/** FormulaHelper.CalculateWeaponMaxDamage, by template (characters/weapons.js MAX_DAMAGE, pinned equal). */
export const SIEGE_WEAPON_MAX = Object.freeze({
  113: 6, 114: 8, 115: 8, 116: 8, 117: 10, 118: 12, 119: 12, 120: 16, 121: 16, 122: 18, 123: 21, 124: 12, 125: 14,
  126: 18, 127: 12, 128: 16, 129: 16, 130: 18,
});
/** The Thunderlock's template and span (characters/thunderlockIds.js, weapons.js THUNDERLOCK_SPAN - pinned equal). */
export const SIEGE_THUNDERLOCK = Object.freeze({ template: 560, max: 26 });
/** DaggerfallUnityItem.GetWeaponMaterialModifier by material, Iron to Daedric (characters/weapons.js, pinned equal). */
export const SIEGE_MATERIAL_MOD = Object.freeze([-1, 0, 0, 1, 2, 3, 3, 4, 5, 6]);
/** Hand-to-hand's most at the skill's top (combat/formulas.js handToHandMaxDamage(100), pinned equal). */
export const SIEGE_FIST_MAX = 21;
/**
 * THE ATTACKER'S BONUSES AT THE GAME'S CAPS (combat/formulas.js weaponAttackDamage): Strength 100's damage modifier
 * (floor((100 - 50) / 5)), the heaviest swing (playerWeapon.js SWING_MODS' StrikeDown), an expert's proficiency and a
 * racial bonus at level 30 (trunc(30 / 3) + 1, trunc(30 / 3)) - DECIDED here: a siege fighter's character level is not on
 * the wire, so the bucket takes the game's level 30 for the two that grow with it.
 */
export const SIEGE_BONUS = Object.freeze({ strength: 10, swing: 4, proficiency: 11, racial: 10 });
export const SIEGE_BONUS_MAX = SIEGE_BONUS.strength + SIEGE_BONUS.swing + SIEGE_BONUS.proficiency + SIEGE_BONUS.racial;
/** A critical's most (PCAAO's criticalStrikesIncreaseDamage ceiling - classic DFU's critical adds to-hit alone). */
export const SIEGE_CRIT_MAX = 2;

/**
 * THE MOST ONE BLOW MAY DEAL: (the weapon's top + its material + the attacker's bonuses at their caps) x a critical's
 * most. `w` a weapon template (null or -1 hand-to-hand), `m` its material (0 Iron to 9 Daedric). 0 for a template this
 * table does not name.
 */
export function siegeBlowMax(w, m) {
  if (w == null || w === -1) return (SIEGE_FIST_MAX + SIEGE_BONUS_MAX) * SIEGE_CRIT_MAX;
  const top = w === SIEGE_THUNDERLOCK.template ? SIEGE_THUNDERLOCK.max : SIEGE_WEAPON_MAX[w];
  if (!top) return 0;
  const mat = Number.isInteger(m) && m >= 0 && m < SIEGE_MATERIAL_MOD.length ? SIEGE_MATERIAL_MOD[m] : 0;
  return Math.max(0, top + mat + SIEGE_BONUS_MAX) * SIEGE_CRIT_MAX;
}
/** Whether a template is a bow (its blow a shaft's). */
export const siegeIsBow = (w) => w === SIEGE_WEAPONS.Short_Bow || w === SIEGE_WEAPONS.Long_Bow || w === SIEGE_THUNDERLOCK.template;
/** AUDIT-SEATS R8: THE HANDS - the look's two slots a weapon is wielded from (DFU's EquipSlots RightHand 19 and LeftHand
 *  21: characters/paperdoll.js EQUIP_SLOTS, pinned equal - this leaf imports nothing; net/remotePlayers.js composeLook
 *  writes each item's `equipSlot` off the equip table's own index). */
export const SIEGE_HAND_SLOTS = Object.freeze([19, 21]);
/**
 * THE WEAPON A STRIKER HOLDS, off its look (net/wire.js validLook's items): the claimed template and material where a
 * `Weapons` item of the look carries them IN A HAND, else null - hand-to-hand (`w` -1) is always held. AUDIT-SEATS R8: in
 * a hand - any Weapons item anywhere in the look was taken as held, so a Daedric Dai-Katana in an amulet's slot (a look
 * the wire admits: validLookItem bounds the slot, never its kind) struck as one.
 */
export function siegeHeld(look, w, m) {
  if (w === -1 || w == null) return { w: -1, m: 0 };
  const it = (look?.items ?? []).find((i) => i?.group === 'Weapons' && SIEGE_HAND_SLOTS.includes(i.equipSlot) && i.templateIndex === w && (i.material ?? 0) === m);
  return it ? { w, m } : null;
}

// ─── THE REFEREE ─────────────────────────────────────────────────────

/** A fighter's state as the room keeps it. */
export const newFighter = (lv, now) => {
  const max = siegeVitality(lv);
  return { lv: Math.max(1, Math.min(SIEGE_VITALITY.levelMax, Math.trunc(Number(lv) || 1))), hp: max, max, down: false, upAt: 0, safeTo: 0, rate: SIEGE_BLOWS_HZ, rateAt: now, casts: [], heals: [], dealt: 0, clipped: 0 };
};
const metres = (a, b) => Math.hypot((a.x - b.x) / SIEGE_UNITS_PER_M, (a.y - b.y) / SIEGE_UNITS_PER_M, (a.z - b.z) / SIEGE_UNITS_PER_M);
/** The striker's rate bucket, refilled to `now` (one second deep) - true where a blow may be spent. */
function spend(f, now) {
  f.rate = Math.min(SIEGE_BLOWS_HZ, f.rate + ((now - f.rateAt) / 1000) * SIEGE_BLOWS_HZ);
  f.rateAt = now;
  if (f.rate < 1) return false;
  f.rate -= 1;
  return true;
}

/**
 * A BLOW JUDGED (6.1) - `by` and `to` the two fighters' states, `from` and `at` their last poses (null: unknown), `held`
 * the weapon the striker's look carries (siegeHeld - null: none matching the claim), `d` the damage claimed, `r` its kind
 * (SIEGE_HIT). Answers `{ ok, dealt, fell, why }` and moves the states: the striker's bucket spent first (as the gate's),
 * the target's vitality down by the clipped damage, a fall at none left.
 * @param {any} by @param {any} to
 * @param {{ from?: any, at?: any, held?: any, d?: number, r?: number }} o
 * @param {number} now
 */
export function refereeBlow(by, to, { from = null, at = null, held = null, d = 0, r = SIEGE_HIT.Melee } = {}, now) {
  if (!by || !to || by === to) return { ok: false, dealt: 0, fell: false, why: 'no-fighter' };
  if (by.down || to.down) return { ok: false, dealt: 0, fell: false, why: 'down' };
  if (!spend(by, now)) return { ok: false, dealt: 0, fell: false, why: 'rate' };
  if (now < to.safeTo) return { ok: false, dealt: 0, fell: false, why: 'protected' };
  if (!held) return { ok: false, dealt: 0, fell: false, why: 'weapon' };
  if (!from || !at) return { ok: false, dealt: 0, fell: false, why: 'reach' };
  const shaft = r === SIEGE_HIT.Shaft;
  if (shaft !== siegeIsBow(held.w)) return { ok: false, dealt: 0, fell: false, why: 'weapon' };
  const reach = (shaft ? SIEGE_REACH.shaft : SIEGE_REACH.melee) + SIEGE_REACH.slack;
  if (metres(from, at) > reach) return { ok: false, dealt: 0, fell: false, why: 'reach' };
  const want = Math.max(0, Math.trunc(Number(d) || 0));
  const got = Math.min(want, siegeBlowMax(held.w, held.m), to.hp);
  by.clipped += want - got;
  by.dealt += got;
  to.hp -= got;
  const fell = to.hp <= 0;
  if (fell) to.down = true;
  return { ok: true, dealt: got, fell, why: null };
}

/**
 * A CAST JUDGED (6.1) - a damaging one (`heal` false) at most SIEGE_CASTS.max in a window, each to its damage's most; a
 * heal as many in a window of its own, to its own most, never past the target's whole. Reach a spell's. Answers
 * `{ ok, dealt, fell, why }`.
 * @param {any} by @param {any} to
 * @param {{ from?: any, at?: any, d?: number, heal?: boolean }} o
 * @param {number} now
 */
export function refereeCast(by, to, { from = null, at = null, d = 0, heal = false } = {}, now) {
  if (!by || !to) return { ok: false, dealt: 0, fell: false, why: 'no-fighter' };
  if (by.down || to.down) return { ok: false, dealt: 0, fell: false, why: 'down' };
  if (!from || !at || metres(from, at) > SIEGE_REACH.spell + SIEGE_REACH.slack) return { ok: false, dealt: 0, fell: false, why: 'reach' };
  const want = Math.max(0, Math.trunc(Number(d) || 0));
  if (heal) {
    by.heals = (by.heals ?? []).filter((t) => now - t < SIEGE_CASTS.windowMs);
    if (by.heals.length >= SIEGE_CASTS.max) return { ok: false, dealt: 0, fell: false, why: 'rate' };
    by.heals.push(now);
    const got = Math.min(want, SIEGE_CASTS.healMax, to.max - to.hp);
    to.hp += got;
    return { ok: true, dealt: -got, fell: false, why: null };
  }
  if (by === to) return { ok: false, dealt: 0, fell: false, why: 'no-fighter' };
  by.casts = by.casts.filter((t) => now - t < SIEGE_CASTS.windowMs);
  if (by.casts.length >= SIEGE_CASTS.max) return { ok: false, dealt: 0, fell: false, why: 'rate' };
  by.casts.push(now);
  if (now < to.safeTo) return { ok: false, dealt: 0, fell: false, why: 'protected' };
  const got = Math.min(want, SIEGE_CASTS.damageMax, to.hp);
  by.clipped += want - got;
  by.dealt += got;
  to.hp -= got;
  const fell = to.hp <= 0;
  if (fell) to.down = true;
  return { ok: true, dealt: got, fell, why: null };
}

/** AUDIT-SEATS R2: the longest a step's allowance runs - a second's run and the slack, however long the silence before. */
export const SIEGE_STEP_WINDOW_MS = 1000;
/**
 * A STEP JUDGED (6.1): `next` a pose `dtMs` after `last` (both in the room's units) - kept when it moved no faster than
 * SIEGE_SPEED and its slack, else refused (the relay pulls the fighter back to `last`). A first pose is always kept.
 *
 * AUDIT-SEATS R1: THE RISE IS JUDGED - a step's length is its run across the ground and its climb together
 * (+y is up: player/motor.js's gravity takes `pos[1]` down); a fall is still gravity's, never refused (it outruns any
 * run). PVP-REF judged the ground alone (its DECIDED: "a climb buys no reach") - and a climb bought everything: a
 * fighter rose 2,000 m in 50 ms to stand over a banner where no blow reached it, contesting it for ever.
 *
 * AUDIT-SEATS R2: AND THE ALLOWANCE IS CARRIED on the fighter `f` (`f.stepM`, metres): refilled at SIEGE_SPEED.mps, up
 * to SIEGE_STEP_WINDOW_MS's run and the slack ONCE, each kept step spending its length; a refused step spends nothing
 * (the relay keeps `last` and its time, so the next step earns the whole gap again). PVP-REF gave every pose its own
 * slack and every gap its whole run - 180 poses 60 ms apart took a fighter 441 m in 300 ms, and ten silent seconds let
 * one pose land 180 m away. The window is generous to the honest: a burst after a stalled link spends the second's run
 * the stall earned, never more. Without `f` (the law alone) a step earns its own gap, held to the window, and the slack.
 */
export function refereeStep(last, next, dtMs, f = null) {
  const full = SIEGE_SPEED.mps * SIEGE_STEP_WINDOW_MS / 1000 + SIEGE_SPEED.slackM;
  if (!last) { if (f) f.stepM = full; return true; }
  const earned = SIEGE_SPEED.mps * Math.min(SIEGE_STEP_WINDOW_MS, Math.max(0, dtMs)) / 1000;
  const allowed = f ? Math.min(full, (Number.isFinite(f.stepM) ? f.stepM : full) + earned) : earned + SIEGE_SPEED.slackM;
  const rise = Math.max(0, (next.y - last.y) || 0);   // a pose with no height climbs nothing (the relay's are all finite - validPose)
  const len = Math.hypot((next.x - last.x) / SIEGE_UNITS_PER_M, (next.z - last.z) / SIEGE_UNITS_PER_M, rise / SIEGE_UNITS_PER_M);
  if (len > allowed) return false;
  if (f) f.stepM = allowed - len;
  return true;
}

/** The next wave after `now` (6.2): its boundary on the room's own clock - every `waveMs` from the epoch. */
export const siegeNextWave = (now, waveMs) => (Math.floor(now / waveMs) + 1) * waveMs;
/** A fallen fighter's rise at its wave: whole again, and SIEGE_PROTECT_MS no blow touches. Answers whether it rose. */
export function siegeRise(f, now) {
  if (!f.down || now < f.upAt) return false;
  f.down = false; f.hp = f.max; f.safeTo = now + SIEGE_PROTECT_MS; f.casts = []; f.heals = [];
  return true;
}

// ═════════════════════════════════════════════════════════════════════
// SEAT2a (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and
// do sieges"; "Continue") - THE BATTLEFIELD (Seats-Arc 6.2, 6.5, 6.7, 6.8):
// the banners and the Throne, the clock, the no-shows, the result and who
// earned Honours. Pure, as the referee above: every `now` an argument.
// ═════════════════════════════════════════════════════════════════════

/** A BANNER (6.2): stand within 8 m with no living enemy there - 20 seconds raises it; a contested point freezes; an
 *  abandoned half-raised banner falls back at 1 second a second. */
export const SIEGE_BANNER = Object.freeze({ radiusM: 8, raiseS: 20, decayPerS: 1 });
/** THE THRONE (6.2): open to the attackers while they hold 2 of a palace's 3 banners (3 of a crown's 4) - SEAT2b part
 *  two: AND, where a Gatehouse stands, once it is breached (battleStep; a crown's always stands, a palace's where its
 *  Gatehouse was raised - the pass's `sx`; a pass with none, an older service's, opens on the banners alone as SEAT2a's
 *  DECIDED did); held uncontested 120 seconds at a palace, 180 at a crown, takes the seat; its progress decays 1 second
 *  a second while it is not held. */
export const SIEGE_THRONE = Object.freeze({ palace: Object.freeze({ banners: 2, holdS: 120 }), crown: Object.freeze({ banners: 3, holdS: 180 }), decayPerS: 1 });
/** How long a battle runs, ms (6.2, 6.7 - net/townSeatLaw.js BATTLE_LENGTH_MS, pinned equal: the relay bundles this leaf);
 *  SEAT2b part two: a revolt the window's two hours (7.7). */
export const SIEGE_LENGTH_MS = Object.freeze({ palace: 30 * 60_000, crown: 45 * 60_000, tourney: 20 * 60_000, revolt: 2 * 3600_000 });
/** No attacker in the room 10 minutes after the start: a forfeit (6.5). */
export const SIEGE_FORFEIT_MS = 10 * 60_000;
/** Spectators a siege's room admits (6.6). */
export const SIEGE_SPECTATORS_MAX = 60;
/** The battle's beat on the room's alarm, ms. */
export const SIEGE_TICK_MS = 1000;
/** A battlefield's banner points, in order: a palace's three, a crown's four (6.2). */
export const SIEGE_BANNER_NAMES = Object.freeze(['Gate', 'Market', 'Temple', 'Palace']);
export const siegeBannerCount = (tier) => (tier === 'crown' ? 4 : 3);
/** A battle's sides, and a spectator's word on a pass. */
export const SIEGE_SIDES = Object.freeze(['attack', 'defend']);

/** THE FIELD a pass carries (net/identityToken.js's `siege` order `sf`): the banners' points, the Throne's, the two
 *  camps' - each `[x, z]` in the room's units. `{ banners, throne, camps: { attack, defend } }`, or null. */
export function fieldOf(sf, tier, kind = 'siege') {
  if (kind === 'royal') return royalFieldOf(sf);   // CROWN1 part two: a Royal Tourney's field is its ring
  const n = siegeBannerCount(tier);
  if (!Array.isArray(sf) || sf.length !== n + 3) return null;
  if (!sf.every((p) => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e9))) return null;
  return { banners: sf.slice(0, n).map((p) => [p[0], p[1]]), throne: [sf[n][0], sf[n][1]], camps: { attack: [sf[n + 1][0], sf[n + 1][1]], defend: [sf[n + 2][0], sf[n + 2][1]] } };
}

/** A NEW BATTLE: a siege's banners start the holder's (`defend`), a Tourney's no one's. CROWN1 part two: a Royal
 *  Tourney's ladder, open from `startMs` to `endMs` (its pass's week). SEAT2b part two: a REVOLT's banners the holder's
 *  too, and inert (battleStep raises none); its two hours (7.7); and every battle's WORKS and FIGURES off its pass's `sx`
 *  (`works` - siegeWorksOf; none, an older service's pass, fights as it did before them). */
export function newBattle({ kind, tier, startMs, field, endMs = 0, works = null }) {
  if (kind === 'royal') return newRoyal({ startMs, endMs, field });
  const length = kind === 'tourney' || kind === 'revolt' ? SIEGE_LENGTH_MS[kind] : (SIEGE_LENGTH_MS[tier] ?? SIEGE_LENGTH_MS.palace);
  return {
    kind, tier, startMs, endMs: startMs + length, field,
    banners: field.banners.map(() => ({ side: kind === 'tourney' ? null : 'defend', raise: 0, by: null })),
    throne: 0, raised: false, attackSeen: false, defendSeen: false, at: startMs, result: null,
    reached: false,   // AUDIT-SEATS T1: whether the attackers ever stood alone at the open Throne (battleStep)
    ...siegeWorksOf({ kind, startMs, field, works }),   // SEAT2b part two: the Walls, the Gatehouse, the Rams, the figures
  };
}
const flat = (p, q) => Math.hypot((p.x - q[0]) / SIEGE_UNITS_PER_M, (p.z - q[1]) / SIEGE_UNITS_PER_M);
/** AUDIT-SEATS R1: how far above or below THE FIELD'S GROUND a fighter may stand and still stand at a point, metres - the
 *  banner's own 8 m, so a point is a sphere about its ground, never a column to the sky. */
export const SIEGE_HEIGHT_M = 8;
/**
 * AUDIT-SEATS R1: THE FIELD'S GROUND - the middle height (the median; two middles, their mean) of the sided fighters
 * standing in the room (`fighters` as battleStep takes them), in the room's units, or null with none.
 *
 * DECIDED here: the pass's points are `[x, z]` alone (net/identityToken.js's field - the service signs no height, and
 * the relay holds no ground), and presence was judged flat - a fighter 2,000 m over a banner stood at it, contesting it
 * for ever where no blow reached (a lone floater took two banners and the Throne). A seat town's ground is level (DFU
 * flattens a location's terrain - the camps and points all stand in or at its edge), and the fighters standing on it are
 * the room's honest many, so their middle height is the ground: a floater or a sinker more than SIEGE_HEIGHT_M off it
 * stands at no point. Its limit, recorded: a whole side lying together moves the middle by half - then nobody stands at
 * any point, and a siege's banners keep the holder's (a Tourney's whoever held them). The cure is a height in the
 * field's points, the service's to sign (SEAT2b's to ask).
 */
export function siegeGround(fighters) {
  const ys = [];
  for (const f of fighters) if (!f.down && f.pose && f.here && (f.side === 'attack' || f.side === 'defend') && Number.isFinite(f.pose.y)) ys.push(f.pose.y);
  if (!ys.length) return null;
  ys.sort((p, q) => p - q);
  const h = ys.length >> 1;
  return ys.length % 2 ? ys[h] : (ys[h - 1] + ys[h]) / 2;
}
/** The standing fighters of each side within a point's radius - AUDIT-SEATS R1: and within SIEGE_HEIGHT_M of the field's
 *  `ground` (siegeGround; null judges no height). */
function presentAt(fighters, point, ground = null) {
  let attack = 0, defend = 0;
  for (const f of fighters) {
    if (f.down || !f.pose || !f.here) continue;
    if (flat(f.pose, point) > SIEGE_BANNER.radiusM) continue;
    if (ground != null && Math.abs(f.pose.y - ground) / SIEGE_UNITS_PER_M > SIEGE_HEIGHT_M) continue;   // AUDIT-SEATS R1: above or below the field
    if (f.side === 'attack') attack++; else if (f.side === 'defend') defend++;
  }
  return { attack, defend };
}

/**
 * ONE BEAT OF THE BATTLE (6.2, 6.5): `fighters` every fighter's `{ side, pose, down, here }` (`here` its socket in the
 * room), the battle moved on to `nowMs`. Each banner raised by the side alone at it (twenty seconds; the other side's
 * half-raise begun again), frozen while both stand there, falling back a second a second when left; a siege's Throne,
 * open while the attackers hold enough banners, raised by attackers alone at it and falling back otherwise - held its
 * time, the seat is taken. The clock: at its end a siege is the holder's, a Tourney the side with more banners' (a dead
 * heat `tie` - the service reads the higher influence). No attacker in a siege's room by ten minutes past the start: a
 * forfeit (`absent` when no defender came either - the holder keeps it, nothing more; DECIDED: 6.5's no-shows are a
 * siege's - a Tourney's absent contender simply holds no banners at its end). Each fighter in the room is credited its
 * seconds there (`stood`, Honours' half). Answers the beat's events (`{ k: 'banner', i, side }`, `{ k: 'end', result }`);
 * the battle's `result` once ended.
 *
 * SEAT2b part two (6.2, 7.5, 7.7): a standing Barracks' guard at a banner or the Throne CONTESTS it - frozen, as a
 * defender there freezes it - and RAISES NOTHING (a banner it stands at alone falls back, as an empty one does); where a
 * Gatehouse stands the Throne opens only once it is breached; and a REVOLT raises no banner, holds no Throne and is
 * forfeited by no one - its Rebel Captain felled puts it down (`defend`), the window's end with him standing is the
 * rebels' (`attack`: the Charter lapses). The beat keeps the field's ground (`b.ground`) for a blow at a figure or a work
 * between beats (siegeFigureBlow, siegeWorkBlow).
 */
export function battleStep(b, fighters, nowMs) {
  if (b.result || nowMs < b.startMs) return [];
  const dt = Math.max(0, Math.min(nowMs - Math.max(b.at, b.startMs), 5 * SIEGE_TICK_MS)) / 1000;
  b.at = nowMs;
  const out = [];
  for (const f of fighters) {
    if (!f.here || (f.side !== 'attack' && f.side !== 'defend')) continue;
    f.stood = (f.stood ?? 0) + dt;   // Honours' half (6.8): its seconds in the room since the start
    if (f.side === 'attack') b.attackSeen = true; else b.defendSeen = true;
  }
  const ground = siegeGround(fighters);   // AUDIT-SEATS R1: the field's ground, this beat
  b.ground = ground;   // SEAT2b part two: kept for a blow at a figure or a work between beats
  if (b.kind === 'revolt') {   // SEAT2b part two (7.7): the Captain's fall, or the clock - nothing else ends a revolt
    if (b.figures?.some((g) => g.kind === 'captain' && g.down)) return end(b, 'defend', out);
    return nowMs >= b.endMs ? end(b, 'attack', out) : out;
  }
  b.banners.forEach((bn, i) => {
    const p = presentAt(fighters, b.field.banners[i], ground);
    const alone = p.attack && !p.defend ? 'attack' : p.defend && !p.attack ? 'defend' : null;
    p.defend += guardsAt(b, b.field.banners[i]);   // SEAT2b part two: a standing guard contests - counted past `alone`, so it raises nothing
    if (p.attack && p.defend) return;   // contested: frozen
    if (alone && bn.side !== alone) {
      if (bn.by !== alone) { bn.by = alone; bn.raise = 0; }
      bn.raise += dt;
      if (bn.raise >= SIEGE_BANNER.raiseS) {
        bn.side = alone; bn.raise = 0; bn.by = null;
        if (alone === 'attack') b.raised = true;
        out.push({ k: 'banner', i, side: alone });
      }
      return;
    }
    bn.raise = Math.max(0, bn.raise - SIEGE_BANNER.decayPerS * dt);
    if (!bn.raise) bn.by = null;
  });
  if (b.kind === 'siege') {
    const rule = SIEGE_THRONE[b.tier] ?? SIEGE_THRONE.palace;
    // SEAT2b part two (6.2: "opens while the attackers hold 3 of 4 banners AND the Gatehouse is breached"): behind a
    // Gatehouse, only once it is breached - a palace whose Gatehouse stands too; none standing, the banners alone
    const open = b.banners.filter((bn) => bn.side === 'attack').length >= rule.banners && (!b.gate || b.breached);
    const p = presentAt(fighters, b.field.throne, ground);
    p.defend += guardsAt(b, b.field.throne);   // SEAT2b part two: a standing guard at the Throne contests the attackers' hold
    if (open && p.attack && !p.defend) b.throne += dt;
    else if (!(open && p.attack && p.defend)) b.throne = Math.max(0, b.throne - SIEGE_THRONE.decayPerS * dt);
    // AUDIT-SEATS T1 (7.3: "A siege held only after the Throne was reached: -5"; 9.2: "The Throne was never reached"):
    // REACHED once its progress was ever above nought - the attackers stood alone at the open Throne for a beat; kept
    // for good (`th` on every receipt - net/siegeReceipt.js), never undone by the decay
    if (b.throne > 0) b.reached = true;
    if (b.throne >= rule.holdS) return end(b, 'attack', out);
  }
  if (b.kind === 'siege' && !b.attackSeen && nowMs >= b.startMs + SIEGE_FORFEIT_MS) return end(b, b.defendSeen ? 'forfeit' : 'absent', out);
  if (nowMs >= b.endMs) {
    if (b.kind === 'siege') return end(b, 'defend', out);
    const a = b.banners.filter((bn) => bn.side === 'attack').length, d = b.banners.filter((bn) => bn.side === 'defend').length;
    return end(b, a > d ? 'attack' : d > a ? 'defend' : 'tie', out);
  }
  return out;
}
function end(b, result, out) {
  b.result = result;
  out.push({ k: 'end', result });
  return out;
}

/** HONOURS (6.8): "Every fighter who stood half the siege or felled a foe" - `stood` its seconds in the room standing,
 *  `felled` how many it brought down, against the battle's own run (`b.at` its end, from its start). */
export const honoured = (f, b) => (f.felled ?? 0) > 0 || (f.stood ?? 0) * 1000 >= (Math.max(b.at, b.startMs) - b.startMs) / 2;

/** The room's door opens this long before the battle is joined - the sides gather at their camps (6.4: signing closes
 *  ten minutes before the start; DECIDED here: the door opens as it closes). */
export const SIEGE_OPENS_MS = 10 * 60_000;
/** SEAT2b part two: THE CAMP A SIDE MUSTERS AT - its own; in a REVOLT the holder's side at the ATTACKERS' (the contract's
 *  DECIDED, 7.7: the rebels hold the palace door, where the defenders' camp is, and the holder's side marches on them). */
export const siegeCampSide = (b, side) => (b?.kind === 'revolt' ? 'attack' : side);
/** A side's camp as a pose (6.2: the fallen rise there, a fighter enters there) - the height and facing kept from `was`,
 *  the ground's to settle. */
export const siegeCampPose = (b, side, was) => {
  const c = b.field.camps[siegeCampSide(b, side)];
  return { x: c[0], y: Number.isFinite(was?.y) ? was.y : 0, z: c[1], yaw: Number.isFinite(was?.yaw) ? was.yaw : 0, pitch: 0 };
};

// ─── AUDIT-SEATS T3: A DISCONNECTED FIGHTER'S PLACE (Seats-Arc 16: "their place on the roster is kept 5 minutes; they
// return at their camp with the next wave. After 5 minutes a signed-up substitute may take the place"; 6.4) ───

/** A SIDE'S PLACES in the field - ten at a palace, twenty at a crown, its Sellswords within them (net/townSeatLaw.js
 *  SIEGE_SIDE_MAX, pinned equal: the service's roster counts no more) - and how long a fighter gone keeps its own. */
export const SIEGE_PLACES = Object.freeze({ palace: 10, crown: 20 });
export const SIEGE_PLACE_KEPT_MS = 5 * 60_000;
/** Whether a fighter holds its side's place at `now`: `here` (a socket in the room), or gone (`f.goneAt`, stamped by the
 *  relay at the leave it sees) less than SIEGE_PLACE_KEPT_MS. A fighter gone with no stamp is held. */
export const siegeHoldsPlace = (f, here, now) => here || !Number.isFinite(f?.goneAt) || now - f.goneAt < SIEGE_PLACE_KEPT_MS;
/** Whether `side` has a place free at `now` for an account that holds none: `fighters` the room's (`{ [sub]: f }`),
 *  `here(sub)` whether a socket of that account is in the room, `except` the account asking (its own place is not in
 *  the count - a fighter back inside its five minutes has one). */
export function siegePlaceFree(fighters, side, tier, here, now, except = null) {
  let held = 0;
  for (const [sub, f] of Object.entries(fighters ?? {})) if (sub !== except && f?.side === side && siegeHoldsPlace(f, here(sub), now)) held++;
  return held < (SIEGE_PLACES[tier] ?? SIEGE_PLACES.palace);
}
/**
 * A FIGHTER BACK FROM A DROP (its `in` after a leave): at its side's camp - and, the battle joined and not over, down
 * until its side's next wave, when it rises whole and protected as any fallen fighter does (siegeRise; a fighter that
 * fell before it dropped keeps its own wave). Before the start it simply stands at its camp; after the end nothing moves
 * (it came for its receipt). So a drop is never a way out of a fall: the place is kept, the ground is not. Answers
 * whether it waits for a wave (`f.upAt`). SEAT2b part two: its own side's wave (siegeSideWaveMs - the defenders'
 * faster behind the Walls).
 */
export function siegeReturn(b, f, now) {
  delete f.goneAt;
  if (!b || b.result || (f.side !== 'attack' && f.side !== 'defend')) return false;
  f.pose = siegeCampPose(b, f.side, f.pose); f.poseAt = now;
  if (now < b.startMs || f.down) return false;
  f.down = true;
  f.upAt = siegeNextWave(now, siegeSideWaveMs(b.tier, f.side, b.walls));
  return true;
}
const sideCode = (s) => (s === 'attack' ? 1 : s === 'defend' ? 2 : 0);
/**
 * THE FIELD'S FRAME (the relay's `f`, each second): `b` each banner `[held, its raise in whole seconds, by whom]` (0 no
 * one, 1 the attackers, 2 the defenders), `th` the Throne's whole seconds, `s` and `e` the battle's start and end (ms),
 * `n` who is in - `[attackers, defenders, spectators]`.
 */
export const siegeFieldFrame = (b, n) => ({
  k: 'f', b: b.banners.map((bn) => [sideCode(bn.side), Math.floor(bn.raise), sideCode(bn.by)]), th: Math.floor(b.throne), s: b.startMs, e: b.endMs, n,
});
/** The battle's next beat after `now`: a second on, or sooner where its start, a siege's forfeit mark or its end falls
 *  first - so a battle ends on its own clock, never a beat late. SEAT2b part two: half a second on (SIEGE_FIGURE_TICK_MS)
 *  while the battle is joined and a figure stands or a Ram is crewed, so a figure's walk and swing read well; and a
 *  fallen figure's wave and the next Ram's are marks too. */
export function siegeNextBeat(b, now) {
  const busy = now >= b.startMs && !b.result && ((b.figures ?? []).some((g) => !g.down) || (b.ram?.crew ?? 0) >= SIEGE_RAM.crew);
  let next = now + (busy ? SIEGE_FIGURE_TICK_MS : SIEGE_TICK_MS);
  const marks = [b.startMs, b.endMs];
  if (b.kind === 'siege' && !b.attackSeen) marks.push(b.startMs + SIEGE_FORFEIT_MS);
  for (const g of b.figures ?? []) if (g.down && g.upAt != null) marks.push(g.upAt);
  if (siegeRamDue(b)) marks.push(b.ramAt);
  for (const m of marks) if (m > now && m < next) next = m;
  return next;
}

// ═════════════════════════════════════════════════════════════════════
// SEAT2b part two (2026-10-01, Mac: "I want to finish the inprogress") -
// THE WORKS AND THE FIGURES IN BATTLE (Seats-Arc 6.2, 7.5, 7.7): the Walls'
// wave, the Gatehouse and its breach, the Rams, the Barracks' guards, and a
// revolt's Rebel Captain and his twelve. The numbers are net/fortLaw.js's,
// COPIED here and pinned EQUAL by test (test/seat2b2_battle.test.js):
// fortLaw reads professionLaw.js, which the relay must never bundle, and
// this leaf imports nothing - the way SIEGE_LENGTH_MS is townSeatLaw.js's.
// Pure, as above: every `now` an argument, every random draw the caller's
// `rand01`, the state on the battle (JSON-plain - the room checkpoints it).
// Online's own (Ledger A): DFU's towns have no siege.
// ═════════════════════════════════════════════════════════════════════

/** THE WALLS (7.5: "the defenders' respawn wave 3 s faster" a tier) - never under 5 s; three tiers (fortLaw.js
 *  WALLS_WAVE_STEP_MS and WALLS_WAVE_MIN_MS, pinned equal). */
export const SIEGE_WALLS = Object.freeze({ stepMs: 3000, minMs: 5000, tiers: 3 });
/** The defenders' wave behind `walls` tiers of Walls (fortLaw.js defendersWaveMs, pinned equal). */
export const siegeDefendersWaveMs = (baseMs, walls) => Math.max(SIEGE_WALLS.minMs, baseMs - SIEGE_WALLS.stepMs * Math.max(0, Math.min(SIEGE_WALLS.tiers, Number(walls) || 0)));
/**
 * A SIDE'S WAVE (6.2, 7.5): the attackers' every SIEGE_WAVE_MS of the seat's tier; the defenders' - a revolt's holder's
 * side too, which keeps its Walls (fortLaw.js siegeWorksPass) - faster behind `walls` tiers (the pass's `sx[0]`). The room
 * reads it at a fall and at a return (siegeReturn); DECIDED here: the client's countdown reads the same law off the pass
 * it holds (`siegeSideWaveMs(tier, side, sx?.[0] ?? 0)` - the `f` frame is unchanged and says no wave).
 */
export const siegeSideWaveMs = (tier, side, walls = 0) => {
  const base = SIEGE_WAVE_MS[tier] ?? SIEGE_WAVE_MS.palace;
  return side === 'defend' ? siegeDefendersWaveMs(base, walls) : base;
};
/** THE GATEHOUSE (6.2: "a blow deals a tenth of its damage to it" - fortLaw.js GATEHOUSE.blowShare, pinned equal). Its
 *  vitality rides the pass (`sx[1]`, fortLaw.js gatehouseVitality - the service's word); it stands AT THE THRONE'S POINT
 *  (the contract's DECIDED: 6.2 places a crown's Gatehouse and its Throne both at the castle's entrance, and a palace's own
 *  gate stands at its palace door). */
export const SIEGE_GATEHOUSE = Object.freeze({ blowShare: 0.1 });
/** A RAM (6.2: "500 every 10 seconds while two attackers stand within 3 m of it ... one Ram at a time") - fortLaw.js RAM's
 *  damage, everyMs, crew and crewM, and RAM_OFFSET_M (`offsetM`: it stands so far before the Gatehouse, on the line to the
 *  attackers' camp), pinned equal. Its vitality rides the pass (`sx[4]` - a Siegewright's half more, the service's). */
export const SIEGE_RAM = Object.freeze({ damage: 500, everyMs: 10000, crew: 2, crewM: 3, offsetM: 4 });
/** THE RELAY-RUN FIGURES (7.5's Barracks' guards, 7.7's rebels and their Captain) - each kind's `{ renown, blow, swingMs,
 *  reachM, speedMps, leashM, aggroM }`, fortLaw.js SIEGE_FIGURES pinned equal (its DECIDED says why each). */
export const SIEGE_FIGURE_KINDS = Object.freeze({
  guard: Object.freeze({ renown: 25, blow: Object.freeze([10, 30]), swingMs: 1500, reachM: 2.5, speedMps: 5, leashM: 16, aggroM: 12 }),
  rebel: Object.freeze({ renown: 1, blow: Object.freeze([8, 22]), swingMs: 1600, reachM: 2.5, speedMps: 4.5, leashM: 24, aggroM: 16 }),
  captain: Object.freeze({ renown: 50, blow: Object.freeze([16, 36]), swingMs: 1300, reachM: 2.5, speedMps: 4.5, leashM: 8, aggroM: 10 }),
});
/** A figure's kind on the wire's `n` rows (net/wire.js siegeFigureKind, by its id's letter). */
export const SIEGE_FIGURE_CODE = Object.freeze({ guard: 0, rebel: 1, captain: 2 });
/** A figure's vitality: a siege fighter's at its kind's Renown (siegeVitality - fortLaw.js figureVitality, pinned equal). */
export const siegeFigureVitality = (kind) => siegeVitality(SIEGE_FIGURE_KINDS[kind]?.renown ?? 1);
/** THE REVOLT (7.7): a Rebel Captain and twelve rebels; a felled rebel rises at the door every 30 seconds, the Captain
 *  never (fortLaw.js REVOLT's rebels and rebelsWaveMs, pinned equal). */
export const SIEGE_REVOLT = Object.freeze({ rebels: 12, rebelsWaveMs: 30000 });
/** The Barracks' guards at most (fortLaw.js barracksGuards at tier 3, and guardPosts' own bound - pinned equal). */
export const SIEGE_GUARDS_MAX = 6;
/** DECIDED here: the twelve rebels stand on a ring this far about the palace door (the Throne's point), the Captain at the
 *  door itself - 7.7 puts them all "at the palace door" and names no ring; six metres keeps the twelve a man's width apart
 *  (a ring of 37.7 m) and every one within its aggro of the door's approach. */
export const SIEGE_REBEL_RING_M = 6;
/** DECIDED here: THE FIGURES' BEAT - half a second while the battle is joined and a figure stands or a Ram is crewed
 *  (siegeNextBeat): a figure walks at most 2.5 m a beat and its swing (every 1.3 to 1.6 s) lands within a quarter of its
 *  own length, where the battle's second would show a guard leap five metres and strike late; the `w` and `n` frames go
 *  each beat at most. The field's `f` keeps its second. */
export const SIEGE_FIGURE_TICK_MS = 500;
/** THE WORKS a pass carries none of (an older service's, a Royal Tourney's): `[walls, gate, guards, rams, ramHp]`. */
export const SIEGE_NO_WORKS = Object.freeze([0, 0, 0, 0, 0]);

/** THE GUARDS' POSTS (fortLaw.js guardPosts, pinned equal): the Throne first - the door the holder must keep - then the
 *  banners in the field's order, round again: guard i at posts[i % posts.length], `n` at most SIEGE_GUARDS_MAX. */
export function siegeGuardPosts(field, n) {
  const posts = [field?.throne, ...(field?.banners ?? [])].filter(Boolean);
  if (!posts.length) return [];
  return Array.from({ length: Math.max(0, Math.min(SIEGE_GUARDS_MAX, Math.floor(Number(n) || 0))) }, (_, i) => [posts[i % posts.length][0], posts[i % posts.length][1]]);
}
/** A REVOLT'S POSTS (7.7: "a Rebel Captain ... and 12 rebels at the palace door"): the Captain at the Throne's point, rebel
 *  i on the ring SIEGE_REBEL_RING_M about it at i twelfths of a turn (whole room units). */
export function siegeRebelPosts(field) {
  const [x, z] = field.throne, r = SIEGE_REBEL_RING_M * SIEGE_UNITS_PER_M;
  const at = (i) => { const a = (2 * Math.PI * i) / SIEGE_REVOLT.rebels; return [Math.round(x + r * Math.cos(a)) || 0, Math.round(z + r * Math.sin(a)) || 0]; };   // never a -0
  return { captain: [x, z], rebels: Array.from({ length: SIEGE_REVOLT.rebels }, (_, i) => at(i)) };
}
/** A figure as the battle keeps it: standing whole at its post. `upAt` its rise once fallen (null: never), `safeTo` the
 *  end of its protection, `swingAt` its next swing, `target` the account it engages, `act` 0 stands, 1 walks, 2 strikes. */
const newFigure = (id, kind, post) => {
  const max = siegeFigureVitality(kind);
  return { id, kind, post: [post[0], post[1]], x: post[0], z: post[1], tx: post[0], tz: post[1], hp: max, max, down: false, upAt: 0, safeTo: 0, swingAt: 0, target: null, act: 0 };
};
/**
 * A BATTLE'S WORKS AND FIGURES off its pass's `sx` (`works`: `[walls, gate, guards, rams, ramHp]` - net/identityToken.js
 * siegeWorksValid; absent, none): the Walls' tier; the Gatehouse `{ hp, max }` (a siege's alone, or none); the Ram Kits
 * still to field and each one's vitality, the first due at the start; the figures - a siege's Barracks' guards at their
 * posts (`~g1`..), a revolt's Captain (`~c`) and twelve (`~r1`..), never a Tourney's.
 */
export function siegeWorksOf({ kind, startMs, field, works }) {
  const [walls, gate, guards, rams, ramHp] = Array.isArray(works) && works.length === 5 ? works : SIEGE_NO_WORKS;
  const gated = kind === 'siege' && gate > 0;
  let figures = [];
  if (kind === 'siege') figures = siegeGuardPosts(field, guards).map((p, i) => newFigure(`~g${i + 1}`, 'guard', p));
  else if (kind === 'revolt') { const p = siegeRebelPosts(field); figures = [newFigure('~c', 'captain', p.captain), ...p.rebels.map((q, i) => newFigure(`~r${i + 1}`, 'rebel', q))]; }
  return {
    walls, gate: gated ? { hp: gate, max: gate } : null, breached: false,
    ramsLeft: gated ? rams : 0, ramHp: gated ? ramHp : 0, ram: null, ramAt: startMs, worksAt: startMs,
    figures, figAt: startMs, ground: null,
  };
}
/** The Barracks' guards standing within a point's radius - each on the field's ground, so its flat distance alone. */
function guardsAt(b, point) {
  let n = 0;
  for (const g of b.figures ?? []) if (g.kind === 'guard' && !g.down && Math.hypot((g.x - point[0]) / SIEGE_UNITS_PER_M, (g.z - point[1]) / SIEGE_UNITS_PER_M) <= SIEGE_BANNER.radiusM) n++;
  return n;
}
/** WHERE A RAM STANDS (6.2; RAM_OFFSET_M's DECIDED): SIEGE_RAM.offsetM before the Gatehouse - the Throne's point - on the
 *  line to the attackers' camp, in whole room units (at the camp itself where the camp is nearer - at the gate where the
 *  camp stands on it). */
export function siegeRamPoint(field) {
  const [gx, gz] = field.throne, [cx, cz] = field.camps.attack;
  const k = Math.min(1, (SIEGE_RAM.offsetM * SIEGE_UNITS_PER_M) / Math.hypot(cx - gx, cz - gz));
  return [Math.round(gx + (cx - gx) * k), Math.round(gz + (cz - gz) * k)];
}
/** Whether a Ram waits to be fielded: none standing, and kits left - never where no Gatehouse stands (siegeWorksOf), nor
 *  past its breach (breach spends them). */
export const siegeRamDue = (b) => !b.ram && (b.ramsLeft ?? 0) > 0;
/** BREACHED, for good (6.2): the Gatehouse at nought; its Ram's work done - gone - and none fielded after (the contract:
 *  "No Rams where no Gatehouse stands, nor once it is breached"). */
function breach(b) { b.breached = true; b.ram = null; b.ramsLeft = 0; }
/** A RAM DESTROYED (6.2: "a destroyed Ram is gone"): the next fielded at the attackers' next wave. */
function ramGone(b, now) { b.ram = null; b.ramAt = siegeNextWave(now, siegeSideWaveMs(b.tier, 'attack', b.walls)); }

/**
 * THE WORKS, ONE BEAT (6.2): `fighters` as battleStep takes them. A Ram is fielded when its time comes (the first at the
 * start, each next at the attackers' next wave after the last fell) while kits are left and the Gatehouse stands; its
 * CREW is the standing attackers in the room within SIEGE_RAM.crewM of it (flat, and within SIEGE_HEIGHT_M of the field's
 * ground); while two or more crew it its swing fills by the crewed time (paused, never emptied, while it is not - a beat
 * counts five seconds at most, as battleStep's), and each SIEGE_RAM.everyMs of it strikes the Gatehouse for its damage - at
 * nought it is breached. Answers the beat's events: `{ k: 'ram' }` (fielded), `{ k: 'rammed', hp }`, `{ k: 'breach' }`.
 */
export function siegeWorksStep(b, fighters, nowMs) {
  if (!b.gate || b.result) return [];   // before the start no Ram stands, nor is one due (the first comes at the start)
  const dt = Math.max(0, Math.min(nowMs - Math.max(b.worksAt ?? b.startMs, b.startMs), 5 * SIEGE_TICK_MS));
  b.worksAt = nowMs;
  const out = [];
  let fresh = false;
  if (siegeRamDue(b) && nowMs >= b.ramAt) {
    b.ramsLeft -= 1;
    b.ram = { hp: b.ramHp, max: b.ramHp, swing: 0, crew: 0, at: siegeRamPoint(b.field) };
    fresh = true;
    out.push({ k: 'ram' });
  }
  if (!b.ram) return out;
  const ground = siegeGround(fighters);
  let crew = 0;
  for (const f of fighters) {
    if (f.down || !f.pose || !f.here || f.side !== 'attack') continue;
    if (flat(f.pose, b.ram.at) > SIEGE_RAM.crewM) continue;
    if (Math.abs(f.pose.y - ground) / SIEGE_UNITS_PER_M > SIEGE_HEIGHT_M) continue;   // a crewman is one the ground counts
    crew++;
  }
  b.ram.crew = crew;
  if (fresh || crew < SIEGE_RAM.crew) return out;   // a Ram just fielded swings from now; an uncrewed one waits, its swing kept
  b.ram.swing += dt;
  while (b.ram && b.ram.swing >= SIEGE_RAM.everyMs) {
    b.ram.swing -= SIEGE_RAM.everyMs;
    b.gate.hp = Math.max(0, b.gate.hp - SIEGE_RAM.damage);
    out.push({ k: 'rammed', hp: b.gate.hp });
    if (b.gate.hp <= 0) { breach(b); out.push({ k: 'breach' }); }
  }
  return out;
}

/** WHO MAY STRIKE A FIGURE OR A WORK (`id`, net/wire.js's figure and work ids) of battle `b`: a sided fighter - the
 *  attackers the Gatehouse and the Barracks' guards (they fight for the holder), the defenders (a revolt's holder's side)
 *  a Ram, the rebels and their Captain; never a spectator, an unsided fighter or a Royal Tourney's contender. */
export function siegeMayStrike(b, by, id) {
  if (!b || !by) return false;
  if (id === '~gate') return by.side === 'attack' && !!b.gate;
  if (id === '~ram') return by.side === 'defend' && !!b.ram;
  const g = (b.figures ?? []).find((x) => x.id === id);
  return !!g && by.side === (g.kind === 'guard' ? 'attack' : 'defend');
}
const refused = (why) => ({ ok: false, dealt: 0, fell: false, why });
/**
 * A BLOW AT A WORK, JUDGED (6.2) beside refereeBlow and BY it: the referee's own checks (both standing, the striker's
 * bucket, the weapon held and its kind, the reach from `from` to the work's point `at`) on a stand-in that takes any
 * blow, its damage clipped as any blow's; the work then takes its `share` of the clipped damage - rounded, at least 1 (the
 * Gatehouse a tenth; a Ram the whole). Answers `{ ok, dealt, fell, why }` - `dealt` what the work took, `fell` it at
 * nought.
 * @param {any} by @param {any} work
 * @param {{ from?: any, at?: any, held?: any, d?: number, r?: number, share?: number }} o
 * @param {number} now
 */
export function refereeWorkBlow(by, work, { from = null, at = null, held = null, d = 0, r = SIEGE_HIT.Melee, share = 1 } = {}, now) {
  if (!by || !work || !(work.hp > 0)) return refused('no-work');
  const res = refereeBlow(by, { hp: Infinity, max: Infinity, down: false, safeTo: 0 }, { from, at, held, d, r }, now);
  if (!res.ok) return res;
  const got = res.dealt > 0 ? Math.min(work.hp, Math.max(1, Math.round(res.dealt * share))) : 0;
  by.dealt += got - res.dealt;   // the striker's count is what the work took
  work.hp -= got;
  return { ok: true, dealt: got, fell: work.hp <= 0, why: null };
}
/**
 * A FIGHTER'S BLOW AT A WORK OF THE BATTLE (`id` '~gate' or '~ram'), while the battle runs (nothing lands at or past its
 * end) and by its side (siegeMayStrike): judged from the striker's pose `from` to the Gatehouse at the Throne's point or
 * a Ram at its own, each at the field's ground (`b.ground`; the striker's own height before the first beat keeps one).
 * The Gatehouse at nought is BREACHED for good; a Ram at nought is gone, the next fielded at the attackers' next wave.
 * `{ ok, dealt, fell, why }`.
 */
export function siegeWorkBlow(b, by, id, { from = null, held = null, d = 0, r = SIEGE_HIT.Melee } = {}, now) {
  if (!b || b.result || now < b.startMs || now >= b.endMs) return refused('time');
  if (!siegeMayStrike(b, by, id)) return refused('side');
  const gate = id === '~gate';
  const work = gate ? b.gate : b.ram;
  const p = work ? (gate ? b.field.throne : b.ram.at) : null;
  const at = p ? { x: p[0], y: b.ground ?? from?.y, z: p[1] } : null;
  const res = refereeWorkBlow(by, work, { from, at, held, d, r, share: gate ? SIEGE_GATEHOUSE.blowShare : 1 }, now);
  if (res.fell) { if (gate) breach(b); else ramGone(b, now); }
  return res;
}
/** When a fallen figure rises (7.5, 7.7): a guard at the defenders' next wave (the Walls' own), a rebel at the revolt's
 *  thirty seconds, the Captain never (null). */
export const siegeFigureRise = (b, g, now) => (g.kind === 'captain' ? null
  : siegeNextWave(now, g.kind === 'guard' ? siegeSideWaveMs(b.tier, 'defend', b.walls) : SIEGE_REVOLT.rebelsWaveMs));
/**
 * A FIGHTER'S BLOW OR CAST AT A FIGURE (`id`): judged by the referee itself - refereeBlow or refereeCast, the figure the
 * target, its pose the field's ground at its feet - while the battle runs and by its side (siegeMayStrike); never a heal
 * (no figure is a side-mate). A fall is the striker's `felled` (6.8: "felled a foe") and sets the figure's rise
 * (siegeFigureRise). `{ ok, dealt, fell, why }`.
 */
export function siegeFigureBlow(b, by, id, { from = null, held = null, d = 0, r = SIEGE_HIT.Melee, cast = false } = {}, now) {
  if (!b || b.result || now < b.startMs || now >= b.endMs) return refused('time');
  if (!siegeMayStrike(b, by, id)) return refused('side');
  const g = b.figures.find((x) => x.id === id);
  const at = { x: g.x, y: b.ground ?? from?.y, z: g.z };
  const res = cast ? refereeCast(by, g, { from, at, d }, now) : refereeBlow(by, g, { from, at, held, d, r }, now);
  if (res.fell) {
    by.felled = (by.felled ?? 0) + 1;
    Object.assign(g, { upAt: siegeFigureRise(b, g, now), act: 0, tx: g.x, tz: g.z });
  }
  return res;
}

/**
 * THE FIGURES' BRAIN, ONE BEAT (7.5: "relay-run town guards fight for the holder ... the gate's brain with adds"; 7.7) -
 * `fighters` the room's `{ [account]: { side, pose, down, here, safeTo, hp, max } }`, `rand01` the room's draw. A fallen
 * figure whose wave has come rises at its post, whole, protected SIEGE_PROTECT_MS. A standing one keeps its foe while that
 * foe is FAIR - standing, here, of the side it fights (a guard the attackers; a rebel and the Captain the defenders),
 * unprotected, within SIEGE_HEIGHT_M of the field's ground - and within its leash of the post; else engages the nearest
 * fair fighter within its aggro (DECIDED here: aggro to engage, leash to let go - the gate's brain keeps its target a while
 * too, so a figure does not turn from one fighter to the next each beat); it walks at its pace toward its foe, stopping
 * at its reach, or home to its post; and strikes its foe within its reach and the referee's slack (SIEGE_REACH, from its
 * feet on the ground) when its swing is due - a roll in its blow, never past the vitality left; a fall's wave the
 * fighter's own side's. Nothing before the start or after the end. Answers the beat's events: `{ k: 'hit', id, to, h, m,
 * fell }` (a fighter struck - `to` its account, `h` and `m` its vitality), `{ k: 'rise', id }`.
 */
export function siegeFiguresStep(b, fighters, nowMs, rand01 = Math.random) {
  if (!b.figures?.length || b.result || nowMs < b.startMs) return [];
  const dt = Math.max(0, Math.min(nowMs - Math.max(b.figAt ?? b.startMs, b.startMs), 5 * SIEGE_TICK_MS)) / 1000;
  b.figAt = nowMs;
  const all = Object.entries(fighters ?? {});
  const ground = siegeGround(all.map(([, f]) => f));
  const out = [];
  for (const g of b.figures) {
    if (g.down) {
      if (g.upAt == null || nowMs < g.upAt) continue;
      Object.assign(g, { down: false, hp: g.max, x: g.post[0], z: g.post[1], tx: g.post[0], tz: g.post[1], upAt: 0, safeTo: nowMs + SIEGE_PROTECT_MS, target: null, act: 0 });
      out.push({ k: 'rise', id: g.id });
      continue;
    }
    const law = SIEGE_FIGURE_KINDS[g.kind];
    const foeSide = g.kind === 'guard' ? 'attack' : 'defend';
    const fair = (f) => !!f && !f.down && !!f.pose && !!f.here && f.side === foeSide && nowMs >= (f.safeTo ?? 0)
      && Math.abs(f.pose.y - ground) / SIEGE_UNITS_PER_M <= SIEGE_HEIGHT_M && flat(f.pose, g.post) <= law.leashM;   // one fair is one the ground counts
    let foe = g.target != null && fair(fighters[g.target]) ? g.target : null;
    if (foe == null) {
      let best = Infinity;
      for (const [sub, f] of all) {
        if (!fair(f)) continue;
        const d = flat(f.pose, [g.x, g.z]);
        if (d <= law.aggroM && d < best) { best = d; foe = sub; }
      }
    }
    g.target = foe;
    const f = foe == null ? null : fighters[foe];
    const goal = f ? [f.pose.x, f.pose.z] : g.post;
    const gap = Math.hypot((goal[0] - g.x) / SIEGE_UNITS_PER_M, (goal[1] - g.z) / SIEGE_UNITS_PER_M);
    const walk = Math.min(Math.max(0, gap - (f ? law.reachM : 0)), law.speedMps * dt);
    g.tx = goal[0]; g.tz = goal[1]; g.act = 0;
    if (walk > 0) { g.x += ((goal[0] - g.x) * walk) / gap; g.z += ((goal[1] - g.z) * walk) / gap; g.act = 1; }
    if (!f || nowMs < g.swingAt || metres({ x: g.x, y: ground, z: g.z }, f.pose) > law.reachM + SIEGE_REACH.slack) continue;
    const [lo, hi] = law.blow;
    const got = Math.min(f.hp, lo + Math.floor(rand01() * (hi - lo + 1)));   // the draw in [0, 1): lo to hi, whole
    f.hp -= got;
    const fell = f.hp <= 0;
    if (fell) { f.down = true; f.upAt = siegeNextWave(nowMs, siegeSideWaveMs(b.tier, f.side, b.walls)); }
    g.swingAt = nowMs + law.swingMs; g.act = 2;
    out.push({ k: 'hit', id: g.id, to: foe, h: f.hp, m: f.max, fell });
  }
  return out;
}

/** THE WORKS' FRAME (net/wire.js `w`, each beat while a battle has a Gatehouse - a Ram and its kits are a Gatehouse's
 *  alone, siegeWorksOf): the Gatehouse `[hp, max]`, breached 1 or 0, the standing Ram `[hp, max, crew, swing]` (its crew
 *  at most a roll call's, its swing in whole crewed seconds - drained below SIEGE_RAM.everyMs each beat) or 0, the Ram
 *  Kits still to field - or null for a battle with no Gatehouse. */
export function siegeWorksFrame(b) {
  if (!b?.gate) return null;
  const ram = b.ram ? [b.ram.hp, b.ram.max, Math.min(SIEGE_FIGHTERS_MAX, b.ram.crew), Math.floor(b.ram.swing / 1000)] : 0;
  return { k: 'w', g: [b.gate.hp, b.gate.max], br: b.breached ? 1 : 0, r: ram, rl: b.ramsLeft };
}
/** THE FIGURES' FRAME (net/wire.js `n`, each beat while any stands): each `[id, kind, x, z, tx, tz, hp, max, down, act]`,
 *  in whole room units - or null for a battle with none. */
export function siegeFiguresFrame(b) {
  if (!b?.figures?.length) return null;
  return { k: 'n', n: b.figures.map((g) => [g.id, SIEGE_FIGURE_CODE[g.kind], Math.round(g.x), Math.round(g.z), Math.round(g.tx), Math.round(g.tz), g.hp, g.max, g.down ? 1 : 0, g.act]) };
}

// ═════════════════════════════════════════════════════════════════════
// CROWN1 part two (2026-10-01, Mac: "Finish the seats"; "Continue";
// "Hurry up") - THE ROYAL TOURNEY (Seats-Arc 7.6): "a duel ladder all week
// in the crown's city, at the castle's entrance square: DUEL1's ring, but
// every blow refereed by PVP-REF in a siege:-shaped room - a
// defender-resolved duel cannot award a title - the relay keeping the
// ladder". Its room is `royal:<crown seat key>:<seat week>` (DECIDED: not
// `siege:` itself - a crown's siege and its Royal Tourney may fall in the
// same week), open the whole week its Edict rules, by the service's pass
// (`sn` 'royal': a contender `duel`, or a spectator). One bout at a time in
// the ring: a contender challenges another, the other accepts, both are
// set on their marks whole, and after DUEL1's countdown only the two may
// strike each other - the referee above judging every blow, the ring held
// by the step (a bout's fighter past its edge pulled back). A fall ends the
// bout; DUEL1's longest a draw; a bout's fighter gone from the room loses.
// The winner is handed a signed receipt (net/siegeReceipt.js `t1`), the
// ladder counts it - the same two at most ROYAL_PAIR_DAY_MAX a UTC day,
// as the service counts the receipts it is given (the champion is the
// service's to name, at the Turning). Pure, as above.
// ═════════════════════════════════════════════════════════════════════

/** A Royal Tourney's room - one a crown a week. */
export const ROYAL_ROOM = /^royal:(0|[1-9]\d{0,9}):(0|[1-9]\d{0,5})$/;
export const royalRoomKey = (key, week) => `royal:${key}:${week}`;
export const isRoyalRoom = (k) => ROYAL_ROOM.test(String(k ?? ''));
/** A room the referee keeps: a siege's, or a Royal Tourney's. */
export const isBattleRoom = (k) => isSiegeRoom(k) || isRoyalRoom(k);
/** A battle room's kind, seat and week - `{ kind: 'siege' | 'royal', key, week }` - or null. */
export function battleOfRoom(k) {
  const s = siegeOfRoom(k);
  if (s) return { kind: 'siege', ...s };
  const m = ROYAL_ROOM.exec(String(k ?? ''));
  return m ? { kind: 'royal', key: Number(m[1]), week: Number(m[2]) } : null;
}
/** THE RING - DUEL1's (net/duelSession.js DUEL_RADIUS_M, DUEL_COUNTDOWN_MS, DUEL_MAX_MS, DUEL_ASK_TTL_MS, DUEL_GONE_MS,
 *  DUEL_OUT_SLACK_M - pinned equal: this leaf imports nothing): its radius, the countdown, a bout's longest (then a draw),
 *  how long an ask stands, how long a bout's fighter may be gone from the room before it loses, the slack past the edge
 *  a step is given; and DECIDED here, each fighter's mark this far either side of the centre. */
export const ROYAL_RING = Object.freeze({ radiusM: 12, countdownMs: 3000, boutMs: 5 * 60_000, askMs: 30_000, goneMs: 10_000, outSlackM: 4, markM: 4 });
/** DECIDED: the same two contenders' bouts count at most this many a UTC day - a rematch or two, never a farm (the
 *  service's own count, net/townSeatLaw.js ROYAL_PAIR_DAY, pinned equal). */
export const ROYAL_PAIR_DAY_MAX = 3;
/** The ladder's rows the room says. */
export const ROYAL_LADDER_SHOWN = 10;
/** A winner's receipts the room keeps for its reconnect, newest last. */
export const ROYAL_RC_KEEP = 20;

/** A Royal Tourney's field as its pass carries it: the ring's centre, one point - `{ ring: [x, z] }`, or null. */
export function royalFieldOf(sf) {
  if (!Array.isArray(sf) || sf.length !== 1) return null;
  const p = sf[0];
  if (!Array.isArray(p) || p.length !== 2 || !p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e9)) return null;
  return { ring: [p[0], p[1]] };
}
/** A NEW ROYAL TOURNEY: no bout, an empty ladder. */
export const newRoyal = ({ startMs, endMs, field }) => ({
  kind: 'royal', tier: 'crown', startMs, endMs, field, bout: null, n: 0, ladder: {}, pairs: {}, asks: {}, at: startMs, result: null,
});
const utcDayOf = (ms) => Math.floor(ms / 86_400_000);
const pairOf = (x, y, ms) => `${x < y ? x : y}|${x < y ? y : x}|${utcDayOf(ms)}`;
/** A CHALLENGE: `from` asks `to` (account subjects) - it stands ROYAL_RING.askMs. A reason it may not, or null. */
export function royalAsk(b, from, to, now) {
  if (b?.kind !== 'royal' || b.result || now < b.startMs || now >= b.endMs) return 'the tourney is not open';
  if (!from || !to || from === to) return 'no such contender';
  if (b.bout && [b.bout.a, b.bout.b].some((x) => x === from || x === to)) return 'a bout is on';
  b.asks[from] = { to, at: now };
  return null;
}
/** AN ACCEPT: `by` takes `from`'s standing challenge, and the bout begins - after the countdown, to DUEL1's longest (never
 *  past the week). One at a time: refused while the ring holds another. `{ bout }` or `{ no }`. */
export function royalAccept(b, by, from, now) {
  if (b?.kind !== 'royal' || b.result || now >= b.endMs - ROYAL_RING.countdownMs) return { no: 'the tourney is not open' };
  const ask = b.asks[from];
  if (!ask || ask.to !== by || now - ask.at > ROYAL_RING.askMs) return { no: 'no such challenge' };
  if (b.bout) return { no: 'the ring is taken' };
  delete b.asks[from];
  b.n += 1;
  const startMs = now + ROYAL_RING.countdownMs;
  b.bout = { n: b.n, a: from, b: by, startMs, endMs: Math.min(b.endMs, startMs + ROYAL_RING.boutMs), gone: {} };
  return { bout: b.bout };
}
/** The bout's two marks as poses - the challenger's west of the centre, the other's east, each facing it (the height
 *  kept from `was`, the ground's to settle). */
export function royalMarks(b, wasA, wasB) {
  const [x, z] = b.field.ring, d = ROYAL_RING.markM * SIEGE_UNITS_PER_M;
  const at = (dx, was, yaw) => ({ x: x + dx, y: Number.isFinite(was?.y) ? was.y : 0, z, yaw, pitch: 0 });
  return [at(-d, wasA, Math.PI / 2), at(d, wasB, -Math.PI / 2)];
}
/** Whether `by` may strike `to` now: the running bout's two, its countdown run. */
export const royalMayStrike = (b, by, to, now) => !!b?.bout && now >= b.bout.startMs && now < b.bout.endMs
  && ((b.bout.a === by && b.bout.b === to) || (b.bout.b === by && b.bout.a === to));
/** Whether a bout's fighter may step to `p` - within the ring and its slack; anyone else anywhere. */
export function royalStepOk(b, sub, p) {
  if (!b?.bout || (b.bout.a !== sub && b.bout.b !== sub) || !p) return true;
  return Math.hypot((p.x - b.field.ring[0]) / SIEGE_UNITS_PER_M, (p.z - b.field.ring[1]) / SIEGE_UNITS_PER_M) <= ROYAL_RING.radiusM + ROYAL_RING.outSlackM;
}
/** A BOUT ENDED - `winner` its subject, or null for a draw: the ladder's win and loss, where the same two have not met
 *  ROYAL_PAIR_DAY_MAX times today (`counted`). `{ n, w, l, a, b, counted }` (`w`, `l` null in a draw), or null. */
export function royalEnd(b, winner, now) {
  const bt = b?.bout;
  if (!bt) return null;
  b.bout = null;
  const loser = winner === bt.a ? bt.b : winner === bt.b ? bt.a : null;
  let counted = false;
  if (loser) {
    const k = pairOf(bt.a, bt.b, now);
    counted = (b.pairs[k] ?? 0) < ROYAL_PAIR_DAY_MAX;
    if (counted) {
      b.pairs[k] = (b.pairs[k] ?? 0) + 1;
      (b.ladder[winner] ??= { w: 0, l: 0 }).w++;
      (b.ladder[loser] ??= { w: 0, l: 0 }).l++;
      (b.wonAt ??= {})[winner] = now;   // AUDIT-SEATS R10: its last counted win, on the room's clock (royalLadder's tie)
    }
  }
  return { n: bt.n, w: loser ? winner : null, l: loser, a: bt.a, b: bt.b, counted };
}
/** ONE BEAT OF A ROYAL TOURNEY: the lapsed asks forgotten; a bout past its time a draw; a bout's fighter gone from the room
 *  (`here(sub)` false) ROYAL_RING.goneMs loses it; at the week's end any bout a draw and the tourney over. Answers its
 *  events - `{ k: 'bout', ...royalEnd }`, `{ k: 'end', result: 'over' }`. */
export function royalStep(b, here, now) {
  if (b?.kind !== 'royal' || b.result) return [];
  const out = [];
  for (const [k, a] of Object.entries(b.asks)) if (now - a.at > ROYAL_RING.askMs) delete b.asks[k];
  const bt = b.bout;
  if (bt && now >= bt.endMs) out.push({ k: 'bout', ...royalEnd(b, null, now) });
  else if (bt) {
    for (const who of [bt.a, bt.b]) {
      if (here(who)) { delete bt.gone[who]; continue; }
      bt.gone[who] ??= now;
      if (now - bt.gone[who] >= ROYAL_RING.goneMs) { out.push({ k: 'bout', ...royalEnd(b, who === bt.a ? bt.b : bt.a, now) }); break; }
    }
  }
  if (now >= b.endMs) {
    if (b.bout) out.push({ k: 'bout', ...royalEnd(b, null, now) });
    b.result = 'over';
    out.push({ k: 'end', result: 'over' });
  }
  b.at = now;
  return out;
}
/** THE LADDER as the room says it: `[subject, wins, losses]`, the most wins first, then the fewest losses - AUDIT-SEATS
 *  R10: then the EARLIER last win, then the account: the service's champion rule (net/townSeatLaw.js royalStandings),
 *  so the room's first row is the one the Turning crowns. The tie went to the account alone, and with b winning first
 *  and a later the room showed a over b while the service crowned b. The last win is `b.wonAt` (royalEnd - the ladder's
 *  rows keep their `{ w, l }`); a contender with none (losses alone) reads 0, as the service's does. */
export const royalLadder = (b) => Object.entries(b?.ladder ?? {})
  .sort(([x, p], [y, q]) => q.w - p.w || p.l - q.l || (b.wonAt?.[x] ?? 0) - (b.wonAt?.[y] ?? 0) || (x < y ? -1 : 1)).slice(0, ROYAL_LADDER_SHOWN).map(([sub, r]) => [sub, r.w, r.l]);
/**
 * AUDIT-SEATS R5: THE CONTENDERS' RECORDS PRUNED - a contender whose socket is gone (`here(sub)` false) and who holds
 * nothing of the tourney (no ladder row, not in the bout, no challenge standing from or to it) is forgotten. Its record
 * is a whole fighter at its Renown (every bout ends both whole), so one that comes back is made again the same. The
 * field's bound was a count of records never deleted - forty-eight contenders entering on a Monday and leaving held the
 * ring shut to everyone until the Turning; the room's bound is now the contenders IN it (the relay's), and this keeps the
 * records it stores to the ones that mean something. Answers how many went.
 */
export function royalPrune(b, fighters, here) {
  let n = 0;
  const asked = new Set(Object.values(b?.asks ?? {}).map((a) => a.to));
  for (const sub of Object.keys(fighters ?? {})) {
    if (here(sub) || b?.ladder?.[sub] || b?.bout?.a === sub || b?.bout?.b === sub || b?.asks?.[sub] || asked.has(sub)) continue;
    delete fighters[sub];
    n++;
  }
  return n;
}
/** A Royal Tourney's next beat: each second while a bout is on (its draw, a fighter gone), else at the week's end. */
export function royalNextBeat(b, now) {
  if (b.bout) return Math.min(now + SIEGE_TICK_MS, Math.max(now + 1, b.bout.endMs));
  return Math.max(now + 1, b.endMs);
}
