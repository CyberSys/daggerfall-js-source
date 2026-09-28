// TV8 - GROUP TRAVEL, THE LEADER DRIVES (bible/06-Systems/Travel-View.md, THE OVERHAUL; Mac 2026-09-28: "Leader
// drives"). The law (systems/partyWalk.js), the wire (net/wire.js validPartyPose `tw`/`ts`, world123), the host.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { walkOf, memberWalkStep, leaderMustHalt, PARTY_WALK_RADIUS_M, PARTY_WALK_ASK_MS, PARTY_WALK_GRACE_MS, NO_WALK_ANSWER, walkBegin, leaderWalkStep, walkHeard, memberAnswer, memberFollowing, memberStopOf, walkAskStands, sameWalkDest } from '../src/systems/partyWalk.js';
import { validPartyPose, PARTY_WALK_RELAY_MIN, relaySupportsPartyWalk, RELAY_VERSION } from '../src/net/wire.js';
import { createTravelOptions, readTravelOptionsSettings } from '../src/systems/travelOptions.js';
import { mapPixelWorldOrigin } from '../src/systems/travelPaths.js';
import { rectOf } from '../src/systems/travelAutopilot.js';
import { TravelControlUI } from '../src/ui/travelControlUI.js';
import { modSetting } from '../src/systems/modSettings.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('TV8 law: a walk as the leader\'s pose carries it - the destination pixel, a spot\'s own point, the round\'s stamp, set out at once, walking', () => {
  assert.deepEqual(walkOf({ pixel: { x: 120, y: 340 } }, 5000.4), { x: 120, y: 340, at: 5000, go: 5000, h: null });
  assert.deepEqual(walkOf({ pixel: { x: 1, y: 2 }, point: { x: 40000.6, z: 7.2 } }, 9), { x: 1, y: 2, at: 9, go: 9, h: null, sx: 40001, sz: 7 });
  assert.equal(PARTY_WALK_RADIUS_M, 60);
  assert.equal(PARTY_WALK_ASK_MS, 30_000);
});

test('TV8 law: A MEMBER\'S NEXT STEP - asked of a new round when gathered and still; begun on a yes; halted with the party; begun again when it sets out again; a no, an old round or a member away is never asked', () => {
  const tw = { x: 5, y: 6, at: 1000, go: 1000, h: null };
  const fresh = { at: null, yes: false, go: null };
  assert.equal(memberWalkStep({ tw, mine: fresh, gathered: true, journeying: false, now: 2000 }), 'ask');
  assert.equal(memberWalkStep({ tw, mine: fresh, gathered: false, journeying: false, now: 2000 }), null, 'away from the leader: not asked');
  assert.equal(memberWalkStep({ tw, mine: fresh, gathered: true, journeying: true, now: 2000 }), null, 'on a journey of my own: not asked');
  assert.equal(memberWalkStep({ tw, mine: fresh, gathered: true, journeying: false, now: 1000 + PARTY_WALK_ASK_MS + 1 }), null, 'a round past its asking');
  assert.equal(memberWalkStep({ tw, mine: { at: 1000, yes: false, go: null }, gathered: true, journeying: false, now: 2000 }), null, 'a no stays a no');
  assert.equal(memberWalkStep({ tw, mine: { at: 1000, yes: true, go: null }, gathered: true, journeying: false, now: 2000 }), 'start', 'a yes: begin');
  assert.equal(memberWalkStep({ tw, mine: { at: 1000, yes: true, go: 1000 }, gathered: true, journeying: true, now: 2000 }), null, 'walking with the party');
  const halted = { ...tw, h: 3000 };
  assert.equal(memberWalkStep({ tw: halted, mine: { at: 1000, yes: true, go: 1000 }, gathered: true, journeying: true, now: 3100 }), 'halt', 'the party halted: I stop');
  assert.equal(memberWalkStep({ tw: halted, mine: { at: 1000, yes: true, go: 1000 }, gathered: true, journeying: false, now: 3100 }), null, 'stopped already');
  const again = { ...tw, go: 4000, h: null };
  assert.equal(memberWalkStep({ tw: again, mine: { at: 1000, yes: true, go: 1000 }, gathered: false, journeying: false, now: 4100 }), 'start', 'set out again: I take it up (wherever I stand)');
  // AUDIT OW3 P8 (the lead's call): the leader's walk ENDED - an arrival, a forget, the party gone - RELEASES me: my
  // journey is my own and carries on to the same place; a halt comes from `tw.h` alone
  assert.equal(memberWalkStep({ tw: null, mine: { at: 1000, yes: true, go: 4000 }, gathered: true, journeying: true, now: 5000 }), null, 'the leader\'s walk is over: I am released, and walk on');
  assert.equal(memberWalkStep({ tw: null, mine: fresh, gathered: true, journeying: true, now: 5000 }), null, 'a journey of my own is never the party\'s to stop');
});

