// @ts-check
// ARENA3 (2026-10-02, Mac: "Joining a team comes with it's own enhanced UI where you can view your ranking and even
// player leaderboards"; "extremely detailed and authentic"): WHAT THE ARENA WINDOW SAYS - every page of it, as data,
// built from the save (the ladder, the league and its book), the game's clock and the gate's state. The window
// (ui/arenaWindow.js) draws these and asks the host to act; nothing here touches a door. Design:
// bible/11-Multiplayer/Arena.md "5. The Arena window" - Bouts, Ladder, Team, Leaderboards, Records, Rules.
//
// Pure. Not a DFU member. Ledger A (ARENA).

import { ARENA_TEXT } from './arenaText.js';
import {
  LADDER_TIERS, BOUTS_PER_TIER, BOUT_PURSE, CHAMPION_PURSE, EXHIBITION_HOURS, arenaLadderRestore, nextLadderBout, ladderTitle,
  ladderTitles, exhibitionFor, hourIndexOf,
} from './arenaLadder.js';
import { fighterIdentity } from './arenaFighters.js';
import {
  rollLeague, leagueStandings, leagueRoster, laurelWorn, laurelBanner, rosterGrandChampions, seasonDayOf, BANNERS,
} from './arenaLeague.js';
import { exhibitionCard, bookLines } from './arenaBook.js';
import { enemyDisplayName, ENEMY_BASICS } from '../characters/enemyBasics.js';
import { dateFromClassicMinutes, MONTH_NAMES, MINUTES_PER_DAY } from './gameDate.js';

/** The window's pages, in their order on the tab bar. */
export const ARENA_PAGES = Object.freeze(['bouts', 'ladder', 'team', 'boards', 'records', 'rules']);
/** The leaderboards' boards, in their order. */
export const ARENA_BOARDS = Object.freeze(['pve', 'fast', 'pvp', 'team']);
/** How many rows a board shows before the player's own is pinned under it. */
export const BOARD_TOP = 10;
/** A fighter may be sent onto the sand with this share of their health (systems/arenaHerald.js FIGHT_HEALTH_MIN). */
const FIT = 0.5;

const W = () => ARENA_TEXT.window;
const T = () => ARENA_TEXT.teams;
/** "Thief, level 1" - a ladder opponent as the window bills it before the bout names them. */
export function opponentLine(list) {
  const one = (o) => {
    const kind = enemyDisplayName(o.mobile) ?? W().fighter;
    const lvl = o.level ?? ENEMY_BASICS[o.mobile]?.level ?? null;
    return lvl ? W().opponent(kind, lvl) : kind;
  };
  return list.map(one).join(W().and);
}
/** A game minute as the window dates it: "14 First Seed, 3E 405". */
export function arenaDate(gameMinutes) {
  const d = dateFromClassicMinutes(Math.max(0, Math.floor(Number(gameMinutes) || 0)));
  return `${d.day + 1} ${MONTH_NAMES[d.month]}, 3E ${d.year}`;
}
const hh = (h) => `${String(h % 24).padStart(2, '0')}:00`;

/**
 * THE HEADER: who the arena calls you, your banner and laurel, the season's day, your record and purse.
 * @param {{ ladder: any, league: any, gameMinutes: number, name: string }} o
 */
export function arenaHeader({ ladder, league, gameMinutes, name }) {
  const L = arenaLadderRestore(ladder);
  const G = rollLeague(league, gameMinutes);
  const st = leagueStandings(G, gameMinutes);
  return {
    name: name || W().you, title: ladderTitle(L), banner: G.team, laurel: laurelWorn(G, gameMinutes),
    season: W().seasonLine(st.season, st.day), record: W().recordLine(L.record.wins, L.record.losses), purses: L.record.purses,
    owed: G.book?.owed ?? 0,
  };
}

