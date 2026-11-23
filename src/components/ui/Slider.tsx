import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors, motion, TONE, type ColorSet } from '@/lib/theme';

import { hapticSelect } from './feedback';

export interface SliderProps {
  value: number;
  /** Called with each new snapped value while dragging / tapping */
  onChange: (value: number) => void;
  /** Called once when the user lets go */
  onChangeEnd?: (value: number) => void;
  min: number;
  max: number;
  /** Snap step (default 1) */
  step?: number;
  /** Accessible name ("Tempo") */
  label: string;
  /** Spoken / displayed value ("75 percent") */
  formatValue?: (v: number) => string;
  disabled?: boolean;
  tone?: ColorSet;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const THUMB = 24;

/**
 * Snapping slider: drag or tap anywhere on the track; the thumb (with lip) snaps to `step` with a
 * selection haptic per snap. Controlled. Arrow keys on web; increment / decrement for screen readers.
 */
export function Slider({
  value,
  onChange,
  onChangeEnd,
  min,
  max,
  step = 1,
  label,
  formatValue,
  disabled,
  tone = TONE.primary,
  testID,
  style,
}: SliderProps) {
  const span = Math.max(1e-6, max - min);
  const toP = (v: number) => Math.min(1, Math.max(0, (v - min) / span));
  const width = useSharedValue(0);
  const p = useSharedValue(toP(value));
  const dragging = useSharedValue(false);
  const lastSent = useSharedValue(value);

  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
    if (!dragging.get()) {
      lastSent.set(value);
      p.set(withSpring(toP(value), motion.slide));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (v: number) => {
    if (v === latest.current) return;
    latest.current = v;
    hapticSelect();
    onChange(v);
  };
  const end = () => onChangeEnd?.(latest.current);

  const moveTo = (x: number) => {
    'worklet';
    const w = width.get();
    if (w <= 0) return;
    const raw = min + Math.min(1, Math.max(0, x / w)) * span;
    const snapped = Math.min(max, Math.max(min, Math.round((raw - min) / step) * step + min));
    const rounded = Math.round(snapped * 1e6) / 1e6;
    p.set(withSpring((rounded - min) / span, { duration: 140, dampingRatio: 1 }));
    if (rounded !== lastSent.get()) {
      lastSent.set(rounded);
      scheduleOnRN(emit, rounded);
    }
  };

  const pan = usePanGesture({
    enabled: !disabled,
    activeOffsetX: [-4, 4],
    failOffsetY: [-12, 12],
    onActivate: (e) => {
      'worklet';
      dragging.set(true);
      moveTo(e.x);
    },
    onUpdate: (e) => {
      'worklet';
      moveTo(e.x);
    },
    onDeactivate: () => {
      'worklet';
      dragging.set(false);
      scheduleOnRN(end);
    },
  });
  const tap = useTapGesture({
    enabled: !disabled,
    onActivate: (e) => {
      'worklet';
      moveTo(e.x);
      scheduleOnRN(end);
    },
  });
  const gesture = useSimultaneousGestures(pan, tap);

  const fillStyle = useAnimatedStyle(() => ({ width: `${p.get() * 100}%` }));
  const thumbStyle = useAnimatedStyle(() => ({ left: `${p.get() * 100}%` }));

  const nudge = (dir: 1 | -1) => {
    const next = Math.min(max, Math.max(min, Math.round((latest.current + dir * step) * 1e6) / 1e6));
    emit(next);
    onChangeEnd?.(next);
  };
  const webKeys =
    Platform.OS === 'web'
      ? {
          // react-native-web passes the DOM keyboard event
          onKeyDown: (ev: unknown) => {
            const e = ev as { key: string; preventDefault: () => void };
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              nudge(1);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              nudge(-1);
            }
          },
        }
      : {};

  const text = formatValue ? formatValue(value) : String(value);
  const c = disabled ? { base: colors.ink3, lip: colors.cardLip } : tone;
  return (
    <GestureDetector gesture={gesture}>
      <View
        testID={testID}
        style={[s.hit, style]}
        onLayout={(e: LayoutChangeEvent) => width.set(e.nativeEvent.layout.width)}
        accessible
        focusable={!disabled}
        tabIndex={disabled ? -1 : 0}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        aria-disabled={!!disabled}
        accessibilityValue={{ min, max, now: value, text }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        {...webKeys}
      >
        <View style={s.track}>
          <Animated.View style={[s.fill, { backgroundColor: c.base }, fillStyle]} />
        </View>
        <Animated.View style={[s.thumbWrap, thumbStyle]} pointerEvents="none">
          <View style={[s.thumbLip, { backgroundColor: c.lip }]} />
          <View style={[s.thumb, { borderColor: c.base }]} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const s = StyleSheet.create({
  hit: { height: 44, justifyContent: 'center', marginHorizontal: THUMB / 2 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.trackDeep, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  thumbWrap: { position: 'absolute', top: (44 - THUMB) / 2 - 1, width: THUMB, height: THUMB + 2, marginLeft: -THUMB / 2 },
  thumbLip: { position: 'absolute', top: 2, left: 0, width: THUMB, height: THUMB, borderRadius: THUMB / 2 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.card,
    borderWidth: 3.5,
  },
});
