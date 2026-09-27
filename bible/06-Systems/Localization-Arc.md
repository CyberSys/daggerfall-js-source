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
2. **L10N1b - the language setting**: a `uiPrefs` key, a picker on the enhanced Settings pane and on first run (before
   ARENA2), applied by reload; the pages' `lang` follows.
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
