import { useFocusEffect } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { hapticSelect, hapticStep } from '@/components/ui';
import { spokenCount } from '@/lib/pattern';
import type { Step } from '@/lib/types';

interface CueOptions {
  steps: Step[];
  speak: boolean;
  vibrate: boolean;
  /** effective tempo, to pace the voice */
  bpm: number;
}

/** Silence any spoken count (safe to call anywhere). */
export function stopSpeech() {
  try {
    Speech.stop();
  } catch {
    // speech synthesis unavailable (some browsers): nothing to stop
  }
}

/**
 * Spoken counts and step haptics for the player. Returns `onStep` for usePlayback (called once per
 * step boundary while playing). Speech stops when the screen loses focus or unmounts, and when
 * "Say counts" is switched off; call `usePauseSilence(playing)` to also stop it on pause. "&" is spoken as "and".
 */
export function usePlayerCues({ steps, speak, vibrate, bpm }: CueOptions) {
  const opts = useRef({ steps, speak, vibrate, bpm });
  useLayoutEffect(() => {
    opts.current = { steps, speak, vibrate, bpm };
  });

  const onStep = useCallback((i: number) => {
    const { steps: st, speak: sp, vibrate: vb, bpm: b } = opts.current;
    const step = st[i];
    if (!step) return;
    if (vb && Platform.OS !== 'web') {
      if (step.kind === 'step') hapticStep();
      else if (step.kind === 'tap') hapticSelect();
    }
    if (sp) {
      stopSpeech();
      try {
        // faster tempos need a quicker voice or the words pile up behind the beat
        Speech.speak(spokenCount(step.count), { rate: Math.min(1.9, Math.max(0.9, 0.75 + b / 220)) });
      } catch {
        // ignore: no voice available
      }
    }
  }, []);

  useEffect(() => {
    if (!speak) stopSpeech();
  }, [speak]);
  useFocusEffect(useCallback(() => () => stopSpeech(), []));
  useEffect(() => () => stopSpeech(), []);

  return onStep;
}

/** Stops speech as soon as playback is no longer playing. */
export function usePauseSilence(playing: boolean) {
  useEffect(() => {
    if (!playing) stopSpeech();
  }, [playing]);
}
