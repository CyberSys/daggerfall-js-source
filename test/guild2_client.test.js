// GUILD2 (2026-10-03) - THE GUILD PAGE'S OVERHAUL, ON THE CLIENT: a new name for a price, the vault and the
// guildmaster's grants, the arms of forty devices on a divided field that every banner draws - and the Guild tab in
// pages under the guild's own header (bible/11-Multiplayer/Guild-Overhaul.md). The service's half is
// test/guild2_service.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { GUILD_RANK_NAMES, GUILD_POWERS, GUILD_RENAME_GOLD, GUILD_RENAME_COOLDOWN_S, guildRenameAt, guildRenameOpen } from '../src/net/guildLaw.js';
import {
  GUILD_VAULT_SLOTS, guildVaultSlots, VAULT_RANK_DEFAULTS, VAULT_LIMIT_CHOICES, vaultStanding, vaultMayPut, vaultMayTake, vaultGrantOf,
  vaultStandingText,
} from '../src/net/guildVaultLaw.js';
import {
  HERALDRY_DEVICES, HERALDRY_DIVISIONS, HERALDRY_DIVISION_NAMES, heraldryOf, heraldrySame, heraldryText, heraldryKey, heraldryInk,
} from '../src/net/heraldryLaw.js';
import { DEVICES_DRAWN, divisionPath, bannerSvg, shieldSvg, drawBanner, BANNER_CLOTH } from '../src/ui/heraldryArt.js';
import { bannerKeyOf } from '../src/scenes/hallBanners.js';
import { GuildBook } from '../src/net/guildBook.js';
import {
  createSocialPanel, GUILD_RENAME_COST_TEXT, guildRenameSoonText, GUILD_VAULT_REACH_TEXT, GUILD_VAULT_EMPTY_TEXT, armsWhy,
} from '../src/ui/socialPanel.js';
import { SocialState } from '../src/net/social.js';
import { REFUSALS, accountGuilds } from '../src/net/accountClient.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const WOLF = { field: 'azure', border: 'gold', device: 'wolf' };

// ─── THE LAW ────────────────────────────────────────────────────────

test('GUILD2a the law of a new name: 25,000 gold of the realm\'s from the treasury, the guildmaster\'s alone, a fortnight between (mutants: the price; the cooldown; an officer renaming)', () => {
  assert.equal(GUILD_RENAME_GOLD, 25_000);
  assert.equal(GUILD_RENAME_COOLDOWN_S, 14 * 86_400);
  assert.deepEqual([...GUILD_POWERS.rename], [0]);
  assert.deepEqual([...GUILD_POWERS.vaultGrant], [0]);
  assert.equal(guildRenameAt(null), null, 'never renamed: now');
  assert.equal(guildRenameAt(1000), 1000 + GUILD_RENAME_COOLDOWN_S);
  assert.deepEqual([guildRenameOpen(null, 5), guildRenameOpen(1000, 1000 + GUILD_RENAME_COOLDOWN_S - 1), guildRenameOpen(1000, 1000 + GUILD_RENAME_COOLDOWN_S)], [true, false, true]);
  assert.equal(guildRenameSoonText(86_400 * 3 + 10, 10), 'The guild took a new name lately: the next may come in 3 days.');
  assert.equal(guildRenameSoonText(100, 10), 'The guild took a new name lately: the next may come in 1 day.');
  assert.match(GUILD_RENAME_COST_TEXT, /25,000 gold/);
});

