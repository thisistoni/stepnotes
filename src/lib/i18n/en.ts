/**
 * English: the source of truth. Its shape is the `Strings` type every other language must match
 * exactly (a missing or extra key is a compile error). Entries that take values are functions with
 * typed parameters; whole sentences are built here, never by gluing fragments in components.
 */
import type { StepInfo } from '../pattern';
import type { Foot, Role } from '../types';
import type { ValidationWhere } from '../validate';

import { plural, RULES, type PluralForms } from './plural';

const num = (n: number) => String(Math.round(n * 100) / 100);
const pl = (n: number, forms: PluralForms) => plural(RULES.en, n, forms, num);
const q = (s: string) => `“${s}”`;

const FOOT: Record<Foot, string> = { L: 'Left', R: 'Right' };
const ROLE: Record<Role, string> = { leader: 'Leader', follower: 'Follower' };

function dir(d: StepInfo & { kind: 'step' | 'tap' }, short = false) {
  const { fb, side } = d.dir;
  if (fb && !side) return fb;
  if (side && !fb) return `to the ${side}`;
  return `${short ? 'diagonal' : 'diagonally'} ${fb} ${side}`;
}
/** Turns of the body the way a dance teacher says them; odd angles stay in degrees. [long, short] */
const TURN: Record<number, [string, string]> = {
  45: ['an eighth of a turn', 'eighth turn'],
  90: ['a quarter turn', 'quarter turn'],
  135: ['three eighths of a turn', 'three-eighths turn'],
  180: ['a half turn', 'half turn'],
};
/** ", with a quarter turn to the left" · short: ", quarter turn left" */
const turning = (turn: number, short = false) => {
  if (!turn) return '';
  const a = Math.abs(turn);
  const side = turn > 0 ? 'right' : 'left';
  return short ? `, ${TURN[a]?.[1] ?? `${a}°`} ${side}` : `, with ${TURN[a]?.[0] ?? `a ${a}° turn`} to the ${side}`;
};

/** Lengths in beats: fractions as glyphs ("½ beat", "1½ beats"). */
function beats(b: number) {
  if (b === 0.5) return '½ beat';
  if (b === 0.25) return '¼ beat';
  if (b === 1.5) return '1½ beats';
  return pl(b, { one: '# beat', other: '# beats' });
}

