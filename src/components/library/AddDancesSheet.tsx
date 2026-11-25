import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button, SearchField, Sheet, Text, useToast } from '@/components/ui';
import { useCollections } from '@/lib/collections';
import { errorText, useT } from '@/lib/i18n';
import { useDances } from '@/lib/store';
import { space } from '@/lib/theme';

import { CheckRow, DanceThumbTile } from './CheckRow';
import { matches } from './useLibrary';

/**
 * "Add dances" to one collection: every dance (own first, then the starters) as a checklist with
 * thumbnails and search. Ticking adds a dance right away, unticking removes it.
 */
export function AddDancesSheet({ collectionId, visible, onClose }: { collectionId: string | null; visible: boolean; onClose: () => void }) {
  const t = useT();
  const toast = useToast();
  const { dances } = useDances();
  const { get, addDances, removeDance } = useCollections();
  const collection = collectionId ? get(collectionId) : undefined;
  const [query, setQuery] = useState('');
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setQuery('');
  }
  // a steady list height, so the sheet does not jump while searching
  const { height } = useWindowDimensions();
  // (the sheet may take 88% of the screen; title, search and Done take about 250)
  const listHeight = Math.max(180, Math.min(height * 0.88 - 250, 470));

  const inIt = useMemo(() => new Set(collection?.danceIds ?? []), [collection]);
  const { mine, starters } = useMemo(() => {
    const hit = dances.filter((d) => matches(d, query, null));
    return { mine: hit.filter((d) => !d.builtIn), starters: hit.filter((d) => d.builtIn) };
  }, [dances, query]);

  const toggle = (danceId: string) => {
    if (!collection) return;
    const p = inIt.has(danceId) ? removeDance(collection.id, danceId) : addDances(collection.id, [danceId]);
    p.catch((e) => toast.show({ message: (tr) => errorText(e, tr, tr.collections.saveFailed), icon: 'alert' }));
  };

  const section = (title: string, list: typeof dances) =>
    list.length > 0 && (
      <View style={s.section}>
        <Text variant="overline" color="ink2" style={s.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {list.map((d) => {
          const name = d.name.trim() || t.common.untitled;
          return (
            <CheckRow
              key={d.id}
              leading={<DanceThumbTile dance={d} />}
              title={name}
              subtitle={[d.style.trim(), t.collections.steps(d.roles.leader.steps.length)].filter(Boolean).join(' · ')}
              checked={inIt.has(d.id)}
              onPress={() => toggle(d.id)}
              testID={`pick-dance-${d.id}`}
            />
          );
        })}
      </View>
    );

  return (
    <Sheet visible={visible} onClose={onClose} title={collection ? t.collections.addTitle(collection.name) : t.collections.addDances} testID="add-dances-sheet">
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t.collections.searchPlaceholder}
        accessibilityLabel={t.collections.searchPlaceholder}
        style={s.search}
        testID="pick-search"
      />
      <ScrollView style={[s.list, { height: listHeight }]} contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled">
        {mine.length === 0 && starters.length === 0 ? (
          <Text variant="small" color="ink2" align="center" style={s.none}>
            {query.trim() ? t.collections.noMatch(query.trim()) : t.collections.noDances}
          </Text>
        ) : (
          <>
            {section(t.library.myDances, mine)}
            {section(t.library.starters, starters)}
          </>
        )}
      </ScrollView>
      <Button label={t.collections.done} onPress={onClose} style={s.done} testID="pick-done" />
    </Sheet>
  );
}

const s = StyleSheet.create({
  search: { marginTop: space.s },
  // (a fixed height so the sheet keeps its size while searching; it gives way to the keyboard)
  list: { flexShrink: 1, marginTop: space.s, marginHorizontal: -space.xs },
  listContent: { paddingBottom: space.s },
  section: { marginTop: space.s },
  sectionTitle: { marginBottom: space.xxs, marginLeft: space.xs },
  none: { marginTop: space.xl, paddingHorizontal: space.l },
  done: { marginTop: space.m },
});
