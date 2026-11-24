import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, layout, lip, radius, TONE, typography, type ColorSet } from '@/lib/theme';

import { Icon, type IconName } from '../Icon';
import { PressableLip, type LipColors } from './PressableLip';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'tinted' | 'danger' | 'ghost';
export type ButtonSize = 'lg' | 'md' | 'sm';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  /** primary (green), secondary (white card), tinted (pale tone), danger (red), ghost (text only). Default primary. */
  variant?: ButtonVariant;
  /** lg 56 · md 48 · sm 40 (face height; the lip adds 5 / 4 / 3). Default lg. */
  size?: ButtonSize;
  /** Colour family for primary / tinted (default green). E.g. `TONE.follower`, `styleColor(s)`. */
  tone?: ColorSet;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  /** Shrink to content instead of stretching (default: stretch in a column) */
  inline?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

const SIZES: Record<ButtonSize, { h: number; lip: number; r: number; font: number; icon: number; px: number }> = {
  lg: { h: 56, lip: lip.lg, r: radius.lg, font: 19, icon: 22, px: 24 },
  md: { h: 48, lip: lip.md, r: radius.md, font: 17, icon: 20, px: 20 },
  sm: { h: 40, lip: lip.sm, r: radius.chip, font: 15, icon: 18, px: 14 },
};

function look(variant: ButtonVariant, tone: ColorSet): { lip: LipColors; text: string } {
  switch (variant) {
    case 'secondary':
      return { lip: { base: colors.card, lip: colors.cardLip, border: colors.cardBorder }, text: colors.ink };
    case 'tinted': {
      const t = tone as ColorSet & { light?: string; border?: string };
      return { lip: { base: t.tint, lip: t.light ?? t.base, border: t.border ?? t.tint }, text: t.deep };
    }
    case 'danger':
      return { lip: { base: colors.danger, lip: colors.dangerLip }, text: colors.onColor };
    case 'ghost':
      return { lip: { base: 'transparent', lip: 'transparent' }, text: colors.ink2 };
    default:
      return { lip: { base: tone.base, lip: tone.lip }, text: tone.on };
  }
}

/** Chunky lip button. Full width in a column unless `inline`. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  tone = TONE.primary,
  icon,
  iconRight,
  loading,
  disabled,
  inline,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const sz = SIZES[size];
  const { lip: lipColors, text } = look(variant, tone);
  const ghost = variant === 'ghost';
  const fg = disabled ? colors.ink3 : text;
  return (
    <PressableLip
      onPress={loading ? undefined : onPress}
      disabled={disabled}
      colors={lipColors}
      disabledColors={ghost ? lipColors : undefined}
      radius={sz.r}
      lipDepth={ghost ? 0 : sz.lip}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: !!loading }}
      testID={testID}
      hitSlop={sz.h < layout.minTap ? (layout.minTap - sz.h) / 2 : undefined}
      // Fixed heights, not "at least": a shrink-to-fit button with a growing face was laid out
      // endlessly tall on iOS (the empty-library card). A label is always one line, so the
      // height never needs to follow the content.
      style={[{ height: sz.h + (ghost ? 0 : sz.lip) }, inline && { alignSelf: 'flex-start' }, style]}
      faceStyle={[s.face, { height: sz.h, paddingHorizontal: ghost ? 12 : sz.px }]}
    >
      <View style={[s.row, loading && s.hidden]}>
        {icon && <Icon name={icon} size={sz.icon} color={fg} strokeWidth={2.5} />}
        <Text
          numberOfLines={1}
          variant="heading"
          style={[typography.button, s.label, { fontSize: sz.font, lineHeight: sz.font + 4 }, ghost && s.ghostText]}
          color={fg}
        >
          {label}
        </Text>
        {iconRight && <Icon name={iconRight} size={sz.icon} color={fg} strokeWidth={2.5} />}
      </View>
      {loading && <ActivityIndicator style={StyleSheet.absoluteFill} color={fg} />}
    </PressableLip>
  );
}

const s = StyleSheet.create({
  face: { alignItems: 'center', justifyContent: 'center', flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 1 },
  label: { flexShrink: 1 },
  hidden: { opacity: 0 },
  ghostText: { fontFamily: typography.smallStrong.fontFamily, fontSize: 15, letterSpacing: 0 },
});
