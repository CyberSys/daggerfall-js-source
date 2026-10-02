// HERALDRY-SHOWN (2026-10-02, Mac: "lets finish the build work") - THE HERALDRY ON THE SMALL FACES (Seats-Arc 8.1: "It is
// drawn on banners (3.4), the map ring, the frame of the guild tag, the siege HUD, the board and the Chronicle"): the one
// swatch (ui/heraldrySwatch.js over ui/heraldryArt.js shieldSvg), the index by tag the client builds from what it holds
// (net/heraldryIndex.js heraldryByTag), the name tag's frame (ui/nameLayer.js), the siege HUD's two shields
// (net/siegeLink.js siegeHudModel's `arms`, fightArmed; ui/siegeHud.js), the Seat tab's Chronicle and the Hall of
// Records' Roll of Arms (ui/seatTab.js, ui/hallOfRecords.js), and the host's wiring. `06-Systems/Online-Arc.md`
// HERALDRY-SHOWN.
import './chargenDom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { byClass } from './chargenDom.mjs';
import { heraldryText } from '../src/net/heraldryLaw.js';
import { heraldryByTag } from '../src/net/heraldryIndex.js';
import { shieldSvg, SHIELD_CLOTH, SHIELD_DEVICE, DEVICE_ART } from '../src/ui/heraldryArt.js';
import { heraldrySwatchSrc, heraldrySwatch, paintSwatch, heraldryLookup, chronicleGuildOf, HERALDRY_SWATCH_CLASS, HERALDRY_SWATCH_PX } from '../src/ui/heraldrySwatch.js';
import { createNameLayer, NAME_CSS } from '../src/ui/nameLayer.js';
import { foldSiege, siegeHudModel, fightArmed, SIEGE_STATE_EMPTY } from '../src/net/siegeLink.js';
import { createSiegeHud, SIEGE_HUD_CSS } from '../src/ui/siegeHud.js';
import { mountNoticeBoard } from '../src/ui/noticeWindow.js';
import { hallOfRecordsTokens, hallOfRecordsRoll, HALL_OF_RECORDS_ROLL } from '../src/ui/hallOfRecords.js';
import { RSC, TOKEN_TEXT } from '../src/formats/textRsc.js';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const tick = (n = 4) => new Promise((r) => { let i = 0; const go = () => (++i >= n ? r() : setTimeout(go, 0)); setTimeout(go, 0); });
const ANTICLERE = { key: 3021, name: 'Anticlere', region: 21, tier: 'palace', pixel: [402, 151] };
const SH_ARMS = { field: 'azure', border: 'gold', device: 'tower' };
const EO_ARMS = { field: 'crimson', border: 'argent', device: 'wolf' };
const SH = { id: 'g1', name: 'The Silver Hand', tag: 'SH', heraldry: SH_ARMS };
const EO = { id: 'g2', name: 'Ebon Oath', tag: 'EO', heraldry: EO_ARMS };
const IC = { id: 'g3', name: 'Iron Circle', tag: 'IC', heraldry: { field: 'vert', border: 'sable', device: 'axe' } };
const svgOf = (src) => decodeURIComponent(src.replace(/^data:image\/svg\+xml;charset=utf-8,/, ''));

