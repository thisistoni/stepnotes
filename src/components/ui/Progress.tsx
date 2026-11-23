import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { colors, motion, TONE, withAlpha, type ColorSet } from '@/lib/theme';

import { useReducedMotion } from './feedback';

// --- SegmentedProgress -------------------------------------------------------------------------

export interface SegmentedProgressProps {
  /** Number of segments */
  total: number;
  /** How many are filled (0…total) */
  value: number;
  tone?: ColorSet;
  style?: StyleProp<ViewStyle>;
}

/** Onboarding-style progress pills; newly filled pills fill with a springy overshoot. */
export function SegmentedProgress({ total, value, tone = TONE.primary, style }: SegmentedProgressProps) {
  return (
    <View
      style={[s.pills, style]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: value, text: `Step ${value} of ${total}` }}
    >
      {Array.from({ length: total }, (_, i) => (
        <Pill key={i} on={i < value} color={tone.base} />
      ))}
    </View>
  );
}

function Pill({ on, color }: { on: boolean; color: string }) {
  const reduced = useReducedMotion();
  const fill = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    fill.set(reduced ? withTiming(on ? 1 : 0, { duration: motion.base }) : withSpring(on ? 1 : 0, motion.fill));
  }, [on, reduced, fill]);
  const st = useAnimatedStyle(() => ({ width: `${Math.max(0, fill.get()) * 100}%`, opacity: reduced ? fill.get() : 1 }));
  return (
    <View style={s.pill}>
      <Animated.View style={[s.pillFill, { backgroundColor: color }, st]}>
        <View style={s.shine} />
      </Animated.View>
    </View>
  );
}

// --- ProgressRing --------------------------------------------------------------------------------

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface ProgressRingProps {
  /** 0…1, usually derived on the UI thread from the playback beat */
  progress: SharedValue<number>;
  /** Outer size in px (default 76) */
  size?: number;
  strokeWidth?: number;
  tone?: ColorSet;
  /** Track colour (default pale green) */
  trackColor?: string;
  /** Centred content (e.g. the play IconButton) */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** SVG ring that sweeps with a Reanimated shared value (no React renders while it moves). */
export function ProgressRing({
  progress,
  size = 76,
  strokeWidth = 5,
  tone = TONE.primary,
  trackColor,
  children,
  style,
}: ProgressRingProps) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const props = useAnimatedProps(() => {
    const v = Math.min(1, Math.max(0, progress.get()));
    // a round cap would leave a dot at 0: hide the arc until it has length
    return { strokeDashoffset: circ * (1 - v), strokeOpacity: v > 0.004 ? 1 : 0 };
  });
  return (
    <View style={[{ width: size, height: size }, s.ring, style]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor ?? withAlpha(tone.base, 0.14)} strokeWidth={strokeWidth} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tone.base}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          animatedProps={props}
        />
      </Svg>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  pills: { flexDirection: 'row', gap: 6, flex: 1 },
  pill: { flex: 1, height: 12, borderRadius: 6, backgroundColor: colors.trackDeep, overflow: 'hidden' },
  pillFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6 },
  shine: { position: 'absolute', left: 6, right: 6, top: 3, height: 3, borderRadius: 2, backgroundColor: withAlpha(colors.card, 0.4) },
  ring: { alignItems: 'center', justifyContent: 'center' },
});
