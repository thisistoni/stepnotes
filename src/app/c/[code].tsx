/**
 * A class (`/c/<code>`), for anyone with the link: name, teacher, description and the dances
 * (newest first) with their notes. Visitors join with their account or leave; a class with
 * approval shows its dances only once the teacher accepted the request ("locked" until then).
 * "…": report the class, block the teacher. The teacher edits the class, adds dances, edits /
 * updates / removes posts, invites students, sees who joined and deletes the class.
 * States: loading, unknown code, offline (cached copy if there is one), blocked teacher.
 */
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BlockedNotice, useBlockPerson } from '@/components/social/BlockedNotice';
import { ClassFormSheet } from '@/components/social/ClassSheets';
import { AddPostSheet, DanceTile, NoteSheet } from '@/components/social/PostSheets';
import { FirstVisitLesson, InfoStrip, MoreButton, ProblemPage } from '@/components/social/ReceivedParts';
import { ReportSheet } from '@/components/social/ReportSheet';
import { Button, Card, EmptyState, Entrance, Header, Icon, IconButton, Menu, Screen, Skeleton, Text, useConfirm, useToast, type MenuItem } from '@/components/ui';
import { cloud, cloudErrorText, type ClassDetail, type ClassPost } from '@/lib/cloud';
import { useAuth, useRequireAccount } from '@/lib/cloud/auth';
import { useT } from '@/lib/i18n';
import { useBlocked } from '@/lib/social/blocked';
import { summaryOf, useClasses } from '@/lib/social/classes';
import { normalizeCode } from '@/lib/social/links';
import { readReceived } from '@/lib/social/saved';
import { sharePayload } from '@/lib/social/shares';
import { useClassDetail } from '@/lib/social/useClassDetail';
import { useDances } from '@/lib/store';
import { colors, radius, ROLE_COLOR, space } from '@/lib/theme';
import type { Dance } from '@/lib/types';

export default function ClassRoute() {
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = normalizeCode(raw ?? '');
  const t = useT();
  const { state, reload, retry } = useClassDetail(code);
  const { isBlocked } = useBlocked();

  // coming back from a post or the invite page: fetch again (quietly)
  const seen = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (seen.current) void reload();
      seen.current = true;
    }, [reload]),
  );

  if (state.status === 'loading') return <ClassSkeleton label={t.classes.loading} />;
  if (state.status === 'notFound') {
    return (
      <ProblemPage
        title={t.classes.notFoundTitle}
        body={t.classes.notFoundBody}
        action={{ label: t.classes.toClasses, icon: 'people', onPress: () => router.replace('/classes'), testID: 'to-classes' }}
        testID="class-not-found"
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
        testID="class-failed"
      />
    );
  }
  const { detail, offlineAt } = state;
  if (!detail.mine && isBlocked(detail.owner.id)) return <BlockedClass detail={detail} />;
  return <ClassPage detail={detail} offlineAt={offlineAt} reload={reload} />;
}