test('HERALDRY-SHOWN THE SWATCH: a guild\'s heraldry as a small shield - its field filled, its border inside the edge, its device in the border colour on the field - a picture\'s data: URI, never markup; painted on a picture only when it changes, hidden for none; a seat\'s plain cloth and a bad heraldry draw none (mutants: the field; the border; the device\'s colours; the size; the paint\'s memo; the hiding)', () => {
  const svg = shieldSvg(SH_ARMS, { size: 20 });
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 100 104" width="20" height="21" role="img" aria-label="heraldry">/);
  assert.ok(svg.includes(`<path d="${SHIELD_CLOTH}" fill="#3b6fd8"/>`), 'the field, Azure');
  assert.ok(svg.includes(`<path d="${SHIELD_CLOTH}" fill="none" stroke="#d4a017" stroke-width="20" clip-path="url(#hsazuregoldtower)"/>`), 'the border, Gold, inside the edge');
  assert.ok(svg.includes(`<g transform="translate(${SHIELD_DEVICE.x} ${SHIELD_DEVICE.y}) scale(${SHIELD_DEVICE.scale})"><path d="${DEVICE_ART.tower[0].d}" fill="#d4a017"/><path d="${DEVICE_ART.tower[1].d}" fill="#3b6fd8"/>`), 'the device in the border colour, its holes the field');
  assert.equal(shieldSvg(SH_ARMS).match(/width="(\d+)"/)[1], '16', 'sixteen by default');
  assert.deepEqual([shieldSvg(null), shieldSvg({ field: 'azure', border: 'gold', device: null }), shieldSvg({ field: 'ash', border: 'gold', device: 'wolf' })], ['', '', ''], 'none, a plain cloth, a field of Ash');
  const src = heraldrySwatchSrc(EO_ARMS);
  assert.ok(src.startsWith('data:image/svg+xml;charset=utf-8,%3Csvg'), 'a data: URI');
  assert.equal(svgOf(src), shieldSvg(EO_ARMS, { size: HERALDRY_SWATCH_PX }));
  assert.equal(heraldrySwatchSrc(undefined), '');
  // the DOM door
  const img = heraldrySwatch(document, SH_ARMS);
  assert.deepEqual([img.tagName, img.className, img.attrs.width, img.attrs.height, img.alt, img.title, img.style.display], ['IMG', HERALDRY_SWATCH_CLASS, '14', '15', 'Azure bordered Gold, a Tower', 'Azure bordered Gold, a Tower', '']);
  assert.equal(img.src, heraldrySwatchSrc(SH_ARMS));
  assert.equal(heraldrySwatch(document, IC.heraldry, { size: 22, className: 'x' }).attrs.width, '22');
  assert.equal(heraldrySwatch(document, IC.heraldry, { size: 22, className: 'x' }).className, 'x');
  assert.equal(heraldrySwatch(document, null), null, 'none: nothing to append');
  assert.equal(heraldrySwatch(document, { field: 'gold', border: 'gold', device: 'wolf' }), null, 'a heraldry the law refuses');
  // paint: written when it changes, hidden for none
  const p = document.createElement('img');
  assert.equal(paintSwatch(p, EO_ARMS), true);
  assert.deepEqual([p.src, p.alt, p.style.display], [heraldrySwatchSrc(EO_ARMS), heraldryText(EO_ARMS), '']);
  p.src = 'kept';
  assert.equal(paintSwatch(p, { ...EO_ARMS }), true);
  assert.equal(p.src, 'kept', 'the same heraldry: not written again');
  assert.equal(paintSwatch(p, null), false);
  assert.deepEqual([p.style.display, p.alt], ['none', ''], 'none: hidden');
  assert.equal(paintSwatch(p, SH_ARMS), true);
  assert.deepEqual([p.src, p.style.display], [heraldrySwatchSrc(SH_ARMS), ''], 'another: painted');
});

