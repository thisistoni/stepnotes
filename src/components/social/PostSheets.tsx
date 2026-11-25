import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button, DiagramThumb, Icon, Sheet, Text, TextField } from '@/components/ui';
import { cloudErrorText } from '@/lib/cloud';
import { useT } from '@/lib/i18n';
import { useDances } from '@/lib/store';
import { colors, DEFAULT_FOOT_STYLE, radius, space, styleColor } from '@/lib/theme';
import type { Dance } from '@/lib/types';

export const NOTE_MAX = 200;

/** A small tinted tile with the dance's footprint thumbnail. */
export function DanceTile({ dance, size = 52 }: { dance: Dance | null; size?: number }) {
  const tone = styleColor(dance?.style);
  return (
    <View style={[s.tile, { width: size, height: size, backgroundColor: tone.tint }]}>
      {dance ? (
        <DiagramThumb pattern={dance.roles.leader} tone={tone} footStyle={dance.footStyle?.leader ?? DEFAULT_FOOT_STYLE.leader} aspect={1} style={s.thumb} />
      ) : (
        <Icon name="footprints" size={size / 2} color={tone.deep} />
      )}
    </View>
  );
}

function useOnOpen(visible: boolean, reset: () => void) {
  const [was, setWas] = useState(visible);
  if (visible !== was) {
    setWas(visible);
    if (visible) reset();
  }
}

/** Teacher: pick a dance from the library, add an optional note, post it to the class. */
export function AddPostSheet({ visible, onClose, onPost }: { visible: boolean; onClose: () => void; onPost: (dance: Dance, note: string) => Promise<void> }) {
  const t = useT();
  const { dances } = useDances();
  const [picked, setPicked] = useState<Dance | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useOnOpen(visible, () => {
    setPicked(null);
    setNote('');
    setError(null);
  });
  const post = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      await onPost(picked, note.trim());
      onClose();
    } catch (e) {
      setError(cloudErrorText(e, t));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t.classes.pickTitle} testID="add-post-sheet">
      {picked ? (
        <ScrollView style={s.scroll} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          <View style={s.picked} testID="add-post-picked">
            <DanceTile dance={picked} size={56} />
            <View style={s.rowText}>
              <Text variant="label" numberOfLines={2}>
                {picked.name.trim() || t.common.untitled}
              </Text>
              {!!picked.style.trim() && (
                <Text variant="caption" color="ink2" numberOfLines={1}>
                  {picked.style.trim()}
                </Text>
              )}
            </View>
          </View>
          <TextField
            label={t.classes.noteLabel}
            value={note}
            onChangeText={setNote}
            placeholder={t.classes.notePlaceholder}
            maxLength={NOTE_MAX}
            multiline
            minHeight={72}
            error={error}
            testID="add-post-note"
          />
          <Button label={t.classes.post} icon="arrow-up" loading={busy} onPress={post} testID="add-post-submit" />
          <Button label={t.classes.otherDance} icon="back" variant="ghost" size="md" onPress={() => setPicked(null)} testID="add-post-back" />
        </ScrollView>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.body}>
          <Text variant="small" color="ink2">
            {t.classes.pickBody}
          </Text>
          {dances.length === 0 ? (
            <Text variant="small">{t.classes.pickEmpty}</Text>
          ) : (
            <View style={s.list}>
              {dances.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => setPicked(d)}
                  accessibilityRole="button"
                  accessibilityLabel={[d.name.trim() || t.common.untitled, d.style.trim()].filter(Boolean).join(', ')}
                  style={({ pressed }) => [s.row, pressed && s.pressed]}
                  testID={`pick-${d.id}`}
                >
                  <DanceTile dance={d} size={44} />
                  <View style={s.rowText}>
                    <Text variant="label" numberOfLines={2}>
                      {d.name.trim() || t.common.untitled}
                    </Text>
                    {!!d.style.trim() && (
                      <Text variant="caption" color="ink2" numberOfLines={1}>
                        {d.style.trim()}
                      </Text>
                    )}
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.ink3} />
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </Sheet>
  );
}

/** Teacher: change the note of a post. */
export function NoteSheet({ visible, onClose, initial, onSave }: { visible: boolean; onClose: () => void; initial: string; onSave: (note: string) => Promise<void> }) {
  const t = useT();
  const [note, setNote] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useOnOpen(visible, () => {
    setNote(initial);
    setError(null);
  });
  const save = async () => {
    setBusy(true);
    try {
      await onSave(note.trim());
      onClose();
    } catch (e) {
      setError(cloudErrorText(e, t));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={t.classes.editNote} testID="note-sheet">
      <View style={s.body}>
        <TextField
          label={t.classes.noteLabel}
          value={note}
          onChangeText={setNote}
          placeholder={t.classes.notePlaceholder}
          maxLength={NOTE_MAX}
          multiline
          minHeight={72}
          error={error}
          testID="note-field"
        />
        <Button label={t.classes.noteSave} icon="check" loading={busy} onPress={save} testID="note-save" />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  tile: { borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumb: { position: 'absolute', left: 4, right: 4, top: 4, bottom: 4 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: space.m, paddingTop: space.xs, paddingBottom: space.xs },
  list: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 60, paddingHorizontal: space.xs, paddingVertical: space.xs, borderRadius: radius.md },
  pressed: { backgroundColor: colors.track },
  rowText: { flex: 1, minWidth: 0 },
  picked: { flexDirection: 'row', alignItems: 'center', gap: space.m, padding: space.m, borderRadius: radius.lg, backgroundColor: colors.track },
});
