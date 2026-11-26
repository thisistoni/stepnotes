/**
 * Scan a QR code (`/scan`): the camera with a frame to aim with. A class code or link opens the
 * class, a shared-dance link opens the dance; anything else gets a short "not a Waltzy code".
 * Before the first scan the page explains why the camera is needed and asks for it; if it was
 * refused, it points to Settings. The camera only runs while this page is in front.
 */
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { Linking, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, goBackOrHome, hapticNotify, Header, IconButton, Screen, Text, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { parseScanned } from '@/lib/social/links';
import { colors, radius, space, withAlpha } from '@/lib/theme';

/** The same wrong code is not reported again for this long (the camera reads it many times a second). */
const SAME_CODE_MS = 3000;

export default function ScanRoute() {
  const t = useT();
  const [permission, requestPermission] = useCameraPermissions();

  // still reading the permission: nothing to show yet
  if (!permission) return <View style={s.dark} testID="scan-loading" />;
  if (!permission.granted) {
    const canAsk = permission.canAskAgain;
    return (
      <Screen header={<Header leading="close" title={t.scan.title} />} contentStyle={s.ask} testID="scan-permission">
        <EmptyState
          title={t.scan.allowTitle}
          body={canAsk ? t.scan.allowBody : t.scan.deniedBody}
          action={
            canAsk
              ? { label: t.scan.allow, icon: 'qr', onPress: () => void requestPermission(), testID: 'scan-allow' }
              : { label: t.scan.openSettings, onPress: () => void Linking.openSettings().catch(() => {}), testID: 'scan-settings' }
          }
        />
        <Button label={t.scan.typeInstead} variant="ghost" onPress={goBackOrHome} style={s.typeInstead} testID="scan-type" />
      </Screen>
    );
  }
  return <Scanner />;
}

function Scanner() {
  const t = useT();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const focused = useIsFocused();
  const [torch, setTorch] = useState(false);
  const done = useRef(false);
  const lastWrong = useRef({ data: '', at: 0 });
  const frame = Math.round(Math.min(width - space.gutter * 4, height * 0.42, 320));

  const onScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      if (done.current) return;
      const route = parseScanned(data);
      if (route) {
        done.current = true;
        hapticNotify('success');
        router.replace(route);
        return;
      }
      const now = Date.now();
      if (lastWrong.current.data === data && now - lastWrong.current.at < SAME_CODE_MS) return;
      lastWrong.current = { data, at: now };
      hapticNotify('warning');
      toast.show({ message: (tr) => tr.scan.notOurs, icon: 'alert' });
    },
    [toast],
  );

  return (
    <View style={s.dark} testID="scan">
      <StatusBar style="light" />
      {focused && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={onScanned}
        />
      )}
      <View style={[s.top, { paddingTop: insets.top + space.s }]}>
        <IconButton icon="close" label={t.common.close} shape="round" onPress={goBackOrHome} testID="scan-close" />
        <Text variant="heading" color="onColor" accessibilityRole="header" style={s.title}>
          {t.scan.title}
        </Text>
        <IconButton
          icon="bolt"
          label={torch ? t.scan.lightOff : t.scan.lightOn}
          shape="round"
          variant={torch ? 'primary' : 'card'}
          onPress={() => setTorch((v) => !v)}
          testID="scan-light"
        />
      </View>
      <View style={s.middle} pointerEvents="none">
        <View style={[s.frame, { width: frame, height: frame }]} />
        <Text variant="bodyStrong" color="onColor" align="center" style={s.hint}>
          {t.scan.hint}
        </Text>
      </View>
      <View style={[s.bottom, { paddingBottom: insets.bottom + space.l }]}>
        <Button label={t.scan.typeInstead} variant="secondary" onPress={goBackOrHome} testID="scan-type" />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  dark: { flex: 1, backgroundColor: colors.ink },
  ask: { paddingTop: space.xl },
  typeInstead: { marginTop: space.m },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.m, paddingHorizontal: space.gutter, paddingBottom: space.m, backgroundColor: withAlpha(colors.ink, 0.45) },
  title: { flex: 1 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.l, paddingHorizontal: space.gutter },
  frame: { borderRadius: radius.xl, borderWidth: 4, borderColor: colors.onColor },
  hint: { maxWidth: 320, textShadowColor: withAlpha(colors.ink, 0.6), textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  bottom: { paddingHorizontal: space.gutter, paddingTop: space.m },
});