test('GUILD2b the vault\'s law: fifty slots and fifty more with a hall; officers take out ten a day, members and recruits put in; the guildmaster always takes out, unlimited - a grant on that row never read; a grant revoked is the rank\'s again (mutants: a recruit taking; the limit unread; the guildmaster limited)', () => {
  assert.deepEqual([GUILD_VAULT_SLOTS, guildVaultSlots(false), guildVaultSlots(true)], [50, 50, 100]);
  assert.deepEqual(Object.values(VAULT_RANK_DEFAULTS).map((d) => [d.level, d.limit]), [['withdraw', 0], ['withdraw', 10], ['deposit', 0], ['deposit', 0]]);
  assert.deepEqual(vaultStanding(0, { level: 'none', limit: 0 }), { level: 'withdraw', limit: 0, granted: false }, 'the guildmaster\'s row is never a grant');
  assert.deepEqual(vaultStanding(3, null), { level: 'deposit', limit: 0, granted: false });
  assert.deepEqual(vaultStanding(3, { level: 'withdraw', limit: 3 }), { level: 'withdraw', limit: 3, granted: true });
  assert.deepEqual(vaultStanding(1, { level: 'none', limit: 0 }), { level: 'none', limit: 0, granted: true }, 'an officer\'s taken away');
  assert.deepEqual(vaultStanding(2, { level: 'deposit', limit: 9 }), { level: 'deposit', limit: 0, granted: true }, 'a limit is a withdrawer\'s');
  assert.deepEqual([vaultMayPut({ level: 'deposit' }), vaultMayPut({ level: 'withdraw' }), vaultMayPut({ level: 'none' })], [true, true, false]);
  assert.deepEqual([vaultMayTake({ level: 'withdraw', limit: 0 }, 999), vaultMayTake({ level: 'withdraw', limit: 3 }, 2), vaultMayTake({ level: 'withdraw', limit: 3 }, 3), vaultMayTake({ level: 'deposit', limit: 0 }, 0)],
    [true, true, false, false]);
  assert.deepEqual(vaultGrantOf({ level: null }), { level: null, limit: 0 }, 'revoked');
  assert.deepEqual(vaultGrantOf({ level: 'withdraw', limit: 25 }), { level: 'withdraw', limit: 25 });
  for (const bad of [{ level: 'all' }, { level: 'withdraw', limit: 101 }, { level: 'withdraw', limit: -1 }, null, 'withdraw']) assert.equal(vaultGrantOf(bad), null, JSON.stringify(bad));
  assert.deepEqual(VAULT_LIMIT_CHOICES, [1, 3, 5, 10, 25, 0]);
  assert.deepEqual([vaultStandingText({ level: 'withdraw', limit: 10 }), vaultStandingText({ level: 'withdraw', limit: 0 }), vaultStandingText({ level: 'deposit' }), vaultStandingText(null)],
    ['Takes out, 10 a day', 'Takes out, any number', 'Puts in', 'No access']);
});

test('GUILD2c the arms\' law: arms with no division and no colour of the device\'s own are exactly GUILD1d\'s three keys; a divided field takes a second colour - never Ash, never the field\'s; the device\'s colour differs from every colour of the field; the words and the key (mutants: a plain arms\' extra keys; the device lost on the second colour; the key of plain arms moved)', () => {
  assert.equal(HERALDRY_DEVICES.length, 40);
  assert.deepEqual(HERALDRY_DIVISIONS, ['plain', 'pale', 'fess', 'bend', 'bend-sinister', 'quarterly', 'chevron', 'saltire']);
  assert.deepEqual(Object.keys(heraldryOf(WOLF)), ['field', 'border', 'device'], 'GUILD1d\'s every stored heraldry unmoved');
  assert.deepEqual(heraldryOf({ ...WOLF, division: 'plain', field2: null, charge: null }), WOLF, 'a draft\'s empty fields dropped');
  assert.deepEqual(heraldryOf({ ...WOLF, charge: 'gold' }), WOLF, 'a device in the border\'s colour is the plain arms');
  const per = { ...WOLF, division: 'pale', field2: 'crimson' };
  assert.deepEqual(heraldryOf(per), per);
  assert.equal(heraldryOf({ ...WOLF, division: 'pale' }), null, 'a division wants its second colour');
  assert.equal(heraldryOf({ ...WOLF, division: 'pale', field2: 'azure' }), null, 'not the field\'s');
  assert.equal(heraldryOf({ ...WOLF, division: 'pale', field2: 'ash' }), null, 'never Ash');
  assert.equal(heraldryOf({ ...WOLF, division: 'pale', field2: 'gold' }), null, 'the device (the border\'s gold) lost on its own field');
  assert.equal(heraldryOf({ ...WOLF, field2: 'crimson' }), null, 'a second colour on a plain field');
  assert.equal(heraldryOf({ ...WOLF, division: 'wavy', field2: 'crimson' }), null);
  assert.deepEqual(heraldryOf({ ...WOLF, charge: 'argent' }), { ...WOLF, charge: 'argent' });
  assert.equal(heraldryOf({ ...WOLF, charge: 'azure' }), null, 'a device the field\'s colour');
  assert.equal(heraldryOf({ ...per, charge: 'crimson' }), null, 'nor the second\'s');
  assert.equal(heraldryInk(WOLF), 'gold');
  assert.equal(heraldryInk({ ...WOLF, charge: 'argent' }), 'argent');
  assert.equal(heraldryText(WOLF), 'Azure bordered Gold, a Wolf');
  assert.equal(heraldryText({ ...per, charge: 'argent', device: 'owl' }), 'Per pale Azure and Crimson, bordered Gold, an Owl Argent');
  assert.equal(heraldryKey(WOLF), 'azure|gold|wolf', 'every texture already cached keeps its key');
  assert.equal(heraldryKey(per), 'azure|gold|wolf|pale|crimson|');
  assert.equal(heraldrySame(per, { ...per }), true);
  assert.equal(heraldrySame(per, WOLF), false);
  assert.equal(heraldrySame({ ...WOLF, charge: 'argent' }, WOLF), false);
  assert.deepEqual(Object.keys(HERALDRY_DIVISION_NAMES), HERALDRY_DIVISIONS);
  // the Raise button's reason, in the law's own terms
  assert.equal(armsWhy({ ...WOLF, division: 'pale', field2: 'gold' }), 'a device that stands out from the field');
  assert.equal(armsWhy({ ...WOLF, field: 'ash' }), 'Ash only as the border');
  assert.equal(armsWhy({ ...WOLF, border: 'azure' }), 'a border unlike the field');
  assert.equal(armsWhy({ ...WOLF, division: 'pale', field2: 'ash' }), 'two different field colours, never Ash');
});