test('HERALDRY-SHOWN THE INDEX: a guild\'s heraldry by its tag off what the client holds - a guild, the seats\' list (each holder and each battle\'s two), a seat\'s standings - the first word on a tag kept and none for a guild without; the lookup builds it again only when a source is another object; the guild a Chronicle row is about, the one its line names first (mutants: each source; the first kept; the memo; the row\'s guild)', () => {
  const list = { seats: [{ key: 1, holder: { guild: SH }, battle: { kind: 'siege', guild: EO, against: SH } }, { key: 2, holder: null, battle: { kind: 'tourney', guild: IC, against: { name: 'Bare', tag: 'BR', heraldry: null } } }] };
  const m = heraldryByTag(list);
  assert.deepEqual([...m.keys()], ['SH', 'EO', 'IC']);
  assert.deepEqual(m.get('EO'), EO_ARMS);
  assert.deepEqual([...heraldryByTag({ holder: { guild: SH }, standings: [{ guild: IC }], battle: { guild: EO, against: null } }).keys()], ['SH', 'EO', 'IC'], 'a seat\'s standings answer');
  assert.deepEqual([...heraldryByTag({ holder: { guild: EO } }).keys()], ['EO'], 'a dressed seat');
  assert.deepEqual([...heraldryByTag({ battle: { kind: 'revolt', guild: null, against: IC } }).keys()], ['IC'], 'a battle\'s holder alone (a revolt\'s)');
  const mine = { id: 'g1', tag: 'SH', name: 'The Silver Hand', heraldry: { field: 'teal', border: 'rose', device: 'sun' } };
  assert.equal(heraldryByTag(mine, list).get('SH').field, 'teal', 'the first source\'s word on a tag kept');
  assert.equal(heraldryByTag(list, mine).get('SH').field, 'azure');
  assert.equal(heraldryByTag(null, undefined, 'x', { seats: 'no' }).size, 0);
  assert.equal(heraldryByTag({ tag: 'AB', heraldry: { field: 'ash', border: 'gold', device: 'wolf' } }).size, 0, 'a heraldry the law refuses');
  // the lookup
  let a = mine, b = list, built = 0;
  const look = heraldryLookup(() => { built++; return [a, b]; });
  assert.equal(look('SH').field, 'teal');
  assert.deepEqual(look('IC'), IC.heraldry);
  assert.equal(look('BR'), null, 'a guild with none');
  assert.equal(look(''), null);
  assert.equal(look(null), null);
  assert.equal(built, 3, 'not asked for no tag');
  a = null;
  assert.equal(look('SH').field, 'azure', 'a source moved: built again');
  b = { seats: [] };
  assert.equal(look('SH'), null);
  const same = { seats: [{ holder: { guild: EO } }] };
  b = same;
  assert.deepEqual(look('EO'), EO_ARMS);
  same.seats.push({ holder: { guild: IC } });
  assert.equal(look('IC'), null, 'the same object: the index kept (the book replaces its list on each read)');
  const look2 = heraldryLookup(() => null);
  assert.equal(look2('SH'), null);
  // the row's guild
  const of = (kind, data) => chronicleGuildOf({ kind, week: 3, data })?.tag ?? null;
  assert.equal(of('claim', { guild: SH, total: 6000 }), 'SH');
  assert.equal(of('right', { guild: EO, holder: SH }), 'EO');
  assert.equal(of('contested', { a: IC, b: SH }), 'IC');
  assert.equal(of('siege-forfeit', { guild: SH, against: EO }), 'EO');
  assert.equal(of('siege-void', { battle: 'siege', guild: EO, holder: SH, carried: true }), 'SH');
  assert.equal(of('siege-void', { battle: 'tourney', guild: EO, holder: SH }), null, 'a void Tourney names neither');
  assert.equal(of('fealty-sworn', { vassal: IC, liege: SH }), 'IC');
  assert.equal(of('fealty-broken', { vassal: IC, liege: SH, breaker: SH }), 'SH');
  assert.equal(of('fealty-tribute', { vassal: EO, liege: SH, marks: 5 }), 'EO');
  assert.equal(of('fealty-lapsed', { vassal: EO, liege: SH }), 'EO');
  assert.equal(of('royal-champion', { name: 'Mara', wins: 3 }), null);
  assert.equal(of('held', { guild: { name: 'X', tag: '' } }), null);
  assert.equal(of('held', { guild: 'SH' }), null);
  assert.equal(chronicleGuildOf(null), null);
});

/** guild1c's own mock: a node whose textContent is its own text alone. */
const mockDoc = () => {
  const node = (tag) => {
    const n = { tagName: tag.toUpperCase(), children: [], parent: null, attrs: {}, style: {}, dataset: {},
      append(...cs) { for (const c of cs) { c.parent = n; n.children.push(c); } },
      setAttribute(k, v) { n.attrs[k] = v; }, remove() { if (n.parent) n.parent.children.splice(n.parent.children.indexOf(n), 1); n.parent = null; } };
    let text = '', cls = '';
    Object.defineProperty(n, 'textContent', { get: () => text, set: (v) => { text = String(v); n.children.length = 0; } });
    Object.defineProperty(n, 'className', { get: () => cls, set: (v) => { cls = String(v); } });
    return n;
  };
  return { createElement: (t) => node(t), createElementNS: (ns, t) => node(t), head: node('head'), body: node('body'), getElementById: () => null };
};

