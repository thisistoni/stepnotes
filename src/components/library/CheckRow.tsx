import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { DiagramThumb, hapticSelect, Icon, Text, useReducedMotion } from '@/components/ui';
import { colors, DEFAULT_FOOT_STYLE, motion, radius, space, styleColor } from '@/lib/theme';
import type { Dance } from '@/lib/types';

/** A checklist row for the collection sheets: leading tile, title + subtitle, round check that pops. */
export function CheckRow({
  leading,
  title,
  subtitle,
  checked,
  onPress,
  accessibilityLabel,
  testID,
}: {
  leading: ReactNode;
  title: string;
  subtitle?: string;
  checked: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      aria-checked={checked}
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}, ${subtitle}` : title)}
      style={({ pressed }) => [s.row, pressed && s.pressed]}
      testID={testID}
    >
      {leading}
      <View style={s.text}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="caption" color="ink2" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <Check checked={checked} />
    </Pressable>
  );
}

function Check({ checked }: { checked: boolean }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced || !checked) return;
    scale.set(withSequence(withTiming(0.8, { duration: 70 }), withSpring(1, motion.pop)));
  }, [checked, reduced, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View style={[s.check, checked ? s.checkOn : s.checkOff, pop]}>
      {checked && <Icon name="check" size={18} color={colors.onColor} strokeWidth={3} />}
    </Animated.View>
  );
}

/** Small tinted tile with the dance's diagram (leading element of a dance row). */
export function DanceThumbTile({ dance }: { dance: Dance }) {
  const tone = styleColor(dance.style);
  return (
    <View style={[s.tile, { backgroundColor: tone.tint }]}>
      <DiagramThumb pattern={dance.roles.leader} tone={tone} footStyle={dance.footStyle?.leader ?? DEFAULT_FOOT_STYLE.leader} style={s.thumb} />
    </View>
  );
}

/** Icon tile (leading element of a collection row). */
export function IconTile({ children }: { children: ReactNode }) {
  return <View style={[s.tile, s.iconTile]}>{children}</View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 64, paddingHorizontal: space.xs, paddingVertical: space.xs, borderRadius: radius.md },
  pressed: { backgroundColor: colors.track },
  text: { flex: 1, gap: 1 },
  check: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  checkOff: { borderColor: colors.radio, backgroundColor: colors.card },
  checkOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  tile: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden' },
  thumb: { position: 'absolute', left: 4, right: 4, top: 4, bottom: 4 },
  iconTile: { backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
});
