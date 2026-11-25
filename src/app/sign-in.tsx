import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View, type TextStyle } from 'react-native';

import { Button, goBackOrHome, Header, Icon, Screen, Text, TextField, useToast } from '@/components/ui';
import { cloudErrorText, CloudError } from '@/lib/cloud';
import { NAME_MAX, useAuth } from '@/lib/cloud/auth';
import { useT } from '@/lib/i18n';
import { colors, fonts, layout, lip, radius, space } from '@/lib/theme';

const CODE_LENGTH = 6;
const RESEND_AFTER_S = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const WEB_NO_OUTLINE = Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as TextStyle) : null;

type Step = 'email' | 'code' | 'name';

/**
 * Sign in (modal): e-mail → 6-digit code → display name (when the account has none) → back to
 * where the user came from. No passwords. Opened by the Me tab and by `useRequireAccount()`.
 */
export default function SignIn() {
  const t = useT();
  const toast = useToast();
  const { signedIn, profile, sendCode, verifyCode, saveProfile } = useAuth();
  const [step, setStep] = useState<Step>(signedIn ? 'name' : 'email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const codeRef = useRef<ComponentRef<typeof TextInput>>(null);
  const done = useRef(false);

  const finish = (displayName: string) => {
    if (done.current) return;
    done.current = true;
    toast.show({ message: (tr) => tr.account.welcome(displayName), icon: 'check' });
    goBackOrHome();
  };

  // opened while already signed in with a name (e.g. a stale requireAccount): nothing to do
  useEffect(() => {
    if (step === 'name' && profile?.displayName && !done.current) {
      done.current = true;
      goBackOrHome();
    }
  }, [step, profile]);

  // resend countdown
  const left = Math.max(0, RESEND_AFTER_S - Math.floor((now - sentAt) / 1000));
  useEffect(() => {
    if (step !== 'code') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [step]);

  const send = async (resend = false) => {
    const e = email.trim();
    if (!EMAIL.test(e)) return setError(t.account.badEmail);
    setBusy(true);
    setError(null);
    try {
      await sendCode(e);
      setSentAt(Date.now());
      setNow(Date.now());
      setCode('');
      setStep('code');
      if (resend) toast.show({ message: (tr) => tr.account.resent, icon: 'mail' });
      setTimeout(() => codeRef.current?.focus(), 350);
    } catch (err) {
      setError(cloudErrorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (value.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      const p = await verifyCode(email, value);
      if (p?.displayName) finish(p.displayName);
      else setStep('name');
    } catch (err) {
      setError(cloudErrorText(err, t));
      if (err instanceof CloudError && err.reason === 'invalidCode') {
        setCode('');
        codeRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  };

  const onCode = (text: string) => {
    // paste-friendly: keep the digits of whatever was typed or pasted ("Your code: 123 456")
    const digits = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    if (error) setError(null);
    if (digits.length === CODE_LENGTH) void verify(digits);
  };

  const saveName = async () => {
    const n = name.trim();
    if (!n) return setError(t.account.nameEmpty);
    setBusy(true);
    setError(null);
    try {
      const p = await saveProfile(n);
      finish(p.displayName);
    } catch (err) {
      setError(cloudErrorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  const footer =
    step === 'email' ? (
      <Button label={t.account.sendCode} onPress={() => void send()} loading={busy} iconRight="arrow-right" testID="send-code" />
    ) : step === 'name' ? (
      <Button label={t.account.continue} onPress={() => void saveName()} loading={busy} iconRight="arrow-right" testID="name-continue" />
    ) : undefined; // the code submits itself on the 6th digit

  return (
    <Screen
      header={<Header leading="close" title={t.account.signInTitle} onBack={goBackOrHome} />}
      footer={footer}
      testID="sign-in"
    >
      {step === 'email' && (
        <View style={s.step} testID="step-email">
          <StepArt icon="mail" />
          <Text variant="title" accessibilityRole="header">
            {t.account.emailTitle}
          </Text>
          <Text variant="body" color="ink2" style={s.lead}>
            {t.account.emailBody}
          </Text>
          <TextField
            label={t.account.emailLabel}
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError(null);
            }}
            placeholder={t.account.emailPlaceholder}
            inputMode="email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => void send()}
            autoFocus={Platform.OS === 'web'}
            error={error}
            icon="mail"
            style={s.field}
            testID="email-field"
          />
          <LegalLine />
        </View>
      )}

      {step === 'code' && (
        <View style={s.step} testID="step-code">
          <StepArt icon="mail" />
          <Text variant="title" accessibilityRole="header">
            {t.account.codeTitle}
          </Text>
          <Text variant="body" color="ink2" style={s.lead}>
            {t.account.codeBody(email.trim())}
          </Text>
          <Pressable style={s.codeWrap} onPress={() => codeRef.current?.focus()} accessible={false}>
            <View style={s.boxes} pointerEvents="none">
              {Array.from({ length: CODE_LENGTH }, (_, i) => {
                const filled = i < code.length;
                const current = i === code.length && !busy;
                return (
                  <View key={i} style={[s.box, filled && s.boxFilled, current && s.boxCurrent, !!error && s.boxError]}>
                    <Text variant="numeralSm" style={s.digit}>
                      {code[i] ?? ''}
                    </Text>
                  </View>
                );
              })}
            </View>
            <TextInput
              ref={codeRef}
              value={code}
              onChangeText={onCode}
              inputMode="numeric"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={CODE_LENGTH + 20 /* room for a pasted sentence; onCode keeps 6 digits */}
              autoFocus
              caretHidden
              editable={!busy}
              selectionColor="transparent"
              accessibilityLabel={t.account.codeLabel}
              style={[s.codeInput, WEB_NO_OUTLINE]}
              testID="code-field"
            />
          </Pressable>
          {busy ? (
            <ActivityIndicator color={colors.primary} style={s.hint} testID="code-busy" />
          ) : error ? (
            <View style={s.errorRow} accessibilityLiveRegion="polite">
              <Icon name="alert" size={16} color={colors.dangerInk} />
              <Text variant="small" color="dangerInk" style={s.flex} testID="code-error">
                {error}
              </Text>
            </View>
          ) : (
            <Text variant="caption" color="ink2" style={s.hint}>
              {t.account.codeHint}
            </Text>
          )}
          <View style={s.links}>
            {left > 0 ? (
              <Text variant="small" color="ink2" style={s.countdown} testID="resend-countdown">
                {t.account.resendIn(left)}
              </Text>
            ) : (
              <Button label={t.account.resend} variant="ghost" size="sm" inline onPress={() => void send(true)} disabled={busy} testID="resend" />
            )}
            <Button
              label={t.account.otherEmail}
              variant="ghost"
              size="sm"
              inline
              onPress={() => {
                setStep('email');
                setError(null);
                setCode('');
              }}
              testID="other-email"
            />
          </View>
        </View>
      )}

      {step === 'name' && (
        <View style={s.step} testID="step-name">
          <StepArt icon="person" />
          <Text variant="title" accessibilityRole="header">
            {t.account.nameTitle}
          </Text>
          <Text variant="body" color="ink2" style={s.lead}>
            {t.account.nameBody}
          </Text>
          <TextField
            label={t.account.nameLabel}
            value={name}
            onChangeText={(v) => {
              setName(v);
              setError(null);
            }}
            placeholder={t.account.namePlaceholder}
            maxLength={NAME_MAX}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="nickname"
            returnKeyType="done"
            onSubmitEditing={() => void saveName()}
            autoFocus
            error={error}
            style={s.field}
            testID="name-input"
          />
        </View>
      )}
    </Screen>
  );
}

function StepArt({ icon }: { icon: 'mail' | 'person' }) {
  return (
    <View style={s.art}>
      <Icon name={icon} size={30} color={colors.primaryInk} />
    </View>
  );
}

/** "By continuing you agree to the {terms} and the {privacy}." with the two links. */
function LegalLine() {
  const t = useT();
  const parts = t.account.legalLine.split(/(\{terms\}|\{privacy\})/);
  return (
    <Text variant="caption" color="ink2" style={s.legal}>
      {parts.map((p, i) =>
        p === '{terms}' ? (
          <Text key={i} variant="caption" color="primaryInk" style={s.link} onPress={() => router.push('/legal/terms')} accessibilityRole="link" testID="legal-terms-link">
            {t.account.legalTerms}
          </Text>
        ) : p === '{privacy}' ? (
          <Text key={i} variant="caption" color="primaryInk" style={s.link} onPress={() => router.push('/legal/privacy')} accessibilityRole="link" testID="legal-privacy-link">
            {t.account.legalPrivacy}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

const BOX = 48;
const s = StyleSheet.create({
  step: { paddingTop: space.l },
  flex: { flex: 1 },
  art: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginBottom: space.l },
  lead: { marginTop: space.s },
  field: { marginTop: space.xl },
  legal: { marginTop: space.xl },
  link: { textDecorationLine: 'underline' },
  codeWrap: { marginTop: space.xl, alignSelf: 'stretch' },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', gap: space.xs },
  box: {
    flex: 1,
    maxWidth: 56,
    height: BOX + 8,
    borderRadius: radius.md,
    borderWidth: 2,
    borderBottomWidth: lip.md,
    borderColor: colors.cardBorder,
    borderBottomColor: colors.cardLip,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: colors.primaryBorder, borderBottomColor: colors.primaryLight },
  boxCurrent: { borderColor: colors.primary, borderBottomColor: colors.primaryLip },
  boxError: { borderColor: colors.danger, borderBottomColor: colors.dangerLip },
  digit: { fontSize: 26, lineHeight: 30 },
  // the real input covers the boxes, invisible: taps, typing, paste and SMS / e-mail autofill all go to it
  codeInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    color: 'transparent',
    backgroundColor: 'transparent',
    fontFamily: fonts.body700,
    fontSize: 24,
    minHeight: layout.minTap,
  },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: space.m },
  hint: { marginTop: space.m },
  links: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.s, marginTop: space.l },
  countdown: { paddingVertical: 10 },
});