test('HERALDRY-SHOWN THE TAG\'S FRAME: a peer\'s <TAG> whose guild\'s heraldry the client knows is framed - a plate edged in its border colour with its shield at the left - written when it changes; a tag unknown, none, or a layer with no lookup wears the plain tag; the host hands the layer its lookup (mutants: the frame; the border colour; the shield; the memo; the gate on a tag)', () => {
  const asked = [];
  const arms = new Map([['SH', SH_ARMS], ['EO', EO_ARMS]]);
  const layer = createNameLayer({ doc: mockDoc(), now: () => 1000, armsOf: (t) => { asked.push(t); return arms.get(t) ?? null; } });
  const at = (gt) => { layer.render({ points: [{ id: 'peer-0001', name: 'Mack', x: 400, y: 300, scale: 1, title: null, glyphs: [], lv: 3, gt }] }); return layer.tagFor('peer-0001'); };
  let t = at('SH');
  assert.equal(t.guild.textContent, '<SH>');
  assert.deepEqual([t.guild.className, t.guild.style.borderColor, t.guild.style.backgroundImage], ['dfname-guild armed', '#d4a017', `url("${heraldrySwatchSrc(SH_ARMS)}")`]);
  t.guild.style.borderColor = 'rgb(212, 160, 23)';   // a browser reads it back normalised
  t = at('SH');
  assert.equal(t.guild.style.borderColor, 'rgb(212, 160, 23)', 'written when it changes, never every frame');
  t = at('EO');
  assert.deepEqual([t.guild.className, t.guild.style.borderColor, t.guild.style.backgroundImage], ['dfname-guild armed', '#e6e6e6', `url("${heraldrySwatchSrc(EO_ARMS)}")`], 'another guild: its own');
  t = at('IC');
  assert.deepEqual([t.guild.textContent, t.guild.className, t.guild.style.borderColor, t.guild.style.backgroundImage], ['<IC>', 'dfname-guild', '', ''], 'a guild the client knows no heraldry of: the plain tag');
  asked.length = 0;
  t = at(null);
  assert.deepEqual([t.guild.textContent, t.guild.className], ['', 'dfname-guild']);
  at('bad tag');
  assert.deepEqual(asked, [], 'no tag, or no tag the law reads: nothing asked');
  // no lookup: exactly the tag GUILD1c drew; one handed in later
  const bare = createNameLayer({ doc: mockDoc(), now: () => 1000 });
  const pt = (gt) => ({ points: [{ id: 'p', name: 'Bran', x: 1, y: 1, scale: 1, title: null, glyphs: [], gt }] });
  bare.render(pt('SH'));
  assert.deepEqual([bare.tagFor('p').guild.className, bare.tagFor('p').guild.style.backgroundImage], ['dfname-guild', undefined]);
  bare.setArmsOf((tag) => arms.get(tag));
  bare.render(pt('SH'));
  assert.equal(bare.tagFor('p').guild.className, 'dfname-guild armed');
  bare.setArmsOf('no');
  bare.render(pt('SH'));
  assert.equal(bare.tagFor('p').guild.className, 'dfname-guild', 'a lookup that is no function: none');
  assert.match(NAME_CSS, /\.dfname-guild\.armed \{ padding: \.06em \.3em \.04em 1\.25em; border: 1px solid; border-radius: \.12em;\n  background: rgba\(14, 16, 19, \.78\) no-repeat \.22em 50% \/ \.82em auto; \}/);
  // the host
  const w = rd('src/scenes/world.js');
  assert.match(w, /\n  const seatArmsOf = heraldryLookup\(\(\) => \[guildBook\?\.guild, seatBook\?\.data\]\);\n/, 'the reader\'s own guild first, then the seats\' list');
  assert.match(w, /if \(nameLayerWanted\(\)\) nameLayer = createNameLayer\(\{\}\);[^\n]*\n    nameLayer\?\.setArmsOf\(seatArmsOf\);/);
});

