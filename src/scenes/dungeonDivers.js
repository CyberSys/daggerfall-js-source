// @ts-check
// ═══════════════════════════════════════════════════════════════════
// LW6 (2026-10-05, bible/06-Systems/Living-World.md): THE DIVERS MET - a party of the living world's adventurers inside
// the dungeon the player is in. Mac: "You can find them dungeon diving, make friends or enemies".
//
// A dive is pure (systems/livingWorld/trips.js diveTrip, diversAt): every reader's world holds the same company in the
// same dungeon for the same hours, and the deep's fated end (trouble.js diveTrouble). A player in that dungeon during
// its dive - the one to stand it (the camps' election online; offline always) - MEETS it: its members stood as the
// player's allies (the dungeon's own loose stand, allied: team PlayerAlly, a `shipmate`), behind the player, by name,
// class and level, and they keep with the player through the halls (the motor's own follow - characters/
// enemyMotor.js `follow`) until their hours are up.
// THE END IS WHAT HAPPENS. One cut down beside the player FELL (the character's turn: the place stands empty, a
// newcomer comes). Their hours done, the company makes for the surface: each the deep would have taken who still
// stands is SPARED, and every survivor's regard moved (`helped`; the spared `saved`). A party the dive no longer
// lists (its hours over, its leader fallen and its people out) is let go.
//
// EVERY ALLOCATION HAS AN OWNER: each body stood is this layer's until its company leaves; `clear()` (the dungeon
// left, a sweep) forgets every one - the dungeon's pool goes with its context.
// ═══════════════════════════════════════════════════════════════════

/** How far behind the player a company is stood when met (m), and how near each keeps (m, the first; each after a pace
 *  further). */
export const DIVER_STAND_M = 5;
export const DIVER_HEEL_M = 3;
export const DIVER_HEEL_STEP_M = 1.2;

/**
 * @param {{
 *   spawn: (mobileType: number, feet: number[], o: { yaw: number, level: number, gender: string }) => Promise<any>,
 *   remove: (rec: any) => void,
 *   inPool: (rec: any) => boolean,
 *   leader: () => ({ feet: number[], yaw: number } | null),
 *   spot: (from: number[], dx: number, dz: number) => number[],
 *   owner: () => boolean,
 *   relations: () => any,
 *   turnKeyOf: (res: any, trip: any) => string,
 *   dies: (res: any, trip: any) => boolean,
 *   day: () => number,
 *   say?: (text: string) => void,
 *   door?: any,
 * }} deps - `spot(from, dx, dz)` a place walked out from the player's feet (never inside a wall); `owner()` whether
 *   this player stands the divers here (the election); `day()` the living day (the regards' clock)
 */
export function createDungeonDivers(deps) {
  /** @type {Map<string, { trip: any, allies: Map<string, any>, fell: Set<string>, met: boolean }>} */
  const companies = new Map();

  const takeOut = (rec) => { try { if (deps.inPool(rec)) deps.remove(rec); } catch (e) { console.warn('[divers] a body would not leave', e?.message ?? e); } };
  function letGo(id) {
    const c = companies.get(id);
    if (!c) return;
    for (const rec of c.allies.values()) takeOut(rec);
    companies.delete(id);
  }
  const turn = (kind, key) => deps.relations?.()?.turn(kind, key);

  /** Meet a company: its members behind the player, keeping with them. */
  function meet(trip, members) {
    const L = deps.leader();
    if (!L) return;
    const c = { trip, allies: new Map(), fell: new Set(), met: true };
    companies.set(trip.id, c);
    members.forEach((m, i) => {
      if (m.cls == null) return;
      const side = (i - (members.length - 1) / 2) * 1.4;
      const back = DIVER_STAND_M + Math.floor(i / 3);
      const dx = -Math.sin(L.yaw) * back + Math.cos(L.yaw) * side, dz = -Math.cos(L.yaw) * back - Math.sin(L.yaw) * side;
      const feet = deps.spot(L.feet, dx, dz);
      Promise.resolve(deps.spawn(m.cls, feet, { yaw: L.yaw, level: m.level ?? 1, gender: m.sex ?? 'male' })).then((rec) => {
        if (!rec) return;
        if (companies.get(trip.id) !== c) { takeOut(rec); return; }
        rec.shipmate = true;
        rec.living = { id: m.id, res: m, town: deps.door ?? null };
        if (rec.entity) { rec.entity.name = m.name; rec.entity.team = 'PlayerAlly'; rec.entity.mobileTeam = 'PlayerAlly'; }
        if (rec.ai) rec.ai.follow = { feet: () => deps.leader()?.feet ?? null, stop: DIVER_HEEL_M + i * DIVER_HEEL_STEP_M };
        c.allies.set(m.id, rec);
      }).catch(() => {});
    });
    deps.say?.(`You meet ${trip.leader.name}'s company, come down into ${trip.to?.name ?? 'the deep'}.`);
  }

  return {
    /**
     * One frame in the dungeon: each company diving here met (this player standing it), each read - the fallen, the
     * hours done - and each the dive lists no longer let go. `divers` trips.js diversAt's, at the clock's minute `t`.
     * @param {{ trip: any, members: any[] }[]} divers @param {number} t
     */
    frame(divers, t) {
      const listed = new Set();
      for (const { trip, members } of divers) {
        listed.add(trip.id);
        if (!companies.has(trip.id) && deps.owner() && members.some((m) => m.cls != null)) meet(trip, members);
      }
      for (const [id, c] of [...companies]) {
        for (const [mid, rec] of c.allies) {
          if (!rec.dead || c.fell.has(mid)) continue;
          c.fell.add(mid);
          turn('fallen', deps.turnKeyOf(rec.living.res, c.trip));   // cut down beside the player
        }
        if (t >= c.trip.backT0 || !listed.has(id)) {
          // their hours done: the survivors make for the surface, the fated among them spared
          const rel = deps.relations?.();
          let left = 0;
          for (const [mid, rec] of c.allies) {
            if (c.fell.has(mid) || rec.dead) continue;
            const m = rec.living.res;
            const fated = deps.dies(m, c.trip);
            if (fated) turn('spared', deps.turnKeyOf(m, c.trip));
            rel?.note(m.id, fated ? 'saved' : 'helped', deps.day());
            left++;
          }
          if (left) deps.say?.(`${c.trip.leader.name}'s company make for the surface.`);
          letGo(id);
        }
      }
    },
    /** The companies met here (the probes; the pins). */
    companies: () => [...companies.values()],
    /** Every company forgotten (the dungeon left; a sweep) - its pool goes with it. */
    clear() { for (const id of [...companies.keys()]) letGo(id); },
    get size() { return companies.size; },
  };
}
