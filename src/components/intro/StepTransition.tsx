import { useEffect, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '@/components/ui';

const DURATION = 280;
const OFFSET = 32;

/**
 * Slides + fades a step in from the side it comes from (forward → from the right, back → from
 * the left). Mount it with a `key` per step. Reduced motion → fade only.
 */
export function StepTransition({ direction, children }: { direction: 1 | -1 | 0; children: ReactNode }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(direction === 0 ? 1 : 0);
  useEffect(() => {
    v.set(withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) }));
  }, [v]);
  const st = useAnimatedStyle(() => ({
    opacity: v.get(),
    transform: [{ translateX: reduced ? 0 : (1 - v.get()) * OFFSET * direction }],
  }));
  return <Animated.View style={[s.fill, st]}>{children}</Animated.View>;
}

const s = StyleSheet.create({
  fill: { flex: 1 },
});
