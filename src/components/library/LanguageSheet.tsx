import { StyleSheet, View } from 'react-native';

import { ChoiceRow, Sheet, Text } from '@/components/ui';
import { LANGUAGE_NAME, LANGUAGES, useI18n, type Language } from '@/lib/i18n';
import { ROLE_COLOR, space } from '@/lib/theme';

/** Shown in both languages, so it can always be found. */
const TITLE = 'Sprache · Language';

/** Language picker (the Language row on the Me tab): the whole app switches at once. */
export function LanguageSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { language, setLanguage } = useI18n();
  const pick = (l: Language) => {
    if (l !== language) setLanguage(l);
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={TITLE} testID="language-sheet">
      <View style={s.list} accessibilityRole="radiogroup">
        {LANGUAGES.map((l) => (
          <ChoiceRow
            key={l}
            title={LANGUAGE_NAME[l]}
            icon={
              <Text variant="smallStrong" color={ROLE_COLOR.leader.deep}>
                {l.toUpperCase()}
              </Text>
            }
            selected={l === language}
            onPress={() => pick(l)}
            testID={`language-${l}`}
          />
        ))}
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  list: { gap: space.m, paddingTop: space.s, paddingBottom: space.xs },
});
