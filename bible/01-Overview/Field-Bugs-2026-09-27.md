# FIELD BUGS 2026-09-27 — invisible players, and a visitor's drops in a house

Relayed by Mac at the end of QUEST-PARTY phase 3 ("I'm recieving reports of"):

1. *"Other player's still see other players who are suppose to be invisible"*.
2. *"In houses, players can drop items and the owner cannot see them"*.

## INVIS-NET: a concealed player is concealed from the others too (report 1)

A player's magical concealment - Invisibility, Chameleon, Shadow (`systems/effects.js` isInvisible / isBlending /
isAShade, normal or true power) - lived on their own entity alone. The pose carried none of it, so every other player
drew them whole (the Morrowind body, the class sprite, the rider, the name), could press F on them, and their own foes
hunted them as if they stood in the open: enemyMotor's illusion gate reads a peer target's `concealment()` closure, and
no peer candidate carried one (its own note: "a peer's flags are a later slice's wire field").

- **The wire.** The pose carries `cv` - 1 invisible, 2 blending, 4 a shade (`effects.js concealBits`), OMITTED at 0,
  so an unconcealed pose is the bytes it always was; `validPose` bounds it, `poseChanged` sends its edge at once (a
  vanishing is news, not a keepalive), `lerpPose` carries it whole. A pose field is never gated: an older relay drops
  it and the others see what they saw before. It rides world114, the relay deploy OWN1 already takes.
- **The draw.** A peer whose drawn pose is concealed is drawn as DFU draws every concealed entity that is not the
  player (EntityConcealmentBehaviour: the renderer off): no rider, no body, no walker, no sprite, no name (world.js,
  `seen` beside `drawable`). Its cast is still seen - a missile leaves an invisible caster's hand in DFU too.
- **The F key and the plaque** skip a concealed peer (`peerInSight`).
- **The foes.** `peersNear` carries each peer's bits, and both foe pools' peer candidates answer `concealment()` off
  them (`concealFlagsOfBits`), so EnemySenses.BlockedByIllusionEffect reads a peer as it reads any target.

Pinned: `test/invisnet.test.js` (5). `tools/mutants/invisnet.json` (14 dead).

## HOUSE-DROP: a visitor drops nothing in someone else's online home (report 2)

A drop is the dropper's own (AUDIT WORLD B3) and an online home's room carries no loot at all (HOME1), so what a
visitor left on another's floor stood on the visitor's screen alone - the owner never saw it. Asked how it should
work (the owner's floor, the dropper's own shown to all, or no drop), Mac chose **"Block visitor drops"**.

- Both inventory skins ask the host's word whenever the destination IS the ground - the session's dropped list, or a
  pile the player dropped before - never a wagon, a chest, a corpse or a merchant (`inventorySession.js
  groundRefusalOf`), and the transfer law refuses with it said (`itemTransfer.js planStore` / `planDropGold`
  `groundRefusal`): "You cannot drop items in another's home." The item stays in the pack; gold stays in the purse.
- A light dropped or thrown (Handheld Torches) is refused the same way (`handheldTorches.js`, through the rig).
- The building's close is a belt: anything that still reaches it goes back to the pack, gold to the counter
  (`worldModes.js`, `takeOneInto`).
- Only a VISITOR in someone else's online home: the owner's own floor, an offline house and every other building are
  as they were.

Pinned: `test/housedrop.test.js` (5). `tools/mutants/housedrop.json` (16 dead).

## INVIS-LOOK: the transparent look (the follow-up, the same day)

Mac: *"Give invisibility the same invisibility we give enemies in enhanced AI. That transparent look"*. INVIS-NET drew
a concealed player as DFU draws any concealed entity that is not the player - not at all. That is the classic lane's
draw now. Under Enhanced Combat Visuals (the switch the concealed foes' look already takes) a concealed player is drawn
the way that lane draws a concealed foe: Chameleon's translucent shimmer and ripple, a shade's dark silhouette - and
an INVISIBLE player takes the shimmer too (a foe's invisibility is still not drawn; this is the one departure, asked).

- Every figure that can stand for the peer carries it: the rider, the Eye Of The Beholder walker, the class sprite and
  the doll (their billboards, the renderer's blended phase), and the Morrowind body (its sprite box's quad, with the
  billboard shader's own look, drawn after each mode's opaque world so what stands behind it shows through).
- No name over a concealed peer; a concealed walker's lantern is not drawn; F and the plaque still skip them, and
  their foes still read the flags.

Pinned: `test/invislook.test.js` (7). `tools/mutants/invislook.json` (31 dead).

## PSCALE-OWN: the first of phase 3c's two gaps (Mac: "Finish the 2 gaps")

A shared quest's foe underground (QUEST-PARTY phase 3c's own lane) was the one foe a party fights together that no
party's size weighed. It is weighed now, as every other shared foe is: as tough as the party striking it, striking each
as a party's foe, counted by whoever runs it - my own quest's by me whoever holds the seat, a party member's puppet by
its owner's record. My private quest's foe and my summoned ally stay unweighed. `06-Systems/Online-Arc.md` (PSCALE-OWN).
Pinned: `test/pscaleown.test.js` (3). `tools/mutants/pscaleown.json` (7 dead).