test('TV8 law: THE LEADER\'S HALT - a present member\'s stop after the party last set out halts the leader (and the halt reaches everyone); an older stop, a halted walk or none never', () => {
  const tw = { x: 5, y: 6, at: 1000, go: 2000, h: null };
  assert.equal(leaderMustHalt(tw, [null, 2500]), true);
  assert.equal(leaderMustHalt(tw, [1500, undefined]), false, 'a stop before the party set out again');
  assert.equal(leaderMustHalt({ ...tw, h: 3000 }, [3500]), false, 'halted already');
  assert.equal(leaderMustHalt(null, [9999]), false);
  assert.equal(leaderMustHalt(tw, []), false);
});

test('TV8 wire (world123): the leader\'s walk and a member\'s stop ride the party pose, each refused alone when out of its law - never the pose; a relay from before strips them', () => {
  const base = { px: 10, py: 20, h: 50, hm: 50, f: 40, fm: 40, m: 30, mm: 30 };
  const ok = validPartyPose({ ...base, tw: { x: 120, y: 340, at: 5000, go: 5000, h: null, sx: 40001, sz: 7 }, ts: 6000 });
  assert.deepEqual(ok.tw, { x: 120, y: 340, at: 5000, go: 5000, h: null, sx: 40001, sz: 7 });
  assert.equal(ok.ts, 6000);
  assert.deepEqual(validPartyPose({ ...base, tw: { x: 1, y: 2, at: 3, go: 4, h: 5 } }).tw, { x: 1, y: 2, at: 3, go: 4, h: 5 }, 'halted; no spot');
  for (const bad of [{ x: -1, y: 2, at: 3, go: 3 }, { x: 1000, y: 2, at: 3, go: 3 }, { x: 1, y: 500, at: 3, go: 3 }, { x: 1.5, y: 2, at: 3, go: 3 }, { x: 1, y: 2, at: -3, go: 3 }, { x: 1, y: 2, at: 3 }, { x: 1, y: 2, at: 3, go: 3, sx: 1 }, [1, 2], 'x']) {
    const v = validPartyPose({ ...base, tw: bad });
    assert.equal(v.tw, undefined, `refused: ${JSON.stringify(bad)}`);
    assert.equal(v.px, 10, 'the pose itself stands');
  }
  assert.equal(validPartyPose({ ...base, ts: -1 }).ts, undefined);
  assert.equal(validPartyPose({ ...base, ts: 'x' }).ts, undefined);
  assert.equal(RELAY_VERSION, 'world123');
  assert.equal(PARTY_WALK_RELAY_MIN, 123);
  assert.deepEqual(['world122', 'world123', 'world130', 'nope'].map(relaySupportsPartyWalk), [false, true, true, false]);
});

