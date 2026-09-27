# Come Sail Away 2.1 - RedRoryOTheGlen (ported 1:1 off the assembly)

**Come Sail Away 2.1** for Daggerfall Unity 1.1.1, by **RedRoryOTheGlen**
(Nexus mod 1131; GUID `dbe3e8ff-9059-45f1-a8be-732bb6000df7`; the
manifest's ContactInfo is the author's e-mail, kept out of this note).
The mod's own description: "Adds a usable boat and sailing mechanics."
Its assembly's namespace is *ComeSailAwayMod*: one MonoBehaviour,
`ComeSailAway` (6,808 lines read back to C#), and ten small classes
beside it - `Boat`, `ComeSailAwaySaveData` (with `PlacedBoatData` and
`MapMarkerData`), the two item classes `ItemBoatParts` and
`ItemBoatDeed`, `WaterWalkingSilent`, `FixDeformations`,
`ApplyGameTextures` and `RudderAnimationEventListener`.

Mac (Lattymoy) handed the shipped zip
(`Come_Sail_Away_1131_2.1_2026-06-22T11-24Z_FKUUdDR9a`, one file:
`Mods/come sail away.dfmod`) over on 2026-09-26 with the Ocean Holes
archive - "All mods attached are to be compatible and implemented 1:1" -
lifting the hold of 2026-09-25 ("Let's hold off on sail away").

**Permission: granted (Mac handed the archive over 2026-09-26) - the
archive carries no licence text and no readme.**

> [Mac: paste the text of the permission, or the link to it, here.]

## What is here

- `come-sail-away.dfmod.json` - the shipped manifest, verbatim (the
  bundle carries it as `ComeSailAway.dfmod`): title, version 2.1,
  author, DFUnity 1.1.1, the GUID, and the 336 files it was built from.
- `modsettings.json` - the shipped settings, verbatim: ten sections
  (Controls, WindDirectionWidget, Waves, Cargo, Audio, Handling,
  SailingAssist, Compatibility, Map, Debug) and four unnamed spacers.
  `src/systems/modSettings.js` restates every key under the vendor key
  `come-sail-away`, section and name joined with a dot
  (`Waves.Distance`), with the port's own `Enabled` in front. Three keys
  ship that the assembly never reads (`Handling.BadTack`,
  `Handling.BadTackMultiplier`, `SailingAssist.AutoStowGaffSails`); they
  are declared, and do nothing, as in DFU.
- `ItemTemplates.json` - the mod's two item templates, the bundle's text
  verbatim: 1320 "Parts of" (a boat packed up to carry, 120 kg) and 1321
  "Deed to" (0.5 kg). The file ends its array with a trailing comma,
  which DFU's parser takes (FullSerializer's `fsJsonParser` reads an
  element, skips one comma and stops at the bracket -
  `TextAssetReader.Merge` hands it the text as shipped); a strict JSON
  reader does not, so the port reads it as DFU does.
- `Come Sail Away.dll` - the shipped assembly, byte for byte (sha256
  `5ffe5463...bdf5`). The bundle's manifest lists seven C# files, all
  compiled into it; the port's law is this assembly, read back to C#, and
  the port's modules cite it by class and member name
  (`ComeSailAway.UpdateWind`, `Boat.modifierCargoThreshold`...).

## What is NOT here, and why

- **The boats, their animation and their sounds** - the bundle's own
  meshes, prefabs, materials, animation clips and controllers, particle
  systems, textures and audio. The port's extraction tool reads them out
  of the shipped bundle as the slices that need them land
  (`bible/03-World/Come-Sail-Away.md`); none is carried until its slice
  does.
- **The Daggerfall textures the boats wear.** A material named
  `TEXTURE.AAA_R` is Daggerfall's texture archive AAA, record R, which
  the mod (`ApplyGameTextures`) and the port both load from the player's
  own ARENA2 at run time.

The page for the whole port is `bible/03-World/Come-Sail-Away.md`.
