// NEMESIS-CARD, NEMESIS-PAGE, NEMESIS-HARM, NEMESIS-DUNGEON, NEMESIS-WIRE (2026-10-02, Mac: "Definitely finish this with
// love. Any new UI elements need to be enhanced UI plus. For taunting enemies. I was hoping it would have a portrait
// popup and enemy dialog (kind of like our notification system)"). The laws pinned here:
//   - THE EVENTS: each thing a nemesis says or does is an event - its kicker, name, what it is, its portrait (the sprite
//     it wore, else its kind's by gender; the idle's front record, else the walk's), its words or the narrator's, and
//     the one line a text surface says instead; a face draws it or the host says the line.
//   - THE CARD (enhanced skin only): a portrait popup with typed words, one per nemesis, two at most, held, slid out;
//     hidden under the HUD's gate with its clock stopped; the whole line for a screen reader; reduced motion types
//     nothing; the classic skin declines and the line is said.
//   - THE PAGE: the living strongest first, when each will come, what each has done; the fallen; the empty words.
//   - THE HARM: a death no blow names goes to the foe whose spell, lingering effect or blow last reached the player;
//     a killing blow outranks it.
//   - THE DUNGEON, THE WIRE, THE SINGLE-LOCATION HOST, THE KIT: by source.

import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null), setItem: (k, v) => { _store.set(k, String(v)); },
  removeItem: (k) => { _store.delete(k); }, clear: () => _store.clear(), key: (i) => [..._store.keys()][i] ?? null, get length() { return _store.size; },
};

const N = await import('../src/systems/nemesis.js');
const V = await import('../src/systems/nemesisVoice.js');
const C = await import('../src/ui/nemesisCard.js');
const P = await import('../src/ui/nemesisPage.js');
const H = await import('../src/systems/harmMark.js');
const { setPref, _resetForTests } = await import('../src/systems/uiPrefs.js');
const { hurtPlayer, setAvoidDeathHook } = await import('../src/characters/playerEntity.js');
const { setStruck, _resetSetPowersForTests } = await import('../src/systems/sigilSetPowers.js');
const { setPlayerDoor } = await import('../src/systems/playerDoor.js');
const { MOBILE_TYPES } = await import('../src/characters/mobileTypes.js');
const { ENEMY_BASICS, enemyDisplayName } = await import('../src/characters/enemyBasics.js');
const { validFoeRecord, NEMESIS_NAME_MAX } = await import('../src/net/wire.js');
const { FRAME_ROLES } = await import('../src/ui/enhancedFrame.js');
const { HUD_PIECES } = await import('../src/ui/hudLayout.js');

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const { modSaveRecords, restoreModSaveRecords } = await import('../src/systems/modSaveData.js');
const modSave = () => modSaveRecords()[N.NEMESIS_SAVE];
const restore = (rec) => restoreModSaveRecords({ [N.NEMESIS_SAVE]: rec });
const stats = () => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 });
const player = (id = 'char-c') => ({
  isPlayer: true, name: 'Ayla Stormwind', characterId: id, items: [], stats: stats(), skills: new Array(35).fill(30), level: 5,
  career: {}, activeEffects: [], health: 100, maxHealth: 100, magicka: 0, maxMagicka: 1000, armorValues: new Array(7).fill(100),
});
const orc = (over = {}) => ({ mobileType: MOBILE_TYPES.OrcWarlord, level: 9, health: 60, maxHealth: 60, team: 'Orcs', champion: 'mighty', ...over });
const tick = () => new Promise((r) => setTimeout(r, 0));
function fresh() {
  _resetForTests(); setPref('lootRarity', true);
  N._resetNemesisForTests(); _store.clear(); _resetSetPowersForTests(); setPlayerDoor(null); setAvoidDeathHook(null); H._resetHarmMarkForTests();
}

