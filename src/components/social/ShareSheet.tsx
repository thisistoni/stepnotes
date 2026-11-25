import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { shareDance } from '@/components/player/shareDance';
import { QrCode } from '@/components/QrCode';
import { Button, Icon, Sheet, Skeleton, Text, useConfirm, useToast } from '@/components/ui';
import { cloudErrorText } from '@/lib/cloud';
import { useAuth, useRequireAccount } from '@/lib/cloud/auth';
import { useT } from '@/lib/i18n';
import { shareUrl } from '@/lib/social/links';
import { useShares } from '@/lib/social/shares';
import { colors, radius, space, TONE } from '@/lib/theme';
import type { Dance } from '@/lib/types';

import { shareLink } from './linkActions';
import { LinkBox } from './LinkBox';

export interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  /** one of the user's own dances (never a starter) */
  dance: Dance;
  /** Called before the sheet navigates away (sign-in): pause the player */
  onBeforeLeave?: () => void;
}

/**
 * Share one of my dances. Signed in with a name: create the link, then show it with a QR code,
 * copy, the system share sheet, "Update link" when the dance changed since, and "Stop sharing".
 * Signed out: why a link needs an account and a sign-in button (the sheet opens again after
 * signing in). "Share as text instead" works in every state, offline and without an account.
 */
