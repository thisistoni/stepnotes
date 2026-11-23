import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { goBackOrHome, IconButton, Text } from '@/components/ui';
import { space } from '@/lib/theme';

interface Props {
  title: string;
  /** dance style ("Salsa"); the only part of the meta line that may shorten */
  style: string;
  /** "3/4 · 84 bpm", never truncated */
  meta: string;
  dot: string;
  right: ReactNode;
}

export const PLAYER_HEADER_H = 64;

/**
 * Player header: back · title + "Style · 3/4 · 84 bpm" · actions. Like the kit Header, but the
 * title is left-aligned next to the back button so it gets the width of both side columns (two
 * action buttons on the right would leave a centred title ~140px at 390 wide).
 */
export function PlayerHeader({ title, style, meta, dot, right }: Props) {
  const size = title.length <= 18 ? undefined : s.titleSmall;
  return (
    <View style={s.bar}>
      <IconButton icon="back" label="Back" onPress={goBackOrHome} testID="header-back" />
      <View style={s.center}>
        <Text variant="heading" numberOfLines={1} accessibilityRole="header" style={size} testID="player-title">
          {title}
        </Text>
        <View style={s.subRow}>
          <View style={[s.dot, { backgroundColor: dot }]} />
          {!!style && (
            <Text variant="caption" color="ink2" numberOfLines={1} style={s.sub}>
              {style}
            </Text>
          )}
          <Text variant="caption" color="ink2" numberOfLines={1} style={s.meta}>
            {style ? `· ${meta}` : meta}
          </Text>
        </View>
      </View>
      <View style={s.right}>{right}</View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { height: PLAYER_HEADER_H, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: space.m },
  center: { flex: 1, minWidth: 0 },
  titleSmall: { fontSize: 17, lineHeight: 22 },
  subRow: { flexDirection: 'row', alignItems: 'center', columnGap: 4, marginTop: 1 },
  sub: { flexShrink: 1 },
  meta: { flexShrink: 0 },
  dot: { width: 8, height: 8, borderRadius: 3, marginRight: 2 },
  right: { flexDirection: 'row', gap: space.s },
});