// ── a document, just enough of one (test/pickupfeed.test.js's) ──
function fakeEl(tag, doc) {
  const classes = new Set();
  const n = {
    tag, doc, children: [], dataset: {}, attrs: {}, parent: null, style: { setProperty() {}, getPropertyValue: () => '' },
    classList: {
      add: (...c) => c.forEach((x) => classes.add(x)), remove: (...c) => c.forEach((x) => classes.delete(x)),
      toggle: (c, on = !classes.has(c)) => { if (on) classes.add(c); else classes.delete(c); return on; }, contains: (c) => classes.has(c),
    },
    get className() { return [...classes].join(' '); },
    set className(v) { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach((x) => classes.add(x)); },
    _text: '',
    get textContent() { return n._text + n.children.map((c) => c.textContent ?? '').join(''); },
    set textContent(v) { n.children.forEach((c) => { c.parent = null; }); n.children.length = 0; n._text = v == null ? '' : String(v); },
    get firstChild() { return n.children[0] ?? null; },
    append(...cs) { for (const c of cs) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = n; n.children.push(c); } },
    insertBefore(c, ref) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); c.parent = n; const i = ref ? n.children.indexOf(ref) : -1; if (i < 0) n.children.push(c); else n.children.splice(i, 0, c); return c; },
    remove() { if (n.parent) { const i = n.parent.children.indexOf(n); if (i >= 0) n.parent.children.splice(i, 1); n.parent = null; } n.removed = true; },
    setAttribute(k, v) { n.attrs[k] = v; }, getAttribute: (k) => n.attrs[k] ?? null, hasAttribute: (k) => k in n.attrs,
  };
  return n;
}
function fakeDocument() {
  const doc = {};
  doc.createElement = (t) => fakeEl(t, doc);
  doc.body = fakeEl('body', doc);
  doc.head = fakeEl('head', doc);
  const all = () => { const out = []; const walk = (x) => { for (const c of x.children) { out.push(c); walk(c); } }; walk(doc.head); walk(doc.body); return out; };
  doc.getElementById = (id) => all().find((e) => e.id === id) ?? null;
  doc.all = all;
  return doc;
}
const byClass = (root, cls) => { const out = []; const walk = (x) => { for (const c of x.children ?? []) { if (c.classList?.contains(cls)) out.push(c); walk(c); } }; walk(root); return out; };
function withPage(fn, { skin = 'enhanced' } = {}) {
  const doc = fakeDocument();
  globalThis.document = doc;
  globalThis.location = { search: `?skin=${skin}` };
  C._resetNemesisCardsForTests();
  C._setNemesisCardForTests({ icon: () => ({ src: 'data:x', w: 34, h: 60, smooth: false }), schedule: () => 1, cancel: () => {} });
  try { return fn(doc); } finally {
    C._resetNemesisCardsForTests();
    C._setNemesisCardForTests({ icon: null });
    delete globalThis.document; delete globalThis.location; delete globalThis.matchMedia;
  }
}

test('NEMESIS-CARD THE EVENTS: a taunt, a flight, an escape, a fall and a rise each an event - kicker, name, what it is, the portrait (the sprite it wore, else its kind\'s by gender; the idle\'s front record, else the walk\'s), its words or the narrator\'s, the line beside (mutants: the line lost; the portrait the walk\'s for an idler; a beast given words)', () => {
  fresh();
  const me = player();
  const r = N.nemesisDeed(me, orc(), 'slew', { now: 10, rolls: () => 0 });
  const t = N.nemesisTauntEvent(r, me.name, { rolls: () => 0 });
  assert.equal(t.kind, 'taunt'); assert.equal(t.kicker, 'Nemesis'); assert.equal(t.name, r.name); assert.equal(t.rank, 1);
  assert.equal(t.sub, `${enemyDisplayName(MOBILE_TYPES.OrcWarlord)} · Mighty`);
  assert.ok(t.speech && !t.speech.startsWith(r.name), 'its own words, unprefixed');
  assert.equal(t.line, `${r.name}: "${t.speech}"`, 'the text surface\'s line');
  assert.equal(t.line, N.nemesisTaunt(r, me.name, () => 0), 'the one taunt, two ways');
  const b = ENEMY_BASICS[MOBILE_TYPES.OrcWarlord];
  assert.deepEqual(t.portrait, { archive: b.maleTexture, record: b.hasIdle ? 15 : 0 });
  assert.deepEqual(N.nemesisPortrait({ mobileType: 130, gender: 'female' }).archive, ENEMY_BASICS[130].femaleTexture, 'a woman\'s sprite');
  assert.equal(N.nemesisPortrait({ mobileType: MOBILE_TYPES.OrcWarlord, archive: 9999 }).archive, 9999, 'the sprite it wore first');
  const noIdle = Object.keys(ENEMY_BASICS).map(Number).find((k) => ENEMY_BASICS[k]?.maleTexture && !ENEMY_BASICS[k].hasIdle);
  if (noIdle != null) assert.equal(N.nemesisPortrait({ mobileType: noIdle }).record, 0, 'no idle: the walk\'s front');
  const beast = { ...r, mobileType: MOBILE_TYPES.SabertoothTiger };
  const g = N.nemesisTauntEvent(beast, me.name, { rolls: () => 0 });
  assert.equal(g.speech, null, 'a beast says nothing');
  assert.match(g.body, /^Bares its teeth/, 'the narrator says what it does');
  assert.match(g.line, new RegExp(`^${r.name} bares its teeth`));
  const fl = N.nemesisFleeEvent(orc({ eliteFoe: true, champion: undefined }), 'Elite Orc Warlord');
  assert.equal(fl.kind, 'flee'); assert.equal(fl.name, 'Elite Orc Warlord'); assert.equal(fl.rank, 0); assert.equal(fl.speech, 'This isn\'t over!'); assert.match(fl.sub, /Elite$/);
  const es = N.nemesisEscapeEvent(r, me.name, { rolls: () => 0 });
  assert.equal(es.kicker, 'Escaped'); assert.match(es.speech, /Ayla/); assert.equal(es.line, N.nemesisEscapeLine(r));
  const sl = N.nemesisSlainEvent(r, me.name, { rolls: () => 0 });
  assert.equal(sl.kicker, 'Nemesis slain'); assert.equal(sl.body, 'Has fallen. Your nemesis is no more.'); assert.ok(sl.speech, 'its last words');
  const ri = N.nemesisRiseEvent(r, me.name, { rolls: () => 0 });
  assert.equal(ri.kicker, 'A nemesis rises'); assert.equal(ri.line, N.nemesisRiseLine(r));
  // the voice: a face that draws it, or the line said
  const said = [];
  V.setNemesisPresenter(null);
  assert.equal(N.nemesisSay(t, (l) => said.push(l)), false); assert.deepEqual(said, [t.line], 'no face: the line');
  V.setNemesisPresenter(() => true);
  assert.equal(N.nemesisSay(t, (l) => said.push(l)), true); assert.equal(said.length, 1, 'a face drew it: no line');
  V.setNemesisPresenter(() => { throw new Error('x'); });
  N.nemesisSay(t, (l) => said.push(l)); assert.equal(said.length, 2, 'a face that throws: the line');
  V.setNemesisPresenter(C.showNemesisCard);   // the card's own, back
});

