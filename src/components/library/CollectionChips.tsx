import { useCallback, useEffect, useRef, type ComponentRef } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { hapticSelect, Icon, PressableLip, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, layout, lip, radius, space, withAlpha } from '@/lib/theme';

export interface CollectionChipItem {
  id: string;
  name: string;
  /** dances of it that exist on this device */
  count: number;
}

/**
 * "All dances · Tuesday class 3 · Wedding 2 · + New": the first chip row of the library. Picks
 * one collection (null = all dances); the picked chip scrolls into view (e.g. a new one at the end).
 */
export function CollectionChips({
  items,
  value,
  onChange,
  onNew,
}: {
  items: CollectionChipItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  onNew: () => void;
}) {
  const t = useT();
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const spots = useRef(new Map<string, { x: number; w: number }>());
  const scrollX = useRef(0);
  const { width } = useWindowDimensions();
  const viewport = Math.min(width, layout.maxWidth);

  // bring the picked chip into view (it may be off screen after creating or on start)
  const key = value ?? '__all';
  const reveal = (animated: boolean) => {
    const spot = spots.current.get(key);
    if (!spot) return;
    const left = spot.x - space.gutter;
    const right = spot.x + spot.w + space.gutter - viewport;
    if (left < scrollX.current) ref.current?.scrollTo({ x: Math.max(0, left), animated });
    else if (right > scrollX.current) ref.current?.scrollTo({ x: right, animated });
  };
  const revealRef = useRef(reveal);
  useEffect(() => {
    revealRef.current = reveal;
  });
  useEffect(() => {
    // after the chip of a just-created collection has been laid out
    const id = setTimeout(() => revealRef.current(true), 60);
    return () => clearTimeout(id);
  }, [key, items.length]);

  const measure = useCallback((id: string, e: LayoutChangeEvent) => {
    const { x, width: w } = e.nativeEvent.layout;
    spots.current.set(id, { x, w });
  }, []);

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.row}
      style={s.scroll}
      onScroll={(e) => (scrollX.current = e.nativeEvent.contentOffset.x)}
      scrollEventThrottle={32}
      accessibilityLabel={t.collections.row}
      accessibilityRole="radiogroup"
      testID="collection-chips"
    >
      <CollectionChip label={t.collections.allDances} selected={value === null} onPress={() => onChange(null)} onLayout={(e) => measure('__all', e)} testID="collection-all" />
      {items.map((c) => (
        <CollectionChip
          key={c.id}
          label={c.name}
          count={c.count}
          selected={value === c.id}
          onPress={() => onChange(c.id)}
          onLayout={(e) => measure(c.id, e)}
          accessibilityLabel={t.collections.chip(c.name, c.count)}
          testID={`collection-chip-${c.id}`}
        />
      ))}
      <PressableLip
        onPress={() => {
          hapticSelect();
          onNew();
        }}
        haptic={false}
        colors={NEW_LIP}
        radius={radius.chip}
        lipDepth={lip.md}
        accessibilityLabel={t.collections.newCollection}
        hitSlop={4}
        testID="collection-new"
        faceStyle={[s.face, s.newFace]}
      >
        <Icon name="plus" size={16} color={colors.primaryInk} strokeWidth={2.8} />
        <Text variant="smallStrong" color="primaryInk">
          {t.collections.new}
        </Text>
      </PressableLip>
    </ScrollView>
  );
}

const NEW_LIP = { base: colors.primaryWash, lip: colors.primaryLight, border: colors.primaryBorder };
const OFF_LIP = { base: colors.card, lip: colors.cardLip, border: colors.cardBorder };
const ON_LIP = { base: colors.ink, lip: colors.inkLip, border: colors.ink };

function CollectionChip({
  label,
  count,
  selected,
  onPress,
  onLayout,
  accessibilityLabel,
  testID,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
  accessibilityLabel?: string;
  testID: string;
}) {
  return (
    <PressableLip
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      onLayout={onLayout}
      haptic={false}
      selected={selected}
      colors={selected ? ON_LIP : OFF_LIP}
      radius={radius.chip}
      lipDepth={lip.md}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={4}
      testID={testID}
      faceStyle={s.face}
    >
      <Text variant="smallStrong" color={selected ? 'onColor' : 'ink'} numberOfLines={1} style={s.label}>
        {label}
      </Text>
      {count != null && (
        <Text variant="smallStrong" color={selected ? withAlpha(colors.onColor, 0.62) : colors.ink3} style={s.count}>
          {count}
        </Text>
      )}
    </PressableLip>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 0, marginTop: space.m },
  row: { gap: space.s, paddingHorizontal: space.gutter, paddingVertical: 4 },
  face: { height: 36, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  newFace: { paddingLeft: 10, gap: 4 },
  label: { flexShrink: 1, maxWidth: 168 },
  count: { flexShrink: 0 },
});
