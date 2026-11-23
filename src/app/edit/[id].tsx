/**
 * Editor. Routes:
 *   /edit/new              blank dance
 *   /edit/new?from=<id>    unsaved copy of any dance ("Make my own version"), stored only on Save
 *   /edit/<id>             an own dance (built-in ids redirect to the player)
 */
import { Redirect, router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CoachHint, coachHint } from '@/components/editor/CoachHint';
import { DetailsCard } from '@/components/editor/DetailsCard';
import { EditorCanvas, RotateTray } from '@/components/editor/EditorCanvas';
import { EditorTopBar } from '@/components/editor/EditorTopBar';
import { FollowerSetupCard, FollowerToolsCard } from '@/components/editor/FollowerCards';
import { Inspector } from '@/components/editor/Inspector';
import { RevealProvider, useRevealScroll } from '@/components/editor/reveal';
import { StepStrip } from '@/components/editor/StepStrip';
import { EmptyState, Entrance, FootSticker, goBackOrHome, hapticNotify, Screen, Segmented, Skeleton, useConfirm, useToast } from '@/components/ui';
import { computeStates, nextCount } from '@/lib/pattern';
import { newDance, useDances } from '@/lib/store';
import { DEFAULT_FOOT_STYLE, ROLE_COLOR, space, styleColor } from '@/lib/theme';
import type { Dance, Role } from '@/lib/types';
import { copyForEditing, useDanceDraft } from '@/lib/useDanceDraft';
import { DanceValidationError } from '@/lib/validate';

export default function EditorRoute() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { get, ready, isBuiltIn } = useDances();
  const isNew = id === 'new';

  // Wait for the store, or "Save" on a not-yet-loaded dance would create a new one.
  if (!ready) {
    return (
      <Screen header={<EditorTopBar title={isNew ? 'New dance' : 'Edit dance'} onClose={goBackOrHome} />}>
        <Skeleton height={68} radius={24} />
        <Skeleton height={320} radius={28} style={s.loadingStage} />
      </Screen>
    );
  }
  // Starter dances are read-only: the player offers "Make my own version".
  if (!isNew && isBuiltIn(id)) return <Redirect href={`/dance/${id}`} />;
  const existing = isNew ? undefined : get(id);
  if (!isNew && !existing) {
    return (
      <Screen header={<EditorTopBar title="Not found" onClose={goBackOrHome} />}>
        <EmptyState
          art={<FootSticker tone={ROLE_COLOR.leader} size={44} rotate={-10} />}
          title="This dance is gone"
          body="It may have been deleted."
          action={{ label: 'Back to library', onPress: () => router.replace('/') }}
          style={s.notFound}
        />
      </Screen>
    );
  }
  const source = isNew && from ? get(from) : undefined;
  // key: another dance (or another source) gets a fresh editor
  return <Editor key={`${id}:${source?.id ?? ''}`} existing={existing} source={source} />;
}

/** Normalise what the user typed before storing. */
function finalize(d: Dance): Dance {
  const fixCounts = (p: Dance['roles']['leader']) => ({
    ...p,
    steps: p.steps.map((st, i) => (st.count.trim() ? st : { ...st, count: nextCount(p.steps.slice(0, i), d.beatsPerBar) })),
  });
  return {
    ...d,
    name: d.name.trim() || 'Untitled dance',
    style: d.style.trim(),
    description: d.description.trim(),
    videoUrl: d.videoUrl?.trim() || undefined,
    roles: {
      leader: fixCounts(d.roles.leader),
      ...(d.roles.follower ? { follower: fixCounts(d.roles.follower) } : {}),
    },
  };
}

const URL_RE = /^https?:\/\/\S+\.\S+$/i;
function videoProblem(url: string | undefined): string | null {
  const v = url?.trim();
  if (!v || URL_RE.test(v)) return null;
  return 'This doesn’t look like a web link. Paste the full address, starting with https://';
}

