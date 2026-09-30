// %ltn - MacroHelper.LegalReputation's fourteen bands, the exact C# chain (the > ladder, then the < ladder; "unknown" is
// unreachable and kept as the C# tail). A LEAF, and the ladder's one home: the status box's macro
// (quest/questMacros.js) and REP5's notices of a changed standing (scenes/standingHost.js) read it.
export function legalStandingWord(rep) {
  if (rep > 80) return 'revered';
  if (rep > 60) return 'esteemed';
  if (rep > 40) return 'honored';
  if (rep > 20) return 'admired';
  if (rep > 10) return 'respected';
  if (rep > 0) return 'dependable';
  if (rep === 0) return 'a common citizen';
  if (rep < -80) return 'hated';
  if (rep < -60) return 'pond scum';
  if (rep < -40) return 'a villain';
  if (rep < -20) return 'a criminal';
  if (rep < -10) return 'a scoundrel';
  if (rep < 0) return 'undependable';
  return 'unknown';
}
