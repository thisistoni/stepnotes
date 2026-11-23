import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui';
import { space, styleColor } from '@/lib/theme';

import type { StyleFilter } from './useLibrary';

/** Horizontal "All · Salsa · Bachata…" filter row, edge to edge with a 24px start gutter. */
export function StyleFilterChips({
  filters,
  value,
  onChange,
}: {
  filters: StyleFilter[];
  value: string | null;
  onChange: (key: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.row}
      style={s.scroll}
      accessibilityLabel="Filter by style"
      accessibilityRole="radiogroup"
    >
      <Chip label="All" selected={value === null} onPress={() => onChange(null)} testID="filter-all" />
      {filters.map((f) => (
        <Chip
          key={f.key}
          label={f.label}
          dot={styleColor(f.label).base}
          selected={value === f.key}
          onPress={() => onChange(value === f.key ? null : f.key)}
          accessibilityLabel={`${f.label} dances`}
          testID={`filter-${f.key}`}
        />
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 0, marginTop: space.m },
  row: { gap: space.s, paddingHorizontal: space.gutter, paddingVertical: 4 },
});
