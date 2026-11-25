import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BackupCard } from '@/components/account/BackupCard';
import { MeRow, MeSection } from '@/components/account/MeSection';
import { NameSheet } from '@/components/account/NameSheet';
import { LanguageSheet } from '@/components/library/LanguageSheet';
import { Button, Card, Entrance, Header, Icon, IconButton, Screen, Text, useConfirm, useToast } from '@/components/ui';
import { cloudErrorText } from '@/lib/cloud';
import { useAuth } from '@/lib/cloud/auth';
import { LANGUAGE_NAME, useI18n } from '@/lib/i18n';
import { useBlocked } from '@/lib/social/blocked';
import { useShares } from '@/lib/social/shares';
import { colors, space } from '@/lib/theme';

/**
 * Me tab. Signed out: a short pitch and "Sign in". Signed in: name, e-mail, backup status, sign out,
 * delete account. Always: language, the footprint lesson, terms, privacy, app version.
 * Add a row: put a `<MeRow>` into one of the `<MeSection>`s (see MeSection.tsx).
 */
export default function Me() {
  const { t, language } = useI18n();
  const { ready, signedIn, user, profile, signOut, deleteAccount } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [busy, setBusy] = useState<'signOut' | 'delete' | null>(null);
  const version = Constants.expoConfig?.version ?? '';
  const { shares, refresh: refreshShares } = useShares();
  const { blocked } = useBlocked();
  // the number of shared links next to "My shared links"
  useFocusEffect(
    useCallback(() => {
      if (signedIn) refreshShares().catch(() => {});
    }, [signedIn, refreshShares]),
  );

  const onSignOut = async () => {
    const ok = await confirm({ title: (tr) => tr.account.signOutTitle, message: (tr) => tr.account.signOutMessage, confirmLabel: (tr) => tr.account.signOut, icon: 'logout' });
    if (!ok) return;
    setBusy('signOut');
    try {
      await signOut();
      toast.show({ message: (tr) => tr.account.signedOut, icon: 'check' });
    } catch (e) {
      toast.show({ message: (tr) => cloudErrorText(e, tr), icon: 'alert' });
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: (tr) => tr.account.deleteTitle,
      message: (tr) => tr.account.deleteMessage,
      confirmLabel: (tr) => tr.account.deleteConfirm,
      destructive: true,
    });
    if (!ok) return;
    setBusy('delete');
    try {
      await deleteAccount();
      toast.show({ message: (tr) => tr.account.deleted, icon: 'check' });
    } catch (e) {
      toast.show({ message: (tr) => cloudErrorText(e, tr), icon: 'alert' });
    } finally {
      setBusy(null);
    }
  };

  const name = profile?.displayName ?? '';
  return (
    <Screen padded={false} testID="me">
      <Header large eyebrow="Waltzy" title={t.account.title} />
      <View style={s.px}>
        {!ready ? null : signedIn && user ? (
          <>
            <Entrance index={0}>
              <Card style={s.first} testID="me-account">
                <View style={s.person}>
                  <View style={s.avatar}>
                    {name ? (
                      <Text variant="heading" color="onColor">
                        {name.charAt(0).toUpperCase()}
                      </Text>
                    ) : (
                      <Icon name="person" size={26} color={colors.onColor} />
                    )}
                  </View>
                  <View style={s.personText}>
                    <Text variant="cardTitle" numberOfLines={1} color={name ? 'ink' : 'ink2'} testID="me-name">
                      {name || t.account.noName}
                    </Text>
                    <Text variant="small" color="ink2" numberOfLines={1} testID="me-email">
                      {user.email}
                    </Text>
                  </View>
                  <IconButton icon="pencil" label={t.account.editName} onPress={() => setNameOpen(true)} testID="me-edit-name" />
                </View>
              </Card>
            </Entrance>
            <Entrance index={1}>
              <Text variant="overline" color="ink2" style={s.overline} accessibilityRole="header">
                {t.account.sectionBackup}
              </Text>
              <BackupCard />
            </Entrance>
          </>
        ) : (
          <Entrance index={0}>
            <Card style={s.first} padding={space.xl} testID="me-pitch">
              <View style={s.pitchTile}>
                <Icon name="cloud" size={30} color={colors.primaryInk} />
              </View>
              <Text variant="heading" style={s.pitchTitle}>
                {t.account.pitchTitle}
              </Text>
              <Text variant="small" color="ink2" style={s.pitchBody}>
                {t.account.pitchBody}
              </Text>
              <Button label={t.account.signIn} icon="mail" onPress={() => router.push('/sign-in')} style={s.pitchButton} testID="me-sign-in" />
            </Card>
          </Entrance>
        )}

        <Entrance index={2}>
          <MeSection title={t.blocked.sectionTitle}>
            {ready && signedIn ? (
              <MeRow
                icon="link"
                label={t.shareLink.myLinks}
                value={shares ? String(shares.length) : undefined}
                onPress={() => router.push('/shared-links')}
                testID="me-links"
              />
            ) : null}
            <MeRow
              icon="block"
              label={t.blocked.listTitle}
              value={blocked.length ? String(blocked.length) : undefined}
              onPress={() => router.push('/blocked')}
              testID="me-blocked"
            />
          </MeSection>
        </Entrance>

        <Entrance index={2}>
          <MeSection title={t.account.sectionApp}>
            <MeRow icon="globe" label={t.account.language} value={LANGUAGE_NAME[language]} onPress={() => setLanguageOpen(true)} testID="language-button" />
            <MeRow icon="footprints" label={t.account.lesson} onPress={() => router.push('/intro?lesson=1')} testID="me-lesson" />
            <MeRow icon="document" label={t.account.terms} onPress={() => router.push('/legal/terms')} testID="me-terms" />
            <MeRow icon="shield" label={t.account.privacy} onPress={() => router.push('/legal/privacy')} testID="me-privacy" />
          </MeSection>
        </Entrance>

        {ready && signedIn && (
          <Entrance index={3}>
            <MeSection title={t.account.sectionAccount}>
              <MeRow icon="logout" label={t.account.signOut} onPress={busy ? undefined : onSignOut} testID="me-sign-out" />
              <MeRow icon="trash" label={t.account.deleteAccount} hint={t.account.deleteHint} danger onPress={busy ? undefined : onDelete} testID="me-delete" />
            </MeSection>
          </Entrance>
        )}

        {!!version && (
          <Text variant="caption" color="ink2" align="center" style={s.version} testID="me-version">
            {t.account.version(version)}
          </Text>
        )}
      </View>
      <LanguageSheet visible={languageOpen} onClose={() => setLanguageOpen(false)} />
      <NameSheet visible={nameOpen} onClose={() => setNameOpen(false)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  px: { paddingHorizontal: space.gutter },
  first: { marginTop: space.l },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  personText: { flex: 1, minWidth: 0 },
  overline: { marginTop: space.xl, marginBottom: space.s, marginLeft: space.xs },
  pitchTile: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  pitchTitle: { marginTop: space.l },
  pitchBody: { marginTop: space.xs },
  pitchButton: { marginTop: space.l },
  version: { marginTop: space.xl },
});