// ─── THE ART ────────────────────────────────────────────────────────

test('GUILD2c the drawing: every one of the forty devices drawn; each division a part of its own over the box; the banner and the shield fill the second colour and draw the device in its own; a street\'s banner of plain arms keeps its texture\'s key (mutants: a device\'s art gone; field2 unfilled; the ink the border\'s)', () => {
  assert.equal(DEVICES_DRAWN, true);
  assert.equal(divisionPath('plain', 100, 300), '');
  for (const d of HERALDRY_DIVISIONS.slice(1)) assert.match(divisionPath(d, 100, 300), /^M/, d);
  assert.equal(divisionPath('pale', 100, 300), 'M50 0 H100 V300 H50 Z', 'the sinister half');
  const arms = { field: 'azure', border: 'gold', device: 'owl', division: 'quarterly', field2: 'crimson', charge: 'argent' };
  for (const svg of [bannerSvg(arms), shieldSvg(arms)]) {
    assert.ok(svg.includes('fill="#b3262e"'), 'the second colour');
    assert.ok(svg.includes('#e6e6e6'), 'the device\'s own Argent');
  }
  assert.ok(!bannerSvg(WOLF).includes('#b3262e'), 'plain arms: one field');
  const calls = [];
  globalThis.Path2D = class { constructor(d) { this.d = d; } };
  const ctx = new Proxy({}, {
    get: (o, k) => (k in o ? o[k] : (...a) => { calls.push([k, a[0]?.d ?? null, o.fillStyle, o.strokeStyle]); }),
    set: (o, k, v) => { o[k] = v; return true; },
  });
  drawBanner(ctx, arms, 64);
  delete globalThis.Path2D;
  const fills = calls.filter((c) => c[0] === 'fill');
  assert.equal(fills[0][1], BANNER_CLOTH);
  assert.deepEqual([fills[1][1], fills[1][2]], [divisionPath('quarterly', 100, 300), '#b3262e'], 'the second colour over the field, under the border');
  assert.ok(fills.slice(2).some((c) => c[2] === '#e6e6e6'), 'the owl in Argent');
  assert.equal(bannerKeyOf(WOLF), 'azure|gold|wolf');
  assert.equal(bannerKeyOf(arms), heraldryKey(arms));
});

// ─── THE BOOK ───────────────────────────────────────────────────────

const view = (over = {}) => ({
  id: 'g0123456789', name: 'The Hand', tag: 'HND', ranks: [...GUILD_RANK_NAMES], treasury: 30_000, hallGold: 30_000, foundedAt: 1, rank: 0,
  members: [{ member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, vault: { level: 'withdraw', limit: 0, granted: false } }],
  invites: [], ledger: [], hall: null, heraldry: WOLF, renamedAt: null, renameAt: null,
  vault: { used: 1, max: 50, me: { level: 'withdraw', limit: 0, granted: false, taken: 0 } }, ...over,
});
const ARROWS = { group: 'Weapons', templateIndex: 131, material: 0, name: 'Arrow', value: 1, stackCount: 40 };
function guildRig(guild = view(), { vaultItems = [], pack = [] } = {}) {
  const calls = [];
  const answers = {};
  const reply = (route) => async (...a) => { calls.push([route, ...a]); return answers[route] ?? { ok: true, data: {} }; };
  const door = {
    mine: async () => ({ ok: true, data: { guild } }), invites: async () => ({ ok: true, data: { invites: [] } }),
    vault: async (c) => { calls.push(['vault', c]); return answers.vault ?? { ok: true, data: { vault: { max: 50, items: vaultItems, log: [], me: guild.vault.me } } }; },
  };
  for (const r of ['rename', 'vaultPut', 'vaultTake', 'vaultGrant']) door[r] = reply(r);
  const items = [...pack];
  let changed = 0;
  let reach = true;
  const hostPack = { items: () => items, add: (rec) => items.push(rec), changed: () => { changed++; }, reach: () => reach };
  const realm = { act: async ({ reserve, apply, call }) => { const undo = reserve?.(); const r = await call(7); if (r?.ok) apply?.(r); else undo?.(); return r; } };
  const book = new GuildBook({ door, character: () => 'rabc', wallet: () => ({ gold: () => 0, pay() {}, credit() {} }), pack: hostPack, realm });
  return { book, calls, answers, items, changed: () => changed, setReach: (x) => { reach = x; } };
}

