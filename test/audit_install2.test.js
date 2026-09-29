// AUDIT INSTALL, ROUND 2 (2026-09-29, Mac: "Audit this"): PR #429's
// install work read again by five fresh lanes - the launcher's lifecycle,
// security, the release pipeline and its notes, ARENA2 detection, and the
// tests, docs and the player's eye - after round 1's fixes had landed.
// Round 2 looked hardest at the fixes themselves. The worst finding was
// one of them: L1-5 kept a tag's text out of the build legs' scripts, and
// in doing so broke the Windows leg. Every finding a lane verified is
// fixed at its root and pinned here; the record, finding by finding, is
// bible/01-Overview/Audit-Install.md ("Round 2").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addedNotes, patchNotesSince, composeReleaseNotes, REWRITE_SHARE } from '../scripts/desktopRelease.mjs';

const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// ---- the workflows, read as GitHub reads them -------------------------------

const WORKFLOWS = readdirSync(new URL('../.github/workflows/', import.meta.url)).filter((f) => f.endsWith('.yml')).sort();
/** A workflow's jobs, each from its two-space `name:` line to the next. */
const jobsOf = (wf) => [...wf.slice(wf.indexOf('\njobs:\n')).matchAll(/\n {2}([A-Za-z0-9_-]+):\n([\s\S]*?)(?=\n {2}[A-Za-z0-9_-]+:\n|$)/g)]
  .map((m) => ({ name: m[1], text: m[2] }));
/** A job's steps, each from its `      - ` line to the next. */
const stepsOf = (job) => {
  const at = job.indexOf('\n    steps:\n');
  return at < 0 ? [] : job.slice(at + '\n    steps:\n'.length).split(/\n(?= {6}- )/).filter((s) => /^ {6}- /.test(s));
};
/** A step's script: the inline value of its `run:`, or the block under it (the lines indented past the key). */
const runOf = (step) => {
  const lines = step.split('\n');
  const i = lines.findIndex((l) => /^ {6}(?:- | {2})run:/.test(l));
  if (i < 0) return null;
  const inline = lines[i].replace(/^ {6}(?:- | {2})run:\s*/, '');
  if (!/^[|>][-+]?\s*$/.test(inline)) return inline;
  const block = [];
  for (const l of lines.slice(i + 1)) {
    if (l.trim() && !/^ {9,}/.test(l)) break;
    block.push(l);
  }
  return block.join('\n');
};
const nameOf = (step) => /^ {6}(?:- | {2})name: (.*)$/m.exec(step)?.[1] ?? step.split('\n')[0].trim();

