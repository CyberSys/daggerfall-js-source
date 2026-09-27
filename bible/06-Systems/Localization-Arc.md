# Localization Arc (L10N)

**Mac, 2026-09-27:** *"I want a proper localization/translation integration for our game. I believe patches exist
online, but I want to do this for as many languages as we possibly can and do this right."*

Daggerfall Unity ships one language, English, and lets a translation pack overwrite it in place. The port had no text
layer at all: every string DFU resolves through `TextManager` was an English constant in the code, with the key named
in a comment (the standing MECHANISM departure, Port-Ledger A), and the classic windows could draw ASCII only. This
arc ports DFU's text system 1:1, so every DFU translation pack works as it stands. It then goes past DFU where DFU
stops: real locales, switching in play, plurals, every script, and the port's own strings.

## Mac's decisions (2026-09-27)

Asked the three questions that were his:

1. **Community packs: "Install + bundle allowed".** A player can install any DFU translation pack from their own disk,
   and the port redistributes nothing to make that work. The port bundles a pack only when its terms allow it, credited
   and kept as separately licensed data. Mac asks the other packs' authors for permission.
2. **AI translation: "AI drafts, labeled".** Where no human translation exists, Claude drafts one. That covers all of
   the port's own strings in every language, and whole languages no pack covers. The game says which languages are
   machine translated, and fixes come in through a review file or PRs. A human pack always outranks a draft.
3. **Running the bulk: "Both".** The port's own strings are translated in-session. The large body of game text (about
   250,000 words a language: quests, books, dialogue) goes through a pipeline tool on the Claude API that Mac runs with
   his key (L10N6b).

## What Daggerfall Unity has (the law to port)

Read at DFU commit 2343305 (2026-09-14); v1.1.1 is the latest release.

- **TextManager** (`Assets/Scripts/Game/TextManager.cs`) - ten string-table collections: `Internal_Strings` (990 rows,
  symbolic keys), `Internal_RSC` (1,448 - TEXT.RSC by record id, 9000 split into 9000.1..40), `Internal_Flats` (226),
  `Internal_Quests` (`{QUEST}.{messageId}`), `Internal_Locations` (15,251, by MapId), `Internal_Settings` (32),
  `Internal_Spells` (88), `Internal_Items` (288), `Internal_MagicItems` (59), `Internal_Factions` (366).
  `GetLocalizedText` reads the runtime collection, then the default one, then answers `<LocaleText-NotFound>` or throws.
  The lists (`enemyNames`, `regionNames`, `monthNames`, the building-name part lists...) are newline-separated values,
  split and cached forever. The name helpers take a canonical fallback.
- **StringTableCSVParser / StringTablePatcher** - a pack is one `<collection>.csv` per collection, two columns
  `Key,Value`, UTF-8. It is read by a regex whose quirks every pack is authored against: an unquoted value is cut at its
  first comma, and the header is dropped only when it is exactly `Key,Value`. It is merged key by key over the English
  table. Mods are searched first, then `StreamingAssets/Text`.
- **Quests and books** - `Text/Quests/<QUEST>-LOC.txt` (the QRC half only; lookup `S0000977.1011`) and
  `Text/Books/BOKnnnnn-LOC.txt` (`LocalizedBook.cs`, with header keywords and markup). Menu text lives in Table-format
  `.txt` files (`MainMenu`, `GameSettings`, `DialogShortcuts`, `ModSystem`), name banks in `NameGen.txt`, and
  biographies and FACTION.TXT under StreamingAssets. Mod strings go through `Mod.Localize` and `[<locale>]textdatabase.txt`.
- **No locale switching.** One locale ships ("English (en)"). A pack overwrites English rather than adding a language.
  There are no plurals and no locale fallback chain.
- **Fonts** - `RegisterLocalizedFont` forces SDF on; a pack drops `FONT000x-SDF.ttf` into `StreamingAssets/Fonts`.
  The classic FNT path is Latin-1 at most. There is no RTL, bidi or shaping, and lines wrap at ASCII space only.