test('GUILD2 the book: a rename through the door as the character playing; the vault read; a piece put in leaves the pack at once and comes back on a refusal - a part of a stack the same; a piece taken lands in the pack on the answer; a grant through the door (mutants: the reserve unrolled on a refusal; the stack\'s part lost; the taken piece unminted)', async () => {
  const arrows = { ...ARROWS };
  const r = guildRig(view(), { pack: [arrows] });
  await r.book.refresh();
  assert.equal((await r.book.rename('The Open Hand', 'OPH')).ok, true);
  assert.deepEqual(r.calls.find((c) => c[0] === 'rename'), ['rename', 'rabc', 'The Open Hand', 'OPH']);
  await r.book.readVault();
  assert.deepEqual(r.book.vaultView.items, []);
  r.answers.vaultPut = { ok: false, error: 'guild-vault-full' };
  const no = await r.book.vaultPut(arrows, 15);
  assert.deepEqual(no, { ok: false, error: 'guild-vault-full' });
  assert.equal(arrows.stackCount, 40, 'the part given back');
  assert.deepEqual(r.calls.find((c) => c[0] === 'vaultPut')[1], { character: 'rabc', realm: 7, pick: 0, item: { ...ARROWS }, count: 15 }, 'the record as it stood, its place in the pack');
  r.answers.vaultPut = { ok: true, data: {} };
  assert.equal((await r.book.vaultPut(arrows, 15)).ok, true);
  assert.equal(arrows.stackCount, 25, 'fifteen gone into the vault');
  assert.equal((await r.book.vaultPut(arrows)).ok, true);
  assert.equal(r.items.includes(arrows), false, 'the rest, whole');
  assert.deepEqual(await r.book.vaultPut({ ...ARROWS }, 1), { ok: false, error: 'bad-vault-count' }, 'a piece the pack does not hold');
  assert.deepEqual(await r.book.vaultTake(3), { ok: false, error: 'guild-vault-empty' }, 'a slot the last read did not show');
  const shelf = guildRig(view(), { vaultItems: [{ slot: 3, rec: null, name: 'Arrow', count: 25, by: 'Aldric', at: 99 }] });
  await shelf.book.refresh(); await shelf.book.readVault();
  shelf.answers.vaultTake = { ok: true, data: { item: { ...ARROWS, stackCount: 1 } } };
  assert.equal((await shelf.book.vaultTake(3, 1)).ok, true);
  assert.deepEqual(shelf.calls.find((c) => c[0] === 'vaultTake')[1], { character: 'rabc', realm: 7, slot: 3, count: 1, at: 99 }, 'the slot as it was read - never one filled again since');
  assert.deepEqual(shelf.items, [{ ...ARROWS, stackCount: 1 }], 'into the pack on the answer');
  assert.ok(shelf.changed() > 0, 'the host told');
  assert.equal((await r.book.vaultGrant('m2', 'withdraw', 3)).ok, true);
  assert.deepEqual(r.calls.find((c) => c[0] === 'vaultGrant'), ['vaultGrant', 'rabc', 'm2', 'withdraw', 3]);
  const offline = new GuildBook({ door: {}, character: () => 'c', wallet: () => ({}) });
  assert.deepEqual(await offline.vaultPut(arrows), { ok: false, error: 'realm-only' });
});

test('GUILD2 the client\'s door: the five routes and their bodies; every refusal the service says has a sentence (mutants: a route\'s path; a refusal unsaid)', async () => {
  const seen = [];
  const door = accountGuilds({
    fetch: async (u, i) => { seen.push([new URL(u).pathname, JSON.parse(i.body)]); return { ok: true, status: 200, json: async () => ({}) }; },
    storage: { getItem: () => JSON.stringify({ id: 'a', secret: 's'.repeat(43) }), setItem() {}, removeItem() {} },
  });
  await door.rename('rabc', 'The Open Hand', null);
  await door.vault('rabc');
  await door.vaultPut({ character: 'rabc', realm: 7, pick: 2, item: { a: 1 }, count: 3 });
  await door.vaultTake({ character: 'rabc', realm: 7, slot: 4, at: 9 });
  await door.vaultGrant('rabc', 'm2', null, 0);
  assert.deepEqual(seen, [
    ['/v1/guilds/rename', { character: 'rabc', name: 'The Open Hand' }],
    ['/v1/guilds/vault', { character: 'rabc' }],
    ['/v1/guilds/vault/put', { character: 'rabc', realm: 7, pick: 2, item: { a: 1 }, count: 3 }],
    ['/v1/guilds/vault/take', { character: 'rabc', realm: 7, slot: 4, at: 9 }],
    ['/v1/guilds/vault/grant', { character: 'rabc', member: 'm2', level: null, limit: 0 }],
  ]);
  for (const w of ['guild-rename-same', 'guild-name-word', 'guild-rename-soon', 'guild-rename-siege', 'guild-rename-gold', 'guild-rename-moved',
    'guild-vault-rank', 'guild-vault-limit', 'guild-vault-full', 'guild-vault-empty', 'guild-vault-moved', 'guild-vault', 'vault-goods',
    'bad-vault-item', 'bad-vault-count', 'bad-vault-slot', 'bad-vault-grant']) assert.equal(typeof REFUSALS[w], 'string', w);
  assert.match(REFUSALS['guild-rename-gold'], /25,000 gold/);
  const svc = src('server-account/src/service.js'), idx = src('server-account/src/index.js');
  for (const r of ['/v1/guilds/rename', '/v1/guilds/vault', '/v1/guilds/vault/put', '/v1/guilds/vault/take', '/v1/guilds/vault/grant']) {
    assert.ok(svc.includes(`'${r}'`), r); assert.ok(idx.includes(`'${r}':`), r);
  }
});

