import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button, Entrance, Header, hapticNotify, Icon, Screen, Text, TextField, useToast } from '@/components/ui';
import { errorText, useT } from '@/lib/i18n';
import { useDances } from '@/lib/store';
import { colors, radius, space } from '@/lib/theme';
import { DanceValidationError, parseDanceJson } from '@/lib/validate';

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

export default function ImportScreen() {
  const { importJson } = useDances();
  const toast = useToast();
  const t = useT();
  const [text, setText] = useState('');
  /** what went wrong, kept as the error itself so its message follows the language */
  const [failure, setFailure] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [clipboard] = useState(webClipboard);
  // live feedback: what will be added (before pressing the button)
  const preview = useMemo(() => {
    if (!text.trim()) return null;
    try {
      const d = parseDanceJson(text);
      const steps = Math.max(...Object.values(d.roles).map((p) => p?.steps.length ?? 0));
      return t.import.preview(d.name.trim() || t.common.untitled, d.style.trim(), steps, !!d.roles.follower);
    } catch {
      return null;
    }
  }, [text, t]);
  // validation problems: the friendly line, plus the detail unless the text is no dance at all
  const error =
    failure == null
      ? null
      : failure instanceof DanceValidationError
        ? { message: t.import.notADance, detail: failure.notADance ? undefined : failure.localized(t) }
        : { message: errorText(failure, t, t.import.saveFailed) };

  const onImport = async () => {
    setBusy(true);
    try {
      const d = await importJson(text);
      hapticNotify('success');
      toast.show({ message: (tr) => tr.import.added(d.name), icon: 'check' });
      router.replace(`/dance/${d.id}`);
    } catch (e) {
      setBusy(false);
      hapticNotify('error');
      setFailure(e);
    }
  };

  const paste = async () => {
    try {
      const pasted = await clipboard?.readText();
      if (pasted) {
        setText(pasted);
        setFailure(null);
      } else {
        toast.show({ message: (tr) => tr.import.clipboardEmpty, icon: 'clipboard' });
      }
    } catch {
      toast.show({ message: (tr) => tr.import.clipboardFailed, icon: 'alert' });
    }
  };

  return (
    <Screen
      header={<Header title={t.import.title} leading="close" />}
      footer={
        <Button
          label={t.import.submit}
          icon="import"
          disabled={!text.trim()}
          loading={busy}
          onPress={onImport}
          testID="import-submit"
        />
      }
      // a modal is presented as a page sheet on iOS: it already sits below the status bar
      topInset={Platform.OS !== 'ios'}
      testID="import"
    >
      <Entrance index={0} style={s.intro}>
        <View style={s.tile}>
          <Icon name="clipboard" size={26} color={colors.primary} strokeWidth={2.4} />
        </View>
        <Text variant="body" color="ink2" style={s.introText}>
          {t.import.intro}
        </Text>
      </Entrance>

      <Entrance index={1}>
        <View style={s.labelRow}>
          <Text variant="smallStrong" color="ink2" style={s.label}>
            {t.import.field}
          </Text>
          {clipboard && (
            <Button label={t.import.paste} icon="clipboard" variant="secondary" size="sm" inline onPress={paste} testID="import-paste" />
          )}
        </View>
        <TextField
          accessibilityLabel={t.import.field}
          value={text}
          onChangeText={(v) => {
            setText(v);
            setFailure(null);
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
        {!error && !!preview && (
          <View style={s.preview} testID="import-preview">
            <Icon name="check" size={16} color={colors.primaryInk} strokeWidth={3} />
            <Text variant="smallStrong" color="primaryInk" style={s.previewText}>
              {preview}
            </Text>
          </View>
        )}
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
  preview: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: space.s, marginHorizontal: 4 },
  previewText: { flex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', minHeight: 44, marginBottom: space.s },
  label: { marginLeft: 4, marginBottom: 6 },
});
