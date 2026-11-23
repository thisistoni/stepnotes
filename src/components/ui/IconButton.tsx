import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, layout, lip as LIP, radius, TONE, type ColorSet } from '@/lib/theme';

import { Icon, type IconName } from '../Icon';
import { PressableLip, type LipColors } from './PressableLip';

export interface IconButtonProps {
  icon: IconName;
  /** Required: what the button does, for screen readers ("Back", "Import a dance"). */
  label: string;
  onPress?: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
  /** Long-press delay in ms (default 500) */
  delayLongPress?: number;
  /** card (white, default) · primary (vivid tone) · tinted (pale tone) · ghost (no surface) */
  variant?: 'card' | 'primary' | 'tinted' | 'ghost';
  /** square (rounded 16) or round */
  shape?: 'square' | 'round';
  /** Face size in px (default 44; transport 52; play 60) */
  size?: number;
  /** Icon size (default ≈ half the face) */
  iconSize?: number;
  tone?: ColorSet;
  /** Icon colour override */
  color?: string;
  disabled?: boolean;
  selected?: boolean;
  /** Custom content instead of `icon` (e.g. a cross-fading play/pause) */
  children?: ReactNode;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** Square white card button with a lip (header actions, transport), or round / vivid variants. */
export function IconButton({
  icon,
  label,
  onPress,
  onLongPress,
  onPressOut,
  delayLongPress,
  variant = 'card',
  shape = 'square',
  size = 44,
  iconSize,
  tone = TONE.primary,
  color,
  disabled,
  selected,
  children,
  testID,
  style,
}: IconButtonProps) {
  const lipColors: LipColors =
    variant === 'primary'
      ? { base: tone.base, lip: tone.lip }
      : variant === 'tinted'
        ? {
            base: tone.tint,
            lip: (tone as ColorSet & { light?: string }).light ?? tone.base,
            border: (tone as ColorSet & { border?: string }).border ?? tone.tint,
          }
        : variant === 'ghost'
          ? { base: 'transparent', lip: 'transparent' }
          : { base: colors.card, lip: colors.cardLip, border: colors.cardBorder };
  const fg = color ?? (disabled ? colors.ink3 : variant === 'primary' ? tone.on : variant === 'tinted' ? tone.deep : colors.ink);
  const depth = variant === 'ghost' ? 0 : size >= 56 ? LIP.lg : LIP.md;
  const r = shape === 'round' ? size / 2 : size >= 52 ? radius.md : radius.sm;
  const slop = size < layout.minTap ? (layout.minTap - size) / 2 : undefined;
  return (
    <PressableLip
      onPress={onPress}
      onLongPress={onLongPress}
      onPressOut={onPressOut}
      delayLongPress={delayLongPress}
      disabled={disabled}
      selected={selected}
      colors={lipColors}
      disabledColors={variant === 'ghost' ? lipColors : undefined}
      radius={r}
      lipDepth={depth}
      accessibilityLabel={label}
      hitSlop={slop}
      testID={testID}
      style={[{ width: size }, style]}
      faceStyle={[s.face, { height: size }]}
    >
      {children ?? <Icon name={icon} size={iconSize ?? Math.round(size * 0.5)} color={fg} strokeWidth={2.4} />}
    </PressableLip>
  );
}

const s = StyleSheet.create({
  face: { alignItems: 'center', justifyContent: 'center' },
});