test('NEMESIS-CARD THE CARD: on the enhanced skin a portrait popup - the kicker, the name, the rank, the words typed then held then slid out; one per nemesis, two at most; hidden under the HUD\'s gate with its clock still; the whole line for a reader; the classic skin declines (mutants: no typing; the clock runs hidden; a nemesis twice; no cap; the classic skin drawn)', () => {
  fresh();
  const me = player();
  const r = N.nemesisDeed(me, orc(), 'slew', { now: 10, rolls: () => 0 });
  withPage((doc) => {
    const ev = N.nemesisTauntEvent(r, me.name, { rolls: () => 0 });
    assert.equal(N.nemesisSay(ev, () => assert.fail('the card drew it')), true, 'the card draws it');
    const stack = doc.getElementById(C.NEMESIS_STACK_ID);
    assert.ok(stack, 'the stack stands');
    assert.equal(stack.attrs['aria-live'], 'polite');
    const card = stack.children[0];
    assert.ok(card.classList.contains('nemcard') && card.classList.contains('is-taunt') && card.classList.contains('nemcard-in'));
    assert.equal(byClass(card, 'nemcard-kicker')[0].textContent, 'Nemesis');
    assert.equal(byClass(card, 'nemcard-name')[0].textContent, r.name);
    assert.equal(byClass(card, 'nemcard-rank')[0].textContent, 'I');
    assert.ok(byClass(card, 'nemcard-face')[0].children.some((c) => c.tag === 'img'), 'the portrait');
    assert.equal(byClass(card, 'nemcard-sr')[0].textContent.includes(ev.speech), true, 'a reader has the whole line at once');
    assert.equal(byClass(card, 'nemcard-say')[0].attrs['aria-hidden'], 'true', '...and not the typing');
    // typed
    const say = () => byClass(card, 'nemcard-say')[0].textContent.replace('▌', '');
    assert.equal(say(), '', 'nothing typed yet');
    C.drawNemesisCards({ dt: 0.25, doc });
    assert.equal(say().length, Math.floor(0.25 * C.NEMESIS_TYPE_CPS), 'typed at its pace');
    // hidden: the clock stands
    C.drawNemesisCards({ hidden: true, dt: 10, doc });
    assert.ok(stack.classList.contains('nemcard-hidden'));
    assert.equal(say().length, Math.floor(0.25 * C.NEMESIS_TYPE_CPS), 'hidden, nothing typed');
    C.drawNemesisCards({ dt: 30, doc });
    assert.equal(say(), `“${ev.speech}”`, 'all out');
    const st = C._nemesisCards()[0];
    assert.ok(st.leftMs > 0, 'held');
    C.drawNemesisCards({ dt: st.leftMs / 1000 + 0.01, doc });
    assert.equal(C._nemesisCards()[0].out, true, 'sliding out');
    C.drawNemesisCards({ dt: 1, doc });
    assert.equal(C._nemesisCards().length, 0, 'gone');
    assert.equal(doc.getElementById(C.NEMESIS_STACK_ID), null, 'the stack with it');
    // one per nemesis, two at most
    N.nemesisSay(ev); N.nemesisSay(N.nemesisEscapeEvent(r, me.name));
    C.drawNemesisCards({ dt: 0.01, doc });
    assert.equal(C._nemesisCards().filter((c) => !c.out).length, 1, 'the same nemesis: its new word in place of its old');
    N.nemesisSay(N.nemesisFleeEvent(orc({ champion: 'swift' }), 'Swift Orc'));
    N.nemesisSay(N.nemesisFleeEvent(orc({ champion: 'stalwart' }), 'Stalwart Orc'));
    assert.equal(C._nemesisCards().filter((c) => !c.out).length, C.NEMESIS_CARDS_MAX, 'two at most');
  });
  // reduced motion: nothing typed, the words at once
  withPage((doc) => {
    globalThis.matchMedia = () => ({ matches: true });
    const ev = N.nemesisTauntEvent(r, me.name, { rolls: () => 0 });
    N.nemesisSay(ev);
    assert.equal(byClass(doc.getElementById(C.NEMESIS_STACK_ID), 'nemcard-say')[0].textContent, `“${ev.speech}”`);
  });
  // the classic skin: no card, the line
  withPage((doc) => {
    const said = [];
    assert.equal(N.nemesisSay(N.nemesisTauntEvent(r, me.name), (l) => said.push(l)), false);
    assert.equal(said.length, 1); assert.equal(doc.getElementById(C.NEMESIS_STACK_ID), null);
  }, { skin: 'classic' });
});

