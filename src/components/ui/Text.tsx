import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typography, type ColorToken, type TypeVariant } from '@/lib/theme';

export type TextVariant = Exclude<TypeVariant, 'button'>;

export interface TextProps extends RNTextProps {
  /** Type style (font family + size + line height). Default `body`. */
  variant?: TextVariant;
  /** A colour token (`'ink2'`, `'primary'`…) or a colour from the theme (e.g. `styleColor(s).deep`). Default `ink`. */
  color?: ColorToken | (string & {});
  /** Text alignment shortcut */
  align?: 'left' | 'center' | 'right';
}

/** Large type grows with the OS setting, but only so far that layouts survive. */
const MAX_SCALE: Partial<Record<TextVariant, number>> = {
  display: 1.2,
  title: 1.2,
  heading: 1.25,
  numeral: 1,
  numeralSm: 1.15,
  overline: 1.3,
  caption: 1.35,
};

export function resolveColor(c: TextProps['color'], fallback: string = colors.ink): string {
  if (!c) return fallback;
  return (colors as Record<string, string>)[c] ?? c;
}

/**
 * The only way to put text on screen. Picks the right font family per weight (each weight is its
 * own family on native), so never set `fontFamily` / `fontWeight` yourself.
 */
export function Text({ variant = 'body', color, align, style, maxFontSizeMultiplier, ...rest }: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MAX_SCALE[variant] ?? 1.35}
      style={[typography[variant], { color: resolveColor(color) }, align && { textAlign: align }, style]}
      {...rest}
    />
  );
}
