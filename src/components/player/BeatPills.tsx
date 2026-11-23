import { memo, useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Text } from '@/components/ui';
import type { BarRange } from '@/lib/pattern';
import { colors, lip, type ColorSet } from '@/lib/theme';
import type { Step } from '@/lib/types';

interface Props {
  steps: Step[];
  bars: BarRange[];
  index: number;
  tone: ColorSet & { light: string };
  onJump: (i: number) => void;
}

export const PILL = 28;
const GAP = 4;
const BAR_GAP = 12;

/**
 * One pill per step, grouped by bar: played (tint) · current (solid, lifted) · upcoming (white).
 * Tap to jump. One row that scrolls sideways when the pattern is long, keeping the current pill in
 * view, so the count block never changes height.
 */
export const BeatPills = memo(function BeatPills({ steps, bars, index, tone, onJump }: Props) {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const xs = useRef<number[]>([]);
  const view = useRef({ w: 0, content: 0 });

  useEffect(() => {
    const { w, content } = view.current;
    if (content <= w || index < 0) {
      if (index < 0) scroll.current?.scrollTo({ x: 0, animated: true });
      return;
    }
    const x = xs.current[index] ?? 0;
    // keep the current pill a little in from the left edge, so the upcoming ones are visible
    scroll.current?.scrollTo({ x: Math.max(0, Math.min(content - w, x - PILL * 1.5)), animated: true });
  }, [index]);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.scroll}
      contentContainerStyle={s.row}
      onLayout={(e: LayoutChangeEvent) => (view.current.w = e.nativeEvent.layout.width)}
      onContentSizeChange={(w) => (view.current.content = w)}
      accessibilityLabel="Counts"
      testID="beat-pills"
    >
      {bars.map((bar, bi) => (
        <View
          key={bar.bar}
          style={[s.group, bi > 0 && { marginLeft: BAR_GAP }]}
          onLayout={(e: LayoutChangeEvent) => {
            const gx = e.nativeEvent.layout.x;
            for (let i = bar.from; i < bar.to; i++) xs.current[i] = gx + (i - bar.from) * (PILL + GAP);
          }}
        >
          {steps.slice(bar.from, bar.to).map((st, k) => {
            const i = bar.from + k;
            const state = i < index ? 'done' : i === index ? 'current' : 'next';
            return (
              <Pressable
                key={st.id}
                onPress={() => onJump(i)}
                hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
                accessibilityRole="button"
                accessibilityLabel={`Count ${st.count}, step ${i + 1}`}
                accessibilityState={{ selected: state === 'current' }}
                testID={`pill-${i}`}
                style={[
                  s.pill,
                  state === 'done' && { backgroundColor: tone.tint, borderColor: tone.tint },
                  state === 'current' && [s.current, { backgroundColor: tone.base, borderColor: tone.base, boxShadow: [{ offsetX: 0, offsetY: lip.sm, blurRadius: 0, color: tone.lip }] }],
                ]}
              >
                <Text
                  variant="numeralSm"
                  color={state === 'current' ? tone.on : state === 'done' ? tone.deep : colors.ink3}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1}
                  style={st.count.length > 2 && s.small}
                >
                  {st.count}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
});

const s = StyleSheet.create({
  scroll: { flexGrow: 0, marginHorizontal: -4 },
  row: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 6, alignItems: 'center' },
  group: { flexDirection: 'row', gap: GAP },
  pill: {
    minWidth: PILL,
    height: PILL,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  current: { transform: [{ translateY: -2 }] },
  small: { fontSize: 11 },
});