export function ShareSheet({ visible, onClose, dance, onBeforeLeave }: ShareSheetProps) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const { signedIn, profile } = useAuth();
  const requireAccount = useRequireAccount();
  const { shares, forDance, refresh, publish, unpublish, isOutdated } = useShares();
  const { height } = useWindowDimensions();
  const [busy, setBusy] = useState<'create' | 'update' | null>(null);
  const [checkError, setCheckError] = useState<unknown>(null);
  const [reopen, setReopen] = useState(false);
  /** runs once the sheet is gone (confirm dialogs, navigation, the text share) */
  const after = useRef<(() => void) | null>(null);
  const account = signedIn && !!profile?.displayName;
  const share = forDance(dance.id);
  const name = dance.name.trim() || t.common.untitled;

  // back from signing in: open again
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (reopen && account) {
      setReopen(false);
      setOpen(true);
    }
  }, [reopen, account]);
  const shown = visible || open;

  // fetch the current list each time the sheet opens (the cached one shows meanwhile)
  useEffect(() => {
    if (!shown || !account) return;
    let alive = true;
    refresh()
      .then(() => alive && setCheckError(null))
      .catch((e) => alive && setCheckError(e));
    return () => {
      alive = false;
    };
  }, [shown, account, refresh]);
  const close = () => {
    setOpen(false);
    onClose();
  };
  const closeThen = (fn: () => void) => {
    after.current = fn;
    close();
  };

  const create = async (kind: 'create' | 'update') => {
    setBusy(kind);
    try {
      await publish(dance);
      if (kind === 'update') toast.show({ message: (tr) => tr.shareLink.updated, icon: 'check' });
    } catch (e) {
      toast.show({ message: (tr) => cloudErrorText(e, tr), icon: 'alert' });
    } finally {
      setBusy(null);
    }
  };
  const signIn = () =>
    closeThen(() => {
      onBeforeLeave?.();
      if (!requireAccount()) setReopen(true);
    });
  const asText = () => closeThen(() => void shareDance(dance, t, toast.show));
  const stop = (id: string) =>
    closeThen(async () => {
      const ok = await confirm({
        title: (tr) => tr.shareLink.stopTitle(name),
        message: (tr) => tr.shareLink.stopMessage,
        confirmLabel: (tr) => tr.shareLink.stop,
        destructive: true,
        icon: 'link',
      });
      if (!ok) return;
      try {
        await unpublish(id);
        toast.show({ message: (tr) => tr.shareLink.stopped, icon: 'check' });
      } catch (e) {
        toast.show({ message: (tr) => cloudErrorText(e, tr), icon: 'alert' });
      }
    });

  const textButton = (
    <Button label={t.shareLink.asText} icon="document" variant="ghost" size="md" onPress={asText} accessibilityHint={t.shareLink.asTextHint} testID="share-as-text" />
  );

  let body;
  if (!account) {
    body = (
      <View style={s.center} testID="share-signed-out">
        <View style={s.tile}>
          <Icon name="link" size={30} color={colors.primaryInk} />
        </View>
        <Text variant="cardTitle" align="center" style={s.mt}>
          {t.shareLink.signInTitle}
        </Text>
        <Text variant="small" color="ink2" align="center" style={s.mtxs}>
          {t.shareLink.signInBody}
        </Text>
        <Button label={t.shareLink.signIn} icon="mail" onPress={signIn} style={s.mtl} testID="share-sign-in" />
        {textButton}
      </View>
    );
  } else if (share) {
    const url = shareUrl(share.id);
    const outdated = isOutdated(dance, share);
    const qrSize = height < 700 ? 200 : 232;
    body = (
      <View style={s.gap} testID="share-ready">
        <View style={s.qrFrame}>
          <QrCode value={url} size={qrSize} accessibilityLabel={t.shareLink.qrA11y(url)} testID="share-qr" />
          <Text variant="caption" color="ink2" align="center">
            {t.shareLink.qrHint}
          </Text>
        </View>
        <LinkBox url={url} testID="share-link" />
        <Button label={t.share.shareLink} icon="share" onPress={() => void shareLink(t.share.linkMessage(name, url), url, toast.show)} testID="share-system" />
        {outdated ? (
          <View style={s.notice} testID="share-outdated">
            <Text variant="small" color={TONE.primary.deep}>
              {t.shareLink.outdated}
            </Text>
            <Text variant="caption" color="ink2" style={s.mtxs}>
              {t.shareLink.updatedAt(t.time.ago(Date.parse(share.updatedAt)))}
            </Text>
            <Button label={t.shareLink.update} icon="refresh" variant="primary" size="md" loading={busy === 'update'} onPress={() => create('update')} style={s.mtm} testID="share-update" />
          </View>
        ) : (
          <Text variant="caption" color="ink2" align="center" testID="share-updated-at">
            {t.shareLink.updatedAt(t.time.ago(Date.parse(share.updatedAt)))}
          </Text>
        )}
        <View>
          {textButton}
          <Button label={t.shareLink.stop} icon="close" variant="ghost" size="md" onPress={() => stop(share.id)} testID="share-stop" />
        </View>
      </View>
    );
  } else if (shares === null && !checkError) {
    body = (
      <View style={s.gap} testID="share-loading" accessibilityLabel={t.shareLink.loading}>
        <Skeleton height={200} radius={radius.lg} />
        <Skeleton height={48} radius={radius.md} />
      </View>
    );
  } else {
    body = (
      <View style={s.gap} testID="share-create-step">
        <Text variant="body" color="ink2">
          {t.shareLink.intro}
        </Text>
        {shares === null && !!checkError && (
          <Text variant="small" color="dangerInk" testID="share-check-error">
            {`${t.shareLink.checkFailed} ${cloudErrorText(checkError, t)}`}
          </Text>
        )}
        <Button label={t.shareLink.create} icon="link" loading={busy === 'create'} onPress={() => create('create')} testID="share-create" />
        {textButton}
      </View>
    );
  }

  return (
    <Sheet
      visible={shown}
      onClose={close}
      onClosed={() => {
        const run = after.current;
        after.current = null;
        run?.();
      }}
      title={t.shareLink.title}
      testID="share-sheet"
    >
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {body}
      </ScrollView>
    </Sheet>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { paddingTop: space.s, paddingBottom: space.xs },
  gap: { gap: space.m },
  center: { alignItems: 'stretch' },
  tile: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  qrFrame: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.m,
    paddingHorizontal: space.m,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
  },
  notice: { padding: space.l, borderRadius: radius.md, backgroundColor: colors.primaryTint },
  mt: { marginTop: space.l },
  mtxs: { marginTop: space.xxs },
  mtm: { marginTop: space.m },
  mtl: { marginTop: space.l },
});
