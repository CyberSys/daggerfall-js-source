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
import { siegeRoomKey } from './siegeRef.js';
import { foldSiege, siegeHudModel, SIEGE_STATE_EMPTY } from './siegeLink.js';
import { readSiegeReceipt } from './siegeReceipt.js';

/** How long an unsettled field waits before the pass is asked again, ms. */
export const SIEGE_PASS_RETRY_MS = 5000;
/** The words. */
export const SIEGE_SESSION_TEXT = Object.freeze({
  notHere: (town) => `Go to ${town} to fight for it - the battle is fought in the town itself.`,
  old: 'The server does not fight sieges yet.',
  entered: (side) => (side === 'watch' ? 'You are watching the battle. Nothing you do reaches it.' : `You fight for the ${side === 'attack' ? 'attackers' : 'defenders'}. Make for your camp's banner.`),
  left: 'You have left the battle.',
  refused: (why) => `The battle would not have you: ${why}`,
});

/**
 * THE SESSION. `online` (net/online.js), `pass(seat, field)` and `claim(receipt)` the book's (net/townSeatBook.js
 * siegePass, claimSiege), `claims` (net/siegeClaims.js, or null), `hud` (ui/siegeHud.js createSiegeHud, or null),
 * `nowMs()`, `movePlayer(pose)` (a wire pose: natives on x and z), `say(text)`, `relayOk()` the relay fights battles.
 * @param {{ online: any, pass: (seat: any, field: any) => Promise<any>, claims?: any, hud?: any, nowMs?: () => number,
 *   movePlayer?: (p: any) => void, say?: (t: string) => void, relayOk?: () => boolean }} deps
 */
export function createSiegeSession({ online, pass, claims = null, hud = null, nowMs = () => Date.now(), movePlayer = () => {}, say = () => {}, relayOk = () => true }) {
  /** @type {null | { seat: any, battle: any, field: any, room: string, side: string, window: number, sentIn: boolean, state: any, retryAt: number, joined: boolean, honours: any }} */
  let s = null;
  async function ask() {
    if (!s) return;
    const r = await pass(s.seat, s.field);
    if (!s) return;
    if (!r?.ok) {
      if (r?.error === 'field-unsettled') { s.retryAt = nowMs() + SIEGE_PASS_RETRY_MS; say(r.text); return; }
      say(SIEGE_SESSION_TEXT.refused(r?.text ?? 'it is not open'));
      api.leave({ quiet: true });
      return;
    }
    s.side = r.side; s.window = Number(r.window) * 1000;
    s.room = siegeRoomKey(s.seat.key, r.week);
    online.mintSiegePass = async () => { const again = await pass(s?.seat, s?.field); return again?.ok ? again.pass : null; };
    s.joined = true;
    say(SIEGE_SESSION_TEXT.entered(r.side));
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
      s = { seat, battle, field, room: '', side: 'watch', window: 0, sentIn: false, state: SIEGE_STATE_EMPTY, retryAt: 0, joined: false, honours: undefined };
      ask();
      return true;
    },
    /** Leave it (`quiet`: no word) - the world's room is the world's again. */
    leave({ quiet = false } = {}) {
      if (!s) return;
      s = null;
      online.mintSiegePass = null;
      hud?.hide();
      if (!quiet) say(SIEGE_SESSION_TEXT.left);
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
    /** The service's answer to this fighter's claim (net/siegeClaims.js onClaimed) - its Honours on the card. */
    claimed(answer) { if (s) s.honours = answer?.data?.honours ?? answer?.honours ?? null; },
    /** Each frame: the pass asked again while the field settles, `in` said once on an open socket, the HUD drawn, the
     *  battle left when its window has closed. */
    tick() {
      if (!s) return;
      const now = nowMs();
      if (!s.joined) { if (s.retryAt && now >= s.retryAt) { s.retryAt = 0; ask(); } return; }
      if (s.window && now >= s.window) { api.leave(); return; }
      const open = online.room === s.room && online.status === 'open';
      if (!open) s.sentIn = false;
      else if (!s.sentIn) s.sentIn = online.sendSiege({ k: 'in' });
      hud?.update(siegeHudModel(s.state, { seat: s.seat?.name, kind: s.battle?.kind, tier: s.battle?.tier, attacker: s.battle?.attackerGuild, defender: s.battle?.defenderGuild }, online.id, now,
        { watching: s.side === 'watch', honours: s.honours, claimable: !!s.state.receipt && s.honours === undefined }));
    },
    /** Whether a peer is this fighter's foe (a fighter of the other side). */
    isFoe(id) {
      if (!s || s.side === 'watch') return false;
      const f = s.state.roll[id];
      return !!f && !!f.side && f.side !== s.side && !f.down;
    },
    /** The peers this fighter may strike. */
    foes() { return s && s.side !== 'watch' ? Object.keys(s.state.roll).filter((id) => api.isFoe(id)) : []; },
    /** A blow on a foe, to the referee (net/wire.js validSiegeIn's `blow`). True when it left. */
    blow(to, { w, m, d, r }) { return !!s && api.isFoe(to) && online.sendSiege({ k: 'blow', to, w, m, d, r }); },
    /** A cast on a peer - a harmful one on a foe, a heal on a side-mate. */
    cast(to, d, heal = false) {
      if (!s || s.side === 'watch') return false;
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