// ── BOUTS ────────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE BOUTS PAGE: the exhibition of the hour (or the next one), the bouts between players (online), and your next
 * ladder bout - each a card with its fighters, their records and the odds, and its presses (Watch, Wager, Fight) with
 * why not where one cannot be pressed.
 * @param {{ ladder: any, league: any, gameMinutes: number, atGate?: boolean, onSand?: ({a:string,b:string}|null),
 *   healthShare?: number, gold?: number, liveHour?: number|null, begun?: boolean }} o `liveHour` the hour whose exhibition stands
 *   on the sand here, `begun` whether its fight has begun (the book shuts at the word)
 */
export function boutsPage({ ladder, league, gameMinutes, atGate = false, onSand = null, healthShare = 1, gold = 0, liveHour = null, begun = false }) {
  const cards = [];
  const gm = Math.max(0, Math.floor(Number(gameMinutes) || 0));
  // THE EXHIBITION: this hour's while it may still be watched, else the next hour that holds one
  let ex = exhibitionFor(gm);
  const now = !!ex && (ex.open || liveHour === ex.hour);
  if (!now) {
    let h = hourIndexOf(gm) + 1;
    for (let k = 0; k < 48 && !EXHIBITION_HOURS.includes(h % 24); k++) h++;
    ex = exhibitionFor(h * 60);
  }
  if (ex) {
    const book = exhibitionCard(league, ex, gm, { gold, begun: now && begun, atGate });
    const fighters = ex.opponents.map((o, i) => {
      const who = fighterIdentity(ex.seed, i, o.mobile);
      return {
        name: who.name, billing: who.beast ? who.billing : `${who.home}, ${who.epithet}`, banner: i === 0 ? 'red' : 'blue',
        kind: opponentLine([o]), record: book.records[i], odds: book.odds[i], favourite: book.favourite === i,
      };
    });
    const at = hh(hourIndexOf(ex.startsAt));
    const watchWhy = !now ? W().whyNotYet(at) : !atGate ? W().whyGate : null;
    cards.push({
      key: 'exhibition', kind: 'exhibition', title: W().exhibitionTitle(at), state: now ? (liveHour === ex.hour || onSand ? W().onSand : W().openNow) : W().opensAt(at),
      tier: ARENA_TEXT.tiers[ex.tier], fighters, hour: ex.hour, beasts: !!ex.beasts,
      acts: [
        { act: 'watch', label: W().watch, why: watchWhy },
        { act: 'wager', label: W().wager, why: book.why },
      ],
      wager: book.wager, lines: book.lines, stakes: book.stakes,
    });
  }
  // THE PLAYERS' BOUTS: online (ARENA4) - said, never a hole
  cards.push({ key: 'players', kind: 'players', title: W().playersTitle, state: W().onlineOnly, fighters: [], acts: [], lines: [W().playersLine] });
  // THE LADDER'S NEXT
  const next = nextLadderBout(ladder);
  if (next) {
    const fit = healthShare >= FIT;
    const why = !atGate ? W().whyGate : !fit ? W().whyHurt : null;
    cards.push({
      key: 'ladder', kind: 'ladder', title: W().ladderTitle(next.tierName, next.label), state: next.grand ? W().grandBout : next.champion ? W().champBout : W().ladderBout,
      tier: next.tierName, fighters: [], opponents: opponentLine(next.opponents), purse: next.purse, beasts: next.beasts, free: next.free,
      acts: [{ act: 'fight', label: W().fight, why }], lines: [W().purseLine(next.purse)],
    });
  } else cards.push({ key: 'ladder', kind: 'ladder', title: W().ladderDoneTitle, state: ARENA_TEXT.titles[LADDER_TIERS.length - 1], fighters: [], acts: [], lines: [ARENA_TEXT.herald.ladderDone] });
  const owed = rollLeague(league, gm).book?.owed ?? 0;
  return { cards, owed, bookLines: bookLines(league, gm) };
}

// ── LADDER ───────────────────────────────────────────────────────────────────────────────────────────────────
/** THE LADDER PAGE: the ten tiers as a column - each its three bouts' opponents and its champion, what you have
 *  cleared, where you stand, the title it gives and its purses; and the next fight's purse. */
