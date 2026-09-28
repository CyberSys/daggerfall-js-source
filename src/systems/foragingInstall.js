// ═══════════════════════════════════════════════════════════════════
// FORAGE1-FORAGE2 (2026-09-28): FORAGING 1.7 (Harbinger451) - THE
// INSTALL. What ForagingMain.Init/Awake/Start do (IL_0251-IL_0513): the
// twelve templates, the author's seven pictures, the quest list, the six
// tools' and five foods' UseItem, the console command, and (FORAGE3) the
// three loot hooks' subscriptions. The law is
// systems/foragingLaw.js; the record is bible/06-Systems/Foraging.md.
//
// THE TEMPLATES register at import, whatever the switch says (FORAGE0
// law 6): a saved tool never vanishes, and with the switch off it is an
// inert item - its Use not offered, its hooks silent.
//
// THE WORLD. A use asks the world what the mod's checks ask
// (PlayerEnterExit, PlayerGPS, WorldTime, GameManager.AreEnemiesNearby,
// PlayerMotor); the host that owns the player answers through
// setForagingHost. With no host a use is "inside" - the one answer that
// can never let a tool work where it should not.
//
// THE DRAWS are UnityEngine.Random's (THE ENGINE-PRNG RULE: Math.random,
// injectable for a test).
// ═══════════════════════════════════════════════════════════════════

import {
  FORAGING_TEMPLATES, FORAGING_VENDOR, FORAGING_GROUP, FORAGING_QUEST_LIST, FT, TOOL_TEMPLATES, FORAGING_TEXTURE_ARCHIVES,
  foragingRefusal, woodAxeBundles, woodAxeMessage, pickAxeQuest, sickleQuest, fishingCount, fishingMessage, fishTemplate,
  spadeQuest, basketDraw, basketFind, TOOL_QUESTS, brokeMessage, FOODS, FORAGING_COMMAND,
  foragingLootItem, containerLootDraw, dungeonLootDraw, corpseLootDraw,
} from './foragingLaw.js';
import { registerCustomTemplates, registerItemUseHandler, registerCustomItemsForGroup, setItemFields, mintCondition, templateByIndex } from './itemTemplates.js';
import { addVendorTextures } from './textureReplacement.js';
import { registerQuestList } from './quest/questLists.js';
import { registerCommand, gateConsoleCommand } from './consoleCommands.js';
import { modSetting } from './modSettings.js';
import { hudText, popupMessage } from './notify.js';
import { addItem } from './inventory.js';
import { lowerCondition } from './equip.js';
import { isOnlinePage } from './onlineLane.js';
import { liveStat, maxFatigue, FATIGUE_MULTIPLIER } from './statMods.js';
import { survivalOn } from './survival/switch.js';
import { createSurvivalItem } from './survival/items.js';
import { registerContainerLootHandler } from './containerLoot.js';
import { registerTabledLootHandler } from './loot.js';
import { registerEnemyDeathHandler } from '../scenes/corpseMarker.js';

registerCustomTemplates(FORAGING_TEMPLATES);

/** The mod's switch (MO1: on). */
export const foragingOn = () => modSetting(FORAGING_VENDOR, 'Enabled') === true;

/** Foraging's share of GetCustomItemsForGroup: its twelve templates, all UselessItems2, while its switch is on - so a
 *  General Store or Pawn Shop shelves them by DFU's own custom-item loop (rarity <= quality; the tools and the Wood
 *  Bundle rarity 10, the Mushroom and the Egg 5, the Fish and the fruit 100 and so never). PROF1 (FORAGE0 law 6's online
 *  exception): ONLINE THE SIX TOOLS SHELVE WHATEVER THE SWITCH SAYS - the professions' acts need them, and the
 *  professions are the server's, not a player's preference; the foods and the Wood Bundle stay the switch's. */
export const foragingCustomItemsForGroup = (group) => {
  if (group !== FORAGING_GROUP) return [];
  if (foragingOn()) return FORAGING_TEMPLATES.map((t) => t.index);
  return isOnlinePage() ? [...TOOL_TEMPLATES] : [];
};
registerCustomItemsForGroup(foragingCustomItemsForGroup);

// ---- the host ----------------------------------------------------------

