# Bloodmoon's werewolf, and the Shadow Fang skin (WEREWOLF1, 2026-09-26)

Mac, of SirMcMobdon's werewolf skin: "it's the 3d model", "Might need to grab OpenMW for this", then "Well it needs
to be imported if its not. It shouldnt be skipped". And the skin itself: "Wants a custom morrowind werewolf skin
(skin base but blacker amd like crimson red thru out the edging in the fur, red eyes)".

Until this slice the Morrowind rig scoped the werewolf out (`combat/fpArm.js`, rule 6's note): a transformed player
with the Morrowind body stood as their own human body, and the only "Morrowind-looking" werewolf in the port was Eye Of
The Beholder's pre-rendered sprite (PR-WW1). This page is the 3D werewolf, read off OpenMW's source (a shallow clone
of OpenMW/openmw at 3ee798e, 0.52.0-dev), and the skin that dresses one player's.

## What OpenMW draws for a werewolf

- **The skeletons.** `getActorSkeleton` tests the werewolf first, whatever the race or sex
  (`apps/openmw/mwrender/actorutil.cpp:8-32`): `[Models] wolfskin = meshes/wolf/skin.nif` and
  `wolfskin1st = meshes/wolf/skin.1st.nif` (`files/settings-default.cfg:1123`, `:1126`). Rule 18's x-swap applies:
  `meshes/wolf/xskin.nif` when `meshes/wolf/xskin.kf` exists (`components/misc/resourcehelpers.cpp:180-198`).
- **One animation source.** `updateNpcBase` leaves the base empty for a werewolf (`npcanimation.cpp:503-510`), so
  `xbase_anim.kf` / `xbase_anim.1st.kf` are never added; only the wolf skeleton's own `.kf` (`:529-533`).
- **No body parts.** `getBodyParts(..., werewolf)` answers 27 nulls before reading a BODY record (`:1200-1203`), and
  the skeleton's own geometry is stripped (`setObjectRoot(smodel, true, true, false)`, `:525`, through
  `CleanObjectRootVisitor`). What is drawn is:
  - **the robe**: `MechanicsManager::setWerewolf` unequips everything and equips the CLOT `werewolfrobe` in
    `Slot_Robe` (`mwmechanics/mechanicsmanagerimp.cpp:1896-1901`); its part references are claimed at the robe's
    priority `((11+1)<<1)+0 = 24`, and the robe reserves its eleven slots (`npcanimation.cpp:633-641`);
  - **the head and hair**: the BODY records `WerewolfHead` and `WerewolfHair`, looked up by id alone - no race, sex,
    part or flag test (`:475-494`) - third person only, and only while the head slot is the skin's (`:650-656`).
- **First person.** The robe's parts take `addPartGroup`'s ladder (`:873-915`): a part's `<id>.1st` record, else the
  plain one only for a hand, wrist, forearm or upper arm, else the slot reserved with nothing in it.
- **The wolf holds nothing.** `unequipAll` empties every slot; the player's items are refused while transformed.
- **Animation groups** are the standard names; the werewolf fights hand-to-hand (`idlehh`, `handtohand`, falling back
  to the bare groups), which the port's machine already composes for an empty drawn hand.
- **The rebuild.** A change of NPC type rebuilds the animation (`updateParts`, `:578-584` -> `rebuild()`).
- Scale: `Npc::adjustScale` has no werewolf test - the wolf takes the actor's race scale.

## What the port does

- `combat/fpArm.js`: `WOLFSKIN` / `WOLFSKIN_1ST`; `fpSkeletonPath` / `tpSkeletonPath` take `werewolf` and ask for the
  wolf first. `buildFpArm({ werewolf })` and `buildTpBody({ werewolf })`: no face match, no race rows, the robe
  composed as a garment handed in whole (`mwItemMap.js composeWornArmor`, a `record` piece at the robe's priority with
  its reserves), the first person through `firstPersonPartGroup`, the head and hair by `werewolfHeadRows`
  (`mwFirstPerson.js`), no weapon, arrow, torch, lantern, holster or bone addons, and the wolf's own `.kf` alone
  (`fpAnimSources` / `tpAnimSources` with `{ werewolf }`). The result carries `werewolf: true`.
- **The rig follows the curse.** `fpArm.setWerewolf(on, { skin })` rebuilds as the wolf and back on a change (one
  boolean compare otherwise); `builtFor()` carries the form. While the wolf stands the worn table, the torch and the
  lantern are kept for the way back and not worn. A wolf refused (no Bloodmoon) can still turn back.
