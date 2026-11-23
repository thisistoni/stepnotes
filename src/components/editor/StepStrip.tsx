import { memo, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Icon, IconButton, PressableLip, Text, hapticSelect } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, lip, radius, ROLE_COLOR, space } from '@/lib/theme';
import type { Role, Step } from '@/lib/types';

export interface StepStripProps {
  steps: Step[];
  role: Role;
  /** -1 = start position */
  sel: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
}

/**
 * Horizontal chips `Start · 1 L · 2 R · …` in the role colour; the selected chip is filled and
 * kept in view. The `+` button (outside the scroller, always reachable) adds after the selection.
 */
export const StepStrip = memo(function StepStrip({ steps, role, sel, onSelect, onAdd }: StepStripProps) {
  const t = useT();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const xs = useRef<Record<number, { x: number; w: number }>>({});
  const [viewW, setViewW] = useState(0);
  const scrollX = useRef(0);

  // keep the selected chip in view (also after adding / moving / undo)
  useEffect(() => {
    const c = xs.current[sel];
    if (!c || !viewW) return;
    const pad = 28;
    if (c.x - pad < scrollX.current) scroll.current?.scrollTo({ x: Math.max(0, c.x - pad), animated: true });
    else if (c.x + c.w + pad > scrollX.current + viewW) scroll.current?.scrollTo({ x: c.x + c.w + pad - viewW, animated: true });
  }, [sel, steps.length, viewW]);

  const measure = (i: number, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    xs.current[i] = { x, w: width };
    // a chip that appears selected (just added) scrolls into view once it is measured
    if (i === sel && viewW && x + width + 28 > scrollX.current + viewW) {
      scroll.current?.scrollTo({ x: x + width + 28 - viewW, animated: true });
    }
  };

  const addLabel = sel < 0 ? t.strip.addFirst : t.strip.addAfter(sel + 1);
  return (
    <View style={s.row}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setViewW(e.nativeEvent.layout.width)}
        onScroll={(e) => {
          scrollX.current = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={32}
        style={s.scroller}
        contentContainerStyle={s.content}
        testID="step-strip"
      >
        <View onLayout={(e) => measure(-1, e)}>
          <StripChip role={role} selected={sel === -1} onPress={() => onSelect(-1)} label={t.strip.startA11y} testID="strip-start">
            <Icon name="footprints" size={18} color={sel === -1 ? colors.onColor : ROLE_COLOR[role].base} />
            <Text variant="smallStrong" color={sel === -1 ? colors.onColor : colors.ink}>
              {t.strip.start}
            </Text>
          </StripChip>
        </View>
        {steps.map((st, i) => (
          <View key={st.id} onLayout={(e) => measure(i, e)}>
            <StepChip step={st} index={i} role={role} selected={sel === i} onSelect={onSelect} />
          </View>
        ))}
      </ScrollView>
      <IconButton
        icon="plus"
        label={addLabel}
        variant="primary"
        tone={ROLE_COLOR[role]}
        size={44}
        iconSize={24}
        onPress={onAdd}
        testID="strip-add"
      />
    </View>
  );
});

const StepChip = memo(function StepChip({
  step,
  index,
  role,
  selected,
  onSelect,
}: {
  step: Step;
  index: number;
  role: Role;
  selected: boolean;
  onSelect: (i: number) => void;
}) {
  const c = ROLE_COLOR[role];
  const t = useT();
  const hold = step.kind === 'hold';
  const tap = step.kind === 'tap';
  const count = step.count.trim() || '?';
  // letter disc: solid for a step, outlined for a tap, a pause bar pair for a hold
  const discBg = hold ? 'transparent' : tap ? 'transparent' : selected ? colors.card : c.base;
  const discBorder = selected ? colors.card : c.base;
  const discFg = tap ? (selected ? colors.onColor : c.deep) : selected ? c.deep : c.on;
  return (
    <StripChip role={role} selected={selected} onPress={() => onSelect(index)} label={t.strip.chip(index + 1, count, step.kind, step.foot)} testID={`strip-step-${index}`}>
      <Text variant="numeralSm" color={selected ? colors.onColor : colors.ink} style={s.count} numberOfLines={1}>
        {count}
      </Text>
      {hold ? (
        <Icon name="pause" size={16} color={selected ? colors.onColor : c.base} />
      ) : (
        <View style={[s.disc, { backgroundColor: discBg, borderColor: discBorder }, tap && s.discTap]}>
          <Text variant="numeralSm" style={s.discText} color={discFg} maxFontSizeMultiplier={1}>
            {step.foot}
          </Text>
        </View>
      )}
    </StripChip>
  );
});

function StripChip({
  role,
  selected,
  onPress,
  label,
  testID,
  children,
}: {
  role: Role;
  selected: boolean;
  onPress: () => void;
  label: string;
  testID?: string;
  children: ReactNode;
}) {
  const c = ROLE_COLOR[role];
  return (
    <PressableLip
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      haptic={false}
      selected={selected}
      accessibilityLabel={label}
      colors={selected ? { base: c.base, lip: c.lip, border: c.base } : undefined}
      radius={radius.chip}
      lipDepth={lip.md}
      testID={testID}
      faceStyle={s.chip}
    >
      {children}
    </PressableLip>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s },
  scroller: { flex: 1, marginLeft: -space.gutter },
  content: { gap: space.s, paddingLeft: space.gutter, paddingRight: space.m },
  chip: { height: 44, minWidth: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  count: { maxWidth: 48 },
  disc: { width: 22, height: 22, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  discTap: { borderStyle: 'dashed' },
  discText: { fontSize: 12, lineHeight: 15 },
});
