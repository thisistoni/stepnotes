/**
 * The mini-lesson's demo: a 4-step forward-and-back basic that ends where it started, so it
 * loops cleanly. Followers get the partner's view of it (right foot back first).
 */
import { DEFAULT_START, toPartner } from '@/lib/pattern';
import type { Foot, Pattern, Role } from '@/lib/types';

/** Slow on purpose: one step every ~2.3 s, so a beginner can follow each phase. */
export const DEMO_BPM = 26;

/** How long the final pose is held before the demo starts again (ms). */
export const DEMO_HOLD_MS = 1100;

const step = (i: number, foot: Foot, x: number, y: number) => ({
  id: `demo${i}`,
  count: String(i + 1),
  beats: 1,
  foot,
  kind: 'step' as const,
  to: { x, y, rot: 0 },
});

const LEADER_DEMO: Pattern = {
  start: DEFAULT_START,
  steps: [step(0, 'L', -0.6, -3), step(1, 'R', 0.6, -3), step(2, 'L', -0.6, 0), step(3, 'R', 0.6, 0)],
};

const FOLLOWER_DEMO: Pattern = toPartner(LEADER_DEMO);

export function demoPattern(role: Role): Pattern {
  return role === 'follower' ? FOLLOWER_DEMO : LEADER_DEMO;
}
