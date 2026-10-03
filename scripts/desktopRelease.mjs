// REL4 (2026-09-29, Mac: "How can we drastically improve the install
// experience? ... I really want to make it AAA grade"): THE RELEASE IS
// PUBLISHED WHOLE, ONCE, WITH NOTES A PLAYER CAN READ.
//
// What the releases looked like before this, read off GitHub:
//
//   - every release's notes stood two or three times over. Each of the
//     three OS legs created-or-updated the SAME release with
//     generate_release_notes on, so each appended its own copy - and
//     where two legs finished within a second of each other, one
//     append was lost to the other's write (app-v0.1.4582's Windows and
//     macOS files landed at 17:46:22 and :23, and the body has two
//     copies, not three). A race, visible in the text.
//   - the release went live the moment the FIRST leg attached its files.
//     app-v0.1.4605 was published at 19:46:32 and its Windows files,
//     latest.yml among them, arrived at 19:47:57: for eighty-five
//     seconds `releases/latest` was a release no Windows copy could
//     update from and no Windows player could download. A leg that died
//     after the gate would have left that state standing until the next
//     merge.
//   - the notes were pull-request titles ("REALM with AUDIT REALM2 and
//     account-wide Renown; main merged, voice chat reverted"), while the
//     player-facing PATCH-NOTES-*.md at the root - written for nearly
//     every merge - reached no one.
//
// So the legs only BUILD now, and one publish job, which runs only when
// every leg passed, checks the set is complete (`check`), writes the
// notes once (`notes`), stages the release as a DRAFT with every file,
// and publishes it in one step - `latest` never names a release that is
// half there. The body is the patch notes the release brings, with
// GitHub's list of merged changes below them for the record; the
// desktop app's launcher shows the same body in its news (DA10).
//
// AUDIT INSTALL (2026-09-29): the notes are read from git's OWN OBJECTS,
// never the working tree - a PATCH-NOTES file committed as a symlink to
// .git/config would have published the checkout's write token in the
// release body (lane 1). And a file the release only CHANGED brings only
// what was ADDED to it: the Overworld notes, first shipped in
// app-v0.1.4556, were republished whole by every release that appended a
// line, and the launcher's news listed them twice (lane 3). Round 2: what
// counts as added is decided by what the lines SAY (addedNotes) - by
// position, app-v0.1.4534 lost four new fixes written where a deleted
// "Notes" section had stood.
//
//   node scripts/desktopRelease.mjs check <dir>           exit 1 naming any file missing
//   node scripts/desktopRelease.mjs notes <tag>           the release body, markdown, to stdout
//   node scripts/desktopRelease.mjs latest <tag> [<cur>]  "true" when <tag> should be marked latest
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { isMain } from '../tools/lib/isMain.mjs';

const require = createRequire(import.meta.url);
const { DOWNLOAD_FILES } = require('../app/lib/downloads.cjs');
const { parseReleaseTag } = require('../app/lib/updateCheck.cjs');

/** Every file a published release must carry: the four downloads, the
 *  three manifests electron-updater reads (one per OS), and the two
 *  blockmaps its differential download diffs against. The AppImage's
 *  blockmap is embedded in the AppImage; the portable exe has none. */
export const EXPECTED_RELEASE_FILES = Object.freeze([
  DOWNLOAD_FILES.winSetup, `${DOWNLOAD_FILES.winSetup}.blockmap`,
  DOWNLOAD_FILES.winPortable,
  DOWNLOAD_FILES.mac, `${DOWNLOAD_FILES.mac}.blockmap`,
  DOWNLOAD_FILES.linux,
  'latest.yml', 'latest-mac.yml', 'latest-linux.yml',
]);

/** The expected files a list of names does not have. */
export const missingReleaseFiles = (names) => {
  const have = new Set(names);
  return EXPECTED_RELEASE_FILES.filter((f) => !have.has(f));
};

/** A patch-notes file at the repository root - the only files `notes` reads
 *  (any name, but never a path: nothing below the root, nothing above it). */
export const PATCH_NOTES_RE = /^PATCH-NOTES-[^/\\]+\.md$/;

/** The most of one file a release body carries. */
export const NOTES_FILE_MAX = 64 * 1024;

/** What a release says when no patch notes came with it. On GitHub the
 *  generated list of merged changes follows it; the launcher's news panel
 *  cuts the list (app/lib/launcherState.cjs playerNotes) and lists a
 *  release that says only this when it is marked NEW or UPDATE, or when
 *  no release says more. */
export const NO_NOTES_TEXT = 'Fixes and improvements.';

/**
 * The release body: each patch-notes file the release brings, whole and
 * in the order given, then nothing else - GitHub appends its generated
 * list of merged changes under whatever this returns. Files are trimmed
 * and separated by a blank line; a release with none says so plainly.
 *
 * @param {Array<{ file: string, text: string }>} notes
 * @returns {string}
 */
