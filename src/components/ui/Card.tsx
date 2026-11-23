import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { lip, radius } from '@/lib/theme';

import { CARD_LIP, LipSurface, PressableLip, type LipColors } from './PressableLip';

export interface CardProps {
  children?: ReactNode;
  /** Makes the whole card a lip button */
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Colours (default white face, warm border, lip) */
  colors?: LipColors;
  /** Inner padding (default 16) */
  padding?: number;
  radius?: number;
  lipDepth?: number;
  disabled?: boolean;
  selected?: boolean;
  testID?: string;
  /** Outer box: margins, flex */
  style?: StyleProp<ViewStyle>;
  /** Face: layout of the content */
  contentStyle?: StyleProp<ViewStyle>;
}

/** White card with a 2px warm border and a solid lip. Pressable when `onPress` is given. */
export function Card({
  children,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
  colors = CARD_LIP,
  padding = 16,
  radius: r = radius.card,
  lipDepth = lip.lg,
  disabled,
  selected,
  testID,
  style,
  contentStyle,
}: CardProps) {
  if (onPress || onLongPress) {
    return (
      <PressableLip
        onPress={onPress}
        onLongPress={onLongPress}
        colors={colors}
        radius={r}
        lipDepth={lipDepth}
        disabled={disabled}
        disabledColors={colors}
        selected={selected}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        testID={testID}
        style={style}
        faceStyle={[{ padding }, contentStyle]}
      >
        {children}
      </PressableLip>
    );
  }
  return (
    <LipSurface colors={colors} radius={r} lipDepth={lipDepth} style={style} faceStyle={[{ padding }, contentStyle]}>
      {children}
    </LipSurface>
  );
}
