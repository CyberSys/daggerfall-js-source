# AUDIT TIMEFREE - online quests that are not time, and the wear, read before they merge (2026-10-02)

Mac: *"Audit this and ensure its perfect"*, of TIMEFREE (`06-Systems/Online-Time-Arc.md` 6.3b - a quest clock online
is a deadline that never runs out or a delay that lands on the short wait) and WEAR-ONE (`05-Combat/Physical-Combat-Overhaul.md`
- the port's wear back to DFU's amount). Two lenses:

- **R** the reading - every one of the 399 vendored clocks classified, every flip read against its script by hand, the
  main quest's whole (S0000*, `_BRISIEN`); what each clock's end does, what starts it, who reads it and how;
- **S** the seams - every reader of a clock's time (the journal walk, the lens, the herald, the rail, the tracker, the
  marks), every machine the hosts build, the party resync, the save, the curse arms' walk, the crime guilds' clock,
  the bounties' board and party share, the letter's town hold, the words in the quest texts, the wear's callers.

Every finding was checked against the script and the code before it was fixed. Pins: `test/audit_timefree.test.js`
(and `test/timefree.test.js`'s split); each fix carries an `AUDIT TIMEFREE <ID>` comment. Campaign
`tools/mutants/audit_timefree.json`: 14, all dead; `tools/mutants/timefree.json` re-aimed, 10, all dead.

## Fixed

| ID | Sev | Finding | Fix |
|---|---|---|---|
| T1 | high | **CLOSINGS NEVER CLOSED.** A clock whose end only ends the quest read as a deadline and froze online - but many are the script closing a quest a while after its outcome: M0B40Y05/M0B50Y09/N0C00Y11's `_end_` (`00:00`, started by `give pc _gold_`), Brisienna's `_oneday_` (started by meeting her, whose `start task` starts the main quest, and by her fortnight running out), the main quest's S0000007 and S0000988 `_delay_`, A0C01Y06, 40C00Y00, R0C10Y01. Each of those quests would have stood open in the journal for ever, its questor held. | A clock a task (not the start-up block) starts after SETTLING the quest - by what the starter does: a `give pc` that marks the success, `train pc`, `start quest` - or that a lost deadline starts, is a closing: a delay. At run time, once the quest is a success, a task-started deadline closes on the short wait too (S0000009's two days after the contact, whose reward a `when` on the same click pays). One closing after a failure the reading cannot see is a delay by hand (`ONLINE_CLOSINGS`: R0C11Y03). |
| T2 | high | **LETTERS AND ARRIVALS FROZE ON A CONDITIONAL.** "Costs a standing" and "shuts a reward" read the whole chain of later `when`s: K0C00Y05's letter (a few hours) read as a deadline because `when _S.09_ and _S.04_` - the player's own misstep - costs the knight; M0B11Y18's traitor (3-14 days) because a "not yet" line led, many `when`s on, to a reward. Neither would ever have come. | A standing counts by what the end itself does (its task and what it starts); a reward by what the `not _clock_` reader itself settles. |
| T3 | high | **THE MAIN QUEST'S ENDINGS NEVER PLAYED.** S0000016's one-minute `_delay_` gates the endings (`when _S.01_ and _S.02_ and _delay_` - play video, `end quest`); its `end quest` read as a loss. S0000011's Chapter 6 (laid out six days on) and S0000106's start-up favour (`Clock _delay_ 00:00`) froze the same way. | `end quest` is a loss only when the end ALONE sets it off - the engine's own reading of the `when` (WhenTask._checkEvals) with what the end has set true and every other task not set: `when _firsttimer_ and not _S.03_` is a loss, `when _S.01_ and _S.02_ and _delay_` a beat after the story. A clock declared at an explicit zero with no travel arm is "at once", never a deadline. |
| T4 | med | **LETTER43.** S0000002's Eadwyre path hands the player letter43 and its item three to seven days on (`get item`), then closes - the main quest's next page; with no `give pc` it read as a deadline. | `get item` is progress. A reward a "not run out" reader settles outranks it (O0B00Y11 pays the heist only `when ... not _S.01_`; its end, which hands the haul back as the posse comes, is still the loss of that pay). |
| T5 | med | **A LIMIT TAKEN AFTER THE REWARD.** T1's run-time half closed any task-started deadline once the quest was a success - and M0B11Y18 pays for the raid, then offers the traitor's hunt ("I will wait =gettraitor_ days"): the hunt would have ended two minutes after it was taken. | A clock started once the quest was already a success is a new limit and stays frozen (`startedAfterSuccess`, set at StartTimer, saved; a save before it reads false). |
| T7 | med | **A FROZEN DEADLINE ARMED AT NOTHING STILL FIRED.** The freeze charged nothing, but the end's `<= 0` check stood: a travel clock whose places cannot be found answers 0 seconds (DFU's own sum, `travelTimeSeconds`), and online it ended the quest on its first tick. | A frozen deadline never fires (`frozen` guards the end). |
| T6 | low | **"YOU ARE LATE", TWO MINUTES IN.** Brisienna's month (`_remindpc_`) does nothing but send a reminder and start her fortnight - the first half of her deadline - and read as a delay: the reminder came two minutes after the invitation. | A deadline by hand (`ONLINE_DEADLINES`). Not a rule: S0000011's `_S.11_` has the same shape (a letter, a long clock) and its letter40 is the main quest's next page - the rule, tried, froze it. |

The split moved from 279 deadlines / 120 delays to 262 / 137; nineteen clocks changed, each read. The main quest's 30
remaining deadlines - each a lost limit, a trip, a lifetime or a long-stop - are listed in the pin.

## Checked and fine (S)

- **Every machine is told.** Both hosts' bridges (`world.js`, `exterior.js`) pass `sharedClock`; the machine's hooks
  carry it to every quest; the dungeon rides the world's bridge.
- **The readers.** `liveRemainingSeconds` and `remainingTimeInSeconds` are read only by the bridge's walk, which reads
  no clock online - the journal, the lens's urgent herald, the rail, the tracker and the marks all see `null`.
- **The party resync** keeps each holder's own remainder and sample; a deadline frozen on one copy is frozen on all.
- **The curse arms** start their quest synchronously (`machine.quests.set`), so a long rest's walk of many 24-minute
  marks sees the first and starts no second. The crime guilds' stamp and the tick read the same clock (the
  character's minutes online).
- **The bounties**: the board, the party share (`bountyClearPays` reads `takenAt` only for ordering) and the pack
  spawner keep no other day; a bounty held online and played offline lapses on the offline clock, as it did.
- **The words**: every `=clock_` in the vendored texts reads whole with "a few" - "within a few days", "you only have a
  few days", "before the day has dawned a few times".
- **The letter's hold**: only the notify and silently forms wait; online they wait for town alone.
- **The wear**: `DFU_WEAR_MULTIPLE` has two callers (DFU's member, a duel's blade); the mods' modules keep their own
  amounts; the pins that ran DFU's amount through the seam at 1 are unchanged. WEAR-TWICE's two records that
  multiplied by it are retired (at 1 they are the source itself).

## Left, said so

- `daily from` windows stay on the sky (6.3b says why); the guild's guard keeps GUARD-ONLINE's arrival window.
- A delay cut online stays cut if the character later plays offline - the remainder is the save's.
