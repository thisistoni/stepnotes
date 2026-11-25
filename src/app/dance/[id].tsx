/**
 * Player for a dance in the library: the shared PlayerView plus the library actions (edit / make
 * my own, duplicate, share, delete with undo). `?share=1` opens the share sheet right away
 * ("Manage link" on a shared dance's page).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { DanceNotFound } from '@/components/DanceNotFound';
import { PlayerView, type PlayerHandle } from '@/components/player/PlayerView';
import { shareDance } from '@/components/player/shareDance';
import { ShareSheet } from '@/components/social/ShareSheet';
import { goBackOrHome, Header, IconButton, Menu, Screen, useConfirm, useToast, type MenuItem } from '@/components/ui';
import { errorText, useT } from '@/lib/i18n';
import { usePrefs } from '@/lib/prefs';
import { useDances } from '@/lib/store';
import type { Dance } from '@/lib/types';

export default function DancePlayerRoute() {
  const { id, share } = useLocalSearchParams<{ id: string; share?: string }>();
  const { get, ready } = useDances();
  const prefsReady = usePrefs().ready;
  // while a delete is in flight the dance vanishes from the store before the screen has left:
  // keep drawing it instead of flashing "not found"
  const [leaving, setLeaving] = useState<Dance | null>(null);
  const dance = get(id) ?? leaving ?? undefined;

  if (!ready || !prefsReady) return <Screen header={<Header />} testID="player-loading" />;
  if (!dance) return <DanceNotFound testID="player-not-found" />;
  return <DancePlayer key={dance.id} dance={dance} onLeaving={setLeaving} openShare={share === '1'} />;
}

function DancePlayer({ dance, onLeaving, openShare }: { dance: Dance; onLeaving: (d: Dance | null) => void; openShare: boolean }) {
  const { duplicate, remove, restore, isBuiltIn } = useDances();
  const t = useT();
  const toast = useToast();
  const confirm = useConfirm();
  const player = useRef<PlayerHandle>(null);
  const pause = useCallback(() => player.current?.pause(), []);

  const builtIn = !!dance.builtIn || isBuiltIn(dance.id);
  const makeOwn = useCallback(() => {
    pause();
    router.push(`/edit/new?from=${encodeURIComponent(dance.id)}`);
  }, [pause, dance.id]);
  const edit = useCallback(() => {
    pause();
    router.push(`/edit/${dance.id}`);
  }, [pause, dance.id]);

  const [menuOpen, setMenuOpen] = useState(false);
  // starter dances are on every phone already: they are only shared as text
  const [shareOpen, setShareOpen] = useState(openShare && !builtIn);
  const name = dance.name.trim() || t.common.untitled;
  const onDuplicate = async () => {
    try {
      const copy = await duplicate(dance);
      toast.show({ message: (tr) => tr.player.copied, icon: 'copy', action: { label: (tr) => tr.common.open, onPress: () => router.push(`/dance/${copy.id}`) } });
    } catch (e) {
      toast.show({ message: (tr) => errorText(e, tr, tr.player.copyFailed), icon: 'alert' });
    }
  };
  const onDelete = async () => {
    pause();
    const ok = await confirm({
      title: (tr) => tr.player.deleteTitle(name),
      message: (tr) => tr.player.deleteMessage,
      confirmLabel: (tr) => tr.player.delete,
      destructive: true,
      icon: 'trash',
    });
    if (!ok) return;
    onLeaving(dance);
    try {
      const removed = await remove(dance.id);
      goBackOrHome();
      if (removed) {
        toast.show({
          message: (tr) => tr.player.deleted(name),
          icon: 'trash',
          action: {
            label: (tr) => tr.common.undo,
            onPress: () => restore(removed).catch(() => toast.show({ message: (tr) => tr.player.restoreFailed, icon: 'alert' })),
          },
        });
      }
    } catch (e) {
      onLeaving(null);
      toast.show({ message: (tr) => errorText(e, tr, tr.player.deleteFailed), icon: 'alert' });
    }
  };
  const onShare = () => {
    if (builtIn) void shareDance(dance, t, toast.show);
    else setShareOpen(true);
  };
  const menuItems: MenuItem[] = [
    builtIn
      ? { key: 'own', label: t.player.makeOwn, hint: t.player.makeOwnHint, icon: 'pencil', onPress: makeOwn }
      : { key: 'edit', label: t.player.editSteps, icon: 'pencil', onPress: edit },
    { key: 'dup', label: t.player.duplicate, hint: t.player.duplicateHint, icon: 'copy', onPress: onDuplicate },
    { key: 'share', label: t.player.share, hint: builtIn ? t.player.shareHint : t.player.shareLinkHint, icon: 'share', onPress: onShare },
    ...(builtIn ? [] : [{ key: 'del', label: t.player.delete, icon: 'trash' as const, destructive: true, onPress: onDelete }]),
  ];

  return (
    <PlayerView
      ref={player}
      dance={dance}
      headerRight={(narrow) => (
        <>
          {!narrow && (
            <IconButton icon="pencil" label={builtIn ? t.player.makeOwn : t.player.edit} onPress={builtIn ? makeOwn : edit} testID="edit-button" />
          )}
          <IconButton icon="more" label={t.player.more} onPress={() => setMenuOpen(true)} testID="more-button" />
        </>
      )}
      listAction={builtIn ? { label: t.player.makeOwnShort, onPress: makeOwn } : { label: t.player.editSteps, onPress: edit }}
    >
      <Menu visible={menuOpen} onClose={() => setMenuOpen(false)} title={name} items={menuItems} />
      {!builtIn && <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} dance={dance} onBeforeLeave={pause} />}
    </PlayerView>
  );
}
