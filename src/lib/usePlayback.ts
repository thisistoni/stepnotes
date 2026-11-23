/**
 * Beat clock for the player, running on the UI thread.
 *
 *   const pb = usePlayback({ totalBeats, bpm, stepStartBeats, loop, onStep });
 *
 * Options
 *   totalBeats      length of the pattern in beats (0 → play() is a no-op)
 *   bpm             effective tempo (dance bpm × speed). Changing it mid-playback keeps the position.
 *   stepStartBeats  beat at which each step starts (memoise it: `useMemo(() => stepStartBeats(p), [p])`)
 *   loop            wrap around at the end; when false playback stops on the final pose
 *   onStep(i)       called on the JS thread exactly once per step boundary while playing
 *                   (also across the loop wrap-around); use it for haptics / spoken counts
 *
 * Returns
 *   beat            SharedValue<number>: continuous position in beats (-1 = start position).
 *                   Advanced by a Reanimated frame callback; never stored in React state, so the
 *                   screen does NOT re-render every frame. Pass it to <StepDiagram beat={...} />.
 *   index           current step (-1 = start position). React state, changes once per step.
 *   playing         React state
 *   play()          from the start position or the end: starts at beat 0; otherwise resumes
 *   pause()
 *   toggle()
 *   seekToStep(i)   pause and show step i finished (i = -1 → start position)
 *   restart()       jump to beat 0 and play
 *
 * Playback pauses automatically when the screen loses focus (Expo Router `useFocusEffect`) and
 * on unmount, so this hook must be used inside a route screen.
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFrameCallback, useSharedValue, type FrameCallback, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { stepIndexAt } from './pattern';

export interface PlaybackOptions {
  totalBeats: number;
  bpm: number;
  stepStartBeats: number[];
  loop: boolean;
  onStep?: (index: number) => void;
}

export interface Playback {
  beat: SharedValue<number>;
  index: number;
  playing: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekToStep: (index: number) => void;
  restart: () => void;
}

/** Longest frame gap we integrate in one go (a stalled UI thread must not teleport the dancer). */
const MAX_FRAME_MS = 250;

export function usePlayback({ totalBeats, bpm, stepStartBeats, loop, onStep }: PlaybackOptions): Playback {
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);

  const beat = useSharedValue(-1);
  const active = useSharedValue(false);
  const bpmSV = useSharedValue(bpm);
  const totalSV = useSharedValue(totalBeats);
  const loopSV = useSharedValue(loop);
  const startsSV = useSharedValue<number[]>(stepStartBeats);
  const lastIndex = useSharedValue(-1);
  const lastTs = useSharedValue(-1);

  useEffect(() => bpmSV.set(bpm), [bpm, bpmSV]);
  useEffect(() => totalSV.set(totalBeats), [totalBeats, totalSV]);
  useEffect(() => loopSV.set(loop), [loop, loopSV]);
  useEffect(() => startsSV.set(stepStartBeats), [stepStartBeats, startsSV]);

  const onStepRef = useRef(onStep);
  useLayoutEffect(() => {
    onStepRef.current = onStep;
  });

  const frameRef = useRef<FrameCallback | null>(null);

  // JS-thread callbacks invoked from the worklet
  const stepJS = useCallback((i: number) => {
    setIndex(i);
    onStepRef.current?.(i);
  }, []);
  const endedJS = useCallback(() => {
    frameRef.current?.setActive(false);
    setPlaying(false);
  }, []);

  const frame = useFrameCallback((info) => {
    'worklet';
    if (!active.get()) return;
    const total = totalSV.get();
    if (total <= 0) return;
    const prevTs = lastTs.get();
    lastTs.set(info.timestamp);
    if (prevTs < 0) return; // first frame after (re)start: just take the timestamp
    const dt = Math.min(MAX_FRAME_MS, Math.max(0, info.timestamp - prevTs));
    let next = Math.max(0, beat.get()) + ((dt / 1000) * bpmSV.get()) / 60;
    let wrapped = false;
    let ended = false;
    if (next >= total) {
      if (loopSV.get()) {
        next = next % total;
        wrapped = true;
      } else {
        next = total;
        ended = true;
      }
    }
    beat.set(next);

    const starts = startsSV.get();
    const idx = stepIndexAt(starts, total, next);
    let last = lastIndex.get();
    if (wrapped) {
      for (let i = last + 1; i < starts.length; i++) scheduleOnRN(stepJS, i);
      last = -1;
    }
    if (idx > last) {
      for (let i = last + 1; i <= idx; i++) scheduleOnRN(stepJS, i);
    } else if (idx < last) {
      scheduleOnRN(stepJS, idx); // pattern got shorter while playing
    }
    lastIndex.set(idx);

    if (ended) {
      active.set(false);
      scheduleOnRN(endedJS);
    }
  }, false);
  useLayoutEffect(() => {
    frameRef.current = frame;
  });

  const play = useCallback(() => {
    const total = totalSV.get();
    if (total <= 0) return;
    const b = beat.get();
    if (b < 0 || b >= total - 1e-6) {
      beat.set(0);
      lastIndex.set(-1); // step 0 fires on the first frame
    } else {
      lastIndex.set(stepIndexAt(startsSV.get(), total, b));
    }
    lastTs.set(-1);
    active.set(true);
    frameRef.current?.setActive(true);
    setPlaying(true);
  }, [beat, totalSV, startsSV, lastIndex, lastTs, active]);

  const pause = useCallback(() => {
    active.set(false);
    frameRef.current?.setActive(false);
    setPlaying(false);
    setIndex(stepIndexAt(startsSV.get(), totalSV.get(), beat.get()));
  }, [active, beat, startsSV, totalSV]);

  const seekToStep = useCallback(
    (i: number) => {
      active.set(false);
      frameRef.current?.setActive(false);
      setPlaying(false);
      const starts = startsSV.get();
      const total = totalSV.get();
      if (i < 0 || i >= starts.length) {
        beat.set(-1);
        setIndex(-1);
        return;
      }
      const end = i + 1 < starts.length ? starts[i + 1] : total;
      beat.set(starts[i] + (end - starts[i]) * 0.75); // the step's move is finished at 60 %
      lastIndex.set(i);
      setIndex(i);
    },
    [active, beat, startsSV, totalSV, lastIndex],
  );

  const restart = useCallback(() => {
    beat.set(-1);
    play();
  }, [beat, play]);

  const playingRef = useRef(playing);
  useLayoutEffect(() => {
    playingRef.current = playing;
  });
  const toggle = useCallback(() => (playingRef.current ? pause() : play()), [pause, play]);

  // stop the clock when the screen is left (blur) or unmounted
  const pauseRef = useRef(pause);
  useLayoutEffect(() => {
    pauseRef.current = pause;
  });
  useFocusEffect(useCallback(() => () => pauseRef.current(), []));
  useEffect(
    () => () => {
      active.set(false);
    },
    [active],
  );

  return { beat, index, playing, play, pause, toggle, seekToStep, restart };
}
