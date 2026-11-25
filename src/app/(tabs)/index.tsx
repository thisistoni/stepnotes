import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DanceGrid, DanceGridSkeleton } from '@/components/library/DanceGrid';
import { LessonCard } from '@/components/library/LessonCard';
import { MyDancesEmpty } from '@/components/library/MyDancesEmpty';
import { NoMatches } from '@/components/library/NoMatches';
import { SectionHeader } from '@/components/library/SectionHeader';
import { StyleFilterChips } from '@/components/library/StyleFilterChips';
import { matches, useStyleFilters } from '@/components/library/useLibrary';
import { Entrance, Fab, Header, IconButton, Screen, SearchField } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useDances } from '@/lib/store';
import { space } from '@/lib/theme';

export default function Library() {
  const { dances, custom, ready } = useDances();
  const t = useT();
  const [query, setQuery] = useState('');
  const [styleKey, setStyleKey] = useState<string | null>(null);

  const filters = useStyleFilters(dances);
  // a filter whose style no longer exists (dance deleted) falls back to All
  const activeStyle = filters.find((f) => f.key === styleKey) ?? null;
  const activeKey = activeStyle?.key ?? null;
  const filtering = !!query.trim() || !!activeKey;

  const { mine, starters } = useMemo(() => {
    const hit = dances.filter((d) => matches(d, query, activeKey));
    return { mine: hit.filter((d) => !d.builtIn), starters: hit.filter((d) => d.builtIn) };
  }, [dances, query, activeKey]);

  const open = useCallback((id: string) => router.push(`/dance/${id}`), []);
  const create = useCallback(() => router.push('/edit/new'), []);
  const clear = () => {
    setQuery('');
    setStyleKey(null);
  };
  const noMatches = ready && filtering && mine.length === 0 && starters.length === 0;

  return (
    <Screen padded={false} fab={<Fab label={t.library.create} onPress={create} testID="fab-create" />} testID="library">
      <Header
        large
        eyebrow="Waltzy"
        title={t.library.title}
        right={<IconButton icon="import" label={t.library.import} onPress={() => router.push('/import')} testID="import-button" />}
      />
      <Entrance index={0} style={s.px}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t.library.searchPlaceholder}
          accessibilityLabel={t.library.searchPlaceholder}
          style={s.search}
          testID="search"
        />
      </Entrance>
      <Entrance index={1}>
        <StyleFilterChips filters={filters} value={activeKey} onChange={setStyleKey} />
      </Entrance>

      <View style={s.px}>
        {noMatches ? (
          <Entrance index={2} style={s.noMatches}>
            <NoMatches query={query} styleLabel={activeStyle?.label ?? null} onClear={clear} />
          </Entrance>
        ) : (
          <>
            {!ready ? (
              <>
                <SectionHeader title={t.library.myDances} />
                <DanceGridSkeleton />
              </>
            ) : mine.length > 0 ? (
              <>
                <SectionHeader title={t.library.myDances} count={mine.length} />
                <DanceGrid dances={mine} onOpen={open} startIndex={2} />
              </>
            ) : custom.length === 0 && !filtering ? (
              <>
                <SectionHeader title={t.library.myDances} />
                <Entrance index={2}>
                  <MyDancesEmpty onCreate={create} />
                </Entrance>
              </>
            ) : null}

            {starters.length > 0 && (
              <>
                <SectionHeader title={t.library.starters} count={starters.length} />
                <DanceGrid dances={starters} onOpen={open} startIndex={3} />
              </>
            )}
          </>
        )}

        <Entrance index={5} style={s.lesson}>
          <LessonCard onPress={() => router.push('/intro?lesson=1')} />
        </Entrance>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  px: { paddingHorizontal: space.gutter },
  search: { marginTop: space.l },
  noMatches: { marginTop: space.xl },
  lesson: { marginTop: space.xxl },
});