test('HERALDRY-SHOWN THE SIEGE HUD: each side\'s shield on the bar - the defender\'s at its left, the challenger\'s at its right - from the fight its guilds dressed in the seat\'s heraldry (the fight\'s answer carries none); a revolt\'s rising town and a guild with none show none, and a Royal Tourney\'s model none at all; the session dresses the fight it enters (mutants: the sides; the revolt; the dress; the paint)', () => {
  const plain = (g) => ({ id: g.id, name: g.name, tag: g.tag });
  const seat = { ...ANTICLERE, holder: { guild: SH }, battle: { kind: 'siege', guild: EO, against: SH } };
  const fight = { kind: 'siege', tier: 'palace', attackerGuild: plain(EO), defenderGuild: plain(SH), sides: {} };
  const armed = fightArmed(fight, seat);
  assert.deepEqual([armed.attackerGuild.heraldry, armed.defenderGuild.heraldry, armed.kind, armed.sides], [EO_ARMS, SH_ARMS, 'siege', fight.sides]);
  assert.equal(fight.attackerGuild.heraldry, undefined, 'the answer itself untouched');
  const own = { ...fight, attackerGuild: { ...plain(EO), heraldry: IC.heraldry } };
  assert.deepEqual(fightArmed(own, seat).attackerGuild.heraldry, IC.heraldry, 'a guild already dressed keeps its own');
  assert.equal(fightArmed(fight, ANTICLERE).attackerGuild, fight.attackerGuild, 'a seat with no dress: as it came');
  assert.equal(fightArmed(null, seat), null);
  const revoltFight = fightArmed({ kind: 'revolt', tier: 'palace', attackerGuild: null, defenderGuild: plain(SH) }, seat);
  assert.equal(revoltFight.attackerGuild, null);
  // the model
  const AT = 1_800_000_000_000;
  const s = foldSiege(SIEGE_STATE_EMPTY, { k: 'f', b: [[2, 0, 0], [2, 0, 0], [2, 0, 0]], th: 0, s: AT, e: AT + 1_800_000, n: [1, 1, 0] }, AT);
  const battle = { seat: 'Anticlere', kind: 'siege', tier: 'palace', attacker: armed.attackerGuild, defender: armed.defenderGuild };
  assert.deepEqual(siegeHudModel(s, battle, 'me', AT).arms, { defend: SH_ARMS, attack: EO_ARMS });
  assert.deepEqual(siegeHudModel(s, { ...battle, attacker: plain(EO) }, 'me', AT).arms, { defend: SH_ARMS, attack: null }, 'a guild with none');
  assert.deepEqual(siegeHudModel(s, { ...battle, kind: 'revolt', attacker: armed.attackerGuild }, 'me', AT).arms, { defend: SH_ARMS, attack: null }, 'a revolt: the town has none');
  assert.deepEqual(siegeHudModel({ ...s, revolt: true }, battle, 'me', AT).arms, { defend: SH_ARMS, attack: null }, 'a field that says revolt');
  // the bar
  const hud = createSiegeHud(document);
  hud.update(siegeHudModel(s, battle, 'me', AT));
  const bar = hud.node.querySelector('.sg-bar');
  assert.ok(bar.children[0].textContent.startsWith('ANTICLERE'), 'the title still the bar\'s first');
  const [d, a] = [byClass(bar, 'sg-arm-defend')[0], byClass(bar, 'sg-arm-attack')[0]];
  assert.deepEqual([d.className, d.tagName, d.src, d.alt, d.style.display], ['sg-arm sg-arm-defend', 'IMG', heraldrySwatchSrc(SH_ARMS), 'Azure bordered Gold, a Tower', '']);
  assert.deepEqual([a.className, a.src, a.style.display], ['sg-arm sg-arm-attack', heraldrySwatchSrc(EO_ARMS), '']);
  hud.update(siegeHudModel(s, { ...battle, kind: 'revolt' }, 'me', AT));
  assert.deepEqual([d.style.display, a.style.display], ['', 'none'], 'a revolt: the challenger\'s hidden');
  hud.update({ bar: ['ROYAL', ''], works: null, sides: '', self: [], card: null });
  assert.deepEqual([d.style.display, a.style.display], ['none', 'none'], 'a Royal Tourney\'s model: none');
  assert.match(SIEGE_HUD_CSS, /\.sg-bar \{ position: relative;[^\n]*padding: 3px 34px; \}\n\.sg-arm \{ position: absolute; top: 4px; width: 22px; height: auto;[^\n]*\}\n\.sg-arm-defend \{ left: 6px; \}\n\.sg-arm-attack \{ right: 6px; \}/);
  hud.destroy();
  // the session dresses the fight it enters, once
  assert.match(rd('src/net/siegeSession.js'), /      s = \{ seat, battle: fightArmed\(battle, seat\), field, room: '',/);
  assert.match(rd('src/net/siegeSession.js'), /attacker: s\.battle\?\.attackerGuild, defender: s\.battle\?\.defenderGuild \}/);
});

