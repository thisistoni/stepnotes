import { samePos, type FeetState } from './pattern';
import type { Foot, FootPos, Pattern } from './types';

/**
 * Lays out a printed-style step chart: every foot position once, plus a numbered arrow per step.
 * Arrows are pushed sideways so they don't run over feet or other arrows, and labels are
 * placed in the first free spot around their arrow.
 */

export type Vec = { x: number; y: number };

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ChartFoot {
  foot: Foot;
  pos: FootPos;
  isStart: boolean;
  isTap: boolean;
}

export interface ChartArrow {
  key: string;
  index: number;
  label: string;
  dashed: boolean;
  /** 'move' = arrow from a to b, 'inPlace' = double-headed arrow next to the foot (weight change) */
  type: 'move' | 'inPlace';
  a: Vec;
  b: Vec;
  /** quadratic Bézier control point when the arrow bows around other feet (undefined = straight) */
  c?: Vec;
  labelAt: Vec;
}

export interface ChartLayout {
  feet: ChartFoot[];
  arrows: ChartArrow[];
  bounds: Bounds;
}

export const LABEL_SIZE = 0.85;
const FOOT_RADIUS = 0.5;
const FOOT_HALF = 0.85; // half length of the capsule's core segment

// --- geometry helpers ----------------------------------------------------------------------

function distPointSeg(p: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function segsIntersect(a: Vec, b: Vec, c: Vec, d: Vec) {
  const cross = (o: Vec, p: Vec, q: Vec) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function distSegSeg(a: Vec, b: Vec, c: Vec, d: Vec) {
  if (segsIntersect(a, b, c, d)) return 0;
  return Math.min(distPointSeg(a, c, d), distPointSeg(b, c, d), distPointSeg(c, a, b), distPointSeg(d, a, b));
}

/** Foot approximated as a capsule (segment + radius) along its length. */
function footCapsule(p: FootPos): [Vec, Vec] {
  const r = (p.rot * Math.PI) / 180;
  const ux = Math.sin(r) * FOOT_HALF;
  const uy = -Math.cos(r) * FOOT_HALF;
  return [
    { x: p.x - ux, y: p.y - uy },
    { x: p.x + ux, y: p.y + uy },
  ];
}

function unit(v: Vec): Vec {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
}

/** Point just outside a foot's outline (an ellipse around the sole) in direction `dir`. */
function edgePoint(p: FootPos, dir: Vec, gap: number): Vec {
  const r = (p.rot * Math.PI) / 180;
  // direction in the foot's own frame (y along the foot)
  const lx = dir.x * Math.cos(r) + dir.y * Math.sin(r);
  const ly = -dir.x * Math.sin(r) + dir.y * Math.cos(r);
  const rx = FOOT_RADIUS + 0.02;
  const ry = FOOT_HALF + FOOT_RADIUS - 0.1;
  const t = 1 / Math.sqrt((lx / rx) ** 2 + (ly / ry) ** 2) + gap;
  return { x: p.x + dir.x * t, y: p.y + dir.y * t };
}

export function curvePoint(a: Vec, b: Vec, c: Vec | undefined, t: number): Vec {
  if (!c) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  const s = 1 - t;
  return { x: s * s * a.x + 2 * s * t * c.x + t * t * b.x, y: s * s * a.y + 2 * s * t * c.y + t * t * b.y };
}

export function curveTangent(a: Vec, b: Vec, c: Vec | undefined, t: number): Vec {
  if (!c) return { x: b.x - a.x, y: b.y - a.y };
  return { x: 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x), y: 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y) };
}

function sampleCurve(a: Vec, b: Vec, c: Vec | undefined): Vec[] {
  if (!c) return [a, b];
  const out: Vec[] = [];
  for (let k = 0; k <= 10; k++) out.push(curvePoint(a, b, c, k / 10));
  return out;
}

// --- layout ----------------------------------------------------------------------------------

