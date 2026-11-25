import { StyleSheet, View } from 'react-native';

import { EmptyState, FootSticker, Icon, IconButton, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, ROLE_COLOR, space, STYLE_COLORS } from '@/lib/theme';

/**
 * Small header of the selected collection: name (full width, so long German compounds fit), count
 * and its "…" menu.
 */
export function CollectionHeader({ name, count, onMore }: { name: string; count: number; onMore: () => void }) {
  const t = useT();
  return (
    <View style={s.row} testID="collection-header">
      <View style={s.text}>
        <Text variant="heading" numberOfLines={2} accessibilityRole="header" testID="collection-title">
          {name}
        </Text>
        <View style={s.meta}>
          <Icon name="stack" size={16} color={colors.primaryInk} strokeWidth={2.4} />
          <Text variant="smallStrong" color="ink2" testID="collection-count">
            {t.collections.count(count)}
          </Text>
        </View>
      </View>
      <IconButton icon="more" label={t.collections.more(name)} variant="ghost" onPress={onMore} testID="collection-menu" />
    </View>
  );
}

/** A collection with no dances (or only dances that are not on this device). */
export function CollectionEmpty({ onAdd }: { onAdd: () => void }) {
  const t = useT();
  return (
    <EmptyState
      art={
        <View style={s.art}>
          <FootSticker tone={STYLE_COLORS.bachata} size={34} rotate={-14} />
          <FootSticker tone={ROLE_COLOR.follower} foot="R" size={34} rotate={10} style={s.up} />
        </View>
      }
      title={t.collections.emptyTitle}
      body={t.collections.emptyBody}
      action={{ label: t.collections.addDances, icon: 'plus', onPress: onAdd, testID: 'collection-empty-add' }}
    />
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: space.xl, marginBottom: space.m },
  text: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  art: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  up: { marginBottom: 12 },
});
