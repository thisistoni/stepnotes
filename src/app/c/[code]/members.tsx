/**
 * Who is in a class (`/c/<code>/members`), for the teacher: requests to join first (accept or
 * decline; only in a class with approval), then the members with the day they joined (remove).
 * Refreshed on focus and by pull-to-refresh. Anyone else is sent back to the class page.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { InfoStrip, ProblemPage } from '@/components/social/ReceivedParts';
import { Button, Card, EmptyState, Header, IconButton, Screen, Skeleton, Text, useConfirm, useToast } from '@/components/ui';
import { cloud, cloudErrorText, type ClassDetail, type ClassMember } from '@/lib/cloud';
import { useT } from '@/lib/i18n';
import { normalizeCode } from '@/lib/social/links';
import { useClassDetail } from '@/lib/social/useClassDetail';
import { colors, radius, ROLE_COLOR, space } from '@/lib/theme';

export default function MembersRoute() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = normalizeCode(raw ?? '');
  const t = useT();
  const { state, retry, reload } = useClassDetail(code);

  if (state.status === 'loading') return <MembersSkeleton label={t.classes.membersLoading} />;
  if (state.status === 'notFound' || (state.status === 'ready' && !state.detail.mine)) {
    return (
      <ProblemPage
        title={t.classes.notFoundTitle}
        body={t.classes.notFoundBody}
        action={{ label: t.classes.toClasses, icon: 'people', onPress: () => router.replace('/classes'), testID: 'to-classes' }}
        testID="members-not-found"
      />
    );
  }
  if (state.status === 'failed') {
    return (
      <ProblemPage
        offline
        title={t.classes.failedTitle}
        body={cloudErrorText(state.error, t)}
        action={{ label: t.cloud.retry, icon: 'refresh', onPress: retry, testID: 'retry' }}
        testID="members-failed"
      />
    );
  }
  return <MembersPage detail={state.detail} reloadClass={reload} />;
}

function MembersPage({ detail, reloadClass }: { detail: ClassDetail; reloadClass: () => Promise<void> }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const [members, setMembers] = useState<ClassMember[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [pulling, setPulling] = useState(false);
  /** the person an action is running for */
  const [busy, setBusy] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const n = ++seq.current;
    try {
      const list = await cloud.listClassMembers(detail.id);
      if (n !== seq.current) return;
      setMembers(list);
      setError(null);
    } catch (e) {
      if (n === seq.current) setError(e);
    }
  }, [detail.id]);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  // approval switched on or off elsewhere: the list changes with it
  useEffect(() => {
    void load();
  }, [detail.approval, load]);

  const onPull = async () => {
    setPulling(true);
    await Promise.all([load(), reloadClass()]);
    setPulling(false);
  };
  const nameOf = (m: ClassMember) => m.name.trim() || t.received.someone;
  /** Runs one change for a person, then shows the list as the cloud has it. */
  const act = async (m: ClassMember, run: () => Promise<void>, done: string) => {
    setBusy(m.id);
    try {
      await run();
      toast.show({ message: () => done, icon: 'check' });
      await Promise.all([load(), reloadClass()]);
    } catch (e) {
      toast.show({ message: (tr) => cloudErrorText(e, tr), icon: 'alert' });
    } finally {
      setBusy(null);
    }
  };
  const onAccept = (m: ClassMember) => act(m, () => cloud.approveClassMember(detail.id, m.id), t.classes.accepted(nameOf(m)));
  const onDecline = (m: ClassMember) => act(m, () => cloud.removeClassMember(detail.id, m.id), t.classes.declined);
  const onRemove = async (m: ClassMember) => {
    const ok = await confirm({
      title: (tr) => tr.classes.removeMemberTitle(nameOf(m)),
      message: (tr) => (detail.approval ? tr.classes.removeMemberApproval : tr.classes.removeMemberOpen),
      confirmLabel: (tr) => tr.classes.removeMember,
      destructive: true,
      icon: 'trash',
    });
    if (ok) await act(m, () => cloud.removeClassMember(detail.id, m.id), t.classes.memberRemoved);
  };

  const requests = members?.filter((m) => m.status === 'pending') ?? [];
  const joined = members?.filter((m) => m.status === 'member') ?? [];
  return (
    <Screen
      header={<Header title={t.classes.members} subtitle={detail.name} />}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.primary} colors={[colors.primary]} />}
      testID="members"
    >
      <InfoStrip muted icon={detail.approval ? 'lock' : 'people'} title={detail.approval ? t.classes.approvalLabel : t.classes.membersOpenTitle} body={detail.approval ? t.classes.membersApprovalHint : t.classes.membersOpenHint} testID="members-mode" />

      {members === null && !error ? (
        <View style={s.list} accessible accessibilityLabel={t.classes.membersLoading} testID="members-loading">
          <Skeleton height={68} radius={radius.card} />
          <Skeleton height={68} radius={radius.card} />
        </View>
      ) : members === null ? (
        <View style={s.block}>
          <InfoStrip
            muted
            icon="cloud-off"
            title={t.classes.membersFailed}
            body={cloudErrorText(error, t)}
            action={<Button label={t.cloud.retry} variant="secondary" size="sm" inline onPress={() => void load()} testID="members-retry" />}
            testID="members-failed"
          />
        </View>
      ) : members.length === 0 ? (
        <View style={s.block}>
          <EmptyState
            title={t.classes.membersEmptyTitle}
            body={t.classes.membersEmptyBody}
            action={{ label: t.classes.invite, icon: 'qr', onPress: () => router.push(`/c/${detail.code}/invite`), testID: 'members-invite' }}
          />
        </View>
      ) : (
        <>
          {requests.length > 0 && (
            <View testID="members-requests">
              <Text variant="overline" color="ink2" style={s.overline} accessibilityRole="header">
                {`${t.classes.requestsTitle} · ${requests.length}`}
              </Text>
              <View style={s.list}>
                {requests.map((m) => (
                  <Card key={m.id} padding={space.m} contentStyle={s.request} testID={`request-${m.id}`}>
                    <Person name={nameOf(m)} when={t.classes.asked(t.time.ago(Date.parse(m.joinedAt)))} tone="leader" />
                    <View style={s.answers}>
                      <Button
                        label={t.classes.decline}
                        variant="secondary"
                        size="sm"
                        disabled={busy === m.id}
                        onPress={() => void onDecline(m)}
                        accessibilityLabel={t.classes.declineA11y(nameOf(m))}
                        style={s.answer}
                        testID={`decline-${m.id}`}
                      />
                      <Button
                        label={t.classes.accept}
                        icon="check"
                        size="sm"
                        loading={busy === m.id}
                        onPress={() => void onAccept(m)}
                        accessibilityLabel={t.classes.acceptA11y(nameOf(m))}
                        style={s.answer}
                        testID={`accept-${m.id}`}
                      />
                    </View>
                  </Card>
                ))}
              </View>
            </View>
          )}
          {joined.length > 0 && (
            <View testID="members-joined">
              <Text variant="overline" color="ink2" style={s.overline} accessibilityRole="header">
                {`${t.classes.members} · ${joined.length}`}
              </Text>
              <View style={s.list}>
                {joined.map((m) => (
                  <Card key={m.id} padding={space.m} contentStyle={s.member} testID={`member-${m.id}`}>
                    <Person name={nameOf(m)} when={t.classes.joinedWhen(t.time.ago(Date.parse(m.joinedAt)))} tone="follower" />
                    <IconButton icon="close" label={t.classes.removeMemberA11y(nameOf(m))} variant="ghost" disabled={busy === m.id} onPress={() => void onRemove(m)} testID={`remove-${m.id}`} />
                  </Card>
                ))}
              </View>
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

/** A person: a tile with their initial, their name and when they asked or joined. */
function Person({ name, when, tone }: { name: string; when: string; tone: 'leader' | 'follower' }) {
  const c = ROLE_COLOR[tone];
  return (
    <View style={s.person} accessible accessibilityLabel={`${name}, ${when}`}>
      <View style={[s.initial, { backgroundColor: c.tint }]}>
        <Text variant="cardTitle" color={c.deep}>
          {(Array.from(name.trim())[0] ?? '?').toUpperCase()}
        </Text>
      </View>
      <View style={s.personText}>
        <Text variant="label" numberOfLines={2}>
          {name}
        </Text>
        <Text variant="caption" color="ink2" style={s.when}>
          {when}
        </Text>
      </View>
    </View>
  );
}

function MembersSkeleton({ label }: { label: string }) {
  return (
    <Screen header={<Header />} testID="members-skeleton">
      <View accessible accessibilityLabel={label} style={s.list}>
        <Skeleton height={61} radius={radius.lg} />
        <Skeleton height={68} radius={radius.card} />
        <Skeleton height={68} radius={radius.card} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  block: { marginTop: space.l },
  overline: { marginTop: space.xl, marginBottom: space.s, marginLeft: space.xs },
  list: { gap: space.m, marginTop: space.s },
  request: { gap: space.m },
  member: { flexDirection: 'row', alignItems: 'center', gap: space.s },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.m, minWidth: 0 },
  initial: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  personText: { flex: 1, minWidth: 0 },
  when: { marginTop: 2 },
  answers: { flexDirection: 'row', gap: space.m },
  answer: { flex: 1 },
});
