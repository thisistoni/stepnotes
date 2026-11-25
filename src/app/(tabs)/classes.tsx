/**
 * Classes tab: "My classes" (classes I teach and classes I joined), "Join a class" (code or
 * link) and "Create a class" (needs an account). Works offline from the cached list; refreshed
 * on focus and by pull-to-refresh.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { ClassCard } from '@/components/social/ClassCard';
import { ClassFormSheet, JoinClassSheet } from '@/components/social/ClassSheets';
import { InfoStrip } from '@/components/social/ReceivedParts';
import { Button, Card, Entrance, FootSticker, Header, Icon, IconButton, PressableLip, Screen, Skeleton, Text, useToast } from '@/components/ui';
import { cloud, cloudErrorText } from '@/lib/cloud';
import { useRequireAccount } from '@/lib/cloud/auth';
import { useT } from '@/lib/i18n';
import { useClasses } from '@/lib/social/classes';
import { colors, lip, radius, ROLE_COLOR, space, STYLE_COLORS, type ColorSet } from '@/lib/theme';

export default function Classes() {
  const t = useT();
  const toast = useToast();
  const { ready, classes, status, error, syncedAt, refresh, remember } = useClasses();
  const requireAccount = useRequireAccount();
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pulling, setPulling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const onPull = async () => {
    setPulling(true);
    await refresh();
    setPulling(false);
  };
  const open = useCallback((code: string) => router.push(`/c/${code}`), []);
  const onCreate = () => {
    if (requireAccount()) setCreateOpen(true);
  };
  const create = async (name: string, description: string) => {
    const cls = await cloud.createClass(name, description);
    await remember(cls).catch(() => {});
    toast.show({ message: (tr) => tr.classes.created, icon: 'check' });
    router.push(`/c/${cls.code}`);
  };

  const firstLoad = !ready || (status === 'loading' && syncedAt === null && classes.length === 0);
  return (
    <Screen
      padded={false}
      testID="classes"
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <Header
        large
        eyebrow="Waltzy"
        title={t.classes.title}
        right={<IconButton icon="refresh" label={t.classes.refreshing} onPress={onPull} testID="classes-refresh" />}
      />
      <View style={s.px}>
        <Entrance index={0} style={s.actions}>
          <ActionTile icon="people" label={t.classes.join} hint={t.classes.joinHint} tone={ROLE_COLOR.follower} onPress={() => setJoinOpen(true)} testID="classes-join" />
          <ActionTile icon="cap" label={t.classes.create} hint={t.classes.createHint} tone={ROLE_COLOR.leader} onPress={onCreate} testID="classes-create" />
        </Entrance>

        {status === 'error' && !!error && (
          <Entrance index={1} style={s.mt}>
            <InfoStrip
              muted
              icon="cloud-off"
              title={syncedAt && error.reason === 'offline' ? t.classes.offlineTitle : t.classes.loadFailed}
              body={error.reason === 'offline' && syncedAt ? t.classes.offlineBody : cloudErrorText(error, t)}
              action={<Button label={t.cloud.retry} variant="secondary" size="sm" inline onPress={onPull} testID="classes-retry" />}
              testID="classes-offline"
            />
          </Entrance>
        )}

        {firstLoad ? (
          <View style={s.list} testID="classes-loading">
            <Skeleton height={86} radius={radius.card} />
            <Skeleton height={86} radius={radius.card} />
          </View>
        ) : classes.length ? (
          <Entrance index={2}>
            <Text variant="overline" color="ink2" style={s.overline} accessibilityRole="header">
              {t.classes.mine}
            </Text>
            <View style={s.list} testID="classes-list">
              {classes.map((c) => (
                <ClassCard key={c.code} cls={c} onOpen={open} />
              ))}
            </View>
          </Entrance>
        ) : (
          <Entrance index={2}>
            <ClassesEmpty />
          </Entrance>
        )}
      </View>
      <JoinClassSheet visible={joinOpen} onClose={() => setJoinOpen(false)} />
      <ClassFormSheet visible={createOpen} onClose={() => setCreateOpen(false)} onSubmit={create} />
    </Screen>
  );
}

/** A square-ish action card: tinted icon tile on top, label under it (two lines allowed). */
function ActionTile({ icon, label, hint, tone, onPress, testID }: { icon: 'people' | 'cap'; label: string; hint: string; tone: ColorSet; onPress: () => void; testID: string }) {
  return (
    <PressableLip onPress={onPress} radius={radius.card} lipDepth={lip.lg} accessibilityLabel={`${label}. ${hint}`} testID={testID} style={s.tile} faceStyle={s.tileFace}>
      <View style={[s.tileIcon, { backgroundColor: tone.tint }]}>
        <Icon name={icon} size={26} color={tone.deep} />
      </View>
      <Text variant="label" numberOfLines={2} style={s.tileLabel}>
        {label}
      </Text>
      <Text variant="caption" color="ink2" numberOfLines={2} style={s.tileHint}>
        {hint}
      </Text>
    </PressableLip>
  );
}

/** What a class is, for teachers and for students. */
function ClassesEmpty() {
  const t = useT();
  return (
    <Card padding={space.xl} style={s.mtl} testID="classes-empty">
      <View style={s.art}>
        <FootSticker tone={ROLE_COLOR.leader} size={36} rotate={-10} />
        <FootSticker tone={ROLE_COLOR.follower} foot="R" size={36} rotate={10} style={s.up} />
        <FootSticker tone={STYLE_COLORS.latin} size={36} rotate={-6} />
        <FootSticker tone={STYLE_COLORS.bachata} foot="R" size={36} rotate={6} style={s.up} />
      </View>
      <Text variant="cardTitle" align="center">
        {t.classes.emptyTitle}
      </Text>
      <View style={s.who}>
        <Who icon="cap" tone={ROLE_COLOR.leader} title={t.classes.emptyTeacherTitle} body={t.classes.emptyTeacherBody} />
        <Who icon="people" tone={ROLE_COLOR.follower} title={t.classes.emptyStudentTitle} body={t.classes.emptyStudentBody} />
      </View>
    </Card>
  );
}

function Who({ icon, tone, title, body }: { icon: 'cap' | 'people'; tone: ColorSet; title: string; body: string }) {
  return (
    <View style={s.whoRow}>
      <View style={[s.whoTile, { backgroundColor: tone.tint }]}>
        <Icon name={icon} size={20} color={tone.deep} />
      </View>
      <View style={s.whoText}>
        <Text variant="label">{title}</Text>
        <Text variant="small" color="ink2" style={s.whoBody}>
          {body}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  px: { paddingHorizontal: space.gutter },
  actions: { flexDirection: 'row', gap: space.m, marginTop: space.l },
  tile: { flex: 1 },
  tileFace: { padding: space.m, minHeight: 124 },
  tileIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { marginTop: space.m },
  tileHint: { marginTop: 2 },
  mt: { marginTop: space.l },
  mtl: { marginTop: space.xl },
  overline: { marginTop: space.xl, marginBottom: space.s, marginLeft: space.xs },
  list: { gap: space.m, marginTop: space.s },
  art: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6, marginBottom: space.m },
  up: { marginBottom: 12 },
  who: { gap: space.l, marginTop: space.l },
  whoRow: { flexDirection: 'row', gap: space.m, alignItems: 'flex-start' },
  whoTile: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  whoText: { flex: 1 },
  whoBody: { marginTop: 2 },
});