export function composeReleaseNotes(notes) {
  const parts = (notes ?? []).map((n) => String(n?.text ?? '').trim()).filter(Boolean);
  return `${parts.length ? parts.join('\n\n') : NO_NOTES_TEXT}\n`;
}

/**
 * Should `tag` become the repository's latest release? Yes when nothing
 * is latest yet, and when it is at least the current latest by REL3's
 * numeric compare. A hand-cut re-release of an OLD build (the tag door,
 * a dispatch) must not take `latest` - every releases/latest/download
 * link on the site, and every updater, follows it. An unparseable tag
 * is never made latest.
 *
 * @param {string} tag
 * @param {string|null|undefined} currentLatest
 */
export function shouldMarkLatest(tag, currentLatest) {
  const mine = parseReleaseTag(tag);
  if (!mine) return false;
  const cur = parseReleaseTag(currentLatest);
  if (!cur) return true;
  for (let i = 0; i < 3; i++) {
    if (mine[i] !== cur[i]) return mine[i] > cur[i];
  }
  return true;
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).trim();

/** The release tag before `tag` in this checkout's history, or null. */
export function previousReleaseTag(tag, run = git) {
  try {
    return run(['describe', '--tags', '--abbrev=0', '--match', 'app-v*', '--exclude', tag, 'HEAD']) || null;
  } catch {
    return null;
  }
}

/** A heading line of the PATCH-NOTES markdown. */
const HEADING_RE = /^#{1,6}\s/;