/**
 * @typedef {object} ForagingHost
 * @property {() => import('./foragingLaw.js').ForagingWorld} world  what the checks ask, now
 * @property {() => number} monthValue    WorldTime.Now.MonthValue (0-based)
 * @property {() => object} [entity]      the player entity (the console command's)
 * @property {(name: string) => boolean} startQuest   QuestMachine.StartQuest(QuestListsManager.GetQuest(name, 0))
 */
let _host = /** @type {ForagingHost|null} */ (null);
/** The host that owns the player answers; returns the one it replaced (a nested host restores it). */
export function setForagingHost(h) { const prev = _host; _host = h ?? null; return prev; }
export const foragingHost = () => _host;

const INSIDE = Object.freeze({
  inside: true, insideDungeon: false, insideCastle: false, locationType: 0xffff, inLocationRect: false, hour: 12, climate: 0,
  region: 0, enemiesNear: false, carriedWeight: 0, maxEncumbrance: 1, swimming: false, exteriorWater: 'None',
});
const worldNow = () => _host?.world?.() ?? INSIDE;

let _random = Math.random;
/** Tests: the draws. */
export function _setForagingRandomForTests(fn) { _random = fn ?? Math.random; }

// ---- minting -----------------------------------------------------------

/** ItemBuilder.CreateItem(group, templateIndex): Foraging's own rows, or C&C's for its fish and fruit. */
export function createForagingItem(templateIndex) {
  if (!(templateIndex >= FT.WoodAxe && templateIndex <= FT.Egg)) return createSurvivalItem(templateIndex);
  return mintCondition(setItemFields({ group: FORAGING_GROUP, templateIndex, material: 0, flags: 0, variant: 0, message: 0, stackCount: 1 }));
}
/** `Player.Items.AddItem(item, AddPosition.Back)`, n times. */
function give(entity, templateIndex, n) {
  if (!entity || !templateIndex) return;
  if (!Array.isArray(entity.items)) entity.items = [];
  for (let i = 0; i < n; i++) {
    const item = createForagingItem(templateIndex);
    if (item) addItem(entity.items, item, 'back');
  }
}
/** QuestMachine.StartQuest(GetQuest(name, 0)); false when no quest was found - DFU's StartQuest(null) throws there,
 *  which ends the use before its wear, so the port wears nothing then either. */
const startQuest = (name) => !!_host?.startQuest?.(name);

// ---- the six tools -----------------------------------------------------

const stats = (entity) => ({
  intelligence: liveStat(entity, 'intelligence'), strength: liveStat(entity, 'strength'),
  agility: liveStat(entity, 'agility'), endurance: liveStat(entity, 'endurance'),
});

/** LowerCondition(1), then on a break "Your <Tool> broke." and the removal - after DFU's own popup. */
function wear(item, collection, entity) {
  lowerCondition(item, 1, entity, (line) => popupMessage(line), collection);
  if ((item.currentCondition ?? 0) > 0) return;
  hudText(brokeMessage(item.templateIndex));
  if (collection) { const i = collection.indexOf(item); if (i >= 0) collection.splice(i, 1); }
}

// ---- the professions' acts borrow the tools (PROF1, FORAGE0 14) -------------

/** PROF1 (FORAGE0 14.3): the checks a profession's act runs first, with Foraging's own line for `templateIndex` (the
 *  Sickle's for an herb, the Basket's for its food) - never asking Foraging's switch (law 6: the acts are the
 *  server's). Null where every check passes. */
export const foragingActRefusal = (templateIndex, skip = null) => foragingRefusal(templateIndex, worldNow(), skip);   // PROF2: a dungeon vein skips the surface's checks
/** PROF1 (FORAGE0 14.1): which tool an act draws - the first of its kind in the pack, in the pack's order (as DFU's
 *  ItemCollection finds it), one not yet broken. */
export const foragingToolIn = (entity, templateIndex) =>
  (Array.isArray(entity?.items) ? entity.items.find((it) => it?.templateIndex === templateIndex && (it.currentCondition ?? 1) > 0) : null) ?? null;
/** PROF1 (FORAGE0 14.1): a completed act wears its tool by one, as a Foraging use does - the break Foraging's two
 *  notices ("Your Sickle broke." after DFU's popup). */
export const wearForagingTool = (item, entity) => { if (item && entity) wear(item, entity.items ?? null, entity); };

