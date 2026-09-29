// DA8 (2026-09-29, Mac: "How can we drastically improve the install
// experience? Is there anyway to send a notification that a new update is
// available ... A launcher? I really want to make it AAA grade"):
// THE LAUNCHER'S PURE HALF - what the first window is doing, what it says,
// and what happens next.
//
// WHY A LAUNCHER, AND WHY THIS ONE. The shell opened straight into the
// game and updated on QUIT (DA7). With a release on every merge - eleven
// on 2026-09-28 alone - a player launched into the build before the last
// one nearly every time, and online that means a client a protocol behind
// the relay it is talking to (world117 to world125 in three days). They
// were never told an update existed, arrived, or what it changed. And the
// first run was a bare OS folder dialog before any window.
//
// A separate launcher PROGRAM would fix none of that and add a second
// thing to install, sign and update - the updates themselves are already
// small (a Windows update between two releases is ~4.5 MB of a 208 MB
// installer: electron-updater's blockmap delta, measured off the releases'
// own blockmaps). So the launcher is the shell's FIRST WINDOW, the way
// Discord's is: it checks, updates BEFORE play when it can (the download
// shown, the install silent, the app reopening itself), says what changed,
// finds the player's Daggerfall files, and hands over to the game. When
// there is nothing to decide it is a moment's splash; it waits only when
// the player has something to do.
//
// Pure, no Electron: the shell (app/main.cjs) feeds events in and renders
// `viewOf` into app/launcher/, and test/da8_launcher.test.js drives every
// screen and transition here.
'use strict';

const { parseReleaseTag, parseVersion } = require('./updateCheck.cjs');

/** How long the launcher waits on a silent network before it lets the
 *  player in. A launch that hangs on GitHub is worse than one a build
 *  behind (DA6's failure direction: silence). */
const CHECK_TIMEOUT_MS = 8000;
/** How often a running copy asks again - a long session hears of a
 *  release within the hour. */
const RECHECK_MS = 60 * 60 * 1000;
/** The most releases' notes "What's new" lists. */
const NOTES_MAX = 8;
/** How long "Installing" stays on screen before the app closes for the
 *  installer - long enough to read that it will reopen by itself. */
const INSTALL_NOTICE_MS = 1500;
/** How long the launcher waits for the installer to close the app before
 *  it decides the install never started, and lets the player in. */
const INSTALL_GIVEUP_MS = 15000;

/** Where a found ARENA2 came from, in the player's words. */
const SOURCE_LABEL = Object.freeze({
  dfu: 'from Daggerfall Unity',
  steam: 'Steam',
  gog: 'GOG',
  folder: 'on this computer',
});

/**
 * update.status
 *   skipped     the File-menu checkbox or the probe env turned checks off
 *   checking    asked, no answer yet
 *   current     this is the newest release
 *   offline     no answer (unreachable, an error, or CHECK_TIMEOUT_MS) - play
 *   downloading the updater transport found one and is fetching it
 *   background  the player chose Play now: it downloads on, installs at quit
 *   installing  downloaded: install now, and the app reopens itself
 *   notice      the notice transport found one: Download it, or Play
 *   dismissed   the player chose Play over a notice
 * setup.status
 *   ready    a whole ARENA2 is configured (or the probe skipped the step)
 *   looking  there is none: detection runs
 *   found    detection found whole folders - OFFERED, never picked silently
 *   none     detection found nothing
 *   bad      the folder picked is not a whole ARENA2 (missing: which files,
 *            or null when it held no Daggerfall file at all)
 *   skipped  the player chose the game's own picker - the website's path
 */
function initialState({ current, transport, checkEnabled, arena2Ready, skipArena2, whatsNew = null }) {
  return {
    current: String(current ?? ''),
    transport,
    update: { status: checkEnabled ? 'checking' : 'skipped', version: null, notes: [], percent: 0, transferred: 0, total: 0, download: null },
    setup: { status: arena2Ready || skipArena2 ? 'ready' : 'looking', found: [], missing: null, picked: null },
    whatsNew,
    launching: false,
  };
}

const SETUP_WAITING = new Set(['found', 'none', 'bad']);
const clampPercent = (p) => Math.max(0, Math.min(100, Number(p) || 0));

/** The launcher's state after one event. Events that do not apply to the
 *  state they arrive in change nothing - an update answer after the
 *  timeout, say, is the running game's to hear, not the launcher's. */