// ─── THE TAB ────────────────────────────────────────────────────────

function fakeNode(tag, doc) {
  const n = {
    tagName: tag.toUpperCase(), children: [], parent: null, className: '', textContent: '', id: '', value: '', disabled: false,
    style: {}, dataset: {}, attrs: {}, listeners: new Map(), focused: false,
    append(...cs) { for (const c of cs) { if (typeof c === 'object') { c.parent = n; n.children.push(c); } } },
    replaceChildren(...cs) { n.children = []; n.append(...cs); },
    setAttribute(k, v) { n.attrs[k] = v; },
    getAttribute(k) { return n.attrs[k]; },
    addEventListener(t, fn) { if (!n.listeners.has(t)) n.listeners.set(t, []); n.listeners.get(t).push(fn); },
    removeEventListener() {},
    fire(t, e = {}) { const ev = { type: t, target: n, preventDefault() {}, stopPropagation() {}, ...e }; for (const fn of n.listeners.get(t) ?? []) fn(ev); return ev; },
    focus() { n.focused = true; doc.activeElement = n; },
    remove() { n.removed = true; },
  };
  return n;
}
function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => fakeNode(tag, doc);
  doc.head = fakeNode('head', doc); doc.body = fakeNode('body', doc);
  doc.getElementById = () => null;
  return doc;
}
const find = (n, cls, out = []) => { if (String(n.className).split(/\s+/).includes(cls)) out.push(n); for (const c of n.children) find(c, cls, out); return out; };
const texts = (n) => [n.textContent, ...n.children.flatMap(texts)].filter(Boolean);
const buttons = (root, label) => find(root, 'dfsocial-btn').filter((b) => b.textContent === label || b.children[0]?.textContent === label || String(b.textContent).startsWith(label));
const button = (root, label) => buttons(root, label)[0];
const settle = () => new Promise((r) => setImmediate(r));
async function tab(guild, opts = {}, page = null) {
  const rig = guildRig(guild, opts);
  const social = new SocialState({ acct: 'a' });
  const doc = fakeDocument();
  const panel = createSocialPanel({ social, guild: rig.book, doc, win: { addEventListener() {}, removeEventListener() {} }, overlay: () => false, touch: false });
  const go = async (p) => { panel.openGuild(p); for (let i = 0; i < 4; i++) { await settle(); panel.render(); } };
  await go(page);
  return { ...rig, panel, go, social, doc };
}

test('GUILD2 the tab in pages: the guild\'s header over every page - its banner, name and tag, the reader\'s rank and the treasury - and a strip of pages, the guild Stores among them only where the professions are this account\'s; a page the guild does not show opens the Overview (mutants: the strip lost; the Stores page offline)', async () => {
  const t = await tab(view());
  const strip = find(t.panel.root, 'dfsocial-subtab');
  assert.deepEqual(strip.map((b) => b.dataset.page), ['overview', 'members', 'treasury', 'vault', 'arms', 'settings']);
  assert.deepEqual(strip.map((b) => b.attrs['aria-selected']), ['true', 'false', 'false', 'false', 'false', 'false']);
  const all = texts(t.panel.root);
  assert.ok(all.includes('The Hand [HND]'));
  assert.ok(all.includes('You are Guildmaster - the treasury holds 30,000 gold'), 'GUILD1b\'s line, kept');
  assert.ok(all.includes('1/50 members - the vault 1/50'));
  strip[2].fire('click');
  t.panel.render();
  assert.equal(find(t.panel.root, 'dfsocial-subtab')[2].attrs['aria-selected'], 'true');
  assert.ok(texts(t.panel.root).includes('Treasury'));
  await t.go('stores');
  assert.equal(find(t.panel.root, 'dfsocial-subtab')[0].attrs['aria-selected'], 'true', 'no Stores here: the Overview');
});

