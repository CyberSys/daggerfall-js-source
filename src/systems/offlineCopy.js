// AUDIT LIVED1 E (S3/R5, and S5/U4's card): COPY TO OFFLINE CHANGES LANES, AND THE OFFLINE LANE HAS ONE CLOCK.
//
// An online save holds stamps on two clocks (LIVED1, bible/06-Systems/Lived-Time.md). The CHARACTER's - every
// personal marker: a room, a loan, a disease's day, a curse, the needs - sit on their own clock, which is the
// envelope's `classicMinutes`. The WORLD's - a quest clock's last sample, a CreateFoe's last wave, a PlaySound's last
// play, a guard's anchor, a quest's start and tombstone, the rumours' time limits, the spawned dungeons' ledger, a
// campfire's hours - sit on the shared clock, whose minute at the save rides beside it as `worldMinutes`.
//
// Offline there is ONE clock, and the load sets it from `classicMinutes`. The character's markers are in tune with it
// by construction; the world's are not - online the two clocks stand days or months apart (a real day away is twelve
// of the world's), and offline a quest clock charges its raw gap: a character four days ahead failed every timed
// quest on the first frame, one half a year behind gave every running clock half a year more, and a fire lit for
// eight hours burned for months. So the copy rebases the world's stamps onto the character's clock ONCE, by the
// distance between the two at the save - a quest's three days stay three days, a fire keeps its hours - and the
// envelope then says nothing of a world it no longer belongs to (`worldMinutes` goes, so every card reads the one
// clock the copy will play on). A snap with no `worldMinutes` (an offline save, or one from before LIVED1, whose two
// clocks were one) is returned as a plain copy.
//
// Pure JSON in, JSON out - no module state read.

/** The quest system's WORLD-clock stamps, in SECONDS (quest/clock.js, quest/actions.js saveShape, quest/quest.js,
 *  quest/onlineGuard.js). Zero is each one's "never" and stays zero. */
export const QUEST_WORLD_SECOND_KEYS = Object.freeze(['lastWorldTimeSample', 'lastTimePlayed', 'lastSpawnTime', 'guardAnchor', 'questStartTime', 'questTombstoneTime']);

const shiftQuestSeconds = (node, deltaSeconds) => {
  if (Array.isArray(node)) { for (const v of node) shiftQuestSeconds(v, deltaSeconds); return; }
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (QUEST_WORLD_SECOND_KEYS.includes(k)) { if (Number.isFinite(v) && v !== 0) node[k] = v + deltaSeconds; }
    else if (v && typeof v === 'object') shiftQuestSeconds(v, deltaSeconds);
  }
};

/** Every WORLD-clock stamp in the envelope moved by `delta` classic minutes (in place). */
function rebaseWorldStamps(copy, delta) {
  if (!delta) return copy;
  if (copy.quest) shiftQuestSeconds(copy.quest, delta * 60);
  for (const r of copy.talk?.listRumorMill ?? []) if (r && Number.isFinite(r.timeLimit) && r.timeLimit > 0) r.timeLimit += delta;   // a quest rumour's 0 is "no limit"
  if (Array.isArray(copy.spawns)) {
    copy.spawns = copy.spawns.map((row) => (Array.isArray(row) ? row.map((v, i) => (i > 0 && Number.isFinite(v) ? v + delta : v)) : row));   // [key, seen, cleared?]
  }
  for (const c of copy.world?.camps ?? []) {
    if (c && Number.isFinite(c.litUntil)) c.litUntil += delta;
    if (c && Number.isFinite(c.placedAt)) c.placedAt += delta;
  }
  return copy;
}

/** The copy an offline slot keeps: the world's stamps rebased onto the character's clock, `worldMinutes` dropped. */
export function offlineCopyOf(snap) {
  const copy = JSON.parse(JSON.stringify(snap ?? null));
  if (!copy || typeof copy !== 'object') return copy;
  const own = copy.classicMinutes, world = copy.worldMinutes;
  delete copy.worldMinutes;
  if (!Number.isFinite(own) || !Number.isFinite(world)) return copy;
  return rebaseWorldStamps(copy, Math.floor(own) - Math.floor(world));   // classic minutes: the character's clock less the world's
}

/** AUDIT LIVED1 G (R6, and the mirror of E): BRING ONLINE is the other door between the lanes. An offline envelope's
 *  world stamps sit on its one clock, which becomes the CHARACTER's; online they are read against the WORLD's, so they
 *  move by the distance to the world's minute now (`worldNow`, the shared clock's reading at customs). And the envelope
 *  says it left the world at that minute - it has never been away, so the first join's absence arm (TM-1's recovery,
 *  SURV7's fresh start) walks no span the character never lived, where a missing `worldMinutes` read the whole
 *  distance from the offline calendar to the world's as time away. */
export function onlineCopyOf(snap, worldNow) {
  const copy = JSON.parse(JSON.stringify(snap ?? null));
  if (!copy || typeof copy !== 'object' || !Number.isFinite(worldNow)) return copy;
  const own = copy.classicMinutes;
  copy.worldMinutes = Math.floor(worldNow);
  if (!Number.isFinite(own)) return copy;
  return rebaseWorldStamps(copy, Math.floor(worldNow) - Math.floor(own));
}
