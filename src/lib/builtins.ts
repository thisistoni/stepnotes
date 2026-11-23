import type { StarterId, Strings } from './i18n/en';
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

/** Choreography only: names, styles, descriptions and notes come from the dictionaries. */
function dance(id: StarterId, bpm: number, beatsPerBar: number, leader: Pattern): Dance {
  return {
    id,
    name: '',
    style: '',
    description: '',
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

/** The starter dances without their texts (ids, tempo and steps never change with the language). */
const BASE: Dance[] = [
  dance('builtin-salsa-basic', 180, 4, salsa),
  dance('builtin-bachata-basic', 128, 4, bachata),
  dance('builtin-waltz-box', 84, 3, waltzBox),
  dance('builtin-chacha-basic', 120, 4, chaCha),
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
