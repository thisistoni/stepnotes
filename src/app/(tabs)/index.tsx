import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AddDancesSheet } from '@/components/library/AddDancesSheet';
import { AddToCollectionSheet } from '@/components/library/AddToCollectionSheet';
import { CollectionChips } from '@/components/library/CollectionChips';
import { CollectionEmpty, CollectionHeader } from '@/components/library/CollectionHeader';
import { CollectionNameSheet } from '@/components/library/CollectionNameSheet';
import { DanceGrid, DanceGridSkeleton } from '@/components/library/DanceGrid';
import { LessonCard } from '@/components/library/LessonCard';
import { MyDancesEmpty } from '@/components/library/MyDancesEmpty';
import { NoMatches } from '@/components/library/NoMatches';
import { SectionHeader } from '@/components/library/SectionHeader';
import { StyleFilterChips } from '@/components/library/StyleFilterChips';
import { matches, useStyleFilters } from '@/components/library/useLibrary';
import { Entrance, Fab, Header, Menu, Screen, SearchField, useToast, type MenuItem } from '@/components/ui';
import { presentDances, useCollections, type Collection } from '@/lib/collections';
import { errorText, useT } from '@/lib/i18n';
import { useDances } from '@/lib/store';
import { space } from '@/lib/theme';

type NameTarget = { mode: 'create' } | { mode: 'rename'; id: string; name: string };

/** An overlay that keeps its last target while it animates out (no content jump while closing). */
function useOverlay<T>() {
  const [state, setState] = useState<{ value: T | null; visible: boolean }>({ value: null, visible: false });
  const show = useCallback((value: T) => setState({ value, visible: true }), []);
  const hide = useCallback(() => setState((st) => ({ ...st, visible: false })), []);
  return { value: state.value, visible: state.visible, show, hide };
}

