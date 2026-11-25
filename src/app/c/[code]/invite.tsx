/**
 * Invite students (`/c/<code>/invite`): the class link, the code in large letters, a big QR code
 * and the system share sheet. Laid out to be shown on a projector or held up on a phone in class:
 * the QR code takes as much of the screen as fits.
 */
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QrCode } from '@/components/QrCode';
import { shareLink } from '@/components/social/linkActions';
import { LinkBox } from '@/components/social/LinkBox';
import { Button, Header, Screen, Text, useToast } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useClasses } from '@/lib/social/classes';
import { classUrl, normalizeCode } from '@/lib/social/links';
import { colors, layout, radius, space } from '@/lib/theme';

/** "ab12cd34" → "AB12 CD34" (easier to read out and to type). */
const spaced = (code: string) => code.toUpperCase().replace(/(.{4})(?=.)/g, '$1 ');

export default function InviteRoute() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = normalizeCode(raw ?? '');
  const t = useT();
  const toast = useToast();
  const { classes, cachedDetail } = useClasses();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const name = classes.find((c) => c.code === code)?.name ?? cachedDetail(code)?.detail.name ?? '';
  const url = classUrl(code);
  // the QR code fills the column, but leaves room for the code and the buttons on a phone
  const column = Math.min(width, layout.maxWidth) - space.gutter * 2;
  const qr = Math.max(200, Math.min(column - 32, height - insets.top - insets.bottom - 420, 420));

  return (
    <Screen header={<Header title={t.classes.inviteTitle} subtitle={name || undefined} />} testID="invite">
      <View style={s.qrCard}>
        <QrCode value={url} size={qr} accessibilityLabel={t.shareLink.qrA11y(url)} testID="invite-qr" />
        <Text variant="smallStrong" color="ink2" align="center">
          {t.classes.inviteScan}
        </Text>
      </View>
      <Text variant="small" color="ink2" align="center" style={s.or}>
        {t.classes.inviteOr}
      </Text>
      <Text
        variant="display"
        align="center"
        selectable
        accessibilityLabel={t.classes.codeA11y(code)}
        style={s.code}
        maxFontSizeMultiplier={1.2}
        testID="invite-code"
      >
        {spaced(code)}
      </Text>
      <View style={s.actions}>
        <Button label={t.share.shareLink} icon="share" onPress={() => void shareLink(t.share.classMessage(name || code, url), url, toast.show)} testID="invite-share" />
        <LinkBox url={url} testID="invite-link" />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  qrCard: {
    alignItems: 'center',
    gap: space.s,
    paddingVertical: space.l,
    marginTop: space.s,
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  or: { marginTop: space.l },
  code: { marginTop: space.xs, letterSpacing: 3 },
  actions: { gap: space.m, marginTop: space.l },
});
