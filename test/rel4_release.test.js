// REL4 + REL5 (2026-09-29, Mac: "How can we drastically improve the
// install experience? ... I really want to make it AAA grade").
//
// REL4 - THE RELEASE IS PUBLISHED WHOLE, ONCE. Every release on GitHub
// carried its generated notes two or three times over (one copy per OS
// leg, one sometimes lost to a race between legs), and each went live
// when its FIRST leg finished - app-v0.1.4605 was `latest` for eighty-five
// seconds with no Windows installer and no latest.yml. The legs only
// build now; one publish job, gated on every leg, checks the set, writes
// the notes once from the PATCH-NOTES-*.md the release brings, stages a
// draft with every file and publishes it in one step.
//
// REL5 - THE DOWNLOADS HAVE NAMES THAT DO NOT MOVE. The build number is
// out of every file name, so releases/latest/download/<name> serves the
// newest copy for ever and the site can link each installer directly.
// The names are a contract (app/lib/downloads.cjs): the build config must
// produce them and the publish job refuses a set without them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, renameSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import {
  EXPECTED_RELEASE_FILES, missingReleaseFiles, composeReleaseNotes, NO_NOTES_TEXT, shouldMarkLatest,
  previousReleaseTag, patchNotesSince, addedNotes, PATCH_NOTES_RE, NOTES_FILE_MAX,
} from '../scripts/desktopRelease.mjs';

const require = createRequire(import.meta.url);
const { DOWNLOAD_FILES, RELEASES_URL, latestDownloadUrl, manualDownloadFile } = require('../app/lib/downloads.cjs');
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** electron-builder's artifactName macros, as the three release runners
 *  resolve them: windows-latest builds x64, macos-latest arm64, and the
 *  AppImage target spells x64 as x86_64. */
const expand = (template, vars) => template.replace(/\$\{(\w+)\}/g, (_, k) => {
  assert.ok(k in vars, `the template uses \${${k}}, which this pin does not resolve - a version, say, back in a name`);
  return vars[k];
});

test('REL5: the build config produces EXACTLY the names the downloads promise - no version in any of them', () => {
  const b = JSON.parse(rd('app/package.json')).build;
  // electron-builder's own precedence (app-builder-lib 25 artifactPatternConfig): the TARGET's options, then the
  // PLATFORM's, then the top level - and the AppImage target's options are the linux block with appImage's over it.
  // AUDIT INSTALL L5-11: this read `b.AppImage` (the key is appImage) and never the platform blocks, so a versioned
  // name under "mac" or "linux" passed.
  const platformOf = { nsis: 'win', portable: 'win', dmg: 'mac', appImage: 'linux' };
  const nameOf = (target) => b[target]?.artifactName || b[platformOf[target]]?.artifactName || b.artifactName;
  assert.equal(expand(nameOf('nsis'), { arch: 'x64', ext: 'exe' }), DOWNLOAD_FILES.winSetup);
  assert.equal(expand(nameOf('portable'), { arch: 'x64', ext: 'exe' }), DOWNLOAD_FILES.winPortable);
  assert.equal(expand(nameOf('dmg'), { os: 'mac', arch: 'arm64', ext: 'dmg' }), DOWNLOAD_FILES.mac);
  assert.equal(expand(nameOf('appImage'), { os: 'linux', arch: 'x86_64', ext: 'AppImage' }), DOWNLOAD_FILES.linux);
  for (const t of ['nsis', 'portable', 'dmg', 'appImage']) assert.doesNotMatch(nameOf(t), /\$\{version\}/, `${t}: a versioned name is a link that dies at the next merge`);
  assert.ok(!('AppImage' in b), 'the AppImage target\'s options live under appImage - a block under any other key is read by nobody');
  assert.deepEqual(b.win.target, ['nsis', 'portable']);
  assert.deepEqual(b.mac.target, ['dmg']);
  assert.deepEqual(b.linux.target, ['AppImage'], 'every target the release carries has a promised name');
  assert.equal(Object.keys(DOWNLOAD_FILES).length, 4);
});

