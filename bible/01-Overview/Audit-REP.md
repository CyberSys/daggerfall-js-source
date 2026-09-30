# AUDIT REP - the reputation overhaul, read end to end, 2026-09-30

Mac: *"Audit this"*, of REP1-REP6 as it was pushed at `b65f7691d` (`06-Systems/Standing-Arc.md`; Port-Ledger A, "THE
LAW, MUCH BETTER AND STILL PUNISHING"). Every door into the law was read against the arc page's own claims: each way a
court opens, both clocks a term or a stop reads, both street hosts' gates, the temple's service flow, every writer of a
legal standing, and the retired levy's readers and records.

Every finding below was checked against the code before it was fixed and pinned by a test that fails on the code as
REP shipped it: `test/auditrep.test.js` (7). Mutation-proven: `tools/mutants/auditrep.json` 17 records, all dead. Each
fix carries an `AUDIT REP F<n>` comment. Two older pins moved with it, each marked PIN MOVED: `rep3_banishment`'s short
purse (F4) and `audit39_guildstravel`'s F99, whose court now banishes on the trusted calendar (F2). Five court rigs that
model a convict already past the surrender box now record the box's charge (`prisonrelease`, `roadb_court_backdrop`,
`jailhit`, `audit18_systems_social`, `audit39_guildstravel`). Without it the court charged them again (F1), and in
`prisonrelease` the lower standing let `Math.random`'s banishment roll decide two pins.

## Fixed

| ID | Sev | Finding | Fix |
|---|---|---|---|
| F1 | High | **A murder could raise the name.** The surrender box charged the crime it asked about, but the fatal blow's surrender (and a Y read after the world moved under the box) opened the court for the crime held NOW. A townsperson murdered after the box was tried without ever being charged, and REP2's refund then credited the sentence: a Theft at 0 went to -8, then +2 after the Murder was served. | `arrestFlow.js startCourtFlow` charges the crime it tries (`chargeOnce`, once per chase as before), before `startCourt` prices the fine (DFU's order: the loss, then the court). A door that already charged (the box, the watch's stop) charges nothing more. |
| F2 | Medium | **A fast machine clock ended a banishment for good.** A banishment's term read `worldMinutes()`. Online, the boot's frames run on this machine's clock until the relay's welcome corrects it, so a clock set a month fast lifted the banishment on the first frame, and nothing put it back. This is AUDIT LIVED1b P4's exploit shape, on the new term. Also, before the correction, a pre-REP banishment's term would have been stamped at NaN, the Standing page dropped a banishment whose days it could not count, and the priest would have said "for NaN more days". | `worldTick.js trustedWorldMinutes`: online it is NaN until the relay's clock is heard, and offline it is the one clock. `standing.js`: an untrusted read neither stamps nor lifts a term, and a banishment is left without one until the first trusted read. Every reader uses it: both street hosts, the temple, the court's banishment, the Standing page. The page and the priest say "banished" without a number of days while the term is unknown. |
| F3 | Medium | **The watch stopped a player mid-fight.** The stop's gates held off windows, the travel view and a raid, but not a fight. A foe that could see the player, or a duel, still got the box (it has no Escape). Online, the world runs on under a window, so the player stood in the box while the blows landed. | Both hosts' `blocked`: `areEnemiesNearby(exteriorFoes.foes)` (a hostile foe that sees the player), plus `duelEnemyNear()` on the world host. City guards are not counted, because a crime already held stops the look anyway. |
| F4 | Medium | **A paid pardon went on into the donation field.** The temple's offers were queued ahead of DFU's donation box, which opens pre-filled with 1000. After a pardon (2,500) or a penance was paid, the priest asked again and then showed the field, so one more reflexive Return gave away another 1,000 gold. | `guildServiceWindows.js standingOffers` is now a chain. A Yes that is paid is the flow's last box. A Yes the purse cannot cover says so and offers what is left (a cheaper penance), never the field. Only a No goes on to the next offer and then to DFU's donation. |
| F5 | Low | **A raid defended changed the law in silence.** RAID1's +5 wrote the store directly. It was the one change with a cause that REP5's "a notice on every change" never said. | `raidingParties.js grantRaidReputation` now goes through `changeLegalRep` with `{ kind: 'raid' }`, keeping the mod's clamp (the delta is what the clamp lets through): *"Wayrest thanks you for its defence (+5). You are ..."*. The raid's clamp mutant was re-aimed (`raid1.json`, dead). |
| F6 | Low | **Three comments still called the retired levy live.** `court.js`, `regionConditions.js` and `arrestFlow.js severePunishment` said `encounters.js passiveGuardSpawns` reads the banishment bit every catch-up minute. It has had no production caller since REP1, and the bit has been written by `standing.js banish` since REP3. | The comments are corrected. `passiveGuardSpawns` is kept (DFU's law as ported, for its pins and for a mod that wants the old watch) and its JSDoc says it has no caller. A pin keeps the levy out of the hosts. |
| F7 | Medium | **The watch saw an invisible criminal.** `guardSeesPlayer` measures range, a cone and a clear line, not magic, so the stop fired through Invisibility, although the town's crime witness (`town.gate`'s `isInvisible`, DFU's S19) does not. | `standingHost.js`: an invisible player is nobody's face, the same as a transformed lycanthrope. The guard is not even asked. |

## Checked and sound

- **Every court door charges.** The surrender box, the fatal blow, the watch's "come quietly" and a Y read late all charge once (F1 closed the last gap). A second wave charges nothing more. A worse crime is charged as itself. The chase ends with the crime (`cityGuards.js`, every frame) and with a load (`arrestFlow.js abandon`).
- **A load ends the trial.** `worldQuickLoad` calls `arrestFlow.abandon()` after the restore, so a loaded character's own crime is charged at its own first box.
- **The save.** `standing` (four plain maps) and `banishedUntil` round-trip, and a pre-REP save restores empty. The server keeps no allowlist that would strip them.
- **The stop's box works by key, click and pad.** Its rows are clickable, and on pad or touch they are buttons.
- **The drift.** The weekly recovery walks each world minute once (LIVED1 I's spans), including across an absence, and the absence is paid only when the relay's clock is heard (P4).

## For Mac

1. **A bounty contract pays above zero.** `rewardContract` gives +2 up to the band's top (+100), so contracts raise a good name as well as mend a bad one. Should they stop at zero, the way a penance does?
2. **An online death keeps the crime.** The respawn does not answer for it, so the watch still hunts. If a watchman fell in the chase, an involuntary surrender stays refused, but a voluntary one (Y at the next wave's box) is always taken. DFU has no respawn to compare with. Should dying answer for the crime?
3. **The numbers are first cuts** (the arc page's list): two game hours between stops, a day's grace, 30 days of banishment, a pardon at 2,500 x n, a penance at 200 x n for five points, a contract +2, a week's recovery.

Not verified in a browser.
