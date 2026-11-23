import { StyleSheet, View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import { colors, space } from '@/lib/theme';

/** Entry to the "How to read the footprints" mini-lesson. */
export function LessonCard({ onPress }: { onPress: () => void }) {
  return (
    <Card
      onPress={onPress}
      accessibilityLabel="How to read the footprints. A one-minute interactive lesson"
      contentStyle={s.row}
      padding={space.m}
      testID="lesson-card"
    >
      <View style={s.tile}>
        <Icon name="footprints" size={30} color={colors.primary} />
      </View>
      <View style={s.text}>
        <Text variant="label">How to read the footprints</Text>
        <Text variant="small" color="ink2" style={s.sub}>
          A one-minute interactive lesson
        </Text>
      </View>
      <Icon name="chevron-right" size={22} color={colors.ink3} />
    </Card>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingRight: space.l },
  tile: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  sub: { marginTop: 2 },
});