/** One tool's UseItem: the checks, the yield and its box, the quest, the wear. */
export function useForagingTool(item, collection, { entity } = {}) {
  if (!foragingOn() || !entity) return null;
  const w = worldNow();
  const refusal = foragingRefusal(item.templateIndex, w);
  if (refusal) {
    hudText(refusal);
    return { kind: 'foraging', refused: true };   // DFU's false falls to NextVariant: nothing visible
  }
  const s = stats(entity);
  const cc = survivalOn();
  let text = null;
  let started = false;
  switch (item.templateIndex) {
    case FT.WoodAxe: {
      const n = woodAxeBundles({ ...s, climate: w.climate }, _random);
      give(entity, FT.WoodBundle, n);
      text = woodAxeMessage(n);
      started = startQuest(TOOL_QUESTS[FT.WoodAxe]);
      break;
    }
    case FT.PickAxe: started = startQuest(pickAxeQuest(s)); break;
    case FT.Sickle: started = startQuest(sickleQuest(w.climate, _host?.monthValue?.() ?? 0)); break;
    case FT.FishingNet: {
      const n = fishingCount(s, _random);
      give(entity, fishTemplate(cc), n);
      text = fishingMessage(n);
      started = startQuest(TOOL_QUESTS[FT.FishingNet]);
      break;
    }
    case FT.Spade: started = startQuest(spadeQuest(s, false)); break;   // Cheb's Necromancy is not in the port: never its family
    case FT.Basket: {
      const find = basketFind(basketDraw({ intelligence: s.intelligence, climate: w.climate, monthValue: _host?.monthValue?.() ?? 0 }, _random), cc);
      give(entity, find.templateIndex, find.count);
      text = find.message;
      started = startQuest(TOOL_QUESTS[FT.Basket]);
      break;
    }
    default: return null;
  }
  if (started) wear(item, collection, entity);
  return { kind: 'foraging', text };   // the box over the open inventory (ClickAnywhereToClose)
}

// ---- the five foods ----------------------------------------------------

/** One food's UseItem: the HUD line, fatigue in points, health or magicka, one eaten. */
export function eatForagingFood(item, collection, { entity } = {}) {
  if (!foragingOn() || !entity) return null;
  const f = FOODS[item.templateIndex];
  if (!f) return null;
  hudText(f.text);
  entity.fatigue = Math.min(maxFatigue(entity), (entity.fatigue ?? 0) + f.fatigue * FATIGUE_MULTIPLIER);   // IncreaseFatigue(n, true)
  if (f.health) entity.health = Math.min(entity.maxHealth ?? Infinity, (entity.health ?? 0) + f.health);   // IncreaseHealth
  if (f.magicka) entity.magicka = Math.min(entity.maxMagicka ?? Infinity, (entity.magicka ?? 0) + f.magicka);   // IncreaseMagicka
  if (collection) { const i = collection.indexOf(item); if (i >= 0) collection.splice(i, 1); }   // RemoveItem(this): the item whole (they never stack)
  return { kind: 'foraging' };
}

// ---- the console command ----------------------------------------------

/** Foraging_Tools: one of each tool, offline; refused online (FORAGE0 8). */
export function foragingToolsCommand() {
  // A switched-off mod has no command in DFU: answer as the console answers a name it does not know (GetCommand).
  if (!foragingOn()) return `Command ${FORAGING_COMMAND.name.toUpperCase()} not found.`;
  if (isOnlinePage()) return FORAGING_COMMAND.refusedOnline;
  const entity = _host?.entity?.();
  if (!entity) return FORAGING_COMMAND.answer;
  for (const t of TOOL_TEMPLATES) give(entity, t, 1);
  return FORAGING_COMMAND.answer;
}

// ---- the three loot hooks (FORAGE3) --------------------------------------

/** One hook's loop: `count` items, each its table's id then the roll, `AddItem(item, AddPosition.Back)` into `items`.
 *  Answers how many it added. */
