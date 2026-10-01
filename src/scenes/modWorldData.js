// THE MOD WORLD-DATA LOADER (RR3b) - a vendored mod's WorldData/*.json
// into the world-data door (formats/worldDataReplacement.js), the way
// ModManager hands DFU's WorldDataReplacement a mod's TextAssets. Vite's
// glob turns each file into a lazy chunk (the fort's block is 230 KB);
// loadModWorldData() reads them ALL once, before the first region loads,
// so the readers' synchronous asks find them - the C# reads files off
// disk on demand; the port fronts one await, as the quest pack does.
//
// BROWSER-ONLY: import.meta.glob is a Vite compile-time macro - node
// tests register their JSON on the door from fs.
import { registerWorldDataAsset, registerWorldDataPack, installWorldDataReplacement, boundWorldDataBlocks, quietLocationOverrides } from '../formats/worldDataReplacement.js';
import { rebuildWorldDataPatch, canonicalSha256 } from '../formats/worldDataPatch.js';
import { openWorldDataPack, packFileSha256, readPackText } from '../formats/worldDataPack.js';
import { modSetting, latchModLoaded, modLatchedOn } from '../systems/modSettings.js';
import { configureLayoutPins } from '../systems/layoutPins.js';   // WD3: the layout a save's towns were made in

// The glob sits INSIDE the loader (Vite rewrites it wherever it stands),
// so a node test that imports a host reaching this module does not trip
// on the macro - only a call would, and node never calls it.
const globFiles = () => import.meta.glob('../../vendor/*/WorldData/*.json', { import: 'default' });
// WD1: a mod whose world data is a whole classic block with its edits in it
// ships the edit only (formats/worldDataPatch.js); rebuilt here from the
// player's BLOCKS.BSA and registered under the file's own DFU name.
const globPatches = () => import.meta.glob('../../vendor/*/WorldDataPatches/*.json', { import: 'default' });
// WD3: a mod whose world data is thousands of files ships ONE pack (formats/worldDataPack.js), gzipped, as a URL the
// build emits beside the bundle (never a JS chunk, never inlined) - fetched only when its mod is loaded for the game.
const globPacks = () => import.meta.glob('../../vendor/*/WorldDataPack/*.pack.json.gz', { eager: true, query: '?url', import: 'default' });
const vendorOf = (path) => /vendor\/([^/]+)\/WorldData(?:Patches|Pack)?\//.exec(path)?.[1] ?? '';
const baseName = (path) => path.split('/').pop();

/**
 * WD3: THE LOAD ORDER OF THE PACKED MODS - DFU's ModManager priority, higher loaded later and answering first
 * (ModManager.cs:404-427). Both of carademono's town mods ship FIGHBM00.RMB and the two differ; Beautiful Cities
 * (0.5.0, built for DFU 1.1.1) is the later of the two and loads after Beautiful Villages (1.4.2, DFU 1.0.0), as a
 * player who runs both orders them. Every WD1 vendor stands at 0, below them: none of their files share a name.
 */
export const WORLD_DATA_PRIORITY = Object.freeze({ 'beautiful-villages': 10, 'beautiful-cities': 20 });

let _loaded = null;
const _packs = new Map();   // vendor -> opened pack (loaded for the game, or for a save's pins)
/** Every vendored mod's world-data file onto the door, gated on that mod's
 *  Enabled (a mod that is off is a mod DFU never loaded). Once. */
export async function loadModWorldData() {
  if (_loaded) return _loaded;
  _loaded = (async () => {
    installWorldDataReplacement();
    let n = 0;
    await Promise.all(Object.entries(globFiles()).map(async ([path, load]) => {
      const vendor = vendorOf(path);
      const json = await load();
      if (registerWorldDataAsset(baseName(path), json, () => modSetting(vendor, 'Enabled') === true)) n++;
    }));
    await Promise.all(Object.entries(globPatches()).map(async ([path, load]) => {
      const vendor = vendorOf(path);
      if (await registerWorldDataPatch(await load(), () => modSetting(vendor, 'Enabled') === true)) n++;
    }));
    // WD3: a packed mod is loaded for the game or not at all - its switch is read here, once, and latched, so a switch
    // flipped mid-game moves no town under the player's feet (the Features row: "Takes effect when the game next loads");
    // the layout pins stamp a save's records with what is loaded (systems/layoutPins.js)
    configureLayoutPins({ vendorOn: (v) => modLatchedOn(v) === true, vendorVersion: (v) => _packs.get(v)?.mod?.version ?? '' });
    for (const [path, url] of Object.entries(globPacks())) {
      const vendor = vendorOf(path);
      let on = false;
      try { on = modSetting(vendor, 'Enabled') === true; } catch { on = false; }
      latchModLoaded(vendor, on);
      if (on) n += await loadPackFrom(vendor, url, () => true);
    }
    return n;
  })();
  return _loaded;
}