/** A line's words, as a rewrite keeps them: lower case, apostrophes gone, a plural's s gone ("Boats" is "boat"). */
const wordsOf = (line) => (String(line).toLowerCase().replace(/['’]/g, '').match(/[\p{L}\p{N}]+/gu) ?? [])
  .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));

/** The share of an added line's words that one removed line holds. */
const heldIn = (added, removed) => {
  const mine = new Set(wordsOf(added));
  if (!mine.size) return 0;
  const theirs = new Set(wordsOf(removed));
  let held = 0;
  for (const w of mine) if (theirs.has(w)) held++;
  return held / mine.size;
};

/** An added line whose words are at least this much held in ONE line its hunk removed is that line, rewritten. */
export const REWRITE_SHARE = 0.6;

/** `git diff -U0`'s hunks: where each starts in the file as it is now, and the lines it removes and adds. */
function hunksOf(diffText) {
  const hunks = [];
  let hunk = null;
  for (const raw of String(diffText ?? '').replace(/\r\n/g, '\n').split('\n')) {
    if (raw.startsWith('diff --git ')) { hunk = null; continue; }   // a file's header lines are not content
    const at = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (at) {
      hunk = { start: Number(at[1]), removed: [], added: [] };
      hunks.push(hunk);
      continue;
    }
    if (!hunk) continue;
    // inside a hunk EVERY +/- line is content - a note that opens "++" or "+++" among them (AUDIT INSTALL R2-C4)
    if (raw.startsWith('+')) hunk.added.push(raw.slice(1));
    else if (raw.startsWith('-')) hunk.removed.push(raw.slice(1));
  }
  return hunks;
}

/**
 * What a CHANGED patch-notes file adds: from `git diff -U0` of it, the
 * lines of NEWS - each run of them under the nearest heading above it in
 * the file as it is now, the file's title first. '' when the change added
 * no news (a correction is not news).
 *
 * AUDIT INSTALL R2-C1: news is decided by CONTENT, never by position. A
 * line of text is news unless most of its words (REWRITE_SHARE) are held
 * in one line its own hunk removed - a typo fixed, a line reworded or
 * restyled, one line split in two - or it IS, word for word, a line the
 * change removed anywhere in the file (moved). Round 1 took the first b
 * added lines of a hunk that removed b as its rewrites, and a hunk that
 * DELETES a section while adding new lines in its place is ordinary
 * ("## Notes / - Boats are not in this update" gone as the boats ship):
 * app-v0.1.4534 lost four new fixes that way. Headings are never news
 * alone; they only say where news sits. A one-word line's typo fixed
 * shares no word with it and reads as news - no note here is one word.
 * Words are all it reads, so a note reworded until fewer than
 * REWRITE_SHARE of its words stay reads as news too - on that side on
 * purpose: a note told twice over a fix never told. Replayed against
 * round 1's rule over all 62 release ranges before it, the four lost
 * fixes are the one difference.
 *
 * @param {string} headText the file at HEAD
 * @param {string} diffText `git diff -U0` of it, previous release to HEAD
 */
export function addedNotes(headText, diffText) {
  const lines = String(headText ?? '').replace(/\r\n/g, '\n').split('\n');
  const hunks = hunksOf(diffText);
  const moved = new Set(hunks.flatMap((h) => h.removed).filter((l) => !HEADING_RE.test(l)).map((l) => wordsOf(l).join(' ')).filter(Boolean));
  const out = [];
  const title = lines.find((l) => /^#\s/.test(l));
  let under = null;
  for (const h of hunks) {
    const was = h.removed.filter((l) => wordsOf(l).length && !HEADING_RE.test(l));
    const news = h.added.map((l) => wordsOf(l).length > 0 && !HEADING_RE.test(l) && !moved.has(wordsOf(l).join(' '))
      && !was.some((r) => heldIn(l, r) >= REWRITE_SHARE));
    const rewritten = h.added.map((l, i) => !news[i] && wordsOf(l).length > 0 && !HEADING_RE.test(l));
    for (let i = 0; i < h.added.length; i++) {
      if (!news[i]) continue;
      // a run: news, with the blank lines and headings between, up to its last line of news before a rewrite
      let last = i;
      for (let j = i + 1; j < h.added.length && !rewritten[j]; j++) if (news[j]) last = j;
      const run = h.added.slice(i, last + 1);
      let heading = null;
      for (let k = h.start + i - 2; k >= 0; k--) if (HEADING_RE.test(lines[k] ?? '')) { heading = lines[k]; break; }
      if (out.length && out[out.length - 1].trim()) out.push('');   // one run, one paragraph
      if (heading && heading !== title && heading !== under) out.push(heading);
      out.push(...run);
      under = [...run].reverse().find((l) => HEADING_RE.test(l)) ?? heading;
      i = last;
    }
  }
  const body = out.join('\n').trim();
  return body ? `${title ? `${title}\n\n` : ''}${body}` : '';
}

/** At most NOTES_FILE_MAX of a text, cut at a line. */
const capped = (text) => {
  if (text.length <= NOTES_FILE_MAX) return text;
  return text.slice(0, text.lastIndexOf('\n', NOTES_FILE_MAX) + 1 || NOTES_FILE_MAX);
};

/**
 * The patch notes a release brings, from `from` (the previous release's
 * tag) to HEAD, newest change first: [{ file, text }]. An added file whole;
 * a changed (or renamed-and-changed) file only what it adds (addedNotes).
 * Read from git's objects: a file that is not a regular file at HEAD - a
 * symlink, a submodule - is never read. With no previous release there is
 * nothing to diff against, and the body says "fixes and improvements"
 * rather than every note ever written.
 */
export function patchNotesSince(from, run = git) {
  if (!from) return [];
  // AUDIT INSTALL R2-C4: -z - without it git QUOTES a name holding a non-ASCII letter, a tab or a quote
  // ("PATCH-NOTES-Caf\303\251.md"), and those notes were dropped without a word. T: a link that became a file.
  const raw = run(['diff', '--raw', '-z', '--no-abbrev', '-M', '--diff-filter=AMRT', from, 'HEAD', '--', 'PATCH-NOTES-*.md']);
  const fields = raw.split('\0');
  const notes = [];
  for (let i = 0; i < fields.length; i++) {
    // :<old mode> <new mode> <old sha> <new sha> <status>, then its path (a rename: the old path, then the new)
    const m = /^:\d{6} (\d{6}) [0-9a-f]+ [0-9a-f]+ ([AMRT])\d*$/.exec(fields[i]);
    if (!m) continue;
    const [, mode, status] = m;
    const first = fields[++i];
    const second = status === 'R' ? fields[++i] : undefined;
    const file = second ?? first;
    if (!PATCH_NOTES_RE.test(file ?? '') || (mode !== '100644' && mode !== '100755')) continue;
    // a name is only ever a name: `[beta]` in one is no pattern that pulls in another file's hunks
    const literal = (p) => `:(literal)${p}`;
    const head = run(['show', `HEAD:${file}`]);
    if (/[\0\uFFFD]/.test(head)) {
      console.error(`${file} is not UTF-8 text - left out of the notes`);
      continue;
    }
    // added whole; and a link that became a file (T) brings the file whole - what the link pointed at was never notes
    const text = status === 'A' || status === 'T' ? head
      : addedNotes(head, run(['diff', '-U0', '--no-color', '-M', from, 'HEAD', '--', ...(second ? [literal(first), literal(second)] : [literal(file)])]));
    const when = Number(run(['log', '-1', '--format=%ct', `${from}..HEAD`, '--', literal(file)])) || 0;
    if (text.trim()) notes.push({ file, text: capped(text), when });
  }
  return notes.sort((a, b) => b.when - a.when || a.file.localeCompare(b.file)).map(({ file, text }) => ({ file, text }));
}

function main(argv) {
  const [cmd, a, b] = argv;
  if (cmd === 'check') {
    const missing = missingReleaseFiles(readdirSync(a));
    if (missing.length) {
      console.error(`the release is missing ${missing.join(', ')} - nothing is published`);
      return 1;
    }
    console.log(`all ${EXPECTED_RELEASE_FILES.length} release files present`);
    return 0;
  }
  if (cmd === 'notes') {
    process.stdout.write(composeReleaseNotes(patchNotesSince(previousReleaseTag(a))));
    return 0;
  }
  if (cmd === 'latest') {
    console.log(String(shouldMarkLatest(a, b)));
    return 0;
  }
  console.error('usage: desktopRelease.mjs check <dir> | notes <tag> | latest <tag> [<current>]');
  return 2;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
