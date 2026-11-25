import { ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Chip } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { space, styleColor } from '@/lib/theme';

import type { StyleFilter } from './useLibrary';

/**
 * Horizontal "Salsa · Bachata…" filter row, edge to edge with a 24px start gutter. Nothing picked =
 * every style; tapping the picked style (it shows an ×) clears it.
 */
export function StyleFilterChips({
  filters,
  value,
  onChange,
  style,
}: {
  filters: StyleFilter[];
  value: string | null;
  onChange: (key: string | null) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useT();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={s.row}
      style={[s.scroll, style]}
      accessibilityLabel={t.library.filterBy}
      accessibilityRole="radiogroup"
    >
      {filters.map((f) => (
        <Chip
          key={f.key}
          label={f.label}
          // the picked style shows an ×: tapping it again shows every style
          dot={value === f.key ? undefined : styleColor(f.label).base}
          icon={value === f.key ? 'close' : undefined}
          selected={value === f.key}
          onPress={() => onChange(value === f.key ? null : f.key)}
          accessibilityLabel={t.library.styleChip(f.label)}
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
