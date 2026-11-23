import { useEffect, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { colors, lip, motion, radius, ROLE_COLOR, type ColorSet } from '@/lib/theme';

import { Icon, type IconName } from '../Icon';
import { hapticSelect, useReducedMotion } from './feedback';
import { PressableLip, type LipColors } from './PressableLip';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** filter: off = white, on = ink. toggle: off = white, on = pale tone with coloured lip. */
  variant?: 'filter' | 'toggle';
  /** Small colour square before the label (style filters) */
  dot?: string;
  icon?: IconName;
  /** Colour family for an "on" toggle (default leader green, as in the mock's Loop chip) */
  tone?: ColorSet & { border?: string; light?: string };
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  /** e.g. `{ flex: 1 }` for a row of equal toggles */
  style?: StyleProp<ViewStyle>;
}

/** Filter chip (with optional colour dot) or toggle chip (icon + label, tinted when on). Pops on toggle. */
export function Chip({
  label,
  selected = false,
  onPress,
  variant = 'filter',
  dot,
  icon,
  tone = ROLE_COLOR.leader,
  disabled,
  accessibilityLabel,
  testID,
  style,
}: ChipProps) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) return;
    scale.set(withSequence(withTiming(0.94, { duration: 70 }), withSpring(1, motion.pop)));
  }, [selected, reduced, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  let lipColors: LipColors = { base: colors.card, lip: colors.cardLip, border: colors.cardBorder };
  let fg: string = colors.ink2;
  if (selected && variant === 'filter') {
    lipColors = { base: colors.ink, lip: colors.inkLip, border: colors.ink };
    fg = colors.onColor;
  } else if (selected) {
    lipColors = { base: tone.tint, lip: tone.light ?? tone.base, border: tone.border ?? tone.tint };
    fg = tone.deep;
  } else if (variant === 'filter') {
    fg = colors.ink;
  }

  return (
    <Animated.View style={[pop, style]}>
      <PressableLip
        onPress={() => {
          hapticSelect();
          onPress?.();
        }}
        haptic={false}
        disabled={disabled}
        selected={selected}
        colors={lipColors}
        radius={radius.chip}
        lipDepth={lip.md}
        // toggle chips are switches; filter chips pick one of a set (a radio group)
        accessibilityRole={variant === 'toggle' ? 'switch' : 'radio'}
        accessibilityState={{ checked: !!selected }}
        accessibilityLabel={accessibilityLabel ?? label}
        hitSlop={4}
        testID={testID}
        faceStyle={[s.face, variant === 'toggle' && s.toggleFace]}
      >
        {dot && <View style={[s.dot, { backgroundColor: dot }]} />}
        {icon && <Icon name={icon} size={17} color={disabled ? colors.ink3 : fg} strokeWidth={2.6} />}
        <Text variant="smallStrong" color={disabled ? colors.ink3 : fg} numberOfLines={1} style={[s.text, variant === 'toggle' && s.toggleText]}>
          {label}
        </Text>
      </PressableLip>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  face: { height: 36, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  toggleFace: { paddingHorizontal: 8, gap: 6 },
  text: { flexShrink: 1 },
  toggleText: { fontSize: 13.5 },
  dot: { width: 10, height: 10, borderRadius: 4 },
});
