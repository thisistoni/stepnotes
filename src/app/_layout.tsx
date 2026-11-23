// Per-weight entry points: importing the package index would bundle every weight (21 files).
import { Fredoka_500Medium } from '@expo-google-fonts/fredoka/500Medium';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { Fredoka_700Bold } from '@expo-google-fonts/fredoka/700Bold';
import { Nunito_600SemiBold } from '@expo-google-fonts/nunito/600SemiBold';
import { Nunito_700Bold } from '@expo-google-fonts/nunito/700Bold';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito/800ExtraBold';
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black';
import { useFonts } from 'expo-font';
import { Stack, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorScreen } from '@/components/ErrorScreen';
import { ConfirmHost, ToastHost } from '@/components/ui';
import { I18nProvider } from '@/lib/i18n';
import { PrefsProvider, usePrefs } from '@/lib/prefs';
import { DanceProvider, useDances } from '@/lib/store';
import { colors } from '@/lib/theme';

// Keep the native splash screen up until stored dances, prefs and fonts are loaded (no-op on web).
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Fonts: each weight is its own family (names in `fonts` in '@/lib/theme'); the <Text> kit
 * component picks them, nobody sets fontFamily by hand.
 */
const FONTS = {
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
};

/** Never keep the splash screen longer than this, even if storage hangs. */
const SPLASH_TIMEOUT_MS = 3000;

/** Rendered instead of the whole app if the root layout itself throws. */
export { ErrorScreen as ErrorBoundary };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONTS);
  return (
    <GestureHandlerRootView style={s.root}>
      <PrefsProvider>
        {/* the language comes from prefs, which are loaded before anything renders (no flash) */}
        <I18nProvider>
          <DanceProvider>
            <ToastHost>
              <ConfirmHost>
                <StatusBar style="dark" />
                <AppStack fontsReady={fontsLoaded || !!fontError} />
              </ConfirmHost>
            </ToastHost>
          </DanceProvider>
        </I18nProvider>
      </PrefsProvider>
    </GestureHandlerRootView>
  );
}

function AppStack({ fontsReady }: { fontsReady: boolean }) {
  const { ready: prefsReady, prefs } = usePrefs();
  const pathname = usePathname();
  // If storage (or font loading) hangs, do not stay blank forever: after the splash timeout, show
  // the app with what we have (default prefs, system font).
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), SPLASH_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);
  const ready = (fontsReady && prefsReady) || timedOut;
  const gated = ready && !prefs.onboardingDone && pathname !== '/intro';
  // Stack.Protected sends blocked routes to the first available screen; make the target explicit
  // so a future unprotected route can never become the landing page.
  useEffect(() => {
    if (gated) router.replace('/intro');
  }, [gated]);
  return (
    <SplashGate fontsReady={fontsReady}>
      {/* Nothing renders until fonts + prefs are known: no fallback-font flash, no intro flash. */}
      {ready ? (
        <Stack
          unstable_screenErrorBoundary={ErrorScreen}
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
        >
          {/* First-run intro, and the "How to read the footprints" lesson (`/intro?lesson=1`). */}
          <Stack.Screen name="intro" options={{ animation: 'fade' }} />
          {/* Until the intro is done every other route redirects to it. */}
          <Stack.Protected guard={prefs.onboardingDone}>
            <Stack.Screen name="index" />
            <Stack.Screen name="dance/[id]" />
            <Stack.Screen name="edit/[id]" />
            <Stack.Screen name="import" options={{ presentation: 'modal' }} />
          </Stack.Protected>
        </Stack>
      ) : (
        <View style={s.root} />
      )}
    </SplashGate>
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
