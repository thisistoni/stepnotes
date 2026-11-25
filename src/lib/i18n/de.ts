/**
 * Deutsch (Österreich). Must match `Strings` from en.ts exactly.
 *
 * Voice: a warm dance teacher, informal "du", short sentences, no software-manual German.
 * Austrian standard German with ß (Fuß, schließt); neutral vocabulary; light Austrian touches
 * only where they feel natural ("Passt"). Quotes „…“.
 *
 * Glossary (keep consistent):
 *   leader / follower / both   Führen / Folgen / Beide   (in sentences: wer führt, wer folgt, beim Führen)
 *   part (role)                Rolle                     ("Rolle „Folgen“ hinzufügen")
 *   weight foot / free foot    Standbein (trägt dein Gewicht) / Spielbein (frei, bewegt sich als Nächstes)
 *   weight / weight change     Gewicht / Gewichtswechsel (am Platz)
 *   step · tap · hold          Schritt · Tap (tippt auf, ohne Gewicht) · Halten (Pause)
 *   count · bar · beat         Zählzeit · Takt · Schlag;   bpm → BPM;  "&" → "und"
 *   forward · back · side      nach vorne · zurück (nach hinten) · zur Seite nach links/rechts
 *   diagonal · in place        schräg (schräg nach vorne links) · am Platz
 *   closes · turn              schließt zum rechten Fuß · mit einer Vierteldrehung nach rechts (Drehung des Körpers)
 *   rock step · chassé · box   Wiegeschritt · Chassé · Karree;  rise and fall → heben / senken
 *   Animate / Chart            Animation / Übersicht
 *   Facing / Mirrored          Vorne (tag: arrow up = where you face; a11y "Blickrichtung") / Gespiegelt
 *   Loop / Say counts / Mirror Wiederholen / Mitzählen / Spiegeln;  L / R letters → L / R anzeigen
 *   Vibrate                    Vibrieren
 *   Your dances / My dances    Deine Tänze / Meine Tänze;  Starter dances → Zum Einstieg
 *   Create · Import · Share    Neuer Tanz · Importieren · Teilen
 *   Duplicate · Delete · Undo  Duplizieren · Löschen · Rückgängig
 *   Save · Discard · Keep editing   Speichern · Verwerfen · Weiter bearbeiten
 *   Make my own version        Eigene Version erstellen
 *   Ballroom / Latin (styles)  Standard / Latein
 */
import type { StepInfo } from '../pattern';
import type { Foot } from '../types';
import type { ValidationWhere } from '../validate';

import type { Strings } from './en';
import { plural, RULES, type PluralForms } from './plural';

const num = (n: number) => String(Math.round(n * 100) / 100).replace('.', ',');
const pl = (n: number, forms: PluralForms) => plural(RULES.de, n, forms, num);
const q = (s: string) => `„${s}“`;

/** "der linke Fuß" (nominative) and the adjective for "zum linken Fuß" / "den linken Fuß" */
const FOOT: Record<Foot, string> = { L: 'Der linke Fuß', R: 'Der rechte Fuß' };
const ADJ: Record<Foot, string> = { L: 'linken', R: 'rechten' };
const other = (f: Foot): Foot => (f === 'L' ? 'R' : 'L');
const SIDE = { left: 'links', right: 'rechts' } as const;

type Moving = StepInfo & { kind: 'step' | 'tap' };

/** Where a step goes: "nach vorne", "zurück", "zur Seite nach links", "schräg nach hinten rechts" */
function goes(s: Moving) {
  const { fb, side } = s.dir;
  if (fb && !side) return fb === 'forward' ? 'nach vorne' : 'zurück';
  if (side && !fb) return `zur Seite nach ${SIDE[side]}`;
  return `schräg nach ${fb === 'forward' ? 'vorne' : 'hinten'} ${SIDE[side!]}`;
}
/** Where a tap touches: "vorne", "hinten", "seitlich links", "schräg vorne links" */
function at(s: Moving) {
  const { fb, side } = s.dir;
  if (fb && !side) return fb === 'forward' ? 'vorne' : 'hinten';
  if (side && !fb) return `seitlich ${SIDE[side]}`;
  return `schräg ${fb === 'forward' ? 'vorne' : 'hinten'} ${SIDE[side!]}`;
}
/** Short form next to an L / R badge: "Nach vorne", "Zurück", "Zur Seite nach links", "Schräg hinten links" */
function goesShort(s: Moving) {
  const { fb, side } = s.dir;
  if (fb && !side) return fb === 'forward' ? 'Nach vorne' : 'Zurück';
  if (side && !fb) return `Zur Seite nach ${SIDE[side]}`;
  return `Schräg ${fb === 'forward' ? 'vorne' : 'hinten'} ${SIDE[side!]}`;
}
/** Turns the way a dance teacher says them; odd angles stay in degrees. [dative, bare] */
const TURN: Record<number, [string, string]> = {
  45: ['einer Achteldrehung', 'Achteldrehung'],
  90: ['einer Vierteldrehung', 'Vierteldrehung'],
  135: ['einer Dreiachteldrehung', 'Dreiachteldrehung'],
  180: ['einer halben Drehung', 'halbe Drehung'],
};
/** ", mit einer Vierteldrehung nach links" */
const withTurn = (turn: number) => {
  if (!turn) return '';
  const a = Math.abs(turn);
  return `, mit ${TURN[a]?.[0] ?? `einer Drehung um ${a}°`} nach ${turn > 0 ? 'rechts' : 'links'}`;
};
/** ", Vierteldrehung links" */
const withTurnShort = (turn: number) => {
  if (!turn) return '';
  const a = Math.abs(turn);
  return `, ${TURN[a]?.[1] ?? `${a}°`} ${turn > 0 ? 'rechts' : 'links'}`;
};

