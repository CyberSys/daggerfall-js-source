# Texture Mods (.dfmod) and Pack Removal

**Add your own Daggerfall Unity texture mods.** Settings → Mods → *Replacement
packs* has a new **Add texture mods** button. Pick one or more `.dfmod` files
(DREAM 90s and mods like it); they are stored in this browser, listed with
their title and version, and each has its own **Remove**.

What a texture mod now drives:

- world textures, flats, NPCs, commoners and monsters, with the mod's xml
  billboard sizes;
- item icons and paperdoll pieces by dye and material, with helmet masks,
  placed by the mod's xml `<rect>`;
- the paperdoll's backdrop, body and head;
- talk-window portraits.

The bundle reader learned **BC7** (the format DREAM's paperdoll uses). A mod's
bundle is read once when you add it; after that the game opens it only when one
of its pictures is needed.

Not supported yet: mod scripts (DREAM's time-of-day backgrounds and dungeon-exit
script), normal/height/emission maps, and terrain texture arrays.

**Every pack can come off.** *Remove music pack*, *Remove sound pack*, *Remove
texture pack* and *Remove all texture mods* sit beside their Attach buttons
once something is attached, each behind a confirm. Removing textures takes full
effect the next time an area loads.

**Big HD packs (DREAM's full-resolution set).** A `.dfmod` is no longer read
into memory whole: it is read piece by piece from where it is stored, so a
multi-gigabyte bundle opens in moments. The game never waits on a mod on its
way in - a mod that still needs reading is read in the background - and no
area waits more than 20 seconds for one. **Texture detail** (256 / 512 / 1024 /
full, default 256) sets the largest size a mod picture is loaded at; HD packs
above 512 can run out of memory. If a mod ever stops the game from starting,
open the game with `?nomods` at the end of the address and remove it from the
packs card.

**Memory fixes from a player's log.** Seasons of the Iliac Bay's loader used to
open *every* attached `.dfmod` whole to look for its own - with DREAM's
gigabyte bundles that alone ran the tab out of memory. It now reads only its own
bundle. A mod that cannot be read now says why on its row in the packs card, and
attaching two versions of the same mod (DREAM and DREAM 90s) shows a warning.
Handheld-weapon frames from a texture mod now reach the first-person weapon.

**Out-of-memory fixes, round two.** Every attached mod used to get its own
background worker, and each area sent all its picture requests at once - with
ten-plus HD bundles that was ten-plus decoders running full-size pictures side
by side. Now all mods share two workers, each decoding one picture at a time; a
request nobody is waiting for any more (older than 15 seconds) is dropped
instead of decoded. Mod pictures also have a memory budget (up to 1536 MB,
less on smaller machines): past it, the rest of the session draws the classic
art for new mod pictures instead of running out of memory.

**PERF-2D warning while talking to an NPC.** The talk window could leave a UI
2D run open across a tick, so a background pass (rain, sky, grass) that drew
while the window was up landed inside it and logged the renderer's `PERF-2D`
warning. The talk window now closes its own run at the end of every draw.

**Weapons right way up, Diverse Weapons HD, DREAM ground.**
- Weapon frames from any `.dfmod` (Weapon Widget, Diverse Weapons, texture mods) were drawn upside down -
  "held overhead". The bundle reader already answers pictures top-first; the extra flip is gone.
- Diverse Weapons HD (Handhelds I/II, Inventory) is accepted: its crunched textures now decode, it is read as a
  texture mod, and its frames replace the built-in Diverse Weapons sprites. Weapon frames keep at least 512 px.
- DREAM's ground: the terrain tile sets a texture mod ships (`302-TexArray` and the like) replace the classic ground
  tiles - only while such a mod is attached, and only as a whole set. Reload once after updating: the ground keeps
  the set it was first built with for the session, and older mod indexes are re-read in the background.

**HD paperdoll.** With a texture mod attached the paperdoll is drawn at 4x (440x736 instead of 110x184), so DREAM's
paperdoll art keeps its detail instead of being squeezed to Daggerfall's size and blown back up. Classic layers are
scaled up pixel for pixel exactly as before; clicks, item placement and the other players' dolls are unchanged.
Without a texture mod the doll is drawn exactly as before.

**Improved Interior Lighting (ShortBeard 1.0.5).** Attach its `.dfmod` like the texture mods. While Enhanced Lighting
is OFF it takes over the lighting indoors, as its scripts do: every room light warm orange with its intensity and
range 10, flickering; a light on each fireplace; in dungeons the original lights replaced by one on every torch and
brazier billboard; the torch in the mod's colour. With Enhanced Lighting ON nothing changes. Not carried over: the
mod's shadows (the classic lighting has none), and the fireplace spotlight is a point light.

**Water tiles with DREAM's ground.** Town water, docks and puddles showed as brown mud under a blue sheen: the port
finds a puddle's shape by the water tile's colours, which works for Daggerfall's palette art but not for DREAM's
truecolour tiles. The shapes now come from the classic tiles and are laid over DREAM's.

**Test switch: the mod's shadows.** Add `?iil=shadows` to the address with Enhanced Lighting ON and the mod attached:
the mod's lights then run on the Enhanced Lighting lane, which gives them shadows - soft light shadows and NPC /
enemy billboard shadows. Without the switch the rule above holds (the mod only replaces classic lighting).

**Water at night (Gothway Garden).** The water was lit by a torch or a lamp as if it were ground: the water tile's
blue ripples times a warm flame read as a field of brown mud with blue at its edges. Water now takes a quarter of
that light diffusely and shows each light as a moving highlight on the waves instead. Same with or without DREAM.

**Modded lighting switch.** Features > Sight has a new row, *Modded lighting (Improved Interior Lighting)*:
Off / On (default) / With shadows. It only does anything with the mod's `.dfmod` attached, and it takes effect at
once. With shadows gives the mod its own shadows - lamps, people and monsters cast soft shadows indoors and in
dungeons - in Daggerfall's classic look, with Enhanced lighting OFF: the port's shadow maps under the classic shading
(no tonemap, no bloom, no highlights). Outdoors stays classic. With Enhanced lighting on, Enhanced lighting is in
charge as before.

**Attach lighting mod.** Settings > Mods > Replacement packs has its own *Lighting mod* section: an **Attach lighting
mod** button (it accepts only Improved Interior Lighting - the original or BlazeBlue32's fixed 1.1.1 - and says so
if you pick something else), the attached mod with its Remove, and a pointer to Features > Sight > Modded lighting.
It is no longer listed among the texture mods.

(Housekeeping: line-number references in comments and docs that these changes shifted were re-aimed with the
repo's own citeShift tool, and the mutation-test records were updated to the new source.)
