import type { Strings } from './i18n/en';
import type { Foot, FootPos, Pattern, Step } from './types';

export const otherFoot = (f: Foot): Foot => (f === 'L' ? 'R' : 'L');

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => {
  'worklet';
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

/** Signed rotation (degrees, -180..180) that turns `from` into `to` the short way round. */
export function shortestAngleDelta(from: number, to: number) {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** Angle normalised to (-180, 180]. */
export function normAngle(r: number) {
  let d = r % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d === 0 ? 0 : d;
}

/** The step's pivot (swivel of the weight-bearing foot) in degrees; 0 when there is none. */
export const stepPivot = (s: Pick<Step, 'pivot' | 'kind'>) =>
  s.kind !== 'hold' && typeof s.pivot === 'number' && Number.isFinite(s.pivot) ? s.pivot : 0;

/**
 * Signed rotation of the MOVING foot during a step: the short way round, except that a half turn
 * (180°) goes the way the step's pivot turns (a spin to the left is not drawn as one to the right).
 */
export function stepTurn(step: Pick<Step, 'pivot' | 'kind' | 'to'>, fromRot: number) {
  const d = shortestAngleDelta(fromRot, step.to.rot);
  const p = stepPivot(step);
  return Math.abs(d) >= 179.5 && p !== 0 ? 180 * Math.sign(p) : d;
}

/**
 * Which way the dancer faces in a position, in degrees (0 = up the screen, positive = clockwise):
 * where the foot carrying the weight points (after a New Yorker's turn back, the free foot may still
 * point the old way), or halfway between the feet when the weight is on both. Used to say "forward"
 * relative to the body after a turn, and for the stage's facing arrow.
 */
export function facingOf(state: FeetState) {
  const { pos, weight } = state;
  if (weight) return normAngle(pos[weight].rot);
  return normAngle(pos.L.rot + shortestAngleDelta(pos.L.rot, pos.R.rot) / 2);
}

/** Length of a step in beats; anything invalid counts as one beat. */
export const stepBeats = (s: Pick<Step, 'beats'>) => (Number.isFinite(s.beats) && s.beats > 0 ? s.beats : 1);

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
    // a pivot swivels the weight-bearing foot on the spot
    const other = otherFoot(step.foot);
    const pivot = stepPivot(step);
    const otherPos = pivot ? { ...prev.pos[other], rot: normAngle(prev.pos[other].rot + pivot) } : prev.pos[other];
    states.push({
      pos: { ...prev.pos, [step.foot]: step.to, [other]: otherPos } as Record<Foot, FootPos>,
      // a tap never takes the weight: from the start position (weight on both) it moves to the other foot
      weight: step.kind === 'step' ? step.foot : (prev.weight ?? otherFoot(step.foot)),
    });
  }
  return states;
}

export function totalBeats(pattern: Pattern) {
  return pattern.steps.reduce((sum, s) => sum + stepBeats(s), 0);
}

/** Beat at which each step starts. */
export function stepStartBeats(pattern: Pattern) {
  const starts: number[] = [];
  let b = 0;
  for (const s of pattern.steps) {
    starts.push(b);
    b += stepBeats(s);
  }
  return starts;
}

/** Fraction of a step's duration used for the foot travelling. */
export const MOVE_FRACTION = 0.6;

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
  const local = (b - starts[i]) / stepBeats(step);
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
      // turn the short way round (e.g. 170° -> -170° is a 20° turn, not 340°)
      rot: from.rot + stepTurn(step, from.rot) * t,
    };
    const pivot = stepPivot(step);
    if (pivot) {
      const o = otherFoot(step.foot);
      feet[o] = { ...before.pos[o], rot: before.pos[o].rot + pivot * t };
    }
  }
  return { index: i, feet, weight: t > 0.5 ? after.weight : before.weight, progress: t };
}

/**
 * Converts a pattern to the partner's point of view, assuming partners face each other
 * in closed position: the partner's right foot mirrors my left, and my "forward" is their "back".
 */