function collectFeet(pattern: Pattern, states: FeetState[]): ChartFoot[] {
  const out: ChartFoot[] = [];
  const add = (foot: Foot, pos: FootPos, isStart: boolean, isTap: boolean) => {
    const existing = out.find((o) => o.foot === foot && samePos(o.pos, pos) && Math.abs(o.pos.rot - pos.rot) < 5);
    if (existing) {
      if (!isTap) existing.isTap = false;
      return;
    }
    out.push({ foot, pos, isStart, isTap });
  };
  add('L', states[0].pos.L, true, false);
  add('R', states[0].pos.R, true, false);
  pattern.steps.forEach((s, i) => {
    if (s.kind === 'hold') return;
    add(s.foot, states[i + 1].pos[s.foot], false, s.kind === 'tap');
  });
  return out;
}

export interface LayoutOptions {
  /** Place step-number labels (default true). The animated view does not need them. */
  labels?: boolean;
}

/** A label must be this much closer (in units) to its own arrow than to any other arrow. */
const AMBIGUITY_MARGIN = 0.5;

export function layoutChart(pattern: Pattern, states: FeetState[], options: LayoutOptions = {}): ChartLayout {
  const withLabels = options.labels ?? true;
  const feet = collectFeet(pattern, states);
  const capsules = feet.map((f) => footCapsule(f.pos));
  const placed: [Vec, Vec][] = [];

  const footClearance = (a: Vec, b: Vec) =>
    Math.min(Infinity, ...capsules.map(([c, d]) => distSegSeg(a, b, c, d) - FOOT_RADIUS));
  const arrowClearance = (a: Vec, b: Vec) => Math.min(Infinity, ...placed.map(([c, d]) => distSegSeg(a, b, c, d)));
  const free = (a: Vec, b: Vec) => footClearance(a, b) > 0.1 && arrowClearance(a, b) > 0.45;

  /** segs = [from, to) indices into `placed` (a curve is several segments) */
  type Pending = Omit<ChartArrow, 'labelAt'> & { labelCandidates: Vec[]; segs: [number, number] };
  const pending: Pending[] = [];

  pattern.steps.forEach((step, i) => {
    if (step.kind === 'hold') return;
    const from = states[i].pos[step.foot];
    const to = states[i + 1].pos[step.foot];
    const dashed = step.kind === 'tap';

    if (samePos(from, to)) {
      // Weight change in place: vertical double arrow beside the foot (outside first).
      const outward = step.foot === 'L' ? -1 : 1;
      const seg = (side: number, off: number): [Vec, Vec] => [
        { x: to.x + side * off, y: to.y - 0.8 },
        { x: to.x + side * off, y: to.y + 0.8 },
      ];
      let chosen: { s: [Vec, Vec]; side: number } | null = null;
      for (let k = 0; k < 6 && !chosen; k++) {
        for (const side of [outward, -outward]) {
          const s = seg(side, 0.85 + k * 0.5);
          if (free(s[0], s[1])) {
            chosen = { s, side };
            break;
          }
        }
      }
      chosen ??= { s: seg(outward, 0.85), side: outward };
      placed.push(chosen.s);
      const segs: [number, number] = [placed.length - 1, placed.length];
      const [a, b] = chosen.s;
      const sd = chosen.side;
      const labelCandidates: Vec[] = [];
      // beside the arrow on the side away from the foot, then beyond either end, then the foot side
      for (const d of [0.6, 0.85, 1.15])
        for (const y of [0, -0.35, 0.35, -0.7, 0.7]) labelCandidates.push({ x: a.x + sd * d, y: to.y + y });
      for (const e of [0.55, 0.85]) labelCandidates.push({ x: a.x, y: a.y - e }, { x: a.x, y: b.y + e });
      for (const y of [0, -0.4, 0.4]) labelCandidates.push({ x: a.x - sd * 0.6, y: to.y + y });
      pending.push({ key: `a${i}`, index: i, label: step.count, dashed, type: 'inPlace', a, b, labelCandidates, segs });
      return;
    }

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const u = { x: dx / len, y: dy / len };
    const n = { x: -u.y, y: u.x };
    // The arrow always runs from the edge of the foot's old position to the edge of its new one,
    // so it is unmistakably attached to that foot. If the straight line would run over other
    // feet or arrows it bows out to one side (a curve) instead of being shifted off its feet.
    const ends = [from, to];
    const others = capsules.filter((_, k) => !ends.some((e) => feet[k].foot === step.foot && samePos(feet[k].pos, e)));
    const otherClear = (pts: Vec[]) => {
      let m = Infinity;
      for (let k = 1; k < pts.length; k++) {
        for (const [c, d] of others) m = Math.min(m, distSegSeg(pts[k - 1], pts[k], c, d) - FOOT_RADIUS);
      }
      return m;
    };
    const arrowClear = (pts: Vec[]) => {
      let m = Infinity;
      for (let k = 1; k < pts.length; k++) for (const [c, d] of placed) m = Math.min(m, distSegSeg(pts[k - 1], pts[k], c, d));
      return m;
    };
    const curveFor = (bow: number) => {
      const mx = (from.x + to.x) / 2 + n.x * bow * 2; // quadratic control point: the apex sits at bow
      const my = (from.y + to.y) / 2 + n.y * bow * 2;
      const c = { x: mx, y: my };
      const a = edgePoint(from, bow === 0 ? u : unit({ x: c.x - from.x, y: c.y - from.y }), 0.12);
      const b = edgePoint(to, bow === 0 ? { x: -u.x, y: -u.y } : unit({ x: c.x - to.x, y: c.y - to.y }), 0.16);
      return { a, b, c: bow === 0 ? undefined : c };
    };
    // Short moves between neighbouring feet (closing steps) would give a stub of an arrow: they
    // arc over the toes instead, high enough to read as an arrow.
    const short = len < 2.2;
    let chosen: { a: Vec; b: Vec; c?: Vec } | null = null;
    const accept = (cv: { a: Vec; b: Vec; c?: Vec }) => {
      if (Math.hypot(cv.b.x - cv.a.x, cv.b.y - cv.a.y) < 0.35) return false;
      const pts = sampleCurve(cv.a, cv.b, cv.c);
      return otherClear(pts) > 0.08 && arrowClear(pts) > 0.4;
    };
    if (short) {
      // Short moves between neighbouring feet (closing steps) would give a stub of an arrow: they
      // hop from toe to toe (or heel to heel) in a clear arc instead.
      for (const end of [1, -1]) {
        for (const h of [1.5, 2, 2.6]) {
          const dirOf = (p: FootPos) => {
            const r = (p.rot * Math.PI) / 180;
            return { x: Math.sin(r) * end, y: -Math.cos(r) * end };
          };
          const da = dirOf(from);
          const db = dirOf(to);
          const a = edgePoint(from, unit({ x: da.x * 3 + u.x, y: da.y * 3 + u.y }), 0.1);
          const b = edgePoint(to, unit({ x: db.x * 3 - u.x, y: db.y * 3 - u.y }), 0.16);
          const up = unit({ x: da.x + db.x, y: da.y + db.y });
          const c = { x: (a.x + b.x) / 2 + up.x * h, y: (a.y + b.y) / 2 + up.y * h };
          if (accept({ a, b, c })) {
            chosen = { a, b, c };
            break;
          }
        }
        if (chosen) break;
      }
    }
    if (!chosen) {
      const bows = [0];
      for (let k = 1; k <= 7; k++) bows.push(k * 0.45, -k * 0.45);
      for (const bow of bows) {
        const cv = curveFor(bow);
        if (accept(cv)) {
          chosen = cv;
          break;
        }
      }
    }
    chosen ??= curveFor(0.9);
    const { a, b, c } = chosen;
    const pts = sampleCurve(a, b, c);
    for (let k = 1; k < pts.length; k++) placed.push([pts[k - 1], pts[k]]);
    const segIndex = placed.length - (pts.length - 1);

    // "outer" side = the side the arrow bows to (away from the feet it avoids)
    const mt = unit(curveTangent(a, b, c, 0.5));
    const apex = curvePoint(a, b, c, 0.5);
    const sgn = c ? Math.sign(-mt.y * (apex.x - (a.x + b.x) / 2) + mt.x * (apex.y - (a.y + b.y) / 2)) || 1 : 1;
    const at = (t: number, side: number, d: number): Vec => {
      const p = curvePoint(a, b, c, t);
      const tg = unit(curveTangent(a, b, c, t));
      return { x: p.x - tg.y * side * d, y: p.y + tg.x * side * d };
    };
    const labelCandidates: Vec[] = [];
    // 1. beside the middle of the arrow on its outer side, sliding along it to resolve collisions
    for (const d of [0.6, 0.85, 1.15]) for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) labelCandidates.push(at(t, sgn, d));
    // 2. inner side
    for (const d of [0.6, 0.85]) for (const t of [0.5, 0.35, 0.65]) labelCandidates.push(at(t, -sgn, d));
    pending.push({ key: `a${i}`, index: i, label: step.count, dashed, type: 'move', a, b, c, labelCandidates, segs: [segIndex, placed.length] });
  });

  // Labels after all arrows, so they can avoid every arrow.
  const labels: Vec[] = [];
  const labelR = LABEL_SIZE * 0.5;
  /**
   * > 0 when the label is clear of feet, arrows and other labels AND unambiguous: clearly closer
   * to its own arrow than to any other one (so "3" and "1" next to two parallel arrows can
   * always be told apart).
   */
  const labelScore = (c: Vec, own: [number, number]) => {
    const lf = Math.min(Infinity, ...capsules.map(([p, q]) => distPointSeg(c, p, q) - FOOT_RADIUS - labelR));
    const mine = (k: number) => k >= own[0] && k < own[1];
    const dOwn = Math.min(...placed.filter((_, k) => mine(k)).map(([p, q]) => distPointSeg(c, p, q)));
    const dOther = Math.min(Infinity, ...placed.filter((_, k) => !mine(k)).map(([p, q]) => distPointSeg(c, p, q)));
    const ll = Math.min(Infinity, ...labels.map((l) => Math.hypot(l.x - c.x, l.y - c.y) - LABEL_SIZE));
    const ambiguity = dOther - dOwn - AMBIGUITY_MARGIN;
    return Math.min(lf, dOwn - labelR + 0.1, dOther - labelR + 0.05, ll, ambiguity);
  };
  const arrows: ChartArrow[] = pending.map(({ labelCandidates, segs, ...rest }) => {
    if (!withLabels) return { ...rest, labelAt: rest.b };
    let best = labelCandidates[0];
    let bestScore = -Infinity;
    for (const c of labelCandidates) {
      const sc = labelScore(c, segs);
      if (sc > 0.05) {
        best = c;
        break;
      }
      if (sc > bestScore) {
        bestScore = sc;
        best = c;
      }
    }
    labels.push(best);
    return { ...rest, labelAt: best };
  });

  // Bounds around everything that is drawn.
  const xs: number[] = [];
  const ys: number[] = [];
  capsules.forEach(([p, q]) => {
    xs.push(p.x - 0.6, p.x + 0.6, q.x - 0.6, q.x + 0.6);
    ys.push(p.y - 0.55, p.y + 0.55, q.y - 0.55, q.y + 0.55);
  });
  arrows.forEach((ar) => {
    for (const p of sampleCurve(ar.a, ar.b, ar.c)) {
      xs.push(p.x);
      ys.push(p.y);
    }
    if (withLabels) {
      xs.push(ar.labelAt.x - labelR, ar.labelAt.x + labelR);
      ys.push(ar.labelAt.y - labelR, ar.labelAt.y + labelR);
    }
  });
  const m = 0.5;
  const bounds = growTo(
    { minX: Math.min(...xs) - m, maxX: Math.max(...xs) + m, minY: Math.min(...ys) - m, maxY: Math.max(...ys) + m },
    6,
  );

  return { feet, arrows, bounds };
}

