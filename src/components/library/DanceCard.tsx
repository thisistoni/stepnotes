import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { DiagramThumb, PressableLip, Skeleton, StyleBadge, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { DEFAULT_FOOT_STYLE, lip, radius, space, styleColor } from '@/lib/theme';
import type { Dance } from '@/lib/types';

const TILE_H = 112;

/** Library card: tinted thumbnail tile with the style badge, title (2 lines max) and meta. */
export const DanceCard = memo(function DanceCard({ dance, onOpen }: { dance: Dance; onOpen: (id: string) => void }) {
  const t = useT();
  const tone = styleColor(dance.style);
  const name = dance.name.trim() || t.common.untitled;
  const meta = t.library.cardMeta(dance.roles.leader.steps.length, dance.bpm);
  return (
    <PressableLip
      onPress={() => onOpen(dance.id)}
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
        <StyleBadge style={dance.style} small sx={s.badge} />
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
  text: { paddingHorizontal: space.xs, paddingTop: space.s + 2 },
  meta: { marginTop: 3 },
  skeleton: { padding: space.xs, paddingBottom: space.m + lip.lg },
});
