/**
 * A shared dance (`/s/<shareId>`), for anyone with the link: no account, no intro first.
 * Loading skeleton → the dance in the read-only player, "by <author>", "Save to my library"
 * (or "Open in my library" when this link was saved before). Other states: not found / removed,
 * offline (retry), unreadable, author blocked (Unblock). "…": report, block; the author gets
 * "Manage link" instead.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { PlayerView } from '@/components/player/PlayerView';
import { BlockedNotice, useBlockPerson } from '@/components/social/BlockedNotice';
import {
  FirstVisitLesson,
  InfoStrip,
  MoreButton,
  OpenInApp,
  ProblemPage,
  RECEIVED_FOOTER_H,
  ReceivedFooter,
  ReceivedSkeleton,
} from '@/components/social/ReceivedParts';
import { ReportSheet } from '@/components/social/ReportSheet';
import { Button, Header, Menu, Screen, useToast, type MenuItem } from '@/components/ui';
import { cloud, cloudErrorReason, cloudErrorText, type SharedDance } from '@/lib/cloud';
import { errorText, useT } from '@/lib/i18n';
import { useBlocked } from '@/lib/social/blocked';
import { shareAppUrl } from '@/lib/social/links';
import { readReceived, savedCopy, withCredit } from '@/lib/social/saved';
import { useDances } from '@/lib/store';
import { space } from '@/lib/theme';
import type { Dance } from '@/lib/types';

type State =
  | { status: 'loading' }
  | { status: 'ready'; share: SharedDance; dance: Dance | null }
  | { status: 'notFound' }
  | { status: 'failed'; error: unknown };

export default function SharedDanceRoute() {
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = (raw ?? '').trim().toLowerCase();
  return <SharedDanceLoader key={id} id={id} />;
}

function SharedDanceLoader({ id }: { id: string }) {
  const t = useT();
  const { isBlocked } = useBlocked();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let alive = true;
    cloud
      .getShare(id)
      .then((share) => {
        if (!alive) return;
        if (!share) return setState({ status: 'notFound' });
        setState({ status: 'ready', share, dance: readReceived(share.dance, t.common.untitled) });
      })
      .catch((error) => alive && setState(cloudErrorReason(error) === 'notFound' ? { status: 'notFound' } : { status: 'failed', error }));
    return () => {
      alive = false;
    };
    // the dictionary only names an untitled dance: no reload on a language switch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  if (state.status === 'loading') return <ReceivedSkeleton label={t.received.loading} testID="share-page-loading" />;
  if (state.status === 'notFound') {
    return (
      <ProblemPage
        title={t.received.notFoundTitle}
        body={t.received.notFoundBody}
        action={{ label: t.received.toLibrary, icon: 'footprints', onPress: () => router.replace('/'), testID: 'to-library' }}
        testID="share-page-not-found"
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
        testID="share-page-failed"
      />
    );
  }
  const { share, dance } = state;
  if (isBlocked(share.author.id) && !share.mine) return <BlockedPage share={share} />;
  if (!dance) {
    return (
      <ProblemPage
        title={t.received.unreadableTitle}
        body={t.received.unreadableBody}
        action={{ label: t.received.toLibrary, icon: 'footprints', onPress: () => router.replace('/'), testID: 'to-library' }}
        testID="share-page-unreadable"
      />
    );
  }
  return <SharedPlayer key={`${share.id}:${share.updatedAt}`} share={share} dance={dance} />;
}

function SharedPlayer({ share, dance }: { share: SharedDance; dance: Dance }) {
  const t = useT();
  const toast = useToast();
  const { custom, save } = useDances();
  const blockPerson = useBlockPerson();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const author = share.author.name.trim() || t.received.someone;
  const saved = savedCopy(custom, 'share', share.id);

  const onSave = async () => {
    setSaving(true);
    try {
      const copy = await save(withCredit(dance, { kind: 'share', ref: share.id, author: share.author.name.trim(), authorId: share.author.id }));
      toast.show({ message: (tr) => tr.received.saved, icon: 'check', action: { label: (tr) => tr.common.open, onPress: () => router.push(`/dance/${copy.id}`) } });
    } catch (e) {
      toast.show({ message: (tr) => errorText(e, tr, tr.received.saveFailed), icon: 'alert' });
    } finally {
      setSaving(false);
    }
  };
  // the dance's share sheet when it is in this device's library, else the list of my links
  const manage = () => {
    const danceId = sharedDanceId(share);
    router.push(danceId && custom.some((d) => d.id === danceId) ? `/dance/${danceId}?share=1` : '/shared-links');
  };

  const items: MenuItem[] = share.mine
    ? [{ key: 'manage', label: t.received.manage, icon: 'link', onPress: manage }]
    : [
        { key: 'report', label: t.received.report, icon: 'flag', onPress: () => setReportOpen(true) },
        { key: 'block', label: t.received.block(author), icon: 'block', destructive: true, onPress: () => void blockPerson(share.author) },
      ];

  return (
    <PlayerView
      dance={dance}
      byline={t.received.by(author)}
      headerRight={() => <MoreButton label={t.received.more} onPress={() => setMenuOpen(true)} />}
      belowStart={
        <>
          {share.mine && (
            <InfoStrip
              icon="link"
              title={t.received.yours}
              action={<Button label={t.received.manage} variant="secondary" size="sm" inline onPress={manage} testID="manage-link" />}
              testID="share-mine"
            />
          )}
          <FirstVisitLesson />
        </>
      }
      belowEnd={<OpenInApp url={shareAppUrl(share.id)} />}
      footer={share.mine ? undefined : <ReceivedFooter savedId={saved?.id} onSave={onSave} saving={saving} />}
      footerHeight={share.mine ? 0 : RECEIVED_FOOTER_H}
      testID="share-page"
    >
      <Menu visible={menuOpen} onClose={() => setMenuOpen(false)} title={dance.name} items={items} />
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} kind="share" reportRef={share.id} />
    </PlayerView>
  );
}

/**
 * The library id of a shared dance: the link carries the dance as it was in the author's
 * library, id included.
 */
function sharedDanceId(share: SharedDance) {
  const d = share.dance as { id?: unknown } | null;
  return typeof d?.id === 'string' ? d.id : '';
}

function BlockedPage({ share }: { share: SharedDance }) {
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  return (
    <Screen header={<Header right={<MoreButton label={t.received.more} onPress={() => setMenuOpen(true)} />} />} testID="share-page-blocked" contentStyle={s.blocked}>
      <BlockedNotice person={share.author} />
      <Menu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[{ key: 'report', label: t.received.report, icon: 'flag', onPress: () => setReportOpen(true) }]}
      />
      <ReportSheet visible={reportOpen} onClose={() => setReportOpen(false)} kind="share" reportRef={share.id} />
    </Screen>
  );
}

const s = StyleSheet.create({
  blocked: { paddingTop: space.xl },
});
