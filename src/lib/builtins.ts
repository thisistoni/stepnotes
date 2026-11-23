import type { StarterId, Strings } from './i18n/en';
import { mirrorPattern, normAngle, toPartner } from './pattern';
import type { Dance, Foot, FootPos, Pattern, Step, StepKind } from './types';

/**
 * The starter dances: short practice routines of named beginner figures, in the order a first
 * course teaches them. Every routine ends with the feet where they started (same places, same
 * facing, weight on the same foot), so the player's loop runs on without a jump.
 *
 * Researched, not remembered: the sources for each figure are listed next to it, with what they
 * disagree on. Where sources differ, the conservative textbook version is used. Footprint
 * distances are illustrative (one unit ≈ one foot width); the direction, foot, count and amount of
 * turn are what the sources describe. A dance teacher should still have the last word.
 *
 * Compact step notation: [count, foot, x, y, kind?, beats?, rot?, pivot?]
 *   rot   – where the toes point after the step (0 = up the screen, + = clockwise)
 *   pivot – how far the weight-bearing foot swivels during the step (see `Step.pivot`)
 */
type S = [string, Foot, number, number, StepKind?, number?, number?, number?];

const r1 = (n: number) => Math.round(n * 100) / 100;

function step([count, foot, x, y, kind = 'step', beats = 1, rot = 0, pivot]: S, id: string): Step {
  const s: Step = { id, count, foot, kind, beats, to: { x: r1(x), y: r1(y), rot: normAngle(Math.round(rot)) } };
  if (pivot) s.pivot = pivot;
  return s;
}

function pattern(steps: S[], start: Record<Foot, FootPos>): Pattern {
  return { start, steps: steps.map((st, i) => step(st, `s${i}`)) };
}

/** The partner's part in closed position (natural opposite), with stable step ids. */
function partner(p: Pattern): Pattern {
  const q = toPartner(p);
  return { ...q, steps: q.steps.map((s, i) => ({ ...s, id: `f${i}` })) };
}

/** `p` with the steps from index `from` on replaced by `steps` (ids kept). */
function replaceSteps(p: Pattern, from: number, steps: Step[]): Pattern {
  return { ...p, steps: p.steps.map((s, i) => (i >= from && i < from + steps.length ? { ...steps[i - from], id: s.id } : s)) };
}

const apart = (w: number): Record<Foot, FootPos> => ({ L: { x: -w / 2, y: 0, rot: 0 }, R: { x: w / 2, y: 0, rot: 0 } });