test('TV8 host: the leader\'s walk begins with an Overworld journey (a gathered member, a hub that carries it) and runs on the law\'s own steps (AUDIT OW3: leaderWalkStep, halted through the panel); a member hears it with a grace, is asked only when free, walks the same journey on a yes, halts with the party through the panel, publishes only their own stops', () => {
  const w = rd('src/scenes/world.js'), on = rd('src/net/online.js');
  assert.match(on, /if \(primary\) this\.partyWalkOk = relaySupportsPartyWalk\(relayV\);/, 'the hub that carries it');
  assert.match(w, /\.\.\.\(_walkLead && socialLink\(\)\?\.partyWalkOk \? \{ tw: _walkLead \} : \{\}\),/);
  assert.match(w, /\.\.\.\(_walkTs != null && socialLink\(\)\?\.partyWalkOk \? \{ ts: _walkTs \} : \{\}\),/);
  // the begin: AUDIT OW3 P2 - the old walk cleared FIRST; P9 - the law decides a new round or the halted walk set out again
  assert.match(w, /function partyWalkBegin\(dest\) \{\n\s*const prev = _walkLead;\n\s*_walkLead = null;[^\n]*\n\s*if \(!social\?\.party \|\| !social\.leads\?\.\(\) \|\| !socialLink\(\)\?\.partyWalkOk\) return;\n\s*const gathered = social\.others\(\)\.filter\(\(m\) => memberPresent\(m\) && distanceToPartyAccount\(m\.acct\) <= PARTY_WALK_RADIUS_M\);\n\s*_walkLead = walkBegin\(prev, dest, walkNow\(\), gathered\.length\);\n\s*_walkCleared = travelOptions\?\.cleared \?\? 0;/, 'the walk begins with a member gathered - or the halted one sets out again');
  assert.match(w, /partyWalkBegin\(\{ pixel: summary\.pixel \}\);/, 'a place\'s journey');
  assert.match(w, /partyWalkBegin\(\{ pixel: pix, point: \{ x: n\.x, z: n\.z \} \}\);/, 'a spot\'s');
  // AUDIT OW3 P1: MOVING is the panel AND an autopilot; P5: an END is Travel Options' own count moving
  assert.match(w, /const walkJourneying = \(\) => !!travelOptions\?\.isTravelActive && !!travelOptions\.state\?\.autopilot;/);
  assert.match(w, /const cleared = travelOptions\?\.cleared \?\? 0, ended = cleared !== _walkCleared;[^\n]*\n\s*_walkCleared = cleared;/);
  assert.match(w, /const next = leaderWalkStep\(\{ tw: _walkLead, journeying, dest: walkDestLive\(\), ended, stops, now \}\);\n\s*_walkLead = next\.tw;\n\s*if \(next\.halt\) travelOptions\?\.messages\?\.pauseTravel\(\);/, 'the leader\'s step, and a member\'s stop halts the leader through the panel');
  assert.match(w, /const stops = social\.others\(\)\.filter\(\(m\) => memberPresent\(m\)\)\.map\(\(m\) => m\.p\?\.ts\);/);
  assert.match(w, /if \(_walkLead && !leads\) _walkLead = null;/, 'no longer the leader: no walk to lead');
  // A MEMBER - AUDIT OW3 P7: heard with a grace; P3: the answer dies with its round
  assert.match(w, /_walkHeard = walkHeard\(_walkHeard, \{ acct: leadRow\?\.acct \?\? null, present: memberPresent\(leadRow\), tw: leadRow\?\.p\?\.tw \?\? null \}, nowMs\);\n\s*const tw = leadRow \? _walkHeard\.tw : null;\n\s*_walkMine = memberAnswer\(_walkMine, tw\);/);
  assert.match(w, /const stop = memberStopOf\(\{ was: _walkWas, journeying, ended, following: memberFollowing\(_walkMine, tw\) \}\);\n\s*if \(stop === 'stop'\) _walkTs = now;[^\n]*\n\s*else if \(stop === 'done'\) _walkMine = \{ \.\.\._walkMine, yes: false \};/, 'a member publishes their own stops - never the party\'s halt, never an arrival');
  // AUDIT OW3 P4: the question - on an empty slot, taken down when its round or its asking goes, forgotten when replaced
  assert.match(w, /if \(_walkBox && townTalk\.overlay !== _walkBox\) \{ _walkBox = null; _walkBoxRound = null; \}/);
  assert.match(w, /if \(_walkBox && !walkAskStands\(\{ tw, round: _walkBoxRound, now, danger: walkDanger\(\) \}\)\) walkBoxDown\(\);/);
  assert.match(w, /function walkBoxDown\(\) \{\n\s*const box = _walkBox;\n\s*_walkBox = null; _walkBoxRound = null;\n\s*if \(box\) townTalk\.closeOverlay\(box\);/);
  assert.match(w, /const step = memberWalkStep\(\{ tw, mine: _walkMine, gathered, journeying, onWalk, free: !!tw && walkFree\(\), now \}\);/);
  assert.match(w, /const onWalk = journeying && sameWalkDest\(tw, walkDestLive\(\), true\);/);
  // AUDIT OW3 P4/P6: FREE - outdoors, alive, no window of any kind, no danger
  assert.match(w, /const walkFree = \(\) => !!travelOptions && \(modes\?\.mode \?\? 'exterior'\) === 'exterior' && playerSpawned && playerEntity\.health > 0 && !modes\?\.deathUp\?\.\(\)\n\s*&& !townTalk\.overlay && !gamePaused\(\) && !\(modes\?\.modalWindowUp\?\.\(\) \?\? false\) && pointerSurfaces\.size === 0 && !walkDanger\(\);/);
  assert.match(w, /const walkDanger = \(\) => duelEnemyNear\(\) \|\| areEnemiesNearby\(exteriorFoePool\(\)\);/);
  assert.match(w, /onYes: \(\) => \{ if \(_walkBox === box\) \{ _walkBox = null; _walkBoxRound = null; \} _walkMine = \{ at: round, yes: true, go: null \}; \},/);
  assert.match(w, /const ok = summary \? travelViewRouteTo\(summary\) : travelViewWalkTo\(tvSceneOf\(tw\.sx \?\? o\.x \+ 16384, tw\.sz \?\? o\.z \+ 16384, 0\), \{ x: tw\.x, y: tw\.y \}\);\n\s*_walkMine = \{ \.\.\._walkMine, go: tw\.go, yes: ok \};/, 'the same journey');
  assert.match(w, /\} else if \(step === 'halt'\) \{\n\s*travelOptions\?\.messages\?\.pauseTravel\(\);/, 'halted with the party, through the panel (AUDIT OW3 P1)');
  assert.match(w, /\} else if \(step === 'leave'\) \{\n\s*_walkMine = \{ \.\.\._walkMine, yes: false \};/);
  assert.match(w, /_walkWas = walkJourneying\(\) && memberFollowing\(_walkMine, tw\) && sameWalkDest\(tw, walkDestLive\(\), true\);\n\s*\}/, 'read AFTER the party\'s halt, so its stop is never taken for mine');
  assert.doesNotMatch(w.slice(w.indexOf('function partyWalkFrame('), w.indexOf('const partyFrame = (nowMs) => {')), /interruptTravel\(\)/, 'AUDIT OW3 P1: never the bare interrupt, which leaves the panel up');
  assert.match(w, /partyWalkFrame\(nowMs\);   \/\/ TV8/);
  assert.match(w, /let _walkLead = null;   \/\/ TV8[^\n]*\n[\s\S]*?let _walkHeard = null;[^\n]*\n\s*let _walkCleared = 0;[^\n]*\n[\s\S]*?let social = null, _partyComposedAt/, 'above its readers (BOOT-TDZ)');
});

// ── AUDIT OW3 (2026-09-28): THE LAW, RUN ─────────────────────────────────────────────────────────────────────────────

const PLACE = { pixel: { x: 505, y: 250 } };
const SPOT = { pixel: { x: 505, y: 250 }, point: { x: 40000.4, z: 9000.6 } };

test('AUDIT OW3 P2/P9: THE LEADER\'S BEGIN - a new round only with someone gathered and never the old walk; the halted walk\'s own place taken up again SETS IT OUT again (the same round, near or far); the same place while it walks is the same walk', () => {
  assert.deepEqual(walkBegin(null, PLACE, 1000, 1), walkOf(PLACE, 1000), 'a new round');
  assert.equal(walkBegin(null, PLACE, 1000, 0), null, 'nobody gathered: no walk');
  const other = walkOf({ pixel: { x: 9, y: 9 } }, 500);
  assert.equal(walkBegin({ ...other, h: 800 }, PLACE, 1000, 0), null, 'P2: a halted walk elsewhere is never carried into a journey with nobody gathered');
  assert.deepEqual(walkBegin({ ...other, h: 800 }, PLACE, 1000, 2), walkOf(PLACE, 1000), 'another place: a new round');
  const halted = { ...walkOf(PLACE, 500), go: 600, h: 800 };
  assert.deepEqual(walkBegin(halted, PLACE, 1000, 0), { ...halted, go: 1000, h: null }, 'P9: set out again - the same `at`, so nobody is asked again or dropped (and nobody need be gathered)');
  const walking = walkOf(PLACE, 500);
  assert.equal(walkBegin(walking, PLACE, 1000, 3), walking, 'the flag clicked while it walks: the same walk');
  const spotHalted = { ...walkOf(SPOT, 500), h: 700 };
  assert.deepEqual(walkBegin(spotHalted, { pixel: SPOT.pixel, point: { x: 41000, z: 9100 } }, 1000, 0), { ...spotHalted, go: 1000, h: null, sx: 41000, sz: 9100 }, 'a spot in its pixel again: set out, to the new point');
  assert.deepEqual(walkBegin(halted, SPOT, 1000, 1), walkOf(SPOT, 1000), 'a place\'s walk is never set out again as a spot: a new round');
  assert.equal(sameWalkDest(walkOf(PLACE, 1), { x: 505, y: 250, spot: true }), false);
  assert.equal(sameWalkDest(walkOf(PLACE, 1), { x: 505, y: 250, spot: true }, true), true, 'a member\'s spot to an unfound place is the walk\'s');
  assert.equal(sameWalkDest(walkOf(PLACE, 1), { x: 505, y: 251 }, true), false);
  assert.equal(sameWalkDest(null, { x: 505, y: 250 }), false);
});

test('AUDIT OW3 P1/P2/P5: THE LEADER\'S STEP - a stop halts, the journey taken up again sets out, an end (arrival, forget) ends; a member\'s stop halts AT ONCE and says to stop; a spot\'s stop is a halt, never an arrival; a halted walk forgotten, left with nothing to resume or replaced is dropped', () => {
  const place = { x: 505, y: 250, spot: false };
  const tw = walkOf(PLACE, 1000);
  const step = (q) => leaderWalkStep({ tw, journeying: true, dest: place, ended: false, stops: [], now: 2000, ...q });
  assert.deepEqual(step({}), { tw, halt: false }, 'walking');
  assert.deepEqual(step({ journeying: false }), { tw: { ...tw, h: 2000 }, halt: false }, 'my stop: the walk halts');
  assert.deepEqual(step({ journeying: false, ended: true }), { tw: null, halt: false }, 'my arrival (or Exit): the walk is over');
  assert.deepEqual(step({ stops: [1500, 2500] }), { tw: { ...tw, h: 2000 }, halt: true }, 'P1: a member\'s stop - halted now, and my journey is to stop');
  assert.deepEqual(step({ dest: { x: 9, y: 9, spot: false } }), { tw: null, halt: false }, 'a journey of another place: over');
  assert.deepEqual(step({ dest: null }), { tw: null, halt: false }, 'the follow key (no destination): over');
  // P5: a SPOT walk's stop nulls its route - still a halt, not the end the old destination fields read
  const spotTw = walkOf(SPOT, 1000);
  assert.deepEqual(leaderWalkStep({ tw: spotTw, journeying: false, dest: null, ended: false, stops: [], now: 2000 }).tw, { ...spotTw, h: 2000 });
  const spotHalted = { ...spotTw, h: 2000 };
  assert.equal(leaderWalkStep({ tw: spotHalted, journeying: false, dest: null, ended: false, stops: [], now: 3000 }).tw, spotHalted, 'a halted spot walk waits for the next click');
  // halted: the halt/resume cycle, and P2's drops
  const halted = { ...tw, h: 2000 };
  const hstep = (q) => leaderWalkStep({ tw: halted, journeying: false, dest: place, ended: false, stops: [9999], now: 3000, ...q }).tw;
  assert.equal(hstep({}), halted, 'halted, the place kept for the resume (a stop after the halt changes nothing)');
  assert.deepEqual(hstep({ journeying: true }), { ...halted, go: 3000, h: null }, 'the map\'s Resume: set out again');
  assert.equal(hstep({ ended: true }), null, 'P2: forgotten while halted (the map\'s Forget it, a load)');
  assert.equal(hstep({ dest: null }), null, 'P2: a place\'s walk with nothing left to resume');
  assert.equal(hstep({ journeying: true, dest: { x: 9, y: 9, spot: false } }), null, 'P2: the next journey elsewhere never sets the old walk out');
  assert.equal(hstep({ journeying: true, dest: null }), null);
  assert.equal(leaderWalkStep({ tw: spotHalted, journeying: true, dest: null, ended: false, stops: [], now: 3000 }).tw, null, 'the follow key after a halted spot walk: over');
  assert.deepEqual(leaderWalkStep({ tw: null, journeying: true, dest: place, ended: false, stops: [9999], now: 1 }), { tw: null, halt: false });
});

test('AUDIT OW3 P7: THE LEADER\'S WALK AS HEARD - a pose that says it is believed at once (walk or none); no pose keeps the last walk PARTY_WALK_GRACE_MS, then lets it go; a new leader starts from nothing', () => {
  const tw = walkOf(PLACE, 1000);
  let h = walkHeard(null, { acct: 'a', present: true, tw }, 100);
  assert.deepEqual(h, { acct: 'a', tw, at: 100 });
  h = walkHeard(h, { acct: 'a', present: false, tw: null }, 100 + PARTY_WALK_GRACE_MS);
  assert.equal(h.tw, tw, 'a reconnect\'s moment without a pose: still walking');
  assert.equal(walkHeard(h, { acct: 'a', present: false, tw: null }, 101 + PARTY_WALK_GRACE_MS).tw, null, 'gone past the grace: no walk');
  assert.equal(walkHeard(h, { acct: 'a', present: true, tw: null }, 150).tw, null, 'a pose with no walk: none, at once');
  assert.equal(walkHeard(h, { acct: 'b', present: false, tw: null }, 150).tw, null, 'another leader: never the last one\'s walk');
  assert.ok(PARTY_WALK_GRACE_MS >= 5_000 && PARTY_WALK_GRACE_MS < PARTY_WALK_ASK_MS);
});

test('AUDIT OW3 P3/P5: A MEMBER\'S ANSWER dies with its round; FOLLOWING is the current round\'s yes, walked on; what my journey did - my own stop, an arrival (never a stop), the party\'s halt (never echoed)', () => {
  const tw = walkOf(PLACE, 1000);
  const yes = { at: 1000, yes: true, go: 1000 };
  assert.equal(memberAnswer(yes, tw), yes);
  assert.equal(memberAnswer(yes, { ...tw, go: 5000, h: null }), yes, 'P9: the same round set out again keeps it');
  assert.deepEqual(memberAnswer(yes, null), NO_WALK_ANSWER, 'P3: no walk - the yes is gone (my next journey of my own is mine)');
  assert.deepEqual(memberAnswer(yes, walkOf(PLACE, 7000)), NO_WALK_ANSWER, 'P3: another round - never following it');
  assert.equal(memberFollowing(yes, tw), true);
  assert.equal(memberFollowing({ ...yes, go: null }, tw), false, 'not walked on yet');
  assert.equal(memberFollowing({ ...yes, yes: false }, tw), false);
  assert.equal(memberFollowing(yes, walkOf(PLACE, 7000)), false, 'P3: another round\'s walk');
  assert.equal(memberFollowing(yes, null), false);
  assert.equal(memberStopOf({ was: true, journeying: false, ended: false, following: true }), 'stop', 'a foe stopped my walk: the party hears it');
  assert.equal(memberStopOf({ was: true, journeying: false, ended: true, following: true }), 'done', 'P5: my arrival (a spot\'s as well) - never a stop');
  assert.equal(memberStopOf({ was: false, journeying: false, ended: true, following: true }), 'done', 'forgot my halted journey: my part is over');
  assert.equal(memberStopOf({ was: false, journeying: false, ended: false, following: true }), null, 'the party halted me (the host drops `was`): never echoed');
  assert.equal(memberStopOf({ was: false, journeying: false, ended: false, following: false }), null, 'P3: a stop of a journey of my own is mine');
  assert.equal(memberStopOf({ was: false, journeying: false, ended: true, following: false }), null);
  assert.equal(memberStopOf({ was: true, journeying: false, ended: false, following: false }), null, 'released in the same breath (the walk gone, a new round): my stop halts nobody');
  assert.equal(memberStopOf({ was: true, journeying: true, ended: false, following: true }), null, 'walking on');
});

test('AUDIT OW3 P4/P6/P8/P10: a member is asked, and sets out, only when FREE (and waits, the set-out unwalked, until then); a journey elsewhere leaves the walk; no walk releases; the question stands only for its round, within its asking, out of danger', () => {
  const tw = walkOf(PLACE, 1000);
  const fresh = NO_WALK_ANSWER;
  assert.equal(memberWalkStep({ tw, mine: fresh, gathered: true, journeying: false, free: false, now: 2000 }), null, 'P4: a window up, a foe near: not asked now');
  assert.equal(memberWalkStep({ tw, mine: fresh, gathered: true, journeying: false, free: true, now: 2000 }), 'ask', '...asked when free');
  const yes = { at: 1000, yes: true, go: null };
  assert.equal(memberWalkStep({ tw, mine: yes, gathered: true, journeying: false, free: false, now: 2000 }), null, 'P6: in a dungeon, dead, mid-fight, a window open: waits');
  assert.equal(memberWalkStep({ tw, mine: yes, gathered: false, journeying: false, free: true, now: 90_000 }), 'start', 'P6: ...and starts the step it is able (the set-out was never marked walked)');
  assert.equal(memberWalkStep({ tw, mine: { ...yes, go: 1000 }, gathered: true, journeying: true, onWalk: false, now: 2000 }), 'leave', 'walking somewhere else: I left the walk');
  assert.equal(memberWalkStep({ tw, mine: { ...yes, go: 1000 }, gathered: true, journeying: true, onWalk: true, now: 2000 }), null);
  assert.equal(memberWalkStep({ tw: { ...tw, h: 3000 }, mine: { ...yes, go: 1000 }, gathered: true, journeying: true, onWalk: true, free: false, now: 3100 }), 'halt', 'a halt never waits');
  assert.equal(memberWalkStep({ tw: null, mine: { ...yes, go: 1000 }, gathered: true, journeying: true, onWalk: false, now: 3100 }), null, 'P8: released');
  assert.equal(walkAskStands({ tw, round: 1000, now: 2000, danger: false }), true);
  assert.equal(walkAskStands({ tw, round: 1000, now: 1000 + PARTY_WALK_ASK_MS + 1, danger: false }), false, 'P10: the asking passed - left behind');
  assert.equal(walkAskStands({ tw: null, round: 1000, now: 2000, danger: false }), false, 'the round over, the party gone');
  assert.equal(walkAskStands({ tw: walkOf(PLACE, 1500), round: 1000, now: 2000, danger: false }), false, 'a new round');
  assert.equal(walkAskStands({ tw: { ...tw, go: 1800, h: null }, round: 1000, now: 2000, danger: false }), true, 'the same round set out again');
  assert.equal(walkAskStands({ tw, round: 1000, now: 2000, danger: true }), false, 'a foe near, a duel');
});

// A client of the walk as the world host runs it: Travel Options itself (its panel's Camp is InterruptTravel, its Exit
// ClearTravelDestination - the world host's own wiring) and the host's step glue, word for word (partyWalkFrame).
function walkClient() {
  const at = (px, py, dx = 16384, dz = 16384) => { const o = mapPixelWorldOrigin(px, py); return { x: o.x + dx, z: o.z + dz }; };
  const state = { pos: at(500, 250), pixel: { x: 500, y: 250 }, enemies: false };
  let to = null;
  const ui = new TravelControlUI({ defaultStartingAccel: 10, accelerationLimit: 60, onClose: () => to?.interruptTravel(), onCancel: () => to?.clearTravelDestination() });
  const settings = readTravelOptionsSettings((vendor, key) => (vendor === 'roads-hazelnut' ? key === 'Enabled' : modSetting(vendor, key)));
  to = createTravelOptions({
    settings, ui,
    roads: () => ({ roads: new Uint8Array(1000 * 500), tracks: new Uint8Array(1000 * 500), source: 'basic-roads' }),
    worldPos: () => state.pos, mapPixel: () => state.pixel, yaw: () => 0, setFacing: () => {},
    currentLocation: () => null, hasCurrentLocation: () => false,
    localizedCurrentLocationName: () => '', localizedLocationName: (s) => s?.name ?? '',
    climateIndex: () => 231,
    entity: () => ({ health: 50, maxHealth: 50, fatigue: 64 * 50, luck: 50, stealth: 50 }),
    enemiesNearby: () => state.enemies, diseaseCount: () => 0,
    say: () => {}, messageBox: () => {},
    setTimeScale: () => {}, now: () => 0, worldTimeNow: () => 0, roll100: () => 100,
    locationWorldRect: (s) => { const o = mapPixelWorldOrigin(s.pixel.x, s.pixel.y); return rectOf(o.x + 16000, o.z + 16000, 768, 768); },
    locationTileRect: () => null,
    pushWindow: (w) => { w.show(); },
  });
  const c = { to, ui, state, lead: null, mine: NO_WALK_ANSWER, ts: null, was: false, cleared: 0 };
  c.go = (px, py, dx, dz) => { state.pixel = { x: px, y: py }; state.pos = at(px, py, dx, dz); return to.update({ topWindowIsTravelUI: true, isPlayerOnHUD: false }); };
  c.journey = () => to.beginTravelAlongRoute({ legs: [{ x: 505, y: 250, kind: 'road' }], summary: { pixel: { x: 505, y: 250 }, name: 'Ripwych', mapId: 42 } }, false, { quiet: true });
  c.journeying = () => !!to.isTravelActive && !!to.state.autopilot;
  c.dest = () => (to.route?.summary?.pixel ? { x: to.route.summary.pixel.x, y: to.route.summary.pixel.y, spot: false } : to.route?.point?.pixel ? { x: to.route.point.pixel.x, y: to.route.point.pixel.y, spot: true } : null);
  c.ended = () => { const e = to.cleared !== c.cleared; c.cleared = to.cleared; return e; };
  c.leaderTick = (stops, now) => {
    const ended = c.ended();
    if (!c.lead) return;
    const next = leaderWalkStep({ tw: c.lead, journeying: c.journeying(), dest: c.dest(), ended, stops, now });
    c.lead = next.tw;
    if (next.halt) to.messages.pauseTravel();
  };
  c.memberTick = (tw, now, free = true) => {
    const ended = c.ended();
    c.mine = memberAnswer(c.mine, tw);
    const stop = memberStopOf({ was: c.was, journeying: c.journeying(), ended, following: memberFollowing(c.mine, tw) });
    if (stop === 'stop') c.ts = now;
    else if (stop === 'done') c.mine = { ...c.mine, yes: false };
    const step = memberWalkStep({ tw, mine: c.mine, gathered: true, journeying: c.journeying(), onWalk: c.journeying() && sameWalkDest(tw, c.dest(), true), free, now });
    if (step === 'ask') c.mine = { at: tw.at, yes: true, go: null };   // the member says yes
    else if (step === 'start') c.mine = { ...c.mine, go: tw.go, yes: c.journey() };
    else if (step === 'halt') to.messages.pauseTravel();
    else if (step === 'leave') c.mine = { ...c.mine, yes: false };
    c.was = c.journeying() && memberFollowing(c.mine, tw) && sameWalkDest(tw, c.dest(), true);
    return step;
  };
  return c;
}

test('AUDIT OW3 P1/P5: through Travel Options itself - the bare interrupt leaves the panel up (the party read a stopped journey as walking); the mod\'s Camp (pauseTravel) takes it down and keeps the place; every END is counted, a stop never is (a spot\'s stop included)', () => {
  const a = walkClient();
  a.journey();
  a.to.interruptTravel();
  assert.equal(a.to.isTravelActive, true, 'P1: the panel still up - the old halt\'s whole bug');
  assert.equal(a.journeying(), false, '...not moving, and the host now reads that');
  const b = walkClient();
  b.journey();
  b.to.messages.pauseTravel();
  assert.deepEqual([b.to.isTravelActive, b.to.state.autopilot, b.to.destinationName, !!b.to.route, b.to.cleared], [false, null, 'Ripwych', true, 0], 'Camp: down, stopped, the place kept for the resume - not an end');
  b.to.resumeTravel();
  assert.equal(b.journeying(), true, 'the map\'s Resume takes it up');
  b.go(505, 250, 16300, 16300); b.go(505, 250, 16300, 16300);
  assert.deepEqual([b.to.isTravelActive, b.to.cleared], [false, 1], 'P5: the arrival - counted');
  const s = walkClient();
  s.to.beginTravelToPoint({ pixel: { x: 501, y: 250 }, ...s.state.pos }, false, { quiet: true });
  s.to.messages.pauseTravel();
  assert.deepEqual([s.to.route, s.to.destinationName, s.to.cleared], [null, null, 0], 'P5: a spot\'s STOP leaves no destination field at all - and is no end');
  s.journey();
  s.ui.cancelWindow();
  assert.equal(s.to.cleared, 1, 'Exit: an end');
});

test('AUDIT OW3: THE PARTY WALKS, RUN - asked and started; a member\'s own stop halts the leader (through the panel) and every member, never echoed back; the leader\'s resume sets everyone out again, the stopped member too; the leader\'s arrival releases the member, who walks on and arrives - never a stop', () => {
  const L = walkClient(), M = walkClient(), N = walkClient();
  L.journey();
  L.lead = walkBegin(null, PLACE, 1000, 2);
  L.cleared = L.to.cleared;
  const tick = (now, stopsFrom = [M, N]) => { L.leaderTick(stopsFrom.map((c) => c.ts), now); return [M.memberTick(L.lead, now), N.memberTick(L.lead, now)]; };
  assert.deepEqual(tick(1100), ['ask', 'ask']);
  assert.deepEqual(tick(1200), ['start', 'start']);
  assert.deepEqual([M.journeying(), N.journeying()], [true, true], 'the same journey, each in their own world');
  assert.deepEqual(tick(1300), [null, null], 'walking together');
  // M meets a foe: the mod's own stop
  M.state.enemies = true; M.go(500, 250); M.state.enemies = false;
  assert.equal(M.journeying(), false);
  assert.deepEqual(tick(2000), [null, null]);
  assert.equal(M.ts, 2000, 'M\'s own stop, said');
  assert.deepEqual(tick(2100), [null, 'halt'], 'the leader halts on it at once, and the halt reaches N');
  assert.equal(L.lead.h, 2100);
  assert.equal(L.to.isTravelActive, false, 'P1: the leader stopped through the panel - not frozen with it up');
  assert.equal(L.to.destinationName, 'Ripwych', 'the place kept for the resume');
  assert.equal(N.to.isTravelActive, false, 'P1: N stopped through the panel');
  assert.deepEqual(tick(2350), [null, null]);
  assert.equal(N.ts, null, 'the party\'s halt is never echoed back as N\'s own stop');
  assert.equal(L.lead.h, 2100, 'no ping-pong');
  // the leader takes it up again: the map's Resume
  L.to.resumeTravel();
  tick(3000);
  assert.deepEqual([L.lead.go, L.lead.h], [3000, null], 'set out again');
  assert.deepEqual([M.journeying(), N.journeying()], [true, true], 'P1: both set out again - the one who stopped on their own, and the one the party halted');
  assert.deepEqual(tick(3250), [null, null]);
  // P9: stopped again, taken up again from the Overworld's flag - the same round, not a new one
  L.to.messages.pauseTravel();
  assert.deepEqual(tick(3500), ['halt', 'halt']);
  assert.equal(L.lead.h, 3500);
  const at = L.lead.at;
  L.journey(); L.lead = walkBegin(L.lead, PLACE, 4000, 0);
  assert.deepEqual([L.lead.at, L.lead.go, L.lead.h], [at, 4000, null], 'nobody gathered - still their walk');
  tick(4100);
  assert.deepEqual([M.journeying(), N.journeying(), M.mine.at, N.mine.at], [true, true, at, at]);
  // the leader arrives: the walk is over, and the members are released to walk on (P8)
  L.go(505, 250, 16300, 16300); L.go(505, 250, 16300, 16300);
  tick(5000);
  assert.equal(L.lead, null, 'arrived: the walk ends');
  assert.deepEqual([M.journeying(), N.journeying()], [true, true], 'P8: released, walking on to the same place');
  assert.deepEqual([M.mine, N.mine], [NO_WALK_ANSWER, NO_WALK_ANSWER], 'P3: the yes died with the walk');
  M.go(505, 250, 16300, 16300); M.go(505, 250, 16300, 16300);
  assert.equal(M.memberTick(null, 5500), null);
  assert.equal(M.ts, 2000, 'my arrival after the walk is no stop');
  // P5: a member who arrives FIRST, while the walk still stands, is done - never a stop, never started again
  const L2 = walkClient(), P = walkClient();
  L2.journey(); L2.lead = walkBegin(null, PLACE, 10_000, 1); L2.cleared = L2.to.cleared;
  const t2 = (now) => { L2.leaderTick([P.ts], now); return P.memberTick(L2.lead, now); };
  t2(10_100); t2(10_200);
  assert.equal(P.journeying(), true);
  P.go(505, 250, 16300, 16300); P.go(505, 250, 16300, 16300);
  t2(10_300);
  assert.deepEqual([P.ts, P.mine.yes, L2.lead.h], [null, false, null], 'P5: arrived first - no stop said, the leader walks on');
  L2.to.messages.pauseTravel(); t2(10_400); L2.to.resumeTravel();
  assert.equal(t2(10_500), null, 'the next set-out does not send an arrived member back out');
});
