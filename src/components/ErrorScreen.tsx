import { router, type ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';

import { Icon } from './Icon';
import { Button } from './ui';

/**
 * Shown instead of a white page when a screen throws while rendering. Used both as the root
 * layout's `ErrorBoundary` export and as the Stack's screen error boundary.
 * Must not depend on app providers (it can render outside them).
 */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={s.wrap}>
      <Icon ios="exclamationmark.triangle" material="warning" size={40} color={colors.muted} />
      <Text style={s.title}>Something went wrong</Text>
      <Text style={s.body}>This screen could not be shown. Your dances are safe.</Text>
      {__DEV__ && <Text style={s.detail}>{error.message}</Text>}
      <View style={s.actions}>
        <Button label="Try again" variant="primary" onPress={() => void retry()} />
        <Button
          label="Go to library"
          onPress={() => {
            void retry();
            router.replace('/');
          }}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10, backgroundColor: colors.bg },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 6 },
  body: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  detail: { fontSize: 12, color: colors.danger, textAlign: 'center', fontFamily: 'monospace' },
  actions: { gap: 10, marginTop: 12, alignSelf: 'stretch' },
});
