// ARENA1 (2026-10-02): THE ARENA'S WORDS, in one frozen table so a test can pin them (the gate chart's
// GATE_CHART_TEXT is the precedent). Mac, 2026-10-02: "All aspects ... All UI elements and text must be enhanced UI
// plus" - the lines here are said through the port's one box (ui/actionText.js ActionTextBox), which the enhanced
// skin draws as its notice panel (ui/enhancedNotice.js) and the classic skin as Daggerfall's parchment. ARENA2 and
// ARENA3 add the bouts, the crowd's barks and the Arena window to this same table
// (bible/11-Multiplayer/Arena.md "4. The crowd").

export const ARENA_TEXT = Object.freeze({
  /** The Herald at the gate, until the bouts are fought (ARENA2): one box, a line a row. */
  heraldNotice: Object.freeze([
    'The Arena of Daggerfall',
    '',
    'Hear me! The sand is raked and the gates stand open.',
    'Bouts begin soon - the Red Banner and the Blue are',
    'taking names, and the bookmaker is taking bets.',
    '',
    'Come back when the drums sound.',
  ]),
  /** The Daggerfall Bank's letter, when a house that stood where the arena stands is moved (systems/arenaMove.js). */
  deedMoved: Object.freeze([
    'A letter from the Daggerfall Bank:',
    '',
    'By order of the Court, the block where your house stood',
    'is cleared for the Arena of Daggerfall.',
    'Your deed now names a house of the same kind in the city,',
    'and your belongings have been carried there for you.',
  ]),
  /** The notebook's line for the same move (`%s` the new house's name). */
  deedMovedNote: 'The Daggerfall Bank moved my deed to %s - the arena stands where my old house was.',
});
