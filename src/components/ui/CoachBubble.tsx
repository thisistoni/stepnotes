import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, lip, STYLE_COLORS, type ColorSet } from '@/lib/theme';

import { FootSticker } from './FootSticker';
import { Text } from './Text';

export interface CoachBubbleProps {
  /** Bubble text. Nest `<Text variant="small" color={tone.lip}>` for an emphasised phrase. */
  children: ReactNode;
  /** Avatar colour (default bachata purple, as mocked) */
  tone?: ColorSet;
  style?: StyleProp<ViewStyle>;
}

/** Footprint sticker avatar + speech bubble, for short hints. */
export function CoachBubble({ children, tone = STYLE_COLORS.bachata, style }: CoachBubbleProps) {
  return (
    <View style={[s.row, style]} accessibilityRole="text">
      <View style={[s.avatarWrap]}>
        <View style={[s.avatarLip, { backgroundColor: tone.lip }]} />
        <View style={[s.avatar, { backgroundColor: tone.base }]}>
          <FootSticker tone={{ base: colors.card, lip: tone.lip }} outline={tone.base} size={30} rotate={8} />
        </View>
      </View>
      <View style={s.bubble}>
        {typeof children === 'string' ? (
          <Text variant="small" color="ink2">
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  avatarWrap: { width: 44, height: 44 + lip.md, transform: [{ rotate: '-6deg' }] },
  avatarLip: { position: 'absolute', top: lip.md, left: 0, width: 44, height: 44, borderRadius: 16 },
  avatar: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  bubble: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
