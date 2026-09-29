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
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  EXPECTED_RELEASE_FILES, missingReleaseFiles, composeReleaseNotes, NO_NOTES_TEXT, shouldMarkLatest,
  previousReleaseTag, patchNotesSince, PATCH_NOTES_RE,
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
  const nameOf = (target) => b[target]?.artifactName ?? b.artifactName;
  assert.equal(expand(nameOf('nsis'), { arch: 'x64', ext: 'exe' }), DOWNLOAD_FILES.winSetup);
  assert.equal(expand(nameOf('portable'), { arch: 'x64', ext: 'exe' }), DOWNLOAD_FILES.winPortable);
  assert.equal(expand(nameOf('dmg'), { os: 'mac', arch: 'arm64', ext: 'dmg' }), DOWNLOAD_FILES.mac);
  assert.equal(expand(nameOf('AppImage'), { os: 'linux', arch: 'x86_64', ext: 'AppImage' }), DOWNLOAD_FILES.linux);
  for (const t of ['nsis', 'portable', 'dmg', 'AppImage']) assert.doesNotMatch(nameOf(t), /\$\{version\}/, `${t}: a versioned name is a link that dies at the next merge`);
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
  // which files: the previous release's tag (never this one) to HEAD, added or changed, root patch notes only
  const calls = [];
  const run = (args) => {
    calls.push(args.join(' '));
    if (args[0] === 'describe') return 'app-v0.1.4615';
    return 'PATCH-NOTES-Overworld.md\nsrc/PATCH-NOTES-Nested.md\nPATCH-NOTES-The-Sea-Update.md\n';
  };
  assert.equal(previousReleaseTag('app-v0.1.4644', run), 'app-v0.1.4615');
  assert.match(calls[0], /^describe --tags --abbrev=0 --match app-v\* --exclude app-v0\.1\.4644 HEAD$/, 'the tag being cut is never its own "previous"');
  assert.deepEqual(patchNotesSince('app-v0.1.4615', run), ['PATCH-NOTES-Overworld.md', 'PATCH-NOTES-The-Sea-Update.md']);
  assert.match(calls[1], /^diff --name-only --diff-filter=AM app-v0\.1\.4615 HEAD -- PATCH-NOTES-\*\.md$/);
  assert.deepEqual(patchNotesSince(null, run), [], 'no previous release, no pile of every note ever written');
  assert.equal(previousReleaseTag('app-v0.1.1', () => { throw new Error('no names found'); }), null);
  assert.ok(PATCH_NOTES_RE.test('PATCH-NOTES-The-Pause-Key-and-Shared-Quests.md'));
  assert.ok(!PATCH_NOTES_RE.test('PATCH-NOTES-../../etc.md'));
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
