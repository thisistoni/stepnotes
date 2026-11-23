import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A beat clock. `beat` runs from 0 to `total` (in beats) and loops.
 * beat = -1 means "standing in the start position".
 */
export function usePlayback(total: number, bpm: number) {
  const [beat, setBeat] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const beatRef = useRef(beat);
  const updateBeat = useCallback((b: number) => {
    beatRef.current = b;
    setBeat(b);
  }, []);

  useEffect(() => {
    if (!playing || total <= 0) return;
    let raf = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = (now - last) / 1000;
      last = now;
      let next = Math.max(0, beatRef.current) + (dt * bpm) / 60;
      if (next >= total) {
        if (loop) next = next % total;
        else {
          next = total - 0.001;
          setPlaying(false);
        }
      }
      updateBeat(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total, bpm, loop, updateBeat]);

  const toggle = useCallback(() => {
    if (!playing && (beatRef.current < 0 || beatRef.current >= total - 0.01)) updateBeat(0);
    setPlaying(!playing);
  }, [playing, total, updateBeat]);

  const seek = useCallback(
    (b: number) => {
      setPlaying(false);
      updateBeat(b);
    },
    [updateBeat],
  );

  return { beat, playing, loop, setLoop, toggle, seek, setPlaying };
}