test('GUILD2a the Settings page: a new name is the guildmaster\'s, its price said; Rename arms and the second press pays; it waits on the realm\'s gold in the treasury and on the fortnight, each said; an Officer sees none (mutants: one press; the gold unread; the cooldown unread)', async () => {
  const t = await tab(view(), {}, 'settings');
  assert.ok(texts(t.panel.root).includes(GUILD_RENAME_COST_TEXT));
  const field = (label) => find(t.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === label);
  assert.equal(field('Guild name').value, 'The Hand', 'the draft starts at the name that stands');
  assert.equal(button(t.panel.root, 'Rename').disabled, true, 'already the guild\'s');
  field('Guild name').value = 'The Open Hand'; field('Guild name').fire('input');
  assert.equal(button(t.panel.root, 'Rename').disabled, false);
  button(t.panel.root, 'Rename').fire('click');
  t.panel.render();
  assert.equal(t.calls.some((c) => c[0] === 'rename'), false, 'the first press arms');
  button(t.panel.root, 'Sure? 25,000 gold').fire('click');
  await settle(); await settle();
  assert.deepEqual(t.calls.find((c) => c[0] === 'rename'), ['rename', 'rabc', 'The Open Hand', 'HND']);
  const poor = await tab(view({ hallGold: 24_999 }), {}, 'settings');
  const pf = find(poor.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'Tag');
  pf.value = 'OPH'; pf.fire('input');
  assert.equal(button(poor.panel.root, 'Rename').disabled, true);
  assert.ok(texts(button(poor.panel.root, 'Rename')).includes('25,000 of the realm\'s gold in the treasury'));
  const nowS = Math.floor(Date.now() / 1000);
  const soon = await tab(view({ renamedAt: nowS - 86_400, renameAt: nowS + 13 * 86_400 }), {}, 'settings');
  assert.ok(texts(soon.panel.root).includes(guildRenameSoonText(nowS + 13 * 86_400, nowS)));
  const sf = find(soon.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'Tag');
  sf.value = 'OPH'; sf.fire('input');
  assert.ok(texts(button(soon.panel.root, 'Rename')).includes('not yet'));
  const officer = await tab(view({ rank: 1, members: [{ member: 'm2', name: 'Mara', rank: 1, joinedAt: 1, you: true }] }), {}, 'settings');
  assert.equal(buttons(officer.panel.root, 'Rename').filter((b) => b.textContent !== 'Rename ranks').length, 0);
  assert.equal(texts(officer.panel.root).includes(GUILD_RENAME_COST_TEXT), false);
});

test('GUILD2b the Vault page: each piece with who put it in; Take and Take one for a member who may take out, none for one who only puts in; Put in from the pack, a piece and how many, never the bag or a worn piece; away from a town it says so and every act waits (mutants: Take offered to a depositor; the town unread)', async () => {
  const pieces = [{ slot: 0, name: 'Arrow', count: 25, by: 'Aldric', at: 5 }, { slot: 1, name: 'Dagger', count: 1, by: 'Mara', at: 6 }];
  const worn = { group: 'Armor', templateIndex: 102, material: 0, name: 'Cuirass', value: 5, equipSlot: 1 };
  const bag = { group: 'UselessItems2', templateIndex: 600, name: 'Materials Bag', value: 250 };
  const t = await tab(view(), { vaultItems: pieces, pack: [{ ...ARROWS }, worn, bag] }, 'vault');
  const all = texts(t.panel.root);
  assert.ok(all.includes('Arrow x25') && all.includes('put in by Aldric') && all.includes('Dagger'));
  const row = (n) => find(t.panel.root, 'dfsocial-row').find((r) => texts(r).includes(n));
  assert.deepEqual(find(row('Arrow x25'), 'dfsocial-btn').map((b) => b.children[0]?.textContent ?? b.textContent), ['Take', 'Take one']);
  assert.deepEqual(find(row('Dagger'), 'dfsocial-btn').map((b) => b.children[0]?.textContent ?? b.textContent), ['Take']);
  const pick = find(t.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'A piece of your pack');
  assert.deepEqual(pick.children.map((o) => o.textContent), ['Arrow x40'], 'never a worn piece nor the bag');
  assert.equal(button(t.panel.root, 'Put in').disabled, false);
  button(row('Arrow x25'), 'Take one').fire('click');
  await settle(); await settle();
  assert.deepEqual(t.calls.find((c) => c[0] === 'vaultTake')[1], { character: 'rabc', realm: 7, slot: 0, count: 1, at: 5 });
  const member = await tab(view({ rank: 2, members: [{ member: 'm3', name: 'Bran', rank: 2, joinedAt: 1, you: true }], vault: { used: 2, max: 50, me: { level: 'deposit', limit: 0, granted: false, taken: 0 } } }),
    { vaultItems: pieces, pack: [{ ...ARROWS }] }, 'vault');
  assert.equal(buttons(member.panel.root, 'Take').length, 0, 'a depositor takes nothing');
  assert.ok(button(member.panel.root, 'Put in'));
  assert.ok(texts(member.panel.root).includes('Your standing: Puts in.'));
  const away = await tab(view(), { vaultItems: pieces, pack: [{ ...ARROWS }] }, 'vault');
  away.setReach(false); away.panel.render(); await away.go('vault');
  assert.ok(texts(away.panel.root).includes(GUILD_VAULT_REACH_TEXT));
  assert.equal(button(away.panel.root, 'Take').disabled, true);
  assert.equal(button(away.panel.root, 'Put in').disabled, true);
  const empty = await tab(view(), { vaultItems: [] }, 'vault');
  assert.ok(texts(empty.panel.root).includes(GUILD_VAULT_EMPTY_TEXT));
});

