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
/** A long name, shortened for toasts and menus (whole characters): "Thursday evening advanc…" */
const short = (s: string, n = 24) => {
  const chars = Array.from(s);
  return chars.length > n ? `${chars.slice(0, n - 1).join('').trimEnd()}…` : s;
};

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
    /** The language row on the Me tab */
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
    create: 'Create',
    searchPlaceholder: 'Search dances or styles',
    myDances: 'My dances',
    starters: 'Starter dances',
    loading: 'Loading your dances',
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

  collections: {
    /** the chip row (a11y) */
    row: 'Collections',
    allDances: 'All dances',
    /** chip a11y: "Tuesday class, 3 dances" */
    chip: (name: string, n: number) => `${name}, ${pl(n, { one: '# dance', other: '# dances' })}`,
    count: (n: number) => pl(n, { one: '# dance', other: '# dances' }),
    steps: (n: number) => pl(n, { one: '# step', other: '# steps' }),
    /** the "+ New" chip */
    new: 'New',
    newCollection: 'New collection',
    nameLabel: 'Name',
    namePlaceholder: 'e.g. Tuesday class',
    create: 'Create',
    renameTitle: 'Rename collection',
    save: 'Save',
    more: (name: string) => `More for ${q(name)}`,
    rename: 'Rename',
    addDances: 'Add dances',
    addDancesHint: 'Tick the ones that belong here',
    delete: 'Delete collection',
    deleteHint: 'Your dances stay where they are',
    deleted: (name: string) => `Deleted ${q(short(name))}`,
    restoreFailed: 'Could not bring it back. Please try again.',
    saveFailed: 'Could not save that. Please try again.',
    emptyTitle: 'Nothing in here yet',
    emptyBody: 'Pick the dances that belong together: your own and the starters.',
    /** Add dances sheet */
    addTitle: (name: string) => `Dances in ${q(short(name))}`,
    searchPlaceholder: 'Search dances',
    done: 'Done',
    noDances: 'No dances to add yet. Create one first.',
    noMatch: (query: string) => `No dances match ${q(query)}`,
    /** dance card menu (long press, or "…" inside a collection) */
    cardMore: (dance: string) => `More for ${q(dance)}`,
    removeFrom: (name: string) => `Remove from ${q(short(name))}`,
    removeFromHint: 'The dance itself stays',
    removed: (name: string) => `Removed from ${q(short(name))}`,
    addTo: 'Add to a collection',
    addToHint: 'For class, for practice, for the wedding',
    /** AddToCollectionSheet */
    pickTitle: 'Add to a collection',
    pickIntro: 'Collections keep dances together, like a playlist: “Tuesday class”, “Wedding dance”, “Practice”.',
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
    shareLinkHint: 'Send a link or a QR code',
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
    failed: 'Could not open sharing. Please try again.',
    /** The one line sent with a link (system share sheet) */
    linkMessage: (name: string, url: string) => `Here’s ${q(name)} on Waltzy. Open the link to watch it and save a copy: ${url}`,
    classMessage: (name: string, url: string) => `Join my dance class ${q(name)} on Waltzy: ${url}`,
    copyLink: 'Copy link',
    linkCopied: 'Link copied',
    copyFailed: 'Could not copy the link. Use “Share link” instead.',
    shareLink: 'Share link',
  },

  /** "4 minutes ago", for links, classes and posts */
  time: {
    ago: (ms: number, now: number = Date.now()) => {
      const min = Math.floor(Math.max(0, now - ms) / 60000);
      if (min < 1) return 'just now';
      if (min < 60) return pl(min, { one: '# minute ago', other: '# minutes ago' });
      const h = Math.floor(min / 60);
      if (h < 24) return pl(h, { one: '# hour ago', other: '# hours ago' });
      const d = Math.floor(h / 24);
      if (d === 1) return 'yesterday';
      if (d < 7) return `${d} days ago`;
      return `on ${new Date(ms).toLocaleDateString('en', { day: 'numeric', month: 'short', ...(d > 300 ? { year: 'numeric' } : {}) })}`;
    },
  },

  /** The share sheet of one of my dances */
  shareLink: {
    title: 'Share this dance',
    intro: 'Anyone with the link can watch this dance and save a copy. They don’t need an account.',
    create: 'Create link',
    creating: 'Creating your link…',
    loading: 'Looking for your link…',
    linkLabel: 'Your link',
    qrA11y: (url: string) => `QR code for the link ${url}`,
    qrHint: 'Let someone scan this with their phone camera',
    updatedAt: (when: string) => `Link updated ${when}`,
    outdated: 'You changed this dance after sharing it. Update the link so others see the new version.',
    update: 'Update link',
    updated: 'Link updated. Everyone with it now sees this version.',
    stop: 'Stop sharing',
    stopTitle: (name: string) => `Stop sharing ${q(name)}?`,
    stopMessage: 'The link stops working. People who already saved a copy keep it.',
    stopped: 'Sharing stopped. The link no longer works.',
    signInTitle: 'Sign in to share a link',
    signInBody: 'A link belongs to your account, so you can update it or stop it later. Sign in with Apple or Google, no new password.',
    signIn: 'Sign in',
    checkFailed: 'Could not check whether this dance has a link yet.',
    // My shared links (Profile)
    myLinks: 'My shared links',
    myLinksBody: 'Anyone with one of these links can watch the dance and save a copy.',
    myLinksEmptyTitle: 'No shared links yet',
    myLinksEmptyBody: 'Open one of your dances, tap ⋯ and Share to create a link.',
    listUpdated: (when: string) => `Updated ${when}`,
    openDance: 'Open dance',
    linkActions: (name: string) => `Actions for the link of ${q(name)}`,
  },

  /** A dance someone sent: /s/<id> and a class post */
  received: {
    by: (name: string) => `by ${name}`,
    someone: 'a Waltzy dancer',
    save: 'Save to my library',
    saved: 'Saved to My dances',
    saveFailed: 'Could not save this dance. Please try again.',
    openSaved: 'Open in my library',
    savedHint: 'You saved a copy before. It’s yours to change.',
    yours: 'You shared this dance',
    manage: 'Manage link',
    loading: 'Loading the dance',
    notFoundTitle: 'This link doesn’t work anymore',
    notFoundBody: 'The dance was removed, or the link is incomplete. Ask the person who sent it for a new one.',
    failedTitle: 'Can’t load this dance',
    unreadableTitle: 'This dance can’t be shown',
    unreadableBody: 'It may come from a newer version of Waltzy. Update the app and try again.',
    toLibrary: 'Go to my dances',
    openInApp: 'Open in the Waltzy app',
    firstVisitTitle: 'New to footprint charts?',
    firstVisitBody: 'Learn to read them in one minute',
    report: 'Report this dance',
    block: (name: string) => `Block ${name}`,
    more: 'More actions',
    credit: (name: string) => `Saved from ${name}’s link`,
    creditClass: (name: string) => `Saved from ${name}’s class`,
    noteTitle: 'Note from your teacher',
    noteTitleMine: 'Your note',
  },

  /** Classes tab, class page, invite page */
  classes: {
    title: 'Classes',
    mine: 'My classes',
    create: 'Create a class',
    join: 'Join a class',
    joinHint: 'QR code, code or link',
    createHint: 'For teachers',
    youTeach: 'You teach',
    with: (name: string) => `with ${name}`,
    dances: (n: number) => pl(n, { one: '# dance', other: '# dances' }),
    activity: (when: string) => `updated ${when}`,
    cardA11y: (name: string, teacher: string, dances: string, when: string) => `${name}, ${teacher}, ${dances}, ${when}`,
    emptyTitle: 'Learn together with your dance class',
    emptyTeacherTitle: 'For teachers',
    emptyTeacherBody: 'Post the figures of each lesson. Your students practise them at their own pace, at home or before class.',
    emptyStudentTitle: 'For students',
    emptyStudentBody: 'Scan your teacher’s QR code or open their link, then join with your account.',
    offlineTitle: 'No connection',
    offlineBody: 'You’re seeing the list saved on this device.',
    refreshing: 'Updating your classes',
    loadFailed: 'Your classes could not be loaded.',
    // join
    joinTitle: 'Join a class',
    joinBody: 'Scan your teacher’s QR code, type the 8-character code, or paste the class link.',
    joinScan: 'Scan QR code',
    joinLabel: 'Class code or link',
    joinPlaceholder: 'e.g. ab12cd34',
    joinBad: 'That isn’t a class code. A code has 8 letters and numbers.',
    joinFind: 'Find class',
    // create / edit
    createTitle: 'Create a class',
    editTitle: 'Edit class',
    nameLabel: 'Name',
    namePlaceholder: 'e.g. Salsa beginners, Tuesdays',
    nameEmpty: 'Give your class a name.',
    descLabel: 'Description (optional)',
    descPlaceholder: 'When and where you meet, what you practise',
    approvalLabel: 'Approve new members',
    approvalHint: 'People ask to join. They see the dances once you accept them.',
    createSubmit: 'Create class',
    save: 'Save',
    created: 'Class created. Add the first dance!',
    edited: 'Class saved',
    // class page
    loading: 'Loading the class',
    teacherA11y: (name: string) => `Teacher: ${name}`,
    youTeachThis: 'You teach this class',
    joinClass: 'Join class',
    joined: 'You joined. Find the class under Classes any time.',
    askToJoin: 'Ask to join',
    requested: 'Request sent. You get in as soon as your teacher accepts.',
    lockedTitle: 'This class is private',
    lockedBody: (teacher: string) => `${teacher} accepts new members first. Ask to join to see the dances.`,
    pendingTitle: 'Waiting for approval',
    pendingBody: (teacher: string) => `You’ll see the dances as soon as ${teacher} accepts you.`,
    withdraw: 'Withdraw',
    withdrawn: 'Request withdrawn',
    member: 'You’re in this class',
    leave: 'Leave',
    leaveTitle: (name: string) => `Leave ${q(name)}?`,
    leaveMessage: 'It disappears from your classes. You can join again with the link.',
    left: 'You left the class',
    dancesTitle: 'Dances',
    noPostsTitle: 'No dances yet',
    noPostsTeacher: 'Add the first figure from your library. Everyone in the class sees it right away.',
    noPostsStudent: 'Your teacher hasn’t posted anything yet. Have a look after the next lesson.',
    addDance: 'Add a dance',
    invite: 'Invite students',
    more: 'More actions',
    editClass: 'Edit class',
    deleteClass: 'Delete class',
    deleteTitle: (name: string) => `Delete ${q(name)}?`,
    deleteMessage: 'The class and its dances are deleted for everyone, and your students lose access. Copies they saved stay with them.',
    deleted: 'Class deleted',
    reportClass: 'Report class',
    blockTeacher: (name: string) => `Block ${name}`,
    posted: (when: string) => `posted ${when}`,
    postA11y: (name: string, note: string, when: string) => [name, note, when].filter(Boolean).join('. '),
    postActions: (name: string) => `Actions for ${q(name)}`,
    notFoundTitle: 'There’s no class with this code',
    notFoundBody: 'Check the link or the code with your teacher. The class may also have been deleted.',
    failedTitle: 'Can’t load this class',
    cachedOffline: (when: string) => `No connection. Showing what was saved on this device ${when}.`,
    toClasses: 'Go to my classes',
    // posts (teacher)
    pickTitle: 'Add a dance',
    pickBody: 'Pick a dance from your library. Your students see the version you post now.',
    pickEmpty: 'Your library is empty. Create a dance first.',
    noteLabel: 'Note for your students (optional)',
    notePlaceholder: 'e.g. Week 3: the turn',
    post: 'Post to class',
    postedToast: 'Posted to the class',
    otherDance: 'Pick another dance',
    editNote: 'Edit note',
    noteSave: 'Save note',
    noteSaved: 'Note saved',
    updateFromLibrary: 'Update from my library',
    updateFromLibraryHint: 'Posts the current version of this dance',
    updatedPost: 'Updated with the version from your library',
    notInLibrary: 'This dance isn’t in your library anymore, so there is nothing to update it from.',
    removePost: 'Remove from class',
    removeTitle: (name: string) => `Remove ${q(name)} from the class?`,
    removeMessage: 'Students won’t see it in the class anymore. Copies they saved stay with them.',
    removed: 'Removed from the class',
    postNotFoundTitle: 'This dance isn’t in the class anymore',
    postNotFoundBody: 'Your teacher may have removed it. The other dances are on the class page.',
    toClass: 'Go to the class',
    // invite
    inviteTitle: 'Invite students',
    inviteScan: 'Scan with your phone camera',
    inviteOr: 'Or open Waltzy → Classes → Join a class and type the code',
    codeA11y: (code: string) => `Class code ${code.split('').join(' ')}`,
    // members (teacher)
    members: 'Members',
    membersCount: (n: number) => pl(n, { one: '# member', other: '# members' }),
    requestsCount: (n: number) => pl(n, { one: '# request', other: '# requests' }),
    noMembers: 'Nobody has joined yet',
    membersA11y: (members: string, requests: string) => [`Members: ${members}`, requests].filter(Boolean).join(', '),
    membersLoading: 'Loading the members',
    membersFailed: 'The list could not be loaded.',
    membersOpenTitle: 'Open class',
    membersOpenHint: 'Anyone with the link or the code can join. To accept people first, switch on “Approve new members” under Edit class.',
    membersApprovalHint: 'New people ask to join. They see the dances once you accept them.',
    membersEmptyTitle: 'Nobody has joined yet',
    membersEmptyBody: 'Show your students the QR code or send them the link.',
    requestsTitle: 'Requests',
    accept: 'Accept',
    decline: 'Decline',
    acceptA11y: (name: string) => `Accept ${name}`,
    declineA11y: (name: string) => `Decline ${name}`,
    accepted: (name: string) => `${name} is in`,
    declined: 'Request declined',
    asked: (when: string) => `asked ${when}`,
    joinedWhen: (when: string) => `joined ${when}`,
    removeMember: 'Remove',
    removeMemberA11y: (name: string) => `Remove ${name} from the class`,
    removeMemberTitle: (name: string) => `Remove ${name} from the class?`,
    removeMemberOpen: 'The class disappears from their classes. With the link they can join again.',
    removeMemberApproval: 'They can’t see the dances anymore. To come back they have to ask again.',
    memberRemoved: 'Removed from the class',
  },

  /** Scan a QR code (a class or a shared dance) with the camera */
  scan: {
    title: 'Scan QR code',
    hint: 'Point the camera at the QR code of a class or a shared dance.',
    allowTitle: 'Scan with your camera',
    allowBody: 'Waltzy uses the camera only to read QR codes. Nothing is recorded or stored.',
    allow: 'Allow camera',
    deniedBody: 'The camera is switched off for Waltzy. Switch it on in Settings to scan a QR code.',
    openSettings: 'Open Settings',
    notOurs: 'That isn’t a Waltzy code.',
    lightOn: 'Switch the light on',
    lightOff: 'Switch the light off',
    typeInstead: 'Type the code instead',
  },

  /** The web page behind links, for people who do not have the app (yet) */
  site: {
    lead: 'Dance steps as footprints you can play, slow down and share. An app for iPhone.',
    classTitle: 'You’re invited to a dance class',
    classBody: 'The class and its dances open in the Waltzy app.',
    shareTitle: 'Someone shared a dance with you',
    shareBody: 'It opens in the Waltzy app.',
    open: 'Open in Waltzy',
    get: 'Get Waltzy',
    beta: 'Waltzy is free and in beta: Apple’s TestFlight app installs it.',
    again: 'No app yet? Install it, then open this link again.',
    codeHint: (code: string) => `Or in Waltzy: Classes → Join a class → ${code}`,
  },

  /** Report sheet */
  report: {
    title: {
      share: 'Report this dance',
      post: 'Report this dance',
      class: 'Report this class',
      user: 'Report this person',
    },
    body: 'What’s wrong with it? We look at every report.',
    reasons: {
      offensive: { title: 'Offensive or hateful', subtitle: 'Insults, harassment, sexual or violent content' },
      spam: { title: 'Spam or a scam', subtitle: 'Ads, fake or misleading content' },
      copyright: { title: 'Someone else’s work', subtitle: 'Shared without the owner’s permission' },
      other: { title: 'Something else', subtitle: 'Tell us below' },
    },
    detailsLabel: 'Details (optional)',
    detailsPlaceholder: 'Anything that helps us understand',
    pickFirst: 'Pick a reason first.',
    send: 'Send report',
    thanks: 'Thanks for telling us. We’ll take a look.',
  },

  /** Blocking people (on this device) */
  blocked: {
    blockTitle: (name: string) => `Block ${name}?`,
    blockMessage: (name: string) =>
      `You won’t see links and classes from ${name} on this device anymore. You can unblock ${name} any time under Profile → Blocked people.`,
    blockConfirm: 'Block',
    blockedToast: (name: string) => `${name} is blocked`,
    noticeTitle: (name: string) => `You blocked ${name}`,
    noticeBody: 'What they share is hidden on this device.',
    unblock: 'Unblock',
    unblockA11y: (name: string) => `Unblock ${name}`,
    unblocked: (name: string) => `${name} is unblocked`,
    listTitle: 'Blocked people',
    listBody: 'You don’t see their links and classes on this device.',
    emptyTitle: 'You haven’t blocked anyone',
    emptyBody: 'If someone shares something you don’t want to see, block them from the ⋯ menu on their link or class.',
    since: (when: string) => `Blocked ${when}`,
    someone: 'this person',
    sectionTitle: 'Sharing',
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

  /** Problems in received or stored dances (technical field names stay as they are in the data) */
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

  /** Bottom tab bar */
  tabs: {
    library: 'Library',
    classes: 'Classes',
    me: 'Profile',
  },

  /** Signing in, the Me tab, account deletion */
  account: {
    title: 'Profile',
    pitchTitle: 'Back up your dances and share them with a link',
    pitchBody: 'Sign in with Apple or Google. No new password to remember.',
    signIn: 'Sign in',
    sectionAccount: 'Account',
    sectionBackup: 'Backup',
    sectionApp: 'App',
    name: 'Name',
    noName: 'No name yet',
    editName: 'Change name',
    email: 'E-mail',
    language: 'Language',
    lesson: 'How to read the footprints',
    terms: 'Terms of use',
    privacy: 'Privacy',
    version: (v: string) => `Version ${v}`,
    signOut: 'Sign out',
    signOutTitle: 'Sign out?',
    signOutMessage: 'Your dances stay on this device. Sign in again any time to back them up.',
    signedOut: 'Signed out. Your dances are still here.',
    deleteAccount: 'Delete account',
    deleteHint: 'Deletes your backup, shared links and classes',
    deleteTitle: 'Delete your account?',
    deleteMessage:
      'This deletes your account and everything stored with it: the backup of your dances, the links you shared and your classes. It cannot be undone. The dances on this device stay here.',
    deleteConfirm: 'Delete my account',
    deleted: 'Your account was deleted. Your dances are still on this device.',
    // sign-in screen
    signInTitle: 'Sign in',
    emailTitle: 'What’s your e-mail?',
    /** between the e-mail field and Apple's button */
    or: 'or',
    appleFailed: 'Sign in with Apple didn’t work. Please try again.',
    /** sign-in screen without the e-mail code */
    startTitle: 'Sign in to Waltzy',
    startBody: 'Back up your dances and share them with a link. No new password: use an account you already have.',
    google: 'Sign in with Google',
    googleFailed: 'Sign in with Google didn’t work. Please try again.',
    /** shown instead of Apple's hidden relay address */
    appleAccount: 'Signed in with Apple',
    emailBody: 'We’ll send you a 6-digit code. No password needed.',
    emailLabel: 'E-mail',
    emailPlaceholder: 'you@example.com',
    badEmail: 'That doesn’t look like an e-mail address. Check it and try again.',
    sendCode: 'Send code',
    codeTitle: 'Check your e-mail',
    codeBody: (email: string) => `We sent a 6-digit code to ${email}. Type it in here.`,
    codeLabel: '6-digit code',
    codeHint: 'Can’t find it? Look in your spam folder.',
    resendIn: (s: number) => `Send a new code in ${s} s`,
    resend: 'Send a new code',
    resent: 'New code sent',
    otherEmail: 'Use another e-mail',
    nameTitle: 'What’s your name?',
    nameBody: 'This name is shown on dances you share.',
    nameLabel: 'Your name',
    namePlaceholder: 'First name or nickname',
    nameEmpty: 'Type a name first.',
    continue: 'Continue',
    saveName: 'Save',
    nameSaved: 'Name saved',
    welcome: (name: string) => `Signed in as ${name}`,
    /** {terms} and {privacy} become links */
    legalLine: 'By continuing you agree to the {terms} and the {privacy}.',
    legalTerms: 'terms of use',
    legalPrivacy: 'privacy policy',
  },

  /** Library backup status (Me tab) */
  sync: {
    explain: 'Backup is automatic. Your dances are saved on this device and in your account, so they also show up on your other devices.',
    syncing: 'Backing up…',
    never: 'Not backed up yet',
    justNow: 'Backed up just now',
    minutesAgo: (n: number) => `Backed up ${pl(n, { one: '# minute', other: '# minutes' })} ago`,
    at: (when: string) => `Last backup: ${when}`,
    error: 'Backup paused',
    retryHint: 'We’ll try again by ourselves. Your dances are safe on this device.',
  },

  /** Terms of use and privacy policy (drafts: the owner reviews them) */
  legal: {
    updated: (date: string) => `Last updated: ${date}`,
    operator: (name: string) => `Waltzy is run by ${name}.`,
    contact: (email: string) => `Contact: ${email}`,
    terms: {
      title: 'Terms of use',
      sections: [
        {
          heading: 'In short',
          body: 'Waltzy works on your device without an account. These terms apply when you sign in: to back up your dances, share them with a link or run a class.',
        },
        {
          heading: 'Your account',
          body: 'You sign in with your Apple or Google account. Your display name is shown on dances you share and classes you run, and to the teacher of a class you join or ask to join. Keep that account safe: whoever can use it can sign in as you.',
        },
        {
          heading: 'What you share',
          body: 'A dance you share with a link can be seen and saved by anyone who has the link. A class can be seen by anyone with its link, unless you approve new members: then only people you accepted see its dances. Only share what you made yourself or are allowed to share.',
        },
        {
          heading: 'No tolerance for objectionable content',
          body: 'Do not share anything offensive, hateful, sexual, violent, harassing or misleading, no spam, and nothing that breaks the law or someone else’s rights. Report such content in the app. We remove content that breaks these rules and close the accounts that share it.',
        },
        {
          heading: 'Deleting your account',
          body: 'On the Me tab, tap “Delete account”. This deletes your backup, your shared links and your classes. Your dances stay on your device.',
        },
        {
          heading: 'No guarantee',
          body: 'Waltzy is provided as it is. We take care of your backup, but we cannot promise the service is always available. We may change these terms; if the change matters, we tell you in the app.',
        },
      ],
    },
    privacy: {
      title: 'Privacy policy',
      sections: [
        {
          heading: 'In short',
          body: 'Without an account, everything stays on your device and Waltzy sends nothing anywhere. When you sign in, we store only what the features need. No ads, no tracking.',
        },
        {
          heading: 'What we store',
          body: 'The e-mail address of the Apple or Google account you sign in with (with Apple it can be a relay address Apple gives us instead), your display name, the dances you back up, the dances you share with a link, the classes you run or join and what is posted in them, and reports you send.',
        },
        {
          heading: 'Where',
          body: 'With our hosting provider Supabase, on servers in the EU (Frankfurt, Germany). When you sign in, Apple or Google confirms to us that it is you; we never see your password. The web page that opens shared links runs on our own server and is delivered through Cloudflare.',
        },
        {
          heading: 'Who can see it',
          body: 'Your backup: only you. A shared dance: anyone with the link, together with your display name. A class: anyone with the class link, together with the teacher’s display name; if the teacher approves new members, only the teacher and accepted members see its dances. The teacher of a class you join or ask to join sees your display name.',
        },
        {
          heading: 'Why',
          body: 'Only to provide what you asked for (sign-in, backup, sharing and classes) and to deal with reports.',
        },
        {
          heading: 'Camera',
          body: 'Waltzy uses the camera only when you scan a QR code. The picture is read on your device; nothing is recorded, stored or sent.',
        },
        {
          heading: 'How long',
          body: 'Until you delete it or your account. Deleting your account (Me tab → Delete account) deletes all of it. Reports are kept as long as needed to deal with them.',
        },
        {
          heading: 'Your rights',
          body: 'You can see, change and delete your data in the app. You can also ask us what we store about you, and complain to a data protection authority.',
        },
      ],
    },
  },

  /** Messages for failed cloud calls (by `CloudError.reason`) */
  cloud: {
    errors: {
      offline: 'No connection. Check your internet and try again.',
      notSignedIn: 'You’re signed out. Please sign in again.',
      invalidCode: 'That code is wrong or has expired. Check it, or send a new one.',
      rateLimited: 'Too many tries. Please wait a minute, then try again.',
      limit: 'You’ve reached the limit here. Delete something first, then try again.',
      notFound: 'This isn’t available anymore.',
      unknown: 'Something went wrong. Please try again.',
    },
    retry: 'Try again',
  },
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
