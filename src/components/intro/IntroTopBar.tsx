import { StyleSheet, View } from 'react-native';

import { Button, IconButton, SegmentedProgress } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { space } from '@/lib/theme';

import { LANGUAGE_TOGGLE_W, LanguageToggle } from './LanguageToggle';

export interface IntroTopBarProps {
  /** 0-based step */
  step: number;
  total: number;
  onBack: () => void;
  onSkip: () => void;
}

/**
 * DE | EN (welcome step) or back arrow · segmented progress · Skip. The left slot keeps its width
 * on every step so the bar never shifts between steps.
 */
export function IntroTopBar({ step, total, onBack, onSkip }: IntroTopBarProps) {
  const t = useT();
  return (
    <View style={s.bar}>
      <View style={s.back}>
        {step === 0 ? <LanguageToggle /> : <IconButton icon="back" label={t.intro.previous} onPress={onBack} testID="intro-back" />}
      </View>
      <SegmentedProgress total={total} value={step + 1} />
      <Button
        label={t.intro.skip}
        variant="ghost"
        size="sm"
        inline
        onPress={onSkip}
        accessibilityHint={t.intro.skipHint}
        testID="intro-skip"
        style={s.skip}
      />
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    paddingLeft: 20,
    paddingRight: space.s,
    paddingTop: space.s,
    paddingBottom: space.s,
    minHeight: 44 + space.l,
  },
  back: { width: LANGUAGE_TOGGLE_W, height: 48, justifyContent: 'center' },
  skip: { alignSelf: 'center' },
});
