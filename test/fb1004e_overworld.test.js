// FIELD BUGS 2026-10-04e - the Overworld map and the travel map (bible/01-Overview/Field-Bugs-2026-10-04e.md, reports 3
// and 5). Discord (Chilloutman): "Add a distance filter so players can decide how many km away they hide nodes;
// Highlight fast travel hubs (cities with carriages); Change name colors of players in your guild or friend list; More
// filters for players in general (filter by guild, friend, level etc), both in Overworld map and travel map" - and
// (ItMustBeMonday) "WHEEL icon for carriage places". The owner: "We need a hover tooltips for capturable cities/towns
// that show occupation". OW-NODE-KM, OW-HUBS, OW-KIN, OW-WHO, SEAT-TIP.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  travellerKin, playerShown, markShown, travelViewWho, toggleTravelViewWho, cycleTravelViewRenown, cycleTravelViewNodeKm,
  TV_KIN_COLORS, TV_WHO_GROUPS, TV_RENOWN_STEPS, TV_NODE_KM_STEPS, TV_WHO_TEXT, _resetTravelViewFilters,
} from '../src/systems/travelViewFilters.js';
import { FRIEND_CSS } from '../src/net/social.js';
import { hasCarriageGate } from '../src/world/immersiveTravelGates.js';
import { wheelPath, WHEEL_SPOKES } from '../src/ui/carriageWheel.js';
import { buildInkMarks, paintCarriageWheel } from '../src/ui/inkMap.js';
import { readTravellerMarks, travellerMarksKey } from '../src/ui/partyMapMarks.js';
import { seatTipOf, seatInfoLine } from '../src/net/townSeatLaw.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ── the law ────────────────────────────────────────────────────────────────────────────────────────────────────────

test('OW-KIN: a friend is a friend, a tag of my guild\'s a guild-mate (whatever its case), anyone else no kin; the friends\' blue is the chat\'s own (mutants: the guild never matched; a stranger a guild-mate with no guild of mine)', () => {
  assert.equal(travellerKin({ friend: true, gt: 'SH' }, 'SH'), 'friend', 'both: a friend');
  assert.equal(travellerKin({ gt: 'sh' }, 'SH'), 'guild');
  assert.equal(travellerKin({ gt: 'EO' }, 'SH'), null);
  assert.equal(travellerKin({ gt: 'SH' }, null), null, 'no guild of mine: nobody is a guild-mate');
  assert.equal(travellerKin({}, 'SH'), null);
  assert.equal(travellerKin(null, 'SH'), null);
  assert.equal(TV_KIN_COLORS.friend, FRIEND_CSS);
  assert.notEqual(TV_KIN_COLORS.guild, TV_KIN_COLORS.friend);
});

