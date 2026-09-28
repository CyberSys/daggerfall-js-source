// @ts-check
// NOTICE1 (2026-09-28, Mac: "The new notice board should be a physical object that houses quests, the player auction
// house, etc"): THE NOTICE BOARD'S WINDOW - a corkboard of pinned parchment in the Enhanced Plus stone and brass
// (PROF0 10.1). Each note is a card with a pin and a wax seal whose colour says who posted it; a press opens it large.
//
// WHAT HANGS THERE, top to bottom (the Notices tab - the Work tab comes with PROF1's writs, the others with their
// slices, so no tab stands empty):
//   1. the town's rumour, pinned first - DFU's own sign, its rows as the rumour mill composed them (systems/
//      bulletinBoard.js, ROAD A9), under the town seal;
//   2. in a town with a bounty board, the line that sends the reader to it (BOUNTY1's hunts are the other boards');
//   3. the server's word under the red seal - today's Oblivion Gate while it stands, and the developers' notices;
//   4. the players' notes, newest first - a guild's recruitment under its own seal.
// A note's one button answers its author through a door that already stands (net/boardLaw.js NOTE_BUTTONS); the host
// decides which (`answer`).
//
// THE HOUSE'S SHAPE, as the bounty board's (ui/bountyWindow.js) and the Broker's before it: a lazy chunk the door
// (ui/noticeDoor.js) mounts in its own host - `mountNoticeBoard(host, deps)` answers `{ repaint, unmount }` - the back
// key and a tap on the scrim leave through the door's own close. On the classic skins the window lays its own sheet,
// the kit's rules cut to its selectors, so it wears the Enhanced Plus stone whichever UI is chosen (online forces the
// enhanced lane, never necessarily its Plus face).
import { closeOnOutsideTap } from './enhancedOverlays.js';
import { overlayAction, isTextEntryTarget } from './input.js';
import { injectEnhancedStyle, injectEnhancedFonts } from './enhancedStyle.js';
import { NOTICE_CSS } from './enhancedPlusStyle.js';
import { frameCss } from './enhancedFrame.js';
import { isEnhancedPlus } from '../systems/uiSkin.js';
import { scopeRules } from './brokerWindow.js';
import {
  NOTE_DAYS, NOTE_BUTTONS, NOTE_BUTTON_LABEL, NOTE_SUBJECT_MAX, NOTE_BODY_MAX, NOTE_LINES_MAX, NOTICE_DAYS_MAX,
  BOUNTY_BOARD_LINE, noteIsNew,
} from '../net/boardLaw.js';

/** @param {string} tag @param {string|null} [cls] @param {string|null} [text] */
const el = (tag, cls = null, text = null) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const button = (cls, text, onPress) => {
  const b = /** @type {HTMLButtonElement} */ (el('button', `act ${cls}`, text));
  b.setAttribute('type', 'button');
  b.onclick = (e) => { e.stopPropagation(); onPress(); };
  return b;
};

/** The seal a card wears - who posted it. */
export const NOTICE_SEALS = Object.freeze({ town: 'The town', bounty: 'The bounty board', server: 'The server', player: 'A player', guild: 'A guild' });
/** "2 days left", "5 hours left", "under an hour left". */
export function timeLeftText(expiresAt, nowS) {
  const s = Math.max(0, (Number(expiresAt) || 0) - nowS);
  if (s >= 86400) { const d = Math.floor(s / 86400); return `${d} day${d === 1 ? '' : 's'} left`; }
  if (s >= 3600) { const h = Math.floor(s / 3600); return `${h} hour${h === 1 ? '' : 's'} left`; }
  return 'under an hour left';
}
/** The first lines of a body, for its card - the whole is for the card opened large. */
export const snippetOf = (body, lines = 4) => String(body ?? '').split('\n').filter((l) => l.trim()).slice(0, lines).join('\n');

/**
 * The cards of a board, in the order they hang (the header's four arms, above). Pure over what the window is handed.
 * @param {{ town:{name:string}, rumour?:string[], bountyLine?:boolean, gate?:({subject:string, body:string}|null),
 *   board?:any, seenAt?:number|null }} o
 */