- **Grammar** (`Localization/Grammar.cs`, master only, PR #2667, 2026-05-17) - one `GrammarRules` processor, the
  identity by default. The French pack replaces it with `FrenchGrammarRules` (MIT, Daneel53).
- The translator workflow is DFU's wiki page "Translating Daggerfall Unity".

## What exists online (2026-09-27)

Every full-game translation below targets DFU's own format, so a player can install any of them once L10N3b lands.
None of them translates the port's own strings - those are the port's.

| Language | Project | Coverage | Terms |
|---|---|---|---|
| French | Daneel53, Pango (Nexus 456, GitHub Daneel53/DFU-en-francais) | complete, grammar module | permission needed; `FrenchGrammarRules.cs` is MIT |
| German | Deepfighter, Numenorean (Nexus 826, GitHub deepfighter/daggerfall-deutsch) | near complete, beta | permission needed (whole package, non-commercial, named hosts only) |
| Russian | Jagget (Nexus 511, GitHub Jagget/Daggerfall-Rus) | "the most complete" | permission needed; a chain of earlier authors |
| Ukrainian | Ivan Kuzyk (Nexus 819) | main game and mods | permission needed |
| Portuguese (BR) | Equipe Adaga (Nexus 565) | complete, review pending | credit-only - may be re-uploaded with credit |
| Spanish | NarrodRecandriall (Nexus 1251, GitHub Narrod-Dev) | complete, machine-assisted | GPL-3.0 on GitHub; credit-only on Nexus |
| Italian | XSpettro101X (Nexus 1182) | complete, AI-assisted | credit-only |
| Turkish | w0fie (Nexus 698) | 99%, place names untranslated | credit-only, "some assets belong to other authors" |
| Japanese | sasanoki (Nexus 1195) | in development | no redistribution |
| Korean | munument1 (GitHub munument1/Daggerfall_Unity_kr) | first pass complete, AI-assisted | no license (all rights reserved) |
| Chinese (Traditional) | kuanfu0430 (GitHub fork, `l10n/zh-TW`) | complete | the fork's root LICENSE is DFU's MIT; to be confirmed with the author |
| Chinese (Simplified) | chengdh (GitHub dfu-translation-cn) | machine output, quests missing | GPL-3.0; bundles SimSun, a proprietary font - never bundle that |

None was found for Polish, Czech, Hungarian, Vietnamese, European Portuguese or Dutch, and no Weblate, Crowdin or
Transifex project exists for DFU. The packs' textures and subtitled videos are edits of Bethesda assets and fall
under the port's no-ARENA2 rule. So they are never bundled, whatever the pack's terms say.

## The port before this arc

About 4,750 English sentences and 3,650 labels in code, most of them the port's own (the online game, the enhanced
skin, the port's systems). About 83 files cite `Internal_Strings` keys. The narrow seams that already existed are
`localizedText(key)` (talk, prison, arrest), `localizedLocationName`, `getLocalizedQuestDisplayName` and Travel
Options' `localize`, all wired back to English. Classic windows fold every code point above 127 to `?`, and the
TEXT.RSC, BOK and rumor readers drop high bytes. Saves hold English text (quest messages, notebook entries, rumors,
some item names), and canonical region and location names double as keys. About 2,400 test assertions pin English text.

## The plan

English stays byte-identical as the default throughout.

1. **L10N1 - DFU's text core** (below).
2. **L10N1b - the language setting** (below): a `uiPrefs` key, a picker on the front door's Settings and a first-run
   offer, before ARENA2; applied at once, and the page's `lang` follows.
3. **L10N2 - any script**: a locale's registered font turns on the classic SDF arm, with glyphs rasterized on demand into
   a dynamic atlas through canvas and lines wrapped by `Intl.Segmenter` (CJK included). The byte readers decode with the
   right code page, and the enhanced skin gets per-locale OFL web fonts (Noto).
4. **L10N3 - DFU content through the tables**: the `Internal_Strings` keys, the name helpers, `Internal_RSC` per locale,
   quest and book `-LOC` files, NameGen, BIOGs, FACTION.TXT and mod `textdatabase` tables - so a DFU pack works as it
   stands.
5. **L10N3b - install a DFU pack from disk**: a pack (zip or folder) goes into a locale slot, browser or desktop app.
6. **L10N4 - the port's own strings** into `Port_Strings`, module by module. The English-only grammar is fixed on the way
   (plurals, possessives, word order, ordinals, a/an), and a lint rule stops new hardcoded strings.
7. **L10N5 - saves hold ids**, and text is rendered again on load.
8. **L10N6 - translations shipped**: the allowed packs bundled with a credits page, AI drafts of `Port_Strings`, a
   machine-translated label, a coverage report per language, and a contribution workflow. **L10N6b** - the pipeline tool.
9. **L10N7 - later**: right-to-left languages, the roughly 160 UI images with English painted into the art, and Unicode
   player names online.

## L10N1 (2026-09-27): DFU's text core

`src/systems/textManager.js`, a leaf module (it imports nothing).

**Ported 1:1:**
- TextManager's collections: `GetLocalizedText`, `GetLocalizedTextWithReversion`, `GetLocalizedTextList`,
  `GetLocalizedTextListFromKeyArray`, `TryGetLocalizedText` and `SplitTextList`.
- The id-keyed name helpers: region, location, spell, item, magic item and faction.
- The runtime collection names, and the localized-font registry, which forces SDF on through a host hook.
- `StringTableCSVParser` - the regex verbatim, with its quirks - and `StringTablePatcher`.
- `GrammarRules`, `DefaultGrammarRules` and `GrammarManager`.
- DFU's `GetDefaultCollectionName` has no `TextFlats` case, so a flats miss falls back to `Internal_Strings`. Kept.
- `GetLocalizedEnemyName`'s index law keeps its one home (`characters/enemyBasics.js` `enemyDisplayName`), which will
  read the list from here.
- `formats/rscTable.js` `parseRscCsv` now rides the one CSV law. The port's own reader kept a trailing newline on nine
  master rows, which `parseRscMarkup` strips anyway. MAC-U's no-imports pin was re-aimed to its stated reason: the
  table's one import is a module that imports nothing, so there is still no cycle with the reader.

**The port's departures** (Port-Ledger A, "THE PORT'S LOCALES"):
- **Locales.** There is a table set per locale, and a lookup walks the chain - the tag, each shorter tag, then `en`
  (`pt-BR`, `pt`, `en`).
- **English stays in the code.** `localizedText(key, en)` answers a table's word or the constant, so English is
  byte-identical by construction. An empty constant stays empty; an empty table value is still the table's word.
- **The list cache** is keyed by locale and cleared by a patch.
- **`Port_Strings` and `t(key, en, args)`.** This is an ICU MessageFormat subset: `{x}`, `{n, number}`,
  `{n, plural, ...}`, `{n, selectordinal, ...}` and `{x, select, ...}`, with categories from `Intl.PluralRules`.
  - `#` prints the plain number, so an English pattern prints exactly what `${n}` did.
  - Apostrophes follow ICU's default mode, so "don't" is plain text.
  - A malformed pattern is answered as it stands, never thrown; `parseMessage` throws, for the catalog checks.
- **The pseudo-locale `qps-ploc`.** Routed text is accented, lengthened by a third and bracketed once. DFU macros,
  `{0}`, `[/markup]`, quest symbols, `<ce>` codes and every argument's value pass whole, and a table's own word is
  never pseudo-localized.

Nothing is routed through it yet: L10N3 moves DFU's keys, and L10N4 moves the port's own strings.

**Pinned:** `test/l10n1.test.js` (13), over fixtures, the vendored master `Internal_RSC.csv` (1,448 rows, as DFU reads
it) and, with a DFU checkout (`DFU_PATH`), DFU's own C#: the collection names, the error string and the CSV line pattern.
The master CSVs read at their own row counts (990, 1,448, 226, 15,251, 32, 88, 288, 59, 366).

**Mutants:** `tools/mutants/l10n1.json` has 22 mutants, 21 dead. One is recorded as equivalent: the clear on a locale
switch is belt-and-braces, because the cache key already carries the locale.

## L10N1b (2026-09-27): the language setting

The player picks a language, and the port's text in it is fetched, applied and remembered.

**The languages** - `src/systems/localeCatalog.js`, pure:
- 25 languages beside English: Bulgarian, Chinese (Simplified and Traditional), Czech, Danish, Dutch, Finnish, French,
  German, Greek, Hungarian, Indonesian, Italian, Japanese, Korean, Norwegian (Bokmål), Polish, Portuguese (Brazil),
  Romanian, Russian, Spanish, Swedish, Turkish, Ukrainian and Vietnamese. The pseudo-locale is hidden (`?lang=` only).
- Each entry has its tag, its own name, its English name, its script and its source. Every language is `machine`
  until a human translation lands. Chinese is tagged by script (`zh-Hans`, `zh-Hant`), not region.
- Right-to-left and complex scripts (Arabic, Hebrew, Persian, Thai, the Indic scripts) wait for L10N7's shaping.
- `resolveLocale` answers English for a tag the catalog lacks or the build holds no text for.
- `localeForBrowser` reads the browser's list in order: the exact tag, then the Chinese and Norwegian folds (`zh-TW`,
  `zh-HK` and `zh-MO` read Traditional; `no` and `nn` read Bokmål), then the language alone (`pt-PT` finds `pt-BR`). A
  browser that lists English first is offered nothing.