test('OW-WHO / OW-NODE-KM law: a player shows by their kin\'s switch and the Renown floor; a gathering group within the node reach; nothing else is touched (mutants: a kin\'s switch ignored; the floor inverted; the reach ignored)', () => {
  _resetTravelViewFilters();
  const all = { friends: true, guild: true, others: true, renown: 0, nodeKm: null };
  assert.equal(playerShown({ kin: 'friend', lv: 1 }, all), true);
  assert.equal(playerShown({ kin: 'friend', lv: 1 }, { ...all, friends: false }), false);
  assert.equal(playerShown({ kin: 'guild', lv: 1 }, { ...all, guild: false }), false);
  assert.equal(playerShown({ kin: null, lv: 1 }, { ...all, others: false }), false);
  assert.equal(playerShown({ kin: 'friend' }, { ...all, others: false }), true, 'a friend is no stranger');
  assert.equal(playerShown({ kin: null, lv: 9 }, { ...all, renown: 10 }), false, 'under the floor');
  assert.equal(playerShown({ kin: null, lv: 10 }, { ...all, renown: 10 }), true, 'at it');
  const f = { towns: true, distant: true, dungeons: true, enemies: true, travellers: true, gathering: true };
  assert.equal(markShown({ kind: 'traveller', kin: 'guild', lv: 3 }, f, { ...all, guild: false }), false, 'the Overworld\'s marks read the who');
  assert.equal(markShown({ kind: 'traveller', kin: 'guild', lv: 3 }, { ...f, travellers: false }, all), false, 'and the Travellers switch above it');
  assert.equal(markShown({ kind: 'party', lv: 0 }, f, { ...all, others: false, renown: 40 }), true, 'my party is never filtered');
  assert.equal(markShown({ kind: 'gather mining', dist: 1.5 }, f, { ...all, nodeKm: 1 }), false, 'past the reach');
  assert.equal(markShown({ kind: 'gather mining', dist: 0.8 }, f, { ...all, nodeKm: 1 }), true);
  assert.equal(markShown({ kind: 'gather mining', dist: 2.9 }, f, all), true, 'no reach: as far as they are gathered');
  assert.equal(markShown({ kind: 'place', dist: 9 }, f, { ...all, nodeKm: 0.5 }), true, 'a town is no node');
  // the steps, round, and the switches
  assert.deepEqual([...TV_RENOWN_STEPS], [0, 5, 10, 20, 40]);
  assert.deepEqual([...TV_NODE_KM_STEPS], [null, 0.5, 1, 2]);
  const seen = []; for (let i = 0; i < TV_NODE_KM_STEPS.length; i++) seen.push(cycleTravelViewNodeKm());
  assert.deepEqual(seen, [0.5, 1, 2, null]);
  assert.equal(cycleTravelViewRenown(), 5);
  assert.equal(toggleTravelViewWho('guild'), false);
  assert.equal(travelViewWho().guild, false);
  assert.equal(toggleTravelViewWho('nobody'), false, 'no such switch');
  assert.deepEqual([...TV_WHO_GROUPS], ['friends', 'guild', 'others']);
  assert.equal(TV_WHO_TEXT.nodeKm(1), 'Nodes: 1 km');
  _resetTravelViewFilters();
});

test('OW-HUBS law: a town stands a carriage when one of its blocks is a gate Immersive Travel edits - a composite on one too; the wheel is a rim, six spokes and a hub (mutants: a gate block missed; the spokes gone)', () => {
  const town = (...names) => ({ exterior: { exteriorData: { blockNames: names } } });
  assert.equal(hasCarriageGate(town('TVRNAL01.RMB', 'WALLAA09.RMB')), true);
  assert.equal(hasCarriageGate(town('WALLAA11.FARMAA00.RMB')), true, 'Beautiful Cities\' composite on a gate');
  assert.equal(hasCarriageGate(town('walla10.rmb')), false);
  assert.equal(hasCarriageGate(town('WALLAA07.RMB', 'WALLAA12.RMB')), false, 'not one of the four');
  assert.equal(hasCarriageGate(null), false);
  const calls = [];
  const ctx = new Proxy({}, { get: (o, k) => (k in o ? o[k] : (...a) => calls.push([k, ...a])), set: (o, k, v) => { o[k] = v; return true; } });
  wheelPath(ctx, 10, 10, 5);
  assert.equal(calls.filter(([k]) => k === 'lineTo').length, WHEEL_SPOKES);
  assert.equal(calls.filter(([k]) => k === 'arc').length, 2, 'the rim and the hub');
  calls.length = 0;
  paintCarriageWheel(ctx, 100, 50, true);
  assert.equal(calls.filter(([k]) => k === 'stroke').length, 2, 'the halo, then the pen');
  assert.ok(calls.some(([k, x]) => k === 'arc' && x < 100), 'left of the mark - the anchor stands right');
  // the held map's marks carry it
  const marks = buildInkMarks({ summaries: [], carriageAt: () => true });
  assert.deepEqual(marks, []);
  assert.match(rd('src/ui/inkMap.js'), /carriage: !!carriageAt\(m\.summary\),/);
  assert.match(rd('src/ui/inkMap.js'), /for \(const \[beside, x, y\] of wheels\) paintCarriageWheel\(ctx, x, y, beside\);/);
  assert.match(rd('src/ui/heldMap.js'), /carriageAt: \(s\) => !!this\.deps\.carriageAt\?\.\(s\),/);
});

