/**
 * Drives the mini-lesson: the real playback engine on the demo pattern, a gentle loop (hold the
 * final pose, dip, start again) and the "what is happening now" phase for the legend.
 *
 * The phase is computed on the UI thread from the beat clock and only crosses to React when it
 * changes (three times per step), so the screen never re-renders per frame:
 *   dashed – the moving foot travels to its dashed outline ("where you'll step")
 *   solid  – it has landed and carries the weight
 *   light  – the other foot is now free, about to move next
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useReducedMotion } from '@/components/ui';
import { stepBeats, stepIndexAt, stepStartBeats, totalBeats } from '@/lib/pattern';
import type { Pattern } from '@/lib/types';
import { usePlayback } from '@/lib/usePlayback';

import { DEMO_BPM, DEMO_HOLD_MS } from './demo';

export type LessonPhase = 'solid' | 'light' | 'dashed';
const PHASES: LessonPhase[] = ['solid', 'light', 'dashed'];

/** Fractions of a step: travelling until LAND, solid until FREE, then the other foot is "free". */
const LAND = 0.5;
const FREE = 0.78;
const DIP_MS = 160;
/** Let the step settle on screen before the demo starts by itself. */
const AUTOPLAY_DELAY_MS = 700;

export function useDemoLesson(pattern: Pattern) {
  const reduced = useReducedMotion();
  const starts = useMemo(() => stepStartBeats(pattern), [pattern]);
  const durations = useMemo(() => pattern.steps.map(stepBeats), [pattern]);
  const total = useMemo(() => totalBeats(pattern), [pattern]);
  const pb = usePlayback({ totalBeats: total, bpm: DEMO_BPM, stepStartBeats: starts, loop: false });
  const { beat, play, pause, restart, seekToStep, playing } = pb;

  /** The learner wants it running (playback itself stops briefly at the end of each round). */
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<LessonPhase>('solid');
  /** Opacity of the diagram: dips while the demo jumps back to the start. */
  const dip = useSharedValue(1);

  useAnimatedReaction(
    () => {
      const b = beat.get();
      if (b < 0) return 0; // start position: both feet carry weight
      const i = stepIndexAt(starts, total, b);
      const local = (Math.min(b, total) - starts[i]) / durations[i];
      return local < LAND ? 2 : local < FREE ? 0 : 1;
    },
    (p, prev) => {
      if (p !== prev) scheduleOnRN(setPhase, PHASES[p]);
    },
    [starts, durations, total],
  );

  // Loop: hold the final pose, dip, start again.
  useEffect(() => {
    if (!running || playing) return;
    let t2: ReturnType<typeof setTimeout> | undefined;
    const t1 = setTimeout(() => {
      dip.set(withTiming(0, { duration: DIP_MS }));
      t2 = setTimeout(() => {
        restart();
        dip.set(withTiming(1, { duration: DIP_MS * 1.5 }));
      }, DIP_MS);
    }, DEMO_HOLD_MS);
    return () => {
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
      dip.set(withTiming(1, { duration: DIP_MS }));
    };
  }, [running, playing, restart, dip]);

  const toggle = useCallback(() => {
    if (running) {
      setRunning(false);
      pause();
    } else {
      setRunning(true);
      play();
    }
  }, [running, pause, play]);

  // Start by itself once the step has settled; with reduced motion, wait for the learner and
  // show the first step finished instead.
  useEffect(() => {
    if (reduced) {
      seekToStep(0);
      return;
    }
    const t = setTimeout(() => {
      setRunning(true);
      play();
    }, AUTOPLAY_DELAY_MS);
    return () => clearTimeout(t);
  }, [reduced, play, seekToStep]);

  // Leaving the screen stops the demo for good (usePlayback pauses the clock itself).
  useFocusEffect(useCallback(() => () => setRunning(false), []));

  return { beat, running, toggle, phase, dip };
}