test('HERALDRY-SHOWN THE SEAT TAB\'S CHRONICLE: each line under the shield of the guild it is about - known from the standings\' answer or the seats\' list - and a line about a guild unknown, or no guild, under none; the words unchanged (mutants: the swatch; the row\'s guild; the sources)', async () => {
  const noticeBook = { seenAt: () => null, read: async () => ({ board: { notes: [], notices: [], me: {} } }), markSeen: () => {}, cached: () => null, draft: () => ({ subject: '', body: '', days: 7, button: '' }), noticeDraft: () => ({ subject: '', body: '', days: 3 }), readGuild: async () => ({ data: null, error: 'no-guild' }) };
  const XX = { name: 'Lost Lantern', tag: 'LL' };
  const data = {
    seat: ANTICLERE, week: 16, phase: 'muster', reckoningAt: 1_800_003_600, turningAt: 1_800_086_400, defence: 4500,
    holder: { guild: SH, since: 3, standing: 55 }, battle: null,
    standings: [{ guild: SH, influence: 4000, legacy: 0, tribute: 0, accounts: 2, holder: true }],
    chronicle: [
      { kind: 'held', week: 15, data: { guild: { name: SH.name, tag: 'SH' } } },
      { kind: 'right', week: 14, data: { guild: { name: IC.name, tag: 'IC' }, holder: { name: SH.name, tag: 'SH' } } },
      { kind: 'nonsense', week: 13, data: { guild: { name: EO.name, tag: 'EO' } } },
      { kind: 'claim', week: 3, data: { guild: XX, total: 6100 } },
      { kind: 'battle-void', week: 2, data: {} },
    ],
    mine: null,
  };
  const seatBook = { open: true, data: { seats: [{ ...ANTICLERE, holder: null, battle: { kind: 'tourney', guild: IC, against: EO } }] }, standings: async () => ({ data, error: null }), forts: async () => ({ data: null, error: 'x' }) };
  const host = document.createElement('div');
  mountNoticeBoard(host, { town: { name: 'Anticlere', mapId: 3021 }, book: noticeBook, nowS: () => 1_800_000_000, seat: { seat: ANTICLERE, book: seatBook } });
  byClass(host, 'notice-tab')[1].onclick();
  await tick();
  const lis = byClass(host, 'notice-chronicle')[0].querySelectorAll('li');
  assert.deepEqual(lis.map((li) => li.textContent), [
    'In week 15, the Silver Hand <SH> held Anticlere unchallenged.',
    'In week 14, Iron Circle <IC> won a Right of Siege against the Silver Hand <SH> at Anticlere.',
    'In week 3, Lost Lantern <LL> took the Charter of Anticlere with 6,100 influence.',
    'In week 2, no hour of the week could hold the battle for Anticlere; it is void.',
  ], 'the words as they were; a row with none left out');
  const shield = (li) => li.querySelectorAll('img')[0] ?? null;
  assert.deepEqual(lis.map((li) => shield(li)?.src ?? null), [heraldrySwatchSrc(SH_ARMS), heraldrySwatchSrc(IC.heraldry), null, null],
    'the holder\'s from the answer; the challenger\'s from the seats\' list; a guild unknown, and a row about none, under none');
  assert.deepEqual([lis[0].children[0].className, lis[0].children[1].tagName], [HERALDRY_SWATCH_CLASS, 'SPAN'], 'the shield before the words');
  assert.equal(shield(lis[1]).alt, 'Vert bordered Sable, an Axe');
});

