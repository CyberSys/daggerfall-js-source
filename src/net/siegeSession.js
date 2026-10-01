// @ts-check
// SEAT2a part four (2026-10-01, Mac: "Finish the seats"; "Or we could go ahead and do sieges"; "Continue"): A SIEGE AS
// THIS CLIENT FIGHTS IT (bible/11-Multiplayer/Seats-Arc.md 6.2-6.8, 19) - entered from the board's Seat tab while the
// battle's door is open: the field this game derived from the town (systems/siegeField.js) sent for a pass (the service
// settles the field on an attacker's and a defender's agreeing - until then it asks again, said in words), then the
// battle's own room joined (`siege:<key>:<week>`, a fresh pass on every hello - net/online.js mintSiegePass), `in` said
// once a socket is open; the room's words folded (net/siegeLink.js) and drawn (ui/siegeHud.js); a step refused or a rise
// at the camp moves the player there; a blow on a foe sent to the referee; at the end this fighter's receipt kept and
// carried to the service (net/siegeClaims.js), its Honours on the card. Left at the window's close or by the player -
// the world's own room is joined again.
//
// The world is handed in (`online`, the book's two calls, the HUD, the clock, `movePlayer`), so the pins drive it with
// fakes. Not a DFU member. Ledger A (EVERY PALACE A SEAT's row).
//
// AUDIT-SEATS (2026-10-01): C1 - A BATTLE IS LEFT: by the player (the HUD's Leave, the result card's Close, the chat's
// `/leave` - scenes/world.js), when the player has been away from the seat's town BATTLE_AWAY_MS (`here`), when the
// battle's socket is closed for good, and at the window's close; the HUD is drawn only while the player stands in the
// battle's room (a building's room is not the field). C2 - the one mint slot (net/online.js mintSiegePass) is cleared
// only while it is this session's own. C3 - an unsettled field is said ONCE and asked again on a backing-off wait (5 s,
// 10, 20, 40, then every 60 s), so the service's hourly bound on passes is never reached. C7 - every settling answer to
// this fighter's receipt reaches the card (a refusal in words), so it never stands on "claim it".
//
// SEAT2b part two (2026-10-01, Mac: "I want to finish the inprogress"): THE WORKS, THE FIGURES AND THE REVOLT
// (bible/11-Multiplayer/Seats-Arc.md 6.2, 7.5, 7.7; SEAT2b part two's contract, items 1-6) - the pass the service hands
// this client is read for what the battle froze (net/siegeLink.js readSiegePass: its works `sx` - the Walls a defender's
// wave counts by - its kind and its settled field, where the works stand); the relay-run figures and the works are
// stood in the town while this player stands in the battle's room (`figures` - scenes/siegeFigures.js - cleared the
// moment it does not: EVERY ALLOCATION HAS AN OWNER), a spectator's too; a fighter strikes them as it strikes a foe -
// a blow at a figure of the other side or at the other side's work (the attackers the guards and the Gatehouse, the
// defenders the Ram, the rebels and their Captain - siegeLink.js siegeStrikesAt, the relay's own rule), a harmful cast at
// a figure, never at a work (a spell harms no stone or timber) and never a heal at one (DECIDED: a gift is a side-mate's,
// ALLY-CAST's frame between players; the relay's figures rise at their own wave) - and ONLY AT A RELAY THAT KNOWS THEM
// (`worksOk`: net/wire.js relayKnowsWorks of the battle socket's relay - an older one closes the socket on such a word).
// A REVOLT (`sn` 'revolt', the seats' battle `kind: 'revolt'`): its pass asked as a siege's (the holder's side `defend`,
// anyone else `watch` - the service's to say); the holder's side musters at the ATTACKERS' camp, where the relay stands
// it (its words say so); its HUD and card a revolt's (siegeLink.js), its receipt carried with no Honours promised.
import { siegeRoomKey, fieldOf } from './siegeRef.js';
import { foldSiege, siegeHudModel, siegeClaimRefusal, revoltClaimRefusal, readSiegePass, siegeWorksPoints, siegeStrikesAt, SIEGE_STATE_EMPTY } from './siegeLink.js';
import { isSiegeFigure, isSiegeWork } from './wire.js';   // SEAT2b part two: a figure's id, a work's
import { readSiegeReceipt } from './siegeReceipt.js';

/** How long an unsettled field waits before the pass is asked again, ms - the first wait. */
export const SIEGE_PASS_RETRY_MS = 5000;
/** AUDIT-SEATS C3: the longest wait - each doubles from the first to this (a Royal Tourney's ring's too). */
export const PASS_RETRY_MAX_MS = 60_000;
/** AUDIT-SEATS C3: the wait before the `n`th ask again (1 the first): 5 s, 10, 20, 40, then 60 for good. */
export const passRetryMs = (n, first = SIEGE_PASS_RETRY_MS) => Math.min(PASS_RETRY_MAX_MS, first * 2 ** Math.max(0, n - 1));
/** AUDIT-SEATS C1: how long the player may be away from the seat's town before the battle is left, ms - a door, a load's
 *  frames or a step past the town's edge is no leaving. */