function addLootItems(items, { table, count }, luck, quality) {
  let added = 0;
  for (let i = 0; i < count; i++) {
    const t = foragingLootItem(table, luck, quality, _random);
    if (!t) continue;
    const item = createForagingItem(t);
    if (item) { addItem(items, item, 'back'); added++; }
  }
  return added;
}
/** ForagingLoot_OnLootSpawned (IL_0520): PlayerActivate's event over a shelf or a house container. */
export function onForagingContainerLoot(args) {
  if (!foragingOn() || !Array.isArray(args?.items) || args.buildingType == null) return 0;   // `Interior != null`
  return addLootItems(args.items, containerLootDraw(args, _random), args.luck ?? 50, args.quality ?? 0);
}
/** ForagingLoot_OnDungeonLootSpawned (IL_084c): LootTables' event over a pile, by the index it was generated at. */
export function onForagingPileLoot(args) {
  if (!foragingOn() || !Array.isArray(args?.items)) return 0;
  return addLootItems(args.items, dungeonLootDraw(args.locationIndex, _random), args.luck ?? 50, -1);
}
/** ForagingLoot_OnEnemyDeath (IL_0a08): into the corpse, which is the entity's items (UL1). */
export function onForagingEnemyDeath(entity, opts = {}) {
  if (!foragingOn() || !entity || entity.isPlayer || !Array.isArray(entity.items)) return 0;   // `as EnemyEntity`
  return addLootItems(entity.items, corpseLootDraw(entity, _random), opts.luck ?? 50, -1);
}

// ---- the install -------------------------------------------------------

/** The author's pictures, from the vendored Textures/ (standIn: these archives exist only as this art). */
export const foragingTextureUrl = (archive) => new URL(`../../vendor/foraging/Textures/${archive}_0-0.png`, import.meta.url).href;

let _installed = false;
/** Once, at the scene boot (ensureAudio, before any quest bridge is built). `fetchBytes` is a test's seam. */
export function installForaging({ fetchBytes = null } = {}) {
  if (_installed) return 0;
  _installed = true;
  registerQuestList(FORAGING_QUEST_LIST, foragingOn);
  const toolUse = (item, collection, ctx) => useForagingTool(item, collection, ctx);
  toolUse.usable = () => foragingOn();
  for (const t of TOOL_TEMPLATES) registerItemUseHandler(t, toolUse);
  const eat = (item, collection, ctx) => eatForagingFood(item, collection, ctx);
  eat.usable = () => foragingOn();
  for (const t of Object.keys(FOODS)) registerItemUseHandler(Number(t), eat);
  registerCommand(FORAGING_COMMAND.name, FORAGING_COMMAND.description, FORAGING_COMMAND.usage, () => foragingToolsCommand());
  gateConsoleCommand(FORAGING_COMMAND.name, foragingOn);   // AUDIT 28 F7: off, the mod has no command - not even a HELP line
  // FORAGE3: Init's three subscriptions (IL_049a-IL_04f5), in its order - after every mod that loaded first (RRI's)
  registerContainerLootHandler(FORAGING_VENDOR, onForagingContainerLoot);
  registerTabledLootHandler(FORAGING_VENDOR, onForagingPileLoot);
  registerEnemyDeathHandler(FORAGING_VENDOR, onForagingEnemyDeath);
  const load = fetchBytes ?? (async (archive) => {
    const r = await fetch(foragingTextureUrl(archive));
    if (!r.ok) throw new Error(`foraging ${archive}: ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  });
  return addVendorTextures(FORAGING_TEXTURE_ARCHIVES.map((archive) => ({
    archive, record: 0, frame: 0, standIn: true, lazy: true, fileName: `${archive}_0-0`, load: () => load(archive),
  })));
}
/** Tests: install again - and the three subscribers the install registered come out with it, so a later test in the
 *  same process never hears Foraging's pile hook roll on Math.random before its own spy (AUDIT BOUNTY1: FORAGE3's
 *  OnLootSpawned pin failed one run in four behind the leak). */
export function _resetForagingInstall() {
  _installed = false;
  registerContainerLootHandler(FORAGING_VENDOR, null);
  registerTabledLootHandler(FORAGING_VENDOR, null);
  registerEnemyDeathHandler(FORAGING_VENDOR, null);
}

/** Whether a template is one of this mod's (the templates are registered at import). */
export const isForagingItem = (item) => !!item && !!templateByIndex(item.templateIndex) && item.templateIndex >= FT.WoodAxe && item.templateIndex <= FT.Egg;
