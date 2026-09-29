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
import fsModule, { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
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

// ---- ARENA2: every look at the disks off the main process (lane D) ---------------------------------------------

const L = createRequire(import.meta.url)('../app/lib/launcherState.cjs');
const { looseRoots, detectArena2 } = createRequire(import.meta.url)('../app/lib/arena2Detect.cjs');
const state = (over = {}) => L.initialState({ current: '0.1.4700', transport: 'updater', checkEnabled: false, ...over });
const apply = (s, ...events) => events.reduce(L.reduce, s);
const body = (decl) => {
  const at = main.indexOf(decl);
  assert.ok(at >= 0, `${decl} is in app/main.cjs`);
  const next = main.slice(at + decl.length).search(/\n(?:async )?function |\n\/\*\* |\nconst [A-Z_]+ = |\nlet |\nipcMain\.|\napp\./);
  return next < 0 ? main.slice(at) : main.slice(at, at + decl.length + next);
};

test('R2-D1: the saved folder is looked at BESIDE the window, never before it - a share that is down kept the launcher off the screen', () => {
  // round 1's L4-1 moved the search off the main process and left the saved folder on it: three blocking reads before
  // the window, and on a hard mount that never answers, no window at all. Measured on lane D's hung share since: the
  // launcher on screen in 0.36 s, "cannot be reached" at the deadline, and a quit with the probe stuck exits in 0.1 s.
  const run = body('function runLauncher()');
  assert.match(run, /setArena2\(null\);/);
  assert.doesNotMatch(run, /readdirSync|existsSync|statSync|askArena2\(|judgeArena2|resolveArena2/, 'nothing on the disk before the window');
  assert.ok(run.indexOf('win: openLauncherWindow()') < run.indexOf('if (savedDir) judgeSaved(launcher, savedDir);'), 'the window first');
  assert.match(body('function judgeSaved('), /if \(r\.dir\) setArena2\(r\.dir\);\s*launcherDispatch\(\{ type: 'saved-judged', \.\.\.r \}\);/);
  // meanwhile: the front door, Play held, the gem breathing - and a late answer changes nothing once decided
  const checking = state({ savedDir: '/nas/ARENA2' });
  assert.deepEqual([checking.setup.status, L.canPlay(checking), L.viewOf(checking).panel, L.viewOf(checking).busy], ['checking', false, 'news', true]);
  assert.deepEqual(L.viewOf(checking).options.files, { path: '/nas/ARENA2', note: '', label: 'Change folder' });
  // not whole with the game's own picker kept (the probe's env, a config from before): the picker, as before
  assert.equal(apply(state({ savedDir: '/nas/ARENA2', inGamePicker: true }), { type: 'saved-judged', missing: null, unreadable: true }).setup.status, 'skipped');
  assert.equal(apply(state({ savedDir: '/nas/ARENA2' }), { type: 'saved-judged', missing: null, unreadable: true }).setup.status, 'looking');
  assert.equal(L.reduce(apply(checking, { type: 'saved-judged', dir: '/nas/ARENA2' }), { type: 'saved-judged', missing: null, unreadable: true }).setup.status, 'ready', 'judged once');
  // a folder that did not answer in time is out of reach, and says so
  assert.deepEqual(folderAnswerOf({ late: true }), { missing: null, unreadable: true, late: true, cut: false });
  assert.deepEqual(folderAnswerOf({ failed: true }), { missing: null, unreadable: true, late: false, cut: false });
  assert.deepEqual(folderAnswerOf({ dir: '/a/ARENA2', missing: ['X'] }), { dir: '/a/ARENA2' });
  // an install downloaded meanwhile waits for the files to be SET - checking included (lane A A8)
  const waiting = apply(state({ savedDir: '/nas/ARENA2', checkEnabled: true }), { type: 'check-available', version: '0.1.4701' }, { type: 'downloaded', version: '0.1.4701' });
  assert.equal(L.nextStep(waiting), 'wait');
  assert.equal(L.viewOf(waiting).status, 'v0.1.4701 is ready to install');
  assert.equal(L.nextStep(apply(waiting, { type: 'saved-judged', dir: '/nas/ARENA2' })), 'install');
});

/** main.cjs's folderAnswer, run. */
function folderAnswerOf(a) {
  const src = main.slice(main.indexOf('function folderAnswer('), main.indexOf('/** The native folder dialog: the folder picked'));
  return new Function(`${src}; return folderAnswer;`)()(a);
}

test('R2-D4: the search goes on past its deadline, and a later find is added - never "go and get it" for a search cut short', () => {
  const looking = state();
  const none = apply(looking, { type: 'found', found: [], searching: true });
  assert.deepEqual([none.setup.status, none.setup.searching, L.viewOf(none).busy], ['none', true, true]);
  assert.match(L.viewOf(none).setup.detail, /^Still looking on slower drives - they are added here if they turn up\./);
  const late = apply(none, { type: 'found-more', found: { dir: '/mnt/steam/ARENA2', source: 'steam' } });
  assert.deepEqual([late.setup.status, late.setup.found.map((f) => f.dir)], ['found', ['/mnt/steam/ARENA2']]);
  assert.equal(L.viewOf(late).setup.found[0].primary, true, 'the one thing found is the card\'s answer');
  assert.deepEqual(apply(late, { type: 'found-more', found: { dir: '/mnt/steam/ARENA2', source: 'steam' } }).setup.found.length, 1, 'once');
  assert.equal(apply(late, { type: 'found-more', found: { dir: '/b/ARENA2', source: 'folder' } }).setup.found.length, 2);
  const refused = apply(none, { type: 'picked-bad', missing: null }, { type: 'found-more', found: { dir: '/c/ARENA2', source: 'gog' } });
  assert.deepEqual([refused.setup.status, refused.setup.found.length], ['bad', 1], 'offered on a refusal\'s card too');
  // once the player has chosen - a folder, or the game's own picker - a late find is nothing
  assert.equal(apply(apply(none, { type: 'picked', dir: '/x' }), { type: 'found-more', found: { dir: '/y', source: 'steam' } }).setup.found.length, 0);
  assert.equal(apply(none, { type: 'skip-setup' }).setup.searching, false);
  assert.equal(apply(none, { type: 'picked', dir: '/x' }).setup.searching, false, 'and the search is let go');
  const done = apply(none, { type: 'detect-done' });
  assert.equal(done.setup.searching, false);
  assert.doesNotMatch(L.viewOf(done).setup.detail, /Still looking/, 'concluded: the card says where to get it, plainly');
  assert.equal(L.viewOf(done).busy, false);
  assert.equal(apply(looking, { type: 'found-more', found: { dir: '/z', source: 'dfu' } }).setup.found.length, 0, 'before the deadline the finds are the shell\'s to hold');
});

test('R2-D5: on a Mac the privacy-guarded folders are read LAST - after ~/Games, as "only when nothing else was found" says', () => {
  const roots = looseRoots({ platform: 'darwin', home: '/Users/p', env: {} }, ['/Users/p/Downloads']);
  assert.deepEqual(roots.map((r) => [r.dir, r.guarded]), [
    ['/Users/p/Games', false], ['/Users/p/Downloads', true], ['/Users/p/Desktop', true], ['/Users/p/Documents', true],
  ]);
  assert.deepEqual(looseRoots({ platform: 'linux', home: '/h', env: {} }, []).map((r) => r.dir), ['/h/Downloads', '/h/Desktop', '/h/Documents', '/h/Games'], 'elsewhere the order stands');
  // run: the files in ~/Games, and not one guarded folder read on the way (each read would be a system prompt)
  const home = mkdtempSync(join(tmpdir(), 'r2-mac-'));
  try {
    const a2 = join(home, 'Games', 'Daggerfall', 'arena2');
    for (const d of [a2, join(home, 'Downloads'), join(home, 'Desktop'), join(home, 'Documents')]) fsModule.mkdirSync(d, { recursive: true });
    for (const n of ['ARCH3D.BSA', 'BLOCKS.BSA', 'MAPS.BSA', 'MONSTER.BSA', 'WOODS.WLD', 'TEXT.RSC', 'ART_PAL.COL']) writeFileSync(join(a2, n), 'x');
    const read = [];
    const fs2 = new Proxy(fsModule, { get: (t, k) => (k === 'readdirSync' ? (d, o) => { read.push(String(d)); return t.readdirSync(d, o); } : t[k]) });
    const found = detectArena2({ platform: 'darwin', home, env: {}, fs: fs2, regQuery: () => [] });
    assert.equal(found.length, 1);
    const guarded = read.filter((d) => ['Downloads', 'Desktop', 'Documents'].some((g) => d.startsWith(join(home, g))));
    assert.deepEqual(guarded, [], 'three prompts for files that were elsewhere');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('R2-D6/D7/D8: the doors - a refusal said where it can be seen, "cannot be read" said as such, a saved folder never lost to one launch\'s choice', () => {
  // D7: decided once the answer is in - during the search a refusal meant for the card was dropped without a word
  const choose = body('async function launcherChooseFolder()');
  assert.doesNotMatch(choose, /const onCard = viewOf/, 'not decided before the dialog');
  assert.match(choose, /if \(reduce\(l\.state, \{ type: 'picked-bad', \.\.\.r \}\)\.setup\.status === 'bad'\) \{ launcherDispatch\(\{ type: 'picked-bad', \.\.\.r \}\); return; \}\s*await launcherDialog\(\(\) => dialog\.showMessageBox\(l\.win,/);
  assert.equal(L.reduce(state(), { type: 'picked-bad', missing: null }).setup.status, 'looking', 'the card while looking cannot say it - so the box does');
  // D8: a found folder whose drive went away is "could not be read", not "holds no Daggerfall files"
  const gone = apply(state(), { type: 'found', found: [{ dir: '/usb/ARENA2', source: 'folder' }] }, { type: 'picked-bad', missing: null, unreadable: true });
  assert.equal(L.viewOf(gone).setup.title, 'That folder cannot be read');
  assert.match(L.viewOf(gone).setup.detail, /^It could not be read - is its drive connected\?/);
  // D3 (words): a pick that did not answer in time, or whose search ran out of budget, is never "no Daggerfall files"
  assert.match(L.notArena2Detail(null, { unreadable: true, late: true }), /^It did not answer in time - is its drive asleep, or disconnected\?/);
  assert.match(L.notArena2Detail(null, { cut: true }), /^It holds too many folders to look through them all\./);
  assert.match(L.notArena2Detail(['MAPS.BSA'], { cut: true }), /^It has no MAPS\.BSA\./, 'a partial folder names what it lacks, cut or not');
  // D6: the game's own picker chosen on the SAVED folder's card is this launch's alone - kept, it hid the folder for good
  const acts = main.slice(main.indexOf("ipcMain.on('launcher:act'"), main.indexOf('// THE NAVIGATION FENCES'));
  assert.match(acts, /saveConfig\(st\.setup\.saved \? \{ \.\.\.loadConfig\(\), arena2IngestClear: true \} : \{ \.\.\.loadConfig\(\), arena2InGame: true \}\);/);
  // D8, the shell's half: the whole answer reaches the card - unreadable and late with it
  assert.match(acts, /case 'use-found': \{[\s\S]*?if \(r\.dir\) useArena2\(r\.dir\);\s*else launcherDispatch\(\{ type: 'picked-bad', \.\.\.r \}\);/);
  // one judgment at a time, and an install waits on it as on a dialog
  const judge = body('async function judgeForLauncher(');
  assert.match(judge, /if \(!l \|\| l\.judging\) return null;/);
  assert.match(judge, /return await launcherDialog\(async \(\) => folderAnswer\(await askArena2\(question, \{ deadline, signal: l\.stop\.signal \}\)\)\);/);
  assert.match(choose, /if \(!launcher \|\| launcher\.state\.launch \|\| launcher\.judging\) return;/);
  assert.equal(L.viewOf(apply(state({ arena2Dir: '/a' }), { type: 'judging', on: true })).busy, true);
});

test('R2-E5: a Mac\'s refusal points at DaggerfallGameFiles.zip, never Steam or GOG, and keeps its door', () => {
  const mac = L.notArena2Detail(['MAPS.BSA'], { platform: 'darwin' });
  assert.match(mac, /Choose the arena2 folder inside the unpacked DaggerfallGameFiles\.zip\.$/);
  assert.doesNotMatch(mac, /Steam|GOG/);
  const bad = apply(state({ platform: 'darwin' }), { type: 'found', found: [] }, { type: 'picked-bad', missing: null });
  assert.deepEqual(L.viewOf(bad).setup.actions.map((a) => [a.id, a.arg ?? null]), [['choose-folder', null], ['open', 'zip'], ['skip-setup', null]]);
  assert.doesNotMatch(L.viewOf(bad).setup.detail, /Steam|GOG/);
  const win = apply(state(), { type: 'found', found: [] }, { type: 'picked-bad', missing: null });
  assert.deepEqual(L.viewOf(win).setup.actions.map((a) => a.id), ['choose-folder', 'skip-setup']);
  assert.match(body('async function locateArena2('), /detail: notArena2Detail\(r\.missing, \{ \.\.\.r, platform: process\.platform \}\),/, 'the File menu\'s door says it the same way');
});

// ---- the update lifecycle (lane A) ------------------------------------------------------------------------------

test('R2-A2: a check made while a download runs never takes the download\'s place - its token, and its end, stay the download\'s', async () => {
  // askUpdater, run against electron-updater's own rule: a check during a download returns the SAME download under a
  // NEW token that stops nothing (AppUpdater.downloadUpdate, 6.8.9)
  const src = main.slice(main.indexOf('function askUpdater()'), main.indexOf('/** DA10: news.json'));
  const events = [];
  let settle = null;
  let running = null;
  let fail = false;
  const au = {
    checkForUpdates: async () => {
      if (fail) throw new Error('HTTP 500');
      const token = { id: Math.random() };
      running ??= new Promise((res, rej) => { settle = { res, rej }; });
      return { cancellationToken: token, downloadPromise: running, updateInfo: { version: '0.1.4701' } };
    },
  };
  const shell = new Function('autoUpdater', 'stopStallWatch', 'launcherDispatch', `let downloading = null;\n${src}\nreturn { askUpdater, now: () => downloading };`)(
    () => au, () => events.push('stop-watch'), (ev) => events.push(ev.type));
  const first = await shell.askUpdater();
  const token = shell.now().token;
  assert.equal(token, first.cancellationToken, 'the check that STARTED the download keeps its token');
  const second = await shell.askUpdater();
  assert.notEqual(second.cancellationToken, token);
  assert.equal(shell.now().token, token, 'a later check\'s token stops nothing - it is never taken');
  fail = true;
  await assert.rejects(shell.askUpdater(), /HTTP 500/, 'a CHECK that fails rejects its own promise');
  assert.deepEqual(events, [], 'and is no download\'s failure');
  settle.rej(new Error('ECONNRESET'));
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(events, ['stop-watch', 'download-failed'], 'the download breaking off is said once, by the download');
  assert.equal(shell.now(), null, 'and the next check may start afresh');
  // the hourly re-check never asks over a running download
  assert.match(main, /if \(!updateReady && !installStarted && !downloading\) askUpdater\(\)\.catch\(\(\) => \{\}\);/);
  assert.match(body('async function checkForUpdatesViaUpdater()'), /try \{ result = await askUpdater\(\); \}/, 'the File menu\'s check too - one place keeps the download');
});

test('R2-A1/A5: an update\'s quit hands the lock to the new copy - and a quit queued behind an install that already failed is held', () => {
  const quitFor = main.slice(main.indexOf("require('electron').autoUpdater.on('before-quit-for-update'"), main.indexOf('/** AUDIT INSTALL L2-2/L2-3: THE ONE DOOR'));
  // A5 first: the install already failed (NSIS: the spawn's error lands before electron-updater's queued quit) - held
  assert.match(quitFor, /if \(installFault\) \{ holdQuit = true; return; \}\s*leaveForUpdate = true;/);
  // A1: the new AppImage is started before this copy quits - the lock is released so its requestSingleInstanceLock is yes
  assert.match(quitFor, /leaveForUpdate = true;\s*(\/\/[^\n]*\n\s*)*app\.releaseSingleInstanceLock\(\);\s*\}\);/);
  assert.match(quitFor, /app\.on\('before-quit', \(e\) => \{ if \(holdQuit\) \{ holdQuit = false; e\.preventDefault\(\); \} \}\);/);
  assert.match(body('function installNow('), /installStarted = true;\s*installFault = false;/, 'each try starts clean');
  assert.match(body('function installFailed()'), /installStarted = false;\s*installFault = true;/);
  assert.equal((main.match(/releaseSingleInstanceLock\(\)/g) ?? []).length, 1, 'only an update\'s quit gives it up');
});

test('R2-A6/A10: the in-game switch starts the hourly check; the File menu\'s check never says "up to date" off a check never made', () => {
  const sw = body('function setCheckOnLaunch(');
  assert.ok(sw.indexOf('if (on) startRechecks();') >= 0 && sw.indexOf('if (on) startRechecks();') < sw.indexOf('if (!launcher) return;'), 'before the launcher-only half returned');
  const manual = body('async function checkForUpdatesViaUpdater()');
  assert.match(manual, /if \(!result\) \{ await checkForUpdates\(\); return; \}/, 'electron-updater declined: GitHub is asked directly');
  const loud = main.slice(main.indexOf('async function checkForUpdatesViaUpdater'), main.indexOf('/** { tag, url, download } of the latest release'))
    + main.slice(main.indexOf('async function checkForUpdates()'), main.indexOf('/** While the app runs, ask again'));
  assert.doesNotMatch(loud, /dialog\.showMessageBox\(/, 'no box without a window over it');
  assert.match(body('function tellBox('), /const parent = BrowserWindow\.getFocusedWindow\(\) \?\? \(gameWindow && !gameWindow\.isDestroyed\(\) \? gameWindow : null\);\s*return parent \? dialog\.showMessageBox\(parent, opts\) : dialog\.showMessageBox\(opts\);/,
    'over the window found - a parentless box can open behind a fullscreen game');
  assert.match(main, /appImage: !!process\.env\.APPIMAGE,/, 'the table knows whether this copy runs as its AppImage');
});