test('GUILD2b the Vault page (AUDIT M1-M3): the town read live - a page left open on the road shuts Take and sends nothing; the vault read again at each look; another guild\'s pieces never shown, nor taken from (mutants: the town read once; read once a session; a stale view shown)', async () => {
  const pieces = [{ slot: 0, name: 'Ebony Dagger', count: 1, by: 'Aldric', at: 5 }];
  const t = await tab(view(), { vaultItems: pieces }, 'vault');
  const take = button(t.panel.root, 'Take');
  assert.equal(take.disabled, false);
  t.setReach(false);
  t.panel.render();   // the frame's live pass, nothing rebuilt
  assert.equal(take.disabled, true, 'shut on the road');
  take.disabled = false; take.fire('click');   // and a press that slipped through still sends nothing
  await settle(); await settle();
  assert.equal(t.calls.filter((c) => c[0] === 'vaultTake').length, 0);
  t.setReach(true);
  t.panel.render();
  assert.equal(take.disabled, false, 'open again in a town');
  // read again at each look: the tab opened again, the page turned to
  const reads = () => t.calls.filter((c) => c[0] === 'vault').length;
  const first = reads();
  await t.go('overview');
  await t.go('vault');
  assert.ok(reads() > first, 'read again');
  find(t.panel.root, 'dfsocial-subtab').find((b) => b.dataset.page === 'overview').fire('click');
  const before = reads();
  find(t.panel.root, 'dfsocial-subtab').find((b) => b.dataset.page === 'vault').fire('click');
  for (let i = 0; i < 3; i++) { await settle(); t.panel.render(); }
  assert.ok(reads() > before, 'and at the page\'s own tab');
  // a read that fails shows no pieces - the last guild's least of all
  t.answers.vault = { ok: false, error: 'server' };
  await t.book.readVault();
  assert.equal(t.book.vaultNow(), null);
  await t.go('vault');
  assert.equal(buttons(t.panel.root, 'Take').length, 0, 'no Take on a view not read');
  assert.equal(t.book.vaultView, null);
  t.answers.vault = undefined;
  await t.book.readVault();
  assert.equal(t.book.vaultNow()?.items?.length, 1);
  t.book.guild = { ...t.book.guild, id: 'gOTHER000000' };
  assert.equal(t.book.vaultNow(), null, 'another guild\'s view is no view');
  assert.deepEqual(await t.book.vaultTake(0), { ok: false, error: 'guild-vault-empty' }, 'nor taken from');
});

