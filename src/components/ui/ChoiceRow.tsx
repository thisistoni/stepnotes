import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { colors, lip, motion, radius, ROLE_COLOR, type ColorSet } from '@/lib/theme';

import { Icon, type IconName } from '../Icon';
import { hapticSelect, useReducedMotion } from './feedback';
import { PressableLip } from './PressableLip';
import { Text } from './Text';

export interface ChoiceRowProps {
  title: string;
  subtitle?: string;
  /** Icon in the tile, or any node (e.g. a footprint sticker) */
  icon?: IconName | ReactNode;
  /** Tile colours: tile = tone.tint, icon = tone.base (default leader green) */
  tone?: ColorSet;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Big onboarding choice card: icon tile, title, subtitle and a radio that pops into a check. */
export function ChoiceRow({ title, subtitle, icon, tone = ROLE_COLOR.leader, selected, onPress, testID, style }: ChoiceRowProps) {
  const reduced = useReducedMotion();
  const check = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    check.set(reduced ? withTiming(selected ? 1 : 0, { duration: motion.fast }) : withSpring(selected ? 1 : 0, motion.pop));
  }, [selected, reduced, check]);
  const checkStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, check.get() * 1.5),
    transform: [{ scale: reduced ? 1 : 0.4 + 0.6 * check.get() }],
  }));

  const g = ROLE_COLOR.leader;
  return (
    <PressableLip
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      haptic={false}
      selected={selected}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      colors={selected ? { base: g.wash, lip: g.lip, border: g.base } : undefined}
      radius={radius.card}
      lipDepth={lip.lg}
      testID={testID}
      style={style}
      faceStyle={s.face}
    >
      <View style={[s.tile, { backgroundColor: tone.tint }]}>
        {typeof icon === 'string' ? <Icon name={icon as IconName} size={28} color={tone.base} strokeWidth={2.4} /> : icon}
      </View>
      <View style={s.text}>
        <Text variant="cardTitle">{title}</Text>
        {!!subtitle && (
          <Text variant="small" color="ink2" style={s.sub}>
            {subtitle}
          </Text>
        )}
      </View>
      <View style={[s.radio, selected && { borderColor: g.base }]}>
        <Animated.View style={[s.check, { backgroundColor: g.base }, checkStyle]}>
          <Icon name="check" size={16} color={colors.onColor} strokeWidth={3.4} />
        </Animated.View>
      </View>
    </PressableLip>
  );
}

const s = StyleSheet.create({
  face: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingLeft: 10, paddingRight: 16, minHeight: 76 },
  tile: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  sub: { marginTop: 2 },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: colors.radio,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { position: 'absolute', top: -2.5, left: -2.5, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
