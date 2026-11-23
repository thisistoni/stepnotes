import { DEFAULT_START, toPartner } from './pattern';
import type { Dance, Foot, Pattern, Step, StepKind } from './types';

/**
 * Compact step notation: [count, foot, x, y, kind?, beats?, rot?]
 * NOTE: these starter patterns are simplified textbook basics. Have a dance teacher
 * double-check them before shipping.
 */
type S = [string, Foot, number, number, StepKind?, number?, number?];

function pattern(steps: S[], start = DEFAULT_START): Pattern {
  return {
    start,
    steps: steps.map(([count, foot, x, y, kind = 'step', beats = 1, rot = 0], i): Step => ({
      id: `s${i}`,
      count,
      foot,
      kind,
      beats,
      to: { x, y, rot },
    })),
  };
}

function dance(
  id: string,
  name: string,
  style: string,
  description: string,
  bpm: number,
  beatsPerBar: number,
  leader: Pattern,
): Dance {
  return {
    id,
    name,
    style,
    description,
    bpm,
    beatsPerBar,
    roles: { leader, follower: toPartner(leader) },
    builtIn: true,
    createdAt: 0,
    updatedAt: 0,
  };
}

// Positions sit on a 1.2-unit grid (one foot width + a gap) so footprints never overlap in the chart.
const salsa = pattern([
  ['1', 'L', -0.6, -3.4],
  ['2', 'R', 0.6, 0],
  ['3', 'L', -0.6, 0],
  ['4', 'L', -0.6, 0, 'hold'],
  ['5', 'R', 0.6, 3.4],
  ['6', 'L', -0.6, 0],
  ['7', 'R', 0.6, 0],
  ['8', 'R', 0.6, 0, 'hold'],
]);

const bachata = pattern([
  ['1', 'L', -3.0, 0],
  ['2', 'R', -1.8, 0],
  ['3', 'L', -5.4, 0],
  ['4', 'R', -4.2, 0, 'tap'],
  ['5', 'R', -1.8, 0],
  ['6', 'L', -3.0, 0],
  ['7', 'R', 0.6, 0],
  ['8', 'L', -0.6, 0, 'tap'],
]);

const waltzBox = pattern([
  ['1', 'L', -0.6, -3.6],
  ['2', 'R', 1.8, -3.6],
  ['3', 'L', 0.6, -3.6],
  ['4', 'R', 1.8, 0],
  ['5', 'L', -0.6, 0],
  ['6', 'R', 0.6, 0],
]);

const chaCha = pattern(
  [
    ['2', 'L', -1.2, -3.4],
    ['3', 'R', 1.2, 0],
    ['4', 'L', -3.6, 0],
    ['&', 'R', -2.4, 0, 'step', 0.5],
    ['1', 'L', -4.8, 0, 'step', 0.5],
    ['2', 'R', -2.4, 3.4],
    ['3', 'L', -4.8, 0],
    ['4', 'R', 0, 0],
    ['&', 'L', -1.2, 0, 'step', 0.5],
    ['1', 'R', 1.2, 0, 'step', 0.5],
  ],
  { L: { x: -1.2, y: 0, rot: 0 }, R: { x: 1.2, y: 0, rot: 0 } },
);

export const BUILT_IN_DANCES: Dance[] = [
  dance(
    'builtin-salsa-basic',
    'Salsa Basic (On1)',
    'Salsa',
    'Forward and back basic. Break forward on 1 with the left foot, pause on 4 and 8.',
    180,
    4,
    salsa,
  ),
  dance(
    'builtin-bachata-basic',
    'Bachata Side Basic',
    'Bachata',
    'Three steps to the side and a tap (often with a hip pop) on 4 and 8.',
    128,
    4,
    bachata,
  ),
  dance(
    'builtin-waltz-box',
    'Waltz Box Step',
    'Ballroom',
    'The classic box: forward–side–close, back–side–close. Rise and fall on 2 and 3.',
    84,
    3,
    waltzBox,
  ),
  dance(
    'builtin-chacha-basic',
    'Cha-Cha Basic',
    'Latin',
    'Rock step on 2–3, then the chassé "4 & 1" (cha-cha-cha) to the side.',
    120,
    4,
    chaCha,
  ),
];
