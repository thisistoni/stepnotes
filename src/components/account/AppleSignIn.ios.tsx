import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { layout, radius } from '@/lib/theme';

import type { AppleSignInProps } from './AppleSignIn';

/** Apple's own button (their design rules do not allow restyling it). */
export function AppleSignIn({ onCredential, onError, disabled }: AppleSignInProps) {
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
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={radius.lg}
      style={s.button}
      onPress={() => void press()}
    />
  );
}

const s = StyleSheet.create({
  button: { alignSelf: 'stretch', height: Math.max(56, layout.minTap) },
});