export function ladderPage({ ladder }) {
  const L = arenaLadderRestore(ladder);
  const next = nextLadderBout(L);
  const tiers = LADDER_TIERS.map((t, i) => {
    const cleared = L.champs[i] || (L.grand && i === LADDER_TIERS.length - 1);
    const current = !L.grand && L.tier === i;
    const state = cleared ? 'cleared' : current ? 'current' : i < L.tier ? 'cleared' : 'locked';
    const bouts = t.bouts.map((b, k) => ({ label: ARENA_TEXT.boutLabel(k + 1), opponents: opponentLine(b), won: state === 'cleared' || (current && L.won > k), next: !!next && current && !next.champion && next.bout === k }));
    return {
      n: i + 1, name: ARENA_TEXT.tiers[i], title: ARENA_TEXT.titles[i], state, beasts: !!t.beasts, free: !!t.free,
      bouts, champion: { label: i === LADDER_TIERS.length - 1 ? ARENA_TEXT.grandLabel : ARENA_TEXT.champLabel, opponents: opponentLine(t.champion), beaten: cleared, next: !!next && current && next.champion },
      purse: BOUT_PURSE[i], champPurse: CHAMPION_PURSE[i], won: current ? L.won : cleared ? BOUTS_PER_TIER : 0,
    };
  });
  return {
    tiers, current: L.grand ? LADDER_TIERS.length - 1 : L.tier, grand: L.grand, titles: ladderTitles(L),
    next: next ? { tier: next.tierName, label: next.label, purse: next.purse, opponents: opponentLine(next.opponents) } : null,
  };
}

// ── TEAM ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** A roster row as a board shows it. */
const rosterRow = (f) => ({ id: f.id, name: f.name, home: f.home, banner: f.banner, title: f.title, tier: f.grand ? LADDER_TIERS.length : f.tier, wins: f.wins, losses: f.losses, points: f.points, you: false });
/** The rows ranked, the top shown and the player's own pinned under them when it is not among them. */
function topWithYou(rows, top = BOARD_TOP) {
  rows.forEach((r, i) => { r.rank = i + 1; });
  const shown = rows.slice(0, top);
  const me = rows.find((r) => r.you) ?? null;
  return { rows: shown, pinned: me && !shown.includes(me) ? me : null, total: rows.length };
}
/**
 * THE TEAM PAGE: your banner, its season against the other, the laurel, your points for it, and the roster's top ten
 * (you among them, or pinned under them). Unjoined: both banners, their standing and their best, and where to join.
 * @param {{ ladder: any, league: any, gameMinutes: number, name: string }} o
 */
export function teamPage({ ladder, league, gameMinutes, name }) {
  const G = rollLeague(league, gameMinutes);
  const st = leagueStandings(G, gameMinutes);
  const day = seasonDayOf(gameMinutes);
  const roster = leagueRoster(G.season, day);
  const L = arenaLadderRestore(ladder);
  const laurel = laurelBanner(G, gameMinutes);
  const meRow = (banner) => ({
    id: 'you', name: name || W().you, home: '', banner, title: ladderTitle(L), tier: L.grand ? LADDER_TIERS.length : L.tier,
    wins: G.bouts.filter((b) => b.won && b.team === banner).length, losses: G.bouts.filter((b) => !b.won && b.team === banner).length, points: G.points[banner] ?? 0, you: true,
  });
  const banners = BANNERS.map((b) => {
    const rows = roster.filter((f) => f.banner === b).map(rosterRow);
    if (G.team === b) rows.push(meRow(b));
    rows.sort((x, y) => y.points - x.points || y.tier - x.tier || x.losses - y.losses || x.name.localeCompare(y.name));
    return { banner: b, name: T().name[b], motto: T().motto[b], lore: T().lore[b], points: st[b], laurel: laurel === b, fighters: rows.length, ...topWithYou(rows) };
  });
  const total = st.red + st.blue;
  return {
    joined: G.team, season: st.season, day, standings: { red: st.red, blue: st.blue, leader: st.leader, redShare: total > 0 ? Math.round((st.red / total) * 1000) / 1000 : 0.5 },
    laurel, laurelYou: laurelWorn(G, gameMinutes), given: st.given, boutsFor: G.team ? G.bouts.filter((b) => b.team === G.team && b.won).length : 0,
    left: G.left, banners, lines: teamLines(G, st, laurel),
  };
}
function teamLines(G, st, laurel) {
  const out = [];
  out.push(st.leader ? T().leads(T().name[st.leader]) : T().level);
  if (laurel) out.push(T().laurel(T().name[laurel]));
  if (G.team) { out.push(T().under(T().the[G.team])); out.push(T().given(st.given)); }
  else { out.push(T().none); out.push(W().joinWhere); }
  return out;
}