export function toPartner(pattern: Pattern): Pattern {
  // a half turn of the whole frame keeps the sense of rotation: rotations and pivots stay as they are
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

/** Mirror left/right (e.g. to practise facing a mirror or a teacher). Turns change direction. */
export function mirrorPattern(pattern: Pattern): Pattern {
  const flip = (p: FootPos): FootPos => ({ x: -p.x, y: p.y, rot: normAngle(-p.rot) });
  return {
    start: { L: flip(pattern.start.R), R: flip(pattern.start.L) },
    steps: pattern.steps.map((s) => {
      const out: Step = { ...s, foot: otherFoot(s.foot), to: flip(s.to) };
      if (s.pivot) out.pivot = -s.pivot;
      return out;
    }),
  };
}

/** Which way a step travels: forward/back and/or left/right (both = diagonal). */
export interface StepDirection {
  fb: 'forward' | 'back' | null;
  side: 'left' | 'right' | null;
}

/**
 * What a step does, as data: the dictionaries turn this into a sentence in their own word order
 * (`t.step.describe`). `turn` is how far the dancer's body turns during the step, in signed degrees
 * (positive = right), 0 below 10°: the change of facing, counted only when the moving foot turns or
 * the weight-bearing foot pivots.
 *   inPlace – the foot stays where it is · close – it ends next to the other foot · move – anything else
 * Directions are relative to the dancer, not to the screen: forward is where the body faces while
 * the foot moves. After a turn of the body (a pivot, or the foot itself turning by 60° or more)
 * that is the new facing; otherwise the facing before the step, so a toe-out step forward still
 * reads "forward".
 */
export type StepInfo =
  | { kind: 'hold' }
  | { kind: 'step' | 'tap'; foot: Foot; motion: 'inPlace' | 'close' | 'move'; dir: StepDirection; turn: number };

/** (dx, dy) seen by a dancer facing `facing` degrees: x = to their right, y = backwards. */
function toBody(dx: number, dy: number, facing: number) {
  const r = (facing * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

export function analyzeStep(step: Step, before: FeetState): StepInfo {
  if (step.kind === 'hold') return { kind: 'hold' };
  const from = before.pos[step.foot];
  const footTurn = Math.round(stepTurn(step, from.rot));
  const pivot = Math.round(stepPivot(step));
  // The turn of the BODY, not of the foot: a foot that only catches up with a turn already made
  // (the chassé after a New Yorker, the side step of a turning box) would otherwise count twice.
  // Only steps that rotate something count, so feet kept turned out do not read as turns.
  let turn = 0;
  if (Math.abs(footTurn) >= 10 || Math.abs(pivot) >= 10) {
    const raw = step.kind === 'tap' ? pivot : shortestAngleDelta(facingOf(before), step.to.rot);
    const body = Math.abs(raw) >= 179.5 && step.kind !== 'tap' ? 180 * (Math.sign(pivot) || Math.sign(footTurn) || 1) : Math.round(raw);
    turn = Math.abs(body) >= 10 ? body : 0;
  }
  const base = { kind: step.kind, foot: step.foot, turn };
  if (Math.hypot(step.to.x - from.x, step.to.y - from.y) < 0.3) return { ...base, motion: 'inPlace', dir: { fb: null, side: null } };

  const bodyTurned = Math.abs(pivot) >= 10 || Math.abs(footTurn) >= 60;
  const facing = bodyTurned ? step.to.rot : facingOf(before);
  const { x: dx, y: dy } = toBody(step.to.x - from.x, step.to.y - from.y, facing);
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const fb = dy < 0 ? 'forward' : 'back';
  const side = dx < 0 ? 'left' : 'right';
  // Where it lands next to the weight-bearing foot, as the dancer sees it
  const other = before.pos[otherFoot(step.foot)];
  const rel = toBody(step.to.x - other.x, step.to.y - other.y, facing);
  const closing = Math.abs(rel.y) < 0.5 && Math.abs(rel.x) < 1.6;
  // landing level with the other foot, away from it, is a side step (the box's "side" after a
  // forward step, the chassé's first step after a rock step), even if the foot also came forward
  const level = Math.abs(rel.y) < 0.6 && Math.abs(rel.x) >= 1.6 && Math.sign(rel.x) === Math.sign(dx) && ax > 0.5;
  const dir: StepDirection = level
    ? { fb: null, side }
    : ay > ax * 3.5
      ? { fb, side: null }
      : ax > ay * 3.5
        ? { fb: null, side }
        : { fb, side };
  return { ...base, motion: closing ? 'close' : 'move', dir };
}

/** Plain-language description, e.g. "Left foot steps forward" / "Der linke Fuß geht nach vorne". */
export function describeStep(step: Step, before: FeetState, t: Strings): string {
  return t.step.describe(analyzeStep(step, before));
}

/**
 * A shorter description for tight spaces, shown next to an L / R badge (the Both view shows two
 * at once), so the foot is not repeated: "Closes", "Steps back", "Hold, no weight change".
 */
export function describeStepShort(step: Step, before: FeetState, t: Strings): string {
  return t.step.short(analyzeStep(step, before));
}

/** Suggest the next count label, e.g. after "3" comes "4", after "8" comes "1". */
export function nextCount(steps: Step[], beatsPerBar: number): string {
  // 0, NaN or nonsense bar lengths must never produce "NaN" counts
  const bar = Number.isFinite(beatsPerBar) ? Math.min(12, Math.max(1, Math.round(beatsPerBar))) : 4;
  const max = bar <= 4 ? bar * 2 : bar;
  for (let i = steps.length - 1; i >= 0; i--) {
    const n = parseInt(steps[i].count, 10);
    if (Number.isFinite(n)) {
      return String((((n % max) + max) % max) + 1);
    }
  }
  return '1';
}

export const DEFAULT_START: Record<Foot, FootPos> = {
  L: { x: -0.6, y: 0, rot: 0 },
  R: { x: 0.6, y: 0, rot: 0 },
};

// --- precomputed timeline (for UI-thread animation) -------------------------------------------

/**
 * Keyframes of ONE foot, one entry per step (same index as `pattern.steps`).
 * During step i the foot travels from (x0,y0,r0) to (x1,y1,r1) between beats b0[i] and b1[i]
 * (eased, like `frameAt`), then rests. `r1` is already unwrapped so a plain lerp turns the short
 * way round. `w0`/`w1` = how "solid" (weight-bearing) the foot is before / after the step
 * (1 = carries weight or weight unknown, 0 = free); the UI cross-fades between them.
 */
export interface FootTrack {
  /** 1 when this foot travels (or re-lands in place) during step i, else 0 */
  m: number[];
  b0: number[];
  b1: number[];
  x0: number[];
  y0: number[];
  r0: number[];
  x1: number[];
  y1: number[];
  r1: number[];
  w0: number[];
  w1: number[];
}

/** Everything a worklet needs to pose the feet at any beat without touching the JS thread. */
export interface Timeline {
  /** Beat at which each step starts */
  starts: number[];
  /** Length of each step in beats */
  durations: number[];
  total: number;
  start: Record<Foot, FootPos>;
  L: FootTrack;
  R: FootTrack;
  /**
   * Additive: how solid each foot is in the start position. The weight starts on the foot that does
   * NOT take the first step (you step with the free foot), so a looping pattern wraps without the
   * free foot flashing solid. Both 1 when the pattern has no weighted step.
   */
  startSolid: { L: number; R: number };
  /** Kind of each step as a number (worklets cannot compare strings cheaply): see `KIND_CODE` */
  kinds: number[];
}

/** `Timeline.kinds` values. */
export const KIND_CODE = { step: 0, tap: 1, hold: 2 } as const;

export interface FootPose {
  x: number;
  y: number;
  rot: number;
  /** 0 = free foot, 1 = weight-bearing; fractional while the weight transfers */
  solid: number;
}

const solidness = (state: FeetState, f: Foot) => (state.weight === null || state.weight === f ? 1 : 0);

export function buildTimeline(pattern: Pattern, states: FeetState[] = computeStates(pattern)): Timeline {
  const starts = stepStartBeats(pattern);
  const durations = pattern.steps.map(stepBeats);
  // you step with the free foot: the weight starts on the foot that does not take the first step
  const firstStep = pattern.steps.find((s) => s.kind === 'step');
  const startWeight: Foot | null = firstStep ? otherFoot(firstStep.foot) : null;
  // states before the first weighted step have no known weight ("both"): use the start weight
  const st = states.map((x) => (x.weight === null && startWeight ? { ...x, weight: startWeight } : x));
  const track = (f: Foot): FootTrack => {
    const t: FootTrack = { m: [], b0: [], b1: [], x0: [], y0: [], r0: [], x1: [], y1: [], r1: [], w0: [], w1: [] };
    pattern.steps.forEach((step, i) => {
      const before = st[i];
      const after = st[i + 1];
      const moving = step.kind !== 'hold' && step.foot === f;
      // the weight-bearing foot only changes during a step when it pivots (swivels on the spot)
      const pivot = moving ? 0 : stepPivot(step);
      t.m.push(moving ? 1 : 0);
      const from = moving || pivot ? before.pos[f] : after.pos[f];
      const to = after.pos[f];
      t.b0.push(starts[i]);
      t.b1.push(starts[i] + durations[i] * MOVE_FRACTION);
      t.x0.push(from.x);
      t.y0.push(from.y);
      t.r0.push(from.rot);
      t.x1.push(to.x);
      t.y1.push(to.y);
      t.r1.push(from.rot + (moving ? stepTurn(step, from.rot) : pivot || shortestAngleDelta(from.rot, to.rot)));
      t.w0.push(solidness(before, f));
      t.w1.push(solidness(after, f));
    });
    return t;
  };
  return {
    starts,
    durations,
    total: totalBeats(pattern),
    start: pattern.start,
    L: track('L'),
    R: track('R'),
    startSolid: { L: solidness(st[0], 'L'), R: solidness(st[0], 'R') },
    kinds: pattern.steps.map((s) => KIND_CODE[s.kind] ?? 0),
  };
}

// --- bars --------------------------------------------------------------------------------------

/** A bar of the pattern: steps [from, to) whose start beat lies inside it. */
export interface BarRange {
  bar: number;
  from: number;
  to: number;
}

/**
 * Splits the steps into bars of `beatsPerBar` beats (by the beat each step starts on).
 * Empty bars (a long hold) are skipped. A pattern with no steps has no bars.
 */
export function barRanges(pattern: Pattern, beatsPerBar: number): BarRange[] {
  const per = Number.isFinite(beatsPerBar) && beatsPerBar > 0 ? beatsPerBar : 4;
  const starts = stepStartBeats(pattern);
  const out: BarRange[] = [];
  starts.forEach((b, i) => {
    const bar = Math.floor(b / per + 1e-6);
    const last = out[out.length - 1];
    if (last && last.bar === bar) last.to = i + 1;
    else out.push({ bar, from: i, to: i + 1 });
  });
  return out;
}

/**
 * The steps [from, to) as a pattern of their own, starting where the feet were before step
 * `from` (used for one chart per bar). Step ids and counts are kept.
 */
export function slicePattern(pattern: Pattern, from: number, to: number, states: FeetState[] = computeStates(pattern)): Pattern {
  const at = states[Math.max(0, Math.min(from, states.length - 1))];
  return { start: { L: at.pos.L, R: at.pos.R }, steps: pattern.steps.slice(from, to) };
}

/** What a voice should say for a count label ("&" → "and" / "und"; numbers are left to the voice). */
export function spokenCount(count: string, t: Strings): string {
  return t.spoken(count);
}

/** Index of the step playing at `beat` (-1 = start position). Runs on either thread. */
export function stepIndexAt(starts: number[], total: number, beat: number) {
  'worklet';
  if (beat < 0 || starts.length === 0) return -1;
  const b = Math.min(beat, total - 1e-6);
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= b) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Pose of one foot at `beat`, interpolated from a precomputed track. Same maths as `frameAt`
 * (position error ~0), plus a smooth `solid` value so the weight change can cross-fade
 * instead of snapping at the half-way point. Worklet: safe to call from useAnimatedStyle.
 */
export function footPoseAt(tl: Timeline, foot: Foot, beat: number): FootPose {
  'worklet';
  const tr = foot === 'L' ? tl.L : tl.R;
  const i = stepIndexAt(tl.starts, tl.total, beat);
  if (i < 0) {
    const p = foot === 'L' ? tl.start.L : tl.start.R;
    // older timelines (built before startSolid existed) show both feet solid
    const solid = tl.startSolid ? (foot === 'L' ? tl.startSolid.L : tl.startSolid.R) : 1;
    return { x: p.x, y: p.y, rot: p.rot, solid };
  }
  const b = Math.min(beat, tl.total - 1e-6);
  const span = tr.b1[i] - tr.b0[i];
  const local = span > 0 ? (b - tr.b0[i]) / span : 1;
  const t = easeInOut(Math.min(1, Math.max(0, local)));
  // weight transfer: smoothstep centred on the half-way point of the travel (where frameAt switches)
  const k = Math.min(1, Math.max(0, (t - 0.3) / 0.4));
  const fade = k * k * (3 - 2 * k);
  return {
    x: tr.x0[i] + (tr.x1[i] - tr.x0[i]) * t,
    y: tr.y0[i] + (tr.y1[i] - tr.y0[i]) * t,
    rot: tr.r0[i] + (tr.r1[i] - tr.r0[i]) * t,
    solid: tr.w0[i] + (tr.w1[i] - tr.w0[i]) * fade,
  };
}

/**
 * Where a foot is in its current step, for landing / lift effects (worklet).
 *   travel  0..1 eased progress of the move (1 once landed or when the foot is not moving)
 *   since   beats elapsed since this foot landed in the current step (-1 = not landed / not moving)
 *   moving  true when this foot is the one stepping in the current step
 *   dur     length of the current step in beats
 */
export function footPhaseAt(
  tl: Timeline,
  foot: Foot,
  beat: number,
): { travel: number; since: number; moving: boolean; kind: number; dur: number } {
  'worklet';
  const tr = foot === 'L' ? tl.L : tl.R;
  const i = stepIndexAt(tl.starts, tl.total, beat);
  if (i < 0 || tr.m[i] !== 1) return { travel: 1, since: -1, moving: false, kind: i < 0 ? 0 : tl.kinds[i], dur: i < 0 ? 1 : tl.durations[i] };
  const b = Math.min(beat, tl.total - 1e-6);
  const span = tr.b1[i] - tr.b0[i];
  const local = span > 0 ? (b - tr.b0[i]) / span : 1;
  const travel = Math.min(1, Math.max(0, local));
  return { travel, since: travel >= 1 ? b - tr.b1[i] : -1, moving: true, kind: tl.kinds[i], dur: tl.durations[i] };
}
