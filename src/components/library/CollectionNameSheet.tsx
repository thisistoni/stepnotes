import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Sheet, TextField } from '@/components/ui';
import { cleanCollectionName, COLLECTION_NAME_MAX } from '@/lib/collections';
import { errorText, useT } from '@/lib/i18n';
import { space } from '@/lib/theme';

/**
 * Name a collection: "New collection" (empty field, Create) or "Rename collection" (prefilled,
 * Save). `onSubmit` gets the cleaned name; when it rejects the error is shown under the field.
 */
export function CollectionNameSheet({
  visible,
  mode,
  initialName = '',
  onSubmit,
  onClose,
  onClosed,
}: {
  visible: boolean;
  mode: 'create' | 'rename';
  initialName?: string;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
  onClosed?: () => void;
}) {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(initialName);
      setError(null);
    }
  }
  const clean = cleanCollectionName(name);

  const submit = async () => {
    if (!clean || busy) return;
    setBusy(true);
    try {
      await onSubmit(clean);
      onClose();
    } catch (e) {
      setError(errorText(e, t, t.collections.saveFailed));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onClosed={onClosed}
      title={mode === 'create' ? t.collections.newCollection : t.collections.renameTitle}
      testID="collection-name-sheet"
    >
      <View style={s.body}>
        <TextField
          label={t.collections.nameLabel}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
          placeholder={t.collections.namePlaceholder}
          maxLength={COLLECTION_NAME_MAX}
          autoCapitalize="sentences"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={submit}
          error={error}
          clearable
          testID="collection-name-field"
        />
        <Button
          label={mode === 'create' ? t.collections.create : t.collections.save}
          icon={mode === 'create' ? 'plus' : 'check'}
          onPress={submit}
          disabled={!clean}
          loading={busy}
          testID="collection-name-save"
        />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  body: { gap: space.l, paddingTop: space.s, paddingBottom: space.xs },
});