export const BATTLE_AWAY_MS = 5000;
/** AUDIT-SEATS C1: the chat's word that leaves a battle or a Royal Tourney (scenes/world.js) - `/leave`. */
export const isBattleLeaveCommand = (text) => /^\/leave$/i.test(String(text ?? '').trim());
/** AUDIT-SEATS C1: what the chat says to a `/leave` with nothing entered. */
export const BATTLE_NONE_TEXT = 'You are in no battle and no Royal Tourney.';
/** The words. */
export const SIEGE_SESSION_TEXT = Object.freeze({
  notHere: (town) => `Go to ${town} to fight for it - the battle is fought in the town itself.`,
  old: 'The server does not fight sieges yet.',
  entered: (side) => (side === 'watch' ? 'You are watching the battle. Nothing you do reaches it.' : `You fight for the ${side === 'attack' ? 'attackers' : 'defenders'}. Make for your camp's banner.`),
  left: 'You have left the battle.',
  refused: (why) => `The battle would not have you: ${why}`,
  away: (town) => `You have left ${town}, and the battle with it.`,   // AUDIT-SEATS C1
  closed: 'The battle\'s door has closed on you - you have left it.',   // AUDIT-SEATS C1: its socket closed for good
  // SEAT2b part two (7.7): a revolt entered - the holder's side musters at the camp outside the gate (the rebels hold the
  // palace door, where the defenders' camp would be) and marches on them
  revolt: (side) => (side === 'watch' ? 'You are watching the revolt. Nothing you do reaches it.'
    : 'The town has risen against your guild. Muster at the camp outside the gate and march on the palace door - the Rebel Captain must fall.'),
});

/**
 * THE SESSION. `online` (net/online.js), `pass(seat, field)` and `claim(receipt)` the book's (net/townSeatBook.js
 * siegePass, claimSiege), `claims` (net/siegeClaims.js, or null), `hud` (ui/siegeHud.js createSiegeHud, or null),
 * `nowMs()` (AUDIT-SEATS C6: the relay's clock - the pass's window is the relay's), `movePlayer(pose)` (a wire pose:
 * natives on x and z), `say(text)`, `relayOk()` the relay fights battles; AUDIT-SEATS C1: `here(seat)` whether the player
 * is still at the seat's town. SEAT2b part two: `worksOk()` the battle socket's relay knows a battle's works and figures
 * (net/wire.js relayKnowsWorks - false strikes none of them), `figures` the drawing of them in the town
 * (scenes/siegeFigures.js createSiegeFigures, or null).
 * @param {{ online: any, pass: (seat: any, field: any) => Promise<any>, claims?: any, hud?: any, nowMs?: () => number,
 *   movePlayer?: (p: any) => void, say?: (t: string) => void, relayOk?: () => boolean, here?: (seat: any) => boolean,
 *   worksOk?: () => boolean, figures?: any }} deps
 */
