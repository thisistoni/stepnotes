import { samePos, stepTurn, type FeetState } from './pattern';
import type { Foot, FootPos, Pattern } from './types';

/**
 * Lays out a printed-style step chart: every foot position once, plus a numbered arrow per step.
 *
 * Arrows: each step gets a few candidate routes from the edge of the foot's old position to the
 * edge of its new one (straight, bowed to either side, or for sideways moves a "bridge" over the
 * toes / under the heels with a minimum height, so a closing step between two touching feet is
 * never squeezed into a squiggle). Every route has a cost (feet or letters in the way, size,
 * growing the chart) and routes are chosen together: arrows running on top of each other or an
 * arrowhead landing on another arrow cost extra, and each arrow re-picks its route against all the
 * others a few times.
 *
 * Labels: placed after all arrows, most constrained arrow first. A label never sits on an arrow
 * (stroke or head) or an L / R letter; it should touch its own arrow on the outer side, be clearly
 * closer to it than to any other arrow, and only overlap a foot when there is no free spot.
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
  /**
   * second control point: the arrow is a cubic Bézier (a, c, c2, b). Used for "bridges" that leave
   * one foot over its toes (or under its heel) and land on the other one the same way.
   */
  c2?: Vec;
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

/** Length of (dx, dy). Math.hypot is several times slower on some JS engines; this runs a lot. */
function hypot(dx: number, dy: number) {
  return Math.sqrt(dx * dx + dy * dy);
}

