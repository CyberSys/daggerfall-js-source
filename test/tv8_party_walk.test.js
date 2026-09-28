// TV8 - GROUP TRAVEL, THE LEADER DRIVES (bible/06-Systems/Travel-View.md, THE OVERHAUL; Mac 2026-09-28: "Leader
// drives"). The law (systems/partyWalk.js), the wire (net/wire.js validPartyPose `tw`/`ts`, world123), the host.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { walkOf, memberWalkStep, leaderMustHalt, PARTY_WALK_RADIUS_M, PARTY_WALK_ASK_MS } from '../src/systems/partyWalk.js';
import { validPartyPose, PARTY_WALK_RELAY_MIN, relaySupportsPartyWalk, RELAY_VERSION } from '../src/net/wire.js';

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
  assert.equal(memberWalkStep({ tw: null, mine: { at: 1000, yes: true, go: 4000 }, gathered: true, journeying: true, now: 5000 }), 'halt', 'the leader\'s walk is over: so is mine');
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

test('TV8 host: the leader\'s walk begins with an Overworld journey (a gathered member, a hub that carries it), halts with the leader\'s stop and sets out again with the resume, ends at the arrival, halts on a member\'s own stop; a member is asked, walks the same journey on a yes, halts with the party, publishes only their own stops', () => {
  const w = rd('src/scenes/world.js'), on = rd('src/net/online.js');
  assert.match(on, /if \(primary\) this\.partyWalkOk = relaySupportsPartyWalk\(relayV\);/, 'the hub that carries it');
  assert.match(w, /\.\.\.\(_walkLead && socialLink\(\)\?\.partyWalkOk \? \{ tw: _walkLead \} : \{\}\),/);
  assert.match(w, /\.\.\.\(_walkTs != null && socialLink\(\)\?\.partyWalkOk \? \{ ts: _walkTs \} : \{\}\),/);
  assert.match(w, /if \(!social\?\.party \|\| !social\.leads\?\.\(\) \|\| !socialLink\(\)\?\.partyWalkOk\) return;\n\s*const gathered = social\.others\(\)\.filter\(\(m\) => memberPresent\(m\) && distanceToPartyAccount\(m\.acct\) <= PARTY_WALK_RADIUS_M\);\n\s*if \(!gathered\.length\) return;\n\s*_walkLead = walkOf\(dest, walkNow\(\)\);/, 'the walk begins with a member gathered');
  assert.match(w, /partyWalkBegin\(\{ pixel: summary\.pixel \}\);/, 'a place\'s journey');
  assert.match(w, /partyWalkBegin\(\{ pixel: pix, point: \{ x: n\.x, z: n\.z \} \}\);/, 'a spot\'s');
  assert.match(w, /if \(!travelOptions\?\.destinationName && !travelOptions\?\.route\) _walkLead = null;   \/\/ arrived, or forgotten: the walk is over\n\s*else _walkLead = \{ \.\.\._walkLead, h: now \};/, 'a stop halts the walk; an arrival ends it');
  assert.match(w, /else if \(active && _walkLead\.h != null\) _walkLead = \{ \.\.\._walkLead, go: now, h: null \};/, 'taken up again: set out again');
  assert.match(w, /else if \(active && leaderMustHalt\(_walkLead, social\.others\(\)\.filter\(\(m\) => memberPresent\(m\)\)\.map\(\(m\) => m\.p\?\.ts\)\)\) travelOptions\.interruptTravel\(\);/, 'a member\'s stop halts the leader');
  assert.match(w, /if \(_walkActive && !active && following && !_walkHalting && \(travelOptions\?\.destinationName \|\| travelOptions\?\.route\)\) _walkTs = now;/, 'a member publishes their own stops - never the party\'s halt, never an arrival');
  assert.match(w, /onYes: \(\) => \{ _walkBox = null; _walkMine = \{ at: round, yes: true, go: null \}; \},/);
  assert.match(w, /const ok = summary \? travelViewRouteTo\(summary\) : travelViewWalkTo\(tvSceneOf\(tw\.sx \?\? o\.x \+ 16384, tw\.sz \?\? o\.z \+ 16384, 0\), \{ x: tw\.x, y: tw\.y \}\);/, 'the same journey');
  assert.match(w, /\} else if \(step === 'halt'\) \{\n\s*_walkHalting = true;\n\s*travelOptions\?\.interruptTravel\(\);/, 'halted with the party');
  assert.match(w, /partyWalkFrame\(nowMs\);   \/\/ TV8/);
  assert.match(w, /let _walkLead = null;   \/\/ TV8[^\n]*\n[\s\S]*?let social = null, _partyComposedAt/, 'above its readers (BOOT-TDZ)');
});
