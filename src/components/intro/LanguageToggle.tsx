import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { hapticSelect, Text } from '@/components/ui';
import { LANGUAGE_NAME, LANGUAGES, useI18n } from '@/lib/i18n';
import { colors, layout, radius } from '@/lib/theme';

/** Width of the control, so the intro's top bar can keep the same slot on every step. */
export const LANGUAGE_TOGGLE_W = LANGUAGES.length * layout.minTap + (LANGUAGES.length - 1) * 2;

/** Compact "DE | EN" switch for the intro's welcome step; switches the whole app at once. */
export function LanguageToggle() {
  const { language, setLanguage, t } = useI18n();
  return (
    <View style={s.row} accessibilityRole="radiogroup" accessibilityLabel={t.intro.languageSwitch} testID="language-toggle">
      {LANGUAGES.map((l, i) => {
        const on = l === language;
        return (
          <Fragment key={l}>
            {i > 0 && <View style={s.divider} />}
            <Pressable
              onPress={() => {
                if (on) return;
                hapticSelect();
                setLanguage(l);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              aria-checked={on}
              accessibilityLabel={LANGUAGE_NAME[l]}
              style={s.item}
              testID={`lang-${l}`}
            >
              <View style={[s.pill, on && s.pillOn]}>
                <Text variant="smallStrong" color={on ? 'ink' : 'ink3'} maxFontSizeMultiplier={1.3}>
                  {l.toUpperCase()}
                </Text>
              </View>
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', width: LANGUAGE_TOGGLE_W },
  item: { width: layout.minTap, height: layout.minTap, alignItems: 'center', justifyContent: 'center' },
  pill: { minWidth: 38, height: 30, paddingHorizontal: 6, borderRadius: radius.chip - 4, alignItems: 'center', justifyContent: 'center' },
  pillOn: { backgroundColor: colors.track },
  divider: { width: 2, height: 16, borderRadius: 1, backgroundColor: colors.cardBorder },
});
