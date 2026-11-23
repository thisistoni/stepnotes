import { router, type ErrorBoundaryProps } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useOptionalT } from '@/lib/i18n';
import { colors, space } from '@/lib/theme';

import { Icon } from './Icon';
import { Button, Text } from './ui';

/**
 * Shown instead of a white page when a screen throws while rendering. Used both as the root
 * layout's `ErrorBoundary` export and as the Stack's screen error boundary.
 * Must not depend on app providers (it can render outside them) — only stateless kit parts.
 */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  // may render outside the providers: then the last known language
  const t = useOptionalT();
  return (
    <View style={s.wrap}>
      <View style={s.column}>
        <View style={s.tile}>
          <Icon name="alert" size={30} color={colors.danger} />
        </View>
        <Text variant="title" align="center">
          {t.errorScreen.title}
        </Text>
        <Text variant="body" color="ink2" align="center">
          {t.errorScreen.body}
        </Text>
        {__DEV__ && (
          <Text variant="caption" color="dangerInk" align="center">
            {error.message}
          </Text>
        )}
        <View style={s.actions}>
          <Button label={t.errorScreen.retry} onPress={() => void retry()} />
          <Button
            label={t.errorScreen.home}
            variant="secondary"
            onPress={() => {
              void retry();
              router.replace('/');
            }}
          />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: colors.bg },
  column: { width: '100%', maxWidth: 400, alignItems: 'stretch', gap: space.s },
  tile: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: colors.dangerTint,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: space.s,
  },
  actions: { gap: space.m, marginTop: space.l },
});
