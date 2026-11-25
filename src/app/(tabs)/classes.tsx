import { StyleSheet, View } from 'react-native';

import { EmptyState, Entrance, FootSticker, Header, Screen } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { ROLE_COLOR, STYLE_COLORS, space } from '@/lib/theme';

/** Classes tab: a friendly placeholder until classes exist (package B1 replaces this screen). */
export default function Classes() {
  const t = useT();
  return (
    <Screen padded={false} testID="classes">
      <Header large eyebrow="Waltzy" title={t.tabs.classesTitle} />
      <Entrance index={0} style={s.body}>
        <EmptyState
          art={
            <View style={s.art}>
              <FootSticker tone={ROLE_COLOR.leader} size={40} rotate={-10} />
              <FootSticker tone={ROLE_COLOR.follower} foot="R" size={40} rotate={10} style={s.up} />
              <FootSticker tone={STYLE_COLORS.latin} size={40} rotate={-6} />
              <FootSticker tone={STYLE_COLORS.bachata} foot="R" size={40} rotate={6} style={s.up} />
            </View>
          }
          title={t.tabs.classesSoonTitle}
          body={t.tabs.classesSoonBody}
        />
      </Entrance>
    </Screen>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, marginTop: space.xl },
  art: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  up: { marginBottom: 12 },
});
