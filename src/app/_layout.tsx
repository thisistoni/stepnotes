import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorScreen } from '@/components/ErrorScreen';
import { PrefsProvider, usePrefs } from '@/lib/prefs';
import { DanceProvider, useDances } from '@/lib/store';
import { colors } from '@/lib/theme';

// Keep the native splash screen up until stored dances, prefs and fonts are loaded (no-op on web).
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Fonts to load at startup: `{ FamilyName: require('../../assets/fonts/x.ttf') }`. None chosen yet. */
const FONTS = {};

/** Never keep the splash screen longer than this, even if storage hangs. */
const SPLASH_TIMEOUT_MS = 3000;

/** Rendered instead of the whole app if the root layout itself throws. */
export { ErrorScreen as ErrorBoundary };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PrefsProvider>
        <DanceProvider>
          <SplashGate fontsReady={fontsLoaded || !!fontError}>
            <StatusBar style="dark" />
            <Stack
              unstable_screenErrorBoundary={ErrorScreen}
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
          </SplashGate>
        </DanceProvider>
      </PrefsProvider>
    </GestureHandlerRootView>
  );
}

function SplashGate({ fontsReady, children }: { fontsReady: boolean; children: ReactNode }) {
  const { ready: dancesReady } = useDances();
  const { ready: prefsReady } = usePrefs();
  const ready = fontsReady && dancesReady && prefsReady;
  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hide(), ready ? 0 : SPLASH_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [ready]);
  return children;
}