export const en = {
  /** BCP 47 code of this dictionary (the web page's `lang`) */
  code: 'en',
  /**
   * Speech language per platform. Android's engine takes the bare language (expo-speech passes it
   * to Locale.Builder.setLanguage, which rejects a region); iOS and web want a full tag.
   */
  speech: { android: 'en', ios: 'en-US', web: 'en-US' },

  common: {
    back: 'Back',
    close: 'Close',
    cancel: 'Cancel',
    confirm: 'Confirm',
    undo: 'Undo',
    open: 'Open',
    search: 'Search',
    clearText: 'Clear text',
    dragToClose: 'Drag down to close',
    untitled: 'Untitled dance',
    /** Name of a copy ("Make my own version", Duplicate) */
    myVersion: (name: string) => `${name} (my version)`,
    quote: q,
    increase: (what: string) => `Increase ${what}`,
    decrease: (what: string) => `Decrease ${what}`,
    progress: (n: number, total: number) => `Step ${n} of ${total}`,
  },

  units: {
    number: num,
    bpm: (n: number) => `${n} bpm`,
    bpmUnit: 'bpm',
    /** "3/4" */
    meter: (beatsPerBar: number) => `${beatsPerBar}/4`,
    percent: (n: number) => `${n}%`,
    beats,
  },

  roles: {
    leader: ROLE.leader,
    follower: ROLE.follower,
    both: 'Both',
    /** Name of the role switch */
    part: 'Part',
    leaderAndFollower: 'leader + follower',
  },

  feet: {
    left: 'Left',
    right: 'Right',
    leftFoot: 'Left foot',
    rightFoot: 'Right foot',
    hold: 'Hold',
  },

  language: {
    /** The globe button in the library */
    button: 'Language',
  },

  intro: {
    previous: 'Previous step',
    skip: 'Skip',
    skipHint: 'Skips the intro and opens your dances',
    promise: 'Learn any dance step, one footprint at a time.',
    getStarted: 'Get started',
    continue: 'Continue',
    startDancing: 'Start dancing',
    gotIt: 'Got it',
    languageSwitch: 'Language',
    roleTitle: 'Which part do you dance?',
    choices: {
      leader: { title: ROLE.leader, subtitle: 'I lead the steps' },
      follower: { title: ROLE.follower, subtitle: 'I follow my partner' },
      both: { title: 'Both / not sure', subtitle: 'Start as leader' },
    },
    /** Coach bubble under the choices; **…** is emphasised */
    coach: {
      none: 'You can **switch parts** in any dance later.',
      leader: 'Leaders usually start on the **left foot**. We’ll show their steps first.',
      follower: 'Followers usually start on the **right foot**. We’ll show their steps first.',
      both: 'We’ll start with the leader. **Switch parts** in any dance.',
    },
  },

  lesson: {
    title: 'How to read the footprints',
    play: 'Play the demo',
    pause: 'Pause the demo',
    facing: 'Facing',
    facingA11y: 'Facing up the screen',
    legend: {
      solid: { title: 'Solid foot', body: 'Your weight is on it' },
      light: { title: 'Light foot', body: 'Free — about to move' },
      dashed: { title: 'Dashed outline', body: 'Where you’ll step' },
    },
  },

  library: {
    title: 'Your dances',
    import: 'Import a dance',
    create: 'Create',
    searchPlaceholder: 'Search dances or styles',
    myDances: 'My dances',
    starters: 'Starter dances',
    loading: 'Loading your dances',
    all: 'All',
    filterBy: 'Filter by style',
    styleChip: (style: string) => `${style} dances`,
    openHint: 'Opens the dance',
    /** Card meta line: "8 steps · 180 bpm" */
    cardMeta: (steps: number, bpm: number) => `${pl(steps, { one: '# step', other: '# steps' })} · ${bpm} bpm`,
    lessonTitle: 'How to read the footprints',
    lessonBody: 'A one-minute interactive lesson',
    emptyTitle: 'Write down your first dance',
    emptyBody: 'Place the footprints step by step, then play them back at your own pace.',
    emptyAction: 'Create a dance',
    noMatchQuery: (query: string) => `No dances match ${q(query)}`,
    noMatchStyle: (style: string) => `No ${style} dances yet`,
    noMatchQueryInStyle: (style: string) => `Nothing in ${style} matches. Try another word or show all styles.`,
    noMatchQueryBody: 'Try another name or style.',
    noMatchStyleBody: 'Pick another style, or create one in this style.',
    clearSearch: 'Clear search',
    showAll: 'Show all dances',
  },

  player: {
    edit: 'Edit dance',
    makeOwn: 'Make my own version',
    makeOwnHint: 'Opens the editor on a copy',
    makeOwnShort: 'Make my own',
    editSteps: 'Edit steps',
    more: 'More actions',
    duplicate: 'Duplicate',
    duplicateHint: 'Save a copy to My dances',
    share: 'Share',
    shareHint: 'Send it as text',
    delete: 'Delete',
    copied: 'Copy saved to My dances',
    copyFailed: 'Could not copy this dance. Please try again.',
    deleteTitle: (name: string) => `Delete ${q(name)}?`,
    deleteMessage: 'It will be removed from My dances. You can undo this right after.',
    deleted: (name: string) => `Deleted ${q(name)}`,
    restoreFailed: 'Could not bring it back. Please try again.',
    deleteFailed: 'Could not delete this dance. Please try again.',
    nothingToPlay: 'Nothing to play yet',
    startPosition: 'Start position',
    startPositionHint: 'Start position. Press play or step through.',
    /** Mode toggle on the stage */
    animate: 'Animate',
    animateA11y: 'Animate the steps',
    chart: 'Chart',
    chartA11y: 'Show the step chart',
    view: 'Diagram view',
    facing: 'Facing',
    mirrored: 'Mirrored',
    facingA11y: 'Forward is up the screen',
    mirroredA11y: 'Mirrored view: left and right are swapped. Forward is up.',
  },

  count: {
    ready: 'Ready',
    readyA11y: 'Ready, start position',
    tile: (count: string, kind: 'step' | 'tap' | 'hold') => `Count ${count}${kind === 'hold' ? ', hold' : kind === 'tap' ? ', tap' : ''}`,
    tap: 'Tap',
    hold: 'Hold',
    noSteps: 'No steps yet',
    stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
    readyOf: (total: number) => `Ready · ${pl(total, { one: '# step', other: '# steps' })}`,
    pills: 'Counts',
    pill: (count: string, n: number) => `Count ${count}, step ${n}`,
  },

  transport: {
    previous: 'Previous step',
    next: 'Next step',
    play: 'Play',
    pause: 'Pause',
    noSteps: 'This dance has no steps yet. Add some in the editor to play it.',
  },

  tempo: {
    label: 'Tempo',
    value: (pct: number, bpm: number) => `${pct} percent, ${bpm} beats per minute`,
    current: (pct: number, bpm: number) => `Tempo ${pct} percent, ${bpm} beats per minute`,
    resetHint: 'Resets the tempo to 100 percent',
  },

  toggles: {
    loop: 'Loop',
    speak: 'Say counts',
    mirror: 'Mirror',
    letters: 'L / R letters',
    lettersA11y: 'Show L and R letters on the feet',
    vibrate: 'Vibrate',
  },

  chart: {
    bar: (n: number) => `Bar ${n}`,
    all: 'All',
    allA11y: 'All steps',
    of: 'Chart of',
    start: 'Start',
    count: 'Count',
    tap: 'Tap',
    tapLong: 'Tap (no weight)',
    legendA11y: 'Solid feet: where you start. Numbers: the counts. Dashed arrow: a tap without weight.',
  },

  steps: {
    title: 'All steps',
    of: 'Steps of',
    empty: 'No steps yet. Open the editor to place the first one.',
    row: (count: string, text: string, note?: string) => `Count ${count}. ${text}${note ? `. ${note}` : ''}`,
    rowHint: 'Shows this step on the stage',
    tap: 'Tap',
    hold: 'Hold',
  },

  about: {
    title: 'About',
    video: 'Watch reference video',
    videoFailed: 'Could not open that video link.',
  },

  share: {
    /** First line of a shared dance (the import ignores text around the dance) */
    prefix: 'A Waltzy dance. Copy all of this text and paste it into Waltzy under Import:',
    failed: 'Could not open sharing. Please try again.',
    copied: 'Dance copied. Paste it into a message to share it.',
    unsupported: 'This browser cannot share or copy. Open Waltzy on your phone to share.',
  },

  notFound: {
    title: 'This dance isn’t here anymore',
    body: 'It may have been deleted. Your other dances are in the library.',
    action: 'Back to library',
  },

  errorScreen: {
    title: 'Something went wrong',
    body: 'This screen could not be shown. Your dances are safe.',
    retry: 'Try again',
    home: 'Go to library',
  },

  persist: {
    unreadable: 'Your dances could not be read from this device, so nothing was saved. Please try again.',
    writeFailed: 'Could not save on this device. Please try again.',
  },

  editor: {
    newTitle: 'New dance',
    editTitle: 'Edit dance',
    close: 'Close editor',
    undo: 'Undo',
    save: 'Save',
    badVideo: 'This doesn’t look like a web link. Paste the full address, starting with https://',
    checkVideo: 'Check the video link first',
    saved: 'Dance saved',
    changesSaved: 'Changes saved',
    saveFailed: 'Could not save. Please try again.',
    stepDeleted: (n: number) => `Step ${n} deleted`,
    discardTitle: 'Discard your changes?',
    discardNew: 'This dance has not been saved yet.',
    discardEdits: 'Your edits since the last save will be lost.',
    discard: 'Discard',
    keepEditing: 'Keep editing',
    rotateLeft: 'Rotate foot 15 degrees left',
    rotateRight: 'Rotate foot 15 degrees right',
    /** Crosshair button on the canvas after panning */
    recenter: 'Show all steps',
  },

  details: {
    title: 'Details',
    summaryA11y: (name: string, summary: string) => `Details: ${name}, ${summary}`,
    openHint: 'Opens the dance details',
    collapse: 'Collapse details',
    name: 'Name',
    style: 'Style',
    stylePlaceholder: 'Salsa, Tango, Line dance…',
    commonStyles: 'Common styles',
    tempo: 'Tempo',
    beatsPerBar: 'Beats per bar',
    footprints: 'Footprints',
    flat: 'Flat',
    heel: 'Heel',
    flatA11y: (role: string) => `${role}: flat shoe footprints`,
    heelA11y: (role: string) => `${role}: heel footprints`,
    footprintsOf: (role: string) => `${role} footprints`,
    description: 'Description',
    descriptionPlaceholder: 'Technique tips, styling, what to feel…',
    video: 'Video link',
    videoHint: 'Optional: a reference video to learn from',
  },

  follower: {
    addTitle: 'Add the follower part',
    addBody: 'Partners face each other, so the follower usually mirrors the leader: left becomes right, forward becomes back.',
    mirror: 'Mirror from leader',
    recommended: 'Recommended. You can adjust any step afterwards.',
    empty: 'Start empty',
    toolsTitle: 'Follower part',
    toolsBody: 'Changed the leader’s steps? Mirror them again, or remove this part.',
    mirrorAgain: 'Mirror again',
    remove: 'Remove',
    regenerateTitle: 'Mirror the leader again?',
    regenerateMessage: 'The follower’s steps are replaced by a mirror of the leader’s. You can undo this.',
    removeTitle: 'Remove the follower part?',
    removeMessage: 'All follower steps are removed from this dance. You can undo this.',
  },

  inspector: {
    startOverline: 'Start position',
    startTitle: 'Where both feet are before count 1',
    placing: 'Placing',
    footToPlace: 'Foot to place',
    addFirst: 'Add step 1',
    stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
    count: 'Count',
    length: 'Length in beats',
    lengthA11y: (b: number) => beats(b),
    foot: 'Foot',
    action: 'Action',
    kinds: { step: 'Step', tap: 'Tap', hold: 'Hold' },
    kindHelp: {
      step: 'The foot moves and takes your weight.',
      tap: 'The foot touches the floor without taking weight.',
      hold: 'Nobody moves: a pause on this count.',
    },
    note: 'Note',
    notePlaceholder: 'Optional, e.g. ball of the foot',
    earlier: 'Move earlier',
    later: 'Move later',
    earlierShort: 'Earlier',
    laterShort: 'Later',
    earlierA11y: 'Move step earlier',
    laterA11y: 'Move step later',
    delete: 'Delete step',
    quickCount: (count: string) => `Count ${count === '&' ? 'and' : count}`,
  },

  strip: {
    start: 'Start',
    startA11y: 'Start position',
    addFirst: 'Add the first step',
    addAfter: (n: number) => `Add a step after step ${n}`,
    chip: (n: number, count: string, kind: 'step' | 'tap' | 'hold', foot: Foot) =>
      `Step ${n}, count ${count}, ${kind === 'hold' ? 'hold' : `${FOOT[foot].toLowerCase()} foot${kind === 'tap' ? ' tap' : ''}`}`,
  },

  coach: {
    startDragging: (foot: Foot) => `Let go where the ${FOOT[foot].toLowerCase()} foot starts.`,
    startEmpty: 'Drag the feet into place, then add step 1.',
    startChange: 'Drag either foot to change the start.',
    holdBlocked: 'Holds can’t move. Switch to Step to move a foot.',
    hold: 'A hold: nobody moves on this count.',
    dragging: (foot: Foot) => `Let go where the ${FOOT[foot].toLowerCase()} foot lands.`,
    tap: (foot: Foot) => `Drag the ${FOOT[foot].toLowerCase()} foot to where it touches.`,
    step: (foot: Foot) => `Drag the ${FOOT[foot].toLowerCase()} foot to where it lands.`,
    /** Hold-to-rotate is active */
    rotating: 'The toes point to your finger. Let go to keep the angle.',
    /** The finger pans the canvas */
    panning: 'The crosshair brings all steps back.',
    /** Gesture tips on the canvas (each until the user has used it) */
    holdTip: 'Hold a foot to turn it',
    panTip: 'Drag the floor to move the view',
    /** Tip after a foot was dragged against the edge of the canvas */
    edgeTip: 'More room? Drag the floor',
  },

  import: {
    title: 'Import a dance',
    submit: 'Add to my dances',
    intro: 'Paste a dance someone shared with you. Extra text around it, like a chat message, is fine.',
    field: 'Shared dance',
    paste: 'Paste',
    preview: (name: string, style: string, steps: number, follower: boolean) =>
      `Ready to add ${q(name)} · ${[style, pl(steps, { one: '# step', other: '# steps' }), follower ? 'leader + follower' : ''].filter(Boolean).join(' · ')}`,
    notADance: 'That doesn’t look like a Waltzy dance. Ask the sender to share it again.',
    added: (name: string) => `${q(name)} added to your dances`,
    saveFailed: 'Could not save this dance. Please try again.',
    clipboardEmpty: 'The clipboard is empty',
    clipboardFailed: 'Could not read the clipboard. Paste into the field instead.',
  },

  /** Problems in pasted or stored dances (technical field names stay as they are in the data) */
  validation: {
    where: (w: ValidationWhere) =>
      [w.role ? `${w.role} part` : '', w.start ? 'start position' : '', w.step ? `step ${w.step}` : ''].filter(Boolean).join(', '),
    withWhere: (where: string, message: string) => (where ? `${where.charAt(0).toUpperCase()}${where.slice(1)}: ${message}` : message),
    notText: (field: string) => `${q(field)} should be text.`,
    missing: (field: string) => `${q(field)} is missing.`,
    notNumber: (field: string) => `${q(field)} should be a number.`,
    positionMissing: (field: string) => `${q(field)} (the foot position) is missing.`,
    badFoot: '“foot” should be "L" or "R".',
    partMissing: 'is missing or not a list of steps.',
    noSteps: 'has no steps.',
    stepsNotList: '“steps” should be a list.',
    tooManySteps: (count: number, max: number) => `has ${count} steps; the maximum is ${max}.`,
    notAStep: 'is not a step.',
    badKind: '“kind” should be "step", "tap" or "hold".',
    badBeats: '“beats” (the step length) must be greater than 0.',
    notADance: 'This does not look like a Waltzy dance.',
    noRoles: 'This does not look like a Waltzy dance (it has no steps).',
    empty: 'Paste a dance first.',
    noJson: 'This is not a Waltzy dance. A shared dance is a block of text that starts with { and ends with }.',
    badJson: 'This text could not be read. It may have been cut off or changed: copy the whole shared text again, from { to }.',
  },

  /** Plain-language step descriptions, built from the step's structure (see `analyzeStep`) */
  step: {
    describe: (s: StepInfo): string => {
      if (s.kind === 'hold') return 'Hold – pause, no weight change';
      const foot = `${FOOT[s.foot]} foot`;
      const turn = turning(s.turn);
      if (s.motion === 'inPlace') return `${foot} ${s.kind === 'tap' ? 'taps in place' : 'steps in place (weight change)'}${turn}`;
      if (s.kind === 'tap') return `${foot} taps ${s.motion === 'close' ? 'next to the other foot' : dir(s)} (no weight)${turn}`;
      if (s.motion === 'close') return `${foot} closes next to the ${FOOT[s.foot === 'L' ? 'R' : 'L'].toLowerCase()} foot${turn}`;
      return `${foot} steps ${dir(s)}${turn}`;
    },
    /** Next to an L / R badge (the Both view): the foot is not repeated */
    short: (s: StepInfo): string => {
      if (s.kind === 'hold') return 'Hold, no weight change';
      const turn = turning(s.turn, true);
      if (s.motion === 'inPlace') return `${s.kind === 'tap' ? 'Taps' : 'Steps'} in place${turn}`;
      if (s.kind === 'tap') return `${s.motion === 'close' ? 'Taps' : `Taps ${dir(s, true)}`}${turn}`;
      if (s.motion === 'close') return `Closes${turn}`;
      return `Steps ${dir(s, true)}${turn}`;
    },
  },

  /** What the voice says for a count label; numbers are left to the voice */
  spoken: (count: string) => {
    const c = count.trim().toLowerCase();
    if (c === '&' || c === 'and' || c === 'und') return 'and';
    if (c === 'a') return 'ah';
    if (c === 'e') return 'ee';
    return count.trim() || 'step';
  },

  /** Style names the editor suggests (their colours come from `styleColor`) */
  styles: ['Salsa', 'Bachata', 'Ballroom', 'Latin'],

  /** Starter dances: texts by built-in id. Notes by step index, per role. */
  starters: {
    'builtin-waltz-box': {
      name: 'Slow Waltz – Box & Left Box Turn',
      style: 'Ballroom',
      description:
        'Two bars of the box (the basic step), then the box turned a quarter to the left in every bar: after four bars you face where you started. The leader starts with the left foot forward, the follower with the right foot back. Rise on 2 and 3, lower at the end of 3.',
      notes: {
        leader: {
          0: 'Box: forward, heel first',
          1: 'Side, rising',
          2: 'Close, lower at the end',
          3: 'Back, toe first',
          4: 'Side, rising',
          5: 'Close, lower at the end',
          6: 'Left box turn: toe turned out, a quarter turn to the left over 1–3',
          7: 'Side: the quarter turn is complete',
          9: 'Back, toe turned in: the next quarter turn to the left',
          11: 'Half a turn done',
          12: 'Toe turned out: third quarter turn',
          15: 'Toe turned in: fourth quarter turn',
          17: 'One full turn: on with the box',
        },
        follower: {
          0: 'Box: back, toe first',
          1: 'Side, rising',
          2: 'Close, lower at the end',
          3: 'Forward, heel first',
          4: 'Side, rising',
          5: 'Close, lower at the end',
          6: 'Left box turn: back, toe turned in, a quarter turn to the left over 1–3',
          7: 'Side: the quarter turn is complete',
          9: 'Forward, toe turned out: the next quarter turn to the left',
          11: 'Half a turn done',
          12: 'Toe turned in: third quarter turn',
          15: 'Toe turned out: fourth quarter turn',
          17: 'One full turn: on with the box',
        },
      },
    },
    'builtin-chacha-basic': {
      name: 'Cha-Cha – Basic & New Yorker',
      style: 'Latin',
      description:
        'The basic: a rock step on 2–3, then the chassé “4 & 1” (cha-cha-cha) to the side. Then the New Yorker to each side: you both turn a quarter apart, stand side by side for the rock step and turn back to face each other for the chassé.',
      notes: {
        leader: {
          0: 'Basic: rock step forward',
          1: 'Weight back onto the right',
          2: 'Chassé to the left: cha-cha-cha',
          5: 'Rock step back',
          6: 'Weight forward onto the left',
          7: 'Chassé to the right: cha-cha-cha',
          10: 'New Yorker: a quarter turn to the right on the right foot, left foot forward, side by side',
          11: 'Weight back onto the right, turn back to face each other',
          12: 'Chassé to the left',
          15: 'New Yorker to the other side: a quarter turn to the left on the left foot, right foot forward',
          16: 'Weight back onto the left, turn back to face each other',
          17: 'Chassé to the right',
        },
        follower: {
          0: 'Basic: rock step back',
          1: 'Weight forward onto the left',
          2: 'Chassé to the right: cha-cha-cha',
          5: 'Rock step forward',
          6: 'Weight back onto the right',
          7: 'Chassé to the left: cha-cha-cha',
          10: 'New Yorker: a quarter turn to the left on the left foot, right foot forward, side by side',
          11: 'Weight back onto the left, turn back to face each other',
          12: 'Chassé to the right',
          15: 'New Yorker to the other side: a quarter turn to the right on the right foot, left foot forward',
          16: 'Weight back onto the right, turn back to face each other',
          17: 'Chassé to the left',
        },
      },
    },
    'builtin-salsa-basic': {
      name: 'Salsa On1 – Basics & Right Turn',
      style: 'Salsa',
      description:
        'Three figures in a row: the forward and back basic, the side basic, then the basic with a right turn for the follower on 5-6-7. Steps on 1-2-3 and 5-6-7, a pause on 4 and 8.',
      notes: {
        leader: {
          0: 'Basic: break forward, full weight onto the left foot',
          3: 'Pause: the weight stays on the left',
          4: 'Break back',
          7: 'Pause: the weight stays on the right',
          8: 'Side basic: left foot to the side',
          9: 'Weight back onto the right',
          12: 'Right foot to the side',
          16: 'Basic, this time with a right turn for the follower',
          20: 'On 5-6-7 the follower turns to the right under your raised left hand; you dance the basic',
        },
        follower: {
          0: 'Basic: break back, full weight onto the right foot',
          3: 'Pause: the weight stays on the right',
          4: 'Break forward',
          7: 'Pause: the weight stays on the left',
          8: 'Side basic: right foot to the side',
          9: 'Weight back onto the left',
          12: 'Left foot to the side',
          16: 'Basic',
          20: 'Right turn: up to here like the basic',
          21: 'Half a turn to the right as the right foot takes the weight',
          22: 'The second half as the left foot closes: you face forward again',
        },
      },
    },
    'builtin-bachata-basic': {
      name: 'Bachata – Side Basic & Inside Turn',
      style: 'Bachata',
      description:
        'The side basic: three steps to the side, a tap without weight on 4 and 8, then the other way. The second time round the follower turns once to the left on 5-6-7 while travelling with the basic.',
      notes: {
        leader: {
          0: 'Side basic: left foot to the side',
          3: 'Tap without weight, often with a small hip action',
          4: 'Change direction: now to the right',
          7: 'Tap without weight',
          8: 'Basic: on 1-4 you prepare the turn',
          12: 'On 5-6-7 you turn the follower to the left; you dance the basic',
        },
        follower: {
          0: 'Side basic: right foot to the side',
          3: 'Tap without weight, often with a small hip action',
          4: 'Change direction: now to the left',
          7: 'Tap without weight',
          8: 'Basic',
          12: 'Inside turn: a quarter turn to the left on the right foot, left foot steps on',
          13: 'Another half turn to the left, the right foot follows',
          14: 'The last quarter turn: you face forward again',
          15: 'Tap without weight',
        },
      },
    },
  } satisfies Record<StarterId, StarterText> as Record<StarterId, StarterText>,
};

export type StarterId = 'builtin-salsa-basic' | 'builtin-bachata-basic' | 'builtin-waltz-box' | 'builtin-chacha-basic';

export interface StarterText {
  name: string;
  style: string;
  description: string;
  /** Step notes by step index (0-based), per role */
  notes: Record<Role, Partial<Record<number, string>>>;
}

export type Strings = typeof en;
