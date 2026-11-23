import { useFocusEffect } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { hapticSelect, hapticStep } from '@/components/ui';
import { speechLanguage, type Strings } from '@/lib/i18n';
import { spokenCount } from '@/lib/pattern';
import type { Step } from '@/lib/types';

interface CueOptions {
  steps: Step[];
  speak: boolean;
  vibrate: boolean;
  /** effective tempo, to pace the voice */
  bpm: number;
  /** the app's language: what to say ("und") and which voice says it */
  t: Strings;
}

/** Silence any spoken count (safe to call anywhere). */
export function stopSpeech() {
  try {
    // stop() is async: a rejection (no speech engine) must not surface as an unhandled rejection
    Promise.resolve(Speech.stop()).catch(() => {});
  } catch {
    // speech synthesis unavailable (some browsers): nothing to stop
  }
}

/**
 * Spoken counts and step haptics for the player. Returns `onStep` for usePlayback (called once per
 * step boundary while playing). Speech stops when the screen loses focus or unmounts, and when
 * "Say counts" is switched off; call `usePauseSilence(playing)` to also stop it on pause. "&" is spoken
 * as "and" / "und" in the voice of the app's language: `language` is a bare "de" on Android
 * (expo-speech hands it to Locale.Builder.setLanguage, which rejects regions and then falls back
 * to the device language) and "de-DE" on iOS / web (no de-AT voice ships; an unknown tag on iOS
 * also falls back to the system voice).
 */
export function usePlayerCues({ steps, speak, vibrate, bpm, t }: CueOptions) {
  const opts = useRef({ steps, speak, vibrate, bpm, t });
  useLayoutEffect(() => {
    opts.current = { steps, speak, vibrate, bpm, t };
  });

  const onStep = useCallback((i: number) => {
    const { steps: st, speak: sp, vibrate: vb, bpm: b, t: tr } = opts.current;
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
        Speech.speak(spokenCount(step.count, tr), {
          language: speechLanguage(tr),
          rate: Math.min(1.9, Math.max(0.9, 0.75 + b / 220)),
        });
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
