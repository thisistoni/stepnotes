import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DiagramThumb, Icon, PressableLip, Skeleton, StyleBadge, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, DEFAULT_FOOT_STYLE, lip, radius, space, styleColor, withAlpha } from '@/lib/theme';
import type { Dance } from '@/lib/types';

const TILE_H = 112;

export interface DanceCardProps {
  dance: Dance;
  onOpen: (id: string) => void;
  /** long press: the card's menu (add to a collection …) */
  onLongPress?: (id: string) => void;
  /** shows a small "…" button on the tile that opens the card's menu (inside a collection) */
  onMore?: (id: string) => void;
}

/** Library card: tinted thumbnail tile with the style badge, title (2 lines max) and meta. */
export const DanceCard = memo(function DanceCard({ dance, onOpen, onLongPress, onMore }: DanceCardProps) {
  const t = useT();
  const tone = styleColor(dance.style);
  const name = dance.name.trim() || t.common.untitled;
  const meta = t.library.cardMeta(dance.roles.leader.steps.length, dance.bpm);
  return (
    <PressableLip
      onPress={() => onOpen(dance.id)}
      onLongPress={onLongPress ? () => onLongPress(dance.id) : undefined}
      delayLongPress={450}
      // screen readers: the long press as a named action
      accessibilityActions={onLongPress ? [{ name: 'longpress', label: t.player.more }] : undefined}
      onAccessibilityAction={onLongPress ? (e) => e.nativeEvent.actionName === 'longpress' && onLongPress(dance.id) : undefined}
      radius={radius.card}
      lipDepth={lip.lg}
      accessibilityLabel={[name, dance.style.trim(), meta].filter(Boolean).join(', ')}
      accessibilityHint={t.library.openHint}
      testID={`dance-card-${dance.id}`}
      style={s.card}
      faceStyle={s.face}
    >
      <View style={[s.tile, { backgroundColor: tone.tint }]}>
        <DiagramThumb
          pattern={dance.roles.leader}
          tone={tone}
          footStyle={dance.footStyle?.leader ?? DEFAULT_FOOT_STYLE.leader}
          style={s.thumb}
        />
        <StyleBadge style={dance.style} small sx={[s.badge, !!onMore && s.badgeNarrow]} />
        {onMore && (
          <Pressable
            onPress={() => onMore(dance.id)}
            accessibilityRole="button"
            accessibilityLabel={t.collections.cardMore(name)}
            hitSlop={8}
            style={({ pressed }) => [s.more, pressed && s.morePressed]}
            testID={`dance-more-${dance.id}`}
          >
            <Icon name="more" size={18} color={tone.deep} strokeWidth={2.6} />
          </Pressable>
        )}
      </View>
      <View style={s.text}>
        {/* three lines: German starter names ("Bachata Grundschritt seitwärts") must not be cut */}
        <Text variant="label" numberOfLines={3}>
          {name}
        </Text>
        <Text variant="caption" color="ink2" numberOfLines={2} style={s.meta}>
          {meta}
        </Text>
      </View>
    </PressableLip>
  );
});

/** Placeholder with the same footprint as a DanceCard. */
export function DanceCardSkeleton() {
  return (
    <View style={[s.card, s.skeleton]}>
      <Skeleton height={TILE_H} radius={18} />
      <View style={s.text}>
        <Skeleton width="80%" height={14} />
        <Skeleton width="55%" height={11} style={s.meta} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flex: 1 },
  face: { padding: space.xs, paddingBottom: space.m },
  tile: { height: TILE_H, borderRadius: 18, overflow: 'hidden' },
  thumb: { position: 'absolute', left: 10, right: 10, top: 26, bottom: 6 },
  badge: { position: 'absolute', left: 8, top: 8, maxWidth: '85%' },
  badgeNarrow: { maxWidth: '62%' },
  // 34 visible + 8 slop each side ≥ 44 touch target
  more: {
    position: 'absolute',
    right: 5,
    top: 5,
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.card, 0.85),
  },
  morePressed: { backgroundColor: colors.card },
  text: { paddingHorizontal: space.xs, paddingTop: space.s + 2 },
  meta: { marginTop: 3 },
  skeleton: { padding: space.xs, paddingBottom: space.m + lip.lg },
});
