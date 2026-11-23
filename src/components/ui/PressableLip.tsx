import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { colors as C, lip as LIP, motion, radius as R } from '@/lib/theme';

import { hapticPress } from './feedback';

/** Face / lip / optional 2px border colours of a lip surface. */
export interface LipColors {
  base: string;
  lip: string;
  border?: string;
}

/** White card surface (default). */
export const CARD_LIP: LipColors = { base: C.card, lip: C.cardLip, border: C.cardBorder };
/** Muted, flattened look for disabled controls. */
export const DISABLED_LIP: LipColors = { base: C.track, lip: C.cardLip, border: C.track };

export interface PressableLipProps extends Omit<PressableProps, 'style' | 'children' | 'disabled'> {
  /** Face + lip (+ border) colours. Default: white card. */
  colors?: LipColors;
  /** Colours while disabled. Default: muted well. */
  disabledColors?: LipColors;
  radius?: number;
  /** Lip depth in px (0 = flat, press feedback becomes a fade). Default 5. */
  lipDepth?: number;
  disabled?: boolean;
  /** Marks the control as selected for assistive tech (colours are the caller's choice). */
  selected?: boolean;
  /** Light haptic on press-in (native only). Default true. */
  haptic?: boolean;
  /** Outer box: margins, flex, width, alignSelf. Never put padding here. */
  style?: StyleProp<ViewStyle>;
  /** The face: padding, height, alignment, flexDirection. */
  faceStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * THE signature primitive: a face sitting on a solid darker lip. Pressing slides the face down
 * onto the lip (spring + light haptic) without changing the layout height. Disabled surfaces are
 * flattened (face resting on the floor) and muted.
 */
export function PressableLip({
  colors = CARD_LIP,
  disabledColors = DISABLED_LIP,
  radius = R.lg,
  lipDepth = LIP.lg,
  disabled = false,
  selected,
  haptic = true,
  style,
  faceStyle,
  children,
  onPressIn,
  onPressOut,
  accessibilityRole = 'button',
  accessibilityState,
  ...rest
}: PressableLipProps) {
  const down = useSharedValue(disabled ? 1 : 0);
  useEffect(() => {
    down.set(withTiming(disabled ? 1 : 0, { duration: motion.fast }));
  }, [disabled, down]);

  const flat = lipDepth === 0;
  const faceAnim = useAnimatedStyle(() =>
    flat ? { opacity: 1 - down.get() * 0.4 } : { transform: [{ translateY: down.get() * lipDepth }] },
  );

  const c = disabled ? disabledColors : colors;
  // State is also passed as ARIA props: react-native-web ignores `accessibilityState`, and RN
  // supports the aria-* props natively. Radios / switches / checkboxes are "checked", the rest "selected".
  const state = { disabled, selected, ...accessibilityState };
  const checkable = accessibilityRole === 'radio' || accessibilityRole === 'switch' || accessibilityRole === 'checkbox';
  const checked = state.checked ?? (checkable ? !!state.selected : undefined);
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={state}
      aria-disabled={state.disabled || undefined}
      aria-busy={state.busy || undefined}
      aria-checked={checkable ? checked === true : undefined}
      aria-selected={!checkable && state.selected != null ? !!state.selected : undefined}
      disabled={disabled}
      onPressIn={(e) => {
        down.set(withSpring(1, motion.pressIn));
        if (haptic) hapticPress();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!disabled) down.set(withSpring(0, motion.pressOut));
        onPressOut?.(e);
      }}
      style={style}
      {...rest}
    >
      {!flat && <View style={[StyleSheet.absoluteFill, { top: lipDepth, backgroundColor: c.lip, borderRadius: radius }]} />}
      <Animated.View
        style={[
          s.face,
          {
            backgroundColor: c.base,
            borderRadius: radius,
            marginBottom: flat ? 0 : lipDepth,
            borderWidth: c.border ? 2 : 0,
            borderColor: c.border,
          },
          faceStyle,
          faceAnim,
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

/**
 * A static (non-pressable) lip surface: same look as PressableLip at rest.
 */
export function LipSurface({
  colors = CARD_LIP,
  radius = R.card,
  lipDepth = LIP.lg,
  style,
  faceStyle,
  children,
}: {
  colors?: LipColors;
  radius?: number;
  lipDepth?: number;
  style?: StyleProp<ViewStyle>;
  faceStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  return (
    <View style={style}>
      {lipDepth > 0 && (
        <View style={[StyleSheet.absoluteFill, { top: lipDepth, backgroundColor: colors.lip, borderRadius: radius }]} />
      )}
      <View
        style={[
          s.face,
          {
            backgroundColor: colors.base,
            borderRadius: radius,
            marginBottom: lipDepth,
            borderWidth: colors.border ? 2 : 0,
            borderColor: colors.border,
          },
          faceStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  face: { flexGrow: 1 },
});
