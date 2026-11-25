/** My shared links (Profile → My shared links): each link can be copied, shared, opened or stopped. */
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { copyLink, shareLink } from '@/components/social/linkActions';
import { InfoStrip } from '@/components/social/ReceivedParts';
import { Card, EmptyState, Header, Icon, IconButton, Menu, Screen, Skeleton, Text, useConfirm, useToast, type MenuItem } from '@/components/ui';
import { cloudErrorText, type MyShare } from '@/lib/cloud';
import { useAuth } from '@/lib/cloud/auth';
import { useT } from '@/lib/i18n';
import { displayUrl, shareUrl } from '@/lib/social/links';
import { useShares } from '@/lib/social/shares';
import { useDances } from '@/lib/store';
import { colors, radius, space } from '@/lib/theme';

export default function SharedLinks() {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const { signedIn } = useAuth();
  const { shares, refresh, unpublish } = useShares();
  const { get } = useDances();
  const [error, setError] = useState<unknown>(null);
  const [menuFor, setMenuFor] = useState<MyShare | null>(null);
  const narrow = useWindowDimensions().width < 360;

  const load = useCallback(() => {
    setError(null);
    refresh().catch(setError);
  }, [refresh]);
  useEffect(() => {
    if (signedIn) load();
  }, [signedIn, load]);

  const stop = async (sh: MyShare) => {
    const ok = await confirm({
      title: (tr) => tr.shareLink.stopTitle(sh.name),
      message: (tr) => tr.shareLink.stopMessage,
      confirmLabel: (tr) => tr.shareLink.stop,
      destructive: true,
      icon: 'link',
    });
    if (!ok) return;
    try {
      await unpublish(sh.id);
      toast.show({ message: (tr) => tr.shareLink.stopped, icon: 'check' });
    } catch (e) {
      toast.show({ message: (tr) => cloudErrorText(e, tr), icon: 'alert' });
    }
  };
  const items: MenuItem[] = menuFor
    ? [
        ...(get(menuFor.danceId) ? [{ key: 'open', label: t.shareLink.openDance, icon: 'footprints' as const, onPress: () => router.push(`/dance/${menuFor.danceId}`) }] : []),
        { key: 'share', label: t.share.shareLink, icon: 'share', onPress: () => void shareLink(t.share.linkMessage(menuFor.name, shareUrl(menuFor.id)), shareUrl(menuFor.id), toast.show) },
        { key: 'stop', label: t.shareLink.stop, icon: 'close', destructive: true, onPress: () => void stop(menuFor) },
      ]
    : [];

  return (
    <Screen header={<Header title={t.shareLink.myLinks} />} testID="shared-links">
      <Text variant="small" color="ink2" style={s.intro}>
        {t.shareLink.myLinksBody}
      </Text>
      {!!error && (
        <View style={s.mt}>
          <InfoStrip muted icon="cloud-off" title={cloudErrorText(error, t)} testID="links-error" />
        </View>
      )}
      {shares === null ? (
        error ? null : (
          <View style={s.list}>
            <Skeleton height={76} radius={radius.card} />
            <Skeleton height={76} radius={radius.card} />
          </View>
        )
      ) : shares.length === 0 ? (
        <EmptyState
          style={s.mt}
          art={
            <View style={s.emptyTile}>
              <Icon name="link" size={30} color={colors.primaryInk} />
            </View>
          }
          title={t.shareLink.myLinksEmptyTitle}
          body={t.shareLink.myLinksEmptyBody}
        />
      ) : (
        <View style={s.list} testID="links-list">
          {shares.map((sh) => (
            <Card key={sh.id} padding={space.m} contentStyle={s.row} testID={`link-${sh.id}`}>
              {!narrow && (
                <View style={s.tile}>
                  <Icon name="link" size={22} color={colors.primaryInk} />
                </View>
              )}
              <View style={s.text}>
                <Text variant="label" numberOfLines={2}>
                  {sh.name}
                </Text>
                <Text variant="caption" color="ink2" numberOfLines={1} ellipsizeMode="middle">
                  {displayUrl(shareUrl(sh.id))}
                </Text>
                <Text variant="caption" color="ink3" numberOfLines={2}>
                  {t.shareLink.listUpdated(t.time.ago(Date.parse(sh.updatedAt)))}
                </Text>
              </View>
              <IconButton icon="copy" label={t.share.copyLink} variant="ghost" onPress={() => void copyLink(shareUrl(sh.id), toast.show)} testID={`link-copy-${sh.id}`} />
              <IconButton icon="more" label={t.shareLink.linkActions(sh.name)} variant="ghost" onPress={() => setMenuFor(sh)} testID={`link-more-${sh.id}`} />
            </Card>
          ))}
        </View>
      )}
      <Menu visible={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.name} items={items} />
    </Screen>
  );
}

const s = StyleSheet.create({
  intro: { marginTop: space.xs },
  mt: { marginTop: space.l },
  list: { gap: space.m, marginTop: space.l },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  tile: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center', marginRight: space.xxs },
  text: { flex: 1, minWidth: 0, gap: 1 },
  emptyTile: { width: 60, height: 60, borderRadius: 20, backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
});