test('NEMESIS-CARD ENHANCED PLUS: the kit dresses it by role - a panel with an accent edge, the portrait a well, the rank a chip, the name a header rule, the page\'s rows tiles - the sheet writing geometry and words alone; drawn on drawHud\'s one call behind the HUD\'s gate and its hide door; a HUD piece HUD-MOVE moves (mutants: a role dropped; not drawn; no hide door)', () => {
  assert.ok(FRAME_ROLES.panel.includes('body .nemcard') && FRAME_ROLES.panelAccent.includes('body .nemcard'));
  assert.ok(FRAME_ROLES.well.includes('body .nemcard-face') && FRAME_ROLES.well.includes('.px-sys .nem-face'));
  assert.ok(FRAME_ROLES.chip.includes('body .nemcard-rank') && FRAME_ROLES.chip.includes('.px-sys .nem-rank'));
  assert.ok(FRAME_ROLES.headerRule.includes('body .nemcard-name'));
  assert.ok(FRAME_ROLES.tile.includes('.px-sys .nem-row'));
  assert.doesNotMatch(C.NEMESIS_CARD_CSS.replace(/border-left-color: #[0-9a-f]+/g, ''), /background(-color)?:\s*#/i, 'no ground of its own - the theme\'s');
  const h = read('src/ui/hud.js');
  assert.match(h, /drawNemesisCards\(\{ hidden: cursorActive \|\| !hudRenderEnabled\(\), dt \}\);/);
  assert.match(h, /drawQuestTracker\(\{ hidden: true \}\);\s*\n\s*drawNemesisCards\(\{ hidden: true \}\);/, 'the hide door');
  assert.ok(HUD_PIECES.some((p) => p.id === 'nemesis' && p.sel === '.nemcard-stack' && p.ghost === 'nemesis'), 'movable, with a preview');
  assert.match(read('src/ui/hudLayout.js'), /} else if \(kind === 'nemesis'\) \{\s*\n\s*try \{ g = ghostDeps\.buildNemesisPreview\?\.\(doc\) \?\? null; \}/);
});

test('NEMESIS-PAGE: the living strongest first - name, rank, kind and trait, what it has done, when it will come, its deeds - then the fallen struck through; none, and the words say how one is made; off, that it is off (mutants: the fallen among the living; the order; the empty words)', () => {
  fresh();
  const me = player('char-page');
  const a = N.nemesisDeed(me, orc(), 'slew', { now: 0, rolls: () => 0 });
  const b = N.nemesisDeed(me, orc({ champion: 'swift' }), 'fled', { now: 0, rolls: () => 0 });
  N.nemesisDeed(me, { ...orc(), nemesis: { id: b.id } }, 'slew', { now: 10, rolls: () => 0 });
  const c = N.nemesisDeed(me, orc({ champion: 'stalwart' }), 'slew', { now: 0, rolls: () => 0 });
  N.nemesisSlain(me, { nemesis: { id: c.id } }, { now: 20 });
  const doc = fakeDocument(); globalThis.document = doc;
  P._setNemesisPageIconForTests(() => null);
  try {
    const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const divider = (w) => el('div', 'px-divider', w);
    const detail = el('div', 'px-qdetail px-sys');
    P.drawNemesesPage(detail, () => {}, { el, divider, player: me, kindName: enemyDisplayName });
    const words = detail.children.map((n) => n.textContent);
    assert.equal(words[0], `Nemeses (2 of ${N.NEMESIS_MAX})`);
    const rows = byClass(detail, 'nem-row');
    assert.equal(rows.length, 3);
    assert.match(rows[0].textContent, new RegExp(b.name), 'the strongest first');
    assert.match(rows[0].textContent, /escaped you once/i); assert.match(rows[0].textContent, /killed you once/i);
    assert.match(rows[1].textContent, new RegExp(a.name));
    assert.ok(rows[2].classList.contains('is-fallen'), 'the fallen last');
    assert.equal(words.filter((w) => w === 'Fallen').length, 1);
    assert.ok(byClass(rows[0], 'nem-face')[0].children.some((n) => n.classList.contains('nem-glyph')), 'no picture: a glyph');
    // the words, pure
    assert.equal(P.comeWords({ out: true }, 0).tag, 'Abroad');
    assert.equal(P.comeWords({ dueAt: -1 }, 0).tag, 'Hunting');
    assert.match(P.comeWords({ dueAt: 2 * 1440 }, 0).line, /about 2 days/);
    assert.equal(P.agoWords(0, 0), 'today'); assert.equal(P.agoWords(0, 1440), 'yesterday'); assert.equal(P.agoWords(0, 3 * 1440), '3 days ago');
    assert.equal(P.deedWords({ kills: 2, escapes: 1, returns: 3 }), 'Killed you twice, escaped you once, came back 3 times.');
    // none, and off
    N._resetNemesisForTests(); _store.clear();
    const empty = el('div', 'px-sys');
    P.drawNemesesPage(empty, () => {}, { el, divider, player: player('char-none') });
    assert.match(empty.textContent, /No foe has earned your name yet/);
    setPref('lootRarity', false);
    const off = el('div', 'px-sys');
    P.drawNemesesPage(off, () => {}, { el, divider, player: player('char-none') });
    assert.match(off.textContent, /come with Loot rarity, which is off/);
    assert.equal(P.nemesisPageShown(player('char-none')), false, 'off and none: no page on the rail');
  } finally { P._setNemesisPageIconForTests(null); delete globalThis.document; }
  const m = read('src/ui/enhancedMenu.js');
  assert.match(m, /\.\.\.\(nemesisPageShown\(playerEntity\) \? NEMESIS_PAGE_SECTIONS : \[\]\)/, 'on the Stats rail');
  assert.match(m, /nemeses: \(d\) => drawNemesesPage\(d, render, \{ \.\.\.profKit, player: playerEntity, kindName: enemyDisplayName \}\)/);
});

test('NEMESIS-HARM: a death no blow names goes to the foe whose harm last reached me - a spell, a lingering round, a blow (its poison\'s ticks after); a killing blow outranks the mark; a mark past its time names nobody (mutants: no mark read; the mark outranking the blow; no time limit)', async () => {
  fresh();
  const me = player('char-harm');
  const mage = orc({ mobileType: 128, champion: undefined, eliteFoe: true });
  const brute = orc();
  setPlayerDoor({ foes: () => [{ entity: mage, mobileType: 128, gender: 'female' }, { entity: brute, mobileType: MOBILE_TYPES.OrcWarlord }], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {}, player: () => me });
  // a spell's burn: no blow, the mage's mark
  H.markPlayerHarm(mage);
  hurtPlayer(me, 500);
  await tick();
  assert.equal(N.livingNemeses().length, 1); assert.equal(mage.nemesis?.id, N.livingNemeses()[0].id, 'the caster');
  assert.equal(N.livingNemeses()[0].gender, 'female', 'its record off the pool');
  // a blow outranks the mark
  me.health = 100;
  H.markPlayerHarm(mage);
  setStruck(brute, me, 500); hurtPlayer(me, 500);
  await tick();
  assert.ok(brute.nemesis, 'the blow that killed');
  assert.equal(N.livingNemeses().length, 2);
  // a mark past its time
  fresh();
  const me2 = player('char-harm2');
  H.markPlayerHarm(mage, { ms: 10, now: Date.now() - 1000 });
  hurtPlayer(me2, 500); await tick();
  assert.equal(N.livingNemeses().length, 0, 'an old harm names nobody');
  // the seams that leave the mark
  assert.match(read('src/scenes/hostMagic.js'), /if \(caster\?\.entity && caster\.entity !== playerEntity && !caster\.entity\.isPlayer\) markPlayerHarm\(caster\.entity\);[^\n]*\n\s*const r = applySpell\(spell, casterLevel, playerEntity, playerSinks, rolls, caster, ctx\);/);
  assert.match(read('src/systems/effects.js'), /if \(n > 0 && target\?\.isPlayer && a\.caster && !a\.caster\.isPlayer\) markPlayerHarm\(a\.caster\);/);
  assert.match(read('src/systems/nemesis.js'), /registerPlayerStruckListener\('nemesis', \(attacker, target\) => \{\s*\n\s*if \(target\?\.isPlayer && !target\.peer && attacker && !attacker\.isPlayer\) markPlayerHarm\(attacker, \{ ms: HARM_MARK_STRUCK_MS \}\);/);
  assert.doesNotMatch(read('src/systems/harmMark.js'), /^import /m, 'a leaf');
});

test('NEMESIS-DUNGEON, NEMESIS-WIRE, the single-location host: a special foe of mine alone runs in a dungeon (never a room\'s shared foe online), aims at nothing while it runs and is retired through the quest pool\'s door when out of reach; a slain one closes; the name rides the foe record, bounded and printable; the single-location host stands returns as the world\'s does (mutants: a room foe runs; the name unbounded; the host forgets)', () => {
  const d = read('src/scenes/dungeonContext.js');
  assert.match(d, /const _flee = f\.fleeing \|\| \(!f\._fleeRolled && nemesisFleeHealth\(f\.entity\)\) \? nemesisFleeStep\(f, _pf, \{ mayRun: !onlineRoom\(\) \|\| !_roomFoe, onMe: /, 'the one flee law - mine alone, never a room\'s shared foe');
  assert.match(d, /if \(_flee === 'escape'\) \{ escapeDungeonFoe\(f\); continue; \}/);
  assert.match(d, /if \(_flee === 'start' \|\| _flee === 'run'\) _tgt = null;/, 'running, it aims at nothing; its walk below');
  assert.match(d, /function escapeDungeonFoe\(f\) \{\s*\n\s*questPoolOps\.removeFoe\(f\);/);
  assert.match(d, /if \(foe\.entity\?\.nemesis\) \{ const nr = nemesisSlain\(playerEntity, foe\.entity\);/);
  // the wire
  const base = { i: 1, t: 7, x: 0, f: [0, 0, 0], y: 0 };
  assert.equal(validFoeRecord({ ...base, nm: 'Grushnak the Butcher' }).nm, 'Grushnak the Butcher');
  assert.equal(validFoeRecord({ ...base, nm: '' }), null);
  assert.equal(validFoeRecord({ ...base, nm: 'x'.repeat(NEMESIS_NAME_MAX + 1) }), null);
  assert.equal(validFoeRecord({ ...base, nm: 'a\u0007b' }), null);
  assert.equal(validFoeRecord({ ...base, nm: 7 }), null);
  const x = read('src/scenes/exteriorFoes.js');
  assert.match(x, /\.\.\.\(!onWatch && typeof f\.entity\?\.nemesis\?\.name === 'string' && f\.entity\.nemesis\.name \? \{ nm: /, 'the owner sends it');
  assert.match(x, /\$\{r\.z \?\? 0\},\$\{r\.nm \?\? ''\}`;/, 'a changed name is sent again');
  assert.match(x, /if \(typeof r\.nm === 'string' && r\.nm && f\.entity\.nemesis\?\.name !== r\.nm\) f\.entity\.nemesis = \{ id: null, name: r\.nm, rank: 0 \};/, 'the puppet called so');
  // the single-location host
  const e = read('src/scenes/exterior.js');
  assert.match(e, /nemesisPresence\(exteriorFoes\.foes, \{ now \}\);\s*\n\s*nemesisSay\(takeNemesisNotice\(playerEntity\), \(l\) => townTalk\.say\(l\)\);/);
  assert.match(e, /const _nemesis = hit && _m === 'exterior' \? nemesisToReturn\(playerEntity, \{ now \}\) : null;\s*\n\s*if \(_nemesis\) \{ Promise\.resolve\(_standEncounterFoe\(\{ \.\.\.hit, mobileType: _nemesis\.mobileType, nemesis: _nemesis \}, playerFeet\)\)\.then\(\(f\) => \{ if \(!f\) releaseNemesisStand\(_nemesis\); \}\); break; \}/);
  assert.match(e, /\.\.\.\(hit\.nemesis \? nemesisSpawnOptions\(hit\.nemesis, effectiveLevel\(playerEntity\)\) : \{\}\)/);
});

test('NEMESIS AAA: the one flee law - a roll once under the line, a run, an escape only out of reach, CORNERED when run down (it fights on, never runs again); a room\'s shared foe never runs (mutants: the run spent is an escape at any distance; cornered runs again; a shared foe runs)', () => {
  fresh();
  const foe = (over = {}) => ({ entity: orc({ health: 5, maxHealth: 60 }), ai: { feet: [0, 0, 0], isHostile: true, fleeLeft: 0, flee(from, s) { this.fleeLeft = s; this.fled = from; } }, ...over });
  const f = foe();
  assert.equal(N.nemesisFleeStep(f, [0, 0, 0], { rolls: () => 0.99 }), null, 'the roll lost');
  assert.equal(f._fleeRolled, true);
  assert.equal(N.nemesisFleeStep(f, [0, 0, 0], { rolls: () => 0 }), null, 'once, never again');
  const g = foe();
  assert.equal(N.nemesisFleeStep(g, [0, 0, 0], { rolls: () => 0 }), 'start');
  assert.equal(g.ai.fleeLeft, N.NEMESIS_FLEE_SECONDS);
  assert.equal(N.nemesisFleeStep(g, [5, 0, 0]), 'run', 'running');
  g.ai.fleeLeft = 0;
  assert.equal(N.nemesisFleeStep(g, [5, 0, 0]), 'cornered', 'run down: cornered');
  assert.equal(g.fleeing, false);
  assert.equal(N.nemesisFleeStep(g, [5, 0, 0], { rolls: () => 0 }), null, 'it fights on - it never runs again');
  const h = foe(); N.nemesisFleeStep(h, [0, 0, 0], { rolls: () => 0 }); h.ai.fleeLeft = 0;
  assert.equal(N.nemesisFleeStep(h, [N.NEMESIS_ESCAPE_NEAR + 1, 0, 0]), 'escape', 'its run spent out of reach: escaped');
  const k = foe(); N.nemesisFleeStep(k, [0, 0, 0], { rolls: () => 0 });
  assert.equal(N.nemesisFleeStep(k, [0, 0, N.NEMESIS_ESCAPE_DISTANCE + 1]), 'escape', 'far off mid-run: escaped');
  assert.equal(N.nemesisFleeStep(foe(), [0, 0, 0], { rolls: () => 0, mayRun: false }), null, 'a room\'s shared foe never runs');
  assert.equal(N.nemesisFleeStep(foe(), [0, 0, 0], { rolls: () => 0, onMe: () => false }), null, 'nor one fighting another');
  const cor = N.nemesisCorneredEvent(orc(), 'Mighty Orc Warlord');
  assert.equal(cor.kicker, 'Cornered'); assert.ok(cor.speech); assert.match(cor.line, /is cornered and turns to fight!$/);
});

test('NEMESIS AAA: a returning nemesis is CLAIMED by the roll that stands it - no second copy while its stand loads; a stand that stood nobody frees it (mutants: no claim; the claim never freed)', () => {
  fresh();
  const me = player('char-claim');
  const r = N.nemesisDeed(me, orc(), 'fled', { now: 0, rolls: () => 0 });
  const late = N.NEMESIS_RETURN_MAX_MINUTES + 1;
  assert.equal(N.nemesisToReturn(me, { now: late, rolls: () => 0 }), r);
  assert.equal(r.out, true, 'claimed');
  assert.equal(N.nemesisToReturn(me, { now: late, rolls: () => 0 }), null, 'the next roll stands no second copy');
  N.releaseNemesisStand(r);
  assert.equal(r.out, false);
  assert.equal(N.nemesisToReturn(me, { now: late, rolls: () => 0 }), r, 'free for a later roll');
});

test('NEMESIS AAA: the forgotten and the long-fallen leave TOMBSTONES a merge keeps - an older save never raises one; the page keeps the newest fallen; the tombstones themselves are bounded (mutants: spliced, not buried; no fallen bound; the tombstone loses the merge)', () => {
  fresh();
  const me = player('char-tomb');
  const first = N.nemesisDeed(me, orc(), 'fled', { now: 0, rolls: () => 0 });
  const save = JSON.parse(JSON.stringify(modSave()));
  for (let i = 1; i <= N.NEMESIS_MAX; i++) { const x = N.nemesisDeed(me, orc({ champion: 'swift' }), 'fled', { now: i, rolls: () => 0 }); x.rank = 2; }
  assert.equal(N.nemesisById(first.id), null, 'past the cap the weakest, oldest is forgotten');
  assert.equal(N.livingNemeses().length, N.NEMESIS_MAX);
  restore(save);
  assert.equal(N.livingNemeses().length, 1, 'the old save alone');
  N.nemesisToReturn(me, { now: 0 });   // the mirror read in
  assert.equal(N.nemesisById(first.id), null, 'the tombstone outranks the older save - never raised');
  assert.equal(N.livingNemeses().length, N.NEMESIS_MAX);
  // the fallen, bounded
  fresh();
  const me2 = player('char-fallen');
  for (let i = 0; i < N.NEMESIS_FALLEN_MAX + 4; i++) { const x = N.nemesisDeed(me2, orc(), 'fled', { now: i, rolls: () => 0 }); N.nemesisSlain(me2, { nemesis: { id: x.id } }, { now: 100 + i }); }
  assert.equal(N.allNemeses().filter((x) => x.defeated).length, N.NEMESIS_FALLEN_MAX, 'the page keeps the newest fallen');
  assert.equal(N.mergeNemeses([{ id: 'a', rev: 9, gone: true }], [{ id: 'a', rev: 3, mobileType: 7, given: 'G', epithet: 'the X' }])[0].gone, true);
  assert.deepEqual(N.mergeNemeses([{ id: 'a', rev: 2, gone: true }], [])[0], { id: 'a', rev: 2, gone: true }, 'a tombstone is its id and revision alone');
});

test('NEMESIS AAA: a foe already slain is no one\'s nemesis - a fall after the fight names nobody dead; a nemesis standing in the host the player is in (a dungeon) is present, not lost (mutants: the dead blamed; presence the open world\'s alone)', async () => {
  fresh();
  const me = player('char-dead');
  const corpse = orc({ health: 0 });
  H.markPlayerHarm(corpse);
  hurtPlayer(me, 500);
  await tick();
  assert.equal(N.livingNemeses().length, 0, 'the dead orc is not blamed');
  // presence: the dungeon's pool through the player's door
  fresh();
  const me2 = player('char-door');
  const killer = orc();
  const r = N.nemesisDeed(me2, killer, 'slew', { now: 0, rolls: () => 0 });
  setPlayerDoor({ foes: () => [{ entity: killer, dead: false }], feet: () => [0, 0, 0], hurtFoe: () => {}, castOnPlayer: () => {} });
  N.nemesisPresence([], { now: 10, wall: Date.now() + 60000 });
  assert.equal(r.out, true, 'standing in the dungeon - present');
  setPlayerDoor(null);
  N.nemesisPresence([], { now: 10, wall: Date.now() + 60000 });
  assert.equal(r.out, false, 'gone from every pool - lost');
});

test('NEMESIS AAA: a card whose slide ends on an exact frame is taken down (mutants: zero read as standing)', () => {
  fresh();
  const me = player('char-zero');
  const r = N.nemesisDeed(me, orc(), 'slew', { now: 0, rolls: () => 0 });
  withPage((doc) => {
    globalThis.matchMedia = () => ({ matches: true });   // no typing: straight to the hold
    N.nemesisSay(N.nemesisTauntEvent(r, me.name, { rolls: () => 0 }));
    const hold = C._nemesisCards()[0].leftMs;
    C.drawNemesisCards({ dt: hold / 1000, doc });
    assert.equal(C._nemesisCards()[0].out, true, 'sliding');
    for (let i = 0; i < 13; i++) C.drawNemesisCards({ dt: 0.02, doc });   // 13 x 20ms = the 260ms slide, to the frame
    assert.equal(C._nemesisCards().length, 0, 'down on the exact frame');
  });
});

test('ELITE-FLOOR online: a dungeon\'s elites are picked by the KIND\'s own level, the same on every client - a rat never, a class foe (the party\'s level) eligible - and the build does not ask the client\'s own level again (mutants: the per-client level asked)', async () => {
  const { pickDungeonElites, ELITE_FOE_MIN_LEVEL } = await import('../src/systems/eliteFoes.js');
  const recs = [{ mobileType: MOBILE_TYPES.Rat }, { mobileType: MOBILE_TYPES.Rat }, { mobileType: MOBILE_TYPES.Rat }, { mobileType: MOBILE_TYPES.Rat }];
  assert.equal(pickDungeonElites(recs, 'loc', { elite: true }), 0, `a rat (level ${ENEMY_BASICS[MOBILE_TYPES.Rat].level}) is under ${ELITE_FOE_MIN_LEVEL}`);
  const mixed = [{ mobileType: MOBILE_TYPES.Rat }, { mobileType: 130 }, { mobileType: MOBILE_TYPES.Orc }, { mobileType: 133 }];
  assert.ok(pickDungeonElites(mixed, 'loc', { elite: true }) >= 3);
  assert.equal(mixed[0].eliteFoe, undefined, 'never the rat');
});