**The build** - `src/scenes/localeData.js`:
- Every `locales/<tag>/<table>.csv` is a lazy chunk (`import.meta.glob`, `?raw`), patched into its locale's table of
  the same name. So a DFU pack's own CSVs can sit beside the port's. Under bare node the glob is absent, so node sees
  no files (the module still loads) and the tests feed the same files off the disk.
- A load that fails is forgotten, so the next ask fetches it again.
- Only the chosen language's chain is fetched. `locales/en/` is never loaded: English is the code's.
- `main.js` awaits `initLocale` before any door draws text, behind a dynamic import (BOOT2's ceiling on the entry's
  static graph). `?lang=` wins for one visit; otherwise the `language` pref. A failure leaves English standing.
- The page's `lang` and `dir` follow the locale, for the browser's fonts, hyphenation and screen readers.

**The menu** - `ui/enhancedMenu.js`:
- The rail's thirteen words go through `t()` (`menu.rail.*`). Their ids stay the English labels', so the probes'
  `door-<id>` selectors hold in every language.
- **The Language row** heads Settings > Interface on the front door only; a running game keeps the language it booted
  in. A choice switches at once: the text fetched, the core switched, the menu redrawn. A machine-drafted language
  says "Machine translated".
- **The first-run offer.** A player whose browser reads another language first is asked once, in that language
  (`tIn`), with a note that the translation is machine-made. Either answer is remembered (`languageOffered`). It shows
  only when the boot fetched that language's text, so it can never ask in English.
