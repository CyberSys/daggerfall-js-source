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
//   - A STEP: no faster than 18 m/s across the ground and half a metre
//     (MEASURED below); past it the relay pulls the fighter back to its
//     last good pose. A fall is gravity's, never refused.
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
/**
 * THE WEAPON A STRIKER HOLDS, off its look (net/wire.js validLook's items): the claimed template and material where a
 * `Weapons` item of the look carries them, else null - hand-to-hand (`w` -1) is always held.
 */
export function siegeHeld(look, w, m) {
  if (w === -1 || w == null) return { w: -1, m: 0 };
  const it = (look?.items ?? []).find((i) => i?.group === 'Weapons' && i.templateIndex === w && (i.material ?? 0) === m);
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

/**
 * A STEP JUDGED (6.1): `next` a pose `dtMs` after `last` (both in the room's units) - kept when it moved ACROSS THE GROUND
 * no faster than SIEGE_SPEED and its slack, else refused (the relay pulls the fighter back to `last`). A first pose is
 * always kept. The height is not judged (DECIDED): a fall from a wall is gravity's and outruns any run, and a climb
 * buys no reach - a blow's reach is measured in all three.
 */
export function refereeStep(last, next, dtMs) {
  if (!last) return true;
  const allowed = SIEGE_SPEED.mps * Math.max(0, dtMs) / 1000 + SIEGE_SPEED.slackM;
  return Math.hypot((next.x - last.x) / SIEGE_UNITS_PER_M, (next.z - last.z) / SIEGE_UNITS_PER_M) <= allowed;
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
/** THE THRONE (6.2): open to the attackers while they hold 2 of a palace's 3 banners (3 of a crown's 4 - DECIDED: until
 *  SEAT2b raises the Gatehouse, the banners alone open a crown's Throne); held uncontested 120 seconds at a palace, 180
 *  at a crown, takes the seat; its progress decays 1 second a second while it is not held. */
export const SIEGE_THRONE = Object.freeze({ palace: Object.freeze({ banners: 2, holdS: 120 }), crown: Object.freeze({ banners: 3, holdS: 180 }), decayPerS: 1 });
/** How long a battle runs, ms (6.2, 6.7 - net/townSeatLaw.js BATTLE_LENGTH_MS, pinned equal: the relay bundles this leaf). */
export const SIEGE_LENGTH_MS = Object.freeze({ palace: 30 * 60_000, crown: 45 * 60_000, tourney: 20 * 60_000 });
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
export function fieldOf(sf, tier) {
  const n = siegeBannerCount(tier);
  if (!Array.isArray(sf) || sf.length !== n + 3) return null;
  if (!sf.every((p) => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isFinite(v) && Math.abs(v) <= 1e9))) return null;
  return { banners: sf.slice(0, n).map((p) => [p[0], p[1]]), throne: [sf[n][0], sf[n][1]], camps: { attack: [sf[n + 1][0], sf[n + 1][1]], defend: [sf[n + 2][0], sf[n + 2][1]] } };
}

/** A NEW BATTLE: a siege's banners start the holder's (`defend`), a Tourney's no one's. */
export function newBattle({ kind, tier, startMs, field }) {
  const length = kind === 'tourney' ? SIEGE_LENGTH_MS.tourney : (SIEGE_LENGTH_MS[tier] ?? SIEGE_LENGTH_MS.palace);
  return {
    kind, tier, startMs, endMs: startMs + length, field,
    banners: field.banners.map(() => ({ side: kind === 'tourney' ? null : 'defend', raise: 0, by: null })),
    throne: 0, raised: false, attackSeen: false, defendSeen: false, at: startMs, result: null,
  };
}
const flat = (p, q) => Math.hypot((p.x - q[0]) / SIEGE_UNITS_PER_M, (p.z - q[1]) / SIEGE_UNITS_PER_M);
/** The standing fighters of each side within a point's radius. */
function presentAt(fighters, point) {
  let attack = 0, defend = 0;
  for (const f of fighters) {
    if (f.down || !f.pose || !f.here) continue;
    if (flat(f.pose, point) > SIEGE_BANNER.radiusM) continue;
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
  b.banners.forEach((bn, i) => {
    const p = presentAt(fighters, b.field.banners[i]);
    const alone = p.attack && !p.defend ? 'attack' : p.defend && !p.attack ? 'defend' : null;
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
    const open = b.banners.filter((bn) => bn.side === 'attack').length >= rule.banners;
    const p = presentAt(fighters, b.field.throne);
    if (open && p.attack && !p.defend) b.throne += dt;
    else if (!(open && p.attack && p.defend)) b.throne = Math.max(0, b.throne - SIEGE_THRONE.decayPerS * dt);
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
/** A side's camp as a pose (6.2: the fallen rise there, a fighter enters there) - the height and facing kept from `was`,
 *  the ground's to settle. */
export const siegeCampPose = (b, side, was) => {
  const c = b.field.camps[side];
  return { x: c[0], y: Number.isFinite(was?.y) ? was.y : 0, z: c[1], yaw: Number.isFinite(was?.yaw) ? was.yaw : 0, pitch: 0 };
};
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
 *  first - so a battle ends on its own clock, never a beat late. */
export function siegeNextBeat(b, now) {
  let next = now + SIEGE_TICK_MS;
  const marks = [b.startMs, b.endMs];
  if (b.kind === 'siege' && !b.attackSeen) marks.push(b.startMs + SIEGE_FORFEIT_MS);
  for (const m of marks) if (m > now && m < next) next = m;
  return next;
}