function reduce(state, ev) {
  const s = { ...state, update: { ...state.update }, setup: { ...state.setup } };
  const u = s.update, st = s.setup;
  switch (ev?.type) {
    case 'check-none':
      if (u.status === 'checking') u.status = 'current';
      break;
    case 'check-failed':
    case 'check-timeout':
      if (u.status === 'checking') u.status = 'offline';
      break;
    case 'check-available':
      if (u.status !== 'checking') break;
      u.version = ev.version ?? null;
      if (s.transport === 'updater') {
        u.status = 'downloading';
        u.percent = 0; u.transferred = 0; u.total = Number(ev.total) || 0;
      } else {
        u.status = 'notice';
        u.download = ev.download ?? null;
      }
      break;
    case 'notes':
      // they arrive from their own request, whenever it answers
      if (ev.version === u.version && Array.isArray(ev.notes)) u.notes = ev.notes;
      break;
    case 'progress':
      if (u.status === 'downloading') {
        u.percent = clampPercent(ev.percent);
        u.transferred = Number(ev.transferred) || 0;
        u.total = Number(ev.total) || u.total;
      }
      break;
    case 'downloaded':
      if (u.status === 'downloading') { u.status = 'installing'; u.percent = 100; }
      break;
    case 'play-now':
      if (u.status === 'downloading') u.status = 'background';
      break;
    case 'install-failed':
      // the installer never took over (it would have closed the app): play on, and it installs at quit
      if (u.status === 'installing') u.status = 'background';
      break;
    case 'dismiss-notice':
      if (u.status === 'notice') u.status = 'dismissed';
      break;
    case 'found':
      if (st.status === 'looking') {
        st.found = Array.isArray(ev.found) ? ev.found : [];
        st.status = st.found.length ? 'found' : 'none';
      }
      break;
    case 'picked':
      if (SETUP_WAITING.has(st.status) && ev.dir) { st.status = 'ready'; st.picked = ev.dir; st.missing = null; }
      break;
    case 'picked-bad':
      if (SETUP_WAITING.has(st.status)) { st.status = 'bad'; st.missing = Array.isArray(ev.missing) ? ev.missing : null; }
      break;
    case 'skip-setup':
      if (SETUP_WAITING.has(st.status)) st.status = 'skipped';
      break;
    case 'whats-new-seen':
      s.whatsNew = null;
      break;
    case 'launching':
      s.launching = true;
      break;
    default:
      break;
  }
  return s;
}

/**
 * What the shell does next: 'install' (quit and install, reopening), 'detect'
 * (look for ARENA2), 'launch' (open the game), or 'wait' (for an answer, a
 * download, or the player). Updates come first - a folder picked now would
 * survive the restart, but asking it and THEN vanishing for a restart is a
 * worse first minute - then the files, then "What's new", then the game.
 */
function nextStep(s) {
  if (s.launching) return 'wait';
  const u = s.update.status;
  if (u === 'installing') return 'install';
  if (u === 'checking' || u === 'downloading' || u === 'notice') return 'wait';
  const st = s.setup.status;
  if (st === 'looking') return 'detect';
  if (st !== 'ready' && st !== 'skipped') return 'wait';
  if (s.whatsNew) return 'wait';
  return 'launch';
}

const mb = (bytes) => (Math.max(0, Number(bytes) || 0) / 1e6).toFixed(1);

/** The launcher window's whole content, from the state. */
function viewOf(s) {
  const v = { stage: '', title: '', detail: '', progress: null, notesTitle: '', notes: [], found: [], actions: [], version: s.current ? `v${s.current}` : '' };
  const u = s.update, st = s.setup;
  const whatsNewNotes = () => {
    if (!s.whatsNew) return;
    v.notesTitle = "What's new";
    v.notes = s.whatsNew.notes ?? [];
  };
  if (s.launching) {
    v.stage = 'launching';
    v.title = 'Starting Daggerfall Online';
    return v;
  }
  if (u.status === 'installing') {
    v.stage = 'installing';
    v.title = `Installing v${u.version}`;
    v.detail = 'Daggerfall Online will close and reopen by itself in a few seconds. Your saves, settings and game files stay where they are.';
    v.progress = { percent: 100, label: 'Downloaded' };
    v.notesTitle = "What's new"; v.notes = u.notes;
    return v;
  }
  if (u.status === 'downloading') {
    v.stage = 'downloading';
    v.title = `Updating to v${u.version}`;
    v.detail = 'It installs before you play, so you are on the same version as everyone online.';
    v.progress = { percent: u.percent, label: u.total ? `${mb(u.transferred)} of ${mb(u.total)} MB` : 'Starting the download' };
    v.notesTitle = "What's new"; v.notes = u.notes;
    v.actions = [{ id: 'play-now', label: 'Play now, update when I quit' }];
    return v;
  }
  if (u.status === 'notice') {
    v.stage = 'notice';
    v.title = `Version ${u.version} is out`;
    v.detail = `You have v${s.current}. Download it and install it over this copy - your saves, settings and game files stay where they are.`;
    v.notesTitle = "What's new"; v.notes = u.notes;
    v.actions = [{ id: 'download', label: 'Download', primary: true }, { id: 'dismiss', label: 'Play this version' }];
    return v;
  }
  if (u.status === 'checking') {
    v.stage = 'checking';
    v.title = 'Checking for updates';
    whatsNewNotes();
    return v;
  }
  if (st.status === 'looking') {
    v.stage = 'setup-looking';
    v.title = 'Looking for your Daggerfall files';
    return v;
  }
  if (SETUP_WAITING.has(st.status)) {
    v.stage = `setup-${st.status}`;
    v.found = st.found.map((f, index) => ({ index, dir: f.dir, from: SOURCE_LABEL[f.source] ?? '' }));
    const choose = { id: 'choose-folder', label: st.found.length ? 'Choose a different folder' : 'Choose the ARENA2 folder', primary: !st.found.length };
    const skip = { id: 'skip-setup', label: 'Choose in the game instead' };
    if (st.status === 'found') {
      v.title = st.found.length === 1 ? 'Found your Daggerfall files' : 'Found Daggerfall on this computer';
      v.detail = 'Daggerfall Online plays from the original game\'s ARENA2 folder. Nothing is copied or uploaded - it is read where it is.';
      v.actions = [choose, skip];
    } else if (st.status === 'none') {
      v.title = 'Where is Daggerfall?';
      v.detail = 'Daggerfall Online plays from the original game\'s ARENA2 folder. The Elder Scrolls II: Daggerfall has been free since 2009 - get it from Steam or GOG, then choose its ARENA2 folder.';
      v.actions = [choose, { id: 'open', arg: 'steam', label: 'Get it on Steam' }, { id: 'open', arg: 'gog', label: 'Get it on GOG' }, skip];
    } else {
      v.title = 'That folder is not a whole ARENA2';
      v.detail = st.missing
        ? `It has no ${st.missing.join(', ')}. Choose the ARENA2 folder inside your Daggerfall install - on Steam and GOG it is under DF/DAGGER/ARENA2.`
        : 'It holds no Daggerfall files. Choose the ARENA2 folder inside your Daggerfall install - on Steam and GOG it is under DF/DAGGER/ARENA2.';
      v.actions = [{ ...choose, primary: true }, skip];
    }
    return v;
  }
  if (s.whatsNew) {
    v.stage = 'whats-new';
    v.title = `Updated to v${s.whatsNew.version}`;
    whatsNewNotes();
    v.actions = [{ id: 'play', label: 'Play', primary: true }];
    return v;
  }
  v.stage = 'launching';
  v.title = 'Starting Daggerfall Online';
  return v;
}

