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
// desktop app's launcher shows the same body as "What's new".
//
//   node scripts/desktopRelease.mjs check <dir>           exit 1 naming any file missing
//   node scripts/desktopRelease.mjs notes <tag>           the release body, markdown, to stdout
//   node scripts/desktopRelease.mjs latest <tag> [<cur>]  "true" when <tag> should be marked latest
import { readFileSync, readdirSync } from 'node:fs';
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

/** A patch-notes file at the repository root - the only files `notes` reads. */
export const PATCH_NOTES_RE = /^PATCH-NOTES-[A-Za-z0-9-]+\.md$/;

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

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

/** The release tag before `tag` in this checkout's history, or null. */
export function previousReleaseTag(tag, run = git) {
  try {
    return run(['describe', '--tags', '--abbrev=0', '--match', 'app-v*', '--exclude', tag, 'HEAD']) || null;
  } catch {
    return null;
  }
}

/** The patch-notes files added or changed between `from` and HEAD. With
 *  no previous release there is nothing to diff against, and the body
 *  says "fixes and improvements" rather than every note ever written. */
export function patchNotesSince(from, run = git) {
  if (!from) return [];
  const out = run(['diff', '--name-only', '--diff-filter=AM', from, 'HEAD', '--', 'PATCH-NOTES-*.md']);
  return out.split('\n').map((s) => s.trim()).filter((f) => PATCH_NOTES_RE.test(f)).sort();
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
    const files = patchNotesSince(previousReleaseTag(a));
    process.stdout.write(composeReleaseNotes(files.map((file) => ({ file, text: readFileSync(file, 'utf8') }))));
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