// --- live (animated) layout --------------------------------------------------------------------

/** Turns smaller than this (degrees) get no rotation cue. */
export const TURN_MIN_DEG = 20;
/** Radius of the round count badge on a live arrow (diagram units, before any px minimum). */
export const LIVE_BADGE_R = 0.46;
/** Distance from a foot's centre to its turn cue arc. */
export const TURN_ARC_R = 1.75;

export interface LiveArrow {
  type: 'move' | 'inPlace';
  a: Vec;
  b: Vec;
  /** centre of the count badge (on the arrow, at its midpoint) */
  badge: Vec;
  dashed: boolean;
}

export interface LiveStep {
  index: number;
  kind: 'step' | 'tap' | 'hold';
  foot: Foot;
  label: string;
  /** position of the moving foot before / after the step (equal for holds) */
  from: FootPos;
  to: FootPos;
  /** null for holds */
  arrow: LiveArrow | null;
  /** signed turn in degrees (positive = clockwise) when |turn| ≥ TURN_MIN_DEG, else 0 */
  turn: number;
}

export interface LiveLayout {
  /** every distinct foot position of the pattern (for the barely-visible context ghosts) */
  positions: ChartFoot[];
  steps: LiveStep[];
  /** stable bounds for the whole pattern: feet, arrows, badges and turn cues, with padding */
  bounds: Bounds;
}