/** GitHub's generated list of merged changes, which the release body carries
 *  under the patch notes (scripts/desktopRelease.mjs). A player reads the
 *  notes; the list of pull requests is the repository's record. */
const GENERATED_RE = /^(##\s*What['’]s Changed\b|\*\*Full Changelog\*\*|##\s*New Contributors\b)/m;

/** A release body as a player reads it: the patch notes, without the list. */
function playerNotes(body) {
  const text = String(body ?? '').replace(/\r\n/g, '\n');
  const cut = text.search(GENERATED_RE);
  return (cut < 0 ? text : text.slice(0, cut)).trim();
}

/** A release body that says nothing more than "fixes and improvements". */
const isPlaceholder = (t) => /^fixes and improvements\.?$/i.test(t.trim());

/**
 * The notes "What's new" lists for an update from `fromVersion` to
 * `toVersion`: every published app-v release in (from, to], newest first,
 * each as its patch notes. When any of them says something, the bare
 * "Fixes and improvements." releases between are left out; when none does,
 * one such line stands for them all. At most NOTES_MAX.
 *
 * @param {Array<{ tag_name?: string, body?: string, draft?: boolean, prerelease?: boolean }>} releases the API's list
 * @returns {Array<{ version: string, text: string }>}
 */
function notesBetween(releases, fromVersion, toVersion) {
  const from = parseVersion(fromVersion), to = parseVersion(toVersion);
  if (!from || !to || !Array.isArray(releases)) return [];
  const cmp = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  const inRange = releases
    .filter((r) => r && !r.draft && !r.prerelease)
    .map((r) => ({ v: parseReleaseTag(r.tag_name), text: playerNotes(r.body) }))
    .filter((r) => r.v && cmp(r.v, from) > 0 && cmp(r.v, to) <= 0 && r.text)
    .sort((a, b) => cmp(b.v, a.v))
    .map((r) => ({ version: r.v.join('.'), text: r.text }));
  const said = inRange.filter((r) => !isPlaceholder(r.text));
  return (said.length ? said : inRange.slice(0, 1)).slice(0, NOTES_MAX);
}

/**
 * What to do with the "What's new" the last update saved (config.json's
 * whatsNew, written when it downloaded): SHOW it on the launch that runs
 * that version, KEEP it while that version has not installed yet, and drop
 * it once a newer one runs (superseded).
 */
function whatsNewFor(saved, current) {
  const w = parseVersion(saved?.version), c = parseVersion(current);
  if (!w || !c) return { show: null, keep: false };
  const cmp = (() => { for (let i = 0; i < 3; i++) if (w[i] !== c[i]) return w[i] - c[i]; return 0; })();
  if (cmp === 0) return { show: { version: saved.version, notes: Array.isArray(saved.notes) ? saved.notes : [] }, keep: false };
  if (cmp > 0) return { show: null, keep: true };
  return { show: null, keep: false };
}

module.exports = {
  CHECK_TIMEOUT_MS, RECHECK_MS, NOTES_MAX, INSTALL_NOTICE_MS, INSTALL_GIVEUP_MS, SOURCE_LABEL,
  initialState, reduce, nextStep, viewOf, playerNotes, notesBetween, whatsNewFor,
};
