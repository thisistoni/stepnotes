import { patternBounds, type Bounds } from '@/components/StepDiagram';
import type { Foot, FootPos, Pattern } from '@/lib/types';

/** Grid the feet snap to (diagram units; a foot is ~1 wide). */
export const SNAP = 0.2;
export const snap = (v: number) => Math.round(Math.round(v / SNAP) * SNAP * 100) / 100 + 0; // + 0: no -0

/** Smallest area the canvas shows, so a fresh dance has room to step around. */
const MIN_HALF = 4.5;
/** Room around every foot before the canvas zooms out (checked when a drag ends). */
const FIT_MARGIN = 1.9;
/** While dragging, a foot is kept this far inside the visible area. */
const DRAG_MARGIN = 0.9;

function points(p: Pattern): FootPos[] {
  return [p.start.L, p.start.R, ...p.steps.map((s) => s.to)];
}

/** Bounds that show the whole pattern with room around it, in the canvas' aspect ratio. */
export function fitBounds(p: Pattern, aspect: number): Bounds {
  const b = patternBounds(p, 2.6, MIN_HALF * 2);
  let minX = Math.min(b.minX, -MIN_HALF);
  let maxX = Math.max(b.maxX, MIN_HALF);
  let minY = Math.min(b.minY, -MIN_HALF);
  let maxY = Math.max(b.maxY, MIN_HALF);
  const w = maxX - minX;
  const h = maxY - minY;
  if (w / h < aspect) {
    const grow = (h * aspect - w) / 2;
    minX -= grow;
    maxX += grow;
  } else {
    const grow = (w / aspect - h) / 2;
    minY -= grow;
    maxY += grow;
  }
  return { minX, minY, maxX, maxY };
}

/** Do the current bounds still fit the pattern comfortably (and the canvas shape)? */
export function boundsStillFit(b: Bounds, p: Pattern, aspect: number): boolean {
  const ba = (b.maxX - b.minX) / (b.maxY - b.minY);
  if (Math.abs(ba - aspect) > 0.02) return false;
  return points(p).every(
    (q) => q.x >= b.minX + FIT_MARGIN && q.x <= b.maxX - FIT_MARGIN && q.y >= b.minY + FIT_MARGIN && q.y <= b.maxY - FIT_MARGIN,
  );
}

/** Keep a dragged foot inside the visible canvas. */
export function clampToBounds(x: number, y: number, b: Bounds) {
  return {
    x: Math.min(b.maxX - DRAG_MARGIN, Math.max(b.minX + DRAG_MARGIN, x)),
    y: Math.min(b.maxY - DRAG_MARGIN, Math.max(b.minY + DRAG_MARGIN, y)),
  };
}

/**
 * Is the touch (diagram units) on the foot at `pos`? Tested in the foot's own rotated frame
 * with some slack for fingers. Returns a distance score (lower = closer) or null.
 */
export function hitFoot(x: number, y: number, pos: FootPos, slack = 0.45): number | null {
  const r = (pos.rot * Math.PI) / 180;
  const dx = x - pos.x;
  const dy = y - pos.y;
  const lx = dx * Math.cos(r) + dy * Math.sin(r);
  const ly = -dx * Math.sin(r) + dy * Math.cos(r);
  if (Math.abs(lx) > 0.5 + slack || Math.abs(ly) > 1.3 + slack) return null;
  return Math.hypot(lx, ly * 0.5);
}

export function nearestFoot(x: number, y: number, feet: Partial<Record<Foot, FootPos>>): Foot | null {
  let best: Foot | null = null;
  let score = Infinity;
  for (const f of ['L', 'R'] as Foot[]) {
    const pos = feet[f];
    if (!pos) continue;
    const d = hitFoot(x, y, pos);
    if (d != null && d < score) {
      score = d;
      best = f;
    }
  }
  return best;
}
