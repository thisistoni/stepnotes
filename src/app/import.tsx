import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import { Button } from '@/components/ui';
import { useDances } from '@/lib/store';
import { colors } from '@/lib/theme';
import { DanceValidationError } from '@/lib/validate';

export default function ImportScreen() {
  const { importJson } = useDances();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onImport = async () => {
    try {
      const d = await importJson(text);
      router.replace(`/dance/${d.id}`);
    } catch (e) {
      // validation errors are written for people; anything else (e.g. storage) gets a generic message
      setError(e instanceof DanceValidationError ? e.message : 'Could not save this dance. Please try again.');
    }
  };

  return (
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.p}>
        Paste a dance that someone shared with you (“Share as text” on a dance), then tap Import.
      </Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          setError(null);
        }}
        multiline
        placeholder='{"app": "stepnotes", …}'
        placeholderTextColor="#A8A29E"
        style={s.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error && <Text style={s.error}>{error}</Text>}
      <Button label="Import" variant="primary" onPress={onImport} disabled={!text.trim()} style={{ marginTop: 12 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16 },
  p: { fontSize: 15, color: colors.text, marginBottom: 12, lineHeight: 21 },
  input: {
    minHeight: 220,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    fontFamily: 'monospace',
    backgroundColor: colors.card,
    textAlignVertical: 'top',
    color: colors.text,
  },
  error: { color: colors.danger, marginTop: 8 },
});