export default function Library() {
  const { dances, custom, ready } = useDances();
  const { collections, get, create, rename, remove, restore, addDances, removeDance } = useCollections();
  const t = useT();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [styleKey, setStyleKey] = useState<string | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const nameSheet = useOverlay<NameTarget>();
  const addSheet = useOverlay<string>();
  const collectionMenu = useOverlay<true>();
  const cardMenu = useOverlay<string>();
  const pickSheet = useOverlay<string>();

  const byId = useMemo(() => new Map(dances.map((d) => [d.id, d])), [dances]);
  // a collection that is gone (deleted here or on another device) falls back to All dances
  const active = (collectionId && get(collectionId)) || null;
  const inCollection = useMemo(() => (active ? presentDances(active, byId) : null), [active, byId]);
  const chips = useMemo(() => collections.map((c) => ({ id: c.id, name: c.name, count: presentDances(c, byId).length })), [collections, byId]);

  // the style row only offers the styles of what is shown (the whole library or the collection)
  const filters = useStyleFilters(inCollection ?? dances);
  // a filter whose style no longer exists (dance deleted) falls back to All
  const activeStyle = filters.find((f) => f.key === styleKey) ?? null;
  const activeKey = activeStyle?.key ?? null;
  const filtering = !!query.trim() || !!activeKey;

  const { mine, starters, picked } = useMemo(() => {
    if (inCollection) return { mine: [], starters: [], picked: inCollection.filter((d) => matches(d, query, activeKey)) };
    const hit = dances.filter((d) => matches(d, query, activeKey));
    return { mine: hit.filter((d) => !d.builtIn), starters: hit.filter((d) => d.builtIn), picked: [] };
  }, [dances, inCollection, query, activeKey]);

  const open = useCallback((id: string) => router.push(`/dance/${id}`), []);
  const create_ = useCallback(() => router.push('/edit/new'), []);
  const clear = () => {
    setQuery('');
    setStyleKey(null);
  };
  const failed = (e: unknown) => toast.show({ message: (tr) => errorText(e, tr, tr.collections.saveFailed), icon: 'alert' });

  const deleteCollection = async (c: Collection) => {
    try {
      const removed = await remove(c.id);
      if (!removed) return;
      toast.show({
        message: (tr) => tr.collections.deleted(removed.name),
        icon: 'trash',
        action: {
          label: (tr) => tr.common.undo,
          onPress: () =>
            restore(removed)
              .then(() => setCollectionId(removed.id))
              .catch(() => toast.show({ message: (tr) => tr.collections.restoreFailed, icon: 'alert' })),
        },
      });
    } catch (e) {
      failed(e);
    }
  };

  const takeOut = async (c: Collection, danceId: string) => {
    try {
      const at = await removeDance(c.id, danceId);
      if (at < 0) return;
      toast.show({
        message: (tr) => tr.collections.removed(c.name),
        icon: 'check',
        action: { label: (tr) => tr.common.undo, onPress: () => addDances(c.id, [danceId], at).catch(failed) },
      });
    } catch (e) {
      failed(e);
    }
  };

  // long press on any card: straight to "Add to a collection"; inside a collection a small menu
  const showCardMenu = cardMenu.show;
  const showPick = pickSheet.show;
  const onCardLongPress = useCallback((id: string) => (active ? showCardMenu(id) : showPick(id)), [active, showCardMenu, showPick]);

  const cardId = cardMenu.value;
  const cardDance = cardId ? byId.get(cardId) : undefined;
  const cardItems: MenuItem[] =
    active && cardId
      ? [
          { key: 'remove', label: t.collections.removeFrom(active.name), hint: t.collections.removeFromHint, icon: 'minus', onPress: () => void takeOut(active, cardId) },
          { key: 'add', label: t.collections.addTo, hint: t.collections.addToHint, icon: 'stack-plus', onPress: () => showPick(cardId) },
          { key: 'open', label: t.common.open, icon: 'play', onPress: () => open(cardId) },
        ]
      : [];
  const collectionItems: MenuItem[] = active
    ? [
        { key: 'add', label: t.collections.addDances, hint: t.collections.addDancesHint, icon: 'plus', onPress: () => addSheet.show(active.id) },
        { key: 'rename', label: t.collections.rename, icon: 'pencil', onPress: () => nameSheet.show({ mode: 'rename', id: active.id, name: active.name }) },
        { key: 'delete', label: t.collections.delete, hint: t.collections.deleteHint, icon: 'trash', destructive: true, onPress: () => void deleteCollection(active) },
      ]
    : [];

  const noMatches = ready && filtering && (inCollection ? inCollection.length > 0 && picked.length === 0 : mine.length === 0 && starters.length === 0);
  // the empty cards have their own button: no second, floating one on top of them
  const showsEmptyCard = ready && (inCollection ? inCollection.length === 0 : custom.length === 0 && !filtering);
  const fab = showsEmptyCard ? undefined : active ? (
    <Fab label={t.collections.addDances} onPress={() => addSheet.show(active.id)} testID="fab-add-dances" />
  ) : (
    <Fab label={t.library.create} onPress={create_} testID="fab-create" />
  );

  return (
    <Screen padded={false} fab={fab} testID="library">
      <Header large eyebrow="Waltzy" title={t.library.title} />
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
        <CollectionChips items={chips} value={active?.id ?? null} onChange={setCollectionId} onNew={() => nameSheet.show({ mode: 'create' })} />
        {(!inCollection || inCollection.length > 0) && (
          <StyleFilterChips filters={filters} value={activeKey} onChange={setStyleKey} style={s.styles} />
        )}
      </Entrance>

      <View style={s.px}>
        {active && inCollection && (
          <Entrance index={2}>
            <CollectionHeader name={active.name} count={inCollection.length} onMore={() => collectionMenu.show(true)} />
          </Entrance>
        )}
        {noMatches ? (
          <Entrance index={2} style={active ? undefined : s.noMatches}>
            <NoMatches query={query} styleLabel={activeStyle?.label ?? null} onClear={clear} />
          </Entrance>
        ) : inCollection ? (
          inCollection.length === 0 ? (
            <Entrance index={3}>
              <CollectionEmpty onAdd={() => active && addSheet.show(active.id)} />
            </Entrance>
          ) : (
            <DanceGrid dances={picked} onOpen={open} onLongPress={onCardLongPress} onMore={showCardMenu} startIndex={3} />
          )
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
                <DanceGrid dances={mine} onOpen={open} onLongPress={onCardLongPress} startIndex={2} />
              </>
            ) : custom.length === 0 && !filtering ? (
              <>
                <SectionHeader title={t.library.myDances} />
                <Entrance index={2}>
                  <MyDancesEmpty onCreate={create_} />
                </Entrance>
              </>
            ) : null}

            {starters.length > 0 && (
              <>
                <SectionHeader title={t.library.starters} count={starters.length} />
                <DanceGrid dances={starters} onOpen={open} onLongPress={onCardLongPress} startIndex={3} />
              </>
            )}
          </>
        )}

        {!active && (
          <Entrance index={5} style={s.lesson}>
            <LessonCard onPress={() => router.push('/intro?lesson=1')} />
          </Entrance>
        )}
      </View>

      <CollectionNameSheet
        visible={nameSheet.visible}
        mode={nameSheet.value?.mode ?? 'create'}
        initialName={nameSheet.value?.mode === 'rename' ? nameSheet.value.name : ''}
        onSubmit={async (name) => {
          const target = nameSheet.value;
          if (target?.mode === 'rename') return rename(target.id, name);
          const c = await create(name);
          setCollectionId(c.id);
          setStyleKey(null);
        }}
        onClose={nameSheet.hide}
      />
      <AddDancesSheet collectionId={addSheet.value} visible={addSheet.visible} onClose={addSheet.hide} />
      <AddToCollectionSheet danceId={pickSheet.value} visible={pickSheet.visible} onClose={pickSheet.hide} />
      <Menu visible={collectionMenu.visible} onClose={collectionMenu.hide} title={active?.name} items={collectionItems} />
      <Menu visible={cardMenu.visible} onClose={cardMenu.hide} title={cardDance ? cardDance.name.trim() || t.common.untitled : undefined} items={cardItems} />
    </Screen>
  );
}

const s = StyleSheet.create({
  px: { paddingHorizontal: space.gutter },
  search: { marginTop: space.l },
  styles: { marginTop: space.xs },
  noMatches: { marginTop: space.xl },
  lesson: { marginTop: space.xxl },
});
