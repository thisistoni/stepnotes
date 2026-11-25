import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { colors, layout, radius, space } from '@/lib/theme';

import type { AppleSignInProps } from './AppleSignIn';

/** Apple's own button (their design rules do not allow restyling it), under an "or" divider. */
export function AppleSignIn({ onCredential, onError, disabled }: AppleSignInProps) {
  const t = useT();
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let alive = true;
    AppleAuthentication.isAvailableAsync()
      .then((ok) => alive && setAvailable(ok))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (!available) return null;

  const press = async () => {
    if (disabled) return;
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) return onError();
      onCredential(credential.identityToken, credential.fullName?.givenName?.trim() || null);
    } catch (e) {
      // closing Apple's sheet is not an error
      if ((e as { code?: string } | null)?.code !== 'ERR_REQUEST_CANCELED') onError();
    }
  };

  return (
    <View style={s.wrap} testID="apple-sign-in">
      <View style={s.divider}>
        <View style={s.line} />
        <Text variant="caption" color="ink2">
          {t.account.or}
        </Text>
        <View style={s.line} />
      </View>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={radius.md}
        style={s.button}
        onPress={() => void press()}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: space.xl },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.m, marginBottom: space.l },
  line: { flex: 1, height: 2, borderRadius: 1, backgroundColor: colors.cardBorder },
  button: { alignSelf: 'stretch', height: Math.max(52, layout.minTap) },
});
