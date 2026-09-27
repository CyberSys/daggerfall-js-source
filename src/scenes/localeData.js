// L10N1b (2026-09-27): THE LOCALES' TEXT IN THE BUILD, AND THE LANGUAGE THE GAME STARTS IN.
//
// Every `locales/<tag>/<table>.csv` is one lazy chunk - a DFU string-table CSV (StringTableCSVParser's format, so a
// DFU pack's own files drop in beside the port's) patched into its locale's table of the same name. Only the chosen
// language's files (and its chain's - pt-BR's and then pt's) are ever fetched. `locales/en/` is the English catalog
// the tools and the translators read; the English the game shows is the code's own, so it is never loaded here.
//
// import.meta.glob is Vite's compile-time macro, absent under bare node - so node sees no files (worldOfDaggerfall.js's
// door), the module still loads (test/moduleload_smoke.test.js runs every body), and the tests feed the same files off
// the disk (_useLocaleFilesForTests) to run the boot's laws. Nothing here may stop the game: a language whose text
// fails to load leaves English standing.

import { registerLocale, patchLocaleTable, setLocale, loadStringTableCsv, localeChain, localeInfo, BASE_LOCALE, PSEUDO_LOCALE } from '../systems/textManager.js';
import { LOCALE_CATALOG, localeFileOf, resolveLocale, localeForBrowser } from '../systems/localeCatalog.js';
import { getPref } from '../systems/uiPrefs.js';
import { installLocaleFaces } from '../ui/localeFaces.js';   // L10N2: the classic fonts' faces for the language

const IN_BROWSER = typeof window !== 'undefined';
const FILES = IN_BROWSER ? import.meta.glob('../../locales/*/*.csv', { query: '?raw', import: 'default' }) : {};

/** A glob's locale files by tag - `locales/<tag>/<table>.csv` -> [{ table, load }] - English left out: it is the
 *  code's. */
export function indexLocaleFiles(glob) {
  const byCode = new Map();
  for (const [path, load] of Object.entries(glob ?? {})) {
    const f = localeFileOf(path);
    if (!f || f.code === BASE_LOCALE) continue;
    if (!byCode.has(f.code)) byCode.set(f.code, []);
    byCode.get(f.code).push({ table: f.table, load });
  }
  return byCode;
}
let byCode = indexLocaleFiles(FILES);

/** Whether the build holds text for `code` (English and the pseudo-locale always do). */
export const hasLocaleText = (code) => code === BASE_LOCALE || code === PSEUDO_LOCALE || byCode.has(code);

let _registered = false;
/** The catalog's languages whose text the build holds, told to the text core once. */
export function registerLocales() {
  if (_registered) return;
  _registered = true;
  for (const info of LOCALE_CATALOG) if (hasLocaleText(info.code)) registerLocale(info);
}

const _loaded = new Map();   // tag -> the promise of its tables patched in
/** Fetch and patch every table of `code`'s chain not yet loaded. A load that fails is forgotten, so the next ask
 *  fetches again. */
export function loadLocaleText(code) {
  const jobs = [];
  for (const tag of localeChain(code)) {
    if (!byCode.has(tag)) continue;
    if (!_loaded.has(tag)) {
      _loaded.set(tag, Promise.all(byCode.get(tag).map(async ({ table, load }) => {
        const rows = loadStringTableCsv(await load());
        if (rows) patchLocaleTable(tag, table, rows);
      })).catch((err) => { _loaded.delete(tag); throw err; }));
    }
    jobs.push(_loaded.get(tag));
  }
  return Promise.all(jobs);
}

/** The page's own language and direction, for the browser's fonts, hyphenation and screen readers. */
export function applyDocumentLanguage(code) {
  const html = globalThis.document?.documentElement;
  if (!html) return;
  html.lang = code === PSEUDO_LOCALE ? BASE_LOCALE : code;
  html.dir = localeInfo(code)?.dir ?? 'ltr';
}

/** Switch to `wanted` (English when the build holds no text for it): its text loaded, its classic fonts given their
 *  face (L10N2), the core switched, the page's language set. Answers the locale that stands. */
export async function switchLocale(wanted) {
  registerLocales();
  const code = resolveLocale(wanted, hasLocaleText);
  await loadLocaleText(code);
  installLocaleFaces(code);
  setLocale(code);
  applyDocumentLanguage(code);
  return code;
}

/** The browser's own languages, most wanted first. */
export function browserLanguages() {
  const nav = globalThis.navigator;
  return nav?.languages?.length ? [...nav.languages] : [nav?.language].filter(Boolean);
}

/** THE BOOT'S LANGUAGE: `?lang=` for one visit, else the player's own choice (uiPrefs `language`). While English
 *  stands and the front door has not yet offered the browser's own language, that language's text is fetched too, so
 *  the offer can ask in it (ui/enhancedMenu.js languageOffer). A failure leaves English standing and the game starts. */
export async function initLocale(params = null, { languages = browserLanguages() } = {}) {
  try {
    const code = await switchLocale(params?.get?.('lang') ?? getPref('language'));
    if (code === BASE_LOCALE && !params?.has?.('lang') && !getPref('languageOffered')) {
      const offer = localeForBrowser(languages, hasLocaleText);
      if (offer) await loadLocaleText(offer).catch((err) => console.warn('[text] the offered language could not load:', err?.message ?? err));
    }
    return code;
  } catch (err) {
    console.error('[text] the language could not load; English stands:', err?.message ?? err);
    setLocale(BASE_LOCALE);
    applyDocumentLanguage(BASE_LOCALE);
    return BASE_LOCALE;
  }
}

/** Tests: the files of `glob` (path -> loader, as Vite's glob gives them) in place of the build's, nothing registered
 *  or loaded yet. */
export function _useLocaleFilesForTests(glob) {
  byCode = indexLocaleFiles(glob);
  _registered = false;
  _loaded.clear();
}
