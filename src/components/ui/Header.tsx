import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { fonts, space } from '@/lib/theme';

import { IconButton } from './IconButton';
import { Text } from './Text';

export interface HeaderProps {
  title?: string;
  /** Small line under the title ("Ballroom · 3/4 · 84 bpm") */
  subtitle?: string;
  /** Colour square before the subtitle (style colour) */
  subtitleDot?: string;
  /** Small line ABOVE a large title */
  eyebrow?: string;
  /** Left control: back chevron (default), close ✕ (modals), or none */
  leading?: 'back' | 'close' | 'none';
  /** Override the back action. Default: go back, or replace to `/` when there is no history. */
  onBack?: () => void;
  /** Right-side actions (IconButtons) */
  right?: ReactNode;
  /** Large title (home screen) instead of the regular one */
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Go back, or to the library when the screen was opened directly (deep link / web reload). */
export function goBackOrHome() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * Screen header: back/close IconButton, title + subtitle (left-aligned, like the player and editor bars), right actions. Never flush to
 * the screen edge (20px inset). `large` gives the home-screen title instead.
 */
export function Header({
  title,
  subtitle,
  subtitleDot,
  eyebrow,
  leading = 'back',
  onBack,
  right,
  large,
  style,
}: HeaderProps) {
  if (large) {
    return (
      <View style={[s.large, style]}>
        <View style={s.largeText}>
          {!!eyebrow && (
            <Text variant="smallStrong" color="ink2" numberOfLines={1}>
              {eyebrow}
            </Text>
          )}
          {!!title && (
            <Text variant="display" accessibilityRole="header" numberOfLines={2}>
              {title}
            </Text>
          )}
        </View>
        {right && <View style={s.actions}>{right}</View>}
      </View>
    );
  }
  const back =
    leading === 'none' ? null : (
      <IconButton
        icon={leading === 'close' ? 'close' : 'back'}
        label={leading === 'close' ? 'Close' : 'Back'}
        onPress={onBack ?? goBackOrHome}
        testID="header-back"
      />
    );
  return (
    <View style={[s.bar, style]}>
      {back}
      <View style={s.center}>
        {!!title && (
          <Text variant="heading" numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        )}
        {!!subtitle && (
          <View style={s.subRow}>
            {!!subtitleDot && <View style={[s.dot, { backgroundColor: subtitleDot }]} />}
            <Text variant="caption" color="ink2" numberOfLines={1} style={s.subText}>
              {subtitle}
            </Text>
          </View>
        )}
      </View>
      {right && <View style={[s.side, s.sideRight]}>{right}</View>}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: space.s, paddingBottom: space.s, gap: space.s },
  side: { flexDirection: 'row', gap: space.s },
  sideRight: { justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'flex-start', minWidth: 0, paddingLeft: 4 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, maxWidth: '100%' },
  subText: { fontFamily: fonts.body800, flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 3 },
  large: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingTop: space.m,
    paddingBottom: space.xs,
    gap: space.m,
  },
  largeText: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.s, paddingTop: 4 },
});
