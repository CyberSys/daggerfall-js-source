// THE ARMOUR MORROWIND DOES NOT HAVE.
//
// MW-BRIG1 (2026-09-29, Mac: "This is for the morrowind model. The steel
// brigantine"). The worn counterpart of ownWeaponModels.js, and a leaf
// for the same reason that one is: mwItemMap.js asks it, and nothing it
// imports may reach back.
//
// A worn Daggerfall piece reaches the Morrowind body through the player's
// own records - mwArmorRecords finds an ARMO by material and piece token,
// composeRefs follows its part references to BODY records, and each BODY
// names the mesh. A model the port ships has no record in anybody's
// Morrowind.esm, so this table stands where those two records would: per
// piece, which Morrowind PART it fills (ARMO_PART's names - that is what
// decides its bone and the skin it hides) and the mesh, shipped by
// systems/ownMwAssets.js under the same `meshes/` path a BODY's model
// takes. Everything downstream - the priority law, the skin shadows, the
// binder - is the ordinary path.
//
// ═══ KEYED ON TEMPLATE AND MATERIAL ═══════════════════════════════
//
// The weapon table keys on the template alone because the Thunderlock has
// no material ladder. Armour does: Roleplay & Realism Items' Jerkin is
// leather, fur or "Brigandine" by its material (rriItems.js lightWord -
// Iron and up), and Mac's model is the STEEL one. Every other material
// of the same jerkin keeps the retail cuirass it resolved to before.
import { ARMOR_MATERIAL } from '../systems/armorMaterials.js';

/** Roleplay & Realism Items' Jerkin (systems/rriItems.js RRI_TEMPLATES,
 *  ItemJerkin). Restated rather than imported for the leaf's sake;
 *  test/mwbrig1.test.js holds it to the mod's own row. */
export const RRI_JERKIN_TEMPLATE = 520;

/**
 * The port's own worn models.
 *
 * `restPose`: the meshes were fitted onto the Morrowind body in the
 * modeller's scene, so their vertices sit in the skeleton's REST space
 * and the binder takes each bone's rest transform back out
 * (mwFirstPerson.js restPoseInverse). Every piece here is authored that
 * way - tools/bakeBrigandine.mjs bakes with `placement: 'scene'`.
 */
export const OWN_MW_ARMOR = Object.freeze([
  Object.freeze({
    id: 'daggerfall_brigandine_steel',
    name: 'Steel Brigandine',
    templateIndex: RRI_JERKIN_TEMPLATE,
    material: ARMOR_MATERIAL.Steel,
    restPose: true,
    // Split at the belt (Mac's call): the body rides Chest as a cuirass
    // does and hides the chest skin; the knee-length skirt rides Groin
    // as a Morrowind skirt part does, and hides nothing - the legs stay
    // under it, as they do under retail's skirts.
    parts: Object.freeze([
      Object.freeze({ part: 'cuirass', model: 'brigandine_steel_chest.nif' }),
      Object.freeze({ part: 'skirt', model: 'brigandine_steel_skirt.nif' }),
    ]),
  }),
]);

/** The own model this worn piece wears, or null for everything that
 *  resolves through Morrowind's own records. */
export const ownArmorModelFor = (piece) =>
  (piece && OWN_MW_ARMOR.find((a) => a.templateIndex === piece.templateIndex && a.material === piece.material)) || null;

/** Every mesh path this table can ask for, derived rather than typed out
 *  again - for a preload and a coverage walk alike. */
export const ownArmorModelPaths = () =>
  OWN_MW_ARMOR.flatMap((a) => a.parts.map((p) => `meshes/${p.model}`));
