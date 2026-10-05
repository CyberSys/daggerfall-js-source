// VE3 (2026-10-05) - VANILLA ENHANCED, THE TEXTURE OVERHAUL'S FIRST PACK.
//
// carademono's Vanilla Enhanced (Nexus Mods, Daggerfall Unity mod 273; its sources at
// github.com/drcarademono/vanilla-enhanced) is Daggerfall's own textures remastered - the terrain's tile sets, the
// nature flats, the city walls, the dungeons. That makes it the doctrine's own case (Port-Doctrine: A RENDER OF GAME
// DATA IS GAME DATA): none of its pixels ships with the port. The player attaches their own copy - the mod's .dfmod
// files - through the texture-mod door (systems/dfmodTextures.js), and this module names which attached mods are
// Vanilla Enhanced and wears them as one look on the Texture Overhaul card (systems/overhauls.js).
//
// THE FAMILY is the Base and every mod built on it: Masked Roads, Snowless Swamps and Jungles and Winter Tracks each
// declare `vanilla enhanced - base` a dependency in their manifests - the same declaration that loads them after the
// Base, so that where they and the Base carry one name the add-on's picture is drawn (VE1, DFU's load order).
//
// Nothing here touches the DOM: the card's attach (the file pick) is the menu's.
import { attachedDfmods, setDfmodEnabled } from './dfmodTextures.js';
import { textureReplacementCount, textureReplacementEnabled } from './textureReplacement.js';
import { isIilMod } from './improvedInteriorLighting.js';   // the lighting mod rides the same store and is no texture mod
import { setValue, saveSettings } from './settings.js';

/** The Base's Mod.FileName - the name its add-ons depend on. */
export const VE_BASE = 'vanilla enhanced - base';
/** The Base's GUID (`Vanilla Enhanced - Base.dfmod.json`), for a copy stored under another file name. */
export const VE_BASE_GUID = '1f124f8c-dd01-48ad-a5b9-0b4a0e4702d2';
/** Where a player gets their copy. */
export const VE_LINK = 'https://www.nexusmods.com/daggerfallunity/mods/273';

export const isVeBase = (m) => !!m && (m.fileName === VE_BASE || m.guid === VE_BASE_GUID);
/** The Base, or a mod that depends on it. */
export const isVeFamily = (m) => isVeBase(m) || (m?.deps ?? []).includes(VE_BASE);
/** Every attached texture mod - the packs card's list: every attached .dfmod but the lighting mod. */
export const textureMods = () => attachedDfmods().filter((m) => !isIilMod(m));
/** The attached Base, or null. */
export const veBase = () => attachedDfmods().find(isVeBase) ?? null;

/** Vanilla Enhanced is worn: the Base is attached and switched on, and DFU's Replace Game Artwork is on. */
export const veWorn = () => textureReplacementEnabled() && veBase()?.enabled === true;
/** Daggerfall's own textures are what is drawn: Replace Game Artwork is off, or no texture mod is on and no loose
 *  texture pack is attached (that one has no switch - the packs card removes it). */
export const classicTexturesWorn = () => !textureReplacementEnabled() || (!textureMods().some((m) => m.enabled) && textureReplacementCount() === 0);

/** Wear Vanilla Enhanced: its family switched on, and Replace Game Artwork with it (the switch every texture pack
 *  stands behind - DFU's Enhancements/AssetInjection). Other texture mods are left as they are. */
export function wearVanillaEnhanced() {
  if (!textureReplacementEnabled()) { setValue('Enhancements', 'AssetInjection', 'True'); saveSettings(); }
  setDfmodEnabled(attachedDfmods().filter(isVeFamily).map((m) => m.key), true);
}
/** Wear Daggerfall's own textures: every texture mod switched off, kept attached. */
export function wearClassicTextures() {
  setDfmodEnabled(textureMods().map((m) => m.key), false);
}
