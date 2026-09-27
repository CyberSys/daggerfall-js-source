// L10N3d (2026-09-27): THE DFU WORDS THE PORT ROUTES, READ OFF THE SOURCE.
//
// DFU shows its interface words through TextManager.GetLocalizedText(key); the port holds them as constants and reads
// each through the text core where it is shown. This reads every such word in src/ - each `localizedText('key', ...)`
// and `localizedTextList('key', [...])` with a literal key, and each entry of a `localizedStrings({...})` or
// `localizedTable({...})` table, in a module that imports them from systems/textManager.js (under any local name); an
// English may be a literal or the module's own `const NAME = '...'` -
// for test/l10n3d_sites.test.js's pins, and says how far the routing has come.
//
//   node tools/l10nRouted.mjs            the routed words, file by file (the sites test's ROUTED map), and coverage:
//                                        DFU's keys the port routes, of those DFU's own code asks for by name
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { DEFAULT_COLLECTION_NAMES, loadStringTableCsv } from '../src/systems/textManager.js';
import { isMain } from './lib/isMain.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTERS = new Set(['localizedText', 'localizedTextList', 'localizedStrings', 'localizedTable']);

/** DFU's English, collection -> Map(key -> English): the vendored master tables (vendor/dfu-text). */
export function dfuTables(root = ROOT) {
  const out = new Map();
  for (const [collection, name] of Object.entries(DEFAULT_COLLECTION_NAMES)) {
    let text;
    try { text = readFileSync(join(root, 'vendor/dfu-text', `${name}.csv`), 'utf8'); } catch { continue; }
    out.set(collection, new Map(loadStringTableCsv(text).map(([k, v]) => [k, v.replace(/[\r\n]+$/, '')])));
  }
  return out;
}

const walk = (d, out = []) => {
  for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p, out); else if (p.endsWith('.js')) out.push(p); }
  return out;
};
const literal = (n) => (n?.type === 'Literal' && typeof n.value === 'string' ? n.value
  : n?.type === 'TemplateLiteral' && !n.expressions.length ? n.quasis[0].value.cooked : undefined);
/** A router's collection argument: `TextCollections.<name>`, Internal when there is none, null for anything else. */
const collectionOf = (n) => (n?.type === 'MemberExpression' && n.object?.name === 'TextCollections' ? n.property.name : n ? null : 'Internal');

/**
 * Every routed word in src/: { file, line, via, key, en, collection, loose }. `en` is undefined where the English is
 * not a literal; `loose` marks a single word read outside any function - once, at module load.
 */
export function routedWords(root = ROOT) {
  const out = [];
  for (const path of walk(join(root, 'src'))) {
    const file = relative(root, path).split('\\').join('/');
    if (file === 'src/systems/textManager.js') continue;
    const text = readFileSync(path, 'utf8');
    if (![...ROUTERS].some((r) => text.includes(r))) continue;
    const ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    const local = new Map();   // the text core's routers as this module imports them
    for (const d of ast.body) {
      if (d.type !== 'ImportDeclaration' || !/\/textManager\.js$/.test(d.source.value)) continue;
      for (const sp of d.specifiers) if (sp.type === 'ImportSpecifier' && ROUTERS.has(sp.imported.name)) local.set(sp.local.name, sp.imported.name);
    }
    if (!local.size) continue;
    const consts = new Map();   // a module's own `const NAME = 'text'` (exported or not): an English held by name
    for (const d of ast.body) {
      const decl = d.type === 'ExportNamedDeclaration' ? d.declaration : d;
      if (decl?.type !== 'VariableDeclaration' || decl.kind !== 'const') continue;
      for (const v of decl.declarations) if (v.id.type === 'Identifier' && literal(v.init) !== undefined) consts.set(v.id.name, literal(v.init));
    }
    const str = (n) => (n?.type === 'Identifier' && consts.has(n.name) ? consts.get(n.name) : literal(n));
    const visit = (n, inFn) => {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'CallExpression' && local.has(n.callee?.name)) {
        const via = local.get(n.callee.name), [a, b, c] = n.arguments, line = n.loc.start.line;
        if (via === 'localizedText' && str(a) !== undefined) {
          out.push({ file, line, via, key: str(a), en: str(b), collection: collectionOf(c), loose: !inFn });
        } else if (via === 'localizedTextList' && str(a) !== undefined) {
          const en = b?.type === 'ArrayExpression' && b.elements.every((e) => str(e) !== undefined) ? b.elements.map(str).join('\n') : undefined;
          out.push({ file, line, via, key: str(a), en, collection: collectionOf(c), loose: !inFn });
        } else if ((via === 'localizedStrings' || via === 'localizedTable') && a?.type === 'ObjectExpression') {
          for (const p of a.properties) {
            const pair = via === 'localizedTable' && p.value?.type === 'ArrayExpression' ? p.value.elements : null;
            const key = via === 'localizedTable' ? str(pair?.[0]) : (p.key.name ?? String(p.key.value));
            out.push({ file, line: p.loc.start.line, via, key, en: str(via === 'localizedTable' ? pair?.[1] : p.value), collection: collectionOf(b), loose: false });
          }
        }
      }
      const fn = inFn || /Function/.test(n.type);
      for (const k of Object.keys(n)) {
        if (k === 'loc') continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach((x) => visit(x, fn)); else if (v && typeof v.type === 'string') visit(v, fn);
      }
    };
    visit(ast, false);
  }
  return out;
}

/** The Internal_Strings keys DFU's own code asks for by a literal key, read off a DFU checkout's Assets/Scripts. */
export function dfuAskedKeys(dfuScripts) {
  const keys = new Set();
  const cs = [];
  const walkCs = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walkCs(p); else if (p.endsWith('.cs')) cs.push(p); } };
  walkCs(dfuScripts);
  for (const f of cs) for (const m of readFileSync(f, 'utf8').matchAll(/GetLocalizedText(?:List|WithReversion)?\("([A-Za-z0-9_.]+)"/g)) keys.add(m[1]);
  return keys;
}

if (isMain(import.meta.url)) {
  const words = routedWords();
  const counts = {};
  for (const w of words) counts[w.file] = (counts[w.file] ?? 0) + 1;
  console.log('const ROUTED = {');
  for (const f of Object.keys(counts).sort()) console.log(`  '${f}': ${counts[f]},`);
  console.log('};');
  const internal = new Set(words.filter((w) => w.collection === 'Internal').map((w) => w.key));
  const dfu = dfuTables().get('Internal');
  console.log(`${words.length} routed words in ${Object.keys(counts).length} files; ${internal.size} of DFU's ${dfu.size} Internal_Strings keys`);
  const scripts = process.env.DFU_SCRIPTS;
  if (scripts) {
    const asked = [...dfuAskedKeys(scripts)].filter((k) => dfu.has(k));
    const routed = asked.filter((k) => internal.has(k));
    console.log(`DFU's code asks for ${asked.length} Internal_Strings keys by name; the port routes ${routed.length}`);
  }
}