- **The account window waits** while the offer stands (ACC1f offers it once a visit). The probe found it covering the
  offer, so a French player was asked in English before French. On a phone the offer stands beside the profile
  portrait, not over it.

**The strings** - `tools/l10nExtract.mjs` reads every `t` and `tIn` call off the source with acorn and writes
`locales/en/Port_Strings.csv` (20 strings), or checks it (`--check`). It refuses a key that is not a dotted name, an
English that is not a literal, one key with two Englishes and a pattern the ICU subset cannot read.
`formatStringTableCsv` is the one writer: Key,Value, every value quoted. What DFU's parser cannot read back is refused.
The 25 languages' `Port_Strings.csv` are Claude's drafts (Mac: "AI drafts, labeled"). `locales/README.md` is the
translators' page.

**Pinned:** `test/l10n1b.test.js` (8). It covers the catalog, the pure laws, the English catalog in step with the
source, and every language's file: the writer's own form, every key, a readable pattern, the English's arguments. It
also runs `t` and `tIn` over the drafts and checks the rail's English reads back as its labels. It runs the boot's
laws over files fed off the disk: the saved choice, `?lang=`, the chain fetched once, the offer's preload, and a failed
load leaving English. It pins the boot's order, the prefs and the menu by source, and round-trips the writer. `tools/languageProbe.mjs` (36 checks, Chromium, no ARENA2) shows
the rest: the offer asked in French and answered both ways, only the chosen language fetched, the Settings row
switching French to German to English at once, `?lang=ja` for one visit, the pseudo-locale, and no page errors.

**Mutants:** `tools/mutants/l10n1b.json` has 33 mutants, all dead.