test('R2-B1: a step that reads a shell variable names its shell wherever a leg can be Windows - there `run` is PowerShell, and "$VERSION" is not the environment', () => {
  // L1-5 moved the version out of the stamp's script and into its
  // environment - right for bash, and silently wrong on windows-latest,
  // whose default shell is pwsh: "$VERSION" is an unset PowerShell
  // variable ($env:VERSION is the environment), npm got "" (or nothing),
  // the Windows leg failed or stamped 0.1.0, and `publish` - which needs
  // every leg - never ran. A script's dialect is the shell's, so any script
  // that reads a variable says which shell it is written for.
  let windowsJobs = 0;
  const unnamed = [];
  for (const f of WORKFLOWS) {
    const wf = rd(`.github/workflows/${f}`);
    const wfBash = /\ndefaults:\n {2}run:\n {4}shell: bash\n/.test(wf);
    for (const job of jobsOf(wf)) {
      if (!/\bwindows-(?:latest|\d+)\b/.test(job.text)) continue;
      windowsJobs++;
      const jobShell = wfBash || /\n {4}defaults:\n {6}run:\n {8}shell: \w+\n/.test(job.text);
      for (const step of stepsOf(job.text)) {
        const script = runOf(step);
        if (script === null || !/\$(?!\{\{)/.test(script)) continue;
        if (!jobShell && !/^ {8}shell: \w+/m.test(step)) unnamed.push(`${f} ${job.name}: "${nameOf(step)}"`);
      }
    }
  }
  assert.ok(windowsJobs >= 1, 'the desktop build has a Windows leg - this law is not vacuous');
  assert.deepEqual(unnamed, [], 'a script that reads a variable runs in whatever shell the leg defaults to');
  const build = jobsOf(rd('.github/workflows/release-desktop.yml')).find((j) => j.name === 'build');
  const stamp = stepsOf(build.text).find((s) => nameOf(s) === 'Stamp the version');
  assert.match(stamp, /^ {8}shell: bash$/m, 'the stamp is bash on every leg');
  assert.equal(runOf(stamp), 'npm version "$VERSION" --no-git-tag-version --allow-same-version', 'and reads the environment, never pasted text (L1-5)');
});

test('R2-B4: an action nobody at GitHub owns is pinned to a commit - the release job holds contents: write, and the launcher installs what it publishes', () => {
  const loose = [];
  let thirdParty = 0;
  for (const f of WORKFLOWS) {
    for (const m of rd(`.github/workflows/${f}`).matchAll(/^\s*(?:- )?uses: ([^\s#]+)(.*)$/gm)) {
      const [, ref, rest] = m;
      if (ref.startsWith('./') || ref.startsWith('actions/')) continue;
      thirdParty++;
      const [, sha] = /@([^@]+)$/.exec(ref) ?? [];
      if (!/^[0-9a-f]{40}$/.test(sha ?? '') || !/^\s+# v\d+\.\d+\.\d+$/.test(rest)) loose.push(`${f}: ${ref}${rest}`);
    }
  }
  assert.ok(thirdParty >= 1, 'softprops is third-party - this law is not vacuous');
  assert.deepEqual(loose, [], 'a tag can be moved under the job; a commit cannot - and the comment says which release it was');
  assert.match(rd('.github/workflows/release-desktop.yml'), /uses: softprops\/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65 # v2\.6\.2\n/,
    'the commit v2 and v2.6.2 both named (git ls-remote, 2026-09-29)');
});

test('R2-C2: a draft a failed run left at the tag is deleted before staging - softprops would keep it, with its old notes and its old commit', () => {
  const wf = rd('.github/workflows/release-desktop.yml');
  const publish = jobsOf(wf).find((j) => j.name === 'publish');
  const steps = stepsOf(publish.text);
  const guard = steps.findIndex((s) => nameOf(s) === 'The tag has no published release, and no draft left over');
  const stage = steps.findIndex((s) => /uses: softprops\/action-gh-release@/.test(s));
  assert.ok(guard >= 0 && stage > guard, 'the guard stands before anything is staged');
  const script = runOf(steps[guard]);
  // an ASSIGNMENT, so a listing that fails fails the step (bash -e) - a `for` over a failed $(...) would carry on
  assert.match(script, /\n\s*LEFT=\$\(gh api --paginate "repos\/\$GITHUB_REPOSITORY\/releases\?per_page=100" --jq '\.\[\] \| select\(\.draft and \.tag_name == env\.TAG\) \| \.id'\)\n/,
    'every page: softprops itself only scans two');
  assert.match(script, /for ID in \$LEFT; do\s*gh api -X DELETE "repos\/\$GITHUB_REPOSITORY\/releases\/\$ID" --silent/);
  assert.ok(script.indexOf('LEFT=') > script.indexOf("grep -q 'HTTP 404' lookup-error.txt"), 'only once the tag is known to have no published release');
  assert.match(steps[stage], /target_commitish: \$\{\{ github\.sha \}\}/, 'staged afresh, the tag is cut where these files were built (AUDIT 68)');
});

// ---- the launcher's fences ---------------------------------------------------

const main = rd('app/main.cjs');
const fences = main.slice(main.indexOf("app.on('web-contents-created'"), main.indexOf('// The preload asks for its storage root'));

test('R2-B2: a launcher that finds itself anywhere but its own origin goes home - about:blank makes no request, so will-navigate never saw it', () => {
  // will-navigate is raised as a navigation's request starts; location = 'about:blank' commits with none, and the
  // launcher sat on a page that was not its own with its bridge still on it (tools/appShellProbe.mjs drives it)
  assert.match(fences, /contents\.on\('did-navigate', \(_e, url\) => \{\s*if \(launcherContents\.has\(contents\) && !url\.startsWith\(LAUNCHER_ORIGIN\)\) contents\.loadURL\(LAUNCHER_URL\)\.catch\(\(\) => \{\}\);\s*\}\);/);
  const origin = /const LAUNCHER_ORIGIN = '([^']+)';/.exec(main)?.[1];
  const home = /const LAUNCHER_URL = '([^']+)';/.exec(main)?.[1];
  assert.ok(origin && home?.startsWith(origin), 'home is inside the origin - going home can never be a reason to go home again');
  assert.match(rd('app/launcherPreload.cjs'), /onView: \(cb\) => \{[\s\S]*?ipcRenderer\.send\('launcher:ready'\);/, 'and the page asks for its view each time it loads - home is drawn, not blank');
});

test('R2-B3: the launcher is granted nothing it ASKS for and nothing it merely CHECKS; every other page keeps Electron\'s defaults', () => {
  // the predicate, run: the launcher's own window, or any page of its origin (a check may come with no WebContents)
  const src = /const isLauncherPage = (\(wc, url\) => .*);\n/.exec(main)?.[1];
  assert.ok(src, 'one predicate, for both sides');
  const launcherWc = { id: 1 }, gameWc = { id: 2 };
  const isLauncherPage = new Function('launcherContents', 'LAUNCHER_ORIGIN', `return ${src};`)(new WeakSet([launcherWc]), 'dagger://launcher/');
  assert.equal(isLauncherPage(launcherWc, undefined), true, 'its window');
  assert.equal(isLauncherPage(null, 'dagger://launcher/'), true, 'its origin, with no WebContents');
  assert.equal(isLauncherPage(gameWc, 'dagger://launcher/index.html'), true, 'a launcher page some other window opened');
  assert.equal(isLauncherPage(gameWc, 'dagger://game/'), false, 'the game');
  assert.equal(isLauncherPage(null, null), false);
  assert.equal(isLauncherPage(null, 'dagger://launcherx/'), false, 'an origin that only begins the same way is not it');
  assert.match(main, /session\.defaultSession\.setPermissionRequestHandler\(\(wc, _permission, callback, details\) => callback\(!isLauncherPage\(wc, details\?\.requestingUrl\)\)\);/);
  assert.match(main, /session\.defaultSession\.setPermissionCheckHandler\(\(wc, permission, requestingOrigin\) => !isLauncherPage\(wc, requestingOrigin\) && permission !== 'deprecated-sync-clipboard-read'\);/,
    'the check side - and with no handler Electron grants every check but the deprecated synchronous paste, which the game keeps');
  const ready = main.slice(main.indexOf('app.whenReady().then(() => {'));
  assert.ok(ready.indexOf('setPermissionCheckHandler(') >= 0 && ready.indexOf('setPermissionCheckHandler(') < ready.indexOf('runLauncher();'), 'both fences stand before the first window');
});

// ---- the release notes -------------------------------------------------------

test('R2-C1: news is decided by what a line SAYS - app-v0.1.4534 lost four new fixes written where a deleted "Notes" section had stood', () => {
  // the real release, replayed from git's own objects (the file at app-v0.1.4534 and its -U0 diff from app-v0.1.4480):
  // the hunk that removed "## Notes" and its two lines added seven fixes, and position called the first four rewrites
  const fx = (f) => readFileSync(new URL(`fixtures/notes/${f}`, import.meta.url), 'utf8');
  const notes = addedNotes(fx('sea-4534.md'), fx('sea-4480..4534.diff'));
  assert.equal(`${notes}\n`, fx('sea-4480..4534.notes.md'), 'the body the release should have carried');
  for (const lost of ['- The sea at a distance no longer looks like large dark square panels', '- Along the coast, the ordinary water no longer draws',
    '- Creatures under the sea, and anything dropped there, now fade', '- Opening a window (the inventory, the map) while underwater']) {
    assert.ok(notes.includes(lost), `published: ${lost}`);
  }
  assert.doesNotMatch(notes, /## Notes|aren't in yet|are not in this update/, 'what the release deleted is not news');
  // the smallest shape of it: the section that said "not in this update" goes as the thing ships
  const head = '# Patch Notes: The Sea\n\n## Fixes\n- Swimming splashes in dungeon water.\n- Your boat stays where you left it.\n- Placing a boat while swimming puts it on the water.\n';
  const diff = '@@ -5,3 +5,2 @@\n-\n-## Notes\n-- Boats are not in this update.\n+- Your boat stays where you left it.\n+- Placing a boat while swimming puts it on the water.';
  assert.equal(addedNotes(head, diff), '# Patch Notes: The Sea\n\n## Fixes\n- Your boat stays where you left it.\n- Placing a boat while swimming puts it on the water.',
    'round 1 published nothing here: two lines added, three removed, "all rewrites"');
});

test('R2-C1: what a release only rewrote stays out - a typo, a restyle, one line split in two, a line moved to another section', () => {
  assert.equal(REWRITE_SHARE, 0.6);
  // below the share it is news, whatever small words it shares: 3 of these 7 words are the removed line's
  assert.equal(addedNotes('# S\n\n- The boat is saved with your game.\n', '@@ -3 +3 @@\n-- The boat is not in this update.\n+- The boat is saved with your game.'),
    '# S\n\n- The boat is saved with your game.');
  const head = '# T\n\n## Titles\n- Tabby is now a Developer.\n- Flylighter is now a Disciple.\n- SirMcMobdon is no longer an Apostle.\n\n## Fixes\n- **Your gear does not wear out on him.**\n';
  // one line split in three, restyled: most of each new line's words are the old line's
  const split = '@@ -4 +4,3 @@\n-- Tabby is now a Developer. Flylighter is now a Disciple. SirMcMobdon is no longer an Apostle.\n+- Tabby is now a Developer.\n+- Flylighter is now a Disciple.\n+- SirMcMobdon is no longer an Apostle.';
  assert.equal(addedNotes(head, split), '', 'a restyle is not news');
  // a line moved from one section to another: the same words, in another hunk
  const moved = '@@ -3,0 +4 @@\n+- Tabby is now a Developer.\n@@ -9 +8,0 @@\n-- Tabby is now a Developer';
  assert.equal(addedNotes(head, moved), '', 'moved, word for word, is not news');
  // a heading renamed is not news - headings only ever say where news sits
  assert.equal(addedNotes(head, '@@ -3 +3 @@\n-## Titles and glyphs\n+## Titles'), '');
  assert.equal(addedNotes(head, '@@ -8,0 +8 @@\n+## Fixes'), '', 'a heading added alone says nothing');
  // a plural, a possessive: "Boats keep their" is "A boat keeps its" restyled, not news
  assert.equal(addedNotes('# S\n\n- A boat keeps its cargo when saved.\n', '@@ -3 +3 @@\n-- Boats keep their cargo when saved.\n+- A boat keeps its cargo when saved.'), '');
  assert.equal(addedNotes('# S\n\n- The title is SirMcMobdon\'s now.\n', '@@ -3 +3 @@\n-- SirMcMobdon holds the title now.\n+- The title is SirMcMobdon\'s now.'), '');
  // ...and a rewrite beside news keeps the news, under its heading
  assert.equal(addedNotes(head, '@@ -10 +10 @@\n-- Your gear doesnt wear out on him.\n+- **Your gear does not wear out on him.**\n@@ -6,0 +7 @@\n+- SirMcMobdon is no longer an Apostle.'),
    '# T\n\n## Titles\n- SirMcMobdon is no longer an Apostle.');
});

test('R2-C4: every + line inside a hunk is content - a note that opens "++" was dropped as if it were the file header', () => {
  const head = '# Keys\n\n## Keys\n- One.\n++ and +++ both work as keys now\n';
  assert.equal(addedNotes(head, 'diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -4,0 +5 @@\n+++ and +++ both work as keys now'),
    '# Keys\n\n## Keys\n++ and +++ both work as keys now');
  // a second file's header in the same text is a header again, never content
  assert.equal(addedNotes('# A\n\n- a\n', 'diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -2,0 +3 @@\n+- a\ndiff --git a/y b/y\n--- a/y\n+++ b/y'), '# A\n\n- a');
});

test('R2-C4: the notes read every name git has - an accent, a space, a quote, a pattern character - and never a file that is not text', () => {
  const repo = mkdtempSync(join(tmpdir(), 'r2-notes-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 24 }).trim();
  const w = (f, t) => writeFileSync(join(repo, f), t);
  try {
    git('init', '-q');
    git('config', 'user.email', 'probe@example.invalid');
    git('config', 'user.name', 'probe');
    git('config', 'commit.gpgsign', 'false');
    w('PATCH-NOTES-[beta].md', '# Patch Notes: The beta\n\n## Beta\n- One.\n');
    w('PATCH-NOTES-a.md', '# Patch Notes: A\n\n## A\n- a1.\n');
    w('real.md', '# Patch Notes: Linked\n\n- Old text.\n');
    symlinkSync('real.md', join(repo, 'PATCH-NOTES-Linked.md'));
    git('add', '-A');
    git('commit', '-qm', 'first release');
    git('tag', 'app-v0.1.1');
    w('PATCH-NOTES-Café-Update.md', '# Patch Notes: The Café\n\n- Coffee.\n');
    w('PATCH-NOTES-Dagon’s-Fire.md', '# Patch Notes: Dagon’s Fire\n\n- A typographic apostrophe in the name.\n');
    w('PATCH-NOTES-"Quoted".md', '# Patch Notes: Quoted\n\n- A quote in the name.\n');
    w('PATCH-NOTES-[beta].md', '# Patch Notes: The beta\n\n## Beta\n- One.\n- Two, the beta\'s own.\n');
    w('PATCH-NOTES-a.md', '# Patch Notes: A\n\n## A\n- a1.\n- a2, which belongs to A and never to the beta.\n');
    unlinkSync(join(repo, 'PATCH-NOTES-Linked.md'));
    w('PATCH-NOTES-Linked.md', '# Patch Notes: Linked, now a real file\n\n- Notes never published before.\n');
    writeFileSync(join(repo, 'PATCH-NOTES-Utf16.md'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('# Patch Notes: UTF-16\r\n\r\n- Saved as Unicode.\r\n', 'utf16le')]));
    git('add', '-A');
    git('commit', '-qm', 'second release');
    const byFile = Object.fromEntries(patchNotesSince('app-v0.1.1', (args) => git(...args)).map((n) => [n.file, n.text]));
    assert.deepEqual(Object.keys(byFile).sort(), ['PATCH-NOTES-"Quoted".md', 'PATCH-NOTES-Café-Update.md', 'PATCH-NOTES-Dagon’s-Fire.md', 'PATCH-NOTES-Linked.md', 'PATCH-NOTES-[beta].md', 'PATCH-NOTES-a.md'].sort(),
      'git QUOTES these names without -z, and they were dropped; a UTF-16 file is left out rather than published as NULs');
    assert.equal(byFile['PATCH-NOTES-[beta].md'], '# Patch Notes: The beta\n\n## Beta\n- Two, the beta\'s own.', 'a name is never a pattern: A\'s line is not the beta\'s');
    assert.equal(byFile['PATCH-NOTES-a.md'], '# Patch Notes: A\n\n## A\n- a2, which belongs to A and never to the beta.');
    assert.equal(byFile['PATCH-NOTES-Linked.md'], '# Patch Notes: Linked, now a real file\n\n- Notes never published before.', 'a link that became a file brings the file whole');
    assert.doesNotMatch(composeReleaseNotes(Object.values(byFile).map((text) => ({ text }))), /\0|Old text/);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