test('SEAT-TIP law: a seat\'s card names its town, its Charter and who holds it, how long and how firmly, the rule and this week\'s battle; an unheld one says so; no seat no card (mutants: the holder dropped; the battle dropped)', () => {
  const seat = { key: 's', name: 'Anticlere', tier: 'palace', region: 1 };
  const SH = { name: 'the Silver Hand', tag: 'SH', id: 'g1' };
  assert.deepEqual(seatTipOf(seat), { title: 'Anticlere', lines: ['The Charter of Anticlere: unheld'] });
  const held = { ...seat, holder: { guild: SH, since: 3, standing: 55, tithe: 6, edict: null }, battle: { kind: 'tourney', guild: { name: 'Ebon Oath', tag: 'EO' }, against: SH } };
  const tip = seatTipOf(held, 0);
  assert.equal(tip.title, 'Anticlere');
  assert.equal(tip.lines[0], seatInfoLine(seat, SH));
  assert.ok(tip.lines.some((l) => /^Held by the Silver Hand <SH> since week 3\. Standing 55/.test(l)), tip.lines.join(' | '));
  assert.ok(tip.lines.some((l) => /^Tithe 6%\./.test(l)), 'the rule');
  assert.ok(tip.lines.some((l) => /meet in a Tourney for the Charter this week/.test(l)), 'the battle');
  assert.equal(seatTipOf(null), null);
});

// ── the travel (held) map ──────────────────────────────────────────────────────────────────────────────────────────

test('OW-KIN / OW-WHO on the travel map: the rows keep their kin and Renown, a kin moves the key; the sheet draws the players the who shows, in their kin\'s colour, with a players\' row in its key and the colours in its legend; a seat answers with its card, and the I box names its holder', () => {
  const row = { id: 'peer-1', name: 'Bran', px: 10, py: 10, fx: 0, fy: 0 };
  const [a] = readTravellerMarks(() => [{ ...row, kin: 'friend', lv: 12 }]);
  assert.equal(a.kin, 'friend'); assert.equal(a.lv, 12);
  assert.equal(readTravellerMarks(() => [{ ...row, kin: 'enemy' }])[0].kin, null, 'the host\'s word, one of two');
  assert.notEqual(travellerMarksKey([a]), travellerMarksKey(readTravellerMarks(() => [{ ...row, kin: 'guild', lv: 12 }])));
  const H = rd('src/ui/heldMap.js');
  assert.match(H, /travellers: this\._trav\.filter\(\(t\) => playerShown\(t\)\)\.map\(\(t\) => \(\{ x: t\.x, y: t\.y, name: t\.name, color: TV_KIN_COLORS\[t\.kin\] \?\? TRAVELLER_MARK_CSS,/);
  assert.match(H, /for \(const \[kin, word\] of Object\.entries\(TV_KIN_LEGEND\)\) \{/);
  assert.match(H, /if \(this\._trav\.length\) \{\n\s*const row = el\('div', 'hmkeyrow'\);\n\s*row\.append\(el\('span', 'hmkeyname', TV_WHO_TEXT\.title\)\);/);
  assert.match(H, /if \(which === 'renown'\) cycleTravelViewRenown\(\); else toggleTravelViewWho\(which\);/);
  assert.match(H, /const tip = m\.seat \? readTip\(seatTipOf\(m\.seat\)\) : null;/);
  assert.match(H, /\.\.\.\(seat \? \[seatInfoLine\(seat, seat\.holder\?\.guild \?\? null\)\] : \[\]\)/);
  const W = rd('src/scenes/world.js');
  assert.match(W, /ship: isShipMark\(t\.p\), kin: travellerKin\(\{ friend: !!social\?\.isFriendPeer\(t\.id\), gt: t\.gt \}, myGuildTag\(\)\), lv: t\.lv \?\? null \}\)\),/);
  assert.match(W, /carriageAt: \(summary\) => carriageTown\(summary\?\.mapID \?\? summary\?\.mapId\),/);
  assert.match(W, /on = hasCarriageGate\(locationIndex\.get\(`\$\{id % 1000\},\$\{Math\.floor\(id \/ 1000\)\}`\)\);/);
  assert.match(W, /if \(!immersiveTravelLoaded\(\) \|\| !Number\.isFinite\(mapId\)\) return false;/, 'no carriages without the mod');
  assert.match(W, /const seatTipAt = \(mapId\) => seatTipOf\(seatHere\(mapId\)\);/);
  assert.match(rd('src/scenes/gatherHost.js'), /color: nodeMarkCss\(g\.profession\), dist: d \/ 1000 \} \}\);/, 'a group\'s distance, km');
  assert.match(rd('src/scenes/travelView.js'), /\.\.\.\(m\.kin \? \{ kin: m\.kin \} : \{\}\), \.\.\.\(m\.lv != null \? \{ lv: m\.lv \} : \{\}\), \.\.\.\(Number\.isFinite\(m\.dist\) \? \{ dist: m\.dist \} : \{\}\), \.\.\.\(m\.hub \? \{ hub: true \} : \{\}\), \.\.\.\(m\.tip \? \{ tip: m\.tip \} : \{\}\)/, 'every field the readout reads is carried through the view');
});

