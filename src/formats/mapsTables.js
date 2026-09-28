// @ts-check
// ═══════════════════════════════════════════════════════════════════
// PROF1 (2026-09-28, Mac: "Begin!") - MAPSFILE'S PURE TABLES: the
// region names, the regions' races and the climates, moved out of
// mapsFile.js (which re-exports them) so the account service can read
// them without bundling a BSA reader. The professions' laws need two of
// them on both ends: a pixel's climate chooses its herbs, and its
// region's race chooses an herb's group - DFU's "(northern)" and
// "(southern)" plants (bible/06-Systems/Professions-Arc.md 22).
// Verbatim FALL.EXE / MapsFile.cs tables; nothing here reads a file.
// ═══════════════════════════════════════════════════════════════════

/** The world map's size in map pixels (MapsFile.MaxMapPixelX / Y). */
export const MAX_MAP_PIXEL_X = 1000;
export const MAX_MAP_PIXEL_Y = 500;

/** All region names (index = region index). */
export const REGION_NAMES = Object.freeze([
  "Alik'r Desert", 'Dragontail Mountains', 'Glenpoint Foothills', 'Daggerfall Bluffs',
  'Yeorth Burrowland', 'Dwynnen', 'Ravennian Forest', 'Devilrock',
  'Malekna Forest', 'Isle of Balfiera', 'Bantha', "Dak'fron",
  'Islands in the Western Iliac Bay', 'Tamarilyn Point', 'Lainlyn Cliffs', 'Bjoulsae River',
  'Wrothgarian Mountains', 'Daggerfall', 'Glenpoint', 'Betony', 'Sentinel', 'Anticlere', 'Lainlyn', 'Wayrest',
  'Gen Tem High Rock village', 'Gen Rai Hammerfell village', 'Orsinium Area', 'Skeffington Wood',
  'Hammerfell bay coast', 'Hammerfell sea coast', 'High Rock bay coast', 'High Rock sea coast',
  'Northmoor', 'Menevia', 'Alcaire', 'Koegria', 'Bhoriane', 'Kambria', 'Phrygias', 'Urvaius',
  'Ykalon', 'Daenia', 'Shalgora', 'Abibon-Gora', 'Kairou', 'Pothago', 'Myrkwasa', 'Ayasofya',
  'Tigonus', 'Kozanset', 'Satakalaam', 'Totambu', 'Mournoth', 'Ephesus', 'Santaki', 'Antiphyllos',
  'Bergama', 'Gavaudon', 'Tulune', 'Glenumbra Moors', 'Ilessan Hills', 'Cybiades',
]);

/** Region races from FALL.EXE (0 = Breton, 1 = Redguard). Used for townsfolk names. */
export const REGION_RACES = Object.freeze([
  1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 1,
  0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0,
  0, 1,
]);

export const CLIMATES = Object.freeze({
  Ocean: 223,
  Desert: 224,
  Desert2: 225, // seen in Dak'fron
  Mountain: 226,
  Rainforest: 227,
  Swamp: 228,
  Subtropical: 229,
  MountainWoods: 230,
  Woodlands: 231,
  HauntedWoodlands: 232, // not sure where this is?
});
