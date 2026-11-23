import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useT } from '@/lib/i18n';
import { space, TONE } from '@/lib/theme';

import { EmptyState, FootSticker, Header, Screen } from './ui';

/** The same "this dance isn't here" page for the player and the editor (bad link, deleted dance). */
export function DanceNotFound({ testID }: { testID?: string }) {
  const t = useT();
  return (
    <Screen header={<Header />} testID={testID} contentStyle={s.page}>
      <EmptyState
        art={
          <>
            <FootSticker size={40} tone={TONE.neutral} rotate={-10} />
            <FootSticker size={40} foot="R" tone={TONE.neutral} rotate={10} />
          </>
        }
        title={t.notFound.title}
        body={t.notFound.body}
        action={{ label: t.notFound.action, icon: 'back', onPress: () => router.replace('/'), testID: 'back-to-library' }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  page: { paddingTop: space.xl },
});