/** Choreography only: names, styles, descriptions and notes come from the dictionaries. */
function dance(id: StarterId, bpm: number, beatsPerBar: number, leader: Pattern, follower: Pattern): Dance {
  return {
    id,
    name: '',
    style: '',
    description: '',
    bpm,
    beatsPerBar,
    roles: { leader, follower },
    builtIn: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

// ================================================================================================
// Langsamer Walzer (Slow Waltz): Grundschritt (Karree) + Linksdrehung im Karree. 6 bars, 3/4.
//
// Bars 1–2  Grundschritt / Karree (box step), leader: LF forward, RF side, LF closes; RF back,
//           LF side, RF closes. Follower: the natural opposite (RF back, LF side, RF closes; LF
//           forward, RF side, LF closes).
//           Sources: https://en.wikipedia.org/wiki/Box_step ·
//           https://www.ballroompages.com/dance-styles/waltz/box-step/ ·
//           https://doodance.com/ressourcen/langsamer-walzer-schritte-figuren-lieder
// Bars 3–6  The same box turned a quarter to the left in every bar (left box turn / "Linkskarree",
//           American-style "Left Box Turn"): 1 LF forward with the toe turned out, the quarter turn
//           is completed over 1–3; 4 RF back with the toe turned in, another quarter over 4–6. Four
//           bars = one full turn, so the routine ends facing where it began. Follower: natural
//           opposite (RF back toe in, LF side, RF closes; LF forward toe out …), both turn left.
//           Sources: https://www.ballroomdancers.com/dances/info.asp?sid=107 (Left Box (Reverse) Turn) ·
//           https://ncstate.pressbooks.pub/socialdance/?p=45 (half box turn: lead "L forward, toe out,
//           ¼ turn", "R backward, toe in, ¼ turn"; follow "back on the right foot, toe turned in, ¼ turn") ·
//           https://dancilla.com/wiki/index.php?title=Langsamer_Walzer (Linksdrehung starts with LF forward) ·
//           https://ao-dance.com/youtube/langsamer-walzer/ (lists "Linksdrehung und Linkskarree")
// Doubts for a teacher: how the quarter is split between the steps varies by source (we turn the
//   toes 45° on 1 / 4 and finish the quarter on 2 / 5). The international (ISTD) Linksdrehung /
//   Reverse Turn is a different, travelling figure (3/8 per half); this is the box version a first
//   course uses. Rise and fall in the notes follows the usual "rise end of 1, up on 2–3, lower end of 3".
// ================================================================================================

const BOX_FWD = 3.4; // length of the forward / back step
const BOX_SIDE = 3; // side step (wide enough that turned prints never overlap; closed feet are 1.2 apart)

/** A dancer's frame: where the middle between the feet is and which way they face. */
interface Frame {
  x: number;
  y: number;
  h: number;
}
/** Local (x = right, y = back) in frame `f` → screen. */
function at(f: Frame, lx: number, ly: number) {
  const r = (f.h * Math.PI) / 180;
  return { x: f.x + lx * Math.cos(r) - ly * Math.sin(r), y: f.y + lx * Math.sin(r) + ly * Math.cos(r) };
}
/** The frame whose point (lx, ly) is at screen point p, facing h. */
function frameWith(p: { x: number; y: number }, lx: number, ly: number, h: number): Frame {
  const o = at({ x: 0, y: 0, h }, lx, ly);
  return { x: p.x - o.x, y: p.y - o.y, h };
}

/**
 * Half a box (3 steps) from a closed position in frame `f`, turning `turn` degrees (0 or -90).
 * forward half: LF forward, RF side, LF closes · back half: RF back, LF side, RF closes.
 */
function halfBox(f: Frame, forward: boolean, turn: number, counts: string[]): { steps: S[]; end: Frame } {
  const toe = turn / 2; // the moving foot's toes lead the turn on the first step
  if (forward) {
    const a = at(f, -0.6, -BOX_FWD);
    const g = frameWith(a, -0.6, 0, f.h + turn); // turn around the left foot
    const b = at(g, -0.6 + BOX_SIDE, 0);
    const c = at(g, -0.6 + BOX_SIDE - 1.2, 0); // closes 1.2 left of the right foot
    return {
      steps: [
        [counts[0], 'L', a.x, a.y, 'step', 1, f.h + toe],
        [counts[1], 'R', b.x, b.y, 'step', 1, g.h],
        [counts[2], 'L', c.x, c.y, 'step', 1, g.h],
      ],
      end: frameWith(c, -0.6, 0, g.h),
    };
  }
  const a = at(f, 0.6, BOX_FWD);
  const g = frameWith(a, 0.6, 0, f.h + turn); // turn around the right foot
  const b = at(g, 0.6 - BOX_SIDE, 0);
  const c = at(g, 0.6 - BOX_SIDE + 1.2, 0); // closes 1.2 right of the left foot
  return {
    steps: [
      [counts[0], 'R', a.x, a.y, 'step', 1, f.h + toe],
      [counts[1], 'L', b.x, b.y, 'step', 1, g.h],
      [counts[2], 'R', c.x, c.y, 'step', 1, g.h],
    ],
    end: frameWith(c, 0.6, 0, g.h),
  };
}

const waltz = (() => {
  const out: S[] = [];
  let f: Frame = { x: 0, y: 0, h: 0 };
  // 2 bars plain box, then 4 bars turning a quarter left per bar
  const plan: [boolean, number][] = [
    [true, 0],
    [false, 0],
    [true, -90],
    [false, -90],
    [true, -90],
    [false, -90],
  ];
  for (const [fwd, turn] of plan) {
    const h = halfBox(f, fwd, turn, ['1', '2', '3']);
    out.push(...h.steps);
    f = h.end;
  }
  return pattern(out, apart(1.2));
})();
const waltzFollower = partner(waltz);

// ================================================================================================
// Cha-Cha-Cha: Grundschritt + New Yorker (Promenade) to both sides. 4 bars, counted 2 3 4 & 1.
//
// Bars 1–2  Grundschritt (closed basic), leader: 2 LF forward (rock), 3 weight back to RF,
//           4 & 1 chassé to the left (LF side, RF closes, LF side); 2 RF back, 3 weight forward to
//           LF, 4 & 1 chassé to the right. Follower: natural opposite (starts RF back).
//           Sources: https://home.csulb.edu/~kwest/wido/latins/cha-notes-general.pdf (rock on 2–3,
//           chassé 4&1, forward rock with the LF) · https://www.dancecentral.info/ballroom/international-style/cha-cha-cha/cha-cha-basic ·
//           https://de.wikibooks.org/wiki/Tanzen:_Cha-Cha-Cha
// Bars 3–4  New Yorker (Promenade, Welttanzprogramm I) to the right, then to the left. Leader:
//           turn ¼ to the right on the RF and step LF forward (check) beside the follower, 3 weight
//           back to the RF turning back to face her, 4&1 chassé to the left; then the same to the
//           other side (¼ left on the LF, RF forward, chassé to the right). Follower: the mirror
//           image, NOT the leader's turn: she turns ¼ LEFT and steps RF forward, then ¼ right and LF.
//           Sources: http://www.cs.utah.edu/~luke/ubdc/Club/ChaChaStepList.html ("Turn 1/4 turn to R,
//           step forward LF | Turn 1/4 turn to L, step forward RF"; replace with ¼ back) ·
//           https://www.dancecentral.info/ballroom/international-style/cha-cha-cha/new-york ·
//           https://danceflowfortmyers.com/cha-cha-new-yorker/ (check on 2, replace 3, cha-cha-cha 4&1;
//           leader rotates on the right foot, follower on the left) ·
//           https://www.tanzschule-wollgast.de/fileadmin/kunden/wollgast/kundenbereich/tanzprogrammA.pdf
//           (Welttanzprogramm I: Grundschritt, Promenade (New Yorker), …)
// Doubts for a teacher: Dance Central gives the leader only 1/8 turn on the check step (the body
//   turns further); we use the ¼ most beginner sources give. The turn back to the partner is shown
//   on count 3; ISTD spreads it over 3 and the chassé.
// ================================================================================================

const CHA: S[] = [
  // bar 1 – Grundschritt, forward half
  ['2', 'L', -1.2, -3],
  ['3', 'R', 1.2, 0],
  ['4', 'L', -2.4, 0, 'step', 0.5],
  ['&', 'R', -1.2, 0, 'step', 0.5],
  ['1', 'L', -3.6, 0],
  // bar 2 – Grundschritt, back half
  ['2', 'R', -1.2, 3],
  ['3', 'L', -3.6, 0],
  ['4', 'R', 0, 0, 'step', 0.5],
  ['&', 'L', -1.2, 0, 'step', 0.5],
  ['1', 'R', 1.2, 0],
  // bar 3 – New Yorker to the right: ¼ right on the RF, LF forward (check)
  ['2', 'L', 3.6, -1, 'step', 1, 90, 90],
  ['3', 'R', 1.2, 0, 'step', 1, 0],
  ['4', 'L', -1.2, 0, 'step', 0.5],
  ['&', 'R', 0, 0, 'step', 0.5],
  ['1', 'L', -2.4, 0],
  // bar 4 – New Yorker to the left: ¼ left on the LF, RF forward (check)
  ['2', 'R', -4.8, -1, 'step', 1, -90, -90],
  ['3', 'L', -2.4, 0, 'step', 1, 0],
  ['4', 'R', 0, 0, 'step', 0.5],
  ['&', 'L', -1.2, 0, 'step', 0.5],
  ['1', 'R', 1.2, 0],
];
const chaCha = pattern(CHA, apart(2.4));
// follower: natural opposite in the basic, mirror image in the New Yorker (she turns the other way)
const chaChaFollower = replaceSteps(partner(chaCha), 10, mirrorPattern(pattern(CHA.slice(10), apart(2.4))).steps);

// ================================================================================================
// Salsa On1 (LA style): Grundschritt vor/zurück, Seitschritt, Rechtsdrehung der Dame. 6 bars, 4/4,
// counted 1 2 3 (4) 5 6 7 (8): steps on 1-2-3 and 5-6-7, pause on 4 and 8.
//
// Bars 1–2  Grundschritt (forward / back basic): leader breaks forward with the LF on 1, back with
//           the RF on 5; follower the opposite (RF back on 1, LF forward on 5).
//           Sources: https://www.ballroompages.com/dance-styles/salsa/ (On1 table: count 1 leader
//           "Left forward, break", follower "Right back, break") ·
//           https://medium.com/@salsahandbook/salsa-dance-styles-8a2a70b14c73
// Bars 3–4  Seitschritt (side basic): side on 1, weight back in place on 2, close on 3; the same to
//           the other side on 5-6-7. Follower mirrors (starts RF to her right).
//           Sources: https://thedancedojo.com/blog/how-salsa-music-is-counted/ · https://www.salsavida.com/?p=568
// Bars 5–6  Grundschritt with the follower's right turn (outside turn) on 5-6-7: up to 5 she dances
//           the basic (LF forward), on 6 she turns half to the right as the RF takes the weight, on
//           7 she completes the turn as the LF closes. The leader dances the basic and leads the turn
//           with his left hand.
//           Sources: https://www.salsaforums.com/threads/question-about-right-turns-when-dancing-on1.25891/
//           ("on 6 (half) and 7 (other half)"; "Lady makes 1/2 CW turn as she replaces on 6 her right foot") ·
//           https://www.salsa-online-academy.com/mitglieder-und-loginbereich/practise-salsa-solo-at-home/on-1/frau/einfache-rechtsdrehung-erklaerung/
//           (up to 5 like the basic, the turn ends when the LF closes) · https://danceflowfortmyers.com/salsa-right-turn/
// Doubts for a teacher: some schools already turn ¼ on 5 (http://www.salsa-cocktails.de/basisstufe.html);
//   the cue of the leader's left hand is taught on 1-3 by some (Wikibooks) and on 5 by others. The
//   footprints show the basic's places; in a real turn the steps stay small, under the body.
//   We left out the Cross Body Lead: the sources disagree on the leader's first break and his turn.
// ================================================================================================

const SALSA_BASIC: S[] = [
  ['1', 'L', -0.6, -3],
  ['2', 'R', 0.6, 0],
  ['3', 'L', -0.6, 0],
  ['4', 'L', -0.6, 0, 'hold'],
  ['5', 'R', 0.6, 3],
  ['6', 'L', -0.6, 0],
  ['7', 'R', 0.6, 0],
  ['8', 'R', 0.6, 0, 'hold'],
];
const SALSA_SIDE: S[] = [
  ['1', 'L', -3, 0],
  ['2', 'R', 0.6, 0],
  ['3', 'L', -0.6, 0],
  ['4', 'L', -0.6, 0, 'hold'],
  ['5', 'R', 3, 0],
  ['6', 'L', -0.6, 0],
  ['7', 'R', 0.6, 0],
  ['8', 'R', 0.6, 0, 'hold'],
];
const salsa = pattern([...SALSA_BASIC, ...SALSA_SIDE, ...SALSA_BASIC], apart(1.2));
// follower: natural opposite; in bar 6 her right turn (her steps 5, 6, 7 = indices 20–22)
const salsaFollower = replaceSteps(partner(salsa), 20, [
  step(['5', 'L', -0.6, -3], ''),
  step(['6', 'R', 0.6, 0, 'step', 1, 180, 180], ''),
  step(['7', 'L', -0.6, 0, 'step', 1, 0, 180], ''),
]);

// ================================================================================================
// Bachata: Grundschritt seitlich + Linksdrehung der Dame. 4 bars, 4/4, counted 1 2 3 tap, 5 6 7 tap.
//
// Bars 1–2  Grundschritt seitlich (side basic): leader LF side, RF closes, LF side, tap RF (no
//           weight, often with a hip action); then RF side, LF closes, RF side, tap LF. Follower
//           starts with the RF to her right.
//           Sources: https://torontodancesalsa.ca/blog/dancing-bachata-for-beginners-2/ ·
//           https://www.ballroompages.com/dance-styles/bachata/ · https://www.wirliebentanzen.at/taenze/bachata/
// Bars 3–4  The same basic with the follower's left (inside) turn on 5-6-7, travelling the way the
//           basic goes, tap on 8; the leader prepares on 1-4 ("C prep" with his left hand) and turns
//           her on 5-8 while he dances the basic. Her turn: a full turn to the left over the three
//           steps (¼, ½, ¼), each step turning on the foot that carries the weight.
//           Sources: https://torontodancesalsa.ca/blog/dancing-bachata-for-beginners-2/ ("turn the follow
//           to the left: 5, 6, 7, tap on 8"; C prep on 1-4) · https://danceflowfortmyers.com/bachata-inside-turn/
//           ("the turn goes left on beats 5, 6, and 7") · https://www.libraryofdance.org/dances/Bachata.pdf
// Doubts for a teacher: no source we found splits the turn between the three steps; ¼-½-¼ is our
//   reading. The footprints show the basic's places; in a real turn the steps are smaller.
//   Forward/back basic left out: sources disagree (forward-close-forward-tap vs. a rock step).
// ================================================================================================

const BACHATA_BASIC: S[] = [
  ['1', 'L', -3, 0],
  ['2', 'R', -1.8, 0],
  ['3', 'L', -5.4, 0],
  ['4', 'R', -4.2, 0, 'tap'],
  ['5', 'R', -1.8, 0],
  ['6', 'L', -3, 0],
  ['7', 'R', 0.6, 0],
  ['8', 'L', -0.6, 0, 'tap'],
];
const bachata = pattern([...BACHATA_BASIC, ...BACHATA_BASIC], apart(1.2));
// follower: natural opposite; in bar 4 her left turn (her steps 5, 6, 7 = indices 12–14)
// (5 LF forward facing the way she travels, 6 RF passes her with its back to the way she travels and
// to her right side, 7 LF side, facing front again; spread out so no two footprints overlap)
const bachataFollower = replaceSteps(partner(bachata), 12, [
  step(['5', 'L', 2.2, 0, 'step', 1, -90, -90], ''),
  step(['6', 'R', 0.9, 1.9, 'step', 1, 90, -180], ''),
  step(['7', 'L', -0.6, 0, 'step', 1, 0, -90], ''),
]);

/** The starter dances without their texts (ids, tempo and steps never change with the language). */
const BASE: Dance[] = [
  dance('builtin-waltz-box', 84, 3, waltz, waltzFollower),
  dance('builtin-chacha-basic', 120, 4, chaCha, chaChaFollower),
  dance('builtin-salsa-basic', 180, 4, salsa, salsaFollower),
  dance('builtin-bachata-basic', 128, 4, bachata, bachataFollower),
];

export const BUILT_IN_IDS: ReadonlySet<string> = new Set(BASE.map((d) => d.id));

const cache = new WeakMap<Strings, Dance[]>();

/**
 * The starter dances in one language: name, style, description and step notes from `t.starters`;
 * ids and choreography identical in every language. Cached per dictionary (stable identities).
 */
export function builtInDances(t: Strings): Dance[] {
  const hit = cache.get(t);
  if (hit) return hit;
  const withNotes = (p: Pattern, notes: Partial<Record<number, string>>): Pattern => ({
    ...p,
    steps: p.steps.map((st, i) => {
      const note = notes[i];
      return note ? { ...st, note } : st;
    }),
  });
  const out = BASE.map((d): Dance => {
    const text = t.starters[d.id as StarterId];
    const roles: Dance['roles'] = { leader: withNotes(d.roles.leader, text.notes.leader) };
    if (d.roles.follower) roles.follower = withNotes(d.roles.follower, text.notes.follower);
    return { ...d, name: text.name, style: text.style, description: text.description, roles };
  });
  cache.set(t, out);
  return out;
}