/**
 * Layout for the animated view. Unlike the printed chart, only the current step's arrow is ever
 * drawn, so each arrow only has to avoid the feet that are on the floor during that step (the
 * other foot, and the moving foot's origin and destination) instead of every position of the
 * pattern. Arrows sit beside the path of the foot (outside of the body for forward/back moves,
 * in front of the toes for side moves) so the travelling foot never covers its own arrow.
 */
export function layoutLive(pattern: Pattern, states: FeetState[]): LiveLayout {
  const steps: LiveStep[] = pattern.steps.map((step, i) => {
    const before = states[i];
    const after = states[i + 1];
    const from = before.pos[step.foot];
    const to = after.pos[step.foot];
    const base = { index: i, kind: step.kind, foot: step.foot, label: step.count, from, to };
    if (step.kind === 'hold') return { ...base, arrow: null, turn: 0 };

    const other = footCapsule(before.pos[step.foot === 'L' ? 'R' : 'L']);
    const own = [footCapsule(from), footCapsule(to)];
    const clear = (a: Vec, b: Vec, min: number) => distSegSeg(a, b, other[0], other[1]) - FOOT_RADIUS > min;
    const clearOwn = (a: Vec, b: Vec) => own.every(([c, d]) => distSegSeg(a, b, c, d) - FOOT_RADIUS > 0.08);
    const dashed = step.kind === 'tap';
    const d = shortestTurn(from.rot, to.rot);
    const turn = Math.abs(d) >= TURN_MIN_DEG ? d : 0;
    const outward = step.foot === 'L' ? -1 : 1;

    if (samePos(from, to)) {
      const seg = (side: number, off: number): [Vec, Vec] => [
        { x: to.x + side * off, y: to.y - 0.75 },
        { x: to.x + side * off, y: to.y + 0.75 },
      ];
      let s: [Vec, Vec] | null = null;
      for (let k = 0; k < 5 && !s; k++) {
        for (const side of [outward, -outward]) {
          const c = seg(side, 0.95 + k * 0.45);
          if (clear(c[0], c[1], 0.2)) {
            s = c;
            break;
          }
        }
      }
      s ??= seg(outward, 0.95);
      const side = Math.sign(s[0].x - to.x) || outward;
      // beside the short double arrow, never on it
      const badge = placeBadge(s[0], s[1], { x: side, y: 0 }, [other, ...own], [[s[0], s[1]]]);
      const arrow: LiveArrow = { type: 'inPlace', a: s[0], b: s[1], badge, dashed };
      return { ...base, arrow, turn };
    }

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const u = { x: dx / len, y: dy / len };
    const n = { x: -u.y, y: u.x };
    // preferred side: away from the body for forward/back moves, in front of the toes for side moves
    const vertical = Math.abs(u.y) >= Math.abs(u.x);
    const pref = vertical ? (Math.sign(n.x) || 1) * outward : n.y < 0 ? 1 : -1;
    const sideways = Math.abs(n.x) * 0.5 + Math.abs(n.y) * 1.3 + 0.38;
    const shrink = Math.min(0.35, len * 0.15);
    const segFor = (off: number): [Vec, Vec] => [
      { x: from.x + u.x * shrink + n.x * off, y: from.y + u.y * shrink + n.y * off },
      { x: to.x - u.x * shrink + n.x * off, y: to.y - u.y * shrink + n.y * off },
    ];
    let s: [Vec, Vec] | null = null;
    let used = pref;
    for (let k = 0; k < 6 && !s; k++) {
      for (const side of [pref, -pref]) {
        const c = segFor(side * (sideways + k * 0.45));
        if (clear(c[0], c[1], 0.25) && clearOwn(c[0], c[1])) {
          s = c;
          used = side;
          break;
        }
      }
    }
    s ??= segFor(pref * sideways);
    // the badge never covers a foot: not the other one, nor the moving foot anywhere on its way;
    // a short arrow would also vanish under it, so then it must sit beyond the arrow
    const path = footSweep(from, to);
    const arrowLen = Math.hypot(s[1].x - s[0].x, s[1].y - s[0].y);
    const outV = { x: n.x * used, y: n.y * used };
    const obstacles: [Vec, Vec][] = [other, ...own, ...path];
    const badge = placeBadge(s[0], s[1], outV, obstacles, arrowLen < LIVE_BADGE_R * 2 + 1.2 ? [[s[0], s[1]]] : []);
    const arrow: LiveArrow = { type: 'move', a: s[0], b: s[1], badge, dashed };
    return { ...base, arrow, turn };
  });

  const positions = collectFeet(pattern, states);
  const xs: number[] = [];
  const ys: number[] = [];
  const addFoot = (p: FootPos) => {
    for (const q of footCapsule(p)) {
      xs.push(q.x - 0.62, q.x + 0.62);
      ys.push(q.y - 0.62, q.y + 0.62);
    }
  };
  positions.forEach((f) => addFoot(f.pos));
  steps.forEach((st) => {
    if (st.arrow) {
      xs.push(st.arrow.a.x, st.arrow.b.x, st.arrow.badge.x - LIVE_BADGE_R - 0.1, st.arrow.badge.x + LIVE_BADGE_R + 0.1);
      ys.push(st.arrow.a.y, st.arrow.b.y, st.arrow.badge.y - LIVE_BADGE_R - 0.1, st.arrow.badge.y + LIVE_BADGE_R + 0.1);
    }
    if (st.turn) {
      const r = TURN_ARC_R + 0.35;
      xs.push(st.to.x - r, st.to.x + r);
      ys.push(st.to.y - r, st.to.y + r);
    }
  });
  const m = 0.55;
  const bounds = growTo({ minX: Math.min(...xs) - m, maxX: Math.max(...xs) + m, minY: Math.min(...ys) - m, maxY: Math.max(...ys) + m }, 6);
  return { positions, steps, bounds };
}