test('GUILD2b the Members page: the guildmaster sets each member\'s standing at the vault - as their rank, no access, puts in, takes out with a limit a day - and Set says it; revoking is "as their rank"; an officer sees each standing but sets none (mutants: grants offered to an officer; the limit unsent)', async () => {
  const members = [
    { member: 'm1', name: 'Aldric', rank: 0, joinedAt: 1, you: true, vault: { level: 'withdraw', limit: 0, granted: false } },
    { member: 'm3', name: 'Bran', rank: 2, joinedAt: 2, you: false, vault: { level: 'deposit', limit: 0, granted: false } },
  ];
  const t = await tab(view({ members }), {}, 'members');
  assert.ok(texts(t.panel.root).includes('Member - Puts in'));
  const sel = (label) => find(t.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === label);
  assert.equal(sel('Aldric\'s vault access'), undefined, 'never the guildmaster\'s own row');
  const access = sel('Bran\'s vault access');
  assert.deepEqual(access.children.map((o) => o.value), ['', 'none', 'deposit', 'withdraw']);
  assert.equal(button(find(t.panel.root, 'dfsocial-grant')[0], 'Set').disabled, true, 'unchanged');
  access.value = 'withdraw'; access.fire('change');
  // AUDIT GUILD2: drawn again in place, the focus kept on the level; a member made a withdrawer starts at ten a day (the
  // limit counts takes - PIN MOVED: "pieces a day")
  assert.equal(t.doc.activeElement, sel('Bran\'s vault access'), 'the focus on the level, drawn again');
  assert.equal(sel('Bran\'s takes a day').children.find((o) => o.selected)?.value, '10', 'an Officer\'s ten, never "Any number" unasked');
  t.panel.render();
  const limit = sel('Bran\'s takes a day');
  assert.ok(limit, 'a withdrawer\'s limit');
  limit.value = '5'; limit.fire('change');
  button(find(t.panel.root, 'dfsocial-grant')[0], 'Set').fire('click');
  await settle(); await settle();
  assert.deepEqual(t.calls.find((c) => c[0] === 'vaultGrant'), ['vaultGrant', 'rabc', 'm3', 'withdraw', 5]);
  const granted = [members[0], { ...members[1], vault: { level: 'withdraw', limit: 5, granted: true } }];
  const g2 = await tab(view({ members: granted }), {}, 'members');
  assert.ok(texts(g2.panel.root).includes('Member - Takes out, 5 a day (granted)'));
  const back = find(g2.panel.root, 'dfsocial-field').find((f) => f.attrs['aria-label'] === 'Bran\'s vault access');
  back.value = ''; back.fire('change');
  g2.panel.render();
  button(find(g2.panel.root, 'dfsocial-grant')[0], 'Set').fire('click');
  await settle(); await settle();
  assert.deepEqual(g2.calls.find((c) => c[0] === 'vaultGrant'), ['vaultGrant', 'rabc', 'm3', null, 0], 'revoked: the rank\'s again');
  const officer = await tab(view({ rank: 1, members: [{ ...members[0], you: false }, { member: 'm2', name: 'Mara', rank: 1, joinedAt: 1, you: true }, members[1]] }), {}, 'members');
  assert.equal(find(officer.panel.root, 'dfsocial-grant').length, 0);
  assert.ok(texts(officer.panel.root).includes('Member - Puts in'), 'but reads them');
});

test('GUILD2c the Arms page: the guildmaster\'s choices are pictures - the division a tile each, drawn on the draft\'s own colours; the colours swatches, the ones the law refuses shut; the device a tile of forty; the device\'s own colour; the banner, the shield and the tag as they will stand (mutants: a refused colour offered; the second colour row on a plain field)', async () => {
  const t = await tab(view({ marks: 900 }), {}, 'arms');
  const tiles = find(t.panel.root, 'dfsocial-tile');
  assert.equal(tiles.filter((x) => /^Field: /.test(x.attrs['aria-label'])).length, 8);
  assert.equal(tiles.filter((x) => /^Device: /.test(x.attrs['aria-label'])).length, 40);
  const sw = (label) => find(t.panel.root, 'dfsocial-swatch').find((x) => x.attrs['aria-label'] === label);
  assert.equal(sw('Field colour: Ash').disabled, true, 'Ash never the field');
  assert.equal(sw('Field colour: Gold').disabled, true, 'nor the border\'s colour');
  assert.equal(sw('Second colour: Crimson'), undefined, 'a plain field has no second colour');
  tiles.find((x) => x.attrs['aria-label'] === 'Field: Per pale').fire('click');
  assert.ok(sw('Second colour: Crimson'), 'divided, it has');
  assert.equal(sw('Second colour: Azure').disabled, true, 'never the field\'s');
  sw('Second colour: Crimson').fire('click');
  sw('Device colour (its border\'s, unless chosen): Argent').fire('click');
  const [banner] = find(t.panel.root, 'dfsocial-armspics')[0].children;
  assert.ok(decodeURIComponent(banner.src).includes('fill="#b3262e"'), 'the banner wears the draft');
  assert.ok(texts(t.panel.root).includes('Per pale Azure and Crimson, bordered Gold, a Wolf Argent'));
  assert.equal(button(t.panel.root, 'Change it').disabled, false);
  assert.ok(find(t.panel.root, 'dfsocial-tagchip')[0].textContent.includes('HND'));
  // AUDIT GUILD2: every swatch asks the law itself - the device's colour against the second field colour was left open,
  // and a pick of it made arms the law refused (the border's too, while the device wears the border's)
  assert.equal(sw('Device colour (its border\'s, unless chosen): Crimson').disabled, true, 'never the second colour');
  sw('Device colour (its border\'s, unless chosen): Gold').fire('click');   // the border's again
  assert.equal(sw('Border: Crimson').disabled, true, 'a border the device would wear against the second colour');
  for (const label of find(t.panel.root, 'dfsocial-swatch').map((b) => b.attrs['aria-label'])) {
    const b = sw(label);   // drawn again at each pick: the swatch as it stands now
    if (!b || b.disabled) continue;
    b.fire('click');
    const raise = button(t.panel.root, 'Change it');
    assert.equal(raise.disabled, false, `${label} - an open swatch makes arms the law takes (${raise.whyEl?.textContent ?? ''})`);
  }
});
