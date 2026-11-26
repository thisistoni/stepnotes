import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { colors, lip, motion, radius, ROLE_COLOR, space } from '@/lib/theme';

import { hapticSelect, useReducedMotion } from './feedback';
import { PressableLip } from './PressableLip';
import { Text } from './Text';

export interface ToggleRowProps {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const TRAVEL = 20;

/** A setting that is on or off: title, a line of explanation and a switch. The whole row toggles. */
export function ToggleRow({ title, subtitle, value, onChange, testID, style }: ToggleRowProps) {
  const reduced = useReducedMotion();
  const on = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    on.set(reduced ? withTiming(value ? 1 : 0, { duration: motion.fast }) : withSpring(value ? 1 : 0, motion.slide));
  }, [value, reduced, on]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: on.get() * TRAVEL }] }));
  return (
    <PressableLip
      onPress={() => {
        hapticSelect();
        onChange(!value);
      }}
      haptic={false}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      radius={radius.lg}
      lipDepth={lip.md}
      testID={testID}
      style={style}
      faceStyle={s.face}
    >
      <View style={s.text}>
        <Text variant="label">{title}</Text>
        {!!subtitle && (
          <Text variant="caption" color="ink2" style={s.sub}>
            {subtitle}
          </Text>
        )}
      </View>
      <View style={[s.track, { backgroundColor: value ? ROLE_COLOR.leader.base : colors.radio }]}>
        <Animated.View style={[s.thumb, thumb]} />
      </View>
    </PressableLip>
  );
}

const s = StyleSheet.create({
  face: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingVertical: space.m, paddingHorizontal: space.l, minHeight: 60 },
  text: { flex: 1 },
  sub: { marginTop: 2 },
  track: { width: 52, height: 32, borderRadius: 16, padding: 3 },
  thumb: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.card },
});
