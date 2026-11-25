import { StyleSheet, View } from 'react-native';

import { Entrance } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { space } from '@/lib/theme';
import type { Dance } from '@/lib/types';

import { DanceCard, DanceCardSkeleton } from './DanceCard';

/** Two-column grid of DanceCards (rows stretch so cards in a row share a height). */
export function DanceGrid({
  dances,
  onOpen,
  onLongPress,
  onMore,
  startIndex = 0,
}: {
  dances: Dance[];
  onOpen: (id: string) => void;
  onLongPress?: (id: string) => void;
  onMore?: (id: string) => void;
  startIndex?: number;
}) {
  const rows: Dance[][] = [];
  for (let i = 0; i < dances.length; i += 2) rows.push(dances.slice(i, i + 2));
  return (
    <View style={s.grid}>
      {rows.map((row, r) => (
        <Entrance key={row[0].id} index={startIndex + r} style={s.row}>
          {row.map((d) => (
            <DanceCard key={d.id} dance={d} onOpen={onOpen} onLongPress={onLongPress} onMore={onMore} />
          ))}
          {row.length === 1 && <View style={s.spacer} />}
        </Entrance>
      ))}
    </View>
  );
}

export function DanceGridSkeleton({ count = 2 }: { count?: number }) {
  const t = useT();
  return (
    <View style={[s.row, s.grid]} accessibilityLabel={t.library.loading}>
      {Array.from({ length: count }, (_, i) => (
        <DanceCardSkeleton key={i} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  grid: { gap: space.m + 2 },
  row: { flexDirection: 'row', gap: space.m + 2, alignItems: 'stretch' },
  spacer: { flex: 1 },
});