test('REL5: a download link names the file under releases/latest/download, which GitHub answers with the newest copy', () => {
  assert.equal(RELEASES_URL, 'https://github.com/Lattymoy/daggerfall-js-source/releases');
  assert.equal(latestDownloadUrl(DOWNLOAD_FILES.winSetup),
    'https://github.com/Lattymoy/daggerfall-js-source/releases/latest/download/DaggerfallOnline-win-x64-setup.exe');
  // the copy that updates BY HAND is sent its own file, never a page of eleven
  assert.equal(manualDownloadFile({ platform: 'darwin', portable: false, packaged: true }), DOWNLOAD_FILES.mac);
  assert.equal(manualDownloadFile({ platform: 'win32', portable: true, packaged: true }), DOWNLOAD_FILES.winPortable);
  assert.equal(manualDownloadFile({ platform: 'win32', portable: false, packaged: true }), DOWNLOAD_FILES.winSetup);
  assert.equal(manualDownloadFile({ platform: 'linux', portable: false, packaged: true }), DOWNLOAD_FILES.linux);
  assert.equal(manualDownloadFile({ platform: 'win32', portable: false, packaged: false }), null, 'an unpackaged run has no file to fetch');
  assert.equal(manualDownloadFile({ platform: 'freebsd', portable: false, packaged: true }), null);
});

test('REL4: a release is the four downloads, the three manifests and two blockmaps - one short publishes nothing', () => {
  assert.deepEqual([...EXPECTED_RELEASE_FILES].sort(), [
    'DaggerfallOnline-linux-x86_64.AppImage',
    'DaggerfallOnline-mac-arm64.dmg', 'DaggerfallOnline-mac-arm64.dmg.blockmap',
    'DaggerfallOnline-win-x64-portable.exe',
    'DaggerfallOnline-win-x64-setup.exe', 'DaggerfallOnline-win-x64-setup.exe.blockmap',
    'latest-linux.yml', 'latest-mac.yml', 'latest.yml',
  ]);
  assert.deepEqual(missingReleaseFiles([...EXPECTED_RELEASE_FILES, 'extra.txt']), [], 'a whole set passes');
  // app-v0.1.4605's first eighty-five seconds: the Linux and macOS legs were in, Windows was not
  const early = EXPECTED_RELEASE_FILES.filter((f) => !/win-x64|^latest\.yml$/.test(f));
  assert.deepEqual(missingReleaseFiles(early), [DOWNLOAD_FILES.winSetup, `${DOWNLOAD_FILES.winSetup}.blockmap`, DOWNLOAD_FILES.winPortable, 'latest.yml']);
  // the OLD names do not count - a build that still stamps its version into a name fails the release
  assert.ok(missingReleaseFiles(['DaggerfallOnline-0.1.4684-win-x64-setup.exe']).includes(DOWNLOAD_FILES.winSetup));
});

test('REL4: the notes are the patch notes the release brings, once, and say so plainly when there are none', () => {
  const a = '# Patch Notes: The Sea\n\n- Boats.\n';
  const b = '\n# Patch Notes: The Pause Key\n- Pause.\n\n';
  assert.equal(composeReleaseNotes([{ file: 'PATCH-NOTES-A.md', text: a }, { file: 'PATCH-NOTES-B.md', text: b }]),
    '# Patch Notes: The Sea\n\n- Boats.\n\n# Patch Notes: The Pause Key\n- Pause.\n');
  assert.equal(composeReleaseNotes([]), `${NO_NOTES_TEXT}\n`);
  assert.equal(composeReleaseNotes([{ file: 'PATCH-NOTES-Empty.md', text: '  \n' }]), `${NO_NOTES_TEXT}\n`, 'an empty file is no note');
  assert.equal(composeReleaseNotes(undefined), `${NO_NOTES_TEXT}\n`);
  assert.equal(previousReleaseTag('app-v0.1.4644', (args) => {
    assert.equal(args.join(' '), 'describe --tags --abbrev=0 --match app-v* --exclude app-v0.1.4644 HEAD', 'the tag being cut is never its own "previous"');
    return 'app-v0.1.4615';
  }), 'app-v0.1.4615');
  assert.equal(previousReleaseTag('app-v0.1.1', () => { throw new Error('no names found'); }), null);
  assert.deepEqual(patchNotesSince(null, () => { throw new Error('never asked'); }), [], 'no previous release, no pile of every note ever written');
  assert.ok(PATCH_NOTES_RE.test('PATCH-NOTES-The-Pause-Key-and-Shared-Quests.md'));
  assert.ok(PATCH_NOTES_RE.test('PATCH-NOTES-v1.2_hotfix.md'), 'any name - AUDIT INSTALL L3-3: a dot or an underscore was dropped without a word');
  assert.ok(!PATCH_NOTES_RE.test('PATCH-NOTES-../../etc.md'), 'but never a path');
  assert.ok(!PATCH_NOTES_RE.test('docs/PATCH-NOTES-Nested.md'));
});