- `combat/weaponRig.js`: `isMwWerewolf(entity)` - transformed, and the curse the wolf's (LycanthropyTypes 1); the
  wereboar has no Morrowind form and keeps the person's body. It rides `armBuildOptsOf` (a save loaded mid-change
  builds the wolf at the door) and `armIdentityOf`, and every frame `setWerewolf` is handed the form ahead of the worn
  table.
- **Peers.** `net/peerBodies.js`: the pose's `wb` 1 is the wolf (`peerIsWolf`); `peerBodyKey` keys the wolf apart from
  the person, so a transformation rebuilds at once rather than after `BODY_REBUILD_MS`, and a refused wolf is waited
  out as a wolf. The wolf's body is built holding nothing, readying no spell and hanging no lantern. In
  `scenes/world.js` a werewolf on foot goes to the bodies either way (its wolf builds while Eye Of The Beholder's
  lycanthrope stands for it), and `net/peerRiders.js` skips a beast on foot whose wolf stands (`skip`). A mounted beast
  and the wereboar stay the rider layer's.
- **Not a garment.** `mwClothingRecord` never resolves a Daggerfall robe to `werewolfrobe` (OpenMW hides it from the
  inventory): a dark robe measured nearest its fur would have dressed a person in the wolf's body.

## The fallback

Bloodmoon's files are the player's own, like every Morrowind file. Without Bloodmoon attached the wolf is refused at
its skeleton (`meshes/wolf/skin.1st.nif is not in your archives`), nothing of Morrowind stands, and the transformed
player is Eye Of The Beholder's lycanthrope in third person and the classic claws in first - as before. A viewer
without Bloodmoon sees a transformed peer as the lycanthrope.

## The Shadow Fang skin

`characters/werewolfSkin.js`. The textures are Bloodmoon's, so the skin is a **law over their pixels**, painted on a
**copy** on the way to the GPU (`fpArm.js hangRangeTextures`, `skinnedMips`) - the decoded texture cache is shared by
every rig on the page. Per texel:

- **the eyes burn red** (#ff222e, the glyph's own eye): every texel of a texture whose file names an eye, and any glow
  no fur takes - bright and saturated in the yellow-to-cyan hues, or a hot saturated red;
- **the base is the skin's own colour, blacker**: a third of its light, 40% of its colour drained toward its grey;
- **the edging is crimson** (#c41230) through the fur: a strand lighter than its 5x5 neighbourhood, the lit tips, and
  the fringe of an alpha-cut fur card, the crimson lit by the texel's own light.

**Who wears it**: the holder of the Shadow Fang glyph. A peer, by the glyphs their signed token carries (the relay
reads them off the signature, so every client in a room agrees); the player, by the account service's last word on
this device - `net/accountClient.js adoptIdentity` keeps a token's or a wardrobe's `glyphs` on the stored session, and
`systems/ownGlyphs.js` reads them, so the skin is theirs offline too. The skin rides the build opts (`skin`), the peer's
body key and `setWerewolf`; it is only ever applied to the wolf's body, never a person's or an item's icon.

## What is not verified here

No Bloodmoon data is in this container. The pins drive the law with fixture meshes under Bloodmoon's own paths and
hand-written BODY/CLOT records; they prove which files are asked for and how they are dressed, not how Bloodmoon's
real werewolf looks. In particular:

- the robe's actual part list, and whether its records carry `.1st` variants, are Bloodmoon.esm's;
- whether Bloodmoon ships `xskin.kf` / `xskin.1st.kf` (the build takes whichever exists), and whether the first-person
  wolf skeleton has a `Camera` or `Head` bone (the build refuses without one, by name);
- the skin's eye rule is a colour rule; if Bloodmoon's werewolf eyes are neither an eye texture nor a glow, they stay
  their colour, blackened. The preview was made on Eye Of The Beholder's renders of the same wolf.

The first player to transform with Bloodmoon attached is the check; a refusal is a named note on the Morrowind card.

## Pins

- `test/werewolf1.test.js` (10): the paths and sources, the robe and its first-person ladder, the head and hair, the
  build (read log: the wolf's files, none of the person's), the refusal, the rig, the weapon rig, the peers, the host
  and the garment pool. `tools/mutants/werewolf1.json` 25, all dead.
- `test/shadowfangskin.test.js` (5): who wears it, the law, the mips, the rig (skinned copies on the wolf only, the
  cache untouched), and whose skin (the stored session, the peer's key). `tools/mutants/shadowfangskin.json` 14, all
  dead.
- Nine older pins re-aimed to the new law (disc12, prww1_werewolf, mwbody1, fparm x2, htwaist_mwbody, mwarms_fps,
  mwtorch, ws1_sheathing): a werewolf on foot may now take a Morrowind body; the wereboar still never does.
