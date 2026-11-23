import { StyleSheet, View } from 'react-native';

import { CountBadge, Text } from '@/components/ui';
import { space } from '@/lib/theme';

/** Section title with an optional count pill. */
export function SectionHeader({ title, count }: { title: string; count?: number }) {
  return (
    <View style={s.row}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {count != null && <CountBadge value={count} />}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: space.xl, marginBottom: space.m },
});