test('AUDIT INSTALL L3-3: a file the release only CHANGED brings what was ADDED to it, under its title and heading - a correction is not news', () => {
  const head = '# Patch Notes: The Overworld\n\n## Travel\n- Walk.\n- Ride.\n- Sail.\n\n## Fixes\n- One.\n- Two.\n';
  // two lines appended under "Travel" (a pure addition), and "One." reworded (a rewrite: nothing new)
  const diff = [
    'diff --git a/PATCH-NOTES-Overworld.md b/PATCH-NOTES-Overworld.md',
    '--- a/PATCH-NOTES-Overworld.md',
    '+++ b/PATCH-NOTES-Overworld.md',
    '@@ -4,0 +5,2 @@ ## Travel',
    '+- Ride.',
    '+- Sail.',
    '@@ -8 +10 @@ ## Fixes',
    '-- Oen.',
    '+- One.',
  ].join('\n');
  assert.equal(addedNotes(head, diff), '# Patch Notes: The Overworld\n\n## Travel\n- Ride.\n- Sail.');
  // a typo fixed and nothing else: nothing to say
  assert.equal(addedNotes(head, '@@ -8 +10 @@\n-- Oen.\n+- One.'), '');
  // a last line given its newline AND lines after it: the rewrite is not news, the lines after are
  assert.equal(addedNotes(head, '@@ -10 +10,2 @@\n-- One.\n\\ No newline at end of file\n+- One.\n+- Two.'), '# Patch Notes: The Overworld\n\n## Fixes\n- Two.');
  // an addition that opens with its own heading brings no second one; two additions stand a paragraph apart
  const withSection = '# T\n\n## A\n- a\n\n## B\n- b\n';
  assert.equal(addedNotes(withSection, '@@ -5,0 +6,2 @@\n+## B\n+- b\n@@ -3,0 +4 @@\n+- a'), '# T\n\n## B\n- b\n\n## A\n- a');
  assert.equal(addedNotes('', ''), '');
});

