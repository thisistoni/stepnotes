import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors, fonts, lip, motion, radius, TONE, withAlpha, type ColorSet } from '@/lib/theme';

import { Icon, type IconName } from '../Icon';
import { hapticSelect } from './feedback';
import { Text } from './Text';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Leading icon */
  icon?: IconName;
  /** Leading custom node (e.g. a footprint glyph); receives whether the option is selected */
  leading?: (selected: boolean) => ReactNode;
  /** Leading colour dot */
  dot?: string;
  /** Thumb colour when this option is selected (e.g. follower pink). Default: `color`. */
  tone?: ColorSet;
  accessibilityLabel?: string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** default (46 high, well track, coloured thumb with lip) · compact (34, white pill, ink thumb — stage overlays) */
  variant?: 'default' | 'compact';
  /** Thumb colour (default green; compact: ink) */
  color?: ColorSet;
  /** Accessible name of the group */
  label?: string;
  /** compact only: width of each option (default 92) */
  itemWidth?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SIZES = {
  default: { h: 46, pad: 4, gap: 4, r: radius.md, thumbR: 14, lip: lip.sm },
  compact: { h: 36, pad: 3, gap: 2, r: 13, thumbR: 10, lip: 0 },
};

/** Segmented control with a springy sliding thumb (with lip). Equal-width options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant = 'default',
  color,
  label,
  itemWidth = 92,
  style,
  testID,
}: SegmentedProps<T>) {
  const sz = SIZES[variant];
  const compact = variant === 'compact';
  const base = color ?? (compact ? TONE.ink : TONE.primary);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const [width, setWidth] = useState(0);
  const pos = useSharedValue(index);
  const itemW = width > 0 ? (width - sz.pad * 2 - sz.gap * (options.length - 1)) / options.length : 0;

  useEffect(() => {
    pos.set(withSpring(index, motion.slide));
  }, [index, pos]);

  const tones = options.map((o) => o.tone ?? base);
  const faces = tones.map((t) => t.base);
  const lips = tones.map((t) => t.lip);
  const idx = options.map((_, i) => i);
  const thumbStyle = useAnimatedStyle(() => {
    const p = pos.get();
    return {
      transform: [{ translateX: p * (itemW + sz.gap) }],
      backgroundColor: options.length > 1 ? interpolateColor(p, idx, faces) : faces[0],
    };
  });
  const lipStyle = useAnimatedStyle(() => ({
    backgroundColor: options.length > 1 ? interpolateColor(pos.get(), idx, lips) : lips[0],
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const measured = itemW > 0;

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      testID={testID}
      onLayout={onLayout}
      style={[
        s.track,
        { height: sz.h, borderRadius: sz.r, padding: sz.pad, gap: sz.gap },
        compact && s.compactTrack,
        style,
      ]}
    >
      {measured && (
        <Animated.View
          pointerEvents="none"
          style={[s.thumb, { left: sz.pad, top: sz.pad, bottom: sz.pad, width: itemW, borderRadius: sz.thumbR }, thumbStyle]}
        >
          {sz.lip > 0 && (
            <Animated.View style={[s.thumbLip, { height: sz.lip, borderBottomLeftRadius: sz.thumbR, borderBottomRightRadius: sz.thumbR }, lipStyle]} />
          )}
        </Animated.View>
      )}
      {options.map((o, i) => {
        const selected = i === index;
        const t = tones[i];
        const fg = selected ? t.on : colors.ink2;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.accessibilityLabel ?? o.label}
            onPress={() => {
              if (o.value === value) return;
              hapticSelect();
              onChange(o.value);
            }}
            hitSlop={compact ? 4 : 0}
            style={[
              s.item,
              { borderRadius: sz.thumbR },
              compact ? { width: itemWidth } : s.grow,
              // before the first layout the selected option paints its own background (no flash)
              !measured && selected && { backgroundColor: t.base },
            ]}
          >
            {o.leading?.(selected)}
            {o.dot && <View style={[s.dot, { backgroundColor: o.dot }]} />}
            {o.icon && <Icon name={o.icon} size={compact ? 14 : 17} color={fg} strokeWidth={2.6} />}
            <Text
              variant={compact ? 'caption' : 'heading'}
              color={fg}
              numberOfLines={1}
              style={compact ? s.compactLabel : s.label}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: colors.track, alignSelf: 'stretch' },
  compactTrack: {
    backgroundColor: colors.card,
    alignSelf: 'flex-start',
    boxShadow: [{ offsetX: 0, offsetY: 3, blurRadius: 0, color: withAlpha(colors.ink, 0.1) }],
  },
  thumb: { position: 'absolute', overflow: 'hidden' },
  thumbLip: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  grow: { flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 3 },
  label: { fontSize: 15.5, lineHeight: 20 },
  compactLabel: { fontFamily: fonts.body800, fontSize: 12.5, lineHeight: 16 },
});
