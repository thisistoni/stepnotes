import { StyleSheet, View } from 'react-native';

import { Button, IconButton, SegmentedProgress } from '@/components/ui';
import { layout, space } from '@/lib/theme';

export interface IntroTopBarProps {
  /** 0-based step */
  step: number;
  total: number;
  onBack: () => void;
  onSkip: () => void;
}

/**
 * Back arrow · segmented progress · Skip. The back slot keeps its width on the first step so the
 * bar never shifts between steps.
 */
export function IntroTopBar({ step, total, onBack, onSkip }: IntroTopBarProps) {
  return (
    <View style={s.bar}>
      <View style={s.back}>
        {step > 0 && <IconButton icon="back" label="Previous step" onPress={onBack} testID="intro-back" />}
      </View>
      <SegmentedProgress total={total} value={step + 1} />
      <Button
        label="Skip"
        variant="ghost"
        size="sm"
        inline
        onPress={onSkip}
        accessibilityHint="Skips the intro and opens your dances"
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
    minHeight: layout.minTap + space.l,
  },
  back: { width: layout.minTap, height: layout.minTap + 4 },
  skip: { alignSelf: 'center' },
});
