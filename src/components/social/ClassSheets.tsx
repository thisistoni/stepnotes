import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button, Sheet, Text, TextField, ToggleRow } from '@/components/ui';
import { cloudErrorText } from '@/lib/cloud';
import { useT } from '@/lib/i18n';
import { parseClassInput } from '@/lib/social/links';
import { space } from '@/lib/theme';

export const CLASS_NAME_MAX = 60;
export const CLASS_DESC_MAX = 400;

/** Re-initialise form state each time a sheet opens. */
function useOnOpen(visible: boolean, reset: () => void) {
  const [was, setWas] = useState(visible);
  if (visible !== was) {
    setWas(visible);
    if (visible) reset();
  }
}

/**
 * Create a class, or edit its name, description and whether new members need approval.
 * `onSubmit` throws a CloudError on failure (shown under the form); on success the sheet closes.
 */
export function ClassFormSheet({
  visible,
  onClose,
  initial,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  /** editing: the current values */
  initial?: { name: string; description: string; approval: boolean };
  onSubmit: (name: string, description: string, approval: boolean) => Promise<void>;
}) {
  const t = useT();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [approval, setApproval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useOnOpen(visible, () => {
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setApproval(initial?.approval ?? false);
    setError(null);
  });

  const submit = async () => {
    if (!name.trim()) return setError(t.classes.nameEmpty);
    setBusy(true);
    try {
      await onSubmit(name.trim(), description.trim(), approval);
      onClose();
    } catch (e) {
      setError(cloudErrorText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={initial ? t.classes.editTitle : t.classes.createTitle} testID="class-form">
      <ScrollView style={s.scroll} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TextField
          label={t.classes.nameLabel}
          value={name}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
          placeholder={t.classes.namePlaceholder}
          maxLength={CLASS_NAME_MAX}
          autoCapitalize="sentences"
          returnKeyType="next"
          error={error}
          clearable
          testID="class-name"
        />
        <TextField
          label={t.classes.descLabel}
          value={description}
          onChangeText={setDescription}
          placeholder={t.classes.descPlaceholder}
          maxLength={CLASS_DESC_MAX}
          multiline
          minHeight={88}
          testID="class-description"
        />
        <ToggleRow title={t.classes.approvalLabel} subtitle={t.classes.approvalHint} value={approval} onChange={setApproval} testID="class-approval" />
        <Button label={initial ? t.classes.save : t.classes.createSubmit} icon={initial ? 'check' : 'plus'} loading={busy} onPress={submit} testID="class-submit" />
      </ScrollView>
    </Sheet>
  );
}

/** Join a class: scan the QR code, type the code or paste the link, then the class page opens (join there). */
export function JoinClassSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const go = (path: string) => {
    setTarget(path);
    onClose();
  };
  useOnOpen(visible, () => {
    setText('');
    setError(null);
    setTarget(null);
  });
  const find = () => {
    const code = parseClassInput(text);
    if (!code) return setError(t.classes.joinBad);
    go(`/c/${code}`);
  };
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      onClosed={() => {
        if (target) router.push(target as Href);
        setTarget(null);
      }}
      title={t.classes.joinTitle}
      testID="join-sheet"
    >
      <View style={s.body}>
        <Text variant="small" color="ink2">
          {t.classes.joinBody}
        </Text>
        <Button label={t.classes.joinScan} icon="qr" onPress={() => go('/scan')} testID="join-scan" />
        <TextField
          label={t.classes.joinLabel}
          value={text}
          onChangeText={(v) => {
            setText(v);
            setError(null);
          }}
          placeholder={t.classes.joinPlaceholder}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={find}
          error={error}
          clearable
          testID="join-code"
        />
        <Button label={t.classes.joinFind} icon="search" variant="secondary" onPress={find} testID="join-find" />
      </View>
    </Sheet>
  );
}

const s = StyleSheet.create({
  // two fields: scrolls on a small phone once the keyboard is up
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { gap: space.l, paddingTop: space.s, paddingBottom: space.xs },
});
