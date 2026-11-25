import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Sheet, TextField, useToast } from '@/components/ui';
import { cloudErrorText } from '@/lib/cloud';
import { NAME_MAX, useAuth } from '@/lib/cloud/auth';
import { useT } from '@/lib/i18n';
import { space } from '@/lib/theme';

/** Change the display name (Me tab). */
export function NameSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const { profile, saveProfile } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(profile?.displayName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setName(profile?.displayName ?? '');
      setError(null);
    }
  }

  const save = async () => {
    if (!name.trim()) return setError(t.account.nameEmpty);
    setBusy(true);
    try {
      await saveProfile(name);
      onClose();
      toast.show({ message: (tr) => tr.account.nameSaved, icon: 'check' });
    } catch (e) {
      setError(cloudErrorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t.account.editName} testID="name-sheet">
      <View style={s.body}>
        <TextField
          label={t.account.nameLabel}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
          placeholder={t.account.namePlaceholder}
          maxLength={NAME_MAX}
          autoCapitalize="words"
          autoComplete="name"
          returnKeyType="done"
          onSubmitEditing={save}
          error={error}
          hint={t.account.nameBody}
          clearable
          testID="name-field"
        />
        <Button label={t.account.saveName} onPress={save} loading={busy} testID="name-save" />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  body: { gap: space.l, paddingTop: space.s, paddingBottom: space.xs },
});