// ── the Overworld's readout, driven ────────────────────────────────────────────────────────────────────────────────

/** test/tv5_far_places.test.js's fake page, cut down: a canvas whose 2D calls are kept, and a window whose pointer moves. */
function fakeDoc({ w = 1280, h = 720 } = {}) {
  const strokes = [], texts = [], calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : k === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (...a) => {
      calls.push(k);
      if (k === 'fillText') texts.push([String(a[0]), t.fillStyle]);
      if (k === 'stroke') strokes.push([t.strokeStyle, t.lineWidth]);
    }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const listeners = {};
  const win = { devicePixelRatio: 1, innerWidth: w, innerHeight: h, addEventListener: (t, f) => { (listeners[t] ??= []).push(f); }, removeEventListener() {} };
  const doc = { defaultView: win, fonts: null };
  const mk = (tag) => {
    const n = {
      tagName: tag.toUpperCase(), className: '', textContent: '', id: '', children: [], style: { setProperty() {} }, ownerDocument: doc, dataset: {},
      attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
      append(...c) { this.children.push(...c); }, replaceChildren(...c) { this.children = c; }, remove() {}, addEventListener() {}, isConnected: true,
      width: 0, height: 0, getBoundingClientRect() { return { width: 120, height: 40 }; },
    };
    if (tag === 'canvas') n.getContext = () => ctx;
    return n;
  };
  Object.assign(doc, { createElement: mk, createElementNS: (_, tag) => mk(tag), getElementById: () => null, head: mk('head'), body: mk('body') });
  const find = (cls, n = doc.body) => (String(n.className).split(' ').includes(cls) ? n : (n.children ?? []).map((c) => find(cls, c)).find(Boolean) ?? null);
  const move = (x, y) => { for (const f of listeners.pointermove ?? []) f({ clientX: x, clientY: y }); };
  const text = (n) => `${n.textContent ?? ''}${(n.children ?? []).map(text).join('|')}`;
  return { doc, strokes, texts, calls, find, move, text };
}
const frame = (hud, marks) => hud.updateTravelViewHud({ feet: null, heading: null, yaw: 0, where: '', marks });

test('OW-HUBS / SEAT-TIP readout: a carriage town wears its wheel in brass where another wears its dot, its plate edged in brass; a plate with a card shows it under the pointer and lets it go (mutants: the wheel never drawn; the card never shown)', async () => {
  _resetTravelViewFilters();
  const hud = await import('../src/ui/travelViewHud.js');
  const P = fakeDoc();
  hud.showTravelViewHud({}, P.doc);
  try {
    const card = { title: 'Anticlere', lines: ['The Charter of Anticlere: held by the Silver Hand <SH>'] };
    frame(hud, [{ key: 'place:1', x: 400, y: 300, front: true, label: 'Anticlere', kind: 'place', pick: true, hub: true, tip: card }]);
    const brass = hud.TRAVEL_VIEW_MARK_COLORS.brass;
    assert.ok(P.strokes.some(([c, w]) => c === brass && w === 1.5), 'the wheel, in brass');
    P.strokes.length = 0;
    frame(hud, [{ key: 'place:2', x: 400, y: 300, front: true, label: 'Ripwych', kind: 'place', pick: true }]);
    assert.ok(!P.strokes.some(([c, w]) => c === brass && w === 1.5), 'no carriage, no wheel');
    // the card
    frame(hud, [{ key: 'place:1', x: 400, y: 300, front: true, label: 'Anticlere', kind: 'place', pick: true, hub: true, tip: card }]);
    const tip = P.find('tview-tip');
    assert.ok(tip, 'the card is on the page');
    P.move(400, 285);
    frame(hud, [{ key: 'place:1', x: 400, y: 300, front: true, label: 'Anticlere', kind: 'place', pick: true, hub: true, tip: card }]);
    assert.equal(tip.style.display, 'block', 'under the pointer: shown');
    assert.match(P.text(tip), /Anticlere\|The Charter of Anticlere: held by the Silver Hand <SH>/);
    P.move(5, 5);
    frame(hud, [{ key: 'place:1', x: 400, y: 300, front: true, label: 'Anticlere', kind: 'place', pick: true, hub: true, tip: card }]);
    assert.equal(tip.style.display, 'none', 'the pointer gone: let go');
  } finally { hud.disposeTravelViewHud(); _resetTravelViewFilters(); }
});

