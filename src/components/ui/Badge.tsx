import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useT } from '@/lib/i18n';
import { colors, radius, ROLE_COLOR, styleColor, typography } from '@/lib/theme';
import type { Foot, Role } from '@/lib/types';

import { Text } from './Text';

/** Uppercase style tag on a vivid fill ("SALSA"). Renders nothing for an empty style. */
export function StyleBadge({ style: styleName, small, sx }: { style: string; small?: boolean; sx?: StyleProp<ViewStyle> }) {
  const name = styleName.trim();
  if (!name) return null;
  const c = styleColor(name);
  return (
    <View style={[s.style, small && s.styleSmall, { backgroundColor: c.base }, sx]}>
      <Text variant="overline" color={c.on} numberOfLines={1} style={[s.styleText, small && s.styleTextSmall]}>
        {name}
      </Text>
    </View>
  );
}

/** Small count pill ("6") next to a section title, or any short number. */
export function CountBadge({ value, tone = 'neutral', sx }: { value: number | string; tone?: 'neutral' | 'primary'; sx?: StyleProp<ViewStyle> }) {
  const primary = tone === 'primary';
  return (
    <View style={[s.count, { backgroundColor: primary ? colors.primaryTint : colors.track }, sx]}>
      <Text variant="caption" color={primary ? 'primaryInk' : 'ink2'} style={s.countText}>
        {value}
      </Text>
    </View>
  );
}

/**
 * L / R badge in the role colour. `weight` = solid (foot carries the weight), otherwise the light
 * free-foot tint. `hold` shows a dot.
 */
export function FootBadge({
  foot,
  role = 'leader',
  weight = true,
  size = 26,
  sx,
}: {
  foot: Foot | null;
  role?: Role;
  weight?: boolean;
  size?: number;
  sx?: StyleProp<ViewStyle>;
}) {
  const c = ROLE_COLOR[role];
  const t = useT();
  return (
    <View
      accessibilityLabel={foot === 'L' ? t.feet.leftFoot : foot === 'R' ? t.feet.rightFoot : t.feet.hold}
      style={[
        s.foot,
        { width: size, height: size, borderRadius: size * 0.35, backgroundColor: weight ? c.base : c.light },
        sx,
      ]}
    >
      <Text
        style={[typography.numeralSm, { fontFamily: typography.numeral.fontFamily, fontSize: size * 0.5, lineHeight: size * 0.62 }]}
        color={weight ? c.on : c.deep}
        maxFontSizeMultiplier={1}
      >
        {foot ?? '·'}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  style: { alignSelf: 'flex-start', height: 22, paddingHorizontal: 8, borderRadius: 8, justifyContent: 'center', maxWidth: '100%' },
  styleSmall: { height: 20, paddingHorizontal: 7, borderRadius: 7 },
  styleText: { fontSize: 10.5, letterSpacing: 0.8, lineHeight: 13 },
  styleTextSmall: { fontSize: 10 },
  count: { minWidth: 24, height: 22, paddingHorizontal: 7, borderRadius: radius.xs - 2, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: typography.numeralSm.fontFamily, fontSize: 13 },
  foot: { alignItems: 'center', justifyContent: 'center' },
});
