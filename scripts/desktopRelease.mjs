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
// line, and the launcher's news listed them twice (lane 3).
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
 *  generated list of merged changes follows it; the launcher's "What's
 *  new" shows this line alone (app/lib/launcherState.cjs cuts the list). */
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

/**
 * What a CHANGED patch-notes file adds: from `git diff -U0` of it, the
 * lines each hunk adds beyond the ones it rewrites (a hunk that removes b
 * lines and adds d rewrites b of them - a typo fixed, a line reworded, a
 * last line given its newline - and adds d - b), each under the nearest
 * heading above it in the file as it is now, the file's title first. ''
 * when the change added nothing (a correction is not news).
 *
 * @param {string} headText the file at HEAD
 * @param {string} diffText `git diff -U0` of it, previous release to HEAD
 */
export function addedNotes(headText, diffText) {
  const lines = String(headText ?? '').replace(/\r\n/g, '\n').split('\n');
  const hunks = [];
  let hunk = null;
  for (const raw of String(diffText ?? '').replace(/\r\n/g, '\n').split('\n')) {
    const at = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(raw);
    if (at) {
      hunk = { removed: at[1] === undefined ? 1 : Number(at[1]), start: Number(at[2]), added: [] };
      hunks.push(hunk);
      continue;
    }
    if (hunk && raw.startsWith('+') && !raw.startsWith('+++')) hunk.added.push(raw.slice(1));
  }
  const out = [];
  const title = lines.find((l) => /^#\s/.test(l));
  let under = null;
  for (const h of hunks) {
    const fresh = h.added.slice(Math.min(h.removed, h.added.length));
    if (!fresh.some((l) => l.trim())) continue;
    // the heading this addition sits under, when it does not open with its own
    const first = h.start + (h.added.length - fresh.length) - 1;   // 0-based index of its first fresh line
    let heading = null;
    for (let i = first - 1; i >= 0; i--) if (HEADING_RE.test(lines[i])) { heading = lines[i]; break; }
    if (out.length && out[out.length - 1].trim()) out.push('');   // one addition, one paragraph
    if (heading && heading !== title && heading !== under && !HEADING_RE.test(fresh.find((l) => l.trim()) ?? '')) {
      out.push(heading);
      under = heading;
    }
    out.push(...fresh);
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
  const raw = run(['diff', '--raw', '--no-abbrev', '-M', '--diff-filter=AMR', from, 'HEAD', '--', 'PATCH-NOTES-*.md']);
  const notes = [];
  for (const line of raw.split('\n')) {
    // :<old mode> <new mode> <old sha> <new sha> <status>\t<path>[\t<new path>]
    const m = /^:\d{6} (\d{6}) [0-9a-f]+ [0-9a-f]+ ([AMR])\d*\t([^\t]+)(?:\t([^\t]+))?$/.exec(line.trim());
    if (!m) continue;
    const [, mode, status, first, second] = m;
    const file = second ?? first;
    if (!PATCH_NOTES_RE.test(file) || (mode !== '100644' && mode !== '100755')) continue;
    const head = run(['show', `HEAD:${file}`]);
    const text = status === 'A' ? head
      : addedNotes(head, run(['diff', '-U0', '--no-color', '-M', from, 'HEAD', '--', ...(second ? [first, second] : [file])]));
    const when = Number(run(['log', '-1', '--format=%ct', `${from}..HEAD`, '--', file])) || 0;
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