test('HERALDRY-SHOWN THE HALL OF RECORDS\' ROLL OF ARMS: the book reader draws text alone, so after its chapters the book names each guild its lines name, once, in the order it first names it, with its heraldry in words - only those the lookup knows, and no Roll without one; the host hands both of its doors the lookup (mutants: the Roll; once; the unknown; the rows with no words)', () => {
  const arms = new Map([['SH', SH_ARMS], ['IC', IC.heraldry]]);
  const armsOf = (t) => arms.get(t) ?? null;
  const rows = [
    { kind: 'claim', week: 3, data: { guild: { name: SH.name, tag: 'SH' }, total: 6100 } },
    { kind: 'nonsense', week: 4, data: { guild: { name: 'Ghost', tag: 'GH' } } },
    { kind: 'right', week: 5, data: { guild: { name: IC.name, tag: 'IC' }, holder: { name: SH.name, tag: 'SH' } } },
    { kind: 'right', week: 6, data: { guild: { name: EO.name, tag: 'EO' }, holder: { name: SH.name, tag: 'SH' } } },
  ];
  arms.set('GH', EO_ARMS);
  assert.deepEqual(hallOfRecordsRoll(rows, ANTICLERE, armsOf), [
    'The Silver Hand <SH>: Azure bordered Gold, a Tower.',
    'Iron Circle <IC>: Vert bordered Sable, an Axe.',
  ], 'once each, in the book\'s order; a guild named only in a row with no words, and one unknown, left out');
  assert.deepEqual([hallOfRecordsRoll(rows, ANTICLERE), hallOfRecordsRoll(rows, ANTICLERE, 'x'), hallOfRecordsRoll(null, ANTICLERE, armsOf)], [[], [], []]);
  const t = hallOfRecordsTokens(ANTICLERE, rows, null, armsOf);
  const tail = t.slice(-11);
  assert.deepEqual(tail, [{ formatting: RSC.JustifyCenter }, { formatting: TOKEN_TEXT, text: HALL_OF_RECORDS_ROLL }, { formatting: RSC.NewLine }, { formatting: RSC.NewLine }, { formatting: RSC.JustifyLeft },
    { formatting: TOKEN_TEXT, text: 'The Silver Hand <SH>: Azure bordered Gold, a Tower.' }, { formatting: RSC.NewLine }, { formatting: RSC.NewLine },
    { formatting: TOKEN_TEXT, text: 'Iron Circle <IC>: Vert bordered Sable, an Axe.' }, { formatting: RSC.NewLine }, { formatting: RSC.NewLine }]);
  assert.equal(HALL_OF_RECORDS_ROLL, 'The Roll of Arms');
  assert.deepEqual(hallOfRecordsTokens(ANTICLERE, rows, null), t.slice(0, -11), 'no lookup: the book as it was');
  assert.deepEqual(hallOfRecordsTokens(ANTICLERE, rows, null, () => null), t.slice(0, -11), 'none known: no Roll');
  const w = rd('src/scenes/world.js');
  assert.match(w, /townTalk\.showOverlay\(hallOfRecordsWindow\(st, r\.data\.rows, r\.data\.zero, seatArmsOf\)\);/);
  assert.match(w, /return r\.data \? hallOfRecordsWindow\(seat, r\.data\.rows, r\.data\.zero, seatArmsOf\) : null;/);
  assert.match(rd('src/ui/hallOfRecords.js'), /export const hallOfRecordsWindow = \(seat, rows, zero = null, armsOf = null\) => createBookReaderWindow\(hallOfRecordsBook\(seat, rows, zero, armsOf\)\);/);
});