test('OW-KIN / OW-WHO / OW-NODE-KM readout: a friend\'s and a guild-mate\'s names in their colours; the who\'s switches hide a kin and the floor a low Renown; the node reach hides a far group; the panel\'s presses are the store\'s (mutants: the name\'s colour the stranger\'s; the panel\'s presses dead)', async () => {
  _resetTravelViewFilters();
  const hud = await import('../src/ui/travelViewHud.js');
  const P = fakeDoc();
  hud.showTravelViewHud({}, P.doc);
  try {
    const peer = (id, kin, lv = 5) => ({ key: `peer:${id}`, x: 300 + id.length * 90, y: 300, front: true, label: id, kind: 'traveller', kin, lv, badge: { lv, gt: 'SH' } });
    frame(hud, [peer('Fren', 'friend'), peer('Gilda', 'guild'), peer('Stranger', null)]);
    const colour = (name) => P.texts.find(([t]) => t === name)?.[1];
    assert.equal(colour('Fren'), TV_KIN_COLORS.friend);
    assert.equal(colour('Gilda'), TV_KIN_COLORS.guild);
    assert.equal(colour('Stranger'), hud.TRAVEL_VIEW_NAME_COLORS.name);
    // the panel: Guild off - its press the store's
    const guildBtn = P.find('tview-filters').children.find((b) => b.dataset?.who === 'guild');
    guildBtn.onclick({ preventDefault() {} });
    assert.equal(travelViewWho().guild, false);
    assert.equal(guildBtn.className, 'tview-filter', 'unlit');
    const drawn = () => P.calls.filter((k) => k === 'drawImage').length;   // a name each mark shown (its badge's image)
    P.calls.length = 0;
    frame(hud, [peer('Fren', 'friend'), peer('Gilda', 'guild'), peer('Stranger', null)]);
    assert.equal(drawn(), 2, 'a guild-mate hidden, the friend and the stranger shown');
    // the Renown floor
    const cycles = P.find('tview-filters').children.filter((b) => String(b.className).includes('tview-cycle'));
    cycles[0].onclick({ preventDefault() {} }); cycles[0].onclick({ preventDefault() {} });   // 0 -> 5 -> 10
    assert.equal(cycles[0].textContent, 'Renown 10+');
    P.calls.length = 0;
    frame(hud, [peer('Fren', 'friend', 12), peer('Stranger', null, 5)]);
    assert.equal(drawn(), 1, 'under the floor, hidden');
    // the node reach
    cycles[1].onclick({ preventDefault() {} }); cycles[1].onclick({ preventDefault() {} });   // any -> 0.5 -> 1 km
    assert.equal(cycles[1].textContent, 'Nodes: 1 km');
    P.calls.length = 0;
    frame(hud, [{ key: 'gather:a', x: 600, y: 300, front: true, label: 'Mining x6', kind: 'gather mining', dist: 2.4 }, { key: 'gather:b', x: 700, y: 300, front: true, label: 'Logging x3', kind: 'gather logging', dist: 0.4 }]);
    assert.equal(drawn(), 1, 'the group 2.4 km off hidden, the one 0.4 km off shown');
  } finally { hud.disposeTravelViewHud(); _resetTravelViewFilters(); }
});
