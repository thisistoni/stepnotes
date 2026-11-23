import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button, Entrance, Header, hapticNotify, Icon, Screen, Text, TextField, useToast } from '@/components/ui';
import { useDances } from '@/lib/store';
import { colors, radius, space } from '@/lib/theme';
import { DanceValidationError } from '@/lib/validate';

/**
 * Clipboard without an extra dependency: only the browser's async Clipboard API qualifies
 * (React Native's own Clipboard is deprecated and expo-clipboard is not installed). On phones
 * the field's own long-press → Paste is used instead.
 */
function webClipboard(): { readText: () => Promise<string> } | null {
  if (Platform.OS !== 'web') return null;
  const nav = (globalThis as { navigator?: { clipboard?: { readText?: () => Promise<string> } } }).navigator;
  const read = nav?.clipboard?.readText;
  return read ? { readText: () => read.call(nav!.clipboard) } : null;
}

const NOT_A_DANCE = 'That doesn’t look like a StepNotes dance. Ask the sender to share it again.';

export default function ImportScreen() {
  const { importJson } = useDances();
  const toast = useToast();
  const [text, setText] = useState('');
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [clipboard] = useState(webClipboard);

  const onImport = async () => {
    setBusy(true);
    try {
      const d = await importJson(text);
      hapticNotify('success');
      toast.show({ message: `“${d.name}” added to your dances`, icon: 'check' });
      router.replace(`/dance/${d.id}`);
    } catch (e) {
      setBusy(false);
      hapticNotify('error');
      // validation errors are written for people; anything else (storage) gets a generic message
      setError(
        e instanceof DanceValidationError
          ? { message: NOT_A_DANCE, detail: /StepNotes dance/i.test(e.message) ? undefined : e.message }
          : { message: 'Could not save this dance. Please try again.' },
      );
    }
  };

  const paste = async () => {
    try {
      const t = await clipboard?.readText();
      if (t) {
        setText(t);
        setError(null);
      } else {
        toast.show({ message: 'The clipboard is empty', icon: 'clipboard' });
      }
    } catch {
      toast.show({ message: 'Could not read the clipboard. Paste into the field instead.', icon: 'alert' });
    }
  };

  return (
    <Screen
      header={<Header title="Import a dance" leading="close" />}
      footer={
        <Button
          label="Add to my dances"
          icon="import"
          disabled={!text.trim()}
          loading={busy}
          onPress={onImport}
          testID="import-submit"
        />
      }
      testID="import"
    >
      <Entrance index={0} style={s.intro}>
        <View style={s.tile}>
          <Icon name="clipboard" size={26} color={colors.primary} strokeWidth={2.4} />
        </View>
        <Text variant="body" color="ink2" style={s.introText}>
          Paste a dance someone shared with you. Extra text around it, like a chat message, is fine.
        </Text>
      </Entrance>

      <Entrance index={1}>
        <View style={s.labelRow}>
          <Text variant="smallStrong" color="ink2" style={s.label}>
            Shared dance
          </Text>
          {clipboard && (
            <Button label="Paste" icon="clipboard" variant="secondary" size="sm" inline onPress={paste} testID="import-paste" />
          )}
        </View>
        <TextField
          accessibilityLabel="Shared dance"
          value={text}
          onChangeText={(t) => {
            setText(t);
            setError(null);
          }}
          multiline
          minHeight={200}
          mono
          clearable
          placeholder={'{ "app": "stepnotes", … }'}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          error={error?.message}
          testID="import-field"
        />
        {!!error?.detail && (
          <Text variant="caption" color="ink2" style={s.detail} testID="import-detail">
            {error.detail}
          </Text>
        )}
      </Entrance>
    </Screen>
  );
}

const s = StyleSheet.create({
  intro: { flexDirection: 'row', alignItems: 'center', gap: space.m, marginTop: space.s, marginBottom: space.xl },
  tile: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: { flex: 1 },
  detail: { marginTop: 6, marginLeft: 26 },
  labelRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 44, marginBottom: space.s },
  label: { marginLeft: 4, marginBottom: 6 },
});