export function noticeCards({ town, rumour = [], bountyLine = false, gate = null, board = null, seenAt = null }) {
  const cards = [];
  const lines = (rumour ?? []).map((l) => String(l ?? '').trim()).filter(Boolean);
  if (lines.length) cards.push({ key: 'rumour', seal: 'town', subject: `News of ${town.name || 'the town'}`, body: lines.join('\n') });
  if (bountyLine) cards.push({ key: 'bounty', seal: 'bounty', subject: 'Bounties', body: BOUNTY_BOARD_LINE });
  if (gate) cards.push({ key: 'gate', seal: 'server', subject: gate.subject, body: gate.body });
  for (const n of board?.notices ?? []) {
    cards.push({ key: `notice:${n.id}`, seal: 'server', subject: n.subject, body: n.body, from: n.from, at: n.at, expiresAt: n.expiresAt, notice: n, isNew: noteIsNew(n, seenAt) });
  }
  for (const n of board?.notes ?? []) {
    cards.push({ key: `note:${n.id}`, seal: n.guild ? 'guild' : 'player', subject: n.subject, body: n.body, from: n.from, at: n.at, expiresAt: n.expiresAt, note: n, isNew: noteIsNew(n, seenAt) });
  }
  return cards;
}

export const NOTICE_SKIN_STYLE_ID = 'notice-skin-style';
/** The window's own sheet for the classic skins: its layout and the kit's rules cut to its selectors. */
export const noticeSkinCss = () => [NOTICE_CSS, scopeRules(frameCss(), (sel) => sel.includes('notice'))].join('\n');
function injectSkin(doc = document) {
  if (isEnhancedPlus() || doc.getElementById?.(NOTICE_SKIN_STYLE_ID)) return;
  const st = doc.createElement('style');
  st.id = NOTICE_SKIN_STYLE_ID;
  st.textContent = noticeSkinCss();
  (doc.head ?? doc.body).append(st);
}

/**
 * THE BOARD.
 * @param {HTMLElement} host
 * @param {{
 *   town: { name: string, mapId: number },
 *   rumour?: string[], bountyLine?: boolean, gate?: () => ({subject:string, body:string}|null),
 *   book: any,
 *   answer?: (note: any) => ({ ok: boolean, text?: string } | void),
 *   character?: () => (string|null),
 *   nowS?: () => number,
 *   onExit?: (() => void) | null,
 * }} deps
 */