function distPointSeg(p: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
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
  const l = hypot(v.x, v.y) || 1;
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

/** Point on a straight (no c), quadratic (c) or cubic (c and c2) arrow at t ∈ [0, 1]. */
export function curvePoint(a: Vec, b: Vec, c: Vec | undefined, t: number, c2?: Vec): Vec {
  if (!c) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  const s = 1 - t;
  if (c2) {
    const k0 = s * s * s;
    const k1 = 3 * s * s * t;
    const k2 = 3 * s * t * t;
    const k3 = t * t * t;
    return { x: k0 * a.x + k1 * c.x + k2 * c2.x + k3 * b.x, y: k0 * a.y + k1 * c.y + k2 * c2.y + k3 * b.y };
  }
  return { x: s * s * a.x + 2 * s * t * c.x + t * t * b.x, y: s * s * a.y + 2 * s * t * c.y + t * t * b.y };
}

export function curveTangent(a: Vec, b: Vec, c: Vec | undefined, t: number, c2?: Vec): Vec {
  if (!c) return { x: b.x - a.x, y: b.y - a.y };
  const s = 1 - t;
  if (c2) {
    return {
      x: 3 * s * s * (c.x - a.x) + 6 * s * t * (c2.x - c.x) + 3 * t * t * (b.x - c2.x),
      y: 3 * s * s * (c.y - a.y) + 6 * s * t * (c2.y - c.y) + 3 * t * t * (b.y - c2.y),
    };
  }
  return { x: 2 * s * (c.x - a.x) + 2 * t * (b.x - c.x), y: 2 * s * (c.y - a.y) + 2 * t * (b.y - c.y) };
}

/** Points along an arrow (a straight arrow gets `n` segments too, so overlaps can be measured). */
function samplePts(cv: Curve, n = 16): Vec[] {
  const out: Vec[] = [];
  for (let k = 0; k <= n; k++) out.push(curvePoint(cv.a, cv.b, cv.c, k / n, cv.c2));
  return out;
}

function toSegs(pts: Vec[]): [Vec, Vec][] {
  const out: [Vec, Vec][] = [];
  for (let k = 1; k < pts.length; k++) out.push([pts[k - 1], pts[k]]);
  return out;
}

function distPointSegs(p: Vec, segs: [Vec, Vec][]) {
  let m = Infinity;
  for (const [a, b] of segs) m = Math.min(m, distPointSeg(p, a, b));
  return m;
}

interface Curve {
  a: Vec;
  b: Vec;
  c?: Vec;
  c2?: Vec;
}

/** Arrowhead length (diagram units) assumed for clearances; the drawn head is ≈ 0.3–0.4. */
const HEAD_LEN = 0.38;

/** The two strokes of an arrowhead at `tip`, arriving in direction `dir`. */
function headSegs(tip: Vec, dir: Vec): [Vec, Vec][] {
  const n = { x: -dir.y, y: dir.x };
  const back = { x: tip.x - dir.x * HEAD_LEN, y: tip.y - dir.y * HEAD_LEN };
  return [
    [tip, { x: back.x + n.x * HEAD_LEN * 0.8, y: back.y + n.y * HEAD_LEN * 0.8 }],
    [tip, { x: back.x - n.x * HEAD_LEN * 0.8, y: back.y - n.y * HEAD_LEN * 0.8 }],
  ];
}

// --- layout ----------------------------------------------------------------------------------

function collectFeet(pattern: Pattern, states: FeetState[]): ChartFoot[] {
  const out: ChartFoot[] = [];
  const add = (foot: Foot, pos: FootPos, isStart: boolean, isTap: boolean) => {
    // one print per foot and place: a foot that turns on the spot (a pivot, or a step in place
    // with a turn) keeps the print it landed with
    const existing = out.find((o) => o.foot === foot && samePos(o.pos, pos));
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

/** A label should be this much closer (in units) to its own arrow than to any other arrow. */
const AMBIGUITY_MARGIN = 0.5;

/** Unit vector from a foot's centre to its toes (side = 1) or heel (side = -1). */
function footDir(p: FootPos, side: number): Vec {
  const r = (p.rot * Math.PI) / 180;
  return { x: Math.sin(r) * side, y: -Math.cos(r) * side };
}

/** Centre of the L / R letter drawn on a foot. */
function letterCentre(p: FootPos): Vec {
  const d = footDir(p, 1);
  return { x: p.x + d.x * 0.47, y: p.y + d.y * 0.47 };
}

interface Route {
  cv: Curve;
  /** samples along the stroke */
  pts: Vec[];
  /** stroke + arrowhead segments (what a label or another arrow must not sit on) */
  segs: [Vec, Vec][];
  box: Bounds;
  /** cost of the route on its own: shape, feet in the way, size */
  cost: number;
}

function routeOf(cv: Curve, heads: 1 | 2, shapeCost: number): Route {
  const pts = samplePts(cv);
  const end = unit({ x: cv.b.x - pts[pts.length - 2].x, y: cv.b.y - pts[pts.length - 2].y });
  const segs = toSegs(pts).concat(headSegs(cv.b, end));
  if (heads === 2) segs.push(...headSegs(cv.a, unit({ x: cv.a.x - pts[1].x, y: cv.a.y - pts[1].y })));
  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (const [p, q] of segs) {
    box.minX = Math.min(box.minX, p.x, q.x);
    box.maxX = Math.max(box.maxX, p.x, q.x);
    box.minY = Math.min(box.minY, p.y, q.y);
    box.maxY = Math.max(box.maxY, p.y, q.y);
  }
  return { cv, pts, segs, box, cost: shapeCost };
}

function boxesNear(a: Bounds, b: Bounds, m: number) {
  return a.minX - m <= b.maxX && b.minX - m <= a.maxX && a.minY - m <= b.maxY && b.minY - m <= a.maxY;
}

/** Is `p` within `d` of route `r` (stroke or head)? Cheap box test first. */
function near(p: Vec, r: Route, d: number) {
  const b = r.box;
  if (p.x < b.minX - d || p.x > b.maxX + d || p.y < b.minY - d || p.y > b.maxY + d) return false;
  return distPointSegs(p, r.segs) < d;
}

/** Arrows closer than this run "on top of each other". */
const OVERLAP_D = 0.32;

/**
 * How badly two arrows get in each other's way: running alongside each other (per sample), and
 * an arrowhead on or next to the other arrow (it would be lost). Crossing at an angle is cheap.
 */
function conflict(x: Route, y: Route): number {
  if (!boxesNear(x.box, y.box, 0.6)) return 0;
  let c = 0;
  for (const p of x.pts) if (near(p, y, OVERLAP_D)) c += 0.5;
  for (const p of y.pts) if (near(p, x, OVERLAP_D)) c += 0.5;
  if (near(x.cv.b, y, 0.45)) c += 5;
  if (near(y.cv.b, x, 0.45)) c += 5;
  return c;
}

export function layoutChart(pattern: Pattern, states: FeetState[], options: LayoutOptions = {}): ChartLayout {
  const withLabels = options.labels ?? true;
  const feet = collectFeet(pattern, states);
  const capsules = feet.map((f) => footCapsule(f.pos));
  const letters = feet.map((f) => letterCentre(f.pos));
  const feetBox = {
    minX: Math.min(...capsules.flat().map((p) => p.x)) - 0.6,
    maxX: Math.max(...capsules.flat().map((p) => p.x)) + 0.6,
    minY: Math.min(...capsules.flat().map((p) => p.y)) - 0.6,
    maxY: Math.max(...capsules.flat().map((p) => p.y)) + 0.6,
  };

  interface Pending {
    key: string;
    index: number;
    label: string;
    dashed: boolean;
    type: 'move' | 'inPlace';
    /** the foot carrying the arrow (labels lean to the outside of the body) */
    outward: number;
    routes: Route[];
    chosen: number;
  }
  const pending: Pending[] = [];
  // a figure danced twice (the chart of all bars) draws each move once, not two arrows on top of
  // each other: same foot, same way, same count
  const drawnMoves = new Set<string>();

  pattern.steps.forEach((step, i) => {
    if (step.kind === 'hold') return;
    const a0 = states[i].pos[step.foot];
    const a1 = states[i + 1].pos[step.foot];
    const move = [step.foot, step.kind, step.count, a0.x, a0.y, a1.x, a1.y].map((v) => (typeof v === 'number' ? v.toFixed(2) : v)).join('|');
    if (drawnMoves.has(move)) return;
    drawnMoves.add(move);
    // the print as drawn: a foot that pivoted since it landed keeps the print of its landing
    const at = states[i].pos[step.foot];
    const from = feet.find((f) => f.foot === step.foot && samePos(f.pos, at))?.pos ?? at;
    const to = states[i + 1].pos[step.foot];
    const dashed = step.kind === 'tap';
    const outward = step.foot === 'L' ? -1 : 1;
    const ownFeet = capsules.filter((_, k) => feet[k].foot === step.foot && (samePos(feet[k].pos, from) || samePos(feet[k].pos, to)));
    const otherFeet = capsules.filter((c) => !ownFeet.includes(c));
    const routes: Route[] = [];

    /** Feet in the way, letters crossed, and growth of the chart beyond its feet. */
    const staticCost = (r: Route, allowOwn: boolean) => {
      let c = r.cost;
      let m = Infinity;
      for (const [p, q] of toSegs(r.pts)) for (const [cA, cB] of otherFeet) m = Math.min(m, distSegSeg(p, q, cA, cB) - FOOT_RADIUS);
      if (m < 0.1) c += 30 + (0.1 - m) * 60;
      if (!allowOwn) {
        // the arrow must not run back over its own feet between its ends
        for (let k = 3; k < r.pts.length - 3; k++) {
          for (const [cA, cB] of ownFeet) if (distPointSeg(r.pts[k], cA, cB) - FOOT_RADIUS < -0.02) c += 6;
        }
      }
      for (const l of letters) for (const p of r.pts) if (hypot(p.x - l.x, p.y - l.y) < 0.32) c += 3;
      const out = Math.max(
        0,
        ...r.pts.map((p) => Math.max(feetBox.minX - p.x, p.x - feetBox.maxX, feetBox.minY - p.y, p.y - feetBox.maxY)),
      );
      if (out > 0.35) c += (out - 0.35) * 3;
      let len = 0;
      for (let k = 1; k < r.pts.length; k++) len += hypot(r.pts[k].x - r.pts[k - 1].x, r.pts[k].y - r.pts[k - 1].y);
      // too short to read as an arrow (it would be all arrowhead)
      if (len < 0.65) c += 40 + (0.65 - len) * 20;
      return c;
    };

    if (samePos(from, to)) {
      // Weight change in place: vertical double arrow beside the foot (outside first).
      for (let k = 0; k < 6; k++) {
        for (const side of [outward, -outward]) {
          const off = 0.85 + k * 0.5;
          const cv = { a: { x: to.x + side * off, y: to.y - 0.8 }, b: { x: to.x + side * off, y: to.y + 0.8 } };
          const r = routeOf(cv, 2, k * 0.8 + (side === outward ? 0 : 0.4));
          r.cost = staticCost(r, true);
          routes.push(r);
        }
      }
      pending.push({ key: `a${i}`, index: i, label: step.count, dashed, type: 'inPlace', outward, routes, chosen: 0 });
      return;
    }

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = hypot(dx, dy);
    const u = { x: dx / len, y: dy / len };
    const n = { x: -u.y, y: u.x };
    // 1. From the edge of the foot's old position to the edge of its new one, so the arrow is
    //    unmistakably attached to that foot: straight, or bowed to one side around what is in the way.
    const toe = unit({ x: footDir(from, 1).x + footDir(to, 1).x, y: footDir(from, 1).y + footDir(to, 1).y });
    const sideways = Math.abs(u.x * toe.x + u.y * toe.y) < 0.6;
    // between neighbouring feet (a closing step) a bow would be squeezed into a squiggle: bridges only
    const bows = sideways && len < 2.2 ? [] : [0, ...[1, 2, 3, 4, 5, 6, 7].flatMap((k) => [k * 0.45, -k * 0.45])];
    for (const bow of bows) {
      const c = { x: (from.x + to.x) / 2 + n.x * bow * 2, y: (from.y + to.y) / 2 + n.y * bow * 2 }; // apex sits at `bow`
      const a = edgePoint(from, bow === 0 ? u : unit({ x: c.x - from.x, y: c.y - from.y }), 0.12);
      const b = edgePoint(to, bow === 0 ? { x: -u.x, y: -u.y } : unit({ x: c.x - to.x, y: c.y - to.y }), 0.16);
      routes.push(routeOf({ a, b, c: bow === 0 ? undefined : c }, 1, Math.abs(bow) * 1.2));
    }
    // 2. Sideways moves (closing steps, moves past a foot): a bridge that leaves over the toes (or
    //    under the heel) and lands on the other foot the same way, clear of the feet in between.
    //    Its height has a floor, so a short move still reads as an arrow, not a squiggle.
    if (sideways) {
      for (const side of [1, -1]) {
        for (const h of [0.85, 1.15, 1.5, 1.9, 2.4]) {
          const da = footDir(from, side);
          const db = footDir(to, side);
          // ends near the tip of each foot (leaning a little towards each other): a wide arch
          const a = edgePoint(from, unit({ x: da.x * 6 + u.x, y: da.y * 6 + u.y }), 0.1);
          const b = edgePoint(to, unit({ x: db.x * 6 - u.x, y: db.y * 6 - u.y }), 0.16);
          const c = { x: a.x + da.x * h + u.x * 0.15, y: a.y + da.y * h + u.y * 0.15 };
          const c2 = { x: b.x + db.x * h - u.x * 0.15, y: b.y + db.y * h - u.y * 0.15 };
          routes.push(routeOf({ a, b, c, c2 }, 1, 0.5 + h * 0.7 + (side < 0 ? 0.25 : 0)));
        }
      }
    }
    for (const r of routes) r.cost = staticCost(r, false);
    pending.push({ key: `a${i}`, index: i, label: step.count, dashed, type: 'move', outward, routes, chosen: 0 });
  });

  // Choose one route per arrow: greedily in step order, then a few passes where every arrow
  // re-picks its best route against all the others (arrows stop fighting over the same space).
  const cache = new Map<string, number>();
  const conflictOf = (k: number, j: number, o: number) => {
    const jo = pending[o].chosen;
    const key = k < o ? `${k}:${j}:${o}:${jo}` : `${o}:${jo}:${k}:${j}`;
    let c = cache.get(key);
    if (c === undefined) {
      c = conflict(pending[k].routes[j], pending[o].routes[jo]);
      cache.set(key, c);
    }
    return c;
  };
  const pick = (k: number, upTo: number) => {
    let best = 0;
    let bestCost = Infinity;
    pending[k].routes.forEach((r, j) => {
      let c = r.cost;
      if (c >= bestCost) return; // conflicts only add
      for (let o = 0; o < upTo && c < bestCost; o++) if (o !== k) c += conflictOf(k, j, o);
      if (c < bestCost - 1e-9) {
        bestCost = c;
        best = j;
      }
    });
    return best;
  };
  pending.forEach((_, k) => (pending[k].chosen = pick(k, k)));
  // (fewer passes for long patterns: each pass costs ~ arrows² × routes)
  for (let pass = 0; pass < (pending.length > 16 ? 2 : 4); pass++) {
    let changed = false;
    pending.forEach((_, k) => {
      const j = pick(k, pending.length);
      if (j !== pending[k].chosen) {
        pending[k].chosen = j;
        changed = true;
      }
    });
    if (!changed) break;
  }
  const chosen = pending.map((p) => p.routes[p.chosen]);

  // Labels after all arrows, so they can avoid every arrow.
  const labelR = LABEL_SIZE * 0.5;
  const labels: (Vec | null)[] = pending.map(() => null);
  const candidatesFor = (k: number): Vec[] => {
    const p = pending[k];
    const { a, b, c, c2 } = chosen[k].cv;
    const out: Vec[] = [];
    if (p.type === 'inPlace') {
      const footX = states[p.index + 1].pos[pattern.steps[p.index].foot].x;
      const sd = Math.sign(a.x - footX) || p.outward;
      const midY = (a.y + b.y) / 2;
      // beside the arrow on the side away from the foot, then beyond either end, then the foot side
      for (const d of [0.62, 0.8, 1.05, 1.35])
        for (const y of [0, -0.35, 0.35, -0.7, 0.7]) out.push({ x: a.x + sd * d, y: midY + y });
      for (const e of [0.62, 0.85]) out.push({ x: a.x, y: Math.min(a.y, b.y) - e }, { x: a.x, y: Math.max(a.y, b.y) + e });
      for (const y of [0, -0.4, 0.4]) out.push({ x: a.x - sd * 0.62, y: midY + y });
      return out;
    }
    // "outer" side = the side the arrow bows to (away from the feet it avoids)
    const mt = unit(curveTangent(a, b, c, 0.5, c2));
    const apex = curvePoint(a, b, c, 0.5, c2);
    const sgn = c ? Math.sign(-mt.y * (apex.x - (a.x + b.x) / 2) + mt.x * (apex.y - (a.y + b.y) / 2)) || 1 : 1;
    const at = (t: number, side: number, d: number): Vec => {
      const q = curvePoint(a, b, c, t, c2);
      const tg = unit(curveTangent(a, b, c, t, c2));
      return { x: q.x - tg.y * side * d, y: q.y + tg.x * side * d };
    };
    const ts = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];
    const own = chosen[k].segs;
    /** the spot at `t` on `side` that just touches the arrow (its head included) */
    const snug = (t: number, side: number, extra: number) => {
      const clear = (d: number) => distPointSegs(at(t, side, d), own) >= labelR + 0.12;
      let lo = labelR + 0.1;
      let hi = lo;
      while (!clear(hi) && hi < 2.5) hi += 0.25;
      if (hi > lo) {
        lo = hi - 0.25;
        for (let k = 0; k < 4; k++) {
          const m = (lo + hi) / 2;
          if (clear(m)) hi = m;
          else lo = m;
        }
      }
      return at(t, side, hi + extra);
    };
    // 1. touching the arrow on its outer side (beyond the apex of a bow or bridge), sliding along it
    for (const t of ts) out.push(snug(t, sgn, 0));
    // 2. the inner side, then a little further out on either side
    for (const t of ts) out.push(snug(t, -sgn, 0));
    for (const extra of [0.2, 0.45, 0.8]) for (const t of ts) out.push(snug(t, sgn, extra), snug(t, -sgn, extra));
    return out;
  };
  const allSegs = chosen.map((r) => r.segs);
  // what is drawn without the labels: a label sticking out of it makes the whole chart smaller
  let drawn = { ...feetBox };
  for (const r of chosen) {
    drawn.minX = Math.min(drawn.minX, r.box.minX);
    drawn.maxX = Math.max(drawn.maxX, r.box.maxX);
    drawn.minY = Math.min(drawn.minY, r.box.minY);
    drawn.maxY = Math.max(drawn.maxY, r.box.maxY);
  }
  // the chart is at least 6 units each way anyway: room up to that is free
  drawn = growTo(drawn, 6 - 2 * 0.3);
  /** penalty of a label spot: hard rules (never on an arrow, a letter or another label) and preferences */
  /**
   * Penalty of a label spot, without the other labels: hard rules (never on an arrow or its head,
   * never on an L / R letter) weigh 100, preferences (beside a foot rather than on it, touching its
   * own arrow, clearly closer to it than to any other arrow, inside the chart) much less.
   */
  const spotCost = (k: number, q: Vec, order: number) => {
    let hard = 0;
    let soft = order * 0.03;
    const dOwn = distPointSegs(q, allSegs[k]);
    let dOther = Infinity;
    chosen.forEach((r, o) => {
      if (o === k) return;
      const b = r.box;
      // the box is a lower bound of the distance: skip arrows that cannot be the nearest
      const bx = Math.max(0, b.minX - q.x, q.x - b.maxX);
      const by = Math.max(0, b.minY - q.y, q.y - b.maxY);
      if (hypot(bx, by) < dOther) dOther = Math.min(dOther, distPointSegs(q, r.segs));
    });
    const clearArrow = Math.min(dOwn, dOther) - labelR - 0.1;
    if (clearArrow < 0) hard += 1 - clearArrow * 10;
    for (const l of letters) {
      const dl = hypot(q.x - l.x, q.y - l.y) - labelR - 0.3;
      if (dl < 0) hard += 1 - dl * 10;
    }
    let lf = Infinity;
    for (const [p1, p2] of capsules) lf = Math.min(lf, distPointSeg(q, p1, p2) - FOOT_RADIUS - labelR);
    if (lf < 0) soft += 3 - lf * 8;
    const gap = dOwn - labelR;
    if (gap > 0.25) soft += (gap - 0.25) * 3;
    const amb = dOther - dOwn - AMBIGUITY_MARGIN;
    if (amb < 0) soft += 4 - amb * 10;
    const grow = Math.max(0, drawn.minX - (q.x - labelR), q.x + labelR - drawn.maxX, drawn.minY - (q.y - labelR), q.y + labelR - drawn.maxY);
    soft += grow * 1.5;
    return hard * 100 + soft;
  };
  if (withLabels) {
    const cands = pending.map((_, k) => candidatesFor(k).map((q, o) => ({ q, cost: spotCost(k, q, o) })));
    // most constrained arrows first (fewest spots clear of arrows and letters)
    const freedom = cands.map((cs) => cs.filter((c) => c.cost < 50).length);
    const order = pending.map((_, k) => k).sort((x, y) => freedom[x] - freedom[y] || x - y);
    for (const k of order) {
      let best = cands[k][0].q;
      let bestCost = Infinity;
      for (const { q, cost } of cands[k]) {
        let c = cost;
        for (const l of labels) {
          if (!l) continue;
          const dl = hypot(q.x - l.x, q.y - l.y) - LABEL_SIZE - 0.06;
          if (dl < 0) c += 100 * (1 - dl * 10);
          // two badges side by side read as a pair: which arrow is whose?
          else if (dl < 0.45) c += (0.45 - dl) * 6;
        }
        if (c < bestCost) {
          bestCost = c;
          best = q;
        }
      }
      labels[k] = best;
    }
  }

  const arrows: ChartArrow[] = pending.map((p, k) => {
    const { a, b, c, c2 } = chosen[k].cv;
    return { key: p.key, index: p.index, label: p.label, dashed: p.dashed, type: p.type, a, b, c, c2, labelAt: labels[k] ?? b };
  });

  // Bounds around everything that is drawn: feet with a comfortable margin, arrows and labels
  // (already beside the feet) with a smaller one, so a label at the edge does not shrink the chart.
  const xs: number[] = [];
  const ys: number[] = [];
  const m = 0.5;
  const mArrow = 0.3;
  capsules.forEach(([p, q]) => {
    xs.push(p.x - 0.6 - m, p.x + 0.6 + m, q.x - 0.6 - m, q.x + 0.6 + m);
    ys.push(p.y - 0.55 - m, p.y + 0.55 + m, q.y - 0.55 - m, q.y + 0.55 + m);
  });
  chosen.forEach((r) => {
    for (const [p, q] of r.segs) {
      xs.push(p.x - mArrow, q.x - mArrow, p.x + mArrow, q.x + mArrow);
      ys.push(p.y - mArrow, q.y - mArrow, p.y + mArrow, q.y + mArrow);
    }
  });
  if (withLabels) {
    arrows.forEach((ar) => {
      xs.push(ar.labelAt.x - labelR - mArrow, ar.labelAt.x + labelR + mArrow);
      ys.push(ar.labelAt.y - labelR - mArrow, ar.labelAt.y + labelR + mArrow);
    });
  }
  const bounds = growTo({ minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }, 6);

  return { feet, arrows, bounds };
}

// --- live (animated) layout --------------------------------------------------------------------

/** Radius of the round count badge on a live arrow (diagram units, before any px minimum). */
export const LIVE_BADGE_R = 0.46;

export interface LiveArrow {
  type: 'move' | 'inPlace';
  a: Vec;
  b: Vec;
  /** centre of the count badge (on the arrow, at its midpoint) */
  badge: Vec;
  dashed: boolean;
  /**
   * How far the arrow's direction swings from tail to head, in degrees (positive = clockwise);
   * 0 = straight. A foot that turns while it travels gets an arrow that curves the same way.
   */
  bend: number;
}

/** Turns of the moving foot smaller than this (degrees) leave its arrow straight. */
export const TURN_MIN_DEG = 20;

/**
 * The bend of the arrow of a foot turning by `turn` degrees on its way: about the turn itself,
 * but never so slight that it passes for straight, nor so tight that the arrow curls up.
 */
export function arrowBend(turn: number) {
  const t = Math.abs(turn);
  return t < TURN_MIN_DEG ? 0 : Math.sign(turn) * Math.max(55, Math.min(110, t));
}

/** Control point of a bent arrow from `a` to `b` (a quadratic curve); null when it is straight. */
export function bendControl(a: Vec, b: Vec, bend: number): Vec | null {
  if (!bend) return null;
  const k = (Math.sign(bend) * Math.tan((Math.abs(bend) * Math.PI) / 360)) / 2;
  return { x: (a.x + b.x) / 2 + (b.y - a.y) * k, y: (a.y + b.y) / 2 - (b.x - a.x) * k };
}

/** The arrow from `a` to `b` as line segments: the chord itself, or its bent curve in pieces. */
export function bentSegments(a: Vec, b: Vec, bend: number, pieces = 8): [Vec, Vec][] {
  const c = bendControl(a, b, bend);
  if (!c) return [[a, b]];
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * a.x + 2 * t * (1 - t) * c.x + t * t * b.x,
    y: (1 - t) * (1 - t) * a.y + 2 * t * (1 - t) * c.y + t * t * b.y,
  });
  const out: [Vec, Vec][] = [];
  for (let i = 0; i < pieces; i++) out.push([at(i / pieces), at((i + 1) / pieces)]);
  return out;
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
  /** the foot lands right next to the other one (a closing step): its badge goes beside the arrow */
  closing: boolean;
}