function ClassPage({ detail, offlineAt, reload }: { detail: ClassDetail; offlineAt?: number; reload: () => Promise<void> }) {
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const { signedIn, profile } = useAuth();
  const requireAccount = useRequireAccount();
  const { isJoined, join, leave, forget, remember } = useClasses();
  const { get } = useDances();
  const blockPerson = useBlockPerson();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [postMenu, setPostMenu] = useState<ClassPost | null>(null);
  const [noteFor, setNoteFor] = useState<ClassPost | null>(null);
  const [busy, setBusy] = useState(false);
  const teacher = detail.owner.name.trim() || t.received.someone;
  const mine = detail.mine;
  const locked = detail.locked;
  const pending = detail.membership === 'pending';
  // without an account: a class kept on this device by an earlier version still counts as joined
  const joined = detail.member || (!signedIn && !locked && isJoined(detail.code));
  const posts = useMemo(() => detail.posts.map((p) => ({ post: p, dance: readReceived(p.dance, t.common.untitled) })), [detail.posts, t.common.untitled]);

  const fail = (e: unknown) => toast.show({ message: (tr) => cloudErrorText(e, tr), icon: 'alert' });

  const doJoin = async () => {
    setBusy(true);
    try {
      const status = await join(detail.code, detail);
      toast.show({ message: (tr) => (status === 'pending' ? tr.classes.requested : tr.classes.joined), icon: 'check', duration: status === 'pending' ? 5000 : undefined });
      await reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  // Joining needs an account. Someone who tapped "Join" and came back signed in is joined
  // without having to tap again.
  const wantsJoin = useRef(false);
  const hasAccount = signedIn && !!profile?.displayName;
  const joinRef = useRef(doJoin);
  useEffect(() => {
    joinRef.current = doJoin;
  });
  useEffect(() => {
    if (!hasAccount || !wantsJoin.current) return;
    wantsJoin.current = false;
    void joinRef.current();
  }, [hasAccount]);
  const onJoin = () => {
    if (requireAccount()) return void doJoin();
    wantsJoin.current = true;
  };
  const onWithdraw = async () => {
    setBusy(true);
    try {
      await leave(detail);
      toast.show({ message: (tr) => tr.classes.withdrawn, icon: 'check' });
      await reload();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const onLeave = async () => {
    const ok = await confirm({
      title: (tr) => tr.classes.leaveTitle(detail.name),
      message: (tr) => tr.classes.leaveMessage,
      confirmLabel: (tr) => tr.classes.leave,
      icon: 'logout',
    });
    if (!ok) return;
    try {
      await leave(detail);
      toast.show({ message: (tr) => tr.classes.left, icon: 'check' });
      void reload();
    } catch (e) {
      fail(e);
    }
  };
  const onDeleteClass = async () => {
    const ok = await confirm({
      title: (tr) => tr.classes.deleteTitle(detail.name),
      message: (tr) => tr.classes.deleteMessage,
      confirmLabel: (tr) => tr.classes.deleteClass,
      destructive: true,
      icon: 'trash',
    });
    if (!ok) return;
    try {
      await cloud.deleteClass(detail.id);
      await forget(detail.code).catch(() => {});
      toast.show({ message: (tr) => tr.classes.deleted, icon: 'trash' });
      router.replace('/classes');
    } catch (e) {
      fail(e);
    }
  };
  const onEdit = async (name: string, description: string, approval: boolean) => {
    await cloud.updateClass(detail.id, { name, description, approval });
    toast.show({ message: (tr) => tr.classes.edited, icon: 'check' });
    await remember({ ...summaryOf(detail), name, description, approval, updatedAt: new Date().toISOString() }).catch(() => {});
    await reload();
  };
  const onPost = async (dance: Dance, note: string) => {
    await cloud.addClassPost(detail.id, { name: dance.name.trim() || t.common.untitled, note, dance: sharePayload(dance) });
    toast.show({ message: (tr) => tr.classes.postedToast, icon: 'check' });
    await reload();
  };
  const onSaveNote = async (note: string) => {
    if (!noteFor) return;
    await cloud.updateClassPost(noteFor.id, { note });
    toast.show({ message: (tr) => tr.classes.noteSaved, icon: 'check' });
    await reload();
  };
  const onUpdateFromLibrary = async (post: ClassPost, posted: Dance | null) => {
    const local = posted ? get(posted.id) : undefined;
    if (!local) return toast.show({ message: (tr) => tr.classes.notInLibrary, icon: 'alert', duration: 5000 });
    try {
      await cloud.updateClassPost(post.id, { name: local.name.trim() || t.common.untitled, dance: sharePayload(local) });
      toast.show({ message: (tr) => tr.classes.updatedPost, icon: 'check' });
      await reload();
    } catch (e) {
      fail(e);
    }
  };
  const onRemovePost = async (post: ClassPost) => {
    const ok = await confirm({
      title: (tr) => tr.classes.removeTitle(post.name),
      message: (tr) => tr.classes.removeMessage,
      confirmLabel: (tr) => tr.classes.removePost,
      destructive: true,
      icon: 'trash',
    });
    if (!ok) return;
    try {
      await cloud.removeClassPost(post.id);
      toast.show({ message: (tr) => tr.classes.removed, icon: 'trash' });
      await reload();
    } catch (e) {
      fail(e);
    }
  };

  const items: MenuItem[] = mine
    ? [
        { key: 'invite', label: t.classes.invite, icon: 'qr', onPress: () => router.push(`/c/${detail.code}/invite`) },
        { key: 'members', label: t.classes.members, icon: 'people', onPress: () => router.push(`/c/${detail.code}/members`) },
        { key: 'edit', label: t.classes.editClass, icon: 'pencil', onPress: () => setEditOpen(true) },
        { key: 'delete', label: t.classes.deleteClass, icon: 'trash', destructive: true, onPress: onDeleteClass },
      ]
    : [
        { key: 'report', label: t.classes.reportClass, icon: 'flag', onPress: () => setReportOpen(true) },
        ...(joined ? [{ key: 'leave', label: t.classes.leave, icon: 'logout' as const, onPress: onLeave }] : []),
        ...(pending ? [{ key: 'withdraw', label: t.classes.withdraw, icon: 'logout' as const, onPress: () => void onWithdraw() }] : []),
        { key: 'block', label: t.classes.blockTeacher(teacher), icon: 'block', destructive: true, onPress: () => void blockPerson(detail.owner) },
      ];
  const menuPost = postMenu ? posts.find((p) => p.post.id === postMenu.id) : undefined;
  const postItems: MenuItem[] = menuPost
    ? [
        { key: 'note', label: t.classes.editNote, icon: 'pencil', onPress: () => setNoteFor(menuPost.post) },
        { key: 'update', label: t.classes.updateFromLibrary, hint: t.classes.updateFromLibraryHint, icon: 'refresh', onPress: () => void onUpdateFromLibrary(menuPost.post, menuPost.dance) },
        { key: 'remove', label: t.classes.removePost, icon: 'trash', destructive: true, onPress: () => void onRemovePost(menuPost.post) },
      ]
    : [];

  const tone = mine ? ROLE_COLOR.leader : ROLE_COLOR.follower;
  return (
    <Screen header={<Header right={<MoreButton label={t.classes.more} onPress={() => setMenuOpen(true)} />} />} testID="class-page">
      <Entrance index={0}>
        <View style={s.hero}>
          <View style={[s.heroTile, { backgroundColor: tone.tint }]}>
            <Icon name={mine ? 'cap' : locked ? 'lock' : 'people'} size={30} color={tone.deep} />
          </View>
          <Text variant="title" accessibilityRole="header" testID="class-name">
            {detail.name}
          </Text>
          <Text variant="bodyStrong" color={tone.deep} accessibilityLabel={mine ? t.classes.youTeachThis : t.classes.teacherA11y(teacher)} testID="class-teacher">
            {mine ? t.classes.youTeachThis : t.classes.with(teacher)}
          </Text>
          {!!detail.description.trim() && (
            <Text variant="body" color="ink2" style={s.desc} testID="class-description-text">
              {detail.description.trim()}
            </Text>
          )}
        </View>
      </Entrance>

      {offlineAt !== undefined && (
        <View style={s.block}>
          <InfoStrip muted icon="cloud-off" title={t.classes.cachedOffline(t.time.ago(offlineAt))} testID="class-offline" />
        </View>
      )}

      <Entrance index={1} style={s.block}>
        {mine ? (
          <View style={s.teacherActions}>
            <Button label={t.classes.invite} icon="qr" onPress={() => router.push(`/c/${detail.code}/invite`)} testID="class-invite" />
            <Button label={t.classes.addDance} icon="plus" variant="secondary" onPress={() => setAddOpen(true)} testID="class-add" />
            <MembersRow memberCount={detail.memberCount} requestCount={detail.requestCount} onPress={() => router.push(`/c/${detail.code}/members`)} />
          </View>
        ) : pending ? (
          <InfoStrip
            icon="lock"
            title={t.classes.pendingTitle}
            body={t.classes.pendingBody(teacher)}
            action={<Button label={t.classes.withdraw} variant="secondary" size="sm" inline loading={busy} onPress={onWithdraw} testID="class-withdraw" />}
            testID="class-pending"
          />
        ) : locked ? (
          <View style={s.teacherActions}>
            <InfoStrip muted icon="lock" title={t.classes.lockedTitle} body={t.classes.lockedBody(teacher)} testID="class-locked" />
            <Button label={t.classes.askToJoin} icon="plus" loading={busy} onPress={onJoin} testID="class-ask" />
          </View>
        ) : joined ? (
          <InfoStrip
            icon="cap"
            title={t.classes.member}
            action={<Button label={t.classes.leave} variant="secondary" size="sm" inline onPress={onLeave} testID="class-leave" />}
            testID="class-member"
          />
        ) : (
          <Button label={t.classes.joinClass} icon="plus" loading={busy} onPress={onJoin} testID="class-join" />
        )}
      </Entrance>

      {!mine && !locked && (
        <View style={s.block}>
          <FirstVisitLesson />
        </View>
      )}

      {/* a locked class has nothing to list: its dances stay with the members */}
      <Entrance index={2} style={locked && s.hidden}>
        <Text variant="overline" color="ink2" style={s.overline} accessibilityRole="header">
          {`${t.classes.dancesTitle} · ${detail.posts.length}`}
        </Text>
        {posts.length === 0 ? (
          <EmptyState title={t.classes.noPostsTitle} body={mine ? t.classes.noPostsTeacher : t.classes.noPostsStudent} action={mine ? { label: t.classes.addDance, icon: 'plus', onPress: () => setAddOpen(true), testID: 'class-add-empty' } : undefined} />
        ) : (
          <View style={s.posts} testID="class-posts">
            {posts.map(({ post, dance }) => (
              <PostRow key={post.id} code={detail.code} post={post} dance={dance} onMore={mine ? () => setPostMenu(post) : undefined} />
            ))}
          </View>
        )}
      </Entrance>

      <Menu visible={menuOpen} onClose={() => setMenuOpen(false)} title={detail.name} items={items} />
      <Menu visible={!!postMenu} onClose={() => setPostMenu(null)} title={postMenu?.name} items={postItems} />
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} kind="class" reportRef={detail.code} />
      {mine && (
        <>
          <ClassFormSheet visible={editOpen} onClose={() => setEditOpen(false)} initial={{ name: detail.name, description: detail.description, approval: detail.approval }} onSubmit={onEdit} />
          <AddPostSheet visible={addOpen} onClose={() => setAddOpen(false)} onPost={onPost} />
          <NoteSheet visible={!!noteFor} onClose={() => setNoteFor(null)} initial={noteFor?.note ?? ''} onSave={onSaveNote} />
        </>
      )}
    </Screen>
  );
}

/** The teacher's way to the member list: how many are in, and how many are asking. */
function MembersRow({ memberCount, requestCount, onPress }: { memberCount: number; requestCount: number; onPress: () => void }) {
  const t = useT();
  const members = memberCount ? t.classes.membersCount(memberCount) : t.classes.noMembers;
  const requests = requestCount ? t.classes.requestsCount(requestCount) : '';
  return (
    <Card onPress={onPress} accessibilityLabel={t.classes.membersA11y(members, requests)} contentStyle={s.postRow} padding={space.m} testID="class-members">
      <View style={[s.membersTile, { backgroundColor: ROLE_COLOR.follower.tint }]}>
        <Icon name="people" size={22} color={ROLE_COLOR.follower.deep} />
      </View>
      <View style={s.postText}>
        <Text variant="label">{t.classes.members}</Text>
        <Text variant="caption" color="ink2" style={s.postNote}>
          {members}
        </Text>
      </View>
      {!!requests && (
        <View style={s.requests} testID="class-requests">
          <Text variant="caption" color="onColor">
            {requests}
          </Text>
        </View>
      )}
      <Icon name="chevron-right" size={22} color={colors.ink3} />
    </Card>
  );
}

function PostRow({ code, post, dance, onMore }: { code: string; post: ClassPost; dance: Dance | null; onMore?: () => void }) {
  const t = useT();
  const when = t.classes.posted(t.time.ago(Date.parse(post.createdAt)));
  const note = post.note.trim();
  return (
    <Card
      onPress={() => router.push(`/c/${code}/${post.id}`)}
      accessibilityLabel={t.classes.postA11y(post.name, note, when)}
      contentStyle={s.postRow}
      padding={space.m}
      testID={`post-${post.id}`}
    >
      <DanceTile dance={dance} size={56} />
      <View style={s.postText}>
        <Text variant="label" numberOfLines={2}>
          {post.name}
        </Text>
        {!!note && (
          <Text variant="small" color="ink2" numberOfLines={3} style={s.postNote} testID={`post-note-${post.id}`}>
            {note}
          </Text>
        )}
        <Text variant="caption" color="ink3" style={s.postNote}>
          {when}
        </Text>
      </View>
      {onMore ? (
        <IconButton icon="more" label={t.classes.postActions(post.name)} variant="ghost" onPress={onMore} testID={`post-more-${post.id}`} />
      ) : (
        <Icon name="chevron-right" size={22} color={colors.ink3} />
      )}
    </Card>
  );
}

function BlockedClass({ detail }: { detail: ClassDetail }) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  return (
    <Screen header={<Header right={<MoreButton label={t.classes.more} onPress={() => setMenuOpen(true)} />} />} testID="class-blocked" contentStyle={s.blocked}>
      <BlockedNotice person={detail.owner} />
      <Menu visible={menuOpen} onClose={() => setMenuOpen(false)} items={[{ key: 'report', label: t.classes.reportClass, icon: 'flag', onPress: () => setReportOpen(true) }]} />
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} kind="class" reportRef={detail.code} />
    </Screen>
  );
}

function ClassSkeleton({ label }: { label: string }) {
  return (
    <Screen header={<Header />} testID="class-loading">
      <View accessible accessibilityLabel={label} style={s.skel}>
        <Skeleton width={60} height={60} radius={20} />
        <Skeleton width="70%" height={26} />
        <Skeleton width="40%" height={16} />
        <Skeleton height={61} radius={radius.lg} style={s.skelGap} />
        <Skeleton height={84} radius={radius.card} style={s.skelGap} />
        <Skeleton height={84} radius={radius.card} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { gap: space.xs, paddingTop: space.s },
  heroTile: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: space.s },
  desc: { marginTop: space.xs },
  block: { marginTop: space.l },
  teacherActions: { gap: space.m },
  overline: { marginTop: space.xl, marginBottom: space.s, marginLeft: space.xs },
  posts: { gap: space.m },
  postRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  postText: { flex: 1, minWidth: 0 },
  postNote: { marginTop: 2 },
  membersTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  requests: { paddingHorizontal: space.s, paddingVertical: 2, borderRadius: radius.xs, backgroundColor: colors.primary },
  hidden: { display: 'none' },
  blocked: { paddingTop: space.xl },
  skel: { gap: space.m, paddingTop: space.s },
  skelGap: { marginTop: space.m },
});