/**
 * Where to put a live count badge: beside its arrow, never on a foot. Candidates slide along the
 * arrow and step outwards (away from the foot's path) until the badge clears the moving foot's
 * whole travel (origin → destination), the other foot, and every other obstacle given.
 */
function placeBadge(a: Vec, b: Vec, out: Vec, obstacles: [Vec, Vec][], lines: [Vec, Vec][] = []): Vec {
  const r = LIVE_BADGE_R + 0.12;
  const clearOf = (c: Vec) =>
    Math.min(
      ...obstacles.map(([p, q]) => distPointSeg(c, p, q) - FOOT_RADIUS - r),
      ...lines.map(([p, q]) => distPointSeg(c, p, q) - 0.12 - r),
    );
  let best = mid(a, b);
  let bestScore = -Infinity;
  for (const extra of [0, 0.25, 0.5, 0.8, 1.1, 1.45]) {
    for (const t of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      const c = { x: a.x + (b.x - a.x) * t + out.x * extra, y: a.y + (b.y - a.y) * t + out.y * extra };
      const sc = clearOf(c);
      if (sc > 0.04) return c;
      if (sc > bestScore) {
        bestScore = sc;
        best = c;
      }
    }
  }
  return best;
}

function mid(a: Vec, b: Vec): Vec {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Capsules covering a foot travelling from `a` to `b` (both ends plus the swept path). */
function footSweep(a: FootPos, b: FootPos): [Vec, Vec][] {
  const ca = footCapsule(a);
  const cb = footCapsule(b);
  return [
    [ca[0], cb[0]],
    [ca[1], cb[1]],
    [
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
    ],
  ];
}

function shortestTurn(from: number, to: number) {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function growTo(b: Bounds, minSize: number): Bounds {
  const grow = (lo: number, hi: number): [number, number] => {
    const size = hi - lo;
    if (size >= minSize) return [lo, hi];
    const extra = (minSize - size) / 2;
    return [lo - extra, hi + extra];
  };
  const [minX, maxX] = grow(b.minX, b.maxX);
  const [minY, maxY] = grow(b.minY, b.maxY);
  return { minX, minY, maxX, maxY };
}
