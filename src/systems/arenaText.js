// ARENA1 (2026-10-02): THE ARENA'S WORDS, in one frozen table so a test can pin them (the gate chart's
// GATE_CHART_TEXT is the precedent). Mac, 2026-10-02: "All aspects ... All UI elements and text must be enhanced UI
// plus" - the lines here are said through the port's one box (ui/actionText.js ActionTextBox), which the enhanced
// skin draws as its notice panel (ui/enhancedNotice.js) and the classic skin as Daggerfall's parchment.
//
// ARENA2 (2026-10-02): THE BOUTS' WORDS - the Herald's choice at the gate, his calls and verdicts on the sand, the
// countdown, the crowd's barks, the HUD's labels and the refusals of a bout in play (bible/11-Multiplayer/Arena.md
// "2. The fights", "4. The crowd"). The house tone (bible/10-UI/UI-Arc.md SITE2, the Plainer Menus pass): plain player
// English, short lines, " - " between clauses and never a long dash, no engine words. The crowd talks as an Iliac Bay
// crowd would - rough, partisan, a little funny. Lines that take a name are functions; everything is frozen.

const F = Object.freeze;

export const ARENA_TEXT = F({
  /** The Herald at the gate, before ARENA2 (kept: the classic skin's parchment still reads a box of lines). */
  heraldNotice: F([
    'The Arena of Daggerfall',
    '',
    'Hear me! The sand is raked and the gates stand open.',
    'Bouts begin soon - the Red Banner and the Blue are',
    'taking names, and the bookmaker is taking bets.',
    '',
    'Come back when the drums sound.',
  ]),
  /** The Daggerfall Bank's letter, when a house that stood where the arena stands is moved (systems/arenaMove.js).
   *  ARENA2: the old house's furniture does not fit the new one - what the owner placed goes back to the owner's
   *  furnishings, and what the chests and the floor held waits in the new house's first chest (or a crate). */
  deedMoved: F([
    'A letter from the Daggerfall Bank:',
    '',
    'By order of the Court, the block where your house stood',
    'is cleared for the Arena of Daggerfall.',
    'Your deed now names a house of the same kind in the city.',
    'The furniture you placed is back among your furnishings,',
    'and everything in your chests and on your floors',
    'waits for you in a chest in the new house.',
  ]),
  /** The notebook's line for the same move (`%s` the new house's name). */
  deedMovedNote: 'The Daggerfall Bank moved my deed to %s - the arena stands where my old house was.',

  /** ARENA-FIX 2: THE GATE'S PEOPLE BY THEIR OFFICE (world/arenaCity.js ARENA_GATE_PEOPLE `role`) - the name on the
   *  hover plaque, in "You see ..." and in the talk window, never a name drawn from the city's bank: a crier, a
   *  banner's recruiter and a bookmaker are known at the gate by what they do. */
  gateNames: F({
    herald: 'The Herald of the Arena',
    redRecruiter: 'Red Banner Recruiter',
    blueRecruiter: 'Blue Banner Recruiter',
    bookmaker: 'The Bookmaker',
    warden: 'Arena Warden',
  }),

  // ── THE HERALD AT THE GATE (ARENA2: a choice; the Arena window is ARENA3's) ──────────────────────────────────
  herald: F({
    /** His greeting, by the hour's state (a bout on the sand, one coming, none). */
    greet: F([
      'Hear me! Steel and sand, blood and glory!',
      'The Arena of Daggerfall welcomes you, friend.',
      'Step closer - the crowd is hungry tonight.',
    ]),
    onNow: (a, b) => `On the sand now: ${a} against ${b}.`,
    nextAt: (hh) => `The next exhibition is at ${hh}.`,
    ladderNext: (tier, label) => `Your next bout: ${tier} - ${label}.`,
    ladderDone: 'You are the Grand Champion. The sand has nothing left to teach you.',
    title: (t) => `They call you ${t} here.`,
    /** The choices, as ChoiceWindow labels ("W - Watch the exhibition"). */
    watch: 'W - Watch the exhibition',
    fight: 'F - Fight on the ladder',
    hall: "H - Go down to the fighters' hall",
    leave: 'L - Leave',
    /** The refusals said in his box, beside the choice that cannot be taken. */
    noWatch: 'No bout on the sand right now - come back on the hour.',
    noFight: 'You are in no state to fight. Rest first, then come back.',
    /** A player struck an exhibition fighter: the first time a warning, after it the watch. */
    intrude: 'Hold! That fighter is in a bout. Strike again and the watch will have you.',
    intrudeCrime: 'Guards! Seize that brawler!',
    waitWord: 'Wait for the word!',
    gateOpen: 'The gate is open - the Herald waits for you outside.',
  }),

  // ── THE BOUT ─────────────────────────────────────────────────────────────────────────────────────────────
  /** The Herald's call (the bout's first phase): the bout's kind, then each fighter as the Herald cries them. */
  call: F({
    exhibition: 'An exhibition bout!',
    ladder: (tier, label) => `${tier} - ${label}!`,
    champion: (tier) => `For the title of ${tier} Champion!`,
    grand: 'For the title of Grand Champion of the Arena of Daggerfall!',
    melee: 'A Grand Melee - every fighter for themselves!',
    fighter: (name, home) => (home ? `From ${home} - ${name}!` : `${name}!`),
    versus: 'Against...',
    marks: 'Fighters, to your marks!',
  }),
  /** The countdown over the screen (ui/midScreenText.js), one word a second. */
  count: F(['3', '2', '1', 'Fight!']),
  /** The verdicts. `w` the winner's name (or names joined), `l` the loser's. */
  verdict: F({
    yield: (w, l) => `${l} yields! The bout goes to ${w}.`,
    fall: (w, l) => `${l} is down! ${w} takes the bout.`,
    ringout: (w, l) => `${l} is carried off the sand! ${w} wins by ring-out.`,
    judges: (w) => `Time! The judges give it to ${w}.`,
    draw: 'Time! The judges cannot part them - a draw.',
    grand: (w) => `${w} is the Grand Champion of the Arena of Daggerfall!`,
    tier: (w, t) => `${w} is the ${t} Champion!`,
  }),
  /** The purse, said after the verdict. */
  purse: F({
    won: (gold) => `The purse - ${gold} gold.`,
    favoured: (gold) => `The crowd loves you - the purse is ${gold} gold.`,
    hated: (gold) => `The crowd jeers you - the purse is cut to ${gold} gold.`,
    lost: 'No purse for the beaten.',
  }),
  /** The ladder's progress, said after a win. */
  ladder: F({
    boutWon: (n) => `${n} of 3 won in this tier.`,
    champOpen: (tier) => `The ${tier} Champion will see you now.`,
    tierUp: (tier) => `You climb to ${tier}.`,
  }),
  /** The healers: the duel's own heal, said. */
  healed: 'The arena\'s healers see to your wounds.',
  /** What a bout in play will not allow (the duel's law). */
  refuse: F({
    rest: 'You cannot rest with a bout on.',
    travel: 'Not now - you have a bout to finish.',
    door: 'The gates are shut until the bout is done.',
    save: 'You cannot save on the sand.',
    map: 'Nothing to map here but sand.',
    yieldEarly: 'Not yet - you can yield once you are badly hurt.',
  }),
  /** The way out of the floor, on the plaque. */
  wayOut: 'The gate to the city',

  // ── THE CROWD ──────────────────────────────────────────────────────────────────────────────────────────
  /** Barks by what just happened (systems/arenaCrowd.js crowdBark picks one, never the same twice running). */
  barks: F({
    hit: F(['Again!', 'Hit him!', 'Yes!', 'That\'s the way!', 'Harder!', 'Give it to them!']),
    hitHated: F(['Boo!', 'Cheat!', 'Get off the sand!', 'Dirty fighter!']),
    crit: F(['Blood! Blood on the sand!', 'Oh, that one hurt!', 'Did you see that?', 'Right in the guts!']),
    knockdown: F(['Get up, you dog!', 'Down he goes!', 'Stay down!', 'He felt that one in Sentinel!']),
    stall: F(['Is that a sword or a spoon?', 'Fight, you cowards!', 'My gran hits harder!', 'Are you dancing or fighting?', 'Wake up!']),
    flee: F(['Coward!', 'Stand and fight!', 'Run home to your mother!', 'Where are you going?']),
    comeback: F(['Not done yet!', 'On your feet!', 'Look at that!', 'Here we go!']),
    yield: F(['Shame!', 'Soft!', 'Give us our money back!']),
    fall: F(['That\'s it!', 'Finished!', 'Carry him out!']),
    ringout: F(['Out! Out!', 'Off the sand!', 'Over the line!']),
    timeout: F(['Booo!', 'Call that a fight?', 'Judges, are you blind?']),
    roar: F(['Arena! Arena!', 'More! More!', 'Blood and sand!']),
    beast: F(['Not fair!', 'Feed him to it!', 'Let the beast go!']),
  }),
  /** A home town's chant, roared for its own fighter ("Wayrest! Wayrest!"). */
  chant: (town) => `${town}! ${town}!`,
  /** The crowd's mood, by its band (ui/arenaHud.js). */
  mood: F({ boo: 'Booing', jeer: 'Jeering', murmur: 'Murmuring', cheer: 'Cheering', roar: 'Roaring' }),

  // ── THE HUD ────────────────────────────────────────────────────────────────────────────────────────────
  hud: F({
    crowd: 'Crowd',
    stamina: 'Stamina',
    yieldHint: 'Badly hurt - sheathe your weapon to yield.',
    timeLeft: (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`,
    darling: 'Darling',
    villain: 'Villain',
    you: 'You',
    out: F({ yield: 'Yielded', fall: 'Down', ringout: 'Out' }),
  }),

  // ── THE LADDER (ARENA2 offline; the Arena window is ARENA3's) ──────────────────────────────────────────
  /** The ten tiers' names (the design table) and the title each tier's champion beaten gives. */
  tiers: F(['The Pit', 'Bloodied', 'Sworn', 'Gladiator', 'Myrmidon', 'Bloodsworn', 'Hero', 'Champion', 'Paragon', 'The Grand Melee']),
  titles: F(['Pit Fighter', 'Bloodied', 'Sworn', 'Gladiator', 'Myrmidon', 'Bloodsworn', 'Hero', 'Champion', 'Paragon', 'Grand Champion']),
  /** A bout's label on the ladder. */
  boutLabel: (n) => `bout ${n} of 3`,
  champLabel: 'the Tier Champion',
  grandLabel: 'the Grand Champion',
  /** The epithets a fighter is given (by the bout's seed): "Gorlak gro-Mazgul of Wayrest, the Unbroken". */
  epithets: F([
    'the Unbroken', 'the Butcher', 'the Lion of the Bay', 'Iron-Hand', 'the Grinning', 'Bonecrusher', 'the Quick',
    'the Red', 'the Patient', 'the Wolf', 'Half-Ear', 'the Hammer', 'Dawnblade', 'the Scarred', 'the Mountain',
    'Ironjaw', 'the Viper', 'the Unlucky', 'Stormfist', 'the Grey', 'the Smiling', 'Kingsbane', 'the Bear', 'the Last',
  ]),
  /** A beast's billing ("The Grizzly Bear of the Wrothgarian Mountains"). */
  beast: (kind, from) => `The ${kind} of ${from}`,

  // ── THE UNDERCROFT - THE FIGHTERS' HALL (ARENA-FIX 4; world/arenaUndercroft.js) ─────────────────────────────
  undercroft: F({
    /** Its name - over the stair down ("To The Arena Undercroft") and wherever the place is named. */
    name: 'The Arena Undercroft',
    /** The hall's people with an office, by it (the fighters at rest keep their own names). */
    names: F({ pitMaster: 'The Pit Master', hallKeeper: 'Keeper of the Hall', armourer: 'Arena Armourer', keeper: 'Arena Keeper' }),
    /** The Pit Master's word and his choice (a ChoiceWindow). */
    pitGreet: F([
      'The training pit. No purse, no crowd, no shame.',
      'Spar with one of my fighters and learn what the next tier will ask of you.',
    ]),
    pitFight: 'S - Spar in the pit',
    pitLeave: 'L - Leave',
    pitHurt: 'You are in no state to spar. See a healer first.',
    pitBusy: 'The pit is in use - finish the bout you are in.',
    /** The practice bout: its call, its sparring partner's billing, its end. */
    practiceCall: 'A practice bout - to the first fall or yield!',
    practiceLabel: 'Practice',
    practiceWon: 'Good. The next tier will not be so kind.',
    practiceLost: 'On your feet. Again, when you are ready.',
    practiceDraw: 'Time. Neither of you learned much from that.',
    /** A chained beast struck: the keepers' warning. */
    chained: 'Leave the beasts be - they are saved for the sand.',
    /** The Hall of Champions, as its keeper reads the names cut in the stone. */
    hallTitle: 'The Hall of Champions',
    hallIntro: 'The names cut in this wall are the arena\'s own.',
    hallGrand: (name) => `Grand Champion of the Arena of Daggerfall - ${name}`,
    hallTierName: (n, tier) => `Tier ${n}, ${tier}`,
    hallTier: (tier, title, name) => `${tier} - ${name}, ${title}`,
    hallNone: 'No name is cut here yet. The stone waits for one.',
    hallYours: (n) => `Your name is cut here ${n === 1 ? 'once' : `${n} times`}.`,
  }),
});

/** Every string in ARENA_TEXT (functions called with sample names) - the tone pins walk it. */
export function allArenaLines(t = ARENA_TEXT) {
  const out = [];
  const walk = (v) => {
    if (typeof v === 'string') out.push(v);
    else if (typeof v === 'function') { const s = v('Aldo', 'Bran', 'Cyr'); if (typeof s === 'string') out.push(s); }
    else if (v && typeof v === 'object') for (const x of Object.values(v)) walk(x);
  };
  walk(t);
  return out;
}
