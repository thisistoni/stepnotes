import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DanceProvider } from '@/lib/store';
import { colors } from '@/lib/theme';

export default function RootLayout() {
  return (
    <DanceProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'StepNotes' }} />
        <Stack.Screen name="dance/[id]" options={{ title: '' }} />
        <Stack.Screen name="edit/[id]" options={{ title: 'Edit dance' }} />
        <Stack.Screen name="import" options={{ title: 'Import dance', presentation: 'modal' }} />
      </Stack>
    </DanceProvider>
  );
}
