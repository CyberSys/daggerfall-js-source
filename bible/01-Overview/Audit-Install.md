# Audit Install - the install, update and first-run work, audited before it merged

Mac, 2026-09-29: *"Yes please and audit what we have so far"* - of PR
#429's install work: REL4 (the release published whole), REL5 (names
that do not move), DA8 (the launcher), DA9 (the game files found) and,
landing beside the audit, DA10 (the launcher stays). Five independent
lanes read the PR head (226f32bc) - security, the update lifecycle, the
release pipeline, ARENA2 detection, and the tests, docs and the player's
eye - each proving what it could by execution: the real
electron-updater 6.8.9 code under a stubbed app, Electron 42 under xvfb,
node over temp trees, replays of the release script over the
repository's own tags, headless Chromium over the launcher page, and 49
mutants of lane 5's own (all 49 survived the suites as they stood).

Every finding a lane VERIFIED was fixed at its root and pinned - in
`test/audit_install.test.js` or beside the slice it belongs to (da8,
da9, da10, rel4, autoupdate, updatecheck), with
`tools/mutants/auditinstall.json` (71, all dead) and the slices' own
lists re-aimed by content. SUSPECTED findings are fixed where the fix
is sound whatever the answer, and said so. Findings are named L<lane>-<n>
in the lane's own numbering.

## The update lifecycle (lane 2)

- **L2-1 (P1): a download that failed or stalled held the launcher on
  "Downloading" for ever.** Every updater error reached the launcher as
  `check-failed`, which the reducer takes only while checking; and
  builder-util-runtime arms its socket timeout on a `socket` event that
  Electron's `net.ClientRequest` never emits, so a stalled download had
  no end at all. Errors are routed by where they land (`download-failed`
  under a download: a `failed` status, Play freed, the hourly re-check
  or the next launch tries again), and a download that goes
  DOWNLOAD_STALL_MS (45 s) without a byte is cancelled through the
  check's own CancellationToken. The download's promise is answered, so
  a failure is the error event's, never an unhandled rejection.
- **L2-2 (P1): two "Restart to install" answers installed twice - and on
  Linux the second deleted the AppImage.** electron-updater treats a
  second `quitAndInstall` as ignored and then CLEARS its own
  installed-already flag, so its quit handler installs again: over the
  AppImage the first had just put in place, which `doInstall` unlinks
  before its `mv` fails (proven in the library with real temp files).
  One door to the installer now (`installNow`, once), the restart asked
  once at a time, over the game window (a parentless box could open
  twice, behind a fullscreen game).
- **L2-3 (P1, the mechanism proven, the trigger suspected): a failing
  installer would close the app on every launch.** NSIS reports success
  before its spawn is known, and a cached download re-emits
  `update-downloaded` within a second of launch - so an installer an
  antivirus quarantines, or a folder the player cannot write, made the
  app unlaunchable, where install-on-quit (DA7) had made it harmless.
  The version is written down before the installer is handed the app
  (`config.json installAttempt`); a launch still older than it knows the
  installer did not take, and never tries it before play again - it
  says so (`stuck`: "v... did not install"), frees Play, offers the
  installer to run by hand, and tries again at quit. A NEWER version
  gets its own try.
- **L2-4 (P2): an install that failed on the spot was silent, and left
  the unload guard waived for the session.** `leaveForUpdate` was set
  when the player CHOSE to restart; an AppImage the player cannot write
  fails inside `install()`, no quit follows, and every close and reload
  after it left without asking. It is set only by electron-updater's own
  `before-quit-for-update`, which comes after `install()` succeeded; an
  error while the installer was being handed the app is the install's
  (`installFailed`): the launcher shows `stuck`, the game says "The
  update could not be installed", with the installer.
