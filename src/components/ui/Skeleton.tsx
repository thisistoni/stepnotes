import { useEffect } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, radius as R } from '@/lib/theme';

import { useReducedMotion } from './feedback';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Pulsing placeholder block (static when reduced motion is on). */
export function Skeleton({ width = '100%', height = 16, radius = R.xs, style }: SkeletonProps) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (!reduced) v.set(withRepeat(withTiming(1, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [reduced, v]);
  const st = useAnimatedStyle(() => ({ opacity: 1 - v.get() * 0.45 }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.track }, style, st]}
    />
  );
}