function beats(b: number) {
  if (b === 0.5) return '½ Schlag';
  if (b === 0.25) return '¼ Schlag';
  if (b === 1.5) return '1½ Schläge';
  return pl(b, { one: '# Schlag', other: '# Schläge' });
}

export const de: Strings = {
  code: 'de',
  // No Austrian (de-AT) voice ships on iOS or with Google's engine; the German voice does.
  speech: { android: 'de', ios: 'de-DE', web: 'de-DE' },

  common: {
    back: 'Zurück',
    close: 'Schließen',
    cancel: 'Abbrechen',
    confirm: 'Passt',
    undo: 'Rückgängig',
    open: 'Öffnen',
    search: 'Suchen',
    clearText: 'Text löschen',
    dragToClose: 'Zum Schließen nach unten ziehen',
    untitled: 'Unbenannter Tanz',
    myVersion: (name: string) => `${name} (meine Version)`,
    quote: q,
    increase: (what: string) => `${what} erhöhen`,
    decrease: (what: string) => `${what} verringern`,
    progress: (n: number, total: number) => `Schritt ${n} von ${total}`,
  },

  units: {
    number: num,
    bpm: (n: number) => `${n} BPM`,
    bpmUnit: 'BPM',
    meter: (beatsPerBar: number) => `${beatsPerBar}/4`,
    percent: (n: number) => `${n} %`,
    beats,
  },

  roles: {
    leader: 'Führen',
    follower: 'Folgen',
    both: 'Beide',
    part: 'Rolle',
    leaderAndFollower: 'Führen + Folgen',
  },

  feet: {
    left: 'Links',
    right: 'Rechts',
    leftFoot: 'Linker Fuß',
    rightFoot: 'Rechter Fuß',
    hold: 'Halten',
  },

  language: {
    button: 'Sprache',
  },

  intro: {
    previous: 'Zurück',
    skip: 'Überspringen',
    skipHint: 'Überspringt die Einführung und öffnet deine Tänze',
    promise: 'Hallo! Lern jeden Tanzschritt – Fußabdruck für Fußabdruck.',
    getStarted: 'Loslegen',
    continue: 'Weiter',
    startDancing: 'Los geht’s',
    gotIt: 'Alles klar',
    languageSwitch: 'Sprache',
    roleTitle: 'Welche Rolle tanzt du?',
    choices: {
      leader: { title: 'Führen', subtitle: 'Ich gebe die Schritte vor' },
      follower: { title: 'Folgen', subtitle: 'Ich folge der Führung' },
      both: { title: 'Beide', subtitle: 'Oder noch offen – wir starten beim Führen' },
    },
    coach: {
      none: 'Die Rolle kannst du später in jedem Tanz **wechseln**.',
      leader: 'Wer führt, beginnt meist mit dem **linken Fuß**. Diese Schritte zeigen wir dir zuerst.',
      follower: 'Wer folgt, beginnt meist mit dem **rechten Fuß**. Diese Schritte zeigen wir dir zuerst.',
      both: 'Wir starten beim Führen. **Wechseln** kannst du in jedem Tanz.',
    },
  },

  lesson: {
    title: 'So liest du die Fußabdrücke',
    play: 'Beispiel abspielen',
    pause: 'Beispiel anhalten',
    facing: 'Vorne',
    facingA11y: 'Blickrichtung: nach oben',
    legend: {
      solid: { title: 'Standbein', body: 'Trägt dein Gewicht' },
      light: { title: 'Spielbein', body: 'Frei – bewegt sich gleich' },
      dashed: { title: 'Gestrichelter Fuß', body: 'Hier landet dein Schritt' },
    },
  },

  library: {
    title: 'Deine Tänze',
    import: 'Tanz importieren',
    create: 'Neuer Tanz',
    searchPlaceholder: 'Tänze oder Stile suchen',
    myDances: 'Meine Tänze',
    starters: 'Zum Einstieg',
    loading: 'Deine Tänze werden geladen',
    all: 'Alle',
    filterBy: 'Nach Stil filtern',
    styleChip: (style: string) => `Stil ${style}`,
    openHint: 'Öffnet den Tanz',
    cardMeta: (steps: number, bpm: number) => `${pl(steps, { one: '# Schritt', other: '# Schritte' })} · ${bpm} BPM`,
    lessonTitle: 'So liest du die Fußabdrücke',
    lessonBody: 'Eine Minute zum Mitmachen',
    emptyTitle: 'Notier deinen ersten Tanz',
    emptyBody: 'Setz die Fußabdrücke Schritt für Schritt – und spiel sie dann in deinem Tempo ab.',
    emptyAction: 'Neuer Tanz',
    noMatchQuery: (query: string) => `Kein Tanz passt zu ${q(query)}`,
    noMatchStyle: (style: string) => `Noch keine Tänze im Stil ${q(style)}`,
    noMatchQueryInStyle: (style: string) => `Im Stil ${q(style)} passt nichts. Probier ein anderes Wort oder zeig alle Stile.`,
    noMatchQueryBody: 'Probier einen anderen Namen oder Stil.',
    noMatchStyleBody: 'Wähl einen anderen Stil oder leg einen Tanz in diesem Stil an.',
    clearSearch: 'Suche löschen',
    showAll: 'Alle Tänze zeigen',
  },

  player: {
    edit: 'Tanz bearbeiten',
    makeOwn: 'Eigene Version erstellen',
    makeOwnHint: 'Öffnet eine Kopie im Editor',
    makeOwnShort: 'Eigene Version',
    editSteps: 'Schritte bearbeiten',
    more: 'Weitere Aktionen',
    duplicate: 'Duplizieren',
    duplicateHint: 'Speichert eine Kopie unter „Meine Tänze“',
    share: 'Teilen',
    shareHint: 'Als Text verschicken',
    delete: 'Löschen',
    copied: 'Kopie unter „Meine Tänze“ gespeichert',
    copyFailed: 'Kopieren hat nicht geklappt. Probier es bitte noch einmal.',
    deleteTitle: (name: string) => `${q(name)} löschen?`,
    deleteMessage: 'Der Tanz verschwindet aus „Meine Tänze“. Gleich danach kannst du das noch rückgängig machen.',
    deleted: (name: string) => `${q(name)} gelöscht`,
    restoreFailed: 'Zurückholen hat nicht geklappt. Probier es bitte noch einmal.',
    deleteFailed: 'Löschen hat nicht geklappt. Probier es bitte noch einmal.',
    nothingToPlay: 'Noch nichts zum Abspielen',
    startPosition: 'Startposition',
    startPositionHint: 'Startposition. Spiel ab oder geh Schritt für Schritt durch.',
    animate: 'Animation',
    animateA11y: 'Schritte als Animation zeigen',
    chart: 'Übersicht',
    chartA11y: 'Alle Schritte als Übersicht zeigen',
    view: 'Ansicht',
    facing: 'Vorne',
    mirrored: 'Gespiegelt',
    facingA11y: 'Blickrichtung: vorne ist oben am Bildschirm',
    mirroredA11y: 'Gespiegelte Ansicht: Links und rechts sind vertauscht. Vorne ist oben.',
  },

  count: {
    ready: 'Bereit',
    readyA11y: 'Bereit, Startposition',
    tile: (count: string, kind: 'step' | 'tap' | 'hold') => `Zählzeit ${count}${kind === 'hold' ? ', halten' : kind === 'tap' ? ', Tap' : ''}`,
    tap: 'Tap',
    hold: 'Halten',
    noSteps: 'Noch keine Schritte',
    stepOf: (n: number, total: number) => `Schritt ${n} von ${total}`,
    readyOf: (total: number) => `Bereit · ${pl(total, { one: '# Schritt', other: '# Schritte' })}`,
    pills: 'Zählzeiten',
    pill: (count: string, n: number) => `Zählzeit ${count}, Schritt ${n}`,
  },

  transport: {
    previous: 'Vorheriger Schritt',
    next: 'Nächster Schritt',
    play: 'Abspielen',
    pause: 'Pause',
    noSteps: 'Dieser Tanz hat noch keine Schritte. Setz im Editor die ersten, dann kannst du ihn abspielen.',
  },

  tempo: {
    label: 'Tempo',
    value: (pct: number, bpm: number) => `${pct} Prozent, ${bpm} Schläge pro Minute`,
    current: (pct: number, bpm: number) => `Tempo ${pct} Prozent, ${bpm} Schläge pro Minute`,
    resetHint: 'Setzt das Tempo auf 100 Prozent zurück',
  },

  toggles: {
    loop: 'Wiederholen',
    speak: 'Mitzählen',
    mirror: 'Spiegeln',
    letters: 'L / R anzeigen',
    lettersA11y: 'L und R auf den Füßen anzeigen',
    vibrate: 'Vibrieren',
  },

  chart: {
    bar: (n: number) => `Takt ${n}`,
    all: 'Alle',
    allA11y: 'Alle Schritte',
    of: 'Übersicht für',
    start: 'Start',
    count: 'Zählzeit',
    tap: 'Tap',
    tapLong: 'Tap (ohne Gewicht)',
    legendA11y: 'Volle Füße: hier startest du. Zahlen: die Zählzeiten. Gestrichelter Pfeil: ein Tap ohne Gewicht.',
  },

  steps: {
    title: 'Alle Schritte',
    of: 'Schritte für',
    empty: 'Noch keine Schritte. Im Editor setzt du den ersten.',
    row: (count: string, text: string, note?: string) => `Zählzeit ${count}. ${text}${note ? `. ${note}` : ''}`,
    rowHint: 'Zeigt diesen Schritt im Diagramm',
    tap: 'Tap',
    hold: 'Halten',
  },

  about: {
    title: 'Über diesen Tanz',
    video: 'Video ansehen',
    videoFailed: 'Der Video-Link lässt sich nicht öffnen.',
  },

  share: {
    prefix: 'Ein Tanz für Waltzy. Kopier den ganzen Text und füg ihn in Waltzy unter „Importieren“ ein:',
    failed: 'Teilen hat nicht geklappt. Probier es bitte noch einmal.',
    copied: 'Tanz kopiert. Füg ihn in eine Nachricht ein, um ihn zu teilen.',
    unsupported: 'Dieser Browser kann weder teilen noch kopieren. Öffne Waltzy am Handy, um zu teilen.',
  },

  notFound: {
    title: 'Diesen Tanz gibt es nicht mehr',
    body: 'Vielleicht wurde er gelöscht. Deine anderen Tänze sind alle noch da.',
    action: 'Zu deinen Tänzen',
  },

  errorScreen: {
    title: 'Da ist etwas schiefgelaufen',
    body: 'Diese Seite lässt sich gerade nicht anzeigen. Deine Tänze sind sicher.',
    retry: 'Noch einmal versuchen',
    home: 'Zu deinen Tänzen',
  },

  persist: {
    unreadable: 'Deine Tänze lassen sich auf diesem Gerät gerade nicht lesen, darum wurde nichts gespeichert. Probier es bitte noch einmal.',
    writeFailed: 'Speichern auf diesem Gerät hat nicht geklappt. Probier es bitte noch einmal.',
  },

  editor: {
    newTitle: 'Neuer Tanz',
    editTitle: 'Bearbeiten',
    close: 'Editor schließen',
    undo: 'Rückgängig',
    save: 'Speichern',
    badVideo: 'Das sieht nicht nach einem Link aus. Füg die ganze Adresse ein, sie beginnt mit https://',
    checkVideo: 'Prüf zuerst den Video-Link',
    saved: 'Passt – Tanz gespeichert',
    changesSaved: 'Änderungen gespeichert',
    saveFailed: 'Speichern hat nicht geklappt. Probier es bitte noch einmal.',
    stepDeleted: (n: number) => `Schritt ${n} gelöscht`,
    discardTitle: 'Änderungen verwerfen?',
    discardNew: 'Dieser Tanz ist noch nicht gespeichert.',
    discardEdits: 'Was du seit dem letzten Speichern geändert hast, geht verloren.',
    discard: 'Verwerfen',
    keepEditing: 'Weiter bearbeiten',
    rotateLeft: 'Fuß um 15 Grad nach links drehen',
    rotateRight: 'Fuß um 15 Grad nach rechts drehen',
    recenter: 'Alle Schritte zeigen',
  },

  details: {
    title: 'Details',
    summaryA11y: (name: string, summary: string) => `Details: ${name}, ${summary}`,
    openHint: 'Öffnet die Details',
    collapse: 'Details zuklappen',
    name: 'Name',
    style: 'Stil',
    stylePlaceholder: 'Salsa, Tango, Discofox …',
    commonStyles: 'Häufige Stile',
    tempo: 'Tempo',
    beatsPerBar: 'Schläge pro Takt',
    footprints: 'Fußabdrücke',
    flat: 'Flach',
    heel: 'Absatz',
    flatA11y: (role: string) => `${role}: flache Schuhe`,
    heelA11y: (role: string) => `${role}: Schuhe mit Absatz`,
    footprintsOf: (role: string) => `Fußabdrücke für ${role}`,
    description: 'Beschreibung',
    descriptionPlaceholder: 'Technik, Styling, worauf du achten sollst …',
    video: 'Video-Link',
    videoHint: 'Optional: ein Video zum Nachschauen',
  },

  follower: {
    addTitle: 'Rolle „Folgen“ hinzufügen',
    addBody: 'Beim Paartanz steht ihr einander gegenüber. Darum tanzt, wer folgt, meist spiegelbildlich: Aus links wird rechts, aus vorwärts wird rückwärts.',
    mirror: 'Von „Führen“ spiegeln',
    recommended: 'Empfohlen. Jeden Schritt kannst du danach noch anpassen.',
    empty: 'Leer beginnen',
    toolsTitle: 'Rolle „Folgen“',
    toolsBody: 'Schritte beim Führen geändert? Spiegle sie noch einmal oder entferne diese Rolle.',
    mirrorAgain: 'Neu spiegeln',
    remove: 'Entfernen',
    regenerateTitle: 'Noch einmal von „Führen“ spiegeln?',
    regenerateMessage: 'Die Schritte für „Folgen“ werden durch ein Spiegelbild von „Führen“ ersetzt. Du kannst das rückgängig machen.',
    removeTitle: 'Rolle „Folgen“ entfernen?',
    removeMessage: 'Alle Schritte für „Folgen“ werden aus diesem Tanz entfernt. Du kannst das rückgängig machen.',
  },

  inspector: {
    startOverline: 'Startposition',
    startTitle: 'So stehst du vor Zählzeit 1',
    placing: 'Welchen Fuß setzt du?',
    footToPlace: 'Fuß zum Setzen',
    addFirst: 'Schritt 1 hinzufügen',
    stepOf: (n: number, total: number) => `Schritt ${n} von ${total}`,
    count: 'Zählzeit',
    length: 'Länge in Schlägen',
    lengthA11y: (b: number) => beats(b),
    foot: 'Fuß',
    action: 'Bewegung',
    kinds: { step: 'Schritt', tap: 'Tap', hold: 'Halten' },
    kindHelp: {
      step: 'Der Fuß bewegt sich und übernimmt dein Gewicht.',
      tap: 'Der Fuß tippt auf, ohne Gewicht.',
      hold: 'Niemand bewegt sich – eine Pause auf dieser Zählzeit.',
    },
    note: 'Notiz',
    notePlaceholder: 'Optional, z. B. auf dem Ballen',
    earlier: 'Früher',
    later: 'Später',
    earlierShort: 'Früher',
    laterShort: 'Später',
    earlierA11y: 'Schritt einen Platz früher setzen',
    laterA11y: 'Schritt einen Platz später setzen',
    delete: 'Schritt löschen',
    quickCount: (count: string) => `Zählzeit ${count === '&' ? 'und' : count}`,
  },

  strip: {
    start: 'Start',
    startA11y: 'Startposition',
    addFirst: 'Ersten Schritt hinzufügen',
    addAfter: (n: number) => `Neuen Schritt nach Schritt ${n} einfügen`,
    chip: (n: number, count: string, kind: 'step' | 'tap' | 'hold', foot: Foot) =>
      `Schritt ${n}, Zählzeit ${count}, ${kind === 'hold' ? 'halten' : `${foot === 'L' ? 'linker' : 'rechter'} Fuß${kind === 'tap' ? ', Tap' : ''}`}`,
  },

  coach: {
    startDragging: (foot: Foot) => `Lass dort los, wo der ${ADJ[foot].slice(0, -1)} Fuß stehen soll.`,
    startEmpty: 'Stell die Füße auf, dann füg Schritt 1 hinzu.',
    startChange: 'Zieh einen Fuß, um die Startposition zu ändern.',
    holdBlocked: 'Beim Halten bewegt sich nichts – wähl dafür „Schritt“.',
    hold: 'Halten: Auf dieser Zählzeit bewegt sich niemand.',
    dragging: (foot: Foot) => `Lass dort los, wo der ${ADJ[foot].slice(0, -1)} Fuß landen soll.`,
    tap: (foot: Foot) => `Zieh den ${ADJ[foot]} Fuß dorthin, wo er auftippt.`,
    step: (foot: Foot) => `Zieh den ${ADJ[foot]} Fuß dorthin, wo er landet.`,
    rotating: 'Die Zehen zeigen zu deinem Finger.',
    panning: 'Das Fadenkreuz holt alle Schritte zurück.',
    holdTip: 'Fuß gedrückt halten: drehen',
    panTip: 'Boden ziehen: verschieben',
    edgeTip: 'Mehr Platz? Zieh über den Boden',
  },

  import: {
    title: 'Tanz importieren',
    submit: 'Tanz hinzufügen',
    intro: 'Füg hier einen Tanz ein, den dir jemand geschickt hat. Text rundherum, etwa aus einem Chat, stört nicht.',
    field: 'Geteilter Tanz',
    paste: 'Einfügen',
    preview: (name: string, style: string, steps: number, follower: boolean) =>
      `Bereit: ${q(name)} · ${[style, pl(steps, { one: '# Schritt', other: '# Schritte' }), follower ? 'Führen + Folgen' : ''].filter(Boolean).join(' · ')}`,
    notADance: 'Das ist leider kein Waltzy-Tanz. Lass ihn dir am besten noch einmal schicken.',
    added: (name: string) => `${q(name)} ist jetzt bei deinen Tänzen`,
    saveFailed: 'Speichern hat nicht geklappt. Probier es bitte noch einmal.',
    clipboardEmpty: 'Die Zwischenablage ist leer',
    clipboardFailed: 'Die Zwischenablage lässt sich nicht lesen. Füg den Text direkt ins Feld ein.',
  },

  validation: {
    where: (w: ValidationWhere) =>
      [w.role ? (w.role === 'leader' ? 'Führen' : 'Folgen') : '', w.start ? 'Startposition' : '', w.step ? `Schritt ${w.step}` : '']
        .filter(Boolean)
        .join(', '),
    withWhere: (where: string, message: string) => (where ? `${where}: ${message}` : message),
    notText: (field: string) => `${q(field)} muss Text sein.`,
    missing: (field: string) => `${q(field)} fehlt.`,
    notNumber: (field: string) => `${q(field)} muss eine Zahl sein.`,
    positionMissing: (field: string) => `${q(field)} (die Fußposition) fehlt.`,
    badFoot: '„foot“ muss „L“ oder „R“ sein.',
    partMissing: 'Die Schritte fehlen oder sind keine Liste.',
    noSteps: 'Es sind keine Schritte da.',
    stepsNotList: '„steps“ muss eine Liste sein.',
    tooManySteps: (count: number, max: number) => `${count} Schritte – erlaubt sind höchstens ${max}.`,
    notAStep: 'Das ist kein Schritt.',
    badKind: '„kind“ muss „step“, „tap“ oder „hold“ sein.',
    badBeats: '„beats“ (die Schrittlänge) muss größer als 0 sein.',
    notADance: 'Das sieht nicht nach einem Waltzy-Tanz aus.',
    noRoles: 'Das sieht nicht nach einem Waltzy-Tanz aus (es fehlen die Schritte).',
    empty: 'Füg zuerst einen Tanz ein.',
    noJson: 'Das ist kein Waltzy-Tanz. Ein geteilter Tanz ist ein Textblock, der mit { beginnt und mit } endet.',
    badJson: 'Dieser Text lässt sich nicht lesen. Vielleicht wurde er abgeschnitten oder verändert: Kopier den ganzen geteilten Text noch einmal, von { bis }.',
  },

  step: {
    describe: (s: StepInfo): string => {
      if (s.kind === 'hold') return 'Halten – Pause, kein Gewichtswechsel';
      const turn = withTurn(s.turn);
      if (s.kind === 'tap') {
        const where = s.motion === 'inPlace' ? 'am Platz' : s.motion === 'close' ? `neben dem ${ADJ[other(s.foot)]}` : at(s);
        return `${FOOT[s.foot]} tippt ${where} auf – ohne Gewicht${turn}`;
      }
      if (s.motion === 'inPlace') {
        return s.turn
          ? `${FOOT[s.foot]} übernimmt am Platz das Gewicht${turn}`
          : `Gewichtswechsel am Platz auf den ${ADJ[s.foot]} Fuß`;
      }
      if (s.motion === 'close') return `${FOOT[s.foot]} schließt zum ${ADJ[other(s.foot)]} Fuß${turn}`;
      return `${FOOT[s.foot]} geht ${goes(s)}${turn}`;
    },
    short: (s: StepInfo): string => {
      if (s.kind === 'hold') return 'Halten, kein Gewichtswechsel';
      const turn = withTurnShort(s.turn);
      if (s.kind === 'tap') {
        const where = s.motion === 'inPlace' ? 'am Platz ' : s.motion === 'close' ? '' : `${at(s)} `;
        return `Tippt ${where}auf${turn}`;
      }
      if (s.motion === 'inPlace') return s.turn ? `Am Platz${turn}` : 'Gewichtswechsel am Platz';
      if (s.motion === 'close') return `Schließt${turn}`;
      return `${goesShort(s)}${turn}`;
    },
  },

  spoken: (count: string) => {
    const c = count.trim().toLowerCase();
    if (c === '&' || c === 'and' || c === 'und') return 'und';
    if (c === 'a' || c === 'e') return c;
    return count.trim() || 'Schritt';
  },

  styles: ['Salsa', 'Bachata', 'Standard', 'Latein'],

  starters: {
    'builtin-waltz-box': {
      name: 'Langsamer Walzer – Karree mit Linksdrehung',
      style: 'Standard',
      description:
        'Zwei Takte Karree (der Grundschritt), dann das Karree mit einer Vierteldrehung nach links in jedem Takt: Nach vier Takten schaust du wieder in die Ausgangsrichtung. Wer führt, beginnt mit links vorwärts, wer folgt, mit rechts rückwärts. Auf 2 und 3 hebst du dich, am Ende von 3 senkst du dich wieder.',
      notes: {
        leader: {
          0: 'Karree: vorwärts, über die Ferse',
          1: 'Seitschritt, dabei heben',
          2: 'Schließen, am Ende senken',
          3: 'Rückwärts, über den Ballen',
          4: 'Seitschritt, dabei heben',
          5: 'Schließen, am Ende senken',
          6: 'Linksdrehung im Karree: Fußspitze nach außen, Vierteldrehung nach links über 1–3',
          7: 'Seitschritt: Die Vierteldrehung ist geschafft',
          9: 'Rückwärts, Fußspitze nach innen: die nächste Vierteldrehung nach links',
          11: 'Eine halbe Drehung ist geschafft',
          12: 'Fußspitze nach außen: dritte Vierteldrehung',
          15: 'Fußspitze nach innen: vierte Vierteldrehung',
          17: 'Eine ganze Drehung: weiter mit dem Karree',
        },
        follower: {
          0: 'Karree: rückwärts, über den Ballen',
          1: 'Seitschritt, dabei heben',
          2: 'Schließen, am Ende senken',
          3: 'Vorwärts, über die Ferse',
          4: 'Seitschritt, dabei heben',
          5: 'Schließen, am Ende senken',
          6: 'Linksdrehung im Karree: rückwärts, Fußspitze nach innen, Vierteldrehung nach links über 1–3',
          7: 'Seitschritt: Die Vierteldrehung ist geschafft',
          9: 'Vorwärts, Fußspitze nach außen: die nächste Vierteldrehung nach links',
          11: 'Eine halbe Drehung ist geschafft',
          12: 'Fußspitze nach innen: dritte Vierteldrehung',
          15: 'Fußspitze nach außen: vierte Vierteldrehung',
          17: 'Eine ganze Drehung: weiter mit dem Karree',
        },
      },
    },
    'builtin-chacha-basic': {
      name: 'Cha-Cha-Cha – Grundschritt & New Yorker',
      style: 'Latein',
      description:
        'Der Grundschritt: auf 2 und 3 ein Wiegeschritt, dann das Chassé „4 und 1“ – das „Cha-Cha-Cha“ – zur Seite. Danach der New Yorker zu beiden Seiten: Ihr dreht euch eine Vierteldrehung auseinander, macht den Wiegeschritt Seite an Seite und dreht euch zum Chassé wieder zueinander.',
      notes: {
        leader: {
          0: 'Grundschritt: Wiegeschritt nach vorne',
          1: 'Gewicht zurück auf rechts',
          2: 'Chassé nach links: Cha-Cha-Cha',
          5: 'Wiegeschritt zurück',
          6: 'Gewicht wieder auf links',
          7: 'Chassé nach rechts: Cha-Cha-Cha',
          10: 'New Yorker: auf dem rechten Fuß eine Vierteldrehung nach rechts, links vor – Seite an Seite',
          11: 'Gewicht zurück auf rechts, wieder zueinander drehen',
          12: 'Chassé nach links',
          15: 'New Yorker zur anderen Seite: auf dem linken Fuß eine Vierteldrehung nach links, rechts vor',
          16: 'Gewicht zurück auf links, wieder zueinander drehen',
          17: 'Chassé nach rechts',
        },
        follower: {
          0: 'Grundschritt: Wiegeschritt zurück',
          1: 'Gewicht wieder auf links',
          2: 'Chassé nach rechts: Cha-Cha-Cha',
          5: 'Wiegeschritt nach vorne',
          6: 'Gewicht zurück auf rechts',
          7: 'Chassé nach links: Cha-Cha-Cha',
          10: 'New Yorker: auf dem linken Fuß eine Vierteldrehung nach links, rechts vor – Seite an Seite',
          11: 'Gewicht zurück auf links, wieder zueinander drehen',
          12: 'Chassé nach rechts',
          15: 'New Yorker zur anderen Seite: auf dem rechten Fuß eine Vierteldrehung nach rechts, links vor',
          16: 'Gewicht zurück auf rechts, wieder zueinander drehen',
          17: 'Chassé nach links',
        },
      },
    },
    'builtin-salsa-basic': {
      name: 'Salsa On1 – Grundschritte & Rechtsdrehung',
      style: 'Salsa',
      description:
        'Drei Figuren hintereinander: der Grundschritt vor und zurück, der Seitschritt und dann der Grundschritt, bei dem sich, wer folgt, auf 5-6-7 nach rechts dreht. Getanzt wird auf 1-2-3 und 5-6-7, auf 4 und 8 ist Pause.',
      notes: {
        leader: {
          0: 'Grundschritt: Break nach vorne, das Gewicht ganz auf den linken Fuß',
          3: 'Pause: Das Gewicht bleibt links',
          4: 'Break nach hinten',
          7: 'Pause: Das Gewicht bleibt rechts',
          8: 'Seitschritt: links zur Seite',
          9: 'Gewicht zurück auf rechts',
          12: 'Rechts zur Seite',
          16: 'Grundschritt – diesmal führst du eine Rechtsdrehung',
          20: 'Auf 5-6-7 dreht sich, wer folgt, unter deiner erhobenen linken Hand nach rechts – du tanzt den Grundschritt',
        },
        follower: {
          0: 'Grundschritt: Break nach hinten, das Gewicht ganz auf den rechten Fuß',
          3: 'Pause: Das Gewicht bleibt rechts',
          4: 'Break nach vorne',
          7: 'Pause: Das Gewicht bleibt links',
          8: 'Seitschritt: rechts zur Seite',
          9: 'Gewicht zurück auf links',
          12: 'Links zur Seite',
          16: 'Grundschritt',
          20: 'Rechtsdrehung: bis hierher wie im Grundschritt',
          21: 'Eine halbe Drehung nach rechts, während der rechte Fuß das Gewicht übernimmt',
          22: 'Die zweite halbe Drehung, der linke Fuß schließt: Du schaust wieder nach vorne',
        },
      },
    },
    'builtin-bachata-basic': {
      name: 'Bachata – Grundschritt & Linksdrehung',
      style: 'Bachata',
      description:
        'Der seitliche Grundschritt: drei Schritte zur Seite, auf 4 und 8 ein Tap ohne Gewicht, dann in die andere Richtung. Beim zweiten Mal dreht sich, wer folgt, auf 5-6-7 einmal ganz nach links und wandert dabei mit dem Grundschritt mit.',
      notes: {
        leader: {
          0: 'Grundschritt seitlich: links zur Seite',
          3: 'Tap ohne Gewicht, gern mit einer kleinen Hüftbewegung',
          4: 'Richtungswechsel: jetzt nach rechts',
          7: 'Tap ohne Gewicht',
          8: 'Grundschritt: Auf 1-4 bereitest du die Drehung vor',
          12: 'Auf 5-6-7 führst du die Linksdrehung – du selbst tanzt den Grundschritt',
        },
        follower: {
          0: 'Grundschritt seitlich: rechts zur Seite',
          3: 'Tap ohne Gewicht, gern mit einer kleinen Hüftbewegung',
          4: 'Richtungswechsel: jetzt nach links',
          7: 'Tap ohne Gewicht',
          8: 'Grundschritt',
          12: 'Linksdrehung: auf dem rechten Fuß eine Vierteldrehung nach links, links weiter',
          13: 'Eine halbe Drehung weiter nach links, der rechte Fuß folgt',
          14: 'Die letzte Vierteldrehung: Du schaust wieder nach vorne',
          15: 'Tap ohne Gewicht',
        },
      },
    },
  },

  tabs: {
    library: 'Tänze',
    classes: 'Kurse',
    me: 'Profil',
    classesTitle: 'Kurse',
    classesSoonTitle: 'Lern mit deinem Tanzkurs',
    classesSoonBody: 'Bald kann deine Tanzlehrerin oder dein Tanzlehrer hier die Schritte jeder Stunde teilen – du trittst einfach über einen Link bei.',
  },

  account: {
    title: 'Profil',
    pitchTitle: 'Sichere deine Tänze und teile sie mit einem Link',
    pitchBody: 'Melde dich mit deiner E-Mail-Adresse an. Ein Passwort brauchst du nicht: Wir schicken dir einen Code.',
    signIn: 'Anmelden',
    sectionAccount: 'Konto',
    sectionBackup: 'Sicherung',
    sectionApp: 'App',
    name: 'Name',
    noName: 'Noch kein Name',
    editName: 'Name ändern',
    email: 'E-Mail',
    language: 'Sprache',
    lesson: 'So liest du die Fußabdrücke',
    terms: 'Nutzungsbedingungen',
    privacy: 'Datenschutz',
    version: (v: string) => `Version ${v}`,
    signOut: 'Abmelden',
    signOutTitle: 'Abmelden?',
    signOutMessage: 'Deine Tänze bleiben auf diesem Gerät. Melde dich jederzeit wieder an, um sie zu sichern.',
    signedOut: 'Abgemeldet. Deine Tänze sind noch da.',
    deleteAccount: 'Konto löschen',
    deleteHint: 'Löscht deine Sicherung, geteilte Links und deine Kurse',
    deleteTitle: 'Konto löschen?',
    deleteMessage:
      'Damit löschst du dein Konto und alles, was dazu gespeichert ist: die Sicherung deiner Tänze, die Links, die du geteilt hast, und deine Kurse. Das lässt sich nicht rückgängig machen. Die Tänze auf diesem Gerät bleiben hier.',
    deleteConfirm: 'Mein Konto löschen',
    deleted: 'Dein Konto ist gelöscht. Deine Tänze sind noch auf diesem Gerät.',
    signInTitle: 'Anmelden',
    emailTitle: 'Wie lautet deine E-Mail-Adresse?',
    emailBody: 'Wir schicken dir einen 6-stelligen Code. Ein Passwort brauchst du nicht.',
    emailLabel: 'E-Mail-Adresse',
    emailPlaceholder: 'du@beispiel.at',
    badEmail: 'Das sieht nicht nach einer E-Mail-Adresse aus. Schau sie dir noch einmal an.',
    sendCode: 'Code schicken',
    codeTitle: 'Schau in dein Postfach',
    codeBody: (email: string) => `Wir haben einen 6-stelligen Code an ${email} geschickt. Gib ihn hier ein.`,
    codeLabel: '6-stelliger Code',
    codeHint: 'Nichts angekommen? Schau auch im Spam-Ordner nach.',
    resendIn: (s: number) => `Neuer Code in ${s} s`,
    resend: 'Neuen Code schicken',
    resent: 'Neuer Code ist unterwegs',
    otherEmail: 'Andere E-Mail-Adresse',
    nameTitle: 'Wie heißt du?',
    nameBody: 'Diesen Namen sehen andere bei Tänzen, die du teilst.',
    nameLabel: 'Dein Name',
    namePlaceholder: 'Vorname oder Spitzname',
    nameEmpty: 'Gib zuerst einen Namen ein.',
    continue: 'Weiter',
    saveName: 'Speichern',
    nameSaved: 'Name gespeichert',
    welcome: (name: string) => `Angemeldet als ${name}`,
    legalLine: 'Wenn du fortfährst, stimmst du den {terms} und der {privacy} zu.',
    legalTerms: 'Nutzungsbedingungen',
    legalPrivacy: 'Datenschutzerklärung',
  },

  sync: {
    explain: 'Deine Tänze sind auf diesem Gerät gespeichert und in deinem Konto gesichert – so hast du sie auch auf deinen anderen Geräten.',
    syncing: 'Wird gesichert …',
    never: 'Noch nicht gesichert',
    justNow: 'Gerade eben gesichert',
    minutesAgo: (n: number) => `Vor ${pl(n, { one: '# Minute', other: '# Minuten' })} gesichert`,
    at: (when: string) => `Letzte Sicherung: ${when}`,
    error: 'Sicherung pausiert',
    retryHint: 'Wir versuchen es von selbst wieder. Deine Tänze sind auf diesem Gerät sicher.',
    now: 'Jetzt sichern',
  },

  legal: {
    updated: (date: string) => `Stand: ${date}`,
    operator: (name: string) => `Waltzy wird betrieben von ${name}.`,
    contact: (email: string) => `Kontakt: ${email}`,
    terms: {
      title: 'Nutzungsbedingungen',
      sections: [
        {
          heading: 'Kurz gesagt',
          body: 'Waltzy funktioniert auf deinem Gerät ohne Konto. Diese Bedingungen gelten, wenn du dich anmeldest: um deine Tänze zu sichern, sie mit einem Link zu teilen oder einen Kurs zu leiten.',
        },
        {
          heading: 'Dein Konto',
          body: 'Du meldest dich mit deiner E-Mail-Adresse und einem Einmal-Code an. Dein Name ist bei Tänzen zu sehen, die du teilst, und bei Kursen, die du leitest. Pass gut auf dein E-Mail-Postfach auf: Wer es lesen kann, kann sich als du anmelden.',
        },
        {
          heading: 'Was du teilst',
          body: 'Einen Tanz, den du mit einem Link teilst, kann jede Person sehen und speichern, die den Link hat. Einen Kurs sieht jede Person mit dem Kurs-Link. Teile nur, was du selbst gemacht hast oder teilen darfst.',
        },
        {
          heading: 'Keine Toleranz für anstößige Inhalte',
          body: 'Teile nichts Beleidigendes, Hasserfülltes, Sexuelles, Gewalttätiges, Belästigendes oder Irreführendes, keinen Spam und nichts, was gegen Gesetze oder die Rechte anderer verstößt. Melde solche Inhalte in der App. Wir entfernen Inhalte, die gegen diese Regeln verstoßen, und schließen die Konten, die sie teilen.',
        },
        {
          heading: 'Konto löschen',
          body: 'Tippe im Bereich „Ich“ auf „Konto löschen“. Damit löschst du deine Sicherung, deine geteilten Links und deine Kurse. Deine Tänze bleiben auf deinem Gerät.',
        },
        {
          heading: 'Keine Garantie',
          body: 'Waltzy wird so bereitgestellt, wie es ist. Wir passen gut auf deine Sicherung auf, können aber nicht versprechen, dass der Dienst immer erreichbar ist. Wir können diese Bedingungen ändern; wenn sich Wichtiges ändert, sagen wir es dir in der App.',
        },
      ],
    },
    privacy: {
      title: 'Datenschutzerklärung',
      sections: [
        {
          heading: 'Kurz gesagt',
          body: 'Ohne Konto bleibt alles auf deinem Gerät, und Waltzy schickt nichts weg. Wenn du dich anmeldest, speichern wir nur, was die Funktionen brauchen. Keine Werbung, kein Tracking.',
        },
        {
          heading: 'Was wir speichern',
          body: 'Deine E-Mail-Adresse (für die Anmeldung), deinen Namen, die Tänze, die du sicherst, die Tänze, die du mit einem Link teilst, die Kurse, die du leitest oder besuchst, samt ihren Beiträgen, und Meldungen, die du schickst.',
        },
        {
          heading: 'Wo',
          body: 'Bei unserem Hosting-Anbieter Supabase, auf Servern in der EU (Frankfurt, Deutschland). Anmelde-Codes werden per E-Mail verschickt.',
        },
        {
          heading: 'Wer es sieht',
          body: 'Deine Sicherung: nur du. Ein geteilter Tanz: jede Person mit dem Link, zusammen mit deinem Namen. Ein Kurs: jede Person mit dem Kurs-Link, zusammen mit dem Namen der Kursleitung.',
        },
        {
          heading: 'Wozu',
          body: 'Nur für das, worum du gebeten hast (Anmeldung, Sicherung, Teilen und Kurse), und um Meldungen zu bearbeiten.',
        },
        {
          heading: 'Wie lange',
          body: 'Bis du es oder dein Konto löschst. Wenn du dein Konto löschst („Ich“ → „Konto löschen“), wird alles gelöscht. Meldungen bewahren wir so lange auf, wie wir sie zum Bearbeiten brauchen.',
        },
        {
          heading: 'Deine Rechte',
          body: 'Du kannst deine Daten in der App ansehen, ändern und löschen. Du kannst uns auch fragen, was wir über dich speichern, und dich bei einer Datenschutzbehörde beschweren.',
        },
      ],
    },
  },

  cloud: {
    errors: {
      offline: 'Keine Verbindung. Prüf dein Internet und versuch es noch einmal.',
      notSignedIn: 'Du bist abgemeldet. Bitte melde dich wieder an.',
      invalidCode: 'Der Code stimmt nicht oder ist abgelaufen. Prüf ihn oder lass dir einen neuen schicken.',
      rateLimited: 'Zu viele Versuche. Warte bitte eine Minute und versuch es dann noch einmal.',
      limit: 'Hier ist das Limit erreicht. Lösch zuerst etwas und versuch es dann noch einmal.',
      notFound: 'Das gibt es nicht mehr.',
      unknown: 'Da ist etwas schiefgelaufen. Bitte versuch es noch einmal.',
    },
    retry: 'Noch einmal versuchen',
  },
};
