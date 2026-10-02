// @ts-check
// NEMESIS-CARD (2026-10-02): THE FACE A NEMESIS SPEAKS THROUGH. systems/nemesis.js builds each thing a nemesis says or
// does as an EVENT (its portrait, its name, its words, and the one `line` a text surface says instead); a face
// registers here to draw them - ui/nemesisCard.js, the enhanced skin's card - and answers whether it did. With none, or
// one that declines (the classic skin, a page without a document), the host's own `say` speaks the line. A LEAF: it
// imports nothing, so the HUD's card asks it without the nemesis law's imports.

/** @type {null | ((ev: any) => boolean)} */
let _presenter = null;
/** The face that draws a nemesis's events (`fn(ev)` answers whether it drew it); null takes it down. */
export function setNemesisPresenter(fn) { _presenter = typeof fn === 'function' ? fn : null; }
/** Say an event: the face draws it, or `say` speaks its line. Answers whether the face drew it. */
export function nemesisSay(ev, say = null) {
  if (!ev) return false;
  let shown = false;
  try { shown = !!_presenter?.(ev); } catch { shown = false; }
  if (!shown && ev.line) say?.(ev.line);
  return shown;
}
