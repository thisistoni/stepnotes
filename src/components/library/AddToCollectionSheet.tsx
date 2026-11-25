import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Icon, Sheet, Text, TextField, useScrollToEndOnFocus, useToast } from '@/components/ui';
import { cleanCollectionName, COLLECTION_NAME_MAX, presentDances, useCollections } from '@/lib/collections';
import { errorText, useT } from '@/lib/i18n';
import { useDances } from '@/lib/store';
import { colors, radius, space } from '@/lib/theme';

import { CheckRow, IconTile } from './CheckRow';

export interface AddToCollectionSheetProps {
  /** the dance to add (own or starter); null renders nothing useful, keep the sheet closed then */
  danceId: string | null;
  visible: boolean;
  onClose: () => void;
  /** after the sheet has gone (e.g. to open something else next) */
  onClosed?: () => void;
}

/**
 * Put one dance into collections: every collection with a check mark (tap toggles membership
 * right away) and "New collection" inline (creates it with this dance in it). Reusable from the
 * library and the player menu.
 *
 *   <AddToCollectionSheet danceId={dance.id} visible={open} onClose={() => setOpen(false)} />
 */
export function AddToCollectionSheet({ danceId, visible, onClose, onClosed }: AddToCollectionSheetProps) {
  const t = useT();
  const toast = useToast();
  const { collections, addDances, removeDance, create } = useCollections();
  const { dances } = useDances();
  const byId = useMemo(() => new Map(dances.map((d) => [d.id, d])), [dances]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { scrollRef: endRef, onFocus: showEnd } = useScrollToEndOnFocus();
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setAdding(false);
      setName('');
      setError(null);
    }
  }
  const none = collections.length === 0;
  const showForm = adding || none;

  const failed = (e: unknown) => toast.show({ message: (tr) => errorText(e, tr, tr.collections.saveFailed), icon: 'alert' });
  const toggle = (id: string, inIt: boolean) => {
    if (!danceId) return;
    (inIt ? removeDance(id, danceId) : addDances(id, [danceId])).catch(failed);
  };
  const createNew = async () => {
    const clean = cleanCollectionName(name);
    if (!clean || !danceId || busy) return;
    setBusy(true);
    try {
      await create(clean, [danceId]);
      setName('');
      setAdding(false);
    } catch (e) {
      setError(errorText(e, t, t.collections.saveFailed));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} onClosed={onClosed} title={t.collections.pickTitle} testID="add-to-collection-sheet">
      {none && (
        <Text variant="small" color="ink2" style={s.intro}>
          {t.collections.pickIntro}
        </Text>
      )}
      <ScrollView ref={endRef} style={s.list} contentContainerStyle={s.listContent} keyboardShouldPersistTaps="handled">
        {collections.map((c) => {
          const inIt = !!danceId && c.danceIds.includes(danceId);
          const count = presentDances(c, byId).length;
          return (
            <CheckRow
              key={c.id}
              leading={
                <IconTile>
                  <Icon name="stack" size={24} color={colors.primaryInk} />
                </IconTile>
              }
              title={c.name}
              subtitle={t.collections.count(count)}
              checked={inIt}
              onPress={() => toggle(c.id, inIt)}
              testID={`pick-collection-${c.id}`}
            />
          );
        })}
        {showForm ? (
          <View style={[s.form, !none && s.formAfterList]}>
            <TextField
              label={t.collections.newCollection}
              value={name}
              onChangeText={(v) => {
                setName(v);
                setError(null);
              }}
              placeholder={t.collections.namePlaceholder}
              maxLength={COLLECTION_NAME_MAX}
              autoCapitalize="sentences"
              autoFocus={adding}
              returnKeyType="done"
              onSubmitEditing={createNew}
              onFocus={showEnd}
              error={error}
              clearable
              testID="new-collection-field"
            />
            <Button
              label={t.collections.create}
              icon="plus"
              variant="tinted"
              onPress={createNew}
              disabled={!cleanCollectionName(name)}
              loading={busy}
              testID="new-collection-create"
            />
          </View>
        ) : (
          <Pressable
            onPress={() => setAdding(true)}
            accessibilityRole="button"
            accessibilityLabel={t.collections.newCollection}
            style={({ pressed }) => [s.newRow, pressed && s.pressed]}
            testID="new-collection-open"
          >
            <View style={s.newTile}>
              <Icon name="plus" size={24} color={colors.primaryInk} strokeWidth={2.6} />
            </View>
            <Text variant="bodyStrong" color="primaryInk">
              {t.collections.newCollection}
            </Text>
          </Pressable>
        )}
      </ScrollView>
      <Button label={t.collections.done} variant={none ? 'secondary' : 'primary'} onPress={onClose} style={s.done} testID="pick-collection-done" />
    </Sheet>
  );
}

const s = StyleSheet.create({
  intro: { marginTop: space.xxs, marginBottom: space.s },
  list: { flexShrink: 1, marginHorizontal: -space.xs },
  listContent: { paddingTop: space.xs, paddingBottom: space.xs },
  form: { gap: space.m, paddingHorizontal: space.xs },
  formAfterList: { marginTop: space.m },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 64, paddingHorizontal: space.xs, borderRadius: radius.md },
  pressed: { backgroundColor: colors.track },
  newTile: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { marginTop: space.m },
});
