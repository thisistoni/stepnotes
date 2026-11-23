import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { motion } from '@/lib/theme';

import { useReducedMotion } from './feedback';

/** Mutable flag shared by a screen's entrances: closes `enterWindow` ms after the screen mounts. */
interface Scope {
  open: boolean;
}
const ScopeCtx = createContext<Scope | null>(null);

/**
 * Wrap a screen (Screen does this for you). Entrances that mount after the screen has settled
 * (search results, newly added cards) appear without animating.
 */
export function EntranceScope({ children }: { children: ReactNode }) {
  const [scope] = useState<Scope>(() => ({ open: true }));
  useEffect(() => {
    const t = setTimeout(() => {
      scope.open = false;
    }, motion.enterWindow);
    return () => clearTimeout(t);
  }, [scope]);
  return <ScopeCtx.Provider value={scope}>{children}</ScopeCtx.Provider>;
}

export interface EntranceProps {
  /** Position in the stagger (0, 1, 2…): delay = index × 40ms */
  index?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * Staggered fade-up (12px, 260ms) on FIRST mount only. Reduced motion → fade only.
 */
export function Entrance({ index = 0, disabled, style, children }: EntranceProps) {
  const scope = useContext(ScopeCtx);
  const reduced = useReducedMotion();
  const [animate] = useState(() => !disabled && (scope ? scope.open : true));
  const v = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) return;
    v.set(
      withDelay(
        Math.min(index, 10) * motion.enterStagger,
        withTiming(1, { duration: motion.enterDuration, easing: Easing.out(Easing.cubic) }),
      ),
    );
  }, [animate, index, v]);
  const st = useAnimatedStyle(() => ({
    opacity: v.get(),
    transform: [{ translateY: reduced ? 0 : (1 - v.get()) * motion.enterOffset }],
  }));
  return <Animated.View style={[style, st]}>{children}</Animated.View>;
}