test('AUDIT INSTALL L1-1/L3-3: the notes are read from git\'s objects - an added file whole, a changed one only what it adds, a symlink never', () => {
  const repo = mkdtempSync(join(tmpdir(), 'rel4-notes-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 24 }).trim();
  try {
    git('init', '-q');
    git('config', 'user.email', 'probe@example.invalid');
    git('config', 'user.name', 'probe');
    git('config', 'commit.gpgsign', 'false');
    writeFileSync(join(repo, 'PATCH-NOTES-Old.md'), '# Patch Notes: Old\n\n## Fixes\n- One.\n');
    writeFileSync(join(repo, 'PATCH-NOTES-Moved.md'), '# Patch Notes: Moved\n\n- Stays the same.\n');
    writeFileSync(join(repo, 'secret.txt'), 'extraheader = AUTHORIZATION: basic c2VjcmV0\n');
    git('add', '-A');
    git('commit', '-qm', 'first release');
    git('tag', 'app-v0.1.1');
    writeFileSync(join(repo, 'PATCH-NOTES-Old.md'), '# Patch Notes: Old\n\n## Fixes\n- One.\n- Two.\n');
    writeFileSync(join(repo, 'PATCH-NOTES-New.md'), '# Patch Notes: New\n\n- Everything.\n');
    renameSync(join(repo, 'PATCH-NOTES-Moved.md'), join(repo, 'PATCH-NOTES-Renamed.md'));
    symlinkSync('secret.txt', join(repo, 'PATCH-NOTES-zz.md'));   // committed as a LINK - the token's shape
    // git's pathspec lets `*` cross a `/`: a file inside a FOLDER so named matches PATCH-NOTES-*.md - and is no root note
    mkdirSync(join(repo, 'PATCH-NOTES-dir'));
    writeFileSync(join(repo, 'PATCH-NOTES-dir', 'inner.md'), '# not a root note\n');
    git('add', '-A');
    git('commit', '-qm', 'second release');
    const run = (args) => git(...args);
    const notes = patchNotesSince('app-v0.1.1', run);
    const byFile = Object.fromEntries(notes.map((n) => [n.file, n.text]));
    assert.deepEqual(Object.keys(byFile).sort(), ['PATCH-NOTES-New.md', 'PATCH-NOTES-Old.md'], 'a pure rename brings nothing, and a link is never read');
    assert.equal(byFile['PATCH-NOTES-New.md'], '# Patch Notes: New\n\n- Everything.', 'an added file, whole');
    assert.equal(byFile['PATCH-NOTES-Old.md'], '# Patch Notes: Old\n\n## Fixes\n- Two.', 'a changed file, only what it adds');
    assert.doesNotMatch(composeReleaseNotes(notes), /AUTHORIZATION|secret/, 'nothing a link points at reaches the body');
  } finally { rmSync(repo, { recursive: true, force: true }); }
  assert.equal(NOTES_FILE_MAX, 64 * 1024);
});

test('AUDIT INSTALL L5-10: the script\'s own commands, run - a set one short exits 1, "latest" prints what the publish job reads', () => {
  const script = new URL('../scripts/desktopRelease.mjs', import.meta.url).pathname;
  const node = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
  const dir = mkdtempSync(join(tmpdir(), 'rel4-set-'));
  try {
    for (const f of EXPECTED_RELEASE_FILES.slice(1)) writeFileSync(join(dir, f), 'x');
    const short = node('check', dir);
    assert.equal(short.status, 1, 'one file short: the publish job stops here');
    assert.match(short.stderr, new RegExp(`missing ${EXPECTED_RELEASE_FILES[0].replace(/\./g, '\\.')} - nothing is published`));
    writeFileSync(join(dir, EXPECTED_RELEASE_FILES[0]), 'x');
    assert.equal(node('check', dir).status, 0, 'whole: it passes');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const old = node('latest', 'app-v0.1.5', 'app-v0.1.9');
  assert.deepEqual([old.status, old.stdout.trim()], [0, 'false'], 'an old re-cut never takes latest');
  assert.equal(node('latest', 'app-v0.1.10', 'app-v0.1.9').stdout.trim(), 'true');
  assert.equal(node('latest', 'app-v0.1.10', '').stdout.trim(), 'true', 'nothing latest yet');
  assert.equal(node('bogus').status, 2, 'an unknown command is a usage error, never a quiet success');
});

test('REL4: a release takes `latest` unless a newer one holds it - a hand re-cut of an old build must not move every link back', () => {
  assert.equal(shouldMarkLatest('app-v0.1.4685', 'app-v0.1.4684'), true);
  assert.equal(shouldMarkLatest('app-v0.1.4684', 'app-v0.1.4684'), true, 'a re-cut of the current build keeps it');
  assert.equal(shouldMarkLatest('app-v0.1.4600', 'app-v0.1.4684'), false);
  assert.equal(shouldMarkLatest('app-v0.10.0', 'app-v0.9.9'), true, 'numeric, not string');
  assert.equal(shouldMarkLatest('app-v1.0.0', ''), true, 'nothing is latest yet');
  assert.equal(shouldMarkLatest('app-v1.0.0', 'garbage'), true);
  assert.equal(shouldMarkLatest('v1.0.0', 'app-v0.1.1'), false, 'an unparseable tag never takes latest');
});

test('REL4: the workflow - one number, legs that only build, one publish gated on every leg, a draft published in one step', () => {
  const wf = rd('.github/workflows/release-desktop.yml');
  const job = (name) => {
    const at = wf.indexOf(`\n  ${name}:\n`);
    assert.ok(at > 0, `a ${name} job`);
    const next = wf.slice(at + 1).search(/\n {2}[a-z][\w-]*:\n/);
    return next < 0 ? wf.slice(at) : wf.slice(at, at + 1 + next);
  };
  const version = job('version'), build = job('build'), publish = job('publish');
  assert.equal((wf.match(/- name: Resolve release version/g) ?? []).length, 1, 'the number is resolved once');
  assert.match(version, /- name: Resolve release version/);
  assert.match(build, /needs: \[version, gate\]/, 'no leg packages before the suite passed');
  assert.doesNotMatch(build, /action-gh-release|gh release|releases\//, 'a leg publishes NOTHING');
  assert.match(build, /uses: actions\/upload-artifact@v4[\s\S]*name: desktop-\$\{\{ matrix\.os \}\}/, 'it hands its files on');
  assert.match(publish, /needs: \[version, build\]/, 'publish waits for the WHOLE matrix');
  assert.match(publish, /if: needs\.version\.outputs\.tag != ''/, 'and only when there is a release to cut (no always(): a failed leg skips it)');
  assert.doesNotMatch(publish, /always\(\)|failure\(\)|cancelled\(\)/);
  assert.match(publish, /uses: actions\/download-artifact@v4[\s\S]*pattern: desktop-\*[\s\S]*merge-multiple: true/);
  const check = publish.indexOf('desktopRelease.mjs check release'), stage = publish.indexOf('softprops/action-gh-release@v2');
  assert.ok(check > 0 && stage > check, 'the set is checked before anything is staged');
  assert.match(publish, /draft: true/, 'staged as a draft - invisible while the files upload');
  assert.match(publish, /body_path: release-notes\.md/);
  assert.equal((wf.match(/generate_release_notes: true/g) ?? []).length, 1, 'GitHub\'s list is generated ONCE');
  assert.match(publish, /-F draft=false -f make_latest="\$MAKE_LATEST"/, 'and published in one step');
  assert.match(publish, /MAKE_LATEST=\$\(node scripts\/desktopRelease\.mjs latest "\$TAG" "\$CURRENT"\)/);
  assert.match(publish, /RELEASE_ID: \$\{\{ steps\.release\.outputs\.id \}\}/, 'the draft it staged, by id - a draft has no tag to look up');
  assert.match(publish, /permissions:\n\s+contents: write/, 'only the publish job writes');
  assert.match(wf, /^permissions:\n {2}contents: read$/m, 'everything else reads');
  assert.match(publish, /target_commitish: \$\{\{ github\.sha \}\}/, 'AUDIT 68: the tag lands on the commit the files were built from');
});

test('REL5: the site links each installer by the name the release promises - the door\'s Install lands on them, one click each', () => {
  const landing = rd('index.html');
  const entry = landing.slice(landing.indexOf('<dt id="desktop">'), landing.indexOf('</dd>', landing.indexOf('<dt id="desktop">')));
  const hrefs = [...entry.matchAll(/href="(https:\/\/github\.com\/[^"]*\/releases\/latest\/download\/[^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs.sort(), Object.values(DOWNLOAD_FILES).map(latestDownloadUrl).sort(),
    'the four downloads, exactly - a name the release does not carry is a dead link on the front page');
  const row = entry.match(/<span class="dl">([\s\S]*?)<\/span>/)?.[1] ?? '';
  assert.deepEqual([...row.matchAll(/>([^<]+)<\/a>/g)].map((m) => m[1]), ['Windows', 'macOS', 'Linux'], 'one link per platform, in the page\'s own link style');
  assert.match(landing, /<a class="plaque" href="#desktop">Install<\/a>/, 'and the door\'s Install lands on them');
  assert.doesNotMatch(landing.replace(/href="https:\/\/github\.com\/Lattymoy\/daggerfall-js-source\/releases\/latest"[^>]*>Every file</, ''), /href="https:\/\/github\.com\/[^"]*\/releases\/latest"/,
    'the release PAGE is linked once, as "Every file" - never as the way to install');
});