- **L2-5 (P2): the game's menu grew on the launcher** - Electron's
  `setApplicationMenu` sets the menu on every window on Windows and
  Linux (the launcher 27px taller, File/View at the handover and on a
  notice), and File > Locate ARENA2 acted on the launcher. Fixed with
  DA10 (the launcher's menu stripped after every build; Locate is the
  launcher's own door while it is open).
- **L2-6 (P2): a notice that answered after the launcher let the player
  in was told to no one**, and every re-check after it saw nothing new.
  A notice is told ONCE, by whoever can (`tellNotice`): the launcher when
  it took it, else the game - now, or at its first load.
- **L2-7, L2-9 (P2/P3): "What's new" lost its notes** (reset by a second
  `update-available`, dropped before it was seen). Superseded: DA10
  replaced "What's new" with the news panel.
- **L2-8 (P3): a manual check after a finished download** re-told the
  game (a second HUD line) and said "downloading". The same download
  reported again is not news twice, and the check says "ready".
- **L2-10 (P3): closing the launcher during "Starting" still opened the
  game**, from the hidden window behind it. Closed by the player while
  the game was coming up, the hidden game window goes with it. (On
  macOS the dock click now opens the launcher - DA10.)
- **L2-11 (P3): a packaged Linux copy outside its AppImage waited the
  full 8 s** on "Checking" - electron-updater resolves `null` and emits
  nothing. `null` is said at once.

## Security (lane 1)

No P0 or P1 in the app. The launcher's file serving, IPC sender checks,
CSP, text-only notes, `openExternal` allowlist and the sandbox held under
live attack (Electron 42, Playwright).

- **L1-1 (P2): a symlinked PATCH-NOTES file would publish runner files -
  the publish job's write token among them - in the release body.** The
  `notes` command read each file from the working tree, and checkout
  leaves its token in `.git/config`. The notes are read from git's own
  objects now (`git show HEAD:`, a file that is not a regular file at
  HEAD - a link, a submodule - never read), and every checkout in the
  workflow sets `persist-credentials: false` (nothing there pushes).
- **L1-2 (P3): the launcher had only the app-wide fences** - it could
  navigate to an https page (handed to the browser) or a dagger://game
  page (with its bridge still on it), and was granted every permission
  (the clipboard read back). It navigates nowhere, opens nothing, is
  granted no permission, and its IPC is heard only from its own page.
- **L1-3 (P3): the unload guard's question could be raised without
  end** by a page's own navigations (21 boxes from 20 reloads, each
  freezing the main process). It is asked when the PLAYER leaves - the
  window closing (Electron's `close` precedes the page's beforeunload,
  measured), a quit, View > Reload - and a page-started navigation is
  kept, as Electron always kept it.