export function createSiegeSession({ online, pass, claims = null, hud = null, nowMs = () => Date.now(), movePlayer = () => {}, say = () => {}, relayOk = () => true, here = () => true,
  worksOk = () => false, figures = null }) {
  /** @type {null | { seat: any, battle: any, field: any, room: string, side: string, window: number, sentIn: boolean, state: any, retryAt: number, joined: boolean, honours: any, tries: number, mint: any, awayAt: number|null, kind: string, walls: number, points: any }} */
  let s = null;
  async function ask() {
    if (!s) return;
    const at = s;
    const r = await pass(s.seat, s.field);
    if (s !== at) return;   // AUDIT-SEATS C1: left, or entered afresh, while it was asked
    if (!r?.ok) {
      // AUDIT-SEATS C3: said once, asked again on a backing-off wait
      if (r?.error === 'field-unsettled') { s.tries++; s.retryAt = nowMs() + passRetryMs(s.tries); if (s.tries === 1) say(r.text); return; }
      say(SIEGE_SESSION_TEXT.refused(r?.text ?? 'it is not open'));
      api.leave({ quiet: true });
      return;
    }
    s.side = r.side; s.window = Number(r.window) * 1000;
    s.room = siegeRoomKey(s.seat.key, r.week);
    // SEAT2b part two: what the battle froze, off its pass - its kind, the Walls (a defender's wave), its settled field
    // (where the works stand); an unreadable one (an older service's word, a test's) leaves the Seat tab's kind and this
    // game's own field
    const p = readSiegePass(r.pass);
    s.kind = p?.sn ?? s.kind;
    s.walls = Array.isArray(p?.sx) ? p.sx[0] : 0;
    s.points = siegeWorksPoints(fieldOf(p?.sf ?? s.field, p?.st ?? s.battle?.tier, s.kind));
    // AUDIT-SEATS C2: this session's own mint, kept, so a leave clears the slot only while it is still this one's
    s.mint = async () => { const again = await pass(at.seat, at.field); return again?.ok ? again.pass : null; };
    online.mintSiegePass = s.mint;
    s.joined = true;
    say(s.kind === 'revolt' ? SIEGE_SESSION_TEXT.revolt(r.side) : SIEGE_SESSION_TEXT.entered(r.side));
  }
  /** SEAT2b part two: whether this fighter may strike a figure or a work `id` now - the relay knows them, the side rule
   *  allows it (siegeLink.js siegeStrikesAt - a spectator's side strikes nothing), and it stands: a figure up, the
   *  Gatehouse with vitality left (it is BREACHED at nought, for good - the contract's item 2), a Ram with vitality left. */
  function strikesWork(id) {
    if (!s || !worksOk() || !siegeStrikesAt(s.side, id)) return false;
    const w = s.state.works;
    if (id === '~gate') return !!w?.g && w.g[0] > 0;
    if (id === '~ram') return !!w?.r && w.r[0] > 0;
    const f = s.state.figures.find((x) => x.id === id);
    return !!f && !f.down;
  }
  const api = {
    /** The room the world must stand in while a battle is entered, else null (scenes/world.js keeps its own then). */
    room: () => (s?.joined ? s.room : null),
    active: () => !!s,
    side: () => s?.side ?? null,
    /** Enter `seat`'s battle - `battle` the Seat tab's (its kind, tier and two guilds), `field` the pass's `sf` this game
     *  derived (null: the player is not in the town). */
    enter(seat, battle, field) {
      if (!relayOk()) { say(SIEGE_SESSION_TEXT.old); return false; }
      if (!field) { say(SIEGE_SESSION_TEXT.notHere(seat?.name ?? 'the town')); return false; }
      if (s?.mint && online.mintSiegePass === s.mint) online.mintSiegePass = null;   // AUDIT-SEATS C2: entered afresh - the old pass's mint goes
      figures?.clear();   // SEAT2b part two: another battle's figures go with it
      s = { seat, battle, field, room: '', side: 'watch', window: 0, sentIn: false, state: SIEGE_STATE_EMPTY, retryAt: 0, joined: false, honours: undefined, tries: 0, mint: null, awayAt: null,
        kind: battle?.kind ?? 'siege', walls: 0, points: null };
      ask();
      return true;
    },
    /** Leave it (`quiet`: no word; `words` another word than the plain one) - the world's room is the world's again.
     *  AUDIT-SEATS C1: true when there was a battle to leave. @param {{ quiet?: boolean, words?: string }} [o] */
    leave({ quiet = false, words = SIEGE_SESSION_TEXT.left } = {}) {
      if (!s) return false;
      const mint = s.mint;
      s = null;
      if (mint && online.mintSiegePass === mint) online.mintSiegePass = null;   // AUDIT-SEATS C2: another battle's mint is not this one's to clear
      hud?.hide();
      figures?.clear();   // SEAT2b part two: every figure and work drawn, freed
      if (!quiet) say(words);
      return true;
    },
    /** A word from the battle's room (net/online.js onSiege). */
    onSiege(g, room) {
      if (!s || room !== s.room) return;
      s.state = foldSiege(s.state, g, nowMs());
      if (g.k === 'back') movePlayer(g.p);
      if (g.k === 'up' && g.id === online.id && g.p) movePlayer(g.p);
      if (g.k === 'no') say(g.m);
      if (g.k === 'end' && g.rc && readSiegeReceipt(g.rc) && claims) {
        claims.keep(g.rc);
        claims.offer({ force: true });
      }
    },
    /** The service's answer to this fighter's claim (net/siegeClaims.js onClaimed) - its Honours on the card. AUDIT-SEATS
     *  C7: every settling answer - a refusal's words in the Honours' place (net/siegeLink.js siegeClaimRefusal) - and only
     *  this battle's own receipt's (`receipt`: an older battle's, settling now, is not this card's). */
    claimed(answer, receipt = null) {
      if (!s || (receipt != null && s.state.receipt != null && receipt !== s.state.receipt)) return;
      // SEAT2b part two: a revolt's refusal in its own words (none speaks of Honours - siegeLink.js revoltClaimRefusal)
      s.honours = answer?.ok === false ? (s.kind === 'revolt' ? revoltClaimRefusal : siegeClaimRefusal)(answer) : (answer?.data?.honours ?? answer?.honours ?? null);
    },
    /** Each frame: the pass asked again while the field settles, `in` said once on an open socket, the HUD drawn, the
     *  battle left when its window has closed. AUDIT-SEATS C1: and left once the player has been away from the seat's
     *  town BATTLE_AWAY_MS, or its socket has closed for good; the HUD drawn only in the battle's own room. SEAT2b part
     *  two: the figures and the works stood in the town only there too - cleared anywhere else. */
    tick() {
      if (!s) return;
      const now = nowMs();
      if (here(s.seat)) s.awayAt = null;
      else if (s.awayAt == null) s.awayAt = now;
      else if (now - s.awayAt >= BATTLE_AWAY_MS) { api.leave({ words: SIEGE_SESSION_TEXT.away(s.seat?.name ?? 'the town') }); return; }
      if (!s.joined) { if (s.retryAt && now >= s.retryAt) { s.retryAt = 0; ask(); } return; }
      if (s.window && now >= s.window) { api.leave(); return; }
      if (online.room !== s.room) { s.sentIn = false; hud?.hide(); figures?.clear(); return; }
      if (online.terminal) { api.leave({ words: SIEGE_SESSION_TEXT.closed }); return; }
      const open = online.status === 'open';
      if (!open) s.sentIn = false;
      else if (!s.sentIn) s.sentIn = online.sendSiege({ k: 'in' });
      hud?.update(siegeHudModel(s.state, { seat: s.seat?.name, kind: s.kind, tier: s.battle?.tier, attacker: s.battle?.attackerGuild, defender: s.battle?.defenderGuild }, online.id, now,
        { watching: s.side === 'watch', honours: s.honours, claimable: !!s.state.receipt && s.honours === undefined, walls: s.walls }));
      figures?.frame(s.state, { points: s.points, now });
    },
    /** Whether a peer is this fighter's foe (a fighter of the other side). */
    isFoe(id) {
      if (!s || s.side === 'watch') return false;
      const f = s.state.roll[id];
      return !!f && !!f.side && f.side !== s.side && !f.down;
    },
    /** The peers this fighter may strike. */
    foes() { return s && s.side !== 'watch' ? Object.keys(s.state.roll).filter((id) => api.isFoe(id)) : []; },
    /** AUDIT-SEATS G5: the side-mates standing this fighter may heal (not itself - a self-heal is the save's own). */
    mates() { return s && s.side !== 'watch' ? Object.keys(s.state.roll).filter((id) => id !== online.id && s.state.roll[id].side === s.side && !s.state.roll[id].down) : []; },
    /** SEAT2b part two: whether this fighter may strike `id` - a foe of the roll call, or a figure or a work of the other
     *  side's while it stands, at a relay that knows them. */
    canStrike: (id) => (isSiegeFigure(id) || isSiegeWork(id) ? strikesWork(id) : api.isFoe(id)),
    /** SEAT2b part two: whether a harmful spell of this fighter's may land on `id` - a foe or a figure, never a work (a spell
     *  harms no stone or timber - net/wire.js validSiegeIn's own rule). */
    canCast: (id) => !isSiegeWork(id) && api.canStrike(id),
    /** SEAT2b part two: the figures and the works this fighter may strike now (scenes/world.js stands their bodies). */
    targets() { return s ? [...s.state.figures.map((f) => f.id), '~gate', '~ram'].filter((id) => strikesWork(id)) : []; },
    /** A blow on a foe, to the referee (net/wire.js validSiegeIn's `blow`). True when it left. SEAT2b part two: or on a
     *  figure or a work it may strike. */
    blow(to, { w, m, d, r }) { return !!s && api.canStrike(to) && online.sendSiege({ k: 'blow', to, w, m, d, r }); },
    /** A cast on a peer - a harmful one on a foe, a heal on a side-mate. SEAT2b part two: a harmful one on a figure it may
     *  strike; never a heal at a figure, never anything at a work. */
    cast(to, d, heal = false) {
      if (!s || s.side === 'watch') return false;
      if (isSiegeFigure(to)) return !heal && api.canCast(to) && online.sendSiege({ k: 'cast', to, d, h: 0 });
      const f = s.state.roll[to];
      if (!f || (heal ? f.side !== s.side : !api.isFoe(to))) return false;
      return online.sendSiege({ k: 'cast', to, d, h: heal ? 1 : 0 });
    },
    /** This fighter has fallen (it waits for its wave). */
    down: () => !!s && !!s.state.roll[online.id]?.down,
    /** The state, for the pins. */
    get state() { return s?.state ?? null; },
  };
  return api;
}