function Editor({ existing, source }: { existing?: Dance; source?: Dance }) {
  const isNew = !existing;
  const { save } = useDances();
  const toast = useToast();
  const confirm = useConfirm();
  const { height: winH } = useWindowDimensions();
  const [initial] = useState<Dance>(() => (existing ? existing : source ? copyForEditing(source) : newDance()));
  const d = useDanceDraft(initial);
  const { draft, role, pattern, sel, startFoot } = d;

  const [detailsOpen, setDetailsOpen] = useState(isNew && !source);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [pressing, setPressing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { scrollRef, contentRef, onScroll, onLayout, reveal: revealField } = useRevealScroll();

  // --- leaving -------------------------------------------------------------------------------
  const askDiscard = useCallback(
    () =>
      confirm({
        title: 'Discard your changes?',
        message: isNew ? 'This dance has not been saved yet.' : 'Your edits since the last save will be lost.',
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        destructive: true,
        icon: 'trash',
      }),
    [confirm, isNew],
  );
  // hardware back, swipe-back and browser back/reload
  const allowLeave = usePreventRemove(d.dirty && !leaving, ({ repeat }) => {
    askDiscard().then((ok) => {
      if (!ok) return;
      setLeaving(true);
      repeat();
    });
  });
  const close = async () => {
    if (d.dirty && !(await askDiscard())) return;
    setLeaving(true);
    allowLeave();
    goBackOrHome();
  };

  const onSave = async () => {
    const problem = videoProblem(draft.videoUrl);
    if (problem) {
      setVideoError(problem);
      setDetailsOpen(true);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      toast.show({ message: 'Check the video link first', icon: 'alert' });
      hapticNotify('error');
      return;
    }
    setSaving(true);
    try {
      const saved = await save(finalize(draft));
      hapticNotify('success');
      toast.show({ message: isNew ? 'Dance saved' : 'Changes saved', icon: 'check' });
      setLeaving(true);
      allowLeave();
      if (isNew) router.replace(`/dance/${saved.id}`);
      else if (router.canGoBack()) router.back();
      else router.replace(`/dance/${saved.id}`);
    } catch (e) {
      setSaving(false);
      toast.show({
        message: e instanceof DanceValidationError ? e.message : 'Could not save. Please try again.',
        icon: 'alert',
      });
    }
  };

  // --- steps -------------------------------------------------------------------------------
  const states = useMemo(() => (pattern ? computeStates(pattern) : []), [pattern]);
  const step = pattern && sel >= 0 ? pattern.steps[sel] : null;

  // The toast's Undo only applies while the delete is still the latest change.
  const depth = useRef(d.undoDepth);
  useEffect(() => {
    depth.current = d.undoDepth;
  }, [d.undoDepth]);
  const { deleteStep: removeStep, undo } = d;
  const deleteStep = useCallback(
    (i: number) => {
      const expected = depth.current + 1;
      removeStep(i);
      toast.show({
        message: `Step ${i + 1} deleted`,
        icon: 'trash',
        action: { label: 'Undo', onPress: () => depth.current === expected && undo() },
      });
    },
    [removeStep, undo, toast],
  );
  const { updateStep, select: selectStep } = d;
  const onCountBlur = useCallback(
    (i: number) => {
      const st = pattern?.steps[i];
      if (pattern && st && !st.count.trim()) updateStep(i, { count: nextCount(pattern.steps.slice(0, i), draft.beatsPerBar) });
    },
    [updateStep, pattern, draft.beatsPerBar],
  );
  const select = useCallback(
    (i: number) => {
      setBlocked(false);
      selectStep(i);
    },
    [selectStep],
  );

  const regenerate = async () => {
    const ok = await confirm({
      title: 'Mirror the leader again?',
      message: 'The follower’s steps are replaced by a mirror of the leader’s. You can undo this.',
      confirmLabel: 'Mirror again',
      icon: 'mirror',
    });
    if (ok) d.createFollower('mirror');
  };
  const removeFollower = async () => {
    const ok = await confirm({
      title: 'Remove the follower part?',
      message: 'All follower steps are removed from this dance. You can undo this.',
      confirmLabel: 'Remove',
      destructive: true,
      icon: 'trash',
    });
    if (ok) d.removeFollower();
  };

  // --- layout ------------------------------------------------------------------------------
  // Canvas + step strip fit on one phone screen together (with the details collapsed).
  const canvasH = Math.round(Math.min(380, Math.max(200, winH - 470)));
  const tone = styleColor(draft.style);
  const hint = coachHint({ sel, step, stepCount: pattern?.steps.length ?? 0, startFoot, dragging: d.dragging, blocked });
  const roleOptions = (['leader', 'follower'] as Role[]).map((r) => ({
    value: r,
    label: r === 'leader' ? 'Leader' : 'Follower',
    icon: r === 'leader' ? ('flat-shoe' as const) : ('heel' as const),
    tone: ROLE_COLOR[r],
  }));

  return (
    <Screen
      scroll={false}
      padded={false}
      testID="editor"
      header={
        <EditorTopBar
          title={isNew ? 'New dance' : 'Edit dance'}
          onClose={close}
          onUndo={d.undo}
          canUndo={d.canUndo}
          onSave={onSave}
          saving={saving}
        />
      }
    >
      <ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        onLayout={onLayout}
        scrollEventThrottle={32}
        scrollEnabled={!pressing}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        <View ref={contentRef} style={s.stack}>
          <RevealProvider value={revealField}>
            <Entrance index={0}>
              <DetailsCard
                draft={draft}
                expanded={detailsOpen}
                onToggle={() => setDetailsOpen((o) => !o)}
                onChange={d.setDetails}
                onSeal={d.seal}
                videoError={videoError}
                onVideoBlur={() => setVideoError(videoProblem(draft.videoUrl))}
              />
            </Entrance>

            <Entrance index={1}>
              <Segmented label="Part" options={roleOptions} value={role} onChange={d.setRole} testID="role-switch" />
            </Entrance>

            {!pattern ? (
              <Entrance index={2}>
                <FollowerSetupCard onCreate={d.createFollower} />
              </Entrance>
            ) : (
              <>
                <Entrance index={2} style={s.work}>
                  <EditorCanvas
                    key={role}
                    pattern={pattern}
                    role={role}
                    footStyle={draft.footStyle?.[role] ?? DEFAULT_FOOT_STYLE[role]}
                    tone={tone}
                    sel={sel}
                    startFoot={startFoot}
                    height={canvasH}
                    onDragStart={d.beginDrag}
                    onDragMove={d.dragTo}
                    onDragEnd={d.endDrag}
                    onBlockedTouch={() => setBlocked(true)}
                    onPressChange={setPressing}
                  />
                  <View style={s.hintRow}>
                    <CoachHint text={hint} role={role} />
                    <RotateTray onRotate={d.rotate} disabled={step?.kind === 'hold'} />
                  </View>
                  <StepStrip steps={pattern.steps} role={role} sel={sel} onSelect={select} onAdd={d.addStep} />
                </Entrance>

                <Entrance index={3}>
                  <Inspector
                    role={role}
                    steps={pattern.steps}
                    sel={sel}
                    before={states[Math.max(0, sel)] ?? states[0]}
                    startFoot={startFoot}
                    onStartFoot={d.setStartFoot}
                    onAdd={d.addStep}
                    onUpdate={d.updateStep}
                    onCountBlur={onCountBlur}
                    onFoot={d.setFoot}
                    onKind={d.setKind}
                    onMove={d.moveStep}
                    onDelete={deleteStep}
                    onSeal={d.seal}
                  />
                </Entrance>

                {role === 'follower' && <FollowerToolsCard onRegenerate={regenerate} onRemove={removeFollower} />}
              </>
            )}
          </RevealProvider>
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: space.gutter, paddingTop: space.s, paddingBottom: space.xxl * 2 },
  stack: { gap: space.l },
  work: { gap: space.m },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: space.m },
  loadingStage: { marginTop: space.l },
  notFound: { marginTop: space.xl },
});
