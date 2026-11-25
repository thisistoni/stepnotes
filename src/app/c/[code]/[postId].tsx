/**
 * One dance of a class (`/c/<code>/<postId>`): the read-only player with the teacher's note and
 * "Save to my library" (credit: `source.kind = 'class'`, `ref = '<code>/<postId>'`).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { PlayerView } from '@/components/player/PlayerView';
import { BlockedNotice, useBlockPerson } from '@/components/social/BlockedNotice';
import { FirstVisitLesson, MoreButton, NoteCard, ProblemPage, RECEIVED_FOOTER_H, ReceivedFooter, ReceivedSkeleton } from '@/components/social/ReceivedParts';
import { ReportSheet } from '@/components/social/ReportSheet';
import { Header, Menu, Screen, useToast, type MenuItem } from '@/components/ui';
import { cloudErrorText, type ClassDetail, type ClassPost } from '@/lib/cloud';
import { errorText, useT } from '@/lib/i18n';
import { useBlocked } from '@/lib/social/blocked';
import { normalizeCode, postRef } from '@/lib/social/links';
import { readReceived, savedCopy, withCredit } from '@/lib/social/saved';
import { useClassDetail } from '@/lib/social/useClassDetail';
import { useDances } from '@/lib/store';
import { space } from '@/lib/theme';
import type { Dance } from '@/lib/types';

export default function ClassPostRoute() {
  const { code: rawCode, postId } = useLocalSearchParams<{ code: string; postId: string }>();
  const code = normalizeCode(rawCode ?? '');
  const t = useT();
  const { state, retry } = useClassDetail(code);
  const { isBlocked } = useBlocked();
  const toClass = () => (router.canGoBack() ? router.back() : router.replace(`/c/${code}`));

  const post = state.status === 'ready' ? state.detail.posts.find((p) => p.id === postId) : undefined;
  const dance = useMemo(() => (post ? readReceived(post.dance, t.common.untitled) : null), [post, t.common.untitled]);

  if (state.status === 'loading') return <ReceivedSkeleton label={t.received.loading} testID="post-loading" />;
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
        title={t.received.failedTitle}
        body={cloudErrorText(state.error, t)}
        action={{ label: t.cloud.retry, icon: 'refresh', onPress: retry, testID: 'retry' }}
        testID="post-failed"
      />
    );
  }
  const { detail } = state;
  if (!detail.mine && isBlocked(detail.owner.id)) {
    return (
      <Screen header={<Header />} testID="post-blocked" contentStyle={s.blocked}>
        <BlockedNotice person={detail.owner} />
      </Screen>
    );
  }
  if (!post) {
    return (
      <ProblemPage
        title={t.classes.postNotFoundTitle}
        body={t.classes.postNotFoundBody}
        action={{ label: t.classes.toClass, icon: 'people', onPress: toClass, testID: 'to-class' }}
        testID="post-not-found"
      />
    );
  }
  if (!dance) {
    return (
      <ProblemPage
        title={t.received.unreadableTitle}
        body={t.received.unreadableBody}
        action={{ label: t.classes.toClass, icon: 'people', onPress: toClass, testID: 'to-class' }}
        testID="post-unreadable"
      />
    );
  }
  return <PostPlayer key={`${post.id}:${post.updatedAt}`} detail={detail} post={post} dance={dance} />;
}

function PostPlayer({ detail, post, dance }: { detail: ClassDetail; post: ClassPost; dance: Dance }) {
  const t = useT();
  const toast = useToast();
  const { custom, save } = useDances();
  const blockPerson = useBlockPerson();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = postRef(detail.code, post.id);
  const teacher = detail.owner.name.trim() || t.received.someone;
  const saved = savedCopy(custom, 'class', ref);
  const note = post.note.trim();

  const onSave = async () => {
    setSaving(true);
    try {
      const copy = await save(withCredit({ ...dance, name: post.name.trim() || dance.name }, { kind: 'class', ref, author: detail.owner.name.trim(), authorId: detail.owner.id }));
      toast.show({ message: (tr) => tr.received.saved, icon: 'check', action: { label: (tr) => tr.common.open, onPress: () => router.push(`/dance/${copy.id}`) } });
    } catch (e) {
      toast.show({ message: (tr) => errorText(e, tr, tr.received.saveFailed), icon: 'alert' });
    } finally {
      setSaving(false);
    }
  };
  const goClass = () => router.push(`/c/${detail.code}`);
  const items: MenuItem[] = [
    { key: 'class', label: t.classes.toClass, hint: detail.name, icon: 'people', onPress: goClass },
    ...(detail.mine
      ? []
      : [
          { key: 'report', label: t.received.report, icon: 'flag' as const, onPress: () => setReportOpen(true) },
          { key: 'block', label: t.classes.blockTeacher(teacher), icon: 'block' as const, destructive: true, onPress: () => void blockPerson(detail.owner) },
        ]),
  ];

  return (
    <PlayerView
      dance={{ ...dance, name: post.name.trim() || dance.name }}
      byline={detail.mine ? detail.name : t.received.by(teacher)}
      headerRight={() => <MoreButton label={t.received.more} onPress={() => setMenuOpen(true)} />}
      belowStart={
        <>
          {!!note && <NoteCard title={detail.mine ? t.received.noteTitleMine : t.received.noteTitle} note={note} />}
          <FirstVisitLesson />
        </>
      }
      footer={detail.mine ? undefined : <ReceivedFooter savedId={saved?.id} onSave={onSave} saving={saving} />}
      footerHeight={detail.mine ? 0 : RECEIVED_FOOTER_H}
      testID="post-page"
    >
      <Menu visible={menuOpen} onClose={() => setMenuOpen(false)} title={post.name} items={items} />
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} kind="post" reportRef={ref} />
    </PlayerView>
  );
}

const s = StyleSheet.create({
  blocked: { paddingTop: space.xl },
});
