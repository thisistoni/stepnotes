import { StyleSheet, View } from 'react-native';

import { EmptyState, FootSticker } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { ROLE_COLOR, STYLE_COLORS } from '@/lib/theme';

/** "Write down your first dance" card shown while My dances is empty. */
export function MyDancesEmpty({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  return (
    <EmptyState
      art={
        <View style={s.art}>
          <FootSticker tone={STYLE_COLORS.ballroom} size={40} rotate={-12} />
          <FootSticker tone={ROLE_COLOR.leader} foot="R" size={40} rotate={8} style={s.up} />
          <FootSticker tone={STYLE_COLORS.salsa} size={40} rotate={-4} style={s.upMore} />
        </View>
      }
      title={t.library.emptyTitle}
      body={t.library.emptyBody}
      action={{ label: t.library.emptyAction, icon: 'plus', onPress: onCreate, testID: 'empty-create' }}
    />
  );
}

const s = StyleSheet.create({
  art: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  up: { marginBottom: 10 },
  upMore: { marginBottom: 20 },
});
