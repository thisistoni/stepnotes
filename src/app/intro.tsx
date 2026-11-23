/**
 * Intro — MINIMAL STUB. The Intro engineer replaces this with the 3-step intro (welcome, role,
 * "How to read the footprints" lesson; `?lesson=1` opens the lesson on its own).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button, Entrance, FootSticker, Header, Screen, Text } from '@/components/ui';
import { usePrefs } from '@/lib/prefs';
import { ROLE_COLOR, STYLE_COLORS, space } from '@/lib/theme';

export default function Intro() {
  const { prefs, set } = usePrefs();
  const { lesson } = useLocalSearchParams<{ lesson?: string }>();
  const start = async () => {
    await set({ onboardingDone: true });
    router.replace('/');
  };
  return (
    <Screen
      header={prefs.onboardingDone || lesson ? <Header /> : undefined}
      footer={<Button label={prefs.onboardingDone ? 'Back to my dances' : 'Get started'} onPress={start} testID="intro-start" />}
      contentStyle={s.content}
    >
      <Entrance index={0} style={s.art}>
        <FootSticker tone={STYLE_COLORS.bachata} size={64} rotate={-14} />
        <FootSticker tone={ROLE_COLOR.leader} foot="R" size={64} rotate={10} style={s.raised} />
        <FootSticker tone={STYLE_COLORS.salsa} size={64} rotate={-6} />
      </Entrance>
      <Entrance index={1}>
        <Text variant="display">StepNotes</Text>
      </Entrance>
      <Entrance index={2}>
        <Text variant="body" color="ink2" style={s.line}>
          Learn any dance step, one footprint at a time.
        </Text>
      </Entrance>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingTop: space.xxl },
  art: { flexDirection: 'row', alignItems: 'flex-end', gap: space.s, marginBottom: space.xl },
  raised: { marginBottom: 28 },
  line: { marginTop: space.s, maxWidth: 320 },
});