/** WD3: a pack that is not loaded for the game, loaded now for a save that pins a town to it (systems/layoutPins.js:
 *  a house bought while the mod was on keeps its town though the mod was switched off since). Its files answer only
 *  where a pin lets them in. Answers whether the pack is on the door. */
export async function ensureWorldDataPack(vendor) {
  if (_packs.has(vendor)) return true;
  const entry = Object.entries(globPacks()).find(([path]) => vendorOf(path) === vendor);
  if (!entry) return false;
  return (await loadPackFrom(vendor, entry[1], () => false)) > 0;
}

/** The packs on the door, by vendor. */
export const loadedWorldDataPacks = () => new Map(_packs);

async function loadPackFrom(vendor, url, isOn) {
  const blocks = boundWorldDataBlocks();
  if (!blocks) { console.warn(`[worlddata] ${vendor}: no BLOCKS.BSA bound - pack not opened`); return 0; }
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await readPackText(new Uint8Array(await res.arrayBuffer()));
    const pack = openWorldDataPack(JSON.parse(text), { blocks, onRebuilt: spotCheck(vendor) });
    _packs.set(vendor, pack);
    quietLocationOverrides(true);   // a pack's 7,000 towns are counted once here, not logged one by one as they are read
    const n = registerWorldDataPack(pack, isOn, { priority: WORLD_DATA_PRIORITY[vendor] ?? 0 });
    console.log(`[worlddata] ${vendor}: ${n} files on the door (${pack.mod?.title ?? vendor} ${pack.mod?.version ?? ''})`);
    return n;
  } catch (e) {
    console.error(`[worlddata] ${vendor}: the pack did not load (${e?.message ?? e}) - its towns stand classic`);
    return 0;
  }
}

/**
 * WD3: the rebuild checked against the author's file, in the background - WD1's check at load, for a pack of
 * thousands: every block the first time it is served and one location in every 64, hashed off the frame, and one
 * line said for the pack however many differ (a BLOCKS.BSA or MAPS.BSA that is not the one the mod was made
 * against: the author's edit on the player's own data is still what the mod does, and is served).
 */
function spotCheck(vendor) {
  const queue = [];
  let differ = 0, checked = 0, running = false, locations = 0;
  const pump = async () => {
    running = true;
    while (queue.length) {
      const [name, json, want] = queue.shift();
      try { if ((await packFileSha256(json)) !== want) differ++; } catch { /* no hash available: unchecked */ }
      checked++;
      await new Promise((r) => setTimeout(r, 0));
    }
    running = false;
    if (differ) console.warn(`[worlddata] ${vendor}: ${differ} of ${checked} checked files rebuilt from your game files differ from the author's - served as rebuilt`);
  };
  return (name, json, want) => {
    if (name.startsWith('location-') && (locations++ % 64) !== 0) return;
    queue.push([name, json, want]);
    if (!running) pump();
  };
}

/**
 * WD1: one vendored patch onto the door - rebuilt from the bound BLOCKS.BSA,
 * checked against the author's file (its canonical sha256) and registered
 * under the file's DFU name. A rebuild that does not come back to the
 * author's bytes (a BLOCKS.BSA that is not the one the mod was made
 * against) is said and still served: it is the author's edit on the
 * player's own block, which is what the mod does to any block it meets.
 * A patch whose ops do not land is said and not served.
 * @returns {Promise<boolean>}
 */
export async function registerWorldDataPatch(patch, isOn) {
  const blocks = boundWorldDataBlocks();
  if (!blocks) { console.warn(`[worlddata] ${patch?.rebuilds}: no BLOCKS.BSA bound - patch not rebuilt`); return false; }
  let json;
  try { json = rebuildWorldDataPatch(patch, blocks); } catch (e) { console.error(`[worlddata] ${patch?.rebuilds}: ${e?.message ?? e}`); return false; }
  const sha = await canonicalSha256(json);
  if (sha !== patch.sha256) console.warn(`[worlddata] ${patch.rebuilds}: rebuilt from this BLOCKS.BSA, but not to the author's file (sha256 ${sha.slice(0, 12)}, the patch records ${String(patch.sha256).slice(0, 12)})`);
  return registerWorldDataAsset(patch.rebuilds, json, isOn);
}