// ── LEADERBOARDS ─────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE LEADERBOARDS: PvE - the highest tier this season's field reached (you among them, by your ladder); the fastest
 * Grand Champions this save has seen (days from the first bout); PvP - the season's rating, fought online; the
 * banners, season by season. Each `{ title, sub, cols, rows, pinned, empty }`, a row `{ rank, name, banner, cells, you }`.
 * @param {{ ladder: any, league: any, gameMinutes: number, name: string }} o
 */
export function boardsPage({ ladder, league, gameMinutes, name }) {
  const G = rollLeague(league, gameMinutes);
  const L = arenaLadderRestore(ladder);
  const day = seasonDayOf(gameMinutes);
  const roster = leagueRoster(G.season, day);
  const me = name || W().you;
  // PvE: the highest tier reached - the Grand Champions first (the fastest first), then the tiers cleared, the wins
  const myTier = L.grand ? LADDER_TIERS.length : L.champs.filter(Boolean).length;
  const myDays = L.grand && G.grandAt != null && G.firstBoutAt != null ? Math.max(1, Math.ceil((G.grandAt - G.firstBoutAt) / MINUTES_PER_DAY)) : null;
  const pveRows = roster.map((f) => ({ name: f.name, home: f.home, banner: f.banner, title: f.title, reached: f.grand ? LADDER_TIERS.length : f.champs, wins: f.wins, losses: f.losses, days: f.days, you: false }));
  if (L.record.wins + L.record.losses > 0 || G.team) pveRows.push({ name: me, home: '', banner: G.team, title: ladderTitle(L), reached: myTier, wins: L.record.wins, losses: L.record.losses, days: myDays, you: true });
  pveRows.sort((a, b) => b.reached - a.reached || (a.reached === LADDER_TIERS.length ? (a.days ?? 1e9) - (b.days ?? 1e9) : 0) || b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
  // where each stands: the tier they fight in now (the one above the last champion they beat), or all ten taken
  const reachedLine = (n) => (n >= LADDER_TIERS.length ? W().allTen : W().cleared(n + 1, ARENA_TEXT.tiers[n]));
  const pve = topWithYou(pveRows.map((r) => ({ name: r.name, home: r.home, banner: r.banner, you: r.you, cells: [r.title ?? W().noTitle, reachedLine(r.reached), W().wl(r.wins, r.losses)] })));
  // the fastest Grand Champions: this save's seasons, and you
  const fastRows = rosterGrandChampions(G, gameMinutes).map((g) => ({ name: g.name, home: g.home, banner: g.banner, days: g.days, season: g.season, you: false }));
  if (myDays != null) fastRows.push({ name: me, home: '', banner: G.team, days: myDays, season: G.grandAt != null ? dateFromClassicMinutes(G.grandAt).year : G.season, you: true });
  fastRows.sort((a, b) => a.days - b.days || b.season - a.season || a.name.localeCompare(b.name));
  const fast = topWithYou(fastRows.map((r) => ({ name: r.name, home: r.home, banner: r.banner, you: r.you, cells: [W().days(r.days), W().seasonShort(r.season)] })));
  // the banners by season: this one standing, the closed ones with their winner and the side you fought on
  const st = leagueStandings(G, gameMinutes);
  const teamRows = [{ name: W().seasonShort(st.season), banner: st.leader, you: false, cells: [String(st.red), String(st.blue), st.leader ? W().leading(T().short[st.leader]) : T().level, G.team ? T().short[G.team] : W().none] }];
  for (const s of G.seasons) teamRows.push({ name: W().seasonShort(s.season), banner: s.winner, you: false, cells: [String(s.red), String(s.blue), s.winner ? W().won(T().short[s.winner]) : W().levelShort, s.mine ? T().short[s.mine] : W().none] });
  teamRows.forEach((r, i) => { r.rank = i + 1; });
  return {
    pve: { title: W().boards.pve, sub: W().boards.pveSub, cols: W().cols.pve, ...pve, empty: '' },
    fast: { title: W().boards.fast, sub: W().boards.fastSub, cols: W().cols.fast, ...fast, empty: fast.rows.length ? '' : W().boards.fastNone },
    pvp: { title: W().boards.pvp, sub: W().boards.pvpSub, cols: W().cols.pvp, rows: [], pinned: null, total: 0, empty: W().boards.pvpNone },
    team: { title: W().boards.team, sub: W().boards.teamSub, cols: W().cols.team, rows: teamRows, pinned: null, total: teamRows.length, empty: '' },
  };
}

// ── RECORDS ──────────────────────────────────────────────────────────────────────────────────────────────────
/** THE RECORDS PAGE: your record on the sand - wins, losses, yields, falls, ring-outs, the streak and the best, the
 *  purses, the champions beaten - and the last twenty bouts, newest first; and your wagers with the bookmaker. */
export function recordsPage({ ladder, league, gameMinutes }) {
  const L = arenaLadderRestore(ladder);
  const G = rollLeague(league, gameMinutes);
  const r = L.record;
  const fought = r.wins + r.losses;
  const stats = [
    { k: W().stat.wins, v: String(r.wins) }, { k: W().stat.losses, v: String(r.losses) },
    { k: W().stat.share, v: fought ? `${Math.round((r.wins / fought) * 100)}%` : '-' },
    { k: W().stat.yields, v: String(r.yields) }, { k: W().stat.falls, v: String(r.falls) }, { k: W().stat.ringouts, v: String(r.ringouts) },
    { k: W().stat.streak, v: String(r.streak) }, { k: W().stat.best, v: String(r.best) },
    { k: W().stat.purses, v: W().gold(r.purses) }, { k: W().stat.champions, v: String(L.champs.filter(Boolean).length) },
  ];
  const how = (b) => (b.how === 'draw' ? W().how.draw : W().how[b.how] ?? '');
  const bouts = G.bouts.map((b) => ({
    when: arenaDate(b.at), tier: ARENA_TEXT.tiers[b.tier], label: b.grand ? ARENA_TEXT.grandLabel : b.champion ? ARENA_TEXT.champLabel : b.label,
    opp: b.opp || W().fighter, result: b.how === 'draw' ? W().drew : b.won ? W().wonWord : W().lostWord, won: b.won, draw: b.how === 'draw', how: how(b),
    purse: b.purse, points: b.points, banner: b.team,
  }));
  return { stats, bouts, title: ladderTitle(L), titles: ladderTitles(L), empty: bouts.length ? '' : W().noBouts, wagers: bookLines(G, gameMinutes) };
}

// ── RULES ────────────────────────────────────────────────────────────────────────────────────────────────────
/** THE RULES PAGE: the arena's law in plain words, section by section. */
export const rulesPage = () => W().rules.map((s) => ({ head: s.head, lines: [...s.lines] }));

/** EVERY PAGE at once - the window's whole model. */
export function arenaBoard(o) {
  return {
    header: arenaHeader(o), bouts: boutsPage(o), ladder: ladderPage(o), team: teamPage(o), boards: boardsPage(o), records: recordsPage(o), rules: rulesPage(),
  };
}