- **L1-4 (P3): `reg` was looked up in the current folder first**
  (libuv's search_path). `System32\reg.exe` by its own path.
- **L1-5 (P3, write access needed): a tag name reached bash in the build
  legs** (`npm version "${{ ... }}"`; git accepts quotes and `$` in a
  tag). The version job fails unless the tag is `app-v<n>.<n>.<n>`, and
  the number reaches scripts through the environment.

## The release pipeline (lane 3)

- **L3-1 (P1): the landing page's download links are dead from the merge
  until the first REL5 release is `latest`** - the site deploys in
  ~3 minutes, the release takes ~10, and the current latest release
  carries only versioned names (a 302 to a 404, measured). Not fixable
  in code without the site's deploy waiting on the release. **Before
  merging #429: upload the four downloads under their REL5 names to the
  current latest release** (`gh release download` the four files from
  app-v0.1.4684, rename them `DaggerfallOnline-win-x64-setup.exe`,
  `-win-x64-portable.exe`, `-mac-arm64.dmg`, `-linux-x86_64.AppImage`,
  `gh release upload` them; the manifests untouched) - or merge the
  landing page's link change after the first REL5 release. Seeding
  `DaggerfallOnline-win-x64-setup.exe.blockmap` too makes the first
  update across the rename a delta. Desktop-App.md's "before a dead link
  goes live" says this exception now.
- **L3-2 (P2): a tag that already had a PUBLISHED release was re-cut in
  place.** softprops/action-gh-release (v2 = 2.6.2) updates an existing
  release, ignoring `draft`, deleting and re-uploading each file on the
  live release. The publish job refuses a tag with a published release
  ("cut a new tag"); a draft a failed run left is still reused.
- **L3-3 (P2): the notes republished whole files that were only
  edited**, and the launcher's news repeated them (the Overworld notes,
  first shipped in app-v0.1.4556, again in every release that appended a
  line). An added file is its notes whole; a changed one brings only
  what it ADDS (each hunk's lines beyond the ones it rewrites, under the
  nearest heading and the file's title) - a correction is not news. A
  rename brings nothing, names with a dot or an underscore are read, and
  the newest change comes first. Replayed on app-v0.1.4480..4534 and
  4615..4644.
- **L3-4 (P2): a dispatched "try this build" replaced itself with the
  public release before it ran** - it carried `app-update.yml`, and
  DA8's launcher installs before play. An artifacts-only run is built
  with `publish: null` (explicitly: absent, electron-builder derives
  GitHub from `repository` and writes it anyway; a CLI `-c.publish=null`
  stays the string "null"), and a copy without the file takes the notice
  transport.
- **L3-5 (P3): any API error read as "nothing is latest yet"**, so a 5xx
  could hand an old re-cut `latest`. Only a 404 does; anything else
  fails the step.
- **L3-6 (P3, documented platform behaviour): "runs queue rather than
  cancel"** was true of ONE waiting run - GitHub cancels an older waiting
  run in the group when a newer one queues. Main pushes keep one group
  (the newest waiting merge is cut next, carrying the others); a manual
  door is a group of its own.
- **Not done, and why:** pinning softprops/action-gh-release to a commit
  SHA (lanes 1 and 3) - the session's repository scope does not reach
  softprops' repository to read the SHA. The guard above makes REL4
  independent of softprops' update path; the pin is a one-line follow-up.

## ARENA2 detection (lane 4)

No P0 or P1: REQUIRED_ARENA2 holds for every real distribution checked
file by file (DaggerfallGameFiles.zip, GOG 1.07, Steam).

- **L4-1 (P2): detection blocked the main process with no time limit**
  (a hung reg.exe: 6 s, fully synchronous; a down network mount: no
  window ever). It runs in a worker thread (which loads from inside
  app.asar - measured) under DETECT_DEADLINE_MS, its finds streamed.
- **L4-2 (P2, suspected): up to three macOS privacy prompts on a first
  run.** Downloads, Desktop and Documents are read on a Mac only when
  nothing else was found, and the prompt says why
  (`NS*FolderUsageDescription`).
- **L4-3 (P2): missed layouts** - "Extract Here" (a bare `arena2/` in
  Downloads), Known Folder Move and localized XDG folders
  (`app.getPath` now), links and junctions (followed, once). Found.
- **L4-4 (P2): picking the Steam game folder answered "It holds no
  Daggerfall files".** The pick is searched with the same bounded walk;
  a folder that cannot be read is said to be unreadable.
- **L4-5 (P2): a saved folder that failed was met as a first run.** It
  is named ("Your Daggerfall folder cannot be reached / is not whole"),
  with Try again.
- **L4-6 (P3): "on Steam and GOG it is under DF/DAGGER/ARENA2"** - GOG's
  arena2 is in the game folder. The words, the in-page picker's too, and
  the fixtures (Steam's real installdir is "The Elder Scrolls
  Daggerfall").
- **L4-7 (P3):** GOG by Daggerfall's product key, whatever the folder is
  called. **L4-8 (P3):** `reg.exe` by path, read through `reg export`'s
  UTF-16 file (`reg query`'s pipe is the OEM code page). **L4-9 (P3):**
  a whole `ARENA2` beside a partial `arena2`. **L4-10 (P3):** a Mac's
  `/Applications` (this app's own bundle) no longer walked - GOG sells
  Daggerfall for Windows only. **L4-11 (P3):** the in-game choice is
  kept (DA10), and ended by a folder chosen from any door. **L4-12
  (P3):** DFU's older macOS settings folder.

## Tests, docs and the player's eye (lane 5)

- **L5-1 (P1): nothing held the dialogs' answers** - "Not now" wired to
  restart, Escape to Restart, Enter to Leave, or the labels swapped, all
  survived. The questions are data (`app/lib/shellDialogs.cjs`): the
  safe answer is every question's cancel, and on "Leave the game?" its
  default too; the probe records the question actually asked and
  answers by label.
- **L5-2 (P1): the landing page said the portable exe updates itself.**
  It says what each download does.
- **L5-3 (P1): a Mac player was sent to Steam and GOG**, which sell
  Daggerfall for Windows only. The Mac's first run points at
  DaggerfallGameFiles.zip; the page no longer promises Steam or GOG.
- **L5-4:** = L2-1. **L5-5 (P2):** a probe scenario with a whole saved
  folder (asked nothing, the news, Play). **L5-6 (P2):** the pick's
  seven-file law pinned (a mutant that took any folder survived).
  **L5-7 (P2):** the mid-session path pinned line by line.
  **L5-8/L5-9:** superseded by DA10 ("What's new" was never "every
  version between": the list is the latest 20 releases).
- **L5-10 (P2): the release script's commands never ran in a test.**
  They are spawned: a set one short exits 1, `latest` prints what the
  publish job reads, an unknown command is a usage error.
- **L5-11 (P2): the REL5 name pin did not model electron-builder** (it
  read `AppImage`; the key is `appImage`, and platform blocks win over
  the top level). It resolves names by electron-builder's own precedence.
- **L5-12 (P2): the Enter key was pinned against one spelling.** The
  focus rule is pinned, and the probe checks Enter plays.
- **L5-13 (P2): detection untested outside Linux Steam/DFU.** Per-platform
  fixtures, the `.reg` parser, links, the Mac's guarded folders.
- **L5-14 (P2): with several folders found, the actions fell off the
  window.** The card scrolls from its top (`justify-content: safe
  center` - plain `center` overflowed both ways), and the bar has one
  height in every state.
- **L5-15 (P2, suspected - no Mac here): the unsigned Mac app would be
  "damaged".** electron-builder 25 signs only with a keychain identity,
  and the bundle it re-plisted kept Electron's now-broken signature. An
  afterPack hook signs it ad hoc and verifies the signature (a broken one
  fails the build); the landing page's Mac advice is Open Anyway.
  **Unverified on hardware**, like every Mac path here.
- **L5-16:** = L4-2. **L5-17 (P2):** one small live region (the stage
  line), a named progress bar with its MB as `aria-valuetext`, text
  written only when it changed. **L5-18 (P2):** Desktop-App.md's stale
  names and claims restated.
- **L5-19 (P3): the docs overclaimed** ("the whole flow is driven
  headless" - every probe run has the update check off). Said as it is.
  **L5-20 (P3):** probe checks that could pass for the wrong reason
  (the saved-folder card now names what it refused; polls, not sleeps;
  the launcher's own URL awaited). **L5-21 (P3):** loose pins tightened
  - every colour word checked (not only hex), every HTML sink, one
  bridge, the redraw cache, the link handler, a found folder judged when
  taken. **L5-22:** = DA10's every-pick ingest clear. **L5-23 (P3):**
  small text at WCAG AA (#a89f88, 7.2:1; #7d7460 is 4.1-4.4:1 and stays
  on rules and borders). **L5-24 (P3):** Enter never presses a folder
  just refused; each "Use these files" is named for its folder; "Check
  for Updates Automatically" (it gates the launch check, the news and
  the hourly re-check); the notice says "put it in place of this copy".