export function mountNoticeBoard(host, deps) {
  const exit = () => deps.onExit?.();
  const nowS = deps.nowS ?? (() => Math.floor(Date.now() / 1000));
  const map = deps.town.mapId;
  injectEnhancedStyle();
  injectEnhancedFonts();
  injectSkin();
  const shell = el('div', 'notice-shell');
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-label', `Notice board of ${deps.town.name}`);
  const win = el('div', 'notice-win');
  shell.append(win);
  host.append(shell);

  let view = 'board';   // 'board' | 'read' | 'pin' | 'notice'
  let reading = null;   // the card read large
  let word = null;      // { ok, text } - the status line
  let board = null, stale = false, error = null, busy = false;
  const seenAtOpen = deps.book.seenAt(map);   // what was new when the window opened stays marked new while it is up
  let alive = true;
  // AUDIT 28 N13: the book keeps what is being written, for the session - a stray tap outside throws nothing away
  const draft = deps.book.draft?.(map) ?? { subject: '', body: '', days: NOTE_DAYS[NOTE_DAYS.length - 1], button: '' };
  const noticeDraft = deps.book.noticeDraft?.() ?? { subject: '', body: '', days: 3 };

  const back = () => { if (view === 'board') exit(); else { view = 'board'; reading = null; render(); } };
  const onKey = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTextEntryTarget(e.target) && e.key !== 'Escape') return;   // a field's keys are the field's
    if (e.key === 'Escape' || overlayAction(e) === 'back') { e.preventDefault(); e.stopPropagation(); back(); }
  };
  globalThis.addEventListener('keydown', onKey, { capture: true });
  const offOutside = closeOnOutsideTap(shell, '.notice-win', exit);

  async function load(force = false) {
    busy = true; render();
    const r = await deps.book.read(map, { force });
    if (!alive) return;
    busy = false;
    board = r.board; stale = !!r.stale; error = r.error;
    if (board) deps.book.markSeen(map);
    render();
  }

  /** One act at a time (AUDIT 28 N9: a double press of Report or Take it down sent it twice, and the second's "no such
   *  note" overwrote the first's word). `start` is called only when nothing else is under way. */
  async function act(start, after = 'board') {
    if (busy) return;
    busy = true; render();
    const r = await start();
    if (!alive) return;
    busy = false;
    word = { ok: !!r?.ok, text: r?.text ?? '' };
    if (r?.ok) { board = deps.book.cached(map) ?? board; view = after; reading = null; deps.book.markSeen(map); }
    render();
  }

  const me = () => board?.me ?? { canPin: false, live: 0, max: 3, moderator: false, developer: false };

  function header() {
    const head = el('header', 'notice-head');
    const title = el('div', 'notice-title');
    const notes = board?.notes?.length ?? 0;
    const sub = board
      ? `${notes} note${notes === 1 ? '' : 's'} pinned here${me().canPin ? ` · you have ${me().live} of ${me().max} up` : ''}`
      : (busy ? 'Reading the board...' : '');
    title.append(el('h2', null, `Notice Board of ${deps.town.name}`), el('p', 'notice-sub', sub));
    const line = el('p', `notice-word${word?.ok ? ' ok' : ''}`, word?.text ?? (stale ? 'The board may be out of date - the counting-house is slow to answer.' : ''));
    line.setAttribute('aria-live', 'polite');
    title.append(line);
    const acts = el('div', 'notice-headacts');
    if (view === 'board' && me().canPin && me().live < me().max) acts.append(button('primary notice-pinbtn', 'Pin a note', () => { view = 'pin'; word = null; render(); }));
    if (view === 'board' && me().developer) acts.append(button('notice-noticebtn', 'Post a notice', () => { view = 'notice'; word = null; render(); }));
    acts.append(button('notice-close', view === 'board' ? 'Close' : 'Back', back));
    head.append(title, acts);
    const tabs = el('nav', 'notice-tabs');
    const t = el('span', 'notice-tab on', 'Notices');
    t.setAttribute('aria-current', 'page');
    tabs.append(t);
    return [head, tabs];
  }

  function cardNode(c, i) {
    const li = el('li', `notice-card seal-${c.seal}${c.isNew ? ' new' : ''}${c.note?.hidden ? ' hidden' : ''}`);
    li.style.setProperty('--tilt', `${((i * 37) % 5) - 2}deg`);
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.append(el('span', 'notice-pin'), el('h4', null, c.subject), el('p', 'notice-snippet', snippetOf(c.body)));
    const foot = el('div', 'notice-foot');
    foot.append(el('span', 'notice-from', c.from ? `- ${c.from}` : NOTICE_SEALS[c.seal]));
    if (c.isNew) foot.append(el('span', 'notice-new', 'new'));
    li.append(foot, el('span', 'notice-seal', ''));
    const open = () => { reading = c; view = 'read'; word = null; render(); };
    li.onclick = open;
    li.onkeydown = (e) => { if (e.target === li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault?.(); open(); } };
    return li;
  }

  function boardBody() {
    const body = el('div', 'notice-body');
    const cards = noticeCards({ town: deps.town, rumour: deps.rumour, bountyLine: deps.bountyLine, gate: deps.gate?.() ?? null, board, seenAt: seenAtOpen });
    const grid = el('ul', 'notice-grid');
    grid.setAttribute('role', 'list');
    cards.forEach((c, i) => grid.append(cardNode(c, i)));
    if (!board && !busy && error) {
      // AUDIT 28 N11: a board closed to this account says so - the next press is DFU's own sign again
      grid.append(el('li', 'notice-empty', error === 'board-closed' || error === 'no-session' || error === 'auth'
        ? 'The Notice Board is not open to you. The town\'s own news is all it shows.'
        : 'The counting-house is not answering. The town\'s own news is all the board shows now.'));
    }
    else if (board && !(board.notes?.length)) grid.append(el('li', 'notice-empty', me().canPin ? 'No player has pinned a note here. Yours could be the first.' : 'No player has pinned a note here.'));
    body.append(grid);
    return body;
  }

  function readBody() {
    const c = reading;
    const body = el('div', 'notice-body');
    const card = el('article', `notice-read seal-${c.seal}`);
    card.append(el('span', 'notice-pin'), el('h3', null, c.subject));
    const n = c.note;
    if (n?.guild) card.append(el('p', 'notice-guild', `Recruiting for <${n.guild.tag}> ${n.guild.name}`));
    card.append(el('p', 'notice-text', c.body));
    const meta = el('p', 'notice-meta');
    meta.textContent = [c.from ? `Posted by ${c.from}${n?.title ? `, ${n.title}` : ''}` : NOTICE_SEALS[c.seal], c.expiresAt ? timeLeftText(c.expiresAt, nowS()) : ''].filter(Boolean).join(' · ');
    card.append(meta);
    if (!me().moderator && n?.mine && n.hidden) card.append(el('p', 'notice-mod', 'Reports have hidden this note from other readers until a moderator looks at it. You may take it down.'));   // AUDIT 28 N2
    if (me().moderator && n?.hidden) card.append(el('p', 'notice-mod', `Hidden by ${n.reports} report${n.reports === 1 ? '' : 's'} · note ${n.id}`));
    else if (me().moderator && n) card.append(el('p', 'notice-mod', `Note ${n.id}${n.reports ? ` · ${n.reports} report${n.reports === 1 ? '' : 's'}` : ''}`));
    const acts = el('div', 'notice-acts');
    if (n && n.button && !n.mine && deps.answer) {
      const b = button('primary notice-answer', NOTE_BUTTON_LABEL[n.button] ?? 'Answer', () => {
        const r = deps.answer?.(n);
        if (r && r.ok === false) { word = { ok: false, text: r.text ?? '' }; render(); }
      });
      if (!me().canPin) { b.disabled = true; b.title = 'A registered account answers a note'; }
      acts.append(b);
    }
    if (n?.mine) acts.append(button('notice-takedown', 'Take it down', () => act(() => deps.book.takeDown(map, n.id))));
    if (n && !n.mine && me().canPin) acts.append(button('notice-report', 'Report', () => act(() => deps.book.report(map, n.id))));
    if (n && me().moderator) {
      if (n.hidden) acts.append(button('notice-restore', 'Restore', () => act(() => deps.book.modRestore(map, n.id))));
      acts.append(button('notice-remove', 'Remove', () => act(() => deps.book.modRemove(map, n.id))));
    }
    if (c.notice && me().developer) acts.append(button('notice-remove', 'Take the notice down', () => act(() => deps.book.noticeRemove(map, c.notice.id))));
    card.append(acts);
    body.append(card);
    return body;
  }

  function field(label, input, count = null) {
    const f = el('label', 'notice-field');
    f.append(el('span', 'notice-label', label), input);
    if (count) f.append(count);
    return f;
  }

  function pinBody() {
    const body = el('div', 'notice-body');
    const form = el('form', 'notice-form');
    const subject = /** @type {HTMLInputElement} */ (el('input', 'notice-input'));
    subject.maxLength = NOTE_SUBJECT_MAX; subject.value = draft.subject; subject.placeholder = 'What is it about?';
    const text = /** @type {HTMLTextAreaElement} */ (el('textarea', 'notice-textarea'));
    text.maxLength = NOTE_BODY_MAX; text.value = draft.body; text.rows = 7; text.placeholder = 'Your note, as the town will read it.';
    const counted = el('span', 'notice-count', `${draft.body.length} / ${NOTE_BODY_MAX}`);
    subject.oninput = () => { draft.subject = subject.value; };
    text.oninput = () => { draft.body = text.value; counted.textContent = `${text.value.length} / ${NOTE_BODY_MAX}${text.value.split('\n').length > NOTE_LINES_MAX ? ` - at most ${NOTE_LINES_MAX} lines` : ''}`; };
    const days = /** @type {HTMLSelectElement} */ (el('select', 'notice-select'));
    for (const d of NOTE_DAYS) { const o = /** @type {HTMLOptionElement} */ (el('option', null, `${d} day${d === 1 ? '' : 's'}`)); o.value = String(d); if (d === draft.days) o.selected = true; days.append(o); }
    days.onchange = () => { draft.days = Number(days.value); };
    const btn = /** @type {HTMLSelectElement} */ (el('select', 'notice-select'));
    for (const k of ['', ...NOTE_BUTTONS]) { const o = /** @type {HTMLOptionElement} */ (el('option', null, k ? NOTE_BUTTON_LABEL[k] : 'No button')); o.value = k; if (k === draft.button) o.selected = true; btn.append(o); }
    btn.onchange = () => { draft.button = btn.value; };
    form.append(field('Subject', subject), field('Note', text, counted), field('Stands for', days), field('A button for the reader', btn));
    form.append(el('p', 'notice-hint', 'A recruitment button needs a guild rank that may invite. The reader\'s answer comes to you as a letter.'));
    const acts = el('div', 'notice-acts');
    const pin = button('primary notice-dopin', busy ? 'Pinning...' : 'Pin it up', () => {
      act(() => deps.book.pin(map, { subject: draft.subject, body: draft.body, days: draft.days, button: draft.button || null, character: deps.character?.() ?? null }))
        .then(() => { if (word?.ok) { draft.subject = ''; draft.body = ''; draft.button = ''; } });
    });
    acts.append(pin);
    form.onsubmit = (e) => { e.preventDefault(); };
    form.append(acts);
    body.append(form);
    setTimeout(() => subject.focus?.(), 0);
    return body;
  }

  function noticeBody() {
    const body = el('div', 'notice-body');
    const form = el('form', 'notice-form');
    const subject = /** @type {HTMLInputElement} */ (el('input', 'notice-input'));
    subject.maxLength = NOTE_SUBJECT_MAX; subject.value = noticeDraft.subject;
    const text = /** @type {HTMLTextAreaElement} */ (el('textarea', 'notice-textarea'));
    text.maxLength = NOTE_BODY_MAX; text.value = noticeDraft.body; text.rows = 6;
    const days = /** @type {HTMLInputElement} */ (el('input', 'notice-input notice-days'));
    days.type = 'number'; days.min = '1'; days.max = String(NOTICE_DAYS_MAX); days.value = String(noticeDraft.days);
    subject.oninput = () => { noticeDraft.subject = subject.value; };
    text.oninput = () => { noticeDraft.body = text.value; };
    days.oninput = () => { noticeDraft.days = Number(days.value); };
    form.append(field('Subject', subject), field('Notice', text), field(`Days (1 to ${NOTICE_DAYS_MAX})`, days));
    form.append(el('p', 'notice-hint', 'The server\'s word, under the red seal, on every board.'));
    const acts = el('div', 'notice-acts');
    acts.append(button('primary notice-dopost', 'Post on every board', () => {
      // AUDIT 28 N7: posted, the draft is spent - a second press never puts the same notice up twice
      act(() => deps.book.notice(map, { ...noticeDraft })).then(() => { if (word?.ok) { noticeDraft.subject = ''; noticeDraft.body = ''; } });
    }));
    form.onsubmit = (e) => { e.preventDefault(); };
    form.append(acts);
    body.append(form);
    return body;
  }

  function render() {
    if (!alive) return;
    win.replaceChildren();
    win.append(...header());
    win.append(view === 'read' && reading ? readBody() : view === 'pin' ? pinBody() : view === 'notice' ? noticeBody() : boardBody());
  }

  render();
  load(false);
  return {
    repaint: () => render(),
    unmount() {
      if (!alive) return;
      alive = false;
      globalThis.removeEventListener('keydown', onKey, { capture: true });
      offOutside();
      shell.remove();
    },
  };
}
