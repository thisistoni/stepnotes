import type { Foot, FootPos, Pattern, Step } from './types';

export const FOOT_LENGTH = 2.6;
export const FOOT_WIDTH = 1;

export const otherFoot = (f: Foot): Foot => (f === 'L' ? 'R' : 'L');

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function samePos(a: FootPos, b: FootPos, eps = 0.05) {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
}

export interface FeetState {
  pos: Record<Foot, FootPos>;
  /** Which foot carries the weight (null = both / unknown). */
  weight: Foot | null;
}

/**
 * Returns the state of the feet AFTER each step.
 * states[0] is the start position, states[i + 1] is after steps[i].
 */
export function computeStates(pattern: Pattern): FeetState[] {
  const states: FeetState[] = [{ pos: { ...pattern.start }, weight: null }];
  for (const step of pattern.steps) {
    const prev = states[states.length - 1];
    if (step.kind === 'hold') {
      states.push(prev);
      continue;
    }
    states.push({
      pos: { ...prev.pos, [step.foot]: step.to },
      weight: step.kind === 'step' ? step.foot : prev.weight,
    });
  }
  return states;
}

export function totalBeats(pattern: Pattern) {
  return pattern.steps.reduce((sum, s) => sum + (s.beats || 1), 0);
}

/** Beat at which each step starts. */
export function stepStartBeats(pattern: Pattern) {
  const starts: number[] = [];
  let b = 0;
  for (const s of pattern.steps) {
    starts.push(b);
    b += s.beats || 1;
  }
  return starts;
}

/** Fraction of a step's duration used for the foot travelling. */
const MOVE_FRACTION = 0.6;

export interface Frame {
  /** -1 = start position, otherwise index of the current step */
  index: number;
  feet: Record<Foot, FootPos>;
  weight: Foot | null;
  /** 0..1 progress of the moving foot inside the current step */
  progress: number;
}

/** Compute the interpolated feet for a given time (in beats). beat < 0 → start position. */
export function frameAt(pattern: Pattern, states: FeetState[], beat: number): Frame {
  if (beat < 0 || pattern.steps.length === 0) {
    return { index: -1, feet: states[0].pos, weight: null, progress: 1 };
  }
  const starts = stepStartBeats(pattern);
  const total = totalBeats(pattern);
  const b = Math.min(beat, total - 1e-6);
  let i = starts.length - 1;
  while (i > 0 && starts[i] > b) i--;
  const step = pattern.steps[i];
  const local = (b - starts[i]) / (step.beats || 1);
  const t = easeInOut(Math.min(1, local / MOVE_FRACTION));
  const before = states[i];
  const after = states[i + 1];
  const feet = { ...after.pos };
  if (step.kind !== 'hold') {
    const from = before.pos[step.foot];
    const to = after.pos[step.foot];
    feet[step.foot] = {
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t),
      rot: lerp(from.rot, to.rot, t),
    };
  }
  return { index: i, feet, weight: t > 0.5 ? after.weight : before.weight, progress: t };
}

/** A beat value that shows step `index` finished (used when stepping manually). */
export function beatForStep(pattern: Pattern, index: number) {
  if (index < 0) return -1;
  const starts = stepStartBeats(pattern);
  const s = pattern.steps[index];
  return starts[index] + (s.beats || 1) * 0.75;
}

/**
 * Converts a pattern to the partner's point of view, assuming partners face each other
 * in closed position: the partner's right foot mirrors my left, and my "forward" is their "back".
 */
export function toPartner(pattern: Pattern): Pattern {
  const flip = (p: FootPos): FootPos => ({ x: -p.x, y: -p.y, rot: p.rot });
  return {
    start: { L: flip(pattern.start.R), R: flip(pattern.start.L) },
    steps: pattern.steps.map((s) => ({
      ...s,
      id: uid('step'),
      foot: otherFoot(s.foot),
      to: flip(s.to),
    })),
  };
}

/** Mirror left/right (e.g. to practise facing a mirror or a teacher). */
export function mirrorPattern(pattern: Pattern): Pattern {
  const flip = (p: FootPos): FootPos => ({ x: -p.x, y: p.y, rot: -p.rot });
  return {
    start: { L: flip(pattern.start.R), R: flip(pattern.start.L) },
    steps: pattern.steps.map((s) => ({ ...s, foot: otherFoot(s.foot), to: flip(s.to) })),
  };
}

const FOOT_NAME: Record<Foot, string> = { L: 'Left', R: 'Right' };

/** Human readable description of a step, e.g. "Left foot steps forward". */
export function describeStep(step: Step, before: FeetState): string {
  if (step.kind === 'hold') return 'Hold – pause, no weight change';
  const from = before.pos[step.foot];
  const dx = step.to.x - from.x;
  const dy = step.to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const foot = `${FOOT_NAME[step.foot]} foot`;
  const turn = Math.round(step.to.rot - from.rot);
  const turnText = Math.abs(turn) >= 10 ? `, turning ${Math.abs(turn)}° ${turn > 0 ? 'right' : 'left'}` : '';

  if (dist < 0.3) {
    const verb = step.kind === 'tap' ? 'taps in place' : 'steps in place (weight change)';
    return `${foot} ${verb}${turnText}`;
  }

  // Is the foot closing next to the other foot?
  const other = before.pos[otherFoot(step.foot)];
  const closing = Math.abs(step.to.y - other.y) < 0.5 && Math.abs(step.to.x - other.x) < 1.6;

  let dir: string;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const fb = dy < 0 ? 'forward' : 'back';
  const side = dx < 0 ? 'left' : 'right';
  if (ay > ax * 3.5) dir = fb;
  else if (ax > ay * 3.5) dir = `to the ${side}`;
  else dir = `diagonally ${fb} ${side}`;

  if (step.kind === 'tap') return `${foot} taps ${closing ? 'next to the other foot' : dir} (no weight)${turnText}`;
  if (closing) return `${foot} closes next to the ${FOOT_NAME[otherFoot(step.foot)].toLowerCase()} foot${turnText}`;
  return `${foot} steps ${dir}${turnText}`;
}

/** Suggest the next count label, e.g. after "3" comes "4", after "8" comes "1". */
export function nextCount(steps: Step[], beatsPerBar: number): string {
  for (let i = steps.length - 1; i >= 0; i--) {
    const n = parseInt(steps[i].count, 10);
    if (!Number.isNaN(n)) {
      const max = beatsPerBar <= 4 ? beatsPerBar * 2 : beatsPerBar;
      return String((n % max) + 1);
    }
  }
  return '1';
}

export const DEFAULT_START: Record<Foot, FootPos> = {
  L: { x: -0.6, y: 0, rot: 0 },
  R: { x: 0.6, y: 0, rot: 0 },
};