export interface LiveLayout {
  /** every distinct foot position of the pattern (for the barely-visible context ghosts) */
  positions: ChartFoot[];
  steps: LiveStep[];
  /** stable bounds for the whole pattern: feet, arrows and badges, with padding */
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
    const otherPos = after.pos[step.foot === 'L' ? 'R' : 'L'];
    const closing = !samePos(from, to) && hypot(to.x - otherPos.x, to.y - otherPos.y) < 1.7;
    const base = { index: i, kind: step.kind, foot: step.foot, label: step.count, from, to, closing };
    if (step.kind === 'hold') return { ...base, arrow: null };

    const other = footCapsule(before.pos[step.foot === 'L' ? 'R' : 'L']);
    const own = [footCapsule(from), footCapsule(to)];
    const clear = (a: Vec, b: Vec, min: number) => distSegSeg(a, b, other[0], other[1]) - FOOT_RADIUS > min;
    const clearOwn = (a: Vec, b: Vec) => own.every(([c, d]) => distSegSeg(a, b, c, d) - FOOT_RADIUS > 0.08);
    const dashed = step.kind === 'tap';
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
      const arrow: LiveArrow = { type: 'inPlace', a: s[0], b: s[1], badge, dashed, bend: 0 };
      return { ...base, arrow };
    }

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = hypot(dx, dy);
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
    // a foot that turns on its way gets an arrow that curves the same way
    const bend = arrowBend(stepTurn(step, from.rot));
    const curve = (c: [Vec, Vec]) => bentSegments(c[0], c[1], bend);
    let s: [Vec, Vec] | null = null;
    let used = pref;
    for (let k = 0; k < 6 && !s; k++) {
      for (const side of [pref, -pref]) {
        const c = segFor(side * (sideways + k * 0.45));
        if (curve(c).every(([p, q]) => clear(p, q, 0.25) && clearOwn(p, q))) {
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
    const arrowLen = hypot(s[1].x - s[0].x, s[1].y - s[0].y);
    const outV = { x: n.x * used, y: n.y * used };
    const obstacles: [Vec, Vec][] = [other, ...own, ...path];
    const ctrl = bendControl(s[0], s[1], bend);
    const m = mid(s[0], s[1]);
    const bow = ctrl ? { x: ctrl.x - m.x, y: ctrl.y - m.y } : undefined;
    const badge = placeBadge(s[0], s[1], outV, obstacles, arrowLen < LIVE_BADGE_R * 2 + 1.2 ? curve(s) : [], bow);
    const arrow: LiveArrow = { type: 'move', a: s[0], b: s[1], badge, dashed, bend };
    return { ...base, arrow };
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
      for (const [q] of bentSegments(st.arrow.a, st.arrow.b, st.arrow.bend, 4)) {
        xs.push(q.x);
        ys.push(q.y);
      }
    }
  });
  const m = 0.55;
  const bounds = growTo({ minX: Math.min(...xs) - m, maxX: Math.max(...xs) + m, minY: Math.min(...ys) - m, maxY: Math.max(...ys) + m }, 6);
  return { positions, steps, bounds };
}

/**
 * Where to put a live count badge: on or beside its arrow (`bow`: control point of a bent arrow
 * relative to the chord's middle), never on a foot. Candidates slide along the
 * arrow and step outwards (away from the foot's path) until the badge clears the moving foot's
 * whole travel (origin → destination), the other foot, and every other obstacle given.
 */
function placeBadge(a: Vec, b: Vec, out: Vec, obstacles: [Vec, Vec][], lines: [Vec, Vec][] = [], bow?: Vec): Vec {
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
      // on a bent arrow the badge rides the curve, not the chord
      const w = bow ? 2 * t * (1 - t) : 0;
      const c = {
        x: a.x + (b.x - a.x) * t + out.x * extra + (bow?.x ?? 0) * w,
        y: a.y + (b.y - a.y) * t + out.y * extra + (bow?.y ?? 0) * w,
      };
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
