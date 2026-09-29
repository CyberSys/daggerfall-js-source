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
 *  test/mwbrig2.test.js holds it to the mod's own row. */
export const RRI_JERKIN_TEMPLATE = 520;

/**
 * The port's own worn models.
 *
 * `skinFrom`: the body slots the model was fitted over. It is SKINNED FROM THEM at bind time
 * (formats/mwSkinTransfer.js): every vertex copies the skin of the body vertex under it, so it moves by the body's
 * own bones and binds and never comes away from it. MW-BRIG1 hung it rigid on the Chest and Groin nodes instead, and
 * the torso the body skins to its spine and pelvis moved one way while the brigandine moved another (MW-BRIG2).
 * The meshes are baked where they sit on the resting body (tools/bakeBrigandine.mjs, `placement: 'scene'`).
 */
export const OWN_MW_ARMOR = Object.freeze([
  Object.freeze({
    id: 'daggerfall_brigandine_steel',
    name: 'Steel Brigandine',
    templateIndex: RRI_JERKIN_TEMPLATE,
    material: ARMOR_MATERIAL.Steel,
    // One piece, worn as a cuirass (it hides the chest skin). The skirt needs no split of its own: skinned from the
    // groin, thighs and knees, it bends with the legs under it.
    skinFrom: Object.freeze(['chest', 'groin', 'upperleg', 'knee']),
    parts: Object.freeze([
      Object.freeze({ part: 'cuirass', model: 'brigandine_steel.nif' }),
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
